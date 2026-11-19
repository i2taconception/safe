/**
 * SAFE : réservation en ligne (backend Google Apps Script, compte safeinfocontact@gmail.com).
 *
 * Rôle : calculer les créneaux libres à partir de Google Agenda, calculer le déplacement
 * (Google Maps), enregistrer les réservations de 1 à 6 personnes, encaisser la part de chacun
 * via PayPal, gérer les packs de 11 séances, prévenir l'enseignante et les clients par e-mail.
 *
 * Disponibilités : page /gestion/ (section Disponibilités), ou événements dans l'agenda « Disponibilités SAFE » :
 *   - titre « Dispo »            : domicile et en ligne
 *   - titre « Dispo en ligne »   : en ligne uniquement
 *   - titre « Dispo domicile »   : domicile uniquement
 * Tout événement des agendas occupés (CONFIG.agendasOccupes) bloque le créneau.
 *
 * Données privées (jamais dans ce fichier, qui est public) : Paramètres du projet > Propriétés du script
 *   - ADRESSE_DEPART : adresse de départ des déplacements (Marseille 9e)
 *   - PAYPAL_SECRET  : secret de l'application PayPal
 * Mise en service : voir CLAUDE.md du dépôt, section « Réservation ».
 */

// ============================================================
// CONFIGURATION (aucune donnée secrète ici)
// ============================================================
var CONFIG = {
  nomSite: 'SAFE',
  urlSite: 'https://safewellbeing.fr',   // sans / final
  emailProprietaire: 'safeinfocontact@gmail.com',      // reçoit les notifications
  expediteur: 'contact@safewellbeing.fr',             // adresse d'envoi des e-mails aux clients (alias Gmail « Envoyer en tant que », 19/11) ; vide : envoi depuis le compte Google
  fuseau: 'Europe/Paris',

  agendaDispos: 'fe7d49da96ee4aba93c35d24e392adbf1e72a0d7bcdcde8f0f9a4917b04e6a2c@group.calendar.google.com',       // agenda « Disponibilités SAFE »
  agendaReservations: '13f4d3af51041bbc09aeffd0da5ee3d58f6c568d5bda55062d2bb80144f6e1b2@group.calendar.google.com', // agenda « Réservations SAFE » (partagé avec Adrien)
  agendasOccupes: ['primary'],

  pasMinutes: 30,
  battement: { enligne: 0, marseille: 30, hors: 60 }, // minutes libres avant et après une séance (décision du 18/11)
  preavisHeures: 24,
  horizonJours: 60,
  annulationHeures: 24,
  remboursementAuto: true,    // rembourse automatiquement via PayPal quand c'est dû (décision du 18/11)
  maxReservationsParEmailParJour: 4,

  departParDefaut: '13009 Marseille, France', // remplacé par la propriété ADRESSE_DEPART
  kmMaxAller: 45,             // au-delà : devis
  codesPostauxGratuits: /\b130(0[1-9]|1[0-6])\b/, // Marseille : déplacement gratuit

  dureeConservationSanteJours: 365,

  paypal: {
    env: 'sandbox',           // 'sandbox' pour tester, 'live' en production
    clientId: '',             // vide : seul le paiement en espèces est proposé
    devise: 'EUR'
  }
};

// Tarifs : SEULE source des prix encaissés. Prix par personne.
// domicile : [seul, à 2, de 3 à 6] ; enligne : une personne.
// Doit rester identique à CATALOGUE_DEMO (assets/js/reservation.js) et aux pages (data-prix) : node outils/tests/coherence.mjs
var CATALOGUE = {
  durees: [45, 60, 90],
  domicile: { 45: [25, 20, 15], 60: [30, 25, 20], 90: [40, 35, 25] },
  enligne: { 45: 20, 60: 25, 90: 35 },
  maxPersonnes: 6, maxTapis: 6, reductionPremiere: 5, tarifKm: 0.3,
  pack: { seances: 11, payees: 10, validiteJours: 365 }
};

var LIBELLES = {
  domicile: { fr: 'Chez vous', en: 'At your home' },
  enligne: { fr: 'En ligne (visio)', en: 'Online (video call)' },
  taille: { 1: { fr: 'seul', en: 'alone' }, 2: { fr: 'à 2', en: 'for 2' }, 3: { fr: 'de 3 à 6', en: '3 to 6 people' } },
  sexe: { femme: 'F', homme: 'H' }
};

// ============================================================
// POINTS D'ENTRÉE WEB
// ============================================================
function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    switch (p.action) {
      case 'config':      return json_(configPublique_());
      case 'deplacement': return json_(deplacementPublic_(p.adresse));
      case 'creneaux':    return json_(creneauxDisponibles_(p));
      case 'reservation': return json_(lireReservation_(p.id, p.cle, p.p));
      case 'part':        return json_(lirePart_(p.id, p.p, p.cle));
      case 'reprise':     return json_(lireReprise_(p.id, p.cle));
      default:            return json_({ ok: true, service: CONFIG.nomSite });
    }
  } catch (err) {
    return json_(erreur_(err));
  }
}

function doPost(e) {
  var d;
  try { d = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, code: 'requete', message: 'Requête illisible.' }); }
  try {
    switch (d.action) {
      case 'reserver':            return json_(reserverSansPaiementEnLigne_(d));
      case 'paypal_creer':        return json_(paypalCreerSeance_(d));
      case 'paypal_valider':      return json_(paypalValiderSeance_(d));
      case 'paypal_creer_part':   return json_(paypalCreerPart_(d));
      case 'paypal_valider_part': return json_(paypalValiderPart_(d));
      case 'paypal_creer_pack':   return json_(paypalCreerPack_(d));
      case 'paypal_valider_pack': return json_(paypalValiderPack_(d));
      case 'pack':                return json_(lirePack_(d));
      case 'annuler':             return json_(annuler_(d));
      case 'contact':             return json_(contact_(d));
      case 'admin_liste':         verifierAdmin_(d.code); return json_(adminListe_());
      case 'admin_pack_especes':  verifierAdmin_(d.code); return json_(adminPackEspeces_(d));
      case 'admin_annuler':       verifierAdmin_(d.code); return json_(adminAnnuler_(d));
      case 'admin_supprimer':     verifierAdmin_(d.code); return json_(adminSupprimer_(d));
      case 'admin_paiement_recu': verifierAdmin_(d.code); return json_(adminPaiementRecu_(d));
      case 'admin_dispo_ajouter': verifierAdmin_(d.code); return json_(adminDispoAjouter_(d));
      case 'admin_dispo_retirer': verifierAdmin_(d.code); return json_(adminDispoRetirer_(d));
      default:                    return json_({ ok: false, code: 'action', message: 'Action inconnue.' });
    }
  } catch (err) {
    return json_(erreur_(err));
  }
}

function configPublique_() {
  return {
    ok: true,
    catalogue: { durees: CATALOGUE.durees, domicile: CATALOGUE.domicile, enligne: CATALOGUE.enligne,
                 maxPersonnes: CATALOGUE.maxPersonnes, maxTapis: CATALOGUE.maxTapis,
                 reductionPremiere: CATALOGUE.reductionPremiere, tarifKm: CATALOGUE.tarifKm, pack: CATALOGUE.pack },
    preavisHeures: CONFIG.preavisHeures, horizonJours: CONFIG.horizonJours, annulationHeures: CONFIG.annulationHeures,
    paypal: { clientId: CONFIG.paypal.clientId, devise: CONFIG.paypal.devise, env: CONFIG.paypal.env }
  };
}

// ============================================================
// PRIX (calculs purs, identiques à calcul() de reservation.js)
// ============================================================
function tranche_(nb) { return Math.min(Math.max(1, nb), 3); }

function prixParPersonne(format, duree, nb) {
  if (CATALOGUE.durees.indexOf(Number(duree)) < 0) throw erreurUtilisateur_('duree', 'Durée indisponible.');
  if (format === 'enligne') return CATALOGUE.enligne[duree];
  if (format === 'domicile') return CATALOGUE.domicile[duree][tranche_(nb) - 1];
  throw erreurUtilisateur_('format', 'Format inconnu.');
}

/**
 * Part de chaque participant. premieres : [bool], pack0 : la personne qui réserve utilise un pack.
 * Le déplacement est partagé à parts égales ; l'arrondi est pour la personne qui réserve.
 */
function calculerMontants(format, duree, premieres, deplacement, pack0) {
  var n = premieres.length;
  var pp = prixParPersonne(format, duree, n);
  var dep = format === 'domicile' ? (deplacement || 0) : 0;
  var partDep = Math.round(dep / n * 100) / 100;
  var parts = premieres.map(function (pr, i) {
    if (i === 0 && pack0) return partDep;
    return Math.max(0, pp - (pr ? CATALOGUE.reductionPremiere : 0)) + partDep;
  });
  parts[0] = Math.round((parts[0] + (dep - partDep * n)) * 100) / 100;
  var total = Math.round(parts.reduce(function (a, b) { return a + b; }, 0) * 100) / 100;
  return { pp: pp, dep: dep, partDep: partDep, parts: parts, total: total };
}

function prixPack(format, duree, taille) {
  return CATALOGUE.pack.payees * prixParPersonne(format, duree, taille);
}

// ============================================================
// DÉPLACEMENT (Google Maps)
// ============================================================
/** Calcul pur : adresse trouvée par Maps + distance aller en mètres -> zone et montant. */
function calculerDeplacement(adresseTrouvee, metresAller) {
  if (CONFIG.codesPostauxGratuits.test(adresseTrouvee) && /marseille/i.test(adresseTrouvee)) {
    return { zone: 'marseille', km: 0, montant: 0 };
  }
  var kmAller = metresAller / 1000;
  if (kmAller > CONFIG.kmMaxAller) return { zone: 'trop_loin', km: Math.round(kmAller * 2 * 10) / 10, montant: null };
  var kmAR = kmAller * 2;
  return { zone: 'hors', km: Math.round(kmAR * 10) / 10, montant: Math.round(kmAR * CATALOGUE.tarifKm) };
}

function deplacement_(adresse) {
  adresse = String(adresse || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200);
  if (adresse.length < 5) throw erreurUtilisateur_('adresse', 'Adresse introuvable.');
  // Le cache ne garde que le trajet brut (adresse trouvée, mètres) : zone et prix sont recalculés
  // à chaque appel, pour qu'un changement de CONFIG ou d'adresse de départ s'applique tout de suite.
  var cache = CacheService.getScriptCache();
  var depart = PropertiesService.getScriptProperties().getProperty('ADRESSE_DEPART') || CONFIG.departParDefaut;
  var cle = 'trajet_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, depart + '|' + adresse.toLowerCase()));
  var trajet = cache.get(cle) ? JSON.parse(cache.get(cle)) : null;
  if (!trajet) {
    var r = Maps.newDirectionFinder().setOrigin(depart).setDestination(adresse + ', France')
      .setMode(Maps.DirectionFinder.Mode.DRIVING).setRegion('fr').getDirections();
    if (!r || r.status !== 'OK' || !r.routes || !r.routes.length) throw erreurUtilisateur_('adresse', 'Adresse introuvable.');
    var leg = r.routes[0].legs[0];
    trajet = { a: String(leg.end_address || ''), m: leg.distance.value };
    cache.put(cle, JSON.stringify(trajet), 21600);
  }
  var res = calculerDeplacement(trajet.a, trajet.m);
  res.adresseTrouvee = trajet.a;
  return res;
}

function deplacementPublic_(adresse) {
  var r = deplacement_(adresse);
  return { ok: true, zone: r.zone, km: r.km, montant: r.montant, adresseTrouvee: r.adresseTrouvee };
}

// ============================================================
// CRÉNEAUX
// ============================================================
function creneauxDisponibles_(p) {
  if (p.format !== 'domicile' && p.format !== 'enligne') throw erreurUtilisateur_('format', 'Format inconnu.');
  var duree = Number(p.duree);
  if (CATALOGUE.durees.indexOf(duree) < 0) throw erreurUtilisateur_('duree', 'Durée indisponible.');
  var debut = String(p.debut || ''), fin = String(p.fin || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(debut) || !/^\d{4}-\d{2}-\d{2}$/.test(fin)) throw erreurUtilisateur_('dates', 'Dates invalides.');
  var maintenant = Date.now();
  var tMin = new Date(Date.parse(debut + 'T00:00:00Z') - 14 * 3600e3);
  var tMax = new Date(Date.parse(fin + 'T23:59:59Z') + 14 * 3600e3);
  var limite = new Date(maintenant + CONFIG.horizonJours * 86400e3);
  if (tMax > limite) tMax = limite;
  if (tMin >= tMax) return { ok: true, jours: [] };
  var creneaux = calculerCreneaux(lireFenetres_(tMin, tMax), lireOccupations_(tMin, tMax), {
    format: p.format, duree: duree, pas: CONFIG.pasMinutes, battement: battementZone_(p.format, p.zone),
    debutMin: maintenant + CONFIG.preavisHeures * 3600e3
  });
  // Regroupement par jour de Paris ; le site les regroupe ensuite à l'heure du client.
  var parJour = {}, ordre = [];
  creneaux.forEach(function (t) {
    var d = new Date(t);
    var jour = Utilities.formatDate(d, CONFIG.fuseau, 'yyyy-MM-dd');
    if (!parJour[jour]) { parJour[jour] = []; ordre.push(jour); }
    parJour[jour].push({ debut: d.toISOString(), heure: Utilities.formatDate(d, CONFIG.fuseau, 'HH:mm') });
  });
  return { ok: true, jours: ordre.map(function (j) { return { date: j, creneaux: parJour[j] }; }) };
}

/** Battement en minutes : en ligne 0, à domicile dans Marseille 30, hors de Marseille 60 (zone inconnue : 60). */
function battementZone_(format, zone) {
  if (format === 'enligne') return CONFIG.battement.enligne;
  return zone === 'marseille' ? CONFIG.battement.marseille : CONFIG.battement.hors;
}

/**
 * Calcul pur : débuts de créneaux (ms epoch).
 * Autour de chaque occupation, l'écart gardé est le plus grand des deux battements (celui de la séance
 * demandée et celui de la séance déjà réservée, si elle en porte un).
 * fenetres : [{debut, fin, formats: null | ['domicile'|'enligne']}] ; occupe : [{debut, fin}]
 */
