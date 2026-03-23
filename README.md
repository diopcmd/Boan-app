# BOANR — Application de Gestion d'Élevage Bovin

Application web mobile de gestion d'élevage bovin pour la **Ferme BOAN** (Thiès, Sénégal).
Interface de pilotage à distance multi-rôles : direction, gérant terrain, RGA, commerciale.

**Production** → https://boan-app-ur3x.vercel.app

---

## Fonctionnalités

### Saisies quotidiennes (gérant terrain)
- **Fiche journalière** — nb bêtes, alimentation, eau, état enclos, incidents
- **Checklist SOP** — vérification des procédures (nettoyage, désinfection, quarantaine…)
- **Mouvements de stock** — ajout, consommation, inventaire aliments
- **Incidents** — signalement avec gravité, action corrective, clôture
- **Pesées** — poids individuel par bête avec calcul gain moyen quotidien (GMQ)
- **Santé / Mortalité** — symptômes, traitement, coût, issue

### Tableau de bord
- **Score santé troupeau** — GMQ (50pts) + Stock (30pts) + Bêtes actives (20pts)
- **4 KPI cards** — nb bêtes, GMQ, semaines de stock, trésorerie
- **Alertes intelligentes** — fiche manquante, stock critique, pesée en retard, incidents
- **Sparklines** — tendance sur 7 points pour chaque indicateur
- **Météo Thiès** — température, pluie, vent en temps réel (Open-Meteo)

### Livrables (fondateur / RGA)
- **Projection vente** — poids final estimé × prix marché × nb bêtes
- **ROI projeté** — basé sur capital investi et durée cycle
- **Bilan hebdomadaire** — synthèse automatique en PDF
- **Trésorerie** — suivi capital et dépenses cumulées
- **Gestion des accès** — modification identifiants et mots de passe par le fondateur

### Marché (fondateur / commerciale)
- **Suivi prix** — bas / moyen / haut par foirail
- **Simulateur** — calcul bénéfice selon prix et commission
- **Recommandations** — timing de vente optimal

### UX mobile
- Navigation par **swipe tactile** entre onglets
- **Sidebar contextualisée** par rôle (météo, checklist, raccourcis)
- Calendrier des saisies hebdomadaire avec indicateurs visuels
- **Mode clair / sombre** avec détection automatique possible
- **Assistant IA** (Claude) pour aide à la décision

---

## Stack technique

| Composant | Technologie |
|---|---|
| Frontend | Vanilla JS ES5, HTML/CSS inline — aucun framework, aucun build |
| Backend | Vercel Serverless Functions (Node.js ES Modules) |
| Base de données | Google Sheets API v4 (4 spreadsheets, un par rôle) |
| Authentification | HMAC-SHA256 custom, session 8h |
| Déploiement | GitHub → Vercel (auto-deploy sur push `main`) |
| IA | Anthropic Claude (claude-sonnet-4) |
| Météo | Open-Meteo API |

---

## Structure du projet

```
Boan-app/
├── index.html              SPA complète (HTML + CSS + JS inline, ~5273 lignes)
├── vercel.json             Rewrites /api/*
├── api/
│   ├── auth.js             Login multi-rôle + SID multi-sheet par rôle
│   ├── token.js            Service Account → Google OAuth2 access token
│   ├── sheets.js           Proxy lecture/écriture Google Sheets
│   ├── change-password.js  Modification credentials (fondateur)
│   └── ai.js               Proxy Anthropic Claude
├── README.md               (ce fichier)
├── DOCUMENTATION_TECHNIQUE.md   Architecture et référence développeur
└── AI_RESUMPTION_PROMPT.md      Prompt de reprise IA pour continuer le projet
```

---

## Rôles et accès

| Rôle | Identifiant | Accès |
|---|---|---|
| **Fondateur** | `fondateur` | Dashboard + Saisie + Livrables + Marché |
| **Gérant terrain** | `gerant` | Dashboard + Saisie |
| **RGA** | `rga` | Dashboard + Livrables |
| **Commerciale** | `fallou` | Dashboard + Marché |

Les identifiants et mots de passe peuvent être modifiés par le fondateur depuis l'interface (Livrables → Gestion des accès).

---

## Configuration Vercel

