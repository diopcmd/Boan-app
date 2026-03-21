# Documentation Technique — BOANR

> **Version** : Mars 2026  
> **Production** : https://boan-app-9u5e.vercel.app  
> **Dépôt** : https://github.com/diopcmd/Boan-app (branche `main`)  
> **Dossier local** : `C:\Users\sg54378\Downloads\Boan-app\`

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Structure des fichiers](#2-structure-des-fichiers)
3. [Architecture technique](#3-architecture-technique)
4. [Variables d'environnement Vercel](#4-variables-denvironnement-vercel)
5. [APIs Serverless — Référence complète](#5-apis-serverless--référence-complète)
6. [Frontend — index.html](#6-frontend--indexhtml)
7. [Google Sheets — Structure exacte](#7-google-sheets--structure-exacte)
8. [Authentification et sécurité](#8-authentification-et-sécurité)
9. [Fonctionnalités métier](#9-fonctionnalités-métier)
10. [Workflow de développement](#10-workflow-de-développement)
11. [Historique des bugs et corrections](#11-historique-des-bugs-et-corrections)

---

## 1. Vue d'ensemble

BOANR est une **SPA (Single Page Application)** en vanilla HTML/CSS/JS sans framework, déployée sur Vercel. Elle permet à 4 profils utilisateurs de gérer un cycle d'engraissement de bovins à la Ferme BOAN (région de Thiès, Sénégal). Le pilotage est effectué à distance depuis la France.

### Rôles utilisateurs

| Rôle | Login canonique | Onglets accessibles |
|---|---|---|
| Fondateur / Direction | `fondateur` | Dashboard, Saisie, Livrables, Marché |
| Gérant terrain | `gerant` | Dashboard, Saisie |
| RGA | `rga` | Dashboard, Livrables |
| Commerciale | `fallou` | Dashboard, Marché |

> Les identifiants de connexion peuvent être modifiés par le fondateur (stockés dans `Config_Passwords` du Sheets fondateur). Le login canonique reste la clé interne ; le `login_override` est ce que l'utilisateur tape.

---

## 2. Structure des fichiers

```
Boan-app/
├── index.html                 SPA complète (~290 Ko, ~4400 lignes)
├── vercel.json                Config Vercel (rewrites /api/*)
├── api/
│   ├── auth.js                POST /api/auth   — Login, émission session token
│   ├── token.js               POST /api/token  — Génère access_token Google (RS256)
│   ├── sheets.js              POST /api/sheets — Proxy CRUD Google Sheets
│   ├── change-password.js     POST /api/change-password — Gestion mots de passe
│   └── ai.js                  POST /api/ai     — Proxy Anthropic Claude
├── DOCUMENTATION_TECHNIQUE.md Ce fichier
├── AI_RESUMPTION_PROMPT.md    Prompt de reprise pour IA
└── check.py                   Script de vérification local (non déployé)
```

### vercel.json

```json
{
  "version": 2,
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" }
  ]
}
```

---

## 3. Architecture technique

```
┌─────────────────────────────────────────────────┐
│  NAVIGATEUR MOBILE (iOS / Android)              │
│                                                 │
│  index.html — SPA vanilla JS                    │
│  ├── CSS inline (~280 lignes)                   │
│  ├── HTML statique (splash + #app)              │
│  └── JavaScript inline (~4200 lignes)           │
│       ├── État global : S{}, MOCK{}, CYCLE{}    │
│       ├── Moteur : r() → el.innerHTML           │
│       └── fetch() vers /api/*                  │
└──────────────────┬──────────────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────────────┐
│  VERCEL SERVERLESS — Node.js 20                 │
│  /api/auth.js           Session token HMAC      │
│  /api/token.js          OAuth2 RS256 JWT        │
│  /api/sheets.js         CRUD Google Sheets      │
│  /api/change-password.js Gestion identifiants   │
│  /api/ai.js             Proxy Claude API        │
└──────────────────┬──────────────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────────────┐
│  SERVICES EXTERNES                              │
│  Google Sheets API v4   Stockage données        │
│  Google OAuth2          Tokens SA               │
│  Anthropic Claude API   Assistant IA            │
│  Open-Meteo API         Météo Thiès             │
└─────────────────────────────────────────────────┘
```

### Flux de données (saisie formulaire)

1. Utilisateur remplit un formulaire → `doSubmit('fiche')`
2. JS construit `[date, val1, ...]`
3. `writeAll([SID.gerant, SID.fondateur], 'Fiche_Quotidienne!A:G', vals)`
4. → `appendRow(sid, range, vals)` → `getTok()` → POST `/api/token`
5. `/api/token` vérifie session HMAC, génère JWT RS256, retourne `access_token` Google
6. `appendRow` appelle directement Sheets API v4 (sans passer par `/api/sheets`)
7. Réponse `{ok: true}` → `addHistory()` → `r()` → re-render DOM

> **Important** : `appendRow` et `readSheet` dans le frontend appellent l'API Google **directement** avec l'access_token obtenu de `/api/token`. Ils ne passent PAS par `/api/sheets` (qui est un proxy alternatif non utilisé en pratique).

---

## 4. Variables d'environnement Vercel

Configurées dans **Vercel Dashboard → Project boan-app → Settings → Environment Variables**.

| Variable | Rôle |
|---|---|
| `PWD_FONDATEUR` | Mot de passe par défaut rôle fondateur |
| `PWD_GERANT` | Mot de passe par défaut rôle gérant |
| `PWD_RGA` | Mot de passe par défaut rôle RGA |
| `PWD_FALLOU` | Mot de passe par défaut rôle commerciale |
| `SID_FONDATEUR` | ID Google Spreadsheet fondateur |
| `SID_GERANT` | ID Google Spreadsheet gérant |
| `SID_RGA` | ID Google Spreadsheet RGA |
| `SID_FALLOU` | ID Google Spreadsheet commerciale |
| `SA_PRIVATE_KEY` | Clé privée RSA du Service Account (sauts de ligne escapés `\\n`) |
| `SA_CLIENT_EMAIL` | Email du Service Account Google |
| `SESSION_SECRET` | Secret HMAC-SHA256 pour les session tokens (≥ 32 chars) |
| `ANTHROPIC_API_KEY` | Clé API Anthropic Claude (optionnelle) |

> ⚠️ Ne jamais committer ces valeurs. Les mots de passe overridés sont dans `Config_Passwords` (Sheets), pas dans ces variables.

### Extraction de SA_PRIVATE_KEY

```bash
# Depuis le fichier JSON du Service Account
jq -r '.private_key' sa-key.json | sed 's/\n/\\n/g'
# Coller la valeur résultante dans Vercel (toute sur une ligne avec \n littéraux)
```

---

## 5. APIs Serverless — Référence complète

### POST /api/auth

**Body** : `{ login: string, password: string }`

**Logique** :
1. Cherche le rôle dans `USERS` (défini dans `handler()` avec `process.env`)
2. Lit `Config_Passwords!A:D` dans le Sheets fondateur
3. Login inconnu → cherche la colonne D (login override) → retrouve le rôle
4. Login connu → cherche override mot de passe en colonne B (base64)
5. Vérifie le mot de passe (env var ou override décodé)
6. Génère session token HMAC-SHA256 valide 8h
7. Retourne `{ ok, sessionToken, user: { login, name, tabs }, sid }`

**Réponse succès** :
```json
{
  "ok": true,
  "sessionToken": "base64payload.hmac_hex",
  "user": { "login": "gerant", "name": "Gerant terrain", "tabs": ["dashboard","saisie"] },
  "sid": "ID_SPREADSHEET_GERANT"
}
```

**Erreurs possibles** :
- `401` : Identifiant inconnu / Mot de passe incorrect
- `500` : `Config serveur manquante — variables manquantes : PWD_XXX` → env var non configurée dans Vercel

---

### POST /api/token

**Headers** : `X-Session-Token: <token>`

**Logique** : Vérifie session, génère JWT RS256 (SA), l'échange contre un access_token Google. Cache en mémoire pendant la durée de vie de la fonction.

**Réponse** : `{ access_token: "ya29...", expires_in: 3600 }`

---

### POST /api/sheets

**Headers** : `X-Session-Token: <token>`

**Body** : `{ action: "read"|"append"|"write", sid: string, range: string, values?: any[] }`

> Proxy alternatif vers Sheets API. En pratique, le frontend utilise `getTok()` + fetch direct. Ce proxy existe pour des cas de fallback.

---

### POST /api/change-password

**Headers** : `X-Session-Token: <token>` (doit être fondateur)

**Body** :
```json
{
  "founderPassword": "motdepasse",
  "role": "gerant",
  "newPassword": "nouveaupwd",
  "newLogin": "nouveaulogin"
}
```

**Logique** :
1. Vérifie que le session token est `fondateur`
2. Re-vérifie `founderPassword` contre `PWD_FONDATEUR` (double sécurité)
3. Auto-crée `Config_Passwords` si absente (avec en-têtes)
4. Lit les lignes existantes → update ou append
5. Stocke mot de passe en **base64** (colonne B), login override (colonne D)
6. Si fondateur change son propre pwd → le frontend le déconnecte après 2s

**Validation** :
- Mot de passe : ≥ 6 caractères
- Login override : `^[a-z0-9_]{3,}$`

---

### POST /api/ai

**Headers** : `X-Session-Token: <token>`

**Body** : Format Anthropic Messages API
```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1024,
  "system": "...",
  "messages": [{ "role": "user", "content": "..." }]
}
```

**Proxy** vers `https://api.anthropic.com/v1/messages` avec `ANTHROPIC_API_KEY` cachée côté serveur.

---

### verifySession (partagé par toutes les APIs)

```js
function verifySession(token) {
  // Retourne null|false (ai.js/token.js/sheets.js) ou payload (change-password.js)
  const [payloadB64, hmac] = token.split('.');
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
  if (payload.exp < Date.now()) return false;  // Expiré (8h)
  const expected = crypto.createHmac('sha256', process.env.SESSION_SECRET)
    .update(JSON.stringify(payload)).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
}
```

---

## 6. Frontend — index.html

### Conventions de code

- **Pas de `let`/`const`** — ES5 `var` partout (compatibilité max mobile)
- **Pas de `&&` dans les chaînes git** — utiliser `;`
- **Pas d'emojis dans les chaînes JS** concaténées — utiliser entités HTML (`\u26A0`, etc.)
- **Pas de double virgule `,,`** dans les objets — erreur fatale silencieuse
- Tout le CSS et JS est **inline dans index.html**

### Variables globales

```js
var S = {
  page: 'login',       // 'login' | 'app'
  user: null,          // 'fondateur'|'gerant'|'rga'|'fallou'
  tab: 'dashboard',    // onglet actif
  sub: 'fiche',        // sous-onglet actif
  tok: null,           // Google access_token (cache)
  tokexp: 0,           // expiration Google token (ms)
  sessionToken: null,  // Session HMAC (reçu de /api/auth)
  sending: false,      // État soumission en cours
  msg: '',             // 'ok' | 'load' | 'err:message'
  _sendCount: 0,       // Nb de sheets impliqués (pour le msg de chargement)
  _sendSheet: '',      // Nom de la feuille en cours d'écriture
  // Formulaires
  fi: {date,nb,nourris,eau,enclos,incident,desc},    // Fiche quotidienne
  fs: {date,net,des,rat,eau,stk,san,prob},           // SOP
  fst: {date,mvts:[],stockInput,stockKg,rat},        // Stock
  fin: {date,id,type,grav,desc,act,clos},            // Incident
  fp: {date,id,race,raceCustom,poids,prev,datePrev}, // Pesée
  fsa: {date,id,sym,tra,cout,res,dec},               // Santé
  fb: {sem,nb,nou,stk,inc,poi,msg},                 // Bilan hebdo
  fm: {date,foi,foiCustom,bas,moy,haut},            // Marché
  // Modales
  _guideOpen: false,
  _aiOpen: false, _aiLoading: false, _aiResult: '', _aiError: '', _aiQuestion: '',
  _pwdMgrOpen: false, _pwdMgrStep: 'auth', ...
  _resetPwdOpen: false, _resetPwd: '', _resetGoCheck: false, ...
};

var MOCK = { betes:4, gmq:1.1, stock:6, treso:680000, sem:1, mois:1 };
// Mis à jour par loadLiveData() après login

var CYCLE = lsGet('cycle') || {
  dateDebut: '', nbBetes: 4, poidsDepart: 270, race: 'Djakoré', ration: 12,
  capital: 1450000, objectifPrix: 2000, budgetSante: 200000, veterinaire: '',
  foirail: 'Thiès', commission: 2, stockLines: [], dureeMois: 8, peseeFreq: 30,
  contactUrgence: 'Direction', betes: [], initialized: false,
  gonogo: {contrats:false, infra:false, assurance:false, securite:false},
  alimentTypes: []  // types d'aliments saisis (pour autocomplete)
};

var SID = {};  // Peuplé après login : SID[login] = data.sid depuis /api/auth
// Accès : SID.gerant, SID.fondateur, SID.rga, SID.fallou

var STOCK_MVTS = [];  // [{date, type, mode:'ajouter'|'consommer', kg, cycleDebut}]
var HISTORY = [];     // [{type, label, icon, date, time, ...meta}] — 20 dernières
var LIVE = { pesees:[], beteIds:[], prix:[], loaded:false };
var SPARK = { gmq:[], stk:[], treso:[], betes:[] };  // Données sparklines 7 pts
var METEO = { temp:null, rain:null, wind:null, code:null, loaded:false, week:[] };
var SB = { open:false, tab:'today', closing:false };
var MODAL = { open:false, step:1, data:{} };   // Modale init cycle
var CONFIRM = { open:false, msg:'', cb:null }; // Dialogue confirmation
var LIGHT_MODE = lsGet('light_mode') || false;
var TABLE_RANGES = {
  // start = 1ère ligne de données (après 3 lignes d'en-têtes)
  // end   = dernière ligne possible (jamais dépassée — PUT exact)
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
};  // ⚠️ Déclaré AVANT appendRow() — ordre JS impératif

var OFFLINE_QUEUE = lsGet('offline_queue') || [];
var LAST_ACTIVITY = Date.now();  // Pour déconnexion auto 8h
```

### Fonctions de rendu

| Fonction | Rôle |
|---|---|
| `r()` | Re-render complet — `#app.innerHTML = ...` |
| `pageLogin()` | Page de connexion |
| `pageApp()` | Shell app (header + tabs + contenu) |
| `viewDash()` | Dashboard (hero card KPIs + alertes + activité) |
| `viewSaisie()` | Onglet saisie (sous-onglets) |
| `viewLiv()` | Livrables (tréso + simulation + projection + mots de passe) |
| `viewMarche()` | Marché (prix + recommandations vente) |
| `buildSidebar()` | Sidebar (météo + stock + checklist) |
| `pageGuide()` | Modal guide de travail gérant |
| `pageModal()` | Modal initialisation cycle (4 étapes) |
| `pageAI()` | Modal assistant IA Claude |
| `pagePwdManager()` | Modal gestion mots de passe |
| `pageResetPwd()` | Modal Go/No-Go démarrage nouveau cycle |
| `pageConfirm()` | Dialogue confirmation générique |

### Fonctions réseau

```js
// Obtenir un access_token Google (cache interne S.tok / S.tokexp)
function getTok() → Promise<string|null>

// Lire une plage Sheets directement via access_token Google
function readSheet(sid, range) → Promise<string[][]|null>

// Écrire une ligne dans un tableau Sheets formaté — pattern read-then-PUT
// ⚠️ JAMAIS d'INSERT_ROWS (casserait la mise en forme des tableaux)
// ⚠️ Guard : retourne {ok:false} si sid est undefined/null
// ⚠️ encodeURIComponent sur sheetName UNIQUEMENT (pas sur la plage A1, ':' → '%3A' rejeté)
function appendRow(sid, range, vals) {
  // 1. Lit colonne A entre tr.start et tr.end
  var enc = encodeURIComponent(sheetName);
  var readUrl = base + enc + '!A' + tr.start + ':A' + tr.end;
  // 2. Calcule la première ligne vide : targetLine = start + nb_lignes_déjà_remplies
  var targetLine = Math.min(tr.start + rows.length, tr.end);
  // 3. PUT exact à targetLine (aucune insertion de ligne)
  var writeUrl = base + enc + '!A' + targetLine + '?valueInputOption=USER_ENTERED';
  return fetch(writeUrl, {method:'PUT', ...});
}

// Écrire dans plusieurs SIDs simultanément — filtre les SIDs undefined
function writeAll(sids[], range, vals) → Promise<{ok:bool, err?:string}>
// ⚠️ Retourne une erreur explicite si aucun SID valide (SID non configuré dans Vercel)
```

### Fonctions de soumission

```js
function doSubmit(type)      // Validation + anti-doublons + confirmations de sécurité
function _submitActual(type) // Écriture réelle dans Sheets
```

Flux interne de `_submitActual` :

```js
function writeAll(sids, range, vals)  // définie localement dans _submitActual
function kpiAppend(vals)              // → KPI_Mensuels (fondateur seulement)
function kpiHebdoAppend(vals)         // → KPI_Hebdo (fondateur seulement)
```

### Navigation

```
S.tab = 'dashboard'   → viewDash()
S.tab = 'saisie'      → viewSaisie()
  S.sub = 'fiche' | 'sop' | 'stock' | 'inc' | 'pesee' | 'sante' | 'bilan'
S.tab = 'livrables'   → viewLiv()
  S.sub = 'treso' | 'sim' | 'proj' | 'pw'
S.tab = 'marche'      → viewMarche()
  S.sub = 'prix' | 'reco'
```

### Swipe tactile

- Seuil horizontal : 50px ET rapport dx/dy > 1.5
- Timeout : **290ms** (durée animation `.28s` — ne pas réduire)
- Fonctions : `initSwipe()`, `chTabSwipe(t, dir)`, `chTab(t)`, `chSub(s)`

### LocalStorage

```js
// Clé préfixée 'boanr_' — helpers lsGet/lsSet
lsGet('cycle')         // CYCLE
lsGet('stock_mvts')    // STOCK_MVTS
lsGet('history')       // HISTORY
lsGet('last_fiche')    // ISO date dernière fiche soumise
lsGet('offline_queue') // OFFLINE_QUEUE
lsGet('light_mode')    // boolean
```

### Helpers de rendu de formulaire

```js
function fl(label, inputHtml, val)        // Floating label field
function yn(val, k, obj)                  // Boutons OUI/NON
function msgHtml()                        // Message feedback (ok/load/err)
function beteSelect(val, stateKey, extra) // Champ ID bête avec dropdown custom
function addStockLigne(mode)              // Ajouter une ligne stock (ajouter/consommer)
function sparkline(data, color, w, h)     // SVG sparkline 7 points
function formProgress(filled, total)      // Barre de progression formulaire
function calBadge(done, msg, resetFn)     // Badge anti-doublon calendaire
```

### Date et fuseau horaire

```js
// Tout est en heure de Dakar (UTC+0 toute l'année)
function _nowDakar() → {year, month, day, hour, minute, weekday}
function today()    → "DD/MM/YYYY"
function todayISO() → "YYYY-MM-DD"
function isoToFr(iso) → "DD/MM/YYYY"
```

### Anti-doublons

```js
ficheDejaSoumise()                  // 1 fiche par jour (lsGet 'last_fiche')
bilanDejaFaitCetteSemaine()         // 1 bilan par jour calendaire (HISTORY)
sopDejaFait()                       // 1 SOP tous les 14 jours
peseeDejaFaite(id)                  // 1 pesée par bête par semaine ISO
incidentDejaEnregistre(id, type)    // 1 incident par bête+type par jour
santeDejaEnregistree(id, sym)       // 1 sante par bête+symptôme par jour
```

### Assistant IA

- L'IA Claude reçoit un contexte complet construit par `buildAIContext()` :
  troupeau, stock détaillé, finances, pesées récentes, prix foirail, incidents, santé
- 6 questions rapides prédéfinies en `AI_QUESTIONS[]`
- Partage WhatsApp de la réponse via `partagerAIWhatsApp()`
- Modèle : `claude-sonnet-4-20250514`, max 1024 tokens

---

## 7. Google Sheets — Structure exacte

> ⚠️ Les noms d'onglets sont **sensibles à la casse et aux espaces**. Une divergence provoque `"Requested entity was not found"` pour l'utilisateur concerné.

### Feuilles par spreadsheet

#### Spreadsheet GÉRANT (`SID_GERANT`)

| Onglet (nom exact) | Colonnes (A→…) | Appelé par |
|---|---|---|
| `Fiche_Quotidienne` | Date, NbBetes, Nourris, Eau, Enclos, Incident, Description | `writeAll([SID.gerant,SID.fondateur], 'Fiche_Quotidienne!A:G', ...)` |
| `SOP_Check` | Date, Net, Des, Rat, Eau, Stk, San, Prob | `writeAll([SID.gerant,SID.fondateur,SID.rga], 'SOP_Check!A:H', ...)` |
| `Stock_Nourriture` | Date, TypeAliment, kg, Ration_kg_j, Semaines, Alerte | `writeAll([SID.gerant,SID.fondateur], 'Stock_Nourriture!A:F', ...)` |
| `Incidents` | Date, IdBete, Type, Gravite(1-3), Description, Action, Cloture | `writeAll([SID.gerant,SID.fondateur,SID.rga], 'Incidents!A:G', ...)` |
| `Pesees` | Date, IdBete, Race, Poids, PoidsPrecédent, Gain, Statut | `writeAll([SID.gerant,SID.fondateur], 'Pesees!A:G', ...)` |
| `Sante_Mortalite` | Date, IdBete, Symptome, Traitement, Cout, Resultat, Deces(OUI/NON) | `writeAll([SID.gerant,SID.fondateur,SID.rga], 'Sante_Mortalite!A:G', ...)` |
| `Hebdomadaire` | Semaine, NbBetes, Nourriture, Stock, Incidents, Poids, Alerte, Message | `writeAll([SID.gerant,SID.fondateur,SID.rga], 'Hebdomadaire!A:H', ...)` |

#### Spreadsheet FONDATEUR (`SID_FONDATEUR`)

Reçoit aussi les onglets ci-dessus (via `writeAll`). En plus :

| Onglet (nom exact) | Colonnes (A→K) | Appelé par |
|---|---|---|
| `KPI_Mensuels` | Date, Deces, ?, kg_stock, ?, ?, poids, ?, nb_inc, ?, msg | `kpiAppend()` (interne à `_submitActual`) |
| `KPI_Hebdo` | Semaine, NbBetes, Stock, ?, ?, Incidents, ?, Nourriture, ?, Alerte | `kpiHebdoAppend()` |
| `Config_Passwords` | role, pwd_encoded(base64), updated_at, login_override | `/api/change-password`, `/api/auth` |

**Lecture** `KPI_Mensuels!A4:K50` pour la trésorerie (colonne H = index 7, 0-based).

#### Spreadsheet RGA (`SID_RGA`)

Reçoit en écriture : `SOP_Check`, `Incidents`, `Sante_Mortalite`, `Hebdomadaire`.

#### Spreadsheet FALLOU (`SID_FALLOU`)

| Onglet | Colonnes | Appelé par |
|---|---|---|
| `Suivi_Marche` | Date, Foirail, Bas, Moy, Haut, ?, ?, -, ?, ? | `writeAll([SID.fallou,SID.fondateur], 'Suivi_Marche!A:J', ...)` |

**Lecture** `Suivi_Marche!A4:J30` pour les prix (LIVE.prix).

### Lecture pour le dashboard

```js
loadLiveData()  // Appelée 500ms après login
  readSheet(SID.gerant,   'Sante_Mortalite!A4:G50')  → MOCK.betes, SPARK.betes
  readSheet(SID.gerant,   'Pesees!A4:G50')           → MOCK.gmq,  SPARK.gmq  (colonne F=index5)
  readSheet(SID.gerant,   'Stock_Nourriture!A4:F50') → MOCK.stock, SPARK.stk
  readSheet(SID.fondateur,'KPI_Mensuels!A4:K50')     → MOCK.treso, SPARK.treso (col H)

loadPesees()    // Appelée 800ms après login
  readSheet(SID.gerant, 'Pesees!A4:G50')   → LIVE.pesees[], LIVE.beteIds[]

loadPrix()      // Appelée 1000ms après login
  readSheet(SID.fallou, 'Suivi_Marche!A4:J30')  → LIVE.prix[]
```

---

## 8. Authentification et sécurité

### Session Token

Format : `base64url(JSON.stringify(payload)) + '.' + hmac_sha256_hex`

```js
// Payload
{ login: "fondateur", role: "fondateur", exp: Date.now() + 8*3600*1000 }

// Génération dans api/auth.js
const payload = JSON.stringify({ login, role, exp });
const hmac = crypto.createHmac('sha256', process.env.SESSION_SECRET)
  .update(payload).digest('hex');
const token = Buffer.from(payload).toString('base64') + '.' + hmac;
```

> ⚠️ Différence entre `auth.js` (payload en `JSON.stringify`) et la vérification qui deserialize `JSON.parse(Buffer.from(payloadB64, 'base64'))`. Le HMAC est calculé sur le **JSON stringifié** dans les deux sens — attention à ne pas mélanger.

### Stockage côté client

- `S.sessionToken` — en mémoire uniquement (non persisté)
- Si l'utilisateur recharge la page → reconnexion obligatoire
- Auto-déconnexion après **8h d'inactivité** (vérifiée toutes les 60s via `setInterval`)

### Mots de passe Config_Passwords

- Stockés en **base64** (encodage, pas chiffrement)
- Fallback : si absent du Sheets → env var `PWD_*`
- Priorité : `Config_Passwords` > env var

### Validation inputs (change-password)

- Mot de passe : longueur ≥ 6
- Login override : `/^[a-z0-9_]{3,}$/`

---

## 9. Fonctionnalités métier

### Calcul du score santé (0 à 100 pts)

```js
var scoreBetes = mortalite === 0 ? 20 : mortalite <= 5 ? 12 : mortalite <= 10 ? 5 : 0;
var sante = Math.min(50, (MOCK.gmq / 1.2) * 50)  // GMQ : 50 pts (cible 1.2 kg/j)
          + (stock >= 6 ? 30 : stock >= 4 ? 15 : stock > 0 ? 5 : 0)  // Stock : 30 pts
          + scoreBetes;  // Mortalité : 20 pts
```

### Calcul GMQ réel (loadPesees)

Le GMQ est calculé entre pesées consécutives de la même bête :
```js
var jours = Math.round((dateActuelle - datePrecedente) / 86400000);
p.gmq = jours > 0 ? Math.round((gain / jours) * 100) / 100 : 0;
```

### Projection vente

```js
var semTotales    = Math.round((CYCLE.dureeMois || 8) * 4.33);
var semRestantes  = semTotales - semActuelle;
var gainRestant   = 1.2 * 7 * semRestantes;  // GMQ cible 1.2 kg/j
var poidsVente    = poidsActuel + gainRestant;
var recette       = poidsVente * prixMoyen * MOCK.betes;
```

### Stock local (fallback sans Sheets)

```js
function calcStockLocal() {
  // Somme nette par aliment depuis STOCK_MVTS
  var netKg = {};
  STOCK_MVTS.forEach(m => netKg[m.type] = (netKg[m.type]||0) + (m.mode==='ajouter' ? m.kg : -m.kg));
  var totalNet = Object.values(netKg).reduce((s,v) => s + Math.max(0,v), 0);
  var rationJour = (CYCLE.ration||12) * (CYCLE.nbBetes||4);
  return Math.round((totalNet / (rationJour * 7)) * 10) / 10;  // semaines
}
```

### Initialisation d'un nouveau cycle (fondateur)

1. Go/No-Go check (7 critères) + case à cocher
2. Vérification mot de passe fondateur via `/api/auth`
3. Modal 4 étapes : Troupeau → Finances → Marché → Registre bêtes
4. `saveCycle()` : écrit dans `lsSet('cycle', CYCLE)`, réinitialise `STOCK_MVTS`, `HISTORY`, etc.

### IDs bêtes

Format généré automatiquement : `C1-001`, `C1-002`, ... (`C{numCycle}-{numBete:03d}`)
Modifiable par l'utilisateur à l'étape 4 de la modale init.

### Météo

`fetchMeteo()` — API Open-Meteo, coordonnées Thiès : `14.79°N, -16.93°E`, timezone `Africa/Dakar`
Retourne : température, pluie, vent, code météo, prévisions 7 jours.

---

## 10. Workflow de développement

### Déploiement (commandes exactes)

```powershell
Set-Location "C:\Users\sg54378\Downloads\Boan-app"
git add index.html                           # ou api/fichier.js
git commit -m "feat: description"
git push origin main
# Vercel déploie automatiquement en ~30-60 secondes
```

> Toujours utiliser `;` pour chaîner dans PowerShell, jamais `&&`.

### Tester en local (preview sans API)

Ouvrir `index.html` directement dans un navigateur — les appels API échoueront mais la navigation est visible.

### Tester les APIs en local

```bash
npm install -g vercel
vercel dev   # Lance un serveur local sur http://localhost:3000
# Les variables d'env sont chargées depuis un fichier .env local (non committé)
```

### Points d'attention critiques

1. **Double virgule `,,` dans `S{}`** → erreur JS fatale silencieuse (page blanche)
2. **Emojis en JS** → risque de surrogates pairs → utiliser `\u26A0` ou texte simple
3. **`TABLE_RANGES = {}`** → doit être déclaré avant la définition de `appendRow()`
4. **`USERS` dans `handler()`** → doit rester dans la fonction, pas au niveau module, pour Vercel cold start
5. **Swipe timeout : 290ms** → durée animation `.28s` — ne jamais réduire
6. **SID undefined** → `appendRow` retourne maintenant `{ok:false}` proprement ; `writeAll` log une erreur claire
7. **Noms d'onglets Sheets** → exact match requis (voir section 7)

---

## 11. Historique des bugs et corrections

### Session 1 — Erreur "Requested entity was not found" (téléphones tiers)
- **Cause** : Noms d'onglets Google Sheets ne correspondant pas aux noms attendus + `appendRow(SID.fallou, ...)` appelé sans guard sur `SID` indéfini
- **Fix** :
  - `appendRow()` : guard `if (!sid) return {ok:false}`
  - `writeAll()` : filtre les SIDs `undefined`, message d'erreur enrichi si "not found"
  - Soumission marché : `writeAll([SID.fallou, SID.fondateur], ...)` au lieu de `appendRow(SID.fallou, ...)`

### Session 2 — 3 bugs UX (scroll, onglets, clavier)
- **Bug scroll** : `body.style.overflow = 'hidden'` dans `r()` quand un overlay est ouvert ; `overscroll-behavior:contain` sur `.sb`
- **Bug onglets instables** : `saveCycle()` réinitialise `S.tab` et `S.sub` avant la fermeture de MODAL
- **Bug clavier mobile** : `r()` sauvegarde/restaure l'`id` + curseur du champ actif après re-render ; `yn()` refactorisé en `ynPick()` (mise à jour DOM directe, sans `r()`) ; `addStockLigne()` et `addModalStock()` refocoalisent le champ type après ajout

### Session 3 — Écriture Google Sheets dans tableaux formatés
- **Problème** : `append?insertDataOption=INSERT_ROWS` ajoutait des lignes hors du tableau, cassant le formatage
- **Fix** : `TABLE_RANGES` configuré avec `{start:4, end:N}` pour chaque onglet. `appendRow` lit d'abord la colonne A (lignes présentes), calcule `targetLine = start + rows.length`, écrit avec **PUT** à la ligne précise — aucune insertion de ligne
- **Erreur** : `encodeURIComponent('Fiche_Quotidienne!A4:A500')` encodait `:` en `%3A` → "unable to parse range". **Fix** : encoder uniquement `sheetName` et concaténer la notation A1 sans encoding

### Session 4 — Thème clair : météo, sidebar, onglets, modales
- **Météo** : Couleurs générées en JS avec `var _lt = document.body.classList.contains('light')` (ne plus utiliser `S._light` ou attrs CSS `[style*=]`)
- **Sidebar palette** : `var _sbLt / _sbSub / _sbData` déclarés en haut de `buildSidebar()` — utilisés par toutes les couleurs inline (calendrier, historique, données)
- **Onglets principals** : `.tabs{background:#1a3a1a}`, `.tab.on{border-bottom-color:#fff}` (soulignement blanc conforme doc)
- **Modales/confirm** : `body.light .confirm-inner`, `body.light .modal`, `.modal-head/body/foot` corrigés

---

## 12. Règles architecture à ne jamais briser

| Règle | Pourquoi |
|---|---|
| `var` uniquement dans `index.html` | Compatibilité mobile ES5 |
| `TABLE_RANGES = {}` avant `appendRow()` | Ordre d'exécution JS |
| `USERS` dans `handler()` | Cold start Vercel — env vars non dispo au module level |
| Encoder seulement `sheetName`, pas la plage A1 | `encodeURIComponent` encode `:` en `%3A` rejeté par Sheets API |
| Détecter thème via `document.body.classList.contains('light')` | `LIGHT_MODE` peut être désynchro |
| `yn()` → `ynPick()` DOM direct | Pas de `r()` sur OUI/NON — garde le clavier ouvert |
| Chainer git avec `;` PowerShell | `&&` non supporté PowerShell |


| Date | Bug | Cause | Correction |
|---|---|---|---|
| 2026-03 | "Requested entity was not found" sur téléphone ami | SID_GERANT pointe vers un Sheets sans les bons noms d'onglets | Guard `appendRow` + erreur explicite dans `writeAll` + noms à vérifier |
| 2026-03 | Marché inaccessible si `SID.fallou` non chargé | `appendRow(SID.fallou, ...)` sans vérification | `writeAll([SID.fallou, SID.fondateur], ...)` |
| 2026-03 | `_guideOpen: false,,` — page blanche | Double virgule dans `S{}` | Suppression virgule en trop |
| 2026-03 | "Config serveur manquante" au login | `USERS` défini au niveau module → env vars non chargées (cold start) | `USERS` déplacé dans `handler()` |
| 2026-03 | `ReferenceError: TABLE_RANGES` | Variable utilisée avant déclaration | `var TABLE_RANGES = {};` ajouté avant `appendRow` |
| 2026-03 | Projection figée à 35 semaines | Valeur hardcodée | `Math.round((CYCLE.dureeMois\|\|8)*4.33)` |
| 2026-03 | SPARK.betes statique | Jamais mis à jour | Lecture `Sante_Mortalite!A4:G50` dans `loadLiveData` |
| 2026-03 | Score santé incohérent | Formule incorrecte | 3 composantes : GMQ(50) + Stock(30) + Bêtes(20) |
| 2026-03 | Animation swipe coupée | Timeout 120ms < animation 280ms | Timeout porté à 290ms |

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture](#2-architecture)
3. [Installation et déploiement](#3-installation-et-déploiement)
4. [Variables d'environnement](#4-variables-denvironnement)
5. [API Serverless](#5-api-serverless)
6. [Frontend — index.html](#6-frontend--indexhtml)
7. [Authentification et sécurité](#7-authentification-et-sécurité)
8. [Google Sheets — Structure des données](#8-google-sheets--structure-des-données)
9. [Fonctionnalités métier](#9-fonctionnalités-métier)
10. [Bugs connus et corrections appliquées](#10-bugs-connus-et-corrections-appliquées)

---

## 1. Vue d'ensemble

BOANR est une application web mobile-first permettant à 4 profils utilisateurs de gérer un cycle d'engraissement de bovins :

- **Fondateur / Direction** : vue complète (dashboard + saisies + livrables + marché)
- **Gérant terrain** : saisies quotidiennes et dashboard de suivi
- **RGA** : suivi des livrables financiers
- **Commerciale (Fallou)** : suivi des prix de marché

L'app fonctionne **hors-ligne pour la navigation** (toutes les pages sont dans le HTML), mais les **sauvegardes et lectures** nécessitent une connexion Internet (Google Sheets via API).

---

## 2. Architecture

```
┌─────────────────────────────────────────────┐
│  NAVIGATEUR MOBILE                          │
│                                             │
│  index.html                                 │
│  ├── CSS inline (~260 lignes)               │
│  ├── HTML statique (splash + #app)          │
│  └── JavaScript inline (~4000 lignes)       │
│       ├── État global : S{}, MOCK{}, etc.   │
│       ├── Moteur de rendu : r() → innerHTML │
│       └── Appels API fetch()                │
└──────────────┬──────────────────────────────┘
               │ HTTPS
┌──────────────▼──────────────────────────────┐
│  VERCEL SERVERLESS (Node.js 20)             │
│                                             │
│  /api/auth.js           Login               │
│  /api/change-password.js Chang. mot de passe│
│  /api/sheets.js         CRUD Google Sheets  │
│  /api/token.js          Token Google OAuth  │
│  /api/ai.js             Proxy Claude API    │
└──────────────┬──────────────────────────────┘
               │ HTTPS
┌──────────────▼──────────────────────────────┐
│  SERVICES EXTERNES                          │
│                                             │
│  Google Sheets API v4   (stockage données)  │
│  Google OAuth2          (tokens SA)         │
│  Anthropic Claude API   (assistant IA)      │
│  Open-Meteo API         (météo Thiès)       │
└─────────────────────────────────────────────┘
```

### Flux de données typique

1. Utilisateur saisit un formulaire → `doSubmit('fiche')`
2. JS construit le tableau `[date, val1, val2, ...]`
3. `appendRow(sid, range, values)` → POST `/api/sheets`
4. `/api/sheets` vérifie le session token, obtient un access_token Google, appelle Sheets API
5. Réponse → mise à jour `HISTORY[]` → `r()` → re-render DOM

---

## 3. Installation et déploiement

### Prérequis

- Un compte **GitHub** avec le dépôt `diopcmd/Boan-app`
- Un compte **Vercel** connecté au dépôt GitHub
- Un **Google Service Account** avec accès aux Google Sheets
- Les **Google Sheets** créés et partagés avec l'email du Service Account

### Développement local

Aucun serveur local nécessaire pour le frontend — ouvrir `index.html` directement dans un navigateur suffit pour prévisualiser les pages statiques. Les appels API échoueront localement (pas de Vercel), mais la structure de l'app est visible.

Pour tester les APIs localement, utiliser **Vercel CLI** :
```bash
npm install -g vercel
vercel dev   # Lance un serveur local avec les fonctions Vercel
```

### Déploiement

Le déploiement est **entièrement automatique** via GitHub Actions → Vercel :
```powershell
git add .
git commit -m "feat: description de la modification"
git push origin main
# Vercel détecte le push et déploie en ~30-60 secondes
```

### Structure des fichiers

```
Boan-app/
├── index.html              SPA complète (~284 Ko)
├── vercel.json             Config Vercel
├── api/
│   ├── auth.js             POST /api/auth
│   ├── change-password.js  POST /api/change-password
│   ├── sheets.js           POST /api/sheets
│   ├── token.js            POST /api/token
│   └── ai.js               POST /api/ai
└── AI_RESUMPTION_PROMPT.md Prompt de reprise pour IA
```

---

## 4. Variables d'environnement

Configurées dans **Vercel Dashboard → Project → Settings → Environment Variables**.

> ⚠️ Ne jamais committer ces valeurs dans le dépôt GitHub.

| Variable | Type | Rôle |
|---|---|---|
| `PWD_FONDATEUR` | string | Mot de passe du rôle fondateur |
| `PWD_GERANT` | string | Mot de passe du rôle gérant |
| `PWD_RGA` | string | Mot de passe du rôle RGA |
| `PWD_FALLOU` | string | Mot de passe du rôle commerciale |
| `SID_FONDATEUR` | string | ID du Google Spreadsheet fondateur (dans l'URL Sheets) |
| `SID_GERANT` | string | ID du Google Spreadsheet gérant |
| `SID_RGA` | string | ID du Google Spreadsheet RGA |
| `SID_FALLOU` | string | ID du Google Spreadsheet commerciale |
| `SA_PRIVATE_KEY` | string | Clé privée RSA du Service Account (les `\n` doivent être escapés en `\\n`) |
| `SA_CLIENT_EMAIL` | string | Email du Service Account (ex: `boan@project.iam.gserviceaccount.com`) |
| `SESSION_SECRET` | string | Secret HMAC-SHA256 pour les session tokens (chaîne aléatoire ≥ 32 chars) |
| `ANTHROPIC_API_KEY` | string | Clé API Anthropic Claude (optionnel) |

### Comment obtenir `SA_PRIVATE_KEY`

1. Google Cloud Console → IAM → Service Accounts → votre SA → Clés → Ajouter une clé JSON
2. Télécharger le fichier JSON
3. Extraire le champ `private_key` du JSON
4. Remplacer tous les vrais sauts de ligne `\n` par la chaîne littérale `\\n` avant de coller dans Vercel

---

## 5. API Serverless

Toutes les fonctions suivent la même structure :
```js
export default async function handler(req, res) {
  // 1. CORS headers
  // 2. OPTIONS preflight
  // 3. Method check
  // 4. Vérification session token (sauf /api/auth)
  // 5. Logique métier
  // 6. Réponse JSON
}
```

### POST /api/auth

**Rôle** : Vérifier les credentials et émettre un session token.

**Body** :
```json
{ "login": "fondateur", "password": "monmotdepasse" }
```

**Réponse succès** :
```json
{
  "ok": true,
  "role": "fondateur",
  "sid": "ID_SPREADSHEET",
  "sessionToken": "base64payload.hmac",
  "user": { "name": "Direction", "tabs": [...] }
}
```

**Logique** :
1. Cherche le rôle dans `USERS` (défini dans la fonction avec `process.env`)
2. Lit `Config_Passwords!A:D` dans le Sheets fondateur pour les overrides
3. Si login inconnu → cherche dans colonne D (identifiant overridé)
4. Si login connu → cherche override de mot de passe en colonne B (base64)
5. Vérifie le mot de passe
6. Génère un session token HMAC-SHA256 valide 8h

---

### POST /api/change-password

**Rôle** : Changer le mot de passe et/ou l'identifiant d'un rôle (fondateur uniquement).

**Headers** : `X-Session-Token: <token>`

**Body** :
```json
{
  "targetRole": "gerant",
  "newPassword": "nouveaumotdepasse",
  "newLogin": "nouveaulogin"
}
```

**Logique** :
1. Vérifie que le demandeur est `fondateur` (via session token)
2. Vérifie/crée la feuille `Config_Passwords` (auto-création avec en-têtes si absente)
3. Lit les lignes existantes en filtrant la ligne d'en-tête
4. Encode le nouveau mot de passe en base64
5. Met à jour ou ajoute la ligne du rôle cible
6. Les positions de lignes sont en 1-based + 1 pour l'en-tête (`targetSheetRow = i + 2`)

---

### POST /api/sheets

**Rôle** : Proxy CRUD vers Google Sheets API v4.

**Headers** : `X-Session-Token: <token>`

**Body** :
```json
{
  "action": "read|append|write",
  "sid": "ID_SPREADSHEET",
  "range": "Feuille!A1:Z100",
  "values": [...]
}
```

**Actions** :
- `read` → GET sur la plage
- `append` → POST `:append` (insère une nouvelle ligne)
- `write` → PUT sur la plage (écrase)

**Token Google** : Le token OAuth2 est obtenu via RS256 JWT et mis en cache en mémoire pendant la durée de vie de la fonction.

---

### POST /api/token

**Rôle** : Génère un access_token Google OAuth2 pour le front (usage direct par le frontend pour des lectures sans proxy).

**Headers** : `X-Session-Token: <token>`

**Réponse** :
```json
{ "access_token": "ya29...", "expires_in": 3600 }
```

---

### POST /api/ai

**Rôle** : Proxy vers l'API Anthropic Claude (cache la clé API côté serveur).

**Headers** : `X-Session-Token: <token>`

**Body** : Identique à l'API Anthropic Messages
```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1024,
  "system": "...",
  "messages": [{ "role": "user", "content": "..." }]
}
```

---

## 6. Frontend — index.html

### Moteur de rendu

L'app utilise un **re-render complet du DOM** à chaque action :
```js
function r() {
  var el = document.getElementById('app');
  // 1. Sauvegarde le focus actif (pour garder le clavier mobile ouvert)
  var _aid = document.activeElement && document.activeElement.id ? document.activeElement.id : null;
  // Sauvegarde aussi la position du curseur (selectionStart/End)
  // 2. Scroll lock : body.overflow = 'hidden' si un overlay est ouvert
  var _ov = SB.open || MODAL.open || CONFIRM.open || ...;
  document.body.style.overflow = _ov ? 'hidden' : '';
  // 3. Re-render
  var html = (S.page==='login') ? pageLogin() : pageApp() + overlays...;
  el.innerHTML = html;
  // 4. Restaure le focus (empêche le clavier mobile de se fermer)
  if (_aid && (_atag==='INPUT'||_atag==='TEXTAREA')) {
    var _re = document.getElementById(_aid);
    if (_re) { _re.focus({preventScroll:true}); /* restaure curseur si besoin */ }
  }
}
```

> **Important** : Ne jamais appeler `r()` depuis `ynPick()` sauf si la structure change (champs additionnels). Le DOM est mis à jour directement via `getElementById()` pour conserver le focus clavier.

### État global (objet S)

```js
var S = {
  page: 'login',      // 'login' | 'app'
  user: null,         // 'fondateur' | 'gerant' | 'rga' | 'fallou'
  tab: 'dashboard',   // onglet actif
  sub: 'fiche',       // sous-onglet saisie actif
  tok: null,          // Google access_token
  tokexp: 0,          // expiration token Google
  sessionToken: null, // Session token HMAC
  lid: '', lpw: '', lerr: '',   // Login form
  fi: {}, fs: {}, fst: {}, ... // Formulaires saisie
  _guideOpen: false,  // Modal guide gérant
  _pwdMgrOpen: false, // Modal gestion mots de passe
  _aiOpen: false,     // Modal assistant IA
}
```

### Variables de données

```js
var MOCK = {
  betes: 4,    // Nombre de bêtes actuelles
  gmq: 0,      // Gain moyen quotidien (kg/j)
  stock: 0,    // Semaines de stock restantes
  treso: 0,    // Trésorerie (FCFA)
  sem: 1,      // Semaine actuelle du cycle
  mois: 1      // Mois actuel du cycle
};

