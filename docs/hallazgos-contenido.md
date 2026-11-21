# Hallazgos — Contenido (las series de videos por código para las redes de Martín)

El código vive fuera del repo, en `C:/dev/artefactos-animaciones` (galería, kit, voz); los playbooks de cada serie, en
`docs/series/`. Lo del motor de la galería en sí (kit, render, trampas de Three.js) está en
[editor-video/animaciones-por-codigo.md](editor-video/animaciones-por-codigo.md) → «La galería de formatos».

## Ángulos de comunicación de Martín (21/11/2026, corrida de 9 agentes sobre 503 piezas de Spy)

El documento para Martín es [series/angulos-de-comunicacion.md](series/angulos-de-comunicacion.md). Acá va lo que se aprendió y sirve
para cualquier cuenta (y para llevar a MaKo):
- **El diagnóstico obvio era el equivocado:** «la cuenta personal tiene que esquivar los temas de Rama». El crítico mostró que sus temas
  (qué contenido trae plata, trazabilidad, clientes que pagan) son justamente los que más le rinden (trazabilidad, mediana 55.250). Lo que
  diferencia no es el tema, es la PRUEBA: él opina, Martín muestra el número de lo que probó.
- **Abrir con lo que se gastó rinde poco** (Carrizo, Db_zc0up4hg, nx 0,9): el número va como giro, no como gancho.
- **La palabra del CTA tiene que nombrar lo que se lleva:** en Rama, EDITAR junta 12,2 comentarios cada 1.000 vistas; YO, de 1,0 a 2,7.
  Una palabra genérica (INFO, CLASE) o sin el regalo armado no sirve.
- **Explicador animado:** Dakota Hermes pasó de una mediana de 1.072 a 20.400 vistas cuando cambió a ese formato (síntoma → qué es →
  por qué pasa → ejemplo con números → regla). Es el molde para la serie Educación y para la prueba de la cuenta MaKo.
- **Mentalidad y vida sin hilo rinden menos:** Víctor, mentalidad, mediana 49.300 contra 85.100 de su cuenta; la vida de Collado, nx 0,4.
- **Vos o tú:** lo que Martín dice A CÁMARA va con vos (docs/vsl/voz-de-martin.md: el tú «en su boca suena a guion leído»); lo que dice
  el personaje con la voz clonada, con tú. La regla general «siempre tú» no aplica a su parte a cámara.
- **Una cuenta nueva no tiene nx** (no hay reels vecinos): para la prueba de la cuenta MaKo se mide contra la mediana de las piezas de la
  misma prueba, con el mismo formato, horario y duración, para que sólo cambie el ángulo.
- **Sin hacer:** etiquetar cada pieza de Spy con su ángulo (para filtrar por ángulo en Content Machine) y decidir con Martín las cuatro
  preguntas de «Cómo seguimos» del documento.

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

### Ampliar el relevo a cientos de reels (21/11/2026)

Cómo se releva una cuenta (el usuario correcto, la lista con sesión, el filtro por portada, el N× y cuánto rinde cada cuenta)
quedó en [hallazgos-competitors-spy.md](hallazgos-competitors-spy.md) → «Relevar a mano la cuenta de Instagram de un referente».

### Lo que Martín corrigió de la página, ronda por ronda (19 al 21/11)

Cada ronda dejó una regla para cualquier página donde Martín elige o revisa contenido:

1. **Demasiado texto.** Las tarjetas con porqué, ganchos, formato y costo, y después con el detalle escondido: «súper confusa» las
   dos veces. Se rehizo DE CERO, no se recortó. Regla: si se entiende leyendo, está mal planteada; tiene que entenderse mirando.
2. **La referencia manda.** Galería de los reels en 9:16 y, al tocar uno, la referencia y nuestra versión lado a lado. Los guiones
   van en pestañas cerradas y la decisión queda fija abajo.
3. **Todo en claro.** Nada de páginas en modo oscuro. Regla: las páginas de trabajo van en modo claro.
4. **Un solo filtro.** Un botón «Filtrar» que combina creador, forma y estado, en lugar de una fila de chips por cada cosa.
5. **El video se ve al pasar el cursor, sin sonido.** El audio va con un botón y el video con `preload="none"`. Un video que suena
   solo es lo que más le molesta.
6. **Afuera lo que no lleva video con IA.** El criterio está en `conVideoIA` y en `criterio-video-ia.md`.
7. **Content Machine.** Una sola página con tres pestañas (Avatar IA, Animaciones, Carruseles) y el mismo patrón en las tres.
8. **Todo se ve adentro.** Los 91 formatos se reproducen en la página, sin links a otro artefacto, y cada póster es su propio
   archivo, nunca una imagen con todos juntos.
9. **La devolución por voz, en todo.** Cada reel, formato, carrusel y lámina tiene sus comentarios, escritos, dictados o con audio.
10. **El detalle no se lee plano y tiene UNA sola zona** (21/11, tarde). El análisis, el guion y el CTA en texto corrido, más
    «Nota para cambiar», «Comentarios» y otro cuadro de texto con la esquinita para estirar: «eso no tiene sentido». Quedó así:
    - abajo de la comparación, tarjetas: «Por qué funciona la referencia» en puntos con título (Gancho, Estructura, Cierre,
      Estética), el guion numerado (lámina por lámina, escena por escena o frase por frase, con la lámina que se está viendo
      marcada), el CTA como una palabra grande y «Qué cambiamos y por qué»;
    - UNA zona por pieza: la decisión arriba y los comentarios como un hilo, con una barra para escribir y el micrófono al lado, como
      WhatsApp. El campo crece solo hasta un tope y después hace scroll adentro (`resize: none`). En una pantalla ancha la zona queda
      fija a la derecha; en el teléfono va al final;
    - lo mismo en las tres secciones.
    Regla: nada que el usuario tenga que estirar, y un solo lugar para opinar. La nota vieja de `revision` aparece como primer
    globo del hilo, «Nota anterior», para no perderla.
11. **«Horriblemente diseñado»: el escenario manda** (21/11, noche). Las cuatro tarjetas de texto en 2×2 debajo de las láminas
    (párrafos largos, un «2–10» que metía nueve láminas en un párrafo, un CTA medio vacío) se fueron. Quedó así:
    - arriba, referencia | nuestra del MISMO tamaño y enteras (`object-fit: contain`, 4:5 o 9:16, hasta ~70vh), con flechas;
    - UNA línea bajo el escenario: el texto de ESA lámina (escrito a mano por lámina en `fichas-cortas.json`, porque el armado
      automático desde el guion dejaba comillas cortadas y frases de 150 letras) o el gancho del reel;
    - una tira de miniaturas con la actual marcada y un punto en las que tienen comentarios;
    - a la derecha, un panel fijo con «Comentarios | Ficha». La ficha va en viñetas de 12 palabras como máximo, reescritas a mano:
      si no entra, se resume el texto, no se achica la letra;
    - en el teléfono, una lámina grande con «Referencia | Nuestra», deslizar para pasar y el panel en una hoja que sube.
    Regla: la pregunta es «¿se entiende en 5 segundos, sin leer?». Si para entender una pieza hay que leer un bloque, está mal.
