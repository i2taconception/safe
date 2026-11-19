// Tests du backend de réservation SAFE : node outils/tests/tests.mjs
import assert from 'node:assert/strict';
import { creerSimulateur, remplirDemo, jourParis } from './simulateur.mjs';

let ok = 0;
const test = (nom, f) => { try { f(); ok++; console.log('  ok  ' + nom); } catch (e) { console.error('ÉCHEC ' + nom + '\n', e); process.exitCode = 1; } };
const debut = jourParis(new Date(), 0), fin = jourParis(new Date(), 20);
function preparer() { const sim = creerSimulateur(); remplirDemo(sim); return sim; }
const creneau = (sim, format, duree, n = 1, k = 0) =>
  sim.get({ action: 'creneaux', format, duree: String(duree), debut, fin }).jours[n].creneaux[k].debut;
const part = (prenom, sexe, x = {}) => ({ prenom, nom: 'Martin', sexe, premiere: false, charte: true, paiement: 'especes', email: '', ...x });
function demande(sim, x = {}) {
  return {
    action: 'reserver', lang: 'fr', format: 'domicile', duree: 60, tapis: 1,
    debut: creneau(sim, x.format || 'domicile', x.duree || 60),
    adresse: { rue: '12 rue Paradis', cp: '13006', ville: 'Marseille' },
    participants: [part('Léa', 'femme')],
    client: { nom: 'Martin', email: 'lea@exemple.fr', tel: '06 12 34 56 78' },
    sante: '', consentSante: false, cgv: true, piege: '', ...x
  };
}

// ---------- Calculs purs ----------
test('prix : grille par personne, tranches 1 / 2 / 3 à 6, en ligne', () => {
  const c = creerSimulateur().contexte;
  assert.equal(c.prixParPersonne('domicile', 45, 1), 25);
  assert.equal(c.prixParPersonne('domicile', 60, 2), 25);
  assert.equal(c.prixParPersonne('domicile', 90, 6), 25);
  assert.equal(c.prixParPersonne('enligne', 60, 1), 25);
  assert.equal(c.prixPack('domicile', 60, 1), 300);
});
test('montants : réduction première séance, déplacement partagé, arrondi pour la personne qui réserve', () => {
  const c = creerSimulateur().contexte;
  const m = c.calculerMontants('domicile', 60, [true, false, false], 20, false);
  assert.equal(m.pp, 20);
  assert.deepEqual([...m.parts], [21.66, 26.67, 26.67]);
  assert.equal(Math.round(m.parts.reduce((a, b) => a + b, 0) * 100) / 100, m.total);
  assert.equal(m.total, 20 * 3 - 5 + 20);
  const p = c.calculerMontants('domicile', 60, [false, false], 10, true);
  assert.deepEqual([...p.parts], [5, 30]);
});
test('déplacement : Marseille gratuit, Aix au km aller-retour, au-delà de 45 km devis', () => {
  const c = creerSimulateur().contexte;
  assert.equal(c.calculerDeplacement('12 Rue Paradis, 13006 Marseille, France', 4000).montant, 0);
  const aix = c.calculerDeplacement('Cours Mirabeau, 13100 Aix-en-Provence, France', 33000);
  assert.equal(aix.zone, 'hors'); assert.equal(aix.km, 66); assert.equal(aix.montant, 20);
  assert.equal(c.calculerDeplacement('69002 Lyon', 315000).zone, 'trop_loin');
  { const r = c.calculerDeplacement('Cours Mirabeau, 13100 Aix-en-Provence', 40150); assert.equal(r.zone, 'hors'); assert.equal(r.montant, 24); }
  assert.equal(c.calculerDeplacement('13100 Aix-en-Provence', 45100).zone, 'trop_loin');
});
test('créneaux : battement autour d\'un événement occupé', () => {
  const c = creerSimulateur().contexte, h = (x, m = 0) => Date.UTC(2030, 0, 7, x, m);
  const r = c.calculerCreneaux([{ debut: h(8), fin: h(13), formats: null }], [{ debut: h(10), fin: h(11) }], { format: 'domicile', duree: 60, pas: 30, battement: 30, debutMin: 0 });
  assert.deepEqual([...r].map(t => (t - h(0)) / 60000), [480, 510, 690, 720]);
});

// ---------- API ----------
test('config et déplacement publics', () => {
  const sim = preparer();
  const c = sim.get({ action: 'config' });
  assert.equal(c.catalogue.domicile[90][2], 25);
  const d = sim.get({ action: 'deplacement', adresse: '10 cours Mirabeau, 13100 Aix' });
  assert.deepEqual([d.zone, d.km, d.montant], ['hors', 66, 20]);
  assert.equal(sim.get({ action: 'deplacement', adresse: 'adresse introuvable' }).code, 'adresse');
  sim.get({ action: 'deplacement', adresse: '10 cours Mirabeau, 13100 Aix' });
  assert.equal(sim.trajets.length, 2, 'trajet mis en cache');
});

