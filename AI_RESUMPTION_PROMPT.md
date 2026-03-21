# Prompt de reprise — Projet BOANR
> Colle ce prompt au début d'une nouvelle conversation avec n'importe quelle IA
> pour reprendre le projet exactement où il en est.

---

## Contexte projet

Tu travailles sur **BOANR**, une application web mobile de gestion d'élevage bovin pour la Ferme BOAN au Sénégal (région de Thiès). L'app est une **SPA vanilla HTML/CSS/JS** déployée sur **Vercel**. Le pilotage s'effectue à distance depuis la France.

- **Production** : https://boan-app-9u5e.vercel.app
- **GitHub** : https://github.com/diopcmd/Boan-app (branche `main`)
- **Dossier local** : `C:\Users\sg54378\Downloads\Boan-app\`
- **Langue** : Tout est en français (code, UI, communications)
- **Dernier commit** : `5149d5f` — docs: mise à jour README + DOCUMENTATION_TECHNIQUE

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | Vanilla JS (ES5 `var`), HTML/CSS inline dans `index.html` (~4678 lignes) |
| Backend | Vercel Serverless Functions (ES Module `export default async function handler`) |
| Auth | Session token custom HMAC-SHA256 (`base64(payload).hmac_hex`), 8h |
| Données | Google Sheets API v4 via Service Account RS256 JWT |
| Déploiement | GitHub ? Vercel (auto sur push `main`) |
| IA | Anthropic Claude (proxy via `/api/ai`) |
| Météo | Open-Meteo API (Thiès 14.79°N, -16.93°E) |

---

## Fichiers du projet

```
Boan-app/
+-- index.html              SPA complète (~4678 lignes)
+-- vercel.json             Rewrites /api/:path*
+-- api/
¦   +-- auth.js             Login ? session token HMAC + SID multi-sheet par rôle
¦   +-- token.js            RS256 JWT ? access_token Google OAuth2
¦   +-- sheets.js           Proxy CRUD Sheets (peu utilisé directement)
¦   +-- change-password.js  Override mots de passe/identifiants (fondateur)
¦   +-- ai.js               Proxy Anthropic Claude
+-- README.md
+-- DOCUMENTATION_TECHNIQUE.md
+-- AI_RESUMPTION_PROMPT.md (ce fichier)
```

---

## Variables d'environnement Vercel

```
PWD_FONDATEUR, PWD_GERANT, PWD_RGA, PWD_FALLOU
SID_FONDATEUR, SID_GERANT, SID_RGA, SID_FALLOU
SA_PRIVATE_KEY        (clé RSA avec \n escapés en \\n)
SA_CLIENT_EMAIL
SESSION_SECRET        (>= 32 chars)
ANTHROPIC_API_KEY     (optionnel — fonctionnalité IA)
```

---

## Rôles et accès

| Rôle | Identifiant | Onglets | SID reçu au login |
|---|---|---|---|
| Fondateur / Direction | `fondateur` | Dashboard, Saisie, Livrables, Marché | `{fondateur, gerant, fallou}` |
| Gérant terrain | `gerant` | Dashboard, Saisie | `{gerant, fondateur}` |
| RGA | `rga` | Dashboard, Livrables | `{rga, gerant, fondateur}` |
| Commerciale | `fallou` | Dashboard, Marché | `{fallou, fondateur}` |

> **Règle critique** : Le gérant reçoit `SID_FONDATEUR` pour que `writeAll` écrive
> dans les deux sheets simultanément. Le fondateur lit depuis `sidHisto = SID.fondateur || SID.gerant`.

---

## Architecture index.html

### Variables globales JS

```js
var MOCK  = {betes:4, gmq:1.1, stock:6, treso:680000, incidents:0, sem:1};
var CYCLE = lsGet('cycle') || { nbBetes:4, dateDebut:'', dureeMois:8, ... };
var SID   = {};  // {fondateur, gerant, rga, fallou} — peuplé au login
var HISTORY    = [];  // saisies fusionnées local + Sheets
var LIVE = { pesees:[], beteIds:[], prix:[], loaded:false };
var SPARK = { gmq:[], stk:[], treso:[], betes:[] };
```

### Durée de cycle — règle impérative

```js
// JAMAIS /35 hardcodé — toujours :
var totalSemCycle = Math.round((CYCLE.dureeMois || 8) * 4.33);
var pct = Math.round((sem / totalSemCycle) * 100);
var joursRestants = Math.max(0, (totalSemCycle - sem) * 7);
```

### loadLiveData — 3 vagues

```
Étape 1 (bloquante) — Config_Cycle!A1:O1 depuis SID.fondateur ? synchronise CYCLE

Vague 1 (parallèle) — KPI temps réel :
  Pesees, Stock_Nourriture, KPI_Mensuels, Sante_Mortalite ? MOCK.gmq/betes/stock/treso, SPARK.*

Vague 2 (parallèle) — source: sidHisto = SID.fondateur || SID.gerant :
  7 onglets ? buildHistoryFromSheets ? HISTORY[]
  Fiche_Quotidienne, Incidents, Sante_Mortalite, Hebdomadaire, Pesees, SOP_Check, Stock_Nourriture
