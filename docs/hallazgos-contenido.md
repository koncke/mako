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
las capturas de la app y las de prueba de varios reels). Lo que no se hace: saltear la fila. ⚠️ Encadenar trabajo DENTRO
de un script que ya espera en la fila (se lee recién cuando le toca) funciona, pero si la tanda nueva vuelve a llamar a ese
mismo script, la tanda corre dos veces y la segunda pisa las hojas de contacto con menos cuadros. Mejor: un solo script de
tanda, sin ganchos escondidos en otro.

**Una hoja de contacto corta puede ser un error de la página, no de la captura.** La hoja de LANDING salió con 7 cuadros
de 18 y ningún mensaje: el giro de la página reescribía un `innerHTML` y se llevaba un elemento que el cuadro siguiente
buscaba por id (`null.style` → `__seek` tira error → `capturar.mjs` corta y la tanda sigue con el reel siguiente). Regla:
contar los cuadros de cada hoja contra los pedidos, y nunca borrar con `innerHTML` algo que otro cuadro busca: mostrar u
ocultar.

**Las pestañas dibujadas arrancan en modo claro.** `app-*.html` elige el tema con `#tema=oscuro` en la dirección (lo usa
`mirar.cjs`); sin eso la captura sale clara y no combina con las piezas oscuras del reel.

**Una tarjeta arriba en el plano del gancho tapa la cara.** Con la cámara cerca (el gancho), la cara de Martín queda entre
y≈500 y 1000: cualquier tarjeta en la franja 150-700 la tapa. Si el video abre con una tarjeta arriba, arranca ya en el plano
medio; el plano cerca sólo cuando arriba no hay nada (el visor de CUBOS).

**El diagnóstico obvio del ticket era el equivocado: no era el diseño del papel, era quién ocupa la pantalla.** El primer
ticket tenía a Martín en cubos grande en el centro y el ticket arriba, chico; la referencia tiene lo que se cuenta (los
bloques de precios) en el centro y el personaje chico. Martín: «el ticket tiene que ser mucho más protagonista… no
necesariamente siempre tiene que salir el muñequito». Regla: antes de diseñar, mirar en la referencia QUÉ ocupa la
pantalla, cuánto tiempo y dónde está el foco, y copiar eso. Con el personaje chico y abajo, los subtítulos van arriba.

**Las apps del ticket tienen que ser de una misma familia.** Mezclar GoHighLevel, Skool, Zapier y CapCut en un ticket no
tenía sentido para Martín («no mezcles tanto»). Cada ticket, una familia (vender, contenido, cursos) y termina en lo que
hace MaKo de esa familia. Y Skool con Kajabi no van juntas: son alternativas, nadie paga las dos.

**Cortar un trabajo propio que tiene el navegador: por PID y con su árbol.** `turno.mjs` lanza bash → node → Chromium; si
se mata sólo el `turno`, el render sigue corriendo huérfano y pisa al siguiente de la fila. `taskkill /PID <turno> /T /F`
corta todo lo que cuelga de él (y sólo eso). Después, borrar su carpeta `mp4/_cuadros_*`.

**Una lluvia que arranca en T=0 deja el primer cuadro vacío.** El gancho del ticket nuevo eran suscripciones que caen; con
demoras de 0 a 1,6 s el cuadro 0,2 s quedaba casi negro. La mitad de los papelitos arranca con demora negativa (ya
están a mitad de camino). Y una capa con `z-index` alto por elemento tapa los subtítulos si no tiene su propio apilado:
`z-index` en el contenedor.

**Antes de arreglar un cuadro raro, mirar a qué palabra va.** En la hoja del ticket de contenido el renglón rojo salía
«VEN» y en el de cursos «MaKo Pro» no estaba marcado: parecían errores y no lo eran. La captura caía 0,06 s después de que
el renglón empezaba a imprimirse, y la otra 0,3 s antes de «Máko» (23,72 s en `t-s3-ticket-cursos.js`). Regla: buscar el
tiempo de la palabra en `reels/t-<id>.js` y compararlo con el del cuadro; si cae en el medio de la animación, no hay nada
que arreglar.

**Un comentario agregado con `sed` en una línea con dos instrucciones apaga la segunda.** Para anotar por qué el ticket de
MaKo bajó a `top:1070px`, el `// …` quedó en el medio de la línea y comentó `$('mk').style.opacity = …`: el ticket de MaKo
no iba a aparecer nunca, sin ningún error. Se vio de casualidad en el `grep` de control. Regla: el comentario va al FINAL de
la línea entera (con un script que reemplaza la línea completa), y después se busca la línea para leerla.

**El tamaño de la letra se calcula por el ancho, no por la cantidad de letras.** El generador de tickets achicaba la
palabra del CTA desde 8 letras: ALUMNOS (7, con M y W anchas) se salía a 230 px y TICKET (6) entraba. El encabezado «SÓLO
PARA HACER CONTENIDO» (25 caracteres) no entraba a 60 px en monoespaciada: cada carácter mide 0,6 de la letra más el
espaciado, y el papel deja 928 px. Al armar una variante desde otro HTML, medir el texto más largo de cada variante.

## Lo que quedó sin hacer (serie 3)

- La respuesta automática a cada palabra (CUBOS, TICKET, ALUMNOS, CONTENIDO, COPIAR, GRUPO, …) no está en producción. Los
  textos están en `docs/series/serie-3-ventas.md` → «El mensaje que le llega a quien comenta»; el Cerebro se los lleva a
  Martín.
- Ticket de cursos con Kajabi: no se hizo (Skool o Kajabi, nunca las dos; se eligió Skool). OpusClip quedó afuera del de
  contenido: MaKo no corta un video largo en clips. Canva no se usó: su página muestra el precio sólo en pesos.

## Carruseles de ventas (réplicas de outliers, «encontré una app») — 19/11/2026

El proceso entero, en [series/carruseles-ventas.md](series/carruseles-ventas.md). Acá, lo que no se deduce del código.

**Las referencias ya están bajadas: la biblioteca de outliers de MaKo.** `carruseles_biblioteca_piezas` (1.590 carruseles de 456
cuentas el 19/11) guarda las láminas en el Storage (`laminas_imagenes`) y la palabra del CTA (`cta`, `cta_via='comentario'`: 247
con láminas). Se lee en sólo lectura y se ordena por veces la mediana de su cuenta; no hace falta Instagram, Apify ni navegador.
El `curl` de `instagram.com/p/<código>/embed/captioned/` NO trae las láminas (0 `display_url`: las arma el JavaScript), y un `/p/`
puede ser un reel: `DffeOMPgNyA`, la «referencia del mismo estilo» de la serie 3, es un video de 42 s.

