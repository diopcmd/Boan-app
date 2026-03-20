# Documentation Technique — BOANR
**Application de gestion d'élevage bovin — Ferme BOAN, Sénégal**
Version en production : https://boan-app-9u5e.vercel.app

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
  if (S.page === 'login') { el.innerHTML = pageLogin(); return; }
  var html = pageApp();
  if (MODAL.open) html += pageModal();
  // ... autres overlays
  el.innerHTML = html;
}
```

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
