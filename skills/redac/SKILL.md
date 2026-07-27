---
name: redac
description: |
  Rédaction littéraire et créative. Texte produit directement, sans itérations. Style/ton définis en amont.
  TRIGGER when: écriture créative, roman, nouvelle, scénario, article, lettre, poème, reformulation littéraire, correction de style
---

# Skill : Rédaction littéraire

## Déclenchement
Quand l'utilisateur demande d'écrire, réécrire, reformuler, continuer ou corriger un texte littéraire, narratif, ou créatif.

**Aiguillage :** si le projet courant a un dossier `creation/` (projet littéraire structuré),
utiliser `/write-scene` à la place — il charge le BRIEF et le référentiel PRINCIPES-ECRITURE.
`/redac` reste le skill des textes hors projet (one-shot, sans canon).

## Contexte requis avant d'agir
Si manquant, demander en une seule fois :
1. Genre / format : roman, nouvelle, scénario, article, lettre, poème, autre ?
2. Ton : registre formel/informel, voix narrative (1ère/3ème personne), ambiance (sombre, humoristique, lyrique...)
3. Contrainte de longueur ou de format (nombre de mots, paragraphes, structure imposée ?)
4. Si réécriture/continuation : fournir le texte source ou l'extrait précédent

## Principes rédactionnels

### Ce qui est prioritaire
- Cohérence de voix : la voix narrative ne change pas en cours de production
- Show don't tell : préférer la scène à l'explication
- Précision lexicale : mot juste plutôt que mot générique
- Rythme : varier longueur des phrases selon l'effet voulu

### Ce qui est évité
- Clichés narratifs sauf usage délibéré et justifié
- Adverbes en `-ment` en excès
- Verbes génériques (faire, avoir, être, mettre) quand un verbe précis existe
- Résumé ou introduction du texte avant de le produire

## Format de sortie
- Produire directement le texte, sans commentaire introductif ni conclusion
- Si plusieurs variantes sont possibles : en produire une seule, la meilleure selon les contraintes
- Si une décision narrative a été prise qui méritait une alternative : la signaler en **une ligne** après le texte, préfixée par `[Note]`

## Corrections et reformulations
- Si l'utilisateur fournit un texte à corriger : montrer uniquement les passages modifiés avec `[AVANT]` / `[APRÈS]`
- Pas de commentaire sur chaque correction sauf si la logique est non évidente

## Ce qui n'est pas inclus sauf si demandé
- Analyse stylistique du texte produit
- Alternatives ou variantes
- Plan ou outline préalable
