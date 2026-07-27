---
name: update-fiche
description: |
  Met a jour la note de fiche `projets/<nom>/<nom>.md` du projet courant dans le vault Obsidian en relisant le code source.
  TRIGGER when: "update-fiche", "mets a jour la fiche", apres un refactor ou changement d'archi, "la fiche est obsolete"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
model: claude-sonnet-4-6
---

# Skill : update-fiche
# Invocation : /update-fiche [focus optionnel]

**Contexte fourni :** $ARGUMENTS

## Etapes

1. **Identifier le projet** : determiner le nom vault depuis le CWD (table de mapping : `~/.claude/vault-map.conf`, non versionne).

2. **Lire la fiche actuelle** : `$CLAUDE_VAULT/projets/<nom>/<nom>.md` (la convention vault = `<nom>.md`, PAS `FICHE.md` ; aucune fiche ne s'appelle `FICHE.md`). Note son frontmatter : `type`, `stack`, `deploy`, `status`, `tags`, `updated`.

3. **Scanner le code source** pour detecter les changements :
   - `package.json` ou `composer.json` → stack, deps
   - Structure des dossiers → architecture
   - `docker-compose.yml`, `Dockerfile` → si nouveau deploiement
   - `.env.example` → nouvelles variables
   - Migrations recentes → schema BDD
   - Ne lire que les fichiers de config/structure, PAS tout le code

4. **Comparer** avec la fiche existante :
   - Lister les differences trouvees
   - Ne modifier QUE ce qui a change
   - Mettre a jour le frontmatter : `updated: YYYY-MM-DD` (toujours), et `stack`/`deploy`/`status`/`tags` si change. Preserver `type`. Si une ligne `> Derniere verification : YYYY-MM-DD` existe dans le corps, l'aligner aussi.

5. **Ecrire** la fiche mise a jour :
   - Dans le vault : `$CLAUDE_VAULT/projets/<nom>/<nom>.md` (jamais `FICHE.md`)
   - Dans le projet (si le repo a un doc de fiche local) : conserver le nom de fichier existant du repo
   - Si `<nom>-infra.md` existe dans le vault et des changements docker/deploy detectes, mettre a jour aussi

6. **Confirmer** : `Fiche mise a jour — [changements en 10 mots]`

## Regles

- Ne pas inventer. Si pas de changement detecte, dire "Fiche a jour, aucun changement."
- Garder le meme format que les fiches existantes (frontmatter standardise + corps)
- Max 80 lignes par fiche `<nom>.md`