test('créneaux : préavis 24 h, samedi domicile seulement', () => {
  const sim = preparer();
  const r = sim.get({ action: 'creneaux', format: 'enligne', duree: '60', debut, fin });
  const tous = r.jours.flatMap(j => j.creneaux);
  assert.ok(tous.length > 10);
  assert.ok(tous.every(c => Date.parse(c.debut) >= Date.now() + 24 * 3600e3));
  assert.equal(r.jours.filter(j => new Date(j.date + 'T12:00:00Z').getUTCDay() === 6).length, 0);
});

test('réservation à 3 à Aix : prix serveur, événement, e-mails, santé hors agenda', () => {
  const sim = preparer();
  const d = demande(sim, {
    adresse: { rue: '10 cours Mirabeau', cp: '13100', ville: 'Aix-en-Provence' }, tapis: 2,
    participants: [part('Léa', 'femme', { premiere: true }), part('Tom', 'homme', { paiement: 'lien', email: 'tom@exemple.fr' }), part('Inès', 'femme')],
    sante: 'Genou droit fragile', consentSante: true, montantAttendu: 20 * 3 - 5 + 20
  });
  sim.CONFIG.paypal.clientId = 'client-test';
  const r = sim.post(d);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.reservation.total, 75);
  const e = sim.agendas.resas[0], q = e.extendedProperties.private;
  assert.match(e.summary, /Yoga · Léa Martin · 3 pers\. \(domicile\)/);
  assert.equal(q.sante, 'Genou droit fragile');
  assert.ok(!e.description.includes('Genou'), 'pas de santé dans l\'agenda partagé');
  assert.match(e.description, /Tom Martin \(H\) : lien de paiement envoyé, 26,67 €/);
  assert.equal(JSON.parse(q.p0).a, 21.66);
  // e-mails : enseignante, personne qui réserve, Tom (Inès n'a pas d'e-mail)
  assert.deepEqual(sim.emails.map(m => m.to), ['safe@test.fr', 'lea@exemple.fr', 'tom@exemple.fr']);
  assert.match(sim.emails[0].body, /Genou droit fragile/);
  assert.match(sim.emails[0].body, /Déplacement : 20 € \(66 km aller-retour\)/);
  assert.match(sim.emails[1].htmlBody, /reprise=/);
  assert.match(sim.emails[2].htmlBody, /payer=/);
  assert.ok(!/—/.test(sim.emails.map(m => (m.body || '') + (m.htmlBody || '')).join('')), 'pas de tiret cadratin');
  assert.ok(!/ihss?ane|tamenaoul/i.test(JSON.stringify(sim.emails)), 'jamais son nom');
  // double réservation refusée
  assert.equal(sim.post({ ...d, tapis: 0, client: { ...d.client, email: 'autre@exemple.fr' }, participants: [part('Zoé', 'femme')], montantAttendu: undefined }).code, 'pris');
});

test('contrôles : zone, charte, sexe, CGV, prix modifié, piège, pack inconnu', () => {
  const sim = preparer();
  const d = demande(sim);
  assert.equal(sim.post({ ...d, adresse: { rue: 'Place Bellecour', cp: '69002', ville: 'Lyon' } }).code, 'zone');
  assert.equal(sim.post({ ...d, participants: [part('Léa', 'femme', { charte: false })] }).code, 'charte');
  assert.equal(sim.post({ ...d, participants: [part('Léa', '')] }).code, 'participants');
  assert.equal(sim.post({ ...d, cgv: false }).code, 'cgv');
  assert.equal(sim.post({ ...d, montantAttendu: 12 }).code, 'montant');
  assert.equal(sim.post({ ...d, piege: 'robot' }).code, 'spam');
  assert.equal(sim.post({ ...d, participants: [part('Léa', 'femme', { paiement: 'pack' })], pack: 'SAFE-AAAAAA' }).code, 'pack');
  sim.CONFIG.paypal.clientId = '';
  assert.equal(sim.post({ ...d, participants: [part('Léa', 'femme'), part('Tom', 'homme', { paiement: 'lien', email: 'tom@x.fr' })] }).code, 'paiement');
  assert.equal(sim.agendas.resas?.length || 0, 0);
});

test('réduction première séance refusée pour un e-mail qui a déjà réservé', () => {
  const sim = preparer();
  assert.equal(sim.post(demande(sim)).ok, true);
  const r = sim.post(demande(sim, { debut: creneau(sim, 'domicile', 60, 3), participants: [part('Léa', 'femme', { premiere: true })] }));
  assert.equal(r.code, 'premiere');
});

