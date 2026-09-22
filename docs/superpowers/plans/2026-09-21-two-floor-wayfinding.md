# Two-Floor Juanda Wayfinding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Vite + vanilla Three.js application that renders two stacked airport floors, finds routes from SVG routing marks, and connects matching escalators with physical slopes.

**Architecture:** `svg-to-scene.js` owns SVG ingestion and creates three LOD scene groups plus visual-independent records for nodes, routing polylines, and escalator footprints. `routing.js` builds a floor-aware graph and Dijkstra path, while `escalators.js` adds nodes and weighted sloped connector edges from Ground Floor geometry. Camera, LOD, interaction, route rendering, and UI consume those records without parsing SVG themselves.

**Tech Stack:** Vite, vanilla ES modules, Three.js 0.180.0, Three.js SVGLoader and OrbitControls, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-21-two-floor-wayfinding-design.md`

## Global Constraints

- Run entirely client-side; no Node application backend is introduced.
- Use the existing SVG files `web/assets/T1-GF-Area.svg` and `web/assets/T1-FF-Area.svg` without editing their geometry.
- Ground Floor is the escalator geometry source of truth; First Floor only validates a matching unique connector ID.
- Generic visual building height is `0.5`; named wall/pillar rules remain compatible with the existing map.
- First Floor elevation is `FLOOR_HEIGHT = 3.2` world units above Ground Floor.
- `EskalatorNN_2` is ambiguous, never silently paired with `EskalatorNN`.
- Map mode uses an `OrthographicCamera` without rotation. Exploration mode uses a `PerspectiveCamera` with orbit controls.
- Routing data must remain independent of the visual meshes.

---

## File Structure

```text
web/
  index.html                         Vite page shell and controls
  package.json                       Vite dev/build/test commands
  vite.config.js                     development server settings
  assets/
    T1-GF-Area.svg                   existing Ground Floor input
    T1-FF-Area.svg                   existing First Floor input
  src/
    main.js                          composition and render loop
    config.js                        map constants and floor definitions
    models.js                        shared JSDoc record shapes
    svg-to-scene.js                  SVG parsing, LOD mesh building, graph marks
    escalators.js                    paired connector diagnostics and slope meshes
    routing.js                       graph building, Dijkstra, route segmentation
    cameras.js                       map/exploration camera controllers
    lod.js                           orthographic zoom LOD selection
    floor-stack.js                   floor scene visibility and isolation
    route-renderer.js                route curves and animated marker
    interaction.js                   node raycast selection
    ui.js                            DOM state and control bindings
    styles.css                       application-specific visual treatment
  tests/
    routing.test.js                  graph, Dijkstra, segmentation tests
    escalators.test.js               pairing and ramp endpoint tests
    lod.test.js                      zoom level threshold tests
```

The current `map3d.js`, `routing.js`, and `server.js` stay in place during this migration but are not imported by the Vite entry point. Remove them only after Vite parity is verified.

### Task 1: Establish the Vite entry point and shared models

**Files:**
- Modify: `web/package.json`
- Create: `web/vite.config.js`
- Modify: `web/index.html`
- Create: `web/src/config.js`
- Create: `web/src/models.js`
- Create: `web/src/main.js`
- Create: `web/src/styles.css`
- Test: `web/tests/config.test.js`

**Interfaces:**
- Produces `FLOORS`, `FLOOR_HEIGHT`, `MAP_SCALE`, `LOD_ZOOM`, and `VISUAL_HEIGHT` from `src/config.js`.
- Produces `boot()` from `src/main.js`; later tasks extend it without changing its exported name.

- [ ] **Step 1: Write the failing configuration test**

```js
import { describe, expect, it } from 'vitest';
import { FLOOR_HEIGHT, FLOORS, LOD_ZOOM, VISUAL_HEIGHT } from '../src/config.js';

