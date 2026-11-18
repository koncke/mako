# Videos animados por código hechos por Claude (investigación del 17/11/2026)

Martín, el 17/11, textual: «cómo hacer este tipo de animaciones que no consumen IA porque son hechas por Claude, son
prácticamente HTML… una vez aprendido, ya luego pasarlo como proceso para dentro de Video Generator y Editor… por ahora nos va
a ayudar para resolver sobre todo el tema de los tutoriales del reto de 7 días. Y también me va a ayudar a mí para la marca
personal y vender MaKo».

Lo hizo la corrida `wf_90a71bff-e00`, con 5 agentes: uno vio las 7 referencias, otro investigó en la web, otro revisó el repo,
otro armó el plan y un refutador abrió las fuentes. Lo que el refutador corrigió ya está aplicado acá. Las hojas de contacto y
las transcripciones quedaron en el scratchpad de esa sesión, que es temporal.

## Qué son

Son motion graphics: texto, pantallas, tarjetas, números y diagramas que se mueven. Claude no los genera con IA de video:
escribe CÓDIGO, casi siempre una página HTML o React. Un navegador sin ventana fotografía cada cuadro y ffmpeg los pega con la
voz en un MP4. La IA sólo escribe el guion y el código. Por eso sale exacto, se repite igual cuantas veces haga falta y no
gasta créditos de video.

## Las referencias de Martín

| # | Quién | Qué es | Cómo está hecho |
|---|---|---|---|
| 1 | Ale Ferr (YouTube, 25/10, ~129K vistas) | Cómo clonar shorts de mapas de 61M de vistas | Le da a Claude Code una plantilla: un ZIP con instaladores de Node y Python, probablemente Remotion (supuesto). Un panel web local elige formato, idea, mapa y música. Claude escribe ~160 palabras, la voz va con ElevenLabs v4 y el render es local, en 2-3 min. **Sus instaladores (curl\|bash, ZIP de Drive) no se ejecutaron.** |
| 2 | Ale Ferr (YouTube, 08/11) | Shorts de curiosidades con personajes 2D | La misma mecánica. Su propio video es el que mejor muestra los motion graphics: celulares en 3D, contador de vistas, «PASO 2 DE 5». |
| 3 | @morrow.studio3d | Shorts 3D, «hechos con Claude Code» | 3D por código en JavaScript: en pantalla aparece «SCENE.JS · WRITTEN BY CLAUDE», probablemente Three.js (supuesto). Render en una MacBook de 16 GB: 3.312 cuadros en ~18 min. **No es Blender.** |
| 4 | @adilet.fndr | Reels con su herramienta propia | Node (`reel.mjs`) con ffmpeg. Titular cinético, maquetas de interfaz, cursor con pulso y su caricatura en una esquina. Pide comentar «SKILL»: 31,6K comentarios contra 27,8K likes. |
| 5 | @mrcreates.ai | «AI video editor» dentro de Claude Code | Remotion + HyperFrames + FFmpeg + Whisper, sobre material FILMADO: corta los silencios. Vende un curso de US$497. |
| 6 y 7 | @sanji.chien | Collage estilo Vox y un hotel isométrico | **Higgsfield MCP + Seedance: IA PAGA y patrocinada.** De él sirve sólo la estética. |

**Lo que se repite:**
- **El flujo, sobre todo en las refs 1, 2 y 4:** una carpeta con un skill, la idea en una línea, el guion, la voz, Claude anima, revisa sus propios cuadros y
  renderiza en la computadora, y deja todo en una carpeta de salida. Las correcciones se piden en palabras, «como a un editor».
- **El gancho, de 0 a 3 s, con prueba social:** contadores de vistas o tarjetas con miniaturas.
- **El progreso siempre a la vista,** «PASO N DE M».
- **El cierre «comenta PALABRA».**
- **El formato y el ritmo:** 9:16; el texto cambia cada 2 a 2,6 s; sin silencios.
- **El tutorial está hecho con la misma herramienta que enseña.**

## Estilos, y para qué sirve cada uno

