import { createEmptyScene } from '../core/scene/create.ts';
import { validateSceneDocument } from '../core/scene/validate.ts';
import { createElectricalRegistry, POWER, RESISTOR, SWITCH, AMMETER, VOLTMETER, RHEOSTAT } from '../equipment/electrical/definitions.ts';

export const OHM_EXPERIMENT = 'J-ELEC-02';
export type OhmStart = 'voltage' | 'resistance' | 'blank';
export function createOhmExperiment(documentId: string, timestamp: string, start: OhmStart = 'voltage') {
  if (!['voltage', 'resistance', 'blank'].includes(start)) throw new RangeError('UNKNOWN_OHM_START');
  const scene = createEmptyScene(documentId, timestamp), registry = createElectricalRegistry();
  scene.experimentId = OHM_EXPERIMENT; scene.title = '探究电流与电压、电阻的关系';
  scene.ohmControl = { mode: start === 'resistance' ? 'resistance' : 'voltage', fixedResistanceOhm: start === 'resistance' ? 5 : 10, targetVoltageV: 2, voltageToleranceV: .05 };
  scene.simulationConfig.modelVersions['electrical.ohm'] = 'inquiry.v1';
  scene.curriculumRef = { stage: 'junior', standard: { title: '义务教育物理课程标准', edition: '2022 年版', topic: '探究电流与电压、电阻的关系；具体条目待教师核验', clause: null }, textbookMappings: [{ publisher: '人民教育出版社', edition: null, volume: null, chapter: null, page: null, status: 'pending_teacher_review', reviewedBy: null, reviewedAt: null }] };
  scene.viewport = { centerXM: .02, centerYM: -.06, pixelsPerM: 430 };
  if (start !== 'blank') {
    scene.provenance.origin = 'template'; scene.provenance.notes = ['复用既有电源、开关、定值电阻、双量程电表及四柱滑动变阻器。开关断开，滑动变阻器从最大接入电阻开始，不预填记录。'];
    scene.equipment = [[POWER, 'E', -.4, .17], [SWITCH, 'S', -.12, .17], [AMMETER, 'A', .18, .17], [RESISTOR, 'R', .4, -.11], [RHEOSTAT, 'Rp', .08, -.11], [VOLTMETER, 'V', .3, -.31]].map(([type, id, x, y]) => ({ id: String(id), type: String(type), definitionVersion: 1,
      pose: { xM: Number(x), yM: Number(y), rotationRad: 0, flippedX: id === 'E' || id === 'A' }, parameters: { ...registry.get(String(type), 1)!.defaultParameters } }));
    scene.equipment[0]!.parameters = { voltageV: 6, internalResistanceOhm: 0 };
    scene.equipment[3]!.parameters.resistanceOhm = scene.ohmControl.fixedResistanceOhm;
    scene.equipment[4]!.parameters = { maxResistanceOhm: 50, position: 1 };
    const pairs = [['E', 'positive', 'S', 'a'], ['S', 'b', 'A', 'low'], ['A', 'common', 'R', 'b'], ['R', 'a', 'Rp', 'a'], ['Rp', 'c', 'E', 'negative'], ['V', 'low', 'R', 'b'], ['V', 'common', 'R', 'a']];
    scene.connections = pairs.map(([a, ap, b, bp], index) => ({ id: `ohm-wire-${index}`, kind: 'wire', from: { equipmentId: a!, portId: ap! }, to: { equipmentId: b!, portId: bp! } }));
    const routes = { 2: [[.52, .12], [.54, -.11]], 3: [[.27, -.18], [-.03, -.18], [-.03, -.11]], 4: [[.02, .015], [-.53, .015], [-.53, .17]], 5: [[.48, -.35], [.59, -.35], [.59, -.11]], 6: [[.18, -.36], [.24, -.24], [.31, -.24]] };
    for (const [index, points] of Object.entries(routes)) scene.connections[Number(index)]!.routeWorldM = points.map(([x, y]) => ({ x: x!, y: y! }));
  }
  const checked = validateSceneDocument(scene, registry);
  if (!checked.ok) throw new Error('INVALID_OHM_TEMPLATE');
  return checked.document;
}
