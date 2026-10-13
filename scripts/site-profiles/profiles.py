"""Read and write docs/site-matrix/sites.yaml, the single file that holds every site profile.

The file is written by the Site Matrix app (tools/site-matrix, js-yaml) and by these scripts
(PyYAML). Both produce the same bytes, so a save only changes the lines that changed.
"""
import os

import yaml

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MATRIX = os.path.join(ROOT, "docs", "site-matrix")
SITES_FILE = os.path.join(MATRIX, "sites.yaml")

# Top-level keys, in file order.
DOC_ORDER = ["version", "how_to_apply", "sites", "catalog"]
# Keys of one site, in file order; `detected` always goes last.
ORDER = ["name", "country", "status", "phase", "milestones", "registration", "locations", "services",
         "needs", "form_notes", "custom_forms", "integration", "open_items", "notes", "detected"]

HEADER = """\
# LIME EMR site matrix: the setup and plans of every site, in one file.
#
# Written by the Site Matrix app (tools/site-matrix), where each save is a commit by the person who
# made it, and by scripts/site-profiles/extract.py, which refreshes each site's `detected` block.
#
# Under `sites`, one entry per site, keyed by its id (the folder name under sites/ once it exists):
#   - everything above `detected` is decided by people: status, dates, patient ID and registration,
#     needed forms and modules (`needs`), DHIS2 reporting, notes;
#   - `detected` is what the repo configures today. It is generated: do not edit it by hand.
# Work still to do for a site = what its decisions ask for that `detected` does not show yet.
# `how_to_apply` says where each item is configured in the repo. `catalog` lists the shared forms
# (distro ampathforms) with their program, and the key modules with their frontend apps.
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


def _ordered_site(site):
    site = {k: v for k, v in site.items() if k not in ("id", "body")}
    out = {k: site[k] for k in ORDER if k in site and k != "detected"}
    out.update({k: v for k, v in site.items() if k not in out and k != "detected"})
    if "detected" in site:
        out["detected"] = site["detected"]
    return out


def load_doc():
    if not os.path.exists(SITES_FILE):
        return {"version": 1, "sites": {}, "catalog": {"forms": [], "modules": []}}
    doc = _plain(yaml.safe_load(open(SITES_FILE, encoding="utf-8")) or {})
    doc.setdefault("sites", {})
    doc.setdefault("catalog", {"forms": [], "modules": []})
    return doc


def render_doc(doc):
    out = {k: doc[k] for k in DOC_ORDER if k in doc}
    out.update({k: v for k, v in doc.items() if k not in out})
    out["sites"] = {sid: _ordered_site(s) for sid, s in (doc.get("sites") or {}).items()}
    return HEADER + yaml.dump(out, Dumper=_Dumper, sort_keys=False, allow_unicode=True, width=100000, default_flow_style=False)


def save_doc(doc):
    os.makedirs(MATRIX, exist_ok=True)
    with open(SITES_FILE, "w", encoding="utf-8") as fh:
        fh.write(render_doc(doc))


def load_all(doc=None):
    """Every site as a dict with its `id`."""
    doc = doc or load_doc()
    return [dict(s, id=sid) for sid, s in (doc.get("sites") or {}).items()]


def catalog(doc=None):
    return (doc or load_doc()).get("catalog") or {"forms": [], "modules": []}
