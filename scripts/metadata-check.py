#!/usr/bin/env python3
"""Check forms against the MSF metadata workbook and derive test cases from it.

The metadata workbook (one tab per form, with Skip logic, Mandatory, Lower
limit, Upper limit and Question ID columns) is the specification MSF already
maintains. This script reads a form tab, compares every rule with the form
JSON in this repository, and lists the test cases those rules imply, in plain
language, each marked as matching the configuration or not.

Tests MSF write themselves use existing places of the workbook (see
docs/testing/metadonnees/README.md): "Test: <what I do> -> <what I should
see>" lines in the Comments column of a form tab, and steps in the
"User flow template" tab. Nothing is written back to the workbook.

Usage:
  python3 scripts/metadata-check.py <metadata.xlsx> --form "F17-Surgery Admission" [--out report.md]
  python3 scripts/metadata-check.py <metadata.xlsx> --all [--out summary.md]
  python3 scripts/metadata-check.py <metadata.xlsx> --scenarios [--site Mosul] [--release 1]
"""
import argparse
import datetime
import glob
import os
import re
import sys
import warnings

from openpyxl import load_workbook

warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl")

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import lime_forms as fts  # noqa: E402

# Metadata tab columns (0-based), header on row 2.
COLUMNS = {"num": "Question #", "question": "Question", "label": "Label if different", "lower": "Lower limit", "upper": "Upper limit",
           "skip": "Skip logic", "mandatory": "Mandatory", "rendering": "Rendering", "qid": "Question ID",
           "comments": "Comments"}
SCENARIOS_TAB = "User flow template"
TEST_LINE = re.compile(r"^\s*test\s*:\s*(.+?)\s*(?:->|→|=>)\s*(.+?)\s*$", re.I)
EMPTY = {"", "{leave blank}", "na", "n/a", "no", "false", "\xa0"}
SKIP_RENDERINGS = {"markdown", "order-basket", "workspace-launcher"}

OK, KO, WARN, TODO = "✅ Conforme", "❌ Écart", "⚠️ À vérifier", "⏳ À tester"


def blank(v):
    return v is None or str(v).strip().lower() in EMPTY


def norm(s):
    """Case, spacing and leading numbering ("18. Other") do not matter when matching labels."""
    s = re.sub(r"\s+", " ", str(s or "").replace("\xa0", " ")).strip().lower()
    return re.sub(r"^\d+\s*[.)-]\s*", "", s)


# --- metadata side ---------------------------------------------------------

def metadata_rows(ws):
    rows = list(ws.iter_rows(values_only=True))
    header = next((i for i, r in enumerate(rows[:5]) if r and "Question" in [str(x).strip() for x in r if x]), None)
    if header is None:
        return []
    names = [str(x).strip() if x else "" for x in rows[header]]
    idx = {k: names.index(v) for k, v in COLUMNS.items() if v in names}
    out = []
    for r in rows[header + 1:]:
        get = lambda k: r[idx[k]] if k in idx and idx[k] < len(r) else None
        if blank(get("num")) or blank(get("question")):
            continue
        qid = str(get("qid") or "").strip()
        out.append({
            "num": get("num"), "question": str(get("question")).strip(),
            "label": None if blank(get("label")) else str(get("label")).strip(),
            "id": re.sub(r"^rfe-forms-", "", qid) if qid else "",
            "lower": None if blank(get("lower")) else get("lower"),
            "upper": None if blank(get("upper")) else get("upper"),
            "skip": None if blank(get("skip")) else str(get("skip")).strip(),
            "mandatory": str(get("mandatory") or "").strip().lower() in {"yes", "true", "oui"},
            "rendering": str(get("rendering") or "").strip(),
            "tests": [m.groups() for m in (TEST_LINE.match(line) for line in str(get("comments") or "").splitlines()) if m],
        })
    return out


AGE = re.compile(r"patient'?s age\s*(<=|>=|<|>|=)\s*(\d+)", re.I)
CLAUSE = re.compile(r"\[([^\]]+)\]\s*(!==|<>|===|=)\s*(.+)$")


