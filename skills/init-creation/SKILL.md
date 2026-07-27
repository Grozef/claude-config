---
name: init-creation
description: |
  Initialise le dossier creation/ dans le projet courant à partir des templates globaux (~/.claude/creation-templates/). Jeu minimal BRIEF-pivot, zéro template vide.
  TRIGGER when: "initialise le projet", "crée le dossier création", "init-creation", nouveau projet littéraire à démarrer
---

# Skill : init-creation
# Invocation : /init-creation [nom du projet]

Initialise la structure d'écriture minimale (architecture BRIEF-pivot). Principe : **zéro
template vide sur disque** — un guide détaillé n'est créé que lorsqu'il a du contenu réel.

**Projet :** $ARGUMENTS

## Étapes

1. **Vérifier que `creation/` n'existe pas déjà** dans le répertoire courant.
   S'il existe : lister son contenu et demander confirmation avant d'écraser quoi que ce soit.

2. **Demander en un seul message** (si non déductible du contexte) :
   - Le projet contient-il du contenu adulte ? (détermine la copie de NSFW.md)
   - Format de sortie : prose libre ou moteur (VN/chat scripté, outil d'insertion) ?

3. **Copier le jeu minimal** depuis `~/.claude/creation-templates/` vers `creation/` :
   - `BRIEF.md` → fichier PIVOT (voix, format, canon récent, section Intégration, règles absolues)
   - `SESSION-WRITING.md` → contexte chaud d'écriture
   - `CONTINUITE.md` → canon détaillé
   - `NSFW.md` → uniquement si projet adulte confirmé

   **Ne PAS copier les guides de `optionnels/`** (VOIX, PERSOS, LIEUX, TEMPS, STYLE, SCENES) :
   ils ne sont créés que plus tard, à la demande, quand un contenu réel existe pour les remplir.

4. **Remplacer `[NOM DU PROJET]`** dans chaque fichier copié par le nom fourni en argument
   (ou le nom du dossier courant si aucun argument).

5. **Pré-remplir la section Intégration de BRIEF.md** avec les réponses de l'étape 2
   (commandes d'inspection/insertion si moteur, "prose / Edit direct autorisé" sinon).

6. **Créer `creation/README.md`** :

```markdown
# Guides d'écriture — [NOM DU PROJET]

Architecture BRIEF-pivot : `BRIEF.md` suffit pour 90 % des tâches. Zéro template vide —
un guide détaillé (`optionnels/` : VOIX, SCENES, LIEUX...) n'est créé que rempli.
Référentiel transverse : `~/.claude/creation-templates/PRINCIPES-ECRITURE.md`.

## Ordre de travail

1. `BRIEF.md` — remplir voix + format + section Intégration (à la main ou via /update-brief
   si du contenu existe déjà)
2. Écrire (`/write-scene`) — le BRIEF s'affine au fil des scènes
3. `CONTINUITE.md` — tenu à jour par /update-canon après chaque session
4. `SESSION-WRITING.md` — tenu à jour par /write-scene

## Skills

- `/write-scene` — génère une scène (SFW ou NSFW) : PRINCIPES + BRIEF, validation avant insertion
- `/review-scene` — vérifie voix, continuité, cohérence
- `/update-canon` — persiste les nouveaux faits dans CONTINUITE.md
- `/update-brief` — (re)condense le BRIEF depuis le corpus
```

7. **Mettre à jour `.gitignore`** si le projet est un repo git :
   - Vérifier si `.gitignore` existe, le créer si absent
   - Ajouter si absentes :
     ```
     # Claude context files
     documentation_claude/SESSION.md
     documentation_claude/CONTEXT.md
     documentation_claude/DECISIONS.md
     # Claude creation guides (optionnel — retirer si tu veux versionner)
     creation/
     ```
   - Si pas de repo git → ignorer silencieusement

8. **Afficher le résultat** : liste des fichiers créés + prochaine action (remplir BRIEF.md,
   ou /update-brief si un corpus existe déjà).
