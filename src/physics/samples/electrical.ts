import { finite, invalid, success } from './result.ts';
import type { SampleResult } from './result.ts';

export type Topology = 'series' | 'parallel';
export interface CircuitSample {
  totalCurrentA: number;
  branchCurrentsA: number[];
  branchVoltagesV: number[];
  branchPowersW: number[];
  sourcePowerW: number;
}
export interface LampSpec {
  ratedVoltageV: number;
  ratedCurrentA: number;
  coldResistanceOhm: number;
  maxCurrentA: number;
}
interface LampModel {
  resistanceOhm: number;
  cubicVPerA3: number;
  maxCurrentA: number;
}

function circuitResult(
  topology: Topology, voltageV: number, currentsA: number[], voltagesV: number[],
): SampleResult<CircuitSample> {
  const totalCurrentA = topology === 'series' ? currentsA[0]! : currentsA.reduce((a, b) => a + b, 0);
  return success({
    totalCurrentA,
    branchCurrentsA: currentsA,
    branchVoltagesV: voltagesV,
    branchPowersW: currentsA.map((current, index) => current * voltagesV[index]!),
    sourcePowerW: voltageV * totalCurrentA,
  });
}

export function solveResistors(
  topology: Topology, voltageV: number, resistancesOhm: readonly number[],
): SampleResult<CircuitSample> {
  if (!['series', 'parallel'].includes(topology) || !finite(voltageV)
    || resistancesOhm.length === 0 || !resistancesOhm.every(r => finite(r) && r > 0)) {
    return invalid('INVALID_CIRCUIT_PARAMETERS');
  }
  if (topology === 'series') {
    const resistanceOhm = resistancesOhm.reduce((a, b) => a + b, 0);
    if (!finite(resistanceOhm)) return invalid('NUMERIC_RANGE');
    const currentA = voltageV / resistanceOhm;
    return circuitResult(topology, voltageV, resistancesOhm.map(() => currentA),
      resistancesOhm.map(r => currentA * r));
  }
  return circuitResult(topology, voltageV, resistancesOhm.map(r => voltageV / r),
    resistancesOhm.map(() => voltageV));
}

function lampModel(spec: LampSpec): SampleResult<LampModel> {
  const { ratedVoltageV: ur, ratedCurrentA: ir, coldResistanceOhm: r, maxCurrentA } = spec;
  if (!finite(ur, ir, r, maxCurrentA) || ur <= 0 || ir <= 0 || r <= 0
    || maxCurrentA < ir || ur < r * ir) return invalid('INVALID_LAMP_PARAMETERS');
  return success({ resistanceOhm: r, cubicVPerA3: (ur - r * ir) / ir ** 3, maxCurrentA });
}

function lampVoltage(currentA: number, model: LampModel): number {
  return model.resistanceOhm * currentA + model.cubicVPerA3 * currentA ** 3;
}

function currentAtVoltage(voltageV: number, model: LampModel, maxIterations: number): SampleResult<number> {
  const targetV = Math.abs(voltageV);
  const maxVoltageV = lampVoltage(model.maxCurrentA, model);
  if (!finite(maxVoltageV)) return invalid('NUMERIC_RANGE');
  if (targetV > maxVoltageV) return invalid('LAMP_MODEL_RANGE');
  if (targetV === 0) return success(0);
  let lowA = 0;
  let highA = model.maxCurrentA;
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const middleA = lowA + (highA - lowA) / 2;
    const errorV = lampVoltage(middleA, model) - targetV;
    if (Math.abs(errorV) <= 1e-12 + 1e-12 * targetV) return success(Math.sign(voltageV) * middleA);
    if (errorV > 0) highA = middleA;
    else lowA = middleA;
  }
  return invalid('NON_CONVERGENCE');
}

export function solveLamps(
  topology: Topology, voltageV: number, lamps: readonly LampSpec[], maxIterations = 128,
): SampleResult<CircuitSample> {
  if (!['series', 'parallel'].includes(topology) || !finite(voltageV)
    || lamps.length === 0 || !Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > 1024) {
    return invalid('INVALID_CIRCUIT_PARAMETERS');
  }
  const models: LampModel[] = [];
  for (const spec of lamps) {
    const result = lampModel(spec);
    if (result.status === 'invalid') return result;
    models.push(result.value);
  }
  if (topology === 'series') {
    const aggregate = models.reduce((a, b) => ({
      resistanceOhm: a.resistanceOhm + b.resistanceOhm,
      cubicVPerA3: a.cubicVPerA3 + b.cubicVPerA3,
      maxCurrentA: Math.min(a.maxCurrentA, b.maxCurrentA),
    }), { resistanceOhm: 0, cubicVPerA3: 0, maxCurrentA: models[0]!.maxCurrentA });
    if (!finite(aggregate.resistanceOhm, aggregate.cubicVPerA3)) return invalid('NUMERIC_RANGE');
    const current = currentAtVoltage(voltageV, aggregate, maxIterations);
    if (current.status === 'invalid') return current;
    return circuitResult(topology, voltageV, models.map(() => current.value),
      models.map(model => lampVoltage(current.value, model)));
  }
  const currentsA: number[] = [];
  for (const model of models) {
    const current = currentAtVoltage(voltageV, model, maxIterations);
    if (current.status === 'invalid') return current;
    currentsA.push(current.value);
  }
  return circuitResult(topology, voltageV, currentsA, models.map(() => voltageV));
}
