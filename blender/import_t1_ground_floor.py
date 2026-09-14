"""Build a light, navigable 2.5D base map of Juanda Terminal 1 Ground Floor.

The source of truth stays the SVG. This script turns its filled shapes into
low blocks, preserves the SVG's zoning colours, sets an isometric camera, and
saves both a Blender scene and a preview PNG.

Run from Blender's Scripting workspace with Run Script / Alt+P.
"""

from math import radians
from pathlib import Path

import bpy
from mathutils import Vector


SVG_PATH = Path(r"C:\Users\Naufal Ghani\Downloads\T1-GF-Area.svg")
BLEND_PATH = SVG_PATH.with_name("T1-GF-2_5D.blend")
PREVIEW_PATH = SVG_PATH.with_name("T1-GF-2_5D-preview.png")

# 21,956 SVG units become roughly 220 metres in Blender.
METRES_PER_SVG_UNIT = 0.01
BASE_THICKNESS_METRES = 0.08
SPACE_THICKNESS_METRES = 0.26


def clear_scene():
    """This script owns the complete scene, so each run starts clean."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)


def material(name, colour, roughness=0.82):
    item = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    item.diffuse_color = (*colour, 1.0)
    item.use_nodes = True
    principled = item.node_tree.nodes.get("Principled BSDF")
    if principled:
        principled.inputs["Base Color"].default_value = (*colour, 1.0)
        principled.inputs["Roughness"].default_value = roughness
    return item


def assign_if_empty(curve, fallback):
    if not curve.materials:
        curve.materials.append(fallback)


def bounds(objects):
    bpy.context.view_layer.update()
    points = []
    for obj in objects:
        for corner in obj.bound_box:
            points.append(obj.matrix_world @ Vector(corner))

    low = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    high = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return low, high


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_camera_and_lights(low, high):
    centre = (low + high) / 2
    width = high.x - low.x
    depth = high.y - low.y
    longest = max(width, depth)

    # This camera serves orientation: the terminal's long axis and zone
    # hierarchy stay visible without pretending to be an architectural render.
    camera_data = bpy.data.cameras.new("Wayfinding camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = max(width / (16 / 9), depth) * 1.32
    camera = bpy.data.objects.new("Wayfinding camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = centre + Vector((longest * 0.18, -longest * 0.42, longest * 0.74))
    look_at(camera, centre)
    bpy.context.scene.camera = camera

    key_data = bpy.data.lights.new("Soft daylight", "AREA")
    key_data.energy = 1500
    key_data.shape = "DISK"
    key_data.size = longest * 0.55
    key = bpy.data.objects.new("Soft daylight", key_data)
    bpy.context.scene.collection.objects.link(key)
    key.location = centre + Vector((-longest * 0.25, -longest * 0.15, longest * 0.85))
    look_at(key, centre)

    fill_data = bpy.data.lights.new("Map fill", "AREA")
    fill_data.energy = 700
    fill_data.size = longest * 0.4
    fill = bpy.data.objects.new("Map fill", fill_data)
    bpy.context.scene.collection.objects.link(fill)
    fill.location = centre + Vector((longest * 0.2, longest * 0.25, longest * 0.5))
    look_at(fill, centre)


def add_ground(low, high):
    centre = (low + high) / 2
    extent = max(high.x - low.x, high.y - low.y) * 0.82
    bpy.ops.mesh.primitive_plane_add(size=2, location=(centre.x, centre.y, low.z - 0.03))
    ground = bpy.context.object
    ground.name = "Site background"
    ground.scale = (extent, extent, 1)
    ground.data.materials.append(material("Site background", (0.89, 0.92, 0.93)))


def configure_render():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(PREVIEW_PATH)
    scene.render.film_transparent = False
    scene.world.color = (0.89, 0.92, 0.93)


def main():
    if not SVG_PATH.exists():
        raise FileNotFoundError(f"SVG tidak ditemukan: {SVG_PATH}")

    clear_scene()

    collection = bpy.data.collections.new("T1 Ground Floor 2.5D")
    bpy.context.scene.collection.children.link(collection)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children[collection.name]

    existing = set(bpy.data.objects)
    bpy.ops.import_curve.svg(filepath=str(SVG_PATH))
    imported = [obj for obj in bpy.data.objects if obj not in existing]

    base_material = material("Terminal base", (0.72, 0.75, 0.76))
    fallback_material = material("Unclassified space", (0.62, 0.69, 0.72))

    for obj in imported:
        obj.name = obj.name.replace(" ", "_")
        obj.scale = (METRES_PER_SVG_UNIT, METRES_PER_SVG_UNIT, METRES_PER_SVG_UNIT)

        # SVG is imported upright; this lays its long plan on the ground plane.
        obj.rotation_euler = (radians(90), 0, 0)

        if obj.type != "CURVE":
            continue

        curve = obj.data
        curve.dimensions = "2D"
        curve.resolution_u = 1
        curve.render_resolution_u = 1
        curve.resolution_v = 0

        if obj.name.lower().startswith("vector_328"):
            curve.extrude = BASE_THICKNESS_METRES / METRES_PER_SVG_UNIT
            curve.materials.clear()
            curve.materials.append(base_material)
            obj.location.z = -BASE_THICKNESS_METRES
        else:
            curve.extrude = SPACE_THICKNESS_METRES / METRES_PER_SVG_UNIT
            assign_if_empty(curve, fallback_material)

    low, high = bounds(imported)
    add_ground(low, high)
    add_camera_and_lights(low, high)
    configure_render()

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    bpy.ops.render.render(write_still=True)
    print(f"Selesai: {BLEND_PATH}")
    print(f"Preview: {PREVIEW_PATH}")


if __name__ == "__main__":
    main()
