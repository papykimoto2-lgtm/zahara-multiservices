# Manuel de procédures — Foncier : sécurisation du titre et coordination des démarches

**Objet** : fixer qui fait quoi, quand et avec quelle preuve, pour que chaque dossier foncier soit traité de la même façon, de l'ouverture à l'archivage.
**Complément** : le *Manuel d'utilisation* (`MANUEL_FONCIER.md`) explique les écrans ; ce manuel fixe les **règles de travail**.
**Principe directeur** : l'ERP suit et coordonne les démarches. « Terminé » ne signifie jamais « accordé par l'administration ». Toute exception est motivée et journalisée ; l'historique d'un dossier est en ajout seul.

> Les délais « recommandés » sont des repères de bonne pratique à valider par la direction ; l'ERP n'impose que les contrôles marqués **[bloquant]**.

---

## 1. Rôles et responsabilités

| Rôle | Qui | Responsabilités principales |
|---|---|---|
| **Responsable de dossier** | Agent désigné sur le dossier | Conduit le dossier, tient les échéances, valide les livrables, publie au souscripteur, peut déroger (avec motif) |
| **Agent foncier** | Équipe Foncier | Saisit, joint les justificatifs, prépare courriers et pièces ; ne modifie pas un dossier dont il n'est pas responsable |
| **Comptabilité** | Droit « écriture Comptabilité » | Comptabilise les frais, règle les prestataires, encaisse les notes de débours (écritures en brouillard, à valider) |
| **Direction** | admin, dg, direction, manager | Modèles, réglages, coûts, rapport périodique, revue des risques, arbitrage des dérogations |
| **Administrateur** | admin | Droits des utilisateurs, accès portail, réglages système |
| **Intervenant** | Géomètre, notaire, avocat… | Accepte, exécute, dépose ses livrables sur son portail |
| **Souscripteur** | Client | Fournit ses pièces, consulte l'avancement, règle les notes de débours |

### Matrice RACI (R = réalise, A = approuve, C = consulté, I = informé)

| Procédure | Resp. dossier | Agent | Compta | Direction | Intervenant | Souscripteur |
|---|---|---|---|---|---|---|
| PRO-01/02 Ouverture | A/R | R | – | I | – | – |
| PRO-04 Avancement | A/R | R | – | I | C | – |
| PRO-05 Pièces | A | R | – | – | C | R (dépôt) |
| PRO-06 Missions | A/R | R | – | I | R | – |
| PRO-09/10 Frais et refacturation | A | R | R | I | C | I (paiement) |
| PRO-13 Remise et clôture | A/R | R | C | I | – | R (réception) |
| PRO-15 Reporting | C | – | C | A/R | – | – |
| PRO-16 Paramétrage | – | – | C | A/R | – | – |

---

## 2. Routines de pilotage

| Fréquence | Qui | Action | Où |
|---|---|---|---|
| **Chaque matin** | Chaque agent | Traiter « Ma journée » jusqu'à badge à 0 : retards, échéances du jour, pièces à contrôler, livrables à valider | Foncier › Ma journée |
| **Chaque jour** | Responsable | Répondre aux messages et demandes de complément | Missions, Souscripteurs |
| **Chaque semaine** | Responsable de service | Revue des dossiers à risque élevé/critique, dossiers sans mise à jour, incohérences | Pilotage › 🚨 Dossiers à risque ; Kanban |
| **Chaque semaine** | Comptabilité | Comptabiliser les frais saisis ; régler les prestataires échus ; relancer les notes en retard | Dossier › Frais du titre ; Pilotage › Coûts |
| **Chaque mois** | Direction | Rapport périodique (mois clos), coûts du titre, budgets dépassés ; décisions | Pilotage › Rapport / Coûts |
| **Chaque trimestre** | Direction + Admin | Revue des accès (utilisateurs, portails intervenants), des modèles et des courriers types | Paramètres ; Modèles |
| **Chaque année** | Direction | Archivage des dossiers clos ; relecture des modèles de mission et de courrier par un juriste | Liste des dossiers › Archiver |

---

## 3. Procédures

