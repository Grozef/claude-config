# Protocole de verification par surface

Referentiel FIGE lu par les hooks (`hooks/stop-verify.js`) et par le CLAUDE.md global.
Source unique de la regle « NOMME L'ARTEFACT » : ne pas la dupliquer ailleurs, y pointer.

Une entree par SURFACE. Format stable, parse par regex — ne pas changer les cles :

    ## <slug> — <titre>
    - declencheur: <ce qui, dans une affirmation, appelle cette surface>
    - artefact: <ce qu'il faut avoir REGARDE avant d'affirmer>
    - commande: <la commande qui le produit>
    - contre-exemple: <date + titre de l'entree meta/erreurs.md ou l'absence a coute>

Les contre-exemples sont references par DATE et TITRE, jamais par numero de ligne :
`meta/erreurs.md` est append-only EN TETE, donc toute reference de ligne pourrit au
premier ajout.

Regle d'usage : si l'artefact ne peut pas etre produit ici, ecrire
`[NO-VERIFY: <ce que je n'ai pas pu observer>]` — jamais « fait ».

---

## visuel — rendu, affichage, mise en page, image
- declencheur: rendu/affichage/logo/mise en page correct, conforme, bien place, s'affiche bien
- artefact: l'IMAGE elle-meme, regardee. Un selecteur trouve prouve la presence dans l'arbre, pas la visibilite : verifier opacite, dimensions au repos, et que le controle CERNE la zone jugee.
- commande: capture cypress/playwright, `pdftoppm -png`, screenshot — puis Read du fichier image
- contre-exemple: 2026-08-29 « "Pose" annonce trois fois sur la foi du DOM alors que rien n etait VISIBLE » ; 2026-08-26 « la planche ne CERNAIT pas la boite du sprite »

## ci — integration continue, suite de tests, "pret a push"
- declencheur: CI vert, tests passent, suite verte, pret a push, bon pour le push
- artefact: le LOG DU RUN distant, pas un run local ni un extrait colle. Et un NOMBRE de tests rapporte : « 0 test execute » est un echec, pas un succes — le code de sortie seul ne distingue pas les deux.
- commande: `gh run view --log-failed` ; a defaut, rejouer la commande EXACTE du workflow (lire le .yml) et lire le compte de tests
- contre-exemple: 2026-08-28 « Cypress rend exit 0 en n'ayant execute AUCUN test » ; 2026-06-22 « 299/299 local » sans rejouer le CI

## existence — absence, presence, inventaire
- declencheur: n'existe pas, introuvable, il n'y a aucun, rien trouve, X fichiers au total
- artefact: une recherche RECURSIVE sur le scope complet, scope nomme dans la phrase. Sur un projet a deux depots, l'inventaire porte sur l'UNION, jamais sur celui qu'on a sous la main.
- commande: `find` / Glob sur >= 2 racines (home + www + Desktop), ou negation qualifiee « introuvable SOUS <chemin> »
- contre-exemple: 2026-08-26 « Inventaire annonce sur UN dossier alors que la source vivait dans DEUX depots »

## feature-runtime — la fonctionnalite marche
- declencheur: c'est fait, ca marche, corrige, operationnel, livre
- artefact: la DONNEE qui traverse le systeme, declenchee pour de vrai, sur la surface PRINCIPALE (la route d'accueil, pas la vue secondaire). Un build vert, un tsc a 0, un test unitaire sur du code mort ne prouvent rien.
- commande: exercer le chemin reel (requete, clic, run) et lire la sortie ; verifier que le code teste est celui qui DESSINE vraiment
- contre-exemple: 2026-08-27 « J'ai verifie la vue SECONDAIRE et livre en disant "fait" » ; 2026-09-02 « Changer la fonction qui choisit le symbole peut ne changer AUCUN pixel »

## etat-de-session — ce qui a ete fait avant, par qui, quand
- declencheur: ce matin, hier, la derniere session, le checkpoint dit, PROCHAIN convenu, deja fait
- artefact: l'artefact DATE — `git log/reflog/show/blame`, `stat`, mtime du fichier de donnees — et un `git status` PAR depot nomme. Le texte d'un SESSION.md n'est pas un etat, c'est un souvenir.
- commande: `git log --oneline -n 5` ; `stat <fichier>` ; `git status` dans chaque repo cite
- contre-exemple: 2026-08-29 « Etat de depart faux : SESSION.md annoncait un item deja clos » ; 2026-07-17 recit causal invente sur un `git mv`

## donnee-structuree — compter, grouper, conclure sur un jeu de donnees
- declencheur: N doublons, N entrees, X % des cas, le champ vaut
- artefact: les CLES REELLEMENT PRESENTES du schema, enumerees AVANT tout comptage, et le fichier effectivement SERVI au consommateur. Un comptage sur un schema mal lu produit un chiffre juste et une conclusion fausse.
- commande: lister les cles (`Object.keys` sur un echantillon, `head` du fichier servi) puis compter
- contre-exemple: 2026-09-02 « J'ai annonce "11 titres dupliques" sans avoir lu le champ qui en resolvait 10 »

## chaine-de-build — artefact genere, servi, deploye
- declencheur: regenere, re-tuile, rebuild, deploye, la correction est cuite
- artefact: les MTIME le long de la chaine. Un maillon aval plus VIEUX que son entree = chaine non rejouee, quoi que dise le controle amont. Verifier le livrable SERVI, pas la source qui l'alimente.
- commande: `stat`/`ls -l --time-style=full-iso` sur source et sortie, dans l'ordre de la chaine
- contre-exemple: 2026-08-28 « Le raster SERVI datait d'avant la regeneration du semis, et mon checkpoint disait "vert" »

## population — corriger en masse, generer en masse
- declencheur: toutes les X sont, plus aucun, j'ai corrige les N cas, verifie sur la planche
- artefact: un comptage sur la POPULATION entiere, pas un echantillon, PLUS une contre-mesure : « j'ai corrige » et « j'ai vide » sont indiscernables sans temoin. Verifier aussi l'unicite de toutes les cles derivees cote consommateur.
- commande: script qui compte les violations sur l'ensemble + mesure temoin avant/apres
- contre-exemple: 2026-08-26 « Livrer en controlant un ECHANTILLON au lieu de la population » ; 2026-09-02 « 383 features sans id ont casse une cle v-for »

## livrable-ecrit — note, TODO, doc, GUIDE livres en .md
- declencheur: ecriture ou edition d'un fichier .md dans le tour, hors ~/.claude/plans/ (gate 2h)
- artefact: le fichier RELU apres la derniere ecriture, et pour chaque affirmation de fait qu'il porte (citation, attribution de source, chiffre, « seul », « aucun ») la page brute, le grep ou le log qui la prouve. Un resume (WebFetch, sous-agent, memoire) n'est pas une source.
- commande: Read/grep du livrable ; `curl -sL <url>.md | grep` pour une doc ; puis bloc `REVERIF :` en fin de message, une ligne `- affirmation -> artefact` (ou `-> NO-VERIFY: ...`)
- contre-exemple: 2026-09-14 « Audit pratiques Opus 5 livre avec 3 affirmations reprises de resumes, dans le tour meme ou je capturais ce risque »
