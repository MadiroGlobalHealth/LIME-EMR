# Exemple : score PHQ-9

## Ce que l'équipe MSF écrit dans le classeur de métadonnées

Les lignes de calcul vont dans les colonnes « Test - If I do... / Test - I should see... » de l'onglet F35, les autres dans l'onglet « Test Scenarios ».

| Quoi ? | Pour qui ? | Si je fais... | Je dois voir... |
|---|---|---|---|
| Le score PHQ-9 se calcule tout seul | Clinicien santé mentale, tous les sites | Je réponds « Pas du tout » aux 9 questions | Score = 0 |
| | | Je réponds « Presque tous les jours » aux 9 questions | Score = 27 |
| | | Je réponds 1, 2, 3, 0, 1, 2, 3, 0, 2 points | Score = 14 |
| | | Je change une réponse de 1 à 3 points | Le score augmente de 2, tout de suite |
| Le score ne peut pas être modifié à la main | Clinicien santé mentale | J'essaie de taper 99 dans le score | Impossible, le score reste celui calculé |
| Le formulaire est en français | Utilisateur en français | J'ouvre le formulaire | Toutes les questions et réponses sont en français |

C'est tout. Six lignes suffisent.

Un autre exemple, sur les droits d'accès :

| Quoi ? | Pour qui ? | Si je fais... | Je dois voir... |
|---|---|---|---|
| Seul le superviseur peut supprimer | Matsapha, rôle « Registration Supervisor » | Je supprime une consultation | La suppression fonctionne |
| | Matsapha, rôle « Clinical » | J'ouvre un patient | Le bouton « Supprimer » n'apparaît pas |

## Ce que nous en avons tiré

En vérifiant ces exemples dans la configuration, trois questions sont apparues pour l'équipe clinique :

1. Aucune des 9 questions n'est obligatoire. Un PHQ-9 incomplet est enregistré avec un score partiel. Faut-il les rendre obligatoires ?
2. L'échelle de sévérité est choisie à la main : on peut enregistrer un score de 22 avec « pas de dépression ». Faut-il la calculer automatiquement ?
3. Le score n'est pas verrouillé dans la configuration. Il faut vérifier à l'écran qu'on ne peut pas l'écraser.

---

<details>
<summary>Pour l'équipe technique : correspondance avec les tests automatisés</summary>

Exigence `REQ-MH-PHQ9-001`, formulaire `F35-MH-PHQ-9_v2.json`.

| Cas | Ligne ci-dessus | Niveau | Test |
|---|---|---|---|
| TC-MH-PHQ9-001 | Score = 0 | Configuration | `tests/config/forms/phq9-score.spec.ts` |
| TC-MH-PHQ9-002 | Score = 27 | Configuration | idem |
| TC-MH-PHQ9-003 | Score = 14 | Configuration + Interface | idem + `e2e/forms/mentalhealth/phq9-score.spec.ts` |
| TC-MH-PHQ9-004 | Le score se met à jour | Interface | `e2e/forms/mentalhealth/phq9-score.spec.ts` |
| TC-MH-PHQ9-005 | Score non modifiable | Interface | idem |
| TC-MH-PHQ9-006 | Questions sans réponse comptent 0 (ajouté par nous) | Configuration | `tests/config/forms/phq9-score.spec.ts` |
| TC-MH-PHQ9-007 | Formulaire en français | Configuration | idem |
| TC-ACCESS-MAT-001/002 | Droits de suppression Matsapha | API + Interface | à écrire |

</details>
