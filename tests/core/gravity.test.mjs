import test from 'node:test';
import assert from 'node:assert/strict';
import { createGravityExperiment } from '../../src/experiments/gravity.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { SUPPORT, FORCE_METER, WEIGHT } from '../../src/equipment/mechanical/definitions.ts';
import { gravityAttachment, gravityDrop, gravityDetached, gravityViewScene, simulateGravity } from '../../src/equipment/gravity/simulate.ts';
import { buildGravityReading, gravityProfile, gravityRows } from '../../src/equipment/gravity/measure.ts';
import { appendMeasurements, correctManualMeasurement, removeMeasurement } from '../../src/core/measurements/records.ts';
import { measurementSeries } from '../../src/core/measurements/charts.ts';
import { measurementsCsv } from '../../src/core/measurements/csv.ts';
import { parseSceneJson, serializeScene } from '../../src/core/scene/transfer.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';

const registry = createWorkbenchRegistry(), time = '2026-11-18T00:00:00.000Z', create = () => createGravityExperiment('gravity.test', time), near = (a,b) => assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
function mount(scene,n){for(let i=0;i<n;i++){const item=scene.equipment.find(item=>item.id===`weight${i+1}`);item.parameters=gravityAttachment(scene,item,i?`weight${i}`:'meter');}return scene;}
function capture(scene,n,mass,force){const built=buildGravityReading(scene,registry,{mass,force,group:'第1组',note:'手工读数'},`sample${n}`,time);assert.equal(built.ok,true);const saved=appendMeasurements(scene,registry,built.records,built.snapshot,time);assert.equal(saved.ok,true);return saved.document;}

