/* Relances WhatsApp — interface (page « Relances Clients »). Dépend de wa-relances.js et des globales de l'ERP.
   Flux : calcul local de la file du jour → aperçu et cases à cocher → envoi par l'Edge Function wa-relances
   (lien de paiement + modèle WhatsApp approuvé) → journal local + cloud (wa_relances_log). */
var WAREL = { file: [], ignores: [], log: [], optout: {}, enCours: false };

function waRelCfg() { return (DATA.params && DATA.params.wa_relances) || {}; }
function waRelBase() { return (SB.url || '').replace(/\/+$/, '') + '/functions/v1'; }
function waRelH(x) { return typeof escHtml === 'function' ? escHtml(x) : String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
var WAREL_STATUT = { en_cours: '⏳ En cours', envoye: '📤 Envoyé', delivre: '✅ Remis', lu: '👁 Lu', echec: '❌ Échec' };
var WAREL_LIB = { 'J-3': 'J −3 (avant échéance)', 'J0': 'J 0 (échéance)', 'J3': 'J +3', 'J10': 'J +10' };
var WAREL_RAISON = { escalade_humaine: 'Retard ≥ 3 mois : décision humaine', telephone_invalide: 'Téléphone invalide', desinscrit: 'Désinscrit (STOP)', deja_envoye: 'Déjà envoyé' };

/* Entrées du calcul : tous les souscripteurs actifs non soldés, hors financement bancaire. */
function waRelEntrees(now) {
  var verses = {};
  (DATA.versements || []).forEach(function (v) { if (v.statut !== 'annule' && _versementSurPrix(v)) verses[v.client_id] = (verses[v.client_id] || 0) + (parseFloat(v.montant) || 0); });
  var out = [];
  (DATA.clients || []).forEach(function (c) {
    var total = parseFloat(c.montant_total) || 0, verse = verses[c.id] || 0;
    if (!(total > 0) || verse >= total || c.statut === 'resilie' || c.statut === 'inactif' || clientFinancementBancaire(c)) return;
    var e = echeancierClient(c, now, verse); if (!e) return;
    var ech = WaRelances.echeances(e.dateAncre, now); if (!ech) return;
    var ea = echeancierClient(c, ech.prochaine, verse);
    var lot = (DATA.lots || []).find(function (l) { return l.id === c.lot_id; });
    out.push({ client_id: c.id, nom: c.nom, prenom: (c.prenoms || c.nom || '').trim(), tel: c.tel,
      dossier: c.dossier || (lot ? 'lot ' + lot.numero : 'votre dossier'), ancre: e.dateAncre, ecart: e.ecart, moisRetard: e.moisRetard,
      ecartAvenir: ea ? ea.ecart : 0, mensualite: e.mensualite });
  });
  return out;
}

async function waRelChargerCloud() {
  var log = await sbFetch('wa_relances_log?select=client_id,cycle,palier,statut,montant,cree_le,erreur&order=cree_le.desc&limit=500', 'GET');
  var stop = await sbFetch('wa_optout?select=tel', 'GET');
  WAREL.log = Array.isArray(log) ? log : [];
  WAREL.optout = {}; (Array.isArray(stop) ? stop : []).forEach(function (r) { WAREL.optout[r.tel] = true; });
  return Array.isArray(log);
}

async function waRelPreparer() {
  var ok = await waRelChargerCloud();
  var deja = {};
  WAREL.log.forEach(function (l) { if (l.statut !== 'echec') deja[WaRelances.cle(l.client_id, l.cycle, l.palier)] = true; });
  var r = WaRelances.construireFile(waRelEntrees(new Date()), deja, WAREL.optout, new Date());
  WAREL.file = r.file; WAREL.ignores = r.ignores;
  waRelRendre(ok);
}

function waRelOuvrir() {
  if (!SB.url || !SB.key) { toast('Configurez Supabase (Paramètres › Cloud) avant.', 'error'); return; }
  var m = document.getElementById('modal-wa-relances');
  if (!m) {
    m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'modal-wa-relances';
    m.innerHTML = '<div class="modal" style="max-width:920px;width:96vw;"><div class="modal-header"><h3>📲 Campagne de relances WhatsApp</h3>'
      + '<button class="btn btn-secondary btn-icon" onclick="closeModal(\'modal-wa-relances\')">✕</button></div>'
      + '<div class="modal-body" id="wa-rel-body"></div>'
      + '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal(\'modal-wa-relances\')">Fermer</button>'
      + '<button class="btn btn-primary" id="wa-rel-envoyer" onclick="waRelEnvoyer()">📲 Envoyer la sélection</button></div></div>';
    document.body.appendChild(m);
  }
  document.getElementById('wa-rel-body').innerHTML = '<p style="color:var(--blanc-dim);">⏳ Calcul de la file du jour…</p>';
  openModal('modal-wa-relances');
  waRelPreparer();
}

function waRelRendre(cloudOk) {
  var cfg = waRelCfg(), b = document.getElementById('wa-rel-body'); if (!b) return;
  var admin = typeof hasRole === 'function' && hasRole('admin');
  var h = '';
  h += '<div class="alert ' + (cfg.actif ? 'alert-info' : 'alert-warn') + '" style="margin-bottom:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
    + '<span>' + (cfg.actif ? '🟢 Envoi activé' : '🟠 Envoi désactivé') + ' — passerelle : <strong>' + waRelH(cfg.provider === 'paydunya' ? 'PayDunya' : 'CinetPay') + '</strong></span>'
    + (admin ? '<button class="btn btn-secondary btn-sm" onclick="waRelBasculer()">' + (cfg.actif ? 'Désactiver' : 'Activer') + '</button>' : '')
    + '</div>';
  if (!cloudOk) h += '<div class="alert alert-warn" style="margin-bottom:12px;">⚠️ Journal cloud inaccessible : les doublons ne peuvent pas être contrôlés ici (le serveur les bloque quand même). Appliquez <code>supabase/wa_relances.sql</code> si ce message persiste.</div>';
  var par = {}; WAREL.file.forEach(function (x) { par[x.palier] = (par[x.palier] || 0) + 1; });
  h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;">'
    + WaRelances.PALIERS.map(function (p) { return '<div class="kpi-card"><div class="kpi-label">' + WAREL_LIB[p] + '</div><div class="kpi-value">' + (par[p] || 0) + '</div></div>'; }).join('') + '</div>';
  if (!WAREL.file.length) h += '<p style="color:var(--vert);padding:16px;text-align:center;">✅ Rien à envoyer aujourd\'hui.</p>';
  else {
    var total = WAREL.file.reduce(function (t, x) { return t + x.montant; }, 0);
    h += '<div class="table-wrap"><table><thead><tr><th><input type="checkbox" checked onchange="waRelTout(this.checked)"></th><th>Client</th><th>Palier</th><th>Montant</th><th>Aperçu du message</th></tr></thead><tbody>'
      + WAREL.file.map(function (x, i) {
        var apercu = WaRelances.rendreTexte(x.palier, { prenom: x.prenom, montant: WaRelances.formatMontant(x.montant), dossier: x.dossier, lien: '[lien de paiement]', societe: (DATA.params && DATA.params.societe) || '' });
        return '<tr><td><input type="checkbox" class="wa-rel-ck" data-i="' + i + '" checked></td><td><strong>' + waRelH(x.nom + ' ' + x.prenom) + '</strong><br><span style="font-size:11px;color:var(--blanc-dim);">+' + waRelH(x.tel) + '</span></td>'
          + '<td>' + waRelH(x.palier) + '</td><td>' + waRelH(WaRelances.formatMontant(x.montant)) + '</td><td style="font-size:11px;max-width:340px;white-space:pre-wrap;">' + waRelH(apercu) + '</td></tr>';
      }).join('') + '</tbody></table></div>'
      + '<p style="font-size:12px;color:var(--blanc-dim);margin-top:8px;">Montant total à recouvrer : <strong>' + waRelH(WaRelances.formatMontant(total)) + '</strong>. Chaque message contient un lien de paiement unique (Wave, Orange Money, MTN, carte) et la mention STOP.</p>';
  }
  if (WAREL.ignores.length) {
    var cnt = {}; WAREL.ignores.forEach(function (x) { cnt[x.raison] = (cnt[x.raison] || 0) + 1; });
    h += '<p style="font-size:12px;color:var(--blanc-dim);margin-top:8px;">Ignorés : ' + Object.keys(cnt).filter(function (k) { return k !== 'deja_envoye'; }).map(function (k) { return cnt[k] + ' × ' + waRelH(WAREL_RAISON[k] || k); }).join(' · ') + (cnt.deja_envoye ? ' · ' + cnt.deja_envoye + ' déjà envoyé(s)' : '') + '</p>';
  }
  if (WAREL.log.length) {
    h += '<details style="margin-top:12px;"><summary style="cursor:pointer;">Journal des envois récents (' + WAREL.log.length + ')</summary><div class="table-wrap"><table><thead><tr><th>Date</th><th>Client</th><th>Palier</th><th>Montant</th><th>Statut</th></tr></thead><tbody>'
      + WAREL.log.slice(0, 50).map(function (l) {
        var c = (DATA.clients || []).find(function (x) { return x.id === l.client_id; });
        return '<tr><td style="font-size:11px;">' + waRelH(String(l.cree_le).slice(0, 16).replace('T', ' ')) + '</td><td>' + waRelH(c ? c.nom + ' ' + (c.prenoms || '') : l.client_id) + '</td><td>' + waRelH(l.palier) + '</td><td>' + waRelH(WaRelances.formatMontant(l.montant)) + '</td><td title="' + waRelH(l.erreur || '') + '">' + (WAREL_STATUT[l.statut] || waRelH(l.statut)) + '</td></tr>';
      }).join('') + '</tbody></table></div></details>';
  }
  b.innerHTML = h;
  var btn = document.getElementById('wa-rel-envoyer'); if (btn) { btn.disabled = !WAREL.file.length || !cfg.actif; btn.title = cfg.actif ? '' : 'Activez l\'envoi pour continuer'; }
}

function waRelTout(v) { document.querySelectorAll('.wa-rel-ck').forEach(function (c) { c.checked = v; }); }

async function waRelBasculer() {
  if (typeof hasRole !== 'function' || !hasRole('admin')) { toast('Réservé à l\'administrateur.', 'error'); return; }
  DATA.params = DATA.params || {};
  var c = Object.assign({ provider: 'cinetpay', devise: 'XOF' }, DATA.params.wa_relances || {});
  c.actif = !c.actif; c.societe = c.societe || DATA.params.societe || '';
  DATA.params.wa_relances = c;
  await dbPut('params', DATA.params);
  if (typeof syncToSupabase === 'function') syncToSupabase('pi_params', DATA.params);
  waRelRendre(true);
}

async function waRelEnvoyer() {
  if (WAREL.enCours) return;
  var idx = []; document.querySelectorAll('.wa-rel-ck').forEach(function (c) { if (c.checked) idx.push(+c.getAttribute('data-i')); });
  var sel = idx.map(function (i) { return WAREL.file[i]; }).filter(Boolean);
  if (!sel.length) { toast('Aucune ligne sélectionnée.', 'warn'); return; }
  if (!confirm('Envoyer ' + sel.length + ' message(s) WhatsApp avec lien de paiement ?')) return;
  WAREL.enCours = true;
  var btn = document.getElementById('wa-rel-envoyer'); if (btn) { btn.disabled = true; btn.textContent = '⏳ Envoi…'; }
  var envoyes = 0, echecs = 0, refus = 0;
  try {
    for (var k = 0; k < sel.length; k += 20) {   /* lots de 20 : reste sous le délai d'une Edge Function */
      var lot = sel.slice(k, k + 20).map(function (x) { return { client_id: x.client_id, palier: x.palier, cycle: x.cycle, montant: x.montant, mois_retard: x.mois_retard }; });
      var r = await fetch(waRelBase() + '/wa-relances', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB.key, Authorization: 'Bearer ' + sbAuth() }, body: JSON.stringify({ items: lot }) });
      var d = await r.json().catch(function () { return {}; });
      if (!r.ok || !d.ok) { toast('Envoi interrompu : ' + (d.error || ('HTTP ' + r.status)), 'error', 8000); break; }
      for (var j = 0; j < d.resultats.length; j++) {
        var x = d.resultats[j];
        if (x.statut === 'envoye') { envoyes++; await waRelJournaliser(x); }
        else if (x.statut === 'echec') echecs++; else refus++;
      }
    }
  } catch (e) { toast('Envoi interrompu : ' + e.message, 'error', 8000); }
  WAREL.enCours = false;
  if (btn) btn.textContent = '📲 Envoyer la sélection';
  toast('📲 ' + envoyes + ' envoyé(s)' + (echecs ? ', ' + echecs + ' échec(s)' : '') + (refus ? ', ' + refus + ' ignoré(s)' : '') + '.', echecs ? 'warn' : 'success', 7000);
  await waRelPreparer();
  if (typeof detectRelances === 'function') detectRelances();
}

/* La relance WhatsApp apparaît aussi dans l'historique du dossier (colonne « Dernière relance », règle « à traiter aujourd'hui »). */
async function waRelJournaliser(res) {
  var it = WAREL.file.find(function (x) { return x.client_id === res.client_id && x.palier === res.palier; }); if (!it) return;
  var rel = { id: uid(), client_id: res.client_id, date: today(), type: 'whatsapp_auto', niveau: 'rappel', mois_retard: it.mois_retard,
    notes: 'WhatsApp ' + res.palier + ' — ' + WaRelances.formatMontant(it.montant) + ' — ' + (res.payment_url || ''), created_at: today() };
  DATA.relances = DATA.relances || []; DATA.relances.push(rel);
  try { await dbPut('relances', rel); if (typeof syncToSupabase === 'function') syncToSupabase('pi_relances', rel); } catch (e) { /* le journal serveur fait foi */ }
}