test('réduction première séance : vérifiée par prénom, nom et e-mail de chaque participant', () => {
  const sim = preparer();
  const zoe = { nom: 'Durand', email: 'zoe@exemple.fr', tel: '0611223344' };
  assert.equal(sim.post(demande(sim, { participants: [part('Léa', 'femme'), part('Tom', 'homme', { premiere: true, email: 'tom@exemple.fr' })] })).ok, true);
  // e-mail obligatoire pour un participant qui demande la réduction
  assert.equal(sim.post(demande(sim, { debut: creneau(sim, 'domicile', 60, 3), client: zoe, participants: [part('Zoé', 'femme', { nom: 'Durand' }), part('Tom', 'homme', { premiere: true })] })).code, 'participants');
  // même prénom, nom et e-mail (accents et majuscules ignorés) : refusé
  const r = sim.post(demande(sim, { debut: creneau(sim, 'domicile', 60, 3), client: zoe,
    participants: [part('Zoé', 'femme', { premiere: true, nom: 'Durand' }), part('TOM', 'homme', { premiere: true, nom: 'martin', email: 'Tom@Exemple.fr' })] }));
  assert.equal(r.code, 'premiere'); assert.match(r.message, /TOM martin/);
  // homonyme avec une autre adresse e-mail : accepté
  const ok = sim.post(demande(sim, { debut: creneau(sim, 'domicile', 60, 3), client: zoe,
    participants: [part('Zoé', 'femme', { premiere: true, nom: 'Durand' }), part('Tom', 'homme', { premiere: true, email: 'autre.tom@exemple.fr' })] }));
  assert.equal(ok.ok, true);
});

test('battement : en ligne 0, Marseille 30 min, hors Marseille 1 h, le plus grand des deux autour d\'une séance', () => {
  const c = preparer().contexte, h = n => Date.UTC(2026, 0, 5, n);
  const f = [{ debut: h(8), fin: h(14), formats: null }], occ = [{ debut: h(10), fin: h(11) }];
  const debuts = (o, oc) => [...c.calculerCreneaux(f, oc, { duree: 60, pas: 30, debutMin: 0, ...o })].map(t => (t - h(0)) / 3600e3);
  assert.deepEqual(debuts({ format: 'enligne', battement: 0 }, occ), [8, 8.5, 9, 11, 11.5, 12, 12.5, 13]);
  assert.deepEqual(debuts({ format: 'domicile', battement: 30 }, occ), [8, 8.5, 11.5, 12, 12.5, 13]);
  assert.deepEqual(debuts({ format: 'domicile', battement: 60 }, occ), [8, 12, 12.5, 13]);
  // séance déjà réservée hors Marseille (60) : une séance en ligne doit aussi garder 1 h
  assert.deepEqual(debuts({ format: 'enligne', battement: 0 }, [{ debut: h(10), fin: h(11), battement: 60 }]), [8, 12, 12.5, 13]);
  assert.equal(c.battementZone_('enligne', ''), 0); assert.equal(c.battementZone_('domicile', 'marseille'), 30);
  assert.equal(c.battementZone_('domicile', 'hors'), 60); assert.equal(c.battementZone_('domicile', ''), 60);
});

test('participants : nom obligatoire, sexe femme ou homme uniquement', () => {
  const sim = preparer();
  assert.equal(sim.post(demande(sim, { participants: [part('Léa', 'femme', { nom: '' })] })).code, 'participants');
  assert.equal(sim.post(demande(sim, { participants: [part('Léa', 'autre')] })).code, 'participants');
});

test('PayPal : la personne qui réserve paie sa part, capture, puis un participant paie par son lien', () => {
  const sim = preparer();
  const d = demande(sim, { action: 'paypal_creer', participants: [part('Léa', 'femme', { paiement: 'enligne' }), part('Tom', 'homme', { paiement: 'lien', email: 'tom@exemple.fr' })] });
  const cr = sim.post(d);
  assert.equal(cr.ok, true, JSON.stringify(cr));
  assert.equal(sim.commandesPaypal[cr.orderID].montant.value, '25.00');
  const v = sim.post({ action: 'paypal_valider', orderID: cr.orderID });
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.equal(sim.post({ action: 'paypal_valider', orderID: cr.orderID }).ok, false, 'pas de doublon');
  const q = sim.agendas.resas[0].extendedProperties.private;
  assert.equal(JSON.parse(q.p0).t, 'paye');
  const tom = JSON.parse(q.p1);
  const info = sim.get({ action: 'part', id: q.resaId, p: '1', cle: tom.k });
  assert.equal(info.part.montant, 25); assert.equal(info.part.payable, true);
  assert.equal(sim.get({ action: 'part', id: q.resaId, p: '1', cle: 'f'.repeat(32) }).code, 'lien');
  const c2 = sim.post({ action: 'paypal_creer_part', id: q.resaId, p: 1, cle: tom.k });
  const v2 = sim.post({ action: 'paypal_valider_part', orderID: c2.orderID });
  assert.equal(v2.ok, true, JSON.stringify(v2));
  assert.equal(JSON.parse(sim.agendas.resas[0].extendedProperties.private.p1).t, 'paye');
  assert.match(sim.agendas.resas[0].description, /Tom Martin \(H\) : payé en ligne 25 €/);
  assert.equal(sim.post({ action: 'paypal_creer_part', id: q.resaId, p: 1, cle: tom.k }).code, 'part');
});

