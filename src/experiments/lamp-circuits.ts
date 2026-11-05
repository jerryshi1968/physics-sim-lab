import { createEmptyScene } from '../core/scene/create.ts';
import type { SceneDocument } from '../core/scene/schema.ts';
import { validateSceneDocument } from '../core/scene/validate.ts';
import { createElectricalRegistry, POWER, LAMP, SWITCH, AMMETER, VOLTMETER } from '../equipment/electrical/definitions.ts';

export const LAMP_CIRCUIT_EXPERIMENT = 'J-ELEC-01';
export const lampCircuitStarts = [
  { id: 'blank', title: '从空白搭建', description: '自行取用器材、设置电源和接线，串联与并联均可探索。' },
  { id: 'series-same', title: '串联 · 相同灯泡', description: '6 V 电源；两灯均为 3 V / 0.3 A。' },
  { id: 'series-different', title: '串联 · 不同灯泡', description: '9 V 电源；两灯分别为 3 V / 0.3 A、6 V / 0.3 A。' },
  { id: 'parallel-same', title: '并联 · 相同灯泡', description: '3 V 电源；两灯均为 3 V / 0.3 A。' },
  { id: 'parallel-different', title: '并联 · 不同灯泡', description: '3 V 电源；两灯分别为 3 V / 0.3 A、3 V / 0.2 A。' },
] as const;
export type LampCircuitStart = typeof lampCircuitStarts[number]['id'];

export function createLampCircuitExperiment(documentId: string, timestamp: string, start: LampCircuitStart): SceneDocument {
  const choice = lampCircuitStarts.find(item => item.id === start);
  if (!choice) throw new RangeError('UNKNOWN_LAMP_CIRCUIT_START');
  const scene = createEmptyScene(documentId, timestamp), registry = createElectricalRegistry();
  scene.experimentId = LAMP_CIRCUIT_EXPERIMENT;
  scene.title = start === 'blank' ? '探究灯泡串并联电路规律' : choice.title;
  scene.curriculumRef = { stage: 'junior', standard: { title: '义务教育物理课程标准', edition: '2022 年版', topic: '电学实验与测量', clause: null },
    textbookMappings: [{ publisher: '人民教育出版社', edition: null, volume: null, chapter: null, page: null, status: 'pending_teacher_review', reviewedBy: null, reviewedAt: null }] };
  if (start !== 'blank') {
    const parallel = start.startsWith('parallel'), different = start.endsWith('different');
    scene.provenance.origin = 'template';
    scene.provenance.notes = [`起始模板：${start}。名称仅说明初态，实际接法由端口连接决定。`];
    scene.viewport = { centerXM: 0, centerYM: -.04, pixelsPerM: 400 };
    scene.equipment = [[POWER, 'E', -.32, .12], [SWITCH, 'S', 0, .12], [AMMETER, 'A', .32, .12],
      [LAMP, 'L1', -.18, -.08], [LAMP, 'L2', .18, -.08], [VOLTMETER, 'V', 0, -.25]].map(([type, id, x, y]) => ({
      id: String(id), type: String(type), definitionVersion: 1, parameters: registry.get(String(type), 1)!.defaultParameters,
      pose: { xM: Number(x), yM: Number(y), rotationRad: 0, flippedX: id === 'E' || id === 'A' },
    }));
    scene.equipment[0]!.parameters.voltageV = parallel ? 3 : different ? 9 : 6;
    if (different) scene.equipment[4]!.parameters = { ...scene.equipment[4]!.parameters,
      ...(parallel ? { ratedCurrentA: .2 } : { ratedVoltageV: 6, coldResistanceOhm: 4 }) };
    const pairs = parallel ? [
      ['E', 'positive', 'S', 'a'], ['S', 'b', 'A', 'high'], ['A', 'common', 'L1', 'a'], ['A', 'common', 'L2', 'a'],
      ['L1', 'b', 'E', 'negative'], ['L2', 'b', 'E', 'negative'],
    ] : [
      ['E', 'positive', 'L1', 'a'], ['L1', 'b', 'L2', 'a'], ['L2', 'b', 'A', 'high'], ['A', 'common', 'S', 'b'], ['S', 'a', 'E', 'negative'],
    ];
    pairs.push(['V', 'high', 'E', 'positive'], ['V', 'common', 'E', 'negative']);
    scene.connections = pairs.map(([a, ap, b, bp], index) => ({ id: `wire-${index}`, kind: 'wire',
      from: { equipmentId: a!, portId: ap! }, to: { equipmentId: b!, portId: bp! } }));
    const routes: Record<number, number[][]> = parallel ? {
      2: [[.43, .02], [.43, -.17], [-.32, -.17], [-.32, -.08]],
      3: [[.40, -.02], [.40, -.13], [.02, -.13], [.02, -.08]],
      4: [[-.12, .01], [-.43, .01], [-.43, .12]],
      5: [[.45, -.08], [.45, .24], [-.43, .24], [-.43, .12]],
    } : {
      3: [[.45, .02], [.45, .24], [.12, .24], [.12, .12]],
      4: [[-.10, .23], [-.43, .23], [-.43, .12]],
    };
    routes[pairs.length - 2] = [[.10, -.33], [-.46, -.33], [-.46, .20], [-.245, .20]];
    routes[pairs.length - 1] = [[-.13, -.28], [-.50, -.28], [-.50, .12]];
    for (const [index, points] of Object.entries(routes)) scene.connections[Number(index)]!.routeWorldM = points.map(([x, y]) => ({ x: x!, y: y! }));
  }
  const checked = validateSceneDocument(scene, registry);
  if (!checked.ok) throw new Error('INVALID_LAMP_CIRCUIT_TEMPLATE');
  return checked.document;
}

