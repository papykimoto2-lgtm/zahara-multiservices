# Manuel de procédures — Relances clients

**Réf.** PRO-REL · **Version** 1.1 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi, dans quel ordre et avec quelle preuve pour relancer les souscripteurs en retard, de l'alerte à la mise en demeure et à la résiliation.
**Principe directeur** : la relance est graduée selon le retard réel, tracée et escaladée au juridique dès la mise en demeure.

> Les noms de boutons sont ceux du module **Relances Clients** de l'ERP.

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Commercial / recouvrement** | Relance, appelle, consigne l'échange |
| **Comptabilité** | Vérifie que les versements sont à jour avant toute relance |
| **Direction** | Décide de la mise en demeure et de la résiliation |
| **Juridique** | Suit le dossier contentieux ouvert automatiquement |

## 2. Règles d'or

1. Vérifier le **dernier versement** avant de relancer : ne jamais relancer un souscripteur à jour.
2. Les souscripteurs **soldés** et en **financement bancaire** n'apparaissent jamais en retard.
3. Le **niveau** suit le retard : il ne se choisit pas.
4. Toute relance envoyée est **journalisée** ; la mise en demeure ouvre un dossier juridique.

## 3. Calcul du retard

1. Attendu = apport + mois écoulés × mensualité, plafonné au montant total (point de départ : date de début, à défaut date de souscription).
2. Montant dû = attendu − versé (hors frais de souscription).
3. Retard en mois = montant dû ÷ mensualité, arrondi.

| Retard | Niveau | Action |
|---|---|---|
| < 2 mois | 💬 Rappel simple | SMS ou appel |
| 2 mois | 📧 Lettre de relance | Lettre |
| 3 mois | ⚖️ Mise en demeure | Lettre + dossier juridique |
| 6 mois et plus | 🚫 Résiliation | Décision de la direction |

## 4. Procédures

### REL-01 — Consulter les retards

**Où** : **Relances Clients**.

1. **Actualiser la liste**.
2. Lire les 4 compteurs par niveau ; cliquer pour filtrer, ou utiliser les onglets.
3. Rechercher par nom, téléphone ou dossier.
4. Lire pour chaque ligne : programme et lot, retard, montant dû, niveau, **dernière relance**.
5. Lire le **taux de cotisation** : part du prix du bien déjà versée (hors frais de souscription). Il situe l'effort du souscripteur à côté de son retard.
6. **Trier** la liste par programme et lot, par nombre de mois de retard, par montant dû ou par taux de cotisation (cliquer sur l'en-tête de colonne ou le tri proposé).
7. **🖨 Imprimer l'état** : imprime la liste telle qu'affichée (onglet, recherche et tri en cours) pour une réunion de recouvrement.

### REL-02 — Relancer un souscripteur

**Qui** : commercial. **Où** : ligne › **📨 Relancer**.

1. Le niveau et le message préparé s'affichent (nom, retard, montant dû).
2. Adapter le texte.
3. Envoyer par **SMS** ou **WhatsApp** (boutons dans la fenêtre).
4. Cliquer **Envoyer** : la relance est **enregistrée** (date, texte).

### REL-03 — Lettre de relance ou mise en demeure

**Où** : ligne › **📄 Lettre PDF**.

1. Générer la lettre correspondant au niveau.
2. Faire signer par la direction ; remettre ou envoyer contre accusé.
3. Classer l'accusé au dossier du souscripteur.

### REL-04 — Escalade au juridique

**Automatique** : dès la relance enregistrée avec **3 mois ou plus** de retard, l'ERP crée ou met à jour un **dossier contentieux** (niveau 2 à 3 mois, niveau 3 à 6 mois et plus) avec montant et retard.

1. Juridique : ouvrir le dossier, fixer les échéances de procédure.
2. Direction : décider de la suite (échéancier amiable, résiliation).

### REL-05 — Résiliation

**Qui** : direction. Procédure SOU-13 du manuel d'enregistrement : motif, taux de remboursement, retenue, libération des lots, commissions.

### REL-06 — Clôturer une relance

1. Dès que le souscripteur régularise, le versement (PAI-01) le sort de la liste au prochain calcul.
2. Consigner l'échange (promesse, échéancier convenu) dans le suivi du souscripteur.

## 5. Contrôles

| Contrôle | Effet |
|---|---|
| Souscripteur soldé ou financement bancaire | Jamais en retard |
| Relance à 3 mois et plus | Dossier juridique créé ou mis à jour |
| Dernière relance | Affichée pour éviter les doublons de contact |
| Taux de cotisation | Affiché et triable, hors frais de souscription |

## 6. Traçabilité

| Événement | Conservé dans |
|---|---|
| Relance envoyée | Table des relances (date, texte) |
| Mise en demeure et résiliation | Dossier juridique du souscripteur |
| Régularisation | Versement (journal d'audit) |

## 7. RACI

| Procédure | Commercial | Comptabilité | Direction | Juridique |
|---|---|---|---|---|
| REL-01 Retards | R | C | I | – |
| REL-02 Relance | R | C | I | – |
| REL-03 Lettre | R | – | A | – |
| REL-04 Escalade | I | – | A | R |
| REL-05 Résiliation | C | C | A/R | C |

## 8. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| Souscripteur absent de la liste | Soldé, financement bancaire ou date de début absente | Vérifier la fiche |
| Retard surestimé | Versement non enregistré ou saisi en frais de souscription | Corriger le versement |
| Pas de dossier juridique | Retard inférieur à 3 mois | Normal |
| Même client relancé deux fois | Dernière relance non consultée | Lire la colonne « Dernière relance » |

## 9. Liste de contrôle

1. ☐ Versements à jour vérifiés
2. ☐ Niveau conforme au retard
3. ☐ Message adapté et envoyé
4. ☐ Relance enregistrée
5. ☐ Lettre signée et accusé classé (niveaux 2 et plus)
6. ☐ Direction informée à partir de la mise en demeure

## 10. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
| 1.1 | Octobre 2026 | Taux de cotisation, tris (programme, mois de retard, montant dû, taux), impression de l'état |
