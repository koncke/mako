# AI Avatar por código: tu personaje en cubos, animado con tu voz (diseño, 19/11/2026)

Martín, 19/11, textual: «quiero que… implemente dentro de la funcionalidad de AI Avatar justamente este avatar que es súper
fácil de crear, que prácticamente no gasta tokens porque no es IA generativa, sino que es prácticamente CSS y HTML, para que
los usuarios de MaKo lo puedan ir creando… súper, súper simple, y la mejor prueba… es… intentar replicar un video que ya
creamos desde acá… pero ahora dentro de MaKo».

Lo lleva el chat `ai-avatar-codigo`. La galería de la que sale cada formato está en `C:/dev/artefactos-animaciones`
(`LEEME.md`) y lo aprendido haciéndola, en `docs/editor-video/animaciones-por-codigo.md`.

## Qué hace la persona (cuatro pasos y un botón)

1. **Elige un formato.** Al arrancar son dos: «Palabras gigantes» (`punch-captions`) y «Subtítulos karaoke»
   (`karaoke-subs`). En los dos, el personaje habla en un cuarto desenfocado y el texto sigue a la voz.
2. **Escribe el guion o se lo pide a MaKo** con una idea en una línea. MaKo devuelve las frases (≤ 42 palabras, unos 15 s)
   y los datos del formato (las palabras que van en color, dónde acerca la cámara).
3. **Arma su personaje en cubos.** Sube su foto y MaKo elige piel, pelo, peinado, remera, ojos, anteojos y barba. Puede
   cambiar cada cosa a mano, con muestras de color.
4. **Elige la voz:** una voz de MaKo (David o Fernando), su voz clonada (si la clonó en el onboarding) o **su audio**: sube
   una grabación que dice el guion tal cual y MaKo la alinea. Con la voz de un video de la galería, así se replica exacto.
5. **«Crear video».** MaKo genera la voz con sus tiempos, y el video se ve al instante en la pantalla. Con «Descargar MP4»,
   el MP4 se arma **en su navegador**.

## Cómo funciona por dentro

| Paso | Quién lo hace | Gasta |
|---|---|---|
| Guion y datos del formato | La IA de texto (`chatCheapCascade`, feature `avatar-cubos-guion`), con el esquema del formato. Un `normalizar` puro descarta lo que no calza. | MaKo Tokens (pocos: un pedido corto) |
| Personaje desde la foto | La IA con visión, una vez (feature `avatar-cubos-personaje`). Devuelve valores de una lista cerrada, no colores sueltos. | MaKo Tokens (pocos) |
| La voz y sus tiempos | ElevenLabs `/with-timestamps`, un solo pedido: el audio y cada letra con su segundo. Una función pura pasa las letras a palabras y escenas (`window.TIEMPOS`, el mismo formato que usa la galería). | Voz de MaKo: `mtDeVoz(caracteres)`, cobrado antes y devuelto si ElevenLabs falla (el molde de `lib/voz-coach.ts`). Su clon: con su propia cuenta de ElevenLabs, como el resto de su voz. |
| La animación | La PLANTILLA: la página del formato de la galería, con su texto, sus tiempos y su personaje como datos. Corre en un iframe de la misma app (`public/avatar-cubos/`). | Nada |
| El MP4 | El navegador de la persona: cada cuadro se fotografía a sí mismo (el DOM del segundo T pasa a un SVG con `foreignObject`, de ahí a un canvas) y mediabunny lo codifica con la voz (el molde de `scene-exporter.ts` del Video Editor). | Nada; **no toca el servidor** |

- **Por qué la plantilla ES la página de la galería y no una copia en canvas:** así sale igual. El kit de la galería
  (`reels/kit/kit.js`) ya pinta cada segundo desde cero a partir de T («todo sale de T»), y eso es justo lo que necesita
  un MP4: el mismo segundo da siempre la misma imagen. Lo que cambia en el puerto es poco y está listado abajo.
- **Por qué el MP4 se arma en el navegador:** el render no puede trabar el servidor, y un Chromium en Vercel por cada
  video es caro. El navegador de la persona ya está dibujando el video: sólo hay que fotografiarlo.
- **El personaje:** `kit/toma.js` de la galería (Three.js 0.160 desde jsDelivr, como la galería), con la paleta y el
  peinado como datos. Sin datos es el Martín en cubos de siempre, igual al de la galería.

## El puerto de un formato de la galería a la app

