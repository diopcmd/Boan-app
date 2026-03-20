# Prompt de reprise — Projet BOANR
> Colle ce prompt au début d'une nouvelle conversation avec n'importe quelle IA pour reprendre le projet exactement où il en est.

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

## Derniers commits (état actuel)

```
ec1eed7  fix: double virgule dans S{} (_guideOpen: false,,)
0202d55  ux: dashboard hero + bordures KPI/alertes/sections + onglet actif vert
3913c23  ux: guide gerant redesign - gradients, icones, bouton dashboard
11032e3  feat: guide gerant - modal quoi faire et quand
85aebfe  feat: auto-creation Config_Passwords
9d01cc8  fix: projection vente, SPARK.betes live, score sante, fluidite CSS
e7c1cf3  fix: env vars dans handler() — evite Config serveur manquante
c442942  feat: modification identifiants + mots de passe fondateur
29aea65  fix: TABLE_RANGES declaration
```
