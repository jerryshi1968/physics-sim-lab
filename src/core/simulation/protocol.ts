import { z } from 'zod';
import { IdSchema } from '../equipment/schema.ts';
import { SceneDocumentSchema } from '../scene/schema.ts';
import type { ElectricalOutcome } from '../../equipment/electrical/simulate.ts';

export const SimulationRequestSchema = z.strictObject({
  documentId: IdSchema, documentRevision: z.number().int().nonnegative(), runId: IdSchema,
  sequence: z.number().int().positive(), commandType: z.literal('solve'), payload: SceneDocumentSchema,
}).refine(request => request.documentId === request.payload.documentId && request.documentRevision === request.payload.revision, { message: 'Request snapshot mismatch' });
export type SimulationRequest = z.infer<typeof SimulationRequestSchema>;
export type SimulationTag = Pick<SimulationRequest, 'documentId' | 'documentRevision' | 'runId' | 'sequence'>;
export interface SimulationReply extends SimulationTag { commandType: 'result'; payload: ElectricalOutcome }
export interface ReplyGate { pending: SimulationTag | null; acceptedSequence: number }

export function createReplyGate(): ReplyGate { return { pending: null, acceptedSequence: 0 }; }
export function issueSimulation(gate: ReplyGate, tag: SimulationTag): ReplyGate {
  return { pending: { ...tag }, acceptedSequence: gate.pending?.runId === tag.runId ? gate.acceptedSequence : 0 };
}
export function acceptSimulationReply(gate: ReplyGate, reply: SimulationReply): boolean {
  const tag = gate.pending;
  return !!tag && !!reply && typeof reply === 'object' && !!reply.payload && typeof reply.payload.result?.ok === 'boolean' && Array.isArray(reply.payload.meters)
    && reply.commandType === 'result' && reply.documentId === tag.documentId && reply.documentRevision === tag.documentRevision
    && reply.runId === tag.runId && reply.sequence === tag.sequence && Number.isSafeInteger(reply.sequence) && reply.sequence > gate.acceptedSequence;
}
