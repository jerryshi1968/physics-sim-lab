import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { RULER, SCREEN } from '../optical/definitions.ts';
import { MIRROR } from '../reflection/definitions.ts';
import { EYE, MATCH, MIRROR_IMAGE_EXPERIMENT, TARGET, mirrorImageApparatus, mirrorImageTypes } from './definitions.ts';

const epsilon = 1e-7;
const screenToleranceM = .005;
type Point = { xM: number; yM: number };
type Segment = { bottom: Point; top: Point };

export const isMirrorImageScene = (scene: SceneDocument) => scene.experimentId === MIRROR_IMAGE_EXPERIMENT || scene.equipment.some(item => mirrorImageTypes.includes(item.type));

export function markerSegment(item: EquipmentInstance): Segment {
  const { xM, yM } = item.pose, half = Number(item.parameters.heightM) / 2;
  return { bottom: { xM, yM: yM - half }, top: { xM, yM: yM + half } };
}

export function mirrorImageRulers(equipment: readonly EquipmentInstance[]) {
  const rulers = equipment.filter(item => item.type === RULER);
  return {
    distance: rulers.find(item => Math.abs(Math.sin(item.pose.rotationRad)) < epsilon),
    height: rulers.find(item => Math.abs(Math.cos(item.pose.rotationRad)) < epsilon),
  };
}

export function rulerCovers(ruler: EquipmentInstance | undefined, coordinates: readonly number[], vertical = false) {
  if (!ruler) return false;
  const start = vertical ? ruler.pose.yM : ruler.pose.xM;
  const direction = vertical ? Math.sin(ruler.pose.rotationRad) : Math.cos(ruler.pose.rotationRad);
  const end = start + Number(ruler.parameters.lengthM) * direction;
  return coordinates.every(value => value >= Math.min(start, end) - epsilon && value <= Math.max(start, end) + epsilon);
}

export function simulateMirrorImage(scene: SceneDocument) {
  const fail = (code: string) => ({ ok: false as const, code });
  if (scene.connections.length || scene.equipment.some(item => !mirrorImageApparatus.includes(item.type))) return fail('MIRROR_MIXED');
  if (scene.simulationConfig.randomError.enabled || scene.equipment.some(item => item.pose.flippedX || Math.abs(item.pose.xM) > 10 || Math.abs(item.pose.yM) > 10 || item.type !== RULER && Math.abs(item.pose.rotationRad) > epsilon)) return fail('MIRROR_RANGE');
  const ofType = (type: string) => scene.equipment.filter(item => item.type === type);
  const [mirror, extraMirror] = ofType(MIRROR), [target, extraTarget] = ofType(TARGET), [eye, extraEye] = ofType(EYE);
  const [match, extraMatch] = ofType(MATCH), [screen, extraScreen] = ofType(SCREEN);
  if (!mirror || !target || !eye || extraMirror || extraTarget || extraEye || extraMatch || extraScreen) return fail('MIRROR_APPARATUS');
  const mirrorX = mirror.pose.xM, eyePosition = eye.pose;
  if (target.pose.xM >= mirrorX - epsilon || eyePosition.xM >= mirrorX - epsilon) return fail('MIRROR_FRONT');
  const halfLength = Number(mirror.parameters.lengthM) / 2;
  const mirrorBottom = mirror.pose.yM - halfLength, mirrorTop = mirror.pose.yM + halfLength;
  const object = markerSegment(target);
  const image = { bottom: { ...object.bottom, xM: 2 * mirrorX - object.bottom.xM }, top: { ...object.top, xM: 2 * mirrorX - object.top.xM } };
  const intercept = (point: Point): Point => ({ xM: mirrorX, yM: eyePosition.yM + (point.yM - eyePosition.yM) * (mirrorX - eyePosition.xM) / (point.xM - eyePosition.xM) });
  const projection = (segment: Segment) => {
    const bottom = intercept(segment.bottom), top = intercept(segment.top);
    return { bottom, top, visible: top.yM > mirrorBottom && bottom.yM < mirrorTop, complete: bottom.yM >= mirrorBottom - epsilon && top.yM <= mirrorTop + epsilon };
  };
  const imageProjection = projection(image);
  const comparison = match && match.pose.xM > mirrorX + epsilon ? markerSegment(match) : null;
  const matchProjection = comparison ? projection(comparison) : null;
  const screenSegment = screen ? markerSegment(screen) : null;
  const screenTest = !!screenSegment && Math.abs(screenSegment.bottom.xM - image.bottom.xM) <= screenToleranceM + epsilon
    && screenSegment.bottom.yM <= image.bottom.yM + epsilon && screenSegment.top.yM >= image.top.yM - epsilon;
  return { ok: true as const, mirror, target, eye, match, screen, mirrorBottom, mirrorTop, object, image, comparison, imageProjection, matchProjection, screenTest,
    objectDistanceM: mirrorX - object.bottom.xM, imageDistanceM: image.bottom.xM - mirrorX, heightM: Number(target.parameters.heightM) };
}

export type MirrorImageOutcome = ReturnType<typeof simulateMirrorImage>;

export function mirrorImageMessage(code: string) {
  return ({ MIRROR_MIXED: '请只保留成像实验所用的光学器材。', MIRROR_RANGE: '本实验使用竖直薄玻璃板和固定朝向的标记物，请检查器材属性。',
    MIRROR_APPARATUS: '需要各一件平面镜、成像标记物和观察眼。对照物和光屏各最多一件，刻度尺可放多把。',
    MIRROR_FRONT: '请把标记物和观察眼放在玻璃板左侧，从镜前观察。',
  } as Record<string, string>)[code] ?? '请检查装置后再观察。';
}
