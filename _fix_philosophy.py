# Applique la règle "[info] ✓ blanc  |  [echéance] ✗ rouge" sur tous les checkpoints sidebar

with open('index.html', 'r', encoding='utf-8') as f:
    c = f.read()

changes = 0

def rep(old, new, label):
    global c, changes
    if old in c:
        c = c.replace(old, new, 1)
        print(f'  OK  {label}')
        changes += 1
    else:
        print(f' MISS {label}  →  {repr(old[:70])}')

print('=== GÉRANT – Aujourd\'hui ===')

# 1. Fiche: faite ✓ / auj. ✗
rep(
    "+(fichOk2?'✓':'auj.')",
    "+(fichOk2?'faite \u2713':'auj. \u2717')",
    'Gérant Fiche'
)

# 2. SOP: il y a Xj ✓ / retard Xj ✗ / jamais ✗
rep(
    "+(sopOkSb?'\u2713':sopJ>=999?'jamais':'retard '+(sopJ-14)+'j')",
    "+(sopOkSb?'il y a '+sopJ+'j \u2713':sopJ>=999?'jamais \u2717':'retard '+(sopJ-14)+'j \u2717')",
    'Gérant SOP'
)

# 3. Bilan class: pas de sb-warn (→ toujours rouge si pas fait)
rep(
    "+(bilanSem?'sb-ok':(bilanDu&&_heure>=18?'sb-ko':'sb-ok'))",
    "+(bilanSem?'sb-ok':'sb-ko')",
    'Gérant Bilan class'
)

# 3b. Bilan text: sem. X ✓ / ce soir ✗ / ven. ✗
rep(
    "+(bilanSem?'\u2713':(bilanDu&&_heure>=18?'ce soir !':'ven.'))",
    "+(bilanSem?'sem. '+calcSemaine()+' \u2713':(bilanDu&&_heure>=18?'ce soir \u2717':'ven. \u2717'))",
    'Gérant Bilan texte'
)

# 4. Stock: il y a Xj ✓ / Xj ✗ / jamais ✗
rep(
    "+(stockOk2?'\u2713':stockJ<999?stockJ+'j':'jamais')",
    "+(stockOk2?'il y a '+stockJ+'j \u2713':stockJ<999?stockJ+'j \u2717':'jamais \u2717')",
    'Gérant Stock'
)

# 5. Pesée: il y a Xj ✓ / retard Xj ✗ / jamais ✗
rep(
    "+(peseeOk2?'\u2713':(peseeJ>=999?'jamais':'retard '+(peseeJ-(CYCLE.peseeFreq||30))+'j'))",
    "+(peseeOk2?'il y a '+peseeJ+'j \u2713':(peseeJ>=999?'jamais \u2717':'retard '+(peseeJ-(CYCLE.peseeFreq||30))+'j \u2717'))",
    'Gérant Pesée'
)

# 6. Incidents: aucun ✓ / N auj. ✗
rep(
    "+(incNb>0?incNb+' auj.':'\u2713')",
    "+(incNb>0?incNb+' auj. \u2717':'aucun \u2713')",
    'Gérant Incidents'
)

# 7. Santé: aucun ✓ / N auj. ✗
rep(
    "+(santeNb>0?santeNb+' auj.':'\u2713')",
    "+(santeNb>0?santeNb+' auj. \u2717':'aucun \u2713')",
    'Gérant Santé'
)

print('\n=== FONDATEUR – Aujourd\'hui (saisies gérant) ===')

# 8. Fiche: reçue ✓ / auj. ✗
rep(
    "+(fOk?'\u2713':'auj.')",
    "+(fOk?'reçue \u2713':'auj. \u2717')",
    'Fond Fiche'
)

# 9. SOP: il y a Xj ✓ / Xj ✗
# Current state: +( sopOk2b?'✓':sopJ2+'j')
rep(
    "+( sopOk2b?'\u2713':sopJ2+'j')",
    "+(sopOk2b?'il y a '+sopJ2+'j \u2713':sopJ2+'j \u2717')",
    'Fond SOP'
)

# 10. Bilan: sem. X ✓ / sem. X ✗
rep(
    "+(bilOk2?'\u2713':'sem. '+calcSemaine())",
    "+(bilOk2?'sem. '+calcSemaine()+' \u2713':'sem. '+calcSemaine()+' \u2717')",
    'Fond Bilan'
)

# 11. Stock: il y a Xj ✓ / Xj ✗ / jamais ✗
rep(
    "+(stkOk2b?'\u2713':stkJ2<999?stkJ2+'j':'jamais')",
    "+(stkOk2b?'il y a '+stkJ2+'j \u2713':stkJ2<999?stkJ2+'j \u2717':'jamais \u2717')",
    'Fond Stock'
)

print('\n=== FONDATEUR – Semaine ===')

# 12. Bilan semaine: gérant ✓ / sem. X ✗
rep(
    "+( bilOk?'\\u2713 Gerant a envoye':'\\u2717 Non envoye cette sem.')",
    "+(bilOk?'gérant \u2713':'sem. '+calcSemaine()+' \u2717')",
    'Fond Week Bilan'
)
# Alternate (unicode already decoded in file)
rep(
    "+(bilOk?'\u2713 Gerant a envoye':'\u2717 Non envoye cette sem.')",
    "+(bilOk?'gérant \u2713':'sem. '+calcSemaine()+' \u2717')",
    'Fond Week Bilan (unicode)'
)

print('\n=== RGA – Aujourd\'hui ===')

# 13. Données reçues: reçues ✓ / en attente ✗
rep(
    "+(ok?'\u2713 Reçues':'\u2717 En attente')",
    "+(ok?'reçues \u2713':'en attente \u2717')",
    'RGA Données'
)

# 14. KPI cycle: conforme ✓ / à revoir ✗
rep(
    "+(ok?'\u2713 Conforme':'\u26a0 À revoir')",
    "+(ok?'conforme \u2713':'à revoir \u2717')",
    'RGA KPI'
)

print(f'\nTotal : {changes} changements')

if changes > 0:
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(c)
    print('Fichier sauvegardé.')
