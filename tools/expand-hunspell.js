// Expandiert das Hunspell-Wörterbuch (igerman98/frami) zu einer Liste
// aller 5-Buchstaben-Wortformen. Nutzung:
//   node tools/expand-hunspell.js <pfad/zu/de_DE_frami>  > tools/hunspell5.txt
const fs = require('fs');
const base = process.argv[2];
const aff = fs.readFileSync(base + '.aff', 'latin1').split(/\r?\n/);
const dic = fs.readFileSync(base + '.dic', 'latin1').split(/\r?\n/);

const rules = {}; // flag -> {type, cross, entries:[{strip, add, cond:RegExp}]}
for (let i = 0; i < aff.length; i++) {
  const p = aff[i].trim().split(/\s+/);
  if ((p[0] === 'SFX' || p[0] === 'PFX') && p.length === 4 && /^\d+$/.test(p[3]) && !rules[p[0] + p[1]]) {
    const r = { type: p[0], cross: p[2] === 'Y', entries: [] };
    for (let k = 1; k <= +p[3]; k++) {
      const q = aff[i + k].trim().split(/\s+/);
      const strip = q[2] === '0' ? '' : q[2];
      const add = (q[3] || '').split('/')[0].replace(/^0$/, '');
      const cond = q[4] || '.';
      r.entries.push({
        strip, add,
        cond: p[0] === 'SFX' ? new RegExp(cond + '$') : new RegExp('^' + cond)
      });
    }
    rules[p[0] + p[1]] = r;
    i += +p[3];
  }
}

const SKIP = new Set(['d', 'o']); // FORBIDDENWORD, ONLYINCOMPOUND
const out = new Set();
const norm = w => w.toUpperCase().replace(/ß/g, 'SS');
const take = w => { const n = norm(w); if (/^[A-ZÄÖÜ]{5}$/.test(n)) out.add(n); };

for (const line of dic) {
  if (!line || line.startsWith('#') || /^\s/.test(line) || /^\d+$/.test(line)) continue;
  const [word, fl = ''] = line.split('/');
  const flags = fl.split('');
  if (flags.some(f => SKIP.has(f))) continue;
  if (/[-.\d]/.test(word)) continue;
  if (!flags.includes('h')) take(word);
  const sfx = flags.map(f => rules['SFX' + f]).filter(Boolean);
  const pfx = flags.map(f => rules['PFX' + f]).filter(Boolean);
  const sufForms = [];
  for (const r of sfx) for (const e of r.entries) {
    if (e.cond.test(word) && word.endsWith(e.strip)) {
      const f = word.slice(0, word.length - e.strip.length) + e.add;
      take(f); if (r.cross) sufForms.push(f);
    }
  }
  for (const r of pfx) for (const e of r.entries) {
    for (const w of [word, ...(r.cross ? sufForms : [])]) {
      if (e.cond.test(w) && w.startsWith(e.strip)) take(e.add + w.slice(e.strip.length));
    }
  }
}
process.stdout.write([...out].sort((a, b) => a.localeCompare(b, 'de')).join('\n') + '\n');