test('PayPal : créneau pris entre-temps -> pas de capture ; carte refusée -> message', () => {
  const sim = preparer();
  const d = demande(sim, { action: 'paypal_creer', participants: [part('Léa', 'femme', { paiement: 'enligne' })] });
  const cr = sim.post(d);
  sim.post({ ...d, action: 'reserver', client: { ...d.client, email: 'rapide@exemple.fr' }, participants: [part('Zoé', 'femme')] });
  assert.equal(sim.post({ action: 'paypal_valider', orderID: cr.orderID }).code, 'pris');
  assert.equal(sim.commandesPaypal[cr.orderID].capturee, false);
  const d2 = demande(sim, { action: 'paypal_creer', debut: creneau(sim, 'domicile', 60, 4), participants: [part('Léa', 'femme', { paiement: 'enligne' })] });
  const c2 = sim.post(d2);
  sim.commandesPaypal[c2.orderID].refus = true;
  assert.equal(sim.post({ action: 'paypal_valider', orderID: c2.orderID }).code, 'refus_carte');
});

test('pack : achat, code par e-mail, réservation avec le pack, recrédit si annulation à temps', () => {
  const sim = preparer();
  const cr = sim.post({ action: 'paypal_creer_pack', format: 'domicile', duree: 60, taille: 1, client: { nom: 'Léa Martin', email: 'lea@exemple.fr' }, cgv: true, lang: 'fr' });
  assert.equal(sim.commandesPaypal[cr.orderID].montant.value, '300.00');
  const v = sim.post({ action: 'paypal_valider_pack', orderID: cr.orderID });
  assert.equal(v.ok, true, JSON.stringify(v));
  const code = v.pack.code;
  assert.match(code, /^SAFE-[A-Z0-9]{6}$/);
  assert.match(sim.emails.find(m => m.to === 'lea@exemple.fr').htmlBody, new RegExp(code));
  // mauvais format
  const mauvais = sim.post(demande(sim, { duree: 90, debut: creneau(sim, 'domicile', 90), participants: [part('Léa', 'femme', { paiement: 'pack' })], pack: code }));
  assert.equal(mauvais.code, 'pack');
  const r = sim.post(demande(sim, { adresse: { rue: 'Cours Foch', cp: '13400', ville: 'Aubagne' }, participants: [part('Léa', 'femme', { paiement: 'pack' })], pack: code }));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.reservation.part, 11, 'reste le déplacement');
  assert.equal(sim.post({ action: 'pack', code, email: 'lea@exemple.fr' }).pack.restant, 10);
  const q = sim.agendas.resas[0].extendedProperties.private;
  assert.equal(sim.post({ action: 'annuler', id: q.resaId, cle: q.cle }).ok, true);
  assert.equal(sim.post({ action: 'pack', code, email: 'lea@exemple.fr' }).pack.restant, 11);
});

test('annulation par la personne qui réserve : remboursement automatique, créneau libéré, participants prévenus', () => {
  const sim = preparer();
  const d = demande(sim, { action: 'paypal_creer', participants: [part('Léa', 'femme', { paiement: 'enligne' }), part('Tom', 'homme', { paiement: 'lien', email: 'tom@exemple.fr' })] });
  const { reservation } = sim.post({ action: 'paypal_valider', orderID: sim.post(d).orderID });
  const lu = sim.get({ action: 'reservation', id: reservation.id, cle: reservation.cle });
  assert.equal(lu.reservation.annulable, true); assert.equal(lu.reservation.dansLesDelais, true);
  sim.emails.length = 0;
  const a = sim.post({ action: 'annuler', id: reservation.id, cle: reservation.cle });
  assert.equal(a.ok, true); assert.equal(a.rembourse, true);
  assert.match(sim.emails[0].body, /Remboursé automatiquement : 25 € à Léa/);
  assert.equal(JSON.parse(sim.agendas.resas[0].extendedProperties.private.p0).t, 'rembourse');
  assert.deepEqual(sim.emails.map(m => m.to), ['safe@test.fr', 'lea@exemple.fr', 'tom@exemple.fr']);
  assert.match(sim.agendas.resas[0].summary, /^ANNULÉ/);
  const libres = sim.get({ action: 'creneaux', format: 'domicile', duree: '60', debut, fin }).jours.flatMap(j => j.creneaux.map(x => x.debut));
  assert.ok(libres.includes(d.debut));
  assert.equal(sim.post({ action: 'annuler', id: reservation.id, cle: reservation.cle }).dejaAnnulee, true);
});

test('désinscription d\'un participant : il ne paie rien, les autres gardent leur prix', () => {
  const sim = preparer();
  sim.CONFIG.paypal.clientId = 'client-test';
  const r = sim.post(demande(sim, { participants: [part('Léa', 'femme'), part('Tom', 'homme', { paiement: 'lien', email: 'tom@exemple.fr' }), part('Inès', 'femme')] }));
  const q = sim.agendas.resas[0].extendedProperties.private, tom = JSON.parse(q.p1);
  assert.equal(sim.get({ action: 'reservation', id: q.resaId, cle: tom.k, p: '1' }).reservation.participant, true);
  sim.emails.length = 0;
  assert.equal(sim.post({ action: 'annuler', id: q.resaId, cle: tom.k, p: 1 }).ok, true);
  const apres = sim.agendas.resas[0].extendedProperties.private;
  assert.equal(apres.statut, 'confirmee');
  assert.equal(JSON.parse(apres.p1).t, 'annule');
  assert.equal(JSON.parse(apres.p0).a, 20, 'prix de Léa inchangé');
  assert.match(sim.agendas.resas[0].description, /Tom Martin \(H\) : annulé/);
  assert.deepEqual(sim.emails.map(m => m.to), ['safe@test.fr', 'lea@exemple.fr', 'tom@exemple.fr']);
  assert.ok(r.ok);
});

