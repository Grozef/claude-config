const fs = require('fs');

// Le trio de contexte vit dans docs/documentation_claude/ (reorg 2026-07-17) ;
// fallbacks documentation_claude/ puis racine pour les projets pas encore migres
// -> l'ordre de migration ne casse pas la banniere.
const CTX_DIR = fs.existsSync('docs/documentation_claude') ? 'docs/documentation_claude'
  : fs.existsSync('documentation_claude') ? 'documentation_claude' : '.';
const SESS = CTX_DIR + '/SESSION.md';
const hasSess = fs.existsSync(SESS);
const hasComposer = fs.existsSync('composer.json');
const hasPkg = fs.existsSync('package.json');
const hasVue = hasPkg && fs.readFileSync('package.json', 'utf8').includes('"vue"');
const hasCreation = fs.existsSync('creation');
// Narratif = dossier de prose libre SANS structure. Un projet suivi par Claude
// (documentation_claude/ present) n'en est jamais un -> evite le faux positif sur
// un projet de code sans SESSION.md ayant un toDo.md/notes.md a la racine.
const hasNarrative = !hasCreation && CTX_DIR === '.'
  ? fs.readdirSync('.').some(f => f.match(/\.(md|txt)$/i) && !['README.md','CLAUDE.md','SESSION.md','CONTEXT.md','DECISIONS.md'].includes(f))
  : false;
const missingAppClaude = fs.existsSync('app') && !fs.existsSync('app/CLAUDE.md');
const missingJsClaude = fs.existsSync('resources/js') && !fs.existsSync('resources/js/CLAUDE.md');

const B = '\u250c' + '\u2500'.repeat(49) + '\u2510';
const E = '\u2514' + '\u2500'.repeat(49) + '\u2518';
const L = s => '\u2502  ' + s.padEnd(47) + '\u2502';

console.log('');
console.log(B);

if (hasSess) {
  const proj = ((fs.readFileSync(SESS, 'utf8').match(/Projet actif.*?:(.*)/)||[])[1] || '').replace(/[*`_]/g, '');
  console.log(L('Session reprise \u2014 contexte charg\u00e9'));
  if (proj.trim()) console.log(L('Projet : ' + proj.trim()));
  if (missingAppClaude || missingJsClaude) console.log(L('\u26a0 CLAUDE.md locaux manquants \u2014 /context-update'));
  console.log(L('/session-start pour le contexte complet'));
} else if (hasCreation) {
  console.log(L('Projet litt\u00e9raire d\u00e9tect\u00e9 (creation/ pr\u00e9sent)'));
  console.log(L('\u2192 /context-update pour initialiser le contexte'));
} else if (hasNarrative) {
  console.log(L('Fichiers narratifs d\u00e9tect\u00e9s sans structure'));
  console.log(L('\u2192 /init-creation pour initialiser le projet'));
} else if (hasComposer || hasVue) {
  const stack = hasComposer && hasVue ? 'Laravel+Vue' : hasComposer ? 'Laravel/PHP' : 'Vue';
  console.log(L('Projet ' + stack + ' d\u00e9tect\u00e9 sans contexte Claude'));
  console.log(L('\u2192 /context-update pour initialiser'));
} else {
  console.log(L('Nouveau projet \u2014 aucun contexte trouv\u00e9'));
  console.log(L('/context-update \u00b7 /init-creation si litt\u00e9raire'));
}

console.log(E);
console.log('');

if (hasSess) {
  // Injection integrale (les SESSION.md font ~10-64 lignes). Plafond DEFENSIF a 120 lignes
  // au cas ou un fichier grossit anormalement -> on borne le cout tokens au demarrage.
  const sess = fs.readFileSync(SESS, 'utf8');
  const ls = sess.split('\n');
  if (ls.length <= 120) process.stdout.write(sess);
  else process.stdout.write(ls.slice(0, 120).join('\n') + '\n[... SESSION.md tronque a 120 lignes — /session-start pour le reste]\n');
}

// Vault fiche injection DESACTIVEE — MEMORY.md contient deja le contexte projet.
// Les fiches vault sont lues a la demande via /session-start ou /update-fiche.
// Raison: eviter ~100 lignes de tokens dupliques au demarrage.

// Compteur leger du TODO global (chemin ABSOLU, independant du projet courant)
// + items non coches tagues pour le PROJET COURANT (cause d'incident 2026-07-05 :
// le plan "adapter l'import excel" etait dans le TODO depuis le 03/07 mais rien
// ne le lisait a la reprise -> session repartie a cote de la plaque).
// Borne tokens : 5 items max, lignes tronquees a 110 chars.
try {
  const VAULT = (require('./lib/vault-conf.js')()).CLAUDE_VAULT || '';
  // Le chemin du vault vit dans vault.conf (non versionne) : les skills le referencent
  // sous la forme $CLAUDE_VAULT, il faut donc leur donner la valeur resolue au demarrage.
  if (VAULT && fs.existsSync(VAULT)) console.log('Vault : ' + VAULT);
  const TODO = VAULT + '/TODO.md';
  if (VAULT && fs.existsSync(TODO)) {
    const lines = fs.readFileSync(TODO, 'utf8').split('\n');
    const counts = { op: 0, idee: 0, revue: 0 };
    const base = require('path').basename(process.cwd()).toLowerCase();
    const mine = [];
    // Format PAR PROJET (2026-07-15) : le type est un tag inline [op]/[idee]/[revue]
    // apres la case a cocher, pas un titre de section. On compte les items NON TERMINES :
    // cases vides [ ] ET en cours [~] (2026-07-15 : un item [~] etait invisible a la reprise).
    for (const l of lines) {
      const m = l.match(/^\s*-\s*\[([ ~])\]\s*\[(op|idee|revue)\]/);
      if (!m) continue;
      const inProgress = m[1] === '~';
      counts[m[2]]++;
      // tag [[x]] lie au projet courant si prefixe commun (monprojet <-> monprojet_back)
      const tags = [...l.matchAll(/\[\[([^\]]+)\]\]/g)].map(t => t[1].toLowerCase());
      if (tags.some(t => base.startsWith(t) || t.startsWith(base))) {
        mine.push((inProgress ? '[EN COURS] ' : '') + l.trim());
      }
    }
    const total = counts.op + counts.idee + counts.revue;
    if (total > 0) {
      console.log('TODO global : ' + counts.op + ' op | ' + counts.idee + ' idees | ' + counts.revue + ' revues  (/todo)');
    }
    if (mine.length > 0) {
      console.log('toDo lies a CE projet (a confronter a la "Prochaine etape" de SESSION.md) :');
      for (const item of mine.slice(0, 12)) {
        console.log('  ' + (item.length > 110 ? item.slice(0, 107) + '...' : item));
      }
      if (mine.length > 12) console.log('  (+' + (mine.length - 12) + ' autres — /todo list)');
    }
  }
} catch (e) { /* compteur best-effort, ne jamais bloquer le demarrage */ }

// Index des fiches meta/concepts/ RETIRE le 2026-09-04. Il injectait les 165 slugs a
// chaque session (~3 750 caracteres, ~950 tokens) : un nom de fiche n'est ni un declencheur
// ni une procedure, et la part de la classe d'erreur qu'il devait enrayer est passee de
// 61 % a 83 % pendant qu'il tournait. Le rappel est desormais CIBLE et porte du CONTENU :
// user-prompt-submit.js remonte les 2 notes proches de la demande avec extrait
// (lib/vault-search.js), post-fail-vault.js fait de meme sur echec d'outil.
// Code d'origine : git show c5a9ecd:hooks/session-start.js
