import type { SceneDocument } from '../core/scene/schema.ts';
import { createEmptyScene } from '../core/scene/create.ts';
import { createLampCircuitExperiment } from './lamp-circuits.ts';
import { createDensityExperiment } from './density.ts';
import { createFrictionExperiment } from './friction.ts';
import { createBuoyancyExperiment } from './buoyancy.ts';
import { createLeverExperiment } from './lever.ts';
import { createOpticalExperiment } from './optical-bench.ts';
import { createReflectionExperiment } from './reflection.ts';
import { createMirrorImageExperiment } from './mirrorImage.ts';
import { createCartExperiment } from './cart.ts';
import { createPendulumExperiment } from './pendulum.ts';
import { createSpringExperiment } from './spring.ts';
import { createProjectileExperiment } from './projectile.ts';
import { createVoltammetryExperiment } from './voltammetry.ts';
import { createOhmExperiment } from './ohm.ts';
import { createEmfExperiment } from './emf.ts';
import { FREE_OPTICAL_EXPERIMENT, JUNIOR_ELECTRICAL_EXPERIMENT, SENIOR_ELECTRICAL_EXPERIMENT } from '../equipment/support.ts';

export type SchoolStage = 'junior' | 'senior';
export type CatalogDomain = 'mechanical' | 'electrical' | 'optical';
export type CatalogFamily = 'density' | 'friction' | 'buoyancy' | 'lever' | 'experiment' | 'optical' | 'reflection' | 'mirror-image' | 'cart' | 'spring' | 'projectile' | 'emf' | 'free' | 'pendulum' | 'ohm' | 'voltammetry';
export const schoolLabels = { junior: '初中物理实验', senior: '高中物理实验' };
export const catalogDomainLabels = { mechanical: '力学实验', electrical: '电学实验', optical: '光学实验' };
export interface ExperimentChoice {
  id: string; stage: SchoolStage; domain: CatalogDomain; family: CatalogFamily; title: string; description: string;
  create: (id: string, timestamp: string) => SceneDocument;
}
const entry = (id: string, stage: SchoolStage, domain: CatalogDomain, family: CatalogFamily, title: string, description: string, create: ExperimentChoice['create']): ExperimentChoice => ({ id, stage, domain, family, title, description, create });

function electricalBlank(id: string, timestamp: string, stage: SchoolStage) {
  const scene = createEmptyScene(id, timestamp);
  scene.experimentId = stage === 'junior' ? JUNIOR_ELECTRICAL_EXPERIMENT : SENIOR_ELECTRICAL_EXPERIMENT;
  scene.curriculumRef = createLampCircuitExperiment(id, timestamp, 'blank').curriculumRef;
  scene.curriculumRef!.stage = stage;
  scene.curriculumRef!.standard = stage === 'junior' ? { title: '义务教育物理课程标准', edition: '2022 年版', topic: '电路搭建与测量', clause: null }
    : { title: '普通高中物理课程标准', edition: '2017 年版 2020 年修订', topic: '恒定电流与电路测量', clause: null };
  scene.viewport = { centerXM: 0, centerYM: 0, pixelsPerM: 600 };
  return scene;
}
function opticalBlank(id: string, timestamp: string) {
  const scene = createOpticalExperiment(id, timestamp, true);
  scene.experimentId = FREE_OPTICAL_EXPERIMENT;
  scene.viewport = { centerXM: 0, centerYM: .12, pixelsPerM: 600 };
  scene.simulationConfig.modelVersions = {};
  scene.curriculumRef!.standard.topic = '光学器材搭建与观察';
  return scene;
}