| Estilo | Sirve para | Dificultad |
|---|---|---|
| Titular que sigue a la voz, con la palabra dicha resaltada | Reto, marca personal y clientes | Baja: el motor ya tiene `palabras` en beats.mjs |
| Golpe de una frase sobre fondo azul | Reto y marca personal | Baja: ya existe |
| La pantalla REAL de la app, con un recuadro y la cámara que se acerca, más un cursor | Reto y demos | Media: una captura y un recuadro por pantalla |
| Checklist que se tilda | Reto y clientes | Baja |
| Indicador de progreso («Día 1 de 7») | Reto y clientes | Baja |
| Diagrama o flujo que se arma (el ojo que lleva al dinero) | Reto (V4) y marca personal | Media: pasar `flow` de vsl-julio a engine.js |
| Números grandes que suben y gráficos | Marca personal y clientes, SÓLO con datos reales | Baja: lib/motion ya tiene «cifra» y «barras» |
| Chats y notificaciones («agendó», «nueva venta») | Marca personal | Baja |
| Caso de negocio visual: el CRM real de MaKo con datos ficticios, cada lead cambiando de etapa | Marca personal y venta de MaKo | Media-alta |
| Celulares y tarjetas en 3D con CSS | Ganchos de la marca personal | Media |
| Cara a cámara con gráficos (`side`) | Reto (V3 y V4) y marca personal | Media: pasar `side` a engine.js |
| Collage estilo Vox, diálogo de personajes, mapas o código que se tipea | Más adelante, o nunca | Media-alta |

## Herramientas y licencias (verificadas el 17/11)

- **El motor propio** (`scripts/tutorial-animado/`, en el repo):
  - **Lo que tiene a favor:** funciona HOY en esta PC con Windows, no pide licencia y rinde 418 cuadros en 34 s.
  - **Lo que le falta:** 9:16 (hoy es sólo 1920×1080), `side` y `flow`, más íconos (hoy hay 2) y una captura por pantalla (hoy hay una fija).
  - **Lo que depende de afuera del repo:** `chequear-guion.mjs` (vive en reel-mentores), el Chromium de playwright-medidor, LA-CONFIG y bancos-portada. Es el mismo riesgo que hizo perder el VSL de julio.
- **Remotion (React):**
  - **⛔ Martín decidió el 11/11** aplicarlo al 100 % en la tab Video, con plantillas, render en Lambda con la cuenta de AWS de CADA cliente (BYOK) y 21 transiciones (memoria remotion-licencia-gratis; `docs/editor-video/relevamiento-remotion.md`).
  - **Licencia:** gratis con 3 personas o menos. Desde la 4.ª, Automators: US$0,01 por render, con un mínimo de US$100 por mes, y se avisa ANTES.
  - **Lo que la licencia permite y prohíbe:** permite plantillas con datos y generar código con IA. Prohíbe que el usuario suba su propio código.
  - **Trampas:** el render en el navegador manda telemetría. Si la animación no sale de `useCurrentFrame()`, el render sale mal. El kit «Prompt to Motion Graphics SaaS» pide OpenAI: con Claude hay que adaptarlo.
- **HyperFrames (HeyGen), que pasa HTML a video:**
  - **Gratis y Apache-2.0:** el CLI, el render local y ~450 bloques.
  - **Pagas:** las skills `/reverse-any-video` y `/style-sampling` son de **HyperFrames Pro** (US$25 por mes, con cuenta de HeyGen).
  - **⚠️ La captura exacta cuadro por cuadro sólo anda en Linux.** En Windows y Mac usa heurísticas, «not how you want to run production».
  - **⚠️ Sus bloques cargan GSAP.** La licencia de GSAP prohíbe usarlo en herramientas visuales sin código que compitan con Webflow: para el editor de clientes NO sirve tal cual.
  - **Telemetría:** viene prendida. Se apaga con `HYPERFRAMES_NO_TELEMETRY` o `DO_NOT_TRACK`.
- **Claude Motion (Anthropic, oficial desde el 08/10/2026):**
  - es animación por código hecha por Claude y exporta MP4;
  - está en beta sólo para los planes Team y Enterprise;
  - pasar a Team lo decide Martín;
  - no sirve para los clientes de MaKo.
