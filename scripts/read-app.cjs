const fs = require('fs');
const content = fs.readFileSync('c:/Website/src/components/TiedIn/TiedInApp.jsx', 'utf8');
console.log(content.slice(0, 2000));
