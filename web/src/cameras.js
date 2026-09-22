import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

function setOrthographicFrustum(camera, width, height, span) {
  const aspect = width / Math.max(height, 1);
  camera.left = -span * aspect;
  camera.right = span * aspect;
  camera.top = span;
  camera.bottom = -span;
  camera.updateProjectionMatrix();
}

export function createCameraControllers(canvas, bounds) {
  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  const span = Math.max(size.x, size.z) * 0.62;
  const map = new THREE.OrthographicCamera(-span, span, span, -span, 0.1, 1000);
  map.position.set(centre.x, 60, centre.z);
  map.lookAt(centre.x, 0, centre.z);
  map.zoom = 0.7;
  map.updateProjectionMatrix();
  const explore = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
  explore.position.set(centre.x + size.x * 0.38, Math.max(14, size.y * 3), centre.z + size.z * 0.72);
  const mapControls = new OrbitControls(map, canvas);
  mapControls.enableRotate = false;
  mapControls.enableDamping = true;
  mapControls.enablePan = true;
  mapControls.minZoom = 0.25;
  mapControls.maxZoom = 2.4;
  mapControls.target.set(centre.x, 0, centre.z);
  const exploreControls = new OrbitControls(explore, canvas);
  exploreControls.enableDamping = true;
  exploreControls.target.set(centre.x, 1.6, centre.z);
  exploreControls.minDistance = 4;
  exploreControls.maxDistance = Math.max(200, size.length() * 4);
  let mode = 'map';

  function activeCamera() {
    return mode === 'map' ? map : explore;
  }

  return {
    map,
    explore,
    get mode() {
      return mode;
    },
    get active() {
      return activeCamera();
    },
    setMode(nextMode) {
      mode = nextMode;
      mapControls.enabled = mode === 'map';
      exploreControls.enabled = mode === 'explore';
      return activeCamera();
    },
    resize(width, height) {
      setOrthographicFrustum(map, width, height, span);
      explore.aspect = width / Math.max(height, 1);
      explore.updateProjectionMatrix();
    },
    update() {
      if (mode === 'map') mapControls.update();
      else exploreControls.update();
    },
    reset() {
      mapControls.target.set(centre.x, 0, centre.z);
      map.position.set(centre.x, 60, centre.z);
      map.zoom = 0.7;
      map.updateProjectionMatrix();
      exploreControls.target.set(centre.x, 1.6, centre.z);
      explore.position.set(centre.x + size.x * 0.38, Math.max(14, size.y * 3), centre.z + size.z * 0.72);
      mapControls.update();
      exploreControls.update();
    },
  };
}
