// Baut js/words.js aus tools/loesungen-roh.txt und tools/hunspell5.txt.
//   node tools/build-words.js
const fs = require('fs');
const path = require('path');
const T = f => path.join(__dirname, f);
const OBSKUR = new Set(['GALAN', 'HAUFE', 'ERDEN', 'ULTRA', 'VOTUM', 'KODEX', 'DUSEL', 'HEBER', 'PUTER', 'DUZEN', 'GÄREN', 'HEGEN']);
const dict = new Set(fs.readFileSync(T('hunspell5.txt'), 'utf8').split(/\s+/).filter(Boolean));
const loes = [...new Set(fs.readFileSync(T('loesungen-roh.txt'), 'utf8').split(/\s+/)
  .filter(w => dict.has(w) && !OBSKUR.has(w)))].sort((a, b) => a.localeCompare(b, 'de'));
const erlaubt = [...dict].filter(w => !loes.includes(w));
const out = `// Automatisch erzeugt von tools/build-words.js – nicht von Hand bearbeiten.
// Erlaubte Wörter abgeleitet aus igerman98/frami (Hunspell, GPLv2/GPLv3).
window.WORTEL_LOESUNGEN = ${JSON.stringify(loes.join(' '))}.split(' ');
window.WORTEL_ERLAUBT = ${JSON.stringify(erlaubt.join(' '))}.split(' ');
`;
fs.writeFileSync(path.join(__dirname, '..', 'js', 'words.js'), out);
console.log(`Lösungen: ${loes.length}, zusätzlich erlaubt: ${erlaubt.length}`);
