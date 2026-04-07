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
- **Dernier commit** : `a8705a8` — audit passe 3 : 5 bugs corrigés (7 avril 2026)
- **Webhook Vercel** : cassé → redeploy manuel sur vercel.com (Deployments → Redeploy)

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | Vanilla JS (ES5 `var`), HTML/CSS inline dans `index.html` (~8 000 lignes) |
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
├── index.html              SPA complète (~8 000 lignes)
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
| RGA | `rga` | Dashboard, Livrables, Marché | `{rga, gerant, fondateur}` |
| Commerciale | `fallou` | Dashboard, Marché | `{fallou, fondateur}` |

> **Règle critique** : Le gérant reçoit `SID_FONDATEUR` pour que `writeAll` écrive
> dans les deux sheets simultanément. `sidHisto = SID.gerant || SID.fondateur`.

---

## Architecture index.html

### Variables globales JS

```js
var MOCK  = {betes:4, gmq:1.1, stock:6, treso:680000, incidents:0, sem:1, _tresoFromSante:null};
// MOCK.gmq = SOURCE CANONIQUE — toutes les formules inline (dashboard, PDF, guides) lisent MOCK.gmq
// NE PAS recalculer le GMQ directement depuis LIVE.pesees dans les vues
var CYCLE = lsGet('cycle') || {
  nbBetes:4, dateDebut:'', dureeMois:8, peseeFreq:30,
  gmqCible:1.0, gmqWarn:0.8, poidsCible:400, poidsVenteMin:340, tauxMortMax:3,
  coutRevientMax:1100, margeParBeteMin:80000, alerteSeuilTreso:100000,
  simCharges:{}, prixAlim:0, sopProtocol:null, ...
};
var SID   = {};  // {fondateur, gerant, rga, fallou} — peuplé au login
var HISTORY    = [];  // saisies fusionnées local + Sheets
var LIVE = {
  pesees:    [],   // [{date, id, poids, gain, gmq, intervalDays}]
  beteIds:   [],   // IDs actifs (décédés filtrés) — peuplé dans loadPesees()
  deceased:  [],   // IDs décédés — depuis Sante_Mortalite col G='OUI', persisté localStorage 'boanr_deceased'
  prix:      [],   // [{date, foi, bas, moy, haut}] depuis Suivi_Marche
  alimPrix:  [],   // [{date, type, prix}] depuis Suivi_Aliments
  incidents: [],   // [{date, id, type, grav, desc, act, clos}] depuis Vague 2
  loaded:    false,
  source:    'cache'
};
var SPARK = { gmq:[], stk:[], treso:[], betes:[] };
// ── State temporaire SOP Véto ──
// S._sopCtx        : {label, j}|null — contexte pesée SOP (bannière form pesée, nettoyé après submit)
// S._sopInlineIdx  : number|null — index acte SOP en saisie inline (onglet Protocole)
// S._sopInlineData : {id, res} — données du mini-form inline

var _lastSyncTS      = 0;
var _lastFondVisitTS = lsGet('fondateur_last_visit') || 0;
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
| `Sante_Mortalite` | Gérant + Fondateur | Date, IdBete, Symptome, Traitement, Cout(r[4]), Resultat, Deces(r[6]='OUI') |
| `Hebdomadaire` | Gérant + Fondateur | Semaine, NbBetes, Nourriture, Stock, Incidents, Poids, Alerte, Msg |
| `KPI_Mensuels` | Fondateur | col H = trésorerie réelle |
| `Config_Passwords` | Fondateur | role, pwd_base64, updated_at, login_override |
| `Config_Cycle` | Fondateur | **A1:R1** — A=nbBetes, B=dateDebut, C=poidsDepart, D=dureeMois, E=race, F=capital, G=objectifPrix, H=budgetSante, I=ration, J=veterinaire, K=foirail, L=commission, M=contactUrgence, N=peseeFreq, O=betes(JSON), P=stockLines(JSON), **Q=simCharges(JSON)**, **R=prixAlim** |
| `Config_App` | Fondateur | A=clé, B=valeur — extensible (gmqCible, gmqWarn, poidsCible, poidsVenteMin, tauxMortMax, coutRevientMax, margeParBeteMin, alerteSeuilTreso, sopProtocol, dureeMois, lastFicheDate…) |
| `Suivi_Marche` | Fallou + Fondateur | Date, Foirail, Bas, Moy, Haut, Vol, Note |
| `Suivi_Aliments` | Fondateur + RGA + Fallou | Date, Type, Prix/kg — **à créer manuellement** (données ligne 4+) |

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

## ⚠️ AVANT DE TOUCHER AU CODE — Architecture et zones de risque

> **Lire impérativement avant toute modification.** Ce projet a un couplage global élevé : une modification mal ciblée peut casser silencieusement plusieurs parties sans erreur JS visible.

### Modèle de rendu

`r()` est la fonction de re-rendu global. Elle reconstruit **tout le DOM** à chaque appel. Il n'y a aucun VDOM, aucun diff : tout est recalculé. Conséquence : **toute variable globale modifiée est immédiatement visible partout** — y compris dans les vues qui ne sont pas l'objet de la modification.

```js
// r() = function r(){ document.getElementById('app').innerHTML = pageApp(); }
// pageApp() appelle viewDash() | viewSaisie() | viewLiv() | viewMarche() | viewGuide()
// Chaque vue lit directement MOCK.*, CYCLE.*, LIVE.*, HISTORY, STOCK_MVTS
```

### Globaux mutables — carte des dépendances

| Variable | Écrite par | Lue par | Risque |
|---|---|---|---|
| `MOCK.gmq` | `loadPesees()`, `loadLiveData()` Vague 1 | dashboard KPI, sidebar, PDF, IA, alertes, simulateur | **CRITIQUE** — source canonique unique, ne jamais recalculer inline dans les vues |
| `MOCK.betes` | `loadLiveData()` Vague 1+2, `buildHistoryFromSheets()` | dashboard, sidebar, Go/No-Go, PDF, simulateur, WhatsApp | **CRITIQUE** — seedé depuis `CYCLE.nbBetes` au démarrage |
| `MOCK.stock` | `calcStockLocal()`, `loadLiveData()` | dashboard, sidebar, PDF, alertes, IA | **HAUTE** — recalculé depuis `STOCK_MVTS` |
| `MOCK.treso` | `loadLiveData()` Vague 1, `_submitActual` | dashboard, sidebar, PDF, simulateur, Go/No-Go | **HAUTE** |
| `CYCLE.*` | `saveCycle()`, `_syncCycle()`, `lsSet('cycle')`, `loadLiveData()` step1 | partout — pratiquement chaque fonction | **TRÈS HAUTE** — objet central, toute modification doit être suivie de `lsSet('cycle', CYCLE)` |
| `STOCK_MVTS` | `_submitActual('stock')`, `loadLiveData()` Vague 2, `saveCycle()` | `calcStockLocal()`, `calcStockParAliment()`, `stockSyntheseHtml()`, PDF, IA | **HAUTE** — persisté localStorage + Sheets |
| `HISTORY` | `addHistory()`, `buildHistoryFromSheets()`, `saveCycle()` | anti-doublons (`ficheDejaSoumise`, `bilanDejaFaitCetteSemaine`, `joursSince`...), dashboard, sidebar, WhatsApp | **HAUTE** — trié desc par date |
| `LIVE.pesees` | `loadPesees()` | dashboard (GMQ live), section Bêtes, SOP véto pesée, `peseeDejaFaite()` | **MOYENNE** |
| `LIVE.incidents` | `buildHistoryFromSheets()` | dashboard alertes, sidebar score santé, closeIncident | **MOYENNE** |
| `LIVE.deceased` | `loadLiveData()` Vague 1, `saveCycle()` | `beteSelect()`, `beteDropdown()`, `loadPesees()` | **MOYENNE** |
| `S` (state UI) | partout | partout | **NORMALE** — temporaire, re-render only |

### Fonctions à fort impact — ne modifier qu'avec précaution

| Fonction | Impact si modifiée incorrectement |
|---|---|
| `r()` | Tout le rendu cesse |
| `loadLiveData()` | Données Sheets non chargées — app en mode cache |
| `buildHistoryFromSheets()` | Anti-doublons cassés, HISTORY incohérent |
| `_submitActual()` | Soumissions silencieusement perdues |
| `calcSemaine()` | Semaine fausse dans PDF, bilan, KPI, alerte vendredi |
| `calcStockLocal()` | Stock affiché faux sur dashboard + sidebar + alertes |
| `appendRow()` / `readSheet()` | Toutes les lectures/écritures Sheets |
| `doLogin()` / `getTok()` | Auth impossible — app inutilisable |
| `saveCycle()` | Reset cycle corrompu — données cycle perdues |

### Patterns sûrs à suivre

```js
// ✅ BIEN — fonction pure, entrées explicites, pas de mutation globale
function calcStockLocal() {
  var net = {};
  (STOCK_MVTS||[]).forEach(function(m){ ... });
  return Math.round(totalNet / (rationJour * 7) * 10) / 10;
}

