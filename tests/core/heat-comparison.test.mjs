import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeatComparisonExperiment} from '../../src/experiments/heat-comparison.ts';
import {createWorkbenchRegistry} from '../../src/equipment/registry.ts';
import {validateSceneDocument} from '../../src/core/scene/validate.ts';
import {serializeScene,parseSceneJson} from '../../src/core/scene/transfer.ts';
import {equipmentSupport,equipmentAvailability} from '../../src/equipment/support.ts';
import {heatComparisonRig,heatInitial,advanceHeatComparison,heatReading,heatTimeTo,heatMassUpdate,heatControlWarnings,heatPlacementParameters} from '../../src/equipment/heatComparison/simulate.ts';
import {buildHeatComparisonReading,heatComparisonRows} from '../../src/equipment/heatComparison/measure.ts';
import {displayMeasurement,measurementInputInSI} from '../../src/core/measurements/display.ts';
import {measurementsCsv} from '../../src/core/measurements/csv.ts';
import {correctManualMeasurement} from '../../src/core/measurements/records.ts';
const time='2026-11-23T00:00:00.000Z',registry=createWorkbenchRegistry(),make=()=>createHeatComparisonExperiment('heat.test',time),near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const run=(scene=make(),protocol='same-time',dt=42)=>{const rig=heatComparisonRig(scene),initial={...heatInitial(rig),active:{water:true,oil:true}};return {rig,state:advanceHeatComparison(initial,rig,protocol,10,dt)};};
const inputs={group:'第1组',note:'观察',waterMass:'100',waterTime:'42',waterInitial:'20',waterTemperature:'30',oilMass:'100',oilTime:'42',oilInitial:'20',oilTemperature:'41'};
const capture=(scene=make(),input=inputs,protocol='same-time')=>{const {rig,state}=run(scene,protocol);return buildHeatComparisonReading(scene,registry,state,JSON.stringify([rig.signature,protocol,10]),'series',protocol,10,input,'heat.sample',time);};
const withCapture=(scene,b)=>({...scene,measurementRecords:b.records,measurementSnapshots:[b.snapshot]});

