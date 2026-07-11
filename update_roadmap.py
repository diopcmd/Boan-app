#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys

file_path = r"C:\Users\sg54378\Desktop\Boan-app\docs\NOTIFICATIONS_ROADMAP.md"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Changement 1: Tableau Triggers — Fondateur→RGA
old = "| **Dossier > 30j** | J+0 email → J+30 | Relance paiement CNAAS | Fondateur + Agent CNAAS | Délai max paiement 30j après validation dossier |\n| **Fin contrat J-30** | Auto cron | Email renouvellement | Fondateur + Agent CNAAS | Contrat expire J+X, renouvellement manuel requis |"
new = "| **Dossier > 30j** | J+0 email → J+30 | Relance paiement CNAAS | RGA + Agent CNAAS | Délai max paiement 30j après validation dossier |\n| **Fin contrat J-30** | Auto cron | Email renouvellement | RGA + Agent CNAAS | Contrat expire J+X, renouvellement manuel requis |"
content = content.replace(old, new)
print("✅ Changement 1: Tableau Triggers (Fondateur→RGA)")

# Changement 2: Compte-à-rebours décès email J+0 immédiat
old = "| **Compte-à-rebours décès** | J+0 18:00 → J+2 18:00 | Bannière ⛔ + alerte fondateur | Dashboard fondateur/gérant | 48h max CNAAS, horodatage email = preuve |"
new = "| **Compte-à-rebours décès** | J+0 immédiat + J+1 cron | Email fondateur J+0 (< 1s) + Bannière ⛔ RGA | Dashboard RGA/gérant | Email fire-and-forget (< 1s), cron J+1 backup (idempotence) |"
content = content.replace(old, new)
print("✅ Changement 2: Compte-à-rebours décès (email J+0 immédiat)")

# Changement 3: Vol constaté email immédiat
old = "| **Vol constaté** | Immédiat (J+0) | Email CNAAS + SMS/WA gérant | CNAAS + Brigade Thiès + Gérant | Heure découverte, ID bêtes, N° récépissé, PV demandé |"
new = "| **Vol constaté** | Immédiat (J+0) + J+1 cron | Email fondateur J+0 (< 1s) + Email CNAAS | CNAAS + Brigade + RGA + Fondateur | Heure découverte, ID bêtes, N° récépissé, Email J+0 immédiat |"
content = content.replace(old, new)
print("✅ Changement 3: Vol constaté (email J+0 immédiat)")

# Changement 4: Modal post-submit et RGA appelle
old = """  3. App affiche post-submit :
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
  5. Fondateur appelle vétérinaire pour confirmer date de venue"""

new = """  3. App affiche post-submit :
     Modal : "✅ Dossier créé + Email fondateur J+0 immédiat. ⚠️ RGA APPELLE CNAAS + VÉT"
     Boutons (par priorité) :
       1️⃣ 📞 Appeler CNAAS — tel:[contact_cnaas_tel]
       2️⃣ 📞 Appeler Vétérinaire — tel:[contact_vet_tel]
       3️⃣ 💬 WhatsApp Vétérinaire — wa.me msg 6.1
       ⚠️ Annuler (erreur de saisie) — visible **4 heures** (fenêtre validée panel — ⚖️ Maître Diallo)

J+0 — **Email immédiat** Fondateur + RGA (< 1s fire-and-forget via /api/notify-immediate)
  4. App envoie email : "⛔ ALERTE J+0 — Décès [ID_ANIMAL] détecté"
     → Fondateur + RGA informés immédiatement (section 4.3)
     → Graceful fail si timeout → cron J+1 envoie backup (idempotence Reference_ID section 4.4)

J+0 — RGA agit immédiatement (fondateur à distance)
  5. RGA appelle CNAAS Thiès vocalement
     → Demande coordination date expert APRÈS venue vétérinaire
     → Note heure appel dans app (Sinistres_CNAAS col G)
  6. RGA appelle vétérinaire pour confirmer date de venue"""

content = content.replace(old, new)
print("✅ Changement 4: CAS DÉCÈS — Modal et RGA appelle")

# Changement 5: Cron J+1 avec idempotence
old = """J+1 — Cron 07h02 : checkAndSendDecesAlerts()
  6. Envoie email VET (section 5.2) + email CNAAS (section 5.3) si email_pending=OUI
  7. Si Date_Confirmation vide dans Notifications_Log : envoie rappel vét (section 5.2b)
  8. Si col M < col L dans Sinistres_CNAAS : notifie fondateur "⚠️ Expert avant vét\"""

new = """J+1 — Cron 07h02 : checkAndSendDecesAlerts()
  7. Envoie email VET (section 5.2) + email CNAAS (section 5.3) si email_pending=OUI
     ✅ **Idempotence Reference_ID (Priya panel, section 4.4)** : skip si J+0 email déjà SENT (TTL 2h)
  8. Si Date_Confirmation vide dans Notifications_Log : envoie rappel vét (section 5.2b)
  9. Si col M < col L dans Sinistres_CNAAS : notifie RGA "⚠️ Expert avant vét\"""

