import { createEmptyScene } from '../src/core/scene/create.ts';
import { createElectricalRegistry, POWER, LAMP, AMMETER, VOLTMETER } from '../src/equipment/electrical/definitions.ts';
import { simulateElectrical } from '../src/equipment/electrical/simulate.ts';
import { buildElectricalMeasurements } from '../src/equipment/electrical/measure.ts';
import { appendMeasurements } from '../src/core/measurements/records.ts';
import { measurementRows } from '../src/core/measurements/table.ts';
import { measurementSeries, measurementChartProfiles } from '../src/core/measurements/charts.ts';
import { measurementsCsv } from '../src/core/measurements/csv.ts';

const registry = createElectricalRegistry(), timestamp = '2026-11-04T09:00:00.000Z';
let scene = createEmptyScene('measurement.demo', timestamp);
scene.title = '串并联采样演示';
scene.equipment = [[POWER, 'E'], [LAMP, 'L1'], [LAMP, 'L2'], [AMMETER, 'A'], [VOLTMETER, 'V']].map(([type, id], index) => ({
  id, type, definitionVersion: 1, parameters: registry.get(type, 1).defaultParameters, pose: { xM: index * .2, yM: 0, rotationRad: 0 },
}));
scene.equipment[0].parameters.voltageV = 6;
function wires(parallel) {
  return (parallel ? [['E', 'positive', 'A', 'low'], ['A', 'common', 'L1', 'a'], ['A', 'common', 'L2', 'a'], ['L1', 'b', 'E', 'negative'], ['L2', 'b', 'E', 'negative']]
    : [['E', 'positive', 'A', 'low'], ['A', 'common', 'L1', 'a'], ['L1', 'b', 'L2', 'a'], ['L2', 'b', 'E', 'negative']])
    .concat([['V', 'low', 'L1', 'a'], ['V', 'common', 'L1', 'b']]).map(([a, ap, b, bp], index) => ({ id: `w${index}`, kind: 'wire', from: { equipmentId: a, portId: ap }, to: { equipmentId: b, portId: bp } }));
}
function sample(id, setupLabel, source = 'instrument') {
  const payload = simulateElectrical(scene);
  const reply = { documentId: scene.documentId, documentRevision: scene.revision, runId: 'demo.run', sequence: scene.revision + 1, commandType: 'result', payload };
  const built = buildElectricalMeasurements(scene, registry, reply, { sampleId: id, setupLabel, source, note: '', timestamp,
    choices: [{ id: `${id}.I`, equipmentId: 'A', pointLabel: 'I总', rawInput: '0.49' }, { id: `${id}.V`, equipmentId: 'V', pointLabel: 'U1', rawInput: '' }] });
  if (!built.ok) throw new Error(built.code);
  const result = appendMeasurements(scene, registry, built.records, built.snapshot, timestamp);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  scene = result.document;
}
scene.connections = wires(false); sample('series.1', '串联');
scene.equipment[0].parameters.voltageV = 3; scene.equipment[2].parameters.ratedCurrentA = .2; scene.connections = wires(true); scene.revision++;
sample('parallel.2', '并联'); sample('manual.3', '并联', 'manual');
const rows = measurementRows(scene).map(({ record, sampleIndex, pointLabel, setupLabel }) => ({ id: record.id, group: sampleIndex, setupLabel, pointLabel, source: record.source, value: record.value, unit: record.unit, status: record.measurementStatus }));
if (JSON.stringify(rows.map(row => row.value)) !== JSON.stringify([.3, 3, .5, 3, .49, null])) throw new Error('Unexpected independent demo values');
console.log(JSON.stringify({ document: scene, rows, currentSeries: measurementSeries(scene, measurementChartProfiles[0]), csv: measurementsCsv(scene) }, null, 2));