var CYCLE = {
  nbBetes: 4,       // Nombre initial de bêtes
  dureeMois: 8,     // Durée prévue du cycle en mois
  dateDebut: '',    // Date de début du cycle (ISO)
  peseeFreq: 30     // Fréquence des pesées en jours
};

var SPARK = {
  betes: [4,4,4,4,4,4,4],   // Historique 7 semaines (bêtes)
  gmq:   [0,0,0,0,0,0,0],   // Historique 7 semaines (GMQ)
  stk:   [0,0,0,0,0,0,0],   // Historique 7 semaines (stock)
  treso: [0,0,0,0,0,0,0]    // Historique 7 semaines (trésorerie)
};
```

### Navigation

```
S.page = 'app'
    └── S.tab = 'dashboard'    → viewDash()
    └── S.tab = 'saisie'       → viewSaisie()
            └── S.sub = 'fiche' | 'sop' | 'stock' | 'inc' | 'pesee' | 'sante' | 'bilan'
    └── S.tab = 'livrables'    → viewLiv()
            └── S.sub = 'treso' | 'sim' | 'proj' | 'pw'
    └── S.tab = 'marche'       → viewMarche()
            └── S.sub = 'prix' | 'reco'
```

### Fonctions de rendu des pages

| Fonction | Sortie |
|---|---|
| `pageLogin()` | Page de connexion |
| `pageApp()` | Shell (header + tabs + contenu de l'onglet actif) |
| `viewDash()` | Dashboard complet (hero card + KPIs + alertes + activité) |
| `viewSaisie()` | Onglet saisie avec sous-onglets |
| `viewLiv()` | Onglet livrables (trésorerie, simulation, projection) |
| `viewMarche()` | Onglet marché (prix + recommandations) |
| `buildSidebar()` | Sidebar latérale (météo, stock, checklist) |
| `pageGuide()` | Guide de travail gérant (modal) |
| `pagePwdManager()` | Gestionnaire mots de passe/identifiants |
| `pageAI()` | Assistant IA Claude |

### Appels API depuis le frontend

```js
// Lecture Google Sheets
function readSheet(sid, range) {
  return fetch('/api/sheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Session-Token': S.sessionToken },
    body: JSON.stringify({ action: 'read', sid, range })
  }).then(r => r.json());
}

