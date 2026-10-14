# Foncier Connect — phase 1 (dossiers fonciers) — état au 13/10/2026

Cahier des charges : « ImmoSuite Foncier Connect » v1.0 du 13/10/2026. Cette phase réalise le noyau côté application ; la base de données vient après.

## Ce qui est livré (branche de travail, non publié sur `main`)
- Onglet **Foncier › Sécurisation du titre › Dossiers fonciers** : indicateurs, ouverture d'un dossier à partir d'une parcelle, liste, détail par étape, historique.
- Stores locaux `dossiers_fonciers` et `evenements_fonciers` (DB locale v155, migration additive). Déclarés dans `SANIX_STORES_LOCAL_UNIQUEMENT` : **aucune synchronisation cloud, aucune table Supabase** à ce stade (aucun appel à `syncToSupabase`, vérifié par test).
- Rattachement aux droits existants : `STORE_MODULE` = « Foncier », comme `parcelles`.
- Workflow de référence en 28 étapes (phases A à E), filtré selon la procédure (ACD, régularisation, dossier avec ACD, titre foncier, mutation, morcellement, fusion, autre) : 28 étapes pour un ACD, 24 pour un morcellement.

## Règles métier appliquées (cahier §20)
| Règle | Implémentation |
|---|---|
| RM-01 | Référence `DF-AAAA-NNN` unique ; second dossier ouvert de même procédure sur la même parcelle : refus, sauf confirmation |
| RM-02 | Chaque changement de statut produit un événement (ancien, nouveau, motif, acteur, date) |
| RM-03 | Une étape à justificatif ne se termine pas sans justificatif ; dérogation possible avec motif, journalisée à part |
| RM-04 | Un dossier exige un responsable ; un statut actif exige un responsable d'étape ou de dossier |
| RM-07 | « Terminé » n'est jamais une décision : l'issue (favorable/défavorable) est distincte et exige un document officiel reçu et contrôlé |
| RM-08 | Chaque justificatif porte une source obligatoire (promoteur, prestataire, administration déclarée, document officiel contrôlé) |
| RM-09 | Une étape terminée n'est plus modifiable directement ; correction par fonction dédiée, motif obligatoire, ancienne valeur conservée |
| RM-11 | Dépassement d'échéance : « retard interne » et « délai administratif dépassé » sont distingués ; ni l'un ni l'autre n'est un rejet |
| RM-13 | La clôture est refusée tant que des étapes restent ouvertes ; dérogation motivée possible |
| §14 | Journal en ajout seul : aucune fonction de modification ou de suppression d'événement |

## Non réalisé à ce stade
Portail souscripteur, portail des intervenants, notifications, gestion documentaire (fichiers), cartographie liée, tableaux de bord avancés, intégrations. Le champ `visibilite` de chaque étape est déjà enregistré en vue du portail souscripteur.

## Phase base de données (après la fermeture de l'accès anonyme)
Conserver la convention du dépôt : tables `pi_dossiers_fonciers` et `pi_evenements_fonciers` au format `id / data jsonb / updated_at / scope_id`, **sans `organization_id`** (une base par client), **créées sans aucun accès `anon`** et avec les règles personnel / souscripteur / intervenant écrites avec la table. Journal : politique d'insertion seule, ni UPDATE ni DELETE. Puis ajouter les deux stores à `SUPA_STORE_MAP` et les retirer de `SANIX_STORES_LOCAL_UNIQUEMENT`.

Tests : `tests-caisse/foncier-connect.test.js` (14 tests).

