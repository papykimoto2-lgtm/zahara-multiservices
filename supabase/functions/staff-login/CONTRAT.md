# staff-login — contrat reconstitué

**La source de cette Edge Function n'est dans aucun des deux dépôts.** Elle
tourne pourtant en production sur les deux instances : c'est elle qui ouvre la
session du personnel et délivre le jeton que les politiques RLS exigent.

C'est le même angle mort qui a coûté plusieurs heures sur `portal-login` : sans
la source, on ne peut ni auditer ni corriger, seulement deviner. Ce document
reconstitue le contrat **depuis le code qui l'appelle**, pour que la migration
RLS puisse démarrer sans attendre, et pour servir de référence de comparaison
quand la vraie source aura été récupérée.

Toutes les références renvoient à `index.html` (l'ERP), dont ce contrat est
déduit.

---

## 1. Récupérer la vraie source (à faire en premier)

Depuis un poste disposant de la CLI Supabase, pour **chaque** projet :

```bash
supabase login
supabase functions download staff-login --project-ref <ref_du_projet>
```

À défaut : tableau de bord Supabase ▸ Edge Functions ▸ `staff-login` ▸ le code
y est consultable et copiable.

Déposer le résultat ici même, à côté de ce fichier, puis **comparer les deux
instances entre elles** : rien ne garantit aujourd'hui qu'elles exécutent la
même version.

---

## 2. Contrat observé côté appelant

### Requête

`POST {SB_URL}/functions/v1/staff-login` — voir `staffLogin()`, index.html:25122

| | |
|---|---|
| En-têtes | `Content-Type: application/json`, `apikey: <clé anon>`, `Authorization: Bearer <sbAuth()>` |
| Corps | `{ "login": "...", "motdepasse": "..." }` |
| Délai client | 8 s, puis abandon (`AbortController`) |

`sbAuth()` renvoie le jeton du personnel s'il est encore valide, sinon la clé
anon — donc **cette fonction doit rester appelable avec la seule clé anon**,
sans quoi plus personne ne peut ouvrir de session.

### Réponse attendue en cas de succès

```json
{ "token": "<JWT>", "expires_in": 43200, "user": { ... } }
```

- `token` est obligatoire : son absence est traitée comme une erreur
  (« Réponse invalide », index.html:25142).
- `expires_in` est optionnel — **43200 s (12 h) est la valeur supposée par
  défaut** côté client, qui retire encore 60 s de marge (index.html:25143).
- `user` ne doit **pas** contenir `password_hash` ni `salt` : le client le
  sait et refait une lecture authentifiée de `pi_users` pour obtenir le hash
  réel quand il en a besoin (index.html:28637 et 28648).

Échec : tout statut non-2xx → « Identifiants refusés ». Aucun corps exploité.

### Effet de bord documenté

Après une première authentification serveur réussie, la fonction **migre
silencieusement le compte vers PBKDF2, 210 000 itérations** (index.html:28113).
Le client reproduit exactement cet algorithme (`pbkdf2Client`, index.html:28123)
pour que la vérification hors ligne continue de fonctionner. **Toute
modification du nombre d'itérations ou de l'algorithme côté serveur doit être
répercutée dans `pbkdf2Client`**, sinon les comptes migrés ne peuvent plus se
connecter hors ligne — panne déjà vécue en production.

### Champs de `pi_users` utilisés

| Champ | Usage |
|---|---|
| `login` | identifiant de connexion (`pi_users?login=eq.…`) |
| `password_hash` | PBKDF2-SHA256, 256 bits, en hexadécimal |
| `salt` | sel du hash (le champ s'appelle `salt`, pas `password_salt`) |
| `pwd_iter` | nombre d'itérations, 210 000 par défaut |
| `updated_at` | départage les doublons de login (le plus récent gagne) |
| `id`, `nom`, `role`, `division_id`, `actif` | projection renvoyée dans `user` |

---

## 3. La question ouverte — quel claim ?

**C'est le seul inconnu qui bloque la migration RLS.** Les politiques de
`pi_users` sont déjà actives et rejettent la clé anon (index.html:28624) : le
mécanisme fonctionne donc déjà de bout en bout. Mais le nom du claim que ces
politiques exigent n'est écrit nulle part côté client.

Deux façons de l'obtenir sans la source :

### a. Demander à la base (le plus fiable)

```sql
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'pi_users';
```

L'expression renvoyée dans `qual` contient littéralement le claim exigé — par
exemple `auth.jwt() ->> 'staff'` ou `auth.jwt() ->> 'role'`.

### b. Lire un jeton réel

Dans l'ERP, une session du personnel ouverte, console du navigateur :

```js
JSON.parse(atob(JSON.parse(localStorage.sb_staff).token.split('.')[1]))
```

Affiche la charge utile du JWT, donc tous les claims réellement émis.

**Croiser les deux** : ce que la politique exige doit correspondre à ce que le
jeton porte. Un écart expliquerait des blocages intermittents.

### Pourquoi ça ne peut pas être `role: authenticated` seul

Les jetons du portail (`portal-login`) portent eux aussi
`role: "authenticated"`. Une politique qui se contenterait de ce claim
laisserait **un souscripteur lire `pi_users`**. Le claim distinctif doit donc
être vérifié — et si l'audit montre qu'il ne l'est pas, c'est une faille à
traiter avant tout le reste, pas une étape de la migration.

---

## 4. À vérifier avant la phase 2

- [ ] Source récupérée sur les deux projets, et identique entre eux
- [ ] Claim exigé par les politiques `pi_users` identifié (§3a)
- [ ] Claim réellement émis par le jeton identifié (§3b)
- [ ] Les deux correspondent
- [ ] Durée de validité réelle du jeton confirmée (le client suppose 12 h)
- [ ] Nombre d'itérations PBKDF2 confirmé identique à `pbkdf2Client`
