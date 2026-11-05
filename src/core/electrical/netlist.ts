import { z } from 'zod';
import { FiniteSchema, IdSchema } from '../equipment/schema.ts';
import type { Diagnostic } from '../diagnostics/diagnostic.ts';
import { LampParametersSchema } from './lamp.ts';

export const DC_MODEL_VERSION = 'dc-mna.v2';

const TerminalSchema = z.string().min(1).max(500);
const ends = { id: IdSchema, from: TerminalSchema, to: TerminalSchema };
const resistance = FiniteSchema.nonnegative();
export const DcBranchSchema = z.discriminatedUnion('kind', [
  LampParametersSchema.safeExtend({ ...ends, kind: z.literal('lamp') }),
  z.strictObject({ ...ends, kind: z.literal('resistor'), resistanceOhm: FiniteSchema.positive() }),
  z.strictObject({ ...ends, kind: z.literal('wire'), resistanceOhm: resistance }),
  z.strictObject({ ...ends, kind: z.literal('switch'), closed: z.boolean(), resistanceOhm: resistance }),
  z.strictObject({ ...ends, kind: z.literal('voltage-source'), voltageV: FiniteSchema, resistanceOhm: resistance }),
  z.strictObject({ ...ends, kind: z.literal('current-meter'), resistanceOhm: resistance }),
  z.strictObject({ ...ends, kind: z.literal('voltage-probe'), inputResistanceOhm: FiniteSchema.positive().nullable() }),
  z.strictObject({ ...ends, kind: z.literal('open') }),
]);
export const DcNetlistSchema = z.strictObject({ terminals: z.array(TerminalSchema).max(1800), branches: z.array(DcBranchSchema).max(2000) });
export type DcBranch = z.infer<typeof DcBranchSchema>;
export type DcNetlist = z.infer<typeof DcNetlistSchema>;
export type DcFailure = { ok: false; measurementUsable: false; diagnostics: Diagnostic[] };

export function electricalDiagnostic(code: string, equipmentIds: string[] = [], severity: Diagnostic['severity'] = 'error'): Diagnostic {
  return { code, equipmentIds, severity, measurementUsable: false, messageKey: `electrical.${code}` };
}

export function dcFailure(code: string, equipmentIds: string[] = []): DcFailure {
  return { ok: false, measurementUsable: false, diagnostics: [electricalDiagnostic(code, equipmentIds)] };
}

export function validateDcNetlist(input: unknown): { ok: true; netlist: DcNetlist } | DcFailure {
  const parsed = DcNetlistSchema.safeParse(input);
  if (!parsed.success) return dcFailure('INVALID_DC_NETLIST');
  const netlist = parsed.data;
  const terminals = new Set(netlist.terminals);
  if (terminals.size !== netlist.terminals.length) return dcFailure('DUPLICATE_TERMINAL');
  const ids = new Set<string>();
  for (const branch of netlist.branches) {
    if (ids.has(branch.id)) return dcFailure('DUPLICATE_BRANCH_ID', [branch.id]);
    ids.add(branch.id);
    if (!terminals.has(branch.from) || !terminals.has(branch.to)) return dcFailure('UNKNOWN_TERMINAL', [branch.id]);
  }
  return { ok: true, netlist: { terminals: [...netlist.terminals].sort(), branches: [...netlist.branches].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) } };
}

export function branchResistance(branch: DcBranch): number | null {
  if (branch.kind === 'lamp') return branch.coldResistanceOhm;
  if (branch.kind === 'open' || (branch.kind === 'switch' && !branch.closed)) return null;
  return branch.kind === 'voltage-probe' ? branch.inputResistanceOhm : branch.resistanceOhm;
}

export function isVoltageBranch(branch: DcBranch): boolean {
  return branch.kind === 'lamp' || branch.kind === 'voltage-source' || (branch.kind === 'current-meter' && branch.resistanceOhm === 0);
}
