import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyScene } from '../../src/core/scene/create.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { MAX_DOCUMENT_BYTES, parseSceneJson, serializeScene, utf8ByteLength } from '../../src/core/scene/transfer.ts';
import { createElectricalRegistry, POWER, RESISTOR, AMMETER, VOLTMETER } from '../../src/equipment/electrical/definitions.ts';
import { simulateElectrical } from '../../src/equipment/electrical/simulate.ts';
import { buildElectricalMeasurements } from '../../src/equipment/electrical/measure.ts';
import { appendMeasurements, correctManualMeasurement, parseManualValue, removeMeasurement } from '../../src/core/measurements/records.ts';
import { measurementRows, measurementStatusLabel } from '../../src/core/measurements/table.ts';
import { csvCell, measurementsCsv } from '../../src/core/measurements/csv.ts';
import { chartSegments, measurementChartProfiles, measurementSeries, normalizedChartPosition } from '../../src/core/measurements/charts.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';

const registry = createElectricalRegistry(), timestamp = '2026-11-04T06:00:00.000Z';
function scene() {
  const document = createEmptyScene('measurement.test', timestamp);
  document.equipment = [[POWER, 'E'], [RESISTOR, 'R'], [AMMETER, 'A'], [VOLTMETER, 'V']].map(([type, id], index) => ({
    id, type, definitionVersion: 1, parameters: registry.get(type, 1).defaultParameters, pose: { xM: .2 * index, yM: 0, rotationRad: 0 },
  }));
  document.connections = [['E', 'positive', 'A', 'low'], ['A', 'common', 'R', 'a'], ['R', 'b', 'E', 'negative'], ['V', 'high', 'R', 'a'], ['V', 'common', 'R', 'b']].map(([a, ap, b, bp], index) => ({ id: `w${index}`, kind: 'wire', from: { equipmentId: a, portId: ap }, to: { equipmentId: b, portId: bp } }));
  return document;
}
function reply(document) {
  return { documentId: document.documentId, documentRevision: document.revision, runId: 'run.test', sequence: document.revision + 1, commandType: 'result', payload: simulateElectrical(document) };
}
function entry(sampleId = 'sample.1', source = 'instrument') {
  return { source, sampleId, setupLabel: '串联对照', note: '', timestamp,
    choices: [{ id: `${sampleId}.I`, equipmentId: 'A', pointLabel: 'I总', rawInput: ' 0.29 ' }, { id: `${sampleId}.U`, equipmentId: 'V', pointLabel: 'U1', rawInput: '' }] };
}
function batch(document, request = entry()) {
  const result = buildElectricalMeasurements(document, registry, reply(document), request);
  assert.equal(result.ok, true, JSON.stringify(result)); return result;
}
function append(document, request = entry()) {
  const built = batch(document, request), result = appendMeasurements(document, registry, built.records, built.snapshot, timestamp);
  assert.equal(result.ok, true, JSON.stringify(result)); return result.document;
}
function csvRows(text) {
  const result = []; let row = [], cell = '', quoted = false;
  for (let index = 1; index < text.length; index++) {
    const character = text[index];
    if (character === '"') { if (quoted && text[index + 1] === '"') { cell += '"'; index++; } else quoted = !quoted; }
    else if (!quoted && character === ',') { row.push(cell); cell = ''; }
    else if (!quoted && character === '\r' && text[index + 1] === '\n') { row.push(cell); result.push(row); row = []; cell = ''; index++; }
    else cell += character;
  }
  return result;
}

