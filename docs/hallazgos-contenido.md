# Hallazgos — Contenido (las series de videos por código para las redes de Martín)

El código vive fuera del repo, en `C:/dev/artefactos-animaciones` (galería, kit, voz); los playbooks de cada serie, en
`docs/series/`. Lo del motor de la galería en sí (kit, render, trampas de Three.js) está en
[editor-video/animaciones-por-codigo.md](editor-video/animaciones-por-codigo.md) → «La galería de formatos».

## Serie 3 (ventas, «encontré una aplicación») — 19/11/2026

**El Martín en cubos dentro de una escena 3D propia.** El kit da `KIT.martin` con su propio renderer y su propia escena.
Para ponerlo en un cuarto con otros objetos: `const mk = KIT.martin(divOculto, {ancho:64, encuadre:'cuerpo'})`, esperar
`mk.listo` y `scene.add(mk.three.chico.root)`. `mk.pinta(T, K, {...})` sigue posando cara, boca y brazos (y dibuja su escena,
ya vacía, en un lienzo de 64 px: no cuesta nada). Requisito: el `importmap` de la página con la MISMA url de three que
`toma.js` (0.160.0 de jsDelivr), o hay dos THREE y el objeto no se dibuja.

**Contar las piezas del personaje: el modelo trae un celular escondido.** `armarChico` arma un celular en la mano derecha
dentro de un grupo apagado (`tel.visible = false`); sus mallas tienen `visible` en true. Un conteo por `mesh.visible` da una
pieza de más. Se cuenta mirando la visibilidad de toda la cadena de padres (`s3-estos-videos.html`, `NCUBOS`).

**Lo que se pone arriba del encuadre se ve en TODAS las tomas.** El monitor del código estaba detrás de Martín a la altura de
las tarjetas: asomaba su borde y su palo en cada escena siguiente y ensuciaba todo. La regla: lo que sólo aparece en un
momento va fuera de cuadro en el plano normal (el monitor quedó a y=9,3, por encima del techo de todos los planos) y la
cámara SUBE a mirarlo. Comprobarlo con el ángulo: `atan(dy/dz)` + la inclinación de la cámara > 15° (media FOV de 30°).

**El pelo del personaje se mete debajo de las tarjetas.** Con las tarjetas en la franja 150-700 px, el plano «medio» tiene que
dejar el pelo por debajo de ~720 px: cámara a 13,5 de distancia mirando a y=2,94 (cabeza a ~265 px/unidad). Un plano más cerca
sólo cuando arriba no hay tarjeta (el gancho, «hecho de cubos»).

**Una tarjeta que hay que LEER necesita palabras/3,2 + 0,5 s.** La idea tipeada en una frase (9 palabras) vivía 1,2 s: no se
leía. Se acortó a 6 palabras y la tarjeta siguiente entra recién con su palabra («guion»), no al empezar la escena.

