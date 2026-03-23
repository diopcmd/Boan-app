# Documentation Technique — BOANR

> Application web mobile de gestion d'élevage bovin — Ferme BOAN, Thiès, Sénégal.
> Mise à jour : mars 2026

---

## Architecture générale

```
┌──────────────────────────────────────────────────────────┐
│                     Navigateur mobile                    │
│   index.html  (SPA vanilla JS — pas de framework)        │
│   ├── CSS inline (thème dark/clair, animations)          │
│   ├── JS global (var S, MOCK, CYCLE, SID, HISTORY…)      │
│   └── Appels fetch directs → API Google + Anthropic      │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTPS
            ┌──────────┴──────────┐
            │   Vercel Serverless  │
            │   /api/auth.js       │  ← Login, session HMAC
            │   /api/token.js      │  ← RS256 JWT → Google OAuth2
            │   /api/sheets.js     │  ← Proxy Sheets (alternatif)
            │   /api/change-pwd.js │  ← Override credentials
            │   /api/ai.js         │  ← Proxy Anthropic Claude
            └──────────┬──────────┘
                       │
         ┌─────────────┴──────────────┐
         │                            │
   Google Sheets API v4          Anthropic API
   (4 spreadsheets par rôle)     (Claude claude-sonnet-4)
```

---

## Flux d'authentification

```
1. Utilisateur saisit login + password
2. POST /api/auth  { login, password }
   ├── Charge Config_Passwords (Google Sheets fondateur)
   ├── Résout le login (canonique ou overridé)
   ├── Vérifie le mot de passe (env var ou base64 Sheets)
   ├── Génère session token : base64(payload) + '.' + HMAC-SHA256
   └── Retourne { ok, sessionToken, user:{login,role,name,tabs}, sid }
3. Frontend stocke SID[role] = data.sid
4. Toutes les requêtes suivantes incluent X-Session-Token
5. Expiration : 8h — setInterval 60s vérifie et déconnecte
```

---

## Flux d'écriture Google Sheets

```
doSubmit(type)
  └── _submitActual(type)
        └── writeAll([SID.gerant, SID.fondateur], 'Feuille!A:G', [vals])
              └── appendRow(sid, 'Feuille!A:G', [vals])  ← pour chaque SID
                    ├── GET  .../values/Feuille!A4:A500   → compter lignes
                    │         filtre r[0] !== ''          → évite cellules formatées vides
                    ├── targetLine = Math.min(start + rows.length, end)
                    └── PUT  .../values/Feuille!A{targetLine}  → écrire la ligne
```

**Pourquoi pattern read-then-PUT et non INSERT_ROWS ?**
Les feuilles sont formatées avec des couleurs alternées, des formules et des validations sur des plages fixes. `INSERT_ROWS` déplacerait les lignes et casserait les formules. Le PUT à la première ligne vide préserve la structure.

---

## API Vercel

### `/api/auth.js`

**POST** `{ login, password }`

| Champ réponse | Type | Description |
|---|---|---|
| `ok` | bool | Succès |
| `sessionToken` | string | `base64(payload).hmac_hex` |
| `user.login` | string | Identifiant utilisé (canonique ou overridé) |
| `user.role` | string | Rôle : `fondateur`, `gerant`, `rga`, `fallou` |
| `user.name` | string | Nom affiché |
| `user.tabs` | string[] | Onglets autorisés |
| `sid` | string | ID Google Spreadsheet du rôle |

```js
// Logique override :
// 1. Cherche login dans USERS (rôles canoniques)
// 2. Si absent, cherche login dans colonne D de Config_Passwords (login_override)
// 3. Applique le mot de passe de la colonne B (base64) si présent
```

### `/api/token.js`

**GET** (nécessite `X-Session-Token`)

Retourne `{ token: <Google OAuth2 access_token> }` via RS256 JWT Service Account.
Le frontend met en cache dans `S.tok` / `S.tokexp`.

### `/api/change-password.js`

**POST** `{ role, newPwd, newLogin? }` (fondateur uniquement)

Écrit dans `Config_Passwords` du Google Sheets fondateur.
Auto-crée la feuille si elle n'existe pas.