### PRO-01 — Ouvrir un dossier global (parcelle)
**Déclencheur** : nouvelle opération ou nouvelle procédure sur une parcelle. **Responsable** : Resp. dossier.
1. Vérifier qu'aucun dossier actif de même procédure n'existe sur la parcelle (l'ERP alerte ; un doublon exige confirmation).
2. Foncier › 2.2 › **Ouvrir un dossier** : parcelle, situation initiale ou procédure, **responsable (obligatoire)**, priorité, échéance.
3. Les échéances et responsables des étapes se remplissent depuis le modèle de la procédure ; sans modèle, depuis les durées habituelles observées (marquées 📈 *estimée*, au moins 3 dossiers observés).
4. Contrôler le **score de risque** initial et corriger les échéances aberrantes.

**Contrôles** : responsable renseigné **[bloquant]**. **Preuve** : événement « Dossier ouvert » + « Modèle appliqué ».

### PRO-02 — Ouvrir un dossier de titre individuel
**Déclencheur** : souscripteur soldé (ouverture automatique), ou demande manuelle. **Prérequis** : titre mère disponible (titre définitif déclaré, ou références enregistrées avec document officiel contrôlé).
1. Automatique : l'ERP ouvre le dossier quand le prix initial est soldé ; sinon le service Foncier est prévenu.
2. Manuel : dossier global › « Titres individuels » › lot(s) du souscripteur › **Ouvrir le dossier** (un lot, ou plusieurs lots d'un même souscripteur, ou « Ouvrir tous les dossiers manquants »).
3. Sans titre mère : ouverture et étapes aval **[bloquantes]** sauf dérogation motivée.
4. Fixer le **budget prévisionnel du titre** (PRO-09) et vérifier le notaire/géomètre à mobiliser (PRO-06).

**Preuve** : événement d'ouverture ; référence DF-AAAA-NNN.

### PRO-03 — Pilotage quotidien
1. Ouvrir **Ma journée** ; traiter dans l'ordre : *Dossiers à surveiller*, *En retard*, *Aujourd'hui*, *Pièces à contrôler*, *Livrables à valider*, *Demandes de complément*, *Notes en retard*.
2. Utiliser les actions en un clic (Démarrer, Terminer, +7 j, Accepter/Refuser une pièce) ; elles appliquent les mêmes contrôles que le dossier.
3. Le **Kanban** sert aux points d'équipe : glisser une carte change le statut de l'étape (mêmes règles).
4. Toute échéance reportée est **journalisée** : le motif est automatique (« Report de 7 jours »), ajouter un motif métier dans le dossier si le report dépasse 14 jours **(recommandé)**.

### PRO-04 — Faire avancer une étape
**Règle d'or** : un statut reflète un fait, pas une intention.
1. **Démarrer** : responsable renseigné **[bloquant]** ; étapes préalables terminées ou annulées **[bloquant]**, sinon dérogation (PRO-17).
2. **En attente** (intervenant, document, administration, décision) : à utiliser dès que la balle n'est plus chez nous ; ne jamais laisser « En cours » une étape qui attend un tiers.
3. **Bloqué / rejeté / annulé** : motif obligatoire **[bloquant]**.
4. **Terminer** : justificatif joint si l'étape l'exige **[bloquant]** ; source du justificatif obligatoire (promoteur, prestataire, administration déclarée, document officiel reçu et contrôlé).
5. **Issue administrative** (favorable/défavorable) : uniquement avec un *document officiel reçu et contrôlé* **[bloquant]**.
6. Étape terminée : modification uniquement par **Corriger** avec motif ; l'ancienne valeur est conservée.

**Délai recommandé** : statut mis à jour le jour même du fait.

### PRO-05 — Gérer les pièces
1. **Dépôt** : par l'équipe (étape concernée) ou par le souscripteur depuis son portail (étape publiée avec dépôt ouvert, 10 pièces au plus par demande).
2. **Contrôle** (recommandé sous 3 jours ouvrés) : Accepter, ou Refuser avec motif **[bloquant]** — le motif est communiqué au souscripteur.
3. **Confidentialité** : une pièce « restreinte » n'apparaît jamais sur un portail ; ne rien transmettre à un tiers hors des cases prévues (PRO-11).
4. **Versions** : remplacer plutôt que supprimer ; l'archivage d'une pièce exige un motif.
5. **Expiration** : traiter les alertes à 30 jours ; une pièce expirée pèse sur le score de risque.
6. **Intégrité** : une pièce signalée « altérée » est remplacée et l'incident consigné.

### PRO-06 — Confier et suivre une mission à un intervenant
1. Foncier › 2.3 : choisir le **dossier** et l'**intervenant actif**, puis la **mission type** (bornage, acte de mutation, dépôt et suivi…). Titre, consignes, livrables, échéance et étape sont préremplis : **vérifier et ajuster**.
2. Renseigner la référence du **contrat** (une mission sans contrat est signalée).
3. **Créer et envoyer** ; l'intervenant accepte (la réception de l'acceptation est consignée avec sa référence : e-mail, courrier, appel).
4. Suivi : relances automatiques selon les règles (avant / jour J / après / escalade) ; messagerie par mission.
5. **Réception** : le responsable de validation vérifie chaque livrable (valider ou demander correction avec commentaire) ; la mission est *validée* quand **tous** les livrables le sont **[bloquant]**, puis *clôturée*.
6. Écart de délai : courrier « Rappel d'échéance » (PRO-12) avant toute escalade.

### PRO-07 — Accès portail des intervenants et du notaire
1. **Octroi** (admin ou responsable) : fiche de l'intervenant › accès portail ; durée d'expiration définie ; le code est transmis **par un canal distinct** de l'identifiant.
2. **Périmètre** : l'intervenant ne voit que ses missions ; le notaire ne voit que ce qui lui est transmis (PRO-11).
3. **Révocation immédiate** à la fin de la relation, en cas de doute, ou au départ d'un correspondant.
4. **Revue trimestrielle** des accès actifs (PRO-18).

### PRO-08 — Informer et solliciter le souscripteur
1. Publier uniquement des informations **vérifiées**, avec leur **source** ; retirer avec motif en cas d'erreur.
2. L'avancement affiché est pondéré et explicité ; **jamais** de promesse de date ou d'issue.
3. Demande de pièces : ouvrir le dépôt sur l'étape, préciser la pièce attendue ; courrier « Pièces complémentaires » si le délai dépasse 10 jours **(recommandé)**.
4. Répondre aux demandes du souscripteur sous 5 jours ouvrés **(recommandé)**.

### PRO-09 — Frais du titre et budget
1. **Budget** : fixer le budget prévisionnel par nature de frais dès l'ouverture (ou appliquer le budget type) ; le revoir à tout événement majeur.
2. **Saisie** (responsable) : nature, HT, TVA, date, **pièce justificative obligatoire** **[bloquant]**, prestataire, qui supporte (promoteur ou souscripteur). Droits d'enregistrement : pas de TVA **[bloquant]**.
3. **Comptabilisation** (Comptabilité) : écriture **en brouillard** SYSCOHADA — promoteur : D charge + TVA déductible / C fournisseurs ; avancé pour le souscripteur : D avances souscripteur / C fournisseurs. Comptes manquants → refus clair **[bloquant]** (Paramètres › Comptes par défaut › Titre foncier).
5. **Règlement du prestataire** : D fournisseurs / C trésorerie ; mode et date contrôlés.
6. **Alerte** : tout dépassement de budget est examiné par le responsable ; au-delà du budget, information de la direction.
7. Les écritures en brouillard sont **validées en comptabilité** selon la procédure comptable de l'entreprise.

### PRO-10 — Refacturer les frais avancés au souscripteur
1. Sélectionner les frais *avancés pour le souscripteur* et *comptabilisés* ; **Émettre la note de débours** (NDF-AAAA-NNNN) : prix coûtant, sans marge, document figé, échéance (30 jours par défaut).
2. **Publier** au portail : le souscripteur est averti par e-mail (une seule fois par note).
3. **Encaisser** (Comptabilité) : mode et date ; écriture en brouillard D trésorerie / C compte d'avances ; la note passe « encaissée ».
4. **Retard** : rappel par le courrier « Rappel de règlement » (COU-…) puis, au-delà de 15 jours **(recommandé)**, appel du souscripteur et information du responsable.
5. **Annulation** : possible uniquement tant que la note est *émise* (motif obligatoire) ; après encaissement, contre-passation en comptabilité.
6. TVA des débours : traitement **à confirmer par l'expert-comptable** avant la première émission.

### PRO-11 — Transmettre un dossier au notaire
1. Dans la fiche du souscripteur, définir le **notaire** et cocher ce qui est transmis : identité, bien, avancement ; pour chaque pièce, cocher « transmis au notaire » (jamais une pièce restreinte).
2. Le notaire consulte depuis son portail ; **chaque consultation est journalisée**.
3. Les attestations de soldes du souscripteur sont transmises au notaire seulement après validation de la direction.
4. Joindre au courrier « Transmission du dossier » la liste des pièces ; conserver la référence COU-….

### PRO-12 — Courriers
1. Dossier › **Courriers types** : choisir le modèle et le destinataire.
2. Compléter tout « [à compléter] » ; relire le texte (il reste modifiable).
3. **Imprimer/PDF**, **copier** ou **envoyer par e-mail** ; chaque action est journalisée avec la référence COU-AAAA-NNNN.
4. Courriers officiels vers l'administration : relecture par le responsable avant envoi **(recommandé)**.
5. Les modèles de texte sont adaptés uniquement par la direction (PRO-16) après relecture juridique.

### PRO-13 — Remise du titre et clôture
1. Étape « Inscription du titre individuel » terminée avec **document officiel contrôlé**.
2. Courrier « Remise du titre » au souscripteur.
3. **Remise** : vérifier la pièce d'identité ; imprimer la **décharge** ; faire signer en deux exemplaires ; **Enregistrer la remise** (date, remis à, pièce d'identité) — référence DEC-AAAA-NNNN, définitive.
4. Joindre le **scan de la décharge signée** à l'étape « Remise du titre ».
5. **Contrôle avant clôture** : pièces contrôlées, missions validées/clôturées, demandes de complément closes, contrôles sans anomalie, frais comptabilisés, notes de débours encaissées **[bloquant]**. Sinon dérogation motivée du responsable (PRO-17).
6. Clôturer le dossier (étape « Clôture ») ; mettre à jour le statut foncier de la parcelle.

