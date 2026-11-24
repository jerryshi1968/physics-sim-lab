import { createLampCircuitExperiment } from './lamp-circuits.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { validateSceneDocument } from '../core/scene/validate.ts';
import { CONDUCTOR_EXPERIMENT, METAL_WIRE } from '../equipment/electrical/conductor.ts';
import { POWER, SWITCH, AMMETER } from '../equipment/electrical/definitions.ts';
import { HEATER, THERMOMETER } from '../equipment/thermal/definitions.ts';

export function createConductorExperiment(id: string, time: string) {
  const scene = createLampCircuitExperiment(id, time, 'blank'), registry = createWorkbenchRegistry();
  scene.experimentId = CONDUCTOR_EXPERIMENT; scene.title = '探究影响导体电阻大小的因素';
  scene.provenance.origin = 'template'; scene.provenance.notes = ['复用电源、开关、理想电流表、温度计与加热装置；金属丝按材料、长度、横截面积和温度计算电阻。外加热采用分步恒温教学模型，不自动计入焦耳自热。'];
  scene.curriculumRef!.standard.topic = scene.title;
  scene.equipment = [[POWER, 'E', -.3, .16], [SWITCH, 'S', 0, .16], [AMMETER, 'A', .3, .16], [METAL_WIRE, 'M', 0, -.12], [HEATER, 'H', 0, -.22], [THERMOMETER, 'T', .15, -.12]].map(([type, itemId, x, y]) => ({
    id: String(itemId), type: String(type), definitionVersion: 1, parameters: { ...registry.get(String(type), 1)!.defaultParameters }, pose: { xM: Number(x), yM: Number(y), rotationRad: 0, flippedX: itemId === 'A' || itemId === 'E' },
  }));
  scene.equipment.find(i => i.id === 'E')!.parameters.voltageV = 1;
  Object.assign(scene.equipment.find(i => i.id === 'H')!.parameters, { powerW: 30, efficiency: .7, lossWPerK: .15 });
  scene.connections = [['E', 'positive', 'S', 'a'], ['S', 'b', 'A', 'low'], ['A', 'common', 'M', 'b'], ['M', 'a', 'E', 'negative']].map(([a, ap, b, bp], index) => ({ id: `conductor-wire-${index}`, kind: 'wire', from: { equipmentId: a!, portId: ap! }, to: { equipmentId: b!, portId: bp! },
    ...(index === 2 ? { routeWorldM: [{ x: .48, y: .05 }, { x: .45, y: -.12 }] } : index === 3 ? { routeWorldM: [{ x: -.46, y: -.12 }, { x: -.46, y: .12 }] } : {}),
  }));
  scene.viewport = { centerXM: 0, centerYM: -.04, pixelsPerM: 500 };
  scene.simulationConfig.modelVersions['electrical.conductor'] = 'rho-linear-temperature.v1';
  const checked = validateSceneDocument(scene, registry); if (!checked.ok) throw new Error('INVALID_CONDUCTOR_TEMPLATE');
  return checked.document;
}
