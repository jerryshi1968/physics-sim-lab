import test from 'node:test';
import assert from 'node:assert/strict';
import { createCartVelocityExperiment } from '../../src/experiments/cartVelocity.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { advanceDrivenTape, compileCartVelocity } from '../../src/equipment/cartVelocity/motion.ts';
import { flipTapePlacement, startTape, tapePointXM, tapeRulerPlacement } from '../../src/equipment/ticker/simulate.ts';
import { buildCartPositions, cartPositionSheets, defaultCartPositionZero } from '../../src/equipment/cartVelocity/positions.ts';
import { appendMeasurements } from '../../src/core/measurements/records.ts';
import { parseSceneJson, serializeScene } from '../../src/core/scene/transfer.ts';

const time='2026-11-26T08:00:00.000Z',registry=createWorkbenchRegistry(),setup=()=>createCartVelocityExperiment('paper-flip',time), close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const runFor=s=>advanceDrivenTape(startTape(s,'paper'),1.5,1.5,compileCartVelocity(s,registry),.1,true);
test('mirroring about a selected dot keeps it under the ruler and two mirrors recover every point without changing raw motion',()=>{
  const paper={xM:-.3,yM:-.96},pivot=.08,flipped=flipTapePlacement(paper,pivot),back=flipTapePlacement(flipped,pivot);
  close(tapePointXM(paper,pivot),tapePointXM(flipped,pivot));assert.equal(flipped.flippedX,true);assert.equal(back.flippedX,false);close(back.xM,paper.xM);assert.equal(back.yM,paper.yM);
  for(const x of [0,.02,.4,.8]){close(tapePointXM(back,x),tapePointXM(paper,x));close(Math.abs(tapePointXM(flipped,x)-tapePointXM(flipped,pivot)),Math.abs(x-pivot));}
});
test('both paper directions obey actual ruler bounds and preserve the same measured distance',()=>{
  const s=setup(),run=runFor(s),paper={xM:-.3,yM:-.96},pivot=run.dots[20].displacementM,flipped=flipTapePlacement(paper,pivot),a=tapeRulerPlacement(s,run,paper,20,50),b=tapeRulerPlacement(s,run,flipped,20,50);
  assert.ok(a&&b);assert.ok(a.originM>a.targetM);assert.ok(b.originM<b.targetM);close(a.originM,b.originM);close(a.originM-a.targetM,b.targetM-b.originM);
  assert.equal(tapeRulerPlacement(s,run,{xM:.1,yM:-.96,flippedX:true},20,50),null);assert.equal(tapeRulerPlacement(s,run,{xM:-.95,yM:-.96},20,50),null);
});
test('the default flip pivot is a clear counting origin and stationary or absent tape is handled without fabricated points',()=>{
  const s=setup(),run=runFor(s),zero=defaultCartPositionZero(run);assert.ok(zero>5);assert.ok(run.dots[zero].displacementM>0);assert.equal(defaultCartPositionZero(null),0);assert.equal(defaultCartPositionZero({...run,dots:run.dots.map(d=>({...d,displacementM:0}))}),0);
});
test('mirrored position sources round-trip orientation while their SI positions and computed velocities are unchanged',()=>{
  const s=setup(),run=runFor(s),paper={xM:-.3,yM:-.96},input={zero:20,stride:5,last:6,rawCm:{'-1':'-1.5','1':'2.5','2':'6','3':'10.5','4':'16','5':'22.5','6':'30'},group:'第1次',note:''};
  const capture=placement=>{const result=buildCartPositions(s,run,true,input,'source',time,placement);assert.equal(result.ok,true,JSON.stringify(result));const saved=appendMeasurements(s,registry,result.records,result.snapshot,time);assert.equal(saved.ok,true);return saved.document;};
  const original=capture(paper),flipped=capture(flipTapePlacement(paper,run.dots[20].displacementM));assert.equal(cartPositionSheets(flipped)[0].meta.flippedX,true);assert.equal(cartPositionSheets(original)[0].meta.flippedX,undefined);assert.deepEqual(cartPositionSheets(flipped)[0].results,cartPositionSheets(original)[0].results);assert.deepEqual(flipped.measurementRecords,original.measurementRecords);assert.deepEqual(parseSceneJson(serializeScene(flipped,registry),registry).document,flipped);
});