### PRO-14 — Archivage
1. Un dossier clos ou annulé est archivable (réversible). Archivage annuel des dossiers clos depuis plus de 24 mois (réglable).
2. Avant archivage de masse : vérifier l'absence de contentieux ou de demande d'un tiers sur le dossier.
3. L'archivage ne supprime rien : le dossier reste consultable (« Inclure les archivés ») et l'historique est intact.
4. Conservation légale des pièces et des écritures : selon la politique de l'entreprise et le droit applicable (à fixer par la direction).

### PRO-15 — Reporting et revues
1. **Hebdomadaire** (responsable de service) : Pilotage › Promoteur et Dossiers à risque ; décider des priorités.
2. **Mensuel** (direction) : Rapport périodique du mois **clos**, comparé au précédent ; export PDF/CSV pour archivage ; envoi à la direction (une fois par période). L'envoi automatique se règle dans Notifications.
3. **Coûts** : examiner les budgets dépassés et les notes en retard ; documenter les décisions.
4. **Lecture des indicateurs** : toute valeur fondée sur moins de 3 observations est *indicative* ; un retard n'est jamais imputé à un tiers sans donnée.

### PRO-16 — Paramétrage (direction / administrateur)
| Élément | Où | Fréquence de revue |
|---|---|---|
| Modèles de dossier (durées, responsables) | Foncier › Modèles de dossier | Trimestrielle |
| Ordre des étapes, contrôle de clôture, protection contre les modifications simultanées, échéances estimées | Modèles de dossier (cases à cocher) | Annuelle |
| Modèles de mission par type d'intervenant | Intervenants & missions › Modèles de mission | Semestrielle |
| Modèles de courrier | Modèles de dossier › Modèles de courrier | Annuelle, avec juriste |
| Budget type, durée d'archivage | Modèles de dossier › Archivage et budget type | Annuelle |
| Règles de relance, rapport automatique | Foncier › Notifications | Annuelle |
| Comptes par défaut (titre foncier) | Paramètres › Comptes par défaut | À chaque changement de plan comptable |

