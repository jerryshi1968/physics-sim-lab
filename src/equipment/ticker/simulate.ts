import type { SceneDocument } from '../../core/scene/schema.ts';
import { TICKER } from '../cart/definitions.ts';
import { MECHANICAL_RULER } from '../mechanical/definitions.ts';

export const TICKER_EXPERIMENT = 'H-MECH-05';
export const TICKER_MODEL = 'mechanical.ticker.hand-pull.v1';
export const TICKER_DIRECT_MODEL = 'mechanical.ticker.pointer.v2';
export const tapeLengthM = .8;
export const tickerTimeLimitS = 12;
export const tickerTypes = [TICKER, MECHANICAL_RULER];
export function tickerTapeHandlingNotice(powered: boolean, clampClosed: boolean): string | null {
  return powered ? '请先关闭计时器电源，再打开固定夹。' : clampClosed ? '请先打开固定夹，再穿入或取下纸带。' : null;
}
export interface TapeDot { timeS: number; displacementM: number }
export interface TapePlacement { xM: number; yM: number }
export interface TapeRun { id: string; signature: string; frequencyHz: number; timeS: number; displacementM: number; dots: TapeDot[]; interaction?: 'pointer.v2' }

export function tickerSignature(scene: SceneDocument) {
  return JSON.stringify([scene.documentId, scene.experimentId, scene.equipment.filter(item => item.type !== MECHANICAL_RULER), scene.connections, scene.simulationConfig]);
}

export function tickerRig(scene: SceneDocument) {
  const ticker = scene.equipment.find(item => item.type === TICKER);
  const ruler = scene.equipment.find(item => item.type === MECHANICAL_RULER);
  if (!ticker || scene.equipment.filter(item => item.type === TICKER).length !== 1 || scene.equipment.filter(item => item.type === MECHANICAL_RULER).length > 1 || scene.equipment.some(item => !tickerTypes.includes(item.type)) || scene.connections.length) return { ok: false as const, message: '请放置一台打点计时器；本实验仅使用计时器、纸带和刻度尺。' };
  if (![50, 60].includes(Number(ticker.parameters.frequencyHz)) || !Number.isFinite(ticker.pose.rotationRad) || Math.abs(ticker.pose.rotationRad) > 1e-8 || ticker.pose.flippedX) return { ok: false as const, message: '请将计时器水平正向摆放，并设置 50 或 60 Hz。' };
  if (scene.simulationConfig.randomError.enabled) return { ok: false as const, message: '本实验支持无随机误差的等周期打点模型。' };
  return { ok: true as const, ticker, ruler, frequencyHz: Number(ticker.parameters.frequencyHz) };
}

export function startTape(scene: SceneDocument, id: string): TapeRun | null {
  const rig = tickerRig(scene);
  return rig.ok ? { id, signature: tickerSignature(scene), frequencyHz: rig.frequencyHz, timeS: 0, displacementM: 0, dots: [{ timeS: 0, displacementM: 0 }] } : null;
}

export function advanceTape(run: TapeRun, dtS: number, speedMPerS: number): TapeRun {
  if (!Number.isFinite(dtS) || dtS < 0 || !Number.isFinite(speedMPerS) || speedMPerS < 0 || speedMPerS > .5) throw new RangeError('TICKER_INVALID_MOTION');
  const timeS = Math.min(tickerTimeLimitS, run.timeS + dtS);
  const dots = [...run.dots];
  for (let index = dots.length; index <= Math.floor(timeS * run.frequencyHz + 1e-9); index++) {
    const time = index / run.frequencyHz;
    dots.push({ timeS: time, displacementM: Math.min(tapeLengthM, run.displacementM + speedMPerS * (time - run.timeS)) });
  }
  return { ...run, timeS, displacementM: Math.min(tapeLengthM, run.displacementM + speedMPerS * (timeS - run.timeS)), dots };
}

export function advanceTapePosition(run: TapeRun, dtS: number, targetM: number): TapeRun {
  if (!Number.isFinite(dtS) || dtS < 0 || !Number.isFinite(targetM) || targetM < run.displacementM - 1e-10 || targetM > tapeLengthM || dtS === 0 && targetM !== run.displacementM) throw new RangeError('TICKER_INVALID_POINTER_MOTION');
  const duration = Math.min(dtS, tickerTimeLimitS - run.timeS), delta = Math.max(0, targetM - run.displacementM);
  const timeS = run.timeS + duration, dots = [...run.dots];
  for (let index = dots.length; index <= Math.floor(timeS * run.frequencyHz + 1e-9); index++) {
    const time = index / run.frequencyHz;
    dots.push({ timeS: time, displacementM: run.displacementM + (dtS > 0 ? delta * (time - run.timeS) / dtS : 0) });
  }
  return { ...run, interaction: 'pointer.v2', timeS, displacementM: run.displacementM + (dtS > 0 ? delta * duration / dtS : 0), dots };
}

export function tapeRulerPlacement(scene: SceneDocument, run: TapeRun, placement: TapePlacement | null, origin: number, target: number) {
  const rig = tickerRig(scene), selected = tapeSelection(run, origin, target);
  if (!rig.ok || !rig.ruler || !selected || !placement || ![placement.xM, placement.yM].every(Number.isFinite)) return null;
  const ruler = rig.ruler, gap = placement.yM - ruler.pose.yM;
  const originM = placement.xM - selected.a.displacementM - ruler.pose.xM, targetM = placement.xM - selected.b.displacementM - ruler.pose.xM;
  if (ruler.pose.flippedX || Math.abs(ruler.pose.rotationRad) > 1e-8 || Math.abs(gap) > .06 || targetM < -1e-9 || originM > Number(ruler.parameters.lengthM) + 1e-9) return null;
  return { originM: Math.max(0, originM), targetM: Math.max(0, targetM) };
}

export function tapeSelection(run: TapeRun, origin: number, target: number) {
  if (!Number.isInteger(origin) || !Number.isInteger(target) || origin < 0 || target <= origin) return null;
  const a = run.dots[origin], b = run.dots[target];
  if (!a || !b || !(b.displacementM > a.displacementM)) return null;
  if ([origin, target].some(index => [index - 1, index + 1].some(neighbor => run.dots[neighbor] && Math.abs(run.dots[neighbor]!.displacementM - run.dots[index]!.displacementM) < 1e-10))) return null;
  return { intervals: target - origin, timeS: (target - origin) / run.frequencyHz, displacementM: b.displacementM - a.displacementM, a, b };
}