**La frase de la referencia se verifica contra MaKo, no la función.** «They work 24/7» (el equipo de bots, `DcnHxFDgv2y`) es falso
para el setter con IA: sin horario de oficina contesta SOLO de 9 a 21 hora del negocio (`HORARIO_RESPUESTA_SOLA`,
lib/setter-conversacion.ts), hasta 3 veces por día (`TOPE_RESPUESTAS_SOLAS_24H`), y lo que habla de plata queda en borrador
(`HABLA_DE_PLATA`). Lo mismo con un gurú: la app dice «Inspirado en» y responde «con el método de», no «como lo haría». Y el chat
adjunta imágenes y PDF (`ACCEPT_ADJUNTOS_CHAT`), no `.docx`, aunque el catálogo hable de «un .docx» para el Second Brain.

**Una respuesta de la app para mostrar: no había ninguna conversación con un gurú en producción** (`chart_chats` con
`…referente-…`: 0 filas en todos los workspaces el 19/11). Se corrió el contexto real (`contextoDeReferente` +
`CONTEXTO_SECOND_BRAIN`) con el negocio de mentira; sin el resto del system del turno (`VOZ_APP`, `REGLA_NO_EXISTE`) la respuesta
nombró el curso del referente, que Martín no quiere que se nombre. Para una pieza pública, el texto de la respuesta se revisa
contra las reglas del system entero, o se genera desde la app (ws 3).

**Escribir o editar un `.html` con Write/Edit lo abre el navegador de la app** (un hook), que gasta RAM y no deja hacer nada en
un `file://` («This tab shows a local file»). Con la PC en 0,5-1 GB libres, las páginas se generan con un script de Python
(`C:/dev/carruseles-ventas/tools/escribir-*.py`) y se miran por el turno con Playwright. Cerrar la pestaña que abrió.

**Dibujar un componente real tarda lo que tarda compilar su grafo, y con la RAM llena es mucho.** El panel de chat
(`PanelDeChat` + `HiloMako` + `CajaChat`) tardó 17 min la primera vez con < 1 GB libre y 30 s la segunda (caché de tsx). Se
corre en segundo plano apenas está el guion, no al final.

**La fila del navegador: encolar TODAS las capturas apenas cada HTML existe.** Con 5 carruseles y renders de 60 s de otros
chats adelante, cada vuelta esperaba 30-40 min. Encolarlas juntas (piezas, personaje en cubos, criaturas, láminas de cada
carrusel) hace que salgan seguidas; la que necesita lo que hace otra va detrás en la fila.

## Serie 2 (educación: temas de los cursos e investigación de afuera) — 19/11/2026

Los temas salen de la biblioteca de cursos (`app/conocimientos/curso-*.ts` + `public/cono-tx/*.json`); el ranking y el
playbook, en `docs/series/serie-2-temas.md` y `docs/series/serie-2-educacion.md`. Lo de la biblioteca como dato del
portal (cursos duplicados, transcripciones que «faltan») está también en [hallazgos-conocimiento.md](hallazgos-conocimiento.md).

### Lo que más muerde acá

1. **El mismo video, distinto arranque, da 100 veces más (19/11/2026, serie 2).** Las resubidas del MISMO guion en un
   mismo canal son un A/B natural, y lo dicen fuerte:
   - Dan Martell, «Never charge for your time», tres veces: arrancando con la regla, 30.565 vistas (ZO0jOH-VKH0);
     con un ejemplo genérico, 35.131 (jyR5-787ckc); como recuerdo propio («una vez contraté a un plomero…»), 3.974.284
     (g13FnSgICA8).
   - Hormozi, el clip de «lo hablo con mi esposa», reeditado para abrir con la frase del cliente: de 413.547 a 1.480.002.
   - Hormozi cuenta que su equipo rehízo sólo los primeros 5 s de un video y pasó de 4.000 a 850.000 vistas (V-loNBSqdWY).
   - Jordi Segués tradujo palabra por palabra el guion de Martell que tiene 12,8 M de vistas, y sacó 25,7 mil.

   **Regla:** se invierte en el arranque, no en el cuerpo. Abre con una escena en primera persona con un número, nunca con
   la regla. Y calcar el guion de un viral no calca el resultado. Medido con yt-dlp el 19/11; orienta, no prueba, porque
   la fecha y el público cambian.

2. **El diagnóstico obvio era el equivocado: «los cursos no hablan de carruseles ni de trial reels».** Los siete lectores
   buscaron por TÍTULO de clase y no los encontraron. Estaban en las clases de PREGUNTAS:
   - los trial reels, en `tumadreanna` y `masteryhaus`, donde se dicen «reel de prueba»;
   - los carruseles, en los cursos de OFERTA (Cubria, Sofía Contreras) y en las sesiones de preguntas de BlueHacker, no en
     los de marca personal.

   Los encontró un crítico que buscó en TODOS los cursos con `buscar.mjs '<regex>' todos`. **Regla:** un tema que «no
   está» se busca por texto en toda la biblioteca antes de darlo por ausente.

3. **Los conteos por palabra clave orientan y mienten** (`scratchpad/s2/temas.mjs`, contó 60 temas en 29 millones de
   palabras en 77 s):
   - «presión» cuenta «expresión» (305 falsos en instituto-de-comunicacion);
   - todos los títulos de tumadreanna dicen «Viral con TUMADRE»;
   - la «oferta» de midas-concept es la de oferta y demanda (es trading);
   - la marca de agua del revendedor («este curso fue adquirido en…») va metida en las transcripciones de growth-partner;
   - la regex de precio casi no pega, aunque hay clases ENTERAS de precio («11. PRINCING» de ATV, «Precios» de
     masteryhaus): el precio se busca por el título de la clase.

   **Regla:** el conteo elige qué leer; el ranking se arma con lo leído.

4. **Mismo mentor, varios cursos: si se cuenta por curso, se cuenta doble.**
   - Victor Heras: master-marca-personal 4.0 y 5.0, casi las mismas clases; el 4.0 trae cada una duplicada.
   - Agustín Nievas: los tres Growing comparten clases.
   - Juan ADS = Juan Osorio: m5-95, metolodogia-jads y academia-estratega, que copia a m5-95 con otros videoId.
   - Andy Landa: stories-master y manychat-master.

   **Regla:** la «fuerza» de un tema se mide en mentores distintos, no en cursos.

5. **Cifras de mentores que no se usan como dato** (lista completa en `docs/series/serie-2-temas.md` → «Datos que NO se
   usan»):
   - Adrià Solà Pastor inventa cifras y fuentes en sus ejemplos y lo dice («me lo acabo de inventar»).
   - Cuentas mal hechas: Mati Molina dice 7 % y es 0,75 %; el 6 % de la alumna de Contreras es 3,3 % sobre inscriptos.
   - Urgencia simulada: el «contador evergreen» de Convierte Más, los cupos falsos de ATV (que Carrizo condena en el mismo
     curso) y las «plazas limitadas» de un webinar grabado.
   - Brian Tracy, «el 80 % se cierra después del quinto intento»: sin estudio que lo respalde.
   - Los umbrales del algoritmo (Verdú, Alborna) son reglas de ellos, no datos oficiales.

   **Regla:** toda cuenta de un mentor se rehace con un script antes de ir a un guion.

