# BOAN — Application de Gestion d'Élevage Bovin

Application web mobile de gestion d'élevage bovin pour la **Ferme BOAN** (Thiès, Sénégal).  
Pilotage à distance multi-rôles : direction, gérant terrain, RGA, commerciale.

**Production** → https://boan-app-ur3x.vercel.app  
**Stack** : Vanilla JS ES5 · Vercel Serverless · Google Sheets API v4  
**État** : commit `dd5c3c7` — ~7 436 lignes — Avril 2026

---

## Rôles et accès

| Rôle | Identifiant | Onglets | Description |
|---|---|---|---|
| Fondateur / Direction | `fondateur` | Dashboard · Saisie · Livrables · Marché · Guide | Lecture/écriture total, configuration, clôture cycle |
| Gérant terrain | `gerant` | Dashboard · Saisie · Guide | Saisies quotidiennes terrain |
| RGA | `rga` | Dashboard · Livrables · Marché · Guide | Analyse, contrôle, recommandations |
| Commerciale | `fallou` | Dashboard · Marché · Guide | Veille prix foirail et aliments |

---

## Fonctionnalités

### Saisies quotidiennes (gérant / fondateur)
- **Fiche journalière** — nb bêtes, alimentation, eau, état enclos, alertes si nourris=NON ou eau=NON
- **Checklist SOP** — vérification procédures (nettoyage, désinfection, quarantaine…) + score compliance X/6
- **Mouvements de stock** — ajout, consommation, inventaire aliments, rapport mensuel partageable
- **Pesées** — poids individuel par bête, calcul GMQ sur intervalles réels inter-pesées, alerte doublon
- **Santé / Mortalité** — symptômes, traitement, coût, issue (décès → filtre automatique des bêtes décédées)
- **Incidents** — signalement avec gravité, action corrective, clôture
- **Bilan hebdo** — pré-rempli GMQ moyen + nb pesées, envoi vendredi avant 20h

### Tableau de bord (tous rôles)
- **4 KPI cards** — bêtes actives, GMQ live (intervalles réels, badge vert/orange/rouge), semaines de stock, trésorerie
- **Score santé troupeau** — GMQ (50pts) + Stock (30pts) + Bêtes (20pts) − malus incidents ouverts
- **Alertes intelligentes** — fiche manquante, stock critique, pesée en retard, GMQ chute 2 sem., incidents ouverts, bilan retard, fin cycle ≤2 sem., météo ≥38°C
- **Sparklines** — tendance 7 points par indicateur
- **Météo Thiès** — température, pluie, vent temps réel (Open-Meteo) + prévisions 7 jours
- **Guide gérant interactif** — modal "Quoi faire et quand" avec état dynamique des tâches (gérant uniquement)
- **Rapport WhatsApp** — synthèse journalière partageable
- **Analyse IA** — Claude Sonnet (fondateur uniquement)

### Livrables (fondateur / RGA)
- **Trésorerie** — flux réels (frais santé datés, achat veaux, burn rate vs cible, projection fin cycle)
- **KPI** — barres GMQ / stock / bêtes / poids / projection CA vs objectifs configurables
- **Bêtes** — courbes de croissance individuelle, IC (indice consommation), GMQ prédictif (régression linéaire), seuil rentabilité/bête
- **Incidents** — liste avec gravité, statut, clôture
- **Go/No-Go** — checklist 8 critères pour décision de vente
- **Objectifs configurables** (fondateur + RGA) :
  - Zootechniques : GMQ cible/alerte, poids cible, poids vente min, taux mortalité max
  - Financiers : coût revient max, marge min/bête, plancher tréso
  - **Marché & Ration** *(nouveau)* : prix aliment mid-cycle, prix vente visé, mix son/tourteau lié (total=100%), badge date de modification
  - **Protocole SOP vétérinaire** : éditeur complet ajout/modification/suppression étapes J+N, types santé/pesée, réinitialisation standard
  - Persistance → `Config_App` Google Sheets, propagation immédiate dans tous les KPI
