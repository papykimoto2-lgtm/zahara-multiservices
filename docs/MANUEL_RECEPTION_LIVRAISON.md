# Manuel de procédures — Réception des travaux et livraison des biens

**Réf.** PRO-REC · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour réceptionner les travaux des constructeurs, livrer les biens aux souscripteurs soldés et suivre garanties et service après-vente.
**Principe directeur** : on ne livre qu'un souscripteur soldé ; chaque réception et chaque livraison donne lieu à un procès-verbal avec réserves tracées ; les garanties courent à compter de la date de livraison.

> Les noms de boutons sont ceux du module **Réception & Livraison** (onglets Réceptions de travaux, À livrer, Livraisons souscripteurs, Dossiers de réception, Garanties & SAV).

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Responsable travaux** | Réceptionne les travaux, recense et suit les réserves |
| **Service livraison** | Prépare et réalise la livraison, tient les dossiers |
| **Direction** | Valide la réception définitive et la libération des retenues de garantie |
| **Comptabilité** | Confirme le solde du souscripteur ; règle les retenues libérées |
| **Souscripteur** | Signe le PV de livraison, formule ses réserves |

## 2. Règles d'or

1. **Souscripteur soldé** avant toute livraison (voir manuel Paiements et Attestation de solde).
2. Un terrain n'a **pas de réception de travaux** ; un logement attend la réception des travaux de son programme.
3. Toute réserve est **écrite**, suivie, puis **levée** avec preuve.
4. La réception **définitive** et la libération de la retenue de garantie passent par la **validation de la hiérarchie**.
5. Les remises de clés et les relevés de compteurs figurent au PV de livraison.

## 3. Procédures

### REC-01 — Réception des travaux

**Qui** : responsable travaux. **Où** : Réceptions de travaux.

| Champ | Règle |
|---|---|
| **Convention** | Obligatoire : reprend le constructeur et le programme |
| **Type** | Provisoire ou **définitive** |
| Date | Par défaut le jour |
| **Réserves** | Libellé de chaque défaut constaté ; état levée ou en cours |
| **Retenue de garantie** | Montant et date de libération prévue |
| Observations | Constat contradictoire |

1. Enregistrer : numéro attribué automatiquement. Une réception **provisoire** est « enregistrée » ; une définitive est « brouillon ».
2. **Imprimer** le procès-verbal de réception, à signer par le maître d'ouvrage et le constructeur.
3. Suivre les réserves jusqu'à leur levée.

### REC-02 — Réception définitive

1. Vérifier que toutes les réserves sont levées.
2. **Soumettre** le PV définitif : une demande part dans le menu **Validations** (statut « en attente de validation »).
3. La hiérarchie (administrateur ou gérant) valide ou rejette dans le menu Validations.

### REC-03 — Libération de la retenue de garantie

1. Contrôler la date de libération prévue et l'absence de réserve ouverte.
2. **Demander la libération** : une demande part en Validations avec le montant de la retenue.
3. Après validation, la comptabilité règle le constructeur.

**[blocage]** Aucune retenue renseignée : « aucune retenue à libérer ».

### REC-04 — Souscripteurs à livrer

**Qui** : service livraison. **Où** : **À livrer (soldés)**.

1. La liste reprend les souscripteurs **soldés** qui n'ont pas encore de livraison (case pour afficher aussi les livrés) ; filtres : programme, nature (terrain, logement), recherche, points à vérifier.
2. Lire pour chacun : dossier, programme, lots, réception des travaux (sans objet pour un terrain ; aucune, provisoire ou définitive), prix, versé, dernier versement, attestation de solde.
3. **Points à vérifier** signalés : réception des travaux à faire ; nature du bien à préciser ; trop-perçu ; lot non attribué ; programme non renseigné ; date du dernier versement postérieure à aujourd'hui.
4. Lever chaque point, puis cliquer **Livrer** : une livraison s'ouvre avec le souscripteur, son bien et son programme.

### REC-05 — Livraison au souscripteur

**Où** : **🔑 Livraison souscripteur**.

