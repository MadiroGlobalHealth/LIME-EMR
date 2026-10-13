# Fiches de vérification par formulaire

Une fiche Excel par formulaire, pré-remplie à partir de la configuration : chaque question, ses réponses, si elle est obligatoire, quand elle s'affiche, ses limites. L'équipe MSF coche seulement « Correct ? Oui / Non » et corrige ce qui ne va pas, puis ajoute des scénarios « Si je fais... je dois voir... ».

- Exemple rempli (réponses fictives) : [EXEMPLE_F48-Blood_transfusion_form.xlsx](EXEMPLE_F48-Blood_transfusion_form.xlsx)
- Fiches vierges : [F48 Transfusion sanguine](F48-Blood_transfusion_form.xlsx), [F35 PHQ-9](F35-MH-PHQ-9_v2.xlsx)

## Générer la fiche d'un autre formulaire

```bash
python3 scripts/form-test-sheet.py distro/configs/openmrs/initializer_config/ampathforms/F44-OPD_general_form.json \
  --out docs/testing/fiches/F44-OPD_general_form.xlsx
```

`--lang fr` (par défaut), `en` ou `ar` selon la langue de l'équipe. Pour un formulaire propre à un site, passer le fichier de `sites/<site>/configs/openmrs/initializer_config/ampathforms/`.

Les fiches reflètent la configuration au moment où elles sont générées : régénérer après une modification du formulaire.

## Quand la fiche revient

Déposer le fichier rempli dans `docs/testing/fiches/retours/` et demander à Claude : « Prépare les cas de test à partir de la fiche F48 renvoyée par MSF » (skill `lime-test-case`).
