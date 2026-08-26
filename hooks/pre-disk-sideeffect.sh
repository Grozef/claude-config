#!/bin/bash
# PreToolUse Bash|PowerShell : BLOQUE une commande a effet de bord disque
# tant qu'un outil de flashage/gravure tourne.
# Incident 2026-08-12 : Mount-DiskImage lance sur une ISO pendant que Rufus ecrivait la cle,
# sur la foi d'un Get-Process vieux de deux tours. Voir meta/concepts/etat-perime-avant-effet-de-bord.md
# Lit le JSON Claude Code via stdin (readFileSync 0, pas /dev/stdin casse sur Windows).

CMD=$(node -e "const d=require('fs').readFileSync(0,'utf8');try{console.log(((JSON.parse(d).tool_input)||{}).command||'')}catch(e){}")

[ -z "$CMD" ] && exit 0

# Verbes a effet de bord sur un disque/volume/image
SIDE_EFFECT='Mount-DiskImage|Dismount-DiskImage|Format-Volume|Clear-Disk|Initialize-Disk|Remove-Partition|New-Partition|Set-Partition|Add-PartitionAccessPath|Remove-PartitionAccessPath|Set-Disk|diskpart|(^|\s)dd\s+if=|format\s+[A-Za-z]:'

echo "$CMD" | grep -qiE "$SIDE_EFFECT" || exit 0

# Outils de flashage / gravure / imagerie susceptibles de tenir le disque ou l'image
FLASHERS='rufus|balena|etcher|ventoy|win32diskimager|imager|usbwriter|unetbootin|isoburn'

# tasklist SANS options : Git Bash convertit /FO et /NH en chemins MSYS et la commande echoue.
RUNNING=$(tasklist 2>/dev/null | awk '{print $1}' | grep -iE "$FLASHERS" | sort -u | tr '\n' ' ')

if [ -n "$RUNNING" ]; then
  echo "BLOQUE - effet de bord disque pendant une operation de flashage." >&2
  echo "" >&2
  echo "Processus en cours : $RUNNING" >&2
  echo "Commande refusee   : $(echo "$CMD" | head -c 200)" >&2
  echo "" >&2
  echo "Cette commande modifie/monte un disque ou une image pendant qu'un outil de flashage tourne." >&2
  echo "Incident 2026-08-12 (Rufus + Mount-DiskImage) : voir meta/concepts/etat-perime-avant-effet-de-bord.md" >&2
  echo "" >&2
  echo "Avant de reessayer :" >&2
  echo "  1. relire l'etat du processus DANS CE TOUR (Get-Process, Responding, CPU)" >&2
  echo "  2. relire l'etat du volume cible (Get-Volume / Get-Partition)" >&2
  echo "  3. si l'operation est en cours : n'utiliser que des commandes de LECTURE PURE," >&2
  echo "     et demander a l'utilisateur avant tout effet de bord." >&2
  exit 2
fi

exit 0
