---
name: init-creation
description: |
  Initialise le dossier creation/ dans le projet courant à partir des templates globaux (~/.claude/creation-templates/). Jeu minimal BRIEF-pivot, zéro template vide.
  TRIGGER when: "initialise le projet", "crée le dossier création", "init-creation", nouveau projet littéraire à démarrer
---

# Skill : init-creation — `/init-creation [nom du projet]`

**Projet :** $ARGUMENTS
Architecture BRIEF-pivot. Principe dur : **zéro template vide sur disque** — un guide détaillé n'existe que rempli.

1. **Si `creation/` existe déjà** : lister son contenu et demander confirmation avant d'écraser quoi que ce soit.
2. **Demander en un seul message** (si non déductible) : contenu adulte ou non (détermine `NSFW.md`) ; sortie prose libre ou moteur (VN/chat scripté, outil d'insertion).
3. **Copier le jeu minimal** depuis `~/.claude/creation-templates/` : `BRIEF.md` (PIVOT : voix, format, canon récent, section Intégration, règles absolues), `SESSION-WRITING.md`, `CONTINUITE.md`, plus `NSFW.md` si projet adulte confirmé.
   Ne PAS copier `optionnels/` (VOIX, PERSOS, LIEUX, TEMPS, STYLE, SCENES) : créés plus tard, à la demande, quand un contenu réel existe.
4. **Remplacer `[NOM DU PROJET]`** dans chaque fichier par l'argument, ou le nom du dossier courant à défaut.
5. **Pré-remplir la section Intégration de BRIEF.md** avec les réponses de l'étape 2 (commandes d'inspection/insertion si moteur, "prose / Edit direct autorisé" sinon).
6. **Créer `creation/README.md`** : rappel de l'architecture BRIEF-pivot et du zéro-template-vide, pointeur vers `~/.claude/creation-templates/PRINCIPES-ECRITURE.md`, ordre de travail (BRIEF -> `/write-scene` -> `/update-canon` -> `SESSION-WRITING.md`), liste des 4 skills (`write-scene`, `review-scene`, `update-canon`, `update-brief`) en une ligne chacun.
7. **`.gitignore`** si repo git (sinon ignorer silencieusement) — créer si absent, ajouter si manquantes :
   ```
   # Claude context files
   documentation_claude/SESSION.md
   documentation_claude/CONTEXT.md
   documentation_claude/DECISIONS.md
   # Claude creation guides (optionnel — retirer si tu veux versionner)
   creation/
   ```
8. **Afficher** les fichiers créés + la prochaine action : remplir BRIEF.md, ou `/update-brief` si un corpus existe déjà.
