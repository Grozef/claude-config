---
name: context-update
description: |
  Initialise ou met à jour CONTEXT.md quand la structure ou l'architecture du projet change. Crée aussi SESSION.md et DECISIONS.md s'ils n'existent pas.
  TRIGGER when: "mets à jour le contexte", "init le projet", "context-update", nouveau projet sans SESSION.md, changement d'architecture majeur
allowed-tools: Read, Write, Edit, Glob, Bash
---

# Skill : context-update
# Invocation : /context-update [description optionnelle du changement]

**Changement :** $ARGUMENTS

## Étapes

1. **Vérifier quels fichiers existent** dans le projet courant (reorg 2026-07-17 : le trio vit dans `documentation_claude/`) :
   - `documentation_claude/CONTEXT.md`, `documentation_claude/SESSION.md`, `documentation_claude/DECISIONS.md`
   - Créer le dossier `documentation_claude/` si absent
   - Si les fichiers sont absents → les créer dans `documentation_claude/` depuis les templates de `~/.claude/project-templates/`
   - Ne PAS toucher `CLAUDE.md` ni `.claude/` (restent à la racine, auto-load Claude Code)

2. **Explorer la structure du projet** pour remplir ou mettre à jour `CONTEXT.md` :
   - Lire `package.json` ou `composer.json` si présent (stack, version, nom)
   - Lister les dossiers principaux (`ls` à la racine)
   - Identifier les points d'entrée clés

3. **Mettre à jour `CONTEXT.md`** avec :
   - Vue d'ensemble et stack détectée
   - Structure du projet (arborescence simplifiée — max 10 entrées)
   - Conventions visibles dans le code existant
   - **Limite stricte : 40 lignes max.** Si le contenu dépasse → résumer les sections verbeuses en une ligne chacune.

4. **Initialiser `documentation_claude/SESSION.md`** si absent :
   - État actuel : "Projet initialisé"
   - Compteur : 0
   - Prochaine étape : à définir par l'utilisateur
   - **Limite stricte : 50 lignes max.**

5. **Déployer `.claudeignore`** si absent à la racine du projet :
   - Copier `~/.claude/project-templates/.claudeignore` → `./.claudeignore`
   - Si déjà présent → ne pas écraser
   - Signaler : `✓ .claudeignore créé`

6. **Déployer les CLAUDE.md par sous-dossier** si projet Laravel/Vue détecté :
   - Si `app/` existe et `app/CLAUDE.md` absent → copier `~/.claude/project-templates/CLAUDE-app.md` vers `app/CLAUDE.md`
   - Si `resources/js/` existe et `resources/js/CLAUDE.md` absent → copier `~/.claude/project-templates/CLAUDE-resources-js.md` vers `resources/js/CLAUDE.md`
   - Si copiés → signaler en une ligne (ex: `✓ CLAUDE.md créés dans app/ et resources/js/`)
   - Si déjà présents → ne pas écraser, ignorer silencieusement

6. **Mettre à jour `.gitignore`** si le projet est un repo git :
   - Vérifier si `.gitignore` existe, le créer si absent
   - Ajouter les entrées suivantes si absentes :
     ```
     # Claude context files
     documentation_claude/SESSION.md
     documentation_claude/CONTEXT.md
     documentation_claude/DECISIONS.md
     ```
   - Si pas de repo git → ignorer silencieusement

7. **Confirmer** en une ligne ce qui a été créé/mis à jour.
