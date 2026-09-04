import fs from 'fs';
const src = fs.readFileSync('node_modules/gsap/src/gsap-core.js', 'utf8');
const lines = src.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('_gsap')) {
    console.log(i + 1, lines[i].substring(0, 150));
  }
}