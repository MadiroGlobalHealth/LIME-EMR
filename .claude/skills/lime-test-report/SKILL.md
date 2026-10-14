---
name: lime-test-report
description: Run the LIME EMR automated tests (configuration and/or browser suites, on a chosen environment) and produce a traceability report by requirement and test case, with failures explained and coverage gaps listed. Use when asked to "run the tests", "test report", "is UAT OK", "what is covered", "release test summary", or before a sprint release or site deployment.
---

# Run and report LIME EMR tests

## Steps

1. **Pick the scope** from the request (default: config suite only):
   - `yarn test:config` (no server, seconds).
   - `yarn test:e2e` against an environment: requires `.env` with `OPENMRS_BASE_URL` and credentials. DEV is `https://lime-mosul-dev.madiro.org/openmrs/spa`, UAT `https://lime-mosul-uat.madiro.org/openmrs/spa`. In CI this is the `Run E2E Tests` workflow (`.github/workflows/run-e2e-tests.yml`, input `environment`).
   - A subset: `npx playwright test --grep @REQ-MH-PHQ9-001` or `--grep TC-MH-PHQ9-003`.
2. **Run**, then `yarn test:report`. It reads `test-results/results.json` and writes `test-results/report.md` (requirements table, failures, known issues, detail). In GitHub Actions it also fills the job summary.
3. **Explain each failure**, do not just list it. Open the trace or error, and decide: product defect (the config or app is wrong), test defect (selector or data drift), or environment (instance down, login, missing test patient). Say which, with the evidence.
4. **Check coverage**: compare the TC IDs in `docs/testing/cas-de-test/*.md` and `docs/testing/exemples/*.md` marked Automatisable against the IDs in the report. List cases with no automated test.
5. **Deliver** in the requested form:
   - Chat: the requirements table plus failures and gaps.
   - For MSF or a release: French summary first (feu vert / orange / rouge per module, defects found, open questions), technical detail after. Publish as a page or a Jira comment when asked; never post to Jira, Slack or GitHub without the user's go-ahead.

## Tests defined by MSF in the metadata workbook

The `User flow template` tab holds test definitions only (Test ID, Title, Feature, Sites, From release, Role, Preconditions, Steps, Expected result, Priority). List the tests in scope with `python3 scripts/metadata-check.py <workbook> --scenarios --site <site> --release <n>`, run each one on the target environment (as the given Role, after creating the Preconditions with fictitious data), and report per test: pass / fail / blocked, actual result, environment, date. Never write results into MSF's workbook: give the report, plus one summary value per feature or form for their Form QA Tracker (`Auto, <date>: ✅ 8/8`).

## Rules

- Report outcomes as they are: a skipped suite is "not run", not "passed". If the instance was unreachable, say the browser suite did not run.
- Known issues (annotations of type `known issue`) are listed separately; they are tracked defects, not passes.
- Never include credentials, tokens or real patient data in a report.
