# NutriJabón 🌱

**Abrir / instalar:** https://robelugo.github.io/nutrijabon/

App para seguir tu plan de alimentación **vegano** día por día. Funciona en Android, iPhone/iPad, Windows y Mac: es una app web instalable (PWA), así que no necesita tiendas de apps y funciona sin internet una vez instalada.

## Qué hace

- **Hoy**: qué toca comer en cada horario, con casillas para marcar lo que ya comiste y un aviso de la siguiente comida.
- **Día de ejercicio / descanso**: en días de ejercicio incluye el pre-entreno; en días de descanso te avisa que **no** lo comas (1 fruta, 1 cereal y 1 grasa con proteína menos).
- **Cambiar platillo**: intercambia cualquier comida por otra opción del mismo tiempo (todas tienen las mismas porciones). Incluye ideas extra veganas.
- **Recetas**: las 22 recetas de tu plan más 12 ideas extra, con ingredientes, pasos y avisos de etiqueta ("ojo vegano"). Marca Me gusta o No me gusta: tus favoritas salen primero en "Cambiar", hay un filtro de Favoritas y el resumen para la revisión lista tus gustos.
- **Deja listo para mañana**: te recuerda remojar leguminosas o marinar tofu y seitán la noche anterior.
- **Modo cocina** (botón en cada receta y "Hacer el prep en modo cocina" en el prep): pantalla completa con un paso a la vez y letra grande, lista de ingredientes para palomear, temporizadores que salen de los tiempos de cada paso (más 5–60 min a mano) con sonido y vibración, y la pantalla se mantiene encendida donde el navegador lo permite. En el prep, "Hecho" palomea la tarea; deslizar o las flechas solo navegan.
- **Comer fuera** (Guía, "Cambiar" de cada comida, la receta del día y la razón "Comí fuera"): qué pedir en taquería, fonda, sushi, italiano, comida china, cafetería y tienda para cubrir las porciones de esa comida, con cantidades calculadas de tus equivalentes veganos, avisos de ingredientes animales escondidos y qué porciones son difíciles de cubrir en cada lugar. El contenido está en `EAT_OUT` dentro de `data.js` (usa nombres exactos de `EQUIV`).
- **Prep del domingo** (Compras → Prep del domingo): con el menú de esa semana arma las tareas para adelantar: sábado en la noche remojar leguminosas; domingo cocinar en tanda (con cantidades cocidas y aprox. en seco), lavar y picar, dejar listos los snacks y marinar para lunes a miércoles; miércoles en la noche marinar para jueves a domingo. Cada tarea se palomea, Hoy avisa el sábado, domingo y miércoles, y los recordatorios del calendario incluyen esas tres sesiones. Las reglas están en `PREP` dentro de `data.js`.
- **Compras**: lista semanal calculada con tu menú real (cambios de platillos y días de descanso incluidos); se puede compartir por WhatsApp. Lo que siempre tienes en casa (botón de la casita: sal, aceite, especias) deja de aparecer y queda en "Siempre en casa". En Hoy y en Semana puedes compartir el menú del día o de la semana (sin tus vitaminas ni medicamentos).
- **Guía**: equivalentes **solo veganos** (se quitaron 32 alimentos de origen animal de la lista original), tips veganos y ajustes (días de ejercicio y horarios).
- **Recordatorios**: descarga un archivo de calendario (.ics) con cada comida, el platillo que toca y un aviso a tu hora (pre-entreno solo en días de ejercicio). Lo maneja el calendario del equipo, así que no necesita servidor. Dura hasta la revisión.
- **¿Cumpliste?**: cada comida tiene ✓ (sí cumplí) y ✗ (no cumplí); tocar la misma marca la quita. Con ✗ se puede elegir por qué (comí fuera, no tuve tiempo, sin hambre, comí otra cosa, se me olvidó, otro), y el resumen muestra qué razones se repiten.
- **Vitaminas y medicamentos** (Guía): cada uno va con una comida, todos los días o solo en días de ejercicio, y se marca con ✓/✗ en Hoy. Aparecen en los recordatorios y en el resumen. Se guardan solo en el dispositivo (nunca en el código, que es público); viene precargada la vitamina, todos los días a la hora del pre-entreno (en días de descanso aparece aunque no toque el pre-entreno).
- **Progreso**: en Semana ves el porcentaje de comidas marcadas, tu racha de días completos y cuántos días faltan para la revisión. El **resumen para tu revisión** junta todo (por tiempo de comida, por semana, platillos cambiados y tus preguntas) para compartirlo o imprimirlo en PDF. El **resumen semanal** aparece en Hoy de lunes a miércoles (cómo te fue la semana pasada, comparado con la anterior, y un consejo según la razón de "no cumplí" que más se repitió); cualquier semana pasada se ve desde Semana. Al final de Hoy está **¿Cómo te sentiste?**: energía, hambre entre comidas y digestión (1–5 con caritas) y una nota; el resumen muestra promedios, diferencias entre días de ejercicio y descanso, días con digestión baja y tus notas.
- **Movimiento** (Guía → Movimiento): pilates de lunes a sábado después de la vitamina, ejercicio de fuerza martes y jueves, y caminata de 30 min después de cenar. Cada actividad sale en Hoy debajo de su comida con ✓/✗ (y por qué, si no se hizo), en Semana, en los recordatorios del calendario (un rato después de su comida) y en el resumen. Se pueden cambiar días, comida, duración, o agregar otras. No cuentan para el porcentaje de comidas.
- **Agua**: en Hoy, un toque por vaso (250 ml). La meta empieza en 8 vasos (2 L) y se cambia en Ajustes; el promedio sale en Semana y en el resumen.
- **Peso y medidas** (Semana): peso, cintura y cadera cuando quieras, con una gráfica del peso (toca para ver cada valor) y la tabla de registros. Sale en el resumen para la revisión. Solo se guarda en el dispositivo.
- **Gatos por semana cumplida**: cada semana completa (lunes a domingo) con 80% o más de las comidas cumplidas gana un gato, en orden: Marche, Batmi, Bumi, Tulin, Naranjo y Olivo (dibujados en `app.js`, `CATS`). Hoy avisa cuando ganas uno y Semana muestra la colección y cómo va la semana.
- **Apariencia** (Ajustes): oscuro (el de siempre), claro o automático según el dispositivo.
- **Respaldo**: guarda tus datos en un archivo `.json` y cárgalo en otro equipo. Al cargarlo eliges **combinar** (junta las marcas de los dos; si una comida tiene ✓ en uno y ✗ en otro gana ✓; se quedan los ajustes de ese equipo y se agregan las vitaminas o medicamentos que falten) o **reemplazar todo**.
- **Accesos directos**: en Android y en Windows, mantén presionado el ícono de la app para ir directo a Hoy, Semana, Compras o el Prep del domingo (iPhone no tiene esta función).

