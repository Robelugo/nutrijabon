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
  // acts: actividades (“Movimiento”). Cada una va después de una comida (after) en ciertos días (0 = lunes).
  var DEFAULT_SETTINGS = {
    trainDays: [0, 1, 2, 3, 4], times: {}, onboarded: false,
    meds: [{ id: 'vit', name: 'Vitamina', meal: 'pre', when: 'all' }],
    acts: [
      { id: 'pil', name: 'Pilates', kind: 'pilates', min: 0, days: [0, 1, 2, 3, 4, 5], after: 'pre' },
      { id: 'fue', name: 'Ejercicio de fuerza', kind: 'fuerza', min: 0, days: [1, 3], after: 'pre' },
      { id: 'cam', name: 'Caminata', kind: 'walk', min: 30, days: [0, 1, 2, 3, 4, 5, 6], after: 'cen' }
    ],
    waterGoal: 8, theme: 'dark', servings: 1
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
          prep: p.prep || {},
          body: p.body || {}
        };
      }
    } catch (e) { /* almacenamiento no disponible */ }
    return { settings: defaults(), days: {}, shop: {}, prep: {}, body: {} };
  }
  var S = load();
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* ignorar */ } }

  var ui = {
    tab: 'hoy', date: null, weekOffset: 0, weekDay: wd(today()), semMode: 'week', monthOffset: 0, guideMode: null, shopOffset: wd(today()) >= 5 ? 1 : 0, shopView: 'list',
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
  // Cocinar para más personas: multiplica desayuno, comida y cena (colaciones y pre-entreno son solo tuyos)
  var SHARED = { des: 1, com: 1, cen: 1 };
  function servings() { var n = S.settings.servings; return n === (n | 0) && n >= 1 && n <= 6 ? n : 1; }
  function serv(mealId) { return SHARED[mealId] ? servings() : 1; }
  function fmtIngX(i, x) { return x > 1 && i.q != null && !i.t ? fmtQU(i.q * x, i.u) + ' de ' + lowerFirst(i.n) : fmtIng(i); }
  function servingsCtl(note) {
    var n = servings();
    return '<div class="serv-ctl" role="group" aria-label="Para cuántas personas cocinas"><span>Cocino para</span>' +
      '<button class="icon-btn sm" data-action="servings" data-v="' + (n - 1) + '"' + (n <= 1 ? ' disabled' : '') + ' aria-label="Una persona menos">−</button>' +
      '<b aria-live="polite">' + n + '</b><button class="icon-btn sm" data-action="servings" data-v="' + (n + 1) + '"' + (n >= 6 ? ' disabled' : '') + ' aria-label="Una persona más">+</button>' +
      '<span>' + (n === 1 ? 'persona' : 'personas') + '</span></div>' + (note ? '<p class="small muted serv-note">' + note + '</p>' : '');
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
  function eqChips(eq, pictures) {
    return '<div class="eq-chips">' + G_ORDER.filter(function (g) { return eq[g]; }).map(function (g) {
      return '<span class="eq-chip">' + (pictures ? emblem(pictures[g]) : dot(g)) + eqText(g, eq[g]) + '</span>';
    }).join('') + '</div>';
  }

  var ICONS = {
    pasta: '<path fill="#e9bf7f" d="M2 13h20q-1 8-10 8T2 13Z"/><path d="M6 12q0-9 3-9t2 5q-2 6 0 5m2-1q3-12 5-7t-1 7"/>',
    sushi: '<path fill="#eda897" d="M3 8q0-5 9-5t9 5v8q0 5-9 5t-9-5Z"/><path d="M3 8q2 6 9 5t9-5m-12 0q3-3 6 0-3 3-6 0Z"/>',
    taco: '<path fill="#efbf7e" d="M2 17q0-14 11-14 8 0 9 12-8 6-20 2Z"/><path d="M4 15q1-9 10-10m-7 8 2-1m4-3 2 1"/>',
    avocado: '<path fill="#a3c47c" d="M7 8q1-6 5-6t5 6c1 4 4 5 4 9 0 7-18 7-18 0 0-4 3-6 4-9Z"/><path d="M15 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>',
    lemon: '<path fill="#f7ce68" d="M3 15C1 11 6 5 11 4q4-2 7 0l2-1 1 3c3 7-6 15-13 14l-3 1-1-3Z"/><path d="M7 14q0-4 4-6"/>',
    sun: '<path fill="#ffd571" d="M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z"/><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.5 5.5 7 7m10 10 1.5 1.5m0-13L17 7M7 17l-1.5 1.5"/>',
    calendar: '<path fill="#f29aa9" d="M5 5h14q1 0 1 2v12q0 2-2 2H6q-2 0-2-2V7q0-2 1-2Z"/><path d="M4 9h16M8 3v4m8-4v4M8 13h2m3 0h2m-7 4h2"/>',
    book: '<path fill="#a6c991" d="M3 11h18q-1 8-9 8t-9-8Z"/><path d="M8 8q-2-2 0-5m4 5q-2-2 0-5m4 5q-2-2 0-5M8 20h8"/>',
    cart: '<path fill="#f3bc77" d="M2 9h20l-3 11H5Z"/><path d="m6 9 4-6m8 6-4-6M9 13l1 4m5-4-1 4"/>',
    guide: '<path fill="#a8bdd9" d="M2 5q6-2 10 1 4-3 10-1v14q-6-2-10 1-4-3-10-1Z"/><path d="M12 6v14"/>',
    swap: '<path d="M3 7h16l-4-4m6 14H5l4 4"/>',
    dumbbell: '<path fill="#e9a1ac" d="M4 7h4v10H4Zm12 0h4v10h-4Z"/><path d="M8 12h8M2 10v4m20-4v4"/>',
    moon: '<path fill="#f5cb73" d="M19 16A9 9 0 0 1 8 4a9 9 0 1 0 11 12Z"/>',
    clock: '<path fill="#efd0a0" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/><path d="M12 7v5l4 2"/>',
    search: '<path fill="#a9c5d9" d="M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"/><path d="m16 16 5 5"/>',
    share: '<path fill="#eeb384" d="M7 10H4v10h16V10h-3"/><path d="m8 8 4-4 4 4m-4-4v10"/>',
    info: '<path fill="#99c2d6" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/><path d="M12 11v5m0-9v.2"/>',
    alert: '<path fill="#f4cb74" d="m12 3 10 17H2Z"/><path d="M12 9v4m0 3v.2"/>',
    ban: '<path fill="#e8a591" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/><path d="m6 6 12 12"/>',
    leaf: '<path fill="#a6c795" d="M5 17C0 8 11 5 21 3c0 11-5 19-16 14Z"/><path d="M4 21 15 10"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
    upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4"/>',
    bell: '<path fill="#f2c779" d="M4 17h16l-2-4V9a6 6 0 0 0-12 0v4Z"/><path d="M9 20q3 3 6 0"/>',
    fork: '<path d="M4 3v6q3 4 6 0V3M7 3v18M18 3q-5 3-5 10h5m0-10v18"/>',
    pot: '<path fill="#d4ba8a" d="M4 10h16v7q0 3-3 3H7q-3 0-3-3Z"/><path d="M3 10h18M8 7q4-4 8 0m-6-3h4M1 13h2m18 0h2"/>',
    pill: '<path fill="#f1a5af" d="M4 12 12 4a5.6 5.6 0 0 1 8 8l-8 8a5.6 5.6 0 0 1-8-8Z"/><path d="m8 8 8 8"/>',
    star: '<path fill="#f5cd70" d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
    clipboard: '<path fill="#a9c5c4" d="M8 5H5v16h14V5h-3"/><path d="M9 5h6V3H9Zm-1 7 2 2 5-5m-7 8h7"/>',
    cassette: '<path fill="#c8aecb" d="M3 5h18v15H3Zm6 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm10 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"/><path d="M7 10h10M7 16h10"/>',
    heart: '<path fill="#f0a1ab" d="M12 20 4 12C-1 4 8 0 12 7c4-7 13-3 8 5Z"/>',
    dislike: '<path fill="#d2ad98" d="M15 4H6q-2 0-2 2l-2 8h7l-1 5q0 3 3 1l5-7V5Z"/><path d="M18 4h3v11h-3"/>',
    home: '<path fill="#edca98" d="m2 11 10-8 10 8h-3v10H5V11Z"/><path d="M9 20v-7h6v7"/>',
    apple: '<path fill="#eca09b" d="M12 8c-8-5-13 5-6 12 2 2 4 0 6 0s4 2 6 0c7-7 2-17-6-12Z"/><path d="M12 8q0-4-3-6m4 4q3-4 6-3"/>',
    bean: '<path fill="#d2ab8b" d="M5 9c0-7 12-8 13-1 1 4 5 4 3 8-4 9-19 5-17-2q0-3 4-3Z"/><path d="M8 16q5 2 6-3"/>',
    grain: '<path fill="#e8c878" d="M7 17q-6-1-4-7 5 1 4 7Zm4-5q-5-2-3-7 4 1 3 7Zm4-5q-1-5 4-5 2 3-4 5Zm-5 8q3-5 9-2-1 5-9 2Z"/><path d="m5 21 13-16"/>',
    milk: '<path fill="#a6c6db" d="M8 3h8l2 6v12H6V9Z"/><path d="M6 9h12M9 3h7"/>',
    nut: '<path fill="#dcb489" d="M4 16C4 8 10 4 19 2c3 9-1 17-8 19-4 1-7-1-7-5Z"/><path d="M7 18q4-3 8-11"/>',
    jar: '<path fill="#c6b09e" d="M7 3h10v4l2 3v10H5V10l2-3Z"/><path d="M7 7h10m-9 5h8m-8 3h8"/>',
    cup: '<path fill="#ccb199" d="M3 7h14v7q0 5-7 5t-7-5Z"/><path d="M17 9h3q4 5-3 6M5 21h12"/>',
    tag: '<path fill="#e5ba82" d="m2 13 10-10h9v9L11 22Z"/><path d="M16 7h.2"/>',
    chat: '<path fill="#c6b6d4" d="M3 4h18v14H9l-6 4Z"/><path d="M7 10h10m-10 4h6"/>',
    box: '<path fill="#dabb91" d="m3 7 9-4 9 4v11l-9 4-9-4Z"/><path d="m3 8 9 4 9-4m-9 4v9"/>',
    bag: '<path fill="#e4aeaa" d="M5 8h14l2 13H3Z"/><path d="M8 9V7a4 4 0 0 1 8 0v2"/>',
    knife: '<path fill="#b6c7c8" d="M3 2 15 13l-4 3Q3 10 3 2Z"/><path d="m14 13 6 6-2 2-6-6"/>',
    store: '<path fill="#ecb68b" d="m3 10 2-6h14l2 6q-2 4-5 1-4 3-8 0-3 3-5-1Z"/><path d="M5 11v10h14V11M9 21v-6h5v6"/>',
    thermo: '<path fill="#e7ad9c" d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0Z"/><path d="M12 8v9"/>',
    mountain: '<path fill="#a9c4ba" d="m2 20 9-16 11 16Z"/><path d="m9 10 3 2 2-2"/>',
    camera: '<path fill="#a9c5d9" d="M3 8.5q0-2 2-2h2.6L9.2 4h5.6l1.6 2.5H19q2 0 2 2V18q0 2-2 2H5q-2 0-2-2Z"/><path d="M15.5 13a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"/>',
    shoe: '<path fill="#a9c5d9" d="M2 18v-8q0-2 2-2h2q1 3 4 3l1.5-3 3.5 4 5 2q2 1 2 3v1Z"/><path d="M2 20h20M9.5 13.5l1 1M12 12l1 1"/>',
    mat: '<path fill="#c6b6d4" fill-rule="evenodd" d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 3.2a5.8 5.8 0 1 0 0 11.6 5.8 5.8 0 0 0 0-11.6Z"/><path fill="#f2c67b" d="M9 1h6v4H9Zm0 18h6v4H9Z"/>',
    kettle: '<path fill="#e9a1ac" d="M3.5 15a8.5 8.5 0 0 1 17 0q0 7-8.5 7t-8.5-7Z"/><path d="M7.5 9.5V6.5a4.5 4.5 0 0 1 9 0v3M9 16.5h6"/>',
    spark: '<path fill="#ead17e" d="m12 2 2.5 7 7 2.5-7 2.5-2.5 7-2.5-7-7-2.5 7-2.5Z"/>',
    glass: '<path fill="#a6c6db" d="M6.2 11h11.6l-1.2 9.2q-.1.8-1 .8H8.4q-.9 0-1-.8Z"/><path d="M5 3h14l-2.4 17.2q-.1.8-1 .8H8.4q-.9 0-1-.8ZM6.2 11h11.6"/>',
    scale: '<path fill="#ead7b3" d="M5 4h14q2 0 2 2v12q0 3-3 3H6q-3 0-3-3V6q0-2 2-2Z"/><path d="M7.5 11a4.5 4.5 0 0 1 9 0Zm4.5 0 2-2.6"/>',
    cat: '<path fill="#f4b768" d="M4 11V3.5l4.5 3.3q3.5-1.3 7 0L20 3.5V11c1.8 6-2 10-8 10S2.2 17 4 11Z"/><path d="M9 12.5v1m6-1v1m-4 3h2"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    left: '<path d="m15 5-7 7 7 7"/>',
    right: '<path d="m9 5 7 7-7 7"/>',
    down: '<path d="m5 9 7 7 7-7"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    settings: '<path d="M12 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-7 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/><path d="M3 6h3m6 0h9M3 12h9m6 0h3M3 18h2m6 0h10"/>'
  };
  function icon(name, cls) {
    return '<svg class="ic planner-icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>';
  }
  var FOOD_SYMBOLS = {"🍎":"apple","🥬":"leaf","🫘":"bean","🌾":"grain","🥛":"milk","🥑":"avocado","🧂":"jar","🍲":"pot","🌮":"taco","🍣":"sushi","🍝":"pasta","🥡":"box","☕":"cup","🏪":"store","💊":"pill","🌰":"nut","🍋":"lemon","🏷️":"tag"};
  function dishThumb(r) {
    return '<img class="dish-thumb" src="art/' + r.id + '.jpg" alt="" loading="lazy">';
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
    if (r.ac && !Object.keys(r.ac).length) delete r.ac;
    if (r.awhy && !Object.keys(r.awhy).length) delete r.awhy;
    if (!r.wa) delete r.wa;
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
  function tasteNote(id) { var t = tasteOf(id); return t === 1 ? ' · ' + icon('heart', 'ic-sm') + ' te gusta' : t === -1 ? ' · ' + icon('dislike', 'ic-sm') + ' no te gusta' : ''; }
  function tasteBtns(id) {
    var t = tasteOf(id);
    return '<div class="taste row-gap" role="group" aria-label="¿Te gusta este platillo?">' +
      '<button class="chip-btn taste-btn" aria-pressed="' + (t === 1) + '" data-action="taste" data-id="' + id + '" data-v="1">' + emblem('fav') + ' Me gusta</button>' +
      '<button class="chip-btn taste-btn" aria-pressed="' + (t === -1) + '" data-action="taste" data-id="' + id + '" data-v="-1">' + emblem('noTaste') + ' No me gusta</button></div>';
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
      (favs.length ? '<p class="small"><b>' + icon('heart', 'ic-sm') + ' Te gustan:</b> ' + esc(favs.join(', ')) + '.</p>' : '') +
      (nos.length ? '<p class="small"><b>' + icon('dislike', 'ic-sm') + ' No te gustan:</b> ' + esc(nos.join(', ')) + '.</p>' : '');
  }
  // Tomas del pre-entreno que también van en días de descanso (p. ej. la vitamina)
  function restMeds() { return (S.settings.meds || []).filter(function (md) { return md.meal === 'pre' && md.when === 'all'; }); }
  function restMedsText() {
    var ms = restMeds(); if (!ms.length) return '';
    return ' <b>Sí toma: ' + esc(listText(ms.map(function (md) { return md.name; }))) + '</b>, a las ' + mealTime('pre') + '.';
  }
  // ¿Por qué no se cumplió? Se guarda en why (comidas) y twhy (vitaminas/medicamentos)
  var REASONS = {
    meal: [['fuera', 'fork', 'Comí fuera'], ['tiempo', 'clock', 'No tuve tiempo'], ['hambre', 'book', 'Sin hambre'],
      ['otra', 'swap', 'Comí otra cosa'], ['olvido', 'chat', 'Se me olvidó'], ['otro', 'info', 'Otro motivo']],
    med: [['olvido', 'chat', 'Se me olvidó'], ['acabo', 'box', 'Se me acabó'], ['traia', 'bag', 'Fuera de casa'], ['otro', 'info', 'Otro motivo']],
    act: [['tiempo', 'clock', 'No tuve tiempo'], ['cansancio', 'moon', 'Cansancio'], ['dolor', 'thermo', 'Dolor o molestia'],
      ['clima', 'sun', 'Clima o lugar'], ['olvido', 'chat', 'Se me olvidó'], ['otro', 'info', 'Otro motivo']]
  };
  var REASON_TEXT = { meal: {}, med: {}, act: {} };
  ['meal', 'med', 'act'].forEach(function (kind) { REASONS[kind].forEach(function (x) { REASON_TEXT[kind][x[0]] = x[2]; }); });
  var MARK_WHY = { done: 'why', tk: 'twhy', ac: 'awhy' }, KIND_WHY = { meal: 'why', med: 'twhy', act: 'awhy' };
  function whyOf(k, field, id) { var r = dayRec(k); return r[field] ? r[field][id] : undefined; }

  /* ---------------- Movimiento ----------------
   * Caminata, pilates, ejercicio de fuerza… Cada actividad va después de una comida en ciertos días
   * y se marca ✓/✗ en Hoy (days[k].ac, razón en days[k].awhy). No cuenta para “día completo” ni
   * para el porcentaje de comidas: tiene su propio avance. */
  var ACT_KINDS = [['walk', 'Caminar', 'shoe'], ['pilates', 'Pilates', 'mat'], ['fuerza', 'Fuerza', 'kettle'], ['otro', 'Otra', 'spark']];
  var ACT_ICON = {}; ACT_KINDS.forEach(function (x) { ACT_ICON[x[0]] = x[2]; });
  function actIcon(a, cls) { return icon(ACT_ICON[a.kind] || 'spark', cls); }
  function actsFor(k, mealId) {
    var i = wd(fromKey(k));
    return (S.settings.acts || []).filter(function (a) { return (!mealId || a.after === mealId) && a.days.indexOf(i) !== -1; });
  }
  function actMark(k, id) { var r = dayRec(k); return r.ac ? r.ac[id] : undefined; }
  function actName(a) { return a.name + (a.min ? ' · ' + a.min + ' min' : ''); }
  var AFTER_TEXT = { pre: 'Después del pre-entreno', des: 'Después del desayuno', c1: 'Después de tu colación', com: 'Después de comer', c2: 'Después de tu colación', cen: 'Después de cenar' };
  function afterText(k, mealId) { // texto plano (puede llevar el nombre de una vitamina): escapar al usarlo en HTML
    var ms = mealId === 'pre' ? medsFor(k, 'pre') : [];
    return ms.length ? 'Después de tomar tu ' + lowerFirst(listText(ms.map(function (md) { return md.name; }))) : AFTER_TEXT[mealId];
  }
  function actRows(k, m) {
    var acts = actsFor(k, m.id); if (!acts.length) return '';
    var after = esc(afterText(k, m.id));
    return '<ul class="plain tomas acts" style="--mc:var(--m-' + m.id + ')">' + acts.map(function (a) {
      var am = actMark(k, a.id), name = esc(actName(a));
      return '<li class="toma act' + (am === true ? ' is-done' : am === false ? ' is-missed' : '') + '">' +
        '<span class="toma-ic">' + actIcon(a) + '</span><span class="toma-txt"><b>' + name + '</b><span class="small muted">' + after +
        (am === false ? ' · <b class="miss-text">no cumplí</b>' : '') + '</span></span>' +
        markBtns(am, name, 'data-action="mark-act" data-k="' + k + '" data-id="' + a.id + '"', 'sm') +
        (am === false ? whyChips('act', k, a.id, whyOf(k, 'awhy', a.id)) : '') + '</li>';
    }).join('') + '</ul>';
  }
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
    var st = { from: from, to: to, days: 0, due: 0, done: 0, miss: 0, full: 0, train: 0, meal: {}, meds: {}, swaps: {},
      acts: {}, mov: { due: 0, done: 0, miss: 0 }, water: { days: 0, sum: 0, goal: 0 } };
    MEALS.forEach(function (m) { st.meal[m.id] = { due: 0, done: 0, miss: 0 }; });
    (S.settings.meds || []).forEach(function (md) { st.meds[md.id] = { due: 0, done: 0, miss: 0 }; });
    (S.settings.acts || []).forEach(function (a) { st.acts[a.id] = { due: 0, done: 0, miss: 0 }; });
    for (var d = from; d <= to; d = addDays(d, 1)) {
      var k = keyOf(d);
      st.days++;
      if (isTraining(k)) st.train++;
      if (isFullDay(k)) st.full++;
      actsFor(k).forEach(function (a) { // de hoy, solo cuenta cuando ya pasó su comida o ya la marcaste
        var am = actMark(k, a.id);
        if (k === tk && am === undefined && toMin(mealTime(a.after)) > nm) return;
        tally(st.acts[a.id], am, whyOf(k, 'awhy', a.id)); tally(st.mov, am);
      });
      var wa = dayRec(k).wa;
      if (wa) { st.water.days++; st.water.sum += wa; if (wa >= waterGoal()) st.water.goal++; }
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
  function daysToReview() { return dayDiff(fromKey(reviewKey()), today()); }
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
    var n = daysToReview(), rev = shortDate(reviewKey()).replace(/ \d{4}$/, '');
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
      (st && st.due ? '<p class="small muted">Hasta hoy: ' + markSummary(st) + '.' + (st.mov.due ? ' Movimiento: ' + st.mov.done + ' de ' + st.mov.due + '.' : '') +
        (st.water.days ? ' Agua: ' + avgGlasses(st.water) + ' vasos al día en promedio.' : '') + '</p>' : '') +
      '<div class="row-gap">' + (st && sun < t && st.days >= 3 ? '<button class="btn" data-action="open-recap" data-mon="' + keyOf(mon) + '">' + icon('star') + ' Resumen de esa semana</button>' : '') +
      '<button class="btn" data-action="open-report">' + icon('clipboard') + ' Resumen para tu revisión</button>' +
      (daysToReview() >= 0 ? '<button class="btn" data-action="open-review">' + icon('check') + ' Preparar mi revisión</button>' : '') + '</div></section>';
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
    if (R.best && R.best.p > 0) lines.push('<li>' + icon('star', 'ic-sm') + ' <span>Lo mejor: <b>' + R.best.m.name + '</b> (' + R.best.x.done + ' de ' + R.best.x.due + ')</span></li>');
    if (R.worst && R.worst !== R.best && R.worst.p < 1) lines.push('<li>' + icon('mountain', 'ic-sm') + ' <span>Lo que más costó: <b>' + R.worst.m.name + '</b> (' + R.worst.x.done + ' de ' + R.worst.x.due + ')</span></li>');
    if (R.top) lines.push('<li>' + icon('chat', 'ic-sm') + ' <span>Razón más común: <b>' + lowerFirst(REASON_TEXT.meal[R.top[0]]) + '</b> (' + R.top[1] + (R.top[1] === 1 ? ' vez' : ' veces') + ')</span></li>');
    var C = checkStats(R.mon, addDays(R.mon, 6));
    if (C.days >= 3) lines.push('<li>' + icon('thermo', 'ic-sm') + ' <span>' + CHECKS.map(function (x) { var a = avg(C.f[x.id]); return x.name + ' <b>' + (a === null ? '—' : a.toFixed(1)) + '</b>'; }).join(' · ') + ' <span class="muted">(de 5, ' + C.days + ' días)</span></span></li>');
    if (st.mov.due) lines.push('<li>' + icon('shoe', 'ic-sm') + ' <span>Movimiento: <b>' + st.mov.done + ' de ' + st.mov.due + '</b> (' + Math.round(st.mov.done / st.mov.due * 100) + '%)</span></li>');
    if (st.water.days >= 3) lines.push('<li>' + icon('glass', 'ic-sm') + ' <span>Agua: <b>' + avgGlasses(st.water) + '</b> vasos al día · meta en ' + st.water.goal + ' de ' + st.water.days + ' días</span></li>');
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

  /* ---------------- Gatos por semana cumplida ----------------
   * Cada semana completa dentro del plan (lunes a domingo) en la que cumples el 80% o más de tus
   * comidas te da un gato, en este orden. Sale de tus marcas, así que si marcas días pasados
   * después también cuenta. settings.catsSeen = cuántos ya celebraste. */
  var CAT_GOAL = 80;
  var CATS = [
    { id: 'marche', name: 'Marche', desc: 'Un gato blanco y delgado, de ojos gris azulado.',
      look: { bg: '#cfe0ec', ring: '#8fb0c9', fur: '#fdfaf4', line: '#b4a594', ear: '#f3b9c1', eye: '#8ea9c1', nose: '#ec9aa8', head: [20, 20], body: 20 } },
    { id: 'batmi', name: 'Batmi', desc: 'Un gato tuxedo gordito.',
      look: { bg: '#f6dc9c', ring: '#d6ad4f', fur: '#2a2522', line: '#17130f', ear: '#7a4f4f', eye: '#e9c55a', nose: '#f0a7b2', head: [26, 22], body: 32, cheeks: 1, tux: 1 } },
    { id: 'bumi', name: 'Bumi', desc: 'Un gato negro, chiquito y delgado, de ojos rasgados y verdes.',
      look: { bg: '#e2d3ee', ring: '#ab92c4', fur: '#2a2522', line: '#17130f', ear: '#6e4a4a', eye: '#a5d86a', nose: '#5c3d3d', head: [19, 18], body: 17, almond: 1, scale: 0.82 } },
    { id: 'tulin', name: 'Tulin', desc: 'Un gato atigrado, joven y hermoso, de nariz un poquito grande.',
      look: { bg: '#f6cbc6', ring: '#d8928a', fur: '#b59a7b', line: '#5e4836', ear: '#e7a9a5', eye: '#b8c86a', nose: '#d4847b', head: [22, 20], body: 23, stripes: '#6b523e', muzzle: '#efe2cf', bigNose: 1, lashes: 1 } },
    { id: 'naranjo', name: 'Naranjo', desc: 'Un gatito naranja muy simpático.',
      look: { bg: '#cfe7c3', ring: '#8fbd7c', fur: '#f2a654', line: '#8a5221', ear: '#f4b9b0', eye: '#e3b64a', nose: '#e88e8e', head: [24, 21], body: 21, stripes: '#d27f2f', muzzle: '#fbe7c9', kitten: 1, smile: 1, scale: 0.9 } },
    { id: 'olivo', name: 'Olivo', desc: 'Un gato negro, gordo y hermoso, de ojos verdes.',
      look: { bg: '#f7e4bb', ring: '#d3b06a', fur: '#2a2522', line: '#17130f', ear: '#6e4a4a', eye: '#8fcf5a', nose: '#5c3d3d', head: [28, 23], body: 38, cheeks: 1 } }
  ];
  var catSeq = 0;
  function n1(x) { return Math.round(x * 10) / 10; }
  function catSvg(c, locked) {
    var L = c.look, hx = L.head[0], hy = L.head[1], cx = 50, cy = 50, id = 'njcat' + (++catSeq);
    var fur = locked ? '#888' : L.fur, line = locked ? '#888' : L.line; // bloqueado: el color lo pone el CSS (.cat-svg.locked)
    var dark = /^#2/.test(L.fur);
    function ell(x, y, rx, ry, fill, extra) { return '<ellipse cx="' + n1(x) + '" cy="' + n1(y) + '" rx="' + n1(rx) + '" ry="' + n1(ry) + '" fill="' + fill + '"' + (extra || '') + '/>'; }
    function poly(pts, fill, extra) { return '<path d="M' + pts.map(function (p) { return n1(p[0]) + ' ' + n1(p[1]); }).join('L') + 'Z" fill="' + fill + '"' + (extra || '') + '/>'; }
    // Silueta: orejas, cuerpo, cabeza y cachetes. Primero el contorno (más grueso) y encima el relleno.
    var ears = [-1, 1].map(function (s) { return [[cx + s * hx * 0.95, cy - hy * 0.3], [cx + s * hx * 0.8, cy - hy * 1.48], [cx + s * hx * 0.15, cy - hy * 0.86]]; });
    var shapes = [
      function (f, x) { return ell(cx, cy + hy + 24, L.body, 30, f, x); },
      function (f, x) { return poly(ears[0], f, x) + poly(ears[1], f, x); },
      function (f, x) { return ell(cx, cy, hx, hy, f, x); }
    ];
    if (L.cheeks) shapes.push(function (f, x) { return ell(cx - hx * 0.62, cy + hy * 0.38, hx * 0.5, hy * 0.5, f, x) + ell(cx + hx * 0.62, cy + hy * 0.38, hx * 0.5, hy * 0.5, f, x); });
    var outline = ' stroke="' + line + '" stroke-width="3.2" stroke-linejoin="round"';
    var g = shapes.map(function (s) { return s(line, outline); }).join('') + shapes.map(function (s) { return s(fur); }).join('');
    if (!locked) {
      // Orejas por dentro
      g += ears.map(function (e) {
        var m = [(e[0][0] + e[1][0] + e[2][0]) / 3, (e[0][1] + e[1][1] + e[2][1]) / 3];
        return poly(e.map(function (p) { return [m[0] + (p[0] - m[0]) * 0.55, m[1] + (p[1] - m[1]) * 0.55 + 1.5]; }), L.ear);
      }).join('');
      var ny = cy + hy * 0.36, nw = hx * (L.bigNose ? 0.17 : 0.12);
      if (L.tux) { // pechera, hocico y una franja blanca entre los ojos
        g += ell(cx, cy + hy + 22, L.body * 0.42, 22, '#fbf7ef') + ell(cx, ny + 4, hx * 0.44, hy * 0.36, '#fbf7ef') +
          '<path d="M' + (cx - 3.4) + ' ' + n1(ny) + 'Q' + cx + ' ' + n1(cy - hy * 0.75) + ' ' + (cx + 3.4) + ' ' + n1(ny) + 'Z" fill="#fbf7ef"/>';
      }
      if (L.muzzle) g += ell(cx, ny + 3.5, hx * 0.42, hy * 0.32, L.muzzle);
      if (L.stripes) { // rayas: la “M” de la frente, cachetes y hombros
        var sw = ' fill="none" stroke="' + L.stripes + '" stroke-width="2.2" stroke-linecap="round"';
        g += '<path d="M' + cx + ' ' + n1(cy - hy * 0.92) + 'v' + n1(hy * 0.34) + 'M' + (cx - 5.5) + ' ' + n1(cy - hy * 0.86) + 'l1 ' + n1(hy * 0.3) + 'M' + (cx + 5.5) + ' ' + n1(cy - hy * 0.86) + 'l-1 ' + n1(hy * 0.3) +
          'M' + n1(cx - hx * 0.98) + ' ' + n1(cy + 2) + 'h' + n1(hx * 0.26) + 'M' + n1(cx - hx * 0.96) + ' ' + n1(cy + 7) + 'h' + n1(hx * 0.22) +
          'M' + n1(cx + hx * 0.98) + ' ' + n1(cy + 2) + 'h' + n1(-hx * 0.26) + 'M' + n1(cx + hx * 0.96) + ' ' + n1(cy + 7) + 'h' + n1(-hx * 0.22) +
          'M' + n1(cx - L.body * 0.75) + ' ' + n1(cy + hy + 12) + 'q4 3 7 1M' + n1(cx + L.body * 0.75) + ' ' + n1(cy + hy + 12) + 'q-4 3-7 1"' + sw + '/>';
      }
      // Ojos
      var er = hx * (L.kitten ? 0.21 : 0.17), ex = hx * 0.42, ey = cy - hy * 0.02;
      g += [-1, 1].map(function (s) {
        var x = cx + s * ex, o = '';
        if (L.almond) {
          o += '<g transform="translate(' + n1(x) + ' ' + n1(ey) + ') rotate(' + (s < 0 ? 16 : -16) + ')">' +
            '<path d="M' + n1(-er * 1.25) + ' 0Q0 ' + n1(-er * 1.1) + ' ' + n1(er * 1.25) + ' 0Q0 ' + n1(er * 1.1) + ' ' + n1(-er * 1.25) + ' 0Z" fill="' + L.eye + '"/>' +
            ell(0, 0, er * 0.28, er * 0.78, '#15110d') + '</g>';
        } else {
          o += ell(x, ey, er, er * 1.1, L.eye, dark ? '' : ' stroke="#6b5a4c" stroke-width=".8"') + ell(x, ey + er * 0.08, er * 0.42, er * 0.88, '#15110d');
        }
        o += '<circle cx="' + n1(x + s * er * 0.3 - er * 0.05) + '" cy="' + n1(ey - er * 0.45) + '" r="' + n1(er * 0.28) + '" fill="#fff"/>';
        if (L.lashes) o += '<path d="M' + n1(x + s * er * 0.95) + ' ' + n1(ey - er * 0.55) + 'l' + n1(s * 2.6) + ' -2.2" stroke="' + line + '" stroke-width="1.4" stroke-linecap="round"/>';
        return o;
      }).join('');
      // Nariz, boca, bigotes y chapitas
      var mc = dark ? '#cbbfb2' : line;
      g += '<path d="M' + n1(cx - nw) + ' ' + n1(ny) + 'L' + n1(cx + nw) + ' ' + n1(ny) + 'L' + cx + ' ' + n1(ny + nw * 0.9) + 'Z" fill="' + L.nose + '" stroke-linejoin="round"' + (dark ? '' : ' stroke="' + line + '" stroke-width=".8"') + '/>';
      var my = ny + nw * 0.9;
      g += L.smile
        ? '<path d="M' + (cx - 5) + ' ' + n1(my + 1.5) + 'Q' + cx + ' ' + n1(my + 8) + ' ' + (cx + 5) + ' ' + n1(my + 1.5) + 'Z" fill="#9b3f3f" stroke="' + mc + '" stroke-width="1.2" stroke-linejoin="round"/>' +
          ell(cx, my + 5.3, 2.4, 1.5, '#ef8f97')
        : '<path d="M' + cx + ' ' + n1(my) + 'v2M' + (cx - 4.2) + ' ' + n1(my + 2.6) + 'q2.1 1.6 4.2 -.6q2.1 2.2 4.2 .6" fill="none" stroke="' + mc + '" stroke-width="1.3" stroke-linecap="round"/>';
      var wc = dark ? '#d9d0c4' : '#8a7a6a';
      g += [-1, 1].map(function (s) {
        var x0 = cx + s * hx * 0.36;
        return '<path d="M' + n1(x0) + ' ' + n1(ny + 2) + 'l' + n1(s * (hx * 0.75 + 5)) + ' -3M' + n1(x0) + ' ' + n1(ny + 4) + 'l' + n1(s * (hx * 0.75 + 6)) + ' 1.5M' + n1(x0) + ' ' + n1(ny + 6) + 'l' + n1(s * (hx * 0.7 + 4)) + ' 5" stroke="' + wc + '" stroke-width=".9" stroke-linecap="round" opacity=".85"/>';
      }).join('');
      g += ell(cx - hx * 0.6, ny + 2.5, 3.6, 2.1, '#f29aa9', ' opacity="' + (dark ? '.35' : '.5') + '"') + ell(cx + hx * 0.6, ny + 2.5, 3.6, 2.1, '#f29aa9', ' opacity="' + (dark ? '.35' : '.5') + '"');
    }
    var sc = L.scale || 1, tf = sc !== 1 ? ' transform="translate(50 100) scale(' + sc + ') translate(-50 -100)"' : '';
    return '<svg class="cat-svg' + (locked ? ' locked' : '') + '" viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="' + id + '"><circle cx="50" cy="50" r="45.5"/></clipPath></defs>' +
      '<circle cx="50" cy="50" r="47" stroke-width="2.5" ' + (locked ? 'style="fill:var(--surface-2);stroke:var(--line-soft)"' : 'fill="' + L.bg + '" stroke="' + L.ring + '"') + '/>' +
      '<g clip-path="url(#' + id + ')"><g' + tf + '>' + g + '</g></g></svg>';
  }
  function catWeeks() { // semanas completas dentro del plan que ya terminaron, con su porcentaje
    var start = fromKey(D.PLAN.assigned), mon = mondayOf(start), t = today(), out = [];
    if (mon < start) mon = addDays(mon, 7);
    for (; addDays(mon, 6) < t; mon = addDays(mon, 7)) {
      var st = rangeStats(mon, addDays(mon, 6));
      out.push({ mon: mon, pct: st.pct, won: st.pct !== null && st.pct >= CAT_GOAL });
    }
    return out;
  }
  function earnedCats() { // [{ cat, mon, pct }] en el orden en que se ganaron (después del sexto, vuelve a empezar)
    var n = 0;
    return catWeeks().filter(function (w) { return w.won; }).map(function (w) { return { cat: CATS[n++ % CATS.length], mon: w.mon, pct: w.pct }; });
  }
  function catWeekNote(got) { // cómo va la semana actual hacia el siguiente gato
    var t = today(), mon = mondayOf(t), start = fromKey(D.PLAN.assigned), next = CATS[got.length % CATS.length];
    if (mon < start) return 'Tu primera semana completa empieza el ' + shortDate(keyOf(addDays(mondayOf(start), 7))).replace(/ \d{4}$/, '') + '. Con ' + CAT_GOAL + '% o más de tus comidas ganas a ' + next.name + '.';
    var st = rangeStats(mon, addDays(mon, 6));
    return (st.pct === null ? 'Esta semana aún no hay comidas que cuenten.' : 'Esta semana vas en <b>' + st.pct + '%</b>.') +
      ' Si cierras el domingo con ' + CAT_GOAL + '% o más, ganas ' + (got.length >= CATS.length ? 'otra vez ' : '') + 'a <b>' + next.name + '</b>.';
  }
  function catsCard() {
    var got = earnedCats();
    return '<section class="card cats-card"><h3 class="card-title">' + icon('cat') + ' Tus gatos</h3>' +
      '<p class="small muted">Cada semana que cumples el ' + CAT_GOAL + '% o más de tus comidas (lunes a domingo) ganas un gato.</p>' +
      '<ul class="plain cat-grid">' + CATS.map(function (c, i) {
        var mine = got.filter(function (x) { return x.cat === c; });
        return '<li class="cat-slot' + (mine.length ? ' is-won' : '') + '">' + (mine.length
          ? '<button class="cat-btn" data-action="open-cat" data-i="' + i + '" aria-label="' + c.name + ': ganado">' + catSvg(c) + '<b>' + c.name + '</b>' + (mine.length > 1 ? '<span class="badge">×' + mine.length + '</span>' : '') + '</button>'
          : '<div class="cat-btn" aria-label="Semana ' + (i + 1) + ': ' + c.name + ' aún no">' + catSvg(c, true) + '<b>' + c.name + '</b><span class="small muted">Semana ' + (i + 1) + '</span></div>') + '</li>';
      }).join('') + '</ul><p class="small">' + catWeekNote(got) + '</p></section>';
  }
  function catNewCard() { // en Hoy, cuando ganaste un gato que aún no celebras
    var got = earnedCats(), seen = S.settings.catsSeen || 0;
    if (got.length <= seen) return '';
    var x = got[got.length - 1];
    return '<section class="card cat-new"><div class="cat-new-art">' + catSvg(x.cat) + '</div><div class="cat-new-txt">' +
      '<div class="eyebrow">¡Semana cumplida! · ' + rangeText(x.mon, addDays(x.mon, 6)) + ' · ' + x.pct + '%</div>' +
      '<h3>Ganaste a ' + x.cat.name + '</h3><p class="small">' + x.cat.desc + '</p>' +
      '<div class="row-gap"><button class="btn primary" data-action="cats-seen" data-n="' + got.length + '">¡Hola, ' + x.cat.name + '!</button>' +
      '<button class="link-btn" data-action="goto-cats">Ver mis gatos</button></div></div></section>';
  }
  function catSheet(i) {
    var c = CATS[i], mine = earnedCats().filter(function (x) { return x.cat === c; });
    return '<div class="sheet-head"><span class="sheet-emoji roundel" style="--mc:var(--yellow)">' + icon('cat') + '</span>' +
      '<div class="sheet-titles"><div class="eyebrow">Tus gatos</div><h2 id="sheet-title">' + c.name + '</h2></div>' +
      '<button class="icon-btn" data-action="close-sheet" aria-label="Cerrar">' + icon('x') + '</button></div>' +
      '<div class="sheet-content cat-sheet"><div class="cat-big">' + catSvg(c, !mine.length) + '</div><p>' + c.desc + '</p>' +
      (mine.length ? '<p class="small muted">Lo ganaste ' + listText(mine.map(function (x) { return 'la semana del ' + rangeText(x.mon, addDays(x.mon, 6)) + ' (' + x.pct + '%)'; })) + '.</p>'
        : '<p class="small muted">Aún no lo ganas.</p>') + '</div>';
  }

  /* ---------------- ¿Cómo te sentiste? ----------------
   * Registro diario rápido (1–5) de energía, hambre entre comidas y digestión, más una nota.
   * Se guarda en days[k].ck = { e, h, d, n } y sale en el resumen para la revisión. */
  var CHECKS = [
    { id: 'e', name: 'Energía', q: '¿Cómo estuvo tu energía?', color: 'yellow', lab: ['Muy baja', 'Baja', 'Normal', 'Buena', 'Mucha'] },
    { id: 'h', name: 'Hambre', q: '¿Cuánta hambre tuviste entre comidas?', color: 'orange', lab: ['Nada', 'Poca', 'Normal', 'Bastante', 'Mucha'] },
    { id: 'd', name: 'Digestión', q: '¿Cómo estuvo tu digestión?', color: 'green', lab: ['Muy mal', 'Mal', 'Regular', 'Bien', 'Muy bien'] },
    { id: 's', name: 'Sueño', q: '¿Cómo dormiste anoche?', color: 'blue', lab: ['Muy mal', 'Mal', 'Regular', 'Bien', 'Muy bien'] }
  ];
  // Horas de sueño (opcional) en ck.hs, de 3 a 11 en medias horas
  var SLEEP_H = []; for (var sh = 3; sh <= 11; sh += 0.5) SLEEP_H.push(sh);
  function hoursText(h) { return (h % 1 ? Math.floor(h) + '½' : String(h)) + ' h'; }
  var CHECK = {}; CHECKS.forEach(function (c) { CHECK[c.id] = c; });
  function ckOf(k) { return dayRec(k).ck || {}; }
  function ckDone(k) { var c = ckOf(k); return CHECKS.every(function (x) { return c[x.id]; }); }
  // Eye and mouth shapes are shared across the three five-point scales.
  var catEyes = {
    sleepy: 'M9 17q2 2 4 0m6 0q2 2 4 0',
    low: 'M9 17h4m6 0h4',
    open: 'M11 16v2m10-2v2',
    bright: 'M11 15v3m10-3v3',
    happy: 'M9 17q2-4 4 0m6 0q2-4 4 0',
    tense: 'm9 15 4 2-4 1m14-3-4 2 4 1'
  };
  var catMouths = {
    calm: 'M13 22q3 2 6 0', flat: 'M14 22h4',
    smile: 'M12 21q4 6 8 0', grin: 'M12 21h8q-4 9-8 0Z',
    small: 'M15 23a1 1 0 1 0 2 0a1 1 0 1 0-2 0',
    round: 'M14 23a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
    wide: 'M13 23a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
    frown: 'M12 24q4-6 8 0', uneven: 'm13 23 6-2'
  };
  var catScales = {
    e: [['sleepy','small'], ['low','flat'], ['open','calm'], ['bright','smile'], ['happy','grin']],
    h: [['sleepy','calm'], ['low','calm'], ['open','small'], ['bright','round'], ['open','wide']],
    d: [['tense','frown'], ['low','uneven'], ['open','flat'], ['open','smile'], ['happy','grin']],
    s: [['tense','frown'], ['low','uneven'], ['open','flat'], ['happy','calm'], ['sleepy','smile']]
  };
  function checkinCat(field, level) {
    var face = catScales[field][level];
    return '<svg viewBox="0 0 32 32" class="checkin-cat" aria-hidden="true">' +
      '<path fill="#f4b768" d="M4 14 4 3q0-1 1 0l7 5q4-1 8 0l7-5q1-1 1 0v11c4 9-2 15-12 15S0 23 4 14Z"/>' +
      '<path fill="#e89184" d="m6 6 4 3-4 2zm20 0-4 3 4 2z"/>' +
      '<path fill="#dc914b" d="m12 8 2 4 1-4 2 5 2-5z"/>' +
      '<g fill="none" stroke="#38251c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="' + catEyes[face[0]] + '"/><path d="' + catMouths[face[1]] + '"/></g>' +
      '<path fill="#92563e" d="M14 19h4l-2 2z"/><path d="m3 20 4 1m18 0 4-1" stroke="#996443" stroke-linecap="round"/></svg>';
  }
  function checkinCard(k, isToday) {
    var c = ckOf(k), done = ckDone(k);
    return '<section class="card checkin" id="checkin"><div class="recap-head"><h3 class="card-title">' + icon('sun') + (isToday ? ' ¿Cómo te sentiste hoy?' : ' ¿Cómo te sentiste ese día?') + '</h3>' +
      (done ? '<span class="badge primary">Anotado ✓</span>' : '') + '</div>' +
      '<p class="small muted">Toca una carita en cada una. Te ayuda a contarle a tu nutrióloga cómo vas.</p>' +
      CHECKS.map(function (x) {
        var v = c[x.id];
        return '<div class="ck-row" style="--ckc:var(--' + x.color + ')"><div class="ck-q"><b>' + x.name + '</b> <span class="small muted">' + x.q + '</span>' +
          '<span class="ck-val">' + (v ? x.lab[v - 1] : '') + '</span></div>' +
          '<div class="ck-opts" role="radiogroup" aria-label="' + x.name + '">' + x.lab.map(function (label, i) {
            return '<button role="radio" class="ck-opt" aria-checked="' + (v === i + 1) + '" aria-label="' + x.name + ': ' + x.lab[i] + '" title="' + x.lab[i] + '" data-action="ck" data-k="' + k + '" data-f="' + x.id + '" data-v="' + (i + 1) + '">' + checkinCat(x.id, i) + '<span>' + label + '</span></button>';
          }).join('') + '</div>' + (x.id === 's' ? '<label class="ck-hours"><span class="small muted">Horas que dormiste</span><select data-input="ck-hours" data-k="' + k + '" aria-label="Horas que dormiste">' +
            '<option value="">—</option>' + SLEEP_H.map(function (h) { return '<option value="' + h + '"' + (c.hs === h ? ' selected' : '') + '>' + hoursText(h) + (h === 11 ? ' o más' : '') + '</option>'; }).join('') + '</select></label>' : '') + '</div>';
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
    var out = { days: 0, f: {}, train: {}, rest: {}, low: [], notes: [], hs: { s: 0, n: 0 }, short: {}, long: {} };
    CHECKS.forEach(function (x) { out.f[x.id] = { s: 0, n: 0 }; out.train[x.id] = { s: 0, n: 0 }; out.rest[x.id] = { s: 0, n: 0 }; out.short[x.id] = { s: 0, n: 0 }; out.long[x.id] = { s: 0, n: 0 }; });
    for (var d = from; d <= to; d = addDays(d, 1)) {
      var k = keyOf(d), c = ckOf(k), any = false, tr = isTraining(k);
      CHECKS.forEach(function (x) {
        var v = c[x.id]; if (!v) return;
        any = true; out.f[x.id].s += v; out.f[x.id].n++;
        var g = tr ? out.train[x.id] : out.rest[x.id]; g.s += v; g.n++;
        if (c.hs) { var sg = c.hs < 7 ? out.short[x.id] : out.long[x.id]; sg.s += v; sg.n++; }
      });
      if (c.hs) { out.hs.s += c.hs; out.hs.n++; any = true; }
      if (c.d && c.d <= 2) out.low.push(k);
      if (c.n) out.notes.push({ k: k, n: c.n });
      if (any) out.days++;
    }
    return out;
  }
  function avg(g) { return g.n ? g.s / g.n : null; }
  function sleepAvg(C) { return String(+(C.hs.s / C.hs.n).toFixed(1)) + ' h'; }
  function avgText(x, g) { var a = avg(g); return a === null ? '—' : a.toFixed(1).replace('.0', '') + ' de 5 · ' + lowerFirst(x.lab[Math.round(a) - 1]); }
  function checkInsights(C) { // frases cortas con diferencias claras entre días de ejercicio y descanso
    var out = [];
    ['h', 'e'].forEach(function (id) {
      var a = avg(C.train[id]), b = avg(C.rest[id]);
      if (a === null || b === null || C.train[id].n < 2 || C.rest[id].n < 2 || Math.abs(a - b) < 0.5) return;
      out.push(CHECK[id].name + ': ' + a.toFixed(1) + ' en días de ejercicio y ' + b.toFixed(1) + ' en descanso.');
    });
    ['e', 'h'].forEach(function (id) { // ¿cambia algo cuando duermes menos de 7 horas?
      var a = avg(C.short[id]), b = avg(C.long[id]);
      if (a === null || b === null || C.short[id].n < 2 || C.long[id].n < 2 || Math.abs(a - b) < 0.5) return;
      out.push(CHECK[id].name + ': ' + a.toFixed(1) + ' cuando dormiste menos de 7 h y ' + b.toFixed(1) + ' con 7 h o más.');
    });
    if (C.low.length) out.push('Digestión baja (mal o muy mal) en ' + C.low.length + (C.low.length === 1 ? ' día: ' : ' días: ') + listText(C.low.map(function (k) { return shortDate(k).replace(/ \d{4}$/, ''); })) + '.');
    return out;
  }

  /* ---------------- Agua ----------------
   * Vasos al día en days[k].wa (vaso = 250 ml). La meta se cambia en Ajustes (settings.waterGoal). */
  function waterGoal() { var g = S.settings.waterGoal; return g === (g | 0) && g >= 4 && g <= 16 ? g : 8; }
  function liters(n) { return String(+(n * 0.25).toFixed(2)); }
  function avgGlasses(w) { return String(+(w.sum / w.days).toFixed(1)); }
  function waterCard(k) {
    var n = dayRec(k).wa || 0, g = waterGoal(), slots = [];
    for (var i = 0; i < Math.max(g, n); i++) slots.push(i);
    return '<section class="card water" id="water"><div class="recap-head"><h3 class="card-title">' + icon('glass') + ' Agua</h3>' +
      '<span class="water-count' + (n >= g ? ' is-goal' : '') + '"><b>' + n + '</b> de ' + g + ' vasos · ' + liters(n) + ' L</span></div>' +
      '<div class="glasses" role="group" aria-label="Vasos de agua">' + slots.map(function (i) {
        var full = i < n, v = full && i === n - 1 ? i : i + 1; // tocar el último lleno lo vacía
        return '<button class="glass-btn' + (full ? ' is-full' : '') + '" data-action="water" data-k="' + k + '" data-v="' + v + '" aria-pressed="' + full + '" aria-label="Vaso ' + (i + 1) + '">' + icon('glass') + '</button>';
      }).join('') + '</div>' +
      '<div class="row-gap water-tools"><button class="chip-btn" data-action="water" data-k="' + k + '" data-v="' + (n + 1) + '">+ 1 vaso</button>' +
      (n ? '<button class="chip-btn" data-action="water" data-k="' + k + '" data-v="' + (n - 1) + '" aria-label="Quitar un vaso">− 1</button>' : '') +
      '<button class="link-btn" data-action="goto-sec" data-sec="ajustes">Meta: ' + g + ' vasos (' + liters(g) + ' L)</button></div></section>';
  }
  function setWater(k, v) {
    v = Math.max(0, Math.min(30, v | 0));
    var was = dayRec(k).wa || 0;
    setDay(k, function (r) { if (v) r.wa = v; else delete r.wa; });
    var y = window.scrollY; render(); window.scrollTo(0, y);
    if (v >= waterGoal() && was < waterGoal()) toast('¡Meta de agua cumplida!');
  }

  /* ---------------- Foto del plato ----------------
   * Una foto por comida, solo en este dispositivo: IndexedDB 'nutrijabon-fotos', clave 'YYYY-MM-DD|comida'.
   * Se reduce a 1200 px (JPEG) para que pese poco. No van en el respaldo (pesarían demasiado). */
  var PH = { db: null, keys: {}, urls: {}, ok: !!window.indexedDB };
  function phOpen() {
    return new Promise(function (res, rej) {
      if (PH.db) return res(PH.db);
      if (!PH.ok) return rej(new Error('sin IndexedDB'));
      var rq = indexedDB.open('nutrijabon-fotos', 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore('fotos'); };
      rq.onsuccess = function () { PH.db = rq.result; res(PH.db); };
      rq.onerror = function () { rej(rq.error); };
    });
  }
  function phTx(mode, fn) {
    return phOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('fotos', mode), rq = fn(tx.objectStore('fotos'));
        tx.oncomplete = function () { res(rq && rq.result); };
        tx.onerror = tx.onabort = function () { rej(tx.error); };
      });
    });
  }
  function phLoad() {
    return phTx('readonly', function (st) { return st.getAllKeys(); }).then(function (keys) {
      PH.keys = {}; (keys || []).forEach(function (key) { PH.keys[key] = true; });
    });
  }
  function phKey(k, mealId) { return k + '|' + mealId; }
  function phHas(k, mealId) { return !!PH.keys[phKey(k, mealId)]; }
  function phCount() { return Object.keys(PH.keys).length; }
  function phForget(key) { if (PH.urls[key]) { URL.revokeObjectURL(PH.urls[key]); delete PH.urls[key]; } }
  function phFill(root) { // pone cada foto en su <img data-ph="clave">
    if (!root) return;
    root.querySelectorAll('img[data-ph]').forEach(function (img) {
      var key = img.dataset.ph;
      if (PH.urls[key]) { img.src = PH.urls[key]; return; }
      phTx('readonly', function (st) { return st.get(key); }).then(function (blob) {
        if (!blob) return;
        PH.urls[key] = PH.urls[key] || URL.createObjectURL(blob);
        img.src = PH.urls[key];
      }, function () { /* sin acceso a las fotos */ });
    });
  }
  function shrinkPhoto(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, sc = Math.min(1, 1200 / Math.max(w, h));
        var cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(w * sc)); cv.height = Math.max(1, Math.round(h * sc));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) { if (b) res(b); else rej(new Error('toBlob')); }, 'image/jpeg', 0.75);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('imagen')); };
      img.src = url;
    });
  }
  function savePhoto(k, mealId, file) {
    if (!file || !/^image\//.test(file.type || 'image/')) { toast('Ese archivo no es una foto'); return; }
    var key = phKey(k, mealId);
    toast('Guardando foto…');
    shrinkPhoto(file).then(function (blob) {
      return phTx('readwrite', function (st) { return st.put(blob, key); });
    }).then(function () {
      phForget(key); PH.keys[key] = true;
      if (navigator.storage && navigator.storage.persist) { try { navigator.storage.persist(); } catch (e) { /* ignorar */ } }
      if (sheet) renderSheet();
      var y = window.scrollY; render(); window.scrollTo(0, y);
      toast('Foto guardada: ' + MEAL[mealId].name.toLowerCase());
    }, function () { toast('No se pudo guardar la foto en este navegador'); });
  }
  function delPhoto(key) {
    if (!window.confirm('¿Quitar esta foto? No se puede deshacer.')) return;
    phTx('readwrite', function (st) { return st.delete(key); }).then(function () {
      phForget(key); delete PH.keys[key];
      closeSheet(); render(); toast('Foto quitada');
    }, function () { toast('No se pudo quitar la foto'); });
  }
  function delAllPhotos() {
    var n = phCount(); if (!n) return;
    if (!window.confirm('¿Borrar tus ' + n + (n === 1 ? ' foto' : ' fotos') + ' de este dispositivo? No se puede deshacer.')) return;
    phTx('readwrite', function (st) { return st.clear(); }).then(function () {
      Object.keys(PH.urls).forEach(phForget); PH.keys = {};
      render(); toast('Fotos borradas');
    }, function () { toast('No se pudieron borrar'); });
  }
  function photoBtn(k, mealId) { // botón para tomar o elegir la foto (la cámara o la galería)
    if (!PH.ok || k > keyOf(today())) return '';
    var has = phHas(k, mealId);
    return '<label class="chip-btn file-btn photo-btn">' + icon('camera', 'ic-sm') + (has ? ' Cambiar foto' : ' Foto') +
      '<input type="file" accept="image/*" data-input="photo" data-k="' + k + '" data-meal="' + mealId + '" aria-label="' + (has ? 'Cambiar la foto de tu ' : 'Foto de tu ') + MEAL[mealId].name.toLowerCase() + '"></label>';
  }
  function photoThumb(k, mealId) {
    if (!phHas(k, mealId)) return '';
    var key = phKey(k, mealId);
    return '<button class="plate-thumb" data-action="open-photo" data-key="' + key + '" aria-label="Ver la foto de tu ' + MEAL[mealId].name.toLowerCase() + '"><img data-ph="' + key + '" alt=""></button>';
  }
  function photoSheet(key) {
    var p = key.split('|'), k = p[0], m = MEAL[p[1]], r = RECIPE[recipeId(k, m.id)];
    return '<div class="sheet-head"><span class="sheet-emoji roundel" style="--mc:var(--m-' + m.id + ')">' + icon('camera') + '</span>' +
      '<div class="sheet-titles"><div class="eyebrow">' + m.name + ' · ' + DAY_NAMES[wd(fromKey(k))] + ' ' + day2(k) + '</div><h2 id="sheet-title">' + esc(r.name) + '</h2></div>' +
      '<button class="icon-btn" data-action="close-sheet" aria-label="Cerrar">' + icon('x') + '</button></div>' +
      '<div class="sheet-content"><img class="plate-big" data-ph="' + key + '" alt="Foto de tu ' + m.name.toLowerCase() + ' del ' + day2(k) + '">' +
      '<p class="small muted">Solo está en este dispositivo. Sale en tu resumen para la revisión.</p></div>' +
      '<div class="sheet-actions">' + photoBtn(k, m.id).replace('chip-btn', 'btn') +
      '<button class="btn danger" data-action="del-photo" data-key="' + key + '">' + icon('x') + ' Quitar</button></div>';
  }
  function photosHtml() { // diario de fotos para el resumen (las más recientes primero)
    var start = D.PLAN.assigned, keys = Object.keys(PH.keys).filter(function (key) { return key.split('|')[0] >= start && MEAL[key.split('|')[1]]; }).sort().reverse();
    if (!keys.length) return '';
    var shown = keys.slice(0, 36);
    return '<h3 class="sec-title">Fotos de tus platos</h3><ul class="plain photo-diary">' + shown.map(function (key) {
      var p = key.split('|'), m = MEAL[p[1]], r = RECIPE[recipeId(p[0], m.id)];
      return '<li><button class="plate-thumb" data-action="open-photo" data-key="' + key + '"><img data-ph="' + key + '" alt=""></button>' +
        '<span class="small"><b>' + day2(p[0]) + ' · ' + m.name + '</b><br>' + esc(r.name) + '</span></li>';
    }).join('') + '</ul>' + (keys.length > shown.length ? '<p class="small muted">Y ' + (keys.length - shown.length) + ' fotos más en este dispositivo.</p>' : '');
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

    if (isToday) h += catNewCard();
    if (next) {
      var featured = meals.find(function (m) { return m.id === next.id; });
      h += '<ul class="meals featured">' + mealItem(k, featured, next) + '</ul>';
    }
    var notes = train
      ? '<div class="banner ok">' + icon('dumbbell') + '<div><b>Día de ejercicio:</b> incluye tu pre-entreno (' + esc(pre.name) + ') antes de entrenar.</div></div>'
      : '<div class="banner warn">' + icon('ban') + '<div><b>Día de descanso: no comas el pre-entreno</b> (' + esc(pre.name) + '). Son 1 fruta, 1 cereal y 1 grasa con proteína menos. Todo lo demás sigue igual.' +
        restMedsText() + '</div></div>';

    if (isToday) h += reviewCard();

    if (isToday) h += prepBanner() + recapCard() + checkinNudge(k);

    if (isToday && !S.settings.medsSeen) {
      notes += '<div class="banner info">' + icon('pill') + '<div><b>Nuevo:</b> marca ' + icon('check', 'ic-xs') + ' si cumpliste o ' + icon('x', 'ic-xs') +
        ' si no. Además puedes llevar tus vitaminas y medicamentos: tu vitamina ya está con el pre-entreno.<div class="row-gap banner-actions">' +
        '<button class="chip-btn" data-action="goto-sec" data-sec="tomas">' + icon('pill', 'ic-sm') + ' Agregar medicamento</button>' +
        '<button class="chip-btn" data-action="meds-seen">Entendido</button></div></div></div>';
    }

    h += '<div class="progress"><div class="progress-top"><span><b>' + done + '</b> de ' + active.length + ' comidas' + (missed ? ' · ' + missed + ' no' : '') + '</span>' +
      '<span class="muted">' + (isFullDay(k) && done ? '¡Día completo!' : pct + '%') + '</span></div>' +
      '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="width:' + pct + '%"></span></div></div>';

    h += '<ol class="meals">' + meals.filter(function (m) { return !next || m.id !== next.id; }).map(function (m) { return mealItem(k, m, null); }).join('') + '</ol>';
    h += '<details class="card acc day-notes" data-acc="dayNotes"' + (ui.open.dayNotes ? ' open' : '') + '><summary>Indicaciones del día' + icon('down', 'chev') + '</summary><div class="acc-body">' + notes + '</div></details>';
    if (diff <= 0) h += waterCard(k) + checkinCard(k, isToday);

    var tm = addDays(d, 1), tmk = keyOf(tm);
    var prep = sortedMeals().filter(function (m) { return !isSkipped(tmk, m); })
      .map(function (m) { return { m: m, r: RECIPE[recipeId(tmk, m.id)] }; })
      .filter(function (x) { return x.r.ahead; });
    if (prep.length) {
      h += '<section class="card"><h3 class="card-title">' + icon('clock') + ' Deja listo para mañana (' + DAY_NAMES[wd(tm)].toLowerCase() + ')</h3><ul class="plain">' +
        prep.map(function (x) {
          return '<li><button class="link-row" data-action="open-recipe" data-id="' + x.r.id + '" data-k="' + tmk + '" data-meal="' + x.m.id + '">' +
            '<span class="roundel sm" style="--mc:var(--m-' + x.m.id + ')">' + dishThumb(x.r) + '</span><span><b>' + x.m.name + ': ' + esc(x.r.name) + '</b><br><span class="small muted">' + x.r.ahead + '</span></span></button></li>';
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
        '<div class="dish struck"><span class="roundel">' + dishThumb(r) + '</span><span>' + esc(r.name) + '</span></div>' +
        '<p class="small muted">Solo en días de ejercicio. <button class="link-btn" data-action="set-ex" data-v="1">¿Sí hiciste ejercicio?</button></p>' +
        '</div></article>' + medRows(k, m, meds, true) + actRows(k, m) + '</li>';
    }
    var mk = markOf(k, m.id), done = mk === true, missed = mk === false, isNext = next && next.id === m.id;
    var badges = (isNext ? '<span class="badge primary">' + (next.now ? 'Toca ahora' : 'Siguiente') + '</span>' : '') +
      (missed ? '<span class="badge miss">No cumplí</span>' : '') +
      (m.trainingOnly ? '<span class="badge">Antes de entrenar</span>' : '') +
      (rid !== defaultRecipe(k, m.id) ? '<span class="badge">Cambiado</span>' : '') +
      (tasteOf(rid) === 1 ? '<span class="badge">' + icon('heart', 'ic-sm') + ' Favorita</span>' : tasteOf(rid) === -1 ? '<span class="badge">' + icon('dislike', 'ic-sm') + ' No te gusta</span>' : '') +
      (r.extra ? '<span class="badge">Idea extra</span>' : '');
    var foldKey = 'meal-' + k + '-' + m.id;
    var summary = isNext ? '' : '<details class="timeline-item" data-acc="' + foldKey + '"' + (ui.open[foldKey] ? ' open' : '') + '><summary><time>' + t + '</time><span class="timeline-label"><small>' + m.name + '</small><b>' + esc(r.name) + '</b></span>' +
      (phHas(k, m.id) ? '<span class="timeline-photo" title="Con foto">' + icon('camera', 'ic-sm') + '<span class="sr-only">Con foto</span></span>' : '') +
      (done || missed ? '<span class="timeline-status">' + (done ? 'Sí cumplí' : 'No cumplí') + '</span>' : '') + icon('down', 'chev') + '</summary>';
    return '<li class="meal' + (done ? ' is-done' : '') + (missed ? ' is-missed' : '') + (isNext ? ' is-next' : '') + '">' +
      summary + '<article class="meal-card"' + mc + '><div class="meal-main">' + (isNext ? dishArt(r) : '') +
      '<div class="meal-top">' + clock + '<span class="meal-name">' + m.name + '</span>' + badges + '</div>' +
      '<button class="dish" data-action="open-recipe" data-id="' + r.id + '" data-k="' + k + '" data-meal="' + m.id + '"><span class="roundel">' + dishThumb(r) + '</span><span class="dish-name">' + esc(r.name) + '</span>' + icon('right', 'ic-sm') + '</button>' +
      eqChips(m.eq) +
      '<div class="meal-actions"><button class="chip-btn" data-action="open-recipe" data-id="' + r.id + '" data-k="' + k + '" data-meal="' + m.id + '">' + icon('book', 'ic-sm') + ' Ver receta</button>' +
      '<button class="chip-btn" data-action="open-swap" data-k="' + k + '" data-meal="' + m.id + '">' + icon('swap', 'ic-sm') + ' Cambiar</button>' + photoBtn(k, m.id) + '</div>' +
      photoThumb(k, m.id) + '</div>' + markBtns(mk, m.name, 'data-action="mark" data-k="' + k + '" data-meal="' + m.id + '"', '') +
      (missed ? whyChips('meal', k, m.id, whyOf(k, 'why', m.id)) : '') +
      '</article>' + (isNext ? '' : '</details>') + medRows(k, m, meds, false) + actRows(k, m) + '</li>';
  }
  // Razones rápidas al marcar ✗ (opcional; tocar la elegida la quita)
  function whyChips(kind, k, id, cur) {
    return '<div class="why" role="group" aria-label="¿Por qué no se cumplió?"><span class="why-q">¿Por qué?</span>' +
      REASONS[kind].map(function (x) {
        return '<button class="why-chip" aria-pressed="' + (cur === x[0]) + '" data-action="why" data-kind="' + kind + '" data-k="' + k + '" data-id="' + id + '" data-r="' + x[0] + '">' +
          '<span aria-hidden="true">' + icon(x[1], 'ic-sm') + '</span> ' + x[2] + '</button>';
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
    if (ui.semMode === 'month') return viewMes();
    var mon = addDays(mondayOf(today()), ui.weekOffset * 7), tk = keyOf(today());
    var days = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return addDays(mon, i); });
    var nTrain = days.filter(function (d) { return isTraining(keyOf(d)); }).length;
    var h = '<div class="stack"><h2 class="page-title">Semana</h2>' + semSwitch() + weekNav('week', mon, ui.weekOffset) + '<div class="day-picker" role="group" aria-label="Día de la semana">' + days.map(function (d, i) {
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
            '<span class="t">' + mealTime(m.id) + '</span><span class="n"><span class="emoji">' + dishThumb(r) + '</span> ' + esc(r.name) + '</span>' +
            (meds.length ? '<span class="mini-med" title="' + esc(medTitle) + '">' + icon('pill', 'ic-sm') + '<span class="sr-only">' + esc(medTitle) + '</span></span>' : '') +
            (dn ? icon('check', 'ic-sm ok') : ms ? '<span class="mini-miss" title="No cumplí' + (whyOf(k, 'why', m.id) ? ': ' + REASON_TEXT.meal[whyOf(k, 'why', m.id)] : '') + '">' + icon('x', 'ic-sm miss') + '</span>' : '') + '</button></li>';
        }).join('') + '</ul>' + miniActs(k) + '</article>';
    }).join('') + '</div>' + catsCard() + bodyCard() + '</div>';
    return h;
  }
  /* ---------------- Mes ----------------
   * Cada día con un color según cuánto cumpliste de tus comidas (un solo tono, de claro a intenso),
   * más marquitas de movimiento completo, meta de agua y semana cumplida. Tocar un día lo abre en Hoy. */
  function semSwitch() {
    return '<div class="segmented switch" role="tablist" aria-label="Ver por semana o por mes">' +
      '<button role="tab" aria-selected="' + (ui.semMode !== 'month') + '" data-action="sem-mode" data-v="week">Semana</button>' +
      '<button role="tab" aria-selected="' + (ui.semMode === 'month') + '" data-action="sem-mode" data-v="month">Mes</button></div>';
  }
  function dayInfo(k) {
    var t = today(), tk = keyOf(t), d = fromKey(k), nm = nowMin();
    var o = { future: d > t, out: d < fromKey(D.PLAN.assigned), due: 0, done: 0, marked: 0, mov: { due: 0, done: 0 }, wa: dayRec(k).wa || 0, level: 'none' };
    if (o.future || o.out) return o;
    MEALS.forEach(function (m) {
      if (isSkipped(k, m)) return;
      var mk = markOf(k, m.id);
      if (k === tk && mk === undefined && toMin(mealTime(m.id)) > nm) return;
      o.due++; if (mk !== undefined) o.marked++; if (mk === true) o.done++;
    });
    actsFor(k).forEach(function (a) {
      var am = actMark(k, a.id);
      if (k === tk && am === undefined && toMin(mealTime(a.after)) > nm) return;
      o.mov.due++; if (am === true) o.mov.done++;
    });
    if (o.due) o.level = !o.marked ? 'unmarked' : isFullDay(k) ? 4 : o.done / o.due >= 0.8 ? 3 : o.done / o.due >= 0.5 ? 2 : 1;
    return o;
  }
  function monthGrid(first, interactive) {
    var y = first.getFullYear(), mo = first.getMonth(), n = new Date(y, mo + 1, 0).getDate(), tk = keyOf(today()), won = {}, cells = [];
    catWeeks().forEach(function (w) { if (w.won) won[keyOf(addDays(w.mon, 6))] = true; });
    for (var i = 0; i < wd(first); i++) cells.push('<span class="mc-cell is-blank" aria-hidden="true"></span>');
    for (var dd = 1; dd <= n; dd++) {
      var d = new Date(y, mo, dd), k = keyOf(d), x = dayInfo(k), movOk = x.mov.due && x.mov.done === x.mov.due, waOk = x.wa >= waterGoal();
      var lab = DAY_NAMES[wd(d)] + ' ' + dd + ': ' + (x.future ? 'aún no llega' : x.out ? 'antes de tu plan' : x.level === 'unmarked' ? 'sin marcar' : x.level === 'none' ? 'aún no toca' : x.done + ' de ' + x.due + ' comidas') +
        (x.mov.due ? ' · movimiento ' + x.mov.done + ' de ' + x.mov.due : '') + (x.wa ? ' · ' + x.wa + (x.wa === 1 ? ' vaso' : ' vasos') + ' de agua' : '') + (won[k] ? ' · semana cumplida' : '');
      var inner = '<b>' + dd + '</b><span class="mc-marks">' + (movOk ? icon('shoe', 'mc-ic') : '') + (waOk ? icon('glass', 'mc-ic') : '') + (won[k] ? icon('cat', 'mc-ic') : '') + '</span>';
      var cls = 'mc-cell lv-' + x.level + (k === tk ? ' is-today' : '');
      cells.push(interactive
        ? '<button class="' + cls + '" data-action="goto-day" data-k="' + k + '" aria-label="' + lab + '" title="' + lab + '">' + inner + '</button>'
        : '<span class="' + cls + '" title="' + lab + '">' + inner + '</span>');
    }
    return '<div class="month-grid" role="group" aria-label="' + MONTHS[mo] + ' ' + y + '">' +
      DAY_LETTER.map(function (l) { return '<span class="mc-head" aria-hidden="true">' + l + '</span>'; }).join('') + cells.join('') + '</div>';
  }
  function monthLegend() {
    return '<div class="mc-legend" aria-label="Colores: cuánto cumpliste de tus comidas">' +
      [['1', 'menos de 50%'], ['2', '50 a 79%'], ['3', '80% o más'], ['4', 'día completo'], ['unmarked', 'sin marcar']].map(function (x) {
        return '<span><i class="mc-sw lv-' + x[0] + '"></i>' + x[1] + '</span>';
      }).join('') + '</div>' +
      '<p class="small muted mc-key">' + icon('shoe', 'ic-xs') + ' movimiento completo · ' + icon('glass', 'ic-xs') + ' meta de agua · ' + icon('cat', 'ic-xs') + ' semana cumplida</p>';
  }
  function monthTitle(first) { return MONTHS[first.getMonth()].charAt(0).toUpperCase() + MONTHS[first.getMonth()].slice(1) + ' ' + first.getFullYear(); }
  function viewMes() {
    var t = today(), first = new Date(t.getFullYear(), t.getMonth() + ui.monthOffset, 1), last = new Date(first.getFullYear(), first.getMonth() + 1, 0), off = ui.monthOffset;
    var h = '<div class="stack"><h2 class="page-title">Semana</h2>' + semSwitch() +
      '<section class="day-head"><div class="day-nav">' +
      '<button class="icon-btn" data-action="month-shift" data-n="-1" aria-label="Mes anterior">' + icon('left') + '</button>' +
      '<div class="day-title"><div class="eyebrow">' + (off === 0 ? 'Este mes' : off === -1 ? 'Mes pasado' : off === 1 ? 'Próximo mes' : '&nbsp;') + '</div><h2>' + monthTitle(first) + '</h2></div>' +
      '<button class="icon-btn" data-action="month-shift" data-n="1" aria-label="Mes siguiente">' + icon('right') + '</button></div></section>';
    var st = first > t || last < fromKey(D.PLAN.assigned) ? null : rangeStats(first, last);
    if (st && st.due) {
      h += '<div class="stats">' + statTile('yellow', pctText(st), 'de las comidas cumplidas') + statTile('green', st.full + '<small>/' + st.days + '</small>', 'días completos') +
        (st.mov.due ? statTile('pink', Math.round(st.mov.done / st.mov.due * 100) + '%', 'de tu movimiento') : statTile('pink', st.miss, st.miss === 1 ? 'comida no cumplida' : 'comidas no cumplidas')) + '</div>' +
        '<p class="small muted">Hasta hoy: ' + markSummary(st) + '.' + (st.water.days ? ' Agua: ' + avgGlasses(st.water) + ' vasos al día en promedio.' : '') + '</p>';
    }
    h += '<section class="card month-card">' + monthGrid(first, true) + monthLegend() + '</section>' +
      '<p class="hint center">Toca un día para verlo y marcarlo.</p>';
    return h + '</div>';
  }
  function monthsHtml() { // para el resumen: un mes por cuadrícula, desde el inicio del plan
    var start = fromKey(D.PLAN.assigned), t = today(), out = '';
    for (var m = new Date(start.getFullYear(), start.getMonth(), 1); m <= t; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      out += '<div class="month-print"><h4 class="sec-title">' + monthTitle(m) + '</h4>' + monthGrid(m, false) + '</div>';
    }
    return out ? '<h3 class="sec-title">Día por día</h3><div class="months">' + out + '</div>' + monthLegend() : '';
  }
  function miniActs(k) {
    var acts = actsFor(k); if (!acts.length) return '';
    return '<ul class="plain mini-acts" aria-label="Movimiento">' + acts.map(function (a) {
      var am = actMark(k, a.id);
      return '<li class="' + (am === true ? 'is-done' : am === false ? 'is-missed' : '') + '"><button class="mini-act" data-action="goto-day" data-k="' + k + '">' + actIcon(a, 'ic-sm') +
        '<span>' + esc(actName(a)) + '</span>' + (am === true ? icon('check', 'ic-sm ok') : am === false ? icon('x', 'ic-sm miss') : '') + '</button></li>';
    }).join('') + '</ul>';
  }

  /* ---------------- Peso y medidas ----------------
   * S.body['YYYY-MM-DD'] = { w: kg, ci: cintura cm, ca: cadera cm } (cualquiera puede faltar).
   * Solo se guarda en el dispositivo y sale en el resumen para la revisión. */
  var BODY = [['w', 'Peso', 'kg', 25, 300], ['ci', 'Cintura', 'cm', 30, 250], ['ca', 'Cadera', 'cm', 30, 250]];
  function bodyKeys(f) { return Object.keys(S.body || {}).filter(function (k) { return !f || S.body[k][f] != null; }).sort(); }
  function fmtBody(v) { return String(+v.toFixed(1)); }
  function bodyDelta(f) { // { first, last, d } del primer al último registro con ese dato
    var ks = bodyKeys(f); if (ks.length < 2) return null;
    var a = ks[0], b = ks[ks.length - 1];
    return { first: a, last: b, d: S.body[b][f] - S.body[a][f] };
  }
  function deltaText(x, unit) { // neutral: solo el número y desde cuándo
    var d = +x.d.toFixed(1);
    return (d > 0 ? '+' : d < 0 ? '−' : '') + fmtBody(Math.abs(d)) + ' ' + unit;
  }
  function day2(k) { return shortDate(k).replace(/ \d{4}$/, ''); }
  function bodyCard() {
    var ks = bodyKeys(), h = '<section class="card body-card"><h3 class="card-title">' + icon('scale') + ' Peso y medidas</h3>';
    if (!ks.length) {
      return h + '<p class="small muted">Anota tu peso y, si quieres, cintura y cadera; por ejemplo cada lunes en ayunas. Salen en tu resumen para la revisión.</p>' +
        '<div><button class="btn primary" data-action="open-body">' + icon('scale') + ' Anotar</button></div></section>';
    }
    var tiles = BODY.map(function (b) {
      var fk = bodyKeys(b[0]); if (!fk.length) return '';
      var x = bodyDelta(b[0]);
      return '<div class="stat" style="--sc:var(--blue)"><b>' + fmtBody(S.body[fk[fk.length - 1]][b[0]]) + '<small> ' + b[2] + '</small></b><span>' + b[1] + '</span>' +
        (x ? '<span class="stat-delta">' + deltaText(x, b[2]) + '</span>' : '') + '</div>';
    }).join('');
    return h + '<div class="stats">' + tiles + '</div>' +
      '<p class="small muted">Último registro: ' + day2(ks[ks.length - 1]) + (ks.length > 1 ? ' · cambio desde el ' + day2(ks[0]) : '') + '.</p>' + weightChart() +
      '<div class="row-gap"><button class="btn primary" data-action="open-body">' + icon('scale') + ' Anotar</button></div></section>';
  }
  function weightChart() { // una sola serie: peso en el tiempo (línea + área tenue, toca para ver cada valor)
    var ks = bodyKeys('w'); if (ks.length < 2) return '';
    var t0 = fromKey(ks[0]).getTime(), t1 = fromKey(ks[ks.length - 1]).getTime(), span = Math.max(t1 - t0, 864e5);
    var vs = ks.map(function (k) { return S.body[k].w; }), lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs);
    var pad = Math.max(0.5, (hi - lo) * 0.15); lo = Math.floor((lo - pad) * 2) / 2; hi = Math.ceil((hi + pad) * 2) / 2;
    var W = 320, H = 150, l = 38, r = 12, top = 12, bot = 24;
    function X(k) { return l + (fromKey(k).getTime() - t0) / span * (W - l - r); }
    function Y(v) { return top + (hi - v) / (hi - lo) * (H - top - bot); }
    var pts = ks.map(function (k) { return [n1(X(k)), n1(Y(S.body[k].w))]; });
    var line = 'M' + pts.map(function (p) { return p.join(' '); }).join('L');
    var area = line + 'L' + pts[pts.length - 1][0] + ' ' + (H - bot) + 'L' + pts[0][0] + ' ' + (H - bot) + 'Z';
    var ticks = [lo, (lo + hi) / 2, hi];
    var data = ks.map(function (k, i) { return { x: pts[i][0], y: pts[i][1], t: day2(k) + ': ' + fmtBody(S.body[k].w) + ' kg' }; });
    return '<figure class="wchart-wrap"><figcaption class="small muted">Peso (kg)</figcaption>' +
      '<div class="wchart" data-pts=\'' + JSON.stringify(data) + '\'><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Peso del ' + day2(ks[0]) + ' (' + fmtBody(vs[0]) + ' kg) al ' + day2(ks[ks.length - 1]) + ' (' + fmtBody(vs[vs.length - 1]) + ' kg)">' +
      ticks.map(function (v) { var y = n1(Y(v)); return '<line class="wc-grid" x1="' + l + '" x2="' + (W - r) + '" y1="' + y + '" y2="' + y + '"/><text class="wc-lab" x="' + (l - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + fmtBody(v) + '</text>'; }).join('') +
      '<text class="wc-lab" x="' + l + '" y="' + (H - 6) + '">' + day2(ks[0]) + '</text><text class="wc-lab" x="' + (W - r) + '" y="' + (H - 6) + '" text-anchor="end">' + day2(ks[ks.length - 1]) + '</text>' +
      '<path class="wc-area" d="' + area + '"/><path class="wc-line" d="' + line + '"/>' +
      pts.map(function (p) { return '<circle class="wc-dot" cx="' + p[0] + '" cy="' + p[1] + '" r="4"/>'; }).join('') +
      '<line class="wc-cross" x1="0" x2="0" y1="' + top + '" y2="' + (H - bot) + '" visibility="hidden"/></svg><div class="wc-tip" hidden></div></div></figure>';
  }
  function chartHover(e) { // cruz vertical + valor del punto más cercano
    var box = e.target.closest && e.target.closest('.wchart'); if (!box) return;
    var svg = box.querySelector('svg'), rc = svg.getBoundingClientRect(), pts = JSON.parse(box.dataset.pts);
    var x = (e.clientX - rc.left) / rc.width * 320, best = pts[0];
    pts.forEach(function (p) { if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p; });
    var cross = svg.querySelector('.wc-cross'), tip = box.querySelector('.wc-tip');
    cross.setAttribute('x1', best.x); cross.setAttribute('x2', best.x); cross.setAttribute('visibility', 'visible');
    svg.querySelectorAll('.wc-dot').forEach(function (d) { d.classList.toggle('is-on', +d.getAttribute('cx') === best.x); });
    tip.textContent = best.t; tip.hidden = false;
    tip.style.left = Math.min(Math.max(best.x / 320 * 100, 18), 82) + '%';
    tip.style.top = (best.y / 150 * rc.height - 34) + 'px';
  }
  function chartLeave(e) {
    var box = e.target.closest && e.target.closest('.wchart'); if (!box || box.contains(e.relatedTarget)) return;
    box.querySelector('.wc-cross').setAttribute('visibility', 'hidden'); box.querySelector('.wc-tip').hidden = true;
    box.querySelectorAll('.wc-dot').forEach(function (d) { d.classList.remove('is-on'); });
  }
  function bodySheet() {
    var tk = keyOf(today()), cur = S.body[tk] || {}, ks = bodyKeys().reverse();
    return '<div class="sheet-head"><span class="sheet-emoji roundel" style="--mc:var(--blue)">' + icon('scale') + '</span>' +
      '<div class="sheet-titles"><div class="eyebrow">Semana</div><h2 id="sheet-title">Peso y medidas</h2></div>' +
      '<button class="icon-btn" data-action="close-sheet" aria-label="Cerrar">' + icon('x') + '</button></div>' +
      '<div class="sheet-content"><div class="body-form">' +
      '<label class="time-row"><span>Fecha</span><input type="date" id="body-date" value="' + tk + '" max="' + tk + '" min="2020-01-01"></label>' +
      BODY.map(function (b) {
        return '<label class="time-row"><span>' + b[1] + ' <span class="muted small">(' + b[2] + ')</span></span><input type="number" id="body-' + b[0] + '" inputmode="decimal" step="0.1" min="' + b[3] + '" max="' + b[4] + '" value="' + (cur[b[0]] != null ? fmtBody(cur[b[0]]) : '') + '" placeholder="—"></label>';
      }).join('') +
      '<div><button class="btn primary" data-action="body-save">' + icon('check') + ' Guardar</button></div>' +
      '<p class="small muted">Puedes dejar vacío lo que no midas. Si ya anotaste esa fecha, se actualiza. Solo se guarda en este dispositivo.</p></div>' +
      (ks.length ? '<h3 class="sec-title">Tus registros</h3><table class="body-table"><thead><tr><th>Fecha</th>' + BODY.map(function (b) { return '<th>' + b[1] + '</th>'; }).join('') + '<th><span class="sr-only">Quitar</span></th></tr></thead><tbody>' +
        ks.map(function (k) {
          var e = S.body[k];
          return '<tr><td>' + day2(k) + '</td>' + BODY.map(function (b) { return '<td>' + (e[b[0]] != null ? fmtBody(e[b[0]]) + ' ' + b[2] : '—') + '</td>'; }).join('') +
            '<td class="del"><button class="icon-btn sm" data-action="body-del" data-k="' + k + '" aria-label="Quitar el registro del ' + day2(k) + '">' + icon('x') + '</button></td></tr>';
        }).join('') + '</tbody></table>' : '') + '</div>';
  }
  function saveBody() {
    var k = (document.getElementById('body-date') || {}).value || '', e = {}, any = false;
    if (!KEY_RE.test(k) || k > keyOf(today())) { toast('Elige una fecha de hoy o antes'); return; }
    for (var i = 0; i < BODY.length; i++) {
      var b = BODY[i], el = document.getElementById('body-' + b[0]), raw = (el.value || '').replace(',', '.').trim();
      if (!raw) continue;
      var v = +raw;
      if (!(v >= b[3] && v <= b[4])) { toast(b[1] + ': revisa el número'); el.focus(); return; }
      e[b[0]] = Math.round(v * 10) / 10; any = true;
    }
    if (!any) { toast('Escribe al menos un dato'); return; }
    S.body[k] = Object.assign({}, S.body[k] || {}, e);
    save(); renderSheet(); render();
    toast('Anotado: ' + day2(k));
  }
  function delBody(k) {
    if (!S.body[k] || !window.confirm('¿Quitar el registro del ' + day2(k) + '?')) return;
    delete S.body[k]; save(); renderSheet(); render();
  }

  /* ---------------- Vista: Recetas ---------------- */
  function viewRecetas() {
    var filters = [['all', 'Todas']].concat(MEALS.map(function (m) { return [m.id, m.name]; })).concat([['fav', 'Favoritas']]);
    return '<div class="stack"><header class="catalog-head"><h2 class="page-title">Recetas</h2></header>' +
      '<label class="search">' + emblem('findDish') + '<input type="search" placeholder="Busca un platillo o ingrediente…" value="' + esc(ui.rQuery) + '" data-input="rq" aria-label="Buscar recetas"></label>' +
      '<div class="chip-row">' + filters.map(function (f) {
        return '<button class="fchip" aria-pressed="' + (ui.rFilter === f[0]) + '" data-action="rfilter" data-v="' + f[0] + '">' + emblem(f[0]) + '<span>' + f[1] + '</span></button>';
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
      ? '<p class="empty">Aún no tienes favoritas. Abre una receta y toca ' + emblem('fav') + ' Me gusta.</p>'
      : '<p class="empty">No encontré recetas con eso. Prueba con otro ingrediente.</p>';
    return MEALS.filter(function (m) { return list.some(function (r) { return r.meal === m.id; }); }).map(function (m) {
      return '<section class="recipe-group"><h3 class="group-title">' + '<span class="recipe-group-name">' + emblem(m.id) + m.name + '</span> <span class="muted small">· ' + eqList(m.eq).join(' · ') + '</span></h3>' +
        '<div class="recipe-grid">' + list.filter(function (r) { return r.meal === m.id; }).map(function (r) {
          var pd = planDays(r);
          return '<button class="recipe-card" style="--mc:var(--m-' + r.meal + ')" data-action="open-recipe" data-id="' + r.id + '">' + dishArt(r) +
            '<span class="rc-name">' + esc(r.name) + (tasteOf(r.id) === 1 ? ' ' + emblem('fav') + '<span class="sr-only"> Favorita</span>' : tasteOf(r.id) === -1 ? ' ' + emblem('noTaste') + '<span class="sr-only"> No te gusta</span>' : '') + '</span><span class="rc-meta">' + (r.extra ? '<span class="badge">' + emblem('extra') + ' Idea extra</span>' : (pd ? 'En tu plan: ' + pd : '')) + '</span></button>';
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
          else it.units[ing.u] = (it.units[ing.u] || 0) + ing.q * serv(m.id);
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
  var SECTION_EMBLEMS = {
    all: '<path fill="#e8bf88" d="M5 4h21v24H5Z"/><path fill="#f5e5be" d="M8 4h17v21H8Z"/><path fill="#e8999d" d="M18 4h5v10l-2-2-3 2Z"/><path fill="none" d="M11 17h9m-9 3h6"/>',
    pre: '<path fill="#deb28c" d="M3 21q3-12 15-13c5-1 9 2 9 6q-1 8-17 12-9 2-7-5Z"/><path fill="#f5ce64" d="m21 2-8 12h5l-2 8L28 9h-7Z"/><path fill="none" d="m7 20 3-2"/>',
    des: '<path fill="#efc382" d="M6 15C0 12 3 6 9 5q7-4 15 0c7 2 7 8 2 10v12H6Z"/><path fill="#f6dfab" d="M9 14q-5-4 1-6 6-3 12 0 5 3 1 6v10H9Z"/><path fill="#efa56f" d="M12 17q2-5 7-3-1 6-7 3Z"/>',
    c1: '<path fill="#eabf9c" d="M20 11h5q6 1 3 7-2 2-7 2Z"/><path fill="#acc8ad" d="M3 10h20v9q0 7-10 7T3 19Z"/><path fill="#eddbac" d="M4 10q8-4 18 0-9 4-18 0Z"/><path fill="none" d="M9 6q-2-2 0-4m6 4q-2-2 0-4M4 28h20"/>',
    com: '<path fill="#9bbd89" d="M5 16q-4-7 3-8 3-6 8-1 6-5 9 2 6 2 3 7Z"/><path fill="#e9a28c" d="M2 15h28q-1 12-14 12T2 15Z"/><path fill="none" d="m8 20 4 2m1 6h7m-1-17 7-8"/>',
    c2: '<path fill="#e8999c" d="M5 12c0-6 15-6 16 0 0 6-6 15-9 15S5 19 5 12Z"/><path fill="#9fb883" d="m7 10 3-5 3 3 4-4 2 5-4 3Z"/><path fill="#e5bd81" d="M19 27q-1-9 10-13 2 10-6 14Z"/><path fill="none" d="m9 15 1 1m4 2 1-1m-4 5 1 1m10 2 4-6"/>',
    cen: '<path fill="#edc975" d="M20 2q-5 8 3 11-7 4-11-3-2-6 8-8Z"/><path fill="#b8c9ca" d="M4 23q2-11 12-11t12 11Z"/><path fill="#e0ac83" d="M2 24h28l-3 4H5Z"/><path fill="none" d="M9 19q1-3 4-4"/>',
    fav: '<path fill="#d99e81" d="M7 3h18v26l-9-5-9 5Z"/><path fill="#f7c9ba" d="M16 18l-5-5c-3-5 3-8 5-4 3-4 9-1 5 4Z"/>',
    noTaste: '<path fill="#d2bdad" d="M7 3h18v26l-9-5-9 5Z"/><path fill="none" d="M11 13h10"/>',
    findDish: '<path fill="#d2ddcc" d="M22 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0Z"/><path fill="#efb584" d="m19 20 3-3 8 9-3 3Z"/><path fill="none" d="M8 12q1-5 5-5"/>',
    timer: '<path fill="#edb58e" d="M27 18a11 11 0 1 1-22 0 11 11 0 1 1 22 0Z"/><path fill="#f7e7bc" d="M24 18a8 8 0 1 1-16 0 8 8 0 1 1 16 0Z"/><path fill="none" d="M12 3h8m-4 0v4m0 5v6l4 2m3-12 2-3"/>',
    extra: '<path fill="#ead17e" d="m15 3 3 8 8 3-8 4-3 8-4-8-8-4 8-3Z"/><path fill="#dda6b6" d="m25 18 2 4 4 2-4 2-2 4-2-4-4-2 4-2Z"/>',
    nutSeed: '<path fill="#e7bc8c" d="M5 24Q2 10 23 3q5 17-9 24-6 3-9-3Z"/><path fill="none" d="M8 24 21 7m-9 12 1-6m3 1 4-2"/>',
    tofu: '<path fill="#edd6a0" d="m3 12 13-7 13 7v12l-13 5-13-6Z"/><path fill="none" d="m3 12 13 6 13-6m-13 6v11m-9-13 2 1m11 4 2-1"/>',
    fru: '<path fill="#ef998d" d="M15 11c-8-5-15 5-9 14 3 5 6 1 9 2 6 4 12-3 12-10 0-6-7-9-12-6Z"/><path fill="#85ae75" d="M15 10q1-9 11-7-2 7-11 7Z"/><path fill="none" d="M14 11q1-5-3-8M8 17q0-2 2-3"/>',
    ver: '<path fill="#91bb79" d="M18 15q-1-8 2-12 4 2 2 8 2-7 7-7 1 7-7 11Z"/><path fill="#f5ae69" d="M4 28q2-10 9-18 4-4 9 0t0 9Q13 26 4 28Z"/><path fill="none" d="m13 14 3 3m-7 2 3 2"/>',
    pro: '<path fill="#df946f" d="M4 16C0 8 10 2 15 8c3 4-4 5-3 10 1 7-6 8-8-2Z"/><path fill="#a8b78a" d="M17 17c2-7 13-7 13 0-1 4-6 3-7 7-3 8-10 2-6-7Z"/><path fill="none" d="M7 12q0-3 4-4m8 13q0-3 4-4"/>',
    cer: '<path fill="#e5bb76" d="M3 22Q7 8 20 4c8-2 12 4 7 11-4 7-13 13-21 14-4 0-5-3-3-7Z"/><path fill="none" d="m12 12 4 5m2-10 4 5M7 18l4 4"/>',
    lec: '<path fill="#c5dce0" d="m9 4 12 0 4 7v17H6V11Z"/><path fill="#8db2b6" d="m21 4 4 7v17h-5V12Z"/><path fill="#f0d9a9" d="M10 17q7-5 7 1-1 6-7 5Z"/><path fill="none" d="M7 11h13M10 7h8"/>',
    gra: '<path fill="#9dbb79" d="M9 8c1-6 9-8 12 0 1 5 7 10 6 15-2 9-20 9-22 0-1-6 3-9 4-15Z"/><path fill="#e6ca83" d="M11 11c1-6 7-6 8 0 1 6 7 10 4 14-4 5-14 4-15-1-1-4 2-8 3-13Z"/><path fill="#b77a5a" d="M20 21a4 4 0 1 1-8 0 4 4 0 1 1 8 0Z"/>',
    desp: '<path fill="#b4c5be" d="M7 8h18v4l2 3-1 13H6L5 15l2-3Z"/><path fill="#deb68a" d="M6 4h20v5H6Z"/><path fill="#f5dfac" d="M7 16h18v8H7Z"/><path fill="none" d="M11 5v3m5-3v3m5-3v3m-9 12h8"/>',
    ex: '<path fill="#dca6ac" d="M4 6h5v13H4Zm9 0h5v13h-5Z"/><path fill="none" d="M9 12h4"/><path fill="#e8bc70" d="M26 12c-5 6-1 13 5 12-7 9-19 2-15-5 2-4 5-6 10-7Z"/>',
    plan: '<path fill="#ead7b3" d="M28 16a12 12 0 1 1-24 0 12 12 0 1 1 24 0Z"/><path fill="#a5bd89" d="M16 7a9 9 0 0 1 9 9h-9Z"/><path fill="#e8a887" d="M25 18q-1 6-7 7v-7Z"/><path fill="none" d="M13 8q-5 1-5 7"/>',
    eq: '<path fill="#95b781" d="M4 17Q1 7 14 5q0 10-10 12Z"/><path fill="#e7b57b" d="M18 27q-5-4 0-8c4-3 5 0 8-2 7-2 4 8-1 10-3 1-5 2-7 0Z"/><path fill="none" d="M18 7h9l-3-3m3 3-3 3M13 24H4l3-3m-3 3 3 3"/>',
    tips: '<path fill="#e9c47a" d="M8 14a8 8 0 1 1 16 0c0 4-4 6-5 10h-7c0-3-4-6-4-10Z"/><path fill="#9ebc83" d="M14 19q-4-8 6-9 0 7-6 9Z"/><path fill="none" d="M13 27h6M3 13h2m22 0h2M6 5l2 2m16 0 2-2"/>',
    fuera: '<path fill="#e9c09a" d="M5 12h22v16H5Z"/><path fill="#ef9ea2" d="m3 12 4-8h18l4 8q-2 5-6 1-4 4-7 0-4 4-7 0-4 3-6-1Z"/><path fill="none" d="M10 18h4v5h-4Zm9 10V18h5v10"/>',
    ajustes: '<path fill="#bad0d2" d="M4 5h24v22H4Z"/><path fill="none" d="M8 11h16M8 20h16"/><path fill="#f2c67b" d="M15 11a3 3 0 1 1-6 0 3 3 0 1 1 6 0Zm8 9a3 3 0 1 1-6 0 3 3 0 1 1 6 0Z"/>',
    tomas: '<path fill="#f2d9a2" d="M7 8h17v4l2 2v14H5V14l2-2Z"/><path fill="#a2bdb8" d="M7 3h17v6H7Z"/><path fill="#e5a2a8" d="m11 19 3-3a3 3 0 0 1 5 5l-3 3a3 3 0 0 1-5-5Z"/><path fill="none" d="m13 17 5 5"/>',
    avisos: '<path fill="#eab965" d="M5 22q4-4 4-10a7 7 0 0 1 14 0q0 6 4 10Z"/><path fill="#d99ba0" d="M13 25h6q-3 7-6 0Z"/><path fill="none" d="M4 8 2 12m26-4 2 4M15 3h2"/>',
    respaldo: '<path fill="#a4bfd0" d="M3 5h22v15H3Z"/><path fill="#dfc3a0" d="M1 24h18l-2 3H5Z"/><path fill="#efc27b" d="M19 13h10v15H19Z"/><path fill="none" d="M8 14h10m-4-4 4 4-4 4m9 7h2"/>',
    instalar: '<path fill="#a5bfc1" d="M8 3h17v26H8Z"/><path fill="#f5dfaf" d="M11 7h11v16H11Z"/><path fill="none" d="M16 10v9m-4-4 4 4 4-4m-5 10h3"/>',
    list: '<path fill="#edd6aa" d="M6 5h21v24H6Z"/><path fill="#edad98" d="M11 3h11v5H11Z"/><path fill="none" d="m9 14 2 2 3-4m2 3h7m-14 7 2 2 3-4m2 3h7"/>',
    pot: '<path fill="#e5ae80" d="M5 15h22v7q0 6-6 6H11q-6 0-6-6Z"/><path fill="#a9c4b8" d="M3 14q2-6 13-6t13 6Z"/><path fill="none" d="M13 6h6M2 18h3m22 0h3m-20 0v4"/>',
    moon: '<path fill="#e7be75" d="M19 4Q8 19 26 23C12 35 0 19 8 9q4-5 11-5Z"/><path fill="#e49da1" d="m25 4 1 4 4 1-4 1-1 4-1-4-3-1 3-1Z"/>',
    knife: '<path fill="#d4c29e" d="M3 9h23v18H3Z"/><path fill="#c6d6d3" d="M7 19 20 6l3 3-9 12Z"/><path fill="#d99079" d="m20 6 4-4 4 4-5 4Z"/>',
    mov: '<path fill="#a9c5d9" d="M3 24V12q0-2 2-2h3q2 4 6 4l2-4 5 5 8 3q3 1 3 4v2Z"/><path fill="#f2c67b" d="M3 23h28v4H3Z"/><path fill="none" d="m12 17 1.5 1.5m2-4 1.5 1.5"/>',
    home: '<path fill="#efc89b" d="M6 13h20v15H6Z"/><path fill="#d99789" d="m2 14 14-12 14 12-3 2-11-9-11 9Z"/><path fill="none" d="M10 20h12m-10 1v4h4v-4m3 0v4"/>'
  };
  function emblem(id) {
    return '<svg class="section-emblem" viewBox="0 0 32 32" aria-hidden="true">' + SECTION_EMBLEMS[id] + '</svg>';
  }


  function shopSwitch() {
    return '<div class="segmented switch" role="tablist" aria-label="Compras o prep">' +
      '<button role="tab" aria-selected="' + (ui.shopView !== 'prep') + '" data-action="shop-view" data-v="list">' + emblem('list') + ' Lista</button>' +
      '<button role="tab" aria-selected="' + (ui.shopView === 'prep') + '" data-action="shop-view" data-v="prep">' + emblem('pot') + ' Prep del domingo</button></div>';
  }
  function viewCompras() {
    var mon = shopMonday(), wk = keyOf(mon);
    if (ui.shopView === 'prep') return viewPrep(mon);
    var res = buildShopping(mon), checked = S.shop[wk] || {};
    var home = res.items.filter(function (i) { return isPantry(i.n); }), items = res.items.filter(function (i) { return !isPantry(i.n); });
    var nChecked = items.filter(function (i) { return checked[i.n]; }).length;
    var h = '<div class="stack"><h2 class="page-title">Compras</h2>' + weekNav('shop', mon, ui.shopOffset) + shopSwitch();
    h += '<div class="banner ok">' + icon('info') + '<div>Calculada con el menú de esa semana (incluye tus cambios de platillo): ' +
      res.trainDays + (res.trainDays === 1 ? ' día' : ' días') + ' con pre-entreno y ' + (7 - res.trainDays) + ' de descanso.' +
      (servings() > 1 ? ' Desayuno, comida y cena para ' + servings() + ' personas.' : '') + '</div></div>';
    h += servingsCtl(servings() > 1 ? 'Desayuno, comida y cena se multiplican; colaciones y pre-entreno son solo tuyos.' : 'Si alguien más come contigo desayuno, comida o cena, súbele y la lista se ajusta.');
    h += '<progress class="shop-meter" aria-label="Avance de compras" max="' + Math.max(1, items.length) + '" value="' + nChecked + '"></progress><div class="shop-tools"><span class="muted small" id="shop-count">' + nChecked + ' de ' + items.length + ' listos</span>' +
      '<div class="row-gap"><button class="chip-btn" data-action="shop-share">' + icon('share', 'ic-sm') + ' Compartir</button>' +
      '<button class="chip-btn" data-action="shop-clear">Desmarcar todo</button></div></div>';
    if (!Object.keys(S.settings.pantry || {}).length) {
      h += '<p class="small muted center">Toca ' + emblem('home') + ' en lo que siempre tienes en casa (sal, aceite, especias) y dejará de aparecer en la lista.</p>';
    }
    D.SHOP_CATS.forEach(function (cat) {
      var list = items.filter(function (i) { return i.c === cat.id; }).sort(function (a, b) { return a.n.localeCompare(b.n, 'es'); });
      if (!list.length) return;
      var group = 'shop-' + cat.id;
      var expanded = ui.open[group] === undefined ? cat === D.SHOP_CATS[0] : ui.open[group];
      h += '<details class="card acc" data-acc="' + group + '"' + (expanded ? ' open' : '') + '><summary><span>' + emblem(cat.id) + ' ' + cat.name + '</span>' + icon('down', 'chev') + '</summary><ul class="shop-list">'  +
        list.map(function (i) {
          var c = !!checked[i.n];
          return '<li class="shop-li"><label class="shop-item' + (c ? ' is-checked' : '') + '"><input type="checkbox" data-input="shop" data-wk="' + wk + '" data-n="' + esc(i.n) + '"' + (c ? ' checked' : '') + '>' +
            '<span class="si-name">' + esc(i.n) + '</span><span class="si-qty">' + esc(i.qty) + '</span></label>' +
            '<button class="pantry-btn" data-action="pantry" data-n="' + esc(i.n) + '" aria-label="Siempre tengo en casa: ' + esc(i.n) + '" title="Siempre tengo en casa">' + emblem('home') + '</button></li>';
        }).join('') + '</ul></details>';
    });
    if (home.length) {
      h += '<details class="card pantry-card"><summary><span class="emoji">' + emblem('home') + '</span> Siempre en casa (' + home.length + ')' + icon('down', 'chev') + '</summary>' +
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
    ['sat', 'moon', 'Sábado en la noche: remoja'],
    ['cook', 'pot', 'Domingo: cocina en tanda'],
    ['chop', 'knife', 'Domingo: lava y pica'],
    ['snack', 'gra', 'Domingo: deja listos tus snacks'],
    ['mar', 'desp', 'Domingo: marina para lunes a miércoles'],
    ['wed', 'moon', 'Miércoles en la noche: marina para jueves a domingo']
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
        uses.push({ i: i, m: m, x: serv(m.id), r: RECIPE[base ? D.WEEK[m.id][i] : recipeId(k, m.id)] });
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
        if (ing.q == null) a.free = true; else a.units[ing.u] = (a.units[ing.u] || 0) + ing.q * u.x;
        for (var n = 0; n < u.x; n++) a.uses.push({ q: ing.q, u: ing.u, i: u.i, rid: u.r.id });
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
      add('snack', s.id, r.name, '×' + us.reduce(function (t, u) { return t + u.x; }, 0) + ' · ' + daysText(uniq(us.map(function (u) { return u.i; }))), s.how, { rid: r.id });
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
      add(g.sec, r.id, r.name, (pro ? fmtIngX(pro, serv(r.meal)) + ' ' : '') + '×' + g.days.length + ' · ' + daysText(g.days),
        step + ' Una porción por tupper.', { rid: r.id });
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
      '<button class="btn primary cook-start" data-action="cook-prep">' + emblem('pot') + ' Hacer el prep en modo cocina</button>';
    h += '<div class="banner info">' + icon('clock') + '<div>Hecho con el menú de esa semana (incluye tus cambios de platillo). <b>Guárdalo bien:</b> refrigera lo cocido en cuanto se enfríe. ' +
      'Lo de lunes a miércoles va al refri; lo de jueves a domingo, congélalo en porciones y pásalo al refri la noche anterior.</div></div>';
    PREP_SECS.forEach(function (sec) {
      var list = tasks.filter(function (t) { return t.sec === sec[0]; }); if (!list.length) return;
      h += '<section class="card"><h3 class="card-title"><span class="emoji">' + emblem(sec[1]) + '</span> ' + sec[2] + '</h3><ul class="shop-list prep-list">' +
        list.map(function (t) {
          var c = !!done[t.id];
          return '<li><label class="shop-item prep-item' + (c ? ' is-checked' : '') + '"><input type="checkbox" data-input="prep" data-wk="' + wk + '" data-id="' + esc(t.id) + '"' + (c ? ' checked' : '') + '>' +
            '<span class="pi-txt"><span class="si-name">' + (t.rid ? dishThumb(RECIPE[t.rid]) + ' ' : '') + esc(t.title) + '</span><span class="pi-meta">' + esc(t.meta) + '</span><span class="pi-how">' + t.how + '</span></span></label>' +
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
    if (p) p.textContent = n === all.length ? '¡Listo!' : pct + '%';
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
    var lines = ['Lista de compras NutriJabón (' + mon.getDate() + ' ' + MONTHS_ABBR[mon.getMonth()] + ' – ' + sun.getDate() + ' ' + MONTHS_ABBR[sun.getMonth()] + ')' +
      (servings() > 1 ? ' · desayuno, comida y cena para ' + servings() : '')];
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
      accordion('ex', emblem('ex') + 'Ejercicio vs. descanso', exHtml()) +
      accordion('plan', emblem('plan') + 'Tu día en porciones', planHtml()) +
      accordion('eq', emblem('eq') + 'Equivalentes veganos', eqHtml()) +
      accordion('tips', emblem('tips') + 'Tips veganos', tipsHtml()) +
      accordion('fuera', emblem('fuera') + 'Comer fuera', outHtml()) +
      '<h3 class="section-heading">Preferencias y datos</h3>' +
      accordion('ajustes', emblem('ajustes') + 'Ajustes', settingsHtml()) +
      accordion('tomas', emblem('tomas') + 'Vitaminas y medicamentos', medsHtml()) +
      accordion('mov', emblem('mov') + 'Movimiento', actsHtml()) +
      accordion('avisos', emblem('avisos') + 'Recordatorios', remindHtml()) +
      accordion('respaldo', emblem('respaldo') + 'Respaldo y otros equipos', backupHtml()) +
      accordion('instalar', emblem('instalar') + 'Instalar en tus dispositivos', installHtml()) +
      '<p class="small muted center">Basado en el plan de tu nutrióloga del ' + shortDate(D.PLAN.assigned) + ' · Próxima revisión: ' + shortDate(reviewKey()) + '.<br>NutriJabón te ayuda a seguir tu plan; no sustituye la consulta profesional.</p></div>';
  }
  function exHtml() {
    var pres = D.RECIPES.filter(function (r) { return r.meal === 'pre' && !r.extra; }).map(function (r) { return dishThumb(r) + ' ' + esc(r.name); });
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
      return '<li><span class="emoji big">' + icon(FOOD_SYMBOLS[t.e]) + '</span><div><b>' + t.t + '</b><p>' + t.d + '</p></div></li>';
    }).join('') + '</ul>';
  }
  function dayChips() {
    return '<div class="day-chips">' + DAY_LETTER.map(function (l, i) {
      return '<button class="day-chip" aria-pressed="' + (S.settings.trainDays.indexOf(i) !== -1) + '" data-action="toggle-train-day" data-i="' + i + '" title="' + DAY_NAMES[i] + '" aria-label="' + DAY_NAMES[i] + '">' + l + '</button>';
    }).join('') + '</div>';
  }
  var THEMES = [['dark', 'Oscuro', 'moon'], ['light', 'Claro', 'sun'], ['auto', 'Automático', 'swap']];
  function themeSetting() { var t = S.settings.theme; return t === 'light' || t === 'auto' ? t : 'dark'; }
  function applyTheme() {
    var t = themeSetting(), dark = t === 'dark' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#191511' : '#f3ead6');
  }
  function settingsHtml() {
    var th = themeSetting(), wg = waterGoal(), goals = [];
    for (var i = 4; i <= 16; i++) goals.push(i);
    return '<h4 class="sec-title">Apariencia</h4><div class="segmented theme-pick" role="radiogroup" aria-label="Apariencia">' + THEMES.map(function (t) {
        return '<button role="radio" aria-checked="' + (th === t[0]) + '" data-action="theme" data-v="' + t[0] + '">' + icon(t[2], 'ic-sm') + ' ' + t[1] + '</button>';
      }).join('') + '</div>' +
      '<p class="small muted">' + (th === 'auto' ? 'Sigue el modo claro u oscuro de tu dispositivo.' : 'Automático sigue el modo claro u oscuro de tu dispositivo.') + '</p>' +
      '<h4 class="sec-title">¿Qué días haces ejercicio?</h4>' + dayChips() +
      '<p class="small muted">Son los días con pre-entreno. Para cambiar un día suelto, usa el selector en Hoy o la etiqueta en Semana. Tu pilates, caminata y fuerza se ajustan en <button class="link-btn" data-action="goto-sec" data-sec="mov">Movimiento</button>.</p>' +
      '<h4 class="sec-title">Agua al día</h4><label class="time-row"><span>Meta</span><select data-input="water-goal" aria-label="Meta de agua al día">' + goals.map(function (g) {
        return '<option value="' + g + '"' + (g === wg ? ' selected' : '') + '>' + g + ' vasos (' + liters(g) + ' L)</option>';
      }).join('') + '</select></label><p class="small muted">Un vaso = 250 ml. Si tu nutrióloga te indicó otra cantidad, cámbiala aquí.</p>' +
      '<h4 class="sec-title">Horarios</h4><div class="times">' + MEALS.map(function (m) {
        return '<label class="time-row"><span>' + m.name + '</span><input type="time" value="' + mealTime(m.id) + '" data-input="time" data-meal="' + m.id + '"></label>';
      }).join('') + '</div>' +
      '<div><button class="link-btn" data-action="reset-times">Restaurar horarios del plan</button></div>' +
      '<p class="small">' + icon('pill', 'ic-xs') + ' <button class="link-btn" data-action="goto-sec" data-sec="tomas">Vitaminas y medicamentos</button>: elige con qué comida va cada uno.</p>' +
      '<p class="small">' + icon('bell', 'ic-xs') + ' ¿Quieres avisos a estas horas? <button class="link-btn" data-action="goto-sec" data-sec="avisos">Agrégalos a tu calendario</button></p>' +
      '<h4 class="sec-title">Tus datos</h4>' + (phCount() ? '<p class="small">' + icon('camera', 'ic-xs') + ' ' + phCount() + (phCount() === 1 ? ' foto guardada' : ' fotos guardadas') + ' (no van en el respaldo). <button class="link-btn" data-action="del-photos">Borrar fotos</button></p>' : '') +
      '<p class="small muted">Todo se guarda solo en este dispositivo; nada se envía a internet. <button class="link-btn" data-action="goto-sec" data-sec="respaldo">Guarda un respaldo</button> para no perderlo.</p>' +
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
  /* Movimiento: caminata, pilates, fuerza… */
  var ACT_MINS = [0, 10, 15, 20, 30, 40, 45, 60, 90];
  function actsHtml() {
    var acts = S.settings.acts || [];
    return '<p>Cada actividad aparece en Hoy después de su comida, con ' + icon('check', 'ic-xs') + ' / ' + icon('x', 'ic-xs') + ' para marcar si la hiciste. Sale en tu resumen, en tus recordatorios y en Semana. No cambia tu porcentaje de comidas.</p>' +
      (acts.length ? '<ul class="plain med-list">' + acts.map(function (a) {
        var name = esc(a.name);
        return '<li class="med-row act-row" style="--mc:var(--m-' + a.after + ')"><div class="med-head"><span class="toma-ic">' + actIcon(a) + '</span><b>' + name + '</b>' +
          '<button class="icon-btn sm" data-action="act-del" data-id="' + a.id + '" aria-label="Quitar ' + name + '">' + icon('x') + '</button></div>' +
          '<div class="day-chips" role="group" aria-label="Días de ' + name + '">' + DAY_LETTER.map(function (l, i) {
            return '<button class="day-chip" aria-pressed="' + (a.days.indexOf(i) !== -1) + '" data-action="act-day" data-id="' + a.id + '" data-i="' + i + '" title="' + DAY_NAMES[i] + '" aria-label="' + DAY_NAMES[i] + '">' + l + '</button>';
          }).join('') + '</div>' +
          '<div class="med-fields"><label><span class="small muted">Después de</span><select data-input="act-after" data-id="' + a.id + '" aria-label="Después de qué comida va ' + name + '">' + mealOptions(a.after) + '</select></label>' +
          '<label><span class="small muted">Duración</span><select data-input="act-min" data-id="' + a.id + '" aria-label="Duración de ' + name + '">' + ACT_MINS.map(function (m) {
            return '<option value="' + m + '"' + (m === (a.min || 0) ? ' selected' : '') + '>' + (m ? m + ' min' : 'Sin indicar') + '</option>';
          }).join('') + '</select></label></div></li>';
      }).join('') + '</ul>' : '<p class="small muted">No tienes ninguna.</p>') +
      '<h4 class="sec-title">Agregar</h4><div class="med-form">' +
      '<input type="text" id="act-name" maxlength="40" placeholder="Nombre (ej.: Yoga)" aria-label="Nombre de la actividad" autocomplete="off">' +
      '<div class="med-fields"><label><span class="small muted">Tipo</span><select id="act-kind" aria-label="Tipo de actividad">' + ACT_KINDS.map(function (x) {
        return '<option value="' + x[0] + '"' + (x[0] === 'otro' ? ' selected' : '') + '>' + x[1] + '</option>';
      }).join('') + '</select></label>' +
      '<label><span class="small muted">Después de</span><select id="act-after" aria-label="Después de qué comida">' + mealOptions('cen') + '</select></label></div>' +
      '<div><button class="btn primary" data-action="act-add">' + icon('spark') + ' Agregar</button></div></div>' +
      '<p class="small muted">Se agrega para todos los días: toca las letras para quitar los que no van. Si ya tienes los recordatorios en tu calendario, vuelve a agregarlos para que incluyan los cambios.</p>';
  }
  function findAct(id) { return (S.settings.acts || []).filter(function (a) { return a.id === id; })[0]; }
  function addAct() {
    var inp = document.getElementById('act-name'), name = (inp && inp.value || '').trim().slice(0, 40);
    if (!name) { toast('Escribe el nombre'); if (inp) inp.focus(); return; }
    var kind = document.getElementById('act-kind').value, after = document.getElementById('act-after').value;
    S.settings.acts = (S.settings.acts || []).concat([{ id: 'a' + Date.now().toString(36), name: name, kind: ACT_ICON[kind] ? kind : 'otro', min: 0, days: [0, 1, 2, 3, 4, 5, 6], after: MEAL[after] ? after : 'cen' }]);
    save(); render();
    toast(name + ': ' + lowerFirst(AFTER_TEXT[MEAL[after] ? after : 'cen']));
  }
  function delAct(id) {
    var a = findAct(id);
    if (!a || !window.confirm('¿Quitar ' + a.name + ' de tu movimiento?')) return;
    S.settings.acts = S.settings.acts.filter(function (x) { return x.id !== id; });
    save(); render();
  }
  function toggleActDay(id, i) {
    var a = findAct(id); if (!a) return;
    var at = a.days.indexOf(i);
    if (at === -1) a.days.push(i); else a.days.splice(at, 1);
    a.days.sort();
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
    var until = start <= fromKey(reviewKey()) ? ';UNTIL=' + reviewKey().replace(/-/g, '') + 'T235959' : '';
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
            (m.id === 'cen' ? '\nAl terminar el día, anota en NutriJabón cómo te sentiste (energía, hambre, digestión y sueño).' : '')
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
    // Movimiento: un evento por comida y combinación de actividades, un rato después de esa comida
    MEALS.forEach(function (m) {
      var groups = {}, order = [];
      for (var i = 0; i < 7; i++) {
        var as = (S.settings.acts || []).filter(function (a) { return a.after === m.id && a.days.indexOf(i) !== -1; });
        if (!as.length) continue;
        var key = as.map(function (a) { return a.id; }).join('');
        if (!groups[key]) { groups[key] = { days: [], acts: as }; order.push(key); }
        groups[key].days.push(i);
      }
      var t = mealTime(m.id).split(':').map(Number), gap = m.id === 'pre' ? 15 : 30;
      var pm = m.id === 'pre' ? meds.filter(function (md) { return md.meal === 'pre' && md.when === 'all'; }) : [];
      var after = pm.length ? 'Después de tomar tu ' + lowerFirst(listText(pm.map(function (md) { return md.name; }))) : AFTER_TEXT[m.id];
      order.forEach(function (key) {
        var g = groups[key], first = start;
        while (g.days.indexOf(wd(first)) === -1) first = addDays(first, 1);
        var s = new Date(first.getFullYear(), first.getMonth(), first.getDate(), t[0], t[1] + gap);
        var mins = Math.max(30, g.acts.reduce(function (x, a) { return x + (a.min || 30); }, 0));
        var by = g.days.map(function (i) { return ICS_DAYS[i]; });
        var title = listText(g.acts.map(function (a, i) { return i ? lowerFirst(actName(a)) : actName(a); }));
        var desc = after + '.' + (url ? '\nMarca si lo hiciste en NutriJabón: ' + url : '');
        L.push('BEGIN:VEVENT', 'UID:nj-act-' + m.id + '-' + by.join('') + '-' + key + '@nutrijabon', 'DTSTAMP:' + stamp,
          'DTSTART:' + icsLocal(s), 'DTEND:' + icsLocal(new Date(s.getTime() + mins * 6e4)),
          'RRULE:FREQ=WEEKLY;BYDAY=' + by.join(',') + until,
          'SUMMARY:' + icsEsc(title), 'DESCRIPTION:' + icsEsc(desc), 'TRANSP:TRANSPARENT', 'CATEGORIES:NutriJabón',
          'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(title), 'TRIGGER:' + (lead ? '-PT' + lead + 'M' : 'PT0S'), 'END:VALARM',
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
  var ICS_NAME = 'NutriJabon-recordatorios.ics';
  function addToCalendar() {
    if (detectOS() === 'ios') { openSheet('cal', []); return; } // iPhone/iPad: pasos con Mail o Archivos
    downloadFile(ICS_NAME, 'text/calendar;charset=utf-8', buildIcs()); toast('Listo: abre el archivo descargado');
  }
  /* iPhone: dentro de la app instalada (y a veces en Safari) iOS no abre un archivo de calendario que arma la
   * página, así que no aparece nada. Lo que sí funciona es pasar el archivo a Mail o a Archivos con el menú
   * de compartir y abrirlo ahí: iOS muestra los eventos con “Agregar todo”. */
  function icsFile() { return new File([buildIcs()], ICS_NAME, { type: 'text/calendar' }); }
  function canShareIcs() { try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [icsFile()] })); } catch (e) { return false; } }
  function calSheet() {
    var share = canShareIcs();
    return '<div class="sheet-head"><span class="sheet-emoji roundel" style="--mc:var(--yellow)">' + icon('bell') + '</span>' +
      '<div class="sheet-titles"><div class="eyebrow">Recordatorios</div><h2 id="sheet-title">En tu iPhone</h2></div>' +
      '<button class="icon-btn" data-action="close-sheet" aria-label="Cerrar">' + icon('x') + '</button></div>' +
      '<div class="sheet-content"><p>El iPhone no abre el calendario directo desde la app, pero sí desde <b>Mail</b> o <b>Archivos</b>:</p>' +
      '<ol class="steps">' +
      (share ? '<li>Toca <b>Compartir el archivo</b> y elige <b>Mail</b>.</li><li>Envíalo a tu propio correo.</li>'
        : '<li>Toca <b>Descargar el archivo</b>: queda en la carpeta Descargas de la app <b>Archivos</b>.</li>') +
      (share ? '<li>Abre ese correo en la app <b>Mail</b> y toca el archivo <b>' + ICS_NAME + '</b>.</li>'
        : '<li>Abre la app <b>Archivos</b>, entra a <b>Descargas</b> y toca <b>' + ICS_NAME + '</b>.</li>') +
      '<li>Toca <b>Agregar todo</b> y elige tu calendario.</li></ol>' +
      (share ? '<p class="small muted">También puedes elegir <b>Guardar en Archivos</b> y abrirlo desde la app Archivos. Si no ves la opción de agregar en una app, prueba con la otra.</p>' : '') +
      '<details class="cook-more"><summary>Otra forma: abrir directo</summary><p class="small muted">A veces funciona en Safari (no en la app instalada en tu pantalla de inicio). Si no pasa nada, usa los pasos de arriba.</p>' +
      '<button class="btn" data-action="cal-direct">' + icon('calendar') + ' Abrir directo</button></details>' +
      '<p class="small muted">Si cambias horarios, días, actividades o tus vitaminas y medicamentos, borra los avisos anteriores en tu calendario y vuelve a hacer esto.</p></div>' +
      '<div class="sheet-actions">' + (share
        ? '<button class="btn primary" data-action="cal-share">' + icon('share') + ' Compartir el archivo</button>'
        : '<button class="btn primary" data-action="cal-download">' + icon('download') + ' Descargar el archivo</button>') + '</div>';
  }
  function shareIcs() {
    var f;
    try { f = icsFile(); } catch (e) { toast('No se pudo preparar el archivo'); return; }
    navigator.share({ files: [f], title: 'Recordatorios de NutriJabón' }).then(function () {
      toast('Listo. Ábrelo en Mail o Archivos y toca Agregar todo');
    }, function (err) {
      if (err && err.name === 'AbortError') return; // cerró el menú
      toast('No se pudo compartir; prueba Abrir directo');
    });
  }
  function openIcsDirect() { // lo de antes: el service worker sirve el .ics; si no hay, una dirección data:
    var ics = buildIcs();
    var dataUrl = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
    if (!(window.caches && navigator.serviceWorker && navigator.serviceWorker.controller)) { location.href = dataUrl; return; }
    caches.open(FILES_CACHE).then(function (c) {
      return c.put('recordatorios.ics', new Response(ics, { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } }));
    }).then(function () { location.href = 'recordatorios.ics'; }, function () { location.href = dataUrl; });
  }
  function remindHtml() {
    var os = detectOS(), lead = remindLead(), rev = shortDate(reviewKey()).replace(/ \d{4}$/, '');
    var notes = {
      ios: 'Te mostramos los pasos: lo compartes a <b>Mail</b> (o a Archivos), lo abres ahí y tocas <b>Agregar todo</b>.',
      android: 'Se descarga un archivo: ábrelo y elige tu app de calendario. Si Google Calendar no lo abre, impórtalo desde una computadora en <b>calendar.google.com</b> (Configuración → Importar y exportar) y te llegará al celular.',
      windows: 'Se descarga un archivo: ábrelo y se agrega a Outlook o a Calendario.',
      mac: 'Se descarga un archivo: ábrelo y elige en qué calendario guardarlo.'
    };
    var train = S.settings.trainDays.map(function (i) { return DAY_ABBR[i].toLowerCase(); });
    return '<p>Agrega tus comidas a tu calendario: te avisa a la hora de cada una con el platillo que toca ese día y las vitaminas o medicamentos que van con ella. ' +
      'También incluye tu movimiento (un rato después de su comida) y tu prep: sábado 9 pm (remojar), domingo 10 am (prep) y miércoles 9 pm (marinar). El pre-entreno solo aparece en tus días de ejercicio' +
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
    var st = isObj(d.settings) ? d.settings : {}, out = { settings: defaults(), days: {}, shop: {}, prep: {}, body: {} };
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
    if (Array.isArray(st.acts)) {
      out.settings.acts = st.acts.filter(function (a) {
        return isObj(a) && MED_ID.test(a.id) && typeof a.name === 'string' && a.name.trim() && MEAL[a.after] && Array.isArray(a.days);
      }).slice(0, 12).map(function (a) {
        return { id: a.id, name: a.name.trim().slice(0, 40), kind: ACT_ICON[a.kind] ? a.kind : 'otro', min: ACT_MINS.indexOf(a.min) !== -1 ? a.min : 0,
          days: [0, 1, 2, 3, 4, 5, 6].filter(function (i) { return a.days.indexOf(i) !== -1; }), after: a.after };
      });
    }
    if (st.waterGoal === (st.waterGoal | 0) && st.waterGoal >= 4 && st.waterGoal <= 16) out.settings.waterGoal = st.waterGoal;
    if (st.servings === (st.servings | 0) && st.servings >= 1 && st.servings <= 6) out.settings.servings = st.servings;
    if (KEY_RE.test(st.reviewDate || '')) out.settings.reviewDate = st.reviewDate;
    if (isObj(st.revPrep)) Object.keys(st.revPrep).forEach(function (rk) { // lista de la revisión: palomitas a mano y cuándo guardaste el resumen
      var x = st.revPrep[rk], o = {};
      if (!KEY_RE.test(rk) || !isObj(x)) return;
      if (isObj(x.m)) Object.keys(x.m).forEach(function (id) { if (x.m[id] === true && /^[a-z]{1,12}$/.test(id)) (o.m = o.m || {})[id] = true; });
      if (KEY_RE.test(x.rep || '')) o.rep = x.rep;
      if (Object.keys(o).length) (out.settings.revPrep = out.settings.revPrep || {})[rk] = o;
    });
    if (st.theme === 'light' || st.theme === 'auto' || st.theme === 'dark') out.settings.theme = st.theme;
    if (st.catsSeen === (st.catsSeen | 0) && st.catsSeen > 0 && st.catsSeen < 1000) out.settings.catsSeen = st.catsSeen;
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
      if (isObj(r.ac)) Object.keys(r.ac).forEach(function (id) { if (MED_ID.test(id) && typeof r.ac[id] === 'boolean') (o.ac = o.ac || {})[id] = r.ac[id]; });
      if (isObj(r.awhy)) Object.keys(r.awhy).forEach(function (id) { if (o.ac && o.ac[id] === false && REASON_TEXT.act[r.awhy[id]]) (o.awhy = o.awhy || {})[id] = r.awhy[id]; });
      if (r.wa === (r.wa | 0) && r.wa > 0 && r.wa <= 30) o.wa = r.wa;
      if (isObj(r.ck)) { // ¿cómo te sentiste?: 1–5 y nota corta
        var ck = {};
        CHECKS.forEach(function (x) { var v = r.ck[x.id]; if (v === (v | 0) && v >= 1 && v <= 5) ck[x.id] = v; });
        if (typeof r.ck.n === 'string' && r.ck.n.trim()) ck.n = r.ck.n.slice(0, 300);
        if (SLEEP_H.indexOf(r.ck.hs) !== -1) ck.hs = r.ck.hs;
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
    if (isObj(d.body)) Object.keys(d.body).forEach(function (k) { // peso y medidas, en rangos razonables
      var e = d.body[k], o = {};
      if (!KEY_RE.test(k) || !isObj(e)) return;
      BODY.forEach(function (b) { var v = e[b[0]]; if (typeof v === 'number' && v >= b[3] && v <= b[4]) o[b[0]] = Math.round(v * 10) / 10; });
      if (Object.keys(o).length) out.body[k] = o;
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
  function markedDays(data) { return Object.keys(data.days).filter(function (k) { var r = data.days[k]; return r.done || r.tk || r.ac; }).length; }
  function importSheet() {
    var P = pendingImport; if (!P) return '';
    return '<div class="sheet-head"><span class="sheet-emoji roundel" style="--mc:var(--orange)">' + icon('cassette') + '</span>' +
      '<div class="sheet-titles"><div class="eyebrow">Cargar respaldo</div><h2 id="sheet-title">Respaldo' + (P.when ? ' del ' + P.when : '') + '</h2></div>' +
      '<button class="icon-btn" data-action="close-sheet" aria-label="Cancelar">' + icon('x') + '</button></div>' +
      '<div class="sheet-content"><p>El respaldo tiene marcas en <b>' + markedDays(P.data) + '</b> días; este equipo, en <b>' + markedDays(S) + '</b>.</p>' +
      '<button class="import-opt is-main" data-action="import-merge"><b>' + icon('swap') + ' Combinar con este equipo</b><span class="small">Junta las marcas de los dos. Si una comida tiene ✓ en uno y ✗ en el otro, se queda ✓. ' +
      'Tus ajustes de este equipo se quedan y se agregan las vitaminas, medicamentos, actividades y registros de peso que falten.</span></button>' +
      '<button class="import-opt" data-action="import-replace"><b>' + icon('download') + ' Reemplazar todo</b><span class="small">Este equipo queda igual que el respaldo; lo que solo esté aquí se pierde.</span></button>' +
      '</div>';
  }
  function mergeData(a, b) { // a = este equipo, b = respaldo (ya limpio). Gana ✓ sobre ✗; en lo demás, este equipo.
    var out = JSON.parse(JSON.stringify(a)), idMap = {}, actMap = {};
    out.settings.acts = out.settings.acts || [];
    (b.settings.acts || []).forEach(function (x) { // actividades que falten (por nombre)
      var same = out.settings.acts.filter(function (y) { return y.id === x.id || y.name.trim().toLowerCase() === x.name.trim().toLowerCase(); })[0];
      if (same) actMap[x.id] = same.id; else { out.settings.acts.push(x); actMap[x.id] = x.id; }
    });
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
      if (y.wa && !(x.wa >= y.wa)) x.wa = y.wa;
      [['done', 'why', null], ['tk', 'twhy', idMap], ['ac', 'awhy', actMap]].forEach(function (f) {
        var mk = f[0], wy = f[1]; if (!y[mk]) return;
        x[mk] = x[mk] || {};
        Object.keys(y[mk]).forEach(function (id0) {
          var id = f[2] ? (f[2][id0] || id0) : id0, mine = x[mk][id], theirs = y[mk][id0], why = y[wy] && y[wy][id0];
          if (mine === undefined || (mine === false && theirs === true)) {
            x[mk][id] = theirs;
            if (theirs === true) { if (x[wy]) delete x[wy][id]; }
            else if (why) { x[wy] = x[wy] || {}; x[wy][id] = why; }
          } else if (mine === false && theirs === false && why && !(x[wy] && x[wy][id])) { x[wy] = x[wy] || {}; x[wy][id] = why; }
        });
      });
      ['sw', 'done', 'tk', 'why', 'twhy', 'ck', 'ac', 'awhy'].forEach(function (f) { if (x[f] && !Object.keys(x[f]).length) delete x[f]; });
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
    if (!out.settings.reviewDate && b.settings.reviewDate) out.settings.reviewDate = b.settings.reviewDate;
    out.settings.revPrep = out.settings.revPrep || {};
    Object.keys(b.settings.revPrep || {}).forEach(function (rk) {
      var x = out.settings.revPrep[rk] || (out.settings.revPrep[rk] = {}), y = b.settings.revPrep[rk];
      if (y.m) x.m = Object.assign({}, y.m, x.m || {});
      if (y.rep && (!x.rep || y.rep > x.rep)) x.rep = y.rep;
    });
    if (!Object.keys(out.settings.revPrep).length) delete out.settings.revPrep;
    out.body = out.body || {};
    Object.keys(b.body || {}).forEach(function (k) { out.body[k] = Object.assign({}, b.body[k], out.body[k] || {}); });
    out.settings.catsSeen = Math.max(out.settings.catsSeen || 0, b.settings.catsSeen || 0) || undefined;
    if (!out.settings.catsSeen) delete out.settings.catsSeen;
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
      '<p class="small muted">Las fotos de tus platos no van en el respaldo (pesan mucho): se quedan en este dispositivo.</p>' +
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
    if (isStandalone()) return '<p>' + icon('check') + ' Ya estás usando NutriJabón como app instalada. Funciona sin internet.</p>';
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
      actions = '<button class="btn primary" data-action="use-today" data-id="' + r.id + '">' + emblem('list') + ' Usar en ' + m.name.toLowerCase() + ' de hoy</button>';
    }
    var where = ctx.k && ctx.mode === 'day' ? m.name + ' · ' + DAY_NAMES[wd(fromKey(ctx.k))] + ' ' + fromKey(ctx.k).getDate() : m.name;
    return '<div class="sheet-head"><span class="sheet-emoji roundel" style="--mc:var(--m-' + r.meal + ')">' + dishThumb(r) + '</span>' +
      '<div class="sheet-titles"><div class="eyebrow">' + where + '</div><h2 id="sheet-title">' + esc(r.name) + '</h2></div>' +
      '<button class="icon-btn" data-action="close-sheet" aria-label="Cerrar">' + icon('x') + '</button></div>' +
      '<div class="sheet-content" style="--mc:var(--m-' + r.meal + ')">' + dishArt(r) + eqChips(m.eq, {ver:'ver', fru:'fru', cer:'cer', leg:'pro', pro:'tofu', lec:'lec', gsp:'gra', gcp:'nutSeed'}) +
      '<button class="btn cook-btn" data-action="cook-recipe" data-id="' + r.id + '">' + emblem('pot') + ' Modo cocina <span class="small muted">paso a paso, con temporizador</span></button>' +
      tasteBtns(r.id) +
      (r.extra
        ? '<div class="banner info">' + emblem('extra') + '<div>Idea extra de NutriJabón con las mismas porciones de tu ' + m.name.toLowerCase() + '. Coméntala con tu nutrióloga.</div></div>'
        : (pd ? '<p class="small muted">En tu plan: ' + pd + '</p>' : '')) +
      (r.ahead ? '<div class="banner ok">' + emblem('timer') + '<div><b>Con anticipación:</b> ' + r.ahead + '</div></div>' : '') +
      '<h3 class="sec-title recipe-subtitle">' + emblem('ver') + 'Ingredientes</h3>' +
      (SHARED[r.meal] ? servingsCtl(servings() > 1 ? 'Cantidades para ' + servings() + '. Tu porción es 1 de ' + servings() + ', la que marca tu plan. Si un paso menciona una cantidad, es para 1.' : '') : '') +
      '<ul class="ing-list">' + r.ing.map(function (i) { return '<li>' + esc(fmtIngX(i, serv(r.meal))) + '</li>'; }).join('') + '</ul>' +
      (r.fruitChoice ? '<div class="fruit-ideas"><div class="small muted">' + emblem('fru') + ' 1 porción de fruta puede ser:</div><div class="chips-wrap">' +
        D.FRUIT_IDEAS.map(function (f) { return '<span class="eq-chip">' + f[0] + ' · ' + f[1] + '</span>'; }).join('') + '</div></div>' : '') +
      '<h3 class="sec-title recipe-subtitle">' + emblem('knife') + 'Preparación</h3><ol class="steps">' + r.steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' +
      (r.tips || []).map(function (t) { return '<div class="banner leaf">' + emblem('tips') + '<div><b>Ojo vegano:</b> ' + t + '</div></div>'; }).join('') +
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
        '<span class="roundel">' + dishThumb(r) + '</span><span class="option-text"><b>' + esc(r.name) + '</b><span class="small muted">' +
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
        return '<details class="out-place"' + (i === 0 ? ' open' : '') + '><summary><span class="emoji">' + icon(FOOD_SYMBOLS[p.emoji]) + '</span><b>' + p.name + '</b>' + icon('down', 'chev') + '</summary>' +
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

  /* ---------------- Tu revisión ----------------
   * Lista para llegar lista a la cita: peso, marcas pendientes, registro diario, preguntas, resumen y respaldo.
   * Lo que la app puede comprobar se palomea solo; lo demás se palomea a mano (settings.revPrep[fecha].m).
   * Las preguntas sugeridas salen de tus datos y se agregan a “Preguntas para tu nutrióloga”. */
  function reviewKey() { var k = S.settings.reviewDate; return KEY_RE.test(k || '') ? k : D.PLAN.review; }
  function revState() { return (S.settings.revPrep || {})[reviewKey()] || {}; }
  function revEdit(fn) {
    var all = S.settings.revPrep = S.settings.revPrep || {}, rk = reviewKey();
    all[rk] = all[rk] || {}; fn(all[rk]); save();
  }
  function unmarkedRecent() { // comidas sin marcar en los últimos 14 días (dentro del plan)
    var t = today(), n = 0;
    for (var i = 0; i < 14; i++) { var x = dayInfo(keyOf(addDays(t, -i))); n += x.due - x.marked; }
    return n;
  }
  function reviewItems() {
    var rk = reviewKey(), rev = fromKey(rk), t = today(), P = revState(), man = P.m || {};
    var wk = bodyKeys('w'), lastW = wk[wk.length - 1], weekStart = keyOf(addDays(rev, -7));
    var un = unmarkedRecent(), ck = checkStats(addDays(t, -13), t).days, notes = (S.settings.notes || '').trim(), lb = S.settings.lastBackup;
    var nq = notes ? notes.split('\n').filter(function (l) { return l.trim(); }).length : 0;
    var items = [
      { id: 'peso', t: 'Pésate la semana de tu cita', auto: !!(lastW && lastW >= weekStart), btn: ['open-body', 'Anotar'],
        d: lastW && lastW >= weekStart ? 'Anotado el ' + day2(lastW) + ': ' + fmtBody(S.body[lastW].w) + ' kg.' : 'Anótalo entre el ' + day2(weekStart) + ' y el ' + day2(rk) + ', de preferencia en ayunas.' },
      { id: 'marcas', t: 'Marca lo que te falte', auto: !un, btn: ['goto-month', 'Ver el mes'],
        d: un ? 'Te ' + (un === 1 ? 'falta 1 comida' : 'faltan ' + un + ' comidas') + ' por marcar en las últimas 2 semanas.' : 'Tus últimas 2 semanas están marcadas.' },
      { id: 'sentir', t: 'Anota cómo te sentiste', auto: ck >= 5, btn: ['review-checkin', 'Ir a hoy'],
        d: ck + (ck === 1 ? ' día anotado' : ' días anotados') + ' en las últimas 2 semanas' + (ck >= 5 ? '.' : '. Con 5 o más se ve mejor cómo vas.') },
      { id: 'preguntas', t: 'Escribe tus preguntas', auto: !!nq,
        d: nq ? nq + (nq === 1 ? ' anotada' : ' anotadas') + '. Abajo hay más ideas según tus datos.' : 'Abajo hay ideas según tus datos: toca + para agregarlas.' },
      { id: 'resumen', t: 'Guarda o comparte tu resumen', auto: !!(P.rep && P.rep >= weekStart), btn: ['open-report', 'Abrir'],
        d: P.rep ? 'Lo guardaste el ' + day2(P.rep) + '.' + (P.rep < rk ? ' Hazlo otra vez cerca de la cita para que esté completo.' : '') : 'Imprímelo en PDF o compártelo para llevarlo a la cita.' },
      { id: 'respaldo', t: 'Guarda un respaldo', auto: !!(lb && lb >= keyOf(addDays(rev, -14))), btn: ['goto-sec', 'Respaldo', ' data-sec="respaldo"'],
        d: lb ? 'Último: ' + day2(lb) + '.' : 'Todavía no tienes ninguno.' }
    ];
    items.forEach(function (it) { it.done = it.auto || !!man[it.id]; });
    return items;
  }
  var MEAL_ART = { pre: 'el', des: 'el', c1: 'la', com: 'la', c2: 'la', cen: 'la' };
  function reviewSuggestions() { // preguntas en primera persona, solo cuando tus datos lo muestran claro
    var R = reportData(), a = R.all, C = R.ck, out = [];
    if (!R.started) return out;
    var acts = S.settings.acts || [], tr = S.settings.trainDays;
    var extra = acts.filter(function (x) { return (x.kind === 'pilates' || x.kind === 'fuerza') && x.days.some(function (i) { return tr.indexOf(i) === -1; }); });
    if (extra.length) out.push('¿' + listText(extra.map(function (x, i) { return i ? lowerFirst(x.name) : x.name; })) + (extra.length > 1 ? ' cuentan' : ' cuenta') + ' como día de ejercicio? ¿Debo comer el pre-entreno esos días?');
    if (acts.length && a.mov.due >= 5) out.push('¿Ajustamos mis porciones ahora que hago ' + listText(acts.map(function (x) { return lowerFirst(x.name) + ' (' + actDaysText(x) + ')'; })) + '?');
    var hard = MEALS.map(function (m) { var x = a.meal[m.id]; return { m: m, x: x, p: x.due ? x.done / x.due : 1 }; })
      .filter(function (o) { return o.x.due >= 5 && o.p < 0.7; }).sort(function (p, q) { return p.p - q.p; })[0];
    if (hard) out.push('Me cuesta cumplir ' + MEAL_ART[hard.m.id] + ' ' + lowerFirst(hard.m.name) + ' (' + Math.round(hard.p * 100) + '%). ¿Hay opciones más fáciles o le puedo cambiar el horario?');
    var why = {}; whyCounts(a, 'meal').forEach(function (e) { why[e[0]] = e[1]; });
    if (why.fuera >= 3) out.push('Comí fuera ' + why.fuera + ' veces. ¿Qué me recomienda pedir cuando como fuera?');
    if (why.tiempo >= 3) out.push('No tuve tiempo de comer ' + why.tiempo + ' veces. ¿Hay opciones más rápidas que pueda preparar?');
    if (why.hambre >= 3) out.push('No tuve hambre a la hora de comer ' + why.hambre + ' veces. ¿Puedo ajustar porciones u horarios?');
    if (why.otra >= 3) out.push('Comí otra cosa ' + why.otra + ' veces. ¿Cómo hago cambios sin salirme del plan?');
    var h = avg(C.f.h), e = avg(C.f.e), ht = avg(C.train.h), hr = avg(C.rest.h);
    if (h !== null && C.f.h.n >= 5 && h >= 3.5) out.push('Tuve bastante hambre entre comidas (' + h.toFixed(1) + ' de 5 en promedio). ¿Puedo agregar algo o mover porciones?');
    if (ht !== null && hr !== null && C.train.h.n >= 3 && C.rest.h.n >= 3 && Math.abs(ht - hr) >= 0.7) {
      out.push('Tengo más hambre en días de ' + (ht > hr ? 'ejercicio' : 'descanso') + ' (' + Math.max(ht, hr).toFixed(1) + ' contra ' + Math.min(ht, hr).toFixed(1) + ' de 5). ¿Ajustamos porciones esos días?');
    }
    if (e !== null && C.f.e.n >= 5 && e <= 2.5) out.push('Mi energía estuvo baja (' + e.toFixed(1) + ' de 5 en promedio). ¿Es normal con el plan o ajustamos algo?');
    if (C.low.length >= 3) out.push('Tuve la digestión baja ' + C.low.length + ' días (' + (C.low.length > 5 ? 'los más recientes: ' : '') +
      listText(C.low.slice(-5).map(function (k) { return day2(k); })) + '). ¿Puede ser por algún alimento?');
    var nos = tasteList(-1);
    if (nos.length) out.push((nos.length > 1 ? 'No me gustan: ' : 'No me gusta: ') + listText(nos) + '. ¿Por qué ' + (nos.length > 1 ? 'platillos los' : 'platillo lo') + ' puedo cambiar?');
    var top = R.swaps[0];
    if (top && top.n >= 3) out.push('Elegí ' + top.r.name + ' ' + top.n + ' veces en lugar de lo del plan. ¿Lo puedo dejar fijo?');
    if (a.water.days >= 5) out.push('Tomo ' + avgGlasses(a.water) + ' vasos de agua al día en promedio. ¿Cuánta agua me recomienda?');
    var w = bodyDelta('w');
    if (w) out.push('Mi peso cambió ' + deltaText(w, 'kg') + ' desde el ' + day2(w.first) + '. ¿Cómo vamos?');
    out.push('¿Qué cambia en mi plan a partir de ahora (menú, porciones u horarios)?');
    return out;
  }
  function hasQuestion(q) { return (S.settings.notes || '').indexOf(q) !== -1; }
  function addQuestions(qs) {
    var notes = (S.settings.notes || '').replace(/\s+$/, ''), add = qs.filter(function (q) { return !hasQuestion(q); });
    if (!add.length) return;
    S.settings.notes = ((notes ? notes + '\n' : '') + add.map(function (q) { return '• ' + q; }).join('\n')).slice(0, 2000);
    save();
    if (sheet) renderSheet();
    render();
    toast(add.length === 1 ? 'Pregunta agregada' : add.length + ' preguntas agregadas');
  }
  function suggestionsHtml() {
    var qs = reviewSuggestions(); if (!qs.length) return '';
    var pending = qs.filter(function (q) { return !hasQuestion(q); }).length;
    return '<div class="rev-sugs"><h3 class="sec-title">Preguntas sugeridas</h3><p class="small muted">Salen de lo que marcaste. Toca + para agregarlas a tus preguntas; después puedes editarlas.</p>' +
      '<ul class="plain rev-sug-list">' + qs.map(function (q, i) {
        var added = hasQuestion(q);
        return '<li' + (added ? ' class="is-added"' : '') + '><span>' + esc(q) + '</span>' + (added
          ? '<span class="badge">Agregada</span>'
          : '<button class="icon-btn sm rev-add" data-action="rev-add" data-i="' + i + '" aria-label="Agregar: ' + esc(q) + '">+</button>') + '</li>';
      }).join('') + '</ul>' +
      (pending > 1 ? '<button class="chip-btn" data-action="rev-add-all">Agregar todas (' + pending + ')</button>' : '') + '</div>';
  }
  function reviewHead(n) { return n === 0 ? 'Hoy es tu revisión' : n === 1 ? 'Mañana es tu revisión' : n > 1 ? 'Tu revisión es en ' + n + ' días' : 'Tu revisión ya pasó'; }
  function reviewSheet() {
    var rk = reviewKey(), n = daysToReview(), items = reviewItems(), done = items.filter(function (x) { return x.done; }).length, pct = Math.round(done / items.length * 100);
    return '<div class="sheet-head"><span class="sheet-emoji roundel" style="--mc:var(--blue)">' + icon('clipboard') + '</span>' +
      '<div class="sheet-titles"><div class="eyebrow">Preparar mi revisión</div><h2 id="sheet-title">' + longDate(fromKey(rk)) + '</h2></div>' +
      '<button class="icon-btn" data-action="close-sheet" aria-label="Cerrar">' + icon('x') + '</button></div>' +
      '<div class="sheet-content"><p><b>' + reviewHead(n) + '.</b> Llevas ' + done + ' de ' + items.length + ' listos.</p>' +
      '<div class="bar" role="progressbar" aria-label="Lista para tu revisión" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="width:' + pct + '%"></span></div>' +
      '<ul class="plain rev-list">' + items.map(function (it) {
        return '<li class="rev-item' + (it.done ? ' is-done' : '') + '">' +
          '<button class="rev-check" data-action="rev-toggle" data-id="' + it.id + '" aria-pressed="' + it.done + '"' + (it.auto ? ' disabled title="Listo según tus datos"' : ' title="Marcar como hecho"') + ' aria-label="' + it.t + (it.done ? ': listo' : ': pendiente') + '">' + (it.done ? icon('check') : '') + '</button>' +
          '<div class="rev-txt"><b>' + it.t + '</b><span class="small muted">' + it.d + '</span></div>' +
          (it.btn ? '<button class="chip-btn" data-action="' + it.btn[0] + '"' + (it.btn[2] || '') + '>' + it.btn[1] + '</button>' : '') + '</li>';
      }).join('') + '</ul>' +
      '<p class="small muted">Lo que la app puede revisar se palomea solo; lo demás, toca el círculo cuando lo hagas.</p>' +
      suggestionsHtml() +
      '<details class="cook-more"><summary>¿Cambió la fecha de tu cita?</summary><label class="time-row"><span>Fecha</span>' +
      '<input type="date" data-input="review-date" value="' + rk + '" min="' + D.PLAN.assigned + '"></label>' +
      '<p class="small muted">Se usa en la cuenta regresiva, tu resumen y los recordatorios (si ya los agregaste, vuelve a agregarlos).</p></details></div>' +
      '<div class="sheet-actions"><button class="btn primary" data-action="open-report">' + icon('clipboard') + ' Abrir mi resumen</button></div>';
  }
  function reviewCard() { // en Hoy, la semana antes de la cita y el mismo día
    var n = daysToReview(); if (n < 0 || n > 7) return '';
    var items = reviewItems(), done = items.filter(function (x) { return x.done; }).length, pct = Math.round(done / items.length * 100);
    var sugs = reviewSuggestions().filter(function (q) { return !hasQuestion(q); }).length;
    return '<section class="card review-card"><h3 class="card-title">' + icon('clipboard') + ' ' + reviewHead(n) + '</h3>' +
      '<div class="bar" role="progressbar" aria-label="Lista para tu revisión" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="width:' + pct + '%"></span></div>' +
      '<p class="small muted">' + done + ' de ' + items.length + ' listos' + (sugs ? ' · ' + sugs + (sugs === 1 ? ' pregunta sugerida' : ' preguntas sugeridas') : '') + '.</p>' +
      '<div class="row-gap"><button class="btn primary" data-action="open-review">' + icon('clipboard') + ' Preparar mi revisión</button></div></section>';
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
      }).join('') + '</ul>' + (C.hs.n ? '<p class="small">' + icon('moon', 'ic-sm') + ' Dormiste ' + sleepAvg(C) + ' en promedio (' + C.hs.n + (C.hs.n === 1 ? ' noche anotada' : ' noches anotadas') + ').</p>' : '') +
      (ins.length ? '<ul class="plain out-tips">' + ins.map(function (s) { return '<li>' + icon('info', 'ic-xs') + '<span>' + esc(s) + '</span></li>'; }).join('') + '</ul>' : '') +
      (C.notes.length ? '<h4 class="sec-title">Tus notas</h4><ul class="plain feel-notes">' + C.notes.slice(-10).reverse().map(function (o) {
        return '<li><b>' + shortDate(o.k).replace(/ \d{4}$/, '') + ':</b> ' + esc(o.n) + '</li>';
      }).join('') + '</ul>' : '');
  }
  function reasonsHtml(a) {
    if (!a.miss) return '';
    var w = whyCounts(a, 'meal'), given = w.reduce(function (s, e) { return s + e[1]; }, 0), none = a.miss - given;
    var emoji = {}; REASONS.meal.forEach(function (x) { emoji[x[0]] = x[1]; });
    var rows = w.map(function (e) { return [REASON_TEXT.meal[e[0]], e[1], emoji[e[0]]]; });
    if (none) rows.push(['Sin razón anotada', none]);
    return '<h3 class="sec-title">¿Por qué no se cumplieron?</h3><ul class="plain meter-list reasons">' + rows.map(function (row) {
      return '<li style="--mc:var(--red)"><div class="meter-top"><b>' + (row[2] ? icon(row[2], 'ic-sm') + ' ' : '') + row[0] + '</b><span class="muted">' + row[1] + ' de ' + a.miss + '</span></div>' +
        barHtml({ done: row[1], due: a.miss }, row[0]) + '</li>';
    }).join('') + '</ul>';
  }
  function medLabel(md) { return md.name + ' (con ' + MEAL[md.meal].name.toLowerCase() + (md.when === 'train' ? ', días de ejercicio' : '') + ')'; }
  function medsInReport(a) { return (S.settings.meds || []).filter(function (md) { return a.meds[md.id] && a.meds[md.id].due; }); }
  function actDaysText(a) { // “diario”, “lun a sáb”, “mar y jue”, “lun a mié y vie”
    if (a.days.length === 7) return 'diario';
    var ds = a.days.slice().sort(), runs = [];
    ds.forEach(function (i) { var r = runs[runs.length - 1]; if (r && i === r[1] + 1) r[1] = i; else runs.push([i, i]); });
    return listText([].concat.apply([], runs.map(function (r) {
      return r[1] - r[0] >= 2 ? [DAY_SHORT[r[0]] + ' a ' + DAY_SHORT[r[1]]] : r[0] === r[1] ? [DAY_SHORT[r[0]]] : [DAY_SHORT[r[0]], DAY_SHORT[r[1]]];
    })));
  }
  function movInReport(a) {
    return (S.settings.acts || []).filter(function (x) { return a.acts[x.id] && a.acts[x.id].due; }).map(function (x) { return { a: x, x: a.acts[x.id] }; });
  }
  function movHtml(a) {
    var mv = movInReport(a); if (!mv.length) return '';
    return '<h3 class="sec-title">Movimiento</h3><ul class="plain meter-list">' + mv.map(function (o) {
      var name = esc(o.a.name);
      return '<li style="--mc:var(--m-' + o.a.after + ')"><div class="meter-top"><b>' + actIcon(o.a, 'ic-sm') + ' ' + name + '</b> <span class="badge">' + actDaysText(o.a) + '</span>' +
        '<span class="muted">' + countText(o.x, 'act') + '</span></div>' + barHtml(o.x, name) + '</li>';
    }).join('') + '</ul>';
  }
  function waterText(a) {
    var w = a.water;
    return avgGlasses(w) + ' vasos al día en promedio (' + liters(w.sum / w.days) + ' L) en ' + w.days + (w.days === 1 ? ' día anotado' : ' días anotados') +
      ' · meta de ' + waterGoal() + ' vasos en ' + w.goal + (w.goal === 1 ? ' día' : ' días');
  }
  function waterHtml(a) { return a.water.days ? '<h3 class="sec-title">Agua</h3><p class="small">' + icon('glass', 'ic-sm') + ' ' + waterText(a) + '.</p>' : ''; }
  function bodyHtml() {
    var ks = bodyKeys(); if (!ks.length) return '';
    var deltas = BODY.map(function (b) { var x = bodyDelta(b[0]); return x ? b[1] + ': ' + deltaText(x, b[2]) + ' desde el ' + day2(x.first) : ''; }).filter(Boolean);
    return '<h3 class="sec-title">Peso y medidas</h3>' + (deltas.length ? '<p class="small">' + deltas.join(' · ') + '.</p>' : '') + weightChart() +
      '<table class="body-table"><thead><tr><th>Fecha</th>' + BODY.map(function (b) { return '<th>' + b[1] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      ks.map(function (k) { var e = S.body[k]; return '<tr><td>' + day2(k) + '</td>' + BODY.map(function (b) { return '<td>' + (e[b[0]] != null ? fmtBody(e[b[0]]) + ' ' + b[2] : '—') + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table>';
  }
  function catsReportHtml() {
    var cw = catWeeks(); if (!cw.length) return '';
    var got = earnedCats();
    return '<p class="small">' + icon('cat', 'ic-sm') + ' Semanas con ' + CAT_GOAL + '% o más de las comidas: <b>' + got.length + ' de ' + cw.length + '</b>' +
      (got.length ? ' · Gatos: ' + listText(got.map(function (x) { return x.cat.name; })) : '') + '.</p>';
  }
  function barHtml(x, label) {
    var p = x.due ? Math.round(x.done / x.due * 100) : 0;
    return '<div class="bar" role="progressbar" aria-label="' + label + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p + '"><span style="width:' + p + '%"></span></div>';
  }
  function reportSheet() {
    var R = reportData(), a = R.all, rev = shortDate(reviewKey()).replace(/ \d{4}$/, ''), notes = S.settings.notes || '';
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
      catsReportHtml() +
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
      monthsHtml() + movHtml(a) + waterHtml(a) + reasonsHtml(a) + feelHtml(R.ck) + bodyHtml() + '<h3 class="sec-title">Por semana</h3><ul class="plain meter-list weeks">' + R.weeks.map(function (w) {
        var lbl = rangeText(w.from, w.to);
        return '<li><div class="meter-top"><b>' + lbl + '</b><span class="muted">' + countText(w) + '</span></div>' + barHtml(w, lbl) + '</li>';
      }).join('') + '</ul>' +
      '<h3 class="sec-title">Platillos que elegiste en lugar del plan</h3>' +
      (R.swaps.length ? '<ul class="plain swap-list">' + R.swaps.map(function (x) {
        return '<li><span class="roundel sm" style="--mc:var(--m-' + x.r.meal + ')">' + dishThumb(x.r) + '</span><span>' + esc(x.r.name) + '</span><b>×' + x.n + '</b></li>';
      }).join('') + '</ul>' : '<p class="small muted">Seguiste los platillos de tu plan.</p>') +
      tastesHtml() + photosHtml() +
      '<h3 class="sec-title"><label for="notes">Preguntas para tu nutrióloga</label></h3>' +
      '<textarea id="notes" class="notes no-print" rows="4" data-input="notes" placeholder="Ej.: ¿En días de descanso solo quito el pre-entreno?">' + esc(notes) + '</textarea>' +
      '<p id="notes-print" class="print-only notes-print">' + esc(notes) + '</p>' +
      '<p class="small muted no-print">Se guardan solo aquí y salen en el resumen que compartas o imprimas.</p>' +
      '<div class="no-print">' + suggestionsHtml() + '</div>' +
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
    var mv = movInReport(a);
    if (mv.length) {
      L.push('', 'Movimiento:');
      mv.forEach(function (x) { L.push('• ' + x.a.name + ' (' + actDaysText(x.a) + '): ' + countText(x.x, 'act')); });
    }
    if (a.water.days) L.push('', 'Agua: ' + waterText(a));
    var cw = catWeeks();
    if (cw.length) L.push('', 'Semanas con ' + CAT_GOAL + '% o más de las comidas: ' + cw.filter(function (w) { return w.won; }).length + ' de ' + cw.length);
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
      if (C.hs.n) L.push('• Horas de sueño: ' + sleepAvg(C) + ' en promedio (' + C.hs.n + (C.hs.n === 1 ? ' noche)' : ' noches)'));
      checkInsights(C).forEach(function (s) { L.push('• ' + s); });
      if (C.notes.length) {
        L.push('', 'Mis notas:');
        C.notes.slice(-10).forEach(function (o) { L.push('• ' + shortDate(o.k).replace(/ \d{4}$/, '') + ': ' + o.n); });
      }
    }
    var bk = bodyKeys();
    if (bk.length) {
      L.push('', 'Peso y medidas:');
      bk.forEach(function (k) { var e = S.body[k]; L.push('• ' + day2(k) + ': ' + BODY.filter(function (b) { return e[b[0]] != null; }).map(function (b) { return b[1].toLowerCase() + ' ' + fmtBody(e[b[0]]) + ' ' + b[2]; }).join(', ')); });
      BODY.forEach(function (b) { var x = bodyDelta(b[0]); if (x) L.push('• Cambio de ' + b[1].toLowerCase() + ' desde el ' + day2(x.first) + ': ' + deltaText(x, b[2])); });
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
    el.textContent = cook.wake === 'on' ? 'Pantalla encendida' : cook.wake === 'no' ? 'Tu navegador no deja mantener la pantalla encendida' : '';
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
    var title = cook.kind === 'recipe' ? dishThumb(cook.r) + ' ' + esc(cook.r.name) : icon('pot') + ' Prep del domingo';
    var body = '', times = [];
    if (cook.kind === 'recipe' && st.intro) {
      var r = cook.r;
      var sx = serv(r.meal);
      body = '<p class="cook-lead">Junta todo antes de prender la estufa' + (sx > 1 ? ' (para ' + sx + ' personas)' : '') + ':</p><ul class="plain cook-ings">' + r.ing.map(function (ing, n) {
        var c = !!cook.checks[n];
        return '<li><label class="cook-ing' + (c ? ' is-checked' : '') + '"><input type="checkbox" data-input="cook-ing" data-n="' + n + '"' + (c ? ' checked' : '') + '><span>' + esc(fmtIngX(ing, sx)) + '</span></label></li>';
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
      body = '<p class="cook-task' + (done ? ' is-done' : '') + '">' + (t.rid ? dishThumb(RECIPE[t.rid]) + ' ' : '') + esc(t.title) + '</p>' +
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
      return '<button class="chip-btn cook-tbtn" data-action="cook-timer" data-s="' + s + '">' + emblem('timer') + ' ' + fmtDur(s) + '</button>';
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
      return '<span class="cook-timer' + (over ? ' is-done' : '') + '">' + emblem('timer') + '<b>' + (over ? '¡Tiempo!' : fmtClock(left)) + '</b>' +
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
    toast('¡Tiempo! ' + t.label);
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
      : nd === tasks.length ? '¡Prep listo! Tu semana ya está adelantada' : 'Llevas ' + nd + ' de ' + tasks.length + ' tareas del domingo');
  }
  function runningTimers() { return cook ? cook.timers.filter(function (t) { return t.end > Date.now(); }).length : 0; }

  var sheetEl, sheetBox, sheetBody, sheet = null, lastFocus = null;
  var SHEETS = { recipe: recipeSheet, swap: swapSheet, onboarding: onboardingSheet, report: reportSheet, out: outSheet, cook: cookSheet, recap: recapSheet, import: importSheet, cat: catSheet, body: bodySheet, photo: photoSheet, cal: calSheet, review: reviewSheet };
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
    phFill(sheetBody);
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
    var whyField = MARK_WHY[field];
    setDay(k, function (r) {
      r[field] = r[field] || {};
      if (r[field][id] === v) delete r[field][id]; else r[field][id] = v;
      if (r[field][id] !== false && r[whyField]) delete r[whyField][id]; // la razón solo vale para ✗
    });
    if (sheet) renderSheet();
    render();
    if (v && !wasFull && isFullDay(k)) toast('¡Día completo!');
    else if (v === false && (field === 'tk' ? medMark(k, id) : field === 'ac' ? actMark(k, id) : markOf(k, id)) === false) toast('Anotado. Si quieres, elige por qué');
    else if (v && field === 'ac' && actMark(k, id) === true) toast('¡Bien hecho!');
  }
  function setWhy(kind, k, id, reason) {
    var field = KIND_WHY[kind];
    if (!field || !REASON_TEXT[kind][reason]) return;
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
  // At navigation size each section has a distinct silhouette.
  var TAB_ART = {
    hoy: '<g stroke="#f5ca68"><path d="M16 3v3M5 8l2 2m20-2-2 2M2 17h3m22 0h3"/><path fill="#f5ca68" d="M7 21a9 9 0 0 1 18 0Z"/></g><path stroke="#f0a087" d="M3 23h26M8 27h16"/>',
    semana: '<rect x="4" y="6" width="24" height="22" rx="4" fill="#f5dda8"/><path fill="#ed9da7" d="M8 6h16q4 0 4 4v3H4v-3q0-4 4-4Z"/><path d="M10 3v6m12-6v6m-14 9h3m4 0h2m-9 5h3"/><path d="m17 22 2 2 5-6" stroke="#715846"/>',
    recetas: '<path fill="#f4e2b9" d="M9 21c-8 0-8-12 0-12 2-7 12-7 14 0 8 0 8 12 0 12v6H9Z"/><path d="M9 22h14m-10-4-1-5m7 5 1-5"/><path fill="#e6b47e" d="M9 23h14v4H9Z"/>',
    compras: '<path fill="#9ec58e" d="M16 15q0-10 10-11 0 10-10 11Z"/><path fill="#eaaa72" d="m8 17-2-10q0-4 4-4 3 0 4 4l2 9Z"/><path d="m7 8 4-2m-3 6 4-2"/><path fill="#ebbf87" d="M4 13h24l-3 15H7Z"/><path d="M11 15a5 5 0 0 0 10 0"/>',
    guia: '<path fill="#c0d2dd" d="M3 6q7-2 13 2 6-4 13-2v20q-7-2-13 2-6-4-13-2Z"/><path d="M16 9v18m-10-15q4 0 7 2m-7 3q4 0 7 2"/><path fill="#e7a1ab" d="m21 6 5-1v11l-2.5-2-2.5 3Z"/>'
  };
  var TABS = [['hoy','Hoy'], ['semana','Semana'], ['recetas','Recetas'], ['compras','Compras'], ['guia','Guía']];
  var mainEl;
  function render() {
    mainEl.dataset.view = ui.tab;
    mainEl.innerHTML = VIEWS[ui.tab]();
    phFill(mainEl);
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
      case 'mark-act': setMark('ac', ds.k, ds.id, ds.v === '1'); break;
      case 'water': setWater(ds.k, +ds.v); break;
      case 'servings': {
        var sv = Math.max(1, Math.min(6, +ds.v | 0)), sy = window.scrollY;
        S.settings.servings = sv; save(); if (sheet) renderSheet(); render(); window.scrollTo(0, sy);
        toast(sv === 1 ? 'Cantidades para 1 persona' : 'Desayuno, comida y cena para ' + sv); break;
      }
      case 'open-cat': openSheet('cat', [+ds.i]); break;
      case 'cats-seen': S.settings.catsSeen = +ds.n; save(); render(); break;
      case 'goto-cats': ui.weekOffset = 0; setTab('semana'); { var cc = document.querySelector('.cats-card'); if (cc) cc.scrollIntoView({ block: 'start' }); } break;
      case 'open-body': openSheet('body', []); break;
      case 'open-photo': openSheet('photo', [ds.key]); break;
      case 'del-photo': delPhoto(ds.key); break;
      case 'del-photos': delAllPhotos(); break;
      case 'body-save': saveBody(); break;
      case 'body-del': delBody(ds.k); break;
      case 'act-add': addAct(); break;
      case 'act-del': delAct(ds.id); break;
      case 'act-day': toggleActDay(ds.id, +ds.i); break;
      case 'theme': S.settings.theme = ds.v; save(); applyTheme(); render(); break;
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
      case 'sem-mode': ui.semMode = ds.v === 'month' ? 'month' : 'week'; render(); break;
      case 'month-shift': ui.monthOffset += +ds.n; render(); break;
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
      case 'cal-share': shareIcs(); break;
      case 'cal-download': downloadFile(ICS_NAME, 'text/calendar;charset=utf-8', buildIcs()); toast('Guardado en Descargas: ábrelo desde la app Archivos'); break;
      case 'cal-direct': openIcsDirect(); break;
      case 'backup-save': saveBackup(); break;
      case 'backup-send': sendBackup(); break;
      case 'open-report': openSheet('report', []); break;
      case 'report-share': revEdit(function (P) { P.rep = keyOf(today()); }); shareText('Resumen NutriJabón', reportText(), 'Resumen copiado'); break;
      case 'report-print': revEdit(function (P) { P.rep = keyOf(today()); }); window.print(); break;
      case 'open-review': openSheet('review', []); break;
      case 'rev-toggle': revEdit(function (P) { P.m = P.m || {}; if (P.m[ds.id]) delete P.m[ds.id]; else P.m[ds.id] = true; }); renderSheet(); render(); break;
      case 'rev-add': { var rq = reviewSuggestions()[+ds.i]; if (rq) addQuestions([rq]); break; }
      case 'rev-add-all': addQuestions(reviewSuggestions()); break;
      case 'goto-month': closeSheet(); ui.semMode = 'month'; ui.monthOffset = 0; setTab('semana'); break;
      case 'review-checkin': { closeSheet(); ui.date = null; setTab('hoy'); var rc = document.getElementById('checkin'); if (rc) rc.scrollIntoView({ block: 'start' }); break; }
      case 'reset-times': S.settings.times = {}; save(); render(); toast('Horarios del plan restaurados'); break;
      case 'reset-all':
        if (window.confirm('¿Borrar tus marcas de comidas y movimiento, el agua, cambios de platillos, la lista de compras y el prep? Tus ajustes, medicamentos, actividades y peso se quedan.')) {
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
    else if (t === 'ck-hours') { // horas de sueño: se guarda y vuelve a pintar para el “Anotado”
      var hk = el.dataset.k, hv = +el.value;
      setDay(hk, function (r) { r.ck = r.ck || {}; if (SLEEP_H.indexOf(hv) !== -1) r.ck.hs = hv; else delete r.ck.hs; });
    }
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
    } else if (t === 'act-after' || t === 'act-min') {
      var act = findAct(el.dataset.id); if (!act) return;
      if (t === 'act-after' && MEAL[el.value]) act.after = el.value;
      if (t === 'act-min' && ACT_MINS.indexOf(+el.value) !== -1) act.min = +el.value;
      save();
      var arow = el.closest('.med-row');
      if (arow && t === 'act-after') arow.style.setProperty('--mc', 'var(--m-' + el.value + ')');
    } else if (t === 'review-date') {
      if (!KEY_RE.test(el.value) || el.value < D.PLAN.assigned) { toast('Elige una fecha después del inicio de tu plan'); return; }
      var oldRk = reviewKey(), rp = S.settings.revPrep;
      if (el.value === D.PLAN.review) delete S.settings.reviewDate; else S.settings.reviewDate = el.value;
      if (rp && rp[oldRk] && !rp[el.value]) { rp[el.value] = rp[oldRk]; delete rp[oldRk]; } // la misma cita, solo cambió de día
      save(); renderSheet(); render();
      toast('Tu revisión: ' + longDate(fromKey(el.value)).toLowerCase());
    } else if (t === 'water-goal') {
      S.settings.waterGoal = +el.value; save();
    } else if (t === 'lead') {
      S.settings.remindLead = +el.value; save();
    } else if (t === 'photo') {
      var pf = el.files && el.files[0];
      el.value = '';
      if (pf && MEAL[el.dataset.meal] && KEY_RE.test(el.dataset.k)) savePhoto(el.dataset.k, el.dataset.meal, pf);
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
    if (sec) {
      sec.querySelector('summary').focus({ preventScroll: true });
      sec.scrollIntoView({ block: 'start' });
    }
  }

  /* ---------------- Inicio ---------------- */
  function init() {
    mainEl = document.getElementById('view');
    sheetEl = document.getElementById('sheet');
    sheetBox = sheetEl.querySelector('.sheet');
    sheetBody = document.getElementById('sheet-body');

    document.getElementById('tabs').innerHTML = TABS.map(function (t) {
      return '<button class="tab" data-action="tab" data-tab="' + t[0] + '">' + '<span class="tab-emblem"><svg viewBox="0 0 32 32" aria-hidden="true">' + TAB_ART[t[0]] + '</svg></span><span>' + t[1] + '</span></button>';
    }).join('');
    document.getElementById('settings-btn').insertAdjacentHTML('afterbegin', icon('settings'));

    applyTheme();
    if (window.matchMedia) { var mq = matchMedia('(prefers-color-scheme: dark)'); var onMq = function () { if (themeSetting() === 'auto') applyTheme(); }; if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq); }
    document.addEventListener('pointermove', chartHover);
    document.addEventListener('pointerdown', chartHover);
    document.addEventListener('pointerout', chartLeave);
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
      if (e.key === 'Enter' && e.target && e.target.id === 'act-name') { e.preventDefault(); addAct(); }
      if (e.key === 'Enter' && e.target && /^body-/.test(e.target.id)) { e.preventDefault(); saveBody(); }
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

    // Fotos del plato: saber cuáles hay (si el navegador no deja guardarlas, se esconden los botones)
    if (PH.ok) phLoad().then(function () { if (phCount() && !sheet) render(); }, function () { PH.ok = false; if (!sheet) render(); });

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
