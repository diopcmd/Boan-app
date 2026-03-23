# Prompt de reprise — Projet BOANR
> Colle ce prompt au début d'une nouvelle conversation avec n'importe quelle IA
> pour reprendre le projet exactement où il en est.

---

## Contexte projet

Tu travailles sur **BOANR**, une application web mobile de gestion d'élevage bovin pour la Ferme BOAN au Sénégal (région de Thiès). L'app est une **SPA vanilla HTML/CSS/JS** déployée sur **Vercel**. Le pilotage s'effectue à distance depuis la France.

- **Production** : https://boan-app-ur3x.vercel.app
- **GitHub** : https://github.com/diopcmd/Boan-app (branche `main`)
- **Dossier local** : `C:\Temp\Boan-app\`
- **Langue** : Tout en français (code, UI, communications)
- **Dernier commit** : `3ea8929` — fix: bugs marché prix + durée cycle réel sidebar synchro tous sheets

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | Vanilla JS (ES5 `var`), HTML/CSS inline dans `index.html` (~5273 lignes) |
| Backend | Vercel Serverless Functions (ES Module `export default async function handler`) |
| Auth | Session token custom HMAC-SHA256 (`base64(payload).hmac_hex`), 8h |
| Données | Google Sheets API v4 via Service Account RS256 JWT |
| Déploiement | GitHub → Vercel (auto sur push `main`) |
| IA | Anthropic Claude (proxy via `/api/ai`) |
| Météo | Open-Meteo API (Thiès 14.79°N, -16.93°E) |

---

## Fichiers du projet

```
Boan-app/
├── index.html              SPA complète (~5179 lignes)
├── vercel.json             Rewrites SPA sans bloquer /api/
├── api/
│   ├── auth.js             Login → session token HMAC + SID multi-sheet par rôle
│   ├── token.js            RS256 JWT → access_token Google OAuth2
│   ├── sheets.js           Proxy CRUD Sheets
│   ├── change-password.js  Override mots de passe/identifiants (fondateur)
│   └── ai.js               Proxy Anthropic Claude
├── README.md
├── DOCUMENTATION_TECHNIQUE.md
└── AI_RESUMPTION_PROMPT.md (ce fichier)
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
> dans les deux sheets simultanément. `sidHisto = SID.gerant || SID.fondateur`.

---

## Architecture index.html

### Variables globales JS

```js
var MOCK  = {betes:4, gmq:1.1, stock:6, treso:680000, incidents:0, sem:1, _tresoFromSante:null};
var CYCLE = lsGet('cycle') || { nbBetes:4, dateDebut:'', dureeMois:8, peseeFreq:30, ... };
var SID   = {};  // {fondateur, gerant, rga, fallou} — peuplé au login
var HISTORY    = [];  // saisies fusionnées local + Sheets
var LIVE = { pesees:[], beteIds:[], prix:[], loaded:false };
var SPARK = { gmq:[], stk:[], treso:[], betes:[] };
var _lastSyncTS      = 0;                                   // timestamp dernière synchro Sheets réussie
var _lastFondVisitTS = lsGet('fondateur_last_visit') || 0;  // badge "nouveaux" fondateur
```

### Durée de cycle — règle impérative

```js
// JAMAIS /35 hardcodé — toujours :
var totalSemCycle = Math.round((CYCLE.dureeMois || 8) * 4.33);
var pct = Math.round((sem / totalSemCycle) * 100);
var joursRestants = Math.max(0, (totalSemCycle - sem) * 7);
```

### ES5 strict — règles syntaxe

```js
// JAMAIS : const, let, ?., =>, ??
// TOUJOURS : var, obj&&obj.prop, function(){}, obj||default
// Pas de double virgule ,, dans les objets/arrays — erreur JS fatale silencieuse (page blanche)
```

### loadLiveData — 3 vagues

