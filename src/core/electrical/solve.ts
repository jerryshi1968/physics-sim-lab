import type { Diagnostic } from '../diagnostics/diagnostic.ts';
import { branchResistance, DC_MODEL_VERSION, dcFailure, electricalDiagnostic, isVoltageBranch, validateDcNetlist } from './netlist.ts';
import type { DcBranch, DcFailure } from './netlist.ts';
import { buildDcTopology } from './topology.ts';
import type { DcComponent } from './topology.ts';
import { createLinearSystem, MAX_DC_UNKNOWNS, solveLinearSystem, stampAffineConductance, stampVoltageBranch } from './linear.ts';
import { lampBrightness, lampDifferentialOhm, lampVoltageV } from './lamp.ts';

export interface DcBranchValue {
  id: string; kind: DcBranch['kind']; voltageV: number | null; currentA: number | null; powerW: number | null;
  voltageStatus: 'valid' | 'undefined-between-components'; currentStatus: 'valid' | 'not-observable';
  measurementUsable: boolean;
  internalLossW?: number; emfPowerW?: number;
  brightness?: number;
}
export interface DcResiduals {
  kclA: number; normalizedKcl: number; normalizedConstitutive: number;
  powerBalanceW: number; normalizedPower: number; linear: number;
}
export interface DcSolution {
  modelVersion: string;
  iterations: number; minimumDamping: number;
  components: DcComponent[];
  nodes: { id: string; terminals: string[]; componentId: string; voltageV: number; isReference: boolean }[];
  branches: DcBranchValue[];
  residuals: DcResiduals;
}
export type DcResult = { ok: true; solution: DcSolution; diagnostics: Diagnostic[] } | DcFailure;

export interface DcSolveOptions { maxIterations?: number; maxBacktracks?: number }

