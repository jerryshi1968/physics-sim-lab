import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { createDensityExperiment } from '../../src/experiments/density.ts';
import { simulateDensity, densityViewScene, densityDrop, densityPour, detachedDensityUpdates } from '../../src/equipment/density/simulate.ts';
import { displacedLiquid } from '../../src/core/measurements/density.ts';
import { buildDensityReading, buildDensityResult, densityProfiles } from '../../src/equipment/density/measure.ts';
import { appendMeasurements, correctManualMeasurement, removeMeasurement } from '../../src/core/measurements/records.ts';
import { displayMeasurement, measurementInputInSI } from '../../src/core/measurements/display.ts';
import { measurementSeries } from '../../src/core/measurements/charts.ts';
import { measurementsCsv } from '../../src/core/measurements/csv.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { parseSceneJson, serializeScene } from '../../src/core/scene/transfer.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';
import { convertUnit } from '../../src/core/units/units.ts';
const registry = createWorkbenchRegistry(), time = '2026-11-09T04:00:00.000Z';
const close = (a,b) => assert.ok(Math.abs(a-b) < 1e-10, `${a} != ${b}`);
const create = (liquid=false) => createDensityExperiment('density.test',time,liquid);
function set(s,id,parameters) { s.equipment.find(x=>x.id===id).parameters = { ...s.equipment.find(x=>x.id===id).parameters,...parameters }; s.revision++; return s; }
function reading(s,phase,raw,id) { const result=buildDensityReading(s,registry,{phase,raw,group:'第1组',note:''},id,time); assert.equal(result.ok,true,JSON.stringify(result)); return result; }
function append(s,b) { const a=appendMeasurements(s,registry,b.records,b.snapshot,time); assert.equal(a.ok,true,JSON.stringify(a)); return a.document; }
function solid(raw='54') {
 let s=create();set(s,'balance',{zeroTrimKg:.0006,riderKg:.001});set(s,'masses',{mask:322});set(s,'specimen',{targetId:'balance'});
 s=append(s,reading(s,'mass',raw,'mass'));set(s,'specimen',{targetId:''});s=append(s,reading(s,'initial','50','initial'));set(s,'specimen',{targetId:'cylinder'});s=append(s,reading(s,'immersed','70','immersed'));return s;
}
function liquid() {
 let s=create(true);set(s,'balance',{zeroTrimKg:.0006});set(s,'masses',{mask:17});set(s,'beaker',{targetId:'balance'});
 s=append(s,reading(s,'liquid-before','110','before'));const pour=densityPour(s,registry,.00003);assert.equal(pour.ok,true);for(const u of pour.updates)set(s,u.id,u.parameters);set(s,'masses',{mask:22});s=append(s,reading(s,'liquid-after','80','after'));s=append(s,reading(s,'liquid-volume','30','volume'));return s;
}
const result = (s, ids=['mass.0','initial.0','immersed.0'],id='result') => buildDensityResult(s,registry,ids,'第1组',id,time);
test('density solid/liquid kits and blank documents remain version 2 with pending curriculum',()=>{
 for (const liquid of [false, true]) for (const empty of [false, true]) {
  const scene = createDensityExperiment('test', time, liquid, empty);
  assert.equal(validateSceneDocument(scene, registry).ok, true);
  const expected = empty ? [] : ['balance', 'cylinder', 'masses', liquid ? 'beaker' : 'specimen'].sort();
  assert.deepEqual(scene.equipment.map(item => item.id).sort(), expected);
  if (!empty) close(scene.equipment.find(item => item.id === 'cylinder').parameters.liquidM3, liquid ? 0 : .00005);
  assert.equal(scene.curriculumRef.textbookMappings[0].status, 'pending_teacher_review');
 }
});
test('SI conversions have independent volume and density expectations',()=>{close(convertUnit(20,'mL','m³'),.00002);close(convertUnit(1,'cm³','mL'),1);close(convertUnit(2.7,'g/cm³','kg/m³'),2700);assert.throws(()=>convertUnit(1,'mL','kg'));});
test('solid A displaces 20 mL from 50 to 70 mL, partial immersion is self consistent',()=>{
 let d=displacedLiquid(.00005,.00002,.01,.0001);close(d.readingM3,.00007);assert.equal(d.fullyImmersed,true);
 d=displacedLiquid(.00005,.00002,.1,.0001);close(d.readingM3,.00005);assert.equal(d.fullyImmersed,false);
 d=displacedLiquid(.00005,.00002,.06,.0001);close(d.readingM3,.00006333333333333333);assert.equal(d.fullyImmersed,false);
});
test('overflow and invalid geometry never masquerade as a normal liquid level',()=>{
 assert.equal(displacedLiquid(.00009,.00002,.01,.0001).overflow,true);assert.equal(displacedLiquid(0,.00002,.01,.0001).fullyImmersed,false);
 for(const v of [NaN,Infinity,-1])assert.throws(()=>displacedLiquid(v,.00002,.01,.0001));
});
test('empty zeroing, left load, standard masses and rider determine balance independently',()=>{
 const s=create();let d=simulateDensity(s,registry);assert.equal(d.ok,true);assert.equal(d.calibrated,false);close(d.residualKg,.0006);
 set(s,'balance',{zeroTrimKg:.0006});d=simulateDensity(s,registry);assert.equal(d.calibrated,true);assert.equal(d.canZero,true);
 set(s,'specimen',{targetId:'balance'});d=simulateDensity(s,registry);close(d.leftKg,.054);assert.ok(d.residualKg>0);assert.equal(d.canZero,false);
 set(s,'masses',{mask:322});set(s,'balance',{riderKg:.001});d=simulateDensity(s,registry);close(d.weightsKg,.053);close(d.rightKg,.054);assert.equal(d.readableMass,true);
 set(s,'balance',{riderKg:.002});assert.equal(simulateDensity(s,registry).balanced,false);
});
test('unbalanced, unzeroed, over capacity, fractional rider and occupied pan are guarded',()=>{
 const s=create();set(s,'specimen',{targetId:'balance'});assert.equal(buildDensityReading(s,registry,{phase:'mass',raw:'54',group:'g',note:''},'m',time).code,'DENSITY_BALANCE');
 s.equipment.push(create(true).equipment.find(item => item.id === 'beaker'));
 set(s,'beaker',{targetId:'balance'});assert.equal(simulateDensity(s,registry).code,'DENSITY_PAN_OCCUPIED');set(s,'specimen',{targetId:''});set(s,'beaker',{liquidM3:.00025});assert.equal(simulateDensity(s,registry).overRange,true);
 set(s,'balance',{riderKg:.0001});assert.equal(simulateDensity(s,registry).code,'DENSITY_RIDER');
});
test('presentation follows a dropping pan without changing stored free pose',()=>{
 const s=create();set(s,'specimen',{targetId:'balance'});const before=structuredClone(s),d=simulateDensity(s,registry),shown=densityViewScene(s,null,d);assert.ok(shown.equipment[2].pose.yM<.08);assert.deepEqual(s,before);
});
test('dragging attaches to pan/cylinder, occupied pan is not overlapped, masses associate right pan',()=>{
 const s = create(), specimen = s.equipment.find(item => item.id === 'specimen');
 const beaker = create(true).equipment.find(item => item.id === 'beaker');
 s.equipment.push(beaker);
 let d=densityDrop(s,specimen,{xM:-.3,yM:.08});assert.equal(d.parameters.targetId,'balance');set(s,'specimen',d.parameters);
 assert.equal(densityDrop(s,beaker,{xM:-.3,yM:.08}).parameters.targetId,'');assert.deepEqual(densityDrop(s,beaker,{xM:-.3,yM:.08}).pose,beaker.pose);assert.ok(densityDrop(s,beaker,{xM:-.3,yM:.08}).notice);assert.equal(densityDrop(s,specimen,{xM:.31,yM:.035}).parameters.targetId,'cylinder');assert.equal(densityDrop(s,s.equipment[3],{xM:-.02,yM:.08}).parameters.balanceId,'balance');
});
test('full immersion, eye level, overflow and floating specimens gate normal recording',()=>{
 const s=create();set(s,'specimen',{targetId:'cylinder',liftM:.06});assert.equal(buildDensityReading(s,registry,{phase:'immersed',raw:'60',group:'g',note:''},'v',time).code,'DENSITY_VOLUME');
 set(s,'specimen',{liftM:0});set(s,'cylinder',{eyeLevel:1});assert.equal(simulateDensity(s,registry).readableVolume,false);
 set(s,'cylinder',{eyeLevel:0,liquidM3:.00009});assert.equal(simulateDensity(s,registry).readableVolume,false);
 set(s,'specimen',{massKg:.01});assert.equal(simulateDensity(s,registry).code,'DENSITY_FLOATING');
});
test('mixed apparatus, invalid orientation, dangling references and random error are explicit failures',()=>{
 const mixed=create();mixed.equipment.push({id:'legacy',type:'mechanical.lever',definitionVersion:1,pose:{xM:0,yM:0,rotationRad:0},parameters:registry.get('mechanical.lever',1).defaultParameters});assert.equal(simulateDensity(mixed,registry).code,'DENSITY_MIXED');
 const s=create();s.equipment.push({...s.equipment[0],id:'duplicate'});assert.equal(simulateDensity(s,registry).code,'DENSITY_APPARATUS');s.equipment.pop();s.equipment[0].pose.rotationRad=.1;assert.equal(simulateDensity(s,registry).code,'DENSITY_ORIENTATION');s.equipment[0].pose.rotationRad=0;set(s,'specimen',{targetId:'missing'});assert.equal(simulateDensity(s,registry).code,'DENSITY_ATTACHMENT');set(s,'specimen',{targetId:''});s.simulationConfig.randomError.enabled=true;s.simulationConfig.randomError.distribution='uniform';assert.equal(simulateDensity(s,registry).code,'DENSITY_RANDOM');
});
test('solid three-stage result uses entered 53.8 g, not model 54 g',()=>{
 const s=solid('53.8'),r=result(s);assert.equal(r.ok,true,JSON.stringify(r));close(r.records[0].value,.0538);close(r.records[1].value,.00002);close(r.records[2].value,2690);close(r.records[2].context.physicalValue,2700);assert.deepEqual(r.snapshot.sourceSnapshotIds,['mass','initial','immersed']);
});
test('blank, malformed and infinite manual values never become zero or normal density',()=>{
 let s=create();const blank=reading(s,'initial','','blank');assert.equal(blank.records[0].value,null);assert.equal(blank.records[0].measurementStatus,'invalid');
 for(const raw of ['NaN','Infinity','1e999','0x10','1/2'])assert.equal(buildDensityReading(s,registry,{phase:'initial',raw,group:'g',note:''},'x',time).ok,false);
 assert.equal(buildDensityReading(s,registry,{phase:'initial',raw:'50',group:'g',note:''},'x',time,true).code,'DENSITY_PREVIEW');
});
test('liquid pour conserves mass and volume; 110 minus 80 g over 30 mL is 1000 kg/m3',()=>{
 const s=liquid(),r=result(s,['before.0','after.0','volume.0']);assert.equal(r.ok,true,JSON.stringify(r));close(r.records[0].value,.03);close(r.records[1].value,.00003);close(r.records[2].value,1000);close(simulateDensity(s,registry).beaker.parameters.liquidM3,.00005);
});
test('pour rejects negative, infinite, excessive, mixed liquid and specimen obstruction',()=>{
 const s=create(true),before=structuredClone(s);for(const v of [-1,0,Infinity,.00009])assert.equal(densityPour(s,registry,v).ok,false);assert.deepEqual(s,before);
 set(s,'cylinder',{liquidM3:.00001,liquidDensityKgPerM3:800});assert.equal(densityPour(s,registry,.00003).code,'DENSITY_MIX_LIQUIDS');
 set(s,'cylinder',{liquidDensityKgPerM3:1000});
 s.equipment.push(create().equipment.find(item => item.id === 'specimen'));
 set(s,'specimen',{targetId:'cylinder'});assert.equal(densityPour(s,registry,.00003).code,'DENSITY_POUR');
});
test('cross sample, changed water, wrong stage, duplicate and non-positive differences cannot derive density',()=>{
 let s=solid();assert.equal(buildDensityResult(s,registry,['mass.0','initial.0','immersed.0'],'第2组','mismatch',time).ok,false);assert.equal(result(s,['mass.0','initial.0','initial.0']).ok,false);assert.equal(result(s,['initial.0','mass.0','immersed.0']).ok,false);
 s.measurementSnapshots[1].equipment.find(x=>x.id==='specimen').parameters.sampleCode='B';assert.equal(result(s).ok,false);
 s=solid();s.measurementSnapshots[1].equipment.find(x=>x.id==='cylinder').parameters.liquidM3=.00004;assert.equal(result(s).ok,false);
 s=solid();const corrected=correctManualMeasurement(s,registry,'immersed.0','.00004',time);assert.equal(corrected.ok,true);assert.equal(result(corrected.document).code,'DENSITY_DIFFERENCE');
});
test('liquid result rejects pre-existing cylinder liquid or inconsistent transfer',()=>{
 const s=liquid();s.measurementSnapshots[0].equipment.find(x=>x.id==='cylinder').parameters.liquidM3=.00001;assert.equal(result(s,['before.0','after.0','volume.0']).code,'DENSITY_SOURCES');
});
test('display/edit/CSV/chart use g, mL and g/cm3 while JSON remains SI',()=>{
 let s=solid();s=append(s,result(s));const r=s.measurementRecords.at(-1);assert.equal(displayMeasurement(r).unit,'g/cm³');close(displayMeasurement(r).value,2.7);close(Number(measurementInputInSI(r,'2.8')),2800);assert.ok(measurementsCsv(s).includes('"g/cm³",2.7'));const series=measurementSeries(s,densityProfiles[0]);close(series[0].points[0].x,20);close(series[0].points[0].y,54);assert.equal(parseSceneJson(serializeScene(s,registry),registry).ok,true);
});
test('correcting source does not rewrite old result; explicit recalculation captures new source values',()=>{
 let s=solid();s=append(s,result(s));s=correctManualMeasurement(s,registry,'mass.0','.0538',time).document;close(s.measurementRecords.at(-1).value,2700);const r=result(s,undefined,'result2');assert.equal(r.ok,true);close(r.records[2].value,2690);assert.equal(JSON.parse(r.snapshot.note).refs[0].value,.0538);
});
test('source row deletion retains referenced snapshots, and removing all result rows collects them',()=>{
 let s=solid();s=append(s,result(s));for(const id of ['mass.0','initial.0','immersed.0']) {const r=removeMeasurement(s,registry,id,time);assert.equal(r.ok,true,JSON.stringify(r));s=r.document;}assert.equal(s.measurementSnapshots.length,4);assert.ok(measurementsCsv(s).includes('计算来源采样快照'));assert.ok(measurementsCsv(s).includes('density-reading'));assert.equal(parseSceneJson(serializeScene(s,registry),registry).ok,true);
 for(const id of ['result.0','result.1','result.2'])s=removeMeasurement(s,registry,id,time).document;assert.equal(s.measurementSnapshots.length,0);
});
test('additional solids and lower density liquid match independently calculated benchmarks',()=>{
 for(const [massKg,volumeM3,code,mask,grams,mL,rho] of [[.065,.000025,'B',50,65,75,2600],[.078,.00001,'C',358,78,60,7800]]) {
  let s=create();set(s,'balance',{zeroTrimKg:.0006});set(s,'masses',{mask});set(s,'specimen',{massKg,volumeM3,sampleCode:code,targetId:'balance'});s=append(s,reading(s,'mass',String(grams),'mass'));set(s,'specimen',{targetId:''});s=append(s,reading(s,'initial','50','initial'));set(s,'specimen',{targetId:'cylinder'});s=append(s,reading(s,'immersed',String(mL),'immersed'));const r=result(s);assert.equal(r.ok,true,JSON.stringify(r));close(r.records[2].value,rho);
 }
 let s=create(true);set(s,'balance',{zeroTrimKg:.0006});set(s,'beaker',{liquidDensityKgPerM3:800,liquidCode:'B',targetId:'balance'});set(s,'masses',{mask:206});s=append(s,reading(s,'liquid-before','94','before'));for(const u of densityPour(s,registry,.00003).updates)set(s,u.id,u.parameters);set(s,'masses',{mask:6});s=append(s,reading(s,'liquid-after','70','after'));s=append(s,reading(s,'liquid-volume','30','volume'));const r=result(s,['before.0','after.0','volume.0']);assert.equal(r.ok,true,JSON.stringify(r));close(r.records[2].value,800);
});
test('snapshot reference cycles, self references and missing sources are rejected on import',()=>{
 let s=solid();s=append(s,result(s));for(const refs of [['missing'],['result']]){const c=structuredClone(s);c.measurementSnapshots.at(-1).sourceSnapshotIds=refs;assert.equal(validateSceneDocument(c,registry).ok,false);}s.measurementSnapshots[0].sourceSnapshotIds=['result'];assert.equal(validateSceneDocument(s,registry).ok,false);
});
test('deleting parent detaches loads, undo restores associations and stored instrument settings',()=>{
 const s=create();set(s,'specimen',{targetId:'balance'});const shown=densityViewScene(s,null,simulateDensity(s,registry));const h=createHistory(s),r=executeCommand(h,{type:'remove-equipment-batch',ids:['balance'],updates:detachedDensityUpdates(s,['balance'],shown)},registry,time);assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.history.present.equipment.find(x=>x.id==='specimen').parameters.targetId,'');assert.equal(r.history.present.equipment.find(x=>x.id==='masses').parameters.balanceId,'');const undo=travelHistory(r.history,'undo',registry,time);assert.equal(undo.ok,true);assert.deepEqual(undo.history.present.equipment,s.equipment);
});
