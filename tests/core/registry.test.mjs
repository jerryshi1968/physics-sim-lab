import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { EquipmentRegistry } from '../../src/core/equipment/registry.ts';
import { EquipmentDefinitionSchema } from '../../src/core/equipment/schema.ts';
import { DiagnosticSchema } from '../../src/core/diagnostics/diagnostic.ts';
import { definition, fixtureRegistry } from './fixtures.mjs';

test('default registry has no fabricated apparatus or unsupported mechanical capability', () => {
  const registry = new EquipmentRegistry();
  assert.deepEqual(registry.list(), []);
  assert.equal(registry.supportsConnection('wire'), true);
  assert.equal(registry.supportsConnection('rope'), false);
  assert.equal(registry.supportsConnection('rigid-mount'), false);
});

test('definitions are retrieved by exact type and version', () => {
  const registry = fixtureRegistry();
  assert.equal(registry.get('test.resistor', 1).defaultParameters.resistanceOhm, 10);
  assert.equal(registry.get('test.resistor', 2), undefined);
  assert.equal(registry.get('unregistered', 1), undefined);
  assert.equal(registry.validateParameters(registry.get('test.resistor', 1), { resistanceOhm: '10' }), false);
});

test('returned definition copies cannot mutate the registration or its port/default data', () => {
  const registry = fixtureRegistry();
  const entry = registry.get('test.resistor', 1);
  entry.ports[0].id = 'changed';
  entry.defaultParameters.resistanceOhm = 0;
  registry.list()[0].label = 'changed';
  assert.deepEqual(registry.get('test.resistor', 1), definition());
});

test('reject duplicate registration and unresolved parameter schemas', () => {
  const registry = fixtureRegistry();
  assert.throws(() => registry.register(definition()), /DUPLICATE_DEFINITION/);
  assert.throws(() => registry.registerParameterSchema('test.resistor.parameters.v1', z.strictObject({})), /DUPLICATE_PARAMETER_SCHEMA/);
  assert.throws(() => new EquipmentRegistry().register(definition()), /UNKNOWN_PARAMETER_SCHEMA/);
});

test('reject invalid defaults, duplicate local ports and malformed definitions', () => {
  const registry = new EquipmentRegistry();
  registry.registerParameterSchema('test.resistor.parameters.v1', z.strictObject({ resistanceOhm: z.number().positive() }));
  assert.throws(() => registry.register({ ...definition(), defaultParameters: { resistanceOhm: 0 } }), /INVALID_DEFAULT_PARAMETERS/);
  const duplicate = definition();
  duplicate.ports[1].id = 'a';
  assert.equal(EquipmentDefinitionSchema.safeParse(duplicate).success, false);
  assert.equal(EquipmentDefinitionSchema.safeParse({ ...definition(), domain: 'unknown' }).success, false);
});

test('diagnostics validate explicit severity, affected apparatus and measurement usability', () => {
  assert.equal(DiagnosticSchema.safeParse({ code: 'TEST', severity: 'error', equipmentIds: ['r1'],
    messageKey: 'test.invalid', measurementUsable: false }).success, true);
  assert.equal(DiagnosticSchema.safeParse({ code: 'TEST', severity: 'error', equipmentIds: [] }).success, false);
});

test('parameter validation never strips extra fields, coerces text or repairs a negative value', () => {
  const registry = new EquipmentRegistry();
  registry.registerParameterSchema('test.resistor.parameters.v1', z.object({ resistanceOhm: z.coerce.number().transform(Math.abs) }));
  registry.register(definition());
  const registered = registry.get('test.resistor', 1);
  assert.equal(registry.validateParameters(registered, { resistanceOhm: 10 }), true);
  assert.equal(registry.validateParameters(registered, { resistanceOhm: 10, hidden: true }), false);
  assert.equal(registry.validateParameters(registered, { resistanceOhm: '10' }), false);
  assert.equal(registry.validateParameters(registered, { resistanceOhm: -10 }), false);
  assert.throws(() => registry.registerParameterSchema('bad id', z.strictObject({})));
});
