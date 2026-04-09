# BOAN — Roadmap Notifications Automatiques
> Version finale — Prête pour implémentation
> Statut : **BLOQUÉ — Prérequis métier non satisfaits** (voir section 0)
> Dernière mise à jour : Avril 2026

---

## 0. Contraintes fondamentales — À résoudre AVANT tout code

> ⛔ Sans ces trois éléments, le système tournera à vide ou produira des déclarations invalides.

### Chantier 1 — Vétérinaire attitré (Thiès)

Contractualiser avec un vétérinaire agréé de la région de Thiès. Rôle obligatoire :

- Suivre le troupeau selon le protocole SOP (actes planifiés J+N)
- **Signer le certificat de constatation du décès** — pièce obligatoire CNAAS
- Répondre aux rappels automatiques (email + WhatsApp J-7/J-3/J-2)
- Constituer un historique de suivi opposable pour tout sinistre

> Sans vétérinaire contractualisé : pas de certificat → dossier CNAAS rejeté.

### Chantier 2 — Contrat CNAAS

Contacter la CNAAS (siège Dakar ou agence Thiès) et obtenir :

- Police **"Assurance Mortalité Bétail Tout Risque"** souscrite AVANT tout sinistre
- **Numéro de police** exact
- **Email officiel** de déclaration de sinistres
- **Téléphone et WhatsApp** du correspondant sinistres
- **Délai contractuel** de déclaration (hypothèse : 24h — à confirmer)
- **Liste exacte des pièces** requises pour décès et pour vol

### Chantier 3 — Clause contractuelle critique : NE PAS ABATTRE NI ENTERRER

> ⛔ **CLAUSE BLOQUANTE** : la CNAAS exige que l'animal décédé ne soit pas abattu ni enterré avant le passage de leur expert. Toute violation de cette clause peut invalider le remboursement.

Ce que ça implique dans l'app :
- Bannière rouge persistante affichée dès que décès = OUI, **avant** le bouton Enregistrer
- La bannière reste visible sur le dashboard (gérant + fondateur) tant que le dossier est ouvert
- Mention explicite dans l'email déclaration CNAAS J+0 : _"L'animal n'a pas été abattu ni enterré — en attente de votre expert"_
- Checkbox fondateur : "Expert CNAAS passé — animal peut être retiré"

---

## 1. Pièces requises par la CNAAS pour un décès

> Source : pratique standard CNAAS Sénégal. À confirmer lors de la souscription (chantier 2).

| Pièce | Qui la produit | Quand | Pris en compte dans BOAN |
|---|---|---|---|
| Déclaration dans les 24h | App BOAN (email auto J+0) | J+0 | ✅ Email + WhatsApp auto |
| Certificat de constatation du décès | Vétérinaire attitré | J+1 à J+3 | ✅ Checkbox fondateur |
| Fiche d'identification de l'animal (race, âge indicatif, poids, N°) | App BOAN | J+0 dans email | ✅ Généré depuis `CYCLE.betes[].id/race/poidsEntree/dateIntro` |
| Historique des soins et vaccins | App BOAN | J+0 dans email | ✅ Généré depuis `Sante_Mortalite` + `SOP_Check` |
| Numéro de police d'assurance | Fondateur (config) | J+0 dans email | ✅ `contact_cnaas_n_police` |
| Photos de l'animal décédé | Gérant (manuel) | J+0 | ⚠️ Rappel dans l'app — pas de stockage (Option B) |
| Animal non abattu ni enterré | Gérant (engagement) | Continu | ✅ Bannière rouge + mention email |

---

## 2. Processus complet

### 2.1 CAS DÉCÈS — Bout en bout