## Phase 2 — intervenants et missions (13/10/2026, branche de travail)
- Onglet **Foncier › Sécurisation du titre › Intervenants & missions**. Stores locaux `intervenants_fonciers` et `missions_foncieres` (DB locale v156), toujours sans table Supabase ni synchronisation.
- **Répertoire** (§7.2) : nom, type, contact, moyen de contact obligatoire, référence professionnelle ; doublon refusé.
- **Missions** (§7.4, §8.3) : dossier, intervenant actif, livrables attendus, échéance, responsable de validation (par défaut le responsable du dossier). Cycle de vie : brouillon, envoyée, acceptée, en cours, en attente d'informations, livrable soumis, en vérification, à corriger, validée, clôturée (+ annulée, avec motif, ajoutée au-delà du cahier). Seuls les passages prévus sont possibles.
- **Acceptation** : la manière dont elle a été reçue est obligatoire ; sans contrat référencé, un avertissement rappelle qu'elle ne remplace pas un contrat (§7.4).
- **Livrables** (§8.4) : chaque dépôt crée une version ; l'ancienne n'est jamais effacée. Refus : motif et éléments à corriger obligatoires, auteur, date, délai facultatif.
- **Validation réservée au responsable désigné** (ou à un administrateur) ; « validée » exige que tous les livrables attendus soient validés.
- Un livrable validé devient un **justificatif sourcé** (« document reçu du prestataire ») de l'étape liée, **sans terminer l'étape** (RM-07, RM-08).
- **Vue intervenant** (§8.5) : `fcVueIntervenant()` ne renvoie que les missions envoyées de cet intervenant, avec le dossier (référence, parcelle), les étapes de son périmètre et ses livrables — ni observations internes, ni responsable, ni montants. Le futur portail externe devra s'y conformer ; la règle d'accès à écrire en base reprendra cette limite.
- Journal : tous les événements de mission s'ajoutent au journal des dossiers (`mission_id`).
- Tests : `tests-caisse/foncier-missions.test.js` (13 tests).

Non réalisé : portail externe avec connexion, notifications, documents joints aux missions, tableaux de bord intervenants au-delà des indicateurs de l'onglet.

## Phase 3 — information du souscripteur (13/10/2026, branche de travail)
- Onglet **Foncier › Sécurisation du titre › Souscripteurs** et bouton « Publier » sur les étapes publiables du détail d'un dossier. Stores locaux `publications_foncieres` et `demandes_fonciers` (DB locale v157), toujours sans table Supabase.
- **Rien n'est publié automatiquement** ; le texte public est rédigé à part (jamais repris des observations, motifs ou justificatifs) et une étape « interne » n'est pas publiable (RM-05). Publier est réservé au responsable du dossier ou à un administrateur.
- **Source obligatoire** de chaque information, affichée au souscripteur ; « décision officielle » seulement avec un document officiel contrôlé sur l'étape (RM-08).
- **Aucune approbation affirmée sans preuve** (RM-07) : un texte évoquant approbation, accord, obtention, délivrance ou issue favorable est refusé tant que l'étape n'a pas une issue favorable établie par un document officiel (garde-fou lexical : à compléter par la relecture du responsable).
- **Retrait** d'une publication : motif obligatoire, journalisé ; l'historique est conservé.
- `fcVueSouscripteur(clientId)` : définition exacte de ce que le portail pourra lire — uniquement les dossiers des parcelles de ses lots, historique publié, progression, prochaine étape, demandes. Aucune donnée interne (testé avec des valeurs sentinelles).
- **Progression** (§9.3) : étapes publiables seulement, pondérées par phase (`DATA.params.fc_poids_phases`, défaut C=2, D=2, E=1), expliquée en clair ; jamais présentée comme une probabilité d'obtention ni une garantie juridique.
- **Demandes d'information** (§9.6) : référence `DI-AAAA-NNN`, uniquement sur son propre dossier ; statuts nouvelle, en cours, en attente du souscripteur, répondue, clôturée ; réponse par le responsable.
- Tests : `tests-caisse/foncier-souscripteur.test.js` (11 tests).

## Correctif transversal : droits et échecs d'écriture (phases 1 à 3)
`dbPut()` refuse en silence (renvoie `false`) un profil sans droit sur le module. Les fonctions de Foncier Connect annonçaient alors « enregistré » alors que rien n'était écrit. Corrigé : contrôle du droit avant toute modification (`fcDroitEcriture`), échec d'écriture signalé (`fcDb`), toutes les fonctions de mutation protégées (`fcProtegerMutations`). Tests : `tests-caisse/foncier-droits.test.js` (4 tests).