// Ajout d'une ligne
function appendRow(sid, range, values) {
  TABLE_RANGES[range] = true;
  return fetch('/api/sheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Session-Token': S.sessionToken },
    body: JSON.stringify({ action: 'append', sid, range, values })
  }).then(r => r.json());
}
```

---

## 7. Authentification et sécurité

### Session Token

Format : `base64url(payload).hmac_sha256`

```js
// Payload
{
  login: "fondateur",
  role: "fondateur",
  exp: 1741234567890  // timestamp ms, +8h
}

// Génération (api/auth.js)
const payload = JSON.stringify({ login, role, exp: Date.now() + 8*3600*1000 });
const payloadB64 = Buffer.from(payload).toString('base64');
const hmac = crypto.createHmac('sha256', process.env.SESSION_SECRET)
  .update(payload).digest('hex');
const token = payloadB64 + '.' + hmac;
```

### Vérification (dans chaque API)

```js
function verifySession(token) {
  if (!token) return false;
  const [payloadB64, hmac] = token.split('.');
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
  if (payload.exp < Date.now()) return false;  // Expiré
  const expected = crypto.createHmac('sha256', process.env.SESSION_SECRET)
    .update(JSON.stringify(payload)).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
}
```

### Mots de passe dans Config_Passwords

Les overrides de mots de passe sont stockés en **base64** dans la colonne B de la feuille `Config_Passwords`. Ce n'est pas du chiffrement — c'est de l'encodage. Pour une sécurité renforcée, utiliser bcrypt (nécessiterait une dépendance npm).

Structure de la feuille :
```
role | pwd_encoded (base64) | updated_at | login_override
fondateur | dGVzdA== | 20/03/2026 | 
gerant | | | patron
```

---

## 8. Google Sheets — Structure des données

### Feuille : Fiche_Quotidienne
```
Date | NbBetes | Nourris | Eau | Enclos | Incident | Description
```

### Feuille : Saisie_SOP
```
Date | NbBetes | DesinfEnc | RatAli | EauFr | StockAli | SanteGen | ProblSig
```

### Feuille : Stock_Aliments
```
Date | Type (ajout/conso/inventaire) | Aliment | Quantite_kg | Ration_g_j | Notes
```

### Feuille : Saisie_Incidents
```
Date | ID_Bete | Type | Gravite (1-3) | Description | Action | Cloture
```

### Feuille : Saisie_Pesees
```
Date | ID_Bete | Race | Poids_kg | PoidsPrecedent_kg | DatePrecedente
```

### Feuille : Sante_Mortalite
```
Semaine | Betes_lundi | Betes_mardi | ... | Betes_dimanche
```
(Lu en `A4:G50` pour calculer SPARK.betes et le nombre de bêtes actuel)

### Feuille : Prix_Marche
```
Date | Lieu | Prix_bas | Prix_moy | Prix_haut
```

### Feuille : Config_Passwords
```
role | pwd_encoded | updated_at | login_override
```
(Créée automatiquement au premier changement de mot de passe)

---

## 9. Fonctionnalités métier

### Calcul du Score Santé (0-100)
```js
var scoreBetes = mortalite === 0 ? 20 : mortalite <= 5 ? 12 : mortalite <= 10 ? 5 : 0;
var sante = Math.min(50, (MOCK.gmq / 1.2) * 50)   // GMQ : 50 pts max
          + (stock >= 6 ? 30 : stock >= 4 ? 15 : stock > 0 ? 5 : 0)  // Stock : 30 pts
          + scoreBetes;  // Bêtes : 20 pts
