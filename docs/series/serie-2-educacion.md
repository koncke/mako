# Serie 2 — Educación: tutoriales con la voz de Martín

Contenido para las redes de Martín con su personaje en cubos y su voz clonada, hecho con el método de los videos por código
(HTML + GSAP/Three.js, `C:/dev/artefactos-animaciones`). Arrancó el 19/11/2026 (cuenta claude5, chat `serie-educacion`).
El ranking de temas, con cómo lo explica cada mentor, está en [serie-2-temas.md](serie-2-temas.md).

## Qué pidió Martín (textual, 19/11)

> «contenido de educación de todo tipo… que te enfoques muchísimo en la transcripción de todos los cursos que tenemos, que
> hagas un relevo por ahí y que detectes los top topics y temas que más se repiten, o los que incluso tú consideres a ojo…
> vas a ver cómo lo explican esos mentores, esos gurús. Y como tercer paso también vas a salir afuera a investigar… para ver
> cómo también lo plantearon y descargar el copy y la transcripción de esos otros videos. Y hacemos tutoriales con nuestro
> formato y dándoles nuestra voz… videos de oferta, de vender high ticket, las comparativas, los miedos, videos de anuncios,
> contenido viral versus contenido de nicho, carruseles, creación de contenido, trial reels, historias… es súper importante
> que vayas y hagas una búsqueda de esos temas… para ver si los otros referentes ya lo explican de una manera viral, el hook
> sobre todo».

## Las reglas de la serie

- **Objetivo: SEGUIDORES.** No se vende nada: ni MaKo, ni un curso, ni «comenta y te paso». El cierre invita a seguir la
  cuenta (y, si el tema da para dos partes, «la parte 2 sale mañana»). La chispa dorada de MaKo va chica, como firma.
- **Se toma la idea, nunca se calca.** De los cursos y de los videos de afuera sale QUÉ se enseña y qué gancho funcionó;
  el guion, el ejemplo y las palabras son nuestros. El ejemplo, siempre con un negocio high ticket (coach, mentoría,
  agencia, consultoría, inmobiliaria).
- **Números reales.** O son cuentas que se ven (4 × US$2.500 = US$10.000) o tienen su fuente (Hormozi, con su libro o su
  video). Nada de estadísticas inventadas.
- **Personaje:** Martín en cubos (`reels/kit/toma.js`, `KIT.martin`). Nunca el ilustrado redondo ni el plano de rulos.
- **Voz:** `bash tools/voz_formato.sh <id>` (eleven_v4, voz `I2d6BR9P2dAopVw1khNv`, `_para_texto_sin_video` de
  `C:/dev/reel-mentores/voz/LA-CONFIG.json`). Se escribe como suena: «Máko», «Ei-Ai». El chequeo del guion corre solo al
  final del script: una palabra de más o cambiada pide otra toma.
- **Edición:** la duración la dan las palabras (≈ 3,2 por segundo); sin silencios muertos (el script los recorta a 0,3 s);
  un efecto por momento; subtítulos bajo el mentón; cámara cerca de lo que pasa; nada que suene fuera del guion.
- **Idioma:** español neutro con «tú», neutro en género, frases cortas que se lean en el teléfono.

## El gancho: la regla de Martín (19/11/2026, para todas las series)

Martín, al ver el piloto de la serie 1: «no se entiende, sobre todo el hook… copiar los hooks de las estructuras… no
utilizar palabras técnicas… ser más simple». Antes de grabar, el gancho pasa estas cuatro preguntas:

1. **¿Copia la ESTRUCTURA de un gancho viral de afuera?** No la frase: la forma. Las que funcionaron
   (`docs/series/serie-2-afuera/`):
   - dos números que chocan sobre lo mismo: «gana un millón al año y tiene 5.800 seguidores»;
   - la frase del cliente en su boca: «Lo hablo con mi esposa» rindió 3,6 veces más que la explicación;
   - una escena en primera persona con un número absurdo: «un plomero me cobró 5.000 por 15 minutos»;
   - «dame un minuto y te borro el miedo a…».
2. **¿Se entiende en el primer segundo sin saber nada de marketing?** Si hace falta saber qué es un «funnel», un «CTA»
   o un «hook», no.
3. **¿Tiene alguna palabra técnica?** Se cambia por una de todos los días:
   - «gancho» → «la primera frase»;
   - «high ticket» → «vender caro» o el precio con número;
   - «cerrar» → «vender»;
   - «lead» → «alguien que te escribió».

   Lo que es nombre de una función de la app («reels de prueba») se deja, porque es como lo va a buscar.
4. **Los referentes, por el nombre corto que usa su público:** «Hormozi», no «Alex Hormozi». Si no es conocido (Dan
   Martell), no va en el gancho: el gancho es el número, y el nombre llega después.

El video 1 se rehízo por esta regla: el gancho era «Dan Martell subió el mismo video tres veces» y pasó a ser «El mismo
video tuvo treinta mil vistas… y casi cuatro millones». Además, «gancho» pasó a ser «primera frase», y el cierre «los
ganchos que más venden high ticket» pasó a ser «cinco primeras frases que funcionan».

## La plantilla de guion (≈ 110-160 palabras, 35-55 s; la voz habla a ~2,9 palabras por segundo)

| Tramo | Qué dice | Qué se ve |
|---|---|---|
| Gancho (0-3 s) | Lo contrario de lo que todos creen, o una promesa concreta con número. Una frase. | Martín en cubos grande + UNA imagen que lo pruebe. |
| Por qué importa (3-8 s) | El error que casi todos cometen y lo que les cuesta. | El error dibujado (tachado, en rojo). |
| El cuerpo (8-40 s) | El marco del mentor en 2-4 pasos, cada uno con el ejemplo de un negocio high ticket. | Una tarjeta o un plano por paso, atado a la palabra que lo nombra. |
| La vuelta (40-45 s) | La frase que resume todo, para guardar. | La frase sola, grande. |
| Cierre (últimos 2-3 s) | «Sígueme para más» o «la parte 2, mañana». | La chispa de MaKo, chica. |

