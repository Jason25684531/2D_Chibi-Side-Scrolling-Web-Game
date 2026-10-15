"""Read-only source inspection; writes review data, never edits character art.

Run from the repository root with Python and the already available Pillow.
"""
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Char_Aassest/characters"
DOCS = ROOT / "docs"
ASSETS = ROOT / "assets"


def relative(path):
    return path.relative_to(ROOT).as_posix()


def main():
    if not SOURCE.is_dir():
        raise SystemExit(f"BLOCKED: source directory inaccessible: {SOURCE}")
    files = sorted(p for p in SOURCE.rglob("*") if p.is_file())
    records, failures = [], []
    for path in files:
        if path.suffix.lower() not in {".png", ".gif", ".jpg", ".jpeg", ".webp"}:
            continue
        try:
            with Image.open(path) as image:
                image.verify()
            with Image.open(path) as image:
                frame_count = getattr(image, "n_frames", 1)
                alpha_ranges = []
                for frame in range(frame_count):
                    image.seek(frame)
                    image.load()
                    alpha_ranges.append(image.convert("RGBA").getchannel("A").getextrema())
                records.append({
                    "path": relative(path), "format": image.format,
                    "width": image.width, "height": image.height, "mode": image.mode,
                    "image_frames": frame_count,
                    "has_transparent_pixels": any(low < 255 for low, _ in alpha_ranges),
                    "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                })
        except Exception as error:
            failures.append(f"{relative(path)}: {error}")
    json_errors = []
    for path in (p for p in files if p.suffix.lower() == ".json"):
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except Exception as error:
            json_errors.append(f"{relative(path)}: {error}")

    manifest = {"schemaVersion": 1, "experience": 3, "status": "proposal-review",
                "sourceRoot": "Char_Aassest/characters", "characters": []}
    summaries, warnings = [], []
    for directory in sorted(p for p in SOURCE.iterdir() if p.is_dir()):
        character_id = directory.name
        processed = directory / "hero_action_bundle/processed"
        metadata_path = processed / "animation-metadata.json"
        web_path = processed / "web/animations.json"
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        web = json.loads(web_path.read_text(encoding="utf-8"))
        atlas_path = web_path.parent / web["image"]
        scale_path = processed / "character-scale-profile.json"
        scale = json.loads(scale_path.read_text(encoding="utf-8"))
        character = {
            "id": character_id, "variant": "processed-256-test-export",
            "sourceMetadata": relative(metadata_path), "sourceScaleProfile": relative(scale_path),
            "atlas": {"sourcePath": relative(atlas_path),
                      "sha256": hashlib.sha256(atlas_path.read_bytes()).hexdigest(),
                      "sizePx": [web["atlas_size"]["width"], web["atlas_size"]["height"]],
                      "stageTo": f"public/assets/characters/{character_id}/{web['image']}",
                      "plannedBrowserUrl": f"/assets/characters/{character_id}/{web['image']}",
                      "runtimeUrl": None, "stagingStatus": "not-staged"},
            "frameSizePx": metadata["frame_size_px"], "sourceFps": web["fps"],
            "animationFpsDecision": "pending: source 12.5 versus roadmap 24",
            "anchorPx": scale["anchor"], "animations": {},
            "stateBindings": {"IDLE": "idle", "RUN": "run", "JUMP": "jump", "HURT": "hurt",
                              "DOUBLE_JUMP": None, "DASH": None, "FALL": None, "WIN": None},
            "expressions": {"NORMAL": None, "HURT": None, "WIN": None},
            "missingAssetPolicy": "labelled-graybox-placeholder",
        }
        with Image.open(atlas_path) as atlas:
            atlas.load()
            assert list(atlas.size) == character["atlas"]["sizePx"], relative(atlas_path)
            for action, info in metadata["actions"].items():
                frames = web["animations"][action]["frames"]
                paths = [processed / name for name in info["frame_files"]]
                assert all(p.is_file() for p in paths), (character_id, action, "missing frame")
                assert len(frames) == len(paths) == info["frames"], (character_id, action)
                with Image.open(processed / info["sheet"]) as sheet:
                    expected = (info["cols"] * metadata["frame_size_px"][0],
                                info["rows"] * metadata["frame_size_px"][1])
                    assert sheet.size == expected, (character_id, action, sheet.size, expected)
                for path, frame in zip(paths, frames):
                    x, y, width, height = (frame[k] for k in ("x", "y", "width", "height"))
                    assert x >= 0 and y >= 0 and x + width <= atlas.width and y + height <= atlas.height
                    with Image.open(path) as image:
                        assert list(image.size) == metadata["frame_size_px"], relative(path)
                        source_pixels = image.convert("RGBA").getdata()
                        atlas_pixels = atlas.crop((x, y, x + width, y + height)).convert("RGBA").getdata()
                        assert all(a == b or a[3] == b[3] == 0 for a, b in zip(source_pixels, atlas_pixels)), relative(path)
                processing = scale["actions"][action].get("frames", [])
                clipped = sum(bool(f.get("clipped_to_256_canvas")) for f in processing)
                touches = sum(bool(f.get("touches_output_edge")) for f in processing)
                if clipped or touches:
                    warnings.append(f"{character_id}/{action}: metadata reports clipped={clipped}, edge-touch={touches}; review art before formal use.")
                character["animations"][action] = {
                    "sourceSheet": relative(processed / info["sheet"]),
                    "sourceFrames": [relative(p) for p in paths],
                    "frameCount": info["frames"], "sheetGrid": {"rows": info["rows"], "columns": info["cols"]},
                    "order": "row-major", "loop": info["loop"], "frames": frames,
                }
                summaries.append(f"| {character_id} | {action} | {info['frames']} | {info['rows']} × {info['cols']} | {expected[0]} × {expected[1]} | {clipped} / {touches} |")
        manifest["characters"].append(character)

    DOCS.mkdir(exist_ok=True)
    ASSETS.mkdir(exist_ok=True)
    with (DOCS / "asset-files.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(records[0]))
        writer.writeheader()
        writer.writerows(records)
    (ASSETS / "character-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    dimensions = Counter((r["width"], r["height"]) for r in records)
    report = [
        "# Character asset inventory", "", "Inspection date: 2026-10-14. Source: `Char_Aassest/characters` and all descendants.",
        "Windows source directory was accessible. Source images were read only; nothing was copied, renamed, regenerated, or overwritten.", "",
        "## Method and evidence", "", "Command: `python tools/inspect-character-assets.py` (Pillow 10.1.0 already available).",
        "Checks: decode every image/GIF frame; alpha pixel extrema; parse every JSON; validate preferred frame references, counts, dimensions, sheet grid, atlas bounds, and visible atlas/frame pixel correspondence (RGB beneath alpha=0 is ignored).",
        "Pixel resolution is reported; PNG DPI is not a gameplay unit. Transparency means actual pixels below alpha 255, not merely an RGBA header.",
        "`asset-files.csv` contains per-image format, dimensions, mode, image frame count, transparency, and SHA-256. Static PNG image frame count is 1; sprite animation counts come from the verified metadata below.", "",
        f"Files: {len(files)}; extensions: {dict(sorted(Counter(p.suffix.lower() for p in files).items()))}.",
        f"Decoded images: {len(records)}; decode failures: {len(failures)}; malformed JSON: {len(json_errors)}.",
        f"Image sizes (width × height → count): {dict(sorted(dimensions.items()))}.", "",
        "## Preferred existing test-export variant", "",
        "IDs: `aria`, `kael`, `riven`. All preferred individual frames are 256 × 256 transparent PNGs; combined atlases are 1536 × 1792 (6 columns, 7 action rows; unused cells are not frames).",
        "Each source frame lasts 80 ms / 12.5 fps. This differs from the requested 24fps roadmap; changing playback speed is a review decision, never a physics-rate side effect.",
        "Ground anchors from processed scale profiles: Aria x=128,y=240; Kael/Riven x=128,y=248. These are rendering anchors, not approved physics body dimensions.", "",
        "| Character | Action | Frames | Sheet rows × columns | Sheet px | Clipped / edge-touch metadata |",
        "|---|---|---:|---|---|---|", *summaries, "",
        "Idle/Run/Jump/Hurt exist. No dedicated Double Jump, Dash, Fall, or Win assets were found. No separate NORMAL/HURT/WIN expression set was found; a hurt action is not proof of a separately approved HURT expression.",
        "Attack/walk/guard assets are inventoried only; their presence does not authorize extra gameplay.", "",
        "## Variants and inconsistencies", "",
        "The preferred manifest explicitly selects `hero_action_bundle/processed`; earlier raw, master, pixel sprite, and Kael export variants remain untouched. `characters_Backup` and `old` are outside the requested active source and are not substituted automatically.",
        "Riven also has 48 × 64 pixel sprites with horizontal strips. Its sprite metadata declares six-frame grids as 2 rows × 3 columns, while its README says 2 × 3 without matching that orientation clearly; never infer layouts from filenames/README alone.",
        "Kael's older export README describes 48 × 64 source pixels scaled into 256 cells. Its root scale profile declares cell_size=48; the preferred processed profile declares 256. These represent different exports and must not be combined.",
        "Aria master includes a GIF; it is a reference/legacy animation, not a verified D2 state sheet.",
        "Paths include both padded and unpadded indices and several different sheet names; use explicit manifest entries rather than constructing filenames in Gameplay Code.",
        "Processed profiles contain historical `assets/...` source directories that do not exist here; the manifest uses verified repository-relative source paths instead.", "",
        "### Art warnings (existing source metadata, not repaired)", "", *[f"- {w}" for w in warnings], "",
        "Metadata clipping/edge flags indicate review risks, not decode corruption. At the 2026-10-14 init review, Aria idle-01, Kael run-01, and Riven idle-01 were opened directly: the samples have adult body proportions rather than an obviously chibi silhouette, and Kael run visibly touches/clips the cell edges.",
        "This sample review does not approve the full animation set or certify character identity. Full silhouette/animation/expression approval and in-game readability remain NOT TESTED. Resolve the chibi art-direction mismatch (C5/B11) without changing source shapes, colors, or proportions; graybox placeholders remain available.", "",
        "## Manifest / browser staging", "",
        "`assets/character-manifest.json` records IDs, chosen variant, source provenance/hash, atlas rectangles, frame sequence/layout/timing, anchors, missing state/expressions, and planned public destinations.",
        "`runtimeUrl` remains null and `stagingStatus` is `not-staged`. Planned `/assets/characters/...` URLs become usable only after apply copies the exact selected files to `public/assets/characters/...`. No browser may load `D:\\...` or a sourcePath directly.",
        "Missing animations/expressions use visibly labelled graybox placeholders. Existing art may only use uniform display scaling; no recoloring, nonuniform stretching, cropping repairs, or source replacement.", "",
        "## Failures", "", *[f"- {e}" for e in failures + json_errors],
        "None." if not failures and not json_errors else "Resolve these before approving the affected asset variant.", "",
    ]
    (DOCS / "asset-inventory.md").write_text("\n".join(report), encoding="utf-8")
    print(json.dumps({"sourceFiles": len(files), "decodedImages": len(records), "decodeFailures": failures,
                      "jsonErrors": json_errors, "characters": [c["id"] for c in manifest["characters"]],
                      "verifiedActions": len(summaries), "artWarnings": warnings}, ensure_ascii=False))
    assert not failures and not json_errors, "Asset inspection failures; see inventory"


if __name__ == "__main__":
    main()
