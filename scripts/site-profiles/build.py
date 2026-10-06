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
import sys

import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from profiles import LIBRARY, MATRIX, load_all  # noqa: E402

TEMPLATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "template.html")
STATUS_ORDER = {"live": 0, "preparation": 1, "planned": 2, "closed": 3}
DOC_HEAD = ('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n')


def data():
    lib = yaml.safe_load(open(LIBRARY, encoding="utf-8"))
    sites = sorted(load_all(), key=lambda s: (STATUS_ORDER.get(s.get("status"), 9), s.get("name") or s["id"]))
    commits = [s["detected"]["source_commit"] for s in sites if s.get("detected", {}).get("source_commit")]
    return {
        "built_at": datetime.date.today().isoformat(),
        "source_commit": commits[0] if commits else None,
        "library": lib,
        "sites": sites,
    }


def render(fragment):
    payload = json.dumps(data(), ensure_ascii=False, default=str).replace("</", "<\\/")
    page = open(TEMPLATE, encoding="utf-8").read().replace("__LIME_DATA__", payload)
    return page if fragment else DOC_HEAD + page + "\n</body>\n</html>\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--artifact", help="also write a page fragment (no <html>/<head>) for publishing as a Claude artifact")
    args = ap.parse_args()
    out = os.path.join(MATRIX, "index.html")
    open(out, "w", encoding="utf-8").write(render(False))
    print("wrote " + os.path.relpath(out))
    if args.artifact:
        open(args.artifact, "w", encoding="utf-8").write(render(True))
        print("wrote " + args.artifact)


if __name__ == "__main__":
    main()
