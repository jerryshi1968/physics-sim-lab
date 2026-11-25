import { useEffect, useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { advanceTapePosition, startTape, tapeLengthM, tickerRig, tickerSignature, tickerTapeHandlingNotice, tickerTimeLimitS } from '../../equipment/ticker/simulate.ts';
import type { TapePlacement, TapeRun } from '../../equipment/ticker/simulate.ts';

interface State { signature: string; fixed: boolean; installed: boolean; powered: boolean; dragging: boolean; taken: boolean; run: TapeRun | null; lastMs: number; anchor: { run: TapeRun; atMs: number } | null; paper: TapePlacement | null; origin: number; target: number; choosing: 'origin' | 'target'; notice: string }
const initial = (signature: string): State => ({ signature, fixed: false, installed: false, powered: false, dragging: false, taken: false, run: null, lastMs: 0, anchor: null, paper: null, origin: 0, target: 5, choosing: 'origin', notice: '' });
function advance(state: State, now: number): State {
  if (!state.powered || !state.run) return state;
  const source = state.anchor?.run ?? state.run, atMs = state.anchor?.atMs ?? state.lastMs;
  const run = advanceTapePosition(source, Math.max(0, now - atMs) / 1000, source.displacementM);
  const powered = run.timeS < tickerTimeLimitS;
  return { ...state, run, lastMs: now, powered, dragging: powered && state.dragging, anchor: powered ? state.anchor : null };
}

export function useTicker(scene: SceneDocument, enabled: boolean) {
  const signature = enabled ? tickerSignature(scene) : '';
  const [stored, setState] = useState(() => initial(signature));
  const state = stored.signature === signature ? stored : initial(signature);
  if (state !== stored) setState(state);
  const rig = enabled ? tickerRig(scene) : null;

  useEffect(() => {
    if (!state.powered) return;
    let handle = 0;
    const tick = (now: number) => { setState(current => current.signature === signature ? advance(current, now) : current); handle = requestAnimationFrame(tick); };
    const stop = () => setState(current => ({ ...advance(current, performance.now()), powered: false, dragging: false, anchor: null }));
    const hidden = () => { if (document.hidden) stop(); };
    handle = requestAnimationFrame(tick);
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', hidden);
    return () => { cancelAnimationFrame(handle); window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', hidden); };
  }, [state.powered, signature]);

  const change = (update: (current: State) => State) => setState(current => current.signature === signature ? update(advance(current, performance.now())) : current);
  return { ...state, rig,
    fix: () => { if (rig?.ok) change(current => current.powered ? { ...current, notice: '请先关闭计时器电源，再打开固定夹。' } : { ...current, fixed: !current.fixed, notice: current.fixed ? '固定夹已打开。断电状态可以穿入或取下纸带。' : current.installed ? '固定夹已扣上，可以点击机身开关通电。' : '固定夹已扣上，穿带前请先打开固定夹。' }); },
    movePaper: (paper: TapePlacement) => { if ([paper.xM, paper.yM].every(Number.isFinite)) change(current => {
      const blocked = current.powered || current.installed ? tickerTapeHandlingNotice(current.powered, current.fixed) : null;
      return blocked ? { ...current, notice: blocked } : { ...current, paper, installed: false, taken: !!current.run, notice: '' };
    }); },
    restorePaper: (paper: TapePlacement | null, installed: boolean, taken: boolean) => change(current => ({ ...current, paper, installed, taken, notice: '已取消纸带移动。' })),
    dropPaper: (paper: TapePlacement) => change(current => {
      if (!rig?.ok || current.run) return current;
      const blocked = tickerTapeHandlingNotice(current.powered, current.fixed);
      if (blocked) return { ...current, notice: blocked };
      const near = Math.abs(paper.xM - rig.ticker.pose.xM) <= .13 && Math.abs(paper.yM - rig.ticker.pose.yM) <= .055;
      if (!near) return { ...current, notice: '将纸带中间拖到计时器的纸带通道。' };
      return { ...current, installed: true, taken: false, paper: null, notice: '纸带已穿好，请先扣上固定夹，再点击机身开关通电。' };
    }),
    togglePower: () => { if (rig?.ok) change(current => {
      if (current.powered) return { ...current, powered: false, dragging: false, anchor: null, notice: '已断电。请先打开固定夹，再拖出纸带。' };
      if (!current.installed) return { ...current, notice: '请先在断电、固定夹打开时穿入纸带。' };
      if (!current.fixed) return { ...current, notice: '请先扣上固定夹，再开启计时器电源。' };
      if (current.run) return { ...current, notice: '本次纸带已停止打点，请取下测量，或取用新纸带。' };
      const run = startTape(scene, 'tape-' + crypto.randomUUID());
      return { ...current, run: run ? { ...run, interaction: 'pointer.v2' } : null, powered: true, taken: false, lastMs: performance.now(), notice: '已通电。拖纸带右端向右拉动，松手即停。' };
    }); },
    beginPull: () => change(current => current.powered && current.run ? { ...current, dragging: true, anchor: { run: current.run, atMs: performance.now() }, notice: '' } : current),
    pullTo: (positionM: number) => setState(current => {
      if (current.signature !== signature || !current.powered || !current.anchor || !Number.isFinite(positionM)) return current;
      const now = performance.now(), source = current.anchor.run;
      const run = advanceTapePosition(source, Math.max(1e-6, (now - current.anchor.atMs) / 1000), Math.min(tapeLengthM, Math.max(source.displacementM, positionM)));
      const powered = run.timeS < tickerTimeLimitS;
      return { ...current, run, lastMs: now, anchor: powered ? { run, atMs: now } : null, powered, dragging: powered };
    }),
    endPull: () => change(current => ({ ...current, dragging: false, anchor: null, notice: current.powered ? '拉带已停，计时器仍通电；先点击橙色开关断电，再打开固定夹取带。' : current.notice })),
    choose: (index: number) => change(current => {
      if (!current.taken || !current.run?.dots[index]) return current;
      return current.choosing === 'origin' ? { ...current, origin: index, target: Math.min(current.run.dots.length - 1, index + 5), choosing: 'target', notice: '起点已选。再点击后面的点选择终点。' } : index > current.origin ? { ...current, target: index, choosing: 'origin', notice: '起止点已选，请数间隔并自行读尺。' } : { ...current, notice: '终点编号须大于起点；纸带打点先后方向由右向左。' };
    }),
    setPoint: (kind: 'origin' | 'target', index: number) => change(current => ({ ...current, [kind]: index, ...(kind === 'origin' ? { target: Math.min((current.run?.dots.length ?? 1) - 1, index + 5) } : {}), choosing: kind === 'origin' ? 'target' : 'origin' })),
    setChoosing: (choosing: 'origin' | 'target') => change(current => ({ ...current, choosing })),
    reset: () => setState(initial(signature)),
    renew: () => change(current => {
      const blocked = current.powered || current.installed ? tickerTapeHandlingNotice(current.powered, current.fixed) : null;
      return blocked ? { ...current, notice: blocked } : { ...initial(signature), fixed: current.fixed };
    }),
  };
}
export type TickerSimulation = ReturnType<typeof useTicker>;
