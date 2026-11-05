import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { createSpringExperiment } from '../../src/experiments/spring.ts';
import { springSample, springRuler, springViewScene, springDrop, springAttachment, detachedSpringUpdates, isSpringScene } from '../../src/equipment/spring/simulate.ts';
import { buildSpringMeasurements, springFits, springProfiles } from '../../src/equipment/spring/measure.ts';
import { linearFit } from '../../src/core/measurements/fit.ts';
import { measurementSeries } from '../../src/core/measurements/charts.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';
import { serializeScene, parseSceneJson } from '../../src/core/scene/transfer.ts';
import { measurementsCsv } from '../../src/core/measurements/csv.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { isMechanicalScene } from '../../src/equipment/mechanical/simulate.ts';
const registry = createWorkbenchRegistry(), time = '2026-11-05T02:00:00.000Z';
const kit = () => createSpringExperiment('spring-test', time);
const item = (scene, id) => scene.equipment.find(item => item.id === id);
function mass(scene, value) { const weight = item(scene, 'weight'); weight.parameters.springId = value ? 'spring' : ''; if (value) weight.parameters.massKg = value; }
function good(scene) { const result = springSample(scene, registry); assert.equal(result.ok, true, result.code); return result; }
const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const input = (m, delta = m / 2) => ({ rulerId: 'ruler', topRaw: '.04', bottomRaw: String(.14 + delta), originalRaw: '.10', massRaw: String(m), phase: m ? '加载' : '原长测量', setupLabel: '同一弹簧', note: '手工示例输入' });
function record(history, entry, id) { const built = buildSpringMeasurements(history.present, registry, entry, id, time); assert.equal(built.ok, true, built.code); const result = executeCommand(history, { type: 'record-measurements', records: built.records, snapshot: built.snapshot }, registry, time); assert.equal(result.ok, true, JSON.stringify(result.diagnostics)); return result.history; }