6. **Un fragmento de búsqueda atribuye mal.** Un tramo de `buscar.mjs` hacía parecer que Sergio Beguería publica un
   carrusel y al día siguiente el reel del mismo tema; era el plan de un alumno. Un lector le dio trial reels a Puigrredón
   y Llados, que no hablan de eso. **Regla:** se lee el tramo entero antes de citar, y un crítico relee las citas.

7. **Investigación de afuera en YouTube: lo que funciona y lo que no.**
   - Sirve listar `https://www.youtube.com/@canal/shorts` con `--flat-playlist`: unos 6 s por cada 300 Shorts, con las
     vistas. Así se armó una base de 27.700 Shorts de 47 creadores (`scratchpad/s2/afuera/shorts.tsv` + `filtrar.mjs`).
   - `ytsearch` no sirve: no trae las vistas de los Shorts y ordena por relevancia (salen dibujitos con mil millones de
     vistas). Sí sirve la URL de búsqueda con el filtro «menos de 4 minutos»: `&sp=EgIYAQ%253D%253D`.
   - Los títulos de canales en español vuelven TRADUCIDOS al inglés: se busca con regex en los dos idiomas.
   - Algunos subtítulos «es-orig» son la pista doblada, no la voz original.
   - Vistas pagadas: 81 mil vistas con 11 «me gusta». Se mira la proporción de «me gusta» antes de llamar viral a algo
     (en orgánicos de ventas, 2-7 %).
   - Google (WebSearch) no indexa TikTok: TikTok e Instagram se miran en el navegador.

8. **yt-dlp se rompió en toda la PC por otro chat (19/11, unos 15 minutos).** Otro chat corrió
   `pip install --force-reinstall yt-dlp`, y pip no puede bajar nada en esta PC (falla con un error de ctypes; curl sí
   anda). El paquete quedó a medio instalar (`site-packages/~t_dlp`) y todos los chats recibían
   `No module named yt_dlp`.
   - **La salida:** bajar el .whl con curl desde la API de PyPI, descomprimirlo en una carpeta propia y correr
     `python -m yt_dlp` con `PYTHONPATH`.
   - **Regla:** una herramienta compartida no se reinstala mientras otros chats la usan; si hace falta, se instala con
     `pip install --target <carpeta propia>`.
   - **Además:** para sacar cuadros, `-f "worst[height>=360]/worst"` ya no anda, porque YouTube no da audio y video
     juntos sin el runtime de JS. Usar `--js-runtimes node -f "134/bv*[height<=480]"`.

9. **La voz: los nombres se escriben como se dicen, y el chequeo lo confirma.** Con «Hormozi» en el guion, eleven_v4
   leyó la H muda y el chequeo oyó «Ormosi». Escrito «Jormozi», el chequeo oye «Hormozi». En pantalla se muestra el
   nombre real reescribiendo la palabra en `TIEMPOS.words` antes de cargar el kit (`reels/edu-mismo-video.html`).
   - **Trampa del script:** `tools/voz_formato.sh` reintenta el chequeo 3 veces, con 20 s de espera, cada vez que hay
     una diferencia, aunque sea esperable (el nombre escrito como suena). Son 60 s y tres transcripciones de más por toma.

10. **La RAM manda el plan.** La guardia (`~/.claude/guardia/memoria.mjs`) pide 3 GB libres para un Workflow. Con seis chats
    de series abiertos, la PC estuvo entre 0,9 y 2,3 GB, y se perdieron 14 minutos esperando.
    - **Lo que funcionó:** agentes sueltos (piden 1 GB al arrancar), de a dos o tres.
    - **El navegador y los renders** van por la cola de `tools/turno.mjs`. El 19/11 a la 1:30 había nueve trabajos en
      fila: la captura de un video puede esperar más de 10 minutos.
    - **Regla:** con menos de 3 GB se va directo a agentes sueltos. Y las capturas se piden temprano, mientras se hace
      otra cosa.

11. **«THE NET LAB está vacío» era falso, por segunda vez.** El crítico del 19/11 concluyó que
    programa-meta-ads-the-net-lab tiene «sus 89 transcripciones vacías», porque en `public/cono-tx` salen con 0 palabras.
    Las transcripciones existen en `C:/cursos/programa-meta-ads-the-net-lab/transcripciones/` (97 archivos, formato
    `{modelo, texto}`), y eso ya estaba escrito en [hallazgos-conocimiento.md](hallazgos-conocimiento.md) desde el
    11/11. **Regla:** antes de dar por vacío un curso, se mira `C:/cursos/<slug>/`.

12. **«Nada de relleno»: lo que parecía una animación prolija se leyó como un boceto (video 1, 19/11).** Las tarjetas
    tenían rayitas grises «de texto» que se llenaban recién cuando la voz llegaba a cada una, y el título «TRES VECES»
    entraba y salía en menos de un segundo. En la hoja de contacto se veía «en movimiento»; el Cerebro, mirando el
    video, vio tarjetas vacías y un título cortado. Lo mismo pasaba en el video 2 con «vistas» sin su número y fichas
    con la mitad de abajo vacía hasta que llegaba el ejemplo.
    - **Regla:** cada elemento muestra contenido real desde su primer cuadro. Para marcar el momento en que la voz lo
      dice, un golpe de escala o de color. Si una tarjeta espera su contenido, crece cuando el contenido llega
      (`reels/edu-cinco-frases.html`, las `.crece` de cada ficha), no antes. Un texto que no se alcanza a leer entero, se saca.

12b. **La letra chica escondida: lo que se escala, se achica.** En el video 1 cada frase tenía 58 px en la tarjeta, pero la
    cámara alejaba el «mundo» a ×0,46 para mostrar las tres: en pantalla quedaba en 27 px. Las cinco versiones A-E, en
    tarjetitas de 196 px de ancho, tenían la frase en 27 px. Martín: «nada de letra chica en ningún lugar». Mirando la
    hoja de contacto no se nota, porque ahí todo es chico.
    - **Regla:** piso de 44 px en pantalla (cuadro de 1080) contando la escala del contenedor. Para mostrar varias
      cosas juntas, una tabla sin escalar o filas a ancho completo, no tarjetas alejadas.
    - **Trampa del arreglo:** subir la letra a 44 px desarmó el celular del video 1 (520 px de ancho): el interruptor
      quedó afuera del borde y «siguen» se cortó abajo. Se vio recién en el MP4. Después de agrandar letras, se mira cada
      contenedor de ancho fijo; el celular pasó a 680 px.

