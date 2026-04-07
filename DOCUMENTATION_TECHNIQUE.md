# DOCUMENTATION TECHNIQUE — BOAN App

Référence développeur pour l'application de gestion d'élevage **BOAN**.  
**Commit HEAD** : `a8705a8` — ~8 000 lignes — 7 Avril 2026

---

## 0. ⚠️ ZONES DE RISQUE — À lire avant toute modification

> Ce projet a un **couplage global élevé**. Une modification mal ciblée peut casser silencieusement plusieurs parties sans erreur JS visible (notamment page blanche mobile).

### Modèle de rendu — `r()`

```js
// r() reconstruit TOUT le DOM à chaque appel — aucun diff, aucun VDOM
// pageApp() → viewDash() | viewSaisie() | viewLiv() | viewMarche() | viewGuide()
// Chaque vue lit directement MOCK.*, CYCLE.*, LIVE.*, HISTORY, STOCK_MVTS
// => Modifier un global ANYWHERE = impact immédiat sur TOUTES les vues
```

### Carte des dépendances — globaux critiques

| Variable | Mutée par | Impact si corrompue |
|---|---|---|
| `MOCK.gmq` | `loadPesees()`, `loadLiveData()` Vague 1 | Dashboard KPI, sidebar, PDF, IA, alertes, simulateur — **source canonique, ne jamais recalculer inline dans les vues** |
| `MOCK.betes` | `loadLiveData()` Vague 1+2, `buildHistoryFromSheets()` | Dashboard, Go/No-Go, PDF, simulateur — seedé depuis `CYCLE.nbBetes` au démarrage |
| `MOCK.stock` | `calcStockLocal()`, `loadLiveData()` | Dashboard, sidebar, alertes — recalculé depuis `STOCK_MVTS` |
| `MOCK.treso` | `loadLiveData()` Vague 1, `_submitActual` | Dashboard, PDF, simulateur, Go/No-Go |
| `CYCLE.*` | `saveCycle()`, `_syncCycle()`, `loadLiveData()` step1 | **PARTOUT** — objet central, toute mutation doit être suivie de `lsSet('cycle', CYCLE)` |
| `STOCK_MVTS` | `_submitActual('stock')`, `loadLiveData()` Vague 2, `saveCycle()` | `calcStockLocal()`, PDF, IA — persisté localStorage + Sheets |
| `HISTORY` | `addHistory()`, `buildHistoryFromSheets()`, `saveCycle()` | Tous les anti-doublons (`ficheDejaSoumise`, `bilanDejaFaitCetteSemaine`, `joursSince`) — **trié desc** |
| `LIVE.pesees` | `loadPesees()` | GMQ live dashboard, section Bêtes, SOP véto pesée |
| `LIVE.deceased` | `loadLiveData()` Vague 1, `saveCycle()` | `beteSelect()`, `beteDropdown()`, `loadPesees()` |

### Fonctions à fort impact — modifier avec précaution

| Fonction | Conséquence si cassée |
|---|---|
| `r()` | Tout le rendu cesse |
| `loadLiveData()` | App bloquée en mode cache |
| `buildHistoryFromSheets()` | Anti-doublons cassés, HISTORY incohérent |
| `_submitActual()` | Soumissions silencieusement perdues |
| `calcSemaine()` | Semaine fausse dans PDF, bilan, KPI, alerte vendredi |
| `calcStockLocal()` | Stock faux sur dashboard + sidebar + alertes |
| `appendRow()` / `readSheet()` | Toutes les lectures/écritures Sheets |
| `saveCycle()` | Reset cycle corrompu — données perdues |

### Règle des mutations CYCLE

```js
// Toute écriture dans CYCLE doit être suivie de :
lsSet('cycle', CYCLE);   // localStorage
_syncCycle();            // Config_Cycle!A1 → 4 sheets
// OU pour champs Config_App uniquement :
_syncConfigApp();        // Config_App!A:B → sheet fondateur
```

### Patterns sûrs vs dangereux

```js
// ✅ BIEN — fonction pure, résultat retourné, pas de mutation globale
function calcStockLocal() {
  var net = {};
  (STOCK_MVTS||[]).forEach(function(m){ /* ... */ });
  return Math.round(total / (rationJour * 7) * 10) / 10;
}

// ✅ BIEN — une seule mutation globale à la fin du fetch
function loadPesees() {
  readSheet(...).then(function(rows) {
    var raw = /* calculs locaux */;
    LIVE.pesees = raw;    // mutation finale unique
    MOCK.gmq = gmqReel;   // idem
    r();
  });
}

// ❌ DANGEREUX — mutation globale dans une fonction de rendu
function viewDash() {
  MOCK.gmq = LIVE.pesees.reduce(/* ... */); // casse toutes les autres vues
  return '<div>...';
}

// ❌ DANGEREUX — double virgule → page blanche silencieuse mobile
var obj = { a: 1,, b: 2 };  // fatal
var arr = [1, 2,, 3];        // fatal
```

### Flux de démarrage — ordre d'appel exact

