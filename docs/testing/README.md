# Testing LIME EMR

How requirements become test cases, how test cases become automated tests, and how results are reported. Each step has a Claude skill in `.claude/skills/` so it can be done with AI assistance and stays consistent.

```
Requirement (MSF, Jira, field)   ->  Test cases (docs)        ->  Automated tests            ->  Report
lime-test-case skill                 docs/testing/cas-de-test     tests/config, e2e/            lime-test-report skill
                                                                  lime-e2e-test skill            scripts/test-report.mjs
```

## 1. Test levels

| Level | What it proves | Where | Runs | Speed |
|---|---|---|---|---|
| **Configuration** | Form calculations, JSON validity, unique ids, translations, role inheritance | `tests/config/` | every PR touching `distro/` or `sites/` (`config-tests.yml`) | seconds, no server |
| **API** | Privileges (200 vs 403), REST/FHIR payloads, OpenFn outputs | `e2e/` (to be added) | after deploy to DEV/UAT | seconds per call |
| **Interface** | What a user sees and clicks: forms, skip logic, patient chart | `e2e/` | after deploy to DEV/UAT (`run-e2e-tests.yml`) | minutes |
| **Manual** | Printing, devices, clinical judgement | test case docs only | UAT sessions | hours |

Push every check down to the lowest level that can prove it. Most form logic (scores, ranges, translations) is provable from the JSON, without a server, and runs on every PR.

## 2. Writing test cases

- Template (French, for the MSF team): [modele-cas-de-test.md](modele-cas-de-test.md)
- Worked example: [exemples/REQ-MH-PHQ9-001.md](exemples/REQ-MH-PHQ9-001.md) (PHQ-9 score, plus a short access-rights example)
- New cases go in `docs/testing/cas-de-test/<REQ-ID>.md`.

IDs: `REQ-<MODULE>-<SUBJECT>-<NNN>` for requirements, `TC-<MODULE>-<SUBJECT>-<NNN>` for test cases.

## 3. Automating

Tag each automated test with its requirement and start the title with the case ID:

```ts
test.describe('PHQ-9 score calculation (F35 v2)', { tag: '@REQ-MH-PHQ9-001' }, () => {
  test('[TC-MH-PHQ9-003] mixed answers give 14', () => { ... });
});
```

| Command | Runs |
|---|---|
| `yarn test:config` | configuration tests, no server |
| `yarn test:e2e` | browser tests against `OPENMRS_BASE_URL` (see `.env`) |
| `npx playwright test --grep @REQ-MH-PHQ9-001` | everything for one requirement |
| `yarn test:report` | builds `test-results/report.md` from the last run |

Browser tests read `OPENMRS_BASE_URL`, `OPENMRS_USERNAME`, `OPENMRS_PASSWORD` and, for patient chart tests, `E2E_PATIENT_UUID` (a fictitious patient with an active visit) from `.env`.

## 4. Reporting

`scripts/test-report.mjs` groups results by requirement and test case, lists failures and known issues, and writes the GitHub job summary in CI. Known defects found by a check but not fixed yet are listed in the test (for example `KNOWN_BROKEN_EXPRESSIONS` in `tests/config/forms/forms-integrity.spec.ts`) and reported separately, so the suite stays green while new regressions still fail.

## 5. Using the Claude skills

In Claude Code, inside this repository:

- *"Write test cases for LIME2-123"* or *"Voici la liste d'exigences MSF, prépare les cas de test"* -> `lime-test-case`
- *"Automate TC-MH-PHQ9-004"* -> `lime-e2e-test`
- *"Run the tests on UAT and give me a report for MSF"* -> `lime-test-report`

## 6. Roadmap

1. Collect the MSF requirement list in the template, starting with the highest-risk areas (calculated scores, skip logic, role restrictions, DHIS2 exports).
2. Grow `tests/config/` first: generic checks for all forms (translations complete in every site language, every concept UUID exists in the concepts CSV or OCL export, role inheritance resolves).
3. Prepare stable test data on DEV/UAT (fictitious patients, one user per role) so browser tests do not depend on manual setup.
4. Run browser suites automatically after each DEV/UAT deployment and before each site release; attach the report to the sprint release.
5. Replace the early exploratory specs (`e2e/test-1.spec.ts`, `e2e/features/*`) with tagged, case-linked tests.
