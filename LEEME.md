# NutriJabón 🌱

**Abrir / instalar:** https://robelugo.github.io/nutrijabon/

App para seguir tu plan de alimentación **vegano** día por día. Funciona en Android, iPhone/iPad, Windows y Mac: es una app web instalable (PWA), así que no necesita tiendas de apps y funciona sin internet una vez instalada.

## Qué hace

- **Hoy**: qué toca comer en cada horario, con casillas para marcar lo que ya comiste y un aviso de la siguiente comida.
- **Día de ejercicio / descanso**: en días de ejercicio incluye el pre-entreno; en días de descanso te avisa que **no** lo comas (1 fruta, 1 cereal y 1 grasa con proteína menos).
- **Cambiar platillo**: intercambia cualquier comida por otra opción del mismo tiempo (todas tienen las mismas porciones). Incluye ideas extra veganas.
- **Recetas**: las 22 recetas de tu plan más 12 ideas extra, con ingredientes, pasos y avisos de etiqueta ("ojo vegano").
- **Deja listo para mañana**: te recuerda remojar leguminosas o marinar tofu y seitán la noche anterior.
- **Modo cocina** (botón en cada receta y "Hacer el prep en modo cocina" en el prep): pantalla completa con un paso a la vez y letra grande, lista de ingredientes para palomear, temporizadores que salen de los tiempos de cada paso (más 5–60 min a mano) con sonido y vibración, y la pantalla se mantiene encendida donde el navegador lo permite. En el prep, "Hecho" palomea la tarea; deslizar o las flechas solo navegan.
- **Comer fuera** (Guía, "Cambiar" de cada comida, la receta del día y la razón "Comí fuera"): qué pedir en taquería, fonda, sushi, italiano, comida china, cafetería y tienda para cubrir las porciones de esa comida, con cantidades calculadas de tus equivalentes veganos, avisos de ingredientes animales escondidos y qué porciones son difíciles de cubrir en cada lugar. El contenido está en `EAT_OUT` dentro de `data.js` (usa nombres exactos de `EQUIV`).
- **Prep del domingo** (Compras → Prep del domingo): con el menú de esa semana arma las tareas para adelantar: sábado en la noche remojar leguminosas; domingo cocinar en tanda (con cantidades cocidas y aprox. en seco), lavar y picar, dejar listos los snacks y marinar para lunes a miércoles; miércoles en la noche marinar para jueves a domingo. Cada tarea se palomea, Hoy avisa el sábado, domingo y miércoles, y los recordatorios del calendario incluyen esas tres sesiones. Las reglas están en `PREP` dentro de `data.js`.
- **Compras**: lista semanal calculada con tu menú real (cambios de platillos y días de descanso incluidos); se puede compartir por WhatsApp.
- **Guía**: equivalentes **solo veganos** (se quitaron 32 alimentos de origen animal de la lista original), tips veganos y ajustes (días de ejercicio y horarios).
- **Recordatorios**: descarga un archivo de calendario (.ics) con cada comida, el platillo que toca y un aviso a tu hora (pre-entreno solo en días de ejercicio). Lo maneja el calendario del equipo, así que no necesita servidor. Dura hasta la revisión.
- **¿Cumpliste?**: cada comida tiene ✓ (sí cumplí) y ✗ (no cumplí); tocar la misma marca la quita. Con ✗ se puede elegir por qué (comí fuera, no tuve tiempo, sin hambre, comí otra cosa, se me olvidó, otro), y el resumen muestra qué razones se repiten.
- **Vitaminas y medicamentos** (Guía): cada uno va con una comida, todos los días o solo en días de ejercicio, y se marca con ✓/✗ en Hoy. Aparecen en los recordatorios y en el resumen. Se guardan solo en el dispositivo (nunca en el código, que es público); viene precargada la vitamina, todos los días a la hora del pre-entreno (en días de descanso aparece aunque no toque el pre-entreno).
- **Progreso**: en Semana ves el porcentaje de comidas marcadas, tu racha de días completos y cuántos días faltan para la revisión. El **resumen para tu revisión** junta todo (por tiempo de comida, por semana, platillos cambiados y tus preguntas) para compartirlo o imprimirlo en PDF.
- **Respaldo**: guarda tus datos en un archivo `.json` y cárgalo en otro equipo (reemplaza lo que haya ahí).

Tus datos (marcas, cambios, ajustes) se guardan solo en cada dispositivo; usa el respaldo para pasarlos de uno a otro.

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
