import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { createProjectileExperiment } from '../../src/experiments/projectile.ts';
import { compileProjectile,beginProjectileFlight,projectileAt,advanceProjectile,projectileMarks,projectileRuler,projectileView,projectileDrop,projectileIdentity } from '../../src/equipment/projectile/simulate.ts';
import { buildProjectileMeasurements,projectileProfiles,projectileFits } from '../../src/equipment/projectile/measure.ts';
import { createHistory,executeCommand,travelHistory } from '../../src/core/workbench/history.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { parseSceneJson,serializeScene } from '../../src/core/scene/transfer.ts';
import { measurementsCsv } from '../../src/core/measurements/csv.ts';
import { linearFit } from '../../src/core/measurements/fit.ts';
import { isMechanicalScene } from '../../src/equipment/mechanical/simulate.ts';
const registry=createWorkbenchRegistry(),time='2026-11-05T03:00:00.000Z',kit=()=>createProjectileExperiment('projectile-test',time);
const item=(scene,id)=>scene.equipment.find(item=>item.id===id),near=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
function begin(scene=kit(),id='run-1'){const result=beginProjectileFlight(scene,registry,id);assert.equal(result.ok,true,result.code);return result.flight;}
function at(flight,t){const result=projectileAt(flight,t);assert.equal(result.ok,true,result.code);return result.flight;}
const input=(t,x,y)=>({rulerId:'scale',timeRaw:String(t),originXRaw:'.1',ballXRaw:String(.1+x),originYRaw:'.05',ballYRaw:String(.05+y),groundYRaw:'1.3',setupLabel:'平抛对照',note:'独立手工示例'});
function capture(history,flight,entry,id){const built=buildProjectileMeasurements(history.present,registry,flight,entry,id,time);assert.equal(built.ok,true,built.code);const result=executeCommand(history,{type:'record-measurements',records:built.records,snapshot:built.snapshot},registry,time);assert.equal(result.ok,true,JSON.stringify(result.diagnostics));return result.history;}