### `/api/ai.js`

**POST** `{ messages[] }` (nécessite `X-Session-Token`)

Proxy vers Anthropic Claude. Retourne `{ content: "..." }`.

---

## Google Sheets — Structure attendue

### Format des feuilles de saisie

Toutes les feuilles de saisie ont le même format :
- **Lignes 1-3** : En-têtes, titres, légendes (formatés, ne pas toucher)
- **Ligne 4+** : Données (`TABLE_RANGES.start = 4`)

> **Exception reset cycle** : `Stock_Nourriture`, `Incidents`, `Sante_Mortalite` ont une ligne 4 protégée — le reset vide à partir de **A5** pour ces trois onglets uniquement.

```
| Ligne 1 | Titre fusionné                    |
| Ligne 2 | En-têtes colonnes                 |
| Ligne 3 | Légende / sous-en-tête            |
| Ligne 4 | ← 1ères données (TABLE_RANGES.start) |
| ...     | Données suivantes                 |
```

### Noms d'onglets exacts (sensibles à la casse et aux underscores)

| Spreadsheet | Onglet | Colonnes prévues |
|---|---|---|
| Gérant + Fondateur | `Fiche_Quotidienne` | Date, NbBetes, Nourris, Eau, Enclos, Incident, Description |
| Gérant + Fondateur | `SOP_Check` | Date, Net, Des, Rat, Eau, Stk, San, Prob |
| Gérant + Fondateur | `Stock_Nourriture` | Date, TypeAliment, kg(±), Ration, Semaines, Alerte |
| Gérant + Fondateur | `Incidents` | Date, IdBete, Type, Gravite, Description, Action, Cloture |
| Gérant + Fondateur | `Pesees` | Date, IdBete, Race, Poids, PoidsPrec, Gain, Statut |
| Gérant + Fondateur | `Sante_Mortalite` | Date, IdBete, Symptome, Traitement, Cout, Resultat, Deces |
| Gérant + Fondateur | `Hebdomadaire` | Semaine, NbBetes, Nourriture, Stock, Incidents, Poids, Alerte, Msg |
| Fondateur | `KPI_Mensuels` | Sem, Mois, Betes, GMQ, Stock, Treso, Incidents, col H = trésorerie |
| Fondateur | `KPI_Hebdo` | Sem, Date, Betes, GMQ, Stock, Incidents, Poids |
| Fondateur | `Config_Passwords` | role, pwd_base64, updated_at, login_override |
| Fondateur | `Config_Cycle` | Clé, Valeur (une config par ligne, A1 format) |
| Fallou + Fondateur | `Suivi_Marche` | Date, Foirail, Bas, Moy, Haut (validation bas≤moy≤haut — écriture A:E uniquement) |

---

## Variables d'environnement Vercel

| Variable | Obligatoire | Description |
|---|---|---|
| `PWD_FONDATEUR` | Oui | Mot de passe rôle fondateur |
| `PWD_GERANT` | Oui | Mot de passe rôle gérant |
| `PWD_RGA` | Oui | Mot de passe rôle RGA |
| `PWD_FALLOU` | Oui | Mot de passe rôle commerciale |
| `SID_FONDATEUR` | Oui | ID Google Spreadsheet fondateur |
| `SID_GERANT` | Oui | ID Google Spreadsheet gérant |
| `SID_RGA` | Oui | ID Google Spreadsheet RGA |
| `SID_FALLOU` | Non | ID Google Spreadsheet Fallou (fallback: fondateur) |
| `SA_PRIVATE_KEY` | Oui | Clé privée RSA PEM (les `\n` doivent être `\\n` en JSON) |
| `SA_CLIENT_EMAIL` | Oui | Email du Service Account Google |
| `SESSION_SECRET` | Oui | Secret HMAC >= 32 caractères |
| `ANTHROPIC_API_KEY` | Non | Clé Anthropic (fonctionnalité IA) |

---

## Frontend — Composants JS clés

> `index.html` : **~4974 lignes** (ES5 strict, var uniquement)

### PWA — Clavier mobile (méta + CSS)

