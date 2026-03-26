# BOANR — Application de Gestion d'Élevage Bovin

Application web mobile de gestion d'élevage bovin pour la **Ferme BOAN** (Thiès, Sénégal).
Interface de pilotage à distance multi-rôles : direction, gérant terrain, RGA, commerciale.

**Production** → https://boan-app-ur3x.vercel.app

---

## Fonctionnalités

### Saisies quotidiennes (gérant terrain)
- **Fiche journalière** — nb bêtes, alimentation, eau, état enclos, incidents + alertes rouges si nourris=NON ou eau=NON
- **Checklist SOP** — vérification des procédures (nettoyage, désinfection, quarantaine…) + score compliance X/6
- **Mouvements de stock** — ajout, consommation, inventaire aliments
- **Incidents** — signalement avec gravité, action corrective, clôture
- **Pesées** — poids individuel par bête avec calcul gain moyen quotidien (GMQ) + alerte si bête déjà pesée aujourd'hui
- **Santé / Mortalité** — symptômes, traitement, coût, issue (résultat préservé dans le select)
- **Bilan hebdo** — affiche nb pesées de la semaine + GMQ moyen avant envoi

### Tableau de bord
- **Score santé troupeau** — GMQ (50pts) + Stock (30pts) + Bêtes actives (20pts) − malus incidents ouverts (−8/G3, −4/G2, −2/G1)
- **4 KPI cards** — nb bêtes, GMQ live (intervalles réels par bête, badge 🟢), semaines de stock, trésorerie + coût/jour brûlés vs cible
- **Alertes intelligentes** — fiche manquante, stock critique, pesée en retard, incidents ouverts, GMQ chute 2 sem., bilan retard >8j, fin cycle ≤2 sem., météo chaleur ≥38°C
- **Bannieres dismissables** — bouton × pour fermer, reset quotidien
- **Sparklines** — tendance sur 7 points pour chaque indicateur
- **Météo Thiès** — température, pluie, vent en temps réel (Open-Meteo) + prévisions 7 jours

### Livrables (fondateur / RGA)
- **Projection vente** — poids final estimé × prix marché × nb bêtes + budget restant/jour
- **ROI projeté** — basé sur capital investi et durée cycle
- **Bilan hebdomadaire** — synthèse automatique en PDF
- **Trésorerie** — suivi capital, dépenses cumulées + flux frais santé depuis HISTORY
- **Go/No-Go** — 8 critères (dont aucun incident G3 ouvert) pour lancer le cycle suivant
- **Gestion des accès** — modification identifiants et mots de passe par le fondateur

### Marché (fondateur / commerciale)
- **Suivi prix** — bas / moyen / haut par foirail + hero card + indicateur de fraîcheur
- **Simulateur** — calcul bénéfice selon prix et commission + bouton Reset aux valeurs réelles
- **Recommandations** — signal global achat/vente + cartes par bête triées par urgence

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
├── index.html              SPA complète (HTML + CSS + JS inline, ~6282 lignes)
├── vercel.json             Rewrites SPA (exclut /api/ et /manifest.json)
├── manifest.json           Web App Manifest (PWA — icône, nom, display:standalone)
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
# Vercel déploie automatiquement en ~30-60 secondes (si webhook GitHub actif)
# En cas de webhook cassé : dashboard Vercel → Deployments → Redeploy
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
| `0e956ed` | fix: GMQ moyen KPI = LIVE.pesees (intervalles réels) + 1ère pesée / jours cycle |
| `6d4762c` | fix: _alertGmqChute not defined — recalculer dans scope viewDash |
| `1791066` | feat: ia+export — GMQ live contexte AI + incidents ouverts, GMQ live PDF |
| `5f66808` | feat: sidebar — gonogo score 8 + ggSante, GMQ semaine live, raccourci pesée gérant |
| `125e79c` | feat: marche — bugfix peseesBete, fraîcheur données reco, bouton reset simulateur |
| `be169ae` | feat: livrables — bugfix treso, KPI GMQ live, flux santé, gonogo santé G3, budget restant/jour |
| `d6ca102` | feat: saisie — alertes fiche NON, bugfix sante res, alerte pesée doublon, score SOP, GMQ bilan |
| `3cecd3f` | feat: dashboard — score santé incidents, alertes meteo/gmq/bilan/fin-cycle, treso cout-jour, bannières dismissables |
| `004a8d2` | feat: recommandations par bête + signal global achat/vente |
| `facdf90` | fix: gmqMoy not defined — utilise bete.gmq (scope correct) |
| `3eb6f53` | fix: loadPrix SID fondateur prioritaire + chTab marche refresh + gmqMoy global |
| `ebb4982` | fix: courbe croissance — date slice 0-5, tri chronologique DD/MM/YYYY |
| `b4dbd5a` | fix: pesée dropdown — LIVE.beteIds conserve toutes les bêtes après soumission |
| `f9ebd8f` | docs: maj README + AI_RESUMPTION_PROMPT |
| `39b0e25` | marche: simplify chart — hero price + trend badge + clean line |
| `daadc18` | fix: dateTimeRenderOption=FORMATTED_STRING |
| `eb181ef` | feat: onglet marché — band chart, filtre foirail, seuil rentabilité simulateur |
