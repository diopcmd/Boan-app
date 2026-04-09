# BOAN — Roadmap Notifications Automatiques
> Analyse complète + contraintes métier + plan d'implémentation
> Statut : **BLOQUÉ — Prérequis métier non satisfaits** (voir section 0)
> Dernière mise à jour : Avril 2026

---

## 0. Contrainte fondamentale — À lire en premier

> ⛔ Le système de notifications ne peut **pas fonctionner correctement** sans contrat CNAAS actif et sans vétérinaire attitré. Le code peut être écrit, mais les emails seront vides, incorrects ou sans valeur légale. **Résoudre les deux chantiers ci-dessous avant tout code.**

### Chantier 1 — Vétérinaire attitré (Thiès)

Trouver et **contractualiser** avec un vétérinaire agréé de la région de Thiès. Il est indispensable pour :

- Suivre le troupeau selon le protocole SOP (actes planifiés)
- **Signer les certificats de décès** — pièce obligatoire CNAAS
- Répondre aux rappels automatiques de l'app (email J-7/J-3/J-2)
- Constituer un historique de suivi opposable en cas de sinistre

> Sans vétérinaire contractualisé, les rappels SOP sont envoyés dans le vide et la CNAAS peut refuser le dossier.

### Chantier 2 — Contrat CNAAS

Contacter la CNAAS (siège Dakar ou agence régionale Thiès) pour :

- Souscrire une police **"Assurance Mortalité Bétail Tout Risque"**
- Obtenir la **liste exacte des pièces** requises pour chaque type de sinistre (décès / vol)
- Confirmer le **délai contractuel** de déclaration (hypothèse : 24h — à vérifier)
- Connaître l'**email officiel** de déclaration de sinistre
- Noter le **numéro de police** exact

> Sans numéro de police, l'email CNAAAS est juridiquement invalide. Sans contrat actif antérieur au sinistre, aucun remboursement.

---

## 1. Processus complet (une fois les chantiers 1 et 2 résolus)

### 1.1 CAS DÉCÈS — Processus bout en bout

```
J+0 — Gérant constate le décès
  1. Gérant saisit dans BOAN (Saisie > Santé/Mortalité) :
     - ID animal, symptômes, date/heure, décès = OUI
     - Photo de l'animal (champ optionnel — preuve visuelle CNAAS)
  2. App envoie EMAIL CNAAS immédiatement
     → Déclaration dans les 24h respectée (délai contractuel)
  3. App envoie EMAIL VÉTÉRINAIRE immédiatement
     → "Animal décédé — votre présence requise pour certificat"

J+1 à J+3 — Vétérinaire constate
  4. Vétérinaire vient constater → signe le certificat de décès
  5. Fondateur scanne/photo le certificat
     → Joint manuellement à un email de suivi CNAAS
     → Ou upload dans l'app (fonctionnalité future)
  6. Fondateur coche "Certificat transmis à CNAAS" dans l'app

Relances automatiques si aucune confirmation
  J+2, J+5, J+10 → relances email CNAAS

Clôture
  7. CNAAS envoie son expert constater
  8. Fondateur clique "CNAAS a confirmé réception" → dossier clôturé
  9. Indemnisation
```

### 1.2 CAS VOL — Processus bout en bout

```
J+0 — Gérant constate le vol
  1. Gérant va IMMÉDIATEMENT à la gendarmerie de Thiès
     → Récupère le récépissé/PV avec numéro
  2. Gérant saisit dans BOAN (Saisie > Incident > type = VOL) :
     - Animaux concernés (sélection multiple)
     - N° PV gendarmerie — champ OBLIGATOIRE (bloquant si vide)
     - Date, heure, circonstances
  3. App envoie EMAIL CNAAS immédiatement (J+0)

Relances automatiques si aucune confirmation
  J+2, J+5, J+10 → relances email CNAAS (J+10 : mention saisine direction régionale)

Clôture
  4. Fondateur clique "CNAAS a confirmé réception" → dossier clôturé
```

