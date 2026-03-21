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
- **Dernier commit** : `2324772` — fix: thème clair mouvements cycle, filter lignes vides appendRow

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | Vanilla JS (ES5 `var`), HTML/CSS inline dans `index.html` (~4724 lignes) |
| Backend | Vercel Serverless Functions (ES Module `export default`) |
| Auth | Session token custom HMAC-SHA256 (`base64(payload).hmac_hex`), 8h |
| Données | Google Sheets API v4 via Service Account RS256 JWT |
| Déploiement | GitHub → Vercel (auto sur push `main`) |
| IA | Anthropic Claude (proxy via `/api/ai`) |
| Météo | Open-Meteo API (Thiès 14.79°N, -16.93°E) |

---

## Fichiers du projet

```
Boan-app/
├── index.html              SPA complète (~295 Ko, ~4724 lignes)
├── vercel.json             Rewrites /api/:path*
├── api/
│   ├── auth.js             Login → session token HMAC + SID spreadsheet
│   ├── token.js            RS256 JWT → access_token Google OAuth2
│   ├── sheets.js           Proxy CRUD Sheets (peu utilisé directement)
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

| Rôle | Identifiant | Onglets | Spreadsheet |
|---|---|---|---|
| Fondateur / Direction | `fondateur` | Dashboard, Saisie, Livrables, Marché | SID_FONDATEUR |
| Gérant terrain | `gerant` | Dashboard, Saisie | SID_GERANT |
| RGA | `rga` | Dashboard, Livrables | SID_RGA |
| Commerciale | `fallou` | Dashboard, Marché | SID_FALLOU |

Les identifiants peuvent être overridés dans `Config_Passwords` (feuille fondateur).
`SID[role]` est retourné par `/api/auth` au login et stocké dans `var SID = {}`.

---

## Architecture index.html

### Variables globales JS

```js
var S = {
  page:'login', user:null, tab:'dashboard', sub:'fiche',
  tok:null, tokexp:0, sessionToken:null,
  sending:false, msg:'', _sendCount:0, _sendSheet:'',
  fi:{date,nb,nourris,eau,enclos,incident,desc},  // Fiche quotidienne
  fs:{date,net,des,rat,eau,stk,san,prob},          // SOP
  fst:{date,mvts:[],stockInput,stockKg,rat},       // Stock
  fin:{date,id,type,grav,desc,act,clos},           // Incident
  fp:{date,id,race,raceCustom,poids,prev,datePrev},// Pesée
  fsa:{date,id,sym,tra,cout,res,dec},              // Santé
  fb:{sem,nb,nou,stk,inc,poi,msg},                 // Bilan hebdo
  fm:{date,foi,foiCustom,bas,moy,haut},            // Marché
};
var MOCK  = {betes:4, gmq:1.1, stock:6, treso:680000};
var CYCLE = lsGet('cycle') || { nbBetes:4, dateDebut:'', dureeMois:8, ... };
var SID   = {};             // {fondateur, gerant, rga, fallou} — peuplé au login
var STOCK_MVTS = [];        // [{date, type, mode:'ajouter'|'consommer', kg}]
var HISTORY    = [];        // 20 dernières saisies
var LIVE = { pesees:[], beteIds:[], prix:[], loaded:false };
var SPARK = { gmq:[], stk:[], treso:[], betes:[] };
```

### TABLE_RANGES (déclaré AVANT appendRow)

```js
var TABLE_RANGES = {
  'Fiche_Quotidienne': { start: 4, end: 500 },
  'SOP_Check':         { start: 4, end: 200 },
  'Stock_Nourriture':  { start: 4, end: 500 },
  'Incidents':         { start: 4, end: 200 },
  'Pesees':            { start: 4, end: 200 },
  'Sante_Mortalite':   { start: 4, end: 200 },
  'Hebdomadaire':      { start: 4, end: 200 },
  'Suivi_Marche':      { start: 4, end: 200 },
  'KPI_Mensuels':      { start: 4, end: 50  },
  'KPI_Hebdo':         { start: 4, end: 50  }
};
// start = 1ère ligne de saisie (3 lignes d'en-tête dans les feuilles formatées)
// end   = dernière ligne permise (PUT exact — jamais INSERT_ROWS)
```

### Fonctions réseau

```js
function getTok()                     // Promise<access_token Google> — cache S.tok/tokexp
function readSheet(sid, range)        // Lit une plage Sheets directement
function appendRow(sid, range, vals)  // Écriture read-then-PUT (voir pattern ci-dessous)
function writeAll(sids[], range, vals)// Écriture parallèle dans plusieurs SIDs
```

> **Important** : Le frontend appelle l'API Google **directement** avec l'access_token de `/api/token`.
> Il ne passe **pas** par `/api/sheets`.

### Navigation

```
S.tab = 'dashboard'  → viewDash()
S.tab = 'saisie'     → viewSaisie()   — S.sub: fiche|sop|stock|inc|pesee|sante|bilan
S.tab = 'livrables'  → viewLiv()      — S.sub: treso|sim|proj|pw
S.tab = 'marche'     → viewMarche()   — S.sub: prix|reco
```

### Cycle de soumission

```
doSubmit(type)  ← validation + anti-doublons + confirmations sécurité
  └── _submitActual(type)
        ├── writeAll(sids, onglet, vals)
        ├── kpiAppend(vals)           ← KPI_Mensuels si SID.fondateur dispo
        └── kpiHebdoAppend(vals)      ← KPI_Hebdo si SID.fondateur dispo