content = content.replace(old, new)
print("✅ Changement 5: Cron J+1 avec idempotence")

# Changement 6: Dashboard gérant et numérotation
old = """Dashboard gérant (J+1 et au-delà)
  9. Si sinistres_ouverts[expertPasse=false] ET > 24h depuis le décès :
     → Bannière rouge + bouton WhatsApp vét (msg 6.8) — un tap, message pré-rempli

J+1 à J+5-7 — Vétérinaire constate
  10. Vétérinaire signe le certificat de constatation
  11. Fondateur scanne → joint par email de suivi "Suite dossier [ID]"
  12. Fondateur coche : ☑ Certif reçu + ☑ Certif transmis CNAAS le [date]

Expert CNAAS (J+5 à J+10)
  13. Expert CNAAS vient constater
  14. Fondateur coche : ☑ Expert passé → bannière NE PAS ENTERRER libérée
      → lsSet('sinistres_ouverts') expertPasse=true"""

new = """Dashboard gérant (J+1 et au-delà)
  10. Si sinistres_ouverts[expertPasse=false] ET > 24h depuis le décès :
      → Bannière rouge + bouton WhatsApp vét (msg 6.8) — un tap, message pré-rempli

J+1 à J+5-7 — Vétérinaire constate
  11. Vétérinaire signe le certificat de constatation
  12. RGA scanne → joint par email de suivi "Suite dossier [ID]"
  13. RGA coche : ☑ Certif reçu + ☑ Certif transmis CNAAS le [date]

Expert CNAAS (J+5 à J+10)
  14. Expert CNAAS vient constater
  15. RGA coche : ☑ Expert passé → bannière NE PAS ENTERRER libérée
      → lsSet('sinistres_ouverts') expertPasse=true"""

content = content.replace(old, new)
print("✅ Changement 6: Dashboard gérant (RGA au lieu de Fondateur) + numérotation")

# Changement 7: Relances et clôture
old = """Relances automatiques (cron 07h04, si Statut_CNAAS = EN_COURS)
  J+7  → Email relance courtois (section 5.5)
  J+14 → Email relance + notification fondateur "Appel vocal recommandé"

Clôture
  15. Fondateur clique "CNAAS a confirmé" → Statut_CNAAS = CLOTURE"""

new = """Relances automatiques (cron 07h04, si Statut_CNAAS = EN_COURS)
  J+7  → Email relance courtois (section 5.5)
  J+14 → Email relance + notification RGA "Appel vocal recommandé"

Clôture
  16. RGA clique "CNAAS a confirmé" → Statut_CNAAS = CLOTURE"""

content = content.replace(old, new)
print("✅ Changement 7: Relances et clôture (RGA au lieu de Fondateur)")

# Changement 8: CAS VOL clôture
old = """Clôture
  4. Fondateur clique "CNAAS a confirmé réception\""""
new = """Clôture
  4. RGA clique "CNAAS a confirmé réception\""""
content = content.replace(old, new)
print("✅ Changement 8: CAS VOL clôture (RGA clique)")

# Changement 9: Table UI Saisie Santé
old = """| Élément | Détail | Déclencheur |
|---|---|---|
| Bannière rouge ⛔ NE PAS ABATTRE NI ENTERRER | Persistante dans la vue | `S.fsa.dec === 'OUI'` |
| Alerte photo 📸 Photographiez MAINTENANT | Au-dessus du bouton Enregistrer | `S.fsa.dec === 'OUI'` |
| Alerte prix foirail obsolète | "⚠️ Prix non mis à jour depuis N jours" | `_lastPrixLoad` > 30j |
| Alerte N° police absent | Soft warning — n'empêche pas le submit | `!CYCLE.numCnaas` |
| Modal post-submit | "✅ Dossier créé. ⚠️ APPEL VOCAL FONDATEUR OBLIGATOIRE" | Post-submit |"""

new = """| Élément | Détail | Déclencheur |
|---|---|---|
| Bannière rouge ⛔ NE PAS ABATTRE NI ENTERRER | Persistante dans la vue | `S.fsa.dec === 'OUI'` |
| Alerte photo 📸 Photographiez MAINTENANT | Au-dessus du bouton Enregistrer | `S.fsa.dec === 'OUI'` |
| Alerte prix foirail obsolète | "⚠️ Prix non mis à jour depuis N jours" | `_lastPrixLoad` > 30j |
| Alerte N° police absent | Soft warning — n'empêche pas le submit | `!CYCLE.numCnaas` |
| Modal post-submit | "✅ Dossier créé + Email fondateur J+0. ⚠️ RGA APPELLE CNAAS + VÉT" | Post-submit + email immédiat |"""

content = content.replace(old, new)
print("✅ Changement 9: Table UI Saisie Santé")

# Sauvegarde
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("\n" + "="*50)
print("✅ ✅ ✅ TOUS LES CHANGEMENTS APPLIQUÉS ✅ ✅ ✅")
print("="*50)
