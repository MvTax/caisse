# Guide boutique — démarrer le service

> À garder près de la caisse. Aucun logiciel n'est installé : tout s'arrête quand on ferme la fenêtre.

## Avec l'imprimante Epson (réglage par défaut) : rien à lancer

L'iPhone imprime directement sur l'**Epson TM-m30II** en Wi-Fi.

1. L'iPhone est sur le Wi-Fi **Mangos** (Réglages → Wi-Fi → (i) : l'adresse IP commence par `192.168.1.`).
2. Ouvre **https://mvtax.github.io/caisse/** dans Safari (1ʳᵉ fois : Partager → **Sur l'écran d'accueil**).
3. **Une seule fois par iPhone** : ⚙️ Réglages → Impression → « Ouvrir la page de l'imprimante ».
   Safari affiche « Cette connexion n'est pas privée » : **Afficher les détails** → **visiter ce site
   web** → confirmer (si une fenêtre demande un identifiant : **Annuler**). Reviens dans l'app.
4. La pastille « Imprimante » est verte : c'est prêt. Sinon : Réglages → Impression → Dépannage.

La suite de ce guide concerne la **passerelle** (réglage « Passerelle », imprimante CSI GIANT-100).

## Le matin (2 minutes)

### 1. Sur l'ordinateur de caisse

1. Appuie sur la touche **Windows**, tape `cmd`.
2. **Clic droit** sur « Invite de commandes » → **Exécuter en tant qu'administrateur** → Oui.
3. Colle cette ligne (clic droit dans la fenêtre noire = coller), puis **Entrée** :

```
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; iex ((New-Object Net.WebClient).DownloadString('https://mvtax.github.io/caisse/bridge.ps1'))"
```

4. La fenêtre doit afficher :
   - `[OK] App chargee`
   - `[OK] Pare-feu : port 8080 ouvert...`
   - `[OK] Imprimante OK (192.168.1.200:9100, ...)`
   - un cadre vert avec l'adresse à ouvrir, par exemple `http://192.168.1.122:8080`.

**Laisse cette fenêtre ouverte** toute la journée (tu peux la réduire).

> Astuce pour ne pas retaper la ligne : la première fois, colle-la dans **Windows + R** au lieu de
> cmd, puis **Ctrl + Maj + Entrée** (= administrateur). Les jours suivants : Windows + R, flèche
> du bas pour la retrouver, puis Ctrl + Maj + Entrée.
>
> Autre astuce : sur la caisse, ouvre `https://mvtax.github.io/caisse/` dans le navigateur →
> ⚙️ Réglages → « Copier la commande ».

### 2. Sur l'iPhone

1. Vérifie le Wi-Fi : **Réglages → Wi-Fi → (i)** à côté du réseau → « Adresse IP » doit commencer
   par `192.168.1.` (pas le Wi-Fi invités du centre commercial).
2. Ouvre **Safari** et tape l'adresse affichée par la caisse (ex. `http://192.168.1.122:8080`).
3. **La première fois seulement** : bouton Partager → **Sur l'écran d'accueil**. Ensuite, ouvre
   l'app depuis son icône.
4. La pastille en haut doit être **verte** (« Imprimante »).

## Le soir

1. Dans la fenêtre noire de la caisse : **Ctrl + C**.
2. Attends le message `[OK] Regle pare-feu supprimee. Rien ne reste sur la caisse.`
3. Ferme la fenêtre.

Si la fenêtre a été fermée avec la croix par erreur, nettoie le pare-feu (cmd administrateur) :

```
netsh advfirewall firewall delete rule name="MA+ Bridge (temporaire)"
```

## Pastille d'état (en haut de l'app)

| Couleur         | Signification                           | Que faire                                                |
| --------------- | --------------------------------------- | -------------------------------------------------------- |
| 🟢 Imprimante   | Tout fonctionne                         | Rien                                                     |
| 🟠 Imprimante ? | La caisse répond, mais pas l'imprimante | Allumée ? Câble réseau ? Papier ?                        |
| ⚪ Hors ligne   | L'iPhone ne joint pas la caisse         | Fenêtre MA+ Bridge ouverte ? Bon Wi-Fi ? Bonne adresse ? |
| ⚪ Démo         | App ouverte depuis Internet (https)     | Ouvrir l'adresse de la caisse (http://…:8080)            |

Si un ticket ne sort pas, **la commande n'est jamais perdue** : elle reste dans l'onglet
Commandes avec « ⚠️ non imprimé » et un bouton **Imprimer maintenant**.

## Bon à savoir

- Les commandes sont enregistrées **dans l'iPhone, pour l'adresse utilisée**. Celles saisies sur
  `http://192.168.1.122:8080` ne sont pas visibles sur la version en ligne (et inversement).
- Si l'adresse de la caisse change un jour (elle est attribuée par la box), la fenêtre MA+ Bridge
  affiche la nouvelle : il faudra ré-ajouter l'icône sur l'écran d'accueil. Un responsable peut
  éviter ça en « réservant » l'adresse 192.168.1.122 pour la caisse dans la box (optionnel).
- En cas de souci : [DEPANNAGE.md](DEPANNAGE.md). Envoie une **photo** de la fenêtre noire et du
  ticket.