Tus datos (marcas, cambios, ajustes) se guardan solo en cada dispositivo; usa el respaldo para pasarlos de uno a otro.

La app no carga nada de otros sitios: las tipografías Fraunces y Nunito vienen incluidas en `fonts/` (subconjunto latino) con su licencia SIL Open Font License 1.1 (`fonts/OFL-*.txt`).

**Diseño:** tema oscuro tipo diario con encabezado crema, ilustraciones de cada platillo en `art/` (una por receta, con el mismo `id` de `data.js`; `art/cocina.jpg` es la portada de Recetas y la bienvenida) e íconos dibujados en `app.js` (`ICONS`, `SECTION_EMBLEMS` y `TAB_ART`). Los colores de pantalla están en `journal.css`; `styles.css` tiene la base y el estilo para imprimir el resumen. Si agregas una receta nueva, agrega también su imagen `art/<id>.jpg` y ponla en la lista de `sw.js` para que funcione sin internet.

## Probarla en esta computadora

Doble clic en `index.html`. Funciona en el navegador, pero así **no se puede instalar** ni usar sin internet.

Para probarla como app de verdad en tu PC:

```bash
py -m http.server 5173
```

y abre http://localhost:5173 en Edge o Chrome → ícono de instalar en la barra de direcciones.

## Instalarla en el celular (necesita estar publicada en https)

Sube esta carpeta a cualquier hosting estático gratuito, por ejemplo:

- **GitHub Pages**: crea un repositorio, sube los archivos y activa Pages (Settings → Pages → rama `main`).
- **Netlify Drop**: arrastra la carpeta a https://app.netlify.com/drop.

Luego abre la dirección en cada dispositivo:

| Dispositivo | Cómo instalar |
|---|---|
| Android | Chrome → menú ⋮ → **Instalar app** |
| iPhone / iPad | Safari → **Compartir** → **Agregar a inicio** |
| Windows | Edge o Chrome → ícono de instalar en la barra de direcciones |
| Mac | Safari → **Archivo → Agregar al Dock** (o Chrome → ícono de instalar) |

> Ojo: si el repositorio o la página son públicos, cualquiera con el enlace puede ver el menú y las recetas (no incluye tu nombre ni datos personales).

## Actualizar el plan

Todo el contenido del plan está en `data.js` (menú semanal en `WEEK`, recetas en `RECIPES`, equivalentes en `EQUIV`). Después de cambiarlo, sube la versión del caché en `sw.js` (`nutrijabon-v1` → `nutrijabon-v2`) para que los dispositivos instalados descarguen la versión nueva.

---

Basado en el plan asignado el 8 nov 2026 (próxima revisión: 18 dic 2026). NutriJabón te ayuda a seguir tu plan; no sustituye la consulta con tu nutrióloga.
