#!/usr/bin/env python3
"""Render the site matrix page from the profiles.

    python3 scripts/site-profiles/build.py                      # docs/site-matrix/index.html
    python3 scripts/site-profiles/build.py --artifact out.html  # also a page fragment for a Claude artifact

The page is scripts/site-profiles/template.html with the catalog and every
profile embedded as JSON. Requires PyYAML.
"""
import argparse
import datetime
import json
import os
import re
import subprocess
import sys

import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from profiles import LIBRARY, MATRIX, PROFILES, ROOT, load_all  # noqa: E402

TEMPLATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "template.html")
STATUS_ORDER = {"live": 0, "preparation": 1, "planned": 2, "closed": 3}
DOC_HEAD = ('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n')


def git(*args):
    try:
        return subprocess.check_output(["git", "-C", ROOT] + list(args), text=True).strip()
    except Exception:
        return ""


def repo_config(args):
    m = re.search(r"github\.com[:/]([^/]+)/([^/.]+)", git("remote", "get-url", "origin"))
    return {
        "owner": args.owner or (m.group(1) if m else ""),
        "repo": args.repo or (m.group(2) if m else ""),
        "branch": args.branch or git("rev-parse", "--abbrev-ref", "HEAD") or "main",
        "dir": os.path.relpath(PROFILES, ROOT),
        "library": os.path.relpath(LIBRARY, ROOT),
    }


def data(repo):
    lib = yaml.safe_load(open(LIBRARY, encoding="utf-8"))
    sites = sorted(load_all(), key=lambda s: (STATUS_ORDER.get(s.get("status"), 9), s.get("name") or s["id"]))
    commits = [s["detected"]["source_commit"] for s in sites if s.get("detected", {}).get("source_commit")]
    return {
        "built_at": datetime.date.today().isoformat(),
        "repo": repo,
        "source_commit": commits[0] if commits else None,
        "library": lib,
        "sites": sites,
    }


def render(fragment, repo):
    payload = json.dumps(data(repo), ensure_ascii=False, default=str).replace("</", "<\\/")
    page = open(TEMPLATE, encoding="utf-8").read().replace("__LIME_DATA__", payload)
    return page if fragment else DOC_HEAD + page + "\n</body>\n</html>\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--artifact", help="also write a page fragment (no <html>/<head>) for publishing as a Claude artifact")
    ap.add_argument("--branch", help="branch the page reads profiles from and commits to (default: current branch)")
    ap.add_argument("--owner", help="GitHub owner (default: from the origin remote)")
    ap.add_argument("--repo", help="GitHub repository (default: from the origin remote)")
    args = ap.parse_args()
    repo = repo_config(args)
    out = os.path.join(MATRIX, "index.html")
    open(out, "w", encoding="utf-8").write(render(False, repo))
    print("wrote %s (profiles from %s/%s @ %s)" % (os.path.relpath(out), repo["owner"], repo["repo"], repo["branch"]))
    if args.artifact:
        open(args.artifact, "w", encoding="utf-8").write(render(True, repo))
        print("wrote " + args.artifact)


if __name__ == "__main__":
    main()
