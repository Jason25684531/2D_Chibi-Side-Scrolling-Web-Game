"""Stage the CYBER RUN 1102 package into the runtime. Never edits package files.

- Level / config JSON -> src/level/data/ (tracked, imported by Vite).
- Images used by the level -> public/assets/cyber-run/ with ASCII names,
  downscaled to <=128 px per runtime cell (runtime cell = 32 px).
- src/level/data/assets.json maps package path (relative to game/) -> url/size/sha256.
Package drift (listed file missing or byte size changed) aborts before writing anything.
Run from the repository root: python tools/stage-assets.py
"""
import hashlib
import json
import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PKG = ROOT / "1102_關卡編輯器/CYBER_RUN_1101_可直接開啟"
GAME = PKG / "game"
OUT = ROOT / "public/assets/cyber-run"
DATA = ROOT / "src/level/data"
CELL = 128  # max px per cell after staging
ATTRACT = ROOT / "1102_關卡編輯器/CYBER_RUN_首頁待機巡覽_純畫面_1920x1080_60fps.mp4"
ASSEST = ROOT / "assest"
ROLES = ("S2AM", "S3WW", "S1WM", "S2WW")  # ComfyUI template index = position + 1
ACTIONS = ("idle", "run", "jump", "djump", "fall", "attack")  # turn is unused: the controller has no turn state
SKIN_CELL = 256  # px per sheet cell after staging (source cells are 1024)
POSE_H = 1024  # DOM pose height cap: trimmed cells are ~800 px, never upscaled by the 660 px hero
ALPHA_CUT = 32  # alpha above this counts as character pixels for bbox / calibration
WORKFLOW = ROOT / "ComfyUI_API/2026_Taskforce_2028_Platformer_Final_CAM_261115.api.json"
WORKFLOW_NODES = {"1": "PrimitiveInt", "2": "String", "3": "LoadImage"}  # template index, output name, user photo
JSON_FILES = {
    "level.json": PKG / "data/levels/1102版.level.json",
    "attack-items.json": GAME / "items/攻擊道具.json",
    "beholder.json": GAME / "monsters/眼魔.json",
    "charger.json": GAME / "monsters/魔蛛.json",
}


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def plan():
    """Return {package-relative path: max width in px or None (keep size)}."""
    level, items = load(JSON_FILES["level.json"]), load(JSON_FILES["attack-items.json"])
    want = {}

    def add(rel, width):
        want[rel] = max(want.get(rel) or 0, width) if width else None

    for a in level["art"]:
        add("art/" + a["src"], a["w"] * CELL)
    for key in ("normal", "press", "bounce"):
        add("art/" + level["springArt"][key], level["springArt"].get("artW", 1) * CELL)
    add("art/" + level["goalArt"]["art"], level["goalArt"].get("endW", 4) * CELL)
    for e in level["entities"]:
        if e["type"] == "mover" and e.get("props", {}).get("art"):
            add("art/" + e["props"]["art"], 3 * CELL)
    add("art/" + level["moverArt"]["art"], level["moverArt"].get("artW", 3) * CELL)
    for art in level["itemArt"].values():
        add("items/" + art["art"], round(art["w"] * CELL))
    add(level["background"]["src"], None)
    for name in ("beholder.json", "charger.json"):
        m = load(JSON_FILES[name])
        for frame in m["frames"]:
            add("monsters/" + frame, round(m["size"] * CELL))
    for item in items["items"]:
        add("items/攻擊道具/" + item["src"], 256)
    return want


def bbox(cell):
    return cell.getchannel("A").point(lambda v: 255 if v > ALPHA_CUT else 0).getbbox()


def check_workflow(errors):
    """API-format workflow exported from ComfyUI; the station only rewrites nodes 1-3."""
    if not WORKFLOW.exists():
        print(f"WARN missing {WORKFLOW.relative_to(ROOT)}: 拍照客製化 will be disabled")
        return None
    wf = load(WORKFLOW)
    for node, kind in WORKFLOW_NODES.items():
        if wf.get(node, {}).get("class_type") != kind:
            errors.append(f"workflow node {node}: expected {kind}, got {wf.get(node, {}).get('class_type')}")
    if sum(n.get("class_type") == "TaskforceReassembleAlignedSheets" for n in wf.values()) != 1:
        errors.append("workflow: expected exactly one TaskforceReassembleAlignedSheets node")
    return wf


