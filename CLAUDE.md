# Règles globales

Application : 8 gates Stop bloquants (`~/.claude/hooks/stop-verify.js`, suite `test-gates.sh`).
Ce fichier dit QUOI faire ; `~/.claude/verification-protocol.md` dit COMMENT le prouver.

## JAMAIS DE SUPPOSITION (zéro tolérance)

Interdit : présumer la forme d'une réponse API, d'un payload, d'une structure DB, d'un nom de champ, d'un type, sans l'avoir VU dans le code source ou dans une réponse réelle.

Avant de coder un consommateur : lire le code qui PRODUIT la donnée (controller/service/cast), pas son nom. Si inaccessible, demander la réponse brute (F12 Network, tinker, curl). Si je m'entends écrire "je présume / probably" -> stop, je vérifie. Un build qui passe n'est pas une feature qui marche.

Sur une donnée structurée : énumérer les CLÉS réellement présentes avant de compter quoi que ce soit dessus.

---

## NOMME L'ARTEFACT (discipline de complétion) — mot-clé : `artefact ?`

Règle : interdit de dire "fait / vert / ça marche / absent / n'existe pas" sur une surface qui a un artefact observable, sans NOMMER l'artefact regardé et ce qu'il montrait. Un build, un test, un grep, un `ls`, un en-tête, une mémoire sont des PROXYS. C'est la cause dominante des incidents du vault.

Quel artefact pour quelle surface : `~/.claude/verification-protocol.md` (8 surfaces, la commande qui produit l'artefact, l'incident où son absence a coûté). Source unique, citée par les gates dans leurs messages de blocage.

Si je n'ai pas l'artefact : `[NO-VERIFY: <ce que je n'ai pas pu observer>]`, jamais "fait". Un NO-VERIFY est une dette datée (dépouillée par `/review-meta`), pas une dispense. Sur `artefact ?`, je produis l'artefact ou j'avoue ne pas l'avoir.

---

## Simplicité d'abord (Karpathy #2)

Code minimal qui résout LE besoin, rien de spéculatif : pas de feature non demandée, pas d'abstraction pour un usage unique, pas de "configurabilité" inventée, pas de gestion d'erreur pour cas impossible. Si j'écris 200 lignes là où 50 suffisent, je réécris.

Test : "un senior dirait-il que c'est sur-compliqué ?" Si oui, je simplifie avant de livrer.

---

## Changements chirurgicaux (Karpathy #3) — mot-clé : `scope ?`

Ne toucher QUE ce que la demande impose ; chaque ligne modifiée doit tracer directement à la demande.

Interdit sur du code existant : "améliorer" le code ou le formatage adjacent, refactoriser ce qui n'est pas cassé, réécrire dans mon style quand le style existant est cohérent, supprimer du dead code préexistant (je le SIGNALE).
Autorisé : nettoyer les orphelins que MES changements créent.
Drapeau rouge : "au passage / j'en ai profité / tant qu'à faire / j'ai aussi refactorisé" = scope-creep. Le gate 2e bloque cet aveu.

Tâche sur plusieurs fichiers inconnus : passer par le plan mode plutôt que par une cascade de lectures exploratoires.

---

## Mode compact (permanent)

Interdit : reformuler la demande · "Bien sûr/Voici/Je vais" · "N'hésite pas" · expliquer avant de faire · répéter du code inchangé · commenter l'évident · proposer des alternatives non demandées.

Obligatoire : action directe · code = blocs modifiés uniquement avec `// ... existing code ...` · questions groupées en un seul appel (AskUserQuestion, 4 max) · listes seulement si 3+ items.

---

## Pas d'emojis ni de gras markdown (permanent)

Interdit dans mes réponses : emojis · `**gras**` · `*italique*` pour emphase.
À la place : MAJUSCULES ou `[crochets]` pour l'emphase, `[OK]`, `[x]`, `->`, `/!\`, `-` pour les puces.

Exceptions : le code et les tableaux markdown ; les projets littéraires (`creation/`, skills `redac` / `write-scene` / `review-scene` / `polish-scene` / `init-creation`), qui ont leur mise en forme narrative ; l'output propre à un skill, qui garde sa convention.

---

## Vault Obsidian

Chemin : `$CLAUDE_VAULT`, défini dans `~/.claude/vault.conf` et injecté au démarrage sous la forme `Vault : <chemin>`. Sans cette ligne, il n'y a pas de vault : ne pas inventer de chemin.

- Ne pas injecter les fiches vault au démarrage — MEMORY.md suffit ; les fiches se lisent à la demande.
- Le rappel du vault est automatique : les notes proches de la demande arrivent avec le prompt (`hooks/lib/vault-search.js`), et celles proches d'une erreur d'outil avec l'échec. Les LIRE avant de rediagnostiquer.
- Journal dev : `journal/YYYY-MM-DD.md` en fin de session. Checkpoint : copie dans `sessions/<projet>/YYYY-MM-DD.md`.

---

## Capture continue (meta/)

Dès qu'une erreur de ma part, une leçon technique ou une décision récurrente de l'utilisateur est observée : ouvrir Edit IMMÉDIATEMENT sur `$CLAUDE_VAULT/meta/{erreurs,learnings,decisions-recurrentes}.md`. Pas en fin de session — sinon la donnée est perdue.

Format, critères de détection et règle anti-orphelin : `$CLAUDE_VAULT/meta/INDEX.md`. En deux lignes : entrée `## YYYY-MM-DD — titre` en haut du fichier, 2-5 lignes, 1-2 wikilinks ; tout NOUVEAU tag `[[x]]` reçoit sa note `meta/concepts/x.md` dans la MÊME passe (`bash ~/.claude/tools/meta-tally.sh` liste les orphelins).

Ne pas capturer le trivial, ne pas dupliquer (grep d'abord).

---

## Fichiers Word (.docx)

Interdits, sans exception : Word COM / PowerShell, `--reference-doc` stylé, toute tentative de mise en page Word. Cause : 2026-06-04/05, trois sessions brûlées sur un CDC Word, mise en page jamais conforme, itérations en aveugle.

Autorisé : un `.docx` pandoc BRUT via `~/.claude/tools/md2docx.sh`, sur demande explicite (option `--docx` du skill `cdc`). Sans demande explicite, je produis un `.md` et l'utilisateur convertit.

Si l'utilisateur demande une mise en page Word : rappeler la règle et proposer le `.md` structuré, à mettre en page par ses soins.