---

## 2. Interface utilisateur requise

### 2.1 Pour un décès

| Élément UI | Pourquoi | Rôle |
|---|---|---|
| Champ photo dans Santé/Mortalité | Preuve visuelle CNAAS | Gérant |
| Bouton "Alerter le vétérinaire" au submit | Déclenche email vét immédiat | Gérant |
| Badge `📧 Email CNAAS envoyé` après submit | Feedback confirmation envoi | Gérant |
| Statut dossier CNAAS (En cours / Confirmé / Clôturé) | Suivi fondateur | Fondateur |
| Checkbox "Certificat vétérinaire reçu" | Étape clé avant indemnisation | Fondateur |
| Champ "Certificat transmis à CNAAS" (date + note) | Traçabilité dossier | Fondateur |

### 2.2 Pour un vol

| Élément UI | Pourquoi | Rôle |
|---|---|---|
| Champ N° PV gendarmerie — **OBLIGATOIRE** | Sans ça, pas de remboursement | Gérant |
| Champ date/heure dépôt de plainte | Preuve du délai de déclaration | Gérant |
| Sélection multiple animaux volés | Email CNAAS détaillé par animal | Gérant |
| Badge `📧 Email CNAAS envoyé` après submit | Feedback confirmation envoi | Gérant |
| Statut dossier CNAAS (même système que décès) | Suivi fondateur | Fondateur |

### 2.3 Pour les deux types de sinistre

| Élément UI | Pourquoi | Rôle |
|---|---|---|
| Timeline sinistre (J+0, J+2, J+5, J+10) | Visibilité sur les relances | Fondateur |
| Badge "Expert CNAAS attendu" | Rappel de ne pas toucher l'animal | Fondateur/Gérant |
| Bloc Config "Contacts & Assurance" complet | N° police, email CNAAS, vétérinaire | Fondateur |
| Badge numérique sur onglet Livrables | Dossiers en attente de confirmation | Fondateur |

---

## 3. Prérequis techniques (en plus des chantiers 1 et 2)

