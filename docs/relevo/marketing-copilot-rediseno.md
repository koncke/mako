# Relevo: el rediseño de Marketing CoPilot (maquetas, 11/11/2026)

Lo que sigue es para retomar sin este chat. Las maquetas son HTML navegables. **Martín dio el OK para construirlo** (12/11, vuelta 19: «que esté todo preparado para que en producción funcione… que el piloto automático funcione»; 13/11, por el Cerebro: «delegues absolutamente todo… que lo vayan construyendo»). Lo que ya está en la app y lo que falta: «En la app», abajo.

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
- **Desde la vuelta diecisiete, las fuentes están en el scratchpad de la sesión ea110555** (`C:/Users/marti/AppData/Local/Temp/claude/fb1d94a1aca5ced3/ea110555-3023-4ac9-9b9e-1f6c71c392f3/scratchpad/maqueta/`, con `css-prod/` al lado). Las de antes siguen en la de 3b078c27. La vigente se arma con `node aplicar-diecisiete.mjs <carpeta>` y `node armar.mjs cuerpo-diecisiete.html <repo> <artifact>`. Para mirarla, `servir-vigente.cjs` sirve en el puerto 4451 el archivo que nombra `vigente.txt` (la entrada `maqueta-copilot` de `.claude/launch.json` del escritorio).
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

## Lo prometido a Julio para el lunes 17/11: lo hecho el 14/11 y lo que queda

El Cerebro (14/11) pidió, en orden, lo que Martín le prometió a Julio el 13/11 (docs/relevo/llamada-julio-13-11.md, sección «Marketing
CoPilot», en la rama punta/relevo-llamada-julio). Todo en `punta/marketing-copilot-agente`.

