# BOAN — Application de Gestion d'Élevage Bovin

Application web mobile de gestion d'élevage bovin pour la **Ferme BOAN** (Thiès, Sénégal).  
Pilotage à distance multi-rôles : direction, gérant terrain, RGA, commerciale.

**Production** → https://boan-app-ur3x.vercel.app  
**Stack** : Vanilla JS ES5 · Vercel Serverless · Google Sheets API v4  
**État** : commit `61fc2c0` — ~8 000 lignes — Avril 2026

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
  - **Protocole SOP vétérinaire** *(dans onglet Livrables > SOP Véto)* : éditeur complet ajout/modification/suppression étapes J+N, types santé/pesée, réinitialisation standard. Persisté via `saveObjectifs()`.
- **SOP Véto** — calendrier timeline des actes J+N calculés depuis `CYCLE.dateDebut` :
  - Statuts : ✅ réalisé / ⚠️ en retard / 🔔 dans 7j / 📅 planifié
  - Tolérance ±7 jours (comptent dans la conformité) ; seuil 8–21j = orange "hors délai"
  - Actes Santé : formulaire inline bête par bête ou "🐄 Toutes les bêtes restantes" en 1 clic
  - Suivi **par bête** : badge 🔄 X/N traitées (partiel) / ✅ N/N traitées (complet) — une bête traitée ne valide plus TOUTES les bêtes
  - Champ `sopLabel` sur chaque entrée SOP → isole les étapes proches (ex: Vitamine J+1 vs Déparasitage J+7 ne se valident plus mutuellement)
  - Pesée SOP → formulaire pesée avec bannière contextuelle J+N
  - Éditeur du protocole (onglet SOP Véto) : ajout/modif/suppression étapes, persisté dans `Config_App` — **fondateur uniquement**
- **Cycles archivés** — historique de tous les cycles clôturés dans `Historique_Cycles` (snapshot automatique avant reset, colonnes A:O incl. N° de cycle)
- **Numéro de cycle** — `CYCLE.numCycle` éditable par le fondateur (modal init + onglet Objectifs) ; IDs bêtes préfixés `Cx-NNN` ; affiché sur le dashboard hero card

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
├── index.html              SPA complète (HTML + CSS + JS inline, ~8 200 lignes)
├── vercel.json             Rewrites SPA (exclut /api/ et /manifest.json)
├── manifest.json           Web App Manifest (PWA — icône, nom, display:standalone)
├── sw.js                   Service Worker (cache offline)
├── README.md               Ce fichier
│
├── api/
│   ├── auth.js             Login multi-rôle + SID multi-sheet par rôle
│   ├── token.js            Service Account → Google OAuth2 access token
│   ├── sheets.js           Proxy lecture/écriture Google Sheets
│   ├── change-password.js  Modification credentials (fondateur)
│   └── ai.js               Proxy Anthropic Claude
│
├── guides/
│   ├── fondateur.html      Guide PDF imprimable — Direction
│   ├── gerant.html         Guide PDF imprimable — Gérant terrain
│   ├── rga.html            Guide PDF imprimable — RGA
│   └── fallou.html         Guide PDF imprimable — Commerciale
│
├── docs/
│   ├── DOCUMENTATION_TECHNIQUE.md   Architecture et référence développeur
│   ├── AI_RESUMPTION_PROMPT.md      Prompt de reprise IA (contexte session)
│   └── NOTIFICATIONS_ROADMAP.md     Roadmap notifications CNAAS + vétérinaire
│
└── scripts/
    └── boan_sheets_format.gs        Script Google Apps Script (mise en forme Sheets)
```

---

## Google Sheets requis

| Onglet | Spreadsheet | Description |
|---|---|---|
| `Config_Cycle` A1:S1 | Fondateur | dateDebut, nbBetes, poidsDepart, race, ration, capital, objectifPrix, budgetSante, vétérinaire, foirail, commission, contactUrgence, peseeFreq, betes(JSON), stockLines(JSON), dureeMois, simCharges(JSON), prixAlim, **numCycle** |
| `Config_App` A:B | Fondateur | Clé-valeur : gmqCible, gmqWarn, poidsCible, poidsVenteMin, tauxMortMax, coutRevientMax, margeParBeteMin, alerteSeuilTreso, mixSon, mixTourteau, prixAlim, objectifPrix, _mktUpdated, sopProtocol(JSON), dureeMois, cycleDebut, **numCycle** |
| `Historique_Cycles` A:O | Fondateur | Début, Fin, Durée, Race, Foirail, NbBêtesDépart, NbBêtesFin, Décès, PoidsDépart, PoidsFin, GMQ, Capital, TrésoFin, Marge/tête, **N° cycle** *(à créer manuellement)* |
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
| `61fc2c0` | fix: sopLabel sur entrées SOP — Vitamine ADE et Déparasitage ne se valident plus mutuellement |
| `f95b166` | fix: variables persistantes à l'init cycle — gonogo, simCharges, _mktUpdated, S._sop*, LIVE._histCycles |
| `c357a07` | fix: numCycle input sans r() (clavier stable) + suppression carte SOP dans Objectifs |
| `d44e161` | fix: lire Historique_Cycles A:O (colonne numCycle ajoutée) |
| `6fb1b19` | feat: numCycle manuel — init modal, dashboard, IDs bêtes, archivage, Config_App/Cycle |
| `32c081e` | feat: SOP per-bête — badge 🔄 X/N, Toutes les bêtes restantes, _sopInlineSave(idx, tous) |
| `8599ed6` | feat: SOP veto inline form + seuil 21j + compteur double |
| `2d7eebe` | fix: cohérence GMQ — toutes les formules inline unifiées vers MOCK.gmq (source canonique) |
| `7acd693` | fix: SOP véto validation — 3 niveaux selon délai (OK / avertissement 8-14j / bloqué >14j) |
| `85d7e9f` | fix: cohérence dashboard KPI vs sidebar — tréso seuil dynamique, score santé gmqCible, cycle N° |
| `75f1f1e` | feat: guide retour dashboard, fix C003 deceased cycle, SOP véto valider gérant, formules PDF |
| `176d369` | docs: mise à jour avril 2026 — commit dd5c3c7, 7436 lignes |
| `dd5c3c7` | fix: MOCK.betes seed depuis localStorage au démarrage + guides MAJ |
| `14468d4` | feat: onglet Guide par rôle + 4 guides HTML imprimables en PDF |
| `7db6560` | feat: Objectifs — card Marché & Ration (prixAlim + objectifPrix + mix ration lié + badge date) |
| `5a0ca03` | feat: Historique_Cycles — snapshot avant reset + vue fondateur/rga |
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
