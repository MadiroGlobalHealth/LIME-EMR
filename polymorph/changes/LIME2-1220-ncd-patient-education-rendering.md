# LIME2-1220 — NCD: change rendering of patient education questions

Flip the five patient-education questions' `rendering` from `multiCheckbox` to `radio` in both NCD forms (DHIS2 alignment). One-line edit per question; concepts, IDs, labels, hide expressions unchanged.

Grounded in:
- impl-openmrs-form-creation-and-editing

Touchpoints: `distro/configs/openmrs/initializer_config/ampathforms/F49-NCDs_Baseline.json`, `.../F50-NCDs_Follow-up.json` (+ back-fill the metadata Excel).

Follow-ups: `inlineMultiCheckbox: true` becomes vestigial; hide expressions written for array values now operate on a string.