12. **Spy para elegir, Reels y Carruseles para producir** (21/11, noche). La pestaña «Avatar IA» pasó a ser «Spy»: trae TODO lo
    de la competencia (avatar IA, animación, a cámara y carruseles) y nada queda afuera por no llevar video con IA. Cada pieza tiene
    «Elegir» (los «Lo hago» de `votos` cuentan como elegidos), y elegir la manda a «Reels» o «Carruseles» como «Por producir»,
    con la referencia y un lugar vacío para nuestra versión (`revision/prod-<id>`). Además:
    - los comentarios y la ficha van DEBAJO del escenario (en pantalla ancha, las dos columnas a la vez), no en un panel al costado;
    - no hay flechas ni «1 de 11» para pasar de pieza: se vuelve con «‹ Todas». Sólo se pasan láminas de un mismo carrusel;
    - la referencia de un reel va SIEMPRE en video; una captura no sirve para comparar.
    - En el teléfono, si todavía no hay nuestra versión, el detalle abre en la referencia, no en un recuadro vacío.
    Regla: Spy es para mirar y elegir; lo que no lleva IA también se muestra, con su tipo en el filtro.
13. **El filtro, con caras y sin «Como vienen»** (21/11, noche). Martín pidió los creadores con su nombre completo y su caricatura,
    y que el orden por defecto sea el N×, dicho en palabras: «Los que más superaron a su cuenta», con un «?» que lo explica.
    Se sumó «Los más comentados», para los videos de ventas con palabra CTA, y cada tarjeta muestra el número del orden elegido.
14. **Un panel con tres pestañas, del ancho de las dos piezas** (21/11, noche). Comentarios y ficha lado a lado no servía: el
    panel quedaba con un bloque blanco debajo de la barra de escribir y no se veía que había algo más abajo. Quedó así:
    - el escenario baja a ~60vh, para que en la primera pantalla ya asome el borde del panel;
    - UN panel con «Comentarios · Guion · Guion técnico», de borde a borde de las dos piezas (se mide con JS);
    - la decisión sube a la barra de arriba, al lado de «‹ Todas»;
    - la barra de escribir queda pegada al fondo del panel, que tiene alto fijo (500 px), y el hilo hace scroll adentro;
    - «Guion» va en dos columnas: el original, por bloques, contra el nuestro. En carruseles es lámina por lámina;
    - «Guion técnico» va en dos columnas: lo que se ve en la referencia (con sus tiempos) contra lo que hacemos nosotros, con lo
      que cambia marcado.
    - **Trampa:** con el panel del navegador escondido, `requestAnimationFrame` no corre. Medir el panel en un rAF lo dejaba sin
      ajustar en la vista local, así que se mide al pintar.
15. **El guion se edita ahí mismo** (21/11, noche). «Súper importante: si no, no tiene sentido de que esté ahí». Quedó así:
    - NUESTRO guion es un campo que crece solo y se guarda solo en `guiones/<sección>-<id>` (carruseles por lámina en `laminas`;
      reels por bloque en `bloques`), con «Guardado» a la vista;
    - desde Comentarios, «Editar el guion de esta lámina» abre ese texto, y cada comentario trae «Aplicar al guion»: Claude
      (capacidad `sample` de la página) reescribe el texto con el comentario y lo deja guardado para revisar;
    - en carruseles, el guion y el guion técnico muestran UNA lámina, sincronizada con el escenario: si se pasa la lámina en un
      lugar, se pasa en los dos;
    - el guion técnico de un carrusel compara, por lámina, las dos miniaturas en 4 renglones: composición, imagen, textos y
      colores, con lo que cambia resaltado. Lo describe Claude con las dos imágenes la primera vez que se abre, y queda guardado
      en `tecnico/<clave>-<lámina>`;
    - arriba ya no están «Content Machine», el conteo ni «Cambiar»: queda «‹ Atrás» y, en el panel, sólo «Aprobado»;
    - no se ve ninguna barra de scroll (`scrollbar-width: none`), y el filtro va en una grilla pareja, con los creadores en 0 al
      final y atenuados.
    - **Trampa:** la barra de escribir se cortaba porque se medía mientras su pestaña estaba escondida (alto 0). Ahora nunca se
      mide escondida ni baja de 44 px.
    - **Trampa:** «el original tiene que estar siempre». A 5 de los 7 reels terminados les faltaba la transcripción de la
      referencia: se transcribió con faster-whisper y se tradujo a mano (`content-machine/transcr/originales.json`). Los otros
      dos (Serie 1 y Serie 4) siguen sin video de referencia. Un reel de Víctor no tiene voz: queda marcado `sin_voz`.
16. **«Filtrar» va en la fila de las pestañas, pegado a la derecha** (21/11). El conteo va chico, a su izquierda, y en el teléfono
    el botón queda sólo con el ícono. Antes estaba en una segunda fila, a la izquierda, porque el pedido se entendió mal.
    - **Trampa:** una regla `.panel { display: flex !important }` le gana a `[hidden] { display: none !important }` del esqueleto
      del artefacto si viene después, y deja el panel de filtros siempre a la vista. Se escribe `.panel:not([hidden])`. Lo mismo
      vale para cualquier elemento que la página esconde con `hidden`.
17. **La galería como mosaico de columnas, y un filtro que no corta nada** (21/11). Con las piezas de Carrizo (reels 16:9,
    carruseles 4:5 y 3:4) la grilla de filas iguales dejaba huecos. Quedó así:
    - cada pieza en su proporción, acomodada por JS en la columna más baja, de izquierda a derecha, para respetar el orden
      elegido. Con `columns` de CSS se leería de arriba abajo y el orden se desarma;
    - 5 columnas a 1440, 4 a ~1024 y 2 en el teléfono. El corte se toma del ancho de la grilla, no de la ventana: a 1440 la
      grilla mide 1168 px, y con el corte en 1180 salían 4 columnas;
    - en el filtro, el orden va en una lista vertical con círculo, los creadores de a uno por renglón (cara de 32 px, el número a
      la derecha) y los chips de tipo y estado a su ancho, sin cortar.
    - Para revisarlo: en la consola, `[...document.querySelectorAll('#panel .op')].filter(b => b.scrollWidth > b.clientWidth + 1)`
      lista cualquier botón con el texto cortado.
18. **El guion técnico de los reels se sacó de las tiras de cuadros** (21/11). Lo escribió un subagente con la hoja de cuadros,
    `cortes_s` y `audio.json` de cada reel (los 20 con escenas guardadas), y quedó en el campo `tecnico` de la colección spy.
    - **Trampa:** el piso de audio dice si hay ALGO debajo de la voz (arriba de −40 dB), pero no si es música o ambiente. En 14
      de los 20 reels quedó «música o ambiente debajo de la voz». Sólo los de Hormozi dan voz sola (−48 a −50 dB).
    - **Trampa:** las canciones de la biblioteca de Instagram no vienen en el mp4. Un tramo «sin fondo» en un montaje con texto
      se marca «música de Instagram probable (no viene en el archivo)».
    - Los textos en pantalla con voseo («Abrí», «Comentá») se citan tal cual: son citas de la referencia, no texto nuestro.
    - **Trampa del filtro:** el estilo base de lo elegido pone el texto en `--panel` (blanco) sobre fondo `--ink`. Al cambiarle
      sólo el fondo a blanco, el texto desapareció: «Superaron a su cuenta» se veía como un recuadro vacío. Lo elegido lleva ahora
      fondo `--ours-soft`, borde `--ours` y el texto siempre en `--ink`, en todo el panel.
