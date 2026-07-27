---
name: write-scene
description: |
  Genere une scene narrative (SFW ou NSFW) pour le projet litteraire courant. Charge PRINCIPES-ECRITURE (referentiel global) + creation/BRIEF.md, valide les arbitrages avant de generer, insere via l'outillage decrit dans la section Integration du BRIEF.
  TRIGGER when: "ecris une scene", "genere la scene", "write-scene", "scene intime", "scene adulte", "scene NSFW", demande de contenu narratif pour un projet litteraire
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Skill : write-scene
# Invocation : /write-scene [cible] — [situation] — [objectif] — [longueur]

**Demande :** $ARGUMENTS

## Étape 1 — Charger le contexte (obligatoire, dans cet ordre)

1. `~/.claude/creation-templates/PRINCIPES-ECRITURE.md` (référentiel transverse)
2. `creation/BRIEF.md` — s'il est absent : proposer `/init-creation` et s'arrêter.
3. `creation/SESSION-WRITING.md` (si présent)
4. **Si la scène est intime/adulte** (demandée explicitement OU impliquée par la situation) :
   `creation/NSFW.md` obligatoire — s'il est absent, s'arrêter et le signaler.
5. `creation/CONTINUITE.md` ou un guide de `creation/optionnels/` : uniquement si le BRIEF
   ne couvre pas un élément nécessaire à CETTE scène. Jamais tout charger d'un coup.

Rappel PRINCIPES §1 : une section de BRIEF encore "[à remplir]" ne fait pas foi — s'appuyer
sur le corpus réel, pas sur un template vide.

## Étape 2 — Lire le contexte cible réel (jamais hors-sol)

La section **Intégration** du BRIEF donne la commande d'inspection et l'arborescence du projet.
- Moteur (VN/chat scripté) : exécuter la commande list sur le chapitre/thread cible —
  ton local, dernier nœud, IDs existants. Ne pas lire le fichier de données entier.
- Prose : lire le passage précédent/suivant l'insertion.
- Vérifier le DISPOSITIF de la scène : présentiel vs distance, qui est où, quel canal.
- Assets : ne référencer que des chemins existants au catalogue du projet.

## Étape 3 — Cadrer AVANT de générer (frame-before-generating)

Calibrer le volume cible depuis la section Intégration (cadence, plancher NSFW) AVANT d'écrire.

Grouper en UN message les questions sur tout arbitrage non spécifié : lieux, objets,
dialogues clés, choix narratifs, ambiance. Ne pas générer avant les réponses.

**Si scène NSFW, vérifications supplémentaires (validation doublement obligatoire) :**
- L'intensité demandée est-elle autorisée pour cet arc (courbe NSFW.md) ?
  Si dépassement : signaler en une ligne et demander confirmation.
- Les éléments demandés sont-ils au catalogue pour cet arc ?
- Le consentement est-il narrativisable dans la situation (safeword/opt-in/recheck/aftercare) ?

## Étape 4 — Générer

Respecter : voix du BRIEF (patterns/emojis/ponctuation), canon (BRIEF + SESSION-WRITING),
format technique exact du projet, IDs uniques dans la convention, volume cible.

**Structure imposée si NSFW** (proportions à adapter à la longueur) :
```
1. MISE EN PLACE    (15-20%)  contexte, tension, déclencheur — pas encore explicite
2. MONTÉE           (20-25%)  premiers gestes/textos, hésitations, banter
3. PREMIER PIC      (10-15%)  première révélation/réaction forte
4. DÉVELOPPEMENT    (25-30%)  montée progressive, cycles, rythme varié
5. PIC PRINCIPAL    (15-20%)  moment le plus intense — ne pas précipiter
6. APRÈS            (10-15%)  redescente : humour, tendresse, aftercare
```
Leviers de longueur et cadre consentement : PRINCIPES §3 et §5.

## Étape 5 — Checklist avant présentation

- [ ] Voix correcte et différenciée pour chaque personnage (test : bulle attribuable à un seul)
- [ ] Dispositif respecté (présentiel/distance) ; plausibilité physique
- [ ] Timestamps strictement croissants ; IDs uniques ; format technique valide
- [ ] Aucun choix narratif non validé ; aucune contradiction avec le canon
- [ ] Volume ≈ cible calibrée (NSFW : plancher du BRIEF, défaut ~500 bulles ±20 %)
- [ ] Si NSFW : intensité conforme à la courbe · éléments au catalogue · consentement montré ·
      structure 6 phases respectée

## Étape 6 — Présenter, VALIDER, puis insérer

1. Présenter la scène (ou un échantillon + plan si très longue) et les points saillants.
2. Attendre la validation de l'utilisateur. **Jamais d'insertion automatique.**
3. Après accord, insérer via la commande d'insertion de la section Intégration du BRIEF
   (content-editor / replace JSON / Edit direct si prose et autorisé). En masse : fichier
   JSON de draft + commande replace, pas d'inserts CLI inline.
4. Vérifier l'insertion (commande list / relecture) et présenter le résultat.

## Étape 7 — Clôturer

- Mettre à jour `creation/SESSION-WRITING.md` : chapitre en cours, dernier nœud inséré,
  beat émotionnel, prochaine étape, faits établis dans cette scène.
- Rappeler : `/update-canon` pour persister les faits dans CONTINUITE.md,
  `/update-brief` si des patterns durables ont émergé.