function calculerCreneaux(fenetres, occupe, o) {
  var pasMs = o.pas * 60e3, dureeMs = o.duree * 60e3, batMs = (o.battement || 0) * 60e3;
  var vus = {}, res = [];
  fenetres.forEach(function (f) {
    if (f.formats && f.formats.indexOf(o.format) < 0) return;
    var t = Math.ceil(f.debut / pasMs) * pasMs;
    for (; t + dureeMs <= f.fin; t += pasMs) {
      if (t < o.debutMin || vus[t]) continue;
      var libre = true;
      for (var i = 0; i < occupe.length; i++) {
        var m = Math.max(batMs, (occupe[i].battement || 0) * 60e3);
        if (occupe[i].debut < t + dureeMs + m && occupe[i].fin > t - m) { libre = false; break; }
      }
      if (libre) { vus[t] = true; res.push(t); }
    }
  });
  return res.sort(function (x, y) { return x - y; });
}

function lireFenetres_(tMin, tMax) {
  var res = [];
  listerEvenements_(CONFIG.agendaDispos, tMin, tMax, null).forEach(function (ev) {
    if (!ev.start || !ev.start.dateTime || ev.status === 'cancelled') return;
    var titre = String(ev.summary || '').toLowerCase(), formats = null;
    if (/ligne|visio|online/.test(titre)) formats = ['enligne'];
    else if (/domicile|maison|home/.test(titre)) formats = ['domicile'];
    res.push({ debut: Date.parse(ev.start.dateTime), fin: Date.parse(ev.end.dateTime), formats: formats });
  });
  return res;
}

function lireOccupations_(tMin, tMax) {
  var ids = CONFIG.agendasOccupes.slice();
  var r = Calendar.Freebusy.query({ timeMin: tMin.toISOString(), timeMax: tMax.toISOString(), timeZone: CONFIG.fuseau,
    items: ids.map(function (id) { return { id: id }; }) });
  var res = [];
  ids.forEach(function (id) {
    var c = r.calendars && r.calendars[id];
    if (!c) return;
    if (c.errors && c.errors.length) throw new Error('Agenda illisible : ' + id);
    (c.busy || []).forEach(function (b) { res.push({ debut: Date.parse(b.start), fin: Date.parse(b.end) }); });
  });
  // Séances SAFE déjà réservées : chacune garde son propre battement (en ligne, Marseille, hors Marseille).
  listerEvenements_(CONFIG.agendaReservations, tMin, tMax, null).forEach(function (ev) {
    if (!ev.start || !ev.start.dateTime || ev.status === 'cancelled' || ev.transparency === 'transparent') return;
    var q = (ev.extendedProperties && ev.extendedProperties.private) || null;
    var bat;
    if (q && q.resaId) bat = battementZone_(q.format, q.zone || (Number(q.km || 0) > 0 ? 'hors' : 'marseille'));
    res.push({ debut: Date.parse(ev.start.dateTime), fin: Date.parse(ev.end.dateTime), battement: bat });
  });
  return res;
}

function listerEvenements_(agendaId, tMin, tMax, filtrePrive) {
  var res = [], jeton = null;
  do {
    var opts = { timeMin: tMin.toISOString(), timeMax: tMax.toISOString(), singleEvents: true, orderBy: 'startTime', maxResults: 250, showDeleted: false };
    if (filtrePrive) opts.privateExtendedProperty = filtrePrive;
    if (jeton) opts.pageToken = jeton;
    var r = Calendar.Events.list(agendaId, opts);
    res = res.concat(r.items || []);
    jeton = r.nextPageToken;
  } while (jeton);
  return res;
}

// ============================================================
// VALIDATION D'UNE DEMANDE DE RÉSERVATION
// ============================================================
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function propre_(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }

function validerDemande_(d) {
  if (d.piege) throw erreurUtilisateur_('spam', 'Demande refusée.');
  var format = d.format;
  if (format !== 'domicile' && format !== 'enligne') throw erreurUtilisateur_('format', 'Format inconnu.');
  var duree = Number(d.duree);
  if (CATALOGUE.durees.indexOf(duree) < 0) throw erreurUtilisateur_('duree', 'Durée indisponible.');
  var lang = d.lang === 'en' ? 'en' : 'fr';

  var c = d.client || {};
  var p0 = (Array.isArray(d.participants) && d.participants[0]) || {};
  var client = { nom: propre_(c.nom || p0.nom, 60), email: propre_(c.email, 120).toLowerCase(), tel: propre_(c.tel, 30) };
  if (!client.nom) throw erreurUtilisateur_('client', 'Nom obligatoire.');
  if (!EMAIL_RE.test(client.email)) throw erreurUtilisateur_('email', 'Adresse e-mail invalide.');
  if (client.tel.replace(/\D/g, '').length < 9) throw erreurUtilisateur_('tel', 'Numéro de téléphone invalide.');

  var liste = Array.isArray(d.participants) ? d.participants : [];
  var max = format === 'enligne' ? 1 : CATALOGUE.maxPersonnes;
  if (liste.length < 1 || liste.length > max) throw erreurUtilisateur_('participants', 'Nombre de personnes invalide.');
  var participants = liste.map(function (p, i) {
    var x = { prenom: propre_(p.prenom, 40), nom: propre_(p.nom, 60), sexe: String(p.sexe || ''), premiere: p.premiere === true,
              mode: String(p.paiement || ''), email: i ? propre_(p.email, 120).toLowerCase() : client.email };
    if (!x.prenom || !x.nom) throw erreurUtilisateur_('participants', 'Prénom et nom obligatoires pour chaque participant.');
    if (!LIBELLES.sexe[x.sexe]) throw erreurUtilisateur_('participants', 'Sexe obligatoire pour chaque participant.');
    if (p.charte !== true) throw erreurUtilisateur_('charte', 'Chaque participant doit accepter la charte de séance.');
    var modes = i === 0 ? ['enligne', format === 'enligne' ? 'virement' : 'especes', 'pack'] : ['lien', 'especes'];
    if (modes.indexOf(x.mode) < 0) throw erreurUtilisateur_('paiement', 'Mode de paiement invalide.');
    if (i > 0 && x.mode === 'lien' && !EMAIL_RE.test(x.email)) throw erreurUtilisateur_('email', 'Adresse e-mail du participant invalide.');
    if (i > 0 && x.mode !== 'lien') x.email = EMAIL_RE.test(x.email) ? x.email : '';
    if (i > 0 && x.premiere && !x.email) throw erreurUtilisateur_('participants', 'E-mail obligatoire pour chaque participant qui demande la réduction première séance.');
    return x;
  });
  if (!CONFIG.paypal.clientId) participants.forEach(function (x) { if (x.mode === 'enligne' || x.mode === 'lien') throw erreurUtilisateur_('paiement', 'Le paiement en ligne n\'est pas disponible.'); });

  var adresse = null, dep = { zone: 'enligne', km: 0, montant: 0 };
  if (format === 'domicile') {
    var a = d.adresse || {};
    adresse = { rue: propre_(a.rue, 120), cp: propre_(a.cp, 10), ville: propre_(a.ville, 60) };
    if (!adresse.rue || !adresse.cp || !adresse.ville) throw erreurUtilisateur_('adresse', 'Adresse obligatoire pour une séance chez vous.');
    dep = deplacement_(adresse.rue + ', ' + adresse.cp + ' ' + adresse.ville);
    if (dep.zone === 'trop_loin') throw erreurUtilisateur_('zone', 'Cette adresse est au-delà de notre zone : écrivez-nous pour un devis.');
  }
  var tapis = Number(d.tapis || 0);
  if (format === 'enligne') tapis = 0;
  if (!(tapis >= 0 && tapis <= Math.min(participants.length, CATALOGUE.maxTapis)) || tapis % 1) throw erreurUtilisateur_('tapis', 'Nombre de tapis invalide.');

  var sante = d.consentSante === true ? String(d.sante || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, 800) : '';
  if (d.cgv !== true) throw erreurUtilisateur_('cgv', 'Merci d\'accepter les conditions de vente.');
  var debut = new Date(String(d.debut || ''));
  if (isNaN(debut.getTime())) throw erreurUtilisateur_('creneau', 'Créneau invalide.');

  var pack = null;
  if (participants[0].mode === 'pack') pack = verifierPack_(d.pack, client.email, format, duree, participants.length);

  var montants = calculerMontants(format, duree, participants.map(function (x) { return x.premiere; }), dep.montant || 0, !!pack);
  if (d.montantAttendu != null && Math.abs(Number(d.montantAttendu) - montants.total) > 0.009) {
    throw erreurUtilisateur_('montant', 'Le prix a changé entre-temps. Rechargez la page et recommencez.');
  }
  return { format: format, duree: duree, lang: lang, client: client, participants: participants, adresse: adresse,
           deplacement: dep, tapis: tapis, sante: sante, debut: debut, fin: new Date(debut.getTime() + duree * 60e3),
           montants: montants, pack: pack };
}

/** Réduction première séance : refusée si l'e-mail de la personne qui réserve a déjà réservé. */
/**
 * Réduction première séance (décision du 18/11) : refusée seulement si la même personne, c'est-à-dire
 * le même prénom, le même nom ET la même adresse e-mail, a déjà une séance passée ou à venir non annulée.
 * Chaque réservation enregistre pour chaque participant qui a un e-mail une empreinte pq_… (prénom, nom, e-mail).
 */
function empreinte_(prefixe, texte) {
  var t = String(texte || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9@.|]+/g, ' ').trim();
  if (!t) return '';
  var h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t);
  return prefixe + Utilities.base64EncodeWebSafe(h).replace(/[^A-Za-z0-9]/g, '').slice(0, 16);
}
function empreintesParticipant_(x) {
  return x.email ? [empreinte_('pq_', x.prenom + ' ' + x.nom + '|' + x.email)] : [];
}
function verifierPremiere_(dem) {
  var tMin = new Date(Date.now() - 3 * 365 * 86400e3), tMax = new Date(Date.now() + 400 * 86400e3);
  function compte(ev) { return ev.extendedProperties.private.statut === 'confirmee' || Date.parse(ev.start.dateTime) < Date.now(); }
  dem.participants.forEach(function (x) {
    if (!x.premiere) return;
    var deja = empreintesParticipant_(x).some(function (k) {
      return listerEvenements_(CONFIG.agendaReservations, tMin, tMax, k + '=1').some(compte);
    });
    if (deja) throw erreurUtilisateur_('premiere', x.prenom + ' ' + x.nom + ' a déjà réservé une séance chez SAFE avec cette adresse e-mail\u00a0: la réduction première séance ne s\'applique pas. Décochez «\u00a0Première séance\u00a0» pour cette personne.');
  });
}

function creneauEncoreLibre_(dem) {
  if (dem.debut.getTime() > Date.now() + CONFIG.horizonJours * 86400e3) return false;
  var tMin = new Date(dem.debut.getTime() - 12 * 3600e3), tMax = new Date(dem.fin.getTime() + 12 * 3600e3);
  var libres = calculerCreneaux(lireFenetres_(tMin, tMax), lireOccupations_(tMin, tMax), {
    format: dem.format, duree: dem.duree, pas: CONFIG.pasMinutes, battement: battementZone_(dem.format, dem.deplacement && dem.deplacement.zone),
    debutMin: Date.now() + CONFIG.preavisHeures * 3600e3 });
  return libres.indexOf(dem.debut.getTime()) >= 0;
}

function limiterParEmail_(email) {
  var cache = CacheService.getScriptCache();
  var cle = 'nb_' + Utilities.base64EncodeWebSafe(email).slice(0, 200);
  var n = Number(cache.get(cle) || 0);
  if (n >= CONFIG.maxReservationsParEmailParJour) throw erreurUtilisateur_('limite', 'Trop de réservations aujourd\'hui avec cette adresse. Contactez-nous directement.');
  cache.put(cle, String(n + 1), 86400);
}

function avecVerrou_(f) {
  var verrou = LockService.getScriptLock();
  verrou.waitLock(25000);
  try { return f(); } finally { verrou.releaseLock(); }
}

// ============================================================
// RÉSERVATION
// ============================================================
/** La personne qui réserve paie en espèces, avec son pack, ou n'a rien à payer. */
function reserverSansPaiementEnLigne_(d) {
  var dem = validerDemande_(d);
  if (dem.participants[0].mode === 'enligne' && dem.montants.parts[0] > 0) throw erreurUtilisateur_('paiement', 'Paiement en ligne attendu.');
  return avecVerrou_(function () {
    if (!creneauEncoreLibre_(dem)) throw erreurUtilisateur_('pris', 'Ce créneau vient d\'être réservé. Choisissez-en un autre.');
    verifierPremiere_(dem);
    limiterParEmail_(dem.client.email);
    if (dem.pack) utiliserPack_(dem.pack.code, -1);
    var resa = creerEvenement_(dem, null);
    notifier_(resa, dem);
    return { ok: true, reservation: resumePublic_(resa, dem) };
  });
}

