with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find bilan and print the full line context to understand exact bytes
idx = content.find("Envoye sem. '+calcSemaine()")
if idx != -1:
    # Go back to start of line
    line_start = content.rfind('\n', 0, idx) + 1
    line_end = content.find('\n', idx) + 1
    line_end2 = content.find('\n', line_end) + 1
    # Get 2 lines before + the 2 bilan lines
    prev_start = content.rfind('\n', 0, line_start - 1)
    prev_start = content.rfind('\n', 0, prev_start - 1) + 1
    chunk = content[prev_start:line_end2]
    print('EXACT BILAN CHUNK:')
    print(repr(chunk))
    print('---')
    # Now do the replacement
    old_bilan_line1 = content[line_start:line_end].rstrip('\n')
    old_bilan_line2_start = line_end
    old_bilan_line2_end = content.find('\n', old_bilan_line2_start)
    old_bilan_line2 = content[old_bilan_line2_start:old_bilan_line2_end]
    print('Line1:', repr(old_bilan_line1))
    print('Line2:', repr(old_bilan_line2))