test('instrument acquisition stores quantized display separately from true current and one shared immutable connection snapshot', () => {
  const original = scene(); original.equipment[1].parameters.resistanceOhm = 11;
  const before = structuredClone(original), recorded = append(original);
  assert.deepEqual(original, before);
  assert.equal(recorded.measurementRecords[0].value, .28);
  assert.ok(Math.abs(recorded.measurementRecords[0].context.physicalValue - 3 / 11) < 1e-9);
  assert.equal(recorded.measurementRecords[0].rawInput, null);
  assert.equal(recorded.measurementRecords[1].value, 3);
  assert.equal(recorded.measurementSnapshots.length, 1);
  assert.deepEqual(recorded.measurementSnapshots[0].equipment, before.equipment);
  assert.deepEqual(recorded.measurementSnapshots[0].connections, before.connections);
  assert.equal(recorded.measurementSnapshots[0].modelVersion, 'dc-mna.v2');
  original.equipment[0].parameters.voltageV = 6; original.connections[0].to.portId = 'high';
  assert.deepEqual(recorded.measurementSnapshots[0].equipment, before.equipment);
  assert.deepEqual(recorded.measurementSnapshots[0].connections, before.connections);
});

test('manual raw input and entered value stay independent of truth; blank is missing and never zero-filled', () => {
  const recorded = append(scene(), entry('manual.1', 'manual'));
  const [current, volts] = recorded.measurementRecords;
  assert.equal(current.value, .29); assert.equal(current.rawInput, ' 0.29 ');
  assert.equal(current.context.instrumentDisplayValue, .3); assert.ok(Math.abs(current.context.physicalValue - .3) < 1e-9);
  assert.equal(volts.value, null); assert.equal(volts.measurementStatus, 'invalid'); assert.equal(measurementStatusLabel(volts), '缺失');
});

test('manual parsing accepts finite decimal estimates and rejects formulas, Infinity, NaN, hex and mixed units atomically', () => {
  for (const text of ['.29', '+0.29', ' 2.9e-1 ']) assert.deepEqual(parseManualValue(text), { ok: true, value: .29 });
  assert.deepEqual(parseManualValue(' '), { ok: true, value: null });
  const document = scene(), before = structuredClone(document);
  for (const text of ['=1+1', '@SUM(1)', 'Infinity', 'NaN', '0x10', '0.3 A', '1e999']) {
    const input = entry('manual.invalid', 'manual'); input.choices[1].rawInput = text;
    const result = buildElectricalMeasurements(document, registry, reply(document), input);
    assert.equal(result.ok, false); assert.equal('records' in result, false); assert.deepEqual(document, before);
  }
});

test('reverse, over-range, disconnected, floating and model failure record status without a normal value', () => {
  for (const [change, expected] of [
    [document => { document.equipment[0].parameters.voltageV = 9; }, 'over-range'],
    [document => { document.connections[0].to.portId = 'common'; document.connections[1].from.portId = 'low'; }, 'reverse'],
    [document => { document.connections.splice(0, 1); }, 'invalid'],
    [document => { document.connections.push({ id: 'wrong', kind: 'wire', from: { equipmentId: 'A', portId: 'high' }, to: { equipmentId: 'E', portId: 'positive' } }); }, 'out-of-model'],
  ]) {
    const document = scene(); change(document);
    for (const source of ['instrument', 'manual']) {
      const result = batch(document, entry(`sample.${source}`, source));
      assert.equal(result.records[0].value, null); assert.equal(result.records[0].measurementStatus, expected);
      assert.equal(result.records[0].context.instrumentDisplayValue, null);
    }
  }
  const floating = scene(); floating.connections = floating.connections.slice(3);
  floating.connections[0].to = { equipmentId: 'E', portId: 'positive' };
  floating.connections[1].to = { equipmentId: 'R', portId: 'a' };
  const result = batch(floating); assert.equal(result.records[1].value, null); assert.equal(result.records[1].context.instrumentStatus, 'undefined');
});

test('manual estimates outside selected range are labeled and retain original text without valid numeric data', () => {
  for (const [text, status] of [['-.1', 'reverse'], ['.7', 'over-range']]) {
    const input = entry('manual.range', 'manual'); input.choices[0].rawInput = text;
    const record = batch(scene(), input).records[0];
    assert.equal(record.value, null); assert.equal(record.measurementStatus, status); assert.equal(record.rawInput, text);
    assert.equal(record.context.instrumentDisplayValue, .3);
  }
});