function creerEvenement_(dem, captureId) {
  var id = jeton_(12), cle = jeton_(32);
  var parts = dem.montants.parts;
  var ps = dem.participants.map(function (x, i) {
    var statut = 'a_regler';
    if (i === 0 && captureId) statut = 'paye';
    else if (parts[i] === 0) statut = 'sans_objet';
    return { n: x.prenom + ' ' + x.nom, f: x.prenom, o: x.nom, s: x.sexe, r: x.premiere ? 1 : 0, m: x.mode, t: statut, e: x.email, k: jeton_(32), c: i === 0 && captureId ? captureId : '', a: parts[i] };
  });
  var resa = { id: id, cle: cle, participants: ps };
  var priv = {
    resaId: id, cle: cle, email: dem.client.email, nom: dem.client.nom, tel: dem.client.tel, lang: dem.lang, statut: 'confirmee',
    format: dem.format, duree: String(dem.duree), nb: String(ps.length), tapis: String(dem.tapis),
    dep: String(dem.montants.dep), km: String(dem.deplacement.km || 0), pp: String(dem.montants.pp),
    pack: dem.pack ? dem.pack.code : '', sante: dem.sante, rappel: 'non',
    zone: dem.format === 'domicile' ? dem.deplacement.zone : 'enligne'
  };
  ps.forEach(function (x, i) { priv['p' + i] = JSON.stringify(x); });
  dem.participants.forEach(function (x) { empreintesParticipant_(x).forEach(function (k) { priv[k] = '1'; }); });
  if (dem.adresse) { priv.rue = dem.adresse.rue; priv.cp = dem.adresse.cp; priv.ville = dem.adresse.ville; }

  var lieu = dem.adresse ? dem.adresse.rue + ', ' + dem.adresse.cp + ' ' + dem.adresse.ville : '';
  var ressource = {
    summary: 'Yoga · ' + dem.participants[0].prenom + ' ' + dem.participants[0].nom + (ps.length > 1 ? ' · ' + ps.length + ' pers.' : '') +
             (dem.format === 'domicile' ? ' (domicile)' : ' (visio)'),
    description: descriptionAgenda_(dem, ps, id),
    start: { dateTime: dem.debut.toISOString(), timeZone: CONFIG.fuseau },
    end: { dateTime: dem.fin.toISOString(), timeZone: CONFIG.fuseau },
    location: lieu,
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 1440 }, { method: 'popup', minutes: 60 }] },
    extendedProperties: { private: priv }
  };
  var ev;
  if (dem.format === 'enligne') {
    ressource.conferenceData = { createRequest: { requestId: id, conferenceSolutionKey: { type: 'hangoutsMeet' } } };
    try { ev = Calendar.Events.insert(ressource, CONFIG.agendaReservations, { conferenceDataVersion: 1, sendUpdates: 'none' }); }
    catch (err) { delete ressource.conferenceData; ev = Calendar.Events.insert(ressource, CONFIG.agendaReservations, { sendUpdates: 'none' }); }
  } else {
    ev = Calendar.Events.insert(ressource, CONFIG.agendaReservations, { sendUpdates: 'none' });
  }
  resa.evenementId = ev.id; resa.lienEvenement = ev.htmlLink || ''; resa.visio = ev.hangoutLink || '';
  return resa;
}

/** Texte visible dans l'agenda partagé : pas d'informations de santé ici. */
function descriptionAgenda_(dem, ps, id) {
  var l = ['SAFE Yoga · ' + LIBELLES[dem.format].fr + ' · ' + dem.duree + ' min · ' + ps.length + ' pers.',
           'Réservé par : ' + dem.participants[0].prenom + ' ' + dem.client.nom + ' · ' + dem.client.tel + ' · ' + dem.client.email, '',
           'Participants :'];
  ps.forEach(function (x) { l.push('- ' + x.n + ' (' + LIBELLES.sexe[x.s] + ') : ' + libellePart_(x, 'fr')); });
  if (dem.format === 'domicile') {
    l.push('', 'Tapis à apporter : ' + dem.tapis);
    l.push('Déplacement : ' + (dem.montants.dep ? dem.montants.dep + ' € (' + dem.deplacement.km + ' km aller-retour)' : 'gratuit (Marseille)'));
  }
  if (dem.pack) l.push('Pack utilisé : ' + dem.pack.code);
  if (dem.sante) l.push('', 'Informations de santé : voir l\'e-mail de réservation.');
  l.push('', 'Réservation n° ' + id);
  return l.join('\n');
}

function libellePart_(x, lang) {
  var en = lang === 'en', m = euros_(x.a);
  if (x.t === 'annule') return en ? 'cancelled' : 'annulé';
  if (x.t === 'rembourse') return en ? 'cancelled, refunded' : 'annulé, remboursé';
  if (x.t === 'sans_objet') return x.m === 'pack' ? (en ? 'pack' : 'pack') : (en ? 'nothing to pay' : 'rien à payer');
  if (x.t === 'paye') return (en ? 'paid online ' : 'payé en ligne ') + m;
  if (x.t === 'recu') return (en ? 'paid by PayPal ' : 'payé par PayPal ') + m;
  if (x.m === 'lien') return (en ? 'payment link sent, ' : 'lien de paiement envoyé, ') + m;
  if (x.m === 'pack') return (en ? 'pack + travel in cash ' : 'pack + déplacement en espèces ') + m;
  if (x.m === 'virement') return (en ? 'PayPal before the session ' : 'PayPal avant la séance ') + m;
  return (en ? 'cash on the day ' : 'espèces le jour même ') + m;
}

/**
 * Coordonnées de paiement pour les séances en ligne : PayPal seulement (décision du 18/11, pas de RIB
 * pour ne pas exposer le nom de la titulaire). Adresse PayPal lue dans la propriété PAIEMENT_PAYPAL.
 */
function coordonneesPaiement_(lang, montant, resaId) {
  var t = TEXTES[lang === 'en' ? 'en' : 'fr'];
  var paypal = PropertiesService.getScriptProperties().getProperty('PAIEMENT_PAYPAL') || '';
  var h = '<div style="background:#EEF0E1;border-radius:12px;padding:14px 16px;margin:16px 0"><p style="margin:0 0 8px"><strong>' + t.paiementTitre + '</strong></p>' +
    '<p style="margin:0 0 8px">' + t.paiementIntro(euros_(montant), 'SAFE-' + resaId) + '</p>';
  if (!paypal) return h + '<p style="margin:0">' + t.paiementPlusTard + '</p></div>';
  return h + '<p style="margin:0;font-family:monospace;font-size:14px">' + t.paypal + ' : ' + echapper_(paypal) + '</p></div>';
}

function resumePublic_(resa, dem) {
  return { id: resa.id, cle: resa.cle, duree: dem.duree, format: dem.format, personnes: dem.participants.length,
           total: dem.montants.total, part: dem.montants.parts[0], debut: dem.debut.toISOString(), fin: dem.fin.toISOString(), visio: resa.visio };
}

// ============================================================
// PAYPAL
// ============================================================
function paypalBase_() { return CONFIG.paypal.env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'; }

function paypalJeton_() {
  var cache = CacheService.getScriptCache();
  var j = cache.get('paypal_jeton_' + CONFIG.paypal.env);
  if (j) return j;
  var secret = PropertiesService.getScriptProperties().getProperty('PAYPAL_SECRET');
  if (!CONFIG.paypal.clientId || !secret) throw new Error('PayPal non configuré (clientId ou PAYPAL_SECRET manquant).');
  var r = UrlFetchApp.fetch(paypalBase_() + '/v1/oauth2/token', {
    method: 'post', payload: { grant_type: 'client_credentials' }, muteHttpExceptions: true,
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(CONFIG.paypal.clientId + ':' + secret) } });
  var o = JSON.parse(r.getContentText());
  if (!o.access_token) throw new Error('Connexion PayPal impossible.');
  cache.put('paypal_jeton_' + CONFIG.paypal.env, o.access_token, Math.min(21000, Math.max(60, (o.expires_in || 3600) - 300)));
  return o.access_token;
}

function paypalAppel_(methode, chemin, corps) {
  var opts = { method: methode, contentType: 'application/json', muteHttpExceptions: true,
               headers: { Authorization: 'Bearer ' + paypalJeton_(), Prefer: 'return=representation' } };
  if (corps) opts.payload = JSON.stringify(corps);
  var r = UrlFetchApp.fetch(paypalBase_() + chemin, opts);
  var texte = r.getContentText();
  return { code: r.getResponseCode(), corps: texte ? JSON.parse(texte) : {} };
}