```
doLogin()
  └─► getTok() → POST /api/auth → {ok, role, name, tabs, sid}
        └─► S.user = role, SID = sid
              └─► loadLiveData()                           ← déclenché une seule fois au login
                    │
                    ├─ ÉTAPE 1 (bloquante ~500ms)
                    │   readSheet(fondateur, 'Config_Cycle!A1:R1')
                    │   readSheet(fondateur, 'Config_App!A:B')
                    │   → synchronise CYCLE.* depuis Sheets
                    │   → MOCK.betes = CYCLE.nbBetes (fix flash "4 bêtes")
                    │   → détection changement de cycle → wipe HISTORY/LIVE/STOCK_MVTS
                    │
                    └─ step1.then()
                          │
                          ├─ VAGUE 1 (parallèle ~1s) ← Promise.all
                          │   Pesees!A4:G200           → MOCK.gmq, SPARK.gmq
                          │   Stock_Nourriture!A4:F200 → MOCK.stock, STOCK_MVTS, SPARK.stk
                          │   KPI_Mensuels!A4:K50      → MOCK.treso, SPARK.treso
                          │   Sante_Mortalite!A4:G200  → MOCK.betes, LIVE.deceased, SPARK.betes
                          │   → LIVE.source = 'live'
                          │   → r()  ← 1er rendu avec données réelles
                          │
                          └─ VAGUE 2 (parallèle ~1-2s) ← Promise.all (7 onglets)
                              Fiche_Quotidienne, SOP_Check, Stock_Nourriture (full),
                              Incidents, Pesees (full), Sante_Mortalite (full), Hebdomadaire
                              → buildHistoryFromSheets() → HISTORY[]
                              → LIVE.incidents = [...]
                              → MOCK.betes recalculé depuis décès Vague 2
                              → _lastSyncTS = Date.now()
                              → r()  ← 2ème rendu complet

                    Après loadLiveData() :
                    setTimeout(loadPesees, 300)   ← GMQ réel inter-pesées par bête
                    // Si type==='marche' :
                    setTimeout(loadPrix, 400)
                    setTimeout(loadAlimPrix, 500)
```

> **Source des données par onglet** : `sidDataSource = SID.gerant || SID.fondateur`  
> Le gérant écrit via `writeAll([SID.gerant, SID.fondateur])` → données toujours dans les deux sheets.

### Pièges Google Sheets API — gotchas critiques

#### 1. `valueRenderOption=UNFORMATTED_VALUE` — OBLIGATOIRE dans `readSheet()`
```js
// Sans ce paramètre, l'API retourne les valeurs formatées selon la locale du sheet :
// "2 000" au lieu de "2000" → parseFloat("2 000") = 2 → prix faux, stock faux
// "01/04/2026" peut devenir un numéro de série (46013) si le format de cellule est Date
// → TOUJOURS utiliser ?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING
```

#### 2. `encodeURIComponent` sur le nom de feuille UNIQUEMENT — jamais sur la plage
```js
// ✅ CORRECT :
var enc = encodeURIComponent('Stock_Nourriture');  // "Stock_Nourriture"
var url = '.../values/' + enc + '!A4:F200?...';

// ❌ FAUX — encodeURIComponent(':') = '%3A' → l'API Sheets rejette la plage
var url = '.../values/' + encodeURIComponent('Stock_Nourriture!A4:F200');
```

#### 3. Pattern read-then-PUT — JAMAIS `INSERT_ROWS` dans les onglets formatés
```js
// Les onglets ont des en-têtes et un formatage conditionnel.
// INSERT_ROWS décale les lignes et casse le formatage.
// appendRow() fait : READ colonne A → compter lignes non vides → PUT à la 1ère ligne vide
//
// TABLE_RANGES (L1148) définit start/end par onglet :
//   Fiche_Quotidienne : start=4, end=500   ← données à partir de la ligne 4
//   Stock_Nourriture  : start=5, end=500   ← ligne 4 protégée (sous-titres)
//   Incidents         : start=5, end=200   ← idem
//   Historique_Cycles : start=2, end=200   ← ligne 1 = en-têtes seulement
```

#### 4. Création automatique d'onglet
```js
// appendRow() tente de créer l'onglet automatiquement si l'API retourne
// "Unable to parse range" ou "not found" — via batchUpdate addSheet
// puis réessaie l'écriture une seule fois
// Si l'onglet n'existe toujours pas → {ok:false, err:'Impossible de créer...'}
```

#### 5. Écriture batch vs appendRow parallèles
```js
// ❌ DANGEREUX — plusieurs appendRow() simultanés sur le même onglet :
// Chacun lit row_count=N au même instant → tous écrivent à la ligne N+1 → écrasement
// ✅ CORRECT — écriture batch unique (voir saveCycle() stockLines L3967)
// Pour les writes multirôles : writeAll([SID.gerant, SID.fondateur], range, vals)
// → Promise.all sur les SIDs, pas plusieurs appendRow() parallèles sur le même SID
```

### Mécanisme hors-ligne — `OFFLINE_QUEUE`

```js
// Déclaration (L895-L920) :
var ONLINE = navigator.onLine;
var OFFLINE_QUEUE = lsGet('offline_queue') || [];  // persisté localStorage

// Quand une soumission échoue hors connexion :
function saveToQueue(type, vals) { /* push + lsSet */ }  // appelé dans _submitActual si !ONLINE

// Reprise automatique au retour réseau :
window.addEventListener('online', function(){ ONLINE=true; r(); setTimeout(flushQueue, 500); });

// flushQueue() (L902) : dépile OFFLINE_QUEUE un par un (300ms entre chaque)
// → appendRow(SID.gerant, item.range, item.vals)
// Si echec → remise en tête de queue
// Capacité max : 30 items (OFFLINE_QUEUE.slice(-30))
```

> **Ne pas modifier `appendRow()`** sans vérifier que `flushQueue()` fonctionne toujours —  
> ils partagent la même signature `(sid, range, vals)`.

### Erreurs silencieuses — cas à connaître

