with open('index.html', 'r', encoding='utf-8') as f:
    c = f.read()

# Fondateur fiche: ✗ → auj.
old = "+(fOk?'\u2713':'\u2717')"
new = "+(fOk?'\u2713':'auj.')"
if old in c:
    c = c.replace(old, new)
    print('Fond Fiche: OK')
else:
    idx = c.find('fOk?')
    print('Not found. Context:', repr(c[idx:idx+60]) if idx!=-1 else 'absent')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(c)
