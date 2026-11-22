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
