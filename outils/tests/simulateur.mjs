// Simulateur du backend Apps Script de SAFE pour tester en local, hors Google.
// Charge apps-script/Code.gs dans un bac à sable avec de faux services Google
// (Agenda, e-mail, PayPal...). Utilisé par tests.mjs et par serveur.mjs.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..', '..');
const TZ = 'Europe/Paris';

// Décalage horaire de Paris (en minutes) pour une date donnée
export function decalageParis(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(date).map(x => [x.type, x.value]));
  const local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((local - date.getTime()) / 60000);
}
// "2026-11-20", "09:00" (heure de Paris) -> Date
export function heureParis(jour, hhmm) {
  const approx = new Date(`${jour}T${hhmm}:00Z`);
  return new Date(approx.getTime() - decalageParis(approx) * 60000);
}
export function jourParis(date, plusJours = 0) {
  const d = new Date(date.getTime() + plusJours * 86400e3);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

function formatDate(d, tz, fmt) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(d).map(x => [x.type, x.value]));
  const u = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday];
  return fmt.replace(/'([^']*)'|yyyy|MM|M|dd|d|HH|mm|ss|u/g, (t, lit) => {
    if (lit !== undefined) return lit;
    return { yyyy: p.year, MM: p.month, M: String(+p.month), dd: p.day, d: String(+p.day), HH: p.hour, mm: p.minute, ss: p.second, u: String(u) }[t];
  });
}

