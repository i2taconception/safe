// Serveur local de prévisualisation : node outils/tests/serveur.mjs [--api] [--paypal] [port]
// Sans --api : le site tourne en mode démonstration (comme avant la mise en service).
// Avec --api : /api répond comme le script Google, grâce au simulateur (agendas fictifs).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creerSimulateur, remplirDemo } from './simulateur.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const avecApi = process.argv.includes('--api');
const port = Number(process.argv.find(a => /^\d+$/.test(a)) || 8787);
const sim = creerSimulateur();
remplirDemo(sim);
// Sans --paypal : pas de paiement en ligne (le vrai module PayPal ne peut pas se charger en local).
if (!process.argv.includes('--paypal')) sim.CONFIG.paypal.clientId = '';
sim.proprietes.set('ADMIN_CODE', 'gestion-locale-2026'); // code de la page /gestion/ en local
export { sim };

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain' };

const serveur = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api') {
    const repondre = o => { res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(o)); };
    if (req.method === 'GET') return repondre(sim.get(Object.fromEntries(url.searchParams)));
    let corps = '';
    req.on('data', c => corps += c);
    req.on('end', () => repondre(sim.post(JSON.parse(corps || '{}'))));
    return;
  }
  if (url.pathname === '/__emails') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(sim.emails)); }
  if (avecApi && url.pathname === '/assets/js/config.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    return res.end("window.SITE_CONFIG = { apiReservation: '/api', emailContact: 'contact@safewellbeing.fr' };");
  }
  let fichier = path.join(RACINE, decodeURIComponent(url.pathname));
  if (!fichier.startsWith(RACINE)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(fichier) && fs.statSync(fichier).isDirectory()) fichier = path.join(fichier, 'index.html');
  if (!fs.existsSync(fichier)) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(fs.readFileSync(path.join(RACINE, '404.html'))); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(fichier)] || 'application/octet-stream' });
  fs.createReadStream(fichier).pipe(res);
});
serveur.listen(port, () => console.log(`Aperçu : http://localhost:${port}/ ${avecApi ? '(API simulée)' : '(mode démonstration)'}`));
