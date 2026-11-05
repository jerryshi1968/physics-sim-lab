import test from 'node:test';
import assert from 'node:assert/strict';
import { solveDcNetlist } from '../../src/core/electrical/solve.ts';
import { source, resistor, wire, meter, probe, network } from './dc-fixtures.mjs';

function solved(input) {
  const result = solveDcNetlist(input);
  assert.equal(result.ok, true, JSON.stringify(result));
  for (const value of Object.values(result.solution.residuals)) assert.equal(Number.isFinite(value), true);
  for (const key of ['normalizedKcl', 'normalizedConstitutive', 'normalizedPower']) assert.ok(result.solution.residuals[key] <= 1e-6, key);
  return result;
}
const branch = (result, id) => result.solution.branches.find(value => value.id === id);
function close(actual, expected) { assert.equal(typeof actual, 'number'); assert.ok(Number.isFinite(actual)); assert.ok(Math.abs(actual - expected) <= 1e-9 + 1e-6 * Math.abs(expected), `${actual} != ${expected}`); }
function failed(input, code) {
  const result = solveDcNetlist(input);
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.equal(result.measurementUsable, false);
  assert.equal('solution' in result, false);
  assert.ok(result.diagnostics.some(item => item.code === code), JSON.stringify(result));
  return result;
}

test('3 V / 10 Ω / 20 Ω series benchmark has 0.1 A and 1/2 V without a topology flag', () => {
  const input = network(source(), resistor('R1', 'p', 'm', 10), resistor('R2', 'm', 'n', 20), probe('V1', 'p', 'm'));
  const before = structuredClone(input);
  const result = solved(input);
  close(branch(result, 'R1').currentA, .1); close(branch(result, 'R2').currentA, .1);
  close(branch(result, 'R1').voltageV, 1); close(branch(result, 'R2').voltageV, 2);
  close(branch(result, 'E').currentA, -.1); close(branch(result, 'E').powerW, -.3);
  close(branch(result, 'V1').voltageV, 1); close(branch(result, 'V1').currentA, 0);
  assert.deepEqual(input, before);
});

test('3 V parallel benchmark has .3/.15 A branches, .45 A source and equal 3 V', () => {
  const result = solved(network(source(), resistor('R1', 'p', 'n', 10), resistor('R2', 'p', 'n', 20)));
  close(branch(result, 'R1').currentA, .3); close(branch(result, 'R2').currentA, .15);
  close(branch(result, 'E').currentA, -.45);
  close(branch(result, 'R1').voltageV, 3); close(branch(result, 'R2').voltageV, 3);
});

test('an unbalanced bridge follows independent rational nodal values, not series/parallel heuristics', () => {
  const result = solved(network(source('E', 'p', 'n', 10), resistor('pa', 'p', 'a', 10), resistor('an', 'a', 'n', 10),
    resistor('pb', 'p', 'b', 10), resistor('bn', 'b', 'n', 20), resistor('bridge', 'a', 'b', 10)));
  close(branch(result, 'an').voltageV, 70 / 13); close(branch(result, 'bn').voltageV, 80 / 13);
  close(branch(result, 'bridge').currentA, -1 / 13); close(branch(result, 'E').currentA, -11 / 13);
  close(branch(result, 'pa').voltageV + branch(result, 'bridge').voltageV + branch(result, 'bn').voltageV, 10);
});

test('balanced bridge has zero bridge current and additive power balance', () => {
  const result = solved(network(source('E', 'p', 'n', 12), resistor('pa', 'p', 'a', 100), resistor('an', 'a', 'n', 100),
    resistor('pb', 'p', 'b', 200), resistor('bn', 'b', 'n', 200), resistor('bridge', 'a', 'b', 50)));
  close(branch(result, 'bridge').currentA, 0); close(branch(result, 'E').currentA, -.09);
  close(branch(result, 'an').voltageV, 6); close(branch(result, 'bn').voltageV, 6);
});

