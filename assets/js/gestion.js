/* SAFE : page de gestion (disponibilités, séances à venir, annulation par SAFE, packs payés en espèces).
   Le code est vérifié par le script Google (propriété ADMIN_CODE) ; il n'est gardé qu'en mémoire, jamais enregistré. */
(function () {
  'use strict';
  document.documentElement.classList.remove('sans-js');
  var API = (window.SITE_CONFIG || {}).apiReservation;
  var code = '', donnees = null;
  var form = document.getElementById('g-connexion'), zone = document.getElementById('g-contenu'), err = document.getElementById('g-erreur');

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  function euros(v) { var n = Math.round(Number(v) * 100) / 100; return (n % 1 ? n.toFixed(2).replace('.', ',') : n) + ' €'; }
  function date(iso, opts) { return new Intl.DateTimeFormat('fr-FR', Object.assign({ timeZone: 'Europe/Paris' }, opts)).format(new Date(iso)); }
  function post(corps) {
    corps.code = code; corps.lang = corps.lang || 'fr';
    return fetch(API, { method: 'POST', body: JSON.stringify(corps) }).then(function (r) { return r.json(); });
  }
  var STATUTS = { paye: 'payé en ligne', a_regler: 'à régler', sans_objet: 'rien à payer', annule: 'annulé', rembourse: 'remboursé' };
  var MODES = { enligne: 'PayPal', lien: 'lien PayPal', especes: 'espèces', pack: 'pack', virement: 'PayPal avant la séance' };

  if (!API) { err.hidden = false; err.textContent = 'Le site est en mode démonstration : la gestion n\'est pas disponible.'; form.querySelector('button').disabled = true; return; }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    code = document.getElementById('g-code').value.trim();
    err.hidden = true;
    charger();
  });

  function charger() {
    zone.hidden = false; zone.innerHTML = '<p class="chargement">Chargement…</p>';
    post({ action: 'admin_liste' }).then(function (r) {
      if (!r.ok) { zone.hidden = true; err.hidden = false; err.textContent = r.message || 'Erreur.'; return; }
      donnees = r; form.hidden = true; dessiner();
    }).catch(function () { zone.hidden = true; err.hidden = false; err.textContent = 'Le serveur ne répond pas. Réessayez.'; });
  }

  function dessiner() {
    zone.innerHTML = '';
    zone.appendChild(el('<p style="display:flex;gap:.8rem;flex-wrap:wrap"><a class="btn btn-clair" href="#g-dispos">Disponibilités</a><a class="btn btn-clair" href="#g-seances">Séances</a><a class="btn btn-clair" href="#g-nouveau-pack">Pack payé en espèces</a><a class="btn btn-clair" href="#g-packs">Packs</a></p>'));
    zone.appendChild(sectionDispos());
    zone.appendChild(sectionSeances());
    zone.appendChild(sectionNouveauPack());
    zone.appendChild(sectionPacks());
  }

  // ---------------------------------------------------------------- Disponibilités
  var TYPES = { tous: 'chez le client et en ligne', domicile: 'chez le client seulement', enligne: 'en ligne seulement' };
  function jourIso(plus) { var d = new Date(Date.now() + (plus || 0) * 86400e3); return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d); }
  function jourLong(iso) { return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso + 'T12:00:00Z')); }
  function jourCourt(iso) { return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso + 'T12:00:00Z')); }
  function h(x) { var m = x.split(':'); return Number(m[0]) + ' h' + (m[1] === '00' ? '' : ' ' + m[1]); }
  function majuscule(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

  function rechargerDispos(message) {
    post({ action: 'admin_liste' }).then(function (x) {
      if (!x.ok) return;
      donnees = x;
      var anc = document.getElementById('g-dispos'), nv = sectionDispos();
      anc.parentNode.replaceChild(nv, anc);
      if (message) { var st = nv.querySelector('.statut'); st.className = 'statut ok'; st.textContent = message; }
    });
  }

  function sectionDispos() {
    var s = el('<section id="g-dispos" style="margin-top:2rem"><h2>Disponibilités</h2>' +
      '<p>Les créneaux ouverts ici sont proposés aux clients sur le site (réservation au moins 24 h avant). Vos rendez-vous personnels de Google Agenda continuent de bloquer les créneaux.</p>' +
      '<form class="encadre" novalidate style="max-width:40rem"><h3 style="margin-top:0">Ouvrir un créneau</h3><div class="grille-champs">' +
      '<div class="champ"><label for="d-date">Date</label><input id="d-date" type="date" required min="' + jourIso(0) + '" value="' + jourIso(1) + '"></div>' +
      '<div class="champ"><label for="d-type">Pour</label><select id="d-type"><option value="tous">Chez le client et en ligne</option><option value="domicile">Chez le client seulement</option><option value="enligne">En ligne seulement</option></select></div>' +
      '<div class="champ"><label for="d-de">De</label><input id="d-de" type="time" step="900" value="09:00" required></div>' +
      '<div class="champ"><label for="d-a">À</label><input id="d-a" type="time" step="900" value="12:00" required></div>' +
      '</div>' +
      '<div class="case"><input type="checkbox" id="d-repeter"><label for="d-repeter" id="d-repeter-texte">Répéter chaque semaine</label></div>' +
      '<div class="champ" id="d-jusqu-champ" style="display:none"><label for="d-jusqu">Jusqu\'au</label><input id="d-jusqu" type="date"></div>' +
      '<p><button type="submit" class="btn">Ouvrir le créneau</button></p><p class="statut" role="status"></p></form>' +
      '<div class="d-liste" style="margin-top:1.5rem"></div></section>');
    var f = s.querySelector('form');
    var dDate = f.querySelector('#d-date'), dRep = f.querySelector('#d-repeter'), dJ = f.querySelector('#d-jusqu');
    function majRepeter() {
      var j = dDate.value;
      f.querySelector('#d-repeter-texte').textContent = 'Répéter chaque semaine' + (j ? ', tous les ' + jourLong(j).split(' ')[0] + 's' : '');
      f.querySelector('#d-jusqu-champ').style.display = dRep.checked ? '' : 'none';
      if (j) { dJ.min = j; if (!dJ.value || dJ.value < j) { var d = new Date(j + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 3); dJ.value = d.toISOString().slice(0, 10); } }
    }
    dDate.addEventListener('change', majRepeter); dRep.addEventListener('change', majRepeter); majRepeter();
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var st = f.querySelector('.statut'), btn = f.querySelector('button[type=submit]');
      var corps = { action: 'admin_dispo_ajouter', date: dDate.value, de: f.querySelector('#d-de').value, a: f.querySelector('#d-a').value,
        type: f.querySelector('#d-type').value, repeter: dRep.checked, jusqu: dJ.value };
      btn.disabled = true; st.className = 'statut'; st.textContent = 'Enregistrement…';
      post(corps).then(function (r) {
        btn.disabled = false;
        if (!r.ok) { st.className = 'statut ko'; st.textContent = r.message || 'Erreur.'; return; }
        rechargerDispos(r.nb > 1 ? r.nb + ' créneaux ouverts (chaque semaine jusqu\'au ' + jourCourt(corps.jusqu) + ').' : 'Créneau ouvert.');
      }).catch(function () { btn.disabled = false; st.className = 'statut ko'; st.textContent = 'Le serveur ne répond pas. Réessayez.'; });
    });

    var liste = s.querySelector('.d-liste'), dispos = donnees.dispos || [];
    if (!dispos.length) { liste.appendChild(el('<p>Aucun créneau ouvert pour le moment.</p>')); return s; }
    liste.appendChild(el('<h3>Créneaux ouverts</h3>'));
    var jourCourant = null, bloc = null;
    dispos.forEach(function (x) {
      if (x.jour !== jourCourant) {
        jourCourant = x.jour;
        liste.appendChild(el('<h4 style="margin:1.2rem 0 .4rem">' + esc(majuscule(jourLong(x.jour))) + '</h4>'));
        bloc = el('<div></div>'); liste.appendChild(bloc);
      }
      var regle = x.serie ? ' · chaque ' + esc((x.regle && x.regle.jour) || 'semaine') + (x.regle && x.regle.jusqu ? ' jusqu\'au ' + esc(jourCourt(x.regle.jusqu)) : '') : '';
      var carte = el('<div class="encadre" style="margin-bottom:.6rem;padding:.8rem 1rem">' +
        '<p style="margin:0"><strong>' + h(x.de) + ' à ' + h(x.a) + '</strong> · ' + esc(TYPES[x.type]) + '<span class="petit">' + regle + '</span>' +
        (x.reservees ? '<br><span class="petit">' + x.reservees + ' séance' + (x.reservees > 1 ? 's' : '') + ' réservée' + (x.reservees > 1 ? 's' : '') + ' sur ce créneau</span>' : '') + '</p>' +
        '<div class="actions" style="display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.5rem"></div><p class="statut" role="status"></p></div>');
      var act = carte.querySelector('.actions');
      function bouton(texte, portee, confirmation) {
        var b = el('<button type="button" class="btn btn-clair petit">' + texte + '</button>');
        b.addEventListener('click', function () {
          act.innerHTML = '';
          var c = el('<div><p class="petit" style="margin:0 0 .5rem">' + confirmation + '</p><p style="display:flex;gap:.6rem;flex-wrap:wrap;margin:0"><button type="button" class="btn oui">Retirer</button><button type="button" class="btn btn-clair non">Garder</button></p></div>');
          c.querySelector('.non').addEventListener('click', function () { var anc = document.getElementById('g-dispos'); anc.parentNode.replaceChild(sectionDispos(), anc); });
          c.querySelector('.oui').addEventListener('click', function () {
            var st = carte.querySelector('.statut'), btn = this; btn.disabled = true; st.className = 'statut'; st.textContent = 'Retrait…';
            post({ action: 'admin_dispo_retirer', id: x.id, portee: portee }).then(function (r) {
              if (!r.ok) { btn.disabled = false; st.className = 'statut ko'; st.textContent = r.message || 'Erreur.'; return; }
              rechargerDispos(r.retires > 1 ? r.retires + ' créneaux retirés.' : 'Créneau retiré.');
            }).catch(function () { btn.disabled = false; st.className = 'statut ko'; st.textContent = 'Le serveur ne répond pas. Réessayez.'; });
          });
          act.appendChild(c);
        });
        act.appendChild(b);
      }
      var quand = esc(jourLong(x.jour)) + ', ' + h(x.de) + ' à ' + h(x.a);
      if (x.serie) {
        bouton('Retirer cette date', 'une', 'Retirer seulement le créneau du ' + quand + ' ? Les autres semaines restent ouvertes.');
        bouton('Retirer cette date et les suivantes', 'suivantes', 'Retirer le créneau du ' + quand + ' et toutes les semaines suivantes ?');
      } else {
        bouton('Retirer', 'une', 'Retirer le créneau du ' + quand + ' ?');
      }
      bloc.appendChild(carte);
    });
    return s;
  }

  // ---------------------------------------------------------------- Séances à venir
  function sectionSeances() {
    var s = el('<section id="g-seances" style="margin-top:2rem"><h2>Séances à venir</h2></section>');
    var aVenir = donnees.seances.filter(function (x) { return !x.passee; });
    if (!aVenir.length) { s.appendChild(el('<p>Aucune séance réservée pour le moment.</p>')); return s; }
    aVenir.forEach(function (x) {
      var annulee = x.statut !== 'confirmee';
      var lignes = x.participants.map(function (p) {
        return '<li>' + esc(p.nom) + ' : ' + esc(MODES[p.mode] || p.mode) + ', ' + esc(STATUTS[p.statut] || p.statut) + (p.montant ? ' (' + euros(p.montant) + ')' : '') + '</li>';
      }).join('');
      var carte = el('<article class="encadre" style="margin-bottom:1rem' + (annulee ? ';opacity:.55' : '') + '">' +
        '<p style="margin:0 0 .3rem;font-weight:650">' + esc(date(x.debut, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })) +
        ' · ' + x.duree + ' min · ' + (x.format === 'domicile' ? 'chez le client' + (x.ville ? ' (' + esc(x.ville) + ')' : '') : 'en ligne') +
        (annulee ? ' · <strong>ANNULÉE</strong>' : '') + '</p>' +
        '<ul style="margin:.2rem 0 .5rem">' + lignes + '</ul>' +
        (x.format === 'domicile' ? '<p style="margin:0" class="petit">Tapis à apporter : ' + x.tapis + (x.pack ? ' · Pack ' + esc(x.pack) : '') + '</p>' : '') +
        '<div class="actions"></div></article>');
      if (!annulee) {
        var b = el('<button type="button" class="btn btn-clair" style="margin-top:.8rem">Annuler cette séance</button>');
        b.addEventListener('click', function () { confirmerAnnulation(carte.querySelector('.actions'), x); });
        carte.querySelector('.actions').appendChild(b);
      }
      s.appendChild(carte);
    });
    return s;
  }

  function confirmerAnnulation(zoneActions, x) {
    var payes = x.participants.filter(function (p) { return p.statut === 'paye'; });
    zoneActions.innerHTML = '';
    var f = el('<div style="margin-top:.8rem">' +
      '<div class="champ"><label for="m-' + x.id + '">Message pour les participants (facultatif)</label><textarea id="m-' + x.id + '" rows="3" maxlength="1000" placeholder="Par exemple : empêchement de dernière minute, toutes nos excuses."></textarea></div>' +
      '<p class="petit">Tous les participants qui ont donné leur e-mail seront prévenus.' +
      (payes.length ? ' Remboursement automatique en totalité : ' + payes.map(function (p) { return esc(p.nom) + ' (' + euros(p.montant) + ')'; }).join(', ') + '.' : '') +
      (x.pack ? ' La séance sera recréditée sur le pack.' : '') + ' Cette action ne peut pas être annulée.</p>' +
      '<p style="display:flex;gap:.8rem;flex-wrap:wrap"><button type="button" class="btn oui">Confirmer l\'annulation</button><button type="button" class="btn btn-clair non">Garder la séance</button></p>' +
      '<p class="statut" role="status"></p></div>');
    f.querySelector('.non').addEventListener('click', function () { dessiner(); });
    f.querySelector('.oui').addEventListener('click', function () {
      var btn = this; btn.disabled = true;
      var st = f.querySelector('.statut'); st.className = 'statut'; st.textContent = 'Annulation en cours…';
      post({ action: 'admin_annuler', id: x.id, message: document.getElementById('m-' + x.id).value }).then(function (r) {
        if (!r.ok) { btn.disabled = false; st.className = 'statut ko'; st.textContent = r.message || 'Erreur.'; return; }
        st.className = 'statut ok';
        st.textContent = 'Séance annulée. ' + r.prevenus + ' personne(s) prévenue(s)' + (r.rembourses ? ', ' + r.rembourses + ' remboursement(s) fait(s)' : '') +
          (r.aRembourser ? '. ATTENTION : ' + r.aRembourser + ' remboursement(s) à faire dans PayPal (voir l\'e-mail)' : '') + '.';
        setTimeout(charger, 2500);
      }).catch(function () { btn.disabled = false; st.className = 'statut ko'; st.textContent = 'Le serveur ne répond pas. Réessayez.'; });
    });
    zoneActions.appendChild(f);
  }

  // ---------------------------------------------------------------- Pack payé en espèces
  function sectionNouveauPack() {
    var cat = donnees.catalogue;
    var s = el('<section id="g-nouveau-pack" style="margin-top:2.5rem"><h2>Enregistrer un pack payé en espèces</h2>' +
      '<p>Le client reçoit aussitôt son code par e-mail, comme pour un achat en ligne.</p>' +
      '<form novalidate style="max-width:40rem"><div class="grille-champs">' +
      '<div class="champ"><label for="pk-nom">Nom et prénom du client</label><input id="pk-nom" required></div>' +
      '<div class="champ"><label for="pk-email">E-mail du client</label><input id="pk-email" type="email" required><span class="aide">Le client devra utiliser cette adresse pour réserver avec son pack.</span></div>' +
      '<div class="champ"><label for="pk-format">Format</label><select id="pk-format"><option value="domicile">Chez le client</option><option value="enligne">En ligne</option></select></div>' +
      '<div class="champ"><label for="pk-duree">Durée</label><select id="pk-duree">' + cat.durees.map(function (d) { return '<option value="' + d + '"' + (d === 60 ? ' selected' : '') + '>' + d + ' min</option>'; }).join('') + '</select></div>' +
      '<div class="champ"><label for="pk-taille">Nombre de personnes par séance</label><select id="pk-taille"><option value="1">Seul</option><option value="2">À 2</option><option value="3">De 3 à 6</option></select></div>' +
      '<div class="champ"><label for="pk-lang">Langue des e-mails</label><select id="pk-lang"><option value="fr">Français</option><option value="en">Anglais</option></select></div>' +
      '</div><div class="encadre" id="pk-prix"></div>' +
      '<div class="case"><input type="checkbox" id="pk-recu"><label for="pk-recu" id="pk-recu-texte"></label></div>' +
      '<p><button type="submit" class="btn">Enregistrer le pack</button></p><p class="statut" role="status"></p></form></section>');
    var f = s.querySelector('form');
    function prix() {
      var format = f.querySelector('#pk-format').value, duree = Number(f.querySelector('#pk-duree').value), taille = Number(f.querySelector('#pk-taille').value);
      f.querySelector('#pk-taille').disabled = format === 'enligne';
      var pp = format === 'enligne' ? cat.enligne[duree] : cat.domicile[duree][taille - 1];
      var total = pp * cat.pack.payees;
      f.querySelector('#pk-prix').innerHTML = 'Prix du pack : <strong>' + euros(total) + '</strong> (' + cat.pack.seances + ' séances à ' + euros(pp) + ' par personne, la ' + cat.pack.seances + 'e offerte).';
      f.querySelector('#pk-recu-texte').textContent = 'J\'ai bien reçu ' + euros(total) + ' en espèces.';
      return total;
    }
    f.addEventListener('change', prix); prix();
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var st = f.querySelector('.statut'), btn = f.querySelector('button[type=submit]');
      var format = f.querySelector('#pk-format').value;
      var corps = { action: 'admin_pack_especes', format: format, duree: Number(f.querySelector('#pk-duree').value),
        taille: format === 'enligne' ? 1 : Number(f.querySelector('#pk-taille').value), lang: f.querySelector('#pk-lang').value,
        client: { nom: f.querySelector('#pk-nom').value.trim(), email: f.querySelector('#pk-email').value.trim() }, recu: f.querySelector('#pk-recu').checked };
      btn.disabled = true; st.className = 'statut'; st.textContent = 'Enregistrement…';
      post(corps).then(function (r) {
        btn.disabled = false;
        if (!r.ok) { st.className = 'statut ko'; st.textContent = r.message || 'Erreur.'; return; }
        st.className = 'statut ok';
        st.textContent = 'Pack enregistré : code ' + r.pack.code + ' (' + r.pack.formule + '), envoyé au client par e-mail.';
        f.reset(); prix();
        post({ action: 'admin_liste' }).then(function (x) { if (x.ok) { donnees = x; var anc = document.getElementById('g-packs'); anc.parentNode.replaceChild(sectionPacks(), anc); } });
      }).catch(function () { btn.disabled = false; st.className = 'statut ko'; st.textContent = 'Le serveur ne répond pas. Réessayez.'; });
    });
    return s;
  }

  // ---------------------------------------------------------------- Packs
  function sectionPacks() {
    var s = el('<section id="g-packs" style="margin-top:2.5rem"><h2>Packs</h2></section>');
    if (!donnees.packs.length) { s.appendChild(el('<p>Aucun pack vendu pour le moment.</p>')); return s; }
    var t = el('<div style="overflow-x:auto"><table class="tarifs"><thead><tr><th>Client</th><th>Formule</th><th>Restant</th><th>Valable jusqu\'au</th><th>Paiement</th><th>Code</th></tr></thead><tbody></tbody></table></div>');
    donnees.packs.forEach(function (p) {
      var expire = Date.parse(p.expire) < Date.now();
      t.querySelector('tbody').appendChild(el('<tr' + (expire || !p.restant ? ' style="opacity:.55"' : '') + '><td>' + esc(p.nom) + '<br><span class="petit">' + esc(p.email) + '</span></td><td>' + esc(p.formule) + '</td><td>' + p.restant + ' / ' + p.total + '</td><td>' +
        esc(date(p.expire, { day: 'numeric', month: 'short', year: 'numeric' })) + (expire ? ' (expiré)' : '') + '</td><td>' + (p.paiement === 'especes' ? 'espèces' : 'PayPal') + ' · ' + euros(p.montant) + '</td><td>' + esc(p.code) + '</td></tr>'));
    });
    s.appendChild(t);
    return s;
  }
})();