```html
<!-- Viewport : empêche le clavier Android d'écraser la mise en page -->
<meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-visual">
<!-- iOS PWA -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<!-- Manifest : requis pour que Chrome Android détecte correctement le mode standalone -->
<link rel="manifest" href="/manifest.json">
```

```css
/* Supprime le délai 300ms iOS qui bloque le clavier au premier tap */
input,textarea,select,button,a { touch-action: manipulation; }
```

**vercel.json** exclut `/manifest.json` du rewrite SPA :
```json
{ "source": "/((?!api/|manifest\\.json).*)", "destination": "/index.html" }
```

### Fonctions de rendu

| Fonction | Ligne | Description |
|---|---|---|
| `r()` | L905 | Re-render complet — restaure focus/curseur pour clavier mobile |
| `pageLogin()` | L3498 | Page connexion |
| `pageApp()` | L3516 | Shell app (header + tabs + contenu) |
| `viewDash()` | L4106 | Dashboard (hero card + KPI + alertes) |
| `viewSaisie()` | L4258 | Formulaires de saisie (dispatch sur S.sub) |
| `viewLiv()` | L4599 | Livrables (trésorerie, simulations, projections) |
| `viewMarche()` | L4858 | Marché (prix, recommandations, simulateur) |
| `buildSidebar()` | L3642 | Sidebar (météo, stock, checklist, stepper durée+pesée) |
| `pageModal()` | L2056 | Modale configuration cycle |
| `pageAI()` | L2470 | Modale assistant IA Claude |
| `pagePwdManager()` | L2717 | Gestionnaire mots de passe (fondateur) |

### Fonctions réseau

| Fonction | Ligne | Description |
|---|---|---|
| `getTok()` | — | Promise — access_token Google (cache 55min) |
| `readSheet(sid, range)` | — | Lecture plage Google Sheets |
| `appendRow(sid, range, vals)` | — | Écriture ligne (read-then-PUT) |
| `writeAll(sids, range, vals)` | — | Écriture parallèle multi-SID |
| `kpiAppend(vals)` | — | Écriture KPI_Mensuels (SID.fondateur) |
| `loadLiveData()` | L1115 | Charge données réelles depuis Sheets (3 vagues) |
| `buildHistoryFromSheets(...)` | — | Construit HISTORY depuis 7 onglets Sheets |
| `loadPrix()` | L1880 | Charge suivi marché depuis Sheets (`Suivi_Marche!A4:J500`, filtre bas ou moy présent) |
| `doSubmit(type)` | L1478 | Soumission formulaire — valide, préfixe `ok:`, écrit Sheets |
| `addStockLigne(mode)` | L2281 | Ajout/consommation stock — valide dispo avant acceptation |
| `_syncCycle()` | L1717 | Réécrit `Config_Cycle!A1:O1` dans les 4 sheets disponibles |
| `updateDureeMois(v)` | L1734 | Met à jour `CYCLE.dureeMois` + appelle `_syncCycle()` |
| `updatePeseeFreq(v)` | L1739 | Met à jour `CYCLE.peseeFreq` + appelle `_syncCycle()` |
| `saveCycle()` | L3272 | Valide et enregistre la configuration cycle complète |

### Fonctions utilitaires

| Fonction | Description |
|---|---|
| `today()` | Date du jour format `DD/MM/YYYY` (fuseau Dakar) |
| `nowHeure()` | Heure Dakar (0-23) |
| `nowJour()` | Jour semaine Dakar (0=dim, 5=ven) |
| `fmt(n)` | Formater nombre en FCFA |
| `lsGet/lsSet(k, v)` | LocalStorage JSON |
| `ficheDejaSoumise()` | Bool — fiche quotidienne déjà envoyée aujourd'hui |
| `joursSince(type)` | Jours depuis dernière saisie de ce type |
| `calcSemaine()` | Numéro de semaine du cycle en cours |
| `bilanDejaFaitCetteSemaine()` | Bool — bilan hebdomadaire déjà soumis cette semaine |
| `calcStockLocal()` | Calcul stock restant depuis STOCK_MVTS |
| `stockSyntheseHtml(compact)` | HTML mouvements stock (full ou compact sidebar) |

### Sidebar — stepper durée cycle

