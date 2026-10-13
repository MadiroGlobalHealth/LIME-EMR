# Exemple : score PHQ-9 (Santé mentale)

Exemple rempli à partir du [modèle](../modele-cas-de-test.md). Il s'appuie sur le formulaire réel `F35-MH-PHQ-9_v2.json` de la distro.

Les cas marqués **Configuration** sont déjà automatisés dans [`tests/config/forms/phq9-score.spec.ts`](../../../tests/config/forms/phq9-score.spec.ts) et tournent sans serveur. Les cas **Interface** ont un squelette dans [`e2e/forms/mentalhealth/phq9-score.spec.ts`](../../../e2e/forms/mentalhealth/phq9-score.spec.ts).

---

## Exigence REQ-MH-PHQ9-001

| Champ | Contenu |
|---|---|
| **ID** | REQ-MH-PHQ9-001 |
| **Titre** | Calcul automatique du score PHQ-9 |
| **Module** | Formulaires / Santé mentale |
| **Site(s)** | Distro (tous les sites utilisant le formulaire F35 PHQ-9 v2) |
| **Priorité** | Haute |
| **Source** | Protocole MSF santé mentale (PHQ-9) |
| **Description** | En tant que clinicien santé mentale, je veux que le score PHQ-9 soit calculé automatiquement à partir des 9 réponses afin d'éviter les erreurs d'addition et de classer correctement la sévérité de la dépression. |

**Règles métier**

1. Chacune des 9 questions vaut : « Pas du tout » = 0, « Plusieurs jours » = 1, « Plus de la moitié des jours » = 2, « Presque tous les jours » = 3.
2. Le champ « Score PHQ-9 » est la somme des 9 réponses (0 à 27) et se met à jour dès qu'une réponse change.
3. Le champ « Score PHQ-9 » n'est pas modifiable à la main.
4. Le score est enregistré avec la consultation et visible après sauvegarde.
5. Les libellés sont affichés dans la langue de l'utilisateur (anglais, arabe, français).

**Hors périmètre** : le choix du traitement en fonction du score.

---

## Cas de test

### TC-MH-PHQ9-001 : score minimum

| Champ | Contenu |
|---|---|
| **Exigence liée** | REQ-MH-PHQ9-001 (règles 1, 2) |
| **Type** | Limite |
| **Niveau** | Configuration + Interface |
| **Préconditions** | Utilisateur avec le rôle clinicien santé mentale, patient fictif avec une visite active |
| **Données de test** | Les 9 réponses = « Pas du tout (0 point) » |
| **Étapes** | 1. Ouvrir le dossier du patient. 2. Cliquer sur « Formulaires cliniques ». 3. Ouvrir « F35-MH-PHQ-9 ». 4. Répondre « Pas du tout » aux 9 questions. |
| **Résultat attendu** | Le champ « Score PHQ-9 » affiche **0**. |
| **Automatisable** | Oui |

### TC-MH-PHQ9-002 : score maximum

| Champ | Contenu |
|---|---|
| **Exigence liée** | REQ-MH-PHQ9-001 (règles 1, 2) |
| **Type** | Limite |
| **Niveau** | Configuration + Interface |
| **Données de test** | Les 9 réponses = « Presque tous les jours (3 points) » |
| **Étapes** | Identiques à TC-MH-PHQ9-001, avec les données ci-dessus. |
| **Résultat attendu** | Le champ « Score PHQ-9 » affiche **27**. |
| **Automatisable** | Oui |

### TC-MH-PHQ9-003 : réponses mixtes

| Champ | Contenu |
|---|---|
| **Exigence liée** | REQ-MH-PHQ9-001 (règles 1, 2) |
| **Type** | Nominal |
| **Niveau** | Configuration + Interface |
| **Données de test** | Q1 = 1, Q2 = 2, Q3 = 3, Q4 = 0, Q5 = 1, Q6 = 2, Q7 = 3, Q8 = 0, Q9 = 2 |
| **Résultat attendu** | Le champ « Score PHQ-9 » affiche **14**. |
| **Automatisable** | Oui |

