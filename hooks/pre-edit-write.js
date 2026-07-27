// PreToolUse Edit|Write : bloque si fichier cible non lu dans la session courante.
// Lance via : cat /dev/stdin | node pre-edit-write.js
const fs = require('fs');

let input = '';
try { input = fs.readFileSync(0, 'utf8'); } catch(e) { process.exit(0); }

let j;
try { j = JSON.parse(input); } catch(e) { process.exit(0); }

const file = (j.tool_input && j.tool_input.file_path) || '';
const transcript = j.transcript_path || '';

if (!file || !transcript) process.exit(0);
if (!fs.existsSync(transcript)) process.exit(0);
if (!fs.existsSync(file)) process.exit(0);

const norm = s => (s || '').replace(/\\/g, '/').toLowerCase();
const targetNorm = norm(file);

const lines = fs.readFileSync(transcript, 'utf8').split('\n');
for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const e = JSON.parse(line);
    const content = e.message && e.message.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      // "Fichier vu" = Read, Write (creation cette session), ou Edit precedent
      if (c.type === 'tool_use' && ['Read','Write','Edit'].includes(c.name) && c.input && c.input.file_path) {
        if (norm(c.input.file_path) === targetNorm) process.exit(0);
      }
    }
  } catch(err) {}
}

process.stderr.write(`BLOQUE par hook never-assume :
Tu tentes de modifier
  ${file}
sans l'avoir lu dans cette session.

Modifier un fichier sans Read prealable = supposition de son contenu = violation never-assume.

Action attendue :
  1. Read ${file}
  2. Puis re-lance ton Edit/Write

Si tu juges le Read inutile (ex: tu viens de creer ce fichier dans cette session), c'est probablement que le hook a un faux negatif. Signale-le.
`);
process.exit(2);
