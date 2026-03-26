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
- **Dernier commit** : `0e956ed` — fix GMQ moyen KPI (intervalles réels) + premier pesée / jours cycle
- **Webhook Vercel** : cassé → redeploy manuel sur vercel.com (Deployments → Redeploy)

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | Vanilla JS (ES5 `var`), HTML/CSS inline dans `index.html` (~6282 lignes) |
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
├── index.html              SPA complète (~6282 lignes)
├── vercel.json             Rewrites SPA (exclut /api/ et /manifest.json)
├── manifest.json           Web App Manifest (PWA — icône, nom, display:standalone)
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

### _syncCycle / updateDureeMois / updatePeseeFreq

```js
// _syncCycle() = helper partagé : réécrit Config_Cycle!A1:O1 dans les 4 sheets
// Champs CYCLE synchronisés automatiquement : dateDebut, nbBetes, poidsDepart,
//   race, ration, capital, objectifPrix, budgetSante, veterinaire, foirail,
//   commission, contactUrgence, peseeFreq, betes[], stockLines[]
// dureeMois est inclus implicitement via CYCLE.dureeMois au moment de l'appel
// Règle : ne JAMAIS faire `CYCLE.peseeFreq=v;lsSet('cycle',CYCLE)` sans appeler _syncCycle()
```

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
- **KPI GMQ moyen** : utilise `LIVE.pesees` (intervalles réels inter-pesées par bête) prioritaire sur `MOCK.gmq` (toujours /7) — badge 🟢 live affiché sur la carte
- **1ère pesée par bête** : GMQ calculé sur jours réels depuis `CYCLE.dateDebut` (plus /30 fixe)
- KPIs live : bêtes, GMQ, stock, trésorerie (avec sparklines)
- Alerte GMQ prédictive (comparaison sem. vs sem. -1)
- Synthèse stock cycle (par type d'aliment)
- **Score santé troupeau** : GMQ (50pts) + Stock (30pts) + Bêtes actives (20pts) − malus incidents ouverts (−8/G3, −4/G2, −2/G1)
- **Alertes intelligentes** : fiche manquante, stock critique, pesée en retard, incidents ouverts, GMQ chute 2 sem., bilan retard >8j, fin cycle ≤2 sem., météo chaleur ≥38°C — toutes dismissables (bouton ×)
- **Bannières dismissables** : reset quotidien automatique
- **Coût/jour** : charges brûlées vs cible (capital/durée cycle)
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
- **Durée cycle** : stepper pur `−` / `+` (sans input — évite reset au re-render) — fondateur/rga/fallou — plage 1–60 mois — `updateDureeMois(v)` → `_syncCycle()`
- **Rappel pesée** : boutons compacts 7/14/21/30j — tous rôles — `updatePeseeFreq(v)` → `_syncCycle()`
- Les deux contrôles synchronisent `Config_Cycle!A1:O1` dans les 4 sheets — tous les acteurs verront la nouvelle valeur au prochain `loadLiveData`
- Durée cycle et Rappel pesée sont dans le `sb-body` scrollable (pas dans le footer fixe)

### PWA — Clavier mobile
- **Viewport** : `interactive-widget=resizes-visual` — Android adapte la mise en page quand le clavier s'ouvre
- **Manifest** : `/manifest.json` lié dans `<head>` — Android Chrome reconnaît correctement le mode standalone
- **CSS** : `touch-action: manipulation` sur inputs/buttons/a — supprime le délai 300ms iOS qui bloquait le clavier
- **iOS** : `apple-mobile-web-app-status-bar-style: black-translucent` ajouté
- **vercel.json** : regex exclut `/manifest.json` du rewrite → `/index.html` (sinon manifest inaccessible)

### Reset cycle
- Réinitialise : HISTORY, STOCK_MVTS, LIVE, MOCK, _lastSyncTS, _lastFondVisitTS, MOCK._tresoFromSante
- Vide les onglets Sheets depuis : **A4** (Fiche_Quotidienne, SOP_Check, Pesees, Hebdomadaire, KPI_*) | **A5** (Stock_Nourriture, Incidents, Sante_Mortalite — ligne 4 protégée)
- Recharge CYCLE depuis Config_Cycle Sheets après reset

### Marché
- `readSheet()` utilise `?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING` — critique pour éviter prix 2 FCFA/kg et dates sérialisées
- **Onglet Prix** : hero card prix actuel en grand + badge tendance (`↑ +150 FCFA vs préc.`) + badge vs objectif
- **Courbe simplifiée** : ligne or épaisse, seul le dernier point highlighted (cercle blanc+or), dates premier/dernier seulement, ligne objectif tiretée verte avec prix à droite
- **Bannière alerte** si dernier prix < objectif
- Pas de boutons filtre foirail (supprimés — inutiles), pas de band bas/haut, pas de labels sur chaque point
- Formulaire saisie : Date + Foirail (select) + Foirail custom si "Autre" + Prix bas/moy/haut
- **Simulateur** : seuil de rentabilité `pxSeuil = ceil(cTotal / (nb * sp * (1-comm/100)))` + badge `_vsSeuilMkt` (% vs seuil)
- Partage WhatsApp synthèse + KPI
- Export PDF rapport mensuel

---

## Historique commits récents

| Commit | Description |
|---|---|
| `0e956ed` | fix: GMQ moyen KPI = LIVE.pesees (intervalles réels) + 1ère pesée / jours cycle vs /30 |
| `6d4762c` | fix: _alertGmqChute not defined — recalculer dans scope viewDash |
| `1791066` | feat: ia+export — GMQ live contexte AI + incidents ouverts, GMQ live PDF |
| `5f66808` | feat: sidebar — gonogo score 8 + ggSante, GMQ semaine live, raccourci pesée gérant |
| `125e79c` | feat: marche — bugfix peseesBete, fraîcheur données reco, bouton reset simulateur |
| `be169ae` | feat: livrables — bugfix treso, KPI GMQ live, flux santé, gonogo santé G3, budget restant/jour |
| `d6ca102` | feat: saisie — alertes fiche NON, bugfix sante res, alerte pesée doublon, score SOP, GMQ bilan |
| `3cecd3f` | feat: dashboard — score santé incidents, alertes meteo/gmq/bilan/fin-cycle, treso cout-jour, bannières dismissables |
| `004a8d2` | feat: recommandations par bête + signal global achat/vente |
| `facdf90` | fix: gmqMoy not defined — utilise bete.gmq (scope correct) |
| `3eb6f53` | fix: loadPrix SID fondateur prioritaire + chTab marche refresh + gmqMoy global |
| `ebb4982` | fix: courbe croissance — date slice 0-5, tri chronologique DD/MM/YYYY |
| `b4dbd5a` | fix: pesée dropdown — LIVE.beteIds conserve toutes les bêtes après soumission |
| `915ee49` | trigger deploy (push vide webhook cassé) |
| `39b0e25` | marche: simplify chart — remove filter & band, hero price + trend badge + clean line |
| `daadc18` | fix: dateTimeRenderOption=FORMATTED_STRING — p.date.slice not a function |
| `eb181ef` | feat: onglet marché — band chart, filtre foirail, seuil rentabilité simulateur |
| `e4ab9a8` | fix: readSheet UNFORMATTED_VALUE — prix 2000 affiché 2 FCFA/kg |
| `319007e` | fix: 3 bugs init cycle fondateur (race stock, calcStockLocal, bilan sidebar) |
| `ca8e541` | fix: bilan hebdo gérant incorrect |
| `c40a723` | fix: bilan hebdo gérant — fallback sidFondateur + no wipe _lastBilanSem |
| `6f2078f` | fix: PWA clavier mobile — viewport interactive-widget + manifest + touch-action |
| `82cff3e` | ux: stepper durée cycle contraste élevé fond vert + valeur lisible |
| `ca27beb` | ux: sidebar durée cycle stepper pur -/+ sans input (évite reset au re-render) |
| `e34c505` | docs: mise à jour docs + chemin local + ligne count |
| `3ea8929` | fix: bugs marché prix + durée cycle réel sidebar synchro sheets |