### TC-MH-PHQ9-004 : mise à jour quand une réponse change

| Champ | Contenu |
|---|---|
| **Exigence liée** | REQ-MH-PHQ9-001 (règle 2) |
| **Type** | Nominal |
| **Niveau** | Interface |
| **Étapes** | 1. Saisir les données de TC-MH-PHQ9-003 (score 14). 2. Changer Q1 de « Plusieurs jours » à « Presque tous les jours ». |
| **Résultat attendu** | Le score passe de 14 à **16** sans recharger la page. |
| **Automatisable** | Oui |

### TC-MH-PHQ9-005 : le score n'est pas modifiable

| Champ | Contenu |
|---|---|
| **Exigence liée** | REQ-MH-PHQ9-001 (règle 3) |
| **Type** | Négatif |
| **Niveau** | Interface |
| **Étapes** | 1. Ouvrir le formulaire. 2. Essayer de taper « 99 » dans le champ « Score PHQ-9 ». |
| **Résultat attendu** | Le champ est en lecture seule, la valeur reste celle calculée. |
| **Automatisable** | Oui |

### TC-MH-PHQ9-006 : questions sans réponse

| Champ | Contenu |
|---|---|
| **Exigence liée** | REQ-MH-PHQ9-001 (règle 2) |
| **Type** | Limite |
| **Niveau** | Configuration |
| **Données de test** | Q1 = 3, Q2 = 3, les 7 autres questions sans réponse |
| **Résultat attendu** | Le score affiche **6** (les questions sans réponse comptent 0). |
| **Automatisable** | Oui |

### TC-MH-PHQ9-007 : libellés en français

| Champ | Contenu |
|---|---|
| **Exigence liée** | REQ-MH-PHQ9-001 (règle 5) |
| **Type** | Nominal |
| **Niveau** | Configuration + Interface |
| **Préconditions** | Langue de l'utilisateur = Français |
| **Résultat attendu** | Chaque libellé du formulaire a une traduction française non vide (ex. « Score PHQ-9 », « Plusieurs jours (1 point) »). |
| **Automatisable** | Oui |

---

## Questions ouvertes pour l'équipe MSF

L'écriture de ces cas a fait ressortir trois points à valider côté clinique. C'est un des bénéfices attendus de l'exercice.

1. **Aucune question n'est obligatoire.** Un PHQ-9 incomplet est donc enregistré avec un score partiel (TC-MH-PHQ9-006). Faut-il rendre les 9 questions obligatoires ?
2. **La « Échelle de sévérité » est choisie à la main.** Rien n'empêche aujourd'hui d'enregistrer un score de 22 avec « pas de dépression ». Faut-il la calculer automatiquement à partir du score (seuils 5, 10, 15, 20), ou au moins afficher un avertissement ?
3. **Le champ score n'est pas marqué en lecture seule** dans la configuration (pas de `readonly`). TC-MH-PHQ9-005 doit être vérifié à l'écran pour savoir si un utilisateur peut écraser le score calculé.

---

## Deuxième exemple, plus court : droits d'accès

Pour montrer qu'un cas de test ne concerne pas que les formulaires.

**REQ-ACCESS-MAT-001** : à Matsapha, seul le rôle « Matsapha: Registration Supervisor » peut supprimer un patient, une visite ou une consultation.

| ID | Type | Préconditions | Étapes | Résultat attendu |
|---|---|---|---|---|
| TC-ACCESS-MAT-001 | Nominal | Utilisateur avec le seul rôle « Registration Supervisor » | Ouvrir un patient fictif, supprimer une consultation | La suppression est possible |
| TC-ACCESS-MAT-002 | Négatif | Utilisateur avec le seul rôle « Matsapha: Clinical » | Ouvrir le même patient | L'action « Supprimer » n'est pas proposée, et l'API répond 403 |
| TC-ACCESS-MAT-003 | Négatif | Utilisateur avec le seul rôle « Matsapha: Data Export » | Ouvrir la recherche de patients | La recherche fonctionne sans erreur (régression corrigée en #470) |
