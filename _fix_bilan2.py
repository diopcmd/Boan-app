with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# The exact bilan 2-line block (using \\ for backslash, \n for newline)
old_bilan = (
    "            +'<span class=\\\"sb-val '+(bilanSem?'sb-ok':(bilanDu&&_heure>=18?'sb-ko':'sb-warn'))+'\\\">'\\n"
    "            +(bilanSem?'\\u2713 Envoye sem. '+calcSemaine():bilanDu&&_heure>=18?'\\u2717 A envoyer ce soir':(_jourSem<5?'Dans '+_bilanJoursVen+'j (ven.)':_heure>=18?'\\u2717 Ce soir !':'Ce soir'))+'</span></div>'"
)

new_bilan = (
    "            +'<span class=\\\"sb-val '+(bilanSem?'sb-ok':(bilanDu&&_heure>=18?'sb-ko':'sb-ok'))+'\\\">'\\n"
    "            +(bilanSem?'✓':(bilanDu&&_heure>=18?'✗':'–'))+'</span></div>'"
)

print('old found:', old_bilan in content)
if old_bilan in content:
    content = content.replace(old_bilan, new_bilan)
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Bilan: replaced and saved OK')
else:
    # Debug: find and show exact context
    idx = content.find("Envoye sem. '+calcSemaine()")
    if idx != -1:
        line_start = content.rfind('\n', 0, idx) + 1
        prev_line_start = content.rfind('\n', 0, line_start - 1) + 1
        line_end = content.find('\n', idx) + 1

        two_lines = content[prev_line_start:line_end]
        print('Exact bytes of 2 lines:')
        print(repr(two_lines))
