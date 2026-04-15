with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# All fondateur sidebar replacements - single-quoted strings, no backslash before "
reps = [
    (
        # Fiche
        '+(fOk?\'\\u2713 Re\\u00e7ue\':\'\\u2717 En attente\')',
        '+(fOk?\'\\u2713\':\'\\u2717\')'
    ),
    (
        # SOP
        '+(sopOk2b?(sopJ2===0?\'Aujourd\\\'hui\':sopJ2===1?\'Hier\':\'Il y a \'+sopJ2+\'j\'):\'\\u2717 \'+sopJ2+\'j\')',
        '+(sopOk2b?\'\\u2713\':\'\\u2717\')'
    ),
    (
        # Bilan
        '+(bilOk2?\'\\u2713 Gerant a envoye sem. \'+calcSemaine():\'\\u2717 En attente gerant\')',
        '+(bilOk2?\'\\u2713\':\'\\u2717\')'
    ),
    (
        # Stock
        '+(stkJ2<999?(stkJ2===0?\'Aujourd\\\'hui\':stkJ2===1?\'Hier\':\'Il y a \'+stkJ2+\'j\'):\'Jamais\')',
        '+(stkOk2b?\'\\u2713\':\'\\u2717\')'
    ),
]

for old, new in reps:
    if old in content:
        content = content.replace(old, new)
        print(f'Replaced: {old[:40]}...')
        changes += 1
    else:
        # Try to find identifiable part
        # The actual content uses real Unicode chars
        real_old = old.encode().decode('unicode_escape')
        real_new = new.encode().decode('unicode_escape')
        if real_old in content:
            content = content.replace(real_old, real_new)
            print(f'Replaced (unicode): {real_old[:40]}...')
            changes += 1
        else:
            print(f'NOT FOUND: {old[:60]}')
            # Debug - search for unique part
            search_part = old[:30]
            idx = content.find(search_part)
            if idx != -1:
                print(f'  Partial found at {idx}: {repr(content[idx:idx+80])}')

print(f'Total: {changes} changes')
if changes > 0:
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Saved.')