12c. **La misma voz no habla igual de rápido en cada guion.** Con el mismo clon y el mismo ajuste, el video 3 salió a
    3,18 palabras por segundo y el video 4 a 2,72 (el gancho, a 2,6). `voz_formato.sh` recorta pausas pero no acelera.
    **Arreglo:** `ffmpeg -filter:a atempo=1.10` sobre `reels/voz-<id>.mp3` (estira sin cambiar el tono) y dividir por
    1,10 los tiempos de `reels/t-<id>.js` (anchors, incluido «end», y words); después, `chequear-guion.mjs` otra vez.
    **Regla:** mirar las palabras por segundo que imprime el chequeo; debajo de ~2,9, acelerar.

12d. **Un pull fallido no frena el push… ni avisa.** `git pull --rebase` falló con «cannot lock ref
    'refs/remotes/origin/main'» (otro chat hacía fetch en el mismo clon); el push no salió, y la tarea de fondo terminó con
    código 0 porque lo daba el último comando de la cadena (`git log`). **Regla:** confirmar con `git ls-remote origin punta/<rama>`, no con el código de salida.

12e. **Después de un reinicio por falta de RAM, el servidor de 8765 queda caído y la cola no lo dice.** La app se reinició
    (19/11, 11:20) y el `python -m http.server 8765` que comparten todos los chats murió con ella. El render siguiente
    esperó su turno y falló al instante con `net::ERR_CONNECTION_REFUSED`. Un render que había muerto a mitad dejó un MP4
    de 1 MB que parecía un archivo. **Regla:** después de un reinicio, `curl localhost:8765/galeria.html` (tiene que dar
    200) antes de encolar nada, y un render cuenta como hecho por el «LISTO» del log, no porque exista el .mp4. El script
    `render-con-ram.sh` de la serie 2 espera el servidor y 3 GB libres antes de pedir turno.

13. **Renumerar escenas dejó segundos vacíos que la sintaxis no ve.** Al agregar una escena al principio del guion
    (s1 nueva), las referencias `A.sN` se corrieron con reemplazos de texto desde el panel de Hormozi para abajo. La
    salida del panel 1 estaba más arriba y quedó atada a la escena vieja: el pizarrón se iba 7 s antes y los segundos
    19-24 (el momento de los cuatro millones) salieron vacíos. **Regla:** después de renumerar escenas, capturar al
    menos un cuadro por escena.

14. **Voseo que `chequear-guion.mjs` no marca.** Con el clon rioplatense, «dejas» salió «dejás». El chequeo compara sin
    tildes y lo da por bueno. Son riesgosos los verbos de «tú» que en voseo cambian sólo el acento (dejas, completes,
    arranques, quédate); los que cambian la raíz (pierdes, sigues, eres) no. **Regla:** leer la transcripción buscando
    esas tildes y, si una sale aguda, cambiar el verbo.

15. **El mismo nombre escrito igual no suena igual en cada toma.** «Jormozi» salió «Hormozi» en el video 1 y «George
    Mozi» en el video 2; «Jormosi» anduvo. No hay una escritura que sirva siempre: si el chequeo oye otro nombre, se
    prueba otra escritura u otra toma. Acelerar con `atempo` también lo cambia: en el video 8, a ×1,10 el chequeo oyó
    «Jord Mozi» las dos veces y a ×1,06 «Jormosi»; el chequeo se corre sobre el MP3 ya acelerado, y si falla se baja el
    factor antes de regenerar la voz.

16. **«docs/branding-mako.md quedó viejo» no era el motivo del push bloqueado.** Un worktree nuevo no tiene
    `node_modules`; el hook de la punta no encontró `tsx` (`ERR_MODULE_NOT_FOUND`, más arriba en la salida) y el
    mensaje final culpaba al doc. **Arreglo:** `cmd /c mklink /J <worktree>\node_modules <clon principal>\node_modules`
    al crear el worktree (una unión, no una copia). Con eso el filtro pasó en verde en 87 s.

17. **Dos chats crearon el mismo doc de hallazgos.** La serie 3 creó `hallazgos-contenido.md` primero, y el rebase dejó
    dos títulos «# Hallazgos — Contenido». **Regla:** antes de crear un doc de hallazgos, mirar `origin/main`; si ya
    existe, se entra como sección.

18. **Lo que sólo ve el MP4 a 1 cuadro por segundo: el panel que entra vacío y el fundido encimado.** Las capturas se
    piden en las palabras clave, así que nunca caen en el hueco entre que un panel entra y su primer elemento aparece
    (en el video 5: 1,9 s de pizarra vacía) ni en los 0,3 s de un fundido donde un texto entra antes de que el otro se
    vaya. **Regla al escribir la animación:** cada panel muestra algo a más tardar 0,3 s después de entrar (si la frase
    importante llega tarde, arriba van las palabras que la voz está diciendo); y en un cambio en el mismo lugar, lo
    viejo termina de irse antes de que entre lo nuevo (`sale = P(T, t - .35, .25)`, `entra = P(T, t - .1, .3)`). Las dos
    cosas se leen en el código antes de capturar: así se encontró el mismo fundido en los videos 4 y 6, antes de
    gastar un render de 32 minutos en cada uno.

### Lo que quedó sin hacer (serie 2)

- Renders de `edu-viral-nicho` (video 4), `edu-verguenza` (6), `edu-cobrar-mas` (7) y `edu-anuncio-prueba` (8): HTML, voz y ficha listos en
  `C:/dev/artefactos-animaciones`; van de a uno, por `turno.mjs` y con 3 GB libres (Martín usa la PC). El 5
  (`edu-dar-menos`) se renderizó el 19/11 a las 20:43.

- THE NET LAB (Meta Ads 2026: «Andrómeda», «Diversidad creativa», estructura de cuenta 2026): no se leyó, y es lo más
  fuerte para el tema 7 (el creativo de los anuncios).

- TikTok e Instagram de los 10 primeros temas: se buscaron sólo en YouTube. En historias y carruseles el método vive
  en Instagram (lo que hay de @growithalex está en `C:/dev/carrusel-mako/growithalex/`).
- Clases que prometen y no se leyeron:
  - «Por qué no necesitas un perfil de cliente ideal» de Felipe Vergara [1NZdrIAfhP0JKjWxA5ZqCM2j2oo9mKC4X];
  - los «18 triggers mentales» de Turu [1pxsrtji3P0zeIu11F8x-1X3lLR-H0WQB];
  - las llamadas reales de Growing Closer, con casos de «tengo que pensarlo» y de socio o pareja.
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

