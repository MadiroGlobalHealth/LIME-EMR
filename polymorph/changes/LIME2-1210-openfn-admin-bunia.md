# LIME2-1210 — Add openfn admin user to Bunia

Provision an `openfn` / `openfn-service` admin-equivalent user for the OpenFn integration team, via the Initializer users domain (config-as-code, PR-reviewable). Password stored as a bcrypt hash / secret-store reference — never plaintext.

Grounded in:
- tp-add-openfn-admin-user-bunia
- impl-openfn-site-admin-and-workflows

Touchpoint: `sites/bunia/configs/openmrs/initializer_config/users/`