function paypalCommande_(montant, libelle, memo) {
  var r = paypalAppel_('post', '/v2/checkout/orders', {
    intent: 'CAPTURE',
    purchase_units: [{ amount: { currency_code: CONFIG.paypal.devise, value: Number(montant).toFixed(2) }, description: libelle.slice(0, 127) }],
    application_context: { brand_name: CONFIG.nomSite, shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW' } });
  if (r.code >= 300 || !r.corps.id) throw new Error('Création du paiement PayPal refusée (' + r.code + ').');
  CacheService.getScriptCache().put('cmd_' + r.corps.id, JSON.stringify(memo), 21600);
  return r.corps.id;
}

/** Encaisse ; renvoie la capture, ou une réponse d'erreur { ok:false } à transmettre telle quelle. */
function paypalEncaisser_(orderID, montantAttendu) {
  var r = paypalAppel_('post', '/v2/checkout/orders/' + orderID + '/capture', null);
  var corps = r.corps || {};
  if (r.code === 422 && JSON.stringify(corps).indexOf('INSTRUMENT_DECLINED') >= 0) {
    return { refus: { ok: false, code: 'refus_carte', message: 'Le moyen de paiement a été refusé. Essayez-en un autre.' } };
  }
  var capture = corps.purchase_units && corps.purchase_units[0] && corps.purchase_units[0].payments &&
                corps.purchase_units[0].payments.captures && corps.purchase_units[0].payments.captures[0];
  if (corps.status !== 'COMPLETED' || !capture || capture.status !== 'COMPLETED') throw new Error('Paiement PayPal non finalisé (' + (corps.status || r.code) + ').');
  if (Math.abs(Number(capture.amount.value) - montantAttendu) > 0.009 || capture.amount.currency_code !== CONFIG.paypal.devise) {
    throw new Error('Montant PayPal inattendu : ' + capture.amount.value);
  }
  return { capture: capture };
}

function lireCommande_(orderID) {
  if (!/^[A-Z0-9]{6,40}$/.test(String(orderID || ''))) throw erreurUtilisateur_('paypal', 'Paiement introuvable.');
  var s = CacheService.getScriptCache().get('cmd_' + orderID);
  if (!s) throw erreurUtilisateur_('paypal', 'Paiement expiré ou déjà validé. Recommencez.');
  return JSON.parse(s);
}

function paypalRembourser_(captureId, montant) {
  if (!captureId) return false;
  var r = paypalAppel_('post', '/v2/payments/captures/' + captureId + '/refund',
    { amount: { value: Number(montant).toFixed(2), currency_code: CONFIG.paypal.devise } });
  return r.code < 300 && (r.corps.status === 'COMPLETED' || r.corps.status === 'PENDING');
}

// --- Séance : la personne qui réserve paie sa part en ligne
function paypalCreerSeance_(d) {
  var dem = validerDemande_(d);
  if (dem.participants[0].mode !== 'enligne' || !(dem.montants.parts[0] > 0)) throw erreurUtilisateur_('paiement', 'Aucun paiement en ligne à faire pour cette réservation.');
  if (!creneauEncoreLibre_(dem)) throw erreurUtilisateur_('pris', 'Ce créneau vient d\'être réservé. Choisissez-en un autre.');
  verifierPremiere_(dem);
  var libelle = 'SAFE Yoga ' + dem.duree + ' min, ' + Utilities.formatDate(dem.debut, CONFIG.fuseau, 'dd/MM/yyyy HH:mm');
  return { ok: true, orderID: paypalCommande_(dem.montants.parts[0], libelle, { type: 'seance', d: d }) };
}

function paypalValiderSeance_(d) {
  var memo = lireCommande_(d.orderID);
  if (memo.type !== 'seance') throw erreurUtilisateur_('paypal', 'Paiement introuvable.');
  var dem = validerDemande_(memo.d);
  return avecVerrou_(function () {
    // Créneau vérifié AVANT d'encaisser : jamais de débit pour un créneau déjà pris.
    if (!creneauEncoreLibre_(dem)) throw erreurUtilisateur_('pris', 'Ce créneau vient d\'être réservé. Vous n\'avez pas été débité. Choisissez-en un autre.');
    verifierPremiere_(dem);
    var e = paypalEncaisser_(d.orderID, dem.montants.parts[0]);
    if (e.refus) return e.refus;
    CacheService.getScriptCache().remove('cmd_' + d.orderID);
    var resa = creerEvenement_(dem, e.capture.id);
    notifier_(resa, dem);
    return { ok: true, reservation: resumePublic_(resa, dem) };
  });
}

// --- Part d'un autre participant (lien reçu par e-mail)
function trouverPart_(id, p, cle) {
  var i = Number(p);
  if (!(i >= 1 && i < CATALOGUE.maxPersonnes) || i % 1) throw erreurUtilisateur_('lien', 'Lien invalide.');
  var ev = trouverEvenement_(id);
  var priv = ev.extendedProperties.private;
  var x = priv['p' + i] ? JSON.parse(priv['p' + i]) : null;
  if (!x || x.k !== cle) throw erreurUtilisateur_('lien', 'Lien invalide.');
  return { ev: ev, priv: priv, i: i, x: x };
}

function lirePart_(id, p, cle) {
  var t = trouverPart_(id, p, cle), debut = Date.parse(t.ev.start.dateTime);
  var payable = t.priv.statut === 'confirmee' && t.x.m === 'lien' && t.x.t === 'a_regler' && debut - Date.now() > CONFIG.preavisHeures * 3600e3;
  return { ok: true, part: { prenom: t.x.f || t.x.n, montant: t.x.a, statut: t.x.t, mode: t.x.m, payable: payable,
    duree: Number(t.priv.duree), format: t.priv.format, debut: new Date(debut).toISOString(), statutSeance: t.priv.statut } };
}

function paypalCreerPart_(d) {
  var l = lirePart_(d.id, d.p, d.cle).part;
  if (!l.payable) throw erreurUtilisateur_('part', 'Cette part ne peut plus être réglée en ligne : elle se règle en espèces le jour de la séance.');
  var libelle = 'SAFE Yoga ' + l.duree + ' min, part de ' + l.prenom + ', ' + Utilities.formatDate(new Date(l.debut), CONFIG.fuseau, 'dd/MM/yyyy HH:mm');
  return { ok: true, orderID: paypalCommande_(l.montant, libelle, { type: 'part', id: d.id, p: Number(d.p), cle: d.cle }) };
}

function paypalValiderPart_(d) {
  var memo = lireCommande_(d.orderID);
  if (memo.type !== 'part') throw erreurUtilisateur_('paypal', 'Paiement introuvable.');
  return avecVerrou_(function () {
    var t = trouverPart_(memo.id, memo.p, memo.cle);
    if (t.priv.statut !== 'confirmee' || t.x.t !== 'a_regler') throw erreurUtilisateur_('part', 'Cette part n\'est plus à régler.');
    var e = paypalEncaisser_(d.orderID, t.x.a);
    if (e.refus) return e.refus;
    CacheService.getScriptCache().remove('cmd_' + d.orderID);
    t.x.t = 'paye'; t.x.c = e.capture.id;
    t.priv['p' + t.i] = JSON.stringify(t.x);
    Calendar.Events.patch({ extendedProperties: { private: t.priv }, description: majDescription_(t.ev.description, t.priv) },
      CONFIG.agendaReservations, t.ev.id, { sendUpdates: 'none' });
    var debut = new Date(Date.parse(t.ev.start.dateTime));
    envoyer_({ to: CONFIG.emailProprietaire, subject: 'Part payée : ' + t.x.n + ', ' + libelleDate_(debut, 'fr'),
      body: t.x.n + ' a payé sa part en ligne (' + euros_(t.x.a) + ', PayPal ' + e.capture.id + ') pour la séance du ' + libelleDate_(debut, 'fr') + '.\n\n' + (t.ev.description || '') });
    var lang = t.priv.lang === 'en' ? 'en' : 'fr', tx = TEXTES[lang];
    if (t.x.e) envoyer_({ to: t.x.e, name: CONFIG.nomSite, replyTo: CONFIG.expediteur || CONFIG.emailProprietaire, subject: tx.sujetPartPayee,
      htmlBody: gabaritEmail_(tx.sujetPartPayee, '<p>' + echapper_(tx.bonjour(t.x.f || t.x.n)) + '</p><p>' + tx.partPayee(euros_(t.x.a), libelleDate_(debut, lang)) + '</p>', lang) });
    return { ok: true, part: { prenom: t.x.f || t.x.n, montant: t.x.a, statut: 'paye' } };
  });
}

function majDescription_(description, priv) {
  var l = String(description || '').split('\n'), debut = l.indexOf('Participants :');
  if (debut < 0) return description;
  var fin = debut + 1;
  while (fin < l.length && /^- /.test(l[fin])) fin++;
  var lignes = [];
  for (var i = 0; i < Number(priv.nb); i++) {
    var x = JSON.parse(priv['p' + i]);
    lignes.push('- ' + x.n + ' (' + LIBELLES.sexe[x.s] + ') : ' + libellePart_(x, 'fr'));
  }
  return l.slice(0, debut + 1).concat(lignes, l.slice(fin)).join('\n');
}

// ============================================================
// PACKS (11 séances au prix de 10)
// ============================================================
function lirePackBrut_(code) {
  code = String(code || '').toUpperCase().trim();
  if (!/^SAFE-[A-Z0-9]{6}$/.test(code)) return null;
  var s = PropertiesService.getScriptProperties().getProperty('pack_' + code);
  return s ? JSON.parse(s) : null;
}

function verifierPack_(code, email, format, duree, nb) {
  var p = lirePackBrut_(code);
  if (!p || p.email !== email) throw erreurUtilisateur_('pack', 'Code de pack inconnu pour cette adresse e-mail.');
  if (Date.parse(p.expire) < Date.now()) throw erreurUtilisateur_('pack', 'Ce pack a expiré.');
  if (p.restant < 1) throw erreurUtilisateur_('pack', 'Toutes les séances de ce pack ont été utilisées.');
  if (p.format !== format || Number(p.duree) !== Number(duree) || Number(p.taille) !== tranche_(nb)) {
    throw erreurUtilisateur_('pack', 'Ce pack ne correspond pas à cette séance (il vaut pour ' + libellePack_(p, 'fr') + ').');
  }
  return p;
}

function utiliserPack_(code, delta) {
  var p = lirePackBrut_(code);
  if (!p) return;
  p.restant = Math.max(0, Math.min(p.total, p.restant + delta));
  PropertiesService.getScriptProperties().setProperty('pack_' + p.code, JSON.stringify(p));
  return p;
}

function libellePack_(p, lang) {
  return p.duree + ' min, ' + (p.format === 'enligne' ? LIBELLES.enligne[lang] : LIBELLES.domicile[lang] + ' ' + LIBELLES.taille[p.taille][lang]);
}

function validerAchatPack_(d, especes) {
  if (d.piege) throw erreurUtilisateur_('spam', 'Demande refusée.');
  var format = d.format, duree = Number(d.duree), taille = format === 'enligne' ? 1 : Number(d.taille);
  if ([1, 2, 3].indexOf(taille) < 0) throw erreurUtilisateur_('taille', 'Taille de groupe invalide.');
  var montant = prixPack(format, duree, taille);
  var c = d.client || {};
  var client = { nom: propre_(c.nom, 80), email: propre_(c.email, 120).toLowerCase() };
  if (!client.nom) throw erreurUtilisateur_('client', 'Nom obligatoire.');
  if (!EMAIL_RE.test(client.email)) throw erreurUtilisateur_('email', 'Adresse e-mail invalide.');
  if (d.cgv !== true && !especes) throw erreurUtilisateur_('cgv', 'Merci d\'accepter les conditions de vente.');
  if (['domicile', 'enligne'].indexOf(format) < 0 || CATALOGUE.durees.indexOf(duree) < 0) throw erreurUtilisateur_('formule', 'Formule invalide.');
  if (!especes && !CONFIG.paypal.clientId) throw erreurUtilisateur_('paiement', 'Le paiement en ligne n\'est pas disponible.');
  return { format: format, duree: duree, taille: taille, montant: montant, client: client, lang: d.lang === 'en' ? 'en' : 'fr' };
}

function paypalCreerPack_(d) {
  var a = validerAchatPack_(d);
  var libelle = 'SAFE Yoga, pack de ' + CATALOGUE.pack.seances + ' séances, ' + libellePack_(a, 'fr');
  return { ok: true, orderID: paypalCommande_(a.montant, libelle, { type: 'pack', d: d }) };
}

function paypalValiderPack_(d) {
  var memo = lireCommande_(d.orderID);
  if (memo.type !== 'pack') throw erreurUtilisateur_('paypal', 'Paiement introuvable.');
  var a = validerAchatPack_(memo.d);
  return avecVerrou_(function () {
    var e = paypalEncaisser_(d.orderID, a.montant);
    if (e.refus) return e.refus;
    CacheService.getScriptCache().remove('cmd_' + d.orderID);
    var p = creerPack_(a, 'paypal', e.capture.id);
    return { ok: true, pack: { code: p.code, restant: p.restant, total: p.total, expire: p.expire, formule: libellePack_(p, a.lang) } };
  });
}

/** Crée un pack (payé par PayPal ou en espèces), prévient SAFE et envoie le code au client. */
function creerPack_(a, paiement, capture) {
  var code;
  do { code = 'SAFE-' + jeton_(6).toUpperCase(); } while (lirePackBrut_(code));
  var p = { code: code, email: a.client.email, nom: a.client.nom, format: a.format, duree: a.duree, taille: a.taille,
            total: CATALOGUE.pack.seances, restant: CATALOGUE.pack.seances, montant: a.montant, paiement: paiement, capture: capture || '',
            achat: new Date().toISOString(), expire: new Date(Date.now() + CATALOGUE.pack.validiteJours * 86400e3).toISOString(), lang: a.lang };
  PropertiesService.getScriptProperties().setProperty('pack_' + code, JSON.stringify(p));
  var t = TEXTES[a.lang], fin = libelleJour_(new Date(p.expire), a.lang);
  envoyer_({ to: CONFIG.emailProprietaire, subject: 'Pack vendu : ' + a.client.nom + ' (' + libellePack_(p, 'fr') + ')',
    body: 'Pack de ' + p.total + ' séances vendu ' + euros_(a.montant) + (paiement === 'especes' ? ' (payé en espèces, enregistré depuis la page de gestion).' : ' (PayPal ' + capture + ').') + '\n' +
          'Client : ' + a.client.nom + ' <' + a.client.email + '>\nFormule : ' + libellePack_(p, 'fr') + '\nCode : ' + code + '\nValable jusqu\'au ' + libelleJour_(new Date(p.expire), 'fr') });
  envoyer_({ to: a.client.email, name: CONFIG.nomSite, replyTo: CONFIG.expediteur || CONFIG.emailProprietaire, subject: t.sujetPack,
    htmlBody: gabaritEmail_(t.sujetPack, '<p>' + echapper_(t.bonjour(a.client.nom)) + '</p><p>' + t.corpsPack(p.total, libellePack_(p, a.lang), code, fin) + '</p>' +
      '<p><a style="color:#742834" href="' + CONFIG.urlSite + (a.lang === 'en' ? '/en/book/' : '/reserver/') + '">' + t.reserverMaintenant + '</a></p>', a.lang) });
  return p;
}

function lirePack_(d) {
  var p = lirePackBrut_(d.code);
  var email = propre_(d.email, 120).toLowerCase();
  if (!p || p.email !== email) throw erreurUtilisateur_('pack', 'Code de pack inconnu pour cette adresse e-mail.');
  var lang = d.lang === 'en' ? 'en' : 'fr';
  return { ok: true, pack: { code: p.code, restant: p.restant, total: p.total, expire: p.expire, format: p.format, duree: p.duree, taille: p.taille, formule: libellePack_(p, lang) } };
}

// ============================================================
// CONSULTATION, « RÉSERVER À NOUVEAU » ET ANNULATION
// ============================================================
function trouverEvenement_(id) {
  if (!/^[a-f0-9]{12}$/.test(String(id || ''))) throw erreurUtilisateur_('lien', 'Lien invalide.');
  var tMin = new Date(Date.now() - 400 * 86400e3), tMax = new Date(Date.now() + 400 * 86400e3);
  var ev = listerEvenements_(CONFIG.agendaReservations, tMin, tMax, 'resaId=' + id)[0];
  if (!ev || !ev.extendedProperties) throw erreurUtilisateur_('lien', 'Réservation introuvable.');
  return ev;
}

/** Qui ouvre le lien : la personne qui réserve (cle) ou un participant (p + sa clé). */
function identifier_(id, cle, p) {
  if (!/^[a-f0-9]{32}$/.test(String(cle || ''))) throw erreurUtilisateur_('lien', 'Lien invalide.');
  if (p != null && p !== '') return trouverPart_(id, p, cle);
  var ev = trouverEvenement_(id);
  if (ev.extendedProperties.private.cle !== cle) throw erreurUtilisateur_('lien', 'Réservation introuvable.');
  return { ev: ev, priv: ev.extendedProperties.private, i: null };
}

function lireReservation_(id, cle, p) {
  var t = identifier_(id, cle, p), debut = Date.parse(t.ev.start.dateTime);
  var statut = t.priv.statut;
  if (t.i !== null && t.x.t === 'annule' || t.i !== null && t.x.t === 'rembourse') statut = 'annulee';
  return { ok: true, reservation: {
    id: id, statut: statut, duree: Number(t.priv.duree), format: t.priv.format, personnes: Number(t.priv.nb),
    debut: new Date(debut).toISOString(), participant: t.i !== null, prenom: t.i !== null ? (t.x.f || t.x.n) : '',
    dansLesDelais: debut - Date.now() >= CONFIG.annulationHeures * 3600e3,
    annulable: statut === 'confirmee' && debut > Date.now() } };
}

/** Données pour pré-remplir le formulaire (lien « Réserver à nouveau » de la personne qui réserve). */
function lireReprise_(id, cle) {
  var t = identifier_(id, cle, null), q = t.priv, ps = [];
  for (var i = 0; i < Number(q.nb); i++) { var x = JSON.parse(q['p' + i]); ps.push({ prenom: x.f || x.n, nom: x.o || '', sexe: x.s, email: i ? x.e : '' }); }
  return { ok: true, reprise: {
    format: q.format, duree: Number(q.duree), tapis: Number(q.tapis || 0), participants: ps,
    adresse: q.format === 'domicile' ? { rue: q.rue || '', cp: q.cp || '', ville: q.ville || '' } : null,
    client: { nom: q.nom || '', email: q.email, tel: q.tel || '' }, sante: q.sante || '' } };
}

function annuler_(d) {
  return avecVerrou_(function () {
    var t = identifier_(d.id, d.cle, d.p);
    if (t.i !== null) return annulerParticipant_(t);
    var ev = t.ev, q = t.priv;
    if (q.statut !== 'confirmee') return { ok: true, dejaAnnulee: true };
    var debut = Date.parse(ev.start.dateTime);
    if (debut <= Date.now()) throw erreurUtilisateur_('passee', 'Cette séance est déjà passée.');
    var dansLesDelais = debut - Date.now() >= CONFIG.annulationHeures * 3600e3;
    var aRembourser = [], rembourses = [];
    for (var i = 0; i < Number(q.nb); i++) {
      var x = JSON.parse(q['p' + i]);
      if (x.t === 'paye' && dansLesDelais) {
        if (CONFIG.remboursementAuto && paypalRembourser_(x.c, x.a)) { x.t = 'rembourse'; rembourses.push(x); } else aRembourser.push(x);
      }
      q['p' + i] = JSON.stringify(x);
    }
    if (q.pack && dansLesDelais) utiliserPack_(q.pack, +1);
    q.statut = 'annulee';
    Calendar.Events.patch({ summary: 'ANNULÉ · ' + ev.summary, transparency: 'transparent', colorId: '8', extendedProperties: { private: q } },
      CONFIG.agendaReservations, ev.id, { sendUpdates: 'none' });

    var quand = libelleDate_(new Date(debut), 'fr');
    var lignes = ['La séance du ' + quand + ' est annulée par la personne qui a réservé (' + (dansLesDelais ? 'plus' : 'moins') + ' de ' + CONFIG.annulationHeures + ' h avant).', '', ev.description || '', ''];
    if (!dansLesDelais) lignes.push('Annulation tardive : la séance reste due (conditions de vente). Rien à rembourser.');
    aRembourser.forEach(function (x) { lignes.push('À FAIRE : rembourser ' + euros_(x.a) + ' à ' + x.n + ' dans PayPal (transaction ' + x.c + ').'); });
    rembourses.forEach(function (x) { lignes.push('Remboursé automatiquement : ' + euros_(x.a) + ' à ' + x.n + '.'); });
    if (q.pack) lignes.push(dansLesDelais ? 'Séance recréditée sur le pack ' + q.pack + '.' : 'Séance décomptée du pack ' + q.pack + ' (annulation tardive).');
    var x0 = JSON.parse(q.p0);
    if (x0.m === 'virement' && dansLesDelais) lignes.push(x0.t === 'recu' ? 'À FAIRE : rembourser ' + euros_(x0.a) + ' à ' + x0.n + ' dans PayPal (paiement marqué reçu, réf. SAFE-' + q.resaId + ').' : 'À VÉRIFIER : si ' + x0.n + ' a déjà payé par PayPal (réf. SAFE-' + q.resaId + '), lui rembourser ' + euros_(x0.a) + '.');
    lignes.push('', 'Le créneau est de nouveau libre sur le site.');
    envoyer_({ to: CONFIG.emailProprietaire, subject: 'Annulation : ' + ev.summary + ', ' + quand, body: lignes.join('\n') });

    var lang = q.lang === 'en' ? 'en' : 'fr', tx = TEXTES[lang], qd = libelleDate_(new Date(debut), lang);
    var paye0 = JSON.parse(q.p0).t;
    var html = '<p>' + tx.corpsAnnulation(qd) + '</p>' +
      (paye0 === 'paye' || paye0 === 'rembourse' ? '<p>' + (dansLesDelais ? tx.rembourse : tx.nonRembourse(CONFIG.annulationHeures)) + '</p>' : '') +
      (x0.m === 'virement' && dansLesDelais ? '<p>' + tx.rembourseVirement + '</p>' : '') +
      (!dansLesDelais && paye0 !== 'paye' && paye0 !== 'rembourse' ? '<p>' + tx.dueTardive(CONFIG.annulationHeures) + '</p>' : '');
    envoyer_({ to: q.email, name: CONFIG.nomSite, replyTo: CONFIG.expediteur || CONFIG.emailProprietaire, subject: tx.sujetAnnulation, htmlBody: gabaritEmail_(tx.titreAnnulation, html, lang) });
    for (var j = 1; j < Number(q.nb); j++) {
      var y = JSON.parse(q['p' + j]);
      if (!y.e || y.t === 'annule') continue;
      envoyer_({ to: y.e, name: CONFIG.nomSite, replyTo: CONFIG.expediteur || CONFIG.emailProprietaire, subject: tx.sujetAnnulation,
        htmlBody: gabaritEmail_(tx.titreAnnulation, '<p>' + echapper_(tx.bonjour(y.f || y.n)) + '</p><p>' + tx.corpsAnnulationGroupe(qd) + '</p>' +
          (y.t === 'paye' || y.t === 'rembourse' ? '<p>' + (dansLesDelais ? tx.rembourse : tx.nonRembourse(CONFIG.annulationHeures)) + '</p>' : ''), lang) });
    }
    return { ok: true, rembourse: dansLesDelais && (aRembourser.length + rembourses.length) > 0 };
  });
}

/** Un participant se désinscrit : il ne paie rien, le prix des autres ne change pas. */
function annulerParticipant_(t) {
  var ev = t.ev, q = t.priv, x = t.x;
  if (q.statut !== 'confirmee' || x.t === 'annule' || x.t === 'rembourse') return { ok: true, dejaAnnulee: true };
  var debut = Date.parse(ev.start.dateTime);
  if (debut <= Date.now()) throw erreurUtilisateur_('passee', 'Cette séance est déjà passée.');
  var rembourse = false, aRembourser = false;
  if (x.t === 'paye') {
    if (CONFIG.remboursementAuto && paypalRembourser_(x.c, x.a)) rembourse = true; else aRembourser = true;
  }
  x.t = rembourse ? 'rembourse' : 'annule';
  q['p' + t.i] = JSON.stringify(x);
  Calendar.Events.patch({ extendedProperties: { private: q }, description: majDescription_(ev.description, q) }, CONFIG.agendaReservations, ev.id, { sendUpdates: 'none' });
  var quand = libelleDate_(new Date(debut), 'fr');
  envoyer_({ to: CONFIG.emailProprietaire, subject: 'Désinscription : ' + x.n + ', ' + quand,
    body: x.n + ' se désinscrit de la séance du ' + quand + '. Il ne paie rien et le prix des autres participants ne change pas.\n' +
      (aRembourser ? 'À FAIRE : rembourser ' + euros_(x.a) + ' dans PayPal (transaction ' + x.c + ').\n' : '') +
      (rembourse ? 'Remboursé automatiquement : ' + euros_(x.a) + '.\n' : '') + '\n' + (ev.description || '') });
  var lang = q.lang === 'en' ? 'en' : 'fr', tx = TEXTES[lang];
  envoyer_({ to: q.email, name: CONFIG.nomSite, replyTo: CONFIG.expediteur || CONFIG.emailProprietaire, subject: tx.sujetDesinscription(x.n),
    htmlBody: gabaritEmail_(tx.sujetDesinscription(x.n), '<p>' + tx.corpsDesinscription(echapper_(x.n), libelleDate_(new Date(debut), lang)) + '</p>', lang) });
  if (x.e) envoyer_({ to: x.e, name: CONFIG.nomSite, replyTo: CONFIG.expediteur || CONFIG.emailProprietaire, subject: tx.sujetAnnulation,
    htmlBody: gabaritEmail_(tx.titreAnnulation, '<p>' + tx.corpsAnnulation(libelleDate_(new Date(debut), lang)) + '</p>' + (rembourse || aRembourser ? '<p>' + tx.rembourse + '</p>' : ''), lang) });
  return { ok: true, rembourse: rembourse || aRembourser };
}

// ============================================================
// GESTION (page /gestion/ protégée par le code ADMIN_CODE des propriétés du script)
// ============================================================
function verifierAdmin_(code) {
  var cache = CacheService.getScriptCache();
  var echecs = Number(cache.get('admin_echecs') || 0);
  if (echecs >= 5) throw erreurUtilisateur_('bloque', 'Trop de codes faux : la gestion est bloquée pendant une heure.');
  var bon = PropertiesService.getScriptProperties().getProperty('ADMIN_CODE') || '';
  if (bon.length < 10) throw erreurUtilisateur_('admin', 'Accès de gestion non configuré (propriété ADMIN_CODE, 10 caractères au moins).');
  if (String(code || '') !== bon) {
    cache.put('admin_echecs', String(echecs + 1), 3600);
    if (echecs + 1 >= 5) envoyer_({ to: CONFIG.emailProprietaire, subject: 'Gestion SAFE bloquée', body: '5 codes faux ont été saisis sur la page de gestion. Elle est bloquée pendant une heure. Si ce n\'était pas vous, changez le code (propriété ADMIN_CODE).' });
    throw erreurUtilisateur_('code', 'Code incorrect.');
  }
}

function adminListe_() {
  var tMin = new Date(Date.now() - 86400e3), tMax = new Date(Date.now() + 120 * 86400e3);
  var seances = listerEvenements_(CONFIG.agendaReservations, tMin, tMax, null).filter(function (ev) {
    return ev.extendedProperties && ev.extendedProperties.private && ev.extendedProperties.private.resaId;
  }).map(function (ev) {
    var q = ev.extendedProperties.private, ps = [];
    for (var i = 0; i < Number(q.nb); i++) { var x = JSON.parse(q['p' + i]); ps.push({ nom: x.n, statut: x.t, mode: x.m, montant: x.a }); }
    return { id: q.resaId, debut: ev.start.dateTime, statut: q.statut, format: q.format, duree: Number(q.duree), ville: q.ville || '',
             tapis: Number(q.tapis || 0), pack: q.pack || '', participants: ps, passee: Date.parse(ev.start.dateTime) <= Date.now() };
  }).sort(function (a, b) { return Date.parse(a.debut) - Date.parse(b.debut); });
  var props = PropertiesService.getScriptProperties().getProperties(), packs = [];
  Object.keys(props).forEach(function (k) {
    if (k.indexOf('pack_') !== 0) return;
    var p = JSON.parse(props[k]);
    packs.push({ code: p.code, nom: p.nom, email: p.email, formule: libellePack_(p, 'fr'), restant: p.restant, total: p.total,
                 expire: p.expire, achat: p.achat, paiement: p.paiement || 'paypal', montant: p.montant });
  });
  packs.sort(function (a, b) { return Date.parse(b.achat) - Date.parse(a.achat); });
  return { ok: true, seances: seances, packs: packs, dispos: adminDispos_(), catalogue: CATALOGUE };
}

/** Pack payé en espèces, enregistré par SAFE. */
function adminPackEspeces_(d) {
  var a = validerAchatPack_(d, true);
  if (d.recu !== true) throw erreurUtilisateur_('recu', 'Cochez la case qui confirme que le montant a été reçu en espèces.');
  return avecVerrou_(function () {
    var p = creerPack_(a, 'especes', '');
    return { ok: true, pack: { code: p.code, formule: libellePack_(p, 'fr'), montant: p.montant, expire: p.expire } };
  });
}

/** Séance annulée par SAFE : tout le monde est prévenu, remboursé en totalité, et le pack est recrédité. */
function adminAnnuler_(d) {
  var message = String(d.message || '').trim().slice(0, 1000);
  return avecVerrou_(function () {
    var ev = trouverEvenement_(d.id), q = ev.extendedProperties.private;
    if (q.statut !== 'confirmee') return { ok: true, dejaAnnulee: true };
    var debut = Date.parse(ev.start.dateTime);
    if (debut <= Date.now()) throw erreurUtilisateur_('passee', 'Cette séance est déjà passée.');
    var rembourses = [], aRembourser = [], manuels = [], destinataires = [];
    for (var i = 0; i < Number(q.nb); i++) {
      var x = JSON.parse(q['p' + i]);
      if (x.t === 'paye') {
        if (paypalRembourser_(x.c, x.a)) { x.t = 'rembourse'; rembourses.push(x); } else aRembourser.push(x);
      } else if (x.t === 'recu') { manuels.push(x); x.t = 'annule'; x.ar = 1; }
      else if (x.t !== 'rembourse') x.t = 'annule';
      q['p' + i] = JSON.stringify(x);
      var email = i === 0 ? q.email : x.e;
      if (email) destinataires.push({ email: email, x: x, i: i });
    }
    if (q.pack) utiliserPack_(q.pack, +1);
    q.statut = 'annulee';
    q.annulePar = 'safe';
    Calendar.Events.patch({ summary: 'ANNULÉ PAR SAFE · ' + ev.summary, transparency: 'transparent', colorId: '8', extendedProperties: { private: q } },
      CONFIG.agendaReservations, ev.id, { sendUpdates: 'none' });

    var quand = libelleDate_(new Date(debut), 'fr');
    var lignes = ['Vous avez annulé la séance du ' + quand + '.', message ? 'Message envoyé aux participants : ' + message : '', ''];
    rembourses.forEach(function (x) { lignes.push('Remboursé automatiquement : ' + euros_(x.a) + ' à ' + x.n + '.'); });
    aRembourser.forEach(function (x) { lignes.push('À FAIRE : le remboursement automatique a échoué, rembourser ' + euros_(x.a) + ' à ' + x.n + ' dans PayPal (transaction ' + x.c + ').'); });
    if (q.pack) lignes.push('Séance recréditée sur le pack ' + q.pack + '.');
    var v0 = JSON.parse(q.p0);
    manuels.forEach(function (x) { lignes.push('À FAIRE : rembourser ' + euros_(x.a) + ' à ' + x.n + ' dans PayPal (paiement marqué reçu, réf. SAFE-' + q.resaId + ').'); });
    if (v0.m === 'virement' && !v0.ar) lignes.push('À VÉRIFIER : si ' + v0.n + ' a déjà payé par PayPal (réf. SAFE-' + q.resaId + '), lui rembourser ' + euros_(v0.a) + '.');
    lignes.push('Participants prévenus par e-mail : ' + (destinataires.map(function (y) { return y.x.n; }).join(', ') || 'aucun'), '', ev.description || '');
    envoyer_({ to: CONFIG.emailProprietaire, subject: 'Séance annulée par SAFE : ' + quand, body: lignes.join('\n') });

    var lang = q.lang === 'en' ? 'en' : 'fr', tx = TEXTES[lang], qd = libelleDate_(new Date(debut), lang);
    destinataires.forEach(function (y) {
      var paye = y.x.t === 'rembourse' || aRembourser.indexOf(y.x) >= 0 || manuels.indexOf(y.x) >= 0;
      var html = '<p>' + echapper_(tx.bonjour(y.x.f || y.x.n)) + '</p><p>' + tx.corpsAnnulationSafe(qd) + '</p>' +
        (message ? '<p>' + echapper_(message).replace(/\n/g, '<br>') + '</p>' : '') +
        (paye ? '<p>' + tx.rembourseSafe(euros_(y.x.a)) + '</p>' : '') +
        (y.i === 0 && v0.m === 'virement' && !v0.ar ? '<p>' + tx.rembourseVirement + '</p>' : '') +
        (y.i === 0 && q.pack ? '<p>' + tx.packRecredite + '</p>' : '') +
        '<p><a style="color:#742834" href="' + CONFIG.urlSite + (lang === 'en' ? '/en/book/' : '/reserver/') + '">' + tx.reserverMaintenant + '</a></p>';
      envoyer_({ to: y.email, name: CONFIG.nomSite, replyTo: CONFIG.expediteur || CONFIG.emailProprietaire, subject: tx.sujetAnnulationSafe(qd), htmlBody: gabaritEmail_(tx.titreAnnulation, html, lang) });
    });
    return { ok: true, rembourses: rembourses.length, aRembourser: aRembourser.length, prevenus: destinataires.length };
  });
}

/** Supprime définitivement de l'agenda une séance déjà annulée (page de gestion). */
function adminSupprimer_(d) {
  return avecVerrou_(function () {
    var ev = trouverEvenement_(d.id), q = ev.extendedProperties.private;
    if (q.statut === 'confirmee') throw erreurUtilisateur_('confirmee', 'Seule une séance annulée peut être supprimée. Annulez-la d\'abord.');
    Calendar.Events.remove(CONFIG.agendaReservations, ev.id);
    return { ok: true };
  });
}

/** Paiement PayPal reçu (séance en ligne réglée par le client avant la séance) : enregistré par SAFE, le client est prévenu. */
function adminPaiementRecu_(d) {
  return avecVerrou_(function () {
    var ev = trouverEvenement_(d.id), q = ev.extendedProperties.private, i = Number(d.p || 0);
    if (q.statut !== 'confirmee') throw erreurUtilisateur_('annulee', 'Cette séance est annulée.');
    if (!(i >= 0 && i < Number(q.nb))) throw erreurUtilisateur_('participant', 'Participant introuvable.');
    var x = JSON.parse(q['p' + i]);
    if (x.t === 'recu') return { ok: true, deja: true };
    if (x.m !== 'virement' || x.t !== 'a_regler') throw erreurUtilisateur_('mode', 'Ce participant ne règle pas par PayPal avant la séance.');
    x.t = 'recu'; x.r = new Date().toISOString();
    q['p' + i] = JSON.stringify(x);
    Calendar.Events.patch({ description: majDescription_(ev.description, q), extendedProperties: { private: q } }, CONFIG.agendaReservations, ev.id, { sendUpdates: 'none' });
    var email = i === 0 ? q.email : x.e;
    if (email) {
      var lang = q.lang === 'en' ? 'en' : 'fr', tx = TEXTES[lang];
      envoyer_({ to: email, name: CONFIG.nomSite, replyTo: CONFIG.expediteur || CONFIG.emailProprietaire, subject: tx.sujetPaiementRecu,
        htmlBody: gabaritEmail_(tx.titrePaiementRecu, '<p>' + echapper_(tx.bonjour(x.f || x.n)) + '</p><p>' +
          tx.corpsPaiementRecu(euros_(x.a), libelleDate_(new Date(Date.parse(ev.start.dateTime)), lang)) + '</p>', lang) });
    }
    return { ok: true, prevenu: !!email };
  });
}

// ============================================================
// DISPONIBILITÉS (gérées depuis la page /gestion/ ; écrit dans l'agenda « Disponibilités SAFE »)
// ============================================================
var TYPES_DISPO = { tous: 'Dispo', domicile: 'Dispo domicile', enligne: 'Dispo en ligne' };
var JOURS_SEMAINE = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function typeDispo_(titre) {
  titre = String(titre || '').toLowerCase();
  if (/ligne|visio|online/.test(titre)) return 'enligne';
  if (/domicile|maison|home/.test(titre)) return 'domicile';
  return 'tous';
}

/** "2026-11-25", "09:00" (heure de Paris) -> Date */
function dateParis_(jour, hhmm) {
  var t = Date.parse(jour + 'T' + hhmm + ':00Z');
  for (var i = 0; i < 2; i++) {
    var local = Date.parse(Utilities.formatDate(new Date(t), CONFIG.fuseau, "yyyy-MM-dd'T'HH:mm:ss") + 'Z');
    t += Date.parse(jour + 'T' + hhmm + ':00Z') - local;
  }
  return new Date(t);
}

function regleSerie_(master) {
  var rr = ((master && master.recurrence) || []).filter(function (r) { return /^RRULE:/.test(r); })[0] || '';
  var m = rr.match(/UNTIL=(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})Z)?/), jusqu = '';
  if (m) {
    var u = m[4] ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[5], +m[6], +m[7])) : new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
    jusqu = Utilities.formatDate(u, CONFIG.fuseau, 'yyyy-MM-dd');
  }
  var jour = master && master.start && master.start.dateTime ? JOURS_SEMAINE[Number(Utilities.formatDate(new Date(Date.parse(master.start.dateTime)), CONFIG.fuseau, 'u')) % 7] : '';
  return { hebdo: /FREQ=WEEKLY/.test(rr), jour: jour, jusqu: jusqu };
}

