# Prompt de reprise — Projet BOANR
> Colle ce prompt au début d'une nouvelle conversation avec n'importe quelle IA pour reprendre le projet exactement où il en est.

---

## Contexte projet

Tu travailles sur **BOANR**, une application web mobile de gestion d'élevage bovin pour la Ferme BOAN au Sénégal (région de Thiès). L'app est une **SPA vanilla HTML/CSS/JS** déployée sur **Vercel**. Le pilotage est effectué à distance depuis la France.

- **Production** : https://boan-app-9u5e.vercel.app
- **GitHub** : https://github.com/diopcmd/Boan-app (branche `main`)
- **Dossier local** : `C:\Users\sg54378\Downloads\Boan-app\`
- **Langue** : Tout est en français (code, UI, communications)

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | Vanilla JS (ES5 `var`), HTML/CSS inline dans `index.html` |
| Backend | Vercel Serverless Functions (ES Module `export default`) |
| Auth | Session token custom HMAC-SHA256 (`base64(payload).hmac_hex`) |
| Données | Google Sheets API v4 via Service Account RS256 JWT |
| Déploiement | GitHub → Vercel (auto sur push `main`) |
| IA | Anthropic Claude claude-sonnet-4-20250514 |
| Météo | Open-Meteo API (Thiès 14.79°N, -16.93°E) |

---

## Fichiers du projet

```
Boan-app/
├── index.html              SPA complète (~290 Ko, ~4400 lignes)
├── vercel.json             Rewrites /api/:path
├── api/
│   ├── auth.js             Login → session token HMAC + SID
│   ├── token.js            RS256 JWT → access_token Google
│   ├── sheets.js           Proxy CRUD Sheets (peu utilisé en pratique)
│   ├── change-password.js  Override mots de passe dans Config_Passwords
│   └── ai.js               Proxy Anthropic Claude
├── DOCUMENTATION_TECHNIQUE.md
└── AI_RESUMPTION_PROMPT.md (ce fichier)
```

---

## Variables d'environnement Vercel

```
PWD_FONDATEUR, PWD_GERANT, PWD_RGA, PWD_FALLOU
SID_FONDATEUR, SID_GERANT, SID_RGA, SID_FALLOU
SA_PRIVATE_KEY (clé RSA avec \n escapés en \\n)
SA_CLIENT_EMAIL
SESSION_SECRET (≥ 32 chars)
ANTHROPIC_API_KEY (optionnel)
```

---

## Rôles et accès

| Rôle | Login canonique | Onglets |
|---|---|---|
| Fondateur | `fondateur` | Dashboard, Saisie, Livrables, Marché |
| Gérant | `gerant` | Dashboard, Saisie |
| RGA | `rga` | Dashboard, Livrables |
| Commerciale | `fallou` | Dashboard, Marché |

Les logins peuvent être overridés dans `Config_Passwords` (Sheets fondateur).  
`SID[role]` est retourné par `/api/auth` au login et stocké dans `var SID = {}`.

---

## Architecture index.html

### CSS (lignes ~14–280)
- Thème dark : `#0f1a0f` fond, `#1a2e1a` cartes, `#2d6a2d` vert accent, `#C8A06A` or
- Mode clair `body.light` complet
- Animations : `fadeInUp`, `slideLeft/Right/InLeft/InRight`, `tabFadeIn`, `pulse`, `spin`

### Variables globales JS (extraits clés)

