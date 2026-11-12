# Relevo: el rediseño de Marketing CoPilot (maquetas, 11/11/2026)

Lo que sigue es para retomar sin este chat. Las maquetas son HTML navegables. Nada se programa en la app hasta que Martín dé el OK.

## Dónde está todo

- **Esquema de los pasos:** `docs/marketing-copilot/rediseno/esquema-descubrimiento.md`.
- **Funnels y sus preguntas:** `docs/marketing-copilot/funnels-simples.md`, con el detalle por funnel en `funnels/`.
- **Maquetas en el repo** (`docs/marketing-copilot/rediseno/`), una por vuelta. No se pisan.

  | Maqueta | Artifact |
  |---|---|
  | `maqueta-dos-columnas.html` | PyGboJ5AsKL2wUiPe2Kssk |
  | `maqueta-descubrimiento.html` | XboRwCiqtwybpf4iPXQpqw |
  | `maqueta-arranque.html` | LUyer4k7kV1sokRuBYeX44 |
  | `maqueta-por-canal.html` | 97pKNFeiPV4U8asB9ejLwn |
  | `maqueta-analisis.html` (los puntos 1 a 9 de abajo) | 6oFhRx6JnoHMVgFyoUxcNN |
  | `maqueta-visual.html` (la sexta vuelta) | F1WFdNi1nBJoWakPhVUxWU |
  | `maqueta-accion.html` (la vigente: la séptima vuelta) | CqxfbFNRY54GZnTLFmxj6s |

  Todos los links son `claude.ai/artifact/<id>`.
- **Cómo se arman** (en el scratchpad de la sesión 3b078c27, carpeta `maqueta/`):
  - `cuerpo-visual.html` es el cuerpo vigente (los anteriores: `cuerpo-analisis.html` y `cuerpo-canales.html`).
  - Lo que se mete adentro:
    - `miniaturas.json`: las miniaturas de verdad del Spy, achicadas, como data URI;
    - `extras.json`: la captura de la web y los recuadros del recorrido.
  - `fotos.mjs <url> <carpeta> <tomas.json>` fotografía las tomas de un JSON. Las de esta vuelta están en `tomas-visual.json`.
  - `armar.mjs <cuerpo> <salida-repo> <salida-artifact>` le pega el CSS de producción (`../css-prod/*.css`), el CSS del Spy y de Offer (`spy.css`, que arma `sacar-css-spy.mjs`), las piezas comunes de `cuerpo.html`, los estilos del wizard, el glifo de Instagram (`glifo-ig.txt`) y lo de `extras.json`. Frena si queda una marca `@@…@@` sin valor.
  - `captura-web.mjs <url>` saca la captura de la página entera para «Tu web» y mide dónde cae cada sección: escribe `extras.json` (la foto en data URI y la altura de cada marca).
  - `fotos.mjs http://localhost:4441 <carpeta>` fotografía los estados en claro, oscuro y teléfono con un solo Chrome sin ventana.
  - Para mirarla: una entrada en `.claude/launch.json` con un servidor estático, más el Chrome sin ventana con `--virtual-time-budget` y los enlaces por estado (`#canales`, `#cargar`, `#lectura`, `#negocio`, `#negocio-youtube`, `#negocio-instagram`, `#negocio-anuncios`, `#sin-nada`, `#sin-nada-armado`, `#telefono`). Ver `docs/hallazgos-infra.md`.
  - Si el scratchpad no está, el HTML del repo tiene todo adentro: se edita el segundo `<style>` y el `<script>` del final.
- **El negocio simulado:** Federico Cristofari, Competitor Spy del ws 9, `competidor=20`. Sus videos, reels, vistas y fechas son reales; sus anuncios son de ejemplo.

## Lo que pidió Martín sobre la maqueta por canal (11/11, cuarta vuelta): para hacer

1. **Paso 1:** las tarjetas Anuncios, Instagram y YouTube, sin subtítulo.
2. **Paso 4, «Tu negocio», más simple:** sin el chat de MaKo al costado, todavía. Más adelante sí.
3. **«Tu oferta»:**
   - un botón **«Mejorar oferta»** donde hoy está la tarjeta del perfil («Federico Cristofari»), que se va;
   - en lugar de «A dónde mandas», la **nota total (46/100) al costado**;
   - abajo, «Nota por nota», y en el desplegable de cada nota un botón para **mejorar o corregir** esa parte, porque puede estar mal;
   - sacar «Lo más fuerte».