```

---

## Google Sheets — Noms d'onglets EXACTS

> "Requested entity was not found" = nom d'onglet incorrect ou SID_* manquant dans Vercel.

### Spreadsheet GÉRANT (SID_GERANT)

| Onglet exact | Colonnes |
|---|---|
| `Fiche_Quotidienne` | Date, NbBetes, Nourris, Eau, Enclos, Incident, Description |
| `SOP_Check` | Date, Net, Des, Rat, Eau, Stk, San, Prob |
| `Stock_Nourriture` | Date, TypeAliment, kg(±), Ration, Semaines, Alerte |
| `Incidents` | Date, IdBete, Type, Gravite(1-3), Description, Action, Cloture |
| `Pesees` | Date, IdBete, Race, Poids, PoidsPrec, Gain, Statut |
| `Sante_Mortalite` | Date, IdBete, Symptome, Traitement, Cout, Resultat, Deces |
| `Hebdomadaire` | Semaine, NbBetes, Nourriture, Stock, Incidents, Poids, Alerte, Msg |

### Spreadsheet FONDATEUR (SID_FONDATEUR)

| Onglet exact | Usage |
|---|---|
| Mêmes 7 onglets que GÉRANT | `writeAll` écrit aussi dans fondateur |
| `KPI_Mensuels` | `kpiAppend` — col H = trésorerie |
| `KPI_Hebdo` | `kpiHebdoAppend` |
| `Config_Passwords` | role, pwd_base64, updated_at, login_override |
| `Config_Cycle` | Configuration du cycle (nbBetes, dureeMois, etc.) |

### Spreadsheet FALLOU (SID_FALLOU)

| Onglet exact | Usage |
|---|---|
| `Suivi_Marche` | `writeAll([SID.fallou, SID.fondateur], ...)` |

---

## Authentification

```js
// Format : base64(JSON.stringify(payload)) + '.' + hmac_sha256_hex
// Payload : { login:"fondateur", role:"fondateur", exp: Date.now() + 8*3600*1000 }
// Durée : 8h — auto-déconnexion par setInterval 60s
// Non persisté : rechargement = reconnexion obligatoire
// Réponse /api/auth : { ok:true, sessionToken, user:{login,role,name,tabs}, sid }
```

---

## Patterns critiques

### appendRow — read-then-PUT avec filtre lignes vides

```js
// JAMAIS encodeURIComponent sur la plage entière — encode sheetName uniquement
// encodeURIComponent(':') = '%3A' → Sheets API rejette → "unable to parse range"
var enc = encodeURIComponent(sheetName);
// 1. Lire colonne A
var readUrl = base + enc + '!A' + tr.start + ':A' + tr.end;
fetch(readUrl).then(function(d) {
  // Filtrer les cellules vides (formatées / formules sans valeur)
  var rows = (d.values || []).filter(function(r){ return r && r.length > 0 && r[0] !== ''; });
  // 2. Première ligne vide dans le tableau
  var targetLine = Math.min(tr.start + rows.length, tr.end);
  // 3. PUT exact — PAS INSERT_ROWS (casserait les tableaux formatés)
  var writeUrl = base + enc + '!A' + targetLine + '?valueInputOption=USER_ENTERED';
  return fetch(writeUrl, {method:'PUT', body: JSON.stringify({values:[vals]})});
});
```

### buildSidebar — palette thème clair

```js
var _sbLt   = document.body.classList.contains('light');  // TOUJOURS classList
var _sbSub  = _sbLt ? '#445533' : '#88aa88';
var _sbData = _sbLt ? '#334433' : '#ccc';
```

### Météo — palette thème clair (JS)

```js
var _lt       = document.body.classList.contains('light');
var _meteoBg  = _lt ? '#e8f4e8' : '#1a2e1a';
var _meteoFg  = _lt ? '#1a2e1a' : '#fff';
var _meteoSub = _lt ? '#445533' : '#88aa88';
```

### doLogin — support logins overridés

```js
// NE PAS vérifier USERS[id] localement avant l'appel API
// Le serveur retourne le role canonique dans data.user.role
// SID[data.user.role] = data.sid;
```

### Fallbacks SID

```js
// loadLiveData
var sid = SID.gerant || SID.fondateur || SID.rga;
// loadPrix
var _sidPrix = SID.fallou || SID.fondateur;
if (!_sidPrix) return;
```

---

## Conventions strictes

1. **`var` uniquement** — Pas de `let`/`const` dans `index.html`
2. **Pas de double virgule `,,`** dans les objets — erreur JS fatale silencieuse (page blanche)
3. **`TABLE_RANGES`** — déclaré AVANT `function appendRow()`
4. **`USERS` dans `handler()`** — PAS au niveau module (cold start Vercel)
5. **Swipe timeout : 290ms** — durée animation `.28s`
6. **PowerShell** — utiliser `;` pour chaîner, jamais `&&`
7. **encodeURIComponent** — uniquement sur `sheetName`, JAMAIS sur la plage complète
8. **Détection thème** — TOUJOURS `document.body.classList.contains('light')`
9. **Jamais `INSERT_ROWS`** — toujours pattern read-then-PUT dans les feuilles formatées
10. **Filter lignes vides** — `r && r.length > 0 && r[0] !== ''` dans appendRow

---

## Commandes de déploiement

```powershell
Set-Location "C:\Users\sg54378\Downloads\Boan-app"
git add index.html          # ou api/fichier.js selon la modification
git commit -m "type: description"
git push origin main
# Vercel déploie automatiquement en ~30-60 secondes
```

---

## Historique des commits (état au 21 mars 2026)

```
2324772  fix: thème clair mouvements cycle, filter lignes vides appendRow
           - appendRow: filtre r[0] !== '' → écriture à la bonne ligne
           - Container "Mouvements cycle": background adaptatif _sbLt
           - stockSyntheseHtml(compact): couleurs texte/bordures adaptatives

