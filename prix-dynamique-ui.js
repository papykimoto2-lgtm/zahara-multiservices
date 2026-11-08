/* Prix dynamique — interface (page Lots). Dépend de prix-dynamique.js, marge-prog.js et des globales de l'ERP.
   Les propositions ne sont JAMAIS appliquées seules : un responsable coche, confirme, et chaque changement est tracé dans lot.prix_historique. */
var PXD = { sel: {} };
function pxdH(x) { return typeof escHtml === 'function' ? escHtml(x) : String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function pxdF(n) { return (typeof fmtF === 'function' ? fmtF(Math.round(n || 0)) : String(Math.round(n || 0))) + ' F'; }
var PXD_ACTION = { hausse: ['#dcfce7', '#166534', '📈 Hausse possible'], baisse: ['#fef3c7', '#92400e', '📉 Baisse ciblée'], bloque: ['#fee2e2', '#b91c1c', '⛔ Baisse impossible'], maintien: ['#e2e8f0', '#475569', '⏸ Maintenir'], aucun: ['#e2e8f0', '#475569', '—'] };
var PXD_BLOC = { plancher: 'Au plancher de marge', plancher_inconnu: 'Plancher inconnu (coût du lot ou données du programme manquants)' };

function pxdDonnees() {
  var cible = typeof mpCible === 'function' ? mpCible() : 15, planchers = {};
  (DATA.programmes || []).forEach(function (p) { try { var e = MargeProg.evaluer(mpResume(p).r, cible); planchers[p.id] = e.plancher ? { prix_moyen_min: e.plancher.prix_moyen_min, prix_moyen_actuel: e.plancher.prix_moyen_actuel, fiable: e.fiable } : null; } catch (x) { planchers[p.id] = null; } });
  return PrixDynamique.analyser({ now: Date.now(), programmes: DATA.programmes || [], lots: DATA.lots || [], clients: DATA.clients || [], leads: DATA.leads || [], planchers: planchers,
    params: Object.assign({}, DATA.params && DATA.params.prix_dynamique, { cible_pct: cible }) });
}

function pxdOuvrir() {
  var m = document.getElementById('modal-pxd');
  if (!m) {
    m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'modal-pxd';
    m.innerHTML = '<div class="modal" style="max-width:1040px;width:97vw;"><div class="modal-header"><h3>💹 Prix dynamique</h3><button class="btn btn-secondary btn-icon" onclick="closeModal(\'modal-pxd\')">✕</button></div>'
      + '<div class="modal-body" id="pxd-body"></div><div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal(\'modal-pxd\')">Fermer</button><button class="btn btn-primary" id="pxd-appliquer" onclick="pxdAppliquer()">Appliquer la sélection</button></div></div>';
    document.body.appendChild(m);
  }
  PXD.sel = {}; openModal('modal-pxd'); pxdRendre();
}
function pxdCoche(id, v) { PXD.sel[id] = v; pxdMajBouton(); }
function pxdMajBouton() { var n = Object.keys(PXD.sel).filter(function (k) { return PXD.sel[k]; }).length, b = document.getElementById('pxd-appliquer'); if (b) { b.textContent = 'Appliquer la sélection (' + n + ')'; b.disabled = !n || !(typeof hasRole === 'function' && hasRole('manager')); } }

function pxdRendre() {
  var b = document.getElementById('pxd-body'); if (!b) return;
  var r = pxdDonnees(), T = r.total, P = r.cfg;
  var h = '<div class="alert alert-info" style="margin-bottom:10px;">Ces propositions viennent de <strong>vos ventes</strong> (rythme sur 90 jours, mois de stock, prospects chauds). Elles ne garantissent aucun volume : chaque changement est un <strong>test</strong> à mesurer sur 30 jours. Une baisse ne descend jamais sous le plancher de marge (cible ' + pxdH(P.cible_pct) + ' %).</div>'
    + '<div style="font-size:12px;margin-bottom:8px;">📈 ' + T.hausses + ' · 📉 ' + T.baisses + (T.bloques ? ' · ⛔ ' + T.bloques : '') + '</div>';
  var actifs = r.programmes.filter(function (p) { return p.action !== 'aucun'; });
  if (!actifs.length) h += '<p style="text-align:center;color:var(--blanc-dim);padding:18px;">Aucun programme avec des lots disponibles.</p>';
  actifs.forEach(function (p) {
    var s = PXD_ACTION[p.action];
    h += '<div class="card" style="margin-bottom:12px;"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;"><strong>' + pxdH(p.programme.nom || p.programme.id) + '</strong><span class="pl-chip" style="background:' + s[0] + ';color:' + s[1] + ';">' + s[2] + '</span>'
      + '<span style="font-size:11px;color:var(--blanc-dim);">' + p.stock + ' lot(s) · ' + p.ventes_90j + ' vente(s) / 90 j (avant : ' + p.ventes_prec_90j + ') · ' + (p.sans_vente ? 'aucune vente' : p.mois_stock + ' mois de stock') + ' · ' + p.chauds + ' prospect(s) chaud(s)</span></div>'
      + '<div style="font-size:12px;margin:6px 0;">' + pxdH(p.raison) + '</div>';
    if (p.propositions.length) h += '<div class="table-wrap"><table style="font-size:12px;"><thead><tr><th></th><th>Lot</th><th style="text-align:right;">Prix actuel</th><th style="text-align:right;">Prix proposé</th><th style="text-align:right;">Écart</th><th style="text-align:right;">Plancher</th><th>Dernière modif.</th></tr></thead><tbody>'
      + p.propositions.map(function (x) {
        var id = x.lot.id, dern = (x.lot.prix_historique || []).slice(-1)[0];
        if (PXD.sel[id] === undefined) PXD.sel[id] = false;
        return '<tr' + (x.blocage ? ' style="opacity:.6;"' : '') + '><td>' + (x.blocage ? '⛔' : '<input type="checkbox" ' + (PXD.sel[id] ? 'checked ' : '') + 'onchange="pxdCoche(\'' + pxdH(id) + '\',this.checked)">') + '</td>'
          + '<td>' + pxdH((x.lot.numero || x.lot.id) + (x.lot.ilot ? ' · îlot ' + x.lot.ilot : '')) + '</td><td style="text-align:right;">' + pxdH(pxdF(x.prix)) + '</td>'
          + '<td style="text-align:right;font-weight:700;">' + (x.blocage ? '<span style="color:var(--rouge);font-weight:400;">' + pxdH(PXD_BLOC[x.blocage]) + '</span>' : pxdH(pxdF(x.suggere))) + '</td>'
          + '<td style="text-align:right;color:' + (x.delta > 0 ? 'var(--vert)' : 'var(--or)') + ';">' + (x.blocage ? '—' : (x.delta > 0 ? '+' : '') + x.delta_pct + ' %') + '</td>'
          + '<td style="text-align:right;">' + (x.plancher == null ? '—' : pxdH(pxdF(x.plancher))) + '</td><td style="font-size:11px;">' + (dern ? pxdH(dern.date + ' : ' + pxdF(dern.ancien) + ' → ' + pxdF(dern.nouveau)) : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    h += '</div>';
  });
  var adm = typeof hasRole === 'function' && hasRole('admin'), d = adm ? '' : ' disabled';
  h += '<details style="margin-top:8px;"><summary style="cursor:pointer;font-weight:600;">Réglages</summary><div class="form-grid" style="margin-top:8px;">'
    + '<div class="form-group"><label>Pas de variation (%)</label><input class="form-control" type="number" min="1" max="20" id="pxd-pas" value="' + pxdH(P.pas_pct) + '"' + d + '></div>'
    + '<div class="form-group"><label>Baisse si stock ≥ (mois)</label><input class="form-control" type="number" min="1" id="pxd-mb" value="' + pxdH(P.mois_stock_baisse) + '"' + d + '></div>'
    + '<div class="form-group"><label>Hausse si stock ≤ (mois)</label><input class="form-control" type="number" min="1" id="pxd-mh" value="' + pxdH(P.mois_stock_hausse) + '"' + d + '></div>'
    + '<div class="form-group"><label>Arrondi des prix (F)</label><input class="form-control" type="number" min="1000" step="1000" id="pxd-arr" value="' + pxdH(P.arrondi) + '"' + d + '></div>'
    + '<div class="form-group"><label>Lot « ancien » après (jours)</label><input class="form-control" type="number" min="1" id="pxd-anc" value="' + pxdH(P.lot_ancien_j) + '"' + d + '></div></div>'
    + (adm ? '<button class="btn btn-secondary btn-sm" onclick="pxdReglagesSauver()">Enregistrer les réglages</button>' : '') + '</details>';
  b.innerHTML = h; pxdMajBouton();
}

async function pxdReglagesSauver() {
  if (typeof hasRole !== 'function' || !hasRole('admin')) { toast('Réservé à l\'administrateur.', 'error'); return; }
  var g = function (i) { return parseFloat(document.getElementById(i).value); }, v = { pas_pct: g('pxd-pas'), mois_stock_baisse: g('pxd-mb'), mois_stock_hausse: g('pxd-mh'), arrondi: g('pxd-arr'), lot_ancien_j: g('pxd-anc') };
  if (Object.keys(v).some(function (k) { return isNaN(v[k]) || v[k] <= 0; }) || v.pas_pct > 20) { toast('Valeurs invalides (pas de 1 à 20 %).', 'error'); return; }
  DATA.params = DATA.params || {}; DATA.params.prix_dynamique = v; await dbPut('params', DATA.params); if (typeof syncToSupabase === 'function') syncToSupabase('pi_params', DATA.params); toast('Réglages enregistrés.', 'success'); pxdRendre();
}

async function pxdAppliquer() {
  if (typeof hasRole !== 'function' || !hasRole('manager')) { toast('Réservé aux responsables.', 'error'); return; }
  var r = pxdDonnees(), todo = [];
  r.programmes.forEach(function (p) { p.propositions.forEach(function (x) { if (PXD.sel[x.lot.id] && !x.blocage) todo.push({ p: p, x: x }); }); });
  if (!todo.length) { toast('Aucune ligne sélectionnée.', 'warn'); return; }
  var tot = todo.reduce(function (t, o) { return t + o.x.delta; }, 0);
  if (!confirm('Modifier le prix de ' + todo.length + ' lot(s) ?\nVariation cumulée : ' + (tot > 0 ? '+' : '') + pxdF(tot) + '.\nChaque changement sera tracé dans l\'historique du lot.')) return;
  var ok = 0, refus = 0, par = (APP.currentUser && APP.currentUser.nom) || '';
  for (var i = 0; i < todo.length; i++) {
    var lot = (DATA.lots || []).find(function (l) { return l.id === todo[i].x.lot.id; });
    var res = PrixDynamique.appliquer(lot, todo[i].x, Date.now(), par, (todo[i].p.action === 'hausse' ? 'Hausse : ' : 'Baisse ciblée : ') + todo[i].p.raison);
    if (res.ok) { await dbPut('lots', lot); if (typeof syncToSupabase === 'function') syncToSupabase('pi_lots', lot); ok++; } else refus++;
  }
  PXD.sel = {}; toast('💹 ' + ok + ' prix modifié(s)' + (refus ? ', ' + refus + ' refusé(s) (lot déjà vendu ou prix changé entre-temps)' : '') + '.', refus ? 'warn' : 'success', 7000);
  if (typeof renderLots === 'function') { try { renderLots(); } catch (e) {} }
  pxdRendre();
}
