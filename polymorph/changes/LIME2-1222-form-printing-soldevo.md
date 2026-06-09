# LIME2-1222 — Add form printing feature from Soldevo

Adopt the upstream encounter/form-printing feature (O3-5452) into LIME-EMR via the four-touchpoint pattern.

Grounded in:
- impl-openmrs-distro-adopt-upstream-feature

Touchpoints:
1. `distro/pom.xml` — bump `patientdocuments.version` to 1.1.0-SNAPSHOT.
2. `frontend_assembly/spa-assemble-config.json` — bump `@openmrs/esm-patient-chart-app` to a build containing the Completed-Forms print UI.
3. `initializer_config/jsonkeyvalues/encounterPrinting.json` — upstream keys with `report.encounterPrinting.header.patientIdentifierTypes` = `MSF ID`.
4. Frontend config — none needed (no exposed keys).
