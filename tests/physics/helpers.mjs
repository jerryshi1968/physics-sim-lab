import assert from 'node:assert/strict';

export function ok(result) {
  assert.equal(result.status, 'ok', JSON.stringify(result));
  return result.value;
}

export function invalid(result, code) {
  assert.deepEqual(result, { status: 'invalid', code });
}

export function close(actual, expected, absolute = 1e-9, relative = 0) {
  assert.ok(Number.isFinite(actual), `Non-finite actual: ${actual}`);
  assert.ok(Math.abs(actual - expected) <= absolute + relative * Math.abs(expected),
    `${actual} differs from ${expected}`);
}

export function finiteJSON(value) {
  function visit(item) {
    if (typeof item === 'number') assert.ok(Number.isFinite(item));
    else if (item !== null && typeof item === 'object') Object.values(item).forEach(visit);
  }
  visit(value);
  assert.deepEqual(JSON.parse(JSON.stringify(value)), value);
}
