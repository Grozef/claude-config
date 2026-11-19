import re, sys, zipfile
src, dst = sys.argv[1], sys.argv[2]
zin = zipfile.ZipFile(src)
styles = zin.read('word/styles.xml').decode('utf-8')
# 1. Titres 1-3, reperes par leur NOM (« heading 1 »...) : l'identifiant varie selon la langue de Word (Heading1, Titre1).
#    Definis deux fois (generateur docx du premier modele) : garder la 2e definition, la detaillee ; une fois : tels quels.
for h in ('heading 1', 'heading 2', 'heading 3'):
    pat = re.compile(r'<w:style w:type="paragraph"[^>]*>\s*<w:name w:val="%s"/>.*?</w:style>' % h, re.S | re.I)
    found = pat.findall(styles)
    assert len(found) in (1, 2), (h, len(found))
    if len(found) == 2:
        styles = styles.replace(found[0], '', 1)
# 2. Page de titre du modele (mise en forme directe des 2 premiers paragraphes) -> styles Title / Subtitle
#    (remplacent le Title existant, ou s'ajoutent s'il n'y en a pas).
m = re.search(r'<w:style w:type="paragraph" w:styleId="Title">.*?</w:style>', styles, re.S)
if m is None:
    styles = styles.replace('</w:styles>', '<!--title--></w:styles>')
title_old = m.group(0) if m else '<!--title-->'
title_new = ('<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/>'
             '<w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="80"/></w:pPr>'
             '<w:rPr><w:b/><w:bCs/><w:color w:val="1F4E78"/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr></w:style>'
             '<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/>'
             '<w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="240"/></w:pPr>'
             '<w:rPr><w:color w:val="595959"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>')
styles = styles.replace(title_old, title_new)
# 3. Tableaux du modele (bordures BFBFBF, marges 60/100, en-tete 1F4E78 blanc gras) -> style "Table" que pandoc applique.
b = ''.join('<w:%s w:val="single" w:color="BFBFBF" w:sz="4"/>' % s for s in ('top','left','bottom','right','insideH','insideV'))
table = ('<w:style w:type="table" w:styleId="Table"><w:name w:val="Table"/><w:basedOn w:val="TableNormal"/><w:qFormat/>'
         '<w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>'
         '<w:tblPr><w:tblBorders>' + b + '</w:tblBorders>'
         '<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/>'
         '<w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>'
         '<w:tblStylePr w:type="firstRow"><w:rPr><w:b/><w:bCs/><w:color w:val="FFFFFF"/></w:rPr>'
         '<w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="1F4E78"/></w:tcPr></w:tblStylePr></w:style>')
# 4. Consignes de redaction du modele (italique gris 7F7F7F) -> style de caractere "Consigne".
consigne = ('<w:style w:type="character" w:customStyle="1" w:styleId="Consigne"><w:name w:val="Consigne"/>'
            '<w:basedOn w:val="DefaultParagraphFont"/><w:qFormat/><w:rPr><w:i/><w:iCs/><w:color w:val="7F7F7F"/></w:rPr></w:style>')
styles = styles.replace('</w:styles>', table + consigne + '</w:styles>')
zout = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
for item in zin.infolist():
    data = styles.encode('utf-8') if item.filename == 'word/styles.xml' else zin.read(item.filename)
    zout.writestr(item, data)
zout.close()
print('ok', dst)
