# Manuel de procédures — Constructeurs et conventions de travaux

**Réf.** PRO-CNV · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour référencer les constructeurs, passer des conventions (marchés de travaux), les modifier par avenants, régler les situations de travaux, suivre les retenues de garantie et les cautions.
**Principe directeur** : aucun marché sans validation ; aucun paiement sans situation validée et sans constat d'avancement ; chaque dépassement du marché exige un avenant.

> Les noms de boutons sont ceux des modules **Registre des Constructeurs** et **Conventions de Constructeur** (onglets Liste, Avenants, Situations travaux, Retenues de garantie, Cautions). La réception des travaux est décrite dans le manuel PRO-REC.

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Responsable travaux** | Référence les constructeurs, rédige conventions, avenants, situations |
| **Direction / gérant** | Valide les conventions, avenants et situations |
| **Comptabilité** | Comptabilise les situations validées, règle les constructeurs |
| **Conformité** | Contrôle les sanctions (voir PRO-LBC) |

## 2. Règles d'or

1. Un constructeur est **référencé avant** toute convention (raison sociale obligatoire).
2. Une convention porte numéro et constructeur ; elle est **soumise à validation** avant exécution.
3. Une situation validée ou payée est **comptabilisée automatiquement** ; une situation en brouillon ne l'est pas.
4. Un cumul facturé au-delà du marché demande un **avenant**.
5. Un avancement facturé supérieur à l'avancement constaté sur le chantier est une **surfacturation apparente** : confirmation obligatoire.
6. La retenue de garantie est libérée **après la réception définitive**, sur validation.

## 3. Procédures

### CNV-01 — Référencer un constructeur

**Où** : Registre des Constructeurs › **+ Nouveau constructeur**.

| Champ | Règle |
|---|---|
| **Raison sociale** | Obligatoire |
| RCCM, NCC, agrément BTP, caution | Identité et qualification |
| Responsable, téléphone, e-mail, adresse | Contact |
| Spécialité, capacité, références, note (sur 5) | Évaluation |
| Banque, compte, mode et délai de paiement (30 jours par défaut) | Règlement |
| **Département interne** | Case à cocher : la société se facture alors à elle-même |

Le registre présente le statut du constructeur et ses **bilans de performance**.

### CNV-02 — Rédiger la convention

**Où** : Conventions › **+ Nouvelle convention**.

| Bloc | Champs |
|---|---|
| Identité | **N° convention et constructeur obligatoires**, programme, objet, maître d'ouvrage, description |
| Montants | HT, TVA (18 % par défaut), TTC |
| **Retenue de garantie** | 10 % par défaut |
| **Avance de démarrage** | 20 % par défaut |
| Pénalités de retard | 0,5 % par semaine par défaut |
| Planning | Date de signature, de démarrage, délai (12 mois par défaut), fin prévisionnelle |
| Règlement | Mode ; conditions de réception |

1. **Enregistrer en brouillon** ou **Soumettre à validation** (statut « en attente de validation »).
2. L'historique de la convention conserve création, modification et soumission.

### CNV-03 — Valider la convention

**Qui** : direction. **Où** : Validations.

1. Examiner la convention : constructeur, montants, retenue, avance, délais.
2. Décision : **approuver** (statut « signé »), **rejeter**, ou **demander une modification**, avec commentaire.
3. Valideur, date et commentaire sont conservés.
4. **Imprimer** la convention (visa, signatures des deux parties).

### CNV-04 — Avenant

**Où** : Avenants.

1. Choisir la convention et le numéro (obligatoires) ; saisir le montant supplémentaire HT et la TVA ; un délai supplémentaire repousse la fin prévisionnelle.
2. Soumettre à validation : approuvé = « signé ».
3. L'avenant couvre un surplus de travaux facturé au-delà du marché.

### CNV-05 — Situation de travaux

**Qui** : responsable travaux. **Où** : **+ Nouvelle situation**.

