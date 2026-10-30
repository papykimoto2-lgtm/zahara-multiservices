# Manuel de procédures — Système de management de la qualité (SMQ)

**Réf.** PRO-SMQ · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer comment l'entreprise tient son système qualité dans l'ERP : cartographie et fiches de processus, maîtrise des documents, non-conformités et actions correctives, réclamations, satisfaction des clients.
**Principe directeur** : tout écart est **enregistré, analysé, corrigé, puis vérifié** ; aucune clôture sans preuve d'efficacité.

> Les noms de boutons sont ceux de **Paramètres › Qualité (SMQ)** et de **Paramètres › Manuels & flux › Cartographie des processus**. L'écriture est réservée aux rôles de niveau manager et administrateur ; les autres consultent.

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Direction** | Approuve les documents, clôture les non-conformités, désigne les pilotes |
| **Pilote de processus** | Suit les indicateurs et les écarts de son processus |
| **Responsable d'action** | Réalise l'action corrective dans l'échéance |
| **Auditeur / contrôleur** | Constate et enregistre les écarts |

## 2. Règles d'or

1. Un processus a un **pilote** et un **suppléant** désignés.
2. Un document **approuvé** porte une version, un approbateur et une date d'approbation.
3. Le **rédacteur n'approuve pas seul** son document : une confirmation est demandée s'il est aussi approbateur.
4. Une non-conformité se clôture **uniquement** si la vérification d'efficacité conclut « Efficace ».
5. Une réclamation se clôture une fois la satisfaction du réclamant relevée.
6. Les suggestions de l'ERP (indicateurs, documents) sont **à valider** : elles ne comptent qu'une fois cochées « Validé ».

## 3. Procédures

### SMQ-01 — Renseigner la fiche d'un processus

**Où** : Manuels & flux › Cartographie › **✏️ Fiche**.

1. Désigner le **pilote** et son **suppléant**.
2. Définir les **indicateurs** : intitulé, mode de calcul, unité, fréquence, cible, source ; saisir le dernier relevé.
3. Lister le **système documentaire** : procédures, enregistrements, documents externes, avec support et durée de conservation.
4. **💡 Suggérer** propose des indicateurs et documents types ; cocher **Validé** pour ceux retenus ; fixer cibles et durées de conservation.
5. **Enregistrer**, puis **Imprimer** la fiche si besoin.

### SMQ-02 — Maîtriser un document

**Où** : Qualité (SMQ) › **Documents**.

1. Ouvrir la ligne du manuel (✏️).
2. Renseigner version, rédacteur, approbateur, date d'approbation, prochaine revue, diffusion.
3. Statut « approuvé » : approbateur et date obligatoires.
4. À chaque nouvelle version, indiquer le **motif** ; la version précédente est archivée dans l'historique.
5. Contrôler chaque mois les documents **dont la revue est dépassée**.

### SMQ-03 — Traiter une non-conformité

**Où** : Qualité (SMQ) › **Non-conformités** › **+ Non-conformité**.

1. **Constater** : processus, source (audit, réclamation, incident, contrôle), date, gravité, description ; l'action immédiate corrige l'effet.
2. **Lancer le traitement** : cause racine, action corrective, responsable et échéance obligatoires.
3. **Action réalisée** : date de réalisation obligatoire ; la non-conformité passe « à vérifier ».
4. **Vérifier l'efficacité** : date et résultat « Efficace » ou « Non efficace ».
5. **Clôturer** : possible seulement si « Efficace » ; sinon **Rouvrir le traitement** (le nombre de réouvertures est conservé).
6. Une non-conformité dont l'échéance est passée apparaît **En retard**.

### SMQ-04 — Traiter une réclamation

**Où** : Qualité (SMQ) › **Réclamations**.

1. Enregistrer : date, canal, client, objet, processus concerné.
2. **Prendre en charge** : responsable obligatoire.
3. **Marquer traitée** : réponse et date de réponse obligatoires.
4. **Clôturer** : satisfaction du réclamant relevée.
5. Si la cause est interne, **⚠️ Créer une NC** : la non-conformité est préremplie (source « Réclamation client »).

### SMQ-05 — Mesurer la satisfaction

**Où** : Qualité (SMQ) › **Satisfaction**.

1. Enregistrer chaque avis : note de 1 à 5, processus évalué, commentaire.
2. Lire la **note moyenne**, la part de clients satisfaits (4 ou 5) et la moyenne des six derniers mois.
3. Un avis bas appelle une réclamation ou une non-conformité.

## 4. Traçabilité

Chaque enregistrement porte sa référence (NC, RCL), son créateur et sa date ; chaque clôture, son auteur et sa date ; chaque document, son historique de versions.

## 5. RACI

| Étape | Direction | Pilote | Resp. d'action | Contrôleur |
|---|---|---|---|---|
| SMQ-01 | A | R | I | C |
| SMQ-02 | A | R | C | I |
| SMQ-03 | A | C | R | R |
| SMQ-04 | A | R | R | C |
| SMQ-05 | I | R | I | R |

## 6. Erreurs fréquentes

- Clôturer sans avoir mesuré l'efficacité de l'action.
- Traiter l'effet sans chercher la cause racine.
- Laisser une suggestion non validée dans la fiche et la croire retenue.
- Approuver un document sans date ni approbateur.
- Ne pas revoir les documents à leur échéance.

## 7. Liste de contrôle

- [ ] Chaque processus a un pilote et un suppléant
- [ ] Aucune non-conformité en retard
- [ ] Aucune réclamation sans responsable
- [ ] Documents à revoir traités

## 8. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
