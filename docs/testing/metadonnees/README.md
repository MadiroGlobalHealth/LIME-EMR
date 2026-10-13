# Tests dans le classeur de métadonnées MSF

Pas de nouveau fichier : les tests vivent dans le classeur de métadonnées que MSF maintient déjà. Le modèle [Template - Tests in metadata workbook.xlsx](Template%20-%20Tests%20in%20metadata%20workbook.xlsx) est un extrait de ce classeur (onglet F17) montrant les seuls ajouts proposés, en bleu.

## 1. Ce qui est automatique (rien à remplir)

Chaque règle déjà écrite dans un onglet de formulaire devient un ou deux cas de test, vérifiés contre le formulaire configuré :

| Colonne existante | Cas de test généré |
|---|---|
| Skip logic : `Hide question if [Referred to MSF] !== 'Yes'` | « Je réponds Yes » → la question apparaît ; « Je réponds No » → elle n'apparaît pas |
| Skip logic : `Hide question if patient's age <= 15 years` | « Patient de 15 ans » → n'apparaît pas ; « 16 ans » → apparaît |
| Lower limit / Upper limit | Une valeur hors limite est refusée |
| Mandatory = Yes | L'enregistrement sans réponse est refusé |

## 2. Ce que MSF peut ajouter (facultatif)

| Où | Quoi | Quand |
|---|---|---|
| Onglet du formulaire, 2 colonnes à la fin : **Test - If I do...** / **Test - I should see...** | Un test sur la question de la ligne | Calculs, vraisemblance (« 450 kg → alerte »), boutons. Pas besoin de répéter la skip logic. |
| Nouvel onglet **Test Scenarios** : Form, Who (role, site), If I do..., I should see..., Priority, Status, Comments | Un test par ligne | Parcours patient, plusieurs formulaires, rôles et accès, rapports |

Une ligne ajoutée à l'onglet **Form Guidance** explique la règle, avec un bon et un mauvais exemple, comme pour la skip logic.

## 3. Les résultats vont dans le Form QA Tracker existant

`--all` donne, pour chaque formulaire, la valeur à reporter dans les colonnes **Structure** (questions présentes, obligatoires, limites) et **Skip logic** de l'onglet « Form QA Tracker », dans le même style que les entrées actuelles (« MB, Aug 30 ») : `Auto, Oct 13: ✅ 8/8`. Le détail d'un formulaire (chaque cas, chaque écart) s'obtient avec `--form`.

```bash
python3 scripts/metadata-check.py "LIME EMR - Iraq Metadata - Release 1.xlsx" --all
python3 scripts/metadata-check.py "LIME EMR - Iraq Metadata - Release 1.xlsx" --form "F17-Surgery Admission"
```

Le script lit le classeur sans jamais le modifier. Le classeur n'est pas versionné dans le dépôt : utiliser l'export le plus récent.

## Limites

- Les colonnes **Calculation** et **Custom Logic** ne sont pas vérifiées automatiquement : les tests écrits dans les colonnes Test les couvrent.
- Une skip logic hors du format de l'onglet « Form Guidance » apparaît comme « à vérifier ».
- « Conforme » veut dire que la configuration respecte la règle ; les tests navigateur sur DEV/UAT confirment l'affichage.

## Résultats, export « Release 1 », 2026-10-13

Un ❌ ne veut pas dire que le formulaire est faux : soit le formulaire, soit l'onglet est à mettre à jour. Exemples : F48, « Management of reactions » devrait aussi apparaître pour la réaction « Other » ; F29, la métadonnée dit « hide if age <= 15 », le formulaire applique « age < 15 ».

Valeurs à reporter dans l'onglet « Form QA Tracker » (colonnes Structure et Skip logic).