| # | Lo pedido | Estado | Dónde | Lo que queda y por qué |
|---|---|---|---|---|
| 1 | La nevera avisa sola por WhatsApp y email | **hecho** (e5c761f79) | cron `copiloto-nevera` 13:15 UTC → `lib/copiloto/nevera-aviso.ts`; aviso `copiloto-nevera` (WA + email, `AvisoCatalogo.canales`) | Lo grabado y NO programado no cuenta como stock: el Video Editor, Image y Carruseles no guardan el formato ni si está terminado. Sin dónde leerlo, no se inventa. |
| 1b | El CoPilot en el menú y en el teléfono | **hecho** (64d841901 y este commit) | `app/_components/nav.ts` y «Mi día» → `/ads-manager/copiloto`; en el teléfono `/m/ads` muestra el CoPilot nuevo con la MISMA carga (`app/ads-manager/copiloto/cargar.ts`), `?configurar=1` abre «Configurar el piloto» | El Media Buyer viejo del teléfono queda detrás de `?mb=1` (y la charla vieja, de `?estrategia=1`). En el teléfono no hay estrella de MaKo: «Mejorar» de Oferta abre el chat de la computadora, que ahí no está. `rutaEscritorio('/m/ads')` sigue llevando a `/ads-manager` (el Media Buyer), por sus tests. |
| 2a | La entrada de la maqueta | **hecho** (78bd81aea) | `Entrada.tsx` + `lib/copiloto/entrada.ts` + `/api/copiloto/entrada`; `?entrada=1` la reabre | «Lo que tienes» sólo conecta redes: falta la web y los archivos de la oferta. «La lectura» no es una pantalla aparte: el análisis ES la lectura. No hay un botón visible para reabrir la entrada (sólo la URL). |
| 2b | Leer la cuenta PROPIA | **hecho** (372ef1ff0) | `lib/copiloto/redes-propias*.ts`: IG (bio, link, ritmo, reel más visto) y YT (descripción, link) | Las destacadas y la retención de 3 s: sin API gratis (Apify, y quién lo paga sigue sin decidir). La bio necesita la conexión de Meta con Instagram; las publicaciones, el complemento de Analytics de Zernio (402 sin él). |
| 2c | Conectar el VSL de Wistia | **hecho lo que mide** (este commit) | `lib/copiloto/vsl.ts` + «Tu VSL» en Anuncios: la curva del Pixel de MaKo en cuartos y dónde se va la gente; sin eventos, «¿Dónde está tu VSL?» (Pegar el Pixel, Conectar Wistia) | Sólo con la campaña VSL (`funnel` o `campanas`) y lee la PRIMERA landing del negocio: no hay dónde decir cuál es la del VSL. Wistia conectado sólo trae reproducciones por día; la curva es la del Pixel. |
| 3 | El piloto por red, «solo / te pregunto» | **hecho lo que anda** (ffc841127) | `lib/copiloto/piloto-redes.ts`; `configurar` con Instagram y YouTube; «Qué hago en tu Instagram/YouTube» en el paso Piloto | Hacer SOLO las variaciones de hook, los shorts y el carrusel: editar video depende del navegador. Cambiar el hook que pierde gente: sin retención. Miniatura y título de YouTube: sin el CTR de YouTube Analytics. Una cola de decisiones orgánicas con «Lo que hice» y Deshacer (la de `media_buyer_decisiones` sólo acepta Meta: migración). Por eso no tienen interruptor: uno que no hace nada es peor que no tenerlo. |
| 4 | Trial Reels por Zernio + variaciones de hook | **hecho el reel de prueba** (este commit) | `trialParams.graduationStrategy` de Zernio (docs.zernio.com/platforms/instagram/fields) en `cuerpoDelPost`; el interruptor en el piloto de Instagram: «Lo hago solo» = SS_PERFORMANCE (Instagram lo pasa al feed si le va bien), «Lo pasas tú» = MANUAL | Es por NEGOCIO (todos sus reels), no por publicación: marcar uno solo pide una columna en `calendario_eventos` (migración) y el interruptor en el editor del Calendario. Las variaciones de hook quedan como tarea semanal (`propuestasDelPiloto`): grabarlas y publicarlas solas necesita editar video sin el navegador. No lo probé contra Zernio de verdad: el primer reel de prueba hay que mirarlo publicado. |
| 5a | Meta Ads: variaciones del ganador con el mismo copy, ángulo, dolor y avatar | **hecho** (este commit) | \`lib/media-buyer/variaciones-prompt.ts\`: conserva ángulo, dolor, avatar, oferta y promesa; cambia sólo el gancho y la forma (pedía «un ángulo distinto» por variación: lo contrario) | — |
| 5b | Meta Ads: mover presupuesto a horas baratas (dayparting) | **sin empezar** | — | Leer el costo por hora (insights con el desglose por hora) y proponer o aplicar \`adset_schedule\`, que en Meta exige presupuesto TOTAL y no diario: cambiar eso en una campaña viva es un cambio grande. Táctica nueva en \`tacticas.ts\` y \`motor.ts\`, con su interruptor en Configurar. Escribe en Meta: la frase de Martín antes de probarla. |
| 5c | Meta Ads: armar la campaña de retargeting con los públicos que ya existen | **sin empezar** | — | \`lib/retargeting.ts\` mantiene los dos públicos en Meta, pero nada crea la campaña o el conjunto que los usa: un botón «Armar retargeting» con su Deshacer, por \`campana.ts\`. Escribe en Meta: la frase de Martín antes de probarla. |

## En la app (desde el 12/11)

- **Dónde:** `/ads-manager/copiloto`, al lado de `/ads-manager` (que sigue siendo el Media Buyer de siempre): un cliente que hoy opera campañas no cambia de pantalla de un día para el otro. Cuando Martín lo mire, `app/ads-manager/page.tsx` pasa a mostrar el nuevo y el de siempre queda en los tres puntitos («El Media Buyer de siempre»).
- **El molde es el de la maqueta, medido:** `app/ads-manager/copiloto/copiloto-css.ts` sale de la maqueta con `sacar-css.mjs` + `css-a-ts.cjs` (scratchpad de la sesión ea110555): las reglas que tocan algo en cada pantalla, sin el marco de la maqueta. Un cambio de diseño se hace en la maqueta y se vuelve a sacar.
- **Lo que funciona de verdad (12/11, la diecinueve):**
  - **Oferta y comunicación** (`OfertaComunicacion.tsx`, `lib/copiloto/comunicacion*.ts`, `/api/copiloto/comunicacion`):
    - la Oferta son las piezas de la conversación de Offer elegida (`offer_sesiones.piezas`): el check la confirma EN Offer y la nota es la del diagnóstico de Offer (D1-D9);
    - Ángulos y Tu voz se guardan por negocio en `app_settings` (`marketing-copilot.oc.angulos.<conversación>`, `marketing-copilot.oc.voz`, y la oferta elegida en `marketing-copilot.oc.oferta`), sin tocar la base;
    - «Leer mis ángulos / mi voz»: UNA llamada a la IA con la cascada de Offer (las claves del negocio y la red de MaKo: no cobra) sobre lo que el negocio ya tiene en MaKo (su perfil, la oferta y sus documentos, los anuncios de 60 días con agendas y frecuencia, las llamadas analizadas, su voz en los chats, las razones de compra). Lo leído entra «por confirmar» y nunca pisa lo confirmado; la nota la calcula el código;
    - el chat guarda lo que dice la persona con `guardar_comunicacion_copiloto` (API de MaKo), en la oferta elegida.
  - **Anuncios:** los que más resultados trajeron este mes, las tareas de la semana de su funnel y **el piloto de verdad del Media Buyer** («Aprobar» lanza con sus topes, «No» descarta, «Deshacer»); «Configurar piloto» va a sus Ajustes y «Métricas» a la hoja de Marketing.
- **Lo que falta, en el orden de la vuelta 20 (cada uno, una pieza):**
  1. ~~**La vista simple**~~ **hecha el 13/11** (910fa34e4): dos pasos, el análisis arriba y «Lo que te toca» debajo, armado con lo que falta de verdad en cada tarjeta. Falta el calendario (las tareas todavía no tienen fecha: la tienen cuando vivan en el Plan).
  2. **Las tareas en el Plan:** hecho el 13/11 (el Plan no lo llevaba nadie: lo tomé con el OK del Cerebro). `lib/copiloto/tareas.ts` (puro) arma «Lo que te toca» con lo que falta de verdad y dice qué se resolvió; `lib/copiloto/tareas-plan.ts` las crea y las cierra con las funciones del Plan (`agregarTareasPlanOwner` sin IA y `moverPlanTarea` en el tablero del dueño; `crearTarea` y `moverTarea` en el de los clientes), por `/api/copiloto/tareas`. La tarea es del CoPilot por el link de su fuente (`…#copiloto:<clave>`): no hizo falta una columna nueva. Nunca reabre lo que la persona cerró en el Plan. Falta el calendario (las tareas nacen sin fecha; el Plan las fecha después).
  3. **El piloto se configura la primera vez en su pantalla:** hecho para Anuncios el 13/11 (`/ads-manager/copiloto/configurar`, la configuración de verdad del Media Buyer: el gasto del mes y su tope por día, el costo por resultado escrito, cuánto sube por vez en cada campaña y qué hace solo cada táctica). Falta «el anuncio cansado se cambia por uno del stock» (no hay stock: es la nevera de contenido) y el piloto de Instagram, YouTube, la web y la oferta. **Audience Network:** Meta ya no deja sacarlo campaña por campaña desde fines de agosto de 2026 y sí en toda la cuenta (Configuración publicitaria → Controles de ubicación), cosa que MaKo no puede hacer por la API: va como tarea de una vez en Anuncios, no como interruptor del piloto.
  4. **«Con qué número se publica»** un reel de prueba: hecho el 13/11. Spy arma los seguidos y el número (lib/spy-seguidos.ts → promedioDeSeguidos: la mediana de los últimos 20 reels de cada seguido, sin los de menos de una semana, y el promedio entre cuentas); el CoPilot lo muestra en la tarjeta de Instagram y se cambia en la configuración del piloto (lib/copiloto/piloto.ts, app_settings `marketing-copilot.piloto`, /api/copiloto/piloto). La tarea «Selecciona a tus competidores» se cierra sola con el primer seguido. Todavía no hay piloto de Instagram que use el número: hoy es para decidir a mano.
  5. **Web, Instagram y YouTube:** la Web lleva a Web Generator con `?analizar=` (falta dibujar el análisis adentro: `app/web-generator/diagnostico/PanelDiagnostico.tsx` acepta `url`); Instagram y YouTube se conectan (Zernio) pero MaKo todavía no LEE la cuenta propia (perfil, destacadas, publicaciones con métricas, portada): hoy sólo Competitor Spy lee cuentas, por Apify, que cuesta.
  5b. **La Web como análisis:** hecho el 13/11 (lib/copiloto/web.ts): la tarjeta Web lee lo último del Landing Analyst (`landing_analyses`: la nota de 0 a 10, el veredicto y lo más grave con su arreglo), sin volver a pagar la IA; cada arreglo grave es una tarea que lleva a Web Generator con `?analizar=`.
  5c. **La nevera de contenido:** hecha el 13/11 (lib/copiloto/nevera*.ts). Lo listo es lo del Calendario (`calendario_eventos` + su publicación): de hoy en adelante, con archivo y sin salir; lo publicado, lo que confirmó Zernio o se marcó hecho en 30 días; «te alcanzan hasta» el día de la última lista. Con el ritmo que respondió en el CoPilot (`planOrganico`), avisa una tarea por formato y por semana. Lo grabado y no programado no se ve: no hay dónde guardarlo.
  6b. **El retargeting sin VSL:** enganchado el 13/11 (lib/retargeting.ts, del chat «MaKo en la app»). El piloto de Anuncios muestra lo que marcó MaKo en el CRM (no respondieron, no siguieron, no compraron, compraron) y «Pasarlas al CRM» para las charlas sin lead; la configuración prende los dos públicos de Meta. Lo que escribe lo dispara un botón, nunca la carga de la página.
  6. **El piloto de Oferta, Web, Instagram y YouTube:** no existe (el del Media Buyer es sólo de Meta, y su tabla no acepta otras entidades): necesita su propia cola de decisiones.
  7. **La entrada** («¿Por dónde vendes?», «Lo que tienes», «La lectura»): sigue la de siempre (`PrimeraEntrada.tsx`).

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

