# BOAN — Roadmap Notifications Automatiques
> Système de notifications email (vétérinaire + CNASS) — Analyse complète + plan d'implémentation
> Statut : **EN ATTENTE** — Ne pas implémenter avant de valider les prérequis section 1.

---

## Résumé exécutif

Deux systèmes de notification entièrement gratuits, déclenchés par GitHub Actions :
- **Système 1** : Rappels vétérinaire (SOP) à J-7, J-3, J-2 avant chaque acte planifié
- **Système 2** : Déclarations CNASS automatiques sur décès animal ou vol de bétail, avec relances J+0/J+2/J+5/J+10

**Stack** : GitHub Actions (cron gratuit) → `/api/cron.js` → SendGrid (100 emails/jour gratuit) → Gmail CNASS / Email vétérinaire

**Verdict panel d'experts** : Faisable à ~85%. 6 points à résoudre avant implémentation (détail section 3).

---

## 1. Prérequis — À valider AVANT tout code

> ⚠️ Ces 4 éléments doivent être prêts avant de lancer l'implémentation.

### 1.1 Compte SendGrid
- Créer un compte sur [sendgrid.com](https://sendgrid.com) (plan Free : 100 emails/jour)
- Effectuer la **Single Sender Verification** (adresse `noreply@...` de la ferme)
- Idéalement : configurer la **Domain Authentication** (SPF + DKIM) pour maximiser la délivrabilité
- Récupérer la clé API → ajouter dans Vercel : `SENDGRID_API_KEY`

### 1.2 Créer l'onglet `Notifications_Log` dans le Sheet fondateur
Créer **manuellement** un onglet `Notifications_Log` dans le Google Sheet du fondateur avec ces en-têtes en ligne 1 :

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| Date_Envoi | Type | Reference_ID | Destinataire | Canal | Statut | Tentative_N | Date_Confirmation | Notes |

> Sans cet onglet, le premier run cron échouera silencieusement (erreur 400 Sheets).

### 1.3 Collecter les contacts auprès du fondateur
```
contact_vet_nom        : Nom complet du vétérinaire
contact_vet_email      : Adresse email du vétérinaire
contact_vet_tel        : Téléphone

contact_cnass_nom      : Nom du référent CNASS
contact_cnass_email    : Email CNASS
contact_cnass_n_police : Numéro de police d'assurance

ferme_email_expediteur : Adresse "De:" pour les emails
ferme_responsable_nom  : Nom du responsable (Directeur)
ferme_responsable_tel  : Téléphone responsable
```

### 1.4 Variable d'environnement Vercel
Ajouter dans les Settings Vercel (Environment Variables) :
```
SENDGRID_API_KEY = SG.xxxxxxxxxxxx   ← obtenu à l'étape 1.1
CRON_SECRET      = [chaine aléatoire >= 32 chars]  ← ex: openssl rand -hex 32
```

---

## 2. Spécification complète

### 2.1 Système 1 — Rappels vétérinaire (SOP)

**Déclenchement :** GitHub Actions → `GET /api/cron` chaque matin 07h00 UTC

**Logique :**
```
Pour chaque acte dans sopProtocol :
  dateActe = CYCLE.dateDebut + acte.j jours
  Si dateActe - aujourd'hui ∈ {7, 3, 2} jours :
    → Vérifier dans Notifications_Log : pas déjà envoyé aujourd'hui (guard idempotence)
    → Logger Status=PENDING dans Notifications_Log AVANT d'envoyer
    → Envoyer email vétérinaire via SendGrid
    → Mettre à jour Status=SENT (ou Status=ERROR)
```

**Template email vétérinaire :**
```
Objet : [BOAN] Rappel acte vétérinaire dans [N] jours — [TYPE_ACTE]

Corps :
  Bonjour [contact_vet_nom],

  Rappel automatique — Ferme BOAN, Thiès, Sénégal.

  Acte prévu : [label_acte]
  Date prévue : [dateActe en DD/MM/YYYY]
  Dans : [N] jours

  Troupeau actuel :
  - Bêtes actives : [MOCK.betes]
  - Poids moyen : [calculé depuis Pesees] kg
  - Races : Gobra / Djakoré

  [Si vaccination] ⚠️ Conservation requise : 2–8°C

  Coordonnées ferme :
  [ferme_responsable_nom] — [ferme_responsable_tel]
  Ferme BOAN, Thiès, Sénégal

  ---
  Ce message est automatique. Répondre à [ferme_email_expediteur].
```

**Bouton "Vétérinaire confirme" (UI) :**
- Affiché uniquement si un rappel vétérinaire est actif (acte dans les 7 prochains jours)
- Rôles : gérant ET fondateur
- Localisation : Dashboard (bannière conditionnelle) + Livrables > SOP Vétérinaire
- Au clic : modal de confirmation → écriture `Notifications_Log` statut=`CONFIRME` → badge vert
- Compatible mode offline (utiliser la queue existante `OFFLINE_QUEUE`)

---

### 2.2 Système 2 — Notifications CNASS

**Déclencheurs immédiats (J+0) :**
- Décès animal : colonne G de `Sante_Mortalite` = `OUI` → envoi email CNASS immédiat
- Vol de bétail : formulaire incident avec `type = 'vol'` → envoi email CNASS immédiat

**Logique de relance (vérifiée par le cron chaque matin) :**
```
J+0  : Email initial (déclenché au moment de la saisie, pas par le cron)
J+2  : Première relance si Statut ≠ CNASS_CONFIRME
J+5  : Deuxième relance
J+10 : Troisième relance + mention saisine direction régionale CNASS
STOP : si fondateur clique "CNASS a confirmé réception"
```

**Template email CNASS — Décès :**
```
Objet : [BOAN] Déclaration sinistre — Décès [ID_ANIMAL] — Police n°[N_POLICE]

Corps :
  Madame, Monsieur,

  La Ferme BOAN déclare le sinistre suivant :

  TYPE : Décès animal
  N° POLICE ASSURANCE : [contact_cnass_n_police]

  Animal concerné :
  - Identifiant : [ID_ANIMAL]
  - Race : [race — Gobra ou Djakoré]
  - Poids dernière pesée : [poids] kg
  - Valeur marchande : [poids × prix_foirail_actuel] FCFA

  Date du décès : [date]
  Symptômes déclarés : [symptomes]
  Traitements effectués : [traitements] — Coût : [cout] FCFA

  Historique des pesées :
  [tableau : date | poids | gain | GMQ]

  Responsable : [ferme_responsable_nom] — [ferme_responsable_tel]
  Ferme BOAN, Thiès, Sénégal
```

**Template email CNASS — Vol :**
```
Objet : [BOAN] Déclaration sinistre — Vol bétail — Police n°[N_POLICE]

Corps :
  N° PLAINTE GENDARMERIE : [no_plainte] ← OBLIGATOIRE
  N° POLICE ASSURANCE    : [contact_cnass_n_police]

  Animaux volés :
  [liste : ID | Race | Poids | Valeur FCFA]
  TOTAL : [somme] FCFA

  Date : [date]
  Circonstances : [description]

  Responsable : [ferme_responsable_nom] — [ferme_responsable_tel]
```

**Template relance J+10 (ajout) :**
```
  Sans accusé de réception sous 5 jours ouvrés,
  nous procéderons à la saisine de la Direction Régionale CNASS de Thiès.
```

**Bouton "CNASS a confirmé réception" (UI) :**
- Rôle : fondateur UNIQUEMENT
- Localisation : Livrables > Incidents (sur chaque sinistre en attente)
- Au clic : modal → `Notifications_Log` statut=`CNASS_CONFIRME` → dossier CLÔTURÉ
- Badge numérique sur l'onglet Livrables si dossier(s) en attente

---

## 3. Points bloquants identifiés — Solutions validées

### Bloquant #1 — `Notifications_Log` inexistant
**Risque :** Premier run cron échoue silencieusement (erreur 400 Sheets).
**Solution :** Créer l'onglet manuellement (voir section 1.2). 2 minutes. ✅

### Bloquant #2 — Doublons emails si cron retry
**Risque :** GitHub Actions peut retenter en cas d'échec réseau → doublon email.
**Solution — Double guard dans `checkAndSendVetReminders()` et `checkAndSendCnassFollowups()` :**
```js
// 1. Lire Notifications_Log une seule fois
// 2. Pour chaque notification à envoyer : vérifier absence ligne Reference_ID + Date_Envoi = aujourd'hui + Statut != ERREUR
// 3. Logger Status=PENDING AVANT l'appel SendGrid
// 4. Mettre à jour Status=SENT ou Status=ERROR après la réponse
```

### Bloquant #3 — Délivrabilité SendGrid
**Risque :** Emails en spam chez CNASS / vétérinaire sénégalais (filtres Orange, Yahoo).
**Solution :**
- Minimum : Single Sender Verification sur sendgrid.com (5 min)
- Recommandé : Domain Authentication SPF + DKIM (20 min, accès DNS requis)
- Surveiller le dashboard SendGrid — compte désactivé après 30j d'inactivité → prévoir un email test mensuel dans le cron

### Bloquant #4a — `N_POLICE` non configuré lors d'un décès urgent
**Risque :** Email CNASS avec `Police n°[undefined]` → invalide légalement.
**Solution — 3 niveaux :**
```
1. Alerte non-bloquante au submit décès si N_POLICE vide
   "⚠️ N° police non configuré — l'email CNASS sera incomplet. Configurer dans Livrables > Contacts."
2. Email généré avec placeholder visible : "Police n°[À COMPLÉTER]"
3. Statut Notifications_Log = INCOMPLET_POLICE → relance différée
```

### Bloquant #4b — `sopProtocol` JSON fragile côté serveur
**Risque :** Si JSON modifié manuellement dans Sheets, `JSON.parse()` plante silencieusement.
**Solution — Validation obligatoire dans `checkAndSendVetReminders()` :**
```js
try {
  var prot = JSON.parse(sopProtocolRaw);
} catch(e) {
  logNotification({ type:'VET_ERROR', notes:'sopProtocol JSON invalide: ' + e.message });
  return;
}
// Valider chaque acte
prot.forEach(function(acte) {
  if (!acte.j || isNaN(parseInt(acte.j)) || !dateDebut) {
    logNotification({ type:'VET_ERROR', notes:'Acte invalide: ' + JSON.stringify(acte) });
    return;
  }
  // ... calcul date et envoi
});
```

### Bloquant #5 — Feedback UI absent
**Risque :** Gérant et fondateur ne savent pas si l'email a bien été envoyé.
**Solution :**
- Après chaque submit décès/vol : badge `📧 Email CNASS en cours...`
- Au prochain `loadLiveData()` : lire `Notifications_Log` et afficher `✅ Email envoyé` ou `⚠️ Email non envoyé`
- Badge numérique sur onglet Livrables si dossier CNASS en attente de confirmation fondateur

---

## 4. Fichiers à créer / modifier

### Nouveaux fichiers

#### `/api/notify.js`
```
Fonctions exportées :
  sendEmail(to, subject, body)                → appel SendGrid API
  logNotification(entry)                      → appendRow dans Notifications_Log
  updateNotificationStatus(rowIdx, status)    → batchUpdate Sheets
  checkAndSendVetReminders()                  → logique SOP J-7/J-3/J-2
  checkAndSendCnassFollowups()                → logique relances J+2/J+5/J+10
  confirmVet(sopActeId)                       → Statut=CONFIRME
  confirmCnass(sinistreId)                    → Statut=CNASS_CONFIRME
  ensureNotifLogExists(tk, sid)               → vérification onglet (optionnel)
```

#### `/api/cron.js`
```js
// Endpoint HTTP sécurisé par header x-cron-secret
export default async function handler(req, res) {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  await checkAndSendVetReminders();
  await checkAndSendCnassFollowups();
  return res.status(200).json({ ok: true, ts: new Date().toISOString() });
}
```

#### `/.github/workflows/cron-notifications.yml`
```yaml
name: BOAN — Cron Notifications
on:
  schedule:
    - cron: '0 7 * * *'   # 07h00 UTC chaque jour (= 07h00 heure Dakar UTC+0)
  workflow_dispatch:        # déclenchement manuel pour tests

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Déclencher le cron BOAN
        run: |
          curl -X GET \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}" \
            https://boan-app-ur3x.vercel.app/api/cron
```
> Ajouter `CRON_SECRET` dans GitHub → Settings → Secrets → Actions

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `index.html` | Bloc Config "Contacts & Assurance" (fondateur) |
| `index.html` | Champ N° plainte obligatoire (formulaire incident VOL) |
| `index.html` | Bouton "Vétérinaire confirme" (Dashboard + SOP) |
| `index.html` | Bouton "CNASS a confirmé réception" (Livrables > Incidents) |
| `index.html` | Badges statut email dans Incidents et Santé |

---

## 5. Ordre d'implémentation

```
Étape 1 — Prérequis (hors code)
  □ Créer compte SendGrid + Single Sender Verification
  □ Créer onglet Notifications_Log dans Sheet fondateur (8 colonnes)
  □ Collecter contacts vétérinaire + CNASS + N° police auprès du fondateur
  □ Ajouter SENDGRID_API_KEY et CRON_SECRET dans Vercel + GitHub Secrets

Étape 2 — Config UI (index.html)
  □ Bloc "Contacts & Assurance" dans Livrables (fondateur uniquement)
  □ Persistance dans Config_App Sheets (clé/valeur comme le reste)
  □ Champ N° plainte gendarmerie obligatoire dans formulaire VOL

Étape 3 — API côté serveur
  □ /api/notify.js — toutes les fonctions (sendEmail, log, check, confirm)
  □ /api/cron.js — endpoint sécurisé x-cron-secret

Étape 4 — Workflow GitHub Actions
  □ .github/workflows/cron-notifications.yml

Étape 5 — Boutons de confirmation (index.html)
  □ "Vétérinaire confirme" — Dashboard conditionnel + Livrables SOP
  □ "CNASS a confirmé" — Livrables Incidents
  □ Badges statut email (lecture Notifications_Log via loadLiveData)

Étape 6 — Tests
  □ Test manuel /api/cron avec curl + x-cron-secret
  □ Test email avec adresses de test (pas vétérinaire/CNASS réels)
  □ Vérifier Notifications_Log dans Sheets après chaque envoi
  □ Tester le guard idempotence (appeler /api/cron deux fois de suite)
  □ Tester offline queue sur les boutons de confirmation
  □ Mise en production
```

---

## 6. Variables d'environnement complètes après implémentation

```
# Existantes
PWD_FONDATEUR, PWD_GERANT, PWD_RGA, PWD_FALLOU
SID_FONDATEUR, SID_GERANT, SID_RGA, SID_FALLOU
SA_PRIVATE_KEY, SA_CLIENT_EMAIL
SESSION_SECRET
ANTHROPIC_API_KEY (optionnel)

# Nouvelles (à ajouter)
SENDGRID_API_KEY     ← clé API SendGrid (Free tier)
CRON_SECRET          ← secret partagé Vercel ↔ GitHub Actions (>= 32 chars)
```

---

*Analyse réalisée le 9 avril 2026 — Panel d'experts : Architecture, Fiabilité, Email, Métier, UX*
*Ne pas implémenter avant validation des 4 prérequis section 1.*
