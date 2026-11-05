import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptSimulationReply, createReplyGate, issueSimulation, SimulationRequestSchema } from '../../src/core/simulation/protocol.ts';
import { createEmptyScene } from '../../src/core/scene/create.ts';
import { dcFailure } from '../../src/core/electrical/netlist.ts';

const tag = { documentId: 'scene.a', documentRevision: 3, runId: 'run.a', sequence: 2 };
const reply = (changes = {}) => ({ ...tag, commandType: 'result', payload: { result: dcFailure('NON_CONVERGENCE'), meters: [] }, ...changes });

test('only the exact pending document/revision/run/sequence result can be accepted', () => {
  const gate = issueSimulation(createReplyGate(), tag);
  assert.equal(acceptSimulationReply(gate, reply()), true);
  for (const changes of [{ documentId: 'scene.b' }, { documentRevision: 2 }, { runId: 'run.old' }, { sequence: 1 }, { sequence: 3 }, { commandType: 'solve' }]) {
    assert.equal(acceptSimulationReply(gate, reply(changes)), false);
  }
});

test('a newer edit, restart, reset or already accepted reply rejects delayed and duplicate packets', () => {
  const gate = issueSimulation(createReplyGate(), tag);
  assert.equal(acceptSimulationReply(issueSimulation(gate, { ...tag, documentRevision: 4, sequence: 3 }), reply()), false);
  assert.equal(acceptSimulationReply(issueSimulation(gate, { ...tag, runId: 'run.new', sequence: 1 }), reply()), false);
  assert.equal(acceptSimulationReply(createReplyGate(), reply()), false);
  assert.equal(acceptSimulationReply({ ...gate, acceptedSequence: 2 }, reply()), false);
});

test('switching documents with the same revision cannot reuse the previous result', () => {
  const gate = issueSimulation(createReplyGate(), { ...tag, documentId: 'scene.b' });
  assert.equal(acceptSimulationReply(gate, reply()), false);
  assert.equal(acceptSimulationReply(gate, reply({ documentId: 'scene.b' })), true);
});

test('requests are serializable snapshots with matching revision and ID, not executable callbacks', () => {
  const scene = createEmptyScene('scene.a', '2026-11-04T03:00:00.000Z'); scene.revision = 3;
  const request = { ...tag, commandType: 'solve', payload: scene };
  assert.equal(SimulationRequestSchema.safeParse(JSON.parse(JSON.stringify(request))).success, true);
  assert.equal(SimulationRequestSchema.safeParse({ ...request, documentRevision: 4 }).success, false);
  assert.equal(SimulationRequestSchema.safeParse({ ...request, documentId: 'scene.b' }).success, false);
  assert.equal(SimulationRequestSchema.safeParse({ ...request, sequence: 0 }).success, false);
  assert.equal(SimulationRequestSchema.safeParse({ ...request, callback: 'alert(1)' }).success, false);
});

test('malformed and non-integer packets are harmless and cannot clear a pending request', () => {
  const gate = issueSimulation(createReplyGate(), tag);
  for (const packet of [null, undefined, {}, reply({ sequence: 2.5 }), reply({ payload: {} })]) assert.equal(acceptSimulationReply(gate, packet), false);
  assert.deepEqual(gate.pending, tag);
});