Toute modification de paramètre est **annoncée aux équipes** avant application.

### PRO-17 — Exceptions et incidents
| Situation | Conduite |
|---|---|
| **Ordre des étapes** à contourner | Dérogation motivée du responsable (journalisée) ; la direction examine les dérogations chaque mois |
| **Justificatif manquant** pour terminer | Dérogation motivée ; régulariser sous 15 jours **(recommandé)** ; l'étape reste signalée |
| **Clôture avec points ouverts** | Dérogation motivée du responsable ; informer la direction |
| **« Ce dossier a été modifié par … »** | Rien n'est écrasé : attendre l'actualisation automatique, relire, recommencer |
| **Hors ligne** | Le travail continue ; après retour du réseau, vérifier qu'aucun message de conflit n'est apparu |
| **Envoi d'e-mail en échec** | Notifications › « Relancer les envois en échec » ; à défaut, imprimer le courrier et le remettre autrement |
| **Erreur de saisie d'un frais** | Annuler le frais **avant** comptabilisation ; après, contre-passation en comptabilité |
| **Étape terminée par erreur** | **Corriger** avec motif (jamais de contournement) |
| **Compte comptable non paramétré** | Prévenir la direction/Comptabilité ; ne pas saisir d'écriture manuelle de remplacement |
| **Soupçon d'accès non autorisé** | Révoquer l'accès concerné (PRO-07), prévenir l'administrateur, consigner l'incident |