**Hecho (13/11, vigésima vuelta):** `maqueta-veinte.html` (Artifact claude.ai/artifact/TkiiQTvr375WTgN1AsXF6r), con `aplicar-veinte.mjs` (`bloque-veinte.js`, `css-veinte.css`) sobre la diecinueve. Los cuatro puntos, mirados en fotos (1440 y 375, claro y oscuro) y tocados botón por botón sin errores: dos pasos («Análisis y acción», «Piloto automático»); «Lo que te toca» debajo del análisis, con «En tu Plan» en cada tarea; «Mejorar» abre los desplegables en un popup y lleva al chat de Oferta del Ops Center; el piloto sin configurar dice «Antes de prenderlo, configúralo» y la configuración es una pantalla (no la hoja al costado), con lo del punto 7 de la llamada; «Selecciona a tus competidores» y «¿Con qué número se publica un reel de prueba?».

**Pedido de la vigésima vuelta (Martín, 13/11, por el Cerebro, después de su llamada con Leila).** Decidido por Martín:
1. Análisis y acción juntos, con una vista simple: el análisis arriba y, debajo, las tareas con el calendario.
2. Las tareas viven en el Plan: se crean ahí y completarlas en un lado las completa en el otro.
3. El piloto se configura la primera vez, en la pantalla de configuraciones.
4. Nunca «graduar el reel de prueba»: «con qué número se publica». Sale del promedio de los competidores seguidos (una tarea es «Selecciona a tus competidores»); MaKo lo propone y el usuario lo sube o lo baja.
5. Oferta y Web quedan en CoPilot como análisis (se construyen en el Ops Center, con sus chats Oferta y Funnel Coach, y en Web Generator).
6. La nevera de contenido (cuántos videos, reels e historias hay guardados, cuántos se publicaron, hasta qué fecha alcanzan, y avisos para grabar).
7. El piloto: en anuncios, textos que se entiendan, el costo por agenda escrito, el anuncio cansado del stock, y Audience Network fuera si Meta todavía deja sacarlo; en Instagram, la secuencia de historias con guion y qué grabar, sin «reordenar historias», el número con que se publica y Follow Me ads; en YouTube, miniaturas y títulos, shorts, la descripción con su llamado y las tendencias.
8. CoPilot es el último día del reto de 7 días.

