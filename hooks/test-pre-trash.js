// Banc de pre-trash.js : node ~/.claude/hooks/test-pre-trash.js (a relancer apres toute modif du hook).
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.join(__dirname, 'pre-trash.js');
let pass = 0, fail = 0;
function run(label, tool_name, command, expect) {
  const r = spawnSync('node', [HOOK], { input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name, tool_input: { command } }), encoding: 'utf8' });
  let got = r.status !== 0 ? 'exit' + r.status : 'pass';
  if (r.status === 0 && r.stdout && JSON.parse(r.stdout).hookSpecificOutput.permissionDecision === 'deny') got = 'deny';
  if (got === expect) { pass++; console.log('[OK]  ' + label + ' (' + got + ')'); }
  else { fail++; console.log('[x]   ' + label + ' (' + got + ', ATTENDU ' + expect + ')'); }
}

run('rm -rf en tete', 'Bash', 'rm -rf build', 'deny');
run('rm apres &&', 'Bash', 'cd x && rm f.txt', 'deny');
run('rm apres saut de ligne', 'Bash', 'ls\nrm a', 'deny');
run('xargs rm', 'Bash', 'ls *.log | xargs rm', 'deny');
run('find -exec rm', 'Bash', 'find . -name "*.tmp" -exec rm {} +', 'deny');
run('sous-shell (rm', 'Bash', '(rm a)', 'deny');
run('then rm', 'Bash', 'if true; then rm a; fi', 'deny');
run('rmdir', 'Bash', 'rmdir vide', 'deny');
run('unlink', 'Bash', 'unlink lien', 'deny');
run('PowerShell Remove-Item', 'PowerShell', 'Remove-Item -Recurse -Force .\\dist', 'deny');
run('PowerShell del', 'PowerShell', 'del a.txt', 'deny');
run('PowerShell ri apres ;', 'PowerShell', 'cd x; ri a.txt', 'deny');
run('motif grep entre guillemets', 'Bash', 'grep -nE "rm|Remove-Item|del" f', 'pass');
run('trap entre apostrophes', 'Bash', "trap 'rm -rf \"$T\"' EXIT", 'pass');
run('git rm', 'Bash', 'git rm old.md', 'pass');
run('git -C x rm', 'Bash', 'git -C /c/x rm old.md', 'pass');
run('echo rm', 'Bash', 'echo rm', 'pass');
run('trash.sh', 'Bash', 'bash ~/.claude/tools/trash.sh a b', 'pass');
run('rm-like nom de commande', 'Bash', 'rm-cache --dry', 'pass');
run('Read ignore', 'Read', 'rm -rf x', 'pass');
const msg = spawnSync('node', [HOOK], { input: JSON.stringify({ tool_name: 'PowerShell', tool_input: { command: 'cd x; Remove-Item a' } }), encoding: 'utf8' });
if (/`Remove-Item` refuse/.test(msg.stdout)) { pass++; console.log('[OK]  message nomme la commande'); } else { fail++; console.log('[x]   message : ' + msg.stdout); }
const r = spawnSync('node', [HOOK], { input: 'pas du json', encoding: 'utf8' });
if (r.status === 0 && !r.stdout) { pass++; console.log('[OK]  JSON invalide (silence)'); } else { fail++; console.log('[x]   JSON invalide'); }

console.log(`\n${pass} OK, ${fail} KO`);
process.exit(fail ? 1 : 0);
