import { createEmptyScene } from '../core/scene/create.ts';
import { validateSceneDocument } from '../core/scene/validate.ts';
import { createElectricalRegistry, POWER, RESISTOR, SWITCH, AMMETER, VOLTMETER, RHEOSTAT } from '../equipment/electrical/definitions.ts';

export const EMF_EXPERIMENT = 'H-ELEC-01';
export const emfStarts = [
  { id: 'reference', label: '理想电表参考', description: '电流表内阻为零、电压表不分流；电源具有有限内阻。' },
  { id: 'inner', label: '电流表内接', description: '电压表跨电源端，电流表测负载支路电流。' },
  { id: 'outer', label: '电流表外接', description: '电压表跨负载，电流表测电源总电流。' },
  { id: 'blank', label: '空白搭建', description: '自行添加电源、电表、开关、电阻、滑动变阻器和导线。' },
] as const;
export type EmfStart = typeof emfStarts[number]['id'];

export function createEmfExperiment(documentId: string, timestamp: string, start: EmfStart) {
  if (!emfStarts.some(choice => choice.id === start)) throw new RangeError('UNKNOWN_EMF_START');
  const scene = createEmptyScene(documentId, timestamp), registry = createElectricalRegistry();
  scene.experimentId = EMF_EXPERIMENT;
  scene.title = '测量电源电动势与内阻';
  scene.curriculumRef = { stage: 'senior', standard: { title: '普通高中物理课程标准', edition: '2017 年版 2020 年修订', topic: '电源电动势与内阻的测量', clause: null },
    textbookMappings: [{ publisher: '人民教育出版社', edition: null, volume: null, chapter: null, page: null, status: 'pending_teacher_review', reviewedBy: null, reviewedAt: null }] };
  scene.viewport = { centerXM: 0, centerYM: -.015, pixelsPerM: 520 };
  if (start !== 'blank') {
    scene.provenance.origin = 'template';
    scene.provenance.notes = [`电动势实验起点：${start}。接法根据实际导线识别；开关断开，先核对参数与量程再闭合。`];
    scene.equipment = [[POWER, 'E', -.4, .16], [SWITCH, 'S', -.12, .16], [AMMETER, 'A', .18, .16],
      [RESISTOR, 'R', .4, -.1], [RHEOSTAT, 'Rp', .1, -.1], [VOLTMETER, 'V', -.27, -.18]].map(([type, id, x, y]) => ({
      id: String(id), type: String(type), definitionVersion: 1, parameters: { ...registry.get(String(type), 1)!.defaultParameters },
      pose: { xM: Number(x), yM: Number(y), rotationRad: 0, flippedX: id === 'E' || id === 'A' || id === 'R' },
    }));
    scene.equipment[0]!.parameters = { voltageV: 3, internalResistanceOhm: 2 };
    scene.equipment[2]!.parameters.resistanceOhm = start === 'reference' ? 0 : .2;
    scene.equipment[3]!.parameters.resistanceOhm = 5;
    scene.equipment[4]!.parameters = { maxResistanceOhm: 30, position: .8 };
    scene.equipment[5]!.parameters = { ...scene.equipment[5]!.parameters, finiteInput: start !== 'reference' };
    const pairs = [['E', 'positive', 'S', 'a'], ['S', 'b', 'A', 'low'], ['A', 'common', 'R', 'a'],
      ['R', 'b', 'Rp', 'a'], ['Rp', 'c', 'E', 'negative'],
      ['V', 'low', start === 'outer' ? 'A' : 'E', start === 'outer' ? 'common' : 'positive'], ['V', 'common', 'E', 'negative']];
    scene.connections = pairs.map(([a, ap, b, bp], index) => ({ id: `emf-wire-${index}`, kind: 'wire', from: { equipmentId: a!, portId: ap! }, to: { equipmentId: b!, portId: bp! } }));
    const routes = { 2: [[.5, .12], [.53, -.1]], 3: [[.31, -.23], [-.04, -.23], [-.04, -.1]],
      4: [[.04, .03], [-.52, .03], [-.52, .16]], 5: start === 'outer' ? [[-.13, -.3], [.58, -.3], [.58, .28], [.28, .28], [.28, .114]] : [[-.19, -.2], [-.19, .04], [-.3, .04], [-.325, .16]],
      6: [[-.43, -.3], [-.6, -.3], [-.6, .16]] };
    for (const [index, points] of Object.entries(routes)) scene.connections[Number(index)]!.routeWorldM = points.map(([x, y]) => ({ x: x!, y: y! }));
  }
  const checked = validateSceneDocument(scene, registry);
  if (!checked.ok) throw new Error('INVALID_EMF_TEMPLATE');
  return checked.document;
}
