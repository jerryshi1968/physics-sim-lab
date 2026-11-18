import test from 'node:test';
import assert from 'node:assert/strict';
import { refractInterface } from '../../src/core/optical/refraction.ts';
import { createRefractionExperiment } from '../../src/experiments/refraction.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { serializeScene,parseSceneJson } from '../../src/core/scene/transfer.ts';
import { simulateRefraction,refractionAim,reverseRefraction } from '../../src/equipment/refraction/simulate.ts';
import { buildRefractionMeasurements,refractionProfiles } from '../../src/equipment/refraction/measure.ts';
import { equipmentAvailability,equipmentSupport,FREE_OPTICAL_EXPERIMENT } from '../../src/equipment/support.ts';
import { createEmptyScene } from '../../src/core/scene/create.ts';
import { TANK } from '../../src/equipment/refraction/definitions.ts';
import { PROTRACTOR,EMITTER,NORMAL,PAPER,MIRROR } from '../../src/equipment/reflection/definitions.ts';
import { RULER } from '../../src/equipment/optical/definitions.ts';
import { appendMeasurements,correctManualMeasurement,removeMeasurement } from '../../src/core/measurements/records.ts';
import { displayMeasurement,measurementInputInSI } from '../../src/core/measurements/display.ts';
import { measurementSeries } from '../../src/core/measurements/charts.ts';
import { measurementsCsv } from '../../src/core/measurements/csv.ts';
const registry=createWorkbenchRegistry(),time='2026-11-17T00:00:00.000Z',make=()=>createRefractionExperiment('refraction.test',time),rad=degree=>degree*Math.PI/180;
const near=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
function apply(scene,next){assert.ok(next);scene.equipment=scene.equipment.map(i=>i.id===next.id?{...i,pose:next.pose,parameters:next.parameters}:i);return scene;}
function aim(scene,degree,water=false){return apply(scene,refractionAim(scene,rad(degree),water));}
for(const [incidence,refraction]of [[0,0],[30,22.024312837],[45,32.027760114],[60,40.505350327]])test(`air-water independent benchmark ${incidence} -> ${refraction} degrees`,()=>{
  const result=refractInterface({x:Math.sin(rad(incidence)),y:-Math.cos(rad(incidence))},1,4/3);near(result.incidenceRad,rad(incidence));near(result.refractionRad,rad(refraction));near(Math.hypot(result.transmitted.x,result.transmitted.y),1);assert.ok(result.transmitted.y<0);
});
test('water-air critical angle, above-critical and equal-index limits do not create a false transmitted angle',()=>{
  const critical=rad(48.59037789072914),hit=refractInterface({x:Math.sin(critical),y:Math.cos(critical)},4/3,1);assert.equal(hit.kind,'critical');near(hit.refractionRad,Math.PI/2);
  const total=refractInterface({x:Math.sin(rad(60)),y:Math.cos(rad(60))},4/3,1);assert.equal(total.kind,'total-reflection');assert.equal(total.refractionRad,null);assert.equal(total.transmitted,null);assert.ok(total.reflected.y<0);
  near(refractInterface({x:.6,y:-.8},1,1).transmitted.x,.6);near(refractInterface({x:.5,y:Math.sqrt(3)/2},4/3,1).refractionRad,rad(41.8103148957786));
});
test('Snell solution is reversible on either side and for either horizontal sign',()=>{
  for(const angle of [-60,-40,0,20,60]){const first=refractInterface({x:Math.sin(rad(angle)),y:-Math.cos(rad(angle))},1,4/3),back=refractInterface({x:-first.transmitted.x,y:-first.transmitted.y},4/3,1);near(back.transmitted.x,-Math.sin(rad(angle)));near(back.transmitted.y,Math.cos(rad(angle)));}
});
test('invalid or grazing mathematical inputs fail closed',()=>{
  for(const[d,a,b]of [[{x:NaN,y:1},1,4/3],[{x:1,y:0},1,4/3],[{x:0,y:2},1,4/3],[{x:0,y:1},0,1],[{x:0,y:1},1,Infinity]])assert.throws(()=>refractInterface(d,a,b),/INVALID_REFRACTION/);
});
test('preset reuses source, two gauges and normal, adds only a tank, round trips pending curriculum',()=>{
  const scene=make(),outcome=simulateRefraction(scene,registry);assert.equal(validateSceneDocument(scene,registry).ok,true);assert.equal(outcome.ok,true);assert.equal(scene.equipment.length,5);assert.equal(equipmentSupport(scene).key,'refraction');assert.equal(scene.equipment.filter(i=>i.type===PROTRACTOR).length,2);assert.equal(outcome.readable.incident,true);assert.equal(outcome.readable.refracted,true);near(outcome.incidenceRad,rad(40));assert.equal(scene.curriculumRef.textbookMappings[0].status,'pending_teacher_review');assert.deepEqual(parseSceneJson(serializeScene(scene,registry),registry).document,scene);
  assert.equal(equipmentAvailability(scene,PROTRACTOR).enabled,false);assert.equal(equipmentAvailability(scene,MIRROR).enabled,false);
});
test('generic optical blank waits on shared tools, then tank selects refraction and paper excludes it',()=>{
  const scene=createEmptyScene('blank',time);scene.experimentId=FREE_OPTICAL_EXPERIMENT;const add=type=>scene.equipment.push({id:'item'+scene.equipment.length,type,definitionVersion:1,pose:{xM:0,yM:0,rotationRad:0},parameters:{...registry.get(type,1).defaultParameters}});
  add(PROTRACTOR);assert.equal(equipmentSupport(scene).key,'opticalFree');assert.equal(equipmentAvailability(scene,PROTRACTOR).enabled,true);add(TANK);assert.equal(equipmentSupport(scene).key,'refraction');assert.equal(equipmentAvailability(scene,PAPER).enabled,false);scene.equipment.pop();add(PAPER);assert.equal(equipmentSupport(scene).key,'reflection');assert.equal(equipmentAvailability(scene,TANK).enabled,false);scene.equipment.pop();add(PROTRACTOR);assert.equal(equipmentSupport(scene).key,'refraction');assert.equal(equipmentAvailability(scene,PAPER).enabled,false);
});
test('physical reverse command retraces hit and incident ray, changes one source pose only',()=>{
  const scene=make(),first=simulateRefraction(scene,registry),others=structuredClone(scene.equipment.filter(i=>i.type!==EMITTER));apply(scene,reverseRefraction(first));const back=simulateRefraction(scene,registry);assert.equal(back.ok,true);assert.equal(back.fromWater,true);near(back.hit.x,first.hit.x);near(back.hit.y,first.hit.y);near(back.transmitted.x,-first.direction.x);near(back.transmitted.y,-first.direction.y);assert.deepEqual(scene.equipment.filter(i=>i.type!==EMITTER),others);assert.equal(back.readable.incident,true);assert.equal(back.readable.refracted,true);
});
test('finite tank clips underwater ray at bottom or side, not an imaginary second refraction',()=>{
  const scene=aim(make(),60),o=simulateRefraction(scene,registry),end={x:o.hit.x+o.transmitted.x*o.transmittedLengthM,y:o.hit.y+o.transmitted.y*o.transmittedLengthM};near(end.y,-.48);assert.ok(Math.abs(end.x)<.6);
  scene.equipment.find(i=>i.type===TANK).parameters.depthM=.8;scene.equipment.find(i=>i.type===TANK).parameters.widthM=.6;const side=simulateRefraction(scene,registry);near(side.hit.x+side.transmitted.x*side.transmittedLengthM,.3);
});
test('geometry failures, source off and missing optional measuring tools are explicit',()=>{
  for(const change of [s=>s.equipment.find(i=>i.type===EMITTER).parameters.enabled=false,s=>s.equipment.find(i=>i.type===EMITTER).pose.rotationRad=0,s=>s.equipment.find(i=>i.type===EMITTER).pose.yM=0,s=>s.equipment.find(i=>i.type===TANK).pose.rotationRad=.1,s=>s.equipment.find(i=>i.type===EMITTER).pose.xM=2,s=>s.equipment.push({...s.equipment[0],id:'duplicate'})]){const s=make();change(s);assert.equal(simulateRefraction(s,registry).ok,false);}
  const s=make();s.equipment=s.equipment.filter(i=>![PROTRACTOR,NORMAL].includes(i.type));const o=simulateRefraction(s,registry);assert.equal(o.ok,true);assert.equal(o.readable.incident,false);assert.equal(o.readable.refracted,false);
});
function sample(scene=make(),incidenceDeg='40',refractionDeg='29',id='refraction-1'){
  const built=buildRefractionMeasurements(scene,registry,{incidenceDeg,refractionDeg,observation:'向法线偏折',setupLabel:'第1组',note:'比较方向'},id,time);assert.equal(built.ok,true,built.message);const appended=appendMeasurements(scene,registry,built.records,built.snapshot,time);assert.equal(appended.ok,true,JSON.stringify(appended.diagnostics));return{scene:appended.document,built};
}
test('manual degrees remain distinct from model values and minute-independent SI sources stay frozen',()=>{
  const{scene,built}=sample();near(scene.measurementRecords[1].value,rad(29));assert.ok(Math.abs(scene.measurementRecords[1].value-scene.measurementRecords[1].context.physicalValue)>.001);assert.equal(displayMeasurement(scene.measurementRecords[1]).value,29);assert.match(measurementsCsv(scene),/°/);assert.match(measurementsCsv(scene),/向法线偏折/);scene.equipment.find(i=>i.type===TANK).parameters.depthM=.6;assert.equal(built.snapshot.equipment.find(i=>i.type===TANK).parameters.depthM,.48);assert.deepEqual(parseSceneJson(serializeScene(scene,registry),registry).document,scene);
});
test('uncalibrated or total-reflection angle stays invalid even if a student enters a normal-looking number',()=>{
  const s=make();s.equipment.find(i=>i.id==='lower-gauge').pose.xM=.1;const unaligned=sample(s);assert.equal(unaligned.scene.measurementRecords[1].measurementStatus,'out-of-model');assert.equal(unaligned.scene.measurementRecords[1].value,null);
  const total=sample(aim(make(),60,true),'60','0');assert.equal(total.scene.measurementRecords[1].value,null);assert.ok(total.scene.measurementRecords[1].context.diagnosticCodes.includes('REFRACTION_NO_TRANSMITTED_RAY'));
});
test('manual blanks, revisions, deleted values and direction-separated chart series use saved records only',()=>{
  const blank=sample(make(),'','');assert.equal(blank.scene.measurementRecords[0].value,null);assert.equal(blank.scene.measurementRecords[1].value,null);
  const {scene}=sample(),r=scene.measurementRecords[1],raw=measurementInputInSI(r,'28');const corrected=correctManualMeasurement(scene,registry,r.id,raw,time);assert.equal(corrected.ok,true);near(displayMeasurement(corrected.document.measurementRecords[1]).value,28);assert.equal(corrected.document.measurementRecords[1].context.originalRawInput,'29');
  const next=sample(aim(corrected.document,20,true),'20','27','refraction-2').scene;const series=measurementSeries(next,refractionProfiles[0]);assert.equal(series.length,2);assert.ok(series.some(s=>s.label.includes('水→空气')));const removed=removeMeasurement(next,registry,r.id,time);assert.equal(removed.ok,true);assert.ok(measurementSeries(removed.document,refractionProfiles[0]).every(s=>!s.points.some(p=>p.recordId===r.id)));
});
test('out-of-range manual values, preview and invalid observations cannot create ordinary captures',()=>{
  const s=make(),input={incidenceDeg:'NaN',refractionDeg:'',observation:'未判断',setupLabel:'1',note:''};assert.equal(buildRefractionMeasurements(s,registry,input,'refraction-bad',time).ok,false);input.incidenceDeg='40';assert.equal(buildRefractionMeasurements(s,registry,input,'refraction-bad',time,true).ok,false);input.observation='invented';assert.equal(buildRefractionMeasurements(s,registry,input,'refraction-bad',time).ok,false);
  const invalid=sample(make(),'100','100');assert.equal(invalid.scene.measurementRecords[0].value,null);assert.equal(invalid.scene.measurementRecords[1].value,null);
  s.equipment.push({id:'ruler',type:RULER,definitionVersion:1,pose:{xM:0,yM:-.6,rotationRad:0},parameters:{...registry.get(RULER,1).defaultParameters}});assert.equal(simulateRefraction(s,registry).ok,true);
});
