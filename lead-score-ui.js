/* Scoring des leads — interface (Pipeline Commercial). Dépend de lead-score.js et des globales de l'ERP. */
var LS = { ctx: null };
function lsH(x) { return typeof escHtml === 'function' ? escHtml(x) : String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
var LS_STYLE = { chaud: { ico: '🔥', bg: '#fee2e2', fg: '#b91c1c', lib: 'Chaud' }, tiede: { ico: '🟠', bg: '#fef3c7', fg: '#92400e', lib: 'Tiède' }, froid: { ico: '❄️', bg: '#e0f2fe', fg: '#075985', lib: 'Froid' } };

/* Contexte du jour : prix de référence par programme (lot disponible le moins cher) + taux réels par source. */
function lsPreparer() {
  var prix = {};
  (DATA.lots || []).forEach(function (l) {
    var p = parseFloat(l.prix) || 0; if (!(p > 0) || !l.programme_id || l.statut === 'vendu') return;
    if (!prix[l.programme_id] || p < prix[l.programme_id]) prix[l.programme_id] = p;
  });
  LS.ctx = LeadScore.contexte(DATA.leads || [], { ticket: (typeof _cmrcTicketMoyen === 'function') ? _cmrcTicketMoyen() : 0, prixProgramme: prix });
  LS.now = Date.now();
}
function lsScore(l) { if (!window.LeadScore) return null; if (!LS.ctx) lsPreparer(); return LeadScore.scorer(l, LS.ctx, LS.now); }

/* Pastille d'une carte du kanban (le détail s'affiche au survol). */
function lsChip(l) {
  var s = lsScore(l); if (!s) return '';
  var st = LS_STYLE[s.niveau], tip = s.raisons.map(function (r) { return r.texte + ' : ' + r.points + '/' + r.max; }).join('\n') + '\n→ ' + s.action;
  return '<span class="pl-chip" style="background:' + st.bg + ';color:' + st.fg + ';font-weight:700;" title="' + lsH(tip) + '">' + st.ico + ' ' + s.score + '</span>';
}
/* Tri d'une colonne : les plus chauds en haut. */
function lsTrier(leads) {
  if (!window.LeadScore) return leads;
  return leads.slice().sort(function (a, b) { var x = lsScore(a), y = lsScore(b); return ((y ? y.score : -1) - (x ? x.score : -1)) || ((parseFloat(b.budget) || 0) - (parseFloat(a.budget) || 0)); });
}

/* Liste « À appeler en premier ». */
function lsOuvrir() {
  var m = document.getElementById('modal-ls');
  if (!m) {
    m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'modal-ls';
    m.innerHTML = '<div class="modal" style="max-width:940px;width:96vw;"><div class="modal-header"><h3>🎯 À appeler en premier</h3><button class="btn btn-secondary btn-icon" onclick="closeModal(\'modal-ls\')">✕</button></div>'
      + '<div class="modal-body" id="ls-body"></div><div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal(\'modal-ls\')">Fermer</button></div></div>';
    document.body.appendChild(m);
  }
  openModal('modal-ls'); lsRendre();
}
function lsRendre() {
  var b = document.getElementById('ls-body'); if (!b) return;
  lsPreparer();
  var cl = LeadScore.classer(DATA.leads || [], LS.ctx, LS.now), n = { chaud: 0, tiede: 0, froid: 0 };
  cl.forEach(function (x) { n[x.s.niveau]++; });
  var h = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">'
    + ['chaud', 'tiede', 'froid'].map(function (k) { var st = LS_STYLE[k]; return '<div class="kpi-card"><div class="kpi-label">' + st.ico + ' ' + st.lib + '</div><div class="kpi-value">' + n[k] + '</div></div>'; }).join('') + '</div>';
  if (!cl.length) { b.innerHTML = h + '<p style="text-align:center;color:var(--blanc-dim);padding:20px;">Aucun prospect ouvert.</p>'; return; }
  h += '<p style="font-size:12px;color:var(--blanc-dim);margin-bottom:8px;">Score sur 100 : avancement 30 · fraîcheur 20 · budget 15 · source 15 · joignabilité 10 · suivi 10. Les poids sont des repères métier, à ajuster avec l\'expérience. Survolez un score pour le détail.</p>'
    + '<div class="table-wrap"><table><thead><tr><th>Score</th><th>Prospect</th><th>Stade</th><th>Budget</th><th>Action recommandée</th><th></th></tr></thead><tbody>'
    + cl.slice(0, 25).map(function (x) {
      var l = x.lead, s = x.s, st = LS_STYLE[s.niveau], wa = (typeof telWhatsApp === 'function' && l.tel) ? 'https://wa.me/' + telWhatsApp(l.tel) : '';
      var tip = s.raisons.map(function (r) { return r.texte + ' : ' + r.points + '/' + r.max; }).join('\n');
      return '<tr><td title="' + lsH(tip) + '"><span class="pl-chip" style="background:' + st.bg + ';color:' + st.fg + ';font-weight:700;">' + st.ico + ' ' + s.score + '</span></td>'
        + '<td><strong>' + lsH(l.nom) + '</strong><br><span style="font-size:11px;color:var(--blanc-dim);">' + lsH(l.tel || '') + '</span></td>'
        + '<td>' + lsH((l.stade || '').replace(/_/g, ' ')) + '</td><td>' + (l.budget ? lsH((typeof fmtF === 'function' ? fmtF(l.budget) : l.budget) + ' F') : '—') + '</td>'
        + '<td style="font-size:12px;">' + lsH(s.action) + '</td>'
        + '<td style="white-space:nowrap;">' + (l.tel ? '<a class="btn btn-primary btn-sm" href="tel:' + lsH(String(l.tel).replace(/[^0-9+]/g, '')) + '">📞</a> ' : '') + (wa ? '<a class="btn btn-secondary btn-sm" href="' + lsH(wa) + '" target="_blank" rel="noopener">💬</a> ' : '')
        + '<button class="btn btn-secondary btn-sm" onclick="closeModal(\'modal-ls\');openLead(\'' + lsH(l.id) + '\')">✏️</button></td></tr>';
    }).join('') + '</tbody></table></div>' + (cl.length > 25 ? '<p style="font-size:12px;color:var(--blanc-dim);margin-top:6px;">25 premiers sur ' + cl.length + '.</p>' : '');
  b.innerHTML = h;
}
