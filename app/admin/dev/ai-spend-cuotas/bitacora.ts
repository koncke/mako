// =============================================================================
// AI Spend & Cuotas — el registro de construcción del área
// =============================================================================
// Alcance: el MEDIDOR. Una fila en `anthropic_usage` por cada llamada a un
// modelo, el precio con el que se tarifa, el saldo cargado a mano, cuánto queda
// de cada free tier (por proveedor Y por cuenta) y la única puerta por la que se
// puede gastar en Claude. Se ve en Integraciones › «Costo de MaKo».
//
// De dónde salió esto: los mensajes de commit de este repo, que explican el
// porqué y son la fuente principal; las trampas y lo que quedó sin hacer, de
// docs/hallazgos-ia.md (secciones «Gasto y saldo», «La capa barata» y «Comprar
// modelos»); fecha, hora y cuenta, del `git log` y del trailer `Claude-Cuenta:`.
// El índice de sesiones (docs/chats.md) llega hasta el 8 de agosto, así que las
// entradas posteriores llevan `chat: '—'` salvo donde el registro de un área
// hermana ya nombró la sesión. No se inventa: «—» es la respuesta correcta.
//
// ⚠️ Ojo con el solape, porque las dos áreas leen la MISMA tabla:
//   · `pricing`  = el modelo de negocio (qué se cobra, qué plan cierra).
//   · esta área  = el instrumento (qué se midió, con qué precio, y si es cierto).
// Cuando un commit toca las dos, acá va la mitad del instrumento.
//
// NO es un changelog. Lo que git ya guarda no se repite: va el motivo, la trampa
// y —sobre todo— cuándo el diagnóstico obvio era el equivocado.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'El libro: una fila por llamada', detalle: '`recordUsage` escribe feature, modelo, proveedor, tokens y `motivo` · el costo se congela al insertar · es lo único que permite discutir el gasto con datos', estado: 'hecha' },
  { titulo: 'El gasto por período, sin truncado', detalle: '`lib/costos-ia.ts` lee paginado y muestra cuántas filas leyó · `.limit(20000)` NO sube el techo de 1000 de PostgREST · filtro de mes en «Costo de MaKo»', estado: 'hecha' },
  { titulo: 'La cuota, medida POR CUENTA', detalle: 'mig 0132 agrega `anthropic_usage.cuenta` · el free tier se agota por key, así que el total sirve para «cuánto gasté» y nunca para «cuánto me queda» · la cascada arranca por la cuenta con nafta', estado: 'hecha' },
  { titulo: 'El libro migra con la key (BYOK)', detalle: 'el admin de cada workspace ve SU gasto · `wsDeProveedor` pregunta de quién es la key que pagó, no qué proveedor es · saldo y uso dejaron de ser globales al ws1', estado: 'hecha' },
  { titulo: 'El veto: una sola puerta a Claude', detalle: 'las cinco vías terminaban en el mismo `fetch` y ahí vive el control · lista blanca en código, con vencimiento · el bloqueo deja fila de US$0 en el mismo gráfico', estado: 'hecha' },
  { titulo: 'Qué le decimos al que se quedó sin IA', detalle: 'un 429 (cuota) y un 503 (proveedor saturado) piden cosas OPUESTAS · el texto vive solo en `lib/ia-mensajes.ts`, dice qué contestó cada cuenta y viene con la salida pegada (`ErrorIA`)', estado: 'hecha' },
  { titulo: 'Los tres módulos que gastan sin registrar', detalle: '`embeddings`, `transcribe` y `analyze-creatives` siguen en 0 llamadas a `recordUsage` y resuelven la key con `envCred` → todo número de gasto es un PISO, no un total', estado: 'sigue' },
  { titulo: 'Atribuir Claude a quién se trabajó', detalle: 'el registro sabe quién PAGA (la key) y no para quién se trabajó · el 84% del gasto de `closing` era de clientes y figuraba en ws1 · hace falta un segundo campo', estado: 'cola' },
  { titulo: 'Cortar de verdad: el límite por plan', detalle: '`ordenarPorCuota` reordena y NUNCA saca a nadie, y todos los `recordUsage` son posteriores a la llamada · un límite por plan se escribe entero y el chequeo va PRE-FLIGHT', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '1 oct', hora: '22:40', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El cartel de cuota, otra vez, en el grupo de un cliente de una agencia',
    pedido: 'Realmente hay que solucionar esto, es un producto totalmente defectuoso que MaKo cada 2 mensajes te diga esto...',
    puntos: [
      'Llegó con la captura del grupo de Código Inmobiliario: un cliente escribió «hola mako, como venimos de reuniones los ultimos 15 dias» y MaKo contestó «Te quedaste sin cuota de IA».',
      'El día anterior se había arreglado el mismo síntoma con OTRA causa. Que volviera al día siguiente es el dato: no era un bug, era una familia.',
      'Y «cada 2 mensajes» no era exageración: medido, a ese cliente le salió en 16 de sus 53 turnos y en las SEIS veces que preguntó por sus agendas.',
    ],
  },
  {
    fecha: '2 oct', hora: '01:30', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El prompt le ordenaba usar diez herramientas que no se le mandaron',
    puntos: [
      'La key del cliente contestó HTTP 200. Los tres 429 que eligieron el texto eran de MISTRAL, y mistral es de la red de plataforma: keys NUESTRAS. De las ocho entradas de la lista, siete eran de la agencia.',
      'La causa de que fallara: el mensaje se clasificó como saludo (el «hola» de adelante se comía la pregunta), y el contrato de un saludo es CERO herramientas — pero el router lo había escalado al camino caro, así que entró al loop de tool-use con el array vacío y el preámbulo entero.',
      'Lo que refutó la hipótesis y cambió el arreglo: pegándole en vivo a las dos APIs, la lista vacía NO es la causa. Con un system corto contestan perfecto; con el preámbulo que ordena usar herramientas revientan igual SIN el campo tools. Lo que rompe es el PROMPT.',
      'Y al partir el preámbulo se fue con él la prohibición de inventar: Groq contestó «hemos tenido 6 reuniones: 3 internas…». Seis reuniones que no existen. Peor que el cartel — se arregló en la misma pasada y se volvió a medir.',
      'El veredicto ahora se decide sólo con los errores DEL CLIENTE, y hay una causa nueva para «contestó y el problema fue nuestro»: sin link y sin pedirle que cargue nada.',
      'Y el cartel vuelve a dejar rastro: desde el arreglo del 30/09 no entra al historial y con eso se había perdido la única forma de contarlo.',
      '13 guards nuevos, los 16 cortes probados rompiéndolos uno por uno. Dos guards viejos se pusieron rojos por contar caracteres y uno era flojo de verdad: afirmaba que una llamada existía, no que fuera alcanzable.',
    ],
    archivos: [
      'lib/mako-doer-in.ts — el preámbulo partido · el system después de las tools · las dos listas de errores',
      'lib/ai-cheap.ts — sin tools no viaja el campo · la tool fantasma no corre · el 200 mudo se tipa · mistral fuera de la red',
      'lib/mako-intencion.ts — se pela el saludo · «cuántas» vuelve a ser pregunta',
      'lib/fallo-ia-texto.ts — la causa «fue nuestro» y el contexto medido',
      'tests/doer-turno-sin-tools.test.ts · tests/fallo-ia-texto.test.ts',
      'scripts/probe-saludo-sin-tools.ts — la verificación contra las dos APIs',
    ],
  },
  {
    fecha: '30 sep', hora: '20:48', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'La cuota que no se había acabado, y el «Ya estoy de vuelta»',
    pedido: 'Revisa esto, como es posible que se acabe tan rapido la cuota... Eso no puede ser así, realmente se acabó de 4 cuentas un par de mensajes? / Revisa que es aún mas raro, ahora dijo "Ya estoy de vuelta"',
    puntos: [
      'Llegó con la captura del WhatsApp: «⚠️ Probé tus 4 cuentas de IA y las 4 me rebotaron por límite». Dudó del número, y el número era el síntoma más chico de los cuatro.',
      'El segundo mensaje es el que destrabó el diagnóstico: un asistente que anuncia que volvió de una caída está leyendo esa caída en su propio historial.',
    ],
  },
  {
    fecha: '30 sep', hora: '23:10', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'No era la cuota: eran los PASOS, el respaldo que no existía y un 413 disfrazado',
    puntos: [
      'Medido para ese turno: Gemini contestó OCHO veces HTTP 200 en nueve segundos y el día iba 54 de 250 llamadas. La cuota estaba al 21%.',
      'La causa real: el modelo agotó maxSteps llamando herramientas y nunca redactó. Ahora un pedido más SIN herramientas cierra el turno con el trabajo que ya está en el hilo — es el request más barato y es lo único que el modelo no podía hacer solo.',
      'Y el veredicto juzgaba con los restos: las tres salidas MUDAS del loop (centinela, descarte por validación, red de plataforma) ahora escriben su motivo. Un continue que tira el resultado del único que contestó es evidencia que se descarta antes de juzgar.',
      'OpenAI no existía en NINGUNA cascada desde el 13/08 (85a020b8): provsDe leía clavesCargadas, que devuelve [] también para los proveedores de UNA sola cuenta. Es el último escalón de las tres cascadas y no corrió en seis semanas; a un ws con sólo esa key el producto le decía «no tenés IA».',
      'El 413 de Groq se clasificaba como cuota agotada porque su mensaje trae «rate-limits» en la URL de la documentación. Es una causa aparte, sin link y sin «reintentá»: cargar otra key no cambia el tope de entrada.',
      'Mistral y Cerebras salieron de la cascada del doer: rebotan SIEMPRE (429 con limit-req-minute 0 y 402 en las siete keys), así que le fabricaban el veredicto de cuota a cualquier falla.',
      'El 429 del doer ahora se anota: anotarRebote429 tenía UN call site, en la cascada que el doer no usa — 4.497 filas en la tabla y cero con la marca, así que el diagnóstico hubo que hacerlo pegándole a la API de Google a mano.',
      'Y el cartel de fallo dejó de guardarse como turno de MaKo, que es de dónde salía el «Ya estoy de vuelta».',
      '12 guards nuevos, los 10 probados rompiéndolos uno por uno (el detalle con los números, en los comentarios de cada test).',
    ],
    archivos: [
      'lib/ai-cheap.ts — provsDe pregunta por el catálogo · cerrarSinTools',
      'lib/ia-keys.ts — clavesAProbar, la decisión en un módulo con test',
      'lib/fallo-ia-texto.ts — el 413 es su propia causa · el mensaje no cuenta cuentas',
      'lib/mako-doer-in.ts — las tres salidas mudas · avisoDeSistema · el rebote anotado',
      'tests/ia-cascada-respaldo.test.ts · tests/doer-aviso-no-es-turno.test.ts',
      'docs/hallazgos-ia.md · docs/hallazgos-comunicacion.md · AGENTS.md',
    ],
  },
  // ── agosto: el medidor se vuelve un instrumento ────────────────────────────
  {
    fecha: '9 ago', hora: '00:24', chat: 'Cobros y planes · análisis de costos', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El medidor propio: leer paginado, porque `.limit(20000)` no sube ningún techo',
    puntos: [
      '⚠️ **La trampa que obligó a escribir un módulo nuevo en vez de pasar un parámetro.** `getUsageSummary` lee con `.limit(20000)` y eso **no sube el techo de 1000 filas de PostgREST**: agosto ya tenía 997 filas no-Anthropic contra ese techo, o sea que el número estaba a tres filas de empezar a mentir **sin ningún síntoma**. Un límite que corta en silencio es peor que un error. Por eso `lib/costos-ia.ts` pagina con `leerTodo` y expone `filas` en pantalla: el truncado no se puede esconder si se muestra cuántas filas se leyeron.',
      '**El pedido del dueño era chico y lo que destapó no:** «Sería bueno que incluyas un filtro de fecha y poder ver el gasto de otros meses también». El endpoint ya existía; cablearlo hizo visible que el origen del número **cambia según el período** — «este mes» sale de `/api/anthropic-usage` (la ventana del saldo cargado) y cualquier otro mes de `/api/costos-ia` (paginado). No se unificaron a propósito, y está rotulado en pantalla.',
      '**Los tiles de saldo y cuota NO siguen al filtro**, las gráficas por proceso sí. Un saldo restante de hoy al lado de un gasto de junio, sin aclaración, se lee como si fueran la misma ventana. Y un fetch fallido deja «—», nunca el número anterior: mostrar julio bajo el rótulo de junio es peor que no mostrar nada.',
      '**El US$93,50 contra el US$56,33 del panel no era una contradicción**: los 93,50 son 41 días que cruzan TRES meses y el panel dice «este mes». La ventana sin declarar era del lado del que reportaba, no del medidor.',
    ],
    commits: [
      { sha: '43e53483', msg: 'Tab de Pricing: el costo de la IA medido, y lo que decide si el negocio cierra', lineas: 890, archivos: 8 },
      { sha: '60718450', msg: 'integraciones: filtro de período en «Costo de MaKo»', lineas: 118, archivos: 2 },
    ],
    archivos: [
      'lib/costos-ia.ts — gasto por período, paginado; marca `atribuible:false` cuando hay filas de Anthropic',
      'app/api/costos-ia/route.ts — `?periodo=YYYY-MM`; `?meses=1` puebla el selector Y hace de sonda de permiso (si contesta 403, el cliente no ve el filtro)',
    ],
  },
  {
    fecha: '9 ago', hora: '01:19', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'cosecha',
    titulo: 'Cómo se lee el libro: `motivo` separa un cobro decidido de un fallback',
    puntos: [
      '**El caso que lo enseñó: el dueño reclamó dos veces el mismo día «el Perro sigue usando Claude», y la segunda vez el Perro no tenía nada que ver** — corría en Mistral a US$0 desde las 15:04. Lo que se veía en la captura de las 19:42 era `plan-fathom`: US$37 en 30 días contra US$0,81 del Perro. Lo único que permitió separar los dos casos fue la columna **`motivo`**, que distingue un cobro deliberado de un fallback que cayó ahí solo.',
      '⚠️ **Leer el catálogo para saber qué modelo usa una feature MIENTE.** El modelo real es `override del ws1 ?? def del catálogo`, y había trece features con `def: SONNET` mientras un override las corría en Gemini. Si no se cruza `app_settings` con `key=\'mako.modelos\'`, lo que se lee es la intención, no lo que pasó.',
      '**Y una fila por llamada no es una fila por conversación.** En un agente con herramientas `recordUsage` corre una vez **por paso del loop**: dos filas del mismo minuto con la misma feature son dos pasos de la misma charla. Una fila con `out: 6` no es «el router» —`rutearDoer` es regex síncrona y no emite fila nunca— es un `tool_call` sin argumentos. Sin saber eso, el mismo dato lleva a la conclusión contraria.',
    ],
    commits: [
      { sha: '9aa82ee8', msg: 'Cosecha: por qué el reclamo culpaba al Perro y cobraba plan-fathom', lineas: 83, archivos: 2 },
      { sha: '76e71483', msg: 'Cosecha: el registro de gasto dice si el agente llamó la tool, si sabés leerlo', lineas: 51, archivos: 1 },
    ],
  },
  {
    fecha: '9 ago', hora: '11:25', chat: 'Cobros y planes · análisis de costos', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Dos precios mal, y el mes queda partido en dos monedas para siempre',
    puntos: [
      '**Los dos errores se verificaron contra la referencia oficial del fabricante, no contra el repo.** Opus estaba a US$15/75 —los precios de Opus 4.1, retirado— cuando el oficial es 5/25, y el propio `lib/anthropic-usage.ts` ya lo tenía bien. Sonnet 5 estaba a 3/15 cuando hasta el 31/08/2026 rige el introductorio 2/10.',
      '⚠️ **La consecuencia es contable y es permanente: `cost_usd` se congela al insertar.** `recordUsage` llama a `costFor` y guarda el número; `getUsageSummary` devuelve lo almacenado tal cual. Así que las filas del 1 al 8 de agosto quedaron tarifadas a 3/15 y las del 9 en adelante a 2/10 **para el mismo modelo**: ~US$16 de los US$65 del mes son contabilidad, no plata.',
      '**Regla que queda: antes de festejar (o de diagnosticar) una caída de gasto, `git log -S` sobre la tabla de precios.** Toda comparación que cruce la fecha de un cambio de precio compara **unidades**, no comportamiento. Y sonnet-5 vuelve a 3/15 el 2026-09-01, verificado: o se guarda la versión del precio junto a la fila, o se documenta qué baseline cuelga de ahí.',
      '**Un error de precio de LISTA mueve lo que se cobra, no el margen** — dividía por tres el costo y el precio a la vez. El agente que lo encontró concluyó lo contrario, y es el error fácil acá: confundir la unidad de medida con el fenómeno medido.',
    ],
    commits: [{ sha: '14912639', msg: 'pricing: rediseño de la pantalla y DOS precios mal', lineas: 221, archivos: 4 }],
    archivos: ['lib/anthropic-usage.ts:50 — la tabla de precios · :112-115 — el congelado al insertar'],
  },

  // ── la rotación: el free tier se agota por CUENTA ──────────────────────────
  {
    fecha: '12 ago', hora: '18:16', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La rotación tenía un eje y hacían falta dos: proveedor y CUENTA',
    puntos: [
      '**El síntoma que no se veía como bug: la única salida que la app le ofrecía a alguien sin cuota era pegar de nuevo la key que ya estaba agotada.** Sabía guardar UNA key por proveedor. Ahora entran hasta 3 (después 10) por claves derivadas `GEMINI_API_KEY` / `_2` / `_3`, y **sin migración**: para la tabla `credenciales` son filas más, con el mismo cifrado y la misma auditoría.',
      '⚠️ **Cerrar una mitad del sistema deja la otra abierta, y esa es la forma en que esto falla.** «Claude es el ÚLTIMO recurso» estaba cumplida en `chatClaude` y **abierta en `chatClaudeTools`**, que probaba UN proveedor y se iba a Sonnet — justo el camino del doer y con el error más previsible de todos (429 de Gemini en tandas). También rotaban mal cinco `chatCheap` sueltos, dos de ellos cayendo a Claude por no poder escribir un título.',
      '**La restricción que la cascada de tool-use tiene y no se puede sacar:** si el proveedor que falló **ya ejecutó una herramienta**, se corta y se relanza el error. Reintentar después de una escritura la duplica. Un reintento no es gratis cuando el paso anterior tuvo efectos.',
      '⚠️ **El tilde verde probaba la key VIEJA.** Los pings de `verificarServicio` leen la clave BASE, así que al pegar `GEMINI_API_KEY_2` el valor efectivo seguía saliendo de la key 1 —que ya andaba— y el formulario decía «Guardada y probada». Cuando un form admite N valores para lo que el verificador conoce como uno solo, **el valor tipeado tiene que pisar al guardado antes del ping**, o el verde no significa nada.',
    ],
    commits: [{ sha: 'bee24ad4', msg: 'IA: rotar tambien entre CUENTAS del mismo proveedor, y cerrar los caminos sin cascada', lineas: 936, archivos: 20 }],
    archivos: [
      'lib/ia-keys.ts — las claves derivadas por cuenta, SIN `server-only` para poder testearlo',
      'app/_components/ConectarIA.tsx — el cuadro de «se quedó sin cuota» con las cinco IA gratis y su estado REAL',
    ],
  },

  // ── 13 de agosto: el día que el número se auditó entero ────────────────────
  {
    fecha: '13 ago', hora: '15:57', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'Dos tercios de los US$65 de agosto no eran trabajo',
    puntos: [
      '**Corrida de 9 agentes sobre el gasto real, y lo que cambia es la LECTURA del número, no el número.** US$16 son contabilidad (el cambio de precio de arriba). **US$34,67 —el 53% del mes— fue la misma reunión releída 8 veces por un cron sin tope de intentos**: no fue trabajo, fue el mismo trabajo repetido. Antes de optimizar un modelo, contá cuántas de las llamadas son la misma.',
      '**El 77% de lo que se le pagó a Opus fue para que dijera «esto no es una venta»:** 57 de 74 llamadas de agosto terminaron `descartada`, con el transcript entero de 60.000 chars adentro. Y **los dos umbrales deterministas obvios fallan medidos contra los datos** — «el lead ya tiene fecha_cierre» caza 2 de 57, y «sin lead en el CRM no se analiza» se lleva puestas 7 de las 17 ventas reales. El filtro tiene que ir antes, ir gratis, y ser un clasificador barato sobre metadatos, no un umbral.',
      '⚠️ **Dos diagnósticos obvios que eran los equivocados.** La «fuga» del Perro no era un 429 por concurrencia (eso explica US$1,22 de US$10,81): era el override de /modelos-ia apuntando a Sonnet. Y un output clavado en 32.000 exactos **no se arregla subiendo el tope** — ya se hizo una vez y multiplicó por 4 el costo de cada corte; si el JSON no entra, se PARTE.',
      '**Y la premisa de pricing que era falsa: «el 99,9% del gasto es del ws1» es un artefacto de `wsDeProveedor`**, que manda toda llamada de Anthropic a OWNER_WS. Cruzado contra `closing_analyses` —la tabla del dominio, no la del gasto— el **84% ya era trabajo de clientes**. Cuando el costo se atribuye por proveedor y no por consumidor, ninguna cifra «por workspace» sirve para decidir precio.',
      '**En la misma tanda se re-valuaron 513 filas** para que el libro cierre contra la factura: julio 10,96 → 5,92 y agosto 65,05 → 48,94, contra los US$51,97 del dashboard de Anthropic. Los ~US$3 que faltan son los módulos que gastan sin registrar. Quedó anotado en el código que el histórico YA se re-valuó, **para que nadie vuelva a correr ese UPDATE**.',
      '**Y una decisión del dueño con la advertencia escrita:** `closing` baja de Opus a Sonnet (~60% menos, unos US$8,60/mes). Se le avisó dos veces que en esta feature un modelo peor **no se rompe: contesta peor**, y un juicio comercial flojo se ve igual que uno bueno. Reafirmó. En la misma pasada se arregló lo que lo hacía invisible: `closing_analyses` guardaba el modelo como **constante hardcodeada**, así que la tabla iba a decir «opus» para siempre aunque corriera otra cosa — y cualquier degradación futura quedaba indetectable en los datos.',
    ],
    commits: [
      { sha: '636f032a', msg: 'El gasto de IA: dos tercios de los US$65 de agosto no eran trabajo', lineas: 168, archivos: 1 },
      { sha: 'c6d3b474', msg: 'El gasto registrado de IA ahora coincide con la factura de Anthropic', lineas: 8, archivos: 1 },
      { sha: '0a4deddb', msg: 'El analisis de llamadas baja de Opus a Sonnet (decision del dueño)', lineas: 36, archivos: 2 },
    ],
    archivos: ['docs/hallazgos-ia.md → «Gasto y saldo» — las cinco entradas de esta corrida, cada una con su `Vive en:`'],
  },
  {
    fecha: '13 ago', hora: '19:48', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Sumar tres cuotas que no se trasvasan: el panel decía «te sobra» y no había',
    puntos: [
      '**Reporte de una clienta con TRES cuentas de Gemini: «No hay IA para generar las razones. Conectá tu API key de Gemini» y, al lado, en la misma pantalla, 240,6k / 750,0k — le sobra el 68% del día.** Medido contra sus datos (ws 11): cuenta 1 al **96%** con las 24 llamadas, cuentas 2 y 3 en **0%**. Las dos cifras eran ciertas y la conclusión falsa.',
      '⚠️ **La regla que salió de acá y quedó en AGENTS.md: un total solo se puede sumar si el recurso se puede MOVER DE LUGAR.** Tres keys no son un tanque de 750k, son tres tanques de 250k. El total sigue existiendo y contesta «cuánto consumí», pero **`agotado` ya no sale de él** —un proveedor está sin cuota cuando lo están TODAS sus cuentas— y el panel muestra el reparto, una fila por cuenta.',
      '**La mitad proactiva, que se paga aparte: rotar solo por ERROR es pagar un peaje por llamada.** Con la cuenta 1 muerta, cada llamada gasta un 429 antes de llegar a la que tiene nafta. `ordenarCuentas` arranca por la que tiene cuota. La `mig 0132` agrega `anthropic_usage.cuenta`, con `NULL = 1` como verdad histórica: antes de multi-key había una sola.',
      '⚠️ **El diagnóstico obvio era el equivocado y se descartó con evidencia, no con argumento:** «las 3 keys son del mismo proyecto de Google y comparten cuota». Se pingueó cada una por separado — 200 / 503 transitorio / 200. Lo que hacía indiagnosticable el caso **era el mensaje**, no la rotación.',
      '**Y el mensaje se había arreglado en 2 de 4 lugares.** `avatares` y `entregable` ya distinguían «no hay key» de «hay key y falló»; la corrección se aplicó **a mano, call-site por call-site**, y quedaron afuera `generarRazones` (la pantalla del reporte) y `angulos-formatos`. Ahora el texto vive SOLO en `lib/ia-mensajes.ts`, incluye **qué contestó cada cuenta** —eso existía únicamente en `console.warn`, o sea en los logs de Vercel, que nadie lee y que a los 60 minutos no existen— y hay test que falla si el literal reaparece suelto. Esa guarda encontró un call-site más: `setting-simulador` decía «MaKo no respondió, volvé a intentarlo» ante una cuota agotada, y reintentar no arregla una cuota.',
    ],
    commits: [{ sha: 'c3e583e6', msg: 'IA: la cuota se mide POR CUENTA, y el error dice qué contestó cada una', lineas: 727, archivos: 16 }],
    archivos: [
      'lib/ia-cuotas.ts — `usoHoyPorCuenta`, `cuotasProveedores`, `ordenarCuentas`',
      'supabase/migrations/0132_uso_por_cuenta.sql — la columna `cuenta`',
      'lib/ia-mensajes.ts — el único lugar donde vive el texto que lee el usuario · tests/ia-mensajes.test.ts',
    ],
  },
  {
    fecha: '13 ago', hora: '20:13', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'correccion',
    titulo: '«0 operaciones recientes» no era un panel vacío: era un 403 pintado como cero',
    puntos: [
      '**La misma clienta, 24 llamadas hechas ese día, ve «0 operaciones recientes», $0.0000 y ningún historial** — con el gauge de arriba, en la MISMA pantalla, mostrando sus 240,6k tokens. `/api/anthropic-usage` la cortaba con **403** (`soloDueno`) y el board hace `if (j?.ok) setUsage(...)`: el rechazo dejaba `usage` en `null` y la UI lo pintaba como ceros.',
      '⚠️ **La regla: un permiso denegado y un dato en cero se ven exactamente igual.** Si un fetch puede fallar por PERMISO, el estado «no pude leer» no puede colapsar en «no hay nada» — el bug es invisible por diseño y por eso duró meses.',
      '**El guard no estaba mal cuando se escribió: describía un mundo que ya no existe.** La IA era UNA cuenta de la agencia; con BYOK cada cliente pone su key, la gasta y la paga. Es la misma deuda que el gauge que sumaba cuotas ajenas y el mensaje que le pedía una key al que tenía tres: **lecturas escritas antes de BYOK que siguen suponiendo «IA = agencia»**.',
      '⚠️ **Y abrir el guard, solo, habría abierto una fuga.** `getUsageSummary` mezclaba las filas de Claude de OWNER_WS en TODOS los resúmenes, y `motivo` es texto libre con nombres de otros clientes. Ahora es **una sola lectura del workspace del request**: para el dueño da lo mismo que antes y para un cliente arregla las dos cosas de una.',
      '**El corolario que cambia la pregunta: `wsDeProveedor` mandaba el gasto de Claude SIEMPRE a OWNER_WS**, así que un cliente con su propia `ANTHROPIC_API_KEY` se lo sumaba a Mauricio. La pregunta correcta no es «qué proveedor es» sino **de quién es la key que lo pagó**. (Con eso, `getSaldo`/`setSaldo` también dejaron de estar clavados al ws1 — la nota del área en `areas.ts` quedó vieja en ese punto.)',
      '**Y el «2%» que mostraban las cuentas sin usar:** el mínimo de ancho de la barra se había colado en el TEXTO. Un número inventado, en el panel que se acababa de arreglar justamente por eso.',
    ],
    commits: [{ sha: 'ca309b3e', msg: 'Gasto de IA: el cliente ve el SUYO (era un 403 pintado como "0 operaciones")', lineas: 135, archivos: 4 }],
    archivos: ['app/api/anthropic-usage/route.ts (`soloAdmin`) · lib/anthropic-usage.ts (`getUsageSummary`, `wsDeProveedor`)'],
  },
  {
    fecha: '13 ago', hora: '21:37', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El tope pasa a 10 cuentas — y por qué NO se puede sacar del todo',
    puntos: [
      '**El pedido del dueño traía el porqué adentro:** sacar el límite de 3 cuentas, un botón para agregar y saber a qué email pertenece cada key. El free tier de Gemini son 250k tokens/día **por cuenta** y el ws1 consume ~860k: 86-110 cortes por día, medidos en la base.',
      '⛔ **`MAX_KEYS` no es un número decorativo: la cadena `MAX_KEYS → clavesDe → CLAVES_EXTRA → ENVS_METODO` ES la whitelist que decide qué claves se pueden guardar.** Reemplazarla por un patrón tipo `/_API_KEY(_\\d+)?$/` «para que no tenga tope» abre un agujero grave: `guardarCredencial` termina en `process.env[clave] = valor` para el dueño y `cfgDe()` relee `CHEAP_BASE_URL` en CADA llamada — una clave de más aceptada es **todo el tráfico de IA de todos los inquilinos saliendo a otro host con los Bearer adentro**. 10 cubre 3× el consumo actual y subirlo es cambiar un número.',
      '**El botón «Agregar otra cuenta» YA EXISTÍA:** el pedido no era crearlo, era que no se quedara sin campos en la 3ª. Vale la pena mirar antes de construir.',
      '**El precio de subir el tope se paga en la misma pasada, o el gauge se vuelve impagable.** `provsDe` y `cuentasDe` resolvían las cuentas con un `credWs` **por slot**: con 3 eran 3 SELECT por proveedor, con 10 son 10 (hasta 50 por generación y otros 50 en cada pintada). Nace `lib/ia-keys-ws.ts`: UNA query por workspace, cacheada por **request** con `cache()` de React — **nunca `unstable_cache`**, que es cross-request, y cachear qué credenciales tiene cada inquilino es una fuga esperando a pasar. Si la lectura falla cae al catálogo entero: degrada al comportamiento viejo.',
      '**El email de cada cuenta es MANUAL, y no por vagancia: ninguno de los cinco proveedores expone el dueño de una key** (verificado uno por uno; Gemini lo dice por escrito, «Standard keys don\'t identify a caller», porque la key cuelga de un PROYECTO). Prometer un autocompletado que no existe era peor que pedir que se escriba una vez.',
      '⚠️ **El gotcha que lo habría dejado inútil:** el form pintaba `••••{mask}` en cuanto la credencial estaba guardada, **sin mirar si el campo es secreto**. Un email se habría visto «••••.com» — exactamente lo contrario de para lo que existe.',
      '⚠️ **Y una alarma con fecha que resultó no aplicar, corregida al día siguiente.** La doc de Gemini dice textual que en septiembre 2026 la API rechaza las keys **Standard**, y Gemini sostiene casi toda la IA gratis de MaKo. Se verificó descifrando cada fila: las 9 keys cargadas empiezan con `AQ.A` y miden 53 chars — formato **auth**, no las `AIza` de 39. **Una alarma que no aplica es peor que ninguna**, así que se corrigió la entrada dejando el chequeo del prefijo (la trampa sigue viva para una key que salga de un backup viejo). La regla que queda: antes de apoyar una feature en el free tier de un proveedor, buscá su página de **deprecaciones**, no la de precios — un free tier no se rompe subiendo el precio, se rompe cambiando el formato de la credencial.',
    ],
    commits: [
      { sha: '85a020b8', msg: 'Cuentas de IA: el tope pasa a 10 y cada key dice de que email es', lineas: 211, archivos: 8 },
      { sha: 'a5957fe1', msg: 'Cosecha: Google corta las keys Standard de Gemini en septiembre', lineas: 99, archivos: 1 },
      { sha: 'ecd65622', msg: 'Lo de las keys de Gemini NO aplica: las 9 ya son auth', lineas: 25, archivos: 1 },
    ],
    archivos: ['lib/ia-keys-ws.ts — UNA query de credenciales por workspace, cacheada por request'],
  },

  // ── el veto: la única puerta por la que se puede gastar en Claude ──────────
  {
    fecha: '14 ago', hora: '22:10', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Claude vetado: no había una puerta, había cinco',
    puntos: [
      '**El pedido del dueño, textual (13/8): «Que ya no se pueda gastar con Claude directamente, que se prohíba.»** Lo difícil no era prohibir: era que **cerrar cuatro puertas deja la quinta**, y eso ya había pasado — el `fallback: []` del día anterior tapó dos y las otras tres siguieron cobrando US$12,79.',
      '**Las cinco vías:** el `def` pago del catálogo · el fallback pago de `chatClaude` · el de `chatClaudeTools` (que ni consultaba la lista) · un `opts.model` explícito (saltea el registro entero, US$8,67) · y el `MODEL` del módulo cuando la feature no estaba registrada. **La quinta es la peor y explica la forma de la solución:** escribir `chatClaude` sin registrar la feature era el camino de MENOS esfuerzo y el MÁS caro, y en el diff se leía bien.',
      '**Las cinco terminan en el mismo `fetch`, y ahí va el control.** `lib/anthropic.ts` se queda **sin `MODEL` y sin `ENDPOINT`**: la URL sale de `permiso.endpoint`, así que un `fetch` a Claude escrito por afuera **no tipa**. Y no hay modelo por default: si no se resuelve, la salida honesta es fallar, no elegir el caro.',
      '⚠️ **Tres cosas que hacen que el veto no se apague solo.** La lista blanca vive en **código** (bloquear es instantáneo, desbloquear necesita deploy; en `app_settings` se desarmaba con un script de tres líneas). Los permisos **vencen**, y el test avisa 14 días antes. Y el bloqueo **se REGISTRA, no se loguea**: `recordUsage(feature, \'vetado:<modelo>\', {}, razón)` deja una fila de US$0 y 0 tokens **en el mismo gráfico que él mira** — sin eso, un veto que funciona y un veto que nadie disparó se ven iguales.',
      '**Lo que NO entró, y no es un olvido:** `experimentos` y `lead_insights` tenían `pagoPorque` escrito y ninguna corre desde julio. **Una autorización que nadie usa es una que nadie revisa** — el día que alguien la prenda paga Opus sin que nadie lo haya decidido. Bajan a Gemini. `closing` queda autorizado con Sonnet (declarar Opus lo habría roto el día 1, porque el dueño lo bajó el 13/8) y vencimiento a 3 meses.',
      '**El interruptor de pánico (`mako.claude.pausa`) va en UNA sola dirección: puede apagar, nunca encender.** Si Supabase se cae el resultado es «no pausado», y eso no abre nada porque lo que autoriza es la lista de código. Un store que puede fallar solo tiene permitido hacer las cosas MÁS restrictivas.',
      '**Y quedaron LISTADOS los tres scripts que le pegan a Anthropic por afuera.** Corren a mano con la key del dueño, así que no se vetan — pero listarlos hace que un script nuevo que copie ese `fetch` aparezca en el diff.',
    ],
    commits: [{ sha: 'e951aba5', msg: 'Claude vetado: no había una puerta, había cinco', lineas: 513, archivos: 6 }],
    archivos: [
      'lib/veto-claude.ts — `CLAUDE_PERMITIDO` (modelo, vencimiento, quién lo pidió) y `permisoDeGasto`',
      'lib/anthropic.ts:52-53 — el bloqueo que escribe su propia fila en el medidor',
    ],
  },

  // ── 16 de agosto: qué le decimos al que se quedó sin IA ────────────────────
  {
    fecha: '16 ago', hora: '19:38', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'No era la cuota: era el proveedor saturado, y el mensaje mandó a comprar créditos',
    puntos: [
      '**Cliente esperando, 4 documentos, «No se pudo procesar nada de lo que subiste», y uno de los cuatro decía «Se quedó sin cuota». Falso.** Medido contra las keys reales: Gemini devolvía **HTTP 503 «high demand»** — el proveedor saturado, no la cuota, no la key. Minutos después la MISMA key contestó 200 tres de tres.',
      '⚠️ **`motivoDeErroresCascada` no tenía caso para 503.** Tres documentos caían al genérico y el cuarto matcheaba `\\b429\\b` por un rate-limit suelto de la misma tanda → «sin cuota». **La diferencia es accionable: la cuota se arregla cargando otra key o pagando; la saturación se arregla ESPERANDO.** Mandar a alguien a comprar créditos por un bache del proveedor es el peor consejo posible. Por eso la saturación se clasifica **antes** que la cuota: cuatro llamadas contra un proveedor que se cae dan 503 y 429 mezclados, y el que manda es el que explica la tanda.',
      '**Un reintento solo cuando no hay a dónde caer.** Ese workspace tenía un proveedor y una key: la cascada no tenía a quién pasarle la pelota y se rendía a los 1,5 s. Ahora, **solo como último recurso**, insiste 3 veces con espera creciente (1,5 · 4 · 9 s). Con otra cuenta esperando sigue siendo un solo intento — seguir golpeando al que falla es tiempo que el usuario mira una pantalla quieta.',
      '⚠️ **Lo que dejó pasar a las otras dos: la función que decide qué lee el usuario era INTESTEABLE.** `motivoDeErroresCascada` es pura y vivía adentro de `lib/ai-cheap.ts`, que tiene `server-only`: ningún test la podía importar. **Lo único sin red era justo lo que le habla a la persona**, y el test viejo tenía el bug congelado como caso esperado (`{ motivo: null, errores: [\'HTTP 503 high demand\'] }`).',
      '**Y esa misma noche, la salida.** Pedido del dueño con un cliente trabado: «no puede ser que se exceda la quota durante el onboarding, y en dicho caso debería ahí mismo saltar la opción de dejarle otra key, como ya tenemos configurado». **Estaba configurado**: `ConectarIA` vivía enchufado en una sola pantalla. Y aunque hubiera estado puesto no se habría dibujado — el detector era un regex que buscaba «cuota» y lo que Google manda es «**quota**». Dos fallas encadenadas que se tapaban entre sí. Nace `ErrorIA` (error + salida juntos) y `esErrorDeIA` se muda a `lib/ia-mensajes.ts`, con el error TEXTUAL del cliente como test.',
      '⚠️ **El diagnóstico de fondo, que solo apareció al LEER el error crudo en vez de esconderlo: `limit: 20, model: gemini-3.7-flash`.** El free tier de ese modelo son **veinte requests**, y un onboarding con 6 documentos y varias fotos se lo come solo. **No es un cliente que usa de más: es el modelo equivocado para el trabajo.** Cada modelo tiene su propio balde de cuota, así que rotar el MODELO (tercer eje, extendido al camino de visión) no solo esquiva un 503: esquiva el límite de 20.',
      '**El error crudo ya no manda:** al cliente le llegaban seis renglones de `generativelanguage.googleapis.com` y dos URLs de docs de Google, que no le dicen qué hacer y **enterraban el botón que sí lo resuelve**. Va detrás de «ver detalle». Y hay test de que NO se ofrezca conectar IA por un formato no soportado: **una salida que aparece siempre es una salida que nadie lee**.',
    ],
    commits: [
      { sha: '2601639b', msg: 'No era la cuota: era Gemini saturado, y el mensaje mandó a buscar lo que no existía', lineas: 117, archivos: 3 },
      { sha: '740bc35f', msg: 'La salida para cargar otra key estaba configurada. En UNA sola pantalla', lineas: 443, archivos: 7 },
      { sha: 'c29580d7', msg: 'Cosecha de las corridas de hoy: IA, onboarding y cómo se diagnostica un vacío', lineas: 229, archivos: 3 },
    ],
    archivos: [
      'lib/ia-mensajes.ts — `motivoDeErroresCascada` y `esErrorDeIA`, puros y testeables',
      'app/_components/ErrorIA.tsx — el error y su salida, juntos; hay guarda que falla si una pantalla deja de importarla',
      '⚠️ Vivo: `ordenarPorCuota` (lib/ia-cuotas.ts:180-195) reordena proveedores y NUNCA saca ninguno — nada en `lib/` corta una llamada por gasto',
      '⚠️ Vivo: `lib/embeddings.ts`, `lib/transcribe.ts` y `app/api/ads-manager/analyze-creatives/route.ts` siguen con 0 `recordUsage` y resuelven la key con `envCred` → un cliente BYOK igual se lo paga la agencia',
    ],
  },
];