```

### buildHistoryFromSheets

Fusionne 7 onglets Sheets avec HISTORY local. Déduplication par clé `type|date|champ`. Sheets prime.

---

## Google Sheets — Noms d'onglets EXACTS

| Onglet exact | Spreadsheets | Colonnes |
|---|---|---|
| `Fiche_Quotidienne` | Gérant + Fondateur | Date, NbBetes, Nourris, Eau, Enclos, Incident, Description |
| `SOP_Check` | Gérant + Fondateur | Date, Net, Des, Rat, Eau, Stk, San, Prob |
| `Stock_Nourriture` | Gérant + Fondateur | Date, TypeAliment, kg(±), Ration, Semaines, Alerte |
| `Incidents` | Gérant + Fondateur | Date, IdBete, Type, Gravite(1-3), Description, Action, Cloture |
| `Pesees` | Gérant + Fondateur | Date, IdBete, Race, Poids, PoidsPrec, Gain, Statut |
| `Sante_Mortalite` | Gérant + Fondateur | Date, IdBete, Symptome, Traitement, Cout, Resultat, Deces |
| `Hebdomadaire` | Gérant + Fondateur | Semaine, NbBetes, Nourriture, Stock, Incidents, Poids, Alerte, Msg |
| `KPI_Mensuels` | Fondateur | Sem, Mois, Betes, GMQ, Stock, Treso, Incidents, col H = trésorerie |
| `Config_Passwords` | Fondateur | role, pwd_base64, updated_at, login_override |
| `Config_Cycle` | Fondateur | A1:O1 — config cycle (nbBetes, dureeMois, capital…) |
| `Suivi_Marche` | Fallou + Fondateur | Date, Foirail, Bas, Moy, Haut, Vol, Note |

---

## Patterns critiques

### appendRow — read-then-PUT

```js
// encode sheetName UNIQUEMENT — jamais la plage entière :
var enc = encodeURIComponent(sheetName);
var rows = (d.values || []).filter(function(r){ return r && r.length > 0 && r[0] !== ''; });
var targetLine = Math.min(tr.start + rows.length, tr.end);
// PUT exact — PAS INSERT_ROWS
```

### Détection thème / sidebar

```js
var _sbLt  = document.body.classList.contains('light');  // TOUJOURS classList
var _sbSub = _sbLt ? '#445533' : '#88aa88';
```

---

## Conventions strictes

1. **`var` uniquement** — Pas de `let`/`const` dans `index.html`
2. **Pas de double virgule `,,`** — erreur JS fatale silencieuse (page blanche)
3. **`TABLE_RANGES`** — déclaré AVANT `function appendRow()`
4. **`USERS` dans `handler()`** — PAS au niveau module (cold start Vercel)
5. **encodeURIComponent** — uniquement sur `sheetName`, JAMAIS sur la plage complète
6. **Détection thème** — TOUJOURS `document.body.classList.contains('light')`
7. **Jamais `INSERT_ROWS`** — toujours pattern read-then-PUT
8. **Filter lignes vides** — `r && r.length > 0 && r[0] !== ''`
9. **Jamais `/35` hardcodé** — `Math.round((CYCLE.dureeMois||8)*4.33)`
10. **Gérant multi-SID** — auth.js retourne `{gerant, fondateur}`
11. **PowerShell** — utiliser `;` pour chaîner, jamais `&&`

---

## Commandes de déploiement

```powershell
Set-Location "C:\Users\sg54378\Downloads\Boan-app"
git add index.html
git commit -m "type: description"
git push origin main
# Vercel déploie automatiquement en ~30-60 secondes
```

---

## Historique des commits

```
5149d5f  docs: mise à jour README + DOCUMENTATION_TECHNIQUE
133cada  fix: tous les /35 hardcodés ? CYCLE.dureeMois dynamique
670c2a3  fix: sidebar fondateur bêtes/GMQ dynamiques, bilan, incidents semaine
a42c5e1  fix: buildHistoryFromSheets 7 onglets, filtre par clé
02f9275  fix: gérant reçoit SID_FONDATEUR
6ddec0a  fix: ficheDejaSoumise vérifie HISTORY
62ebeb1  feat: auth multi-SID, loadLiveData 3-étapes, buildHistoryFromSheets, badge LIVE/MOCK
2324772  fix: thème clair mouvements cycle, filter lignes vides appendRow
fe13700  fix: login override, SID fallbacks, Config_Cycle encode
ccf83ab  fix: import crypto statique, encodeURIComponent readSheet
```

---

## Bugs résolus — Référence rapide

| Symptôme | Cause | Fix |
|---|---|---|
| Page blanche au login | `,,` dans `S{}` | Supprimée |
| Écriture décale d'une ligne | cellules formatées vides comptées | filter `r[0] !== ''` |
| `%3A` dans URL, range rejetée | encode URL entière | encode `sheetName` uniquement |
| Login override bloqué | check `USERS[id]` avant API | supprimé |
| Crash API en production | `require()` dans ES Module | `import` statique |
| Fondateur ne voit pas données gérant | Gérant sans `SID_FONDATEUR` | auth.js multi-SID |
| SOP/Stock toujours "jamais" | buildHistoryFromSheets manquait 2 onglets | 7 onglets, filtre par clé |
| Sidebar fondateur couleurs figées | Valeurs MOCK hardcodées | CYCLE dynamique |
| Bilan toujours "En attente" | `h.date===today` | `bilanDejaFaitCetteSemaine()` |
| `/35` affiché même si cycle ? 8 mois | Valeur hardcodée | `Math.round((CYCLE.dureeMois||8)*4.33)` |
