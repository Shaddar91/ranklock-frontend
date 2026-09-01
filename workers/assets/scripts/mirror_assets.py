#!/usr/bin/env python3
"""Mirror Deadlock assets (ranks, heroes, items) from the community
deadlock-api assets service into a local directory tree + manifests.

Source:  https://assets.deadlock-api.com/v2/{ranks,heroes,items}
         (community-run, MIT-licensed code; art is extracted from Valve's
         Deadlock game files and remains Valve IP — we do not own it.)

Why mirror instead of hotlinking the API at runtime:
  - the upstream is a hobby project with no SLA; if it goes down, every
    icon on the site would break at once.
  - we serve our own copy from our own CDN (S3/CloudFront or Cloudflare R2),
    pinned to a version we control.

Design choices:
  - IDEMPOTENT: a file already on disk is skipped (no re-download).
  - KEEP-LAST-GOOD: a failed download never deletes an existing good file;
    the run logs the failure and continues. An upstream outage means
    "assets don't update this cycle", not "assets disappear".
  - The bucket 403s unknown user-agents, so we send one.

Usage:
    ./mirror_assets.py [--out DIR] [--only ranks,heroes,items]
                       [--formats png,webp] [--force]
                       [--upload]   # after mirroring, push the tree into R2

    --upload (alias --r2) runs upload_assets.py once the mirror is refreshed, so
    a single command = re-mirror then re-sync to https://assets.ranklock.app. It
    needs the R2_* creds (see upload_assets.py); without them the upload step
    reports the missing env and exits non-zero (the mirror itself still succeeds).
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request
from urllib.error import HTTPError, URLError

API_BASE = "https://assets.deadlock-api.com/v2"
USER_AGENT = "ranklock-asset-mirror"
CATEGORIES = ("ranks", "heroes", "items")


def fetch_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def download(url: str, dest: str, force: bool) -> str:
    """Return 'skip' | 'ok' | 'fail'. Never clobbers a good file on failure."""
    if not force and os.path.exists(dest) and os.path.getsize(dest) > 0:
        return "skip"
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + ".part"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=60) as r, open(tmp, "wb") as f:
            f.write(r.read())
        os.replace(tmp, dest)  # atomic; only overwrites after a full read
        return "ok"
    except (HTTPError, URLError, TimeoutError, OSError) as e:
        if os.path.exists(tmp):
            os.remove(tmp)
        print(f"  ! FAIL {url} ({e})", file=sys.stderr)
        return "fail"


def iter_image_urls(entry: dict, formats: set[str]):
    """Yield every upstream image URL anywhere in an entry (image, image_webp, shop_image*,
    the images{} dict, nested fields): the app links whatever field the API serves, so the
    mirror must hold them all."""
    stack = [entry]
    while stack:
        node = stack.pop()
        if isinstance(node, dict):
            stack.extend(node.values())
        elif isinstance(node, list):
            stack.extend(node)
        elif isinstance(node, str) and node.startswith("http") and "/images/" in node:
            ext = node.split("?", 1)[0].rsplit(".", 1)[-1].lower()
            if ext not in ("png", "webp", "svg", "jpg"):
                continue
            if formats and ext not in formats:
                continue
            yield node


def rel_path(url: str) -> str:
    # .../assets-api-res/images/ranks/rank1/badge_lg.png -> ranks/rank1/badge_lg.png
    url = url.split("?", 1)[0]  # drop any ?query so it never lands in a filename
    return url.split("/images/")[-1] if "/images/" in url else url.rsplit("/", 1)[-1]


def mirror_category(cat: str, out_dir: str, formats: set[str], force: bool) -> dict:
    print(f"\n=== {cat} ===")
    entries = fetch_json(f"{API_BASE}/{cat}")
    cat_dir = os.path.join(out_dir, cat)
    os.makedirs(cat_dir, exist_ok=True)

    # Persist the raw API response as the manifest for this category.
    with open(os.path.join(cat_dir, "manifest.json"), "w") as f:
        json.dump(entries, f, indent=2)

    urls = sorted({u for e in entries for u in iter_image_urls(e, formats)})
    counts = {"skip": 0, "ok": 0, "fail": 0}
    for i, url in enumerate(urls, 1):
        rel = rel_path(url)
        if "." not in os.path.basename(rel):  # skip extensionless junk (e.g. a bare .../image)
            continue
        dest = os.path.join(out_dir, rel)
        status = download(url, dest, force)
        counts[status] += 1
        if status == "ok":
            print(f"  [{i}/{len(urls)}] {rel}")
        time.sleep(0.02)  # be gentle on the upstream
    print(f"{cat}: {len(entries)} entries, "
          f"{counts['ok']} downloaded, {counts['skip']} cached, {counts['fail']} failed")
    return counts


def main() -> int:
    ap = argparse.ArgumentParser(description="Mirror Deadlock assets locally.")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "deadlock"),
                    help="output directory (default: ./deadlock)")
    ap.add_argument("--only", default=",".join(CATEGORIES),
                    help="comma list of categories: ranks,heroes,items")
    ap.add_argument("--formats", default="",
                    help="comma list of extensions to keep, e.g. 'webp' or "
                         "'png,webp'. Empty = all. (single 'image' fields are "
                         "always kept.)")
    ap.add_argument("--force", action="store_true",
                    help="re-download even if the file already exists")
    ap.add_argument("--upload", "--r2", dest="upload", action="store_true",
                    help="after mirroring, run upload_assets.py to sync the tree into R2 "
                         "(needs R2_* creds; see upload_assets.py)")
    args = ap.parse_args()

    cats = [c.strip() for c in args.only.split(",") if c.strip()]
    formats = {f.strip().lower() for f in args.formats.split(",") if f.strip()}

    total = {"skip": 0, "ok": 0, "fail": 0}
    for cat in cats:
        if cat not in CATEGORIES:
            print(f"unknown category: {cat}", file=sys.stderr)
            return 2
        c = mirror_category(cat, args.out, formats, args.force)
        for k in total:
            total[k] += c[k]

    print(f"\nTOTAL: {total['ok']} downloaded, {total['skip']} cached, "
          f"{total['fail']} failed -> {args.out}")

    # A handful of upstream 404s (retired heroes) must not block the deploy; a real outage
    # (many failures, or nothing fetched) still fails the run so the bundle is never shipped.
    attempted = total["ok"] + total["skip"] + total["fail"]
    outage = total["fail"] and (total["ok"] + total["skip"] == 0 or total["fail"] * 50 > attempted)
    mirror_rc = 1 if outage else 0

    #--upload: chain into the R2 sync so one command = re-mirror then re-sync. The
    #uploader works on the assets ROOT (this script's dir), which holds both the
    #deadlock/ tree (heroes/items/abilities) and the ranks/ tree.
    if args.upload:
        uploader = os.path.join(os.path.dirname(os.path.abspath(__file__)), "upload_assets.py")
        print(f"\n=== --upload: syncing mirror into R2 via {uploader} ===")
        up_rc = subprocess.run(
            [sys.executable, uploader, "--root", os.path.dirname(os.path.abspath(__file__))]
        ).returncode
        #surface either failure; the mirror already kept last-good files regardless.
        return mirror_rc or up_rc

    # Non-zero exit if anything failed, so a CronJob surfaces it (but the
    # already-mirrored good files are untouched).
    return mirror_rc


if __name__ == "__main__":
    sys.exit(main())
