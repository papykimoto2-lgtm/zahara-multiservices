/* Rentabilité locative — interface (page Gestion locative). Dépend de rentabilite-locative.js et des globales de l'ERP. */
var RLO = {};
function rloH(x) { return typeof escHtml === 'function' ? escHtml(x) : String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function rloF(n) { return (typeof fmtF === 'function' ? fmtF(Math.round(n || 0)) : String(Math.round(n || 0))) + ' F'; }
var RLO_ICO = { vacance: '🕳', recouvrement: '💸', entretien: '🔧', sous_loue: '📉', fin_proche: '⏳', revision: '📈' };
var RLO_NIV = { rouge: ['#fee2e2', '#b91c1c'], orange: ['#fef3c7', '#92400e'] };

function rloDonnees() {
  return RentabiliteLocative.analyser({ now: Date.now(), biens: (typeof _blL === 'function' ? _blL() : DATA.biens_locatifs) || [], baux: DATA.baux || [], quittances: DATA.quittances || [], travaux: DATA.ordres_travaux || [],
    params: DATA.params && DATA.params.rentabilite_locative });
}

function rloOuvrir() {
  var m = document.getElementById('modal-rlo');
  if (!m) {
    m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'modal-rlo';
    m.innerHTML = '<div class="modal" style="max-width:1040px;width:97vw;"><div class="modal-header"><h3>📉 Rentabilité locative</h3><button class="btn btn-secondary btn-icon" onclick="closeModal(\'modal-rlo\')">✕</button></div>'
      + '<div class="modal-body" id="rlo-body"></div><div class="modal-footer"><button class="btn btn-secondary" onclick="rloExporter()">⬇ CSV</button><button class="btn btn-secondary" onclick="closeModal(\'modal-rlo\')">Fermer</button></div></div>';
    document.body.appendChild(m);
  }
  openModal('modal-rlo'); rloRendre();
}

function rloRendre() {
  var b = document.getElementById('rlo-body'); if (!b) return;
  var r = rloDonnees(), T = r.total, P = r.cfg, kpi = function (l, v, c) { return '<div class="kpi-card"><div class="kpi-label">' + l + '</div><div class="kpi-value" style="font-size:16px;' + (c ? 'color:' + c + ';' : '') + '">' + rloH(v) + '</div></div>'; };
  if (!r.biens.length) { b.innerHTML = '<p style="text-align:center;color:var(--blanc-dim);padding:20px;">Aucun bien locatif enregistré.</p>'; return; }
  var h = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:10px;">'
    + kpi('Taux d\'occupation', T.occupation_pct == null ? '—' : T.occupation_pct + ' % (' + T.loues + '/' + T.biens + ')', T.occupation_pct != null && T.occupation_pct < 80 ? 'var(--rouge)' : '')
    + kpi('Perte mensuelle (vacance)', rloF(T.perte_mensuelle), T.perte_mensuelle ? 'var(--rouge)' : 'var(--vert)') + kpi('Manque à gagner 12 mois', rloF(T.manque_a_gagner_12m))
    + kpi('Impayés', rloF(T.impaye), T.impaye ? 'var(--rouge)' : 'var(--vert)') + kpi('Potentiel de sous-loyer / an', rloF(T.potentiel_sous_loyer)) + '</div>';
  h += '<h4 style="margin:10px 0 6px;">Alertes (' + r.alertes.length + ')</h4>';
  if (!r.alertes.length) h += '<p style="color:var(--vert);font-size:12px;">✅ Aucun bien ne perd d\'argent selon les seuils actuels.</p>';
  else h += '<div class="table-wrap"><table><tbody>' + r.alertes.slice(0, 30).map(function (a) {
    var s = RLO_NIV[a.niveau];
    return '<tr><td style="white-space:nowrap;"><span class="pl-chip" style="background:' + s[0] + ';color:' + s[1] + ';">' + (RLO_ICO[a.k] || '•') + '</span></td><td><strong>' + rloH(a.nom) + '</strong></td><td style="font-size:12px;">' + rloH(a.texte) + '</td>'
      + '<td style="text-align:right;white-space:nowrap;">' + (a.montant != null ? rloH(rloF(a.montant)) : '—') + '</td><td><button class="btn btn-secondary btn-sm" onclick="closeModal(\'modal-rlo\');blOpen(\'' + rloH(a.bien_id) + '\')">✏️ Bien</button></td></tr>';
  }).join('') + '</tbody></table></div>';

  h += '<h4 style="margin:14px 0 6px;">Biens</h4><div class="table-wrap"><table><thead><tr><th>Bien</th><th>Statut</th><th style="text-align:right;">Loyer</th><th style="text-align:right;">Occupation 12 m</th><th style="text-align:right;">Recouvrement</th><th style="text-align:right;">Impayé</th><th style="text-align:right;">Travaux 12 m</th><th style="text-align:right;">F/m²</th></tr></thead><tbody>'
    + r.biens.map(function (l) {
      return '<tr><td><strong>' + rloH(l.nom) + '</strong></td><td>' + (l.statut === 'loue' ? '🟢 Loué' : l.statut === 'travaux' ? '🛠 Travaux' : '🔴 Vacant' + (l.vacance_courante ? ' (' + l.vacance_courante + ' j)' : '')) + '</td>'
        + '<td style="text-align:right;">' + rloH(rloF(l.loyer)) + '</td><td style="text-align:right;">' + l.occupation_pct + ' %</td><td style="text-align:right;">' + (l.taux_recouvrement == null ? '—' : l.taux_recouvrement + ' %') + '</td>'
        + '<td style="text-align:right;">' + rloH(rloF(l.impaye)) + '</td><td style="text-align:right;">' + rloH(rloF(l.travaux_total)) + '</td><td style="text-align:right;">' + (l.loyer_m2 == null ? '—' : l.loyer_m2 + (l.mediane_m2 ? ' <span style="color:var(--blanc-dim);">/ ' + l.mediane_m2 + '</span>' : '')) + '</td></tr>';
    }).join('') + '</tbody></table></div>';

  var adm = typeof hasRole === 'function' && hasRole('admin'), d = adm ? '' : ' disabled';
  h += '<details style="margin-top:12px;"><summary style="cursor:pointer;font-weight:600;">Seuils d\'alerte</summary><div class="form-grid" style="margin-top:8px;">'
    + '<div class="form-group"><label>Vacance : alerte après (jours)</label><input class="form-control" type="number" min="1" id="rlo-vac" value="' + rloH(P.seuil_vacance_j) + '"' + d + '></div>'
    + '<div class="form-group"><label>Recouvrement minimal (%)</label><input class="form-control" type="number" min="1" max="100" id="rlo-rec" value="' + rloH(P.seuil_recouvrement_pct) + '"' + d + '></div>'
    + '<div class="form-group"><label>Entretien maximal (% des loyers)</label><input class="form-control" type="number" min="1" id="rlo-ent" value="' + rloH(P.seuil_entretien_pct) + '"' + d + '></div>'
    + '<div class="form-group"><label>Sous-location : écart à la médiane (%)</label><input class="form-control" type="number" min="1" max="90" id="rlo-sou" value="' + rloH(P.seuil_sous_location_pct) + '"' + d + '></div>'
    + '<div class="form-group"><label>Fin de bail : prévenir (jours)</label><input class="form-control" type="number" min="1" id="rlo-fin" value="' + rloH(P.fin_bail_j) + '"' + d + '></div>'
    + '<div class="form-group"><label>Taux de révision annuel (%) — pour chiffrer le gain</label><input class="form-control" type="number" min="0" step="0.1" id="rlo-rev" value="' + (P.taux_revision_pct == null ? '' : rloH(P.taux_revision_pct)) + '" placeholder="non saisi"' + d + '></div></div>'
    + (adm ? '<button class="btn btn-primary btn-sm" onclick="rloSeuilsSauver()">Enregistrer</button>' : '<p style="font-size:12px;color:var(--blanc-dim);">Réservé à l\'administrateur.</p>') + '</details>'
    + '<p style="font-size:11px;color:var(--blanc-dim);margin-top:8px;">Fenêtre : 12 derniers mois. Vacance = jours sans bail actif ou en préavis. Sous-location : médiane du loyer au m² du parc, même commune et même type (3 biens comparables au moins). Une alerte sans base chiffrée n\'affiche pas de montant.</p>';
  b.innerHTML = h;
}

async function rloSeuilsSauver() {
  if (typeof hasRole !== 'function' || !hasRole('admin')) { toast('Réservé à l\'administrateur.', 'error'); return; }
  var g = function (i) { return parseFloat(document.getElementById(i).value); }, v = g('rlo-vac'), rc = g('rlo-rec'), en = g('rlo-ent'), so = g('rlo-sou'), fi = g('rlo-fin'), rv = document.getElementById('rlo-rev').value.trim();
  if ([v, rc, en, so, fi].some(function (x) { return isNaN(x) || x <= 0; }) || rc > 100 || so >= 100 || (rv !== '' && (isNaN(parseFloat(rv)) || parseFloat(rv) < 0))) { toast('Valeurs invalides.', 'error'); return; }
  DATA.params = DATA.params || {};
  DATA.params.rentabilite_locative = { seuil_vacance_j: v, seuil_recouvrement_pct: rc, seuil_entretien_pct: en, seuil_sous_location_pct: so, fin_bail_j: fi, taux_revision_pct: rv === '' ? null : parseFloat(rv) };
  await dbPut('params', DATA.params); if (typeof syncToSupabase === 'function') syncToSupabase('pi_params', DATA.params); toast('Seuils enregistrés.', 'success'); rloRendre();
}

function rloExporter() {
  var r = rloDonnees(), q = function (v) { var s = String(v == null ? '' : v); return /^[=+\-@]/.test(s) ? "'" + s : s; };
  var rows = [['Bien', 'Statut', 'Loyer', 'Occupation 12 mois %', 'Vacance courante (j)', 'Manque à gagner 12 mois', 'Quitté 12 mois', 'Encaissé 12 mois', 'Recouvrement %', 'Impayé', 'Travaux 12 mois', 'Travaux à notre charge', 'Loyer F/m²', 'Médiane F/m²', 'Alertes']];
  r.biens.forEach(function (l) { rows.push([l.nom, l.statut, l.loyer, l.occupation_pct, l.vacance_courante, l.manque_a_gagner, l.quitte, l.encaisse, l.taux_recouvrement == null ? '' : l.taux_recouvrement, l.impaye, l.travaux_total, l.travaux_nous, l.loyer_m2 == null ? '' : l.loyer_m2, l.mediane_m2 == null ? '' : l.mediane_m2, l.alertes.map(function (a) { return a.texte; }).join(' | ')]); });
  var csv = '﻿' + rows.map(function (l) { return l.map(q).join(';'); }).join('\r\n');
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'rentabilite-locative-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
