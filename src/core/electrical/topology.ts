import { branchResistance, dcFailure, electricalDiagnostic, isVoltageBranch } from './netlist.ts';
import type { DcBranch, DcFailure, DcNetlist } from './netlist.ts';
import type { Diagnostic } from '../diagnostics/diagnostic.ts';
import { MAX_DC_UNKNOWNS } from './linear.ts';

export class DisjointNodes {
  private readonly parents = new Map<string, string>();
  constructor(keys: readonly string[]) { for (const key of keys) this.parents.set(key, key); }
  find(key: string): string {
    let root = key;
    while (this.parents.get(root) !== root) {
      const next = this.parents.get(root);
      if (next === undefined) throw new RangeError('UNKNOWN_TERMINAL');
      root = next;
    }
    while (key !== root) {
      const next = this.parents.get(key)!;
      this.parents.set(key, root);
      key = next;
    }
    return root;
  }
  union(a: string, b: string): boolean {
    const first = this.find(a), second = this.find(b);
    if (first === second) return false;
    this.parents.set(first < second ? second : first, first < second ? first : second);
    return true;
  }
}

export interface DcComponent { id: string; nodes: string[]; referenceNode: string }
export interface DcTopology {
  nodeForTerminal: Map<string, string>;
  componentForNode: Map<string, string>;
  components: DcComponent[];
  mergedBranches: Set<string>;
  diagnostics: Diagnostic[];
}

interface ConstraintEdge { to: string; deltaV: number; branch: DcBranch }

function checkVoltageConstraints(netlist: DcNetlist, nodes: DisjointNodes): DcFailure | null {
  const edges = new Map<string, ConstraintEdge[]>();
  for (const branch of netlist.branches) {
    if (!isVoltageBranch(branch) || branchResistance(branch) !== 0) continue;
    const a = nodes.find(branch.from), b = nodes.find(branch.to);
    const voltage = branch.kind === 'voltage-source' ? branch.voltageV : 0;
    if (a === b) return dcFailure(voltage !== 0 ? 'IDEAL_SOURCE_SHORT'
      : branch.kind === 'voltage-source' ? 'REDUNDANT_IDEAL_SOURCE' : 'ZERO_RESISTANCE_LOOP', [branch.id]);
    const queue = [{ node: a, potentialV: 0, path: [] as DcBranch[] }];
    const visited = new Set([a]);
    for (let index = 0; index < queue.length; index++) {
      const current = queue[index]!;
      if (current.node === b) {
        const mismatch = Math.abs(current.potentialV + voltage);
        const ids = [...current.path.map(item => item.id), branch.id];
        if (!Number.isFinite(mismatch)) return dcFailure('NUMERIC_RANGE', ids);
        if (mismatch > 1e-12 + 1e-10 * Math.max(Math.abs(current.potentialV), Math.abs(voltage))) {
          return dcFailure('INCONSISTENT_VOLTAGE_CONSTRAINT', ids);
        }
        return dcFailure(current.path.some(item => item.kind === 'voltage-source') || branch.kind === 'voltage-source'
          ? 'REDUNDANT_IDEAL_SOURCE' : 'ZERO_RESISTANCE_LOOP', ids);
      }
      for (const edge of edges.get(current.node) ?? []) {
        if (visited.has(edge.to)) continue;
        visited.add(edge.to);
        queue.push({ node: edge.to, potentialV: current.potentialV + edge.deltaV, path: [...current.path, edge.branch] });
      }
    }
    edges.set(a, [...(edges.get(a) ?? []), { to: b, deltaV: -voltage, branch }]);
    edges.set(b, [...(edges.get(b) ?? []), { to: a, deltaV: voltage, branch }]);
  }
  return null;
}

export function buildDcTopology(netlist: DcNetlist): { ok: true; topology: DcTopology } | DcFailure {
  const nodes = new DisjointNodes(netlist.terminals);
  const diagnostics: Diagnostic[] = [];
  const mergedBranches = new Set<string>();
  for (const branch of netlist.branches) {
    if ((branch.kind === 'wire' || branch.kind === 'switch') && branchResistance(branch) === 0) {
      if (!nodes.union(branch.from, branch.to)) diagnostics.push(electricalDiagnostic('REDUNDANT_IDEAL_LINK', [branch.id], 'info'));
      mergedBranches.add(branch.id);
    }
  }
  const nodeForTerminal = new Map(netlist.terminals.map(key => [key, nodes.find(key)]));
  const roots = [...new Set(nodeForTerminal.values())].sort();
  const connectivity = new DisjointNodes(roots);
  for (const branch of netlist.branches) {
    if (branchResistance(branch) !== null) connectivity.union(nodes.find(branch.from), nodes.find(branch.to));
  }
  const groups = new Map<string, string[]>();
  for (const node of roots) {
    const key = connectivity.find(node);
    groups.set(key, [...(groups.get(key) ?? []), node]);
  }
  const components = [...groups].map(([id, members]) => {
    const source = netlist.branches.find(branch => branch.kind === 'voltage-source' && connectivity.find(nodes.find(branch.to)) === id);
    return { id, nodes: members, referenceNode: source ? nodes.find(source.to) : members[0]! };
  });
  const componentForNode = new Map(components.flatMap(component => component.nodes.map(node => [node, component.id] as const)));
  for (const component of components) {
    const constraints = netlist.branches.filter(branch => isVoltageBranch(branch) && componentForNode.get(nodes.find(branch.from)) === component.id);
    if (component.nodes.length - 1 + constraints.length > MAX_DC_UNKNOWNS) return dcFailure('NETWORK_TOO_LARGE', constraints.map(branch => branch.id));
  }
  const invalid = checkVoltageConstraints(netlist, nodes);
  if (invalid) return invalid;
  if (components.length > 1) diagnostics.push(electricalDiagnostic('FLOATING_COMPONENTS', [], 'info'));
  return { ok: true, topology: { nodeForTerminal, componentForNode, components, mergedBranches, diagnostics } };
}