**Hecho (12/11, decimonovena vuelta):** `maqueta-diecinueve.html` (Artifact claude.ai/artifact/FoGXwrRxMJobnPcqFTB2mp), con `aplicar-diecinueve.mjs` (`bloque-diecinueve.js`, `css-diecinueve.css`). Cada desplegable es UNA caja (la cabecera y sus cosas adentro, en filas con una línea; lo que falta con una raya roja dentro de la misma caja), sin las explicaciones de cada grupo, y la cabecera dice lo que falta en una línea («Falta: resultado», o «Faltan 2» si no entra). Y lo primero en la app («En la app», arriba).

**Pedido de la decimonovena vuelta (Martín, 12/11, sobre la dieciocho).** El desplegable abierto «está como todo suelto, flotando»; sin la información de cada grupo («a quién le vendes, qué le duele y qué logra… es texto innecesario»); y «que esté todo preparado para que en producción funcione… el backend… que el piloto automático funcione».

**Hecho (12/11, decimoctava vuelta):** `maqueta-dieciocho.html` (Artifact claude.ai/artifact/3DyGopshnXdMjH2TRo6TA3). Se arma sobre la dieciséis con `aplicar-dieciocho.mjs` (`bloque-dieciocho.js`, `bloque-dieciocho-b.js`, `css-dieciocho.css`); la diecisiete queda como estaba. Mirada en fotos (1440 y 375, claro y oscuro) y tocada botón por botón sin errores.
- **Sin «Formatos».** Oferta y comunicación tiene tres partes: Oferta, Ángulos y Tu voz.
- **En la acción, las tres con el mismo molde que la oferta:**
  - desplegables con lo que hay que completar; cada uno dice en palabras lo que le falta: en rojo si falta, en ámbar si hay que confirmar y en verde si está listo;
  - adentro, una explicación del desplegable y cada cosa con su check, como las tareas de Web;
  - lo que falta va en rojo y dice qué es;
  - lo que sabe MaKo va con su fuente: el PDF, la llamada, el anuncio o el reel.
