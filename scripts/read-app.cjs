const fs = require('fs');
const content = fs.readFileSync('c:/Website/src/components/GrossGauntlet/GrossGauntletApp.jsx', 'utf8');
console.log(content.slice(0, 2000));
