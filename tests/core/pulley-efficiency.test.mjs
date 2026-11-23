import test from 'node:test';
import assert from 'node:assert/strict';
import {createPulleyEfficiencyExperiment} from '../../src/experiments/pulley-efficiency.ts';
import {createPulleyExperiment} from '../../src/experiments/pulley.ts';
import {createWorkbenchRegistry} from '../../src/equipment/registry.ts';
import {PULLEY,EFFICIENCY_MODEL} from '../../src/equipment/pulley/definitions.ts';
import {simulatePulley,pulleyDrop,pulleyPreviewScene,pulleyDetached,activePulley,pulleySpin,pulleyRadius} from '../../src/equipment/pulley/simulate.ts';
import {buildEfficiencyReading,efficiencyRows,efficiencyCsv} from '../../src/equipment/pulley/efficiency.ts';
import {appendMeasurements,correctManualMeasurement,removeMeasurement} from '../../src/core/measurements/records.ts';
import {createHistory,executeCommand,travelHistory} from '../../src/core/workbench/history.ts';
import {serializeScene,parseSceneJson} from '../../src/core/scene/transfer.ts';
import {measurementsCsv} from '../../src/core/measurements/csv.ts';
import {equipmentAvailability} from '../../src/equipment/support.ts';
const registry=createWorkbenchRegistry(),time='2026-11-23T00:00:00.000Z',create=()=>createPulleyEfficiencyExperiment('efficiency.test',time),item=(s,id)=>s.equipment.find(i=>i.id===id),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`),out=s=>{const o=simulatePulley(s,registry);assert.equal(o.ok,true,o.code);return o;};
const input={group:'第1次',gravity:'.981',force:'.73575',loadStart:'21.5',loadEnd:'31.5',pullStart:'48',pullEnd:'28',loadRuler:'load-ruler',pullRuler:'pull-ruler',direction:'向下',note:'保持缓慢提拉'};
function measured(overrides={}){const s=create();item(s,'pulley').parameters.pullM=.2;const b=buildEfficiencyReading(s,registry,{...input,...overrides},'trial',time);assert.equal(b.ok,true,b.message);const saved=appendMeasurements(s,registry,b.records,b.snapshot,time);assert.equal(saved.ok,true);return saved.document;}
test('efficiency uses two existing pulleys and four reused types, with separate old limits and pending-review round trip',()=>{
 const s=create();assert.equal(s.equipment.length,8);assert.equal(new Set(s.equipment.map(i=>i.type)).size,5);assert.equal(s.equipment.filter(i=>i.type===PULLEY).length,2);assert.equal(s.curriculumRef.textbookMappings[0].status,'pending_teacher_review');assert.deepEqual(parseSceneJson(serializeScene(s,registry),registry).document,s);assert.equal(equipmentAvailability(s,PULLEY).enabled,false);assert.equal(equipmentAvailability(s,'mechanical.density-balance').enabled,false);assert.equal(equipmentAvailability(createPulleyExperiment('old',time),PULLEY).enabled,false);assert.equal(registry.get(PULLEY,1).defaultParameters.massKg,0);assert.equal(registry.get(PULLEY,1).defaultParameters.fixedPulleyId,undefined);near(out(s).forceN,.73575);
});
test('independent hand values conserve useful plus pulley lifting work and show load-dependent efficiency',()=>{
 const s=create();item(s,'pulley').parameters.pullM=.2;
 for(const [mass,force,useful,total,eta]of [[.1,.73575,.0981,.14715,2/3],[.2,1.22625,.1962,.24525,.8],[.3,1.71675,.2943,.34335,6/7]]){item(s,'load').parameters.massKg=mass-.05;const o=out(s),h=o.layout.loadPoint.yM-o.layout.loadStart.yM;near(o.forceN,force);near(h,.1);near(o.weightN*h,useful);near(o.forceN*.2,total);near(total-useful,.04905);near(useful/total,eta);}
 item(s,'fixed-pulley').parameters.massKg=.2;near(out(s).forceN,1.71675);item(s,'pulley').parameters.massKg=0;near(out(s).forceN,1.4715);near(out(s).weightN*.1/(out(s).forceN*.2),1);
});
test('two real wheel axes and the full rope remain constrained for the descending free end',()=>{
 const s=create(),lengths=[];for(const u of [0,.05,.1,.2]){item(s,'pulley').parameters.pullM=u;const o=out(s),l=o.layout;near(l.loadPoint.yM-l.loadStart.yM,u/2);near(l.meterPoint.yM-l.meterStart.yM,-u);near(l.center.yM,.32+u/2);near(l.fixedCenter.yM,.61);near(item(o.view,'fixed-pulley').pose.xM,.09);lengths.push((l.anchor.yM-l.center.yM)+(l.fixedCenter.yM-l.center.yM)+(l.fixedCenter.yM-l.meterPoint.yM)+2*Math.PI*pulleyRadius);near(pulleyRadius*pulleySpin('fixed',u),u);near(pulleyRadius*pulleySpin('tackle',u),-u/2);}
 for(const l of lengths)near(l,lengths[0]);s.equipment.reverse();assert.equal(activePulley(s).id,'pulley');near(out(s).forceN,.73575);
});
test('direct weighing excludes pulley mass, captures G only and cannot be mistaken for an efficiency trial',()=>{
 const s=create();item(s,'pulley').parameters.mode='direct';near(out(s).forceN,.981);const b=buildEfficiencyReading(s,registry,{...input,force:'',loadStart:'',loadEnd:'',pullStart:'',pullEnd:''},'weight',time);assert.equal(b.ok,true);assert.equal(b.records.length,1);assert.equal(b.snapshot.modelVersion,EFFICIENCY_MODEL);assert.equal(JSON.parse(b.snapshot.note).direction,'向上');const saved=appendMeasurements(s,registry,b.records,b.snapshot,time).document,r=efficiencyRows(saved)[0];assert.equal(r.mode,'直接称重');assert.equal(r.efficiency,null);assert.equal(r.total,null);assert.equal(r.gravity,.981);
});
test('dragging previews the actual tackle, cancellation keeps the source and one undo restores the pull',()=>{
 const s=create(),before=structuredClone(s),l=out(s).layout,point={xM:l.meterPoint.xM,yM:l.meterPoint.yM-.2},preview=pulleyPreviewScene(s,{id:'meter',point});near(out(preview).layout.u,.2);near(out(preview).layout.loadPoint.yM-l.loadPoint.yM,.1);assert.deepEqual(s,before);const drop=pulleyDrop(s,item(s,'meter'),point),changed=executeCommand(createHistory(s),{type:'update-equipment-batch',updates:drop.updates},registry,time);assert.equal(changed.ok,true);near(out(changed.history.present).layout.u,.2);const restored=travelHistory(changed.history,'undo',registry,time).history.present;assert.deepEqual({...restored,revision:s.revision},s);
});
test('missing fixed wheel, wrong assemblies, contact and overload reject normal readings and records',()=>{
 for(const change of [s=>s.equipment.splice(s.equipment.findIndex(i=>i.id==='fixed-pulley'),1),s=>item(s,'pulley').parameters.fixedPulleyId='pulley',s=>item(s,'pulley').parameters.mode='movable',s=>item(s,'fixed-pulley').parameters.mode='tackle',s=>item(s,'meter').parameters.rangeN=.1,s=>item(s,'support').parameters.capacityN=1,s=>item(s,'support').parameters.heightM=.6,s=>item(s,'load').parameters.parentWeightId='load2',s=>s.simulationConfig.randomError.enabled=true]){const s=create();change(s);const o=simulatePulley(s,registry);assert.equal(o.ok,false);assert.equal(o.displayN,null);assert.equal(buildEfficiencyReading(s,registry,input,'invalid',time).ok,false);}
 assert.equal(buildEfficiencyReading(create(),registry,input,'preview',time,true).ok,false);const direct=create();item(direct,'pulley').parameters.mode='direct';item(direct,'support').parameters.capacityN=1;item(direct,'fixed-pulley').parameters.massKg=.2;assert.equal(simulatePulley(direct,registry).code,'PULLEY_OVER_RANGE');
});
test('manual values alone drive work and efficiency; correction recomputes without changing frozen provenance',()=>{
 let s=measured(),r=efficiencyRows(s)[0];near(r.height,.1);near(r.distance,.2);near(r.useful,.0981);near(r.total,.14715);near(r.efficiency,2/3);const snapshots=structuredClone(s.measurementSnapshots);s=correctManualMeasurement(s,registry,'trial.force','.8',time).document;r=efficiencyRows(s)[0];near(r.total,.16);near(r.efficiency,.613125);assert.deepEqual(s.measurementSnapshots,snapshots);item(s,'pulley').parameters.massKg=.1;near(efficiencyRows(s)[0].efficiency,.613125);assert.equal(efficiencyRows(s)[0].pulleyMass,.05);
 s=removeMeasurement(s,registry,'trial.force',time).document;assert.equal(efficiencyRows(s)[0].total,null);assert.equal(efficiencyRows(s)[0].efficiency,null);
});
test('missing and zero denominators stay blank, anomalous efficiency remains explicit and malformed sources are ignored',()=>{
 assert.equal(efficiencyRows(measured({force:''}))[0].efficiency,null);const zero=efficiencyRows(measured({pullEnd:'48'}))[0];assert.equal(zero.total,0);assert.equal(zero.efficiency,null);assert.match(zero.warning,/零/);const excessive=efficiencyRows(measured({force:'.1'}))[0];near(excessive.efficiency,4.905);assert.match(excessive.warning,/100%/);assert.equal(efficiencyRows(measured({loadEnd:'10'}))[0].height,null);const broken=measured();broken.measurementSnapshots[0].note='{"kind":"efficiency","mode":"tackle","massKg":"bad","pulleyMassKg":0.05}';assert.deepEqual(efficiencyRows(broken),[]);
});
test('CSV carries calculated joules, SI metres, escaped text and source identifiers; JSON preserves raw records and snapshots',()=>{
 const s=measured({group:'=SUM(1)',note:'观察,"重复"'}),csv=efficiencyCsv(s);assert.match(csv,/有用功\/J/);assert.match(csv,/0.0981/);assert.match(csv,/0.147/);assert.match(csv,/\t=SUM/);assert.match(csv,/观察,""重复""/);assert.match(csv,/trial/);assert.ok(measurementsCsv(s).includes('"cm",31.5'));assert.deepEqual(parseSceneJson(serializeScene(s,registry),registry).document,s);
});
test('removing the fixed wheel clears its reference and undo restores the real two-wheel assembly',()=>{
 const s=create(),updates=pulleyDetached(s,['fixed-pulley']),removed=executeCommand(createHistory(s),{type:'remove-equipment-batch',ids:['fixed-pulley'],updates},registry,time);assert.equal(removed.ok,true);assert.equal(item(removed.history.present,'pulley').parameters.fixedPulleyId,'');assert.equal(simulatePulley(removed.history.present,registry).ok,false);near(out(travelHistory(removed.history,'undo',registry,time).history.present).forceN,.73575);
});