## Phase 4 — notifications, échéances, relances (13/10/2026, branche de travail)
- Onglet **Foncier › Notifications** (badge de non lues). Store local `notifications_foncieres` (DB locale v158), sans table Supabase.
- **Dérivées du journal** : l'événement métier est enregistré d'abord, les notifications ensuite (`fcNotifierSansRisque`). Un échec de notification ne peut ni annuler ni perdre l'opération (RM-10) ; `fcRattraperNotifications()` recrée, sans doublon, celles des événements récents qui n'en ont pas.
- **Canaux** : *interne* (immédiat) ; *e-mail* via la configuration EmailJS existante (Paramètres) ; *SMS* et *WhatsApp* : **aucun fournisseur intégré**, la notification est marquée « canal non disponible », jamais « envoyée ». Un fournisseur se branche en renseignant `FC_FOURNISSEURS.sms` / `.whatsapp`. EmailJS non configuré : « canal non disponible », sans consommer de tentative.
- **Destinataires** : le personnel reçoit dans ImmoSuite (e-mail aussi pour les cas urgents) ; l'intervenant et le souscripteur reçoivent par e-mail un texte limité aux données publiques (mission, échéance, titre public) — aucune donnée interne du dossier (testé).
- **File** (§10.5) : identifiant, clé anti-doublon par destinataire et canal, 3 tentatives espacées (5 min, 30 min, 2 h), abandon avec message d'erreur, relance manuelle (« Relancer les envois en échec »), reprise des envois restés « en cours » plus de 10 minutes après un incident.
- **Échéances et relances** (§10.4) : règles configurables par type (échéance interne, délai administratif, mission) : jours avant, le jour même, jours après, escalade. Une seule alerte par seuil franchi et par date d'échéance, la plus urgente seulement (pas de rafale après une absence) ; changer l'échéance remet le compteur à zéro.
- **RM-11** : un délai administratif dépassé a ses propres règles, **jamais d'escalade**, et un libellé neutre (« ni un rejet ni une faute attribuée ») ; l'échéance interne dépassée est escaladée vers l'administrateur désigné (`fc_escalade_user_id`) ou les administrateurs.
- Cycle automatique : au démarrage (25 s) puis toutes les 30 minutes tant que l'application est ouverte. Un cycle côté serveur (tâche planifiée) viendra avec la base de données : tant que personne n'ouvre l'application, aucune échéance n'est analysée.
- Tests : `tests-caisse/foncier-notifications.test.js` (18 tests).

## Référentiel de procédure (immatriculation d'une parcelle)

Intégré dans `menko-immo.html` (constantes `FC_PROCEDURE_REF`, `FC_ACTEURS_REF`, `FC_BLOCS`, `FC_SITUATIONS`, `FC_CONTROLES_REF`, `FC_SOURCES_OFFICIELLES`, `FC_IDUFCI_NOTE`) :

- ACD : 9 étapes officielles (30 étapes internes avec la création du titre avant signature) ; immatriculation au Livre foncier : 6 opérations.
- 7 situations initiales, 9 contrôles essentiels (`fcEvaluerControle`, source obligatoire), références IDUFCI / n° dossier GUF (`fcDefinirReferences`), 6 blocs de suivi.
- Tests : `tests-caisse/foncier-procedure.test.js` (15).

**À valider avant usage commercial** : le contenu n'est pas vérifié par un juriste ou un géomètre-expert ; les liens de sources ne sont pas vérifiés ; l'intitulé de l'ACD est incohérent dans Menko (« Arrêté de Concession Définitive » vs « Attestation de Cession Définitive ») ; l'acronyme du ministère (MCLU) reste à confirmer. Les dossiers existants ne sont pas modifiés.

## Pièces jointes par étape

