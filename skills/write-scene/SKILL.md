---
name: write-scene
description: |
  Genere une scene narrative (SFW ou NSFW) pour le projet litteraire courant, en 4 passes validees : cadrage (plan de beats), jet acte par acte, edition anti-tics, continuite. Charge PRINCIPES-ECRITURE + ANTI-TICS (referentiels globaux) + creation/BRIEF.md, valide les arbitrages avant de generer, insere via l'outillage decrit dans la section Integration du BRIEF.
  TRIGGER when: "ecris une scene", "genere la scene", "write-scene", "scene intime", "scene adulte", "scene NSFW", demande de contenu narratif pour un projet litteraire
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Skill : write-scene
# Invocation : /write-scene [cible] — [situation] — [objectif] — [longueur]

**Demande :** $ARGUMENTS

> **Une scène s'écrit en 4 passes, jamais d'un jet.** Un jet unique produit une scène
> plate et incomplète : c'est la cause dominante des rejets. Deux passes exigent une
> validation explicite de l'utilisateur (fin de PASSE 1, fin de PASSE 3) — ne jamais
> les enchaîner sans réponse.

---

## PASSE 0 — Charger le contexte (obligatoire, dans cet ordre)

1. `~/.claude/creation-templates/PRINCIPES-ECRITURE.md` (référentiel transverse)
2. `~/.claude/creation-templates/ANTI-TICS.md` (ce qui fait sonner faux un dialogue)
3. `creation/BRIEF.md` — s'il est absent : proposer `/init-creation` et s'arrêter.
4. `creation/GOLDEN.md` s'il existe — les extraits de référence du projet. Ils priment sur
   toute idée qu'on se fait du style : c'est la plume validée par l'utilisateur.
5. `creation/SESSION-WRITING.md` (si présent)
6. **Si la scène est intime/adulte** (demandée explicitement OU impliquée par la situation) :
   `creation/NSFW.md` obligatoire — s'il est absent, s'arrêter et le signaler.
7. `creation/CONTINUITE.md` ou un guide de `creation/optionnels/` : uniquement si le BRIEF
   ne couvre pas un élément nécessaire à CETTE scène. Jamais tout charger d'un coup.

Rappel PRINCIPES §1 : une section de BRIEF encore "[à remplir]" ne fait pas foi — s'appuyer
sur le corpus réel, pas sur un template vide.

**Lire le contexte cible réel (jamais hors-sol).** La section **Intégration** du BRIEF donne
la commande d'inspection et l'arborescence du projet.
- Moteur (VN/chat scripté) : exécuter la commande list sur le chapitre/thread cible —
  ton local, dernier nœud, IDs existants. Ne pas lire le fichier de données entier.
- Prose : lire le passage précédent/suivant l'insertion.
- Vérifier le DISPOSITIF de la scène : présentiel vs distance, qui est où, quel canal.
- Assets : ne référencer que des chemins existants au catalogue du projet.
- Si le projet a une CHRONOLOGIE : vérifier quel jour absolu porte la scène, et quels
  motifs récurrents sont en cours (une photo promise « chaque matin » doit être tenue ici aussi).

---

## PASSE 1 — CADRAGE (architecte) · **STOP validation**

Ne rédige aucun dialogue. Produis un **plan de beats**, 4 à 8 temps forts. Pour chacun :

| champ | contenu |
|---|---|
| action | ce qui se passe concrètement, et où |
| sous-texte | ce que les personnages ne disent pas |
| rapport de force | qui mène au début du beat, qui mène à la fin — **il doit bouger** |
| budget | nombre de bulles visé pour ce beat |
| entrée | timestamp d'ouverture du beat |
| média | asset attendu, ou « aucun » |

Calibrer le volume total depuis la section Intégration (cadence, plancher NSFW) AVANT d'écrire.
La somme des budgets de beats DOIT atteindre la cible : c'est ici que la longueur se dessine,
pas au moment de rédiger.

Grouper en UN message les questions sur tout arbitrage non spécifié : lieux, objets,
dialogues clés, choix narratifs, ambiance.

**Si scène NSFW, vérifications supplémentaires (validation doublement obligatoire) :**
- L'intensité demandée est-elle autorisée pour cet arc (courbe NSFW.md) ?
  Si dépassement : signaler en une ligne et demander confirmation.
