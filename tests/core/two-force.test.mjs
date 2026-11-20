import test from 'node:test';
import assert from 'node:assert/strict';
import { createTwoForceExperiment } from '../../src/experiments/twoForce.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { CART, TRACK } from '../../src/equipment/cart/definitions.ts';
import { WEIGHT } from '../../src/equipment/mechanical/definitions.ts';
import { advanceTwoForce, startTwoForce, twoForceRig, twoForceDynamics, twoForceView, twoForceDrop, twoForceAttachment, twoForceDetached } from '../../src/equipment/twoForce/simulate.ts';
import { buildTwoForceReading, twoForceRows } from '../../src/equipment/twoForce/measure.ts';
import { appendMeasurements, correctManualMeasurement, removeMeasurement } from '../../src/core/measurements/records.ts';
import { measurementsCsv } from '../../src/core/measurements/csv.ts';
import { measurementRows } from '../../src/core/measurements/table.ts';
import { parseSceneJson, serializeScene } from '../../src/core/scene/transfer.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';

const registry=createWorkbenchRegistry(),time='2026-11-20T00:00:00.000Z',create=()=>createTwoForceExperiment('tf.test',time),near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`),item=(s,id)=>s.equipment.find(i=>i.id===id);
function rig(s){const r=twoForceRig(s,registry);assert.equal(r.ok,true,r.code);return r;}
const input={left:'.05',right:'.05',group:'第1组',note:'自行观察',magnitude:'未判断',direction:'未判断',line:'未判断',motion:'未判断'};
function captured(s,run,id='reading',values=input){const result=buildTwoForceReading(s,registry,run,values,id,time);assert.equal(result.ok,true,result.code);const saved=appendMeasurements(s,registry,result.records,result.snapshot,time);assert.equal(saved.ok,true);return saved.document;}

test('legacy hanging-weight labels retain masses and display hook-weight names without changing stored evidence',()=>{
  const s=captured(create(),advanceTwoForce(startTwoForce(rig(create()),'legacy'),.1));
  for(const row of s.measurementRecords){row.context.equipmentLabel=row.context.equipmentLabel.replaceAll('钩码','挂码');row.context.pointLabel=row.context.pointLabel.replaceAll('钩码','挂码');}
  const before=structuredClone(s);
  near(twoForceRows(s)[0].left,.05);near(twoForceRows(s)[0].right,.05);
  assert.equal(measurementRows(s)[0].pointLabel,'左钩码总质量');assert.equal(measurementRows(s)[0].equipmentLabel,'二力平衡·小车与钩码组');
  assert.ok(measurementsCsv(s).includes('左钩码总质量'));assert.deepEqual(s,before);
});

test('existing cart, track and weights form equal stationary forces without adding equipment types',()=>{
  const s=create(),r=rig(s),d=twoForceDynamics(r,r.state);assert.deepEqual([...new Set(s.equipment.map(i=>i.type))],[TRACK,CART,WEIGHT]);assert.equal(s.curriculumRef.textbookMappings[0].status,'pending_teacher_review');assert.equal(s.equipment.length,4);assert.equal(d.ok,true);near(d.tension[0],.4905);near(d.tension[1],.4905);for(const v of d.acceleration)near(v,0);near(d.torque,0);const run=advanceTwoForce(startTwoForce(r,'equal'),2);run.state.forEach((v,i)=>near(v,r.state[i]));near(run.timeS,2);assert.equal(run.reason,'');
});
test('unequal masses have independent coupled acceleration and moving tensions, not both m g',()=>{
  const s=create();item(s,'right').parameters.massKg=.1;const r=rig(s),d=twoForceDynamics(r,r.state);near(d.acceleration[0],.981);near(d.tension[0],.53955);near(d.tension[1],.8829);near(d.net.x,.34335);near(d.torque,0);near(d.net.x/r.bodyMass,d.acceleration[0]);const run=advanceTwoForce(startTwoForce(r,'unequal'),.5);near(run.state[0],.122625,1e-8);near(run.state[3],.4905,1e-8);const moved=twoForceDynamics(r,run.state);near(moved.heights[0],.127375,1e-8);near(moved.heights[1],.372625,1e-8);
});
test('equal opposite non-collinear pulls have zero net force but real restoring torque and angular motion',()=>{
  const s=create();item(s,'cart').pose.rotationRad=Math.PI/6;const r=rig(s),d=twoForceDynamics(r,r.state);near(d.net.x,0);near(d.net.y,0);near(d.tension[0],d.tension[1]);assert.ok(d.torque<-.01);assert.ok(d.acceleration[2]<-1);near(d.torque/r.inertia,d.acceleration[2],1e-8);const run=advanceTwoForce(startTwoForce(r,'twisted'),.1);assert.ok(run.state[2]<Math.PI/6-.001);assert.ok(run.state[5]<0);near(run.state[0],0,1e-8);near(run.state[1],0,1e-8);
});
test('balanced initial velocity stays uniform; direction offsets accelerate; two-second twist conserves energy',()=>{
  const s=create();item(s,'cart').parameters.twoForceSpeedMPerS=.1;const r=rig(s),run=advanceTwoForce(startTwoForce(r,'uniform'),1);near(run.state[0],.1,1e-8);near(run.state[3],.1,1e-8);near(run.state[2],0);const offset=create();item(offset,'cart').pose.yM+=.08;const rr=rig(offset),dd=twoForceDynamics(rr,rr.state);assert.ok(dd.net.y<0);assert.ok(dd.acceleration[1]<0);
  const twist=create();item(twist,'cart').pose.rotationRad=Math.PI/6;const tr=rig(twist),initial=twoForceDynamics(tr,tr.state).energy,observed=advanceTwoForce(startTwoForce(tr,'energy'),2),end=twoForceDynamics(tr,observed.state);assert.equal(observed.reason,'');near(end.energy,initial,1e-7);assert.ok(Math.abs(observed.state[2])>.01);near(tr.bodyMass*end.acceleration[0],end.net.x,1e-8);near(tr.inertia*end.acceleration[2],end.torque,1e-8);
});
test('first boundary is located before crossing; invalid setups and time steps cannot continue normally',()=>{
  const s=create();item(s,'right').parameters.massKg=.1;const r=rig(s),run=advanceTwoForce(startTwoForce(r,'limit'),3);assert.ok(['TF_DROP_LIMIT','TF_BOUNDARY'].includes(run.reason));near(run.timeS,Math.sqrt(.4/.981),1e-6);near(run.state[0],.2,1e-7);assert.equal(advanceTwoForce(run,1),run);const equal=advanceTwoForce(startTwoForce(rig(create()),'time'),8);assert.equal(equal.reason,'TF_TIME_LIMIT');near(equal.timeS,8);assert.throws(()=>advanceTwoForce(equal,NaN),/TF_TIME_STEP/);
  for(const change of [s=>item(s,'cart').parameters.twoForceTableId='',s=>item(s,'left').parameters.twoForceSide='right',s=>item(s,'table').pose.rotationRad=.1,s=>item(s,'left').parameters.parentWeightId='right',s=>item(s,'left').parameters.massKg=1.1,s=>s.simulationConfig.randomError.enabled=true,s=>item(s,'cart').pose.rotationRad=Math.PI/2,s=>s.equipment.push({...structuredClone(item(s,'cart')),id:'extra'})]){const bad=create();change(bad);assert.equal(twoForceRig(bad,registry).ok,false);}
});
test('cart and weight dropping, side reassignment and atomic detach respect actual references',()=>{
  const s=create(),free={...structuredClone(item(s,'left')),id:'extra',parameters:{...item(s,'left').parameters,twoForceTableId:'',twoForceSide:''}};s.equipment.push(free);const attached=twoForceAttachment(s,free,'left');assert.equal(attached.parentWeightId,'left');Object.assign(free.parameters,attached);assert.equal(rig(s).mass[0],.1);const view=twoForceView(s,rig(s),null);near(item(view,'extra').pose.yM,item(view,'left').pose.yM-.053);const dropped=twoForceDrop(s,free,{xM:.1,yM:.8},view);assert.equal(dropped.parameters.parentWeightId,'');const out=twoForceDrop(s,item(s,'cart'),{xM:3,yM:3},view);assert.equal(out.parameters.twoForceTableId,'');const history=createHistory(s),updates=twoForceDetached(s,['table'],view),removed=executeCommand(history,{type:'remove-equipment-batch',ids:['table'],updates},registry,time);assert.equal(removed.ok,true);assert.equal(item(removed.history.present,'cart').parameters.twoForceTableId,'');assert.equal(twoForceRig(travelHistory(removed.history,'undo',registry,time).history.present,registry).ok,true);
});
test('manual conditions, missing mass, source snapshots, corrections and CSV survive setup changes and reload',()=>{
  let s=create();const r=rig(s),run=advanceTwoForce(startTwoForce(r,'source'),.1);s=captured(s,run);const before=structuredClone(s.measurementSnapshots[0]);const malformed=structuredClone(s);malformed.measurementSnapshots[0].note=JSON.stringify({kind:'two-force',conditions:{},t:.1});assert.deepEqual(twoForceRows(malformed),[]);assert.equal(twoForceRows(s)[0].conditions[0],'未判断');s=correctManualMeasurement(s,registry,'reading.0','.06',time).document;near(twoForceRows(s)[0].left,.06);assert.deepEqual(s.measurementSnapshots[0],before);item(s,'right').parameters.massKg=.1;near(twoForceRows(s)[0].right,.05);const csv=measurementsCsv(s);assert.ok(csv.includes('二力平衡'));assert.ok(csv.includes('未判断'));assert.ok(csv.includes('"kg",0.06'));assert.deepEqual(parseSceneJson(serializeScene(s,registry),registry).document,s);s=removeMeasurement(s,registry,'reading.0',time).document;assert.equal(twoForceRows(s)[0].left,null);
  const missing=captured(create(),run,'missing',{...input,left:''});assert.equal(twoForceRows(missing)[0].left,null);assert.equal(buildTwoForceReading(create(),registry,run,{...input,left:'bad'},'bad',time).ok,false);assert.equal(buildTwoForceReading(create(),registry,run,input,'bad',time,true).code,'TF_PREVIEW');assert.equal(buildTwoForceReading(create(),registry,run,input,'bad',time,false,true).code,'TF_RECORD');const changed=create();item(changed,'right').parameters.massKg=.1;assert.equal(buildTwoForceReading(changed,registry,run,input,'bad',time).ok,false);
});