/** Séances confirmées qui chevauchent [a, b[ (ms). */
function seancesSur_(a, b) {
  return listerEvenements_(CONFIG.agendaReservations, new Date(a), new Date(b), null).filter(function (ev) {
    var q = ev.extendedProperties && ev.extendedProperties.private;
    return ev.start && ev.start.dateTime && ev.status !== 'cancelled' && ev.transparency !== 'transparent' && q && q.resaId && q.statut === 'confirmee' &&
      Date.parse(ev.start.dateTime) < b && Date.parse(ev.end.dateTime) > a;
  });
}

function adminDispos_() {
  var tMin = new Date(), tMax = new Date(Date.now() + Math.max(CONFIG.horizonJours, 90) * 86400e3);
  var evs = listerEvenements_(CONFIG.agendaDispos, tMin, tMax, null).filter(function (ev) {
    return ev.start && ev.start.dateTime && ev.status !== 'cancelled';
  });
  var resas = listerEvenements_(CONFIG.agendaReservations, tMin, tMax, null).filter(function (ev) {
    var q = ev.extendedProperties && ev.extendedProperties.private;
    return ev.start && ev.start.dateTime && q && q.resaId && q.statut === 'confirmee' && ev.transparency !== 'transparent';
  });
  var series = {};
  return evs.map(function (ev) {
    var a = Date.parse(ev.start.dateTime), b = Date.parse(ev.end.dateTime), s = null;
    if (ev.recurringEventId) {
      if (!(ev.recurringEventId in series)) {
        try { series[ev.recurringEventId] = regleSerie_(Calendar.Events.get(CONFIG.agendaDispos, ev.recurringEventId)); }
        catch (e) { series[ev.recurringEventId] = { hebdo: true, jour: '', jusqu: '' }; }
      }
      s = series[ev.recurringEventId];
    }
    var n = resas.filter(function (r) { return Date.parse(r.start.dateTime) < b && Date.parse(r.end.dateTime) > a; }).length;
    return { id: ev.id, serie: ev.recurringEventId || '', regle: s, debut: new Date(a).toISOString(), fin: new Date(b).toISOString(),
             jour: Utilities.formatDate(new Date(a), CONFIG.fuseau, 'yyyy-MM-dd'),
             de: Utilities.formatDate(new Date(a), CONFIG.fuseau, 'HH:mm'), a: Utilities.formatDate(new Date(b), CONFIG.fuseau, 'HH:mm'),
             type: typeDispo_(ev.summary), reservees: n };
  }).sort(function (x, y) { return Date.parse(x.debut) - Date.parse(y.debut); });
}