export const experimentChoices: readonly ExperimentChoice[] = [
  entry('density-blank', 'junior', 'mechanical', 'density', '空白搭建密度测量实验', '自行取用器材，设置天平、砝码盒、盛水量筒等。', (id, time) => createDensityExperiment(id, time, false, true)),
  entry('density-solid', 'junior', 'mechanical', 'density', '测量固体密度实验', '预放托盘天平、砝码盒、盛水量筒和待测固体。', (id, time) => createDensityExperiment(id, time, false, false)),
  entry('density-liquid', 'junior', 'mechanical', 'density', '测量液体密度实验', '预放托盘天平、砝码盒、空量筒和盛液烧杯。', (id, time) => createDensityExperiment(id, time, true, false)),
  entry('friction-blank', 'junior', 'mechanical', 'friction', '空白搭建滑动摩擦实验', '自行取用器材，设置测力计与牵引器连接等。', (id, time) => createFrictionExperiment(id, time, true)),
  entry('friction', 'junior', 'mechanical', 'friction', '滑动摩擦实验', '水平一维，测力计与牵引器连接。自行选择材料、质量和接触面积，等待匀速稳态再读数。', createFrictionExperiment),
  entry('buoyancy-blank', 'junior', 'mechanical', 'buoyancy', '空白搭建浮力实验', '自行取用器材，设置天平、砝码盒、溢水杯、接液杯、悬挂圆柱体等。', (id, time) => createBuoyancyExperiment(id, time, 'empty')),
  entry('buoyancy-factors', 'junior', 'mechanical', 'buoyancy', '探究浮力的影响因素', '悬挂圆柱体，观察浸没体积与测力计读数。', (id, time) => createBuoyancyExperiment(id, time, 'factors')),
  entry('buoyancy-archimedes', 'junior', 'mechanical', 'buoyancy', '验证阿基米德原理', '用溢水杯和接液杯收集排液，称量验证阿基米德原理。', (id, time) => createBuoyancyExperiment(id, time, 'archimedes')),
  entry('lever-blank', 'junior', 'mechanical', 'lever', '空白搭建杠杆平衡实验', '自行取用器材，设置杠杆、挂码、弹簧测力计等。', (id, time) => createLeverExperiment(id, time, true)),
  entry('lever', 'junior', 'mechanical', 'lever', '杠杆平衡实验', '杠杆调平，用挂码、调整拉力并记录，不自动给出平衡装置。', createLeverExperiment),
  entry('electrical-blank', 'junior', 'electrical', 'free', '空白搭建电学实验', '自行取用器材，设置电源和接线，串联与并联均可探索。', (id, time) => electricalBlank(id, time, 'junior')),
  entry('ohm-voltage', 'junior', 'electrical', 'ohm', '探究电流与电压的关系', '保持定值电阻不变，调节四柱变阻器，记录并绘制 I–U 图线。', (id, time) => createOhmExperiment(id, time, 'voltage')),
  entry('ohm-resistance', 'junior', 'electrical', 'ohm', '探究电流与电阻的关系', '替换定值电阻，调变阻器保持电压，记录并绘制 I–1/R 图线。', (id, time) => createOhmExperiment(id, time, 'resistance')),
  entry('voltammetry', 'junior', 'electrical', 'voltammetry', '伏安法测量定值电阻', '选择电表量程，调节变阻器测多组 U、I，计算未知电阻并分析读数误差。', createVoltammetryExperiment),
  entry('series-same', 'junior', 'electrical', 'experiment', '串联 · 相同灯泡', '6 V 电源；两灯均为 3 V / 0.3 A。', (id, time) => createLampCircuitExperiment(id, time, 'series-same')),
  entry('series-different', 'junior', 'electrical', 'experiment', '串联 · 不同灯泡', '9 V 电源；两灯分别为 3 V / 0.3 A、6 V / 0.3 A。', (id, time) => createLampCircuitExperiment(id, time, 'series-different')),
  entry('parallel-same', 'junior', 'electrical', 'experiment', '并联 · 相同灯泡', '3 V 电源；两灯均为 3 V / 0.3 A。', (id, time) => createLampCircuitExperiment(id, time, 'parallel-same')),
  entry('parallel-different', 'junior', 'electrical', 'experiment', '并联 · 不同灯泡', '3 V 电源；两灯分别为 3 V / 0.3 A、3 V / 0.2 A。', (id, time) => createLampCircuitExperiment(id, time, 'parallel-different')),
  entry('optical-blank', 'junior', 'optical', 'free', '空白搭建光学实验', '自行取用器材，设置镜、透镜等，遇到互斥的设备按先放的优先。', opticalBlank),
  entry('reflection', 'junior', 'optical', 'reflection', '光的反射定律实验', '平面镜、窄光束光源、量角器、法线与可折承接纸板。自行校准、读角，并折动右纸板观察连续光迹。', createReflectionExperiment),
  entry('mirror-image', 'junior', 'optical', 'mirror-image', '平面镜成像实验', '用薄玻璃板观察像，移动镜后对照物并消除视差，再测量像的位置与大小，用光屏检查像能否承接。', createMirrorImageExperiment),
  entry('lens', 'junior', 'optical', 'optical', '探究凸透镜成像规律', '蜡烛、透镜和光屏可独立移动和调高，光屏不自动跳到清晰位置。', createOpticalExperiment),
  entry('cart-blank', 'senior', 'mechanical', 'cart', '空白搭建小车实验', '自行取用一套小车器材（含两种计时方式）。', (id, time) => createCartExperiment(id, time, true)),
  entry('cart', 'senior', 'mechanical', 'cart', '加速度与力、质量实验', '用悬挂砝码牵引水平轨道上的小车。可分别用两个光电门和打点纸带测加速度。', createCartExperiment),
  entry('spring-blank', 'senior', 'mechanical', 'spring', '空白搭建弹簧弹力与形变量实验', '自行取用一套弹簧、钩码器材。', (id, time) => createSpringExperiment(id, time, true)),
  entry('spring', 'senior', 'mechanical', 'spring', '胡克定律探究实验', '用弹簧、刻度尺、钩码等探究胡克定律，绘制 F–Δx 并拟合劲度系数。', createSpringExperiment),
  entry('pendulum-blank', 'senior', 'mechanical', 'pendulum', '空白搭建单摆测 g 实验', '自行取用支架、单摆、刻度尺和计时器。', (id, time) => createPendulumExperiment(id, time, true)),
  entry('pendulum', 'senior', 'mechanical', 'pendulum', '单摆测重力加速度实验', '量悬点到球心的摆长，多周期计时，研究小角条件与角度影响。', createPendulumExperiment),
  entry('projectile-blank', 'senior', 'mechanical', 'projectile', '空白搭建平抛运动实验', '自行取用一套水平平抛运动实验器材。', (id, time) => createProjectileExperiment(id, time, true)),
  entry('projectile', 'senior', 'mechanical', 'projectile', '平抛运动实验', '用平抛二维标尺、小球、计时器等探究平抛运动规律。', createProjectileExperiment),
  entry('current-blank', 'senior', 'electrical', 'free', '空白搭建恒定电流实验', '自行取用一套电源、电阻、电流表、电压表器材。', (id, time) => electricalBlank(id, time, 'senior')),
  entry('emf-reference', 'senior', 'electrical', 'emf', '电源电动势与内阻测量（理想电表参考）', '用理想电表测量电源电动势与内阻。', (id, time) => createEmfExperiment(id, time, 'reference')),
  entry('emf-inner', 'senior', 'electrical', 'emf', '电源电动势与内阻测量（电流表内接）', '用电流表内接法测量电源电动势与内阻。', (id, time) => createEmfExperiment(id, time, 'inner')),
  entry('emf-outer', 'senior', 'electrical', 'emf', '电源电动势与内阻测量（电流表外接）', '用电流表外接法测量电源电动势与内阻。', (id, time) => createEmfExperiment(id, time, 'outer')),
];

