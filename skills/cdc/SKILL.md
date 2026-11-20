---
name: cdc
description: |
  Genere un cahier des charges sur le modele unique Modele_CDC.docx (17 sections + annexe A par fonctionnalite), vierge ou rempli selon l'etat du projet (retro depuis un repo, avant-projet depuis un brief, hybride). Sortie .md + .docx (styles du modele) + .html + .pdf, diagrammes ; --type fill = squelette vierge. Sous-commandes : generate (defaut), diagram (BDD, diagramme de classes UML..., aussi hors CDC), verify (verifier et corriger un CDC), tests (plan de tests + tests reels tires du CDC).
  TRIGGER when: "cahier des charges", "genere le CDC", "/cdc", "redige les specs", "verifie le CDC", "corrige le cahier des charges", "tests depuis le CDC", "diagramme de classes", "class diagram", "UML"
allowed-tools: Read, Write, Glob, Grep, Bash
---

# Skill : cdc
# Invocation : /cdc [generate] [--type auto|cdc|fill] [--no-html] [--no-pdf] [--no-docx] [--no-diagrams] [chemin source | description du projet]
#              /cdc diagram <type> <cdc.md> [cible]   |   /cdc diagram <type> <chemin du code>  (hors CDC)
#              /cdc verify <cdc.md> [--report-only]
#              /cdc tests <cdc.md> --repo <chemin> [--stack pest,phpunit,vitest,playwright,k6] [--plan-only]

**Argument :** $ARGUMENTS

Modèle unique depuis le 2026-10-16 (décision utilisateur : uniformiser les CDC de tous les projets), remplacé le 2026-11-19 par le CDC v0.2 d'un projet réel (plan, colonnes et styles ; annexe A et matrice RACI 5.1 gardées de l'ancien modèle) : `templates/Modele_CDC.docx` (original, en-tête ramené à « [Nom du projet] »), calqué en `trames/trame-modele.md` ; `templates/reference-cdc.docx` en est la reference-doc pandoc. Les anciennes trames `public|tech|full|cdcf` sont retirées. Mise à jour du modèle : section finale.

Outils (tous via `bash ~/.claude/tools/cdc.sh <commande>`) : `state`, `inventory`, `scaffold`, `fiches`, `check`, `manifest`, `draw`, `testplan`, `testcov`, `dbtests`, `lint`, `render`, `docx2pdf`. Le déterministe passe par eux, jamais à la main. Moteur des diagrammes hors base : `diagram/` (lib, types, tests : `node --test diagram/tests/*.test.mjs` et `python -m pytest diagram/tests`).

## Garde-fous (non négociables)

1. **docx sur le modèle.** Le .docx sort par défaut de `cdc.sh render` (reference-doc du modèle : styles, en-tête au titre du YAML, pied « Page X / Y », largeurs de colonnes). Constater le rendu avant livraison : `cdc.sh docx2pdf <f.docx>` (Word sous Windows, LibreOffice ailleurs), `pdftoppm`, puis regarder les images (cf. feedback-cdc-approach).
2. **Zéro exigence inventée.** Chaque ligne trace vers une source réelle (code lu, doc fournie, réponse utilisateur). Toute info non dérivable -> `[À COMPLÉTER]` ou question. Le contrôle est la contre-lecture (Étape 3ter, obligatoire) : elle rouvre chaque source, qui n'est PAS citée dans le CDC (remis au client, qui ne peut pas les vérifier : décision du 2026-10-21 ; le lint bloque les chemins de fichiers et les `Classe::méthode` restés dans le texte, la contre-lecture le reste). Raison : 2026-10-16, CDC d'un projet livré avec 20 erreurs (RACI inventée, droits faux, formes d'API de tête), vues seulement à la relecture demandée.
3. **La doc D'ABORD — interdiction de remplir sur des résumés.** Avant d'écrire une ligne, l'inventaire de l'Étape 2.0 est OBLIGATOIRE pour CHAQUE source. Remplir à partir des seuls `CONTEXT.md` / `README` / survol de code = supposition interdite (incident 2026-06-23 : demi-session perdue). Le code ne fait que compléter la doc.
4. **Un CDC = des EXIGENCES, pas un audit.** Jamais de dette technique, findings d'audit, vulnérabilités, bugs connus ni limitations du code existant, même en rétro, même si la doc les contient. La sécurité s'exprime en exigences (auth, RGPD). Le lint bloque ce vocabulaire ; un faux positif se justifie par `<!-- lint-ok -->` en fin de ligne.
5. **CDC généré hors git, sauf s'il est déjà versionné.** `cdc.sh` ajoute `<out>.md/.html/.docx/.pdf` et `<stem>-diagrams/` au `.gitignore` du repo englobant, et le dit (« .gitignore MODIFIÉ ») : le signaler à l'utilisateur. Un CDC déjà suivi par git (choix du projet, ex. un projet) n'est pas touché.

## Sous-commandes (lire le fichier du mode AVANT d'agir)

Le premier mot de `$ARGUMENTS` choisit le mode ; absent ou inconnu -> `generate` (tout `$ARGUMENTS` lui est passe).

| Mode | Fichier | Role |
|---|---|---|
| `generate` (defaut) | `modes/generate.md` | Produire un CDC : `--type auto` (defaut) choisit selon l'etat du projet (`cdc.sh state`), `cdc` rempli, `fill` vierge |
| `diagram` | `modes/diagram.md` | Produire un diagramme et l'inserer dans un CDC existant (aussi appele par `generate`, Etape 3bis), ou seul hors CDC (diagramme de classes d'un projet) |
| `verify` | `modes/verify.md` | Verifier un CDC existant (`cdc.sh check` + contre-lecture) et le corriger, ou `--report-only` |
| `tests` | `modes/tests.md` | Plan de tests trace dans le CDC (A.9, 12), puis tests reels dans le repo (BDD deterministes depuis le schema, API, composants, E2E, performance), executes une fois |

## Mettre à jour le modèle

Quand `Modele_CDC.docx` change (le comparer par `sha256sum` à l'original de l'utilisateur) :
1. Copier le nouveau modèle dans `templates/Modele_CDC.docx`.
2. `python3 templates/build-reference.py templates/Modele_CDC.docx templates/reference-cdc.docx` (styles dédoublonnés, style de tableau, Title / Subtitle et Consigne tirés de la mise en forme directe du modèle).
3. Reporter les changements de plan dans `trames/trame-modele.md` (mêmes niveaux de titres, consignes en `[*…*]{custom-style="Consigne"}`), puis `python3 templates/apply-widths.py templates/Modele_CDC.docx trames/trame-modele.md` (largeurs des tableaux reconnus par leur en-tête ; un tableau sans correspondance est listé et garde ses largeurs, ex. ceux de l'annexe A absents du nouveau modèle).
4. Contrôler : `cdc.sh scaffold --type fill --docx`, `cdc.sh docx2pdf`, et comparer les images au modèle exporté de la même façon.
