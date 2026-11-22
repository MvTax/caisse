# Testeur d'impression

Petite application web (un seul fichier, sans installation) pour tester une imprimante :
texte libre, ticket de caisse simulé ou page de test.

## Lancer

- **Recommandé** : double-cliquez sur `lancer.bat` (Windows) ou `lancer.sh` (Mac/Linux).
  Cela démarre le petit serveur local (`serveur.py`, Python 3 sans dépendance) et ouvre
  la page sur http://127.0.0.1:8642. Laissez la fenêtre noire ouverte.
- Sans serveur : double-cliquez sur `index.html` (Chrome ou Edge). Tout marche sauf
  le test d'IP et l'impression réseau.

## Ça n'imprime rien ?

Cliquez sur **🔧 Lancer le test** (carte Diagnostic). Le test vérifie :

1. que la page n'est pas affichée dans un aperçu intégré, où le navigateur bloque l'impression ;
2. que la boîte d'impression du navigateur s'ouvre bien ;
3. que le serveur local tourne ;
4. quelles imprimantes sont installées sur le poste, avec un bouton pour imprimer une page texte
   par le système, sans passer par le navigateur ;
5. pour une imprimante réseau (IP saisie) : ping, port 9100 (RAW), ports 515/631/80,
   même réseau que le poste, état papier/capot (ESC/POS), puis envoi d'un ticket de test.

**🔍 Chercher les imprimantes réseau** teste toutes les adresses du réseau local sur le port 9100.
**🖨 Imprimer sur l'IP** envoie l'aperçu en cours directement à l'imprimante réseau.

Par sécurité, le serveur n'écoute que sur ce poste (127.0.0.1) et refuse les IP hors réseau local.

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
