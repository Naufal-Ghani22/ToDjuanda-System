import assert from 'node:assert/strict';
import test from 'node:test';

import { dijkstra } from '../routing.js';

function graph(adjacency) {
  return {
    nodes: [...adjacency.keys()].map((id) => ({ id })),
    adjacency,
  };
}

test('memilih jumlah bobot terpendek', () => {
  const sample = graph(new Map([
    ['A', new Map([['B', 2], ['C', 9]])],
    ['B', new Map([['A', 2], ['C', 3]])],
    ['C', new Map([['A', 9], ['B', 3]])],
  ]));

  assert.deepEqual(dijkstra(sample, 'A', 'C'), {
    nodeIds: ['A', 'B', 'C'],
    distance: 5,
  });
});

test('mengembalikan null saat tujuan tidak tersambung', () => {
  const sample = graph(new Map([
    ['A', new Map([['B', 2]])],
    ['B', new Map([['A', 2]])],
    ['C', new Map()],
  ]));

  assert.equal(dijkstra(sample, 'A', 'C'), null);
});