- **Descartados:**
  - Motion Canvas: no renderiza sin ventana.
  - Revideo: riesgo de abandono.
  - Theatre.js: repo privado y AGPL.
  - Manim: es para matemática.
  - Shotstack y Creatomate: ~US$0,30 por minuto.
  - Lottie: sirve sólo para íconos.
  - Higgsfield y Seedance: son IA paga.

## El proceso (con lo que ya hay)

1. Una línea por pantalla, en palabras, que Martín aprueba.
2. El guion exacto: «Máko» con tilde, los números en letras y 3,2 palabras por segundo.
3. La voz: el clon v4 o la graba Martín. ⚠️ Está pendiente: el 9/11 dijo del clon «No es mi voz».
4. `chequear-guion.mjs`.
5. La alineación de ElevenLabs. Whisper no sirve: corre el inicio de las palabras hasta 0,6 s.
6. Las pantallas en beats.mjs, que son la columna «Muestra» del guion.
7. Las capturas de la app real o de sus componentes, con datos ficticios.
8. Animar, con un efecto por momento.
9. Cuadros sueltos.
10. Render.
11. Una hoja de contacto MIRADA y un artefacto para Martín.
12. Las correcciones por número de pantalla.
13. Todo lo que se reusa va al repo el mismo día.

## Para el reto de 7 días

- **V1 (la bienvenida):** Martín a cámara, sin animación.
- **V3 (Offer Coach) y V4 (Funnel Coach):** se animan. La columna «Muestra» ya está escrita. Empieza V4, que es más corto.
- **V2 y V5 a V15:** queda pendiente si van con la cara chica de Martín y la app real marcada en vivo, o animados. Un MP4 también se puede pausar por tiempos.
- **Lo que hay que sumarle al motor:**
  - `side` y `flow`;
  - 6 íconos;
  - una captura por pantalla;
  - la palabra dicha resaltada;
  - un cursor con anillo;
  - 9:16, si se ve en el celular.

## Para MaKo (Video Editor, no Generator)

- **Arquitectura A, «plantilla + datos»:** Claude escribe sólo los datos de cada pantalla y los dibujan plantillas `graphic` / `lib/motion`, sin GSAP. Es barata, sale igual siempre y cumple las licencias.
  Parte de la decisión de Remotion del 11/11.
- **Arquitectura B, código generado en el momento:** después, y quizás sólo en Pro. Gasta mucho más.
- **El cierre «comenta PALABRA»:** MaKo ya responde comentarios de Instagram (`lib/api-mako/areas/chatbot.def.ts:628`), y falta probarlo en producción.
- **Los costos:** los de tokens y render son supuestos. Se miden con el uso real antes de ponerlos en la vitrina (memoria todo-gasta-mako-tokens).

## El primer paso propuesto

Un A/B del tutorial del Second Brain de 13,7 s, con la misma voz y el mismo guion: el motor propio contra HyperFrames.
- **Dónde:** en un chat en la NUBE (Linux, donde la captura es exacta), no en la PC (memoria delegar-a-la-nube).
- **Permiso:** instalar HyperFrames es una descarga y necesita el OK de Martín.
- **Qué se mide:** los minutos de trabajo, el % de cuota, el tiempo de render, los cuadros rotos y el veredicto de Martín lado a lado.

## Riesgos

- **La estética de las referencias choca con las reglas de Martín:** la app real y no un dibujo, «de cerca y simple», «efectos con moderación». Hay que adaptarla, no calcarla.
- **Datos:** nada de cifras inventadas, ni miniaturas o música de otros.
- **Sesgo de las fuentes:** los creadores venden su kit, y la comparación HyperFrames contra Remotion la publicó HeyGen.

## La galería de formatos (18/11/2026): lo que se aprendió haciendo 86 formatos