def stage_skins():
    """assest/preset_<role> -> public/assets/skins/<role>/ (downscaled sheets + trimmed poses) and src/level/data/skins.json."""
    skins = {}
    for role in ROLES:
        src = ASSEST / f"preset_{role}"
        manifest = load(src / "manifest/game_manifest.json")
        out = OUT.parent / "skins" / role
        out.mkdir(parents=True, exist_ok=True)
        actions, cells = [], {}
        for a in manifest["actions"]:
            if a["id"] not in ACTIONS:
                continue
            with Image.open(src / a["sprite_sheet"]) as image:
                image = image.convert("RGBA")
                cells[a["id"]] = image.crop((0, 0, image.width // a["cols"], image.height // a["rows"]))
                image.resize((a["cols"] * SKIN_CELL, a["rows"] * SKIN_CELL), Image.LANCZOS).save(out / f"{a['id']}.png")
            actions.append({**{k: a[k] for k in ("id", "rows", "cols", "frame_count", "fps")}, "sprite_sheet": f"/assets/skins/{role}/{a['id']}.png"})
        missing = set(ACTIONS) - set(cells)
        if missing:
            sys.exit(f"{role}: missing actions {sorted(missing)}")
        poses = {}
        for name in ("idle", "attack", "jump"):
            pose = cells[name].crop(bbox(cells[name]))
            k = min(1, POSE_H / pose.height)
            pose.resize((round(pose.width * k), round(pose.height * k)), Image.LANCZOS).save(out / f"pose-{name}.png")
            poses[name] = f"/assets/skins/{role}/pose-{name}.png"
        idle = cells["idle"]
        left, top, right, bottom = bbox(idle)
        # Feet line and body height as fractions of a cell; ComfyUI output is aligned to the same reference, so it reuses them.
        skins[role] = {"manifest": {"schema": manifest["schema"], "role_code": manifest["role_code"], "actions": actions},
                       "foot": round(bottom / idle.height, 4), "body": round((bottom - top) / idle.height, 4),
                       "cx": round((left + right) / 2 / idle.width, 4), "poses": poses}
    (DATA / "skins.json").write_text(json.dumps(skins, ensure_ascii=False, indent=1), encoding="utf-8")
    return skins


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    listed = {e["path"][len("game/"):]: e for e in load(PKG / "docs/asset_manifest.json") if e["path"].startswith("game/")}
    want, errors, warnings = plan(), [], []
    for rel in want:
        src = GAME / rel
        if not src.exists():
            errors.append(f"missing: {rel}")
        elif rel not in listed:
            warnings.append(f"not in asset_manifest.json: {rel}")
        elif src.stat().st_size != listed[rel]["bytes"]:
            errors.append(f"bytes changed: {rel} manifest={listed[rel]['bytes']} actual={src.stat().st_size}")
    for name, src in JSON_FILES.items():
        if not src.exists():
            errors.append(f"missing: {src.relative_to(ROOT)}")
    workflow = check_workflow(errors)
    for w in warnings:
        print("WARN", w)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        sys.exit(1)

    DATA.mkdir(parents=True, exist_ok=True)
    for name, src in JSON_FILES.items():
        shutil.copyfile(src, DATA / name)
    assets = {}
    for rel, width in sorted(want.items()):
        src = GAME / rel
        sha = hashlib.sha256(src.read_bytes()).hexdigest()
        category = rel.split("/")[0]
        dest = OUT / category / f"{category}-{sha[:12]}{src.suffix.lower()}"
        dest.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(src) as image:
            if width and image.width > width:
                image = image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)
            image.save(dest)
            size = image.size
        assets[rel] = {"url": "/" + dest.relative_to(ROOT / "public").as_posix(), "w": size[0], "h": size[1], "sha256": sha}
    (DATA / "assets.json").write_text(json.dumps(assets, ensure_ascii=False, indent=1), encoding="utf-8")
    attract = OUT / "attract.mp4"
    if ATTRACT.exists() and (not attract.exists() or attract.stat().st_size != ATTRACT.stat().st_size):
        shutil.copyfile(ATTRACT, attract)
    skins = stage_skins()
    if workflow:
        (OUT.parent / "comfy").mkdir(parents=True, exist_ok=True)
        (OUT.parent / "comfy/workflow.api.json").write_text(json.dumps(workflow, ensure_ascii=False), encoding="utf-8")
    for role, v in skins.items():
        print(f"Skin {role}: foot={v['foot']} body={v['body']} cx={v['cx']}")
    print(f"Workflow staged: {'yes' if workflow else 'no'}.")
    print(f"Staged {len(assets)} images, {len(JSON_FILES)} JSON files, attract={'yes' if attract.exists() else 'no'}.")


if __name__ == "__main__":
    main()