| Situation | Symptôme apparent | Cause réelle |
|---|---|---|
| SID non configuré dans Vercel | "Envoyé ✅" mais rien dans Sheets | `appendRow()` retourne `{ok:false}` si `!sid` — mais l'UI affiche `ok:` si au moins un SID réussit dans `writeAll` |
| Onglet inexistant dans le sheet | Formulaire semble envoyer | `appendRow()` tente de créer l'onglet — si permissions insuffisantes, retourne `{ok:false}` |
| Token Google expiré (>1h) | Données non rechargées | `getTok()` échoue silencieusement → `readSheet()` retourne `null` → Vague 1/2 ignorée |
| Double virgule `,,` dans index.html | Page blanche, aucune erreur console | Erreur de syntaxe JS fatale non catchée |
| `CYCLE.dateDebut` vide | Calculs `calcSemaine()` = 1, stock = 0 | Cycle non initialisé — toujours tester `if (CYCLE.dateDebut)` avant les calculs basés sur les dates |
| `writeAll` avec aucun SID valide | Console warning uniquement | `validSids.filter(Boolean)` retourne `[]` → `{ok:false, err:'SID non configuré'}` — l'utilisateur voit le message d'erreur |

---

## 1. Stack technique

| Couche | Technologie | Détails |
|---|---|---|
| Frontend | Vanilla JS ES5 | `var` uniquement — pas de const/let/arrow functions |
| SPA | Single `index.html` | HTML + CSS + JS inline, ~7 804 lignes |
| Hosting | Vercel | Déploiement automatique depuis GitHub `main` |
| Backend | Vercel Serverless Functions | `/api/*.js` — Node.js |
| Base de données | Google Sheets API v4 | 4 spreadsheets (une par rôle) |
| Auth | HMAC Session Cookie | `SESSION_SECRET` + HttpOnly |
| IA | Anthropic Claude claude-sonnet-4 | Proxy via `/api/ai.js` |
| PWA | manifest.json | display: standalone, icône, nom |

**Contrainte ES5** — obligatoire pour compatibilité navigateurs anciens :
```javascript
// CORRECT — ES5
var items = [];
function fetchData(url, cb) { ... }
items.forEach(function(x) { ... });

// INTERDIT — ES6+
const items = [];
const fetchData = (url) => { ... };
items.forEach(x => { ... });
```

---

## 2. Architecture

### 2.1 Flux d'authentification

```
Browser → POST /api/auth { role, password }
  → auth.js: compare PWD_ROLE env var, génère SID = SID_ROLE
  → Set-Cookie: session=HMAC(role+SID+secret) HttpOnly Secure SameSite=Strict
  → Retourne { ok: true, role, name, tabs }

Browser → GET/POST /api/sheets { range, values }
  → sheets.js: vérifie cookie session HMAC, extrait SID
  → Appelle Google Sheets API v4 avec Access Token
  → Retourne données JSON
```

### 2.2 Obtention du token Google

`/api/token.js` — Service Account OAuth2 :
- Signe un JWT avec `SA_CLIENT_EMAIL` + `SA_PRIVATE_KEY` (RSA)
- Échange le JWT contre un Access Token OAuth2 (durée 1h)
- Mis en cache en mémoire Vercel jusqu'à l'expiration

### 2.3 Routing frontend

`vercel.json` — Rewrites :
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/manifest.json", "destination": "/manifest.json" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 3. Variables globales clés (index.html)

### USERS — définition des rôles
```javascript
var USERS = {
  fondateur: {name:'Direction',      tabs:['dashboard','saisie','livrables','marche','guide']},
  gerant:    {name:'Gerant terrain', tabs:['dashboard','saisie','guide']},
  rga:       {name:'RGA',            tabs:['dashboard','livrables','marche','guide']},
  fallou:    {name:'Commerciale',    tabs:['dashboard','marche','guide']},
};
```

### MOCK — valeurs d'affichage live
```javascript
var MOCK = {
  betes: 4,            // seedé depuis CYCLE.nbBetes localStorage au démarrage
  gmq:  1.1,           // remplacé par calcul réel dès que pesées présentes (MOCK.gmq = source canonique)
  stock: 6,            // recalculé depuis STOCK_MVTS localStorage
  treso: 680000,       // seedé depuis CYCLE.capital localStorage au démarrage
  sem:  1,             // calculé depuis CYCLE.dateDebut
  mois: 1,
  _tresoFromSante: null
};
// Règle : toutes les formules inline (dashboard, KPI, PDF, guides) utilisent MOCK.gmq comme
// source canonique — NE PAS recalculer le GMQ directement depuis LIVE.pesees dans les vues.
```

**Seed au démarrage** (après `var CYCLE = lsGet('cycle') || {...}`) :
```javascript
// Evite le flash "4 betes" avant la sync Sheets
if (CYCLE.nbBetes && CYCLE.nbBetes > 0) MOCK.betes = CYCLE.nbBetes;
if (CYCLE.capital && MOCK.treso === 680000) MOCK.treso = CYCLE.capital;
```

### CYCLE — objet cycle en cours
```javascript
var CYCLE = lsGet('cycle') || {
  dateDebut: '',          // ISO YYYY-MM-DD — démarrage du cycle
  nbBetes: 4,
  poidsDepart: 270,
  race: 'Djakore',
  ration: 12,             // kg/jour/bête
  capital: 1450000,       // FCFA
  objectifPrix: 2000,     // FCFA/kg poids vif — objectif vente
  prixAlim: 0,            // FCFA/kg aliment — prix mid-cycle
  _mktUpdated: '',        // DD/MM/YYYY — date dernière modif paramètres marché
  gmqCible: 1.1,          // kg/jour
  gmqWarn: 0.9,
  poidsCible: 380,        // kg — objectif poids vente
  poidsVenteMin: 350,
  tauxMortMax: 5,         // %
  coutRevientMax: 900,    // FCFA/kg
  margeParBeteMin: 50000, // FCFA
  alerteSeuilTreso: 200000,
  mixSon: 60,             // % son de blé dans ration (lié : mixSon + mixTourteau = 100)
  mixTourteau: 40,        // % tourteau d'arachide
  sopProtocol: [...],     // tableau des étapes SOP vétérinaires J+N
  // ... autres champs
};
```

