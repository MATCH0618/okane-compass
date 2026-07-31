#!/usr/bin/env python3
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "index.html"
PATCHER = ROOT / "tools" / "apply_data_safety_patch.py"

required_before = [
    'version:"0.18"',
    'document.getElementById("file").onchange=async e=>{try{state=JSON.parse',
    'state.transactions.push({\n    id:Date.now()+""',
]
required_after = [
    'const APP_STATE_VERSION="0.19";',
    'function normalizeState(candidate)',
    'const hasTransactionDuplicate=',
    'バックアップの形式が正しくないため、読み込みませんでした',
    '重複の可能性がありますが記録しますか',
]

source_text = SOURCE.read_text(encoding="utf-8")
missing = [item for item in required_before if item not in source_text]
if missing:
    raise SystemExit(f"Current source no longer matches expected v0.18 baseline: {missing}")

with tempfile.TemporaryDirectory() as tmp:
    tmp_root = Path(tmp)
    (tmp_root / "tools").mkdir()
    (tmp_root / "index.html").write_text(source_text, encoding="utf-8")
    patch_text = PATCHER.read_text(encoding="utf-8")
    (tmp_root / "tools" / PATCHER.name).write_text(patch_text, encoding="utf-8")
    subprocess.run([sys.executable, str(tmp_root / "tools" / PATCHER.name)], check=True)
    patched = (tmp_root / "index.html").read_text(encoding="utf-8")

missing = [item for item in required_after if item not in patched]
if missing:
    raise SystemExit(f"Patched source is missing safeguards: {missing}")

if patched.count('const APP_STATE_VERSION="0.19";') != 1:
    raise SystemExit("Patch was applied more than once or version marker is invalid")

print("Data safety patch checks passed")
