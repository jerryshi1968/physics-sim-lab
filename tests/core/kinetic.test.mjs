import test from 'node:test';
import assert from 'node:assert/strict';
import { createKineticExperiment } from '../../src/experiments/kinetic.ts';
import { kineticRig, kineticState, advanceKinetic, kineticBallPoint, kineticDrop, kineticRuler, kineticView } from '../../src/equipment/kinetic/simulate.ts';
import { buildKineticReading, kineticRows, kineticControlStatus } from '../../src/equipment/kinetic/measure.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { equipmentAvailability } from '../../src/equipment/support.ts';
import { appendMeasurements, correctManualMeasurement, removeMeasurement } from '../../src/core/measurements/records.ts';
import { measurementsCsv } from '../../src/core/measurements/csv.ts';
import { serializeScene, parseSceneJson } from '../../src/core/scene/transfer.ts';
import { createProjectileExperiment } from '../../src/experiments/projectile.ts';
const time='2026-11-22T00:00:00.000Z',registry=createWorkbenchRegistry(),create=()=>createKineticExperiment('kinetic.test',time),item=(s,id)=>s.equipment.find(i=>i.id===id),near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
function rig(s){const r=kineticRig(s);assert.equal(r.ok,true,r.message);return r;}
function run(s){const r=rig(s);return advanceKinetic({id:'run',signature:r.signature,rig:r,timeS:0},100);}
function height(s,h){item(s,'ball').pose={...item(s,'ball').pose,...kineticBallPoint(item(s,'ramp'),h)};}
const input={group:'第1组',comparison:'比较速度（质量相同）',mass:'50',height:'15',start:'10',end:'25.4',rulerId:'ruler',note:'自行观察'};
test('six instances reuse five existing apparatus types and preserve projectile defaults and pending review',()=>{
 const s=create();assert.equal(s.equipment.length,6);assert.equal(new Set(s.equipment.map(i=>i.type)).size,5);assert.equal(s.curriculumRef.textbookMappings[0].status,'pending_teacher_review');assert.equal(equipmentAvailability(s,'mechanical.cart').enabled,false);assert.deepEqual(parseSceneJson(serializeScene(s,registry),registry).document,s);
 const old=createProjectileExperiment('old',time);assert.equal(Object.hasOwn(old.equipment.find(i=>i.type==='mechanical.projectile-ball').parameters,'massKg'),false);assert.deepEqual(parseSceneJson(serializeScene(old,registry),registry).document,old);
});
test('rolling energy, collision effective momentum and dissipative stopping match independent hand values',()=>{
 const r=rig(create());near(r.height,.15);near(r.speed**2,10*9.81*.15/7);near(.7*r.m*r.speed**2,r.m*r.g*.15);near((1.4*r.m+r.M)*r.commonSpeed,1.4*r.m*r.speed);near(r.distance,.15441176470588233);near(r.mu*r.M*r.g*r.distance,.5*(1.4*r.m+r.M)*r.commonSpeed**2);assert.ok(.5*(1.4*r.m+r.M)*r.commonSpeed**2<r.m*r.g*r.height);
 for(const fraction of [.25,.5,.75]){const state=kineticState(r,r.rampTime*fraction),h=state.ball.yM-r.track.pose.yM-.025;near(.7*r.m*state.speed**2+r.m*r.g*h,r.m*r.g*r.height);}
 const end=kineticState(r,r.endTime);near(end.displacement,r.distance);near(end.speed,0);assert.equal(end.phase,'木块停止');
});
test('same mass and doubled height doubles displacement; same height doubles mass with unchanged impact speed',()=>{
 const s=create(),base=rig(s);height(s,.3);const higher=rig(s);near(higher.distance,2*base.distance);near(higher.speed/base.speed,Math.sqrt(2));height(s,.15);item(s,'ball').parameters.massKg=.1;const heavy=rig(s);near(heavy.speed,base.speed);near(heavy.distance,.4375);assert.ok(heavy.distance>base.distance);item(s,'surface').parameters.kineticCoefficient=.4;near(rig(s).distance,heavy.distance/2);
});
test('ramp, coast and collision join continuously; run caps at stopping and cannot advance invalid time',()=>{
 const s=create(),r=rig(s),eps=1e-8;for(const t of [r.rampTime,r.hitTime]){const a=kineticState(r,t-eps),b=kineticState(r,t+eps);near(a.ball.xM,b.ball.xM,1e-6);near(a.ball.yM,b.ball.yM,1e-6);near(a.displacement,b.displacement,1e-6);}const completed=run(s);near(completed.timeS,r.endTime);near(advanceKinetic(completed,1).timeS,r.endTime);assert.throws(()=>advanceKinetic(completed,NaN));const view=kineticView(s,completed);near(item(view,'block').pose.xM,item(s,'block').pose.xM+r.distance);near(item(s,'block').pose.xM,.13);
});
test('overrun stops at the actual contact surface edge and never supplies a normal capture',()=>{
 const s=create();item(s,'ball').parameters.massKg=.5;height(s,.4);const r=rig(s),end=run(s),state=kineticState(r,end.timeS);assert.equal(r.boundary,true);assert.equal(state.phase,'到达接触面边界');assert.ok(state.speed>0);near(item(s,'block').pose.xM+state.displacement+r.width/2,item(s,'surface').pose.xM+1.2-.005);assert.equal(buildKineticReading(s,end,input,'bad',time).ok,false);
});
test('misalignment, wrong apparatus, random error and unphysical loads are explicit invalid rigs; drag reattaches',()=>{
 for(const change of [s=>item(s,'ball').parameters.massKg=0,s=>item(s,'block').parameters.massKg=.01,s=>item(s,'surface').parameters.kineticCoefficient=0,s=>item(s,'surface').pose.yM=.1,s=>item(s,'ramp').pose.rotationRad=.1,s=>item(s,'ball').parameters.launcherId='launcher',s=>item(s,'ball').pose.xM+=.1,s=>s.simulationConfig.randomError.enabled=true,s=>s.equipment=s.equipment.filter(i=>i.id!=='block')]){const s=create();change(s);assert.equal(kineticRig(s).ok,false);}
 const s=create(),ball=item(s,'ball'),drop=kineticDrop(s,ball,{xM:-.9,yM:.325});Object.assign(ball,drop);near(rig(s).height,.3);const block=item(s,'block');Object.assign(block,kineticDrop(s,block,{xM:.2,yM:.6}));assert.equal(rig(s).ok,true);assert.equal(kineticRuler(s,rig(s),'height-ruler'),null);
});
test('manual SI snapshots, missing readings, correction-derived displacement, CSV and reload retain evidence',()=>{
 let s=create(),completed=run(s),built=buildKineticReading(s,completed,input,'sample',time);assert.equal(built.ok,true,built.message);s=appendMeasurements(s,registry,built.records,built.snapshot,time).document;near(kineticRows(s)[0].distance,.154);near(s.measurementRecords[0].value,.05);const before=structuredClone(s.measurementSnapshots);s=correctManualMeasurement(s,registry,'sample.end','.26',time).document;near(kineticRows(s)[0].distance,.16);assert.deepEqual(s.measurementSnapshots,before);item(s,'ball').parameters.massKg=.1;near(kineticRows(s)[0].mass,.05);assert.ok(measurementsCsv(s).includes('木块终点'));assert.ok(measurementsCsv(s).includes('"cm",26'));assert.deepEqual(parseSceneJson(serializeScene(s,registry),registry).document,s);s=removeMeasurement(s,registry,'sample.end',time).document;assert.equal(kineticRows(s)[0].distance,null);
 const blank=buildKineticReading(create(),completed,{...input,end:''},'missing',time);assert.equal(blank.ok,true);assert.equal(blank.records[3].value,null);assert.equal(buildKineticReading(create(),completed,{...input,end:'bad'},'bad',time).ok,false);assert.equal(buildKineticReading(create(),completed,{...input,start:'50',end:'10'},'bad',time).ok,false);assert.equal(buildKineticReading(create(),completed,input,'bad',time,true).ok,false);assert.equal(buildKineticReading(create(),null,input,'bad',time).ok,false);
});
test('control comparisons use frozen physical settings, flag changed block or uncontrolled mass, and reject damaged dimensions',()=>{
 let s=create();const capture=(id)=>{const built=buildKineticReading(s,run(s),input,id,time);assert.equal(built.ok,true,built.message);const saved=appendMeasurements(s,registry,built.records,built.snapshot,time);assert.equal(saved.ok,true);s=saved.document;};
 capture('a');height(s,.3);capture('b');assert.equal(kineticControlStatus(kineticRows(s),1),'控制条件一致');item(s,'ball').parameters.massKg=.1;capture('c');assert.equal(kineticControlStatus(kineticRows(s),2),'应保持的质量或高度已改变');item(s,'block').parameters.massKg=.2;capture('d');assert.equal(kineticControlStatus(kineticRows(s),3),'木块、接触面或起点已改变');
 for(const change of [s=>item(s,'surface').parameters.lengthM=NaN,s=>item(s,'block').parameters.heightM=.02,s=>item(s,'block').parameters.widthM=NaN,s=>s.simulationConfig.gravityMPerS2=1e-8]){const bad=create();change(bad);assert.equal(kineticRig(bad).ok,false);}
});
