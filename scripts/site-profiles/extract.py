#!/usr/bin/env python3
"""Extract what each LIME site actually configures and write it into its profile.

For every folder under sites/, reads the build and configuration files and
writes the result under the `detected:` key of docs/site-matrix/profiles/<site>.md.
Everything else in a profile (status, milestones, needs, notes) is maintained by
people and is left untouched. Profiles that do not exist yet are created.

    python3 scripts/site-profiles/extract.py            # all sites
    python3 scripts/site-profiles/extract.py mosul      # one site

Requires PyYAML.
"""
import csv
import datetime
import glob
import hashlib
import json
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from profiles import ROOT, LIBRARY, load_profile, save_profile, profile_path  # noqa: E402

DISTRO = os.path.join(ROOT, "distro", "configs")
INIT = os.path.join("configs", "openmrs", "initializer_config")
MSF_ID_TYPE = "05a29f94-c0ed-11e2-94be-8c13b969e334"
FORM_CODE = re.compile(r"\b(F\d{2})[-_ ]")
CORE_FIELDS = {"name", "gender", "dob", "id", "address"}
ADDRESS_LABELS = {
    "country": "Country", "stateProvince": "State/Province", "countyDistrict": "District",
    "cityVillage": "City/Village", "address1": "Address 1", "address2": "Address 2",
    "postalCode": "Postal code",
}


def rel(path):
    return os.path.relpath(path, ROOT)


def read_csv(pattern):
    rows = []
    for f in sorted(glob.glob(pattern)):
        with open(f, encoding="utf-8-sig") as fh:
            rows += list(csv.DictReader(fh))
    return rows


def git_commit():
    try:
        return subprocess.check_output(["git", "-C", ROOT, "rev-parse", "--short", "HEAD"], text=True).strip()
    except Exception:
        return None


def expand_codes(codes):
    """Collapse sorted F-codes into ranges: F29,F30,F31 -> F29-F31."""
    nums = sorted({int(c[1:]) for c in codes if re.fullmatch(r"F\d{2}", c)})
    head = ["F00"] if "F00" in codes else []
    nums = [n for n in nums if n]
    out, start = head, None
    for i, n in enumerate(nums):
        if start is None:
            start = n
        if i + 1 == len(nums) or nums[i + 1] != n + 1:
            out.append("F%02d" % start if start == n else "F%02d-F%02d" % (start, n))
            start = None
    return out


# ---------------------------------------------------------------- forms

def distro_forms():
    forms = {}
    for f in sorted(glob.glob(os.path.join(DISTRO, "openmrs", "initializer_config", "ampathforms", "*.json"))):
        m = re.match(r"(F\d{2})-", os.path.basename(f))
        if not m:
            continue
        try:
            name = json.load(open(f, encoding="utf-8")).get("name") or ""
        except Exception:
            name = ""
        forms.setdefault(m.group(1), {"file": os.path.basename(f), "name": name})
    return forms


def site_forms(pom_text, all_forms):
    includes = re.findall(r"<include>[^<]*ampathforms/[^<]*?/(F\d{2})[^<]*\.json</include>", pom_text)
    excludes_all = re.search(r"<exclude>[^<]*ampathforms/\*\*/\*\.\*</exclude>", pom_text)
    if excludes_all:
        return sorted(set(includes))
    excluded = set(re.findall(r"<exclude>[^<]*ampathforms/[^<]*?/(F\d{2})[^<]*\.json</exclude>", pom_text))
    return sorted(set(all_forms) - excluded)


# ---------------------------------------------------------------- modules

def site_modules(pom_text):
    spa = json.load(open(os.path.join(DISTRO, "openmrs", "frontend_assembly", "spa-assemble-config.json")))
    apps = set(spa.get("frontendModules", {})) - set(spa.get("frontendModuleExcludes", []))
    m = re.search(r"<name>modulesToRemove</name>\s*<value>([^<]*)</value>", pom_text)
    removed = {a.strip() for a in m.group(1).split(",")} if m else set()
    apps -= removed
    lib = yaml.safe_load(open(LIBRARY))
    return [mod["id"] for mod in lib["modules"] if any(a in apps for a in mod["apps"])], sorted(removed)


# ---------------------------------------------------------------- registration

def humanize(field_id):
    words = re.sub(r"([a-z])([A-Z0-9])", r"\1 \2", field_id).replace("_", " ").lower()
    return words[:1].upper() + words[1:]


