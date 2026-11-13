import test from 'node:test';
import assert from 'node:assert/strict';
import { createAverageSpeedExperiment } from '../../src/experiments/average-speed.ts';
import { averageSpeedRig, averageTrackUpdates, alongTrack, trackPoint, averageSpeedDrop, advanceAverageSpeed, averageSpeedView, averageSpeedRuler } from '../../src/equipment/averageSpeed/simulate.ts';
import { buildAverageSpeedMeasurements, averageSpeedResults } from '../../src/equipment/averageSpeed/measure.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { equipmentAvailability, equipmentSupport } from '../../src/equipment/support.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { serializeScene, parseSceneJson } from '../../src/core/scene/transfer.ts';
import { appendMeasurements, correctManualMeasurement, removeMeasurement } from '../../src/core/measurements/records.ts';
import { displayMeasurement, measurementInputInSI } from '../../src/core/measurements/display.ts';
import { measurementsCsv } from '../../src/core/measurements/csv.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';
const time='2026-11-13T00:00:00.000Z',registry=createWorkbenchRegistry();
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
function setup(){const scene=createAverageSpeedExperiment('average.test',time),track=scene.equipment.find(i=>i.id==='track');scene.simulationConfig.gravityMPerS2=10;const updates=averageTrackUpdates(scene,track,{...track.pose,rotationRad:Math.asin(.1)},track.parameters);scene.equipment=scene.equipment.map(i=>({...i,...updates.find(u=>u.id===i.id)}));return scene;}
function trial(scene){const rig=averageSpeedRig(scene);assert.equal(rig.ok,true,rig.message);return advanceAverageSpeed({id:'trial-1',signature:rig.signature,rig,timeS:0},100);}
test('starter and blank reuse five existing types, add only a metal stop, keep pending mappings and independent JSON',()=>{
 const scene=setup();assert.equal(scene.equipment.length,6);assert.equal(validateSceneDocument(scene,registry).ok,true);assert.equal(equipmentSupport(scene).key,'averageSpeed');assert.equal(scene.curriculumRef.textbookMappings[0].status,'pending_teacher_review');
 assert.equal(createAverageSpeedExperiment('blank',time,true).equipment.length,0);assert.deepEqual(parseSceneJson(serializeScene(scene,registry),registry).document,scene);
 assert.equal(equipmentAvailability(scene,'mechanical.cart-photogate').enabled,false);assert.equal(equipmentAvailability(scene,'mechanical.metal-stop').enabled,false);
});
test('independent benchmark g=10, sinθ=.1: full 1 m takes sqrt(2) s; upper .5 m takes 1 s',()=>{
 const scene=setup(),full=trial(scene);near(full.rig.acceleration,1);near(full.rig.distanceM,1);near(full.timeS,Math.sqrt(2));
 const stop=scene.equipment.find(i=>i.id==='stop');stop.pose={...stop.pose,...trackPoint(full.rig.track,-.06)};const half=trial(scene);near(half.rig.distanceM,.5);near(half.timeS,1);near(full.rig.distanceM/full.timeS,Math.SQRT1_2);near(half.rig.distanceM/half.timeS,.5);
});
test('position follows the incline; impact truncates exactly, no interpenetration or hidden initial-state movement',()=>{
 const scene=setup(),run=trial(scene),initial=scene.equipment.find(i=>i.id==='cart'),shown=averageSpeedView(scene,run).equipment.find(i=>i.id==='cart');
 near(alongTrack(run.rig.track,shown.pose).normal,0);near(alongTrack(run.rig.track,shown.pose).along-.11,run.rig.stopAlongM);near(alongTrack(run.rig.track,initial.pose).along,.55);
 assert.deepEqual(advanceAverageSpeed(run,10),run);assert.throws(()=>advanceAverageSpeed(run,-1));assert.throws(()=>advanceAverageSpeed(run,Infinity));
 const early=averageSpeedView(scene,{...run,timeS:.5}).equipment.find(i=>i.id==='cart');near(alongTrack(run.rig.track,early.pose).along,.425);
});
test('30/60 Hz subdivision reaches identical collision time and position',()=>{
 const scene=setup(),finished=trial(scene);
 for(const fps of [30,60]){let run={...finished,timeS:0};for(let n=0;n<fps*3;n++)run=advanceAverageSpeed(run,1/fps);near(run.timeS,Math.sqrt(2));assert.deepEqual(averageSpeedView(scene,run),averageSpeedView(scene,finished));}
});
test('missing devices, flat/reversed/steep slope, outside rails, reversed stop and duplicate tools fail closed',()=>{
 for(const change of [s=>s.equipment.pop(),s=>s.equipment.find(i=>i.id==='track').pose.rotationRad=0,s=>s.equipment.find(i=>i.id==='track').pose.rotationRad=-.1,s=>s.equipment.find(i=>i.id==='track').pose.rotationRad=.5,s=>s.equipment.find(i=>i.id==='cart').pose.yM+=.2,s=>s.equipment.find(i=>i.id==='stop').pose={...s.equipment.find(i=>i.id==='cart').pose},s=>s.equipment.push({...s.equipment[0],id:'extra'}),s=>s.simulationConfig.randomError.enabled=true]){const s=setup();change(s);assert.equal(averageSpeedRig(s).ok,false);}
});
test('drag snap and atomic initial placement align the existing car, with one undo/redo',()=>{
 const scene=createAverageSpeedExperiment('blank',time,true),preset=setup(),track=preset.equipment.find(i=>i.id==='track');scene.equipment=[track];
 const defaults=registry.get('mechanical.cart',1).defaultParameters,item={id:'car',type:'mechanical.cart',definitionVersion:1,parameters:{...defaults,loadMassKg:0,hangerMassKg:0},pose:{xM:.3,yM:.2,rotationRad:0}},point=trackPoint(track,.3,.01),initial=averageSpeedDrop(scene,item,point);
 const result=executeCommand(createHistory(scene),{type:'add-equipment',equipmentType:item.type,id:item.id,point,initial},registry,time);assert.equal(result.ok,true);near(result.history.present.equipment[1].pose.rotationRad,track.pose.rotationRad);near(alongTrack(track,result.history.present.equipment[1].pose).normal,0);
 const undone=travelHistory(result.history,'undo',registry,time);assert.equal(undone.ok,true);assert.equal(undone.history.present.equipment.length,1);assert.equal(travelHistory(undone.history,'redo',registry,time).history.present.equipment.length,2);
 const bad=executeCommand(createHistory(scene),{type:'add-equipment',equipmentType:item.type,id:item.id,point,initial:{...initial,parameters:{...initial.parameters,cartMassKg:NaN}}},registry,time);assert.equal(bad.ok,false);
});
test('ruler/timer movement does not reset the run, while angle/stop changes do; ruler checks coverage',()=>{
 const scene=setup(),run=trial(scene);scene.equipment.find(i=>i.id==='ruler').pose.yM-=.03;scene.equipment.find(i=>i.id==='timer').pose.xM+=.1;assert.equal(averageSpeedRig(scene).signature,run.signature);
 const scale=averageSpeedRuler(scene,run.rig,'ruler');assert.equal(scale.covered,true);near(scale.startM,1.093);near(scale.stopM,.093);near(scale.startM-scale.stopM,1);
 scene.equipment.find(i=>i.id==='ruler').pose.xM+=3;assert.equal(averageSpeedRuler(scene,run.rig,'ruler').covered,false);
 scene.equipment.find(i=>i.id==='stop').pose.xM+=.01;assert.notEqual(averageSpeedRig(scene).signature,run.signature);
});
function sample(startRaw='+109.0',stopRaw='9',timeRaw='1.41') {const scene=setup(),run=trial(scene),built=buildAverageSpeedMeasurements(scene,run,{rulerId:'ruler',startRaw,stopRaw,timeRaw,segment:'full',setupLabel:'第1组',note:'静止释放'},'speed-sample-1',time);assert.equal(built.ok,true,built.message);const saved=appendMeasurements(scene,registry,built.records,built.snapshot,time);assert.equal(saved.ok,true,JSON.stringify(saved.diagnostics));return{scene:saved.document,run,built};}
test('student ruler readings rather than model speed determine s/t; SI snapshots, cm display and CSV round trip',()=>{
 const {scene,built}=sample(),row=averageSpeedResults(scene)[0];near(row.distanceM,1);near(row.timeS,1.41);near(row.velocity,1/1.41);assert.equal(built.records[0].unit,'m');near(built.records[0].value,1.09);assert.equal(displayMeasurement(built.records[0]).value,109);assert.equal(built.records[0].context.originalRawInput,'+109.0');assert.match(measurementsCsv(scene),/cm/);assert.deepEqual(parseSceneJson(serializeScene(scene,registry),registry).document,scene);
});
test('missing/zero/invalid readings stay excluded; no invalid finite-looking average',()=>{
 for(const values of [['','',''],['109','9','0'],['109','109','1.41'],['109','9','-1'],['999','9','1.41']])assert.equal(averageSpeedResults(sample(...values).scene)[0].velocity,null);
 const scene=setup(),run=trial(scene),input={rulerId:'ruler',startRaw:'NaN',stopRaw:'9',timeRaw:'1',segment:'full',setupLabel:'1',note:''};assert.equal(buildAverageSpeedMeasurements(scene,run,input,'bad',time).ok,false);assert.equal(buildAverageSpeedMeasurements(scene,{...run,timeS:0},{...input,startRaw:'109'},'bad',time).ok,false);
});
test('correction/deletion recompute derived averages, preserve original text and frozen configuration',()=>{
 const {scene,built}=sample(),record=scene.measurementRecords[1],raw=measurementInputInSI(record,'29'),corrected=correctManualMeasurement(scene,registry,record.id,raw,time);assert.equal(corrected.ok,true);near(averageSpeedResults(corrected.document)[0].distanceM,.8);near(averageSpeedResults(corrected.document)[0].velocity,.8/1.41);assert.equal(built.snapshot.equipment.find(i=>i.id==='stop').pose.xM,scene.equipment.find(i=>i.id==='stop').pose.xM);
 const removed=removeMeasurement(corrected.document,registry,record.id,time);assert.equal(removed.ok,true);assert.equal(averageSpeedResults(removed.document)[0].velocity,null);
});
