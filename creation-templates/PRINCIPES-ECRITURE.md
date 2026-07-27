# PRINCIPES D'ECRITURE — référentiel global

> Leçons validées par l'usage sur des projets réels (consolidé 2026-07-07 depuis meta/ et les mémoires projets).
> Chargé par /write-scene et /review-scene. Vaut pour TOUT projet littéraire, quel que soit le moteur.
> Ce fichier est transverse ; les règles propres à un projet vivent dans son `creation/BRIEF.md`.

---

## 1. Avant d'écrire — jamais hors-sol

Cause racine n°1 des scènes rejetées : générer sans avoir lu le cadre réel.

1. Lire `creation/BRIEF.md` (voix + format technique + canon récent + règles absolues).
2. Lire le CONTEXTE CIBLE réel : le chapitre/thread où la scène s'insère (commande list du
   content-editor, ou le corpus environnant en prose). Le ton local prime sur l'idée qu'on
   se fait de la scène (une scène de domination froide dans un chapitre tendre = rejet).
3. Vérifier le DISPOSITIF : présentiel vs distance (sexting/appel), qui est où, quel canal.
   Un ordre de présentiel dans un échange à 400 km = faute structurelle.
4. Ne jamais lire un guide-template vide en croyant lire des règles. Si un fichier contient
   "[à remplir]", il ne fait pas foi — le BRIEF et le corpus font foi.

## 2. Cadrer avant de générer (frame-before-generating)

- Les arbitrages se valident AVANT la génération, par questions groupées en un seul message :
  noms, lieux, objets, dialogues clés, choix narratifs, niveau d'explicite.
- Jamais d'initiative sur un détail non spécifié ; jamais de chemin d'asset inventé
  (vérifier le catalogue d'assets du projet).
- Pour le NSFW : validation doublement obligatoire (intensité, éléments, dispositif).
- Une règle qu'on vient d'écrire s'applique immédiatement — pas "à étoffer plus tard".

## 3. Volume — calibrer avant, dessiner ensuite

- Estimer la longueur cible AVANT d'écrire, à partir de la cadence du moteur
  (référence chat scripté : ~2,5-3 s/bulle, donc 10 min ≈ 200-250 bulles).
- Scène NSFW majeure : plancher DUR ~500 bulles ±20 % (400-600), sauf dérogation explicite
  actée par l'utilisateur. Un tease court ne se livre jamais tel quel.
- La longueur se DESSINE, elle ne se remplit pas. Leviers validés :
  - contrainte diégétique qui s'en mêle (réunion, client, presque-grillé) — densifie sans remplir ;
  - cycles (edging, vagues de confidence) : 2-3 minimum, chaque cycle laisse une question ouverte ;
  - Q&A mutuel qui fait mariner les deux personnages ;
  - médias échelonnés en paliers d'intensité ;
  - branches de choix qui divergent puis convergent ;
  - diffusion multi-surfaces / multi-scènes d'un arc — jamais un thread isolé étiré.
- Test anti-padding : retirer une bulle ; si rien ne se perd (info, voix, tension, choix),
  c'était du remplissage.

## 4. Voix

- Un dialogue attribuable à deux personnages est mal écrit.
- La voix (patterns, ponctuation, palette emoji) est définie dans le BRIEF du projet et
  PRIME TOUJOURS, y compris en NSFW.
- La palette emoji peut se durcir par arc ; un arc peut acter une dérogation explicite —
  le registre émotionnel de l'arc prime alors sur le canon global.
- Ne jamais modifier/supprimer un emoji déjà présent dans le corpus : choix auteur.
- Phrasé crédible pour le personnage (anatomie, genre, registre) ; pas de formule générique
  plaquée.
- Show don't tell ; mot juste plutôt que générique ; éviter l'excès d'adverbes en -ment et
  les verbes pauvres (faire, avoir, être, mettre) quand un verbe précis existe.

## 5. NSFW — cadre non négociable

- Consentement MONTRÉ à l'écran : safeword posé d'entrée, opt-in actif, consentement
  re-vérifié aux paliers, aftercare, mutualité. La résistance joueuse n'est PAS le safeword.
- Meneur/mené : conforme au canon du projet (NSFW.md) ; domination toujours consentie.
- Cru assumé OK, jamais clinique ni sexiste. Pas de trope dégradant non négocié
  (secrétaire/patron, infirmière...) sauf fantasme explicitement partagé par les persos.
- Une consigne de ton type "pas le porno" = la scène reste accrochée à l'enjeu narratif,
  PAS un plafond de contenu. Vérifier l'échelle d'intensité du projet avant d'auto-censurer.
- Montée progressive : ~50 % de la longueur avant l'explicite, jamais le pic d'emblée.
- Plausibilité physique stricte (positions, mains occupées, téléphone tenu...).

## 6. Pipeline d'écriture en 5 passes (scènes/arcs à volume)

1. TRAME — enjeux, arcs, fins.
2. CARTOGRAPHIE — tableau scènes x surface/canal x triggers in/out ; budget de bulles par scène.
3. SQUELETTE — nœuds nus (intentions de bulle, pas le texte final) ; valider les points
   narratifs ouverts ICI.
4. CŒUR — la ou les scènes fortes (NSFW ou pivot émotionnel).
5. MEUBLAGE — voix, tics, emojis, interludes, callbacks. Étoffer = étaler sur l'arc,
   pas allonger un thread isolé.

Les passes 3-4-5 génèrent du dialogue : tous les choix narratifs ouverts doivent être
validés avant de les lancer.

## 7. Authoring technique

- Jamais d'Edit direct sur les fichiers de données narratives d'un moteur : toujours l'outil
  du projet (content-editor / serializer — commande exacte dans la section Intégration du BRIEF).
- Insertion en masse : écrire les nœuds dans un fichier JSON de draft puis commande replace
  (les apostrophes françaises cassent les inserts CLI inline).
- IDs uniques, convention du projet ; timestamps strictement croissants ; les flags voyagent
  sur les choix du héros, pas sur les nœuds npc (vérifier le moteur du projet).
- Vérification de livraison : list de la structure + build/refs qui passent + compte de
  bulles ≈ cible + test voix (§4).

## 8. Génération assistée (image, LLM local)

- Le médium n'est pas déterministe : n'ancrer que des traits robustes (cheveux, yeux, peau,
  morphologie) ; mettre en négatif ce qui ne doit pas apparaître au hasard ; garde-fous
  structurels du négatif jamais retirés (blurry, text, logo, jpeg artifacts) ; seed par perso.
- Un détail "identitaire" faiblement contrôlable = une variable aléatoire de plus, pas une ancre.
- Sortie d'un petit LLM local (3B fine-tuné) = amorce (structure + voix), jamais prose finie.
  L'intime s'écrit à la main.

## 9. Après écriture

- /update-canon : reporter les nouveaux faits dans CONTINUITE.md (rien supprimer ;
  contradiction notée ~~ancien~~ -> nouveau).
- /update-brief : re-condenser le BRIEF si la session a établi des patterns ou faits durables.
- Mettre à jour SESSION-WRITING.md (dernier nœud, beat émotionnel, prochaine étape).
