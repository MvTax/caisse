# Testeur d'impression

Petite application web (un seul fichier, sans installation) pour tester une imprimante :
texte libre, ticket de caisse simulé ou page de test.

## Lancer

Double-cliquez sur `index.html` (Chrome ou Edge conseillés).
Ou servez le dossier : `python3 -m http.server` puis ouvrez http://localhost:8000.

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
