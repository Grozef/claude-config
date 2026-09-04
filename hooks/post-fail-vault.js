// PostToolUseFailure : cherche dans le vault une note deja ecrite sur CET echec
// et l'injecte a cote du resultat d'outil, AVANT toute commande de diagnostic.
//
// Cause d'incident 2026-08-10 : `composer create-project` echoue en "self-signed
// certificate in certificate chain" ; six appels d'outils pour rediagnostiquer une
// interception TLS Cato documentee depuis le 2026-07-16 (meta/concepts/cato-tls-interception.md
// + learnings.md). La trace existait, rien ne declenchait sa lecture.
//
// Le moteur de recherche vit dans lib/vault-search.js depuis le 2026-09-04 : il sert
// aussi au rappel AVANT tache (user-prompt-submit.js), parce qu'attendre un echec
// d'outil ne rappelle jamais rien sur la classe d'erreurs qui sort en exit 0.

const fs = require('fs');
const { search } = require('./lib/vault-search.js');

const MAX_HITS = 3;

function readInput() {
  try {
    // UNIQUEMENT `error`. Joindre la commande paraissait utile (elle nomme l'outil)
    // mais ses tokens generiques — docker, compose, artisan, tests — matchent une note
    // sur trois : verifie le 2026-08-10, un `php artisan test` en echec remontait
    // trois notes sur les gates de verification, sans aucun rapport avec l'echec.
    // Tronque : le message utile est en tete, la suite est du remplissage d'outil
    // (banniere d'usage, liste de flags, stack trace). Verifie le 2026-08-10 sur un
    // `composer show` en echec — les flags --locked/--strict/--patch-only devenaient
    // des termes de scoring et ejectaient les notes Cato du top 3.
    return (JSON.parse(fs.readFileSync(0, 'utf8')).error || '').slice(0, 1200);
  } catch (e) { return ''; }
}

const hits = search(readInput(), MAX_HITS);
if (hits.length === 0) process.exit(0);

const lines = ['VAULT — notes deja ecrites qui pourraient couvrir cet echec. Les lire AVANT toute commande de diagnostic :'];
for (const h of hits) {
  lines.push('  ' + h.label + (h.label.includes('/concepts/') ? '' : ' :: ' + h.title) + '   [' + h.matched.join(' ') + ']');
  if (h.excerpt) lines.push('      ' + h.excerpt);
}
lines.push("Si aucune ne correspond, dis-le et diagnostique. Sinon : Read la note, applique ce qu'elle documente, ne redecouvre pas.");

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'PostToolUseFailure', additionalContext: lines.join('\n') }
}));
