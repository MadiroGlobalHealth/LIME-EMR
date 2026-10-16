#!/usr/bin/env python3
"""Write tools/site-matrix/src/snapshot.json, the copy of docs/site-matrix/sites.yaml that the
site matrix app shows when GitHub cannot be reached.

    python3 scripts/site-profiles/build.py                  # app reads and saves on the current branch
    python3 scripts/site-profiles/build.py --branch main
"""
import argparse
import datetime
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from profiles import ROOT, SITES_FILE  # noqa: E402

APP_SNAPSHOT = os.path.join(ROOT, "tools", "site-matrix", "src", "snapshot.json")


def git(*args):
    try:
        return subprocess.check_output(["git", "-C", ROOT] + list(args), text=True).strip()
    except Exception:
        return ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--branch", help="branch the app reads sites.yaml from and commits to (default: current branch)")
    ap.add_argument("--owner", help="GitHub owner (default: from the origin remote)")
    ap.add_argument("--repo", help="GitHub repository (default: from the origin remote)")
    args = ap.parse_args()
    m = re.search(r"github\.com[:/]([^/]+)/([^/.]+)", git("remote", "get-url", "origin"))
    snapshot = {
        "built_at": datetime.date.today().isoformat(),
        "source_commit": git("rev-parse", "--short", "HEAD") or None,
        "repo": {
            "owner": args.owner or (m.group(1) if m else ""),
            "repo": args.repo or (m.group(2) if m else ""),
            "branch": args.branch or git("rev-parse", "--abbrev-ref", "HEAD") or "main",
            "file": os.path.relpath(SITES_FILE, ROOT),
        },
        "text": open(SITES_FILE, encoding="utf-8").read(),
    }
    with open(APP_SNAPSHOT, "w", encoding="utf-8") as fh:
        json.dump(snapshot, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print("wrote %s (%s/%s @ %s)" % (os.path.relpath(APP_SNAPSHOT, ROOT), snapshot["repo"]["owner"], snapshot["repo"]["repo"], snapshot["repo"]["branch"]))


if __name__ == "__main__":
    main()
