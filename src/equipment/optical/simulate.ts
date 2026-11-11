import type { SceneDocument } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { validateSceneDocument } from '../../core/scene/validate.ts';
import { solveOpticalBench } from '../../core/optical/bench.ts';
import type { OpticalOutcome, OpticalSetup } from '../../core/optical/bench.ts';
import { BENCH, CANDLE, LENS, SCREEN } from './definitions.ts';
import { opticalApparatus } from '../support.ts';

export const OPTICAL_EXPERIMENT = 'J-OPT-02';
export const isOpticalScene = (scene: SceneDocument) => scene.experimentId === OPTICAL_EXPERIMENT || scene.equipment.some(item => item.type.startsWith('optical.'));
export function simulateOptical(scene: SceneDocument, registry: EquipmentRegistry): OpticalOutcome {
  if (!validateSceneDocument(scene, registry).ok) return { ok: false, code: 'OPTICAL_DOCUMENT' };
  if (scene.equipment.some(item => registry.get(item.type, item.definitionVersion)?.domain !== 'optical' || !opticalApparatus.includes(item.type)) || scene.connections.length) return { ok: false, code: 'OPTICAL_MIXED_DOMAIN' };
  if (scene.equipment.some(item => Math.abs(item.pose.xM) > 1000 || Math.abs(item.pose.yM) > 1000)) return { ok: false, code: 'OPTICAL_BENCH_RANGE' };
  if (scene.equipment.some(item => Math.abs(Math.sin(item.pose.rotationRad / 2)) > 1e-10 || item.pose.flippedX)) return { ok: false, code: 'OPTICAL_ORIENTATION' };
  const groups = [BENCH, CANDLE, LENS, SCREEN].map(type => scene.equipment.filter(item => item.type === type));
  if (groups.some(items => items.length === 0)) return { ok: false, code: 'OPTICAL_MISSING_APPARATUS' };
  if (groups.some(items => items.length > 1)) return { ok: false, code: 'OPTICAL_MULTIPLE_APPARATUS' };
  const [bench, candle, lens, screen] = groups.map(items => items[0]!);
  const positioned = (item: typeof bench) => ({ id: item!.id, xM: item!.pose.xM, yM: item!.pose.yM });
  const setup: OpticalSetup = {
    bench: { ...positioned(bench), lengthM: Number(bench!.parameters.lengthM) },
    candle: { ...positioned(candle), heightM: Number(candle!.parameters.heightM) },
    lens: { ...positioned(lens), focalLengthM: Number(lens!.parameters.focalLengthM), apertureRadiusM: Number(lens!.parameters.apertureRadiusM) },
    screen: { ...positioned(screen), heightM: Number(screen!.parameters.heightM), widthM: Number(screen!.parameters.widthM) },
  };
  return solveOpticalBench(setup);
}
export const opticalMessage = (code: string) => ({
  OPTICAL_DOCUMENT: '装置参数无效，请检查属性。', OPTICAL_MIXED_DOMAIN: '光具座实验仅支持光学器材，请另建实验搭建电路。',
  OPTICAL_MISSING_APPARATUS: '请放置光具座、蜡烛、凸透镜和光屏，再独立放置刻度尺读数。',
  OPTICAL_MULTIPLE_APPARATUS: '当前支持一套光具座：请各保留一个蜡烛、透镜和光屏。', OPTICAL_ORIENTATION: '当前模型要求光轴水平、光从左向右传播；器材不能旋转或翻转。',
  OPTICAL_BENCH_RANGE: '器材超出光具座长度或高度范围，请移动回可用区域。', OPTICAL_OBJECT_SIDE: '蜡烛须在透镜左侧，物体与透镜不能重合。',
  OPTICAL_NON_PARAXIAL: '光线超出近轴模型范围；请减小偏心、物体高度或孔径。', OPTICAL_PARAMETERS: '光学参数超出当前模型范围。',
  OPTICAL_NON_FINITE: '坐标或参数必须为有限数值。', OPTICAL_NUMERIC_RANGE: '当前像超出数值范围，不能输出正常结果。',
}[code] ?? '当前装置不能计算，请检查参数。');
