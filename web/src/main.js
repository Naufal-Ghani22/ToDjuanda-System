import * as THREE from 'three';
import './styles.css';
import { FLOOR_HEIGHT, FLOORS } from './config.js';
import { createCameraControllers } from './cameras.js';
import { buildEscalatorConnectors } from './escalators.js';
import { createFloorStack } from './floor-stack.js';
import { createNodePicker } from './interaction.js';
import { resolveLod } from './lod.js';
import { createRouteRenderer } from './route-renderer.js';
import { buildGraph, dijkstra, segmentRoute } from './routing.js';
import { loadFloors } from './svg-to-scene.js';
import { createUi } from './ui.js';

const host = document.querySelector('#map');
const ui = createUi(document);

function addGround(scene, bounds) {
  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(size.x * 1.5, Math.max(size.z * 1.5, 70)),
    new THREE.MeshStandardMaterial({ color: '#DCE4E3', roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(centre.x, -0.02, centre.z);
  scene.add(ground);
}

function routeMessage(node) {
  return node.type === 'door' ? node.id : `${node.id} · persimpangan`;
}

export async function boot() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#E6ECEB');
  scene.add(new THREE.HemisphereLight('#FFFFFF', '#8A9B9A', 2.4));
  const sun = new THREE.DirectionalLight('#FFFFFF', 2.1);
  sun.position.set(-35, 60, -22);
  scene.add(sun);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.replaceChildren(renderer.domElement);

  try {
    const floors = await loadFloors(FLOORS);
    for (const floor of floors) scene.add(floor.group);
    const mapBounds = new THREE.Box3().setFromObject(scene);
    addGround(scene, mapBounds);
    const floorElevations = Object.fromEntries(floors.map((floor) => [floor.id, floor.elevation]));
    const stack = createFloorStack(floors);
    const connectors = buildEscalatorConnectors(floors[0], floors[1], FLOOR_HEIGHT);
    scene.add(connectors.group);
    const nodes = [...floors.flatMap((floor) => floor.nodes), ...connectors.nodes];
    const graph = buildGraph(nodes, floors.flatMap((floor) => floor.edgePolylines), connectors.edges);
    const cameras = createCameraControllers(renderer.domElement, new THREE.Box3().setFromObject(scene));
    const routeRenderer = createRouteRenderer(scene, floorElevations);
    const picker = createNodePicker(renderer.domElement, () => cameras.active, nodes, floorElevations, selectRouteNode);
    scene.add(picker.group);
    let route = null;
    let segments = [];
    let start = null;
    let destination = null;
    const clock = new THREE.Clock();

    function renderRoute() {
      routeRenderer.clear();
      if (!route) {
        ui.setContinuation(null, cameras.mode);
        return;
      }
      routeRenderer.render(route, segments, nodes, cameras.mode, stack.selectedFloor);
      ui.setContinuation(segments.find((segment) => segment.floor === stack.selectedFloor), cameras.mode);
    }

    function selectFloor(floorId) {
      cameras.setMode('map');
      stack.showOnly(floorId);
      ui.setFloor(floorId);
      ui.setMode('map');
      picker.showFloor(floorId, 'map');
      renderRoute();
    }

    function selectMode(mode) {
      cameras.setMode(mode);
      ui.setMode(mode);
      if (mode === 'explore') stack.showAll();
      else stack.showOnly(stack.selectedFloor);
      picker.showFloor(stack.selectedFloor, mode);
      renderRoute();
    }

    function clearRoute() {
      start = null;
      destination = null;
      route = null;
      segments = [];
      routeRenderer.clear();
      ui.setContinuation(null, cameras.mode);
      ui.setRouteStatus('Klik node pertama sebagai asal, lalu node kedua sebagai tujuan.');
    }

    function selectRouteNode(node) {
      if (!start || destination) {
        clearRoute();
        start = node;
        ui.setRouteStatus(`${routeMessage(node)} dipilih sebagai titik awal.`);
        return;
      }
      destination = node;
      route = dijkstra(graph, start.id, destination.id);
      if (!route) {
        ui.setRouteStatus('Rute belum terhubung. Periksa edge atau pasangan eskalator pada SVG.');
        return;
      }
      segments = segmentRoute(route, nodes, graph);
      ui.setRouteStatus(`${route.nodeIds.length} node · panjang rute ${route.distance.toFixed(1)} unit peta.`);
      renderRoute();
    }

    function resize() {
      const { width, height } = host.getBoundingClientRect();
      renderer.setSize(width, height, false);
      cameras.resize(width, height);
    }

    ui.bind({
      onFloor: selectFloor,
      onMode: selectMode,
      onReset: () => cameras.reset(),
      onClear: clearRoute,
      onContinue: () => {
        const segment = segments.find((item) => item.floor === stack.selectedFloor);
        if (segment?.nextFloor) selectFloor(segment.nextFloor);
      },
    });

    stack.applyLod(resolveLod(cameras.map.zoom));
    selectFloor('GF');
    resize();
    new ResizeObserver(resize).observe(host);
    const diagnostics = [...floors.flatMap((floor) => floor.diagnostics), ...connectors.diagnostics];
    ui.setStatus(`${floors.map((floor) => `${floor.label}: ${floor.nodes.length} node`).join(' · ')} · ${graph.edges.size} edge`);
    if (diagnostics.length) ui.setRouteStatus(`${uiText(diagnostics[0])} ${diagnostics.length > 1 ? `+${diagnostics.length - 1} diagnostik lain.` : ''}`);
    window.juaWayfinding = { floors, graph, connectors, dijkstra: (from, to) => dijkstra(graph, from, to) };

    renderer.setAnimationLoop(() => {
      cameras.update();
      if (cameras.mode === 'map') stack.applyLod(resolveLod(cameras.map.zoom));
      routeRenderer.update(clock.getDelta());
      renderer.render(scene, cameras.active);
    });
  } catch (error) {
    console.error(error);
    host.replaceChildren();
    const message = document.createElement('p');
    message.textContent = error.message || 'Peta dua lantai gagal dimuat.';
    host.append(message);
    ui.setStatus('Peta gagal dimuat.');
  }
}

function uiText(message) {
  return message.replace(/^GF:/, 'Ground Floor:').replace(/^FF:/, 'First Floor:');
}

boot();