### State temporaire SOP Véto (dans l'objet S global)

| Clé | Type | Rôle |
|---|---|---|
| `S._sopCtx` | `{label, j}` ou `null` | Contexte pesée SOP — bannière dans le form pesée, nettoyé après submit |
| `S._sopInlineIdx` | `number` ou `null` | Index acte SOP en cours de saisie inline (onglet Protocole) |
| `S._sopInlineData` | `{id, res}` | Données du mini-form inline (bête + résultat) |
```

---

## 4. Helpers utilisés nativement (ES5)

### Dates
```javascript
function parseISO(iso) {
  // Convertit YYYY-MM-DD en Date locale sans décalage UTC
  // Remplace new Date(iso) qui décale d'un jour en UTC-1 ou UTC+1
  var p = iso.split('-');
  return new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
}

function today()    { return new Date(); }
function todayISO() { var d = today(); return d.getFullYear()+'-'+ ... }
function isoToFr(iso) { // YYYY-MM-DD → DD/MM/YYYY
  var p = iso.split('-'); return p[2]+'/'+p[1]+'/'+p[0];
}
```

### localStorage wrappers
```javascript
function lsSet(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
function lsGet(k)    { try { return JSON.parse(localStorage.getItem(k)); } catch(e) { return null; } }
```

### Google Sheets
```javascript
// Ajouter une ligne à un onglet
function appendRow(sid, range, vals) {
  return fetch('/api/sheets', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({sid:sid, range:range, values:[vals], action:'append'})
  });
}

// Lire une plage
function readSheet(sid, range) {
  return fetch('/api/sheets?sid='+sid+'&range='+encodeURIComponent(range))
    .then(function(r){ return r.json(); });
}
```

---

## 5. Fonctions clés

### saveObjectifs() — persistance Config_App
Écrit dans `Config_App!A:B` du sheet fondateur :
- gmqCible, gmqWarn, poidsCible, poidsVenteMin, tauxMortMax, coutRevientMax
- margeParBeteMin, alerteSeuilTreso, mixSon, mixTourteau
- **prixAlim, objectifPrix, _mktUpdated** *(ajout commit 7db6560)*
- dureeMois, sopProtocol (JSON)

### saveCycle() — persistance Config_Cycle
Écrit dans `Config_Cycle!A1:S1` (colonnes A–N standard + P=dureeMois + Q=simCharges + R=prixAlim + **S=numCycle**).  
**Avant la mise à jour** : appelle `_archiveCycle()` si le cycle est terminé.

**Reset à l'init cycle** — variables remises à zéro dans `saveCycle()` (audit Avril 2026) :
```javascript
// Après Object.assign(CYCLE, MODAL.data) :
CYCLE.gonogo     = {contrats:false, infra:false, assurance:false, securite:false};
CYCLE.simCharges = {};       // charges simulateur spécifiques au cycle sortant
CYCLE._mktUpdated = '';      // date modif marché — repart de zéro
S._sopEd = null; S._sopInlineIdx = null; S._sopCtx = null; S._sopInlineData = {};
LIVE._histCycles = null;     // cache férimé — forcé à recharger depuis Sheets
```

### _archiveCycle(snap) *(commit 5a0ca03, mis à jour 6fb1b19)*
Archive un snapshot du cycle terminé dans `Historique_Cycles!A:O` :
```javascript
function _archiveCycle(snap) {
  var row = [
    snap.dateDebut,         // A — Début (ISO YYYY-MM-DD)
    isoToFr(snap.dateFin),  // B — Fin (DD/MM/YYYY)
    snap.duree,             // C — Durée (jours)
    snap.race,              // D — Race
    snap.foirail,           // E — Foirail/lieu de vente
    snap.nbBetes,           // F — NbBêtesDépart
    snap.nbBetesFin,        // G — NbBêtesFin
    snap.deces,             // H — Décès
    snap.poidsDepart,       // I — PoidsDépart moyen (kg)
    snap.poidsFin,          // J — PoidsFin moyen (kg)
    snap.gmq,               // K — GMQ réalisé (kg/j)
    snap.capital,           // L — Capital investi (FCFA)
    snap.tresoFin,          // M — TrésoFin (FCFA)
    margeParBete,           // N — Marge brute / bête (FCFA)
    snap.numCycle || ''     // O — Numéro de cycle
  ];
  appendRow(SID.fondateur, 'Historique_Cycles!A:O', row);
}
```

### _sopValider(idx) — déclenchement acte SOP
Appelée depuis les boutons ✅ / ⚠️ de l'onglet Protocole :
- **Pesée** → `S._sopCtx = {label, j}` + `S.sub = 'pesee'` (bannière affichée dans le formulaire de pesée)
- **Santé** → `S._sopInlineIdx = idx` + `S._sopInlineData = {id:'', res:'Guéri'}` (mini-form inline dans la carte)
- Guard : acte bloqué si >21 jours après la date planifiée

### _sopInlineSave(idx, tous) *(refonte complète — commits 32c081e + 61fc2c0)*

Valide le formulaire inline d'un acte Santé SOP avec suivi **par bête** :

| Paramètre | Valeur | Comportement |
|---|---|---|
| `tous=true` | Bouton "🐄 Toutes les bêtes restantes" | Crée une entrée par bête restante — ferme le form |
| `tous=false` | Bouton "✅ 1 bête" | Crée une entrée pour la bête sélectionnée — form reste ouvert si d'autres restent |

**Champ `sopLabel`** (commit 61fc2c0) : chaque entrée créée par `_sopInlineSave` porte `sopLabel: evt.label`. La détection `_fait` l'utilise pour isoler les étapes de même type proches dans le temps :
```javascript
// Avant fix : Vitamine AD3E (J+1) et Déparasitage (J+7) — écart 6j < fenêtre ±7j
//   => une validation en déclenchait une autre
// Après fix : si h.sopLabel existe && h.sopLabel !== evt.label => ignoré
if(h.sopLabel !== undefined && h.sopLabel !== null && h.sopLabel !== evt.label) return;
// Entrées manuelles santé (sans sopLabel) : comportement inchangé (date-based)
```

**Format de l'entrée** :
```javascript
{ type:'sante', date:td, id:bid, sopLabel:evt.label, sym:evt.label,
  tra:evt.note||'Acte SOP vét.', cout:'', res:d.res||'Guéri', dec:'', bcs:'', muq:'' }