test('réserver à nouveau : données de pré-remplissage avec la seule clé de la personne qui réserve', () => {
  const sim = preparer();
  sim.post(demande(sim, { sante: 'Dos', consentSante: true, participants: [part('Léa', 'femme'), part('Tom', 'homme')] }));
  const q = sim.agendas.resas[0].extendedProperties.private;
  const r = sim.get({ action: 'reprise', id: q.resaId, cle: q.cle });
  assert.equal(r.reprise.client.email, 'lea@exemple.fr');
  assert.equal(r.reprise.participants[1].prenom, 'Tom');
  assert.equal(r.reprise.participants[1].nom, 'Martin');
  assert.equal(r.reprise.sante, 'Dos');
  assert.equal(sim.get({ action: 'reprise', id: q.resaId, cle: JSON.parse(q.p1).k }).code, 'lien');
});

test('rappels de la veille : une seule fois, part non payée en ligne basculée en espèces', () => {
  const sim = preparer();
  sim.CONFIG.paypal.clientId = 'client-test';
  const jour = jourParis(new Date(), 1);
  sim.ajouter('dispos', 'Dispo', jour, '00:00', '23:59');
  const c = sim.get({ action: 'creneaux', format: 'domicile', duree: '60', debut: jour, fin: jourParis(new Date(), 2) })
    .jours.flatMap(j => j.creneaux).find(x => Date.parse(x.debut) < Date.now() + 29 * 3600e3);
  if (!c) { console.log('      (pas de créneau dans la fenêtre de rappel à cette heure, test sauté)'); return; }
  sim.post(demande(sim, { debut: c.debut, participants: [part('Léa', 'femme'), part('Tom', 'homme', { paiement: 'lien', email: 'tom@exemple.fr' })] }));
  sim.emails.length = 0;
  sim.contexte.envoyerRappels();
  assert.deepEqual(sim.emails.map(m => m.to), ['lea@exemple.fr', 'tom@exemple.fr']);
  assert.match(sim.emails[1].htmlBody, /en espèces/);
  assert.equal(JSON.parse(sim.agendas.resas[0].extendedProperties.private.p1).m, 'especes');
  sim.contexte.envoyerRappels();
  assert.equal(sim.emails.length, 2, 'un seul rappel');
});

test('purge des informations de santé après 12 mois', () => {
  const sim = preparer();
  const vieux = new Date(Date.now() - 400 * 86400e3);
  sim.agendas.resas = [{ id: 'old', start: { dateTime: vieux.toISOString() }, end: { dateTime: new Date(vieux.getTime() + 3600e3).toISOString() },
    extendedProperties: { private: { sante: 'Dos', statut: 'confirmee' } } }];
  sim.contexte.purgerDonneesSante();
  assert.equal(sim.agendas.resas[0].extendedProperties.private.sante, '');
});


test('gestion : code obligatoire, blocage après 5 essais faux', () => {
  const sim = preparer();
  assert.equal(sim.post({ action: 'admin_liste', code: 'nimporte' }).code, 'admin');
  sim.proprietes.set('ADMIN_CODE', 'lotus-rose-2026');
  for (let i = 0; i < 5; i++) assert.equal(sim.post({ action: 'admin_liste', code: 'faux' }).code, 'code');
  assert.equal(sim.post({ action: 'admin_liste', code: 'lotus-rose-2026' }).code, 'bloque');
  assert.match(sim.emails.at(-1).subject, /bloquée/);
});

test('gestion : pack payé en espèces, utilisable ensuite pour réserver', () => {
  const sim = preparer();
  sim.proprietes.set('ADMIN_CODE', 'lotus-rose-2026');
  const base = { action: 'admin_pack_especes', code: 'lotus-rose-2026', format: 'domicile', duree: 60, taille: 1, client: { nom: 'Léa Martin', email: 'lea@exemple.fr' }, lang: 'fr' };
  assert.equal(sim.post(base).code, 'recu');
  const r = sim.post({ ...base, recu: true });
  assert.equal(r.ok, true); assert.equal(r.pack.montant, 300);
  assert.ok(sim.emails.some(m => m.to === 'lea@exemple.fr' && /SAFE-/.test(m.htmlBody)));
  assert.match(sim.emails.find(m => m.to === 'safe@test.fr').body, /payé en espèces/);
  const liste = sim.post({ action: 'admin_liste', code: 'lotus-rose-2026' });
  assert.equal(liste.packs[0].paiement, 'especes'); assert.equal(liste.packs[0].restant, 11);
  const resa = sim.post(demande(sim, { participants: [part('Léa', 'femme', { paiement: 'pack' })], pack: r.pack.code }));
  assert.equal(resa.ok, true);
  assert.equal(sim.post({ action: 'admin_liste', code: 'lotus-rose-2026' }).packs[0].restant, 10);
});