export function solveDcNetlist(input: unknown, options: DcSolveOptions = {}): DcResult {
  const maxIterations = options.maxIterations ?? 64, maxBacktracks = options.maxBacktracks ?? 20;
  if (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > 256 || !Number.isInteger(maxBacktracks) || maxBacktracks < 0 || maxBacktracks > 30) return dcFailure('INVALID_SOLVE_OPTIONS');
  const checked = validateDcNetlist(input);
  if (!checked.ok) return checked;
  const netlist = checked.netlist;
  const built = buildDcTopology(netlist);
  if (!built.ok) return built;
  const topology = built.topology;
  const diagnostics = [...topology.diagnostics];
  const voltageByNode = new Map<string, number>();
  const currentByBranch = new Map<string, number>();
  let linearResidual = 0;
  let iterations = 0, minimumDamping = 1;
  for (const component of topology.components) {
    const voltageNodes = component.nodes.filter(node => node !== component.referenceNode);
    const nodeIndex = new Map(voltageNodes.map((node, index) => [node, index]));
    const branches = netlist.branches.filter(branch => branchResistance(branch) !== null
      && topology.componentForNode.get(topology.nodeForTerminal.get(branch.from)!) === component.id);
    const voltageBranches = branches.filter(isVoltageBranch);
    const currentIndex = new Map(voltageBranches.map((branch, index) => [branch.id, voltageNodes.length + index]));
    const size = voltageNodes.length + voltageBranches.length;
    if (size > MAX_DC_UNKNOWNS) return dcFailure('NETWORK_TOO_LARGE', branches.map(branch => branch.id));
    const hasLamps = branches.some(branch => branch.kind === 'lamp');
    function assemble(state: number[]) {
      const system = createLinearSystem(size);
      for (const branch of branches) {
      if (topology.mergedBranches.has(branch.id)) continue;
      const a = nodeIndex.get(topology.nodeForTerminal.get(branch.from)!);
      const b = nodeIndex.get(topology.nodeForTerminal.get(branch.to)!);
      if (isVoltageBranch(branch)) {
        const current = state[currentIndex.get(branch.id)!]!;
        const resistance = branch.kind === 'lamp' ? lampDifferentialOhm(current, branch) : branchResistance(branch)!;
        const voltage = branch.kind === 'lamp' ? lampVoltageV(current, branch) - resistance * current : branch.kind === 'voltage-source' ? branch.voltageV : 0;
        stampVoltageBranch(system, a, b, currentIndex.get(branch.id)!, voltage, resistance);
      } else {
        const conductance = 1 / branchResistance(branch)!;
        if (!Number.isFinite(conductance) || conductance === 0) return null;
        stampAffineConductance(system, a, b, conductance);
      }
      }
      return system;
    }

    function errorAt(state: number[]): number {
      const sums = new Map(component.nodes.map(node => [node, { sum: 0, scale: 0 }]));
      let residual = 0;
      for (const branch of branches) {
        if (topology.mergedBranches.has(branch.id)) continue;
        const a = topology.nodeForTerminal.get(branch.from)!, b = topology.nodeForTerminal.get(branch.to)!;
        const voltage = (nodeIndex.has(a) ? state[nodeIndex.get(a)!]! : 0) - (nodeIndex.has(b) ? state[nodeIndex.get(b)!]! : 0);
        const current = isVoltageBranch(branch) ? state[currentIndex.get(branch.id)!]! : voltage / branchResistance(branch)!;
        sums.get(a)!.sum += current; sums.get(b)!.sum -= current;
        sums.get(a)!.scale += Math.abs(current); sums.get(b)!.scale += Math.abs(current);
        if (isVoltageBranch(branch)) {
          const drop = branch.kind === 'lamp' ? lampVoltageV(current, branch) : branchResistance(branch)! * current;
          const emf = branch.kind === 'voltage-source' ? branch.voltageV : 0;
          residual = Math.max(residual, Math.abs(voltage - drop - emf) / Math.max(1e-9, Math.abs(voltage) + Math.abs(drop) + Math.abs(emf)));
        }
      }
      for (const node of sums.values()) residual = Math.max(residual, Math.abs(node.sum) / Math.max(1e-9, node.scale));
      return Number.isFinite(residual) && state.every(Number.isFinite) ? residual : Infinity;
    }

    let state = Array<number>(size).fill(0);
    let converged = hasLamps && errorAt(state) <= 1e-10;
    for (let iteration = 0; iteration < (hasLamps ? maxIterations : 1) && !converged; iteration++) {
      const system = assemble(state);
      if (!system) return dcFailure('NUMERIC_RANGE', branches.map(branch => branch.id));
      const solved = solveLinearSystem(system);
      if (!solved.ok) return dcFailure(solved.code, branches.map(branch => branch.id));
      linearResidual = Math.max(linearResidual, solved.relativeResidual);
      iterations = Math.max(iterations, iteration + 1);
      if (!hasLamps) { state = solved.values; converged = true; break; }
      const previousError = errorAt(state);
      let accepted = false;
      for (let backtrack = 0; backtrack <= maxBacktracks; backtrack++) {
        const damping = 2 ** -backtrack;
        const candidate = state.map((value, index) => value + damping * (solved.values[index]! - value));
        const error = errorAt(candidate);
        if (error <= 1e-10 || error < previousError * (1 - 1e-4 * damping)) {
          state = candidate; accepted = true; minimumDamping = Math.min(minimumDamping, damping);
          converged = error <= 1e-10;
          break;
        }
      }
      if (!accepted) return dcFailure('NON_CONVERGENCE', branches.filter(branch => branch.kind === 'lamp').map(branch => branch.id));
    }
    if (!converged) return dcFailure('NON_CONVERGENCE', branches.filter(branch => branch.kind === 'lamp').map(branch => branch.id));
    voltageByNode.set(component.referenceNode, 0);
    for (const [node, index] of nodeIndex) voltageByNode.set(node, state[index]!);
    for (const [id, index] of currentIndex) currentByBranch.set(id, state[index]!);
  }

  const kcl = new Map([...voltageByNode.keys()].map(node => [node, { sum: 0, scale: 0 }]));
  const values: DcBranchValue[] = [];
  let powerBalance = 0, powerScale = 0, constitutiveResidual = 0;
  for (const branch of netlist.branches) {
    const a = topology.nodeForTerminal.get(branch.from)!, b = topology.nodeForTerminal.get(branch.to)!;
    const defined = topology.componentForNode.get(a) === topology.componentForNode.get(b);
    const voltage = defined ? voltageByNode.get(a)! - voltageByNode.get(b)! : null;
    const resistance = branchResistance(branch);
    const merged = topology.mergedBranches.has(branch.id);
    const current = merged ? null : resistance === null ? 0 : isVoltageBranch(branch) ? currentByBranch.get(branch.id)!
      : voltage! / resistance;
    const power = merged || current === 0 ? 0 : voltage === null || current === null ? null : voltage * current;
    const measurementUsable = branch.kind === 'voltage-probe' ? defined : current !== null;
    const value: DcBranchValue = { id: branch.id, kind: branch.kind, voltageV: voltage, currentA: current, powerW: power,
      voltageStatus: defined ? 'valid' : 'undefined-between-components', currentStatus: merged ? 'not-observable' : 'valid', measurementUsable };
    if (branch.kind === 'voltage-source') {
      value.internalLossW = branch.resistanceOhm === 0 ? 0 : current! * current! * branch.resistanceOhm;
      value.emfPowerW = branch.voltageV * current!;
    }
    if (branch.kind === 'lamp') {
      if (Math.abs(current!) > branch.maxCurrentA * (1 + 1e-9)) return dcFailure('LAMP_MODEL_RANGE', [branch.id]);
      value.brightness = lampBrightness(power!);
    }
    if ([voltage, current, power, value.internalLossW, value.emfPowerW].some(number => number !== null && number !== undefined && !Number.isFinite(number))) {
      return dcFailure('NUMERIC_RANGE', [branch.id]);
    }
    if (!defined) diagnostics.push(electricalDiagnostic('UNDEFINED_VOLTAGE', [branch.id], 'warning'));
    if (merged) diagnostics.push(electricalDiagnostic('IDEAL_LINK_CURRENT_NOT_OBSERVABLE', [branch.id], 'info'));
    if (branch.kind === 'open') diagnostics.push(electricalDiagnostic('OPEN_CONNECTION', [branch.id], 'info'));
    if (current !== null && resistance !== null) {
      kcl.get(a)!.sum += current; kcl.get(b)!.sum -= current;
      kcl.get(a)!.scale += Math.abs(current); kcl.get(b)!.scale += Math.abs(current);
      const emf = branch.kind === 'voltage-source' ? branch.voltageV : 0;
      const resistiveDrop = branch.kind === 'lamp' ? lampVoltageV(current, branch) : resistance === 0 ? 0 : resistance * current;
      const residual = Math.abs(voltage! - resistiveDrop - emf) / Math.max(1e-9, Math.abs(voltage!) + Math.abs(resistiveDrop) + Math.abs(emf));
      constitutiveResidual = Math.max(constitutiveResidual, residual);
    }
    if (power !== null) { powerBalance += power; powerScale += Math.abs(power); }
    values.push(value);
  }
  let kclA = 0, normalizedKcl = 0;
  for (const entry of kcl.values()) {
    kclA = Math.max(kclA, Math.abs(entry.sum));
    normalizedKcl = Math.max(normalizedKcl, Math.abs(entry.sum) / Math.max(1e-9, entry.scale));
  }
  const residuals: DcResiduals = { kclA, normalizedKcl, normalizedConstitutive: constitutiveResidual,
    powerBalanceW: powerBalance, normalizedPower: Math.abs(powerBalance) / Math.max(1e-9, powerScale), linear: linearResidual };
  if (!Object.values(residuals).every(Number.isFinite)) return dcFailure('NUMERIC_RANGE');
  if (normalizedKcl > 1e-6 || constitutiveResidual > 1e-6 || residuals.normalizedPower > 1e-6) return dcFailure('PHYSICAL_RESIDUAL_TOO_LARGE');
  const nodes = [...voltageByNode].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([id, voltageV]) => ({ id, voltageV,
    terminals: netlist.terminals.filter(terminal => topology.nodeForTerminal.get(terminal) === id),
    componentId: topology.componentForNode.get(id)!, isReference: topology.components.some(component => component.referenceNode === id) }));
  return { ok: true, solution: { modelVersion: DC_MODEL_VERSION, iterations, minimumDamping, components: topology.components, nodes, branches: values, residuals }, diagnostics };
}
