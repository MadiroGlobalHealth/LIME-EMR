#!/usr/bin/env python3
"""Check forms against the MSF metadata workbook and derive test cases from it.

The metadata workbook (one tab per form, with Skip logic, Mandatory, Lower
limit, Upper limit and Question ID columns) is the specification MSF already
maintains. This script reads a form tab, compares every rule with the form
JSON in this repository, and writes the test cases those rules imply, in plain
language, each marked as matching the configuration or not. MSF fills in
nothing new.

Usage:
  python3 scripts/metadata-check.py <metadata.xlsx> --form "F17-Surgery Admission" [--out cases.xlsx]
  python3 scripts/metadata-check.py <metadata.xlsx> --all [--out summary.md]
"""
import argparse
import glob
import importlib.util
import os
import re
import sys
import warnings

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl")

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
_spec = importlib.util.spec_from_file_location("form_test_sheet", os.path.join(HERE, "form-test-sheet.py"))
fts = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fts)

# Metadata tab columns (0-based), header on row 2.
COLUMNS = {"num": "Question #", "question": "Question", "label": "Label if different", "lower": "Lower limit", "upper": "Upper limit",
           "skip": "Skip logic", "mandatory": "Mandatory", "rendering": "Rendering", "qid": "Question ID"}
EMPTY = {"", "{leave blank}", "na", "n/a", "no", "false", "\xa0"}
SKIP_RENDERINGS = {"markdown", "order-basket", "workspace-launcher"}

OK, KO, WARN = "✅ Conforme", "❌ Écart", "⚠️ À vérifier"


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

def check_form(ws, form_path):
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

    def case(question, action, expected, rule, status, detail=""):
        cases.append({"question": question, "action": action, "expected": expected, "rule": rule, "status": status, "detail": detail})

    for r in meta:
        q = form.by_id.get(r["id"])
        label = r["question"]
        if not q:
            if r["rendering"] not in SKIP_RENDERINGS:
                findings.append((label, KO, f"Question absente du formulaire (Question ID « {r['id'] or '?'} »)"))
            continue
        qo = q.get("questionOptions", {})

        # Mandatory
        if r["mandatory"]:
            ok = fts.is_required(q)
            case(label, f"J'enregistre sans remplir « {label} »", "L'enregistrement est refusé", "Mandatory = Yes",
                 OK if ok else KO, "" if ok else "Non obligatoire dans le formulaire")
        elif fts.is_required(q):
            findings.append((label, WARN, "Obligatoire dans le formulaire, pas dans les métadonnées"))

        # Limits
        for key, side, word in (("lower", "min", "inférieure"), ("upper", "max", "supérieure")):
            if r[key] is None:
                continue
            try:
                want = float(r[key])
            except ValueError:
                findings.append((label, WARN, f"Limite non numérique dans les métadonnées : {r[key]}"))
                continue
            got = qo.get(side)
            ok = got not in (None, "") and float(got) == want
            probe = want - 1 if key == "lower" else want + 1
            case(label, f"Je saisis {probe:g} dans « {label} »", f"Valeur refusée ({word} à la limite de {want:g})",
                 f"{COLUMNS[key]} = {want:g}", OK if ok else KO, "" if ok else f"Dans le formulaire : {got if got not in (None, '') else 'aucune limite'}")

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
                                 + fts.visibility(form, own)))
            continue
        clauses = parse_skip(r["skip"])
        if clauses is None:
            findings.append((label, WARN, f"Skip logic non lisible automatiquement : « {r['skip']} »"))
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
                findings.append((label, WARN, f"Question de la condition introuvable : « {parent_label} »"))
                continue
            concepts = answer_concepts(pq)
            missing = [v for v in values if norm(v) not in concepts]
            if missing:
                findings.append((label, KO, f"Réponse(s) introuvable(s) dans « {parent_label} » : {', '.join(missing)}"))
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
            findings.append((q.get("label", q["id"]), WARN, "Question du formulaire absente des métadonnées"))
    return cases, findings


# --- output ---------------------------------------------------------------

