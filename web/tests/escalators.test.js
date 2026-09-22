import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConnectorRecords } from '../src/escalators.js';

test('uses a Ground Floor footprint for sloped connector endpoints', () => {
  const result = buildConnectorRecords(
    [{ id: 'Eskalator01', ambiguous: false, centre: { x: 0, z: 0 }, axis: { x: 1, z: 0 }, run: 4, width: 1 }],
    [{ id: 'Eskalator01', ambiguous: false, centre: { x: 0, z: 0 }, axis: { x: 1, z: 0 }, run: 4, width: 1 }],
    3.2,
  );

  assert.deepEqual(result.nodes, [
    { id: 'GF:Eskalator01:lower', floor: 'GF', type: 'connector', x: -2, z: 0 },
    { id: 'FF:Eskalator01:upper', floor: 'FF', type: 'connector', x: 2, z: 0 },
  ]);
  assert.equal(result.edges[0].cost, Math.hypot(4, 3.2));
});

test('does not create a connector for an ambiguous Figma duplicate', () => {
  const result = buildConnectorRecords(
    [{ id: 'Eskalator14', ambiguous: false, centre: { x: 0, z: 0 }, axis: { x: 1, z: 0 }, run: 4, width: 1 }],
    [
      { id: 'Eskalator14', ambiguous: false, centre: { x: 0, z: 0 }, axis: { x: 1, z: 0 }, run: 4, width: 1 },
      { id: 'Eskalator14', ambiguous: true, centre: { x: 0, z: 0 }, axis: { x: 1, z: 0 }, run: 4, width: 1 },
    ],
    3.2,
  );

  assert.deepEqual(result.edges, []);
  assert.match(result.diagnostics[0], /Eskalator14/);
});
