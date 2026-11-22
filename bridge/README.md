# MA+ Bridge (`ma-bridge.ps1`)

Passerelle entre les iPhones et l'imprimante. PowerShell **5.1** / .NET Framework uniquement
(Windows 10 1607), aucun module externe, **aucun fichier écrit**, aucune installation.

Mode d'emploi pour la boutique : [`docs/GUIDE_BOUTIQUE.md`](../docs/GUIDE_BOUTIQUE.md).

## Lancement

```
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; iex ((New-Object Net.WebClient).DownloadString('https://mvtax.github.io/caisse/bridge.ps1'))"
```

Le fichier est publié sur GitHub Pages par le build (`vite.config.ts`, plugin `ma-bridge-script`) :
la source unique est `bridge/ma-bridge.ps1`.

**Variante sans Internet** : copier `ma-bridge.ps1` sur une clé USB, puis dans cmd administrateur :
`powershell -NoProfile -ExecutionPolicy Bypass -File E:\ma-bridge.ps1` (le script sert alors une page
de secours : l'app elle-même vient d'Internet). Ce n'est utile que pour dépanner.

Paramètres (avec `-File`) : `-Port 8080 -PrinterIp 192.168.1.200 -PrinterPort 9100 -AppUrl ...
-Token secret -NoFirewall -SelfTest`.

## Ce qu'il fait

1. Vérifie les droits administrateur (nécessaires pour écouter sur `http://+:8080/` et le pare-feu).
2. Active TLS 1.2 et télécharge `index.html` (build single-file) **en mémoire**.
3. Ajoute la règle pare-feu entrante TCP 8080 `MA+ Bridge (temporaire)` : **tous profils** (le réseau
   de la boutique peut être classé « Public ») mais **uniquement le sous-réseau local**. Supprimée
   dans le `finally` (Ctrl+C).
4. Teste l'imprimante, affiche l'adresse à ouvrir sur l'iPhone.
5. Boucle `HttpListener` non bloquante (`BeginGetContext` + `WaitOne(250)`) → Ctrl+C fonctionne.

## API

| Méthode | Route                   | Rôle                                                                                                                                    |
| ------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/`                     | L'app (`text/html`, `no-store`)                                                                                                         |
| GET     | `/api/health?ip=&port=` | `{ ok, version, printer: { ip, port, reachable, latencyMs }, uptimeSec }` (cache 15 s)                                                  |
| POST    | `/api/print`            | `{ data: base64, copies?, jobId, printer?: { ip, port }, label? }` → `{ ok, bytes, ms }` ou `{ ok:false, code:'printer', error }` (502) |
| OPTIONS | `*`                     | CORS + `Access-Control-Allow-Private-Network: true`                                                                                     |

- Impressions sérialisées, une connexion TCP par ticket (le logiciel de caisse partage
  l'imprimante), connexion 3 s, **2 tentatives** espacées de 500 ms.
- Idempotence : un `jobId` déjà imprimé il y a moins de 30 s est ignoré (`duplicate: true`).
- Corps limité à 256 Ko (413 au-delà). Jeton `X-MA-Token` optionnel (`-Token`).
- `/api/drawer` n'existe pas : l'ouverture du tiroir (désactivée par défaut) est ajoutée au ticket
  par l'app (`ESC p`).

## Contraintes du fichier

- **ASCII pur** : `DownloadString` décode avec l'encodage Windows par défaut ; un accent serait
  corrompu. Vérifié par `npm run check:bridge`.
- Le bloc `param()` fonctionne aussi via `iex` (même usage que le script d'installation de
  Chocolatey). `MA_BRIDGE_SELFTEST=1` active l'auto-test dans ce mode.

## Auto-test (CI Windows)

`powershell -File bridge\ma-bridge.ps1 -SelfTest` démarre la passerelle sur le port 18080, une
fausse imprimante TCP sur 127.0.0.1:19100 et un client HTTP dans des runspaces, puis vérifie
17 points : health, page, CORS, impression, octets reçus, doublon, 2 exemplaires, 400, 413, 404,
imprimante éteinte (502 rapide), pare-feu ajouté puis supprimé. Workflows :
`.github/workflows/bridge-windows.yml` (via `-File` et via `iex`) et le job `bridge-live` de
`ci.yml` qui exécute **la commande du matin réelle** contre GitHub Pages après chaque déploiement.

## Piste future (non retenue) : passerelle en HTTPS

Possible avec un certificat auto-signé et un profil de confiance installé sur l'iPhone, ce qui
permettrait d'imprimer depuis la version GitHub Pages. Écarté pour l'instant : génération et
renouvellement du certificat, installation d'un profil iOS, complexité pour l'utilisateur.
