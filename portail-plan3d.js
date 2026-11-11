/* Portail souscripteur — plan 3D du lotissement.
   Chargé à la demande (onglet « Plan 3D »), après /vendor/three.r128.min.js.
   Confidentialité : le serveur (fc_vue_plan_lotissement) ne renvoie, pour les lots des autres, que le numéro, la surface,
   le contour et un statut réduit à « libre » ou « attribué ». Ce module n'affiche donc jamais de nom, de prix ni de paiement
   d'un autre souscripteur ; seul le dossier du souscripteur connecté (ctx.paiement) est détaillé.
   Mode public (ctx.mode === 'public', sans connexion) : les lots viennent des vues publiques déjà utilisées par la page Carte
   (numéro, surface, prix, statut disponible / réservé / vendu, contour) ; aucun « mon lot », aucun paiement. */
(function () {
  'use strict';
  var NF = new Intl.NumberFormat('fr-FR');
  var LABEL = { mon_lot: 'Votre lot', libre: 'Disponible', reserve: 'Réservé', attribue: 'Attribué', vendu: 'Vendu' };
  var HAUT = { libre: 1.2, reserve: 2, attribue: 2.6, vendu: 2.6, mon_lot: 7 };
  var HEX = { libre: '#2F7D5B', reserve: '#E0A100', attribue: '#8C887F', vendu: '#8C887F' };
  var ORDRE = ['libre', 'reserve', 'attribue', 'vendu', 'mon_lot'];
  var REDUIT = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(n) { return NF.format(Math.round(n || 0)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

  var CSS = [
    '.p3{display:grid;gap:14px}',
    '.p3-top{display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:8px 16px}',
    '.p3-top h4{margin:0;font-size:1.15rem;font-weight:800;letter-spacing:-.01em}',
    '.p3-top p{margin:2px 0 0;font-size:.82rem;color:#4b6a8b}',
    '.p3-tag{font-size:.7rem;letter-spacing:.05em;text-transform:uppercase;border:1px solid #cfdfed;background:#fff;border-radius:6px;padding:4px 8px;color:#4b6a8b}',
    '.p3-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#e3eaf2;border:1px solid #e3eaf2;border-radius:12px;overflow:hidden}',
    '.p3-kpis div{background:#fff;padding:10px 12px;min-width:0}',
    '.p3-kpis span{display:block;font-size:.66rem;letter-spacing:.05em;text-transform:uppercase;color:#4b6a8b}',
    '.p3-kpis b{display:block;font-size:1.1rem;font-weight:800;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}',
    '.p3-stage{position:relative;height:min(64vh,520px);min-height:360px;border:1px solid #e3eaf2;border-radius:16px;overflow:hidden;background:#eef2f4}',
    '.p3-stage canvas{display:block;width:100%;height:100%;touch-action:none;cursor:grab}',
    '.p3-stage canvas.g{cursor:grabbing}.p3-stage canvas.h{cursor:pointer}',
    '.p3-chips{position:absolute;top:10px;left:10px;right:64px;display:flex;flex-wrap:wrap;gap:6px}',
    '.p3-chip{display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,.9);border:1px solid #cfdfed;border-radius:999px;padding:5px 11px 5px 9px;font-size:.76rem;font-weight:600;color:#1e4663;cursor:pointer}',
    '.p3-chip i{width:10px;height:10px;border-radius:2px;background:var(--c)}',
    '.p3-chip[aria-pressed="false"]{opacity:.5}.p3-chip[aria-pressed="false"] i{background:transparent;border:1.5px solid var(--c)}',
    '.p3-chip.fixe{cursor:default}',
    '.p3-compass{position:absolute;top:10px;right:10px;width:48px;height:48px;pointer-events:none}',
    '.p3-bar{position:absolute;left:10px;right:10px;bottom:10px;display:flex;flex-wrap:wrap;gap:6px}',
    '.p3-btn{background:rgba(255,255,255,.92);border:1px solid #cfdfed;border-radius:8px;padding:7px 12px;font-size:.78rem;font-weight:600;color:#1e4663;cursor:pointer}',
    '.p3-btn:hover{border-color:#1e4663}.p3-btn.on{background:#1e4663;border-color:#1e4663;color:#fff}',
    '.p3-btn.pri{background:var(--pp-primary,#A6431C);border-color:var(--pp-primary,#A6431C);color:#fff}',
    '.p3-btn:focus-visible,.p3-chip:focus-visible{outline:2px solid #1e4663;outline-offset:2px}',
    '.p3-tip{position:absolute;pointer-events:none;background:#14202b;color:#fff;padding:5px 9px;border-radius:6px;font-size:.75rem;line-height:1.35;white-space:nowrap;opacity:0;transition:opacity .12s;z-index:3}',
    '.p3-tip.on{opacity:1}',
    '.p3-btn[disabled]{opacity:.6;cursor:default}',
    '.p3-attr{position:absolute;right:10px;top:64px;font-size:.66rem;color:#14202b;background:rgba(255,255,255,.8);padding:2px 7px;border-radius:5px;pointer-events:none}',
    '.p3-attr[hidden]{display:none}',
    '.p3-hint{position:absolute;left:12px;bottom:52px;font-size:.72rem;color:#4b6a8b;background:rgba(255,255,255,.8);padding:3px 8px;border-radius:5px;pointer-events:none}',
    '.p3-card{background:#fff;border:1px solid #e3eaf2;border-radius:16px;padding:16px;display:grid;gap:12px}',
    '.p3-card h5{margin:0;font-size:1rem;font-weight:800}',
    '.p3-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}',
    '.p3-pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:.74rem;font-weight:700;border:1px solid var(--c);color:#14202b;background:#fff}',
    '.p3-pill i{width:8px;height:8px;border-radius:50%;background:var(--c)}',
    '.p3-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:1px;background:#e3eaf2;border:1px solid #e3eaf2;border-radius:10px;overflow:hidden}',
    '.p3-facts div{background:#f7f9fb;padding:8px 10px}.p3-facts span{display:block;font-size:.66rem;text-transform:uppercase;letter-spacing:.05em;color:#4b6a8b}',
    '.p3-facts b{font-size:.9rem}',
    '.p3-pay{display:grid;grid-template-columns:92px minmax(0,1fr);gap:14px;align-items:center}',
    '.p3-ring{position:relative;width:92px;height:92px}.p3-ring svg{width:100%;height:100%;transform:rotate(-90deg)}',
    '.p3-ring b{position:absolute;inset:0;display:grid;place-items:center;font-size:1.25rem;font-weight:800}',
    '.p3-am{display:grid;gap:5px;font-size:.84rem}.p3-am div{display:flex;justify-content:space-between;gap:8px}.p3-am span{color:#4b6a8b}',
    '.p3-note{font-size:.76rem;color:#4b6a8b;margin:0}',
    '.p3-list{display:flex;flex-wrap:wrap;gap:6px}',
    '.p3-sel{display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
    '.p3-select{font:inherit;font-size:.82rem;border:1px solid #cfdfed;border-radius:8px;padding:7px 10px;background:#fff;color:#1e4663;max-width:100%}',
    '@media (max-width:640px){.p3-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.p3-hint{display:none}.p3-stage{height:62vh}}'
  ].join('\n');
  function injecterCss() {
    if (document.getElementById('p3-css')) return;
    var s = document.createElement('style'); s.id = 'p3-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  /* ---------- Préparation des lots (projection locale en mètres) ---------- */
  function polyValide(p) {
    if (!Array.isArray(p) || p.length < 3) return false;
    for (var i = 0; i < p.length; i++) {
      if (!Array.isArray(p[i]) || !isFinite(+p[i][0]) || !isFinite(+p[i][1]) || Math.abs(+p[i][0]) > 90 || Math.abs(+p[i][1]) > 180) return false;
    }
    return true;
  }
  function ordreNaturel(a, b) { return String(a.numero).localeCompare(String(b.numero), 'fr', { numeric: true }); }

  function preparer(plan) {
    var geo = null;
    var lots = (plan.lots || []).map(function (l) {
      return { id: String(l.id), numero: l.numero || l.id, ilot: l.ilot || '', surface: +l.surface || 0, prix: +l.prix || 0, statut: LABEL[l.statut] ? l.statut : 'attribue', poly: polyValide(l.poly) ? l.poly : null };
    });
    var avecTrace = lots.filter(function (l) { return l.poly; });
    var modeGrille = avecTrace.length < Math.max(3, lots.length * 0.6);
    var sansTrace = 0;
    if (!modeGrille) {
      var ref = avecTrace.filter(function (l) { return l.statut === 'mon_lot'; }); if (!ref.length) ref = avecTrace;
      var s0 = 0, s1 = 0, n = 0;
      ref.forEach(function (l) { l.poly.forEach(function (p) { s0 += +p[0]; s1 += +p[1]; n++; }); });
      var lat0 = s0 / n, lng0 = s1 / n, kx = 111320 * Math.cos(lat0 * Math.PI / 180), kz = 110540;
      geo = { lat0: lat0, lng0: lng0, kx: kx, kz: kz };
      lots = lots.filter(function (l) { if (!l.poly) { sansTrace++; return false; } return true; });
      lots.forEach(function (l) {
        var pts = l.poly.map(function (p) { return [(+p[1] - lng0) * kx, -(+p[0] - lat0) * kz]; });
        if (pts.length > 3) { var a = pts[0], b = pts[pts.length - 1]; if (Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) pts.pop(); }
        l.pts = pts;
      });
    } else {
      lots.sort(ordreNaturel);
      var cols = Math.ceil(Math.sqrt(lots.length)), cell = 0;
      lots.forEach(function (l) { cell = Math.max(cell, Math.sqrt(l.surface || 300)); });
      cell = cell * 1.5 + 3;
      lots.forEach(function (l, i) {
        var s = Math.sqrt(l.surface || 300), w = s * 0.85, d = s * 1.15;
        var cx = (i % cols - (cols - 1) / 2) * cell, cz = (Math.floor(i / cols) - (Math.ceil(lots.length / cols) - 1) / 2) * cell;
        l.pts = [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx + w / 2, cz + d / 2], [cx - w / 2, cz + d / 2]];
      });
    }
    lots.forEach(function (l) {
      var sx = 0, sz = 0; l.pts.forEach(function (p) { sx += p[0]; sz += p[1]; }); l.cx = sx / l.pts.length; l.cz = sz / l.pts.length;
    });
    return { lots: lots, modeGrille: modeGrille, sansTrace: sansTrace, geo: geo };
  }

  /* ---------- Fond satellite ----------
     Même imagerie que la page Carte (Esri World Imagery). Les lots étant projetés depuis leurs coordonnées réelles, il
     suffit de poser sous eux la mosaïque de tuiles qui couvre le lotissement. Chargée uniquement à la demande (bouton
     « Satellite ») : sans ce clic, aucune requête ne part vers le fournisseur d'imagerie. */
  var SAT_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  var SAT_ZMAX = 18, SAT_COTE_MAX = 8;          /* zoom 18 : au-delà, l'imagerie manque souvent hors des grandes villes ; au plus 8 × 8 tuiles de 256 px (mosaïque de 2 048 px) */
  function tuileX(lng, z) { return (lng + 180) / 360 * Math.pow(2, z); }
  function tuileY(lat, z) { var r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z); }
  function lngDeTuile(x, z) { return x / Math.pow(2, z) * 360 - 180; }
  function latDeTuile(y, z) { return Math.atan(Math.sinh(Math.PI * (1 - 2 * y / Math.pow(2, z)))) * 180 / Math.PI; }
  /* Emprise en tuiles autour d'un centre (lat, lng) et d'un demi-côté en mètres ; renvoie aussi la position du fond dans le
     repère local du plan (mètres, nord = −z). Le zoom retenu est le plus fin qui tient dans SAT_COTE_MAX tuiles de côté. */
  function emprise(geo, cx, cz, demi, zmax) {
    var lat = geo.lat0 - cz / geo.kz, lng = geo.lng0 + cx / geo.kx, dLat = demi / geo.kz, dLng = demi / geo.kx;
    for (var z = Math.min(zmax || SAT_ZMAX, SAT_ZMAX); z >= 3; z--) {
      var x0 = Math.floor(tuileX(lng - dLng, z)), x1 = Math.floor(tuileX(lng + dLng, z)), y0 = Math.floor(tuileY(lat + dLat, z)), y1 = Math.floor(tuileY(lat - dLat, z));
      if (x1 - x0 + 1 > SAT_COTE_MAX || y1 - y0 + 1 > SAT_COTE_MAX) continue;
      var lngO = lngDeTuile(x0, z), lngE = lngDeTuile(x1 + 1, z), latN = latDeTuile(y0, z), latS = latDeTuile(y1 + 1, z);
      var xO = (lngO - geo.lng0) * geo.kx, xE = (lngE - geo.lng0) * geo.kx, zN = -(latN - geo.lat0) * geo.kz, zS = -(latS - geo.lat0) * geo.kz;
      return { z: z, x0: x0, y0: y0, nx: x1 - x0 + 1, ny: y1 - y0 + 1, largeur: xE - xO, profondeur: zS - zN, cx: (xO + xE) / 2, cz: (zN + zS) / 2 };
    }
    return null;
  }
  /* Assemble les tuiles sur un canevas. Échec si plus d'un quart manque, ou si le canevas n'est pas lisible par WebGL. */
  function chargerMosaique(e, url) {
    return new Promise(function (ok, ko) {
      /* Canevas en puissance de deux : sans cela, certains téléphones (WebGL 1) ne peuvent pas générer les niveaux de
         réduction de la texture, et l'image scintille dès que la caméra bouge. */
      var pot = function (n) { var v = 256; while (v < n && v < 2048) v *= 2; return v; };
      var c = document.createElement('canvas'); c.width = pot(e.nx * 256); c.height = pot(e.ny * 256);
      var lw = c.width / e.nx, lh = c.height / e.ny;
      var g = c.getContext('2d'), reste = e.nx * e.ny, rates = 0, fini = false;
      var garde = setTimeout(function () { if (!fini) { fini = true; ko(new Error('délai dépassé')); } }, 20000);
      function un() {
        if (--reste > 0 || fini) return;
        fini = true; clearTimeout(garde);
        if (rates > e.nx * e.ny / 4) return ko(new Error('imagerie indisponible'));
        try { g.getImageData(0, 0, 1, 1); } catch (err) { return ko(err); }
        ok(c);
      }
      for (var j = 0; j < e.ny; j++) for (var i = 0; i < e.nx; i++) (function (i, j) {
        var im = new Image(); im.crossOrigin = 'anonymous';
        im.onload = function () { try { g.drawImage(im, Math.floor(i * lw), Math.floor(j * lh), Math.ceil(lw), Math.ceil(lh)); } catch (err) { rates++; } un(); };
        im.onerror = function () { rates++; un(); };
        im.src = url.replace('{z}', e.z).replace('{x}', e.x0 + i).replace('{y}', e.y0 + j);
      })(i, j);
    });
  }

  /* ---------- Montage ---------- */
  function monter(box, ctx) {
    injecterCss();
    var plans = (ctx.plans || []).filter(function (p) { return p && Array.isArray(p.lots) && p.lots.length; });
    if (!plans.length) { box.innerHTML = '<div class="p3-card"><h5>Plan 3D</h5><p class="p3-note">' + (ctx.mode === 'public' ? 'Aucun programme n\'a encore de lots tracés sur plan. Ils apparaîtront ici dès que leurs contours seront saisis.' : 'Le plan de votre lotissement n\'est pas encore disponible. Il apparaîtra ici dès que les lots de votre programme seront tracés.') + '</p></div>'; return null; }
    var cur = 0, ctrl = { destroy: function () {} };
    function rendre() { ctrl.destroy(); ctrl = monterPlan(box, ctx, plans, cur, function (i) { cur = i; rendre(); }); }
    rendre();
    return { select: function (id) { return ctrl.select && ctrl.select(id); }, destroy: function () { ctrl.destroy(); }, info: function () { return ctrl.info && ctrl.info(); } };
  }

  function monterPlan(box, ctx, plans, idx, changerPlan) {
    var THREE = window.THREE, plan = plans[idx], prep = preparer(plan), lots = prep.lots, byId = {};
    lots.forEach(function (l) { byId[l.id] = l; });
    var pub = ctx.mode === 'public';             /* plan public : sans connexion, aucun « mon lot », aucun paiement */
    var mes = lots.filter(function (l) { return l.statut === 'mon_lot'; });
    var cnt = { libre: 0, reserve: 0, attribue: 0, vendu: 0, mon_lot: mes.length };
    lots.forEach(function (l) { if (l.statut !== 'mon_lot') cnt[l.statut]++; });
    var pay = ctx.paiement || { total: 0, verse: 0, reste: 0, pct: 0 };
    var surfMes = mes.reduce(function (s, l) { return s + l.surface; }, 0);

    var titre = [plan.programme, plan.parcelle].filter(Boolean).join(' · ') || 'Mon lotissement';
    function nomPlan(p, i) { return [p.programme, p.parcelle].filter(Boolean).join(' · ') || ('Plan ' + (i + 1)); }
    var sel = plans.length > 6
      ? '<div class="p3-sel"><label for="p3-prog" class="p3-note">Programme</label><select id="p3-prog" class="p3-select" data-planselect>' + plans.map(function (p, i) {
          return '<option value="' + i + '"' + (i === idx ? ' selected' : '') + '>' + esc(nomPlan(p, i)) + ' (' + p.total + ' lots)</option>';
        }).join('') + '</select></div>'
      : plans.length > 1 ? '<div class="p3-sel">' + plans.map(function (p, i) {
          return '<button type="button" class="p3-btn' + (i === idx ? ' on' : '') + '" data-plan="' + i + '">' + esc(nomPlan(p, i)) + '</button>';
        }).join('') + '</div>' : '';
    box.innerHTML = '<div class="p3">' +
      '<div class="p3-top"><div><h4>' + (pub ? 'Plan 3D du programme' : 'Plan 3D de mon lotissement') + '</h4><p>' + esc(titre) + '</p></div><span class="p3-tag">' + (pub ? 'Informations publiques' : 'Lots voisins : statut seulement') + '</span></div>' + sel +
      (pub
        ? '<div class="p3-kpis"><div><span>Lots</span><b>' + lots.length + '</b></div><div><span>Disponibles</span><b>' + cnt.libre + '</b></div><div><span>Réservés</span><b>' + cnt.reserve + '</b></div><div><span>Vendus</span><b>' + (cnt.vendu + cnt.attribue) + '</b></div></div>'
        : '<div class="p3-kpis"><div><span>' + (mes.length > 1 ? 'Mes lots' : 'Mon lot') + '</span><b>' + (mes.length ? esc(mes.map(function (l) { return l.numero; }).join(', ')) : '—') + '</b></div>' +
          '<div><span>Surface</span><b>' + (surfMes ? fmt(surfMes) + ' m²' : '—') + '</b></div>' +
          '<div><span>Lots disponibles</span><b>' + cnt.libre + ' / ' + lots.length + '</b></div>' +
          '<div><span>Prix réglé</span><b>' + Math.round(pay.pct || 0) + ' %</b></div></div>') +
      '<div class="p3-stage"><canvas aria-label="Plan 3D du lotissement. Glissez pour tourner, molette ou pincement pour zoomer, cliquez un lot pour voir sa fiche." tabindex="0"></canvas>' +
      '<div class="p3-chips" role="group" aria-label="Afficher les lots">' +
      (pub ? '' : '<span class="p3-chip fixe" style="--c:var(--pp-primary,#A6431C)"><i></i>Mon lot</span>') +
      ['libre', 'reserve', 'attribue', 'vendu'].filter(function (k) { return cnt[k] > 0; }).map(function (k) {
        var nom = k === 'libre' ? 'Disponibles' : k === 'reserve' ? 'Réservés' : k === 'vendu' ? 'Vendus' : 'Attribués';
        return '<button type="button" class="p3-chip" data-f="' + k + '" aria-pressed="true" style="--c:' + HEX[k] + '"><i></i>' + nom + ' ' + cnt[k] + '</button>';
      }).join('') + '</div>' +
      '<svg class="p3-compass" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="rgba(255,255,255,.9)" stroke="#cfdfed"/><path d="M24 6l6 18H18z" fill="var(--pp-primary,#A6431C)"/><path d="M24 42l-6-18h12z" fill="#8a97a3" opacity=".5"/></svg>' +
      '<div class="p3-hint">Glisser pour tourner · molette pour zoomer · cliquer un lot</div>' +
      '<div class="p3-bar">' + (pub ? '' : '<button type="button" class="p3-btn pri" data-a="mon">Mon lot</button>') + '<button type="button" class="p3-btn' + (pub ? ' pri' : '') + '" data-a="tout">' + (pub ? 'Vue d\'ensemble' : 'Tout le lotissement') + '</button>' +
      '<button type="button" class="p3-btn" data-a="plan" aria-pressed="false">Vue du plan</button><button type="button" class="p3-btn" data-a="rejouer">Rejouer l\'animation</button>' +
      (prep.geo ? '<button type="button" class="p3-btn" data-a="sat" aria-pressed="false">Satellite</button>' : '') + '</div>' +
      '<div class="p3-attr" hidden>Imagerie © Esri</div>' +
      '<div class="p3-tip" role="presentation"></div></div>' +
      '<div class="p3-card" aria-live="polite"></div>' +
      (prep.sansTrace ? '<p class="p3-note">' + prep.sansTrace + ' lot' + (prep.sansTrace > 1 ? 's' : '') + ' sans tracé ne figure' + (prep.sansTrace > 1 ? 'nt' : '') + ' pas sur ce plan.</p>' : '') +
      (prep.modeGrille ? '<p class="p3-note">Le tracé exact de cette parcelle n\'est pas encore saisi : les lots sont disposés en grille à titre indicatif, sans valeur de plan cadastral.</p>' : '') +
      (plan.tronque ? '<p class="p3-note">' + (pub ? 'Seuls ' + lots.length + ' lots sont affichés, sur ' + plan.total + '.' : 'Seuls les ' + lots.length + ' lots les plus proches du vôtre sont affichés, sur ' + plan.total + '.') + '</p>' : '') +
      '</div>';

    var stage = box.querySelector('.p3-stage'), cv = box.querySelector('canvas'), tip = box.querySelector('.p3-tip'), card = box.querySelector('.p3-card');
    var selected = null;

    /* fiche */
    function pill(st) { var c = st === 'mon_lot' ? 'var(--pp-primary,#A6431C)' : (HEX[st] || '#8C887F'); return '<span class="p3-pill" style="--c:' + c + '"><i></i>' + LABEL[st] + '</span>'; }
    function bloc() {
      var circ = 2 * Math.PI * 38, p = clamp(pay.pct || 0, 0, 100);
      return '<div class="p3-pay"><div class="p3-ring"><svg viewBox="0 0 92 92"><circle cx="46" cy="46" r="38" fill="none" stroke="#e3eaf2" stroke-width="9"/><circle cx="46" cy="46" r="38" fill="none" stroke="var(--pp-primary,#A6431C)" stroke-width="9" stroke-dasharray="' + (circ * p / 100).toFixed(1) + ' ' + circ.toFixed(1) + '"/></svg><b>' + Math.round(p) + '%</b></div>' +
        '<div class="p3-am"><div><span>Montant total</span><b>' + fmt(pay.total) + ' F</b></div><div><span>Déjà versé</span><b>' + fmt(pay.verse) + ' F</b></div><div><span>Reste à payer</span><b>' + fmt(pay.reste) + ' F</b></div></div></div>';
    }
    function fiche() {
      var l = selected;
      if (!l && pub) {
        card.innerHTML = '<div class="p3-row"><h5>' + esc(titre) + '</h5></div><div class="p3-facts"><div><span>Lots tracés</span><b>' + lots.length + '</b></div><div><span>Disponibles</span><b>' + cnt.libre + '</b></div><div><span>Réservés</span><b>' + cnt.reserve + '</b></div><div><span>Vendus</span><b>' + (cnt.vendu + cnt.attribue) + '</b></div></div>' +
          '<p class="p3-note">Cliquez un lot sur le plan pour voir sa superficie, son prix et son statut. Informations publiques, sous réserve de mise à jour.</p>';
        return;
      }
      if (!l) {
        card.innerHTML = '<div class="p3-row"><h5>Mon dossier</h5>' + pill('mon_lot') + '</div>' + (pay.total ? bloc() : '') +
          '<div class="p3-list">' + mes.map(function (m) { return '<button type="button" class="p3-btn" data-lot="' + esc(m.id) + '">Lot ' + esc(m.numero) + (m.surface ? ' · ' + fmt(m.surface) + ' m²' : '') + '</button>'; }).join('') + '</div>' +
          '<p class="p3-note">Cliquez un lot sur le plan pour voir sa surface et son statut. Les informations des autres souscripteurs restent confidentielles.</p>';
        return;
      }
      var mon = l.statut === 'mon_lot';
      card.innerHTML = '<div class="p3-row"><h5>Lot ' + esc(l.numero) + '</h5>' + pill(l.statut) + '</div>' +
        '<div class="p3-facts">' + (l.surface ? '<div><span>Surface</span><b>' + fmt(l.surface) + ' m²</b></div>' : '') + (l.ilot ? '<div><span>Îlot</span><b>' + esc(l.ilot) + '</b></div>' : '') +
          (pub && l.prix ? '<div><span>Prix</span><b>' + fmt(l.prix) + ' F</b></div>' : '') + (pub && l.prix && l.surface ? '<div><span>Prix au m²</span><b>' + fmt(l.prix / l.surface) + ' F</b></div>' : '') +
          '<div><span>Statut</span><b>' + LABEL[l.statut] + '</b></div></div>' +
        (mon && pay.total ? '<h5 style="font-size:.9rem">Mon dossier</h5>' + bloc() : '') +
        (!mon ? '<p class="p3-note">' + (l.statut === 'libre' ? (pub ? 'Ce lot est disponible. Contactez-nous pour le réserver.' : 'Ce lot est disponible. Contactez votre conseiller pour en savoir plus.') : l.statut === 'reserve' ? 'Ce lot est réservé.' : 'Ce lot n\'est plus disponible. Les informations sur son souscripteur ne sont pas communiquées.') + '</p>' : '') +
        '<div class="p3-list"><button type="button" class="p3-btn" data-a="fermer">' + (pub ? 'Fermer' : 'Retour à mon dossier') + '</button></div>';
    }
    fiche();

    /* WebGL indisponible : la fiche textuelle reste utilisable */
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); }
    catch (e) { stage.innerHTML = '<div class="p3-card" style="margin:12px"><h5>Vue 3D indisponible</h5><p class="p3-note">Votre appareil ne permet pas d\'afficher la 3D. Les informations de votre lot restent disponibles ci-dessous.</p></div>'; return { destroy: function () {}, select: function () {}, info: function () { return { webgl: false }; } }; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    var cs = getComputedStyle(document.documentElement);
    var colMon = (cs.getPropertyValue('--pp-primary') || '').trim() || '#A6431C';
    var COL = { libre: 0x2F7D5B, reserve: 0xE0A100, attribue: 0x8C887F, vendu: 0x8C887F, mon_lot: new THREE.Color(colMon).getHex() };

    var scene = new THREE.Scene(); scene.background = new THREE.Color(0xe9eef1);
    var camera = new THREE.PerspectiveCamera(38, 1, 1, 6000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9099, 0.55));
    var sun = new THREE.DirectionalLight(0xffffff, 0.55); sun.position.set(-90, 160, 80); scene.add(sun);

    /* centre et rayon */
    var ref = !pub && mes.length ? mes : lots, cx0 = 0, cz0 = 0;
    ref.forEach(function (l) { cx0 += l.cx; cz0 += l.cz; }); cx0 /= ref.length; cz0 /= ref.length;
    var mx = 0, ax = 0, az = 0, R = 20;
    lots.forEach(function (l) { ax += l.cx; az += l.cz; R = Math.max(R, Math.hypot(l.cx - cx0, l.cz - cz0)); }); ax /= lots.length; az /= lots.length;
    var RT = 20; lots.forEach(function (l) { RT = Math.max(RT, Math.hypot(l.cx - ax, l.cz - az)); });
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(RT * 14 + 400, RT * 14 + 400), new THREE.MeshStandardMaterial({ color: 0xd9dfd3, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(ax, -0.05, az); scene.add(ground);
    scene.fog = new THREE.Fog(0xe9eef1, RT * 5 + 300, RT * 11 + 900);

    /* fond satellite, à la demande : mosaïque posée juste au-dessus du sol, lots rendus translucides pour laisser voir le terrain */
    var sat = { on: false, mesh: null, etat: 'non_charge' };
    function satAppliquer() {
      if (sat.mesh) sat.mesh.visible = sat.on;
      /* Le sol uni est masqué sous la photo : deux surfaces presque à la même hauteur se disputent l'affichage et
         l'image tremble (surtout sur téléphone, où la précision de profondeur est plus faible). */
      ground.visible = !(sat.on && sat.mesh);
      meshes.forEach(function (m) { m.material.transparent = sat.on; m.material.opacity = sat.on ? 0.72 : 1; m.material.needsUpdate = true; });
      var b = btn('sat'), at = box.querySelector('.p3-attr');
      if (b) { b.classList.toggle('on', sat.on); b.setAttribute('aria-pressed', sat.on ? 'true' : 'false'); }
      if (at) at.hidden = !sat.on;
    }
    function satBasculer() {
      var b = btn('sat'); if (!b || !prep.geo || sat.etat === 'charge_en_cours' || sat.etat === 'echec') return;
      if (sat.etat === 'pret') { sat.on = !sat.on; satAppliquer(); return; }
      var e = emprise(prep.geo, ax, az, RT * 1.3 + 100, ctx.satZoomMax);
      if (!e) return;
      sat.etat = 'charge_en_cours'; b.disabled = true; b.textContent = 'Chargement…';
      chargerMosaique(e, ctx.satUrl || SAT_URL).then(function (canevas) {
        if (!vivant) return;
        var t = new THREE.CanvasTexture(canevas); t.encoding = THREE.sRGBEncoding; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        sat.mesh = new THREE.Mesh(new THREE.PlaneGeometry(e.largeur, e.profondeur), new THREE.MeshBasicMaterial({ map: t }));
        sat.mesh.rotation.x = -Math.PI / 2; sat.mesh.position.set(e.cx, -0.02, e.cz); scene.add(sat.mesh);
        sat.etat = 'pret'; sat.zoom = e.z; sat.tuiles = e.nx * e.ny; sat.on = true; b.disabled = false; b.textContent = 'Satellite'; satAppliquer();
      }).catch(function () {
        sat.etat = 'echec'; sat.on = false; b.textContent = 'Satellite indisponible'; b.title = 'L\'imagerie satellite n\'a pas pu être chargée (connexion ou zone non couverte).'; satAppliquer();
      });
    }

    /* groupes fusionnés par statut : un seul maillage par statut, quelle que soit la taille du plan */
    var groups = {}, meshes = [];
    ORDRE.forEach(function (st) {
      var subset = lots.filter(function (l) { return l.statut === st; });
      var h = HAUT[st], chunksP = [], chunksN = [], ranges = [], face = 0, lines = [], total = 0;
      subset.forEach(function (l) {
        var shape = new THREE.Shape(l.pts.map(function (p) { return new THREE.Vector2(p[0], -p[1]); }));
        var g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
        g.rotateX(-Math.PI / 2);
        var a = g.attributes.position.array, n = g.attributes.normal.array, nf = a.length / 9;
        chunksP.push(a); chunksN.push(n); total += a.length;
        ranges.push({ lot: l, a: face, b: face + nf }); face += nf;
        for (var k = 0; k < l.pts.length; k++) { var p = l.pts[k], q = l.pts[(k + 1) % l.pts.length]; lines.push(p[0], h + 0.03, p[1], q[0], h + 0.03, q[1]); }
        g.dispose();
      });
      var grp = new THREE.Group(); grp.scale.y = REDUIT ? 1 : 0.001; scene.add(grp); groups[st] = grp;
      if (!subset.length) return;
      var P = new Float32Array(total), N = new Float32Array(total), o = 0;
      chunksP.forEach(function (c, i) { P.set(c, o); N.set(chunksN[i], o); o += c.length; });
      var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      var mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COL[st], roughness: 0.75, metalness: 0.03 }));
      mesh.userData.ranges = ranges; grp.add(mesh); meshes.push(mesh);
      var lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lines), 3));
      grp.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x1b2a35, transparent: true, opacity: 0.35 })));
    });
    function lotDe(hit) {
      var rs = hit.object.userData.ranges, f = hit.faceIndex, lo = 0, hi = rs.length - 1;
      while (lo <= hi) { var m = (lo + hi) >> 1; if (f < rs[m].a) hi = m - 1; else if (f >= rs[m].b) lo = m + 1; else return rs[m].lot; }
      return null;
    }

    /* repères : faisceau, épingle et étiquette sur chacun de mes lots */
    var pins = [];
    function etiquette(txt) {
      var c = document.createElement('canvas'); c.width = 256; c.height = 80; var x = c.getContext('2d');
      x.font = '800 34px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 8; x.strokeStyle = 'rgba(20,32,43,.9)'; x.strokeText(txt, 128, 42); x.fillStyle = '#fff'; x.fillText(txt, 128, 42);
      var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
    }
    var haut = clamp(RT * 0.25, 18, 60);
    mes.forEach(function (l) {
      var g = new THREE.Group(); g.position.set(l.cx, 0, l.cz);
      var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, haut, 12, 1, true), new THREE.MeshBasicMaterial({ color: COL.mon_lot, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.y = HAUT.mon_lot + haut / 2; g.add(beam);
      var cone = new THREE.Mesh(new THREE.ConeGeometry(2.6, 6, 14), new THREE.MeshStandardMaterial({ color: COL.mon_lot, roughness: 0.5 }));
      cone.rotation.x = Math.PI; cone.position.y = HAUT.mon_lot + haut + 4; g.add(cone);
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: etiquette('Lot ' + l.numero), transparent: true, depthWrite: false })); sp.scale.set(18, 5.6, 1); sp.position.y = HAUT.mon_lot + haut + 12; g.add(sp);
      g.userData = { cone: cone, beam: beam, base: HAUT.mon_lot + haut + 4 }; g.visible = REDUIT; scene.add(g); pins.push(g);
    });

    /* surbrillance du lot choisi */
    var surb = new THREE.Group(); scene.add(surb);
    function surbrillance(l) {
      while (surb.children.length) { var c = surb.children.pop(); if (c.geometry) c.geometry.dispose(); }
      if (!l) return;
      var h = HAUT[l.statut] + 0.6, shape = new THREE.Shape(l.pts.map(function (p) { return new THREE.Vector2(p[0], -p[1]); }));
      var g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
      surb.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, depthWrite: false })));
      var ls = []; for (var k = 0; k < l.pts.length; k++) { var p = l.pts[k], q = l.pts[(k + 1) % l.pts.length]; ls.push(p[0], h + 0.06, p[1], q[0], h + 0.06, q[1]); }
      var lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ls), 3));
      surb.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x14202b })));
    }

    /* caméra orbitale */
    var cam = { th: -0.9, ph: 0.6, r: 400, tx: pub ? ax : cx0, tz: pub ? az : cz0 };
    var vueMon = pub ? { th: 0.6, ph: 0.95, r: clamp(RT * 2.4, 90, 700), tx: ax, tz: az } : { th: 0.6, ph: 0.95, r: clamp(RT * 0.8, 95, 190), tx: cx0, tz: cz0 };
    var want = {}; function viser(v) { want = { th: v.th, ph: v.ph, r: v.r, tx: v.tx, tz: v.tz }; }
    viser(vueMon); if (REDUIT) { cam.th = want.th; cam.ph = want.ph; cam.r = want.r; }
    var spin = !REDUIT, planVue = false, ptrs = {}, moved = 0, rMax = RT * 3.2 + 300;
    function majCam() {
      var k = REDUIT ? 1 : 0.1;
      cam.th += (want.th - cam.th) * k; cam.ph += (want.ph - cam.ph) * k; cam.r += (want.r - cam.r) * k; cam.tx += (want.tx - cam.tx) * k; cam.tz += (want.tz - cam.tz) * k;
      var s = Math.sin(cam.ph);
      camera.position.set(cam.tx + cam.r * s * Math.sin(cam.th), cam.r * Math.cos(cam.ph), cam.tz + cam.r * s * Math.cos(cam.th)); camera.lookAt(cam.tx, 0, cam.tz);
      var cp = box.querySelector('.p3-compass'); if (cp) cp.style.transform = 'rotate(' + (cam.th * 180 / Math.PI) + 'deg)';
    }
    function btn(a) { return box.querySelector('[data-a="' + a + '"]'); }
    function stopSpin() { spin = false; }
    cv.addEventListener('pointerdown', function (e) { cv.setPointerCapture(e.pointerId); ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; moved = 0; cv.classList.add('g'); });
    cv.addEventListener('pointermove', function (e) {
      var p = ptrs[e.pointerId]; if (!p) { survol(e); return; }
      var ids = Object.keys(ptrs);
      if (ids.length === 2) {
        var o = ptrs[ids[0]] === p ? ptrs[ids[1]] : ptrs[ids[0]], d0 = Math.hypot(p.x - o.x, p.y - o.y); p.x = e.clientX; p.y = e.clientY;
        var d1 = Math.hypot(p.x - o.x, p.y - o.y); want.r = clamp(want.r * d0 / Math.max(d1, 1), 25, rMax); moved = 99; return;
      }
      var dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 5) { want.th -= dx * 0.006; want.ph = clamp(want.ph - dy * 0.006, 0.1, 1.45); stopSpin(); planVue = false; }
    });
    function finPtr(e) { var had = ptrs[e.pointerId]; delete ptrs[e.pointerId]; if (had && !Object.keys(ptrs).length) { cv.classList.remove('g'); if (moved <= 5) clic(e); } }
    cv.addEventListener('pointerup', finPtr);
    cv.addEventListener('pointercancel', function (e) { delete ptrs[e.pointerId]; cv.classList.remove('g'); });
    cv.addEventListener('pointerleave', function () { tip.classList.remove('on'); cv.classList.remove('h'); });
    cv.addEventListener('wheel', function (e) { e.preventDefault(); want.r = clamp(want.r * (1 + Math.sign(e.deltaY) * 0.1), 25, rMax); }, { passive: false });
    cv.addEventListener('keydown', function (e) {
      var s = 0.15;
      if (e.key === 'ArrowLeft') want.th -= s; else if (e.key === 'ArrowRight') want.th += s; else if (e.key === 'ArrowUp') want.ph = clamp(want.ph - s, 0.1, 1.45); else if (e.key === 'ArrowDown') want.ph = clamp(want.ph + s, 0.1, 1.45);
      else if (e.key === '+' || e.key === '=') want.r = clamp(want.r * 0.9, 25, rMax); else if (e.key === '-') want.r = clamp(want.r * 1.1, 25, rMax); else if (e.key === 'Escape') choisir(null); else return;
      stopSpin(); e.preventDefault();
    });

    var ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
    function lotSous(e) {
      var r = cv.getBoundingClientRect(); mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mouse, camera);
      var vis = meshes.filter(function (m) { return m.parent.visible; }), hit = ray.intersectObjects(vis, false)[0];
      return hit ? lotDe(hit) : null;
    }
    function survol(e) {
      if (e.pointerType === 'touch') return;
      var l = lotSous(e); cv.classList.toggle('h', !!l);
      if (!l) { tip.classList.remove('on'); return; }
      var r = stage.getBoundingClientRect();
      tip.innerHTML = '<b>Lot ' + esc(l.numero) + '</b> · ' + LABEL[l.statut] + (l.surface ? ' · ' + fmt(l.surface) + ' m²' : '');
      tip.style.left = clamp(e.clientX - r.left + 14, 6, r.width - 200) + 'px'; tip.style.top = clamp(e.clientY - r.top + 14, 6, r.height - 40) + 'px'; tip.classList.add('on');
    }
    function clic(e) { var l = lotSous(e); choisir(l); }
    function choisir(l, sansCamera) {
      if (typeof l === 'string') l = byId[l] || null;
      selected = l; surbrillance(l); fiche();
      if (l && !sansCamera) { want.tx = l.cx; want.tz = l.cz; want.r = Math.min(want.r, 90); stopSpin(); }
    }

    /* commandes */
    box.addEventListener('change', function (e) { var t = e.target; if (t && t.hasAttribute && t.hasAttribute('data-planselect')) changerPlan(+t.value); });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-f],[data-a],[data-lot],[data-plan]'); if (!b || !box.contains(b)) return;
      if (b.dataset.f) {
        var on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); groups[b.dataset.f].visible = on;
        if (selected && selected.statut === b.dataset.f && !on) choisir(null, true);
      } else if (b.dataset.lot) choisir(b.dataset.lot);
      else if (b.dataset.plan) changerPlan(+b.dataset.plan);
      else if (b.dataset.a === 'mon') { choisir(null, true); viser(vueMon); planVue = false; btn('plan').setAttribute('aria-pressed', 'false'); btn('plan').classList.remove('on'); }
      else if (b.dataset.a === 'tout') { choisir(null, true); want.tx = ax; want.tz = az; want.r = clamp(RT * (pub ? 2.4 : 2.6), 90, pub ? 700 : rMax); want.ph = 0.9; stopSpin(); }
      else if (b.dataset.a === 'plan') { planVue = !planVue; b.classList.toggle('on', planVue); b.setAttribute('aria-pressed', planVue ? 'true' : 'false'); want.ph = planVue ? 0.08 : 0.95; if (planVue) want.th = 0; stopSpin(); }
      else if (b.dataset.a === 'rejouer') rejouer();
      else if (b.dataset.a === 'sat') satBasculer();
      else if (b.dataset.a === 'fermer') choisir(null);
    });

    /* animation d'entrée : les lots montent, puis le faisceau signale le vôtre */
    var t0 = performance.now() / 1000, delais = { libre: 0.1, reserve: 0.25, attribue: 0.35, vendu: 0.35, mon_lot: 1.0 };
    function rejouer() {
      if (REDUIT) return;
      t0 = performance.now() / 1000; Object.keys(groups).forEach(function (k) { groups[k].scale.y = 0.001; }); pins.forEach(function (p) { p.visible = false; });
      cam.th = -0.9; cam.ph = 0.6; cam.r = 400; viser(vueMon); choisir(null, true); spin = true;
    }
    function resize() { var w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    var ro = new ResizeObserver(resize); ro.observe(stage); resize();

    var vivant = true, last = performance.now() / 1000;
    function boucle() {
      if (!vivant) return;
      if (!document.body.contains(cv)) { detruire(); return; }
      requestAnimationFrame(boucle);
      if (!stage.offsetParent || !stage.clientWidth) return;     /* onglet masqué : on ne dessine pas */
      var now = performance.now() / 1000, dt = Math.min(now - last, 0.05), te = now - t0; last = now;
      if (!REDUIT) {
        Object.keys(groups).forEach(function (k) { groups[k].scale.y = Math.max(0.001, ease(clamp((te - delais[k]) / 1.3, 0, 1))); });
        pins.forEach(function (p) { var vis = te > delais.mon_lot + 1.1; p.visible = vis; if (vis) { p.userData.cone.position.y = p.userData.base + Math.sin(now * 3) * 1.1; p.userData.beam.material.opacity = 0.28 + 0.12 * Math.sin(now * 2.2); } });
        if (spin && !Object.keys(ptrs).length && te > 2.2) want.th += dt * 0.1;
      }
      majCam(); renderer.render(scene, camera);
    }
    function detruire() {
      if (!vivant) return; vivant = false;
      try { ro.disconnect(); } catch (e) {}
      scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
      try { renderer.dispose(); } catch (e) {}
    }
    boucle();
    return {
      destroy: detruire,
      select: function (id) { choisir(id); return selected ? selected.id : null; },
      info: function () { return { webgl: true, public: pub, lots: lots.length, mes: mes.length, grille: prep.modeGrille, satellite: sat.etat, satelliteActif: sat.on, sol: ground.visible, satZoom: sat.zoom || null, satTuiles: sat.tuiles || 0, libres: cnt.libre, reserves: cnt.reserve, attribues: cnt.attribue, vendus: cnt.vendu, sansTrace: prep.sansTrace }; }
    };
  }

  window.PortailPlan3D = { monter: monter, _preparer: preparer, _emprise: emprise };
})();