describe('two-floor configuration', () => {
  it('defines stacked GF and FF floors', () => {
    expect(FLOOR_HEIGHT).toBe(3.2);
    expect(VISUAL_HEIGHT).toBe(0.5);
    expect(FLOORS).toEqual([
      expect.objectContaining({ id: 'GF', elevation: 0, asset: 'T1-GF-Area.svg' }),
      expect.objectContaining({ id: 'FF', elevation: 3.2, asset: 'T1-FF-Area.svg' }),
    ]);
    expect(LOD_ZOOM).toEqual({ block: 0.45, mass: 0.95, detail: 0.96 });
  });
});
```

- [ ] **Step 2: Run the configuration test to verify it fails**

Run: `npm test --prefix web -- config.test.js`

Expected: FAIL because Vite, Vitest, and `src/config.js` do not yet exist.

- [ ] **Step 3: Add Vite and Vitest scripts and dependencies**

Set `package.json` scripts to:

```json
{
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run"
}
```

Keep `three` at `0.180.0`; add `vite` and `vitest` as development dependencies. Create `vite.config.js` with `server.host` set to `127.0.0.1` and `server.port` set to `4173`.

- [ ] **Step 4: Add the floor configuration and empty boot entry point**

Implement this exported configuration shape:

```js
export const MAP_SCALE = 0.01;
export const VISUAL_HEIGHT = 0.5;
export const FLOOR_HEIGHT = 3.2;
export const LOD_ZOOM = { block: 0.45, mass: 0.95, detail: 0.96 };
export const FLOORS = [
  { id: 'GF', label: 'Ground Floor', elevation: 0, asset: 'T1-GF-Area.svg' },
  { id: 'FF', label: 'First Floor', elevation: FLOOR_HEIGHT, asset: 'T1-FF-Area.svg' },
];
```

Give `index.html` only an application root and load `src/main.js` with `type="module"`. In `main.js`, export `boot()` and create a visible loading message before later tasks add WebGL. Define JSDoc typedefs for `RouteNode`, `RouteEdge`, `EscalatorFootprint`, `FloorData`, and `RouteSolution` in `models.js`.

- [ ] **Step 5: Run tests and a production build**

Run: `npm install --prefix web && npm test --prefix web && npm run build --prefix web`

Expected: configuration test passes and Vite creates `web/dist`.

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/package-lock.json web/vite.config.js web/index.html web/src web/tests/config.test.js
git commit -m "chore: initialize two-floor vite map"
```

### Task 2: Parse SVG assets into floor records and LOD mesh groups

**Files:**
- Create: `web/src/svg-to-scene.js`
- Create: `web/tests/svg-to-scene.test.js`
- Modify: `web/src/main.js`

**Interfaces:**
- Consumes: `FLOORS`, `MAP_SCALE`, `VISUAL_HEIGHT`.
- Produces `loadFloor(definition): Promise<FloorData>` and `loadFloors(definitions): Promise<FloorData[]>`.
- `FloorData` includes `{ id, elevation, group, lodGroups, nodes, edgePolylines, escalators, diagnostics, viewBox }`.

- [ ] **Step 1: Write failing SVG extraction tests using fixture strings**

```js
import { describe, expect, it } from 'vitest';
import { parseEscalatorId, classifyNode } from '../src/svg-to-scene.js';

describe('SVG marks', () => {
  it('keeps an exact escalator ID and marks Figma duplicate suffixes ambiguous', () => {
    expect(parseEscalatorId('Eskalator14')).toEqual({ id: 'Eskalator14', ambiguous: false });
    expect(parseEscalatorId('Eskalator14_2')).toEqual({ id: 'Eskalator14', ambiguous: true });
  });

  it('classifies orange and red routing circles', () => {
    expect(classifyNode('#F58231')).toBe('door');
    expect(classifyNode('#FF3B30')).toBe('junction');
  });
});
```

- [ ] **Step 2: Run the SVG extraction test to verify it fails**

Run: `npm test --prefix web -- svg-to-scene.test.js`

Expected: FAIL because `svg-to-scene.js` is absent.

- [ ] **Step 3: Implement SVG extraction**

Use `SVGLoader` to parse a fetched SVG. Inspect each loaded path's source node and its parent chain. Extract:

```js
export function parseEscalatorId(rawId) {
  const match = /^Eskalator(\d+)(?:_(\d+))?$/i.exec(rawId ?? '');
  return match ? { id: `Eskalator${match[1]}`, ambiguous: Boolean(match[2]) } : null;
}

export function classifyNode(fill) {
  const colour = fill?.toUpperCase();
  if (colour === '#F58231') return 'door';
  if (colour === '#FF3B30') return 'junction';
  return null;
}
```

