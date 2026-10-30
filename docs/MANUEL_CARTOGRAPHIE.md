# Manuel de procédures — Cartographie & SIG

**Réf.** PRO-SIG · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour dessiner, importer, fusionner, découper et exploiter les parcelles et les couches d'aménagement sur la carte.
**Principe directeur** : la carte est le **plan de référence** du foncier ; toute modification de géométrie est faite **dans l'outil**, jamais par recopie extérieure.

> Les noms de boutons sont ceux de la page **Cartographie & SIG**.

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Géomaticien / cartographe** | Dessine, importe, fusionne, découpe, tient les couches |
| **Responsable foncier** | Valide statuts et affectations des parcelles |
| **Responsable aménagement** | Suit l'avancement des tronçons de voirie et de réseaux |
| **Direction** | Consulte colorations thématiques et rapport parcellaire |

## 2. Règles d'or

1. Chaque parcelle porte une **référence** et un **statut** : prospection, disponible, acquis, en litige, vendu, aménagé.
2. Une **fusion** exige au moins **2 parcelles** avec polygone ; si elles ne sont pas adjacentes, seule la plus grande zone est conservée.
3. Un **découpage** exige une ligne tracée **de bord en bord** de la parcelle.
4. Une orthophoto ne dépasse pas **15 Mo**.
5. Une simulation d'aménagement ne crée rien tant qu'elle n'est pas **matérialisée**.

## 3. Procédures

### SIG-01 — Choisir fond et affichage

1. Choisir le fond : OpenStreetMap, satellite, hybride ou relief.
2. Filtrer par statut ; choisir la coloration : statut, valeur estimée ou prix au m².
3. Activer ou masquer les couches : parcelles, étiquettes, orthophotos, carte de chaleur.

### SIG-02 — Dessiner une parcelle

1. Cliquer **Dessiner parcelle**, poser les points, terminer le tracé.
2. La parcelle reçoit une référence (ou la géométrie est rattachée à une parcelle existante) et sa surface est calculée en hectares.
3. Passer par la fiche de la parcelle pour corriger référence, statut et affectation.

### SIG-03 — Importer

1. **Import GeoJSON/KML/GPX** : les polygones exploitables deviennent des parcelles, le statut du fichier est repris s'il existe.
2. **Import plan de masse DXF** : plan géoréférencé (lots, voirie, courbes).
3. **Positionner les lots** : placer les lots sans coordonnées.
4. Aucun polygone exploitable : l'import est refusé avec un message.

### SIG-04 — Fusionner des parcelles

1. Activer le mode sélection, cocher au moins 2 parcelles.
2. Lancer **Fusionner** ; saisir la référence (sinon attribuée automatiquement).
3. Contrôler la surface résultante.

### SIG-05 — Découper une parcelle

1. Activer le découpage, choisir la parcelle, tracer la ligne de bord en bord.
2. Les nouvelles parcelles reçoivent la référence d'origine suffixée A, B, C…
3. Message d'erreur si la ligne ne traverse pas entièrement ou ne sépare pas en deux parties.

### SIG-06 — Couches d'aménagement

1. Choisir le type : voirie, réseau, servitude (lignes), zone à risque, espace vert (surfaces), annotation.
2. **Tracer** puis terminer ; renseigner libellé, statut des travaux, avancement, prix et coût réel.
3. Modifier ou supprimer un élément (confirmation).

### SIG-07 — Orthophotos et mesures

1. Ajouter une orthophoto (image + deux points de calage) ; régler l'opacité pour comparer avant / après.
2. **Mesurer** distances et surfaces ; **Ma position** pour se situer sur le terrain.

### SIG-08 — Simuler un aménagement

1. Choisir la parcelle, définir la trame (taille de lots, prix).
2. Lancer la simulation ; ajuster si « trame trop fine » ou « aucun lot exploitable ».
3. **Matérialiser** : crée le programme et ses lots (statut disponible) et passe la parcelle à « aménagé » avec une ligne d'historique.

### SIG-09 — Exporter

1. **Export GeoJSON** pour un usage externe.
2. **Rapport parcellaire** et **plan cadastral PDF** d'une parcelle pour les dossiers.

## 4. Traçabilité

Les changements de statut et d'aménagement sont inscrits à l'historique de la parcelle.

## 5. RACI

| Étape | Cartographe | Foncier | Aménagement | Direction |
|---|---|---|---|---|
| SIG-02/03/04/05 | R | A | I | I |
| SIG-06 | R | C | A | I |
| SIG-08 | R | C | C | A |
| SIG-09 | R | I | I | I |

## 6. Erreurs fréquentes

- Fusionner des parcelles non adjacentes sans contrôle.
- Ligne de découpe qui s'arrête dans la parcelle.
- Matérialiser une simulation non validée.
- Importer sans vérifier les statuts repris du fichier.

## 7. Liste de contrôle

- [ ] Toute parcelle a référence, statut, surface
- [ ] Surfaces après fusion ou découpage contrôlées
- [ ] Simulations validées avant matérialisation

## 8. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
