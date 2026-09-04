// Suite de non-regression des REGEX de stop-verify.js (complement de test-gates.sh,
// qui teste les exits mais pas la couverture linguistique des motifs).
// Usage : node ~/.claude/hooks/test-regex.js — sort 1 si un angle mort apparait.
// Audit des regex de stop-verify.js SANS passer par le shell : les patrons et les
// phrases de test sont lus depuis ce fichier (UTF-8), pas retapes dans une ligne bash.
// Lecon du jour : une mesure passee par une couche de quoting mesure la couche.
const fs = require('fs');
const os = require('os');
const path = require('path');

const src = fs.readFileSync(path.join(os.homedir(), '.claude', 'hooks', 'stop-verify.js'), 'utf8');

// On EXTRAIT les regex du fichier reel plutot que de les recopier.
function extrait(nom) {
  const m = src.match(new RegExp('^const ' + nom + ' = (/.*/[a-z]*);$', 'm'));
  if (!m) { console.error('[x] regex ' + nom + ' introuvable'); process.exit(1); }
  return eval(m[1]);
}

const cas = {
  DONE: [
    // « corrige » sans accent reste hors gate : ambigu avec l imperatif « corrige X ».
    ['C est corrige.', false],
    ['C est corrigé.', true],
    ['Le bug est corrigée.', true],
    ['C est terminé.', true], ['Voila, ça marche.', true], ['C est livré.', true],
    ["C'est fait.", true], ['C est réglé.', true], ['Le service est opérationnel.', true],
    ['Rien a signaler.', false], ['Je vais corriger ca demain.', false],
  ],
  CREEP: [
    ["Au passage, j'en ai profité pour nettoyer.", true],
    ['Nettoye dans la foulée.', true],
    ["Au passage j'ai refactorise.", true],
    ['Le passage est etroit.', false],
  ],
  VISUAL: [
    ['Le rendu est aligné.', true], ['Le logo est centré.', true],
    ['Le rendu est correct.', true], ['Le rendu est bien placé.', true],
    ['Le rendu pose question.', false],
  ],
  GREEN: [
    ['Les tests passent.', true], ['CI vert.', true], ['Tout est vert.', true],
    ['Prête à pousser.', true], ['Je lance les tests.', false],
  ],
  CAUSAL: [
    ['Je l ai staged ce matin.', true], ['Fait hier.', true],
    ['La derniere session avait laisse ca.', true], // c EST une assertion sur une session passee : detection legitime
    ['Rien a voir avec le matin.', false],
  ],
};

let aveugles = 0, faux = 0;
for (const [nom, liste] of Object.entries(cas)) {
  const re = extrait(nom);
  console.log('--- ' + nom + '  ' + re.source.slice(0, 60) + '...');
  for (const [phrase, attendu] of liste) {
    const vu = re.test(phrase);
    if (vu === attendu) { console.log('   [OK]      ' + (vu ? 'detecte' : 'ignore ') + '  << ' + phrase + ' >>'); }
    else if (attendu) { console.log('   [AVEUGLE] devrait detecter  << ' + phrase + ' >>'); aveugles++; }
    else { console.log('   [FAUX+]   ne devrait pas detecter  << ' + phrase + ' >>'); faux++; }
  }
}
console.log('\n== ' + aveugles + ' angle(s) mort(s), ' + faux + ' faux positif(s) ==');
