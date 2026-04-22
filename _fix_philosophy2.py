# Fix the 4 remaining sidebar items that use \u2713 JS escape sequences

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
        print(f' MISS {label}')
        # Show context around expected location
        idx = c.find('bilOk2') if 'bilOk2' in label else (c.find('stkOk2b') if 'stkOk2b' in label else -1)
        if idx > 0:
            print(f'       context: {repr(c[idx:idx+80])}')

# === Fondateur today - Bilan class (sb-warn → sb-ko) ===
rep(
    "+(bilOk2?'sb-ok':'sb-warn')",
    "+(bilOk2?'sb-ok':'sb-ko')",
    'Fond Bilan class sb-warn→sb-ko'
)

# === Fondateur today - Bilan text ===
# file contains literal: +(bilOk2?'\u2713':'sem. '+calcSemaine())
rep(
    r"+(bilOk2?'\u2713':'sem. '+calcSemaine())",
    "+(bilOk2?'sem. '+calcSemaine()+' \u2713':'sem. '+calcSemaine()+' \u2717')",
    'Fond Bilan texte'
)

# === Fondateur today - Stock text ===
# file contains literal: +(stkOk2b?'\u2713':stkJ2<999?stkJ2+'j':'jamais')
rep(
    r"+(stkOk2b?'\u2713':stkJ2<999?stkJ2+'j':'jamais')",
    "+(stkOk2b?'il y a '+stkJ2+'j \u2713':stkJ2<999?stkJ2+'j \u2717':'jamais \u2717')",
    'Fond Stock texte'
)

# === Fondateur week - Bilan ===
# file contains literal: +(bilOk?'\u2713 Gerant a envoye':'\u2717 Non envoye cette sem.')
rep(
    r"+(bilOk?'\u2713 Gerant a envoye':'\u2717 Non envoye cette sem.')",
    "+(bilOk?'gérant \u2713':'sem. '+calcSemaine()+' \u2717')",
    'Fond Week Bilan'
)

print(f'\nTotal : {changes} changements')

if changes > 0:
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(c)
    print('Fichier sauvegardé.')
