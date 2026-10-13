---
name: lime-test-case
description: Turn a LIME EMR requirement (a Jira ticket, an MSF protocol excerpt, a form change, a bug report or a plain sentence) into structured requirements and test cases in the team's template, grounded in the actual configuration. Use when asked to "write test cases", "define tests for", "prepare a test plan", "what should we test", or when MSF sends a list of requirements to formalise.
---

# Define LIME EMR test cases

Goal: produce test cases a clinician can read and a developer (or the `lime-e2e-test` skill) can automate without guessing.

## Inputs

Accept any of: a Jira key (`LIME2-123`, read it with the Jira tools if connected), a form file name (`F35-MH-PHQ-9_v2.json`), a pasted protocol or requirement list, a PR or commit, a bug report from the field.

## Steps

0. **If the input is a returned form review sheet** (`docs/testing/fiches/retours/*.xlsx`, made by `scripts/form-test-sheet.py`): read it with openpyxl. Tab `Questions`: the hidden column K is the question id; column H is MSF's verdict (Oui / Non / Je ne sais pas), I the correction, J a remark or example. Tab `Scénarios`: Pour qui / Si je fais / Je dois voir / Important, ignore the grey example row. Tab `Listes longues`: remarks on individual answers.
   - "Oui" rows: the current configuration is confirmed. Generate test cases that lock it in (skip logic both ways, limits on both sides, mandatory), mostly at configuration level.
   - "Non" rows: a change request. Generate the test case for the expected behaviour (it will fail until the form is fixed) and list the change in a summary for the team to open a Jira ticket. Never edit the form yourself from the sheet.
   - "Je ne sais pas" rows and blanks: list as open questions.
   - Regenerate the sheet from the current form and compare: if the form changed since the sheet was sent, say which rows MSF reviewed against an older version.

1. **Read the example first**: `docs/testing/exemples/REQ-MH-PHQ9-001.md`. MSF writes requirements in the simple four-column format of `docs/testing/modele-cas-de-test.md` (Quoi ? / Pour qui ? / Si je fais... / Je dois voir...). Your job is to expand that into the detailed format below. Check `docs/testing/cas-de-test/` for existing IDs so you do not reuse one.
2. **Ground every rule in the configuration**. Never invent labels, thresholds or roles. Look them up:
   - Forms: `distro/configs/openmrs/initializer_config/ampathforms/*.json` and `sites/<site>/configs/openmrs/initializer_config/ampathforms/` (question `id`, `label`, `required`, `hide.hideWhenExpression`, `questionOptions.answers`, `calculate.calculateExpression`, `validators`, `min`/`max`).
   - Translations: `.../ampathformstranslations/<form>_translations_<lang>.json` (use the exact displayed label in the user's language).
   - Roles and privileges: `.../initializer_config/roles/*.csv`, `privileges/`.
   - Concepts, encounter types, visit types, locations, flags, global properties: matching `initializer_config/` folders.
   - Frontend behaviour: `distro/configs/openmrs/frontend_config/` and `sites/<site>/configs/openmrs/frontend_config/`.
   - Site overrides win over the distro: always say which site a case applies to.
3. **Derive cases from each rule**: one nominal case, every boundary (each threshold on both sides, empty, max), at least one negative case (refused, hidden, forbidden). For skip logic: one case where the field shows, one where it hides. For roles: one allowed role, one denied role.
4. **Pick the lowest level that proves the rule** and put it in the Level column:
   - *Configuration*: arithmetic, JSON structure, translations, role inheritance. Runs in seconds, no server.
   - *API*: REST/FHIR responses, privileges (403 vs 200), OpenFn outputs.
   - *Interface*: what the user actually sees and clicks.
   - *Manual*: only when automation costs more than it saves (printing, hardware, judgement calls).
5. **Report gaps and contradictions** as open questions at the top of the file, in plain French for MSF: rules the config does not enforce (not required, not read-only, severity not derived from score), labels missing a translation, behaviour that differs between sites. These are often the most valuable output.
6. **Write the file** to `docs/testing/cas-de-test/<REQ-ID>.md` in two parts, like the example:
   - **Top, for MSF**: the requirement in the simple four-column table, plain French, no IDs or jargon, then the open questions. A clinician must be able to read it in one minute.
   - **Bottom, in a `<details>` block for the team**: the detailed test cases below.

## Detailed test case format (team part)

Requirement: ID `REQ-<MODULE>-<SUBJECT>-<NNN>`, title, site(s), source (Jira key, protocol), numbered business rules.

One table row per test case:

| Column | Content |
|---|---|
| ID | `TC-<MODULE>-<SUBJECT>-<NNN>` |
| Check | one observable expected result |
| Type | Nominal / Boundary / Negative |
| Level | Configuration / API / Interface / Manual |
| Preconditions and data | role, site, language, patient state, exact values |
| Test | path of the automated test, or "to write" |

## Rules

- Test data is always fictitious. Never copy a real patient name, identifier or UUID from a production export.
- One test case checks one thing. Expected results are observable values ("le score affiché est 14"), never "fonctionne correctement".
- No long dashes in prose; use commas, colons or parentheses.
- When a requirement list arrives in bulk, produce a summary table first (REQ ID, title, number of cases, levels, open questions) and confirm before writing every case in full.