19. **El mosaico no funcionó: cada pieza es una tarjeta cerrada del mismo tamaño** (21/11). Martín: «no se entiende si lo que
    está flotando abajo corresponde al video de arriba o al de abajo… debería ser una tarjeta». Y una pieza de otra proporción
    («la quinta distinta») rompía la grilla. Como en las bibliotecas de anuncios (Foreplay, el Top Ads de TikTok):
    - la tarjeta tiene fondo blanco, borde suave y esquinas redondeadas;
    - el medio va en un recuadro fijo 9:16 que los reels llenan. Lo horizontal o cuadrado va centrado sobre su propia imagen
      desenfocada, con un sello de formato («16:9», «Carrusel · 7»);
    - el pie va ADENTRO de la tarjeta: la cara y el nombre del creador, el gancho en 2 líneas y una fila de métricas (N×, vistas,
      comentarios), con la del orden elegido en negrita;
    - todas las tarjetas miden lo mismo (495 px a 1440). En el teléfono van 2 columnas y se esconde la palabra «vistas» para que
      la fila no se corte.
    - Regla: entre una pieza y la siguiente no queda texto suelto. Si el pie no está dentro de un borde, no se sabe de quién es.
    - Las galerías públicas de Foreplay no cargan en el navegador de la app (quedan en negro), y el Top Ads de TikTok pide
      cuenta después de 4 o 5 tarjetas.
20. **Spy es para mirar y elegir; producir empieza con «＋ Hacer mi versión»** (21/11). El detalle de Spy muestra sólo la
    referencia y un botón grande. Sin comparación, sin panel de comentarios y sin guion: eso es de Reels y Carruseles.
    - El botón escribe `produccion/<id de la pieza>` y abre la pieza en Reels (o en Carruseles, si es carrusel) en la pestaña
      «Guion», con el original y el técnico de la referencia ya cargados. Ahí la pieza figura «En preparación».
    - Si la pieza ya está en producción, el botón pasa a ser «Ya está en Reels · verla →». Los «Lo hago» viejos de `votos`
      cuentan igual que la cola.
    - **Trampa:** la pieza de Spy y la de Reels son el MISMO objeto. Para saber si se acaba de entrar a Reels no alcanza con
      ver si cambió la pieza: hay que comparar también la sección. Si no, la pieza abría en «Comentarios» en vez de «Guion».
    - **Trampa (otra vez la de la ronda 16):** `.panel-der { display: flex !important }` le ganaba a `[hidden]`, y en el teléfono
      el panel de comentarios asomaba debajo del botón. **Regla:** todo componente con un `display` con `!important` lleva al lado
      su `[hidden] { display: none !important }`.
    - En el teléfono las tres pestañas (Comentarios, Guion, Guion técnico) entran en una fila de 326 px con letra de 13,5 px y
      9 px de relleno. «Aprobado» baja a su propia fila, a la derecha.
21. **El carrusel se desliza dentro de la tarjeta de Spy, sin abrir el detalle** (21/11). Martín: «así como lo tenemos en
    MaKo… desplazar los carruseles para ver las otras láminas». Es una copia de `Laminas()` en
    `app/image-editor/carruseles/ExplorarCarruseles.tsx`:
    - una pista con `scroll-snap-type: x mandatory`, que se desliza con el dedo;
    - flechas ‹ › que aparecen al pasar el cursor y quedan a la vista sin mouse (`@media (hover: none)`). Se esconden en la
      primera y en la última lámina. El clic en la flecha frena la propagación: no abre el detalle;
    - puntitos con la lámina actual (con más de 10 láminas va «3/12»);
    - se cargan la portada y la siguiente. Las demás llevan `data-src` y se cargan al llegar, junto con la que sigue;
    - un carrusel con sólo la portada no lleva flechas, sino el sello «Portada · las láminas llegan al elegirlo».
    - **Trampa:** el evento `scroll` no sube al contenedor. Para escuchar todas las pistas de la galería con un solo
      listener, va en fase de captura: `addEventListener('scroll', fn, true)`.
    - **Trampa:** declaré una `const pasarLamina` y ya había otra con ese nombre en el mismo bloque. El `SyntaxError` tumba el
      script entero: la galería quedó con 0 piezas y sin ningún aviso en la página. El chequeo de `armar-cm.mjs` no lo vio.
      Antes de publicar, mirar la consola de la vista local.
    - **Para probarlo en la vista local:** los carruseles de Carrizo sólo están en la base, y la vista local no la tiene. Se arma
      una copia de prueba (`pub/vista-prueba.html`) con una pieza pasada a carrusel con láminas locales y otra con sólo la
      portada. Nunca se publica esa copia.
22. **En el detalle de Spy, el lugar de nuestra versión ES el botón** (21/11). Martín: «el placeholder ahí debería ser como un
    botón gigantesco que sea todo el placeholder». El botón chico debajo de la referencia sola no se veía como el paso siguiente.
    - El escenario es el mismo de Reels y Carruseles: la referencia a la izquierda y, a la derecha, un recuadro del mismo tamaño y
      proporción (324 × 576 a 1440), con borde punteado, un «＋» grande, «Hacer mi versión» y la línea de qué pasa al tocarlo.
      Al pasar el cursor se rellena con el azul de la marca. Si ya está en producción, el recuadro dice «Ya está en Reels».
    - En el teléfono va debajo de la referencia, a lo ancho y con su proporción, con tope de 62 % del alto de la pantalla.
    - **Regla:** la acción principal de una vista va en el lugar donde va a aparecer su resultado, no en un botón suelto.
    - Al guardar, el texto cambia en la `<b>` del botón, no en todo el botón: con `textContent` sobre el botón se borraba el «＋».
