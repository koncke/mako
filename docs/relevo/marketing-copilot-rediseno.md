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
  | `maqueta-visual.html` (la vigente: la sexta vuelta) | F1WFdNi1nBJoWakPhVUxWU |

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

## El plan

1. **Relevamiento, con agentes, de lo que hay que revisar por canal y de la máquina de contenido.** Sale de todos los cursos de Knowledge: el índice está en el scratchpad (`cursos-indice/`) y las transcripciones en `public/cono-tx/` y `C:/cursos/programa-meta-ads-the-net-lab/transcripciones/`. Va a `docs/marketing-copilot/analisis/` (`organico.md` y `anuncios.md`), con curso y clase en cada punto. Ojo: el texto de MaKo va en tú.
2. **La quinta maqueta**, `maqueta-analisis.html`:
   - sin chat en «Tu negocio»;
   - «Tu oferta» con «Mejorar oferta», la nota al costado y nota por nota con «Mejorar o corregir»;
   - una pestaña de análisis por canal, con los puntos de la lista y su feedback;
   - la máquina de contenido;
   - «Tu web» con la web dibujada (se puede usar la captura del Spy, «Copiar su sitio»).
3. **Lo de siempre:** fotografiarla en claro, oscuro y teléfono; publicarla como Artifact aparte; actualizar el esquema; dejar lo aprendido en `docs/hallazgos-marketing-copilot.md`; subir a `punta/marketing-copilot-agente`.

**Hecho (11/11, sexta vuelta):** `maqueta-visual.html` con los puntos 1 a 7 de la sexta vuelta. Qué cambió y qué es de ejemplo: `esquema-descubrimiento.md`.

**Hecho (11/11):** los relevos (`analisis/organico.md`, `anuncios.md`, `zernio.md`) y la quinta maqueta, `maqueta-analisis.html`, con los puntos 1 a 9. Qué es real y qué es de ejemplo, y lo que falta en el código: `esquema-descubrimiento.md`.

## Sigue abierto

- **Quién paga leer el propio negocio** (Apify más la IA). Se pregunta antes de programarlo.
- **Dónde se pliega el chat:** Martín lo deja para más adelante.
- **La recomendación del funnel:** la cerraba el chat; sin chat en el paso 4, falta decidir dónde va.
- **Qué hace MaKo solo y qué te pregunta en la operación** (presupuesto, apagar, publicar): la maqueta lo hace solo, con «Deshacer».
- **Lo que falta en el código para hacerlo de verdad:** la lista está en `esquema-descubrimiento.md`.
  - Zernio: historias y analytics de YouTube.
  - Meta: conversaciones y compras.
  - Leer los chats en lote.
  - Transcribir el VSL.
  - La velocidad de la web.
