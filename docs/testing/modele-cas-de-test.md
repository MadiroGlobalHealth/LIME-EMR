# Comment nous décrire un besoin à tester

Tout se passe dans le classeur de métadonnées existant, voir [metadonnees/](metadonnees/README.md) :

- **Les règles d'un formulaire** (skip logic, obligatoire, limites) sont déjà dans l'onglet du formulaire : elles deviennent des tests automatiquement.
- **Un autre test sur une question** (calcul, vraisemblance, bouton) : colonnes **Test - If I do...** / **Test - I should see...** à la fin de l'onglet.
- **Un test qui dépasse une question** (parcours patient, plusieurs formulaires, droits d'accès, rapports) : onglet **Test Scenarios**.

## Bien écrire un test

- Un résultat précis : « PHQ-9 score = 27 » plutôt que « le score est correct ».
- Penser aussi à ce qui ne doit **pas** arriver : « pas de bouton Supprimer pour le rôle Clinical ».
- Un problème vu sur le terrain devient un test, pour qu'il ne revienne pas.
- Jamais de données réelles de patients.

Exemple complet sur le PHQ-9 : [exemples/REQ-MH-PHQ9-001.md](exemples/REQ-MH-PHQ9-001.md).