test('stale tags, missing result, wrong document and altered snapshot state cannot be appended', () => {
  const document = scene(), current = reply(document);
  for (const value of [null, { ...current, documentRevision: 1 }, { ...current, documentId: 'other' }, { ...current, sequence: 0 }]) {
    assert.equal(buildElectricalMeasurements(document, registry, value, entry()).ok, false);
  }
  const built = batch(document); built.snapshot.equipment[0].parameters.voltageV = 100;
  assert.equal(appendMeasurements(document, registry, built.records, built.snapshot, timestamp).ok, false);
  const sameMeterTwice = entry(); sameMeterTwice.choices.push({ ...sameMeterTwice.choices[0], id: 'other.record' });
  assert.equal(buildElectricalMeasurements(document, registry, current, sameMeterTwice).ok, false);
});

test('sampling, correction and deletion are single reversible transactions and keep original acquisition metadata', () => {
  const original = scene(), built = batch(original, entry('manual.1', 'manual'));
  const made = executeCommand(createHistory(original), { type: 'record-measurements', records: built.records, snapshot: built.snapshot }, registry, timestamp);
  assert.equal(made.ok, true); assert.equal(made.history.undo.length, 1); assert.equal(made.history.present.revision, 1);
  const snapshot = structuredClone(made.history.present.measurementSnapshots);
  const changed = correctManualMeasurement(made.history.present, registry, built.records[0].id, '0.31', '2026-11-04T07:00:00.000Z');
  assert.equal(changed.ok, true); assert.equal(changed.document.measurementRecords[0].value, .31);
  assert.equal(changed.document.measurementRecords[0].recordedAt, timestamp);
  assert.equal(changed.document.measurementRecords[0].context.physicalValue, built.records[0].context.physicalValue);
  assert.deepEqual(changed.document.measurementSnapshots, snapshot);
  assert.equal(changed.document.measurementRecords[0].context.originalRawInput, ' 0.29 ');
  assert.equal(correctManualMeasurement(changed.document, registry, built.records[0].id, '0.31', timestamp).document, changed.document);
  const undone = travelHistory(made.history, 'undo', registry, timestamp);
  assert.equal(undone.ok, true); assert.equal(undone.history.present.measurementRecords.length, 0);
  const redone = travelHistory(undone.history, 'redo', registry, timestamp);
  assert.equal(redone.ok, true); assert.deepEqual(redone.history.present.measurementRecords, built.records);
  const one = removeMeasurement(changed.document, registry, built.records[0].id, timestamp); assert.equal(one.ok, true); assert.equal(one.document.measurementSnapshots.length, 1);
  const none = removeMeasurement(one.document, registry, built.records[1].id, timestamp); assert.equal(none.ok, true); assert.equal(none.document.measurementSnapshots.length, 0);
  const instrument = append(original); assert.equal(correctManualMeasurement(instrument, registry, instrument.measurementRecords[0].id, '.4', timestamp).ok, false);
});

test('snapshot files round-trip, preserve old format 2 records and reject missing, future, corrupt or fake instrument snapshots', () => {
  const recorded = append(scene());
  assert.deepEqual(parseSceneJson(serializeScene(recorded, registry), registry).document, recorded);
  for (const change of [
    document => { document.measurementSnapshots = []; }, document => { document.measurementSnapshots[0].documentRevision = 99; },
    document => { document.measurementSnapshots[0].connections[0].to.portId = 'absent'; },
    document => { document.measurementRecords[0].runId = 'other.run'; },
    document => { document.measurementRecords[0].value = .45; },
    document => { document.measurementRecords[0].context.instrumentDisplayValue = null; },
  ]) {
    const invalid = structuredClone(recorded); change(invalid); assert.equal(parseSceneJson(JSON.stringify(invalid), registry).ok, false);
  }
  const legacy = structuredClone(recorded); delete legacy.measurementSnapshots; legacy.measurementRecords.forEach(record => { delete record.context; });
  assert.deepEqual(parseSceneJson(JSON.stringify(legacy), registry).document, legacy);
  const v1 = { ...legacy, schemaVersion: 1 }; assert.equal(parseSceneJson(JSON.stringify(v1), registry).ok, true);
  const fakeV1 = { ...recorded, schemaVersion: 1 }; assert.equal(parseSceneJson(JSON.stringify(fakeV1), registry).ok, false);
});

