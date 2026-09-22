import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph, dijkstra, segmentRoute } from '../src/routing.js';

test('segments a shortest path when it passes through an escalator', () => {
  const nodes = [
    { id: 'GF:A', floor: 'GF', x: 0, z: 0, type: 'door' },
    { id: 'GF:Eskalator01:lower', floor: 'GF', x: 2, z: 0, type: 'connector' },
    { id: 'FF:Eskalator01:upper', floor: 'FF', x: 5, z: 0, type: 'connector' },
    { id: 'FF:B', floor: 'FF', x: 7, z: 0, type: 'door' },
  ];
  const graph = buildGraph(nodes, [], [
    { id: 'GF-A', from: 'GF:A', to: 'GF:Eskalator01:lower', cost: 2 },
    { id: 'Eskalator01', from: 'GF:Eskalator01:lower', to: 'FF:Eskalator01:upper', cost: 4, connectorId: 'Eskalator01' },
    { id: 'FF-B', from: 'FF:Eskalator01:upper', to: 'FF:B', cost: 2 },
  ]);

  const route = dijkstra(graph, 'GF:A', 'FF:B');

  assert.deepEqual(route.nodeIds, ['GF:A', 'GF:Eskalator01:lower', 'FF:Eskalator01:upper', 'FF:B']);
  assert.equal(route.distance, 8);
  assert.deepEqual(segmentRoute(route, nodes), [
    { floor: 'GF', nodeIds: ['GF:A', 'GF:Eskalator01:lower'], connectorId: 'Eskalator01', nextFloor: 'FF' },
    { floor: 'FF', nodeIds: ['FF:Eskalator01:upper', 'FF:B'] },
  ]);
});

test('returns no route when a destination is disconnected', () => {
  const graph = buildGraph([
    { id: 'GF:A', floor: 'GF', x: 0, z: 0, type: 'door' },
    { id: 'GF:B', floor: 'GF', x: 2, z: 0, type: 'door' },
  ], [], []);

  assert.equal(dijkstra(graph, 'GF:A', 'GF:B'), null);
});
