# LIME2-1200 — Bunia forms: translation of form names

Add French form-name translations for Bunia forms using the `form_name_translation` top-level property in each `ampathformstranslations/<FormName>_translations_fr.json`.

Grounded in:
- impl-openmrs-form-translations

Key points:
- `form` field must match the form JSON `name` byte-for-byte.
- Form name is registered via the OpenMRS message source (by UUID), NOT the `translations` dict.

Touchpoint: `distro/configs/openmrs/initializer_config/ampathformstranslations/`