- **Un comentario `//` agregado con un reemplazo de texto se comió la línea siguiente** (la trampa ya estaba en
  `docs/editor-video/animaciones-por-codigo.md` y volvió a pasar): al insertar `// hijo del cuarto…` con Python, el
  reemplazo no llevaba el salto de línea y `ram.pose(…)` quedó comentado: Ramiro aparecía de pie y nadie lo notó en la
  primera hoja. Regla: un comentario se inserta con su `\n`; después de reemplazos en masa, `grep` de líneas con `//` y
  código detrás.
  Volvió a pasar el mismo día con otro reemplazo (`// afuera hasta el golpe…` se comió `guar.pose(…)`): el chequeo de
  sintaxis (`node --check`) no lo ve. Un scan que busca `objeto.metodo(…);` después de `//` en la misma línea sí.
- **Y un comentario de CSS sin cerrar se come todos los estilos que siguen:** al agrandar los subtítulos agregué
  `/* … era 64 px` sin el `*/` dentro del CSS de `s1-comun.js`; los subtítulos (la regla anterior al comentario) salieron
  bien y todo lo demás (tarjetas A/B, etiquetas) quedó sin estilo: la miniatura a 360 px y el texto suelto. Después de
  tocar un bloque de CSS, contar `/*` contra `*/`.
- **Un personaje que espera detrás de una puerta cerrada la atraviesa con los brazos** (la pose «cruzados» saca las manos
  ~0,6 adelante): en la parte 2B se veían dos manos flotando delante de la puerta un segundo antes del golpe. Que espere a
  más de un metro y entre recién cuando la puerta se abre.
- **El encuadre vertical es angosto: dos cosas a 8 m no entran.** Con fov 50 a 16 m se ven ~8 m de ancho. Para que
  Martín y la salida entren en el mismo plano hubo que acercar la salida a la tarima; y un plano que pasa al lado de
  personajes sentados queda tapado por la cabeza del primero (Ramiro, el que contesta mensajes): subir la cámara por
  encima de las cabezas.
- **Cámaras fuera de la habitación:** en el cuarto de la parte 2B, dos planos quedaron detrás de la pared de adelante
  (z > 6,4) y se veía la pared o la puerta. Antes de capturar, comparar cada `o.pos` con las paredes del set.

## El piloto de la Serie 4, hecho por un agente constructor (19/11/2026)
Lo completo está en `C:/dev/artefactos-animaciones/investigacion/trampas-constructores.md` («Serie 4»). Lo que vale para
cualquier reel 3D con el Martín en cubos:
- **Medir sin navegador (lo que más tiempo ahorra con la fila llena).** La escena 3D en un módulo sin DOM
  (`reels/serie4/comentarios-1.js` exporta `armar()`), three@0.160 en node y `kit.js` evaluado con stubs de `window`/
  `document`: se recorre el reel a 15 cps en 2 s y se mide dónde cae cada cara contra subtítulos y tarjetas, y si manos y
  objetos quedan adentro del cuadro. Encontró cinco problemas antes de la primera captura (que esperó 68 min en la fila).
  Plantilla: `series/tools/nodethree/` (`chequeo.mjs` cara vs. subtítulos/tarjetas, `props.mjs` manos y objetos,
  `pose.mjs` buscador de ángulos; `npm install` adentro trae three). **Proyectar los vértices**, no las 8 esquinas de
  `Box3.setFromObject`: la caja sale ~30 % inflada.
- **Poses a ojo: el diagnóstico obvio («el ángulo está mal») era el equivocado.** El rig rota los hombros en orden ZXY:
  el giro z se aplica al final, alrededor del brazo cuando ya apunta adelante, así que su signo cambia según la mano esté
  arriba o abajo del hombro (y la perspectiva agranda 15-20 % lo que está cerca). Regla: buscar los ángulos por
  cuadrícula contra un punto del mundo (`persona()` en node + `getWorldPosition` de la mano). Un barrido horizontal del
  brazo no sale en ZXY: después de `pose()`, slerp del cuaternión del hombro hacia un Euler `'YZX'` y, al empezar cada
  cuadro, volver a `rotation.order = 'ZXY'`.
- **Pupilas grises en un primer plano:** no era el párpado ni la luz; con contrapicado y la cabeza mirando arriba, los ojos
  (roughness 0,2) reflejan el RoomEnvironment en ángulo rasante. Con este rig, sin contrapicado en los cerrados.
- Un objeto que se achica hasta 0,1 desaparece **dentro** de la mano (que mide 0,23): el tamaño final ≥ la mano y apoyado
  encima. Lo que lleva texto va delante de todo (la cinta de la caja tapaba la «R» de CURSO). Piezas finas (una vincha)
  con segmentos que se solapan, no cubitos sueltos.
- **Subtítulo que pisa la tarjeta 2 cuadros:** `K.trozos` arranca cada trozo 0,06 s antes de su palabra; cuando las escenas
  alternan tarjeta y subtítulo, `t0 = Math.max(t0, K.ini(escena))`.
- Pixelado barato y con los subtítulos nítidos: `drawImage` del canvas WebGL a un canvas de 90×160 con
  `image-rendering: pixelated`.
- **Un agente que termina su turno esperando un trabajo de fondo puede no despertarse:** perdió 43 min. Esperar con un
  Monitor que se re-arma al vencer (la fila llegó a tardar 68 min, más que los 30 de un Monitor) o encadenar todo en un
  solo comando de fondo. El brief del constructor (`series/BRIEF-serie4.md`) ya sirve para la parte 2.

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

**«Ver ejemplo» de algunas estructuras de carrusel monta el título sobre el texto (19/11, sin confirmar en la app).** Dibujando
los ejemplos de `lib/carruseles/tipos.ts` con el mismo código que «Ver ejemplo» (`documentoDeCarrusel` → `PaginaCarrusel`, con las
fuentes del catálogo del editor cargadas), 6 de las 54 láminas de los 8 ejemplos tienen el título de varias líneas
encima del texto de abajo: la portada de «Mito vs. realidad», la 4 de «Antes y después», la 5 de «Paso a paso» y la 1, la 3 y la 5
de «Opinión» (la que peor está: «Comprar en preventa no es para todos» tapa su bajada). El alto de cada
caja sale de una estimación (`altoEstimado` / `tamanoQueLlena`, lib/carruseles/documento.ts), no de medir la fuente: con Archivo
Black y Space Grotesk la estimación se queda corta. Falta mirarlo en Image con la pantalla real antes de tocarlo.

**Las filas tildadas de «Extraer de un grupo de WhatsApp» se ven gris oscuro en el tema claro.** El fondo es `var(--primary-weak)`
(app/crm/TraerDeGrupoWA.tsx), y en el claro vale `#a3a39e`: una tabla de 11 tildados queda casi toda gris medio. Se mostró así en el
carrusel GRUPO porque es la pantalla real.

## Cuando la app se reinicia por falta de RAM (19/11/2026)
- **El agente de fondo se muere sin informe, pero su trabajo queda en disco.** El que rehacía «El avión» había terminado
  las 6 correcciones (página, voz nueva, ficha, capturas en `cap/avion-r2`); sólo se perdió el informe. Antes de rehacer
  nada: mirar las horas de los archivos y la última hoja de capturas.