### PRO-18 — Sécurité et droits d'accès
1. **Moindre privilège** : chaque utilisateur n'a que les droits utiles à son rôle ; droit « écriture Foncier » et droit « écriture Comptabilité » sont distincts.
2. **Départ ou changement de poste** : désactiver ou réaffecter le jour même ; réaffecter ses dossiers (action groupée).
3. **Revue trimestrielle** : liste des utilisateurs actifs, des responsables de dossier et des accès portail ; retrait de tout accès sans usage.
4. **Données sensibles** : ne pas diffuser un document interne ; les pièces confidentielles ne sont jamais publiées.
5. **Pièces et fichiers** : stockés dans un espace privé ; ouverture par lien signé de durée courte (60 secondes).

### PRO-19 — Immatriculer une parcelle rurale (AFOR / agriculture)
**Déclencheur** : terrain situé en domaine rural, à immatriculer par la voie de l'agriculture puis de l'AFOR. **Responsable** : Resp. dossier. **Procédure source** : texte fourni par le promoteur, non vérifié par l'ERP ; à valider par un juriste ou un géomètre-expert. Le foncier rural suit une procédure **distincte** du foncier urbain (PRO-01 et procédure urbaine).
1. Foncier › 2.2 › **Ouvrir un dossier** › assistant d'ouverture, question 1 : situation du terrain **« Parcelle rurale »**, puis **Appliquer au formulaire**. La procédure « Immatriculation d'une parcelle rurale (AFOR / agriculture) » est proposée avec ses 31 étapes (+ création et clôture du dossier).
2. Choisir la parcelle et le responsable, puis **Ouvrir le dossier** (suite comme PRO-01).
3. Dérouler les étapes dans l'ordre du tableau ci-dessous (onglet **Étapes** du dossier). Les étapes et phases de la procédure rurale sont repérées en **bleu** (l'urbain est en rouge).
4. Phase 1 — recherche, repérage, démarche coutumière, délimitation et levé topographique de la parcelle.
5. Phase 2 — enquête foncière, procès-verbaux de famille et enquête auprès de la chefferie et des sachants, intervention du commissaire de justice (consolidation des déclarations des propriétaires terriens, désignation du représentant légal / gestionnaire), convention notariée suivie du versement de la donation (compensation en nature).
6. Phase 3 — achat des deux liasses, dépôt à l'agriculture, nomination du commissaire enquêteur, frais d'ouverture d'enquête et de siège du comité villageois, **enquête villageoise d'un mois**, bornage par le géomètre expert, clôture de l'enquête en présence des voisins (frais de déplacement à régler), traitement par l'agriculture, réunion de validation présidée par le sous-préfet, **certificat foncier**, frais de publication au journal officiel.
7. Phase 4 — dossier d'immatriculation déposé à l'AFOR, transmis à la conservation foncière du chef-lieu, au cadastre pour le bornage contradictoire (frais à payer), puis à la conservation pour la création du titre foncier, à l'AFOR, au ministère de l'agriculture pour validation, et enfin **retrait du titre foncier**.
8. Joindre à chaque étape à justificatif le document correspondant (récépissé, procès-verbal, quittance de frais, certificat). Les paiements de frais se rapprochent des écritures comptables correspondantes.

