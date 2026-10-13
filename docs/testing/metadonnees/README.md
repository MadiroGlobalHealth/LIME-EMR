# Tests générés à partir des métadonnées MSF

Le classeur de métadonnées que MSF maintient déjà (un onglet par formulaire) **est** la spécification. Chaque règle de ses colonnes donne automatiquement un ou deux cas de test :

| Colonne de l'onglet | Cas de test généré |
|---|---|
| Skip logic : `Hide question if [Referred to MSF] !== 'Yes'` | « Je réponds Yes à Referred to MSF » → la question apparaît ; « Je réponds No » → elle n'apparaît pas |
| Skip logic : `Hide question if patient's age <= 15 years` | « Patient de 15 ans » → n'apparaît pas ; « Patient de 16 ans » → apparaît |
| Lower limit / Upper limit | « Je saisis une valeur hors limite » → valeur refusée |
| Mandatory = Yes | « J'enregistre sans remplir la question » → enregistrement refusé |

Chaque cas est comparé au formulaire configuré dans ce dépôt et marqué **✅ Conforme** ou **❌ Écart**. L'équipe MSF n'a rien de nouveau à remplir : pour ajouter ou corriger une règle, elle modifie l'onglet comme d'habitude.

## Exemples

- [F17 Surgery Admission](F17-Surgery_Admission_cas-de-test.xlsx) : 10 cas, tous conformes. Le plus simple pour comprendre le principe.
- [F48 Blood Transfusion](F48-Blood_Transfusion_cas-de-test.xlsx) : 26 cas, 1 écart (« Management of reactions » devrait aussi apparaître pour la réaction « Other »).

## Générer

```bash
# Un formulaire : classeur avec les cas de test et les écarts
python3 scripts/metadata-check.py "LIME EMR - Iraq Metadata - Release 1.xlsx" --form "F17-Surgery Admission" --out F17.xlsx

# Tous les formulaires : tableau de synthèse
python3 scripts/metadata-check.py "LIME EMR - Iraq Metadata - Release 1.xlsx" --all
```

Le classeur n'est pas versionné dans le dépôt : utiliser l'export le plus récent. Les onglets « OLD » sont ignorés. Pour un formulaire propre à un site, ajouter `--form-file sites/<site>/.../Fxx-....json`.

## Ce que le script ne couvre pas encore

- Les colonnes **Calculation** et **Custom Logic** (texte libre) : à tester au cas par cas (voir les tests PHQ-9).
- Une skip logic écrite hors du format de l'onglet « Form Guidance » est listée dans « Autres points » comme « à vérifier ».
- Le comportement à l'écran : les cas « Conforme » valident la configuration ; les tests navigateur sur DEV/UAT confirment l'affichage.

## Synthèse, export « Release 1 », 2026-10-13

3862 cas de test générés, 3533 conformes (91 %). Une ligne « Écarts » non nulle ne veut pas dire que le formulaire est faux : soit le formulaire, soit l'onglet de métadonnées est à mettre à jour.