Variables d'environnement à définir dans le dashboard Vercel → Settings → Environment Variables :

```
PWD_FONDATEUR     Mot de passe fondateur
PWD_GERANT        Mot de passe gérant
PWD_RGA           Mot de passe RGA
PWD_FALLOU        Mot de passe commerciale

SID_FONDATEUR     ID Google Spreadsheet fondateur
SID_GERANT        ID Google Spreadsheet gérant
SID_RGA           ID Google Spreadsheet RGA
SID_FALLOU        ID Google Spreadsheet commerciale

SA_PRIVATE_KEY    Clé privée RSA Service Account (\\n pour les sauts de ligne)
SA_CLIENT_EMAIL   Email du Service Account Google

SESSION_SECRET    Secret HMAC session (>= 32 caractères aléatoires)
ANTHROPIC_API_KEY Clé Anthropic (optionnel)
```

---

## Google Sheets — Prérequis

Chaque rôle dispose de son propre Google Spreadsheet. Le Service Account doit avoir l'accès **Éditeur** sur chaque spreadsheet.

### Onglets obligatoires (gérant et fondateur)

```
Fiche_Quotidienne   Stock_Nourriture   Pesees      Sante_Mortalite
SOP_Check           Incidents          Hebdomadaire
```

### Onglets fondateur uniquement

```
KPI_Mensuels   KPI_Hebdo   Config_Passwords   Config_Cycle
```

### Onglet commerciale

```
Suivi_Marche   (présent aussi dans le spreadsheet fondateur)
```

> **Important** : Les noms d'onglets sont sensibles à la casse et aux underscores. Un nom incorrect provoque l'erreur "Requested entity was not found".

> **Format** : Chaque feuille a 3 lignes d'en-tête (titre, colonnes, légende). Les données commencent en ligne 4.

---

## Déploiement

```powershell
# Cloner le dépôt
git clone https://github.com/diopcmd/Boan-app.git
cd Boan-app

# Après modification
git add index.html                    # ou api/fichier.js
git commit -m "type: description"
git push origin main
# Vercel déploie automatiquement en ~30-60 secondes
```

---

## Développement

Aucune dépendance à installer. L'application est un fichier HTML auto-contenu avec les APIs Vercel en ESM.

Pour tester localement les APIs Vercel :
```bash
npm i -g vercel
vercel dev
```

> Les variables d'environnement doivent être disponibles localement (`.env.local` ou `vercel env pull`).

---

## Documentation

| Fichier | Contenu |
|---|---|
| [DOCUMENTATION_TECHNIQUE.md](DOCUMENTATION_TECHNIQUE.md) | Architecture détaillée, patterns de code, référence API |
| [AI_RESUMPTION_PROMPT.md](AI_RESUMPTION_PROMPT.md) | Prompt de reprise pour continuer avec une IA (état du projet, conventions, historique) |

---

## Historique

| Commit | Description |
|---|---|
| `3ea8929` | fix: bugs marché prix + durée cycle réel sidebar synchro tous sheets (fondateur/rga/fallou) |
| `d6a0cc8` | feat: saisie libre durée cycle simulateur + reset A4→A5 pour Stock/Incidents/Sante |
| `462b641` | fix: message soumission, validation conso stock, cohérence net formule, alerte par aliment |
| `6f8cfb2` | fix: stock fondateur — Vague1 lit sidGerant\|\|sidFondateur + Vague2 reconstruit STOCK_MVTS |
| `d7a8a4b` | fix: STOCK_MVTS reconstitué depuis Sheets pour le fondateur à chaque login |
| `5588542` | docs: mise à jour AI_RESUMPTION_PROMPT + README (URL prod, nouvelles features) |
| `71e3354` | fix: reset cycle vide _lastSyncTS, _lastFondVisitTS, MOCK._tresoFromSante |
| `e601921` | ux: sidebar durée cycle + rappel pesée compacts sur une ligne |
| `03e5df9` | ux: bouton rapport WhatsApp dans dashboard + pré-remplissage fiche OUI/NON |
| `62ebeb1` | feat: Auth multi-SID, loadLiveData 3-vagues, buildHistoryFromSheets |
| `133cada` | fix: tous les `/35` hardcodés → `CYCLE.dureeMois` dynamique |