**Qué quedó.** La galería https://claude.ai/artifact/CXe1Ana7MvnJ44gzaXc7hF (cuenta claude2) tiene, con la voz de Martín y su
MP4 1080×1920 cada uno, las réplicas de los 54 formatos del paquete de un competidor (mdmukeem__001, Instagram, #07-#60) y 32
formatos de la investigación de afuera (`investigacion/formatos-por-codigo.md`: HyperFrames, Remotion, YouTube). Martín los
marca con ★ Elegir: quedan en la base del artefacto, colección `elegidos` (se leen con ArtifactData). La fuente vive en
`C:/dev/artefactos-animaciones/` (no es un repo; ver su `LEEME.md`), los MP4 en `mp4/<id>.mp4`.

**Lo que se reusa (todo en esa carpeta):**
- `reels/kit/kit.js` + `kit.css`: **todo sale de T** (`cuadro(T, K)` pinta el segundo desde cero), la voz manda el reloj,
  `?cap&t=N` congela, `K.pal(escena, palabra)` ata cada cosa a la palabra que la nombra, subtítulos punch/karaoke que no dejan
  palabras débiles ni números colgando y no separan «high ticket».
- `reels/kit/toma.js`: **Martín en cubos** (el voxel makeBoy de morrow) como `KIT.martin` / `KIT.toma` (cuarto con bokeh).
- `tools/voz_formato.sh <id>`: TTS (clon v4 de LA-CONFIG) → alineación → pausas ≤ 0,3 s → **-14 LUFS** → `t-<id>.js` → chequeo.
- `tools/turno.mjs`: el navegador, de a UNO y por orden de llegada en toda la PC. `capturar.mjs` + `hoja.py` para mirar;
  `render-mp4.mjs` para el MP4; `mirar-chico.mjs` para verlo como en el celular; `verificar-numeros-carrera.mjs` de ejemplo
  para comprobar números cuadro por cuadro.
- El brief para constructores (`investigacion/competencia/BRIEF-constructores.md`): 5 agentes en paralelo, 3 formatos por
  vuelta; el orquestador aprobaba cada uno mirando cuadros sacados del MP4 con ffmpeg (`reels/fichas/aprobados.txt`).

**Decisiones de Martín (18/11):** su personaje es SIEMPRE el Martín en cubos (memoria `personaje-martin-en-cubos`); nada que
recree un juego o una marca conocidos (pixel-quest se rehízo: tubos, bloques «?» y SCORE remitían a un juego famoso). «Offer
Coach» se sigue nombrando: si se separa del Funnel Coach está abierto, y no se rehacen formatos por eso.

### Trampas (síntoma → causa → regla)
- **Partículas «no se lee nada»: el diagnóstico obvio (brillo, bloom) era el equivocado.** A resolución completa se leía bien.
  `gl_PointSize` va en píxeles del buffer y la página baja su resolución interna cuando corre chica (galería en el celular,
  `pixelRatio` 0,3-0,8): cada punto quedaba 3× más grande que las letras. Multiplicar por `renderer.getPixelRatio()`. Las
  capturas con `?cap` corren a resolución 1 y lo escondían: mirar también con `mirar-chico.mjs`.
- **Parches en el MP4 (parecían mosaicos viejos o falta de memoria):** `render-mp4.mjs` sacaba la foto sin esperar a que se
  rasterizara un SVG pesado bajo una cámara que cambia de escala. Ahora busca, espera 2 cuadros y vuelve a buscar. Además:
  lo estático, pintado una vez en un canvas; nada de filtros sobre lo que se mueve.
- **Estilos que sólo fallan en el MP4:** el kit le ponía la clase `cap` al body en modo captura, y cualquier `.cap{}` de un
  formato se aplicaba a toda la página (todo en mayúsculas sólo en el video). Ahora es `kit-cap`. Diagnóstico: el estilo
  calculado en el navegador.
- **`K.p(T, t0, d, 'back')` daba 2e-16 antes de t0** y un `> 0` se disparaba temprano (el disco del quiz salía blanco; parecía
  el degradé). Ahora devuelve 0 y 1 exactos en los bordes.
- **Cuentas en pantalla: cada cuadro tiene que dar.** Tres formas de romperlo: un contador que sube dentro de una igualdad
  («4 × US$3.000 = US$7.500» a mitad de camino); un título que cuenta mientras la píldora ya dice el número final; una carrera
  con el mes entero y montos continuos («MES 5» con 22.600 en vez de 20.000). Regla: en una igualdad el resultado entra
  entero en la palabra que lo dice y queda ≥ 2 s; contador suelto sí puede subir; y **verificar con un script** que lea la
  página cuadro por cuadro (encuentra en un minuto lo que una hoja de contacto no muestra).
- **Lentitud de render (el obvio era «el voxel en SwiftShader»):** cinco `drop-shadow` CSS encadenados sobre el canvas
  WebGL, 1,8 s/cuadro; un solo filtro SVG, 0,8 s. `feTurbulence` a pantalla completa por cuadro: 212 s contra 47; grano
  pintado una vez.
- **Un comentario `//` pegado a mitad de una línea se come lo que sigue** (tres veces: un frasco sin banda, etiquetas
  apiladas, una cámara sin actualizar). `node --check` sólo atrapa la sintaxis, no un objeto que nunca entra a la escena.
- **Mirar lo viejo creyendo que es lo nuevo:** la hoja de contacto vive fuera de `cap/<id>/` y sobrevive al borrado;
  `capturar.mjs` nombraba `t03.52` y `t017.8` y la hoja salía desordenada (arreglado). Un MP4 en `mp4/` no es un formato
  terminado, y un informe de agente puede decir algo que no se hizo: verificar en el archivo antes de darlo por hecho.
- **La fila del navegador fue el costo dominante:** con 5-11 trabajos, cada captura o render esperó 10-30 min. Encadenar
  captura y render en un solo comando en segundo plano; el turno ahora es FIFO.
- **`voz_formato.sh` pisa en el acto la voz y los tiempos que usa la página.** Ante un pedido que puede cambiar, esperar o
  copiar; si se pierde, se recupera del audio del MP4 (alinear → tiempos → apretar → normalizar), sin TTS.
- **Legibilidad:** una captura de la app a escala real en un 9:16 deja el texto en ~25-30 px; agrandarla ≥ 1,35× con la
  cámara recorriéndola (medir el alto de la letra, no el font-size). Con zoom > 1,2× y el teléfono a todo el ancho se cortan
  los renglones en el borde: teléfono al ~85 %.
- **Fuentes:** Press Start 2P no tiene Í ni É; IBM Plex Mono no tiene ✓ ↑ ↓ (la tabla ASCII se corre); un `overflow:hidden`
  que esconde texto recorta las tildes de las mayúsculas. `toLocaleString('es')` no agrupa 4 cifras («3000»).
- **Guiones:** la voz va a ~2,5 palabras/s más 1,4 s de cola: ≤ 42 palabras corridas, ≤ 36 en listas. El chequeo (STT)
  marca de más con cifras («1930») y con «síes». Los guiones de la investigación prometían cosas que no sabemos si MaKo hace
  («agenda por ti»): sólo lo confirmado.
- **Three.js:** `alphaMap` lee el canal verde; las etiquetas proyectadas van un cuadro atrás sin `updateMatrixWorld()`;
  `transmission` sólo refracta la escena 3D (el fondo va como `scene.background`); para pintar por capas cada luz necesita
  `layers.enableAll()`; el Martín del kit se lleva a otra escena si las dos cargan three.js de la misma URL.

### Lo que quedó sin hacer
- De la investigación no se hicieron, por decisión: el Wrapped personalizado (se parece al «Resumen del año» que Martín sacó),
  el cierre con estrellas de tienda de apps (obliga a inventar reseñas) y la pared de reels inclinada (como la de Lanzamiento).
- La cita de `quote-cinema` la escribimos nosotros y sale firmada por Martín: espera su OK.
- `recorte-vox` dice «Funnel Coach» (se hizo en el ida y vuelta del coach); `adilet` (anterior) dice «Offer Coach».
- Los MP4 anteriores al 18/11 (morrow, cuatro, aleferr, adilet) quedaron a -19 LUFS; los nuevos, a -14.
- `C:/dev/reel-mentores/voz/chequear-guion.mjs` debería pasar cifras a palabras antes de comparar.
- Las trampas sueltas y completas, por constructor: `C:/dev/artefactos-animaciones/investigacion/trampas-constructores.md`.