## Proceso por video (y cuánto lleva)

1. Tema y gancho: del ranking + la investigación de afuera (`docs/series/serie-2-temas.md`).
2. Guion → `C:/dev/artefactos-animaciones/voz/guion-<id>.json` (escenas `[["s1","…"],…]`), contado en palabras.
3. Voz: `bash tools/voz_formato.sh <id>` → `reels/voz-<id>.mp3` + `reels/t-<id>.js` + el chequeo del guion.
4. Animación: `reels/<id>.html` sobre el kit (`reels/kit/kit.js`, `toma.js`), con el formato de la galería que mejor sirve.
5. Mirar: capturas por el turno (`node tools/turno.mjs node tools/capturar.mjs …`) y la hoja (`python -I tools/hoja.py`).
6. MP4: `node tools/turno.mjs node tools/render-mp4.mjs reels/<id>.html mp4/<id>.mp4 <dur> reels/voz-<id>.mp3 30`.
7. Ficha `reels/fichas/<id>.json` y aviso a «Galería y series 1 y 4», que la publica en la sección de la serie 2.

## Videos

### 1. «El mismo video, tres veces» (`edu-mismo-video`) — temas 1 y 10 (el gancho y los trial reels)

- **Qué enseña:** el arranque decide; abre con algo que te pasó y un número, no con un consejo; y cómo probarlo sin
  quemar la cuenta: los reels de prueba, cambiando la primera frase y el texto.
- **Gancho (versión 2, por la regla de arriba):** «El mismo video tuvo treinta mil vistas… y casi cuatro millones.» Son
  dos números que chocan, se entiende sin saber de marketing, y el nombre (Dan Martell) llega en la tercera frase.
- **Los datos, verificados con yt-dlp el 19/11/2026 a la 01:15 (hora de Uruguay):**

| Video | Cómo arranca | Vistas | Subido |
|---|---|---|---|
| Dan Martell, «Never charge for your time»: https://www.youtube.com/watch?v=ZO0jOH-VKH0 | la regla («Never charge for your time») | 30.565 | 14/05/2025 |
| Dan Martell, «Never Charge For Your Time»: https://www.youtube.com/watch?v=jyR5-787ckc | ejemplo genérico («when you hire a plumber…») | 35.131 | 03/04/2024 |
| Dan Martell, «Never charge for your time»: https://www.youtube.com/watch?v=g13FnSgICA8 | recuerdo propio («I remember one time I hired a plumber…»: 15 minutos, US$5.000) | 3.974.284 | 01/09/2024 |
| Alex Hormozi, «Why Hooks Are So Important»: https://www.youtube.com/watch?v=V-loNBSqdWY | cuenta que rehicieron sólo los primeros 5 s de un video: de 4.000 a 850.000 vistas | (el dato lo da él, 0-15 s) | 02/09/2025 |

  - Las vistas cambian con el tiempo: el guion dice «treinta mil», «treinta y cinco mil» y «casi cuatro millones», y la
    pantalla muestra el número exacto con la fecha («vistas al 19/11/2026»).
  - Los tres de Martell son del mismo canal, pero de fechas distintas (abril y septiembre de 2024, mayo de 2025). Orientan;
    no son un experimento controlado. El guion no dice «experimento».
  - El ×130 de la pantalla es la cuenta 3.974.284 ÷ 30.565; el ×212 es 850.000 ÷ 4.000 (Hormozi lo redondea a «200x»).
  - El tope de 5 reels de prueba por día lo dice Hormozi en su workshop (curso 100m-money-models,
    [1JLx-787IC7sl26D-96RBpOHtaPG1KEzN], carácter ~215.093). No es oficial y fue bajando (25 → 20 → 5); el guion dice
    «hasta cinco por día».
  - El filtro de duplicados: si se cambia SÓLO el gancho, Instagram puede marcar la copia como duplicada (Modern Millie,
    ijGh9LtBJ7U, 16:24). Por eso el guion dice «con otra primera frase y otro texto».
- **Guion:** `C:/dev/artefactos-animaciones/voz/guion-edu-mismo-video.json`. Versión 2: 155 palabras y 55,0 s (la 1, con el gancho viejo, quedó en `guion-edu-mismo-video.v1.json`). «Hormozi» se
  escribe «Jormozi» para la voz.
- **Formato:** pizarrón con cámara propia (los tres videos → la cámara entra a cada uno → los tres juntos con el ×130),
  la línea de tiempo con la tijera para Hormozi, «así no / así sí» para el coach, el celular con el interruptor
  «Reel de prueba» y las cinco versiones con una que gana. Martín en cubos abajo, como quien explica; los subtítulos,
  bajo el mentón.

## Investigación de afuera (los 10 primeros temas)

Por tema, en `docs/series/serie-2-afuera/<tema>.md`: los virales que lo enseñan, con el gancho literal, la estructura
por segundos, el copy, por qué funcionó, el patrón entre ellos, lo que los cursos dicen y los virales no, tres ganchos
nuestros y los números con su fuente. Hecho sólo en YouTube (base de 27.700 Shorts de 47 creadores con sus vistas); TikTok
e Instagram quedan pendientes.

## Decisiones

- 19/11: la serie no lleva CTA de venta ni «comenta PALABRA» (eso es de la serie 3); cierra invitando a seguir.
