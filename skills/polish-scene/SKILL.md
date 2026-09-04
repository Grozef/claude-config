---
name: polish-scene
description: |
  Passe d'edition sur une scene deja redigee : reecriture contre ANTI-TICS et les golden samples, puis liste des coupes. Passe 3 de /write-scene, utilisable seule.
  TRIGGER when: "polish-scene", "passe d'edition", "les dialogues sonnent faux", "ca fait ia"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Skill : polish-scene
# Invocation : /polish-scene [brouillon.md | arc/chapitre/perso]

**Cible :** $ARGUMENTS

> Ce skill RÉÉCRIT. C'est ce qui le distingue de `/review-scene` et `/review-chapter`,
> qui produisent un rapport en lecture seule.
> Il n'écrit jamais directement dans les fichiers de données du moteur.

---

## Étape 1 — Charger le crible

1. `~/.claude/creation-templates/ANTI-TICS.md` — le crible lui-même
2. `creation/BRIEF.md` — voix, ponctuation, palette emoji, format technique
3. `creation/GOLDEN.md` s'il existe — la plume validée par l'utilisateur. En cas de conflit
   entre une règle écrite et un golden sample, **le golden gagne** : le corpus prime sur la doc.

## Étape 2 — Résoudre la cible

- **Un brouillon `.md`** → travailler dessus directement.
- **Un chapitre déjà inséré** → ne PAS éditer le `.ts`. Faire l'aller-retour :
  1. `npx tsx tools/content-editor.ts export-md <arc> <chapter> <perso>` (ou la commande
     équivalente de la section Intégration du BRIEF)
  2. polir le `.md` exporté
  3. après validation seulement : `import-md` pour réappliquer
- **Rien de précisé** → demander la cible. Ne pas deviner.

## Étape 3 — Polir

Appliquer `ANTI-TICS.md` section par section :
- **A. conflit** — résolution trop rapide, morale énoncée, auto-analyse thérapeutique,
  acquiescement en série
- **B. rythme** — alternance mécanique, héros uniformément laconique, `"..."` en case vide
- **C. contenu** — bulle qui commente la précédente, règle du jeu énoncée au lieu d'être jouée,
  inventaire déguisé en sensoriel, redite sans progression, écho lexical

Puis les 5 tests de passage (attribution · morale · acquiescement · anti-padding · résistance).

**Contraintes dures pendant la réécriture :**
- Ne jamais changer un emoji, une majuscule ou une ponctuation existants sans le signaler :
  ce sont des choix d'auteur. Les corriger silencieusement est un rejet garanti.
- Ne pas raccourcir la scène sous sa cible de volume : polir n'est pas élaguer. Une bulle
  coupée pour cause de remplissage se remplace par une bulle qui porte quelque chose.
- Ne pas introduire de fait nouveau (objet, lieu, événement) : c'est une passe de forme,
  pas une réécriture d'intrigue. Un manque narratif se SIGNALE, il ne se comble pas d'initiative.
- Conserver IDs, timestamps et structure de branches à l'identique.

## Étape 4 — Restituer

1. Le texte révisé.
2. **La liste des coupes et réécritures majeures** — une puce par intervention, avec le code
   ANTI-TICS invoqué (`A1`, `B2`, `C4`…) et la raison en une ligne.
3. Ce qui a été laissé en l'état parce que ça relevait d'un choix d'auteur ou d'un manque
   narratif à trancher par l'utilisateur.

## Étape 5 — Appliquer, après validation seulement

`import-md` (ou la commande d'insertion du projet), puis le linter narratif s'il existe
(`npx tsx tools/lint-narrative.ts --changed`). Jamais d'application automatique.
