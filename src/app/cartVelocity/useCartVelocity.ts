import { useEffect, useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { cartView } from '../../equipment/cart/simulate.ts';
import { compileCartVelocity, advanceDrivenTape } from '../../equipment/cartVelocity/motion.ts';
import type { CartVelocityMotion } from '../../equipment/cartVelocity/motion.ts';
import { flipTapePlacement, startTape, tickerRig, tickerSignature, tickerTapeHandlingNotice, tickerTimeLimitS } from '../../equipment/ticker/simulate.ts';
import type { TapePlacement, TapeRun } from '../../equipment/ticker/simulate.ts';
import { defaultCartPositionZero } from '../../equipment/cartVelocity/positions.ts';
import { useCartPositionSelection } from './useCartPositionSelection.ts';
import type { TickerSimulation } from '../ticker/useTicker.ts';

interface State { paperOriented: boolean; signature: string; fixed: boolean; installed: boolean; powered: boolean; dragging: boolean; taken: boolean; run: TapeRun | null; paper: TapePlacement | null; origin: number; target: number; choosing: 'origin' | 'target'; notice: string; attached: boolean; detachedAttachment: boolean; motion: CartVelocityMotion | null; clockS: number; lastMs: number; trial: number }
const initial = (signature: string, trial = 1): State => ({ paperOriented: false, signature, fixed: false, installed: false, powered: false, dragging: false, taken: false, run: null, paper: null, origin: 4, target: 6, choosing: 'origin', notice: '', attached: false, detachedAttachment: false, motion: null, clockS: 0, lastMs: 0, trial });
const moving = (state: State) => !!state.motion && !state.motion.ended;
function advance(state: State, now: number): State {
  if (!state.powered && !moving(state) || !state.run) return state;
  const clockS = state.clockS + Math.max(0, now - state.lastMs) / 1000;
  const motion = state.motion ? { ...state.motion, run: { ...state.motion.run, timeS: state.motion.ended ? state.motion.run.timeS : Math.min(state.motion.run.rig.endTimeS, Math.max(0, clockS - state.motion.releasedAtS)) } } : null;
  if (motion) motion.ended ||= motion.run.timeS >= motion.run.rig.endTimeS;
  const physicalClockS = motion?.interrupted ? motion.releasedAtS + motion.run.timeS : clockS;
  const run = advanceDrivenTape(state.run, state.powered ? Math.min(clockS, tickerTimeLimitS) : state.run.timeS, Math.max(physicalClockS, state.run.timeS), motion?.run.rig ?? null, motion?.releasedAtS ?? null, state.powered);
  return { ...state, run, motion, clockS, lastMs: now, powered: state.powered && clockS < tickerTimeLimitS };
}
export function useCartVelocity(scene: SceneDocument, registry: EquipmentRegistry, enabled: boolean) {
  const signature = enabled ? tickerSignature(scene) : '', rig = enabled ? compileCartVelocity(scene, registry) : null;
  const nextTrial = new Set((scene.measurementSnapshots ?? []).filter(s => ['mechanical.cart-velocity.v1', 'mechanical.cart-positions.v1', 'mechanical.cart-positions.v2'].includes(s.modelVersion)).map(s => s.runId)).size + 1;
  const [stored, setStored] = useState(() => initial(signature, nextTrial));
  const state = stored.signature === signature ? stored : initial(signature, nextTrial);
  if (state !== stored) setStored(state);
  const positions = useCartPositionSelection(state.run, state.taken, signature);
  const active = state.powered || moving(state);
  const change = (update: (current: State) => State) => setStored(current => current.signature === signature ? update(advance(current, performance.now())) : current);
  useEffect(() => {
    if (!active) return;
    let handle = 0;
    const frame = (now: number) => { setStored(current => current.signature === signature ? advance(current, now) : current); handle = requestAnimationFrame(frame); };
    const stop = () => setStored(current => { const next = advance(current, performance.now()); return { ...next, powered: false, motion: next.motion ? { ...next.motion, ended: true, interrupted: moving(next) } : null, notice: '窗口失焦，运行已中止；可测已记录的清晰区间，换新纸带后重做。' }; });
    const hidden = () => { if (document.hidden) stop(); };
    handle = requestAnimationFrame(frame); window.addEventListener('blur', stop); document.addEventListener('visibilitychange', hidden);
    return () => { cancelAnimationFrame(handle); window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', hidden); };
  }, [active, signature]);
  const ticker: TickerSimulation = { ...state, origin: positions.zero + positions.selected * positions.stride, target: positions.zero + positions.selected * positions.stride, anchor: null, rig: enabled ? tickerRig(scene) : null,
    fix: () => change(current => current.powered || moving(current) ? { ...current, notice: '请先关闭电源并等待小车停止，再打开固定夹。' } : { ...current, fixed: !current.fixed, notice: current.fixed ? '固定夹已打开，可穿入或取下纸带。' : '固定夹已扣上，纸带连接好后点击机身开关。' }),
    movePaper: paper => change(current => { if (![paper.xM, paper.yM].every(Number.isFinite)) return current; const blocked = current.powered || current.installed ? tickerTapeHandlingNotice(current.powered, current.fixed) : null; return blocked || moving(current) ? { ...current, notice: blocked ?? '请先等待小车停止，再取纸带。' } : { ...current, paper, installed: false, taken: !!current.run, attached: false, detachedAttachment: current.installed ? current.attached : current.detachedAttachment, notice: '' }; }),
    restorePaper: (paper, installed, taken) => change(current => ({ ...current, paper, installed, taken, attached: installed && current.detachedAttachment, notice: '已取消纸带移动。' })),
    dropPaper: paper => change(current => {
      if (current.run) return current.taken && !current.paperOriented && current.paper && !current.powered && !moving(current) ? { ...current, paper: flipTapePlacement(current.paper, current.run.dots[defaultCartPositionZero(current.run)]?.displacementM ?? 0), paperOriented: true, notice: '纸带已左右翻转，计数点从左向右排列，可沿尺读位置。' } : current;
      const machine = tickerRig(scene), blocked = tickerTapeHandlingNotice(current.powered, current.fixed);
      if (!machine.ok || blocked) return { ...current, notice: blocked ?? '请先放置正确的计时器。' };
      if (Math.abs(paper.xM - machine.ticker.pose.xM) > .13 || Math.abs(paper.yM - machine.ticker.pose.yM) > .055) return { ...current, notice: '把纸带中间拖到计时器纸带通道。' };
      return { ...current, installed: true, paper: null, attached: false, notice: '纸带已穿入。把纸带右端拖到小车尾部连接，再扣上固定夹。' };
    }),
    togglePower: () => change(current => {
      if (current.powered) return { ...current, powered: false, notice: moving(current) ? '计时器已断电，小车仍按惯性与牵引继续运动；请等小车停止后取带。' : '已断电，请打开固定夹后拖出纸带。' };
      if (!rig?.ok || !current.installed || !current.attached || !current.fixed || current.run) return { ...current, notice: !rig?.ok ? rig?.message ?? '装置无效。' : current.run ? '本次纸带已停止打点，请换新纸带后重做。' : '请先断电开夹穿带、把纸带右端连接小车，并扣上固定夹。' };
      return { ...current, run: { ...startTape(scene, 'cart-tape-' + crypto.randomUUID())!, interaction: 'pointer.v2' }, powered: true, clockS: 0, lastMs: performance.now(), notice: '计时器已启动，点击车身放开小车。' };
    }),
    beginPull: () => change(current => ({ ...current, notice: '纸带由小车拖动。请先通电，再点击车身放开小车。' })),
    pullTo: () => {}, endPull: () => {},
    choose: positions.choose,
    setPoint: (kind, index) => change(current => ({ ...current, [kind]: index, ...(kind === 'origin' ? { target: Math.min((current.run?.dots.length ?? 1) - 1, index + 5) } : {}) })),
    setChoosing: choosing => change(current => ({ ...current, choosing })), reset: () => setStored(initial(signature)),
    renew: () => change(current => { const blocked = current.powered || current.installed ? tickerTapeHandlingNotice(current.powered, current.fixed) : null; return blocked || moving(current) ? { ...current, notice: blocked ?? '请等小车停止，再换纸带。' } : { ...initial(signature, current.trial + (current.run ? 1 : 0)), fixed: current.fixed }; }),
  };
  const rear = rig?.ok ? { xM: rig.startXM - .11 + (state.run?.displacementM ?? 0), yM: rig.track.pose.yM + .052 } : { xM: 0, yM: 0 };
  return { ticker, rig, positions, flipPaper: () => change(current => !current.taken || current.installed || current.powered || moving(current) || !current.paper || !current.run ? current : { ...current, paper: flipTapePlacement(current.paper, current.run.dots[positions.zero + positions.selected * positions.stride]?.displacementM ?? 0), paperOriented: true, notice: current.paper.flippedX ? '纸带已翻回原方向。' : '纸带已左右翻转，计数点从左向右排列。' }), trial: state.trial, motion: state.motion, moving: moving(state), viewScene: cartView(scene, state.motion?.run ?? null),
    coupling: { attached: state.attached, carRear: rear,
      bounds: rig?.ok ? { minX: Math.min(rig.track.pose.xM - Number(rig.track.parameters.lengthM) / 2 - .1, rig.ticker!.pose.xM - .22), maxX: rig.rightXM + .15, minY: Math.min(-1.05, rig.track.pose.yM - .18 - rig.travelM), maxY: rig.track.pose.yM + .3 } : null,
      attach: (point: TapePlacement) => change(current => !rig?.ok || !current.installed || current.run || current.powered || Math.abs(point.xM - rear.xM) > .09 || Math.abs(point.yM - rear.yM) > .07 ? { ...current, notice: '在通电前，把已穿入纸带的右端拖到小车尾部。' } : { ...current, attached: true, notice: '纸带已连接小车。扣夹通电后点击车身放开。' }),
    },
    release: () => change(current => !rig?.ok || !current.powered || !current.attached || !current.fixed || current.motion || !current.run ? { ...current, notice: '请先穿好纸带、连接小车、扣夹并开启计时器。' } : { ...current, motion: { run: { rig, id: current.run.id, signature, timeS: 0 }, releasedAtS: current.clockS, ended: false, interrupted: false }, notice: '小车正在牵引下运动；停止后立即点击机身开关断电。' }),
  };
}
export type CartVelocitySimulation = ReturnType<typeof useCartVelocity>;
