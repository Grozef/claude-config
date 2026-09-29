---
name: checkpoint
description: |
  Sauvegarde l'état actuel de la session dans SESSION.md. Met à jour : état actuel, dernière action, prochaine étape, fichiers modifiés, décisions prises.
  TRIGGER when: "checkpoint", "sauvegarde", "save la session", fin de session
allowed-tools: Read, Edit, Bash, Grep
effort: low
---

# Skill : checkpoint — `/checkpoint [résumé]`

**Contexte fourni :** $ARGUMENTS
Cible : `docs/documentation_claude/SESSION.md`, sinon `documentation_claude/SESSION.md`, sinon `SESSION.md`.

1. **Lire** la cible : état précédent.
2. **Relever** : `git -C <repo> status --short` pour CHAQUE repo trouvé (`find . -maxdepth 3 -name .git -type d`), sous son nom — jamais un seul diff au CWD (incident 2026-07-05) ; décisions ; problèmes ouverts ou clos ; prochaine étape CONVENUE VERBALEMENT (un plan discuté mais non codé DOIT y figurer).
3. **Écrire** : "État actuel" = l'AXE ACTIF de la session, jamais le dernier micro-item livré (incident 2026-07-05 : en-tête périmé hérité tel quel par la session suivante) ; dernière action ; prochaine étape ; fichiers modifiés ; entrée d'historique `### YYYY-MM-DD HH:MM` + puces + `→ Prochain :`, 5 lignes max. HÉRITAGE : toute ligne reprise de l'ancien SESSION.md qui n'a pas été touchée pendant la session ("À trancher", "Problèmes en suspens", "Prochaine étape", numéros de ligne TODO) est confrontée à sa source (item TODO, note citée, `git log`) AVANT d'être recopiée ; si elle est close, on la retire, et si elle ne peut pas être vérifiée, on la retire ou on la marque `(non revérifié)` (incidents 2026-07-05, 2026-08-29, 2026-09-17). Supprimer la ligne `Compteur de réponses` si la cible en porte une (plus alimentée depuis le 2026-09-13 : chiffre figé = donnée fausse).
4. **Élaguer** : garder les 3 derniers checkpoints. Si le fichier dépasse 50 lignes : "Fichiers ouverts" à 3 entrées, "Problèmes en suspens" à 2.
5. **Vault** (sauter 5 et 6 si `$CLAUDE_VAULT` n'est pas défini) : écrire `$CLAUDE_VAULT/sessions/<basename CWD>/YYYY-MM-DD.md` — titre `# <projet> — YYYY-MM-DD`, puis en ligne 2 `Projet : [[projets/<fiche>/<fiche>|<fiche>]]`, puis État / Dernière action / Prochaine étape / Fichiers modifiés / Décisions. `<fiche>` = le projet dont le chemin correspond au repo courant dans `## Projets (index + chemins)` de TODO.md (`Grep` sur le chemin), PAS le basename du CWD (ex. `www/Inspection` -> `labInspection2`) ; lien par chemin car `[[pmu]]` et `[[labInspection]]` existent aussi dans `meta/concepts/`. Session dans le vault lui-même : `Projet : [[meta/concepts/obsidian|obsidian]]`. Si `projets/<fiche>/<fiche>.md` n'existe pas : le signaler et demander (créer une fiche minimale ?), ne pas inventer de lien (incident 2026-09-28 : 121/149 sessions sans lien vers leur fiche).
   - Fixes de revue : si des fixes listés dans un `revue/fixes-*.md` ont été appliqués pendant la session, passer leurs lignes à `fait` + hash du commit (si ce n'est pas déjà fait). Pour chaque `revue/fixes-*.md` modifié (`git status`), recompter `fait` / total (`grep -c '| fait |'` pour les faits, `grep -c -E '^\| [A-Z]+-[0-9]+ \|'` pour le total, sans l'en-tete) et mettre à jour `N/M faits (YYYY-MM-DD)` sur sa ligne dans `## Revues` de la fiche. Aucune ligne `## Revues` pour ce recap : la créer au format du skill `review` (section Tracage).
6. **toDo** `$CLAUDE_VAULT/TODO.md` : NE JAMAIS le lire en entier (multi-projets ; coût dominant du checkpoint, constaté 2026-08-17). `Grep ^## ` pour borner la section projet, puis `Read` avec offset/limit sur ce seul intervalle.
   - Pousser la prochaine étape et chaque engagement verbal non livré, si aucun item non coché équivalent n'existe (comparer par mots-clés) : `- [ ] [op] (YYYY-MM-DD) <texte> [[projet]]`, **3 lignes max** — le détail va dans SESSION.md ou `meta/`.
   - Cocher `- [x]` les items `[[projet]]` livrés dans la session. Edit ciblé, jamais de réécriture du fichier.
7. **Confirmer** en une ligne : `Checkpoint sauvegardé — <résumé 10 mots> | toDo : +N poussé(s), M coché(s)` (omettre la partie toDo si rien n'a bougé).