// ✅ BIEN — lecture globale en début de fonction, une seule mutation à la fin
function loadPesees() {
  readSheet(...).then(function(rows) {
    var raw = rows.filter(...).map(...);
    // ... calculs ...
    LIVE.pesees = raw;   // une seule mutation à la fin
    MOCK.gmq = _gmqReel; // idem
    r();
  });
}

// ❌ DANGEREUX — mutation globale inline dans une vue
function viewDash() {
  MOCK.gmq = LIVE.pesees.reduce(...); // NE PAS FAIRE — casse les autres vues
  return '<div>...';
}

// ❌ DANGEREUX — modifier CYCLE sans persister
CYCLE.ration = 15; // NE PAS FAIRE sans lsSet('cycle', CYCLE) + _syncCycle()
```

### Règle des mutations CYCLE

Toute écriture dans `CYCLE` doit être suivie de :
```js
lsSet('cycle', CYCLE);      // persiste localStorage
_syncCycle();               // écrit Config_Cycle!A1 dans les 4 sheets
// OU pour les champs Config_App seulement :
_syncConfigApp();           // écrit Config_App!A:B dans sheet fondateur
```

### Signal d'alarme — double virgule `,,`

```js
// Cette erreur provoque une PAGE BLANCHE silencieuse côté mobile :
var obj = { a: 1,, b: 2 };  // ❌ fatal
var arr = [1, 2,, 3];        // ❌ fatal
// Toujours vérifier après génération automatique de code.
```

### Flux de démarrage — ordre exact

```
doLogin() → loadLiveData()
  ÉTAPE 1 (bloquante) : Config_Cycle!A1:R1 + Config_App!A:B
    → CYCLE.* synchronisé, MOCK.betes/treso seedés, wipe si nouveau cycle
  VAGUE 1 (parallèle) : Pesees + Stock_Nourriture + KPI_Mensuels + Sante_Mortalite
    → MOCK.gmq, MOCK.stock, MOCK.treso, MOCK.betes, LIVE.deceased
    → r() — 1er rendu avec données réelles
  VAGUE 2 (parallèle) : 7 onglets → buildHistoryFromSheets() → HISTORY[]
    → LIVE.incidents, MOCK.betes recalculé
    → r() — 2ème rendu complet

