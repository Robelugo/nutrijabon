# NutriJabón 🌱

**Abrir / instalar:** https://robelugo.github.io/nutrijabon/

App para seguir tu plan de alimentación **vegano** día por día. Funciona en Android, iPhone/iPad, Windows y Mac: es una app web instalable (PWA), así que no necesita tiendas de apps y funciona sin internet una vez instalada.

## Qué hace

- **Hoy**: qué toca comer en cada horario, con casillas para marcar lo que ya comiste y un aviso de la siguiente comida.
- **Día de ejercicio / descanso**: en días de ejercicio incluye el pre-entreno; en días de descanso te avisa que **no** lo comas (1 fruta, 1 cereal y 1 grasa con proteína menos).
- **Cambiar platillo**: intercambia cualquier comida por otra opción del mismo tiempo (todas tienen las mismas porciones). Incluye ideas extra veganas.
- **Recetas**: las 22 recetas de tu plan más 12 ideas extra, con ingredientes, pasos y avisos de etiqueta ("ojo vegano").
- **Deja listo para mañana**: te recuerda remojar leguminosas o marinar tofu y seitán la noche anterior.
- **Compras**: lista semanal calculada con tu menú real (cambios de platillos y días de descanso incluidos); se puede compartir por WhatsApp.
- **Guía**: equivalentes **solo veganos** (se quitaron 32 alimentos de origen animal de la lista original), tips veganos y ajustes (días de ejercicio y horarios).
- **Recordatorios**: descarga un archivo de calendario (.ics) con cada comida, el platillo que toca y un aviso a tu hora (pre-entreno solo en días de ejercicio). Lo maneja el calendario del equipo, así que no necesita servidor. Dura hasta la revisión.
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