```js
// Stepper pur -/+ (pas d'input — évite reset au re-render)
// Rendu dans sb-body (scrollable), PAS dans sb-foot (fixe)
// Fond vert foncé #1a3a1a pour lisibilité, texte blanc, valeur en gros
'<button onclick="updateDureeMois(Math.max(1,'+(CYCLE.dureeMois||8)+'-1))">−</button>'
+'<div style="background:#1a3a1a;color:#fff;font-size:15px;font-weight:900">'+(CYCLE.dureeMois||8)+' mois</div>'
+'<button onclick="updateDureeMois(Math.min(60,'+(CYCLE.dureeMois||8)+'+1))">+</button>'
// updateDureeMois(v) → CYCLE.dureeMois=v; lsSet; r(); _syncCycle()
```

### Simulateur durée

```js
// Stepper inline dans le bandeau simulateur (S.simMois état local)
// -/+ appels directs, pas d'input, pas de bouton OK
var cycleMois = (S.simMois !== undefined && S.simMois !== null) ? S.simMois : (CYCLE.dureeMois||8);
// L5011–5013
```

### Navigation et UX

| Fonction | Description |
|---|---|
| `chTab(t)` | Changer d'onglet avec animation tabFadeIn |
| `chTabSwipe(t, dir)` | Changer d'onglet par swipe (animation 290ms) |
| `closeSB()` | Fermer la sidebar |
| `toggleLight()` | Basculer thème clair/sombre |
| `yn(val, k, obj)` | Boutons Oui/Non pour formulaires |
| `ynPick(cid, obj, k, val)` | Handler bouton Oui/Non (sans r() sauf conditionnel) |
| `openPwdManager()` | Ouvrir gestionnaire mots de passe |
| `verifyAndReset()` | Vérification Go/No-Go pour nouveau cycle |

---

## CSS — Thème et classes clés

### Thème dark (défaut)

```css
body { background: #0f1a0f; color: #ccc; }
.card, .kcard { background: #1a2e1a; border: 1px solid #2d4a2d; }
.tab          { background: #1a3a1a; color: #88bb88; }
.tab.on       { color: #fff; border-bottom: 2px solid #fff; }
```

### Thème clair (`body.light`)

```css
body.light          { background: #f0f5f0; color: #1a2e1a; }
body.light .card    { background: #fff; border-color: #c5d8c5; }
body.light .tab     { background: #2d6a2d; color: #fff; }
body.light .tab.on  { border-bottom-color: #fff; }
```

### Classes utilitaires

| Classe | Usage |
|---|---|
| `.kval-ok` | Indicateur vert (KPI dans objectif) |
| `.kval-warn` | Indicateur orange (KPI à surveiller) |
| `.kval-crit` | Indicateur rouge (KPI critique) |
| `.sb-ok` | Texte vert sidebar (tâche faite) |
| `.sb-ko` | Texte rouge sidebar (tâche à faire) |
| `.sb-warn` | Texte orange sidebar (attention) |
| `.al-g/.al-o/.al-r` | Alertes verte/orange/rouge |
| `.sb-row` | Ligne sidebar (label + valeur) |
| `.sb-card` | Carte contenu sidebar |
| `.sb-shortcut` | Raccourci action rapide sidebar |
| `.stitle` | Titre de section (avec point vert) |

---

## Règles de développement

### Impératives

