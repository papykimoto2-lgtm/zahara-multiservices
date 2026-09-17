/* Zahara MultiServices — service worker de l'espace client.

   [CORRECTIF — COQUILLE JAMAIS MISE EN CACHE]
   cache.addAll() rejette EN BLOC dès qu'une seule entrée échoue, et l'erreur
   partait dans le vide : un fichier renommé ou absent suffisait à ce que rien
   du tout ne soit précaché, l'installabilité ne tenant plus que par le
   manifeste. Les entrées sont désormais ajoutées une par une, et la console
   nomme celle qui manque.

   [CORRECTIF — LANCEMENT HORS LIGNE]
   L'application installée démarre sur /portail-unique.html?pwa=1 (start_url du
   manifeste), alors que la coquille est mise en cache sous /portail-unique.html.
   Sans ignoreSearch, l'entrée exacte était manquée à chaque lancement sans
   réseau et l'application s'ouvrait sur l'erreur du navigateur. Les navigations
   retombent donc sur la coquille.

   Les données ne sont JAMAIS mises en cache : seule la coquille statique
   ci-dessous est interceptée. Tout le reste — Supabase, API, polices, images
   distantes — va au réseau. Mieux vaut une erreur franche qu'un solde, un
   échéancier ou une liste de versements figés à une consultation antérieure. */

var CACHE_NAME = 'zahara-portail-v2';
var APP_SHELL = [
  '/portail-unique.html',
  '/manifest.json',
  '/icons/favicon-32.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png'
];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      /* Une requête par entrée : un 404 isolé ne doit pas emporter les autres. */
      return Promise.all(APP_SHELL.map(function (url) {
        return cache.add(url).catch(function () {
          console.warn('[sw] coquille — fichier introuvable, ignoré :', url);
        });
      }));
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  var estCoquille = APP_SHELL.indexOf(url.pathname) !== -1 || url.pathname === '/';

  /* Navigation : réseau d'abord, repli sur la coquille si le réseau manque. */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        if (estCoquille && res && res.ok) {
          var copie = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(req, copie); }).catch(function () {});
        }
        return res;
      }).catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (cached) {
          return cached || caches.match('/portail-unique.html');
        });
      })
    );
    return;
  }

  if (!estCoquille) return;

  event.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var copie = res.clone();
        caches.open(CACHE_NAME).then(function (c) { c.put(req, copie); }).catch(function () {});
      }
      return res;
    }).catch(function () {
      return caches.match(req);
    })
  );
});
