/* NutriJabón · Datos del plan vegano
 * Fuente: plan de alimentación asignado el 8/11/2026 (próxima revisión 18/12/2026).
 * Todas las recetas del plan son veganas. Las marcadas con extra:true son ideas
 * adicionales que respetan exactamente las mismas porciones de cada tiempo.
 */
(function () {
  'use strict';

  // q = cantidad, u = unidad, n = nombre (para la lista de compras), c = categoría de compras, t = texto a mostrar
  function I(q, u, n, c, t) { return { q: q, u: u, n: n, c: c, t: t }; }
  function F(n, c, t) { return { q: null, u: null, n: n, c: c || 'desp', t: t }; }

  var SOYA = 'Salsa de soya o tamari (baja en sodio)';
  var BEBIDA = 'Bebida vegetal sin azúcar (soya o chícharo)';
  var CEBOLLA = 'Cebolla morada/blanca';

  var GROUPS = {
    ver: { name: 'Verduras', one: 'verdura', many: 'verduras', perDay: 3 },
    fru: { name: 'Frutas', one: 'fruta', many: 'frutas', perDay: 3 },
    cer: { name: 'Cereales', one: 'cereal', many: 'cereales', perDay: 7, orig: 'Cereales sin grasa' },
    leg: { name: 'Leguminosas', one: 'leguminosa', many: 'leguminosas', perDay: 2 },
    pro: { name: 'Proteína vegetal', one: 'proteína', many: 'proteínas', perDay: 4, orig: 'Proteína baja en grasa' },
    lec: { name: 'Bebida vegetal', one: 'bebida vegetal', many: 'bebidas vegetales', perDay: 1, orig: 'Leche descremada' },
    gsp: { name: 'Grasas', one: 'grasa', many: 'grasas', perDay: 3, orig: 'Grasas sin proteína' },
    gcp: { name: 'Grasas con proteína', one: 'grasa con proteína', many: 'grasas con proteína', perDay: 3 }
  };

  var MEALS = [
    { id: 'pre', name: 'Pre-entreno', time: '06:00', eq: { fru: 1, cer: 1, gcp: 1 }, trainingOnly: true },
    { id: 'des', name: 'Desayuno', time: '08:00', eq: { ver: 1, cer: 2, pro: 2, gsp: 1 } },
    { id: 'c1', name: 'Colación 1', time: '11:00', eq: { fru: 1, lec: 1 } },
    { id: 'com', name: 'Comida', time: '14:00', eq: { ver: 1, cer: 2, leg: 2, gsp: 1 } },
    { id: 'c2', name: 'Colación 2', time: '17:00', eq: { fru: 1, gcp: 2 } },
    { id: 'cen', name: 'Cena', time: '20:00', eq: { ver: 1, cer: 2, pro: 2, gsp: 1 } }
  ];

  // Planeación semanal: índice 0 = lunes … 6 = domingo
  var WEEK = {
    pre: ['mix-pre', 'toast-pera', 'rice-cake', 'bolitas-amaranto', 'mix-pre', 'toast-pera', 'rice-cake'],
    des: ['bagel-tofu', 'pan-tofu', 'chilaquiles', 'burrito-seitan', 'bagel-tofu', 'pan-tofu', 'chilaquiles'],
    c1: ['matcha', 'latte-fruta', 'matcha', 'latte-fruta', 'matcha', 'latte-fruta', 'matcha'],
    com: ['tabule', 'pasta-rapida', 'noodles', 'burrito-salad', 'tabule', 'pasta-rapida', 'noodles'],
    c2: ['fresas-choco', 'mix-salado', 'garden-veggie', 'galleta-manzana', 'fresas-choco', 'mix-salado', 'garden-veggie'],
    cen: ['tacos-arabes', 'mac-cheese', 'alambre-seitan', 'sandwich-tofu', 'tacos-arabes', 'mac-cheese', 'alambre-seitan']
  };

  var TIP_TORTILLA = 'Muchas tortillas de harina llevan <b>manteca de cerdo</b>. Busca las que digan “con aceite vegetal” o hazlas en casa.';
  var TIP_PASTA = 'Usa pasta seca de sémola de trigo (sin huevo). Las pastas frescas o “al huevo” no son veganas.';

  var RECIPES = [
    /* ---------------- PRE-ENTRENO ---------------- */
    {
      id: 'mix-pre', meal: 'pre', name: 'Mix pre/intra entreno', emoji: '🥜',
      ing: [I(15, 'g', 'Cereal infantil fortificado', 'cer'), I(2, 'pza', 'Dátil seco', 'fru'), I(7, 'mitad', 'Nuez', 'gra')],
      steps: ['Lleva todo en un tupper y disfruta :) Puedes comerlo antes o durante el entreno.'],
      tips: ['Elige un cereal infantil fortificado <b>sin leche</b>: muchos traen leche en polvo.']
    },
    {
      id: 'toast-pera', meal: 'pre', name: 'Toast de pera y nuez', emoji: '🍐',
      ing: [I(30, 'g', 'Pan de masa madre', 'cer'), I(1 / 2, 'pza', 'Pera', 'fru'), I(1 / 2, 'cda', 'Crema de almendra natural', 'gra'), I(3.5, 'mitad', 'Nuez', 'gra'), F('Canela en polvo')],
      steps: ['Tuesta el pan.', 'Unta la crema de almendra sobre el pan tostado.', 'Corta la pera en rodajas finas.', 'Coloca las rodajas de pera en el pan.', 'Espolvorea las nueces picadas sobre la pera y un poco de canela.', 'Disfruta :)']
    },
    {
      id: 'rice-cake', meal: 'pre', name: 'Rice cake con crema de almendra', emoji: '🍘',
      ing: [I(2, 'pza', 'Tortitas de arroz', 'cer'), I(1 / 2, 'pza', 'Plátano', 'fru'), I(1, 'cda', 'Crema de almendra natural', 'gra'), F('Canela en polvo')],
      steps: ['Unta la crema de almendra en las tortitas de arroz y agrega el plátano en rodajas.', 'Espolvorea con canela y disfruta :)']
    },
    {
      id: 'bolitas-amaranto', meal: 'pre', name: 'Bolitas de plátano con amaranto', emoji: '🍌',
      ing: [I(1 / 4, 'taza', 'Amaranto natural', 'cer'), I(1 / 2, 'pza', 'Plátano', 'fru'), I(1, 'cda', 'Crema de almendra natural', 'gra'), F('Canela en polvo')],
      steps: ['Aplasta el plátano con un tenedor y mézclalo con el amaranto, la crema de almendra y canela al gusto.', 'Forma bolitas y refrigéralas o congélalas 30 minutos para que mantengan su consistencia.', '¡Disfruta! :)'],
      ahead: 'Prepara las bolitas la noche anterior: necesitan al menos 30 min en el refri o congelador.'
    },
    {
      id: 'x-wrap-platano', meal: 'pre', extra: true, name: 'Mini wrap de plátano y cacahuate', emoji: '🌯',
      ing: [I(1 / 2, 'pza', 'Tortilla de harina', 'cer'), I(1 / 2, 'pza', 'Plátano', 'fru'), I(1, 'cda', 'Crema de cacahuate natural', 'gra'), F('Canela en polvo')],
      steps: ['Calienta la media tortilla unos segundos en el comal.', 'Unta la crema de cacahuate, acomoda el plátano en rodajas y espolvorea canela.', 'Enróllala y listo: se come en 2 minutos antes de entrenar.'],
      tips: [TIP_TORTILLA]
    },
    {
      id: 'x-palomitas', meal: 'pre', extra: true, name: 'Palomitas con dátil y almendras', emoji: '🍿',
      ing: [I(2.5, 'taza', 'Palomitas naturales', 'cer'), I(2, 'pza', 'Dátil seco', 'fru'), I(10, 'pza', 'Almendra', 'gra', '10 almendras')],
      steps: ['Prepara palomitas naturales sin mantequilla (en olla, o en el microondas dentro de una bolsa de papel).', 'Pica los dátiles y mézclalos con las almendras y las palomitas.', 'Llévalas en un tupper para antes o durante tu entreno.']
    },

    /* ---------------- DESAYUNO ---------------- */
    {
      id: 'bagel-tofu', meal: 'des', name: 'Bagel de tofu', emoji: '🥯',
      ing: [I(2 / 3, 'pza', 'Bolillo/birote sin migajón', 'cer'), I(2, 'cda', 'Guacamole', 'gra'), I(80, 'g', 'Tofu firme', 'pro'), I(1, 'pza', 'Jitomate', 'ver'), I(1 / 3, 'pza', CEBOLLA, 'ver', '⅓ de cebolla'), F('Cúrcuma'), F('Sal yodada'), F('Pimienta')],
      steps: ['Prepara el <i>scrambled</i> tofu: lleva a un sartén la cebolla en cachitos y deja que se dore un poco.', 'Agrega el tofu en cachitos con el jitomate. Sazona con cúrcuma, sal yodada y pimienta al gusto.', 'Unta el guacamole en tu pan y agrega el tofu.', 'Disfruta :)'],
      tips: ['El bolillo suele ser vegano, pero algunas panaderías usan manteca de cerdo o leche. Si dudas, usa pan de masa madre.']
    },
    {
      id: 'pan-tofu', meal: 'des', name: 'Pan con tofu asado y jitomate', emoji: '🍅',
      ing: [I(60, 'g', 'Pan de masa madre', 'cer'), I(1, 'cdita', 'Aceite de oliva', 'gra'), I(80, 'g', 'Tofu firme', 'pro'), I(1, 'pza', 'Jitomate', 'ver'), F('Sal yodada'), F('Pimienta')],
      steps: ['Corta el tofu en rebanadas y ponlo en el sartén con un poco del aceite de oliva.', 'Corta el jitomate en rodajas finas; puedes asarlo también.', 'Tuesta el pan hasta que esté doradito y crujiente.', 'Arma el pan con el tofu y el jitomate.', 'Rocía el resto del aceite de oliva, pimienta y sal yodada para aderezar.', 'Disfruta :)']
    },
    {
      id: 'chilaquiles', meal: 'des', name: 'Chilaquiles verdes con tofu', emoji: '🌶️',
      ing: [I(4, 'pza', 'Tostadas horneadas', 'cer'), I(1 / 3, 'pza', 'Aguacate', 'gra'), I(80, 'g', 'Tofu firme', 'pro'), I(2.5, 'pza', 'Tomate verde', 'ver'), I(1 / 4, 'taza', CEBOLLA, 'ver'), F('Ajo', 'ver'), F('Cilantro', 'ver'), F('Sal yodada'), F('Pimienta')],
      steps: ['Quiebra las tostadas en trozos pequeños, que parezcan totopos. Corta la cebolla en rebanadas finas.', 'Cuece el tomate verde en agua con la cebolla y lícualo con el ajo, sal, pimienta y cilantro.', 'Calienta un sartén, agrega la salsa y deja cocinar hasta que suelte el hervor.', 'Sirve los totopos y vierte la salsa verde encima. Agrega el tofu (desmoronado o en cubos) y el aguacate.', '¡Sirve y disfruta! :)']
    },
    {
      id: 'burrito-seitan', meal: 'des', name: 'Burritos de seitán con guacamole', emoji: '🌯',
      ing: [I(1, 'pza', 'Tortilla de harina', 'cer'), I(1, 'cda', 'Guacamole', 'gra'), I(1 / 2, 'cdita', 'Aceite de oliva', 'gra'), I(80, 'g', 'Seitán', 'pro'), I(1 / 2, 'pza', 'Pimiento de color', 'ver'), I(1 / 4, 'taza', CEBOLLA, 'ver'), I(2, 'cda', SOYA, 'desp', '2 cdas de salsa de soya'), F('Ajo en polvo'), F('Cebolla en polvo'), F('Pimentón ahumado'), F('Limón', 'fru', 'Unas gotitas de limón'), F('Sal yodada'), F('Pimienta')],
      steps: ['Marina el seitán una noche antes (o el mismo día, directo en el sartén) con 2 cdas de salsa de soya, el aceite de oliva, ½ cdita de ajo en polvo, ½ cdita de cebolla en polvo, ½ cdita de pimentón ahumado, sal yodada, pimienta y unas gotitas de limón.', 'Corta el pimiento en tiras y la cebolla en rodajas, y cocínalos en el sartén junto con el seitán.', 'Calienta la tortilla de harina en otro sartén.', 'Coloca la mezcla de seitán y verduras en el centro de la tortilla y agrega el guacamole encima.', 'Enrolla la tortilla para formar el burrito. Disfruta :)'],
      ahead: 'Si puedes, deja marinando el seitán desde la noche anterior.',
      tips: [TIP_TORTILLA]
    },
    {
      id: 'x-tacos-seitan', meal: 'des', extra: true, name: 'Tacos de seitán a la mexicana', emoji: '🌮',
      ing: [I(2, 'pza', 'Tortilla de maíz', 'cer'), I(80, 'g', 'Seitán', 'pro'), I(1 / 2, 'pza', 'Jitomate', 'ver'), I(1 / 4, 'taza', CEBOLLA, 'ver'), I(1, 'cdita', 'Aceite de oliva', 'gra'), F('Chile serrano', 'ver', 'Chile serrano al gusto'), F('Sal yodada'), F('Pimienta')],
      steps: ['Pica el jitomate, la cebolla y el chile. Corta el seitán en tiras.', 'Sofríe la cebolla y el chile en el aceite 2 minutos; agrega el seitán y dóralo.', 'Añade el jitomate, sal y pimienta y cocina 3 minutos más.', 'Calienta las tortillas y arma tus tacos.']
    },
    {
      id: 'x-tinga-tofu', meal: 'des', extra: true, name: 'Tostadas de tinga de tofu', emoji: '🫓',
      ing: [I(4, 'pza', 'Tostadas horneadas', 'cer'), I(80, 'g', 'Tofu firme', 'pro'), I(1 / 2, 'pza', 'Jitomate', 'ver'), I(1 / 4, 'taza', CEBOLLA, 'ver', '¼ taza de cebolla en rodajas'), I(1, 'cdita', 'Aceite de oliva', 'gra'), F('Chile chipotle adobado', 'desp', '½ chile chipotle adobado (o al gusto)'), F('Ajo', 'ver'), F('Sal yodada')],
      steps: ['Licúa el jitomate con el chipotle, el ajo y un chorrito de agua.', 'Sofríe la cebolla en el aceite hasta que esté suave; agrega el tofu desmoronado con las manos y dóralo un poco.', 'Vierte la salsa, sala al gusto y cocina 5 minutos.', 'Sirve la tinga sobre las tostadas.']
    },

    /* ---------------- COLACIÓN 1 ---------------- */
    {
      id: 'matcha', meal: 'c1', name: 'Matcha latte', emoji: '🍵', fruitChoice: true,
      ing: [I(1, 'taza', BEBIDA, 'lec', '1 taza de bebida vegetal sin azúcar (de soya o chícharo)'), F('Matcha en polvo'), I(1, 'porcion', 'Fruta de tu elección', 'fru', '1 porción de fruta')],
      steps: ['Usa bebida vegetal de <b>soya o chícharo</b>, como indica tu plan.', 'Disuelve el matcha en un poquito de agua caliente, agrega la bebida vegetal (caliente o con hielo) y mezcla.', 'Acompáñalo con tu porción de fruta. Sirve y disfruta :)'],
      tips: ['Tu plan lista “sustituto lácteo de almendra”, pero pide usar de soya o chícharo (aportan más proteína). Elige una sin azúcar y fortificada con calcio, vitamina D y B12.']
    },
    {
      id: 'latte-fruta', meal: 'c1', name: 'Latte con fruta', emoji: '☕', fruitChoice: true,
      ing: [I(1, 'taza', BEBIDA, 'lec', '1 taza de bebida vegetal sin azúcar (de soya o chícharo)'), F('Café'), I(1, 'porcion', 'Fruta de tu elección', 'fru', '1 porción de fruta')],
      steps: ['Prepara tu café y agrégale tu porción de bebida vegetal de soya (o chícharo).', 'Acompáñalo con la fruta de tu elección. Disfruta :)']
    },
    {
      id: 'x-licuado-fresa', meal: 'c1', extra: true, name: 'Licuado de fresa', emoji: '🥤',
      ing: [I(1, 'taza', BEBIDA, 'lec', '1 taza de bebida vegetal sin azúcar (de soya o chícharo)'), I(1, 'taza', 'Fresa', 'fru', '1 taza de fresa'), F('Canela en polvo', 'desp', 'Canela o vainilla (opcional)')],
      steps: ['Licúa la bebida vegetal con las fresas, canela o vainilla y hielo al gusto.', 'Sirve y disfruta.']
    },
    {
      id: 'x-yogurt-moras', meal: 'c1', extra: true, name: 'Yogurt de soya con moras', emoji: '🫐',
      ing: [I(1, 'taza', 'Yogurt de soya sin azúcar', 'lec', '1 taza de yogurt de soya (o de tofu) sin azúcar'), I(3 / 4, 'taza', 'Moras', 'fru', '¾ taza de moras o arándanos')],
      steps: ['Sirve el yogurt en un bowl.', 'Agrega las moras encima y disfruta.'],
      tips: ['Elige yogurt vegetal natural, sin azúcar añadida.']
    },

    /* ---------------- COMIDA ---------------- */
    {
      id: 'tabule', meal: 'com', name: 'Tabulé de lentejas con tempeh', emoji: '🥗',
      ing: [I(2 / 3, 'taza', 'Arroz salvaje cocido', 'cer'), I(1, 'cdita', 'Aceite de ajonjolí', 'gra'), I(1 / 2, 'taza', 'Lenteja cocida', 'pro'), I(30, 'g', 'Tempeh', 'pro'), I(4, 'pza', 'Jitomate cherry', 'ver'), F('Perejil', 'ver', 'Perejil picado'), I(1, 'pza', 'Limón', 'fru'), F('Sal yodada')],
      steps: ['Remoja tus lentejas al menos 12 horas y luego cuécelas en una olla con agua y ½ cebolla. Cocina también el arroz según las instrucciones del empaque.', 'Corta los jitomates, el tempeh y el perejil.', 'Mezcla las verduras con las lentejas, el tempeh y el arroz cocidos; agrega jugo de limón y sal yodada al gusto.', 'Aliña con el aceite de ajonjolí.', 'Sirve frío y disfruta :)'],
      ahead: 'Remoja las lentejas al menos 12 horas antes de cocerlas.'
    },
    {
      id: 'pasta-rapida', meal: 'com', name: 'La pasta más rápida del mundo', emoji: '🍝',
      ing: [I(1, 'taza', 'Pasta cocida', 'cer'), I(1, 'cdita', 'Aceite de oliva', 'gra'), I(54, 'g', 'Edamame', 'pro'), I(1, 'taza', 'Mix de vegetales verdes (congelado)', 'ver'), F('Sal yodada'), F('Ajo en polvo'), F('Pimienta')],
      steps: ['Cocina la pasta según las instrucciones del empaque.', 'Para el mix de vegetales usa uno de verduras congeladas: descongélalo en una olla con agua caliente junto con los edamames.', 'Después llévalos a un sartén con ajo en polvo y pimienta y saltea unos minutos.', 'Mezcla todo en un bowl y vuelve a espolvorear con ajo en polvo y sal yodada al gusto.', 'Agrega el aceite de oliva crudo y mezcla todo.', 'Disfruta :)'],
      tips: [TIP_PASTA]
    },
    {
      id: 'noodles', meal: 'com', name: 'Noodles', emoji: '🍜',
      ing: [I(40, 'g', 'Fideos chinos de arroz', 'cer'), I(1, 'cdita', 'Aceite de ajonjolí', 'gra'), I(60, 'g', 'Soya texturizada', 'pro'), I(1 / 6, 'taza', 'Zanahoria', 'ver', '⅙ taza de zanahoria picada o rallada'), I(1 / 3, 'pza', 'Pimiento de color', 'ver'), I(1 / 6, 'taza', CEBOLLA, 'ver'), I(1, 'diente', 'Ajo', 'ver', '1 diente de ajo picado'), I(2, 'cda', SOYA, 'desp', '2 cdas de salsa tamari'), I(1, 'cda', 'Vinagre de arroz', 'desp'), I(1, 'cda', 'Jarabe de maple sin calorías', 'desp'), I(1, 'cda', 'Catsup sin azúcar', 'desp')],
      steps: ['Cocina los fideos según las instrucciones del paquete.', 'Parte las verduras en cachitos.', 'En un bowl mezcla las verduras con la soya texturizada, la salsa tamari, el aceite de ajonjolí, el vinagre de arroz, el jarabe de maple, la catsup y 200 ml de agua.', 'Deja marinar 5 minutos; después lleva la mezcla a un sartén y agrega los fideos cocidos (si hace falta, agrega más agua).', 'Sirve y disfruta :)']
    },
    {
      id: 'burrito-salad', meal: 'com', name: 'Burrito salad', emoji: '🥙',
      ing: [I(1 / 4, 'taza', 'Arroz cocido', 'cer'), I(30, 'g', 'Totopos horneados', 'cer'), I(1 / 3, 'pza', 'Aguacate', 'gra'), I(1 / 2, 'taza', 'Frijol cocido', 'pro'), I(30, 'g', 'Tempeh', 'pro'), I(1, 'pza', 'Pimiento de color', 'ver'), I(100, 'g', 'Tofu suave', 'pro'), I(1 / 2, 'diente', 'Ajo', 'ver'), F('Cilantro', 'ver', '1 puñito de cilantro fresco'), I(1, 'pza', 'Limón', 'fru', 'Jugo de 1 limón'), I(1, 'cda', 'Jarabe de maple sin calorías', 'desp'), I(1 / 4, 'pza', CEBOLLA, 'ver', '¼ de cebolla morada'), F('Sal yodada'), F('Pimienta'), F('Jalapeños', 'desp', 'Opcional: jalapeños al gusto')],
      steps: ['Remoja los frijoles al menos 12 horas antes y después ponlos a cocer.', 'En un bowl coloca los frijoles cocidos, el arroz, la cebolla morada picada, el pimiento picado y el tempeh.', 'Para la salsa: licúa el aguacate, el tofu suave, el ajo, el cilantro, el jugo de limón, el jarabe de maple, sal yodada y pimienta hasta obtener una mezcla homogénea.', 'Agrega la salsa al bowl junto con los totopos.', 'Disfruta :)'],
      ahead: 'Remoja los frijoles al menos 12 horas antes de cocerlos.'
    },
    {
      id: 'x-curry-garbanzo', meal: 'com', extra: true, name: 'Bowl de garbanzo al curry', emoji: '🍛',
      ing: [I(2 / 3, 'taza', 'Arroz integral cocido', 'cer'), I(1, 'taza', 'Garbanzo cocido', 'pro'), I(1 / 2, 'taza', 'Brócoli cocido', 'ver'), I(1, 'cdita', 'Aceite de coco', 'gra'), F('Curry en polvo', 'desp', '1 cdita de curry en polvo'), F('Ajo en polvo'), F('Sal yodada'), F('Limón', 'fru', 'Unas gotas de limón')],
      steps: ['Calienta el aceite de coco y sofríe el curry y el ajo en polvo 30 segundos.', 'Agrega los garbanzos y el brócoli con un chorrito de agua; saltea 4–5 minutos.', 'Sirve sobre el arroz integral, sala al gusto y termina con unas gotas de limón.']
    },
    {
      id: 'x-tacos-frijol', meal: 'com', extra: true, name: 'Tacos de frijol con nopales', emoji: '🌵',
      ing: [I(2, 'pza', 'Tortilla de maíz', 'cer'), I(2 / 3, 'taza', 'Frijoles refritos caseros (sin manteca)', 'pro'), I(1, 'taza', 'Nopal cocido', 'ver'), I(1 / 3, 'pza', 'Aguacate', 'gra'), F('Salsa', 'desp', 'Salsa al gusto'), F('Cilantro', 'ver'), F('Sal yodada')],
      steps: ['Asa los nopales en el comal con una pizca de sal y córtalos en tiras.', 'Calienta los frijoles refritos (hechos con agua, sin manteca).', 'Arma los tacos con frijol, nopal, aguacate, salsa y cilantro.']
    },

    /* ---------------- COLACIÓN 2 ---------------- */
    {
      id: 'fresas-choco', meal: 'c2', name: 'Fresas cubiertas de chocolate sin azúcar', emoji: '🍓',
      ing: [I(1, 'taza', 'Fresa', 'fru', '1 taza de fresa rebanada'), I(30, 'g', 'Chocolate amargo sin azúcar', 'gra'), I(1 / 2, 'cdita', 'Aceite de coco', 'gra')],
      steps: ['Lava y desinfecta las fresas.', 'Derrite el chocolate en el microondas o a baño maría, agrega ½ cdita de aceite de coco y mezcla muy bien.', 'Sumerge las fresas en el chocolate.', 'Refrigera por al menos 30 minutos.', 'Disfruta :)'],
      tips: ['Elige chocolate amargo <b>sin leche</b>: revisa que no diga leche, suero de leche ni grasa butírica.']
    },
    {
      id: 'mix-salado', meal: 'c2', name: 'Mix salado', emoji: '🍍',
      ing: [I(1 / 2, 'taza', 'Piña', 'fru', '½ taza de piña picada'), I(1 / 2, 'taza', 'Sandía', 'fru', '½ taza de sandía picada'), I(28, 'pza', 'Cacahuate', 'gra', '28 cacahuates'), F('Pepino', 'ver', 'Pepino al gusto'), F('Zanahoria', 'ver', 'Zanahoria al gusto'), F('Chile piquín')],
      steps: ['Mezcla la fruta y la verdura con chile piquín y los cacahuates.', 'Disfruta :)']
    },
    {
      id: 'garden-veggie', meal: 'c2', name: 'Garden Veggie 28 g con cacahuates', emoji: '🥭',
      ing: [I(28, 'g', 'Garden Veggie Straws', 'cer', '28 g de Garden Veggie Straws'), I(1, 'taza', 'Mango', 'fru', '1 taza de mango picado'), I(28, 'pza', 'Cacahuate', 'gra', '28 cacahuates')],
      steps: ['Acompaña tus veggie straws con el mango y los cacahuates.', 'Disfruta ;)'],
      tips: ['Las Garden Veggie Straws sabor sal de mar suelen ser veganas; los sabores ranch o cheddar llevan lácteos. Revisa la etiqueta.']
    },
    {
      id: 'galleta-manzana', meal: 'c2', name: 'Galleta en manzana', emoji: '🍎',
      ing: [I(1, 'pza', 'Manzana', 'fru'), I(2, 'cda', 'Crema de cacahuate natural', 'gra'), I(1, 'cdita', 'Chispas de chocolate amargo', 'gra'), I(2, 'cda', 'Linaza molida', 'gra')],
      steps: ['Corta la manzana en rebanadas y úntalas con la crema de cacahuate.', 'Agrega de topping las chispas de chocolate amargo y espolvorea las 2 cdas de linaza molida.', 'Disfruta :) Si quieres, mételas unas horas al refrigerador antes de comerlas.'],
      tips: ['Que las chispas de chocolate sean amargas y sin leche.']
    },
    {
      id: 'x-mango-pistache', meal: 'c2', extra: true, name: 'Mango con chile y pistaches', emoji: '🥭',
      ing: [I(1, 'taza', 'Mango', 'fru', '1 taza de mango picado'), I(36, 'pza', 'Pistache', 'gra', '36 pistaches'), F('Chile piquín'), F('Limón', 'fru', 'Unas gotas de limón')],
      steps: ['Sirve el mango picado con limón y chile piquín.', 'Acompáñalo con los pistaches.']
    },
    {
      id: 'x-uvas-almendras', meal: 'c2', extra: true, name: 'Uvas congeladas con almendras', emoji: '🍇',
      ing: [I(18, 'pza', 'Uva', 'fru', '18 uvas'), I(20, 'pza', 'Almendra', 'gra', '20 almendras')],
      steps: ['Lava las uvas y congélalas al menos 2 horas.', 'Sírvelas con las almendras: saben a nieve.']
    },

    /* ---------------- CENA ---------------- */
    {
      id: 'tacos-arabes', meal: 'cen', name: 'Tacos árabes con tofu', emoji: '🌮',
      ing: [I(2, 'pza', 'Pan pita taquero', 'cer'), I(1, 'cdita', 'Aceite de oliva', 'gra'), I(80, 'g', 'Tofu firme', 'pro'), I(1 / 2, 'taza', CEBOLLA, 'ver'), I(1, 'cda', SOYA, 'desp', '1 cda de salsa de soya baja en sodio'), I(1, 'cda', 'Levadura nutricional', 'desp'), I(1 / 2, 'cdita', 'Comino', 'desp'), I(1 / 2, 'cdita', 'Paprika', 'desp'), F('Ajo en polvo'), F('Orégano seco', 'desp', '1 pizca de orégano seco'), F('Sal yodada'), F('Pimienta')],
      steps: ['Escurre el tofu y córtalo en tiras delgadas o en cubos.', 'Marina el tofu con la salsa de soya, levadura nutricional, comino, ajo en polvo, paprika, orégano, sal yodada y pimienta.', 'Al día siguiente, calienta el aceite en un sartén con la cebolla picada y cocina 3 a 4 minutos hasta que esté suave.', 'Incorpora el tofu marinado y cocina 2–3 minutos más, mezclando de vez en cuando, hasta que se dore ligeramente.', 'Calienta el pan pita unos segundos en un comal o sartén.', 'Rellena el pan pita con la mezcla de tofu y cebolla.', 'Disfruta :)'],
      ahead: 'Deja marinando el tofu desde la noche anterior.'
    },
    {
      id: 'mac-cheese', meal: 'cen', name: 'Mac n cheese con tofu', emoji: '🍲',
      ing: [I(1, 'taza', 'Pasta cocida', 'cer'), I(1, 'cdita', 'Aceite de oliva', 'gra'), I(80, 'g', 'Tofu firme', 'pro'), I(1 / 2, 'taza', 'Zanahoria', 'ver', '½ taza de zanahoria picada'), I(1 / 4, 'pza', CEBOLLA, 'ver', '¼ de cebolla'), I(2, 'diente', 'Ajo', 'ver'), I(1, 'cda', 'Sazonador vegetal', 'desp'), I(2, 'cda', 'Levadura nutricional', 'desp')],
      steps: ['Hierve las zanahorias en una olla con el ajo y la cebolla.', 'Cocina la pasta según las indicaciones del paquete.', 'Cuando las verduras estén cocidas, llévalas a la licuadora con 200 ml del agua de cocción de la pasta, el tofu, 1 cda de sazonador vegetal y 2 cdas de levadura nutricional.', 'Mezcla la salsa con la pasta cocida y agrega el aceite de oliva.', 'Disfruta :)'],
      tips: ['Revisa que el sazonador vegetal no tenga pollo ni lácteos (algunos consomés en polvo los traen).', TIP_PASTA]
    },
    {
      id: 'alambre-seitan', meal: 'cen', name: 'Alambre de seitán', emoji: '🫑',
      ing: [I(2, 'pza', 'Tortilla de maíz', 'cer'), I(1, 'cdita', 'Aceite de aguacate', 'gra'), I(80, 'g', 'Seitán', 'pro'), I(1 / 2, 'pza', 'Pimiento de color', 'ver'), I(1 / 4, 'taza', CEBOLLA, 'ver'), I(1, 'cda', SOYA, 'desp', '1 cda de salsa de soya baja en sodio'), I(1 / 3, 'cda', 'Pimentón en polvo', 'desp'), F('Ajo en polvo'), I(1 / 2, 'pza', 'Naranja', 'fru'), I(1, 'pza', 'Limón', 'fru'), F('Pimienta')],
      steps: ['Deja el seitán marinando desde la noche anterior con la salsa de soya, el jugo del limón y de la ½ naranja, pimentón, pimienta y ajo en polvo. (Puedes usar tofu en la misma cantidad en lugar de seitán.)', 'Al día siguiente, saltea la cebolla picada y el pimiento en el aceite de aguacate; después de unos minutos agrega el seitán.', 'Calienta las tortillas y forma tacos con el alambre.', '¡Sirve y disfruta! :)'],
      ahead: 'Deja marinando el seitán desde la noche anterior.'
    },
    {
      id: 'sandwich-tofu', meal: 'cen', name: 'Sándwich de tofu a las finas hierbas con aguacate', emoji: '🥪',
      ing: [I(60, 'g', 'Pan de masa madre', 'cer'), I(1 / 3, 'pza', 'Aguacate', 'gra'), I(80, 'g', 'Tofu firme', 'pro'), I(2 / 3, 'taza', 'Espinaca', 'ver', '⅔ taza de espinaca cruda picada'), I(4 / 3, 'pza', 'Jitomate cherry', 'ver'), I(1 / 3, 'taza', 'Pepino', 'ver', '⅓ taza de pepino rebanado'), I(2, 'cda', SOYA, 'desp', '2 cdas de salsa de soya o tamari'), I(1, 'cdita', 'Aceite de ajonjolí', 'gra'), I(1, 'pza', 'Limón', 'fru', 'Jugo de 1 limón'), I(1 / 2, 'cdita', 'Ajo en polvo', 'desp'), I(1, 'cda', 'Finas hierbas', 'desp', '1 cda de finas hierbas (perejil, estragón, cebollino y perifollo)'), F('Pimienta', 'desp', 'Pimienta negra al gusto'), I(1, 'cda', 'Hummus', 'gra')],
      steps: ['Una noche antes, marina el tofu en un tupper con la salsa de soya, el aceite de ajonjolí, el jugo de limón, el ajo en polvo, las finas hierbas y pimienta, y déjalo en el refrigerador.', 'Al día siguiente arma tu sándwich: unta el hummus y agrega el aguacate, el tofu y las verduras al gusto.', 'Disfruta :)'],
      ahead: 'Deja marinando el tofu desde la noche anterior.'
    },
    {
      id: 'x-tacos-champi', meal: 'cen', extra: true, name: 'Tacos de champiñones con tofu', emoji: '🍄',
      ing: [I(2, 'pza', 'Tortilla de maíz', 'cer'), I(80, 'g', 'Tofu firme', 'pro'), I(1, 'taza', 'Champiñón', 'ver', '1 taza de champiñones rebanados'), I(1, 'cdita', 'Aceite de oliva', 'gra'), I(1, 'diente', 'Ajo', 'ver'), F('Epazote o perejil', 'ver'), F('Sal yodada'), F('Salsa', 'desp', 'Salsa al gusto')],
      steps: ['Desmorona el tofu y dóralo en el aceite con el ajo picado.', 'Agrega los champiñones y cocina hasta que suelten su jugo y se evapore.', 'Sazona con sal y epazote o perejil.', 'Calienta las tortillas y arma tus tacos con salsa.']
    },
    {
      id: 'x-quinoa-tempeh', meal: 'cen', extra: true, name: 'Quinoa tibia con tempeh y calabacita', emoji: '🥣',
      ing: [I(40, 'g', 'Quinoa', 'cer', '40 g de quinoa cruda'), I(80, 'g', 'Tempeh', 'pro'), I(1, 'pza', 'Calabacita', 'ver'), I(1, 'cdita', 'Aceite de oliva', 'gra'), I(1, 'cda', SOYA, 'desp', '1 cda de salsa de soya baja en sodio'), F('Limón', 'fru', 'Jugo de ½ limón'), F('Pimienta')],
      steps: ['Enjuaga la quinoa y cuécela con el doble de agua unos 15 minutos.', 'Corta el tempeh y la calabacita en cubos y saltéalos en el aceite con la salsa de soya 6–8 minutos.', 'Mezcla con la quinoa y termina con limón y pimienta.']
    }
  ];

  var SHOP_CATS = [
    { id: 'fru', name: 'Frutas', emoji: '🍎' },
    { id: 'ver', name: 'Verduras', emoji: '🥬' },
    { id: 'pro', name: 'Proteínas y leguminosas', emoji: '🫘' },
    { id: 'cer', name: 'Cereales y panes', emoji: '🌾' },
    { id: 'lec', name: 'Bebidas y yogurt vegetal', emoji: '🥛' },
    { id: 'gra', name: 'Grasas, nueces y semillas', emoji: '🥑' },
    { id: 'desp', name: 'Despensa y condimentos', emoji: '🧂' }
  ];

  /* Prep del domingo: qué se puede adelantar de la semana.
   * n = nombre exacto del ingrediente en las recetas; las cantidades salen del menú de esa semana.
   * dry = tazas en seco por cada taza cocida (aprox.); dryG = gramos en seco por taza cocida. */
  var PREP = {
    soak: [
      { n: 'Lenteja cocida', name: 'Lentejas' },
      { n: 'Frijol cocido', name: 'Frijoles' },
      { n: 'Garbanzo cocido', name: 'Garbanzos' }
    ],
    cook: [
      { n: 'Lenteja cocida', name: 'Lentejas', how: 'Ya remojadas, cuécelas con agua y ½ cebolla.', dry: 0.4 },
      { n: 'Frijol cocido', name: 'Frijoles', how: 'Ya remojados, cuécelos (en olla exprés es más rápido).', dry: 0.4 },
      { n: 'Garbanzo cocido', name: 'Garbanzos', how: 'Ya remojados, cuécelos; o usa de lata, bien enjuagados.', dry: 0.4 },
      { n: 'Arroz salvaje cocido', name: 'Arroz salvaje', how: 'Cuécelo según el empaque.', dry: 0.3 },
      { n: 'Arroz cocido', name: 'Arroz', how: 'Cuécelo según el empaque.', dry: 0.33 },
      { n: 'Arroz integral cocido', name: 'Arroz integral', how: 'Cuécelo según el empaque.', dry: 0.33 },
      { n: 'Pasta cocida', name: 'Pasta', how: 'Cuécela al dente y escúrrela bien; se recalienta en un minuto.', dryG: 50 },
      { n: 'Quinoa', name: 'Quinoa', how: 'Enjuágala y cuécela con el doble de agua unos 15 minutos.' },
      { n: 'Brócoli cocido', name: 'Brócoli', how: 'Cuécelo al vapor 4–5 minutos.' }
    ],
    chop: [
      { n: CEBOLLA, name: 'Cebolla', how: 'Pícala y guárdala en un frasco cerrado.' },
      { n: 'Pimiento de color', name: 'Pimiento', how: 'Córtalo en tiras.' },
      { n: 'Zanahoria', name: 'Zanahoria', how: 'Pícala o rállala.' },
      { n: 'Ajo', name: 'Ajo', how: 'Pela los dientes y guárdalos en un frasco.' },
      { n: 'Cilantro', name: 'Cilantro', how: 'Lávalo, sécalo bien y guárdalo envuelto en papel.' },
      { n: 'Perejil', name: 'Perejil', how: 'Lávalo, sécalo bien y guárdalo envuelto en papel.' },
      { n: 'Espinaca', name: 'Espinaca', how: 'Lávala y sécala bien.' }
    ],
    // snacks que se arman completos (receta entera)
    snack: [
      { id: 'mix-pre', how: 'Arma los tuppers: cereal, dátiles y nueces.' },
      { id: 'bolitas-amaranto', how: 'Haz las bolitas y congélalas; pásalas al refri la noche anterior.' },
      { id: 'x-palomitas', how: 'Prepara las palomitas y guárdalas en bolsitas con los dátiles y las almendras.' },
      { id: 'x-uvas-almendras', how: 'Lava las uvas y congélalas.' }
    ],
    // nueces y semillas que conviene separar en porciones
    portion: [
      { n: 'Cacahuate', name: 'Cacahuates' },
      { n: 'Nuez', name: 'Nueces' },
      { n: 'Almendra', name: 'Almendras' },
      { n: 'Pistache', name: 'Pistaches' }
    ]
  };

  // Lista de equivalentes, solo alimentos veganos. Tercer valor = aviso de etiqueta.
  var ETQ = 'revisa la etiqueta';
  var EQUIV = {
    ver: [
      ['Acelga cruda', '2 tazas'], ['Alcachofa mediana', '1 pieza'], ['Apio', '1½ tazas'], ['Arúgula cruda', '4 tazas'], ['Berro crudo', '2 tazas'],
      ['Betabel crudo', '¼ pieza'], ['Brócoli cocido', '½ taza'], ['Calabacita', '1 pieza'], ['Calabaza de Castilla cocida', '½ taza'], ['Cebolla morada/blanca', '½ taza'],
      ['Cebollín picado', '3 cdas'], ['Cebollita cambray', '3 piezas'], ['Champiñón crudo', '1 taza'], ['Chayote', '½ pieza'], ['Chícharo cocido sin vaina', '¼ taza'],
      ['Chile poblano', '½ pieza'], ['Col cruda', '2 tazas'], ['Col de Bruselas', '63 g'], ['Col morada cruda picada', '1 taza'], ['Col rizada (kale)', '1 taza'],
      ['Coliflor cocida', '1 taza'], ['Ejote cocido', '½ taza'], ['Espárrago', '6 piezas'], ['Espinaca cruda picada', '2 tazas'], ['Flor de calabaza cocida', '1 taza'],
      ['Germen de alfalfa crudo', '3 tazas'], ['Germen de lenteja crudo', '¼ taza'], ['Germen de soya cocido', '⅓ taza'], ['Haba verde', '4 piezas'], ['Hongo portobello crudo', '1 pieza'],
      ['Huitlacoche cocido', '⅓ taza'], ['Jícama picada', '½ taza'], ['Jitomate deshidratado', '5 piezas'], ['Lechuga', '3 tazas'], ['Mix de vegetales verdes', '1 taza'],
      ['Nopal cocido', '1 taza'], ['Nopal crudo', '2 piezas'], ['Palmito enlatado', '1 pieza'], ['Pepinillo', '⅓ taza'], ['Pepino rebanado', '1 taza'],
      ['Pimiento de color', '1 pieza'], ['Puerro crudo', '¼ pieza'], ['Puré de tomate', '¼ taza'], ['Rábano crudo rebanado', '1 taza'], ['Sopa de verduras', '½ taza', 'sin consomé de pollo'],
      ['Tomate / jitomate', '1 pieza'], ['Jitomate cherry', '4 piezas'], ['Tomate verde', '5 piezas'], ['Verdolaga cruda', '2 tazas'], ['Verduras picadas', '½ taza'],
      ['Zanahoria cruda picada/rallada', '½ taza'], ['Zanahoria miniatura cruda', '4 piezas']
    ],
    fru: [
      ['Açaí', '4 cdas'], ['Agua de coco', '1½ tazas'], ['Arándano azul', '¾ taza'], ['Arándano deshidratado', '2 cdas'], ['Carambolo', '1½ piezas medianas'],
      ['Cereza', '20 piezas'], ['Chabacano', '4 piezas'], ['Ciruela amarilla', '3 piezas pequeñas'], ['Ciruela criolla roja o amarilla', '3 piezas'], ['Ciruela negra', '½ pieza'],
      ['Ciruela pasa deshuesada', '7 piezas'], ['Dátil seco', '2 piezas'], ['Durazno amarillo', '2 piezas'], ['Frambuesa', '1 taza'], ['Fresa rebanada', '1 taza'],
      ['Granada roja', '1 pieza'], ['Guanábana', '1 pieza pequeña'], ['Guayaba', '3 piezas'], ['Higo', '2 piezas'], ['Kiwi', '1½ piezas'],
      ['Lima', '3 piezas'], ['Limón', '4 piezas'], ['Mamey', '⅓ pieza'], ['Mandarina', '2 piezas'], ['Mango ataúlfo', '½ pieza'],
      ['Mango manila', '1 pieza'], ['Mango petacón', '½ pieza'], ['Mango picado', '1 taza'], ['Manzana', '1 pieza'], ['Maracuyá', '3 piezas'],
      ['Melón picado', '1 taza'], ['Moras', '¾ taza'], ['Naranja', '2 piezas'], ['Nectarina', '1 pieza'], ['Papaya picada', '1 taza'],
      ['Pasitas', '10 piezas'], ['Pera', '½ pieza'], ['Piña picada', '¾ taza'], ['Pitahaya', '2 piezas'], ['Plátano', '½ pieza'],
      ['Plátano dominico', '3 piezas'], ['Plátano macho', '¼ pieza'], ['Pulpa de tamarindo sin azúcar', '8 cdas'], ['Sandía picada', '1 taza'], ['Toronja', '1 pieza'],
      ['Tuna', '2 piezas'], ['Uva', '18 piezas'], ['Yaca', '30 g'], ['Zarzamora', '1 taza']
    ],
    cer: [
      ['Amaranto natural', '¼ taza'], ['Arepa', '½ pieza'], ['Arroz cocido', '¼ taza'], ['Arroz integral cocido', '⅓ taza'], ['Arroz salvaje cocido', '⅓ taza'],
      ['Atole en polvo', '7 cditas', 'prepáralo con agua'], ['Avena en hojuela cruda', '⅓ taza'], ['Bagel', '1 pieza', 'algunos llevan huevo o miel'], ['Baguette integral chico', '⅓ pieza'],
      ['Barra de avena con frutos rojos', '1 pieza', 'puede llevar miel o leche'], ['Bolillo/birote sin migajón', '⅓ pieza', 'algunos llevan manteca'], ['Camote al horno', '⅓ taza'], ['Camote cocido', '⅓ taza'],
      ['Cebada', '20 g'], ['Cereal infantil fortificado', '15 g', 'que no tenga leche'], ['Couscous cocido', '⅓ taza'], ['Croutones', '½ taza', 'pueden llevar mantequilla o queso'],
      ['Elote', '½ taza'], ['Elote amarillo desgranado', '½ taza'], ['Fécula de maíz', '2 cdas'], ['Fideo cocido', '½ taza'], ['Fideos chinos de arroz', '20 g'],
      ['Galleta de arándano Gavetti', '1 pieza', ETQ], ['Galleta de animalito', '6 piezas', ETQ], ['Galleta Salma', '1 paquete'], ['Galletas gluten free tipo María', '5 piezas', ETQ],
      ['Galletas habaneras', '4 piezas', ETQ], ['Galletas Marías', '5 piezas', ETQ], ['Galletas saladas', '4 piezas', ETQ], ['Granola', '3 cdas', 'muchas llevan miel'],
      ['Harina de avena', '2 cdas'], ['Harina de maíz', '2½ cdas'], ['Harina de maíz precocido', '1½ cdas'], ['Harina de tapioca', '2½ cdas'], ['Harina de trigo', '2½ cdas'],
      ['Harina de yuca', '2 cdas'], ['Harina gluten free', '2½ cdas'], ['Harina integral', '2½ cdas'], ['Hojas de lasaña crudas', '20 g', 'sin huevo'], ['Maíz pozolero', '⅓ taza'],
      ['Palomitas naturales', '2½ tazas', 'sin mantequilla'], ['Pan árabe integral', '⅓ pieza'], ['Pan blanco', '1 pieza', 'algunos llevan leche o miel'], ['Pan de hamburguesa', '⅓ pieza', 'suele llevar leche o huevo'],
      ['Pan de hot dog', '½ pieza', 'suele llevar leche o huevo'], ['Pan de masa madre', '30 g'], ['Pan integral', '1 pieza', 'algunos llevan miel o leche'], ['Pan integral tostado', '1 pieza', ETQ],
      ['Pan molido', '1 cda', ETQ], ['Pan pita taquero', '1 pieza'], ['Pan thin integral', '1½ piezas', ETQ], ['Papa cambray', '5 piezas'], ['Papa cocida', '½ pieza'],
      ['Papel de arroz comestible', '5 piezas'], ['Pasta cocida', '½ taza', 'sin huevo'], ['Pasta de quinoa', '⅓ taza'], ['Pasta integral cocida', '⅓ taza', 'sin huevo'], ['Pretzel', '6 piezas', 'algunos llevan mantequilla'],
      ['Quinoa cruda', '20 g'], ['Quinoa inflada', '25 g'], ['Seitán (gluten de trigo)', '30 g'], ['Sémola de maíz', '½ taza'], ['Sope de maíz', '1 pieza', 'sin manteca'],
      ['Tapioca', '1 cda'], ['Tlacoyo', '½ pieza', 'sin manteca ni queso'], ['Tortilla de harina', '½ pieza', 'sin manteca de cerdo'], ['Tortilla de maíz', '1 pieza'], ['Tortilla de nopal', '3 piezas'],
      ['Tortitas de arroz', '2 piezas'], ['Tortitas de arroz inflado integral', '2 piezas'], ['Tostadas horneadas', '2 piezas'], ['Totopos horneados', '30 g'],
      ['Waffle sin azúcar', '1 pieza', 'suele llevar huevo y leche: busca versión vegana'], ['Yuca', '¼ pieza']
    ],
    leg: [
      ['Alubia cocida', '½ taza'], ['Bebida de soya sin azúcar', '1 taza'], ['Edamame', '27 g'], ['Frijol cocido', '½ taza'], ['Frijol de soya cocido', '½ taza'],
      ['Frijoles refritos caseros', '⅓ taza', 'sin manteca'], ['Garbanzo cocido', '½ taza'], ['Lenteja cocida', '½ taza'], ['Miso', '60 g'], ['Soya texturizada', '30 g'], ['Tempeh', '30 g']
    ],
    pro: [
      ['Tofu firme', '40 g'], ['Seitán', '40 g'], ['Tempeh', '40 g'], ['Milanesa NotCo', '35 g'], ['Pechuga sin pollo Futopia', '½ pieza'],
      ['Salchicha de seitán', '1 pieza'], ['Salchicha de trigo', '1 pieza', ETQ]
    ],
    lec: [
      ['Bebida de soya', '1 vasito'], ['Bebida de chícharo sin azúcar', '1 taza', 'la que pide tu plan'], ['Sustituto lácteo de almendra', '1 taza'], ['Sustituto lácteo de arroz', '1 taza'],
      ['Sustituto lácteo de coco', '1 taza'], ['Sustituto lácteo de nuez', '1 taza'], ['Yogurt de tofu / soya', '1 taza']
    ],
    gsp: [
      ['Aceite (cualquiera)', '1 cdita'], ['Aceite de aguacate', '1 cdita'], ['Aceite de ajonjolí', '1 cdita'], ['Aceite de coco', '1 cdita'], ['Aceite de linaza', '1 cdita'],
      ['Aceite de oliva', '1 cdita'], ['Aceite de palma', '1 cdita'], ['Aceite de uva', '1 cdita'], ['Aceite en spray', '5 disparos de 1 seg'], ['Aceituna negra', '5 piezas'],
      ['Aceituna verde', '6 piezas'], ['Aguacate', '⅓ pieza'], ['Coco fresco', '12 g'], ['Coco rallado', '1½ cdas'], ['Guacamole', '2 cdas'],
      ['Mayonesa vegana', '1 cdita', 'la normal lleva huevo'], ['Vinagreta', '½ cda', 'sin miel ni queso']
    ],
    gcp: [
      ['Almendra', '10 piezas'], ['Almendra fileteada', '2 cdas'], ['Avellana', '9 piezas'], ['Cacahuate', '14 piezas'], ['Cacahuate con cáscara', '12 g'],
      ['Chocolate sin azúcar', '15 g', 'amargo y sin leche'], ['Crema de almendra natural', '1 cda'], ['Crema de cacahuate natural', '1 cda'], ['Harina de almendra', '11 g'], ['Harina de linaza', '2 cdas'],
      ['Harina de nuez', '2 cdas'], ['Hummus de garbanzo', '1 cda'], ['Linaza molida', '1 cda'], ['Mazapán sin azúcar', '1 pieza', ETQ], ['Mix de frutos secos y semillas', '¼ taza'],
      ['Nuez', '7 mitades'], ['Nuez de Brasil', '2 piezas'], ['Nuez de la India sin sal', '7 piezas'], ['Nuez de macadamia', '4 piezas'], ['Pepita de calabaza', '1½ cdas'],
      ['Piñón', '1 cda'], ['Pistache', '18 piezas'], ['Semilla de ajonjolí', '4 cditas'], ['Semilla de calabaza', '1½ cdas'], ['Semilla de cártamo', '1¼ cdas'],
      ['Semilla de chía', '2 cdas (12 g)'], ['Semilla de girasol', '4 cditas'], ['Semilla de linaza', '1 cda'], ['Tahini', '1 cda']
    ]
  };

  // Alimentos de origen animal que venían en la lista de equivalentes original
  var REMOVED = [
    'Arrachera de res', 'Atún en aceite', 'Chuleta de cerdo', 'Hígado de pollo', 'Hígado de res', 'Jamón bajo en grasa', 'Lomo', 'Muslo de pollo',
    'Pierna', 'Pierna de cerdo', 'Pierna de pollo', 'Queso cheddar', 'Queso fresco', 'Queso fresco de cabra', 'Queso Oaxaca', 'Queso panela', 'Queso ricotta',
    'Res molida', 'Res sin grasa', 'Salmón', 'Ternera',
    'Leche descremada', 'Leche deslactosada light', 'Leche evaporada descremada', 'Yogurt griego',
    'Crema', 'Crema batida', 'Crema para batir', 'Mantequilla', 'Queso crema', 'Queso Philadelphia', 'Tocino'
  ];

  var FRUIT_IDEAS = [
    ['Manzana', '1 pieza'], ['Plátano', '½ pieza'], ['Fresa', '1 taza'], ['Papaya', '1 taza'], ['Melón', '1 taza'],
    ['Uva', '18 piezas'], ['Mandarina', '2 piezas'], ['Kiwi', '1½ piezas'], ['Moras', '¾ taza'], ['Pera', '½ pieza']
  ];

  var TIPS = [
    { e: '💊', t: 'Vitamina B12', d: 'Es el único nutriente que una dieta vegana estricta no aporta de forma confiable; normalmente se toma como suplemento. Pregúntale a tu nutrióloga cuál y cuánto.' },
    { e: '🧂', t: 'Yodo', d: 'Tu plan usa <b>sal yodada</b>: es tu principal fuente de yodo, así que prefiérela sobre la sal de mar sin yodo.' },
    { e: '🌰', t: 'Omega-3 sin pescado', d: 'Linaza molida, chía y nuez (todas vienen en tu plan). Muele la linaza para aprovecharla mejor.' },
    { e: '🍋', t: 'Hierro', d: 'Acompaña frijoles, lentejas, tofu y espinaca con vitamina C (limón, jitomate, pimiento). Deja el café y el té para las colaciones, lejos de la comida y la cena.' },
    { e: '🥛', t: 'Calcio y vitamina D', d: 'Elige bebidas vegetales <b>fortificadas</b> y sin azúcar. El tofu hecho con sulfato de calcio también aporta calcio.' },
    { e: '🫘', t: 'Remoja las leguminosas', d: 'Tu plan pide remojar lentejas y frijoles 12 horas: se digieren mejor y se cuecen más rápido. Cuece de más y congela porciones de ½ taza.' },
    { e: '🏷️', t: 'Lee etiquetas', d: 'Ingredientes animales escondidos: leche, suero de leche, caseína, lactosa, mantequilla, manteca de cerdo, huevo, miel, grenetina y colorante carmín.' },
    { e: '🥡', t: 'Cocina en tandas', d: 'Un día a la semana cuece arroz, lentejas y frijoles, y deja marinando tofu y seitán para 2–3 días. Entre semana solo armas.' }
  ];

  window.NJ_DATA = {
    GROUPS: GROUPS, MEALS: MEALS, WEEK: WEEK, RECIPES: RECIPES, SHOP_CATS: SHOP_CATS, PREP: PREP,
    EQUIV: EQUIV, REMOVED: REMOVED, FRUIT_IDEAS: FRUIT_IDEAS, TIPS: TIPS,
    PLAN: { assigned: '2026-11-08', review: '2026-12-18' }
  };
})();