function adminDispoAjouter_(d) {
  var jour = String(d.date || ''), de = String(d.de || ''), a = String(d.a || ''), type = String(d.type || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) throw erreurUtilisateur_('date', 'Date invalide.');
  if (!/^\d{2}:\d{2}$/.test(de) || !/^\d{2}:\d{2}$/.test(a)) throw erreurUtilisateur_('heure', 'Heures invalides.');
  if (!TYPES_DISPO[type]) throw erreurUtilisateur_('type', 'Type de créneau inconnu.');
  var debut = dateParis_(jour, de), fin = dateParis_(jour, a);
  if (fin - debut < Math.min.apply(null, CATALOGUE.durees) * 60e3) throw erreurUtilisateur_('heure', 'Le créneau doit durer au moins ' + Math.min.apply(null, CATALOGUE.durees) + ' minutes, et la fin être après le début.');
  if (fin <= Date.now()) throw erreurUtilisateur_('date', 'Ce créneau est déjà passé.');
  if (debut - Date.now() > 366 * 86400e3) throw erreurUtilisateur_('date', 'Date trop lointaine (un an au plus).');
  var ev = { summary: TYPES_DISPO[type], transparency: 'transparent',
    start: { dateTime: Utilities.formatDate(debut, CONFIG.fuseau, "yyyy-MM-dd'T'HH:mm:ss"), timeZone: CONFIG.fuseau },
    end: { dateTime: Utilities.formatDate(fin, CONFIG.fuseau, "yyyy-MM-dd'T'HH:mm:ss"), timeZone: CONFIG.fuseau } };
  var nb = 1;
  if (d.repeter) {
    var jusqu = String(d.jusqu || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jusqu) || jusqu < jour) throw erreurUtilisateur_('jusqu', 'Date de fin de répétition invalide.');
    var finSerie = dateParis_(jusqu, '23:59');
    if (finSerie - debut > 366 * 86400e3) throw erreurUtilisateur_('jusqu', 'La répétition ne peut pas dépasser un an.');
    ev.recurrence = ['RRULE:FREQ=WEEKLY;UNTIL=' + Utilities.formatDate(finSerie, 'UTC', "yyyyMMdd'T'HHmmss'Z'")];
    nb = Math.floor((finSerie - debut) / (7 * 86400e3)) + 1;
  }
  Calendar.Events.insert(ev, CONFIG.agendaDispos);
  return { ok: true, nb: nb };
}

function adminDispoRetirer_(d) {
  var portee = d.portee === 'suivantes' ? 'suivantes' : 'une';
  return avecVerrou_(function () {
    var ev;
    try { ev = Calendar.Events.get(CONFIG.agendaDispos, String(d.id || '')); } catch (e) { ev = null; }
    if (!ev || ev.status === 'cancelled' || !ev.start || !ev.start.dateTime) throw erreurUtilisateur_('introuvable', 'Créneau introuvable : rechargez la page.');
    var a = Date.parse(ev.start.dateTime), b = Date.parse(ev.end.dateTime);
    if (portee === 'une' || !ev.recurringEventId) {
      var bloque = seancesSur_(a, b);
      if (bloque.length) throw erreurUtilisateur_('reservee', 'Une séance est réservée sur ce créneau (' + libelleDate_(new Date(Date.parse(bloque[0].start.dateTime)), 'fr') + '). Annulez-la d\'abord dans « Séances à venir ».');
      Calendar.Events.remove(CONFIG.agendaDispos, ev.id);
      return { ok: true, retires: 1 };
    }
    // Cette date et les suivantes : la série s'arrête la veille de cette date.
    var master = Calendar.Events.get(CONFIG.agendaDispos, ev.recurringEventId);
    var suite = listerEvenements_(CONFIG.agendaDispos, new Date(a), new Date(a + 400 * 86400e3), null).filter(function (x) {
      return x.recurringEventId === ev.recurringEventId && x.status !== 'cancelled' && x.start && x.start.dateTime && Date.parse(x.start.dateTime) >= a;
    });
    for (var i = 0; i < suite.length; i++) {
      var bl = seancesSur_(Date.parse(suite[i].start.dateTime), Date.parse(suite[i].end.dateTime));
      if (bl.length) throw erreurUtilisateur_('reservee', 'Une séance est réservée sur un de ces créneaux (' + libelleDate_(new Date(Date.parse(bl[0].start.dateTime)), 'fr') + '). Annulez-la d\'abord dans « Séances à venir », ou retirez seulement les autres dates.');
    }
    if (Date.parse(master.start.dateTime) >= a) {
      Calendar.Events.remove(CONFIG.agendaDispos, master.id);
    } else {
      var until = 'UNTIL=' + Utilities.formatDate(new Date(a - 1000), 'UTC', "yyyyMMdd'T'HHmmss'Z'");
      var rec = (master.recurrence || []).map(function (r) {
        if (!/^RRULE:/.test(r)) return r;
        r = r.replace(/;?(UNTIL|COUNT)=[^;]*/g, '');
        return r + ';' + until;
      });
      Calendar.Events.patch({ recurrence: rec }, CONFIG.agendaDispos, master.id);
    }
    return { ok: true, retires: suite.length };
  });
}

// ============================================================
// CONTACT
// ============================================================
function contact_(d) {
  if (d.piege) throw erreurUtilisateur_('spam', 'Message refusé.');
  var nom = propre_(d.nom, 100), email = propre_(d.email, 120), message = String(d.message || '').trim().slice(0, 3000);
  if (!nom || !message) throw erreurUtilisateur_('contact', 'Nom et message obligatoires.');
  if (!EMAIL_RE.test(email)) throw erreurUtilisateur_('email', 'Adresse e-mail invalide.');
  limiterParEmail_('contact:' + email);
  envoyer_({ to: CONFIG.emailProprietaire, replyTo: email, subject: 'Message du site : ' + nom, body: 'De : ' + nom + ' <' + email + '>\n\n' + message });
  return { ok: true };
}