**Patches de Python largos: a un archivo, no en un heredoc.** Un `python - <<'EOF'` con comillas simples y triples adentro
falló en el Bash del arnés («unexpected EOF while looking for matching `''»); el mismo script escrito a un `.py` y corrido
con `python -I archivo.py` anduvo. Los parches quedan en `C:/dev/serie-ventas/tools/arreglo*.py`.

**La fila del navegador es de toda la PC.** Un render de 696 cuadros (23,2 s) tardó ~8 min a ~0,7 s por cuadro; otra
sesión esperó detrás. El ritmo de las capturas (≈ 40 s por 18 cuadros) permite iterar rápido: el cuello es el MP4.

**Precios de otras apps: la página oficial, y sólo lo que se leyó.** Para el video del ticket se verificaron el 19/11 los
precios de la landing (`app/vsl/_sitio/reemplaza.ts`, `STACK_TIPICO`). CapCut Pro hoy es US$17,99 (la landing dice 19,99).
Trampas: Canva geolocaliza y desde esta PC sólo muestra pesos (ARS 8.500); ManyChat responde 403 con un control antibots
(no se evade); Gamma 403; Higgsfield arma el precio con JS; Mailchimp muestra el precio de promoción de 12 meses; Notion
dice «$10 per member/month» sin aclarar si es anual. Regla: un precio que no se leyó textual en su página no entra en un
video. La tabla, en `docs/series/serie-3-ventas.md`.

**Nombres de apps en la voz: se escriben como suenan y el transcriptor confirma.** «Go-jai-lével», «Skul», «Zápier»,
«Cap-cat»: el STT de ElevenLabs los devolvió como «GoHighLevel», «Skool», «Zapier», «CapCut». Si el chequeo los oye bien
escritos, la pronunciación está bien; las «diferencias» que marca son sólo la escritura fonética. En pantalla, un mapa
fonético → nombre en los subtítulos.

**Lo que se dice y lo que se ve, palabra por palabra en las listas.** En el ticket cada renglón se imprimía con el PRECIO y
la voz decía el nombre de la app ~2,5 s antes: durante ese tiempo el papel no cambiaba. Una línea «nombre … precio» se
imprime en dos tiempos: el nombre con su palabra y el precio con la suya.

**Un elemento vacío pero visible tapa lo de abajo.** El papel del ticket, sin renglones, medía su relleno (90 px) y estaba
por encima (z-index) de la etiqueta del precio: tapaba justo el «US$». Parecía un problema de la tipografía. Regla: lo que
todavía no entró va con `visibility:hidden`, no sólo con altura chica.

**Las pantallas de la app: sólo las dibujadas con datos de mentira.** `C:/dev/artefactos-pestanas/publicar/app-*.html` son
las pestañas reales dibujadas con sus componentes y el negocio de la maqueta (Nutri Vale). Se capturan nítidas (×2) con
`C:/dev/serie-ventas/tools/captura-app.mjs` y se recortan a la parte que se cuenta. Lo que no está dibujado (el explorador de
«Carruseles que funcionan» con sus outliers) no se muestra: producción tiene cuentas y personas reales. El guion se ajustó a
la pantalla que sí existe (las 8 estructuras de carrusel). Tampoco va la parte de la captura con fotos de personas reales
(las landings de referencia del Web Generator): se recorta arriba de ellas.

**La fila del navegador: un turno para varias cosas.** Con 6-7 trabajos de otros chats en la fila (renders de 30-60 s), cada
captura nueva esperaba 20-30 min. Un turno que ya está en la fila puede correr una tanda entera (`tools/tanda-capturas.sh`:
las capturas de la app y las de prueba de varios reels). Lo que no se hace: saltear la fila.

## Lo que quedó sin hacer

- La respuesta automática a CUBOS (qué se manda: la guía del método) no existe todavía. Está en
  `docs/series/serie-3-ventas.md` → «Palabras de CTA».
# Hallazgos — contenido orgánico (series de reels hechas por código)

Las series de reels con el Martín en cubos para que su cuenta gane seguidores de nicho: la fuente vive fuera del repo, en
`C:/dev/artefactos-animaciones/` (`reels/`, `voz/`, `mp4/`, `series/`); los playbooks, en `docs/series/`. Lo de la
galería de formatos (el motor, el kit, la voz) está en `docs/editor-video/animaciones-por-codigo.md`.

## Bajar y medir las referencias (19/11/2026, chat galeria-series)
- **yt-dlp no lista un perfil de Instagram** (`/<cuenta>/reels/` → «Unsupported URL»), pero **sí baja un reel suelto sin
  sesión** (`https://www.instagram.com/reel/<código>/`, con `--write-info-json` trae el texto del post, me gusta y
  comentarios; las vistas vienen vacías). Los códigos y las vistas se sacan del perfil abierto en el navegador de la app:
  se cierra el cartel de «Iniciar sesión» y la grilla muestra 12-16 reels con sus vistas en los `<a href*="/reel/">`.
  Pedirle la API interna del perfil al navegador lo frena el clasificador de permisos: no insistir por ahí.
- **Contar cortes con ffmpeg engaña en videos oscuros:** con `select='gt(scene,0.25)'` el reel de 116 s de
  @paralisisaldormir daba 10 cortes (11 s por plano) y a ojo eran ~25. Con umbral **0,08** y juntando los que caen a menos
  de 0,3 s, da lo real (4-6 s por plano en la Serie 1; 1,5-2 s en Zapater). Mirar SIEMPRE la hoja de contacto al lado.
- `python -I` ignora `PYTHONIOENCODING`: imprimir el texto de un post con emojis revienta en cp1252. Dentro del script:
  `sys.stdout.reconfigure(encoding='utf-8')`.
- Transcribir: `series/tools/transcribir.mjs <video> <salida>` (ElevenLabs scribe con marcas por palabra) deja el texto en
  renglones con su segundo y las palabras por segundo. Las referencias quedaron en `C:/dev/series-ref/` (videos,
  `trans/`, `hojas/`).

## La galería en otra cuenta de Claude (19/11/2026)
- **El artefacto de una cuenta no se abre desde otra.** Pasar la galería = publicar un artefacto NUEVO desde la misma
  fuente (`python -I tools/armar_galeria.py <scratchpad>/pub --todo`). El link vigente queda en el `LEEME.md` de la fuente.
