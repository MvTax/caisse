# PROMPT MAÎTRE — MA+ Commander (Mangos Juice Bar)

> Repo GitHub : **`caisse`** (déjà créé). Ce fichier est à la racine du repo ; Claude Code le relit à chaque session.
> Les fichiers de référence sont dans `legacy/` (voir §3.0).

---

## 0. Ton rôle et ta façon de travailler

Tu es l'ingénieur principal d'une petite application de prise de commande pour un bar à smoothies. Tu travailles pour un employé de boutique qui **n'est pas développeur**, qui utilise surtout un **iPhone**, et qui n'a **ni Mac ni compte Apple Developer**. Il communique en français, souvent en dictée vocale (donc avec des fautes de frappe et des phrases approximatives : interprète l'intention).

Règles de conduite, dans cet ordre de priorité :

1. **Honnêteté technique absolue.** Ne prétends jamais qu'une fonctionnalité marche si tu ne l'as pas vérifiée. L'historique de ce projet (section 3) contient plusieurs semaines de tentatives qui « semblaient » fonctionner et ne fonctionnaient pas. Si une chose est impossible sur iOS/Safari, dis-le en une phrase et propose l'alternative réelle.
2. **Ça doit marcher en boutique, sur le vrai matériel.** Le critère de réussite n'est pas « le code compile » mais « le ticket sort de l'imprimante CSI GIANT-100 quand on valide une commande sur l'iPhone ».
3. **Planifie avant de coder.** Utilise le mode plan pour chaque phase (section 16). Montre le plan, attends validation pour les choix structurants, puis exécute.
4. **Teste tout ce qui est testable** (calculs de prix en centimes, rendu de monnaie, encodage ESC/POS, migrations de stockage). Lance les tests avant de déclarer une phase terminée.
5. **Commits petits et parlants**, en français ou anglais, un commit par étape logique.
6. **Explique à l'utilisateur en langage simple** ce qu'il doit faire de son côté (sur l'iPhone, sur la caisse), étape par étape, sans jargon.
7. **N'invente aucun fait métier** (dates de création, nombre de boutiques, chiffres) : utilise uniquement les données fournies ici ou demande.

---

## 1. Mission en une phrase

Reconstruire proprement, dans un repo GitHub, l'application web **MA+ Commander** (prise de commande sur iPhone, checklist des commandes, statistiques, encaissement carte/espèces avec rendu de monnaie) **et** rendre l'impression des tickets sur l'imprimante thermique réseau **réellement fonctionnelle**, sans rien installer de façon permanente sur l'ordinateur de caisse.

---

## 2. Contexte métier

### 2.1 L'entreprise
- **Mangos** — bar à smoothies en centre commercial (concept « Juice Bar » anglo-saxon).
- Site actuel (très daté, 2015, WebAcappella) : http://www.mangosjuice.com/index.html
- Boutique de référence : **Centre commercial O'Parinor, 93600 Aulnay-sous-Bois**. Tél 06 68 36 06 09, contact@mangosjuice.com. Horaires affichés sur le site : lun–ven 10h00–20h30, sam 10h00–21h00.
- Autres emplacements cités sur le site : Nice TNL, Toulon Mayol, Marseille Grand Littoral, Rosny 2 (annoncé « coming soon »). Ne pas affirmer qu'ils sont ouverts aujourd'hui sans confirmation.

### 2.2 Comment se passe une commande en boutique (le flux réel)
1. Le client commande au comptoir (souvent plusieurs articles : ex. 4 boissons pour une famille).
2. L'employé saisit la commande sur son **iPhone** dans l'app.
3. L'employé demande le mode de paiement : **carte** ou **espèces**. En espèces, il tape le montant donné par le client et l'app affiche **la monnaie à rendre**.
4. L'employé remet au client un **bipper** (boîtier numéroté) et saisit son **numéro** dans l'app.
5. La commande est validée → un **ticket de préparation** s'imprime automatiquement sur l'imprimante de la boutique.
6. La commande apparaît dans une **checklist** ; quand elle est servie, l'employé la coche.
7. En fin de journée, l'employé consulte les **statistiques** (CA, nombre de chaque produit, carte vs espèces…).

### 2.3 Ce n'est PAS un logiciel de caisse fiscal
La boutique a déjà un vrai logiciel de caisse sur un PC Windows. MA+ Commander est un **outil de prise de commande et de préparation**. Le ticket imprimé est un **ticket de préparation / bon de commande**, pas un ticket de caisse fiscal. Écris en bas du ticket : `Ticket de préparation - non fiscal`. Ne présente jamais l'app comme une caisse enregistreuse.

---

## 3. Historique du projet et leçons apprises (À LIRE ATTENTIVEMENT)

Une première version a été construite par itérations dans une conversation de chat, sous forme d'**un seul fichier HTML** (~2 500 lignes, HTML + CSS + JS vanilla inline). Elle a été utilisée sur iPhone via Safari. Voici ce qui a marché et ce qui a échoué, pour que tu ne répètes pas les erreurs.

### 3.0 Fichiers de référence fournis
Dans `legacy/` :
- `MA_Commander_v1.html` — la v1 complète de l'app (fichier unique).
- `MA_Bridge_ancien_non_valide.bat` — ancienne passerelle, jamais validée sur le matériel.
- `mangos-site-premier-jet.html` — premier jet du site vitrine (contient des faits inventés à retirer, §15).
- `photos/menu-carte-boutique.jpeg` — la carte physique (source du §8 ; vérifie la retranscription).
- `photos/imprimante-ticket-autotest.jpeg` — autotest réseau de la CSI GIANT-100 (§4.1).
- `photos/imprimante-etiquette-ports.jpeg` — étiquette et connectique de l'imprimante.
- `photos/caisse-cmd-arp.jpeg` — `arp -a` sur la caisse (§4.2).
- `screenshots/v1-*.png` — bugs de la v1 : faux scan Wi-Fi listant toutes les IP, test IP en échec, écran blanc « Script error », erreur au clic sur « Bouteille d'eau ». Lis-les pour comprendre l'UX attendue, mais **ne copie pas leur architecture** : ce sont des références, pas une base de code.

### 3.1 Ce qui marchait (à conserver et améliorer)
- Parcours de commande : catégorie → produit → taille / format / suppléments / service → panier multi-articles → paiement → bipper → validation.
- Accueil en « tuiles » (Boissons regroupant Smoothies / Bubble Tea / Milkshakes / Jus / Sodas & Eau ; puis Crêpes & Gaufres, Glaces, Donuts & Muffins, Sandwich).
- Panier avec mini-récap persistant pendant qu'on ajoute des articles.
- Calculateur de monnaie (boutons rapides 5 / 10 / 20 / 50 €, états « à rendre » vert / « compte juste » / « manque » rouge).
- Checklist des commandes avec case à cocher, suppression, fiche détail en bottom-sheet (réimprimer, terminer/rouvrir).
- Tableau de bord statistiques (KPI, par catégorie, top produits, suppléments, service, paiement, affluence par heure, période Aujourd'hui / Tout).
- Réglages au style iOS natif (écran plein, navigation « Retour », groupes de lignes, toggles verts).
- Sauvegarde localStorage des commandes et réglages.

### 3.2 Ce qui a échoué — et pourquoi (NE PAS RECOMMENCER)
| Tentative | Résultat | Cause réelle |
|---|---|---|
| Scanner le Wi-Fi depuis Safari pour « trouver l'imprimante » (timing `Image`, `WebSocket`, `fetch no-cors` + chronométrage) | Listait toutes les IP comme « appareils », ou rien | Un navigateur ne peut pas découvrir le réseau local (pas de mDNS/Bonjour, pas d'ARP, pas de sockets). Les heuristiques de timing sont non fiables. **Supprimer définitivement toute idée de scan.** |
| Envoyer le ticket directement à `192.168.1.200:9100` depuis Safari | Rien ne s'imprime | Aucun JS de navigateur ne peut ouvrir une socket TCP brute. |
| `window.print()` / AirPrint | Inutilisable | La CSI GIANT-100 est une imprimante POS ESC/POS, pas AirPrint. |
| Passerelle PowerShell collée en une ligne géante dans cmd | Fragile, jamais validée en vrai | Échappements cmd/PowerShell imbriqués illisibles ; usage de `if/else` comme argument de méthode sans `$()` (erreur PowerShell) ; port 8080 bloqué par le pare-feu Windows non traité ; `GetContext()` bloquant empêche Ctrl+C. |
| `fetch` avec `AbortController` | Erreur « AbortSignal object could not be cloned » | Survenue dans l'environnement d'aperçu où l'app tournait. Utiliser un timeout robuste (voir §11.6) et tester sur vrai Safari iOS. |
| `onclick="pickItem('Bouteille d'eau')"` | Script error | Apostrophe dans une chaîne injectée dans un attribut HTML. **Jamais de données dans des attributs `onclick` inline** : utiliser des handlers liés à des index/ids. |
| Accolade `jus: {` supprimée par une édition | Écran blanc | Édition par remplacement de texte sur un fichier géant. → Architecture modulaire + TypeScript + tests. |
| Prix stockés en chaînes `"6,50€"` puis `parseFloat` | Risque d'erreurs d'arrondi | **Tous les montants en centimes entiers** (`650`). Formatage uniquement à l'affichage. |
| Étape « 3.5 » pour le choix sur place / à emporter | Code confus | Modéliser le parcours comme une **machine à états** explicite / une pile d'écrans. |

### 3.3 LE problème central que la v1 n'a jamais résolu : le *mixed content*
Si l'app est servie en **HTTPS** (GitHub Pages), Safari **bloque** toute requête `fetch` vers une passerelle locale en **HTTP** (`http://192.168.1.122:8080`). C'est du *mixed content*, impossible à contourner côté page. Toute architecture d'impression doit partir de ce fait (voir §5).

---

## 4. Matériel et réseau (données réelles relevées en boutique)

### 4.1 Imprimante
Ticket d'autotest imprimé par l'imprimante elle-même :

```
CSI GIANT-100            VERSION CSI 1.10
PRINTING SPEED   : 150mm/sec
Ethernet-II INTERFACE
STATIC IP        : 192.168.1.200
PORT             : 9100
SUBNET MASK      : 255.255.255.0
GATEWAY IP       : 192.168.1.1
MAC ADDRESS      : 00:13:62:08:0D:15
RECEIVE BUF SIZE : 64 Kbytes
EMULATION        : EPSON
USE KP BELL      : NO
AUTO-CUTTER      : Enable
CODE PAGE        : PC 858
PRINT DENSITY    : 2 (sur 1-4)
```

- Modèle étiqueté : `MODEL: GIANT-100 CSI`, `POS PRINTER`, 24V 2.5A, Made in Korea (fabrication type Bixolon).
- Connectique arrière observée : USB-B, série, **Ethernet (utilisé)**, **port DK (tiroir-caisse)**.
- **Langage : ESC/POS Epson.** Port RAW TCP **9100**. Massicot automatique actif. Code page **PC858** (= CP850 + symbole €).
- Largeur papier : à confirmer avec l'utilisateur (très probablement 80 mm → **48 colonnes** en police A). Rendre la largeur configurable (32 / 42 / 48).

### 4.2 Ordinateur de caisse
- Windows 10 **version 10.0.14393** (= Windows 10 1607 / LTSB 2016). Utilisateur `CAISSE`.
- IP : **192.168.1.122** (interface `0xe`). Passerelle réseau 192.168.1.1.
- PowerShell **5.1** et .NET Framework disponibles nativement. Pas de Python supposé.
- `arp -a` y montre `192.168.1.200 → 00-13-62-08-0d-15` (l'imprimante).
- **Contrainte forte de l'utilisateur : ne RIEN installer de permanent sur la caisse.** Au maximum, il ouvre `cmd` (en administrateur si nécessaire) et colle **une commande courte** au début du service ; il ferme la fenêtre le soir.

### 4.3 iPhone
- Safari iOS récent. L'app doit être utilisable « ajoutée à l'écran d'accueil ».
- L'iPhone doit être sur le **même réseau** (192.168.1.x) que la caisse et l'imprimante. Prévois un écran d'aide qui explique comment vérifier : Réglages → Wi-Fi → (i) → Adresse IP commence par `192.168.1.`.

---

## 5. Architecture cible (décision argumentée)

### 5.1 Composants
```
 ┌──────────────┐   HTTP (LAN)    ┌─────────────────────────┐   TCP RAW 9100   ┌──────────────────┐
 │  iPhone      │ ──────────────▶ │  Caisse Windows          │ ───────────────▶ │ CSI GIANT-100    │
 │  Safari/PWA  │ ◀────────────── │  ma-bridge.ps1 (mémoire) │ ◀─────────────── │ 192.168.1.200    │
 └──────────────┘                 │  http://192.168.1.122:8080│                 └──────────────────┘
        ▲                         └─────────────────────────┘
        │ HTTPS (consultation hors boutique, dev, téléchargement du bridge)
 ┌──────────────┐
 │ GitHub Pages │  héberge : l'app (build single-file), bridge.ps1, docs
 └──────────────┘
```

### 5.2 La décision clé : en boutique, l'app est servie PAR la passerelle
Pour éviter le *mixed content* (§3.3), en service l'iPhone ouvre **`http://192.168.1.122:8080/`** : la passerelle sert elle-même l'app (même origine que l'API d'impression → pas de mixed content, pas de CORS).

- Au démarrage, `ma-bridge.ps1` **télécharge en mémoire** la dernière version de `index.html` (build single-file) depuis GitHub Pages et la sert. Aucun fichier écrit sur le disque.
- Si la caisse n'a pas Internet : le bridge sert une version embarquée minimale **ou** affiche une erreur claire. (Pose la question à l'utilisateur : la caisse a-t-elle accès à Internet ?)
- La version GitHub Pages (HTTPS) reste utile pour : développement, démonstration, et téléchargement du bridge. Elle doit **détecter** qu'elle ne peut pas imprimer (origine HTTPS) et afficher : « Pour imprimer, ouvre l'app depuis http://192.168.1.122:8080 ».

### 5.3 Conséquences à documenter honnêtement pour l'utilisateur
- `localStorage` est **par origine** : les commandes saisies sur `http://192.168.1.122:8080` ne sont pas visibles sur `https://xxx.github.io` et inversement. → Fournir **export / import JSON** et l'**export CSV**.
- Le **Service Worker** (mode hors-ligne) ne fonctionne pas sur une origine HTTP non-localhost. L'app doit fonctionner sans. Le cache hors-ligne ne vaut que pour la version GitHub Pages.
- Si l'IP de la caisse change (DHCP), l'adresse change. Prévoir un écran d'aide `ipconfig`. (Suggérer à l'utilisateur, sans l'imposer, une réservation DHCP sur la box si un responsable peut la faire.)
- Quand la fenêtre du bridge est fermée, l'URL LAN ne répond plus. C'est voulu (rien de permanent).

### 5.4 Alternative à évaluer puis à rejeter ou retenir explicitement
Bridge en **HTTPS** avec certificat auto-signé + profil de confiance installé sur l'iPhone : techniquement possible mais lourd (génération de certificat, profil iOS, renouvellement). Ne le fais pas sauf demande expresse ; mentionne-le dans `docs/` comme piste future.

### 5.5 Principe « bridge bête, app intelligente »
- **Toute la mise en page du ticket et l'encodage ESC/POS sont faits dans l'app (TypeScript, testés).**
- Le bridge ne fait que : servir l'app, relayer des **octets bruts** (base64) vers 9100, vérifier la joignabilité de l'imprimante. Ainsi le script PowerShell reste court, auditable, et presque jamais modifié.

---

## 6. Stack technique imposée

- **Vite + TypeScript (strict)**.
- UI : **Preact** + `@preact/signals` (léger, syntaxe React). Si tu as une très bonne raison de choisir autre chose, argumente avant.
- CSS : CSS modules ou fichiers CSS par composant + variables CSS. Pas de Tailwind obligatoire (au choix, mais rester léger).
- `vite.config.ts` : `base: '/caisse/'` pour GitHub Pages (et `base: './'` ou équivalent pour le build servi par le bridge — vérifie que les deux fonctionnent).
- Build : **`vite-plugin-singlefile`** pour produire un `dist/index.html` autonome (JS + CSS inline) → c'est ce fichier que le bridge télécharge et sert. Les polices : soit embarquées (subset woff2 en base64), soit fallback système propre si hors-ligne.
- PWA : manifest + icônes (180/192/512, apple-touch-icon), `apple-mobile-web-app-capable`, `viewport-fit=cover`, safe-area. Service Worker via `vite-plugin-pwa` **uniquement actif en HTTPS**.
- Tests : **Vitest** (unitaires), **Playwright** (E2E du parcours de commande en viewport iPhone 15, WebKit).
- Lint/format : ESLint + Prettier.
- CI/CD : **GitHub Actions** → tests + build + déploiement **GitHub Pages**. (Rappel : Pages gratuit nécessite un repo public ; le menu et les prix sont publics de toute façon. Vérifie avec l'utilisateur.)
- Aucune dépendance serveur, aucune base de données distante, aucun compte.

---

## 7. Structure du repo attendue

```
/
├─ CLAUDE.md                     ← ce document
├─ README.md                     ← guide utilisateur simple (FR), captures
├─ docs/
│  ├─ GUIDE_BOUTIQUE.md          ← démarrer le service pas à pas (caisse + iPhone)
│  ├─ DEPANNAGE.md               ← arbre de diagnostic impression
│  ├─ ARCHITECTURE.md
│  └─ ESC_POS.md                 ← commandes utilisées, table CP858
├─ bridge/
│  ├─ ma-bridge.ps1              ← passerelle (PowerShell 5.1)
│  └─ README.md
├─ public/
│  ├─ icons/ …
│  └─ bridge.ps1                 ← copie publiée sur Pages (servie en text/plain)
├─ src/
│  ├─ main.tsx
│  ├─ app/                       ← shell, routing d'écrans, state machine
│  ├─ data/menu.ts               ← SOURCE UNIQUE du menu et des prix
│  ├─ domain/
│  │  ├─ money.ts                ← centimes, formatage fr-FR
│  │  ├─ cart.ts
│  │  ├─ order.ts
│  │  ├─ pricing.ts
│  │  ├─ change.ts               ← rendu de monnaie
│  │  └─ stats.ts
│  ├─ printing/
│  │  ├─ escpos.ts               ← builder ESC/POS
│  │  ├─ cp858.ts                ← encodeur Unicode → CP858
│  │  ├─ ticket.ts               ← mise en page des tickets
│  │  └─ bridgeClient.ts         ← appels HTTP au bridge
│  ├─ storage/
│  │  ├─ store.ts                ← localStorage versionné + migrations
│  │  └─ backup.ts               ← export/import JSON, export CSV
│  ├─ ui/ (composants)
│  └─ styles/
├─ tests/ (unit + e2e)
└─ .github/workflows/deploy.yml
```

---

## 8. Le menu complet (SOURCE DE VÉRITÉ)

Retranscrit depuis la photo de la carte physique de la boutique + précisions de l'utilisateur. Les noms s'écrivent exactement ainsi (y compris « Manatthan », orthographe de la carte). **Tous les prix en centimes dans le code.** Le menu doit être un fichier de config unique et typé, facile à modifier par l'utilisateur plus tard (idéalement aussi éditable dans l'app — voir §9.9).

### 8.1 Tailles des boissons « préparées » (Smoothies, Bubble Tea, Milkshakes, Jus Frais)
| Taille | Prix |
|---|---|
| Petit | 6,50 € |
| Moyen | 6,75 € |
| Grand | 6,95 € |

(Sur la carte physique, ces prix sont affichés à côté des milkshakes ; l'utilisateur a demandé de les appliquer à toutes les boissons préparées. Garde-les par catégorie dans la config pour pouvoir les différencier plus tard.)

### 8.2 Smoothies (14) — taille obligatoire
| Nom | Composition |
|---|---|
| Tahiti | Mangue, papaye, passion, banane, jus de pomme |
| Copacabana | Mangue, melon, ananas, jus de pomme |
| California | Fraise, framboise, ananas, passion, jus de pomme |
| Florida | Mangue, fraise, passion, jus de pomme |
| Miami | Ananas, framboise, coco, gingembre, jus de pomme |
| Punta Cana | Fraise, coco, ananas, jus de pomme |
| Tropicana | Fraise, banane, passion, jus de pomme |
| Cocktail Fresh | Ananas, framboise, fraise, menthe, jus de pomme |
| Mykonos | Mangue, framboise, ananas, passion, jus de pomme |
| Costa Rica | Ananas, fraise, gingembre, jus de pomme |
| Coco des Îles | Ananas, coco, banane, jus de pomme |
| Passion Caraïbe | Mangue, ananas, passion, jus de pomme |
| Bahamas | Fraise, banane, jus de pomme |
| Rouge Passion | Fraise, framboise, ananas, banane, jus de pomme |

### 8.3 Bubble Tea (8) — taille obligatoire
| Nom | Composition |
|---|---|
| Sunset Tea | Thé vert glacé à la passion, perles passion |
| Exotic Tea | Thé vert glacé à la passion, perles ananas |
| Pink Beach | Thé vert glacé à la passion, perles framboise |
| White Peach | Thé vert glacé à la pêche blanche, perles ananas |
| Mango Tea | Thé vert glacé à la mangue, perles ananas |
| Tropical Tea | Thé vert glacé à la mangue, perles passion |
| Red Love | Thé vert glacé à la fraise, perles framboises |
| Red Passion | Thé vert glacé à la fraise, perles ananas |

### 8.4 Milkshakes (5) — taille obligatoire
| Nom | Composition |
|---|---|
| Manatthan | Kinder Bueno, Nutella, glace vanille, crème fouettée |
| Coconut Rio | Coco, Nutella, glace vanille, crème fouettée |
| Red Spéculoos | Spéculoos, fraise, glace vanille, crème fouettée |
| Cookie Mokkie | Oréo, Nutella, glace vanille, crème fouettée |
| Fraccitella | Glace fraise, glace vanille, crème fouettée |

### 8.5 Jus Frais (5) — taille obligatoire
| Nom | Composition |
|---|---|
| Tropical | Mangue, melon, ananas, jus de pomme |
| Exotic Juice | Mangue, passion, papaye, jus de pomme |
| Ibiza | Fraise, banane, passion, jus de pomme |
| Hawaï | Coco, mangue, fraise, jus de pomme |
| Bonne Mine | Ananas, gingembre, menthe, jus de pomme |

### 8.6 Sodas & Eau — prix unitaire, pas de taille
| Nom | Prix | Note |
|---|---|---|
| Soft | 2,50 € | Coca, Fanta, Sprite, etc. Icône **canette** (pas une conserve 🥫). |
| Bouteille d'eau | 2,20 € | Eau plate 50 cl. ⚠️ apostrophe dans le nom → piège historique. |

### 8.7 Crêpes & Gaufres — base 3,95 €
Parcours : **Format** (Crêpe / Gaufre) → **Nappage** (1 obligatoire) → **Suppléments** (0 à N, multi-sélection) → **Service** (À emporter / Sur place).

- Nappages : Chocolat, Sucre, Spéculoos, Caramel, Pistache.
- Suppléments à **0,95 € chacun** : Kinder Bueno/White, Kinder Country, M&M's, Oreo, Spéculoos, Chantilly, Céréales, Banane, Fraise, Framboise.
- Prix = 395 + 95 × nombre de suppléments.
- Affichage panier/ticket : `Gaufre Chocolat` + ligne suppléments + badge `À EMPORTER` / `SUR PLACE`.

### 8.8 Glaces
Parcours : **Format** (Cornet / Pot) → **Taille** (selon format). Pas de parfum (pour l'instant ; prévoir le champ optionnel dans le modèle).

| Format | Taille | Prix |
|---|---|---|
| Cornet | Petit | 3,50 € |
| Cornet | Moyen | 3,95 € |
| Cornet | Grand | 4,50 € |
| Pot | Moyen | 3,95 € |
| Pot | Grand | 4,50 € |

### 8.9 Donuts & Muffins — 3,95 €, sans choix supplémentaire
Deux produits : Donut, Muffin.

### 8.10 Sandwich — 6,95 €, sans choix
Un produit : Sandwich.

### 8.11 Modèle de données suggéré (à affiner)
```ts
type Cents = number; // entier

interface Menu {
  version: number;
  categories: Category[];
  supplementGroups: Record<string, { label: string; unitPrice: Cents; items: string[] }>;
}

interface Category {
  id: 'smoothies' | 'bubble' | 'milkshake' | 'jus' | 'softs' | 'crepes' | 'glaces' | 'donuts' | 'sandwich';
  label: string;
  group?: 'boissons';            // pour la tuile « Boissons » de l'accueil
  icon: string;                  // emoji ou id d'icône
  accent: string;                // couleur
  products: Product[];
  steps: Step[];                 // parcours déclaratif : 'size' | 'format' | 'topping' | 'supplements' | 'service'
  sizes?: { id: string; label: string; price: Cents }[];
  formats?: { id: string; label: string; icon: string; sizes?: {...}[] }[];
  basePrice?: Cents;
}

interface Product { id: string; name: string; description?: string; price?: Cents; icon?: string; }

interface OrderLine {
  lineId: string;
  categoryId: string;
  productId: string;
  displayName: string;           // « Gaufre Chocolat », « Glace Cornet Grand », « Tahiti »
  options: { size?: string; format?: string; topping?: string; supplements?: string[]; service?: 'emporter' | 'surplace' };
  unitPrice: Cents;
  quantity: number;              // permettre ×2, ×3 d'un même article
}

interface Order {
  id: string;                    // uuid
  number: number;                // numéro de commande séquentiel du jour
  bipper: string;
  createdAt: string;             // ISO
  lines: OrderLine[];
  total: Cents;
  payment: { method: 'card' | 'cash'; cashGiven?: Cents; change?: Cents };
  status: 'pending' | 'done';
  doneAt?: string;
  printLog: { at: string; ok: boolean; error?: string }[];
}
```
Le parcours de chaque catégorie est **déclaratif** (`steps`) : un seul moteur d'écrans gère toutes les catégories. Ajouter une catégorie = modifier `menu.ts`, pas le code UI.

---

## 9. Spécification fonctionnelle de l'app

### 9.1 Écran d'accueil
- En-tête marque « MA+ Commander » (logo Pacifico-like, dégradé turquoise `#00b4a6 → #00879c`, accent jaune `#ffc947`), boutons ronds 📊 Statistiques et ⚙️ Réglages, **pastille d'état imprimante** (vert = bridge + imprimante OK, orange = bridge OK imprimante KO, gris = pas de bridge / origine HTTPS).
- Tuile large **Boissons** (🥤🧋🍦) → sous-écran : Smoothies, Bubble Tea, Milkshakes, Jus Frais, Sodas & Eau (tuile large).
- Tuiles : Crêpes & Gaufres, Glaces, Donuts & Muffins, Sandwich.
- Chaque tuile affiche un sous-titre utile (« 14 recettes · dès 6,50 € »).
- Si un panier est en cours : bandeau « 🛒 Panier en cours : 3 articles · 19,45 € — Voir › ».

### 9.2 Parcours d'ajout d'article
- Indicateur d'étapes en haut, **libellés contextuels** : « Choisir le smoothie », « Choisir le bubble tea », « Choisir le milkshake », « Choisir le jus », « Crêpe ou Gaufre ? », « Choisir le nappage », « Suppléments », « Sur place ou à emporter ? », « Cornet ou Pot ? », « Choisir la taille ». **Jamais « Choisir une boisson » pour une crêpe** (bug historique signalé par l'utilisateur).
- Listes de produits : grande zone tactile (≥ 56 px), nom en gras, composition en gris, prix à droite si prix unitaire.
- Taille : 2 ou 3 grosses cartes avec prix.
- Suppléments : grille 2 colonnes de cases à cocher, total recalculé en direct.
- Bouton Retour à chaque étape ; possibilité de changer le format sans tout recommencer.
- Après ajout : retour au **panier** avec animation de confirmation légère + retour haptique si dispo (`navigator.vibrate` n'existe pas sur iOS : ne pas en dépendre).

### 9.3 Panier
- Liste des lignes : icône, nom, options (taille / suppléments / badge service), prix, **stepper quantité (− / +)**, suppression.
- Total en grand.
- Boutons : « ＋ Ajouter un article » et « Valider · N articles › ».

### 9.4 Encaissement (pour TOUTES les commandes)
- Récapitulatif.
- **Mode de paiement obligatoire** : 💳 Carte / 💶 Espèces (gros boutons).
- Espèces : champ montant (clavier décimal, accepte virgule), raccourcis **5 / 10 / 20 / 50 €** + bouton « Compte juste », résultat :
  - vert « À rendre X,XX € » (gros chiffres) ;
  - neutre « Compte juste, rien à rendre » ;
  - rouge « Manque X,XX € » (bloque la validation).
  - Bonus : suggestion de décomposition du rendu (ex. 1 × 2 €, 1 × 1 €, 1 × 50 c), algorithme glouton sur les coupures euro, testé.
- **Numéro de bipper** : clavier numérique, focus auto, mémoriser le dernier numéro et proposer « suivant » (+1) en un tap. Avertir (sans bloquer) si ce bipper est déjà sur une commande non terminée.
- Bouton « ✅ Valider la commande ».

### 9.5 Validation
- Création de l'`Order` (numéro séquentiel du jour), sauvegarde immédiate, toast « Commande #12 · Bipper 7 ».
- Si impression auto activée : envoi au bridge, état visible sur la commande (🖨️ envoyé / ❌ échec + bouton réessayer). **Une commande n'est jamais perdue si l'impression échoue.**
- File d'attente d'impression côté app : si le bridge est hors ligne, proposer « Réessayer » et « Imprimer plus tard » (les tickets en attente s'impriment quand le bridge revient — à la demande de l'utilisateur, pas en silence).

### 9.6 Liste des commandes (checklist)
- Sections « En cours » / « Terminées », compteurs, CA du jour.
- Ligne : case à cocher, résumé des articles, heure, total, badge bipper, état impression, actions (🖨️ réimprimer, ✕ supprimer avec confirmation).
- Tap sur la ligne → **fiche détail** (bottom-sheet) : bipper en grand, liste détaillée, paiement (reçu / rendu), boutons Réimprimer / Terminer-Rouvrir / Supprimer.
- Temps écoulé depuis la commande (« il y a 4 min ») sur les commandes en cours, couleur qui s'intensifie après X minutes (configurable).
- « Supprimer les terminées » avec confirmation.

### 9.7 Statistiques (écran plein)
- Sélecteur de période : Aujourd'hui / Hier / 7 jours / Tout / plage personnalisée.
- KPI : CA, nb commandes, servies / total, panier moyen, articles par commande.
- **Paiement** : carte vs espèces (nombre + CA), total espèces encaissé (utile pour vérifier le tiroir).
- **Par catégorie** : nombre, CA, % du CA, barres.
- **Par produit** : classement complet (pas seulement top 10), quantité + CA, avec **détail par taille** (ex. Tahiti : 3 P / 5 M / 2 G).
- **Suppléments** : quantité par supplément, CA suppléments.
- **Service** : sur place vs à emporter.
- **Glaces** : cornet vs pot, par taille.
- **Affluence par heure** (graphique barres), heure de pointe.
- Export **CSV** (une ligne par article vendu) et **JSON**.
- « Imprimer le récapitulatif de la journée » sur l'imprimante (ticket de synthèse, mention « non fiscal »).

### 9.8 Réglages (style iOS natif)
- **Impression** : statut du bridge et de l'imprimante (tests séparés), IP caisse (défaut `192.168.1.122`), port bridge (défaut `8080`), IP/port imprimante (défaut `192.168.1.200:9100`), largeur ticket (48 col par défaut), nombre d'exemplaires (1 ou 2), impression auto (on), bouton **« 🖨️ Imprimer un ticket de test »**, bouton « Ticket test caractères spéciaux » (é è à ç ù € etc.).
- **Démarrer le service** : la commande de lancement du bridge (§12) affichée en bloc code avec bouton **Copier** fiable sur iOS + instructions illustrées.
- Aide réseau : comment vérifier l'IP de l'iPhone, comment trouver l'IP de la caisse (`ipconfig`), comment retrouver l'IP de l'imprimante (`arp -a | findstr 00-13-62`, ou autotest : éteindre, maintenir FEED, rallumer).
- **Données** : export JSON, import JSON (fusion sans doublons par `id`), export CSV, effacer les commandes (double confirmation), réinitialiser les réglages.
- **Menu & prix** (§9.9).
- Version de l'app + date du build.

### 9.9 Édition du menu (nice-to-have, Phase 6)
Écran pour modifier les prix, désactiver temporairement un produit (rupture), ajouter un produit à une catégorie existante. Les surcharges sont stockées localement et fusionnées avec `menu.ts`. Export/import de cette config.

### 9.10 Exigences transverses
- 100 % utilisable à une main sur iPhone, cibles tactiles ≥ 44 px, safe-area (Dynamic Island, barre home).
- Aucun texte de données utilisateur injecté en HTML brut (échappement systématique via le framework).
- Temps de réponse instantané ; pas de spinner pour les actions locales.
- Mode sombre automatique respectant `prefers-color-scheme` (bonus).
- Accessibilité : labels, contrastes AA, `aria-live` pour les toasts.

---

## 10. Persistance

- `localStorage` clé `ma_commander` avec `{ schemaVersion, settings, orders, menuOverrides, counters }`.
- Migrations versionnées et testées. Importer les données de la v1 si présentes (clé `ma_commander_v2` : `orders` avec `items[].price` en chaînes `"6,50€"`, `bipper`, `time`, `done`, `payment`, `cashGiven`, `change`) → convertir en centimes.
- Écritures après chaque mutation ; protection try/catch (mode privé, quota).
- Rotation : proposer d'archiver (export) au-delà de N jours ; ne jamais supprimer sans action explicite.

---

## 11. Impression — SPÉCIFICATION DÉTAILLÉE (priorité absolue)

### 11.1 Objectif mesurable
Sur le vrai matériel : iPhone ouvre `http://192.168.1.122:8080`, valide une commande → **le ticket sort en < 2 s**, correctement accentué, coupé automatiquement. Le bouton « Ticket de test » fonctionne seul.

### 11.2 Commandes ESC/POS à utiliser (Epson)
| Fonction | Octets |
|---|---|
| Init | `ESC @` = `1B 40` |
| Code page PC858 | `ESC t 19` = `1B 74 13` |
| Alignement | `ESC a n` (0 gauche, 1 centre, 2 droite) |
| Gras | `ESC E n` (1 on, 0 off) |
| Taille | `GS ! n` (0x00 normal, 0x11 double L+H, 0x22 triple, 0x33 quadruple) |
| Inversé (bloc bipper) | `GS B n` |
| Saut de ligne | `LF` = `0A` ; avance n lignes `ESC d n` |
| Coupe partielle avec avance | `GS V 66 n` = `1D 56 42 n` |
| Tiroir-caisse (option, OFF par défaut) | `ESC p 0 25 250` = `1B 70 00 19 FA` |
| Statut temps réel (option) | `DLE EOT n` = `10 04 n` (réponse lue par le bridge) |

Implémente un builder fluide et testé :
```ts
new EscPos({ columns: 48 })
  .init().codepage858()
  .align('center').size(2,2).bold(true).text('MA+').newline()
  .size(1,1).bold(false).text('COMMANDE #12').newline()
  .rule('=')
  .align('center').size(4,4).invert(true).text(' 07 ').invert(false).newline()   // bipper géant
  .align('left').rule('-')
  .row('Tahiti Moyen', '6,75 €')            // gauche/droite alignés sur la largeur
  .row('Gaufre Chocolat', '5,85 €').indentText('+ Oreo, Chantilly')
  .text('  >> À EMPORTER <<').newline()
  .rule('-')
  .size(2,1).row('TOTAL', '12,60 €')
  .rule('-').row('ESPÈCES reçu', '20,00 €').bold(true).row('RENDU', '7,40 €')
  .rule('=').align('center').text('14:32 · 22/11/2026').newline()
  .text('Ticket de préparation - non fiscal').feed(4).cut()
  .toBytes(); // Uint8Array
```

### 11.3 Encodage CP858
- Écris `cp858.ts` : table Unicode → octet pour 0x80–0xFF (CP850 avec 0xD5 = €). Valeurs clés à vérifier par test unitaire : `Ç 80, ü 81, é 82, â 83, ä 84, à 85, å 86, ç 87, ê 88, ë 89, è 8A, ï 8B, î 8C, É 90, ô 93, ö 94, û 96, ù 97, ° F8, € D5`.
- Caractères absents (œ, Œ, ’ typographique, emojis, « ») → translittération (`oe`, `'`, `"`) ; emojis supprimés.
- Ticket de test « caractères » pour validation visuelle en boutique.

### 11.4 Mise en page des tickets (`ticket.ts`)
1. **Ticket de préparation** (par commande) : logo texte MA+, n° de commande, **bipper en très gros**, lignes regroupées par catégorie (boissons d'abord, puis crêpes/gaufres, glaces…), quantité `2×`, options, badge service, total, paiement (carte / espèces + reçu + rendu), heure, mention non fiscal, coupe.
2. Option « 2 exemplaires » (ex. un pour le préparateur boissons, un pour le client).
3. **Ticket de test** : « TEST IMPRESSION OK », IP imprimante, date/heure, ligne de caractères accentués, règle de largeur `123456789…` pour calibrer les colonnes.
4. **Récap journée** : CA, nb commandes, carte/espèces, top produits, suppléments.
Gestion du dépassement de largeur : retour à la ligne propre des noms longs, prix toujours aligné à droite.

### 11.5 Le bridge `ma-bridge.ps1` (PowerShell 5.1, Windows 10 1607)
**Exigences :**
- Compatible **PowerShell 5.1 / .NET Framework** uniquement (pas de PowerShell 7, pas de modules externes).
- **Aucun fichier écrit sur le disque**, aucune tâche planifiée, aucun service. Tout vit dans la fenêtre.
- Démarrage :
  1. Vérifier les droits administrateur ; sinon message clair « Ferme, puis clic droit sur Invite de commandes → Exécuter en tant qu'administrateur ».
  2. Forcer TLS 1.2 : `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12`.
  3. Télécharger `index.html` depuis GitHub Pages en mémoire (`Net.WebClient.DownloadString`), avec fallback si pas d'Internet.
  4. Ouvrir le port dans le pare-feu Windows : règle entrante TCP 8080 **profil Privé/Domaine** nommée `MA+ Bridge (temporaire)` via `New-NetFirewallRule` (ou `netsh advfirewall` en fallback) — et la **supprimer à l'arrêt** dans un bloc `finally`. Afficher aussi la commande manuelle de nettoyage au cas où la fenêtre serait fermée brutalement (le `finally` ne s'exécute pas si on clique sur la croix) : `netsh advfirewall firewall delete rule name="MA+ Bridge (temporaire)"`.
  5. Tester la connexion TCP à l'imprimante et afficher le résultat.
  6. Détecter et **afficher en gros l'URL à ouvrir sur l'iPhone** : `http://<IP-de-la-caisse>:8080` (prendre l'IPv4 de l'interface du réseau 192.168.1.x), et si possible un **QR code en ASCII** dans la console pour l'ouvrir en scannant avec l'appareil photo de l'iPhone (bonus apprécié, implémentation sans dépendance).
- Serveur : `System.Net.HttpListener` sur `http://+:8080/`. Boucle **non bloquante** (`BeginGetContext` + attente par petits pas `WaitOne(250)`) pour que **Ctrl+C** arrête proprement et exécute le `finally`.
- Routes :
  | Méthode | Route | Rôle |
  |---|---|---|
  | GET | `/` | Sert l'app (`index.html` en mémoire), `Content-Type: text/html; charset=utf-8`, `Cache-Control: no-store` |
  | GET | `/api/health` | `{ ok, version, printer: {ip, port, reachable, latencyMs}, uptimeSec }` |
  | POST | `/api/print` | Corps JSON `{ data: "<base64 ESC/POS>", copies?: 1, jobId }` → envoi TCP → `{ ok, bytes, ms }` ou `{ ok:false, error }` |
  | POST | `/api/drawer` | (option) envoie la commande d'ouverture tiroir |
  | OPTIONS | `*` | Préflight CORS |
- En-têtes CORS (pour le dev en `http://localhost:5173`) : `Access-Control-Allow-Origin` (origine exacte ou `*`), `-Methods`, `-Headers: Content-Type`, et `Access-Control-Allow-Private-Network: true` (Private Network Access des navigateurs Chromium).
- Envoi imprimante : `TcpClient` avec timeout de connexion **3 s** (via `BeginConnect` + `WaitOne`), écriture, `Flush`, petite pause, fermeture. **Sérialiser** les impressions (une à la fois). **2 tentatives** avec 500 ms d'intervalle. Idempotence par `jobId` (ignorer un doublon reçu dans les 30 s).
- Limite de taille de requête (ex. 256 Ko) ; refuser le reste.
- Journal console lisible, coloré, horodaté : `[14:32:05] ✔ Commande #12 bipper 07 imprimée (812 octets, 140 ms)` / `✖ Imprimante injoignable (192.168.1.200:9100) – vérifier câble/alimentation`.
- Sécurité minimale (option activable) : jeton partagé `X-MA-Token` affiché dans la console et saisi une fois dans l'app. Désactivé par défaut (réseau de boutique).
- En-tête du script : commentaire expliquant ce qu'il fait, ce qu'il ne fait pas (rien d'installé), comment l'arrêter.
- Le script doit être **lisible et commenté**, pas une ligne géante.

### 11.6 Client bridge côté app (`bridgeClient.ts`)
- Base URL = `location.origin` si l'app est servie par le bridge ; sinon URL configurée (dev).
- Timeout robuste compatible Safari iOS : `Promise.race` entre `fetch` et un timer ; ne pas dépendre d'`AbortSignal.timeout`. (Si tu utilises `AbortController`, teste-le sur Safari réel.)
- Détection d'origine HTTPS → message explicatif au lieu d'un échec obscur.
- Polling `/api/health` toutes les 15 s quand l'app est au premier plan (`visibilitychange`) pour la pastille d'état.
- Erreurs traduites en français simple : « Passerelle injoignable : la fenêtre MA+ Bridge est-elle ouverte sur la caisse ? », « Imprimante injoignable : est-elle allumée et branchée au réseau ? ».

### 11.7 Arbre de dépannage (à mettre dans `docs/DEPANNAGE.md` et dans l'app)
1. L'iPhone affiche-t-il l'app sur `http://192.168.1.122:8080` ? Non → bridge pas lancé / mauvaise IP / pare-feu / iPhone pas sur le bon Wi-Fi.
2. `/api/health` → `printer.reachable=false` ? → imprimante éteinte, câble, IP changée (autotest FEED), autre logiciel qui monopolise le port 9100.
3. Ticket illisible / caractères bizarres → code page (ESC t 19) ou encodage.
4. Ticket pas coupé → commande de coupe / option auto-cutter.
5. Rien ne sort mais `ok:true` → buffer, papier, capot ouvert.
Fournis aussi les commandes de diagnostic Windows : `ping 192.168.1.200`, `powershell -c "Test-NetConnection 192.168.1.200 -Port 9100"`, `arp -a | findstr 00-13-62`, `ipconfig`.

### 11.8 Attention au logiciel de caisse existant
Le logiciel de caisse de la boutique utilise sans doute déjà cette imprimante sur le port 9100. Les imprimantes RAW acceptent généralement des connexions successives, mais **une connexion à la fois**. Ouvrir/fermer la socket à chaque ticket (ne jamais la garder ouverte) et réessayer en cas de refus. Signaler ce point à l'utilisateur et le tester pendant le service.

---

## 12. Lancement du bridge en boutique (expérience utilisateur visée)

Le matin, l'employé :
1. Sur la caisse : touche Windows → tape `cmd` → **clic droit → Exécuter en tant qu'administrateur**.
2. Colle **une seule ligne courte** :
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; iex ((New-Object Net.WebClient).DownloadString('https://<UTILISATEUR>.github.io/caisse/bridge.ps1'))"
   ```
   (Le repo s'appelle `caisse` ; remplace `<UTILISATEUR>` par le compte GitHub — lis-le avec `git remote -v`. Affiche cette ligne exacte dans l'app avec bouton Copier.)
3. La fenêtre affiche en grand l'URL (et le QR code) → sur l'iPhone, ouvrir cette URL dans Safari → **Partager → Sur l'écran d'accueil** (une seule fois).
4. Le soir : Ctrl+C dans la fenêtre (nettoie le pare-feu) puis fermer.

Prévois aussi une **variante hors Internet** : le contenu complet de `bridge.ps1` à coller (documenter comment, via un fichier texte temporaire ou `powershell -Command` multi-ligne), et explique la différence.

Vérifie que `bridge.ps1` est servi par GitHub Pages avec un contenu texte téléchargeable (extension `.ps1` dans `public/`). Teste le téléchargement avec PowerShell 5.1 si tu as accès à un environnement Windows en CI (`windows-latest` dans GitHub Actions : lancer le script en mode `-SelfTest` qui démarre le listener, appelle `/api/health`, simule une imprimante avec un `TcpListener` local sur un port de test, vérifie les octets reçus, et s'arrête). **Ce test CI Windows est fortement souhaité.**

---

## 13. Direction artistique de l'app

- Ambiance : fraîcheur tropicale, propre, « iOS natif amélioré ». Pas d'esthétique générique IA (pas de dégradé violet sur blanc, pas d'Inter partout).
- Couleurs de base de la v1 (à garder, l'utilisateur s'y est habitué) : turquoise `#00b4a6` / `#00879c`, corail `#ff5f6d`, jaune `#ffc947`, vert succès `#34c759`, fond crème `#f7f3ee`, texte `#2d2d2d`, gris secondaire `#9b8ea0`. Couleur par catégorie (smoothies orange, bubble vert d'eau, milkshake rose, jus jaune-orange, softs bleu, crêpes brun, glaces bleu, donuts violet, sandwich orange brûlé).
- Typo : Nunito (UI, arrondie et lisible) + Pacifico (logo uniquement), embarquées en subset pour fonctionner hors Internet ; écrans Réglages en police système iOS (`-apple-system`) pour l'effet natif.
- Animations sobres et rapides (≤ 250 ms), transitions d'écran façon iOS, retour visuel au tap. Respecter `prefers-reduced-motion`.
- Emojis utilisés comme icônes produits dans la v1 : acceptable, mais préférer un set d'icônes SVG cohérent si le temps le permet (canette pour les softs, pas 🥫).

---

## 14. Qualité, tests, CI/CD

### 14.1 Tests unitaires obligatoires (Vitest)
- `money` : formatage `650 → "6,50 €"`, parsing saisie `"20"`, `"20,5"`, `"20.50"`, `""`.
- `pricing` : chaque catégorie, crêpe avec 0/1/5 suppléments, glace cornet/pot × tailles, quantités.
- `change` : rendu exact, manque, compte juste, décomposition en coupures.
- `stats` : agrégations sur un jeu de commandes fixture (par taille, par supplément, par paiement, par heure, filtrage période avec fuseau Europe/Paris).
- `cp858` : table de correspondance + translittération.
- `escpos` / `ticket` : snapshot des octets du ticket de test et d'un ticket de commande complexe ; alignement colonnes 32/42/48.
- `store` : migration v1 → v3 avec une fixture réaliste de la v1.

### 14.2 E2E (Playwright, WebKit, viewport iPhone)
- Commande complète multi-articles (smoothie + gaufre avec 2 suppléments sur place + glace pot grand + bouteille d'eau) → espèces 50 € → rendu correct → bipper → apparaît dans la liste → détail → terminer.
- Bridge mocké (route interceptée) : succès, échec imprimante, timeout.
- Persistance après rechargement.

### 14.3 CI
- Workflow 1 (ubuntu) : lint, typecheck, unit, e2e, build single-file, déploiement Pages sur `main`.
- Workflow 2 (windows-latest) : `bridge.ps1 -SelfTest` avec fausse imprimante TCP.
- Badge de statut dans le README.

---

## 15. Site vitrine Mangos (projet séparé, APRÈS l'app — Phase 7)

L'utilisateur a aussi demandé une refonte du site http://www.mangosjuice.com/index.html. Un premier jet HTML existe (`mangos-site.html` : hero dégradé mangue, typographie Fraunces, sections Concept / Produits filtrables / Chiffres / Boutiques / Recrutement / Footer). À faire, dans un dossier `site/` ou un repo séparé :
- Reprendre **uniquement les faits** du site actuel (adresses, téléphones, horaires, chiffres de fréquentation des centres, texte du concept) et la carte de la section 8. **Ne pas inventer** de date de création, de nombre de boutiques ouvertes ou d'avis clients ; mettre des `TODO` à valider.
- Le premier jet contenait des affirmations non vérifiées (« Depuis 2009 », « 5+ boutiques », © 2025) : les retirer ou les faire valider.
- Photos : demander à l'utilisateur les vraies photos de la boutique et des produits ; ne pas utiliser d'images trouvées sur le web.
- Formulaire de candidature : sans backend, utiliser `mailto:` ou un service de formulaire choisi avec l'utilisateur.
- Mentions légales / RGPD à compléter avec l'utilisateur.

---

## 16. Plan de travail par phases (avec critères d'acceptation)

Avance phase par phase. À la fin de chaque phase : tests verts, commit, résumé en 5 lignes pour l'utilisateur + ce qu'il doit tester.

**Phase 0 — Cadrage (pas de code)**
Vérifie que le contenu du zip est bien à la racine du repo (`CLAUDE.md`, `legacy/`), fais un premier commit « Ajout du cahier des charges et des références » si ce n'est pas déjà fait, regarde les photos de `legacy/photos/`, puis pose les questions de la section 20. Propose l'arborescence, les choix de libs, et le plan détaillé. Attends le feu vert.

**Phase 1 — Socle**
Vite + TS + Preact, lint, Vitest, Playwright, CI, déploiement Pages d'une page « Hello MA+ ». ✅ L'URL Pages s'ouvre sur l'iPhone.

**Phase 2 — Domaine**
`menu.ts` complet (section 8), `money`, `pricing`, `change`, `order`, `stats`, `store` + migrations, avec tests. ✅ 100 % des tests domaine passent ; aucun `parseFloat` sur des prix.

**Phase 3 — UI de commande**
Accueil, sous-écran Boissons, moteur d'étapes déclaratif, panier, encaissement, bipper, liste, détail. ✅ E2E du parcours complet passe ; utilisable à une main sur iPhone.

**Phase 4 — Impression (cœur du projet)**
`cp858`, `escpos`, `ticket`, `bridgeClient`, `bridge.ps1` + `-SelfTest`, workflow Windows, écran Réglages impression, commande de lancement copiable, docs de dépannage. ✅ Self-test CI vert ; **puis test réel en boutique** (section 17) validé par l'utilisateur. Ne déclare pas la phase terminée sans ce retour.

**Phase 5 — Statistiques & exports**
Écran stats complet, CSV/JSON, ticket récap journée. ✅ Chiffres identiques entre l'écran, le CSV et une vérification manuelle sur fixture.

**Phase 6 — Finitions**
PWA (icônes, manifest), mode sombre, édition du menu, accessibilité, performances, README illustré. ✅ Lighthouse PWA/Accessibility ≥ 90 sur la version Pages.

**Phase 7 — Site vitrine** (section 15).

---

## 17. Protocole de test réel en boutique (à remettre à l'utilisateur, en français simple)

1. Caisse : lancer la commande (§12). La fenêtre doit afficher « Imprimante OK (192.168.1.200:9100) » et l'URL.
2. iPhone : vérifier l'IP Wi-Fi en 192.168.1.x. Ouvrir l'URL affichée. La pastille d'état doit être verte.
3. Réglages → « Imprimer un ticket de test » → le ticket sort, accents corrects, € correct, coupé.
4. « Ticket test caractères » → comparer avec l'écran.
5. Faire une vraie commande à 4 articles en espèces → ticket correct, rendu correct.
6. Pendant qu'une vente passe sur le logiciel de caisse, imprimer depuis l'iPhone → vérifier qu'il n'y a pas de conflit.
7. Fermer Safari, rouvrir l'app depuis l'écran d'accueil → commandes toujours là.
8. Ctrl+C sur la caisse → la fenêtre indique que la règle pare-feu est supprimée.
Demande à l'utilisateur des **photos** des tickets et de la fenêtre console en cas de souci.

---

## 18. Ce qu'il ne faut PAS faire

- ❌ Scanner le réseau depuis le navigateur, « détecter » l'imprimante par timing, ou afficher une fausse liste d'appareils.
- ❌ Promettre l'impression directe iPhone → imprimante sans intermédiaire.
- ❌ Écrire une passerelle en une ligne illisible avec échappements imbriqués.
- ❌ Installer quoi que ce soit de permanent sur la caisse (service, tâche planifiée, logiciel, règle pare-feu laissée en place, fichier sur le disque) sans accord explicite.
- ❌ Utiliser des flottants pour l'argent.
- ❌ Injecter des données dans des `onclick` inline / `innerHTML` non échappé.
- ❌ Un fichier unique de 2 500 lignes.
- ❌ Proposer une app Swift native : l'utilisateur n'a ni Mac ni compte développeur (à garder seulement comme piste documentée).
- ❌ Présenter l'app comme une caisse enregistreuse ou le ticket comme un ticket fiscal.
- ❌ Inventer des faits sur l'entreprise.

---

## 19. Glossaire pour l'utilisateur
- **Bridge / passerelle** : petit programme qui tourne dans la fenêtre noire de la caisse et transmet les tickets de l'iPhone à l'imprimante.
- **Bipper** : boîtier numéroté remis au client.
- **ESC/POS** : la « langue » des imprimantes à tickets.
- **Port 9100** : la « porte » réseau par laquelle l'imprimante reçoit les tickets.
- **PWA** : site web qu'on peut ajouter à l'écran d'accueil comme une app.

---

## 20. Questions à poser à l'utilisateur AVANT de coder (Phase 0)
1. Le repo `caisse` est-il **public** (nécessaire pour GitHub Pages gratuit) ? Sinon, quel plan GitHub ? (Le nom du compte se lit avec `git remote -v`.)
2. La caisse Windows a-t-elle **accès à Internet** (pour télécharger le bridge et l'app au démarrage) ?
3. Peux-tu ouvrir `cmd` **en administrateur** sur la caisse ? (Nécessaire pour le port 8080 et le pare-feu.)
4. L'iPhone est-il connecté au **même Wi-Fi** que la caisse (IP en 192.168.1.x) ? Le Wi-Fi « invités » du centre commercial ne fonctionnera pas.
5. Largeur du rouleau de papier : **80 mm** ou 58 mm ?
6. Un ou **deux tickets** par commande (préparation + client) ?
7. Veux-tu un numéro de **commande** en plus du numéro de bipper ? Combien de bippers avez-vous (1–20 ?) ?
8. Veux-tu que l'ouverture du **tiroir-caisse** soit possible depuis l'app pour les paiements en espèces ? (Par défaut : non, c'est le rôle du logiciel de caisse.)
9. Plusieurs employés utilisent-ils l'app **en même temps sur plusieurs iPhones** ? (Si oui, il faudra discuter d'une synchronisation ; par défaut chaque iPhone a ses propres données.)
10. Les prix des boissons (6,50 / 6,75 / 6,95) sont-ils bien les mêmes pour smoothies, bubble teas, milkshakes et jus ?
11. Les glaces ont-elles des **parfums** à choisir ?
12. Pour le site vitrine : as-tu des photos de la boutique et des produits, et qui valide les textes ?

---

*Fin du prompt. Commence par la Phase 0.*