```js
var S = {
  page:'login', user:null, tab:'dashboard', sub:'fiche',
  tok:null, tokexp:0, sessionToken:null,   // Google token + session HMAC
  sending:false, msg:'', _sendCount:0, _sendSheet:'',
  fi:{date,nb,nourris,eau,enclos,incident,desc},  // Fiche quotidienne
  fs:{date,net,des,rat,eau,stk,san,prob},          // SOP
  fst:{date,mvts:[],stockInput,stockKg,rat},       // Stock
  fin:{date,id,type,grav,desc,act,clos},           // Incident
  fp:{date,id,race,raceCustom,poids,prev,datePrev},// Pesée
  fsa:{date,id,sym,tra,cout,res,dec},              // Santé
  fb:{sem,nb,nou,stk,inc,poi,msg},                 // Bilan hebdo
  fm:{date,foi,foiCustom,bas,moy,haut},            // Marché
  _guideOpen:false, _aiOpen:false, _pwdMgrOpen:false, _resetPwdOpen:false
};
var MOCK = {betes:4, gmq:1.1, stock:6, treso:680000, sem:1, mois:1};
var CYCLE = lsGet('cycle') || {nbBetes:4, dateDebut:'', dureeMois:8, ration:12,
  capital:1450000, objectifPrix:2000, budgetSante:200000, veterinaire:'',
  foirail:'Thiès', commission:2, betes:[], alimentTypes:[], initialized:false, ...};
var SID = {};             // {fondateur, gerant, rga, fallou} — rempli au login
var TABLE_RANGES = {
  // start = 1ère ligne données (3 lignes d'en-tête dans les feuilles formatées)
  // end   = dernière ligne permise (PUT exact — jamais d'insertion de ligne)
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
};  // ⚠️ Doit être déclaré AVANT appendRow()
var STOCK_MVTS = [];      // [{date,type,mode:'ajouter'|'consommer',kg,cycleDebut}]
var HISTORY = [];         // 20 dernières saisies
var LIVE = {pesees:[],beteIds:[],prix:[],loaded:false};
var SPARK = {gmq:[],stk:[],treso:[],betes:[]};  // 7 points pour sparklines
var OFFLINE_QUEUE = lsGet('offline_queue') || [];
```

### Fonctions réseau

```js
function getTok()                    // Promise<access_token Google> — cache S.tok/tokexp
function readSheet(sid, range)       // Lit Sheets directement avec Google token
function appendRow(sid, range, vals) // Écrit une ligne — pattern read-then-PUT OBLIGATOIRE
// ⚠️  JAMAIS d'INSERT_ROWS — casserait les tableaux formatés
// ⚠️  Guard {ok:false} si sid undefined/null
// ⚠️  encodeURIComponent sur sheetName UNIQUEMENT, pas sur la plage A1
//     (encodeURIComponent(':') = '%3A' → Sheets API rejette → "unable to parse range")
// Pattern interne :
//   var enc = encodeURIComponent(sheetName);
//   1. GET  enc + '!A' + tr.start + ':A' + tr.end  → rows[]
//   2. targetLine = Math.min(tr.start + rows.length, tr.end)
//   3. PUT  enc + '!A' + targetLine  → body: {values:[vals]}
function writeAll(sids[], range, vals)// Écrit dans plusieurs SIDs en parallèle
                                     // Guard si aucun SID valide — erreur explicite
```

> **Important** : Le frontend appelle l'API Google DIRECTEMENT avec l'access_token de `/api/token`.  
> Il ne passe PAS par `/api/sheets` (qui est un proxy alternatif non utilisé en pratique).

### Cycle de soumission

```
doSubmit(type)       ← validation + anti-doublons + confirmations sécurité
  └── _submitActual(type)
        ├── writeAll(sids, onglet, vals)     ← écriture multi-sheets
        ├── kpiAppend(vals)                  ← KPI_Mensuels si SID.fondateur dispo
        └── kpiHebdoAppend(vals)             ← KPI_Hebdo si SID.fondateur dispo
```

### Navigation

```
S.tab = 'dashboard'  → viewDash()
S.tab = 'saisie'     → viewSaisie()
  S.sub: fiche | sop | stock | inc | pesee | sante | bilan
S.tab = 'livrables'  → viewLiv()
  S.sub: treso | sim | proj | pw
S.tab = 'marche'     → viewMarche()
  S.sub: prix | reco
```

---

## Google Sheets — Noms d'onglets EXACTS

> ⚠️ "Requested entity was not found" = nom d'onglet incorrect ou SID_* mal configuré dans Vercel.

### Spreadsheet GÉRANT (SID_GERANT) — requis

| Onglet exact | Colonnes |
|---|---|
| `Fiche_Quotidienne` | Date, NbBetes, Nourris, Eau, Enclos, Incident, Description |
| `SOP_Check` | Date, Net, Des, Rat, Eau, Stk, San, Prob |
| `Stock_Nourriture` | Date, TypeAliment, kg(±), Ration, Semaines, Alerte |
| `Incidents` | Date, IdBete, Type, Gravite(1-3), Description, Action, Cloture |
| `Pesees` | Date, IdBete, Race, Poids, PoidsPrec, Gain, Statut |
| `Sante_Mortalite` | Date, IdBete, Symptome, Traitement, Cout, Resultat, Deces |
| `Hebdomadaire` | Semaine, NbBetes, Nourriture, Stock, Incidents, Poids, Alerte, Msg |

### Spreadsheet FONDATEUR (SID_FONDATEUR) — requis en plus