23. **Tres tipos: Avatar IA · Animación · Carrusel; «A cámara» no es un tipo** (21/11). Martín: «no entiendo la diferencia
    entre a cámara y avatar IA». Él no se graba: todo lo que tiene una persona se hace con su avatar.
    - «A cámara» pasa a ser Avatar IA con `escena: "a-camara"`. El resto de Avatar IA es `escena: "sketch"`. En el filtro,
      «Escena: Sketch · Habla a cámara» aparece debajo de Tipo sólo cuando está elegido Avatar IA. Si se saca Avatar IA, la
      escena se borra sola. Las piezas de otro tipo no se filtran por escena: su `de()` devuelve `null` y `cumple()` las deja pasar.
    - La página normaliza al cargar (`tipo: "camara"` → avatar con escena), así sirve con los datos viejos y con los migrados.
    - **Las 68 referencias de la galería de animaciones están en Spy** como piezas `anim-ref-<formato>` de tipo animación. Su
      creador sale del campo `origen` del formato (HeyGen HyperFrames, Joseph, Tyler Mommsen, MoSidd…). 57 no tienen `origen`
      y quedan como «Biblioteca de formatos». Las arma `armar-cm.mjs`, no la base. Cuando llega la colección `spy`, la página
      las vuelve a sumar, porque si no la base las pisaría. En el detalle llevan «Nuestro formato →» al formato que salió de ellas.
    - **Trampa:** la referencia de un formato es una imagen, no un video (57 en 4:5 y 11 en 16:9). Sin `video`, la tarjeta no
      lleva `data-video` ni botón de reproducir, y el detalle muestra la imagen.
    - **«Hacer mi versión» con método:** dentro del recuadro, «con avatar IA» y «animado», con la opción del tipo marcada.
      Se guarda en `produccion.metodo` (`avatar`, `anim` o `carrusel`).
    - **Trampa:** un botón no puede llevar otros botones adentro. El recuadro pasó a ser un `div` con un botón transparente
      que lo cubre entero (`.cubre`) y las opciones encima, con `pointer-events` sólo en ellas.
    - **Trampa:** con la línea de contexto dentro de la columna de la referencia, las dos columnas quedaban a distinta altura
      (centradas). Va `align-items: start`. En el teléfono, el gancho sin salto de línea ensanchaba la columna: va en 2 líneas.
    - Las tarjetas medían 491 o 495 según si toda la fila tenía títulos de un renglón: el título lleva `min-height: 2lh`.