For ordinary filled paths, create three mesh representations: flat `ShapeGeometry` for block LOD, 0.12-unit extrusions for mass LOD, and full extrusions for detail LOD. Exclude any source node inside a `node` group and every red routing line/path from building geometry. Place all representations under a floor group at `definition.elevation`.

Convert SVG point `(x, y)` to world `{ x, z }` using `MAP_SCALE` and the SVG viewBox centre. Extract red-stroke line/path points as `edgePolylines`; extract orange/red circles or ellipses within node groups as `RouteNode` records namespaced with `definition.id`.

- [ ] **Step 4: Make `main.js` load both files and surface diagnostics**

Call `loadFloors(FLOORS)` from `boot()`. If one fetch fails, render the exact message `SVG tidak ditemukan: <floor asset>`. If routing marks are missing, append a diagnostic string without preventing mesh rendering.

- [ ] **Step 5: Run extraction tests and inspect the real files**

Run: `npm test --prefix web && npm run dev --prefix web`

Expected: tests pass; browser diagnostics identify the existing FF duplicate IDs `Eskalator14_2` and `Eskalator16_2` without treating them as connector pairs.

- [ ] **Step 6: Commit**

```bash
git add web/src/svg-to-scene.js web/src/main.js web/tests/svg-to-scene.test.js
git commit -m "feat: load two floor SVG scenes"
```

### Task 3: Build floor-aware graph records and Dijkstra route segmentation

**Files:**
- Create: `web/src/routing.js`
- Create: `web/tests/routing.test.js`

**Interfaces:**
- Consumes: `RouteNode[]`, SVG `edgePolylines`, and escalator `RouteEdge[]`.
- Produces `buildGraph(nodes, edgePolylines, extraEdges)`, `dijkstra(graph, startId, destinationId)`, and `segmentRoute(solution, nodes)`.

- [ ] **Step 1: Write failing graph and floor-segmentation tests**

```js
import { describe, expect, it } from 'vitest';
import { buildGraph, dijkstra, segmentRoute } from '../src/routing.js';

const nodes = [
  { id: 'GF:A', floor: 'GF', x: 0, z: 0, type: 'door' },
  { id: 'GF:Eskalator01:lower', floor: 'GF', x: 2, z: 0, type: 'connector' },
  { id: 'FF:Eskalator01:upper', floor: 'FF', x: 5, z: 0, type: 'connector' },
  { id: 'FF:B', floor: 'FF', x: 7, z: 0, type: 'door' },
];

it('segments a solved route at an escalator', () => {
  const graph = buildGraph(nodes, [], [
    { id: 'GF:A--GF:Eskalator01:lower', from: 'GF:A', to: 'GF:Eskalator01:lower', cost: 2 },
    { id: 'Eskalator01', from: 'GF:Eskalator01:lower', to: 'FF:Eskalator01:upper', cost: 4, connectorId: 'Eskalator01' },
    { id: 'FF:Eskalator01:upper--FF:B', from: 'FF:Eskalator01:upper', to: 'FF:B', cost: 2 },
  ]);
  const solution = dijkstra(graph, 'GF:A', 'FF:B');
  expect(segmentRoute(solution, nodes)).toEqual([
    expect.objectContaining({ floor: 'GF', connectorId: 'Eskalator01', nextFloor: 'FF' }),
    expect.objectContaining({ floor: 'FF' }),
  ]);
});
```

- [ ] **Step 2: Run the routing test to verify it fails**

Run: `npm test --prefix web -- routing.test.js`

Expected: FAIL because the Vite routing module is absent.

- [ ] **Step 3: Implement graph construction and Dijkstra**

Represent each graph edge as `{ id, from, to, cost, connectorId?: string, oneWay?: boolean }`. For each red polyline, find all nodes that lie within `NODE_EDGE_TOLERANCE = 0.16` world units, sort them along the line distance, and connect adjacent nodes by Euclidean horizontal distance. Add supplied connector edges unchanged. Use a binary-free Dijkstra implementation with a distance map and predecessor map; return `{ nodeIds, edgeIds, distance }` or `null`.