def parse_skip(text):
    """Metadata skip logic -> list of clauses, or None if not understood.
    Clause: ("age", op, n) or ("answer", question label, op, [answer labels])."""
    body = re.sub(r"^hide (the )?question if\s*", "", text.strip(), flags=re.I)
    if body == text.strip():
        return None
    clauses = []
    for part in re.split(r"\s+and\s+", body, flags=re.I):
        m = AGE.search(part)
        if m:
            clauses.append(("age", m.group(1), int(m.group(2))))
            continue
        m = CLAUSE.match(part.strip())
        if not m:
            return None
        raw = m.group(3).strip().strip("{}")
        # Quoted answers may contain commas ('Yes, currently'); unquoted ones (numbers) do not.
        values = re.findall(r"'([^']*)'", raw) or [v.strip() for v in raw.split(",")]
        values = [v.strip() for v in values if v.strip()]
        if not values or re.sub(r"'[^']*'|[\s,]", "", raw) and re.findall(r"'", raw):
            return None
        op = "!==" if m.group(2) in ("!==", "<>") else "==="
        clauses.append(("answer", m.group(1).strip(), op, values))
    return clauses


# --- form side -------------------------------------------------------------

def form_file_for(tab, override=None):
    if override:
        return override
    prefix = tab.split("-")[0]
    hits = sorted(glob.glob(os.path.join(REPO, "distro/configs/openmrs/initializer_config/ampathforms", f"{prefix}-*.json")))
    return hits[0] if hits else None


def show_sets(form, expr):
    """From a hideWhenExpression, the answers that show the field, per question:
    {qid: set(concepts)}, plus {"age": [(op, n)]} for age rules hiding it."""
    result = {}
    if not expr:
        return result
    for part in fts.split_top(fts.strip_parens(expr), "||"):
        clauses = fts.split_top(part, "&&")
        neg = [re.match(r"^!\s*includes\(\s*(\w+)\s*,\s*'([^']+)'\s*\)$", c) or re.match(r"^(\w+)\s*!==?\s*'([^']+)'$", c) for c in clauses]
        if all(neg) and len({m.group(1) for m in neg}) == 1:
            result.setdefault(neg[0].group(1), set()).update(m.group(2) for m in neg)
            continue
        if len(clauses) == 1:
            m = re.match(r"^(\w+)\s*===?\s*'([^']+)'$", clauses[0])
            if m:
                q = form.by_id.get(m.group(1), {})
                others = {a["concept"] for a in q.get("questionOptions", {}).get("answers", [])} - {m.group(2)}
                result.setdefault(m.group(1), set()).update(others)
                continue
            m = fts.NUMERIC.match(clauses[0])
            if m and m.group(1) == "age":
                result.setdefault("age", []).append((m.group(2), float(m.group(3))))
                continue
        result.setdefault("?", []).append(part)
    return result


def effective_hides(form):
    """Question id -> hide expressions of the question and of every page,
    section or group containing it (a field hidden with its section is hidden)."""
    out = {}

    def rec(questions, inherited):
        for q in questions:
            own = q.get("hide", {}).get("hideWhenExpression")
            chain = inherited + ([own] if own else [])
            if q.get("id"):
                out[q["id"]] = chain
            rec(q.get("questions", []), chain)

    for page in form.data.get("pages", []):
        p = [page["hide"]["hideWhenExpression"]] if page.get("hide", {}).get("hideWhenExpression") else []
        for section in page.get("sections", []):
            sec = p + ([section["hide"]["hideWhenExpression"]] if section.get("hide", {}).get("hideWhenExpression") else [])
            rec(section.get("questions", []), sec)
    return out


def match_question(form, row, by_norm_label):
    if row["id"] and row["id"] in form.by_id:
        return form.by_id[row["id"]]
    for text in (row["label"], row["question"]):
        if text and norm(text) in by_norm_label:
            return by_norm_label[norm(text)]
    return None


def age_hidden(rules):
    """Ages 0-120 at which a list of (op, n) rules hides the field."""
    ops = {"<": lambda a, n: a < n, "<=": lambda a, n: a <= n, ">": lambda a, n: a > n,
           ">=": lambda a, n: a >= n, "=": lambda a, n: a == n, "==": lambda a, n: a == n, "===": lambda a, n: a == n}
    return {a for a in range(121) if any(ops[op](a, float(n)) for op, n in rules if op in ops)}