```
J+0 — Gérant constate le décès

  ⚠️  AVANT DE SAISIR : photographier l'animal maintenant
      [Bannière rouge dans l'app dès que décès = OUI]
      ⛔ NE PAS ABATTRE NI ENTERRER L'ANIMAL — Attendre l'expert CNAAS

  1. Gérant saisit dans BOAN (Saisie > Santé) :
     - ID animal, race, poids, symptoms, traitements, décès = OUI
  2. [App] Email CNAAS envoyé automatiquement (À: CNAAS, CC: Fondateur, RGA)
     → Contient : fiche animal, historique soins/vaccins, valeur estimée,
       engagement "animal non abattu ni enterré"
  3. [App] Email Vétérinaire envoyé automatiquement (CC: Fondateur, RGA)
     → "Présence requise pour certificat de constatation"
  4. [App] Affiche boutons : 💬 WhatsApp Vét  📞 Appeler Vét
                              💬 WhatsApp CNAAS  📞 Appeler CNAAS
  5. [Gérant] Envoie photos par WhatsApp au vétérinaire et/ou CNAAS

J+1 à J+3 — Vétérinaire constate

  6. Vétérinaire vient constater → signe le certificat de décès
  7. Fondateur scanne/photo le certificat
     → Joint manuellement à un email de suivi CNAAS (objet: "Suite dossier [ID]")
  8. Fondateur coche dans app :
     ☑ "Certificat vétérinaire reçu"
     ☑ "Certificat transmis à CNAAS le [date]"

Relances automatiques (cron matinal, si pas de confirmation)
  J+2, J+5, J+10 → Email relance CNAAS (CC: Fondateur, RGA)
  J+10 → Ajout mention saisine Direction Régionale CNAAS

Expert CNAAS
  9. Expert CNAAS vient constater
  10. Fondateur coche : ☑ "Expert CNAAS passé — animal peut être retiré"
  11. Fondateur clique "CNAAS a confirmé réception" → dossier clôturé dans app

Clôture
  12. Indemnisation
```

### 2.2 CAS VOL — Bout en bout

```
J+0 — Gérant constate le vol

  1. Gérant va IMMÉDIATEMENT à la gendarmerie de Thiès
     → Récupère le récépissé/PV avec numéro (SANS ce numéro : pas de remboursement)
  2. Gérant saisit dans BOAN (Saisie > Incident > type = VOL) :
     - Animaux concernés (sélection multiple depuis liste bêtes)
     - N° PV gendarmerie — champ OBLIGATOIRE BLOQUANT
     - Date et heure du vol, circonstances
  3. [App] Email CNAAS envoyé automatiquement (CC: Fondateur, RGA)
  4. [App] Affiche boutons : 💬 WhatsApp CNAAS  📞 Appeler CNAAS

Relances automatiques
  J+2, J+5, J+10 → Email relance CNAAS
  J+10 → Mention saisine direction régionale

Clôture
  5. Fondateur clique "CNAAS a confirmé réception" → dossier clôturé
```

---

## 3. Interface utilisateur requise

### 3.1 Saisie Santé/Mortalité (décès = OUI) — Gérant

| Élément UI | Détail | Déclencheur |
|---|---|---|
| Bannière rouge `⛔ NE PAS ABATTRE NI ENTERRER` | Persistante — disparaît seulement quand expert CNAAS coché | Dès que décès = OUI |
| Alerte photo `📸 Photographiez l'animal MAINTENANT` | Affichée juste au-dessus du bouton Enregistrer | Dès que décès = OUI |
| `📧 Email CNAAS + Vétérinaire envoyés automatiquement` | Badge vert/spinner après submit | Post-submit |
| `💬 WhatsApp Vétérinaire` | `wa.me/[contact_vet_tel]?text=[msg_court]` | Post-submit |
| `📞 Appeler Vétérinaire` | `tel:[contact_vet_tel]` | Post-submit |
| `💬 WhatsApp CNAAS` | `wa.me/[contact_cnaas_whatsapp]?text=[msg_court]` | Post-submit |
| `📞 Appeler CNAAS` | `tel:[contact_cnaas_tel]` | Post-submit |

### 3.2 Livrables > Incidents (dossier sinistre actif) — Fondateur

