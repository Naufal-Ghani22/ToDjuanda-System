import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { dijkstra, parseRoutingGraph } from './routing.js';

const host = document.querySelector('#map-scene');
const card = document.querySelector('#space-card');
const search = document.querySelector('#space-search');
const routeStart = document.querySelector('#route-start');
const routeDestination = document.querySelector('#route-destination');
const calculateRoute = document.querySelector('#calculate-route');
const clearRouteButton = document.querySelector('#clear-route');
const routeResult = document.querySelector('#route-result');
const routingStatus = document.querySelector('#routing-status');
const world = new THREE.Scene();
world.background = new THREE.Color('#e7ecee');
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000);
const blocks = new THREE.Group();
const routingLayer = new THREE.Group();
world.add(blocks);
world.add(routingLayer);
world.add(new THREE.HemisphereLight(0xffffff, 0x71808a, 2.4));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-45, 80, -25);
world.add(sun);
const zones = [];
const pickable = [];
const routePickable = [];
let renderer, controls, selected, selectionBox, routeGraph, routeLine, needsRender = true;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const spherical = new THREE.Spherical();
const MAP_SCALE = 0.01;
const VISUAL_HEIGHT = 0.5;
const FLOOR_HEIGHT = 0.12;
const ROUTING_SURFACE_HEIGHT = FLOOR_HEIGHT + 0.006;
const NODE_HEIGHT = 0.08;
const ROUTE_RADIUS = 0.06;

function resize() {
  const { width, height } = host.getBoundingClientRect();
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  needsRender = true;
}

function orbit(horizontal = 0, vertical = 0) {
  spherical.setFromVector3(camera.position.clone().sub(controls.target));
  spherical.theta += horizontal;
  spherical.phi = THREE.MathUtils.clamp(spherical.phi + vertical, controls.minPolarAngle, controls.maxPolarAngle);
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
  controls.update();
}

function zoom(factor) {
  const offset = camera.position.clone().sub(controls.target);
  offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
  camera.position.copy(controls.target).add(offset);
  controls.update();
}

function reset() {
  controls.target.set(4, 0, 0);
  camera.position.set(12, 58, 68);
  controls.update();
}

function fitMap() {
  const bounds = new THREE.Box3().setFromObject(blocks);
  const center = bounds.getCenter(new THREE.Vector3());
  const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
  const halfVertical = THREE.MathUtils.degToRad(camera.fov / 2);
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * camera.aspect);
  const distance = radius / Math.sin(Math.min(halfVertical, halfHorizontal)) * 1.05;
  controls.maxDistance = Math.max(650, distance * 1.1);
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(new THREE.Vector3(0, 1, 0.65).normalize(), distance);
  controls.update();
}

function toWorld(point, viewBox, height = ROUTING_SURFACE_HEIGHT) {
  return new THREE.Vector3(
    (point.x - (viewBox[0] + viewBox[2] / 2)) * MAP_SCALE,
    height,
    (point.y - (viewBox[1] + viewBox[3] / 2)) * MAP_SCALE,
  );
}

function addGround(viewBox) {
  const width = viewBox[2] * MAP_SCALE;
  const depth = viewBox[3] * MAP_SCALE;
  const geometry = new THREE.PlaneGeometry(width * 1.35, Math.max(depth * 3.5, 90));
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({ color: '#dfe5e7', roughness: 1 });
  const ground = new THREE.Mesh(geometry, material);
  ground.position.y = -0.015;
  ground.name = 'Ground';
  world.add(ground);
}

function populateRouteSelect(select, nodes) {
  select.replaceChildren(new Option('Pilih node', ''));
  for (const node of nodes) {
    const type = node.type === 'door' ? 'Pintu' : 'Persimpangan';
    select.add(new Option(`${node.id} · ${type}`, node.id));
  }
  select.disabled = nodes.length === 0;
}

function clearRoute() {
  if (routeLine) {
    routingLayer.remove(routeLine);
    routeLine.geometry.dispose();
    routeLine.material.dispose();
    routeLine = null;
  }
  routeResult.textContent = routeGraph?.connections.length
    ? 'Pilih titik awal dan tujuan, lalu hitung rute.'
    : 'Edge merah belum ditemukan pada SVG.';
  clearRouteButton.disabled = true;
  needsRender = true;
}