| Onglet exact | Usage |
|---|---|
| Mêmes 7 onglets que GÉRANT | writeAll écrit aussi dans fondateur |
| `KPI_Mensuels` | kpiAppend — col H = trésorerie |
| `KPI_Hebdo` | kpiHebdoAppend |
| `Config_Passwords` | role \| pwd_b64 \| updated_at \| login_override |

### Spreadsheet FALLOU (SID_FALLOU)

| Onglet exact | Usage |
|---|---|
| `Suivi_Marche` | writeAll([SID.fallou, SID.fondateur], ...) |

---

## Authentification

```js
// Session token format : base64(JSON.stringify(payload)) + '.' + hmac_sha256_hex
// Payload : { login:"fondateur", role:"fondateur", exp: Date.now() + 8*3600*1000 }
// Durée : 8h — auto-déconnexion si inactivité (setInterval 60s)
// Non persisté : rechargement page = reconnexion obligatoire
```

---

## Conventions strictes à respecter

1. **`var` uniquement** — Pas de `let`/`const` dans le JS de `index.html`
2. **Pas d'emojis dans les strings JS** — utiliser `\u26A0`, `\u2705`, etc. ou texte
3. **Pas de double virgule `,,`** dans les objets — erreur JS fatale silencieuse (page blanche)
4. **`TABLE_RANGES = {}`** — déclaré AVANT `function appendRow()`
5. **`USERS` dans `handler()`** — PAS au niveau module (cold start Vercel)
6. **Swipe timeout : 290ms** — durée animation `.28s` — ne jamais réduire
7. **PowerShell** — utiliser `;` pour chaîner, jamais `&&`
8. **encodeURIComponent** — uniquement sur `sheetName`, JAMAIS sur la plage A1 entière
9. **Détection thème clair** — TOUJOURS `document.body.classList.contains('light')`, jamais `S._light` ni `LIGHT_MODE`
10. **`yn()` → `ynPick()`** — Ne jamais appeler `r()` depuis `ynPick()` sauf si la structure change (garder le clavier mobile ouvert)

---

## Patterns clés de cette session

### Pattern appendRow (read-then-PUT)
```js
var enc = encodeURIComponent(sheetName);    // encode SEULEMENT le nom de feuille
// 1. Lire la colonne A pour compter les lignes
var readUrl = base + enc + '!A' + tr.start + ':A' + tr.end;
fetch(readUrl) → var rows = d.values || [];
// 2. Calculer la première ligne vide
var targetLine = Math.min(tr.start + rows.length, tr.end);
// 3. PUT exact (pas d'INSERT_ROWS)
var writeUrl = base + enc + '!A' + targetLine + '?valueInputOption=USER_ENTERED';
fetch(writeUrl, {method:'PUT', body:{values:[vals]}})
```

### Pattern yn() / ynPick() (clavier mobile)
```js
function yn(val, k, obj) {
  var id = 'yn-'+obj+'-'+k;   // id unique par champ
  return '<div id="'+id+'" ...>...</div>';  // boutons avec onclick="ynPick(...)"
}
function ynPick(cid, obj, k, val) {
  if (S[obj]) S[obj][k] = val;
  // Mise à jour DOM directe — PAS de r() sauf si structure change
  var c = document.getElementById(cid);
  if (c) { /* toggle .on class sur les boutons */ }
  // r() seulement si champ conditionnel (ex: incident → textarea)
  if ((obj==='fi' && k==='incident') || (obj==='fsa' && k==='dec')) r();
}
```

### Pattern r() — scroll lock + focus restore
```js
function r() {
  var _aid = document.activeElement && document.activeElement.id
    ? document.activeElement.id : null;
  // Sauvegarde curseur si input/textarea
  var _ov = SB.open || MODAL.open || CONFIRM.open || S._resetPwdOpen || S._aiOpen;
  document.body.style.overflow = _ov ? 'hidden' : '';
  el.innerHTML = html;
  // Restaure focus (garde le clavier mobile ouvert)
  if (_aid && (_atag==='INPUT'||_atag==='TEXTAREA')) {
    var _re = document.getElementById(_aid);
    if (_re) { _re.focus({preventScroll:true}); /* + restaure curseur */ }
  }
}
```

### Pattern thème clair dans buildSidebar()
```js
function buildSidebar() {
  var _sbLt   = document.body.classList.contains('light');  // TOUJOURS classList
  var _sbSub  = _sbLt ? '#445533' : '#88aa88';  // texte secondaire / lettres calendrier
  var _sbData = _sbLt ? '#334433' : '#ccc';      // données / chiffres
  // Utiliser _sbSub et _sbData dans tous les style="" inline de la sidebar
}
```