1. Se copia `reels/<id>.html` a `public/avatar-cubos/<id>.html`, con el kit (`kit.js`, `kit.css`, `toma.js`).
2. Lo que estaba escrito a mano pasa a `window.DATOS`: el texto, las palabras en color y los momentos de cámara. Cada campo
   con su valor por defecto, que es el del original: sin datos, la página da el video de la galería.
3. Todo texto de la persona entra con `textContent` o escapado: el iframe es del mismo origen que la app.
4. El formato se anota en `lib/ai-avatar/cubos-formatos.ts` (id, nombre, esquema de sus datos, el texto para la IA).
5. Se prueba con la réplica: los mismos tiempos y la misma voz que la galería tienen que dar los mismos cuadros.

## Reglas de producto

- **Interruptor:** lo ve sólo la revisión de Martín (las mismas cuentas y el ws 3 que el onboarding V2,
  `lib/onboarding-v2/revision.ts`). Prenderlo para todos es UN cambio: `PARA_TODOS` en `lib/ai-avatar/cubos-interruptor.ts`.
  Se pregunta del lado del servidor (la pantalla y cada action).
- **Va dentro de AI Avatar** (que es de MaKo Pro: el candado de siempre): la tarjeta «Crear influencer», que hoy dice
  «no disponible todavía», abre el estudio del personaje en cubos para quien está en la revisión.
- **Pantalla:** copia el estudio «AI Influencer» de Higgsfield (`capturas-ai-avatar-2910/01-higgsfield-ai-influencer.jpg`
  en las notas del Cerebro): el constructor por partes a la izquierda (foto, formato, partes del personaje, voz, guion) y
  el botón de generar abajo con su costo; a la derecha, el video.
- **Sale con el deploy diario de las 11:05 UTC.** Nada de versiones de prueba en Vercel ni `desplegar-ya`.
- **Todo gasta MaKo Tokens** y la pantalla muestra cuánto antes de apretar. Nada dice «gratis» ni «ilimitado».
- **Textos:** español neutro con «tú», neutros en género y cortos.

## Cómo se prueba

- **Antes del deploy:**
  - La réplica (`node scripts/avatar-cubos/replica.mjs <formato> <carpeta>`): Chromium abre la plantilla de la app (servida
    como archivo estático, sin `next dev`) con los tiempos y la voz de la galería, arma el MP4 con el mismo código que usa la
    pantalla (`app/ai-avatar/cubos/mp4.ts`) y lo compara cuadro por cuadro con `C:/dev/artefactos-animaciones/mp4/<id>.mp4`.
    **19/11:** «Palabras gigantes» da 0,9 de diferencia media sobre 255 (el ruido de los dos codificadores) y «Subtítulos
    karaoke», 1,0; los dos con ≤ 0,01 % de píxeles distintos en los 10 cuadros comparados. La caja de vidrio del karaoke
    (`backdrop-filter`) sale igual aunque el personaje va en otra capa: detrás tiene la remera oscura.
  - La pantalla (`node scripts/avatar-cubos/vista.mjs <carpeta> [formato]`): esbuild empaqueta el componente de verdad con
    las server actions falsas (`scripts/avatar-cubos/acciones-falsas.ts`) y Chromium lo maneja como una persona hasta bajar el
    MP4, que también se compara con la galería. Deja capturas a 1440 y 375.
  - En la PC sólo corre el test tocado (`tests/ai-avatar-cubos.test.ts`).
- **Después del deploy:** en el ws 3 o el 9 (nunca el 1), con el navegador de la app o Claude en Chrome, se replica
  dentro de MaKo un video de la galería (mismo guion y mismo personaje) y se compara cuadro por cuadro. Se itera hasta
  que salga igual.

## Lo que queda para después

- Los formatos sin personaje (chat, contador, quiz) y los demás «Sobre tu toma» de la galería, a medida que se aprueben
  en la galería y en las series (`docs/series/`).
- Guardar el MP4 en la biblioteca y abrirlo en el Video Editor.
- El teléfono (hoy el MP4 se arma en la computadora; MaKo ya pide PC).
- **Una decisión de Martín:** la marca del video de un cliente. Hoy va el nombre de SU negocio (en el ejemplo, «MaKo» con la
  chispa); si los videos de los clientes llevan además una marca de agua de MaKo lo decide él.
- Las voces de MaKo son dos (David y Fernando, las que ya tiene la cuenta de la plataforma); una voz de mujer y más acentos
  se suman a esa cuenta.

(Las pausas largas de la voz ya se recortan a 0,3 s y el volumen va a -14 LUFS, en el navegador: `lib/ai-avatar/cubos-audio.ts`.)
