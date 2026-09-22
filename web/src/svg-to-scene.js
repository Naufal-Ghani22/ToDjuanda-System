import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { MAP_SCALE, VISUAL_HEIGHT } from './config.js';

const DOOR_COLOUR = '#F58231';
const JUNCTION_COLOUR = '#FF3B30';
const STRUCTURE_HEIGHT = 0.9;

function normaliseColour(value) {
  if (!value || value === 'none') return null;
  try {
    return `#${new THREE.Color(value).getHexString().toUpperCase()}`;
  } catch {
    return null;
  }
}

function pathPoints(path, divisions = 12) {
  return path.subPaths.flatMap((subPath) => subPath.getPoints(divisions)
    .filter((point, index, points) => index === 0 || point.distanceTo(points[index - 1]) > 0.001));
}

function parentNames(element) {
  const names = [];
  let current = element;
  while (current && current.nodeName?.toLowerCase() !== 'svg') {
    names.push(current.getAttribute?.('id'), current.getAttribute?.('data-name'));
    current = current.parentElement;
  }
  return names.filter(Boolean);
}

function isRoutingGroup(element) {
  return parentNames(element).some((name) => /^node(?:_|$)/i.test(name));
}

function isRoutingStroke(style) {
  return normaliseColour(style.stroke) === JUNCTION_COLOUR && style.strokeOpacity !== 0;
}

function isRoutingFill(style, element) {
  return normaliseColour(style.fill) === JUNCTION_COLOUR && /^(line|vector)/i.test(element?.id ?? '');
}

export function visualHeightForLayer(layerName) {
  const names = layerName.toLowerCase().replace(/[ _]+/g, '-');
  if (/(tembok|dinding)-?pilar|\bpilar\b/.test(names)) return STRUCTURE_HEIGHT;
  if (/(tembok|dinding)-?kaca|\bkaca\b/.test(names)) return STRUCTURE_HEIGHT;
  return VISUAL_HEIGHT;
}

function structureHeight(element) {
  return visualHeightForLayer(parentNames(element).join(' '));
}

function makeMaterial(path, transparent = false) {
  const colour = path.color.clone().lerp(new THREE.Color('#FFFFFF'), 0.3);
  return new THREE.MeshStandardMaterial({
    color: colour,
    roughness: 0.95,
    transparent,
    opacity: transparent ? 0.52 : 1,
    depthWrite: !transparent,
  });
}

function rawToWorld(point, viewBox) {
  return new THREE.Vector3(
    (point.x - (viewBox[0] + viewBox[2] / 2)) * MAP_SCALE,
    0,
    (point.y - (viewBox[1] + viewBox[3] / 2)) * MAP_SCALE,
  );
}

function pathBounds(points) {
  const box = new THREE.Box2();
  box.setFromPoints(points);
  return box;
}

function createFlatGeometry(shapes, viewBox) {
  const geometry = new THREE.ShapeGeometry(shapes, 6);
  geometry.scale(MAP_SCALE, MAP_SCALE, MAP_SCALE);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(
    -(viewBox[0] + viewBox[2] / 2) * MAP_SCALE,
    0.005,
    -(viewBox[1] + viewBox[3] / 2) * MAP_SCALE,
  );
  return geometry;
}

function createExtrudedGeometry(shapes, height, viewBox) {
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: height / MAP_SCALE,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 6,
  });
  geometry.scale(MAP_SCALE, MAP_SCALE, MAP_SCALE);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(
    -(viewBox[0] + viewBox[2] / 2) * MAP_SCALE,
    height,
    -(viewBox[1] + viewBox[3] / 2) * MAP_SCALE,
  );
  return geometry;
}

function addLodMeshes(path, element, viewBox, groups) {
  const shapes = SVGLoader.createShapes(path);
  if (!shapes.length) return;
  const height = structureHeight(element);
  const names = parentNames(element).join(' ').toLowerCase();
  const transparent = /kaca/.test(names);
  groups.block.add(new THREE.Mesh(createFlatGeometry(shapes, viewBox), makeMaterial(path, transparent)));
  groups.mass.add(new THREE.Mesh(createExtrudedGeometry(shapes, Math.min(height, 0.12), viewBox), makeMaterial(path, transparent)));
  groups.detail.add(new THREE.Mesh(createExtrudedGeometry(shapes, height, viewBox), makeMaterial(path, transparent)));
}

