"""Build web runtime GLBs from the authoritative OSR Blender exports.

Run with Blender, not CPython:
  blender --background --factory-startup --python scripts/optimize-authored-models.py

The source files are only imported. They are never opened for saving or
modified in place. Runtime files use Meshopt geometry compression and high
quality WebP textures, while preserving the authored object hierarchy.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import bpy


REPO = Path(__file__).resolve().parents[1]
SOURCE_DIR = REPO / "public" / "models" / "original"
OUTPUT_DIR = REPO / "public" / "models" / "runtime"
MANIFEST_PATH = OUTPUT_DIR / "manifest.json"
MODELS = (
    "OSR_oil_rig.glb",
    "OSR_mining_shaft.glb",
    "OSR_sand.glb",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def scene_snapshot() -> dict[str, object]:
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    return {
        "objects": [obj.name for obj in bpy.context.scene.objects],
        "meshObjects": len(mesh_objects),
        "vertices": sum(len(obj.data.vertices) for obj in mesh_objects),
        "triangles": sum(len(obj.data.loop_triangles) for obj in mesh_objects),
        "materials": len(bpy.data.materials),
        "images": len([image for image in bpy.data.images if image.type == "IMAGE"]),
    }


def build(source: Path, output: Path) -> dict[str, object]:
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(source))
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            obj.data.calc_loop_triangles()
    source_scene = scene_snapshot()

    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        export_image_format="WEBP",
        export_image_quality=95,
        export_meshopt_compression_enable=True,
        export_meshopt_extension="EXT_meshopt_compression",
        export_materials="EXPORT",
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
        export_apply=False,
        export_extras=True,
    )

    return {
        "source": str(source.relative_to(REPO)).replace("\\", "/"),
        "runtime": str(output.relative_to(REPO)).replace("\\", "/"),
        "sourceBytes": source.stat().st_size,
        "runtimeBytes": output.stat().st_size,
        "sourceSha256": sha256(source),
        "runtimeSha256": sha256(output),
        "scene": source_scene,
    }


def main() -> None:
    entries = []
    for name in MODELS:
        source = SOURCE_DIR / name
        if not source.exists():
            raise FileNotFoundError(f"Authoritative model is missing: {source}")
        entries.append(build(source, OUTPUT_DIR / name))

    manifest = {
        "generator": f"Blender {bpy.app.version_string}",
        "policy": "Derived runtime files only; authoritative source GLBs are unchanged.",
        "models": entries,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
