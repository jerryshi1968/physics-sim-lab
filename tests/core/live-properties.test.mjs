import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { propertyCandidate, propertyValue, activePropertyDrafts, acknowledgePropertyDrafts, validPropertyCandidate } from '../../src/core/workbench/properties.ts';
const registry = createWorkbenchRegistry();
function equipment(type) { return { id: 'equipment', type, definitionVersion: 1, pose: { xM: 0, yM: 0, rotationRad: 0 }, parameters: { ...registry.get(type, 1).defaultParameters } }; }
const draft = (raw, applied) => ({ raw, applied });

test('blank, malformed and nonfinite drafts preserve last valid state; voltage zero is valid but resistance zero is not', () => {
  const power = equipment('electrical.power-supply'), resistor = equipment('electrical.resistor'), original = structuredClone(power);
  for (const raw of ['', '-', '1e', 'Infinity', 'NaN']) assert.deepEqual(propertyCandidate(power, { voltageV: draft(raw, 3) }), power);
  assert.equal(validPropertyCandidate(propertyCandidate(power, { voltageV: draft('0', 3) }), registry), true);
  assert.equal(validPropertyCandidate(propertyCandidate(resistor, { resistanceOhm: draft('0', 10) }), registry), false);
  assert.deepEqual(power, original);
});
test('coupled instrument fields validate together without partial mutation and typed formatting survives acknowledgement', () => {
  const item = equipment('electrical.ammeter');
  const low = propertyCandidate(item, { highRange: draft('.5', 3) }); assert.equal(validPropertyCandidate(low, registry), false);
  const drafts = { lowRange: draft('.40', .6), highRange: draft('.5', 3) }, both = propertyCandidate(item, drafts); assert.equal(validPropertyCandidate(both, registry), true);
  const acknowledged = acknowledgePropertyDrafts(both, drafts); assert.deepEqual(activePropertyDrafts(both, acknowledged), acknowledged); assert.equal(acknowledged.lowRange.raw, '.40');
  assert.equal(activePropertyDrafts(item, acknowledged).lowRange, undefined);
});
test('position and degrees preserve SI conversion; optical ranges and friction preset edits retain explicit validity', () => {
  const lens = equipment('optical.convex-lens'); const changed = propertyCandidate(lens, { xM: draft('-.25', 0), degrees: draft('90', 0), focalLengthM: draft('.12', .1) });
  assert.equal(changed.pose.xM, -.25); assert.ok(Math.abs(changed.pose.rotationRad - Math.PI / 2) < 1e-12); assert.ok(Math.abs(propertyValue(changed, 'degrees') - 90) < 1e-12); assert.equal(validPropertyCandidate(changed, registry), true);
  assert.equal(validPropertyCandidate(propertyCandidate(lens, { focalLengthM: draft('.001', .1) }), registry), false);
  const surface = equipment('mechanical.friction-surface'), custom = propertyCandidate(surface, { kineticCoefficient: draft('.25', .2) }); assert.equal(custom.parameters.material, 'custom'); assert.equal(surface.parameters.material, 'board');
});
test('every registered apparatus accepts its untouched defaults through the shared live editor', () => {
  for (const definition of registry.list()) assert.equal(validPropertyCandidate(propertyCandidate(equipment(definition.type), {}), registry), true, definition.type);
});
