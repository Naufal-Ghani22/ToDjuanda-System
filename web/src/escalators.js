import * as THREE from 'three';

const ROUTE_SURFACE = 0.15;

function groupById(footprints) {
  const groups = new Map();
  for (const footprint of footprints) {
    const current = groups.get(footprint.id) ?? [];
    current.push(footprint);
    groups.set(footprint.id, current);
  }
  return groups;
}

function isUniqueMatch(footprints) {
  return footprints?.length === 1 && !footprints[0].ambiguous;
}

export function buildConnectorRecords(gfEscalators, ffEscalators, floorHeight) {
  const gfById = groupById(gfEscalators);
  const ffById = groupById(ffEscalators);
  const nodes = [];
  const edges = [];
  const diagnostics = [];

  for (const [id, gfMatches] of gfById) {
    const ffMatches = ffById.get(id);
    if (!isUniqueMatch(gfMatches) || !isUniqueMatch(ffMatches)) {
      diagnostics.push(`${id}: pasangan eskalator lintas lantai tidak unik atau tidak tersedia.`);
      continue;
    }
    const footprint = gfMatches[0];
    const halfRun = footprint.run / 2;
    const lower = {
      id: `GF:${id}:lower`,
      floor: 'GF',
      type: 'connector',
      x: footprint.centre.x - footprint.axis.x * halfRun,
      z: footprint.centre.z - footprint.axis.z * halfRun,
    };
    const upper = {
      id: `FF:${id}:upper`,
      floor: 'FF',
      type: 'connector',
      x: footprint.centre.x + footprint.axis.x * halfRun,
      z: footprint.centre.z + footprint.axis.z * halfRun,
    };
    nodes.push(lower, upper);
    edges.push({
      id,
      from: lower.id,
      to: upper.id,
      cost: Math.hypot(footprint.run, floorHeight),
      connectorId: id,
    });
  }

  return { nodes, edges, diagnostics };
}

function makeRamp(footprint, floorHeight) {
  const lower = new THREE.Vector3(
    footprint.centre.x - footprint.axis.x * footprint.run / 2,
    ROUTE_SURFACE,
    footprint.centre.z - footprint.axis.z * footprint.run / 2,
  );
  const upper = new THREE.Vector3(
    footprint.centre.x + footprint.axis.x * footprint.run / 2,
    floorHeight + ROUTE_SURFACE,
    footprint.centre.z + footprint.axis.z * footprint.run / 2,
  );
  const direction = upper.clone().sub(lower);
  const length = direction.length();
  const group = new THREE.Group();
  group.name = footprint.id;
  const material = new THREE.MeshStandardMaterial({ color: '#37474F', roughness: 0.76 });
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(length, 0.12, footprint.width), material);
  ramp.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.normalize());
  ramp.position.copy(lower).lerp(upper, 0.5);
  group.add(ramp);

  const stepMaterial = new THREE.MeshStandardMaterial({ color: '#607D8B', roughness: 0.85 });
  for (let index = 1; index < 15; index += 1) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.055, footprint.width * 0.88), stepMaterial);
    step.quaternion.copy(ramp.quaternion);
    step.position.copy(lower).lerp(upper, index / 15);
    step.position.y += 0.07;
    group.add(step);
  }
  return group;
}

export function buildEscalatorConnectors(gfFloor, ffFloor, floorHeight) {
  const records = buildConnectorRecords(gfFloor.escalators, ffFloor.escalators, floorHeight);
  const group = new THREE.Group();
  group.name = 'Escalator connectors';
  const ffById = groupById(ffFloor.escalators);
  for (const footprint of gfFloor.escalators) {
    const matches = ffById.get(footprint.id);
    if (!isUniqueMatch([footprint]) || !isUniqueMatch(matches)) continue;
    group.add(makeRamp(footprint, floorHeight));
  }
  return { ...records, group };
}