24. **La referencia de la Serie 1 y la Serie 4 ya es el reel en video, no una imagen** (21/11; Martín lo pidió dos veces).
    - **El diagnóstico obvio era el equivocado:** no hacía falta buscar en Instagram. Los dos reels ya estaban bajados en
      `C:/dev/series-ref/` (`paralisis/` y `zapater/`, con su `.info.json`), con hojas de cuadros en `hojas/` y
      transcripciones en `trans/`. La «imagen de referencia» de la galería es una hoja de cuadros de uno de ellos.
    - Cómo se identificó cada uno: comparando las hojas de cuadros. La Serie 1 es [Df2WwjMNmQN](https://www.instagram.com/reel/Df2WwjMNmQN/)
      («Le sigues el juego hasta abrir la escotilla»: los móviles de colores, la escotilla con candado, las linternas, A/B).
      No es «El búho» ni la del sargento. La Serie 4 es [DfC0kMiBsoW](https://www.instagram.com/reel/DfC0kMiBsoW/)
      («respondiendo preguntas de seguidores», parte 1). La parte 2, `Dfh0kycBfxT`, era la que nombraba el relevo del 19/11.
    - Se comprimen como las demás referencias: 480 px de ancho, H.264 `-crf 30 -preset veryfast -threads 2`, AAC 96k, sin
      recortar. Van al almacén y en `armar-cm.mjs` el `REF` lleva `videoUrl` y `posterUrl`.
25. **Fecha de publicación, y un ×N contra lo que se está mirando** (21/11). Martín: «hay algunos que tal vez sí son virales…
    pero son muy viejos». Y de su captura: «1102× con 3000 me gustas» le ganaba a «6× con casi 30.000».
    - **El diagnóstico:** el `nx` de la base compara cada pieza contra los reels de SU cuenta de esos días. Sirve para ver qué
      tema funcionó dentro de una cuenta, pero no ordena bien una galería con varias cuentas: una cuenta chica con un pico
      queda primera. Ahora la página calcula `RINDE = métrica / mediana` de las piezas del mismo tipo que se están mirando
      (con el creador y la fecha elegidos): reels por vistas y carruseles por me gusta, sin mezclar nunca. El `nx` de la base
      queda en el detalle como «×N sus reels de esos días».
    - El sello «6× lo normal» va arriba a la derecha del video. En el teléfono dice sólo «6×».
    - La antigüedad («hace 2 sem», con la fecha exacta al pasar el cursor) va en la fila de métricas, a la derecha, y en el
      detalle junto al creador. El orden «Más nuevos» y el filtro «Publicado» (una sola opción, con «Todo») van con
      `pasa(t, v)` en lugar de `de(t)`, porque un rango no se compara por igualdad.
    - La fila de abajo es como la de Instagram (▷ vistas, ♡ me gusta, 💬 comentarios, «29,7 mil», «1,2 M»). Nunca se corta: si
      no entra, la fecha baja a una segunda línea, y en el teléfono todas las filas reservan dos líneas para que las tarjetas
      midan lo mismo. Van 4 tarjetas por fila a 1440 (276 px), 3 a 1024 y 2 a 375.
26. **Tarjetas negras con el ícono de imagen rota: el dato estaba mal, pero la página no puede mostrarlo roto** (21/11).
    Unas piezas de Collado y Doglio venían con `medios.poster: "/_blob/→"`. El chat de la competencia corrige los datos, y la
    página se defiende sola:
    - `medioOk()` sólo acepta una id real (`/_blob/` + 32 hex), una ruta de la versión (`vid/…`) o una `https`. Lo demás
      queda en null al leer la base (`limpiarMedios`) y también en los datos que vienen dentro de la página.
    - Si una imagen falla al cargar, un listener de `error` en fase de captura (el evento no sube) saca la imagen y muestra el
      recuadro. Nunca queda el ícono roto. En un carrusel se saca esa lámina; si no queda ninguna, va el recuadro.
    - El recuadro: un degradé suave, la cara del creador al centro y «Video en camino». Las piezas sin medios van al final
      de cualquier orden.
    - **Trampa:** la cara usa su propia clase (`cara-sm`). Con `.cara`, otro estilo la mandaba arriba a la izquierda.
27. **El filtro: Creador con botones; lo demás, renglones con un submenú en cascada** (21/11). Martín: «los botones solamente
    me gustan para los creadores; el resto debería ser otro desplegable que se abre al costado».
    - Tipo, Escena, Publicado, Estado y Orden son renglones («Publicado · Últimos 3 meses ›»). Al pasar el cursor o tocar, se
      abre al costado del panel un submenú (`position: fixed`, en el `body`) alineado con su renglón: una opción por renglón,
      ✓ en la elegida y el número de piezas a la derecha. Elegir una cierra el submenú y actualiza el renglón.
    - Ahora todos son de una sola opción (con «Todos»). Antes Tipo y Estado se podían elegir de a varios.
    - Se abre hacia donde haya 264 px libres. Si no hay lugar a ningún lado (el teléfono, la hoja de abajo), el renglón abre
      una segunda pantalla dentro de la misma hoja, con «‹ Filtros».
    - Los creadores van en dos columnas a partir de 641 px. En una sola columna empujaban los renglones fuera de la vista,
      y con la barra de scroll escondida no se sabía que había más abajo.
    - **Trampa para probarlo:** el submenú se cierra con `resize`, y ajustar el tamaño del navegador de prueba dispara
      `resize`. La captura tiene que ir sin cambiar el tamaño entre abrirlo y fotografiarlo.
28. **Las 68 referencias de animación llevan su creador real** (21/11; antes figuraban como «Formatos de animación»).
    - **De dónde salió cada una:** el formato que trae `num` es una réplica del paquete de la competencia de
      [@mdmukeem__001](https://www.instagram.com/mdmukeem__001/) («Md Mukeem»): 57 piezas. Las otras 11 traen `origen`:
      HyperFrames de HeyGen (7, el repositorio `heygen-com/hyperframes` o su canal), Joseph | Video Editing, Tyler Mommsen y
      MoSidd (YouTube). La del «recibo» es una idea de nuestra investigación y va a «Otros», al final de la lista y sin cara.
    - **Trampa:** el `origen` de Joseph también nombra HyperFrames. Si la regla de HyperFrames va primero, se lo come. Las
      reglas de un autor puntual van antes que las de la herramienta.
    - Las fotos: los avatares de YouTube salen con `yt-dlp --flat-playlist --playlist-items 0 -J <canal>` (miniatura
      `avatar_uncropped`). En Instagram, la dirección de la foto viene bloqueada para el script: se tomó de una captura
      ampliada del perfil, sólo leyendo. Los cinco están en la colección `creadores` (orden 20 a 24).
    - Estas piezas no están en la base: las arma `armar-cm.mjs` (`creadorDeRef`). Las 128 animaciones de la colección
      `spy` son de la competencia.
    - Con 13 creadores, el panel no alcanzaba: subió a 780 px de alto como máximo y los botones de creador se achicaron
      (cara de 26 px). Si se suman más creadores, revisar que el último renglón (Orden) siga a la vista.
29. **En Spy un reel siempre se reproduce y un carrusel siempre pasa sus láminas** (21/11). Martín: «entro a la referencia y
    no hay nada» (Punch Captions de Md Mukeem: una imagen fija y borrosa).
    - **El diagnóstico obvio era el equivocado:** no faltaba bajar 57 reels. El «paquete» de @mdmukeem__001 es UN carrusel-
      catálogo ([DfvtkWWkyJf](https://www.instagram.com/p/DfvtkWWkyJf/), 11 láminas con 6 tarjetas cada una), y cada
      «referencia» era la miniatura de una tarjeta. El pack de videos lo manda por DM: no hay reel público. Las 57 salieron de
      Spy y entró el carrusel de verdad, con las láminas que la investigación ya tenía en
      `C:/dev/artefactos-animaciones/investigacion/competencia/carrusel/`. De las 23 imágenes de esa carpeta, las láminas son
      la 1, las pares de la 4 a la 20 y la 22. Las impares son recortes repetidos, y la 2 y la 3 son de otras publicaciones.
    - Las otras referencias de formato tenían su video en `investigacion/codigo/videos/<x>/video.mp4`: 10 de 11. Los bloques
      de HyperFrames traen además `preview.video` en su `registry-item.json`. El ejemplo nyt-graph no tiene video público
      (403): salió de Spy.
    - En la colección `spy` no hubo nada que arreglar: las 436 piezas que no son carrusel tienen un `/_blob/` real o una ruta
      `vid/` publicada.
    - **Regla en la página:** un reel sin video va al final, con el sello «Sin video todavía». En su detalle va el recuadro
      con la cara del creador, nunca la imagen como si fuera la referencia. Para ordenar, `tieneMedio` mira el video en los
      reels y las láminas en los carruseles.
30. **Las series de contenido en Reels y Carruseles, y el «72×» como el chip rojo de MaKo** (21/11).
    - Cinco series (docs/series/): 1 Elige A o B · 2 Educación · 3 Ventas · 4 Comentarios · 5 Gancho con avatar (estilo Rama).
      En el filtro van como el renglón «Serie ›», de una sola opción, con «Sin serie».
    - **De dónde sale la serie de cada pieza:** los 7 reels terminados, por su id (`serie1-*` 1, `edu-*` 2, `s3-*` 3,
      `serie4-*` 4). Los 11 carruseles, todos en la 3; el dudoso es «Ofertas que se venden» (tuits de Hormozi), que podría
      ser Educación. Lo que entra desde Spy usa la serie elegida al «Hacer mi versión».
    - La propuesta por defecto: carrusel o con CTA → 3; avatar de Rama → 5; animación → 2; el resto → 2.
    - Se guarda en la colección `series` (`<sección>-<id>`: `anim-`, `carr-`, `prod-`) y, para lo que entra desde Spy, también
      en `produccion.serie`. En el detalle de Reels y Carruseles se cambia con el selector junto a «Aprobado».
    - El chip «N×» copia `.mult` de `app/image-editor/carruseles/explorar.module.css` en su nivel «record»: `#e11d48`, 22 px
      de alto, radio 6, letra de 12 px con peso 750. Sin «lo normal»: lo explica el «?» del orden.
    - **Trampa:** dentro del recuadro-botón, el `select` de la serie necesita `pointer-events: auto`, igual que el método.
      Si no, el clic lo agarra el botón que cubre el recuadro.

## Cuentas y series (21/11/2026) — el modelo que va a MaKo

Martín: «súper importante diferenciar cuentas, porque todo luego lo vamos a llevar a MaKo». Content Machine ya funciona así,
y la app tiene que copiar el modelo:

- **Un usuario puede tener varias cuentas de Instagram, y cada cuenta tiene sus series de contenido.** Las de Martín:
  - **Personal** (@martin.koncke): Gancho IA (gancho exagerado con avatar, estilo Rama) · Educación · Ventas (incluye el
    ticket y los carruseles de ventas).
  - **MaKo** (el usuario todavía no está decidido; se edita en el submenú «Cuenta» y queda en `cuentas/mako`):
    Animados · A o B · Comentarios.
  - Los nombres son cortos a propósito: van en un sello de la tarjeta («Personal · Ventas», con un color por cuenta).
- **Cada pieza propia lleva cuenta y serie.** En el filtro van dos renglones, «Cuenta ›» y «Serie ›». Con una cuenta elegida,
  Serie muestra sólo las suyas. Se guarda en `series/<sección>-<id>` y, para lo que entra desde Spy, en `produccion.serie` y
  `produccion.cuenta`. La cuenta de la competencia pasó a `produccion.cuenta_ref`.
  - Al «Hacer mi versión» se elige con un solo selector agrupado por cuenta, con una propuesta por defecto: carrusel o con
    CTA → Ventas; animación → Animados; Rama o sketch → Gancho IA; el resto → Educación.
  - Los códigos viejos (`'1'` a `'5'` del 21/11 a la mañana) se leen como A o B, Educación, Ventas, Comentarios y Gancho IA.
- **La competencia se agrupa por persona, y cada persona puede tener varias cuentas.** Víctor Heras = @victorherasemprendedor
  + @herasmedia. En el filtro de Spy hay un solo botón «Víctor Heras» (con el total) y debajo sus dos cuentas, para elegir
  una o las dos. La tarjeta dice «Víctor Heras · @herasmedia» con la cara de Víctor.
  - Hoy el vínculo está en la página (`PERSONA_DE = { herasmedia: 'victor' }`). En MaKo tiene que ser un dato del creador:
    una persona con una lista de cuentas, no una cuenta suelta por creador.
  - En el filtro, la persona con varias cuentas es una baldosa más de la grilla, del mismo tamaño que las otras, con un
    indicador «2 cuentas ›». El indicador abre al costado el mismo submenú en cascada (una cuenta por renglón, ✓ en las
    elegidas, se puede elegir más de una y el submenú queda abierto). Tocar la baldosa elige todas sus cuentas. Primero
    ocupaba todo el ancho con las cuentas como chips sangrados debajo, y Martín dijo que rompía el diseño.
  - El submenú mide su ancho después de dibujarse (264 a 360 px), así un usuario largo como @victorherasemprendedor entra en
    un renglón, y se ubica con ese ancho real.

## Comentarios: Claude decide a qué se refieren (21/11/2026)

Martín: «puse el comentario y desapareció». **El comentario no se había perdido:** estaba en `comentarios/zw7l80nk7c6pxhih7ko8`,
guardado con `lamina: 10` porque Martín lo escribió viendo la lámina 10. Hablaba de TODO el carrusel. Con «Esta lámina»
elegido en otra lámina, el filtro lo escondía.
- **Regla:** la lámina en la que uno está mirando no dice de qué habla el comentario. Fuera el selector «Esta lámina /
  Todas»: el hilo muestra siempre todos los comentarios de la pieza, del más nuevo al más viejo.
- `refiere_a` lo decide Claude (capacidad `sample`, `modelTier: 'quick'`) con el texto del comentario y el de cada lámina:
  «Todo el carrusel», «Portada», «Lámina N», «CTA», «Gancho», «Diseño» (en reels: «Todo el reel», «Guion», «Edición»…).
  Si es una lámina, también va en `lamina` (desde 0), y el chip salta a esa lámina. Dónde estaba mirando queda en
  `lamina_vista`. Sin Claude, `refiere_a: "sin clasificar"`, y lo etiqueta el chat que lo atiende. Los comentarios viejos
  sin `refiere_a` se clasifican al abrirlos, de a tres.
- `estado`: «nuevo» al crearlo; el chat que lo atiende lo pasa a «visto» o «hecho». Se ve como chip.
- **Trampa:** la capacidad `sample` lee texto e imágenes, no audio. La transcripción de los audios adjuntos la hace el chat
  (faster-whisper en la PC) y la escribe en `transcripcion`. Los comentarios dictados ya llegan como texto.

## La pestaña «Ángulos» (21/11/2026)

- Va después de Carruseles (`#angulos`). Es `docs/series/angulos-de-comunicacion.md` (commit 9fef26253) puesto en tarjetas:
  la definición arriba; Personal y MaKo en dos columnas con el color de su cuenta; abajo «Todos los caminos llevan a Roma,
  con tensión», «Qué NO hacer» y «Cómo seguimos», con las 4 preguntas para Martín destacadas en amarillo.
- El contenido está escrito a mano en la página (`ANG` en `cuerpo.html`), resumido para que entre en cada tarjeta sin
  achicar la letra. **Si cambia el documento, hay que actualizar `ANG`:** no se lee solo.
- Cada gancho busca su referencia en Spy por el código de la publicación (`id`, `<cuenta>-<código>` o la `url`). Si la
  encuentra, muestra la miniatura y, al tocarla, abre la pieza en Spy. Si no, dice «Todavía no está en Spy»: pasa con
  Dakota, que no está en la colección.
- Pendiente (pedido para más adelante): etiquetar cada pieza de Spy con su ángulo y filtrar por ángulo.
- **21/11, más tarde:** Martín rechazó esa propuesta («súper genéricos»). La pestaña muestra «Ángulos en investigación»
  (`ANG_EN_INVESTIGACION = true`). Las tarjetas y `ANG` quedan guardadas para la versión nueva.
- **Trampa (ya corregida):** `contar()` usa `S[sec]`, y con `sec = 'angulos'` fallaba. La pestaña quedaba en blanco si se
  abría directo con `#angulos` (pasó en v49 y v50). Ahora se cuenta antes de cambiar de sección. Toda sección que no está en
  `S` tiene que evitar las funciones que leen `S[sec]`.

**El reel para mentores high ticket (los pistachos) está en «Reels terminados»** (21/11). No viene de la galería de
animaciones: va a mano en `armar-cm.mjs` (`reels.push`).
- **Cuál es la versión vigente:** `montaje/REEL-v-hormozi-palma.mp4` (37,8 s, con el clip de Hormozi aprobado). El relevo
  del reel todavía dice v6, pero está desactualizado: lo vigente lo registra `docs/relevo/cerebro.md`. En la carpeta hay
  también una v7 del 9/11 que nunca se mandó.
- La referencia es el reel de Josep (@tachocream, [DdTdIIPDzHU](https://www.instagram.com/reel/DdTdIIPDzHU/)), que ya
  estaba en `C:/dev/reel-mentores/josep/josep-reel.mp4`, con su transcripción en `palabras-josep.json`.
- El Guion técnico de un reel terminado ahora usa `ref.estructura` si la hay (bloques con tiempos), con lo nuestro de cada
  bloque en `copia`. Si no la hay, sigue mostrando `origen`.

**Cuando el chat de carruseles termina una pieza** (21/11, «9 agentes de IA»): se trae la página de su artefacto
(`Artifact read`, `path: index.html`) a `content-machine/carruseles/index.html` y se rearma. Al publicar se pasan en `files`
sólo las imágenes de esa pieza, `carr/<id>/mako-NN.jpg` y `ref-NN.jpg`, como `{artifact, path}`: el servidor las vuelve a
copiar de la versión actual. Un publish sin `files` deja las copias viejas, porque la copia no se actualiza sola. Después se
lee una (`Artifact read` con `paths`) para comprobar que es la nueva.
- **Trampa:** si en la sesión no se leyeron antes las copias ya publicadas, el publish se rechaza («not read as published»)
  y no sube nada. Se leen primero (`Artifact read` con `paths`) y después se vuelve a publicar.
- Lo que ya había quedó así: El avión = MaKo · A o B; los tres de Educación = Personal · Educación; Cubos = MaKo · Animados;
  El ticket = Personal · Ventas; Comentarios = MaKo · Comentarios; los 11 carruseles = Personal · Ventas. El dudoso es
  «Ofertas que se venden» (tuits de Hormozi), que podría ser Educación.

### Content Machine: una página para todo el contenido (21/11/2026)

- **El mismo link pasó a ser «Content Machine»**, con tres pestañas: Avatar IA, Animaciones y Carruseles. Las tres usan el mismo patrón:
  galería donde manda la referencia, comparación referencia | nuestra versión y la decisión fija abajo. El armado está en
  `C:/dev/referentes-videos/artefacto/content-machine/armar-cm.mjs`.
- **Los archivos de otro artefacto se copian del lado del servidor:** `files: {"<ruta nuestra>": {artifact, path}}`, sin bajar nada.
  Así entran los 7 reels terminados de la galería de animaciones y las 170 láminas de los carruseles. Si el otro chat rehace una
  lámina, hay que volver a copiarla: la copia no se actualiza sola.
- **Los topes que mandan:**
  - Un publish admite 64 MB y 255 archivos.
  - Una versión admite 256 MB y 511 archivos.
  - El 21/11 quedaron unos 456 archivos y unos 220 MB. Por eso los formatos y los videos nuevos van al almacén de archivos (abajo).
- **Los 7 reels terminados son los de `mp4/para-ig` de la galería.** Su referencia en video sale del texto `origen` de cada uno: un
  Short de YouTube o un reel de Instagram, bajados con `yt-dlp`. Para YouTube, el formato es `bv*+ba/b` con `merge_output_format`
  mp4; `b[ext=mp4]` falla porque YouTube separa audio y video. Dos de ellos sólo tienen imagen de referencia.
- **Lo que se marca:** Avatar IA guarda en `votos` («si» / «no»). Los reels terminados y los carruseles guardan en `revision`
  («aprobado» / «cambiar» y una nota), un documento por pieza: `anim-<id>` o `carr-<id>`.

### Contrato de la colección spy (21/11/2026)

La pestaña Spy de Content Machine (https://claude.ai/artifact/FeLyfHY62GRHbLBAJX6QUz) lee sus piezas de la BASE del artefacto, no de
la página. Así el chat de la competencia suma piezas con `ArtifactData` y sube los medios al almacén sin republicar, y aparecen
solas. **Sólo el chat de Content Machine publica la página.**

**`spy/<id>`, un documento por pieza.** El id es `<cuenta>-<código>`, por ejemplo `carrizo-DGUM7vVucJx`. Las 104 piezas viejas
conservan su id anterior.

```json
{
  "creador": "Juan Carrizo",              // nombre completo, como lo muestra la tarjeta
  "cuenta": "carrizo",                    // clave de la colección «creadores» (abajo)
  "usuario": "@juanxcarrizo",
  "tipo": "a-camara",                     // "avatar-ia" | "animacion" | "a-camara" | "carrusel"
  "formato": "9:16",                      // "9:16" | "4:5" | "1:1" | "3:4" (láminas 1080×1440) | "16:9" (reels horizontales)
  "url": "https://www.instagram.com/reel/DGUM7vVucJx/",
  "fecha": "2026-11-12",                  // aaaa-mm-dd
  "reproducciones": 103000,               // número; en un carrusel, 0 si Instagram no da vistas
  "metrica": "vistas",                    // "vistas" | "me gusta" (reels sin vistas en la grilla: reproducciones 0)
  "me_gusta": 4500,
  "comentarios": 812,                     // comment_count de yt-dlp; null si no se sabe
  "cta": "AHORRO",                        // la palabra del CTA (del texto de la publicación o del final del reel); null si no tiene. La página la muestra en la franja del guion
  "nx": 3.2,                              // N× contra los 6 maduros más cercanos de la misma cuenta, en su métrica: vistas, o me gusta si no hay vistas; los carruseles, contra los 6 carruseles más cercanos. null si tiene menos de 48 h
  "gancho": "la primera frase, tal cual",
  "guion": "la transcripción entera (reels) o el texto de cada lámina, una por renglón (carruseles)",
  "forma": "sketch entero con IA",        // 2 a 5 palabras
  "idioma": "es",                         // "es" | "en"
  "medios": {
    "video": "/_blob/<id>",               // recorte de 25 s, 480 px (sólo reels)
    "poster": "/_blob/<id>",              // portada
    "laminas": ["/_blob/<id>"]            // sólo carruseles, en orden y enteras (no el recorte cuadrado de yt-dlp)
  },
  "agregado": "2026-11-21T07:00:00Z",
  "por": "chat-competencia",
  "estructura": [{ "de": 0, "a": 11, "que": "gancho IA: el Papa busca a Ramiro" }],   // opcional: el guion técnico de la referencia, en segundos
  "guion_original": "",                                          // opcional: la transcripción en inglés si «guion» está traducido
  "tecnico": [{ "de": 0, "a": 3.5, "plano": "", "texto": "", "corte": "", "musica": "" }],   // opcional: guion técnico escena por escena (plano, texto en pantalla, corte, música)
  "nuestro": { "imagen": null, "gancho": null, "guion": [] },   // opcional: lo completa Content Machine al producir
  "costo": { "seg_avatar": 0, "usd": 0 },                        // opcional
  "tema": "", "orden": 0                                         // opcional
}
```

- **Los medios van al almacén de archivos del artefacto** (`Artifact` → `publish` con `asset: true`, hasta 25 por llamada). En
  `medios` va la url `/_blob/<id>` que devuelve la subida. Las 104 piezas viejas apuntan a rutas de la versión (`vid/…`,
  `poster/…`): sirven igual, pero lo nuevo va siempre al almacén.
- **`creadores/<cuenta>`:** `{ "nombre": "Juan Carrizo", "usuario": "@juanxcarrizo", "foto": "/_blob/<id>", "orden": 4 }`. La foto es
  la caricatura de MaKo (`public/asesores/<nombre>.png` del repo). Si un creador no tiene caricatura, va su foto de perfil. Ya están
  los 7: ramiro, victor, herasmedia, hormozi, carrizo, doglio y collado.
- **`produccion/<id>`** (la escribe la página, no el chat de la competencia): `{ "pieza": "<id>", "tipo": "avatar|carrusel",
  "cuenta": "@...", "estado": "en-preparacion", "por": "<id de usuario>", "cuando": "<ISO>" }`. Es la cola de lo que se va a
  producir: lo que está ahí sale en Reels o Carruseles. El id del documento es el mismo de la pieza de `spy`.
  Desde el 21/11 lleva también `metodo`: `avatar`, `anim` o `carrusel`. Una pieza con avatar se puede hacer animada.
- **Tipos en `spy` desde el 21/11:** `avatar-ia` (con `escena: "sketch"` o `"a-camara"`), `animacion` y `carrusel`. Si un
  documento viejo trae `a-camara` como tipo, la página lo lee como avatar con escena «a-camara».
- **Criterio v2 (21/11, chat de la competencia):** las 257 piezas tienen `fecha` (AAAA-MM-DD, del `upload_date` de yt-dlp).
  `vistas` (número o null) va aparte de `me_gusta` y `comentarios`: la página toma `vistas` y, si es null, `reproducciones`.
  También vienen `fijado` (estaba fijado en la grilla) y, en la biblioteca de MaKo, `laminas_pendientes: true` cuando sólo
  está la portada: la tarjeta dice «Portada · láminas en camino» y el detalle, «Láminas en camino». Un `nx` sin 6 vecinos
  con dato real queda en null: así salió el 1102× de los carruseles de Doglio, que ocultan los me gusta.
- **Cómo se escribe:** `ArtifactData` → `batch` con `{op: "set", collection: "spy", doc_id, file_path}`, hasta 50 por llamada, con
  cada documento en un `.json` local. Para cambiar una pieza que ya existe, se lee primero y se escribe con su `if_version`.
- **Qué hace la página:** filtra por «Tipo» y por creador, con sus caricaturas. Ordena por «Los que más superaron a su cuenta» (`nx`,
  el orden por defecto), por «Los más vistos» o por «Los más comentados», y muestra en cada tarjeta el número del orden elegido.
  «Elegir» manda la pieza a Reels o a Carruseles según su `tipo`.
- **Cada pieza se ve con su tamaño:** la tarjeta y el escenario toman la proporción de `formato`. Uno que no está en la lista se dibuja como 9:16 (reel) o 4:5 (carrusel).
- **Trampa:** si la `cuenta` no está en `creadores`, la tarjeta muestra iniciales en lugar de la cara. Sin `nx`, la pieza queda al
  final del orden por defecto.

### Comentarios por voz en todo Content Machine (21/11/2026)

- **Cada comentario es un documento de la colección `comentarios`** del artefacto:
  - `seccion`: `avatar`, `anim` (reel terminado), `fmt` (formato) o `carr` (carrusel);
  - `pieza`: el id de la pieza, y `titulo`, para leerlo sin abrir la página;
  - `lamina`: el número de lámina desde 0, sólo en carruseles;
  - `texto`, y `voz: true` si se dictó;
  - `audio: {id, url}` si se adjuntó un audio;
  - `transcripcion`: `null` hasta que un chat la complete;
  - `por` (el id opaco de quien lo dejó) y `cuando` (fecha ISO).
  En la galería, cada tarjeta con comentarios lleva un globito con el número.
- **No existe una capacidad de micrófono crudo para la página.** Por eso hay dos caminos:
  - **Dictar** (capacidad `dictation`): la voz se transcribe en vivo dentro del cuadro de texto, y la página nunca recibe el audio.
    Anda en una pestaña de Chromium o en la ventana principal de la app de escritorio, y sólo para gente de la organización. Si no
    está disponible, el botón no aparece.
  - **Adjuntar audio:** `<input type="file" accept="audio/*" capture>`. En el teléfono abre la grabadora. Se sube con
    `assets.upload` y queda en el almacén del artefacto. Sólo los editores tienen `assets`; a los demás no les aparece el botón.
- **Cómo lo lee un chat:**
  1. `ArtifactData` → `list` de `comentarios` con la URL del artefacto.
  2. Para un audio: `Artifact` → `read` con `path` igual al `audio.id`, que lo guarda en disco. Se transcribe con faster-whisper.
  3. `ArtifactData` → `update` del comentario con `transcripcion` y el `if_version` leído. Hasta entonces, la página muestra
     «Transcripción pendiente».
- **Cómo se mira la versión PUBLICADA:** el navegador de la app no tiene sesión en claude.ai (21/11), así que se abre en el
  Chrome de Martín, sólo leyendo. Ahí no se puede inspeccionar con JS: la página corre en un iframe de otro origen, así que se mira
  con capturas y clics. Y la ventana de Chrome no baja a 375 de ancho, así que el teléfono se mira en la copia local, con los
  mismos archivos del almacén servidos en `_blob/<id>`.
- **Trampa de la vista local:** el artefacto envuelve la página en un esqueleto con `[hidden]{display:none!important}`. Una copia
  local sin ese esqueleto muestra el panel de filtros abierto. Para mirar en local, se envuelve con el mismo esqueleto.

### Videos y pósteres en el almacén de archivos, no en la versión (21/11/2026)

- **Una versión admite 511 archivos y 256 MB.** Los 91 formatos son 247 archivos: 89 videos, 90 pósteres y 68 referencias. No
  entraban. El **almacén de archivos** del artefacto (capacidad `assets`) no cuenta en la versión y sobrevive a cada publicación:
  - se sube con `Artifact` → `publish` con `asset: true` y `file_paths`, hasta 25 por llamada (los 247 fueron 10 llamadas);
  - cada archivo vuelve con su `/_blob/<id>`, que la página usa tal cual;
  - el mapa «archivo → url» queda en `assets.json`, con copia en `C:/dev/referentes-videos/artefacto/content-machine/`, y lo lee
    `armar-cm.mjs`;
  - un archivo del almacén se borra sólo a propósito, con su id.
- Para sacar de la versión archivos que la sesión no publicó (los que vinieron copiados de otro artefacto), primero hay que
  listarlos (`list` con `scope: "files"`). Si no, la publicación se niega a quitarlos.
- Martín: **nunca juntar pósteres en una sola imagen.** Cada uno es su archivo.
- **El análisis de cada carrusel se arma con estructura, no como texto** (`armar-cm.mjs`). El artefacto de carruseles lo trae en un
  `<details>` con párrafos que empiezan con `<strong>` («Por qué funciona la referencia.», «Guion (MaKo).», «CTA.»). De ahí salen
  los puntos con título, el guion numerado (la lista, con su «2–6.» al principio) y el CTA, que se parte en la flecha «→».
  **Si el CTA dice «promete la guía» (y no «no promete»), la ficha lleva «Falta la guía».** El 21/11 eran HORMOZI y GRUPO.
  Si el chat de carruseles cambia ese formato, la ficha queda vacía sin dar error: se mira `ficha` en los datos después de armar.
- Al rehacer láminas, se vuelven a copiar sólo las `mako-NN.jpg`, porque las de la referencia no cambian. Se confirma por el peso
  (`Artifact read` con `path`): la lámina 3 de Hormozi de la versión 6 pesa 45.553 bytes.
- Los clips de las cuentas nuevas van directo al almacén. Los 93 clips de Avatar IA siguen en la versión: si hace falta lugar, se
  mudan.

### Lo que quedó sin hacer (serie con avatar de IA)

- **Las 20 imágenes de nuestra versión.** Ya están listos los fotogramas (`pub/cuadro/`), una frase por tema y el script
  (`generar-imagenes.mts`: Nano Banana Pro 2K, US$0,02 cada una). Esperan que se destrabe la clave, o Flow.
- **Los regalos del CTA:** 13 de los 20 guiones regalan algo que no existe todavía, una guía o una plantilla (CRM, FILTRO, IA,
  CLIENTES, NICHO, EMBUDO, MARGEN, SISTEMA, EMPEZAR, MENTOR, PRECIO, CIERRE y CASO). Los otros 7 regalan la app, pero no tienen
  cargada la respuesta automática. Cada uno está en el campo `dudas` de `guiones.json`.
- **Las cuentas en cola** (Carrizo, Doglio, Collado) y Julián Alborna: ver [hallazgos-competitors-spy.md](hallazgos-competitors-spy.md)
  → «Lo que quedó sin hacer».
- **El contador de arriba en Animaciones** dice «0 de 7 aprobados» y «7 de 7»: cuenta sólo los reels terminados, no los 91 formatos
  (el detalle de un formato sí dice «de 91»).
- **Transcribir los audios de los comentarios:** nadie lo hace solo todavía. Lo hace el chat que lea los comentarios (los pasos,
  arriba).
- **Los guiones adaptados:** Martín tiene que aprobar cada uno antes de generar el video con avatar (Omni 1.2 Flash, US$0,024 por
  segundo).