test('finite source internal resistance has explicit droop, internal loss and emf power', () => {
  const result = solved(network(source('E', 'p', 'n', 3, .5), resistor('R', 'p', 'n', 9.5)));
  close(branch(result, 'R').currentA, .3); close(branch(result, 'E').voltageV, 2.85);
  close(branch(result, 'E').internalLossW, .045); close(branch(result, 'E').emfPowerW, -.9);
  close(branch(result, 'E').powerW, -.855);
});

test('explicit .5 Ω internal resistance limits a 3 V short to 6 A without gmin', () => {
  const result = solved(network(source('E', 'p', 'n', 3, .5), wire('short', 'p', 'n')));
  close(branch(result, 'E').currentA, -6); close(branch(result, 'E').voltageV, 0);
  close(branch(result, 'E').internalLossW, 18); close(branch(result, 'E').emfPowerW, -18);
});

test('open switch retains zero current and a determined 3 V open-terminal drop', () => {
  const result = solved(network(source(), resistor('R', 'p', 'm', 10), { id: 'S', kind: 'switch', from: 'm', to: 'n', closed: false, resistanceOhm: 0 }));
  close(branch(result, 'E').currentA, 0); close(branch(result, 'R').currentA, 0);
  close(branch(result, 'S').currentA, 0); close(branch(result, 'S').voltageV, 3);
  assert.equal(result.solution.components.length, 1);
});

test('zero-ohm wire and closed switch merge nodes, finite wire/contact resistance stays explicit', () => {
  const merged = solved(network(source(), wire('w', 'p', 'q'), { id: 'S', kind: 'switch', from: 'q', to: 'm', closed: true, resistanceOhm: 0 }, resistor('R', 'm', 'n', 10)));
  close(branch(merged, 'R').currentA, .3);
  assert.equal(branch(merged, 'w').currentA, null);
  assert.equal(branch(merged, 'S').currentStatus, 'not-observable');
  const finite = solved(network(source(), wire('w', 'p', 'm', .5), { id: 'S', kind: 'switch', from: 'm', to: 'q', closed: true, resistanceOhm: .5 }, resistor('R', 'q', 'n', 9)));
  close(branch(finite, 'R').currentA, .3); close(branch(finite, 'w').voltageV, .15); close(branch(finite, 'S').powerW, .045);
});

test('ideal current measurement uses a zero-volt unknown-current branch and respects reversed polarity', () => {
  const result = solved(network(source(), meter('A', 'p', 'm'), resistor('R', 'm', 'n', 10)));
  close(branch(result, 'A').currentA, .3); close(branch(result, 'A').voltageV, 0);
  const reversed = solved(network(source(), meter('A', 'm', 'p'), resistor('R', 'm', 'n', 10)));
  close(branch(reversed, 'A').currentA, -.3);
});

test('finite current meter resistance loads the measured circuit explicitly', () => {
  const result = solved(network(source('E', 'p', 'n', 11), meter('A', 'p', 'm', 1), resistor('R', 'm', 'n', 10)));
  close(branch(result, 'A').currentA, 1); close(branch(result, 'A').voltageV, 1); close(branch(result, 'R').voltageV, 10);
});

test('ideal voltage probe does not load a divider; finite input resistance does', () => {
  const make = inputR => network(source('E', 'p', 'n', 10), resistor('Ra', 'p', 'm', 10), resistor('Rb', 'm', 'n', 10), probe('V', 'm', 'n', inputR));
  const ideal = solved(make(null)); close(branch(ideal, 'V').voltageV, 5); close(branch(ideal, 'V').currentA, 0);
  const loaded = solved(make(10)); close(branch(loaded, 'V').voltageV, 10 / 3); close(branch(loaded, 'V').currentA, 1 / 3);
});

