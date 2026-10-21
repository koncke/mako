# Hallazgos — Second Brain (el grafo del negocio)

El mapa de lo que MaKo entendió del negocio del cliente: `lib/cerebro-grafo.ts` (qué nodos
hay), `lib/cerebro-layout.ts` (dónde va cada uno), `lib/cerebro-modelo.ts` (la forma) y
`app/second-brain/Grafo.tsx` (el dibujo).

## Lo que más muerde acá

0. **«Se ve parecido» no es verificable, y dos veces seguidas el dibujo pareció bien y
   estaba mal.** Antes de tocar el grafo, correr `node scripts/medir-grafo.mjs <html>`.
   [→](#las-doce-métricas-que-deciden-si-se-parece)

1. **El diagnóstico obvio era el equivocado: el problema no era el motor de dibujo, eran
   los datos.** [→](#un-árbol-no-se-dibuja-como-una-red-por-más-física-que-le-pongas)
2. **Las dos razones para no usar un force layout son falsas**, y costaron una versión
   entera. [→](#las-dos-objeciones-al-force-layout-que-no-se-sostienen)
3. **d3-force es determinista pero siembra por ÍNDICE del array** — insertar un dato en el
   medio le cambia el mapa a todo el mundo, sin que nada avise. [→](#es-determinista-pero-siembra-por-índice-y-eso-alcanza-para-arruinarlo)
4. **`onWheel` de React no puede `preventDefault`** en react-dom 19: el zoom anda y la
   página scrollea al mismo tiempo. [→](#onwheel-de-react-no-puede-frenar-el-scroll)
5. **`opacity: 0` en SVG no ahorra nada.** [→](#opacity-0-en-svg-cuesta-lo-mismo-que-dibujarlo)
6. **`var(--mono)` no está definido** en ningún `:root`, y se usa 38 veces. [→](#varmono-no-existe-y-se-usa-38-veces)
7. **Un solo `<Grafo>` no es un solo cerebro.** El 17/10 había uno y se veían dos nubes; el que mide es «desde la raíz se
   llega a todo». [→](#el-código-decía-uno-y-se-veían-dos-ningún-cerebro-se-divide-en-dos-20102026)

---

## El link de un cliente abría la lista del CRM, y el test lo fijaba así (20/10/2026)

Lo encontró el chat de CRM. Código: lib/cerebro-vivo.ts (el nodo `cliente:<id>`) · tests/second-brain-links.test.ts.

- **Síntoma:** tocar un cliente en el Second Brain y «Abrir» llevaba a la lista del CRM, no a su ficha.
- **Causa:** el nodo linkeaba `/crm?lead=<id>` y /crm no lee `lead` (sus searchParams son `funnel` y `embudo`). La ficha es
  /crm/<id> (app/crm/[id]), la misma ruta que escribe todo el CRM; no hay una función única que la arme.
- **Por qué nadie lo vio:** el test del grafo vivo FIJABA el link roto (`'/crm?lead=500'`). Copiaba lo que devolvía el código
  en vez de mirar qué lee la pantalla de destino. Un test así nace verde y protege el bug.
- **Regla:** un link se prueba contra su DESTINO. El barrido mira cada `href` de lib/cerebro-*.ts: la ruta existe en app/
  y, si lleva `?param=`, la página lo declara en el tipo de sus searchParams. Medido el 20/10: el único roto era éste;
  `?oferta=`, `?funnel=`, `?hoja=`, `?centro=` y `?chat=` los leen sus pantallas.
- **Trampa del barrido:** sólo ve los `href:` escritos como texto en lib/cerebro-*.ts. Un link armado en otro archivo, o
  con una función, no entra.

## El código decía «uno» y se veían dos: ningún cerebro se divide en dos (20/10/2026)

Martín: «El Second Brain de SuperAdmin ya te había pedido que no se dividiera en 2... En ningún caso jamás los cerebros se
deben dividir en 2» (lo había pedido el 17 y el 18). Código: lib/cerebro-union.ts, lib/cerebro-union-servidor.ts,
lib/second-brain-opera.ts, lib/cerebro-grafo.ts, lib/cerebro-construccion.ts · tests/second-brain-un-cerebro.test.ts.

- **Síntoma:** en el Second Brain del super admin, el negocio a un lado y la construcción de MaKo al otro, separados. En el
  teléfono, un «Negocio · Construcción» que cambiaba un grafo por otro.
- **Por qué el código decía «uno»:** el 17/10 se cambiaron dos `<Grafo>` por uno, y el test contaba `<Grafo` = 1. Pero
  `unirCerebros` devolvía un `Cerebro` con DOS raíces, sin ninguna arista entre ellas (el comentario decía «a propósito»), y
  ponía la nube de la construcción AL LADO de la del negocio, con un 18 % de aire. Un componente de React, dos cerebros.
- **No era sólo el super admin (el diagnóstico obvio se quedaba corto).** Medido en producción: el negocio del ws 9 tenía 3
  pedazos y el del ws 3 (Cliente de Prueba), 2. Los racimos sin aristas laterales (la voz sin el quiz, por ejemplo) flotaban
  aparte, y una nota de cerebro-grafo.ts decía «NO ES UN BUG» porque un puente había subido el hub a 4,6×. La construcción
  también se partía: con pocas áreas, una carpeta de una familia no se dibuja y la raíz queda sola.
- **Regla:** lo que se mide es la CONECTIVIDAD, no la cantidad de componentes de React: desde UNA raíz se llega a todos los
  nodos. Todo racimo suelto se engancha a la raíz por su nodo más estructural (`puentesARaiz`: carpeta, si no área, si no el
  más conectado), ANTES del layout. La construcción cuelga de la raíz del negocio (`PUENTE_OBRA`) y la física corre ENTERA
  en el servidor (`acomodarUnido`); poner dos nubes ya asentadas una al lado de la otra se lee como dos cerebros aunque haya
  una arista entre ellas.
- **El hub no se rompió:** con los puentes, ws 9 da 3,4× y ws 3, 2,4× (umbral 4,5×). El 4,6× de antes era de otro armado.
- **La física de todo junto cuesta:** 203 nodos, 655 ms medidos. Se guarda el último acomodado (`cerebroUnido`) y se reusa
  mientras la huella no cambie; si cambia, se parte de las posiciones de antes.
- **Trampa de la ruta:** el grafo vivo (`/api/second-brain/cerebro`) vuelve a pedir el cerebro cada 3 minutos. Si manda sólo el
  negocio, la construcción desaparece del grafo del super admin a los 3 minutos. Las tres puertas (pantalla, teléfono, ruta)
  piden el mismo `cerebroQueSeDibuja`. `quienOpera` se mudó a lib/second-brain-opera.ts porque una ruta no puede importar una
  página (pagina.tsx la reexporta).
- **«Exportar» sigue bajando sólo el negocio:** `soloElNegocio` saca del unido los nodos de las diez áreas.
- **Sin hacer:** en el unido del ws 9 la raíz queda adentro de la nube de la construcción (180 nodos contra 22 del negocio) y el
  negocio es un racimo al costado, conectado. Si Martín lo quiere en el centro, es una fuerza propia para la raíz en
  lib/cerebro-layout.ts (ojo: clavarla dibujaba un asterisco). Y producción no tiene la columna `archivero_files.origen`
  (mig 0316): cada armado del grafo lo avisa en el log.

## El grafo en el teléfono: el Mapa era una foto, y UN solo grafo para el super admin (17/10/2026)

Feedback de Martín (Android, Chrome): «no puedo clickear en nodos, o nada»; que se vea apaisado con la barra lateral con scroll; y
«en SuperAdmin no pongas 2 grafos, todo 1 solo». Código: app/second-brain/{Grafo,VistaCerebro,FiltroMapa}.tsx, apaisar.ts,
lib/cerebro-union.ts, app/m/second-brain/SecondBrainM.tsx · tests/second-brain-grafo-movil.test.ts.

- **El diagnóstico obvio era el equivocado: no había un bug de toque, el grafo no existía en el teléfono.** LAS MISMAS RUTAS reescribe
  `/second-brain?panel=mapa` a `/m/second-brain/mapa`, y esa página dibujaba `MapaChico`: una foto con SMIL, sin un solo evento
  (y `/admin/operaciones` cae en `/m/operaciones`). Ante un reporte del teléfono, lo primero es ver QUÉ pantalla sirve el teléfono
  (lib/movil-rutas.ts), no leer el componente de escritorio. Ahora el Mapa abre el MISMO `<Grafo>` a pantalla entera
  (`VistaCerebro movil`, un portal a `#m-root` para tener los tokens `[data-m]`) y la foto es el botón que lo reabre.
- **Con el dedo, tres cosas del grafo de escritorio estaban mal para un teléfono:** la tolerancia de 5 px (la rodada del pulgar ya era
  un arrastre y el nodo no se fijaba: 10 px con `pointerType === 'touch'`); arrastrar sobre un nodo movía el NODO (con 44 px de blanco por
  nodo, en un mapa denso no había por dónde panear: con el dedo siempre se panea); y mantener apretado abre el menú del navegador
  (`contextmenu`). El `mouseenter` que el teléfono emite después de tocar dejaba el nodo resaltado como si hubiera cursor.
- **Apaisado:** `screen.orientation.lock('landscape')` SÓLO funciona en pantalla completa, y ésta pide un toque: por eso es un botón
  («Girar la pantalla») y no algo automático al abrir. Pisa la rotación automática apagada del sistema. iOS no lo soporta y ahí queda el
  layout vertical (la barra como hoja desde abajo). **No se dibujó el lienzo rotado con CSS** a propósito: el paneo (`escala` en
  `onPointerMove`) calcula con los ejes de la pantalla y se rompería. La barra lateral apaisada es un corte
  `(orientation: landscape) and (max-height: 640px)` que va DESPUÉS de los de 1100 y 720 px (misma especificidad, gana el último).
- ⚠️ **SUPERADO el 20/10/2026** ([ningún cerebro se divide en dos](#el-código-decía-uno-y-se-veían-dos-ningún-cerebro-se-divide-en-dos-20102026)):
  dos nubes lado a lado se leían como dos cerebros. Queda como registro de lo que se pensaba.
- **UN solo grafo = dos nubes ya asentadas, una al lado de la otra, no un layout nuevo.** El de la construcción cuesta segundos (4,4 s con
  ~180 nodos); unirlos de nuevo en cada vuelta del grafo vivo sería lo mismo. Sin arista entre las dos raíces (una arista tiene que
  significar algo verificable, y el super admin puede estar mirando el negocio de un cliente). La raíz de la construcción pasa a `n1:obra`
  (`raiz` choca). Las capas NO son una cuarta dimensión del filtro: son un atajo que marca todas las carpetas de la capa
  (`filtroDeCapa`), así `pasaFiltro`, el «N de M» y «Exportar» siguen hablando de carpetas; una capa entera cuenta como UN filtro.
  «Exportar» baja sólo el negocio (`filtroDelNegocio`): mirando sólo la construcción no hay nada que bajar, y un filtro vacío
  bajaría todo el negocio.
- **Dos escritores de la misma clave de `localStorage`:** el teléfono guardaba los ids vistos del negocio y el grafo guarda los de las
  dos capas; sin sumarlos, cada vez que se abría el grafo los nodos de la construcción volvían a ser «nuevos» y viajaban.
- **Sin hacer / sin ver:** nada de esto se vio en un Android real ni apaisado (los tests miran el código y la lógica pura); falta
  probarlo en producción con Chrome de Android, en vertical y apaisado, y con el super admin. La lista del teléfono
  (`SecondBrainM`) conserva su selector «Negocio / Construcción» (son listas, no grafos; `ConstruccionM`). «Editar» desde el grafo
  del teléfono cierra el grafo y abre la hoja del área con una demora de 350 ms: cerrar el grafo consume su entrada del historial con
  `history.back()` asíncrono y una hoja que hiciera su `pushState` antes se cerraría sola.

**Vive en:** app/second-brain/Grafo.tsx · app/second-brain/VistaCerebro.tsx · app/second-brain/FiltroMapa.tsx ·
app/second-brain/apaisar.ts · lib/cerebro-union.ts · lib/cerebro-filtro.ts · app/m/second-brain/SecondBrainM.tsx · *2026-10-17*

### El «Negocio» se arma con lo que MaKo SABE hoy, no con huecos fijos (18/10/2026, segunda punta)

Martín: los nodos del «Negocio» (el del super admin como el de cualquier workspace) «se deben siempre ajustar a lo que MaKo sepa...
no tengas miedo en quitarle nodos o agregarles; si les falta info ya la irán completando». Código: lib/cerebro-vivo.ts,
lib/cerebro-grafo.ts · tests/second-brain-negocio-vivo.test.ts.

- **Se agregaron las dos fuentes de la venta que el grafo no leía:** los CLIENTES (un lead con la venta ganada: la definición de
  lib/clientes-ganados.ts) y las REUNIONES de venta que el Closing Analyst ya leyó (`closing_analyses`, `status='analizada'` y
  `category='venta'`). Clientes: UN nodo «N clientes» con el total exacto (`count: 'exact'`, no los que se leyeron) y los 8 más
  recientes colgados de él, y él de los leads. Reuniones: las 6 más recientes, cada una del cliente que terminó comprando o, si no, de
  los leads. Sin datos no hay nodo; una lectura que falla no tumba el mapa (`.catch`); una venta nueva entra sola con el grafo vivo.
- **Se quitó la estructura fija de huecos:** hasta hoy cada sección sin un dato dibujaba un `falta:<área>` colgado de la raíz (once
  casillas iguales para todos los negocios). Ahora lo que falta se DICE (el dato «Todavía sin info» de la raíz y el «falta» de cada
  sección en la barra lateral, con su «Editar») y no se dibuja. `vacias` sigue en el modelo (el ZIP lo usa). El filtro «Sin completar»
  sólo se ofrece si hay algo sin completar.
- **La excepción que este archivo ya conoce, aplicada de antemano (NO medida con clientes reales):** los clientes y las reuniones no se
  cuelgan además del nodo de área del funnel (`realesPorArea`). Colgar los 15 le subiría el grado hacia el de la raíz, y el hub tiene
  tope en scripts/medir-grafo.mjs (4,5×): es la misma excepción que ya tienen las etapas de nutrición. Lo fija un test sobre el
  constructor; falta medir el grafo con datos reales.
- **Sin hacer / sin ver:** el constructor corre contra la base y no hay forma de armarlo sin ella en un test, así que lo nuevo se probó
  con datos armados a mano (`agregarLoVivo`) y mirando el código del constructor; falta ver el grafo con datos reales (un workspace con
  clientes y reuniones leídas) y correr `node scripts/medir-grafo.mjs` sobre él. Las reuniones que no pasaron por el Closing Analyst
  (una grabación de Fathom sin leer, un evento de agenda) no entran: no son algo que MaKo SEPA todavía.

## El texto pegado en el chat: un documento, no un mazacote (17/10/2026, tarjetas #848, #864 y #884)

`lib/chat-pegado.ts` (las reglas), `app/_chat/PegadoHilo.tsx` (la tarjeta y la burbuja plegada), las dos cajas
(ChatSecondBrain.tsx y app/m/mako/Composer.tsx), los dos hilos (HiloMako.tsx y ChatMako.tsx) y el turno.

- **#848: el diagnóstico obvio (la CSS rota) era el equivocado.** Reproducido sin la app, con 400 renglones: la página
  NO se desborda a lo ancho (la burbuja y la caja ya cortaban y tenían tope), pero la burbuja medía **24.474 px** de
  alto: el chat entero pasaba a ser el pegado. Ahora el pegado es una tarjeta (100 px) y lo escrito largo se pliega
  con «Ver todo» (249 px).
- **Cómo se reproduce un problema de layout sin levantar la app:** `renderToString` del hilo (con un stub de `.css`), las
  tres hojas reales (globals, centro.css, chat.css) en un HTML, y Chrome headless con `--dump-dom`; un script de la
  página mide (`getBoundingClientRect`) y escribe el resultado en el DOM. Cuesta ~300 MB, no 4 GB.
- **El pegado viaja marcado DENTRO del mensaje** (`[[texto pegado]]…[[/texto pegado]]`), no como archivo: los adjuntos
  del chat son fotos y PDF validados por sus bytes que van al modelo como documento (lib/mako-adjuntos.ts); un .txt no
  entra en ese camino. Así se guarda en el hilo como siempre y se vuelve a partir al releerlo.
- **El turno cortaba el mensaje en 8.000 caracteres (`TOPE_MENSAJE`)**, y con un pegado largo se perdía la marca de cierre:
  el hilo habría mostrado el pegado crudo. El corte ahora respeta las marcas (`recortarMensaje`): lo escrito hasta 8.000,
  los pegados con su propio tope (12.000, el historial viaja con los últimos 12 mensajes) y un aviso en el que se cortó.
- **#884: El Archivero recibe el pegado ENTERO** (de `entrada.mensaje`, antes del corte), como documento de texto, y le saca
  los datos como a cualquier otro: entra al grafo como `doc:`. Sólo del admin y sólo con `guardarAdjuntos` (el MaKo
  Analyst de un lead usa el mismo turno y lo que se pega ahí es del lead), igual que los PDF.
- **En el teléfono `app/_chat/chat.css` no se carga** (tampoco para ArchivosHilo, que ya se veía sin estilo): la pieza nueva
  importa su hoja. Y una `<p>` en /m lleva el margen del navegador (no hay reset): `.ch-plegable > p { margin: 0 }`.
- **Lo que quedó SIN hacer:** la caja del Ops Center (ChatDelCentro, AdjuntosCaja, en app/admin/operaciones) puede usar
  las mismas piezas; es de ese chat. Y «lo que se charla se guarda solo»: la charla ya es un nodo del grafo (`chat:`),
  pero escribir el perfil del negocio sin confirmar sigue con la tarjeta de siempre (un dato mal deducido de una charla
  pisaría uno bueno sin que nadie lo vea).

## Que el grafo sirva a los chats: la vista local y lo que ahorra, medido (17/10/2026, punto 13c)

`lib/cerebro-recuperar.ts` (puro): el ÍNDICE (carpetas y áreas con su conteo, una línea y ejemplos con id) y la VISTA
LOCAL (semillas de la pregunta + vecinos a un salto, una línea por dato, con presupuesto de tokens). Por la API de MaKo:
`indice_segundo_cerebro` y `recuperar_del_segundo_cerebro` (`GET /negocio/segundo-cerebro/indice|recuperar`), gratis y
con la puerta del Second Brain. La medición: `scripts/medir-recuperacion.ts`.

- **Lo medido (ws 3 y ws 9, sólo lectura, 17/10/2026):** la vista local promedia **190 y 118 tokens** por pregunta, contra
  **678 y 459** del grafo entero en líneas (lo que hoy manda la búsqueda con MaKo a la IA: −72 % y −74 %) y **1.606 y
  1.105** del vault (lo que devuelve `leer_segundo_cerebro_como_archivos`: −88 % y −89 %). El índice, ~300 tokens, una vez
  por chat. Los dos workspaces son CHICOS (25 y 18 datos): la vista cuesta lo que pide la pregunta y no crece con el grafo,
  así que en un negocio de 70 datos el ahorro es mayor. El ws 1 no se midió, a propósito (el script lo rechaza).
- **La búsqueda del grafo no sirve tal cual para una pregunta.** `matchNodo` pide TODAS las palabras de la consulta en el
  mismo nodo: «¿cuánto cobro por la mentoría?» no matchea nada nunca. La vista puntúa palabra por palabra (3 en el
  nombre, 1 en el detalle), saca las palabras vacías y deja los números cortos («el avatar 3»).
- **El puente que en GraphRAG hacen los embeddings, acá es un mapa chico de sinónimos** («cobro», «precio», «vendo» →
  la oferta y los productos; «leads», «etapa» → el funnel). Ningún nodo dice «cobro»; sin el puente, la pregunta más
  común del dueño no encontraba su oferta. Sin IA: recuperar no cuesta un token de modelo.
- **La línea de un vecino tiene que ser corta.** Con la línea larga para todos (cada nodo con sus vecinos), la pregunta de
  los leads costaba **708 tokens contra 678 del grafo entero**: cada etapa repetía la cadena de las otras. Las semillas
  van completas y los vecinos en una línea con sangría, sin sus vecinos y con dos datos (603 en el ws 3).
- **Medir fuera de Next** pide `--conditions=react-server` (si no, `server-only` revienta al importar) y el `.env.local`
  del clon principal (los worktrees no lo tienen; apunta a PRODUCCIÓN, por eso el script no escribe). `listLeads` es una
  lectura cacheada de Next y afuera no lee: en la medición falta el nodo de los leads; en producción está.
- **El detector de voseo mira TODO el repo, también una lista de palabras vacías en lib/** (`tests/puente-panel-copy.test.ts`, «ninguna
  pantalla del repo le habla al cliente de vos»): «decime» y «mostrame» en la lista de `VACIAS` lo pusieron en rojo en el
  `antes-de-subir`. Si un detector de lo que escribe el usuario necesita nombrar el voseo, va en `FUERA_DE_ALCANCE` de
  ese test con el porqué; acá alcanzó con sacarlas.
- **Sin RAM para el build parcial, una prueba de humo sí entra:** `renderToString` en Node de la pantalla (VistaCerebro,
  el Grafo de la construcción, ConstruccionM) con `require.extensions['.css'] = () => {}` precargado. Caza los errores de
  EJECUCIÓN que el tsc no ve. `--conditions=react-server` acá NO va: rompe `react-dom/server`.
- **Lo que quedó SIN hacer:** que el turno de MaKo pida nodos en vez de mandar el contexto entero. Hoy
  `buildSystemPrompt` (lib/mako-context.ts) va en modo completo en cada mensaje (8-11 kB, `lib/agente-contexto.ts`). Es un
  cambio del turno de MaKo, no del grafo: las dos operaciones ya están para que lo use.

## La construcción de MaKo, como segunda capa del super admin (17/10/2026, punto 13b)

`lib/cerebro-construccion.ts` (puro) arma el grafo de las áreas con bitácora, sus últimos hitos y los chats jefe;
`lib/cerebro-construccion-datos.ts` lo junta del registro de /admin/dev. Reemplaza a `MapaAreas.tsx` (borrado);
`/admin/dev` lleva a `/admin/operaciones?panel=mapa&capa=construccion`.

- **El mismo componente dibuja los dos grafos: lo que cambia es la TAXONOMÍA.** `NodoCerebro<A>` y `Cerebro<A>` son
  genéricos (el default es `AreaId`, así que el código del negocio no cambió) y el grafo trae `taxonomia` (carpetas y
  áreas con su color). Grafo.tsx pinta, agrupa, navega y filtra con ella (`rellenoNodo(n, tax)`, `pasaFiltro(n, f, tax)`,
  `agruparConexiones(…, tax)`); el filtro de secciones, el editor y «Exportar» son sólo del negocio (`esNegocio`).
- **El hub, medido con el registro real (56 áreas):** con los hitos adentro del racimo de su familia daba 14,8× (el tope
  de `scripts/medir-grafo.mjs` es 4,5×); con los jefes adentro, 6,5×. El racimo es sólo de las ÁREAS; un hito cuelga de su
  área y de su chat, un jefe de las áreas donde anotó. Quedó: 176 nodos, 16 % de hojas, hub 4,0×, densidad 1,63, una
  sola isla.
- **El layout de ~180 nodos cuesta segundos** (4,4 s medidos con la máquina cargada; ~100 nodos del negocio, décimas).
  Las bitácoras viajan en el build y no cambian entre deploys: la capa se guarda armada 10 minutos en memoria.
- **Un chat jefe es un TÍTULO** (`claveDeNombre`, la misma clave del Centro), con la ventana del Centro (14 días) y dos
  hitos o más: con 30 días y un hito eran 48 jefes, la mitad de un solo hito.
- **«Comparten código» no cuenta los archivos que están en todas** (más de 6 áreas): `lib/workspace.ts` une todo con todo
  y no dice nada. Con dos archivos o más en común quedan 19 aristas laterales, las que sacan al mapa de la forma de
  estrella.
- **La fecha de un hito va en la hora de Argentina con su desfase** (`isoDeHito`): la fecha corta sale del texto, y un
  hito de las 22:30 escrito en UTC caía al día siguiente.
- **La guarda es la del Centro, sin copiarla**: `puedeOperar(getSesionAdmin(), wsSuperAdmin())` adentro de `quienOpera()`
  (app/second-brain/pagina.tsx), que usa también el teléfono. `mapaDelSecondBrain()` no cambió de firma a propósito: la
  página del Ops Center la llama así y `tests/second-brain-chat.test.ts` lo mira con un regex sobre un archivo que es del
  Ops Center.
- **«Dev» en la barra de admin ahora cae en el grafo.** La barra de Dev (las 122 áreas, `familiasDev`) sigue apareciendo
  en `/admin/dev/<área>`, que es a donde lleva cada nodo («Abrir en su bitácora»).

## Lo que el negocio TIENE, como nodos, y el nodo que viaja (17/10/2026, punto 13a)

`lib/cerebro-vivo.ts` (puro) suma ofertas, lead magnets, funnels, leads, objetivos/KPI y chats; las lecturas van en el
mismo `Promise.all` de `construirCerebro`. El diseño: `docs/diseno-second-brain-grafo.md`.

- **«Los gráficos del negocio» no son las hojas del Dashboard.** Esas viven en `graficos.tablero.<persona>`
  (`lib/graficos-tablero.ts`): son la vista de cada persona, no un dato del negocio. Lo que el negocio se propuso medir
  son los objetivos y los KPI (`objectives`, `kpis`, los números de /general): ésos entran.
- **Dos fuentes para el Lead Magnet.** El editor del área (`EntregableView`) escribe `mako.entregable` (nodos `ent:`);
  Offer escribe la tabla `lead_magnets` (mig 0169). Los dos entran; si uno se llama igual que otro, es el mismo.
- **Los roles de `oferta_productos` son `principal`, `bump` e `incluido`** (mig 0169), no «bono/upsell» como sugiere la
  pantalla de Offer.
- **Las listas de siempre no traen `created_at`** (`listarOfertas`, `listarFunnels`, `listObjectives`…). El `nace` sale
  de una lectura chica por tabla (`id, created_at`, en paralelo: `fechasDeAlta`). Lo que no tiene fecha va `null`: las
  claves de `app_settings` (avatares, razones, fase) sólo tienen `updated_at` y no se inventa un nacimiento.
- **Los chats con MaKo son de la PERSONA, no del negocio.** Los pasa sólo la pantalla (`lib/cerebro-chats.ts`); el ZIP y
  la API arman el grafo sin ellos. Un chat se cuelga de lo que NOMBRA su título (la búsqueda del grafo al revés: el
  título es el pajar y el nombre del nodo la consulta); los que no nombran nada van juntos en un nodo.
- **`toLocaleString('es')` no agrupa los números de cuatro cifras** (`minimumGroupingDigits: 2` del español): la misma
  pantalla decía «USD 1500» y «USD 12.000». El punto de miles va a mano (`miles`, `lib/cerebro-vivo.ts`).
- **Una fecha que se dibuja en el servidor y en el navegador sale del TEXTO, no de `toLocaleDateString`**: con la zona
  horaria del servidor, un dato de las 23 h caía en otro día (aviso de hidratación y una fecha que salta).
  `fechaCortaNodo` (`lib/cerebro-areas.ts`).
- **El bucle de dibujo dependía de `posiciones`, y con un grafo VIVO eso rearma el mapa entero.** Mientras el grafo
  llegaba una vez daba igual; con la pantalla pidiéndolo cada 3 minutos, cada vuelta reiniciaba el reloj de la entrada y
  todo volvía a nacer desde afuera. Ahora el bucle arranca al montar y las posiciones nuevas DESLIZAN lo que ya estaba
  (`deslizarRef`, 800 ms). La física de arrastre se rearma con el grafo nuevo (cachea los radios).
- **El nodo que viaja necesita saber qué vio la persona**, y eso es una comodidad de quien mira: `localStorage`, con una
  huella del negocio y el `?ws=` en la clave (`claveVistos`). La primera vez no viaja nada (`nuevosDesde` da `null`):
  hacer viajar el grafo entero como si todo fuera nuevo sería un desfile.
- **En el teléfono el viaje es SMIL, no CSS.** Cada punto sale de su propio lugar del borde, y un `var(--dx)` por punto no
  es un token de la casa: `tests/m-second-brain.test.ts` exige que cada `var()` exista en app/globals.css.

## La pantalla sólo dibuja el grafo: oscuro, la barra lateral, y nada abajo (17/10/2026)

Feedback de Martín del 17/10, puntos 11 y 12. El diseño entero está en `docs/diseno-second-brain-grafo.md`.

- **«Nada aparece abajo» NO es borrar lo de abajo.** Debajo del grafo vivía `AreasHub`, y desde el 15/10 es el ÚNICO
  lugar donde se editan las diez secciones del negocio (lo que era el hub de `/onboarding`; `lib/secciones-negocio.ts`
  → `DONDE_SE_EDITA`, y los `?area=` de otras pantallas caen ahí). Lo que molestaba era que **tocar un nodo** lo abría
  (`irA` llamaba a `onAbrirArea(n.area, false)`). Quedó: tocar sólo fija; el editor se abre con «Editar» de la barra
  lateral o con un `?area=`, en un `Modal` ENCIMA del grafo. Con `contenedor`: adentro de la Matriz se abren otros
  modales, y sin eso la pila apaga la caja y con ella al que se acaba de abrir (pantalla en blanco, sin error).
- **Una función no viaja del servidor al grafo, pero el contexto sí.** El grafo lo arma el servidor
  (`mapaDelSecondBrain`, `app/second-brain/pagina.tsx`) y llega como un nodo ya renderizado a `ChatSecondBrain`. El
  «volver a los chats» de la ventana angosta no puede ser una prop de `VistaCerebro` (sería una función cruzando la
  frontera): se la da la pantalla por `VolverDelGrafo` (`app/second-brain/volver.ts`). Funciona porque `VistaCerebro` es
  un componente de cliente que React monta ADENTRO del árbol de `ChatSecondBrain`, aunque lo haya creado el servidor.
- **El oscuro fijo es `data-tema="oscuro"` en la raíz, más el fondo escrito.** Los tokens se dan vuelta en cualquier
  caja (app/globals.css); sin `background: var(--bg)` se ve el fondo claro del panel de atrás. En el teléfono el tema de
  la PWA es del shell (`app/m/_ui/ShellM.tsx`): el grafo es una ISLA oscura con el título adentro, y las listas siguen el
  tema de la persona.
- **El alto del lienzo ya no sale del viewport.** El `clamp(…100svh - 280px…)` existía para dejar asomar las tarjetas de
  abajo; con la pantalla entera para el grafo, el alto sale del padre (una columna flex) y la fila de la grilla es
  `minmax(0, 1fr)` — con `auto`, el SVG empuja y el panel crece en vez de recortar.
- **Los controles flotan con `pointer-events: none` en la barra y `auto` en sus hijos.** Si la barra entera recibe el
  puntero, la franja de arriba del lienzo deja de panear.
- **«El otro grafo de la construcción» no era un grafo.** Los dos candidatos: `/admin/dev` (`MapaAreas.tsx`) monta la
  barra (`BarraPreview`) con las 122 áreas y sus trampas, sin nodos ni aristas; «App viva» es una nota de memoria, no una
  pantalla. El único otro grafo de verdad es graphify (`/api/admin/graph`), que es el del CÓDIGO y se queda. Lo que se
  depreca es `/admin/dev` como foto de la construcción, cuando la capa «Construcción» del grafo la reemplace (13b).
- **La regla de agrupar y el tipo viven en `lib/cerebro-areas.ts`** (`agruparConexiones`, `tipoDeNodo`): la barra lateral
  y la hoja del teléfono dicen lo mismo con la misma función (`tests/second-brain-grafo.test.ts` falla si el teléfono
  agrupa por su cuenta).

## «Entender el pedido» en el chat central: el link no demora la respuesta ni se cuelga de otra (17/10/2026)

Tanda 10 de la etapa 2. Martín: «que el chat le deje ahí el link para ir a donde corresponde». Debajo de la respuesta de
MaKo van los «Ir a …» de lo que la persona pidió y se hace en otra pantalla (`POST /api/mako/pedidos` con `tab: 'mako'`).

- **El diagnóstico obvio era esperar los links junto con el turno.** La ruta tarda segundos (la IA corta a 7,5 s) y el
  turno decenas, así que casi siempre llegan antes. Pero cuando el turno contesta rápido, la respuesta quedaría
  esperando a los links. Ahora se piden en paralelo, la respuesta se dibuja apenas llega y los links se cuelgan después.
- **«El último mensaje de MaKo» era el lugar equivocado para colgarlos.** Como llegan después, para entonces la persona
  pudo haber escrito otra cosa y MaKo haberle contestado. Se cuelgan de la respuesta a SU mensaje: el último de MaKo
  entre el mensaje de la persona (por su id) y el siguiente de ella (`colgarIrA`, lib/chat-mako-reglas.ts, con test).
- **El mensaje no se parte.** En un editor, lo de otra tab se saca del mensaje. En el Second Brain no hay nada abierto, y
  todo sería «otra tab» (ya estaba escrito en `linksDePedidos`). MaKo contesta el mensaje entero y esto sólo suma el link.
- **Los links no se guardan**: son de esta sesión de la pantalla. Al recargar, la respuesta vuelve sin ellos.
- **La PII la resuelve la ruta**: con datos personales en el texto, la IA gratis de la plataforma no se usa
  (`llevaDatosPersonales`, lib/mako-pedidos-ia.ts).

**Vive en:** app/second-brain/ChatSecondBrain.tsx (`linksDelPedido`) · lib/chat-mako-reglas.ts (`colgarIrA`,
`linksDePedidos`) · app/_chat/HiloMako.tsx (los chips, compartido con los chats de cada tab) · tests/chat-mako-reglas.test.ts
· tests/second-brain-centro.test.ts

## Los adjuntos del chat se guardan: tres llamadores, un turno, y El Archivero que MUEVE (16/10/2026)

Tanda 4 de la etapa 2 (docs/diseno-mako-ai-native.md). Pedido de Martín: «los adjuntos se guardan en el archivero».

- **`turnoApp` tiene TRES llamadores, no dos.** El Second Brain y el teléfono, sí, pero también el MaKo Analyst de un
  lead (`/api/crm/analyst` → `turnoDelLead`). La primera versión guardaba y archivaba para todos: el PDF de un LEAD
  (su contrato, su propuesta) iba a El Archivero del negocio y `answersConDocumento` pisaba el perfil con sus datos.
  Lo cazó la revisión adversarial, no un test. Ahora guardar es una opción de quien llama (`guardarAdjuntos`), y sólo
  la prenden `/api/mako/chat` y `/api/m/mako`.
- **`registrarDocumentoSinPisar` MUEVE su origen, no lo copia.** «Se hace cargo del binario»: al volver, el archivo
  quedó en `<ws>/<id>` o se borró. Si el chat le pasaba su propio adjunto, la miniatura se rompía. Le va una COPIA
  (`<ws>/chatdoc/<uuid>`), y cada uno es dueño de lo suyo: el del chat se va con la conversación, el de El Archivero
  con su pantalla. Sólo el PDF del ADMIN: El Archivero alimenta el perfil del negocio.
- **El plazo de lo que corre en `after()` se mide desde que EMPEZÓ el pedido.** Con fotos (visión, ~52 s cada una) leer
  los archivos lleva minutos. Contado desde después, el plazo pasaba el `maxDuration` y la función podía morir con
  el binario ya movido y sin su fila.
- **Un `<img src>` no pasa por el `fetch` de la casa** (WsFetch): el `?ws=` va a mano con `conWs`. Sin él, el super
  admin mirando un cliente pide el archivo en SU workspace y no lo encuentra.
- **La pantalla nunca ve el path.** Ve `<id del mensaje>:<n>`, y la ruta busca el path de nuevo, mira de quién es la
  conversación y firma 300 s. El path de la base se sanea (`esRutaDeChat`) antes de firmarlo o borrarlo.
- **Un test de una regex necesita un caso hecho SÓLO del alfabeto permitido.** Un uuid aflojado a `[0-9a-f./-]+`
  pasaba todos los casos malos, porque todos tenían una letra fuera del hexa («x», «.jpg»). Lo cazan `3/chat/..` y
  `3/chat/abc`.
- **Pegar desde Excel o Word trae texto Y una imagen.** Interceptar los archivos del portapapeles sin mirar si hay
  `text/plain` le robaba el texto a la persona.
- La migración 0305 sólo agrega, y el código la tolera ausente: sin la columna el mensaje se guarda sin bloques y el
  binario se borra en el acto.
- **El número de una migración lo da el Cerebro, no un barrido.** Salió como 0303 después de recorrer todas las ramas
  y los worktrees: estaba libre en todos. Pero 0303-0304 estaban RESERVADAS para el Image Editor, sin archivo en
  ningún árbol, y la 0299 del plan ya era de Video Editor. Quedó 0305.

**SIN HACER:**
- `chart_sessions.previa` (la segunda línea de la barra), que pedía el plan: no se hizo.
- El teléfono no tiene vista previa local de los archivos mientras salen: muestra los nombres hasta que vuelven.
- Tandas 7 a 10: está la parte de servidor, falta la pantalla. Detalle en docs/relevo/centro-operaciones.md.

**Vive en:** `lib/chat-mako-bloques.ts` (puro) · `lib/chat-mako-adjuntos.ts` · `lib/chart-chats.ts` · `lib/mako-turno-app.ts`
(`guardarAdjuntos`, `urlDeAdjunto`) · `app/api/mako/chat/route.ts` · `app/_chat/ArchivosHilo.tsx` ·
tests/chat-mako-bloques.test.ts, tests/second-brain-chat.test.ts (dieciséis roturas)

## «Pregúntale a MaKo» es el Second Brain: la clave se queda, y lo de antes se lee (16/10/2026)

Tanda 2 de la etapa 2 (docs/diseno-mako-ai-native.md).

- **La entrada de la barra cambió de nombre, no de clave.** Se llama «Second Brain», lleva a `/second-brain` y su clave
  sigue siendo `mako`. De esa clave cuelgan el chat del teléfono, la bandeja (`/mako/pendientes`), Inbox y la puerta
  del chat (`puedeVerKey('mako')`): cambiarla los apagaba a todos, sin un error.
- **Una entrada por persona.** Al admin que ya ve «Second Brain» en Analyze, el Sidebar no le dibuja la de abajo.
- **El título de la pestaña ahora lleva la marca** («MaKo - Second Brain»): «Pregúntale a MaKo» ya la traía en el
  nombre y por eso no la sumaba. No es un bug.
- **«Antes»: los chats de /mako, de sólo lectura**, con SU regla de quién ve qué: el admin, los del workspace; los demás,
  los suyos (lib/chat-mako-indice.ts, la regla de chart-insights). Son de un chat sin herramientas: no se continúan, se
  sigue en uno nuevo. `/mako` y `/mako-doer` redirigen con `rutaConWs`.
- **La API lee los chats de la persona sin que la persona sea un parámetro.** `listar_chats_mako` y `hilo_chat_mako`
  (canal `app`) toman la conversación del turno de su clave de canal (`app:<id>`), y de ahí la base `mako-movil:<persona>`
  de su `chart_key`. Un `id` de otra persona no existe. Así no hizo falta sumar la persona al `Ctx` de todas las
  operaciones.

**SIN HACER:**
- Retirar `/api/mako-doer`: su única pantalla era `MakoDoerTab`, que se fue. `tests/mako-doer-plazo.test.ts` todavía
  lo nombra.
- ~~En el teléfono, la fila «Second Brain» (el chat) y la del Mapa son dos.~~ Hecho en la tanda 3: ver
  [hallazgos-mobile.md](hallazgos-mobile.md), «El Second Brain del teléfono es el chat con MaKo».

**Vive en:** `app/_components/nav.ts` (`MAKO_NAV`) · `app/_components/Sidebar.tsx` · `lib/chat-mako-indice.ts` ·
`lib/api-mako/areas/mako.def.ts` · `app/mako/page.tsx`

## El Second Brain es un chat: dos puertas, y el Mapa sólo cuando se pide (16/10/2026)

**El pedido.** Martín, por el coordinador: «Termina con todo, faltan mis pedidos del Second Brain»; la etapa 2 de
`docs/diseno-mako-ai-native.md`. Primera tanda: `/second-brain` pasa a ser el chat con MaKo, con la cara del Centro de
Operaciones (barra de chats, conversación, caja con micrófono, la tarjeta que se confirma), y el grafo es «Mapa».

- **Dos puertas, las dos en el servidor.**
  - **El chat es de todos los que tienen MaKo** (closer y setter incluidos): `requireRolWs(['closer', 'setter'], { nav: 'mako' })`,
    la misma clave del chat del teléfono.
  - **El Mapa es del admin con la tab en su capa**: `esAdminDeTab('second-brain')` (`lib/puerta-admin-tab.ts`), la MISMA
    regla de las rutas del Second Brain, sin una copia. A quien no le toca no se le calcula.
- **El Mapa se calcula sólo cuando la URL lo pide** (`?panel=mapa`, o un `?area=` de los links de siempre).
  `construirCerebro()` son 21 lecturas, y el chat no las necesita para el primer dibujo.
- **La ruta del chat no puede ir en `app/api/second-brain/`.** Esa carpeta es sólo del admin por test
  (`tests/puerta-admin-tab.test.ts`), y un closer recibiría 403. Va en `app/api/mako/chat`, con la puerta de MaKo
  (`personaDelRequest`).
- **El jefe «Second Brain» son las conversaciones del teléfono** (`mako-movil:u<id>`): no hubo nada que migrar.
  - El jefe es la MÁS VIEJA, y las demás son sus sub-chats. Con la más reciente, el jefe saltaba de fila cada vez
    que se escribía en otra.
  - Un chat nuevo se crea con el primer mensaje, no al apretar «Nuevo chat».
- **Los sub-chats heredan el muñeco del jefe sólo si el jefe está en `EQUIPO`** (`lib/centro-munecos.ts`). Sin
  esa entrada, cada sub-chat salía con una forma y un color distintos. «Second Brain» es la gota.
- **Trampas del entorno que muerden a cualquier pantalla de acá:**
  - la capa superadmin tiene `userNavKeys: null`, así que pasa `requireCapa` con cualquier clave, pero el Sidebar
    no le dibuja la entrada;
  - la capa `pm` no tiene `second-brain`: ve el chat y no el Mapa.

**Vive en:** `app/second-brain/page.tsx` · `app/second-brain/ChatSecondBrain.tsx` · `app/api/mako/chat/route.ts` ·
`app/_chat/` · `lib/chat-mako-reglas.ts` · `tests/second-brain-chat.test.ts` · `tests/chat-mako-reglas.test.ts`

## Las doce métricas que deciden si se parece

**Síntoma.** Se rehace el grafo con d3-force, se mira, parece una nube. El dueño lo mira y
dice «sigue viéndose como un árbol». Dos rondas seguidas.

**Causa.** El ojo no distingue una nube de un anillo con ruido. Los números sí: la mediana de
distancia al centro daba **237** y el parámetro `anclaRadio` valía **230** — todo estaba
sentado sobre una circunferencia, y encima repartido en diez cuñas (11 de 36 sectores
angulares vacíos). Nada de eso se ve mirando; todo se ve midiendo.

**Regla.** `node scripts/medir-grafo.mjs <pagina.html>` antes y después de cualquier cambio.
Las que más mienten al ojo:

| Métrica | Umbral | Qué delata |
|---|---|---|
| CV del radio | ≥ 0,35 | si es bajo, es un **anillo** disfrazado de nube |
| Bins angulares vacíos | ≤ 4 de 36 | si es alto, hay **cuñas**: quedó radial |
| Hojas de grado 1 | ≤ 30% | un borde de hojas es **topología**, no física |
| Hub máx/medio | ≤ 4,5× | un hub grande dibuja un **asterisco** |
| Clustering | ≥ 0,15 | sin triángulos no hay **racimos** |
| Gris uniforme | **≥ 85%** | Obsidian es monocromo — ver abajo |

**Dos umbrales que escribí al revés la primera vez**, y valen como advertencia: puse «color
dominante ≤ 55%» cuando lo correcto es lo contrario (**≥ 85% del mismo gris**, porque en
Obsidian el color marca excepciones); y medí el hub como «% de nodos» cuando lo que importa
es la razón contra el grado medio. Un umbral mal puesto es peor que ninguno: da el visto
bueno a lo que está mal y suspende lo que está bien.

**Vive en:** `scripts/medir-grafo.mjs`

## El layout

### Un árbol no se dibuja como una red, por más física que le pongas

**Síntoma.** Se construye el grafo, se ve un organigrama radial. Se cambia a un layout de
fuerzas para que se parezca a Obsidian y sale… un diente de león. La sensación es que falta
calibrar las fuerzas, y no falta.

**Causa.** `cerebro-grafo.ts` emitía **una arista entrante por nodo**: 39 nodos, 38 aristas,
cero ciclos, ~20 aristas colgando de la raíz. Eso es un árbol con un hub. Los racimos de
Obsidian **emergen de enlaces laterales** —notas que se citan entre sí—; sin ellos no hay
topología que agrupar y cualquier simulación devuelve una estrella.

Lo que faltaba no había que inventarlo, ya estaba en los datos y se estaba tirando:
`RazonCelda.anguloImagen` y `.anguloVideo` guardan el id de un formato REAL, y se estaban
concatenando al texto del `detalle` en vez de dibujarse. Esa es la arista que cruza de un
segmento a otro (dos avatares distintos pueden elegir el mismo formato). Con eso más los
planos del panorama apuntando al dato del que hablan: **42 nodos y 51 aristas**.

**Regla.** Antes de tocar el renderer, medir `aristas.length > nodos.length − 1`. Si no se
cumple, es un árbol y ningún parámetro de física lo va a salvar. Y el corolario general: la
arista tiene que significar algo verificable — si no se puede escribir el `motivo` en una
frase, no va.

**Vive en:** `lib/cerebro-grafo.ts` (el bloque «LAS ARISTAS LATERALES») · `lib/razones.ts:47`

### Las dos objeciones al force layout que no se sostienen

La primera versión evitó la simulación por tres razones. Dos son falsas, y conviene que
queden refutadas por escrito o la próxima sesión las repite:

- **«Tiembla para siempre».** No. d3 baja `alpha` con `alphaDecay = 1 − 0.001^(1/300)` y el
  loop se corta en `alphaMin = 0.001`. Y acá ni siquiera se enciende el timer: `.stop()` y
  después `.tick()` a mano, así que el resultado es estático por construcción. Obsidian hace
  exactamente lo mismo — su worker se auto-agenda solo mientras `alpha > 0.001` (~300 ticks
  ≈ 5 s) y su renderer se apaga a los 60 frames sin cambios.
- **«Es aleatorio».** No en d3-force v3. El único azar es `jiggle`, y usa un LCG de **semilla
  fija** creado por simulación (`src/lcg.js`), no `Math.random`. Verificado con un test que
  pisa `Math.random` y comprueba que el dibujo sale idéntico. El mito viene de v1/v2.
- **«d3 muta los objetos que le pasás».** Esta **sí** es cierta, y es la regla que gobierna
  `cerebro-layout.ts`: se le pasan copias planas desechables de nodos **y aristas**.
  `forceLink` además reemplaza los strings `source`/`target` por referencias al objeto nodo,
  así que sin copiar, la segunda corrida recibe una entrada distinta a la primera.

**Vive en:** `lib/cerebro-layout.ts` · `tests/cerebro-layout.test.ts`

### Es determinista, pero siembra por ÍNDICE — y eso alcanza para arruinarlo

**Síntoma.** El usuario sube un documento al Archivero y su mapa entero cambió de forma. No
falló nada.

**Causa.** `initializeNodes()` solo inventa posiciones si vienen `NaN`, y cuando las inventa
usa una espiral de filotaxis indexada por la **posición en el array**
(`radius = 10·√(0.5+i)`). Insertar un nodo en el medio corre la semilla de todos los
posteriores.

**Regla.** Sembrar `x`/`y` **antes** de simular, derivados de un hash del `id` (los ids ya son
estables: `doc:<uuid>`, `campo:oferta_nombre`, `raz:<uuid>`…), y alrededor del ancla de su
**área**, para que un nodo nuevo nazca en su barrio en vez de cruzar el mapa mientras se
acomoda.

Y una segunda capa que hace falta igual: **ordenar los arrays por id antes de simular**. El
orden cambia el orden de acumulación en el quadtree, y la suma de floats no es asociativa —
el desvío medido era de 0,5 px, invisible pero real, y suficiente para que el test de
determinismo falle. Ordenar lo cierra.

**Vive en:** `lib/cerebro-layout.ts` (`semilla()` y el `.sort()` de `layoutCerebro`)

### Agrupar por categoría con fuerzas ES volver al radial

**Síntoma.** Se saca el layout radial, se pone d3-force, y el resultado sigue leyéndose como
sectores.

**Causa.** Se conservó un `forceX`/`forceY` hacia un ancla POR ÁREA (`strength 0,08`,
`radio 230`), pensando que mantendría los racimos juntos. Diez anclas repartidas en círculo
son diez imanes en un anillo: la simulación hace exactamente lo que se le pidió. Medido, la
relación pico/valle de densidad por corona daba 4,5× con 0,08 y **seguía en 4,2× con 0,04** —
bajar la fuerza no compra nada, porque el problema es la geometría de las anclas, no su
intensidad.

**Regla.** Obsidian tiene **una sola** fuerza posicional: `forceX(0)/forceY(0)` al ORIGEN con
strength 0,1. Los racimos emergen de la topología. Si hacen falta racimos por categoría, la
solución no es una fuerza: es **meter la categoría como NODO** y unir sus miembros a ella —
que es lo que hace Quartz con los tags. El racimo lo produce `forceLink`, gratis, y como sale
de la topología no deja anillos ni cuñas. Efecto medido acá: hojas 47,6% → 2%, densidad
1,21 → 1,74, clustering 0,09 → 0,15, bins vacíos 10 → 3, CV del radio 0,30 → 0,39.

**Vive en:** `lib/cerebro-layout.ts` (`RECETA.centro`) · `lib/cerebro-grafo.ts` (el bloque
«Las ÁREAS como nodos»)

### En Obsidian el color significa «esto es una excepción»

**Síntoma.** El grafo se ve como un muro de oro y no se parece a Obsidian por más que la
física esté bien.

**Causa.** Se usó el color para codificar la autoría de cada nodo — dorado si lo dedujo MaKo,
gris si lo escribió el usuario — y como MaKo deduce casi todo, **37 de 42 nodos quedaban
dorados**. En Obsidian pasa lo contrario: `getFillColor()` cae en `--graph-node` (un único
gris, `--text-muted`) para **toda** nota normal, y el color solo aparece en el nodo activo, un
tag, un adjunto o un link roto. Incluso los seis «grupos de color» configurables tienen
fallback CSS al mismo gris hasta que el usuario elige uno a mano.

**Regla.** El color codifica **excepciones, no categorías**. Acá quedaron tres nodos de color
sobre cincuenta: la raíz, el Norte y el cuello. La autoría no se perdió — vive en el panel
lateral y en la ficha del nodo, que es donde se pregunta por ella. Y de paso desactiva sola la
alarma del antipatrón «cripto o casino»: el dorado vuelve a significar algo.

Dos corolarios del mismo `app.css`, que también estaban al revés:
- **El nodo es un círculo PLANO**: sin borde, sin sombra, sin gradiente, sin punteado. El
  «todavía no existe» de Obsidian es el mismo círculo relleno con `opacity: 0.5`, no un aro.
- **La arista NO es translúcida**: va a alpha 1 y lo que la hace tenue es el color, a dos
  escalones del fondo (#3f3f3f sobre #1e1e1e). Un gris claro bajado de opacidad se ve lavado.
  De ahí sale el token `--sidebar-line`.
- **La etiqueta no tiene halo** ni contorno ni bold, y van TODAS: el fade es por zoom
  (`clamp(log2(k)+1, 0, 1)`), que a zoom 1 vale 1. Mostrar 13 de 42 era otra cosa distinta.

**Vive en:** `app/second-brain/Grafo.tsx` (`rellenoDe`) · `app/globals.css` (`--sidebar-line`)

### Los parámetros SON el dibujo

Cambiar `alphaDecay` de 0,022764 a 0,0228 —1,6·10⁻⁴ de diferencia— corre nodos 10 px;
ponerlo en 0,04 los corre 253 px. Enfriar más rápido **no es «menos convergido», es otro
layout**. Por eso viven juntos en `RECETA`, versionados, y la versión entra en la huella.

Dos que no son obvios: `forceCenter` **no se usa** (mueve `node.x` directo en vez de la
velocidad y pelea con los nodos pineados — 46 px de deriva medidos); y el `strength` de
`forceLink` se deja en el default `1/min(grado)`, que en una topología con hub ya evita solo
que las aristas de la raíz aplasten el centro. Pisarlo es el error clásico.

**Vive en:** `lib/cerebro-layout.ts` (`RECETA`)

---

## El dibujo

### `onWheel` de React no puede frenar el scroll

**Síntoma.** El zoom funciona y la página scrollea al mismo tiempo.

**Causa.** react-dom 19 registra `wheel`, `touchstart` y `touchmove` en el contenedor raíz
con `{ passive: true }`. Un handler pasivo no puede llamar a `preventDefault()`.

**Regla.** `ref.current.addEventListener('wheel', h, { passive: false })` en un `useEffect`,
con su `removeEventListener` en el cleanup. Más `touch-action: none` en el `<svg>` para el
táctil, que es CSS y decide antes de que el listener exista.

**Vive en:** `app/second-brain/Grafo.tsx`

### El transform del zoom no puede ser un prop

**Síntoma.** El mapa salta hacia atrás en momentos aparentemente aleatorios.

**Causa.** Si el `transform` se escribe con `setAttribute` (para no re-renderizar a 60 fps)
**y además** se pasa como prop de JSX, el próximo render de React lo pisa con el valor viejo
del vdom.

**Regla.** O una cosa o la otra, nunca las dos. Acá: `setAttribute` dentro de un `rAF`, y a
`useState` va solo `kPaso` (la escala redondeada a cuartos), que cambia ~15 veces en todo el
recorrido del zoom en vez de 60 por segundo.

**Vive en:** `app/second-brain/Grafo.tsx`

### `opacity: 0` en SVG cuesta lo mismo que dibujarlo

Medido con 1.000 etiquetas: visibles 38,4 ms/frame · `opacity=0` **38,0 ms** ·
`visibility:hidden` 33,9 · `display:none` 12,4 · fuera del DOM 9,8.

**Regla.** La etiqueta que el nivel de detalle apaga **no se renderiza** (render condicional).
Copiar el fade de Obsidian/Quartz literal deja el costo intacto: ellos pueden porque su
renderer es PixiJS y una textura con alpha 0 se saltea el draw.

**Vive en:** `app/second-brain/Grafo.tsx` (el `useMemo` de `etiquetas`)

### `var(--mono)` no existe, y se usa 38 veces

**Síntoma.** Un texto que se escribió para verse monoespaciado se ve con la tipografía normal,
y nadie lo nota porque no rompe nada.

**Causa.** `--mono` está definido **solo** dentro de `.cono` (`app/conocimientos/CursoPortal.tsx`).
En cualquier otro lado `var(--mono)` no resuelve y cae al font heredado, en silencio.

**Regla.** Para mono, importar `MONO` de `app/_ui/tokens.ts`. Las 38 apariciones de
`var(--mono)` fuera de `.cono` son deuda: la que se toque, se corrige.

**Vive en:** `app/_ui/tokens.ts:19` · `app/conocimientos/CursoPortal.tsx:435`

---

## La física viva del cliente

### Reponer las fuerzas del servidor para arrastrar rearma el mapa solo

**Síntoma.** Se agrega arrastre con el patrón canónico de d3 (`alphaTarget(0.3).restart()`)
y el mapa se mueve **58 px de mediana a los 120 ticks sin que nadie toque nada**; 83 px a los
300; y al soltar no vuelve (72 px de deriva final).

**Causa.** Un layout parado en `alphaMin = 0.001` **no está en equilibrio de fuerzas**: sigue
cayendo, 300 veces más lento. Reinyectarle alpha lo hace correr otra vez. Bajar el
`alphaTarget` mitiga y no cierra (0,05 todavía deja 20 px).

**Regla.** La simulación del cliente es **otra receta**, en `app/second-brain/fisica.ts`, y
tiene exactamente dos fuerzas: `forceCollide(60).strength(0.7)` y un **resorte a su casa**
(`forceX/forceY` hacia la posición que mandó el servidor, `strength 0.30`). **Sin
`forceManyBody` y sin centro**, que son las que rearman el mapa. Con eso nace en reposo
exacto (0,00 px al despertarla) y todo vuelve a su lugar en ~1 s.

El diagnóstico obvio —«usá el drag de los ejemplos de d3»— es el equivocado.

Y al soltar, `fx/fy` van a `null`: el nodo **no** queda clavado donde lo soltaste. Es lo que
hace Obsidian, y acá es más importante todavía, porque la posición *significa* algo (la
calculó el servidor con la topología): dejarla movida sería mentir.

**Vive en:** `app/second-brain/fisica.ts`

### Una animación CSS sobre `transform` le gana al `transform` que escribe JS

**Síntoma.** Se agrega la flotación y los nodos dejan de responder a la física: quedan
clavados. Sin error, sin warning, y **el mapa parece vivo porque flota**.

**Causa.** En la cascada, las declaraciones de una animación están por encima de los estilos
de autor normales, incluido el inline y el `setAttribute`.

**Regla.** Un dueño por grupo, anidados: el de afuera lleva la **posición** (la escribe la
física), el del medio la **flotación** (CSS), el de adentro el **pop** de entrada (CSS).

**Vive en:** `app/second-brain/Grafo.tsx` (`cbg-flota` / `cbg-pop` / `cbg-cuerpo`)

### Sobre el lienzo oscuro solo hay dos tokens de color usables

Contraste WCAG sobre `--sidebar` #14161B, contra el gris base `--sidebar-text` (6,55:1):
`--on-sidebar` 16,6 · `--mako-lite` 11,8 · `--mako` 9,5 · `--primary-weak` 9,4 · **`--good`
5,2 · `--bad` 4,3 · `--primary` 4,0 · `--warn` 3,6**.

**Regla.** Todo lo que esté por debajo de 6,55 se lee como **menos** importante que un nodo
normal: un nodo «marcado» con `--primary` se ve menos que uno sin marcar. Sobre superficie
oscura el azul de MaKo es **`--primary-weak`**, que es el par simétrico de `--mako-ink` (que
existe por el motivo inverso, dorado sobre fondo claro).

Y bajo deuteranopía (~6% de los hombres), medido con la matriz de Viénot: **`--mako` y
`--warn-fill` colapsan en el mismo color** (1,14:1). Hoy es tolerable porque son dos nodos de
cincuenta, separados por posición y etiqueta. **No se puede agregar una tercera clase dorada
o naranja.**

### El color de Obsidian es opt-in y viene apagado

Sus seis slots `.graph-view.color-fill-1…6` valen `var(--text-muted)`: **el mismo gris que un
nodo normal**. El sistema está cableado entero y no pinta nada hasta que el usuario define un
grupo — y el grupo lo define una **consulta**, no una categoría del esquema.

**Regla.** Monocromo por defecto, color opt-in, con tope. Acá quedó un solo grupo
(«Resaltar lo que escribiste tú», `--primary-weak`). Las diez áreas **no** reciben color: ya
están resueltas por topología (el nodo de área) y por el filtro del panel.

### El parser del panorama descartaba 5 de 6 secciones, y solo en un workspace

**Síntoma.** El grafo del workspace del dueño tenía 1 nodo de panorama en vez de 6, y las
cuatro aristas laterales de `PANORAMA_APUNTA_A` tampoco se disparaban.

**Causa.** `seccionesPanorama()` buscaba seis títulos **literales** con `indexOf`. El panorama
ya guardado de ese workspace lo escribió una versión anterior con otro molde
(`# DESCRIPCIÓN DEL NEGOCIO`, `# AVATAR`, `# DOLORES`, `# NICHOMERCADO`): coincidía uno solo.

**Regla.** El comentario decía «el generador GARANTIZA que las seis están». Es cierto para lo
que se genere de ahora en más, **no para lo que ya está en la base**. Un parser que lee datos
históricos parte por estructura (encabezado) y mapea sinónimos, nunca por literales.

**Vive en:** `lib/cerebro-grafo.ts` (`seccionesPanorama`, `PLANO_CANONICO`)

### El drag nativo del navegador se come el paneo

**Síntoma.** «Al hacer clic, en lugar de desplazarse, parece que intenta agarrar una imagen.»

**Causa.** Tres a la vez: (1) arrastrar sobre un nodo o una etiqueta dispara el
drag-and-drop **nativo**, que muestra el fantasma y cancela los pointer events; (2) el
`setPointerCapture` estaba sobre `e.target` —el `<circle>`— y el primer re-render de React lo
reemplaza, así que la captura se pierde a mitad del gesto; (3) `onPointerLeave` cortaba el
arrastre al salirse del borde con el botón apretado.

**Regla.** `user-select: none` + `-webkit-user-drag: none` + `preventDefault` en `dragstart`,
la captura **sobre el SVG**, y sin `onPointerLeave` (con la captura bien puesta, el puntero no
«sale»). Obsidian hace lo mismo en una línea: `interactiveEl.addEventListener('mousedown', e => e.preventDefault())`.

**Vive en:** `app/second-brain/Grafo.tsx`

### `setPointerCapture` retargetea los eventos, y el `onClick` del nodo no dispara nunca

**Síntoma.** Se agrega el arrastre y deja de poder hacerse clic en un nodo para fijarlo y leer
su detalle. No hay error: el clic simplemente no pasa nada.

**Causa.** `setPointerCapture` sobre el `<svg>` redirige **todos** los eventos siguientes —
incluido el `click` — al elemento que capturó. El `onClick` del `<circle>` deja de recibirlos.
Y la captura sobre el `<svg>` es correcta y necesaria (sin ella el paneo se corta: ver arriba),
así que no se puede revertir.

**Regla.** Con captura de puntero, el clic se resuelve en el **`pointerup`**: si el gesto no
superó el umbral de arrastre, es un clic, y se sabe sobre qué elemento empezó porque se guardó
en el `pointerdown`. Cualquier `onClick` de un hijo del elemento que captura es código muerto.

**Vive en:** `app/second-brain/Grafo.tsx` (`soltar`)

### Una flotación chica no se lee como flotar: se lee como que el texto tiembla

**Síntoma.** Los nodos «flotan mal», y sobre todo el texto: se ve tembloroso y sucio.

**Causa.** Con una amplitud de ~2 px de pantalla, el desplazamiento es sub-pixel y el navegador
**re-rasteriza la tipografía en cada frame**. Eso no se percibe como movimiento, se percibe
como ruido.

**Regla.** Dos cosas juntas: amplitud suficiente para que el movimiento sea intencional (acá
16 unidades de mundo, ~8 px de pantalla, con períodos de 7,1 s y 11,3 s), y `will-change:
transform` en el grupo que se anima, que lo promueve a su propia capa del compositor — así el
texto viaja como una imagen en vez de redibujarse. Sin lo segundo, subir la amplitud mejora
pero no limpia.

**Vive en:** `app/second-brain/Grafo.tsx` (`cbg-flota-x` / `cbg-flota-y`)

### Un radio de colisión grande es seguro SI dura solo el gesto

La regla de arriba dice que el radio de colisión del cliente no puede superar la separación
mínima en reposo (37) o la colisión pelea contra la casa para siempre. **La excepción es el
nodo que se está arrastrando**: mientras dura el gesto tiene `fx/fy`, así que no se mueve él —
mueve a los demás. Al soltar vuelve a su radio normal y todos regresan. Por eso
`colisionRadioArrastre` puede ser 150 sin romper nada, y es lo que hace que el mapa se abra al
paso del nodo en vez de empujar solo al que tiene pegado.

### La paleta del grafo no puede salir de los tokens semánticos

Los `--grafo-*` de `app/globals.css` existen porque sobre `#14161B` los semánticos de la app
quedan **por debajo** del gris base de un nodo: `--primary` 3,98:1, `--good` 5,24, `--bad`
4,25, contra 6,55 de `--sidebar-text`. Un nodo «marcado» con ellos se ve *menos* importante
que uno sin marcar. La paleta del grafo es claro-desaturada y se distingue por **tono**, no por
brillo. Diez es el techo: pasada esa cantidad una paleta cualitativa deja de leerse.

### La trampa que llega con la simulación viva: el hover que no se apaga

Cuando el grafo se mueve debajo de un cursor quieto, **`pointerout` no se dispara nunca** y el
nodo queda resaltado para siempre. Obsidian lo resuelve recalculando el hover **por frame**,
por distancia. Hoy acá no muerde porque durante el arrastre el resaltado es el nodo
arrastrado (el mismo `dragNode || highlightNode` de Obsidian), pero cualquier movimiento
autónomo que se agregue lo despierta.

### `forceCollide` cachea los radios: el radio de arrastre nunca existió

**Vive en:** `app/second-brain/fisica.ts` · **Se prueba con:** `scripts/probar-solape.mjs`

**Síntoma.** El dueño: «al arrastrar un nodo incluso puedo solaparlo con otro, eso no
debería pasar». Y era literal: medido con Playwright, arrastrando el nodo más conectado
del ws 11 a través del mapa, los círculos llegaban a pisarse **5,9 px**.

**El diagnóstico obvio era el equivocado.** Todo apuntaba a que la colisión era
demasiado blanda (`strength 0.7`) o a que el nodo iba clavado con `fx/fy` y por eso la
fuerza no podía correrlo. Las dos lecturas son ciertas *en abstracto* y las dos llevan a
tocar lo que no era: subir la fuerza a 1 tensa el reposo (el pad de 8 ya está contra su
techo, ver más arriba) y cambiar el clavado por un resorte hace que el nodo arrastrado
se quede atrás del cursor.

**Causa real.** `forceCollide` **no evalúa el radio por tick**. Lo calcula una sola vez,
en su `initialize()`, y lo guarda en un array
(`node_modules/d3-force/src/collide.js:74`). Ese `initialize()` corre cuando la fuerza se
registra en la simulación — momento en el que `agarrado` vale `null`. O sea que el
accessor

```ts
(d) => (d === agarrado ? FISICA.colisionRadioArrastre : d.r + FISICA.colisionPad)
```

se resolvía **una vez y para siempre por la rama normal**. `colisionRadioArrastre: 380`
—la constante que existe justamente para que «el mapa se abra a su paso»— **nunca se
aplicó una sola vez**. El nodo arrastrado empujaba con radio 8, como cualquier otro.

Lo peor del caso: la constante estaba ahí, documentada, con su comentario explicando por
qué vale 380. Leer el código daba la impresión de que el comportamiento existía.

**Arreglo.** Llamar a `.radius()` con el mismo accessor vuelve a correr `initialize()`
(línea 96 del mismo archivo). Es API pública y es el único gancho que hay. Se llama al
agarrar y al soltar.

**Medido, mismo escenario:** hueco mínimo entre bordes de **−5,9 px** (solape) a
**+89,9 px**. Con el radio vivo, el clavado con `fx/fy` es lo correcto y no hay que
tocarlo: d3 reparte la corrección **por el cuadrado de los radios**, así que con 380
contra 18 el vecino se lleva el 99,8% del empujón y el arrastrado no se frena.

**La regla que queda, y aplica a `manyBody`, `link` y `radial` igual:** **un accessor de
d3-force que dependa de estado que cambia no se recalcula solo.** Si el valor tiene que
cambiar durante la vida de la simulación, hay que re-inicializar la fuerza a mano. Un
accessor que lee una variable mutable *parece* reactivo y no lo es — y falla en silencio,
por la rama que estaba activa cuando se registró.

### Dos trampas de medición de este grafo, que dan números falsos

Las dos hacen que una prueba honesta reporte un defecto que no existe:

1. **Medir antes de que termine la entrada.** Los nodos entran con retardos escalonados
   de hasta 700 ms. Leer la posición «inicial» apenas aparece el SVG captura un fotograma
   de la animación, no la casa del nodo, y toda esa diferencia reaparece después como
   «deriva al soltar». En la misma corrida: 15,6 px de deriva midiendo temprano contra
   14,0 esperando a que asiente, y el hueco mínimo saltó de 46,8 a 89,9.
2. **La deriva al soltar NUNCA da cero, y no tiene que dar cero.** Los nodos **flotan**
   con 16 unidades de amplitud, que a la escala del encuadre son ~10 px. Un ~14 es el
   flote. Lo que habría que mirar es un 100+.

Y una tercera, para tocar el DOM del grafo desde una prueba: el primer `<circle>` de
`.cbg-cuerpo` es el **área de toque transparente** y es más grande que el nodo. Medir con
ese da solapes que no se ven. El que se dibuja es el segundo. El id sale de
`data-nodo`, que existe solo para esto: las clases son todas iguales y la posición la
reescribe el rAF, así que sin él no hay forma de seguir a UN nodo entre dos frames.

## La pantalla: hacer que el grafo sea el protagonista

### El `aspect-ratio` hacía que el lienzo creciera justo donde no entraba

**Vive en:** `app/second-brain/Grafo.tsx` (el bloque `<style>`)

**Síntoma.** El dueño mandó una captura: se veía el tercio de arriba del grafo.

**El diagnóstico obvio era el equivocado.** Se midió el layout primero y estaba bien:
43 nodos, separación mínima 96 unidades, ninguno fuera del encuadre. La conclusión
tentadora era «el lienzo es grande, hay que scrollear». Falso: el svg tenía
`aspect-ratio: 4/3` con `height: auto`, o sea que **el alto se derivaba del ancho**. En
1920 con la sidebar plegada eso da 1444×1083 sobre un viewport de 900. El lienzo crecía
**justo en el monitor donde más espacio hay**, que es exactamente al revés.

**Regla.** Un lienzo dentro de una página saca su alto del VIEWPORT, nunca del ancho:
`clamp(420px, calc(100svh - 280px), 760px)`. Y `svh`, no `dvh`: en mobile `dvh` cambia
cuando se esconde la barra del navegador, el lienzo se redimensiona a mitad del scroll
y el re-encuadre da tirones.

El 280 sale de MEDIR, no de estimar. La primera versión restaba 240 —sumando a mano el
padding, el header y la barra— y la grilla de abajo quedaba **9 px por debajo del
pliegue**: la pantalla terminaba justo donde terminaba el lienzo y mentía diciendo que
no había nada más. Con 280 asoman 31-41 px de la primera fila de tarjetas.

⚠️ Y NUNCA `height: 100vh` en el `<main>`: `flex: 1` implica `flex-basis: 0%` y le gana
al `height`, el main colapsa. Ya está documentado, pero acá reaparece la tentación.

### Bajar el lienzo SIN arreglar el encuadre lo empeora: son un solo cambio

**Vive en:** `app/second-brain/Grafo.tsx` (`ajustar()`)

`layoutCerebro` devuelve un encuadre **CUADRADO** (`lado`) y el `<svg>` no declaraba
`preserveAspectRatio`, o sea `xMidYMid meet`: el cuadrado entra por el lado **chico**.
Con el lienzo 4:3 eso ya desperdiciaba el 25% del ancho; con un lienzo apaisado de
1762×760 desperdiciaría el 60%. Bajar el alto sin tocar esto deja el grafo MÁS chico
que antes.

La salida es encuadrar **en el cliente** contra la caja medida (`ResizeObserver`),
usando el bbox real de los nodos con su radio. Medido después: el bbox ocupa el 92-95%
del lado corto en 1440×900, 1920×1050 y 1366×768, y el grafo entra entero en las tres.

Es una función y **tres** usos: el encuadre inicial, el botón «Ajustar a la vista» y el
centrado del buscador y de las conexiones.

⚠️ El re-encuadre automático se apaga en cuanto el usuario toca el zoom
(`tocoElZoom`). Re-encuadrarle el mapa a alguien mientras lo está mirando es peor que
dejárselo descuadrado.

### Tres bugs que solo aparecen cuando se cambia el encuadre

**Vive en:** `app/second-brain/Grafo.tsx`

1. **El paneo iba lento y nadie lo había notado.** `const escala = encuadre.lado /
   caja.width`. Con `meet` el factor real lo fija el lado **chico**, así que en un
   lienzo 4:3 el mapa se arrastraba al **75% de la velocidad del dedo** — lo justo para
   sentirse raro y no lo bastante para reportarlo. En un lienzo apaisado habría bajado
   al 40%. Fix de una línea: `Math.min(caja.width, caja.height)`. La rueda y el
   pellizco NO lo tenían: pasan por `aMundo()`, que usa la matriz real del SVG.
2. **`K_MIN`/`K_MAX` eran absolutos contra k=1**, que era el zoom de arranque cuando el
   mapa entraba por `preserveAspectRatio`. Con el encuadre nuevo el arranque puede ser
   k=1,8 y el usuario **no podía alejarse**. Pasan a ser relativos a `kFit`. No lo ve
   el typecheck: se ve como «el zoom se traba».
3. **El porcentaje mentía.** Salía de `kPaso`, que está cuantizado a cuartos
   (`Math.round(k*4)/4`), así que el mapa recién encuadrado marcaba **89%** sin que
   nadie hubiera tocado nada — se lee como que arranca mal puesto. Ahora sale del zoom
   real; 100% es el encuadre.

Y el mismo `kFit` hace falta en ESTADO además de en un ref: el fade de etiquetas se
calcula en el render y un ref no re-renderiza.

### El color del área Norte era el mismo dorado que «tu Norte»

**Vive en:** `app/globals.css` (los tokens `--grafo-*`)

`--grafo-norte` valía `#F2B01E`, que es **exactamente** `--mako`. El nodo `fase` se
pinta con `--mako` por `destacado`, y sus cuatro vecinos del área Norte con
`--grafo-norte`: el único nodo dorado con significado del mapa quedaba
**indistinguible** de cuatro nodos comunes. Y bajo deuteranopía `--mako` y
`--warn-fill` colapsan entre sí (1,14:1), con lo cual esa zona tenía tres clases que
para ~6% de los hombres eran dos.

**La regla que queda:** ningún área puede usar `--mako` ni `--warn-fill`. Esos dos
tonos están tomados por «tu Norte» y «tu cuello de botella», que se pintan por ESTADO,
no por área. `--grafo-norte` pasa a `#BFC8DC`.

### Datos que se calculaban, viajaban al browser y no los leía nadie

**Vive en:** `lib/cerebro-grafo.ts` → `app/second-brain/Grafo.tsx`

- **`AristaCerebro.motivo`.** Escrito con cuidado en las ~14 llamadas a `unir()` —«Este
  segmento compra por esta razón», «Un plano del panorama que MaKo escribió»—, con un
  tipo que dice literalmente «es lo que se lee al pasar por encima; si no se puede
  escribir, la arista no va». `grep motivo app/second-brain/` daba **cero**. El panel
  mostraba «5 conexiones» y tiraba los cinco motivos. Ahora es la lista.
- **`cerebro.vacias`.** El panel decía «Quedan N áreas sin construir» sin poder
  nombrarlas, porque no leía el array que se las estaba mandando. Y el número estaba
  **mal**: usaba `cuenta.pendientes`, que incluye el nodo RAÍZ, así que en un workspace
  nuevo decía «11 áreas» y áreas hay diez. No se arregló la frase: se borró el
  consumidor, porque cada tarjeta de área ya dice «Vacía» por su cuenta.

**La regla:** antes de agregar un dato al grafo, `grep` los que ya viajan. Salen gratis
y valen más que un área nueva.

### El `server-only` volvió a morder, y con el mismo disfraz

**Vive en:** `lib/cerebro-modelo.ts` (`AUTORIA_TEXTO`)

Para no copiar la tabla de «lo dedujo MaKo / lo escribiste tú», se la exportó desde
`lib/vault.ts` y se la importó en `Grafo.tsx`. **Typecheck verde, página 500**:
`vault.ts` lleva `server-only` y `Grafo` es un componente de cliente.

Es el mismo error que ya está documentado más arriba en este documento, cometido de
nuevo por una razón buena (no duplicar). La conclusión no es «no compartas»: es que el
lugar común de las dos orillas tiene que ser un módulo **puro**. `AUTORIA_TEXTO` vive
en `cerebro-modelo.ts`, que no importa nada justamente para eso.

### El README de adentro del ZIP contaba mal, y nada lo podía mirar

**Vive en:** `lib/vault-modelo.ts` (`readme`) · **Se prueba con:** `tests/vault.test.ts`

**Síntoma.** Se exporta el vault del ws 11 y se abre. El README dice «01 Norte — … (5
archivos)» y la carpeta tiene **3**. Todas las carpetas estaban infladas en uno; la del
Norte, en dos.

**Causa.** `readme()` contaba con su propio filtro escrito a mano —solo
`autoria !== 'pendiente'`— mientras `construirVault()` descarta además la RAÍZ y los
nodos de ÁREA, que son andamiaje del grafo y no archivos. Norte se iba de dos porque
ahí vive también la raíz. Dos filtros para la misma pregunta, y el que se usaba para
contar no era el que decidía qué se escribía.

**Por qué sobrevivió tanto.** `lib/vault.ts` llevaba `server-only`, así que **ningún
test lo podía importar**: no había una sola prueba sobre el único artefacto que el
cliente se lleva y abre en otro programa. Se descubrió abriendo el ZIP a mano, no
leyendo el código ni corriendo la suite.

**Regla.** Es la misma que AGENTS.md fija para los guards destructivos y para el
catálogo de modelos, y acá se paga otra vez: **lo que hay que poder testear no vive
detrás de `server-only`.** La proyección pura se mudó a `lib/vault-modelo.ts` (sin la
marca) y `lib/vault.ts` quedó como la puerta que la reexporta, así que los
importadores de siempre no cambian y la guarda de bundle se mantiene.

Y la regla de fondo: **un índice que cuenta distinto que la carpeta que describe es
peor que no tener índice.** Si dos lugares cuentan lo mismo, uno llama al otro.

### Lo que quedó sin hacer, medido

- **El grafo deja ~370 px de aire vacío a cada lado.** Es geométrico: el layout del
  servidor produce un bbox cuadrado (551×623 medido en el ws 11) y el lienzo es
  apaisado (1282×620). El grafo llena la ALTURA al 94% y no puede llenar el ancho. La
  única salida es un layout elíptico de ~2:1 tocando `RECETA` en
  `lib/cerebro-layout.ts`, y el costo es alto: **cambia el mapa de todos los clientes**
  e invalida la línea base de `scripts/medir-grafo.mjs`. No es un ajuste, es otro
  layout. Decisión del dueño.
- **Las etiquetas se pisan en el racimo más denso.** Y ojo con el arreglo fácil:
  atenuarlas todas (bajar el techo de `alphaEtiqueta`) las hace más difíciles de leer
  **sin resolver el solape**. Se probó y se revirtió. La salida real es no dibujar una
  etiqueta cuando su caja choca con otra ya dibujada.
- **El layout se recalcula en CADA carga** (`force-dynamic` + `revalidate: 0`) y
  `lib/cerebro-layout.ts` ya devuelve la `huella` para poder cachearlo. ⚠️ Este punto
  decía que persistirlo era un prerrequisito del funnel; se midió y era falso — ver
  «CORRECCIÓN: persistir el layout NO era un prerrequisito» más abajo. Sigue siendo lo
  correcto cuando un workspace real pase de 80 nodos.
- ~~**El funnel todavía no está en el grafo**~~ — HECHO, junto con el arreglo del canal
  del que dependía. Ver «El funnel adentro del grafo» más abajo y la entrada del canal
  en `docs/hallazgos-crm.md`.
- **El brief entra al grafo por cuatro listas hardcodeadas** (`CAMPOS_NORTE`,
  `CAMPOS_OFERTA`, `CAMPOS_CLIENTE`, `CAMPOS_MARCA` en `lib/cerebro-grafo.ts`) mientras
  `getSchema()` lee el esquema VIVO del workspace. O sea: se le agrega un campo al
  brief de un cliente, el cliente lo contesta, el dato alimenta los prompts… y **no
  existe** en el mapa que dice «todo lo que MaKo sabe de tu negocio». Sin error y sin
  aviso. Es el molde exacto del bug del parser del panorama.

## El funnel adentro del grafo

### `scripts/medir-grafo.mjs` se quedó ciego y no lo dijo

**Vive en:** `scripts/medir-grafo.mjs`

**Síntoma.** Se corre el verificador después de sumar el funnel y devuelve `nodos 0`,
`densidad Infinity`, `NaN` en cuatro métricas y finalmente un `TypeError`.

**Causa.** Su parser pedía `<circle cx="…" cy="…" r="…" fill="…">`. Cuando el dibujo pasó
a mover los nodos con un `transform` en el `<g>` que los envuelve, los círculos se
quedaron sin `cx`/`cy` y la expresión dejó de matchear. **No falló: informó cero.**

**Por qué importa más de lo que parece.** Este script existe porque, textual en este
mismo documento, «la casa dio por bueno DOS VECES un grafo que estaba mal porque se veía
parecido». Un verificador que devuelve 0 en silencio es peor que no tenerlo: da la pinta
de haber corrido. Y estuvo roto desde el rediseño del dibujo hasta que alguien lo usó de
verdad — o sea que las capturas intermedias se aprobaron a ojo, que es exactamente lo que
venía a impedir.

**Regla.** El parser ahora sale con error explícito si lee 0 nodos, en vez de seguir y
escupir `NaN`. Y saca el id de cada nodo de `data-nodo`, así que la próxima vez que el
marcado cambie el mensaje dice dónde mirar. **Una herramienta de verificación que puede
devolver «todo bien» sobre una entrada vacía no es una herramienta de verificación.**

### Qué entra del funnel y qué no: 17 etapas no son 17 nodos

**Vive en:** `lib/cerebro-grafo.ts` (el bloque «El FUNNEL»)

`generateFunnel` produce 17 etapas para high-ticket, 11 para simple y directa. No entran
todas:

- **Fuera las tres salidas fijas** (Perdido · Descalificado · No responde). Son catálogo
  de MaKo: bit a bit iguales en las cuatro plantillas y en todos los workspaces. Es la
  misma regla que ya excluye los 14 formatos de la biblioteca — «el catálogo de MaKo no
  es del cliente».
- **Fuera «Nutrición - Manual»**, y este es el motivo más fuerte: `generateFunnel` la
  coloca siempre pero **no emite ni una transición hacia ella ni desde ella**. Sería el
  único nodo huérfano del mapa. Colgarla del área sería peor: parecería conectada sin
  significar nada.

Quedan 13 en high-ticket y en vsl, 7 en simple y directa. Y **no son las mismas entre
plantillas**: `directa` genera «No pagó» y no genera «No Show R1». Eso es justamente lo
que hace que el funnel valga como dato del negocio y no como decoración.

### Las transiciones vienen DUPLICADAS por par, y `unir()` no deduplica

**Vive en:** `lib/cerebro-grafo.ts`

`generateFunnel` emite ida **y** vuelta entre los mismos dos nodos: `agenda → No Show R1`
y `No Show R1 → agenda`, `facturando → No pagó` y la vuelta. Medido: 5 pares duplicados
en high-ticket, 4 en vsl, 3 en simple, 1 en directa.

Un par duplicado rompe cuatro cosas distintas, todas silenciosas: mete **dos resortes** en
`forceLink` —ese par queda al doble de tensión y se pega en el dibujo—, dibuja dos líneas
una encima de la otra, **infla la densidad que mide el verificador** (cuenta líneas, no
pares) y hace que el panel cuente dos veces al mismo vecino. Se funden por par **no
ordenado**, juntando los dos motivos en una frase.

**Regla general:** `unir()` no deduplica. Cualquier fuente que pueda emitir la relación
en los dos sentidos tiene que fundirse antes de entrar.

### El nodo de área NO se lleva las etapas de nutrición, y sin esa excepción el hub se rompe

**Vive en:** `lib/cerebro-grafo.ts` (el bloque «Las ÁREAS como nodos»)

El bloque de áreas cuelga todo nodo real de su área. Aplicado al funnel —13 etapas, todas
en `norte`— le lleva el grado de `area:norte` de 5 a 22 y la convierte en el nodo más
conectado del mapa, por encima de la raíz: **el hub pasa a 5,5× contra el umbral de 4,5×**.

La excepción es que solo cuelgan de su área las etapas de la fila **Activo**. Y no es un
parche métrico: el racimo del funnel ya lo hace **su propia cadena**, que es para lo único
que existe el nodo de área. Con eso el hub queda en 3,5×.

⚠️ Esta excepción **deroga** la regla del bloque de áreas y por eso lleva su comentario al
lado. Sin él se lee como un olvido, alguien lo «arregla», y el hub vuelve a 5,5× sin que
nada avise: el typecheck no lo ve y **no hay ningún test que mida topología**.

### El antes y el después, medido — incluido lo que empeoró

Sobre el ws 11, con `scripts/medir-grafo.mjs`:

| | sin funnel | con funnel |
|---|---|---|
| nodos · aristas | 50 · 87 | 61 · 105 |
| densidad | 1,74 | 1,72 ✓ |
| hojas | 2% | 7% ✓ |
| hub | 3,4× | 3,5× ✓ |
| clustering | 0,15 | **0,21** ✓ |
| componentes | 1 | 1 ✓ |
| CV del radio | 0,39 | 0,41 ✓ |
| bins vacíos | 4/36 | 6/36 (ver la corrección abajo) |

El clustering sube un 40%: era el objetivo, el funnel es la única cadena que tiene el
negocio.

⚠️ **CORRECCIÓN, y la escribo porque el error lo cometí acá.** Esta entrada decía que
«los bins vacíos se pasan del umbral» y lo dejaba anotado como una deuda del layout. Las
dos mitades están mal:

1. **El umbral ≤4 es estadísticamente imposible de cumplir con pocos nodos.** Es un
   problema de coleccionista de cupones: con `n` ángulos **uniformes** sobre 36 bins,
   E[vacíos] = 36·(35/36)^n. Simulado con 60.000 corridas: n=42 → mediana **11** ·
   n=61 → 6 · n=80 → 4 · n=100 → 2. O sea que a n=61 el umbral suspende a un grafo
   perfectamente isótropo, y **solo se vuelve alcanzable a partir de n≈78**.
2. **El «caso radial» que este umbral vino a cazar daba 11/36 con 42 nodos — que es
   exactamente la mediana del azar.** La métrica nunca cazó nada. Lo que sí detectó el
   layout radial fue el **CV del radio** (0,30).

Medido después con el test de Rayleigh, que **no depende de n**: ws11 R₁=0,095 p=0,58 ·
R₂=0,186 p=0,12 · R₁₀=0,044 p=0,89. Los tres armónicos importan —el 1.º cazaría «todo
corrido hacia un lado», el 2.º una elipse, y el 10.º es justamente el que cazaría las
DIEZ CUÑAS del layout radial viejo— y ninguno dispara. El grafo de hoy es angularmente
**indistinguible de isótropo**.

**La regla que queda, y vale para cualquier umbral que se escriba de nuevo: un umbral
que cambia de veredicto según cuántos datos tenga el cliente no es un umbral.** Antes de
fijar uno, simulá el modelo nulo. Este suspendía a los clientes chicos y aprobaba a los
grandes, y en el medio nos hizo escribir una deuda que no existía.

### CORRECCIÓN: persistir el layout NO era un prerrequisito

**Vive en:** `lib/cerebro-layout.ts`

Una versión anterior de este documento afirmaba que sumar el funnel «cruza los ~80 nodos
donde la tabla mide 300 ms» y que **persistir el layout dejaba de ser opcional antes de
agregarlo**. Es falso, y las dos mitades lo son:

- la aritmética no cierra — 43 + 13 = 56, no cruza 80;
- y el tiempo tampoco. Medido con `layoutCerebro` real: **43 nodos 117 ms · 50 → 112 ms ·
  58 → 141 ms · 68 → 167 ms · 80 → 215 ms · 100 → 270 ms · 150 → 451 ms**. El funnel
  cuesta ~30 ms por carga.

La lección no es sobre el funnel: es que **un número heredado de otro documento no es una
medición**. Persistir sigue siendo lo correcto cuando un workspace real pase de 80 nodos
—la `huella` ya se calcula y no la consume nadie—, pero no bloqueaba esto.

### Lo que quedó sin hacer acá

- **No hay ningún test que mire la topología del grafo**, y no se puede escribir hoy:
  `lib/cerebro-grafo.ts` lleva `server-only`, así que ningún test lo puede importar. Es
  el mismo agujero que ya se pagó con `lib/vault.ts` y el README que contaba mal, y la
  salida ya está probada: mover la parte pura a un módulo sin la marca. Mientras tanto,
  todo lo medido acá se puede romper en un commit posterior sin una sola señal roja.
- **Cambiar el pipeline cambia los ids de los nodos** (`etapa:<key>`) y por lo tanto la
  huella del layout: el mapa entero se reacomoda cada vez que el cliente toca el editor
  del funnel. El camino incremental de `layoutCerebro` (el parámetro `previo`) existe,
  está testeado y no lo llama nadie — este es el primer caso de uso que lo justifica.
- **El área Norte pasó a ser el 21% del mapa** (`gris uniforme` la reporta como color
  dominante). Es consecuencia directa de que el funnel viva ahí. Se ve bien porque
  `--grafo-norte` es un gris azulado desaturado, pero si algún día se le sube la
  saturación, un quinto del lienzo se pinta de un solo tono.

## El lienzo: lo que se ve y lo que se toca

### Las etiquetas se dibujaban a 4,32 px y el zoom NO las agrandaba

**Vive en:** `app/second-brain/Grafo.tsx` (el `font-size` de `.cbg-et` y `--u`)

El CSS declaraba `font-size: calc(12px / var(--k,1))`. Parece correcto y no lo es: el
`<g>` se escala **dos veces** —por el zoom del paneo (`--k`) y por la escala del
viewBox— y el CSS compensaba solo la primera. El `/k` se cancelaba y el neto era
**12 × 0,36 = 4,32 px CONSTANTES a cualquier zoom**. Medido a k=1,16 y a k=4,40: 4,32 px
las dos veces.

Lo grave no es el tamaño: es que **acercarse no servía para nada**, y ese es el único
mecanismo con el que Obsidian hace legible un racimo denso.

⚠️ **Y arreglar el tamaño SOLO deja la pantalla peor.** Con el texto a su tamaño real
aparecen 17 pares de etiquetas pisadas que la ilegibilidad venía tapando. Los dos
cambios son uno: tamaño + descarte por colisión en orden de grado descendente. Por
render condicional, nunca con `opacity: 0` — este documento ya midió que un nodo
invisible cuesta lo mismo que uno dibujado.

Los factores de la caja salen de **medir la real en el navegador**: el alto renderizado
de una etiqueta de 12 px es **16 px**, porque la caja incluye el interlineado. Con el
1,15 estimado quedaban 10 pares pisados.

**Medido, ws11 a 1440×900:** al encuadre 39 de 61 etiquetas y **0 pares pisados**;
acercado, 61 de 61 y **0 pares**. Que es el comportamiento de Obsidian.

### El centro de lo visible NO es «medio ancho visible»

**Vive en:** `app/second-brain/Grafo.tsx` (`irA`)

El viewBox es **cuadrado** y entra con `xMidYMid meet`: se escala por el lado corto y se
**centra** en el largo, o sea que lo visible se extiende más allá del viewBox por los dos
costados en partes iguales. El centro es el del viewBox, no `encuadre.x + anchoVisible/2`.

Con la fórmula mal, el nodo quedaba **317 px a la derecha** del centro. `ajustar()` ya lo
hacía bien; `irA` no — así que el buscador venía «centrando» nodos y dejándolos corridos
desde antes de que existiera el vuelo de cámara. La regla: cuando dos funciones calculan
lo mismo, la que se escribió después no se deduce, se copia de la que ya funciona.

### Dos trampas de popover que invalidan los patrones de la casa dentro del lienzo

**Vive en:** `app/components/Dropdown.tsx` (`portalTo`) · `app/second-brain/Grafo.tsx`

1. **La pantalla completa mata el portal.** Cuando un elemento entra al *top layer* con
   `requestFullscreen()`, **todo lo que esté fuera de ese subárbol deja de pintarse** —
   incluido un portal a `document.body`. El menú se abre, existe en el DOM, responde al
   teclado… y no se ve. Sin error y sin warning. Por eso `Dropdown` tiene `portalTo`.
2. **El `overflow: hidden` del marco mata el popover absolute**, que es el otro patrón de
   la casa. Entre las dos, adentro de un lienzo con pantalla completa no sirve ninguno de
   los dos por defecto.

### El recorte cortaba texto sin dejar forma de verlo

**Vive en:** `app/second-brain/Grafo.tsx`

El clamp recortaba por **líneas** (`WebkitLineClamp: 6`) y el botón «Leer todo» se
decidía por **caracteres** (`> 320`). Entre los ~270 y los 320 caracteres el texto se
cortaba y **no había ningún botón** para verlo entero: se perdía, en silencio.

**La regla:** el que recorta y el que ofrece ver más tienen que mirar **la misma
señal**. Si uno mide líneas y el otro caracteres, hay una banda donde el contenido
desaparece.

## Los datos del grafo

### El hueco no estaba donde parecía: catálogo disfrazado de dato del cliente

**Vive en:** `lib/cerebro-grafo.ts`

Contra el pedido «faltan muchísimos datos», el inventario de las 67 tablas por workspace
dio tres categorías, y la que engaña **no es el volumen**:

- **VOLUMEN** (13.217 mensajes de WhatsApp en un cliente, 6.151 eventos de VSL, 1.187
  leads): obvio, y ni agregados aportan un nodo. Cuántos leads hay parados en una etapa
  es un **dato de esa etapa**, no un nodo aparte.
- **CATÁLOGO DE MAKO DISFRAZADO**: las once secuencias de nutrición de tres workspaces
  distintos son la **misma semilla bit a bit**, y las categorías del tablero son
  literalmente el catálogo. Parecen datos del negocio y son los nuestros. Por eso de las
  secuencias entran **solo las activas**.
- **ACTIVIDAD, no conocimiento**: lo que el negocio está probando es la salida de otra
  pantalla.

**El criterio que quedó:** una fuente entra cuando trae **al menos una arista lateral por
nodo que suma**; si no puede, entra **agregada en un solo nodo**; si ni siquiera se le
puede escribir el `motivo`, no entra. Las aristas laterales son el ingrediente escaso —
sin ellas el grafo vuelve a ser un árbol y ninguna física lo salva.

Y el tope no es el tiempo: **es el porcentaje de hojas**. Los 22 términos del glosario
serían 22 hojas de grado 1 de un saque, ~21% del mapa colgando de un solo lugar. Por eso
van agregadas.

### Un área suelta del resto NO es un bug, y «arreglarlo» rompió un umbral real

> ⚠️ **SUPERADO el 20/10/2026:** sí es un bug (Martín: «En ningún caso jamás los cerebros se deben dividir en 2»). Todo racimo
> suelto se engancha a la raíz antes del layout, y el hub quedó en 3,4× y 2,4×. Ver
> [ningún cerebro se divide en dos](#el-código-decía-uno-y-se-veían-dos-ningún-cerebro-se-divide-en-dos-20102026).

**Vive en:** `lib/cerebro-grafo.ts` (el comentario del bloque de áreas)

Al sumar las fuentes nuevas, un workspace que nunca contestó el quiz de personalidad
quedó con su área «Voz y cara» flotando suelta: sin el nodo `voz` que recibiera las
aristas, los cinco nodos nuevos colgaban solo de su área. El verificador pasó de 1
componente a 2 — **con cero huérfanos**, así que el chequeo de huérfanos no lo hubiera
visto nunca.

Se tendió un puente del nodo de área a la raíz. **Se revirtió**, por dos razones medidas:

1. `scripts/medir-grafo.mjs` **no marca `componentes` como falla**, y su propio comentario
   dice que «las islas son parte del look de Obsidian». No había nada que arreglar.
2. El puente le suma radios a la raíz: el hub de un workspace real pasó de **4,3× a 4,6×**
   contra un umbral de 4,5×. El arreglo de un no-problema rompió un umbral que sí existe.

Y la isla **dice algo cierto**: esa parte del negocio todavía no se conecta con el resto.

### El detalle del nodo era un string plano, y por eso el copy era pobre

**Vive en:** `lib/cerebro-modelo.ts` (`datos`, `cuerpo`)

El síntoma que se reportó fue «los textos están muy resumidos». La causa raíz es que
`NodoCerebro.detalle` era **un solo string** y todos los productores lo armaban con
`.join(' · ')`. Con un campo único, cada uno tenía que elegir entre **tirar datos** o
escribir un renglón corrido ilegible — y eligieron tirar. Se descartaban campos reales en
**11 de los 17** tipos de nodo.

El peor caso era el Norte: `FaseDef` tiene **quince campos** y el nodo mostraba **uno**.
Qué funnel corresponde, cómo repartir la inversión, qué no conviene hacer todavía: todo
escrito, viajando al browser, sin leerse.

**La regla:** cuando un campo de texto recibe información que tiene ESTRUCTURA, la
estructura se pierde en el primer `join`. Un nodo tiene tres campos con tres trabajos —
la frase que lo define, los pares nombre/valor, y la prosa larga — y el ZIP lleva los
tres, o el archivo dice menos que la pantalla.

### Un producto dado de baja se dibujaba como vigente

**Vive en:** `lib/cerebro-grafo.ts` · `lib/productos.ts`

`construirCerebro` llama `listProductos()` sin argumento y `soloActivos` es `false` por
defecto. En una pantalla cuyo argumento entero es «esto es tuyo y está al día», eso no es
una omisión: **es información falsa**. Ahora lo dice en sus datos.

## Lo que quedó sin hacer

- **La búsqueda por IA** del plan no se trajo: con 60-100 etiquetas a la vista no se
  justifica el costo por consulta. Tendría caso para buscar por el CONTENIDO de los
  detalles («dónde dice cuánto cobro»), que es semántico y no textual. Vive en
  `app/plan/board/BuscadorTareas.tsx` + `/api/plan-buscar`.
- **El brief sigue entrando por cuatro listas hardcodeadas** (`CAMPOS_NORTE`,
  `CAMPOS_OFERTA`, `CAMPOS_CLIENTE`, `CAMPOS_MARCA` en `lib/cerebro-grafo.ts`) mientras
  `getSchema()` lee el esquema vivo. Hoy es **latente** —ningún workspace tiene esquema
  propio— pero la UI de /onboarding ya tiene `addField`: el primer cliente que agregue un
  campo lo activa en silencio. Es el molde del bug del parser del panorama.
- **El local graph** (re-encuadrar sobre el vecindario a 2 saltos al fijar) es la
  alternativa BARATA al layout elíptico y resolvería el 56-67% de lienzo vacío sin tocar
  `RECETA` ni cambiarle el mapa a todos los clientes. Vecindario medido a 2 saltos: 14
  nodos, 23-25% del mapa, que es también el default de Obsidian.
- **`gris uniforme ≥ 85%` viene en ✗ en los cuatro workspaces** y nadie lo mira: el
  código pinta las diez áreas y el documento afirma lo contrario. Hay que elegir una de
  las dos y renombrar el check. Vive en `scripts/medir-grafo.mjs` y `app/globals.css`.
- **La `huella` del layout sigue sin consumidor** y se recalcula en cada carga. No urge
  —medido, 141 ms con 58 nodos— pero el camino incremental de `layoutCerebro` (el
  parámetro `previo`) existe, está testeado y no lo llama nadie.
- **`ang:<anguloId>`** (el ángulo de los guiones) quedó sin implementar: replicaría el
  mecanismo de `fmt:` que ya funciona. 🚨 Al hacerlo, NUNCA unirlo con `fmt:` — son tres
  catálogos con nombres parecidos y espacios de ids distintos, y una arista con un id que
  no matchea simplemente no se dibuja, en silencio.

### El panel no estaba mal diseñado: un selector abierto lo rompía

**Vive en:** `app/second-brain/Grafo.tsx` (la clase `.cbg-mapa`)

**Síntoma.** «Está MUY mal diseñado el detail de cada nodo.»

**Causa.** `.cbg svg { width: 100% }` estaba escrito para el lienzo, pero matchea **todos**
los `<svg>` de adentro del componente — incluidas las flechas de 13×13 de cada conexión
del panel y el chevron de «Leer todo». **Un `width:100%` de una hoja de estilos le gana
al atributo `width="13"`**, porque los atributos de presentación tienen la especificidad
más baja que existe.

Medido a 1500×950: la flecha computaba **270 px**, se quedaba con 270 de los 286 de la
fila, y dejaba el texto de la conexión en **cero** — desbordaba y partía una palabra por
renglón. El `scrollHeight` del panel era **1463 px sobre una caja de 644**. Después:
flecha 13, texto 235, panel **510 — entra entero**.

**La regla:** un selector de dos partes adentro de un componente que además contiene
íconos es un selector **abierto**. El lienzo se **nombra** con una clase; nunca
`.componente svg`.

⚠️ Y el orden importa: si se rediseña el panel sin arreglar esto primero, la mejora se le
atribuye al rediseño y la regla no queda escrita en ningún lado.

### Filtrar apagaba los nodos y dejaba intacta la telaraña

**Vive en:** `app/second-brain/Grafo.tsx` (`visible()`)

Con un filtro puesto: 47 de 67 nodos atenuados… y **las 119 líneas y las 49 etiquetas
seguían a opacidad plena**. Se apagaban los puntos y quedaba la telaraña, que es el ~70%
de la tinta de la pantalla — por eso «no parecía filtrar».

**Causa:** tres criterios distintos para tres cosas que son la misma pregunta. El de las
aristas miraba el nodo en foco y el área, e ignoraba el filtro de autoría y la búsqueda.

**La regla:** **un solo predicado, tres consumidores** — el nodo, sus aristas (se dibuja
solo si sus DOS puntas pasan) y su etiqueta. Y el descarte por colisión se calcula sobre
lo que PASA el filtro: al filtrar se libera espacio y aparecen más nombres, que es lo que
uno espera.

### La jerarquía gobierna el zoom, y el fade viejo hacía lo mismo peor

**Vive en:** `app/second-brain/Grafo.tsx` (`entraPorNivel`)

Las cinco carpetas madre nunca pierden el título; las áreas se van al alejarse a la mitad;
los datos, apenas uno se aleja. Encima sigue el descarte por colisión.

Se **quitó** el fade de Obsidian (`clamp(log2(zoom)+1)`) y conviene saber por qué para no
reponerlo: hacía el mismo trabajo con menos información. Superpuestos se anulaban — el
fade apagaba **todo** por debajo del encuadre, incluidas las carpetas madre, que son
justamente las que no tienen que desaparecer nunca.

Y una trampa: el umbral usaba `kPaso`, que está **cuantizado a cuartos** para el fade. Con
eso el encuadre caía del lado equivocado y el mapa arrancaba con 13 nombres de 72. El
umbral usa el zoom real.

### Desaparecer no es `opacity: 0` — hay que desmontar, pero después

**Vive en:** `app/second-brain/Grafo.tsx` (`saliendo`)

La animación de salida es la de entrada al revés y más corta (240 ms contra 420): al
filtrar uno quiere ver el resultado, no la despedida. El nodo **se desmonta** al terminar
— quedarse en `opacity: 0` cuesta lo mismo que dibujarlo, y eso ya está medido más arriba
en este documento.

El patrón: una lista de «los que se están yendo» que mantiene el nodo montado con una
clase mientras dura la animación, con el temporizador **cancelable** — desfiltrar a mitad
de camino tiene que devolverlo, no dejarlo a medias.

### El marco topea su ASPECTO, no su ancho

**Vive en:** `app/second-brain/Grafo.tsx` (`.cbg-marco`)

El alto salía del viewport (correcto) pero el ancho se tomaba todo, así que **cuanto más
grande el monitor, más buzón**: 2,07:1 en 1440 y **3,16:1 en 2560**, con el grafo llenando
46% y **31%** del ancho. A lo alto llenaba 92-95% en las cinco tallas medidas, o sea que
el problema nunca fue el alto.

Con `max-width: calc(var(--cbg-alto) * 1.6)`: 1,6:1 en las dos, llenando 60% y 61%. El
grafo **dibujado** no cambia de tamaño —lo fija el alto—: cambia el encuadre, que es lo
que se ve. No toca el layout del servidor ni la línea base de `medir-grafo`.

### Un área con exactamente UN dato caía por un hueco entre dos reglas

**Vive en:** `lib/cerebro-grafo.ts`

El nodo de área no se crea con menos de 2 miembros, y el nodo `falta:` solo se crea cuando
el área tiene CERO. **Un área con exactamente uno no recibe ninguno de los dos** y
desaparece del mapa. No falla nada y no hay error: medido, faltaba al menos un área en los
cuatro workspaces.

No se baja el umbral —un nodo de área con un miembro tiene grado 1, o sea una hoja nueva, y
es el mecanismo que ya rompió una métrica—. Lo resuelve la jerarquía: **el padre adopta a
los huérfanos**, uniéndose directo a los miembros sueltos de las áreas que no llegaron a
tener nodo propio.

### La barra de búsqueda: lo que se porta y lo que no

**Vive en:** `app/second-brain/BuscadorCerebro.tsx` · `lib/buscar-cerebro.ts` ·
`app/api/second-brain/buscar/route.ts`

Es la barra del tablero (`app/plan/board/BuscadorTareas.tsx`) portada al mapa. Se **porta**
y no se reusa tal cual porque aquella recibe y devuelve campos de una TAREA; lo que sí se
comparte es lo que importa: el matcheo sale de `coincide`, así que las dos búsquedas se
comportan igual ante las mismas palabras.

Tres detalles del original que valen y que es fácil perder al portar:

- **El ✦ de MaKo aparece SOLO con algo escrito.** Un botón de IA siempre visible invita a
  apretarlo sin necesidad, y cada apretada es una llamada al modelo.
- **La flechita va en SVG, no como el carácter «⌄».** Ese glifo se dibuja pegado al techo
  de su caja, así que por más que el botón centre con flex se ve corrido hacia arriba. Un
  path se centra de verdad y además gira al abrir.
- **El chip dice DÓNDE se está buscando.** Sin él, ampliar a «el contenido» hace aparecer
  el triple de resultados y parece que el buscador se rompió.

**Lo que NO se portó, con su razón:** el tablero recorta el detalle a 120 caracteres por
tarea porque con 500 tareas el prompt se iba a 58k tokens. Acá el mapa tiene 60-120 nodos:
el detalle entra ENTERO y recortarlo perdería justo lo que hace útil la búsqueda
semántica.

**Y una trampa propia del lienzo, que el tablero no tiene:** el marco lleva
`overflow: hidden` (un panel `absolute` se recorta) y puede entrar en pantalla completa
(un portal a `document.body` deja de pintarse, sin error). Por eso el portal del panel es
parametrizable — el mismo problema que ya obligó a agregarle `portalTo` al Dropdown.

**El contador y el dibujo salen del mismo cálculo, y eso hubo que arreglarlo:** al ampliar
los campos, el contador decía 14 y el mapa seguía mostrando 5, porque `campos` no estaba
en las dependencias del montaje. Un contador que no coincide con lo que se ve es peor que
no tenerlo.

**⚠️ Deuda (16/09/2026): la búsqueda «por significado» vive entera adentro de la ruta.** El
prompt (`SYSTEM`) y la lógica —armar la lista de nodos, llamar a la cascada, filtrar los ids
contra los reales— están inline en `app/api/second-brain/buscar/route.ts`, y el prompt no es
editable desde /configuraciones. Por eso no pudo sumarse a la API de MaKo:
`buscar_en_segundo_cerebro_por_significado` quedó afuera, anotado en la cabecera de
`lib/api-mako/areas/negocio.def.ts`. Un segundo canal que encuentra la lógica en una ruta la
copia o no la ofrece. Para que exista, primero va a `lib/` con el prompt editable (skill
`add-editable-prompt`), y la ruta pasa a llamarla.

## El vault: el segundo cerebro como carpetas y archivos

### El veredicto del modelo: proyección y exportación, NO almacenamiento

El pedido fue «trabajalo como lo hace Obsidian, que son carpetas y archivos». Se hizo
como **proyección** (el árbol navega) y **materialización** (el ZIP se lo lleva). Las
filas siguen siendo filas.

**Por qué no se mudó todo a markdown, con la cicatriz ya pagada en este repo:** el
panorama es el ÚNICO dato del second brain que hoy se guarda como markdown, y es el
único que perdió el 83% de su contenido sin que nada avisara (ver el parser, arriba).
Mover `productos` —con el que el CRM cierra ventas y calcula MRR— a `.md` repite ese
experimento sobre las filas que sostienen el negocio: se pierden el JOIN, la suma, las
RLS por `workspace_id` y la concurrencia de dos personas editando lo mismo.

**Y la distinción que destraba «la info que pones es muy limitada»:** no es un problema
de almacenamiento, es de **cobertura**. `construirCerebro()` hace doce lecturas y el
sistema tiene ~70 tablas por workspace. Cambiar el motor de guardado suma cero archivos.
De ahí sale la separación que antes no existía: el **grafo** dibuja identidad y se queda
chico y legible · el **árbol** navega todo y puede tener miles de archivos · el **ZIP**
se lleva el árbol entero. Eran la misma cosa y no lo son.

**Vive en:** `lib/vault.ts` · `app/api/second-brain/exportar/route.ts`

### Dos nodos con el mismo id: el bug que encontró el export y que rompía el grafo

**Síntoma.** El ZIP salía con dos archivos menos de los que decía. Ninguna excepción.

**Causa.** `canonPlano` mapea sinónimos al mismo nombre para que las aristas laterales
encuentren su destino aunque el panorama esté guardado con un molde viejo. Pero dos
secciones **distintas** del mismo panorama pueden caer en el mismo canónico —«NICHO O
MERCADO ESPECÍFICO» y «NICHO Y MERCADO» van las dos a «NICHO Y MERCADO»—, y ahí quedan
**dos nodos con el mismo `id`**.

Eso no rompe el parser: rompe **todo lo que indexa por id**. Las claves de React, el
`Map` de posiciones del layout, el destino de las aristas. Y en silencio.

**Regla.** Cualquier función que derive un id de un texto normalizado necesita una
guarda de unicidad al lado. Y el detector barato es el export: **si dos nodos producen
la misma ruta de archivo, hay dos nodos con el mismo id.** Fue un ZIP con dos archivos
de menos lo que sacó a la luz un bug del grafo.

**Vive en:** `lib/cerebro-grafo.ts` (`idsPanorama`)

### Un enlace `[[wiki]]` roto es peor que ninguno

**Síntoma.** El vault salía con enlaces a «Norte» y al nombre del negocio, que no
existen como archivo.

**Causa.** Los vecinos de un nodo se enlazan todos, pero la raíz es el README y los
nodos de área son la carpeta: ninguno de los dos es un archivo. En Obsidian un enlace
que no resuelve se pinta como un **nodo fantasma**, así que el export ensuciaba el grafo
con cosas que no existen — el opuesto exacto de lo que viene a mostrar.

Y el enlace tiene que usar el nombre **ya desambiguado**: cuando dos nodos se llaman
igual (hoy pasa con «Oferta», que existe como campo y como plano del panorama) el
segundo archivo se llama «Oferta 2», y un `[[Oferta]]` en su vecino resuelve al primero.
Un link que apunta a un archivo REAL pero equivocado es la peor forma de estar roto.

**Regla.** Los nombres se resuelven en una primera pasada sobre TODOS los nodos, y los
cuerpos se escriben en una segunda. Y el chequeo que hay que correr: **cero enlaces que
no resuelvan** — verificado en los cuatro workspaces reales (56 a 74 enlaces cada uno).

**Vive en:** `lib/vault.ts` (`construirVault`, las dos pasadas)

## Lo que quedó sin hacer

- **El reporte de sesiones sigue siendo solo de Claude Code**: el hook es un `Stop` de
  `.claude/settings.json`, así que desde la app de Claude la skill funciona pero no
  reporta. El texto del consentimiento lo nombra bien, pero conviene revisarlo si la
  integración se sigue generalizando. Vive en `lib/agente-consentimiento-texto.ts`.
- **Un test es INTERMITENTE en este clon**: en dos corridas dio `1 fail` y en cinco
  seguidas dio limpio, sin poder capturarse cuál. Coincide con que la otra cuenta estuvo
  agregando tests (476 → 502 en una sesión). No es de Grafo.tsx ni de FiltroMapa.tsx,
  que no tienen test propio.

- **El visor de documentos sigue pintando blanco sobre el lienzo oscuro**: el `<iframe>`
  de un PDF y el fondo de una `<img>` los pinta el navegador y no se pueden tematizar
  desde acá. Vive en `app/second-brain/Grafo.tsx` (`.cbg-visor`).
- **`scripts/medir-grafo.mjs` no mide contraste**, ni de arista ni de etiqueta contra el
  fondo. En claro no importaba; con el lienzo oscuro es el chequeo que faltaría para que
  la herramienta no pueda decir «todo bien» sobre un mapa ilegible.
- **El regex de «nodos de acento» del mismo script es `/mako|warn/`**: un acento pintado
  con `--primary` no lo cuenta, y sobre oscuro `--primary` da 3,3:1 (ilegible). Ampliar el
  regex, no el umbral.

- **La versión oscura del lienzo** quedó pendiente y es un cambio de CUATRO variables, no
  de cada regla: `--cbg-fondo`, `--cbg-texto`, `--cbg-tenue` y `--cbg-linea` en `.cbg`
  (`app/second-brain/Grafo.tsx`). Todo lo demás ya las consume.
- **El detalle y el navegador comparten la columna**: al fijar un nodo, el navegador de
  áreas desaparece. Se decidió así para que la columna no salte, pero significa que para
  volver a la lista hay que soltar el nodo. Vive en `app/second-brain/Grafo.tsx`.

- **Persistir el layout** (`getSetting`/`setSetting` con la `huella` que ya calcula
  `cerebro-layout.ts`). Hoy se recalcula en cada carga: con 42 nodos son ~40 ms y no se nota,
  pero **arriba de ~80 nodos hay que persistirlo** (100 nodos ≈ 300 ms, 300 ≈ 1,45 s).
- **El efecto del onboarding**: `layoutCerebro` ya acepta `previo` y el test comprueba que
  los nodos viejos se mueven poco, pero nadie lo llama con eso todavía. Falta el camino
  incremental (pinear los viejos → `alpha(0.35).tick(90)` → despinear → `alpha(0.12).tick(60)`)
  y la interpolación de 700 ms en el cliente.
- **Histéresis del encuadre**: hoy se recalcula siempre, así que el mapa entero «respira»
  cuando entra un nodo. Debería conservarse mientras el bbox nuevo entre en el guardado.

Relacionado: [hallazgos-onboarding.md](hallazgos-onboarding.md) (de dónde salen los nodos, y
la trampa de importar un módulo con `server-only` desde un componente cliente).

### Las tarjetas de abajo eran la navegación en competencia con el mapa

**Vive en:** `app/second-brain/AreasHub.tsx` · `app/second-brain/Grafo.tsx` (`.cbg-nav-*`)

**Síntoma.** «Al pasar el cursor por una de las tarjetas de abajo, se comienza a mover la
pantalla de arriba abajo, es como que se bugea el grafo.»

**Causa.** No era el grafo. Cada tarjeta hacía `onResaltar(a.id)` en `onMouseEnter`, y ese
estado vivía en `VistaCerebro` —el padre de las DOS mitades—, así que rozar una tarjeta
re-renderizaba el árbol entero, y con él volvía a correr el `useEffect` de `AreasHub` que
hace `scrollIntoView({behavior:'smooth'})`. El síntoma aparecía en el mapa; la causa estaba
en un `onMouseEnter` a dos componentes de distancia.

**La regla.** Un estado compartido que lo enciende el HOVER es una animación de scroll a
60 fps esperando a que alguien mueva el mouse. Si un hover tiene que hablar con otro
componente, que hable por CSS (`:hover` en un ancestro común) o que no hable.

**Lo que quedó.** Las once tarjetas se fueron enteras y la lista de áreas pasó a la columna
de la derecha del mapa. El diagnóstico de fondo era el mismo que ya había echado a las once
tabs: **once cajas del mismo tamaño repitiendo lo que el mapa dibuja, puestas justo debajo
del mapa, son una segunda navegación que le compite.** En la columna se ven MIENTRAS se
mira el mapa, en vez de después.

### Una animación CSS no se repite porque le cambies la clase

**Vive en:** `app/second-brain/Grafo.tsx` (el `key` del `<g className="cbg-pop">`)

**Síntoma.** «SIEMPRE que se van o entran los nodos, con la animación de entrada y de
salida. No que simplemente aparezcan en el lugar.» La salida se veía; la vuelta no.

**Causa.** Una `animation` corre **al montar** el elemento. Agregarle y sacarle la clase
`.cbg-fuera` alcanza para que arranque la de salida (la clase TRAE una animación nueva),
pero al volver no hay animación nueva que traer: `cbg-in` ya estaba declarada desde el
montaje y ya terminó. El nodo aparecía plantado en su lugar.

**El arreglo, y dónde va.** `key={saliendo.has(n.id) ? 'fuera' : 'dentro'}` en el `<g>`
interno: al cambiar la key React desmonta y remonta, y la animación arranca de cero. Va en
el `<g>` **interno** y no en el de afuera a propósito — ese tiene el `transform` que
reescribe el rAF y los refs de la física, y remontarlo hace saltar al nodo a su posición
del server.

**El segundo error, más silencioso.** El retardo escalonado (`i * 12 ms`) salía del puesto
del nodo en el mapa ENTERO. Un filtro que deja 8 nodos podía darle al último el puesto 55:
**660 ms de lienzo vacío** antes de que apareciera, que se lee como que el filtro no hizo
nada. El ranking se calcula ahora sobre lo montado.

### Un filtro que es tres controles no es un filtro

**Vive en:** `app/second-brain/Grafo.tsx` (el estado `filtro`)

Había un desplegable de autoría, otro de «Ir a» y una pastilla de área que aparecía sola al
tocar un nodo. Tres controles para la misma pregunta —«¿qué parte del mapa estoy
mirando?»— se leen como tres filtros **combinables**, y no lo eran. Ahora es **un** estado,
una cadena con prefijo (`autor:` · `carpeta:` · `area:`), y de ahí sale todo: elegir una
sección apaga la carpeta sin que nadie tenga que acordarse de apagarla, porque no hay dos
estados que puedan contradecirse.

Y el icono de embudo fijo en el disparador no es decoración: el rótulo del botón es el
valor elegido («56 datos»), así que sin el icono el control se lee como un contador. Se le
agregó `icono` al `Dropdown` de la casa en vez de dibujar uno propio acá.

### Un `<div hidden>` de React deja la página sin hidratar y sin error

**Vive en:** cualquier verificación con `mcp__Claude_Browser__*`

El panel del navegador embebido, cuando no está a la vista, deja el documento en
`visibilityState: 'hidden'`. El HTML llega entero —se pueden contar 66 nodos con
`querySelectorAll`— pero el árbol queda adentro de un `<div hidden>` que React nunca
revela, así que **nada está hidratado**: los clicks no hacen nada, `getBoundingClientRect`
devuelve 0 y no hay un solo error en la consola. Las tres pistas mienten a la vez.

Se reconoce por `document.querySelector('body > div').hasAttribute('hidden') === true` con
`__reactFiber$` presente en la raíz y **ausente** en cualquier nodo de adentro.

**Para verificar interacción, Playwright** (`scripts/probar-solape.mjs` es el molde), que
corre en un Chromium visible de verdad. El navegador embebido sigue sirviendo para leer
CSS computado y medidas si se le saca el `hidden` a mano.

⚠️ Y el Chrome real puede estar viendo **otro servidor** en el mismo `localhost:3000`: acá
había un Service Worker de otro proyecto (`gym-shell-v2`) sirviendo su propio 404 mientras
`curl` contra el mismo puerto contestaba 307 correctamente. Si Chrome da 404 en una ruta
que `curl` resuelve, mirá `navigator.serviceWorker.getRegistrations()` antes que la ruta.

### El lienzo blanco contradecía la paleta que él mismo usaba

**Vive en:** `app/globals.css:65-96` (`--grafo-*`) · `app/second-brain/Grafo.tsx`

Las once `--grafo-*` traen escrito, desde que se crearon, que son «una paleta CUALITATIVA
que **solo vive adentro del lienzo oscuro del grafo**», y cada tono está justificado
midiendo contraste **contra #14161B**. La ronda anterior pintó el lienzo de blanco y nadie
—yo incluido— releyó ese comentario: `#BFC8DC` sobre blanco da **1,5:1**. Los nodos se
veían porque el ojo perdona, no porque el color funcionara.

**La regla:** antes de cambiarle el FONDO a algo, grepear los tokens que ese algo pinta
encima. Un token con un comentario que dice «sobre X» es un contrato, no una nota.

Medido sobre el fondo nuevo (#22262E), las once quedan entre **7,8:1 y 9,8:1** — todas por
encima de AAA. El oscuro no fue una variante: fue volver a la premisa.

### Una pantalla oscura se hace redefiniendo tokens, no reglas

**Vive en:** `app/globals.css` (`[data-tema="oscuro"]`) · `app/_components/TemaOscuro.tsx`

El inventario contó **40 usos de tokens claros** (`var(--surface)`, `var(--ink)`,
`var(--faint)`…) repartidos entre `Grafo.tsx`, `BuscadorCerebro.tsx` y `AreasHub.tsx`.
Tocarlos uno por uno era garantizar que el próximo se olvidara. Redefinidos en un scope,
los 40 se dan vuelta solos y el que agregue el 41 no tiene que saber que existe un tema.

Tres cosas que sí hay que hacer a mano, porque **no** son «el mismo token con otro valor**:

1. **Los tokens que existen PARA un fondo.** `--mako-ink` (#8F6709) está definido como «el
   dorado bajado de luminosidad para que se LEA sobre fondo claro». En oscuro da 2,97:1.
   No se inventa un cuarto dorado: en el scope apunta a `--mako`.
2. **Las relaciones invertidas.** La arista encendida era `--dim` (gris oscuro) y la
   apagada `--border-strong` (casi blanco). Sobre oscuro **la apagada pasaba a ser lo más
   brillante de la pantalla**. Dos tokens nuevos (`--cbg-arista`, `--cbg-arista-viva`)
   mantienen «encendida = más contraste» en los dos temas.
3. **`--focus-ring`** traía un halo interno de `var(--surface)`, que en claro es blanco.
   Sobre oscuro pintaba un aro blanco puro. El halo es el FONDO, no la superficie.

**Y en oscuro las superficies SUBEN de luminosidad, no bajan.** `--sidebar-2` (#1E212A)
parece la elevación natural y es **más oscuro** que el fondo del lienzo: 1,06:1.

### El `<script>` inline del tema no es un duplicado del `useEffect`

**Vive en:** `app/_components/TemaOscuro.tsx`

Un `useEffect` corre después de hidratar: entre el primer pintado y esa línea hay un flash
blanco a pantalla completa. El script inline corre mientras el navegador todavía parsea.
Y el efecto sigue haciendo falta para lo que el script no cubre: volver a la ruta por
navegación de cliente, donde no hay documento nuevo. El **cleanup** es la tercera pata —
sin él, ir de /second-brain a /plan deja el tablero entero oscuro.

### El estado vacío del filtro era inalcanzable porque la raíz siempre pasa

**Vive en:** `app/second-brain/Grafo.tsx` (`esDato`, `datosVisibles`)

`montados.length === 0` nunca se cumplía: el nodo raíz pasa el filtro por diseño (sin él
las áreas cuelgan de la nada), así que el mínimo alcanzable era **1**. Filtrando por una
sección vacía quedaba el nodo raíz solo en el lienzo, sin un mensaje que dijera qué pasó —
y el `NoResults` estaba escrito y montado.

El mismo error contaminaba el «N de M»: decía **66 de 66** mientras la barra decía «56
datos», dos números para la misma cosa. Los dos salen ahora de `esDato`.

**La regla:** cuando una colección tiene elementos de ANDAMIO que están exentos del filtro,
ningún conteo de cara al usuario puede salir de la colección cruda.

### El dorado no es «esto elegiste»

**Vive en:** `app/second-brain/Grafo.tsx` (`.cbg-nav-fila[aria-pressed]`)

La fila marcada del navegador se pintaba con `--mako-bg` y la carpeta activa con
`--mako-ink`. En la regla de color de la casa el dorado significa **MaKo** («acá intervino
la inteligencia») y el azul significa **vos actuás** (selección, foco). Una fila marcada
porque el usuario la tocó pintada de dorado dice que la eligió MaKo. Es el mismo error que
ya se pagó cuando `--grafo-norte` valía exactamente `--mako`.

En un lienzo oscuro esto además tiene un costo extra: el §7.4 lista «interfaz de cripto o
casino por **exceso de negro y dorado**» entre los seis antipatrones.

### GOTCHA: el CSS compilado va atrás del archivo

**Vive en:** cualquier edición de `app/globals.css` con el dev server arriba

Se editó `globals.css`, se reinició el server, y la regla nueva **no estaba** en el chunk
servido — ni por `curl` ni en el navegador. El diagnóstico obvio (y equivocado) fue
«Tailwind está tirando mi regla»: es plausible, porque el archivo pasa por
`@import "tailwindcss"` y tiene un `@theme inline` que sí se come cosas.

Era **latencia de compilación**. La prueba que lo aisló en un paso: meter una variable
sonda tonta (`--tema-sonda: 7px`) adentro de `:root` y preguntar por ella en el navegador.
Si la sonda tampoco aparece, el archivo no se recompiló; si aparece y tu regla no, ahí sí
el problema es la regla. Con el arranque en OneDrive esto puede tardar más de lo que uno
espera antes de dar por muerta una hipótesis.

### `Pagina` no tiene full-bleed, y `100vw` no es el reemplazo

**Vive en:** `app/_ui/Pagina.tsx:27-63`

`ancho="completo"` saca el `maxWidth` pero **conserva el padding** de 34/44 px, y el
`style` está tipado sin `maxWidth`/`width`/`margin*`: el compilador rechaza el ancho. Para
sangrar de verdad hay que anular ese padding con márgenes negativos CONOCIDOS
(`margin-inline: -44px; padding-inline: 44px`) en el hijo.

⚠️ El truco de `left:50% + width:100vw + translateX(-50%)` que usa la landing
(`app/vsl/_detalle/FeatureDetail.tsx:391`) **no se puede copiar adentro de la app**: ahí el
sidebar está escondido y el `<main>` ocupa el viewport, pero en una pantalla interna el
`<aside>` se lleva 68 px del flujo, así que `100vw` sobresale y mete scroll horizontal en
toda la página — la misma falla que AGENTS.md ya documenta para las barras de gráfico.

En este rediseño no hizo falta ninguna de las dos: si la página ENTERA es del color del
lienzo, no hay banda que sangrar.

### Claude y Anthropic son dos marcas, y estaban cambiadas

**Vive en:** `app/_components/icons.tsx` (`RafagaClaude`) · `app/_components/ServicioVisual.tsx` (`ic-claude` / `ic-anthropic`)

El repo tenía los DOS logos y los usaba al revés donde importaba. `ic-anthropic` es el
logotipo de la EMPRESA (la «A\»); la ráfaga de once radios es la marca del PRODUCTO. La
integración con la que el cliente habla llevaba el logo de la empresa, y la ráfaga —que
ya existía, bien dibujada— se usaba en **un solo lugar** de todo el repo: el avatar del
historial de `/admin/dev`.

**La regla:** el tile de una integración lleva la marca de **con qué** te conectás. Con la
API key te conectás con Anthropic (ahí el logotipo está bien); con la skill te conectás
con Claude.

Y el dibujo no se copió: `RafagaClaude` devuelve el `<g>` sin el `<svg>` de afuera, así
que el mismo path sirve como componente y como `<symbol>` de `BrandDefs`. Dos copias de
una marca ajena garantizan que una quede vieja.

### «Claude Code» nombraba la puerta, no lo que hay adentro

**Vive en:** `lib/integraciones-catalogo.ts` · `lib/servicio-slides.ts` · `app/_components/TutorialAgente.tsx` · `lib/agente-skill.ts`

La integración se llamaba «Claude Code» y su tutorial abría con «¿Programás con Claude
Code?». La skill es **un archivo de texto**: funciona en cualquier Claude que lea skills,
y el que la usa no está programando — está escribiendo un anuncio o decidiendo un precio.
El nombre y el copy dejaban afuera a la mayoría de los clientes.

**Y la skill se había quedado corta con su propio código.** Su `description` —lo que
decide cuándo el modelo la activa— hablaba solo del plan, cuando ya expone el contexto
completo del negocio (`/api/agente/contexto`, seis bloques) y tres secciones grandes bajo
demanda (razones, panorama, productos). Una skill cuya descripción no nombra la mitad de
lo que sabe hacer es una skill que no se activa cuando hace falta: el modelo lee la
descripción, no el código.

**La regla:** cuando se le agrega una capacidad a una skill, se toca **la descripción del
frontmatter** en el mismo commit. El cuerpo lo lee el modelo cuando ya decidió usarla; la
descripción es lo único que lee para decidir.

### El exportador no sabía nada del filtro, y su conteo tenía tres copias

**Vive en:** `lib/vault-modelo.ts` (`esArchivo`) · `app/api/second-brain/exportar/route.ts` · `app/second-brain/ExportarCerebro.tsx`

El mapa filtra por carpeta, sección, autoría y búsqueda; el ZIP solo sabía de áreas. Se
podía dejar el mapa en 15 datos y bajar 52.

Dos decisiones que valen para el próximo:

1. **Se manda el RESULTADO, no los criterios.** La ruta recibe la lista de ids visibles,
   no el filtro. Mandar los criterios obligaba a reimplementar en el servidor el
   predicado que ya existe en el navegador —tres dimensiones más dos búsquedas— y dos
   implementaciones de «qué se ve» divergen. Este archivo ya pagó ese bug entre el README
   y las carpetas.
2. **`esArchivo` es ahora la única condición.** Estaba escrita tres veces con tres
   redacciones: en `construirVault`, en `conteoPorArea` y en el filtro del README. El
   síntoma histórico fue «5 archivos» en una carpeta con 3. El test que lo blinda
   (`tests/vault.test.ts`) compara el número del README contra los archivos reales de
   cada carpeta, y es el que hay que correr ante cualquier cambio acá.

**Y el nombre del ZIP salía de los IDS.** Los ids siguen siendo `norte` y `panorama` —
vocabulario interno renombrado en pantalla dos rondas atrás — y aparecían tal cual en
`segundo-cerebro-…-norte-panorama-documentos-….zip`, con la última palabra cortada al
medio por un `slice(0, 40)`. Un id no es un nombre: si sale a la cara del usuario, sale
del `nombre` del catálogo.

### El `animationDelay` en línea se lo come CUALQUIER animación

**Vive en:** `app/second-brain/Grafo.tsx` (el `<g className="cbg-pop">`)

**Síntoma.** «La animación de salida no funciona, no desaparecen, se bugean.» Segunda
ronda del mismo síntoma: la primera causa (el frame de más del `useEffect`) estaba
arreglada y medida, y aun así se veía mal.

**Causa.** El retardo escalonado de la ENTRADA —`animationDelay: i*12ms`, hasta 700 ms—
está puesto en el `style` del elemento, y un `animation-delay` no pertenece a una
animación: se aplica a la que esté corriendo. Cuando el nodo pasaba a salir, su
`cbg-out` heredaba el mismo retardo. Y el desmontaje corta a los 260 ms: **todo nodo con
más de 260 ms de retardo nunca empezaba su fade** — se quedaba a opacidad plena y
desaparecía de golpe. Como la mayoría de los que se van caen en ese rango, la salida
parecía no existir.

**La regla.** Un `animation-delay` inline es un delay para el ELEMENTO, no para la
animación que uno tenía en mente. Si el mismo elemento corre dos animaciones en momentos
distintos, el retardo se decide por estado. Y el temporizador que desmonta tiene que ser
`retardo máximo + duración`, nunca solo la duración.

Medido después: 66 nodos montados con 47 saliendo, opacidad 1,00 → 0,00 en 11 frames, y
recién ahí el desmontaje a 19.

**Lo que este bug enseña sobre el anterior:** la primera medición —«la cuenta de nodos no
baja de 66 en ningún frame»— era correcta y estaba incompleta. Verificaba que los nodos
siguieran MONTADOS, no que se estuvieran VIENDO animar. Un nodo montado a opacidad 1
durante toda su «salida» pasa ese chequeo. La medición ahora mira la opacidad.

### Un filtro y un exportador que preguntaban lo mismo de dos maneras

**Vive en:** `lib/cerebro-filtro.ts` · `app/second-brain/ExportarCerebro.tsx`

El mapa filtraba por carpeta, sección y autoría con un desplegable de drill-down; el
exportador preguntaba con diez casillas de área. Coincidía **una** de las tres
dimensiones, así que «bajame lo que dedujo MaKo en Oferta» no se podía expresar: la
autoría no existía del lado del ZIP.

Lo que quedó, y el orden importa:

1. **El predicado salió a `lib/cerebro-filtro.ts`**, sin `server-only`. Vivía adentro de
   un componente de 1.700 líneas, o sea que la única regla que decide qué dato EXISTE
   para el usuario no la podía importar ningún test. Ahora tiene ocho.
2. **El exportador monta el MISMO componente de filtro**, no uno parecido. El que
   aprendió a filtrar el mapa ya sabe exportar.
3. **Su filtro es una COPIA** (`clonarFiltro`), sembrada con la del mapa. Un modal que
   reescribe la pantalla que lo abrió deja al usuario en otro lado al cancelar. Y los
   `Set` tienen que ser propios: `FILTRO_VACIO` es una constante compartida y sus Sets
   son mutables — usarla como estado inicial de dos pantallas las ata entre sí.
4. **El modal muestra el ÁRBOL que va a salir**, no un número. Un filtro dice qué NO
   entra; en una descarga lo que importa es qué SÍ.

**La asimetría del andamiaje, que es lo que el test blinda:** la raíz, las carpetas madre
y los nodos de área SÍ se apagan al filtrar por carpeta o sección —dejarlos dibujados es
no haber filtrado— pero quedan EXENTOS de la autoría, porque no tienen autoría propia y
sacarlos deja las etiquetas flotando sin racimo. Leyendo el código no se nota; en un test
son tres líneas.

### La skill se instalaba en el lugar de desarrollador

**Vive en:** `lib/agente-skill.ts` (`AGENTE_SKILL_PATH_USUARIO`) · `app/_components/TutorialAgente.tsx`

**Síntoma.** El dueño pegó la skill en su Claude Code y le contestó: «No hay ninguna skill
`mako-plan` instalada — ni en el proyecto ni en tu carpeta global `~/.claude/skills` (ahí
solo están las de `hyperframes-*` y `media-use`)», y le ofreció crearla él.

**Nada estaba roto**, y por eso costaba verlo: Claude reconoció el texto, dedujo que era
una skill y ofreció el lugar correcto. El tutorial funcionaba **porque el modelo lo
arregló**, no porque estuviera bien.

**Las dos causas, y las dos son de producto:**

1. **La ruta era de PROYECTO.** `.claude/skills/…` existe solo adentro de esa carpeta. Es
   la respuesta de desarrollador. Un cliente de MaKo no tiene «un proyecto»: abre Claude
   donde sea y espera que sepa de su oferta. La que corresponde es la GLOBAL del usuario
   (`~/.claude/skills/…`), que además es donde el propio Claude Code busca — lo dice en su
   mensaje de error, que es de dónde salió el diagnóstico.
2. **El flujo pedía un gesto que nadie hace.** «Creá el archivo y pegá la skill adentro»
   contra lo que la gente hace de verdad, que es pegar el texto en el chat.

**Lo que quedó, y es la parte reusable:** el texto de la skill **arranca explicando qué
hacer con él**. Si te lo pegan en un chat, la primera sección dice que todavía no está
instalada, dónde va y que después siga con lo que estaban haciendo. Pegarlo ES instalarlo,
sin depender de que el modelo adivine.

**La regla:** un artefacto que se entrega por copiar-y-pegar tiene que llevar adentro sus
instrucciones de instalación. El tutorial de la app lo lee quien lo copia; el que lo
recibe es otro —una persona en otra máquina, o un modelo— y ese solo tiene el texto.

## Abrir un área por URL: el `?area=` y el `useRef` que lo hacía inútil

Otras pantallas mandan al cerebro a hacer algo concreto —el selector de oferta del CRM manda
a crear una— y hasta ahora aterrizaban en el mapa entero, o sea en «buscala vos». `?area=` lo
abre: `VistaCerebro` inicializa `abierta` con el valor de la URL, validado contra `AREAS`
(un valor cualquiera no abre nada).

**Lo que casi lo deja decorativo:** el efecto que scrollea al panel tiene una guarda que
saltea la corrida de montaje —existe porque sin ella la página arranca scrolleada abajo— y
esa guarda se come justo el único caso del deep link. La cura es que la guarda mire el
estado de montaje en vez de ser una constante: `useRef(abierta === null)`. Con algo ya
abierto al montar, el scroll de la primera corrida es EL que se quería.

Es la familia de «escribir la salida no es ofrecerla»: el `?area=` compilaba, el panel se
abría, y el que llegaba desde otra pantalla quedaba igual de perdido que antes.

**Vive en:** `app/second-brain/VistaCerebro.tsx` · `app/second-brain/AreasHub.tsx` ·
*2026-09-26*

## Las reglas del mapa salieron de Grafo.tsx: el teléfono las lee igual (16/10/2026)

El Second Brain del teléfono (app/m/second-brain) necesitaba contar los datos de cada área, pintar cada punto
y saber qué documento se puede mirar, y esas reglas vivían ADENTRO de Grafo.tsx (`'use client'`, ~1.950
líneas): `porArea`, `grados`, `rellenoDe`, `urlPreview`, `esImagen`, `sePuedeVer`. Lo mismo con la subida
del Archivero (los tres pasos de `analizar`, ACCEPT y el rótulo de «Analizar») en app/onboarding/Archivero.tsx.
Un módulo de cliente no se puede llamar desde el server ni importar sin llevarse la pantalla entera, así que
se mudaron a **lib/cerebro-areas.ts** y **lib/archivero-subida.ts** (puros) y escritorio pasó a importarlas.

- **El conteo de «Tu negocio» no cuenta estructura ni pendientes** (`esEstructura`: raíz, `n1:`, `area:`):
  un «3 datos» que incluye lo que falta miente. Un área sin datos no aparece en el conteo: quien dibuja
  escribe «falta», nunca un 0.
- **La ruta de la vista previa va SIN `?ws=`** (`rutaVistaDocumento`) y la pega quien la usa
  (`conWs(…, wsDeBusqueda(location.search))` en escritorio, `useWs()` en el teléfono): un `<iframe>` o un
  `<a target=_blank>` no pasan por el parche de fetch, y el super-admin mirando a un cliente recibía «Archivo
  no encontrado».
- **Un nodo `falta:<área>` es un pendiente con el nombre del área** (lib/cerebro-grafo.ts:936-950): listado
  adentro de su área duplica el vacío. El teléfono lo saca de la hoja del área y lo deja en la búsqueda.

Lo que fija que no vuelva la copia: tests/m-second-brain.test.ts (Grafo.tsx con su `porArea` a mano, con la
ruta de la vista previa escrita o Archivero.tsx con su fetch a /upload-url dan 10 / 1 cada uno).
⚠️ Archivero.tsx conserva su normalización del link pegado (en main se llama `urlDelLink`, 607ceb205): no se
pasó a `normalizarUrlArchivero` para no pisar ese renombre.

**Vive en:** lib/cerebro-areas.ts · lib/archivero-subida.ts · app/second-brain/Grafo.tsx ·
app/onboarding/Archivero.tsx · app/m/second-brain/modelo.ts · tests/m-second-brain.test.ts · *2026-10-16*

## De dónde vino cada documento de El Archivero (17/10/2026)

**Síntoma:** desde el 15/10 el chat de Offer deja sus archivos en El Archivero, y desde el 17/10 el onboarding
deja «Lo que vendes»; en la lista se veían igual que lo que la persona subió a mano, y `archivero_files` no
tenía dónde decirlo (docs/relevo/offer.md lo dejaba «pide migración»).
**Ahora:** columna `origen` (mig **0316**, con CHECK: `archivero`, `link`, `offer`, `onboarding`; NULL = de
antes). Cada puerta pasa el suyo a `insertFile`, y la lista dice «Del chat de Offer» / «Del onboarding» al
lado del tamaño (lo subido acá no lleva rótulo).
**La trampa del orden de despliegue:** la columna puede llegar antes o después del código. `leerConOrigen` e
`insertarConOrigen` (lib/archivero-registro.ts, puros) reintentan SIN `origen` sólo ante 42703 / PGRST204 que
nombran `origen`; cualquier otro error vuelve tal cual (un 23505 reintentado insertaría dos veces).
**Regla:** una puerta nueva que guarde en El Archivero pasa su `origen`; un origen nuevo va a
`ORIGENES_ARCHIVERO` (lib/archivero-subida.ts) Y al CHECK, con migración (tests/archivero-origen.test.ts
compara las dos listas).
**Sin hacer:** la 0316 sin aplicar en Supabase (el número lo pone el Cerebro: la 0314 la tenía B1-infra); el
Second Brain del teléfono (app/m/second-brain) no muestra el origen.

**Vive en:** lib/archivero-registro.ts · lib/archivero-subida.ts · lib/archivero.ts (`insertFile`, `pubFile`)
· app/onboarding/Archivero.tsx · supabase/migrations/0316_archivero_origen.sql · *2026-10-17*

## Ops Center del cliente: «el chat de X no llegó» se mide en la base, nunca mirando la pantalla como super admin (20/10/2026)

- **Síntoma:** en /second-brain?ws=21 sólo se ve el chat «Second Brain», sin la conversación de Offer de la clienta.
- **El diagnóstico obvio («no se creó el hilo») es la mitad del problema.** En el ws21 no había ninguna fila de `chart_sessions` (medido). Pero aunque el hilo exista para el cliente, el super admin que mira el ws no lo ve.
- **Por qué no lo ve:**
  - Los chats del Ops Center son POR PERSONA DE QUIEN ESTÁ LOGUEADO: `chart_key = mako-movil:<persona>`, armada con `chartKeyDePersona(getUsuarioActual())` (lib/mako-turno-app.ts:112).
  - `getUsuarioActual` devuelve al super admin, no al usuario del ws impersonado.
  - El comentario de pagina.tsx («el super admin ve lo que ve el cliente») vale para el Centro, no para la lista de chats.
- **Regla:** para saber si a un cliente le llegó un chat, medir `chart_sessions` por `workspace_id` + la `chart_key` del usuario del cliente (`mako-movil:u<id>`).
- **Otras dos trampas del mismo lugar:**
  1. `listSessions` compara la clave EXACTA (lib/chart-chats.ts:82). Los chats de la misma tabla y el mismo motor con sufijo (`mako-movil:<p>:crm:N`, `:lead:N`) no aparecen en el Ops Center.
  2. Un hilo que se COPIA «al terminar el onboarding» (`hiloDelOnboarding`) sólo nace si el cliente pasa por la pantalla «listo» DESPUÉS del deploy. Los que ya terminaron (el ws21, el 18/10) quedan sin nada, y lo que se hable después en /offer tampoco llega. Para Offer conviene una proyección que lea `offer_sesiones` por workspace (decisión 5 de docs/diseno-mako-ai-native.md), no una copia.
- **Sin hacer** (archivo donde vive): el índice de chats por origen no existe (lib/chat-mako-indice.ts sólo lee chart_sessions, «Antes» y un lector del grupo que nadie llama).

**Arreglado (20/10, Ops Center 3, f3c377318 + bb031718c):** la proyección de la decisión 5 (`chatsDeOffer`/`hiloDeOffer`, lib/chat-mako-indice.ts, con `PROYECCIONES` de origen y alcance). Se ve en /second-brain como la sección «Offer», un sub-chat por conversación con «Seguir en Offer», y en el teléfono en «Tus chats». La conversación del onboarding no se proyecta si ya tiene su `hiloChat`. Medido: ws21 #14 dibuja 32 de 33 mensajes (uno vacío). Falta enchufar CRM, Automations y el grupo al mismo índice.

## El marco de bloques: lo que el chat DIBUJA vuelve sin recargar (20/10/2026, ola 1, pieza 1.7)

**Vive en:** `lib/chat-bloques.ts` (el contrato y el saneo, puro) · `app/_chat/BloqueHilo.tsx` (la pieza única) ·
`confirmarDesdeTarjeta` en `lib/mako-turno-app.ts` · `itemsTrasTarjeta` en `app/m/mako/chat-ui.ts` · `app/_chat/chat.css`.
Probado en `tests/chat-bloques.test.ts`, que confirma `crear_diseno_imagen` de punta a punta contra una base de mentira
(`tests/_bloques-tarjeta-hijo.ts`).

- **Síntoma:** confirmar una creación dejaba la píldora «Completo» y un «Hecho: Creado. Ábrelo aquí: https://…» en
  texto. La miniatura y el botón aparecían recién al recargar, y sólo como link.
- **Causa:** el runner devolvía `datos` (`disenoId`, `link`), pero `confirmarDesdeTarjeta` guardaba y devolvía sólo el
  `resumen`. El resultado no tenía un campo que la pantalla supiera dibujar.
- **El contrato:**
  - el runner devuelve `datos.bloque`, armado con SUS datos y rutas, nunca con el texto del modelo;
  - la tarjeta lo sanea (`sanearBloque`: sólo rutas de la app; la miniatura, una ruta de la app o la pública de Storage);
  - lo guarda con el «Hecho» en `chart_chats.bloques` como `{ k: 'bloque', b }`, al lado de los adjuntos y sin
    correrles el índice, porque los mensajes de MaKo no llevan adjuntos;
  - y lo devuelve en `ResultadoTarjeta.bloques`.
- **Regla:**
  - la pantalla suma lo que vuelve de una tarjeta con `itemsTrasTarjeta`, en las CUATRO pantallas (Ops Center, CRM,
    MaKo Analyst de la ficha y teléfono): una no puede mostrar la miniatura y otra no;
  - el bloque se dibuja con UNA pieza en las tres caras del hilo.
- **Trampas:**
  - **`max-height` sobre un marco con `aspect-ratio` le rompe la forma.** La miniatura cuadrada salía recortada abajo en
    la computadora. El alto tope tiene que achicar el ANCHO: `--r` (ancho / alto) en `.ch-creado__mini`.
  - **Un navegador sin ventana no baja de ~500 px de ancho.** La captura «de 390» no era la del teléfono. El teléfono
    se mira en un `iframe` de 390, y así también aplican los tamaños de letra del teléfono.
  - **La vista previa sin Tailwind miente con los anchos.** La app pone `box-sizing: border-box` a todo
    (`app/globals.css`). Una página de prueba con sólo los tokens no lo trae, y los campos «se salían» de la tarjeta.
  - **La pieza no puede importar CSS**, o no se dibuja en un test de node. Sus clases van en `chat.css`, que el teléfono
    carga con `PegadoHilo.tsx` y el MaKo Analyst de la ficha importa aparte.

**Sin hacer:**
- ~~Lo que dibuja un TURNO y no una tarjeta.~~ Hecho el 21/10. No fue `RespuestaTurno.bloques`: el bloque va COLGADO DEL
  MENSAJE de MaKo, así vuelve al recargar. Lo producen:
  - la pregunta de la 1.9;
  - una LECTURA que devuelve `{ content, bloque }` (el camino de Pagos, d9e69e7a1: «A quién cobrar», un gráfico de
    Dashboard);
  - una PROPUESTA de pantalla con `extra.bloque` (el antes y el después del Video Editor).
  Las dos pasan por `ejecutarOperacion` → `ctx.aDibujar`, que sólo abre el turno de la app. El modelo no lo ve, y en
  WhatsApp o por HTTP se descarta. Una propuesta de pantalla que ya trae su bloque no se dibuja dos veces.
- **Lo obvio era el error: «leer un campo `bloque` de cualquier JSON de salida»** (`bloqueDeSalida`, la mañana del 21/10).
  Funcionaba, pero chocaba con cualquier salida que ya tuviera un campo con ese nombre (la ficha arma `bloques`), y el
  tipo de la herramienta no lo decía. Se sacó: lo que una herramienta dibuja va TIPADO en su respuesta. Un bloque por
  herramienta; una lista (las landings de un negocio) es UN bloque.
- **Una opción tocada mientras MaKo trabajaba** (G1, la revisión del 21/10) decía «Respondiste: X» y no mandaba nada:
  `PreguntaHilo` marcaba antes de mandar y no miraba si salió. Ahora las opciones esperan mientras trabaja (`ocupado`),
  `onResponder` dice si salió, y contestar ESCRIBIENDO apaga las opciones en el acto: las pantallas dibujan con
  `conRespuestas`, no sólo al recargar.
- G4 sin «Deshacer»: no hay una operación que deshaga un cambio de textos.
- G6 sin consultar el estado solo: la 1.11.
- Las demás áreas no devuelven `bloque` todavía. Por ahora lo devuelven `crear_diseno_imagen` y `duplicar_diseno_imagen`
  (G5) y `cambiar_textos_diseno_imagen` (G4).
- El «Abrir» lleva a la ruta de la computadora también en el teléfono: la 1.8.

## «Abrir en la app», y lo confirmado afuera vuelve al hilo (20/10/2026, ola 1, pieza 1.8)

**Vive en:** `linksDeUnaAccion`, `rutaConQuery`, `propuestaDePantalla` y `abrirDeResultado` en
`lib/mako-turno-app-reglas.ts` · `lib/chat-hilo-origen.ts` · `proponerPantallaGenerica`, `aplicarPropuestaGenerica` y
`descartarPropuestaGenerica` en `lib/api-mako/acciones.ts` · `conTarjeta` en `app/m/mako/chat-ui.ts`. Probado en
`tests/chat-abrir.test.ts`, que confirma y descarta en /mako/revisar por el camino real (`tests/_revisar-hilo-hijo.ts`).

- **Síntoma:**
  - una edición de video o un borrador de WhatsApp quedaban propuestos y la persona no recibía con qué abrirlos;
  - lo que se confirmaba en /mako/revisar no aparecía en el chat de donde salió.
- **Causas:**
  - `linksDeUnaAccion` sólo capturaba links con `/revisar/`. La propuesta de video (`/video-editor/<p>?propuesta=<id>`) y el
    borrador (`/whatsapp?…&chat=<jid>`) no pasan por ahí.
  - La propuesta guardaba el CANAL (`app`) pero no el CHAT: confirmarla afuera no tenía dónde anotar.
- **Lo obvio era el error:** «falta el link en la respuesta del modelo». El modelo NO puede escribir links (`CANAL_APP`), y
  está bien: el link lo captura el código de la salida de la acción.
- **Regla:**
  - una propuesta de pantalla guarda la clave de su chat (`datos.canalKey`);
  - confirmarla o descartarla en su pantalla anota «Hecho: …» o «No se ejecutó…» en ESE hilo, con lo que dibuja el
    resultado (`anotarEnHiloDeOrigen`);
  - la sesión se busca en el negocio que confirma: la clave de un chat de otro negocio no anota nada;
  - nunca tira: la acción ya quedó hecha.
- **Trampa:** `rutaDeEscritorio` corta la query, y en estas dos pantallas la query ES lo que se abre (`?propuesta=`,
  `?chat=`). `rutaConQuery` la deja, sin el `ws` (lo pone el `Link`), y sólo para links de la app.

**Sin hacer:**
- `?propuesta=` todavía abre el panel con TODAS las propuestas: es del Video Editor (1.14).
- El borrador lleva a `/whatsapp`, todavía no a la conversación en `/chats`: es del CRM.
- La propuesta de video y el borrador de WhatsApp no vuelven al recargar: viven en sus tablas, sin la clave del chat. Las
  genéricas sí vuelven desde la 1.10.
- El «Hecho» de /mako/revisar aparece al volver a abrir el chat, no en vivo en una pestaña abierta.
- Las propuestas creadas antes del 20/10 no tienen la clave de su chat: no vuelven.

## Confirmar ADENTRO del chat: el formulario de /mako/revisar en la tarjeta (20/10/2026, ola 1, pieza 1.10)

**Vive en:**
- `app/_chat/FormularioEnChat.tsx`, con sus acciones en `app/_chat/acciones-formulario.ts`;
- `app/mako/revisar/formulario.tsx`: los campos, que comparte con `RevisarAccion.tsx`;
- `formularioDe`, `conFormulario` y `pantallasDelChat` en `lib/mako-turno-app.ts`;
- `propuestasPendientesDelChat` en `lib/propuestas.ts`.

Probado en `tests/chat-adentro.test.ts`, que reabre un chat por el camino real (`tests/_adentro-hijo.ts`).

- **Antes:** el 42% de lo que el chat puede hacer (148 de 350) mandaba a otra pantalla, y 121 de esas a /mako/revisar.
- **Ahora:** una propuesta genérica despliega en la tarjeta el MISMO formulario de su pantalla:
  - los mismos campos y la misma validación;
  - los mismos botones («Confirmar acción», «Descartar propuesta»);
  - la misma acción (`confirmarAccionAction`, por la ruta /api/mako/propuesta: ver la 1.11), que vuelve a validar, a
    mirar que sea el admin y a preparar contra la base.
  - «Abrir en la app» queda como salida secundaria.
  - Al terminar, lo que dibuja el resultado (su G5 o su «Abrir») queda en la tarjeta, sin recargar.
- **Al reabrir el chat, sus propuestas pendientes vuelven con el formulario.** Se buscan por la clave del chat que guarda
  la propuesta desde la 1.8. Antes una propuesta de pantalla se veía sólo en la sesión de la pantalla donde nació: al
  recargar quedaba «Te lo dejé listo para que lo confirmes» sin nada para confirmar.
- **La cuenta del 20/10:** se confirman afuera 52 de 351 (14,8%). 45 son las dos excepciones declaradas en §2.5:
  - 34 ediciones de video que se aceptan en el editor (D7a);
  - 11 que mueven plata (D2): vuelven SIN formulario y se confirman en su pantalla.
  Sin ellas quedan 7 (2%): 4 de `/plan/revisar`, 2 de `/crm/revisar` y el borrador de WhatsApp. El test falla si una
  pantalla nueva se suma a las de afuera.
- **Regla:** quien no es admin ve el formulario y no lo confirma. La acción lo vuelve a mirar igual (`ctxDeBandeja`).
- **El cliente lee rótulos de persona** (la revisión del 21/10): el formulario mostraba «leadId» con la ayuda escrita
  para el modelo («id del lead (de buscar_leads).») y la consecuencia con `escribe` («upsert … closing_analyses»). Ahora
  `Campo paraCliente` usa `rotuloDeParametro` (el `rotulo` viaja en `plano`) y no muestra la ayuda; un id o un JSON van
  como los propuso MaKo (`ocultoAlCliente`); la consecuencia dice sólo si se deshace. **Regla:** lo que el registro
  escribe para el modelo (`descripcion`, `escribe`) no se le muestra a un cliente.

**Sin hacer:**
- `/plan/revisar` (el borrador de tareas) y `/crm/revisar` (`TablaRevisionLeads`) todavía no entran con su vista: la 1.10 b.
- Lo que mueve plata espera a la D2.
- /mako/revisar sigue rotulando con el nombre del parámetro y su ayuda (`Campo` sin `paraCliente`).

## Los trabajos largos siguen por detrás, y su resultado queda en el mismo mensaje (20/10/2026, ola 1, pieza 1.11)

**Vive en:** `lib/chat-trabajos.ts` (`enSegundoPlano`, `estadoDeTrabajo`) · el camino largo de `confirmarDesdeTarjeta`
(`lib/mako-turno-app.ts`) y de `confirmarAccionAction` (`app/mako/revisar/[id]/acciones.ts`) · `TrabajoHilo` en
`app/_chat/BloqueHilo.tsx` · GET `/api/mako/chat?trabajo=`. Probado en `tests/chat-trabajos.test.ts`, de punta a punta con
un runner que tarda 5,5 s (`tests/_trabajos-hijo.ts`).

- **Síntoma:**
  - confirmar algo lento dejaba la pantalla en «MaKo está escribiendo… puede tardar un par de minutos», sin avance
    (replicar una landing: unos 275 s, con un tope de 420);
  - con la pestaña cerrada a mitad, el resultado no aparecía en ningún lado.
- **Causa:** la confirmación corría el trabajo ADENTRO del pedido, y el hilo se escribía recién al final.
- **Regla:**
  - una operación `lenta` se confirma y responde enseguida;
  - se anota «En curso: …» con un G6 y el trabajo corre por detrás (`after()`, con el maxDuration de la RUTA que
    confirma: nunca una server action, ver la trampa de abajo);
  - al terminar, ESE mensaje se reescribe a «Hecho: …» con su G5 o su «Abrir»;
  - el resultado lo ve quien consulta, quien vuelve con la pestaña cerrada y el modelo en el turno siguiente;
  - si no se puede anotar el avance, corre como antes: un trabajo nunca se pierde por no poder mostrarse.
- **La consulta es una LLAVE** (`<id del mensaje>.<token>`). El id solo no alcanza: con él, cualquiera del negocio leía
  el mensaje de otro chat.
- **Trampas:**
  - Una propuesta de pantalla anota su «Hecho» en su hilo (1.8). Por detrás va con `sinAnotar`, o el hilo queda con dos
    mensajes del mismo trabajo.
  - `generar_landing_con_ia` ya estaba marcada `lenta`, pero `lenta` sólo llegaba al catálogo y al texto de la
    referencia: ningún chat la usaba.
  - **Una server action toma el techo de la PÁGINA** (la revisión del 21/10): el formulario del chat confirmaba por
    `confirmarAccionAction`, con 60 s en /crm, y el trabajo de `after()` moría ahí: «En curso» para siempre y la
    propuesta trabada. Ahora va por /api/mako/propuesta (420 s, `tests/mako-doer-plazo.test.ts`).
  - **Un trabajo que muere no avisa:** ni el `catch` ni el «Hecho» corren, y si el «Hecho» final no se guarda, tampoco.
    El G6 lleva `hasta` (`PLAZO_TRABAJO_MS`, 480 s); pasado eso `estadoDeTrabajo` lo da por cortado y lo deja escrito
    (`textoCortado`: «No sé si terminó… revísalo antes de pedirlo de nuevo»). NO suelta la propuesta ni la pendiente: no
    se sabe si corrió, y soltarla invita a hacerla dos veces (la propuesta queda en «Fallidas» de /mako/revisar).
  - **La pantalla no pregunta para siempre** (un 404, o `MAX_CONSULTAS`), dibuja lo que pasó en palabras (una falla era
    sólo un punto rojo: «Falló» estaba en `.ch-oculto`) y la tarjeta o el formulario que lo lanzó pasa a «Hecho» o
    «Falló» (`deTarjeta`, `trasTrabajo`, `onTermina`).
  - **La consulta previa de la tarjeta miraba sólo el id:** con la pendiente de OTRO chat (los ids son correlativos)
    anotaba «En curso», y servía para ver qué hay vivo en otros. Ahora tiene que ser de este chat y pasar el gating de
    quien toca; si no, el camino de siempre contesta el error sin escribir en el hilo.
  - **Cortado no es «falló»** (la segunda revisión): el corte pintaba el paso y la tarjeta en rojo, «Falló», al lado de
    «No sé si terminó»; si el trabajo SÍ había terminado (falló sólo el «Hecho» final), la persona lo pedía de nuevo. El
    paso queda `incierto` («Sin saber»), `leerConsulta` da `ok: null` y la tarjeta dice «Revísalo» (`incierta`).
  - **Al recargar, la burbuja «En curso: …»** quedaba al lado de un G6 que ya había terminado. Un mensaje cuyo G6 sigue
    en curso se dibuja sólo con su G6 (`conSusBloques`), que consulta y dice cómo termina.

**Sin hacer:**
- El G6 tiene dos pasos (Confirmado → el trabajo): los runners no informan avance intermedio.
- Un trabajo cortado se escribe como tal recién cuando alguien CONSULTA: con la pestaña cerrada, el modelo lee «En curso»
  en el turno siguiente (`estadoDeTrabajo`; falta cortarlo también al abrir la sesión, `abrirSesion`).
- La validación previa del formulario (gating, `preparar`, `faltaParaConfirmar`) corre adentro de `after()`: una que
  falla se ve como «Falló» con su motivo, no antes (`aplicarPropuestaGenerica`, lib/api-mako/acciones.ts). En
  /mako/revisar, `RevisarAccion` pinta «Aplicada» con un `enCurso`.
- Confirmar desde dos pestañas deja un «No se pudo» sobre algo que se hizo: falta reclamar antes de anotar el «En curso»
  (lib/chat-trabajos.ts).
- No están conectados `flow_trabajos` (las tomas de Flow), el render de video ni el análisis del Dashboard, que tiene su
  propio `after` y su propia consulta.
- «Créame una landing» termina con «Abrir en Web Generator»; su miniatura es de la tarjeta de la landing (1.12).
## Una LECTURA también dibuja: «A quién cobrar» en el hilo (20/10/2026, Pagos, la 2.27, sobre el marco de la 1.7)

**Vive en:** `SalidaLectura.bloque` y `Ctx.aDibujar` en `lib/api-mako/tipos.ts` · la rama de lecturas de
`ejecutarOperacion` (`lib/api-mako/ejecutar.ts`) · `turnoApp` en `lib/mako-turno-app.ts` · `itemsDeRespuesta` en
`app/m/mako/chat-ui.ts`. Probado en `tests/chat-bloque-cobranza.test.ts`.

- **Síntoma:** la 2.27 pide que «¿quién me debe plata?» dibuje la lista. Es una LECTURA (`a_quien_cobrar`), y el marco
  de la 1.7 sólo llevaba bloques por la tarjeta, al confirmar una acción.
- **El contrato, el mismo camino que `aPersona` (la agenda):**
  - la lectura devuelve `{ content, bloque }`;
  - `ejecutarOperacion` sanea el bloque y lo pasa por `ctx.aDibujar`, que pone SÓLO el turno de la app;
  - el modelo recibe sólo `content`, y en WhatsApp o por HTTP el bloque se descarta;
  - el turno lo guarda con la respuesta de MaKo (`chart_chats.bloques`) y lo devuelve en `mensajes[].bloques`;
  - la pantalla lo suma debajo con `itemsDeRespuesta`, y al recargar vuelve con `itemsDeSesion`.
  - Si el turno se re-arranca (la cascada rota de cuenta), un bloque igual no se repite (`dibujar`, desde la ola 1).
- **Regla:**
  - una lectura sabe por `ctx.aDibujar` si lo que arma se va a ver, y sólo entonces lo arma y le dice al modelo que no
    lo copie;
  - una lista CON ACCIONES guardada en el hilo es una foto: se vuelve a leer al dibujarse y no actúa hasta tener la viva
    (en Pagos, marcar una fila vieja reescribe la fecha de un cobro, docs/hallazgos-pagos.md);
  - un bloque de área que trae acciones de servidor se carga con `dynamic` desde `BloqueHilo` (app/_chat/bloques/*). Si
    se importa directo, `server-only` tira afuera de Next, y `BloqueHilo` deja de cargar en su test.
- **Hecho con la ola 1 (21/10):** Ops Center 3 lo tomó como el camino ÚNICO de lo que dibuja una herramienta, con los
  mismos nombres, y lo extendió a las propuestas de pantalla (`extra.bloque`). En el turno no se vacía al re-arrancar:
  `dibujar` no repite un bloque igual y anota qué herramienta lo dibujó (con una pregunta, 1.9, se retiran los de las que
  escriben).