- **SOP Véto** — calendrier timeline des actes J+N calculés depuis `CYCLE.dateDebut`, statuts OK/alerte/retard/planifié, tolérance ±7 jours
- **Cycles archivés** *(nouveau)* — historique de tous les cycles clôturés dans `Historique_Cycles` (snapshot automatique avant reset)

### Marché (fondateur / RGA / Commerciale)
- **Prix foirail** — hero card prix max/min + tendance + vs objectif + courbe historique 10 derniers relevés
- **Prix aliments** — suivi prix par type (son de blé, tourteau, fane…) + historique + rapport mensuel partageable
- **Simulateur** — seuil de rentabilité, projection bénéfice/bête, badge vs seuil marché
- **Recommandations** — signal achat/vente basé saisonnalité, cartes par bête triées urgence, projection date atteinte poids cible

### Persistance et mode offline
- **Double couche** : localStorage (cache immédiat) + Google Sheets (source de vérité)
- **Seed au démarrage** : `MOCK.betes` et `MOCK.treso` seedés depuis le cache localStorage avant la sync Sheets — zéro flash au chargement
- **Queue offline** : saisies mises en file si connexion absente, synchronisées à la reconnexion
- **Historique cycles** : archivage snapshot automatique (nb bêtes, GMQ, marge, poids, dates) avant chaque clôture de cycle

### Guides intégrés *(nouveau)*
- **Onglet Guide** dans chaque rôle — contenu opérationnel calibré par rôle
- **4 guides HTML imprimables** dans `/guides/` — exportables en PDF depuis le navigateur :
  - `guides/fondateur.html` — checklist cycle, pilotage hebdo, décision vente, limites du modèle
  - `guides/gerant.html` — rythme quotidien, urgences, contacts à remplir (plastifiable)
  - `guides/rga.html` — contrôle hebdo/mensuel, lexique économique, escalade
  - `guides/fallou.html` — cadence relevés, lire un prix foirail, signaux vente

---

## Structure du projet

```
Boan-app/
├── index.html              SPA complète (HTML + CSS + JS inline, ~7 436 lignes)
├── vercel.json             Rewrites SPA (exclut /api/ et /manifest.json)
├── manifest.json           Web App Manifest (PWA — icône, nom, display:standalone)
├── api/
│   ├── auth.js             Login multi-rôle + SID multi-sheet par rôle
│   ├── token.js            Service Account → Google OAuth2 access token
│   ├── sheets.js           Proxy lecture/écriture Google Sheets
│   ├── change-password.js  Modification credentials (fondateur)
│   └── ai.js               Proxy Anthropic Claude
├── guides/
│   ├── fondateur.html      Guide PDF imprimable — Direction
│   ├── gerant.html         Guide PDF imprimable — Gérant terrain
│   ├── rga.html            Guide PDF imprimable — RGA
│   └── fallou.html         Guide PDF imprimable — Commerciale
├── README.md               Ce fichier
├── DOCUMENTATION_TECHNIQUE.md   Architecture et référence développeur
└── AI_RESUMPTION_PROMPT.md      Prompt de reprise IA
```

---

## Google Sheets requis

| Onglet | Spreadsheet | Description |
|---|---|---|
| `Config_Cycle` A1:R1 | Fondateur | dateDebut, nbBetes, poidsDepart, race, ration, capital, objectifPrix, budgetSante, vétérinaire, foirail, commission, contactUrgence, peseeFreq, betes(JSON), stockLines(JSON), dureeMois, simCharges(JSON), prixAlim |
| `Config_App` A:B | Fondateur | Clé-valeur : gmqCible, gmqWarn, poidsCible, poidsVenteMin, tauxMortMax, coutRevientMax, margeParBeteMin, alerteSeuilTreso, mixSon, mixTourteau, prixAlim, objectifPrix, _mktUpdated, sopProtocol(JSON), dureeMois, cycleDebut |
| `Historique_Cycles` A:N | Fondateur | Début, Fin, Durée, Race, Foirail, NbBêtesDépart, NbBêtesFin, Décès, PoidsDépart, PoidsFin, GMQ, Capital, TrésoFin, Marge/tête *(à créer manuellement)* |
| `Fiche_Quotidienne` | Gérant + Fondateur | Saisies journalières |
| `SOP_Check` | Gérant + Fondateur | Checklist SOP quotidienne |
| `Pesees` | Gérant + Fondateur | Pesées individuelles par bête |
| `Stock_Nourriture` | Gérant + Fondateur | Mouvements de stock aliments |
| `Incidents` | Gérant + Fondateur | Signalements incidents |
| `Sante_Mortalite` | Gérant + Fondateur | Soins + décès (col G = OUI → bête décédée) |
| `Hebdomadaire` | Gérant + Fondateur | Bilans hebdomadaires |
| `KPI_Mensuels` | Fondateur | Trésorerie réelle mensuelle (col H) |
| `Suivi_Marche` | Fallou + Fondateur | Prix foirail (Date, Foirail, Bas, Moy, Haut) |
| `Suivi_Aliments` | Fondateur + RGA + Fallou | Prix aliments (Date, Type, Prix/kg) |

