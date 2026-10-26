# Hallazgos — Motion graphics (lib/motion)

El motor de motion graphics de MaKo: el Video Editor los dibuja en el lienzo y el Web Generator los publica en la
landing. Nació el 26/10/2026 del pedido de Martín: «implementa esto de punta a punta:
https://github.com/iart-ai/motion-skills que se puedan hacer motions graphics en la web y en el editor».
Acá va lo que no se deduce del código: síntoma, causa, dónde vive y la regla que queda.

---

## Qué es motion-skills, y por qué no se copió su código

**Vive en:** `lib/motion/LICENSE-IART` · las recetas, en los comentarios de `lib/motion/*.ts`

- **El repo que pasó Martín es un ÍNDICE.** `iart-ai/motion-skills` trae un README, un showcase y tres scripts de
  verificación. Lo útil está en 19 packs aparte (`iart-ai/<pack>`). Se leyeron los 8 que sirven para marketing:
  kinetic-typography, motion-design, web-animation, lower-thirds, ad-video, data-animation, javascript-animation y el
  índice. Los 8 tienen la MISMA licencia MIT (Copyright (c) 2026 iart.ai): se puede usar en un SaaS con el aviso, que
  viaja en `lib/motion/LICENSE-IART`.
- **Una «skill» no es una librería: es saber escrito para un agente de código** (SKILL.md + referencias). Le enseña a
  Claude Code a escribir un HTML con GSAP o un proyecto de Remotion y a revisarlo mirando capturas. A MaKo le sirven los
  NÚMEROS y las RECETAS (tiempos, curvas, áreas seguras, el orden de cada plantilla). El código de ejemplo no.
- ⚠️ **Sus comprobaciones dan por hecho un modelo que VE imágenes** (sus README dicen que se probaron con Claude Opus).
  La IA de un negocio en MaKo es barata y no mira capturas. Por eso las comprobaciones son números y viven en
  `tests/motion.test.ts`: área segura, primer y último cuadro vacíos, contraste de un botón, un grupo que entra en
  ≤ 800 ms, un número que no rebota, lo que late y para.

## El diseño obvio era el equivocado, dos veces

**Vive en:** `lib/motion/escena.ts` (la coreografía) · `canvas.ts` (el lienzo) · `html.ts` + `css.ts` (la landing)

1. **«La landing con CSS o GSAP, y una captura para el video»**. Es lo que proponen los packs para la web, y no es exacto
   por cuadro: el reloj de la librería no es el del export, así que el video y la landing se separan. GSAP además
   quedó fuera por licencia (ver `lib/editor-landing/animaciones.ts`).
2. **«Una sola función `frame(spec, t)` y un adaptador de DOM con requestAnimationFrame en la landing»**. Era la
   recomendación del resumen de los packs, y en una landing PUBLICADA no se puede: la política de contenido
   (`lib/editor-landing/pagina-publica.ts`) no deja correr un script nuestro sin su hash ni poner un `<style>` propio.
   Encima, sin JavaScript (un crawler) el bloque quedaría vacío.

**Lo que quedó:** UNA coreografía y dos dibujantes. `armarEscena` arma las capas y, para cada pedazo, qué efecto hace,
cuándo arranca (`t0 + i·paso`), cuánto dura y con qué curva cubic-bezier. El lienzo lo evalúa en cualquier t
(`estadoPedazo`). La landing lo escribe como `@keyframes` FIJOS de `CSS_MOTION`, y cada pedazo lleva en su `style` sólo
variables (`--mo-e`, `--mo-d`, `--mo-dur`, `--mo-ease`). El HTML sin animar ES el estado final.
- **La regla:** si se agrega un efecto, se agregan sus dos lados: `entrada`/`salida` en `evaluar.ts` y su @keyframes en
  `css.ts`. El test cruza pedazo por pedazo que el HTML lleve el mismo t0, duración y curva que el lienzo, y que el
  cuadro 0 de cada @keyframes sea el estado del lienzo con avance 0.
- **El ancho del texto se ESTIMA con una tabla por carácter** (`anchoEm`), no se mide. Así el servidor, el lienzo y el CSS
  parten las líneas igual. El lienzo mide de verdad y, si una línea se pasó de su caja, la aprieta. Nunca la corta.

## Lo que mordió y no da error

- **`document.fonts.check()` contesta `true` antes de que llegue la hoja de Google.** Mientras no hay ninguna `@font-face`
  de esa familia no hay nada «pendiente». Se lleva la cuenta propia de las familias cargadas (`lib/motion/fuentes.ts`).
- **Pedirle a Google Fonts un peso que la familia no tiene devuelve 400 y no carga NINGUNO.** El lienzo dibuja con la
  del sistema, en silencio. Cada familia declara sus pesos reales (`FUENTES_MOTION`) y se pide el más cercano
  (`pesoDisponible`).