`segmentRoute()` returns ordered records shaped as:

```js
{ floor: 'GF', nodeIds: ['GF:A', 'GF:Eskalator01:lower'], connectorId: 'Eskalator01', nextFloor: 'FF' }
```

The last segment omits `connectorId` and `nextFloor`.

- [ ] **Step 4: Run routing tests**

Run: `npm test --prefix web -- routing.test.js`

Expected: test passes and a disconnected destination returns `null` in a second test.

- [ ] **Step 5: Commit**

```bash
git add web/src/routing.js web/tests/routing.test.js
git commit -m "feat: add floor-aware dijkstra graph"
```

### Task 4: Pair unique escalators and render physical slopes

**Files:**
- Create: `web/src/escalators.js`
- Create: `web/tests/escalators.test.js`
- Modify: `web/src/main.js`

**Interfaces:**
- Consumes: Ground Floor and First Floor `FloorData`.
- Produces `buildEscalatorConnectors(gfFloor, ffFloor): { group, nodes, edges, diagnostics }`.

- [ ] **Step 1: Write failing connector pairing tests**

```js
import { describe, expect, it } from 'vitest';
import { buildConnectorRecords } from '../src/escalators.js';

it('uses a GF footprint to create a true sloped connector', () => {
  const gf = [{ id: 'Eskalator01', ambiguous: false, centre: { x: 0, z: 0 }, axis: { x: 1, z: 0 }, run: 4, width: 1 }];
  const ff = [{ id: 'Eskalator01', ambiguous: false, centre: { x: 0, z: 0 }, axis: { x: 1, z: 0 }, run: 4, width: 1 }];
  const result = buildConnectorRecords(gf, ff, 3.2);
  expect(result.nodes).toEqual([
    expect.objectContaining({ id: 'GF:Eskalator01:lower', floor: 'GF', x: -2, z: 0 }),
    expect.objectContaining({ id: 'FF:Eskalator01:upper', floor: 'FF', x: 2, z: 0 }),
  ]);
  expect(result.edges[0].cost).toBeCloseTo(Math.hypot(4, 3.2));
});

it('rejects a duplicate Figma suffix instead of joining floors', () => {
  const result = buildConnectorRecords(
    [{ id: 'Eskalator14', ambiguous: false }],
    [{ id: 'Eskalator14', ambiguous: false }, { id: 'Eskalator14', ambiguous: true }],
    3.2,
  );
  expect(result.edges).toEqual([]);
  expect(result.diagnostics[0]).toContain('Eskalator14');
});
```

- [ ] **Step 2: Run the connector tests to verify they fail**

Run: `npm test --prefix web -- escalators.test.js`

Expected: FAIL because `escalators.js` is absent.

- [ ] **Step 3: Implement pairing and connector graph records**

Use Ground Floor `centre`, `axis`, `run`, and `width` only. A unique exact ID present once on both floors becomes two nodes:

```js
const lower = { id: `GF:${id}:lower`, floor: 'GF', x: centre.x - axis.x * run / 2, z: centre.z - axis.z * run / 2, type: 'connector' };
const upper = { id: `FF:${id}:upper`, floor: 'FF', x: centre.x + axis.x * run / 2, z: centre.z + axis.z * run / 2, type: 'connector' };
```

Create a bidirectional edge with `cost: Math.hypot(run, floorHeight)`. Record all absent, duplicate, or ambiguous IDs in diagnostics and return no edge for them.

- [ ] **Step 4: Implement the slope mesh from the same endpoints**

Create a `THREE.BoxGeometry(run, 0.12, width)`, rotate it around its local Z axis by `Math.atan2(floorHeight, run)`, rotate around Y using the extracted SVG long axis, and centre it midway between lower and upper points at `y = floorHeight / 2`. Add thin repeated step bars only in detail LOD. The mesh is visual only; all routing uses the records created in the previous step.

- [ ] **Step 5: Wire connectors into the loaded application**

After `loadFloors()`, call `buildEscalatorConnectors()`, add its group to the Three.js scene, append its nodes and edges to `buildGraph()`, and show diagnostics in the status area. Confirm current SVG data does not create a connector for `Eskalator14_2` or `Eskalator16_2`.

