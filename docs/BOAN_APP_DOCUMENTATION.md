# BOAN — Documentation Complète de l'Application
> Version 1.1 — Mise à jour le 20 Avril 2026 (commits `5bad4a0`, `0255434`, `d45fc68`)
> Commit HEAD : `d45fc68` · App en prod : `https://boan-app-ur3x.vercel.app`
> Codebase : `index.html` ~8 623 lignes · ES5 strict (`var`, pas `const`/`let`/arrow)

---

## Table des matières

0. [Vue d'ensemble](#0-vue-densemble)
1. [Architecture technique](#1-architecture-technique)
2. [Stack & infrastructure](#2-stack--infrastructure)
3. [Rôles & permissions](#3-rôles--permissions)
4. [Schémas de données Google Sheets](#4-schémas-de-données-google-sheets)
5. [Variables globales & état applicatif](#5-variables-globales--état-applicatif)
6. [Cycle de vie — démarrage & rendu](#6-cycle-de-vie--démarrage--rendu)
7. [Authentification & sécurité](#7-authentification--sécurité)
8. [API serverless (Vercel)](#8-api-serverless-vercel)
9. [Navigation & routage](#9-navigation--routage)
10. [Fonctionnalités par onglet](#10-fonctionnalités-par-onglet)
11. [Système offline & synchronisation](#11-système-offline--synchronisation)
12. [PWA & Service Worker](#12-pwa--service-worker)
13. [Fonctions utilitaires — index complet](#13-fonctions-utilitaires--index-complet)
14. [Patterns de code & conventions](#14-patterns-de-code--conventions)
15. [Variables d'environnement](#15-variables-denvironnement)
16. [Déploiement & opérations](#16-déploiement--opérations)
17. [Risques connus & dette technique](#17-risques-connus--dette-technique)
18. [Inventaire des fichiers](#18-inventaire-des-fichiers)

---

## 0. Vue d'ensemble

**BOAN** (BOvin ANalytics) est une application de gestion d'élevage bovin d'embouche au Sénégal (Thiès). Elle permet à 4 profils utilisateurs de saisir, suivre et analyser un cycle d'engraissement de A à Z : achat des bêtes → suivi quotidien → pesées → santé → vente au foirail.

**Contexte terrain** :
- Gérant à Thiès (réseau mobile 3G/4G intermittent, smartphone Android budget)
- Fondateur en France (pilotage à distance, décisions financières)
- RGA à Dakar (contrôle qualité données)
- Commerciale au foirail (relevé des prix de vente)

**Contraintes techniques** :
- Zéro dépendance npm côté client — tout est dans un seul fichier HTML
- ES5 strict obligatoire (`var` uniquement — pas `const`, `let`, `=>`)
- Offline-first : le gérant doit pouvoir saisir sans réseau
- Budget Vercel Hobby (timeout 10s par function serverless)
- Budget SendGrid Free (100 emails/jour)
- Emails plain text uniquement (Orange Sénégal filtre HTML)

---

## 1. Architecture technique

```
┌──────────────────────────────────────────┐
│              CLIENT (SPA)                │
│                                          │
│  index.html (~8 623 lignes)              │
│  ├─ CSS inline (<style>)                 │
│  ├─ HTML : <div id="splash"> + <div id="app">
│  └─ JS : <script> — tout le code ES5    │
│      ├─ Globals (CYCLE, MOCK, LIVE, S...)│
│      ├─ Auth (doLogin, getTok)           │
│      ├─ Data (loadLiveData, readSheet,   │
│      │        appendRow, writeAll)       │
│      ├─ Views (viewDash, viewSaisie,     │
│      │         viewLiv, viewMarche,      │
│      │         viewGuide + sidebar)      │
│      ├─ Forms (doSubmit, _submitActual)  │
│      ├─ Exports (PDF, WhatsApp)          │
│      └─ Utilities (dates, fmt, helpers)  │
│                                          │
│  manifest.json — PWA manifest            │
│  sw.js — Service Worker (cache + offline)│
│  guides/*.html — PDF guides par rôle     │
└──────────────┬───────────────────────────┘
               │ HTTPS
               ▼
┌──────────────────────────────────────────┐
│          VERCEL (Serverless)             │
│                                          │
│  /api/auth.js      — Login + session     │
│  /api/token.js     — Google OAuth2 token │
│  /api/sheets.js    — Proxy Sheets API    │
│  /api/ai.js        — Proxy Claude API    │
│  /api/change-password.js — Gestion MDP   │
│                                          │
│  vercel.json — SPA rewrite rules         │
└──────────────┬───────────────────────────┘
               │ REST API
               ▼
┌──────────────────────────────────────────┐
│         SERVICES EXTERNES                │
│                                          │
│  Google Sheets API v4 — base de données  │
│  Anthropic Claude — IA analyse cycle     │
│  Open-Meteo — météo Thiès               │
│  (Futur) SendGrid — emails notifications│
└──────────────────────────────────────────┘
```

**Modèle de rendu** : `r()` reconstruit l'intégralité du DOM à chaque changement d'état via `innerHTML` sur `<div id="app">`. Pas de Virtual DOM, pas de framework. Le focus et la position du curseur sont préservés manuellement avant/après le rendu.

**Base de données** : 4 Google Spreadsheets (un par rôle), synchronisés par des écritures multi-sheets (`writeAll()`). Pas de base de données serveur.

---

## 2. Stack & infrastructure

| Couche | Technologie | Détail |
|---|---|---|
| **Frontend** | HTML/CSS/JS vanilla | Fichier unique `index.html`, ES5 strict |
| **Fonts** | Google Fonts Inter | 400/500/600/700 |
| **PDF** | jsPDF 2.5.1 | CDN `cdnjs.cloudflare.com` |
| **Backend** | Vercel Serverless Functions | 5 endpoints Node.js (CommonJS) |
| **Hosting** | Vercel Hobby | Auto-deploy depuis GitHub main |
| **BDD** | Google Sheets API v4 | 4 spreadsheets, Service Account (RS256 JWT) |
| **Auth** | HMAC-SHA256 session tokens | 8h TTL, pas de cookies |
| **IA** | Anthropic Claude (claude-sonnet-4-20250514) | Via proxy `/api/ai` |
| **Météo** | Open-Meteo API | Thiès 14.79°N, -16.93°W |
| **PWA** | manifest.json + sw.js | Standalone, portrait, cache boanr-v2 |
| **Formatage Sheets** | Google Apps Script | `boan_sheets_format.gs` (exécution manuelle) |

**Limites critiques** :
- Vercel Hobby : **10 secondes** par function serverless
- Google Sheets API : **100 requêtes/100 secondes** par utilisateur
- Pas de WebSocket — polling `loadLiveData()` toutes les 5 min

---

## 3. Rôles & permissions

### 3.1 Table des rôles

| Rôle | Login par défaut | Localisation | Accès | SID |
|---|---|---|---|---|
| **fondateur** | `fondateur` | France | Tout | `SID.fondateur` |
| **gerant** | `gerant` | Thiès, Sénégal | Dashboard + Saisie + Guide | `SID.gerant` |
| **rga** | `rga` | Dakar | Dashboard + Livrables + Marché + Guide | `SID.rga` |
| **commerciale** | `fallou` | Foirail | Dashboard + Marché + Guide | `SID.fallou` |

### 3.2 Matrice des onglets

| Onglet | Fondateur | Gérant | RGA | Commerciale |
|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Saisie | ✅ | ✅ | ❌ | ❌ |
| Livrables | ✅ | ❌ | ✅ | ❌ |
| Marché | ✅ | ❌ | ✅ | ✅ |
| Guide | ✅ | ✅ | ✅ | ✅ |

### 3.3 Matrice des écritures Sheets

| Données | Gérant → | Fondateur → | RGA → | Commerciale → |
|---|---|---|---|---|
| Fiche_Quotidienne | ✅ | ✅ | — | — |
| SOP_Check | ✅ | ✅ | ✅ | — |
| Stock_Nourriture | ✅ | ✅ | — | — |
| Incidents | ✅ | ✅ | ✅ | — |
| Pesees | ✅ | ✅ | — | — |
| Sante_Mortalite | ✅ | ✅ | ✅ | — |
| Hebdomadaire | ✅ | ✅ | ✅ | — |
| Suivi_Marche | — | ✅ | — | ✅ |
| Suivi_Aliments | — | ✅ | ✅ | ✅ |
| KPI_Mensuels | — | ✅ (auto) | — | — |
| Config_Cycle | — | ✅ (sync all 4) | — | — |
| Config_App | — | ✅ | — | — |

### 3.4 Passwords

- Mots de passe initiaux : variables d'environnement Vercel (`PWD_FONDATEUR`, `PWD_GERANT`, `PWD_RGA`, `PWD_FALLOU`)
- Override possible via onglet `Config_Passwords` (base64) dans Sheet fondateur
- Identifiants login modifiables (`^[a-z0-9_]{3,}$`, min 6 chars pour le mot de passe)
- Le fondateur peut changer tous les mots de passe via le gestionnaire intégré

---

## 4. Schémas de données Google Sheets

### 4.1 `Config_Cycle` (A1:S1 — 1 seule ligne, 19 colonnes)

Synchronisé vers les 4 sheets par `_syncCycle()`.

| Col | Index | Clé | Type | Exemple |
|---|---|---|---|---|
| A | 0 | dateDebut | YYYY-MM-DD | `2026-03-15` |
| B | 1 | nbBetes | nombre | `50` |
| C | 2 | betes | JSON | `[{id:"C1-001",race:"Djakoré",raceCustom:"",poidsEntree:270,dateIntro:"2026-03-15"}]` |
| D | 3 | poidsDepart | nombre | `275` |
| E | 4 | race | texte | `Djakoré` |
| F | 5 | ration | texte | `son_tourteau` |
| G | 6 | capital | nombre | `15000000` |
| H | 7 | objectifPrix | nombre | `1600` |
| I | 8 | veterinaire | texte | `Dr Diop` |
| J | 9 | foirail | texte | `Diamaguène` |
| K | 10 | commission | nombre | `2` (%) |
| L | 11 | stockLines | JSON | `[{type:"Son de blé",qty:500,unit:"kg"}]` |
| M | 12 | prixAlim | nombre | `350` |
| N | 13 | budgetSante | nombre | `200000` |
| O | 14 | dureeMois | nombre | `4` |
| P | 15 | peseeFreq | nombre | `14` (jours) |
| Q | 16 | contactUrgence | texte | `+221 77 xxx` |
| R | 17 | numCycle | nombre | `1` |
| S | 18 | simCharges | JSON | `{achat,alim,gardien,vet,securite,eau,mdoeuvre,assurance,imprevus,transport,veaux}` |

### 4.2 `Config_App` (A:B — clé/valeur, fondateur uniquement)

| Clé | Type | Description |
|---|---|---|
| `gmqCible` | nombre | Objectif GMQ kg/j |
| `gmqWarn` | nombre | Seuil alerte GMQ kg/j |
| `poidsCible` | nombre | Poids cible vente kg |
| `poidsVenteMin` | nombre | Poids minimum vente kg |
| `tauxMortMax` | nombre | Taux mortalité max % |
| `coutRevientMax` | nombre | Coût revient max FCFA/kg |
| `margeParBeteMin` | nombre | Marge min par bête FCFA |
| `alerteSeuilTreso` | nombre | Seuil alerte trésorerie FCFA |
| `mixSon` | nombre | % son dans ration |
| `mixTourteau` | nombre | % tourteau dans ration |
| `sopProtocol` | JSON | Protocole SOP véto `[{j,ico,label,type,note}]` |
| `_sopResetAt` | nombre | Timestamp dernier reset SOP |
| `numCnaas` | texte | N° police CNAAS |
| `_lastFicheDate` | DD/MM/YYYY | Dernière fiche quotidienne |
| `_lastSopDate` | DD/MM/YYYY | Dernier SOP check |
| `_lastStockDate` | DD/MM/YYYY | Dernier stock |
| `_lastPeseeDate` | DD/MM/YYYY | Dernière pesée |
| `_lastIncDate` | DD/MM/YYYY | Dernier incident |
| `_lastSanteDate` | DD/MM/YYYY | Dernière entrée santé |
| `_lastBilanSem` | nombre | Dernière semaine bilan |
| `ficheFaiteAujourdhui` | DD/MM/YYYY | Marqueur anti-doublon fiche |
| `alimentTypes` | JSON | Types d'aliments personnalisés |
| `_mktUpdated` | texte | Dernière mise à jour prix foirail |
| `gonogo` | JSON | État des 8 points Go/No-Go |

### 4.3 `Config_Passwords` (A:D — auto-créé)

| Col | Nom | Contenu |
|---|---|---|
| A | role | `fondateur` / `gerant` / `rga` / `commerciale` |
| B | password_b64 | Mot de passe encodé base64 |
| C | updated_at | ISO timestamp |
| D | login_override | Identifiant personnalisé (optionnel) |

### 4.4 Onglets de données (13 onglets)

| Onglet | Colonnes | Plage type | Contenu |
|---|---|---|---|
| `Fiche_Quotidienne` | A:G | Date, NbBetes, Nourris, Eau, Enclos, Incident, Description | Fiche journalière gérant |
| `SOP_Check` | A:H | Date, Nettoyage, Désinfection, Ration, Eau, Stock, Santé, Problème | Checklist SOP |
| `Stock_Nourriture` | A:F | Date, Type, Mode, Kg, CycleDebut, (réservé) | Mouvements stock aliments |
| `Incidents` | A:G | Date, **ID_Bête (optionnel)**, Type, Gravité, Description, Action, Clôturé | Incidents terrain ou infrastructure |
| `Pesees` | A:G | Date, ID, Race, RaceCustom, Poids, PoidsPrécédent, DatePrécédente | Pesées individuelles |
| `Sante_Mortalite` | A:J | Date, ID, Symptômes, Traitement, Coût, Résultat, Décès, BCS, Muqueuse, SopLabel | Suivi santé |
| `Hebdomadaire` | A:H | Semaine, NbBêtes, Nourris, Stock, Incidents, PoidsVérifiés, Message, (réservé) | Bilan hebdo |
| `Suivi_Marche` | A:E | Date, Foirail, Bas, Moy, Haut | Prix foirail (FCFA/kg) |
| `Suivi_Aliments` | A:C | Date, Type, Prix | Prix aliments (FCFA/kg) |
| `KPI_Mensuels` | A:K | Date, NbBêtes, GMQ, Stock, Tréso, ... | KPI calculés mensuels |
| `KPI_Hebdo` | A:J | Semaine, ... | KPI calculés hebdo |
| `Historique_Cycles` | A:O | DateDebut, DateFin, NbBêtes, PoidsDepart, PoidsFin, ... | Archive cycles |
| `SOP_Protocol` | A:E | J, Ico, Label, Type, Note | Protocole SOP véto |

### 4.5 Stratégie d'écriture — `appendRow()` intelligent

L'app n'utilise PAS `sheets:append` (Google API) directement car cela briserait le formatage du Google Apps Script.

Pattern `appendRow()` :
1. GET col A de la table range (`TABLE_RANGES[sheet].start` à `.end`)
2. Trouver la première ligne vide (col A vide)
3. PUT les valeurs exactement sur cette ligne

Plages définies dans `TABLE_RANGES` :

| Sheet | Start | End |
|---|---|---|
| Fiche_Quotidienne | A4 | A200 |
| SOP_Check | A4 | A200 |
| Stock_Nourriture | A4 | A500 |
| Incidents | A4 | A200 |
| Pesees | A4 | A500 |
| Sante_Mortalite | A4 | A200 |
| Hebdomadaire | A4 | A100 |
| Suivi_Marche | A4 | A500 |
| Suivi_Aliments | A4 | A500 |
| KPI_Mensuels | A4 | A100 |
| KPI_Hebdo | A4 | A200 |
| Historique_Cycles | A2 | A50 |
| SOP_Protocol | A2 | A50 |

---

## 5. Variables globales & état applicatif

### 5.1 Variables d'état principal

| Variable | Type | Déclarée | Description |
|---|---|---|---|
| `S` | Object | L1053 | État global de l'application — page, user, tab, sub, formulaires, modales, AI |
| `CYCLE` | Object | L549 | Configuration du cycle actif — 40+ propriétés (bêtes, dates, objectifs, SOP) |
| `MOCK` | Object | L503 | KPI calculés — `{betes, gmq, stock, treso, sem, mois, incidents, kpiDate, tresoSource}` |
| `LIVE` | Object | L2327 | Données fraîches Sheets — `{pesees, beteIds, deceased, alimPrix, prix, incidents, loaded, source}` |
| `SID` | Object | L502 | Spreadsheet IDs par rôle — peuplé après auth |
| `HISTORY` | Array | L622 | 20-100 dernières activités (type, label, icon, date, time, meta) |
| `STOCK_MVTS` | Array | L625 | Mouvements stock locaux — `[{date, type, mode, kg, cycleDebut}]` |
| `SPARK` | Object | L2319 | Données sparkline — `{gmq:[7], stk:[7], treso:[7], betes:[7]}` |
| `METEO` | Object | L1008 | Météo Thiès — `{temp, rain, wind, code, loaded, error, week:[7]}` |
| `MODAL` | Object | L998 | État modal init cycle — `{open, step, data}` (4 étapes) |
| `CONFIRM` | Object | L1000 | Dialogue de confirmation — `{open, msg, cb}` |
| `SB` | Object | L1005 | Sidebar — `{open, tab, closing, _freqDone}` |
| `USERS` | Object | L494 | Mapping rôle → onglets autorisés |
| `ONLINE` | Boolean | L978 | État connexion réseau |
| `OFFLINE_QUEUE` | Array | L979 | File d'attente écritures offline (max 30) |
| `LIGHT_MODE` | Boolean | (init) | Mode clair/sombre |

### 5.2 Variables de cache / timestamps

| Variable | Type | Description |
|---|---|---|
| `_lastSyncTS` | Number | Timestamp dernier sync Sheets réussi |
| `_lastFondVisitTS` | Number | Dernière visite fondateur |
| `_lastAutoRefresh` | Number | Dernier auto-refresh (interval 5min) |
| `_lastPrixLoad` | Number | Dernier chargement prix (cache 5min) |
| `_lastAlimLoad` | Number | Dernier chargement prix aliments (cache 5min) |
| `_configAppTabOk` | Boolean | Flag one-shot pour création tab Config_App |
| `LAST_ACTIVITY` | Number | Timestamp dernière interaction utilisateur (auto-logout 8h) |

### 5.3 Constantes

| Variable | Description |
|---|---|
| `LOGO_SVG` | SVG inline du logo "B" vert |
| `SOP_PROTOCOL_DEFAULT` | Protocole SOP par défaut — 11 actes `[{j, ico, label, type, note}]` |
| `RACES_STD` | Races bovines standard Sénégal |
| `AI_QUESTIONS` | Questions prédéfinies pour l'assistant IA |
| `PWD_ROLES` | Labels rôles pour le gestionnaire de mots de passe |
| `TABLE_RANGES` | Plages de lignes par onglet (start/end pour appendRow) |

### 5.4 État des formulaires (sous-objets de `S`)

| Objet | Formulaire | Champs clés |
|---|---|---|
| `S.fi` | Fiche quotidienne | date, nb, nourris, eau, enclos, incident, desc |
| `S.fs` | SOP check | date, net, des, rat, eau, stk, san, prob |
| `S.fst` | Stock | date, mvts[], stockInput, stockKg, rat, _stkAutre |
| `S.fin` | Incident | date, id, type, grav, desc, act, clos |
| `S.fp` | Pesée | date, id, race, raceCustom, poids, prev, datePrev, _autoFilled |
| `S.fsa` | Santé | date, id, sym, tra, cout, res, dec, bcs, muq |
| `S.fb` | Bilan hebdo | sem, nb, nou, stk, inc, poi, msg |
| `S.fm` | Marché (prix) | date, foi, foiCustom, bas, moy, haut |
| `S.falim` | Prix aliments | date, type, prix |
| `S.sn/sp/...` | Simulateur | ~15 champs numériques |

---

## 6. Cycle de vie — démarrage & rendu

### 6.1 Flux de démarrage

```
1. HTML parse → <style> appliqué → #splash affiché
2. <script> exécuté → toutes les variables globales initialisées
   → CYCLE lu depuis localStorage (cache)
   → HISTORY lu depuis localStorage
   → STOCK_MVTS reconstruit depuis localStorage
3. r() appelé → page login rendue
4. Utilisateur saisit login/password → doLogin()
5. doLogin() → POST /api/auth → session token + SIDs
6. loadLiveData() déclenché → 3 étapes progressives :
   Step 1 (bloquant) : Config_Cycle + Config_App
   Step 2 — Vague 1 (parallèle) : Pesees + Stock + KPI + Santé
   Step 3 — Vague 2 (parallèle) : Fiches + Incidents + Bilans + SOP + reste
7. buildHistoryFromSheets() → réconciliation HISTORY local ↔ Sheets
8. fetchMeteo() → météo actuelle + prévisions 7 jours
9. r() → dashboard affiché avec données fraîches
```

### 6.2 Fonction `r()` — le cœur du rendu

```js
function r() {
  // 1. Sauvegarde le focus actuel + position du curseur
  var focusId = document.activeElement && document.activeElement.id;
  var cursorPos = focusId ? document.activeElement.selectionStart : null;

  // 2. Reconstruit tout le HTML
  var html;
  if (S.page === 'login') html = pageLogin();
  else html = pageApp(); // inclut sidebar, modals, confirm, AI, guide...

  // 3. Écrit dans le DOM
  document.getElementById('app').innerHTML = html;

  // 4. Restaure le focus + curseur
  if (focusId) { ... }

  // 5. Anime les compteurs KPI
  animateCounters();

  // 6. Initialise le swipe
  initSwipe();
}
```

> **Impact** : TOUTE mutation de `S`, `CYCLE`, `MOCK`, `LIVE`, `HISTORY`, `SB`, `MODAL`, `CONFIRM`
> suivie d'un appel `r()` provoque un re-rendu complet. C'est le modèle "React sans React".

### 6.3 Auto-refresh & auto-logout

```
setInterval(60s) :
  Si dernière activité > 8h → déconnexion automatique
  Si dernière activité < 30min ET dernier refresh > 5min → loadLiveData()
```

---

## 7. Authentification & sécurité

### 7.1 Flux d'authentification

```
Client                          Serveur (/api/auth)
  │                                  │
  │  POST {login, password}          │
  │ ────────────────────────────────>│
  │                                  │ 1. Trouve le rôle par login
  │                                  │ 2. Lit Config_Passwords (overrides base64)
  │                                  │ 3. timingSafeEqual(password)
  │                                  │ 4. Génère token = base64(JSON).HMAC-SHA256
  │  {sessionToken, user, sid}       │
  │ <────────────────────────────────│
  │                                  │
  │  POST /api/token                 │
  │  Header: X-Session-Token         │
  │ ────────────────────────────────>│
  │                                  │ 1. Vérifie session token (HMAC)
  │                                  │ 2. Construit JWT RS256 (SA credentials)
  │                                  │ 3. POST oauth2.googleapis.com/token
  │  {access_token}                  │
  │ <────────────────────────────────│
  │                                  │
  │  Direct Google Sheets API calls  │
  │  Authorization: Bearer [token]   │
  │ ──────────────────────────────> Google
```

### 7.2 Session Token

- Format : `base64(JSON_payload).HMAC_SHA256_hex`
- Payload : `{user, exp}` (expiration = login + 8h)
- Signé avec `SESSION_SECRET` (variable d'environnement)
- Vérifié côté serveur dans chaque endpoint (`verifySession()`)
- **Pas de cookie** — stocké en mémoire JS (`S.sessionToken`)

### 7.3 Google API Token

- Type : OAuth2 access token (1h TTL)
- Obtenu par échange JWT RS256 du Service Account (`SA_PRIVATE_KEY`, `SA_CLIENT_EMAIL`)
- Scope : `https://www.googleapis.com/auth/spreadsheets`
- Caché côté serveur en mémoire dans `sheets.js` et `auth.js`
- Le client le demande via `/api/token` et le cache dans `S.tok` + `S.tokexp`

### 7.4 Points de sécurité

| Point | Statut | Détail |
|---|---|---|
| Comparaison timing-safe des MDP | ✅ | `crypto.timingSafeEqual` dans auth.js |
| CORS auth | ✅ | Restreint à `*.vercel.app` + localhost |
| CORS autres endpoints | ⚠️ | `Access-Control-Allow-Origin: *` |
| Stockage MDP override | ⚠️ | Base64 dans Sheets (pas de hashing) |
| Session token | ✅ | HMAC-SHA256, 8h TTL, vérifié serveur |
| Fallback SESSION_SECRET | ⛔ | `'boanr_dev_secret'` codé en dur si env var absente |
| Rate limiting auth | ❌ | Aucun — brute-force théoriquement possible |
| Rôle check /api/ai | ⚠️ | Aucun — tout utilisateur authentifié peut appeler Claude |
| Rôle check change-password | ✅ | Double auth fondateur (session + re-saisie MDP) |
| XSS | ✅ | `_escHtml()` sur les champs affichés, `safeText` côté serveur (futur) |
| Données Sheets | ⚠️ | Les SIDs donnent accès total au spreadsheet via SA token |

---

## 8. API serverless (Vercel)

### 8.1 `/api/auth.js` (126 lignes)

| Méthode | Corps | Retour |
|---|---|---|
| POST | `{login, password}` | `{sessionToken, user, sid: {fondateur?, gerant?, rga?, fallou?}}` |

- Matching login → rôle (fondateur, gerant, rga, fallou)
- Lecture `Config_Passwords` pour overrides (login + MDP base64)
- Chaque rôle reçoit uniquement les SIDs nécessaires :
  - fondateur : les 4
  - gerant : gerant + fondateur
  - rga : rga + fondateur
  - commerciale : fallou + fondateur

### 8.2 `/api/token.js` (62 lignes)

| Méthode | Header | Retour |
|---|---|---|
| POST | `X-Session-Token` | `{access_token, expires_in}` |

- Vérifie la session
- Construit un JWT RS256 (iss, scope, aud, exp, iat) avec les credentials SA
- Échange contre un access_token OAuth2

### 8.3 `/api/sheets.js` (93 lignes)

| Méthode | Corps | Retour |
|---|---|---|
| POST | `{action, sid, range, values?}` | `{values?}` ou `{updates?}` |

Actions :
- `read` : GET values (UNFORMATTED_VALUE)
- `append` : POST `:append` INSERT_ROWS
- `write` : PUT values (USER_ENTERED)

> Note : le client n'utilise PAS ce proxy pour la plupart des opérations.
> Il fait des appels directs Google Sheets API avec le token obtenu via `/api/token`.
> Le proxy `/api/sheets` est principalement utilisé dans `loadLiveData()` Step 1 pour la Config.

### 8.4 `/api/ai.js` (42 lignes)

| Méthode | Header | Corps | Retour |
|---|---|---|---|
| POST | `X-Session-Token` | `{model?, max_tokens?, system, messages}` | Claude response |

- Proxy vers `api.anthropic.com/v1/messages`
- Modèle par défaut : `claude-sonnet-4-20250514`
- max_tokens par défaut : 2048
- API key jamais exposée au client

### 8.5 `/api/change-password.js` (117 lignes)

| Méthode | Header | Corps | Retour |
|---|---|---|---|
| POST | `X-Session-Token` | `{role, founderPassword, newPassword, newLogin?}` | `{ok:true}` |

- Double vérification : session token + mot de passe fondateur
- Auto-crée `Config_Passwords` si absent
- Écrit/met à jour la ligne du rôle concerné
- Validation : login `^[a-z0-9_]{3,}$`, password ≥ 6 chars

---

## 9. Navigation & routage

### 9.1 Pages

| Page | Rendu par | Condition |
|---|---|---|
| Login | `pageLogin()` | `S.page === 'login'` |
| App | `pageApp()` | `S.page !== 'login'` |

### 9.2 Onglets principaux

Gérés par `S.tab`, changement via `chTab(t)`.

| Tab | Label | Rendu par |
|---|---|---|
| `dashboard` | Dashboard | `viewDash()` |
| `saisie` | Saisie | `viewSaisie()` |
| `livrables` | Livrables | `viewLiv()` |
| `marche` | Marché | `viewMarche()` |
| `guide` | Guide | `viewGuide()` |

### 9.3 Sous-onglets

Gérés par `S.sub`, changement via `chSub(s)`.

| Onglet | Sous-onglets | Détail |
|---|---|---|
| Saisie | `fiche`, `sop`, `stock`, `inc`, `pesee`, `sante`, `bilan`, `protocole` | Formulaires de saisie terrain |
| Livrables | `treso`, `kpi`, `betes`, `incidents`, `objectifs`*, `sopvet`*, `cycles`*, `gonogo` | Tableaux de bord analytiques |
| Marché | `prix`, `alim`*, `sim`, `reco`, `comm`* | Prix, simulateur, recommandations |

\* = restreint à certains rôles

### 9.4 Navigation par geste

`initSwipe()` détecte les swipes horizontaux (seuil 50px) pour changer d'onglet avec animation `slideLeft`/`slideRight`.

### 9.5 Modales & overlays

| Overlay | Variable | Déclencheur |
|---|---|---|
| Init cycle wizard | `MODAL.open` | Pas de cycle existant ou reset |
| Confirmation dialog | `CONFIRM.open` | `showConfirm(msg, cb)` |
| AI assistant | `S._aiOpen` | Bouton dashboard fondateur |
| Guide gérant | `S._guideOpen` | Bouton guide gérant |
| Password manager | `S._pwdMgrOpen` | Sidebar fondateur |
| Reset cycle | `S._resetPwdOpen` | Sidebar fondateur |
| Sidebar | `SB.open` | Bouton ☰ hamburger |

---

## 10. Fonctionnalités par onglet

### 10.1 Dashboard (`viewDash()`)

**Tous rôles** :
- En-tête cycle : nom, semaine, durée, date début
- Grille KPI 4 cartes : Bêtes vivantes, GMQ réel, Stock semaines, Tréso/Santé
- Barre de progression cycle
- Bloc alertes contextuelles (mortalité, GMQ chute, stock critique, tréso basse, incidents ouverts, prix seuil)
- Synthèse stock aliment
- Fil d'activité récente (10 dernières entrées)

**Fondateur/RGA** :
- Bloc rentabilité : CA projeté, charges, bénéfice, marge/bête, ROI
- Saisies du gérant : dernière fiche, dernier SOP, dernier stock (fraîcheur badge)
- Bouton export PDF KPI + partage WhatsApp
- Bouton analyse IA

**Gérant** :
- Tâches actives : fiches/SOP/stock manquants avec boutons d'action directs

### 10.2 Saisie (`viewSaisie()`)

8 formulaires de saisie terrain :

| Formulaire | Rôle principal | Anti-doublon | Champs clés |
|---|---|---|---|
| **Fiche quotidienne** | Gérant | 1x/jour | Date, nb bêtes, nourris/eau/enclos/incident (OUI/NON) |
| **SOP Check** | Gérant | 1x/14j | 6 points sanitaires OUI/NON + score conformité |
| **Stock** | Gérant | Multi/jour (type unique) | Select natif aliments (6 défauts + personnalisés) + quantité + ration/j |
| **Incident** | Gérant | 1x/bête/type | **Bête optionnelle** + type + gravité (1-3) + description + action |
| **Pesée** | Gérant | 1x/bête/semaine | Bête + race + poids actuel + auto-fill précédent → calcul gain/GMQ |
| **Santé** | Gérant | 1x/bête/symptôme | Bête + symptômes + traitement + coût + résultat + décès? + BCS + muqueuse |
| **Bilan hebdo** | Gérant | 1x/semaine | Résumé semaine + message libre + partage WhatsApp |
| **Protocole SOP** | Fondateur/RGA | — | Calendrier actes vétérinaires, validation inline, CRUD actes |

### 10.3 Livrables (`viewLiv()`)

8 sous-onglets d'analyse :

| Sous-onglet | Contenu |
|---|---|
| **Trésorerie** | Solde actuel + flux détaillé (capital → dépenses → solde) + source KPI/sim/capital |
| **KPI** | Barres Actuel vs Objectif (GMQ, stock, bêtes, poids) + CA projeté + coût/kg + marge/bête |
| **Bêtes** | Courbe de croissance SVG par animal + poids/projection + seuil rentabilité + IC + date vente projetée |
| **Incidents** | Liste incidents ouverts/clôturés + interface de clôture + synthèse statistique |
| **Go/No-Go** | 8 critères (3 auto + 5 manuels) : véto, CNAAS, incidents, cash, bêtes, contrats, infra, sécurité |
| **Objectifs** | Éditeur d'objectifs zootechniques + financiers + marché (persistés Config_App) |
| **SOP Véto** | Éditeur de protocole vétérinaire + calendrier fusionné + historique validations |
| **Cycles** | Tableau historique des cycles passés (depuis Historique_Cycles) |

### 10.4 Marché (`viewMarche()`)

5 sous-onglets prix & simulation :

| Sous-onglet | Contenu |
|---|---|
| **Prix** | Carte prix héros + courbe SVG + historique groupé par date + alertes saisonnières + formulaire saisie |
| **Aliments** | Derniers prix par type + historique 5 dernières entrées + rapport mensuel + formulaire |
| **Simulateur** | P&L complet : 10+ paramètres (bêtes, poids, prix, charges détaillées) → CA, charges, bénéfice, marge, ROI |
| **Recommandations** | Signal vente individuel par bête (vendre/attendre) + signal global marché + saisonnalité |
| **Commission** | Résumé commercial (nb bêtes, poids, GMQ, seuil, signal) — lecture seule |

### 10.5 Guide (`viewGuide()`)

Guide opérationnel adapté au rôle :

| Rôle | Sections |
|---|---|
| **Gérant** | Tâches quotidiennes + vendredi bilan + stock livraison + pesée + règles absolues + guide interactif modal |
| **Fondateur** | Checklist démarrage + pilotage hebdo + décision vente + revue paramètres |
| **RGA** | Contrôle hebdo qualité + contrôle mensuel + préparation recommandation vente + lexique (GMQ, coût, marge, mortalité) |
| **Commerciale** | Cadence relevés + comment saisir + signaux déclenchement vente |

**PDF** : 4 fichiers HTML dans `/guides/` (fondateur.html, gerant.html, rga.html, commerciale.html)

### 10.6 Sidebar (`buildSidebar()`)

Panneau latéral droit (300px) avec 4 sous-onglets temporels :

| Sous-onglet | Gérant | Fondateur | RGA | Commerciale |
|---|---|---|---|---|
| **Aujourd'hui** | Météo + calendrier saisies + stock | KPI + saisies gérant + raccourcis | Données reçues | Dernier prix + commission |
| **Semaine** | Calendar dots + GMQ + fiches | Bilan + incidents + GMQ | GMQ + mortalité | Prix + commission |
| **Mois** | GMQ trend + SOP conformité | Dépenses + projections | SOP conformité + pesée | Commission historique |
| **Cycle** | Score santé + historique | Avancement + ROI + boutons admin | Avancement global | — |

**Pied** : Dot online/offline + toggle light/dark + bouton Actualiser + Déconnexion

---

## 11. Système offline & synchronisation

### 11.1 Détection réseau

```js
var ONLINE = navigator.onLine;
window.addEventListener('online', function() { ONLINE = true; r(); flushQueue(); });
window.addEventListener('offline', function() { ONLINE = false; r(); });
```

### 11.2 File d'attente offline

```js
var OFFLINE_QUEUE = lsGet('offline_queue') || [];

function saveToQueue(range, vals) {
  OFFLINE_QUEUE.push({ range: range, vals: vals, ts: Date.now() });
  if (OFFLINE_QUEUE.length > 30) OFFLINE_QUEUE.shift(); // max 30
  lsSet('offline_queue', OFFLINE_QUEUE);
}
```

### 11.3 Flush au retour connexion

```js
function flushQueue() {
  if (!OFFLINE_QUEUE.length) return;
  // Écrit sur SID.gerant uniquement (limitation connue)
  // Ne flush PAS vers fondateur/rga (pas de multi-SID offline)
  var item = OFFLINE_QUEUE.shift();
  appendRow(SID.gerant, item.range, item.vals).then(function() {
    lsSet('offline_queue', OFFLINE_QUEUE);
    if (OFFLINE_QUEUE.length) flushQueue(); // récursif
  });
}
```

> ⚠️ **Limitation connue** : `flushQueue()` écrit uniquement vers `SID.gerant`.
> Les données ne sont PAS propagées vers fondateur/rga en offline.
> Le fondateur verra les données au prochain `loadLiveData()` qui lit depuis `SID.gerant`.

### 11.4 Cache localStorage

| Clé (préfixe `boanr_`) | Contenu | TTL |
|---|---|---|
| `cycle` | Objet CYCLE complet | Jusqu'au prochain loadLiveData |
| `history` | Tableau HISTORY | Idem |
| `stock_mvts` | STOCK_MVTS | Idem |
| `offline_queue` | OFFLINE_QUEUE | Jusqu'au flush |
| `last_fond_visit_ts` | Timestamp | Permanent |
| `light` | Boolean mode clair | Permanent |
| `sinistres_ouverts` | (Futur) Sinistres en cours | Variable |
| `deces_pending` | (Futur) Décès offline | Jusqu'au flush |
| `cfg_*` | (Futur) Cache Config_App | Jusqu'au prochain sync |

---

## 12. PWA & Service Worker

### 12.1 Manifest (`manifest.json`)

```json
{
  "name": "BOANR – Gestion élevage bovin",
  "short_name": "BOANR",
  "display": "standalone",
  "orientation": "portrait-primary",
  "start_url": "/",
  "theme_color": "#1e4a1e",
  "background_color": "#0f1a0f",
  "icons": [{ "src": "data:image/svg+xml,...", "sizes": "512x512", "purpose": "any maskable" }]
}
```

### 12.2 Service Worker (`sw.js` — 51 lignes)

**Install** :
- Cache `/` et `/manifest.json` (cache `boanr-v2`)
- `skipWaiting()` — activation immédiate

**Activate** :
- Supprime les anciens caches
- `clients.claim()` — prise de contrôle immédiate

**Fetch** :
- `/api/*` ou cross-origin → **network-only** (jamais caché)
- Tout le reste → **network-first** avec fallback cache
- Si offline et pas de cache → page HTML inline "Hors ligne — Reconnectez-vous pour utiliser BOANR"

### 12.3 Capacités PWA

| Fonctionnalité | Support |
|---|---|
| Installation (A2HS) | ✅ Android + iOS |
| Mode standalone | ✅ |
| Offline basic | ✅ (page en cache + localStorage) |
| Offline saisie | ✅ (OFFLINE_QUEUE → flush au retour) |
| Push notifications | ❌ Non implémenté |
| Background sync | ❌ Non implémenté |
| Vibration (haptic) | ✅ `navigator.vibrate()` |

---

## 13. Fonctions utilitaires — index complet

### 13.1 Dates & temps

| Fonction | Ligne | Description |
|---|---|---|
| `_nowDakar()` | 509 | Retourne `{year,month,day,hour,minute,weekday}` en timezone Africa/Dakar |
| `today()` | 530 | `DD/MM/YYYY` Dakar |
| `todayISO()` | 534 | `YYYY-MM-DD` Dakar |
| `nowHeure()` | 538 | Heure actuelle Dakar |
| `nowJour()` | 539 | Jour semaine Dakar |
| `isoToFr(iso)` | 540 | `YYYY-MM-DD` → `DD/MM/YYYY` |
| `parseISO(iso)` | 542 | ISO → Date sans décalage UTC |
| `calcSemaine()` | 508 | Semaine courante depuis début cycle (lundi-ancré) |
| `semaineISO(date)` | 807 | Numéro de semaine ISO à partir d'un Date |
| `semaineDeDate(ddmmyyyy)` | 814 | DD/MM/YYYY → semaine ISO |
| `joursSince(type)` | 828 | Jours depuis dernière entrée de type donné |
| `_joursDepuisDebut()` | 5118 | Jours réels depuis début cycle |

### 13.2 Stockage local

| Fonction | Ligne | Description |
|---|---|---|
| `lsGet(k)` | 545 | Lit `boanr_[k]` depuis localStorage (JSON parse) |
| `lsSet(k,v)` | 546 | Écrit `boanr_[k]` dans localStorage (JSON stringify, gère QuotaExceeded) |

### 13.3 Formatage & affichage

| Fonction | Ligne | Description |
|---|---|---|
| `fmt(n)` | 1074 | Formatage nombre FR (séparateur milliers) |
| `gc(t,v)` | 1075 | Couleur KPI selon seuils (vert/orange/rouge) |
| `sparkline(data,color,w,h)` | 2305 | SVG sparkline inline |
| `formProgress(filled,total)` | 2296 | Barre de progression formulaire |
| `countFilled(fields)` | 2300 | Compte champs remplis |
| `_escHtml(s)` | 643 | Échappe `& < > "` pour innerHTML |
| `fl(label,input,val)` | 2574 | Wrapper floating-label input (`inputHtml` + `<label>` dans `.fl`) |
| `yn(val,k,obj)` | 2559 | Boutons radio OUI/NON |
| `calBadge(done,msg,resetFn)` | 886 | Badge calendrier fait/à faire |
| `msgHtml()` | 2577 | Message de statut envoi (loading/ok/error) |
| `meteoIcon(code)` | 1042 | Code WMO → emoji météo |
| `_gmqLabel()` | 507 | Label GMQ adaptatif selon données |

### 13.4 Données Google Sheets

| Fonction | Ligne | Description |
|---|---|---|
| `getTok()` | 1175 | Obtient un Google API token (cache 1h) |
| `readSheet(sid,range)` | 1274 | Lit une plage Google Sheets |
| `appendRow(sid,range,vals)` | 1213 | Écrit dans la prochaine ligne vide (smart append) |
| `writeAll(sids,range,vals)` | ~1986 | Écrit vers plusieurs sheets en parallèle |
| `loadLiveData()` | 1290 | Chargement progressif en 3 étapes depuis Sheets |
| `loadPesees()` | 2365 | Charge pesées + calcule GMQ |
| `loadPrix(force)` | 2418 | Charge prix foirail (cache 5min) |
| `loadAlimPrix(force)` | 2455 | Charge prix aliments (cache 5min) |
| `_syncConfigApp()` | 2189 | Écrit Config_App vers sheet fondateur |
| `_syncCycle()` | 2247 | Écrit Config_Cycle vers les 4 sheets |
| `_syncSopProtocol()` | ~6510 | Réécrit SOP_Protocol (clear + PUT) |
| `buildHistoryFromSheets(...)` | ~1630 | Reconstruit HISTORY depuis 7 sources Sheets |

### 13.5 Soumission formulaires

| Fonction | Ligne | Description |
|---|---|---|
| `doSubmit(type)` | ~1800 | Validation + anti-doublon + confirmation → `_submitActual()` |
| `_submitActual(type)` | ~1920 | Écriture effective vers Sheets |
| `kpiAppend(vals)` | ~2013 | Append KPI_Mensuels |
| `kpiHebdoAppend(vals)` | ~2018 | Append KPI_Hebdo |
| `closeIncident(i)` | 4073 | Ouvre le formulaire de clôture incident |
| `submitCloseInc()` | 4081 | Clôture un incident dans Sheets |
| `saveObjectifs()` | ~6530 | Sauvegarde objectifs vers Config_App |

### 13.6 Anti-doublons

| Fonction | Ligne | Description |
|---|---|---|
| `ficheDejaSoumise()` | 874 | Vérifie si fiche déjà soumise aujourd'hui |
| `marquerFicheAujourdhui()` | 882 | Marque fiche comme faite |
| `sopDejaFait()` | 940 | SOP soumis dans les 14 derniers jours |
| `bilanDejaFaitCetteSemaine()` | 946 | Bilan soumis cette semaine |
| `peseeDejaFaite(id)` | 821 | Bête déjà pesée cette semaine |
| `faitAujourdhui(type)` | 848 | Type soumis aujourd'hui |
| `stockDejaFaitAujourdhui(type,mode)` | 853 | Stock même type+mode aujourd'hui |
| `incidentDejaEnregistre(id,type)` | 860 | Incident même bête+type |
| `santeDejaEnregistree(id,sym)` | 867 | Santé même bête+symptôme |

### 13.7 Stock & calculs

| Fonction | Ligne | Description |
|---|---|---|
| `calcStockLocal()` | 720 | Calcule semaines de stock depuis STOCK_MVTS |
| `calcStockParAliment()` | 741 | Net kg par type d'aliment |
| `stockSyntheseHtml(compact)` | 749 | Tableau HTML synthèse stock |
| `rebuildAlimList()` | 703 | Reconstruit la liste interne des aliments connus (défauts + CYCLE + STOCK_MVTS) |
| `addStockLigne(mode)` | 2936 | Ajoute une ligne de mouvement stock (lit `S.fst.stockInput` + `stk-kg-inp`) |
| `saveMvts()` | 634 | Persiste STOCK_MVTS en localStorage |

### 13.8 Bêtes

| Fonction | Ligne | Description |
|---|---|---|
| `rebuildBeteList()` | 635 | Peuple le datalist global des bêtes |
| `beteSelect(val,stateKey,extra)` | 2858 | Input autocomplete sélection bête |
| `beteDropdown(val,stateKey,extra,exclude)` | 2908 | Select dropdown sélection bête |
| `beteInputHandler(inp)` | 669 | Handler input bête (filtre dropdown) |
| `beteFocusHandler(inp)` | 681 | Handler focus bête (montre dropdown) |
| `beteBlurHandler(inp)` | 685 | Handler blur bête (cache dropdown) |
| `selectBeteId(el)` | 691 | Sélectionne un ID bête depuis dropdown |
| `_applyGmqToPesees(raw)` | 2332 | Calcule GMQ réel par animal |

### 13.9 Exports & partage

| Fonction | Ligne | Description |
|---|---|---|
| `exportKpiPDF()` | 3505 | PDF A4 dashboard KPI |
| `exportPDF()` | 4121 | PDF A4 rapport mensuel complet |
| `exportSynthesePDF()` | 3720 | PDF A4 synthèse stock |
| `partagerRapportJourWhatsApp()` | 3635 | Rapport jour via wa.me |
| `partagerKpiWhatsApp()` | 3677 | KPI via wa.me |
| `partagerSyntheseWhatsApp()` | 3802 | Synthèse stock via wa.me |
| `partagerAIWhatsApp()` | 3266 | Résultat IA via wa.me |
| `shareRapport(txt,title)` | 7247 | Web Share API / clipboard fallback |

### 13.10 Simulateur

| Fonction | Ligne | Description |
|---|---|---|
| `_calcPxSeuil()` | 5088 | Prix de revient seuil FCFA/kg |
| `_simSet(key,val)` | 5110 | Met à jour un paramètre simulateur + sync |
| `_calcDepSim()` | 5127 | Calcul prorata dépenses simulateur |

### 13.11 Cycle & SOP

| Fonction | Ligne | Description |
|---|---|---|
| `saveCycle()` | 3906 | Sauvegarde cycle (archive ancien, clear sheets, réinit) |
| `_archiveCycle(snap)` | 3878 | Archive cycle dans Historique_Cycles |
| `verifyAndReset()` | 2822 | Ouvre confirmation reset cycle |
| `confirmResetWithPwd()` | 2832 | Vérifie MDP fondateur puis ouvre modal init |
| `_sopEdit(i)` | ~6480 | Édite un acte SOP |
| `_sopDel(i)` | ~6485 | Supprime un acte SOP |
| `_sopSave(isNew)` | ~6490 | Sauvegarde un acte SOP |
| `_sopReset()` | ~6500 | Reset le timer SOP |
| `_sopValider(idx)` | ~6520 | Valide un acte SOP (±7/21j) |
| `_sopInlineSave(idx,tous)` | ~6525 | Sauvegarde santé inline pour un acte SOP |

### 13.12 Divers

| Fonction | Ligne | Description |
|---|---|---|
| `_setPath(path,val)` | 647 | Set propriété nested par chemin string |
| `_applyExtra(extra)` | 656 | Parse "path=value" et appelle _setPath |
| `addHistory(type,label,meta)` | 797 | Ajoute une entrée HISTORY |
| `resetActivity()` | 959 | Reset timestamp dernière activité |
| `haptic(type)` | 2289 | Vibration feedback |
| `toggleLight()` | 2278 | Toggle mode clair/sombre |
| `animateCounters()` | 5084 | Anime les compteurs KPI |
| `initSwipe()` | 2508 | Initialise le swipe horizontal onglets |
| `buildAIContext()` | 2991 | Construit contexte textuel pour Claude |
| `askAI(question)` | 3118 | Appelle Claude via /api/ai |
| `fetchMeteo()` | 1009 | Météo Open-Meteo Thiès |
| `b64u(str)` | 1167 | Base64 URL-safe encode (string) |
| `b64bin(str)` | 1171 | Base64 URL-safe encode (binary) |

---

## 14. Patterns de code & conventions

### 14.1 Conventions ES5 strictes

```js
// ✅ CORRECT
var x = 'hello';
arr.forEach(function(item) { ... });
arr.filter(function(b) { return b.id === id; });

// ⛔ INTERDIT
const x = 'hello';     // → var
let y = 42;             // → var
arr.map(b => b.id);     // → function(b) { return b.id; }
`template ${x}`;        // → 'template ' + x
```

### 14.2 Pattern de rendu

```js
// Toute modification d'état → r()
S.tab = 'saisie';
S.sub = 'pesee';
r(); // re-rendu complet
```

### 14.3 Pattern d'écriture multi-sheets

```js
// writeAll() écrit vers plusieurs sheets en parallèle
writeAll([SID.gerant, SID.fondateur], 'Fiche_Quotidienne!A:G', [
  today(), S.fi.nb, S.fi.nourris, S.fi.eau, S.fi.enclos, S.fi.incident, S.fi.desc
]);
```

### 14.4 Pattern localStorage

```js
// Toujours utiliser lsGet/lsSet (préfixe boanr_ + JSON + gestion QuotaExceeded)
var data = lsGet('cycle') || {};
lsSet('cycle', CYCLE);
```

### 14.5 Pattern OUI/NON

```js
// Les toggles binaires utilisent les chaînes 'OUI'/'NON' (pas true/false)
yn(S.fi.nourris, 'nourris', 'fi');
// Génère 2 boutons radio, valeur = 'OUI' ou 'NON'
```

### 14.6 Pattern anti-doublon

```js
// Avant chaque submit, vérifier :
if (ficheDejaSoumise()) { S.msg = 'err:Déjà soumise aujourd\'hui'; r(); return; }
```

### 14.7 Pattern de validation

```js
// Validation avant submit dans doSubmit()
if (!S.fp.id) { S.msg = 'err:Sélectionnez une bête'; r(); return; }
if (!S.fp.poids || S.fp.poids <= 0) { S.msg = 'err:Poids invalide'; r(); return; }
```

### 14.8 Pièges connus

| Piège | Description | Impact |
|---|---|---|
| `,,` double virgule | Provoque une page blanche silencieuse sur mobile | Critique |
| `r()` sans mutation | Appeler `r()` sans changer l'état ne fait rien de visible | Confusion |
| `_escHtml` oublié | XSS possible si champ libre affiché sans escaping | Sécurité |
| `getTok()` expired | Si token expiré et pas re-fetché → erreur 401 Sheets | Fonctionnel |
| `flushQueue` SID unique | Offline queue écrit seulement sur SID.gerant | Données incomplètes |
| `CYCLE` non sauvé | Si `lsSet('cycle', CYCLE)` oublié → perte au rechargement | Données |
| `appendRow` row overflow | Si la table range est pleine → écriture silencieuse échoue | Données |
| `fl()` corps vide | Si `inputHtml`/`label` omis dans le return → tous les champs `fl()` invisibles (regression `f7a962b`, corrigé `5bad4a0`) | Critique |

---

## 15. Variables d'environnement

### 15.1 Vercel (obligatoires)

| Variable | Utilisée dans | Description |
|---|---|---|
| `PWD_FONDATEUR` | auth.js | Mot de passe fondateur |
| `PWD_GERANT` | auth.js | Mot de passe gérant |
| `PWD_RGA` | auth.js | Mot de passe RGA |
| `PWD_FALLOU` | auth.js | Mot de passe commerciale |
| `SID_FONDATEUR` | auth.js | Google Spreadsheet ID fondateur |
| `SID_GERANT` | auth.js | Google Spreadsheet ID gérant |
| `SID_RGA` | auth.js | Google Spreadsheet ID RGA |
| `SID_FALLOU` | auth.js | Google Spreadsheet ID commerciale |
| `SA_PRIVATE_KEY` | auth, token, sheets, change-password | Clé privée RSA Service Account Google |
| `SA_CLIENT_EMAIL` | auth, token, sheets, change-password | Email Service Account Google |
| `SESSION_SECRET` | tous les endpoints | Secret HMAC-SHA256 pour session tokens |
| `ANTHROPIC_API_KEY` | ai.js | Clé API Anthropic Claude |

### 15.2 Futures (système notifications)

| Variable | Description |
|---|---|
| `SENDGRID_API_KEY` | Clé API SendGrid (emails) |
| `CRON_SECRET` | Secret pour sécuriser les appels cron |

### 15.3 GitHub Secrets (futurs)

| Secret | Description |
|---|---|
| `CRON_SECRET` | Même valeur que Vercel, pour GitHub Actions |

---

## 16. Déploiement & opérations

### 16.1 Déploiement

```
GitHub main → Vercel auto-deploy → https://boan-app-ur3x.vercel.app
```

- Chaque push sur `main` déclenche un déploiement automatique
- Pas de CI/CD custom, pas de tests automatisés
- Pas de staging — déploiement direct en production

### 16.2 Google Sheets

- 4 spreadsheets (1 par rôle), partagés en éditeur avec le Service Account
- Formatage initial via Google Apps Script (`scripts/boan_sheets_format.gs`)
- Aucune migration automatique — les colonnes doivent correspondre exactement

### 16.3 Routage Vercel (`vercel.json`)

```json
{
  "rewrites": [
    { "source": "/((?!api/|guides/|manifest\\.json|sw\\.js).*)", "destination": "/index.html" }
  ]
}
```

- Tout → `/index.html` (SPA)
- Sauf : `/api/*` (serverless), `/guides/*` (statique), `/manifest.json`, `/sw.js`

### 16.4 Opérations courantes

| Opération | Comment |
|---|---|
| Changer un mot de passe | Gestionnaire intégré (sidebar fondateur) ou variable Vercel |
| Ajouter une bête au cycle | Modal init (step 4) ou ajout manuel Config_Cycle col C |
| Modifier le protocole SOP | Saisie > Protocole (fondateur/RGA) |
| Exporter les KPI | Dashboard > PDF ou WhatsApp |
| Nouveau cycle | Sidebar fondateur > "Nouveau cycle" (Go/No-Go requis) |
| Vider le cache local | Supprimer les clés `boanr_*` dans localStorage |
| Appliquer le formatage Sheets | Exécuter `formatAllSheets()` dans Google Apps Script |

---

## 17. Risques connus & dette technique

### 17.1 Architecturaux

| # | Risque | Sévérité | Description |
|---|---|---|---|
| R-01 | Fichier unique 8 600 lignes | ⚠️ Élevé | Maintenance difficile, pas de modularité, merge conflicts |
| R-02 | Couplage global | ⚠️ Élevé | ~15 variables globales mutables, toute mutation peut casser une vue distante |
| R-03 | Rendu innerHTML complet | ⚠️ Moyen | Performance OK < 10K lignes, mais pas scalable |
| R-04 | Pas de tests | ⛔ Critique | Zéro test unitaire, zéro test e2e, régression possible à chaque commit |
| R-05 | Pas de staging | ⚠️ Moyen | Production = seul environnement |
| R-06 | Google Sheets comme BDD | ⚠️ Moyen | Limites API (100 req/100s), pas de transactions, pas d'index |
| R-07 | ES5 sans transpiler | ⚠️ Faible | Intentionnel (compatibilité max), mais verbeux et error-prone |

### 17.2 Sécurité

| # | Risque | Sévérité | Description |
|---|---|---|---|
| S-01 | Fallback SESSION_SECRET | ⛔ Critique | `'boanr_dev_secret'` codé en dur → tokens prévisibles si env var absente |
| S-02 | MDP base64 dans Sheets | ⚠️ Moyen | Pas de hashing — récupérables si accès au Sheet |
| S-03 | Pas de rate limiting | ⚠️ Moyen | Auth brute-force possible (mais sur Vercel = coût) |
| S-04 | CORS `*` sur token/sheets/ai | ⚠️ Faible | Acceptable car session token requis |
| S-05 | /api/ai sans role check | ⚠️ Faible | Tout utilisateur authentifié peut appeler Claude |

### 17.3 Données

| # | Risque | Sévérité | Description |
|---|---|---|---|
| D-01 | flushQueue SID unique | ⚠️ Moyen | Données offline non propagées vers fondateur/rga |
| D-02 | appendRow silencieux | ⚠️ Moyen | Si table range pleine → perte de données sans erreur |
| D-03 | Pas de backup Sheets | ⚠️ Moyen | Google versionne, mais pas de backup externe |
| D-04 | Sync Config bi-directionnelle | ⚠️ Faible | Config_Cycle synced vers 4 sheets, mais pas de lock — race condition théorique |

### 17.4 UX / Fonctionnel

| # | Risque | Sévérité | Description |
|---|---|---|---|
| U-01 | Pas de push notifications | ⚠️ Moyen | Le gérant doit ouvrir l'app pour voir les alertes |
| U-02 | Pas de mode offline complet | ⚠️ Moyen | Lecture Sheets impossible hors ligne — uniquement les données cachées |
| U-03 | Pas de multi-cycle simultané | ⚠️ Faible | Un seul cycle actif à la fois |
| U-04 | Pas de gestion utilisateurs | ⚠️ Faible | 4 rôles fixes, pas d'ajout/suppression |

---

## 18. Inventaire des fichiers

### 18.1 Fichiers de l'application

| Fichier | Lignes | Rôle |
|---|---|---|
| `index.html` | ~8 623 | SPA — tout le code client |
| `manifest.json` | 16 | PWA manifest |
| `sw.js` | 51 | Service Worker (cache + offline) |
| `vercel.json` | 4 | Config Vercel (rewrites) |
| `api/auth.js` | 126 | Endpoint login |
| `api/token.js` | 62 | Endpoint Google OAuth2 token |
| `api/sheets.js` | 93 | Endpoint proxy Sheets API |
| `api/ai.js` | 42 | Endpoint proxy Claude API |
| `api/change-password.js` | 117 | Endpoint gestion MDP |
| `scripts/boan_sheets_format.gs` | ~400 | Google Apps Script formatage |
| `guides/fondateur.html` | — | Guide PDF fondateur |
| `guides/gerant.html` | — | Guide PDF gérant |
| `guides/rga.html` | — | Guide PDF RGA |
| `guides/commerciale.html` | — | Guide PDF commerciale |

### 18.2 Documentation

| Fichier | Rôle |
|---|---|
| `README.md` | Documentation projet (overview) |
| `docs/DOCUMENTATION_TECHNIQUE.md` | Référence développeur (risques, patterns, schémas) |
| `docs/AI_RESUMPTION_PROMPT.md` | Prompt de reprise IA (snapshot état projet) |
| `docs/NOTIFICATIONS_ROADMAP.md` | Roadmap V2.0 Notifications & Sinistres |
| `docs/BOAN_APP_DOCUMENTATION.md` | **Ce document** — documentation complète |

### 18.3 Scripts utilitaires (temporaires, non déployés)

| Fichier | Rôle |
|---|---|
| `_check.py`, `_fix_*.py`, `_search.py` | Scripts de correction ponctuels (Python) |

### 18.4 Arborescence

```
Boan-app/
├── index.html              # SPA principale (~8 623 lignes)
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
├── vercel.json             # Config déploiement Vercel
├── README.md               # Documentation projet
├── api/
│   ├── auth.js             # Login + session
│   ├── token.js            # Google OAuth2 token
│   ├── sheets.js           # Proxy Sheets API
│   ├── ai.js               # Proxy Claude API
│   └── change-password.js  # Gestion MDP
├── docs/
│   ├── DOCUMENTATION_TECHNIQUE.md
│   ├── AI_RESUMPTION_PROMPT.md
│   ├── NOTIFICATIONS_ROADMAP.md
│   └── BOAN_APP_DOCUMENTATION.md
├── guides/
│   ├── fondateur.html
│   ├── gerant.html
│   ├── rga.html
│   └── commerciale.html
└── scripts/
    └── boan_sheets_format.gs
```