test('heat comparison reuses five types, 10 items, teacher pending, SI JSON round trip and equipment limits',()=>{
 const scene=make();assert.equal(scene.equipment.length,10);assert.equal(new Set(scene.equipment.map(i=>i.type)).size,5);assert.equal(validateSceneDocument(scene,registry).ok,true);assert.equal(equipmentSupport(scene).key,'heatComparison');assert.equal(scene.curriculumRef.textbookMappings[0].status,'pending_teacher_review');assert.deepEqual(parseSceneJson(serializeScene(scene,registry),registry).document,scene);
 for(const type of new Set(scene.equipment.map(i=>i.type)))assert.equal(equipmentAvailability(scene,type).enabled,false);assert.equal(equipmentAvailability(scene,'thermal.melting-tube').enabled,false);
});
test('independent 42 s at 100 W: 4200 J each; water rises 10 K, oil 21 K; equal mass has different volume',()=>{
 const {rig,state}=run();near(rig.channels.water.config.massKg,.1);near(rig.channels.oil.config.massKg,.1);near(rig.channels.oil.beaker.parameters.liquidM3,1/9000);near(state.samples.water.temperatureK,303.15);near(state.samples.oil.temperatureK,314.15);for(const k of ['water','oil']){near(state.samples[k].energyInJ,4200);near(state.samples[k].lossJ,0);near(state.samples[k].heatSeconds,42);}assert.equal(heatReading(rig,state,'oil').valueK,314.15);
});
test('same 10 K rise independently stops oil at 20 s/2000 J and water at 42 s/4200 J',()=>{
 const {rig,state}=run(make(),'same-rise',100);near(heatTimeTo(rig.channels.water.config,293.15,303.15),42);near(state.timeS,42);near(state.samples.oil.heatSeconds,20);near(state.samples.water.heatSeconds,42);near(state.samples.oil.energyInJ,2000);for(const k of ['water','oil']){near(state.samples[k].temperatureK,303.15);assert.equal(state.active[k],false);}
});
test('exact heat loss solution is partition independent, energy balanced, and heater-off cools',()=>{
 const scene=make();for(const h of scene.equipment.filter(i=>i.type==='thermal.heater'))h.parameters.lossWPerK=1;
 const rig=heatComparisonRig(scene),initial={...heatInitial(rig),active:{water:true,oil:true}},one=advanceHeatComparison(initial,rig,'same-time',10,42);let many=initial;for(let i=0;i<420;i++)many=advanceHeatComparison(many,rig,'same-time',10,.1);
 for(const k of ['water','oil']){const c=rig.channels[k].config,expected=293.15+100*(1-Math.exp(-42/(.1*c.c)));near(one.samples[k].temperatureK,expected);near(many.samples[k].temperatureK,expected);near(one.samples[k].energyInJ-one.samples[k].lossJ,.1*c.c*(expected-293.15));}
 const cool=advanceHeatComparison({...one,active:{water:false,oil:false}},rig,'same-time',10,10);assert.ok(cool.samples.water.temperatureK<one.samples.water.temperatureK);near(cool.samples.water.heatSeconds,42);
});
test('lifting immersion coil stops own heating, thermometer air/bottom/wall and missing timer reject readings',()=>{
 const scene=make();scene.equipment.find(i=>i.id==='water-heater').pose.yM+=.2;const {rig,state}=run(scene);assert.equal(rig.ok,true);assert.equal(rig.channels.water.contact,false);near(state.samples.water.temperatureK,293.15);near(state.samples.water.heatSeconds,0);near(state.samples.oil.heatSeconds,42);assert.ok(heatControlWarnings(rig).length);
 for(const [x,y]of [[-.238,.5],[-.238,.22],[-.18,.238]]){const altered=make();Object.assign(altered.equipment.find(i=>i.id==='water-thermometer').pose,{xM:x,yM:y});const r=heatComparisonRig(altered);assert.equal(heatReading(r,heatInitial(r),'water').ok,false);}
 const altered=make();altered.equipment=altered.equipment.filter(i=>i.id!=='water-timer');const r=heatComparisonRig(altered);assert.equal(heatReading(r,heatInitial(r),'water').ok,false);
});
test('80 C common stop, 3600 s cap, zero power and invalid models never fabricate heating',()=>{
 const {state}=run(make(),'same-time',10000);near(state.timeS,120);near(state.samples.oil.temperatureK,353.15);near(state.samples.water.temperatureK,293.15+120/4.2);assert.deepEqual(state.active,{water:false,oil:false});
 const scene=make();for(const h of scene.equipment.filter(i=>i.type==='thermal.heater'))h.parameters.powerW=0;const cold=run(scene,'same-time',10000);near(cold.state.timeS,3600);near(cold.state.samples.water.temperatureK,293.15);assert.ok(heatControlWarnings(cold.rig).some(s=>s.includes('功率')));
 for(const mutate of [s=>s.equipment[1].parameters.liquidM3=0,s=>s.equipment[2].parameters.powerW=-1,s=>s.equipment[6].parameters.liquidCode='水',s=>s.simulationConfig.randomError.enabled=true]){const s=make();mutate(s);const r=heatComparisonRig(s);assert.equal(r.ok,false);assert.equal(heatReading(r,heatInitial(r),'water').ok,false);assert.throws(()=>advanceHeatComparison(heatInitial(r),r,'same-time',10,1));}
 const r=heatComparisonRig(make());assert.throws(()=>advanceHeatComparison({...heatInitial(r),timeS:NaN},r,'same-time',10,1));assert.throws(()=>advanceHeatComparison(heatInitial(r),r,'same-time',10,-1));
});
test('mass helper preserves density, placement restores missing sample and signatures distinguish controls from poses',()=>{
 const scene=make(),rig=heatComparisonRig(scene),b=scene.equipment.find(i=>i.id==='oil-beaker'),changed=heatMassUpdate(b,.2);near(changed.parameters.liquidM3,.2/900);assert.equal(changed.parameters.liquidCode,'食用油');scene.equipment[3].pose.yM+=.1;assert.equal(heatComparisonRig(scene).signature,rig.signature);scene.equipment[6]=changed;assert.notEqual(heatComparisonRig(scene).signature,rig.signature);
 const missing={...make(),equipment:make().equipment.filter(i=>i.id!=='water-beaker')};const params=heatPlacementParameters(missing,b.type,registry.get(b.type,1).defaultParameters);assert.equal(params.liquidCode,'水');near(params.liquidM3,.0001);
});
test('manual mass/time/temperature records, missing values, immutable source, correction and unit/CSV round trip',()=>{
 const scene=make(),b=capture(scene);assert.equal(b.ok,true);assert.equal(b.records.length,8);let saved=withCapture(scene,b);const row=heatComparisonRows(saved)[0];assert.equal(row.comparable,true);near(row.values[0].riseK,10);near(row.values[1].riseK,21);assert.equal(displayMeasurement(b.records[0]).unit,'g');assert.equal(displayMeasurement(b.records[0]).value,100);assert.equal(measurementInputInSI(b.records[0],'110'),'0.11');assert.ok(measurementsCsv(saved).includes('℃'));
 saved.equipment[2].parameters.powerW=0;assert.equal(heatComparisonRows(saved)[0].comparable,true);near(saved.measurementSnapshots[0].equipment[2].parameters.powerW,100);
 const corrected=correctManualMeasurement(saved,registry,b.records[7].id,'315.15',time);assert.equal(corrected.ok,true);saved=corrected.document;near(heatComparisonRows(saved)[0].values[1].temperatureC,42);assert.equal(saved.measurementRecords.at(-1).context.originalRawInput,'314.15');
 assert.equal(parseSceneJson(serializeScene(saved,registry),registry).ok,true);
 const blank=capture(make(),{...inputs,waterTemperature:''});assert.equal(blank.ok,true);assert.equal(heatComparisonRows(withCapture(make(),blank))[0].comparable,false);
});
test('mismatched actual conditions cannot be hidden by matching manual numbers; preview/stale signature rejected',()=>{
 const scene=make();scene.equipment.find(i=>i.id==='water-heater').pose.yM+=.2;const b=capture(scene);assert.equal(b.ok,true);assert.equal(heatComparisonRows(withCapture(scene,b))[0].comparable,false);
 const changed=make();changed.equipment.find(i=>i.id==='oil-heater').parameters.powerW=90;const c=capture(changed);assert.equal(c.ok,true);assert.equal(heatComparisonRows(withCapture(changed,c))[0].comparable,false);
 const normal=make(),{rig,state}=run(normal);assert.equal(buildHeatComparisonReading(normal,registry,state,'stale','s','same-time',10,inputs,'id',time).ok,false);assert.equal(buildHeatComparisonReading(normal,registry,state,JSON.stringify([rig.signature,'same-time',10]),'s','same-time',10,inputs,'id',time,true).ok,false);
 const same=capture(make(),{...inputs,oilTime:'20',oilTemperature:'30'},'same-rise');assert.equal(same.ok,true);assert.equal(heatComparisonRows(withCapture(make(),same))[0].comparable,true);
});
