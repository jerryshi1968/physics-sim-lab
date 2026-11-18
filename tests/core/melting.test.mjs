import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeltingExperiment } from '../../src/experiments/melting.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { serializeScene,parseSceneJson } from '../../src/core/scene/transfer.ts';
import { equipmentSupport,equipmentAvailability } from '../../src/equipment/support.ts';
import { advanceMelting,meltingInitial,meltingRig,meltingReading,meltingCoupled,meltingPhase,meltingEnergy } from '../../src/equipment/melting/simulate.ts';
import { buildMeltingMeasurements,meltingRows } from '../../src/equipment/melting/measure.ts';
import { appendMeasurements,correctManualMeasurement,removeMeasurement } from '../../src/core/measurements/records.ts';
import { displayMeasurement,measurementInputInSI } from '../../src/core/measurements/display.ts';
import { measurementsCsv } from '../../src/core/measurements/csv.ts';
const time='2026-11-13T00:00:00.000Z',registry=createWorkbenchRegistry(),make=()=>createMeltingExperiment('melting.test',time);
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`),config=()=>meltingRig(make()).config;
test('melting preset reuses five apparatus and adds only sample tube; blank, review and import round trip',()=>{
  const scene=make();assert.equal(scene.equipment.length,6);assert.equal(validateSceneDocument(scene,registry).ok,true);assert.equal(equipmentSupport(scene).key,'melting');assert.equal(scene.curriculumRef.textbookMappings[0].status,'pending_teacher_review');
  assert.deepEqual(parseSceneJson(serializeScene(scene,registry),registry).document,scene);assert.equal(createMeltingExperiment('blank',time,true).equipment.length,0);assert.equal(equipmentAvailability(scene,'thermal.melting-tube').enabled,false);assert.equal(equipmentAvailability(scene,'electrical.power-source').enabled,false);
});
test('independent hypo enthalpy benchmarks: 46 J/K solid, 4000 J latent, 54 J/K liquid',()=>{
  const c=config();near(meltingEnergy(c,321.15),2208);near(meltingPhase(c,4208).temperatureK,321.15);near(meltingPhase(c,4208).fraction,.5);near(meltingPhase(c,6748).temperatureK,331.15);near(meltingPhase(c,6748).fraction,1);
});
test('distributed wax melt interval: 2160 J onset, 4135 J midpoint, 6110 J completion',()=>{
  const c={...config(),material:'wax'};near(meltingEnergy(c,318.15),2160);near(meltingPhase(c,4135).temperatureK,325.65);near(meltingPhase(c,4135).fraction,.5);near(meltingEnergy(c,333.15),6110);assert.ok(meltingPhase(c,4500).temperatureK>meltingPhase(c,4000).temperatureK);
});
test('water to sample exchange conserves 3.2 J in a single isolated 0.1 s step',()=>{
  const c=config();c.bath={...c.bath,initialTemperatureK:333.15,lossWPerK:0,powerW:0};const initial=meltingInitial(c),next=advanceMelting(initial,c,false,true,.1);
  near(next.sampleJ-initial.sampleJ,3.2);near((initial.bathK-next.bathK)*(c.bath.initialMassKg*4200+c.bath.vesselCapacityJPerK),3.2);near(next.waterKg,initial.waterKg);
});
test('removing tube from bath stops heating its sample; heater-off permits cooling',()=>{
  const c=config();c.bath={...c.bath,initialTemperatureK:333.15};const s=meltingInitial(c);near(advanceMelting(s,c,true,false,60).sampleJ,s.sampleJ);
  const hot={...s,sampleJ:meltingEnergy(c,343.15),bathK:343.15};assert.ok(advanceMelting(hot,c,false,true,60).sampleJ<hot.sampleJ);
});
test('default minute samples cross solid, latent platform and liquid; wax rises through melt',()=>{
  for(const material of ['hypo','wax']){const c={...config(),material};let s=meltingInitial(c),last=0,plateau=0;for(let n=0;n<25;n++){s=advanceMelting(s,c,true,true,60);const p=meltingPhase(c,s.sampleJ);assert.ok(p.temperatureK>=last);last=p.temperatureK;if(p.fraction>0&&p.fraction<1){if(material==='hypo'){near(p.temperatureK,321.15);plateau++;}else assert.ok(p.temperatureK>318.15&&p.temperatureK<333.15);}}assert.equal(meltingPhase(c,s.sampleJ).fraction,1);if(material==='hypo')assert.ok(plateau>=2);}
});
test('fixed-step carry agrees at 30/60 fps and minute stepping',()=>{
  const c=config(),expected=advanceMelting(meltingInitial(c),c,true,true,300);for(const fps of [30,60]){let s=meltingInitial(c);for(let n=0;n<300*fps;n++)s=advanceMelting(s,c,true,true,1/fps);near(s.timeS,300);near(s.sampleJ,expected.sampleJ);near(s.bathK,expected.bathK);}
});
test('invalid masses, temperatures, state, duplicate and rotated tube fail closed',()=>{
  const c=config();for(const changes of [{sampleMassKg:0},{sampleMassKg:.1},{sampleInitialK:350},{transferWPerK:Infinity},{material:'unknown'}])assert.throws(()=>advanceMelting(meltingInitial(c),{...c,...changes},true,true,1));assert.throws(()=>advanceMelting({...meltingInitial(c),timeS:7201},c,true,true,1));
  const scene=make();scene.equipment.push({...scene.equipment.at(-1),id:'duplicate'});assert.equal(meltingRig(scene).ok,false);scene.equipment.pop();scene.equipment.at(-1).pose.rotationRad=.1;assert.equal(meltingRig(scene).ok,false);
});
test('probe must be inside sample, not water; submerged tube section and clear mouth required',()=>{
  const scene=make(),rig=meltingRig(scene),state=meltingInitial(rig.config);assert.equal(rig.ok,true);assert.equal(meltingCoupled(rig,state),true);assert.equal(meltingReading(rig,state).ok,true);
  scene.equipment.find(i=>i.id==='thermometer').pose.xM=-.02;assert.equal(meltingReading(meltingRig(scene),state).ok,false);scene.equipment.at(-1).pose.yM=.2;assert.equal(meltingCoupled(meltingRig(scene),state),false);
});
function sample(source='instrument',timeRaw='1.5',temperatureRaw='48'){
  const scene=make(),rig=meltingRig(scene),state=advanceMelting(meltingInitial(rig.config),rig.config,true,true,420),result=buildMeltingMeasurements(scene,state,rig.signature,'run1',360,true,{source,timeRaw,temperatureRaw,setupLabel:'熔化1',note:'固液共存'},'sample1',time);assert.equal(result.ok,true,result.message);const appended=appendMeasurements(scene,registry,result.records,result.snapshot,time);assert.equal(appended.ok,true,JSON.stringify(appended.diagnostics));return{scene:appended.document,result,state};
}
test('zeroed recording clock stores seconds, displays minutes and freezes source material and state',()=>{
  const {scene,result,state}=sample();near(result.records[0].value,60);near(displayMeasurement(result.records[0]).value,1);near(JSON.parse(result.snapshot.note).elapsedS,state.timeS);assert.equal(meltingRows(scene)[0].materialLabel,'海波');scene.equipment.at(-1).parameters.material='wax';assert.equal(meltingRows(scene)[0].materialLabel,'海波');assert.match(measurementsCsv(scene),/min/);assert.match(measurementsCsv(scene),/℃/);assert.deepEqual(parseSceneJson(serializeScene(scene,registry),registry).document,scene);
});
test('manual min/℃ corrections update charts in SI, preserve original text; blanks remain missing',()=>{
  const missing=sample('manual','','').scene;assert.equal(meltingRows(missing)[0].timeMin,null);assert.equal(meltingRows(missing)[0].temperatureC,null);
  const {scene}=sample('manual');near(scene.measurementRecords[0].value,90);const r=scene.measurementRecords[0],raw=measurementInputInSI(r,'2');near(Number(raw),120);const corrected=correctManualMeasurement(scene,registry,r.id,raw,time);assert.equal(corrected.ok,true);near(meltingRows(corrected.document)[0].timeMin,2);assert.equal(corrected.document.measurementRecords[0].context.originalRawInput,'1.5');const removed=removeMeasurement(corrected.document,registry,r.id,time);assert.equal(meltingRows(removed.document)[0].timeMin,null);
});
test('stale rig, missing timer, exposed probe and invalid clock origin cannot capture',()=>{
  const scene=make(),rig=meltingRig(scene),s=meltingInitial(rig.config),input={source:'instrument',timeRaw:'',temperatureRaw:'',setupLabel:'1',note:''};for(const [sig,origin]of [['stale',0],[rig.signature,1],[rig.signature,NaN]])assert.equal(buildMeltingMeasurements(scene,s,sig,'r',origin,true,input,'bad',time).ok,false);scene.equipment=scene.equipment.filter(i=>i.id!=='timer');assert.equal(buildMeltingMeasurements(scene,s,rig.signature,'r',0,true,input,'bad',time).ok,false);
});
