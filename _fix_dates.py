# Fix sidebar status text: ✓ white when done, red date/delay when not done
with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

def rep(old, new, label):
    global content, changes
    if old in content:
        content = content.replace(old, new)
        print(f'OK: {label}')
        changes += 1
    else:
        print(f'NOT FOUND: {label}')

# ── Gerant sidebar ──

# 1. Fiche: ✗ → auj.
rep(
    "+(fichOk2?'\\u2713':'\\u2717')",
    "+(fichOk2?'\\u2713':'auj.')",
    "Gerant: Fiche"
)

# 2. SOP: ✗ → retard Xj
rep(
    "+(sopOkSb?'\\u2713':'\\u2717')",
    "+(sopOkSb?'\\u2713':sopJ>=999?'jamais':'retard '+(sopJ-14)+'j')",
    "Gerant: SOP"
)

# 3. Stock: ✗ → Xj (days since)
rep(
    "+(stockOk2?'\\u2713':'\\u2717')",
    "+(stockOk2?'\\u2713':stockJ<999?stockJ+'j':'jamais')",
    "Gerant: Stock"
)

# 4. Pesée: ✗ → retard Xj
rep(
    "+(peseeOk2?'\\u2713':'\\u2717')",
    "+(peseeOk2?'\\u2713':(peseeJ>=999?'jamais':'retard '+(peseeJ-(CYCLE.peseeFreq||30))+'j'))",
    "Gerant: Pesée"
)

# 5. Incidents: ✗ N → N auj.
rep(
    "+(incNb>0?'\\u2717 '+incNb:'\\u2713')",
    "+(incNb>0?incNb+' auj.':'\\u2713')",
    "Gerant: Incidents"
)

# 6. Santé: ✗ N → N auj.
rep(
    "+(santeNb>0?'\\u2717 '+santeNb:'\\u2713')",
    "+(santeNb>0?santeNb+' auj.':'\\u2713')",
    "Gerant: Santé"
)

# ── Fondateur sidebar – Saisies gérant ──

# 7. Fiche fondateur: ✗ → auj.
rep(
    "+(fOk?'\\u2713':'\\u2717')",
    "+(fOk?'\\u2713':'auj.')",
    "Fond: Fiche"
)

# 8. SOP fondateur: still has Aujourd'hui/Hier/Il y a.. or ✗ Xj
# current: +(sopOk2b?(sopJ2===0?'Aujourd\'hui':sopJ2===1?'Hier':'Il y a '+sopJ2+'j'):'✗ '+sopJ2+'j')
# target:  +(sopOk2b?'✓':sopJ2+'j')
idx = content.find("sopOk2b?(sopJ2===0?")
if idx != -1:
    line_start = content.rfind('\n', 0, idx) + 1
    line_end = content.find('\n', idx)
    line = content[line_start:line_end]
    old_part_start = line.find("+(sopOk2b?")
    old_part_end = line.find("+'</span></div>'", old_part_start)
    if old_part_start != -1 and old_part_end != -1:
        old_text = line[old_part_start:old_part_end]
        new_text = "+(sopOk2b?'\\u2713':sopJ2+'j')"
        new_line = line[:old_part_start] + new_text + line[old_part_end:]
        content = content[:line_start] + new_line + content[line_end:]
        print('OK: Fond: SOP')
        changes += 1
    else:
        print('NOT FOUND: Fond: SOP (no ternary boundary)')
else:
    # Maybe already simplified
    rep(
        "+(sopOk2b?'\\u2713':'\\u2717')",
        "+(sopOk2b?'\\u2713':sopJ2+'j')",
        "Fond: SOP (simple)"
    )

# 9. Bilan fondateur: ✗ → sem. X
rep(
    "+(bilOk2?'\\u2713':'\\u2717')",
    "+(bilOk2?'\\u2713':'sem. '+calcSemaine())",
    "Fond: Bilan"
)

# 10. Stock fondateur: ✗ → Xj
rep(
    "+(stkOk2b?'\\u2713':'\\u2717')",
    "+(stkOk2b?'\\u2713':stkJ2<999?stkJ2+'j':'jamais')",
    "Fond: Stock"
)

# ── Bilan gerant 2-line: replace text part only ──
# Current 2nd line: +(bilanSem?'✓':(bilanDu&&_heure>=18?'✗':'–'))+'</span></div>'
# Target:           +(bilanSem?'✓':(bilanDu&&_heure>=18?'ce soir !':'ven.'))+'</span></div>'
rep(
    "+(bilanSem?'\\u2713':(bilanDu&&_heure>=18?'\\u2717':'\\u2013'))",
    "+(bilanSem?'\\u2713':(bilanDu&&_heure>=18?'ce soir !':'ven.'))",
    "Gerant: Bilan text"
)

print(f'\nTotal: {changes} changes')
if changes > 0:
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Saved.')
