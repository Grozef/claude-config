#!/usr/bin/env bash
# Resume du toDo global, chiffres tires du fichier et jamais de ma lecture.
#
#   todo-summary.sh             une ligne par projet : ouverts, plus ancien, a toi / a moi / sans tag
#   todo-summary.sh <projet>    items du bloc, numerotes (match insensible a la casse sur le titre)
#   todo-summary.sh toi|moi     items de ce tag, tous projets
#
# Motif : le 2026-10-19, toDo de 92 items presente en entier puis « verifie » en bloc ;
# le compteur « 88 op » du demarrage a ete recopie comme total. Item compte = ligne
# `- [ ]` ou `- [~]` suivie d'un tag [op]/[idee]/[revue] (meme regex que hooks/session-start.js).

[ -f "$HOME/.claude/vault.conf" ] && . "$HOME/.claude/vault.conf"
TODO="${CLAUDE_VAULT:-}/TODO.md"
[ -f "$TODO" ] || { echo "(TODO.md introuvable)"; exit 1; }

awk -v arg="${1:-}" '
  function flush() {
    if (sec == "" || n == 0) return
    printf "%-28s %3d  (plus ancien %s)  %2d a toi  %2d a moi", sec, n, old, toi, moi
    if (none) printf "  /!\\ %d sans tag", none
    printf "\n"
  }
  BEGIN { a = tolower(arg) }
  /^## / {
    if (a == "") flush()
    sec = substr($0, 4); n = toi = moi = none = 0; old = "9999"; k = 0
    if (sec ~ /^Projets \(index/) sec = ""
    next
  }
  /^- \[[ ~]\] \[(op|idee|revue)\]/ {
    if (sec == "") next
    n++; tot++
    if (match($0, /\([0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]\)/)) { d = substr($0, RSTART + 1, 10); if (d < old) old = d }
    if ($0 ~ /^- \[[ ~]\] \[[a-z]+\] \[toi\]/) { toi++; ttoi++ }
    else if ($0 ~ /^- \[[ ~]\] \[[a-z]+\] \[moi\]/) { moi++; tmoi++ }
    else { none++; tnone++ }
    if (a == "toi" || a == "moi") {
      if ($0 ~ ("^- \\[[ ~]\\] \\[[a-z]+\\] \\[" a "\\]")) print "[" sec "] " $0
    } else if (a != "" && index(tolower(sec), a)) {
      if (!(sec in hit)) { hit[sec] = 1; nhit++ }
      print ++k ". " $0
    }
  }
  END {
    # Silence = « rien a faire » : un nom inconnu ou ambigu se dit, avec code d erreur.
    if (a != "" && a != "toi" && a != "moi") {
      if (nhit == 0) { print "(aucun bloc ## contenant « " arg " » avec des items ouverts)"; exit 2 }
      if (nhit > 1) { printf "/!\\ « %s » couvre %d blocs, numerotation commune : preciser le nom\n", arg, nhit; exit 2 }
    }
    if (a == "") {
      flush()
      printf "TOTAL %d items | %d a toi | %d a moi", tot, ttoi, tmoi
      if (tnone) printf " | %d sans tag", tnone
      printf "\n-> /todo list <projet> pour le detail\n"
    }
  }
' "$TODO"
