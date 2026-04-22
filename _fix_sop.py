with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the exact SOP sopOk2b line
idx = content.find("sopOk2b?(sopJ2===0?")
if idx != -1:
    line_start = content.rfind('\n', 0, idx) + 1
    line_end = content.find('\n', idx)
    line = content[line_start:line_end]
    print('Exact line:')
    print(repr(line))
    
    # Find just the ternary text part after the class attribute
    # The line is like: +'<span class="...">'+( sopOk2b?(...) )+'</span></div>'
    # Find the text ternary between '>">' and +'</span>
    old_text_start = line.find("+(sopOk2b?")
    old_text_end = line.find("+'</span></div>'", old_text_start)
    if old_text_start != -1 and old_text_end != -1:
        old_text = line[old_text_start:old_text_end]
        print('Old text:', repr(old_text))
        new_text = "+(sopOk2b?'\u2713':'\u2717')"
        new_line = line[:old_text_start] + new_text + line[old_text_end:]
        content = content[:line_start] + new_line + content[line_end:]
        with open('index.html', 'w', encoding='utf-8') as f:
            f.write(content)
        print('SOP sopOk2b: replaced OK')
    else:
        print('Could not find text ternary in line')
else:
    print('sopOk2b not found')
