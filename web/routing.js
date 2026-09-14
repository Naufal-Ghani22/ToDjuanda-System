import * as THREE from 'three';

const DOOR_COLOURS = new Set(['ff9500', 'f58231']);
const JUNCTION_COLOURS = new Set(['ff3b30', 'ff0000', 'ff5656']);
const EDGE_COLOURS = JUNCTION_COLOURS;

function colourHex(value) {
  if (!value || value === 'none') return null;
  try {
    return new THREE.Color(value).getHexString();
  } catch {
    return null;
  }
}

function pathPoints(path, divisions = 10) {
  return path.subPaths.flatMap((subPath) => {
    const points = subPath.getPoints(divisions);
    return points.filter((point, index) => index === 0 || point.distanceTo(points[index - 1]) > 0.001);
  });
}

function nearestPositionOnPolyline(point, points) {
  let distanceAlong = 0;
  let travelled = 0;
  let closestDistance = Infinity;

  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const segment = to.clone().sub(from);
    const lengthSquared = segment.lengthSq();
    if (!lengthSquared) continue;
    const amount = THREE.MathUtils.clamp(point.clone().sub(from).dot(segment) / lengthSquared, 0, 1);
    const projected = from.clone().addScaledVector(segment, amount);
    const distance = projected.distanceTo(point);
    if (distance < closestDistance) {
      closestDistance = distance;
      distanceAlong = travelled + Math.sqrt(lengthSquared) * amount;
    }
    travelled += Math.sqrt(lengthSquared);
  }

  return { distance: closestDistance, distanceAlong };
}

function connect(adjacency, from, to, weight) {
  if (from === to || weight <= 0) return;
  const current = adjacency.get(from).get(to);
  if (current === undefined || weight < current) {
    adjacency.get(from).set(to, weight);
    adjacency.get(to).set(from, weight);
  }
}

export function parseRoutingGraph(svgData, scale = 0.01) {
  const nodes = [];
  const edgePolylines = [];
  let generatedId = 0;

  for (const path of svgData.paths) {
    const element = path.userData.node;
    const tag = element?.nodeName?.toLowerCase();
    const fill = colourHex(path.userData.style.fill);
    const stroke = colourHex(path.userData.style.stroke);

    if ((tag === 'circle' || tag === 'ellipse') && (DOOR_COLOURS.has(fill) || JUNCTION_COLOURS.has(fill))) {
      const points = pathPoints(path, 20);
      const box = new THREE.Box2().setFromPoints(points);
      const size = box.getSize(new THREE.Vector2());
      nodes.push({
        id: element.id || `NODE-${String(++generatedId).padStart(3, '0')}`,
        type: DOOR_COLOURS.has(fill) ? 'door' : 'junction',
        point: box.getCenter(new THREE.Vector2()),
        radius: Math.max(size.x, size.y) / 2,
      });
      continue;
    }

    if (EDGE_COLOURS.has(stroke) && path.userData.style.strokeOpacity > 0) {
      for (const subPath of path.subPaths) {
        const points = subPath.getPoints(12);
        if (points.length >= 2) edgePolylines.push(points);
      }
    }
  }

  const adjacency = new Map(nodes.map((node) => [node.id, new Map()]));
  for (const points of edgePolylines) {
    const matches = nodes
      .map((node) => ({ node, ...nearestPositionOnPolyline(node.point, points) }))
      .filter(({ node, distance }) => distance <= Math.max(5, node.radius * 1.4))
      .sort((a, b) => a.distanceAlong - b.distanceAlong)
      .filter((match, index, list) => index === 0 || match.node.id !== list[index - 1].node.id);

    for (let index = 1; index < matches.length; index += 1) {
      connect(
        adjacency,
        matches[index - 1].node.id,
        matches[index].node.id,
        (matches[index].distanceAlong - matches[index - 1].distanceAlong) * scale,
      );
    }
  }

  const connections = [];
  const recorded = new Set();
  for (const [from, neighbours] of adjacency) {
    for (const [to, weight] of neighbours) {
      const key = [from, to].sort().join('|');
      if (!recorded.has(key)) {
        recorded.add(key);
        connections.push({ from, to, weight });
      }
    }
  }

  return { nodes, adjacency, connections, edgePolylines };
}

export function dijkstra(graph, startId, destinationId) {
  if (!graph.adjacency.has(startId) || !graph.adjacency.has(destinationId)) return null;
  const distances = new Map(graph.nodes.map((node) => [node.id, Infinity]));
  const previous = new Map();
  const remaining = new Set(distances.keys());
  distances.set(startId, 0);

  while (remaining.size) {
    let current = null;
    for (const id of remaining) {
      if (current === null || distances.get(id) < distances.get(current)) current = id;
    }
    if (current === null || distances.get(current) === Infinity) break;
    remaining.delete(current);
    if (current === destinationId) break;

    for (const [neighbour, weight] of graph.adjacency.get(current)) {
      if (!remaining.has(neighbour)) continue;
      const candidate = distances.get(current) + weight;
      if (candidate < distances.get(neighbour)) {
        distances.set(neighbour, candidate);
        previous.set(neighbour, current);
      }
    }
  }

  if (distances.get(destinationId) === Infinity) return null;
  const nodeIds = [];
  for (let current = destinationId; current; current = previous.get(current)) {
    nodeIds.unshift(current);
    if (current === startId) break;
  }
  return { nodeIds, distance: distances.get(destinationId) };
}
