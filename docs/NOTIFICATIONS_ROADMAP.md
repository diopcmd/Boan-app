# BOAN — Roadmap Notifications Automatiques
> Version finale — Prête pour implémentation
> Statut : **BLOQUÉ — Prérequis métier non satisfaits** (voir section 0)
> Dernière mise à jour : 20 Avril 2026 — aligné avec commit `9e5aca5`
> Revue par : Architecte Backend, Expert UX Offline-first, Expert Sécurité OWASP, Expert Email/Délivrabilité Afrique, Expert Assurance/Droit Sénégalais, Expert Terrain Opérationnel

> **Note de référence** : ce document est aligné sur l'état réel du code (`index.html`, ~8 600 lignes).
> Les noms de variables, fonctions et structures de données correspondent à ceux de l'app.

---

## 0. Contraintes fondamentales — À résoudre AVANT tout code

> ⛔ Sans ces trois éléments, le système tournera à vide ou produira des déclarations invalides.

### Chantier 1 — Vétérinaire attitré (Thiès)

Contractualiser avec un vétérinaire agréé de la région de Thiès. Rôle obligatoire :

- Suivre le troupeau selon le protocole SOP (actes planifiés J+N)
- **Signer le certificat de constatation du décès** — pièce obligatoire CNAAS
- Répondre aux rappels automatiques (WhatsApp **prioritaire** + email trace écrite) aux jalons **J-3 / J-2 / J-1**
- ⚠️ **WhatsApp = seul canal fiable** pour un vétérinaire rural à Thiès — l'email reste envoyé comme preuve opposable mais ne pas compter dessus comme action principale
- Confirmer sa venue → `vet_confirmed = TRUE` dans Notifications_Log → arrêt automatique des rappels suivants
- Constituer un historique de suivi opposable pour tout sinistre

> Sans vétérinaire contractualisé : pas de certificat → dossier CNAAS rejeté.

### Chantier 2 — Contrat CNAAS

Contacter la CNAAS (siège Dakar ou agence Thiès) et obtenir :

> **✅ Dans l'app** : le champ `CYCLE.numCnaas` est déjà implémenté (clé `numCnaas` dans `Config_App`, modal init step 2, onglet Go/No-Go). Sa présence active automatiquement le critère CNAAS dans le Go/No-Go. Il n'y a donc **pas** de migration de données à faire — juste remplir le champ.

- Police **"Assurance Mortalité Bétail Tout Risque"** souscrite AVANT tout sinistre
- **Numéro de police** exact
- **Email officiel** de déclaration de sinistres
- **Téléphone et WhatsApp** du correspondant sinistres
- **Délai contractuel de déclaration** (hypothèse : 24h — à confirmer)
  > ⚠️ Le Code des Assurances CIMA (applicable au Sénégal) fixe un délai standard de **5 jours ouvrables**.
  > Certaines polices imposent 24h contractuellement. À lire sur la police lors de la souscription.
  > L'email automatique J+0 reste utile comme **preuve d'envoi horodatée** même si le délai légal est plus long.
- **Liste exacte des pièces** requises pour décès et pour vol
- **Grille officielle d'indemnisation** par race et classe d'âge — à obtenir impérativement (remplace le calcul `poids × prix_foirail` qui sera rejeté comme non conforme)
- **Contact direct agent CNAAS Thiès** : un numéro de téléphone vocal (pas WhatsApp officiel — inexistant) pour les appels de déclaration urgente

### Chantier 3 — Clause contractuelle critique : NE PAS ABATTRE NI ENTERRER

> ⛔ **CLAUSE BLOQUANTE** : la CNAAS exige que l'animal décédé ne soit pas abattu ni enterré avant le passage de leur expert. Toute violation de cette clause peut invalider le remboursement.

> ⚠️ **Règle sanitaire 48h** : par 35–40°C à Thiès, un animal décédé devient un risque sanitaire après 48h.
> Si le vétérinaire/expert CNAAS n'est pas venu à J+2, le fondateur doit appeler la CNAAS pour obtenir
> une **autorisation d'inhumation** sans perdre le droit à indemnisation. Ce point doit figurer
> dans l'email J+0 et dans la bannière app. La bannière gérant doit afficher le compteur :
> *−4h avant risque sanitaire — Vétérinaire non passé*.

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
| Numéro de police d'assurance | Fondateur (config) | J+0 dans email | ✅ `CYCLE.numCnaas` (clé `numCnaas` dans Config_App — déjà implémenté commit `9766040`) |
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
  4. [App] Affiche modal : "✅ Emails envoyés. ⚠️ APPEL VOCAL FONDATEUR REQUIS maintenant —
     la CNAAS n'actionne pas sur email seul."
  5. [Fondateur en France] Appelle CNAAS Thiès vocalement (numéro dans contacts)
     → Colonne Sinistres_CNAAS : Appel_Fondateur_J0 = date/heure
  6. [App] Affiche boutons par priorité :
     1️⃣ 📞 Appeler CNAAS (bouton primaire)   — fondateur France + gérant terrain
     2️⃣ 📞 Appeler Vétérinaire (secondaire)
     3️⃣ 💬 WhatsApp Vétérinaire (secondaire)
  7. [Gérant] Envoie photos par WhatsApp au vétérinaire et/ou CNAAS agence

J+1 à J+5-7 — Vétérinaire constate ⚠️ délai réel terrain Thiès = 5-7 jours

  6. Vétérinaire vient constater → signe le certificat de décès
  7. Fondateur scanne/photo le certificat
     → Joint manuellement à un email de suivi CNAAS (objet: "Suite dossier [ID]")
  8. Fondateur coche dans app :
     ☑ "Certificat vétérinaire reçu"
     ☑ "Certificat transmis à CNAAS le [date]"

Relances automatiques (cron matinal, si Statut_CNAAS = EN_COURS)
  J+7  → Email relance courtois CNAAS (CC: Fondateur, RGA)
  J+14 → Email relance + notification fondateur "Appel vocal requis"
  ❌ La mention "saisine Direction Régionale" est supprimée — contre-productive
     en administration sénégalaise, brûle les ponts. Rester courtois.

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
  J+7  → Email relance courtois CNAAS
  J+14 → Email relance + notification fondateur "Appel vocal requis"

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
| Modal "Appel fondateur requis" | Texte : "✅ Emails envoyés. Prévenez le fondateur — il doit appeler la CNAAS vocalement." | Post-submit immédiat |
| `1️⃣ 📞 Appeler CNAAS` | Bouton **primaire** — `tel:[contact_cnaas_tel]` | Post-submit |
| `2️⃣ 📞 Appeler Vétérinaire` | Bouton secondaire — `tel:[contact_vet_tel]` | Post-submit |
| `3️⃣ 💬 WhatsApp Vétérinaire` | Bouton tertiaire — `wa.me/[contact_vet_tel]?text=...` | Post-submit |
| `⚠️ Annuler — erreur de saisie` | Bouton visible 30 min — envoi email correctif CNAAS | Post-submit, timeout 30 min |

