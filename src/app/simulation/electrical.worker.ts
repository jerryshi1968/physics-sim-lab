import { SimulationRequestSchema } from '../../core/simulation/protocol.ts';
import type { SimulationReply } from '../../core/simulation/protocol.ts';
import { simulateElectrical } from '../../equipment/electrical/simulate.ts';
import { dcFailure } from '../../core/electrical/netlist.ts';

const scope = globalThis as unknown as { onmessage: ((event: MessageEvent<unknown>) => void) | null; postMessage: (message: SimulationReply) => void };
scope.onmessage = event => {
  const parsed = SimulationRequestSchema.safeParse(event.data);
  if (!parsed.success) return;
  const { documentId, documentRevision, runId, sequence, payload } = parsed.data;
  let outcome;
  try { outcome = simulateElectrical(payload); }
  catch { outcome = { result: dcFailure('COMPUTATION_FAILED'), meters: [] }; }
  scope.postMessage({ documentId, documentRevision, runId, sequence, commandType: 'result', payload: outcome });
};
