import { createCartExperiment } from './cart.ts';
import { CART, TRACK, TICKER } from '../equipment/cart/definitions.ts';
import { MECHANICAL_RULER } from '../equipment/mechanical/definitions.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { CART_VELOCITY_EXPERIMENT, CART_VELOCITY_MODEL } from '../equipment/cartVelocity/definitions.ts';
import { TICKER_DIRECT_MODEL } from '../equipment/ticker/simulate.ts';

export function createCartVelocityExperiment(id: string, timestamp: string) {
  const scene = createCartExperiment(id, timestamp, true), registry = createWorkbenchRegistry();
  scene.experimentId = CART_VELOCITY_EXPERIMENT;
  scene.title = '探究小车速度随时间变化的规律';
  scene.provenance.origin = 'template';
  scene.viewport = { centerXM: -.08, centerYM: -.37, pixelsPerM: 300 };
  scene.simulationConfig.modelVersions['mechanical.cart-velocity'] = CART_VELOCITY_MODEL;
  scene.simulationConfig.modelVersions['mechanical.ticker'] = TICKER_DIRECT_MODEL;
  scene.curriculumRef!.standard.topic = '纸带测量小车在不同时刻的速度、重复实验和v–t图像，正式条目待教师核验';
  scene.curriculumRef!.textbookMappings[0] = { publisher: '人民教育出版社', edition: null, volume: '必修第一册', chapter: '第二章第1节 实验：探究小车速度随时间变化的规律', page: 36, status: 'pending_teacher_review', reviewedBy: null, reviewedAt: null };
  scene.equipment = [[TRACK, 'track', 0, 0], [TICKER, 'ticker', -.95, .052], [CART, 'cart', -.60, 0], [MECHANICAL_RULER, 'ruler', -.85, -.96]].map(([type, itemId, x, y]) => ({ id: String(itemId), type: String(type), definitionVersion: 1, pose: { xM: Number(x), yM: Number(y), rotationRad: 0 }, parameters: { ...registry.get(String(type), 1)!.defaultParameters, ...(type === TRACK ? { dropLimitM: .75 } : type === CART ? { hangerMassKg: .02 } : {}) } }));
  return scene;
}