function drawShortestPath() {
  clearRoute();
  if (!routeStart.value || !routeDestination.value) {
    routeResult.textContent = 'Tentukan titik awal dan tujuan terlebih dahulu.';
    return;
  }
  if (routeStart.value === routeDestination.value) {
    routeResult.textContent = 'Titik awal dan tujuan harus berbeda.';
    return;
  }

  const result = dijkstra(routeGraph, routeStart.value, routeDestination.value);
  if (!result) {
    routeResult.textContent = 'Rute tidak ditemukan. Periksa apakah edge melewati pusat node dan seluruh graph tersambung.';
    return;
  }

  const nodeById = new Map(routeGraph.nodes.map((node) => [node.id, node]));
  const points = result.nodeIds.map((id) => toWorld(
    nodeById.get(id).point,
    routeGraph.viewBox,
    FLOOR_HEIGHT + ROUTE_RADIUS,
  ));
  const curve = points.length === 2
    ? new THREE.LineCurve3(points[0], points[1])
    : new THREE.CatmullRomCurve3(points, false, 'centripetal');
  routeLine = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(8, points.length * 5), ROUTE_RADIUS, 8, false),
    new THREE.MeshBasicMaterial({ color: '#007f68' }),
  );
  routeLine.name = 'Dijkstra result';
  routingLayer.add(routeLine);
  routeResult.textContent = `${result.nodeIds.length} node · ${result.distance.toFixed(1)} unit peta`;
  clearRouteButton.disabled = false;
  needsRender = true;
}

function chooseRouteNode(node) {
  if (!routeStart.value || routeDestination.value) {
    routeStart.value = node.id;
    routeDestination.value = '';
    routeResult.textContent = `${node.id} dipilih sebagai titik awal.`;
  } else {
    routeDestination.value = node.id;
    routeResult.textContent = `${node.id} dipilih sebagai tujuan.`;
    if (routeGraph.connections.length) drawShortestPath();
  }
}

function makeRoutingLayer(graph, viewBox) {
  graph.viewBox = viewBox;
  const edgeMaterial = new THREE.LineBasicMaterial({ color: '#ff3b30' });
  for (const polyline of graph.edgePolylines) {
    const geometry = new THREE.BufferGeometry().setFromPoints(polyline.map((point) => toWorld(point, viewBox)));
    routingLayer.add(new THREE.Line(geometry, edgeMaterial));
  }

  for (const node of graph.nodes) {
    const radius = THREE.MathUtils.clamp(node.radius * MAP_SCALE, 0.09, 0.22);
    const colour = node.type === 'door' ? '#f58231' : '#ff3b30';
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, NODE_HEIGHT, 24),
      new THREE.MeshBasicMaterial({ color: colour }),
    );
    mesh.position.copy(toWorld(node.point, viewBox, FLOOR_HEIGHT + NODE_HEIGHT / 2));
    mesh.userData.routeNode = node;
    mesh.name = node.id;
    routingLayer.add(mesh);
    routePickable.push(mesh);
  }

  populateRouteSelect(routeStart, graph.nodes);
  populateRouteSelect(routeDestination, graph.nodes);
  const doors = graph.nodes.filter((node) => node.type === 'door').length;
  const junctions = graph.nodes.length - doors;
  routingStatus.textContent = `${doors} pintu · ${junctions} simpang · ${graph.connections.length} edge`;
  calculateRoute.disabled = graph.connections.length === 0;
  routeResult.textContent = graph.connections.length
    ? 'Klik node oranye atau pilih node dari daftar.'
    : 'Node pintu terbaca. Tambahkan garis dan node merah untuk membentuk graph.';
  window.juaRouting = {
    graph,
    shortestPath: (startId, destinationId) => dijkstra(graph, startId, destinationId),
    solveGraph: dijkstra,
  };
}

