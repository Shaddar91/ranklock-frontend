#!/usr/bin/env python3
"""Refuse to ship an asset bundle that lacks any image the live API currently references
(a Workers Static Assets deploy replaces the whole bundle, so a missing file becomes a 404)."""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.request

API = os.environ.get("RANKLOCK_API_BASE", "https://api.ranklock.app")
UPSTREAM = "https://assets-bucket.deadlock-api.com/assets-api-res/images/"
IMG = re.compile(r"\.(webp|png|svg)$", re.I)


def fetch(path: str):
    req = urllib.request.Request(f"{API}{path}", headers={"User-Agent": "ranklock-assets-verify"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def walk(node, out: set[str]) -> None:
    if isinstance(node, dict):
        for v in node.values():
            walk(v, out)
    elif isinstance(node, list):
        for v in node:
            walk(v, out)
    elif isinstance(node, str) and node.startswith(UPSTREAM) and IMG.search(node):
        out.add(node[len(UPSTREAM):])


def main() -> int:
    root = sys.argv[1] if len(sys.argv) > 1 else "public"
    refs: set[str] = set()
    for path in ("/items", "/heroes"):
        try:
            walk(fetch(path), refs)
        except Exception as e:  # noqa: BLE001 - the API being down must not block an art refresh
            print(f"verify_bundle: {path} unavailable ({e}); skipping that source", file=sys.stderr)
    missing = sorted(p for p in refs if not os.path.isfile(os.path.join(root, p)))
    print(f"verify_bundle: {len(refs)} API-referenced paths, {len(missing)} missing from {root}")
    for p in missing[:20]:
        print(f"  MISSING {p}")
    if not refs:
        print("verify_bundle: no references collected; cannot verify", file=sys.stderr)
        return 1
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
