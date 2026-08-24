with open('c:/Website/src/components/GrossGauntlet/GrossGauntletControl.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the OBS handler section - look for the line with "if (isWorkToExplain)" and clean duplicates
for i, line in enumerate(lines):
    if 'if (isWorkToExplain)' in line and 'OBS' in ''.join(lines[max(0,i-10):i+10]):
        # Check if there's a duplicate if on previous lines
        for j in range(i-1, max(0, i-3), -1):
            if 'if (isWorkToExplain)' in lines[j]:
                # Remove the duplicate at j
                lines[j] = ''
                print(f'Removed duplicate if at line {j+1}')
                break

with open('c:/Website/src/components/GrossGauntlet/GrossGauntletControl.jsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Done')