function select(zone, focus = false) {
  selected = zone;
  if (selectionBox) {
    world.remove(selectionBox);
    selectionBox.geometry.dispose();
    selectionBox.material.dispose();
  }
  selectionBox = new THREE.BoxHelper(zone.group, 0x005e50);
  world.add(selectionBox);
  const detail = document.querySelector('#space-detail-template').content.cloneNode(true);
  detail.querySelector('h2').textContent = zone.label;
  detail.querySelector('.space-card__copy').textContent = 'Terminal 1 · Lantai dasar. Referensi zona sementara; informasi lokasi belum dihubungkan.';
  detail.querySelector('button').addEventListener('click', () => select(zone, true));
  card.replaceChildren(detail);
  if (focus) {
    const box = new THREE.Box3().setFromObject(zone.group);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const direction = camera.position.clone().sub(controls.target).normalize();
    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(direction, Math.max(16, size.length() * 2));
    controls.update();
  }
  needsRender = true;
}

function makeMap(source) {
  const data = new SVGLoader().parse(source);
  const viewBox = data.xml.getAttribute('viewBox').split(/[ ,]+/).map(Number);
  let serial = 0;
  for (const path of data.paths) {
    const style = path.userData.style;
    const element = path.userData.node;
    const tag = element?.nodeName?.toLowerCase();
    const fill = style.fill && style.fill !== 'none' ? new THREE.Color(style.fill).getHexString() : null;
    if ((tag === 'circle' || tag === 'ellipse') && ['ff9500', 'f58231', 'ff3b30', 'ff0000', 'ff5656'].includes(fill)) continue;
    if (style.fill === 'none' || style.fillOpacity === 0) continue;
    const shapes = SVGLoader.createShapes(path);
    if (!shapes.length) continue;
    const flat = new THREE.ShapeGeometry(shapes, 6);
    flat.computeBoundingBox();
    const size = flat.boundingBox.getSize(new THREE.Vector3());
    flat.dispose();
    const broadArea = size.x > viewBox[2] * 0.45;
    // Geometry dimensions use the SVG coordinate system, not measured metres.
    const height = broadArea ? FLOOR_HEIGHT : VISUAL_HEIGHT;
    const base = 0;
    const colour = path.color.clone();
    colour.lerp(new THREE.Color('#ffffff'), 0.30);
    if (broadArea && colour.r > colour.g * 1.15) colour.set('#dc9b99');
    const top = new THREE.MeshStandardMaterial({ color: colour, roughness: 1 });
    const side = new THREE.MeshStandardMaterial({ color: colour.clone().multiplyScalar(0.70), roughness: 1 });
    const geometry = new THREE.ExtrudeGeometry(shapes, { depth: height / MAP_SCALE, bevelEnabled: false, steps: 1, curveSegments: 6 });
    // Keep a positive determinant so face winding and lighting stay correct.
    // SVG Y maps to world Z; the bottom cap is raised by the extrusion height.
    geometry.scale(MAP_SCALE, MAP_SCALE, MAP_SCALE);
    geometry.rotateX(Math.PI / 2);
    geometry.translate(-(viewBox[0] + viewBox[2] / 2) * MAP_SCALE, base + height, -(viewBox[1] + viewBox[3] / 2) * MAP_SCALE);
    const mesh = new THREE.Mesh(geometry, [top, side]);
    const group = new THREE.Group();
    group.add(mesh);
    blocks.add(group);
    const label = path.userData.node.id || `Zona SVG ${String(++serial).padStart(3, '0')}`;
    const zone = { label, group, mesh };
    mesh.userData.zone = zone;
    zones.push(zone);
    pickable.push(mesh);
  }
  if (!zones.length) throw new Error('Tidak ada bentuk berisi pada SVG.');
  blocks.updateMatrixWorld(true);
  host.dataset.zoneCount = String(zones.length);
  host.dataset.renderer = 'WebGL / extruded geometry';
  return { data, viewBox };
}