### 3.2 Livrables > Incidents (dossier sinistre actif) — Fondateur

| Élément UI | Détail |
|---|---|
| Bannière `⛔ NE PAS ENTERRER — Expert CNAAS n'est pas encore passé` | Visible jusqu'au coche "Expert passé" — délai réel 5-7 jours |
| Modal post-submit "Appel fondateur requis" | S'affiche après submit décès : "✅ Email parti — ⚠️ Appeler CNAAS vocalement maintenant (la CNAAS n'actionne pas sur email seul)" |
| Bouton `⚠️ Annuler — erreur de saisie` | Visible 30 min après submit — déclenche email correctif CNAAS "fausse alerte" + marque ligne ANNULÉ |
| Timeline dossier (J+0 email / Appel fondateur / J+7 relance / J+14 relance) | Dates réelles depuis `Sinistres_CNAAS` — délais mis à jour |
| Statut CNAAS | Select fondateur : `En attente` / `Dossier reçu` / `Expert assigné` / `Expertise passée` / `Rejeté` — stoppe les relances auto dès ≠ `En attente` |
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

Champs persistés dans `Config_App` (clé-valeur — même pattern que `gmqCible`, via `_syncConfigApp()`) :

> **Champs déjà dans l'app (ne pas recréer) :**
> - `CYCLE.numCnaas` (clé `numCnaas`) — déjà dans Config_App + modal init + Go/No-Go
> - `CYCLE.veterinaire` (clé `veterinaire` dans Config_Cycle, pas Config_App) — champ texte nom du vétérinaire référent
>
> **À créer en tant que nouvelles clés dans Config_App :**

```
contact_vet_email         : Adresse email du vétérinaire
contact_vet_tel           : +221XXXXXXXXX — WhatsApp + appel direct
                           (⚠️ liens wa.me/ déclenchés manuellement — zéro risque ban WhatsApp)

contact_cnaas_email       : Email officiel déclaration sinistres CNAAS
contact_cnaas_tel         : Téléphone CNAAS (appel direct — canal principal)
contact_cnaas_whatsapp    : N° WhatsApp CNAAS — si disponible (souvent absent)

ferme_email_expediteur    : Adresse "De:" emails (verified sender SendGrid)
                           Si pas de domaine propre → utiliser ferme_email_fondateur directement
                           (Single Sender Verification SendGrid accepté sur adresse personnelle)
ferme_responsable_nom     : Nom du fondateur/responsable
ferme_responsable_tel     : Téléphone responsable
ferme_email_fondateur     : Email fondateur → CC sur tous les emails
contact_rga_email         : Email RGA → CC sur tous les emails

horaire_vet_dakar         : HH:MM heure d'intervention prévue (ex: 09:00)
contact_gerant_tel        : +221XXXXXXXXX — pour WhatsApp notification gérant J-1
jours_fermes              : JSON array de dates ISO (Tabaski, Magal…)
                            ex: ["2026-06-16","2026-06-17","2026-03-30","2026-04-04","2026-08-15"]
                            (pré-rempli pour 2026 : Tabaski ~16-17 juin, Aid-el-Fitr ~30 mars,
                             Indépendance 4 avril, Assomption 15 août, Tamkharit ~27 juillet)
cnaas_grille              : JSON {zebu_senegalais_18_36m: 1200000, ...} — à obtenir à la souscription
```

> **Note nommage** : `CYCLE.numCnaas` reste la source dans l'app. Dans les templates emails, utiliser
> `CYCLE.numCnaas` et non `contact_cnaas_n_police`. Les deux noms désignent le même champ.
> `CYCLE.veterinaire` est le nom du vétérinaire — afficher ce champ dans le sous-onglet Contacts & Assurance
> comme éditable (même valeur que dans Config_Cycle, synchronisé via `_syncCycle()`).

---

## 4. Prérequis techniques

