// UserPromptSubmit unifie : remplace inject-reminders + user-prompt + remind-verify + force-clarify
// (4 spawns -> 1). Emet UN seul hookSpecificOutput.additionalContext concatene.
// Anciens fichiers conserves pour rollback.
const fs = require('fs');
const os = require('os');
const path = require('path');

let prompt = '';
try {
  const d = fs.readFileSync(0, 'utf8');
  prompt = (JSON.parse(d).prompt) || '';
} catch (e) {}

const parts = [];

// (1) Rappels en attente (.reminders.log) — dedup meta-reminders, garde le plus recent, vide le fichier.
try {
  const rf = path.join(os.homedir(), '.claude', '.reminders.log');
  if (fs.existsSync(rf)) {
    const raw = fs.readFileSync(rf, 'utf8').trim();
    if (raw) {
      const lines = raw.split('\n').filter(Boolean);
      const meta = lines.filter(l => /\[meta-reminder\]/.test(l));
      const others = lines.filter(l => !/\[meta-reminder\]/.test(l));
      if (meta.length) others.push(meta[meta.length - 1]);
      if (others.length) parts.push('RAPPELS EN ATTENTE (depuis dernier(s) tour(s)) :\n' + others.join('\n'));
      fs.writeFileSync(rf, '');
    }
  }
} catch (e) {}

// (2) Pointeur never-assume (toujours).
parts.push("never-assume : verifie la source (Read/Grep/Bash) avant toute assertion ; negation d'existence -> jamais nue (scope explicite ou recherche home+www+Desktop). Gate Stop bloquant actif.");

// (3) CLARIFY-FIRST si verbes de production detectes.
const norm = prompt.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const PROD = /(ajoute|ajouter|fix|fixe|refactor|implement|corrige|corriger|modifie|modifier|debug|ecris|ecrire|cree |creer |reecris|nettoie|nettoyer|optimise|optimiser|migre |migrer|setup|configure|configurer|deploi|installe|installer|remplace|remplacer|supprime|supprimer|enleve|enlever|met a\s*jour|mets a\s*jour|update|integre|integrer|change la|change le|change les)/;
if (PROD.test(norm)) {
  parts.push("PRODUCTION -> CLARIFY-FIRST : avant tout Edit/Write/Bash producteur, cite les fichiers lus pour le contexte et pose >=1 question si une info critique manque (forme de donnee, comportement, perimetre). Trivial (1 ligne, fichier deja lu) : cite juste le Read.");
  parts.push("SURGICAL (Karpathy #3) : ne touche QUE ce que la demande impose. Interdit d'ameliorer/refactoriser/reformater le code adjacent non concerne, ou de supprimer du dead code preexistant (signale-le). Simplicite d'abord : code minimal, rien de speculatif. Chaque ligne modifiee doit tracer a la demande.");
}

// (3b) Mot-cle interrogatif `scope ?` (au meme titre que `artefact ?`) : l'utilisateur
// demande de tracer mes changements. Force la justification ligne-a-ligne.
if (/\bscope\s*\?/i.test(prompt)) {
  parts.push("SCOPE ? demande : liste CHAQUE fichier/bloc modifie ce tour et trace-le a la demande explicite de l'utilisateur. Tout changement qui ne trace pas (amelioration/refacto/reformat de l'adjacent, dead code touche) = scope-creep a reverter ou signaler. Ne dis pas 'chirurgical' sans avoir nomme les lignes.");
}

// (4) Avertissement paste (message tres long sans question -> prefere @fichier).
const len = prompt.length;
const hasQ = prompt.includes('?') || /^(comment|pourquoi|quand|est-ce|peux-tu|montre|explique|fais|genere|ecris|aide)/i.test(prompt);
if (len > 800 && !hasQ && prompt.split('\n').length > 10) {
  parts.push('Message tres long sans question detectee (' + len + ' car). Si tu colles un fichier, prefere @nom-du-fichier pour economiser des tokens.');
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: parts.join('\n\n') }
}));