- **Sin nota en la acción.** La nota es del análisis.
- **El popup de cada cosa, rehecho:**
  - el nombre y su estado;
  - «Qué es»;
  - «Lo que sé», con la fuente y «Ver» (abre la pieza);
  - abajo, «Marcar como listo» y «Completarlo / Confirmarlo / Cambiarlo en el chat».
- **El mismo alto siempre:** el chat y el bloque miden 740 px en las tres partes, aunque se abra otro desplegable (lo de adentro se desplaza). En el análisis, las tres partes miden 660 px por defecto.
- **En el análisis, Ángulos y Tu voz con el molde de la oferta:**
  - «Nota por nota», con las barras del 1 al 10 (9 criterios en cada una);
  - al lado, la nota (41 y 47), lo más flojo, «Mejorar ángulos» o «Mejorar tu voz» y «Lo que leí»;
  - «Mejorar» en una nota abre la acción en esa parte, con el chat en ese punto.
- **Después, sin pedido nuevo (revisando todos los estados):**
  - «Sin nada todavía» también tiene Ángulos y Tu voz, con el molde de borrador de la oferta: los primeros ángulos que arma MaKo con las respuestas y lo que le falta;
  - «8 · Teléfono» estaba en blanco desde la octava vuelta (llamaba a `operacion()`, que pasó a ser la acción). Ahora muestra en el teléfono el análisis, la acción y el piloto de Oferta y comunicación.
  - Sigue de antes: en «Sin nada todavía», la acción de la oferta muestra los datos de Federico.

**Pedido de la decimoctava vuelta (Martín, 12/11, sobre `maqueta-diecisiete.html`).**
1. Sacar «Formatos»: se ve al crear el contenido, y para eso están los outliers de las tabs.
2. Ángulos y Tu voz, con la misma estructura que la oferta: desplegables donde se completa lo que falta. Adentro, que se note lo que falta (más en rojo) y lo que ya está.
3. «46 de 100» parece 46 cosas de 100, no una calificación. En la acción no va la nota: para eso está el análisis.
4. Mejorar el diseño del popup de cada ítem.
5. Al cambiar de parte nunca puede cambiar el alto de las secciones, chat incluido.
6. Como en Web, que cada cosa se pueda marcar «ya está». En cada desplegable, una explicación. «Lo que sé», más referenciado.
7. En el análisis, Ángulos (y Tu voz) rompieron el diseño: tienen que seguir el patrón de la oferta, los desplegables con las barras del 1 al 10.

**Hecho (12/11, decimoséptima vuelta):** `maqueta-diecisiete.html` (Artifact claude.ai/artifact/Nkh7PfEGZcYmZiEhnPceyp). Los cinco puntos de abajo, mirados en fotos (1440 y 375, claro y oscuro) y tocados uno por uno en el navegador sin errores. Lo de los cursos: `docs/marketing-copilot/analisis/comunicacion.md`.
- **«Oferta y comunicación» tiene cuatro partes en los tres pasos:** Oferta, Ángulos, Formatos y Tu voz. Se elige la parte al lado de la oferta (en el análisis) o arriba de la tarjeta (en la acción), y se conserva al pasar de un paso a otro.
- **En el análisis,** cada parte tiene sus filas («Mejorar» suma la tarea a Oferta y comunicación) y, a la derecha, lo importante: tus ángulos con su estado, qué te funciona por tipo de pieza, así hablas.
- **En la acción:**
  - los ángulos, con el dolor que más vende arriba (dolor y ángulo no son lo mismo: con el mismo dolor, gana el ángulo que trae más agendas);
  - los formatos, con «Para empezar, de nicho», los del nicho y los tuyos, y algo nuevo (un formato de otro nicho);
  - tu voz: cómo hablas, tu historia, contra qué estás, lo que muestras, y cuándo no suenas a ti;
  - el chat habla de la parte elegida.
  - Las tareas de comunicación van primero.
