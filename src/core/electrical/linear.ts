export const MAX_DC_UNKNOWNS = 256;
export interface LinearSystem { matrix: number[][]; rhs: number[] }
export type LinearResult = { ok: true; values: number[]; relativeResidual: number; minimumPivot: number }
  | { ok: false; code: string };

export function createLinearSystem(size: number): LinearSystem {
  return { matrix: Array.from({ length: size }, () => Array<number>(size).fill(0)), rhs: Array<number>(size).fill(0) };
}

export function stampAffineConductance(system: LinearSystem, a: number | undefined, b: number | undefined, conductanceS: number, offsetCurrentA = 0): void {
  // I(a→b) = G·(Va−Vb) + I0; an absent index is this component's reference node.
  if (a !== undefined) { system.matrix[a]![a]! += conductanceS; system.rhs[a]! -= offsetCurrentA; }
  if (b !== undefined) { system.matrix[b]![b]! += conductanceS; system.rhs[b]! += offsetCurrentA; }
  if (a !== undefined && b !== undefined) { system.matrix[a]![b]! -= conductanceS; system.matrix[b]![a]! -= conductanceS; }
}

export function stampVoltageBranch(system: LinearSystem, a: number | undefined, b: number | undefined, currentIndex: number, voltageV: number, resistanceOhm: number): void {
  // Passive sign convention: Va−Vb−R·I = E; delivered source current is −I.
  if (a !== undefined) { system.matrix[a]![currentIndex]! += 1; system.matrix[currentIndex]![a]! += 1; }
  if (b !== undefined) { system.matrix[b]![currentIndex]! -= 1; system.matrix[currentIndex]![b]! -= 1; }
  system.matrix[currentIndex]![currentIndex]! -= resistanceOhm;
  system.rhs[currentIndex]! += voltageV;
}

export function solveLinearSystem(system: LinearSystem): LinearResult {
  const size = system.rhs.length;
  if (size > MAX_DC_UNKNOWNS) return { ok: false, code: 'NETWORK_TOO_LARGE' };
  if (system.matrix.length !== size || system.matrix.some(row => row.length !== size || !row.every(Number.isFinite)) || !system.rhs.every(Number.isFinite)) {
    return { ok: false, code: 'NUMERIC_RANGE' };
  }
  if (size === 0) return { ok: true, values: [], relativeResidual: 0, minimumPivot: 1 };
  const matrix = system.matrix.map(row => [...row]);
  const rhs = [...system.rhs];
  for (let row = 0; row < size; row++) {
    const scale = Math.max(...matrix[row]!.map(Math.abs));
    if (scale === 0) return { ok: false, code: 'SINGULAR_MATRIX' };
    matrix[row] = matrix[row]!.map(value => value / scale);
    rhs[row]! /= scale;
  }
  const columnScales = Array.from({ length: size }, (_, column) => Math.max(...matrix.map(row => Math.abs(row[column]!))));
  if (columnScales.some(scale => scale === 0)) return { ok: false, code: 'SINGULAR_MATRIX' };
  for (const row of matrix) for (let column = 0; column < size; column++) row[column]! /= columnScales[column]!;
  let minimumPivot = 1;
  for (let column = 0; column < size; column++) {
    let pivot = column;
    for (let row = column + 1; row < size; row++) if (Math.abs(matrix[row]![column]!) > Math.abs(matrix[pivot]![column]!)) pivot = row;
    const magnitude = Math.abs(matrix[pivot]![column]!);
    if (magnitude === 0) return { ok: false, code: 'SINGULAR_MATRIX' };
    if (magnitude < 1e-12) return { ok: false, code: 'ILL_CONDITIONED_MATRIX' };
    minimumPivot = Math.min(minimumPivot, magnitude);
    [matrix[column], matrix[pivot]] = [matrix[pivot]!, matrix[column]!];
    [rhs[column], rhs[pivot]] = [rhs[pivot]!, rhs[column]!];
    for (let row = column + 1; row < size; row++) {
      const factor = matrix[row]![column]! / matrix[column]![column]!;
      matrix[row]![column] = 0;
      for (let next = column + 1; next < size; next++) matrix[row]![next]! -= factor * matrix[column]![next]!;
      rhs[row]! -= factor * rhs[column]!;
    }
  }
  const scaledValues = Array<number>(size).fill(0);
  for (let row = size - 1; row >= 0; row--) {
    let value = rhs[row]!;
    for (let column = row + 1; column < size; column++) value -= matrix[row]![column]! * scaledValues[column]!;
    scaledValues[row] = value / matrix[row]![row]!;
  }
  const values = scaledValues.map((value, index) => value / columnScales[index]!);
  if (!values.every(Number.isFinite)) return { ok: false, code: 'NUMERIC_RANGE' };
  let relativeResidual = 0;
  for (let row = 0; row < size; row++) {
    let actual = 0, scale = Math.abs(system.rhs[row]!);
    for (let column = 0; column < size; column++) {
      const term = system.matrix[row]![column]! * values[column]!;
      actual += term; scale += Math.abs(term);
    }
    const error = Math.abs(actual - system.rhs[row]!);
    const normalized = scale === 0 ? error : error / scale;
    if (![actual, scale, normalized].every(Number.isFinite)) return { ok: false, code: 'NUMERIC_RANGE' };
    relativeResidual = Math.max(relativeResidual, normalized);
  }
  if (relativeResidual > 1e-8) return { ok: false, code: 'LINEAR_RESIDUAL_TOO_LARGE' };
  return { ok: true, values, relativeResidual, minimumPivot };
}