1. **`var` uniquement** dans `index.html` — compatibilité mobile max
2. **Pas de double virgule `,,`** — erreur JS silencieuse (page blanche)
3. **`TABLE_RANGES` avant `appendRow()`** — dépendance de déclaration
4. **`USERS` dans `handler()`** — évite état partagé cold start Vercel
5. **encode `sheetName` only** — `encodeURIComponent('Feuille')+'!A4'` et non `encodeURIComponent('Feuille!A4')`
6. **Filter lignes vides** — `(d.values||[]).filter(r => r && r.length > 0 && r[0] !== '')`
7. **Détection thème** — `document.body.classList.contains('light')` toujours
8. **Jamais `/35` hardcodé** — toujours `Math.round((CYCLE.dureeMois||8)*4.33)` = total semaines cycle
9. **Gérant reçoit `SID_FONDATEUR`** — `writeAll` écrit dans les deux sheets simultanément
10. **Messages succès** — préfixe `ok:` obligatoire (`S.msg='ok:✅ texte'`) — `msgHtml()` détecte avec `S.msg.indexOf('ok:')===0`
11. **Validation stock** — `addStockLigne('consommer')` vérifie `dispo = calcStockParAliment()[type] + pendingNet` avant d'accepter
12. **Sync CYCLE** — toute modification de `CYCLE.dureeMois` ou `CYCLE.peseeFreq` doit passer par `updateDureeMois()` / `updatePeseeFreq()` (ou `_syncCycle()`) pour être visible par tous les acteurs. Ne jamais faire `CYCLE.x=v;lsSet('cycle',CYCLE)` seul pour ces champs.

### Bonnes pratiques

- Ne pas appeler `r()` depuis `ynPick()` sauf si la structure HTML change (garde clavier mobile)
- Swipe : timeout 290ms = durée animation `.28s`
- PowerShell : `;` pour chaîner, jamais `&&`
- Déploiement : commit atomique `git add . ; git commit -m "type: desc" ; git push origin main`

---

## Diagnostic des erreurs courantes

| Erreur | Cause probable | Solution |
|---|---|---|
| Page blanche sans console | `,,` dans objet JS | Chercher `,,` dans index.html |
| "Requested entity was not found" | Mauvais nom d'onglet ou SID manquant | Vérifier noms onglets + variables Vercel |
| "unable to parse range" | `%3A` dans l'URL Sheets | encode `sheetName` uniquement, pas la plage |
| Écriture décalée d'une ligne | Cellules vides formatées comptées | Filtre `r[0] !== ''` dans appendRow |
| Toujours MOCK après login | SID.gerant undefined | Fallback SID.fondateur dans loadLiveData |
| Login override refusé | Check USERS[id] avant API | Ne pas vérifier localement avant /api/auth |
| Import crash (require not defined) | require() dans ES Module | import statique depuis 'node:crypto' |
| Sidebar couleurs lisibles dark only | Couleurs hardcodées dark | Utiliser `_sbLt` ternaire |
| Fondateur ne voit pas données gérant | Gérant sans `SID_FONDATEUR` | auth.js : gérant reçoit `{gerant,fondateur}` |
| Sidebar variables toujours au même état | `buildHistoryFromSheets` manque SOP/Stock | Vague2 lit 7 onglets, filtre par clé pas date |
| `/35` affiché même si cycle ≠ 8 mois | Valeur hardcodée | `Math.round((CYCLE.dureeMois\|\|8)*4.33)` |

---

## Architecture loadLiveData — 3 vagues

`loadLiveData()` charge les données réelles depuis Google Sheets en 3 étapes séquentielles / parallèles :

```
Étape 1 — Bloquante (Config_Cycle)
  readSheet(sidFondateur, 'Config_Cycle!A1:O1')
  → Synchronise l'objet CYCLE (durée, nbBêtes, capital, etc.)
  → Indispensable avant toute autre lecture (totalSemCycle dépend de CYCLE.dureeMois)

Étape 2 — Vague1 parallèle (KPI temps réel)
  ┌─ Pesees          → LIVE.pesees, calcule MOCK.gmq, MOCK.betes, SPARK.gmq
  ├─ Stock_Nourriture → MOCK.stock
  ├─ KPI_Mensuels    → MOCK.treso, SPARK.betes, SPARK.stock, SPARK.treso
  └─ Sante_Mortalite → MOCK.incidents (cette semaine)

Étape 3 — Vague2 parallèle (Historique complet)
  Source : sidHisto = SID.fondateur || SID.gerant
  ┌─ Fiche_Quotidienne  ┐
  ├─ Incidents          │
  ├─ Sante_Mortalite    │ → buildHistoryFromSheets(...) → HISTORY[]
  ├─ Hebdomadaire       │    clé unique par entrée, Sheets prime sur HISTORY local
  ├─ Pesees             │
  ├─ SOP_Check          │
  └─ Stock_Nourriture   ┘
```

