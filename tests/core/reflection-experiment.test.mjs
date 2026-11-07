import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { createReflectionExperiment } from '../../src/experiments/reflection.ts';
import { createOpticalExperiment } from '../../src/experiments/optical-bench.ts';
import { simulateOptical } from '../../src/equipment/optical/simulate.ts';
import { simulateReflection, isReflectionScene } from '../../src/equipment/reflection/simulate.ts';
import { MIRROR, EMITTER, PAPER, PROTRACTOR, NORMAL, reflectionTypes } from '../../src/equipment/reflection/definitions.ts';
import { reflect3, paperTrace, length3, dot3 } from '../../src/core/optical/reflection.ts';
import { buildReflectionMeasurements, reflectionProfiles } from '../../src/equipment/reflection/measure.ts';
import { displayMeasurement, measurementInputInSI } from '../../src/core/measurements/display.ts';
import { appendMeasurements, correctManualMeasurement } from '../../src/core/measurements/records.ts';
import { measurementSeries } from '../../src/core/measurements/charts.ts';
import { measurementsCsv } from '../../src/core/measurements/csv.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { serializeScene, parseSceneJson } from '../../src/core/scene/transfer.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';

const registry=createWorkbenchRegistry(),timestamp='2026-11-05T00:00:00.000Z';
const scene=()=>createReflectionExperiment('reflection.test',timestamp);
const close=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const item=(s,type)=>s.equipment.find(e=>e.type===type);
function solve(s){const r=simulateReflection(s,registry);assert.equal(r.ok,true,JSON.stringify(r));return r;}
function orbit(s,deg){const a=deg*Math.PI/180;item(s,EMITTER).pose={xM:.48*Math.cos(a),yM:.48*Math.sin(a),rotationRad:Math.atan2(-Math.sin(a),-Math.cos(a))};}
const input={incidenceDeg:'29.5',reflectionDeg:'31',observation:'能看到',setupLabel:'第1组',note:'手工估读'};