Après loadLiveData() : setTimeout(loadPesees, 300)
```

### Index lignes clés — `index.html` (commit `a8705a8`)

```
L352   var USERS          L361   var MOCK           L419  var CYCLE
L484   var HISTORY        L488   var STOCK_MVTS     L895  var ONLINE / OFFLINE_QUEUE
L1148  var TABLE_RANGES   L2186  var LIVE

L368   _nowDakar()        L400   today()            L404  todayISO()
L412   parseISO()         L471   calcSemaine()      L584  calcStockLocal()
L663   addHistory()       L689   peseeDejaFaite()   L698  joursSince()
L751   ficheDejaSoumise() L865   bilanDejaFaitCetteSemaine()
L902   flushQueue()       L1009  r()
L1062  doLogin()          L1121  getTok()
L1163  appendRow()        L1228  readSheet()
L1247  loadLiveData()     L1585  buildHistoryFromSheets()
L1776  doSubmit()         L1871  _submitActual()
L2048  _syncConfigApp()   L2097  _syncCycle()       L2197 loadPesees()
L3766  _archiveCycle()    L3798  saveCycle()        L4349 buildSidebar()
L4957  _joursDepuisDebut() L5014 viewDash()         L5305 viewSaisie()
L6013  viewLiv()          L6776  viewMarche()
```

### Pièges Google Sheets API — gotchas critiques

```js
// 1. TOUJOURS valueRenderOption=UNFORMATTED_VALUE dans readSheet()
//    Sans ça : parseFloat("2 000") = 2 → prix/stocks/poids faux

// 2. encodeURIComponent sur le NOM DE FEUILLE UNIQUEMENT
//    encodeURIComponent('Stock_Nourriture!A4:F200') → '%3A' rejette la plage

// 3. JAMAIS INSERT_ROWS dans les onglets formatés
//    appendRow() = READ colonne A → compter lignes → PUT ligne vide exacte

