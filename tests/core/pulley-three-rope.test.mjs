import test from 'node:test';
import assert from 'node:assert/strict';
import {createPulleyEfficiencyExperiment} from '../../src/experiments/pulley-efficiency.ts';
import {createPulleyExperiment} from '../../src/experiments/pulley.ts';
import {createWorkbenchRegistry} from '../../src/equipment/registry.ts';
import {EFFICIENCY_MODEL,EFFICIENCY_LEGACY_MODEL,pulleyWheelScale} from '../../src/equipment/pulley/definitions.ts';
import {simulatePulley,pulleySpin,pulleyRadius,pulleyDrop,pulleyPreviewScene,pulleyDetached} from '../../src/equipment/pulley/simulate.ts';
import {buildEfficiencyReading,efficiencyRows,efficiencyCsv} from '../../src/equipment/pulley/efficiency.ts';
import {appendMeasurements,correctManualMeasurement} from '../../src/core/measurements/records.ts';
import {createHistory,executeCommand,travelHistory} from '../../src/core/workbench/history.ts';
import {serializeScene,parseSceneJson} from '../../src/core/scene/transfer.ts';
const registry=createWorkbenchRegistry(),time='2026-11-23T08:00:00.000Z',item=(s,id)=>s.equipment.find(i=>i.id===id),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`),create=(end='moving',u=0)=>{const s=createPulleyEfficiencyExperiment('three-rope',time);Object.assign(item(s,'pulley').parameters,{ropeEnd:end,pullM:u});return s;},out=s=>{const o=simulatePulley(s,registry);assert.equal(o.ok,true,o.code);return o;};
const input={group:'三段承重',gravity:'.981',force:'.4905',loadStart:'21.5',loadEnd:'26.5',pullStart:'55',pullEnd:'70',loadRuler:'load-ruler',pullRuler:'pull-ruler',direction:'向上',note:'先绕定轮再绕动轮'};
test('anchoring on the moving hook gives three supporting strands with independently calculated force, lift, work and efficiency',()=>{
 const s=create('moving',.15),o=out(s),l=o.layout;assert.equal(l.n,3);assert.equal(l.sign,1);near(o.forceN,.4905);near(l.loadPoint.yM-l.loadStart.yM,.05);near(l.meterPoint.yM-l.meterStart.yM,.15);near(o.weightN*.05,.04905);near(o.forceN*.15,.073575);near((o.weightN*.05)/(o.forceN*.15),2/3);item(s,'load').parameters.massKg=.15;near(out(s).forceN,.8175);item(s,'pulley').parameters.massKg=0;near(out(s).forceN,.654);
 const two=out(create('stand',.1));near(two.forceN,.73575);near(two.layout.loadPoint.yM-two.layout.loadStart.yM,.05);near(two.layout.meterPoint.yM-two.layout.meterStart.yM,-.1);
});
test('three rendered straight rope segments remain vertical and their full length including both arcs is constant',()=>{
 const lengths=[];for(const u of [0,.03,.09,.15,.2]){const l=out(create('moving',u)).layout;near(l.ropeAnchor.xM,l.center.xM);near(l.ropeAnchor.yM-l.center.yM,.069);near(l.fixedCenter.xM+l.fixedRadius,l.ropeAnchor.xM);near(l.fixedCenter.xM-l.fixedRadius,l.center.xM-pulleyRadius);near(l.meterPoint.xM,l.center.xM+pulleyRadius);lengths.push(l.fixedCenter.yM-l.ropeAnchor.yM+l.fixedCenter.yM-l.center.yM+l.meterPoint.yM-.205-l.center.yM+Math.PI*(l.fixedRadius+pulleyRadius));}
 for(const v of lengths)near(v,.566+Math.PI*.06);
});
test('both wheels obey no-slip velocities at every contact, including the moving rope anchor',()=>{
 const l=out(create()).layout,rate=pulleySpin('tackle',.15,'moving')/.15,fixedRate=pulleySpin('fixed',.15,'moving')/.15,v=1/3;
 near(v+pulleyRadius*rate,-v);near(v-pulleyRadius*rate,1);near(-l.fixedRadius*fixedRate,v);near(l.fixedRadius*fixedRate,-v);near(pulleyWheelScale(item(out(create()).view,'fixed-pulley')),.5);near(pulleyWheelScale(item(out(create('stand')).view,'fixed-pulley')),1);near(pulleySpin('direct',.15,'moving'),0);
});
test('the stand supports only the fixed wheel reaction for the moving-end route and invalid old or incomplete assemblies do not read',()=>{
 const s=create();item(s,'support').parameters.capacityN=1.5;assert.equal(out(s).ok,true);item(s,'pulley').parameters.ropeEnd='stand';assert.equal(simulatePulley(s,registry).code,'PULLEY_OVER_RANGE');
 for(const change of [s=>item(s,'pulley').parameters.ropeEnd='invalid',s=>item(s,'pulley').parameters.fixedPulleyId='',s=>item(s,'meter').parameters.rangeN=.1,s=>item(s,'pull-ruler').parameters.lengthM=.1]){const bad=create('moving',.15);change(bad);assert.equal(buildEfficiencyReading(bad,registry,input,'bad',time).ok,false);}
 const old=createPulleyExperiment('old',time);item(old,'pulley').parameters.ropeEnd='moving';assert.equal(simulatePulley(old,registry).ok,false);
});
test('an upward meter preview lifts the load one third, cancels cleanly and commits one undoable command',()=>{
 const s=create(),before=structuredClone(s),l=out(s).layout,point={xM:l.meterPoint.xM,yM:l.meterPoint.yM+.15},preview=pulleyPreviewScene(s,{id:'meter',point});near(out(preview).layout.u,.15);near(out(preview).layout.loadPoint.yM-l.loadPoint.yM,.05);assert.deepEqual(s,before);const changed=executeCommand(createHistory(s),{type:'update-equipment-batch',updates:pulleyDrop(s,item(s,'meter'),point).updates},registry,time);assert.equal(changed.ok,true);near(out(changed.history.present).layout.u,.15);const restored=travelHistory(changed.history,'undo',registry,time).history.present;assert.deepEqual({...restored,revision:s.revision},s);
});
test('new snapshots retain anchoring and direction across switching, corrections, CSV and save; legacy two-strand rows are unchanged',()=>{
 let s=create('moving',.15);const built=buildEfficiencyReading(s,registry,input,'three',time);assert.equal(built.ok,true,built.message);assert.equal(built.snapshot.modelVersion,EFFICIENCY_MODEL);assert.deepEqual([JSON.parse(built.snapshot.note).ropeEnd,JSON.parse(built.snapshot.note).strands,JSON.parse(built.snapshot.note).direction],['moving',3,'向上']);s=appendMeasurements(s,registry,built.records,built.snapshot,time).document;const frozen=structuredClone(s.measurementSnapshots);near(efficiencyRows(s)[0].efficiency,2/3);item(s,'pulley').parameters.ropeEnd='stand';assert.equal(efficiencyRows(s)[0].strands,3);s=correctManualMeasurement(s,registry,'three.force','.5',time).document;near(efficiencyRows(s)[0].efficiency,.654);assert.deepEqual(s.measurementSnapshots,frozen);assert.match(efficiencyCsv(s),/动滑轮挂钩/);assert.match(efficiencyCsv(s),/向上/);assert.deepEqual(parseSceneJson(serializeScene(s,registry),registry).document,s);
 const two=create('stand',.1),b=buildEfficiencyReading(two,registry,{...input,force:'.73575',pullStart:'48',pullEnd:'38'},'old',time);assert.equal(b.ok,true);const meta=JSON.parse(b.snapshot.note);delete meta.ropeEnd;delete meta.strands;b.snapshot.note=JSON.stringify(meta);b.snapshot.modelVersion=EFFICIENCY_LEGACY_MODEL;const legacy=appendMeasurements(two,registry,b.records,b.snapshot,time).document;assert.equal(efficiencyRows(legacy)[0].strands,2);assert.equal(efficiencyRows(legacy)[0].ropeEnd,'支架');near(efficiencyRows(legacy)[0].efficiency,2/3);
});
test('deleting a fixed wheel preserves the configured rope end, refuses readings, and undo recovers the three-strand geometry',()=>{
 const s=create('moving',.15),removed=executeCommand(createHistory(s),{type:'remove-equipment-batch',ids:['fixed-pulley'],updates:pulleyDetached(s,['fixed-pulley'])},registry,time);assert.equal(removed.ok,true);assert.equal(item(removed.history.present,'pulley').parameters.ropeEnd,'moving');assert.equal(simulatePulley(removed.history.present,registry).ok,false);const restored=travelHistory(removed.history,'undo',registry,time).history.present;near(out(restored).forceN,.4905);near(out(restored).layout.u,.15);
});
