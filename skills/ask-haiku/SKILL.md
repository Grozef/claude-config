---
name: ask-haiku
description: |
  Répond à une question mécanique via claude-haiku (10-20x moins cher). Idéal pour : existence d'un fichier/fonction, nom exact d'une méthode, valeur d'une constante, vérification rapide.
  TRIGGER when: "ask-haiku", "demande à haiku", question courte et factuelle sur le code, "est-ce que X existe", "quel est le nom de Y"
allowed-tools: Bash
---

# Skill : ask-haiku
# Invocation : /ask-haiku [question]

**Question :** $ARGUMENTS

## Instruction

Reformule la question en une seule ligne dense et factuelle, puis exécute :

```bash
echo "[question reformulée]" | haiku --print
```

Si `haiku` n'est pas disponible dans le PATH, rappeler :
```
source ~/.claude/profile_aliases.sh
```

Présente uniquement la réponse de haiku, sans ajout.