- **El bloque de la oferta, rehecho:** sin el medidor ni la barra de 20 rayitas, sin las 20 pastillas juntas. La nota en grande, lo más flojo debajo, y los seis grupos en filas que dicen en palabras lo que falta («Falta resultado», «Confirma 2», «Listo»). Abierto, un grupo muestra sus piezas con lo que sabe MaKo.
- **En el piloto,** lo que MaKo hace con la comunicación: busca ángulos nuevos cada semana, los prueba en reels de prueba antes de pautarlos, mira si una pieza rindió por el ángulo o por el formato, avisa cuando un ángulo se quema y revisa que cada guion suene a ti.
- **«Web»,** sin el «Tu».

Lo que es de ejemplo: los formatos del nicho (4,2×, 3,4×, 2,9×), lo que dicen las llamadas, los reels de prueba y lo que hizo el piloto. Los ángulos, los formatos propios y la voz salen de lo que ya se leyó de Federico: sus reels, sus videos, sus anuncios de ejemplo y los comentarios.

**Pedido de la decimoséptima vuelta (Martín, 12/11, sobre `maqueta-dieciseis.html`).** Las fuentes: `cuerpo-dieciseis.html` + `bloque-diecisiete-*.js` + `css-diecisiete.css`, en el scratchpad de la sesión ea110555.
1. Que MaKo y el CoPilot te ayuden a identificar tus **ángulos** de comunicación: las razones de Jan, las «temáticas hot» de Doglio, el «ángulo ganador» de Cubría. Es lo primero, para cualquier funnel.
2. Después, los **formatos** ganadores (los outliers), y muchas veces ir en contra y crear algo nuevo.
3. Tu **comunicación única**, que construye la marca personal: no tener miedo a ser uno mismo y comunicar como uno habla.
4. **Nada viral en TOFU.** Los primeros reels y anuncios, de nicho; pero de nicho no quita un hook y un formato ganador. Revisar a fondo los cursos de Cubría, Doglio y Carrizo.
5. «Tu oferta» pasa a **«Oferta y comunicación»** y «Tu web», a **«Web»**. En la acción, rediseñar el bloque de la oferta: demasiados botones juntos, y la barra de progreso se confunde con el gráfico de arriba. Ubicar dónde va lo nuevo.

**Hecho (12/11, decimosexta vuelta):** `maqueta-dieciseis.html` (Artifact claude.ai/artifact/XYPQKhQ93158N2VsvzyQbv). Los 5 puntos de abajo, mirados en fotos. Pasar de un paso a otro conserva la tarjeta: del análisis en Instagram, el piloto abre en Instagram.

**Pedido de la decimosexta vuelta (Martín, 12/11, sobre `maqueta-quince.html`).** Las fuentes, en el scratchpad (`cuerpo-quince.html` + `bloque-dieciseis.js`).
1. «Configurar piloto» afuera, como «Volver a analizar» y «Empezar algo nuevo», con la tuerca (no un sol). En los tres puntitos queda «Clases».
2. Al pasar de un paso a otro se conserva la tarjeta elegida: si estabas en Anuncios, sigues en Anuncios.
3. «Tus anuncios»: si hay lugar, salen todos (los 9).
4. «Pregúntale a MaKo», como en el CRM (`app/_ui/BotonMako.tsx`): un círculo blanco con la criatura, sin texto, alineado a la izquierda. Al abrirse se superpone a lo que estás viendo; no corre la tab.
5. Sin «Marketing CoPilot» arriba: la criatura y, al lado, los pasos.

**Hecho (12/11, decimoquinta vuelta):** `maqueta-quince.html` (Artifact claude.ai/artifact/PFrF84h2p99ppmr7orUrct). Martín:
- los pasos 1, 2 y 3, del alto de un botón, arriba;
- «Clases» y «Configurar piloto» en los tres puntitos;
- la tab a todo el ancho de MaKo;
- el chat con MaKo en toda la tab;
- «Tus anuncios» (no «mejores»), con tarjetas más cortas.

**Hecho (12/11, decimocuarta vuelta):** `maqueta-catorce.html` (Artifact claude.ai/artifact/PPjeKD5ut9e4DTXbVjF321). Los 7 puntos de abajo. Cómo se probó que funciona de punta a punta:
- Se tocaron uno por uno todos los botones de cada paso y de cada tarjeta, y lo que abre cada popup: 463 en el análisis y 1.062 en la acción y el piloto. No hubo ningún error.
- Cada `data-accion` escrito tiene su toque. El único sin toque es `escribir`, que es el campo de texto y se atiende al escribir; lo verifica `aplicar-catorce.mjs`.
- «Mejorar» en el análisis suma «Revisa lo que te propuse: …» para hoy en la acción, y el aviso del paso 2 sube (30 → 31).
- «Aprobar» en el piloto la pasa a «Lo que hice», con su dato.