```

- Pousse dans `HISTORY` + `lsSet('history', HISTORY)`
- Écrit dans `Sante_Mortalite!A:I` via `appendRow` pour **tous les SIDs disponibles**
- Met à jour `CYCLE._lastSanteDate`
- Ne redirige pas — reste sur l'onglet Protocole

### _pdDone / _pdPartial — compteurs SOP (refonte 32c081e)
```javascript
// _pdDoneCount  : étapes où TOUTES les bêtes ont été traitées (✅ N/N)
// _pdPartialCount : étapes où CERTAINES bêtes ont été traitées (🔄 X/N)
// Affiché : "✅ X · 🔄 Y / total" dans l'en-tête
//
// _fait = TOUTES les bêtes actives traitées (plus 1 bête != tout le troupeau)
// La liste _sopBeteIds est calculée une fois avant la map (même logique que beteDropdown)
```

### viewGuide() *(commit 14468d4)*
Vue onglet Guide — contenu adapté par rôle (`window.ROLE`) :
- Fondateur : checklist cycle, pilotage hebdo, décision vente, limites
- Gérant : rythme quotidien, urgences, lien vers `guides/gerant.html`
- RGA : contrôle hebdo/mensuel, lexique, lien vers `guides/rga.html`
- Fallou : cadence relevés, signaux vente, lien vers `guides/fallou.html`

### calcGMQ() — calcul GMQ réel
Utilise les intervalles réels entre pesées consécutives par bête :
```javascript
// delta_poids / delta_jours pour chaque paire de pesées
// MOCK.gmq = moyenne pondérée (pas de division naïve par peseeFreq)
```

### Sync depuis Config_App
Au chargement, le reader Config_App parse les clés/valeurs dont :
```javascript
if (key === 'prixAlim'     && val && parseFloat(val) > 0) CYCLE.prixAlim     = parseFloat(val);
if (key === 'objectifPrix' && val && parseInt(val)   > 0) CYCLE.objectifPrix = parseInt(val);
if (key === '_mktUpdated'  && val) CYCLE._mktUpdated = val;
if (key === 'mixSon'       && val) CYCLE.mixSon       = parseInt(val);
if (key === 'mixTourteau'  && val) CYCLE.mixTourteau  = parseInt(val);
```

---

## 6. Google Sheets — schémas détaillés

### Config_Cycle — A1:R1 (une seule ligne)
```
A  dateDebut       ISO YYYY-MM-DD
B  nbBetes         entier
C  poidsDepart     kg
D  race            texte
E  ration          kg/j/bête
F  capital         FCFA
G  objectifPrix    FCFA/kg
H  budgetSante     FCFA
I  veterinaire     texte
J  foirail         texte
K  commission      %
L  contactUrgence  texte
M  peseeFreq       jours entre pesées
N  betes           JSON [{id, nom, sexe, poids}]
O  stockLines      JSON [{type, qte, prixUnit}]
P  dureeMois       mois prévus pour le cycle
Q  simCharges      JSON {loyer, salaire, transport, autres}
R  prixAlim        FCFA/kg aliment
S  numCycle        numéro du cycle en cours (entier, éditable par le fondateur)
```

### Config_App — A:B (clé-valeur)
```
gmqCible           kg/j — ex. 1.1
gmqWarn            kg/j — seuil alerte orange — ex. 0.9
poidsCible         kg — ex. 380
poidsVenteMin      kg — ex. 350
tauxMortMax        % — ex. 5
coutRevientMax     FCFA/kg — ex. 900
margeParBeteMin    FCFA — ex. 50000
alerteSeuilTreso   FCFA — ex. 200000
mixSon             % son de blé — ex. 60
mixTourteau        % tourteau — ex. 40
prixAlim           FCFA/kg — ex. 280
objectifPrix       FCFA/kg poids vif — ex. 2000
_mktUpdated        DD/MM/YYYY — date modif paramètres marché
sopProtocol        JSON — tableau étapes vétérinaires (fondateur uniquement)
dureeMois          mois — durée prévue cycle
cycleDebut         ISO YYYY-MM-DD — dupliqué pour accès rapide
numCycle           entier — numéro du cycle courant (utile pour tests — préfixe IDs bêtes)
```

### Historique_Cycles — A:O *(créer manuellement dans le sheet Fondateur)*
```
A  Debut       ISO YYYY-MM-DD
B  Fin         DD/MM/YYYY
C  Duree       jours
D  Race        texte
E  Foirail     lieu de vente
F  NbBetesDep  entier — bêtes au départ
G  NbBetesFin  entier — bêtes en vie à la clôture
H  Deces       entier — total décès sur le cycle
I  PoidsDep    kg — poids moyen départ
J  PoidsFin    kg — poids moyen fin
K  GMQ         kg/j — GMQ réalisé
L  Capital     FCFA — capital investi
M  TresoFin    FCFA — trésorerie à la clôture
N  MargeParTete FCFA — marge nette par bête vendue
O  NumCycle    entier — numéro du cycle
```

---

## 7. Sécurité

### Cookies
- `HttpOnly` — non accessible depuis JS côté client
- `Secure` — HTTPS uniquement
- `SameSite=Strict` — protection CSRF

### CORS (`api/auth.js`)
```javascript
var ALLOWED_ORIGINS = ['http://localhost:3000', 'http://localhost:5000'];
var origin = req.headers.origin || '';
var isSameOrigin = !origin;
var isVercel = /\.vercel\.app$/.test(origin);
if (isSameOrigin || isVercel || ALLOWED_ORIGINS.indexOf(origin) !== -1) {
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
}
```

### Pas de credentials côté client
Mots de passe et SIDs uniquement dans les variables d'environnement Vercel — jamais dans le code ou le localStorage.

---

## 8. Guides PDF (`/guides/`)

4 fichiers HTML auto-contenus (CSS inline), imprimables via `Ctrl+P → Enregistrer en PDF` :

| Fichier | Destinataire | Sections clés |
|---|---|---|
| `guides/fondateur.html` | Direction | Rôle fondateur, checklist démarrage cycle, pilotage hebdo, décision vente Go/No-Go, limites du modèle, glossaire |
| `guides/gerant.html` | Gérant terrain | Rythme matin/soir, checklist quotidienne, urgences (symptômes → action), contacts à remplir, FAQ terrain |
| `guides/rga.html` | RGA | Contrôles hebdo/mensuel, lecture des KPI, lexique économique (IC, GMQ, IRR, burn rate), procédure d'escalade |
| `guides/fallou.html` | Commerciale | Cadence des relevés de prix, comment lire un prix foirail, signaux de vente, simulateur mental |

---

## 9. Variables d'environnement Vercel

```
# Credentials rôles
PWD_FONDATEUR, PWD_GERANT, PWD_RGA, PWD_FALLOU

