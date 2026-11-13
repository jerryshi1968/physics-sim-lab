import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceThermal, thermalInitial, thermalRig, thermalReading, BOILING_K } from '../../src/equipment/thermal/simulate.ts';
import { createBoilingExperiment } from '../../src/experiments/boiling.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { serializeScene, parseSceneJson } from '../../src/core/scene/transfer.ts';
import { equipmentAvailability, equipmentSupport } from '../../src/equipment/support.ts';
import { buildThermalMeasurements, thermalRows } from '../../src/equipment/thermal/measure.ts';
import { appendMeasurements, correctManualMeasurement, removeMeasurement } from '../../src/core/measurements/records.ts';
import { displayMeasurement, measurementInputInSI } from '../../src/core/measurements/display.ts';
import { measurementsCsv } from '../../src/core/measurements/csv.ts';
import { convertUnit, toSI } from '../../src/core/units/units.ts';

const time = '2026-11-13T00:00:00.000Z', registry = createWorkbenchRegistry();
const make = () => createBoilingExperiment('thermal.test', time);
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const config = { initialMassKg: .1, vesselCapacityJPerK: 20, initialTemperatureK: 293.15, ambientTemperatureK: 293.15, powerW: 200, efficiency: .5, lossWPerK: 0 };

test('isolated heating follows Q=mcΔT including vessel capacity: 100 W, 440 J/K, 44 s -> 30 °C', () => {
  const state = advanceThermal(thermalInitial(config), config, true, 44);
  near(state.temperatureK, 303.15); near(state.timeS,44); near(state.massKg,.1);
});
test('boiling onset event, latent plateau and dry event conserve energy rather than overshoot', () => {
  const state = advanceThermal(thermalInitial(config), config, true, 352 + 225.6);
  near(state.temperatureK, BOILING_K); near(state.massKg,.09); near(state.timeS,577.6);
  const dry = advanceThermal(thermalInitial(config), config, true, 1e6);
  near(dry.massKg,0); near(dry.timeS,2608); near(dry.temperatureK,BOILING_K);
  assert.deepEqual(advanceThermal(dry,config,true,100),dry);
});
test('Newton cooling has independent exponential benchmark; heater off stops vaporization', () => {
  const c = {...config,lossWPerK:2}, s={timeS:10,temperatureK:373.15,massKg:.1};
  const state=advanceThermal(s,c,false,220);
  near(state.temperatureK,293.15 + 80/Math.E); near(state.massKg,.1); near(state.timeS,230);
});
test('insufficient power asymptotes below boiling, zero power cannot fake a plateau', () => {
  const c={...config,lossWPerK:2};
  const state=advanceThermal(thermalInitial(c),c,true,100000);
  near(state.temperatureK,343.15); near(state.massKg,.1);
  near(advanceThermal(thermalInitial(config),{...config,powerW:0},true,1000).temperatureK,293.15);
});
test('one large step and 30/60 Hz subdivisions agree across onset and evaporation', () => {
  const c={...config,lossWPerK:.5}, expected=advanceThermal(thermalInitial(c),c,true,500);
  for(const fps of [30,60]) { let s=thermalInitial(c); for(let n=0;n<500*fps;n++) s=advanceThermal(s,c,true,1/fps); near(s.temperatureK,expected.temperatureK,1e-8); near(s.massKg,expected.massKg,1e-9); near(s.timeS,500,1e-6); }
});
test('invalid configuration and state fail closed', () => {
  for(const change of [{powerW:NaN},{initialMassKg:0},{efficiency:2},{lossWPerK:-1},{initialTemperatureK:400}]) assert.throws(()=>advanceThermal(thermalInitial(config),{...config,...change},true,10),/INVALID_THERMAL_STATE/);
  assert.throws(()=>advanceThermal({...thermalInitial(config),temperatureK:500},config,true,10));
  assert.throws(()=>advanceThermal(thermalInitial(config),config,true,Infinity));
});
test('preset and blank use existing cup, stand and clock; limits and pending-review round trip', () => {
  const scene=make(); assert.equal(validateSceneDocument(scene,registry).ok,true);
  assert.equal(scene.equipment.length,5); assert.equal(equipmentSupport(scene).key,'boiling');
  assert.equal(scene.curriculumRef.stage,'junior'); assert.equal(scene.curriculumRef.textbookMappings[0].status,'pending_teacher_review');
  assert.deepEqual(parseSceneJson(serializeScene(scene,registry),registry).document,scene);
  assert.equal(createBoilingExperiment('empty',time,true).equipment.length,0);
  assert.equal(equipmentAvailability(scene,'electrical.power-source').enabled,false);
  assert.equal(equipmentAvailability(scene,'thermal.heater').enabled,false);
});
test('physical contact, immersed bulb, wall/bottom/air and removed instrument checks', () => {
  const scene=make(), rig=thermalRig(scene), state=thermalInitial(rig.config);
  assert.equal(rig.ok,true); assert.equal(rig.contact,true); assert.equal(thermalReading(rig,state).ok,true);
  const meter=scene.equipment.find(i=>i.id==='thermometer'); meter.pose.xM=.08;
  assert.equal(thermalReading(thermalRig(scene),state).ok,false);
  meter.pose.xM=0; meter.pose.yM=.22;
  assert.equal(thermalReading(thermalRig(scene),state).ok,false);
  meter.pose.yM=.5; assert.equal(thermalReading(thermalRig(scene),state).ok,false);
  scene.equipment=scene.equipment.filter(i=>i.id!=='thermometer'); assert.equal(thermalReading(thermalRig(scene),state).ok,false);
  scene.equipment.find(i=>i.id==='beaker').pose.xM=.15; assert.equal(thermalRig(scene).contact,false);
});
test('Celsius UI conversion is affine and Kelvin remains canonical SI', () => {
  near(convertUnit(20,'°C','K'),293.15); near(convertUnit(373.15,'K','°C'),100); assert.deepEqual(toSI({value:0,unit:'°C'}),{value:273.15,unit:'K'});
  assert.throws(()=>convertUnit(1,'K','m'),/INCOMPATIBLE_UNITS/);
});
function sample(source='instrument', temperatureRaw='30', timeRaw='44') {
  const scene=make(),rig=thermalRig(scene),state=advanceThermal(thermalInitial(rig.config),rig.config,true,44);
  const result=buildThermalMeasurements(scene,state,rig.signature,'cycle1',true,{source,timeRaw,temperatureRaw,setupLabel:'热学1',note:'观察气泡'},'sample1',time);
  assert.equal(result.ok,true,result.message);
  const appended=appendMeasurements(scene,registry,result.records,result.snapshot,time);
  assert.equal(appended.ok,true,JSON.stringify(appended.diagnostics)); return {scene:appended.document,result,state};
}
test('instrument captures freeze T/time/config, export °C, save SI and resist later parameter edits',()=>{
  const {scene,result,state}=sample(); assert.equal(result.records[1].unit,'K'); near(result.records[1].context.physicalValue,state.temperatureK);
  near(displayMeasurement(result.records[1]).value,Math.round(state.temperatureK-273.15));
  assert.match(measurementsCsv(scene),/℃/); assert.match(measurementsCsv(scene),/观察气泡/);
  assert.deepEqual(parseSceneJson(serializeScene(scene,registry),registry).document,scene);
  scene.equipment.find(i=>i.id==='heater').parameters.powerW=1000;
  assert.equal(result.snapshot.equipment.find(i=>i.id==='heater').parameters.powerW,500);
});
test('manual blanks stay missing; corrections update °C chart and source snapshots stay frozen',()=>{
  const missing=sample('manual','','').scene; assert.equal(thermalRows(missing)[0].temperatureC,null); assert.equal(thermalRows(missing)[0].timeS,null);
  const {scene}=sample('manual','+030.0'); near(thermalRows(scene)[0].temperatureC,30);
  const record=scene.measurementRecords.find(r=>r.quantity==='temperature'); near(Number(measurementInputInSI(record,'42')),315.15);
  const corrected=correctManualMeasurement(scene,registry,record.id,measurementInputInSI(record,'42'),time);
  assert.equal(corrected.ok,true); near(thermalRows(corrected.document)[0].temperatureC,42); near(displayMeasurement(corrected.document.measurementRecords[1]).value,42);
  assert.equal(displayMeasurement(corrected.document.measurementRecords[1]).context.originalRawInput,'+030.0');
  const removed=removeMeasurement(corrected.document,registry,record.id,time); assert.equal(removed.ok,true); assert.equal(thermalRows(removed.document)[0].temperatureC,null);
});
test('stale rig and exposed thermometer cannot produce valid captures',()=>{
  const scene=make(),rig=thermalRig(scene),state=thermalInitial(rig.config),input={source:'instrument',timeRaw:'',temperatureRaw:'',setupLabel:'1',note:''};
  assert.equal(buildThermalMeasurements(scene,state,'stale','run',true,input,'bad',time).ok,false);
  scene.equipment.find(i=>i.id==='thermometer').pose.yM=.5;
  assert.equal(buildThermalMeasurements(scene,state,rig.signature,'run',true,input,'bad',time).ok,false);
});
