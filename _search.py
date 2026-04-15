c = open('C:/Temp/Boan-app/index.html', encoding='utf-8').read()
for i, line in enumerate(c.split('\n'), 1):
    if 'dashboard' in line and ('chTab' in line or 'S.tab' in line):
        print(str(i) + ': ' + line[:150])