- [ ] **Step 6: Run tests and inspect a perspective view**

Run: `npm test --prefix web && npm run dev --prefix web`

Expected: all unit tests pass. A future unique exact GF/FF pair appears as a sloped mesh from Ground Floor to First Floor; unmatched connectors appear only as SVG visuals.

- [ ] **Step 7: Commit**

```bash
git add web/src/escalators.js web/src/main.js web/tests/escalators.test.js
git commit -m "feat: add sloped escalator connectors"
```

### Task 5: Add camera modes, floor isolation, and orthographic zoom LOD

**Files:**
- Create: `web/src/cameras.js`
- Create: `web/src/lod.js`
- Create: `web/src/floor-stack.js`
- Create: `web/tests/lod.test.js`
- Modify: `web/src/main.js`

**Interfaces:**
- Produces `createCameraControllers(canvas, bounds)`, `resolveLod(zoom)`, and `createFloorStack(floorData)`.
- `createFloorStack()` exposes `showOnly(floorId)`, `showAll()`, and `applyLod(level)`.

- [ ] **Step 1: Write failing LOD threshold tests**

```js
import { expect, it } from 'vitest';
import { resolveLod } from '../src/lod.js';

it('changes LOD by orthographic zoom', () => {
  expect(resolveLod(0.3)).toBe('block');
  expect(resolveLod(0.7)).toBe('mass');
  expect(resolveLod(1.2)).toBe('detail');
});
```

- [ ] **Step 2: Run the LOD test to verify it fails**

Run: `npm test --prefix web -- lod.test.js`

Expected: FAIL because `lod.js` is absent.

- [ ] **Step 3: Implement LOD and floor-stack modules**

`resolveLod(zoom)` compares its argument to `LOD_ZOOM.block` and `LOD_ZOOM.mass`. `floor-stack.js` changes only scene-group visibility: map mode shows the chosen floor and its routing layer; exploration mode shows both floor groups and connector meshes. It never changes the graph.

- [ ] **Step 4: Implement camera controllers**

Create both cameras once. `OrthographicCamera` uses pan and wheel zoom only; disable rotation and clamp zoom to `0.25..2.4`. `PerspectiveCamera` uses `OrbitControls` and has a target at halfway between floor elevations. `setMode('map' | 'explore')` returns the active camera and updates controls. `resize(width, height)` updates the active perspective aspect and orthographic frustum.

- [ ] **Step 5: Wire mode and floor state in `main.js`**

On every map camera change, call `floorStack.applyLod(resolveLod(mapCamera.zoom))`. Starting state is map mode with Ground Floor selected. Exploration mode calls `floorStack.showAll()`.

- [ ] **Step 6: Run tests and manual camera checks**

Run: `npm test --prefix web && npm run dev --prefix web`

Expected: LOD test passes; map mode cannot orbit; exploration mode can orbit and displays GF, FF, and any valid connector slope.

- [ ] **Step 7: Commit**

```bash
git add web/src/cameras.js web/src/lod.js web/src/floor-stack.js web/src/main.js web/tests/lod.test.js
git commit -m "feat: add map and exploration camera modes"
```

### Task 6: Render routes, select graph nodes, and build transition UI

**Files:**
- Create: `web/src/route-renderer.js`
- Create: `web/src/interaction.js`
- Create: `web/src/ui.js`
- Modify: `web/index.html`
- Modify: `web/src/main.js`
- Modify: `web/src/styles.css`
- Test: `web/tests/routing.test.js`

**Interfaces:**
- Consumes: `RouteSolution`, `segmentRoute()`, floor stack, active camera, and graph nodes.
- Produces `createRouteRenderer(scene)`, `createNodePicker(renderer, cameraProvider, nodes)`, and `createUi(root)`.

- [ ] **Step 1: Extend the routing test for continuation labels**

```js
it('formats a floor transition using its connector ID', () => {
  const segments = [
    { floor: 'GF', nodeIds: ['GF:A', 'GF:Eskalator01:lower'], connectorId: 'Eskalator01', nextFloor: 'FF' },
  ];
  expect(formatContinuation(segments[0])).toBe('Lanjut ke First Floor via Eskalator01 →');
});
```

Export `formatContinuation()` from `ui.js` and import it into the test.

