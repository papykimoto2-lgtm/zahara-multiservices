# Manuel de procédures — Accueil et visites

**Réf.** PRO-ACC · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour accueillir les visiteurs : enregistrement, badge, notification de l'hôte, rendez-vous, historique, liste noire, rapport journalier.
**Principe directeur** : tout visiteur est enregistré ; un visiteur sur liste noire déclenche une alerte ; l'hôte est prévenu dès l'arrivée.

> Les noms de boutons sont ceux du module **Accueil & Visites** (Aujourd'hui, Planning RDV, Historique, Statistiques, Liste noire).

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Accueil** | Enregistre visites et rendez-vous, remet le badge |
| **Hôte** | Reçoit le visiteur |
| **Sécurité / direction** | Tient la liste noire, valide les exceptions |

## 2. Règles d'or

1. **Nom du visiteur** obligatoire.
2. Un visiteur de la **liste noire** est signalé avant l'enregistrement ; passer outre demande une confirmation explicite.
3. L'hôte est **notifié** quand la visite est « en attente ».
4. Un rendez-vous exige **objet, nom du visiteur et date**.

## 3. Procédures

### ACC-01 — Enregistrer une visite

**Où** : **🚶 Enregistrer une visite**.

1. Saisir le nom du visiteur (obligatoire), l'hôte, le motif, la salle ; le **statut** : en attente, en cours, terminé, refusé.
2. Si le visiteur figure sur la **liste noire**, une alerte affiche le motif ; confirmer ou abandonner.
3. Enregistrer : un **numéro de badge** est attribué ; l'hôte est notifié si la visite est en attente.
4. Le statut du rendez-vous lié est mis à jour.

### ACC-02 — Rendez-vous

**Où** : Planning RDV › nouveau rendez-vous.

1. Saisir objet, nom du visiteur et date (obligatoires), heures, notes ; statut **planifié** ou **confirmé**.
2. Une confirmation WhatsApp peut être envoyée au visiteur.
3. À l'arrivée, enregistrer la visite (ACC-01).

### ACC-03 — Suivi du jour

**Où** : Aujourd'hui : visites en attente, en cours, terminées ; fermer chaque visite à la sortie.

### ACC-04 — Historique et statistiques

1. **Historique** : retrouver une visite par visiteur, date, hôte.
2. **Statistiques** : indicateurs de fréquentation.

### ACC-05 — Liste noire

**Où** : Liste noire : ajouter un visiteur avec **motif** ; consulter avant chaque accueil douteux ; lever sur décision de la direction.

### ACC-06 — Rapport journalier

À l'heure choisie, le rapport du jour part automatiquement une fois par jour dans la conversation « Accueil — Visiteurs & Hôtes » (réglage de l'heure dans les paramètres).

## 4. Contrôles

| Contrôle | Effet |
|---|---|
| Nom absent | Visite refusée |
| Visiteur en liste noire | Alerte + confirmation |
| Objet, nom ou date absent (RDV) | Rendez-vous refusé |

## 5. Traçabilité

| Événement | Conservé dans |
|---|---|
| Visite | Table des visites (badge, hôte, statut) |
| RDV | Table des rendez-vous |
| Liste noire | Table dédiée (motif) |

## 6. RACI

| Procédure | Accueil | Hôte | Direction |
|---|---|---|---|
| ACC-01 Visite | R | C | I |
| ACC-02 RDV | R | C | I |
| ACC-05 Liste noire | R | – | A |

## 7. Liste de contrôle quotidienne

1. ☐ Visites du jour enregistrées et clôturées
2. ☐ Rendez-vous confirmés
3. ☐ Alertes de liste noire traitées
4. ☐ Rapport journalier reçu

## 8. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
