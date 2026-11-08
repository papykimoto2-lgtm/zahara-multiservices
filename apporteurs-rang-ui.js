/* Classement des apporteurs — interface (page Apporteurs d'affaire). Dépend de apporteurs-rang.js et des globales de l'ERP. */
var APR = { periode: '90' };
function aprH(x) { return typeof escHtml === 'function' ? escHtml(x) : String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function aprF(n) { return (typeof fmtF === 'function' ? fmtF(Math.round(n || 0)) : String(Math.round(n || 0))) + ' F'; }
var APR_TAG = { dormant: ['#fef3c7', '#92400e', '💤'], jamais: ['#fef3c7', '#92400e', '🕳'], qualite: ['#fee2e2', '#b91c1c', '⚠️'], contrat: ['#e0f2fe', '#075985', '📄'], nc: ['#fee2e2', '#b91c1c', '🔒'], inactif: ['#e2e8f0', '#475569', '⏸'] };
var APR_MEDAILLE = ['🥇', '🥈', '🥉'];

function aprDonnees() {
  var now = Date.now(), debut = APR.periode === 'tout' ? null : now - (+APR.periode) * 86400000;
  var enRetard = {}; ((typeof getRetardataires === 'function') ? getRetardataires() : []).forEach(function (r) { enRetard[r.id] = true; });
  var verses = {}; (DATA.versements || []).forEach(function (v) { if (v.statut !== 'annule' && typeof _versementSurPrix === 'function' && _versementSurPrix(v)) verses[v.client_id] = (verses[v.client_id] || 0) + (parseFloat(v.montant) || 0); });
  var soldes = {}; (DATA.clients || []).forEach(function (c) { var t = parseFloat(c.montant_total) || 0; if (t > 0 && (verses[c.id] || 0) >= t) soldes[c.id] = true; });
  var paliers = (DATA.params && Array.isArray(DATA.params.apporteurs_paliers) && DATA.params.apporteurs_paliers.length) ? DATA.params.apporteurs_paliers : undefined;
  return ApporteursRang.analyser({ now: now, periode: { debut: debut, fin: now }, apporteurs: DATA.apporteurs || [], clients: DATA.clients || [], versements: DATA.versements || [],
    commissions: DATA.commissions || [], enRetard: enRetard, soldes: soldes, paliers: paliers });
}
function aprPeriode(v) { APR.periode = v; aprRendre(); }
function aprTags(r) { return r.tags.map(function (t) { var s = APR_TAG[t.k] || ['#e2e8f0', '#475569', '•']; return '<span class="pl-chip" style="background:' + s[0] + ';color:' + s[1] + ';">' + s[2] + ' ' + aprH(t.t) + '</span>'; }).join(' '); }
function aprNom(a) { return ((a.prenoms || '') + ' ' + (a.nom || '')).trim(); }
function aprActions(r) {
  var a = r.apporteur, msg = ApporteursRang.messageRelance(r, (DATA.params && DATA.params.societe) || ''), wa = (typeof telWhatsApp === 'function' && a.tel) ? 'https://wa.me/' + telWhatsApp(a.tel) + '?text=' + encodeURIComponent(msg) : '';
  return (wa ? '<a class="btn btn-secondary btn-sm" href="' + aprH(wa) + '" target="_blank" rel="noopener" title="Message prêt à envoyer">💬</a> ' : '')
    + (a.tel ? '<a class="btn btn-secondary btn-sm" href="tel:' + aprH(String(a.tel).replace(/[^0-9+]/g, '')) + '">📞</a> ' : '')
    + '<button class="btn btn-secondary btn-sm" onclick="closeModal(\'modal-apr\');openApporteurModal(\'' + aprH(a.id) + '\')">✏️</button>';
}

function aprOuvrir() {
  var m = document.getElementById('modal-apr');
  if (!m) {
    m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'modal-apr';
    m.innerHTML = '<div class="modal" style="max-width:1040px;width:97vw;"><div class="modal-header"><h3>🏆 Classement des apporteurs</h3><button class="btn btn-secondary btn-icon" onclick="closeModal(\'modal-apr\')">✕</button></div>'
      + '<div class="modal-body" id="apr-body"></div><div class="modal-footer"><button class="btn btn-secondary" onclick="aprExporter()">⬇ CSV</button><button class="btn btn-secondary" onclick="closeModal(\'modal-apr\')">Fermer</button></div></div>';
    document.body.appendChild(m);
  }
  openModal('modal-apr'); aprRendre();
}

function aprRendre() {
  var b = document.getElementById('apr-body'); if (!b) return;
  var r = aprDonnees(), kpi = function (l, v, c) { return '<div class="kpi-card"><div class="kpi-label">' + l + '</div><div class="kpi-value" style="font-size:16px;' + (c ? 'color:' + c + ';' : '') + '">' + aprH(v) + '</div></div>'; };
  var h = '<div style="display:flex;gap:8px;margin-bottom:10px;align-items:center;flex-wrap:wrap;"><select class="form-control" style="max-width:190px;" onchange="aprPeriode(this.value)">'
    + [['30', '30 derniers jours'], ['90', '90 derniers jours'], ['365', '12 derniers mois'], ['tout', 'Depuis le début']].map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === APR.periode ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('')
    + '</select><span style="font-size:12px;color:var(--blanc-dim);">Classé par argent encaissé (hors frais de souscription).</span></div>';
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:12px;">'
    + kpi('Encaissé via apporteurs', aprF(r.total_encaisse)) + kpi('Ventes du réseau', r.ventes_reseau + ' / ' + r.ventes_total + (r.part_reseau != null ? ' (' + r.part_reseau + ' %)' : ''))
    + kpi('Poids des 3 premiers', r.top3_part != null ? r.top3_part + ' %' : '—', r.top3_part != null && r.top3_part >= 80 && r.classes.length > 3 ? 'var(--rouge)' : '')
    + kpi('Apporteurs dormants', String(r.nb_dormants), r.nb_dormants ? 'var(--or)' : 'var(--vert)') + kpi('Commissions à payer', aprF(r.commission_due_totale)) + '</div>';
  if (r.top3_part != null && r.top3_part >= 80 && r.classes.length > 3) h += '<div class="alert alert-warn" style="margin-bottom:10px;">⚠️ Dépendance : 3 apporteurs portent ' + r.top3_part + ' % de l\'encaissé. Perdre l\'un d\'eux se verrait immédiatement.</div>';
  if (!r.classes.length) h += '<p style="text-align:center;color:var(--blanc-dim);padding:18px;">Aucun encaissement ni vente via un apporteur sur cette période.</p>';
  else {
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;margin-bottom:12px;">' + r.classes.slice(0, 3).map(function (x, i) {
      return '<div class="kpi-card" style="text-align:center;"><div style="font-size:26px;">' + APR_MEDAILLE[i] + '</div><div style="font-weight:700;">' + aprH(aprNom(x.apporteur)) + '</div><div style="font-size:12px;">' + aprH(aprF(x.encaisse)) + ' · ' + x.ventes_n + ' vente(s)</div>' + (x.palier ? '<div style="font-size:11px;">Palier ' + aprH(x.palier) + '</div>' : '') + '</div>'; }).join('') + '</div>';
    h += '<div class="table-wrap"><table><thead><tr><th>#</th><th>Apporteur</th><th style="text-align:right;">Encaissé</th><th style="text-align:right;">Part</th><th style="text-align:right;">Ventes</th><th style="text-align:right;">Valeur vendue</th><th style="text-align:right;">Coût comm.</th><th style="text-align:right;">Retards</th><th>Dernière vente</th><th>Signaux</th><th></th></tr></thead><tbody>'
      + r.classes.map(function (x) {
        return '<tr><td>' + x.rang + '</td><td><strong>' + aprH(aprNom(x.apporteur)) + '</strong>' + (x.palier ? '<br><span style="font-size:11px;color:var(--blanc-dim);">' + aprH(x.palier) + ' · ' + x.ventes_12m + ' vente(s)/12 mois</span>' : '') + '</td>'
          + '<td style="text-align:right;">' + aprH(aprF(x.encaisse)) + '</td><td style="text-align:right;">' + Math.round(x.part * 100) + ' %</td><td style="text-align:right;">' + x.ventes_n + (x.resilies_n ? ' <span title="Résiliations" style="color:var(--rouge);">(−' + x.resilies_n + ')</span>' : '') + '</td>'
          + '<td style="text-align:right;">' + aprH(aprF(x.ventes_valeur)) + '</td><td style="text-align:right;">' + (x.cout_pct == null ? '—' : x.cout_pct + ' %') + '</td>'
          + '<td style="text-align:right;color:' + (x.taux_retard >= 0.4 && x.clients_n >= 3 ? 'var(--rouge)' : 'inherit') + ';">' + x.retard_n + '/' + x.clients_n + '</td><td>' + (x.jours_sans_vente == null ? '—' : 'il y a ' + x.jours_sans_vente + ' j') + '</td>'
          + '<td style="font-size:11px;">' + aprTags(x) + '</td><td style="white-space:nowrap;">' + aprActions(x) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  var aReveiller = r.autres.filter(function (x) { return x.tags.length; });
  if (aReveiller.length) h += '<h4 style="margin:14px 0 6px;">À réveiller ou à régulariser</h4><div class="table-wrap"><table><tbody>' + aReveiller.map(function (x) {
    return '<tr><td><strong>' + aprH(aprNom(x.apporteur)) + '</strong></td><td style="font-size:11px;">' + aprTags(x) + '</td><td style="white-space:nowrap;">' + aprActions(x) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  h += '<p style="font-size:11px;color:var(--blanc-dim);margin-top:10px;">Paliers de reconnaissance (ventes sur 12 mois) : Bronze 1 · Argent 3 · Or 6 · Platine 12, modifiables via <code>params.apporteurs_paliers</code>. Aucune prime n\'est calculée ici : la récompense est une décision de la direction.</p>';
  b.innerHTML = h;
}

function aprExporter() {
  var r = aprDonnees(), q = function (v) { var s = String(v == null ? '' : v); return /^[=+\-@]/.test(s) ? "'" + s : s; };
  var rows = [['Rang', 'Apporteur', 'Palier', 'Encaissé', 'Part %', 'Ventes', 'Valeur vendue', 'Résiliations', 'Coût commission %', 'Clients en retard', 'Clients', 'Jours sans vente', 'Commission due', 'Signaux']];
  r.classes.concat(r.autres).forEach(function (x) { rows.push([x.rang || '', aprNom(x.apporteur), x.palier || '', Math.round(x.encaisse), x.part != null ? Math.round(x.part * 1000) / 10 : '', x.ventes_n, Math.round(x.ventes_valeur), x.resilies_n, x.cout_pct == null ? '' : x.cout_pct, x.retard_n, x.clients_n, x.jours_sans_vente == null ? '' : x.jours_sans_vente, Math.round(x.commission_due), x.tags.map(function (t) { return t.t; }).join(' | ')]); });
  var csv = '﻿' + rows.map(function (l) { return l.map(q).join(';'); }).join('\r\n');
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'classement-apporteurs-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
