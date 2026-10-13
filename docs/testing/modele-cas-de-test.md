# Modèle : exigence et cas de test

Ce modèle sert à décrire **une exigence** (ce que le système doit faire) et **les cas de test** qui prouvent qu'elle est respectée. Il est volontairement simple : une équipe métier peut le remplir sans connaître le code, et Claude peut ensuite le transformer en test automatisé.

Un exemple complet est disponible : [REQ-MH-PHQ9-001](exemples/REQ-MH-PHQ9-001.md).

---

## 1. Exigence

| Champ | Contenu |
|---|---|
| **ID** | `REQ-<MODULE>-<SUJET>-<NNN>` (ex. `REQ-MH-PHQ9-001`) |
| **Titre** | Une phrase courte |
| **Module** | Formulaires, Enregistrement, Visites, Rôles et accès, Rapports, OpenFn / DHIS2, Déploiement... |
| **Site(s)** | Distro (tous), Mosul, Matsapha, Bunia |
| **Priorité** | Critique / Haute / Moyenne / Basse |
| **Source** | Ticket Jira (`LIME2-123`), protocole MSF, document clinique, retour terrain |
| **Description** | « En tant que _rôle_, je veux _action_ afin de _bénéfice_. » |
| **Règles métier** | Liste numérotée des règles vérifiables (seuils, calculs, champs obligatoires, droits) |
| **Hors périmètre** | Ce que l'exigence ne couvre pas |

## 2. Cas de test

Un cas de test vérifie **une seule chose**. Prévoir au minimum : un cas nominal, les cas limites (bornes, valeurs vides) et un cas négatif (ce qui doit être refusé ou masqué).

| Champ | Contenu |
|---|---|
| **ID** | `TC-<MODULE>-<SUJET>-<NNN>` |
| **Exigence liée** | `REQ-...` |
| **Titre** | « Vérifier que ... » |
| **Type** | Nominal / Limite / Négatif |
| **Niveau** | Configuration (sans serveur) / API / Interface (navigateur) / Manuel |
| **Préconditions** | Utilisateur et rôle, site, langue, patient, visite active... |
| **Données de test** | Valeurs précises à saisir (jamais de données réelles de patients) |
| **Étapes** | Numérotées, une action par étape |
| **Résultat attendu** | Observable et sans ambiguïté (valeur, message, champ visible ou masqué) |
| **Automatisable** | Oui / Non / Partiellement (+ raison) |

### Bonnes pratiques

- Écrire le résultat attendu de manière **mesurable** : « Le score affiché est 14 » plutôt que « le score est correct ».
- Indiquer le **libellé exact** tel qu'affiché à l'écran et la **langue** utilisée.
- Ne jamais utiliser de données réelles : patients fictifs uniquement.
- Une règle métier = au moins un cas de test. Les bornes (ex. 4/5, 9/10) méritent chacune un cas.
- Un comportement constaté sur le terrain et non conforme devient un cas de test **avant** d'être corrigé.
