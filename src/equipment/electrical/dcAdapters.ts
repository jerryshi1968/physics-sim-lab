import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import type { DcModelAdapter, DcModelAdapters } from '../../core/electrical/compile.ts';
import { DcAdapterError } from '../../core/electrical/compile.ts';
import { meterConnection } from '../../core/electrical/instruments.ts';
import { endpointKey } from '../../core/workbench/geometry.ts';
import { POWER, RESISTOR, SWITCH, JUNCTION, LAMP, AMMETER, VOLTMETER, RHEOSTAT } from './definitions.ts';
import { rheostatResistances } from '../../core/electrical/rheostat.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { DcBranch } from '../../core/electrical/netlist.ts';

function terminal(instance: EquipmentInstance, portId: string): string {
  return endpointKey({ equipmentId: instance.id, portId });
}

export function createDcModelAdapters(): DcModelAdapters {
  const adapters = new Map<string, DcModelAdapter>();
  adapters.set(`${POWER}.uncompiled.v1`, instance => [{ id: instance.id, kind: 'voltage-source',
    from: terminal(instance, 'positive'), to: terminal(instance, 'negative'), voltageV: Number(instance.parameters.voltageV), resistanceOhm: Number(instance.parameters.internalResistanceOhm ?? 0) }]);
  adapters.set(`${RESISTOR}.uncompiled.v1`, instance => [{ id: instance.id, kind: 'resistor',
    from: terminal(instance, 'a'), to: terminal(instance, 'b'), resistanceOhm: Number(instance.parameters.resistanceOhm) }]);
  adapters.set(`${SWITCH}.uncompiled.v1`, instance => [{ id: instance.id, kind: 'switch',
    from: terminal(instance, 'a'), to: terminal(instance, 'b'), closed: instance.parameters.closed === true, resistanceOhm: 0 }]);
  adapters.set(`${JUNCTION}.uncompiled.v1`, () => []);
  adapters.set(`${RHEOSTAT}.dc.v1`, (instance, { scene }) => {
    const ids = rheostatBranchIds(scene, instance.id);
    const { asOhm, sbOhm } = rheostatResistances({ maxResistanceOhm: Number(instance.parameters.maxResistanceOhm), position: Number(instance.parameters.position) });
    const segment = (id: string, from: string, to: string, resistanceOhm: number): DcBranch => resistanceOhm === 0
      ? { id, kind: 'wire', from: terminal(instance, from), to: terminal(instance, to), resistanceOhm: 0 }
      : { id, kind: 'resistor', from: terminal(instance, from), to: terminal(instance, to), resistanceOhm };
    return [segment(ids[0]!, 'a', 'c', asOhm), segment(ids[1]!, 'c', 'b', sbOhm), segment(ids[2]!, 'c', 'd', 0)];
  });
  adapters.set(`${LAMP}.dc.v1`, instance => [{ id: instance.id, kind: 'lamp', from: terminal(instance, 'a'), to: terminal(instance, 'b'),
    ratedVoltageV: Number(instance.parameters.ratedVoltageV), ratedCurrentA: Number(instance.parameters.ratedCurrentA),
    coldResistanceOhm: Number(instance.parameters.coldResistanceOhm), maxCurrentA: Number(instance.parameters.maxCurrentA) }]);
  for (const type of [AMMETER, VOLTMETER]) adapters.set(`${type}.dc.v1`, (instance, { scene }) => {
    const connection = meterConnection(scene, instance.id);
    if (connection.bothRanges) throw new DcAdapterError('METER_MULTI_RANGE');
    if (!connection.range) return [];
    const ends = { id: instance.id, from: terminal(instance, connection.range), to: terminal(instance, 'common') };
    return type === AMMETER ? [{ ...ends, kind: 'current-meter', resistanceOhm: Number(instance.parameters.resistanceOhm) }]
      : [{ ...ends, kind: 'voltage-probe', inputResistanceOhm: instance.parameters.finiteInput ? Number(instance.parameters.inputResistanceOhm) : null }];
  });
  return adapters;
}

function rheostatBranchIds(scene: SceneDocument, id: string): string[] {
  const used = new Set([...scene.equipment, ...scene.connections].map(item => item.id));
  const rheostats = scene.equipment.filter(item => item.type === RHEOSTAT).map(item => item.id).sort();
  let result: string[] = [];
  for (const [index, equipmentId] of rheostats.entries()) {
    const ids = ['as', 'sb', 'cd'].map(segment => {
      const base = `rheostat.${index}.${segment}`;
      let branchId = base, suffix = 0;
      while (used.has(branchId)) branchId = `${base}.${++suffix}`;
      used.add(branchId); return branchId;
    });
    if (equipmentId === id) result = ids;
  }
  return result;
}