test('quantity/units remain strict and records and snapshots keep existing count and 5 MiB guards', () => {
  const document = append(scene());
  const mismatch = structuredClone(document); mismatch.measurementRecords[0].unit = 'V'; assert.equal(validateSceneDocument(mismatch, registry).ok, false);
  const limit = scene(); limit.measurementRecords = Array(10000).fill(document.measurementRecords[0]);
  const built = batch(limit); assert.equal(appendMeasurements(limit, registry, built.records, built.snapshot, timestamp).diagnostics[0].code, 'MEASUREMENT_LIMIT');
  const large = scene(), legacy = { ...structuredClone(document.measurementRecords[0]), source: 'manual', rawInput: '0'.repeat(1000) };
  delete legacy.context;
  const at = index => ({ ...legacy, id: `legacy.${String(index).padStart(6, '0')}` });
  large.measurementRecords = [at(0)]; const oneLength = utf8ByteLength(JSON.stringify(large, null, 2));
  large.measurementRecords.push(at(1)); const increment = utf8ByteLength(JSON.stringify(large, null, 2)) - oneLength;
  const count = Math.floor((MAX_DOCUMENT_BYTES - oneLength) / increment) + 1;
  large.measurementRecords = Array.from({ length: count }, (_, index) => at(index));
  assert.ok(utf8ByteLength(JSON.stringify(large, null, 2)) <= MAX_DOCUMENT_BYTES);
  const oversized = batch(large);
  assert.equal(appendMeasurements(large, registry, oversized.records, oversized.snapshot, timestamp).diagnostics[0].code, 'MEASUREMENT_DOCUMENT_TOO_LARGE');
  assert.equal(parseSceneJson(JSON.stringify({ ...scene(), measurementSnapshots: Array(10001).fill({}) }), registry).ok, false);
});

test('CSV table values match records, blank invalid cells remain blank and snapshots are exportable', () => {
  const document = append(scene(), entry('manual.1', 'manual'));
  document.title = '串联,"实验"'; document.measurementSnapshots[0].note = '第一行\r\n第二行,"注释"';
  const output = csvRows(measurementsCsv(document)), header = output[0];
  const get = (row, name) => row[header.indexOf(name)];
  assert.equal(output.length, 3); assert.ok(output.every(row => row.length === header.length));
  assert.equal(get(output[1], '记录值'), '0.29'); assert.equal(get(output[1], '原始抄表文本'), ' 0.29 ');
  assert.equal(get(output[2], '记录值'), ''); assert.equal(get(output[2], '状态'), '缺失');
  assert.equal(get(output[1], '实验名称'), document.title); assert.equal(get(output[1], '备注'), document.measurementSnapshots[0].note);
  assert.deepEqual(JSON.parse(get(output[1], '连接快照')), document.measurementSnapshots[0].connections);
  assert.equal(get(output[2], '连接快照'), '');
  assert.equal(get(output[1], '采样标识'), get(output[2], '采样标识'));
  assert.equal(measurementRows(document)[0].sampleIndex, measurementRows(document)[1].sampleIndex);
});