| Champ | Règle |
|---|---|
| **Souscripteur** | Obligatoire ; le lot et le programme se reprennent de sa fiche |
| N° | LIV-AAAA-NNN, automatique |
| Type | Provisoire ou définitive |
| Date | Par défaut le jour |
| Compteurs eau et électricité, clés remises | Relevés à la remise |
| État des lieux | Constat contradictoire |
| **Réserves** | Réserves de l'acquéreur, levées au fur et à mesure |
| **Signé** | Case cochée à la signature (date enregistrée) |
| Publier au portail | Le souscripteur retrouve son PV dans son espace |

1. Enregistrer ; **imprimer** le PV de livraison en deux exemplaires, à signer par le promoteur et le souscripteur.
2. Cocher « signé » ; publier au portail si le souscripteur doit le consulter.

### REC-06 — Dossier de réception (5 étapes)

**Où** : Dossiers de réception. Un dossier par souscripteur.

| Étape | Contenu |
|---|---|
| 1. Pré-réception | Date, état des lieux interne |
| 2. Visite de réception | Date de visite, réserves du souscripteur |
| 3. Levée des réserves | Chaque réserve est ouverte, traitée (à valider), levée validée ou acceptée |
| 4. Réception définitive | Possible quand **toutes** les réserves sont levées |
| 5. Clôturé / suivi | Suivi après remise |

Gravité d'une réserve : mineure, majeure, bloquante. Le dossier peut être publié au portail.

### REC-07 — Garanties et service après-vente

**Où** : **Garanties & SAV**.

1. Chaque bien livré reçoit trois échéances à compter de la **date de livraison** : parfait achèvement (1 an), biennale (2 ans), **décennale** (10 ans). Une échéance dépassée s'affiche avec ✕.
2. **Ouvrir le SAV** d'une livraison : ajouter, modifier et clore des **tickets** (défaut signalé, traité, clos).
3. Suivre le nombre de tickets ouverts ; traiter dans le délai de la garantie concernée ; informer le constructeur responsable.

## 4. Contrôles

| Contrôle | Effet |
|---|---|
| Convention absente | Réception refusée |
| Souscripteur absent | Livraison refusée |
| Réserve ouverte | Réception définitive impossible (dossier) |
| Aucune retenue | Libération refusée |
| Aucune réception de travaux pour un logement | Alerte sur la liste « À livrer » |
| Livraison supprimée | Confirmation |

## 5. Traçabilité

| Événement | Conservé dans |
|---|---|
| Réception | Réceptions de travaux (réserves, retenue, validation) |
| Livraison | Livraisons (compteurs, clés, réserves, signature) |
| Dossier de réception | Dossiers (étape, réserves, dates) |
| SAV | Tickets rattachés à la livraison |

## 6. RACI

| Procédure | Resp. travaux | Service livraison | Direction | Comptabilité |
|---|---|---|---|---|
| REC-01 Réception | R | I | I | – |
| REC-02 Définitive | R | I | A | – |
| REC-03 Retenue | C | – | A | R |
| REC-04/05 Livraison | C | R | I | C |
| REC-06 Dossier | C | R | I | – |
| REC-07 SAV | C | R | I | – |

## 7. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| Souscripteur absent de « À livrer » | Non soldé, résilié ou déjà livré | Vérifier le solde et la case « livrés » |
| « Réception des travaux à faire » | Aucune réception pour le programme | Enregistrer la réception (REC-01) |
| Trop-perçu signalé | Versement en trop | Régulariser avec la comptabilité |
| Garantie affichée dépassée | Date de livraison ancienne | Vérifier la date ; informer le souscripteur |

## 8. Liste de contrôle

1. ☐ Souscripteur soldé, attestation validée
2. ☐ Réception des travaux enregistrée (logement)
3. ☐ Points à vérifier levés
4. ☐ PV de livraison signé, compteurs et clés notés
5. ☐ Réserves suivies jusqu'à leur levée
6. ☐ SAV ouvert si besoin

## 9. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