// ============================================================
// E-MAILS
// ============================================================
var TEXTES = {
  fr: {
    sujetConfirmation: 'Votre séance SAFE est confirmée', titreConfirmation: 'Votre séance est confirmée',
    bonjour: function (p) { return 'Bonjour ' + p + ','; },
    intro: 'Merci pour votre réservation. Voici le récapitulatif :',
    quand: 'Date', duree: 'Séance', lieu: 'Lieu', participants: 'Participants', tapis: 'Tapis apportés par SAFE', deplacement: 'Déplacement', total: 'Total', votrePart: 'Votre part',
    gratuit: 'gratuit', visio: 'Lien de la visio', visioPlusTard: 'Le lien de la visio vous sera envoyé avant la séance.',
    liensEnvoyes: 'Les participants qui paient en ligne reçoivent leur lien de paiement par e-mail. Sans paiement 24 h avant la séance, leur part se règle en espèces.',
    annuler: function (h) { return 'Besoin d\'annuler ? Annulation gratuite jusqu\'à ' + h + ' h avant la séance :'; },
    lienAnnuler: 'Gérer ou annuler ma réservation', lienReprendre: 'Réserver à nouveau (formulaire pré-rempli)',
    reprendreAide: 'Ce lien est personnel : ne le transférez pas.',
    ics: 'Le fichier joint ajoute la séance à votre agenda.', signature: 'À très bientôt,',
    mention: 'Nos séances ne remplacent pas un suivi médical ou psychologique. Urgence : 15. Pensées suicidaires : 3114.',
    sujetInvitation: function (p) { return p + ' vous a inscrit à une séance SAFE Yoga'; },
    corpsInvitation: function (p, q, d) { return p + ' vous a inscrit à une séance de yoga SAFE de ' + d + ' min, ' + q + '.'; },
    payerEnLigne: 'Payer ma part en ligne', ouEspeces: function (h) { return 'Vous pouvez aussi régler en espèces le jour de la séance. Sans paiement en ligne ' + h + ' h avant, votre part se règle en espèces.'; },
    partEspeces: 'Votre part se règle en espèces le jour de la séance.',
    seDesinscrire: 'Me désinscrire', charteRappel: 'En participant, vous acceptez notre charte de séance :',
    sujetRappel: 'Rappel : votre séance SAFE de demain', titreRappel: 'À demain',
    rappelLien: function (m) { return 'Votre part (' + m + ') n\'a pas été réglée en ligne : elle se règle en espèces au début de la séance.'; },
    sujetAnnulation: 'Votre séance SAFE est annulée', titreAnnulation: 'Séance annulée',
    corpsAnnulation: function (q) { return 'Votre séance du ' + q + ' est bien annulée.'; },
    corpsAnnulationGroupe: function (q) { return 'La séance du ' + q + ' à laquelle vous étiez inscrit est annulée par la personne qui l\'a réservée.'; },
    rembourse: 'Votre paiement en ligne vous sera remboursé sous quelques jours.',
    nonRembourse: function (h) { return 'L\'annulation intervient moins de ' + h + ' h avant la séance : conformément aux conditions de vente, elle n\'est pas remboursée.'; },
    dueTardive: function (h) { return 'L\'annulation intervient moins de ' + h + ' h avant la séance : conformément aux conditions de vente, la séance reste due.'; },
    sujetDesinscription: function (p) { return p + ' s\'est désinscrit de votre séance SAFE'; },
    corpsDesinscription: function (p, q) { return p + ' s\'est désinscrit de la séance du ' + q + '. Le prix des autres participants ne change pas.'; },
    sujetPartPayee: 'Votre part est réglée', partPayee: function (m, q) { return 'Nous avons bien reçu votre paiement de ' + m + ' pour la séance du ' + q + '. Merci !'; },
    sujetPack: 'Votre pack SAFE Yoga', reserverMaintenant: 'Réserver une séance',
    rembourseVirement: 'Si vous avez déjà payé par PayPal, nous vous remboursons dans les prochains jours.',
    sujetPaiementRecu: 'Paiement reçu : votre séance SAFE', titrePaiementRecu: 'Paiement reçu',
    corpsPaiementRecu: function (m, q) { return 'Nous avons bien reçu votre paiement PayPal de ' + m + ' pour votre séance du ' + q + '. Merci, et à bientôt.'; },
    paiementTitre: 'Paiement avant la séance', paiementIntro: function (m, ref) { return 'Merci de régler <strong>' + m + '</strong> avant la séance, par PayPal&nbsp;: choisissez «&nbsp;Envoyer&nbsp;», saisissez l\'adresse ci-dessous, puis écrivez <strong>' + ref + '</strong> dans le message du paiement. C\'est votre numéro de réservation&nbsp;: il nous permet de relier votre paiement à votre séance.'; },
    titulaire: 'Titulaire', paypal: 'PayPal', paiementPlusTard: 'Nous vous envoyons notre adresse PayPal par e-mail.',
    sujetAnnulationSafe: function (q) { return 'Séance SAFE annulée : ' + q; },
    corpsAnnulationSafe: function (q) { return 'Nous sommes désolés : nous devons annuler votre séance du ' + q + '.'; },
    rembourseSafe: function (m) { return 'Votre paiement en ligne (' + m + ') vous est remboursé en totalité. Il apparaît sous quelques jours, selon votre banque.'; },
    packRecredite: 'La séance a été recréditée sur votre pack.',
    corpsPack: function (n, f, c, fin) { return 'Merci pour votre achat : ' + n + ' séances (' + echapper_(f) + '), valables jusqu\'au ' + fin + '.<br>Votre code de pack : <strong>' + c + '</strong><br>Au moment de réserver, choisissez « Avec mon pack » et indiquez ce code avec la même adresse e-mail. Le déplacement éventuel se règle en espèces.'; }
  },
  en: {
    sujetConfirmation: 'Your SAFE session is confirmed', titreConfirmation: 'Your session is confirmed',
    bonjour: function (p) { return 'Hello ' + p + ','; },
    intro: 'Thank you for your booking. Here is a summary:',
    quand: 'Date', duree: 'Session', lieu: 'Place', participants: 'Participants', tapis: 'Mats brought by SAFE', deplacement: 'Travel', total: 'Total', votrePart: 'Your share',
    gratuit: 'free', visio: 'Video call link', visioPlusTard: 'The video call link will be sent to you before the session.',
    liensEnvoyes: 'Participants paying online receive their payment link by email. Without payment 24 hours before the session, their share is paid in cash.',
    annuler: function (h) { return 'Need to cancel? Free cancellation up to ' + h + ' hours before the session:'; },
    lienAnnuler: 'Manage or cancel my booking', lienReprendre: 'Book again (pre-filled form)',
    reprendreAide: 'This link is personal: please do not forward it.',
    ics: 'The attached file adds the session to your calendar.', signature: 'See you soon,',
    mention: 'Our sessions do not replace medical or psychological care. Emergency (France): 15. Suicidal thoughts: 3114.',
    sujetInvitation: function (p) { return p + ' has booked you into a SAFE Yoga session'; },
    corpsInvitation: function (p, q, d) { return p + ' has booked you into a ' + d + '-minute SAFE yoga session, ' + q + '.'; },
    payerEnLigne: 'Pay my share online', ouEspeces: function (h) { return 'You can also pay in cash on the day. Without online payment ' + h + ' hours before, your share is paid in cash.'; },
    partEspeces: 'Your share is paid in cash on the day.',
    seDesinscrire: 'Cancel my place', charteRappel: 'By taking part, you accept our session charter:',
    sujetRappel: 'Reminder: your SAFE session tomorrow', titreRappel: 'See you tomorrow',
    rappelLien: function (m) { return 'Your share (' + m + ') has not been paid online: please pay it in cash at the start of the session.'; },
    sujetAnnulation: 'Your SAFE session has been cancelled', titreAnnulation: 'Session cancelled',
    corpsAnnulation: function (q) { return 'Your session on ' + q + ' has been cancelled.'; },
    corpsAnnulationGroupe: function (q) { return 'The session on ' + q + ' you were booked into has been cancelled by the person who booked it.'; },
    rembourse: 'Your online payment will be refunded within a few days.',
    nonRembourse: function (h) { return 'The cancellation was made less than ' + h + ' hours before the session: under the terms of sale, it is not refunded.'; },
    dueTardive: function (h) { return 'The cancellation was made less than ' + h + ' hours before the session: under the terms of sale, the session remains due.'; },
    sujetDesinscription: function (p) { return p + ' has cancelled their place in your SAFE session'; },
    corpsDesinscription: function (p, q) { return p + ' has cancelled their place in the session on ' + q + '. The price for the other participants does not change.'; },
    sujetPartPayee: 'Your share is paid', partPayee: function (m, q) { return 'We have received your payment of ' + m + ' for the session on ' + q + '. Thank you!'; },
    sujetPack: 'Your SAFE Yoga pack', reserverMaintenant: 'Book a session',
    rembourseVirement: 'If you have already paid by PayPal, we will refund you in the coming days.',
    sujetPaiementRecu: 'Payment received: your SAFE session', titrePaiementRecu: 'Payment received',
    corpsPaiementRecu: function (m, q) { return 'We have received your PayPal payment of ' + m + ' for your session on ' + q + '. Thank you, see you soon.'; },
    paiementTitre: 'Payment before the session', paiementIntro: function (m, ref) { return 'Please pay <strong>' + m + '</strong> before the session, by PayPal: choose “Send”, enter the address below, then write <strong>' + ref + '</strong> in the payment message. It is your booking number: it lets us match your payment to your session.'; },
    titulaire: 'Account holder', paypal: 'PayPal', paiementPlusTard: 'We will send you our PayPal address by email.',
    sujetAnnulationSafe: function (q) { return 'SAFE session cancelled: ' + q; },
    corpsAnnulationSafe: function (q) { return 'We are sorry: we have to cancel your session on ' + q + '.'; },
    rembourseSafe: function (m) { return 'Your online payment (' + m + ') is refunded in full. It will appear within a few days, depending on your bank.'; },
    packRecredite: 'The session has been credited back to your pack.',
    corpsPack: function (n, f, c, fin) { return 'Thank you for your purchase: ' + n + ' sessions (' + echapper_(f) + '), valid until ' + fin + '.<br>Your pack code: <strong>' + c + '</strong><br>When booking, choose "With my pack" and enter this code with the same email address. Any travel cost is paid in cash.'; }
  }
};

var JOURS = { fr: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] };
var MOIS = { fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
             en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] };

function libelleJour_(d, lang) {
  var jsem = Number(Utilities.formatDate(d, CONFIG.fuseau, 'u')) % 7;
  var j = Number(Utilities.formatDate(d, CONFIG.fuseau, 'd')), m = Number(Utilities.formatDate(d, CONFIG.fuseau, 'M')) - 1;
  var a = Utilities.formatDate(d, CONFIG.fuseau, 'yyyy');
  return lang === 'en' ? JOURS.en[jsem] + ', ' + MOIS.en[m] + ' ' + j + ', ' + a : JOURS.fr[jsem] + ' ' + j + ' ' + MOIS.fr[m] + ' ' + a;
}
function libelleDate_(d, lang) {
  var jsem = Number(Utilities.formatDate(d, CONFIG.fuseau, 'u')) % 7;
  var j = Number(Utilities.formatDate(d, CONFIG.fuseau, 'd')), m = Number(Utilities.formatDate(d, CONFIG.fuseau, 'M')) - 1;
  var h = Utilities.formatDate(d, CONFIG.fuseau, 'HH:mm');
  if (lang === 'en') return JOURS.en[jsem] + ', ' + MOIS.en[m] + ' ' + j + ' at ' + h + ' (Paris time)';
  return JOURS.fr[jsem] + ' ' + j + ' ' + MOIS.fr[m] + ' à ' + h.replace(':', 'h');
}
function euros_(v) { var n = Math.round(Number(v) * 100) / 100; return (n % 1 ? n.toFixed(2).replace('.', ',') : String(n)) + ' €'; }
function echapper_(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function jeton_(n) { var s = ''; while (s.length < n) s += Utilities.getUuid().replace(/-/g, ''); return s.slice(0, n); }

function gabaritEmail_(titre, contenu, lang) {
  var t = TEXTES[lang] || TEXTES.fr;
  return '<div style="background:#F7F0E6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#2E3A2B">' +
    '<div style="max-width:560px;margin:0 auto;background:#FFFBF4;border-radius:16px;padding:28px 26px;border:1px solid #E4DCCB">' +
    '<p style="margin:0 0 6px;font-family:Georgia,serif;font-size:20px;letter-spacing:.18em;color:#742834">SAFE</p>' +
    '<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:24px;margin:0 0 18px;color:#742834">' + echapper_(titre) + '</h1>' +
    '<div style="font-size:15px;line-height:1.6">' + contenu + '</div>' +
    '<p style="margin:22px 0 0;font-size:12px;color:#4A5546">' + echapper_(t.mention) + '</p>' +
    '<p style="margin:10px 0 0;font-size:13px"><a style="color:#742834" href="' + CONFIG.urlSite + (lang === 'en' ? '/en/' : '/') + '">' +
    CONFIG.urlSite.replace(/^https?:\/\//, '') + '</a></p></div></div>';
}

function lienSite_(lang, params) {
  return CONFIG.urlSite + (lang === 'en' ? '/en/book/' : '/reserver/') + '?' + Object.keys(params).map(function (k) { return k + '=' + params[k]; }).join('&');
}

function tableauRecap_(dem, resa, t) {
  var lieu = dem.format === 'domicile' ? dem.adresse.rue + ', ' + dem.adresse.cp + ' ' + dem.adresse.ville : LIBELLES.enligne[dem.lang];
  var lignes = [[t.quand, libelleDate_(dem.debut, dem.lang)], [t.duree, 'SAFE Yoga · ' + dem.duree + ' min'], [t.lieu, lieu],
    [t.participants, resa.participants.map(function (x) { return x.n + ' (' + libellePart_(x, dem.lang) + ')'; }).join(', ')]];
  if (dem.format === 'domicile') {
    lignes.push([t.tapis, String(dem.tapis)]);
    lignes.push([t.deplacement, dem.montants.dep ? euros_(dem.montants.dep) : t.gratuit]);
  }
  lignes.push([t.total, euros_(dem.montants.total)]);
  if (resa.participants.length > 1) lignes.push([t.votrePart, euros_(dem.montants.parts[0])]);
  return '<table style="border-collapse:collapse;width:100%;margin:10px 0 16px">' + lignes.map(function (l) {
    return '<tr><td style="padding:7px 10px 7px 0;color:#4A5546;vertical-align:top;white-space:nowrap">' + echapper_(l[0]) +
      '</td><td style="padding:7px 0;border-bottom:1px solid #E4DCCB">' + echapper_(l[1]) + '</td></tr>';
  }).join('') + '</table>';
}

function fichierIcs_(dem, resa) {
  var f = function (d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); };
  var txt = function (s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); };
  var lieu = dem.format === 'domicile' ? dem.adresse.rue + ', ' + dem.adresse.cp + ' ' + dem.adresse.ville : (resa.visio || 'Visio');
  var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SAFE//Reservation//FR', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    'UID:' + resa.id + '@safe', 'DTSTAMP:' + f(new Date()), 'DTSTART:' + f(dem.debut), 'DTEND:' + f(dem.fin),
    'SUMMARY:' + txt('SAFE Yoga'), 'LOCATION:' + txt(lieu), 'DESCRIPTION:' + txt(lienSite_(dem.lang, { annulation: resa.id, cle: resa.cle })),
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:SAFE Yoga', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  return Utilities.newBlob(ics, 'text/calendar', 'seance-safe.ics');
}

