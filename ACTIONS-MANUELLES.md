# Actions manuelles — mise en place token_efficiency

## Une seule action par projet existant

Pour chaque projet Laravel/Vue actif, ouvrir Claude Code dans le répertoire du projet et lancer :

```
/context-update
```

Cela déploie automatiquement :
- `app/CLAUDE.md` (règles Laravel)
- `resources/js/CLAUDE.md` (règles Vue)
- `.claudeignore` (exclut node_modules, vendor, dist...)
- `SESSION.md`, `CONTEXT.md`, `DECISIONS.md`
- `.gitignore` mis à jour

**C'est tout.** Les nouveaux projets sont gérés automatiquement au premier démarrage.

---

## Alias PowerShell (Windows)

Chargés automatiquement par `$PROFILE` (configuré le 2026-05-22).
Pour les activer dans la session courante sans rouvrir le terminal :
```powershell
. $PROFILE
```

Fonctions disponibles :
- `haiku "question"` — réponse 10x moins chère pour les questions mécaniques
- `claude-sonnet` — lancer Claude avec Sonnet explicitement
- `claude-project C:\chemin\projet` — ouvrir Claude directement dans un projet

> PowerShell 7 (pwsh) : copier `. "$HOME\.claude\claude-aliases.ps1"` dans `Documents\PowerShell\Microsoft.PowerShell_profile.ps1`.
> `profile_aliases.sh` / `haiku.sh` (bash) restent pour référence mais ne se chargent pas sous Windows.

---

## Vérifier que les hooks fonctionnent

Au prochain démarrage de Claude dans un projet, tu dois voir la box ASCII avec le bon message selon le projet détecté. Si ce n'est pas le cas : vérifier `~/.claude/settings.json`.
