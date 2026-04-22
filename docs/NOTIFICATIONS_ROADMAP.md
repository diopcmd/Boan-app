# BOAN — Roadmap Notifications & Sinistres
> **Version 3.1 — Corrections post-audit incohérences — 22 Avril 2026**
> Statut : **BLOQUÉ — Prérequis métier non satisfaits** (voir section 0)
> Panel de révision :
>   🚔 Adj. Chef Mbaye — Gendarmerie Brigade Thiès
>   📋 M. Diouf — Agent CNAAS Dakar
>   🩺 Dr Sow — Vétérinaire agréé région Thiès
>   🤠 Oumar — Gérant terrain ferme bovine Thiès
>   ⚖️ Maître Diallo — Juriste droit CIMA / assurance agricole Dakar
>   🌍 Dr Fernandez — DG ferme internationale (Sénégal/Espagne)
>
> **Référence code** : `index.html` ~9 030 lignes, ES5 strict (`var`, pas `const`/`let`/arrow).
> Commit HEAD : `407c7a7`. App en prod : `https://boan-app-9u5e.vercel.app`

---

## Sommaire

| # | Section | Contenu | Public cible |
|---|---|---|---|
| 0 | [Prérequis métier](#0-prérequis-métier---bloquants-avant-tout-code) | Ce qu'il faut avoir **avant** tout code | Fondateur |
| 1 | [Schémas de données](#1-schémas-de-données-google-sheets) | Structure `Notifications_Log` + `Sinistres_CNAAS` | Développeur |
| 2 | [Processus métier](#2-processus-métier-bout-en-bout) | Flux complets décès / VOL / SOP vétérinaire | Tous |
| 3 | [Interface utilisateur](#3-interface-utilisateur---modifications-indexhtml) | Modifications `index.html` | Développeur |
| 4 | [API serveur](#4-api-serveur) | Code `/api/cron.js` + `/api/notify.js` | Développeur |
| 5 | [Templates emails](#5-templates-emails-plain-text-strict) | Textes emails prêts à intégrer | Développeur |
| 6 | [Templates WhatsApp](#6-templates-whatsapp) | Messages WA pré-remplis | Développeur |
| 7 | [Pièces CNAAS](#7-pièces-cnaas---table-de-référence) | Checklist documents dossier | Fondateur · RGA |
| 8 | [Checklist implémentation](#8-checklist-dimplémentation) | BLOC A/B/C/D/E à cocher | Développeur |
| 9 | [Statut actuel](#9-statut-actuel) | Ce qui est fait / manque | Tous |
| 10 | [KPIs sinistres](#10-kpis-sinistres--qualité-dossier---recommandations-panel) | Métriques qualité + export PDF + photo initiale | Fondateur · RGA |
| **11** | **[Guides opérationnels](#11-guides-opérationnels-par-rôle)** | **Guides fondateur / gérant / RGA + SOP — issus du panel** | **Fondateur · Gérant · RGA** |

> 💡 **Lecteur non-technique** : commencer par la **section 11** (guides par rôle), puis la **section 0** (prérequis) et la **section 7** (pièces CNAAS).

---

## 0. Prérequis métier — BLOQUANTS avant tout code

> ⛔ Sans ces éléments, le système tourne à vide ou produit des déclarations invalides.

### 0.1 Vétérinaire attitré (Thiès)
Contractualiser un vétérinaire agréé région de Thiès :
- Rôle : suivre le troupeau selon le SOP + **signer le certificat de constatation du décès** (pièce CNAAS obligatoire)
- Coordonnées requises : nom, email, +221XXXXXXXXX (WhatsApp = canal principal terrain)
- ⚠️ Sans certificat vét → dossier CNAAS rejeté

> **Déjà dans l'app** : `CYCLE.veterinaire` (clé `veterinaire` dans `Config_Cycle`, col I). Ne pas recréer.

### 0.2 Contrat CNAAS
Contacter CNAAS (siège Dakar ou agence Thiès) et obtenir :
- Police **"Assurance Mortalité Bétail Tout Risque"** souscrite AVANT tout sinistre
- Numéro de police exact
- Email officiel de déclaration sinistres + téléphone agent Thiès
- **Délai de déclaration contractuel** : Code CIMA = 5 jours **ouvrables** (pas calendaires) standard. Certaines polices imposent 24h — lire la police. L'email J+0 horodaté sert de preuve dans tous les cas.
- Liste exacte des pièces requises
- **Grille officielle d'indemnisation** par race/classe d'âge (`poids × prix_foirail` sera rejeté)
- **Franchise** : typiquement **10% de la valeur indemnisée** — à vérifier dans la police. Si animal assuré à 800 000 FCFA, indemnisation nette = 720 000 FCFA.
- **Délai d'indemnisation réel** : **30 à 60 jours calendaires** après dossier complet accepté. Dossiers contestés : jusqu'à 6 mois. Communiquer cette expectation réaliste au fondateur.
- **Exclusions fréquentes à vérifier à la souscription** :
  - Maladie non déclarée lors de la souscription de la police
  - Animaux non vaccinés selon le protocole SOP défini dans la police ← les enregistrements SOP de BOAN constituent la preuve de vaccination
  - Cause de mort exclue (ex: certaines épizooties selon la police)
  - Sinistre déclaré hors délai contractuel

> **Déjà dans l'app** : `CYCLE.numCnaas` (clé `numCnaas` dans `Config_App` — modal init step 2 + Go/No-Go, commit `9766040`). Ne pas recréer.

### 0.3 Clause critique : NE PAS ABATTRE NI ENTERRER
La CNAAS exige que l'animal décédé reste intact jusqu'au passage de leur expert.
- ⚠️ **Chaleur Thiès 35–40°C : décomposition visible dès 6-8h.** Après **24-36h**, risque sanitaire réel et état présentable à l'expert compromis. Ne pas attendre 48h.
- Si l'expert CNAAS n'est pas arrivé dans les **24-36h** → appeler l'agent CNAAS Thiès **par téléphone** pour obtenir une **autorisation d'inhumation d'urgence**.
- ⚠️ **PROCÉDURE OBLIGATOIRE avant inhumation** :
  1. Appel vocal agent CNAAS Thiès
  2. Confirmation par SMS ou email (preuve écrite horodatée)
  3. Prendre des photos datées toutes les 6h pour documenter l'état de l'animal
  4. N'enterrer qu'après confirmation écrite reçue
- 🚨 **Inhumation sans autorisation écrite = risque de rejet du dossier + risque de qualification en destruction de preuve (art. Code CIMA)**
- L'app affiche une bannière rouge persistante dès qu'un décès est saisi.

### 0.4 Coordination vétérinaire / expert CNAAS
> ⚠️ **Dépendance critique** : le certificat vétérinaire doit être disponible LORS du passage de l'expert CNAAS. Le vétérinaire terrain Thiès arrive en J+5-7 réel. L'expert CNAAS peut venir plus tôt.
>
> **Mitigation** : l'email CNAAS J+0 demande explicitement de coordonner la date expert avec la venue du vétérinaire. L'appel vocal fondateur J+0 aligne les deux rendez-vous. L'app affiche une alerte croisée si les dates prévues sont incohérentes.

### 0.5 Infrastructure technique
- [ ] Compte SendGrid + Single Sender Verification (adresse fondateur acceptée — domaine propre non requis)
- [ ] `SENDGRID_API_KEY` dans les variables d'environnement Vercel
- [ ] `CRON_SECRET` dans les Secrets Vercel + GitHub
- [ ] `SID_FONDATEUR` dans les Variables Vercel (valeur de `SID.fondateur` dans l'app)
- [ ] Onglets `Notifications_Log` et `Sinistres_CNAAS` → **auto-créés au 1er run cron** (section 4.1)

### 0.6 Police / Gendarmerie — Procédure VOL : ce que l'app doit savoir

> Synthèse issue du panel terrain — Adj. Chef Mbaye, Gendarmerie Brigade Thiès

**Fenêtre de poursuite chaude : 48 heures absolues**
- Dans les 48h suivant le constat de vol, la gendarmerie peut déclencher une traque active (patrouilles, appels réseaux inter-brigades). Au-delà, les chances de retrouver les animaux tombent à 10-15%.
- **L'app doit capturer l'heure exacte** de découverte du vol — pas seulement la date. Un chronomètre de compte à rebours 48h doit s'afficher dans la bannière dashboard gérant dès qu'un vol est saisi.

**Récépissé ≠ N° PV**
- Le gérant ressort de la gendarmerie avec un **récépissé tamponné** — immédiat.
- Le **procès-verbal officiel** avec numéro est établi par l'officier en 24-72h.
- BOAN doit distinguer les deux dans `Sinistres_CNAAS` et accepter la déclaration CNAAS dès que le récépissé est obtenu (le N° PV sera ajouté ultérieurement).

**Horaires Brigade de Gendarmerie Thiès**
- Accueil public : 07h00–22h00 en général
- Nuit/urgence : appel téléphonique direct au permanencier de la brigade
- ⚠️ Les week-ends et jours fériés peuvent allonger le délai de rédaction du PV

**Inventaire photographique initial — recommandation forte**
- Photographier chaque bête à son entrée dans le cycle (face, profil, marques distinctives, tatouage/boucle auriculaire)
- En cas de vol, la gendarmerie peut diffuser le signalement avec photos
- En cas de litige identitaire CNAAS, la photo est preuve irréfutable
- **Implémentation BOAN** : ajouter `photoRef` dans `CYCLE.betes[i]` — une URL WhatsApp ou un lien Google Drive suffit

**Pièces à transmettre à la gendarmerie (copie dans BOAN)**
```
- Identité propriétaire (fondateur)
- Inventaire animaux volés : ID, race, poids, couleur, marques
- Heure vol + heure découverte (distincts)
- Circonstances (clôture forcée ? Veilleur présent ?)
- Témoin(s) éventuel(s)
- Photos inventaire initial si disponibles
```

---

## 1. Schémas de données Google Sheets

### 1.1 `Notifications_Log` (Sheet fondateur — auto-créé)

| Col | Nom | Valeurs |
|---|---|---|
| A | Date_Envoi | YYYY-MM-DD HH:MM |
| B | Type | `SOP_VET_J-3` `SOP_VET_J-2` `SOP_VET_J-1` `VET_DECES_J0` `VET_DECES_RAPPEL_J1` `CNAAS_DECES_J0` `CNAAS_VOL_J0` `CNAAS_RELANCE_J7` `CNAAS_RELANCE_J14` `VET_ERROR` `VET_SKIPPED` |
| C | Reference_ID | Clé idempotence ex: `SOP_VET_J-1_pesee-j30_2026-04-21` |
| D | Destinataire | email |
| E | Canal | `EMAIL` |
| F | Statut | `PENDING` `SENT` `ERROR` `ERROR_TIMEOUT` `CONFIRME` `SKIPPED` `INCOMPLET_POLICE` |
| G | Tentative_N | entier |
| H | Date_Confirmation | YYYY-MM-DD — bouton "Vét a confirmé" ou "CNAAS a confirmé" |
| I | Notes | texte libre — erreurs, infos |

### 1.2 `Sinistres_CNAAS` (Sheet fondateur — auto-créé)

| Col | Index | Nom | Valeurs / Notes |
|---|---|---|---|
| A | 0 | Date | DD/MM/YYYY — date du sinistre |
| B | 1 | Type | `DECES` `VOL` |
| C | 2 | ID_Animal_s | `C1-001` ou `C1-001,C1-002` (multi pour VOL) |
| D | 3 | N_Recepisse | VOL — N° récépissé tamponné — **obligatoire J+0** |
| E | 4 | Statut_CNAAS | `EN_COURS` `DOSSIER_RECU` `EXPERT_ASSIGNE` `EXPERTISE_PASSEE` `CONFIRME` `REJETE` `CLOTURE` `ANNULE` |
| F | 5 | Date_Email_J0 | YYYY-MM-DD |
| G | 6 | Appel_Fondateur_J0 | date/heure appel vocal fondateur — **saisi manuellement** |
| H | 7 | Certif_Vet_Recu | `OUI` / vide |
| I | 8 | Expert_Passe | `OUI` / vide |
| J | 9 | Relances_Stop | `OUI` / vide |
| K | 10 | email_pending | `OUI` / `NON` — flag décès offline, lu par le cron |
| L | 11 | Date_Visite_Vet_Prevue | YYYY-MM-DD — saisi par fondateur après appel J+0 |
| M | 12 | Date_Visite_Expert_CNAAS_Prevue | YYYY-MM-DD — saisi par fondateur après appel CNAAS J+0 |
| N | 13 | N_PV_Officiel | VOL — N° PV officiel — optionnel J+0, **obligatoire avant clôture** |
| O | 14 | Heure_Vol | HH:MM — heure supposée du vol (si connue) |
| P | 15 | Heure_Decouverte | HH:MM — heure constat gérant — **obligatoire pour VOL** |

> 🎨 **Convention couleur UI** (appliquée dans tout le code frontend) :
> | Couleur | Code | Usage |
> |---|---|---|
> | 🔴 Rouge foncé | `#2a0a0a` | Urgence absolue — décès non enterré, VOL < 6h restantes |
> | 🟠 Orange `border` | `#f0a500` | Alerte importante — SOP J-1, champ manquant, N° PV absent |
> | 🟡 Fond sombre | `#1a1a00` | Information non bloquante |
> | 🟢 Vert | `#25d366` | Action WhatsApp (couleur standard WA) |

---

## 2. Processus métier bout en bout

### 2.1 CAS DÉCÈS

```
J+0 — Gérant constate le décès

  ⚠️ AVANT DE SAISIR : photographier l'animal maintenant
     ⛔ NE PAS ABATTRE NI ENTERRER — attendre expert CNAAS

  1. Gérant saisit dans BOAN (Saisie > Santé, décès = OUI)
     → App affiche bannière rouge ⛔ + alerte photo dès décès = OUI

  [Si ONLINE au submit]
  2a. App écrit Sante_Mortalite via writeAll([gerant, fondateur, rga])
  2b. App crée ligne Sinistres_CNAAS (email_pending=OUI) dans sheet fondateur
  2c. Cron 07h02 du lendemain envoie emails VET + CNAAS

  [Si OFFLINE au submit]
  2a. App écrit dans OFFLINE_QUEUE (flushQueue au retour connexion)
  2b. App stocke lsSet('deces_pending', {id,date,sym,tra,cout,ts})
  2c. Au retour connexion : flushQueue() + createSinistrePending()
      → ligne Sinistres_CNAAS email_pending=OUI dans sheet fondateur
  2d. Cron suivant 07h02 envoie les emails

  3. App affiche post-submit :
     Modal : "✅ Dossier créé. ⚠️ APPEL VOCAL FONDATEUR OBLIGATOIRE"
     Boutons (par priorité) :
       1️⃣ 📞 Appeler CNAAS — tel:[contact_cnaas_tel]
       2️⃣ 📞 Appeler Vétérinaire — tel:[contact_vet_tel]
       3️⃣ 💬 WhatsApp Vétérinaire — wa.me msg 6.1
       ⚠️ Annuler (erreur de saisie) — visible **4 heures** (fenêtre validée panel — ⚖️ Maître Diallo)

J+0 — Fondateur reçoit notification
  4. Fondateur appelle CNAAS Thiès vocalement
     → Demande coordination date expert APRÈS venue vétérinaire
     → Note heure appel dans app (Sinistres_CNAAS col G)
  5. Fondateur appelle vétérinaire pour confirmer date de venue

J+1 — Cron 07h02 : checkAndSendDecesAlerts()
  6. Envoie email VET (section 5.2) + email CNAAS (section 5.3) si email_pending=OUI
  7. Si Date_Confirmation vide dans Notifications_Log : envoie rappel vét (section 5.2b)
  8. Si col M < col L dans Sinistres_CNAAS : notifie fondateur "⚠️ Expert avant vét"

Dashboard gérant (J+1 et au-delà)
  9. Si sinistres_ouverts[expertPasse=false] ET > 24h depuis le décès :
     → Bannière rouge + bouton WhatsApp vét (msg 6.8) — un tap, message pré-rempli

J+1 à J+5-7 — Vétérinaire constate
  10. Vétérinaire signe le certificat de constatation
  11. Fondateur scanne → joint par email de suivi "Suite dossier [ID]"
  12. Fondateur coche : ☑ Certif reçu + ☑ Certif transmis CNAAS le [date]

Expert CNAAS (J+5 à J+10)
  13. Expert CNAAS vient constater
  14. Fondateur coche : ☑ Expert passé → bannière NE PAS ENTERRER libérée
      → lsSet('sinistres_ouverts') expertPasse=true

Relances automatiques (cron 07h04, si Statut_CNAAS = EN_COURS)
  J+7  → Email relance courtois (section 5.5)
  J+14 → Email relance + notification fondateur "Appel vocal recommandé"

Clôture
  15. Fondateur clique "CNAAS a confirmé" → Statut_CNAAS = CLOTURE
```

### 2.2 CAS VOL

```
J+0 — Gérant constate le vol

  ⚠️ AVANT D'ALLER À LA GENDARMERIE :
     1. Photographier le lieu immédiatement (traces, accès forcé, survivants)
     2. Noter l'heure exacte de la découverte (≠ heure du vol supposé)
     3. Appeler le fondateur VOCALEMENT — ne pas attendre

  ⏱️ FENÊTRE CRITIQUE : 48 heures pour la poursuite chaude
     Chaque heure perdue réduit les chances de retrouver les animaux.
     Brigade Gendarmerie Thiès : 07h00–22h00 — urgence nuit : appel téléphonique.

  1. Gérant va IMMÉDIATEMENT à la gendarmerie de Thiès
     → Obtient un RÉCÉPISSÉ DE DÉPÔT DE PLAINTE (tamponné, immédiat)
     → Le N° PV officiel est établi par la gendarmerie en 24-72h ensuite
     → BOAN accepte le récépissé en J+0 — le N° PV peut être ajouté ultérieurement

  2. Gérant saisit dans BOAN (Saisie > Incident > type = VOL) :
     - Animaux concernés — beteMultiSelect() (sélection multiple)
     - Heure du vol (si connue) + Heure de découverte — champs distincts
     - N° récépissé gendarmerie — champ OBLIGATOIRE BLOQUANT
     - N° PV définitif — champ optionnel au J+0, obligatoire avant clôture dossier
     - Date/heure dépôt plainte, circonstances

  3. App envoie email CNAAS auto (section 5.4) + affiche :
     1️⃣ 📞 Appeler CNAAS    2️⃣ 💬 WhatsApp CNAAS (msg 6.5)

Relances automatiques (cron 07h04)
  J+7 + J+14 → Email relance courtois

Clôture
  4. Fondateur clique "CNAAS a confirmé réception"
```

### 2.3 SOP VÉTÉRINAIRE — rappels planifiés

```
Cron 07h00 quotidien — checkAndSendVetReminders()

  Pour chaque acte SOP :
    Si dateActe = today + 3j → email J-3 (section 5.1) + log
    Si dateActe = today + 2j → email J-2 (section 5.1) + log
    Si dateActe = today + 1j → email J-1 (section 5.1) + log
    → Skip si : acte validé OU vet_confirmed OU jour férié

Dashboard gérant (jour J-1)
  Bannière orange : "🔔 Vétérinaire demain — [acte.label]"
  Bouton WhatsApp (msg 6.7) — un tap, message pré-rempli
  → Flag lsSet('boanr_wa_vet_j1_[acteKey]_[YYYY-MM-DD]') après tap
```

---

## 3. Interface utilisateur — modifications index.html

### 3.1 Saisie > Santé (décès = OUI) — Gérant

| Élément | Détail | Déclencheur |
|---|---|---|
| Bannière rouge ⛔ NE PAS ABATTRE NI ENTERRER | Persistante dans la vue | `S.fsa.dec === 'OUI'` |
| Alerte photo 📸 Photographiez MAINTENANT | Au-dessus du bouton Enregistrer | `S.fsa.dec === 'OUI'` |
| Alerte prix foirail obsolète | "⚠️ Prix non mis à jour depuis N jours" | `_lastPrixLoad` > 30j |
| Alerte N° police absent | Soft warning — n'empêche pas le submit | `!CYCLE.numCnaas` |
| Modal post-submit | "✅ Dossier créé. ⚠️ APPEL VOCAL FONDATEUR OBLIGATOIRE" | Post-submit |
| 1️⃣ 📞 Appeler CNAAS | `tel:[contact_cnaas_tel]` | Post-submit |
| 2️⃣ 📞 Appeler Vétérinaire | `tel:[contact_vet_tel]` | Post-submit |
| 3️⃣ 💬 WhatsApp Vétérinaire | `wa.me/[contact_vet_tel]?text=...` msg 6.1 | Post-submit |
| ⚠️ Annuler — erreur de saisie | Visible **4 heures** — email correctif CNAAS | `Date.now() - lsGet('last_deces_ts') < 4*60*60*1000` |

**Logique submit décès — ajouts dans doSubmit('sante') :**
```js
// Si S.fsa.dec === 'OUI' :
lsSet('last_deces_ts', Date.now());
var _so = lsGet('sinistres_ouverts') || [];
_so.push({ id: S.fsa.id, date: td, expertPasse: false, ts: Date.now() });
lsSet('sinistres_ouverts', _so);
if (!ONLINE) {
  lsSet('deces_pending', { id: S.fsa.id, date: td,
    sym: safeTextClient(S.fsa.sym), tra: safeTextClient(S.fsa.tra),
    cout: S.fsa.cout, ts: Date.now() });
}
// window.addEventListener('online', ...) → si lsGet('deces_pending') : createSinistrePending()

function safeTextClient(s) {
  return String(s || '').replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
}
```

### 3.2 Saisie > Incident (type VOL) — Gérant

> 💡 **Règle clé** : le gérant revient de la gendarmerie avec un récépissé tamponné — pas encore le N° PV officiel (24-72h plus tard). BOAN accepte immédiatement avec le récépissé seul.

| Élément | Détail | Obligatoire |
|---|---|---|
| N° récépissé gendarmerie | Champ texte — **submit bloqué si vide** | ✅ OUI (J+0) |
| N° PV officiel | Champ texte — non bloquant J+0, ajout ultérieur | ⚠️ Avant clôture |
| Heure de découverte | `<input type="time">` — **submit bloqué si vide** | ✅ OUI |
| Heure du vol (si connue) | `<input type="time">` | Non |
| Date/heure dépôt plainte | Preuve délai | Non |
| Sélection bêtes concernées | `beteMultiSelect()` — helper section 3.8 | ✅ OUI |
| Post-submit | 1️⃣ 📞 Appeler CNAAS + 2️⃣ 💬 WhatsApp CNAAS (msg 6.5) | |

**Bloc brigade — affiché dans le modal post-submit VOL** (chaîne HTML) :
```js
// Insérer après les boutons CNAAS, fond orange doux #1a1200
html += '<div style="background:#1a1200;border:1px solid #f0a500;border-radius:8px;'
  + 'padding:12px;margin-top:12px">'
  + '<strong>🚔 Brigade Gendarmerie Thiès</strong><br>'
  + '<span style="color:#f0a500;font-size:13px">'
  + 'Accueil : 07h00–22h00 — Urgence nuit : appel téléphonique direct au permanencier'
  + '</span><br><br>'
  + '<span style="color:#aaa;font-size:12px">'
  + 'ℹ️ Vous avez le récépissé tamponné ? C\'est suffisant pour BOAN et la CNAAS.<br>'
  + 'Le N° PV officiel arrive en 24-72h — à ajouter ensuite dans Livrables > Incidents.'
  + '</span></div>';
```

**localStorage au submit VOL :**
```js
lsSet('vol_pending', {
  beteIds:          S.fin.beteIds,
  noRecepisse:      safeTextClient(S.fin.noRecepisse),
  heureDecouverte:  Date.now(),       // timestamp ms — base du chrono 48h
  heureVol:         S.fin.heureVol || '',
  dateVol:          td
});
```

**Initialisation** : ajouter dans le reset de `S.fin` (~L1899) :
```js
S.fin.beteIds = []; S.fin.noRecepisse = ''; S.fin.noVpOfficiel = '';
S.fin.heureDecouverte = ''; S.fin.heureVol = '';
```

### 3.3 Dashboard gérant — Bannières WhatsApp proactives

> **Règle navigateur** : `window.open()` WhatsApp est bloqué sur événement non-interactif.
> Le bouton doit être tapé par l'utilisateur — ne jamais appeler `window.open()` dans `r()`.

**Contexte A — Rappel vét J-1 SOP (bannière orange)**
Condition : `S.user === 'gerant'` ET acte SOP avec `dateActe = today + 1j` ET flag absent.

```js
function _checkVetJ1Banners() {
  if (S.user !== 'gerant') return '';
  var today = new Date();
  var demain = new Date(today.getTime() + 86400000);
  var demainISO = demain.toISOString().slice(0, 10);
  var dateDebut = CYCLE.dateDebut || '';
  if (!dateDebut) return '';
  var html = '';
  (CYCLE.sopProtocol || []).forEach(function(acte) {
    var dateActeISO = new Date(
      new Date(dateDebut + 'T00:00:00Z').getTime() + acte.j * 86400000
    ).toISOString().slice(0, 10);
    if (dateActeISO !== demainISO) return;
    var acteKey = String(acte.label || '').toLowerCase().replace(/\s+/g, '-');
    var flagKey = 'boanr_wa_vet_j1_' + acteKey + '_' + demainISO;
    if (lsGet(flagKey)) return;
    var vetTel = (lsGet('cfg_contact_vet_tel') || '').replace(/\D/g, '');
    var msg = encodeURIComponent(
      '\uD83D\uDD14 *BOAN \u2014 Rappel acte SOP demain*\n\nBonjour '
      + (CYCLE.veterinaire || 'Docteur') + ',\n\nActe : ' + acte.label
      + '\nDate : ' + demain.toLocaleDateString('fr-FR')
      + '\nTroupeau : ' + (CYCLE.betes || []).length + ' b\xEAtes actives\n\n'
      + 'Ferme BOAN \u2014 ' + (lsGet('cfg_contact_gerant_tel') || '')
    );
    var waUrl = vetTel ? 'https://wa.me/' + vetTel + '?text=' + msg : 'https://wa.me/?text=' + msg;
    html += '<div class="msg-load" style="border-left-color:#f0a500">'
      + '<strong>\uD83D\uDD14 V\xE9t\xE9rinaire demain</strong> \u2014 ' + acte.label
      + ' le ' + demain.toLocaleDateString('fr-FR')
      + '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">'
      + '<a href="' + waUrl + '" target="_blank" rel="noopener"'
      + ' onclick="lsSet(\'' + flagKey + '\',true);r();"'
      + ' style="background:#25d366;color:#fff;padding:7px 14px;border-radius:6px;'
      + 'text-decoration:none;font-size:13px">\uD83D\uDCAC Rappel WhatsApp</a>'
      + '<button onclick="lsSet(\'' + flagKey + '\',true);r();"'
      + ' style="background:#1a2e1a;color:#aaa;border:1px solid #2a4a2a;'
      + 'padding:7px 14px;border-radius:6px;font-size:13px;cursor:pointer">'
      + '\u2713 D\xE9j\xE0 pr\xE9venu</button>'
      + '</div></div>';
  });
  return html;
}
```

**Contexte B — Relance vét post-décès > 24h (bannière rouge)**

```js
function _checkDecesVetBanners() {
  if (S.user !== 'gerant') return '';
  var todayISO = new Date().toISOString().slice(0, 10);
  var html = '';
  (lsGet('sinistres_ouverts') || []).forEach(function(so) {
    if (so.expertPasse) return;
    var h = (Date.now() - (so.ts || 0)) / 3600000;
    if (h < 24) return;
    var flagKey = 'boanr_wa_vet_deces_relance_' + so.id + '_' + todayISO;
    if (lsGet(flagKey)) return;
    var vetTel = (lsGet('cfg_contact_vet_tel') || '').replace(/\D/g, '');
    var joursStr = Math.floor(h / 24) === 1 ? 'hier' : 'il y a ' + Math.floor(h / 24) + ' jours';
    var msg = encodeURIComponent(
      '\u26A0\uFE0F *BOAN \u2014 Relance certificat d\xE9c\xE8s*\n\nBonjour '
      + (CYCLE.veterinaire || 'Docteur') + ',\n\nLa b\xEAte ' + so.id
      + ' est d\xE9c\xE9d\xE9e ' + joursStr + '.\n'
      + 'Le dossier CNAAS attend votre certificat de constatation.\n'
      + '\u26D4 L\'animal n\'a pas \xE9t\xE9 enterr\xE9.\n\n'
      + 'Ferme BOAN \u2014 ' + (lsGet('cfg_contact_gerant_tel') || '')
    );
    var waUrl = vetTel ? 'https://wa.me/' + vetTel + '?text=' + msg : 'https://wa.me/?text=' + msg;
    html += '<div class="msg-err">'
      + '<strong>\u26A0\uFE0F D\xE9c\xE8s ' + so.id + '</strong>'
      + ' \u2014 V\xE9t\xE9rinaire non confirm\xE9 (' + Math.floor(h / 24) + 'j)'
      + '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">'
      + '<a href="' + waUrl + '" target="_blank" rel="noopener"'
      + ' onclick="lsSet(\'' + flagKey + '\',true);r();"'
      + ' style="background:#25d366;color:#fff;padding:7px 14px;border-radius:6px;'
      + 'text-decoration:none;font-size:13px">\uD83D\uDCAC Relancer v\xE9t\xE9rinaire</a>'
      + '<button onclick="lsSet(\'' + flagKey + '\',true);r();"'
      + ' style="background:#1a2e1a;color:#aaa;border:1px solid #3a2a2a;'
      + 'padding:7px 14px;border-radius:6px;font-size:13px;cursor:pointer">'
      + '\u2713 V\xE9t\xE9rinaire confirm\xE9</button>'
      + '</div></div>';
  });
  return html;
}
```

**Intégration dans viewDash() :**
```js
// En haut du contenu viewDash(), avant les KPI cards :
if (S.user === 'gerant') {
  var _waBanners = _checkVetJ1Banners() + _checkDecesVetBanners();
  if (_waBanners) html += '<div style="margin-bottom:12px">' + _waBanners + '</div>';
}
```

**Flags localStorage — TTL naturel (date dans la clé) :**

| Clé localStorage | Expire naturellement |
|---|---|
| `boanr_wa_vet_j1_[acteKey]_[YYYY-MM-DD]` | Le lendemain (date dans la clé change) |
| `boanr_wa_vet_deces_relance_[id]_[YYYY-MM-DD]` | Le lendemain |

### 3.4 Dashboard — Tous rôles

- Bannière rouge ⛔ : si `(lsGet('sinistres_ouverts')||[]).some(function(s){return !s.expertPasse;})`
- Badge numérique onglet Livrables (fondateur/rga) : `(LIVE.sinistres||[]).filter(function(r){return r[4]==='EN_COURS';}).length > 0`

**Contexte C — Fondateur : décès > 24h sans expert + risque décomposition (bannière rouge foncé)**

Condition : `S.user === 'fondateur'` ET sinistre ouvert dont `ts` > 24h ET `expertPasse = false`.

```js
function _checkDecesUrgenceFondateur() {
  if (S.user !== 'fondateur') return '';
  var html = '';
  (lsGet('sinistres_ouverts') || []).forEach(function(so) {
    if (so.expertPasse) return;
    var h = (Date.now() - (so.ts || 0)) / 3600000;
    if (h < 24) return;
    var cnaasTel = lsGet('cfg_contact_cnaas_tel') || '';
    var vetTel   = lsGet('cfg_contact_vet_tel') || '';
    var hArrondi = Math.round(h);
    // Fond #2a0a0a (rouge profond) si > 30h — sinon #1a0505
    var bg = h > 30 ? '#2a0a0a' : '#1a0505';
    html += '<div style="background:' + bg + ';border:1px solid #cc2200;border-radius:8px;'
      + 'padding:12px;margin-bottom:10px">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
      + '<span style="font-size:18px">⛔</span>'
      + '<strong style="color:#ff6666">' + so.id + ' — ' + hArrondi + 'h sans expert CNAAS</strong>'
      + '</div>'
      + '<div style="color:#ffaaaa;font-size:13px;margin-bottom:10px">'
      + '🩺 Chaleur Thiès : décomposition visible dès 6-8h. Après 24-36h, l\'expert ne peut plus constater correctement.'
      + '<br>Si l\'expert CNAAS n\'est pas confirmé, demander une <strong>autorisation d\'inhumation d\'urgence</strong>.'
      + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      + (cnaasTel ? '<a href="tel:+' + cnaasTel.replace(/\D/g,'') + '"'
        + ' style="background:#cc2200;color:#fff;padding:8px 14px;border-radius:6px;'
        + 'text-decoration:none;font-size:13px">📞 Appeler CNAAS — Autorisation urgence</a>' : '')
      + (vetTel ? '<a href="tel:+' + vetTel.replace(/\D/g,'') + '"'
        + ' style="background:#333;color:#fff;padding:8px 14px;border-radius:6px;'
        + 'text-decoration:none;font-size:13px">📞 Relancer vétérinaire</a>' : '')
      + '<button onclick="var so=lsGet(\'sinistres_ouverts\')||[];'
        + 'so.forEach(function(s){if(s.id===\'' + so.id + '\')s.expertPasse=true;});'
        + 'lsSet(\'sinistres_ouverts\',so);r();"
        + ' style="background:#1a2e1a;color:#aaa;border:1px solid #2a4a2a;'
        + 'padding:8px 14px;border-radius:6px;font-size:13px;cursor:pointer">✓ Vétérinaire confirmé</button>'
      + '</div></div>';
  });
  return html;
}
// Intégration dans viewDash() fondateur — avant les KPI cards :
// if (S.user === 'fondateur') {
//   var _urgBanner = _checkDecesUrgenceFondateur();
//   if (_urgBanner) html += '<div style="margin-bottom:12px">' + _urgBanner + '</div>';
// }
```

### 3.5 Livrables > "Contacts & Assurance" — Fondateur uniquement

Nouveau sous-onglet dans `viewLiv()`. Champs persistés dans `Config_App` via `_syncConfigApp()`.

> **Cache localStorage** : `_syncConfigApp()` doit écrire chaque valeur sous `lsSet('cfg_[key]', val)`
> pour accès client sans lecture Sheets (bannières WA, templates).

```
— Déjà dans l'app (ne pas recréer) :
  CYCLE.numCnaas     → clé 'numCnaas' dans Config_App
  CYCLE.veterinaire  → clé 'veterinaire' dans Config_Cycle

— Nouvelles clés Config_App à ajouter :
  contact_vet_email         email vétérinaire
  contact_vet_tel           +221XXXXXXXXX
  contact_cnaas_email       email CNAAS déclarations
  contact_cnaas_tel         téléphone agent CNAAS Thiès
  contact_cnaas_delai_h     délai contractuel en heures (120 = 5j ouvrables)
  ferme_email_expediteur    adresse "De:" SendGrid (verified sender)
  ferme_responsable_nom     nom fondateur
  ferme_responsable_tel     téléphone fondateur
  ferme_email_fondateur     email fondateur → CC tous emails
  contact_rga_email         email RGA → CC tous emails
  horaire_vet_dakar         HH:MM heure intervention (ex: 09:00)
  contact_gerant_tel        +221XXXXXXXXX — WA bannières dashboard gérant
  jours_fermes              JSON ["2026-06-16","2026-06-17","2026-03-30","2026-04-04","2026-08-15"]
                            (Tabaski ~16-17 juin, Aid ~30 mars, Indép. 4 avril, Assomption 15 août)
  cnaas_grille              JSON {zebu_senegalais_18_36m: 1200000, ...}
```

### 3.6 Livrables > Incidents — Fondateur/RGA

Extension du sous-onglet `incidents` existant :

| Élément | Détail |
|---|---|
| Bannière ⛔ NE PAS ENTERRER | Si ligne EN_COURS sans Expert_Passe=OUI |
| Timeline dossier | J+0 email / Appel fondateur / J+7 / J+14 (depuis LIVE.sinistres + LIVE.notifLog) |
| Champ Date visite vét prévue | → col L (index 11) Sinistres_CNAAS |
| Champ Date visite expert CNAAS prévu | → col M (index 12) |
| ⚠️ Alerte croisée dates | Si col M < col L → "Expert CNAAS prévu avant vét → risque rejet" |
| Statut CNAAS select | EN_COURS / DOSSIER_RECU / EXPERT_ASSIGNE / EXPERTISE_PASSEE / CONFIRME / REJETE |
| ☑ Certificat vét reçu | → col H (index 7) |
| ☑ Expert CNAAS passé | → col I (index 8) + `lsSet('sinistres_ouverts', ...)` expertPasse=true |
| Appel_Fondateur_J0 | Heure appel vocal — saisie manuelle → col G (index 6) |
| Bouton CNAAS confirmé réception | → Statut_CNAAS = CLOTURE |
| Bouton Arrêter les relances | → col J (index 9) = OUI |
| Bouton Annuler (4h) | → Statut = ANNULE + email correctif CNAAS |
| **Champ N° PV officiel** (VOL uniquement) | Visible si `Type = VOL` ET col N vide — `border:#f0a500` + label `⚠️ N° PV manquant — à compléter dès réception` → col N (index 13) |

**Réconciliation lsGet('sinistres_ouverts') depuis LIVE.sinistres :**
```js
function _reconcileSinistresOuverts() {
  var soLocal = lsGet('sinistres_ouverts') || [];
  if (!soLocal.length) return;
  var changed = false;
  soLocal.forEach(function(so) {
    if (so.expertPasse) return;
    (LIVE.sinistres || []).forEach(function(r) {
      // col C index 2 = ID_Animal_s, col I index 8 = Expert_Passe, col E index 4 = Statut
      var ids = String(r[2] || '').split(',');
      if (ids.indexOf(so.id) === -1) return;
      if (String(r[8]||'').toUpperCase() === 'OUI' || String(r[4]||'').toUpperCase() === 'CLOTURE') {
        so.expertPasse = true;
        changed = true;
      }
    });
  });
  if (changed) lsSet('sinistres_ouverts', soLocal);
}
// Appeler en fin de loadLiveData Vague 2, après LIVE.sinistres = rows
```

### 3.7 Livrables > SOP Vétérinaire — Fondateur/RGA

- Bouton "✓ Vétérinaire a confirmé" (acte dans les 7j) → `Date_Confirmation` dans Notifications_Log
- Timeline J-3/J-2/J-1 : ✓ envoyé / 🟢 confirmé / ⏳ en attente (depuis LIVE.notifLog)
- Bouton "🔔 Rappel urgent J-0" (gérant uniquement, jour J de l'acte) → wa.me/ msg 6.3

### 3.8 Helper beteMultiSelect() — VOL multi-bêtes

> `beteDropdown()` existant (L2902) génère un `<select>` unique — incompatible multi-sélection VOL.
> **Ajouter `S.fin.beteIds = []` dans le reset de S.fin (~L1899).**

```js
function beteMultiSelect() {
  var deceased = LIVE.deceased || [];
  var allIds = (CYCLE.betes || [])
    .filter(function(b) { return deceased.indexOf(b.id) === -1; })
    .map(function(b) { return b.id; });
  if (!allIds.length) {
    return '<div class="fg"><label>Bêtes concernées</label>'
      + '<div class="msg-err">Aucune bête disponible</div></div>';
  }
  var current = S.fin.beteIds || [];
  var html = '<div class="fg"><label>Bêtes concernées ('
    + current.length + ' sélectionnée' + (current.length > 1 ? 's' : '') + ')</label>'
    + '<div style="background:#0f1a0f;border:1px solid #2a4a2a;border-radius:8px;'
    + 'padding:8px;max-height:160px;overflow-y:auto">';
  allIds.forEach(function(id) {
    var chk = current.indexOf(id) !== -1;
    html += '<label style="display:flex;align-items:center;gap:10px;padding:5px 8px;cursor:pointer">'
      + '<input type="checkbox" ' + (chk ? 'checked ' : '')
      + 'onchange="var idx=S.fin.beteIds.indexOf(\'' + id + '\');'
      + 'if(this.checked&&idx===-1){S.fin.beteIds.push(\'' + id + '\');}'
      + 'else if(!this.checked&&idx!==-1){S.fin.beteIds.splice(idx,1);}r();">'
      + '<span style="font-size:14px">' + id + '</span></label>';
  });
  return html + '</div></div>';
}
// Submit VOL : S.fin.beteIds.join(',') → col C Sinistres_CNAAS
// Validation : if (!S.fin.beteIds.length) { showMsg('err','Sélectionner au moins une bête'); return; }
```

### 3.9 Chargement LIVE.sinistres + LIVE.notifLog (Vague 2)

```js
// Dans loadLiveData(), dans le Promise.all de la Vague 2 — fondateur/rga uniquement
if (S.user === 'fondateur' || S.user === 'rga') {
  readSheet(SID.fondateur, 'Sinistres_CNAAS!A2:Q200').then(function(rows) {
    LIVE.sinistres = rows || [];
    _reconcileSinistresOuverts();
  });
  readSheet(SID.fondateur, 'Notifications_Log!A2:I500').then(function(rows) {
    LIVE.notifLog = rows || [];
  });
}
```

> ⚠️ Range mis à jour : `A2:M200` → **`A2:Q200`** (schema étendu 16 colonnes — section 1.2).

### 3.10 Dashboard gérant — Chronomètre 48h VOL

> **Requis** par le process (sections 0.6 et 2.2) et le guide terrain (section 11.3).
> Affiché dans `viewDash()` gérant tant que `lsGet('vol_pending')` existe et < 48h.

```js
function _checkVolChronoBanner() {
  if (S.user !== 'gerant') return '';
  var vol = lsGet('vol_pending');
  if (!vol || !vol.heureDecouverte) return '';
  var heuresRestantes = 48 - (Date.now() - vol.heureDecouverte) / 3600000;
  if (heuresRestantes <= 0) {
    // Fenêtre dépassée — bannière info grise
    return '<div style="background:#1a1a1a;border:1px solid #555;border-radius:8px;padding:12px">'
      + '⏱️ Fenêtre 48h dépassée — continuer les démarches CNAAS et gendarmerie.'
      + '</div>';
  }
  var h = Math.floor(heuresRestantes);
  var m = Math.floor((heuresRestantes - h) * 60);
  // Couleur selon urgence : < 6h = rouge profond #3a0a0a, < 12h = rouge #2a0a0a, sinon #1a0505
  var bg = heuresRestantes < 6 ? '#3a0a0a' : heuresRestantes < 12 ? '#2a0a0a' : '#1a0505';
  var borderCol = heuresRestantes < 6 ? '#ff3300' : '#cc2200';
  // Barre de progression (% restant sur 48h)
  var pct = Math.round(heuresRestantes / 48 * 100);
  var barColor = heuresRestantes < 6 ? '#ff3300' : heuresRestantes < 12 ? '#cc2200' : '#884400';
  var icon = heuresRestantes < 6 ? '🚨' : '⏱️';
  var titre = heuresRestantes < 6
    ? 'CRITIQUE — ' + h + 'h ' + m + 'min restantes'
    : 'Fenêtre VOL — Poursuite chaude';
  var cnaasTel = (lsGet('cfg_contact_cnaas_tel') || '').replace(/\D/g, '');
  return '<div style="background:' + bg + ';border:1px solid ' + borderCol + ';border-radius:8px;padding:12px;margin-bottom:10px">'
    + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
    + '<span style="font-size:18px">' + icon + '</span>'
    + '<strong style="color:#ff8866;font-size:15px">' + titre + '</strong>'
    + '</div>'
    // Barre de progression
    + '<div style="background:#333;border-radius:4px;height:8px;margin-bottom:10px">'
    + '<div style="background:' + barColor + ';width:' + pct + '%;height:8px;border-radius:4px"></div>'
    + '</div>'
    + '<div style="color:#ffbbaa;font-size:13px;margin-bottom:10px">'
    + '<strong>' + h + 'h ' + m + 'min</strong> restantes sur 48h de poursuite chaude. '
    + 'Brigade Thiès : 07h00–22h00 — Urgence nuit : appel direct permanencier.'
    + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    + (cnaasTel ? '<a href="tel:+' + cnaasTel + '"'
      + ' style="background:#884400;color:#fff;padding:7px 14px;border-radius:6px;'
      + 'text-decoration:none;font-size:13px">📞 Brigade / CNAAS</a>' : '')
    + '<button onclick="lsSet(\'vol_pending\',null);r();"'
      + ' style="background:#1a2e1a;color:#aaa;border:1px solid #2a4a2a;'
      + 'padding:7px 14px;border-radius:6px;font-size:13px;cursor:pointer">✓ Pris en charge</button>'
    + '</div></div>';
}
// Intégration dans viewDash() gérant — AVANT les autres bannières :
// var _volChrono = _checkVolChronoBanner();
// if (_volChrono) html += '<div style="margin-bottom:8px">' + _volChrono + '</div>';
```

**Flags localStorage — TTL naturel (date dans la clé) :**

| Clé localStorage | Expire naturellement |
|---|---|
| `vol_pending` | `lsSet('vol_pending', null)` au clic "✓ Pris en charge" ou > 48h |
| `boanr_wa_vet_j1_[acteKey]_[YYYY-MM-DD]` | Le lendemain (date dans la clé change) |
| `boanr_wa_vet_deces_relance_[id]_[YYYY-MM-DD]` | Le lendemain |

---

## 4. API serveur

> **Timeout Vercel plan Hobby : 10 secondes par function.**
> 3 fonctions séquentielles = 15-25s estimé → dépassement certain.
> Solution : 3 endpoints séparés (`?type=vet/deces/relances`) avec 3 crons GitHub Actions décalés de 2 min.

### 4.1 ensureSheetExists() — auto-création onglets

Appelé au début de chaque run cron. Idempotent.

```js
async function ensureSheetExists(token, sid, sheetName) {
  var testUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' + sid
    + '/values/' + encodeURIComponent(sheetName)
    + '!A1?valueRenderOption=UNFORMATTED_VALUE';
  var test = await fetch(testUrl, { headers: { Authorization: 'Bearer ' + token } });
  if (test.ok) return; // existe déjà

  await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + sid + ':batchUpdate', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName } } }] })
  });

  var HEADERS = {
    Notifications_Log: [['Date_Envoi','Type','Reference_ID','Destinataire','Canal',
                          'Statut','Tentative_N','Date_Confirmation','Notes']],
    Sinistres_CNAAS:   [['Date','Type','ID_Animal_s','N_Recepisse','Statut_CNAAS',
                          'Date_Email_J0','Appel_Fondateur_J0','Certif_Vet_Recu',
                          'Expert_Passe','Relances_Stop','email_pending',
                          'Date_Visite_Vet_Prevue','Date_Visite_Expert_CNAAS_Prevue',
                          'N_PV_Officiel','Heure_Vol','Heure_Decouverte']]
  };
  var hdrs = HEADERS[sheetName];
  if (!hdrs) return;
  await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + sid
    + '/values/' + encodeURIComponent(sheetName)
    + '!A1?valueInputOption=USER_ENTERED', {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: hdrs })
  });
}
```

### 4.2 Lecture Config côté serveur

```js
async function readConfigApp(token, sid) {
  var res = await fetch(
    'https://sheets.googleapis.com/v4/spreadsheets/' + sid
    + '/values/Config_App!A:B?valueRenderOption=UNFORMATTED_VALUE',
    { headers: { Authorization: 'Bearer ' + token } }
  );
  if (!res.ok) throw new Error('Config_App illisible: ' + res.status);
  var data = await res.json();
  var cfg = {};
  (data.values || []).forEach(function(row) {
    if (!row[0]) return;
    try { cfg[row[0]] = JSON.parse(row[1]); } catch(e) { cfg[row[0]] = row[1] || ''; }
  });
  return cfg;
  // Clés lues : sopProtocol, numCnaas, sopResetAt, jours_fermes, cnaas_grille,
  //   contact_vet_email, contact_vet_tel, contact_cnaas_email, contact_cnaas_tel,
  //   contact_cnaas_delai_h, ferme_email_expediteur, ferme_responsable_nom,
  //   ferme_responsable_tel, ferme_email_fondateur, contact_rga_email,
  //   horaire_vet_dakar, contact_gerant_tel
}

async function readConfigCycle(token, sid) {
  var res = await fetch(
    'https://sheets.googleapis.com/v4/spreadsheets/' + sid
    + '/values/Config_Cycle!A1:S1?valueRenderOption=UNFORMATTED_VALUE',
    { headers: { Authorization: 'Bearer ' + token } }
  );
  var data = await res.json();
  var row = (data.values || [[]])[0] || [];
  return {
    dateDebut:   row[0] || '',   // YYYY-MM-DD — déjà au bon format
    nomCycle:    row[1] || '',
    betes:       JSON.parse(String(row[2] || '[]')), // [{id,race,raceCustom,poidsEntree,dateIntro}]
    veterinaire: row[8] || ''    // col I
  };
}
```

### 4.3 safeText()

```js
// Obligatoire sur TOUS les champs libres gérant avant insertion dans un email
// Protège contre CRLF injection dans en-têtes + limite la taille (100 KB max SendGrid)
function safeText(s) {
  return String(s || '').replace(/[<>&"\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
}
// Appliquer sur : sym, tra, desc, circonstances VOL, notes
// NE PAS appliquer sur : IDs animaux, dates, montants, variables Config_App (contrôlées)
```

### 4.4 Idempotence — double guard + TTL PENDING 2h

```js
async function isAlreadySent(token, sid, notifLog, refId) {
  for (var i = 0; i < notifLog.length; i++) {
    var row = notifLog[i];
    if (row[2] !== refId) continue;                               // col C = Reference_ID
    if (row[5] === 'SENT' || row[5] === 'CONFIRME') return true;  // col F = Statut
    if (row[5] === 'PENDING') {
      var pendingTs = new Date(String(row[0] || '')).getTime();   // col A = Date_Envoi
      if (Date.now() - pendingTs < 2 * 3600 * 1000) return true; // encore en cours
      // Stale > 2h → libérer (rowIdx = i + 2 : 1-indexed + header)
      await updateCell(token, sid, 'Notifications_Log!F' + (i + 2), 'ERROR_TIMEOUT');
    }
  }
  return false;
}
```

### 4.5 Validation acte SOP

```js
// Identifie un acte validé par {label + date ±7j} — jamais par acte.id (non persisté)
function isActeValidated(acte, dateDebut, santeRows) {
  var dateActeMs = new Date(dateDebut + 'T00:00:00Z').getTime() + acte.j * 86400000;
  return (santeRows || []).some(function(row) {
    if (String(row[9] || '') !== acte.label) return false; // col J = sopLabel
    var parts = String(row[0] || '').split('/');            // col A = DD/MM/YYYY
    if (parts.length !== 3) return false;
    var entryMs = Date.UTC(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    return Math.abs(entryMs - dateActeMs) / 86400000 <= 7;
  });
}
```

### 4.6 sendEmail() + sendEmailWithLog()

```js
// text/plain obligatoire — Orange Sénégal filtre les emails HTML
async function sendEmail(cfg, to, subject, body, cc) {
  var res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.SENDGRID_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email: to }],
        cc: (cc || []).filter(Boolean).map(function(e) { return { email: e }; })
      }],
      from: { email: cfg.ferme_email_expediteur },
      subject: subject,                               // PAS de crochets [BOAN]
      content: [{ type: 'text/plain', value: body }]  // TOUJOURS text/plain
    })
  });
  return res.status === 202;
}

async function sendEmailWithLog(token, sid, cfg, notifLog, opts) {
  // opts : { to, subject, body, refId, type, cc }
  var cc = opts.cc || [cfg.ferme_email_fondateur, cfg.contact_rga_email];
  // 1. Écrire PENDING avant l'envoi
  var pendingVals = [
    new Date().toISOString(), opts.type, opts.refId, opts.to, 'EMAIL',
    'PENDING', '1', '', ''
  ];
  var appendRes = await appendRow(token, sid, 'Notifications_Log!A:I', pendingVals);
  var rowIdx = appendRes.updates.updatedRange.match(/(\d+)$/)[1];

  // 2. Appeler SendGrid
  var ok = await sendEmail(cfg, opts.to, opts.subject, opts.body, cc);

  // 3. Mettre à jour Statut
  var statut = ok ? 'SENT' : 'ERROR';
  if (!ok && !cfg.numCnaas && opts.type.indexOf('CNAAS') !== -1) statut = 'INCOMPLET_POLICE';
  await updateCell(token, sid, 'Notifications_Log!F' + rowIdx, statut);

  return ok;
}
```

### 4.7 checkAndSendVetReminders()

```js
async function checkAndSendVetReminders(token, cfg, cycle, santeRows, notifLog) {
  var sopProtocol = cfg.sopProtocol || [];
  var joursFermes = cfg.jours_fermes || [];
  var todayISO = new Date().toISOString().slice(0, 10);

  if (!sopProtocol.length) {
    await appendRow(token, cfg._sid, 'Notifications_Log!A:I',
      [new Date().toISOString(),'VET_ERROR','','','','ERROR_EMPTY_PROTOCOL','','','']); return;
  }
  if (!cfg.contact_vet_email) {
    await appendRow(token, cfg._sid, 'Notifications_Log!A:I',
      [new Date().toISOString(),'VET_ERROR','','','','ALERT_NO_CONTACT','','','']); return;
  }
  if (joursFermes.indexOf(todayISO) !== -1) {
    await appendRow(token, cfg._sid, 'Notifications_Log!A:I',
      [new Date().toISOString(),'VET_SKIPPED','','','','SKIPPED','','','Jour ferme: '+todayISO]); return;
  }

  var today = new Date();
  var todayMs = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

  for (var i = 0; i < sopProtocol.length; i++) {
    var acte = sopProtocol[i];
    var dateActeMs = new Date(cycle.dateDebut + 'T00:00:00Z').getTime() + acte.j * 86400000;
    var dateActeISO = new Date(dateActeMs).toISOString().slice(0, 10);
    var joursAvant = Math.round((dateActeMs - todayMs) / 86400000);

    if ([1, 2, 3].indexOf(joursAvant) === -1) continue;
    if (isActeValidated(acte, cycle.dateDebut, santeRows)) continue;

    var refId = 'SOP_VET_J-' + joursAvant + '_'
      + acte.label.toLowerCase().replace(/\s+/g, '-') + '_' + dateActeISO;
    if (await isAlreadySent(token, cfg._sid, notifLog, refId)) continue;

    var body = 'BOAN — Rappel acte SOP dans ' + joursAvant + ' jour(s)\n\n'
      + 'Bonjour ' + cycle.veterinaire + ',\n\n'
      + 'Acte : ' + acte.label + '\nDate prevue : ' + dateActeISO
      + '\nTroupeau : ' + (cycle.betes || []).length + ' betes actives\n\n'
      + 'Merci de confirmer votre disponibilite.\n\n'
      + cfg.ferme_responsable_nom + ' - ' + cfg.ferme_responsable_tel
      + '\nFerme BOAN, Thies, Senegal';

    await sendEmailWithLog(token, cfg._sid, cfg, notifLog, {
      to: cfg.contact_vet_email,
      subject: 'BOAN — Rappel SOP J-' + joursAvant + ' — ' + acte.label,
      body: body, refId: refId, type: 'SOP_VET_J-' + joursAvant,
      cc: [cfg.ferme_email_fondateur]
    });
  }
}
```

### 4.8 checkAndSendDecesAlerts()

```js
async function checkAndSendDecesAlerts(token, cfg, cycle, santeRows, sinistresRows, notifLog) {
  for (var i = 0; i < sinistresRows.length; i++) {
    var row = sinistresRows[i];
    var rowIdx = i + 2; // 1-indexed + header

    if (String(row[10] || '').trim().toUpperCase() !== 'OUI') continue; // col K = email_pending

    var animalId = String(row[2] || '');  // col C
    var dateStr  = String(row[0] || '');  // col A
    var dateKey  = dateStr.replace(/\//g, '-');

    var refCnaas   = 'CNAAS_DECES_J0_' + animalId + '_' + dateKey;
    var refVet     = 'VET_DECES_J0_' + animalId + '_' + dateKey;
    var todayISO   = new Date().toISOString().slice(0, 10);
    var refRappel  = 'VET_DECES_RAPPEL_J1_' + animalId + '_' + todayISO;

    if (await isAlreadySent(token, cfg._sid, notifLog, refCnaas)) continue;

    // Données animal depuis Sante_Mortalite
    var santeRow = (santeRows || []).filter(function(r) {
      return String(r[1] || '') === animalId && String(r[6] || '').toUpperCase() === 'OUI';
    })[0] || [];
    var sym  = safeText(String(santeRow[2] || ''));
    var tra  = safeText(String(santeRow[3] || ''));
    var cout = String(santeRow[4] || '');

    var beteInfo = (cycle.betes || []).filter(function(b) { return b.id === animalId; })[0] || {};

    // Email CNAAS J+0
    var cnaasBody = 'Declaration sinistre — Deces ' + animalId
      + ' — Police n' + (cfg.numCnaas || '[A COMPLETER]') + '\n\n'
      + 'TYPE : Deces animal\nN POLICE : ' + (cfg.numCnaas || '[A COMPLETER]')
      + '\nDATE : ' + dateStr + '\nLIEU : Ferme BOAN, Thies, Senegal\n\n'
      + '--- ANIMAL ---\n'
      + 'Identifiant : ' + animalId
      + '\nRace : ' + (beteInfo.race || '')
      + '\nPoids entree : ' + (beteInfo.poidsEntree || '') + ' kg'
      + '\nDate entree : ' + (beteInfo.dateIntro || '') + '\n\n'
      + '--- SOINS ---\nSymptomes : ' + sym + '\nTraitements : ' + tra
      + '\nCout : ' + cout + ' FCFA\n\n'
      + '--- ENGAGEMENT ---\n'
      + 'L\'animal N\'A PAS ete abattu ni enterre. En attente de votre expert.\n\n'
      + 'COORDINATION REQUISE : Merci de coordonner la date de passage de votre expert\n'
      + 'avec la venue du veterinaire Dr ' + cycle.veterinaire + '.\n\n'
      + cfg.ferme_responsable_nom + ' - ' + cfg.ferme_responsable_tel
      + '\nFerme BOAN, Thies, Senegal';

    var cnaasOk = await sendEmailWithLog(token, cfg._sid, cfg, notifLog, {
      to: cfg.contact_cnaas_email,
      subject: 'Declaration sinistre — Deces ' + animalId + ' — Police n' + (cfg.numCnaas || ''),
      body: cnaasBody, refId: refCnaas, type: 'CNAAS_DECES_J0'
    });

    // Email VET J+0
    var vetSent = await isAlreadySent(token, cfg._sid, notifLog, refVet);
    if (!vetSent && cfg.contact_vet_email) {
      var vetBody = 'URGENT — Deces animal — ' + animalId + '\n\n'
        + 'Bonjour ' + cycle.veterinaire + ',\n\n'
        + 'URGENT : ' + animalId + ' est decede a la Ferme BOAN.\n'
        + 'Votre presence est requise pour le certificat CNAAS avant leur expert (5-7 jours).\n\n'
        + 'Animal : ' + animalId + ' — ' + (beteInfo.race || '') + ' — ' + (beteInfo.poidsEntree || '') + ' kg\n'
        + 'Date : ' + dateStr + '\nSymptomes : ' + sym + '\nTraitements : ' + tra + '\n\n'
        + 'L\'animal N\'A PAS ete enterre — en attente de votre constat.\n'
        + 'Merci de confirmer dans les 48h.\n\n'
        + cfg.ferme_responsable_nom + ' - ' + cfg.ferme_responsable_tel;
      await sendEmailWithLog(token, cfg._sid, cfg, notifLog, {
        to: cfg.contact_vet_email,
        subject: 'URGENT — Deces ' + animalId + ' — Certificat CNAAS requis',
        body: vetBody, refId: refVet, type: 'VET_DECES_J0',
        cc: [cfg.ferme_email_fondateur, cfg.contact_rga_email]
      });
    }

    // Rappel vét J+1 si pas de confirmation (col H = Date_Confirmation)
    var vetConfirmed = (notifLog || []).some(function(r) {
      return r[2] === refVet && String(r[7] || '').length > 0;
    });
    if (!vetConfirmed && cfg.contact_vet_email
        && !(await isAlreadySent(token, cfg._sid, notifLog, refRappel))) {
      var rappelBody = 'Rappel URGENT — Deces ' + animalId + '\n\n'
        + 'Bonjour ' + cycle.veterinaire + ',\n\n'
        + 'Le dossier CNAAS pour ' + animalId + ' attend votre certificat de constatation.\n'
        + 'L\'animal n\'a pas ete enterre.\n\n'
        + 'Merci de confirmer votre venue au ' + cfg.ferme_responsable_tel + '.\n\n'
        + cfg.ferme_responsable_nom + '\nFerme BOAN, Thies, Senegal';
      await sendEmailWithLog(token, cfg._sid, cfg, notifLog, {
        to: cfg.contact_vet_email,
        subject: 'Rappel URGENT — Deces ' + animalId + ' — Confirmation requise',
        body: rappelBody, refId: refRappel, type: 'VET_DECES_RAPPEL_J1',
        cc: [cfg.ferme_email_fondateur]
      });
    }

    // Alerte croisée : col M < col L → expert avant vét
    var dateVet    = String(row[11] || ''); // col L
    var dateExpert = String(row[12] || ''); // col M
    if (dateVet && dateExpert && dateExpert < dateVet && cfg.ferme_email_fondateur) {
      await sendEmail(cfg, cfg.ferme_email_fondateur,
        'BOAN ALERTE — Expert CNAAS prevu avant vet — ' + animalId,
        'Expert CNAAS prevu le ' + dateExpert + ' AVANT le veterinaire (' + dateVet + ').\n'
        + 'Risque de rejet du dossier. Appeler CNAAS pour reporter apres le ' + dateVet + '.', []);
    }

    // Effacer email_pending UNIQUEMENT si email CNAAS envoyé avec succès
    if (cnaasOk) {
      await updateCell(token, cfg._sid, 'Sinistres_CNAAS!K' + rowIdx, 'NON');
    }
  }
}
```

### 4.9 checkAndSendCnaasFollowups()

```js
async function checkAndSendCnaasFollowups(token, cfg, sinistresRows, notifLog) {
  var todayISO = new Date().toISOString().slice(0, 10);
  for (var i = 0; i < sinistresRows.length; i++) {
    var row = sinistresRows[i];
    if (String(row[4] || '').toUpperCase() !== 'EN_COURS') continue; // col E
    if (String(row[9] || '').toUpperCase() === 'OUI') continue;       // col J = Relances_Stop
    var dateJ0 = String(row[5] || ''); // col F
    if (!dateJ0) continue;
    var joursEcoules = Math.round(
      (Date.now() - new Date(dateJ0 + 'T00:00:00Z').getTime()) / 86400000
    );
    if (joursEcoules !== 7 && joursEcoules !== 14) continue;

    var animalId = String(row[2] || '');
    var refId = 'CNAAS_RELANCE_J' + joursEcoules + '_' + animalId + '_' + todayISO;
    if (await isAlreadySent(token, cfg._sid, notifLog, refId)) continue;

    var body = 'BOAN — Suivi sinistre\n\nMadame, Monsieur,\n\n'
      + 'Nous revenons sur notre declaration du ' + dateJ0
      + ', restee sans accuse de reception.\n\n'
      + 'Ref : ' + String(row[1] || '') + ' — ' + animalId
      + ' — Police n' + (cfg.numCnaas || '') + '\n\n'
      + 'Nous restons a votre disposition.\n\n'
      + cfg.ferme_responsable_nom + ' - ' + cfg.ferme_responsable_tel;

    await sendEmailWithLog(token, cfg._sid, cfg, notifLog, {
      to: cfg.contact_cnaas_email,
      subject: 'BOAN Suivi sinistre — Police n' + (cfg.numCnaas || '') + ' — Dec. du ' + dateJ0,
      body: body, refId: refId, type: 'CNAAS_RELANCE_J' + joursEcoules
    });

    if (joursEcoules === 14 && cfg.ferme_email_fondateur) {
      await sendEmail(cfg, cfg.ferme_email_fondateur,
        'BOAN — Dossier ' + animalId + ' sans reponse CNAAS a J+14',
        'Appel vocal CNAAS Thies recommande pour dossier ' + animalId
        + ' declare le ' + dateJ0 + '.', []);
    }
  }
}
```

### 4.10 /api/cron.js

```js
// CommonJS — requis pour Vercel serverless (module.exports, pas export default)
module.exports = async function handler(req, res) {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  var type = req.query.type || 'vet';
  try {
    var token = await getGoogleToken(); // réutilise /api/token.js
    var cfg   = await readConfigApp(token, process.env.SID_FONDATEUR);
    cfg._sid  = process.env.SID_FONDATEUR;
    var cycle = await readConfigCycle(token, process.env.SID_FONDATEUR);

    await ensureSheetExists(token, cfg._sid, 'Notifications_Log');
    await ensureSheetExists(token, cfg._sid, 'Sinistres_CNAAS');

    var notifLog      = await readSheet(token, cfg._sid, 'Notifications_Log!A2:I500');
    var santeRows     = await readSheet(token, cfg._sid, 'Sante_Mortalite!A2:J500');
    var sinistresRows = await readSheet(token, cfg._sid, 'Sinistres_CNAAS!A2:M200');

    if (type === 'vet')      await checkAndSendVetReminders(token, cfg, cycle, santeRows, notifLog);
    if (type === 'deces')    await checkAndSendDecesAlerts(token, cfg, cycle, santeRows, sinistresRows, notifLog);
    if (type === 'relances') await checkAndSendCnaasFollowups(token, cfg, sinistresRows, notifLog);

    return res.status(200).json({ ok: true, type: type, ts: new Date().toISOString() });
  } catch(e) {
    console.error('CRON ERROR [' + type + ']', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
};
```

### 4.11 /.github/workflows/cron-notifications.yml

> **Bug corrigé** : `github.event.inputs.type || 'all'` → tous les schedules envoyaient `type=all`
> car `github.event.inputs` est vide sur l'événement `schedule`.
> **Fix** : différencier les 3 crons via `github.event.schedule`.

```yaml
name: BOAN — Cron Notifications
on:
  schedule:
    - cron: '0 7 * * *'   # 07h00 UTC — type=vet
    - cron: '2 7 * * *'   # 07h02 UTC — type=deces
    - cron: '4 7 * * *'   # 07h04 UTC — type=relances
  workflow_dispatch:
    inputs:
      type:
        description: 'vet | deces | relances'
        required: true
        default: 'vet'

jobs:
  notify:
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule' || github.actor == 'diopcmd'
    steps:
      - name: Résoudre le type
        id: resolve
        run: |
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            echo "type=${{ github.event.inputs.type }}" >> $GITHUB_OUTPUT
          elif [ "${{ github.event.schedule }}" = "0 7 * * *" ]; then
            echo "type=vet" >> $GITHUB_OUTPUT
          elif [ "${{ github.event.schedule }}" = "2 7 * * *" ]; then
            echo "type=deces" >> $GITHUB_OUTPUT
          else
            echo "type=relances" >> $GITHUB_OUTPUT
          fi
      - name: Déclencher le cron BOAN
        run: |
          curl -f -X GET \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}" \
            "https://boan-app-9u5e.vercel.app/api/cron?type=${{ steps.resolve.outputs.type }}"
```

---

## 5. Templates emails (plain text strict)

> **Règle absolue** : `text/plain` uniquement — HTML filtré par Orange Sénégal.
> Pas de crochets [BOAN] dans les objets. `safeText()` sur tous les champs libres.

### 5.1 Rappel SOP vétérinaire (J-3 / J-2 / J-1)
```
À    : [contact_vet_email]
CC   : [ferme_email_fondateur]
Objet : BOAN — Rappel acte SOP dans [N] jour(s) — [acte.label]

Bonjour [cycle.veterinaire],

Rappel : acte du protocole SOP planifié dans [N] jour(s).

Acte       : [acte.label]
Date prévue: [dateActe DD/MM/YYYY]
Troupeau   : [cycle.betes.length] bêtes actives

Merci de confirmer votre disponibilité.

[ferme_responsable_nom] — [ferme_responsable_tel]
Ferme BOAN, Thiès, Sénégal
```

### 5.2 Alerte vétérinaire — Décès J+0
```
À    : [contact_vet_email]
CC   : [ferme_email_fondateur], [contact_rga_email]
Objet : URGENT — Décès animal — Certificat CNAAS requis — [ID_ANIMAL]

Bonjour [cycle.veterinaire],

URGENT : [ID_ANIMAL] est décédé à la Ferme BOAN.
Votre présence est requise pour le certificat de constatation
avant le passage de l'expert CNAAS (attendu sous 5-7 jours terrain).

Animal    : [ID_ANIMAL] — [race] — [poidsEntree] kg
Date      : [date]
Symptômes : [safeText(sym)]
Traitements: [safeText(tra)]

L'animal N'A PAS été enterré — en attente de votre constat.
Merci de confirmer votre disponibilité dans les 48h.

[ferme_responsable_nom] — [ferme_responsable_tel]
Ferme BOAN, Thiès, Sénégal
```

### 5.2b Rappel vétérinaire J+1 (si aucune confirmation)
```
À    : [contact_vet_email]
CC   : [ferme_email_fondateur]
Objet : Rappel URGENT — Décès [ID_ANIMAL] — Confirmation de venue requise

Bonjour [cycle.veterinaire],

Le dossier CNAAS pour [ID_ANIMAL] attend votre certificat de constatation.
L'animal n'a pas été enterré.

Merci de confirmer votre venue au [ferme_responsable_tel].

[ferme_responsable_nom]
Ferme BOAN, Thiès, Sénégal
```

### 5.3 Déclaration CNAAS — Décès J+0
```
À    : [contact_cnaas_email]
CC   : [ferme_email_fondateur], [contact_rga_email]
Objet : Déclaration sinistre — Décès [ID_ANIMAL] — Police n°[CYCLE.numCnaas]

Madame, Monsieur,

La Ferme BOAN déclare le sinistre suivant dans le délai contractuel.
Ce message constitue une déclaration à titre conservatoire.

TYPE DE SINISTRE  : Décès animal
N° POLICE         : [CYCLE.numCnaas]
DATE DU DÉCÈS     : [date DD/MM/YYYY]
LIEU              : Ferme BOAN, Thiès, Sénégal

--- IDENTIFICATION DE L'ANIMAL ---
  Identifiant  : [ID_ANIMAL]
  Race         : [race]
  Poids entrée : [poidsEntree] kg
  Date entrée  : [dateIntro DD/MM/YYYY]
  Poids actuel : [poids_dernier] kg (pesée du [date_derniere_pesee])
  Valeur assurée : selon grille contractuelle CNAAS (voir police n°[CYCLE.numCnaas])

--- HISTORIQUE DES SOINS ---
  Symptômes    : [safeText(sym)]
  Traitements  : [safeText(tra)]
  Coût soins   : [cout] FCFA
  Vaccinations : [actes SOP validés — label + date]

--- HISTORIQUE DES PESÉES ---
  [date | poids kg | gain kg | GMQ kg/j — 3 dernières pesées]

--- ENGAGEMENT ---
  L'animal N'A PAS été abattu ni enterré. En attente de votre expert.

COORDINATION REQUISE :
  Merci de coordonner la date de passage de votre expert
  avec la disponibilité du vétérinaire Dr [cycle.veterinaire],
  afin que le certificat soit disponible lors de votre venue.

Pièces à transmettre séparément :
  - Certificat de constatation signé par Dr [cycle.veterinaire]
  - Photos de l'animal (par WhatsApp ou email de suivi)

[ferme_responsable_nom] — [ferme_responsable_tel]
Ferme BOAN, Thiès, Sénégal
```

### 5.4 Déclaration CNAAS — Vol J+0
```
À    : [contact_cnaas_email]
CC   : [ferme_email_fondateur], [contact_rga_email]
Objet : Déclaration sinistre — Vol bétail — Police n°[CYCLE.numCnaas]

TYPE DE SINISTRE  : Vol de bétail
N° POLICE         : [CYCLE.numCnaas]
N° RÉCÉPISSÉ      : [safeText(no_recepisse)]
N° PV OFFICIEL    : [safeText(no_pv) si non vide, sinon "En attente — sera transmis dès réception"]
HEURE VOL         : [heure_vol si connue, sinon "Inconnue"]
HEURE DÉCOUVERTE  : [heure_decouverte]
DATE              : [date]
LIEU              : Ferme BOAN, Thiès, Sénégal

--- ANIMAUX VOLÉS ---
  [ID | Race | Poids entrée kg | photoRef si disponible]

Circonstances  : [safeText(desc)]
Dépôt plainte  : Gendarmerie Thiès, le [date_plainte]

[ferme_responsable_nom] — [ferme_responsable_tel]
Ferme BOAN, Thiès, Sénégal
```

### 5.5 Relances CNAAS — J+7 / J+14
```
À    : [contact_cnaas_email]
CC   : [ferme_email_fondateur], [contact_rga_email]
Objet : BOAN Suivi sinistre — Police n°[CYCLE.numCnaas] — Déc. du [date_J0]

Madame, Monsieur,

Nous revenons sur notre déclaration du [date_J0], sans accusé de réception à ce jour.

Réf : [Type] — [ID_ANIMAL ou N°_PV] — Police n°[CYCLE.numCnaas]

Nous restons à votre disposition.

[ferme_responsable_nom] — [ferme_responsable_tel]
```

---

## 6. Templates WhatsApp

> Pattern : `window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(msg), '_blank')`
> Même pattern que `partagerRapportJourWhatsApp()` existant dans l'app.
> Si tel vide → `wa.me/?text=` (utilisateur choisit le contact).

### 6.1 WA vét — Décès J+0 (post-submit gérant)
```
🚨 *BOAN — DÉCÈS ANIMAL*

Bête : [ID_ANIMAL] ([race], [poids] kg)
Date : [date] à [heure]
Symptômes : [sym]

⛔ Animal non enterré — présence requise pour certificat CNAAS.
Ferme BOAN — [ferme_responsable_nom] — [ferme_responsable_tel]
```

### 6.2 WA vét — Rappel SOP (cron)
```
📅 *BOAN — Rappel SOP*

Acte : [acte.label]
Date : [dateActe DD/MM/YYYY] (dans [N] jours)
Troupeau : [(CYCLE.betes||[]).length] bêtes actives

Ferme BOAN — [ferme_responsable_tel]
```

### 6.3 WA vét — Rappel urgent J-0 (bouton gérant dans SOP Véto)
```
🔔 *BOAN — Intervention aujourd'hui*

Bonjour [CYCLE.veterinaire],

Acte SOP prévu AUJOURD'HUI à la Ferme BOAN.
Acte : [acte.label]
Troupeau : [(CYCLE.betes||[]).length] bêtes actives

📞 [ferme_responsable_tel]
Ferme BOAN, Thiès, Sénégal
```

### 6.4 WA gérant — Préparer intervention demain
```
📋 *BOAN — Intervention SOP demain*

Dr [CYCLE.veterinaire] attendu demain à [horaire_vet_dakar].
Acte : [acte.label]

➡ Préparer zone, contenir troupeau.
Ferme BOAN — [ferme_responsable_tel]
```

### 6.5 WA CNAAS — Décès J+0 (post-submit)
```
📋 *BOAN — Déclaration sinistre envoyée*

Type : Décès animal
Police : [CYCLE.numCnaas]
Animal : [ID_ANIMAL] — [race] — [poids] kg
Date : [date]

⛔ Animal non enterré — en attente expert.
Email envoyé à [contact_cnaas_email].
[ferme_responsable_nom] — [ferme_responsable_tel]
```

### 6.6 WA CNAAS — Vol J+0
```
📋 *BOAN — Déclaration sinistre envoyée*

Type : Vol de bétail
Police : [CYCLE.numCnaas]
N° PV : [no_pv_gendarmerie]
Animaux : [liste IDs]

Email envoyé à [contact_cnaas_email].
[ferme_responsable_nom] — [ferme_responsable_tel]
```

### 6.7 WA gérant → vét — Rappel SOP J-1 (bannière dashboard contexte A)
```
🔔 *BOAN — Rappel acte SOP demain*

Bonjour [CYCLE.veterinaire],

Acte : [acte.label]
Date : [demain DD/MM/YYYY]
Troupeau : [(CYCLE.betes||[]).length] bêtes actives

Ferme BOAN — [lsGet('cfg_contact_gerant_tel')]
```

### 6.8 WA gérant → vét — Relance décès > 24h (bannière dashboard contexte B)
```
⚠️ *BOAN — Relance certificat décès*

Bonjour [CYCLE.veterinaire],

La bête [ID_ANIMAL] est décédée [hier / il y a N jours].
Le dossier CNAAS attend votre certificat. L'animal n'a pas été enterré.

Pouvez-vous confirmer votre venue ?
Ferme BOAN — [lsGet('cfg_contact_gerant_tel')]
```

---

## 7. Pièces CNAAS — Table de référence

| Pièce | Qui produit | Quand | Dans BOAN |
|---|---|---|---|
| Déclaration J+0 | App BOAN (email auto) | J+0 | ✅ Section 5.3 |
| Certificat constatation vét | Vétérinaire attitré | J+1 à J+5-7 ⚠️ délai réel | ✅ Email vét J+0 (5.2) + rappel J+1 (5.2b) → ⬛ Checkbox fondateur |
| Fiche identification animal | App BOAN | J+0 dans email | ✅ CYCLE.betes[i] |
| Historique soins/vaccins | App BOAN | J+0 dans email | ✅ Sante_Mortalite + SOP_Check |
| N° police assurance | Fondateur (config) | J+0 dans email | ✅ CYCLE.numCnaas |
| Photos animal décédé | Gérant (manuel) | J+0 | ⚠️ Rappel app — WA ou email suivi |
| Engagement non enterrement | App (bannière) | Continu | ✅ Bannière ⛔ + mention email |

> ⚠️ **Coordination vét/expert CNAAS** : email CNAAS J+0 demande coordination explicite.
> Appel vocal fondateur J+0 = alignement des deux rendez-vous.
> Alerte croisée dans Livrables > Incidents si `Date_Visite_Expert_CNAAS_Prevue < Date_Visite_Vet_Prevue`.

---

## 8. Checklist d'implémentation

### BLOC A — Prérequis métier (hors code — bloquants absolus)
```
□ Contractualiser vétérinaire agréé Thiès (nom, email, +221XX, WhatsApp)
□ Souscrire police CNAAS + obtenir N° police, email, tel, délai, liste pièces
□ Obtenir grille officielle CNAAS indemnisation par race/classe d'âge
□ Numéro téléphone vocal agent CNAAS Thiès
□ Créer compte SendGrid + Single Sender Verification adresse fondateur
□ SENDGRID_API_KEY dans Variables Vercel
□ CRON_SECRET dans Secrets Vercel + GitHub
□ SID_FONDATEUR dans Variables Vercel
□ Saisir les contacts (section 3.5) dans sous-onglet "Contacts & Assurance"
```

### BLOC B — index.html (frontend)
```
☑ CYCLE.numCnaas — déjà implémenté (commit 9766040)
☑ CYCLE.veterinaire — déjà implémenté
□ Sous-onglet "Contacts & Assurance" dans viewLiv() — fondateur uniquement
    → Champs section 3.5, persistés via _syncConfigApp() + cache lsSet('cfg_[key]')
□ safeTextClient() dans index.html (sym, tra, desc avant stockage localStorage)
□ viewSaisie() décès=OUI : bannière rouge ⛔ + alerte photo + alerte N° police absent
    + alerte prix foirail > 30j
□ doSubmit('sante') si décès=OUI :
    lsSet last_deces_ts, sinistres_ouverts, deces_pending (si offline)
    + window.addEventListener('online') → createSinistrePending()
□ Modal + boutons post-submit décès : 1️⃣📞CNAAS 2️⃣📞Vét 3️⃣💬WA vét + Annuler 4h
□ viewSaisie() VOL : beteMultiSelect() (section 3.8) + S.fin.beteIds=[] dans reset (~L1899)
    + champ N° PV bloquant + boutons CNAAS post-submit
□ viewDash() : bannière ⛔ sinistre ouvert (tous rôles)
□ viewDash() fondateur : _checkDecesUrgenceFondateur() (section 3.4 contexte C)
□ viewDash() gérant : _checkVolChronoBanner() (section 3.10) + _checkVetJ1Banners() + _checkDecesVetBanners() (section 3.3)
□ LIVE.sinistres + LIVE.notifLog chargés en Vague 2 loadLiveData (section 3.9, range A2:Q200)
    + _reconcileSinistresOuverts() en fin de Vague 2
□ viewLiv() incidents enrichi (section 3.6) :
    bannière ⛔, timeline, champs L/M, alerte croisée,
    checkboxes fondateur, statut select, boutons CLOTURE/ANNULE/RELANCES_STOP
□ viewLiv() sopvet (section 3.7) :
    bouton "✓ Vét a confirmé", timeline J-3/J-2/J-1, bouton J-0 gérant
□ Badge numérique onglet Livrables si sinistres EN_COURS
```

### BLOC C — API serveur (nouveaux fichiers)
```
□ /api/notify.js — fonctions sections 4.1 à 4.9 :
    ensureSheetExists, readConfigApp, readConfigCycle, safeText,
    isAlreadySent, isActeValidated, sendEmail, sendEmailWithLog,
    checkAndSendVetReminders, checkAndSendDecesAlerts, checkAndSendCnaasFollowups
    helpers : readSheet, appendRow, updateCell
□ /api/cron.js — section 4.10 (CommonJS module.exports, param ?type=)
□ Réutiliser /api/token.js pour getGoogleToken()
```

### BLOC D — GitHub Actions
```
□ .github/workflows/cron-notifications.yml (section 4.11)
    → 3 schedules + résolution type par github.event.schedule
    → Guard github.actor == 'diopcmd' sur workflow_dispatch
□ CRON_SECRET dans GitHub Secrets
```

### BLOC E — Tests
```
□ curl /api/cron?type=vet — 200 en < 10s
□ curl /api/cron?type=deces + ?type=relances — idem
□ Email test vers adresse fondateur — vérifier text/plain, objet sans crochets, CC présents
□ WhatsApp → wa.me/ ouvre conversation avec message pré-rempli correct
□ Idempotence : appeler /api/cron deux fois → une seule ligne SENT dans Notifications_Log
□ TTL PENDING : ligne PENDING > 2h → cron → ERROR_TIMEOUT
□ Offline décès : submit offline → lsGet('deces_pending') non vide
    → reconnexion → createSinistrePending() → ligne Sinistres_CNAAS email_pending=OUI
    → cron → email envoyé, email_pending=NON
□ N° police vide → Statut INCOMPLET_POLICE + alerte soft app
□ Prix foirail > 30j → alerte dans formulaire décès
□ Bannière ⛔ après rechargement → lsGet('sinistres_ouverts') persisté
□ beteMultiSelect() : coche 2 bêtes → S.fin.beteIds = ['C1-001','C1-002']
□ Alerte croisée dates : col M < col L → email fondateur envoyé
□ Dashboard gérant J-1 SOP → tap WA → flagKey présent → bannière disparaît le lendemain
□ _reconcileSinistresOuverts() : Expert_Passe=OUI Sheets → expertPasse=true localStorage
□ Mise en production
```

---

## 9. Statut actuel

### Prérequis métier (BLOC A)

| Item | Statut |
|---|---|
| Vétérinaire contractualisé (Thiès) | ⛔ Non fait — **bloquant absolu** |
| Contrat CNAAS + N° police | ⛔ Non fait — **bloquant absolu** |
| Email/tel CNAAS + grille indemnisation | ⛔ Non fait — bloquant |
| Compte SendGrid | ⛔ Non fait |
| Variables Vercel + GitHub Secrets | ⛔ Non fait |
| `Notifications_Log` + `Sinistres_CNAAS` | ⬛ Auto-créés au 1er run cron (section 4.1) |

### Code frontend — BLOC B (index.html)

| Item | Statut | Détail |
|---|---|---|
| `CYCLE.numCnaas` | ✅ **Implémenté** | Modal init + Config_App + Go/No-Go (commit `9766040`) |
| `CYCLE.veterinaire` | ✅ **Implémenté** | Config_Cycle col I + Go/No-Go |
| `CYCLE.dateDebut` format ISO | ✅ **Déjà YYYY-MM-DD** | Aucune conversion nécessaire |
| Sous-onglet « Contacts & Assurance » | ⬛ **Non implémenté** | Aucun champ `cfg_contact_*` dans le code |
| `safeTextClient()` | ⬛ **Non implémenté** | Fonction absente de index.html |
| Bannière ⛔ NE PAS ABATTRE dans saisie santé | ⬛ **Non implémenté** | Actuellement : alerte rouge basique + bouton G3 |
| Alerte photo + alerte N° police absent | ⬛ **Non implémenté** | |
| `doSubmit('sante')` enrichi (décès=OUI) | ⬛ **Non implémenté** | Pas de `sinistres_ouverts`, `deces_pending`, `online` listener |
| Modal post-submit décès (boutons tél/WA) | ⬛ **Non implémenté** | Actuellement : simple `showConfirm` |
| VOL : `beteMultiSelect()` + N° PV bloquant | ⬛ **Non implémenté** | Fonction absente |
| Dashboard bannière ⛔ sinistre ouvert | ⬛ **Non implémenté** | `lsGet('sinistres_ouverts')` non utilisé |
| `_checkVetJ1Banners()` + `_checkDecesVetBanners()` | ⬛ **Non implémenté** | Fonctions absentes |
| `LIVE.sinistres` + `LIVE.notifLog` (Vague 2) | ⬛ **Non implémenté** | Pas dans `loadLiveData()` |
| `_reconcileSinistresOuverts()` | ⬛ **Non implémenté** | Fonction absente |
| `viewLiv()` incidents enrichi (section 3.6) | ⬛ **Non implémenté** | Timeline / checkboxes / statut CNAAS absents |
| `viewLiv()` SOP Véto — bouton « Vét a confirmé » | ⬛ **Non implémenté** | |
| Badge numérique onglet Livrables | ⬛ **Non implémenté** | |

### Code serveur — BLOC C (API) + BLOC D (GitHub Actions)

| Fichier | Statut |
|---|---|
| `/api/cron.js` | ⬛ **Absent** |
| `/api/notify.js` | ⬛ **Absent** |
| `.github/workflows/cron-notifications.yml` | ⬛ **Absent** (répertoire `.github` inexistant) |
| `/api/ai.js`, `/api/auth.js`, `/api/token.js`, `/api/sheets.js`, `/api/change-password.js` | ✅ **Présents** — réutilisables |

---

## 10. KPIs sinistres & qualité dossier — Recommandations panel

> Synthèse issue du panel — Dr Fernandez (DG international) + M. Diouf (CNAAS)

### 10.1 KPIs à suivre par cycle (nouveaux champs `Historique_Cycles`)

Ajouter 3 colonnes à la fin de `Historique_Cycles` (colonnes AC, AD, AE) pour capitaliser sur chaque cycle :

| Col | Nom | Valeurs |
|---|---|---|
| AC | Sinistres_Declares | entier — nombre de sinistres déclarés (décès + vol) |
| AD | Sinistres_Indemnises | entier — nombre effectivement indemnisés par CNAAS |
| AE | Montant_CNAAS_Recu | entier FCFA — somme réelle indemnisée |
| AF | Delai_Moyen_Cloture_j | entier — jours moyens entre déclaration et clôture dossier |

**Calcul taux de succès :** `Sinistres_Indemnises / Sinistres_Declares × 100`

> Benchmark Dr Fernandez : fermes avec dossier complet photographique = **85-95%** de taux d'indemnisation. Sans documentation = **30-40%**. BOAN vise 80%+ dès la 1ère saison.

### 10.2 Export PDF dossier sinistre — Feature prioritaire (post-prérequis)

> "Un éleveur qui arrive chez nous avec un dossier complet PDF pré-assemblé est traité 2× plus vite." — M. Diouf, CNAAS

**Déclencheur** : bouton "📄 Exporter dossier complet" dans `viewLiv()` sub=`incidents`, visible fondateur/rga si `Statut_CNAAS !== 'CLOTURE'`

**Contenu du dossier généré (HTML → print → PDF via `window.print()`)** :

```
Page 1 — Déclaration conservatoire
  N° police · Date · Animal · Engagement non enterrement

Page 2 — Identification animal
  CYCLE.betes[i] : race, poids entrée, date intro, photoRef

Page 3 — Historique des soins
  Sante_Mortalite : date · sym · tra · cout · sopLabel
  (les enregistrements SOP prouvent la conformité protocole vaccinal)

Page 4 — Historique des pesées
  LIVE.pesees : 3 dernières pesées + GMQ

Page 5 — Coordonnées & engagement
  Fondateur · Vétérinaire · CNAAS · Date déclaration
```

**Note technique** : utiliser `window.print()` après génération HTML dans un `<div id="print-dossier">` masqué. CSS `@media print` adapté. Pas de dépendance externe.

### 10.3 Référence photo initiale par bête — Feature prévention

> Recommandé par Adj. Chef Mbaye (police) + Dr Fernandez (international)

**Champ à ajouter dans `CYCLE.betes[i]`** :
```js
{ id: 'C1-001', race: 'Zébu Sénégalais', poidsEntree: 280,
  dateIntro: '2026-01-10',
  photoRef: 'https://wa.me/...' // URL photo WhatsApp ou lien Drive
}
```

**Usage** :
- En cas de vol : fondateur partage `photoRef` avec la gendarmerie (signalement)
- En cas de litige CNAAS sur identité de l'animal : preuve photographique horodatée
- Champ optionnel — ne bloque pas la création du cycle si absent

**Implémentation** : ajouter champ `photoRef` dans le formulaire d'ajout de bête dans `_ouvrirModalInit()` — input URL texte optionnel sous le champ race.

---

## 11. Guides opérationnels par rôle

> Recommandations consolidées du panel experts — rédigées pour une **lecture terrain directe**, sans jargon technique.
> Sources : Adj. Chef Mbaye (Gendarmerie) · M. Diouf (CNAAS) · Dr Sow (Vétérinaire) · Oumar (Gérant terrain) · Maître Diallo (Juriste) · Dr Fernandez (DG international)

---

### 11.0 À faire une seule fois — Fondateur (avant le 1er sinistre)

> ⛔ Sans ces étapes, aucun dossier CNAAS ne peut aboutir, quelle que soit la qualité de l'élevage.

#### Étape A — Souscrire la police CNAAS

1. Contacter CNAAS (siège Dakar ou agence Thiès) et souscrire **« Assurance Mortalité Bétail Tout Risque »**
2. Récupérer impérativement :
   - N° de police exact
   - Email officiel de déclaration sinistres
   - Téléphone agent CNAAS Thiès (vocal, pas seulement email)
   - Délai de déclaration contractuel (standard Code CIMA = 5 jours **ouvrables**)
   - Grille officielle d'indemnisation par race / classe d'âge
3. Lire les **exclusions** dans la police :
   - Animaux non vaccinés selon le protocole SOP défini → les enregistrements SOP de BOAN constituent la preuve
   - Maladie non déclarée lors de la souscription
   - Sinistre hors délai contractuel → l'email J+0 de BOAN est la protection contre ce risque
4. Comprendre la **franchise** (typiquement 10% de la valeur indemnisée) et le **délai réel d'indemnisation (30-60 jours)**
5. Saisir toutes ces infos dans BOAN : **Livrables > Contacts & Assurance**

#### Étape B — Contractualiser un vétérinaire agréé Thiès

1. Trouver un vétérinaire agréé en région de Thiès
2. Convenir de sa disponibilité pour : actes SOP planifiés + **constats de décès en urgence**
3. Récupérer : nom complet · email · numéro WhatsApp +221XXXXXXXXX
4. Saisir dans BOAN : **Livrables > Contacts & Assurance**, champ vétérinaire
5. ⚠️ **Sans certificat vétérinaire → dossier CNAAS rejeté** — c'est la pièce la plus critique

#### Étape C — Photographier chaque bête à son entrée (avec le gérant)

1. Pour chaque bête introduite dans le cycle : **photo de face + profil** avec marque auriculaire visible
2. Uploader sur Google Drive ou envoyer par WhatsApp
3. Coller l'URL dans BOAN : formulaire ajout bête, champ **"Photo de référence"**
4. En cas de vol : cette photo sera transmise à la gendarmerie pour signalement inter-brigades
5. En cas de litige CNAAS sur l'identité de l'animal : preuve irréfutable

> 🌍 Dr Fernandez : *"Les fermes avec photos initiales ont un taux d'acceptation CNAAS de 85-95% vs 30-40% sans documentation."*

---

### 11.1 Guide gérant — Décès d'un animal

> Contexte : vous découvrez qu'une bête est morte. **Les 30 premières minutes sont critiques.**

#### ÉTAPE 1 — Photographier AVANT tout geste (immédiat)

1. 📸 Photographier l'animal mort : vue de face · profil gauche/droit · boucle auriculaire · plaies ou signes visibles
2. 📸 Photographier l'environnement immédiat (abreuvoir, foin, voisinage)
3. Horodater les photos (regarder l'heure exacte sur le téléphone)
4. ⛔ **NE PAS ABATTRE — NE PAS ENTERRER — ne déplacer l'animal qu'en dernier recours**

#### ÉTAPE 2 — Appeler le fondateur VOCALEMENT

1. Appel téléphonique immédiat — ne pas envoyer un SMS d'abord
2. Donner : ID de l'animal · heure du constat · état visuel · votre position
3. Le fondateur se charge des appels CNAAS et vétérinaire — votre rôle est de rester sur place

#### ÉTAPE 3 — Saisir dans BOAN (dans l'heure)

1. Aller dans **Saisie > Santé**
2. Sélectionner l'animal → Décès = OUI
3. Remplir : symptômes observés · traitements donnés · coût estimé
4. Valider → l'app affiche la bannière rouge ⛔ et envoie les alertes automatiquement
5. ⚠️ Si pas de connexion réseau : **saisir quand même** — l'app garde les données et les envoie dès le retour réseau

#### ÉTAPE 4 — Maintenir l'animal intact

1. Couvrir l'animal avec une bâche (protection vautours, soleil direct)
2. Prendre des photos supplémentaires toutes les **6 heures** pour documenter l'état de dégradation
3. ⚠️ **Chaleur Thiès 35-40°C : décomposition visible dès 6-8h** — si aucun vétérinaire confirmé après 24h, appeler le fondateur
4. **Ne jamais enterrer sans autorisation écrite** du fondateur (qui aura obtenu l'accord CNAAS par SMS ou email)

> ⚖️ Maître Diallo : *"Une inhumation sans accord écrit peut être qualifiée de destruction de preuve sous le Code CIMA — pas seulement un risque de rejet de dossier, un risque juridique réel."*

#### ÉTAPE 5 — Accompagner le vétérinaire (J+1 à J+5)

1. Être présent lors du passage du vétérinaire
2. Lui montrer l'animal + les photos prises + votre carnet d'observations
3. S'assurer qu'il **signe le certificat de constatation** ce jour-là — ne pas repartir sans
4. Transmettre le certificat au fondateur immédiatement (photo WhatsApp)

> 📋 **Résumé gérant décès** : `📸 Photo → 📞 Fondateur → BOAN → ⛔ Ne pas enterrer → ✅ Certif vét`

---

### 11.2 Guide fondateur — Décès d'un animal

> Vous recevez l'appel du gérant ou la notification BOAN. Vous êtes probablement à Dakar.

#### ÉTAPE 1 — Appeler la CNAAS (dans l'heure)

1. Appeler l'**agent CNAAS Thiès** vocalement — l'appel crée une trace horodatée
2. Déclarer le sinistre à l'oral (à titre conservatoire)
3. Donner : N° police · ID animal · date/heure · race · poids entrée
4. ⚠️ **Demander explicitement** : *"Pouvez-vous coordonner la date de passage de votre expert avec la venue de notre vétérinaire Dr [nom] ?"*
5. Noter dans BOAN : **Livrables > Incidents** → heure de l'appel CNAAS (champ dédié)

#### ÉTAPE 2 — Appeler le vétérinaire

1. Appeler vocalement → confirmer la date de venue
2. Lui rappeler : certificat de constatation obligatoire + l'expert CNAAS viendra après lui
3. **La date vétérinaire doit être AVANT la date expert CNAAS** — sinon rejet dossier
4. Saisir les deux dates dans BOAN : **Livrables > Incidents** — l'app affiche une alerte si incohérence

#### ÉTAPE 3 — Surveiller via BOAN

1. La bannière rouge ⛔ est visible pour tous les rôles tant que le dossier est ouvert
2. Dashboard : si > 24h sans confirmation vétérinaire → le gérant reçoit une bannière WhatsApp relance automatique
3. Ne jamais cocher « Expert CNAAS passé » avant qu'il soit réellement venu

#### ÉTAPE 4 — Si l'expert CNAAS n'arrive pas dans les 24-36h

> 🩺 Dr Sow : *"À 35-40°C la décomposition est visible dès 6-8h. Après 24-36h, l'animal n'est plus présentable à un expert. Ne pas attendre 48h."*

1. **Appeler l'agent CNAAS Thiès vocalement**
2. Demander une **autorisation d'inhumation d'urgence**
3. Confirmer par **SMS ou email** — la confirmation écrite est obligatoire
4. N'enterrer qu'après réception de la confirmation écrite
5. Continuer à documenter par photos jusqu'à l'inhumation

#### ÉTAPE 5 — Suivi dossier J+7 / J+14

1. BOAN envoie des relances email automatiques à J+7 et J+14 si statut EN_COURS
2. À J+14 sans réponse → **appel vocal CNAAS recommandé** (l'app envoie une notification fondateur)
3. Suivre dans **Livrables > Incidents** : timeline dossier · checkboxes · statut CNAAS

#### ÉTAPE 6 — Clôture et capitalisation

1. Quand CNAAS confirme → cocher **"CNAAS a confirmé"** → statut CLOTURE
2. En fin de cycle, renseigner dans `Historique_Cycles` (section 10.1) :
   - Nombre de sinistres déclarés (col AC)
   - Nombre indemnisés (col AD)
   - Montant CNAAS reçu FCFA (col AE)
3. Calculer le taux d'acceptation : **objectif ≥ 80%** (benchmark documenté : 85-95%)

> 📋 **Résumé fondateur décès** : `📞 CNAAS + dates → 📞 Vét → 👁️ Surveillance BOAN → 📝 Autorisation si > 24-36h → Suivi J+7/J+14 → ✅ Clôture + KPIs`

---

### 11.3 Guide gérant — Vol de bétail

> Contexte : vous constatez qu'un ou plusieurs animaux ont disparu.

> ⏱️ **FENÊTRE CRITIQUE : 48 heures pour la poursuite chaude.**
> Chaque heure perdue réduit les chances de retrouver les animaux de 10-15%.

#### ÉTAPE 1 — Sécuriser les preuves AVANT de bouger (5-10 min)

1. 📸 Photographier : accès forcé (serrure brisée, clôture), traces de passage, zone de disparition, animaux restants
2. Noter l'**heure exacte de découverte** (≠ heure supposée du vol) — regarder le téléphone
3. Interroger les témoins présents (veilleur, ouvriers) — noter leurs noms
4. Ne toucher à rien sur la scène avant d'avoir tout photographié

#### ÉTAPE 2 — Appeler le fondateur VOCALEMENT

1. Appel immédiat
2. Donner : liste des animaux disparus (IDs) · heure de découverte · état des lieux · témoins

#### ÉTAPE 3 — Aller à la gendarmerie de Thiès (immédiatement)

> 🚔 Adj. Chef Mbaye : *"Chaque heure dans la fenêtre 48h compte. Photographiez d'abord, venez nous voir ensuite avec les photos."*

1. Horaires accueil : **07h00–22h00** — urgence nuit : appel téléphonique direct à la brigade
2. Apporter : **photos des animaux** (photoRef si disponibles) · photos du lieu · pièce d'identité · liste animaux volés (ID, race, couleur, marques)
3. Déposer plainte → vous obtenez un **RÉCÉPISSÉ TAMPONNÉ** (immédiat, le même jour)
4. ⚠️ Le **N° PV officiel** est établi par la gendarmerie **24-72h plus tard** — c'est normal, **ne pas attendre** pour saisir dans BOAN
5. Garder précieusement le récépissé (c'est la pièce CNAAS J+0)

#### ÉTAPE 4 — Saisir dans BOAN (dès retour de la gendarmerie)

1. **Saisie > Incident > type = VOL**
2. Sélectionner tous les animaux volés (sélection multiple)
3. Saisir : heure du vol (si connue) + **heure de découverte** (champs distincts) · circonstances · N° récépissé gendarmerie
4. Le N° PV officiel peut être ajouté plus tard quand la gendarmerie le fournit
5. Valider → app envoie email CNAAS automatiquement + affiche le chronomètre 48h

#### ÉTAPE 5 — Suivre le chronomètre 48h dans BOAN

1. Dashboard gérant affiche un compte à rebours 48h dès la saisie du VOL
2. Si des pistes apparaissent (témoins, traces, informations) → **appeler le fondateur immédiatement**
3. Rester disponible pour la gendarmerie (rappels possibles pour précisions)
4. À réception du N° PV officiel : mettre à jour dans **Livrables > Incidents**

> 📋 **Résumé gérant vol** : `📸 Photos → 📞 Fondateur → 🚔 Gendarmerie (récépissé) → BOAN → ⏱️ Chrono 48h`

---

### 11.4 Guide fondateur — Vol de bétail

> Vous recevez l'appel du gérant ou la notification BOAN.

#### ÉTAPE 1 — Appeler la CNAAS (dans l'heure)

1. Appeler l'agent CNAAS Thiès vocalement
2. Déclarer le sinistre VOL à l'oral
3. Donner : N° police · liste animaux volés · N° récépissé gendarmerie · date et heure vol estimée
4. Demander : procédure spécifique VOL, pièces supplémentaires requises par votre police
5. L'email J+0 est envoyé automatiquement par BOAN — confirmer à l'oral que c'est fait

#### ÉTAPE 2 — Transmettre les photoRef à la gendarmerie

1. Si des photos initiales `photoRef` existent dans BOAN → les envoyer **immédiatement** à la brigade Thiès
2. Canal : WhatsApp au numéro brigade · ou email officiel gendarmerie
3. Ces photos permettent un **signalement inter-brigades** dans la fenêtre critique 48h

#### ÉTAPE 3 — Suivi jusqu'à clôture

1. Ajouter le N° PV officiel dans BOAN dès réception (24-72h après le dépôt)
2. Relances J+7 et J+14 envoyées automatiquement par BOAN
3. Clôture : cocher **"CNAAS a confirmé réception"** → statut CLOTURE

---

### 11.5 Guide RGA — Surveillance et escalade sinistres

> Rôle RGA : supervision des dossiers ouverts, escalade si blocage, contribution aux KPIs de fin de cycle.

#### Surveillance quotidienne

1. Ouvrir BOAN chaque matin → vérifier **badge numérique** sur l'onglet Livrables
2. **Livrables > Incidents** → passer en revue les dossiers EN_COURS
3. Signaux d'alerte à surveiller :
   - Dossier EN_COURS depuis **> 14 jours** sans mouvement → alerter le fondateur
   - `Certif_Vet_Recu` vide à J+7 → relancer le fondateur (vétérinaire non passé)
   - `Expert_Passe` vide à J+10 → relancer le fondateur (coordination CNAAS insuffisante)
   - Statut VOL avec N° PV manquant depuis > 3j → demander au gérant de vérifier à la brigade

#### En cas de dossier bloqué

1. Vérifier que tous les champs BOAN sont remplis (N° PV si VOL, dates visite, certif vét)
2. Si aucune réponse CNAAS à J+14 → recommander un **appel vocal** fondateur → CNAAS Thiès (l'email seul ne suffit plus)
3. Si dossier REJETE → analyser les raisons avec le fondateur (exclusion ? délai ? certif manquant ?) → corriger pour les prochains cycles

#### En fin de cycle

1. Vérifier que **tous** les sinistres ont un statut terminal (CLOTURE · REJETE · ANNULE)
2. Signaler au fondateur les dossiers encore ouverts avant l'archivage du cycle
3. Contribuer au remplissage des **KPIs CNAAS** dans `Historique_Cycles` (section 10.1) :
   - `nb_sinistres` · `sinistres_indemnises` · `montant_cnaas_recu` · `delai_moyen_cloture_j`

---

### 11.6 Guide gérant + fondateur — SOP Vétérinaire (actes planifiés)

> Le flux SOP est **quotidien et fréquent** — c'est la routine la plus visible de BOAN. Bien le maîtriser évite les rappels inutiles et les ratés de vaccination (cause d'exclusion CNAAS).

#### Rôle gérant — J-1 (la veille de l'acte)

1. Ouvrir BOAN → voir la **bannière orange 🔔** sur le dashboard
   - `Vétérinaire demain — [acte.label] le [date]`
2. Taper le bouton **💬 Rappel WhatsApp** → message pré-rempli envoyé au vétérinaire (msg 6.7)
3. Si le vét répond qu'il vient → taper **"✓ Déjà prévenu"** → bannière disparaît
4. Si pas de réponse → appeler vocalement

> ⚠️ Ne jamais faire partir le bouton WA par code automatique — toujours un tap utilisateur (règle navigateur).

#### Rôle gérant — Jour J de l'acte

1. Dashboard : bouton **"🔔 Rappel urgent J-0"** visible dans **Livrables > SOP Véto** (gérant uniquement)
2. Un tap → message WA urgent pré-rempli (msg 6.3)
3. Préparer la zone d'intervention : contenir le troupeau, accès libre
4. Être présent lors de l'acte

#### Rôle fondateur — Email CC reçu (J-3/J-2/J-1)

1. Email reçu en CC du rappel SOP (section 5.1) → vérification silencieuse que le cron tourne
2. Si le vét ne répond pas sous 24h → appel vocal direct + WA
3. En cas d'absence vét confirmée : noter la date de report dans BOAN (Livrables > SOP Véto)

#### Rôle fondateur — Après l'acte

1. Livrables > SOP Véto → bouton **"✓ Vétérinaire a confirmé"** (dans les 7j suivant l'acte prévu)
2. Cela remplit `Date_Confirmation` dans `Notifications_Log` → stop automatique des relances
3. Timeline J-3/J-2/J-1 affichée : ✓ envoyé / 🟢 confirmé / ⏳ en attente

> 📋 **Résumé SOP** : `📱 Bannière J-1 → 💬 WA → ✅ Acte → ☑ Fondateur confirme dans BOAN`

---

### 11.7 Matrice de décision rapide — Qui fait quoi ?

| Événement | Action immédiate | Qui | Délai max |
|---|---|---|---|
| Décès constaté | Photographier l'animal | Gérant | **Immédiat** |
| Décès constaté | Appeler fondateur vocalement | Gérant | < 30 min |
| Décès constaté | Saisir dans BOAN | Gérant | < 1h |
| Décès constaté | Appeler CNAAS vocalement + noter heure | Fondateur | < 1h |
| Décès constaté | Appeler vétérinaire + fixer date | Fondateur | < 1h |
| Décès constaté | Email CNAAS J+0 + email vét | **BOAN auto** | J+1 07h02 |
| Décès > 24h sans vét confirmé | Relancer vétérinaire (bannière WA) | Gérant (1 tap) | Dès bannière |
| Décès > 24-36h sans expert | Appeler CNAAS, demander autorisation inhumation **écrite** | Fondateur | Avant inhumation |
| Décès — expert non venu à J+7 | Relance email auto CNAAS | **BOAN auto** | J+7 07h04 |
| Décès — J+14 sans réponse | Appel vocal CNAAS + alerte fondateur | Fondateur | J+14 |
| Vétérinaire signe le certificat | Transmettre au fondateur (WhatsApp) | Gérant | Jour J |
| Certificat reçu | Cocher dans BOAN + transmettre CNAAS | Fondateur | Jour J |
| Expert CNAAS passé | Cocher dans BOAN → bannière ⛔ levée | Fondateur | Jour J |
| CNAAS confirme indemnisation | Clôturer dans BOAN + noter montant | Fondateur | Jour J |
| Vol constaté | Photographier lieu + animaux restants | Gérant | **Immédiat** |
| Vol constaté | Appeler fondateur | Gérant | < 30 min |
| Vol constaté | Aller à la gendarmerie (récépissé) | Gérant | < 2h **(fenêtre 48h)** |
| Vol — récépissé obtenu | Saisir dans BOAN | Gérant | Même jour |
| Vol — N° PV reçu (J+1-3) | Mettre à jour BOAN | Gérant ou RGA | Dès réception |
| Vol — photoRef disponibles | Transmettre à la gendarmerie | Fondateur | < 1h |
| Cycle terminé | Renseigner KPIs CNAAS | Fondateur + RGA | Avant archivage |

---

### 11.8 Points de vigilance critiques — Synthèse du panel

> Chaque point est issu d'une intervention concrète du panel.
> Chaque point a un impact direct mesuré sur l'acceptation ou le rejet du dossier CNAAS.

---

**🩺 Dr Sow (Vétérinaire, Thiès) — Décomposition dès 6-8h à 35-40°C**

> Ne pas attendre 48h. Si le vétérinaire ne peut pas venir dans les **24-36h**, le fondateur doit proactivement appeler CNAAS pour une autorisation d'inhumation d'urgence. Sans cette démarche, l'animal sera dans un état qui compromet à la fois la présentation à l'expert et la dignité de la procédure. L'app doit aider à déclencher cette conversation au bon moment.

**Action BOAN associée** : alerte fondateur dans la bannière ⛔ si > 24h sans confirmation vétérinaire + bouton « Appeler CNAAS urgence » dans l'interface fondateur.

---

**📋 M. Diouf (CNAAS, Dakar) — Les 3 raisons de rejet les plus fréquentes**

> 1. Animaux non vaccinés selon le protocole SOP défini dans la police → les enregistrements SOP de BOAN constituent la preuve — **ne jamais négliger la saisie SOP**
> 2. Déclaration hors délai contractuel → l'email J+0 automatique de BOAN est la protection — **ne pas attendre pour saisir**
> 3. Absence du certificat vétérinaire lors du passage de l'expert CNAAS → la coordination vét/expert est critique — **fixer les deux dates le J+0**

**Action BOAN associée** : alerte croisée si `Date_Visite_Expert < Date_Visite_Vet` dans Livrables > Incidents.

---

**🚔 Adj. Chef Mbaye (Gendarmerie, Thiès) — Erreur terrain la plus coûteuse**

> Aller à la gendarmerie sans photos des animaux et sans l'heure exacte de découverte. Le récépissé sera établi, mais le signalement inter-brigades sera inefficace dans la fenêtre 48h. **Photographier d'abord, toujours, avant de se déplacer.**

> Le récépissé tamponné est une pièce CNAAS valide en J+0. Le N° PV officiel vient 24-72h plus tard. BOAN ne doit pas bloquer la déclaration sur l'absence du N° PV.

**Action BOAN associée** : champ N° récépissé (obligatoire J+0) + champ N° PV (optionnel J+0, obligatoire avant clôture).

---

**⚖️ Maître Diallo (Juriste, Dakar) — Point légal mal connu**

> L'inhumation d'un animal sinistré sans accord écrit CNAAS peut être qualifiée de **destruction de preuve** sous le Code CIMA. Ce n'est pas qu'un risque de rejet de dossier — c'est un risque de mise en cause juridique. **L'autorisation doit être écrite** (SMS ou email). Un accord vocal seul ne suffit pas.

> La fenêtre d'annulation d'une saisie erronée à 30 minutes était injouable : le fondateur est souvent à Dakar, le gérant n'a parfois pas de réseau immédiatement. **4 heures est le minimum viable et légalement défendable.**

**Action BOAN associée** : bannière ⛔ avec mention explicite « Autorisation CNAAS écrite obligatoire avant inhumation » + bouton annulation visible 4h.

---

**🤠 Oumar (Gérant terrain, Thiès) — Réalité terrain ignorée**

> La brigade de Thiès ferme l'accueil public à 22h. Un vol découvert à 23h impose d'attendre 07h le lendemain pour déposer plainte — soit 8h perdues sur les 48h de poursuite chaude. L'app doit afficher le **numéro d'urgence** de la brigade pour la nuit + l'heure d'ouverture.

> Les week-ends et jours fériés allongent le délai d'établissement du PV. L'app doit être compréhensive si le N° PV arrive J+3 ou J+4 — et ne pas bloquer la déclaration CNAAS à cause de ça.

**Action BOAN associée** : afficher horaires brigade + numéro urgence dans le modal post-saisie VOL.

---

**🌍 Dr Fernandez (DG ferme internationale) — L'écart documenté**

> Les fermes qui documentent correctement (photo initiale par bête, SOP validés régulièrement, dossier sinistre complet assemblé avant la venue de l'expert) ont un taux d'acceptation CNAAS de **85-95%**. Les fermes sans documentation systématique : **30-40%**. La différence n'est pas la qualité de l'élevage — c'est la documentation. BOAN peut fermer cet écart dès le premier cycle si les fonctionnalités de section 10 sont implémentées.

**Action BOAN associée** : `photoRef` dans `CYCLE.betes[i]` + export PDF dossier complet (section 10.2) + KPIs fin de cycle (section 10.1).

---

> 📌 **Rappel architectural** : toutes les actions BOAN listées ci-dessus correspondent à des éléments déjà spécifiés dans les sections 2-10 de ce roadmap. La section 11 est le point d'entrée terrain vers la documentation technique.