function footprintAxis(element, points) {
  const rectWidth = Number(element?.getAttribute?.('width'));
  const rectHeight = Number(element?.getAttribute?.('height'));
  const transform = element?.getAttribute?.('transform') ?? '';
  const quarterTurn = /rotate\(\s*(?:90|-270)\b/i.test(transform);
  const baseIsX = Number.isFinite(rectWidth) && Number.isFinite(rectHeight)
    ? rectWidth >= rectHeight
    : pathBounds(points).getSize(new THREE.Vector2()).x >= pathBounds(points).getSize(new THREE.Vector2()).y;
  const alongX = quarterTurn ? !baseIsX : baseIsX;
  const size = pathBounds(points).getSize(new THREE.Vector2());
  return {
    axis: alongX ? { x: 1, z: 0 } : { x: 0, z: 1 },
    run: (alongX ? size.x : size.y) * MAP_SCALE,
    width: (alongX ? size.y : size.x) * MAP_SCALE,
  };
}

export function parseEscalatorId(rawId) {
  const match = /^Eskalator(\d+)(?:_(\d+))?$/i.exec(rawId ?? '');
  if (!match) return null;
  return { id: `Eskalator${match[1]}`, ambiguous: Boolean(match[2]) };
}

export function classifyNode(fill) {
  const colour = normaliseColour(fill);
  if (colour === DOOR_COLOUR) return 'door';
  if (colour === JUNCTION_COLOUR) return 'junction';
  return null;
}

export function parseFloorSvg(source, definition) {
  const data = new SVGLoader().parse(source);
  const viewBox = data.xml.getAttribute('viewBox').split(/[ ,]+/).map(Number);
  const group = new THREE.Group();
  group.name = definition.id;
  group.position.y = definition.elevation;
  const lodGroups = { block: new THREE.Group(), mass: new THREE.Group(), detail: new THREE.Group() };
  for (const lodGroup of Object.values(lodGroups)) group.add(lodGroup);
  const nodes = [];
  const edgePolylines = [];
  const escalators = [];
  const diagnostics = [];
  let generatedNode = 0;

  for (const path of data.paths) {
    const element = path.userData.node;
    const style = path.userData.style;
    const tag = element?.nodeName?.toLowerCase();
    const nodeType = classifyNode(style.fill);
    const points = pathPoints(path);
    const escalator = parseEscalatorId(element?.id);

    if ((tag === 'circle' || tag === 'ellipse') && nodeType && isRoutingGroup(element)) {
      const bounds = pathBounds(points);
      const size = bounds.getSize(new THREE.Vector2());
      const centre = rawToWorld(bounds.getCenter(new THREE.Vector2()), viewBox);
      nodes.push({
        id: `${definition.id}:${element.id || `node-${++generatedNode}`}`,
        floor: definition.id,
        type: nodeType,
        x: centre.x,
        z: centre.z,
        radius: Math.max(size.x, size.y) * MAP_SCALE / 2,
      });
      continue;
    }

    if (isRoutingStroke(style)) {
      for (const subPath of path.subPaths) {
        const polyline = subPath.getPoints(12).map((point) => rawToWorld(point, viewBox));
        if (polyline.length > 1) edgePolylines.push(polyline);
      }
      continue;
    }

    if (isRoutingFill(style, element) || isRoutingGroup(element)) continue;

    if (escalator) {
      const bounds = pathBounds(points);
      const centre = rawToWorld(bounds.getCenter(new THREE.Vector2()), viewBox);
      escalators.push({ ...escalator, centre: { x: centre.x, z: centre.z }, ...footprintAxis(element, points) });
    }

    if (style.fill !== 'none' && style.fillOpacity !== 0) addLodMeshes(path, element, viewBox, lodGroups);
  }

  if (!nodes.length) diagnostics.push(`${definition.label}: node group tidak ditemukan.`);
  if (!edgePolylines.length) diagnostics.push(`${definition.label}: edge merah tidak ditemukan.`);
  return { ...definition, data, group, lodGroups, nodes, edgePolylines, escalators, diagnostics, viewBox };
}

export async function loadFloor(definition) {
  const response = await fetch(`/${definition.asset}`);
  if (!response.ok) throw new Error(`SVG tidak ditemukan: ${definition.asset}`);
  return parseFloorSvg(await response.text(), definition);
}

export async function loadFloors(definitions) {
  return Promise.all(definitions.map(loadFloor));
}