Lo que falta para «todas las variables»:
- Elegir otra cuenta o campaña cambia los datos sólo en anuncios (el tipo de destino).
- En la app, cada elección tiene que filtrar lo que lee el análisis, las tareas y lo que decide el piloto.

**Pedido de la decimocuarta vuelta (Martín, 12/11, sobre `maqueta-trece.html`).** Las fuentes, como en la 13 (`cuerpo-trece.html` + `bloque-catorce.js`).
1. **Sacar «Tu página de compra» del análisis de anuncios:** la web ya se analiza en su paso.
2. **Ningún subtítulo chico debajo de un título, en ningún lugar:** le quita profesionalismo y no se lee.
3. **Tus mejores anuncios:** si hay lugar, las filas van completas antes del botón (8, no 6), y el botón dice «Ver más», no «Ver los 9».
4. **El popup de los reels, los carruseles y los videos:**
   - sin lo que no hace falta de la réplica (abajo del título de YouTube, el canal con «Suscribirse», «Me gusta», «No me gusta» y «Compartir»);
   - abajo va directo el bloque de lo que dice MaKo, con mejor diseño.
5. **El piloto:**
   - «Espera tu OK» no queda chico al lado de un hueco blanco gigante;
   - una sola columna: «Espera tu OK» arriba y «Lo que hice» con «Ver más».
6. **Que todo funcione de punta a punta:** el análisis, la acción y el piloto conectados, teniendo en cuenta todas las variables.
7. **«Métricas» del piloto lleva a la tab Dashboard, con la hoja de esa tarjeta,** en lugar de traer la hoja adentro.

**Hecho (12/11, decimotercera vuelta):** `maqueta-trece.html` (Artifact claude.ai/artifact/XWUpEUoyEBfW3R5f8qrMzh). Los 8 puntos de abajo. Detalles:
- **La portada de YouTube no estaba inventada «de mala fe», pero estaba inventada.** El canal NO tiene portada: el encabezado público no trae `banner`. Se leyó de la página pública el 12/11, con la descripción, «11,4 mil suscriptores • 90 videos», el único link (Instagram), el avatar y el video destacado. Ahora MaKo marca la falta de portada como «Arreglar».
- **La app todavía no trae la portada.** Spy y YouTube leen la API sin `brandingSettings` (`image.bannerExternalUrl`), así que la portada hay que sumarla a esa lectura.
- **Los anuncios siguen de ejemplo,** pero ya son nueve. El identificador de la biblioteca también es de ejemplo.
- **La página de compra y el formulario** son dibujos de ejemplo (no se leyeron), marcados así.
- **El relevo de las hojas del Dashboard** está en `docs/marketing-copilot/rediseno/relevo-dashboards.md`.

**Pedido de la decimotercera vuelta (Martín, 12/11, sobre `maqueta-doce.html`).** Las fuentes de la maqueta están en el scratchpad de la sesión (`cuerpo-doce.html`, `bloque-doce.js`, `css-doce.css`, `aplicar-doce.mjs`, `armar.mjs`); las hojas del Dashboard se dibujan con `herramientas/ssr-hojas.mts`.
1. **Análisis, anuncios:** el bloque «Tu página de compra» quedó viejo y no se parece a lo demás. Hay que ponerlo al día, y lo mismo en los otros lugares que hayan quedado así.
2. **Tus anuncios ganadores, como en la biblioteca de anuncios:** la tarjeta y el popup. Que sean más de 3.
3. **Instagram:** las pestañas Publicaciones, Reels y Etiquetadas no acompañan el scroll.
4. **YouTube:**
   - la portada se extrae siempre del canal, nunca se inventa;
   - el diseño de la portada, la descripción y lo demás tiene que verse exactamente como YouTube.
5. **La acción de la oferta:** «Tu nota» y «Tu oferta» en una sola tarjeta, para que la nota no quede suelta abajo. Rediseñar «Tu oferta» más lindo, sin copiar tal cual la de Offer, que rompe con el diseño.
6. **El tacho siempre a la derecha de todo.**
7. **Un relevo de las hojas y los gráficos del Dashboard:** si sirven, qué falta y qué sobra.
8. **Las hojas que se rompieron:** la de VSL y YouTube se ve aplanada.

