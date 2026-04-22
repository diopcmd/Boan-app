#!/usr/bin/env python3
import re

f = r'C:\Temp\Boan-app\index.html'
with open(f, encoding='utf-8') as fh:
    content = fh.read()

# Extract script block — not lazy so we get all JS
start = content.find('<script>')
end = content.rfind('</script>')
js = content[start+8:end]
lines_js = js.split('\n')
print(f'JS total: {len(lines_js)} lines')

# scan for unbalanced state
paren = 0
in_str = False
str_char = None
esc = False
prev_char = None

issues = []
for i, line in enumerate(lines_js):
    for ch in line:
        if esc:
            esc = False
            prev_char = ch
            continue
        if in_str:
            if ch == '\\':
                esc = True
            elif ch == str_char:
                in_str = False
        else:
            if ch in ('"', "'"):
                in_str = True
                str_char = ch
            elif ch == '(':
                paren += 1
            elif ch == ')':
                paren -= 1
            if paren < -5 or paren > 200:
                issues.append(f'L{i+1}: paren={paren} :: {line.strip()[:80]}')
                break
        prev_char = ch
    if issues:
        break

if issues:
    print('ISSUES:')
    for x in issues:
        print(x)
else:
    print(f'Final paren balance: {paren}')
    print('OK — no obvious paren issues')
