import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# 1. Bilan gerant: simplify 2-line span
old = (
    '            +\'<span class=\\"sb-val \'+(bilanSem?\'sb-ok\':(bilanDu&&_heure>=18?\'sb-ko\':\'sb-warn\'))+\'\\">\'\\n'
    '            +(bilanSem?\'\\u2713 Envoye sem. \'+calcSemaine():bilanDu&&_heure>=18?\'\\u2717 A envoyer ce soir\':(_jourSem<5?\'Dans \'+_bilanJoursVen+\'j (ven.)\':\u005fheure>=18?\'\\u2717 Ce soir !\':\'Ce soir\'))+\'</span></div>\''
)

# Just search for a unique substring
bilan_old = "bilanSem?'\\u2713 Envoye sem. '+calcSemaine()"
bilan_new = "bilanSem?'\\u2713':'\\u2717'"

if bilan_old in content:
    # Replace the full 2-line span
    full_old = (
        "+'<span class=\\\"sb-val '+(bilanSem?'sb-ok':(bilanDu&&_heure>=18?'sb-ko':'sb-warn'))+'\\\">'\\n"
        "            +(bilanSem?'\\u2713 Envoye sem. '+calcSemaine():bilanDu&&_heure>=18?'\\u2717 A envoyer ce soir':(_jourSem<5?'Dans '+_bilanJoursVen+'j (ven.)':_heure>=18?'\\u2717 Ce soir !':'Ce soir'))+'</span></div>'"
    )
    full_new = "+'<span class=\\\"sb-val '+(bilanSem?'sb-ok':(bilanDu&&_heure>=18?'sb-ko':'sb-ok'))+'\\\">'+(bilanSem?'✓':(bilanDu&&_heure>=18?'✗':'–'))+'</span></div>'"
    if full_old in content:
        content = content.replace(full_old, full_new)
        print('Bilan: replaced OK')
        changes += 1
    else:
        print('Bilan full_old not found')
        # Try to find the lines
        idx = content.find(bilan_old)
        if idx != -1:
            print('Found bilan_old at idx', idx)
            print('Context:', repr(content[idx-100:idx+100]))
else:
    print('bilan_old substring not found')
    # Try to find it
    idx = content.find('Envoye sem.')
    if idx != -1:
        print('Found Envoye sem. at idx', idx)
        print('Context:', repr(content[idx-100:idx+200]))

# 2. Incidents: simplify
inc_old = '''+'<span class=\\"sb-val '+(incNb>0?'sb-warn':'sb-ok')+'\\">'+incNb+" auj.</span></div>'"'''
inc_new = """+'<span class=\\"sb-val '+(incNb>0?'sb-ko':'sb-ok')+'\\\">'+(incNb>0?'✗ '+incNb:'✓')+'</span></div>'"""

if inc_old in content:
    content = content.replace(inc_old, inc_new)
    print('Incidents: replaced OK')
    changes += 1
else:
    print('Incidents old not found')
    idx = content.find('sb-warn.*sb-ok.*incNb')
    idx2 = content.find('incNb+" auj.')
    if idx2 != -1:
        print('Found incNb auj. at idx', idx2)
        print('Context:', repr(content[idx2-120:idx2+60]))

# 3. Sante: simplify  
sante_old = '''+'<span class=\\"sb-val '+(santeNb>0?'sb-warn':'sb-ok')+'\\">'+santeNb+" auj.</span></div>'"'''
sante_new = """+'<span class=\\"sb-val '+(santeNb>0?'sb-ko':'sb-ok')+'\\\">'+(santeNb>0?'✗ '+santeNb:'✓')+'</span></div>'"""

if sante_old in content:
    content = content.replace(sante_old, sante_new)
    print('Sante: replaced OK')
    changes += 1
else:
    print('Sante old not found')
    idx2 = content.find('santeNb+" auj.')
    if idx2 != -1:
        print('Found santeNb auj. at idx', idx2)
        print('Context:', repr(content[idx2-120:idx2+60]))

print(f'Total changes: {changes}')

if changes > 0:
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print('File saved.')
