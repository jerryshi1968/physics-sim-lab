import test from 'node:test';
import assert from 'node:assert/strict';
import { createCartVelocityExperiment } from '../../src/experiments/cartVelocity.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { compileCartVelocity, advanceDrivenTape } from '../../src/equipment/cartVelocity/motion.ts';
import { startTape } from '../../src/equipment/ticker/simulate.ts';
import { buildCartPositions, cartPositionSheets, cartVelocitySeriesRows, cartPositionsCsv, centimetresInSI } from '../../src/equipment/cartVelocity/positions.ts';
import { buildCartVelocityMeasurement } from '../../src/equipment/cartVelocity/measure.ts';
import { appendMeasurements, correctManualMeasurement, removeMeasurement } from '../../src/core/measurements/records.ts';
import { displayMeasurement, measurementInputInSI } from '../../src/core/measurements/display.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';
import { parseSceneJson, serializeScene } from '../../src/core/scene/transfer.ts';

const time='2026-11-26T08:00:00.000Z', registry=createWorkbenchRegistry(), setup=()=>createCartVelocityExperiment('positions',time), paper={xM:-.3,yM:-.96};
const input={zero:20,stride:5,last:6,rawCm:{'1':'2.500','2':'6','3':'10.5','4':'16','5':'22.5','6':'30'},group:'第1次',note:'学生逐点量位置'};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
function tape(scene,id='paper'){const rig=compileCartVelocity(scene,registry);assert.equal(rig.ok,true);return advanceDrivenTape(startTape(scene,id),1.5,1.5,rig,.1,true);}
function capture(scene,overrides={},run=tape(scene),placement=paper){return buildCartPositions(scene,run,true,{...input,...overrides},'sheet'+scene.revision,time,placement);}
function save(scene,result){assert.equal(result.ok,true,JSON.stringify(result));const saved=appendMeasurements(scene,registry,result.records,result.snapshot,time);assert.equal(saved.ok,true,JSON.stringify(saved));return saved.document;}
test('a position sheet stores each manual point once in SI, preserves literal cm inputs and defines zero without a fake reading',()=>{
  const scene=save(setup(),capture(setup())),sheet=cartPositionSheets(scene)[0];assert.equal(scene.measurementSnapshots.length,1);assert.equal(scene.measurementRecords.length,6);assert.equal(sheet.points.find(p=>p.number===0).record,undefined);close(sheet.points.find(p=>p.number===1).value,.025);
  assert.equal(sheet.points.find(p=>p.number===1).record.context.originalRawInput,'2.500');assert.equal(sheet.points.find(p=>p.number===1).record.unit,'m');assert.equal(sheet.points[0].number,0);assert.equal(sheet.meta.aux,false);assert.equal(sheet.sample.modelVersion,'mechanical.cart-positions.v2');assert.ok(scene.measurementSnapshots[0].note.length<=500);
});
test('independent x=0.2t+0.5t² positions yield distances and central velocities only at internal points 1 through 5, with endpoint velocities absent',()=>{
  const sheet=cartPositionSheets(save(setup(),capture(setup())))[0];assert.equal(sheet.results[0].velocityMPerS,null);for(let i=1;i<6;i++)close(sheet.results[i].velocityMPerS,.2+i*.1);close(sheet.results[0].distanceM,.025);close(sheet.results[1].distanceM,.035);assert.equal(sheet.results[6].velocityMPerS,null);assert.equal(sheet.results[6].distanceM,null);
});
test('60 Hz uses actual counting periods and both intervals for a central velocity',()=>{
  const s=setup();s.equipment.find(i=>i.id==='ticker').parameters.frequencyHz=60;const r=cartPositionSheets(save(s,capture(s)))[0].results;close(r[1].atTimeS,1/12);close(r[1].timeS,1/6);assert.equal(r[0].velocityMPerS,null);close(r[1].velocityMPerS,.36);
});
test('an origin needs no preceding counting point to calculate all five internal velocities',()=>{
  const s=setup(),sheet=cartPositionSheets(save(s,capture(s,{zero:7})))[0];assert.equal(sheet.meta.aux,false);assert.equal(sheet.results[0].velocityMPerS,null);close(sheet.results[1].velocityMPerS,.3);
});
test('missing, reversed, out-of-range and contradictory positions never manufacture speeds or zero-fill gaps',()=>{
  for(const [n,raw] of [[2,''],[2,'-2'],[2,'200']]){const s=setup(),sheet=cartPositionSheets(save(s,capture(s,{rawCm:{...input.rawCm,[n]:raw}})))[0];assert.equal(sheet.results[1].velocityMPerS,null);}
  const s=setup(),sheet=cartPositionSheets(save(s,capture(s,{rawCm:{...input.rawCm,2:'1'}})))[0];assert.equal(sheet.results[1].distanceM,null);assert.equal(sheet.results[1].velocityMPerS,null);assert.equal(sheet.results[2].velocityMPerS,null);
});
test('only a clear and physically readable selected segment can be captured; bad inputs leave no partial table',()=>{
  const s=setup();assert.equal(capture(s,{zero:1}).ok,false);assert.equal(capture(s,{last:100}).ok,false);assert.equal(capture(s,{rawCm:{...input.rawCm,1:'NaN'}}).ok,false);assert.equal(capture(s,{},tape(s),{xM:-.3,yM:0}).ok,false);
  const run=tape(s);s.equipment[2].parameters.hangerMassKg=.04;assert.equal(capture(s,{},run).ok,false);
});
test('the raw-record editor displays cm and converts edits to SI while keeping literal original cm text',()=>{
  const s=save(setup(),capture(setup())),record=s.measurementRecords.find(r=>r.id.endsWith('.p1'));assert.equal(displayMeasurement(record).unit,'cm');close(displayMeasurement(record).value,2.5);assert.equal(displayMeasurement(record).context.originalRawInput,'2.500');assert.equal(measurementInputInSI(record,'3.0'),'.03'.replace(/^\./,'0.'));
  assert.equal(centimetresInSI(''), '');assert.equal(centimetresInSI('Infinity'),null);
});
test('one corrected shared position updates both adjoining distances and neighboring velocities, CSV and plots without mutating sources',()=>{
  let s=save(setup(),capture(setup())),snapshot=structuredClone(s.measurementSnapshots[0]);const record=s.measurementRecords.find(r=>r.id.endsWith('.p2'));s=correctManualMeasurement(s,registry,record.id,'.07',time).document;
  const sheet=cartPositionSheets(s)[0];close(sheet.results[1].distanceM,.045);close(sheet.results[2].distanceM,.035);close(sheet.results[1].velocityMPerS,.35);close(sheet.results[3].velocityMPerS,.45);assert.deepEqual(s.measurementSnapshots[0],snapshot);assert.match(cartPositionsCsv(s),/2.500/);close(cartVelocitySeriesRows(s).find(r=>r.pointNumber===1).velocityMPerS,.35);
  s=removeMeasurement(s,registry,record.id,time).document;assert.equal(cartPositionSheets(s)[0].results[1].velocityMPerS,null);
});
test('saving a sheet is a single undoable transaction and round-trips all raw positions and frozen apparatus',()=>{
  const s=setup(),result=capture(s),history=executeCommand(createHistory(s),{type:'record-measurements',records:result.records,snapshot:result.snapshot},registry,time);assert.equal(history.ok,true);const undone=travelHistory(history.history,'undo',registry,time).history;assert.equal(undone.present.measurementRecords.length,0);const redone=travelHistory(undone,'redo',registry,time).history.present;assert.deepEqual(parseSceneJson(serializeScene(redone,registry),registry).document,redone);
});
test('old interval snapshots and new position sheets coexist without converting or dropping old raw data',()=>{
  let s=setup();const run=tape(s),old=buildCartVelocityMeasurement(s,run,true,{zero:20,at:20,stride:5,half:1,rawA:'.4',rawB:'.39',group:'旧记录',note:''},'legacy',time,paper);s=save(s,old);const before=structuredClone(s.measurementRecords);s=save(s,capture(s,{},run));assert.deepEqual(s.measurementRecords.slice(0,2),before);assert.ok(cartVelocitySeriesRows(s).some(r=>r.groupKey.startsWith('legacy:')));assert.match(cartPositionsCsv(s),/旧版区间记录/);
});

