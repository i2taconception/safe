// Contrôles du site SAFE : prix identiques partout, liens internes, règles de rédaction, balises SEO, sitemap.
// Lancer : node outils/tests/coherence.mjs
import fs from 'node:fs'; import path from 'node:path';
const R = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
let erreurs = 0; const ko = (m) => { erreurs++; console.log('ÉCHEC', m); };
const pages = []; (function parcourir(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f);
  if (['.git', 'outils', 'node_modules'].includes(f)) continue;
  if (fs.statSync(p).isDirectory()) parcourir(p); else if (f.endsWith('.html')) pages.push(p); } })(R);

// 1. Prix : CATALOGUE_DEMO (reservation.js) = TARIFS (Code.gs, s'il existe) = cellules data-prix
const js = fs.readFileSync(path.join(R, 'assets/js/reservation.js'), 'utf8');
const demo = Function('return ' + js.match(/var CATALOGUE_DEMO = (\{[\s\S]*?\n  \});/)[1])();
const gs = path.join(R, 'apps-script/Code.gs');
if (fs.existsSync(gs)) {
  const src = fs.readFileSync(gs, 'utf8');
  const cat = Function('return ' + src.match(/var CATALOGUE = (\{[\s\S]*?\n\});/)[1])();
  for (const k of ['durees', 'domicile', 'enligne', 'maxPersonnes', 'maxTapis', 'reductionPremiere', 'tarifKm'])
    if (JSON.stringify(cat[k]) !== JSON.stringify(demo[k])) ko(`CATALOGUE.${k} (Code.gs) différent de CATALOGUE_DEMO`);
}
for (const p of pages) {
  const h = fs.readFileSync(p, 'utf8');
  for (const m of h.matchAll(/data-prix="yoga-(domicile|enligne)-(\d+)-(\d)">([^<]+)</g)) {
    const [, f, d, n, txt] = m; const v = Number(txt.replace(/[^\d]/g, ''));
    const attendu = f === 'enligne' ? demo.enligne[d] : demo.domicile[d][Math.min(+n, 3) - 1];
    if (v !== attendu) ko(`${path.relative(R, p)} : prix ${f} ${d} min ${n} pers. = ${v}, attendu ${attendu}`);
  }
}
// 2. Rédaction : pas de tiret cadratin, pas de termes réglementés, pas de nom de la fondatrice
const interdits = [/—/, /psychologue/i, /psychoth[ée]rap/i, /\bth[ée]rapie/i, /accompagnement psychologique/i, /\bgu[ée]rir\b/i, /\bsoigner\b/i, /ihss?ane/i, /tamenaoul/i];
for (const p of pages.concat([path.join(R, 'assets/js/reservation.js'), path.join(R, 'assets/js/site.js')])) {
  const h = fs.readFileSync(p, 'utf8');
  for (const re of interdits) if (re.test(h)) ko(`${path.relative(R, p)} contient ${re}`);
}
// 3. Liens internes et ressources
for (const p of pages) {
  const h = fs.readFileSync(p, 'utf8');
  for (const m of h.matchAll(/(?:href|src)="([^"#:?]+)(?:[#?][^"]*)?"/g)) {
    let u = m[1]; if (!u || u.startsWith('//')) continue;
    const cible = u.startsWith('/') ? path.join(R, u.slice(1)) : path.resolve(path.dirname(p), u);
    const ok = fs.existsSync(cible) && (fs.statSync(cible).isFile() || fs.existsSync(path.join(cible, 'index.html')));
    if (!ok) ko(`${path.relative(R, p)} : lien cassé ${u}`);
  }
  for (const m of h.matchAll(/srcset="([^"]+)"/g)) for (const part of m[1].split(',')) {
    const u = part.trim().split(/\s+/)[0]; if (!fs.existsSync(path.resolve(path.dirname(p), u))) ko(`${path.relative(R, p)} : image absente ${u}`);
  }
}
// 4. SEO : un seul h1, title, description de 120 à 165 caractères pour les pages indexées
const sitemap = fs.readFileSync(path.join(R, 'sitemap.xml'), 'utf8');
for (const p of pages) {
  const h = fs.readFileSync(p, 'utf8'); const rel = path.relative(R, p);
  if ((h.match(/<h1[\s>]/g) || []).length !== 1) ko(`${rel} : il faut exactement un h1`);
  if (/noindex/.test(h)) continue;
  const d = (h.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  if (d.length < 120 || d.length > 165) ko(`${rel} : description de ${d.length} caractères`);
  const loc = 'https://safewellbeing.fr/' + rel.replace(/index\.html$/, '');
  if (!sitemap.includes('<loc>' + loc + '</loc>')) ko(`${rel} absente du sitemap`);
}
console.log(erreurs ? `${erreurs} problème(s).` : `OK : ${pages.length} pages contrôlées.`);
process.exit(erreurs ? 1 : 0);