| Onglet | Formulaire | Cas de test | Conformes | Écarts | À vérifier |
|---|---|---|---|---|---|
| F08-ITFC Admission | F08-ITFC_Admission_form.json | 29 | 29 | 0 | 7 |
| F09-ITFC Discharge | F09-ITFC_Discharge_form.json | 99 | 63 | 36 | 4 |
| F10-Feeding | F10-Feeding_form.json | 1 | 0 | 1 | 1 |
| F11-Family Planning Assessment | F11-Family_Planning_Assessment.json | 16 | 16 | 1 | 4 |
| F12-Family Planning Follow-up | F12-Family_Planning_Follow-up.json | 12 | 12 | 0 | 0 |
| F13-PNC | F13-PNC.json | 172 | 172 | 12 | 5 |
| F14-Basic Obstetric Ultrasound | F14-Basic_obstetric_ultrasound.json | 176 | 158 | 18 | 1 |
| F15-Surgical Safety Checklist | F15-Surgical_safety_checklist.json | 0 | 0 | 0 | 0 |
| F16-Operative Report | F16-Operative_report.json | 31 | 31 | 0 | 19 |
| F17-Surgery Admission | F17-Surgery_admission_form.json | 10 | 10 | 0 | 0 |
| F18-Surgery Discharge | F18-Surgery_discharge_form.json | 30 | 30 | 0 | 0 |
| F19-Pre-anesthesia Record | F19-Pre_anesthesia_record.json | 47 | 47 | 0 | 0 |
| F20-Recovery | F20-Recovery_form.json | 18 | 15 | 3 | 0 |
| F21-Anesthesia Transfer | F21-Anesthesia_transfer_form.json | 11 | 11 | 0 | 0 |
| F22-Neonatal Delivery | F22-Neonatal_delivery_form.json | 32 | 32 | 0 | 0 |
| F23-Neonatal Admission | F23-Neonatal_admission_form.json | 25 | 25 | 0 | 0 |
| F24-Neonatal Discharge | F24-Neonatal_discharge_form.json | 47 | 47 | 0 | 1 |
| F25-Pediatrics Admission | F25-Pediatrics_admission_form.json | 7 | 7 | 2 | 0 |
| F26-Pediatrics Discharge | F26-Pediatrics_discharge_form.json | 68 | 68 | 4 | 1 |
| F27-Adult Admission | F27-Adult_admission_form.json | 2 | 2 | 0 | 2 |
| F28-Adult Discharge | F28-Adult_discharge_form.json | 36 | 36 | 0 | 4 |
| F29-MHPSS Baseline | F29-MHPSS_Baseline_v2.json | 87 | 35 | 52 | 8 |
| F30-MHPSS Follow-up | F30-MHPSS_Follow-up_v2.json | 95 | 46 | 49 | 15 |
| F31-mhGAP Baseline | F31-mhGAP_Baseline_v2.json | 66 | 18 | 48 | 4 |
| F32-mhGAP Follow-up | F32-mhGAP_Follow-up_v2.json | 70 | 23 | 47 | 4 |
| F33-MHPSS Closure | F33-MHPSS_Closure_v2.json | 20 | 20 | 2 | 0 |
| F34-mhGAP Closure | F34-mhGAP_Closure_v2.json | 20 | 20 | 2 | 0 |
| F35-MH-PHQ-9 | F35-MH-PHQ-9_v2.json | 2 | 2 | 0 | 0 |
| F36-Maternity Triage | F36-Maternity_triage_form.json | 12 | 12 | 0 | 0 |
| F37-Maternity Admission | F37-Maternity_admission_form.json | 34 | 32 | 2 | 0 |
| F38-Maternity Delivery | F38-Maternity_delivery_form.json | 10 | 10 | 0 | 0 |
| F39-Maternity Discharge | F39-Maternity_discharge_form.json | 26 | 26 | 0 | 0 |
| F40-Referral & Discharge | F40-Referral_and_Discharge.json | 64 | 64 | 0 | 0 |
| F41-ER Triage | F41-ER_triage_form.json | 29 | 29 | 0 | 0 |
| F42-ER Consultation | F42-ER_consultation_form.json | 0 | 0 | 0 | 1 |
| F43-ER Exit | F43-ER_exit_form.json | 37 | 37 | 0 | 0 |
| F44-OPD General | F44-OPD_general_form.json | 12 | 12 | 0 | 2 |
| F45-ATFC | F45-ATFC_form.json | 120 | 110 | 10 | 4 |
| F46-Small Procedure Report | F46-Small_procedure_report_form.json | 2 | 2 | 0 | 0 |
| F47-Pre-donation | F47-Pre-donation.json | 91 | 89 | 4 | 2 |
| F48-Blood Transfusion | F48-Blood_transfusion_form.json | 26 | 25 | 1 | 0 |
| F49-NCDs Baseline | F49-NCDs_Baseline.json | 143 | 143 | 3 | 1 |
| F50-NCDs Follow-up | F50-NCDs_Follow-up.json | 133 | 131 | 4 | 1 |
| F51-HIV Baseline | F51-HIV_Baseline.json | 43 | 43 | 2 | 2 |
| F52-HIV Follow-up | F52-HIV_Follow-up.json | 51 | 51 | 2 | 2 |
| F53-TB Baseline | F53-TB_Baseline.json | 29 | 29 | 0 | 1 |
| F54-TB Follow-up | F54-TB_Follow-up.json | 27 | 27 | 0 | 0 |
| F55-HBV Baseline | F55-HBV_Baseline.json | 70 | 66 | 4 | 0 |
| F56-HBV Follow-up | F56-HBV_Follow-up.json | 70 | 60 | 10 | 1 |
| F57-HCV Baseline | F57-HCV_Baseline.json | 79 | 77 | 3 | 0 |
| F58-HCV Follow-up | F58-HCV_Follow-up.json | 69 | 67 | 3 | 0 |
| F59-Social Work Baseline | F59-Social_Work_Baseline.json | 304 | 304 | 0 | 1 |
| F60-Social Work Follow-up | F60-Social_Work_Follow-up.json | 353 | 351 | 2 | 0 |
| F61-Travel medicine | F61-Travel_medicine.json | 40 | 40 | 8 | 7 |
| F62-Palliative care Baseline | F62-Palliative_Care_Baseline.json | 40 | 40 | 0 | 0 |
| F63-Palliative care Follow-up | F63-Palliative_Care_Follow-up.json | 38 | 30 | 8 | 0 |
| F64-ICU Admission | F64-ICU_Admission.json | 35 | 35 | 0 | 0 |
| F65-ICU Discharge | F65-ICU_Discharge.json | 36 | 36 | 0 | 1 |
| F66-Snakebites | F66-Snakebites.json | 234 | 226 | 18 | 0 |
| F67-Cholera | F67-Cholera.json | 28 | 28 | 1 | 0 |
| F68-NTDs Dengue | F68-NTDs_Dengue.json | 4 | 4 | 0 | 0 |
| F69-NTDs Filariasis | F69-NTDs_Filariasis.json | 14 | 14 | 0 | 6 |
| F70-NTDs Schistosomiasis | F70-NTDs_Schistosomiasis.json | 16 | 16 | 0 | 0 |
| F71-POCUS | F71-POCUS.json | 72 | 66 | 7 | 5 |
| F72-ANC | F72-ANC.json | 80 | 76 | 7 | 1 |
| F73-Gynaecology | F73-Gynaecology.json | 25 | 23 | 2 | 1 |
| F74-Cervical Cancer | F74-Cervical_Cancer.json | 111 | 103 | 8 | 5 |
| F75-Wound Dressing | F75-Wound_Dressing.json | 14 | 12 | 2 | 1 |
| F76-Radiology Request | F76-Radiology_Request.json | 12 | 12 | 0 | 0 |
