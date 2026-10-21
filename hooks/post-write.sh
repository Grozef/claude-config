#!/bin/bash
FILE=$(node -e "const d=require('fs').readFileSync(0,'utf8');try{console.log(((JSON.parse(d).tool_input)||{}).file_path||'')}catch(e){}")
BASE=$(basename "$FILE")

if echo "$BASE" | grep -qE '^(SESSION\.md|CONTEXT\.md|DECISIONS\.md)$'; then
  DIR=$(dirname "$FILE")
  if git -C "$DIR" rev-parse --git-dir > /dev/null 2>&1; then
    # Deja ignore, ou suivi expres (ex. SESSION.md du vault) : rien a faire. Avant le 2026-10-21 le hook
    # ajoutait des chemins docs/documentation_claude/ en dur, sans effet hors de cette arborescence.
    git -C "$DIR" check-ignore -q "$FILE" && exit 0
    # --literal-pathspecs : sans lui, un dossier a[1] est lu comme un motif et designe a1
    git -C "$DIR" --literal-pathspecs ls-files --error-unmatch "$FILE" > /dev/null 2>&1 && exit 0
    TOP="$(git -C "$DIR" rev-parse --show-toplevel)"
    # quotePath=false : sinon un chemin accentue sort entre guillemets et le motif ne correspond a rien.
    # --literal-pathspecs : un dossier comme a[1] serait lu comme un motif glob.
    REL="$(cd "$DIR" && git -c core.quotePath=false --literal-pathspecs ls-files --full-name --others -- "$BASE")"
    [ -n "$REL" ] || exit 0
    # Motif ancre a la racine, metacaracteres de gitignore echappes : il doit designer ce seul fichier
    PAT="/$(printf '%s' "$REL" | sed 's/[][*?\\]/\\&/g')"
    # check-ignore lit le chemin comme un motif (a[1] y designe a1) et refuse --literal-pathspecs : le motif deja
    # present suffit a ne pas l'ajouter deux fois
    [ -f "$TOP/.gitignore" ] && grep -qxF "$PAT" "$TOP/.gitignore" && exit 0
    { echo ''; echo '# Claude context file'; echo "$PAT"; } >> "$TOP/.gitignore" && echo "gitignore mis a jour : $PAT"
  fi
fi
