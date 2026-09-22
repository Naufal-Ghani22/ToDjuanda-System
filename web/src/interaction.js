import * as THREE from 'three';

const COLOURS = { door: '#F58231', junction: '#FF3B30', connector: '#0E7490' };

export function createNodePicker(canvas, getCamera, nodes, floorElevations, onPick) {
  const group = new THREE.Group();
  group.name = 'Routing nodes';
  const meshes = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  for (const node of nodes) {
    const radius = Math.max(0.075, Math.min(0.18, node.radius ?? 0.12));
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.07, 18),
      new THREE.MeshBasicMaterial({ color: COLOURS[node.type] }),
    );
    mesh.position.set(node.x, floorElevations[node.floor] + 0.19, node.z);
    mesh.userData.routeNode = node;
    group.add(mesh);
    meshes.push(mesh);
  }

  let startPoint;
  canvas.addEventListener('pointerdown', (event) => {
    startPoint = { x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!startPoint || Math.hypot(event.clientX - startPoint.x, event.clientY - startPoint.y) > 5) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, getCamera());
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (hit) onPick(hit.object.userData.routeNode);
  });

  return {
    group,
    showFloor(floorId, mode) {
      for (const mesh of meshes) mesh.visible = mode === 'explore' || mesh.userData.routeNode.floor === floorId;
    },
  };
}