- [ ] **Step 2: Run the continuation test to verify it fails**

Run: `npm test --prefix web -- routing.test.js`

Expected: FAIL because `ui.js` does not export `formatContinuation`.

- [ ] **Step 3: Implement route rendering**

For a same-floor segment, build a `CatmullRomCurve3` from its node positions at that floor's route-surface height. For an exploration route, include connector lower/upper points in one complete curve. Render a green tube and an arrow/marker mesh. `update(deltaSeconds)` advances marker progress with `progress = (progress + deltaSeconds * 0.12) % 1`; no marker is animated if there is no solved route.

- [ ] **Step 4: Implement click selection**

Render routing nodes as distinct pickable meshes: orange for doors, red for junctions, and blue-green for connector entries. The first click sets start; second sets destination and runs `dijkstra()`. Clicking a third node replaces the start and clears the previous route. Node pick meshes remain independent of SVG zone meshes.

- [ ] **Step 5: Implement controls and route state UI**

Provide working controls for `Ground Floor`, `First Floor`, `Map`, `Explore 3D`, `Reset`, and `Hapus Rute`. In map mode, show the current floor segment only. If it ends in a connector, render a button whose exact label comes from `formatContinuation()`. Clicking it selects `nextFloor`, updates floor isolation, and renders the next segment. Do not render a continuation button in exploration mode or after the final segment.

- [ ] **Step 6: Run tests and browser verification**

Run: `npm test --prefix web && npm run build --prefix web && npm run dev --prefix web`

Expected: all tests pass; two node clicks show a route when the graph is connected; a valid cross-floor route offers exactly one correct continuation action in map mode.

- [ ] **Step 7: Commit**

```bash
git add web/index.html web/src/route-renderer.js web/src/interaction.js web/src/ui.js web/src/main.js web/src/styles.css web/tests/routing.test.js
git commit -m "feat: add interactive two-floor routes"
```

### Task 7: Finish local developer documentation and remove migration ambiguity

**Files:**
- Modify: `web/README.md`
- Modify: `web/package.json`
- Test: `web/tests/svg-to-scene.test.js`

**Interfaces:**
- Documents the commands used by developers: `npm install`, `npm run dev`, `npm test`, and `npm run build`.

- [ ] **Step 1: Add a failing asset-presence test**

```js
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

it('ships both required floor assets', () => {
  expect(existsSync(resolve('assets/T1-GF-Area.svg'))).toBe(true);
  expect(existsSync(resolve('assets/T1-FF-Area.svg'))).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify asset paths resolve from Vite root**

Run: `npm test --prefix web -- svg-to-scene.test.js`

Expected: PASS only after Vitest is configured with `root: 'web'` or the test uses an absolute URL derived from `import.meta.url`.

- [ ] **Step 3: Update the README with exact SVG conventions and commands**

Document that one physical cross-floor escalator needs one exact unique ID on both SVGs, such as `Eskalator01`. State that `_2` suffixes are diagnostics, not automatic pairs. Include the required Figma conventions for `node` groups, orange/red node fills, and red edge strokes.

- [ ] **Step 4: Run final verification**

Run: `npm test --prefix web && npm run build --prefix web`

Expected: all tests pass and build completes without unresolved asset URLs.

- [ ] **Step 5: Commit**

```bash
git add web/README.md web/package.json web/tests/svg-to-scene.test.js
git commit -m "docs: document two-floor map workflow"
```

## Plan Self-Review

- Spec coverage: Tasks 1–2 cover Vite, two SVGs, extrusion, and graph marks; Task 3 covers Dijkstra and floor splitting; Task 4 covers GF-driven sloped escalators; Task 5 covers camera modes, stacking, and zoom LOD; Task 6 covers click interaction, smooth routes, marker, and continuation UI; Task 7 covers local usage and conventions.
- Placeholder scan: no open implementation decisions remain. The only runtime diagnostics are defined responses to the current duplicate FF escalator IDs.
- Type consistency: `FloorData`, `RouteNode`, `RouteEdge`, `RouteSolution`, `buildEscalatorConnectors`, `buildGraph`, `dijkstra`, and `segmentRoute` keep the same names and record fields in all consuming tasks.
