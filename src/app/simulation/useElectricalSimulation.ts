import { useEffect, useRef, useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { acceptSimulationReply, createReplyGate, issueSimulation } from '../../core/simulation/protocol.ts';
import type { SimulationReply, SimulationRequest } from '../../core/simulation/protocol.ts';
import { dcFailure } from '../../core/electrical/netlist.ts';

export function useElectricalSimulation(scene: SceneDocument, inputVersion = '', enabled = true) {
  const [runId, setRunId] = useState<string | null>(() => crypto.randomUUID());
  const [reply, setReply] = useState<SimulationReply | null>(null);
  const [acceptedInputVersion, setAcceptedInputVersion] = useState('');
  const gate = useRef(createReplyGate());
  const sequence = useRef(0);
  const snapshot = useRef(scene);
  useEffect(() => { snapshot.current = scene; }, [scene]);
  useEffect(() => {
    if (!enabled || runId === null || snapshot.current.equipment.length === 0) return;
    const request: SimulationRequest = { documentId: scene.documentId, documentRevision: scene.revision, runId,
      sequence: ++sequence.current, commandType: 'solve', payload: snapshot.current };
    gate.current = issueSimulation(gate.current, request);
    let worker: Worker | undefined;
    let watchdog: number | undefined;
    function finish(message: SimulationReply) {
      if (!acceptSimulationReply(gate.current, message)) return;
      gate.current = { ...gate.current, acceptedSequence: message.sequence };
      window.clearTimeout(watchdog);
      worker?.terminate();
      setReply(message);
      setAcceptedInputVersion(inputVersion);
    }
    function fail(code: string) {
      finish({ ...request, commandType: 'result', payload: { result: dcFailure(code), meters: [] } });
    }
    const timer = window.setTimeout(() => {
      try {
        worker = new Worker(new URL('./electrical.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<SimulationReply>) => finish(event.data);
        worker.onerror = event => { event.preventDefault(); fail('COMPUTATION_FAILED'); };
        watchdog = window.setTimeout(() => fail('COMPUTATION_TIMEOUT'), 10_000);
        worker.postMessage(request);
      } catch { fail('WORKER_UNAVAILABLE'); }
    }, 20);
    return () => { window.clearTimeout(timer); window.clearTimeout(watchdog); worker?.terminate(); gate.current = createReplyGate(); };
  }, [scene.documentId, scene.revision, runId, inputVersion, enabled]);
  const current = enabled && acceptedInputVersion === inputVersion && reply?.documentId === scene.documentId && reply.documentRevision === scene.revision
    && (runId === null || reply.runId === runId) ? reply.payload : null;
  const running = enabled && runId !== null;
  const samePreviewOwner = inputVersion.slice(0, inputVersion.lastIndexOf(':')) === acceptedInputVersion.slice(0, acceptedInputVersion.lastIndexOf(':'));
  const previousPreview = inputVersion && acceptedInputVersion && samePreviewOwner && running && reply?.documentId === scene.documentId
    && reply.documentRevision === scene.revision && reply.runId === runId && reply.payload.result.ok ? reply.payload : null;
  const status = current ? current.result.ok ? running ? '自动更新 · 准静态直流' : '已暂停自动更新 · 保留当前版本结果' : '计算不可用，请检查诊断'
    : running ? scene.equipment.length === 0 ? '自动更新 · 放置器材并接线' : '自动更新 · 正在计算…' : '已暂停自动更新 · 恢复后更新读数';
  return { current: current ?? previousPreview, acceptedReply: current && !inputVersion ? reply : null, running, status: inputVersion && running ? `滑片预览 · ${current ? current.result.ok ? '准静态直流' : '计算不可用' : '正在更新…'}` : status,
    start: () => setRunId(crypto.randomUUID()),
    pause: () => { gate.current = createReplyGate(); setRunId(null); },
    reset: () => { gate.current = createReplyGate(); setReply(null); setRunId(crypto.randomUUID()); },
  };
}