def answer_concepts(q):
    return {norm(a.get("label")): a.get("concept") for a in q.get("questionOptions", {}).get("answers", [])}


# --- comparison and test cases ------------------------------------------------

RESULT_STATUS = {"pass": OK, "fail": KO, "blocked": WARN}


def read_scenarios(wb, site=None, release=None):
    """Rows of the User flow template tab, grouped by the form code that prefixes
    Step (F17-1 -> F17, anything else -> "(other)"). Optional columns Area, Site,
    Release, Priority, Result and Tested on are read when present; site and
    release filter the rows (a row with Site "All sites" or empty matches any site)."""
    out = {}
    if SCENARIOS_TAB not in wb.sheetnames:
        return out
    rows = list(wb[SCENARIOS_TAB].iter_rows(values_only=True))
    header = next((i for i, r in enumerate(rows[:5]) if r and "Action" in [str(x).strip() for x in r if x]), None)
    if header is None:
        return out
    names = [str(x).strip() if x else "" for x in rows[header]]
    col = lambda name: names.index(name) if name in names else None
    cell = lambda r, c: str(r[c]).strip() if c is not None and c < len(r) and r[c] is not None else ""
    c = {k: col(k) for k in ("Step", "Feature", "Category", "Area", "Site", "Release", "Action", "Description", "User",
                             "Priority", "Result", "Tested on")}
    categories = feature_categories(wb)
    for r in rows[header + 1:]:
        if not cell(r, c["Action"]):
            continue
        row_site = cell(r, c["Site"])
        if site and row_site.lower() not in ("", "all sites", site.lower()):
            continue
        if release and cell(r, c["Release"]).lower() != release.lower():
            continue
        step = cell(r, c["Step"])
        m = re.match(r"(F\d\d)", step)
        out.setdefault(m.group(1) if m else "(other)", []).append({
            "step": step, "feature": cell(r, c["Feature"]) or cell(r, c["Area"]),
            "category": cell(r, c["Category"]) or categories.get(cell(r, c["Feature"]).lower(), ""),
            "site": row_site or "All sites", "release": cell(r, c["Release"]),
            "who": cell(r, c["User"]), "do": cell(r, c["Action"]), "see": cell(r, c["Description"]),
            "priority": cell(r, c["Priority"]), "result": cell(r, c["Result"]), "tested_on": cell(r, c["Tested on"])})
    return out


def feature_categories(wb):
    """Feature -> Category from the Features tab (used when the Category formula has no cached value)."""
    if "Features" not in wb.sheetnames:
        return {}
    rows = list(wb["Features"].iter_rows(min_row=1, max_col=3, values_only=True))
    if not rows or not rows[0] or str(rows[0][0]).strip() != "Feature":
        return {}
    return {str(r[0]).strip().lower(): str(r[2] or "").strip() for r in rows[1:] if r and r[0] and len(r) > 2}


def scenario_status(sc):
    return RESULT_STATUS.get(sc["result"].lower(), TODO)


def scenarios_report(scenarios, site=None, release=None):
    rows = [sc for group in scenarios.values() for sc in group]
    esc = lambda v: str(v or "").replace("|", "\\|")
    scope = ", ".join(x for x in (site, release) if x) or "all sites and releases"
    lines = [f"# {SCENARIOS_TAB}: {scope}", ""]
    if not rows:
        return "\n".join(lines + ["No test matches."]) + "\n"
    count = lambda st: sum(scenario_status(sc) == st for sc in rows)
    lines += [f"**{len(rows)} tests**: {count(OK)} pass, {count(KO)} fail, {count(WARN)} blocked, {count(TODO)} not run.", ""]
    lines += ["| Category | Feature | Tests | Pass | Fail | Blocked | Not run |", "|---|---|---|---|---|---|---|"]
    keys = sorted({(sc["category"] or "(no category)", sc["feature"] or "(no feature)") for sc in rows})
    for cat, feat in keys:
        sub = [sc for sc in rows if (sc["category"] or "(no category)", sc["feature"] or "(no feature)") == (cat, feat)]
        n = lambda st: sum(scenario_status(sc) == st for sc in sub)
        lines.append(f"| {cat} | {feat} | {len(sub)} | {n(OK)} | {n(KO)} | {n(WARN)} | {n(TODO)} |")
    lines += ["", "| Step | Feature | Site | Release | Action | Description | User | Priority | Result | Tested on |",
              "|---|---|---|---|---|---|---|---|---|---|"]
    for sc in rows:
        lines.append(f"| {esc(sc['step'])} | {esc(sc['feature'])} | {esc(sc['site'])} | {esc(sc['release'])} | {esc(sc['do'])} | {esc(sc['see'])} | "
                     f"{esc(sc['who'])} | {esc(sc['priority'])} | {scenario_status(sc)} | {esc(sc['tested_on'])} |")
    return "\n".join(lines) + "\n"


