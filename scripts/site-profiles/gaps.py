#!/usr/bin/env python3
"""The work still to do per site: what its decisions in sites.yaml ask for that `detected` does not show yet.

    python3 scripts/site-profiles/gaps.py                 # checklist for every site
    python3 scripts/site-profiles/gaps.py mombasa         # one site
    python3 scripts/site-profiles/gaps.py --json [site]   # the same as JSON, for an AI implementer or a tracker

Each task has a stable id (<site>/<kind>/<item>), the step from `how_to_apply` that says where to make
the change, and a `done_when` condition that extract.py makes true once the change is in the repo.
Sites are sorted by their next milestone date, overdue ones first.
"""
import datetime
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from profiles import catalog, load_all, load_doc  # noqa: E402

FORMAT = 1


def expand(codes):
    out = []
    for c in codes or []:
        m = re.fullmatch(r"F(\d+)-F(\d+)", c)
        out += ["F%02d" % i for i in range(int(m.group(1)), int(m.group(2)) + 1)] if m else [c]
    return set(out)


def milestones(site, labels, today):
    """Upcoming or overdue milestones that are not done, with their day count from today."""
    out = []
    for mid, m in (site.get("milestones") or {}).items():
        m = m or {}
        date = m.get("date")
        if m.get("done") or not date or len(date) != 10:
            continue
        days = (datetime.date.fromisoformat(date) - today).days
        out.append({"id": mid, "label": labels.get(mid, mid), "date": date, "days": days, "overdue": days < 0})
    return sorted(out, key=lambda m: m["date"])


def site_tasks(s, lib, how):
    names = {f["code"]: f["name"] for f in lib["forms"]}
    mods = {m["id"]: m["name"] for m in lib["modules"]}
    sid = s["id"]
    det = s.get("detected") or {}
    has_folder = bool(det.get("site_folder"))
    forms = s.get("forms") or {}
    fneeds = {c: d.get("need") for c, d in forms.items() if not d.get("custom")}
    built_f, built_m = expand(det.get("forms")), set(det.get("modules") or [])
    reg, dreg = s.get("registration") or {}, det.get("registration") or {}
    out = []

    def task(kind, item, action, title, how_key, done_when, **extra):
        t = {"id": "%s/%s/%s" % (sid, kind, item), "site": sid, "kind": kind, "item": item, "action": action,
             "title": title, "how": how.get(how_key), "done_when": done_when}
        if not has_folder and kind != "site":
            t["depends_on"] = ["%s/site/folder" % sid]
        t.update({k: v for k, v in extra.items() if v})
        out.append(t)

    if s.get("status") in ("preparation", "live") and not has_folder:
        note = None
        if s.get("forms_default") == "not_needed":
            note = "forms_default is not_needed: in the new pom.xml exclude every form and include only the needed ones."
        task("site", "folder", "create", "Create the sites/%s folder" % sid, "new_site",
             "detected.site_folder is set", note=note)

    for c, n in sorted(fneeds.items()):
        if n == "needed" and c not in built_f:
            task("form", c, "add", "Add form %s %s" % (c, names.get(c, "")), "forms",
                 "%s is in detected.forms" % c, note=forms[c].get("note"))
    for c, d in forms.items():
        if d.get("custom") and (d.get("need") or "needed") == "needed":
            task("custom_form", c, "build", "Build the site-specific form %s" % d.get("name"), "custom_forms",
                 "%s is replaced by a library code that is in detected.forms" % c,
                 note=d.get("note"), program=d.get("program"))
    if has_folder:
        for c in sorted(built_f):
            n = fneeds.get(c) or (None if c in forms else s.get("forms_default"))
            if n == "not_needed":
                task("form", c, "remove", "Remove form %s %s (built, marked not needed)" % (c, names.get(c, "")),
                     "forms", "%s is not in detected.forms" % c, note=(forms.get(c) or {}).get("note"))

    for m, n in sorted((s.get("modules") or {}).items()):
        if n == "needed" and has_folder and m not in built_m:
            task("module", m, "enable", "Enable module %s" % mods.get(m, m), "modules", "%s is in detected.modules" % m)
        if n == "not_needed" and (m in built_m or not has_folder):
            task("module", m, "disable", "Turn off module %s" % mods.get(m, m), "modules",
                 "%s is not in detected.modules" % m)

    if reg.get("id_prefix") and reg["id_prefix"] != dreg.get("id_prefix"):
        task("registration", "id_prefix", "set", "Set the MSF ID prefix to %s" % reg["id_prefix"],
             "registration.id_prefix", "detected.registration.id_prefix is %s" % reg["id_prefix"],
             current=dreg.get("id_prefix"))
    missing = [x for x in reg.get("languages") or [] if x not in (dreg.get("languages") or [])]
    if missing:
        task("registration", "languages", "set", "Offer the languages %s" % ", ".join(reg["languages"]),
             "registration.languages", "detected.registration.languages has %s" % ", ".join(reg["languages"]),
             current=dreg.get("languages"))
    known = {i.get("name") for i in dreg.get("identifiers") or []}
    for i in reg.get("identifiers") or []:
        if i.get("name") not in known:
            task("registration", "identifier-" + re.sub(r"[^a-z0-9]+", "-", i["name"].lower()).strip("-"), "add",
                 "Ask for the identifier %s at registration" % i["name"], "registration.identifiers",
                 "%s is in detected.registration.identifiers" % i["name"], spec=i)
    if reg.get("custom_form") and not has_folder:
        # Not detectable from the repo yet, so only listed while the site is being set up.
        task("registration", "custom_form", "build", "Build the site's own registration form", "registration.extra_fields",
             "the registration config in sites/%s is site-specific (checked by a person)" % sid,
             note="; ".join(reg.get("extra_fields") or []))
    have = set(det.get("locations") or [])
    for loc in s.get("locations") or []:
        if not any(loc == h or h.startswith(loc + " ") for h in have):
            task("location", re.sub(r"[^a-z0-9]+", "-", loc.lower()).strip("-"), "add", "Add the location %s" % loc,
                 "locations", "%s is in detected.locations" % loc)

    for iid, i in (s.get("integrations") or {}).items():
        i = i or {}
        if iid == "dhis2" and i.get("need") == "needed" and (det.get("integration") or {}).get("status") != "live":
            task("integration", iid, "set_up", "Set up DHIS2 reporting (OpenFn)" + (": " + i["target"] if i.get("target") else ""),
                 "integrations.dhis2", "detected.integration.status is live", note=i.get("note"))
    return out