test('existing meter and five weights give independent 9.81 N/kg static loads and readable scale',()=>{
  const s=create();assert.deepEqual([...new Set(s.equipment.map(i=>i.type))],[SUPPORT,FORCE_METER,WEIGHT]);assert.equal(s.curriculumRef.textbookMappings[0].status,'pending_teacher_review');assert.equal(s.equipment.length,7);near(simulateGravity(s,registry).forceN,0);
  const expected=[.4905,.981,1.4715,1.962,2.4525];for(let n=1;n<=5;n++){mount(s,n);const out=simulateGravity(s,registry);assert.equal(out.ok,true);assert.equal(out.hung.length,n);near(out.massKg,n*.05);near(out.forceN,expected[n-1]);near(out.displayN,n*.5);}
  s.simulationConfig.gravityMPerS2=1.62;near(simulateGravity(s,registry).forceN,.405);s.equipment.find(i=>i.id==='meter').parameters.forceN=99;near(simulateGravity(s,registry).forceN,.405);
});
test('real hook geometry, tail occupancy, detach and support motion determine the visible chain',()=>{
  const s=create(),w=s.equipment.find(i=>i.id==='weight1'),meter=s.equipment.find(i=>i.id==='meter');const dropped=gravityDrop(s,w,{xM:-.08,yM:.515});assert.equal(dropped.parameters.forceMeterId,'meter');Object.assign(w,dropped);const v=gravityViewScene(s);near(v.equipment.find(i=>i.id===w.id).pose.yM,.515);
  assert.equal(gravityAttachment(s,s.equipment.find(i=>i.id==='weight2'),'meter'),null);mount(s,3);assert.equal(gravityAttachment(s,w,'weight3'),null);s.equipment.find(i=>i.id==='support').pose.xM+=.1;near(gravityViewScene(s).equipment.find(i=>i.id===meter.id).pose.xM,.02);
  const off=gravityDrop(s,w,{xM:.4,yM:.4});assert.equal(off.parameters.forceMeterId,'');Object.assign(w,off);assert.equal(simulateGravity(s,registry).hung.length,0);const changes=gravityDetached(s,['weight1']);assert.equal(changes[0].id,'weight2');assert.equal(changes[0].parameters.parentWeightId,'');assert.equal(gravityDetached(s,['meter']).length,0);
});
test('unmounted, duplicate, branching, cyclic, tilted and transitioning setups never produce normal readings',()=>{
  for(const mutate of [s=>s.equipment.find(i=>i.id==='meter').parameters.supportId='',s=>s.equipment.find(i=>i.id==='meter').parameters.directionDeg=0,s=>s.equipment.find(i=>i.id==='weight2').parameters.forceMeterId='meter',s=>s.equipment.find(i=>i.id==='weight1').parameters.parentWeightId='weight2',s=>s.equipment.find(i=>i.id==='weight1').pose.rotationRad=.1,s=>s.simulationConfig.randomError.enabled=true,s=>s.connections.push({id:'bad'})]){const s=mount(create(),1);mutate(s);assert.equal(simulateGravity(s,registry).ok,false);assert.equal(buildGravityReading(s,registry,{mass:'.05',force:'.5',group:'a',note:''},'r',time).ok,false);}
  assert.equal(buildGravityReading(create(),registry,{mass:'0',force:'0',group:'a',note:''},'r',time).code,'GRAVITY_UNLOADED');assert.equal(simulateGravity(mount(create(),1),registry,true).code,'GRAVITY_PREVIEW');
});
test('range, support capacity, dense divisions and table contact are independent invalid boundaries',()=>{
  const s=mount(create(),1),m=s.equipment.find(i=>i.id==='meter');m.parameters.rangeN=.4;assert.equal(simulateGravity(s,registry).code,'GRAVITY_OVER_RANGE');m.parameters.rangeN=.4905;assert.equal(simulateGravity(s,registry).ok,true);m.parameters.rangeN=5;m.parameters.resolutionN=.001;assert.equal(simulateGravity(s,registry).code,'GRAVITY_SCALE');m.parameters.resolutionN=.1;s.equipment.find(i=>i.id==='support').parameters.heightM=.2;assert.equal(simulateGravity(s,registry).code,'GRAVITY_CONTACT');
  const heavy=mount(create(),1);heavy.equipment.find(i=>i.id==='weight1').parameters.massKg=.2;heavy.equipment.find(i=>i.id==='support').parameters.capacityN=1;assert.equal(simulateGravity(heavy,registry).code,'GRAVITY_OVER_RANGE');
});
test('five manually recorded pairs plot student values, ratio and SI CSV, with gravity changes separated',()=>{
  let s=create();for(let n=1;n<=5;n++){mount(s,n);s=capture(s,n,String(n*.05),String(n*.5));}const series=measurementSeries(s,gravityProfile);assert.equal(series.length,1);assert.equal(series[0].points.length,5);assert.deepEqual(series[0].points.map(p=>p.y),[.5,1,1.5,2,2.5]);near(gravityRows(s)[0].ratio,10);near(s.measurementRecords[1].context.physicalValue,.4905);assert.notEqual(s.measurementRecords[1].value,s.measurementRecords[1].context.physicalValue);
  s.simulationConfig.gravityMPerS2=10;s=capture(s,6,'.25','2.6');assert.equal(measurementSeries(s,gravityProfile).length,2);const csv=measurementsCsv(s);assert.ok(csv.includes('"kg",0.05'));assert.ok(csv.includes('"N",0.5'));assert.ok(!/NaN|Infinity/.test(csv));assert.deepEqual(parseSceneJson(serializeScene(s,registry),registry).document,s);
});
test('missing and out-of-range readings stay unusable; edits move graph and ratio without rewriting snapshots',()=>{
  let s=capture(mount(create(),1),1,'.05','.6');const snapshot=structuredClone(s.measurementSnapshots[0]);s=correctManualMeasurement(s,registry,'sample1.1','.7',time).document;near(gravityRows(s)[0].ratio,14);near(measurementSeries(s,gravityProfile)[0].points[0].y,.7);assert.deepEqual(s.measurementSnapshots[0],snapshot);s=removeMeasurement(s,registry,'sample1.1',time).document;assert.equal(gravityRows(s)[0].force,null);assert.equal(measurementSeries(s,gravityProfile).length,0);
  for(const [mass,force]of [['',''],['0','.5'],['.05','6'],['.05','-.1']]){const row=capture(mount(create(),1),2,mass,force);assert.ok(measurementSeries(row,gravityProfile).every(group=>group.points.every(p=>p.y===null)));}assert.equal(buildGravityReading(mount(create(),1),registry,{mass:'abc',force:'.5',group:'a',note:''},'bad',time).ok,false);
});
test('optional weight mount round trips, and detaching removal is one reversible command',()=>{
  const measured=capture(mount(create(),1),1,'.05','.5'),protectedRemoval=executeCommand(createHistory(measured),{type:'remove-equipment-batch',ids:['meter'],updates:gravityDetached(measured,['meter'])},registry,time);assert.equal(protectedRemoval.ok,false);assert.equal(protectedRemoval.diagnostics[0].code,'EQUIPMENT_HAS_MEASUREMENTS');const s=mount(create(),2),history=createHistory(s),updates=gravityDetached(s,['meter']);const removed=executeCommand(history,{type:'remove-equipment-batch',ids:['meter'],updates},registry,time);assert.equal(removed.ok,true);assert.equal(removed.history.present.equipment.find(i=>i.id==='weight1').parameters.forceMeterId,'');const undone=travelHistory(removed.history,'undo',registry,time);assert.equal(simulateGravity(undone.history.present,registry).hung.length,2);assert.deepEqual(parseSceneJson(serializeScene(undone.history.present,registry),registry).document,undone.history.present);
});