- **El servidor `python -m http.server 8765` también se muere** (lo había levantado un chat): `turno.mjs` no lo revisa y
  el render o la captura se cuelgan esperando una página que no carga. Antes de renderizar: `curl -s -o /dev/null -w
  "%{http_code}" http://localhost:8765/reels/kit/kit.js` → 200; si no, levantarlo de nuevo desde `C:/dev/artefactos-animaciones`.
- **Los cuadros viejos de un render cortado arruinan el siguiente.** `render-gl.mjs` cuenta los `.jpg` de
  `mp4/_cuadros_<reel>` para saber si ya puede armar el MP4, y ffmpeg lee `%05d.jpg` hasta el primer hueco: si la voz
  cambió (48,3 s en vez de 49,1 s), los cuadros viejos que pasan del final nuevo se pegan al video, o el conteo arma el
  MP4 antes de tiempo. Regla: antes de un render entero, borrar SU carpeta `_cuadros_` (nunca la de otro chat).
- **Con Martín usando la PC:** un render por vez, siempre por `turno.mjs`, y sólo con 3 GB libres o más (el script espera
  de a un minuto antes de cada tramo); al terminar, cerrar el navegador y los ffmpeg propios, por PID.

## Lo que quedó sin hacer
- Ver `docs/series/serie-1-elige-a-o-b.md` y `docs/series/serie-4-reacciona-comentarios.md`, §5 «Por hacer».
## Relevo de referentes: Ramiro Cubría, Víctor Heras y Alex Hormozi — 19/11/2026

Las herramientas del relevo viven en `C:/dev/referentes-videos/tools/` (fuera del repo; copia en `docs/series/herramientas/`).
El método completo está en `docs/series/desarmar-video-referente.md`; el relevo, en
`docs/series/referentes/`.

## Relevar una cuenta de Instagram sin Apify (19/11/2026)

- **Sin sesión, Instagram muestra 12 publicaciones por perfil y ninguna más** (el resto queda detrás del cartel «Log in»). Con
  sesión, la pestaña «Reels» carga de a 6 al bajar la página y cada tarjeta trae sus reproducciones en el texto del enlace
  (`a[href*="/reel/"]`). Bastó con la sesión de Martín en el navegador de la app y la rueda del ratón. Ir a
  `/web/search/topsearch/` (la API interna) lo frena el clasificador de permisos: la lista se junta mirando la página.
- **Con el panel del navegador escondido, la grilla no carga** (sin `requestAnimationFrame`): el `find` y el JS se cuelgan a los
  30–45 s. Se arregla con una pestaña nueva (`preview_start` con la URL), `resize_window` a 1280×2400 y una captura antes de la
  primera `scroll` (la rueda necesita una captura previa para tener coordenadas).
- **Un reel suelto baja sin sesión** con `yt-dlp` (`/reel/<código>/`). La sesión sólo hace falta para la LISTA.
- **El @ obvio casi nunca es el de la persona**: `@ramirocubria` es una cuenta vacía (el real es `@ramiro.cubria`);
  `@victorheras` es un director de arte, `@victorherass` otra persona, `@victorherasmedia` una cuenta chica. El de Víctor Heras es
  `@victorherasemprendedor` (494 mil): salió buscando en la web «Víctor Heras instagram reels», no adivinando. Antes de bajar nada,
  se mira la bio y los seguidores.
- **La pestaña «Reels» y la grilla principal NO tienen lo mismo.** Víctor: 36 reels en la pestaña y 21 publicaciones en la grilla,
  con 4 reels viejos que no están en la pestaña y 11 carruseles. Hormozi: la grilla mezcla colaboraciones de otras cuentas
  (`/leilahormozi/p/…`) y no va en orden de fecha estricto. «Todo lo publicado» se junta de las dos.
- **Carruseles sin Apify:** `yt-dlp --dump-single-json --ignore-no-formats-error` sobre `/p/<código>/` da una entrada por lámina;
  las de imagen traen sólo la URL de la imagen en `thumbnails`. Una publicación restringida («It can't be seen by certain
  audiences») devuelve el JSON `null`, no un error: hay que chequear que sea un objeto (`tools/publicaciones.py` cortaba ahí).
- **`yt-dlp` baja las láminas de IMAGEN recortadas al cuadrado** (1080 × 1080, la miniatura), no la lámina 4:5 entera; las de
  video vienen enteras. En los tuits en captura de Hormozi falta texto arriba o abajo. Para replicar un carrusel con su texto
  exacto hace falta la lámina completa (desde el navegador con sesión, abriendo la publicación).
- **El OCR en CPU no sirve con la PC cargada:** RapidOCR tardó 41 s por lámina (un carrusel de 8, cinco minutos). La GPU no
  está disponible para onnxruntime porque el paquete `onnxruntime` (CPU) tapa a `onnxruntime-gpu`, y no se tocan paquetes
  compartidos. El texto de las láminas lo lee el agente en la hoja (láminas a 480 px, de a 3 por fila).
- Los reels FIJADOS de una cuenta salen primero y son viejos (los de Víctor, de 2024, con 7,2 M y 1,9 M). Se cuentan aparte para el
  múltiplo contra la mediana de la cuenta.

## Las herramientas compartidas de la PC

- ⛔ **`pip install -U yt-dlp` sobre el Python global dejó `yt-dlp` SIN MÓDULO para todos los chats** (`ModuleNotFoundError:
  No module named 'yt_dlp'`): pip desinstaló la versión vieja y se colgó al instalar la nueva (otros chats tenían `yt-dlp`
  abierto). Durante ese rato, otros dos chats se pusieron a instalar copias en carpetas propias. Se arregló instalando con
  `pip install --target <carpeta>` (anduvo en segundos) y copiando `yt_dlp/` y `yt_dlp-<versión>.dist-info` a site-packages.
  **Regla: una herramienta que usan otros chats no se actualiza en el lugar; se instala aparte con `--target`.**
- Bajar el `.exe` de `yt-dlp` desde GitHub lo frena el clasificador de permisos; `pip --target` no.
- `faster-whisper` 1.2.1 con el PyAV instalado rompe al abrir un archivo (`open() got an unexpected keyword argument
  'metadata_errors'`): se le pasa el audio ya leído (wav 16 kHz → numpy float32).
- `ctranslate2` en la GPU pide `cublas64_12.dll`, que no está en el PATH pero sí en `torch/lib` (torch 2.6 cu124): se agrega con
  `os.add_dll_directory`. Con la GPU, un reel de 90 s se transcribe en 5 a 15 s (el primero, ~40 s por la carga del modelo).
- **Sacar cuadros con un `-ss` por cuadro tardó 331 s para 24 cuadros** con la PC cargada. Una sola pasada con `fps=2` y el
  filtro de escenas en el mismo `filter_complex` lo hace en 2 a 10 s.