**Hecho (12/11, duodécima vuelta):** `maqueta-doce.html` (Artifact claude.ai/artifact/PTjztn9WovQssXfKxYHVtj). Los 14 puntos de abajo. Y lo que Martín pidió a mitad de la vuelta, mirando el calendario:
- sin los botones de cada área (ya están las tarjetas de arriba);
- sin «Mes / Agenda» («¿cuál es la diferencia?»): sólo el mes;
- arriba, a la izquierda, «Hoy», las flechas y el mes; a la derecha, «Checklist / Calendario»; sin «Te tocan N»;
- «Clases» en los tres pasos.

Un día con más de 4 tareas: «N más» abre ese día, como en Google Calendar.

Lo que no salió de un dato de verdad, marcado «de ejemplo» en la maqueta:
- los carruseles y sus láminas;
- la portada de YouTube;
- los shorts (son sus reels);
- el piloto;
- los números de las hojas del Dashboard (los de su plantilla).

**Pedido de la duodécima vuelta (Martín, 12/11, sobre `maqueta-piloto.html`).** El cuerpo de partida es `cuerpo-once.html`, en la carpeta de la maqueta del scratchpad; se arma con `armar.mjs`, y cada vuelta es un `bloque-*.js` + `css-*.css` + `aplicar-*.mjs`.

1. **Análisis de Instagram como Instagram de verdad:**
   - las historias se abren tocando la foto de perfil (con el aro), no como tarjetas;
   - la bio y las destacadas, copiadas del diseño real de Instagram;
   - se puede tocar cada publicación y cada reel.
2. **«Cada cuánto publicas QUÉ»:** reels, historias y carruseles por separado.
3. **El popup de cada pieza, mejor:**
   - el carrusel, con sus láminas para deslizar y el feedback adentro;
   - el de YouTube, rehecho, que hoy es feo.
4. **YouTube como YouTube:**
   - Inicio, Videos y Shorts que se cambian y se recorren;
   - la portada del canal, con su feedback (si no tiene, o si no tiene que ver con lo que se recomienda).
5. **Sacar «Tu estrategia»** de los tres canales: queda ambigua.
6. **Anuncios:**
   - el VSL sin conectar es un reproductor grande vacío, con los botones para conectar;
   - los mensajes sin conectar son un chat vacío, con «Conectar».
7. **La acción de la oferta:**
   - la checklist grande que ya tenía Offer (garantía, escalera de valor, etc.);
   - sin «Hacerlo», porque lo hace el chat.
8. **La acción de la web:**
   - cada sugerencia con un tacho para descartarla;
   - «Hacerlo» pegado a la derecha;
   - sin «Copia una que funciona»;
   - el chat de MaKo en el mismo lugar que las tareas, con un cambio entre chat y tareas (como en otras partes de la app); «Hacerlo» le manda el mensaje a ese chat.
9. **El calendario de la acción** copia el diseño del calendario que ya tiene la app.
10. **Cada tarea** (en la checklist o en el calendario) abre un popup que la explica.
11. **El piloto automático:**
    - una lista larga de TODO lo que puede hacer MaKo en cada canal (web, oferta, anuncios, Instagram, YouTube), con decisiones basadas en datos: cambiar el hook de un reel, probarlo en reels de prueba, etc.;
    - en «Lo que hice», la criatura de MaKo en lugar de cada punto.
12. **Elegir sobre qué se trabaja, en los tres pasos:** qué oferta, qué web, qué campaña y para qué oferta (en anuncios), y qué cuenta (en Instagram y YouTube). Hoy sólo la oferta tiene el desplegable en la acción.
13. **Terminar «Métricas»** trayendo las plantillas del Dashboard (anuncios, Instagram, YouTube, web), y revisar que todo esté bien.
14. **Un botón visible de «Clases» (o «Classroom»):** Martín va a grabar clases de cómo hacer una buena oferta, una buena landing, cada funnel (Instagram, YouTube, anuncios) y cuándo hacer cada cosa.

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

- **La masterclass de «temáticas ganadoras» de Doglio no la tenemos:** es un recurso enlazado de ARCADIA que nunca se bajó (`C:/cursos/arcadia/recursos.json`, sin URL ni archivo). Si Martín la tiene, se baja y se transcribe. Lo que se usó en su lugar: `docs/marketing-copilot/analisis/comunicacion.md`.
- **Dolor y ángulo, en el código:** hoy no existen. Las razones de compra están en `lib/razones.ts` y los outliers en Competitor Spy. Para hacerlo de verdad, cada pieza necesita su ángulo y su formato, y cada venta, su primer y su último contacto.
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
