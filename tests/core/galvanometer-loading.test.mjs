import test from 'node:test';
import assert from 'node:assert/strict';
import { createInductionExperiment } from '../../src/experiments/induction.ts';
import { simulateElectrical } from '../../src/equipment/electrical/simulate.ts';
import { inductionSource } from '../../src/equipment/induction/model.ts';
import { upgradeInductionGalvanometer } from '../../src/equipment/induction/galvanometer.ts';
import { buildInductionReading } from '../../src/equipment/induction/measure.ts';
import { appendMeasurements } from '../../src/core/measurements/records.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { AMMETER, VOLTMETER } from '../../src/equipment/electrical/definitions.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { serializeScene, parseSceneJson } from '../../src/core/scene/transfer.ts';

const time = '2026-11-24T00:00:00.000Z', later = '2026-11-24T01:00:00.000Z', registry = createWorkbenchRegistry();
const make = () => createInductionExperiment('loading.test', time);
const item = (s, id) => s.equipment.find(i => i.id === id);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);
function coil(turns) {
  const s = make(); item(s, 'S').parameters.closed = true; item(s, 'M').pose.xM = .02;
  Object.assign(item(s, 'M').parameters, { inductionShape: 'coil', turns, velocityXMPerS: .1 }); return s;
}
function legacy() {
  const s = make(); item(s, 'G').parameters = { resistanceOhm: 0, maximumA: .001, resolutionA: .00005 }; return s;
}
test('independent loaded circuit benchmarks distinguish 1, 10, 20 and 50 turns using actual winding resistance', () => {
  let previous = 0;
  for (const [n, emf, resistance, current, displayed] of [[1, .002, 12.8, .002 / 112.8, .00002], [10, .02, 128, .02 / 228, .00009], [20, .04, 256, .04 / 356, .00011], [50, .1, 640, .1 / 740, .00014]]) {
    const s = coil(n), source = inductionSource(s, item(s, 'M')), result = simulateElectrical(s);
    assert.equal(result.result.ok, true); const meter = result.meters[0]; assert.equal(meter.status, 'valid');
    near(source.voltageV, -emf); near(source.resistanceOhm, resistance); near(meter.trueValue, -current); near(meter.displayValue, -displayed);
    assert.ok(Math.abs(meter.displayValue) > previous); previous = Math.abs(meter.displayValue);
    near(meter.needleFraction, .5 - displayed / .0004);
  }
});
test('the original zero-meter-resistance cancellation is reproducible; reverse and over-range remain physical', () => {
  const currents = [10, 50].map(n => { const s = coil(n); item(s, 'G').parameters.resistanceOhm = 0; return simulateElectrical(s).meters[0].trueValue; });
  near(currents[0], currents[1]);
  const reverse = coil(50); item(reverse, 'M').parameters.velocityXMPerS = -.1; near(simulateElectrical(reverse).meters[0].trueValue, .1 / 740);
  const high = coil(50); item(high, 'B').parameters.fieldT = .2; item(high, 'M').parameters.velocityXMPerS = .2;
  for (const vx of [.2, -.2]) { item(high, 'M').parameters.velocityXMPerS = vx; const m = simulateElectrical(high).meters[0]; assert.equal(m.status, 'over-range'); assert.equal(m.displayValue, null); }
  const wire = make(); item(wire, 'S').parameters.closed = true; item(wire, 'M').parameters.velocityXMPerS = .1;
  const m = simulateElectrical(wire).meters[0]; near(m.trueValue, .002 / 104); near(m.displayValue, .00002); near(m.needleFraction, .55);
  assert.equal(registry.get(AMMETER, 1).defaultParameters.resistanceOhm, 0); assert.equal(registry.get(VOLTMETER, 1).defaultParameters.finiteInput, false);
});
test('legacy default migration is immutable and idempotent, preserving wiring, poses and frozen old observations', () => {
  const old = legacy(); item(old, 'S').parameters.closed = true; const view = structuredClone(old);
  Object.assign(item(view, 'M').parameters, { inductionShape: 'coil', turns: 10, velocityXMPerS: .1 }); item(view, 'M').pose.xM = .02;
  const built = buildInductionReading(old, view, simulateElectrical(view), { group: '原观察', observation: '向左偏转', current: '-.00015', note: '原零内阻' }, 'old-reading', time);
  assert.equal(built.ok, true); const appended = appendMeasurements(old, registry, built.records, built.snapshot, time); assert.equal(appended.ok, true);
  const before = structuredClone(appended.document), next = upgradeInductionGalvanometer(appended.document, later);
  assert.deepEqual(appended.document, before); assert.equal(next.revision, before.revision + 1); assert.equal(next.provenance.updatedAt, later);
  assert.equal(item(next, 'G').parameters.resistanceOhm, 100); assert.equal(item(next, 'G').parameters.calibrationVersion, 1);
  assert.deepEqual(next.connections, before.connections); assert.deepEqual(next.equipment.map(i => i.pose), before.equipment.map(i => i.pose));
  assert.deepEqual(next.measurementRecords, before.measurementRecords); assert.deepEqual(next.measurementSnapshots, before.measurementSnapshots);
  assert.equal(validateSceneDocument(next, registry).ok, true); assert.deepEqual(parseSceneJson(serializeScene(next, registry), registry).document, next);
  assert.equal(upgradeInductionGalvanometer(next, later), next);
});
test('custom settings and explicitly chosen zero resistance are preserved, outside this experiment migration does nothing', () => {
  for (const changes of [{ resistanceOhm: 50 }, { maximumA: .0005, resolutionA: .000025 }, { calibrationVersion: 1 }]) {
    const s = legacy(); Object.assign(item(s, 'G').parameters, changes); assert.equal(upgradeInductionGalvanometer(s, later), s);
  }
  const other = legacy(); other.experimentId = 'J-ELEC-FREE'; assert.equal(upgradeInductionGalvanometer(other, later), other);
});