test('gestion : séance annulée par SAFE, remboursement total, pack recrédité, tout le monde prévenu', () => {
  const sim = preparer();
  sim.proprietes.set('ADMIN_CODE', 'lotus-rose-2026');
  const d = demande(sim, { action: 'paypal_creer', participants: [part('Léa', 'femme', { paiement: 'enligne' }), part('Tom', 'homme', { paiement: 'lien', email: 'tom@exemple.fr' }), part('Inès', 'femme')] });
  const { reservation } = sim.post({ action: 'paypal_valider', orderID: sim.post(d).orderID });
  const liste = sim.post({ action: 'admin_liste', code: 'lotus-rose-2026' });
  assert.equal(liste.seances.length, 1); assert.equal(liste.seances[0].participants[0].statut, 'paye');
  sim.emails.length = 0;
  const a = sim.post({ action: 'admin_annuler', code: 'lotus-rose-2026', id: reservation.id, message: 'Empêchement, désolée.' });
  assert.equal(a.ok, true); assert.equal(a.rembourses, 1); assert.equal(a.prevenus, 2);
  assert.match(sim.agendas.resas[0].summary, /^ANNULÉ PAR SAFE/);
  const client = sim.emails.find(m => m.to === 'lea@exemple.fr');
  assert.match(client.htmlBody, /Empêchement, désolée\./); assert.match(client.htmlBody, /remboursé en totalité/);
  assert.ok(sim.emails.some(m => m.to === 'tom@exemple.fr'));
  assert.match(sim.emails.find(m => m.to === 'safe@test.fr').body, /Remboursé automatiquement : 20 € à Léa/);
  assert.equal(sim.post({ action: 'admin_annuler', code: 'lotus-rose-2026', id: reservation.id }).dejaAnnulee, true);
  const libres = sim.get({ action: 'creneaux', format: 'domicile', duree: '60', debut, fin }).jours.flatMap(j => j.creneaux.map(x => x.debut));
  assert.ok(libres.includes(d.debut));
});

test('séance en ligne : paiement PayPal avant la séance, adresse dans l\'e-mail, espèces refusées', () => {
  const sim = preparer();
  const base = { format: 'enligne', tapis: 0, adresse: null };
  assert.equal(sim.post(demande(sim, { ...base, participants: [part('Léa', 'femme')] })).code, 'paiement');
  // sans coordonnées renseignées : message d'attente
  const r0 = sim.post(demande(sim, { ...base, participants: [part('Léa', 'femme', { paiement: 'virement' })] }));
  assert.equal(r0.ok, true);
  assert.match(sim.emails.find(m => m.to === 'lea@exemple.fr').htmlBody, /Nous vous envoyons notre adresse PayPal/);
  sim.proprietes.set('PAIEMENT_TITULAIRE', 'SAFE Test'); sim.proprietes.set('PAIEMENT_IBAN', 'FR76 0000 0000 0000');
  sim.proprietes.set('PAIEMENT_BIC', 'TESTFRPP'); sim.proprietes.set('PAIEMENT_PAYPAL', 'paiement@exemple.fr');
  sim.emails.length = 0;
  const r = sim.post(demande(sim, { ...base, debut: creneau(sim, 'enligne', 60, 2), client: { nom: 'Durand', email: 'zoe@exemple.fr', tel: '0611223344' }, participants: [part('Zoé', 'femme', { paiement: 'virement', nom: 'Durand' })] }));
  assert.equal(r.ok, true);
  const mail = sim.emails.find(m => m.to === 'zoe@exemple.fr').htmlBody;
  assert.doesNotMatch(mail, /FR76|SAFE Test/); assert.match(mail, /paiement@exemple\.fr/); assert.match(mail, /25 €/); assert.match(mail, /SAFE-[a-f0-9]{12}/);
  assert.match(sim.emails.find(m => m.to === 'safe@test.fr').body, /PayPal avant la séance 25 €/);
  // annulation à temps : SAFE doit vérifier un éventuel paiement déjà reçu
  const q = sim.agendas.resas.at(-1).extendedProperties.private;
  sim.emails.length = 0;
  assert.equal(sim.post({ action: 'annuler', id: q.resaId, cle: q.cle }).ok, true);
  assert.match(sim.emails.find(m => m.to === 'safe@test.fr').body, /À VÉRIFIER : si Zoé Durand a déjà payé/);
  assert.match(sim.emails.find(m => m.to === 'zoe@exemple.fr').htmlBody, /nous vous remboursons/);
});

