# Volt Volley

Jeu de volley arcade dans le navigateur, en **3D** (three.js) et en **2D** (canvas), sans installation ni build.

## Jouer

- Ouvre `index.html` dans un navigateur, puis choisis la version 3D ou 2D.
- Ou lance un petit serveur local depuis ce dossier :

  ```powershell
  python -m http.server 8000
  ```

  puis va sur <http://localhost:8000>.

La version 3D charge three.js depuis jsdelivr.net : il faut une connexion Internet.

## Contenu

- **35 styles** répartis en 7 raretés (Commun → Évo), 6 rôles et des pouvoirs sur la touche `E`
- **10 explosions de point** (dont un trou noir qui aspire les joueurs), **11 balles** et **20 titres**
- Matchs **1v1, 2v2 et 3v3** contre l'IA, avec des coéquipiers qui te font la passe (3D)
- **Mode classé** : Bronze → Argent → Or → Platine → Diamant → Maître → Légende (3D)
- Caméra automatique, libre (clic droit maintenu) ou verrouillée (`Shift`) (3D)

## Commandes (3D)

| Action | Touche |
|---|---|
| Se déplacer | `ZQSD` / `WASD` / flèches |
| Sauter | `Espace` (pas de contrôle en l'air) |
| Smash en l'air · réception au sol · service | clic gauche / `J` |
| Set en l'air | clic droit / `L` |
| Inclinaison du smash ou du service | directions gardées pendant la frappe |
| Plongeon | `K` |
| Pouvoir | `E` |
| Caméra libre · caméra auto · verrouillage | clic droit maintenu · `C` · `Shift` |
| Pause | `Échap` |

La progression (pièces, styles, rangs) est enregistrée dans le navigateur (`localStorage`), partagée entre la 2D et la 3D.

## Structure

```
index.html        page d'accueil
volley/           version 2D (un seul fichier)
volley3d/         version 3D
  data.js         styles, raretés, boutique, sauvegarde, sons
  world.js        arène, terrain, filet, personnages, balles
  fx.js           particules et explosions
  game.js         physique, IA, pouvoirs, classé, HUD, menus
```