### Palette météo en thème clair (JS, pas CSS)
```js
var _lt = document.body.classList.contains('light');
var _meteoBg  = _lt ? '#e8f4e8' : '#1a2e1a';
var _meteoBg2 = _lt ? '#d8ecd8' : '#0f1f0f';
var _meteoFg  = _lt ? '#1a2e1a' : '#fff';
var _meteoSub = _lt ? '#445533' : '#88aa88';
```

### CSS onglets (valeurs correctes)
```css
.tabs { background:#1a3a1a; }
.tab  { color:#88bb88; }
.tab.on { color:#fff; border-bottom-color:#fff; }  /* blanc, pas vert */
body.light .tab.on { color:#fff; border-bottom-color:#fff; }
```

---

## Commandes de déploiement

```powershell
Set-Location "C:\Users\sg54378\Downloads\Boan-app"
git add index.html      # (ou api/fichier.js selon la modification)
git commit -m "type: description"
git push origin main
# Vercel déploie automatiquement en 30-60 secondes
```

---

## État actuel et derniers commits

```
fix: writeAll erreur si SID absent, marche via writeAll, guard appendRow sid
  - appendRow() retourne {ok:false} si sid undefined
  - writeAll() retourne erreur explicite si aucun SID valide
  - Soumission marché : writeAll([SID.fallou,SID.fondateur], ...) au lieu de appendRow direct

fix: double virgule dans S{} (_guideOpen: false,,)
ux: dashboard hero + bordures KPI/alertes + onglet actif vert
feat: guide gerant — modal quoi faire et quand
feat: auto-creation Config_Passwords
fix: projection vente dynamique (CYCLE.dureeMois)
fix: env vars dans handler() — cold start Vercel
feat: modification identifiants + mots de passe fondateur
fix: TABLE_RANGES declaration avant appendRow
```

---

## Problème connu résolu (référence)

**Symptôme** : "Requested entity was not found" sur le téléphone d'un tiers, pas sur le tien.  
**Cause** : Le spreadsheet `SID_GERANT` dans Vercel n'a pas les onglets avec les noms exacts attendus par le code (ex: `Stock_Nourriture` et non `Stock_Aliments`, `SOP_Check` et non `Saisie_SOP`, etc.).  
**Fix code** : `appendRow` et `writeAll` protégés contre les SID undefined avec messages d'erreur clairs.  
**Fix opérationnel** : Renommer les onglets du Google Sheet gérant pour correspondre exactement aux noms listés ci-dessus.

---

## Contexte du projet

Tu travailles sur **BOANR**, une application web mobile de gestion d'élevage bovin pour la ferme BOAN au Sénégal (région de Thiès). L'application est une **SPA (Single Page Application)** en vanilla HTML/CSS/JS sans framework, déployée sur **Vercel**.