test('formal senior projectile template, blank scene, apparatus and pending teacher mapping remain valid format 2',()=>{
  const scene=kit(),blank=createProjectileExperiment('projectile-blank',time,true);assert.equal(validateSceneDocument(scene,registry).ok,true);assert.equal(isMechanicalScene(blank),true);assert.equal(blank.equipment.length,0);assert.equal(scene.equipment.length,5);assert.equal(scene.curriculumRef.stage,'senior');assert.equal(scene.curriculumRef.textbookMappings[0].status,'pending_teacher_review');assert.equal(scene.curriculumRef.textbookMappings[0].chapter,null);assert.equal(scene.measurementRecords.length,0);
});
for(const[t,x,drop]of[[.1,.2,.05],[.2,.4,.2],[.3,.6,.45]])test(`formal launch at ${t} s has independent x=${x} m, downward displacement=${drop} m and conserved energy`,()=>{
  const flight=at(begin(),t),p=flight.point;near(p.timeS,t);near(p.horizontalDisplacementM,x);near(p.dropM,drop);near(p.yM,1.25-drop);near(p.vxMPerS,2);near(p.vyMPerS,-10*t);near((.5*(p.vxMPerS**2+p.vyMPerS**2)+10*p.yM)/14.5,1);assert.equal(p.state,'flying');
});
test('a display frame beyond impact clamps exactly to 0.5 s and 1 m without penetration or normal post-impact motion',()=>{
  const flight=at(begin(),.73);assert.equal(flight.point.timeS,.5);assert.equal(flight.point.yM,0);assert.equal(flight.point.rangeM,1);assert.equal(flight.point.state,'landed');assert.deepEqual(at(flight,10).point,flight.point);assert.equal(projectileAt(flight,-1).ok,false);assert.equal(advanceProjectile(flight,NaN).ok,false);
});
test('30 and 60 FPS elapsed-time schedules share timer, positions, equal marks and exact impact independently of frame count',()=>{
  const outcomes=[];
  for(const fps of[30,60]){let flight=begin();for(let n=0;n<fps*.3;n++){const result=advanceProjectile(flight,1/fps);assert.equal(result.ok,true);flight=result.flight;}near(flight.point.timeS,.3);near(flight.point.horizontalDisplacementM,.6);near(flight.point.dropM,.45);const marks=projectileMarks(flight);assert.equal(marks.length,4);near(marks[3].timeS,.3);near(marks[3].xM,.6);outcomes.push(flight.point);flight=at(flight,.5+1/fps);assert.equal(flight.point.timeS,.5);assert.equal(flight.point.yM,0);}
  near(outcomes[0].xM,outcomes[1].xM);near(outcomes[0].dropM,outcomes[1].dropM);
});
test('paused samples do not evolve, resume advances from the same state and repeated launch copies fresh parameters',()=>{
  const scene=kit(),first=at(begin(scene),.2),frozen=structuredClone(first.point);assert.deepEqual(first.point,frozen);item(scene,'launcher').parameters.speedMPerS=4;item(scene,'launcher').pose.yM=2.5;
  const resumed=advanceProjectile(first,.1);assert.equal(resumed.ok,true);near(resumed.flight.point.xM,.6);near(resumed.flight.point.dropM,.45);assert.equal(first.rig.initial.speedMPerS,2);assert.equal(first.rig.initial.y0M,1.25);
  const second=begin(scene,'run-2');assert.equal(second.point.timeS,0);assert.equal(second.rig.initial.speedMPerS,4);near(second.rig.model.impactTimeS,.7071067811865476);near(at(second,.2).point.horizontalDisplacementM,.8);assert.deepEqual(first.point,frozen);
});
test('speed and height controls give independent contrasts; zero speed is a real free-fall control and translations preserve displacements',()=>{
  const equivalent=kit();item(equivalent,'launcher').pose.rotationRad=2*Math.PI;assert.equal(compileProjectile(equivalent,registry).ok,true);
  const scene=kit();item(scene,'launcher').parameters.speedMPerS=0;near(at(begin(scene),.3).point.horizontalDisplacementM,0);near(at(begin(scene),.3).point.dropM,.45);
  item(scene,'launcher').parameters.speedMPerS=4;near(at(begin(scene),1).point.rangeM,2);near(at(begin(scene),1).point.timeS,.5);
  item(scene,'launcher').parameters.speedMPerS=2;item(scene,'launcher').pose.yM=2.5;near(at(begin(scene),1).point.timeS,.7071067811865476);near(at(begin(scene),1).point.rangeM,1.4142135623730951);
  item(scene,'launcher').pose.xM+=3;item(scene,'launcher').pose.yM+=4;item(scene,'ground').pose.yM+=4;const shifted=at(begin(scene),.2);near(shifted.point.xM,3.4);near(shifted.point.dropM,.2);
});
test('nonhorizontal, below-ground, absent apparatus, invalid gravity, unknown domain and excessive ranges never launch normal readings',()=>{
  for(const[change,code]of[[s=>item(s,'launcher').pose.rotationRad=.1,'NON_HORIZONTAL_LAUNCH'],[s=>item(s,'launcher').pose.yM=0,'INVALID_LAUNCH_PARAMETERS'],[s=>item(s,'ball').parameters.launcherId='','PROJECTILE_BALL_ATTACHMENT'],[s=>s.equipment=s.equipment.filter(item=>item.id!=='timer'),'PROJECTILE_APPARATUS'],[s=>s.simulationConfig.gravityMPerS2=0,'PROJECTILE_DOCUMENT'],[s=>item(s,'launcher').pose.yM=11,'PROJECTILE_RANGE'],[s=>{item(s,'timer').parameters.intervalS=.001;item(s,'timer').parameters.resolutionS=.0001;s.simulationConfig.gravityMPerS2=.01;},'PROJECTILE_RANGE']]){const scene=kit();change(scene);const result=compileProjectile(scene,registry);assert.equal(result.ok,false);assert.equal(result.code,code);assert.equal(result.model,undefined);}
});
test('ball drag attaches at the real muzzle, view movement never writes source poses, and deleting a run apparatus invalidates identity',()=>{
  const scene=kit(),saved=structuredClone(scene),drop=projectileDrop(scene,item(scene,'ball'),{xM:.05,yM:1.25});assert.equal(drop.parameters.launcherId,'launcher');assert.deepEqual(scene,saved);assert.equal(projectileDrop(scene,item(scene,'ball'),{xM:2,yM:1}).parameters.launcherId,'');
  const flight=at(begin(scene),.3),view=projectileView(scene,flight);near(item(view,'ball').pose.xM,.6);assert.deepEqual(scene,saved);scene.equipment=scene.equipment.filter(item=>item.id!=='launcher');assert.equal(projectileIdentity(scene,flight),false);
});
test('ruler zero translation cancels in both measured displacements; tilt and uncovered points reject metrology without altering flight',()=>{
  const initial=begin(),calibration=projectileRuler(initial.initialScene,initial,'scale');assert.equal(calibration.ok,true);near(calibration.groundM-calibration.origin.yM,1.25);assert.equal(buildProjectileMeasurements(initial.initialScene,registry,initial,input(0,0,0),'unlaunched',time).ok,false);
  const scene=kit(),flight=at(begin(scene),.2);let read=projectileRuler(scene,flight,'scale');assert.equal(read.ok,true);near(read.origin.xM,.1);near(read.origin.yM,.05);near(read.ball.xM,.5);near(read.ball.yM,.25);
  item(scene,'scale').pose.xM-=.2;item(scene,'scale').pose.yM+=.1;read=projectileRuler(scene,flight,'scale');near(read.ball.xM-read.origin.xM,.4);near(read.ball.yM-read.origin.yM,.2);item(scene,'scale').pose.rotationRad=.01;assert.equal(projectileRuler(scene,flight,'scale').ok,false);item(scene,'scale').pose.rotationRad=0;item(scene,'scale').parameters.widthM=.2;assert.equal(projectileRuler(scene,flight,'scale').code,'PROJECTILE_RULER_RANGE');
});
test('mid-flight source changes remain pending: physical config and initial apparatus freeze, capture state verifies current source, and CSV/JSON preserve both',()=>{
  const scene=kit(),flight=at(begin(scene),.2);item(scene,'launcher').parameters.speedMPerS=4;item(scene,'launcher').pose.yM=2.5;scene.simulationConfig.gravityMPerS2=20;let history=createHistory(scene);history=capture(history,flight,input(.2,.4,.2),'frozen');
  const snapshot=history.present.measurementSnapshots[0];assert.equal(snapshot.modelConfigSnapshot.gravityMPerS2,10);assert.equal(snapshot.captureState.modelConfigSnapshot.gravityMPerS2,20);assert.equal(item({equipment:snapshot.equipment},'launcher').parameters.speedMPerS,2);assert.equal(item({equipment:snapshot.captureState.equipment},'launcher').parameters.speedMPerS,4);assert.equal(history.present.measurementRecords[0].modelConfigSnapshot.gravityMPerS2,10);
  const parsed=parseSceneJson(serializeScene(history.present,registry),registry);assert.equal(parsed.ok,true);assert.deepEqual(parsed.document.measurementSnapshots,history.present.measurementSnapshots);assert.ok(measurementsCsv(history.present).includes('采样时待发装置快照'));
});
test('frozen-capture safeguards reject stale source, future launch revisions, wrong model tags and invalid nested initial apparatus',()=>{
  const scene=kit(),flight=at(begin(scene),.1);item(scene,'launcher').parameters.speedMPerS=4;const built=buildProjectileMeasurements(scene,registry,flight,input(.1,.2,.05),'guard',time);assert.equal(built.ok,true);
  const stale=structuredClone(built.snapshot);delete stale.captureState;const failed=executeCommand(createHistory(scene),{type:'record-measurements',records:built.records,snapshot:stale},registry,time);assert.equal(failed.ok,false);assert.equal(failed.diagnostics[0].code,'STALE_MEASUREMENT');
  let valid=capture(createHistory(scene),flight,input(.1,.2,.05),'valid').present;
  for(const mutate of[s=>s.measurementSnapshots[0].captureState.launchRevision=999,s=>s.measurementSnapshots[0].modelVersion='electrical.fake.v1',s=>s.measurementSnapshots[0].equipment=[],s=>s.measurementSnapshots[0].captureState.equipment[0].parameters.unknown='x']){const broken=structuredClone(valid);mutate(broken);assert.equal(parseSceneJson(JSON.stringify(broken),registry).ok,false);}
});
test('manual estimates, blank readings and derived values preserve raw input and never use the true trajectory as student data',()=>{
  const scene=kit(),flight=at(begin(scene),.1);const built=buildProjectileMeasurements(scene,registry,flight,{...input(.1,.18,.04),ballXRaw:'.28'},'estimate',time);assert.equal(built.ok,true);const dx=built.records.find(row=>row.context.pointLabel==='水平位移');assert.equal(dx.value,.18);near(dx.context.physicalValue,.2);assert.equal(built.records[2].rawInput,'.28');
  const short=structuredClone(scene);item(short,'scale').parameters.heightM=.5;const unreadable=buildProjectileMeasurements(short,registry,flight,input(.1,.2,.05),'short-height',time);assert.equal(unreadable.ok,true);assert.equal(unreadable.records.find(row=>row.context.pointLabel==='发射高度').measurementStatus,'out-of-model');assert.equal(unreadable.records.find(row=>row.context.pointLabel==='发射高度').value,null);
  const missing=buildProjectileMeasurements(scene,registry,flight,{...input(.1,.2,.05),ballYRaw:'',timeRaw:''},'missing',time);assert.equal(missing.ok,true);assert.equal(missing.records.find(row=>row.context.pointLabel==='向下位移').value,null);assert.equal(missing.records[0].value,null);assert.equal(buildProjectileMeasurements(scene,registry,flight,{...input(.1,.2,.05),timeRaw:'=1'},'bad',time).ok,false);assert.equal(buildProjectileMeasurements(scene,registry,flight,input(.1,.2,.05),'moving',time,true).ok,false);
});
test('three pre-impact groups plus exact landing record fit x-t=2 m/s and ydrop-t²=5 m/s² using frozen snapshots and record history',()=>{
  let history=createHistory(kit());const initial=begin(history.present);
  for(const[index,t,x,y]of[[0,.1,.2,.05],[1,.2,.4,.2],[2,.3,.6,.45],[3,.5,1,1.25]])history=capture(history,at(initial,t),input(t,x,y),`point-${index}`);
  assert.equal(history.present.measurementRecords.length,38);assert.equal(history.present.measurementSnapshots.length,4);assert.equal(history.present.measurementRecords.find(row=>row.context.pointLabel==='发射高度').value,1.25);assert.equal(history.present.measurementRecords.find(row=>row.context.pointLabel==='落地时间').value,.5);assert.equal(history.present.measurementRecords.find(row=>row.context.pointLabel==='射程').value,1);
  near(projectileFits(history.present,projectileProfiles[0])[0].fit.slope,2,1e-6);near(projectileFits(history.present,projectileProfiles[1])[0].fit.slope,5,1e-6);const undo=travelHistory(history,'undo',registry,time);assert.equal(undo.ok,true);assert.equal(undo.history.present.measurementRecords.length,27);assert.equal(parseSceneJson(serializeScene(history.present,registry),registry).ok,true);
});
test('repeated flights remain separate even with the same group label; measured slopes follow estimates rather than hidden speed and g',()=>{
  let history=createHistory(kit());const first=begin(history.present,'flight-one');
  for(const[index,t,x,y]of[[0,.1,.21,.06],[1,.2,.42,.24],[2,.3,.63,.54]])history=capture(history,at(first,t),input(t,x,y),`est-${index}`);
  near(projectileFits(history.present,projectileProfiles[0])[0].fit.slope,2.1,1e-6);near(projectileFits(history.present,projectileProfiles[1])[0].fit.slope,6,1e-6);
  item(history.present,'launcher').parameters.speedMPerS=4;const second=begin(history.present,'flight-two');for(const[index,t,x,y]of[[0,.1,.4,.05],[1,.2,.8,.2],[2,.3,1.2,.45]])history=capture(history,at(second,t),input(t,x,y),`second-${index}`);
  const fits=projectileFits(history.present,projectileProfiles[0]);assert.equal(fits.length,2);near(fits[0].fit.slope,2.1);near(fits[1].fit.slope,4);assert.equal(linearFit([{x:1,y:2},{x:2,y:4},{x:3,y:6}]),null);assert.equal(linearFit([{x:1,y:2},{x:2,y:4},{x:3,y:6}],3).slope,2);
});