4. **Anuncios:** sacar la sección del recorrido del funnel y «Lo que veo para este funnel».
5. **Las pestañas de canal NO son una réplica de la plataforma: son un ANÁLISIS**, con los puntos que hay que tocar según los cursos, y feedback en cada uno. Esa lista sirve también, más adelante, para relevar las secciones de MaKo donde se corrige cada cosa.
   - **Instagram:**
     - la bio, y si tiene un CTA bien puesto y ligado a la oferta (sin CTA o con muchos CTA está mal);
     - los reels, con sus transcripciones;
     - los carruseles, y lo que no publica (por ejemplo, sólo reels);
     - la frecuencia;
     - las historias: cuántas sube y si hace historias de venta.
   - **YouTube:** lo mismo, con lo de los cursos de YouTube.
   - **Anuncios**, el análisis de cada uno de los cuatro tipos:
     - **mensajes:** analizar sus conversaciones de WhatsApp (MaKo se conecta a WhatsApp) y aprovechar la plantilla del Dashboard que habla de mensajes;
     - **VSL con llamada:** feedback de su VSL, con la transcripción;
     - **formulario:** feedback de su formulario;
     - **compra directa:** feedback de su página.
6. **Una máquina de contenido por canal** (la estrategia de contenidos), sacada de los cursos:
   - cuántos anuncios y cuántos reels grabar;
   - cada cuánto publicar historias, reels, carruseles, videos de YouTube y anuncios;
   - cada cuánto renovar los creativos;
   - las razones de compra por avatar de Jan, de donde también sale la cantidad de anuncios.
7. **Una pestaña «Tu web»**, como «Tu oferta», que **dibuja la web de la persona** y le da feedback sobre ella.

8. **(11/11, después) Conectar con Zernio en vez de pegar links.** En el paso 2, Instagram y YouTube se CONECTAN con Zernio, como Meta, en lugar de pedir el @ o el link. Con la conexión se podrían traer las estadísticas de sus reels y de su YouTube, y quizás sus historias pasadas, para un análisis mucho más efectivo. Antes de la maqueta hay que averiguar qué trae Zernio de verdad (estadísticas por reel, YouTube, historias pasadas) y decirlo.

9. **(11/11, después) Un paso 5: la operación.** El paso 4 queda como ANÁLISIS. Después va un paso 5 de ejecución:
   - **la máquina de contenido:** cada cuánto crear y qué piezas;
   - **los resultados** de cada cosa;
   - **lo que hace Marketing CoPilot:**
     - en Meta: subir o bajar presupuesto, cortar una campaña que va mal y pedir más creativos;
     - en Instagram: programar el contenido, pedir más cuando haga falta, «grabá esta historia»;
     - en YouTube: lo mismo, más la miniatura. «Que haga absolutamente todo».

   Es mucha información para una pestaña: por eso va en un paso aparte.

## Lo que pidió Martín sobre la quinta maqueta (11/11, sexta vuelta): para hacer

1. **Tu oferta:**
   - «Lo que leí de tu oferta» va al costado, como un segundo bloque largo debajo de la nota, por simetría;
   - «Mejorar oferta» va al lado de la nota;
   - al tocarlo, lleva al chat donde se mejora la oferta (Offer).
2. **Tu web:**
   - la página con mucho más protagonismo, casi a todo el ancho y sin la nota al costado;
   - abajo, nada: los comentarios van como en el **Web Analyst de Web Generator**, la animación tipo tutorial que enfoca una parte y muestra qué mejorar.
3. **Anuncios, Instagram y YouTube:** el feedback queda, pero vuelve el formato de antes:
   - se ven las publicaciones, las miniaturas y los anuncios;
   - al tocar una pieza sale un popup con su feedback;
   - arriba, los mejores, y sus insights.
