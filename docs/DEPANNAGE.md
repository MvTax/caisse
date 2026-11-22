# Dépannage de l'impression

Suivre les questions dans l'ordre. Les mêmes conseils sont dans l'app : ⚙️ Réglages → Dépannage.

## 1. L'iPhone n'affiche pas l'app à l'adresse de la caisse

- La fenêtre noire **MA+ Bridge** est-elle ouverte sur la caisse, sans message rouge ?
- L'iPhone est-il sur le **Wi-Fi de la boutique** ? Réglages → Wi-Fi → (i) : adresse en `192.168.1.x`.
- L'adresse a-t-elle changé ? Sur la caisse, dans cmd : `ipconfig` → « Adresse IPv4 ». La fenêtre
  MA+ Bridge affiche aussi l'adresse exacte.
- Message `Impossible d ecouter sur le port 8080` : une autre fenêtre MA+ Bridge est déjà ouverte
  (la fermer), ou un autre programme utilise le port 8080.
- Message `Droits administrateur manquants` : relancer cmd par clic droit → Exécuter en tant
  qu'administrateur.
- Message `Impossible d ouvrir le pare-feu` : un antivirus gère peut-être le pare-feu ; le
  signaler.

## 2. Pastille orange / « Imprimante injoignable »

- Imprimante **allumée**, voyant vert, **capot fermé**, **papier** présent ?
- **Câble réseau** bien branché derrière l'imprimante (prise Ethernet, pas la prise « DK » du
  tiroir) ?
- Sur la caisse (cmd) :
  - `ping 192.168.1.200` → doit répondre « Réponse de 192.168.1.200 ».
  - `powershell -c "Test-NetConnection 192.168.1.200 -Port 9100"` → `TcpTestSucceeded : True`.
  - `arp -a | findstr 00-13-62` → retrouve l'adresse réelle de l'imprimante si elle a changé.
- Ticket d'autotest : éteindre l'imprimante, **maintenir FEED**, rallumer. Il affiche l'adresse IP
  et le port (192.168.1.200 / 9100). Si l'adresse est différente, la corriger dans
  ⚙️ Réglages → Adresses réseau → IP de l'imprimante.
- Le **logiciel de caisse** imprime peut-être au même moment : l'imprimante n'accepte qu'une
  connexion à la fois. La passerelle réessaie une fois ; sinon, réimprimer depuis l'app.

## 3. Ticket illisible / caractères bizarres

- Imprimer « Ticket test caractères » (⚙️ Réglages) et comparer avec l'écran.
- Le ticket d'autotest doit indiquer `CODE PAGE : PC 858`. L'app envoie aussi la commande
  `ESC t 19` (PC858) au début de chaque ticket.

## 4. Le ticket ne se coupe pas

- Ticket d'autotest : `AUTO-CUTTER : Enable` doit apparaître.
- Lame bloquée par un bout de papier : ouvrir le capot et nettoyer.

## 5. L'app dit « imprimé » mais rien ne sort

- Papier épuisé ou rouleau à l'envers (la face thermique doit être vers la tête d'impression).
- Capot mal fermé.
- Regarder la fenêtre MA+ Bridge : une ligne verte `[OK] ... imprime (xxx octets)` confirme que les
  octets ont été remis à l'imprimante.

## 6. Le ticket est trop large / trop étroit

- ⚙️ Réglages → Colonnes : 48 pour un rouleau de 80 mm, 32 pour 58 mm.
- Le ticket de test imprime une règle `1234567890…` : elle doit tenir exactement sur une ligne.

## Commandes utiles (cmd sur la caisse)

| Commande                                                                | À quoi ça sert                                                             |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `ipconfig`                                                              | Adresse de la caisse (IPv4)                                                |
| `ping 192.168.1.200`                                                    | L'imprimante répond-elle ?                                                 |
| `powershell -c "Test-NetConnection 192.168.1.200 -Port 9100"`           | Le port d'impression est-il ouvert ?                                       |
| `arp -a \| findstr 00-13-62`                                            | Retrouver l'adresse de l'imprimante (adresse matérielle 00-13-62-08-0d-15) |
| `netsh advfirewall firewall delete rule name="MA+ Bridge (temporaire)"` | Nettoyer le pare-feu si la fenêtre a été fermée par la croix               |

En cas de doute, envoyer une **photo de la fenêtre noire** et **du ticket**.
