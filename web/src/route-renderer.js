import * as THREE from 'three';

const ROUTE_SURFACE = 0.24;

function makeCurve(points) {
  return points.length === 2
    ? new THREE.LineCurve3(points[0], points[1])
    : new THREE.CatmullRomCurve3(points, false, 'centripetal');
}

export function createRouteRenderer(scene, floorElevations) {
  const group = new THREE.Group();
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 16, 16),
    new THREE.MeshBasicMaterial({ color: '#007F68' }),
  );
  marker.visible = false;
  group.add(marker);
  scene.add(group);
  let activeCurve = null;
  let progress = 0;

  function clear() {
    for (const child of [...group.children]) {
      if (child === marker) continue;
      group.remove(child);
      child.geometry?.dispose();
      child.material?.dispose();
    }
    marker.visible = false;
    activeCurve = null;
  }

  function draw(nodeIds, nodeById) {
    if (nodeIds.length < 2) return;
    const points = nodeIds.map((id) => {
      const node = nodeById.get(id);
      return new THREE.Vector3(node.x, floorElevations[node.floor] + ROUTE_SURFACE, node.z);
    });
    activeCurve = makeCurve(points);
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(activeCurve, Math.max(12, points.length * 12), 0.055, 8, false),
      new THREE.MeshBasicMaterial({ color: '#007F68' }),
    );
    group.add(mesh);
    marker.visible = true;
    marker.position.copy(activeCurve.getPointAt(0));
    progress = 0;
  }

  return {
    clear,
    render(route, segments, nodes, mode, floorId) {
      clear();
      const nodeById = new Map(nodes.map((node) => [node.id, node]));
      if (mode === 'explore') draw(route.nodeIds, nodeById);
      else draw(segments.find((segment) => segment.floor === floorId)?.nodeIds ?? [], nodeById);
    },
    update(deltaSeconds) {
      if (!activeCurve) return;
      progress = (progress + deltaSeconds * 0.12) % 1;
      marker.position.copy(activeCurve.getPointAt(progress));
    },
  };
}
