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
  var DEFAULT_SETTINGS = { trainDays: [0, 1, 2, 3, 4], times: {}, onboarded: false };

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        return {
          settings: Object.assign({}, DEFAULT_SETTINGS, p.settings || {}),
          days: p.days || {},
          shop: p.shop || {}
        };
      }
    } catch (e) { /* almacenamiento no disponible */ }
    return { settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), days: {}, shop: {} };
  }
  var S = load();
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* ignorar */ } }

  var ui = {
    tab: 'hoy', date: null, weekOffset: 0, shopOffset: wd(today()) >= 5 ? 1 : 0,
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
    sliders: '<path d="M6 2.5v19M12 2.5v19M18 2.5v19"/><rect class="p" x="3.3" y="12.4" width="5.4" height="4.4" rx="1.6"/><rect class="y" x="9.3" y="5.4" width="5.4" height="4.4" rx="1.6"/><rect class="g" x="15.3" y="14.4" width="5.4" height="4.4" rx="1.6"/>',
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
    if (Object.keys(r).length) S.days[k] = r; else delete S.days[k];
    save();
  }
  function defaultTraining(k) { return S.settings.trainDays.indexOf(wd(fromKey(k))) !== -1; }
  function isTraining(k) { var r = dayRec(k); return typeof r.ex === 'boolean' ? r.ex : defaultTraining(k); }
  function defaultRecipe(k, mealId) { return D.WEEK[mealId][wd(fromKey(k))]; }
  function recipeId(k, mealId) { var r = dayRec(k); return (r.sw && r.sw[mealId]) || defaultRecipe(k, mealId); }
  function isSkipped(k, m) { return !!m.trainingOnly && !isTraining(k); }
  function isDone(k, mealId) { var r = dayRec(k); return !!(r.done && r.done[mealId]); }
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
      if (isSkipped(k, m) || isDone(k, m.id)) continue;
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

  /* ---------------- Vista: Hoy ---------------- */
  function viewHoy() {
    var d = viewDate(), k = keyOf(d), isToday = k === keyOf(today());
    var diff = dayDiff(d, today());
    var eyebrow = isToday ? 'Hoy' : diff === 1 ? 'Mañana' : diff === -1 ? 'Ayer' : diff > 0 ? 'En ' + diff + ' días' : 'Hace ' + (-diff) + ' días';
    var train = isTraining(k), overridden = typeof dayRec(k).ex === 'boolean';
    var meals = sortedMeals();
    var active = meals.filter(function (m) { return !isSkipped(k, m); });
    var done = active.filter(function (m) { return isDone(k, m.id); }).length;
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
      '<div class="segmented" role="radiogroup" aria-label="Tipo de día">' +
      '<button role="radio" class="seg-train" aria-checked="' + train + '" data-action="set-ex" data-v="1">' + icon('dumbbell') + ' Día de ejercicio</button>' +
      '<button role="radio" class="seg-rest" aria-checked="' + !train + '" data-action="set-ex" data-v="0">' + icon('moon') + ' Descanso</button>' +
      '</div>' +
      '<p class="hint">' + (overridden
        ? 'Cambiado solo para este día · <button class="link-btn" data-action="reset-ex">usar mis días</button>'
        : 'Según tus días de ejercicio · <button class="link-btn" data-action="goto-settings">editar</button>') + '</p>' +
      '</section>';

    h += train
      ? '<div class="banner ok">' + icon('dumbbell') + '<div><b>Día de ejercicio:</b> incluye tu pre-entreno (' + esc(pre.name) + ') antes de entrenar.</div></div>'
      : '<div class="banner warn">' + icon('ban') + '<div><b>Día de descanso: no comas el pre-entreno</b> (' + esc(pre.name) + '). Son 1 fruta, 1 cereal y 1 grasa con proteína menos. Todo lo demás sigue igual.</div></div>';

    h += '<div class="progress"><div class="progress-top"><span><b>' + done + '</b> de ' + active.length + ' comidas</span>' +
      '<span class="muted">' + (done === active.length && done ? '¡Día completo! 🎉' : pct + '%') + '</span></div>' +
      '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="width:' + pct + '%"></span></div></div>';

    h += '<ol class="meals">' + meals.map(function (m) { return mealItem(k, m, next); }).join('') + '</ol>';

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

    return h + '</div>';
  }

  function mealItem(k, m, next) {
    var rid = recipeId(k, m.id), r = RECIPE[rid], t = mealTime(m.id);
    var clock = '<span class="meal-clock">' + t + '</span>';
    var mc = ' style="--mc:var(--m-' + m.id + ')"';
    if (isSkipped(k, m)) {
      return '<li class="meal is-skipped"><article class="meal-card"' + mc + '><div class="meal-main">' +
        '<div class="meal-top">' + clock + '<span class="meal-name">' + m.name + '</span><span class="badge warn">No toca hoy</span></div>' +
        '<div class="dish struck"><span class="roundel">' + r.emoji + '</span><span>' + esc(r.name) + '</span></div>' +
        '<p class="small muted">Solo en días de ejercicio. <button class="link-btn" data-action="set-ex" data-v="1">¿Sí hiciste ejercicio?</button></p>' +
        '</div></article></li>';
    }
    var done = isDone(k, m.id), isNext = next && next.id === m.id;
    var badges = (isNext ? '<span class="badge primary">' + (next.now ? 'Toca ahora' : 'Siguiente') + '</span>' : '') +
      (m.trainingOnly ? '<span class="badge">Antes de entrenar</span>' : '') +
      (rid !== defaultRecipe(k, m.id) ? '<span class="badge">Cambiado</span>' : '') +
      (r.extra ? '<span class="badge">Idea extra</span>' : '');
    return '<li class="meal' + (done ? ' is-done' : '') + (isNext ? ' is-next' : '') + '">' +
      '<article class="meal-card"' + mc + '><div class="meal-main">' +
      '<div class="meal-top">' + clock + '<span class="meal-name">' + m.name + '</span>' + badges + '</div>' +
      '<button class="dish" data-action="open-recipe" data-id="' + r.id + '" data-k="' + k + '" data-meal="' + m.id + '"><span class="roundel">' + r.emoji + '</span><span class="dish-name">' + esc(r.name) + '</span>' + icon('right', 'ic-sm') + '</button>' +
      eqChips(m.eq) +
      '<div class="meal-actions"><button class="chip-btn" data-action="open-recipe" data-id="' + r.id + '" data-k="' + k + '" data-meal="' + m.id + '">' + icon('book', 'ic-sm') + ' Ver receta</button>' +
      '<button class="chip-btn" data-action="open-swap" data-k="' + k + '" data-meal="' + m.id + '">' + icon('swap', 'ic-sm') + ' Cambiar</button></div>' +
      '</div>' +
      '<button class="check" role="checkbox" aria-checked="' + done + '" aria-label="' + (done ? 'Desmarcar ' : 'Marcar como comido: ') + m.name + '" data-action="toggle-done" data-k="' + k + '" data-meal="' + m.id + '">' + icon('check') + '</button>' +
      '</article></li>';
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
    var h = '<div class="stack">' + weekNav('week', mon, ui.weekOffset);
    h += '<p class="hint center">' + nTrain + (nTrain === 1 ? ' día' : ' días') + ' de ejercicio · ' + (7 - nTrain) + ' de descanso. Toca la etiqueta de un día para cambiarlo.</p>';
    h += '<div class="week-grid">' + days.map(function (d) {
      var k = keyOf(d), train = isTraining(k);
      return '<article class="card day-card' + (k === tk ? ' is-today' : '') + '">' +
        '<header class="day-card-head"><button class="day-link" data-action="goto-day" data-k="' + k + '"><b>' + DAY_NAMES[wd(d)] + '</b> <span class="muted">' + d.getDate() + ' ' + MONTHS_ABBR[d.getMonth()] + '</span>' + (k === tk ? ' <span class="badge primary">Hoy</span>' : '') + '</button>' +
        '<button class="pill ' + (train ? 'pill-train' : 'pill-rest') + '" data-action="toggle-ex" data-k="' + k + '" aria-label="Cambiar a ' + (train ? 'descanso' : 'día de ejercicio') + '">' + icon(train ? 'dumbbell' : 'moon', 'ic-sm') + (train ? 'Ejercicio' : 'Descanso') + '</button></header>' +
        '<ul class="mini-meals">' + sortedMeals().map(function (m) {
          var r = RECIPE[recipeId(k, m.id)], sk = isSkipped(k, m), dn = isDone(k, m.id);
          return '<li><button style="--mc:var(--m-' + m.id + ')" class="mini' + (sk ? ' is-skipped' : '') + (dn ? ' is-done' : '') + '" data-action="open-recipe" data-id="' + r.id + '" data-k="' + k + '" data-meal="' + m.id + '"' + (sk ? ' title="No toca: día de descanso"' : '') + '>' +
            '<span class="t">' + mealTime(m.id) + '</span><span class="n"><span class="emoji">' + r.emoji + '</span> ' + esc(r.name) + '</span>' +
            (dn ? icon('check', 'ic-sm ok') : '') + '</button></li>';
        }).join('') + '</ul></article>';
    }).join('') + '</div></div>';
    return h;
  }

  /* ---------------- Vista: Recetas ---------------- */
  function viewRecetas() {
    var filters = [['all', 'Todas']].concat(MEALS.map(function (m) { return [m.id, m.name]; }));
    return '<div class="stack"><h2 class="page-title">Recetas</h2>' +
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
      return (ui.extras || !r.extra) && (ui.rFilter === 'all' || r.meal === ui.rFilter) &&
        (!q || norm(r.name + ' ' + r.ing.map(function (i) { return i.n + ' ' + (i.t || ''); }).join(' ')).indexOf(q) !== -1);
    });
    if (!list.length) return '<p class="empty">No encontré recetas con eso. Prueba con otro ingrediente.</p>';
    return MEALS.filter(function (m) { return list.some(function (r) { return r.meal === m.id; }); }).map(function (m) {
      return '<section class="recipe-group"><h3 class="group-title">' + m.name + ' <span class="muted small">· ' + eqList(m.eq).join(' · ') + '</span></h3>' +
        '<div class="recipe-grid">' + list.filter(function (r) { return r.meal === m.id; }).map(function (r) {
          var pd = planDays(r);
          return '<button class="recipe-card" style="--mc:var(--m-' + r.meal + ')" data-action="open-recipe" data-id="' + r.id + '"><span class="roundel big">' + r.emoji + '</span>' +
            '<span class="rc-name">' + esc(r.name) + '</span><span class="rc-meta">' + (r.extra ? '<span class="badge">Idea extra</span>' : (pd ? 'En tu plan: ' + pd : '')) + '</span></button>';
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
  function viewCompras() {
    var mon = shopMonday(), wk = keyOf(mon);
    var res = buildShopping(mon), items = res.items, checked = S.shop[wk] || {};
    var nChecked = items.filter(function (i) { return checked[i.n]; }).length;
    var h = '<div class="stack">' + weekNav('shop', mon, ui.shopOffset);
    h += '<div class="banner ok">' + icon('info') + '<div>Calculada con el menú de esa semana (incluye tus cambios de platillo): ' +
      res.trainDays + (res.trainDays === 1 ? ' día' : ' días') + ' con pre-entreno y ' + (7 - res.trainDays) + ' de descanso.</div></div>';
    h += '<div class="shop-tools"><span class="muted small" id="shop-count">' + nChecked + ' de ' + items.length + ' listos</span>' +
      '<div class="row-gap"><button class="chip-btn" data-action="shop-share">' + icon('share', 'ic-sm') + ' Compartir</button>' +
      '<button class="chip-btn" data-action="shop-clear">Desmarcar todo</button></div></div>';
    D.SHOP_CATS.forEach(function (cat) {
      var list = items.filter(function (i) { return i.c === cat.id; }).sort(function (a, b) { return a.n.localeCompare(b.n, 'es'); });
      if (!list.length) return;
      h += '<section class="card"><h3 class="card-title"><span class="emoji">' + cat.emoji + '</span> ' + cat.name + '</h3><ul class="shop-list">' +
        list.map(function (i) {
          var c = !!checked[i.n];
          return '<li><label class="shop-item' + (c ? ' is-checked' : '') + '"><input type="checkbox" data-input="shop" data-wk="' + wk + '" data-n="' + esc(i.n) + '"' + (c ? ' checked' : '') + '>' +
            '<span class="si-name">' + esc(i.n) + '</span><span class="si-qty">' + esc(i.qty) + '</span></label></li>';
        }).join('') + '</ul></section>';
    });
    return h + '</div>';
  }
  function updateShopCount() {
    var el = document.getElementById('shop-count'); if (!el) return;
    var all = document.querySelectorAll('[data-input="shop"]'), n = 0;
    all.forEach(function (x) { if (x.checked) n++; });
    el.textContent = n + ' de ' + all.length + ' listos';
  }
  function shareShopping() {
    var mon = shopMonday(), wk = keyOf(mon), sun = addDays(mon, 6), checked = S.shop[wk] || {};
    var items = buildShopping(mon).items.filter(function (i) { return !checked[i.n]; });
    if (!items.length) { toast('Ya tienes todo ✓'); return; }
    var lines = ['Lista de compras NutriJabón (' + mon.getDate() + ' ' + MONTHS_ABBR[mon.getMonth()] + ' – ' + sun.getDate() + ' ' + MONTHS_ABBR[sun.getMonth()] + ')'];
    D.SHOP_CATS.forEach(function (cat) {
      var list = items.filter(function (i) { return i.c === cat.id; }).sort(function (a, b) { return a.n.localeCompare(b.n, 'es'); });
      if (!list.length) return;
      lines.push('', cat.emoji + ' ' + cat.name.toUpperCase());
      list.forEach(function (i) { lines.push('• ' + i.n + (i.qty !== 'al gusto' ? ' — ' + i.qty : '')); });
    });
    var text = lines.join('\n');
    if (navigator.share) {
      navigator.share({ title: 'Lista de compras', text: text }).catch(function () { /* cancelado */ });
    } else if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { toast('Lista copiada'); }, function () { fallbackCopy(text); });
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Lista copiada'); } catch (e) { toast('No se pudo copiar'); }
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
      accordion('ajustes', icon('sliders') + 'Ajustes', settingsHtml()) +
      accordion('avisos', icon('bell') + 'Recordatorios', remindHtml()) +
      accordion('respaldo', icon('cassette') + 'Respaldo y otros equipos', backupHtml()) +
      accordion('instalar', icon('download') + 'Instalar en tus dispositivos', installHtml()) +
      '<p class="small muted center">Basado en el plan de tu nutrióloga del 8 nov 2026 · Próxima revisión: 18 dic 2026.<br>NutriJabón te ayuda a seguir tu plan; no sustituye la consulta profesional.</p></div>';
  }
  function exHtml() {
    var pres = D.RECIPES.filter(function (r) { return r.meal === 'pre' && !r.extra; }).map(function (r) { return r.emoji + ' ' + esc(r.name); });
    return '<div class="ex-grid">' +
      '<div class="ex-col ok"><h4>' + icon('dumbbell') + ' Días de ejercicio</h4><ul>' +
      '<li>Comes los <b>6 tiempos</b>, incluido el <b>pre-entreno</b> (' + mealTime('pre') + ').</li>' +
      '<li>Cómelo antes de entrenar; el “Mix” también sirve durante el entreno.</li>' +
      '<li>Total: 3 frutas, 7 cereales y 3 grasas con proteína.</li></ul></div>' +
      '<div class="ex-col warn"><h4>' + icon('moon') + ' Días de descanso</h4><ul>' +
      '<li><b>No comas el pre-entreno</b>: ' + pres.join(', ') + '.</li>' +
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
      '<p class="small">' + icon('bell', 'ic-xs') + ' ¿Quieres avisos a estas horas? <button class="link-btn" data-action="goto-sec" data-sec="avisos">Agrégalos a tu calendario</button></p>' +
      '<h4 class="sec-title">Tus datos</h4><p class="small muted">Todo se guarda solo en este dispositivo; nada se envía a internet. <button class="link-btn" data-action="goto-sec" data-sec="respaldo">Guarda un respaldo</button> para no perderlo.</p>' +
      '<div><button class="btn danger" data-action="reset-all">Borrar marcas y cambios de platillos</button></div>';
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
    MEALS.forEach(function (m) {
      var groups = {}, order = [];
      for (var i = 0; i < 7; i++) {
        if (m.trainingOnly && S.settings.trainDays.indexOf(i) === -1) continue;
        var rid = D.WEEK[m.id][i];
        if (!groups[rid]) { groups[rid] = []; order.push(rid); }
        groups[rid].push(i);
      }
      var t = mealTime(m.id).split(':').map(Number);
      order.forEach(function (rid) {
        var days = groups[rid], r = RECIPE[rid], first = start;
        while (days.indexOf(wd(first)) === -1) first = addDays(first, 1);
        var s = new Date(first.getFullYear(), first.getMonth(), first.getDate(), t[0], t[1]);
        var by = days.map(function (i) { return ICS_DAYS[i]; });
        var desc = 'Toca: ' + eqList(m.eq).join(', ') + '.' + (m.trainingOnly ? '\nSolo en tus días de ejercicio.' : '') +
          '\nPuedes cambiarlo por otro platillo con las mismas porciones.' + (url ? '\nReceta: ' + url : '');
        L.push('BEGIN:VEVENT', 'UID:nj-' + m.id + '-' + by.join('') + '@nutrijabon', 'DTSTAMP:' + stamp,
          'DTSTART:' + icsLocal(s), 'DTEND:' + icsLocal(new Date(s.getTime() + 30 * 6e4)),
          'RRULE:FREQ=WEEKLY;BYDAY=' + by.join(',') + until,
          'SUMMARY:' + icsEsc(r.emoji + ' ' + m.name + ': ' + r.name), 'DESCRIPTION:' + icsEsc(desc),
          'TRANSP:TRANSPARENT', 'CATEGORIES:NutriJabón',
          'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(m.name + ': ' + r.name), 'TRIGGER:' + (lead ? '-PT' + lead + 'M' : 'PT0S'), 'END:VALARM',
          'END:VEVENT');
      });
    });
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
    return '<p>Agrega tus comidas a tu calendario: te avisa a la hora de cada una con el platillo que toca ese día. El pre-entreno solo aparece en tus días de ejercicio' +
      (train.length ? ' (' + train.join(', ') + ')' : '; ahora no tienes ninguno marcado') + '.</p>' +
      '<label class="time-row lead-row"><span>Avisarme</span><select data-input="lead" aria-label="Cuándo avisarme">' + LEADS.map(function (l) {
        return '<option value="' + l[0] + '"' + (l[0] === lead ? ' selected' : '') + '>' + l[1] + '</option>';
      }).join('') + '</select></label>' +
      '<div><button class="btn primary" data-action="add-calendar">' + icon('bell') + ' Agregar a mi calendario</button></div>' +
      (notes[os] ? '<div class="banner info">' + icon('info') + '<div>' + notes[os] + '</div></div>' : '') +
      '<p class="small muted">Usa tus horarios de Ajustes y dura hasta tu revisión del ' + rev + '. Si cambias horarios o días de ejercicio, borra los avisos anteriores y vuelve a agregarlos. Los cambios de un solo día no llegan al calendario.</p>';
  }

  /* ---------------- Respaldo: pasar tus datos a otro equipo ---------------- */
  var KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
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
    var st = isObj(d.settings) ? d.settings : {}, out = { settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), days: {}, shop: {} };
    if (Array.isArray(st.trainDays)) {
      out.settings.trainDays = [0, 1, 2, 3, 4, 5, 6].filter(function (i) { return st.trainDays.indexOf(i) !== -1; });
    }
    if (isObj(st.times)) Object.keys(st.times).forEach(function (id) {
      if (MEAL[id] && /^([01]\d|2[0-3]):[0-5]\d$/.test(st.times[id])) out.settings.times[id] = st.times[id];
    });
    if (LEADS.some(function (l) { return l[0] === st.remindLead; })) out.settings.remindLead = st.remindLead;
    if (KEY_RE.test(st.lastBackup)) out.settings.lastBackup = st.lastBackup;
    out.settings.onboarded = true;
    if (isObj(d.days)) Object.keys(d.days).forEach(function (k) {
      var r = d.days[k], o = {};
      if (!KEY_RE.test(k) || !isObj(r)) return;
      if (typeof r.ex === 'boolean') o.ex = r.ex;
      if (isObj(r.sw)) Object.keys(r.sw).forEach(function (m) {
        var x = RECIPE[r.sw[m]];
        if (MEAL[m] && x && x.meal === m) (o.sw = o.sw || {})[m] = x.id;
      });
      if (isObj(r.done)) Object.keys(r.done).forEach(function (m) { if (MEAL[m] && r.done[m] === true) (o.done = o.done || {})[m] = true; });
      if (Object.keys(o).length) out.days[k] = o;
    });
    if (isObj(d.shop)) Object.keys(d.shop).forEach(function (wk) {
      var w = d.shop[wk], o = {};
      if (!KEY_RE.test(wk) || !isObj(w)) return;
      Object.keys(w).forEach(function (n) { if (w[n] === true) o[n] = true; });
      if (Object.keys(o).length) out.shop[wk] = o;
    });
    return out;
  }
  function importBackup(file) {
    var rd = new FileReader();
    rd.onload = function () {
      var p = null;
      try { p = JSON.parse(rd.result); } catch (e) { /* no es JSON */ }
      if (!isObj(p) || p.app !== 'nutrijabon' || !isObj(p.data)) { toast('Ese archivo no es un respaldo de NutriJabón'); return; }
      var when = new Date(p.exported), wk = isNaN(when) ? '' : ' del ' + shortDate(keyOf(when));
      if (!window.confirm('¿Cargar el respaldo' + wk + '? Reemplaza las marcas, platillos, lista de compras y ajustes de este dispositivo.')) return;
      S = cleanData(p.data);
      save(); render();
      toast('Respaldo cargado ✓');
    };
    rd.onerror = function () { toast('No se pudo leer el archivo'); };
    rd.readAsText(file);
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
      '<p class="small muted"><b>Para pasarlo a otro equipo:</b> guarda o envía el respaldo (por correo, WhatsApp o AirDrop), abre NutriJabón en el otro equipo y toca <b>Cargar respaldo</b>. Reemplaza lo que haya en ese equipo.</p>';
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
          '<button class="btn primary" data-action="toggle-done" data-k="' + ctx.k + '" data-meal="' + r.meal + '" data-close="1">' + icon('check') + (done ? ' Desmarcar' : ' Ya lo comí') + '</button>';
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
      '<div class="sheet-content" style="--mc:var(--m-' + r.meal + ')">' + eqChips(m.eq) +
      (r.extra
        ? '<div class="banner info">' + icon('info') + '<div>Idea extra de NutriJabón con las mismas porciones de tu ' + m.name.toLowerCase() + '. Coméntala con tu nutrióloga.</div></div>'
        : (pd ? '<p class="small muted">En tu plan: ' + pd + '</p>' : '')) +
      (r.ahead ? '<div class="banner ok">' + icon('clock') + '<div><b>Con anticipación:</b> ' + r.ahead + '</div></div>' : '') +
      '<h3 class="sec-title">Ingredientes</h3><ul class="ing-list">' + r.ing.map(function (i) { return '<li>' + esc(fmtIng(i)) + '</li>'; }).join('') + '</ul>' +
      (r.fruitChoice ? '<div class="fruit-ideas"><div class="small muted">1 porción de fruta puede ser:</div><div class="chips-wrap">' +
        D.FRUIT_IDEAS.map(function (f) { return '<span class="eq-chip">' + f[0] + ' · ' + f[1] + '</span>'; }).join('') + '</div></div>' : '') +
      '<h3 class="sec-title">Preparación</h3><ol class="steps">' + r.steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' +
      (r.tips || []).map(function (t) { return '<div class="banner leaf">' + icon('leaf') + '<div><b>Ojo vegano:</b> ' + t + '</div></div>'; }).join('') +
      '</div><div class="sheet-actions">' + actions + '</div>';
  }
  function swapSheet(k, mealId) {
    var m = MEAL[mealId], cur = recipeId(k, mealId), def = defaultRecipe(k, mealId), d = fromKey(k);
    var opts = D.RECIPES.filter(function (r) { return r.meal === mealId; });
    function row(r) {
      return '<div class="option' + (r.id === cur ? ' is-current' : '') + '">' +
        '<button class="option-main" data-action="choose-swap" data-k="' + k + '" data-meal="' + mealId + '" data-id="' + r.id + '">' +
        '<span class="roundel">' + r.emoji + '</span><span class="option-text"><b>' + esc(r.name) + '</b><span class="small muted">' +
        (r.id === def ? 'El de tu plan para este día' : r.extra ? 'Idea extra' : 'Otra opción de tu plan') + '</span></span>' +
        (r.id === cur ? '<span class="current-mark" aria-label="Elegido">' + icon('check') + '</span>' : '') + '</button>' +
        '<button class="icon-btn" data-action="preview-recipe" data-k="' + k + '" data-id="' + r.id + '" aria-label="Ver receta de ' + esc(r.name) + '">' + icon('book') + '</button></div>';
    }
    return '<div class="sheet-head"><span class="sheet-emoji roundel" style="--mc:var(--m-' + mealId + ')">' + icon('swap') + '</span>' +
      '<div class="sheet-titles"><div class="eyebrow">' + longDate(d) + '</div><h2 id="sheet-title">Cambiar ' + m.name.toLowerCase() + '</h2></div>' +
      '<button class="icon-btn" data-action="close-sheet" aria-label="Cerrar">' + icon('x') + '</button></div>' +
      '<div class="sheet-content" style="--mc:var(--m-' + mealId + ')"><p class="small muted">Todas tienen las mismas porciones (' + eqList(m.eq).join(', ') + '), así que puedes intercambiarlas.</p>' +
      '<h3 class="sec-title">De tu plan</h3><div class="options">' + opts.filter(function (r) { return !r.extra; }).map(row).join('') + '</div>' +
      '<h3 class="sec-title">Ideas extra</h3><div class="options">' + opts.filter(function (r) { return r.extra; }).map(row).join('') + '</div></div>';
  }
  function onboardingSheet() {
    return '<div class="sheet-head"><span class="sheet-emoji roundel" style="--mc:var(--green)">🌱</span><div class="sheet-titles"><div class="eyebrow">NutriJabón</div><h2 id="sheet-title">¡Hola! Armemos tu semana</h2></div></div>' +
      '<div class="sheet-content"><p>Aquí verás qué toca comer cada día según tu plan vegano, con recetas, lista de compras y equivalentes.</p>' +
      '<h3 class="sec-title">¿Qué días haces ejercicio?</h3>' + dayChips() +
      '<div class="banner ok">' + icon('dumbbell') + '<div>Los días de ejercicio incluyen tu <b>pre-entreno</b>. Los días de descanso no lo comes. Puedes cambiar esto cuando quieras.</div></div></div>' +
      '<div class="sheet-actions"><button class="btn primary" data-action="finish-onboarding">Empezar</button></div>';
  }

  var sheetEl, sheetBox, sheetBody, sheet = null, lastFocus = null;
  var SHEETS = { recipe: recipeSheet, swap: swapSheet, onboarding: onboardingSheet };
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
  function renderSheet() { if (sheet) sheetBody.innerHTML = SHEETS[sheet.type].apply(null, sheet.args); }
  function closeSheet(fromPop) {
    if (!sheet) return;
    if (sheet.type === 'onboarding') { S.settings.onboarded = true; save(); }
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
  function toggleDone(k, mealId) {
    setDay(k, function (r) {
      r.done = r.done || {};
      if (r.done[mealId]) delete r.done[mealId]; else r.done[mealId] = true;
    });
    render();
    var active = MEALS.filter(function (m) { return !isSkipped(k, m); });
    if (isDone(k, mealId) && active.every(function (m) { return isDone(k, m.id); })) toast('¡Día completo! 🎉');
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
      case 'toggle-done': toggleDone(ds.k, ds.meal); if (ds.close) closeSheet(); break;
      case 'open-recipe': openSheet('recipe', [ds.id, ds.k ? { mode: 'day', k: ds.k } : { mode: 'browse' }]); break;
      case 'preview-recipe': openSheet('recipe', [ds.id, { mode: 'choose', k: ds.k }]); break;
      case 'open-swap': openSheet('swap', [ds.k, ds.meal]); break;
      case 'choose-swap': chooseSwap(ds.k, ds.meal, ds.id); break;
      case 'use-today': { var r = RECIPE[ds.id]; chooseSwap(keyOf(today()), r.meal, r.id); break; }
      case 'close-sheet': closeSheet(); break;
      case 'week-shift': ui.weekOffset += +ds.n; render(); break;
      case 'shop-shift': ui.shopOffset += +ds.n; render(); break;
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
      case 'reset-times': S.settings.times = {}; save(); render(); toast('Horarios del plan restaurados'); break;
      case 'reset-all':
        if (window.confirm('¿Borrar tus marcas de comidas, cambios de platillos y la lista de compras? Tus días de ejercicio y horarios se quedan.')) {
          S.days = {}; S.shop = {}; save(); render(); toast('Listo, datos borrados');
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
  }
  function onChange(e) {
    var el = e.target, t = el.dataset && el.dataset.input;
    if (t === 'extras') { ui.extras = el.checked; document.getElementById('recipe-results').innerHTML = recipeResults(); }
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
    } else if (t === 'lead') {
      S.settings.remindLead = +el.value; save();
    } else if (t === 'backup') {
      var f = el.files && el.files[0];
      el.value = '';
      if (f) importBackup(f);
    }
  }
  function gotoSection(id) {
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
    document.getElementById('settings-btn').innerHTML = icon('sliders');

    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('toggle', function (e) {
      var id = e.target && e.target.dataset && e.target.dataset.acc;
      if (id) ui.open[id] = e.target.open;
    }, true);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheet) closeSheet(); });
    window.addEventListener('popstate', function () { if (sheet) closeSheet(true); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden && !sheet) render(); });
    setInterval(function () { if (ui.tab === 'hoy' && !sheet && !document.hidden) render(); }, 60000);

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault(); deferredPrompt = e;
      if (ui.tab === 'guia') render();
    });
    window.addEventListener('appinstalled', function () { deferredPrompt = null; toast('¡App instalada!'); });

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
