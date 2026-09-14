// UserPromptSubmit unifie : remplace inject-reminders + user-prompt + remind-verify + force-clarify
// (4 spawns -> 1). Emet UN seul hookSpecificOutput.additionalContext concatene.
// Les 4 anciens fichiers ont ete supprimes le 2026-09-04 (aucun n'etait declare depuis
// l'unification) : leur code reste dans git, commit c5a9ecd.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { search } = require('./lib/vault-search.js');

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

// (2) Pointeur vers les regles, PAS leur recitation : CLAUDE.md est deja en contexte
// pour la session entiere, et 9 gates bloquants les appliquent en fin de tour. Ce qui
// justifie de garder une ligne : en session longue, les regles de tete de contexte
// finissent ignorees (decision 2026-06-07) — un pointeur court suffit a les rappeler.
parts.push('Regles CLAUDE.md actives : never-assume, nomme-l-artefact, surgical, clarify-first. Gates Stop bloquants (dont succes silencieux exit 0).');

// (3) CLARIFY-FIRST si verbes de production detectes.
const norm = prompt.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const PROD = /(ajoute|ajouter|fix|fixe|refactor|implement|corrige|corriger|modifie|modifier|debug|ecris|ecrire|cree |creer |reecris|nettoie|nettoyer|optimise|optimiser|migre |migrer|setup|configure|configurer|deploi|installe|installer|remplace|remplacer|supprime|supprimer|enleve|enlever|met a\s*jour|mets a\s*jour|update|integre|integrer|change la|change le|change les)/;
// (3) CLARIFY-FIRST + SURGICAL : SUPPRIMES le 2026-09-04. Ils recitaient mot pour mot
// trois sections de CLAUDE.md, deja chargees, pour 1 295 car a chaque prompt de
// production — soit ~7 800 tokens cumules sur une session de 30 tours. Le pointeur (2)
// les nomme ; les gates 2e (scope-creep) et 1 (production non verifiee) les appliquent.

// (3c) RAPPEL VAULT CIBLE — sur prompt de production, les 2 notes du vault les plus
// proches de la DEMANDE, avec extrait. Remplace l'index des 165 slugs que session-start.js
// injectait a chaque session (~950 tokens, aucun contenu, aucune trajectoire changee).
// Le rappel arrive AVANT la premiere commande : post-fail-vault.js, lui, ne se declenche
// que sur un echec d'outil, or la classe dominante des erreurs du vault sort en exit 0.
if (PROD.test(norm)) {
  try {
    const hits = search(prompt, 2);
    if (hits.length) {
      const l = ['VAULT — deja ecrit la-dessus, lire avant de rediagnostiquer :'];
      for (const h of hits) {
        l.push('  ' + h.label + (h.label.includes('/concepts/') ? '' : ' :: ' + h.title) + '   [' + h.matched.join(' ') + ']');
        if (h.excerpt) l.push('      ' + h.excerpt.slice(0, 110));
      }
      l.push('Si hors sujet, ignorer sans commentaire.');
      parts.push(l.join('\n'));
    }
  } catch (e) { /* rappel best-effort : ne jamais casser la soumission du prompt */ }
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
