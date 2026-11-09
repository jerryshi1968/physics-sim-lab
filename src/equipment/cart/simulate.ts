import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { validateSceneDocument } from '../../core/scene/validate.ts';
import { linearFit } from '../../core/measurements/fit.ts';
import type { WorldPoint } from '../../core/workbench/geometry.ts';
import { CART, CART_EXPERIMENT, GATE, TICKER, TRACK, cartHalfLengthM, cartTypes } from './definitions.ts';

export const CART_MODEL = 'mechanical.cart.analytic.v1';
export const gateResolutionS = .00001;
export const tapeResolutionM = .001;
const railToleranceM = .03;
const epsilon = 1e-10;
const fail = (code: string) => ({ ok: false as const, code });
export const isCartScene = (scene: SceneDocument) => scene.experimentId === CART_EXPERIMENT || scene.equipment.some(item => cartTypes.includes(item.type));
export const cartSignature = (scene: SceneDocument) => JSON.stringify([scene.documentId, scene.equipment, scene.connections, scene.simulationConfig]);

export function cartDropPoint(scene: SceneDocument, type: string, point: WorldPoint): WorldPoint {
  const track = scene.equipment.find(item => item.type === TRACK);
  if (!track || type !== CART && type !== GATE || Math.abs(point.xM - track.pose.xM) > Number(track.parameters.lengthM) / 2 || Math.abs(point.yM - track.pose.yM) > .10) return point;
  return { ...point, yM: track.pose.yM };
}

function rounded(value: number, resolution: number) {
  return Number((Math.round(value / resolution) * resolution).toPrecision(12));
}

export function compileCart(scene: SceneDocument, registry: EquipmentRegistry) {
  if (!validateSceneDocument({ ...scene, measurementRecords: [], measurementSnapshots: undefined }, registry).ok) return fail('CART_DOCUMENT');
  if (scene.connections.length || scene.equipment.some(item => !cartTypes.includes(item.type))) return fail('CART_DOMAIN');
  const carts = scene.equipment.filter(item => item.type === CART), tracks = scene.equipment.filter(item => item.type === TRACK);
  const tickers = scene.equipment.filter(item => item.type === TICKER), gates = scene.equipment.filter(item => item.type === GATE);
  if (carts.length !== 1 || tracks.length !== 1 || tickers.length > 1 || gates.length > 6) return fail('CART_APPARATUS');
  const cart = carts[0]!, track = tracks[0]!, ticker = tickers[0];
  if (scene.equipment.some(({ pose }) => pose.flippedX || Math.abs(pose.rotationRad) > epsilon || Math.abs(pose.xM) > 100 || Math.abs(pose.yM) > 100)) return fail('CART_HORIZONTAL');
  const gravity = scene.simulationConfig.gravityMPerS2;
  if (scene.simulationConfig.randomError.enabled || gravity > 25) return fail('CART_MODEL');

  const halfTrack = Number(track.parameters.lengthM) / 2;
  const leftXM = track.pose.xM - halfTrack, rightXM = track.pose.xM + halfTrack, startXM = cart.pose.xM;
  if (Math.abs(cart.pose.yM - track.pose.yM) > railToleranceM || startXM < leftXM + cartHalfLengthM - epsilon || startXM >= rightXM - cartHalfLengthM) return fail('CART_OFF_TRACK');
  const hangerKg = Number(cart.parameters.hangerMassKg);
  const systemKg = Number(cart.parameters.cartMassKg) + Number(cart.parameters.loadMassKg) + hangerKg;
  const forceN = hangerKg * gravity, acceleration = forceN / systemKg;
  const trackTravelM = rightXM - cartHalfLengthM - startXM, dropLimitM = Number(track.parameters.dropLimitM);
  const travelM = acceleration === 0 ? 0 : Math.min(trackTravelM, dropLimitM);
  const endTimeS = acceleration === 0 ? 2 : Math.sqrt(2 * travelM / acceleration);
  if (!Number.isFinite(endTimeS) || endTimeS > 20 || endTimeS < .001) return fail('CART_RANGE');
  const stopReason = acceleration === 0 ? '静止对照结束' : trackTravelM < dropLimitM ? '到达轨道末端' : '悬挂砝码到达下落限位';
  const widthM = Number(cart.parameters.flagWidthM);
  const gateEvents = gates.sort((a, b) => a.pose.xM - b.pose.xM).map(gate => {
    const entry = gate.pose.xM - startXM - widthM / 2, exit = entry + widthM;
    if (Math.abs(gate.pose.yM - track.pose.yM) > railToleranceM || entry < -epsilon || exit > travelM + epsilon || acceleration === 0) return { gate, reading: null };
    const entryS = Math.sqrt(2 * Math.max(0, entry) / acceleration), exitS = Math.sqrt(2 * Math.min(travelM, exit) / acceleration);
    const inS = rounded(entryS, gateResolutionS), outS = rounded(exitS, gateResolutionS), durationS = rounded(outS - inS, gateResolutionS);
    if (durationS <= 0) return { gate, reading: null };
    return { gate, reading: { entryS, exitS, inS, outS, durationS, timeS: (inS + outS) / 2, displacementM: gate.pose.xM - startXM, velocity: widthM / durationS } };
  });
  return { ok: true as const, cart, track, ticker, gateEvents, startXM, rightXM, systemKg, forceN, acceleration, travelM, endTimeS, stopReason };
}

