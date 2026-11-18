import test from 'node:test';
import assert from 'node:assert/strict';
import { createLightOrbit,lightOrbitPose,orbitAngleDelta } from '../../src/core/workbench/lightOrbit.ts';
import { lightOrbitForScene } from '../../src/equipment/optical/lightOrbit.ts';
import { createRefractionExperiment } from '../../src/experiments/refraction.ts';
import { createReflectionExperiment } from '../../src/experiments/reflection.ts';
import { simulateRefraction,refractionAim } from '../../src/equipment/refraction/simulate.ts';
import { simulateReflection } from '../../src/equipment/reflection/simulate.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { createHistory,executeCommand,travelHistory } from '../../src/core/workbench/history.ts';
import { EMITTER } from '../../src/equipment/reflection/definitions.ts';
const time='2026-11-17T00:00:00.000Z',registry=createWorkbenchRegistry(),near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`),rad=d=>d*Math.PI/180;
const update=(s,pose)=>({...s,equipment:s.equipment.map(i=>i.type===EMITTER?{...i,pose}:i)});
test('off-center refraction orbit preserves actual hit and distance, updates aim, leaves other tools fixed',()=>{
  const scene=createRefractionExperiment('orbit',time),source=scene.equipment.find(i=>i.type===EMITTER);source.pose.xM+=.12;const before=simulateRefraction(scene,registry),anchor=lightOrbitForScene(scene,'refraction');assert.ok(before.ok&&anchor);near(anchor.center.xM,.12);
  const pose=lightOrbitPose(anchor,Math.PI/2+rad(20)),next=update(scene,pose),after=simulateRefraction(next,registry);assert.equal(after.ok,true);near(after.hit.x,before.hit.x);near(after.hit.y,before.hit.y);near(after.distance,before.distance);near(after.incidenceRad,rad(20));assert.deepEqual(next.equipment.filter(i=>i.type!==EMITTER),scene.equipment.filter(i=>i.type!==EMITTER));
  const right=refractionAim(scene,rad(60),false);near(Math.hypot(right.pose.xM-anchor.center.xM,right.pose.yM-anchor.center.yM),anchor.radiusM);near(simulateRefraction(update(scene,right.pose),registry).hit.x,.12);
});
test('off-center reflection orbit also works with rotated mirror tangent and front half-plane',()=>{
  const original=createReflectionExperiment('reflection-orbit',time),scene=structuredClone(original),rotation=rad(25);
  for(const i of scene.equipment){const x=i.pose.xM,y=i.pose.yM;i.pose.xM=x*Math.cos(rotation)-y*Math.sin(rotation)+.1;i.pose.yM=x*Math.sin(rotation)+y*Math.cos(rotation)-.04;i.pose.rotationRad+=rotation;}
  const source=scene.equipment.find(i=>i.type===EMITTER);source.pose.xM+=.08*Math.cos(rotation);source.pose.yM+=.08*Math.sin(rotation);
  const before=simulateReflection(scene,registry),anchor=lightOrbitForScene(scene,'reflection');assert.ok(before.ok&&anchor);const next=simulateReflection(update(scene,lightOrbitPose(anchor,rotation+rad(135))),registry);assert.equal(next.ok,true);near(next.incidenceRad,rad(45));near(next.hit.x,before.hit.x);near(next.hit.y,before.hit.y);near(next.distance,before.distance);
  const clamped=simulateReflection(update(scene,lightOrbitPose(anchor,rotation+rad(250))),registry);assert.equal(clamped.ok,true);assert.ok(clamped.incidenceRad<Math.PI/2);
});
test('underwater orbit stops at first tank boundary and cannot jump across disconnected valid arcs',()=>{
  const pose={xM:.5*Math.cos(rad(-20)),yM:.5*Math.sin(rad(-20)),rotationRad:rad(160)},anchor=createLightOrbit('light',pose,{xM:0,yM:0},0,false,{left:-.6,right:.6,bottom:-.3,top:-.000001});assert.ok(anchor);
  const at=lightOrbitPose(anchor,rad(-160));near(at.yM,-.3);near(at.xM,.4);assert.ok(at.xM>0);near(Math.hypot(at.xM,at.yM),.5);
});
test('water-to-air angular parameters keep a translated hit, radius and submerged source',()=>{
  let scene=createRefractionExperiment('water-orbit',time);const first=refractionAim(scene,rad(30),true);scene=update(scene,first.pose);scene.equipment.find(i=>i.type===EMITTER).pose.xM+=.12;const before=simulateRefraction(scene,registry),anchor=lightOrbitForScene(scene,'refraction');assert.ok(before.ok&&anchor);
  for(const degree of [-85,-30,0,30,85]){const next=refractionAim(scene,rad(degree),true),o=simulateRefraction(update(scene,next.pose),registry);assert.equal(o.ok,true);near(o.hit.x,before.hit.x);near(o.distance,anchor.radiusM);assert.ok(next.pose.yM<0&&Math.abs(next.pose.xM)<.6);}
});
test('unchanged angle returns exact original pose and invalid rays do not offer an orbit',()=>{
  const scene=createRefractionExperiment('no-orbit',time),anchor=lightOrbitForScene(scene,'refraction');assert.ok(anchor);assert.deepEqual(lightOrbitPose(anchor,anchor.startRad),anchor.pose);assert.deepEqual(lightOrbitPose(anchor,NaN),anchor.pose);
  for(const pose of [{xM:0,yM:0,rotationRad:0},{xM:0,yM:.2,rotationRad:0},{xM:2,yM:.3,rotationRad:-Math.PI/2}])assert.equal(lightOrbitForScene(update(scene,pose),'refraction'),null);
  assert.equal(createLightOrbit('x',{xM:0,yM:0,rotationRad:0},{xM:0,yM:0},0,true),null);
});
test('dragging body changes the next orbit center without changing its original orientation',()=>{
  const scene=createReflectionExperiment('body-move',time),source=scene.equipment.find(i=>i.type===EMITTER),initial=lightOrbitForScene(scene,'reflection'),next=update(scene,{...source.pose,xM:source.pose.xM+.1}),anchor=lightOrbitForScene(next,'reflection');assert.ok(initial&&anchor);near(anchor.center.xM-initial.center.xM,.1);near(anchor.pose.rotationRad,source.pose.rotationRad);
});
test('pointer angular deltas cross atan seam continuously and grab offset cannot create an initial jump',()=>{
  near(orbitAngleDelta(rad(-179),rad(179)),rad(2));near(orbitAngleDelta(rad(179),rad(-179)),rad(-2));
  const scene=createReflectionExperiment('offset-grab',time),anchor=lightOrbitForScene(scene,'reflection'),pointer=anchor.startRad+.13;assert.deepEqual(lightOrbitPose(anchor,anchor.startRad+orbitAngleDelta(pointer,pointer)),anchor.pose);
});
test('one committed orbit is one atomic undo/redo entry with all parameters retained',()=>{
  const scene=createRefractionExperiment('history-orbit',time),source=scene.equipment.find(i=>i.type===EMITTER),anchor=lightOrbitForScene(scene,'refraction'),pose=lightOrbitPose(anchor,rad(140)),history=createHistory(scene),result=executeCommand(history,{type:'update-equipment',id:source.id,pose,parameters:source.parameters},registry,time);assert.equal(result.ok,true);assert.equal(result.history.undo.length,1);assert.equal(history.undo.length,0);
  const undone=travelHistory(result.history,'undo',registry,time);assert.equal(undone.ok,true);assert.deepEqual(undone.history.present.equipment,scene.equipment);const redone=travelHistory(undone.history,'redo',registry,time);assert.equal(redone.ok,true);assert.deepEqual(redone.history.present.equipment,result.history.present.equipment);
});