# Spreadsheet IDs (chaque rôle a son propre Google Sheet)
SID_FONDATEUR, SID_GERANT, SID_RGA, SID_FALLOU

# Service Account Google
SA_CLIENT_EMAIL, SA_PRIVATE_KEY   # SA_PRIVATE_KEY avec \n pour les newlines

# Session
SESSION_SECRET    # >= 32 caractères aléatoires, HMAC SHA-256

# IA (optionnel)
ANTHROPIC_API_KEY
```

---

## 10. Patterns de code récurrents

### Lire un onglet Sheets et boucler dessus
```javascript
readSheet(SID, 'Pesees!A:H').then(function(data) {
  var rows = (data.values || []).slice(1); // skip header
  rows.forEach(function(row) {
    var date = row[0], beteId = row[1], poids = parseFloat(row[2]) || 0;
    // ...
  });
});
```

### Ajouter une ligne avec appendRow
```javascript
appendRow(SID, 'Fiche_Quotidienne!A:K', [
  todayISO(), MOCK.betes, nourris, eau, etat, 'Pastef Thiès', notes, '', '', '', ''
]).then(function() {
  alert('Fiche sauvegardée');
}).catch(function(e) {
  console.error('Erreur Sheets', e);
});
```

### Pattern modal plein écran
```javascript
function showModal(html) {
  var m = document.getElementById('modal');
  m.innerHTML = html;
  m.style.display = 'flex';
}
function closeModal() {
  document.getElementById('modal').style.display = 'none';
}
```

### Thèmes sombre/clair
```javascript
// body.light → thème clair
// body sans classe → thème sombre (défaut)
document.body.classList.toggle('light');
```

---

## 11. Layout et navigation

```
#sidebar (fixe à gauche, mobile: bottom-sheet)
  ↓ clic onglet
renderTab(tab)
  ├── 'dashboard'  → renderDashboard()
  ├── 'saisie'     → renderSaisie()
  ├── 'livrables'  → renderLivrables()
  ├── 'marche'     → renderMarche()
  └── 'guide'      → viewGuide()      ← nouveau commit 14468d4