def registration(site_dir):
    reg = {}
    idgen = read_csv(os.path.join(site_dir, INIT, "idgen", "*.csv"))
    gen = next((r for r in idgen if r.get("Identifier type") == "MSF ID"), idgen[0] if idgen else None)
    if gen:
        prefix = (gen.get("Prefix") or "").strip()
        reg["id_prefix"] = prefix
        reg["id_example"] = prefix + "1024" + (gen.get("Suffix") or "")
        reg["id_charset"] = gen.get("Base character set")

    # Identifier types shown at registration, named from site overrides then distro
    types = {}
    for r in read_csv(os.path.join(DISTRO, "openmrs", "initializer_config", "patientidentifiertypes", "*.csv")):
        types[r["Uuid"]] = r
    for r in read_csv(os.path.join(site_dir, INIT, "patientidentifiertypes", "*.csv")):
        types[r["Uuid"]] = r
    fe = glob.glob(os.path.join(site_dir, "configs", "openmrs", "frontend_config", "*.json"))
    regcfg, labels = {}, False
    if fe:
        cfg = json.load(open(fe[0], encoding="utf-8"))
        regcfg = cfg.get("@openmrs/esm-patient-registration-app", {})
        labels = '"showPrintIdentifierStickerButton": true' in open(fe[0], encoding="utf-8").read()
    others = []
    for uuid in regcfg.get("defaultPatientIdentifierTypes", []):
        if uuid == MSF_ID_TYPE or uuid not in types:
            continue
        t = types[uuid]
        txt = t.get("Name", "").strip()
        bits = ["required" if str(t.get("Required", "")).upper() == "TRUE" else "optional"]
        if (t.get("Format description") or "").strip():
            bits.append(t["Format description"].strip())
        others.append("%s (%s)" % (txt, ", ".join(bits)))
    reg["other_ids"] = others

    fields, emergency = [], 0
    for sec in regcfg.get("sectionDefinitions", []):
        for f in sec.get("fields", []):
            if f in CORE_FIELDS:
                continue
            if f.startswith("emergencycontact"):
                if f.endswith("firstName"):
                    emergency += 1
                continue
            fields.append(humanize(f))
    if emergency:
        fields.append("%d emergency contact%s" % (emergency, "s" if emergency > 1 else ""))
    reg["extra_fields"] = fields
    reg["id_label_printing"] = labels

    # Address hierarchy, in template order
    for f in glob.glob(os.path.join(site_dir, INIT, "globalproperties", "*.xml")):
        txt = open(f, encoding="utf-8").read()
        if "layout.address.format" not in txt:
            continue
        inner = ET.fromstring(txt).find(".//value").text or ""
        levels = []
        for prop, val in re.findall(r'<property name="(\w+)" value="([^"]*)"\s*/>', inner.split("</nameMappings>")[0]):
            levels.append(ADDRESS_LABELS.get(prop, humanize(prop)) if val.startswith("Location.") else val)
        reg["address"] = levels

    # Locales
    for f in glob.glob(os.path.join(site_dir, INIT, "globalproperties", "*.xml")):
        root = ET.parse(f).getroot()
        for gp in root.iter("globalProperty"):
            p, v = gp.findtext("property"), (gp.findtext("value") or "").strip()
            if p == "locale.allowed.list":
                reg["languages"] = [x.strip() for x in v.split(",") if x.strip()]
            elif p == "default_locale":
                reg["default_language"] = v
    return reg


def locations(site_dir):
    return [r.get("Name", "").strip() for r in read_csv(os.path.join(site_dir, INIT, "locations", "*.csv")) if not r.get("Void/Retire")]


# ---------------------------------------------------------------- OpenFn / DHIS2