```

### Calcul des semaines du cycle
```js
var totalSemCycle = Math.round((CYCLE.dureeMois || 8) * 4.33);
```

### Projection vente
La projection utilise les semaines dynamiques du cycle et un GMQ cible de 1.2 kg/j :
```js
var semRestantes = Math.round((CYCLE.dureeMois || 8) * 4.33) - semActuelle;
var gainRestant  = 1.2 * 7 * semRestantes;
var poidsVente   = poidsActuel + gainRestant;
var recetteVente = poidsVente * prixMoyen * nbBetes;
```

### SPARK.betes (historique bêtes vivantes)
Lu depuis `Sante_Mortalite!A4:G50` — prend les 7 dernières lignes et fait la somme des colonnes B à G pour reconstituer le nombre de bêtes par semaine.

---

## 10. Bugs connus et corrections appliquées

| Bug | Cause | Correction |
|---|---|---|
| `ReferenceError: TABLE_RANGES` | Variable utilisée dans `appendRow()` avant déclaration | Ajout `var TABLE_RANGES = {};` avant la fonction |
| Page blanche après splash | Double virgule `,,` dans l'objet `S{}` | Suppression de la virgule en trop |
| "Config serveur manquante" au login | Objet `USERS` au niveau module → env vars non chargées (cold start Vercel) | Déplacement de `USERS` à l'intérieur de `handler()` |
| Projection sur 35 semaines toujours | Valeur hardcodée `35` au lieu de `CYCLE.dureeMois` | Remplacé par `Math.round((CYCLE.dureeMois\|\|8)*4.33)` |
| SPARK.betes statique | Tableau jamais mis à jour | Lecture de `Sante_Mortalite!A4:G50` au chargement |
| Score santé avec `+20` arbitraire | Formule incorrecte | 3 composantes : GMQ(50) + Stock(30) + Bêtes(20) |
| Swipe animation coupée | Timeout 120ms < durée animation 280ms | Timeout porté à 290ms |
| Emojis dans JS causant page blanche | Surrogates pairs en JS mobile | Emojis remplacés par texte/entités HTML |
