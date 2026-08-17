---
name: context-update
description: |
  Initialise ou met à jour CONTEXT.md quand la structure ou l'architecture du projet change. Crée aussi SESSION.md et DECISIONS.md s'ils n'existent pas.
  TRIGGER when: "mets à jour le contexte", "init le projet", "context-update", nouveau projet sans SESSION.md, changement d'architecture majeur
allowed-tools: Read, Write, Edit, Glob, Bash
---

# Skill : context-update — `/context-update [changement]`

**Changement :** $ARGUMENTS
Le trio de contexte vit dans `documentation_claude/` (reorg 2026-07-17). `CLAUDE.md` et `.claude/` restent à la racine : ne pas y toucher.

1. **Inventaire** : `documentation_claude/{CONTEXT,SESSION,DECISIONS}.md`. Créer le dossier puis les fichiers manquants depuis `~/.claude/project-templates/`.
2. **Explorer** pour alimenter CONTEXT.md : `package.json` / `composer.json` (stack, version, nom), dossiers racine, points d'entrée.
3. **CONTEXT.md** : vue d'ensemble + stack détectée, arborescence simplifiée (10 entrées max), conventions visibles dans le code existant. **40 lignes max** — au-delà, résumer chaque section verbeuse en une ligne.
4. **SESSION.md** si absent : état "Projet initialisé", compteur 0, prochaine étape à définir par l'utilisateur. **50 lignes max.**
5. **`.claudeignore`** : copier `~/.claude/project-templates/.claudeignore` à la racine si absent. Ne jamais écraser.
6. **CLAUDE.md par sous-dossier** si Laravel/Vue détecté, sans écraser :
   - `app/` existe et `app/CLAUDE.md` absent -> copier `~/.claude/project-templates/CLAUDE-app.md`
   - `resources/js/` existe et son `CLAUDE.md` absent -> copier `CLAUDE-resources-js.md`
7. **`.gitignore`** si repo git (sinon ignorer silencieusement) — créer si absent, ajouter les entrées manquantes :
   ```
   # Claude context files
   documentation_claude/SESSION.md
   documentation_claude/CONTEXT.md
   documentation_claude/DECISIONS.md
   ```
8. **Confirmer** en une ligne ce qui a été créé ou mis à jour.
