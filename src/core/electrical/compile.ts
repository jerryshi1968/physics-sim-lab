import type { EquipmentRegistry } from '../equipment/registry.ts';
import type { EquipmentInstance } from '../equipment/schema.ts';
import type { SceneDocument } from '../scene/schema.ts';
import type { Diagnostic } from '../diagnostics/diagnostic.ts';
import { validateSceneDocument } from '../scene/validate.ts';
import { endpointKey } from '../workbench/geometry.ts';
import { dcFailure, validateDcNetlist } from './netlist.ts';
import type { DcBranch, DcFailure, DcNetlist } from './netlist.ts';
import { solveDcNetlist } from './solve.ts';
import type { DcResult } from './solve.ts';

export type DcModelAdapter = (instance: EquipmentInstance, context: { scene: SceneDocument; registry: EquipmentRegistry }) => DcBranch[];
export class DcAdapterError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}
export type DcModelAdapters = ReadonlyMap<string, DcModelAdapter>;
export type DcCompilation = { ok: true; netlist: DcNetlist; diagnostics: Diagnostic[] } | DcFailure;

export function compileDcScene(input: unknown, registry: EquipmentRegistry, adapters: DcModelAdapters): DcCompilation {
  const validation = validateSceneDocument(input, registry);
  if (!validation.ok) return { ...validation, measurementUsable: false };
  const scene = validation.document;
  if (scene.simulationConfig.electricalMode !== 'ideal') return dcFailure('UNCONFIGURED_APPARATUS_MODE');
  const terminals: string[] = [];
  const branches: DcBranch[] = [];
  for (const instance of scene.equipment) {
    const definition = registry.get(instance.type, instance.definitionVersion)!;
    const adapter = adapters.get(definition.modelAdapterId);
    if (!adapter) return dcFailure('UNSUPPORTED_DC_MODEL', [instance.id]);
    for (const port of definition.ports) {
      if (port.kind === 'electrical-terminal') terminals.push(endpointKey({ equipmentId: instance.id, portId: port.id }));
    }
    try { branches.push(...adapter(instance, { scene, registry })); }
    catch (error) { return dcFailure(error instanceof DcAdapterError ? error.code : 'DC_ADAPTER_FAILED', [instance.id]); }
  }
  for (const connection of scene.connections) {
    if (connection.kind !== 'wire') return dcFailure('UNSUPPORTED_DC_CONNECTION', [connection.id]);
    const from = connection.from ? endpointKey(connection.from) : `free:${connection.id}:from`;
    const to = connection.to ? endpointKey(connection.to) : `free:${connection.id}:to`;
    if (!connection.from) terminals.push(from);
    if (!connection.to) terminals.push(to);
    branches.push(connection.from && connection.to ? { id: connection.id, kind: 'wire', from, to, resistanceOhm: 0 }
      : { id: connection.id, kind: 'open', from, to });
  }
  const checked = validateDcNetlist({ terminals, branches });
  return checked.ok ? { ok: true, netlist: checked.netlist, diagnostics: [] } : checked;
}

export function solveDcScene(input: unknown, registry: EquipmentRegistry, adapters: DcModelAdapters): DcResult {
  const compiled = compileDcScene(input, registry, adapters);
  return compiled.ok ? solveDcNetlist(compiled.netlist) : compiled;
}
