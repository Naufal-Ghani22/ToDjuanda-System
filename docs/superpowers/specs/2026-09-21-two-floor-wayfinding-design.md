# Two-Floor Juanda Wayfinding Design

## Scope

Convert the existing single-floor Three.js map into a client-side, two-floor wayfinding application. It reads `web/assets/T1-GF-Area.svg` and `web/assets/T1-FF-Area.svg`, renders both as stacked 3D floors, and builds the Dijkstra graph from routing marks contained in each SVG.

## Confirmed SVG conventions

- Ground Floor source: `T1-GF-Area.svg`
- First Floor source: `T1-FF-Area.svg`
- Escalators use IDs beginning with `Eskalator`, for example `Eskalator01`.
- Routing nodes are circle or ellipse elements within a group whose ID begins with `node`.
- Orange `#F58231` nodes are selectable door/location nodes.
- Red `#FF3B30` nodes are junction nodes.
- Red-stroke paths and lines are routing edges.

## Escalator source of truth

The Ground Floor footprint is the source of truth for every escalator's width, horizontal length, and heading. An escalator is rendered as a physical slope, not a vertical shaft:

1. Read the Ground Floor escalator's transformed bounding box.
2. Derive its centre, long axis, width, and horizontal run.
3. Create a lower graph node at one end on Ground Floor and an upper graph node at the opposite end on First Floor.
4. Generate a sloped stair/ramp mesh between those endpoints, rising by `FLOOR_HEIGHT`.
5. Add an inter-floor graph edge whose cost is the three-dimensional ramp length.

The First Floor SVG is used only to validate that an escalator with the same semantic ID exists. Its visual geometry remains part of the First Floor map; it does not redefine the slope dimensions.

## Matching rule and data-quality handling

Only exact, unique semantic IDs are paired. A suffix added by Figma for duplicate IDs, such as `_2`, is not silently treated as the same connector. The application reports it as an ambiguous connector and does not add a cross-floor edge for it. This avoids inventing unsafe routes.

For each physical connector, the intended SVG convention is:

```text
GF: Eskalator01
FF: Eskalator01
```

If two independent escalators exist at one location, they receive distinct IDs, such as `Eskalator01-UP` and `Eskalator02-DOWN`. Direction is optional for the first iteration; connector edges are bidirectional until direction metadata is added.

## Coordinate and floor model

- World horizontal axes: SVG X maps to world X; SVG Y maps to world Z.
- World vertical axis: Y.
- Ground Floor elevation: `0`.
- First Floor elevation: `FLOOR_HEIGHT`.
- Building meshes rest on their own floor plane.
- Routing overlays lie on the walkable surface for their floor.

## Module boundaries

```text
web/src/
  main.js              application composition and render loop
  config.js            scale, floor elevation, colours, LOD thresholds
  svg-to-scene.js      SVG loading, extrusion, node/edge/escalator extraction
  floor-stack.js       floor groups and floor visibility/isolation
  escalators.js        sloped connector mesh and connector graph records
  routing.js           graph build, Dijkstra, route segmentation by floor
  lod.js               orthographic zoom-based LOD switching
  cameras.js           orthographic map camera and perspective exploration camera
  route-renderer.js    static path meshes, animated route marker, route cleanup
  interaction.js       raycasting and start/destination selection
  ui.js                control state, status, floor continuation action
```

## Camera and LOD behaviour

### Map mode

Uses `OrthographicCamera`. Rotation is disabled. Zoom controls three levels:

1. low zoom: flat area blocks;
2. middle zoom: simple masses;
3. high zoom: full extruded detail and route nodes.

Map mode isolates one floor. A cross-floor route renders the current floor segment and exposes a continuation control naming the connector and target floor.

### Exploration mode

Uses `PerspectiveCamera` with orbit controls. Both floors and physical escalator slopes are visible. The entire route, including its sloped inter-floor segment, is rendered as one path.

## Routing and interaction

1. User clicks a node for start and then a node for destination.
2. Dijkstra runs over visual-independent graph records: `{ id, x, z, floor, type }` and weighted edges.
3. The solved path is split into contiguous floor segments for map mode.
4. `CatmullRomCurve3` renders each visible segment; the vertical connector uses its true sloped endpoints.
5. A marker moves along the currently visible route geometry.

No route is created through an unmatched or ambiguous escalator.

## Error states

- Missing SVG: show which floor file is unavailable.
- No node group: show the file name and expected node convention.
- No usable red routing edge: render the map but disable route calculation.
- Ambiguous/missing escalator pair: render both floor visuals, omit the connector edge, and show the connector ID in diagnostics.

## Verification

- Unit tests: Dijkstra weights, graph segmentation, exact escalator pairing, duplicate-ID rejection, and route transition labels.
- Browser test: both SVGs load, floor elevations differ by `FLOOR_HEIGHT`, map mode prevents rotation, exploration mode renders both floors, and an exact matched escalator produces a sloped connector.

## Delivery order

1. Vite scaffold and asset migration without changing the SVG files.
2. Two-floor SVG-to-scene pipeline and diagnostics.
3. Connector extraction and sloped escalator graph edges.
4. Cameras, floor isolation, and LOD.
5. Route rendering, click selection, and continuation UI.
