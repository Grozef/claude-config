---
name: checkpoint
description: |
  Sauvegarde l'état actuel de la session dans SESSION.md. Met à jour : état actuel, dernière action, prochaine étape, fichiers modifiés, décisions prises. Incrémente le compteur de réponses.
  TRIGGER when: "checkpoint", "sauvegarde", "save la session", toutes les 10 réponses (auto), fin de session
allowed-tools: Read, Edit, Bash, Grep
model: claude-haiku-4-5-20251001
---

# Skill : checkpoint — `/checkpoint [résumé]`

**Contexte fourni :** $ARGUMENTS
Cible : `docs/documentation_claude/SESSION.md`, sinon `documentation_claude/SESSION.md`, sinon `SESSION.md`.

1. **Lire** la cible : état précédent + compteur.
2. **Relever** : `git -C <repo> status --short` pour CHAQUE repo trouvé (`find . -maxdepth 3 -name .git -type d`), sous son nom — jamais un seul diff au CWD (incident 2026-07-05) ; décisions ; problèmes ouverts ou clos ; prochaine étape CONVENUE VERBALEMENT (un plan discuté mais non codé DOIT y figurer).
3. **Écrire** : compteur +1 ; "État actuel" = l'AXE ACTIF de la session, jamais le dernier micro-item livré (incident 2026-07-05 : en-tête périmé hérité tel quel par la session suivante) ; dernière action ; prochaine étape ; fichiers modifiés ; entrée d'historique `### YYYY-MM-DD HH:MM` + puces + `→ Prochain :`, 5 lignes max.
4. **Élaguer** : garder les 3 derniers checkpoints. Si le fichier dépasse 50 lignes : "Fichiers ouverts" à 3 entrées, "Problèmes en suspens" à 2.
5. Si le contexte lu dans la session dépasse ~50k tokens estimés : afficher `Contexte lourd (~Xk) — envisage /compact`.
6. **Vault** (sauter 6 et 7 si `$CLAUDE_VAULT` n'est pas défini) : écrire `$CLAUDE_VAULT/sessions/<basename CWD>/YYYY-MM-DD.md` — État / Dernière action / Prochaine étape / Fichiers modifiés / Décisions.
7. **toDo** `$CLAUDE_VAULT/TODO.md` : NE JAMAIS le lire en entier (multi-projets ; coût dominant du checkpoint, constaté 2026-08-17). `Grep ^## ` pour borner la section projet, puis `Read` avec offset/limit sur ce seul intervalle.
   - Pousser la prochaine étape et chaque engagement verbal non livré, si aucun item non coché équivalent n'existe (comparer par mots-clés) : `- [ ] [op] (YYYY-MM-DD) <texte> [[projet]]`, **3 lignes max** — le détail va dans SESSION.md ou `meta/`.
   - Cocher `- [x]` les items `[[projet]]` livrés dans la session. Edit ciblé, jamais de réécriture du fichier.
8. **Confirmer** en une ligne : `Checkpoint sauvegardé — <résumé 10 mots> | toDo : +N poussé(s), M coché(s)` (omettre la partie toDo si rien n'a bougé).
