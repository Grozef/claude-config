// UserPromptSubmit : lit ~/.claude/.reminders.log et injecte son contenu en additionalContext.
// Vide le fichier apres lecture (one-shot).

const fs = require('fs');
const os = require('os');
const path = require('path');

const reminderFile = path.join(os.homedir(), '.claude', '.reminders.log');
if (!fs.existsSync(reminderFile)) process.exit(0);

let content = '';
try { content = fs.readFileSync(reminderFile, 'utf8').trim(); } catch(e) { process.exit(0); }
if (!content) process.exit(0);

// Dedup : collapse les meta-reminders empiles en gardant seulement le plus recent.
{
  const lines = content.split('\n').filter(Boolean);
  const meta = lines.filter(l => /\[meta-reminder\]/.test(l));
  const others = lines.filter(l => !/\[meta-reminder\]/.test(l));
  if (meta.length) others.push(meta[meta.length - 1]);
  content = others.join('\n');
}

// Injecter
const payload = {
  hookSpecificOutput: {
    hookEventName: 'UserPromptSubmit',
    additionalContext: 'RAPPELS EN ATTENTE (depuis dernier(s) tour(s)) :\n' + content
  }
};
process.stdout.write(JSON.stringify(payload));

// Vider le fichier (one-shot)
try { fs.writeFileSync(reminderFile, ''); } catch(e) {}
process.exit(0);
