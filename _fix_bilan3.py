with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Use \n (newline) NOT \\n (backslash-n 2 chars)
old_bilan = (
    "            +'<span class=\\\"sb-val '+(bilanSem?'sb-ok':(bilanDu&&_heure>=18?'sb-ko':'sb-warn'))+'\\\">' \n"
    "            +(bilanSem?'\\u2713 Envoye sem. '+calcSemaine():bilanDu&&_heure>=18?'\\u2717 A envoyer ce soir':(_jourSem<5?'Dans '+_bilanJoursVen+'j (ven.)':_heure>=18?'\\u2717 Ce soir !':'Ce soir'))+'</span></div>'"
)
# Remove any trailing space before newline
old_bilan = old_bilan.replace(">'  \n", ">\'\n").replace(">' \n",">'\\n")

# Try without the space
old1 = "            +'<span class=\\\"sb-val '+(bilanSem?'sb-ok':(bilanDu&&_heure>=18?'sb-ko':'sb-warn'))+'\\\">'\\n            +(bilanSem?'\\u2713 Envoye sem. '+calcSemaine():bilanDu&&_heure>=18?'\\u2717 A envoyer ce soir':(_jourSem<5?'Dans '+_bilanJoursVen+'j (ven.)':_heure>=18?'\\u2717 Ce soir !':'Ce soir'))+'</span></div>'"
print('old1 (backslash-n) found:', old1 in content)

old2 = "            +'<span class=\\\"sb-val '+(bilanSem?'sb-ok':(bilanDu&&_heure>=18?'sb-ko':'sb-warn'))+'\\\">' \n            +(bilanSem?'\\u2713 Envoye sem. '+calcSemaine():bilanDu&&_heure>=18?'\\u2717 A envoyer ce soir':(_jourSem<5?'Dans '+_bilanJoursVen+'j (ven.)':_heure>=18?'\\u2717 Ce soir !':'Ce soir'))+'</span></div>'"
print('old2 (newline) found:', old2 in content)

# Get exact bytes
idx = content.find("Envoye sem. '+calcSemaine()")
if idx != -1:
    line2_start = content.rfind('\n', 0, idx) + 1
    line1_start = content.rfind('\n', 0, line2_start - 1) + 1
    line2_end = content.find('\n', idx)
    exact = content[line1_start:line2_end]
    print('Exact chunk repr:')
    print(repr(exact))
    
    # Now do direct replacement using the exact string
    new_bilan = (
        "            +'<span class=\\\"sb-val '+(bilanSem?'sb-ok':(bilanDu&&_heure>=18?'sb-ko':'sb-ok'))+'\\\">' \n"
        "            +(bilanSem?'\u2713':(bilanDu&&_heure>=18?'\u2717':'\u2013'))+'</span></div>'"
    )
    if exact in content:
        content = content.replace(exact, new_bilan.rstrip())
        with open('index.html', 'w', encoding='utf-8') as f:
            f.write(content)
        print('Bilan: replaced OK')
    else:
        # Replace line by line approach
        print('Trying line-by-line...')
        old_line1 = content[line1_start : line2_start - 1]  # without newline
        old_line2 = content[line2_start : line2_end]
        new_line1 = "            +'<span class=\\\"sb-val '+(bilanSem?'sb-ok':(bilanDu&&_heure>=18?'sb-ko':'sb-ok'))+'\\\">'  "
        new_line2 = "            +(bilanSem?'\u2713':(bilanDu&&_heure>=18?'\u2717':'\u2013'))+'</span></div>'"
        print('old_line1:', repr(old_line1))
        print('old_line2:', repr(old_line2))
