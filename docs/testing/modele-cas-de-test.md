# Comment nous décrire un besoin à tester

> **Pour les formulaires, rien de nouveau à remplir** : les cas de test sont générés à partir de l'onglet du formulaire dans le classeur de métadonnées ([explications](metadonnees/README.md)). Pour un formulaire qui n'a pas encore d'onglet, il existe une [fiche Excel pré-remplie](fiches/README.md). Ce qui suit sert pour les autres besoins (droits d'accès, rapports, parcours patient...).

Pas besoin de format technique. Pour chaque besoin, il suffit de répondre à 3 questions :

1. **Quoi ?** Ce que le système doit faire, en une phrase.
2. **Pour qui ?** Le rôle concerné et le site (ou « tous les sites »).
3. **Un exemple concret** : « Si je fais ceci, je dois voir cela. » Plusieurs exemples, c'est encore mieux, surtout aux limites (ex. score de 4 et score de 5).

Un tableau suffit :

| Quoi ? | Pour qui ? | Si je fais... | Je dois voir... |
|---|---|---|---|
| | | | |

Voir l'[exemple PHQ-9](exemples/REQ-MH-PHQ9-001.md).

## Quelques conseils

- **Soyez précis dans le résultat** : « le score affiché est 14 » plutôt que « le score est correct ».
- **Pensez aussi à ce qui ne doit pas arriver** : « un clinicien ne doit pas pouvoir supprimer un patient ».
- **Un problème vu sur le terrain ?** Décrivez-le de la même façon : il deviendra un test pour qu'il ne revienne pas.
- **Pas de vrais patients** dans les exemples.

Nous nous occupons du reste : numérotation, découpage en cas de test, automatisation.