| Élément UI | Détail |
|---|---|
| Bannière `⛔ NE PAS ENTERRER — Expert CNAAS n'est pas encore passé` | Visible jusqu'au coche "Expert passé" |
| Timeline dossier (J+0 envoyé / J+2 relance / J+5 relance / J+10 relance) | Dates réelles depuis `Sinistres_CNAAS` |
| Checkbox `☑ Certificat vétérinaire reçu` | Étape clé avant indemnisation |
| Champ `Certificat transmis à CNAAS le [date]` | Texte libre + date |
| Checkbox `☑ Expert CNAAS passé — animal peut être retiré` | Libère la bannière NE PAS ENTERRER |
| Bouton `✅ CNAAS a confirmé réception` | Clôture le dossier — fondateur uniquement |
| Bouton `⏸ Arrêter les relances` | Si confirmation CNAAS par téléphone (sans email) |

### 3.3 Saisie Incident VOL — Gérant

| Élément UI | Détail |
|---|---|
| Champ N° PV gendarmerie — **BLOQUANT si vide** | `required` — submit impossible sans |
| Champ date/heure dépôt de plainte | Preuve du délai |
| Sélection multiple animaux volés | Depuis `LIVE.beteIds` filtré décès |
| `💬 WhatsApp CNAAS` + `📞 Appeler CNAAS` | Post-submit, même logique décès |

### 3.4 Dashboard — Tous rôles

| Élément UI | Condition d'affichage |
|---|---|
| Bannière rouge `⛔ Dossier sinistre ouvert — NE PAS ENTERRER` | Tant que dossier décès non clôturé |
| Badge numérique sur onglet Livrables | Dossiers en attente de confirmation fondateur |

### 3.5 Config "Contacts & Assurance" — Fondateur uniquement (nouveau sous-onglet dans Livrables)

Champs persistés dans `Config_App` (clé-valeur) :

```
contact_vet_nom, contact_vet_email, contact_vet_tel
contact_cnaas_email, contact_cnaas_tel, contact_cnaas_whatsapp, contact_cnaas_n_police
ferme_email_expediteur, ferme_responsable_nom, ferme_responsable_tel
ferme_email_fondateur, contact_rga_email
```

---

## 4. Prérequis techniques