4. **Cada tipo de anuncio con su propia vista:**
   - **mensajes:** un chat como el de WhatsApp (o los de MaKo) que simula conversaciones del cliente, varias, con feedback;
   - **VSL:** el reproductor del VSL con feedback;
   - **formulario:** el formulario dibujado con feedback;
   - **Instagram y YouTube:** secciones con el diseño original y feedback sobre eso.
5. **Sacar «Lo leí con / Conectado con Zernio» y «Con la cuenta conectada»** en todos lados.
6. **La operación, en subpestañas, no todo junto:**
   - el análisis de lo que corre, como el mapa conceptual de las campañas que tenía Ads Manager, también para Instagram y YouTube;
   - **«Tu máquina de contenido»** aparte, con:
     - cada pieza a crear (historia, reel, carrusel, video de YouTube) con su formato y su diseño;
     - los pasos para hacerla, redirigiendo a las secciones de MaKo (ejemplo: carrusel → 1. ve a Competitor Spy o a los outliers y elige uno, 2. …);
     - la estrategia y la cantidad.
7. **El presupuesto de anuncios se pregunta en algún momento** (al principio o ahí mismo; no lo tiene claro): define cuántos creativos.

## Lo que pidió Martín sobre la sexta maqueta (11/11, séptima vuelta): para hacer

1. **Paso 1:**
   - Si elige Anuncios, ahí mismo se pregunta cuánto quiere invertir y qué tipo de campaña hace o quiere hacer (mensajes, VSL con llamada, formulario, compra directa). Puede elegir más de uno, y la pestaña de anuncios abre en lo elegido.
   - **También en el paso 1, para cualquiera de los tres:** cuánto tiempo tiene para crear. Las opciones de la sexta («Poco tiempo / Marca personal / Con equipo») no tienen sentido.
2. **Tu oferta:** el bloque de la derecha y el de la izquierda del MISMO alto. «Lo que leí» se amolda y no deja aire.
3. **Instagram y YouTube como Tu web:** el Instagram y el YouTube dibujados, con los comentarios encima.
   - En los tres (web, Instagram, YouTube), además, un apartado con todos los comentarios y cosas como cada cuánto publicas.
4. **Nada de texto innecesario, en todas las pestañas:** fuera «Tu perfil», «Tu canal», «5 de 6 puntos bien». Minimalista, que se entienda fácil, sin cosas chicas.
5. **Anuncios:** los mejores anuncios siempre centrados.
6. **«Ponerlo en marcha» no se entiende:** el botón es chico y no se entiende que lo de la lectura es el análisis y después viene la acción. Lo mismo «← El análisis» en la operación. Pensar cómo se entiende.
7. **La operación:**
   - el mapa conceptual NO dividido en anuncios, Instagram y YouTube: uno de anuncios, uno de Instagram, uno de YouTube;
   - Martín no está seguro de que el mapa sea el mejor diseño: investigar cómo representarlo.
8. **Tu máquina de contenido, separada por canal**, según lo elegido. Arriba, la estrategia que propone MaKo:
   - **anuncios:**
     - cuántos anuncios para encontrar el ganador, con la inversión y el tiempo;
     - los de escala;
     - los de retargeting;
     - el presupuesto para experimentos (anuncios nuevos) y cuántos probar por mes;
     - imágenes o video.
   - **Instagram:**
     - la estrategia de reels (con los reels de prueba), de historias (la secuencia: una semana de nutrición, otra de ventas), de carruseles y de lead magnets, para que todo lleve a los mensajes;
     - automatizar esas respuestas con Automations de MaKo;
     - cuánto publicar por día y cuántas historias.
   - Investigar en los cursos de orgánico: Fran Doglio (historias), Juan Carrizo, Ramiro Cubría, etc.
   - Aprovechar todo lo que ya existe en MaKo.
9. **El diseño, mucho mejor:** «no me gusta para nada». Basarse en el diseño de los dashboards de la casa, el que mejor quede.

## El plan

