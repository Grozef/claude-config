---
name: review-meta
description: |
  Revue periodique des 3 fichiers meta/ du vault Obsidian (erreurs, learnings, decisions-recurrentes). Detecte les doublons, les entrees obsoletes, les redondances. Propose archivage/consolidation. Inclut un TALLY de recurrence des causes-racines (tags [[...]]) pour cibler objectivement le prochain GATE a construire.
  TRIGGER when: "review-meta", "audit meta", "consolide meta", "nettoie meta/", "archive meta", revue periodique du dossier meta/
allowed-tools: Read, Edit, Write, Glob, Bash
model: claude-haiku-4-5-20251001
---

# Skill : review-meta
# Invocation : /review-meta [erreurs|learnings|decisions|all]

**Contexte :** $ARGUMENTS

## Mode

- `/review-meta` ou `/review-meta all` → revue des 3 fichiers
- `/review-meta erreurs` ou `learnings` ou `decisions` → un seul fichier

## Etapes

1. **Lire** les fichiers cibles dans `$CLAUDE_VAULT/meta/` :
   - `erreurs.md`
   - `learnings.md`
   - `decisions-recurrentes.md`

2. **Analyser** pour chaque fichier :
   - Compter les entrees totales (`## YYYY-MM-DD` headings)
   - Identifier les entrees > 90 jours (date dans le titre vs aujourd'hui)
   - Detecter doublons potentiels par titre similaire (Levenshtein < 5 ou substring match)
   - Detecter redondances thematiques (meme tag wikilink utilise > 3 fois sur des entrees proches)

2bis. **Tally de recurrence (GATE deterministe — sortie dans le contexte AVANT toute conclusion) :**
   `bash ~/.claude/tools/meta-tally.sh`
   (defaut : dossier vault + top 15 ; `meta-tally.sh <dossier> <topN>` pour ajuster). Le tool imprime : volumetrie par fichier, top causes-racines dans `erreurs.md` (signal de defaillance), top tags toutes sources. Ne PAS recompter les tags a la main — lire la sortie du tool. La cause-racine la plus frequente dans `erreurs.md` = candidate prioritaire pour le prochain GATE (cf. `stop-verify.js`, `cdc.sh`).

3. **Rapport compact** au format :
```
## review-meta — YYYY-MM-DD

### Recurrence (tally)
- Top cause-racine erreurs.md : [[tag]] (N) — gate existant ? oui/non -> action
- Classe non encore gatee la plus frequente : [[tag]] (N)

### erreurs.md
- N entrees, X obsoletes (> 90j), Y doublons potentiels
- A archiver : [[date — titre]] ...
- A fusionner : [[date1 — titre1]] + [[date2 — titre2]]

### learnings.md
[idem]

### decisions-recurrentes.md
[idem]
```

4. **Demander confirmation** avant toute modification :
   - "Archiver les N entrees > 90j vers `meta/archive-YYYY.md` ? (y/n)"
   - "Fusionner les doublons listes ? (y/n)"

5. **Si OK** :
   - Creer/append `meta/archive-YYYY.md` avec les entrees archivees
   - Retirer ces entrees du fichier source (Edit precis, pas Write complet)
   - Pour les doublons : fusionner manuellement (Edit) en gardant le plus recent + ajoutant les details du plus ancien

6. **Confirmer** : `meta/ reviewed → erreurs: -N, learnings: -M, decisions: -P. Archive: meta/archive-2026.md`

## Garde-fous

- **Spillover par TAILLE** (pas seulement par age) : si un append-only depasse ~400 lignes, proposer d'archiver les entrees les plus ANCIENNES vers `meta/archive-2026.md` jusqu'a repasser sous ~280 lignes. Couper sur une frontiere d'en-tete `## YYYY-MM-DD`, backup avant, verifier qu'aucune entree `## ` n'est perdue (somme garde+archive = avant). Les wikilinks restent resolvables (archive dans le vault). Cf spillover learnings du 2026-06-28.
- Si fichier source < 50 lignes → pas d'archivage proposé (pas assez de matiere)
- Orphelins : `meta-tally.sh` liste les wikilinks sans note `concepts/` ; creer le stub manquant plutot que retirer le lien.
- Si entree contient un wikilink vers un projet `[[projet-actif]]` → ne PAS archiver meme si > 90j (matiere active)
- Toujours faire Read avant Edit (regle never-assume + hook pre-edit-write)
