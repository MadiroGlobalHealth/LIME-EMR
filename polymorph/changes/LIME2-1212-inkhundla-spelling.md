# LIME2-1212 — Address spelling fix: Inkhundia → Inkhundla

Correct the cityVillage level label spelling in the Matsapha address section.

Grounded in:
- impl-openmrs-address-hierarchy

Touchpoints (must stay in sync):
- `addresshierarchy/addressConfiguration.xml` — `<nameMapping>Inkhundla</nameMapping>`
- `globalproperties/address-template.xml` — `cityVillage` value `Inkhundla`
