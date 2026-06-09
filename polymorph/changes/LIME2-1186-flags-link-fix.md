# LIME2-1186 — Flags bug: broken flags link

Clicking a patient flag navigated to a URL built from the side-nav display label (spaces, capitals, `&`), rendering an empty chart. Fix: replace labels with route slugs in the `@openmrs/esm-patient-flags-app` `tagActions`/`flagActions` URLs (e.g. `chart/Vitals & Biometrics` → `chart/vitals-and-biometrics`, `chart/Results` → `chart/results`).

Grounded in:
- impl-openmrs-patient-flags

Touchpoint: distro `*-frontend-config.json` `@openmrs/esm-patient-flags-app` block.
