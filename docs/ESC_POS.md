# ESC/POS — commandes utilisées

Imprimante : **CSI GIANT-100**, émulation **Epson**, port RAW TCP **9100**, code page **PC858**,
massicot automatique. Toute la mise en page est faite dans l'app (`src/printing/`), la passerelle
ne fait que relayer les octets.

| Fonction                             | Octets                                        | Méthode (`EscPos`) |
| ------------------------------------ | --------------------------------------------- | ------------------ |
| Initialisation                       | `1B 40`                                       | `init()`           |
| Code page PC858                      | `1B 74 13`                                    | `codepage858()`    |
| Alignement                           | `1B 61 n` (0 gauche, 1 centre, 2 droite)      | `align()`          |
| Gras                                 | `1B 45 n`                                     | `bold()`           |
| Taille                               | `1D 21 n` (n = (largeur−1)<<4 \| (hauteur−1)) | `size(w, h)`       |
| Inversé (bipper)                     | `1D 42 n`                                     | `invert()`         |
| Saut de ligne                        | `0A`                                          | `newline()`        |
| Avance n lignes                      | `1B 64 n`                                     | `feed(n)`          |
| Coupe partielle                      | `1D 56 42 n`                                  | `cut()`            |
| Tiroir-caisse (désactivé par défaut) | `1B 70 00 19 FA`                              | `openDrawer()`     |

## Largeur

Police A : 48 colonnes sur 80 mm, 32 sur 58 mm (réglable : 32 / 42 / 48). En double largeur, la
ligne fait moitié moins de caractères ; `row()` en tient compte et aligne toujours le prix à
droite, avec retour à la ligne propre des noms longs.

## Encodage PC858 (`cp858.ts`)

CP850 avec `€` en `0xD5` (à la place de `ı`). Table complète 0x80–0xFF vérifiée contre le codec
Python `cp858`. Valeurs clés : `Ç 80, ü 81, é 82, â 83, ä 84, à 85, å 86, ç 87, ê 88, ë 89, è 8A,
ï 8B, î 8C, É 90, ô 93, ö 94, û 96, ù 97, « AE, » AF, ° F8, € D5`.

Caractères absents → translittération : `œ → oe`, `’ → '`, `“ ” → "`, `– — → -`, `… → ...`,
espaces insécables → espace. Emojis supprimés. Lettre accentuée inconnue → lettre de base ;
autre caractère inconnu → `?`.

## Tickets (`ticket.ts`)

- **Préparation** : MA+, n° de commande, **bipper en quadruple taille inversé**, articles groupés
  par catégorie (boissons d'abord), quantités `2x`, suppléments, `>> SUR PLACE <<`, total,
  paiement (reçu / rendu), heure, `Ticket de préparation - non fiscal`, coupe.
- **Test** : `TEST IMPRESSION OK`, adresse imprimante, accents, règle de largeur.
- **Caractères** : toutes les lettres accentuées et symboles, à comparer avec l'écran.
- **Récapitulatif** de journée (non fiscal).

L'aperçu texte (`EscPos.toPreview()` + `renderPreview()`) est utilisé dans les tests et dans
⚙️ Réglages → « Voir l'aperçu d'un ticket de test ».
