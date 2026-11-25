import test from 'node:test';
import assert from 'node:assert/strict';
import { createTapeSpeedExperiment } from '../../src/experiments/tapeSpeed.ts';
import { createTickerExperiment } from '../../src/experiments/ticker.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { equipmentSupport, equipmentAvailability } from '../../src/equipment/support.ts';
import { TICKER } from '../../src/equipment/cart/definitions.ts';
import { MECHANICAL_RULER } from '../../src/equipment/mechanical/definitions.ts';
import { startTape } from '../../src/equipment/ticker/simulate.ts';
import { buildTapeSpeedMeasurement, speedNumbers, speedMetadata, tapeSpeedRows, tapeSpeedChartScene, tapeSpeedProfiles, tapeSpeedCsv } from '../../src/equipment/tapeSpeed/model.ts';
import { appendMeasurements, correctManualMeasurement, removeMeasurement } from '../../src/core/measurements/records.ts';
import { serializeScene, parseSceneJson } from '../../src/core/scene/transfer.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';
import { measurementSeries } from '../../src/core/measurements/charts.ts';

const time='2026-11-25T08:00:00.000Z', registry=createWorkbenchRegistry(), placement={xM:.4,yM:-.11};
const setup=()=>createTapeSpeedExperiment('tape-speed-test',time);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
function tape(scene,position=t=>.2*t){const f=Number(scene.equipment[0].parameters.frequencyHz);return {...startTape(scene,'paper'),interaction:'pointer.v2',timeS:.4,displacementM:position(.4),dots:Array.from({length:.4*f+1},(_,i)=>({timeS:i/f,displacementM:position(i/f)}))};}
const input={mode:'average',zero:0,origin:5,target:10,at:null,stride:5,rawA:'.0200',rawB:'.04',group:'第1条',note:'学生读尺'};
function capture(scene,overrides={},run=tape(scene),id='sample',taken=true,paper=placement){return buildTapeSpeedMeasurement(scene,run,taken,{...input,...overrides},id,time,paper);}
function save(scene,result){assert.equal(result.ok,true,JSON.stringify(result));const saved=appendMeasurements(scene,registry,result.records,result.snapshot,time);assert.equal(saved.ok,true,JSON.stringify(saved));return saved.document;}

