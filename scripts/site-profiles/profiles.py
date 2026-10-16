"""Read and write docs/site-matrix/sites.yaml, the single file that holds every site profile.

The file is written by the Site Matrix app (tools/site-matrix, js-yaml) and by these scripts
(PyYAML). Both produce the same bytes, so a save only changes the lines that changed.
"""
import json
import os
import sys

import yaml

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MATRIX = os.path.join(ROOT, "docs", "site-matrix")
SITES_FILE = os.path.join(MATRIX, "sites.yaml")
SCHEMA_FILE = os.path.join(MATRIX, "sites.schema.json")

VERSION = 2
# Top-level keys, in file order.
DOC_ORDER = ["version", "orgs", "vocab", "how_to_apply", "sites", "catalog"]
# Keys of one site, in file order; other keys (x-...) follow; `detected` always goes last.
ORDER = ["name", "org", "country", "status", "phase", "focal_point", "reviewed", "environments", "milestones",
         "registration", "locations", "services", "forms_default", "forms", "modules", "integrations",
         "open_items", "notes", "detected"]

HEADER = """\
# yaml-language-server: $schema=sites.schema.json
# LIME EMR site matrix: the setup and plans of every site, in one file.
#
# Written by the Site Matrix app (tools/site-matrix), where each save is a commit by the person who
# made it, and by scripts/site-profiles/extract.py, which refreshes each site's `detected` block.
#
# Under `sites`, one entry per site, keyed by its id (the folder name under sites/ once it exists):
#   - everything above `detected` is decided by people: organisation, status, dates, patient ID and
#     registration, forms and modules needed, integrations (DHIS2...), notes;
#   - `detected` is what the repo configures today. It is generated: do not edit it by hand.
# Work still to do for a site = what its decisions ask for that `detected` does not show yet.
# `orgs` lists the organisations running sites; `vocab` the milestones and integrations to track.
# `how_to_apply` says where each item is configured in the repo. `catalog` lists the shared forms
# (distro ampathforms) with their program, and the key modules with their frontend apps.
# Allowed values: sites.schema.json. Keys starting with x- are free extensions.
"""


class _Dumper(yaml.SafeDumper):
    """Matches js-yaml's dump() used by the app: indented lists, no line folding."""

    def ignore_aliases(self, data):
        return True

    def increase_indent(self, flow=False, indentless=False):
        return super().increase_indent(flow, False)


def _str(dumper, value):
    style = "|" if "\n" in value else ("'" if value.isdigit() else None)
    return dumper.represent_scalar("tag:yaml.org,2002:str", value, style=style)


_Dumper.add_representer(str, _str)


def _plain(value):
    """Turn YAML dates into ISO strings so the data round-trips as JSON."""
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_plain(v) for v in value]
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def expand_forms(site):
    """In memory every form decision is an object: `F11: needed` becomes `F11: {need: needed}`."""
    forms = site.get("forms")
    if isinstance(forms, dict):
        site["forms"] = {c: (v if isinstance(v, dict) else {"need": v}) for c, v in forms.items()}
    return site


def collapse_forms(site):
    """In the file a decision with only a need is written short (`F11: needed`); empty ones are dropped."""
    out = {}
    for code, v in (site.get("forms") or {}).items():
        v = {k: x for k, x in v.items() if x is not None} if isinstance(v, dict) else v
        if isinstance(v, dict) and list(v) == ["need"]:
            v = v["need"]
        if v:
            out[code] = v
    site = dict(site)
    if out:
        site["forms"] = out
    else:
        site.pop("forms", None)
    return site


def _ordered_site(site):
    site = collapse_forms({k: v for k, v in site.items() if k not in ("id", "body")})
    out = {k: site[k] for k in ORDER if k in site and k != "detected"}
    out.update({k: v for k, v in site.items() if k not in out and k != "detected"})
    if "detected" in site:
        out["detected"] = site["detected"]
    return out


def load_doc(path=SITES_FILE):
    if not os.path.exists(path):
        return {"version": VERSION, "orgs": {}, "vocab": {"milestones": [], "integrations": []}, "sites": {},
                "catalog": {"forms": [], "modules": []}}
    doc = _plain(yaml.safe_load(open(path, encoding="utf-8")) or {})
    doc.setdefault("sites", {})
    for s in doc["sites"].values():
        expand_forms(s)
    doc.setdefault("catalog", {"forms": [], "modules": []})
    return doc


def render_doc(doc):
    out = {k: doc[k] for k in DOC_ORDER if k in doc}
    out.update({k: v for k, v in doc.items() if k not in out})
    out["sites"] = {sid: _ordered_site(s) for sid, s in (doc.get("sites") or {}).items()}
    return HEADER + yaml.dump(out, Dumper=_Dumper, sort_keys=False, allow_unicode=True, width=100000, default_flow_style=False)


def problems(doc):
    """Schema errors, then references that the schema cannot check (catalog, orgs, vocab)."""
    out = []
    file_view = dict(doc, sites={sid: _ordered_site(s) for sid, s in (doc.get("sites") or {}).items()})
    try:
        import jsonschema
    except ImportError:
        print("warning: install jsonschema (pip install jsonschema) to check sites.yaml against its schema", file=sys.stderr)
    else:
        validator = jsonschema.Draft202012Validator(json.load(open(SCHEMA_FILE, encoding="utf-8")))
        for e in sorted(validator.iter_errors(file_view), key=lambda e: [str(p) for p in e.absolute_path]):
            out.append("%s: %s" % ("/".join(str(p) for p in e.absolute_path) or "(top)", e.message))
    cat = doc.get("catalog") or {}
    vocab = doc.get("vocab") or {}
    forms = {f.get("code") for f in cat.get("forms") or []}
    modules = {m.get("id") for m in cat.get("modules") or []}
    orgs = set(doc.get("orgs") or {})
    milestones = {v.get("id") for v in vocab.get("milestones") or []}
    integrations = {v.get("id") for v in vocab.get("integrations") or []}
    for sid, s in (doc.get("sites") or {}).items():
        s = s or {}
        if s.get("org") and s["org"] not in orgs:
            out.append("sites/%s: org %s is not in orgs" % (sid, s["org"]))
        for code, d in (s.get("forms") or {}).items():
            custom = isinstance(d, dict) and d.get("custom")
            if not custom and code not in forms:
                out.append("sites/%s: form %s is not in catalog.forms (site-specific forms need custom: true)" % (sid, code))
            if custom and code in forms:
                out.append("sites/%s: site-specific form %s uses a library code" % (sid, code))
        for mod in s.get("modules") or {}:
            if mod not in modules:
                out.append("sites/%s: module %s is not in catalog.modules" % (sid, mod))
        for m in s.get("milestones") or {}:
            if m not in milestones:
                out.append("sites/%s: milestone %s is not in vocab.milestones" % (sid, m))
        for i in s.get("integrations") or {}:
            if i not in integrations:
                out.append("sites/%s: integration %s is not in vocab.integrations" % (sid, i))
    return out


def save_doc(doc):
    errors = problems(doc)
    if errors:
        raise ValueError("sites.yaml would be invalid, not written:\n  " + "\n  ".join(errors))
    os.makedirs(MATRIX, exist_ok=True)
    with open(SITES_FILE, "w", encoding="utf-8") as fh:
        fh.write(render_doc(doc))


def load_all(doc=None):
    """Every site as a dict with its `id`."""
    doc = doc or load_doc()
    return [dict(s, id=sid) for sid, s in (doc.get("sites") or {}).items()]


def catalog(doc=None):
    return (doc or load_doc()).get("catalog") or {"forms": [], "modules": []}
