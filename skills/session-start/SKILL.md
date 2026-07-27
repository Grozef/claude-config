---
name: session-start
description: |
  Charge le contexte du projet en début de session depuis SESSION.md, CONTEXT.md et DECISIONS.md. Produit un résumé dense de l'état actuel pour reprendre immédiatement sans re-expliquer.
  TRIGGER when: début de session, "où on en était", "reprends le contexte", "charge le contexte"
allowed-tools: Read, Glob
---

# Skill : session-start
# Invocation : /session-start

!`cat docs/documentation_claude/SESSION.md 2>/dev/null || cat documentation_claude/SESSION.md 2>/dev/null || cat SESSION.md 2>/dev/null || echo "⚠ SESSION.md absent — lancer /context-update pour initialiser"`

---

!`cat docs/documentation_claude/CONTEXT.md 2>/dev/null || cat documentation_claude/CONTEXT.md 2>/dev/null || cat CONTEXT.md 2>/dev/null || echo "⚠ CONTEXT.md absent"`

---

!`cat docs/documentation_claude/DECISIONS.md 2>/dev/null | head -60 || cat documentation_claude/DECISIONS.md 2>/dev/null | head -60 || cat DECISIONS.md 2>/dev/null | head -60 || echo "⚠ DECISIONS.md absent"`

---

!`bash ~/.claude/tools/todo-project.sh`

---

## Instructions

À partir des fichiers chargés ci-dessus, produire **uniquement** :

```
## Contexte chargé — [NOM DU PROJET]

État : [1 phrase sur où en est le projet]
Dernière action : [ce qui a été fait]
Prochaine étape : [ce qui doit être fait]

Fichiers actifs : [liste courte]
Décisions récentes : [1-2 décisions clés si pertinentes]
Problèmes en suspens : [si applicable]
toDo projet : [items non cochés tagués [[projet]] chargés ci-dessus, ou "aucun"]
```

Si un item du toDo projet contredit ou complète la "Prochaine étape" de SESSION.md,
le signaler explicitement (le toDo peut porter un engagement que le checkpoint a raté).

Puis attendre la demande de l'utilisateur. Ne pas proposer d'actions spontanément.