test('new apparatus, blank start and curriculum remain strict and pending',()=>{
  const s=scene();assert.equal(validateSceneDocument(s,registry).ok,true);assert.equal(isReflectionScene(s),true);
  assert.equal(createReflectionExperiment('blank',timestamp,true).equipment.length,0);assert.equal(s.measurementRecords.length,0);
  for(const type of reflectionTypes){assert.equal(registry.get(type,1).domain,'optical');assert.deepEqual(registry.get(type,1).ports,[]);}
  assert.equal(s.curriculumRef.textbookMappings[0].status,'pending_teacher_review');assert.equal(s.curriculumRef.textbookMappings[0].reviewedBy,null);
  for(const [type,key,value]of [[PAPER,'foldRad',Math.PI],[MIRROR,'lengthM',0],[PROTRACTOR,'radiusM',Infinity],[EMITTER,'enabled',1],[NORMAL,'lengthM',-1]]){
    const invalid=scene();item(invalid,type).parameters[key]=value;assert.equal(validateSceneDocument(invalid,registry).ok,false);
  }
});
test('vector reflection normalizes normal and direction, keeps tangent and reverses normal component',()=>{
  const d={x:3,y:-4,z:0},n={x:0,y:8,z:0},r=reflect3(d,n);close(r.x,.6);close(r.y,.8);close(length3(r),1);close(dot3(r,{x:0,y:1,z:0}),.8);
  assert.deepEqual(reflect3(d,{x:0,y:-8,z:0}),r);assert.throws(()=>reflect3(d,{x:0,y:0,z:0}),/INVALID_VECTOR/);
  const spatial=reflect3({x:1,y:-2,z:2},{x:0,y:1,z:0});close(spatial.x,1/3);close(spatial.y,2/3);close(spatial.z,2/3);
});
test('independent 0,30,45,60 degree benchmarks measure from normal with sub-microradian error',()=>{
  for(const deg of [0,30,45,60]){const s=scene();orbit(s,90+deg);const r=solve(s);close(r.incidenceRad,deg*Math.PI/180,1e-8);close(r.reflectionRad,r.incidenceRad,1e-12);close(r.hit.x,0);close(r.hit.y,0);assert.equal(r.readable.incident,true);assert.equal(r.readable.reflected,true);}
});
test('ray-plane clipping distinguishes a finite line, isolated intersection and parallel miss',()=>{
  const p={origin:{x:0,y:0,z:0},u:{x:1,y:0,z:0},v:{x:0,y:1,z:0},minU:0,maxU:1,height:1};
  const along=paperTrace({x:-1,y:.5,z:0},{x:1,y:0,z:0},p,3);assert.equal(along.kind,'along');close(along.lengthM,1);close(along.start.x,0);close(along.end.x,1);
  assert.equal(paperTrace({x:.5,y:.5,z:1},{x:0,y:0,z:-1},p,2).kind,'point');
  assert.equal(paperTrace({x:2,y:.5,z:1},{x:0,y:0,z:-1},p,2).kind,'none');
  assert.equal(paperTrace({x:0,y:0,z:.001},{x:1,y:0,z:0},p,2).kind,'none');
  assert.equal(paperTrace({x:-1,y:.5,z:0},{x:1,y:0,z:0},p,.5).kind,'none');
});
test('folding physically separates receiving plane without changing free-space reflection',()=>{
  const s=scene(),flat=solve(s);assert.equal(flat.evidence,'on-sheet');
  for(const [fold,separation]of [[30,.05],[90,.1],[-30,.05]]){
    item(s,PAPER).parameters.foldRad=fold*Math.PI/180;const r=solve(s);assert.equal(r.outgoing[1].kind,'point');close(r.outgoing[1].lengthM,0);close(Math.abs(r.outgoing[1].distanceAtProbeM),separation);
    assert.deepEqual(r.reflected,flat.reflected);close(r.incidenceRad,flat.incidenceRad);assert.equal(r.incoming[0].kind,'along');assert.equal(r.readable.reflected,false);assert.equal(r.evidence,'off-sheet');
  }
  item(s,PAPER).parameters.foldRad=0;assert.deepEqual(solve(s),flat);
});
test('normal incidence is an explicit hinge counterexample, and opposite incidence uses fixed left leaf',()=>{
  const s=scene();orbit(s,90);item(s,PAPER).parameters.foldRad=Math.PI/2;const normal=solve(s);assert.equal(normal.evidence,'hinge');assert.equal(normal.outgoing[1].kind,'along');close(normal.outgoing[1].distanceAtProbeM,0);
  orbit(s,60);const opposite=solve(s);assert.equal(opposite.evidence,'wrong-side');assert.equal(opposite.outgoing[0].kind,'along');assert.equal(opposite.readable.reflected,true);
});
test('rigid translation and rotation preserve local angles and folded separation',()=>{
  const s=scene();item(s,PAPER).parameters.foldRad=.6;const initial=solve(s),a=.4;
  for(const e of s.equipment){const{xM:x,yM:y}=e.pose;e.pose={xM:2+x*Math.cos(a)-y*Math.sin(a),yM:-1+x*Math.sin(a)+y*Math.cos(a),rotationRad:e.pose.rotationRad+a};}
  const r=solve(s);close(r.incidenceRad,initial.incidenceRad);close(r.reflectionRad,initial.reflectionRad);close(r.outgoing[1].distanceAtProbeM,initial.outgoing[1].distanceAtProbeM);assert.equal(r.calibrated,true);
});
test('independent paper/gauge/normal alignment gates reading without changing physical ray',()=>{
  for(const type of [PAPER,PROTRACTOR,NORMAL]){const s=scene(),before=solve(s);item(s,type).pose.xM+=.01;const after=solve(s);assert.equal(after.calibrated,false);assert.equal(after.readable.incident,false);assert.equal(after.readable.reflected,false);assert.deepEqual(after.reflected,before.reflected);assert.equal(item(s,EMITTER).pose.xM,-.24);}
  const s=scene();item(s,PROTRACTOR).pose.rotationRad=.01;assert.equal(solve(s).calibrated,false);
});
test('finite mirror miss, backside, parallel, disabled light, missing, mixed and invalid data never emit normal payload',()=>{
  const cases=[
    [s=>{item(s,MIRROR).parameters.lengthM=.1;item(s,EMITTER).pose.xM+=.2;},'REFLECTION_MIRROR_MISS'],
    [s=>{item(s,EMITTER).pose.yM=-.2;},'REFLECTION_BACK_SIDE'],
    [s=>{item(s,EMITTER).pose.rotationRad=0;},'REFLECTION_NO_HIT'],
    [s=>{item(s,EMITTER).parameters.rangeM=.2;},'REFLECTION_NO_HIT'],
    [s=>{item(s,EMITTER).parameters.enabled=false;},'REFLECTION_LIGHT_OFF'],
    [s=>s.equipment.pop(),'REFLECTION_APPARATUS'],
    [s=>{s.equipment.push({...structuredClone(s.equipment[0]),id:'duplicate'});},'REFLECTION_APPARATUS'],
    [s=>{item(s,MIRROR).pose.flippedX=true;},'REFLECTION_RANGE'],
    [s=>{item(s,MIRROR).pose.xM=101;},'REFLECTION_RANGE'],
    [s=>{item(s,PAPER).parameters.foldRad=NaN;},'REFLECTION_DOCUMENT'],
    [s=>{s.simulationConfig.randomError.enabled=true;s.simulationConfig.randomError.distribution='uniform';},'REFLECTION_RANDOM'],
    [s=>{s.equipment.push({id:'lens',type:'optical.convex-lens',definitionVersion:1,pose:{xM:0,yM:0,rotationRad:0},parameters:registry.get('optical.convex-lens',1).defaultParameters});},'REFLECTION_MIXED'],
  ];
  for(const [change,code]of cases){const s=scene();change(s);assert.deepEqual(simulateReflection(s,registry),{ok:false,code});}
});
test('manual degree estimates convert to SI separately from truth and preserve original strings',()=>{
  const s=scene(),built=buildReflectionMeasurements(s,registry,input,'sample.1',timestamp);assert.equal(built.ok,true);close(built.records[0].value,29.5*Math.PI/180);close(built.records[1].value,31*Math.PI/180);close(built.records[1].context.physicalValue,Math.PI/6);
  assert.equal(built.records[1].unit,'rad');assert.equal(built.records[1].context.originalRawInput,'31°');assert.equal(JSON.parse(built.snapshot.note).degrees[0],'29.5');assert.equal(built.records[2].value,1);
  const appended=appendMeasurements(s,registry,built.records,built.snapshot,timestamp);assert.equal(appended.ok,true);item(appended.document,PAPER).parameters.foldRad=.7;assert.equal(built.snapshot.equipment.find(e=>e.type===PAPER).parameters.foldRad,0);assert.equal(s.measurementRecords.length,0);
});
test('missing values, folded unreadable angle and invalid range do not become theory-filled readings',()=>{
  const s=scene();const missing=buildReflectionMeasurements(s,registry,{...input,incidenceDeg:'',reflectionDeg:'',observation:'未判断'},'empty',timestamp);assert.equal(missing.ok,true);assert.ok(missing.records.every(r=>r.value===null));
  item(s,PAPER).parameters.foldRad=Math.PI/4;const folded=buildReflectionMeasurements(s,registry,{...input,observation:'不能看到'},'folded',timestamp);assert.equal(folded.ok,true);assert.equal(folded.records[1].measurementStatus,'out-of-model');assert.equal(folded.records[1].value,null);assert.equal(folded.records[2].value,0);assert.equal(folded.records[0].measurementStatus,'valid');
  assert.equal(buildReflectionMeasurements(s,registry,input,'preview',timestamp,true).ok,false);
  for(const raw of ['NaN','=1+2','1e999'])assert.equal(buildReflectionMeasurements(scene(),registry,{...input,incidenceDeg:raw},'invalid',timestamp).ok,false);
  const excess=buildReflectionMeasurements(scene(),registry,{...input,incidenceDeg:'91',reflectionDeg:'-1'},'range',timestamp);assert.equal(excess.ok,true);assert.equal(excess.records[0].measurementStatus,'over-range');assert.equal(excess.records[1].measurementStatus,'reverse');assert.equal(excess.records[0].value,null);
});
test('three student comparisons drive chart, CSV and strict save roundtrip, snapshots stay frozen',()=>{
  let s=scene();for(const [i,deg]of [30,45,60].entries()){
    orbit(s,90+deg);const built=buildReflectionMeasurements(s,registry,{...input,incidenceDeg:String(deg),reflectionDeg:String(deg+1),setupLabel:'三组比较'},`sample.${i}`,timestamp);assert.equal(built.ok,true);const appended=appendMeasurements(s,registry,built.records,built.snapshot,timestamp);assert.equal(appended.ok,true);s=appended.document;
  }
  const series=measurementSeries(s,reflectionProfiles[0]);assert.equal(series.length,1);assert.equal(series[0].points.length,3);close(series[0].points[2].x,60);close(series[0].points[2].y,61);
  const csv=measurementsCsv(s);assert.ok(csv.includes('"°",30'));assert.ok(csv.includes('31°'));assert.ok(csv.includes('手工估读'));assert.equal(/NaN|Infinity/.test(csv),false);
  const restored=parseSceneJson(serializeScene(s,registry),registry);assert.equal(restored.ok,true);assert.deepEqual(restored.document,s);
  const changed=JSON.parse(serializeScene(s,registry));changed.equipment[0].type='optical.unknown';assert.equal(parseSceneJson(JSON.stringify(changed),registry).ok,false);
});
test('fold and pose commands undo independently of immutable measurement snapshots',()=>{
  const s=scene(),built=buildReflectionMeasurements(s,registry,input,'sample.1',timestamp),added=appendMeasurements(s,registry,built.records,built.snapshot,timestamp);assert.equal(added.ok,true);
  const paper=item(added.document,PAPER),changed=executeCommand(createHistory(added.document),{type:'update-equipment',id:paper.id,pose:paper.pose,parameters:{...paper.parameters,foldRad:Math.PI/4}},registry,timestamp);assert.equal(changed.ok,true);assert.equal(solve(changed.history.present).evidence,'off-sheet');assert.deepEqual(changed.history.present.measurementSnapshots,added.document.measurementSnapshots);
  const undone=travelHistory(changed.history,'undo',registry,timestamp);assert.equal(undone.ok,true);assert.equal(solve(undone.history.present).evidence,'on-sheet');
  const redone=travelHistory(undone.history,'redo',registry,timestamp);assert.equal(redone.ok,true);assert.equal(solve(redone.history.present).evidence,'off-sheet');
});
test('lens model also rejects unsupported reflection apparatus instead of silently ignoring it',()=>{
  const lens=createOpticalExperiment('lens.test',timestamp),mirror=structuredClone(item(scene(),MIRROR));
  lens.equipment.push(mirror);assert.equal(validateSceneDocument(lens,registry).ok,true);assert.deepEqual(simulateOptical(lens,registry),{ok:false,code:'OPTICAL_MIXED_DOMAIN'});
});


