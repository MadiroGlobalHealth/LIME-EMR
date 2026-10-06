#!/usr/bin/env python3
"""Apply choices made in the site matrix page to the site profiles.

The page stores one document per site in its `edits` collection:
    {"site": "mombasa", "new": {...} | null,
     "changes": {"needs.forms.F11": {"value": "needed", "by": "<user id>", "at": 1760000000000}, ...}}

Save the collection (ArtifactData `list` on `edits`) to a JSON file, then:

    python3 scripts/site-profiles/apply_edits.py edits.json --dry-run
    python3 scripts/site-profiles/apply_edits.py edits.json

A value of null removes the field (back to "no decision"). Paths under
`detected` are refused: that block only comes from the repo.
"""
import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from profiles import load_profile, save_profile  # noqa: E402

ALLOWED = ("name", "country", "status", "phase", "milestones.", "registration.", "locations", "services",
           "needs.", "form_notes.", "custom_forms", "integration.", "open_items", "notes")


def docs_from(payload):
    if isinstance(payload, dict):
        payload = payload.get("docs") or payload.get("documents") or payload.get("items") or list(payload.values())
    out = []
    for d in payload:
        body = d.get("data", d) if isinstance(d, dict) else {}
        if isinstance(body, dict) and ("changes" in body or "new" in body):
            body = dict(body)
            body.setdefault("site", d.get("id"))
            out.append(body)
    return out


def set_path(obj, path, value):
    keys = path.split(".")
    for k in keys[:-1]:
        if not isinstance(obj.get(k), dict):
            obj[k] = {}
        obj = obj[k]
    if value is None:
        obj.pop(keys[-1], None)
    else:
        obj[keys[-1]] = value


def get_path(obj, path):
    for k in path.split("."):
        if not isinstance(obj, dict) or k not in obj:
            return None
        obj = obj[k]
    return obj


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("edits", help="JSON export of the page's `edits` collection")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    total = 0
    for doc in docs_from(json.load(open(args.edits, encoding="utf-8"))):
        sid = doc.get("site")
        if not sid or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", sid):
            print("skip document with invalid site id: %r" % sid)
            continue
        meta, body = load_profile(sid)
        if not meta:
            new = doc.get("new") or {}
            meta = {"id": sid, "name": new.get("name") or sid, "country": new.get("country"),
                    "status": new.get("status") or "planned", "phase": new.get("phase")}
            print("%s: new site profile" % sid)
        changes = doc.get("changes") or {}
        for path in sorted(changes):
            if path.startswith("detected") or not path.startswith(ALLOWED):
                print("%s: refused path %s" % (sid, path))
                continue
            value = changes[path].get("value") if isinstance(changes[path], dict) else changes[path]
            before = get_path(meta, path)
            if before == value:
                continue
            print("%s: %s: %s -> %s" % (sid, path, json.dumps(before), json.dumps(value)))
            set_path(meta, path, value)
            total += 1
        if not args.dry_run:
            save_profile(sid, meta, body)
    print("%d change(s) %s" % (total, "to apply (dry run)" if args.dry_run else "applied"))


if __name__ == "__main__":
    main()