- **El diagnóstico obvio («pesa 770 MB, hay que achicar los MP4») era el equivocado:** la galería nunca subió los MP4;
  muestra cada reel EN VIVO (HTML + voz MP3 + tiempos). Con todo, 39 MB en 436 archivos. El tope que muerde es el de
  ARCHIVOS: 255 por publicación → dos tandas (la página + 254, y después el resto con `url`). Por versión el tope es 511:
  quedan ~75 libres (cada formato suma 4-5).
- **Un archivo binario del artefacto no puede pasar de 15 MB** (16 MB uno de texto). El MP4 de la serie a crf 18 pesa
  36 MB y a crf 23, 18 MB: los dos rebotan. El que se baja desde la galería va a crf 27 (`mp4/para-ig/<id>.mp4`,
  ~12 MB por 60 s; en 3D plano no se nota); el de calidad completa queda en `mp4/<id>.mp4`.
- Bajar archivos desde la galería: capacidad `downloads` (`claude.use('downloads').save({filename, data})`, pide
  confirmación); si la vista no la tiene, el botón abre el archivo en otra pestaña.
- `armar_galeria.py` daba por publicados los 5 reels «anteriores» (morrow, cuatro…): en un artefacto nuevo faltaban.
  Ahora los sube siempre; `martin-caricatura.png` queda afuera a propósito (es el Martín ilustrado que Martín eliminó).

## Escribir y animar las series (19/11/2026)
- **La regla de Martín le gana a la referencia:** @paralisisaldormir pone los subtítulos ARRIBA; Martín los quiere bajo
  el mentón. Se resuelve por plano: cada plano define la altura de sus subtítulos según dónde quedó la cara; en el
  final con las tarjetas A/B (sin cara grande) van arriba.
- **El personaje mira a +z.** `giro: π` es «de frente» sólo si la cámara está del lado -z. En un plano con la cámara del
  lado +z quedaban todos de espaldas. Antes de posar, fijarse de qué lado está la cámara.
- El chequeo del guion (STT) devuelve «dos mil diecinueve» como «2019» y lo marca como diferencia: es falsa. En pantalla,
  el número va en cifras dentro de una caja (como en la referencia), armado desde las palabras.
- **La fila del navegador** (`tools/turno.mjs`) fue de 4-15 minutos por captura con 1-4 trabajos adelante (seis chats
  comparten la PC): se capturan 30-40 segundos de una vez y se mira la hoja, en vez de muchas vueltas chicas.

## Renderizar un reel 3D de 60 s (19/11/2026)
- **Un MP4 de 60 s en 3D no entra en un turno.** Medido: 2,4 s por cuadro capturando (escena con ~13 luces, 96 personas
  instanciadas y sombras), o sea ~45 min para 1.835 cuadros; y `turno.mjs` le saca el lock a quien lleva más de 40 min
  (el siguiente abriría un segundo navegador en una PC de 16 GB). `series/tools/render-gl.mjs` renderiza POR TRAMOS
  (`… 30 1/2` y `… 30 2/2`, cada uno su turno; el último arma el MP4).
- **Medido en el piloto de la Serie 1:** 1,3-1,5 s por cuadro con un solo seek → 22 + 20 min los dos tramos (sin contar
  la fila). Para retocar 2-3 planos después de mirar el MP4 NO se vuelve a renderizar todo: `render-gl.mjs … 30
  t:6.3-8.6,34-36.8` descomprime el MP4, pisa sólo esos segundos y lo vuelve a armar (~5 min).
- `tools/render-mp4.mjs` busca DOS veces cada segundo (para que un SVG pesado llegue a rasterizarse): en una página sólo
  WebGL eso es pintar la escena dos veces. `render-gl.mjs` busca una vez.
- **Una luz en intensidad 0 igual cuesta:** three.js la sigue calculando en cada píxel (y en SwiftShader eso es CPU). Las
  apagadas se sacan con `luz.visible = luz.intensity > .01` en cada cuadro.
- `capturar.mjs` arma la URL con `?cap&t=…`: no se le puede agregar otro parámetro (quedaría `?portada?cap`, `cap` no se
  lee y la página nunca avisa que está lista). Para la tapa del reel: `series/tools/portada.mjs` (`?cap&portada&t=`).
- `drawtext` de ffmpeg en Windows se cae (no hay fontconfig) y la «C:» de `fontfile` rompe el filtro: para mirar un MP4
  entero, `series/tools/mirar-mp4.sh` saca un cuadro cada 0,5 s y arma las hojas con `tools/hoja.py`.

## Lo que quedó sin hacer
- Ver `docs/series/serie-1-elige-a-o-b.md` y `docs/series/serie-4-reacciona-comentarios.md`, §5 «Por hacer».