async function start() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const surface = renderer.domElement;
    surface.tabIndex = 0;
    surface.setAttribute('aria-label', 'Peta 3D. Tombol panah untuk memutar; Shift dan panah untuk menggeser; plus minus untuk zoom; Home untuk reset.');
    controls = new OrbitControls(camera, surface);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.minPolarAngle = 0.015;
    controls.maxPolarAngle = Math.PI / 2 - 0.06;
    controls.minDistance = 6;
    controls.maxDistance = 650;
    controls.screenSpacePanning = true;
    controls.addEventListener('change', () => {
      if (controls.target.y !== 0) {
        camera.position.y -= controls.target.y;
        controls.target.y = 0;
      }
      camera.position.y = Math.max(camera.position.y, 0.35);
      needsRender = true;
      host.dataset.azimuth = controls.getAzimuthalAngle().toFixed(3);
      host.dataset.polar = controls.getPolarAngle().toFixed(3);
      host.dataset.distance = controls.getDistance().toFixed(2);
      document.querySelector('.orientation-arrow').style.transform = `rotate(${controls.getAzimuthalAngle()}rad)`;
    });
    const response = await fetch('./assets/T1-GF-Area.svg');
    if (!response.ok) throw new Error(`SVG: ${response.status}`);
    const parsed = makeMap(await response.text());
    addGround(parsed.viewBox);
    routeGraph = parseRoutingGraph(parsed.data, MAP_SCALE);
    makeRoutingLayer(routeGraph, parsed.viewBox);
    host.replaceChildren(surface);
    resize();
    reset();
    new ResizeObserver(resize).observe(host);
    let startPoint, multiTouch = false;
    surface.addEventListener('pointerdown', event => {
      if (!event.isPrimary) multiTouch = true;
      else { multiTouch = false; startPoint = { x: event.clientX, y: event.clientY, moved: false }; }
    });
    surface.addEventListener('pointermove', event => {
      if (startPoint && Math.hypot(event.clientX - startPoint.x, event.clientY - startPoint.y) > 5) startPoint.moved = true;
    });
    surface.addEventListener('pointercancel', () => { startPoint = null; });
    surface.addEventListener('pointerup', event => {
      if (!startPoint || startPoint.moved || multiTouch || event.button !== 0) return;
      startPoint = null;
      const rect = surface.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects([...routePickable, ...pickable], false)[0];
      if (hit?.object.userData.routeNode) chooseRouteNode(hit.object.userData.routeNode);
      else if (hit?.object.userData.zone) select(hit.object.userData.zone);
    });
    surface.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(event.key)) return;
      event.preventDefault();
      if (event.shiftKey && event.key.startsWith('Arrow')) {
        const delta = new THREE.Vector3();
        camera.updateMatrixWorld();
        delta.setFromMatrixColumn(camera.matrixWorld, ['ArrowLeft','ArrowRight'].includes(event.key) ? 0 : 1);
        delta.multiplyScalar((['ArrowLeft','ArrowDown'].includes(event.key) ? -1 : 1) * controls.getDistance() * 0.04);
        camera.position.add(delta); controls.target.add(delta); controls.update();
      } else if (event.key === 'ArrowLeft') orbit(-0.15);
      else if (event.key === 'ArrowRight') orbit(0.15);
      else if (event.key === 'ArrowUp') orbit(0,-0.12);
      else if (event.key === 'ArrowDown') orbit(0,0.12);
      else if (event.key === 'Home') reset();
      else zoom(event.key === '-' ? 1.2 : 1 / 1.2);
    });
    const actions = {
      'turn-left': () => orbit(-Math.PI / 8), 'turn-right': () => orbit(Math.PI / 8),
      'tilt-up': () => orbit(0,-0.15), 'tilt-down': () => orbit(0,0.15),
      'zoom-in': () => zoom(1 / 1.2), 'zoom-out': () => zoom(1.2),
      'reset-view': reset, 'top-view': () => orbit(0,-Math.PI),
      'fit-map': fitMap,
    };
    for (const [id, action] of Object.entries(actions)) document.getElementById(id).addEventListener('click', action);
    calculateRoute.addEventListener('click', drawShortestPath);
    clearRouteButton.addEventListener('click', clearRoute);
    search.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      const query = search.value.trim().toLowerCase();
      if (!query) return;
      const found = zones.find(zone => zone.label.toLowerCase() === query) || zones.find(zone => zone.label.toLowerCase().includes(query));
      if (found) select(found, true);
      else { card.textContent = 'Zona tidak ditemukan. Coba nomor zona lain.'; }
    });
    renderer.setAnimationLoop(() => {
      controls.update();
      if (needsRender) { renderer.render(world, camera); needsRender = false; }
    });
  } catch (error) {
    console.error(error);
    host.replaceChildren();
    const message = document.createElement('p');
    message.className = 'map-loading';
    message.textContent = 'Peta 3D gagal dimuat. Muat ulang halaman dan pastikan akselerasi grafis browser aktif.';
    host.append(message);
  }
}
start();