```

---

## 12. Index des numéros de ligne — `index.html`

> Référence rapide pour naviguer dans le fichier (~8 000 lignes). Vérifier après chaque commit car les lignes peuvent décaler.
> **Dernière mise à jour : commit `a8705a8` (7 avril 2026)**

### Variables globales

| Variable | Ligne | Notes |
|---|---|---|
| `var USERS` | L352 | Définition des rôles et onglets par rôle |
| `var SID` | L360 | Peuplé dynamiquement après auth |
| `var MOCK` | L361 | Valeurs KPI affichées — source canonique |
| `var CYCLE` | L419 | Objet cycle complet — persisté localStorage |
| `var HISTORY` | L484 | Saisies fusionnées local + Sheets — trié desc |
| `var STOCK_MVTS` | L488 | Mouvements stock — persisté localStorage |
| `var ONLINE` | L895 | `navigator.onLine` — mis à jour par events |
| `var OFFLINE_QUEUE` | L896 | Queue hors-ligne — persistée localStorage |
| `var METEO` | L927 | Météo Thiès — chargée à la demande sidebar |
| `var LIVE` | L2186 | Données live : pesées, prix, incidents, deceased |
| `var TABLE_RANGES` | L1148 | `{start, end}` par onglet Sheets — utilisé par `appendRow()` |

### Fonctions utilitaires dates

| Fonction | Ligne | Notes |
|---|---|---|
| `_nowDakar()` | L368 | Source de vérité heure/date — UTC+0 Dakar |
| `today()` | L400 | DD/MM/YYYY format FR |
| `todayISO()` | L404 | YYYY-MM-DD format ISO |
| `isoToFr(iso)` | L410 | YYYY-MM-DD → DD/MM/YYYY |
| `parseISO(iso)` | L412 | YYYY-MM-DD → Date locale (sans décalage UTC) |
| `nowHeure()` | L408 | Heure courante Dakar (0-23) |
| `nowJour()` | L409 | Jour semaine Dakar (0=dim, 5=ven) |
| `calcSemaine()` | L471 | Semaine courante du cycle — utilise `Date.UTC` |
| `_joursDepuisDebut()` | L4957 | Jours écoulés depuis `CYCLE.dateDebut` — utilise `Date.UTC` |

### Fonctions stock

| Fonction | Ligne | Notes |
|---|---|---|
| `calcStockLocal()` | L584 | Semaines de stock restantes depuis `STOCK_MVTS` — pure |
| `calcStockParAliment()` | L605 | `{type: kgNet}` — pure |
| `stockSyntheseHtml()` | L618 | HTML tableau synthèse stock — compact ou complet |
| `saveMvts()` | L498 | `lsSet('stock_mvts', STOCK_MVTS)` — persiste localStorage |

### Anti-doublons et historique

| Fonction | Ligne | Notes |
|---|---|---|
| `addHistory()` | L663 | Pousse dans `HISTORY` + `lsSet` — appelée après chaque soumission réussie |
| `ficheDejaSoumise()` | L751 | localStorage + HISTORY + `CYCLE._lastFicheDate` |
| `joursSince(type)` | L698 | HISTORY + fallback `CYCLE._last*Date` (Config_App step1) |
| `peseeDejaFaite(id)` | L689 | `LIVE.pesees` — semaine ISO courante |
| `bilanDejaFaitCetteSemaine()` | L865 | HISTORY `_sem` + `CYCLE._lastBilanSem` |

### Auth et Sheets

| Fonction | Ligne | Notes |
|---|---|---|
| `doLogin()` | L1062 | POST /api/auth → peuple `SID`, `S.user`, déclenche `loadLiveData()` |
| `getTok()` | L1121 | GET /api/token → access_token Google OAuth2 (mis en cache côté client 55min) |
| `appendRow(sid, range, vals)` | L1163 | Pattern read-then-PUT — voir TABLE_RANGES L1148 |
| `readSheet(sid, range)` | L1228 | GET Sheets avec `UNFORMATTED_VALUE` |

### Chargement des données

| Fonction | Ligne | Notes |
|---|---|---|
| `loadLiveData()` | L1247 | Étape 1 bloquante + Vague 1 + Vague 2 (voir flux démarrage §0) |
| `buildHistoryFromSheets()` | L1585 | Fusion 7 onglets → HISTORY — appelée fin Vague 2 |
| `loadPesees()` | L2197 | GMQ réel inter-pesées par bête — `setTimeout(loadPesees, 300)` après loadLiveData |
| `loadPrix()` | L2290 | Suivi_Marche — appelée si onglet `marche` ou après submit |
| `loadAlimPrix()` | L2332 | Suivi_Aliments — appelée si onglet `marche` ou après submit |

### Synchronisation Sheets

| Fonction | Ligne | Notes |
|---|---|---|
| `_syncCycle()` | L2097 | Réécrit `Config_Cycle!A1:R1` dans les 4 sheets |
| `_syncConfigApp()` | L2048 | Réécrit `Config_App!A:B` dans sheet fondateur (23 clés) |
| `flushQueue()` | L902 | Dépile `OFFLINE_QUEUE` — auto-déclenché au retour réseau |

### Soumission

| Fonction | Ligne | Notes |
|---|---|---|
| `doSubmit(type)` | L1776 | Validation + anti-doublons + confirmations sécurité |
| `_submitActual(type)` | L1871 | Écriture Sheets effective — `writeAll()` + `kpiAppend()` |

### Cycle et archivage

| Fonction | Ligne | Notes |
|---|---|---|
| `saveCycle()` | L3798 | Sauvegarde cycle + reset complet + archivage + écriture Sheets |
| `_archiveCycle(snap)` | L3766 | Écrit snapshot dans `Historique_Cycles!A:O` |
| `_syncCycle()` | L2097 | Écrit `Config_Cycle!A1` sur les 4 sheets |

### Vues (rendu HTML)

| Fonction | Ligne | Notes |
|---|---|---|
| `r()` | L1009 | Re-rendu global — reconstruit tout le DOM |
| `viewDash()` | L5014 | Dashboard KPI + alertes + rentabilité |
| `viewSaisie()` | L5305 | Formulaires saisie (fiche/sop/stock/inc/pesée/santé/bilan) |
| `viewLiv()` | L6013 | Livrables (tréso/KPI/bêtes/objectifs/sopvet/calendrier) |
| `viewMarche()` | L6776 | Marché prix + simulateur + aliments |
| `buildSidebar()` | L4349 | Sidebar (today/week/month/cycle selon rôle) |
| `pageApp()` | L~4210 | Shell principal — header + tabs + content + sidebar |

---

## 13. Audit MOCK variables (résultat final — commit 8599ed6 + audits passe 1-3)

| Variable | Défaut init | Seed local | Statut |
|---|---|---|---|
| `MOCK.betes` | 4 | `CYCLE.nbBetes` (localStorage) | Corrigé — seed au démarrage |
| `MOCK.treso` | 680000 | `CYCLE.capital` (localStorage) | Corrigé — seed au démarrage |
| `MOCK.gmq` | 1.1 | Aucun (recalculé dès 1ère pesée) | Source canonique — toutes les formules inline utilisent MOCK.gmq |
| `MOCK.stock` | 6 | `calcStockLocal()` via `STOCK_MVTS` localStorage | Auto-protégé |
| `MOCK.sem` | 1 | `calcSemaine()` via `CYCLE.dateDebut` | Auto-calculé |
| `MOCK.incidents` | 0 | `HISTORY` localStorage | Auto-calculé |

---

## 14. Bugs corrigés — audits multi-passes (commits `51f5fee` → `a8705a8`)

### Passe 1 — 7 corrections (`51f5fee`)
| # | Localisation | Bug | Fix |
|---|---|---|---|
| 1 | Go/No-Go | Score `/7` mais compteur affichait `/8` | Suppression du critère redondant |
| 2 | `viewDash()` KPI | `objGMQ` utilisait `CYCLE.gmqWarn` au lieu de `CYCLE.gmqCible` | Corrigé en `gmqCible` |
| 3 | `_calcDepSim()` | `cVetPeriode` proratisé sur le mauvais diviseur | Prorata sur `je/tj` |
| 4 | `doSubmit('bilan')` | `f.sem` écrasait `S.fb.sem` après re-render | `lire S.fb.sem` avant écriture |
| 5 | `_syncConfigApp()` | `Object.values()` non dispo en ES5 → crash mobile | Remplacé par `Object.keys()` + boucle |
| 6 | Alerte GMQ chute | `Date` sans `UTC` → décalage DST possible | `new Date(Date.UTC(...))` |
| 7 | `doSubmit('sante')` | Décès enregistré dans `Incidents` au lieu de `Sante_Mortalite` | Correction du routage |

### Passe 2 — 3 corrections (`0580668`)
| # | Localisation | Bug | Fix |
|---|---|---|---|
| 1 | `_joursDepuisDebut()` | Helper manquant — crash lors du calcul des charges proratisées | Création du helper avec `Date.UTC` |
| 2 | `_alertGmqChute` (dashboard + sidebar) | `new Date(local)` → risque DST | `new Date(Date.UTC(...))` dans les 2 occurrences |
| 3 | Bouton PDF KPI | Accessible à tous les rôles | Role-gated fondateur/rga uniquement |

### Passe 3 — 5 corrections (`a8705a8`)
| # | Localisation | Bug | Fix |
|---|---|---|---|
| 1 | `pageApp()` `_jourDepuis()` | `_now` est `{year,month,...}` pas un `Date` → `_now - d = NaN` → bannières alerte stock/pesée/bilan jamais déclenchées | `new Date(Date.UTC(_now.year,...))` dans les 2 termes |
| 2 | `buildHistoryFromSheets()` | `_betesV2 > 0` empêche `MOCK.betes = 0` si 100% mortalité | `>= 0` |
| 3 | `loadLiveData()` Vague 2 | `kgRow === 0` ajoute un mouvement `{kg:0}` inutile dans `STOCK_MVTS` | `if (kgRow === null \|\| kgRow === 0) return` |
| 4 | `joursSince()` | `new Date(local)` pour les deux termes — incohérent avec le standard `Date.UTC` | `new Date(Date.UTC(...))` pour les deux |
| 5 | `_joursDepuisDebut()` fallback | `return Math.max(1, calcSemaine() * 7)` retourne 7 quand `!CYCLE.dateDebut` | `return 1` |

---

## 15. SOP Véto — détails d'implémentation (commit 8599ed6)

### Flux complet d'un acte Santé
1. Bouton ✅ ou ⚠️ dans la carte de la timeline → `_sopValider(idx)`
2. Sante → `S._sopInlineIdx = idx`, `S._sopInlineData = {id:'', res:'Guéri'}` → `r()`
3. Le re-render affiche un mini-form inline dans la carte (beteDropdown + select résultat)
4. Clic "Valider" → `_sopInlineSave(idx)` :
   - Pousse dans `HISTORY` (format sante)
   - Appelle `appendRow` sur `Sante_Mortalite!A:I` pour chaque SID disponible
   - Remet `S._sopInlineIdx = null`, `S._sopInlineData = {}`
   - Reste sur l'onglet Protocole — pas de navigation

### Flux complet d'une Pesée SOP
1. Bouton ✅ ou ⚠️ → `_sopValider(idx)` (type=pesee)
2. `S._sopCtx = {label, j}`, `S.sub = 'pesee'` → `r()`
3. Le form pesée affiche une bannière verte "📋 Pesée SOP J+X — [label]"
4. L'utilisateur remplit et soumet → `doSubmit('pesee')`
5. Après succès : `S._sopCtx = null` (nettoyé dans `_submitActual`)

### Seuils de délai (SOP)
| Délai | Comportement |
|---|---|
| `_daysTo >= -7` (dans les 7j de chaque côté) | Bouton vert ✅ — compte dans `_pdDone` |
| `-21 <= _daysTo < -7` (8 à 21j en retard) | Bouton orange ⚠️ avec `confirm()` — count dans `_pdLate` |
| `_daysTo < -21` (>21j de retard) | 🔒 Bloqué — acte non réalisable via l'app |
