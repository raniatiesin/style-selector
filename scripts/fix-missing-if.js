const fs = require('fs');
let c = fs.readFileSync('c:/Website/src/components/GrossGauntlet/GrossGauntletControl.jsx', 'utf8');

// Find the OBS handler section (second occurrence of '// Exiting work')
const first = c.indexOf('// Exiting work');
const second = c.indexOf('// Exiting work', first + 10);

if (second >= 0) {
    // Check if there's an 'if' before it on the same line area
    const before = c.substring(second - 30, second);
    console.log('BEFORE:', JSON.stringify(before));
    
    // The 'if (isWorkToExplain)' is missing. Replace the gap.
    // Find 'const isWorkToExplain' before this point
    const declEnd = c.lastIndexOf('\n', second - 30);
    const context = c.substring(declEnd, second + 30);
    console.log('CONTEXT:', JSON.stringify(context));
    
    // Fix: add the missing if
    c = c.replace(
        "const isWorkToExplain = (s.mode === 'work' && mapped === 'explain');\n               \n                   // Exiting work:",
        "const isWorkToExplain = (s.mode === 'work' && mapped === 'explain');\n\n               if (isWorkToExplain || isWorkToStandby) {\n                   // Exiting work:"
    );
    
    fs.writeFileSync('c:/Website/src/components/GrossGauntlet/GrossGauntletControl.jsx', c, 'utf8');
    console.log('Fixed');
}