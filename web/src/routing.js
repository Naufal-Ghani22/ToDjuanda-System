const NODE_EDGE_TOLERANCE = 0.16;

function distanceBetween(left, right) {
  return Math.hypot(right.x - left.x, right.z - left.z);
}

function nearestPositionOnPolyline(node, points) {
  let travelled = 0;
  let closestDistance = Infinity;
  let distanceAlong = 0;

  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dz);
    if (!length) continue;
    const amount = Math.max(0, Math.min(1, ((node.x - from.x) * dx + (node.z - from.z) * dz) / (length * length)));
    const projectedX = from.x + dx * amount;
    const projectedZ = from.z + dz * amount;
    const distance = Math.hypot(node.x - projectedX, node.z - projectedZ);
    if (distance < closestDistance) {
      closestDistance = distance;
      distanceAlong = travelled + length * amount;
    }
    travelled += length;
  }

  return { distance: closestDistance, distanceAlong };
}

function addEdge(adjacency, edges, edge) {
  if (edge.from === edge.to || edge.cost <= 0) return;
  const current = adjacency.get(edge.from).get(edge.to);
  if (!current || edge.cost < current.cost) {
    adjacency.get(edge.from).set(edge.to, edge);
    adjacency.get(edge.to).set(edge.from, edge);
    edges.set(edge.id, edge);
  }
}

function edgesFromPolyline(nodes, points, serial) {
  const matches = nodes
    .map((node) => ({ node, ...nearestPositionOnPolyline(node, points) }))
    .filter(({ distance }) => distance <= NODE_EDGE_TOLERANCE)
    .sort((left, right) => left.distanceAlong - right.distanceAlong);
  const edges = [];
  for (let index = 1; index < matches.length; index += 1) {
    const from = matches[index - 1];
    const to = matches[index];
    if (from.node.id === to.node.id) continue;
    edges.push({
      id: `svg-${serial}-${index}`,
      from: from.node.id,
      to: to.node.id,
      cost: to.distanceAlong - from.distanceAlong,
    });
  }
  return edges;
}

export function buildGraph(nodes, edgePolylines, extraEdges) {
  const adjacency = new Map(nodes.map((node) => [node.id, new Map()]));
  const edges = new Map();
  for (const [serial, points] of edgePolylines.entries()) {
    for (const edge of edgesFromPolyline(nodes, points, serial)) addEdge(adjacency, edges, edge);
  }
  for (const edge of extraEdges) addEdge(adjacency, edges, edge);
  return { nodes, adjacency, edges };
}

export function dijkstra(graph, startId, destinationId) {
  if (!graph.adjacency.has(startId) || !graph.adjacency.has(destinationId)) return null;
  const distances = new Map(graph.nodes.map((node) => [node.id, Infinity]));
  const previous = new Map();
  const unvisited = new Set(distances.keys());
  distances.set(startId, 0);

  while (unvisited.size) {
    let current = null;
    for (const candidate of unvisited) {
      if (current === null || distances.get(candidate) < distances.get(current)) current = candidate;
    }
    if (current === null || distances.get(current) === Infinity) break;
    unvisited.delete(current);
    if (current === destinationId) break;

    for (const [neighbour, edge] of graph.adjacency.get(current)) {
      if (!unvisited.has(neighbour)) continue;
      const candidate = distances.get(current) + edge.cost;
      if (candidate < distances.get(neighbour)) {
        distances.set(neighbour, candidate);
        previous.set(neighbour, { id: current, edgeId: edge.id });
      }
    }
  }

  if (distances.get(destinationId) === Infinity) return null;
  const nodeIds = [destinationId];
  const edgeIds = [];
  for (let current = destinationId; current !== startId;) {
    const step = previous.get(current);
    if (!step) return null;
    nodeIds.unshift(step.id);
    edgeIds.unshift(step.edgeId);
    current = step.id;
  }
  return {
    nodeIds,
    edgeIds,
    edges: edgeIds.map((id) => graph.edges.get(id)),
    distance: distances.get(destinationId),
  };
}

export function segmentRoute(route, nodes, graph) {
  if (!route) return [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const segments = [];
  let current = {
    floor: nodeById.get(route.nodeIds[0]).floor,
    nodeIds: [route.nodeIds[0]],
  };

  for (let index = 1; index < route.nodeIds.length; index += 1) {
    const nextId = route.nodeIds[index];
    const nextNode = nodeById.get(nextId);
    const edge = route.edges?.[index - 1] ?? graph?.edges.get(route.edgeIds[index - 1]);
    if (nextNode.floor === current.floor) {
      current.nodeIds.push(nextId);
      continue;
    }
    current.connectorId = edge?.connectorId;
    current.nextFloor = nextNode.floor;
    segments.push(current);
    current = { floor: nextNode.floor, nodeIds: [nextId] };
  }
  segments.push(current);
  return segments;
}

export function distanceForNodes(left, right) {
  return distanceBetween(left, right);
}
