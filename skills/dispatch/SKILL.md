---
name: dispatch
description: |
  Execute un plan APPROUVE en le decoupant en lots confies a des sous-agents de modele adapte (Haiku mecanique, Sonnet code), verifies et reassignes par le modele de session. Invocation manuelle uniquement : /dispatch [chemin du plan].
argument-hint: [chemin du plan]
disable-model-invocation: true
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Agent
---

# Skill : dispatch — routage des lots d'un plan par modele

**Plan :** $ARGUMENTS (vide -> le plan approuve de la conversation, sinon le plus recent de `~/.claude/plans/`)

Tu es l'ORCHESTRATEUR : tu decoupes, tu brieves, tu verifies sur artefacts, tu reassignes. Le gain vient du contexte neuf et court des executants : ne fais pas toi-meme ce qu'un lot delegue couvre, et ne delegue pas ce qui te coute moins cher a faire.

Le rapport d'un executant est un resume, pas une source : rien n'est tenu pour fait tant que TU n'as pas relance la commande d'acceptation et lu le diff.

## 0. Eligibilite

Deleguer seulement si le plan donne au moins 3 lots delegables et independants. Un lot delegable t'epargne au moins ~5 appels d'outils. Sinon : le dire en une ligne et executer le plan directement.

## 1. Decoupage

Afficher ce tableau, puis continuer sans attendre :

| id | objectif | fichiers (exclusifs) | cat. | modele | depend de | acceptation (commande -> resultat attendu) | risque |

Grille :

| Cat. | Agent | Pour | Critere |
|---|---|---|---|
| M mecanique | `exec-simple` (Haiku) | le brief contient le code ou le texte exact a ecrire (patch ligne a ligne), ou correction mecanique dans UN fichier (renommage, constante, cle de config) | transcription + verif triviale, zero decision |
| C code | `exec-code` (Sonnet) | tout lot decrit en prose : implementation bornee, tests, refactor local, boilerplate, docblocks, doc | spec claire, aucun choix d'architecture |
| R raisonnement | toi, directement | architecture, debug a cause inconnue, lot couple au contexte de session, lot de moins de 5 appels | non delegue |
| RISQUE (drapeau) | + `relecteur` | securite, auth, migration, donnees, suppression | s'ajoute a M, C ou R |

Dans le doute entre M et C : C. Le modele le moins cher prend plus de tours sur un travail en plusieurs etapes, et c'est le nombre de tours qui coute.

Regrouper : plusieurs petites modifications de MEME forme (la meme correction d'une ligne, la meme constante, le meme champ, repetes sur N fichiers) font UN lot, avec la liste fichier -> changement dans le brief et un seul diff a verifier. Un lot par tache seulement quand la tache demande son propre jugement, ses propres tests ou sa propre verification.

Jamais delegue : push, PR, deploiement, suppression irreversible, question a l'utilisateur, capture `meta/`, projet litteraire (`creation/`).

## 2. Verif 1 — le decoupage, avant tout lancement

- chaque item du plan est couvert par un lot, et aucun lot n'ajoute au plan ;
- deux lots lances en parallele n'ont aucun fichier en commun ;
- chaque lot a une commande d'acceptation EXECUTABLE et un resultat attendu ;
- un lot qui demande une decision est en R.

## 3. Brief — un par lot, autoportant

L'executant ne voit ni la conversation ni le plan. Le brief contient :
- objectif en une phrase et fichiers autorises (chemins absolus) ;
- decisions deja actees qui le concernent ;
- pieges connus ;
- forme des donnees consommees, CITEE depuis le code qui les produit (extrait avec `fichier:ligne`, pas un nom de champ) ;
- commande d'acceptation et resultat attendu.

Le format du rapport est dans la definition de l'agent : ne pas le recopier.

## 4. Execution

Outil Agent, `subagent_type` = `exec-simple` ou `exec-code`. Sequentiel selon les dependances ; parallele seulement sur fichiers disjoints, 3 lots au plus a la fois.

## 5. Verif 2 — chaque lot, sur artefacts

1. Scope : `git status --short` et `git diff --stat` -> seuls les fichiers autorises ont bouge.
2. Lecture du diff du lot.
3. Commande d'acceptation RELANCEE par toi ; lire le nombre de tests (0 test execute = echec).

## 6. Echec -> reassignation

- `BLOQUE: ...` : completer le brief et relancer le meme agent. Ce n'est pas un echec du palier.
- 1er echec : reprendre le MEME agent (SendMessage) avec l'ecart precis : attendu, observe, sortie de la commande.
- 2e echec : palier superieur (`exec-simple` -> `exec-code` -> toi).
- Noter chaque echec : lot, categorie, palier, cause (brief incomplet, categorie sous-estimee, erreur de l'executant).

## 7. Verif 3 — lots a risque seulement

Lancer `relecteur` avec : objectif du lot, criteres d'acceptation, commande qui affiche le diff. Trier ses constats par GRAVITE, pas en nombre : un relecteur a qui l'on demande des failles en rapporte presque toujours. BLOQUANT ou MAJEUR confirme a la lecture du code -> correction (section 6), puis verif 2.

## 8. Verif 4 — integration

- suite de tests complete du projet, nombre de tests lu ;
- chemin reel de la fonctionnalite, selon la surface de `~/.claude/verification-protocol.md` ;
- relecture du diff COMPLET : coherence entre lots, doublons, orphelins, securite, style du code voisin.

## 9. Rapport

Le resultat d'abord (ce qui marche, ce qui ne marche pas, avec l'artefact). Puis :

| lot | agent | tentatives | verdict | artefact |

Puis les echecs notes en section 6, et les `[NO-VERIFY: ...]` restants.
