"""Shared helpers to read LIME EMR form JSON (ampathforms) and describe
skip logic in plain French. Used by scripts/metadata-check.py."""
import json
import os
import re

SKIP_RENDERINGS = {"markdown", "fixed-value"}
PATIENT_FIELDS = {"age": "l'âge du patient", "sex": "le sexe du patient"}
UNKNOWN_ANSWER = "« réponse introuvable dans la question, à vérifier »"


class Form:
    def __init__(self, path, lang):
        with open(path, encoding="utf-8") as f:
            self.data = json.load(f)
        self.tr = self._translations(path, lang)
        self.by_id = {}
        self.answer_labels = {}
        for _, q in self.walk():
            if q.get("id"):
                self.by_id[q["id"]] = q
            for a in q.get("questionOptions", {}).get("answers", []):
                self.answer_labels.setdefault(a.get("concept"), a.get("label", ""))

    @staticmethod
    def _translations(path, lang):
        base = os.path.splitext(os.path.basename(path))[0]
        tr_dir = os.path.join(os.path.dirname(os.path.dirname(path)), "ampathformstranslations")
        tr_file = os.path.join(tr_dir, f"{base}_translations_{lang}.json")
        if os.path.exists(tr_file):
            with open(tr_file, encoding="utf-8") as f:
                return json.load(f).get("translations", {})
        return {}

    def t(self, text):
        return self.tr.get(text, text) if text else ""

    def walk(self):
        """Yields (section label, question), flattening groups."""
        def rec(section, questions):
            for q in questions:
                yield section, q
                yield from rec(section, q.get("questions", []))
        for page in self.data.get("pages", []):
            for section in page.get("sections", []):
                yield from rec(section.get("label", ""), section.get("questions", []))

    def qlabel(self, qid):
        if qid in PATIENT_FIELDS:
            return PATIENT_FIELDS[qid]
        q = self.by_id.get(qid)
        return f"« {self.t(q.get('label', qid))} »" if q else qid

    def alabel(self, qid, concept):
        q = self.by_id.get(qid, {})
        for a in q.get("questionOptions", {}).get("answers", []):
            if a.get("concept") == concept:
                return f"« {self.t(a.get('label'))} »"
        label = self.answer_labels.get(concept)
        return f"« {self.t(label)} »" if label else UNKNOWN_ANSWER


# --- skip logic in plain French -------------------------------------------

# Each pattern gives (what the clause says, its opposite) in plain French.
CLAUSE_PATTERNS = [
    (r"^!\s*includes\(\s*(\w+)\s*,\s*'([^']+)'\s*\)$", "{q} ne contient pas {a}", "{q} contient {a}"),
    (r"^includes\(\s*(\w+)\s*,\s*'([^']+)'\s*\)$", "{q} contient {a}", "{q} ne contient pas {a}"),
    (r"^(\w+)\s*!==?\s*'([^']+)'$", "{q} ≠ {a}", "{q} = {a}"),
    (r"^(\w+)\s*===?\s*'([^']+)'$", "{q} = {a}", "{q} ≠ {a}"),
    (r"^!\s*isEmpty\(\s*(\w+)\s*\)$", "{q} est renseigné", "{q} est vide"),
    (r"^isEmpty\(\s*(\w+)\s*\)$", "{q} est vide", "{q} est renseigné"),
]
NUMERIC = re.compile(r"^(\w+)\s*(<=|>=|<|>|!==?|===?)\s*(-?\d+(?:\.\d+)?)$")
SAYS = {"<": "<", "<=": "≤", ">": ">", ">=": "≥", "!==": "≠", "!=": "≠", "===": "=", "==": "="}
OPPOSITE = {"<": "≥", "<=": ">", ">": "≤", ">=": "<", "!==": "=", "!=": "=", "===": "≠", "==": "≠"}


def strip_parens(s):
    s = s.strip()
    while s.startswith("(") and s.endswith(")") and balanced(s[1:-1]):
        s = s[1:-1].strip()
    return s


def balanced(s):
    depth = 0
    for c in s:
        depth += c == "("
        depth -= c == ")"
        if depth < 0:
            return False
    return depth == 0


def split_top(s, op):
    parts, depth, cur, i = [], 0, "", 0
    while i < len(s):
        c = s[i]
        depth += c == "("
        depth -= c == ")"
        if depth == 0 and s.startswith(op, i):
            parts.append(cur)
            cur, i = "", i + len(op)
            continue
        cur += c
        i += 1
    parts.append(cur)
    return [strip_parens(p) for p in parts]


def clause(form, text):
    """Returns (what the clause says, its opposite), or None if not understood."""
    m = NUMERIC.match(text)
    if m:
        q = form.qlabel(m.group(1))
        return f"{q} {SAYS[m.group(2)]} {m.group(3)}", f"{q} {OPPOSITE[m.group(2)]} {m.group(3)}"
    for regex, says, opposite in CLAUSE_PATTERNS:
        m = re.match(regex, text)
        if m:
            qid = m.group(1)
            a = form.alabel(qid, m.group(2)) if m.lastindex and m.lastindex > 1 else ""
            return says.format(q=form.qlabel(qid), a=a), opposite.format(q=form.qlabel(qid), a=a)
    return None


def visibility(form, expr):
    """hideWhenExpression is "A || B || (C && D)"; the field shows when
    not A AND not B AND (not C OR not D)."""
    if not expr:
        return "Toujours"
    shown = []
    for part in split_top(strip_parens(expr), "||"):
        clauses = [clause(form, c) for c in split_top(part, "&&")]
        if any(c is None for c in clauses):
            return "Sous condition (à vérifier avec l'équipe technique)"
        opposites = [opp for _, opp in clauses]
        shown.append(opposites[0] if len(opposites) == 1 else "(" + " OU ".join(opposites) + ")")
    return "Seulement si " + " ET ".join(shown)


# --- question properties ------------------------------------------------

def is_required(q):
    r = q.get("required")
    if isinstance(r, str):
        return r.lower() == "true"
    if isinstance(r, dict):
        return True
    return bool(r)