- YouTube estaba lentísimo (60–70 s por Short) porque había ~15 `yt-dlp` de otros chats contra YouTube a la vez. Instagram, en
  7 a 15 s por reel. Para Hormozi se usaron sus reels de Instagram.

## ¿Hay música debajo de la voz?

- **El diagnóstico obvio era el equivocado:** medir el nivel en los «huecos» entre los segmentos de whisper decía «música
  probable» en un reel que es sólo una persona hablando: los segmentos de whisper no cubren las colas de las palabras, y el
  «hueco» medía voz. Lo que sirve es el **piso** del clip entero (percentil 5 del nivel en tramos de 50 ms): sin nada debajo, la
  voz deja silencios a -50 dB o menos; con música o ambiente, el piso queda arriba de -40 dB. Medido en Ramiro: -30 a -38 dB en
  casi todos, -50 en uno. Distinguir música de ambiente (afuera, viento) no se puede con este número: se cruza con la hoja de
  cuadros (¿graba adentro o afuera?).

## Lo que dicen los números de los referentes (el diagnóstico obvio era el equivocado)

- **El molde que Martín describió de Ramiro («gancho de 10–15 s con su avatar de IA y después él en serio») es su forma MENOS
  probada**: 3 reels de 50, uno solo con más de 48 h, a 0,6× su mediana, y con ganchos de 23 a 31 s, no de 10 a 15. Y en esos
  tres Ramiro está FILMADO desde el segundo 0: la IA es un elemento encima (una ballena en la pileta), no su avatar. Lo que le
  rinde son los **sketches enteros con su avatar** (8 reels, mediana 35 mil, 1,9×; 7 de ellos sin una sola toma filmada) y los
  **tutoriales animados** de Claude (5 reels, mediana 38,7 mil, 2,1×; el top de la tanda, 118 mil). El animado se hace por código
  y no gasta IA de video; el sketch es el más caro (75–90 s de IA por toma).
- **Víctor Heras no usa IA ni animación en ninguno de sus 35 reels.** El «gancho exagerado» lo hace con actores y su lujo real; su
  mejor reel reciente (un noticiero falso del robo de su Ferrari, después la explicación en serio y «comenta CLASE»: 1,9 M,
  22× su mediana) es el molde que pidió Martín, pero filmado.
- **Una mediana cruda por forma o por tema confunde la forma con la EDAD del reel.** En Víctor, el sketch le gana a la cámara
  ×5,2 en crudo, pero a igual edad sólo ×1,2 (contra los reels vecinos en fecha) a ×2,4 (ajustando por edad): los reels viejos
  juntaron más, y desde agosto publica casi sólo a cámara. Toda comparación se hace a igual edad (las tablas están en
  `docs/series/referentes/victor.md`). En Ramiro no pesa tanto porque los 50 son de 12 días, pero los de las últimas 48 h se
  dejan afuera del múltiplo.
- Si un reel habla de dinero y de seguidores, el tema lo decide lo que regala el CTA (regla escrita en `victor/temas.json`).
- **Los carruseles juntan más «me gusta» que los reels en las tres cuentas** (medianas: Ramiro 188 contra 145, Víctor 4.030 contra
  3.250, Hormozi 15.047 contra 8.585), y **no tocan los mismos temas**: Ramiro no tiene ningún carrusel de su tema número uno de
  reels (clientes que pagan contra curiosos) y en Hormozi manda «Foco». El carrusel más exitoso de Ramiro («Dejá de hacer
  carruseles PEDORROS»: 16.680 comentarios, 41× su mediana de me gusta) está fuera de sus temas. Mirar sólo los reels de una
  cuenta da una receta incompleta. El relevo está en la sección «Carruseles y posts» de cada documento y en
  `docs/series/referentes/carruseles-de-venta.md` (26 piezas de venta).
- «Cuándo aparece la persona» no dice si la persona es REAL: en los sketches el avatar «habla en serio» y nunca aparece Ramiro.
  Para el costo se mira `persona_real_desde_s` (en `C:/dev/referentes-videos/ramiro/reels.json`).
- «Siempre hablo de los mismos 6 o 7 temas» lo dice Ramiro en reels de temas distintos: es una muletilla, no un tema. La
  definición de cada tema tiene que nombrar de QUÉ habla (p. ej. «Trazabilidad» sólo si el reel nombra o muestra la medición).
  Con esa regla, dos lectores coincidieron a ciegas en 47 de 48 reels.

- **«A igual edad» quiere decir contra la mediana de los reels maduros de ±3 días, sin el propio reel** (el método del crítico de
  Hormozi; el script que lo reproduce está en `docs/series/herramientas/verificar-datos-referentes.py`). El ajuste por edad del
  relevo de Víctor (sketch ×2,4) no se pudo repetir: una regresión simple da ×2,3. Un método de comparación se escribe con
  detalle suficiente para que otro lo repita, o no sirve para elegir.
- **Un video resubido con otro cartel termina con OTRO tema** si se clasifica de a uno: antes de contar, se buscan transcripciones
  (o `cortes_s`) repetidas por script.

## Trampas de las herramientas del relevo

- **Con `python -I`, el orden de un `set` cambia entre corridas** (hash aleatorio): los empates de temas o de ganchos se
  desempatan siempre por la misma regla (por ejemplo, la mediana de reproducciones y después el nombre), o los documentos
  cambian solos de una corrida a otra.

- **`python -I` ignora `PYTHONIOENCODING`** (`-I` implica `-E`): un `print` con acentos o «→» rompe en la consola cp1252. Cada
  script hace `sys.stdout.reconfigure(encoding='utf-8')`.
- El `drawtext` de ffmpeg falla en esta PC (no hay fontconfig): los números sobre los cuadros se dibujan con PIL.
- **Un tramo MUDO en el archivo no es silencio en el reel**: las canciones de la biblioteca de Instagram no vienen en el mp4 que
  baja `yt-dlp`. `audio.py` marca «sin fondo» y whisper inventa texto («Thanks for watching», letras de canciones) en esos
  tramos. Un reel de «montaje con texto y canción» se lee por la hoja, no por la transcripción.
- **En Hormozi, la palabra del CTA vive más en el texto de la publicación que en el video** (43 contra 30 de 48), y en dos casos
  no coinciden (TEAM y TEAMS). El CTA se lee de los dos lados: transcripción y `caption`.
- **Las resubidas se detectan comparando `cortes_s`**: el reel #34 de Hormozi es su fijado #1 resubido con otro título (32 de 32
  cortes al mismo segundo); el fijado tiene 1,9 M y la copia 373 mil, justo su mediana.
- Los cortes de escena con `gt(scene,0.30)` son un piso, no un conteo exacto: en horizontales metidos en vertical las franjas
  negras diluyen el puntaje (0 a 1,4 cortes por minuto donde había 4 a 26).