test('degree records, corrections and export preserve SI snapshots and invalid statuses',()=>{
  const built=buildReflectionMeasurements(scene(),registry,{...input,incidenceDeg:'30'},'degree.sample',timestamp);
  const added=appendMeasurements(scene(),registry,built.records,built.snapshot,timestamp);assert.equal(added.ok,true);
  const s=added.document,before=structuredClone(s),record=s.measurementRecords[0],view=displayMeasurement(record);
  assert.equal(view.value,30);assert.equal(view.unit,'°');assert.equal(view.rawInput,'30');assert.deepEqual(view.range,{min:0,max:90,resolution:1});
  assert.equal(view.context.instrumentDisplayValue,30);assert.equal(view.context.physicalValue,30);assert.deepEqual(s,before);
  const corrected=correctManualMeasurement(s,registry,record.id,measurementInputInSI(record,'32.5'),timestamp);assert.equal(corrected.ok,true);
  assert.equal(displayMeasurement(corrected.document.measurementRecords[0]).value,32.5);assert.equal(displayMeasurement(corrected.document.measurementRecords[0]).rawInput,'32.5');
  assert.equal(corrected.document.measurementRecords[0].context.originalRawInput,'30°');assert.deepEqual(corrected.document.measurementSnapshots,s.measurementSnapshots);
  const csv=measurementsCsv(corrected.document);assert.ok(csv.includes('"°",32.5,"30°","32.5"'));assert.ok(csv.includes(',0,90,1,'));
  for(const [raw,status]of [['91','over-range'],['-1','reverse'],['','invalid']]){
    const result=correctManualMeasurement(s,registry,record.id,measurementInputInSI(record,raw),timestamp);assert.equal(result.ok,true);
    const display=displayMeasurement(result.document.measurementRecords[0]);assert.equal(display.value,null);assert.equal(display.measurementStatus,status);
  }
  assert.equal(measurementInputInSI(record,'abc'),null);assert.equal(measurementInputInSI(record,'1e999'),null);
  assert.equal(displayMeasurement(s.measurementRecords[2]),s.measurementRecords[2]);
});