test('the teacher screenshot positions can be measured with point zero on the ruler zero and no point before it',()=>{
  const s=setup(),run=tape(s),ruler=s.equipment.find(e=>e.id==='ruler'),placement={xM:ruler.pose.xM-run.dots[20].displacementM,yM:ruler.pose.yM,flippedX:true};
  const saved=save(s,capture(s,{rawCm:{1:'.80',2:'2.03',3:'3.69',4:'5.78',5:'8.29',6:'11.22'}},run,placement)),sheet=cartPositionSheets(saved)[0];
  assert.deepEqual(sheet.points.map(p=>p.number),[0,1,2,3,4,5,6]);assert.equal(sheet.results[0].velocityMPerS,null);assert.equal(sheet.results[6].velocityMPerS,null);
  for(const [i,v] of [[1,.1015],[2,.1445],[3,.1875],[4,.23],[5,.272]])close(sheet.results[i].velocityMPerS,v);
  assert.deepEqual(cartVelocitySeriesRows(saved).map(r=>r.pointNumber),[1,2,3,4,5]);assert.doesNotMatch(cartPositionsCsv(saved),/辅助点/);
});

test('legacy auxiliary point sources remain stored and readable without being plotted as a velocity at time zero',()=>{
  const s=setup(),result=capture(s),meta=JSON.parse(result.snapshot.note);result.snapshot.modelVersion='mechanical.cart-positions.v1';result.snapshot.note=JSON.stringify({...meta,aux:true});
  const old={...structuredClone(result.records[0]),id:result.snapshot.id+'.p-1',value:-.015,rawInput:'-.015',range:{min:-1,max:0,resolution:.001},context:{...result.records[0].context,pointLabel:'起点前辅助点的位置',physicalValue:-.015,instrumentDisplayValue:-.015,originalRawInput:'-1.50'}};result.records.unshift(old);
  const saved=save(s,result),source=structuredClone(saved.measurementRecords[0]);assert.equal(cartPositionSheets(saved)[0].points[0].number,-1);assert.deepEqual(saved.measurementRecords[0],source);assert.deepEqual(cartVelocitySeriesRows(saved).map(r=>r.pointNumber),[1,2,3,4,5]);assert.deepEqual(parseSceneJson(serializeScene(saved,registry),registry).document,saved);
});