test('gestion : disponibilités ajoutées, répétées chaque semaine, retirées (une date ou la suite)', () => {
  const sim = creerSimulateur(); // agenda des dispos vide
  sim.proprietes.set('ADMIN_CODE', 'lotus-rose-2026');
  const C = 'lotus-rose-2026', j = n => jourParis(new Date(), n);
  const libres = (format = 'domicile') => sim.get({ action: 'creneaux', format, duree: '60', debut: j(0), fin: j(40) }).jours;
  assert.equal(libres().length, 0);
  // Contrôles
  assert.equal(sim.post({ action: 'admin_dispo_ajouter', code: C, date: j(3), de: '10:00', a: '10:30', type: 'tous' }).code, 'heure');
  assert.equal(sim.post({ action: 'admin_dispo_ajouter', code: C, date: j(3), de: '10:00', a: '12:00', type: 'autre' }).code, 'type');
  assert.equal(sim.post({ action: 'admin_dispo_ajouter', code: C, date: j(-3), de: '10:00', a: '12:00', type: 'tous' }).code, 'date');
  assert.equal(sim.post({ action: 'admin_dispo_ajouter', code: 'faux', date: j(3), de: '10:00', a: '12:00', type: 'tous' }).code, 'code');
  // Une date seule, en ligne uniquement
  assert.equal(sim.post({ action: 'admin_dispo_ajouter', code: C, date: j(3), de: '18:00', a: '20:00', type: 'enligne' }).ok, true);
  assert.equal(libres('enligne').length, 1); assert.equal(libres('domicile').length, 0);
  // Répétée chaque semaine pendant 4 semaines, domicile
  const r = sim.post({ action: 'admin_dispo_ajouter', code: C, date: j(2), de: '09:00', a: '12:00', type: 'domicile', repeter: true, jusqu: j(23) });
  assert.equal(r.ok, true); assert.equal(r.nb, 4);
  assert.deepEqual(libres('domicile').map(x => x.date), [j(2), j(9), j(16), j(23)]);
  assert.equal(libres('domicile')[0].creneaux[0].heure, '09:00');
  let liste = sim.post({ action: 'admin_liste', code: C }).dispos;
  assert.equal(liste.length, 5);
  const serie = liste.filter(x => x.serie);
  assert.equal(serie.length, 4); assert.equal(serie[0].type, 'domicile'); assert.equal(serie[0].de, '09:00'); assert.equal(serie[0].a, '12:00');
  assert.equal(serie[0].regle.hebdo, true); assert.equal(serie[0].regle.jusqu, j(23));
  // Retirer une seule date de la série
  assert.equal(sim.post({ action: 'admin_dispo_retirer', code: C, id: serie[1].id, portee: 'une' }).ok, true);
  assert.deepEqual(libres('domicile').map(x => x.date), [j(2), j(16), j(23)]);
  // Une séance réservée bloque le retrait de son créneau
  const debutResa = libres('domicile')[1].creneaux[0].debut;
  const resa = sim.post({ action: 'reserver', lang: 'fr', format: 'domicile', duree: 60, tapis: 1, debut: debutResa,
    adresse: { rue: '12 rue Paradis', cp: '13006', ville: 'Marseille' }, participants: [part('Léa', 'femme')],
    client: { nom: 'Martin', email: 'lea@exemple.fr', tel: '06 12 34 56 78' }, sante: '', consentSante: false, cgv: true, piege: '' });
  assert.equal(resa.ok, true);
  liste = sim.post({ action: 'admin_liste', code: C }).dispos.filter(x => x.serie);
  assert.equal(liste.find(x => x.jour === j(16)).reservees, 1);
  assert.equal(sim.post({ action: 'admin_dispo_retirer', code: C, id: liste.find(x => x.jour === j(16)).id, portee: 'une' }).code, 'reservee');
  assert.equal(sim.post({ action: 'admin_dispo_retirer', code: C, id: liste[0].id, portee: 'suivantes' }).code, 'reservee');
  // Cette date et les suivantes, à partir de la dernière : la série s'arrête avant
  assert.equal(sim.post({ action: 'admin_dispo_retirer', code: C, id: liste.find(x => x.jour === j(23)).id, portee: 'suivantes' }).ok, true);
  assert.deepEqual(libres('domicile').map(x => x.date), [j(2), j(16)]); // j(23) retiré, j(16) garde un créneau après la séance
  assert.equal(sim.post({ action: 'admin_liste', code: C }).dispos.filter(x => x.serie).length, 2);
  // Retirer la date seule en ligne
  const seule = sim.post({ action: 'admin_liste', code: C }).dispos.find(x => !x.serie);
  assert.equal(sim.post({ action: 'admin_dispo_retirer', code: C, id: seule.id }).ok, true);
  assert.equal(libres('enligne').length, 0);
});