- **URL de production** : https://boan-app-9u5e.vercel.app
- **Dépôt GitHub** : https://github.com/diopcmd/Boan-app (branche `main`)
- **Dossier local** : `C:\Users\sg54378\Downloads\Boan-app\`
- **Language** : Français (toutes les interfaces, variables métier, et communications avec l'utilisateur sont en français)

---

## Architecture technique

### Fichiers principaux
```
Boan-app/
├── index.html              (~284 Ko, ~4400 lignes) — SPA complète (HTML + CSS + JS inline)
├── vercel.json             — Config Vercel (rewrites /api/*)
├── api/
│   ├── auth.js             — Login : vérifie credentials, émet session token HMAC
│   ├── change-password.js  — Changement mot de passe ET identifiant (fondateur seulement)
│   ├── sheets.js           — Proxy Google Sheets (lire/écrire)
│   ├── token.js            — Génère access_token Google via SA key (RS256 JWT)
│   └── ai.js               — Proxy Anthropic API (Claude)
```

### Stack
- **Frontend** : Vanilla JS, pas de framework, pas de build step
- **Backend** : Vercel Serverless Functions (ES Module syntax `export default`)
- **Auth** : Session token custom HMAC-SHA256 — format `base64(payload).hmac`
- **Données** : Google Sheets via Service Account (RS256 JWT → OAuth2 access_token)
- **Déploiement** : GitHub → Vercel (auto-déploiement sur push `main`)

---

## Variables d'environnement Vercel (obligatoires)

Configurées dans le dashboard Vercel → project `boan-app` → Settings → Environment Variables :

| Variable | Rôle |
|---|---|
| `PWD_FONDATEUR` | Mot de passe rôle fondateur |
| `PWD_GERANT` | Mot de passe rôle gérant terrain |
| `PWD_RGA` | Mot de passe rôle RGA |
| `PWD_FALLOU` | Mot de passe rôle commerciale |
| `SID_FONDATEUR` | ID Google Spreadsheet fondateur |
| `SID_GERANT` | ID Google Spreadsheet gérant |
| `SID_RGA` | ID Google Spreadsheet RGA |
| `SID_FALLOU` | ID Google Spreadsheet commerciale (Fallou) |
| `SA_PRIVATE_KEY` | Clé privée RSA du Service Account Google (avec `\n` escapés) |
| `SA_CLIENT_EMAIL` | Email du Service Account Google |
| `SESSION_SECRET` | Secret HMAC pour les session tokens |
| `ANTHROPIC_API_KEY` | Clé API Anthropic/Claude (optionnelle — fonctionnalité IA) |

---

## Rôles et accès

| Rôle | Identifiant | Onglets accessibles |
|---|---|---|
| Fondateur / Direction | `fondateur` | Dashboard, Saisie, Livrables, Marché |
| Gérant terrain | `gerant` | Dashboard, Saisie |
| RGA | `rga` | Dashboard, Livrables |
| Commerciale | `fallou` | Dashboard, Marché |

Les identifiants et mots de passe peuvent être modifiés par le fondateur via l'interface (onglet Livrables → "Gestion mots de passe"). Les overrides sont stockés dans la feuille `Config_Passwords` du Google Sheets fondateur (colonnes: role, pwd_encoded, updated_at, login_override).

---

## Structure de l'index.html

### CSS global (lignes ~14–280)
- Thème dark vert : fond `#0f1a0f`, cartes `#1a2e1a`, vert accent `#2d6a2d`
- Mode clair (`body.light`) supporté
- Classes clés : `.kcard`, `.kcard-ok/.warn/.crit`, `.tab`, `.stitle`, `.al`, `.al-g/.o/.r`
- Animations : `fadeInUp`, `slideLeft/Right/InLeft/InRight`, `tabFadeIn`, `pulse`

### État global
```js
var S = { page, user, tab, sub, ... }  // État de navigation
var MOCK = { betes, gmq, stock, treso, sem, mois }  // Indicateurs en cours
var CYCLE = { nbBetes, dureeMois, dateDebut, peseeFreq }  // Config cycle
var SPARK = { betes[], gmq[], stk[], treso[] }  // Données sparklines
var HISTORY = []   // Activité récente (4 derniers)
var LIVE = { loaded, pesees[] }  // Données réelles pesées
var STOCK_MVTS = []  // Mouvements de stock
var SB = { open, tab, closing }  // Sidebar
var SWIPE = { x0, y0, active, dir }  // Gestion swipe tactile
var METEO = { loaded, today, week, showWeek }  // Météo Thiès
var USERS = { fondateur, gerant, rga, fallou }  // Config rôles côté client
```

### Fonctions clés
- `r()` — Re-render complet du DOM (`document.getElementById('app').innerHTML`)
- `chTab(t)` — Changer d'onglet (avec animation `tab-fade-in` ou slide)
- `chTabSwipe(t, dir)` — Changer d'onglet via swipe (animation slide 290ms)
- `doLogin()` — Appel `/api/auth`, stocke session token, charge données
- `doSubmit(type)` — Soumettre un formulaire (fiche, SOP, stock, etc.)
- `readSheet(sid, range)` — Lit une plage Google Sheets via `/api/sheets`
- `appendRow(sid, range, values)` — Ajoute une ligne Google Sheets
- `viewDash()` — Génère le HTML du dashboard (hero card + KPI + alertes)
- `pageGuide()` — Guide de travail gérant (modal avec sections par fréquence)
- `buildSidebar()` — Sidebar latérale (météo, stock, checklist)
- `pageLogin()` — Page de connexion
- `pageApp()` — Shell de l'app (header + tabs + contenu)

### Feuilles Google Sheets utilisées
| Feuille | Rôle |
|---|---|
| `Fiche_Quotidienne` | Fiches journalières (nb bêtes, eau, nourriture...) |
| `Saisie_SOP` | Checklists SOP bihebdomadaires |
| `Stock_Aliments` | Mouvements de stock (ajout/conso/inventaire) |
| `Saisie_Incidents` | Incidents et alertes |
| `Saisie_Pesees` | Pesées individuelles des bêtes |
| `Sante_Mortalite` | Données santé et mortalité hebdos |
| `Prix_Marche` | Prix du marché (foi, bas/moy/haut) |
| `Config_Passwords` | Override mots de passe et identifiants |

---

## Fonctionnalités implémentées

- [x] Authentification multi-rôle avec session token HMAC (8h)
- [x] Saisie fiche quotidienne, SOP, stock, incidents, pesées, santé, bilan hebdo
- [x] Dashboard avec hero card, 4 KPI cards (bêtes, GMQ, stock, trésorerie)
- [x] Sparklines sur chaque KPI
- [x] Score santé troupeau (GMQ 50pts + Stock 30pts + Bêtes 20pts)
- [x] Projection vente et ROI dynamiques (basés sur `CYCLE.dureeMois`)
- [x] Alertes intelligentes (fiche manquante, stock critique, pesée en retard...)
- [x] Sidebar avec météo Thiès, stock, checklist du jour
- [x] Navigation par swipe tactile entre onglets
- [x] Guide de travail gérant (modal esthétique avec actions rapides)
- [x] Changement de mot de passe ET d'identifiant (fondateur)
- [x] Auto-création feuille `Config_Passwords` si absente
- [x] Mode clair / mode sombre
- [x] Export rapport KPI en PDF (jsPDF)
- [x] Assistant IA (Claude) — prêt, en attente de clé API
- [x] Déploiement Vercel + GitHub CI/CD

---

## Conventions de code

- Tout le CSS et JS est **inline dans index.html** (pas de fichiers séparés)
- Pas de `let`/`const` dans le JS principal (ES5 `var` pour compatibilité max mobile)
- Les APIs Vercel utilisent `export default` (ES Module)
- Tous les appels API incluent le header `X-Session-Token`
- Les emojis dans les chaînes JS sont à éviter — utiliser des entités HTML (`&middot;`, etc.)
- Après chaque modification : `git add index.html && git commit -m "..." && git push origin main`

---

## Workflow de déploiement

```powershell
Set-Location "C:\Users\sg54378\Downloads\Boan-app"
git add index.html          # ou api/fichier.js selon ce qui a changé
git commit -m "feat: description"
git push origin main
# Vercel déploie automatiquement en ~30-60 secondes
```

---

## Points d'attention critiques

1. **Jamais de double virgule `,,`** dans l'objet `S{}` — erreur JS fatale silencieuse
2. **Emojis dans JS** — éviter les surrogates pairs directs dans les chaînes JS concaténées (utiliser entités HTML ou texte simple)
3. **Variables env Vercel** — définies dans le dashboard Vercel, PAS dans un fichier `.env` committé
4. **`USERS` dans `handler()`** — doit rester à l'intérieur de la fonction pour éviter le cold-start Vercel
5. **Swipe timeout** — doit valoir 290ms (durée animation `.28s`) sinon l'animation exit est coupée
6. **`appendRow` uses `TABLE_RANGES`** — variable déclarée `var TABLE_RANGES = {};` avant la fonction

---

## État actuel et derniers commits

```
0b37c13  fix: couleurs sidebar/calendrier adaptees au theme clair (sbLt palette)
98f2b6e  fix: tab colors aligned to reference doc (tabs bg #1a3a1a, underline #fff)
2990947  fix: meteo et modales invisibles en theme clair (palette JS + CSS body.light)
9534f99  fix: meteo light mode - always classList.contains not S._light
9fbc075  fix: encodeURIComponent sheetName uniquement - pas la plage A1 (evite %3A)
7995830  fix: appendRow read-then-PUT exact line, TABLE_RANGES start:4
bd1c763  fix: TABLE_RANGES + appendRow overwrite dans tableau formate
9fc05f1  fix: scroll bleed overlay, tab reset saveCycle, clavier mobile (yn->ynPick, r focus)
[commits plus anciens]
  fix: writeAll erreur si SID absent, marche via writeAll, guard appendRow sid
  fix: double virgule dans S{} (_guideOpen: false,,)
  ux: dashboard hero + bordures KPI/alertes + onglet actif vert
  feat: guide gerant — modal quoi faire et quand
  feat: auto-creation Config_Passwords
  fix: env vars dans handler() — cold start Vercel
  feat: modification identifiants + mots de passe fondateur
  fix: TABLE_RANGES declaration avant appendRow
```
