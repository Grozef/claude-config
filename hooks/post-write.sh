#!/bin/bash
FILE=$(node -e "const d=require('fs').readFileSync(0,'utf8');try{console.log(((JSON.parse(d).tool_input)||{}).file_path||'')}catch(e){}")
BASE=$(basename "$FILE")

if echo "$BASE" | grep -qE '^(SESSION\.md|CONTEXT\.md|DECISIONS\.md)$'; then
  DIR=$(dirname "$FILE")
  if git -C "$DIR" rev-parse --git-dir > /dev/null 2>&1; then
    GI="$(git -C "$DIR" rev-parse --show-toplevel)/.gitignore"
    touch "$GI"
    grep -qF 'docs/documentation_claude/SESSION.md' "$GI" || { echo ''; echo '# Claude context files'; echo 'docs/documentation_claude/SESSION.md'; echo 'docs/documentation_claude/CONTEXT.md'; echo 'docs/documentation_claude/DECISIONS.md'; } >> "$GI" && echo "gitignore mis a jour"
  fi
fi
