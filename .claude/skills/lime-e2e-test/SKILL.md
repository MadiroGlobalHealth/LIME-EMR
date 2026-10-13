---
name: lime-e2e-test
description: Automate LIME EMR test cases (TC-...) as Playwright tests, at configuration level (no server) or in the browser against DEV/UAT, then run them. Use when asked to "automate this test case", "write the e2e test", "add a Playwright test", "turn TC-xxx into a test", or after lime-test-case produced cases marked Automatisable.
---

# Automate LIME EMR test cases

## Where tests live

| Level | Folder | Playwright project | Command | Needs |
|---|---|---|---|---|
| Configuration | `tests/config/` | `config` | `yarn test:config` | nothing, runs in CI on every PR |
| Interface / API | `e2e/` | `chromium` (+ `setup` login) | `yarn test:e2e` | a running instance, `.env` |

Helpers for reading forms: `tests/config/helpers/forms.ts` (`loadDistroForm`, `question`, `answerConcept`, `evaluateCalculation`, `allFormFiles`). Reuse and extend them instead of re-parsing JSON in each test.

Reference implementations: `tests/config/forms/phq9-score.spec.ts` (config level) and `e2e/forms/mentalhealth/phq9-score.spec.ts` (browser level), both for `docs/testing/exemples/REQ-MH-PHQ9-001.md`.

## Steps

1. Read the test case file (`docs/testing/cas-de-test/<REQ>.md` or the example). If the case is vague, fix the case first (lime-test-case skill), not the test.
2. Choose the level from the case's `Niveau`. Prefer configuration tests: whatever can be proven from the JSON/CSV files should be, and the browser test then only checks what the user sees.
3. Write the test following the conventions below.
4. Run it. Config tests: `yarn test:config`. Browser tests need `.env` with `OPENMRS_BASE_URL`, `OPENMRS_USERNAME`, `OPENMRS_PASSWORD` (and `E2E_PATIENT_UUID` for chart tests); if no instance is reachable, say so plainly and do not claim the test passes.
5. Prove the test can fail: break the input once (wrong expected value, or a temporary edit of the form copy in memory) and check it goes red, then restore.
6. Run `yarn test:report` and include the result summary in your answer or PR.

## Conventions

- **Traceability**: tag the `describe` with the requirement (`{ tag: '@REQ-MH-PHQ9-001' }`) and start each test title with the case ID: `test('[TC-MH-PHQ9-003] mixed answers give 14', ...)`. `scripts/test-report.mjs` builds the report from these.
- **No hardcoded hosts or credentials**. Use `baseURL` (from `OPENMRS_BASE_URL`) and env vars. `baseURL` ends in `/spa` with no trailing slash, so build absolute URLs: `` `${baseURL}/patient/${uuid}/chart/Patient%20Summary` ``.
- **Selectors**: `getByRole` / `getByLabel` with the displayed label, scoped to the question group when answer labels repeat. Never CSS module class names (`[class*="pageTitle"]`), they change between O3 releases.
- **Waiting**: rely on `expect(...).toHaveValue/ToBeVisible` auto-waiting. No `waitForTimeout`.
- **Data**: fictitious patients only. Gate tests that need a prepared patient with `test.skip(!process.env.X, 'X is not set')` so CI without data skips instead of failing.
- **Known defects**: when a check finds an existing defect that is out of scope, list it explicitly (see `KNOWN_BROKEN_EXPRESSIONS` in `tests/config/forms/forms-integrity.spec.ts`) and annotate it as `known issue` so it shows in the report; new occurrences must still fail.
- Never skip, disable or loosen an assertion to get a green run.