test('gestion : paiement PayPal reçu enregistré, client prévenu, rappel sans demande de paiement, remboursement à faire si annulation', () => {
  const sim = preparer();
  const C = 'lotus-rose-2026';
  sim.proprietes.set('ADMIN_CODE', C); sim.proprietes.set('PAIEMENT_PAYPAL', 'paiement@exemple.fr');
  const r = sim.post(demande(sim, { format: 'enligne', tapis: 0, adresse: null, participants: [part('Zoé', 'femme', { paiement: 'virement', nom: 'Durand' })],
    client: { nom: 'Durand', email: 'zoe@exemple.fr', tel: '0611223344' } }));
  assert.equal(r.ok, true);
  const id = sim.agendas.resas.at(-1).extendedProperties.private.resaId;
  assert.equal(sim.post({ action: 'admin_paiement_recu', code: 'faux', id, p: 0 }).code, 'code');
  let s = sim.post({ action: 'admin_liste', code: C }).seances[0];
  assert.equal(s.participants[0].mode, 'virement'); assert.equal(s.participants[0].statut, 'a_regler');
  sim.emails.length = 0;
  const p = sim.post({ action: 'admin_paiement_recu', code: C, id, p: 0 });
  assert.equal(p.ok, true); assert.equal(p.prevenu, true);
  const mail = sim.emails.find(m => m.to === 'zoe@exemple.fr');
  assert.match(mail.subject, /Paiement reçu/); assert.match(mail.htmlBody, /25 €/);
  assert.equal(sim.post({ action: 'admin_liste', code: C }).seances[0].participants[0].statut, 'recu');
  assert.match(sim.agendas.resas.at(-1).description, /payé par PayPal 25 €/);
  assert.equal(sim.post({ action: 'admin_paiement_recu', code: C, id, p: 0 }).deja, true);
  // Le rappel de la veille ne redemande pas le paiement
  const ev = sim.agendas.resas.at(-1), dt = Date.now() + 20 * 3600e3;
  ev.start.dateTime = new Date(dt).toISOString(); ev.end.dateTime = new Date(dt + 3600e3).toISOString();
  sim.emails.length = 0; sim.contexte.envoyerRappels();
  const rappel = sim.emails.find(m => m.to === 'zoe@exemple.fr');
  assert.ok(rappel); assert.doesNotMatch(rappel.htmlBody, /paiement@exemple\.fr/);
  // Annulation par SAFE : remboursement à faire à la main
  ev.start.dateTime = new Date(Date.now() + 72 * 3600e3).toISOString(); ev.end.dateTime = new Date(Date.now() + 73 * 3600e3).toISOString();
  sim.emails.length = 0;
  assert.equal(sim.post({ action: 'admin_annuler', code: C, id }).ok, true);
  const safe = sim.emails.find(m => m.to === 'safe@test.fr').body;
  assert.match(safe, /À FAIRE : rembourser 25 € à Zoé Durand dans PayPal/); assert.doesNotMatch(safe, /À VÉRIFIER/);
  assert.match(sim.emails.find(m => m.to === 'zoe@exemple.fr').htmlBody, /remboursé en totalité/);
  // Une séance à domicile en espèces n'a pas de bouton « Paiement reçu »
  const r2 = sim.post(demande(sim));
  const id2 = sim.agendas.resas.at(-1).extendedProperties.private.resaId;
  assert.equal(r2.ok, true); assert.equal(sim.post({ action: 'admin_paiement_recu', code: C, id: id2, p: 0 }).code, 'mode');
});

test('e-mails aux clients envoyés au nom de contact@ (Gmail, alias), notifications à SAFE par MailApp', () => {
  const sim = preparer();
  const bruts = [];
  sim.contexte.Gmail = { Users: { Messages: { send: (m, u) => { assert.equal(u, 'me'); bruts.push(Buffer.from(m.raw, 'base64url').toString('utf8')); } } } };
  const r = sim.post(demande(sim));
  assert.equal(r.ok, true);
  assert.ok(bruts.length >= 1);
  const m = bruts[0];
  assert.match(m, /^From: SAFE <contact@safewellbeing\.fr>/m);
  assert.match(m, /^To: lea@exemple\.fr/m);
  assert.match(m, /^Reply-To: contact@safewellbeing\.fr/m);
  assert.match(m, /^Subject: =\?UTF-8\?B\?/m);
  const html = m.split('Content-Type: text/html; charset=UTF-8')[1].split('\r\n\r\n')[1].split('\r\n--')[0];
  assert.match(Buffer.from(html.replace(/\r\n/g, ''), 'base64').toString('utf8'), /Bonjour Léa/);
  assert.match(m, /filename="seance-safe\.ics"/);
  const ics = m.split('filename="seance-safe.ics"')[1].split('\r\n\r\n')[1].split('\r\n--')[0];
  assert.match(Buffer.from(ics.replace(/\r\n/g, ''), 'base64').toString('utf8'), /BEGIN:VCALENDAR/);
  assert.ok(sim.emails.some(e => e.to === 'safe@test.fr'));
  assert.ok(!sim.emails.some(e => e.to === 'lea@exemple.fr'));
  // Si Gmail refuse : repli sur MailApp, le client reçoit quand même
  sim.contexte.Gmail = { Users: { Messages: { send: () => { throw new Error('quota'); } } } };
  sim.emails.length = 0;
  assert.equal(sim.post(demande(sim, { debut: creneau(sim, 'domicile', 60, 3) })).ok, true);
  assert.ok(sim.emails.some(e => e.to === 'lea@exemple.fr'));
});

console.log(`\n${ok} tests réussis` + (process.exitCode ? ', des échecs ci-dessus' : ''));
