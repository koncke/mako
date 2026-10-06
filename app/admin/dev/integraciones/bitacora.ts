// =============================================================================
// Integraciones — el registro de construcción del área
// =============================================================================
// Alcance: la pantalla donde el cliente CONECTA y donde COMPRUEBA que lo
// conectado funciona. La grilla de servicios por categoría, la barra de
// credencial (BYOK), el «Costo de MaKo», el botón de conectar su Claude, y —lo
// que se llevó casi todo agosto— el Pixel de MaKo: instalarlo, elegir sobre qué
// página, activarle Clarity, nombrar sus videos y probarlo en vivo.
// Vive en: app/integraciones/ (page, IntegracionesBoard, ServicioConfigForm,
// SelectorLanding, ConfigClarity, ProbarTracking, NombrarVideos, escuchando/,
// landing-actions, landing-config-actions), app/api/integraciones/*,
// lib/integraciones-catalogo.ts, lib/metodo-catalogo.ts, lib/metodo-verificar.ts,
// lib/servicio-slides.ts, lib/clarity.ts, lib/landing-config.ts,
// lib/landing-paginas.ts, lib/landing-analisis.ts, lib/landing-videos.ts.
//
// De dónde salió esto: los mensajes de commit de este repo, que son largos y
// explican el porqué; las trampas y lo que quedó sin hacer, de
// docs/hallazgos-landing.md (Pixel, Clarity, videos), docs/hallazgos-ia.md
// (cuentas y cuota) y docs/hallazgos-infra.md (los dos catálogos, la barra de
// credencial); fecha, hora y commits, de `git log` sobre esas rutas. El `chat`
// va en «—» a propósito: docs/chats.md llega hasta el 8 de agosto y todo lo de
// acá es posterior — no se inventa el nombre de una sesión.
//
// NO es un changelog. Lo que git ya guarda no se repite acá: va el motivo, la
// trampa y —sobre todo— cuándo el diagnóstico obvio era el equivocado.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'La grilla y la barra de credencial', detalle: 'Una sola pieza para todos los servicios: semáforo por campo · ojo · «probar conexión» · el «?» con los pasos · guardar probando antes', estado: 'hecha' },
  { titulo: 'BYOK: varias cuentas por proveedor', detalle: 'Hasta 10 keys por proveedor, cada una con su email · la cuota se mide POR CUENTA y nunca se suma', estado: 'hecha' },
  { titulo: 'Costo de MaKo', detalle: 'Gasto por proveedor y por proceso, con filtro de período · cada cliente ve el suyo, no el de la agencia', estado: 'hecha' },
  { titulo: 'Conectar tu Claude', detalle: 'Token del agente con la pantalla del trato + el tutorial de 4 pasos, el mismo que monta /second-brain', estado: 'hecha' },
  { titulo: 'El Pixel de MaKo', detalle: 'UN código que mide visita, video, clics, opt-in y agenda · elegir la página es el paso 1 y gobierna todo lo demás', estado: 'hecha' },
  { titulo: 'Probar el Pixel en vivo', detalle: 'Ventana de MaKo apoyada sobre la landing · chequeos que se adaptan a lo que la página tiene · marcador para ver SOLO tu prueba', estado: 'hecha' },
  { titulo: 'Mapas de calor y grabaciones (Clarity)', detalle: 'BYOK adentro del mismo snippet · link a la grabación desde la ficha del lead · cron que cachea el resumen y avisa antes de que se borre', estado: 'hecha' },
  { titulo: 'Identificar tus videos', detalle: 'Nombre propio, título real de Panda y ocultar los ajenos · falta que la curva de retención se filtre por video: la capacidad existe hace meses y nadie se la pasa', estado: 'sigue' },
  { titulo: 'Dar de alta un servicio sin cuatro listas', detalle: 'Hoy una integración se declara en el catálogo, en CAT_ORDER, en capas.ts, en el de íconos y en el del método; olvidar una la deja invisible y sin error', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── agosto: la pantalla se vuelve navegable ────────────────────────────────
  {
    fecha: '9 ago', hora: '03:50', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El Costo de MaKo por período, y el link que aterriza en la tarjeta',
    puntos: [
      'Pedido textual del dueño el 08/08, citado en el commit: «Sería bueno que incluyas un filtro de fecha y poder ver el gasto de otros meses también». El endpoint ya existía; faltaba cablearlo.',
      '⚠️ **Las dos fuentes del número NO se unificaron, a propósito.** «Este mes» sigue saliendo de `/api/anthropic-usage` —que es la ventana del saldo cargado— y cualquier otro período de `/api/costos-ia`, que lee paginado. El viejo **trunca en 1000 filas sin avisar**: unificar por prolijidad habría dado un número mudo y equivocado para los meses grandes.',
      '`?meses=1` hace dos cosas de una: puebla el selector sin ofrecer meses vacíos y es la **sonda de permiso** — si contesta 403, el cliente no ve el filtro. Es «estado vivo, no recordado» aplicado a un control de la UI.',
      'Los tiles de saldo y cuota **no** siguen al período, y está rotulado en pantalla: son estado de HOY. Un saldo restante al lado de un gasto de junio, sin aclaración, se lee como si fueran la misma ventana. Y un fetch fallido deja «—», nunca el número anterior: mostrar el gasto de julio bajo el rótulo de junio es peor que no mostrar nada.',
      'El ancla `?servicio=<key>` cierra el otro agujero: `lib/tab-activacion.ts` tiene **ocho** tabs que mandan acá («sin Calendly las reuniones no entran») y /integraciones solo leía `?gcal=` y `?ops=1` — o sea ocho links que dejaban al usuario delante de una grilla de veintipico de tarjetas. Se acepta el id **y** la clave (MaKo arma el link sabiendo el nombre, casi nunca el id), y un valor que no existe **no abre nada** en vez de abrir un modal vacío.',
    ],
    commits: [
      { sha: '60718450', msg: 'integraciones: filtro de período en «Costo de MaKo»', lineas: 112, archivos: 2 },
      { sha: 'ba4da613', msg: 'Tres anclas: el link de MaKo aterriza en la cosa, no en la puerta', lineas: 124, archivos: 4 },
    ],
  },
  {
    fecha: '9 ago', hora: '10:50', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Conectar tu Claude: la puerta estaba y la llave no, y un `if` pisaba el catálogo',
    puntos: [
      '**«Puse la puerta y nunca construí la llave.»** `/api/agente/token` devuelve 409 con `necesitaConsentimiento` cuando el workspace no aceptó el trato, y el botón posteaba sin body y trataba ese 409 como un error cualquiera: pintaba el texto crudo, sin ninguna vía para aceptar. O sea que estaba roto para **todo** workspace que no hubiera aceptado — que eran todos.',
      '`TEXTO_CONSENTIMIENTO` estaba escrito y versionado, y **no lo renderizaba nadie**: un solo hit en todo el repo, su propia definición. La causa de fondo ya había mordido dos veces — vivía en un módulo con `server-only` y la pantalla que tiene que mostrarlo es de cliente. Se mudó a un módulo puro y el que lleva la marca lo reexporta.',
      '⚠️ **El `if` escondido adentro del renderer.** El logo de Anthropic ya estaba en `BrandDefs` y el catálogo de íconos decía que el agente no tenía símbolo: había un `k === \'agente\' ? <GuardianIcon/>` adentro de `SvcIcon` que dibujaba el escudo del Perro Guardián **pisando el catálogo**. Un `if` por clave adentro del renderer es justo lo que hace que una fuente única deje de serlo: el que agrega un servicio mira `ICON` y no se entera de la excepción. El tile de una integración lleva la marca de con quién te conectás.',
      '`ModalShell` se **extrajo** de `IntegracionesBoard` (no se copió) para que /second-brain abra exactamente el mismo modal —la barra negra de 336 px, el ✕ pinado, el alto que no salta— y las slides salen de `lib/servicio-slides.ts`, las mismas de la tarjeta. Dos modales que se ven iguales dejan de verse iguales en el primer cambio.',
    ],
    commits: [
      { sha: 'ddd40913', msg: 'El botón «Generar token» estaba roto: faltaba la pantalla del trato', lineas: 118, archivos: 4 },
      { sha: '87a1000b', msg: 'El botón de Claude con su logo, y el modal igual al de integraciones', lineas: 124, archivos: 4 },
    ],
    archivos: [
      'app/integraciones/IntegracionesBoard.tsx — la grilla, el ModalShell y el catálogo de íconos',
      'lib/servicio-slides.ts — las slides del panel negro, compartidas por la tarjeta y el modal',
    ],
  },

  // ── agosto: un servicio nuevo, y las cuatro listas ─────────────────────────
  {
    fecha: '11 ago', hora: '15:07', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Whop: la integración existía, pasaba todos los filtros y no se pintaba',
    puntos: [
      '⚠️ **`CAT_ORDER` hace de whitelist.** Se le puso una categoría nueva («Contenido») y la tarjeta desapareció de la grilla **sin ningún error**. Es textualmente el bug que ya había dejado a GitHub invisible, y el comentario que lo cuenta está tres líneas más arriba de donde no se miró. Dar de alta un servicio toca **cuatro** listas: el catálogo, `CAT_ORDER`, `capas.ts → categoriasIntegraciones` (sin eso el super-admin tampoco lo ve) y el catálogo de íconos (sin eso se pinta con el logo de Supabase).',
      '⚠️ **La firma del webhook estaba escrita estilo Stripe** (`t=…,v1=<hex>`, secreto crudo como clave) y Whop firma con Standard Webhooks (Svix), el mismo esquema que Fathom y Resend. Habría rechazado el 100 % de los webhooks con un error **indistinguible de un secreto mal pegado** — el peor síntoma posible, porque manda a revisar lo que estaba bien. El HMAC ya estaba escrito dos veces en el repo; ahora vive en `lib/standard-webhooks.ts` y devuelve el **motivo**, no un booleano: «timestamp viejo» manda a mirar el reloj y «no coincide» manda a mirar el secreto.',
      '«Probar conexión» decía «servicio inválido» por faltar `PINGS.whop`. El ping ahora muestra el **nombre del negocio**, que es lo único que delata al toque haber pegado la key de otra cuenta, y cuántos programas hay cargados: una key válida sobre una cuenta vacía es el estado más confuso de todos.',
      '**El `company_id` no se pregunta: se deriva de la propia key** (`GET /accounts/me`) y la fila de `webhook_routing` se reclama sola. Es un campo menos que llenar mal — y si se llena con el de otro, le secuestra los webhooks. Sin esa fila, un webhook entrante se descarta **en silencio**, la misma falla que el catálogo ya documenta para Fathom.',
      'El caché de esa resolución va clavado **por workspace**: un caché global sería un IDOR silencioso, con el segundo cliente heredando la company del primero.',
    ],
    commits: [
      { sha: '1d022463', msg: 'Whop conectado y el programa cargado: 12 módulos y 42 clases en su cuenta real', lineas: 889, archivos: 7 },
      { sha: '7d0080de', msg: 'La firma de Whop la tenía mal, y la integración estaba invisible', lineas: 738, archivos: 17 },
    ],
  },

  // ── agosto: BYOK de IA, la cuota que no se trasvasa ────────────────────────
  {
    fecha: '12 ago', hora: '18:16', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'correccion',
    titulo: 'La cuota se mide por CUENTA, y un 403 se estaba pintando como cero',
    puntos: [
      'El free tier se agota **por cuenta**, no por proveedor, y la app solo sabía guardar UNA key por proveedor: la única salida que le ofrecía a alguien sin cuota era **pegar de nuevo la key que ya estaba agotada**. Las cuentas extra entran como claves derivadas (`GEMINI_API_KEY` / `_2` / `_3`) y sin migración: para `credenciales` son filas más, con el mismo cifrado y la misma auditoría.',
      '⚠️ **Sumar cuotas que no se trasvasan.** Una clienta con tres cuentas de Gemini veía «240,6k / 750,0k» —le sobra el 68 % del día— al lado de un error que decía que no tenía IA. Las dos cifras eran ciertas. Medido: cuenta 1 al 96 % y **sin cuota**, cuentas 2 y 3 en 0. No era un tanque de 750k: eran tres tanques de 250k que no se trasvasan, y como la cascada arranca siempre por la primera y solo salta cuando la anterior FALLA, todo el uso se apila en una. `agotado` dejó de salir del total (sale del PEOR componente) y la cascada empieza por la cuenta con nafta: rotar solo por error es pagar un 429 de peaje por llamada.',
      '⚠️ **Un permiso denegado y un dato en cero se ven igual.** Leila veía «0 operaciones recientes» y $0,0000 teniendo 24 llamadas ese día, con el gauge de arriba —en la MISMA pantalla— mostrando sus 240,6k tokens. No estaba vacío: `/api/anthropic-usage` la cortaba con 403 (`soloDueno`) y el board hace `if (j?.ok) setUsage(...)`, así que el rechazo dejaba `usage` en null y la UI lo pintaba como ceros. Por eso nadie lo vio antes.',
      '**Abrir el guard solo habría abierto una fuga**, y ése es el orden correcto de los dos arreglos: `getUsageSummary` mezclaba las filas de Claude de `OWNER_WS` en todos los resúmenes, y `motivo` es texto libre con nombres de otros clientes. Ahora es UNA lectura del workspace del request. Misma familia: `wsDeProveedor` mandaba el gasto de Claude SIEMPRE a `OWNER_WS`, así que un cliente con su propia key pagaba y se le sumaba a Mauricio — **la pregunta correcta no es qué proveedor es, sino de quién es la key que lo pagó**.',
      'El guard no estaba mal cuando se escribió: la IA era UNA cuenta de la agencia. Es la deuda que dejó BYOK — lecturas viejas que siguen suponiendo «IA = agencia». Y el «2 %» que mostraban las cuentas sin usar era el **mínimo de ancho de la barra colado en el TEXTO**: un número inventado en el panel que se estaba arreglando justamente por eso.',
    ],
    commits: [
      { sha: 'bee24ad4', msg: 'IA: rotar tambien entre CUENTAS del mismo proveedor, y cerrar los caminos sin cascada', lineas: 805, archivos: 20 },
      { sha: 'c3e583e6', msg: 'IA: la cuota se mide POR CUENTA, y el error dice qué contestó cada una', lineas: 611, archivos: 16 },
      { sha: 'ca309b3e', msg: 'Gasto de IA: el cliente ve el SUYO (era un 403 pintado como «0 operaciones»)', lineas: 106, archivos: 4 },
    ],
    archivos: [
      'lib/ia-keys.ts — las cuentas por proveedor, sin `server-only` para poder testearlo',
      'lib/ia-mensajes.ts — el texto del error, con QUÉ contestó cada cuenta (antes solo en console.warn)',
      'app/integraciones/IntegracionesBoard.tsx — el gauge, el reparto por cuenta y el gasto',
    ],
  },
  {
    fecha: '13 ago', hora: '21:06', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El opt-in va dentro del mismo snippet, y el token salió vacío para todos',
    puntos: [
      'Corrección de producto: **si el opt-in necesita que alguien le pase un snippet por chat, la feature no existe.** El cliente lo resuelve solo desde /integraciones, que es donde la app ya le da su código con su token — así que el bloque del formulario va DENTRO del mismo snippet. Un segundo script para pegar después es un segundo script que la mitad no va a pegar, y el script **queda congelado en el HTML del cliente el día que se pegó** (así se perdieron 18 días de medición).',
      '⚠️ **Regresión en producción, y el test la dejó pasar en verde.** Una sustitución que en vez de insertar **reemplazó** dejó `var TOKEN = \'\'`: el snippet salía vacío el 100 % de las veces, para todos los workspaces. Con el token vacío el beacon lo descarta fail-closed y el opt-in lo rechaza con 400, así que quien copió el código en esas horas tiene una landing que **no mide ni captura nada**. El test escrito en ese mismo commit exigía que viajara la VERSIÓN y nunca que viajara el TOKEN. La regla: **lo que no se afirma es lo próximo que se rompe** — si se le agrega algo al snippet, se le agrega su aserción.',
      'El bloque se cuelga del submit **en fase de captura y nunca hace `preventDefault`**: el formulario del cliente sigue redirigiendo o mostrando su gracias como antes, y el envío usa `keepalive` para sobrevivir a la navegación. Detecta los campos por type, name, id, autocomplete y placeholder, porque Lovable, Framer y WordPress los nombran distinto y el dueño de la página no tiene por qué renombrar nada.',
      '**El aviso pasa a ser accionable, y la pantalla deja de contradecirlo.** El dato de «snippet viejo» ya existía y **solo lo leía el cron**: el aviso salía por WhatsApp y la pantalla seguía en verde, que es la mitad que la persona mira. Ahora la integración baja a ámbar con su chip, y la comparación vive en un solo lugar (`snippetDesactualizado()`) que consumen el cron y la pantalla.',
      'El texto del aviso va **determinista** (`texto`, no `contexto`): ahí viaja un link exacto, y la regla de la casa dice que un dato exacto no lo transporta un LLM. Y el link abre EL LUGAR, no la pantalla — `/integraciones?abrir=landing` scrollea a la tarjeta y abre su modal, limpiando el parámetro después para que un F5 no reabra lo que la persona ya cerró.',
    ],
    commits: [
      { sha: '8e41bed3', msg: 'landing: el snippet que la app entrega ya captura el formulario', lineas: 75, archivos: 3 },
      { sha: '7b59ac95', msg: 'landing: arregla el token que rompí, y el aviso pasa a ser accionable', lineas: 175, archivos: 6 },
    ],
  },
  {
    fecha: '13 ago', hora: '21:37', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Diez cuentas por proveedor, y por qué el tope no se puede sacar del todo',
    puntos: [
      'Pedido del dueño, con su porqué: sacar el límite de 3 cuentas, un botón para agregar y saber a qué email pertenece cada una. El free tier de Gemini son 250k tokens/día **por cuenta** y el ws1 consume ~860k — entre 86 y 110 cortes por día, medidos en la base.',
      '⛔ **El tope no se puede quitar, y queda escrito en el código por qué.** La cadena `MAX_KEYS → clavesDe → CLAVES_EXTRA → ENVS_METODO` **ES** la whitelist de qué claves se pueden guardar. Reemplazarla por un patrón `/_API_KEY(_\\d+)?$/` «para que no tenga tope» abre un agujero grave: `guardarCredencial` termina en `process.env[clave] = valor` para el dueño y `cfgDe()` relee `process.env.CHEAP_BASE_URL` en cada llamada — **una clave de más aceptada es todo el tráfico de IA de todos los inquilinos saliendo a otro host con los Bearer adentro.** 10 cubre 3× el consumo actual y subirlo es cambiar un número.',
      '**El botón «Agregar otra cuenta» ya existía** (`ServicioConfigForm:785`): el pedido no era crearlo, era que no se quedara sin campos en la tercera. Leer el pedido como «hay que construir esto» habría duplicado la pieza.',
      '**El email es manual, y no por vagancia.** Verificado el mismo día en los cinco proveedores: **ninguno** expone el dueño de una key. Gemini lo dice por escrito («Standard keys don\'t identify a caller») porque la key cuelga de un PROYECTO, no de una persona; OpenRouter devuelve label, límites y uso pero ningún mail; Groq, Cerebras y Mistral no documentan endpoint de cuenta. Prometer un autocompletado que no existe era peor que pedir que se escriba una vez.',
      '⚠️ **El gotcha que lo habría dejado inútil:** el form pintaba `••••{mask}` en cuanto la credencial estaba guardada, **sin mirar `c.secreto`** — un email se habría visto «••••.com», exactamente lo contrario de para lo que existe. El rótulo de cuenta entra como un campo más del catálogo (`GEMINI_API_KEY_2_ACCOUNT`), así que guardar/borrar/revelar lo aceptan sin tocar una línea de whitelist.',
      'El precio de subir el tope se pagó en la misma pasada: resolver las cuentas con un `credWs` **por slot** eran 10 SELECT por proveedor (hasta 50 por generación y otros 50 en cada pintada del gauge), casi todos para descubrir que la key no existe. `lib/ia-keys-ws.ts` hace UNA query por workspace, cacheada **por request** con `cache()` de react — nunca `unstable_cache`, que es cross-request: cachear qué credenciales tiene cada inquilino es una fuga esperando a pasar.',
    ],
    commits: [{ sha: '85a020b8', msg: 'Cuentas de IA: el tope pasa a 10 y cada key dice de que email es', lineas: 190, archivos: 8 }],
  },

  // ── 14 de agosto: la tarjeta del Pixel se rehace con las piezas de la casa ──
  {
    fecha: '14 ago', hora: '10:37', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El código de la landing es LA MISMA barra que una credencial',
    puntos: [
      'Eran tres piezas sueltas que no se parecían a nada del resto de la pantalla: un bloque de código, dos botones abajo y un «Ver el código». Ahora es el mismo esqueleto que `.mk-key-row` —la barra donde se pega una key— pero oscura y con el código adentro, y se hizo como **modificador** (`.mk-key-row--code`) y no como pieza nueva: dos cosas con la misma anatomía son una pieza con dos configuraciones, y mantenerlas separadas garantiza que diverjan.',
      '⚠️ **Sin `max-height`, `overflow: hidden` no recorta nada.** Un `<pre>` de 200 líneas crece hasta 200 líneas y la barra crece con él: el código se veía SIEMPRE desplegado *y* los íconos quedaban centrados contra ese bloque altísimo. Dos síntomas en pantalla, una sola causa.',
      '⚠️ **El color estaba INLINE, por eso los tres intentos no hicieron nada.** «Se sigue viendo EXACTAMENTE igual», reportado tres veces, y el problema nunca fue el valor del color: `style={{ color }}` le gana a cualquier clase, así que la regla existía, se aplicaba y el inline la pisaba. **Y es el mismo bug que ya se había arreglado en ese botón**: el fondo y el borde se habían movido a la clase dejando el comentario que lo explicaba… con el `color` justo abajo, todavía inline y con una línea diciendo «lo único que sigue inline es el color, que depende del tone». Se escribió la excepción en vez de ver que era el mismo caso. Ahora el tono viaja como `data-tone`.',
      '`:focus-within` pinta la barra de blanco porque en una credencial adentro hay un INPUT y el foco tiene que verse; en la barra del código no hay ningún campo, solo código y botones. La variante oscura se queda oscura y el anillo azul se mantiene.',
      'El `<select>` nativo está **prohibido por el propio componente** (no se puede estilar igual en todos los navegadores) y el `Select` de la casa se renderiza en portal, así que el scroll del modal no le recorta el menú. Un solo botón «Probar», y **siempre abre la página**: si la prueba depende de que la persona se acuerde de abrirla, la prueba no arranca. Copiar funciona plegado, porque la acción no depende de ver el contenido.',
      '⚠️ Los tests de esta barra miran el **código sin comentarios** —es la tercera vez que un comentario que explica el bug hace fallar su propio test— y dos de las guardas nuevas cortaban el archivo en el lugar equivocado (`\\n}` daba con el cierre de la firma, y un largo fijo se comía el componente de al lado), así que verificaban cualquier cosa. **Un límite arbitrario en un test que lee fuente es una falla programada.**',
    ],
    commits: [
      { sha: '92e19a46', msg: 'integraciones: el modal de Landing con las piezas de la casa', lineas: 97, archivos: 3 },
      { sha: '7a805a41', msg: 'integraciones: el codigo de la landing es LA MISMA barra que una credencial', lineas: 138, archivos: 5 },
      { sha: 'f69ed4f5', msg: 'integraciones: la barra del codigo pliega de verdad, y el ? es el 4to boton', lineas: 41, archivos: 3 },
      { sha: '796b7557', msg: 'integraciones: la barra oscura deja de aclararse y los botones se adaptan al negro', lineas: 107, archivos: 4 },
      { sha: 'c9fef41e', msg: 'integraciones: el color del ícono estaba INLINE, por eso los tres intentos no hacían nada', lineas: 34, archivos: 3 },
    ],
  },
  {
    fecha: '14 ago', hora: '12:06', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Mis páginas: guardadas vs detectadas, y las siete URLs iguales',
    puntos: [
      'La lista salía de `landing_visits.landing_url`: las páginas que se habían **observado**, no las que el negocio dice tener. Con eso no se podía corregir una URL mal escrita, ni borrar una dada de baja, ni agregar la que todavía no recibió una sola visita — **que es justo la que uno quiere probar.** La lista guardada vive en `app_settings` y no en tabla propia: son un puñado de URLs por workspace, sin relaciones ni historial, y el patrón ya existía al lado.',
      '⚠️ **Un argumento correcto con una conclusión falsa.** El lápiz y el tacho se gateaban en «está guardada», razonando que una detectada «todavía no es de nadie» y que ofrecer borrarla es prometer algo que no se cumple. El razonamiento sobre el borrar era correcto; la conclusión, no: **quien nunca guardó una a mano ve TODAS sus páginas como detectadas**, así que no veía un solo botón y la función entera era invisible — y ése es el caso normal, no el raro. Para que borrar cumpla, se agregó la lista de escondidas.',
      '⚠️ **Un `includes` de string crudo contra una lista NORMALIZADA.** Al guardar «tu-pagina.com» la lista pasa a tener «https://tu-pagina.com», el `includes` da false y los botones se iban **justo después de guardar**. Y otro `includes` de SUBSTRING daba por iguales una página y otra que la contiene como prefijo — exactamente la forma de los previews de Netlify.',
      '⚠️ **El síntoma apuntaba al guardado, y el guardado estaba bien.** «Se guardan un montón de URLs iguales»: no se estaba guardando ninguna, todas decían «detectada». Lo roto era **contarlas como distintas**. Cada deploy de Netlify recibe una URL inmutable con el id adelante y el snippet mide en todas, así que publicando varias veces por día quedaban siete renglones de la misma página **con la retención repartida entre los siete**, sin que nada lo dijera.',
      'El colapso de esos hosts es **deliberadamente angosto** —solo cuando el prefijo es inconfundiblemente un id de deploy (20+ hex; los de Netlify tienen 24)—: los deploys por rama (`staging--sitio`) SÍ son lugares distintos y fundirlos mezclaría producción con pruebas, y Vercel arma sus previews con guiones simples, donde adivinar sería peor que dejarlos separados.',
    ],
    commits: [
      { sha: '2d3ea2ab', msg: 'landing: mis paginas se guardan, se corrigen y se borran', lineas: 293, archivos: 4 },
      { sha: 'ef787cab', msg: 'landing: el lapiz y la basura no aparecian NUNCA para quien no guardo una a mano', lineas: 145, archivos: 4 },
      { sha: '37ec8683', msg: 'landing: editar/borrar en cada renglon, y las 7 URLs iguales eran previews de deploy', lineas: 187, archivos: 6 },
    ],
    archivos: ['lib/landing-paginas.ts — normalización y lista guardada/oculta, sin `server-only` y con 8 tests'],
  },
  {
    fecha: '14 ago', hora: '13:02', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Identificar tus videos: del id crudo al título real, y el redirect que fugaba el embudo',
    puntos: [
      'Arranca el 14 y sigue hasta el 16. El snippet ya mandaba los eventos separados por video; lo que faltaba era **nombrarlos**. Una sola pregunta por fila, no dos: la alternativa era un desplegable para el nombre y aparte un «marcar como VSL», y el segundo se queda sin contestar porque no se entiende qué agrega. Acá el nombre ES la respuesta.',
      '⚠️ **La bomba que encontró el mapeo sin buscarla:** `durDe` en `lib/leads.ts` caía a «la única duración conocida» **sin condición**, así que con un testimonio de 40 s al lado de un VSL, «vio el 80 %» podía ser el 80 % del testimonio y se leía como que casi terminó la oferta. El dato no estaba mal calculado, estaba mal **atribuido** — que es peor, porque el número se ve igual de creíble.',
      '**Ver el video no puede depender de que alguien lo reproduzca.** La URL viajaba SOLO en el evento `play`, o sea que para poder NOMBRAR un video había que conseguir primero que alguien lo mirara: la pantalla al revés. Ahora sale de dos lados que existen antes de cualquier visita — el catálogo de Panda por API y el HTML de la página (`<video>` nativo, YouTube, Vimeo). Y el título deja de ser un UUID: el único que teníamos salía del atributo `title` del iframe, que es de la PÁGINA y no del video, así que **los dos videos de esa landing se llamaban igual**.',
      '⚠️ **La ausencia sin explicación se lee como una pantalla rota.** «No veo el botón»: estaba bien escondido, porque ese video tenía 33 eventos y ninguno traía su URL (todos anteriores a la versión que la manda). Esconder una acción que no puede cumplir es lo correcto; esconderla **en silencio** deja a la persona buscando algo que le dijimos que existía. Es la misma regla que dejó invisibles el lápiz y el tacho de las páginas.',
      '⚠️ **EL HALLAZGO:** el VSL de Mauricio tenía `config.videoRedirect` en Panda apuntando a un video viejo de OTRA persona, resto de una playlist de prueba borrada meses antes. Cada visitante que terminaba de ver la oferta pasaba solo a un video que no tiene nada que ver. **No se ve en la página, no se ve en los eventos, y nadie lo mira hasta que los leads llegan confundidos.** La API pública de Panda no lo puede borrar (`PUT /videos/{id}` contesta textual «must NOT have additional properties: config», y se probaron 9 rutas): se quita a mano en el panel. Lo que sí se puede es **decirlo**, y ése es el chequeo ámbar nuevo.',
      '**Esconder no es borrar, y ocultar cierra la pregunta igual que nombrar.** Un video ajeno se puede sacar de la lista sin tocar sus eventos —son un hecho: ese video SÍ se reprodujo ahí— y se dice cuántos hay ocultos. Va en su propia lista y no como campo del video nombrado, aunque parezca el lugar obvio: esa estructura exige nombre y deja UN solo VSL, y meterlo ahí obligaba a aflojar el «sin nombre no entra», que es justo lo que impide que la lista se llene de filas mudas.',
      '⚠️ **Sigue pendiente**, y es la mitad que falta: `curvaRetencion`, `avancePorPersona` e `histogramaAbandono` aceptan un `videoId` desde hace meses y **nadie se lo pasa**; y su condición `if (videoId && ev.video_id && …)` exige que `ev.video_id` sea truthy, así que **un evento sin `video_id` entra en la curva de CUALQUIER video** (docs/hallazgos-landing.md → «Lo que sigue pendiente sobre videos»).',
    ],
    commits: [
      { sha: '0333a2ca', msg: 'videos: cada uno con su nombre, y la retencion separada en la ficha del lead', lineas: 900, archivos: 12 },
      { sha: '91d21cad', msg: 'landing v8: un botón para VER el video que te estoy pidiendo que nombres', lineas: 72, archivos: 4 },
      { sha: '7d416762', msg: 'landing: el boton de ver el video no estaba, y no decia por que', lineas: 17, archivos: 2 },
      { sha: 'af50d1a0', msg: 'videos: titulo de verdad, y verlos sin esperar a que alguien los reproduzca', lineas: 196, archivos: 5 },
      { sha: '70e18dcd', msg: 'videos: verlos sin depender de un play, el redirect que fuga el embudo, y el mapa de calor en la ficha', lineas: 396, archivos: 12 },
      { sha: '58512884', msg: 'videos: poder decir «este no es de mi pagina», sin borrar la medicion', lineas: 155, archivos: 7 },
      { sha: '87fc8389', msg: 'videos: ocultar tiene que cerrar la pregunta, igual que nombrar', lineas: 26, archivos: 2 },
    ],
    archivos: [
      'app/integraciones/NombrarVideos.tsx — el paso que pregunta qué es cada video',
      'lib/landing-videos.ts — detectados, nombrados y ocultos',
      '⚠️ lib/vsl-retencion.ts — el `videoId` que nadie pasa y la condición que no descarta',
    ],
  },
  {
    fecha: '14 ago', hora: '14:34', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'La prueba deja de ser una lista: los 8 leads, los clics, el marcador y la ventana',
    puntos: [
      '⚠️ **Reportado como «envié el formulario y no se registró, eso es gravísimo». Se fue a la base de producción antes de tocar nada y el diagnóstico era el contrario:** OCHO propuestas de lead en `pendiente` en el ws11, cuatro de gente REAL con nombre y teléfono. El opt-in funcionaba, la captura funcionaba, el check verde decía la verdad. **Lo que no existía era la forma de enterarse**: la pantalla de revisión es `/crm/revisar/<id>`, por id y sin lista, y nadie emitía ese link. Para los otros canales el link vuelve por la misma conversación; **un formulario de landing no tiene canal de vuelta** — quien lo completa ve la página de gracias del cliente y el dueño no recibe nada. Ocho personas reales dejaron su teléfono y a ninguna le escribió nadie.',
      '**Un indicador que afirma la mitad verdadera de un proceso de dos pasos es peor que uno roto**, porque nadie lo va a auditar. Decía «llegó al menos un formulario ✓» y era cierto: le faltaba el segundo verbo — llegó ¿y **entró**? Ahora dice «N personas dejaron sus datos y todavía NO están en el CRM», en ámbar y con link, **sin ventana de tiempo a propósito**: una de hace tres días sin revisar es MÁS urgente, no menos.',
      'Los clics no se medían: el snippet emitía pageview, play, pNN, sNN y exit, y para una landing cuyo CTA es un ancla y cuyo cierre es un link de WhatsApp, **entre «visitó» y «dejó sus datos» no había ningún punto intermedio** — una página que convierte mal no se podía distinguir de una que nadie mira. El destino manda sobre el texto (dos botones distintos pueden ir al mismo lado) y hay tope por carga, o un carrusel manda cientos y el ruido tapa lo que importa.',
      '⚠️ **Filtrar la prueba por HORA no alcanzaba, y es la parte que importa.** Dejaría afuera los eventos viejos pero NO los de otra gente visitando la página en ese momento — y esa landing recibe leads cada pocos minutos. **Un probador que te muestra la visita de un desconocido como si fuera tuya es peor que uno que muestra de más: te hace creer que tu código anda cuando lo que anda es el de la visita ajena.** El marcador `?mko_test=<id>` es el mismo mecanismo que el `test_event_code` de Meta, y va en `sessionStorage` y no en cookie: tiene que sobrevivir a navegar dentro de la pestaña y **morir al cerrarla** — en una cookie contaminaría el tráfico real durante un año.',
      '⚠️ Dos formas de perder el marcador, las dos pagadas: **el hash va SIEMPRE al final** al armar la URL (`pagina.com/#registro?mko_test=x` deja el parámetro adentro del hash y `location.search` no lo ve nunca, y esa landing se prueba justamente con `#registro`), y pasar `traer` directo a `setInterval` le entrega **el contador del timer** como primer argumento: la lista arrancaba limpia y a los 3 segundos volvían las 24 h.',
      '**La ventana de prueba** es exactamente el problema de probar: para verificar que un clic se registra hay que hacerlo EN la landing y mirar el resultado EN MaKo, y con dos pestañas eso es alternar a ciegas. Se abre DESPUÉS de la landing (la última queda arriba), con nombre de ventana para que dos pruebas seguidas reusen la misma, y **reusa el MISMO `ProbarTracking`** con `pruebaInicial`: una segunda copia del panel es una copia que se queda vieja. Si el navegador la bloquea, el panel de la tab sigue funcionando igual — la prueba no puede depender de un permiso que no controlamos.',
      '⚠️ **Un panel reemplazado por un cartel obliga a volver para enterarse de que no hay nada que ver.** Se había puesto un «la prueba está corriendo en otro lado» en la pestaña de atrás; se revirtió: la prueba se ve IGUAL en los dos lados, y se pagó el precio de poll-ear dos veces. Dos requests cada 3 segundos durante dos minutos no le duelen a nadie; la coherencia entre las dos pantallas sí.',
      '⚠️ **El renombre a «Pixel de MaKo» y el script que dijo que sí sin escribir.** «Landing / VSL» describía DÓNDE se pega en vez de QUÉ es, así que cada pantalla lo llamaba distinto —«el código», «el snippet», «la landing»— y no había forma de saber que hablaban de lo mismo. El script de reemplazos **aborta al primer patrón que no encuentra y escribe al final**: falló en `ProbarTracking.tsx` y por eso NINGUNO de los cinco renombres de esa pantalla se aplicó, incluido el que se había pedido textual — **y el commit salió diciendo que sí**. Un fallo parcial se convirtió en cero cambios, con el log en «ok» para los archivos que sí pasaron.',
      'Y de la misma tanda, el criterio de copy que quedó escrito: **el título dice el RESULTADO, no el mecanismo** («Se mide el tiempo de retención», no «Se mide cuánto ve»); un aviso de error termina en una ACCIÓN, primero qué hacer y después qué ganás; y el vocabulario es el del producto («instalado», no «pegado»). Todo en español neutro, que es la regla que se venía rompiendo cada vez que se escribía texto nuevo.',
    ],
    commits: [
      { sha: '417c539d', msg: 'landing: los 8 leads SI habian entrado — lo que faltaba era que alguien se enterara', lineas: 158, archivos: 5 },
      { sha: '663b32e7', msg: 'landing v6: se miden los clicks — el CTA y el link de WhatsApp eran invisibles', lineas: 131, archivos: 5 },
      { sha: '345fa3da', msg: 'landing: el probador muestra SOLO tu prueba, y las dos cosas que quedaron abiertas', lineas: 241, archivos: 8 },
      { sha: '627a8402', msg: 'landing: verificar pregunta por LA PAGINA, y la prueba abre una ventanita encima', lineas: 328, archivos: 8 },
      { sha: 'f7bd323f', msg: 'landing: «que es cada video» pasa a ser un paso de la prueba, y la ventana va sola', lineas: 134, archivos: 4 },
      { sha: 'a2620ef5', msg: 'copy: todo a español neutro, y los títulos que se entienden de una', lineas: 91, archivos: 6 },
      { sha: 'd2e28fff', msg: 'Pixel de MaKo: se llama igual en los 8 lugares donde aparecía distinto', lineas: 67, archivos: 8 },
      { sha: '3490e7d7', msg: 'Pixel de MaKo: los renombres que NO se habían aplicado, y el test que lo cuida', lineas: 40, archivos: 4 },
    ],
    archivos: [
      'app/integraciones/ProbarTracking.tsx — los chequeos, el feed y el marcador de prueba',
      'app/integraciones/escuchando/page.tsx — la ventana de 440 px, sin sidebar (`esVistaSinChrome`)',
      'docs/hallazgos-landing.md — los ocho leads, el marcador y la regla de la bandeja',
    ],
  },

  // ── 15 de agosto: el modal se vuelve un recorrido de cuatro pasos ──────────
  {
    fecha: '15 ago', hora: '10:35', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Cuatro pasos: Clarity primero, y la landing elegida gobierna todo lo demás',
    puntos: [
      '**Clarity es una integración propia y no se funde con el Pixel**, aunque compartan el `<script>`: son dos preguntas distintas —el Pixel siempre está, es nuestro y no se apaga; Clarity es opcional y con la cuenta del cliente—. Fundirlos haría que apagar uno apague el otro, y que el semáforo de la medición propia dependa de una credencial ajena. Va con dos credenciales por workspace y cifradas: **si vivieran en una env de la plataforma, TODOS los clientes escribirían en el proyecto del dueño y ninguno vería el suyo** (hay test que lo prohíbe).',
      '⚠️ **Y va PRIMERO, que no es una decisión estética: su bloque se arma cuando se GENERA el snippet.** Conectarlo después de pegar el código deja al cliente con un código que no lo trae y sin nada que se lo diga — el mismo modo de falla que ya costó 18 días de medición muerta.',
      '⚠️ **«Servicio inválido»: faltaba en el SEGUNDO catálogo.** Clarity estaba en el catálogo de integraciones (marcado `oculto`, porque no lleva tarjeta propia) pero no en el del método, que es de donde la barra de credenciales saca sus campos y sus pasos. **Son dos catálogos con dos preguntas distintas —«¿qué tarjetas existen?» y «¿qué campos pide este servicio?»— y una integración que se configura DENTRO de otra necesita estar en los dos.** Es justo el caso que nadie había tenido antes; ahora hay test.',
      '⚠️ **Una barra de credencial reimplementada a mano no es un detalle estético.** La primera versión de Clarity puso dos `<Input>` y un «Guardar»: se veía parecido y no tenía NINGUNO de sus estados —ni semáforo por campo, ni «?», ni ojo, ni probar, ni editar, ni borrar—, o sea una pantalla donde el usuario no sabe si lo que pegó quedó bien. Se cambió por el `ServicioConfigForm` de siempre, y con eso desaparecieron los dos textos que existían solo porque a esa barra le faltaban botones.',
      '**El ID del proyecto no sale del token, y se midió en vez de opinar:** el `sub` del JWT y el id del proyecto están en el mismo espacio de numeración (los dos empiezan con «y2», que es lo que hacía sospechar) y son identificadores distintos — el `sub` es de la cuenta. Los dos números quedaron en un comentario y en un test para que nadie gaste otra media hora. Lo que sí se pudo: **dejar de pedirlo mal**, aceptando la URL entera del panel, que es donde todo el mundo lo tiene a mano. Y se **guarda normalizado**: verificar una cosa y guardar otra es cómo se llega a una credencial que pasó la prueba y no funciona.',
      '**El cron hace las dos cosas que una pantalla no puede.** La Data Export API permite 10 requests por proyecto **por día**: si lo consultara la tab, tres personas abriéndola dos veces la agotan antes del mediodía. Y avisa **cinco días antes** de que Clarity borre la grabación (guarda 30 días; marcar favorita es manual, no hay endpoint): un aviso el día 29 llega cuando ya no hay tiempo, y al día 10 nadie sabe todavía si ese lead importa. ⚠️ Un error de Clarity **no pisa el caché** —lo de ayer sigue siendo cierto— y va **UN solo aviso con la lista**: el dedup de `emitirDelCatalogo` es por TIPO, así que un aviso por lead habría sonado solo para el primero de la tanda y los otros se habrían perdido en silencio.',
      '⚠️ **Con un video largo no se registraba nada durante el primer minuto.** Cuando se conocía la duración, el snippet tomaba el camino del porcentaje y SALÍA (`if (dur > 0) { …; return; }`): con un video de 23 minutos el primer hito de 5 % cae a los 71 segundos. No es un problema de la prueba — **un visitante real que mira 40 segundos y se va se registraba como si no hubiera visto nada**, y justo ése es el tramo donde se pierde a la mayoría.',
      '**Los chequeos se adaptan a la página, y el analizador la lee ANTES de probar.** La landing de Mauricio no tiene botones propios (es un Calendly embebido) y no recibe leads por formulario: con la lista fija le quedaban dos puntos en rojo **para siempre**, que es como se entrena a alguien a ignorar la lista entera. Aparece el estado «no aplica» y el veredicto cuenta solo los aplicables. ⚠️ El analizador **falla hacia «no sé», nunca hacia «no tiene»**: si la página está caída o bloquea bots, la prueba ofrece todos los pasos — un análisis fallido que apaga chequeos esconde justo los problemas que la prueba viene a encontrar.',
      '⚠️ **Elegir la landing pasa a ser el paso 1 y no es cosmético:** el código que se copia, si Clarity está conectado, si el Pixel está al día y qué pasos tiene la prueba son DISTINTOS en cada página. Mientras se elegía al final, la pantalla afirmaba cosas sobre «tu página» sin saber cuál, y con dos publicadas la mitad de esas afirmaciones eran falsas. Los pasos 2, 3 y 4 no se dibujan hasta que hay una elegida, y **al cambiar de landing se TIRA el estado** (`key={elegida}`): las claves de la anterior quedaban a la vista y se leían como de la recién elegida. Un loader habría tapado el síntoma dejando el mismo estado abajo.',
      'Dos trampas del rediseño que valen aparte: **un `Set` no sobrevive a un server action** —se serializa como `{}` y en desarrollo no se ve—, y **un `play` no es una intención cuando el player arranca solo**: el snippet marca `auto` si no hubo una sola interacción antes, y el chequeo se parte en «se detectó el player» (lo contesta cualquier play) y «alguien quiso verlo» (solo el manual, y solo ése pinta verde).',
      '📌 **El registro decía que esto seguía abierto y ya no lo está.** `docs/hallazgos-landing.md` cerró el 15/08 a las 17:17 con «PENDIENTE: el paso 1 hoy gobierna la navegación, pero el código y los chequeos siguen saliendo del workspace»; dos horas después quedó resuelto (`2a5c338e`) — un proyecto de Clarity es **por sitio**, así que dos landings con el mismo id mezclan sus grabaciones en una lista donde ya no se sabe cuál es cuál.',
    ],
    commits: [
      { sha: 'd89d2538', msg: 'clarity: integración BYOK, dentro del mismo Pixel, con el link por lead', lineas: 299, archivos: 9 },
      { sha: '1d853612', msg: 'clarity: se configura DENTRO del modal del Pixel, como primer paso opcional', lineas: 140, archivos: 5 },
      { sha: '52dfd9c3', msg: 'pixel: tres pasos separados, y Clarity usa la MISMA barra de credencial que el resto', lineas: 98, archivos: 2 },
      { sha: '8c2203f5', msg: 'clarity: «servicio inválido» — faltaba en el SEGUNDO catálogo. Y el copy, a neutro', lineas: 59, archivos: 4 },
      { sha: '3f6b1227', msg: 'clarity: el ID no sale del token (medido), pero se acepta pegar la URL del panel', lineas: 89, archivos: 4 },
      { sha: '517200d1', msg: 'clarity: el cron que cachea el resumen y avisa antes de que se borre la grabación', lineas: 227, archivos: 6 },
      { sha: '9deaf038', msg: 'pixel v9: la prueba se adapta a la landing, y los primeros segundos del video se miden', lineas: 78, archivos: 3 },
      { sha: 'd796b7b7', msg: 'landing: el analizador que mira QUÉ TIENE cada página, y las actions por landing', lineas: 349, archivos: 4 },
      { sha: '7446ae25', msg: 'pixel: elegir la landing es el PASO 1, y los otros tres dependen de esa elección', lineas: 153, archivos: 4 },
      { sha: 'e5213d77', msg: 'pixel v10: AGENDÓ, y el ciclo de vida del video (pausa, retoma, fin)', lineas: 94, archivos: 4 },
      { sha: '18fb7a8f', msg: 'pixel: el paso 4 usa la landing del paso 1, y cambiar de landing tira el estado viejo', lineas: 32, archivos: 1 },
      { sha: '2a5c338e', msg: 'pixel v11: el autoplay no cuenta como play, y todo se acota a la landing elegida', lineas: 675, archivos: 14 },
    ],
    archivos: [
      'app/integraciones/ConfigClarity.tsx · SelectorLanding.tsx — el paso 1 y el paso 2',
      'lib/landing-analisis.ts — qué tiene cada página (video medible, cómo capta, estado del Pixel)',
      'lib/landing-config.ts — la landing es la entidad y lleva SU `clarityProjectId`',
      'lib/clarity.ts · app/api/cron/clarity-vigilante/route.ts — resumen cacheado y aviso de vencimiento',
    ],
  },

  // ── 16 de agosto: probándolo con una clienta en vivo ──────────────────────
  {
    fecha: '16 ago', hora: '09:54', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Probando con una clienta: dos chequeos que medían otra cosa que la que decían',
    puntos: [
      '⚠️ **«Aún no llega la visita» junto a «se mide la retención», los dos en la misma pantalla.** Los chequeos se calculaban sobre la lista de eventos que se **muestra**, ordenada de más nueva a más vieja y **cortada en 25**. El pageview y el play son los PRIMEROS eventos de cualquier prueba, así que fueron los primeros en caerse del corte. Nació el día que el snippet empezó a mandar más eventos por visita: antes 25 alcanzaba. **Un chequeo no puede mirar la ventana de la vista**: ahora miran TODO y la pantalla sigue mostrando 25.',
      '⚠️ **El chequeo del formulario miraba la tabla equivocada.** El opt-in FUNCIONA —comprobado mandando uno con el token real: `{ok:true, lead:2246, creado:true}`— pero el chequeo buscaba en `propuestas`, y una propuesta se crea **únicamente cuando el contacto choca con uno existente**. El camino normal escribe el lead directo, así que ese renglón solo podía ponerse verde **si el lead era duplicado**. Ahora cruza por `visitor_id` contra los leads de la prueba.',
      '**Salir de la página, volver y cerrar son tres eventos distintos.** `exit` ya existía y no contesta esto: mide el punto de abandono DEL VIDEO y se dispara igual si la persona se fue a otra pestaña o si cerró todo. En una landing con un VSL de 23 minutos, la diferencia entre alguien que abandonó y alguien que fue a buscar la tarjeta es el dato. ⚠️ Al cerrar una pestaña **llegan los dos** (`visibilitychange` y después `pagehide`): no se adivina cuál va a pasar — se manda lo que ocurrió y **la lectura ordena**.',
      '**La ventana de MaKo se abre PRIMERO**, porque es la única cuyo bloqueo se puede detectar (la landing va con `noopener` y devuelve null siempre). Si el navegador la bloquea no se abre nada: **dejar la landing midiendo algo que nadie puede mirar es peor que no empezar.** Y cerrar la de la landing NO termina la prueba: eso es parte de la prueba —es el evento `cierre`— y tomarlo como fin apagaría la medición cuando más está midiendo.',
      '⚠️ **Un indicador de carga que no se distingue del fondo no es un indicador.** Reportado dos veces («aún no aparece el loader») sobre un loader que ya estaba en producción y se renderizaba: las barras usaban `--surface-2`, que sobre el fondo blanco del modal es casi el mismo color. Y la consulta tarda tan poco que el hueco aparecía y desaparecía sin llegar a verse, así que se le puso un **piso** de 450 ms — al revés de lo habitual, que es retrasar el loader para que no parpadee. **No aparece cuando no hay ninguna página cargada**: ahí la pelota está del lado del cliente, y un indicador de carga sobre algo que no está cargando es una promesa falsa que además gira para siempre.',
      'El esqueleto del paso 1 tiene la MISMA anatomía que el paso real (el número, el aire, el ancho) para que al llegar el contenido no salte nada de lugar — que es el otro modo de verse roto. Y **el selector avisa que terminó siempre, también si la consulta falló**: un esqueleto que no se apaga nunca es peor que la pantalla vacía que vino a tapar.',
      'Verificado contra las dos pruebas reales de ese día: los siete chequeos en verde. Y la detección de secciones sí funcionaba desde antes — lo que estaba roto era el chequeo, no el analizador.',
    ],
    commits: [
      { sha: '91693742', msg: 'pixel: un esqueleto debajo del paso 1 mientras se resuelve cual es la landing', lineas: 100, archivos: 4 },
      { sha: '7930ea3a', msg: 'pixel: el indicador de carga estaba puesto y no se veia', lineas: 86, archivos: 4 },
      { sha: '6d2c4e96', msg: 'pixel v14: salir de la pagina, volver y cerrar son tres eventos distintos', lineas: 93, archivos: 4 },
      { sha: '7008cf60', msg: 'prueba del Pixel: los chequeos miraban una ventana de 25 eventos, y el opt-in la tabla equivocada', lineas: 247, archivos: 5 },
    ],
  },
  // ── octubre: lo que salió de la llamada con Leila ──────────────────────────
  {
    fecha: '1 oct', hora: '00:50', chat: 'Debug de la llamada con Leila', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Calendly: el cliente conecta y no entra nada',
    pedido: '«Calendly. El cliente conecta, no entra nada y no hay ningún error. No sé por qué, como no uso Calendly. Esto yo creo de que lo que pasa es que está configurado el Calendly de Mauricio y los clientes conectan su calendly y no pasa nada, no hace nada.»',
    puntos: [
      'La hipótesis que él mismo dio en voz alta era la equivocada, y vale la pena que quede escrita: no se cruzaba con el Calendly de Mauricio.',
    ],
  },
  {
    fecha: '4 oct', hora: '12:56', chat: 'Debug de la llamada con Leila', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El campo que crea la fila de ruteo estaba marcado «opcional»',
    puntos: [
      '**Un webhook entrante llega sin sesión**: lo único que dice de quién es el evento es `webhook_routing` (mig 0090), y esa fila la escribe el guardado de una credencial de `ROUTING_CREDS`. Para Calendly son los dos EVENT_TYPE, y los dos estaban `opcional: true`. El único campo obligatorio era el token.',
      '**Y el webhook es fail-CLOSED a propósito** —sin mapeo no se toca un dato, para que la reserva de un cliente no caiga en el CRM del dueño—, así que conectar «bien» dejaba cero filas de ruteo y todas las reservas ignoradas con un 200 y un `console.warn` que no lee nadie.',
      '**Medido contra producción: de los 2 workspaces con Calendly conectado, UNO tenía token y signing key y CERO filas de ruteo.** El script quedó en `scripts/probe-calendly-sin-ruteo.ts` para volver a correrlo.',
      '**Y no hay red por otro lado: no existe ningún cron que ingiera la agenda.** Con el token MaKo COMPLETA las fechas de un lead que ya existe (al mover una tarjeta del CRM) y RESERVA; lo que crea el contacto a partir de una reserva es el webhook y nada más. La ayuda de la signing key decía lo contrario («tus reuniones igual entran, porque MaKo lee tu agenda con el Personal access token») y se corrigió: era el mismo malentendido por la otra puerta.',
      '**La regla queda en positivo y con guard**: cada servicio de ruteo tiene al menos una clave que el cliente no puede dejar vacía — obligatoria, o `auto` (la completa MaKo, como `META_PAGE_ID` al pegar el token). Sin la excepción de `auto`, el guard habría pedido hacer obligatorio un campo que el cliente no tiene de dónde sacar.',
      '⚠️ **Lo que esto NO arregla**: el workspace que ya está así. Una regla que se aplica al ESCRIBIR no toca una fila escrita. Lo que sí cambia es que su Calendly deja de contar como conectado, así que la pantalla muestra el campo en «pendiente» en vez de un verde que miente. El valor lo tiene que poner ese cliente: es el nombre de SU event type.',
    ],
    commits: [
      { sha: '1a0c13cf', msg: 'Calendly: el campo que crea la fila de ruteo deja de ser opcional', lineas: 263, archivos: 4 },
    ],
    archivos: [
      'lib/metodo-catalogo.ts — los R1 de Calendly y Cal.com, ahora obligatorios y con la nota diciendo qué se pierde',
      'lib/webhook-routing.ts — `ROUTING_CREDS`: las claves que escriben la fila de ruteo',
      'tests/webhook-ruteo-obligatorio.test.ts — cada servicio de ruteo con al menos una clave firme',
      'scripts/probe-calendly-sin-ruteo.ts — solo lectura: cuenta quién conectó y no tiene por dónde entrar',
    ],
  },
  {
    fecha: '5 oct', hora: '22:20', chat: 'Integraciones', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El tope de 2 cuentas de Zernio, que no se decía en ninguna pantalla',
    puntos: [
      'Sale de la tarea #829 del tablero, que lo trae de la llamada con Leila: ella vio cargos que no reconocía en su tarjeta por VINCULAR redes, sin usarlas — «aparecieron cargos de Cernio y de Wok y no los usé, o sea, simplemente los vinculé». Zernio incluye 2 cuentas conectadas y cobra de la 3.ª en adelante, y el producto no lo decía en ningún lado.',
      'Va en DOS lugares y los dos son permanentes: la nota del campo «API key de Zernio» (`lib/metodo-catalogo.ts`), que `ServicioConfigForm` dibuja bajo el input —es la que pedía el «Listo cuando» de la tarjeta—, y el paso de Zernio del onboarding de /instagram, pegado al camino «conecta tu propia cuenta», que es el que recorrió ella.',
      '⚠️ **NO dice cuánto cobra, a propósito.** Las dos fuentes se contradicen: la nota del 15/08 dice US$6 por cuenta al mes y Leila reportó ~US$16. Un precio ajeno no es un dato hasta verificarlo contra la página del proveedor ESE día, y el número no hace falta para el aviso: lo accionable es el TOPE. Queda como tarea nueva en la propuesta de cierre.',
      '⚠️ **Y NO lleva contador, que es lo primero que uno escribe.** `listAccounts` filtra por el profile del workspace y por `platform: instagram`, así que no ve ni las cuentas de los otros workspaces de la cuenta de Zernio de la PLATAFORMA ni las de otras redes que el cliente tenga en la SUYA. Cualquier «N de 2» sacado de ahí contaría de MENOS — o sea le diría que le queda lugar cuando no. El límite es de la cuenta de Zernio, no del profile: es una advertencia, no un medidor.',
    ],
    commits: [
      { sha: '507b63e9', msg: 'El tope de 2 cuentas de Zernio, dicho donde se decide y donde se pega la key (#829)', lineas: 19, archivos: 2 },
    ],
    archivos: [
      'lib/metodo-catalogo.ts — la nota del campo ZERNIO_API_KEY, que se dibuja siempre bajo el input',
      'app/instagram/OnboardingInstagram.tsx — el aviso en el paso de Zernio, sobre el camino de key propia',
    ],
  },
];
