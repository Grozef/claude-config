const fs = require('fs');
const f = fs.existsSync('docs/documentation_claude/SESSION.md') ? 'docs/documentation_claude/SESSION.md'
  : fs.existsSync('documentation_claude/SESSION.md') ? 'documentation_claude/SESSION.md' : 'SESSION.md';
if (!fs.existsSync(f)) process.exit(0);
let c = fs.readFileSync(f, 'utf8');
const m = c.match(/Compteur de r.ponses : (\d+)/);
const n = m ? parseInt(m[1]) + 1 : 1;
c = c.replace(/Compteur de r.ponses : \d+/, 'Compteur de r\u00e9ponses : ' + n);
fs.writeFileSync(f, c);

if (n % 10 === 0) console.log('CHECKPOINT recommande (/checkpoint)');
if (n >= 15 && n % 5 === 0) console.log('Contexte charge depuis ' + n + ' reponses -- envisage /compact');