// 4. Pas d'appendRow() parallèles sur le même onglet/SID
//    → tous lisent row_count=N → s'écrasent à la ligne N+1
//    → utiliser writeAll() ou batch PUT

// 5. Début de données par onglet (TABLE_RANGES L1148) :
//    ligne 4 : Fiche_Quotidienne, SOP_Check, Pesees, Hebdomadaire, Suivi_Marche/Aliments
//    ligne 5 : Stock_Nourriture, Incidents, Sante_Mortalite
//    ligne 2 : Historique_Cycles
```

### Mécanisme hors-ligne

```js
// OFFLINE_QUEUE : persistée localStorage, max 30 items
// flushQueue() : dépile au retour réseau (window 'online' + setTimeout 500ms)
// Ne pas modifier appendRow(sid, range, vals) sans vérifier flushQueue()
// — ils partagent la même signature
```

### Erreurs silencieuses — à connaître

| Situation | Symptôme | Cause |
|---|---|---|
| SID non configuré | "✅ Envoyé" mais rien dans Sheets | `writeAll` ok si au moins 1 SID réussit |
| Token Google > 1h | Données non rechargées | `getTok()` échoue → Vague 1/2 ignorée |
| Double virgule `,,` | Page blanche | Erreur JS fatale non catchée |
| `CYCLE.dateDebut` vide | `calcSemaine()` = 1 | Cycle non initialisé — toujours tester avant les calculs date |

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

### Saisie (gérant) — onglets
- `fiche`, `SOP`, `stock`, `inc`, `pesée`, `santé`, `bilan` + **`📅 SOP Véto`** (lecture seule — calendrier protocole avec statuts ✅/⚠️/🔔/📅 calculés depuis `CYCLE.dateDebut`, compteur réalisés)

### Livrables — onglets fondateur/rga
- Trésorerie, KPI, Bêtes (courbes de croissance + seuil de rentabilité), **Objectifs**, **SOP Véto**, **Calendrier**, Go/No-Go
- Onglet Bêtes : `poidsFinal` calculé dans les 2 branches (LIVE + démo)
- **SOP Véto** : éditeur complet du protocole (ajout/modification/suppression étapes, ↺ réinitialiser, persisté via `saveObjectifs()`)
- **Calendrier** : vue calendrier full — dates théoriques J+N avec statuts couleur, compteur complétés/total

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

### Prix aliments (fondateur / rga / fallou)
- Onglet "Prix aliments" dans Marché — feuille `Suivi_Aliments` (Date, Type, Prix/kg)
- `loadAlimPrix()` : lit depuis `SID.fondateur || SID.fallou || SID.rga`, filtré par `CYCLE.dateDebut`
- Dernier prix par type affiché + historique + rapport mensuel partageable (📤)
- Formulaire saisie : Date + Type (datalist) + Prix/kg → `doSubmit('alim')`

### Calendrier SOP vétérinaire (fondateur / rga / gérant lecture)
- Protocoles calculés depuis `CYCLE.dateDebut` — J15 vaccin, J30 déparasitage, J60 balnéation…
- Statut ✅ fait / 🔔 à venir / ⚠️ en retard calculé automatiquement
- **Seuils** : ±7 j = à temps (✅ comptent dans conformité) ; 8–21j = hors délai (⚠️ bouton orange) ; >21j = bloqué
- **Formulaire inline (santé)** : mini-form bête + résultat directement dans la carte, SANS changer de page
  - Déclenché par `_sopValider(idx)` (sante) → `S._sopInlineIdx = idx`
  - Validé par `_sopInlineSave(idx)` → écrit dans `HISTORY` ET dans `Sante_Mortalite!A:I` (tous SIDs)
- **Pesée SOP** : `_sopValider(idx)` (pesee) → `S._sopCtx = {label, j}` + `S.sub = 'pesee'`
  - Bannière contextuelle aff ichée dans le form pesée
  - `S._sopCtx` nettoyé après soumission réussie (`_submitActual` > `if(type==='pesee') S._sopCtx = null`)
- **Compteur double** : `✅ X · ⚠️ Y / total` (à temps vs tardifs) dans l'en-tête de l'onglet
- Entier personnalisable : fondateur peut ajouter/supprimer/modifier étapes
- Protocole personnalisé persisté dans `Config_App` JSON clé `sopProtocol`
- `SOP_PROTOCOL_DEFAULT` = tableau de référence standard si pas de personnalisation
- **L'éditeur de protocole est UNIQUEMENT dans Livrables > SOP Véto** (il a été retiré de Livrables > Objectifs car doublon)

### Objectifs configurables (fondateur / rga)
- Carte dans Livrables → Objectifs
- **Zootechniques** : `gmqCible` (vert), `gmqWarn` (orange), `poidsCible`, `poidsVenteMin`, `tauxMortMax`
- **Financiers** : `coutRevientMax`, `margeParBeteMin`, `alerteSeuilTreso`
- Tous lus depuis `CYCLE.*` avec fallback (défauts codés dans objet CYCLE initial)
- `saveObjectifs()` → `appendRow()` dans `Config_App` pour chaque valeur (last-wins)
- Propagation immédiate dans tous les KPI, alertes, sidebar, PDF, IA

### Bêtes décédées (tous rôles)
- `LIVE.deceased[]` : IDs des bêtes décédées ce cycle
- **Persisté** en localStorage `boanr_deceased` — survit aux reconnexions
- Peuplé dans `loadLiveData()` depuis `Sante_Mortalite` col G = 'OUI', col B = IdBete
- `LIVE.beteIds` filtré automatiquement après `loadPesees()`
- `rebuildBeteList()` filtre également `LIVE.deceased`
- Remis à zéro (localStorage + mémoire) aux 3 endroits de reset de cycle

### IC et GMQ prédictif (section Bêtes)
- IC (Indice de Consommation) = kg aliment total / kg gain — code couleur ≤8/≤12/>12
- GMQ prédictif = régression linéaire sur 4 dernières pesées → projection poids fin cycle

### Rapports mensuels partageables
- `_rapportFoirail()` : regroupé par foirail, mois courant, min/moy/max + trend
- `_rapportAlim()` : par type, delta vs mois précédent, coût ration estimé
- `shareRapport(txt, title)` : `navigator.share` → `clipboard.writeText` → `execCommand`

---

## Historique commits récents (ordre chronologique)

| Commit | Description |
|---|---|
| `a8705a8` | **audit passe 3** : 5 bugs — `_jourDepuis` NaN alertes (Date.UTC), `_betesV2 >= 0`, STOCK_MVTS kg=0, `joursSince` Date.UTC, `_joursDepuisDebut` fallback retournait 7 |
| `0580668` | **audit passe 2** : 3 bugs — `_joursDepuisDebut` helper, `_alertGmqChute` Date.UTC (2 occurrences), bouton PDF role-gated fondateur/rga |
| `51f5fee` | **audit passe 1** : 7 bugs — Go/No-Go /8, KPI `objGMQ`, `cVetPeriode` prorata, `f.sem` bilan, `Object.values` ES5, GMQ alert DST, santé décès → incident G3 |
| `55e01a2` | fix: semaine bloquée à 1 — `calcSemaine()` utilise `Date.UTC` |
| `8599ed6` | feat: SOP veto inline form + seuil 21j + compteur double, retire SOP des Objectifs (doublon) |
| `2d7eebe` | fix: cohérence GMQ — toutes formules inline unifiées vers MOCK.gmq (source canonique) |
| `7acd693` | fix: SOP véto validation — 3 niveaux selon délai (OK / avertissement 8-14j / bloqué >14j) |
| `85d7e9f` | fix: cohérence dashboard KPI vs sidebar — tréso seuil dynamique, score santé gmqCible |
| `75f1f1e` | feat: guide retour dashboard, fix C003 deceased cycle, SOP véto valider gérant, formules PDF |
| `dd5c3c7` | fix: MOCK.betes seed depuis localStorage au démarrage + guides MAJ |
| `14468d4` | feat: onglet Guide par rôle + 4 guides HTML imprimables en PDF |
| `7db6560` | feat: Objectifs — card Marché & Ration (prixAlim + objectifPrix + mix ration lié + badge date) |
| `5a0ca03` | feat: Historique_Cycles — snapshot avant reset + vue fondateur/rga |
| `fa31f67` | fix: MOCK.betes=4 persistant — sync depuis CYCLE.nbBetes dès step1, decesV2 vague2 |
| `8f676ef` | fix: cycle non démarré (dateDebut vide modale), GMQ diviseur peseeFreq, parseISO dates locales |
| `79eb9a5` | refactor: suppression redondances SOP — calendrier fusionné dans sopvet (Livrables) |

