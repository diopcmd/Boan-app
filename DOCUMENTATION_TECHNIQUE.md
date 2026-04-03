# DOCUMENTATION TECHNIQUE — BOAN App

Référence développeur pour l'application de gestion d'élevage **BOAN**.  
**Commit HEAD** : `dd5c3c7` — ~7 436 lignes — Avril 2026

---

## 1. Stack technique

| Couche | Technologie | Détails |
|---|---|---|
| Frontend | Vanilla JS ES5 | `var` uniquement — pas de const/let/arrow functions |
| SPA | Single `index.html` | HTML + CSS + JS inline, ~7 436 lignes |
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
  gmq:  1.1,           // remplacé par calcul réel dès que pesées présentes
  stock: 6,            // recalculé depuis STOCK_MVTS localStorage
  treso: 680000,       // seedé depuis CYCLE.capital localStorage au démarrage
  sem:  1,             // calculé depuis CYCLE.dateDebut
  mois: 1,
  _tresoFromSante: null
};
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
Écrit dans `Config_Cycle!A1:R1` (colonnes A–N standard + P=dureeMois + Q=simCharges + R=prixAlim).  
**Avant la mise à jour** : appelle `_archiveCycle()` si le cycle est terminé.

### _archiveCycle(snap) *(nouveau — commit 5a0ca03)*
Archive un snapshot du cycle terminé dans `Historique_Cycles!A:N` :
```javascript
function _archiveCycle(snap) {
  var row = [
    snap.dateDebut,           // A — Début (ISO YYYY-MM-DD)
    isoToFr(snap.dateFin),    // B — Fin (DD/MM/YYYY)
    snap.duree,               // C — Durée (jours)
    snap.race,                // D — Race
    snap.foirail,             // E — Foirail/lieu de vente
    snap.nbBetesDep,          // F — NbBêtesDépart
    snap.nbBetesFin,          // G — NbBêtesFin (actives au moment clôture)
    snap.deces,               // H — Décès (total)
    snap.poidsDep,            // I — PoidsDépart moyen (kg)
    snap.poidsFin,            // J — PoidsFin moyen (kg)
    snap.gmq,                 // K — GMQ réalisé (kg/j)
    snap.capital,             // L — Capital investi (FCFA)
    snap.tresoFin,            // M — TrésoFin (FCFA)
    snap.margeParTete         // N — Marge/tête (FCFA)
  ];
  return appendRow(SID, 'Historique_Cycles!A:N', row);
}
```

### viewGuide() *(nouveau — commit 14468d4)*
Vue onglet ❓ Guide — contenu adapté par rôle (`window.ROLE`) :
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
sopProtocol        JSON — tableau étapes vétérinaires
dureeMois          mois — durée prévue cycle
cycleDebut         ISO YYYY-MM-DD — dupliqué pour accès rapide
```

### Historique_Cycles — A:N *(nouveau — à créer manuellement dans le sheet Fondateur)*
```
A  Debut      ISO YYYY-MM-DD
B  Fin        DD/MM/YYYY
C  Duree      jours
D  Race       texte
E  Foirail    lieu de vente
F  NbBetesDep entier — bêtes au départ
G  NbBetesFin entier — bêtes en vie à la clôture
H  Deces      entier — total décès sur le cycle
I  PoidsDep   kg — poids moyen départ
J  PoidsFin   kg — poids moyen fin
K  GMQ        kg/j — GMQ réalisé
L  Capital    FCFA — capital investi
M  TresoFin   FCFA — trésorerie à la clôture
N  MargeParTete FCFA — marge nette par bête vendue
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

## 12. Audit MOCK variables (résultat final — commit dd5c3c7)

| Variable | Defaut init | Seed local | Statut |
|---|---|---|---|
| `MOCK.betes` | 4 | `CYCLE.nbBetes` (localStorage) | Corrigé — seed au démarrage |
| `MOCK.treso` | 680000 | `CYCLE.capital` (localStorage) | Corrigé — seed au démarrage |
| `MOCK.gmq` | 1.1 | Aucun (recalculé dès 1ère pesée) | Acceptable — valeur = gmqCible (affichage vert) |
| `MOCK.stock` | 6 | `calcStockLocal()` via `STOCK_MVTS` localStorage | Auto-protégé |
| `MOCK.sem` | 1 | `calcSemaine()` via `CYCLE.dateDebut` | Auto-calculé |
| `MOCK.incidents` | 0 | `HISTORY` localStorage | Auto-calculé |