test('formal senior spring template and blank preserve pending textbook metadata and original format 2', () => {
  const scene = kit(), empty = createSpringExperiment('blank-spring', time, true);
  assert.equal(validateSceneDocument(scene, registry).ok, true); assert.equal(validateSceneDocument(empty, registry).ok, true); assert.equal(isSpringScene(empty), true); assert.equal(isMechanicalScene(empty), true);
  assert.equal(scene.curriculumRef.stage, 'senior'); assert.equal(scene.curriculumRef.textbookMappings[0].status, 'pending_teacher_review'); assert.equal(scene.curriculumRef.textbookMappings[0].chapter, null); assert.equal(scene.measurementRecords.length, 0); assert.equal(empty.equipment.length, 0);
});
for (const [m, f, extension, length] of [[0,0,0,.1],[.025,.25,.0125,.1125],[.05,.5,.025,.125],[.075,.75,.0375,.1375],[.1,1,.05,.15]]) test(`formal independent spring baseline ${m} kg gives F=${f} N, extension=${extension} m and L=${length} m`, () => {
  const scene = kit(); mass(scene, m); const outcome = good(scene); near(outcome.value.forceN, f); near(outcome.value.extensionM, extension); near(outcome.value.lengthM, length); assert.notEqual(outcome.value.lengthM, outcome.value.extensionM);
});
test('tray mass is counted once, valid unload returns to original length, and inclusive independent limits reject extrapolation', () => {
  const scene = kit(); mass(scene, .025); item(scene,'spring').parameters.trayMassKg = .01; const loaded = good(scene); near(loaded.value.forceN, .35); near(loaded.value.lengthM, .1175);
  item(scene,'spring').parameters.trayMassKg = 0; mass(scene,.12); near(good(scene).value.extensionM,.06); mass(scene,.12001); assert.equal(springSample(scene,registry).code,'RATED_LOAD_EXCEEDED');
  item(scene,'spring').parameters.ratedLoadN=2; assert.equal(springSample(scene,registry).code,'LINEAR_RANGE_EXCEEDED'); mass(scene,0); near(good(scene).value.lengthM,.1);
});
test('support, verticality, transition, document parameters, unsupported random error and support capacity block normal readings', () => {
  for (const [change, code] of [[scene=>item(scene,'spring').parameters.supportId='', 'MISSING_SUPPORT'],[scene=>item(scene,'spring').pose.rotationRad=.1,'SPRING_ORIENTATION'],[scene=>item(scene,'spring').parameters.stiffnessNPerM=0,'SPRING_DOCUMENT'],[scene=>scene.simulationConfig.randomError={enabled:true,seed:1,distribution:'uniform',amplitude:.1},'SPRING_RANDOM_UNSUPPORTED'],[scene=>{mass(scene,.11);item(scene,'support').parameters.capacityN=1;},'SPRING_SUPPORT_CAPACITY']]) {
    const scene=kit(); change(scene); const outcome=springSample(scene,registry); assert.equal(outcome.ok,false); assert.equal(outcome.code,code); assert.equal(outcome.value,undefined);
  }
  assert.equal(springSample(kit(),registry,true).code,'TRANSITIONING');
});
test('serial weights contribute each mass once; duplicate root hooks, branching, cycles and dangling targets are rejected', () => {
  const scene=kit(); mass(scene,.025); scene.equipment.push({...structuredClone(item(scene,'weight')),id:'child',parameters:{massKg:.025,leverId:'',hookIndex:0,parentWeightId:'weight',springId:''}}); near(good(scene).value.totalMassKg,.05); near(good(scene).value.lengthM,.125);
  const saved=structuredClone(scene); item(scene,'child').parameters.springId='spring'; assert.equal(springSample(scene,registry).code,'SPRING_ATTACHMENT'); Object.assign(item(scene,'child').parameters,{springId:'',parentWeightId:''}); item(scene,'child').parameters.springId='spring'; assert.equal(springSample(scene,registry).code,'SPRING_HOOK_OCCUPIED');
  item(saved,'weight').parameters.parentWeightId='child'; item(saved,'weight').parameters.springId=''; assert.equal(springSample(saved,registry).code,'SPRING_ATTACHMENT');
  item(saved,'weight').parameters.parentWeightId='missing'; assert.equal(springSample(saved,registry).code,'SPRING_ATTACHMENT');
});
test('drag snapping and serial lower hooks share attachment rules; support motion and deletion preserve visible child positions', () => {
  const scene=kit(), before=structuredClone(scene); const attached=springDrop(scene,item(scene,'weight'),{xM:0,yM:.35},springViewScene(scene,registry),registry); assert.equal(attached.parameters.springId,'spring'); assert.deepEqual(scene,before);
  Object.assign(item(scene,'weight'),attached); let visible=springViewScene(scene,registry); near(item(visible,'weight').pose.yM,.3375);
  item(scene,'support').pose.xM+=.2; visible=springViewScene(scene,registry); near(item(visible,'weight').pose.xM,.2);
  const updates=detachedSpringUpdates(scene,['spring'],visible); assert.equal(updates[0].parameters.springId,''); assert.deepEqual(updates[0].pose,item(visible,'weight').pose);
  scene.equipment.push({...structuredClone(item(scene,'weight')),id:'extra',parameters:{massKg:.025,leverId:'',hookIndex:0}}); assert.equal(springAttachment(scene,item(scene,'extra'),'spring'),null);
  const serial=springAttachment(scene,item(scene,'extra'),'','weight'); assert.equal(serial.parentWeightId,'weight'); Object.assign(item(scene,'extra').parameters,serial); assert.equal(springAttachment(scene,item(scene,'weight'),'','extra'),null);
});
test('independent ruler zero offsets cancel in endpoint differences; misalignment and uncovered endpoints block capture', () => {
  const scene=kit(); mass(scene,.05); let ruler=springRuler(scene,registry,'ruler'); assert.equal(ruler.ok,true); near(ruler.topM,.04); near(ruler.bottomM,.165); near(ruler.bottomM-ruler.topM,.125);
  item(scene,'ruler').pose.yM+=.02; ruler=springRuler(scene,registry,'ruler'); near(ruler.topM,.06); near(ruler.bottomM,.185); near(ruler.bottomM-ruler.topM,.125);
  item(scene,'ruler').pose.rotationRad=0; assert.equal(springRuler(scene,registry,'ruler').code,'SPRING_RULER_ALIGNMENT'); item(scene,'ruler').pose.rotationRad=-Math.PI/2; item(scene,'ruler').parameters.lengthM=.05; assert.equal(springRuler(scene,registry,'ruler').code,'SPRING_RULER_RANGE');
});
test('missing/manual erroneous readings never become theory answers; transition and out-of-model captures are blocked', () => {
  const zero=buildSpringMeasurements(kit(),registry,input(0),'zero',time); assert.equal(zero.ok,true); assert.equal(zero.records.find(row=>row.context.pointLabel==='总长L').value,.1); assert.equal(zero.records.find(row=>row.context.pointLabel==='形变量').value,0);
  const scene=kit(); mass(scene,.025); const captured=buildSpringMeasurements(scene,registry,{...input(.025),bottomRaw:'.15'},'manual',time); assert.equal(captured.ok,true); near(captured.records.find(row=>row.context.pointLabel==='形变量').value,.01); near(captured.records.find(row=>row.context.pointLabel==='形变量').context.physicalValue,.0125);
  assert.equal(buildSpringMeasurements(scene,registry,{...input(.025),phase:'原长测量'},'loaded-original',time).code,'SPRING_ORIGINAL_LOADED');
  const missing=buildSpringMeasurements(scene,registry,{...input(.025),bottomRaw:'',massRaw:''},'missing',time); assert.equal(missing.ok,true); assert.equal(missing.records.find(row=>row.context.pointLabel==='形变量').value,null); assert.equal(missing.records.find(row=>row.context.pointLabel==='弹力').value,null);
  assert.equal(buildSpringMeasurements(scene,registry,{...input(.025),topRaw:'0x10'},'bad',time).ok,false); assert.equal(buildSpringMeasurements(scene,registry,input(.025),'moving',time,true).code,'TRANSITIONING'); mass(scene,.2); assert.equal(buildSpringMeasurements(scene,registry,input(.2),'over',time).ok,false);
});
test('five manually read points and an unloading check fit the same recorded 20 N/m curve, freeze snapshots, and round trip through CSV/JSON/history', () => {
  let history=createHistory(kit());
  for (const [index,m] of [0,.025,.05,.075,.1,0].entries()) { mass(history.present,m); history=record(history,{...input(m),phase:index===5?'卸载复测':input(m).phase},`point-${index}`); }
  const fit=springFits(history.present)[0].fit; assert.ok(fit); near(fit.slope,20,1e-6); near(fit.intercept,0); assert.equal(fit.count,6); assert.equal(fit.distinct,5); assert.equal(history.present.measurementRecords.length,42);
  assert.equal(measurementSeries(history.present,springProfiles[0])[0].points.length,6); assert.ok(measurementsCsv(history.present).includes('卸载复测'));
  const loaded=parseSceneJson(serializeScene(history.present,registry),registry); assert.equal(loaded.ok,true); assert.deepEqual(loaded.document,history.present);
  const frozen=JSON.stringify(history.present.measurementSnapshots); mass(history.present,.025); assert.equal(JSON.stringify(history.present.measurementSnapshots),frozen);
  const undo=travelHistory(history,'undo',registry,time); assert.equal(undo.ok,true); assert.equal(undo.history.present.measurementRecords.length,35);
});
test('fits follow student estimates and record corrections, never hidden stiffness; fewer than five distinct lengths and mixed setups have no slope', () => {
  let history=createHistory(kit());
  for (const [index,m] of [0,.025,.05,.075,.1].entries()) { mass(history.present,m); history=record(history,input(m,m*.4),`estimate-${index}`); }
  near(springFits(history.present)[0].fit.slope,25,1e-6);
  const force=history.present.measurementRecords.find(row=>row.id==='estimate-4.6'); const changed=executeCommand(history,{type:'correct-measurement',id:force.id,rawInput:'1.1'},registry,time); assert.equal(changed.ok,true); near(springFits(changed.history.present)[0].fit.slope,27,1e-6);
  assert.equal(linearFit([{x:0,y:0},{x:1,y:1},{x:2,y:2},{x:3,y:3}]),null); assert.equal(linearFit(Array.from({length:5},()=>({x:0,y:0}))),null);
  item(history.present,'spring').parameters.stiffnessNPerM=25; history=record(history,input(.1,.04),'mixed'); assert.equal(springFits(history.present)[0].mixed,true); assert.equal(springFits(history.present)[0].fit,null);
});
