import re
with open('c:/Website/src/components/GrossGauntlet/GrossGauntletControl.jsx', 'r', encoding='utf-8') as f:
    c = f.read()
print('Braces:', c.count('{'), c.count('}'))
print('Parens:', c.count('('), c.count(')'))
print('Brackets:', c.count('['), c.count(']'))
ok = c.count('{') == c.count('}') and c.count('(') == c.count(')') and c.count('[') == c.count(']')
print('Balance:', 'OK' if ok else 'MISMATCH')