FONT = "Arial"
HEADER = PatternFill("solid", fgColor="1F4E79")
FILL = {OK: PatternFill("solid", fgColor="E2EFDA"), KO: PatternFill("solid", fgColor="FCE4D6"), WARN: PatternFill("solid", fgColor="FFF2CC")}
THIN = Side(style="thin", color="BFBFBF")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def write_table(ws, headers, rows, status_col=None):
    for c, (h, w) in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=c, value=h)
        cell.font = Font(name=FONT, bold=True, color="FFFFFF")
        cell.fill = HEADER
        cell.alignment = Alignment(wrap_text=True, vertical="center")
        ws.column_dimensions[cell.column_letter].width = w
    for r, values in enumerate(rows, start=2):
        for c, v in enumerate(values, start=1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.font = Font(name=FONT, size=10)
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            cell.border = BORDER
            if status_col and c == status_col and v in FILL:
                cell.fill = FILL[v]
    ws.freeze_panes = "A2"
    if rows:
        ws.auto_filter.ref = f"A1:{ws.cell(row=1, column=len(headers)).column_letter}{len(rows) + 1}"
    fts.landscape(ws)


def write_xlsx(tab, form_path, cases, findings, out):
    wb = Workbook()
    ws = wb.active
    ws.title = "Cas de test"
    write_table(ws, [("N°", 5), ("Question", 30), ("Si je fais...", 42), ("Je dois voir...", 32),
                     ("Règle (onglet métadonnées)", 40), ("Configuration", 14), ("Détail", 40)],
                [[i, c["question"], c["action"], c["expected"], c["rule"], c["status"], c["detail"]] for i, c in enumerate(cases, start=1)],
                status_col=6)
    ws = wb.create_sheet("Autres points")
    write_table(ws, [("Question", 36), ("Statut", 14), ("Détail", 80)], [list(f) for f in findings], status_col=2)
    ws = wb.create_sheet("Lisez-moi")
    lines = [
        f"Cas de test générés à partir de l'onglet « {tab} » des métadonnées",
        "",
        "Chaque règle de l'onglet (Skip logic, Mandatory, Lower / Upper limit) donne un ou deux cas de test.",
        "La colonne « Configuration » indique si le formulaire actuel respecte la règle.",
        "L'onglet « Autres points » liste ce qui diffère entre les métadonnées et le formulaire.",
        "",
        "Rien à remplir : pour ajouter ou corriger une règle, modifiez l'onglet des métadonnées comme d'habitude.",
        "",
        f"Formulaire comparé : {os.path.relpath(form_path, REPO)}",
    ]
    for i, t in enumerate(lines, start=1):
        ws.cell(row=i, column=1, value=t).font = Font(name=FONT, size=14 if i == 1 else 11, bold=i == 1, color="1F4E79" if i == 1 else "000000")
    ws.column_dimensions["A"].width = 100
    ws.sheet_view.showGridLines = False
    wb.save(out)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("metadata")
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--form", help='metadata tab name, e.g. "F17-Surgery Admission"')
    g.add_argument("--all", action="store_true", help="summary for every form tab")
    p.add_argument("--form-file", help="form JSON to compare with (default: distro form with the same Fxx prefix)")
    p.add_argument("--out")
    args = p.parse_args()
    wb = load_workbook(args.metadata, read_only=True, data_only=True)

    if args.form:
        form_path = form_file_for(args.form, args.form_file)
        if not form_path:
            sys.exit(f"No form JSON found for {args.form}; pass --form-file")
        cases, findings = check_form(wb[args.form], form_path)
        out = args.out or re.sub(r"[^\w-]+", "_", args.form) + "_cas-de-test.xlsx"
        write_xlsx(args.form, form_path, cases, findings, out)
        ko = sum(c["status"] == KO for c in cases) + sum(f[1] == KO for f in findings)
        print(f"{out}: {len(cases)} cas de test, {sum(c['status'] == OK for c in cases)} conformes, {ko} écarts, "
              f"{sum(f[1] == WARN for f in findings)} points à vérifier")
        return

    lines = ["| Onglet | Formulaire | Cas de test | Conformes | Écarts | À vérifier |", "|---|---|---|---|---|---|"]
    for ws in wb.worksheets:
        if not re.match(r"F\d\d-", ws.title) or "OLD" in ws.title.upper():
            continue
        form_path = form_file_for(ws.title)
        if not form_path:
            continue
        cases, findings = check_form(ws, form_path)
        ko = sum(c["status"] == KO for c in cases) + sum(f[1] == KO for f in findings)
        lines.append(f"| {ws.title} | {os.path.basename(form_path)} | {len(cases)} | {sum(c['status'] == OK for c in cases)} | {ko} | {sum(f[1] == WARN for f in findings)} |")
    md = "\n".join(lines)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(md + "\n")
    print(md)


if __name__ == "__main__":
    main()