def check_form(ws, form_path, scenarios=()):
    form = fts.Form(form_path, "en")
    meta = metadata_rows(ws)
    by_label = {norm(r["question"]): r for r in meta}
    hides = effective_hides(form)
    by_norm_label = {}
    for _, fq in form.walk():
        if fq.get("id") and fq.get("label"):
            by_norm_label.setdefault(norm(fq["label"]), fq)
    for r in meta:
        q = match_question(form, r, by_norm_label)
        r["id"] = q["id"] if q else r["id"]
    cases, findings = [], []

    def case(question, action, expected, rule, status, detail="", kind="skip"):
        cases.append({"question": question, "action": action, "expected": expected, "rule": rule,
                      "status": status, "detail": detail, "kind": kind})

    for r in meta:
        q = form.by_id.get(r["id"])
        label = r["question"]
        if not q:
            if r["rendering"] not in SKIP_RENDERINGS:
                findings.append((label, KO, f"Question absente du formulaire (Question ID « {r['id'] or '?'} »)", "structure"))
            continue
        qo = q.get("questionOptions", {})

        # Mandatory
        if r["mandatory"]:
            ok = fts.is_required(q)
            case(label, f"J'enregistre sans remplir « {label} »", "L'enregistrement est refusé", "Mandatory = Yes",
                 OK if ok else KO, "" if ok else "Non obligatoire dans le formulaire", kind="structure")
        elif fts.is_required(q):
            findings.append((label, WARN, "Obligatoire dans le formulaire, pas dans les métadonnées", "structure"))

        # Limits
        for key, side, word in (("lower", "min", "inférieure"), ("upper", "max", "supérieure")):
            if r[key] is None:
                continue
            try:
                want = float(r[key])
            except ValueError:
                findings.append((label, WARN, f"Limite non numérique dans les métadonnées : {r[key]}", "structure"))
                continue
            got = qo.get(side)
            ok = got not in (None, "") and float(got) == want
            probe = want - 1 if key == "lower" else want + 1
            case(label, f"Je saisis {probe:g} dans « {label} »", f"Valeur refusée ({word} à la limite de {want:g})",
                 f"{COLUMNS[key]} = {want:g}", OK if ok else KO, "" if ok else f"Dans le formulaire : {got if got not in (None, '') else 'aucune limite'}",
                 kind="structure")

        # Skip logic
        actual = {}
        for expr in hides.get(q["id"], []):
            for k, v in show_sets(form, expr).items():
                if k in ("age", "?"):
                    actual.setdefault(k, []).extend(v)
                elif k in actual:
                    actual[k] &= v
                else:
                    actual[k] = set(v)
        if not r["skip"]:
            own = q.get("hide", {}).get("hideWhenExpression")
            if own:
                findings.append((label, WARN, "Condition d'affichage dans le formulaire, absente des métadonnées : "
                                 + fts.visibility(form, own), "skip"))
            continue
        clauses = parse_skip(r["skip"])
        if clauses is None:
            findings.append((label, WARN, f"Skip logic non lisible automatiquement : « {r['skip']} »", "skip"))
            continue
        for c in clauses:
            if c[0] == "age":
                _, op, n = c
                want_hidden = age_hidden([(op, n)])
                ok = age_hidden(actual.get("age", [])) == want_hidden
                shown = sorted(set(range(121)) - want_hidden)
                hidden_age = n if n in want_hidden else (n + 1 if n + 1 in want_hidden else None)
                shown_age = n if n in shown else (n + 1 if n + 1 in shown else None)
                if shown_age is not None and hidden_age is not None:
                    detail = "" if ok else "Le formulaire applique une autre règle d'âge : " + (
                        ", ".join(f"masquée si âge {o} {n:g}" for o, n in actual.get("age", [])) or "aucune")
                    case(label, f"Patient de {hidden_age} ans", f"« {label} » n'apparaît pas", r["skip"], OK if ok else KO, detail)
                    case(label, f"Patient de {shown_age} ans", f"« {label} » apparaît", r["skip"], OK if ok else KO, detail)
                continue
            _, parent_label, op, values = c
            parent = by_label.get(norm(parent_label))
            pq = match_question(form, parent, by_norm_label) if parent else None
            if not pq:
                findings.append((label, WARN, f"Question de la condition introuvable : « {parent_label} »", "skip"))
                continue
            concepts = answer_concepts(pq)
            missing = [v for v in values if norm(v) not in concepts]
            if missing:
                findings.append((label, KO, f"Réponse(s) introuvable(s) dans « {parent_label} » : {', '.join(missing)}", "skip"))
                continue
            listed = {concepts[norm(v)] for v in values}
            want = listed if op == "!==" else set(concepts.values()) - listed
            got = actual.get(parent["id"])
            answers = pq["questionOptions"]["answers"]
            name = {a["concept"]: a["label"] for a in answers}
            show_case = lambda a, status, detail="": case(label, f"Je réponds « {name[a]} » à « {parent_label} »", f"« {label} » apparaît", r["skip"], status, detail)
            hide_case = lambda a, status, detail="": case(label, f"Je réponds « {name[a]} » à « {parent_label} »", f"« {label} » n'apparaît pas", r["skip"], status, detail)
            if got is None:
                detail = f"Aucune condition sur « {parent_label} » dans le formulaire"
                for a in [x["concept"] for x in answers if x["concept"] in want][:1]:
                    show_case(a, KO, detail)
                for a in [x["concept"] for x in answers if x["concept"] not in want][:1]:
                    hide_case(a, KO, detail)
                continue
            # One passing case each way, plus one case per answer that behaves differently.
            for a in [x["concept"] for x in answers if x["concept"] in want & got][:1]:
                show_case(a, OK)
            for a in [x["concept"] for x in answers if x["concept"] not in want | got][:1]:
                hide_case(a, OK)
            for a in [x["concept"] for x in answers if x["concept"] in want - got]:
                show_case(a, KO, "Le formulaire ne l'affiche pas pour cette réponse")
            for a in [x["concept"] for x in answers if x["concept"] in got - want]:
                hide_case(a, KO, "Le formulaire l'affiche pour cette réponse")

    meta_ids = {r["id"] for r in meta}
    for _, q in form.walk():
        rendering = q.get("questionOptions", {}).get("rendering")
        if q.get("id") and q["id"] not in meta_ids and rendering not in fts.SKIP_RENDERINGS | SKIP_RENDERINGS and q.get("type") != "obsGroup":
            findings.append((q.get("label", q["id"]), WARN, "Question du formulaire absente des métadonnées", "structure"))

    # Tests MSF wrote themselves: "Test:" lines in Comments, and User flow template steps.
    for r in meta:
        for do, see in r["tests"]:
            case(r["question"], do, see, "Colonne Comments (Test:)", TODO, kind="custom")
    for sc in scenarios:
        case(sc["who"] or "", sc["do"], sc["see"], f"{SCENARIOS_TAB}, {sc['step']} ({sc['site']})", scenario_status(sc), kind="custom")
    return cases, findings