### 4.1 Compte SendGrid
- Créer sur [sendgrid.com](https://sendgrid.com) — plan Free : 100 emails/jour
- **Single Sender Verification** obligatoire (adresse expéditeur de la ferme)
- Recommandé : **Domain Authentication** SPF + DKIM (délivrabilité Orange/Yahoo Sénégal)
- Clé API → variable Vercel `SENDGRID_API_KEY`
- ⚠️ Compte suspendu après 30j d'inactivité → email test mensuel dans le cron

### 4.2 Onglets Google Sheets à créer manuellement

#### `Notifications_Log` (Sheet fondateur)
En-têtes ligne 1 :

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| Date_Envoi | Type | Reference_ID | Destinataire | Canal | Statut | Tentative_N | Date_Confirmation | Notes |

> Sans cet onglet, le premier run cron échoue silencieusement (erreur 400 Sheets).

#### `Sinistres_CNAAS` (Sheet fondateur)
En-têtes ligne 1 :

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| Date | Type | ID_Animal(s) | N°_PV_Gendarmerie | Statut | Date_Email_J0 | Certif_Vet_Recu | Expert_Passe | Relances_Stop | Notes |

Valeurs Statut : `EN_COURS` / `CERTIF_RECU` / `EXPERT_PASSE` / `CONFIRME` / `CLOTURE`

### 4.3 Contacts à collecter auprès du fondateur
```
contact_vet_nom          : Nom complet du vétérinaire
contact_vet_email        : Adresse email du vétérinaire
contact_vet_tel          : +221XXXXXXXXX — WhatsApp + appel direct

contact_cnaas_email      : Email officiel déclaration sinistres CNAAS
contact_cnaas_tel        : Téléphone CNAAS (appel direct)
contact_cnaas_whatsapp   : N° WhatsApp CNAAS — identique ou différent du tél
contact_cnaas_n_police   : Numéro de police d'assurance — OBLIGATOIRE
contact_cnaas_delai_h    : Délai contractuel déclaration en heures (ex: 24)

ferme_email_expediteur   : Adresse "De:" emails (verified sender SendGrid)
ferme_responsable_nom    : Nom du fondateur/responsable
ferme_responsable_tel    : Téléphone responsable
ferme_email_fondateur    : Email fondateur → CC sur tous les emails
contact_rga_email        : Email RGA → CC sur tous les emails
```

> **Règle CC systématique :** tout email envoyé par BOAN met fondateur + RGA en copie. Leur boîte mail constitue une **preuve d'envoi horodatée indépendante** de Notifications_Log — opposable en cas de litige CNAAS.

### 4.4 Variables d'environnement
```
Vercel > Settings > Environment Variables :
  SENDGRID_API_KEY = SG.xxxxxxxxxxxx
  CRON_SECRET      = [chaîne aléatoire ≥ 32 chars — ex: openssl rand -hex 32]

GitHub > Settings > Secrets > Actions :
  CRON_SECRET      = [même valeur]
```

> Contacts et emails (fondateur, RGA) sont dans `Config_App` Sheets — modifiables sans redéploiement.

---

## 5. Templates emails

> **En-tête CC sur tous les emails :**
> ```
> À  : [destinataire principal]
> CC : [ferme_email_fondateur], [contact_rga_email]
> De : [ferme_email_expediteur]
> ```

### 5.1 Rappel SOP vétérinaire (J-7 / J-3 / J-2)
```
À    : [contact_vet_email]
CC   : [ferme_email_fondateur], [contact_rga_email]
Objet : [BOAN] Rappel acte vétérinaire dans [N] jours — [TYPE_ACTE]

Bonjour [contact_vet_nom],

Rappel automatique — Ferme BOAN, Thiès, Sénégal.

Acte prévu     : [label_acte]
Date prévue    : [dateActe DD/MM/YYYY]
Dans           : [N] jours

Troupeau actuel :
  - Bêtes actives  : [MOCK.betes]
  - Poids moyen    : [calculé depuis Pesees] kg
  - Races          : [races du CYCLE]

[Si vaccination] ⚠️ Conservation vaccin requise : 2°C–8°C

[ferme_responsable_nom] — [ferme_responsable_tel]
Ferme BOAN, Thiès, Sénégal
---
Message automatique. Répondre à [ferme_email_expediteur].
```

### 5.2 Alerte vétérinaire — Décès constaté (J+0 immédiat)
```
À    : [contact_vet_email]
CC   : [ferme_email_fondateur], [contact_rga_email]
Objet : [BOAN] ⚠️ URGENT — Décès animal — Présence requise — [ID_ANIMAL]

Bonjour [contact_vet_nom],

Un animal est décédé à la Ferme BOAN. Votre présence est requise
en urgence pour établir le certificat de constatation du décès
destiné à la CNAAS.

Animal        : [ID_ANIMAL] — [race] — [poids_dernier] kg
Date/heure    : [date] à [heure]
Entrée élevage: [dateIntro]
Symptômes     : [symptomes]
Traitements   : [traitements_historique]

⛔ L'animal N'A PAS été abattu ni enterré — en attente de votre constat.

[ferme_responsable_nom] — [ferme_responsable_tel]
Ferme BOAN, Thiès, Sénégal
```

### 5.3 Déclaration CNAAS — Décès (J+0)
```
À    : [contact_cnaas_email]
CC   : [ferme_email_fondateur], [contact_rga_email]
Objet : [BOAN] Déclaration sinistre — Décès [ID_ANIMAL] — Police n°[N_POLICE]

Madame, Monsieur,

La Ferme BOAN déclare le sinistre suivant dans le délai contractuel de [delai_h]h.

TYPE DE SINISTRE  : Décès animal
N° POLICE         : [contact_cnaas_n_police]
DATE DU DÉCÈS     : [date]
HEURE             : [heure]
LIEU              : Ferme BOAN, Thiès, Sénégal

─── IDENTIFICATION DE L'ANIMAL ───
  Identifiant     : [ID_ANIMAL]
  Race            : [race]
  Poids entrée    : [poidsEntree] kg (entrée le [dateIntro])
  Poids actuel    : [poids_dernier_pesee] kg (pesée du [date_derniere_pesee])
  Valeur estimée  : [poids × prix_foirail_actuel] FCFA
    (basé sur relevé foirail du [date_dernier_prix_foirail])

─── HISTORIQUE DES SOINS ───
  Symptômes déclarés    : [symptomes]
  Traitements effectués : [traitements] — Coût total : [cout] FCFA
  Vaccinations SOP      : [liste actes SOP validés depuis Sante_Mortalite + SOP_Check]

─── HISTORIQUE DES PESÉES ───
  [tableau : date | poids (kg) | gain (kg) | GMQ (kg/j)]

─── ENGAGEMENT ───
  ⛔ L'animal N'A PAS été abattu ni enterré.
  Il est disponible pour constatation par votre expert.

Pièces à transmettre séparément dès disponibilité :
  □ Certificat de décès signé par Dr [contact_vet_nom]
  □ Photos de l'animal décédé (transmises par WhatsApp ou email de suivi)

[ferme_responsable_nom] — [ferme_responsable_tel]
Ferme BOAN, Thiès, Sénégal
```

### 5.4 Déclaration CNAAS — Vol (J+0)
```
À    : [contact_cnaas_email]
CC   : [ferme_email_fondateur], [contact_rga_email]
Objet : [BOAN] Déclaration sinistre — Vol bétail — Police n°[N_POLICE]

Madame, Monsieur,

La Ferme BOAN déclare le sinistre suivant dans le délai contractuel.

TYPE DE SINISTRE  : Vol de bétail
N° POLICE         : [contact_cnaas_n_police]
N° PV GENDARMERIE : [no_pv_gendarmerie]
DATE DU VOL       : [date] à [heure]
LIEU              : Ferme BOAN, Thiès, Sénégal

─── ANIMAUX VOLÉS ───
  [tableau : ID | Race | Poids | Valeur FCFA]
  TOTAL estimé : [somme] FCFA

Circonstances : [description]
Dépôt de plainte : Gendarmerie de Thiès, le [date_plainte]

[ferme_responsable_nom] — [ferme_responsable_tel]
Ferme BOAN, Thiès, Sénégal
```

### 5.5 Relances CNAAS — J+2 / J+5 / J+10
```
À    : [contact_cnaas_email]
CC   : [ferme_email_fondateur], [contact_rga_email]
Objet : [BOAN] Relance [N] — Police n°[N_POLICE] — Sinistre du [date_sinistre]

Madame, Monsieur,

Sans retour de votre part depuis notre déclaration du [date_J0],
nous vous adressons ce rappel.

Réf. sinistre : [Type] — [ID_ANIMAL ou N°_PV] — Police n°[N_POLICE]

[uniquement J+10]
Sans accusé de réception sous 5 jours ouvrés, nous procéderons
à la saisine de la Direction Régionale CNAAS de Thiès.

[ferme_responsable_nom] — [ferme_responsable_tel]
```

---

## 6. Templates WhatsApp (messages courts, adapté mobile)

> Technologie : `window.open('https://wa.me/[numero]?text=' + encodeURIComponent(msg), '_blank')`
> Même pattern que `partagerRapportJourWhatsApp()` déjà dans l'app.
> Si `numero` non configuré → `wa.me/?text=` (l'utilisateur choisit le contact).

### 6.1 WhatsApp Vétérinaire — Décès (J+0)
```
🚨 *BOAN — DÉCÈS ANIMAL*

Bête : [ID_ANIMAL] ([race], [poids] kg)
Date : [date] à [heure]
Symptômes : [symptomes]

⛔ Animal non enterré — présence requise pour certificat CNAAS.

Ferme BOAN — [ferme_responsable_nom] — [ferme_responsable_tel]
```

### 6.2 WhatsApp Vétérinaire — Rappel SOP
```
📅 *BOAN — Rappel SOP*

Acte : [label_acte]
Date prévue : [dateActe DD/MM/YYYY] (dans [N] jours)
Troupeau : [MOCK.betes] bêtes actives

Ferme BOAN — [ferme_responsable_tel]
```

### 6.3 WhatsApp CNAAS — Décès (J+0, après email auto)
```
📋 *BOAN — Déclaration sinistre (email envoyé)*

Type : Décès animal
Police : [N_POLICE]
Animal : [ID_ANIMAL] — [race] — [poids] kg
Date : [date]

⛔ Animal non abattu ni enterré — en attente expert.

Email de déclaration envoyé à [contact_cnaas_email].
[ferme_responsable_nom] — [ferme_responsable_tel]
```

### 6.4 WhatsApp CNAAS — Vol (J+0, après email auto)
```
📋 *BOAN — Déclaration sinistre (email envoyé)*

Type : Vol de bétail
Police : [N_POLICE]
N° PV gendarmerie : [no_pv_gendarmerie]
Date : [date]
Animaux : [liste IDs]

Email de déclaration envoyé à [contact_cnaas_email].
[ferme_responsable_nom] — [ferme_responsable_tel]
```

---

## 7. Architecture technique

### 7.1 Nouveaux fichiers à créer

#### `/api/notify.js`
```
Fonctions :
  sendEmail(to, subject, body, cc)          → SendGrid API
  buildWaUrl(tel, msg)                      → 'https://wa.me/'+tel+'?text='+encodeURIComponent(msg)
  logNotification(entry)                    → appendRow Notifications_Log
  updateNotificationStatus(rowIdx, status)  → batchUpdate Sheets
  checkAndSendVetReminders()                → SOP J-7/J-3/J-2
  checkAndSendDecesAlerts()                 → J+0 décès (vet + CNAAS) — déclenché aussi au flush offline queue
  checkAndSendVolAlerts()                   → J+0 vol (CNAAS)
  checkAndSendCnaasFollowups()              → relances J+2/J+5/J+10 (depuis Sinistres_CNAAS)
  safeText(s)                               → sanitize champs libres avant template email
  confirmVet(sopActeId)                     → Statut=CONFIRME dans Notifications_Log
  confirmCnaas(sinistreId)                  → Statut=CLOTURE dans Sinistres_CNAAS
  stopRelances(sinistreId)                  → Relances_Stop=OUI dans Sinistres_CNAAS
```

**`safeText` — obligatoire sur tous les champs libres :**
```js
function safeText(s) { return String(s || '').replace(/[<>&"]/g, '').slice(0, 500); }
```

**Guard offline — décès saisi hors connexion :**
```js
// Dans la ligne Sante_Mortalite : colonne M = 'email_pending' = 'OUI' si décès offline
// checkAndSendDecesAlerts() lit cette colonne chaque matin et envoie les emails manqués
```

#### `/api/cron.js`
```js
export default async function handler(req, res) {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  await checkAndSendVetReminders();
  await checkAndSendDecesAlerts();   // rattrape les décès offline
  await checkAndSendCnaasFollowups();
  return res.status(200).json({ ok: true, ts: new Date().toISOString() });
}
```

#### `/.github/workflows/cron-notifications.yml`
```yaml
name: BOAN — Cron Notifications
on:
  schedule:
    - cron: '0 7 * * *'   # 07h00 UTC = 07h00 Dakar (UTC+0)
  workflow_dispatch:        # déclenchement manuel pour tests

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Déclencher le cron BOAN
        run: |
          curl -f -X GET \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}" \
            https://boan-app-ur3x.vercel.app/api/cron
```

### 7.2 Fichiers `index.html` à modifier

| Section | Modification |
|---|---|
| Livrables — nouveau sous-onglet `contacts` | Bloc Config "Contacts & Assurance" (fondateur) — tous les champs section 4.3, persistés dans Config_App |
| Saisie > Santé (décès = OUI) | Bannière rouge `⛔ NE PAS ENTERRER`, alerte photo avant submit, boutons WhatsApp/appel vet + CNAAS post-submit |
| Saisie > Incident (type VOL) | Champ N° PV gendarmerie obligatoire bloquant, sélection multiple animaux, boutons WhatsApp/appel CNAAS post-submit |
| Livrables > Incidents | Timeline dossier `Sinistres_CNAAS`, checkboxes fondateur, bouton "CNAAS confirmé" / "Arrêter relances", bannière NE PAS ENTERRER si expert não passé |
| Livrables > SOP Vétérinaire | Bouton "Vétérinaire confirme" conditionnel (acte dans les 7j) |
| Dashboard — bannière conditionnelle | `⛔ Dossier sinistre ouvert` si `Sinistres_CNAAS` a une ligne `EN_COURS` |
| `doSubmit('sante')` côté offline | Marquer `email_pending=OUI` dans la ligne Sheets si offline au moment du décès |

---

## 8. Points bloquants techniques

### #1 — `Notifications_Log` absent au premier run
**Solution :** Créer manuellement (section 4.2). 2 min.

### #2 — Doublons emails si cron retry
**Solution — idempotence double guard :**
```js
// 1. Lire Notifications_Log + Sinistres_CNAAS en début de cron
// 2. Vérifier Reference_ID + Date_Envoi = aujourd'hui + Statut ≠ ERREUR
// 3. Logger Statut=PENDING AVANT l'appel SendGrid
// 4. Mettre à jour Statut=SENT ou Statut=ERROR après réponse
```

### #3 — Délivrabilité SendGrid (Orange / Yahoo Sénégal)
**Solution :**
- Single Sender Verification minimum (5 min)
- Domain Authentication SPF + DKIM recommandée (20 min, accès DNS)
- Email test mensuel dans le cron (cron envoie un "heartbeat" à ferme_email_fondateur)

### #4 — Email décès non envoyé si offline au moment du submit
**Solution :**
- `doSubmit('sante')` : si offline → écrire `email_pending=OUI` dans la ligne (colonne M de `Sante_Mortalite`)
- `checkAndSendDecesAlerts()` dans le cron : lire toutes les lignes `email_pending=OUI` → envoyer l'email → effacer le flag

### #5 — Vétérinaire ne lit probablement pas ses emails (terrain)
**Solution UI (zéro infrastructure) :**
- Bouton `💬 WhatsApp Vétérinaire` affiché immédiatement post-submit
- Bouton `📞 Appeler Vétérinaire` — `tel:` link
- L'email reste envoyé (trace écrite) mais l'humain est alerté par WhatsApp

### #6 — Valeur déclarée CNAAS basée sur prix foirail potentiellement obsolète
**Solution :**
- Mention dans l'email : _"Valeur estimée basée sur relevé foirail du [date_dernier_prix]"_
- Alerte bloquante au submit décès si dernier prix foirail > 30 jours : _"⚠️ Prix foirail non mis à jour depuis [N] jours — la valeur déclarée sera approximative"_

### #7 — N° police absent au moment d'un décès urgent
**Solution 3 niveaux :**
```
1. Blocage soft avant submit : "⚠️ N° police non configuré → email CNAAS incomplet"
2. Email envoyé avec "Police n°[À COMPLÉTER]" visible
3. Statut Notifications_Log = INCOMPLET_POLICE
```

### #8 — Injection contenu dans email depuis champs libres
**Solution :** `safeText(s)` sur tous les champs gérant (symptômes, description, circonstances) avant composition du template email.

### #9 — Âge animal non tracké dans `CYCLE.betes`
**Contexte :** `CYCLE.betes = [{id, race, poidsEntree, dateIntro}]` — pas de date de naissance.
**Solution :** L'email utilise `dateIntro` comme "Date d'entrée en élevage" — suffisant pour la CNAAS. Si un âge précis est requis, ajouter un champ `anneeNaissance` optionnel dans la fiche bête (modal init cycle).

### #10 — `sopProtocol` JSON corrompu côté serveur
**Solution :**
```js
try {
  var prot = JSON.parse(sopProtocolRaw);
  prot.forEach(function(a) { if (!a.j || isNaN(parseInt(a.j))) throw new Error('Acte invalide'); });
} catch(e) {
  logNotification({ type:'VET_ERROR', notes:'sopProtocol invalide: ' + e.message });
  return;
}
```

---

## 9. Ordre d'implémentation

```
BLOC A — HORS CODE (prérequis absolus)
  □ [Chantier 1] Contractualiser vétérinaire agréé Thiès — nom, email, +221XX, WhatsApp
  □ [Chantier 2] Souscrire police CNAAS — N° police, email, tel, WhatsApp, délai, liste pièces
  □ Créer compte SendGrid + Single Sender Verification de l'adresse ferme
  □ Créer onglet Notifications_Log dans Sheet fondateur (9 colonnes — section 4.2)
  □ Créer onglet Sinistres_CNAAS dans Sheet fondateur (10 colonnes — section 4.2)
  □ Collecter tous les contacts (section 4.3) + emails fondateur + RGA
  □ Ajouter SENDGRID_API_KEY + CRON_SECRET dans Vercel + GitHub Secrets

BLOC B — Config UI index.html
  □ Sous-onglet "Contacts & Assurance" dans Livrables (fondateur) — tous les champs 4.3
  □ Persistance dans Config_App Sheets (clé/valeur — même pattern que gmqCible etc.)
  □ Bannière rouge ⛔ NE PAS ENTERRER dans Santé (décès = OUI) + Dashboard
  □ Alerte photo ⚠️ avant bouton Enregistrer (décès = OUI)
  □ Champ N° PV gendarmerie bloquant + sélection multiple animaux dans formulaire VOL
  □ Alerte prix foirail obsolète > 30j dans formulaire décès

BLOC C — API serveur
  □ /api/notify.js — toutes les fonctions (section 7.1)
  □ /api/cron.js — endpoint sécurisé, appelle les 3 check functions
  □ Ajouter colonne M email_pending dans Sante_Mortalite (guard offline)

BLOC D — GitHub Actions
  □ .github/workflows/cron-notifications.yml (section 7.1)
  □ Ajouter CRON_SECRET dans GitHub Secrets

BLOC E — Boutons et statuts index.html
  □ Boutons 💬 WhatsApp + 📞 Appel Vétérinaire post-submit décès
  □ Boutons 💬 WhatsApp + 📞 Appel CNAAS post-submit décès + vol
  □ Bouton "Vétérinaire confirme" (conditionnel — acte SOP dans 7j)
  □ Checkboxes fondateur : Certif reçu / Certif transmis / Expert passé
  □ Bouton "CNAAS a confirmé réception" (clôture dossier)
  □ Bouton "Arrêter les relances" (confirmation téléphone)
  □ Timeline dossier sinistre depuis Sinistres_CNAAS
  □ Badge statut email (lecture Notifications_Log via loadLiveData)
  □ Badge numérique onglet Livrables si dossier(s) en attente

BLOC F — Tests (ne jamais tester sur vrais emails CNAAS/vet)
  □ Test curl /api/cron avec x-cron-secret → vérifier réponse 200
  □ Test email vers adresses fondateur/RGA de test → vérifier CC
  □ Test WhatsApp → vérifier ouverture conversation avec message pré-rempli
  □ Vérifier lignes créées dans Notifications_Log + Sinistres_CNAAS
  □ Tester idempotence : appeler /api/cron deux fois → une seule ligne dans Notifications_Log
  □ Tester mode offline : soumettre décès hors connexion → email_pending=OUI → cron envoie
  □ Tester N° police vide → alerte bloquante
  □ Tester prix foirail > 30j → alerte
  □ Mise en production
```

---

## 10. Statut actuel

| Item | Statut |
|---|---|
| Vétérinaire contractualisé (Thiès) | ⛔ Non fait — **bloquant** |
| Contrat CNAAS souscrit + N° police | ⛔ Non fait — **bloquant** |
| Email/tel/WhatsApp CNAAS confirmés | ⛔ Non fait — bloquant |
| Compte SendGrid | ⛔ Non fait |
| Onglet Notifications_Log | ⛔ Non fait |
| Onglet Sinistres_CNAAS | ⛔ Non fait |
| Contacts collectés (section 4.3) | ⛔ Non fait |
| Variables Vercel + GitHub Secrets | ⛔ Non fait |
| Code implémenté (Blocs C–E) | ⬛ En attente des prérequis |