export function creerSimulateur({ secret = 'secret-test', clientId = 'client-test' } = {}) {
  const agendas = {};            // id -> [événements]
  const emails = [];
  const cache = new Map();
  const commandesPaypal = {};
  let compteur = 0;
  const ev = id => (agendas[id] ||= []);
  const chevauche = (e, a, b) => Date.parse(e.start.dateTime) < b && Date.parse(e.end.dateTime) > a;

  const Calendar = {
    Events: {
      list(id, o) {
        const a = Date.parse(o.timeMin), b = Date.parse(o.timeMax);
        let items = ev(id).filter(e => e.start.dateTime && chevauche(e, a, b));
        if (o.privateExtendedProperty) {
          const [k, v] = o.privateExtendedProperty.split('=');
          items = items.filter(e => e.extendedProperties?.private?.[k] === v);
        }
        items.sort((x, y) => Date.parse(x.start.dateTime) - Date.parse(y.start.dateTime));
        return { items: structuredClone(items) };
      },
      insert(res, id, o = {}) {
        const e = structuredClone(res);
        e.id = 'ev' + (++compteur);
        e.htmlLink = 'https://calendar.google.com/event?eid=' + e.id;
        if (e.conferenceData && o.conferenceDataVersion === 1) e.hangoutLink = 'https://meet.google.com/abc-defg-' + compteur;
        delete e.conferenceData;
        ev(id).push(e);
        return structuredClone(e);
      },
      patch(res, id, evId) {
        const e = ev(id).find(x => x.id === evId);
        if (!e) throw new Error('événement introuvable');
        Object.assign(e, structuredClone(res));
        return structuredClone(e);
      }
    },
    Freebusy: {
      query(q) {
        const a = Date.parse(q.timeMin), b = Date.parse(q.timeMax);
        const calendars = {};
        for (const { id } of q.items) {
          calendars[id] = { busy: ev(id).filter(e => e.transparency !== 'transparent' && e.status !== 'cancelled' && chevauche(e, a, b))
            .map(e => ({ start: e.start.dateTime, end: e.end.dateTime })) };
        }
        return { calendars };
      }
    },
    Calendars: { get: id => ({ id, summary: 'Agenda ' + id }) }
  };

  const UrlFetchApp = {
    fetch(url, o) {
      const rep = (code, corps) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(corps) });
      if (url.endsWith('/v1/oauth2/token')) {
        const attendu = 'Basic ' + Buffer.from(clientId + ':' + secret).toString('base64');
        return o.headers.Authorization === attendu ? rep(200, { access_token: 'jeton', expires_in: 32400 }) : rep(401, { error: 'invalid_client' });
      }
      let m = url.match(/\/v2\/checkout\/orders$/);
      if (m) {
        const corps = JSON.parse(o.payload);
        const id = 'ORDER' + (++compteur) + 'XYZ';
        commandesPaypal[id] = { montant: corps.purchase_units[0].amount, approuvee: true, capturee: false };
        return rep(201, { id, status: 'CREATED' });
      }
      m = url.match(/\/v2\/checkout\/orders\/([A-Z0-9]+)\/capture$/);
      if (m) {
        const c = commandesPaypal[m[1]];
        if (!c) return rep(404, { name: 'RESOURCE_NOT_FOUND' });
        if (c.refus) return rep(422, { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'INSTRUMENT_DECLINED' }] });
        c.capturee = true;
        return rep(201, { id: m[1], status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'CAP' + m[1], status: 'COMPLETED', amount: c.montant }] } }] });
      }
      m = url.match(/\/v2\/payments\/captures\/([A-Z0-9]+)\/refund$/);
      if (m) return rep(201, { id: 'REF' + m[1], status: 'COMPLETED' });
      return rep(404, {});
    }
  };

  // Faux Google Maps : quelques adresses connues
  const trajets = [];
  const Maps = {
    DirectionFinder: { Mode: { DRIVING: 'driving' } },
    newDirectionFinder() {
      const o = {};
      const f = {
        setOrigin(x) { o.origine = x; return f; }, setDestination(x) { o.dest = x; return f; },
        setMode() { return f; }, setRegion() { return f; },
        getDirections() {
          trajets.push(o.dest);
          const d = o.dest.toLowerCase();
          const leg = (adr, m) => ({ status: 'OK', routes: [{ legs: [{ end_address: adr, distance: { value: m } }] }] });
          if (d.includes('introuvable')) return { status: 'NOT_FOUND', routes: [] };
          if (d.includes('lyon')) return leg('Place Bellecour, 69002 Lyon, France', 315000);
          if (d.includes('aix')) return leg('Cours Mirabeau, 13100 Aix-en-Provence, France', 33000);
          if (d.includes('aubagne')) return leg('Cours Foch, 13400 Aubagne, France', 18200);
          const cp = d.match(/130(0[1-9]|1[0-6])/);
          if (cp) return leg('12 Rue Paradis, ' + cp[0] + ' Marseille, France', 4000);
          return leg('Allauch, 13190 Allauch, France', 12000);
        }
      };
      return f;
    }
  };
  const proprietes = new Map([['PAYPAL_SECRET', secret]]);

  const contexte = {
    console, JSON, Math, Date, Number, String, Object, Array, RegExp, Error, encodeURIComponent, isNaN,
    Calendar, UrlFetchApp, Maps,
    Utilities: {
      formatDate,
      getUuid: () => crypto.randomUUID(),
      base64Encode: s => Buffer.from(s).toString('base64'),
      base64EncodeWebSafe: s => Buffer.from(s).toString('base64url'),
      newBlob: (data, type, name) => ({ data, type, name })
    },
    CacheService: { getScriptCache: () => ({
      get: k => cache.has(k) ? cache.get(k) : null,
      put: (k, v) => cache.set(k, String(v)),
      remove: k => cache.delete(k)
    }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => (proprietes.has(k) ? proprietes.get(k) : null),
      setProperty: (k, v) => proprietes.set(k, String(v))
    }) },
    MailApp: { sendEmail(a, b, c) { emails.push(typeof a === 'object' ? a : { to: a, subject: b, body: c }); } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput(s) { return { contenu: s, setMimeType() { return this; } }; } },
    ScriptApp: { getProjectTriggers: () => [] },
    Logger: { log: console.log }
  };
  vm.createContext(contexte);
  const code = fs.readFileSync(path.join(RACINE, 'apps-script', 'Code.gs'), 'utf8');
  vm.runInContext(code + '\n;globalThis.__CONFIG = CONFIG; globalThis.__CATALOGUE = CATALOGUE;', contexte);
  const CONFIG = contexte.__CONFIG;
  CONFIG.emailProprietaire = 'safe@test.fr';
  CONFIG.agendaDispos = 'dispos';
  CONFIG.agendaReservations = 'resas';
  CONFIG.agendasOccupes = ['perso'];
  CONFIG.paypal.clientId = clientId;
  CONFIG.urlSite = 'http://localhost:8787';

  return {
    contexte, CONFIG, agendas, emails, cache, commandesPaypal, proprietes, trajets,
    get: params => JSON.parse(contexte.doGet({ parameter: params }).contenu),
    post: corps => JSON.parse(contexte.doPost({ postData: { contents: JSON.stringify(corps) } }).contenu),
    ajouter(agenda, titre, jour, h1, h2) {
      ev(agenda).push({ id: 'seed' + (++compteur), summary: titre,
        start: { dateTime: heureParis(jour, h1).toISOString() }, end: { dateTime: heureParis(jour, h2).toISOString() } });
    }
  };
}

// Jeu de disponibilités réaliste sur 3 semaines (lundi-samedi)
export function remplirDemo(sim, depuis = new Date()) {
  for (let i = 0; i < 21; i++) {
    const jour = jourParis(depuis, i);
    const js = new Date(jour + 'T12:00:00Z').getUTCDay();
    if (js === 0) continue;
    if (js === 6) { sim.ajouter('dispos', 'Dispo domicile', jour, '09:00', '13:00'); continue; }
    sim.ajouter('dispos', 'Dispo', jour, '09:00', '12:30');
    sim.ajouter('dispos', 'Dispo en ligne', jour, '17:30', '20:30');
    if (js === 3) sim.ajouter('perso', 'Rendez-vous perso', jour, '10:00', '11:00');
  }
}