- Les éléments demandés sont-ils au catalogue pour cet arc ?
- Le consentement est-il narrativisable dans la situation (safeword/opt-in/recheck/aftercare) ?
- Structure imposée (proportions à adapter à la longueur) :
  ```
  1. MISE EN PLACE    (15-20%)  contexte, tension, déclencheur — pas encore explicite
  2. MONTÉE           (20-25%)  premiers gestes/textos, hésitations, banter
  3. PREMIER PIC      (10-15%)  première révélation/réaction forte
  4. DÉVELOPPEMENT    (25-30%)  montée progressive, cycles, rythme varié
  5. PIC PRINCIPAL    (15-20%)  moment le plus intense — ne pas précipiter
  6. APRÈS            (10-15%)  redescente : humour, tendresse, aftercare
  ```

**Présenter le plan et attendre la validation.** Ne pas rédiger avant la réponse.

---

## PASSE 2 — JET (romancier)

Rédiger **un beat à la fois**, pas la scène entière d'un coup : c'est ce qui produit les fins
bâclées et les actes qui s'étiolent. Après chaque beat, comparer le compte de bulles au budget
de la PASSE 1 et corriger le tir sur le beat suivant.

Respecter : voix du BRIEF (patterns/emojis/ponctuation), GOLDEN s'il existe, canon
(BRIEF + SESSION-WRITING), format technique exact du projet, IDs uniques dans la convention.

Leviers de longueur et cadre consentement : PRINCIPES §3 et §5. La longueur se DESSINE
(contrainte diégétique, cycles, Q&A, paliers média), elle ne se remplit pas.

Le jet va dans un fichier de brouillon (convention du projet, ex. `a-revoir/<nom>.md`),
jamais directement dans les données du moteur.

---

## PASSE 3 — ÉDITION (éditeur impitoyable) · **STOP validation**

Passe destructive sur le brouillon. Elle RÉÉCRIT — c'est ce qui la distingue de
`/review-scene`, qui ne produit qu'un rapport.

Appliquer `ANTI-TICS.md` section par section, puis ses 5 tests de passage :
1. test d'attribution (bulle attribuable à un seul personnage)
2. test de la morale (couper la bulle qui résume le chapitre)
3. test d'acquiescement (répliques du héros qui ne font qu'accepter)
4. test anti-padding (retirer une bulle par bloc de dix)
5. test de résistance (le conflit tient-il après la première concession)

Puis la checklist technique :
- [ ] Dispositif respecté (présentiel/distance) ; plausibilité physique
- [ ] Timestamps strictement croissants ; IDs uniques ; format technique valide
- [ ] Aucun choix narratif non validé ; aucune contradiction avec le canon
- [ ] Volume ≈ cible calibrée en PASSE 1
- [ ] Motifs récurrents en cours honorés (média promis à un rythme)
- [ ] Si NSFW : intensité conforme à la courbe · éléments au catalogue · consentement montré ·
      structure 6 phases respectée

**Présenter le texte révisé PUIS la liste des coupes majeures** (une puce par coupe, avec la
raison). Attendre la validation. **Jamais d'insertion automatique.**

---

## PASSE 4 — CONTINUITÉ (script-doctor)

1. Insérer via la commande d'insertion de la section Intégration du BRIEF
   (content-editor / replace JSON / Edit direct si prose et autorisé). En masse : fichier
   JSON de draft + commande replace, pas d'inserts CLI inline.
2. Vérifier l'insertion (commande list / relecture).
3. **Lancer le linter narratif du projet s'il existe** (ex. `npx tsx tools/lint-narrative.ts --changed`).
   Corriger les erreurs avant de conclure — ne pas les laisser au gate Stop.
4. Produire un **mémo de continuité** : état psychologique et physique de chaque personnage
   en fin de scène · faits, objets et informations nouvellement établis · tension laissée
   en suspens pour la scène suivante.
5. Mettre à jour `creation/SESSION-WRITING.md` : chapitre en cours, dernier nœud inséré,
   beat émotionnel, prochaine étape, faits établis.
6. Rappeler : `/update-canon` pour persister les faits dans CONTINUITE.md,
   `/update-brief` si des patterns durables ont émergé.
