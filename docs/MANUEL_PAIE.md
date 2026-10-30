# Manuel de procédures — Paie et déclarations sociales

**Réf.** PRO-PAIE · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi, dans quel ordre et avec quelle preuve pour établir la paie mensuelle, la comptabiliser, payer le personnel et déclarer la CNPS et l'ITS.
**Principe directeur** : le bulletin se calcule depuis la fiche employé et le pointage, jamais à la main ; les montants du livre de paie, de la comptabilité et des déclarations viennent des mêmes bulletins.

> Les noms de boutons sont ceux des modules **Paie & Bulletins**, **Livre de Paie** et **Déclarations Sociales & Fiscales**. Les taux ci-dessous sont ceux du moteur de paie de l'ERP (Côte d'Ivoire, réforme ITS 2024) ; les valider chaque année avec l'expert-comptable.

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Gestionnaire de paie (RH)** | Contrôle les fiches et pointages, génère et vérifie les bulletins |
| **Comptabilité** | Comptabilise la paie, prépare les déclarations, suit les paiements |
| **Direction / gérant** | Valide les montants, autorise les virements |
| **Trésorerie** | Exécute les paiements (virement, Mobile Money, espèces) |

## 2. Règles d'or

1. **Fiche employé complète avant la paie** : salaire de base, catégorie, parts fiscales, statut CNPS, mode de paiement.
2. Le **statut CNPS** pilote l'exonération : « non déclaré » ou contrat « consultant » = aucune cotisation CNPS ni CMU sur le bulletin.
3. Un **consultant** se règle sur facture d'honoraires, pas sur bulletin.
4. Un seul bulletin par employé et par mois ; la régénération le remplace.
5. La paie d'un mois **comptabilisé** ne se régénère pas en place si les pièces sont visées ou l'exercice clos.
6. Saisir le **pointage** avant de générer la paie des modes pointage, journalier et horaire.

## 3. Règles de calcul (moteur de l'ERP)

| Élément | Règle |
|---|---|
| Base de proration | 30 jours calendaires |
| **Brut imposable** | Catégoriel + sursalaire + ancienneté + primes + logement + heures supplémentaires + excédent de transport |
| Transport | Exonéré jusqu'à 30 000 F ; excédent imposable et soumis CNPS |
| **CNPS retraite salarié** | 6,30 % du brut social, plafond 3 375 000 F |
| **ITS** | Barème mensuel : 0 % jusqu'à 75 000 ; 16 % à 240 000 ; 21 % à 800 000 ; 24 % à 2 400 000 ; 28 % à 8 000 000 ; 32 % au-delà |
| **RICF** | (parts − 1) × 11 000 F par mois, déduit de l'ITS (jamais négatif) |
| **CMU salarié** | 500 F par personne couverte |
| Charges patronales | Retraite 7,70 % ; accident du travail 5 % par défaut (taux propre à la division) ; prestations familiales 5,75 % (base plafonnée à 75 000 F) ; ITS patronal 1,20 % ; FDFP 0,4 % + 0,6 % + 0,6 % ; CMU 500 F |
| **Net à payer** | Brut total − (CNPS + ITS + CMU + retenues diverses + avances) |

## 4. Procédures

### PAI-01 — Préparer le mois

**Qui** : gestionnaire de paie. Avant la génération des bulletins.

1. Vérifier les fiches : salaire, catégorie, parts, enfants, statut CNPS, contrat, mode de paiement, coordonnées (banque, compte ou wallet).
2. Faire valider les **congés** et saisir le **pointage** du mois (manuel RH).
3. Saisir les **avances** et retenues diverses à imputer.

### PAI-02 — Générer les bulletins

**Où** : Paie & Bulletins › **⚡ Générer tous les bulletins**.

1. Choisir le **mois**.
2. Lire l'**aperçu** : un employé par ligne, net, anomalies.
3. Traiter chaque anomalie avant de valider :
   - salaire de base absent ;
   - aucun pointage saisi (brut **proratisé**, par exemple 120 000 devient 12 000) ;
   - consultant (facture attendue) ;
   - non déclaré CNPS (ITS retenu, cotisations exclues) ;
   - statut CNPS non renseigné ; net nul ou négatif.
4. **Générer** : les employés ayant déjà un bulletin ce mois sont signalés.

Pour un cas isolé : **+ Bulletin individuel** (employé, mois, gains, retenues) puis **Enregistrer**. La saisie manuelle retire la marque « issu du pointage ».

### PAI-03 — Contrôler