test('paper-speed entry reuses the existing timer and ruler, leaving the practice entry and apparatus registry intact',()=>{
  const scene=setup();assert.equal(scene.experimentId,'H-MECH-06');assert.deepEqual(scene.equipment.map(i=>i.type),[TICKER,MECHANICAL_RULER]);assert.equal(scene.measurementRecords.length,0);
  assert.equal(scene.curriculumRef.textbookMappings[0].status,'pending_teacher_review');assert.equal(equipmentSupport(scene).key,'ticker');assert.equal(equipmentAvailability(scene,'mechanical.cart').enabled,false);
  assert.equal(createTickerExperiment('practice',time).experimentId,'H-MECH-05');assert.deepEqual(parseSceneJson(serializeScene(scene,registry),registry).document,scene);
});
test('five and three intervals use the actual frequency, not a hard-coded tenth or six-hundredths second',()=>{
  for(const [f,n,dt] of [[50,5,.1],[50,3,.06],[60,5,1/12],[60,3,.05]]){const result=speedNumbers(.02,.04,n,f);close(result.timeS,dt);close(result.velocityMPerS,.02/dt);}
  for(const [n,f] of [[0,50],[-1,50],[1.5,50],[5,55],[NaN,50]])assert.equal(speedNumbers(.02,.04,n,f),null);
});
test('the final dots of a full 12-second 60 Hz tape remain measurable through raw index 720',()=>{
  const scene=setup();scene.equipment[0].parameters.frequencyHz=60;
  const run={...startTape(scene,'full-60-hz'),interaction:'pointer.v2',timeS:12,displacementM:.24,dots:Array.from({length:721},(_,i)=>({timeS:i/60,displacementM:.02*i/60}))};
  const row=tapeSpeedRows(save(scene,capture(scene,{zero:700,origin:715,target:720,rawA:'.005',rawB:String(.02/3)},run)))[0];close(row.velocityMPerS,.02);close(row.timeS,1/12);assert.equal(row.meta.b,720);
});
test('uniform motion yields the independently specified 0.2 m/s using manual positions and a nonzero reference',()=>{
  const scene=setup(),saved=save(scene,capture(scene,{zero:2,rawA:'.012',rawB:'.032'})),row=tapeSpeedRows(saved)[0];
  close(row.displacementM,.02);close(row.timeS,.1);close(row.velocityMPerS,.2);close(row.atTimeS,.11);assert.equal(row.meta.zero,2);
  assert.deepEqual(row.meta.paper,[.4,-.11]);close(row.meta.ruler[0]-row.meta.ruler[1],.012);close(row.meta.ruler[0]-row.meta.ruler[2],.032);
});
test('three-interval instantaneous estimate retains its target time and explicit offset from the interval midpoint',()=>{
  const scene=setup(),saved=save(scene,capture(scene,{mode:'instant',origin:5,target:8,at:6,stride:3,rawA:'.02',rawB:'.032'})),row=tapeSpeedRows(saved)[0];
  close(row.timeS,.06);close(row.atTimeS,.12);close(row.midpointOffsetS,-.01);close(row.velocityMPerS,.2);
  const series=measurementSeries(tapeSpeedChartScene(saved),tapeSpeedProfiles[1]);close(series[0].points[0].x,.12);close(series[0].points[0].y,.2);
  assert.equal(tapeSpeedCsv(saved).split('\r\n')[1].split(',')[13],'-0.01');
});
test('symmetric estimates for x=t^3 converge toward 3t² while the reading-error bound increases',()=>{
  const scene=setup(),run=tape(scene,t=>t**3),rows=[];
  for(const [a,b,id,expected] of [[3,7,'wide',.0316],[4,6,'short',.0304]]){
    const saved=save(scene,capture(scene,{mode:'instant',origin:a,target:b,at:5,stride:3,rawA:String((a/50)**3),rawB:String((b/50)**3)},run,id)),row=tapeSpeedRows(saved)[0];
    close(row.velocityMPerS,expected);close(row.midpointOffsetS,0);rows.push(row);
  }
  assert.ok(Math.abs(rows[1].velocityMPerS-.03)<Math.abs(rows[0].velocityMPerS-.03));close(rows[0].readingErrorBoundMPerS,.0125);close(rows[1].readingErrorBoundMPerS,.025);
});
test('asymmetric accelerated windows are averages, not exact instantaneous readings at every point',()=>{
  const scene=setup(),run=tape(scene,t=>t**3),saved=save(scene,capture(scene,{mode:'instant',origin:4,target:8,at:5,rawA:String(.08**3),rawB:String(.16**3)},run)),row=tapeSpeedRows(saved)[0];
  close(row.velocityMPerS,.0448);assert.notEqual(row.velocityMPerS,.03);close(row.midpointOffsetS,-.02);
});
test('missing, reversed, out-of-range and identical manual readings never become normal speeds',()=>{
  for(const [a,b] of [['','.04'],['.02',''],['-.01','.04'],['.02','2'],['.05','.04'],['.02','.02']]){
    const row=tapeSpeedRows(save(setup(),capture(setup(),{rawA:a,rawB:b})))[0];assert.equal(row.velocityMPerS,null);assert.equal(row.displacementM,null);
    assert.equal(measurementSeries(tapeSpeedChartScene(save(setup(),capture(setup(),{rawA:a,rawB:b}))),tapeSpeedProfiles[0])[0].points[0].y,null);
  }
});
test('invalid endpoint, target, reference, raw input and stale or attached tape reject capture atomically',()=>{
  const scene=setup();
  for(const changes of [{origin:10,target:5},{zero:6},{mode:'instant',at:5},{mode:'instant',at:10},{mode:'instant',at:5.5},{mode:'instant',origin:5,target:6,at:5},{stride:0},{rawA:'NaN'},{group:''}])assert.equal(capture(scene,changes).ok,false);
  assert.equal(capture(scene,{},tape(scene),'attached',false).ok,false);assert.equal(capture(scene,{},tape(scene),'missing',true,null).ok,false);
  const run=tape(scene);scene.equipment[0].parameters.frequencyHz=60;assert.equal(capture(scene,{},run).ok,false);
  assert.equal(capture(setup(),{},{...tape(setup()),frequencyHz:60}).ok,false);
});
test('reference and both endpoints must lie beside the actual horizontal ruler and overlapping points are invalid',()=>{
  for(const mutate of [s=>{s.equipment[1].pose.xM=.39;},s=>{s.equipment[1].pose.yM=.2;},s=>{s.equipment[1].pose.rotationRad=.2;},s=>{s.equipment[1].pose.flippedX=true;},s=>{s.equipment=s.equipment.slice(0,1);}]){const scene=setup(),run=tape(scene);mutate(scene);assert.equal(capture(scene,{},run).ok,false);}
  const scene=setup(),run=tape(scene);run.dots[1].displacementM=0;assert.equal(capture(scene,{},run).ok,false);
});
test('corrected raw positions recompute table, graph and CSV while original truth and frozen sources remain unchanged',()=>{
  const scene=setup(),saved=save(scene,capture(scene,{rawB:'.0430'})),frozen=structuredClone(saved.measurementSnapshots);
  close(tapeSpeedRows(saved)[0].velocityMPerS,.23);
  const corrected=correctManualMeasurement(saved,registry,'sample.1','.045',time);assert.equal(corrected.ok,true);close(tapeSpeedRows(corrected.document)[0].velocityMPerS,.25);
  close(measurementSeries(tapeSpeedChartScene(corrected.document),tapeSpeedProfiles[0])[0].points[0].y,.25);
  assert.deepEqual(corrected.document.measurementSnapshots,frozen);close(corrected.document.measurementRecords[1].context.physicalValue,.04);assert.equal(corrected.document.measurementRecords[1].context.originalRawInput,'.0430');
  close(Number(tapeSpeedCsv(corrected.document).split('\r\n')[1].split(',')[11].replaceAll('"','')),.25);assert.ok(tapeSpeedCsv(corrected.document).includes('.0430'));
  const partial=removeMeasurement(corrected.document,registry,'sample.1',time);assert.equal(tapeSpeedRows(partial.document)[0].velocityMPerS,null);
});
test('one transaction, undo/redo, SI JSON reload and separate paper origins preserve the measurement calculation',()=>{
  const scene=setup(),built=capture(scene),command=executeCommand(createHistory(scene),{type:'record-measurements',records:built.records,snapshot:built.snapshot},registry,time);assert.equal(command.ok,true);
  const undo=travelHistory(command.history,'undo',registry,time);assert.equal(undo.history.present.measurementRecords.length,0);
  const redo=travelHistory(undo.history,'redo',registry,time),saved=redo.history.present;close(tapeSpeedRows(saved)[0].velocityMPerS,.2);
  const restored=parseSceneJson(serializeScene(saved,registry),registry);assert.equal(restored.ok,true);assert.deepEqual(tapeSpeedRows(restored.document),tapeSpeedRows(saved));
  const second=save(saved,capture(saved,{zero:2,rawA:'.012',rawB:'.032'},tape(saved),'second'));assert.equal(measurementSeries(tapeSpeedChartScene(second),tapeSpeedProfiles[0]).length,2);
});
test('malformed frozen metadata is ignored safely and speed CSV escapes spreadsheet formulas',()=>{
  for(const text of ['{','{}',JSON.stringify({kind:'tape-speed',f:55})])assert.equal(speedMetadata(text),null);
  const scene=save(setup(),capture(setup(),{group:'=1+1'}));assert.ok(tapeSpeedCsv(scene).includes('\t=1+1'));
  const metadata=JSON.parse(scene.measurementSnapshots[0].note);metadata.e=999;metadata.mode='instant';scene.measurementSnapshots[0].note=JSON.stringify(metadata);assert.deepEqual(tapeSpeedRows(scene),[]);
});