**Contrôles** : une étape ne démarre ni ne se termine avant ses étapes préalables **[bloquant]**, sauf dérogation motivée du responsable du dossier (journalisée) ; la clôture du dossier exige le **retrait du titre foncier** ; étape à justificatif : preuve obligatoire. « Terminé » ne signifie pas « accordé » : la décision de l'administration (certificat, titre) se prouve par le document officiel reçu.
**Preuve** : événement « Dossier ouvert » ; événement par changement de statut ; pièces jointes ; certificat foncier et titre foncier archivés au dossier. **Délais** : les délais indiqués sont des valeurs indicatives de l'ERP (total 618 jours), à ajuster dans Modèles de dossier ; la procédure ne fixe aucun délai, hors l'enquête villageoise d'un mois.

**Tableau des étapes de la procédure rurale** (31 étapes ; l'ERP ajoute « Création du dossier » au début et « Clôture » à la fin)

**Rural — Phase 1 : recherche, délimitation et levé de la parcelle**

| N° | Étape | Intervenants extérieurs | Exécute (ERP) | Valide | Justificatif | Visible souscripteur | Délai indicatif |
|---|---|---|---|---|---|---|---|
| 1 | Recherche de la parcelle rurale | Demandeur ou propriétaire | Service foncier | — | — | — | 30 j |
| 2 | Repérage et visite de la parcelle | Demandeur ou propriétaire ; Propriétaires terriens (famille) | Service foncier | — | — | — | 7 j |
| 3 | Démarche coutumière | Demandeur ou propriétaire ; Chef de village ou sachants du village ; Propriétaires terriens (famille) | Service foncier | Direction | oui | — | 14 j |
| 4 | Délimitation de la parcelle | Géomètre-expert ou professionnel habilité ; Propriétaires terriens (famille) ; Voisins de la parcelle | Technique et aménagement | — | — | — | 7 j |
| 5 | Levé topographique | Géomètre-expert ou professionnel habilité | Technique et aménagement | — | oui | — | 14 j |

**Rural — Phase 2 : enquête foncière et accord des propriétaires terriens**

| N° | Étape | Intervenants extérieurs | Exécute (ERP) | Valide | Justificatif | Visible souscripteur | Délai indicatif |
|---|---|---|---|---|---|---|---|
| 6 | Enquête foncière | Demandeur ou propriétaire ; Direction départementale ou régionale de l'agriculture (DD / DR) | Service foncier | — | — | — | 21 j |
| 7 | Établissement du ou des procès-verbaux de famille | Propriétaires terriens (famille) | Juridique et conformité | — | oui | — | 14 j |
| 8 | Enquête sur le procès-verbal de famille auprès de la chefferie et des sachants | Chef de village ou sachants du village ; Propriétaires terriens (famille) | Juridique et conformité | — | oui | — | 14 j |
| 9 | Intervention du commissaire de justice : consolidation des déclarations des propriétaires terriens et désignation du représentant légal (le gestionnaire) | Commissaire de justice ; Propriétaires terriens (famille) | Juridique et conformité | Direction | oui | — | 14 j |
| 10 | Convention notariée suivie du versement de la donation (compensation en nature) | Notaire (ou professionnel habilité pour la mutation) ; Propriétaires terriens (famille) ; Demandeur ou propriétaire | Juridique et conformité | Direction | oui | oui | 30 j |

**Rural — Phase 3 : enquête villageoise et certificat foncier (agriculture)**

| N° | Étape | Intervenants extérieurs | Exécute (ERP) | Valide | Justificatif | Visible souscripteur | Délai indicatif |
|---|---|---|---|---|---|---|---|
| 11 | Achat de deux liasses (une ou plusieurs pour les propriétaires terriens, une pour la société) | Demandeur ou propriétaire ; Direction départementale ou régionale de l'agriculture (DD / DR) | Assistance et courrier | — | oui | — | 7 j |
| 12 | Renseignement des liasses et dépôt à l'agriculture pour l'ouverture de l'enquête | Demandeur ou propriétaire ; Direction départementale ou régionale de l'agriculture (DD / DR) | Service foncier | — | oui | oui | 7 j |
| 13 | Nomination d'un commissaire enquêteur par le DD ou le DR de l'agriculture | Direction départementale ou régionale de l'agriculture (DD / DR) ; Commissaire enquêteur nommé par l'agriculture | Service foncier | — | oui | — | 30 j |
| 14 | Paiement des frais d'ouverture d'enquête par dossier à l'agriculture | Demandeur ou propriétaire ; Direction départementale ou régionale de l'agriculture (DD / DR) | Finance et comptabilité | — | oui | — | 7 j |
| 15 | Paiement des frais de siège du comité villageois | Demandeur ou propriétaire ; Comité villageois (comité foncier) | Finance et comptabilité | — | oui | — | 7 j |
| 16 | Ouverture de l'enquête villageoise auprès du chef de village, du comité foncier et des agents de l'agriculture (durée : un mois à compter de l'ouverture) | Commissaire enquêteur nommé par l'agriculture ; Chef de village ou sachants du village ; Comité villageois (comité foncier) ; Direction départementale ou régionale de l'agriculture (DD / DR) | Service foncier | — | oui | oui | 30 j |
| 17 | Délimitation et bornage exécutés par le géomètre expert (par son topographe) | Géomètre-expert ou professionnel habilité | Technique et aménagement | — | oui | — | 14 j |
| 18 | Clôture de l'enquête avec confirmation des limites en présence des voisins | Commissaire enquêteur nommé par l'agriculture ; Voisins de la parcelle ; Géomètre-expert ou professionnel habilité | Service foncier | — | oui | — | 7 j |
| 19 | Règlement des frais de déplacement des voisins | Demandeur ou propriétaire ; Voisins de la parcelle | Finance et comptabilité | — | oui | — | 7 j |
| 20 | Traitement du dossier par l'agriculture, en attente de validation (s'il n'y a pas d'opposition) | Direction départementale ou régionale de l'agriculture (DD / DR) | Service foncier | — | — | — | 60 j |
| 21 | Réunion de validation sous la présidence du sous-préfet | Sous-préfet ; Direction départementale ou régionale de l'agriculture (DD / DR) ; Comité villageois (comité foncier) | Service foncier | — | oui | — | 30 j |
| 22 | Délivrance du certificat foncier | Direction départementale ou régionale de l'agriculture (DD / DR) ; Demandeur ou propriétaire | Service foncier | Direction | oui | oui | 30 j |
| 23 | Paiement des frais de publication au journal officiel | Demandeur ou propriétaire | Finance et comptabilité | — | oui | — | 15 j |

**Rural — Phase 4 : titre foncier (conservation foncière, cadastre, AFOR)**

| N° | Étape | Intervenants extérieurs | Exécute (ERP) | Valide | Justificatif | Visible souscripteur | Délai indicatif |
|---|---|---|---|---|---|---|---|
| 24 | Constitution du dossier de demande d'immatriculation (titre foncier) et dépôt à l'AFOR | Demandeur ou propriétaire ; AFOR — Agence foncière rurale | Service foncier | Direction | oui | oui | 15 j |
| 25 | Dossier transmis à la conservation foncière du chef-lieu | AFOR — Agence foncière rurale ; Conservation foncière (DGI) | Assistance et courrier | — | — | — | 15 j |
| 26 | Dossier transmis au cadastre pour le bornage contradictoire | Conservation foncière (DGI) ; Services du cadastre | Assistance et courrier | — | — | — | 15 j |
| 27 | Paiement des frais du bornage contradictoire | Demandeur ou propriétaire ; Services du cadastre | Finance et comptabilité | — | oui | — | 7 j |
| 28 | Dossier transmis à la conservation pour la création du titre foncier | Conservation foncière (DGI) | Service foncier | — | oui | oui | 60 j |
| 29 | Dossier transmis à l'AFOR | Conservation foncière (DGI) ; AFOR — Agence foncière rurale | Assistance et courrier | — | — | — | 15 j |
| 30 | Dossier transmis au ministère de l'agriculture pour validation du titre foncier | AFOR — Agence foncière rurale ; Ministère de l'agriculture | Service foncier | — | oui | — | 60 j |
| 31 | Retrait du titre foncier | Demandeur ou propriétaire ; AFOR — Agence foncière rurale | Assistance et courrier | Direction | oui | oui | 15 j |

---

## 4. Référentiel des numéros et preuves

| Préfixe | Objet | Généré par |
|---|---|---|
| DF-AAAA-NNN | Dossier foncier | Ouverture |
| MF-AAAA-NNN | Mission | Création de mission |
| NDF-AAAA-NNNN | Note de débours | Émission |
| COU-AAAA-NNNN | Courrier | Première action sur le courrier |
| DEC-AAAA-NNNN | Décharge de remise | Enregistrement de la remise |
| GM-AAAA-NNN | Groupe de mutation | Création du groupe |

Les preuves de référence sont : le **journal du dossier** (ajout seul), les **justificatifs** (avec source), les **pièces** versionnées, les **écritures** en brouillard puis validées, et les **courriers/décharges** référencés.

## 5. Check-lists

**À l'ouverture** : responsable ✔ · modèle appliqué ✔ · budget fixé ✔ · intervenants identifiés ✔ · contrats référencés ✔
**Avant d'envoyer une mission** : intervenant actif ✔ · livrables clairs ✔ · échéance réaliste ✔ · consignes relues ✔ · contrat ✔
**Avant d'émettre une note de débours** : frais comptabilisés ✔ · pièces justificatives présentes ✔ · TVA validée par l'expert-comptable ✔ · destinataire et échéance ✔
**Avant de clôturer** : panneau « Avant la clôture » sans point bloquant ✔ · décharge signée jointe ✔ · notes encaissées ✔ · statut foncier mis à jour ✔
**Revue trimestrielle** : accès ✔ · modèles ✔ · dérogations examinées ✔ · risques critiques traités ✔ · budgets dépassés expliqués ✔

## 6. Glossaire
- **Titre mère** : titre foncier de l'opération, dont dépendent les titres individuels.
- **Titre individuel** : titre du lot d'un souscripteur.
- **Dérogation** : passage outre une règle de l'ERP, avec motif, par le responsable, journalisée.
- **Note de débours** : refacturation au prix coûtant de frais avancés pour le souscripteur.
- **Brouillard** : écriture comptable créée mais pas encore validée.
- **P75** : durée sous laquelle 3 dossiers sur 4 se sont terminés ; sert aux échéances estimées.

## 7. Limites connues
- L'envoi des e-mails part de l'ERP (pas encore d'envoi serveur autonome) : les relances partent quand l'ERP est ouvert.
- Les textes des courriers, de la décharge et des modèles de mission sont des points de départ : à faire valider par un juriste et le service Foncier.
- La TVA des débours n'est pas ventilée sur la note de débours.
- Deux postes simultanément hors ligne ne sont comparés qu'après synchronisation.

## 8. Maintenance du manuel
Version, date et auteur sont à renseigner à chaque révision ; toute modification de procédure est validée par la direction et annoncée aux équipes. Revue annuelle, ou à chaque évolution majeure de l'ERP.

| Version | Date | Auteur | Modifications |
|---|---|---|---|
| 1.0 | À renseigner | À renseigner | Première édition |
| 1.1 | 25/10/2026 | À renseigner | PRO-19 : immatriculation d'une parcelle rurale (AFOR / agriculture), étapes repérées en bleu |