fe13700  fix: login override, SID fallbacks, role dans auth, Config_Cycle encode
           - doLogin: suppression check USERS[id] local → supporte logins overridés
           - loadLiveData: SID.gerant || SID.fondateur || SID.rga
           - loadPrix: SID.fallou || SID.fondateur + guard return si aucun
           - auth.js: role inclus dans réponse user:{login,role,name,tabs}
           - Config_Cycle: encodeURIComponent('Config_Cycle') + '!A1' séparé

ccf83ab  fix: import crypto statique, encodeURIComponent readSheet, lignes orphelines
           - api/*: import statique depuis 'node:crypto' (require() interdit en ESM)
           - readSheet: encode sheetName uniquement pas la plage A1
           - BUG-07/08: suppression lignes orphelines viewLiv() et buildSidebar Fallou

e0421b5  docs: reajustement documentation et prompt après session mars 2026
0b37c13  fix: couleurs sidebar/calendrier adaptées au thème clair
98f2b6e  fix: onglets alignés doc référence (tabs bg #1a3a1a, underline #fff)
9534f99  fix: météo — détection thème par classList, pas S._light
9fbc075  fix: encodeURIComponent sheetName uniquement, pas la plage A1
7995830  fix: appendRow read-then-PUT exact line, TABLE_RANGES start:4
```

---

## Problèmes résolus — Référence rapide

| Symptôme | Cause | Fix |
|---|---|---|
| Page blanche au login | `,,` dans `S{}` | Supprimée |
| Écriture décale d'une ligne | `INSERT_ROWS` casserait le tableau | pattern read-then-PUT |
| `%3A` dans URL, range rejetée | encode URL entière | encode `sheetName` uniquement |
| Fiche/Pesées écrivent ligne décalée | cellules formatées vides comptées | filter `r[0] !== ''` |
| Login override bloqué | check `USERS[id]` avant API | supprimé, utilise `role` du serveur |
| Fondateur toujours en MOCK | `loadLiveData` attendait `SID.gerant` | fallback `SID.fondateur` |
| Prix jamais chargés | `loadPrix` attendait `SID.fallou` | fallback `SID.fondateur` |
| Crash API en production | `require()` dans ES Module | `import` statique top-level |
| "Mouvements cycle" fond noir en clair | `background:#0a150a` hardcodé | adaptatif `_sbLt` |
