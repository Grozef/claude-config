// Stop async : rappel non bloquant si session substantielle sans capture meta/
// Ecrit dans ~/.claude/.reminders.log -> user-prompt-submit.js le lit et le vide au prochain prompt.
// (stdout d'un hook async = invisible a l'utilisateur, confirme par doc Claude Code)

const fs = require('fs');
const os = require('os');
const path = require('path');

let input = '';
try { input = fs.readFileSync(0, 'utf8'); } catch(e) { process.exit(0); }

let j;
try { j = JSON.parse(input); } catch(e) { process.exit(0); }

const transcript = j.transcript_path || '';
if (!transcript || !fs.existsSync(transcript)) process.exit(0);

const lines = fs.readFileSync(transcript, 'utf8').split('\n').filter(l => l.trim());

let assistantMsgs = 0;
let metaEdits = 0;

for (const line of lines) {
  try {
    const e = JSON.parse(line);
    const content = e.message && e.message.content;
    if (!Array.isArray(content)) continue;
    const role = e.message.role;
    for (const c of content) {
      if (c.type === 'text' && role === 'assistant') {
        if ((c.text || '').trim().length > 50) assistantMsgs++;
      }
      if (c.type === 'tool_use' && (c.name === 'Edit' || c.name === 'Write')) {
        const fp = (c.input && c.input.file_path) || '';
        if (/[\\\/]Obsidian[\\\/]meta[\\\/](erreurs|learnings|decisions-recurrentes)\.md$/i.test(fp)) {
          metaEdits++;
        }
      }
    }
  } catch(err) {}
}

if (assistantMsgs < 8) process.exit(0);
if (metaEdits > 0) process.exit(0);

const reminderFile = path.join(os.homedir(), '.claude', '.reminders.log');
// Dedup : si un meta-reminder est deja en attente, ne pas en empiler un second (cap a 1).
try {
  if (fs.existsSync(reminderFile) && /\[meta-reminder\]/.test(fs.readFileSync(reminderFile, 'utf8'))) {
    process.exit(0);
  }
} catch (e) {}
const now = new Date().toISOString();
const msg = `[${now}] [meta-reminder] Session ${assistantMsgs} msgs sans capture dans Obsidian/meta/. Verifier : erreurs.md / learnings.md / decisions-recurrentes.md (regle CLAUDE.md "Capture continue").`;
try {
  fs.appendFileSync(reminderFile, msg + '\n');
} catch(e) {}
process.exit(0);