1. Onglet **Bulletins du mois** : lire chaque bulletin ; **Imprimer** le bulletin si besoin.
2. Onglet **Récapitulatif** : totaux du mois (bruts, retenues, net, charges).
3. Onglets spécialisés : **Journaliers & Temporaires** (paie à la quinzaine), **Simulateur Net → Brut** (brut correspondant à un net visé), **Non déclarés & Consultants** (régimes d'exonération).
4. La direction valide les totaux avant tout paiement.

### PAI-04 — Comptabiliser la paie

**Qui** : comptabilité. **Où** : Livre de Paie › **📒 Comptabiliser la paie du mois**.

1. Choisir le **mode** : global (une écriture agrégée) ou **détail** (une écriture par salarié, rattachée à sa division) ; cocher le règlement si le paiement est comptabilisé en même temps.
2. Avec plusieurs divisions, **préférer le détail** : le mode global rend les charges de personnel invisibles dans les états par division.
3. Confirmer. Un mois déjà comptabilisé demande confirmation avant régénération.
4. Un message part au groupe comptabilité.

**[bloquant]** Aucun employé actif ; comptabilisation par département alors que le mois l'est déjà en global (décomptabiliser d'abord) ; pièces visées ou exercice clos (contre-passer).

### PAI-05 — Payer le personnel

**Qui** : trésorerie, après accord de la direction. **Où** : Paie › **Ordres de virement**.

1. Lire par employé : coordonnées, montant net, mode (virement, Wave, Orange Money, MTN MoMo, espèces), état « prêt » ou « en attente ».
2. **Exporter** les ordres vers la banque ou l'opérateur.
3. Régler : banque par virement ; espèces par sortie de caisse validée ; Mobile Money selon l'opérateur.
4. Enregistrer le règlement en comptabilité.

### PAI-06 — Livre de paie

**Où** : Livre de Paie. Registre légal des salaires (CNPS, ITS, FDFP).

| Vue | Usage |
|---|---|
| Journal mensuel | Une ligne par salarié pour le mois |
| Récap. annuel | Cumuls de l'année |
| Fiche individuelle | Historique d'un salarié |
| Charges patronales | Détail CNPS, ITS, FDFP, CMU |

Imprimer et archiver le journal chaque mois.

### PAI-07 — Déclarer la CNPS et l'ITS

**Qui** : comptabilité. **Où** : Déclarations Sociales & Fiscales.

1. **Tableau de bord** : déclarations à faire, en retard, déposées.
2. Onglets **CNPS** et **ITS** : l'ERP reprend les masses et cotisations du mois depuis les bulletins ; une déclaration déjà **déposée ou payée** n'est pas écrasée.
3. **+ Nouvelle déclaration** (si manuelle) : type, période, **division déclarante** (obligatoire), montant, date limite, date de dépôt, statut, référence, mode de paiement.
4. Statuts : brouillon → validée → **déposée** → **payée**.
5. **Télédéclaration** : après le dépôt, saisir la référence et la date de dépôt sur la déclaration.
6. Une déclaration au brouillon ou validée dont la date limite est dépassée alimente le **badge de retard**.
7. **DAS annuelle** : à produire en fin d'exercice depuis l'onglet dédié.

### PAI-08 — Clôturer le mois

1. Bulletins imprimés ou transmis aux salariés.
2. Paie comptabilisée et réglée.
3. Déclarations déposées, référence saisie.
4. Journal de paie archivé.

## 5. Contrôles et blocages

| Contrôle | Effet |
|---|---|
| Mois ou employé absent | Bulletin refusé |
| Pointage manquant (modes pointage, journalier, horaire) | Brut proratisé, anomalie signalée |
| Consultant / non déclaré | Exonération CNPS et CMU |
| Division absente sur une déclaration | Refusée |
| Déclaration déposée ou payée | Non écrasée |
| Pièces de paie visées ou exercice clos | Régénération refusée |

## 6. Traçabilité

| Événement | Conservé dans |
|---|---|
| Bulletin | Table des bulletins (mois, employé, détail du calcul) |
| Comptabilisation | Écritures de paie (marque du mois et du département) |
| Déclaration | Table des déclarations (référence, dates, statut) |
| Message de comptabilisation | Groupe messagerie comptabilité |

## 7. RACI

| Procédure | RH | Comptabilité | Direction | Trésorerie |
|---|---|---|---|---|
| PAI-01 Préparation | R | I | – | – |
| PAI-02 Bulletins | R | C | I | – |
| PAI-03 Contrôle | R | C | A | – |
| PAI-04 Comptabilisation | C | R | I | – |
| PAI-05 Paiement | I | C | A | R |
| PAI-07 Déclarations | C | R | A | I |

## 8. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| Brut très inférieur au salaire | Pointage absent, prorata | Saisir le pointage, régénérer |
| CNPS prélevée sur un consultant | Statut mal renseigné | Corriger la fiche, régénérer |
| Net nul | Retenues ou avances supérieures au brut | Revoir les retenues |
| Charges absentes des états par division | Mode global | Régénérer en détail |
| Comptabilisation par département refusée | Mois déjà comptabilisé en global | Décomptabiliser d'abord |
| Déclaration en retard | Date limite dépassée | Déposer, saisir la référence |

## 9. Liste de contrôle mensuelle

1. ☐ Fiches, congés et pointages à jour
2. ☐ Anomalies de l'aperçu traitées
3. ☐ Bulletins contrôlés et totaux validés
4. ☐ Paie comptabilisée (détail si plusieurs divisions)
5. ☐ Ordres de virement exécutés
6. ☐ CNPS et ITS déclarées, références saisies
7. ☐ Livre de paie archivé

## 10. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
