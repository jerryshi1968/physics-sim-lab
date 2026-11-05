export type SampleResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'invalid'; code: string };

export function invalid(code: string): SampleResult<never> {
  return { status: 'invalid', code };
}

export function finite(...values: number[]): boolean {
  return values.every(Number.isFinite);
}

function serializableNumbers(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (value === null || typeof value !== 'object') return true;
  return Object.values(value).every(serializableNumbers);
}

export function success<T>(value: T): SampleResult<T> {
  return serializableNumbers(value) ? { status: 'ok', value } : invalid('NUMERIC_RANGE');
}