test('a probe between floating components is undefined rather than subtracting arbitrary reference zeros', () => {
  const result = solved(network(source('E1', 'p1', 'n1', 3), resistor('R1', 'p1', 'n1', 10),
    source('E2', 'p2', 'n2', 6), resistor('R2', 'p2', 'n2', 20), probe('cross', 'p1', 'p2')));
  assert.equal(result.solution.components.length, 2);
  assert.equal(branch(result, 'cross').voltageV, null);
  assert.equal(branch(result, 'cross').measurementUsable, false);
  assert.equal(branch(result, 'cross').voltageStatus, 'undefined-between-components');
  close(branch(result, 'R1').currentA, .3); close(branch(result, 'R2').currentA, .3);
  assert.ok(result.diagnostics.some(item => item.code === 'UNDEFINED_VOLTAGE' && item.equipmentIds.includes('cross')));
  assert.equal(result.solution.nodes.filter(node => node.isReference).length, 2);
});

test('a finite voltage input physically links floating components while an ideal probe leaves them separate', () => {
  const result = solved(network(source('E1', 'p1', 'n1', 3), source('E2', 'p2', 'n2', 6), probe('V', 'p1', 'p2', 1000)));
  assert.equal(result.solution.components.length, 1); close(branch(result, 'V').voltageV, 0); close(branch(result, 'V').currentA, 0);
});

test('zero supply, passive islands and empty networks have finite valid solutions', () => {
  const zero = solved(network(source('E', 'p', 'n', 0), resistor('R', 'p', 'n', 10)));
  close(branch(zero, 'E').currentA, 0); close(branch(zero, 'R').voltageV, 0);
  const island = solved(network(resistor('R', 'a', 'b', 10))); close(branch(island, 'R').currentA, 0);
  assert.deepEqual(solved({ terminals: [], branches: [] }).solution.branches, []);
});

test('independent sources in one network can deliver and absorb power with signed branch currents', () => {
  const result = solved(network(source('E1', 'a', 'n', 6), source('E2', 'b', 'n', 3), resistor('Rab', 'a', 'b', 10), resistor('Ran', 'a', 'n', 20)));
  close(branch(result, 'E1').currentA, -.6); close(branch(result, 'E2').currentA, .3);
  close(branch(result, 'E1').powerW, -3.6); close(branch(result, 'E2').powerW, .9);
});

test('negative supply is permitted by the independent netlist and reverses signed readings', () => {
  const result = solved(network(source('E', 'p', 'n', -3), resistor('R', 'p', 'n', 10)));
  close(branch(result, 'R').currentA, -.3); close(branch(result, 'E').currentA, .3);
});

test('duplicate ideal wires and wire loops do not change the electrical solution', () => {
  const result = solved(network(source(), resistor('R', 'q', 'n', 10), wire('w1', 'p', 'q'), wire('w2', 'q', 'p'), wire('w3', 'p', 'q')));
  close(branch(result, 'R').currentA, .3);
  assert.equal(result.diagnostics.filter(item => item.code === 'REDUNDANT_IDEAL_LINK').length, 2);
  assert.equal(branch(result, 'w2').currentA, null);
});

test('ideal source short has no finite solution, including arbitrarily small nonzero emf', () => {
  for (const voltage of [3, 1e-15, -3]) failed(network(source('E', 'p', 'n', voltage), wire('short', 'p', 'n')), 'IDEAL_SOURCE_SHORT');
});

test('equal parallel sources are redundant, unequal ones inconsistent; no fake finite current is emitted', () => {
  failed(network(source('E1'), source('E2'), resistor('R', 'p', 'n', 10)), 'REDUNDANT_IDEAL_SOURCE');
  failed(network(source('E1'), source('E2', 'p', 'n', 4)), 'INCONSISTENT_VOLTAGE_CONSTRAINT');
  failed(network(source('E1'), source('E2', 'n', 'p', -3)), 'REDUNDANT_IDEAL_SOURCE');
});

test('multi-edge ideal voltage loops are diagnosed before numerical elimination', () => {
  failed(network(source('E1', 'a', 'b', 2), source('E2', 'b', 'c', 3), source('E3', 'a', 'c', 5)), 'REDUNDANT_IDEAL_SOURCE');
  failed(network(source('E1', 'a', 'b', 2), source('E2', 'b', 'c', 3), source('E3', 'a', 'c', 6)), 'INCONSISTENT_VOLTAGE_CONSTRAINT');
});