---

## Configuration Vercel

Variables d'environnement → Settings → Environment Variables :

```
PWD_FONDATEUR     Mot de passe fondateur
PWD_GERANT        Mot de passe gérant
PWD_RGA           Mot de passe RGA
PWD_FALLOU        Mot de passe commerciale

SID_FONDATEUR     ID Google Spreadsheet fondateur
SID_GERANT        ID Google Spreadsheet gérant
SID_RGA           ID Google Spreadsheet RGA
SID_FALLOU        ID Google Spreadsheet commerciale

SA_PRIVATE_KEY    Clé privée RSA Service Account (\n pour les sauts de ligne)
SA_CLIENT_EMAIL   Email du Service Account Google

SESSION_SECRET    Secret HMAC session (>= 32 caractères aléatoires)
ANTHROPIC_API_KEY Clé Anthropic (optionnel — IA fondateur)
```

---

## Déploiement

```powershell
git clone https://github.com/diopcmd/Boan-app.git
cd Boan-app

# Après toute modification
git add index.html
git commit -m "type: description"
git push origin main
# Vercel déploie automatiquement en 30-60 secondes
```

---

## Historique des commits récents

| Commit | Description |
|---|---|
| `dd5c3c7` | fix: MOCK.betes seed depuis localStorage au démarrage + guides MAJ |
| `14468d4` | feat: onglet Guide par rôle + 4 guides HTML imprimables PDF |
| `7db6560` | feat: Objectifs — card Marché & Ration (prixAlim + objectifPrix + mix ration + badge date) |
| `5a0ca03` | feat: Historique_Cycles — snapshot avant reset + vue fondateur/rga |
| `fa31f67` | fix: MOCK.betes=4 persistant — sync CYCLE.nbBetes, decesV2, saveCycle cols Q+R |
| `8f676ef` | fix: cycle non démarré (dateDebut vide modale), GMQ diviseur peseeFreq, parseISO dates locales |
| `feb37fe` | fix: thèmes sombre/clair — sélecteurs body.light, sidebar statuts, contraste, typo |
| `0806fda` | fix: CORS auth.js — autoriser *.vercel.app et same-origin |
| `79eb9a5` | refactor: SOP centralisé — calendrier fusionné dans sopvet (Livrables) |
| `c737d6c` | audit: 14 recommandations experts — sécurité, SOP, BCS, GMQ adaptatif, alertes prix |

---

## Documentation

| Fichier | Contenu |
|---|---|
| [DOCUMENTATION_TECHNIQUE.md](DOCUMENTATION_TECHNIQUE.md) | Architecture détaillée, patterns de code, référence API |
| [AI_RESUMPTION_PROMPT.md](AI_RESUMPTION_PROMPT.md) | Prompt de reprise pour continuer avec une IA |
| [guides/fondateur.html](guides/fondateur.html) | Guide opérationnel PDF — Direction |
| [guides/gerant.html](guides/gerant.html) | Guide opérationnel PDF — Gérant terrain |
| [guides/rga.html](guides/rga.html) | Guide opérationnel PDF — RGA |
| [guides/fallou.html](guides/fallou.html) | Guide opérationnel PDF — Commerciale |