# --- output ---------------------------------------------------------------

def counts(cases, findings, kind):
    c = [x for x in cases if x["kind"] == kind]
    f = [x for x in findings if x[3] == kind]
    ko_findings = sum(x[1] == KO for x in f)
    return (len(c) + ko_findings, sum(x["status"] == OK for x in c), sum(x["status"] == KO for x in c) + ko_findings,
            sum(x[1] == WARN for x in f))


def tracker_cell(cases, findings, kind, day):
    """Value for a Form QA Tracker cell, in the tracker's "who, date" style."""
    total, ok, ko, warn = counts(cases, findings, kind)
    if not total and not ko and not warn:
        return ""
    return f"Auto, {day}: " + ("✅" if not ko else "❌") + f" {ok}/{total}" + (f", {ko} écart(s)" if ko else "") + (f", {warn} à vérifier" if warn else "")


def form_report(tab, form_path, cases, findings):
    esc = lambda v: str(v or "").replace("|", "\\|").replace("\n", " ")
    lines = [f"# {tab}", "", f"Formulaire comparé : `{os.path.relpath(form_path, REPO)}`", ""]
    total, ok = len(cases), sum(c["status"] == OK for c in cases)
    ko = sum(c["status"] == KO for c in cases) + sum(f[1] == KO for f in findings)
    lines += [f"**{total} cas de test**, {ok} conformes, {ko} écart(s), {sum(c['status'] == TODO for c in cases)} à tester (écrits par MSF), "
              f"{sum(f[1] == WARN for f in findings)} point(s) à vérifier.", ""]
    lines += ["| N° | Question | Si je fais... | Je dois voir... | Règle | Configuration | Détail |", "|---|---|---|---|---|---|---|"]
    for i, c in enumerate(cases, start=1):
        lines.append(f"| {i} | {esc(c['question'])} | {esc(c['action'])} | {esc(c['expected'])} | {esc(c['rule'])} | {c['status']} | {esc(c['detail'])} |")
    if findings:
        lines += ["", "## Autres points", "", "| Question | Statut | Détail |", "|---|---|---|"]
        lines += [f"| {esc(q)} | {st} | {esc(d)} |" for q, st, d, _ in findings]
    return "\n".join(lines) + "\n"


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("metadata")
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--form", help='metadata tab name, e.g. "F17-Surgery Admission"')
    g.add_argument("--all", action="store_true", help="summary for every form tab")
    g.add_argument("--scenarios", action="store_true", help=f"tests of the {SCENARIOS_TAB} tab, with results")
    p.add_argument("--site", help="only tests for this site (plus All sites), e.g. Mosul")
    p.add_argument("--release", help="only tests for this release, e.g. 1")
    p.add_argument("--form-file", help="form JSON to compare with (default: distro form with the same Fxx prefix)")
    p.add_argument("--out")
    args = p.parse_args()
    wb = load_workbook(args.metadata, read_only=True, data_only=True)
    scenarios = read_scenarios(wb, args.site, args.release)
    day = datetime.date.today().strftime("%b %-d")

    if args.scenarios:
        md = scenarios_report(scenarios, args.site, args.release)
    elif args.form:
        form_path = form_file_for(args.form, args.form_file)
        if not form_path:
            sys.exit(f"No form JSON found for {args.form}; pass --form-file")
        cases, findings = check_form(wb[args.form], form_path, scenarios.get(args.form.split("-")[0], []))
        md = form_report(args.form, form_path, cases, findings)
    else:
        lines = ["Valeurs à reporter dans l'onglet « Form QA Tracker » (colonnes Structure et Skip logic).", "",
                 "| Form | Structure | Skip logic | Tests écrits par MSF |", "|---|---|---|---|"]
        for ws in wb.worksheets:
            if not re.match(r"F\d\d-", ws.title) or "OLD" in ws.title.upper():
                continue
            form_path = form_file_for(ws.title)
            if not form_path:
                continue
            cases, findings = check_form(ws, form_path, scenarios.get(ws.title.split("-")[0], []))
            custom = sum(c["kind"] == "custom" for c in cases)
            lines.append(f"| {ws.title} | {tracker_cell(cases, findings, 'structure', day)} | {tracker_cell(cases, findings, 'skip', day)} | "
                         f"{custom or ''} |")
        other = scenarios.get("(other)", [])
        if other:
            lines += ["", f"{len(other)} étape(s) de « {SCENARIOS_TAB} » hors formulaire (rôles, rapports...) : "
                      + ", ".join(sc["step"] or "?" for sc in other)]
        md = "\n".join(lines) + "\n"
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(md)
    print(md)


if __name__ == "__main__":
    main()
