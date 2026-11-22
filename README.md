# MA+ Commander — Mangos Juice Bar

[![CI](https://github.com/MvTax/caisse/actions/workflows/ci.yml/badge.svg)](https://github.com/MvTax/caisse/actions/workflows/ci.yml)

Application de **prise de commande** sur iPhone (outil de préparation, **pas** un logiciel de caisse
fiscal) avec impression des tickets sur l'imprimante thermique de la boutique.

- Version en ligne (démo, sans impression) : https://mvtax.github.io/caisse/
- En boutique : l'app est ouverte depuis l'adresse affichée par la passerelle sur la caisse
  (`http://192.168.1.122:8080`) — **[guide pas à pas](docs/GUIDE_BOUTIQUE.md)**,
  [dépannage](docs/DEPANNAGE.md).
- Testeur d'impression (page autonome, diagnostic de l'imprimante) : https://mvtax.github.io/caisse/testeur/
  — pour tester depuis l'iPhone, lancer la passerelle avec `-AppUrl 'https://mvtax.github.io/caisse/testeur/index.html'`
  (commande complète affichée dans le testeur). Source : `public/testeur/index.html`.

## Développement

```bash
npm install
npm run dev          # serveur de dev
npm run check        # lint + types + tests + build
npm run e2e          # tests de parcours (WebKit, iPhone 15)
PW_CHROMIUM=1 npm run e2e   # idem avec Chromium si WebKit n'est pas installé
```

Cahier des charges complet : [`CLAUDE.md`](CLAUDE.md).

## Mise en ligne (GitHub Pages)

Chaque envoi sur la branche par défaut du repo lance les tests puis publie l'app sur
https://mvtax.github.io/caisse/ (réglage du repo : Settings → Pages → Source = **GitHub Actions**).
