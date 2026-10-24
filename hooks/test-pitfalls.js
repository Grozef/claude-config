// Banc de pitfalls.js : node ~/.claude/hooks/test-pitfalls.js (a relancer apres toute modif du hook).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.join(__dirname, 'pitfalls.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pitfalls-'));
fs.writeFileSync(path.join(tmp, 'crlf.md'), 'a\r\nb\r\n');
fs.writeFileSync(path.join(tmp, 'lf.md'), 'a\nb\n');
fs.mkdirSync(path.join(tmp, 'meta'));
const ERR = path.join(tmp, 'meta', 'erreurs.md');

let pass = 0, fail = 0;
function run(label, input, expect, raw) {
  const r = spawnSync('node', [HOOK], { input: raw !== undefined ? raw : JSON.stringify(input), encoding: 'utf8' });
  let got = 'pass';
  if (r.status !== 0) got = 'exit' + r.status;
  else if (r.stdout) {
    const o = JSON.parse(r.stdout);
    if (o.hookSpecificOutput && o.hookSpecificOutput.permissionDecision === 'deny') got = 'deny';
    else if (o.decision === 'block') got = 'block';
    else if (o.hookSpecificOutput && o.hookSpecificOutput.additionalContext) got = 'context';
  }
  if (got === expect) { pass++; console.log('[OK]  ' + label + ' (' + got + ')'); }
  else { fail++; console.log('[x]   ' + label + ' (' + got + ', ATTENDU ' + expect + ')'); }
}
const bash = (command) => ({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, cwd: tmp });
const BS = '\\';

run('heredoc, corps avec antislash double', bash("cat > x.js <<'EOF'\ns.replace(/" + BS + BS + "/g,'/')\nEOF\nnode x.js"), 'deny');
run('heredoc, antislash simple', bash("python - <<'EOF'\nimport re; re.sub(r'" + BS + "s','',x)\nEOF"), 'pass');
run('heredoc sans antislash', bash('cat <<EOF\nbonjour\nEOF'), 'pass');
run('antislash double hors heredoc', bash('printf "a' + BS + BS + 'b"'), 'pass');
run('heredoc <<-, delimiteur indente', bash('cat <<-FIN\n\tx' + BS + BS + 'y\n\tFIN'), 'deny');
run('antislash double APRES le heredoc', bash("cat <<'EOF'\nok\nEOF\necho '" + BS + BS + "'"), 'pass');
// Faux positifs trouves par le relecteur du 2026-10-24 : pas de ligne delimiteur = pas de heredoc.
run('here-string <<< puis antislash double', bash('grep foo <<< word\necho "a' + BS + BS + 'b"'), 'pass');
run('decalage $((1<<n)) puis antislash double', bash('echo $((1<<n))\nprintf "' + BS + BS + 'n"'), 'pass');
run('decalage dans node -e puis antislash', bash('node -e "const a=1<<b"\nprintf "' + BS + BS + '"'), 'pass');
run('heredoc jamais ferme', bash("cat <<'EOF'\nx" + BS + BS + 'y'), 'pass');
run('sed -i sur fichier CRLF', bash("sed -i 's/a/b/' crlf.md"), 'deny');
run('sed -i sur fichier LF', bash("sed -i 's/a/b/' lf.md"), 'pass');
run('sed -n sur fichier CRLF', bash('sed -n 1p crlf.md'), 'pass');
run('sed -i chemin absolu CRLF', bash("sed -i 's/a/b/' \"" + path.join(tmp, 'crlf.md').replace(/\\/g, '/') + '"'), 'deny');
run('sed -i via variable (angle mort)', bash("F=crlf.md; sed -i 's/a/b/' \"$F\""), 'pass');
run('sed -i dans un pipeline, 2e segment', bash("ls && sed -i.bak -e 's/a/b/' crlf.md"), 'deny');
run('TaskStop -> rappel du port', { hook_event_name: 'PostToolUse', tool_name: 'TaskStop', tool_input: {} }, 'context');

fs.writeFileSync(ERR, '## 2026-10-24 — titre\n\ncorps\n\n## 2026-10-23 — ancien\n\nx\nDetecte : gate\n');
run('erreurs.md, tete sans Detecte', { hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: ERR } }, 'block');
fs.writeFileSync(ERR, '## 2026-10-24 — titre\r\n\r\ncorps\r\nDetecte : moi (x)\r\n');
run('erreurs.md, mode hors liste', { hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: ERR } }, 'block');
fs.writeFileSync(ERR, '## 2026-10-24 — titre\r\n\r\ncorps\r\nDetecte : apres-livraison (x)\r\n');
fs.writeFileSync(ERR, '## 2026-10-24 — titre\n\ncorps\nDetecte : gate-xyz\n');
run('erreurs.md, mode colle a un suffixe', { hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: ERR } }, 'block');
fs.writeFileSync(ERR, '## 2026-10-24 — titre\r\n\r\ncorps\r\nDetecte : apres-livraison (x)\r\n');
run('erreurs.md, mode valide, CRLF', { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: ERR } }, 'pass');
run('autre fichier edite', { hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: path.join(tmp, 'lf.md') } }, 'pass');
run('entree illisible', null, 'pass', '{pas du json');

fs.rmSync(tmp, { recursive: true, force: true });
console.log('== ' + pass + ' OK / ' + (pass + fail) + ' cas ==');
process.exit(fail ? 1 : 0);