export type CartRig = Extract<ReturnType<typeof compileCart>, { ok: true }>;
export interface CartRun { rig: CartRig; id: string; signature: string; timeS: number }
export type CartMethod = 'gate' | 'tape';

export function cartDisplacement(rig: CartRig, timeS: number) {
  return Math.min(rig.travelM, .5 * rig.acceleration * Math.max(0, timeS) ** 2);
}

export function cartView(scene: SceneDocument, run: CartRun | null): SceneDocument {
  if (!run) return scene;
  const { rig } = run;
  return { ...scene, equipment: scene.equipment.map(item => item.id === rig.cart.id ? { ...item, pose: {
    ...item.pose, xM: rig.startXM + cartDisplacement(rig, run.timeS), yM: rig.track.pose.yM,
  } } : item) };
}

export function cartSamples(run: CartRun, method: CartMethod, stride: number) {
  if (!Number.isFinite(run.timeS) || run.timeS < 0) return [];
  const elapsedS = Math.min(run.timeS, run.rig.endTimeS);
  if (method === 'gate') return run.rig.gateEvents.flatMap(({ gate, reading }, index) => reading && reading.exitS <= elapsedS + epsilon
    ? [{ ...reading, id: gate.id, label: `光电门 ${index + 1}`, timeS: reading.timeS }] : []);
  const ticker = run.rig.ticker;
  if (!ticker || !Number.isInteger(stride) || stride < 1 || stride > 60) return [];
  const frequency = Number(ticker.parameters.frequencyHz);
  const count = Math.floor((elapsedS + epsilon) * frequency / stride);
  return Array.from({ length: count + 1 }, (_, index) => {
    const dot = index * stride, timeS = dot / frequency;
    return { id: ticker.id, label: `纸带第 ${dot} 点`, timeS, displacementM: rounded(cartDisplacement(run.rig, timeS), tapeResolutionM), velocity: null,
      inS: null, outS: null, durationS: null };
  });
}

export function cartEstimate(run: CartRun, method: CartMethod, stride: number) {
  const samples = cartSamples(run, method, stride);
  if (method === 'gate') {
    const [first, second] = samples;
    if (!first || !second || first.velocity === null || second.velocity === null || second.timeS <= first.timeS) return null;
    return (second.velocity - first.velocity) / (second.timeS - first.timeS);
  }
  const fit = linearFit(samples.map(sample => ({ x: sample.timeS ** 2, y: sample.displacementM })), 3);
  return fit ? 2 * fit.slope : null;
}

export function cartMessage(code: string) {
  return ({ CART_DOCUMENT: '装置参数无效。', CART_DOMAIN: '请单独使用小车实验器材。', CART_APPARATUS: '需要一辆小车和一条轨道，最多放置一台打点计时器和六个光电门。',
    CART_HORIZONTAL: '器材需保持水平摆放，位置须在模型范围内。', CART_MODEL: '当前模型要求关闭随机误差，重力加速度不超过 25 m/s²。',
    CART_OFF_TRACK: '将小车拖到轨道上，留出向右运动的距离。', CART_RANGE: '本组运行时长超出 0.001～20 s，请调整质量、起点或行程。',
    CART_CAPTURE: '请暂停或结束有效运行，并选择已有读数。', CART_STALE: '装置已改变，请重新释放小车后记录。',
  } as Record<string, string>)[code] ?? '当前小车实验无法运行。';
}