```
Étape 1 (bloquante) → Config_Cycle!A1:O1 depuis SID.fondateur → synchronise CYCLE

Vague 1 (parallèle) → KPI temps réel :
  Pesees, Stock_Nourriture, KPI_Mensuels, Sante_Mortalite → MOCK.gmq/betes/stock/treso, SPARK.*
  + MOCK._tresoFromSante = capital - somme coûts santé (fallback si KPI vide)

Vague 2 (parallèle) → source: sidHisto = SID.gerant || SID.fondateur :
  7 onglets → buildHistoryFromSheets → HISTORY[]
  Après succès : _lastSyncTS = Date.now()
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
| `Sante_Mortalite` | Gérant + Fondateur | Date, IdBete, Symptome, Traitement, Cout(col5=r[4]), Resultat, Deces |
| `Hebdomadaire` | Gérant + Fondateur | Semaine, NbBetes, Nourriture, Stock, Incidents, Poids, Alerte, Msg |
| `KPI_Mensuels` | Fondateur | col H = trésorerie réelle |
| `Config_Passwords` | Fondateur | role, pwd_base64, updated_at, login_override |
| `Config_Cycle` | Fondateur | A1:O1 infos cycle (nbBetes, dureeMois, capital…) |
| `Suivi_Marche` | Fallou + Fondateur | Date, Foirail, Bas, Moy, Haut, Vol, Note |

---

## Patterns critiques

### updateDureeMois — synchro durée cycle

```js
// Modifie CYCLE.dureeMois localement ET réécrit Config_Cycle!A1:O1 dans les 4 sheets
// Disponible fondateur / rga / fallou depuis la sidebar
// Même effet que saveCycle() sur ce seul paramètre
function updateDureeMois(v) { /* v = 1–60 */ }
```

### msgHtml — convention préfixe ok:

```js
// Succès : S.msg = 'ok:✅ texte affiché'   → détecté avec S.msg.indexOf('ok:')===0
// Erreur  : S.msg = 'err:texte erreur'       → affiché en rouge après .replace('err:','')
// Chargement : S.msg = 'load'
```

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
2. **Pas de `?.` optional chaining** — ES5 uniquement : `obj && obj.prop`
3. **Pas de double virgule `,,`** — erreur JS fatale silencieuse (page blanche)
4. **`TABLE_RANGES`** — déclaré AVANT `function appendRow()`
5. **`USERS` dans `handler()`** — PAS au niveau module (cold start Vercel)
6. **encodeURIComponent** — uniquement sur `sheetName`, JAMAIS sur la plage complète
7. **Détection thème** — TOUJOURS `document.body.classList.contains('light')`
8. **Jamais `INSERT_ROWS`** — toujours pattern read-then-PUT

---

## Features implémentées (état mars 2026)

### Dashboard
- KPIs live : bêtes, GMQ, stock, trésorerie (avec sparklines)
- Alerte GMQ prédictive (comparaison sem. vs sem. -1)
- Synthèse stock cycle (par type d'aliment)
- Bouton "Rapport du jour WhatsApp" (gérant uniquement)
- Bouton IA analyse troupeau (fondateur uniquement)
- Guide gérant "Quoi faire et quand"

### Saisie (gérant)
- Fiche quotidienne : pré-remplie avec OUI/NON par défaut (nourris, eau, enclos=OUI, incident=NON)
- Anti-doublons calendaires (fiche/bilan/sop/pesée/incident/santé)
- Confirmation visuelle : "✅ Envoyé dans Sheets" après soumission
- Bilan hebdo : pré-rempli (nb bêtes depuis MOCK, stock depuis MOCK/localStorage)
- flushQueue auto au retour réseau

### Header
- Timestamp synchro en tooltip sur le point vert (live/cache)
- Badge "+X nouveaux" dans le bouton ☰ (fondateur uniquement)
- Point live/cache/loading uniquement — pas de texte encombrant

### Livrables
- Trésorerie, KPI, Bêtes (courbes de croissance + seuil de rentabilité), Go/No-Go
- Onglet Bêtes : `poidsFinal` calculé dans les 2 branches (LIVE + démo)

### Sidebar
- Durée cycle : champ libre (1–60 mois) + bouton **✓ Valider** — disponible fondateur/rga/fallou — appelle `updateDureeMois(v)` qui synchro `Config_Cycle!A1:O1` dans les 4 sheets
- Rappel pesée : boutons compacts 7/14/21/30j sur une ligne

### Reset cycle
- Réinitialise : HISTORY, STOCK_MVTS, LIVE, MOCK, _lastSyncTS, _lastFondVisitTS, MOCK._tresoFromSante
- Vide les onglets Sheets depuis : **A4** (Fiche_Quotidienne, SOP_Check, Pesees, Hebdomadaire, KPI_*) | **A5** (Stock_Nourriture, Incidents, Sante_Mortalite — ligne 4 protégée)
- Recharge CYCLE depuis Config_Cycle Sheets après reset

### Marché
- Simulateur de vente avec prix dynamique
- Partage WhatsApp synthèse + KPI
- Export PDF rapport mensuel

---

## Historique commits récents

| Commit | Description |
|---|---|
| `3ea8929` | fix: bugs marché prix + durée cycle réel sidebar synchro sheets fondateur/rga/fallou |
| `d6a0cc8` | feat: saisie libre durée cycle simulateur + reset A4→A5 Stock/Incidents/Sante |
| `462b641` | fix: message soumission, validation conso stock, cohérence net, alerte par aliment |
| `6f8cfb2` | fix: stock fondateur — Vague1 sidGerant\|\|sidFondateur + Vague2 reconstruit STOCK_MVTS |
| `d7a8a4b` | fix: STOCK_MVTS reconstitué depuis Sheets pour le fondateur à chaque login |
| `5588542` | docs: mise à jour AI_RESUMPTION_PROMPT + README |
| `71e3354` | fix: reset cycle vide _lastSyncTS, _lastFondVisitTS, MOCK._tresoFromSante |
| `e601921` | ux: sidebar durée cycle + rappel pesée compacts sur une ligne |
| `03e5df9` | ux: bouton rapport WhatsApp dans dashboard + pré-remplissage fiche OUI/NON |
| `62cccb0` | ux: header fondateur épuré — timestamp en tooltip, badge dans ☰ |
| `133cada` | fix: tous /35 → CYCLE.dureeMois dynamique |
| `62ebeb1` | feat: sync Sheets temps réel, auth multi-SID |