def plan(doc=None, only=(), today=None):
    doc = doc or load_doc()
    today = today or datetime.date.today()
    lib, how = catalog(doc), doc.get("how_to_apply") or {}
    labels = {v["id"]: v["label"] for v in (doc.get("vocab") or {}).get("milestones") or []}
    sites = []
    for s in load_all(doc):
        if only and s["id"] not in only:
            continue
        tasks = site_tasks(s, lib, how)
        if not tasks:
            continue
        ms = milestones(s, labels, today)
        sites.append({"id": s["id"], "name": s.get("name"), "org": s.get("org"), "status": s.get("status"),
                      "next_milestone": ms[0] if ms else None, "tasks": tasks})
    sites.sort(key=lambda x: (x["next_milestone"] or {}).get("date") or "9999")
    return {"format": FORMAT, "date": today.isoformat(), "sites": sites}


def days(n):
    return "%d day%s" % (n, "" if n == 1 else "s")


def main(argv):
    as_json = "--json" in argv
    p = plan(only=[a for a in argv if not a.startswith("--")])
    if as_json:
        print(json.dumps(p, indent=2, ensure_ascii=False))
        return
    for s in p["sites"]:
        nm = s["next_milestone"]
        when = ""
        if nm:
            when = ", %s %s (%s)" % (nm["label"], nm["date"], days(-nm["days"]) + " overdue" if nm["overdue"] else "in " + days(nm["days"]))
        print("## %s (%s%s)" % (s["name"], s["status"], when))
        for t in s["tasks"]:
            print("- [ ] %s%s" % (t["title"], "  [after %s]" % ", ".join(t["depends_on"]) if t.get("depends_on") else ""))
        print()


if __name__ == "__main__":
    main(sys.argv[1:])
