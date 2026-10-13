#!/usr/bin/env python3
"""List, per site, what is needed but not built yet and what is built but marked not needed.

    python3 scripts/site-profiles/gaps.py           # all sites
    python3 scripts/site-profiles/gaps.py mombasa   # one site

Use it to turn site needs into implementation tickets.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from profiles import catalog, load_all, load_doc  # noqa: E402


def expand(codes):
    out = []
    for c in codes or []:
        m = re.fullmatch(r"F(\d+)-F(\d+)", c)
        out += ["F%02d" % i for i in range(int(m.group(1)), int(m.group(2)) + 1)] if m else [c]
    return set(out)


def main(argv):
    doc = load_doc()
    lib = catalog(doc)
    names = {f["code"]: f["name"] for f in lib["forms"]}
    mods = {m["id"]: m["name"] for m in lib["modules"]}
    for s in load_all(doc):
        if argv and s["id"] not in argv:
            continue
        det = s.get("detected") or {}
        forms = s.get("forms") or {}
        fneeds = {c: d.get("need") for c, d in forms.items() if not d.get("custom")}
        mneeds = s.get("modules") or {}
        built_f, built_m = expand(det.get("forms")), set(det.get("modules") or [])
        todo = [c for c, n in sorted(fneeds.items()) if n == "needed" and c not in built_f]
        new = [d.get("name") or c for c, d in forms.items() if d.get("custom") and (d.get("need") or "needed") == "needed"]
        todo_m = [m for m, n in sorted(mneeds.items()) if n == "needed" and m not in built_m]
        remove = [c for c, n in sorted(fneeds.items()) if n == "not_needed" and c in built_f]
        remove_m = [m for m, n in sorted(mneeds.items()) if n == "not_needed" and m in built_m]
        integ = (s.get("integrations") or {}).get("dhis2") or {}
        dhis2 = integ.get("need") == "needed" and not (det.get("integration") or {}).get("status") == "live"
        if not (todo or new or todo_m or remove or remove_m or dhis2):
            continue
        print("## %s (%s)" % (s.get("name"), s.get("status")))
        for c in todo:
            print("- [ ] Add library form %s %s" % (c, names.get(c, "")))
        for n in new:
            print("- [ ] Build new site-specific form: %s" % n)
        for m in todo_m:
            print("- [ ] Enable module: %s" % mods.get(m, m))
        if dhis2:
            print("- [ ] Set up DHIS2 sync (OpenFn)%s" % (": " + integ["target"] if integ.get("target") else ""))
        for c in remove:
            print("- [ ] Remove form %s %s (built, marked not needed)" % (c, names.get(c, "")))
        for m in remove_m:
            print("- [ ] Remove module: %s (built, marked not needed)" % mods.get(m, m))
        print()


if __name__ == "__main__":
    main(sys.argv[1:])