test('CSV neutralizes formula initiators including whitespace, control and full-width variants while finite numbers remain numeric', () => {
  for (const text of ['=1+1', '+cmd', '-cmd', '@SUM(A1)', '\t=cmd', '\r@cmd', '\n=cmd', '  =cmd', '＝1+1', '＋cmd', '－cmd', '＠cmd']) {
    const output = csvCell(text); assert.ok(output.startsWith('"\t'), output); assert.ok(output.endsWith('"'));
  }
  assert.equal(csvCell(-.2), '-0.2'); assert.equal(csvCell(null), '""');
  assert.equal(csvCell('甲,"乙"'), '"甲,""乙"""'); assert.throws(() => csvCell(Infinity), /NON_FINITE/);
});

test('comparison chart uses the exact entered table values and separates manual from instrument sources and units', () => {
  let document = append(scene(), entry('manual.1', 'manual'));
  document = append(document, entry('instrument.2'));
  const current = measurementSeries(document, measurementChartProfiles[0]);
  assert.equal(current.length, 2);
  assert.deepEqual(current.map(group => group.points[0].y), [.29, .3]);
  assert.deepEqual(current.map(group => group.points[0].x), [1, 2]);
  const voltage = measurementSeries(document, measurementChartProfiles[1]);
  assert.equal(voltage[0].points[0].y, null); assert.equal(voltage[1].points[0].y, 3);
  assert.ok(current.every(group => group.points.every(point => document.measurementRecords.some(record => record.id === point.recordId))));
});

test('invalid or absent samples break chart segments and never create zero readings', () => {
  let document = append(scene(), entry('sample.1'));
  document.equipment[0].parameters.voltageV = 9;
  document = append(document, entry('sample.2'));
  document.equipment[0].parameters.voltageV = 3;
  document = append(document, entry('sample.3'));
  const points = measurementSeries(document, measurementChartProfiles[0])[0].points;
  assert.deepEqual(points.map(point => point.y), [.3, null, .3]);
  assert.deepEqual(chartSegments(points).map(segment => segment.length), [1, 1]);
});

test('reserved field axes produce no fabricated data, require unique same-sample pairs and square time only on the axis', () => {
  assert.ok(measurementChartProfiles.slice(2).every(profile => !profile.available));
  assert.ok(measurementChartProfiles.slice(2).every(profile => measurementSeries(scene(), profile).length === 0));
  const document = append(scene(), entry('sample.1', 'manual'));
  const [time, displacement] = document.measurementRecords;
  Object.assign(time, { quantity: 'time', unit: 's', value: .5 }); time.context.pointLabel = '时间';
  Object.assign(displacement, { quantity: 'length', unit: 'm', value: 1.25, measurementStatus: 'valid' }); displacement.context.pointLabel = '向下位移';
  const profile = measurementChartProfiles.find(item => item.id === 'projectile-y-t2');
  const data = measurementSeries(document, profile); assert.equal(data[0].points[0].x, .25); assert.equal(data[0].points[0].y, 1.25); assert.equal(time.value, .5);
  document.measurementRecords.push({ ...structuredClone(time), id: 'ambiguous' });
  assert.equal(measurementSeries(document, profile).length, 0);
});

test('explicit random-error configuration is preserved and marked not applied instead of inventing random measurements', () => {
  const document = scene(); document.simulationConfig.randomError = { enabled: true, seed: 5, distribution: 'uniform', amplitude: .1 };
  const recorded = append(document);
  assert.equal(recorded.measurementRecords[0].value, .3);
  assert.ok(recorded.measurementRecords[0].context.diagnosticCodes.includes('RANDOM_ERROR_NOT_APPLIED'));
  assert.deepEqual(recorded.measurementRecords[0].modelConfigSnapshot, document.simulationConfig);
});

test('chart projection handles zero, equal and extreme finite values without overflow or invented values', () => {
  assert.equal(normalizedChartPosition(0, -1e308, 1e308), .5);
  assert.equal(normalizedChartPosition(-1e308, -1e308, 1e308), 0);
  assert.equal(normalizedChartPosition(1e308, -1e308, 1e308), 1);
  assert.equal(normalizedChartPosition(0, 0, 0), .5);
  assert.throws(() => normalizedChartPosition(Infinity, 0, 1), /NON_FINITE/);
});