Store local `pieces_foncieres` (DB v159), **jamais synchronisé** (pièces d'identité, titres) : à créer fermé, sans accès anonyme, avec stockage privé (bucket non public, URL signées) lors de la phase base de données.

- **Promoteur** : joint un PDF/JPG/PNG/WebP (5 Mo max, 20 pièces par étape) à n'importe quelle étape ; interne par défaut, visible du souscripteur seulement si l'étape lui est publiée ; une source facultative crée aussi un justificatif sourcé.
- **Souscripteur** : dépose une pièce uniquement là où le responsable a ouvert un dépôt (« Demander une pièce »), sur ses propres dossiers. La pièce est « à vérifier » ; le responsable l'accepte ou la refuse (motif obligatoire, communiqué).
- Une pièce retirée est masquée et conservée avec son motif. Tout est journalisé ; notifications au responsable (dépôt) et au souscripteur (demande, décision).
- `fcDeposerPieceSouscripteur(clientId, …)` est l'API que l'espace souscripteur réel appellera. Aujourd'hui, le dépôt se simule depuis l'onglet « Information souscripteurs » (aperçu) : un vrai dépôt par le client exige le portail authentifié et le stockage privé.

## Onglets « Sécurisation du titre »

Ordre de marche en avant : 2.1 Situation des titres → 2.2 Dossiers fonciers → 2.3 Intervenants & missions → 2.4 Jalons du titre (ex-Workflow titre) → 2.5 Information souscripteurs. « Notifications » (transversal) passe en Vue d'ensemble. Passerelles dossier ↔ jalons ; intitulé unique « Arrêté de Concession Définitive ».

## Gestion documentaire (cahier §11) et pilotage (cahier §12)

DB v159 inchangée : la gestion documentaire étend `pieces_foncieres` (local, jamais synchronisé).

**Documents** (onglet « Documents », Vue d'ensemble) : catégorie, version (l'ancienne reste conservée), date d'expiration (alerte à 30 jours), confidentialité (normale / restreinte : responsable et administrateur seulement, jamais visible du souscripteur), archivage logique avec motif et restauration, empreinte SHA-256 et contrôle d'intégrité, recherche (nom, dossier, parcelle, étape, catégorie, organisation), export CSV. Consultations et téléchargements sont journalisés ; un accès refusé n'est pas journalisé comme un accès. Contrôles à l'envoi : taille (5 Mo), format et signature du fichier. **Pas d'analyse antivirus** (non disponible côté navigateur). L'empreinte détecte une altération, elle ne prouve pas l'authenticité.

**Pilotage** (onglet « Pilotage foncier ») : tableau promoteur (13 indicateurs), responsable (listes cliquables : jour, retard, 7 jours, compléments, à valider, documents reçus, sans mise à jour, anomalies), intervenants, direction (réservée admin/dg/direction/manager : procédures, durée d'étape interne, blocages par cause déclarée, respect des échéances, volume par intervenant, évolution sur 12 mois, délai ouverture → clôture avec attentes distinguées). Les durées sont **mesurées au journal horodaté** ; moins de 3 observations = « indicatif » ; aucun retard n'est imputé à une administration ou à un prestataire. Exports CSV (Excel) et PDF/impression : tableaux, rapport des retards, historique d'un dossier ; refusés si le profil ne peut pas consulter le module.

Limites connues : le suivi horodaté n'existe que pour les changements de statut faits à partir de cette version (les dossiers antérieurs, sans journal, apparaissent « non mesurés ») ; les rapports périodiques automatiques (envoi planifié) ne sont pas faits ; les exports ne couvrent pas encore un filtre par projet ou par période.

## Titre global et titres individuels

- **Dossier global** : rattaché à la parcelle (titre mère). **Dossier individuel** (`type_procedure = titre_individuel`, `niveau = 'individuel'`) : un par lot, ou un par souscripteur pour plusieurs de ses lots (`lots_ids`), lié au global (`dossier_global_id`). Champs additifs, aucune migration : les dossiers existants restent « globaux ».
- Circuit propre : vérification du titre mère → identification du lot (morcellement) → pièces du souscripteur → acte de mutation → droits et frais → inscription du titre individuel → remise avec décharge (justificatif obligatoire) → clôture.
- **Titre mère disponible** = parcelle déclarée « TF définitif », ou dossier global dont l'étape « Enregistrement des références » est terminée avec un document officiel contrôlé (un « terminé » seul ne suffit pas). Sinon, l'ouverture exige une dérogation motivée (journalisée, signalée au dossier) ; l'acte de mutation, les droits, l'inscription et la remise ne peuvent pas être terminés si le titre mère n'est plus disponible.
- **Étanchéité** : `fcDossiersDuSouscripteur` n'expose un dossier individuel qu'à ses titulaires (corrige une exposition possible entre souscripteurs d'une même parcelle) ; demandes et dépôts de pièces suivent la même règle.
- Panneau « Titres individuels de l'opération » dans le dossier global (lots, souscripteurs, avancement, ouverture individuelle ou en lot) ; bandeau dans le dossier individuel ; vue souscripteur en deux niveaux ; pilotage de direction par opération (titres remis / lots suivis).
- Hors périmètre pour l'instant : le notaire n'est pas encore un intervenant « type » (acteur de référence seulement) ; le regroupement de lots d'un même souscripteur se fait par l'API (`lot_ids`), pas encore depuis l'interface ; la synchronisation des lots avec le plan de morcellement n'est pas automatique.

## Modifier et imprimer un dossier

- **Modifier** (liste et détail du dossier) : responsable, priorité, échéance, observations. Réservé au responsable du dossier ou à un administrateur ; impossible sur un dossier clôturé ou annulé ; la procédure et la parcelle ne se modifient pas (les étapes ont leurs corrections motivées). Un changement de responsable est répercuté sur les étapes non terminées qui lui étaient confiées (pas celles confiées à un tiers) et notifie le nouveau responsable. Tout est journalisé.
- **Imprimer** (liste, détail, et « Imprimer la liste ») : fiche interne complète (références, étapes, justificatifs, contrôles, liste des pièces, historique), via l'aperçu d'impression de l'ERP (impression ou PDF). Le contenu des fichiers n'est jamais imprimé. Refusé si le profil ne peut pas consulter le module ; l'impression d'une fiche est journalisée.
- **Correctif de confidentialité** : le journal ne cite plus le nom d'un document « restreint » (il affiche « [document restreint — catégorie] »), car le journal est lisible par tous ceux qui voient le dossier.

## Mutations : lot par lot, lots d'un souscripteur, groupes de mutation

- **Lot par lot** (par défaut) : un dossier individuel par lot.
- **Plusieurs lots d'un même souscripteur** : cocher les lots dans le panneau « Titres individuels » puis « Ouvrir un dossier groupé » (un seul dossier, `lots_ids`) ; refusé si les lots n'ont pas le même souscripteur.
- **Groupe de mutation** (store local `groupes_fonciers`, DB v160, jamais synchronisé) : réunit au moins deux dossiers individuels d'une même parcelle traités ensemble par un notaire ou un géomètre-expert. Il ne fusionne rien : chaque dossier garde son souscripteur, ses pièces, son journal et ses justificatifs. Le groupe permet une **action groupée** sur une étape (chaque dossier applique sa propre règle ; les refus sont rapportés par dossier, sans annuler les réussites), un **justificatif commun** (source obligatoire, ajouté à chaque dossier avec la référence du groupe), l'ajout ou le retrait de dossiers (motif obligatoire ; sous deux dossiers, le groupe est dissous), et le suivi de l'avancement (titres remis).
- **Confidentialité** : le groupe est interne. Ni le groupe, ni son libellé, ni les autres dossiers n'apparaissent dans la vue d'un souscripteur ; le journal d'un dossier ne nomme pas les autres souscripteurs. La gestion d'un groupe exige d'être responsable de tous ses dossiers (ou administrateur).
- Hors périmètre : pas de pièces ni d'échéances propres au groupe, pas encore d'impression ni d'indicateur de pilotage dédiés aux groupes.

## Passage en base (14/10/2026)
`supabase/foncier_connect.sql` crée les 9 tables `pi_*_fonciers` (RLS personnel, journal en ajout seul, aucun accès `anon`). 8 stores sont désormais dans `SUPA_STORE_MAP` ; `pieces_foncieres` reste local (pièces d'identité et titres). **Exécuter le script SQL sur le projet AVANT de publier ce code**, sinon la synchronisation de ces stores échoue.

## Stockage privé des pièces (15/10/2026)
`pieces_foncieres` n'est plus local uniquement : les **métadonnées** sont synchronisées (`pi_pieces_foncieres`, RLS personnel) et les **fichiers** partent dans le bucket **privé** `pieces-foncieres` (`supabase/foncier_pieces_stockage.sql`, à exécuter sur chaque projet).
- Chemin `{dossier_id}/{pièce_id}`, 5 Mo, PDF/JPG/PNG/WebP. Dépôt et lecture réservés au personnel ; **aucune règle UPDATE/DELETE** : un fichier déposé n'est ni remplaçable ni supprimable (une nouvelle version = un nouvel objet).
- La ligne publiée ne contient **ni base64 ni contenu** : seulement le chemin. Si l'envoi du fichier échoue, la ligne n'est **pas** publiée (aucune pièce fantôme) ; `fcSynchroniserPieces()` réessaie au démarrage (40 s) puis toutes les 30 min, et migre les pièces antérieures restées locales.
- Autres postes : le contenu est obtenu par **URL signée de 2 minutes** (`fcContenuPiece`) ; consultation, téléchargement et contrôle d'intégrité (SHA-256 recalculée sur le fichier téléchargé) passent par là, toujours journalisés.
- **Reste à faire** : dépôt de FICHIERS par le souscripteur et l'intervenant depuis le portail (aujourd'hui : référence ou lien), et consultation par le souscripteur d'une pièce publiée — exigent une fonction serveur (Edge Function) qui contrôle le jeton et signe l'URL ; ni anon ni souscripteur n'ont d'accès direct au bucket.
- Tests : `tests-caisse/foncier-pieces-stockage.test.js` (5).

## Alertes d'échéances côté serveur (15/10/2026)
`supabase/foncier_echeances_serveur.sql` (à exécuter sur chaque projet ; installé sur Zahara et Menco) : `fc_cycle_echeances()` tourne **chaque jour à 07:00** (pg_cron, tâche `fc-echeances-quotidien`) et écrit les notifications dues dans `pi_notifications_foncieres`, **sans qu'aucun poste soit ouvert**.
- Mêmes règles que l'application : étapes non terminées des dossiers ouverts, missions actives, réglages `fc_relances` / `fc_canaux` / `fc_escalade_user_id` lus dans `pi_params`, seuil le plus urgent, RM-11 (un délai administratif n'est jamais escaladé, libellé neutre).
- **Même clé anti-doublon** que l'application (`ech:{dossier}/{étape}:{échéance}:{niveau}{seuil}|{destinataire}|{canal}`) et identifiants déterministes `srv_…` : ni le serveur ni les postes ne recréent une alerte déjà créée par l'autre ; relancer le cycle ne crée rien (testé).
- Canaux : « interne » pour le personnel ; « e-mail » pour les cas urgents et pour l'intervenant, **mis en file (`en_attente`)**. **Limite connue** : l'envoi EmailJS part d'un poste connecté (aucune clé d'envoi n'est stockée côté serveur) ; tant qu'aucun poste ne s'ouvre, l'alerte interne existe, l'e-mail attend. Un envoi 100 % serveur exige une clé privée EmailJS (ou un autre fournisseur) dans une Edge Function.
- La fonction n'est appelable que par le planificateur (aucun droit pour anon / authenticated). Test manuel sans effet : `select public.fc_cycle_echeances(date '…')` dans un bloc qui se termine par une exception (annule tout).
- Tests : `tests-caisse/foncier-echeances-serveur.test.js` (3) : parité des clés, absence de doublon, envoi de l'e-mail en file.

## Dossier de transmission au notaire (15/10/2026)
`supabase/foncier_transmission_notaire.sql` + Edge Function `supabase/functions/fc-notaire-piece` (installés et déployés sur Zahara et Menco).
- **Désignation** : fiche souscripteur › Documents › « Notaire chargé du dossier » (intervenant de type Notaire, avec accès portail actif). Panneau « 📂 Dossier de transmission au notaire » : **rien n'est transmis sans coche** — sections *identité* (nom, naissance, nationalité, pièce d'identité), *bien* (lots, parcelle, références TF / ACD / IDUFCI / GUF), *avancement* (étapes PUBLIABLES seulement, jamais les étapes internes), puis les **pièces une à une** et les attestations de solde (⚖️).
- **Exclusions** : documents « restreints », pièces retirées ou remplacées, pièces déposées par un autre souscripteur, pièces dont le fichier n'est pas encore dans le stockage. Jamais : montants hors attestations, versements, contacts, observations, journal, autres dossiers. Un souscripteur dont rien n'est transmis n'apparaît pas (pas même son nom).
- **Droits** : seuls les responsables du dossier et les administrateurs transmettent. Changer ou retirer le notaire **retire tout** (sections et pièces) ; l'ancien notaire perd l'accès aussitôt (la vue serveur filtre sur le notaire désigné).
- **Côté notaire** (portail unique › Intervenant) : `fc_vue_notaire_dossiers()` (SECURITY DEFINER, identité lue dans le jeton, accès revérifié à chaque appel). Les fichiers : `fc_notaire_piece_chemin()` contrôle le droit, **journalise la consultation** (événement `piece_consultee_notaire` dans le journal du dossier, ajout seul) et renvoie le chemin ; l'Edge Function signe alors une **URL de 60 secondes** avec la clé de service (le notaire n'a aucun droit direct sur le stockage). Tout refus renvoie le même message (pas d'énumération).
- **Non vérifié de bout en bout** : l'appel réel de l'Edge Function avec un jeton de notaire n'a pas pu être testé depuis l'environnement de développement (accès réseau sortant refusé) ; testé : SQL (isolation entre notaires, géomètre et souscripteur refusés, exclusions, journal, coupure au changement de notaire), ERP et rendu du portail. À faire à la première utilisation : transmettre une pièce de test à un notaire de test et l'ouvrir.
- Tests : `foncier-transmission-notaire.test.js` (5), `portail-prix-modifications.test.js` (6).

## Lien vente ↔ titre ↔ comptabilité (15/10/2026)
**1. Ouverture automatique du dossier de titre individuel au solde.** À l'enregistrement du versement qui solde le **prix initial** (`attSoldeAuto` → `fcApresSolde`) : si le titre mère est disponible et que le poste a le droit d'écriture Foncier, le dossier individuel s'ouvre (lots du souscripteur, responsable du dossier global, événement `ouverture_auto` au journal) ; sinon le service Foncier reçoit **une** notification (`solde:{client}`) précisant la raison. Une seule fois par souscripteur ; rien si le souscripteur est résilié, sans lot sur parcelle, ou déjà suivi. Réglage : Foncier › Notifications › « Ouvrir automatiquement… » (`DATA.params.fc_ouverture_auto_solde`, actif par défaut).

**2. Frais du titre → comptabilité SYSCOHADA.** Panneau « 💶 Frais du titre » (dossier individuel) : honoraires notaire, honoraires géomètre-expert, droits d'enregistrement / mutation, frais d'actes ; **pièce justificative obligatoire**, TVA saisie séparément (interdite sur les droits), imputation **promoteur** (charge) ou **souscripteur** (frais avancés, à refacturer).
- Constatation : `D charge HT (+ D TVA déductible) / C fournisseurs` — ou `D frais avancés souscripteur / C fournisseurs`. Règlement : `D fournisseurs / C trésorerie` (caisse, mobile money, banque).
- Comptes : **Paramètres › Comptes par défaut › Titre foncier** (`titre_honoraires_notaire`, `titre_honoraires_geometre`, `titre_droits_enregistrement`, `titre_frais_actes`, `titre_fournisseurs`, `titre_avances_souscripteur`) ; **aucun n'est présélectionné** (repères OHADA indiqués : 6324, 6325, 646, 401) : compte absent = refus explicite, aucune écriture. Le compte de TVA déductible est celui déjà paramétré.
- Écritures **non validées (brouillard)**, id déterministes `ecr_titre_{frais}_cst` / `_reg` (idempotent), pièce, tiers et division renseignés ; droit **Comptabilité** requis pour comptabiliser et régler ; saisie et annulation réservées au responsable du dossier. Un frais **comptabilisé ne s'annule plus ici** : contre-passation en comptabilité.
- **Limites** : la refacturation au souscripteur (encaissement des frais avancés) n'est pas automatisée — le solde est visible dans le panneau (« avancés pour le souscripteur ») ; la TVA sur frais avancés pour le compte du souscripteur n'est pas ventilée ; les comptes sont à faire confirmer par l'expert-comptable avant la première utilisation.
- Tests : `tests-caisse/foncier-vente-compta.test.js` (8).

## Dépôt de fichiers depuis le portail (15/10/2026)
`supabase/foncier_depot_fichiers_portail.sql` + Edge Function `supabase/functions/fc-portail-fichier` (installés et déployés sur Zahara et Menco).
- **Souscripteur** (portail › Mon titre › « 📎 Pièces de votre dossier ») : pour chaque pièce demandée par le responsable (étape publiée, dépôt ouvert), choix du fichier et envoi ; la pièce est « à vérifier », le responsable l'accepte ou la refuse avec motif (déjà géré côté ERP) ; le souscripteur voit le statut, le motif de refus et peut rouvrir ses fichiers et les documents que le promoteur lui a publiés.
- **Intervenant** (portail › mission › livrable) : « Déposer le fichier » en plus du dépôt par référence ; la version porte `piece_id`, `empreinte`, `taille`, et le responsable ouvre le fichier depuis le détail de la mission (« ⬇ ouvrir le fichier ») ou l'onglet Documents.
- **Sécurité** : aucun droit direct des déposants sur le stockage ni les tables. L'Edge Function (clé de service) n'autorise rien : `fc_depot_preparer` décide AVANT l'envoi (dossier du souscripteur, étape publiée avec dépôt ouvert, 10 pièces au plus ; mission de l'intervenant en cours ou à corriger, livrable existant, aucune version en attente), `fc_depot_valider` REvérifie après l'envoi et enregistre (le fichier envoyé est retiré en cas d'échec). Type déterminé par la **signature des octets** (PDF, JPEG, PNG, WebP), 5 Mo, empreinte SHA-256, 20 dépôts / 10 min par jeton, chemin `{dossier}/{pièce}` jamais écrasé. Dossier d'un autre souscripteur ou sans titulaire : refus (correctif d'une comparaison NULL détectée au test : `fc__dossier_du_client`).
- **Limites** : pas d'analyse antivirus ; pas de dépôt multiple en un geste ; l'appel réel de l'Edge Function avec un jeton du portail n'a pas pu être testé depuis l'environnement de développement (réseau sortant bloqué) — testé : SQL (droits, refus, isolation), logique du portail (contrôles, envoi multipart, erreurs) et lien ERP. À faire à la première utilisation : demander une pièce à un souscripteur de test et la déposer depuis son portail.
- Tests : `portail-depot-fichiers.test.js` (4), `foncier-pieces-stockage.test.js` (6).