**Source de lecture Vague2** : `sidHisto = SID.fondateur || SID.gerant`
Le gérant reçoit `SID_FONDATEUR` au login → `writeAll` écrit dans les deux sheets → le fondateur lit depuis son propre sheet → cohérence garantie.

---

## buildHistoryFromSheets — Conversion 7 onglets → HISTORY

```js
buildHistoryFromSheets(fiches, incidents, santes, bilans, pesees, sops, stocks)
```

Chaque tableau correspond à un onglet Sheets (lignes brutes, sans en-têtes).
La fonction convertit chaque ligne en entrée HISTORY `{ type, date, ... }` et fusionne avec l'HISTORY local existant.

**Règle de déduplication** : clé composite `type + '|' + date + '|' + champ_discriminant`.
Si la même clé existe dans Sheets ET dans HISTORY local, la version **Sheets prime** (source de vérité).

**Types générés** :

| Type HISTORY | Source Sheets | Champ clé |
|---|---|---|
| `fiche` | `Fiche_Quotidienne` | date |
| `incident` | `Incidents` | date + idBete |
| `sante` | `Sante_Mortalite` | date + idBete |
| `bilan` | `Hebdomadaire` | semaine |
| `pesee` | `Pesees` | date + idBete |
| `sop` | `SOP_Check` | date |
| `stock` | `Stock_Nourriture` | date + typeAliment |

---

## Gestion des SID par rôle

Dans `api/auth.js`, chaque rôle reçoit un objet `sid` multi-clé :

```js
// Gérant — écrit dans les deux sheets pour que le fondateur voit ses données
{ gerant: SID_GERANT, fondateur: SID_FONDATEUR }

// Fondateur — accès complet
{ fondateur: SID_FONDATEUR, gerant: SID_GERANT, fallou: SID_FALLOU }

// RGA — lecture fondateur + gérant
{ rga: SID_RGA, gerant: SID_GERANT, fondateur: SID_FONDATEUR }

// Fallou (commerciale)
{ fallou: SID_FALLOU, fondateur: SID_FONDATEUR }
```

Dans le frontend, `SID` est peuplé depuis `data.sid` au login :
```js
Object.assign(SID, data.sid);   // ex: SID.fondateur, SID.gerant, ...
```

`writeAll([SID.gerant, SID.fondateur], range, vals)` écrit en parallèle dans les deux sheets.
Le fondateur lit depuis `sidHisto = SID.fondateur || SID.gerant`.

---

## Durée de cycle dynamique

La durée du cycle n'est **jamais** hardcodée à 35 semaines.

```js
// Calcul total semaines cycle (partout dans le code) :
var totalSemCycle = Math.round((CYCLE.dureeMois || 8) * 4.33);

// Exemples d'utilisation :
var pct = Math.round((sem / totalSemCycle) * 100);          // progression %
var joursRestants = Math.max(0, (totalSemCycle - sem) * 7); // jours restants
```

`CYCLE.dureeMois` est lu depuis `Config_Cycle!A1:O1` (Google Sheets fondateur) au démarrage de `loadLiveData()`. Valeur par défaut : `8` mois (≈ 34.6 → arrondi 35 semaines).

---

## Historique des commits

| Commit | Description |
|---|---|
| `62ebeb1` | Agents 1-4 : auth multi-SID, loadLiveData 3-étapes, buildHistoryFromSheets, badge LIVE/MOCK, bouton Actualiser |
| `6ddec0a` | `ficheDejaSoumise()` vérifie HISTORY (plus seulement localStorage) |
| `02f9275` | Gérant reçoit `SID_FONDATEUR` — fondateur voit les soumissions gérant |
| `a42c5e1` | `buildHistoryFromSheets` lit 7 onglets (+ SOP_Check, Stock_Nourriture), filtre par clé |
| `670c2a3` | Sidebar fondateur : bêtes/GMQ dynamiques, bilan `bilanDejaFaitCetteSemaine()`, incidents semaine entière, bug `+'</div>;` |
| `133cada` | Tous les `/35` hardcodés → `CYCLE.dureeMois` dynamique (exportPDF, exportKpiPDF, WhatsApp, AI, viewLiv, sidebar) |
