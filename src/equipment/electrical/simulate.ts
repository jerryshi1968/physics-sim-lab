import type { SceneDocument } from '../../core/scene/schema.ts';
import type { DcResult, DcSolveOptions } from '../../core/electrical/solve.ts';
import { solveDcNetlist } from '../../core/electrical/solve.ts';
import { compileDcScene } from '../../core/electrical/compile.ts';
import { meterConnection, meterReading } from '../../core/electrical/instruments.ts';
import type { MeterReading } from '../../core/electrical/instruments.ts';
import { createElectricalRegistry, AMMETER, VOLTMETER } from './definitions.ts';
import { createDcModelAdapters } from './dcAdapters.ts';

export interface ElectricalOutcome { result: DcResult; meters: MeterReading[] }
export function simulateElectrical(scene: SceneDocument, options: DcSolveOptions = {}): ElectricalOutcome {
  const registry = createElectricalRegistry();
  const compiled = compileDcScene(scene, registry, createDcModelAdapters());
  const result = compiled.ok ? solveDcNetlist(compiled.netlist, options) : compiled;
  return { result, meters: result.ok ? scene.equipment.filter(item => item.type === AMMETER || item.type === VOLTMETER).map(item =>
    meterReading(item, meterConnection(scene, item.id), result.solution.branches.find(branch => branch.id === item.id), item.type === AMMETER ? 'A' : 'V')) : [] };
}
