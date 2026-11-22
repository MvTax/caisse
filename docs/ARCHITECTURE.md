# Architecture

Voir `CLAUDE.md` §5 pour la décision complète. Résumé :

```
iPhone (Safari) ──HTTP LAN──▶ caisse Windows : ma-bridge.ps1 ──TCP 9100──▶ CSI GIANT-100
                               (sert l'app + relaie les octets)
GitHub Pages (HTTPS) : héberge index.html (build single-file) + bridge.ps1 ; démo sans impression.
```

## Un seul build, deux usages

Le bridge télécharge en mémoire le `index.html` publié sur GitHub Pages et le sert sur
`http://<ip-caisse>:8080/`. Le même fichier doit donc fonctionner :

- sous `https://mvtax.github.io/caisse/` ;
- à la racine `http://192.168.1.122:8080/`.

C'est pourquoi `vite.config.ts` utilise `base: './'` (chemins relatifs) et
`vite-plugin-singlefile` (JS et CSS inline) plutôt que `base: '/caisse/'`. Les ressources
annexes (icônes PWA, Phase 6) seront référencées de façon à fonctionner dans les deux cas.

## Détection d'origine

`src/app/env.ts` → `detectServingMode()` :

| Origine            | Mode     | Impression                                  |
| ------------------ | -------- | ------------------------------------------- |
| `https:` (Pages)   | `https`  | impossible (mixed content) → message d'aide |
| `http://localhost` | `dev`    | via URL de bridge configurée                |
| `http://<ip LAN>`  | `bridge` | oui, même origine que l'API                 |

## Impression

- **App intelligente** : mise en page et octets ESC/POS dans `src/printing/` (testés).
- **Passerelle bête** : `bridge/ma-bridge.ps1` sert l'app et relaie les octets vers le port 9100.
  Voir [`bridge/README.md`](../bridge/README.md) et [`ESC_POS.md`](ESC_POS.md).
- `printService.ts` journalise chaque essai dans `order.printLog` ; une commande n'est jamais
  perdue si l'impression échoue (feuille « Réessayer / Imprimer plus tard », file des tickets non
  imprimés dans l'onglet Commandes, impression à la demande uniquement).
- Même `jobId` tant qu'aucun essai n'a réussi (la passerelle ignore un doublon si la réponse s'est
  perdue alors que le ticket est sorti) ; nouveau `jobId` pour une réimpression volontaire.

## Conséquences assumées

- `localStorage` est par origine : données de `http://192.168.1.122:8080` ≠ données de Pages.
- Pas de Service Worker sur l'origine HTTP de la passerelle (non sécurisée) : l'app fonctionne
  sans ; la passerelle la re-télécharge chaque matin.
- Si l'adresse de la caisse change (DHCP), l'adresse de l'app change aussi.
