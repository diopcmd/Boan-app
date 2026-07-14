# BOAN - Verification Vercel des variables (3 min)

Date: 14 Juillet 2026
But: confirmer que le pipeline notifications CNAAS est totalement operationnel en prod.

---

## 1) Ouvrir les variables

- Vercel Dashboard -> projet BOAN -> Settings -> Environment Variables
- Cible: environnement `Production`

---

## 2) Checklist minimale (obligatoire)

Coche chaque variable ci-dessous:

- `CRON_SECRET` (>= 32 caracteres)
- `SESSION_SECRET` (>= 32 caracteres)
- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL` (sender verifie SendGrid)
- au moins un destinataire:
  - `SENDGRID_TO_FONDATEUR` ou
  - `SENDGRID_TO_RGA` ou
  - `NOTIFY_TO` ou
  - `SENDGRID_TO`
- `SA_PRIVATE_KEY` (format avec `\\n`)
- `SA_CLIENT_EMAIL`
- `SID_FONDATEUR`

Si une variable manque: l'ajouter en `Production`, puis redeployer.

---

## 3) Test rapide apres verification

### Test A - cron securise

- Appel sans secret doit echouer (401)
- Appel avec mauvais secret doit echouer (401)

### Test B - notification immediate

- Vente test depuis l'app (session valide)
- Reponse `/api/notify-immediate` attendue:
  - `ok:true`
  - soit `providerStatus:202` (envoi reel)
  - soit `simulated:true` (si mail non configure)

### Test C - relance cron

- Lancer `/api/cron` avec secret valide
- Attendre dans la reponse JSON:
  - `ok:true`
  - `job.overdueCount`
  - `job.sent:true` ou `job.simulated:true`

---

## 4) Interpretation immediate

- `401` sur cron sans/mauvais secret: normal
- `simulated:true`: config mail incomplete
- `google_token_unavailable`: verifier `SA_PRIVATE_KEY`/`SA_CLIENT_EMAIL`
- `sid_fondateur_missing`: verifier `SID_FONDATEUR`

---

## 5) Action corrective standard

1. Corriger variable manquante ou invalide en Production.
2. Redeployer (ou relancer un build prod).
3. Rejouer les tests A/B/C.
4. Confirmer que le RGA peut cloturer (`Fait`) sans reouverture de tache.