export function createCatalogExperiment(choiceId: string, id: string, timestamp: string) {
  const choice = experimentChoices.find(item => item.id === choiceId);
  if (!choice) throw new RangeError('UNKNOWN_EXPERIMENT_CHOICE');
  const scene = choice.create(id, timestamp);
  scene.title = choice.title;
  return scene;
}

export function fitCatalogViewport(scene: SceneDocument, choice: ExperimentChoice, width: number, height: number) {
  const viewport = scene.viewport;
  if (!viewport) return;
  if (choice.family === 'ohm' || choice.family === 'voltammetry') viewport.pixelsPerM = Math.min(430, (Math.max(352, height * .52 - 114) - 120) / .68, width < 760 ? 260 : width < 1100 ? 350 : 430);
  else if (choice.family === 'pendulum') viewport.pixelsPerM = Math.min(440, (Math.max(352, height - 414) - 60) / .8, width < 760 ? 300 : 440);
  else if (choice.family === 'buoyancy') viewport.pixelsPerM = Math.min(viewport.pixelsPerM, (Math.max(352, height - 414) - 116) / .72, width < 760 ? 290 : width < 1100 ? 440 : 620);
  else if (choice.family === 'cart' && (width < 760 || height < 900)) viewport.pixelsPerM = 130;
  else if (choice.family === 'mirror-image' && width < 1100) viewport.pixelsPerM = width < 760 ? 290 : 480;
  else if (width < 760) viewport.pixelsPerM = choice.family === 'emf' ? 260 : choice.family === 'friction' ? 180 : choice.family === 'spring' || choice.family === 'lever' ? 360 : choice.family === 'reflection' ? 280 : choice.domain === 'optical' ? 240 : choice.family === 'projectile' ? 128 : 320;
}
