/* SAFE : menu mobile, lotus éclaté au défilement, formulaire de contact. */
(function () {
  'use strict';
  document.documentElement.classList.remove('sans-js');

  // Menu mobile
  var bouton = document.querySelector('.menu-btn');
  var nav = document.getElementById('nav');
  if (bouton && nav) {
    bouton.addEventListener('click', function () {
      var ouvert = nav.classList.toggle('ouvert');
      bouton.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { nav.classList.remove('ouvert'); bouton.setAttribute('aria-expanded', 'false'); }
    });
  }

  // Lotus éclaté : au défilement, la fleur se décompose en trois parties posées côte à côte
  // (01 Yoga : pétales extérieurs, 02 Mind : pétales du milieu, 03 Care : cœur), puis se
  // reforme pour 04 Balance. Le panneau de gauche et la barre de progression suivent.
  var lotus = document.querySelector('.lotus');
  var reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (lotus && !reduit) {
    // [décalage X %, décalage Y %, échelle] à l'état éclaté (en % de la taille de l'image)
    var POSE = { ext: [-33, 5, 0.5], mid: [0, 4, 0.66], int: [33, -2, 0.9], coeur: [33, -2, 0.9] };
    var PHASES = ['intro', 'yoga', 'mind', 'care', 'balance'];
    var BORNES = [0, 0.14, 0.36, 0.57, 0.78, 1];   // début de chaque phase dans la course
    var COUCHE_DE = { yoga: 'ext', mind: 'mid', care: 'int' };
    var imgs = {}, textes = {}, etiq = {}, rail = {};
    lotus.querySelectorAll('[data-couche]').forEach(function (i) { imgs[i.dataset.couche] = i; });
    lotus.querySelectorAll('[data-phase]').forEach(function (t) { textes[t.dataset.phase] = t; });
    lotus.querySelectorAll('[data-pour]').forEach(function (t) { etiq[t.dataset.pour] = t; });
    lotus.querySelectorAll('[data-aller]').forEach(function (b) { rail[b.dataset.aller] = b; });
    var barre = lotus.querySelector('.lotus-rail'), indice = lotus.querySelector('.lotus-indice');
    var phaseActuelle = null, attente = false;
    ['yoga', 'mind', 'care'].forEach(function (k, n) { if (etiq[k]) etiq[k].style.left = (50 + [-33, 0, 33][n]) + '%'; });

    function lisse(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }
    function course() { return Math.max(1, lotus.offsetHeight - window.innerHeight); }
    function progression() { return Math.min(1, Math.max(0, -lotus.getBoundingClientRect().top / course())); }

    function maj() {
      attente = false;
      var p = progression();
      // e : 0 fleur fermée, 1 fleur éclatée
      var e = p < 0.78 ? lisse((p - 0.05) / 0.12) : 1 - lisse((p - 0.78) / 0.1);
      var n = 0; while (n < PHASES.length - 1 && p >= BORNES[n + 1]) n++;
      var phase = PHASES[n], active = COUCHE_DE[phase];
      Object.keys(imgs).forEach(function (k) {
        var img = imgs[k], c = POSE[k];
        if (k === 'feuille') { img.style.opacity = (1 - 0.95 * e).toFixed(3); img.style.transform = 'translateY(' + (6 * e).toFixed(2) + '%) scale(' + (1 - 0.1 * e).toFixed(3) + ')'; return; }
        var focus = active && (k === active || (active === 'int' && k === 'coeur'));
        var s = 1 + (c[2] - 1) * e + (focus ? 0.06 * e : 0);
        img.style.transform = 'translate(' + (c[0] * e).toFixed(2) + '%,' + (c[1] * e).toFixed(2) + '%) scale(' + s.toFixed(3) + ')';
        img.style.opacity = (active && !focus) ? (1 - 0.6 * e).toFixed(3) : 1;
      });
      Object.keys(etiq).forEach(function (k) {
        etiq[k].style.opacity = lisse((e - 0.6) / 0.4).toFixed(3);
        etiq[k].classList.toggle('actif', k === phase);
      });
      // remplissage de la barre : chaque segment se remplit pendant sa phase
      ['yoga', 'mind', 'care', 'balance'].forEach(function (k, m) {
        var debut = BORNES[m + 1], fin = BORNES[m + 2];
        var r = Math.min(1, Math.max(0, (p - debut) / (fin - debut)));
        if (rail[k]) { rail[k].style.setProperty('--remplissage', r.toFixed(3)); rail[k].classList.toggle('actif', k === phase); }
      });
      if (barre) barre.classList.toggle('visible', p > 0.08);
      if (indice) indice.style.opacity = p < 0.06 ? 1 : 0;
      if (phase !== phaseActuelle) {
        Object.keys(textes).forEach(function (k) {
          var on = k === phase;
          textes[k].classList.toggle('actif', on);
          textes[k].setAttribute('aria-hidden', on ? 'false' : 'true');
        });
        phaseActuelle = phase;
      }
    }
    Object.keys(rail).forEach(function (k) {
      rail[k].addEventListener('click', function () {
        var m = PHASES.indexOf(k);
        var cible = (BORNES[m] + BORNES[m + 1]) / 2;
        if (k === 'balance') cible = 0.9;
        window.scrollTo({ top: lotus.offsetTop + cible * course(), behavior: 'smooth' });
      });
    });
    window.addEventListener('scroll', function () { if (!attente) { attente = true; requestAnimationFrame(maj); } }, { passive: true });
    window.addEventListener('resize', maj);
    maj();
  } else if (lotus) {
    lotus.querySelectorAll('[data-phase]').forEach(function (t) { t.classList.add('actif'); t.removeAttribute('aria-hidden'); });
  }
})();