export const lampCircuitQuestions = [
  '串联电路不同位置的电流有什么关系？两只不同灯泡两端的电压还相等吗？',
  '并联电路干路与各支路的电流怎样比较？各支路与电源两端的电压有什么关系？',
  '换用不同参数灯泡后，哪些关系仍成立？为什么只比较相同灯泡还不够？亮度能代替电表测量吗？',
];
export const lampCircuitSteps = [
  '选串联或并联，先画出自己的接线计划。取电源、两个灯泡、开关、导线及电流表、电压表，记录两灯参数。',
  '断开开关后接线。电流表串入被测位置，电压表并在被测两点；先用较大量程，确认后再自行改接合适量程。',
  '核对电源设置和接线后闭合开关，观察灯泡及指针。不同模板的电源设置不同，不把某个电压当成所有接法的统一值。',
  '测量干路/串联回路及两灯处的三处电流，再测电源和两灯两端电压。可使用多只表，也可每次断开开关后移动同一只表。',
  '在记录表填写组别、测点和观察备注，抄表或采集。换用不同参数灯泡，再断开、改接、测量，保留各组原记录。',
  '用图线和记录比较规律，在本组备注中写自己的观察；保存实验并导出 CSV/JSON，重载后核对接线、参数和记录。',
];
export const lampCircuitHints = [
  { title: '提示 1：先查接线与状态', text: '不亮或无示数时，先看开关、自由线头与诊断。线条交叉不代表相连；电流表和电压表的接入方式不同。' },
  { title: '提示 2：安排对照测量', text: '每种接法测 I总、I₁、I₂ 和 U总、U₁、U₂。保留相同灯泡一组，再换不同灯泡一组；不要只凭亮度或一组数据判断。' },
  { title: '提示 3：用关系检查记录', text: '串联可比较 I总、I₁、I₂ 与 U总、U₁+U₂；并联可比较 I总、I₁+I₂ 与 U总、U₁、U₂。结合分度值和估读差异解释结果，不强行把实测数改成理论数。' },
];