## RF1 — Refacturation des frais du titre au souscripteur

- ERP : Foncier › dossier individuel › Frais du titre › « Refacturation au souscripteur ». Les frais *avancés pour le souscripteur* et comptabilisés se regroupent en une **note de débours** `NDF-AAAA-NNNN` (prix coûtant, sans marge, document figé à l'émission).
- Statuts : `emise` → `encaissee` ; `annulee` (uniquement avant encaissement ; libère les frais). Publication au portail : notification e-mail externe dédupliquée (`debours:<id>`).
- Encaissement (droit Comptabilité) : écriture en **brouillard** D trésorerie (`_compteTresoVersement`) / C `titre_avances_souscripteur` (4111 suggéré). Clôt la créance née de la comptabilisation du frais (D 4111 / C 401).
- TVA non ventilée sur la note (débours) : traitement à confirmer par l'expert-comptable.
- SQL : `foncier_notes_debours_portail.sql` → `fc_vue_souscripteur_debours()` (JWT `kind=souscripteur`, notes publiées émises/encaissées du client titulaire uniquement).
- Tests : `foncier-refacturation.test.js` (5), `portail-debours.test.js` (2). Test SQL rollback validé sur les deux projets.

## PF1 — Pilotage foncier : filtres, coûts, rapport périodique

- **Filtres** (Foncier › Pilotage foncier) : programme, parcelle, procédure, responsable, niveau (global/individuel), période d'ouverture. S'appliquent à tous les tableaux et exports (`fcAvecFiltre` : DATA temporairement restreint puis restauré, y compris en cas d'erreur).
- **💶 Coûts du titre** (direction) : frais engagés TTC, part promoteur / avancés pour les souscripteurs, à régler, à refacturer, refacturé, encaissé, notes de débours en retard, répartition par nature et par opération, coût moyen d'un titre remis (indicatif sous le seuil de mesure).
- **📑 Rapport périodique** (direction) : hebdomadaire, mensuel, trimestriel ; période en cours ou close ; comparaison avec la période précédente ; situation au jour. Export PDF / CSV. Envoi à la direction par notification interne, une seule fois par période (déduplication).
- **Envoi automatique** : Foncier › Notifications › « Rapport de pilotage envoyé à la direction » (jamais / chaque semaine / chaque mois), exécuté par le cycle de notifications (dernière période close).
- Aucune migration SQL. Tests : `foncier-pilotage-rapport.test.js` (6).