### 4.1 Compte SendGrid
- Créer sur [sendgrid.com](https://sendgrid.com) — plan Free : 100 emails/jour
- **Single Sender Verification** obligatoire (adresse expéditeur de la ferme)
  > Si pas de domaine propre (ex: `ferme-boan.sn`) → utiliser directement `ferme_email_fondateur`.
  > Un Gmail ou Yahoo personnel est accepté comme Single Sender. La Domain Authentication SPF+DKIM
  > nécessite un accès DNS — facultative mais recommandée pour Orange Sénégal.
- **Plain text uniquement** — NE PAS envoyer d'emails HTML :
  > Les FAI africains (Orange Sénégal, Tigo, Expresso) filtrent agressivement les emails HTML.
  > Pour des emails de déclaration CNAAS (crítiques), plain text = meilleure délivrabilité + zéro risque XSS.
  > SendGrid : `content_type = 'text/plain'` dans l'appel API.
- **Objet emails** : NE PAS utiliser les crochets `[BOAN]` — classés spam par certains filtres.
  > ✅ Correct : `Déclaration sinistre BOAN — Décès [ID_ANIMAL] — Police n°[CYCLE.numCnaas]`
  > ❌ Incorrect : `[BOAN] Déclaration sinistre — ...`
- Recommandé : **Domain Authentication** SPF + DKIM (20 min, accès DNS)
- Email test mensuel dans le cron (cron envoie un "heartbeat" à ferme_email_fondateur)
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

| A | B | C | D | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|---|---|---|
| Date | Type | ID_Animal(s) | N°_PV_Gendarmerie | Statut_CNAAS | Date_Email_J0 | Appel_Fondateur_J0 | Certif_Vet_Recu | Expert_Passe | Relances_Stop | Notes |

Valeurs `Statut_CNAAS` : `EN_COURS` / `DOSSIER_RECU` / `EXPERT_ASSIGNE` / `EXPERTISE_PASSEE` / `CONFIRME` / `REJETE` / `CLOTURE`

> ⚠️ `Appel_Fondateur_J0` (nouvelle colonne K) : date/heure de l'appel vocal fondateur vers CNAAS — doit être rempli manuellement par le fondateur. Les relances automatiques vérifient cette colonne : si vide à J+2, notification fondateur "Appel requis".

### 4.3 Contacts à collecter auprès du fondateur
```
— Références CYCLE existantes (déjà dans l'app, pas à recréer) :
  CYCLE.veterinaire        : Nom du vétérinaire (clé 'veterinaire' dans Config_Cycle!A1:S1, col I)
  CYCLE.numCnaas           : N° police CNAAS (clé 'numCnaas' dans Config_App)

— Nouvelles clés à stocker dans Config_App via _syncConfigApp() :
  contact_vet_email        : Adresse email du vétérinaire
  contact_vet_tel          : +221XXXXXXXXX — WhatsApp + appel direct

  contact_cnaas_email      : Email officiel déclaration sinistres CNAAS
  contact_cnaas_tel        : Téléphone CNAAS (appel direct — canal principal)
  contact_cnaas_whatsapp   : N° WhatsApp CNAAS — si disponible (souvent absent)
  contact_cnaas_delai_h    : Délai contractuel déclaration en heures (ex: 24)

  ferme_email_expediteur   : Adresse "De:" emails (verified sender SendGrid)
  ferme_responsable_nom    : Nom du fondateur/responsable
  ferme_responsable_tel    : Téléphone responsable
  ferme_email_fondateur    : Email fondateur → CC sur tous les emails
  contact_rga_email        : Email RGA → CC sur tous les emails

  horaire_vet_dakar        : HH:MM heure d'intervention prévue (ex: 09:00)
                             → affiché dans bannière gérant J-1 "Vét arrive demain à 09h00"
  contact_gerant_tel       : +221XXXXXXXXX — pour WhatsApp notification gérant J-1
  jours_fermes             : JSON array de dates ISO YYYY-MM-DD (Tabaski, Magal, Gamou,
                             jours fériés nationaux SN) → cron skip avant d'envoyer rappels vet
                             ex: ["2026-03-30","2026-06-06"]
```

> **Note technique critique :** `CYCLE.dateDebut` est déjà stocké au format **`YYYY-MM-DD`** dans `Config_Cycle!A1` (col A) dans l'app — voir point #12 ci-dessous (résolu). Pas de migration nécessaire.

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

### 5.1 Rappel SOP vétérinaire (J-3 / J-2 / J-1)

> ❌ **J-7 supprimé** — Un vétérinaire rural planifie à la semaine, pas 7 jours à l'avance. Message ignoré, quota SendGrid gaspillé.
> ✅ **J-1 ajouté** — La veille est le jalon le plus efficace pour ancrer le RDV.
> ⚠️ **Si `vet_confirmed = TRUE`** (colonne `Date_Confirmation` renseignée dans Notifications_Log) → sauter l'envoi. Ne pas relancer un vétérinaire qui a déjà confirmé.

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
Objet : [BOAN] Déclaration sinistre — Décès [ID_ANIMAL] — Police n°[CYCLE.numCnaas]

Madame, Monsieur,

La Ferme BOAN déclare le sinistre suivant dans le délai contractuel de [contact_cnaas_delai_h]h.

TYPE DE SINISTRE  : Décès animal
N° POLICE         : [CYCLE.numCnaas]
DATE DU DÉCÈS     : [date]
HEURE             : [heure]
LIEU              : Ferme BOAN, Thiès, Sénégal

─── IDENTIFICATION DE L'ANIMAL ───
  Identifiant     : [ID_ANIMAL]       ← CYCLE.betes[i].id  (format: C1-001)
  Race            : [race]            ← CYCLE.betes[i].race (ou raceCustom si race=Autre)
  Poids entrée    : [poidsEntree] kg  ← CYCLE.betes[i].poidsEntree
  Date d'entrée   : [dateIntro]       ← CYCLE.betes[i].dateIntro (format ISO YYYY-MM-DD → afficher DD/MM/YYYY)
  Poids actuel    : [poids_dernier] kg ← dernier enregistrement LIVE.pesees où p.id = ID_ANIMAL
  Date pesee      : [date_derniere_pesee] ← même enregistrement
  Valeur estimée  : [cnaas_grille[race_classe]] FCFA
    ⚠️ Valeur déterminée selon grille officielle CNAAS par race/classe d'âge.
    Si grille non disponible : [poidsEntree × prix_foirail] FCFA au prorata —
    "Valeur estimée au prorata marché, sujette à expertise CNAAS"
    (basé sur relevé foirail du [date_dernier_prix_foirail]) ← LIVE.prix derniers enregistrement

─── HISTORIQUE DES SOINS ───
  Symptômes déclarés    : [symptomes]         ← S.fsa.sym (champ libre gerant)
  Traitements effectués : [traitements]       ← S.fsa.tra
  Coût total            : [cout] FCFA         ← S.fsa.cout
  Vaccinations SOP      : [liste actes SOP validés] ← HISTORY où type='sante' + sopLabel + id = ID_ANIMAL

─── HISTORIQUE DES PESÉES ───
  [tableau : date | poids (kg) | gain (kg) | GMQ (kg/j)] ← LIVE.pesees filtré par p.id = ID_ANIMAL

─── ENGAGEMENT ───
  ⛔ L'animal N'A PAS été abattu ni enterré.
  Il est disponible pour constatation par votre expert.

Pièces à transmettre séparément dès disponibilité :
  □ Certificat de décès signé par Dr [CYCLE.veterinaire]
  □ Photos de l'animal décédé (transmises par WhatsApp ou email de suivi)

[ferme_responsable_nom] — [ferme_responsable_tel]
Ferme BOAN, Thiès, Sénégal
```

### 5.4 Déclaration CNAAS — Vol (J+0)
```
À    : [contact_cnaas_email]
CC   : [ferme_email_fondateur], [contact_rga_email]
Objet : [BOAN] Déclaration sinistre — Vol bétail — Police n°[CYCLE.numCnaas]

Madame, Monsieur,

La Ferme BOAN déclare le sinistre suivant dans le délai contractuel.

TYPE DE SINISTRE  : Vol de bétail
N° POLICE         : [CYCLE.numCnaas]
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

### 5.5 Relances CNAAS — J+7 / J+14

> ❌ **Ancien calendrier J+2/J+5/J+10 supprimé** — trop agressif, harcèlement bureaucratique.
> La CNAAS a un délai interne de traitement de 3-5 jours. La 2e relance à J+2 arrivait avant
> que le dossier J+0 soit classé. Résultat : agents ignoraient toutes les relances.
> ❌ **Mention "saisine Direction Régionale" supprimée** — contre-productive en administration
> sénégalaise, génère des blocages volontaires. Rester courtois jusqu'à J+14.

```
À    : [contact_cnaas_email]
CC   : [ferme_email_fondateur], [contact_rga_email]
Objet : [BOAN] Suivi sinistre — Police n°[CYCLE.numCnaas] — Déclaration du [date_sinistre]

Madame, Monsieur,

Nous revenons vers vous au sujet de notre déclaration du [date_J0],
restée sans accusé de réception à ce jour.

Réf. sinistre : [Type] — [ID_ANIMAL ou N°_PV] — Police n°[CYCLE.numCnaas]

Nous restons à votre disposition pour tout complément de dossier.

[ferme_responsable_nom] — [ferme_responsable_tel]
```

> **J+14 uniquement :** en plus de l'email, le système envoie une notification au fondateur :
> "⚠️ Dossier [ID] sans réponse CNAAS à J+14 — Appel vocal recommandé."

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

### 6.2 WhatsApp Vétérinaire — Rappel SOP (J-3 / J-2 / J-1, cron automatique)
```
📅 *BOAN — Rappel SOP*

Acte : [label_acte]
Date prévue : [dateActe DD/MM/YYYY] (dans [N] jours)
Troupeau : [MOCK.betes] bêtes actives

Ferme BOAN — [ferme_responsable_tel]
```

### 6.3 WhatsApp Vétérinaire — Rappel urgent J-0 (bouton manuel gérant, jour J uniquement)

> Ce message est déclenché par le **gérant terrain** via un bouton dans Livrables > SOP Véto,
> affiché uniquement le jour de l'acte. Pas de cron — le gérant est sur place et peut enchaîner
> avec un appel direct si pas de réponse.

```
🔔 *BOAN — Intervention aujourd'hui*

Bonjour [contact_vet_nom],

Rappel urgent : acte SOP prévu AUJOURD'HUI à la Ferme BOAN.

Acte : [label_acte]
Troupeau : [MOCK.betes] bêtes actives

📞 [ferme_responsable_tel]
Ferme BOAN, Thiès, Sénégal
```

### 6.4 Notification gérant — Intervention vétérinaire demain (J-1, cron + bannière app)

> Bannière affichée dans l'app côté gérant le jour J-1. Si `contact_gerant_tel` configuré,
> envoi WhatsApp optionnel. Le gérant doit préparer la zone et contenir le troupeau.

```
📋 *BOAN — Intervention SOP demain*

Le vétérinaire [contact_vet_nom] est attendu demain à [horaire_vet_dakar].

Acte : [label_acte]

➡ Préparer zone, contenir troupeau, prévoir [fournitures si applicable].
Ferme BOAN — [ferme_responsable_tel]
```

### 6.5 WhatsApp CNAAS — Décès (J+0, après email auto)
```
📋 *BOAN — Déclaration sinistre (email envoyé)*

Type : Décès animal
Police : [CYCLE.numCnaas]
Animal : [ID_ANIMAL] — [race] — [poids] kg
Date : [date]

⛔ Animal non abattu ni enterré — en attente expert.

Email de déclaration envoyé à [contact_cnaas_email].
[ferme_responsable_nom] — [ferme_responsable_tel]
```

### 6.6 WhatsApp CNAAS — Vol (J+0, après email auto)
```
📋 *BOAN — Déclaration sinistre (email envoyé)*

Type : Vol de bétail
Police : [CYCLE.numCnaas]
N° PV gendarmerie : [no_pv_gendarmerie]
Date : [date]
Animaux : [liste IDs]

Email de déclaration envoyé à [contact_cnaas_email].
[ferme_responsable_nom] — [ferme_responsable_tel]
```

---

## 7. Architecture technique

### 7.1 Nouveaux fichiers à créer

> **Référence code existant dans `index.html`** :
> - `appendRow(sid, range, vals)` (L1163) — écriture ligne Sheets, pattern principal
> - `readSheet(sid, range)` (L1228) — lecture plage Sheets avec `UNFORMATTED_VALUE`
> - `writeAll(sids, range, vals)` (L1991) — écriture multi-SIDs en `Promise.all`
> - `_syncConfigApp()` (L2048) — lire/écrire Config_App, pattern à adapter côté cron pour lire les contacts
> - `beteDropdown(val, stateKey, extra, excludeIds)` (L2902) — dropdown bêtes vivantes (filtre `LIVE.deceased`)
> - `partagerRapportJourWhatsApp()` — pattern `wa.me/?text=encodeURIComponent(msg)` déjà dans l'app
> - `safeText(s)` — à créer dans `/api/notify.js` (pattern ci-dessous)

> **Accès token côté serveur** : le cron doit obtenir un token Google via le même mécanisme que
> `/api/token.js` (Service Account JWT). Réutiliser `/api/token.js` en import interne dans `/api/notify.js`.

#### `/api/notify.js`
```
Fonctions :
  sendEmail(to, subject, body, cc)          → SendGrid API
  buildWaUrl(tel, msg)                      → 'https://wa.me/'+tel+'?text='+encodeURIComponent(msg)
  logNotification(entry)                    → appendRow Notifications_Log
  updateNotificationStatus(rowIdx, status)  → batchUpdate Sheets
  checkAndSendVetReminders()                → SOP J-3/J-2/J-1 (J-7 supprimé) — skip si vet_confirmed=TRUE ou jour férié
  checkAndSendDecesAlerts()                 → J+0 décès (vet + CNAAS) — déclenché aussi au flush offline queue
  checkAndSendVolAlerts()                   → J+0 vol (CNAAS)
  checkAndSendCnaasFollowups()              → relances J+7/J+14 (depuis Sinistres_CNAAS) — skip si Statut_CNAAS ≠ EN_COURS
  safeText(s)                               → sanitize champs libres avant template email
  confirmVet(sopActeId)                     → Statut=CONFIRME dans Notifications_Log
  confirmCnaas(sinistreId)                  → Statut=CLOTURE dans Sinistres_CNAAS
  stopRelances(sinistreId)                  → Relances_Stop=OUI dans Sinistres_CNAAS
```

**`safeText` — obligatoire sur tous les champs libres :**
```js
// slice(0, 2000) : les champs 'circonstances' d'un vol ou 'sym' peuvent dépasser 500 chars
function safeText(s) { return String(s || '').replace(/[<>&"\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000); }
// IMPORTANT : plain text strict — NE PAS utiliser ce contenu dans des templates HTML
// Les \r\n sont normalisés en espaces pour éviter les injections d'en-têtes email (CRLF injection)
```

**Guard offline — décès saisi hors connexion :**
```js
// Problème : flushQueue() dans l'app n'écrit que via appendRow(SID.gerant, ...)
// Un décès offline est dans OFFLINE_QUEUE — il arrive dans Sante_Mortalite du sheet gérant
// quand la connexion revient, mais peut ne PAS être dans le sheet fondateur immédiatement.
// Solution retenue (Option A) :
//   au submit décès offline → lsSet('deces_pending', {id, date, sym, tra, cout})
//   flushQueue() complet → lsRemove('deces_pending') + créer ligne Sinistres_CNAAS en fondateur
//   checkAndSendDecesAlerts() lit Sinistres_CNAAS où email_pending=OUI → envoie l'email
//
// Stockage localStorage au submit décès offline :
lsSet('deces_pending', { id: f.id, date: td, sym: safeText(f.sym), tra: safeText(f.tra),
  cout: f.cout, ts: Date.now() });
// A la reconnexion (window.addEventListener('online', ...)) :
// 1. flushQueue() → écriture Sante_Mortalite
// 2. createSinistrePending() → créer ligne Sinistres_CNAAS email_pending=OUI dans fondateur
// 3. lsRemove('deces_pending')
```

#### `/api/cron.js`

> ⚠️ **TIMEOUT VERCEL PLAN GRATUIT** : les fonctions Vercel Hobby ont un timeout de **10 secondes**.
> 3 fonctions await séquentielles (vet + décès + relances) × (2-3 lectures Sheets + 1-2 appels SendGrid)
> = **estimé 15–25 secondes** → dépassement quasi certain.
> **Solution** : passer au plan Vercel Pro (60s timeout) OU découper en 3 crons GitHub Actions
> distincts qui appellent `/api/cron?type=vet`, `/api/cron?type=deces`, `/api/cron?type=relances`
> chacun avec un déclenchement séparé (+2 min entre chaque).

```js
module.exports = async function handler(req, res) {  // CommonJS requis pour Vercel
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  var type = req.query.type || 'all';
  try {
    if (type === 'vet'    || type === 'all') await checkAndSendVetReminders();
    if (type === 'deces'  || type === 'all') await checkAndSendDecesAlerts();   // rattrape les décès offline
    if (type === 'relances'||type === 'all') await checkAndSendCnaasFollowups();
    return res.status(200).json({ ok: true, type: type, ts: new Date().toISOString() });
  } catch(e) {
    console.error('CRON ERROR', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
};
```

#### `/.github/workflows/cron-notifications.yml`

> ⚠️ **Protection workflow_dispatch** : ajouter une garde `github.actor` pour éviter qu'une PR externe
> puisse déclencher manuellement le workflow et ainsi provoquer des emails non voulus.

```yaml
name: BOAN — Cron Notifications
on:
  schedule:
    - cron: '0 7 * * *'    # 07h00 UTC = 07h00 Dakar (UTC+0)
    - cron: '2 7 * * *'    # +2 min : cron type=deces
    - cron: '4 7 * * *'    # +4 min : cron type=relances
  workflow_dispatch:
    inputs:
      type:
        description: 'Type de cron (vet | deces | relances | all)'
        required: true
        default: 'all'

jobs:
  notify:
    runs-on: ubuntu-latest
    # Protection : uniquement les membres du dépôt peuvent déclencher manuellement
    if: github.event_name == 'schedule' || github.actor == 'diopcmd'
    steps:
      - name: Déclencher le cron BOAN
        run: |
          TYPE=${{ github.event.inputs.type || 'all' }}
          # Si schedule : déterminer le type selon l'index du cron
          curl -f -X GET \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}" \
            "https://boan-app-ur3x.vercel.app/api/cron?type=$TYPE"
```

### 7.2 Fichiers `index.html` à modifier

> **Structure colonnes `Sante_Mortalite` actuelle (A:I)** :
> ```
> A=date (DD/MM/YYYY)  B=id_bete  C=sym  D=tra  E=cout  F=res  G=dec (OUI/NON)
> H=bcs  I=muqueuses  J=sopLabel (ajouté par commit 61fc2c0 — lu à la lecture Vague 2)
> ```
> L'écriture dans l'app se fait sur `Sante_Mortalite!A:I` (9 colonnes, J=sopLabel écrit uniquement par `_sopInlineSave`).
> Pour le flag `email_pending` : **utiliser Option A** (colonne dans `Sinistres_CNAAS`, sheet fondateur)
> plutôt qu'ajouter une colonne K dans `Sante_Mortalite` — voir point bloquant #16.

| Section | Modification |
|---|---|
| Livrables — nouveau sous-onglet `contacts` | Bloc Config "Contacts & Assurance" (fondateur) — tous les champs section 4.3, persistés dans Config_App |
| Saisie > Santé (décès = OUI) | Bannière rouge `⛔ NE PAS ENTERRER`, alerte photo avant submit, compteur 48h sanitaire, boutons WhatsApp/appel vet + CNAAS post-submit |
| Saisie > Santé (décès = OUI, offline) | `lsSet('deces_pending', {...})` au submit offline — traité par `createSinistrePending()` à la reconnexion |
| Saisie > Incident (type VOL) | Champ N° PV gendarmerie obligatoire bloquant, **`beteMultiSelect()`** (nouveau helper multi-select — `beteDropdown` ne supporte pas multi-select), boutons WhatsApp/appel CNAAS post-submit |
| Livrables > Incidents | Timeline dossier `Sinistres_CNAAS`, checkboxes fondateur, bouton "CNAAS confirmé" / "Arrêter relances", bannière NE PAS ENTERRER si expert non passé, compteur 48h |
| Livrables > SOP Vétérinaire | Bouton "Vétérinaire confirme" conditionnel (acte dans les 7j) |
| Dashboard — bannière conditionnelle | `⛔ Dossier sinistre ouvert` si `Sinistres_CNAAS` a une ligne `EN_COURS` |
| Bouton annuler 30 min | `lsSet('last_deces_ts', Date.now())` au submit → vérifier `Date.now() - lsGet('last_deces_ts') < 30*60*1000` dans la vue pour afficher/masquer le bouton |

---

## 8. Points bloquants techniques

### #1 — `Notifications_Log` absent au premier run
**Solution :** Créer manuellement (section 4.2). 2 min.

### #2 — Doublons emails si cron retry
**Solution — idempotence double guard + TTL PENDING :**
```js
// 1. Lire Notifications_Log + Sinistres_CNAAS en début de cron
// 2. Vérifier Reference_ID + Date_Envoi = aujourd'hui + Statut ≠ ERREUR
// 3. Logger Statut=PENDING AVANT l'appel SendGrid
// 4. Mettre à jour Statut=SENT ou Statut=ERROR après réponse
//
// ⚠️ TTL PENDING : si une ligne est en statut PENDING depuis > 2 heures
// (crash entre l'étape 3 et l'étape 4), la considérer comme ERROR et réessayer.
// Sinon, le deadlock est silencieux : le cron croit l'email en cours — il ne l'est plus.
var pendingTs = parseDate(row.Date_Envoi); // timestamp de création du PENDING
var isPendingStale = row.Statut === 'PENDING' && (Date.now() - pendingTs > 2 * 3600 * 1000);
if (row.Statut === 'PENDING' && !isPendingStale) { continue; } // en cours — skip
if (isPendingStale) { updateNotificationStatus(rowIdx, 'ERROR_TIMEOUT'); } // libérer
```

### #3 — Délivrabilité SendGrid (Orange / Yahoo Sénégal)
**Solution :**
- Single Sender Verification minimum (5 min)
- Domain Authentication SPF + DKIM recommandée (20 min, accès DNS)
- Email test mensuel dans le cron (cron envoie un "heartbeat" à ferme_email_fondateur)

### #4 — Email décès non envoyé si offline au moment du submit
**Solution — localStorage + Sinistres_CNAAS (Option A) :**
- `doSubmit('sante')` si offline ET `S.fsa.dec === 'OUI'` → `lsSet('deces_pending', {id, date, sym, tra, cout, ts})`
- À la reconnexion (`window.addEventListener('online', ...)`) : appel `createSinistrePending()` qui crée une ligne `Sinistres_CNAAS` dans le sheet fondateur avec `email_pending=OUI`
- `checkAndSendDecesAlerts()` dans le cron : lire `Sinistres_CNAAS` où `email_pending=OUI` → envoyer l'email → effacer le flag
- Si `lsGet('deces_pending')` non vide au démarrage app : afficher bannière à l'utilisateur loggé

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
**Renforcement (CRLF injection)** : les caractères `\r\n` dans un champ libre peuvent injecter des en-têtes email si le contenu est placé dans un sujet ou un CC. `safeText` normalise les `\r\n\t` en espaces. En-têtes (To, CC, Subject) — toujours construits depuis des variables contrôlées par le fondateur (Config_App), jamais depuis des saisies gérant.

### #9 — Âge animal non tracké dans `CYCLE.betes`
**Contexte :** `CYCLE.betes = [{id, race, raceCustom, poidsEntree, dateIntro}]` — pas de date de naissance.
Le champ `raceCustom` contient la race en texte libre quand `race === 'Autre'`.
**Solution :** L'email utilise `dateIntro` comme "Date d'entrée en élevage" — suffisant pour la CNAAS. Si un âge précis est requis, ajouter un champ `anneeNaissance` optionnel dans la fiche bête (modal init cycle step 3).

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

### #11 — 5 validations pre-cron obligatoires (VET)

> Sans ces gardes, `checkAndSendVetReminders()` crashe silencieusement ou envoie des rappels absurdes.

> **Note sur `sopProtocol`** : dans l'app, `CYCLE.sopProtocol` est persisté en JSON dans Config_App
> (clé `sopProtocol`). Chaque acte a la structure : `{j: number, label: string, type: 'sante'|'pesee', note: string}`.
> Le champ `id` d'un acte est son index dans le tableau (généré au runtime — pas persisté). Pour l'idempotence
> cron, identifier un acte par la combinaison `{j, label}` plutôt que par `id`.

> **Note sur la validation SOP** : dans l'app, un acte SOP est considéré "validé" quand une entrée
> `HISTORY` existe avec `type='sante'`, `sopLabel === acte.label`, et date dans la fenêtre `±7j`
> (logique `_sopEntryAfterReset` + `_pdDone`). Le cron doit répliquer cette logique en lisant
> `Sante_Mortalite` + `SOP_Check` directement depuis Sheets.

```js
// 1. sopProtocol vide → pas de crash, alerte fondateur
if (!sopProtocol || sopProtocol.length === 0) {
  logNotification({ type:'VET_ERROR', statut:'ERROR_EMPTY_PROTOCOL' }); return;
}
// 2. Contact vétérinaire manquant → alerte fondateur, pas crash
if (!config.contact_vet_whatsapp && !config.contact_vet_email) {
  logNotification({ type:'VET_ERROR', statut:'ALERT_NO_CONTACT' }); return;
}
// 3. Acte hors durée de cycle → skip (ex: J+60 sur cycle de 45j)
if (acte.j > CYCLE_DUREE_JOURS) { continue; }
// 4. Acte déjà validé dans SOP_Check → skip (pas de rappel inutile)
if (sopCheckIds.indexOf(acte.id) !== -1) { continue; }
// 5. Jour férié sénégalais → skip (table 'jours_fermes' dans Config_App)
if ((joursFermes || []).indexOf(todayISO) !== -1) {
  logNotification({ type:'VET_SKIPPED', notes:'Jour ferme: ' + todayISO }); return;
}
```

### #12 — `CYCLE.dateDebut` doit être en ISO UTC côté serveur (VET + CNAAS)

> ✅ **RÉSOLU** — `CYCLE.dateDebut` est déjà stocké au format `YYYY-MM-DD` dans `Config_Cycle!A1` (colonne A). Pas de migration nécessaire.

Le cron Node.js peut calculer directement :
```js
// dateDebut lu depuis Config_Cycle!A1 est déjà 'YYYY-MM-DD' — pas de conversion nécessaire
var joursEcoules = Math.floor((Date.now() - new Date(dateDebut + 'T00:00:00Z').getTime()) / 86400000);
// Dakar = UTC+0 — mais coder robuste pour un changement éventuel
```

### #13 — `vet_confirmed` : arrêt des rappels après confirmation vétérinaire (VET)

Sans ce mécanisme, le vétérinaire reçoit J-3/J-2/J-1 même après avoir dit "OK je viens".

**Solution :**
- Utiliser la colonne `Date_Confirmation` existante dans `Notifications_Log`.
- Si une ligne `Type=SOP_VET_Jx / Reference_ID=acte.id` a `Date_Confirmation` renseignée → `vet_confirmed = TRUE` → skip cet acte dans le cron.
- Bouton **"✓ Vétérinaire a confirmé"** dans Livrables > SOP Véto → écrit `Date_Confirmation = today` dans Notifications_Log + badge 🟢 dans la timeline.

### #14 — Grille officielle CNAAS requise pour valeur déclarée (CNAAS)

`poids × prix_foirail` sera révisé ou rejeté par l'expert CNAAS comme calcul non conforme à leur grille.

**Solution :**
- Obtenir la grille CNAAS lors de la souscription (Chantier 2).
- Hard-coder dans `Config_App` clé `cnaas_grille` : JSON `{zebu_senegalais_18_36m: 1200000, ...}`.
- Si race absente de la grille → mention dans email : *"Valeur estimée au prorata marché, sujette à expertise CNAAS"*.
- Alerte bloquante au submit décès si grille et prix foirail tous les deux absents.

### #15 — Fêtes religieuses et fermetures administratives sénégalaises (VET + CNAAS)

Décès pendant Tabaski/Magal/Gamou → administrations fermées 3-5 jours → expert CNAAS absent.

**Solution :**
- Table `jours_fermes` dans `Config_App` (JSON, mise à jour manuelle annuelle par fondateur).
- Cron vet : skip envoi si `today in jours_fermes`.
- Email CNAAS décès : si décès pendant période fermée → mention *"Décès survenu pendant [fête] — expert attendu après réouverture administrative estimée au [date]"*.
- Délai bannière "NE PAS ENTERRER" étendu à 9-12j affiché plutôt que 5-7j.

### #16 — Cron : accès à `Sante_Mortalite` (SID gérant) pour `email_pending` (CNAAS)

Le cron tourne avec le SID fondateur. `Sante_Mortalite` est écrite sur les sheets gérant ET fondateur via `writeAll([SID.gerant, SID.fondateur, SID.rga], 'Sante_Mortalite!A:I', ...)`. Le sheet fondateur contient donc déjà une copie de `Sante_Mortalite`.

**Solution :**
- Option A : ajouter colonne `email_pending` dans `Sinistres_CNAAS` (sheet fondateur) plutôt que dans `Sante_Mortalite` gérant — le cron a les droits.
- Option B : lire `Sante_Mortalite` depuis `SID.fondateur` (copie écrite par `writeAll`) — pas de modification des droits Sheets.
- **Recommandé : Option A** — plus simple, découplage propre, `Sinistres_CNAAS` est la source de vérité CNAAS.
```

### #17 — Timeout Vercel plan gratuit (Architecte Backend)

Le cron appelle 3 fonctions `async` séquentiellement. Estimation par fonction : 2-3 lectures Sheets (~1-3s chacune) + 1-2 appels SendGrid (~300ms) = **~5-8s par fonction × 3 = 15-25s**. Timeout plan Hobby = 10s.

**Solution :**
- Découper en 3 endpoints distincts : `/api/cron?type=vet`, `/api/cron?type=deces`, `/api/cron?type=relances`
- GitHub Actions : 3 crons à 07h00, 07h02, 07h04 UTC (voir section 7.1 cron.yml)
- Alternative : passer au plan Vercel Pro (60s) si le fondateur est prêt à payer ~20$/mois
- **Ne jamais mettre toutes les fonctions en `await` séquentiel dans un seul handler** — risk de timeout surtout si Sheets API est lente

### #18 — `beteDropdown()` ne supporte pas la sélection multiple (cas VOL)

`beteDropdown(val, stateKey, extra, excludeIds)` (L2902) génère un `<select>` HTML — sélection **unique** seulement. Le cas VOL nécessite de sélectionner plusieurs bêtes (vol d'un troupeau entier ou partiel).

**Solution :** Créer `beteMultiSelect(stateKeyArr)` — nouveau helper dans `index.html` :
```js
// Principe : liste de checkboxes, stateKeyArr est un tableau dans S (ex: S.fin.beteIds = [])
function beteMultiSelect(stateKeyArr) {
  var beteIds = /* même logique que beteDropdown pour obtenir la liste */;
  return beteIds.map(function(id) {
    var checked = (stateKeyArr||[]).indexOf(id) !== -1;
    return '<label style="display:flex;align-items:center;gap:8px;padding:6px 0">'
      +'<input type="checkbox" '+(checked?'checked':'')
      +' onchange="(function(c){var arr='+stateKeyArr+';var i=arr.indexOf(\''+id+'\');if(c&&i===-1)arr.push(\''+id+'\');if(!c&&i!==-1)arr.splice(i,1)})(this.checked)">'
      +'<span>'+id+'</span></label>';
  }).join('');
}
```
> ⚠️ Ne pas utiliser des lambdas arrow functions — ES5 strict dans l'app.

### #19 — Bannière "NE PAS ENTERRER" doit être offline-first et persistante entre rechargements

La bannière décrite dans le roadmap (section 3.1) "disparaît seulement quand expert CNAAS coché" doit survivre à un rechargement de l'app et fonctionner même sans connexion.

**Solution :**
```js
// Au submit décès confirmé (_submitActual), en PLUS de l'écriture Sheets :
lsSet('sinistres_ouverts', lsGet('sinistres_ouverts') || []);
var _so = lsGet('sinistres_ouverts') || [];
_so.push({ id: f.id, date: td, expertPasse: false, ts: Date.now() });
lsSet('sinistres_ouverts', _so);

// Dans r() / viewDash() et viewSaisie() : lire lsGet('sinistres_ouverts') filtrer expertPasse=false
var _souverts = (lsGet('sinistres_ouverts') || []).filter(function(s){ return !s.expertPasse; });
if (_souverts.length > 0) {
  // afficher bannière rouge persistante
}

// Quand fondateur coche "Expert CNAAS passé" :
var _so2 = lsGet('sinistres_ouverts') || [];
_so2.forEach(function(s){ if(s.id === id) s.expertPasse = true; });
lsSet('sinistres_ouverts', _so2);
```
> Ce mécanisme fonctionne **offline** car basé sur localStorage. Synchronized avec Sinistres_CNAAS au chargement.

### #20 — Chargement de `Sinistres_CNAAS` dans `loadLiveData()` non spécifié

Le roadmap décrit une timeline dossier depuis `Sinistres_CNAAS` mais ne précise pas quand ni comment ces données sont chargées dans l'app.

**Solution :** Ajouter la lecture de `Sinistres_CNAAS` en **Vague 2** de `loadLiveData()` (aux côtés des 7 autres onglets) :
```js
// Dans le Promise.all de la Vague 2 (L~1400) :
readSheet(SID.fondateur, 'Sinistres_CNAAS!A2:K200')  // lit toutes les lignes
// Résultat stocké dans LIVE.sinistres = rows
// Utilisé dans viewLiv() > onglet incidents pour la timeline
// ET dans viewDash() pour la bannière conditionnelle
```
> Accessible uniquement si `S.user === 'fondateur' || S.user === 'rga'` — le gérant n'a pas besoin de ces données.

### #21 — Format email : plain text obligatoire (Sécurité + Délivrabilité)

Les templates email de la section 5 sont en plain text — c'est correct. Confirmation explicite :

**Règle absolue :** NE PAS construire de templates HTML pour les emails BOAN.
- Délivrabilité : Orange Sénégal filtre agressivement les emails HTML
- Sécurité : zéro risque XSS, injection HTML ou CRLF dans les en-têtes
- Lisibilité : les appareils bas de gamme au Sénégal affichent mieux le plain text

Dans le call SendGrid API :
```js
body: JSON.stringify({
  personalizations: [{ to: [{email: to}], cc: cc.map(function(e){return {email:e};}) }],
  from: { email: config.ferme_email_expediteur },
  subject: subject,  // PAS de crochets [BOAN]
  content: [{ type: 'text/plain', value: body }]  // TOUJOURS text/plain
})
```

### #22 — Validité juridique de l'email automatique (Droit Sénégalais)

Un email automatique n'a pas valeur d'**acte officiel de déclaration de sinistre** en droit sénégalais sans accusé de réception électronique signé par la CNAAS.

**Considérations :**
- L'email sert de **preuve d'envoi horodatée** (CC fondateur + RGA = 3 copies)
- L'appel vocal fondateur à J+0 est l'acte déclencheur officiel — l'app doit afficher
  clairement : *"L'email est une trace — l'appel vocal CNAAS est obligatoire"*
- Mention à ajouter dans l'email J+0 : *"Ce message constitue une déclaration à titre
  conservatoire. Une confirmation par voie officielle sera faite sous 24h."*

---

## 9. Ordre d'implémentation

```
BLOC A — HORS CODE (prérequis absolus)
  □ [Chantier 1] Contractualiser vétérinaire agréé Thiès — nom, email, +221XX, WhatsApp
  □ [Chantier 2] Souscrire police CNAAS — N° police, email, tel, délai, liste pièces
  □ [Chantier 2] Obtenir grille officielle CNAAS indemnisation par race/classe d'âge (PDF)
  □ [Chantier 2] Obtenir numéro téléphone vocal agent CNAAS Thiès (canal principal déclarations)
  □ Créer compte SendGrid + Single Sender Verification de l'adresse ferme
  □ Créer onglet Notifications_Log dans Sheet fondateur (9 colonnes — section 4.2)
  □ Créer onglet Sinistres_CNAAS dans Sheet fondateur (10 colonnes — section 4.2)
  □ Collecter tous les contacts (section 4.3) + emails fondateur + RGA
  □ Ajouter SENDGRID_API_KEY + CRON_SECRET dans Vercel + GitHub Secrets

BLOC B — Config UI index.html
  ☑ Champ `numCnaas` (N° police CNAAS) — **déjà implémenté** : modal init step 2 + Config_App + Go/No-Go
  ☑ Champ `veterinaire` (nom vétérinaire) — **déjà implémenté** : modal init step 2 + Config_Cycle
  □ Sous-onglet "Contacts & Assurance" dans Livrables (fondateur) — champs NOUVEAUX : email/tel vét, email/tel CNAAS, emails fondateur/RGA, horaire_vet, jours_fermes, cnaas_grille
  □ Persistance dans Config_App Sheets (clé/valeur — via `_syncConfigApp()` déjà en place)
  □ Bannière rouge ⛔ NE PAS ENTERRER dans Santé (décès = OUI) + compteur 48h sanitaire
  □ lsSet('sinistres_ouverts', [...]) au submit décès — persistance offline pour la bannière (#19)
  □ lsSet('last_deces_ts', Date.now()) au submit — pour bouton annuler 30 min
  □ Alerte photo ⚠️ avant bouton Enregistrer (décès = OUI)
  □ Champ N° PV gendarmerie bloquant + **beteMultiSelect()** (nouveau helper) dans formulaire VOL (#18)
  □ Alerte prix foirail obsolète > 30j dans formulaire décès
  □ Config `horaire_vet_dakar`, `contact_gerant_tel`, `jours_fermes` (pré-rempli 2026), `cnaas_grille` dans sous-onglet Contacts & Assurance

BLOC C — API serveur
  □ /api/notify.js — toutes les fonctions (section 7.1) — emails text/plain uniquement (#21)
  □ /api/cron.js — endpoint sécurisé avec param ?type= (vet | deces | relances) pour éviter timeout (#17)
  □ Logique offline : createSinistrePending() déclenché par l'app à la reconnexion (#4 + #19)
  □ TTL PENDING > 2h → statut ERROR_TIMEOUT dans Notifications_Log (#2)

BLOC D — GitHub Actions
  □ .github/workflows/cron-notifications.yml avec 3 crons décalés (07h00/07h02/07h04) (#17)
  □ Ajouter CRON_SECRET dans GitHub Secrets
  □ Guard `github.actor == 'diopcmd'` sur workflow_dispatch (#sécurité)

BLOC E — Boutons et statuts index.html
  □ Bouton 1️⃣ 📞 Appeler CNAAS (primaire post-submit décès) + 2️⃣ Appeler Vét + 3️⃣ WhatsApp Vét
  □ Bouton ⚠️ "Annuler — erreur de saisie" visible 30 min post-submit décès (lsGet check)
  □ Modal post-submit "✅ Emails envoyés — ⚠️ L'email est une trace — l'appel vocal CNAAS est OBLIGATOIRE"
  □ Bouton "✓ Vétérinaire a confirmé" (SOP Véto, conditionnel acte dans 7j) → Date_Confirmation Notifications_Log
  □ Bouton "🔔 Rappel urgent J-0" (gérant uniquement, affiché le jour J de l'acte SOP) → wa.me/ msg 6.3
  □ Bannière gérant J-1 dans app : "Intervention SOP demain [horaire_vet_dakar] — Préparer zone"
  □ SOP_Check menu étendu : ✅ Réalisé / ⚠️ Reporté (raison + nouvelle date J+7) / ❌ Annulé (raison)
  □ Timeline SOP Livrables > SOP Véto : J-3/J-2/J-1 ✓ envoyé / 🟢 confirmé / ⏳ en attente
  □ Statut CNAAS select (Livrables > Incidents) : En attente / Dossier reçu / Expert assigné / Expertise passée / Rejeté
  □ Colonne Appel_Fondateur_J0 dans Sinistres_CNAAS — à renseigner manuellement par fondateur
  □ Checkboxes fondateur : Certif reçu / Certif transmis / Expert passé / Autorisation inhumation si > 48h
  □ Bouton "CNAAS a confirmé réception" (clôture dossier) → lsSet sinistres_ouverts expertPasse=true
  □ Bouton "Arrêter les relances" (confirmation CNAAS par téléphone)
  □ Timeline dossier sinistre (J+0 / Appel fondateur / J+7 relance / J+14) depuis LIVE.sinistres (#20)
  □ Badge statut email (lecture Notifications_Log via loadLiveData Vague 2)
  □ Badge numérique onglet Livrables si dossier(s) en attente

BLOC F — Tests (ne jamais tester sur vrais emails CNAAS/vet)
  □ Test curl /api/cron?type=vet avec x-cron-secret → vérifier réponse 200 en < 10s
  □ Test curl /api/cron?type=deces + /api/cron?type=relances — idem
  □ Test email vers adresses fondateur/RGA de test → vérifier text/plain + objet sans crochets
  □ Test WhatsApp → vérifier ouverture conversation avec message pré-rempli
  □ Vérifier lignes créées dans Notifications_Log + Sinistres_CNAAS
  □ Tester idempotence : appeler /api/cron deux fois → une seule ligne dans Notifications_Log
  □ Tester TTL PENDING : créer ligne PENDING > 2h → relancer cron → statut ERROR_TIMEOUT
  □ Tester mode offline : soumettre décès hors connexion → lsGet('deces_pending') non vide → reconnexion → email envoyé
  □ Tester N° police vide → alerte bloquante
  □ Tester prix foirail > 30j → alerte
  □ Tester bannière NE PAS ENTERRER après rechargement app (lsGet sinistres_ouverts)
  □ Tester beteMultiSelect() dans formulaire VOL — vérification sélection multiple
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
| **`CYCLE.numCnaas` (N° police)** | **✅ Implémenté** — modal init + Config_App + Go/No-Go (commit `9766040`) |
| **`CYCLE.veterinaire` (nom vétérinaire)** | **✅ Implémenté** — modal init + Config_Cycle (commit antérieur) |
| **`CYCLE.dateDebut` format ISO** | **✅ Déjà YYYY-MM-DD** — point bloquant #12 résolu |
| Code implémenté (Blocs C–E) | ⬛ En attente des prérequis |
