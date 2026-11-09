/* NutriJabón · App */
(function () {
  'use strict';

  var D = window.NJ_DATA;
  var MEALS = D.MEALS;
  var MEAL = {}; MEALS.forEach(function (m) { MEAL[m.id] = m; });
  var RECIPE = {}; D.RECIPES.forEach(function (r) { RECIPE[r.id] = r; });
  var G = D.GROUPS;
  var G_ORDER = Object.keys(G);
  var STORE_KEY = 'nutrijabon:v1';

  var DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  var DAY_ABBR = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  var DAY_LETTER = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  var MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MONTHS_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  /* ---------------- Estado ---------------- */
  // meds: vitaminas y medicamentos (“tomas”). Solo se guardan en el dispositivo, nunca en el código.
  var DEFAULT_SETTINGS = {
    trainDays: [0, 1, 2, 3, 4], times: {}, onboarded: false,
    meds: [{ id: 'vit', name: 'Vitamina', meal: 'pre', when: 'all' }]
  };
  function defaults() { return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        return {
          settings: Object.assign(defaults(), p.settings || {}),
          days: p.days || {},
          shop: p.shop || {},
          prep: p.prep || {}
        };
      }
    } catch (e) { /* almacenamiento no disponible */ }
    return { settings: defaults(), days: {}, shop: {}, prep: {} };
  }
  var S = load();
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* ignorar */ } }

  var ui = {
    tab: 'hoy', date: null, weekOffset: 0, weekDay: wd(today()), guideMode: null, shopOffset: wd(today()) >= 5 ? 1 : 0, shopView: 'list',
    rFilter: 'all', rQuery: '', extras: true, eqQuery: '', open: { ex: true }
  };

  /* ---------------- Fechas ---------------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function keyOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function addDays(d, n) { var r = new Date(d.getTime()); r.setDate(r.getDate() + n); return r; }
  function wd(d) { return (d.getDay() + 6) % 7; } // 0 = lunes
  function mondayOf(d) { return addDays(d, -wd(d)); }
  function viewDate() { return ui.date ? fromKey(ui.date) : today(); }
  function currentKey() { return keyOf(viewDate()); }
  function dayDiff(a, b) { return Math.round((a - b) / 864e5); }
  function longDate(d) { return DAY_NAMES[wd(d)] + ' ' + d.getDate() + ' de ' + MONTHS[d.getMonth()]; }

  /* ---------------- Formato ---------------- */
  var FRAC = [[1 / 6, '⅙'], [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾'], [5 / 6, '⅚']];
  var UNITS = {
    g: ['g', 'g'], pza: ['pieza', 'piezas'], taza: ['taza', 'tazas'], cda: ['cda', 'cdas'], cdita: ['cdita', 'cditas'],
    mitad: ['mitad', 'mitades'], diente: ['diente', 'dientes'], porcion: ['porción', 'porciones']
  };
  function fmtNum(q, u) {
    if (u === 'g') return String(Math.round(q));
    var whole = Math.floor(q + 1e-9), frac = q - whole;
    if (frac < 0.02) return String(whole);
    if (frac > 0.98) return String(whole + 1);
    for (var i = 0; i < FRAC.length; i++) if (Math.abs(frac - FRAC[i][0]) < 0.02) return (whole || '') + FRAC[i][1];
    // Sin fracción exacta: redondea hacia arriba a una medida de cocina (mejor que sobre a que falte)
    var NICE = [[1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾']];
    for (var j = 0; j < NICE.length; j++) if (frac < NICE[j][0]) return (whole || '') + NICE[j][1];
    return String(whole + 1);
  }
  function fmtQU(q, u) { return fmtNum(q, u) + ' ' + UNITS[u][q > 1 + 1e-9 ? 1 : 0]; }
  function lowerFirst(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
  function fmtIng(i) {
    if (i.t) return i.t;
    if (i.q == null) return i.n;
    return fmtQU(i.q, i.u) + ' de ' + lowerFirst(i.n);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function eqText(g, n) { return n + ' ' + (n === 1 ? G[g].one : G[g].many); }
  function eqList(eq) { return G_ORDER.filter(function (g) { return eq[g]; }).map(function (g) { return eqText(g, eq[g]); }); }
  function dot(g) { return '<i class="dot" style="--c:var(--g-' + g + ')"></i>'; }
  function eqChips(eq) {
    return '<div class="eq-chips">' + G_ORDER.filter(function (g) { return eq[g]; }).map(function (g) {
      return '<span class="eq-chip">' + dot(g) + eqText(g, eq[g]) + '</span>';
    }).join('') + '</div>';
  }

  /* ---------------- Íconos (estilo calcomanía setentera) ----------------
   * Ilustrados: formas planas con relleno de color y contorno grueso.
   * Clases de relleno: y amarillo, p rosa, o naranja, g verde, b azul, r rojo, c crema, k tinta;
   * n = sin contorno, mid/thick = contorno más grueso, sc = trazo crema. */
  var ICONS = {
    sun: '<path class="o" d="M20 12A3.2 3.2 0 0 1 17.66 17.66A3.2 3.2 0 0 1 12 20A3.2 3.2 0 0 1 6.34 17.66A3.2 3.2 0 0 1 4 12A3.2 3.2 0 0 1 6.34 6.34A3.2 3.2 0 0 1 12 4A3.2 3.2 0 0 1 17.66 6.34A3.2 3.2 0 0 1 20 12Z"/><circle class="y" cx="12" cy="12" r="4.3"/>',
    calendar: '<rect class="c" x="3" y="5" width="18" height="16" rx="3"/><path class="p" d="M3 10.5V8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v2.5Z"/><path d="M8 2.8v4M16 2.8v4"/><circle class="g n" cx="8" cy="15.6" r="1.6"/><circle class="o n" cx="12" cy="15.6" r="1.6"/><circle class="b n" cx="16" cy="15.6" r="1.6"/>',
    book: '<path d="M8.5 8.2c-1-1.2 1-2.3 0-3.5M12 8.2c-1-1.2 1-2.3 0-3.5M15.5 8.2c-1-1.2 1-2.3 0-3.5"/><path class="g" d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M5.6 15.2h12.8"/>',
    cart: '<path d="M7.5 10a4.5 4.5 0 0 1 9 0"/><path class="o" d="M4 11h16l-1.7 8.6a2 2 0 0 1-2 1.6H7.7a2 2 0 0 1-2-1.6Z"/><rect class="y" x="2.5" y="8.6" width="19" height="3.4" rx="1.7"/><path d="M9.5 14.2v4M12 14.2v4M14.5 14.2v4"/>',
    guide: '<path class="p" d="M12 7C10 5.2 6.5 4.6 2.5 5.2v13.6c4-.6 7.5 0 9.5 1.8Z"/><path class="b" d="M12 7c2-1.8 5.5-2.4 9.5-1.8v13.6c-4-.6-7.5 0-9.5 1.8Z"/>',
    // Ajustes: patita de gato (naranja, con cojincitos rosas) sosteniendo una llave azul.
    // La silueta se arma con círculos: primero contorno (k mid) y encima el relleno (o n).
    paw: '<g transform="rotate(-45 12 12)"><rect class="b" x="3" y="10.4" width="16.5" height="3.2" rx="1.6"/><path class="b" d="M23.49 10.7A4.2 4.2 0 1 0 23.49 13.3H20.6V10.7Z"/></g>' +
      '<circle class="k mid" cx="7.3" cy="17.4" r="3.87"/><circle class="k mid" cx="4.2" cy="14.56" r="1.42"/><circle class="k mid" cx="6.18" cy="13.19" r="1.42"/><circle class="k mid" cx="8.5" cy="13.19" r="1.42"/><circle class="k mid" cx="10.48" cy="14.65" r="1.42"/>' +
      '<circle class="o n" cx="7.3" cy="17.4" r="3.87"/><circle class="o n" cx="4.2" cy="14.56" r="1.42"/><circle class="o n" cx="6.18" cy="13.19" r="1.42"/><circle class="o n" cx="8.5" cy="13.19" r="1.42"/><circle class="o n" cx="10.48" cy="14.65" r="1.42"/>' +
      '<path class="p n" transform="translate(7.3 17.4) scale(.86)" d="M0-.3c-1.5 0-2.6 1.3-2.6 2.3 0 .8.7 1.1 1.4.9.5-.1.8-.3 1.2-.3s.7.2 1.2.3c.7.2 1.4-.1 1.4-.9 0-1-1.1-2.3-2.6-2.3Z"/>' +
      '<circle class="p n" cx="4.3" cy="14.78" r=".82"/><circle class="p n" cx="6.22" cy="13.44" r=".82"/><circle class="p n" cx="8.47" cy="13.44" r=".82"/><circle class="p n" cx="10.39" cy="14.86" r=".82"/>',
    swap: '<path class="p" d="M3 5.2h11V2.6l6.6 4.1-6.6 4.1V8.2H3Z"/><path class="b" d="M21 15.8H10v-2.6l-6.6 4.1 6.6 4.1v-2.6h11Z"/>',
    dumbbell: '<rect class="k" x="7" y="10.8" width="10" height="2.4" rx="1"/><rect class="p" x="1.4" y="9" width="2.6" height="6" rx="1.1"/><rect class="p" x="20" y="9" width="2.6" height="6" rx="1.1"/><rect class="p" x="3.7" y="6.4" width="4" height="11.2" rx="1.8"/><rect class="p" x="16.3" y="6.4" width="4" height="11.2" rx="1.8"/>',
    moon: '<path class="y" d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/><path d="M18.6 2.6v4M16.6 4.6h4"/>',
    clock: '<circle class="o" cx="12" cy="12" r="9.6"/><circle class="c" cx="12" cy="12" r="6.6"/><path d="M12 8.3V12l2.6 1.6"/>',
    search: '<path class="thick" d="M15.6 15.6l5 5"/><circle class="b" cx="10.5" cy="10.5" r="6.6"/><path class="sc" d="M7.5 9.4a3.3 3.3 0 0 1 2.5-2.5"/>',
    share: '<rect class="o" x="4" y="10.2" width="16" height="10.8" rx="2.2"/><path class="y" d="M12 2.6l4.8 5h-2.9v6.8h-3.8V7.6H7.2Z"/>',
    info: '<circle class="b" cx="12" cy="12" r="9.6"/><circle class="c n" cx="12" cy="7.6" r="1.6"/><rect class="c n" x="10.7" y="10.3" width="2.6" height="7.4" rx="1.3"/>',
    alert: '<path class="y" d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path class="mid" d="M12 9.2v4.4"/><circle class="k n" cx="12" cy="17.2" r="1.4"/>',
    ban: '<circle class="r" cx="12" cy="12" r="9.6"/><circle class="c" cx="12" cy="12" r="5.8"/><rect class="r" x="6.2" y="10.6" width="11.6" height="2.8" rx="1" transform="rotate(-45 12 12)"/>',
    leaf: '<path class="g" d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z"/><path d="M2 21c0-3 1.9-5.4 5.1-6C9.5 14.5 12 13 13 12"/>',
    download: '<rect class="b" x="4" y="14" width="16" height="7" rx="2.2"/><path class="g" d="M12 17.6l-5-5.2h3.2V3h3.6v9.4H17Z"/>',
    upload: '<rect class="b" x="4" y="14" width="16" height="7" rx="2.2"/><path class="p" d="M12 2.6l5 5.2h-3.2v9.4h-3.6V7.8H7Z"/>',
    bell: '<circle class="o" cx="12" cy="2.9" r="1.5"/><path class="p" d="M9.5 17.6a2.5 2.5 0 0 0 5 0Z"/><path class="y" d="M12 3.6a6.2 6.2 0 0 0-6.2 6.2v5.2h12.4V9.8A6.2 6.2 0 0 0 12 3.6Z"/><path class="sc" d="M8.6 12.6V10a3.5 3.5 0 0 1 2.1-3.2"/><rect class="o" x="3.4" y="14.6" width="17.2" height="3.2" rx="1.6"/><path d="M1.8 9.4a10 10 0 0 1 2.3-5M22.2 9.4a10 10 0 0 0-2.3-5"/>',
    fork: '<circle class="b" cx="12" cy="12.4" r="6.2"/><circle class="c" cx="12" cy="12.4" r="3.4"/>' +
      '<path d="M1.6 2.8v4.4M3 2.8v4.4M4.4 2.8v4.4M1.6 7.2a1.4 1.4 0 0 0 2.8 0"/><path class="mid" d="M3 8.8v12.4"/>' +
      '<path class="y" d="M20.3 2.8c1.8 1.3 2.3 4.4 2.1 8.2h-2.1Z"/><path class="mid" d="M21.35 11v10.2"/>',
    pot: '<path d="M3.6 13H1.6M20.4 13h2"/><path class="o" d="M4 10.6h16v6.6a3.6 3.6 0 0 1-3.6 3.6H7.6A3.6 3.6 0 0 1 4 17.2Z"/>' +
      '<path class="y" d="M6 8.4a6 4.2 0 0 1 12 0Z"/><rect class="y" x="2.6" y="8.2" width="18.8" height="3" rx="1.5"/><circle class="p" cx="12" cy="3.4" r="1.4"/><path class="sc" d="M7.2 14v3.2"/>',
    pill: '<g transform="rotate(-40 12 12)"><path class="p" d="M12 7.6H6.4a4.4 4.4 0 0 0 0 8.8H12Z"/><path class="y" d="M12 7.6h5.6a4.4 4.4 0 0 1 0 8.8H12Z"/><path class="sc" d="M5.6 10.2h3"/></g><path d="M20.4 3.2v2.6M19.1 4.5h2.6"/>',
    star: '<path class="y" d="M12 2.4l2.7 6.48 7 .57-5.33 4.57L18 20.85l-6-3.65-6 3.65 1.63-6.83-5.33-4.57 7-.57Z"/><circle class="p n" cx="12" cy="12.9" r="2.1"/>',
    clipboard: '<rect class="c" x="4.2" y="3.6" width="15.6" height="18.4" rx="2.6"/><rect class="p n" x="7.6" y="9.4" width="8.8" height="2.4" rx="1.2"/><rect class="g n" x="7.6" y="13.2" width="5.6" height="2.4" rx="1.2"/><rect class="o n" x="7.6" y="17" width="7.4" height="2.4" rx="1.2"/><rect class="b" x="8.2" y="1.8" width="7.6" height="4" rx="1.5"/>',
    cassette: '<rect class="o" x="1.8" y="4.4" width="20.4" height="15.2" rx="2.6"/><rect class="p n" x="3.4" y="6" width="17.2" height="2.4" rx="1"/><rect class="c" x="4.4" y="8.4" width="15.2" height="6.4" rx="3.2"/><circle class="k n" cx="8.4" cy="11.6" r="1.8"/><circle class="k n" cx="15.6" cy="11.6" r="1.8"/><circle class="c n" cx="8.4" cy="11.6" r=".7"/><circle class="c n" cx="15.6" cy="11.6" r=".7"/><path d="M10.6 11.6h2.8"/><path class="y" d="M6.2 19.6l1.5-3.4h8.6l1.5 3.4Z"/>',
    // Glifos: trazos gruesos y redondos que toman el color del texto
    check: '<path d="M20 6 9 17l-5-5"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>'
  };
  var GLYPHS = { check: 1, left: 1, right: 1, down: 1, x: 1 };
  function icon(name, cls) {
    return '<svg class="ic ' + (GLYPHS[name] ? 'glyph' : 'art') + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  /* ---------------- Lógica del plan ---------------- */
  function mealTime(id) { return S.settings.times[id] || MEAL[id].time; }
  function toMin(t) { var p = t.split(':').map(Number); return p[0] * 60 + p[1]; }
  function sortedMeals() {
    return MEALS.slice().sort(function (a, b) { return toMin(mealTime(a.id)) - toMin(mealTime(b.id)); });
  }
  function dayRec(k) { return S.days[k] || {}; }
  function setDay(k, fn) {
    var r = S.days[k] || {};
    fn(r);
    if (r.sw && !Object.keys(r.sw).length) delete r.sw;
    if (r.done && !Object.keys(r.done).length) delete r.done;
    if (r.tk && !Object.keys(r.tk).length) delete r.tk;
    if (r.why && !Object.keys(r.why).length) delete r.why;
    if (r.twhy && !Object.keys(r.twhy).length) delete r.twhy;
    if (r.ck && !Object.keys(r.ck).length) delete r.ck;
    if (Object.keys(r).length) S.days[k] = r; else delete S.days[k];
    save();
  }
  function defaultTraining(k) { return S.settings.trainDays.indexOf(wd(fromKey(k))) !== -1; }
  function isTraining(k) { var r = dayRec(k); return typeof r.ex === 'boolean' ? r.ex : defaultTraining(k); }
  function defaultRecipe(k, mealId) { return D.WEEK[mealId][wd(fromKey(k))]; }
  function recipeId(k, mealId) { var r = dayRec(k); return (r.sw && r.sw[mealId]) || defaultRecipe(k, mealId); }
  function isSkipped(k, m) { return !!m.trainingOnly && !isTraining(k); }
  // Marcas: true = sí cumplí, false = no cumplí, sin valor = sin marcar
  function markOf(k, mealId) { var r = dayRec(k); return r.done ? r.done[mealId] : undefined; }
  function isDone(k, mealId) { return markOf(k, mealId) === true; }
  function isMissed(k, mealId) { return markOf(k, mealId) === false; }
  function medsFor(k, mealId) {
    return (S.settings.meds || []).filter(function (md) { return md.meal === mealId && (md.when === 'all' || isTraining(k)); });
  }
  function medMark(k, id) { var r = dayRec(k); return r.tk ? r.tk[id] : undefined; }
  // Gustos por receta: 1 = me gusta, -1 = no me gusta (en settings.taste)
  function tasteOf(id) { return (S.settings.taste || {})[id] || 0; }
  function tasteNote(id) { var t = tasteOf(id); return t === 1 ? ' · ❤️ te gusta' : t === -1 ? ' · 👎 no te gusta' : ''; }
  function tasteBtns(id) {
    var t = tasteOf(id);
    return '<div class="taste row-gap" role="group" aria-label="¿Te gusta este platillo?">' +
      '<button class="chip-btn taste-btn" aria-pressed="' + (t === 1) + '" data-action="taste" data-id="' + id + '" data-v="1">❤️ Me gusta</button>' +
      '<button class="chip-btn taste-btn" aria-pressed="' + (t === -1) + '" data-action="taste" data-id="' + id + '" data-v="-1">👎 No me gusta</button></div>';
  }
  function setTaste(id, v) {
    S.settings.taste = S.settings.taste || {};
    if (S.settings.taste[id] === v) delete S.settings.taste[id]; else S.settings.taste[id] = v;
    save();
    if (sheet) renderSheet();
    var y = window.scrollY; render(); window.scrollTo(0, y);
    var t = tasteOf(id);
    toast(t === 1 ? 'Guardada en tus favoritas ❤️' : t === -1 ? 'Anotado: no te gusta. Saldrá al final en “Cambiar”' : 'Quitado');
  }
  function tasteList(v) { return D.RECIPES.filter(function (r) { return tasteOf(r.id) === v; }).map(function (r) { return r.name; }); }
  function tastesHtml() { // sección del resumen para la revisión
    var favs = tasteList(1), nos = tasteList(-1);
    if (!favs.length && !nos.length) return '';
    return '<h3 class="sec-title">Tus gustos</h3>' +
      (favs.length ? '<p class="small"><b>❤️ Te gustan:</b> ' + esc(favs.join(', ')) + '.</p>' : '') +
      (nos.length ? '<p class="small"><b>👎 No te gustan:</b> ' + esc(nos.join(', ')) + '.</p>' : '');
  }
  // Tomas del pre-entreno que también van en días de descanso (p. ej. la vitamina)
  function restMeds() { return (S.settings.meds || []).filter(function (md) { return md.meal === 'pre' && md.when === 'all'; }); }
  function restMedsText() {
    var ms = restMeds(); if (!ms.length) return '';
    return ' <b>Sí toma: ' + esc(listText(ms.map(function (md) { return md.name; }))) + '</b>, a las ' + mealTime('pre') + '.';
  }
  // ¿Por qué no se cumplió? Se guarda en why (comidas) y twhy (vitaminas/medicamentos)
  var REASONS = {
    meal: [['fuera', '🍽️', 'Comí fuera'], ['tiempo', '⏰', 'No tuve tiempo'], ['hambre', '😶', 'Sin hambre'],
      ['otra', '🔁', 'Comí otra cosa'], ['olvido', '💭', 'Se me olvidó'], ['otro', '🤷', 'Otro motivo']],
    med: [['olvido', '💭', 'Se me olvidó'], ['acabo', '📦', 'Se me acabó'], ['traia', '👜', 'Fuera de casa'], ['otro', '🤷', 'Otro motivo']]
  };
  var REASON_TEXT = { meal: {}, med: {} };
  ['meal', 'med'].forEach(function (kind) { REASONS[kind].forEach(function (x) { REASON_TEXT[kind][x[0]] = x[2]; }); });
  function whyOf(k, field, id) { var r = dayRec(k); return r[field] ? r[field][id] : undefined; }
  function dayTotals(k) {
    var t = {};
    MEALS.forEach(function (m) {
      if (isSkipped(k, m)) return;
      Object.keys(m.eq).forEach(function (g) { t[g] = (t[g] || 0) + m.eq[g]; });
    });
    return t;
  }
  function findNext(k, meals) {
    var now = new Date(), nm = now.getHours() * 60 + now.getMinutes();
    for (var i = 0; i < meals.length; i++) {
      var m = meals[i];
      if (isSkipped(k, m) || markOf(k, m.id) !== undefined) continue;
      var tm = toMin(mealTime(m.id));
      if (tm >= nm - 90) return { id: m.id, now: tm <= nm };
    }
    return null;
  }
  function planDays(r) {
    var out = [];
    (D.WEEK[r.meal] || []).forEach(function (id, i) { if (id === r.id) out.push(DAY_ABBR[i]); });
    return out.join(', ');
  }

  /* ---------------- Progreso ----------------
   * Cuenta desde el inicio del plan hasta hoy. De hoy solo cuentan las comidas
   * que ya pasaron de hora o que ya marcaste, para no bajar tu porcentaje en la mañana. */
  function nowMin() { var n = new Date(); return n.getHours() * 60 + n.getMinutes(); }
  function isFullDay(k) {
    return MEALS.every(function (m) {
      return (isSkipped(k, m) || isDone(k, m.id)) && medsFor(k, m.id).every(function (md) { return medMark(k, md.id) === true; });
    });
  }
  function tally(o, mk, why) {
    o.due++;
    if (mk === true) o.done++;
    else if (mk === false) {
      o.miss++;
      if (why) { o.why = o.why || {}; o.why[why] = (o.why[why] || 0) + 1; }
    }
  }
  function rangeStats(from, to) {
    var start = fromKey(D.PLAN.assigned), t = today(), tk = keyOf(t), nm = nowMin();
    if (from < start) from = start;
    if (to > t) to = t;
    var st = { from: from, to: to, days: 0, due: 0, done: 0, miss: 0, full: 0, train: 0, meal: {}, meds: {}, swaps: {} };
    MEALS.forEach(function (m) { st.meal[m.id] = { due: 0, done: 0, miss: 0 }; });
    (S.settings.meds || []).forEach(function (md) { st.meds[md.id] = { due: 0, done: 0, miss: 0 }; });
    for (var d = from; d <= to; d = addDays(d, 1)) {
      var k = keyOf(d);
      st.days++;
      if (isTraining(k)) st.train++;
      if (isFullDay(k)) st.full++;
      MEALS.forEach(function (m) {
        var later = k === tk && toMin(mealTime(m.id)) > nm; // de hoy, aún no es hora
        medsFor(k, m.id).forEach(function (md) {
          var mm = medMark(k, md.id);
          if (!(later && mm === undefined)) tally(st.meds[md.id], mm, whyOf(k, 'twhy', md.id));
        });
        if (isSkipped(k, m)) return;
        var mk = markOf(k, m.id), why = whyOf(k, 'why', m.id);
        if (later && mk === undefined) return;
        tally(st.meal[m.id], mk, why); tally(st, mk, why);
      });
      var sw = dayRec(k).sw || {};
      Object.keys(sw).forEach(function (mid) {
        if (RECIPE[sw[mid]] && sw[mid] !== defaultRecipe(k, mid)) st.swaps[sw[mid]] = (st.swaps[sw[mid]] || 0) + 1;
      });
    }
    st.pct = st.due ? Math.round(st.done / st.due * 100) : null;
    return st;
  }
  function streak() { // días completos seguidos; hoy no rompe la racha mientras no termine
    var start = fromKey(D.PLAN.assigned), d = today(), n = 0;
    if (!isFullDay(keyOf(d))) d = addDays(d, -1);
    while (d >= start && isFullDay(keyOf(d))) { n++; d = addDays(d, -1); }
    return n;
  }
  function markSummary(x) { // “36 de 38 cumplidas · 1 no · 1 sin marcar”
    var un = x.due - x.done - x.miss;
    return x.done + ' de ' + x.due + ' cumplidas' + (x.miss ? ' · ' + x.miss + ' no' : '') + (un ? ' · ' + un + ' sin marcar' : '');
  }
  function daysToReview() { return dayDiff(fromKey(D.PLAN.review), today()); }
  function pctText(st) { return st.pct === null ? '—' : st.pct + '%'; }
  function rangeText(a, b) {
    return a.getMonth() === b.getMonth()
      ? (a.getDate() === b.getDate() ? '' : a.getDate() + ' – ') + b.getDate() + ' ' + MONTHS_ABBR[b.getMonth()]
      : a.getDate() + ' ' + MONTHS_ABBR[a.getMonth()] + ' – ' + b.getDate() + ' ' + MONTHS_ABBR[b.getMonth()];
  }
  function statTile(color, big, label) {
    return '<div class="stat" style="--sc:var(--' + color + ')"><b>' + big + '</b><span>' + label + '</span></div>';
  }
  function reviewTile() {
    var n = daysToReview(), rev = shortDate(D.PLAN.review).replace(/ \d{4}$/, '');
    if (n > 1) return statTile('blue', n, 'días para tu revisión (' + rev + ')');
    if (n === 1) return statTile('blue', '1', 'día: tu revisión es mañana');
    if (n === 0) return statTile('blue', '¡Hoy!', 'es tu revisión');
    return statTile('blue', '✓', 'revisión del ' + rev);
  }
  function progressCard(mon) {
    var sun = addDays(mon, 6), start = fromKey(D.PLAN.assigned), t = today();
    var weekTile, st = null;
    if (mon > t) weekTile = statTile('yellow', '—', 'la semana aún no empieza');
    else if (sun < start) weekTile = statTile('yellow', '—', 'antes de tu plan');
    else { st = rangeStats(mon, sun); weekTile = statTile('yellow', pctText(st), 'de las comidas cumplidas ' + weekLabel(ui.weekOffset).toLowerCase()); }
    var s = streak();
    return '<section class="card progress-card"><h3 class="card-title">' + icon('star') + ' Tu progreso</h3>' +
      '<div class="stats">' + weekTile + statTile('pink', s, s === 1 ? 'día completo seguido' : 'días completos seguidos') + reviewTile() + '</div>' +
      (st && st.due ? '<p class="small muted">Hasta hoy: ' + markSummary(st) + '.</p>' : '') +
      '<div class="row-gap">' + (st && sun < t && st.days >= 3 ? '<button class="btn" data-action="open-recap" data-mon="' + keyOf(mon) + '">' + icon('star') + ' Resumen de esa semana</button>' : '') +
      '<button class="btn" data-action="open-report">' + icon('clipboard') + ' Resumen para tu revisión</button></div></section>';
  }

  /* ---------------- Resumen semanal ----------------
   * El lunes (hasta el miércoles) Hoy muestra cómo te fue la semana pasada y un consejo
   * según la razón de “no cumplí” que más se repitió. Cualquier semana pasada se ve desde Semana. */
  var RECAP_TIPS = {
    fuera: ['Lo que más se repitió fue <b>comer fuera</b>. Antes de salir, revisa qué pedir para cubrir tus porciones.', 'out', 'Qué pedir fuera'],
    tiempo: ['Lo que más se repitió fue <b>no tener tiempo</b>. Adelantar el domingo te deja solo armar entre semana.', 'prep', 'Ver prep del domingo'],
    olvido: ['Varias veces <b>se te olvidó</b>. Los avisos del calendario te recuerdan cada comida y tus tomas.', 'avisos', 'Agregar recordatorios'],
    hambre: ['Lo más común fue <b>no tener hambre</b>. Anótalo en tus preguntas para la revisión.', 'report', 'Abrir mi resumen'],
    otra: ['Varias veces <b>comiste otra cosa</b>. Con “Cambiar” eliges otro platillo con las mismas porciones.', null, null]
  };
  function recapData(mon) {
    var st = rangeStats(mon, addDays(mon, 6));
    if (st.days < 3 || !st.due) return null;
    var prev = rangeStats(addDays(mon, -7), addDays(mon, -1));
    var meals = MEALS.filter(function (m) { return st.meal[m.id].due; }).map(function (m) {
      var x = st.meal[m.id]; return { m: m, x: x, p: x.done / x.due };
    });
    var best = meals.slice().sort(function (a, b) { return b.p - a.p; })[0], worst = meals.slice().sort(function (a, b) { return a.p - b.p; })[0];
    var md = { due: 0, done: 0 };
    Object.keys(st.meds).forEach(function (id) { md.due += st.meds[id].due; md.done += st.meds[id].done; });
    var top = whyCounts(st, 'meal')[0] || null, outMeal = null;
    if (top && top[0] === 'fuera') { // la comida donde más pasó
      outMeal = meals.slice().sort(function (a, b) { return ((b.x.why || {}).fuera || 0) - ((a.x.why || {}).fuera || 0); })[0].m.id;
    }
    return {
      st: st, mon: mon, best: best, worst: worst, meds: md, top: top, outMeal: outMeal,
      delta: prev.days >= 3 && prev.pct !== null && st.pct !== null ? st.pct - prev.pct : null,
      unmarked: st.due - st.done - st.miss
    };
  }
  function recapBody(R) {
    var st = R.st, tip = '', btn = '';
    var tiles = statTile('yellow', pctText(st), 'de las comidas cumplidas' + (R.delta === null ? '' : R.delta === 0 ? ' · igual que la anterior' : ' · ' + (R.delta > 0 ? '↑ ' : '↓ ') + Math.abs(R.delta) + ' pts')) +
      statTile('green', st.full + '<small>/' + st.days + '</small>', 'días completos') +
      (R.meds.due ? statTile('pink', Math.round(R.meds.done / R.meds.due * 100) + '%', 'vitaminas y medicamentos') : statTile('pink', st.miss, st.miss === 1 ? 'comida no cumplida' : 'comidas no cumplidas'));
    var lines = [];
    if (R.best && R.best.p > 0) lines.push('<li>⭐ <span>Lo mejor: <b>' + R.best.m.name + '</b> (' + R.best.x.done + ' de ' + R.best.x.due + ')</span></li>');
    if (R.worst && R.worst !== R.best && R.worst.p < 1) lines.push('<li>🧗 <span>Lo que más costó: <b>' + R.worst.m.name + '</b> (' + R.worst.x.done + ' de ' + R.worst.x.due + ')</span></li>');
    if (R.top) lines.push('<li>💬 <span>Razón más común: <b>' + lowerFirst(REASON_TEXT.meal[R.top[0]]) + '</b> (' + R.top[1] + (R.top[1] === 1 ? ' vez' : ' veces') + ')</span></li>');
    var C = checkStats(R.mon, addDays(R.mon, 6));
    if (C.days >= 3) lines.push('<li>🌡️ <span>' + CHECKS.map(function (x) { var a = avg(C.f[x.id]); return x.name + ' <b>' + (a === null ? '—' : a.toFixed(1)) + '</b>'; }).join(' · ') + ' <span class="muted">(de 5, ' + C.days + ' días)</span></span></li>');
    var T = R.top && R.top[1] >= 2 && RECAP_TIPS[R.top[0]];
    if (T) {
      tip = T[0];
      if (T[1] === 'out') btn = '<button class="chip-btn" data-action="open-out" data-meal="' + (R.outMeal || 'com') + '">' + icon('fork', 'ic-sm') + ' ' + T[2] + '</button>';
      else if (T[1] === 'prep') btn = '<button class="chip-btn" data-action="goto-prep">' + icon('pot', 'ic-sm') + ' ' + T[2] + '</button>';
      else if (T[1] === 'avisos') btn = '<button class="chip-btn" data-action="goto-sec" data-sec="avisos">' + icon('bell', 'ic-sm') + ' ' + T[2] + '</button>';
      else if (T[1] === 'report') btn = '<button class="chip-btn" data-action="open-report">' + icon('clipboard', 'ic-sm') + ' ' + T[2] + '</button>';
    } else if (R.unmarked / st.due > 0.3) {
      tip = 'Varias comidas quedaron <b>sin marcar</b> (' + R.unmarked + '). Marca ✓ o ✗ cada una para que tu resumen sea más preciso.';
    } else if (st.pct >= 90) {
      tip = '<b>¡Gran semana!</b> Sigue así.';
    }
    return '<div class="stats">' + tiles + '</div>' + (lines.length ? '<ul class="plain recap-list">' + lines.join('') + '</ul>' : '') +
      (tip ? '<div class="banner leaf">' + icon('leaf') + '<div>' + tip + (btn ? '<div class="banner-actions">' + btn + '</div>' : '') + '</div></div>' : '');
  }
  function recapCard() { // en Hoy, lunes a miércoles, hasta que lo cierres
    var t = today(); if (wd(t) > 2) return '';
    var mon = addDays(mondayOf(t), -7), wk = keyOf(mon);
    if (S.settings.recapSeen === wk) return '';
    var R = recapData(mon); if (!R) return '';
    return '<section class="card recap-card"><div class="recap-head"><h3 class="card-title">' + icon('star') + ' Tu semana pasada</h3>' +
      '<button class="icon-btn sm" data-action="recap-seen" data-wk="' + wk + '" aria-label="Cerrar resumen semanal">' + icon('x') + '</button></div>' +
      '<p class="small muted">' + rangeText(R.st.from, R.st.to) + ' · según lo que marcaste</p>' + recapBody(R) + '</section>';
  }
  function recapSheet(monKey) {
    var mon = fromKey(monKey), R = recapData(mon);
    return '<div class="sheet-head"><span class="sheet-emoji roundel" style="--mc:var(--yellow)">' + icon('star') + '</span>' +
      '<div class="sheet-titles"><div class="eyebrow">Resumen semanal</div><h2 id="sheet-title">' + rangeText(mon, addDays(mon, 6)) + '</h2></div>' +
      '<button class="icon-btn" data-action="close-sheet" aria-label="Cerrar">' + icon('x') + '</button></div>' +
      '<div class="sheet-content">' + (R ? '<p class="small muted">Según lo que marcaste esa semana.</p>' + recapBody(R) : '<p>Esa semana tiene muy pocos días con tu plan para hacer un resumen.</p>') + '</div>';
  }

  /* ---------------- ¿Cómo te sentiste? ----------------
   * Registro diario rápido (1–5) de energía, hambre entre comidas y digestión, más una nota.
   * Se guarda en days[k].ck = { e, h, d, n } y sale en el resumen para la revisión. */
  var CHECKS = [
    { id: 'e', name: 'Energía', q: '¿Cómo estuvo tu energía?', color: 'yellow', emo: ['😴', '🥱', '🙂', '😀', '⚡'], lab: ['Muy baja', 'Baja', 'Normal', 'Buena', 'Mucha'] },
    { id: 'h', name: 'Hambre', q: '¿Cuánta hambre tuviste entre comidas?', color: 'orange', emo: ['😌', '🙂', '😐', '😋', '😫'], lab: ['Nada', 'Poca', 'Normal', 'Bastante', 'Mucha'] },
    { id: 'd', name: 'Digestión', q: '¿Cómo estuvo tu digestión?', color: 'green', emo: ['😣', '😕', '😐', '🙂', '😊'], lab: ['Muy mal', 'Mal', 'Regular', 'Bien', 'Muy bien'] }
  ];
  var CHECK = {}; CHECKS.forEach(function (c) { CHECK[c.id] = c; });
  function ckOf(k) { return dayRec(k).ck || {}; }
  function ckDone(k) { var c = ckOf(k); return CHECKS.every(function (x) { return c[x.id]; }); }
  function checkinCard(k, isToday) {
    var c = ckOf(k), done = ckDone(k);
    return '<section class="card checkin" id="checkin"><div class="recap-head"><h3 class="card-title">' + icon('sun') + (isToday ? ' ¿Cómo te sentiste hoy?' : ' ¿Cómo te sentiste ese día?') + '</h3>' +
      (done ? '<span class="badge primary">Anotado ✓</span>' : '') + '</div>' +
      '<p class="small muted">Toca una carita en cada una. Te ayuda a contarle a tu nutrióloga cómo vas.</p>' +
      CHECKS.map(function (x) {
        var v = c[x.id];
        return '<div class="ck-row" style="--ckc:var(--' + x.color + ')"><div class="ck-q"><b>' + x.name + '</b> <span class="small muted">' + x.q + '</span>' +
          '<span class="ck-val">' + (v ? x.lab[v - 1] : '') + '</span></div>' +
          '<div class="ck-opts" role="radiogroup" aria-label="' + x.name + '">' + x.emo.map(function (e, i) {
            return '<button role="radio" class="ck-opt" aria-checked="' + (v === i + 1) + '" aria-label="' + x.name + ': ' + x.lab[i] + '" title="' + x.lab[i] + '" data-action="ck" data-k="' + k + '" data-f="' + x.id + '" data-v="' + (i + 1) + '">' + e + '</button>';
          }).join('') + '</div></div>';
      }).join('') +
      '<label class="ck-note"><span class="small muted">Algo más (opcional)</span><textarea rows="2" maxlength="300" data-input="ck-note" data-k="' + k + '" placeholder="Ej.: sentí inflamación después de la comida">' + esc(c.n || '') + '</textarea></label></section>';
  }
  function checkinNudge(k) { // de noche, si hoy no lo has llenado
    if (nowMin() < toMin('20:00') || ckDone(k)) return '';
    return '<div class="banner info">' + icon('sun') + '<div><b>¿Cómo te sentiste hoy?</b> Anótalo en 10 segundos. <button class="link-btn" data-action="goto-checkin">Ir abajo</button></div></div>';
  }
  function setCheck(k, f, v) {
    setDay(k, function (r) {
      r.ck = r.ck || {};
      if (r.ck[f] === v) delete r.ck[f]; else r.ck[f] = v;
    });
    var y = window.scrollY; render(); window.scrollTo(0, y);
    if (ckDone(k) && ckOf(k)[f] === v) toast('¡Gracias! Quedó anotado');
  }
  function checkStats(from, to) { // promedios y notas del rango (dentro del plan, hasta hoy)
    var start = fromKey(D.PLAN.assigned), t = today();
    if (from < start) from = start;
    if (to > t) to = t;
    var out = { days: 0, f: {}, train: {}, rest: {}, low: [], notes: [] };
    CHECKS.forEach(function (x) { out.f[x.id] = { s: 0, n: 0 }; out.train[x.id] = { s: 0, n: 0 }; out.rest[x.id] = { s: 0, n: 0 }; });
    for (var d = from; d <= to; d = addDays(d, 1)) {
      var k = keyOf(d), c = ckOf(k), any = false, tr = isTraining(k);
      CHECKS.forEach(function (x) {
        var v = c[x.id]; if (!v) return;
        any = true; out.f[x.id].s += v; out.f[x.id].n++;
        var g = tr ? out.train[x.id] : out.rest[x.id]; g.s += v; g.n++;
      });
      if (c.d && c.d <= 2) out.low.push(k);
      if (c.n) out.notes.push({ k: k, n: c.n });
      if (any) out.days++;
    }
    return out;
  }
  function avg(g) { return g.n ? g.s / g.n : null; }
  function avgText(x, g) { var a = avg(g); return a === null ? '—' : a.toFixed(1).replace('.0', '') + ' de 5 · ' + lowerFirst(x.lab[Math.round(a) - 1]); }
  function checkInsights(C) { // frases cortas con diferencias claras entre días de ejercicio y descanso
    var out = [];
    ['h', 'e'].forEach(function (id) {
      var a = avg(C.train[id]), b = avg(C.rest[id]);
      if (a === null || b === null || C.train[id].n < 2 || C.rest[id].n < 2 || Math.abs(a - b) < 0.5) return;
      out.push(CHECK[id].name + ': ' + a.toFixed(1) + ' en días de ejercicio y ' + b.toFixed(1) + ' en descanso.');
    });
    if (C.low.length) out.push('Digestión baja (mal o muy mal) en ' + C.low.length + (C.low.length === 1 ? ' día: ' : ' días: ') + listText(C.low.map(function (k) { return shortDate(k).replace(/ \d{4}$/, ''); })) + '.');
    return out;
  }

  /* ---------------- Vista: Hoy ---------------- */
  function viewHoy() {
    var d = viewDate(), k = keyOf(d), isToday = k === keyOf(today());
    var diff = dayDiff(d, today());
    var eyebrow = isToday ? 'Hoy' : diff === 1 ? 'Mañana' : diff === -1 ? 'Ayer' : diff > 0 ? 'En ' + diff + ' días' : 'Hace ' + (-diff) + ' días';
    var train = isTraining(k), overridden = typeof dayRec(k).ex === 'boolean';
    var meals = sortedMeals();
    var active = meals.filter(function (m) { return !isSkipped(k, m); });
    var done = active.filter(function (m) { return isDone(k, m.id); }).length;
    var missed = active.filter(function (m) { return isMissed(k, m.id); }).length;
    var pct = active.length ? Math.round(done / active.length * 100) : 0;
    var next = isToday ? findNext(k, meals) : null;
    var pre = RECIPE[recipeId(k, 'pre')];

    var h = '<div class="stack">';
    h += '<section class="day-head">' +
      '<div class="day-nav">' +
      '<button class="icon-btn" data-action="day-shift" data-n="-1" aria-label="Día anterior">' + icon('left') + '</button>' +
      '<div class="day-title"><div class="eyebrow">' + eyebrow + '</div><h2>' + longDate(d) + '</h2></div>' +
      '<button class="icon-btn" data-action="day-shift" data-n="1" aria-label="Día siguiente">' + icon('right') + '</button>' +
      '</div>' +
      (isToday ? '' : '<div class="center"><button class="link-btn" data-action="day-today">Volver a hoy</button></div>') +
      '<div class="day-settings"><select aria-label="Tipo de día" data-input="day-type"><option value="1"' + (train ? ' selected' : '') + '>Día de ejercicio</option><option value="0"' + (!train ? ' selected' : '') + '>Descanso</option></select>' +
      '<p class="hint">' + (overridden
        ? 'Cambiado solo para este día · <button class="link-btn" data-action="reset-ex">usar mis días</button>'
        : '<button class="link-btn" data-action="goto-settings">Editar días</button>') + '</p>' +
      '</div></section>';

    if (next) {
      var featured = meals.find(function (m) { return m.id === next.id; });
      h += '<ul class="meals featured">' + mealItem(k, featured, next) + '</ul>';
    }
    var notes = train
      ? '<div class="banner ok">' + icon('dumbbell') + '<div><b>Día de ejercicio:</b> incluye tu pre-entreno (' + esc(pre.name) + ') antes de entrenar.</div></div>'
      : '<div class="banner warn">' + icon('ban') + '<div><b>Día de descanso: no comas el pre-entreno</b> (' + esc(pre.name) + '). Son 1 fruta, 1 cereal y 1 grasa con proteína menos. Todo lo demás sigue igual.' +
        restMedsText() + '</div></div>';

    var toRev = daysToReview();
    if (isToday && toRev >= 0 && toRev <= 7) {
      h += '<div class="banner info">' + icon('clipboard') + '<div><b>' + (toRev === 0 ? 'Hoy es tu revisión.' : toRev === 1 ? 'Mañana es tu revisión.' : 'Tu revisión es en ' + toRev + ' días.') + '</b> ' +
        '<button class="link-btn" data-action="open-report">Ve tu resumen</button> para llevarlo.</div></div>';
    }

    if (isToday) h += prepBanner() + recapCard() + checkinNudge(k);

    if (isToday && !S.settings.medsSeen) {
      notes += '<div class="banner info">' + icon('pill') + '<div><b>Nuevo:</b> marca ' + icon('check', 'ic-xs') + ' si cumpliste o ' + icon('x', 'ic-xs') +
        ' si no. Además puedes llevar tus vitaminas y medicamentos: tu vitamina ya está con el pre-entreno.<div class="row-gap banner-actions">' +
        '<button class="chip-btn" data-action="goto-sec" data-sec="tomas">' + icon('pill', 'ic-sm') + ' Agregar medicamento</button>' +
        '<button class="chip-btn" data-action="meds-seen">Entendido</button></div></div></div>';
    }

    h += '<div class="progress"><div class="progress-top"><span><b>' + done + '</b> de ' + active.length + ' comidas' + (missed ? ' · ' + missed + ' no' : '') + '</span>' +
      '<span class="muted">' + (isFullDay(k) && done ? '¡Día completo! 🎉' : pct + '%') + '</span></div>' +
      '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="width:' + pct + '%"></span></div></div>';

    h += '<ol class="meals">' + meals.filter(function (m) { return !next || m.id !== next.id; }).map(function (m) { return mealItem(k, m, null); }).join('') + '</ol>';
    h += '<details class="card acc day-notes" data-acc="dayNotes"' + (ui.open.dayNotes ? ' open' : '') + '><summary>Indicaciones del día' + icon('down', 'chev') + '</summary><div class="acc-body">' + notes + '</div></details>';
    if (diff <= 0) h += checkinCard(k, isToday);

    var tm = addDays(d, 1), tmk = keyOf(tm);
    var prep = sortedMeals().filter(function (m) { return !isSkipped(tmk, m); })
      .map(function (m) { return { m: m, r: RECIPE[recipeId(tmk, m.id)] }; })
      .filter(function (x) { return x.r.ahead; });
    if (prep.length) {
      h += '<section class="card"><h3 class="card-title">' + icon('clock') + ' Deja listo para mañana (' + DAY_NAMES[wd(tm)].toLowerCase() + ')</h3><ul class="plain">' +
        prep.map(function (x) {
          return '<li><button class="link-row" data-action="open-recipe" data-id="' + x.r.id + '" data-k="' + tmk + '" data-meal="' + x.m.id + '">' +
            '<span class="roundel sm" style="--mc:var(--m-' + x.m.id + ')">' + x.r.emoji + '</span><span><b>' + x.m.name + ': ' + esc(x.r.name) + '</b><br><span class="small muted">' + x.r.ahead + '</span></span></button></li>';
        }).join('') + '</ul></section>';
    }

    var tot = dayTotals(k);
    h += '<section class="card"><h3 class="card-title">Porciones de este día</h3><div class="eq-grid">' +
      G_ORDER.map(function (g) { return '<div class="eq-cell">' + dot(g) + '<span>' + G[g].name + '</span><b>' + (tot[g] || 0) + '</b></div>'; }).join('') +
      '</div>' + (train ? '' : '<p class="small muted">Sin pre-entreno: 1 fruta, 1 cereal y 1 grasa con proteína menos que en un día de ejercicio.</p>') + '</section>';
    h += '<div class="center"><button class="chip-btn" data-action="share-day" data-k="' + k + '">' + icon('share', 'ic-sm') + ' Compartir el menú de este día</button></div>';

    return h + '</div>';
  }

  function dishArt(r) {
    return '<img class="dish-art" src="art/' + r.id + '.jpg" alt="" loading="lazy">';
  }
  function mealItem(k, m, next) {
    var rid = recipeId(k, m.id), r = RECIPE[rid], t = mealTime(m.id);
    var clock = '<span class="meal-clock">' + t + '</span>';
    var mc = ' style="--mc:var(--m-' + m.id + ')"';
    var meds = medsFor(k, m.id);
    if (isSkipped(k, m)) {
      return '<li class="meal is-skipped"><article class="meal-card"' + mc + '><div class="meal-main">' +
        '<div class="meal-top">' + clock + '<span class="meal-name">' + m.name + '</span><span class="badge warn">No toca hoy</span></div>' +
        '<div class="dish struck"><span class="roundel">' + r.emoji + '</span><span>' + esc(r.name) + '</span></div>' +
        '<p class="small muted">Solo en días de ejercicio. <button class="link-btn" data-action="set-ex" data-v="1">¿Sí hiciste ejercicio?</button></p>' +
        '</div></article>' + medRows(k, m, meds, true) + '</li>';
    }
    var mk = markOf(k, m.id), done = mk === true, missed = mk === false, isNext = next && next.id === m.id;
    var badges = (isNext ? '<span class="badge primary">' + (next.now ? 'Toca ahora' : 'Siguiente') + '</span>' : '') +
      (missed ? '<span class="badge miss">No cumplí</span>' : '') +
      (m.trainingOnly ? '<span class="badge">Antes de entrenar</span>' : '') +
      (rid !== defaultRecipe(k, m.id) ? '<span class="badge">Cambiado</span>' : '') +
      (tasteOf(rid) === 1 ? '<span class="badge">❤️ Favorita</span>' : tasteOf(rid) === -1 ? '<span class="badge">👎 No te gusta</span>' : '') +
      (r.extra ? '<span class="badge">Idea extra</span>' : '');
    var foldKey = 'meal-' + k + '-' + m.id;
    var summary = isNext ? '' : '<details class="timeline-item" data-acc="' + foldKey + '"' + (ui.open[foldKey] ? ' open' : '') + '><summary><time>' + t + '</time><span class="timeline-label"><small>' + m.name + '</small><b>' + esc(r.name) + '</b></span>' +
      (done || missed ? '<span class="timeline-status">' + (done ? 'Sí cumplí' : 'No cumplí') + '</span>' : '') + icon('down', 'chev') + '</summary>';
    return '<li class="meal' + (done ? ' is-done' : '') + (missed ? ' is-missed' : '') + (isNext ? ' is-next' : '') + '">' +
      summary + '<article class="meal-card"' + mc + '><div class="meal-main">' + (isNext ? dishArt(r) : '') +
      '<div class="meal-top">' + clock + '<span class="meal-name">' + m.name + '</span>' + badges + '</div>' +
      '<button class="dish" data-action="open-recipe" data-id="' + r.id + '" data-k="' + k + '" data-meal="' + m.id + '"><span class="roundel">' + r.emoji + '</span><span class="dish-name">' + esc(r.name) + '</span>' + icon('right', 'ic-sm') + '</button>' +
      eqChips(m.eq) +
      '<div class="meal-actions"><button class="chip-btn" data-action="open-recipe" data-id="' + r.id + '" data-k="' + k + '" data-meal="' + m.id + '">' + icon('book', 'ic-sm') + ' Ver receta</button>' +
      '<button class="chip-btn" data-action="open-swap" data-k="' + k + '" data-meal="' + m.id + '">' + icon('swap', 'ic-sm') + ' Cambiar</button></div>' +
      '</div>' + markBtns(mk, m.name, 'data-action="mark" data-k="' + k + '" data-meal="' + m.id + '"', '') +
      (missed ? whyChips('meal', k, m.id, whyOf(k, 'why', m.id)) : '') +
      '</article>' + (isNext ? '' : '</details>') + medRows(k, m, meds, false) + '</li>';
  }
  // Razones rápidas al marcar ✗ (opcional; tocar la elegida la quita)
  function whyChips(kind, k, id, cur) {
    return '<div class="why" role="group" aria-label="¿Por qué no se cumplió?"><span class="why-q">¿Por qué?</span>' +
      REASONS[kind].map(function (x) {
        return '<button class="why-chip" aria-pressed="' + (cur === x[0]) + '" data-action="why" data-kind="' + kind + '" data-k="' + k + '" data-id="' + id + '" data-r="' + x[0] + '">' +
          '<span aria-hidden="true">' + x[1] + '</span> ' + x[2] + '</button>';
      }).join('') +
      (kind === 'meal' && cur === 'fuera' ? '<button class="link-btn why-link" data-action="open-out" data-meal="' + id + '">Qué pedir la próxima vez que comas fuera</button>' : '') +
      '</div>';
  }
  // Botones ✓ / ✗: tocar el que ya está marcado lo desmarca
  function markBtns(mk, label, attrs, cls) {
    return '<div class="mark' + (cls ? ' ' + cls : '') + '" role="group" aria-label="¿Cumpliste? ' + label + '">' +
      '<button class="mark-btn yes" aria-pressed="' + (mk === true) + '" ' + attrs + ' data-v="1" aria-label="Sí cumplí: ' + label + '" title="Sí cumplí">' + icon('check') + '</button>' +
      '<button class="mark-btn no" aria-pressed="' + (mk === false) + '" ' + attrs + ' data-v="0" aria-label="No cumplí: ' + label + '" title="No cumplí">' + icon('x') + '</button></div>';
  }
  function medRows(k, m, meds, skipped) {
    if (!meds.length) return '';
    return '<ul class="plain tomas" style="--mc:var(--m-' + m.id + ')">' + meds.map(function (md) {
      var mm = medMark(k, md.id), name = esc(md.name); // el nombre lo escribe la usuaria: siempre escapado
      return '<li class="toma' + (mm === true ? ' is-done' : mm === false ? ' is-missed' : '') + '">' +
        '<span class="toma-ic">' + icon('pill') + '</span><span class="toma-txt"><b>' + name + '</b><span class="small muted">' +
        (skipped ? 'A las ' + mealTime(m.id) + ', aunque hoy no toca pre-entreno' : 'Con tu ' + m.name.toLowerCase()) +
        (mm === false ? ' · <b class="miss-text">no cumplí</b>' : '') + '</span></span>' +
        markBtns(mm, name, 'data-action="mark-med" data-k="' + k + '" data-id="' + md.id + '"', 'sm') +
        (mm === false ? whyChips('med', k, md.id, whyOf(k, 'twhy', md.id)) : '') + '</li>';
    }).join('') + '</ul>';
  }

  /* ---------------- Vista: Semana ---------------- */
  function weekLabel(off) {
    if (off === 0) return 'Esta semana';
    if (off === 1) return 'Próxima semana';
    if (off === -1) return 'Semana pasada';
    return off > 0 ? 'En ' + off + ' semanas' : 'Hace ' + (-off) + ' semanas';
  }
  function weekNav(kind, mon, off) {
    var sun = addDays(mon, 6);
    var range = mon.getMonth() === sun.getMonth()
      ? mon.getDate() + ' – ' + sun.getDate() + ' de ' + MONTHS[sun.getMonth()]
      : mon.getDate() + ' ' + MONTHS_ABBR[mon.getMonth()] + ' – ' + sun.getDate() + ' ' + MONTHS_ABBR[sun.getMonth()];
    return '<section class="day-head"><div class="day-nav">' +
      '<button class="icon-btn" data-action="' + kind + '-shift" data-n="-1" aria-label="Semana anterior">' + icon('left') + '</button>' +
      '<div class="day-title"><div class="eyebrow">' + weekLabel(off) + '</div><h2>' + range + '</h2></div>' +
      '<button class="icon-btn" data-action="' + kind + '-shift" data-n="1" aria-label="Semana siguiente">' + icon('right') + '</button>' +
      '</div></section>';
  }
  function viewSemana() {
    var mon = addDays(mondayOf(today()), ui.weekOffset * 7), tk = keyOf(today());
    var days = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return addDays(mon, i); });
    var nTrain = days.filter(function (d) { return isTraining(keyOf(d)); }).length;
    var h = '<div class="stack"><h2 class="page-title">Semana</h2>' + weekNav('week', mon, ui.weekOffset) + '<div class="day-picker" role="group" aria-label="Día de la semana">' + days.map(function (d, i) {
      return '<button data-action="week-day" data-v="' + i + '" aria-pressed="' + (ui.weekDay === i) + '">' + DAY_ABBR[i] + '<b>' + d.getDate() + '</b></button>';
    }).join('') + '</div>' + progressCard(mon);
    h += '<p class="hint center">' + nTrain + (nTrain === 1 ? ' día' : ' días') + ' de ejercicio · ' + (7 - nTrain) + ' de descanso. Toca la etiqueta de un día para cambiarlo.</p>' +
      '<div class="center"><button class="chip-btn" data-action="share-week" data-mon="' + keyOf(mon) + '">' + icon('share', 'ic-sm') + ' Compartir el menú de la semana</button></div>';
    h += '<div class="week-selection">' + [days[ui.weekDay]].map(function (d) {
      var k = keyOf(d), train = isTraining(k);
      return '<article class="card day-card' + (k === tk ? ' is-today' : '') + '">' +
        '<header class="day-card-head"><button class="day-link" data-action="goto-day" data-k="' + k + '"><b>' + DAY_NAMES[wd(d)] + '</b> <span class="muted">' + d.getDate() + ' ' + MONTHS_ABBR[d.getMonth()] + '</span>' + (k === tk ? ' <span class="badge primary">Hoy</span>' : '') + '</button>' +
        '<button class="pill ' + (train ? 'pill-train' : 'pill-rest') + '" data-action="toggle-ex" data-k="' + k + '" aria-label="Cambiar a ' + (train ? 'descanso' : 'día de ejercicio') + '">' + icon(train ? 'dumbbell' : 'moon', 'ic-sm') + (train ? 'Ejercicio' : 'Descanso') + '</button></header>' +
        '<ul class="mini-meals">' + sortedMeals().map(function (m) {
          var r = RECIPE[recipeId(k, m.id)], sk = isSkipped(k, m), dn = isDone(k, m.id), ms = isMissed(k, m.id);
          var meds = medsFor(k, m.id), medTitle = meds.map(function (md) { return md.name; }).join(', ');
          return '<li><button style="--mc:var(--m-' + m.id + ')" class="mini' + (sk ? ' is-skipped' : '') + (dn ? ' is-done' : '') + (ms ? ' is-missed' : '') + '" data-action="open-recipe" data-id="' + r.id + '" data-k="' + k + '" data-meal="' + m.id + '"' + (sk ? ' title="No toca: día de descanso"' : '') + '>' +
            '<span class="t">' + mealTime(m.id) + '</span><span class="n"><span class="emoji">' + r.emoji + '</span> ' + esc(r.name) + '</span>' +
            (meds.length ? '<span class="mini-med" title="' + esc(medTitle) + '">' + icon('pill', 'ic-sm') + '<span class="sr-only">' + esc(medTitle) + '</span></span>' : '') +
            (dn ? icon('check', 'ic-sm ok') : ms ? '<span class="mini-miss" title="No cumplí' + (whyOf(k, 'why', m.id) ? ': ' + REASON_TEXT.meal[whyOf(k, 'why', m.id)] : '') + '">' + icon('x', 'ic-sm miss') + '</span>' : '') + '</button></li>';
        }).join('') + '</ul></article>';
    }).join('') + '</div></div>';
    return h;
  }

  /* ---------------- Vista: Recetas ---------------- */
  function viewRecetas() {
    var filters = [['all', 'Todas']].concat(MEALS.map(function (m) { return [m.id, m.name]; })).concat([['fav', '❤️ Favoritas']]);
    return '<div class="stack"><header class="catalog-head"><h2 class="page-title">Recetas</h2></header>' +
      '<label class="search">' + icon('search') + '<input type="search" placeholder="Busca un platillo o ingrediente…" value="' + esc(ui.rQuery) + '" data-input="rq" aria-label="Buscar recetas"></label>' +
      '<div class="chip-row">' + filters.map(function (f) {
        return '<button class="fchip" aria-pressed="' + (ui.rFilter === f[0]) + '" data-action="rfilter" data-v="' + f[0] + '">' + f[1] + '</button>';
      }).join('') + '</div>' +
      '<label class="toggle"><input type="checkbox" data-input="extras"' + (ui.extras ? ' checked' : '') + '> Mostrar ideas extra (mismas porciones de tu plan)</label>' +
      '<div id="recipe-results">' + recipeResults() + '</div></div>';
  }
  function recipeResults() {
    var q = norm(ui.rQuery.trim());
    var list = D.RECIPES.filter(function (r) {
      return (ui.extras || !r.extra || ui.rFilter === 'fav') && (ui.rFilter === 'all' || r.meal === ui.rFilter || (ui.rFilter === 'fav' && tasteOf(r.id) === 1)) &&
        (!q || norm(r.name + ' ' + r.ing.map(function (i) { return i.n + ' ' + (i.t || ''); }).join(' ')).indexOf(q) !== -1);
    });
    if (!list.length) return ui.rFilter === 'fav'
      ? '<p class="empty">Aún no tienes favoritas. Abre una receta y toca ❤️ Me gusta.</p>'
      : '<p class="empty">No encontré recetas con eso. Prueba con otro ingrediente.</p>';
    return MEALS.filter(function (m) { return list.some(function (r) { return r.meal === m.id; }); }).map(function (m) {
      return '<section class="recipe-group"><h3 class="group-title">' + m.name + ' <span class="muted small">· ' + eqList(m.eq).join(' · ') + '</span></h3>' +
        '<div class="recipe-grid">' + list.filter(function (r) { return r.meal === m.id; }).map(function (r) {
          var pd = planDays(r);
          return '<button class="recipe-card" style="--mc:var(--m-' + r.meal + ')" data-action="open-recipe" data-id="' + r.id + '">' + dishArt(r) +
            '<span class="rc-name">' + esc(r.name) + (tasteOf(r.id) === 1 ? ' ❤️' : tasteOf(r.id) === -1 ? ' 👎' : '') + '</span><span class="rc-meta">' + (r.extra ? '<span class="badge">Idea extra</span>' : (pd ? 'En tu plan: ' + pd : '')) + '</span></button>';
        }).join('') + '</div></section>';
    }).join('');
  }

  /* ---------------- Vista: Compras ---------------- */
  function buildShopping(mon) {
    var map = {}, order = [], trainDays = 0;
    for (var i = 0; i < 7; i++) {
      var k = keyOf(addDays(mon, i));
      if (isTraining(k)) trainDays++;
      MEALS.forEach(function (m) {
        if (isSkipped(k, m)) return;
        RECIPE[recipeId(k, m.id)].ing.forEach(function (ing) {
          var it = map[ing.n];
          if (!it) { it = map[ing.n] = { n: ing.n, c: ing.c, units: {}, free: false }; order.push(it); }
          if (ing.q == null) it.free = true;
          else it.units[ing.u] = (it.units[ing.u] || 0) + ing.q;
        });
      });
    }
    order.forEach(function (it) {
      var parts = Object.keys(it.units).map(function (u) { return fmtQU(it.units[u], u); });
      it.qty = parts.length ? parts.join(' + ') + (it.free ? ' + al gusto' : '') : 'al gusto';
    });
    return { items: order, trainDays: trainDays };
  }
  function shopMonday() { return addDays(mondayOf(today()), ui.shopOffset * 7); }
  function shopSwitch() {
    return '<div class="segmented switch" role="tablist" aria-label="Compras o prep">' +
      '<button role="tab" aria-selected="' + (ui.shopView !== 'prep') + '" data-action="shop-view" data-v="list">' + icon('cart') + ' Lista</button>' +
      '<button role="tab" aria-selected="' + (ui.shopView === 'prep') + '" data-action="shop-view" data-v="prep">' + icon('pot') + ' Prep del domingo</button></div>';
  }
  function viewCompras() {
    var mon = shopMonday(), wk = keyOf(mon);
    if (ui.shopView === 'prep') return viewPrep(mon);
    var res = buildShopping(mon), checked = S.shop[wk] || {};
    var home = res.items.filter(function (i) { return isPantry(i.n); }), items = res.items.filter(function (i) { return !isPantry(i.n); });
    var nChecked = items.filter(function (i) { return checked[i.n]; }).length;
    var h = '<div class="stack"><h2 class="page-title">Compras</h2>' + weekNav('shop', mon, ui.shopOffset) + shopSwitch();
    h += '<div class="banner ok">' + icon('info') + '<div>Calculada con el menú de esa semana (incluye tus cambios de platillo): ' +
      res.trainDays + (res.trainDays === 1 ? ' día' : ' días') + ' con pre-entreno y ' + (7 - res.trainDays) + ' de descanso.</div></div>';
    h += '<progress class="shop-meter" aria-label="Avance de compras" max="' + Math.max(1, items.length) + '" value="' + nChecked + '"></progress><div class="shop-tools"><span class="muted small" id="shop-count">' + nChecked + ' de ' + items.length + ' listos</span>' +
      '<div class="row-gap"><button class="chip-btn" data-action="shop-share">' + icon('share', 'ic-sm') + ' Compartir</button>' +
      '<button class="chip-btn" data-action="shop-clear">Desmarcar todo</button></div></div>';
    if (!Object.keys(S.settings.pantry || {}).length) {
      h += '<p class="small muted center">Toca 🏠 en lo que siempre tienes en casa (sal, aceite, especias) y dejará de aparecer en la lista.</p>';
    }
    D.SHOP_CATS.forEach(function (cat) {
      var list = items.filter(function (i) { return i.c === cat.id; }).sort(function (a, b) { return a.n.localeCompare(b.n, 'es'); });
      if (!list.length) return;
      var group = 'shop-' + cat.id;
      var expanded = ui.open[group] === undefined ? cat === D.SHOP_CATS[0] : ui.open[group];
      h += '<details class="card acc" data-acc="' + group + '"' + (expanded ? ' open' : '') + '><summary><span>' + cat.emoji + ' ' + cat.name + '</span>' + icon('down', 'chev') + '</summary><ul class="shop-list">'  +
        list.map(function (i) {
          var c = !!checked[i.n];
          return '<li class="shop-li"><label class="shop-item' + (c ? ' is-checked' : '') + '"><input type="checkbox" data-input="shop" data-wk="' + wk + '" data-n="' + esc(i.n) + '"' + (c ? ' checked' : '') + '>' +
            '<span class="si-name">' + esc(i.n) + '</span><span class="si-qty">' + esc(i.qty) + '</span></label>' +
            '<button class="pantry-btn" data-action="pantry" data-n="' + esc(i.n) + '" aria-label="Siempre tengo en casa: ' + esc(i.n) + '" title="Siempre tengo en casa">🏠</button></li>';
        }).join('') + '</ul></details>';
    });
    if (home.length) {
      h += '<details class="card pantry-card"><summary><span class="emoji">🏠</span> Siempre en casa (' + home.length + ')' + icon('down', 'chev') + '</summary>' +
        '<p class="small muted">No aparecen en la lista ni cuando la compartes. Toca “Ya no” si se te acaba algo.</p><ul class="plain pantry-list">' +
        home.sort(function (a, b) { return a.n.localeCompare(b.n, 'es'); }).map(function (i) {
          return '<li><span class="si-name">' + esc(i.n) + '</span><span class="si-qty">' + esc(i.qty) + '</span>' +
            '<button class="chip-btn" data-action="pantry" data-n="' + esc(i.n) + '">Ya no</button></li>';
        }).join('') + '</ul></details>';
    }
    return h + '</div>';
  }
  // Lo que siempre tienes en casa no sale en la lista (settings.pantry, por nombre de ingrediente)
  function isPantry(n) { return !!(S.settings.pantry || {})[n]; }
  function togglePantry(n) {
    S.settings.pantry = S.settings.pantry || {};
    if (S.settings.pantry[n]) delete S.settings.pantry[n]; else S.settings.pantry[n] = true;
    save();
    var y = window.scrollY; render(); window.scrollTo(0, y);
    toast(isPantry(n) ? n + ': siempre en casa 🏠' : n + ' vuelve a la lista');
  }
  /* ---------------- Prep del domingo ----------------
   * Tareas armadas con el menú real de la semana (cambios de platillo y días de descanso incluidos):
   * sábado en la noche (remojar), domingo (cocinar, picar, snacks y marinar lun–mié)
   * y miércoles en la noche (marinar jue–dom). Las reglas están en D.PREP. */
  var DAY_SHORT = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
  var PREP_SECS = [
    ['sat', '🌙', 'Sábado en la noche: remoja'],
    ['cook', '🍲', 'Domingo: cocina en tanda'],
    ['chop', '🔪', 'Domingo: lava y pica'],
    ['snack', '🥜', 'Domingo: deja listos tus snacks'],
    ['mar', '🫙', 'Domingo: marina para lunes a miércoles'],
    ['wed', '🌙', 'Miércoles en la noche: marina para jueves a domingo']
  ];
  function listText(a, conj) { return a.length > 1 ? a.slice(0, -1).join(', ') + ' ' + (conj || 'y') + ' ' + a[a.length - 1] : a[0] || ''; }
  function daysText(days) { return listText(days.slice().sort().map(function (i) { return DAY_SHORT[i]; })); }
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
  function weekUses(mon, base) { // base = menú de tu plan con tus días de ejercicio (sin cambios sueltos)
    var uses = [];
    for (var i = 0; i < 7; i++) {
      var k = keyOf(addDays(mon, i)), train = base ? S.settings.trainDays.indexOf(i) !== -1 : isTraining(k);
      MEALS.forEach(function (m) {
        if (m.trainingOnly && !train) return;
        uses.push({ i: i, m: m, r: RECIPE[base ? D.WEEK[m.id][i] : recipeId(k, m.id)] });
      });
    }
    return uses;
  }
  function unitsText(units) { return Object.keys(units).map(function (u) { return fmtQU(units[u], u); }).join(' + '); }
  function buildPrep(mon, base) {
    var P = D.PREP, uses = weekUses(mon, base), agg = {}, covered = {}, tasks = [];
    uses.forEach(function (u) {
      u.r.ing.forEach(function (ing) {
        var a = agg[ing.n] || (agg[ing.n] = { units: {}, free: false, days: [], uses: [] });
        if (a.days.indexOf(u.i) === -1) a.days.push(u.i);
        if (ing.q == null) a.free = true; else a.units[ing.u] = (a.units[ing.u] || 0) + ing.q;
        a.uses.push({ q: ing.q, u: ing.u, i: u.i, rid: u.r.id });
      });
    });
    function add(sec, id, title, meta, how, extra) {
      tasks.push(Object.assign({ sec: sec, id: sec + ':' + id, title: title, plain: lowerFirst(title), meta: meta, how: how }, extra || {}));
    }
    P.soak.forEach(function (s) {
      var a = agg[s.n]; if (!a) return;
      add('sat', s.n, s.name, 'Para ' + daysText(a.days), 'En un recipiente con agua, 12 horas; mañana se cuecen.');
    });
    P.cook.forEach(function (c) {
      var a = agg[c.n]; if (!a || !Object.keys(a.units).length) return;
      var t = a.units.taza, meta = unitsText(a.units) + (t ? (t > 1 + 1e-9 ? ' cocidas' : ' cocida') : '');
      if (c.dry && t && t * c.dry >= .3) meta += ' (≈ ' + fmtQU(t * c.dry, 'taza') + ' en seco)';
      if (c.dryG && t) meta += ' (≈ ' + Math.round(t * c.dryG / 10) * 10 + ' g en seco)';
      add('cook', c.n, c.name, meta + ' · ' + daysText(a.days), c.how);
    });
    P.chop.forEach(function (c) {
      var a = agg[c.n]; if (!a) return;
      var q = unitsText(a.units);
      add('chop', c.n, c.name, (q ? q + (a.free ? ' + al gusto' : '') : 'Al gusto') + ' · ' + daysText(a.days), c.how);
    });
    P.snack.forEach(function (s) {
      var us = uses.filter(function (u) { return u.r.id === s.id; }); if (!us.length) return;
      var r = RECIPE[s.id]; covered[s.id] = true;
      add('snack', s.id, r.name, '×' + us.length + ' · ' + daysText(uniq(us.map(function (u) { return u.i; }))), s.how, { emoji: r.emoji, rid: r.id });
    });
    P.portion.forEach(function (p) {
      var a = agg[p.n]; if (!a) return;
      var us = a.uses.filter(function (x) { return !covered[x.rid] && x.q != null; }); if (!us.length) return;
      var groups = {}, order = [];
      us.forEach(function (x) { var key = x.q + '|' + x.u; if (!groups[key]) { groups[key] = { q: x.q, u: x.u, n: 0 }; order.push(key); } groups[key].n++; });
      var meta = order.map(function (key) { var g = groups[key]; return g.n + (g.n === 1 ? ' porción' : ' porciones') + ' de ' + fmtQU(g.q, g.u); }).join(' + ');
      add('snack', 'p-' + p.n, p.name, meta + ' · ' + daysText(uniq(us.map(function (x) { return x.i; }))), 'Separa cada porción en una bolsita o frasco.');
    });
    var mar = {}, morder = [];
    uses.forEach(function (u) {
      if (!u.r.ahead || !/marin/i.test(u.r.ahead)) return;
      var sec = u.i <= 2 ? 'mar' : 'wed', key = sec + '|' + u.r.id;
      if (!mar[key]) { mar[key] = { sec: sec, r: u.r, days: [] }; morder.push(key); }
      mar[key].days.push(u.i);
    });
    morder.forEach(function (key) {
      var g = mar[key], r = g.r, pro = r.ing.filter(function (x) { return x.c === 'pro'; })[0];
      var step = r.steps.filter(function (s) { return /marin/i.test(s); })[0] || r.ahead;
      add(g.sec, r.id, r.name, (pro ? fmtIng(pro) + ' ' : '') + '×' + g.days.length + ' · ' + daysText(g.days),
        step + ' Una porción por tupper.', { emoji: r.emoji, rid: r.id });
    });
    return tasks;
  }
  function prepWeekMon() { return addDays(mondayOf(today()), wd(today()) >= 5 ? 7 : 0); }
  function viewPrep(mon) {
    var wk = keyOf(mon), tasks = buildPrep(mon, false), done = S.prep[wk] || {};
    var n = tasks.length, nd = tasks.filter(function (t) { return done[t.id]; }).length, pct = n ? Math.round(nd / n * 100) : 0;
    var h = '<div class="stack"><h2 class="page-title">Compras</h2>' + weekNav('shop', mon, ui.shopOffset) + shopSwitch();
    if (!n) return h + '<p class="empty">Esta semana no hay nada que adelantar.</p></div>';
    h += '<div class="progress"><div class="progress-top"><span id="prep-count"><b>' + nd + '</b> de ' + n + ' tareas</span><span class="muted" id="prep-pct">' + pct + '%</span></div>' +
      '<div class="bar"><span id="prep-bar" style="width:' + pct + '%"></span></div></div>' +
      '<button class="btn primary cook-start" data-action="cook-prep">' + icon('pot') + ' Hacer el prep en modo cocina</button>';
    h += '<div class="banner info">' + icon('clock') + '<div>Hecho con el menú de esa semana (incluye tus cambios de platillo). <b>Guárdalo bien:</b> refrigera lo cocido en cuanto se enfríe. ' +
      'Lo de lunes a miércoles va al refri; lo de jueves a domingo, congélalo en porciones y pásalo al refri la noche anterior.</div></div>';
    PREP_SECS.forEach(function (sec) {
      var list = tasks.filter(function (t) { return t.sec === sec[0]; }); if (!list.length) return;
      h += '<section class="card"><h3 class="card-title"><span class="emoji">' + sec[1] + '</span> ' + sec[2] + '</h3><ul class="shop-list prep-list">' +
        list.map(function (t) {
          var c = !!done[t.id];
          return '<li><label class="shop-item prep-item' + (c ? ' is-checked' : '') + '"><input type="checkbox" data-input="prep" data-wk="' + wk + '" data-id="' + esc(t.id) + '"' + (c ? ' checked' : '') + '>' +
            '<span class="pi-txt"><span class="si-name">' + (t.emoji ? t.emoji + ' ' : '') + esc(t.title) + '</span><span class="pi-meta">' + esc(t.meta) + '</span><span class="pi-how">' + t.how + '</span></span></label>' +
            (t.rid ? '<button class="chip-btn pi-link" data-action="open-recipe" data-id="' + t.rid + '" aria-label="Ver receta: ' + esc(t.title) + '">' + icon('book', 'ic-sm') + '</button>' : '') + '</li>';
        }).join('') + '</ul></section>';
    });
    return h + '</div>';
  }
  function updatePrepCount() {
    var all = document.querySelectorAll('[data-input="prep"]'), n = 0;
    all.forEach(function (x) { if (x.checked) n++; });
    var pct = all.length ? Math.round(n / all.length * 100) : 0;
    var c = document.getElementById('prep-count'), p = document.getElementById('prep-pct'), b = document.getElementById('prep-bar');
    if (c) c.innerHTML = '<b>' + n + '</b> de ' + all.length + ' tareas';
    if (p) p.textContent = n === all.length ? '¡Listo! 🎉' : pct + '%';
    if (b) b.style.width = pct + '%';
  }
  // Aviso en Hoy: sábado (remojar), domingo (prep) y miércoles (marinar)
  function prepBanner() {
    var w = wd(today()), sec = w === 5 ? 'sat' : w === 2 ? 'wed' : w === 6 ? 'sun' : null;
    if (!sec) return '';
    var mon = prepWeekMon(), done = S.prep[keyOf(mon)] || {}, tasks = buildPrep(mon, false);
    var list = tasks.filter(function (t) { return sec === 'sun' ? t.sec !== 'sat' && t.sec !== 'wed' : t.sec === sec; });
    var left = list.filter(function (t) { return !done[t.id]; });
    if (!left.length) return '';
    var msg = sec === 'sat' ? '<b>Esta noche remoja</b> ' + listText(left.map(function (t) { return t.plain; })) + ' para tu prep de mañana.'
      : sec === 'wed' ? '<b>Esta noche marina</b> para jueves a domingo: ' + listText(left.map(function (t) { return t.plain; })) + '.'
      : '<b>Hoy toca tu prep:</b> ' + left.length + (left.length === 1 ? ' tarea' : ' tareas') + ' para dejar lista la semana.';
    return '<div class="banner leaf">' + icon('pot') + '<div>' + msg + ' <button class="link-btn" data-action="goto-prep">Ver prep</button></div></div>';
  }
  function updateShopCount() {
    var el = document.getElementById('shop-count'); if (!el) return;
    var all = document.querySelectorAll('[data-input="shop"]'), n = 0;
    all.forEach(function (x) { if (x.checked) n++; });
    document.querySelector('.shop-meter').value = n;
    el.textContent = n + ' de ' + all.length + ' listos';
  }
  function shareShopping() {
    var mon = shopMonday(), wk = keyOf(mon), sun = addDays(mon, 6), checked = S.shop[wk] || {};
    var items = buildShopping(mon).items.filter(function (i) { return !checked[i.n] && !isPantry(i.n); });
    if (!items.length) { toast('Ya tienes todo ✓'); return; }
    var lines = ['Lista de compras NutriJabón (' + mon.getDate() + ' ' + MONTHS_ABBR[mon.getMonth()] + ' – ' + sun.getDate() + ' ' + MONTHS_ABBR[sun.getMonth()] + ')'];
    D.SHOP_CATS.forEach(function (cat) {
      var list = items.filter(function (i) { return i.c === cat.id; }).sort(function (a, b) { return a.n.localeCompare(b.n, 'es'); });
      if (!list.length) return;
      lines.push('', cat.emoji + ' ' + cat.name.toUpperCase());
      list.forEach(function (i) { lines.push('• ' + i.n + (i.qty !== 'al gusto' ? ' — ' + i.qty : '')); });
    });
    shareText('Lista de compras', lines.join('\n'), 'Lista copiada');
  }
  // Compartir el menú (sin vitaminas ni medicamentos: eso es privado)
  function menuDayText(k) {
    var lines = [longDate(fromKey(k)) + ' · ' + (isTraining(k) ? 'día de ejercicio' : 'descanso')];
    sortedMeals().forEach(function (m) {
      if (isSkipped(k, m)) return;
      var r = RECIPE[recipeId(k, m.id)];
      lines.push(mealTime(m.id) + ' ' + m.name + ': ' + r.name);
    });
    return lines.join('\n');
  }
  function shareDay(k) { shareText('Menú del día', 'Menú NutriJabón 🌱\n' + menuDayText(k), 'Menú copiado'); }
  function shareWeek(mon) {
    var days = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return menuDayText(keyOf(addDays(mon, i))); });
    shareText('Menú de la semana', 'Menú NutriJabón 🌱 · ' + rangeText(mon, addDays(mon, 6)) + '\n\n' + days.join('\n\n'), 'Menú copiado');
  }
  function shareText(title, text, copiedMsg) {
    if (navigator.share) {
      navigator.share({ title: title, text: text }).catch(function () { /* cancelado */ });
    } else if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { toast(copiedMsg); }, function () { fallbackCopy(text, copiedMsg); });
    } else fallbackCopy(text, copiedMsg);
  }
  function fallbackCopy(text, copiedMsg) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast(copiedMsg); } catch (e) { toast('No se pudo copiar'); }
    document.body.removeChild(ta);
  }

  /* ---------------- Vista: Guía ---------------- */
  function accordion(id, title, body) {
    return '<details class="card acc" id="sec-' + id + '" data-acc="' + id + '"' + (ui.open[id] ? ' open' : '') + '>' +
      '<summary><span>' + title + '</span>' + icon('down', 'chev') + '</summary><div class="acc-body">' + body + '</div></details>';
  }
  function viewGuia() {
    return '<div class="stack"><h2 class="page-title">Guía</h2>' +
      accordion('ex', icon('dumbbell') + 'Ejercicio vs. descanso', exHtml()) +
      accordion('plan', icon('clock') + 'Tu día en porciones', planHtml()) +
      accordion('eq', icon('swap') + 'Equivalentes veganos', eqHtml()) +
      accordion('tips', icon('leaf') + 'Tips veganos', tipsHtml()) +
      accordion('fuera', icon('fork') + 'Comer fuera', outHtml()) +
      '<h3 class="section-heading">Preferencias y datos</h3>' +
      accordion('ajustes', icon('paw') + 'Ajustes', settingsHtml()) +
      accordion('tomas', icon('pill') + 'Vitaminas y medicamentos', medsHtml()) +
      accordion('avisos', icon('bell') + 'Recordatorios', remindHtml()) +
      accordion('respaldo', icon('cassette') + 'Respaldo y otros equipos', backupHtml()) +
      accordion('instalar', icon('download') + 'Instalar en tus dispositivos', installHtml()) +
      '<p class="small muted center">Basado en el plan de tu nutrióloga del 8 nov 2026 · Próxima revisión: 18 dic 2026.<br>NutriJabón te ayuda a seguir tu plan; no sustituye la consulta profesional.</p></div>';
  }
  function exHtml() {
    var pres = D.RECIPES.filter(function (r) { return r.meal === 'pre' && !r.extra; }).map(function (r) { return r.emoji + ' ' + esc(r.name); });
    var mode = ui.guideMode || (isTraining(keyOf(today())) ? 'train' : 'rest');
    return '<div class="guide-picker" role="group" aria-label="Consultar tipo de día">' +
      ['train', 'rest'].map(function (v) { return '<button data-action="guide-mode" data-v="' + v + '" aria-pressed="' + (mode === v) + '">' + (v === 'train' ? 'Ejercicio' : 'Descanso') + '</button>'; }).join('') +
      '</div><div class="ex-grid guide-' + mode + '">' +
      '<div class="ex-col ok"><h4>' + icon('dumbbell') + ' Días de ejercicio</h4><ul>' +
      '<li>Comes los <b>6 tiempos</b>, incluido el <b>pre-entreno</b> (' + mealTime('pre') + ').</li>' +
      '<li>Cómelo antes de entrenar; el “Mix” también sirve durante el entreno.</li>' +
      '<li>Total: 3 frutas, 7 cereales y 3 grasas con proteína.</li></ul></div>' +
      '<div class="ex-col warn"><h4>' + icon('moon') + ' Días de descanso</h4><ul>' +
      '<li><b>No comas el pre-entreno</b>: ' + pres.join(', ') + '.</li>' +
      (restMeds().length ? '<li>' + restMedsText().trim() + '</li>' : '') +
      '<li>No pases esas porciones a otras comidas (salvo que tu nutrióloga te diga otra cosa).</li>' +
      '<li>Desayuno, colaciones, comida y cena quedan igual.</li>' +
      '<li>Total: 2 frutas, 6 cereales y 2 grasas con proteína.</li></ul></div></div>' +
      '<p class="small muted">Así se interpreta tu plan, que pone el pre-entreno como un tiempo aparte. Si entrenas a otra hora, mueve su horario en Ajustes; ante cualquier duda, confírmalo en tu próxima revisión.</p>';
  }
  function planHtml() {
    return '<ul class="plain plan-list">' + sortedMeals().map(function (m) {
      return '<li class="plan-row" style="--mc:var(--m-' + m.id + ')"><span class="t">' + mealTime(m.id) + '</span><div><b>' + m.name + '</b>' +
        (m.trainingOnly ? ' <span class="badge">solo días de ejercicio</span>' : '') + eqChips(m.eq) + '</div></li>';
    }).join('') + '</ul><h4 class="sec-title">Total en un día de ejercicio</h4><div class="eq-grid">' +
      G_ORDER.map(function (g) {
        return '<div class="eq-cell">' + dot(g) + '<span>' + G[g].name + (G[g].orig ? ' <small class="muted">(en tu PDF: ' + G[g].orig + ')</small>' : '') + '</span><b>' + G[g].perDay + '</b></div>';
      }).join('') + '</div>';
  }
  function eqHtml() {
    return '<p class="small muted">Cambia un alimento por otro del <b>mismo grupo</b>: cada renglón es 1 porción. Quitamos ' + D.REMOVED.length +
      ' alimentos de origen animal de tu lista original y marcamos con ' + icon('alert', 'ic-xs warn-ic') + ' los que a veces traen ingredientes animales.</p>' +
      '<label class="search">' + icon('search') + '<input type="search" placeholder="Busca un alimento…" value="' + esc(ui.eqQuery) + '" data-input="eq" aria-label="Buscar equivalentes"></label>' +
      '<div id="eq-results">' + eqResults() + '</div>' +
      '<details class="removed"><summary>Ver lo que quitamos por no ser vegano</summary><p class="small muted">' + D.REMOVED.join(', ') + '.</p></details>';
  }
  function eqResults() {
    var q = norm(ui.eqQuery.trim());
    var out = G_ORDER.map(function (g) {
      var list = D.EQUIV[g].filter(function (x) { return !q || norm(x[0]).indexOf(q) !== -1; });
      if (!list.length) return '';
      return '<div class="eq-group"><h4 class="eq-head">' + dot(g) + G[g].name + ' <span class="muted small">· ' + G[g].perDay + ' al día</span></h4><ul class="eq-list">' +
        list.map(function (x) {
          return '<li><span class="eq-n">' + esc(x[0]) + (x[2] ? '<span class="flag">' + icon('alert', 'ic-xs') + ' ' + esc(x[2]) + '</span>' : '') + '</span><span class="eq-p">' + esc(x[1]) + '</span></li>';
        }).join('') + '</ul></div>';
    }).join('');
    var rem = q ? D.REMOVED.filter(function (n) { return norm(n).indexOf(q) !== -1; }) : [];
    if (rem.length) out = '<div class="banner warn">' + icon('ban') + '<div>' + esc(rem.join(', ')) + (rem.length === 1 ? ': no es vegano, por eso lo quitamos.' : ': no son veganos, por eso los quitamos.') + '</div></div>' + out;
    return out || '<p class="empty">No encontré ese alimento.</p>';
  }
  function tipsHtml() {
    return '<ul class="plain tips">' + D.TIPS.map(function (t) {
      return '<li><span class="emoji big">' + t.e + '</span><div><b>' + t.t + '</b><p>' + t.d + '</p></div></li>';
    }).join('') + '</ul>';
  }
  function dayChips() {
    return '<div class="day-chips">' + DAY_LETTER.map(function (l, i) {
      return '<button class="day-chip" aria-pressed="' + (S.settings.trainDays.indexOf(i) !== -1) + '" data-action="toggle-train-day" data-i="' + i + '" title="' + DAY_NAMES[i] + '" aria-label="' + DAY_NAMES[i] + '">' + l + '</button>';
    }).join('') + '</div>';
  }
  function settingsHtml() {
    return '<h4 class="sec-title">¿Qué días haces ejercicio?</h4>' + dayChips() +
      '<p class="small muted">Para cambiar un día suelto, usa el selector en Hoy o la etiqueta en Semana.</p>' +
      '<h4 class="sec-title">Horarios</h4><div class="times">' + MEALS.map(function (m) {
        return '<label class="time-row"><span>' + m.name + '</span><input type="time" value="' + mealTime(m.id) + '" data-input="time" data-meal="' + m.id + '"></label>';
      }).join('') + '</div>' +
      '<div><button class="link-btn" data-action="reset-times">Restaurar horarios del plan</button></div>' +
      '<p class="small">' + icon('pill', 'ic-xs') + ' <button class="link-btn" data-action="goto-sec" data-sec="tomas">Vitaminas y medicamentos</button>: elige con qué comida va cada uno.</p>' +
      '<p class="small">' + icon('bell', 'ic-xs') + ' ¿Quieres avisos a estas horas? <button class="link-btn" data-action="goto-sec" data-sec="avisos">Agrégalos a tu calendario</button></p>' +
      '<h4 class="sec-title">Tus datos</h4><p class="small muted">Todo se guarda solo en este dispositivo; nada se envía a internet. <button class="link-btn" data-action="goto-sec" data-sec="respaldo">Guarda un respaldo</button> para no perderlo.</p>' +
      '<div><button class="btn danger" data-action="reset-all">Borrar marcas y cambios de platillos</button></div>';
  }
  /* Vitaminas y medicamentos: se guardan solo en este dispositivo */
  var WHEN = [['all', 'Todos los días'], ['train', 'Solo días de ejercicio']];
  function mealOptions(sel) {
    return sortedMeals().map(function (m) { return '<option value="' + m.id + '"' + (m.id === sel ? ' selected' : '') + '>' + m.name + ' (' + mealTime(m.id) + ')</option>'; }).join('');
  }
  function whenOptions(sel) {
    return WHEN.map(function (w) { return '<option value="' + w[0] + '"' + (w[0] === sel ? ' selected' : '') + '>' + w[1] + '</option>'; }).join('');
  }
  function medsHtml() {
    var meds = S.settings.meds || [];
    return '<p>Cada una aparece en Hoy junto a su comida, con ' + icon('check', 'ic-xs') + ' / ' + icon('x', 'ic-xs') + ' para marcar si la tomaste, y también en tus recordatorios y en el resumen.</p>' +
      (meds.length ? '<ul class="plain med-list">' + meds.map(function (md) {
        var name = esc(md.name);
        return '<li class="med-row" style="--mc:var(--m-' + md.meal + ')"><div class="med-head"><span class="toma-ic">' + icon('pill') + '</span><b>' + name + '</b>' +
          '<button class="icon-btn sm" data-action="med-del" data-id="' + md.id + '" aria-label="Quitar ' + name + '">' + icon('x') + '</button></div>' +
          '<div class="med-fields"><label><span class="small muted">Con</span><select data-input="med-meal" data-id="' + md.id + '" aria-label="Comida de ' + name + '">' + mealOptions(md.meal) + '</select></label>' +
          '<label><span class="small muted">Días</span><select data-input="med-when" data-id="' + md.id + '" aria-label="Días de ' + name + '">' + whenOptions(md.when) + '</select></label></div></li>';
      }).join('') + '</ul>' : '<p class="small muted">No tienes ninguna todavía.</p>') +
      '<h4 class="sec-title">Agregar</h4><div class="med-form">' +
      '<input type="text" id="med-name" maxlength="40" placeholder="Nombre (ej.: Omega 3)" aria-label="Nombre de la vitamina o medicamento" autocomplete="off">' +
      '<div class="med-fields"><label><span class="small muted">Con</span><select id="med-meal" aria-label="Con qué comida">' + mealOptions('des') + '</select></label>' +
      '<label><span class="small muted">Días</span><select id="med-when" aria-label="Qué días">' + whenOptions('all') + '</select></label></div>' +
      '<div><button class="btn primary" data-action="med-add">' + icon('pill') + ' Agregar</button></div></div>' +
      '<p class="small muted">Solo es un recordatorio: la dosis y el horario los indica tu médico. Estos datos no salen de tu dispositivo (salvo en tu respaldo o en el resumen que tú compartas).</p>';
  }
  function addMed() {
    var inp = document.getElementById('med-name'), name = (inp && inp.value || '').trim().slice(0, 40);
    if (!name) { toast('Escribe el nombre'); if (inp) inp.focus(); return; }
    var meal = document.getElementById('med-meal').value, when = document.getElementById('med-when').value;
    S.settings.meds = (S.settings.meds || []).concat([{ id: 'm' + Date.now().toString(36), name: name, meal: MEAL[meal] ? meal : 'des', when: when === 'train' ? 'train' : 'all' }]);
    S.settings.medsSeen = true;
    save(); render();
    toast(name + ': con tu ' + MEAL[meal].name.toLowerCase());
  }
  function delMed(id) {
    var md = (S.settings.meds || []).filter(function (x) { return x.id === id; })[0];
    if (!md || !window.confirm('¿Quitar ' + md.name + ' de tu lista?')) return;
    S.settings.meds = S.settings.meds.filter(function (x) { return x.id !== id; });
    save(); render();
  }
  function shortDate(k) { var d = fromKey(k); return d.getDate() + ' ' + MONTHS_ABBR[d.getMonth()] + ' ' + d.getFullYear(); }

  /* ---------------- Recordatorios: archivo de calendario (.ics) ----------------
   * Un evento semanal por comida y platillo, con aviso. Sin servidor: funciona en
   * iPhone, Android, Windows y Mac porque el calendario del equipo se encarga de avisar. */
  var LEADS = [[0, 'A la hora'], [10, '10 min antes'], [15, '15 min antes'], [30, '30 min antes']];
  var ICS_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  var FILES_CACHE = 'nutrijabon-files';
  function remindLead() { var v = S.settings.remindLead; return LEADS.some(function (l) { return l[0] === v; }) ? v : 0; }
  function icsEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function icsFold(line) { // líneas de máximo 75 bytes, como pide el formato
    var out = [], cur = '', n = 0;
    Array.from(line).forEach(function (ch) {
      var cp = ch.codePointAt(0), b = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
      if (n + b > 75) { out.push(cur); cur = ' '; n = 1; }
      cur += ch; n += b;
    });
    out.push(cur);
    return out.join('\r\n');
  }
  function icsLocal(d) { return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + 'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00'; }
  function appUrl() { return /^https?:$/.test(location.protocol) ? location.origin + location.pathname.replace(/[^/]*$/, '') : ''; }
  function buildIcs() {
    var lead = remindLead(), start = today(), url = appUrl();
    var until = start <= fromKey(D.PLAN.review) ? ';UNTIL=' + D.PLAN.review.replace(/-/g, '') + 'T235959' : '';
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NutriJabon//Plan vegano//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:NutriJabón'];
    var meds = S.settings.meds || [];
    MEALS.forEach(function (m) {
      // Agrupa los días de la semana que comparten platillo y tomas (vitaminas/medicamentos)
      var groups = {}, order = [];
      for (var i = 0; i < 7; i++) {
        var train = S.settings.trainDays.indexOf(i) !== -1, eats = !m.trainingOnly || train;
        var dm = meds.filter(function (md) { return md.meal === m.id && (md.when === 'all' || train); });
        if (!eats && !dm.length) continue;
        var key = (eats ? D.WEEK[m.id][i] : '-') + '|' + dm.map(function (md) { return md.id; }).join(',');
        if (!groups[key]) { groups[key] = { days: [], rid: eats ? D.WEEK[m.id][i] : null, meds: dm }; order.push(key); }
        groups[key].days.push(i);
      }
      var t = mealTime(m.id).split(':').map(Number);
      order.forEach(function (key) {
        var g = groups[key], days = g.days, r = g.rid && RECIPE[g.rid], first = start;
        while (days.indexOf(wd(first)) === -1) first = addDays(first, 1);
        var s = new Date(first.getFullYear(), first.getMonth(), first.getDate(), t[0], t[1]);
        var by = days.map(function (i) { return ICS_DAYS[i]; });
        var medNames = g.meds.map(function (md) { return md.name; }).join(', ');
        var title = r ? r.emoji + ' ' + m.name + ': ' + r.name + (medNames ? ' · 💊 ' + medNames : '')
          : '💊 ' + medNames + ' (hora de tu ' + m.name.toLowerCase() + ')';
        var desc = r
          ? 'Toca: ' + eqList(m.eq).join(', ') + '.' + (medNames ? '\nToma también: ' + medNames + '.' : '') + (m.trainingOnly ? '\nSolo en tus días de ejercicio.' : '') +
            '\nPuedes cambiarlo por otro platillo con las mismas porciones.' +
            (m.id === 'cen' ? '\nAl terminar el día, anota en NutriJabón cómo te sentiste (energía, hambre y digestión).' : '')
          : 'Hoy no toca ' + m.name.toLowerCase() + ', pero sí: ' + medNames + '.';
        if (url) desc += '\nMarca si cumpliste en NutriJabón: ' + url;
        L.push('BEGIN:VEVENT', 'UID:nj-' + m.id + '-' + by.join('') + (g.meds.length ? '-' + g.meds.map(function (md) { return md.id; }).join('') : '') + '@nutrijabon', 'DTSTAMP:' + stamp,
          'DTSTART:' + icsLocal(s), 'DTEND:' + icsLocal(new Date(s.getTime() + 30 * 6e4)),
          'RRULE:FREQ=WEEKLY;BYDAY=' + by.join(',') + until,
          'SUMMARY:' + icsEsc(title), 'DESCRIPTION:' + icsEsc(desc),
          'TRANSP:TRANSPARENT', 'CATEGORIES:NutriJabón',
          'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(title.replace(/^\S+ /, '')), 'TRIGGER:' + (lead ? '-PT' + lead + 'M' : 'PT0S'), 'END:VALARM',
          'END:VEVENT');
      });
    });
    // Prep: sábado 21:00 remojar, domingo 10:00 prep y miércoles 21:00 marinar (con el menú base de tu plan)
    var prep = buildPrep(addDays(mondayOf(start), 7), true);
    function names(secs) { return prep.filter(function (x) { return secs.indexOf(x.sec) !== -1; }).map(function (x) { return x.plain; }); }
    function prepEvent(id, day, hh, mins, title, desc) {
      var first = start; while (wd(first) !== day) first = addDays(first, 1);
      var s = new Date(first.getFullYear(), first.getMonth(), first.getDate(), hh, 0);
      if (url) desc += '\nVer el prep en NutriJabón (Compras → Prep del domingo): ' + url;
      L.push('BEGIN:VEVENT', 'UID:nj-prep-' + id + '@nutrijabon', 'DTSTAMP:' + stamp,
        'DTSTART:' + icsLocal(s), 'DTEND:' + icsLocal(new Date(s.getTime() + mins * 6e4)),
        'RRULE:FREQ=WEEKLY;BYDAY=' + ICS_DAYS[day] + until,
        'SUMMARY:' + icsEsc(title), 'DESCRIPTION:' + icsEsc(desc), 'TRANSP:TRANSPARENT', 'CATEGORIES:NutriJabón',
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(title.replace(/^\S+ /, '')), 'TRIGGER:' + (lead ? '-PT' + lead + 'M' : 'PT0S'), 'END:VALARM',
        'END:VEVENT');
    }
    var soak = names(['sat']), sun = PREP_SECS.filter(function (x) { return ['cook', 'chop', 'snack', 'mar'].indexOf(x[0]) !== -1; }), wed = names(['wed']);
    if (soak.length) prepEvent('sab', 5, 21, 15, '🫘 Remoja ' + listText(soak), 'En agua, 12 horas, para tu prep de mañana.');
    var sunDesc = sun.map(function (sec) { var n = names([sec[0]]); return n.length ? sec[2].replace(/^Domingo: (.)/, function (x, c) { return c.toUpperCase(); }) + ': ' + listText(n) + '.' : ''; }).filter(Boolean);
    if (sunDesc.length) prepEvent('dom', 6, 10, 120, '🍲 Prep del domingo', sunDesc.join('\n'));
    if (wed.length) prepEvent('mie', 2, 21, 15, '🫙 Marina para jueves a domingo', 'Marina: ' + listText(wed) + '. Una porción por tupper.');
    L.push('END:VCALENDAR');
    return L.map(icsFold).join('\r\n') + '\r\n';
  }
  function downloadFile(name, type, text) {
    var url = URL.createObjectURL(new Blob([text], { type: type }));
    var a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }
  function addToCalendar() {
    var ics = buildIcs();
    if (detectOS() !== 'ios') { downloadFile('NutriJabon-recordatorios.ics', 'text/calendar;charset=utf-8', ics); toast('Listo: abre el archivo descargado'); return; }
    // iPhone/iPad: Safari abre el Calendario con “Agregar todo” cuando visita un .ics real.
    // El service worker lo sirve desde el caché; si no hay, se usa una dirección data:.
    var dataUrl = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
    if (!(window.caches && navigator.serviceWorker && navigator.serviceWorker.controller)) { location.href = dataUrl; return; }
    caches.open(FILES_CACHE).then(function (c) {
      return c.put('recordatorios.ics', new Response(ics, { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } }));
    }).then(function () { location.href = 'recordatorios.ics'; }, function () { location.href = dataUrl; });
  }
  function remindHtml() {
    var os = detectOS(), lead = remindLead(), rev = shortDate(D.PLAN.review).replace(/ \d{4}$/, '');
    var notes = {
      ios: 'Se abre tu Calendario: toca <b>Agregar todo</b>.',
      android: 'Se descarga un archivo: ábrelo y elige tu app de calendario. Si Google Calendar no lo abre, impórtalo desde una computadora en <b>calendar.google.com</b> (Configuración → Importar y exportar) y te llegará al celular.',
      windows: 'Se descarga un archivo: ábrelo y se agrega a Outlook o a Calendario.',
      mac: 'Se descarga un archivo: ábrelo y elige en qué calendario guardarlo.'
    };
    var train = S.settings.trainDays.map(function (i) { return DAY_ABBR[i].toLowerCase(); });
    return '<p>Agrega tus comidas a tu calendario: te avisa a la hora de cada una con el platillo que toca ese día y las vitaminas o medicamentos que van con ella. ' +
      'También incluye tu prep: sábado 9 pm (remojar), domingo 10 am (prep) y miércoles 9 pm (marinar). El pre-entreno solo aparece en tus días de ejercicio' +
      (train.length ? ' (' + train.join(', ') + ')' : '; ahora no tienes ninguno marcado') + '.</p>' +
      '<label class="time-row lead-row"><span>Avisarme</span><select data-input="lead" aria-label="Cuándo avisarme">' + LEADS.map(function (l) {
        return '<option value="' + l[0] + '"' + (l[0] === lead ? ' selected' : '') + '>' + l[1] + '</option>';
      }).join('') + '</select></label>' +
      '<div><button class="btn primary" data-action="add-calendar">' + icon('bell') + ' Agregar a mi calendario</button></div>' +
      (notes[os] ? '<div class="banner info">' + icon('info') + '<div>' + notes[os] + '</div></div>' : '') +
      '<p class="small muted">Usa tus horarios de Ajustes y dura hasta tu revisión del ' + rev + '. Si cambias horarios, días de ejercicio o tus vitaminas y medicamentos, borra los avisos anteriores y vuelve a agregarlos. Los cambios de un solo día no llegan al calendario.</p>';
  }

  /* ---------------- Respaldo: pasar tus datos a otro equipo ---------------- */
  var KEY_RE = /^\d{4}-\d{2}-\d{2}$/, MED_ID = /^[a-z0-9]{1,20}$/;
  function backupName() { return 'NutriJabon-respaldo-' + keyOf(today()) + '.json'; }
  function backupText() { return JSON.stringify({ app: 'nutrijabon', v: 1, exported: new Date().toISOString(), data: S }); }
  function markBackup() { S.settings.lastBackup = keyOf(today()); save(); render(); }
  function canShareFiles() {
    try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] })); } catch (e) { return false; }
  }
  function saveBackup() { markBackup(); downloadFile(backupName(), 'application/json', backupText()); toast('Respaldo guardado en Descargas'); }
  function sendBackup() {
    var f = new File([backupText()], backupName(), { type: 'application/json' });
    navigator.share({ files: [f], title: 'Respaldo de NutriJabón' }).then(function () { markBackup(); toast('Respaldo enviado'); }, function () { /* cancelado */ });
  }
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function cleanData(d) { // solo acepta datos con la forma esperada
    var st = isObj(d.settings) ? d.settings : {}, out = { settings: defaults(), days: {}, shop: {}, prep: {} };
    if (Array.isArray(st.trainDays)) {
      out.settings.trainDays = [0, 1, 2, 3, 4, 5, 6].filter(function (i) { return st.trainDays.indexOf(i) !== -1; });
    }
    if (isObj(st.times)) Object.keys(st.times).forEach(function (id) {
      if (MEAL[id] && /^([01]\d|2[0-3]):[0-5]\d$/.test(st.times[id])) out.settings.times[id] = st.times[id];
    });
    if (LEADS.some(function (l) { return l[0] === st.remindLead; })) out.settings.remindLead = st.remindLead;
    if (KEY_RE.test(st.lastBackup)) out.settings.lastBackup = st.lastBackup;
    if (typeof st.notes === 'string' && st.notes) out.settings.notes = st.notes.slice(0, 2000);
    if (Array.isArray(st.meds)) {
      out.settings.meds = st.meds.filter(function (md) {
        return isObj(md) && MED_ID.test(md.id) && typeof md.name === 'string' && md.name.trim() && MEAL[md.meal];
      }).slice(0, 20).map(function (md) {
        return { id: md.id, name: md.name.trim().slice(0, 40), meal: md.meal, when: md.when === 'train' ? 'train' : 'all' };
      });
    }
    if (st.medsSeen === true) out.settings.medsSeen = true;
    if (st.vitAllDays === true) out.settings.vitAllDays = true;
    if (KEY_RE.test(st.recapSeen)) out.settings.recapSeen = st.recapSeen;
    if (isObj(st.taste)) Object.keys(st.taste).forEach(function (id) { if (RECIPE[id] && (st.taste[id] === 1 || st.taste[id] === -1)) (out.settings.taste = out.settings.taste || {})[id] = st.taste[id]; });
    if (isObj(st.pantry)) Object.keys(st.pantry).forEach(function (n) { if (st.pantry[n] === true && n.length <= 80) (out.settings.pantry = out.settings.pantry || {})[n] = true; });
    out.settings.onboarded = true;
    if (isObj(d.days)) Object.keys(d.days).forEach(function (k) {
      var r = d.days[k], o = {};
      if (!KEY_RE.test(k) || !isObj(r)) return;
      if (typeof r.ex === 'boolean') o.ex = r.ex;
      if (isObj(r.sw)) Object.keys(r.sw).forEach(function (m) {
        var x = RECIPE[r.sw[m]];
        if (MEAL[m] && x && x.meal === m) (o.sw = o.sw || {})[m] = x.id;
      });
      if (isObj(r.done)) Object.keys(r.done).forEach(function (m) { if (MEAL[m] && typeof r.done[m] === 'boolean') (o.done = o.done || {})[m] = r.done[m]; });
      if (isObj(r.tk)) Object.keys(r.tk).forEach(function (id) { if (MED_ID.test(id) && typeof r.tk[id] === 'boolean') (o.tk = o.tk || {})[id] = r.tk[id]; });
      // razones: solo de la lista y solo donde la marca es ✗
      if (isObj(r.why)) Object.keys(r.why).forEach(function (m) { if (o.done && o.done[m] === false && REASON_TEXT.meal[r.why[m]]) (o.why = o.why || {})[m] = r.why[m]; });
      if (isObj(r.twhy)) Object.keys(r.twhy).forEach(function (id) { if (o.tk && o.tk[id] === false && REASON_TEXT.med[r.twhy[id]]) (o.twhy = o.twhy || {})[id] = r.twhy[id]; });
      if (isObj(r.ck)) { // ¿cómo te sentiste?: 1–5 y nota corta
        var ck = {};
        CHECKS.forEach(function (x) { var v = r.ck[x.id]; if (v === (v | 0) && v >= 1 && v <= 5) ck[x.id] = v; });
        if (typeof r.ck.n === 'string' && r.ck.n.trim()) ck.n = r.ck.n.slice(0, 300);
        if (Object.keys(ck).length) o.ck = ck;
      }
      if (Object.keys(o).length) out.days[k] = o;
    });
    if (isObj(d.shop)) Object.keys(d.shop).forEach(function (wk) {
      var w = d.shop[wk], o = {};
      if (!KEY_RE.test(wk) || !isObj(w)) return;
      Object.keys(w).forEach(function (n) { if (w[n] === true) o[n] = true; });
      if (Object.keys(o).length) out.shop[wk] = o;
    });
    if (isObj(d.prep)) Object.keys(d.prep).forEach(function (wk) {
      var w = d.prep[wk], o = {};
      if (!KEY_RE.test(wk) || !isObj(w)) return;
      Object.keys(w).forEach(function (id) { if (w[id] === true && id.length <= 80) o[id] = true; });
      if (Object.keys(o).length) out.prep[wk] = o;
    });
    return out;
  }
  function importBackup(file) {
    var rd = new FileReader();
    rd.onload = function () {
      var p = null;
      try { p = JSON.parse(rd.result); } catch (e) { /* no es JSON */ }
      if (!isObj(p) || p.app !== 'nutrijabon' || !isObj(p.data)) { toast('Ese archivo no es un respaldo de NutriJabón'); return; }
      var when = new Date(p.exported);
      pendingImport = { data: cleanData(p.data), when: isNaN(when) ? '' : shortDate(keyOf(when)) };
      openSheet('import', []);
    };
    rd.onerror = function () { toast('No se pudo leer el archivo'); };
    rd.readAsText(file);
  }
  // Al cargar un respaldo: combinar con lo de este equipo o reemplazarlo todo
  var pendingImport = null;
  function markedDays(data) { return Object.keys(data.days).filter(function (k) { var r = data.days[k]; return r.done || r.tk; }).length; }
  function importSheet() {
    var P = pendingImport; if (!P) return '';
    return '<div class="sheet-head"><span class="sheet-emoji roundel" style="--mc:var(--orange)">' + icon('cassette') + '</span>' +
      '<div class="sheet-titles"><div class="eyebrow">Cargar respaldo</div><h2 id="sheet-title">Respaldo' + (P.when ? ' del ' + P.when : '') + '</h2></div>' +
      '<button class="icon-btn" data-action="close-sheet" aria-label="Cancelar">' + icon('x') + '</button></div>' +
      '<div class="sheet-content"><p>El respaldo tiene marcas en <b>' + markedDays(P.data) + '</b> días; este equipo, en <b>' + markedDays(S) + '</b>.</p>' +
      '<button class="import-opt is-main" data-action="import-merge"><b>' + icon('swap') + ' Combinar con este equipo</b><span class="small">Junta las marcas de los dos. Si una comida tiene ✓ en uno y ✗ en el otro, se queda ✓. ' +
      'Tus ajustes de este equipo se quedan y se agregan las vitaminas o medicamentos que falten.</span></button>' +
      '<button class="import-opt" data-action="import-replace"><b>' + icon('download') + ' Reemplazar todo</b><span class="small">Este equipo queda igual que el respaldo; lo que solo esté aquí se pierde.</span></button>' +
      '</div>';
  }
  function mergeData(a, b) { // a = este equipo, b = respaldo (ya limpio). Gana ✓ sobre ✗; en lo demás, este equipo.
    var out = JSON.parse(JSON.stringify(a)), idMap = {};
    out.settings.meds = out.settings.meds || [];
    (b.settings.meds || []).forEach(function (md) {
      var same = out.settings.meds.filter(function (x) { return x.id === md.id || (x.meal === md.meal && x.name.trim().toLowerCase() === md.name.trim().toLowerCase()); })[0];
      if (same) idMap[md.id] = same.id; else { out.settings.meds.push(md); idMap[md.id] = md.id; }
    });
    Object.keys(b.days).forEach(function (k) {
      var x = out.days[k] || (out.days[k] = {}), y = b.days[k];
      if (typeof x.ex !== 'boolean' && typeof y.ex === 'boolean') x.ex = y.ex;
      if (y.ck) { x.ck = x.ck || {}; Object.keys(y.ck).forEach(function (f) { if (!(f in x.ck)) x.ck[f] = y.ck[f]; }); }
      if (y.sw) { x.sw = x.sw || {}; Object.keys(y.sw).forEach(function (m) { if (!(m in x.sw)) x.sw[m] = y.sw[m]; }); }
      [['done', 'why', false], ['tk', 'twhy', true]].forEach(function (f) {
        var mk = f[0], wy = f[1]; if (!y[mk]) return;
        x[mk] = x[mk] || {};
        Object.keys(y[mk]).forEach(function (id0) {
          var id = f[2] ? (idMap[id0] || id0) : id0, mine = x[mk][id], theirs = y[mk][id0], why = y[wy] && y[wy][id0];
          if (mine === undefined || (mine === false && theirs === true)) {
            x[mk][id] = theirs;
            if (theirs === true) { if (x[wy]) delete x[wy][id]; }
            else if (why) { x[wy] = x[wy] || {}; x[wy][id] = why; }
          } else if (mine === false && theirs === false && why && !(x[wy] && x[wy][id])) { x[wy] = x[wy] || {}; x[wy][id] = why; }
        });
      });
      ['sw', 'done', 'tk', 'why', 'twhy', 'ck'].forEach(function (f) { if (x[f] && !Object.keys(x[f]).length) delete x[f]; });
      if (!Object.keys(x).length) delete out.days[k];
    });
    ['shop', 'prep'].forEach(function (f) {
      Object.keys(b[f] || {}).forEach(function (wk) { out[f][wk] = Object.assign({}, b[f][wk], out[f][wk] || {}); });
    });
    var n1 = (out.settings.notes || '').trim(), n2 = (b.settings.notes || '').trim();
    if (n2 && n1.indexOf(n2) === -1) out.settings.notes = ((n1 ? n1 + '\n' : '') + n2).slice(0, 2000);
    if (b.settings.lastBackup && (!out.settings.lastBackup || b.settings.lastBackup > out.settings.lastBackup)) out.settings.lastBackup = b.settings.lastBackup;
    out.settings.medsSeen = out.settings.medsSeen || b.settings.medsSeen;
    var tb = b.settings.taste || {}; out.settings.taste = out.settings.taste || {};
    Object.keys(tb).forEach(function (id) { if (!(id in out.settings.taste)) out.settings.taste[id] = tb[id]; });
    out.settings.pantry = Object.assign({}, b.settings.pantry || {}, out.settings.pantry || {});
    return out;
  }
  function finishImport(merge) {
    var P = pendingImport; if (!P) return;
    if (!merge && !window.confirm('¿Reemplazar todo con el respaldo' + (P.when ? ' del ' + P.when : '') + '? Lo que solo esté en este equipo se pierde.')) return;
    S = merge ? mergeData(S, P.data) : P.data;
    pendingImport = null;
    save(); closeSheet(); render();
    toast(merge ? 'Respaldo combinado ✓' : 'Respaldo cargado ✓');
  }
  function backupHtml() {
    var lb = S.settings.lastBackup;
    return '<p>Tus marcas, platillos y ajustes se guardan solo en este dispositivo. Guarda un respaldo para pasarlos a otro equipo o por si cambias de celular.</p>' +
      '<p class="small"><b>Último respaldo:</b> ' + (lb ? shortDate(lb) : 'todavía ninguno') + '</p>' +
      '<div class="row-gap">' +
      '<button class="btn primary" data-action="backup-save">' + icon('download') + ' Guardar respaldo</button>' +
      (canShareFiles() ? '<button class="btn" data-action="backup-send">' + icon('share') + ' Enviar</button>' : '') +
      '<label class="btn file-btn">' + icon('upload') + ' Cargar respaldo<input type="file" accept=".json,application/json" data-input="backup"></label>' +
      '</div>' +
      '<p class="small muted"><b>Para pasarlo a otro equipo:</b> guarda o envía el respaldo (por correo, WhatsApp o AirDrop), abre NutriJabón en el otro equipo y toca <b>Cargar respaldo</b>. Puedes combinarlo con lo que ya haya ahí o reemplazarlo.</p>';
  }
  var deferredPrompt = null;
  function detectOS() {
    var ua = navigator.userAgent;
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
    if (/windows/i.test(ua)) return 'windows';
    if (/macintosh/i.test(ua)) return 'mac';
    return '';
  }
  function isStandalone() {
    return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  }
  function installHtml() {
    if (isStandalone()) return '<p>✅ Ya estás usando NutriJabón como app instalada. Funciona sin internet.</p>';
    var os = detectOS();
    var rows = [
      ['android', 'Android', 'En Chrome, abre el menú ⋮ y toca <b>Instalar app</b> (o <b>Agregar a la pantalla principal</b>).'],
      ['ios', 'iPhone / iPad', 'En Safari, toca <b>Compartir</b> (cuadro con flecha) y luego <b>Agregar a inicio</b>.'],
      ['windows', 'Windows', 'En Edge o Chrome, haz clic en el ícono de instalar de la barra de direcciones, o menú ⋯ → <b>Aplicaciones → Instalar NutriJabón</b>.'],
      ['mac', 'Mac', 'En Safari: menú <b>Archivo → Agregar al Dock</b>. En Chrome: ícono de instalar en la barra de direcciones.']
    ];
    return (location.protocol === 'file:' ? '<div class="banner warn">' + icon('alert') + '<div>Estás abriendo el archivo directamente. Para instalarla en tu celular, la app necesita estar publicada en una dirección https (ver LEEME.md).</div></div>' : '') +
      (deferredPrompt ? '<div><button class="btn primary" data-action="install">' + icon('download') + ' Instalar ahora</button></div>' : '') +
      '<ul class="plain install-list">' + rows.map(function (r) {
        return '<li class="' + (r[0] === os ? 'is-mine' : '') + '"><b>' + r[1] + '</b>' + (r[0] === os ? ' <span class="badge primary">este equipo</span>' : '') + '<br><span class="small">' + r[2] + '</span></li>';
      }).join('') + '</ul><p class="small muted">Una vez instalada funciona sin internet.</p>';
  }

  /* ---------------- Hojas (modales) ---------------- */
  function recipeSheet(id, ctx) {
    ctx = ctx || {};
    var r = RECIPE[id], m = MEAL[r.meal], pd = planDays(r), actions;
    if (ctx.mode === 'day') {
      var skipped = isSkipped(ctx.k, m), done = isDone(ctx.k, r.meal);
      actions = skipped
        ? '<p class="small muted center grow">Este día es de descanso: el pre-entreno no toca.</p>'
        : '<button class="btn" data-action="open-swap" data-k="' + ctx.k + '" data-meal="' + r.meal + '">' + icon('swap') + ' Cambiar</button>' +
          '<button class="btn primary" data-action="mark" data-v="1" data-k="' + ctx.k + '" data-meal="' + r.meal + '" data-close="1">' + icon('check') + (done ? ' Desmarcar' : ' Ya lo comí') + '</button>';
    } else if (ctx.mode === 'choose') {
      actions = '<button class="btn" data-action="open-swap" data-k="' + ctx.k + '" data-meal="' + r.meal + '">' + icon('left') + ' Opciones</button>' +
        '<button class="btn primary" data-action="choose-swap" data-k="' + ctx.k + '" data-meal="' + r.meal + '" data-id="' + r.id + '">' + icon('check') + ' Elegir este</button>';
    } else {
      actions = '<button class="btn primary" data-action="use-today" data-id="' + r.id + '">' + icon('calendar') + ' Usar en ' + m.name.toLowerCase() + ' de hoy</button>';
    }
    var where = ctx.k && ctx.mode === 'day' ? m.name + ' · ' + DAY_NAMES[wd(fromKey(ctx.k))] + ' ' + fromKey(ctx.k).getDate() : m.name;
    return '<div class="sheet-head"><span class="sheet-emoji roundel" style="--mc:var(--m-' + r.meal + ')">' + r.emoji + '</span>' +
      '<div class="sheet-titles"><div class="eyebrow">' + where + '</div><h2 id="sheet-title">' + esc(r.name) + '</h2></div>' +
      '<button class="icon-btn" data-action="close-sheet" aria-label="Cerrar">' + icon('x') + '</button></div>' +
      '<div class="sheet-content" style="--mc:var(--m-' + r.meal + ')">' + dishArt(r) + eqChips(m.eq) +
      '<button class="btn cook-btn" data-action="cook-recipe" data-id="' + r.id + '">' + icon('pot') + ' Modo cocina <span class="small muted">paso a paso, con temporizador</span></button>' +
      tasteBtns(r.id) +
      (r.extra
        ? '<div class="banner info">' + icon('info') + '<div>Idea extra de NutriJabón con las mismas porciones de tu ' + m.name.toLowerCase() + '. Coméntala con tu nutrióloga.</div></div>'
        : (pd ? '<p class="small muted">En tu plan: ' + pd + '</p>' : '')) +
      (r.ahead ? '<div class="banner ok">' + icon('clock') + '<div><b>Con anticipación:</b> ' + r.ahead + '</div></div>' : '') +
      '<h3 class="sec-title">Ingredientes</h3><ul class="ing-list">' + r.ing.map(function (i) { return '<li>' + esc(fmtIng(i)) + '</li>'; }).join('') + '</ul>' +
      (r.fruitChoice ? '<div class="fruit-ideas"><div class="small muted">1 porción de fruta puede ser:</div><div class="chips-wrap">' +
        D.FRUIT_IDEAS.map(function (f) { return '<span class="eq-chip">' + f[0] + ' · ' + f[1] + '</span>'; }).join('') + '</div></div>' : '') +
      '<h3 class="sec-title">Preparación</h3><ol class="steps">' + r.steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' +
      (r.tips || []).map(function (t) { return '<div class="banner leaf">' + icon('leaf') + '<div><b>Ojo vegano:</b> ' + t + '</div></div>'; }).join('') +
      (ctx.mode === 'day' && !(isSkipped(ctx.k, m)) ? outLink(r.meal) : '') +
      '</div><div class="sheet-actions">' + actions + '</div>';
  }
  function swapSheet(k, mealId) {
    var m = MEAL[mealId], cur = recipeId(k, mealId), def = defaultRecipe(k, mealId), d = fromKey(k);
    var opts = D.RECIPES.filter(function (r) { return r.meal === mealId; })
      .sort(function (a, b) { return tasteOf(b.id) - tasteOf(a.id); }); // primero tus favoritas, al final las que no te gustan
    function row(r) {
      return '<div class="option' + (r.id === cur ? ' is-current' : '') + '">' +
        '<button class="option-main" data-action="choose-swap" data-k="' + k + '" data-meal="' + mealId + '" data-id="' + r.id + '">' +
        '<span class="roundel">' + r.emoji + '</span><span class="option-text"><b>' + esc(r.name) + '</b><span class="small muted">' +
        (r.id === def ? 'El de tu plan para este día' : r.extra ? 'Idea extra' : 'Otra opción de tu plan') + tasteNote(r.id) + '</span></span>' +
        (r.id === cur ? '<span class="current-mark" aria-label="Elegido">' + icon('check') + '</span>' : '') + '</button>' +
        '<button class="icon-btn" data-action="preview-recipe" data-k="' + k + '" data-id="' + r.id + '" aria-label="Ver receta de ' + esc(r.name) + '">' + icon('book') + '</button></div>';
    }
    return '<div class="sheet-head"><span class="sheet-emoji roundel" style="--mc:var(--m-' + mealId + ')">' + icon('swap') + '</span>' +
      '<div class="sheet-titles"><div class="eyebrow">' + longDate(d) + '</div><h2 id="sheet-title">Cambiar ' + m.name.toLowerCase() + '</h2></div>' +
      '<button class="icon-btn" data-action="close-sheet" aria-label="Cerrar">' + icon('x') + '</button></div>' +
      '<div class="sheet-content" style="--mc:var(--m-' + mealId + ')"><p class="small muted">Todas tienen las mismas porciones (' + eqList(m.eq).join(', ') + '), así que puedes intercambiarlas.</p>' + outLink(mealId) +
      '<h3 class="sec-title">De tu plan</h3><div class="options">' + opts.filter(function (r) { return !r.extra; }).map(row).join('') + '</div>' +
      '<h3 class="sec-title">Ideas extra</h3><div class="options">' + opts.filter(function (r) { return r.extra; }).map(row).join('') + '</div></div>';
  }
  function onboardingSheet() {
    return '<div class="sheet-head"><img class="welcome-cat" src="icons/favicon.svg" width="48" height="48" alt=""><div class="sheet-titles"><div class="eyebrow">NutriJabón</div><h2 id="sheet-title">¡Hola! Armemos tu semana</h2></div></div>' +
      '<div class="sheet-content"><img class="welcome-art" src="art/cocina.jpg" alt=""><p>Aquí verás qué toca comer cada día según tu plan vegano, con recetas, lista de compras y equivalentes.</p>' +
      '<h3 class="sec-title">¿Qué días haces ejercicio?</h3>' + dayChips() +
      '<div class="banner ok">' + icon('dumbbell') + '<div>Los días de ejercicio incluyen tu <b>pre-entreno</b>. Los días de descanso no lo comes. Puedes cambiar esto cuando quieras.</div></div></div>' +
      '<div class="sheet-actions"><button class="btn primary" data-action="finish-onboarding">Empezar</button></div>';
  }

  /* Comer fuera: qué pedir en cada lugar para cubrir las porciones de una comida.
   * Las cantidades salen de tus equivalentes (D.EQUIV) multiplicadas por las porciones de esa comida. */
  var EQ_BY_NAME = {};
  G_ORDER.forEach(function (g) { (D.EQUIV[g] || []).forEach(function (x) { EQ_BY_NAME[g + '|' + x[0]] = x; }); });
  var PORTION_FRAC = { '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4, '⅙': 1 / 6 };
  var UNIT_PL = { pieza: 'piezas', taza: 'tazas', cda: 'cdas', cdita: 'cditas', vasito: 'vasitos', paquete: 'paquetes', mitad: 'mitades' };
  var UNIT_SG = {}; Object.keys(UNIT_PL).forEach(function (k) { UNIT_SG[UNIT_PL[k]] = k; });
  function scalePortion(s, n) { // ('½ taza', 2) → '1 taza'
    var m = /^(\d+)?([½⅓⅔¼¾⅙])?\s+(\S+)(.*)$/.exec(s);
    if (!m || (!m[1] && !m[2])) return n === 1 ? s : n + ' × ' + s;
    var q = ((m[1] ? +m[1] : 0) + (m[2] ? PORTION_FRAC[m[2]] : 0)) * n;
    var base = UNIT_SG[m[3]] || (UNIT_PL[m[3]] ? m[3] : null);
    var word = base ? (q > 1 + 1e-9 ? UNIT_PL[base] : base) : m[3];
    return fmtNum(q, m[3] === 'g' ? 'g' : 'taza') + ' ' + word + m[4];
  }
  function outPlan(place, m) {
    var items = [], missing = [];
    G_ORDER.forEach(function (g) {
      var n = m.eq[g]; if (!n) return;
      var names = (place.opts[g] || []).filter(function (x) { return EQ_BY_NAME[g + '|' + x]; });
      if (!names.length) { missing.push(eqText(g, n)); return; }
      var x = EQ_BY_NAME[g + '|' + names[0]];
      items.push({ g: g, n: n, text: scalePortion(x[1], n) + ' de ' + lowerFirst(x[0]), flag: x[2], alts: names.slice(1).map(lowerFirst) });
    });
    return { items: items, missing: missing };
  }
  function outLink(mealId) {
    return '<button class="out-link" data-action="open-out" data-meal="' + mealId + '">' + icon('fork') +
      '<span><b>¿Comes fuera?</b><span class="small muted">Qué pedir para cubrir tu ' + MEAL[mealId].name.toLowerCase() + '</span></span>' + icon('right', 'ic-sm') + '</button>';
  }
  function outSheet(mealId) {
    var m = MEAL[mealId], places = D.EAT_OUT.places.filter(function (p) { return p.meals.indexOf(mealId) !== -1; });
    return '<div class="sheet-head"><span class="sheet-emoji roundel" style="--mc:var(--m-' + mealId + ')">' + icon('fork') + '</span>' +
      '<div class="sheet-titles"><div class="eyebrow">Comer fuera</div><h2 id="sheet-title">' + m.name + '</h2></div>' +
      '<button class="icon-btn" data-action="close-sheet" aria-label="Cerrar">' + icon('x') + '</button></div>' +
      '<div class="sheet-content" style="--mc:var(--m-' + mealId + ')"><p class="small muted">Tu ' + m.name.toLowerCase() + ' lleva:</p>' + eqChips(m.eq) +
      '<ul class="plain out-tips">' + D.EAT_OUT.tips.map(function (t) { return '<li>' + icon('leaf', 'ic-xs') + '<span>' + t + '</span></li>'; }).join('') + '</ul>' +
      '<div class="out-places">' + places.map(function (p, i) {
        var plan = outPlan(p, m);
        return '<details class="out-place"' + (i === 0 ? ' open' : '') + '><summary><span class="emoji">' + p.emoji + '</span><b>' + p.name + '</b>' + icon('down', 'chev') + '</summary>' +
          '<div class="out-body"><p>' + p.order + '</p><h4 class="sec-title">Para cubrir tu ' + m.name.toLowerCase() + '</h4><ul class="plain out-items">' +
          plan.items.map(function (it) {
            return '<li>' + dot(it.g) + '<div><b>' + esc(it.text) + '</b> <span class="muted small">= ' + eqText(it.g, it.n) + '</span>' +
              (it.flag ? '<span class="flag">' + icon('alert', 'ic-xs') + ' ' + esc(it.flag) + '</span>' : '') +
              (it.alts.length ? '<span class="small muted out-alt">o ' + esc(listText(it.alts, 'o')) + '</span>' : '') + '</div></li>';
          }).join('') + '</ul>' +
          (plan.missing.length ? '<p class="small out-missing">' + icon('alert', 'ic-xs') + ' Aquí es difícil cubrir ' + listText(plan.missing) + '.</p>' : '') +
          '<h4 class="sec-title">Pide o pregunta</h4><ul class="plain out-ask">' + p.ask.map(function (a) { return '<li>' + icon('info', 'ic-xs') + '<span>' + a + '</span></li>'; }).join('') + '</ul></div></details>';
      }).join('') + '</div>' +
      '<p class="small muted">Basado en tus equivalentes veganos. Si algo no se pudo, márcalo con ✗ y “Comí fuera” para comentarlo en tu revisión.</p></div>';
  }
  function outHtml() { // sección de la Guía
    return '<p>Qué pedir en una taquería, fonda, sushi, cafetería y más para cubrir las porciones de cada comida, sin ingredientes animales escondidos.</p>' +
      '<ul class="plain out-tips">' + D.EAT_OUT.tips.map(function (t) { return '<li>' + icon('leaf', 'ic-xs') + '<span>' + t + '</span></li>'; }).join('') + '</ul>' +
      '<h4 class="sec-title">Elige la comida</h4><div class="row-gap">' + sortedMeals().map(function (m) {
        return '<button class="chip-btn" style="--mc:var(--m-' + m.id + ')" data-action="open-out" data-meal="' + m.id + '"><i class="dot" style="--c:var(--m-' + m.id + ')"></i>' + m.name + '</button>';
      }).join('') + '</div>';
  }

  /* Resumen para la revisión con la nutrióloga */
  function reportData() {
    var start = fromKey(D.PLAN.assigned), t = today();
    var all = rangeStats(start, t), weeks = [];
    for (var mon = mondayOf(start); mon <= t; mon = addDays(mon, 7)) {
      var w = rangeStats(mon, addDays(mon, 6));
      if (w.days) weeks.push(w);
    }
    var swaps = Object.keys(all.swaps).map(function (id) { return { r: RECIPE[id], n: all.swaps[id] }; })
      .sort(function (a, b) { return b.n - a.n || a.r.name.localeCompare(b.r.name, 'es'); }).slice(0, 5);
    return { all: all, weeks: weeks, swaps: swaps, streak: streak(), started: t >= start, ck: checkStats(start, t) };
  }
  function countText(x, kind) {
    if (!x.due) return 'aún no toca';
    return x.done + ' de ' + x.due + (x.due ? ' · ' + Math.round(x.done / x.due * 100) + '%' : '') + (x.miss ? ' · ' + x.miss + ' no' + (kind ? whyText(x, kind) : '') : '');
  }
  function whyCounts(x, kind) { // [[id, n], …] de más a menos
    return Object.keys(x.why || {}).filter(function (id) { return REASON_TEXT[kind][id]; })
      .map(function (id) { return [id, x.why[id]]; }).sort(function (a, b) { return b[1] - a[1]; });
  }
  function whyText(x, kind) { // “ (comí fuera ×2, se me olvidó)”
    var w = whyCounts(x, kind).slice(0, 2);
    return w.length ? ' (' + w.map(function (e) { return lowerFirst(REASON_TEXT[kind][e[0]]) + (e[1] > 1 ? ' ×' + e[1] : ''); }).join(', ') + ')' : '';
  }
  function feelHtml(C) { // sección “¿Cómo te sentiste?” del resumen
    if (!C || !C.days) return '<h3 class="sec-title">¿Cómo te sentiste?</h3><p class="small muted">Aún no hay registros. Anótalo cada día al final de Hoy.</p>';
    var ins = checkInsights(C);
    return '<h3 class="sec-title">¿Cómo te sentiste?</h3><p class="small muted">' + C.days + (C.days === 1 ? ' día anotado.' : ' días anotados.') + '</p>' +
      '<ul class="plain meter-list">' + CHECKS.map(function (x) {
        var g = C.f[x.id], a = avg(g), p = a === null ? 0 : Math.round(a / 5 * 100);
        return '<li style="--mc:var(--' + x.color + ')"><div class="meter-top"><b>' + x.name + '</b><span class="muted">' + avgText(x, g) + '</span></div>' +
          '<div class="bar" role="progressbar" aria-label="' + x.name + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p + '"><span style="width:' + p + '%"></span></div></li>';
      }).join('') + '</ul>' +
      (ins.length ? '<ul class="plain out-tips">' + ins.map(function (s) { return '<li>' + icon('info', 'ic-xs') + '<span>' + esc(s) + '</span></li>'; }).join('') + '</ul>' : '') +
      (C.notes.length ? '<h4 class="sec-title">Tus notas</h4><ul class="plain feel-notes">' + C.notes.slice(-10).reverse().map(function (o) {
        return '<li><b>' + shortDate(o.k).replace(/ \d{4}$/, '') + ':</b> ' + esc(o.n) + '</li>';
      }).join('') + '</ul>' : '');
  }
  function reasonsHtml(a) {
    if (!a.miss) return '';
    var w = whyCounts(a, 'meal'), given = w.reduce(function (s, e) { return s + e[1]; }, 0), none = a.miss - given;
    var emoji = {}; REASONS.meal.forEach(function (x) { emoji[x[0]] = x[1]; });
    var rows = w.map(function (e) { return [emoji[e[0]] + ' ' + REASON_TEXT.meal[e[0]], e[1]]; });
    if (none) rows.push(['Sin razón anotada', none]);
    return '<h3 class="sec-title">¿Por qué no se cumplieron?</h3><ul class="plain meter-list reasons">' + rows.map(function (row) {
      return '<li style="--mc:var(--red)"><div class="meter-top"><b>' + row[0] + '</b><span class="muted">' + row[1] + ' de ' + a.miss + '</span></div>' +
        barHtml({ done: row[1], due: a.miss }, row[0]) + '</li>';
    }).join('') + '</ul>';
  }
  function medLabel(md) { return md.name + ' (con ' + MEAL[md.meal].name.toLowerCase() + (md.when === 'train' ? ', días de ejercicio' : '') + ')'; }
  function medsInReport(a) { return (S.settings.meds || []).filter(function (md) { return a.meds[md.id] && a.meds[md.id].due; }); }
  function barHtml(x, label) {
    var p = x.due ? Math.round(x.done / x.due * 100) : 0;
    return '<div class="bar" role="progressbar" aria-label="' + label + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p + '"><span style="width:' + p + '%"></span></div>';
  }
  function reportSheet() {
    var R = reportData(), a = R.all, rev = shortDate(D.PLAN.review).replace(/ \d{4}$/, ''), notes = S.settings.notes || '';
    var head = '<div class="sheet-head"><span class="sheet-emoji roundel" style="--mc:var(--blue)">' + icon('clipboard') + '</span>' +
      '<div class="sheet-titles"><div class="eyebrow">Para tu revisión · ' + rev + '</div><h2 id="sheet-title">Tu resumen</h2></div>' +
      '<button class="icon-btn" data-action="close-sheet" aria-label="Cerrar">' + icon('x') + '</button></div>';
    if (!R.started) {
      return head + '<div class="sheet-content"><p>Tu plan empieza el ' + shortDate(D.PLAN.assigned) + '. Desde ese día verás aquí tu avance.</p></div>';
    }
    var h = head + '<div class="sheet-content">' +
      '<p class="small muted">Plan vegano del ' + rangeText(a.from, a.to) + ' ' + a.to.getFullYear() + ' · ' + a.days + (a.days === 1 ? ' día' : ' días') +
      '. Se basa en lo que marcaste en este dispositivo.</p>' +
      '<div class="stats">' + statTile('yellow', pctText(a), 'de las comidas cumplidas') +
      statTile('green', a.full + '<small>/' + a.days + '</small>', 'días completos') +
      statTile('pink', R.streak, R.streak === 1 ? 'día seguido' : 'días seguidos') + '</div>' +
      '<p class="small">Comidas que ya tocaban: ' + markSummary(a) + ' · ' + a.train + ' ' + (a.train === 1 ? 'día' : 'días') + ' de ejercicio y ' + (a.days - a.train) + ' de descanso.</p>' +
      '<h3 class="sec-title">Por tiempo de comida</h3><ul class="plain meter-list">' + sortedMeals().map(function (m) {
        var x = a.meal[m.id];
        return '<li style="--mc:var(--m-' + m.id + ')"><div class="meter-top"><b>' + m.name + '</b>' + (m.trainingOnly ? ' <span class="badge">días de ejercicio</span>' : '') +
          '<span class="muted">' + countText(x, 'meal') + '</span></div>' + barHtml(x, m.name) + '</li>';
      }).join('') + '</ul>' +
      (medsInReport(a).length ? '<h3 class="sec-title">Vitaminas y medicamentos</h3><ul class="plain meter-list">' + medsInReport(a).map(function (md) {
        var x = a.meds[md.id];
        return '<li style="--mc:var(--m-' + md.meal + ')"><div class="meter-top"><b>' + esc(md.name) + '</b> <span class="badge">con ' + MEAL[md.meal].name.toLowerCase() + '</span>' +
          '<span class="muted">' + countText(x, 'med') + '</span></div>' + barHtml(x, esc(md.name)) + '</li>';
      }).join('') + '</ul>' : '') +
      reasonsHtml(a) + feelHtml(R.ck) + '<h3 class="sec-title">Por semana</h3><ul class="plain meter-list weeks">' + R.weeks.map(function (w) {
        var lbl = rangeText(w.from, w.to);
        return '<li><div class="meter-top"><b>' + lbl + '</b><span class="muted">' + countText(w) + '</span></div>' + barHtml(w, lbl) + '</li>';
      }).join('') + '</ul>' +
      '<h3 class="sec-title">Platillos que elegiste en lugar del plan</h3>' +
      (R.swaps.length ? '<ul class="plain swap-list">' + R.swaps.map(function (x) {
        return '<li><span class="roundel sm" style="--mc:var(--m-' + x.r.meal + ')">' + x.r.emoji + '</span><span>' + esc(x.r.name) + '</span><b>×' + x.n + '</b></li>';
      }).join('') + '</ul>' : '<p class="small muted">Seguiste los platillos de tu plan.</p>') +
      tastesHtml() +
      '<h3 class="sec-title"><label for="notes">Preguntas para tu nutrióloga</label></h3>' +
      '<textarea id="notes" class="notes no-print" rows="4" data-input="notes" placeholder="Ej.: ¿En días de descanso solo quito el pre-entreno?">' + esc(notes) + '</textarea>' +
      '<p id="notes-print" class="print-only notes-print">' + esc(notes) + '</p>' +
      '<p class="small muted no-print">Se guardan solo aquí y salen en el resumen que compartas o imprimas.</p>' +
      '</div>' +
      '<div class="sheet-actions"><button class="btn" data-action="report-share">' + icon('share') + ' Compartir</button>' +
      '<button class="btn primary" data-action="report-print">' + icon('download') + ' Imprimir o PDF</button></div>';
    return h;
  }
  function reportText() {
    var R = reportData(), a = R.all;
    var L = ['Resumen NutriJabón · plan vegano', 'Del ' + rangeText(a.from, a.to) + ' ' + a.to.getFullYear() + ' (' + a.days + (a.days === 1 ? ' día' : ' días') + ')', '',
      'Comidas: ' + markSummary(a) + (a.due ? ' (' + pctText(a) + ')' : ''),
      'Días completos: ' + a.full + ' de ' + a.days + ' · Racha actual: ' + R.streak,
      'Días de ejercicio: ' + a.train + ' · Descanso: ' + (a.days - a.train), '', 'Por tiempo de comida:'];
    sortedMeals().forEach(function (m) { L.push('• ' + m.name + (m.trainingOnly ? ' (días de ejercicio)' : '') + ': ' + countText(a.meal[m.id], 'meal')); });
    var meds = medsInReport(a);
    if (meds.length) {
      L.push('', 'Vitaminas y medicamentos:');
      meds.forEach(function (md) { L.push('• ' + medLabel(md) + ': ' + countText(a.meds[md.id], 'med')); });
    }
    if (a.miss) {
      var w = whyCounts(a, 'meal'), none = a.miss - w.reduce(function (s, e) { return s + e[1]; }, 0);
      L.push('', '¿Por qué no se cumplieron? (' + a.miss + ')');
      w.forEach(function (e) { L.push('• ' + REASON_TEXT.meal[e[0]] + ': ' + e[1]); });
      if (none) L.push('• Sin razón anotada: ' + none);
    }
    var C = R.ck;
    if (C.days) {
      L.push('', '¿Cómo me sentí? (' + C.days + (C.days === 1 ? ' día' : ' días') + ')');
      CHECKS.forEach(function (x) { L.push('• ' + x.name + ': ' + avgText(x, C.f[x.id])); });
      checkInsights(C).forEach(function (s) { L.push('• ' + s); });
      if (C.notes.length) {
        L.push('', 'Mis notas:');
        C.notes.slice(-10).forEach(function (o) { L.push('• ' + shortDate(o.k).replace(/ \d{4}$/, '') + ': ' + o.n); });
      }
    }
    L.push('', 'Por semana:');
    R.weeks.forEach(function (w) { L.push('• ' + rangeText(w.from, w.to) + ': ' + countText(w)); });
    if (R.swaps.length) {
      L.push('', 'Platillos que elegí en lugar del plan:');
      R.swaps.forEach(function (x) { L.push('• ' + x.r.name + ' ×' + x.n); });
    }
    var favs = tasteList(1), nos = tasteList(-1);
    if (favs.length) L.push('', 'Platillos que me gustan:', favs.join(', '));
    if (nos.length) L.push('', 'Platillos que no me gustan:', nos.join(', '));
    var notes = (S.settings.notes || '').trim();
    if (notes) L.push('', 'Preguntas:', notes);
    return L.join('\n');
  }

  /* ---------------- Modo cocina ----------------
   * Pantalla completa, un paso a la vez, letra grande, temporizadores y pantalla siempre encendida.
   * Sirve para una receta o para el prep del domingo (cada paso es una tarea que se palomea). */
  var cook = null, cookTick = null, wakeLock = null, audioCtx = null;
  function plainText(html) { var d = document.createElement('div'); d.innerHTML = html; return d.textContent || ''; }
  function fmtDur(secs) {
    if (secs >= 3600) { var h = Math.floor(secs / 3600), m = Math.round((secs % 3600) / 60); return h + ' h' + (m ? ' ' + m + ' min' : ''); }
    if (secs >= 60) return Math.round(secs / 60) + ' min';
    return secs + ' s';
  }
  function fmtClock(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return (h ? h + ':' + pad(m) : m) + ':' + pad(s % 60);
  }
  function findTimes(text) { // “unos 15 minutos”, “6–8 minutos”, “30 segundos”, “2 horas” → segundos (toma el menor de un rango)
    var out = [], re = /(\d+)(?:\s*(?:a|–|-)\s*\d+)?\s*(minutos?|min\b|horas?|segundos?)/gi, m;
    while ((m = re.exec(text))) {
      var n = +m[1], u = m[2].toLowerCase(), secs = u[0] === 'h' ? n * 3600 : u[0] === 's' ? n : n * 60;
      if (secs > 0 && secs <= 3 * 3600 && out.indexOf(secs) === -1) out.push(secs); // 12 h de remojo no es un temporizador
    }
    return out;
  }
  function startCook(kind, arg) {
    var steps = [];
    if (kind === 'recipe') {
      var r = RECIPE[arg];
      steps.push({ intro: true });
      r.steps.forEach(function (s) { steps.push({ html: s }); });
      cook = { kind: kind, r: r, steps: steps, i: 0, timers: [], checks: {} };
    } else {
      var mon = shopMonday(), wk = keyOf(mon);
      var tasks = buildPrep(mon, false).filter(function (t) { return ['cook', 'chop', 'snack', 'mar'].indexOf(t.sec) !== -1; });
      steps.push({ intro: true });
      tasks.forEach(function (t) { steps.push({ task: t }); });
      cook = { kind: kind, wk: wk, mon: mon, steps: steps, i: 0, timers: [], checks: {} };
    }
    openSheet('cook', []);
    keepAwake(true);
    clearInterval(cookTick);
    cookTick = setInterval(tickTimers, 1000);
  }
  function stopCook() {
    clearInterval(cookTick); cookTick = null;
    keepAwake(false);
    cook = null;
  }
  function keepAwake(on) {
    if (!on) { if (wakeLock) { try { wakeLock.release(); } catch (e) { /* ignorar */ } } wakeLock = null; return; }
    if (!cook) return;
    if (!('wakeLock' in navigator)) { cook.wake = 'no'; updateWakeNote(); return; }
    navigator.wakeLock.request('screen').then(function (l) {
      wakeLock = l; if (cook) { cook.wake = 'on'; updateWakeNote(); }
      l.addEventListener('release', function () { if (cook && wakeLock === l) { cook.wake = 'off'; updateWakeNote(); } });
    }, function () { if (cook) { cook.wake = 'no'; updateWakeNote(); } });
  }
  function updateWakeNote() {
    var el = document.getElementById('cook-wake'); if (!el || !cook) return;
    el.textContent = cook.wake === 'on' ? '☀️ Pantalla encendida' : cook.wake === 'no' ? 'Tu navegador no deja mantener la pantalla encendida' : '';
  }
  function stepTitle(st) {
    if (cook.kind === 'recipe') return st.intro ? 'Antes de empezar' : 'Paso ' + cook.steps.indexOf(st) + ' de ' + (cook.steps.length - 1);
    if (st.intro) return 'Antes de empezar';
    var sec = PREP_SECS.filter(function (x) { return x[0] === st.task.sec; })[0];
    return sec[2].replace(/^Domingo: (.)/, function (x, c) { return c.toUpperCase(); });
  }
  function cookSheet() {
    if (!cook) return '';
    var st = cook.steps[cook.i], last = cook.i === cook.steps.length - 1, done = cook.kind === 'prep' && st.task && !!(S.prep[cook.wk] || {})[st.task.id];
    var title = cook.kind === 'recipe' ? cook.r.emoji + ' ' + esc(cook.r.name) : '🍲 Prep del domingo';
    var body = '', times = [];
    if (cook.kind === 'recipe' && st.intro) {
      var r = cook.r;
      body = '<p class="cook-lead">Junta todo antes de prender la estufa:</p><ul class="plain cook-ings">' + r.ing.map(function (ing, n) {
        var c = !!cook.checks[n];
        return '<li><label class="cook-ing' + (c ? ' is-checked' : '') + '"><input type="checkbox" data-input="cook-ing" data-n="' + n + '"' + (c ? ' checked' : '') + '><span>' + esc(fmtIng(ing)) + '</span></label></li>';
      }).join('') + '</ul>' +
        (r.ahead ? '<div class="banner ok">' + icon('clock') + '<div><b>Con anticipación:</b> ' + r.ahead + '</div></div>' : '') +
        (r.tips || []).map(function (t) { return '<div class="banner leaf">' + icon('leaf') + '<div><b>Ojo vegano:</b> ' + t + '</div></div>'; }).join('');
    } else if (cook.kind === 'prep' && st.intro) {
      var n = cook.steps.length - 1, nd = cook.steps.filter(function (x) { return x.task && (S.prep[cook.wk] || {})[x.task.id]; }).length;
      body = '<p class="cook-lead">' + (n ? n + ' tareas para la semana del ' + rangeText(cook.mon, addDays(cook.mon, 6)) + (nd ? ' (' + nd + ' ya hechas)' : '') + '.' : 'Esta semana no hay nada que adelantar.') + '</p>' +
        '<ul class="plain out-tips"><li>' + icon('clock', 'ic-xs') + '<span>Empieza por lo que tarda más (leguminosas, arroz y pasta) y pica mientras se cuece.</span></li>' +
        '<li>' + icon('leaf', 'ic-xs') + '<span>Refrigera lo cocido en cuanto se enfríe. Lo de jueves a domingo, congélalo en porciones.</span></li></ul>';
    } else if (st.task) {
      var t = st.task;
      body = '<p class="cook-task' + (done ? ' is-done' : '') + '">' + (t.emoji ? t.emoji + ' ' : '') + esc(t.title) + '</p>' +
        '<p class="cook-meta">' + esc(t.meta) + '</p><div class="cook-step">' + t.how + '</div>';
      times = findTimes(plainText(t.how));
    } else {
      body = '<div class="cook-step">' + st.html + '</div>';
      times = findTimes(plainText(st.html));
    }
    var progress = '<div class="cook-dots" aria-hidden="true">' + cook.steps.map(function (x, n) {
      var cls = n === cook.i ? ' is-on' : (cook.kind === 'prep' && x.task && (S.prep[cook.wk] || {})[x.task.id]) || (cook.kind === 'recipe' && n < cook.i) ? ' is-past' : '';
      return '<i class="' + cls.trim() + '"></i>';
    }).join('') + '</div>';
    var timerBtns = (times.length ? times.map(function (s) {
      return '<button class="chip-btn cook-tbtn" data-action="cook-timer" data-s="' + s + '">' + icon('clock', 'ic-sm') + ' ' + fmtDur(s) + '</button>';
    }).join('') : '') +
      '<details class="cook-more"><summary>Otro temporizador</summary><div class="row-gap">' + [5, 10, 20, 40, 60].map(function (m) {
        return '<button class="chip-btn" data-action="cook-timer" data-s="' + m * 60 + '">' + m + ' min</button>';
      }).join('') + '</div></details>';
    var next = cook.kind === 'prep' && st.task
      ? (done ? (last ? 'Terminar' : 'Siguiente') : (last ? 'Hecho y terminar' : 'Hecho'))
      : (last ? '¡Listo!' : st.intro ? 'Empezar' : 'Siguiente');
    return '<div class="cook-head"><button class="icon-btn" data-action="cook-close" aria-label="Salir del modo cocina">' + icon('x') + '</button>' +
      '<div class="cook-titles"><div class="eyebrow">Modo cocina · ' + stepTitle(st) + '</div><h2 id="sheet-title">' + title + '</h2></div></div>' +
      progress + '<div id="cook-timers" class="cook-timers" aria-live="polite">' + timersHtml() + '</div>' +
      '<div class="cook-main" aria-live="polite">' + body + '<div class="cook-tools">' + timerBtns + '</div></div>' +
      '<div class="cook-nav"><span id="cook-wake" class="cook-wake small muted"></span>' +
      '<button class="btn" data-action="cook-prev"' + (cook.i ? '' : ' disabled') + '>' + icon('left') + ' Anterior</button>' +
      '<button class="btn primary" data-action="cook-next">' + next + ' ' + (last ? icon('check') : icon('right')) + '</button></div>';
  }
  function timersHtml() {
    if (!cook || !cook.timers.length) return '';
    var now = Date.now();
    return cook.timers.map(function (t) {
      var left = t.end - now, over = left <= 0;
      return '<span class="cook-timer' + (over ? ' is-done' : '') + '">' + icon('clock', 'ic-sm') + '<b>' + (over ? '¡Tiempo!' : fmtClock(left)) + '</b>' +
        '<span class="small">' + esc(t.label) + '</span><button class="cook-tx" data-action="cook-timer-off" data-id="' + t.id + '" aria-label="Quitar temporizador">' + icon('x') + '</button></span>';
    }).join('') + '<span class="small muted cook-tnote">Deja la app abierta para que suene.</span>';
  }
  function tickTimers() {
    if (!cook) return;
    var now = Date.now();
    cook.timers.forEach(function (t) { if (!t.rang && t.end <= now) { t.rang = true; ring(t); } });
    var el = document.getElementById('cook-timers'); if (el) el.innerHTML = timersHtml();
  }
  function addTimer(secs) {
    if (!cook) return;
    try { // el sonido se “desbloquea” con este toque
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { audioCtx = null; }
    var st = cook.steps[cook.i], label = cook.kind === 'recipe' ? (st.intro ? fmtDur(secs) : 'Paso ' + cook.i + ' · ' + fmtDur(secs)) : (st.task ? st.task.title + ' · ' : '') + fmtDur(secs);
    cook.timers.push({ id: 't' + Date.now(), label: label, end: Date.now() + secs * 1000 });
    tickTimers();
    toast('Temporizador de ' + fmtDur(secs));
  }
  function ring(t) {
    toast('⏱ ¡Tiempo! ' + t.label);
    if (navigator.vibrate) { try { navigator.vibrate([300, 150, 300, 150, 300]); } catch (e) { /* ignorar */ } }
    if (!audioCtx) return;
    try {
      [0, 0.45, 0.9].forEach(function (at) {
        var o = audioCtx.createOscillator(), g = audioCtx.createGain(), t0 = audioCtx.currentTime + at;
        o.type = 'square'; o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
        o.connect(g); g.connect(audioCtx.destination); o.start(t0); o.stop(t0 + 0.4);
      });
    } catch (e) { /* sin sonido */ }
  }
  // byButton: solo el botón “Hecho · siguiente” palomea y termina; deslizar o las flechas solo navegan
  function cookGo(d, byButton) {
    if (!cook) return;
    var st = cook.steps[cook.i], last = cook.i === cook.steps.length - 1;
    if (d > 0 && byButton && cook.kind === 'prep' && st.task) {
      S.prep[cook.wk] = S.prep[cook.wk] || {};
      S.prep[cook.wk][st.task.id] = true; save();
    }
    if (d > 0 && last) { if (byButton) finishCook(); return; }
    if (d < 0 && cook.i === 0) return;
    cook.i = Math.max(0, Math.min(cook.steps.length - 1, cook.i + d));
    renderSheet(); sheetBox.scrollTop = 0; updateWakeNote();
  }
  function finishCook() {
    var kind = cook.kind, done = S.prep[cook.wk] || {};
    var tasks = cook.steps.filter(function (x) { return x.task; }), nd = tasks.filter(function (x) { return done[x.task.id]; }).length;
    closeSheet();
    toast(kind === 'recipe' ? '¡Buen provecho! Márcala cuando la comas ✓'
      : nd === tasks.length ? '¡Prep listo! Tu semana ya está adelantada 🎉' : 'Llevas ' + nd + ' de ' + tasks.length + ' tareas del domingo');
  }
  function runningTimers() { return cook ? cook.timers.filter(function (t) { return t.end > Date.now(); }).length : 0; }

  var sheetEl, sheetBox, sheetBody, sheet = null, lastFocus = null;
  var SHEETS = { recipe: recipeSheet, swap: swapSheet, onboarding: onboardingSheet, report: reportSheet, out: outSheet, cook: cookSheet, recap: recapSheet, import: importSheet };
  function openSheet(type, args) {
    var wasOpen = !!sheet;
    if (!wasOpen) lastFocus = document.activeElement;
    sheet = { type: type, args: args };
    renderSheet();
    sheetEl.hidden = false;
    document.body.classList.add('no-scroll');
    sheetBox.scrollTop = 0;
    sheetBox.focus({ preventScroll: true });
    if (!wasOpen) { try { history.pushState({ njSheet: 1 }, ''); } catch (e) { /* ignorar */ } }
  }
  function renderSheet() {
    if (!sheet) return;
    sheetBox.dataset.kind = sheet.type;
    var isCook = sheet.type === 'cook';
    sheetBox.classList.toggle('is-cook', isCook); sheetEl.classList.toggle('cook', isCook);
    sheetBody.innerHTML = SHEETS[sheet.type].apply(null, sheet.args);
    if (isCook) updateWakeNote();
  }
  function closeSheet(fromPop) {
    if (!sheet) return;
    if (sheet.type === 'onboarding') { S.settings.onboarded = true; save(); }
    var wasCook = sheet.type === 'cook';
    if (wasCook) stopCook();
    sheetBox.classList.remove('is-cook'); sheetEl.classList.remove('cook');
    if (wasCook && ui.tab === 'compras') setTimeout(render, 0); // refleja lo palomeado en el prep
    sheet = null;
    sheetEl.hidden = true;
    document.body.classList.remove('no-scroll');
    if (!fromPop && history.state && history.state.njSheet) { try { history.back(); } catch (e) { /* ignorar */ } }
    if (lastFocus && document.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignorar */ } }
  }

  /* ---------------- Acciones ---------------- */
  function setEx(k, v) {
    var def = defaultTraining(k);
    setDay(k, function (r) { if (v === def) delete r.ex; else r.ex = v; });
    render();
    toast(v ? 'Día de ejercicio: con pre-entreno' : 'Día de descanso: sin pre-entreno');
  }
  // v: true = sí cumplí, false = no cumplí; repetir la misma marca la quita
  function setMark(field, k, id, v) {
    var wasFull = isFullDay(k);
    var whyField = field === 'tk' ? 'twhy' : 'why';
    setDay(k, function (r) {
      r[field] = r[field] || {};
      if (r[field][id] === v) delete r[field][id]; else r[field][id] = v;
      if (r[field][id] !== false && r[whyField]) delete r[whyField][id]; // la razón solo vale para ✗
    });
    if (sheet) renderSheet();
    render();
    if (v && !wasFull && isFullDay(k)) toast('¡Día completo! 🎉');
    else if (v === false && (field === 'tk' ? medMark(k, id) : markOf(k, id)) === false) toast('Anotado. Si quieres, elige por qué');
  }
  function setWhy(kind, k, id, reason) {
    var field = kind === 'med' ? 'twhy' : 'why';
    if (!REASON_TEXT[kind][reason]) return;
    setDay(k, function (r) {
      r[field] = r[field] || {};
      if (r[field][id] === reason) delete r[field][id]; else r[field][id] = reason;
    });
    render();
  }
  function chooseSwap(k, mealId, id) {
    var def = defaultRecipe(k, mealId);
    setDay(k, function (r) {
      r.sw = r.sw || {};
      if (id === def) delete r.sw[mealId]; else r.sw[mealId] = id;
    });
    closeSheet();
    render();
    toast(MEAL[mealId].name + ': ' + RECIPE[id].name);
  }
  function toggleTrainDay(i) {
    var a = S.settings.trainDays, idx = a.indexOf(i);
    if (idx === -1) a.push(i); else a.splice(idx, 1);
    a.sort();
    save();
    if (sheet) renderSheet();
    render();
  }

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  /* ---------------- Render ---------------- */
  var VIEWS = { hoy: viewHoy, semana: viewSemana, recetas: viewRecetas, compras: viewCompras, guia: viewGuia };
  var TABS = [['hoy', 'Hoy', 'sun'], ['semana', 'Semana', 'calendar'], ['recetas', 'Recetas', 'book'], ['compras', 'Compras', 'cart'], ['guia', 'Guía', 'guide']];
  var mainEl;
  function render() {
    mainEl.dataset.view = ui.tab;
    mainEl.innerHTML = VIEWS[ui.tab]();
    document.querySelectorAll('.tab').forEach(function (b) {
      if (b.dataset.tab === ui.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    var t = today(), tk = keyOf(t);
    document.getElementById('subtitle').textContent = DAY_ABBR[wd(t)] + ' ' + t.getDate() + ' ' + MONTHS_ABBR[t.getMonth()] + ' · ' + (isTraining(tk) ? 'día de ejercicio' : 'descanso');
  }
  function setTab(t) { ui.tab = t; render(); window.scrollTo(0, 0); }

  function onClick(e) {
    if (e.target === sheetEl) { closeSheet(); return; }
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var ds = el.dataset;
    switch (ds.action) {
      case 'tab': setTab(ds.tab); break;
      case 'day-shift': {
        var nd = addDays(viewDate(), +ds.n), nk = keyOf(nd);
        ui.date = nk === keyOf(today()) ? null : nk; render(); break;
      }
      case 'day-today': ui.date = null; render(); break;
      case 'goto-day': ui.date = ds.k === keyOf(today()) ? null : ds.k; setTab('hoy'); break;
      case 'set-ex': setEx(currentKey(), ds.v === '1'); break;
      case 'reset-ex': setDay(currentKey(), function (r) { delete r.ex; }); render(); break;
      case 'toggle-ex': setEx(ds.k, !isTraining(ds.k)); break;
      case 'mark': if (ds.close) closeSheet(); setMark('done', ds.k, ds.meal, ds.v === '1'); break;
      case 'mark-med': setMark('tk', ds.k, ds.id, ds.v === '1'); break;
      case 'why': setWhy(ds.kind, ds.k, ds.id, ds.r); break;
      case 'open-out': openSheet('out', [ds.meal]); break;
      case 'open-recap': openSheet('recap', [ds.mon]); break;
      case 'recap-seen': S.settings.recapSeen = ds.wk; save(); render(); break;
      case 'ck': setCheck(ds.k, ds.f, +ds.v); break;
      case 'taste': setTaste(ds.id, +ds.v); break;
      case 'share-day': shareDay(ds.k); break;
      case 'share-week': shareWeek(fromKey(ds.mon)); break;
      case 'pantry': togglePantry(ds.n); break;
      case 'goto-checkin': { var ckEl = document.getElementById('checkin'); if (ckEl) ckEl.scrollIntoView({ block: 'start', behavior: 'smooth' }); break; }
      case 'import-merge': finishImport(true); break;
      case 'import-replace': finishImport(false); break;
      case 'cook-recipe': startCook('recipe', ds.id); break;
      case 'cook-prep': startCook('prep'); break;
      case 'cook-next': cookGo(1, true); break;
      case 'cook-prev': cookGo(-1); break;
      case 'cook-timer': addTimer(+ds.s); break;
      case 'cook-timer-off':
        if (cook) { cook.timers = cook.timers.filter(function (t) { return t.id !== ds.id; }); tickTimers(); }
        break;
      case 'cook-close':
        if (runningTimers() && !window.confirm('Tienes un temporizador corriendo. ¿Salir del modo cocina?')) break;
        closeSheet(); if (ui.tab === 'compras') render();
        break;
      case 'meds-seen': S.settings.medsSeen = true; save(); render(); break;
      case 'med-add': addMed(); break;
      case 'med-del': delMed(ds.id); break;
      case 'open-recipe': openSheet('recipe', [ds.id, ds.k ? { mode: 'day', k: ds.k } : { mode: 'browse' }]); break;
      case 'preview-recipe': openSheet('recipe', [ds.id, { mode: 'choose', k: ds.k }]); break;
      case 'open-swap': openSheet('swap', [ds.k, ds.meal]); break;
      case 'choose-swap': chooseSwap(ds.k, ds.meal, ds.id); break;
      case 'use-today': { var r = RECIPE[ds.id]; chooseSwap(keyOf(today()), r.meal, r.id); break; }
      case 'close-sheet': closeSheet(); break;
      case 'week-day': ui.weekDay = +ds.v; render(); break;
      case 'guide-mode': ui.guideMode = ds.v; render(); break;
      case 'week-shift': ui.weekOffset += +ds.n; render(); break;
      case 'shop-shift': ui.shopOffset += +ds.n; render(); break;
      case 'shop-view': ui.shopView = ds.v === 'prep' ? 'prep' : 'list'; render(); break;
      case 'goto-prep': ui.shopView = 'prep'; ui.shopOffset = wd(today()) >= 5 ? 1 : 0; setTab('compras'); break;
      case 'rfilter': ui.rFilter = ds.v; render(); break;
      case 'shop-share': shareShopping(); break;
      case 'shop-clear': delete S.shop[keyOf(shopMonday())]; save(); render(); break;
      case 'toggle-train-day': toggleTrainDay(+ds.i); break;
      case 'finish-onboarding': S.settings.onboarded = true; save(); closeSheet(); render(); break;
      case 'goto-settings': gotoSection('ajustes'); break;
      case 'goto-sec': gotoSection(ds.sec); break;
      case 'add-calendar': addToCalendar(); break;
      case 'backup-save': saveBackup(); break;
      case 'backup-send': sendBackup(); break;
      case 'open-report': openSheet('report', []); break;
      case 'report-share': shareText('Resumen NutriJabón', reportText(), 'Resumen copiado'); break;
      case 'report-print': window.print(); break;
      case 'reset-times': S.settings.times = {}; save(); render(); toast('Horarios del plan restaurados'); break;
      case 'reset-all':
        if (window.confirm('¿Borrar tus marcas de comidas, cambios de platillos, la lista de compras y el prep? Tus días de ejercicio, horarios y medicamentos se quedan.')) {
          S.days = {}; S.shop = {}; S.prep = {}; save(); render(); toast('Listo, datos borrados');
        }
        break;
      case 'install':
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then(function () { deferredPrompt = null; render(); }, function () { deferredPrompt = null; });
        }
        break;
    }
  }
  function onInput(e) {
    var el = e.target, t = el.dataset && el.dataset.input;
    if (t === 'rq') { ui.rQuery = el.value; document.getElementById('recipe-results').innerHTML = recipeResults(); }
    else if (t === 'eq') { ui.eqQuery = el.value; document.getElementById('eq-results').innerHTML = eqResults(); }
    else if (t === 'ck-note') { // se guarda al escribir, sin volver a pintar la pantalla
      var nk = el.dataset.k, nv = el.value.slice(0, 300);
      setDay(nk, function (r) { r.ck = r.ck || {}; if (nv.trim()) r.ck.n = nv; else delete r.ck.n; });
    }
    else if (t === 'notes') {
      S.settings.notes = el.value.slice(0, 2000);
      if (!S.settings.notes) delete S.settings.notes;
      save();
      var np = document.getElementById('notes-print');
      if (np) np.textContent = el.value;
    }
  }
  function onChange(e) {
    var el = e.target, t = el.dataset && el.dataset.input;
    if (t === 'day-type') setEx(currentKey(), el.value === '1');
    else if (t === 'extras') { ui.extras = el.checked; document.getElementById('recipe-results').innerHTML = recipeResults(); }
    else if (t === 'shop') {
      var wk = el.dataset.wk, n = el.dataset.n;
      S.shop[wk] = S.shop[wk] || {};
      if (el.checked) S.shop[wk][n] = true; else delete S.shop[wk][n];
      if (!Object.keys(S.shop[wk]).length) delete S.shop[wk];
      save();
      el.closest('.shop-item').classList.toggle('is-checked', el.checked);
      updateShopCount();
    } else if (t === 'time') {
      var id = el.dataset.meal;
      if (!el.value) return;
      if (el.value === MEAL[id].time) delete S.settings.times[id]; else S.settings.times[id] = el.value;
      save();
    } else if (t === 'cook-ing') {
      if (cook) cook.checks[el.dataset.n] = el.checked;
      el.closest('.cook-ing').classList.toggle('is-checked', el.checked);
    } else if (t === 'prep') {
      var pw = el.dataset.wk, pid = el.dataset.id;
      S.prep[pw] = S.prep[pw] || {};
      if (el.checked) S.prep[pw][pid] = true; else delete S.prep[pw][pid];
      if (!Object.keys(S.prep[pw]).length) delete S.prep[pw];
      save();
      el.closest('.prep-item').classList.toggle('is-checked', el.checked);
      updatePrepCount();
    } else if (t === 'med-meal' || t === 'med-when') {
      (S.settings.meds || []).forEach(function (md) {
        if (md.id !== el.dataset.id) return;
        if (t === 'med-meal' && MEAL[el.value]) md.meal = el.value;
        if (t === 'med-when') md.when = el.value === 'train' ? 'train' : 'all';
      });
      save();
      var row = el.closest('.med-row');
      if (row && t === 'med-meal') row.style.setProperty('--mc', 'var(--m-' + el.value + ')');
    } else if (t === 'lead') {
      S.settings.remindLead = +el.value; save();
    } else if (t === 'backup') {
      var f = el.files && el.files[0];
      el.value = '';
      if (f) importBackup(f);
    }
  }
  function gotoSection(id) {
    if (id === 'tomas' && !S.settings.medsSeen) { S.settings.medsSeen = true; save(); }
    closeSheet(); ui.open[id] = true; setTab('guia');
    var sec = document.getElementById('sec-' + id);
    if (sec) sec.scrollIntoView({ block: 'start' });
  }

  /* ---------------- Inicio ---------------- */
  function init() {
    mainEl = document.getElementById('view');
    sheetEl = document.getElementById('sheet');
    sheetBox = sheetEl.querySelector('.sheet');
    sheetBody = document.getElementById('sheet-body');

    document.getElementById('tabs').innerHTML = TABS.map(function (t) {
      return '<button class="tab" data-action="tab" data-tab="' + t[0] + '">' + icon(t[2]) + '<span>' + t[1] + '</span></button>';
    }).join('');
    document.getElementById('settings-btn').innerHTML = icon('paw');

    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('toggle', function (e) {
      var id = e.target && e.target.dataset && e.target.dataset.acc;
      if (id) ui.open[id] = e.target.open;
    }, true);
    document.addEventListener('keydown', function (e) {
      if (cook && sheet && sheet.type === 'cook' && !/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) {
        if (e.key === 'ArrowRight') { e.preventDefault(); cookGo(1); return; }
        if (e.key === 'ArrowLeft') { e.preventDefault(); cookGo(-1); return; }
      }
      if (e.key === 'Escape' && sheet) { if (sheet.type === 'cook' && runningTimers() && !window.confirm('Tienes un temporizador corriendo. ¿Salir del modo cocina?')) return; closeSheet(); }
      if (e.key === 'Enter' && e.target && e.target.id === 'med-name') { e.preventDefault(); addMed(); }
    });
    window.addEventListener('popstate', function () { if (sheet) closeSheet(true); });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && !sheet) render();
      if (!document.hidden && cook) { keepAwake(true); tickTimers(); } // al volver: pantalla encendida y avisa si ya sonó
    });
    // Modo cocina: deslizar a la izquierda/derecha cambia de paso
    var touchX = null, touchY = null;
    sheetEl.addEventListener('touchstart', function (e) { if (cook) { touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; } }, { passive: true });
    sheetEl.addEventListener('touchend', function (e) {
      if (!cook || touchX == null) return;
      var dx = e.changedTouches[0].clientX - touchX, dy = e.changedTouches[0].clientY - touchY;
      touchX = null;
      if (Math.abs(dx) > 70 && Math.abs(dy) < 50) cookGo(dx < 0 ? 1 : -1);
    }, { passive: true });
    setInterval(function () { if (ui.tab === 'hoy' && !sheet && !document.hidden) render(); }, 60000);

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault(); deferredPrompt = e;
      if (ui.tab === 'guia') render();
    });
    window.addEventListener('appinstalled', function () { deferredPrompt = null; toast('¡App instalada!'); });

    // Una sola vez: la vitamina también va en días de descanso (antes venía solo en días de ejercicio)
    if (!S.settings.vitAllDays) {
      (S.settings.meds || []).forEach(function (md) { if (md.id === 'vit' && md.when === 'train') md.when = 'all'; });
      S.settings.vitAllDays = true;
      save();
    }

    // Accesos directos del ícono (mantener presionado): ?tab=compras&view=prep, etc.
    try {
      var qs = new URLSearchParams(location.search), qt = qs.get('tab');
      if (qt && VIEWS[qt]) {
        ui.tab = qt;
        if (qt === 'compras' && qs.get('view') === 'prep') ui.shopView = 'prep';
        history.replaceState(null, '', location.pathname); // deja la dirección limpia
      }
    } catch (e) { /* navegador sin URLSearchParams */ }

    render();
    if (!S.settings.onboarded) openSheet('onboarding', []);

    // En la app instalada, pide que el navegador no borre los datos por falta de espacio
    if (isStandalone() && navigator.storage && navigator.storage.persist && navigator.storage.persisted) {
      navigator.storage.persisted().then(function (p) { return p || navigator.storage.persist(); }).catch(function () { /* ignorar */ });
    }

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* sin SW */ }); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
