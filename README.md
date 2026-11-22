# Testeur d'impression

Petite application web (un seul fichier, sans installation) pour tester une imprimante :
texte libre, ticket de caisse simulé ou page de test.

## Lancer

**Un seul fichier à ouvrir : `testeur-impression.py`** (double-clic ; Python 3 nécessaire,
sur Windows : python.org, en cochant « Add python.exe to PATH »).

Une fenêtre noire s'ouvre (laissez-la ouverte), puis la page du testeur s'affiche dans le navigateur
sur http://127.0.0.1:8642. Rouvrir le fichier rouvre simplement la page.

`testeur-impression.py` est généré : il contient `serveur.py` et `index.html`. Après une modification
de l'un des deux, relancez `python3 outils/assembler.py`.

Autres façons de lancer : `lancer.bat` / `lancer.sh` (avec `index.html` et `serveur.py` à côté),
ou `index.html` seul (tout marche sauf le test d'IP et l'impression réseau).

## Modes

- **Texte libre** : tapez votre texte, avec quelques raccourcis (`# Titre`, `---`, `**gras**`, `gauche :: droite`…).
- **Ticket de caisse** : commerce, articles, TVA, paiement (rendu monnaie en espèces), bouton « Ticket aléatoire ».
- **Page de test** : règle de colonnes, alignements, gras, grande taille, accents, symboles, ASCII.

Formats : ticket 58 mm, 80 mm ou A4. Le nombre de caractères par ligne est réglable.

## Imprimer

- **Imprimer** : boîte d'impression du navigateur, fonctionne avec n'importe quelle imprimante.
  La taille de page est calculée à la longueur du ticket. Pour une imprimante ticket,
  réglez les marges sur « Aucune » et l'échelle sur 100 %.
- **Impression directe ESC/POS** (imprimantes thermiques) : envoi brut via WebUSB ou port série
  (Chrome/Edge), avec coupe du papier et ouverture du tiroir-caisse.
  Le bouton **Télécharger .bin** produit les mêmes octets, à envoyer par exemple avec
  `nc IP_IMPRIMANTE 9100 < ticket.bin` ou `lp -d IMPRIMANTE -o raw ticket.bin`.
