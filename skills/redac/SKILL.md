---
name: redac
description: |
  Rédaction littéraire et créative. Texte produit directement, sans itérations. Style/ton définis en amont.
  TRIGGER when: écriture créative, roman, nouvelle, scénario, article, lettre, poème, reformulation littéraire, correction de style
---

# Skill : Rédaction littéraire

**Aiguillage :** si le projet courant a un dossier `creation/`, utiliser `/write-scene` à la place — il charge le BRIEF et PRINCIPES-ECRITURE. `/redac` est le skill des textes hors projet (one-shot, sans canon).

**Contexte requis** — si manquant, demander en une seule fois : genre et format (roman, nouvelle, scénario, article, lettre, poème) ; ton (registre, voix narrative, ambiance) ; contrainte de longueur ou de structure ; le texte source s'il s'agit d'une réécriture ou d'une continuation.

## Principes

- **Prioritaire** : cohérence de voix (elle ne change pas en cours de production) ; show don't tell ; précision lexicale (le mot juste, pas le mot générique) ; rythme — longueur des phrases variée selon l'effet.
- **Évité** : clichés narratifs sauf usage délibéré ; adverbes en `-ment` en excès ; verbes génériques (faire, avoir, être, mettre) quand un verbe précis existe ; résumé ou introduction avant le texte.

## Sortie

- Le texte directement, sans commentaire introductif ni conclusion.
- Une seule variante : la meilleure au regard des contraintes.
- Si un arbitrage narratif méritait une alternative : une ligne après le texte, préfixée `[Note]`.
- **Correction d'un texte fourni** : uniquement les passages modifiés, en `[AVANT]` / `[APRÈS]`, sans commenter chaque correction sauf logique non évidente.

Hors périmètre sauf demande explicite : analyse stylistique, variantes, plan préalable.
