# BOAN - Runbook Notifications (Prod)

Mise a jour: 14 Juillet 2026
Portee: flux CNAAS (notification immediate + relance cron)

---

## 1) Objectif

Ce runbook permet de:
- verifier rapidement que le pipeline notification fonctionne en production;
- verifier que les garde-fous securite sont actifs;
- valider les prerequis infra (variables, cron, destinataires);
- standardiser les controles quotidiens et hebdomadaires.

---

## 2) Architecture cible (etat actuel)

- Frontend: `index.html`
  - sur une vente, envoie `eventType=vente_bete` a `/api/notify-immediate`.
- API immediate: `api/notify-immediate.js`
  - exige `X-Session-Token` valide;
  - construit le message CNAAS;
  - envoie via SendGrid (ou simulation si non configure).
- API cron: `api/cron.js`
  - exige `CRON_SECRET` (Bearer, `x-cron-secret`, ou query `secret`);
  - lit `Ventes_CNAAS` et relance si age >= 24h et statut != DONE.
- Helpers: `api/_notify.js`
  - resolution des destinataires et envoi SendGrid.
- Planification: `vercel.json`
  - cron quotidien: `0 7 * * *` sur `/api/cron`.

---

## 3) Variables requises (production)

Obligatoires pour envoi reel:
- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL`
- au moins un destinataire:
  - `SENDGRID_TO_FONDATEUR`
  - `SENDGRID_TO_RGA`
  - `NOTIFY_TO`
  - `SENDGRID_TO`

Obligatoires pour cron securise:
- `CRON_SECRET` (32+ caracteres)

Obligatoires pour lecture Google Sheets (job cron):
- `SA_PRIVATE_KEY`
- `SA_CLIENT_EMAIL`
- `SID_FONDATEUR`

Obligatoires pour endpoint immediate (auth session):
- `SESSION_SECRET` (32+ caracteres)

---

## 4) Validation rapide (10 minutes)

### Etape A - garde-fous API

Attendu: les appels non autorises retournent `401`.

1. Test cron sans secret
```powershell
Invoke-WebRequest -Uri "https://boan-app-9u5e.vercel.app/api/cron" -Method GET
```

2. Test cron avec mauvais secret
```powershell
Invoke-WebRequest -Uri "https://boan-app-9u5e.vercel.app/api/cron?secret=badsecret" -Method GET
```

3. Test notify sans session token
```powershell
Invoke-WebRequest -Uri "https://boan-app-9u5e.vercel.app/api/notify-immediate" -Method POST -ContentType "application/json" -Body '{"eventType":"vente_bete","payload":{"id":"TEST-001"}}'
```

Resultat attendu:
- tous ces appels doivent etre rejetes (401).

### Etape B - flux metier vente -> notification

Attendu: apres une vraie vente en session authentifiee, `notify-immediate` repond `ok:true`.

1. Se connecter avec un role autorise a saisir une vente.
2. Enregistrer une vente test (ID explicite).
3. Verifier la reponse reseau de `/api/notify-immediate`:
- `ok:true`
- `simulated:true` possible si SendGrid non configure
- sinon `providerStatus` present (202 attendu)

### Etape C - flux metier RGA

Attendu: la vente apparait dans les taches CNAAS puis disparait apres action `Fait`.

1. Ouvrir Dashboard/Livrables cote RGA.
2. Verifier presence alerte/tache CNAAS.
3. Cliquer `Appeler` puis `Fait`.
4. Verifier que l entree passe en `DONE` (et ne revient pas comme en attente).

### Etape D - cron (relance >=24h)

Attendu: si ventes en retard, cron retourne `sent:true` (ou `simulated:true` selon config mail).

1. Appeler `/api/cron` avec secret valide depuis un canal securise.
2. Verifier la payload de retour:
- `ok:true`
- `job.overdueCount`
- `job.sent:true` ou `job.simulated:true`

---

## 5) Hardening recommande (priorite)

P0 (immediat):
- confirmer toutes les variables critiques en prod;
- utiliser un `CRON_SECRET` long et unique;
- verifier que seuls les destinataires attendus sont dans `SENDGRID_TO_*`.

P1 (court terme):
- ajouter une rotation trimestrielle de `CRON_SECRET` et `SESSION_SECRET`;
- ajouter un test manuel hebdomadaire du cron avec trace de resultat;
- tenir un journal d incident si `sendgrid_not_configured` ou `google_token_unavailable`.

P2 (evolution):
- ajouter endpoint interne de healthcheck notifications (lecture seule, sans secret expose);
- ajouter stockage de log metier (historique envois, erreurs, retries) consultable dans BOAN.

---

## 6) Matrice de diagnostic rapide

- `401 Unauthorized` sur cron:
  - verifier `CRON_SECRET` (longueur, valeur exacte, canal d envoi)
- `simulated:true`:
  - verifier `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, destinataires
- `google_token_unavailable`:
  - verifier `SA_PRIVATE_KEY` (format `\\n`) et `SA_CLIENT_EMAIL`
- `sid_fondateur_missing`:
  - verifier `SID_FONDATEUR`
- `Echec envoi SendGrid`:
  - verifier sender verifie + quotas/API key + format emails

---

## 7) Routine d exploitation

Quotidien (5 min):
- verifier qu il n y a pas d accumulation anormale de CNAAS en retard;
- verifier reception email de relance si overdue > 0.

Hebdomadaire (15 min):
- executer la validation rapide section 4;
- controler les destinataires et la qualite des messages;
- confirmer que le statut `DONE` reste stable apres action RGA.

Mensuel (30 min):
- revue secrets/variables;
- revue incidents notification + actions correctives;
- ajustement roadmap sinistres (deces/vol) selon retours terrain.
