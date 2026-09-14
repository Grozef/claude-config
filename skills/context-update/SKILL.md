---
name: context-update
description: |
  Charge le contexte du projet en reprise de session (SESSION.md, CONTEXT.md, DECISIONS.md, toDo projet), ou initialise / met a jour ce contexte quand la structure ou l'architecture change.
  TRIGGER when: debut de session, "ou on en etait", "reprends le contexte", "charge le contexte", "mets a jour le contexte", "init le projet", "context-update", nouveau projet sans SESSION.md, changement d'architecture majeur
allowed-tools: Read, Write, Edit, Glob, Bash
---

# Skill : context-update — `/context-update [init | <changement>]`

**Arguments :** $ARGUMENTS

| Arguments | Mode | Effet |
|---|---|---|
| (vide) | REPRISE | LECTURE SEULE. Resume l'etat depuis les fichiers charges ci-dessous. |
| `init` | INIT | Cree le trio manquant + deploie les templates. |
| tout autre texte | MAJ | Repercute le changement decrit dans CONTEXT.md, puis section 2 a 8. |

Le trio de contexte vit dans `docs/documentation_claude/` ou `documentation_claude/` (reorg 2026-07-17 ;
les deux existent sur le parc). Ordre de resolution ci-dessous : `docs/` d'abord, puis la racine du
projet — le MEME ordre que `hooks/session-start.js`. En modes INIT/MAJ, ecrire dans l'emplacement
DEJA utilise par le projet ; s'il n'y en a aucun, creer `documentation_claude/`.
`CLAUDE.md` et `.claude/` restent a la racine : ne pas y toucher.

---

!`cat docs/documentation_claude/SESSION.md 2>/dev/null || cat documentation_claude/SESSION.md 2>/dev/null || cat SESSION.md 2>/dev/null || echo "SESSION.md absent — /context-update init pour initialiser"`

---

!`cat docs/documentation_claude/CONTEXT.md 2>/dev/null || cat documentation_claude/CONTEXT.md 2>/dev/null || cat CONTEXT.md 2>/dev/null || echo "CONTEXT.md absent"`

---

!`(cat docs/documentation_claude/DECISIONS.md 2>/dev/null || cat documentation_claude/DECISIONS.md 2>/dev/null || cat DECISIONS.md 2>/dev/null || echo "DECISIONS.md absent") | head -60`

---

!`bash ~/.claude/tools/todo-project.sh`

---

## Mode REPRISE (arguments vides) — ne rien ecrire

A partir des fichiers charges ci-dessus, produire UNIQUEMENT :

```
## Contexte charge — [NOM DU PROJET]

Etat : [1 phrase sur ou en est le projet]
Derniere action : [ce qui a ete fait]
Prochaine etape : [ce qui doit etre fait]

Fichiers actifs : [liste courte]
Decisions recentes : [1-2 decisions cles si pertinentes]
Problemes en suspens : [si applicable]
toDo projet : [items non coches tagues [[projet]] charges ci-dessus, ou "aucun"]
```

Si un item du toDo projet contredit ou complete la "Prochaine etape" de SESSION.md, le signaler
explicitement (le toDo peut porter un engagement que le checkpoint a rate).

Puis attendre la demande de l'utilisateur. Ne pas proposer d'actions spontanement.
Ne creer aucun fichier dans ce mode, meme si le trio est absent : le dire, et s'arreter.

## Modes INIT et MAJ (arguments non vides)

1. **Inventaire** : `documentation_claude/{CONTEXT,SESSION,DECISIONS}.md`. Creer le dossier puis les fichiers manquants depuis `~/.claude/project-templates/`.
2. **Explorer** pour alimenter CONTEXT.md : `package.json` / `composer.json` (stack, version, nom), dossiers racine, points d'entree.
3. **CONTEXT.md** : vue d'ensemble + stack detectee, arborescence simplifiee (10 entrees max), conventions visibles dans le code existant. **40 lignes max** — au-dela, resumer chaque section verbeuse en une ligne.
4. **SESSION.md** si absent : etat "Projet initialise", compteur 0, prochaine etape a definir par l'utilisateur. **50 lignes max.**
5. **`.claudeignore`** : copier `~/.claude/project-templates/.claudeignore` a la racine si absent. Ne jamais ecraser.
6. **CLAUDE.md par sous-dossier** si Laravel/Vue detecte, sans ecraser :
   - `app/` existe et `app/CLAUDE.md` absent -> copier `~/.claude/project-templates/CLAUDE-app.md`
   - `resources/js/` existe et son `CLAUDE.md` absent -> copier `CLAUDE-resources-js.md`
7. **`.gitignore`** si repo git (sinon ignorer silencieusement) — creer si absent, ajouter les entrees manquantes :
   ```
   # Claude context files
   documentation_claude/SESSION.md
   documentation_claude/CONTEXT.md
   documentation_claude/DECISIONS.md
   ```
8. **Confirmer** en une ligne ce qui a ete cree ou mis a jour.
