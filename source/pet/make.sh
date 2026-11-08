#!/bin/bash
# สร้าง assets/pet/sweetie-belle.glb ใหม่จากไฟล์ Blender
#   source/pet/make.sh "<โฟลเดอร์ที่แตก sweetie-belle.zip>/source/甜贝儿.blend"
# ต้องมี: Python ที่ import bpy ได้ (pip install bpy==5.2.3 ใช้ Python 3.13) และ Node 18+
#   ระบุ Python ได้ด้วย BLENDER_PY=/path/to/python
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
BLEND="${1:?ระบุไฟล์ .blend}"
OUT="${2:-$HERE/../../assets/pet/sweetie-belle.glb}"
PY="${BLENDER_PY:-python3}"
cd "$HERE"
[ -d node_modules/@gltf-transform/cli ] || npm install --no-audit --no-fund --silent
GT="$HERE/node_modules/.bin/gltf-transform"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
"$PY" -I "$HERE/build_pet.py" -- "$BLEND" "$T/raw.glb" 1 1024 2>&1 | grep -E "BAKED|EXPORTED|Traceback|Error" || true
[ -s "$T/raw.glb" ] || { echo "Blender export failed" >&2; exit 1; }
"$GT" dedup "$T/raw.glb" "$T/a.glb" >/dev/null
"$GT" prune "$T/a.glb" "$T/b.glb" >/dev/null
"$GT" resample "$T/b.glb" "$T/c.glb" >/dev/null
node "$HERE/prune_rest.mjs" "$T/c.glb" "$T/d.glb"
"$GT" prune "$T/d.glb" "$T/e.glb" >/dev/null
"$GT" meshopt "$T/e.glb" "$OUT"
ls -l "$OUT"