- **El Video Editor no redibujaba un motion graphic: el compositor compara la textura por IDENTIDAD y versión.** Ver
  docs/hallazgos-video-editor.md, «El compositor es UNO». El nodo reusa su lienzo en cada cuadro, porque uno nuevo de
  1920 × 1080 por cuadro es basura para el recolector. Por eso sube `versionFuente` cada vez que redibuja
  (`services/renderer/nodes/graphic-node.ts`).
- **El tamaño de la fuente de un `graphic` se pregunta en CUATRO lugares**: el nodo, el descriptor del cuadro,
  `resolve.ts` y los bordes de la selección (`preview/element-bounds.ts`). Si uno dice 512 y otro el tamaño del lienzo,
  la caja de selección no coincide con lo que se ve. Los cuatro preguntan `tamanoFuenteGrafico`.
- **El odómetro mostraba «0000» en el cuadro 0.** Un clip tiene que empezar vacío. El dígito aparece mientras gira
  (`rodar` lleva opacidad).
- **La salida escalonada se pasaba del final del clip.** Con siete palabras y 15 ms de paso, la última terminaba de irse
  90 ms después del último cuadro. La salida arranca antes, para que el ÚLTIMO pedazo termine a tiempo.
- **Lo que escribe la persona no se recorta ni se rechaza por largo** (Martín: nunca cortar un texto por caracteres).
  `normalizarMotion(…, { estricto: false })` deja pasar hasta un tope duro y el motor achica la letra. Lo que escribe la
  IA o llega por la API va ESTRICTO: un texto más largo que su campo se rechaza con motivo, no se corta.

## Las reglas de los packs que quedaron en el código (con su número)

| Regla | Valor | Fuente |
|---|---|---|
| Entrada premium | easeOutExpo `cubic-bezier(0.16, 1, 0.3, 1)` | kinetic-typography |
| Máscara de un titular | `translateY(110 %)`, no 100 % (el descendente asoma) | kinetic-typography |
| Escalonado | líneas 60-120 ms, palabras 40-70, letras 20-40; el grupo entero ≤ ~800 ms | kinetic-typography |
| Tono | premium · corporativo · enérgico · juguetón deciden tiempos y curvas; los serios no rebotan | motion-art-direction |
| Área segura | 6 % horizontal; vertical 14 % arriba y 22 % abajo (Reels y TikTok); 7-8 % cuadrado | shot-composition, ad-video |
| Tercio inferior | espera 0,2 s vacío; sale palabras → panel → barra; el último cuadro vacío | lower-thirds |
| Un número | no rebota; rueda con cubicOut | data-animation |
| Lo que late | 3 veces y para (WCAG 2.2.2: nada se mueve solo más de 5 s) | accessible-animation |
| Menos movimiento | el estado final, quieto | accessible-animation |

## Lo que quedó SIN hacer (y dónde iría)

- **La marquesina (ticker) y los pasos con íconos** (`marquee_ticker` y `steps_infographic` del resumen). La marquesina
  pide un botón de pausa en la landing (WCAG 2.2.2). Irían en `lib/motion/plantillas.ts` + `escena.ts`.
- **El logo dibujado (draw-on de un SVG del cliente).** No hay dónde subir el SVG del logo todavía. La plantilla `logo`
  arma la marca con la inicial.
- **Exportar un motion graphic SOLO, con transparencia** (WebM con alfa para OBS o Premiere). H.264 no tiene alfa; en el
  Video Editor el motion se aplana dentro del video, y eso anda.
- **Motion en el Image Editor** (animar un diseño y exportarlo en video): fuera de este pedido.

## CSS no interpola `clip-path` de `inset(…)` a «nada» (26/10/2026, medido en el banco)

En el banco (lienzo y HTML lado a lado en el mismo t), las estrellas del testimonio y el panel del tercio inferior
aparecían DE GOLPE en la landing y se barrían en el lienzo. El estado natural no tenía `clip-path` escrito, y CSS no
interpola de `inset(0 100% 0 0)` a `none`: salta a la mitad del tiempo. Todo pedazo que entra o sale con `barrido` lleva su
recorte natural escrito aunque sea 0 (`recorteBase`, `lib/motion/html.ts`), y tests/motion.test.ts lo exige. ⚠️ Este
último test se escribió con la guardia de RAM cerrada y NO se corrió (docs/relevo/motion-imagen.md).

## Y un bug sin arreglar

En la plantilla `cifra`, `numero` tiene paso 1: 4,5 se redondea a 5 aunque `decimales` deje hasta 2
(`lib/motion/plantillas.ts`). El paso tiene que ser 0,01 o salir de `decimales`.