| Champ | Règle |
|---|---|
| **Convention, numéro, montant HT** | Obligatoires |
| Date, période, travaux réalisés | Constat |
| TVA, TTC, **avance à récupérer**, **retenue**, **net à payer** | Calculés ; ajustables |
| **Avancement facturé** et **avancement physique constaté** | Comparés |
| Mode de règlement, statut | Brouillon, validée, payée… |

1. Si le cumul facturé dépasse le marché : confirmation (avenant normalement requis).
2. Si l'avancement facturé dépasse l'avancement constaté : alerte « surfacturation apparente », l'acceptation est tracée au nom de l'utilisateur.
3. Statut **validée** ou **payée** : l'ERP passe les écritures.
4. L'avancement de la convention suit le **constat de chantier** s'il est renseigné, sinon le cumul facturé.

**Écritures** (constructeur externe, sous-traitance) : charge de travaux et TVA déductible au crédit du fournisseur ; **retenue de garantie** isolée en dette ; **récupération de l'avance** ; **règlement du net** si payée. Constructeur **interne** : la société se facture à elle-même (produit de travaux).

**[bloquant]** Convention, numéro ou montant absent ; compte par défaut manquant (le message nomme le paramètre).

### CNV-06 — Retenues de garantie

**Où** : Retenues de garantie.

1. Lire les retenues cumulées issues des situations validées ou payées.
2. À la réception définitive des travaux, **demander la libération** : une demande part en Validations (PRO-REC, REC-03).
3. Après validation, la comptabilité règle la retenue au constructeur.

### CNV-07 — Cautions

**Où** : Cautions, par convention.

1. **Ajouter** une caution : type (avance de démarrage 20 %, bonne exécution 5 %, retenue de garantie par substitution 5 %, soumission 2 %), montant proposé selon le marché, banque, référence, dates d'émission et de validité.
2. Suivre le statut : **active**, **expirée** (date de validité dépassée), **mainlevée**.
3. Prononcer la **mainlevée** à la fin de l'obligation.
4. Surveiller les cautions expirées dans la vue d'ensemble des cautions.

### CNV-08 — Tableau de bord des marchés

**Où** : **📊 Tableau de bord** de la page Conventions : avancement, écarts, reste à facturer, retenues, retards. À lire chaque semaine avec le suivi de chantier (PRO-CHA).

## 4. Contrôles

| Contrôle | Effet |
|---|---|
| Raison sociale absente | Constructeur refusé |
| N° ou constructeur absent | Convention refusée |
| Cumul facturé > marché | Confirmation ; avenant attendu |
| Facturé > constaté | Alerte de surfacturation, acceptation tracée |
| Situation brouillon | Pas d'écriture |
| Caution expirée | Signalée en rouge |

## 5. Traçabilité

| Événement | Conservé dans |
|---|---|
| Convention | Historique (création, modification, soumission, validation) |
| Validation | Valideur, date, commentaire |
| Situation | Table des situations + écritures SIT-, TVA-, RG-, AVR-, PAY- |
| Caution | Fiche de la convention |

## 6. RACI

| Procédure | Resp. travaux | Direction | Comptabilité |
|---|---|---|---|
| CNV-01 Constructeur | R | I | C |
| CNV-02/03 Convention | R | A | I |
| CNV-04 Avenant | R | A | I |
| CNV-05 Situation | R | A | R pour l'écriture |
| CNV-06 Retenue | C | A | R |
| CNV-07 Cautions | R | I | C |

## 7. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| Pas d'écriture après situation | Statut brouillon | Passer à validée ou payée |
| « Compte manquant » | Compte par défaut absent | Paramètres › Comptes par défaut |
| Cumul au-dessus du marché | Travaux supplémentaires | Établir un avenant |
| Avancement de la convention inchangé | Constat inférieur à l'existant | Vérifier le rapport de chantier |

## 8. Liste de contrôle

1. ☐ Constructeur référencé et non gelé
2. ☐ Convention validée avant démarrage
3. ☐ Cautions émises (avance, bonne exécution)
4. ☐ Situations contrôlées contre l'avancement constaté
5. ☐ Avenants signés pour tout surplus
6. ☐ Retenue libérée après réception définitive

## 9. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