function notifier_(resa, dem) {
  var c = dem.client, t = TEXTES[dem.lang], p0 = dem.participants[0];
  var quandFr = libelleDate_(dem.debut, 'fr');
  // 1) Enseignante (seul message qui contient les informations de santé)
  var corps = ['Nouvelle réservation sur le site.', '', 'Quand : ' + quandFr + ' (' + dem.duree + ' min)',
    'Format : ' + LIBELLES[dem.format].fr + ' · ' + resa.participants.length + ' pers.',
    'Réservé par : ' + p0.prenom + ' ' + c.nom + ' · ' + c.tel + ' · ' + c.email, '', 'Participants :'];
  resa.participants.forEach(function (x) { corps.push('- ' + x.n + ' (' + LIBELLES.sexe[x.s] + ')' + (x.r ? ', première séance' : '') + ' : ' + libellePart_(x, 'fr')); });
  if (dem.format === 'domicile') {
    var adr = dem.adresse.rue + ', ' + dem.adresse.cp + ' ' + dem.adresse.ville;
    corps.push('', 'Adresse : ' + adr, 'Itinéraire : https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(adr),
      'Déplacement : ' + (dem.montants.dep ? euros_(dem.montants.dep) + ' (' + dem.deplacement.km + ' km aller-retour)' : 'gratuit (Marseille)'),
      'Tapis à apporter : ' + dem.tapis);
  } else {
    corps.push('', 'Visio : ' + (resa.visio || 'lien Meet non créé, à envoyer au client'));
  }
  if (dem.pack) corps.push('Pack : ' + dem.pack.code + ' (' + (dem.pack.restant - 1) + ' séance(s) restante(s))');
  corps.push('Total : ' + euros_(dem.montants.total));
  if (dem.sante) corps.push('', 'Informations de santé (confidentiel, consentement donné) :', dem.sante);
  corps.push('', 'La séance est dans l\'agenda « Réservations ».', resa.lienEvenement);
  envoyer_({ to: CONFIG.emailProprietaire, replyTo: c.email,
    subject: 'Nouvelle réservation : ' + quandFr + ', ' + p0.prenom + ' ' + c.nom + (resa.participants.length > 1 ? ' (' + resa.participants.length + ' pers.)' : ''),
    body: corps.join('\n') });

  // 2) Personne qui réserve
  var charte = CONFIG.urlSite + (dem.lang === 'en' ? '/en/charter/' : '/charte/');
  var html = '<p>' + echapper_(t.bonjour(p0.prenom)) + '</p><p>' + t.intro + '</p>' + tableauRecap_(dem, resa, t);
  if (dem.format === 'enligne') html += resa.visio ? '<p>' + t.visio + ' : <a style="color:#742834" href="' + resa.visio + '">' + resa.visio + '</a></p>' : '<p>' + t.visioPlusTard + '</p>';
  if (resa.participants.some(function (x) { return x.m === 'lien'; })) html += '<p>' + t.liensEnvoyes + '</p>';
  if (resa.participants[0].m === 'virement') html += coordonneesPaiement_(dem.lang, resa.participants[0].a, resa.id);
  html += '<p>' + t.annuler(CONFIG.annulationHeures) + '<br><a style="color:#742834" href="' + lienSite_(dem.lang, { annulation: resa.id, cle: resa.cle }) + '">' + t.lienAnnuler + '</a></p>' +
    '<p><a style="color:#742834" href="' + lienSite_(dem.lang, { reprise: resa.id, cle: resa.cle }) + '">' + t.lienReprendre + '</a><br><span style="font-size:13px;color:#4A5546">' + t.reprendreAide + '</span></p>' +
    '<p style="color:#4A5546;font-size:13px">' + t.ics + '</p><p>' + t.signature + '<br>SAFE</p>';
  envoyer_({ to: c.email, name: CONFIG.nomSite, replyTo: CONFIG.expediteur || CONFIG.emailProprietaire,
    subject: t.sujetConfirmation + ' · ' + libelleDate_(dem.debut, dem.lang), htmlBody: gabaritEmail_(t.titreConfirmation, html, dem.lang),
    attachments: [fichierIcs_(dem, resa)] });

  // 3) Autres participants qui ont donné leur e-mail
  for (var i = 1; i < resa.participants.length; i++) {
    var x = resa.participants[i];
    if (!x.e) continue;
    var h = '<p>' + echapper_(t.bonjour(x.f || x.n)) + '</p><p>' + echapper_(t.corpsInvitation(p0.prenom, libelleDate_(dem.debut, dem.lang), dem.duree)) + '</p>' +
      '<p>' + echapper_(t.votrePart) + ' : <strong>' + euros_(x.a) + '</strong></p>';
    if (x.m === 'lien' && x.a > 0) h += '<p><a style="display:inline-block;background:#742834;color:#FBF3E6;padding:12px 20px;border-radius:999px;text-decoration:none" href="' +
      lienSite_(dem.lang, { payer: resa.id, p: i, cle: x.k }) + '">' + t.payerEnLigne + '</a></p><p>' + t.ouEspeces(CONFIG.preavisHeures) + '</p>';
    else if (x.a > 0) h += '<p>' + t.partEspeces + '</p>';
    h += '<p>' + t.charteRappel + ' <a style="color:#742834" href="' + charte + '">' + charte.replace(/^https?:\/\//, '') + '</a></p>' +
      '<p><a style="color:#742834" href="' + lienSite_(dem.lang, { annulation: resa.id, cle: x.k, p: i }) + '">' + t.seDesinscrire + '</a></p>';
    envoyer_({ to: x.e, name: CONFIG.nomSite, replyTo: CONFIG.expediteur || CONFIG.emailProprietaire, subject: t.sujetInvitation(p0.prenom),
      htmlBody: gabaritEmail_(t.sujetInvitation(p0.prenom), h, dem.lang), attachments: [fichierIcs_(dem, resa)] });
  }
}

// ============================================================
// TÂCHES AUTOMATIQUES
// ============================================================
/** Chaque jour vers 18 h : rappel des séances du lendemain ; les parts non payées en ligne passent en espèces. */
function envoyerRappels() {
  var evs = listerEvenements_(CONFIG.agendaReservations, new Date(Date.now() + 6 * 3600e3), new Date(Date.now() + 30 * 3600e3), 'rappel=non');
  evs.forEach(function (ev) {
    var q = ev.extendedProperties && ev.extendedProperties.private;
    if (!q || q.statut !== 'confirmee') return;
    var lang = q.lang === 'en' ? 'en' : 'fr', t = TEXTES[lang], debut = new Date(Date.parse(ev.start.dateTime));
    var corps = '<p>' + t.corpsRappel_(libelleDate_(debut, lang), ev.location, ev.hangoutLink) + '</p>';
    var aBasculer = [];
    for (var i = 0; i < Number(q.nb); i++) {
      var x = JSON.parse(q['p' + i]);
      if (x.t === 'annule' || x.t === 'rembourse') continue;
      var extra = '';
      if (x.m === 'lien' && x.t === 'a_regler') { x.m = 'especes'; q['p' + i] = JSON.stringify(x); aBasculer.push(x.n); extra = '<p>' + t.rappelLien(euros_(x.a)) + '</p>'; }
      if (x.m === 'virement' && x.t === 'a_regler') extra = coordonneesPaiement_(lang, x.a, q.resaId);
      var dest = i === 0 ? q.email : x.e;
      if (!dest) continue;
      var lien = i === 0 ? lienSite_(lang, { annulation: q.resaId, cle: q.cle }) : lienSite_(lang, { annulation: q.resaId, cle: x.k, p: i });
      envoyer_({ to: dest, name: CONFIG.nomSite, replyTo: CONFIG.expediteur || CONFIG.emailProprietaire, subject: t.sujetRappel,
        htmlBody: gabaritEmail_(t.titreRappel, '<p>' + echapper_(t.bonjour(x.f || x.n)) + '</p>' + corps + extra +
          '<p><a style="color:#742834" href="' + lien + '">' + (i === 0 ? t.lienAnnuler : t.seDesinscrire) + '</a></p>', lang) });
    }
    q.rappel = 'oui';
    var maj = { extendedProperties: { private: q } };
    if (aBasculer.length) maj.description = majDescription_(ev.description, q);
    Calendar.Events.patch(maj, CONFIG.agendaReservations, ev.id, { sendUpdates: 'none' });
  });
}
TEXTES.fr.corpsRappel_ = function (q, lieu, visio) {
  return 'Petit rappel : votre séance SAFE Yoga a lieu ' + q + (lieu ? ', ' + echapper_(lieu) : '') + '.' +
    (visio ? ' Lien de la visio : <a style="color:#742834" href="' + visio + '">' + visio + '</a>' : '');
};
TEXTES.en.corpsRappel_ = function (q, lieu, visio) {
  return 'A quick reminder: your SAFE Yoga session is on ' + q + (lieu ? ', ' + echapper_(lieu) : '') + '.' +
    (visio ? ' Video call link: <a style="color:#742834" href="' + visio + '">' + visio + '</a>' : '');
};

/** Chaque mois : efface les informations de santé des séances passées depuis plus de 12 mois. */
function purgerDonneesSante() {
  var tMax = new Date(Date.now() - CONFIG.dureeConservationSanteJours * 86400e3);
  var tMin = new Date(tMax.getTime() - 3 * 365 * 86400e3);
  listerEvenements_(CONFIG.agendaReservations, tMin, tMax, null).forEach(function (ev) {
    var q = ev.extendedProperties && ev.extendedProperties.private;
    if (!q || !q.sante) return;
    q.sante = '';
    Calendar.Events.patch({ extendedProperties: { private: q } }, CONFIG.agendaReservations, ev.id, { sendUpdates: 'none' });
  });
}

/** À lancer UNE fois à la main après le déploiement. */
function installerDeclencheurs() {
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (['envoyerRappels', 'purgerDonneesSante'].indexOf(tr.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger('envoyerRappels').timeBased().everyDays(1).atHour(18).inTimezone(CONFIG.fuseau).create();
  ScriptApp.newTrigger('purgerDonneesSante').timeBased().onMonthDay(1).atHour(3).inTimezone(CONFIG.fuseau).create();
}

/** Contrôle de la configuration : à lancer à la main, lire le journal d'exécution. */
function verifierConfiguration() {
  [CONFIG.agendaDispos, CONFIG.agendaReservations].forEach(function (id) { Logger.log('Agenda OK : ' + Calendar.Calendars.get(id).summary + ' (' + id + ')'); });
  var props = PropertiesService.getScriptProperties();
  Logger.log('Adresse de départ : ' + (props.getProperty('ADRESSE_DEPART') ? 'renseignée' : 'MANQUANTE (propriété ADRESSE_DEPART), valeur par défaut utilisée'));
  Logger.log('Adresse PayPal (séances en ligne) : ' + (props.getProperty('PAIEMENT_PAYPAL') ? 'renseignée' : 'MANQUANTE (propriété PAIEMENT_PAYPAL)'));
  Logger.log('Code de la page de gestion : ' + ((props.getProperty('ADMIN_CODE') || '').length >= 10 ? 'renseigné' : 'MANQUANT (propriété ADMIN_CODE, 10 caractères au moins)'));
  var aix = deplacement_('Cours Mirabeau, 13100 Aix-en-Provence');
  Logger.log('Test trajet Aix : ' + aix.km + ' km aller-retour, ' + aix.montant + ' € (' + aix.zone + ')');
  var r = creneauxDisponibles_({ format: 'enligne', duree: 60, debut: Utilities.formatDate(new Date(), CONFIG.fuseau, 'yyyy-MM-dd'),
    fin: Utilities.formatDate(new Date(Date.now() + 14 * 86400e3), CONFIG.fuseau, 'yyyy-MM-dd') });
  Logger.log('Jours avec créneaux (14 j, en ligne 60 min) : ' + r.jours.length);
  if (CONFIG.paypal.clientId) { paypalJeton_(); Logger.log('PayPal OK (' + CONFIG.paypal.env + ')'); }
  else Logger.log('PayPal non configuré : seul le paiement en espèces est proposé.');
}

// ============================================================
// OUTILS
// ============================================================
function erreurUtilisateur_(code, message) { var e = new Error(message); e.code = code; e.utilisateur = true; return e; }

function erreur_(err) {
  if (err && err.utilisateur) return { ok: false, code: err.code, message: err.message };
  console.error(err && err.stack ? err.stack : err);
  try {
    var cache = CacheService.getScriptCache();
    if (!cache.get('alerte_envoyee')) {
      cache.put('alerte_envoyee', '1', 1800);
      envoyer_(CONFIG.emailProprietaire, '[SAFE] Erreur du système de réservation', String(err && err.stack ? err.stack : err));
    }
  } catch (e) { /* quota e-mail atteint */ }
  return { ok: false, code: 'serveur', message: 'Une erreur est survenue. Réessayez ou contactez-nous directement.' };
}

// ============================================================
// ENVOI DES E-MAILS
// ============================================================
/**
 * Envoie un e-mail. Aux clients : au nom de CONFIG.expediteur (alias Gmail vérifié) par le service avancé Gmail
 * (droit « gmail.send » seulement). À SAFE, ou si l'envoi par Gmail échoue : MailApp, depuis le compte Google.
 * Accepte la forme objet de MailApp ({to, subject, body, htmlBody, name, replyTo, attachments}) ou (to, sujet, texte).
 */
function envoyer_(a, b, c) {
  var o = typeof a === 'object' ? a : { to: a, subject: b, body: c };
  if (CONFIG.expediteur && o.to !== CONFIG.emailProprietaire && typeof Gmail !== 'undefined') {
    try { Gmail.Users.Messages.send({ raw: Utilities.base64EncodeWebSafe(mime_(o), Utilities.Charset.UTF_8) }, 'me'); return; }
    catch (e) { console.error('Envoi Gmail impossible, repli sur MailApp : ' + e); }
  }
  MailApp.sendEmail(o);
}

function mime_(o) {
  var b64 = function (t) { return Utilities.base64Encode(String(t), Utilities.Charset.UTF_8); };
  var entete = function (t) { return /^[\x20-\x7e]*$/.test(t) ? t : '=?UTF-8?B?' + b64(t) + '?='; };
  var lignes = function (t) { return t.replace(/(.{76})/g, '$1\r\n'); };
  var f1 = 'safe-' + Utilities.getUuid(), f2 = 'safe-' + Utilities.getUuid();
  var m = ['MIME-Version: 1.0',
    'From: ' + entete(o.name || CONFIG.nomSite) + ' <' + CONFIG.expediteur + '>',
    'To: ' + o.to,
    'Subject: ' + entete(o.subject || '')];
  if (o.replyTo) m.push('Reply-To: ' + o.replyTo);
  m.push('Content-Type: multipart/mixed; boundary="' + f1 + '"', '', '--' + f1,
    'Content-Type: multipart/alternative; boundary="' + f2 + '"', '',
    '--' + f2, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '',
    lignes(b64(o.body || String(o.htmlBody || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&'))));
  if (o.htmlBody) m.push('--' + f2, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', lignes(b64(o.htmlBody)));
  m.push('--' + f2 + '--');
  (o.attachments || []).forEach(function (pj) {
    var octets = pj.getBytes ? Utilities.base64Encode(pj.getBytes()) : b64(pj.data);
    var nom = pj.getName ? pj.getName() : pj.name, type = pj.getContentType ? pj.getContentType() : pj.type;
    m.push('--' + f1, 'Content-Type: ' + type + '; name="' + nom + '"', 'Content-Disposition: attachment; filename="' + nom + '"',
      'Content-Transfer-Encoding: base64', '', lignes(octets));
  });
  m.push('--' + f1 + '--', '');
  return m.join('\r\n');
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