test('zero-resistance current branch loops and an ideal ammeter across a supply are rejected', () => {
  failed(network(meter('A1', 'p', 'n'), meter('A2', 'p', 'n')), 'ZERO_RESISTANCE_LOOP');
  failed(network(source(), meter('A', 'p', 'n')), 'INCONSISTENT_VOLTAGE_CONSTRAINT');
  failed(network(source('E', 'p', 'n', 0), wire('w', 'p', 'n')), 'REDUNDANT_IDEAL_SOURCE');
});

test('every solve is fresh: a short after a valid network does not retain readings', () => {
  const input = network(source(), resistor('R', 'p', 'n', 10));
  const good = solved(input);
  input.branches.push(wire('short', 'p', 'n'));
  failed(input, 'IDEAL_SOURCE_SHORT');
  close(branch(good, 'R').currentA, .3);
});

test('ordering and arbitrary terminal identifiers do not change branch readings', () => {
  const input = network(source(), resistor('R1', 'p', 'm', 10), resistor('R2', 'm', 'n', 20));
  const expected = solved(input).solution.branches;
  const names = { p: 'z', m: 'x', n: 'y' };
  const renamed = { terminals: input.terminals.map(id => names[id]).reverse(), branches: input.branches.map(item => ({ ...item, from: names[item.from], to: names[item.to] })).reverse() };
  const actual = solved(renamed).solution.branches;
  actual.forEach((value, index) => { close(value.currentA, expected[index].currentA); close(value.voltageV, expected[index].voltageV); });
});

test('bad parameters, unknown fields, dangling/duplicate identifiers and non-finite values cannot be solved', () => {
  const good = network(source(), resistor('R', 'p', 'n', 10));
  for (const mutate of [input => { input.branches[1].resistanceOhm = 0; }, input => { input.branches[0].resistanceOhm = -1; },
    input => { input.branches[1].resistanceOhm = NaN; }, input => { input.branches[0].voltageV = Infinity; },
    input => { input.extra = true; }, input => { input.branches[1].kind = 'lamp'; }]) {
    const input = structuredClone(good); mutate(input); failed(input, 'INVALID_DC_NETLIST');
  }
  failed({ ...good, terminals: [...good.terminals, 'p'] }, 'DUPLICATE_TERMINAL');
  failed({ ...good, branches: [...good.branches, good.branches[0]] }, 'DUPLICATE_BRANCH_ID');
  failed({ ...good, terminals: ['p'] }, 'UNKNOWN_TERMINAL');
});

test('extreme finite overflow is diagnosed and ordinary small/large resistance scales remain accurate', () => {
  failed(network(source(), resistor('R', 'p', 'n', 1e-320)), 'NUMERIC_RANGE');
  failed(network(source('E', 'p', 'n', 1e308), resistor('R', 'p', 'n', 1e-10)), 'NUMERIC_RANGE');
  for (const resistance of [1e-12, 1e12]) close(branch(solved(network(source(), resistor('R', 'p', 'n', resistance))), 'R').currentA, 3 / resistance);
});

test('dense matrix size is bounded before allocation; many disconnected isolated nodes are harmless', () => {
  const branches = [source('E', 'node0', 'node257')];
  for (let index = 0; index < 257; index++) branches.push(resistor(`R${index}`, `node${index}`, `node${index + 1}`, 10));
  failed(network(...branches), 'NETWORK_TOO_LARGE');
  const sourceChain = Array.from({ length: 130 }, (_, i) => source(`E${i}`, `node${i}`, `node${i + 1}`, 1));
  failed(network(...sourceChain), 'NETWORK_TOO_LARGE');
  assert.equal(solved({ terminals: Array.from({ length: 300 }, (_, i) => `node${i}`), branches: [] }).solution.components.length, 300);
});