### 3.1 Compte SendGrid
- Créer un compte sur [sendgrid.com](https://sendgrid.com) (plan Free : 100 emails/jour)
- Effectuer la **Single Sender Verification** (adresse `noreply@...` de la ferme)
- Recommandé : **Domain Authentication** SPF + DKIM (délivrabilité chez Orange/Yahoo Sénégal)
- Récupérer la clé API → ajouter dans Vercel : `SENDGRID_API_KEY`
- ⚠️ Compte désactivé après 30j d'inactivité → un email test mensuel dans le cron

### 3.2 Onglet `Notifications_Log` dans le Sheet fondateur
Créer manuellement avec ces en-têtes en ligne 1 :

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| Date_Envoi | Type | Reference_ID | Destinataire | Canal | Statut | Tentative_N | Date_Confirmation | Notes |

> Sans cet onglet, le premier run cron échoue silencieusement (erreur 400 Sheets).

### 3.3 Contacts à collecter auprès du fondateur
```
contact_vet_nom         : Nom complet du vétérinaire
contact_vet_email       : Adresse email du vétérinaire
contact_vet_tel         : Téléphone

contact_cnaas_email     : Email officiel déclaration sinistres CNAAS
contact_cnaas_n_police  : Numéro de police d'assurance (OBLIGATOIRE)
contact_cnaas_delai_h   : Délai contractuel déclaration (ex: 24)

ferme_email_expediteur  : Adresse "De:" pour les emails (verified sender)
ferme_responsable_nom   : Nom du fondateur/responsable
ferme_responsable_tel   : Téléphone responsable
```

### 3.4 Variables d'environnement Vercel + GitHub
```
Vercel Settings > Environment Variables :
  SENDGRID_API_KEY = SG.xxxxxxxxxxxx
  CRON_SECRET      = [chaîne aléatoire ≥ 32 chars]

GitHub Settings > Secrets > Actions :
  CRON_SECRET      = [même valeur que Vercel]
```

---

## 4. Templates emails

### 4.1 Email vétérinaire — Rappel SOP (J-7/J-3/J-2)
```
Objet : [BOAN] Rappel acte vétérinaire dans [N] jours — [TYPE_ACTE]

Bonjour [contact_vet_nom],

Rappel automatique — Ferme BOAN, Thiès, Sénégal.

Acte prévu     : [label_acte]
Date prévue    : [dateActe en DD/MM/YYYY]
Dans           : [N] jours

Troupeau actuel :
  - Bêtes actives : [MOCK.betes]
  - Poids moyen   : [calculé depuis Pesees] kg
  - Races         : Gobra / Djakoré

[Si vaccination] ⚠️ Conservation requise : 2–8°C

Coordonnées ferme :
[ferme_responsable_nom] — [ferme_responsable_tel]
Ferme BOAN, Thiès, Sénégal
---
Ce message est automatique. Répondre à [ferme_email_expediteur].
```

### 4.2 Email vétérinaire — Décès constaté (J+0 immédiat)
```
Objet : [BOAN] ⚠️ Décès animal — Présence requise — [ID_ANIMAL]

Bonjour [contact_vet_nom],

Un animal est décédé à la Ferme BOAN. Votre présence est requise
pour établir le certificat de décès destiné à la CNAAS.

Animal : [ID_ANIMAL] — [race] — [poids] kg
Date   : [date] à [heure]
Symptômes déclarés : [symptomes]

Merci de vous présenter dans les meilleurs délais.

[ferme_responsable_nom] — [ferme_responsable_tel]
Ferme BOAN, Thiès, Sénégal
```

### 4.3 Email CNAAS — Déclaration décès (J+0)
```
Objet : [BOAN] Déclaration sinistre — Décès [ID_ANIMAL] — Police n°[N_POLICE]

Madame, Monsieur,

La Ferme BOAN déclare le sinistre suivant dans le délai contractuel.

TYPE              : Décès animal
N° POLICE         : [contact_cnaas_n_police]
DATE DU DÉCÈS     : [date]
LIEU              : Ferme BOAN, Thiès, Sénégal

Animal concerné :
  - Identifiant   : [ID_ANIMAL]
  - Race          : [race]
  - Poids (dernière pesée) : [poids] kg
  - Valeur estimée : [poids × prix_foirail_actuel] FCFA

Symptômes déclarés  : [symptomes]
Traitements effectués : [traitements] — Coût : [cout] FCFA

Historique des pesées :
  [tableau : date | poids | gain | GMQ]

Pièces à joindre (à transmettre séparément dès disponibilité) :
  □ Certificat de décès signé par le vétérinaire [contact_vet_nom]
  □ Photos de l'animal décédé

Responsable : [ferme_responsable_nom] — [ferme_responsable_tel]
Ferme BOAN, Thiès, Sénégal
```

### 4.4 Email CNAAS — Déclaration vol (J+0)
```
Objet : [BOAN] Déclaration sinistre — Vol bétail — Police n°[N_POLICE]

Madame, Monsieur,

La Ferme BOAN déclare le sinistre suivant dans le délai contractuel.

TYPE              : Vol de bétail
N° POLICE         : [contact_cnaas_n_police]
N° PV GENDARMERIE : [no_pv_gendarmerie]  ← OBLIGATOIRE
DATE DU VOL       : [date]
HEURE             : [heure]

Animaux volés :
  [tableau : ID | Race | Poids | Valeur FCFA]
  TOTAL estimé : [somme] FCFA

Circonstances : [description]

Dépôt de plainte : Gendarmerie de Thiès, le [date_plainte]

Responsable : [ferme_responsable_nom] — [ferme_responsable_tel]
Ferme BOAN, Thiès, Sénégal
```

### 4.5 Email CNAAS — Relances J+2 / J+5 / J+10
```
Objet : [BOAN] Relance [N] — Sinistre [ID_SINISTRE] — Police n°[N_POLICE]

[En-tête rappelant la déclaration initiale...]

Sans accusé de réception sous 5 jours ouvrés à compter de ce message,
nous procéderons à la saisine de la Direction Régionale CNAAS de Thiès.
[ajouté uniquement à J+10]
```

---

## 5. Architecture technique

### 5.1 Fichiers à créer

#### `/api/notify.js`
```
Fonctions exportées :
  sendEmail(to, subject, body)                → appel SendGrid API
  logNotification(entry)                      → appendRow dans Notifications_Log
  updateNotificationStatus(rowIdx, status)    → batchUpdate Sheets
  checkAndSendVetReminders()                  → logique SOP J-7/J-3/J-2
  checkAndSendDecesAlerts()                   → envoi J+0 décès (vét + CNAAS)
  checkAndSendVolAlerts()                     → envoi J+0 vol (CNAAS)
  checkAndSendCnaasFollowups()                → logique relances J+2/J+5/J+10
  confirmVet(sopActeId)                       → Statut=CONFIRME
  confirmCnaas(sinistreId)                    → Statut=CNAAS_CONFIRME
```

#### `/api/cron.js`
```js
export default async function handler(req, res) {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  await checkAndSendVetReminders();
  await checkAndSendCnaasFollowups();
  return res.status(200).json({ ok: true, ts: new Date().toISOString() });
}
```

#### `/.github/workflows/cron-notifications.yml`
```yaml
name: BOAN — Cron Notifications
on:
  schedule:
    - cron: '0 7 * * *'   # 07h00 UTC = 07h00 heure Dakar (UTC+0)
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

### 5.2 Fichiers `index.html` à modifier

| Section | Modification |
|---|---|
| Livrables > Trésorerie > Contacts | Bloc "Contacts & Assurance" (fondateur) — N° police, email CNAAS, vétérinaire |
| Saisie > Incident (type VOL) | Champ N° PV gendarmerie obligatoire + sélection multiple animaux |
| Saisie > Santé (décès = OUI) | Champ photo optionnel + bouton "Alerter le vétérinaire" |
| Livrables > Incidents | Statut dossier CNAAS + timeline + bouton "CNAAS a confirmé" (fondateur) |
| Livrables > SOP Vétérinaire | Bouton "Vétérinaire confirme" (conditionnel si acte dans 7j) |
| Dashboard (en-tête bannière) | Alerte conditionnelle si dossier sinistre sans confirmation |

---

## 6. Points bloquants techniques — Solutions validées

### Bloquant #1 — `Notifications_Log` inexistant au premier run
**Solution :** Créer l'onglet manuellement (voir section 3.2). 2 minutes.

### Bloquant #2 — Doublons emails si cron retry
**Solution — Double guard idempotence :**
```js
// 1. Lire Notifications_Log une seule fois au début du cron
// 2. Pour chaque notif à envoyer : vérifier absence Reference_ID + Date = aujourd'hui + Statut ≠ ERREUR
// 3. Logger Statut=PENDING AVANT l'appel SendGrid
// 4. Mettre à jour Statut=SENT ou Statut=ERROR après réponse
```

### Bloquant #3 — Délivrabilité SendGrid au Sénégal (Orange / Yahoo)
**Solution :**
- Minimum : Single Sender Verification (5 min)
- Recommandé : Domain Authentication SPF + DKIM (20 min, accès DNS requis)
- Email test mensuel dans le cron pour éviter désactivation du compte

### Bloquant #4 — `N_POLICE` vide au moment d'un sinistre urgent
**Solution — 3 niveaux :**
```
1. Blocage soft au submit si N_POLICE vide :
   "⚠️ N° police non configuré — email CNAAS incomplet. Configurer dans Livrables > Contacts."
2. Email généré avec placeholder visible : "Police n°[À COMPLÉTER]"
3. Statut Notifications_Log = INCOMPLET_POLICE → relance différée
```

### Bloquant #5 — `sopProtocol` JSON fragile côté serveur
**Solution :**
```js
try {
  var prot = JSON.parse(sopProtocolRaw);
  prot.forEach(function(acte) {
    if (!acte.j || isNaN(parseInt(acte.j))) throw new Error('Acte invalide');
  });
} catch(e) {
  logNotification({ type:'VET_ERROR', notes:'sopProtocol invalide: ' + e.message });
  return;
}
```

### Bloquant #6 — Feedback UI absent
**Solution :**
- Au submit décès/vol : badge `📧 Email CNAAS en cours...`
- Au prochain `loadLiveData()` : lire `Notifications_Log` → `✅ Email envoyé` ou `⚠️ Échec`
- Badge numérique sur onglet Livrables si dossier(s) en attente fondateur

---

## 7. Ordre d'implémentation

```
Bloc A — HORS CODE (à faire avant tout)
  □ [Chantier 1] Contractualiser vétérinaire agréé à Thiès
  □ [Chantier 2] Souscrire police CNAAS + obtenir email + délai + liste pièces
  □ Créer compte SendGrid + Single Sender Verification
  □ Créer onglet Notifications_Log dans Sheet fondateur (9 colonnes)
  □ Collecter contacts : vétérinaire, CNAAS, N° police, email expéditeur
  □ Ajouter SENDGRID_API_KEY et CRON_SECRET dans Vercel + GitHub Secrets

Bloc B — Config UI (index.html)
  □ Bloc "Contacts & Assurance" dans Livrables (fondateur uniquement)
  □ Persistance dans Config_App Sheets (clé/valeur)
  □ Champ N° PV gendarmerie obligatoire dans formulaire VOL
  □ Sélection multiple animaux dans formulaire VOL
  □ Champ photo optionnel dans formulaire Santé/Mortalité (décès = OUI)

Bloc C — API serveur
  □ /api/notify.js — toutes les fonctions
  □ /api/cron.js — endpoint sécurisé x-cron-secret

Bloc D — GitHub Actions
  □ .github/workflows/cron-notifications.yml

Bloc E — Boutons de confirmation + statuts (index.html)
  □ Bouton "Alerter le vétérinaire" (Santé, décès = OUI)
  □ Bouton "Vétérinaire confirme" (Dashboard conditionnel + Livrables SOP)
  □ Bouton "CNAAS a confirmé réception" (Livrables Incidents — fondateur)
  □ Checkbox "Certificat vétérinaire reçu" + "Certificat transmis CNAAS"
  □ Timeline dossier sinistre + badge "Expert CNAAS attendu"
  □ Badges statut email (lecture Notifications_Log via loadLiveData)

Bloc F — Tests
  □ Test manuel /api/cron avec curl + x-cron-secret
  □ Test email vers adresses de test (jamais vétérinaire/CNAAS réels en dev)
  □ Vérifier Notifications_Log dans Sheets après chaque envoi
  □ Tester guard idempotence (appeler /api/cron deux fois de suite)
  □ Tester offline queue sur les boutons de confirmation
  □ Mise en production
```

---

## 8. Statut actuel

| Item | Statut |
|---|---|
| Vétérinaire contractualisé | ⛔ Non fait — **bloquant** |
| Contrat CNAAS souscrit | ⛔ Non fait — **bloquant** |
| Compte SendGrid | ⛔ Non fait |
| Onglet Notifications_Log | ⛔ Non fait |
| Contacts collectés | ⛔ Non fait |
| Variables Vercel/GitHub | ⛔ Non fait |
| Code implémenté | ⬛ En attente des prérequis |
