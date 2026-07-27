#!/usr/bin/env bash
# docx-brand.sh — injecte un header/footer (kit "brand") dans un .docx généré par pandoc,
# SANS toucher aux styles du corps (chirurgie ciblée, pas de --reference-doc).
# Kit attendu dans <brand>/ : header1.xml, footer1.xml, header1.xml.rels, image1.png
#
# Usage : docx-brand.sh [--brand <dir>] [--out <f.docx>] <input.docx>
#   --brand : dossier du kit (défaut: $CLAUDE_BRAND_DIR, voir vault.conf)
#   --out   : docx de sortie (défaut: écrase l'input)
set -euo pipefail

if [ -f "$HOME/.claude/vault.conf" ]; then . "$HOME/.claude/vault.conf"; fi
brand="${CLAUDE_BRAND_DIR:-}"
in=""; out=""
die() { echo "docx-brand.sh: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --brand) brand="${2:?}"; shift 2 ;;
    --out)   out="${2:?}"; shift 2 ;;
    *)       in="$1"; shift ;;
  esac
done
[ -n "$in" ] || die "input.docx manquant"
[ -f "$in" ] || die "introuvable: $in"
out="${out:-$in}"
[ -n "$brand" ] || die "aucun kit de marque : definir CLAUDE_BRAND_DIR dans ~/.claude/vault.conf ou passer --brand <dir>"
for f in header1.xml footer1.xml header1.xml.rels image1.png; do
  [ -f "$brand/$f" ] || die "asset manquant: $brand/$f"
done

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
unzip -q "$in" -d "$work"

# 1. parties du kit
cp "$brand/header1.xml" "$work/word/header1.xml"
cp "$brand/footer1.xml" "$work/word/footer1.xml"
mkdir -p "$work/word/_rels"; cp "$brand/header1.xml.rels" "$work/word/_rels/header1.xml.rels"
mkdir -p "$work/word/media"; cp "$brand/image1.png" "$work/word/media/image1.png"

# 2. [Content_Types].xml : Default png (si absent) + Overrides header/footer
ct="$work/[Content_Types].xml"
grep -q 'Extension="png"' "$ct" || \
  sed -i 's#</Types>#<Default Extension="png" ContentType="image/png"/></Types>#' "$ct"
sed -i 's#</Types>#<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>#' "$ct"

# 3. relationships document -> header/footer
sed -i 's#</Relationships>#<Relationship Id="rId100" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId101" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>#' "$work/word/_rels/document.xml.rels"

# 4. sectPr : références (après <w:sectPr>) + pgSz/pgMar repris de cdc.docx (avant </w:sectPr>)
doc="$work/word/document.xml"
sed -i 's#<w:sectPr>#<w:sectPr><w:headerReference w:type="default" r:id="rId100"/><w:footerReference w:type="default" r:id="rId101"/>#' "$doc"
sed -i 's#</w:sectPr>#<w:pgSz w:w="11907" w:h="16840" w:code="9"/><w:pgMar w:top="1560" w:right="1134" w:bottom="1134" w:left="1701" w:header="720" w:footer="567" w:gutter="0"/></w:sectPr>#' "$doc"

# 5. repackage (zip absent en git bash ; .NET CreateFromDirectory met des backslash
#    non conformes -> python zipfile qui écrit des forward slashes)
tmpzip="${out%.docx}.__brand.zip"; rm -f "$tmpzip"
python -c "import zipfile,os,sys
src,dst=sys.argv[1],sys.argv[2]
with zipfile.ZipFile(dst,'w',zipfile.ZIP_DEFLATED) as z:
    for root,_,files in os.walk(src):
        for f in files:
            full=os.path.join(root,f)
            z.write(full, os.path.relpath(full,src).replace(os.sep,'/'))" \
  "$(cygpath -w "$work")" "$(cygpath -w "$tmpzip")"
mv -f "$tmpzip" "$out"
echo "$out"