def openfn(site_dir, yaml_hashes):
    d = os.path.join(site_dir, "configs", "openfn")
    projects = [p for p in sorted(glob.glob(os.path.join(d, "*.yaml"))) if not os.path.basename(p).startswith("staging")]
    if not projects:
        return None
    prod = projects[0]
    data = yaml.safe_load(open(prod, encoding="utf-8")) or {}
    workflows = []
    for wf in (data.get("workflows") or {}).values():
        trig = next(iter((wf.get("triggers") or {}).values()), {})
        workflows.append({
            "name": wf.get("name"),
            "cron": trig.get("cron_expression"),
            "enabled": bool(trig.get("enabled")),
        })
    info = {"config": rel(prod), "workflows": workflows}

    # Version and supported forms, from changelog.md or version.txt
    version_src = next((p for p in (os.path.join(d, "changelog.md"), os.path.join(d, "version.txt")) if os.path.exists(p)), None)
    if version_src:
        txt = open(version_src, encoding="utf-8").read()
        m = re.search(r"^## \[(v[\d.]+)\] - (\d{4}-\d{2}-\d{2})", txt, re.M) or re.search(r"Yaml version: (v[\d.]+)", txt)
        if m:
            info["version"] = m.group(1)
            if m.lastindex and m.lastindex > 1:
                info["version_date"] = m.group(2)
        m = re.search(r"Supported OMRS Versions:\**\s*\n+\s*-\s*(.+)", txt)
        if m:
            info["mapped_forms"] = expand_codes(FORM_CODE.findall(m.group(1) + " "))
        m = re.search(r"\*\*Metadata:\*\*\s*(.+)", txt)
        if m:
            info["metadata"] = m.group(1).strip()

    digest = hashlib.sha256(open(prod, "rb").read()).hexdigest()
    twins = sorted(s for s, h in yaml_hashes.items() if h == digest and s != os.path.basename(site_dir))
    if twins:
        info["identical_to"] = twins

    staging = os.path.join(d, "staging_project.yaml")
    if os.path.exists(staging):
        txt = open(staging, encoding="utf-8").read()
        info["staging_config"] = rel(staging)
        info["staging_forms"] = expand_codes(re.findall(r"\b(F\d{2})-[A-Z]", txt))

    any_on = any(w["enabled"] for w in workflows)
    info["status"] = "live" if any_on else "template"
    info["synced_forms"] = info.get("mapped_forms", []) if any_on else []
    return info


# ---------------------------------------------------------------- main

def project_hashes():
    out = {}
    for d in glob.glob(os.path.join(ROOT, "sites", "*")):
        projects = [p for p in sorted(glob.glob(os.path.join(d, "configs", "openfn", "*.yaml"))) if not os.path.basename(p).startswith("staging")]
        if projects:
            out[os.path.basename(d)] = hashlib.sha256(open(projects[0], "rb").read()).hexdigest()
    return out


def sync_library(all_forms):
    """Append distro forms missing from the catalog so new forms show up."""
    lib_text = open(LIBRARY, encoding="utf-8").read()
    known = set(re.findall(r"code: (F\d{2})", lib_text))
    missing = [c for c in sorted(all_forms) if c not in known]
    if missing:
        lines = "".join('  - {code: %s, name: %s, program: "Unassigned"}\n' % (c, json.dumps(all_forms[c]["name"] or c)) for c in missing)
        lib_text = lib_text.replace("\n# Key modules.", lines + "\n# Key modules.", 1)
        open(LIBRARY, "w", encoding="utf-8").write(lib_text)
    return missing


def main(argv):
    all_forms = distro_forms()
    added = sync_library(all_forms)
    hashes = project_hashes()
    commit = git_commit()
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    site_dirs = sorted(glob.glob(os.path.join(ROOT, "sites", "*")))
    if argv:
        site_dirs = [d for d in site_dirs if os.path.basename(d) in argv]
    for d in site_dirs:
        sid = os.path.basename(d)
        pom = open(os.path.join(d, "pom.xml"), encoding="utf-8").read()
        mods, removed = site_modules(pom)
        detected = {
            "generated_at": now,
            "source_commit": commit,
            "site_folder": rel(d),
            "forms": expand_codes(site_forms(pom, all_forms)),
            "modules": mods,
            "frontend_modules_removed": removed,
            "registration": registration(d),
            "locations": locations(d),
            "integration": openfn(d, hashes),
        }
        meta, body = load_profile(sid)
        created = not meta
        if created:
            meta = {"id": sid, "name": sid.capitalize(), "country": None, "status": "live", "phase": None}
        meta["detected"] = detected
        save_profile(sid, meta, body)
        print("%s %s: %d forms, %d modules, integration %s" % (
            "created" if created else "updated", rel(profile_path(sid)),
            len(site_forms(pom, all_forms)), len(mods),
            detected["integration"]["status"] if detected["integration"] else "none"))
    if added:
        print("Added to library.yaml (program Unassigned): " + ", ".join(added))


if __name__ == "__main__":
    main(sys.argv[1:])