## La guardia de RAM y el Workflow

- Con ~20 chats abiertos la PC quedó entre 0,4 y 1,7 GB libres; la guardia (`~/.claude/guardia/memoria.mjs`) niega un Workflow
  por debajo de 3 GB y el vigía mató procesos en zona roja. Un relevo que necesita agentes se corre igual con ellos de a uno
  (la herramienta Agent), que la guardia admite con 1 GB.

## Serie con avatar de IA: elegir mirando la referencia (21/11/2026)

La página donde Martín elige es el artefacto «Serie con avatar IA» (https://claude.ai/artifact/FeLyfHY62GRHbLBAJX6QUz). Lo que la
arma vive fuera del repo, en `C:/dev/referentes-videos/artefacto/serie/`. Cómo está hecho cada uno de los 20 reels de referencia
(forma, gancho, cuándo entra la persona, cortes, fondo, CTA) está en la tabla de `docs/series/referentes/README.md` → «La serie con
avatar de IA».

- **Martín no elige leyendo: elige mirando la referencia.** Dos páginas armadas desde los TEMAS le resultaron «súper confusas»:
  - la del 19/11, con 20 tarjetas de porqué, ganchos, formato y costo;
  - la del 21/11, con tarjetas cortas y el detalle escondido.

  Él pidió que «el protagonismo se lo lleve la referencia». La forma nueva:
  - una galería de los reels en 9:16, con un sello (N× y reproducciones);
  - al tocar uno, la referencia y nuestra versión lado a lado, una línea de gancho bajo cada una;
  - los dos guiones en pestañas cerradas;
  - «Lo hago / No» fijo abajo.

  Para MaKo: elegir contenido es comparar contra el original, no leer una ficha.
- **Una sola referencia por tema: la que se calca, no la de más vistas.** Para «Lo tengo que pensar» va el reel de Hormozi con la
  objeción entre comillas (329 mil, 0,9×), no su reel de 1,7 M, que es de otra cosa. Un reel con menos de 48 h muestra «nuevo» en
  lugar del N×: su múltiplo todavía no dice nada.
- **Los reels de 9:16 entran en un artefacto si se comprimen.** Con 480 px de ancho, crf 30 y audio mono a 64k (`comprimir.sh`),
  cada reel quedó entre 0,7 y 6 MB. Los 20 pesan unos 72 MB y un publish acepta 64 MB, así que se suben en dos tandas a la misma
  URL. El video va con `muted`, `preload="none"` y sin autoplay; el sonido, con un botón. A Martín le suenan los videos solos y lo
  odia.
- **El fotograma para la imagen no siempre es el del segundo 1,5.**
  - Donde la persona entra tarde, se elige a mano: en el «reality» de Rama a los 7 s; en el taller de Hormozi a los 3,5 s, que es
    cuando él aparece arriba de la mujer del micrófono.
  - Donde no hay persona (el tutorial animado, la cámara de seguridad del Ferrari), la frase cambia: se pide poner a Martín en ese
    fondo, no «reemplazar a la persona».
- **La transcripción automática confunde las marcas:**
  - «Cloud» por Claude, «Menichat» y «mini chat» por ManyChat;
  - «lids» por leads, «Yamada» por llamada, «VCL» por VSL, «es PAM» por es spam;
  - «Ramíros Cubria».

  Se corrigen al mostrarlas (la lista `CORRECCIONES` de `armar-pagina.mjs`), nunca en el `meta.json`, y sin tocar lo que dicen.
- **Trampa: la clave de ApiMart no está en ningún `.env.local`.** Es de la plataforma: está cifrada en `credenciales`, en el ws
  de capa superadmin (`envCred('APIMART_API_KEY')`, `lib/apimart.ts`). Leerla y descifrarla desde un script local lo **bloquea el
  control de permisos del modo automático** («acceso no autorizado»). Generar imágenes por script necesita que Martín lo habilite,
  o que corra él `generar-imagenes.mts`. Si no, queda Flow por Chrome. No se esquiva pidiéndoselo a otro chat.

- **En esta página entra sólo lo que NUESTRA versión haría con video generado por IA** (Martín, 21/11).
  - Entra: sketches, ganchos exagerados (también los actuados sin IA) y escenas con efecto.
  - Sale: el tutorial animado, que va a la serie del personaje en cubos hecha por código y no gasta video con IA. También sale la
    pizarra, lo dicho a cámara, el estudio, las llamadas y las preguntas del público, que van a la serie de Martín a cámara.
  - El criterio es `conVideoIA` en `armar-pagina.mjs`. De los 20 temas quedaron 9; los otros 11 están en `otras-series.json`, con
    su serie de destino.
  - Con este filtro, Hormozi casi no aporta: 1 sketch en 48 reels.
- **Escribir lo que Martín le enseña a decir a un cliente.** Cada frase lleva «le preguntas» o «le dices». Si no, en voz alta el «tú»
  salta del espectador al cliente y se entiende otra cosa. «Se presenta» suena a «dice su nombre»: va «llega a la llamada».
- **Competitor Spy no marca qué REEL hizo «diez veces más» que su cuenta**: eso lo hace sólo con carruseles. Un guion no puede
  atribuírselo a la app.
- **La lista de reels de una cuenta necesita sesión de Instagram, y el navegador de la app ya no la tiene** (21/11: el cartel de
  «Log in» y 12 publicaciones). Bajar cada reel no la necesita. Sin sesión no se puede ampliar el relevo.
  - Tampoco sirve YouTube: Rama y Víctor no tienen pestaña de Shorts.
  - El primer filtro barato ya está escrito: `tools/portadas.py` arma hojas de 20 portadas numeradas para clasificar la forma
    antes de bajar nada.

### Lo que quedó sin hacer (serie con avatar de IA)

- **Las 20 imágenes de nuestra versión.** Ya están listos los fotogramas (`pub/cuadro/`), una frase por tema y el script
  (`generar-imagenes.mts`: Nano Banana Pro 2K, US$0,02 cada una). Esperan que se destrabe la clave, o Flow.
- **Los regalos del CTA:** 13 de los 20 guiones regalan algo que no existe todavía, una guía o una plantilla (CRM, FILTRO, IA,
  CLIENTES, NICHO, EMBUDO, MARGEN, SISTEMA, EMPEZAR, MENTOR, PRECIO, CIERRE y CASO). Los otros 7 regalan la app, pero no tienen
  cargada la respuesta automática. Cada uno está en el campo `dudas` de `guiones.json`.
- **Ampliar el relevo a 150-200 reels por cuenta:** espera la sesión de Instagram (en el panel de la app o en el Chrome de Martín).
- **Los guiones adaptados:** Martín tiene que aprobar cada uno antes de generar el video con avatar (Omni 1.2 Flash, US$0,024 por
  segundo).
