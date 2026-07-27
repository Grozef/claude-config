---
name: linux
description: |
  Administration Linux et scripting shell token-efficient. Commandes, scripts bash, configuration système, permissions, services, réseau, cron, ssh.
  TRIGGER when: question sur commande Linux/Unix, administration système, script bash/sh, permissions, services systemd, cron, ssh, réseau, logs système
---

# Skill : Linux / Shell

## Contexte requis avant d'agir
Si manquant, demander en une seule fois :
1. Distribution et version (`uname -a` ou `cat /etc/os-release`)
2. Contexte : commande ponctuelle / script réutilisable / automatisation cron ?
3. Niveau de privilège disponible (root / sudo / user simple)

## Standards appliqués automatiquement

### Commandes
- Toujours préférer les options longues dans les scripts (`--recursive` plutôt que `-r`) pour la lisibilité
- Citer les variables : `"$VAR"` jamais `$VAR` nu dans les scripts
- Utiliser `[[` plutôt que `[` dans les scripts bash
- Préférer `$(command)` aux backticks

### Scripts bash
```bash
#!/usr/bin/env bash
set -euo pipefail
```
Ces deux lignes en en-tête systématique sur tout script non trivial.

- `set -e` : arrêt sur erreur
- `set -u` : erreur sur variable non définie
- `set -o pipefail` : erreur propagée dans les pipes

### Permissions et sécurité
- Principe du moindre privilège : ne pas proposer `chmod 777` ou `sudo` si ce n'est pas nécessaire
- Pour les scripts : `chmod 750` par défaut
- Pour les clés SSH : `chmod 600`
- Signaler si une commande proposée a un impact destructeur irréversible : `[ATTENTION: irréversible]`

### Gestion des erreurs dans les scripts
```bash
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >&2; }
die() { log "ERREUR: $*"; exit 1; }
```

### Services systemd
- Toujours fournir `enable` + `start` ensemble si installation
- Indiquer `journalctl -u nom-service -f` pour le suivi des logs

## Format de sortie

**Commande ponctuelle :**
```bash
commande --option argument
```
+ une ligne d'explication si non évident

**Script :**
```bash
#!/usr/bin/env bash
set -euo pipefail
# [nom-du-script] — [ce qu'il fait en une ligne]

# code
```
Chemin suggéré : `/usr/local/bin/nom-script` ou `~/scripts/nom-script`

**Suite de commandes à exécuter dans l'ordre :**
Numérotées, chacune sur son bloc séparé, avec l'effet attendu en commentaire.

## Ce qui n'est pas inclus sauf si demandé
- Tests unitaires de scripts (bats)
- Documentation man page
- Packaging (deb/rpm)
