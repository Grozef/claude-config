---
name: checkpoint
description: |
  Sauvegarde l'état actuel de la session dans SESSION.md. Met à jour : état actuel, dernière action, prochaine étape, fichiers modifiés, décisions prises. Incrémente le compteur de réponses.
  TRIGGER when: "checkpoint", "sauvegarde", "save la session", toutes les 10 réponses (auto), fin de session
allowed-tools: Read, Edit, Bash
model: claude-haiku-4-5-20251001
---

# Skill : checkpoint
# Invocation : /checkpoint [résumé optionnel]

**Contexte fourni :** $ARGUMENTS

> Emplacement du trio de contexte : `docs/documentation_claude/SESSION.md` (reorg 2026-07-17).
> Fallbacks `documentation_claude/SESSION.md` puis racine `SESSION.md` si le projet n'est pas
> encore migré. Toute lecture/écriture ci-dessous vise `docs/documentation_claude/SESSION.md`
> s'il existe, sinon `documentation_claude/SESSION.md`, sinon `SESSION.md`.

## Étapes

1. **Lire `documentation_claude/SESSION.md`** (fallback `SESSION.md`) pour connaître l'état précédent et le compteur actuel.

2. **Identifier ce qui a changé** depuis le dernier checkpoint :
   - Fichiers modifiés — **par repo, jamais un seul `git diff` au CWD** (cause d'incident
     2026-07-05 : "rien côté back" annoncé alors qu'un autre repo portait 15 fichiers non
     commités). Découvrir les repos : `find . -maxdepth 3 -name .git -type d 2>/dev/null`.
     Pour CHAQUE repo trouvé, sortir `git -C <repo> status --short` sous son NOM explicite.
     Un projet multi-repos (ex. `<projet>_back/` ≠ `backend/`) exige un
     état nommé par repo — jamais un singulier globalisant type "côté back".
   - Décisions prises
   - Problèmes résolus ou apparus
   - Prochaine étape CONVENUE avec l'utilisateur — le dernier échange VERBAL fait foi,
     pas le dernier fichier modifié (un plan discuté mais pas encore codé DOIT y figurer)

3. **Mettre à jour `documentation_claude/SESSION.md`** (fallback `SESSION.md`) :
   - Incrémenter le compteur de réponses
   - Mettre à jour "État actuel", "Dernière action", "Prochaine étape"
   - **La ligne d'en-tête "État actuel" = l'AXE ACTIF de la session, pas le dernier micro-item
     livré** (cause d'incident 2026-07-05 : en-tête stale d'un ancien projet relayé comme focus
     alors que la session portait sur un tout autre sujet). Si l'axe a changé, réécrire l'en-tête ; ne jamais
     laisser une ligne du haut qui ment sur le focus. Un checkpoint dont l'en-tête est faux est
     un checkpoint cassé — c'est le canal de passation vers la prochaine session (ou un autre
     modèle) : il hérite de ce que dit l'en-tête.
   - Mettre à jour "Fichiers ouverts / modifiés récemment"
   - Ajouter une entrée dans "Historique des checkpoints" avec la date et heure actuelles
   - Format de l'entrée : dense, max 5 lignes

4. **Élaguer l'historique** — règle de taille stricte :
   - Garder uniquement les **3 derniers checkpoints** dans "Historique des checkpoints"
   - Supprimer les entrées plus anciennes sans exception
   - Si `SESSION.md` dépasse **50 lignes** après mise à jour : compresser "Fichiers ouverts" à 3 entrées max et "Problèmes en suspens" à 2 entrées max

5. **Estimer le volume de contexte** (ne pas afficher sauf si > seuil) :
   - Compter les fichiers lus dans la session : `FICHIERS_LUS`
   - Estimation rough : `FICHIERS_LUS × 150 tokens` (moyenne par fichier)
   - Si estimation > 50 000 tokens : afficher `⚠ Contexte lourd (~Xk tokens) — envisage /compact`

6. **Copie dans le vault Obsidian** :
   - Déterminer le nom du projet : nom du dossier courant (basename du CWD)
   - Chemin du vault : `$CLAUDE_VAULT` (valeur injectée au démarrage par `session-start`, ligne `Vault : <chemin>`). Sans vault configuré, sauter cette étape et la suivante.
   - Créer le dossier si nécessaire : `mkdir -p $CLAUDE_VAULT/sessions/<nom-projet>`
   - Écrire/écraser `$CLAUDE_VAULT/sessions/<nom-projet>/YYYY-MM-DD.md` avec un résumé compact :
     ```
     # <nom-projet> — YYYY-MM-DD
     **État :** [état actuel]
     **Dernière action :** [dernière action]
     **Prochaine étape :** [prochaine étape]
     **Fichiers modifiés :** [liste courte]
     **Décisions :** [si applicable]
     ```

7. **Synchroniser le toDo global** — `$CLAUDE_VAULT/TODO.md` (chemin ABSOLU) :
   - Tag projet : basename du CWD en minuscules (ex. `[[mon_projet]]`)
   - Read TODO.md AVANT tout Edit (never-assume)
   - **Pousser** : pour la "Prochaine étape" ET chaque engagement pris VERBALEMENT avec
     l'utilisateur dans la session qui reste à livrer (pas seulement ce qui est visible dans
     les fichiers modifiés — cause d'incident 2026-07-05 : plan verbal jamais gravé, reprise
     à côté de la plaque) : si aucun item NON coché équivalent n'existe déjà dans
     `## Operations en attente` (comparer par mots-clés, pas mot à mot), insérer
     `- [ ] (YYYY-MM-DD) <texte> [[projet]]` juste après le titre de section
   - **Cocher** : chaque item non coché tagué `[[projet]]` livré pendant la session → `- [x]`
   - Edit ciblé uniquement, jamais de réécriture complète du fichier

8. **Confirmer** en une ligne : `Checkpoint sauvegardé — [résumé en 10 mots] | toDo : +N poussé(s), M coché(s)` (omettre la partie toDo si rien n'a bougé)

## Format de l'entrée historique

```
### [DATE HEURE]
- [Action principale réalisée]
- [Fichiers modifiés]
- [Décision prise si applicable]
→ Prochain : [prochaine étape]
```