| Form | Structure | Skip logic | Tests écrits par MSF |
|---|---|---|---|
| F08-ITFC Admission | Auto, Oct 13: ✅ 11/11, 2 à vérifier | Auto, Oct 13: ✅ 18/18, 5 à vérifier |  |
| F09-ITFC Discharge | Auto, Oct 13: ✅ 14/14 | Auto, Oct 13: ❌ 49/85, 36 écart(s), 4 à vérifier |  |
| F10-Feeding | Auto, Oct 13: ❌ 0/1, 1 écart(s), 1 à vérifier |  |  |
| F11-Family Planning Assessment | Auto, Oct 13: ✅ 4/4 | Auto, Oct 13: ❌ 12/13, 1 écart(s), 4 à vérifier |  |
| F12-Family Planning Follow-up |  | Auto, Oct 13: ✅ 12/12 |  |
| F13-PNC | Auto, Oct 13: ❌ 10/11, 1 écart(s) | Auto, Oct 13: ❌ 162/173, 11 écart(s), 5 à vérifier |  |
| F14-Basic Obstetric Ultrasound | Auto, Oct 13: ❌ 44/60, 16 écart(s), 1 à vérifier | Auto, Oct 13: ❌ 114/116, 2 écart(s) |  |
| F15-Surgical Safety Checklist |  |  |  |
| F16-Operative Report | Auto, Oct 13: ✅ 1/1, 1 à vérifier | Auto, Oct 13: ✅ 30/30, 18 à vérifier |  |
| F17-Surgery Admission | Auto, Oct 13: ✅ 2/2 | Auto, Oct 13: ✅ 8/8 |  |
| F18-Surgery Discharge |  | Auto, Oct 13: ✅ 30/30 |  |
| F19-Pre-anesthesia Record | Auto, Oct 13: ✅ 13/13 | Auto, Oct 13: ✅ 34/34 |  |
| F20-Recovery | Auto, Oct 13: ❌ 3/6, 3 écart(s) | Auto, Oct 13: ✅ 12/12 |  |
| F21-Anesthesia Transfer | Auto, Oct 13: ✅ 1/1 | Auto, Oct 13: ✅ 10/10 |  |
| F22-Neonatal Delivery | Auto, Oct 13: ✅ 6/6 | Auto, Oct 13: ✅ 26/26 |  |
| F23-Neonatal Admission | Auto, Oct 13: ✅ 9/9 | Auto, Oct 13: ✅ 16/16 |  |
| F24-Neonatal Discharge | Auto, Oct 13: ✅ 5/5 | Auto, Oct 13: ✅ 42/42, 1 à vérifier |  |
| F25-Pediatrics Admission | Auto, Oct 13: ✅ 3/3 | Auto, Oct 13: ❌ 4/6, 2 écart(s) |  |
| F26-Pediatrics Discharge | Auto, Oct 13: ✅ 10/10 | Auto, Oct 13: ❌ 58/62, 4 écart(s), 1 à vérifier |  |
| F27-Adult Admission |  | Auto, Oct 13: ✅ 2/2, 2 à vérifier |  |
| F28-Adult Discharge | Auto, Oct 13: ✅ 6/6 | Auto, Oct 13: ✅ 30/30, 4 à vérifier |  |
| F29-MHPSS Baseline | Auto, Oct 13: ❌ 15/21, 6 écart(s) | Auto, Oct 13: ❌ 20/66, 46 écart(s), 8 à vérifier |  |
| F30-MHPSS Follow-up | Auto, Oct 13: ❌ 12/15, 3 écart(s) | Auto, Oct 13: ❌ 34/80, 46 écart(s), 15 à vérifier |  |
| F31-mhGAP Baseline | Auto, Oct 13: ❌ 12/14, 2 écart(s) | Auto, Oct 13: ❌ 6/52, 46 écart(s), 4 à vérifier |  |
| F32-mhGAP Follow-up | Auto, Oct 13: ❌ 11/12, 1 écart(s) | Auto, Oct 13: ❌ 12/58, 46 écart(s), 4 à vérifier |  |
| F33-MHPSS Closure | Auto, Oct 13: ✅ 8/8 | Auto, Oct 13: ❌ 12/14, 2 écart(s) |  |
| F34-mhGAP Closure | Auto, Oct 13: ✅ 8/8 | Auto, Oct 13: ❌ 12/14, 2 écart(s) |  |
| F35-MH-PHQ-9 | Auto, Oct 13: ✅ 2/2 |  |  |
| F36-Maternity Triage | Auto, Oct 13: ✅ 12/12 |  |  |
| F37-Maternity Admission | Auto, Oct 13: ❌ 18/20, 2 écart(s) | Auto, Oct 13: ✅ 14/14 |  |
| F38-Maternity Delivery |  | Auto, Oct 13: ✅ 10/10 |  |
| F39-Maternity Discharge | Auto, Oct 13: ✅ 4/4 | Auto, Oct 13: ✅ 22/22 |  |
| F40-Referral & Discharge | Auto, Oct 13: ✅ 14/14 | Auto, Oct 13: ✅ 50/50 |  |
| F41-ER Triage | Auto, Oct 13: ✅ 1/1 | Auto, Oct 13: ✅ 28/28 |  |
| F42-ER Consultation |  | Auto, Oct 13: ✅ 0/0, 1 à vérifier |  |
| F43-ER Exit | Auto, Oct 13: ✅ 3/3 | Auto, Oct 13: ✅ 34/34 |  |
| F44-OPD General |  | Auto, Oct 13: ✅ 12/12, 2 à vérifier |  |
| F45-ATFC | Auto, Oct 13: ✅ 6/6 | Auto, Oct 13: ❌ 104/114, 10 écart(s), 4 à vérifier |  |
| F46-Small Procedure Report |  | Auto, Oct 13: ✅ 2/2 |  |
| F47-Pre-donation | Auto, Oct 13: ❌ 1/3, 2 écart(s) | Auto, Oct 13: ❌ 88/90, 2 écart(s), 2 à vérifier |  |
| F48-Blood Transfusion | Auto, Oct 13: ✅ 5/5 | Auto, Oct 13: ❌ 20/21, 1 écart(s) |  |
| F49-NCDs Baseline | Auto, Oct 13: ✅ 27/27, 1 à vérifier | Auto, Oct 13: ❌ 116/119, 3 écart(s) |  |
| F50-NCDs Follow-up | Auto, Oct 13: ❌ 25/28, 3 écart(s), 1 à vérifier | Auto, Oct 13: ❌ 106/107, 1 écart(s) |  |
| F51-HIV Baseline | Auto, Oct 13: ✅ 5/5 | Auto, Oct 13: ❌ 38/40, 2 écart(s), 2 à vérifier |  |
| F52-HIV Follow-up | Auto, Oct 13: ✅ 5/5 | Auto, Oct 13: ❌ 46/48, 2 écart(s), 2 à vérifier |  |
| F53-TB Baseline | Auto, Oct 13: ✅ 5/5 | Auto, Oct 13: ✅ 24/24, 1 à vérifier |  |
| F54-TB Follow-up | Auto, Oct 13: ✅ 5/5 | Auto, Oct 13: ✅ 22/22 |  |
| F55-HBV Baseline | Auto, Oct 13: ❌ 6/8, 2 écart(s) | Auto, Oct 13: ❌ 60/62, 2 écart(s) |  |
| F56-HBV Follow-up | Auto, Oct 13: ❌ 6/8, 2 écart(s) | Auto, Oct 13: ❌ 54/62, 8 écart(s), 1 à vérifier |  |
| F57-HCV Baseline | Auto, Oct 13: ❌ 7/9, 2 écart(s) | Auto, Oct 13: ❌ 70/71, 1 écart(s) |  |
| F58-HCV Follow-up | Auto, Oct 13: ❌ 7/9, 2 écart(s) | Auto, Oct 13: ❌ 60/61, 1 écart(s) |  |
| F59-Social Work Baseline | Auto, Oct 13: ✅ 54/54 | Auto, Oct 13: ✅ 250/250, 1 à vérifier |  |
| F60-Social Work Follow-up | Auto, Oct 13: ✅ 55/55 | Auto, Oct 13: ❌ 296/298, 2 écart(s) |  |
| F61-Travel medicine | Auto, Oct 13: ✅ 20/20 | Auto, Oct 13: ❌ 20/28, 8 écart(s), 7 à vérifier |  |
| F62-Palliative care Baseline |  | Auto, Oct 13: ✅ 40/40 |  |
| F63-Palliative care Follow-up |  | Auto, Oct 13: ❌ 30/38, 8 écart(s) |  |
| F64-ICU Admission | Auto, Oct 13: ✅ 1/1 | Auto, Oct 13: ✅ 34/34 |  |
| F65-ICU Discharge | Auto, Oct 13: ✅ 4/4 | Auto, Oct 13: ✅ 32/32, 1 à vérifier |  |
| F66-Snakebites | Auto, Oct 13: ✅ 18/18 | Auto, Oct 13: ❌ 208/226, 18 écart(s) |  |
| F67-Cholera |  | Auto, Oct 13: ❌ 28/29, 1 écart(s) |  |
| F68-NTDs Dengue |  | Auto, Oct 13: ✅ 4/4 |  |
| F69-NTDs Filariasis |  | Auto, Oct 13: ✅ 14/14, 6 à vérifier |  |
| F70-NTDs Schistosomiasis |  | Auto, Oct 13: ✅ 16/16 |  |
| F71-POCUS | Auto, Oct 13: ✅ 0/0, 5 à vérifier | Auto, Oct 13: ❌ 66/73, 7 écart(s) |  |
| F72-ANC | Auto, Oct 13: ❌ 16/18, 2 écart(s), 1 à vérifier | Auto, Oct 13: ❌ 60/65, 5 écart(s) |  |
| F73-Gynaecology | Auto, Oct 13: ✅ 9/9, 1 à vérifier | Auto, Oct 13: ❌ 14/16, 2 écart(s) |  |
| F74-Cervical Cancer | Auto, Oct 13: ✅ 10/10, 4 à vérifier | Auto, Oct 13: ❌ 93/101, 8 écart(s), 1 à vérifier |  |
| F75-Wound Dressing | Auto, Oct 13: ✅ 2/2, 1 à vérifier | Auto, Oct 13: ❌ 10/12, 2 écart(s) |  |
| F76-Radiology Request |  | Auto, Oct 13: ✅ 12/12 |  |