1. **Relevamiento, con agentes, de lo que hay que revisar por canal y de la máquina de contenido.** Sale de todos los cursos de Knowledge: el índice está en el scratchpad (`cursos-indice/`) y las transcripciones en `public/cono-tx/` y `C:/cursos/programa-meta-ads-the-net-lab/transcripciones/`. Va a `docs/marketing-copilot/analisis/` (`organico.md` y `anuncios.md`), con curso y clase en cada punto. Ojo: el texto de MaKo va en tú.
2. **La quinta maqueta**, `maqueta-analisis.html`:
   - sin chat en «Tu negocio»;
   - «Tu oferta» con «Mejorar oferta», la nota al costado y nota por nota con «Mejorar o corregir»;
   - una pestaña de análisis por canal, con los puntos de la lista y su feedback;
   - la máquina de contenido;
   - «Tu web» con la web dibujada (se puede usar la captura del Spy, «Copiar su sitio»).
3. **Lo de siempre:** fotografiarla en claro, oscuro y teléfono; publicarla como Artifact aparte; actualizar el esquema; dejar lo aprendido en `docs/hallazgos-marketing-copilot.md`; subir a `punta/marketing-copilot-agente`.

**Hecho (12/11, undécima vuelta):** `maqueta-piloto.html` (Artifact claude.ai/artifact/DFHqDKpAR5Hy8RQPceb31L). Puntos 1 a 5 de abajo, y además «Marketing CoPilot» arriba, con la criatura de MaKo que pestañea. La configuración va en una hoja al costado, como los ajustes de Linear o Notion. **Sin hacer:** «Métricas» todavía no usa las plantillas del Dashboard (no encontré rápido cuáles son por su nombre en el código); tiene un botón «Abrir en el Dashboard». El cuerpo vigente es `cuerpo-once.html`.

**Pedido de la undécima vuelta (Martín, 12/11, sobre `maqueta-checklist.html`):**
1. **La acción, con las 5 tarjetas** (oferta, web, anuncios, Instagram, YouTube): sin elegir ninguna, la checklist de todo; con una elegida, sólo la suya.
2. **El botón de cada tarea, simple** («Hacerlo»), nunca «En Offer» ni «En Competitor Spy».
3. **La oferta elegida:** la checklist de un lado y el chat de Offer del otro. La web, igual con la página.
4. **El ícono de la oferta** es el de la app (no la estrellita), del mismo tamaño que los otros logos.
5. **El piloto:**
   - sin «Pausar el piloto»: arriba va «Configurar piloto», con la configuración de la tarjeta elegida (todas tienen piloto: la web hace cambios, anuncios lo maneja todo, Instagram publica y hace variaciones de hooks);
   - «qué hago solo y qué te pregunto» va adentro de la configuración, y el modal se rediseña con referencias de otras apps;
   - si todo está en «lo hago solo», no va «Espera tu OK»;
   - sin la línea de MaKo arriba: el logo de MaKo va en «Lo que hice»;
   - «Métricas» con las plantillas que ya hay en el Dashboard (anuncios, Instagram, YouTube, web).

**Hecho (12/11, décima vuelta):** `maqueta-checklist.html` (Artifact claude.ai/artifact/SaGw8C5x76yzEJXM8RT75r). Lo de Martín:
- los pasos sin subtítulo, con un aviso de lo pendiente;
- la oferta en su desplegable;
- Offer y la web a la izquierda, con protagonismo, cuando se trabaja una tarea;
- la acción como una sola checklist, con su calendario y los días que propone MaKo;
- cada tarea dentro de MaKo y en orden: para los anuncios, primero Competitor Spy, después elegir ganadores, las 9 razones (plantilla 3 × 3 de Copywriting), los guiones, grabar, editar y automatizar;
- sin la máquina de contenido en la acción;
- el piloto por tarjeta en «Acciones» y «Métricas», con la oferta también en piloto (las objeciones de las llamadas y los chats, el bono o la garantía, llevar la versión nueva a todos lados);
- «Configurar» en anuncios: inversión por mes, días de cada prueba, costo por agenda, cuánto sube y qué hace solo.

**Para programar, lo que falta en otras tabs:** las plantillas de Copywriting que nombra la checklist (razones de compra 3 × 3, guion de anuncio, bio, reel con palabra clave, semana de historias, descripción del canal, título y miniatura, video largo) y las de Automations (respuesta a un anuncio de mensajes, palabra clave → mensaje).

