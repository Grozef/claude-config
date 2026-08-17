---
name: linux
description: |
  Administration Linux et scripting shell token-efficient. Commandes, scripts bash, configuration système, permissions, services, réseau, cron, ssh.
  TRIGGER when: question sur commande Linux/Unix, administration système, script bash/sh, permissions, services systemd, cron, ssh, réseau, logs système
---

# Skill : Linux / Shell

**Contexte requis** — si manquant, demander en une seule fois : distribution et version (`cat /etc/os-release`) ; besoin (commande ponctuelle, script réutilisable, cron) ; privilège disponible (root / sudo / user).

## Standards appliqués d'office

- **Commandes** : options longues dans les scripts (`--recursive`, pas `-r`), variables toujours citées (`"$VAR"`), `[[` plutôt que `[`, `$(cmd)` plutôt que des backticks.
- **En-tête systématique** de tout script non trivial :
  ```bash
  #!/usr/bin/env bash
  set -euo pipefail   # arrêt sur erreur, variable non définie fatale, erreur propagée dans les pipes
  ```
- **Erreurs** : `log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >&2; }` et `die() { log "ERREUR: $*"; exit 1; }`.
- **Permissions** : moindre privilège — jamais `chmod 777` ni `sudo` non nécessaire ; scripts en `750`, clés SSH en `600`.
- **Destructif** : toute commande irréversible est préfixée `[ATTENTION: irréversible]`.
- **systemd** : fournir `enable` + `start` ensemble à l'installation, et donner `journalctl -u <service> -f` pour le suivi.

## Sortie

- **Commande ponctuelle** : le bloc `bash`, plus une ligne d'explication si l'effet n'est pas évident.
- **Script** : shebang + `set -euo pipefail` + une ligne de commentaire `# <nom> — <ce qu'il fait>`, et le chemin suggéré (`/usr/local/bin/<nom>` ou `~/scripts/<nom>`).
- **Suite de commandes** : numérotées, un bloc chacune, effet attendu en commentaire.

Hors périmètre sauf demande explicite : tests bats, man pages, packaging deb/rpm.
