# BOAN — Roadmap Notifications & Sinistres
> Version 2.0 — Intégralement refondue le 20 Avril 2026
> Statut : **BLOQUÉ — Prérequis métier non satisfaits** (voir section 0)
> Revue par : Architecte Backend · Expert UX Offline-first · Sécurité OWASP
>             Expert Email Afrique · Expert Assurance/Droit Sénégalais · Expert Terrain

> **Référence code** : `index.html` ~8 600 lignes, ES5 strict (`var`, pas `const`/`let`/arrow).
> Commit HEAD : `f4fb2e3`. App en prod : `https://boan-app-ur3x.vercel.app`

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
- **Délai contractuel** : Code CIMA = 5 jours ouvrables standard. Certaines polices imposent 24h — lire la police. L'email J+0 sert dans tous les cas de preuve horodatée.
- Liste exacte des pièces requises
- **Grille officielle d'indemnisation** par race/classe d'âge (`poids × prix_foirail` sera rejeté)

> **Déjà dans l'app** : `CYCLE.numCnaas` (clé `numCnaas` dans `Config_App` — modal init step 2 + Go/No-Go, commit `9766040`). Ne pas recréer.

### 0.3 Clause critique : NE PAS ABATTRE NI ENTERRER
La CNAAS exige que l'animal décédé reste intact jusqu'au passage de leur expert.
- ⚠️ Chaleur Thiès 35–40°C : après **48h**, risque sanitaire. Si expert CNAAS absent > 48h → contacter CNAAS pour autorisation d'inhumation.
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
| D | 3 | N_PV_Gendarmerie | VOL uniquement — obligatoire |
| E | 4 | Statut_CNAAS | `EN_COURS` `DOSSIER_RECU` `EXPERT_ASSIGNE` `EXPERTISE_PASSEE` `CONFIRME` `REJETE` `CLOTURE` `ANNULE` |
| F | 5 | Date_Email_J0 | YYYY-MM-DD |
| G | 6 | Appel_Fondateur_J0 | date/heure appel vocal fondateur — **saisi manuellement** |
| H | 7 | Certif_Vet_Recu | `OUI` / vide |
| I | 8 | Expert_Passe | `OUI` / vide |
| J | 9 | Relances_Stop | `OUI` / vide |
| K | 10 | email_pending | `OUI` / `NON` — flag décès offline, lu par le cron |
| L | 11 | Date_Visite_Vet_Prevue | YYYY-MM-DD — saisi par fondateur après appel J+0 |
| M | 12 | Date_Visite_Expert_CNAAS_Prevue | YYYY-MM-DD — saisi par fondateur après appel CNAAS J+0 |

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
       ⚠️ Annuler (erreur de saisie) — visible 30 min seulement

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

  1. Gérant va IMMÉDIATEMENT à la gendarmerie de Thiès
     → Récupère récépissé PV (SANS ce numéro : pas de remboursement)

  2. Gérant saisit dans BOAN (Saisie > Incident > type = VOL) :
     - Animaux concernés — beteMultiSelect() (sélection multiple)
     - N° PV gendarmerie — champ OBLIGATOIRE BLOQUANT
     - Date/heure vol, circonstances

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
| ⚠️ Annuler — erreur de saisie | Visible 30 min — email correctif CNAAS | `Date.now() - lsGet('last_deces_ts') < 30*60*1000` |

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

| Élément | Détail |
|---|---|
| Champ N° PV gendarmerie | `required` — submit bloqué si vide |
| Champ date/heure dépôt plainte | Preuve délai |
| Sélection bêtes concernées | `beteMultiSelect()` — helper section 3.8 |
| Post-submit | 1️⃣ 📞 Appeler CNAAS + 2️⃣ 💬 WhatsApp CNAAS (msg 6.5) |

**Initialisation** : ajouter `S.fin.beteIds = []` dans le reset de `S.fin` (~L1899).

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
| Bouton Annuler (30 min) | → Statut = ANNULE + email correctif CNAAS |

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
  readSheet(SID.fondateur, 'Sinistres_CNAAS!A2:M200').then(function(rows) {
    LIVE.sinistres = rows || [];
    _reconcileSinistresOuverts();
  });
  readSheet(SID.fondateur, 'Notifications_Log!A2:I500').then(function(rows) {
    LIVE.notifLog = rows || [];
  });
}
```

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
    Sinistres_CNAAS:   [['Date','Type','ID_Animal_s','N_PV_Gendarmerie','Statut_CNAAS',
                          'Date_Email_J0','Appel_Fondateur_J0','Certif_Vet_Recu',
                          'Expert_Passe','Relances_Stop','email_pending',
                          'Date_Visite_Vet_Prevue','Date_Visite_Expert_CNAAS_Prevue']]
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
            "https://boan-app-ur3x.vercel.app/api/cron?type=${{ steps.resolve.outputs.type }}"
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
  Valeur estimée : [cnaas_grille[race] ou poidsEntree × prix_foirail] FCFA

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
N° PV GENDARMERIE : [safeText(no_pv)]
DATE DU VOL       : [date] à [heure]
LIEU              : Ferme BOAN, Thiès, Sénégal

--- ANIMAUX VOLÉS ---
  [ID | Race | Poids entrée kg | Valeur FCFA]
  TOTAL estimé : [somme] FCFA

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
□ Modal + boutons post-submit décès : 1️⃣📞CNAAS 2️⃣📞Vét 3️⃣💬WA vét + Annuler 30min
□ viewSaisie() VOL : beteMultiSelect() (section 3.8) + S.fin.beteIds=[] dans reset (~L1899)
    + champ N° PV bloquant + boutons CNAAS post-submit
□ viewDash() : bannière ⛔ sinistre ouvert (tous rôles)
□ viewDash() gérant : _checkVetJ1Banners() + _checkDecesVetBanners() (section 3.3)
□ LIVE.sinistres + LIVE.notifLog chargés en Vague 2 loadLiveData (section 3.9)
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

| Item | Statut |
|---|---|
| Vétérinaire contractualisé (Thiès) | ⛔ Non fait — **bloquant absolu** |
| Contrat CNAAS + N° police | ⛔ Non fait — **bloquant absolu** |
| Email/tel CNAAS + grille indemnisation | ⛔ Non fait — bloquant |
| Compte SendGrid | ⛔ Non fait |
| Variables Vercel + GitHub Secrets | ⛔ Non fait |
| `Notifications_Log` + `Sinistres_CNAAS` | ⬛ Auto-créés au 1er run cron (section 4.1) |
| **`CYCLE.numCnaas`** | **✅ Implémenté** — modal init + Config_App + Go/No-Go (commit `9766040`) |
| **`CYCLE.veterinaire`** | **✅ Implémenté** — Config_Cycle col I |
| **`CYCLE.dateDebut` format ISO** | **✅ Déjà YYYY-MM-DD** — aucune conversion nécessaire |
| Code BLOC B + C + D | ⬛ En attente des prérequis BLOC A |