**Hecho (12/11, novena vuelta):** `maqueta-accionables.html` (Artifact claude.ai/artifact/K79HrsuoncwRD44U452fJf). Lo de Martín:
- los logos de cada alojador del VSL;
- la estrategia abajo de lo principal;
- todo más chico, y los dos lados del mismo alto (la cara y la lista se desplazan adentro);
- las tarjetas no se mueven al cambiar de paso (la cabecera tiene el mismo alto en los tres);
- espacio para hacer algo nuevo («Empezar algo nuevo»: una oferta, una campaña, un video, un lanzamiento, una página);
- cambiar entre ofertas;
- el modo oscuro, que en el Artifact el visor pisaba, ahora con la luna y el sol de la app;
- sólo los canales elegidos, y los demás apagados para empezarlos;
- el piloto y la acción, rehechos con las referencias de `docs/media-buyer/referencias/otras-apps/`.

El cuerpo vigente es `cuerpo-nueve.html`.

**Hecho (12/11, octava vuelta):** `maqueta-tres-pasos.html` (Artifact claude.ai/artifact/3BL3fTaSEPksVsZkfnWeqR). El pedido de Martín, punto por punto:
- todo en mono, sin el verde;
- las historias y las destacadas de Instagram con su feedback (Zernio trae las historias desde que se conecta; las destacadas y la bio salen de la lectura pública);
- la descripción del canal de YouTube con su feedback;
- **la estrategia de cada canal** (anuncios, Instagram, YouTube): si habla de lo que vende, si le habla a su cliente, si lleva a una venta;
- la lista del recorrido en filas, y «Cada cuánto publicas» a la izquierda;
- conectar ahí mismo el VSL (Panda, Vimeo, Wistia, Bunny, YouTube) y los chats (WhatsApp, Instagram), elegir los chats de venta y ver cada chat con la cara de su app;
- «Volver a analizar»;
- la acción con las mismas tarjetas que el análisis, y Offer y Web Generator adentro;
- **el paso 3, «Piloto automático»**: lo que hace MaKo solo. El nombre lo propuse yo y lo decide Martín.

El cuerpo vigente es `cuerpo-ocho.html`, en la carpeta de la maqueta.

**Hecho (11/11, séptima vuelta):** `maqueta-accion.html` con los puntos 1 a 9 de la séptima, más el pedido de después: la acción como lugar de trabajo de MaKo (decisiones, lo que te toca, lo que hice), no como tablero. Los relevos: `analisis/estrategia.md` (la estrategia por canal) y `rediseno/diseno-referencias.md` (el molde de Fernly). El cuerpo vigente es `cuerpo-accion.html`, armado con `parte-accion-*.js`.

**Hecho (11/11, sexta vuelta):** `maqueta-visual.html` con los puntos 1 a 7 de la sexta vuelta. Qué cambió y qué es de ejemplo: `esquema-descubrimiento.md`.

**Hecho (11/11):** los relevos (`analisis/organico.md`, `anuncios.md`, `zernio.md`) y la quinta maqueta, `maqueta-analisis.html`, con los puntos 1 a 9. Qué es real y qué es de ejemplo, y lo que falta en el código: `esquema-descubrimiento.md`.

## Sigue abierto

- **Quién paga leer el propio negocio** (Apify más la IA). Se pregunta antes de programarlo.
- **Dónde se pliega el chat:** Martín lo deja para más adelante.
- **La recomendación del funnel:** la cerraba el chat; sin chat en el paso 4, falta decidir dónde va.
- **Qué hace MaKo solo y qué te pregunta en el piloto automático** (presupuesto, apagar, publicar): la maqueta lo hace solo, con «Deshacer».
- **El nombre del paso 3 está decidido** (Martín, 12/11): «Piloto automático».
- **Lo que falta en el código para hacerlo de verdad:** la lista está en `esquema-descubrimiento.md`.
  - Zernio: historias y analytics de YouTube.
  - Meta: conversaciones y compras.
  - Leer los chats en lote.
  - Transcribir el VSL.
  - La velocidad de la web.
