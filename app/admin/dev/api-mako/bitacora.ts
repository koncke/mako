// =============================================================================
// API de MaKo — el registro de construcción del área
// =============================================================================
// Alcance: el registro de operaciones (lib/api-mako), su transporte HTTP (/api/v1),
// la referencia generada y la tab /api-mako. La puerta vieja del Claude Code del
// cliente (/api/agente) es el área «Agent Gateway».
//
// ⚠️ Leído entero, este registro cuenta una cosa que se repitió dos veces: la API se
// construyó entera en dos días de septiembre, y el 08/10 Martín la volvió a pedir
// sin recordar que existía. Lo que faltaba nunca fue la API: era que se VIERA (no
// había pantalla ni área en /admin/dev) y que la usaran los que más la necesitan
// (el doer y los flujos). Antes de construir «la API de X», mirar acá.
//
// De dónde salió esto: fecha, hora, sha, cuenta y tamaño de `git log` sobre
// lib/api-mako y app/api/v1; los pedidos textuales, de docs/api-mako-diseno.md
// (§ 10) y del mensaje del chat «Chatbot» del 08/10, que los citaba literales.
//
// NO es un changelog: va el motivo, la trampa y lo que quedó sin hacer.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'El registro', detalle: 'Una operación se declara UNA vez (`<área>.def.ts` + `.run.ts`) y de ahí salen las tools del doer, /api/v1, la referencia y la skill · canales en positivo, confirmación chat|pantalla, nunca «directo»', estado: 'hecha' },
  { titulo: '/api/v1 con alcance por prefijo', detalle: 'lectura / proponer / ejecutar viajan en el prefijo del token: rotar lo resetea · por HTTP sólo confirma un token `ejecutar` y siempre con id', estado: 'hecha' },
  { titulo: 'La tab /api-mako, con el aspecto de GitHub', detalle: 'Documentación como docs.github.com (área → recurso → endpoints, ejemplos en cURL/JavaScript/Python), los tokens como Settings → Personal access tokens y el registro como el Security log · el registro no viaja al navegador', estado: 'hecha' },
  { titulo: 'Tokens detallados', detalle: '`mako_pat_`, varios por workspace, con permisos por área (Sin acceso / Solo lectura / Lectura y escritura) y vencimiento · escriben en el acto salvo lo que gasta plata · valen SOLO para /api/v1', estado: 'hecha' },
  { titulo: 'Rutas REST y convenciones de GitHub', detalle: '379 rutas por recurso como alias · versión por fecha, rate limit en headers y en /rate_limit, errores {message, documentation_url, status}, 403 con el permiso que falta, ETag/304, OpenAPI 3.1', estado: 'hecha' },
  { titulo: 'El curso por la API', detalle: 'Área «curso»: leer cursos, módulos y clases; crear y ordenar módulos (sueltos por default); crear, editar, mover, borrar y restaurar clases · la guía «Migrar un curso con Claude»', estado: 'hecha' },
  { titulo: 'La tarea y el video embed del curso por la API', detalle: '`tareas` en crear y editar una clase (la principal sin título, las demás con título; los ids de los campos se conservan) · `videoUrl` acepta el `<iframe>` de Panda, Wistia o Bunny · se escribe por `guardarLeccion`, el camino del editor', estado: 'hecha' },
  { titulo: 'Un token se apaga cuando su creador pierde el acceso', detalle: 'Como en GitHub: `resolverTokenApi` mira en cada pedido (con un minuto de memoria) que quien lo creó siga siendo admin de ese negocio, admin global o agencia aprobada; si no, 401 con su motivo · el juicio, puro, en tokens-creador.ts', estado: 'hecha' },
  { titulo: 'Catálogo liviano', detalle: '`?compacto=1`, `?area=` y `?operacion=`: de ~90k tokens a ~6k para arrancar · la skill ya enseña ese camino', estado: 'hecha' },
  { titulo: 'Una sola copia de las 25 tools', detalle: 'El doer y el chat mandan el ToolDef viejo y ya divergieron de la def · antes hay que arreglar la def de `proponer_tareas_plan` (docs/api-mako-diseno.md § 10)', estado: 'sigue' },
  { titulo: 'Canal `flujo`', detalle: 'Que una automatización corra cualquier operación sin confirmar cada vez (decisión A de Martín, 08/10) · `ejecutarDesdeFlujo`, sin un canal nuevo', estado: 'hecha' },
  { titulo: 'Qué token pidió cada llamada', detalle: '`api_llamadas.token_id` (migración 0222): el registro de la tab filtra y desglosa por token', estado: 'hecha' },
  { titulo: 'El alcance en /api/agente', detalle: '/plan y /lead (POST) no lo miran: un principal acuñado como `lectura` propone igual · /api/agente se mantiene tal cual por decisión de Martín', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── septiembre: la API nace entera ─────────────────────────────────────────
  {
    fecha: '16 sep', hora: '16:02', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Nace el registro: una operación se declara una vez',
    puntos: [
      'El pedido fue recorrer MaKo tab por tab, detectar todos los «end points» y dejar una API que consuman MaKo por WhatsApp, la skill de Claude y lo que venga. Salió como UN registro por área del que se derivan las tools del doer, `/api/v1` y `docs/api-mako.md`: escribir la capacidad en una ruta aparte es la segunda implementación de lo mismo.',
      'Las decisiones que no se re-discuten nacieron acá: **el canal propone, una persona confirma** (no existe «directo» en el tipo); lo que mueve plata se confirma en una pantalla y sólo el admin; el alcance del token viaja en su PREFIJO para que rotarlo lo resetee sin un segundo setting que se desfase.',
      '⚠️ `canales` es obligatorio y en positivo: declarar `tipo: lectura` no es decidir que salga por HTTP a un token que vive en la máquina de un tercero. `tests/api-mako-http.snapshot.txt` es la lista de lo que sale, y exponer algo nuevo es regenerarla — decidirlo.',
    ],
    commits: [
      { sha: '3717bef4', msg: 'API de MaKo: el nucleo (registro, choke point, /api/v1, alcance por prefijo, bitacora)', lineas: 2971, archivos: 68 },
      { sha: '09291da6', msg: 'API de MaKo: lo que encontro el revisor adversarial en el nucleo', lineas: 489, archivos: 13 },
      { sha: '8751d4aa', msg: 'API de MaKo: las 19 areas, las pantallas que confirman y el doer conectado al registro', lineas: 34403, archivos: 88 },
    ],
    archivos: [
      'lib/api-mako/tipos.ts — el contrato de una operación: canales, confirmación, gating, costo',
      'lib/api-mako/ejecutar.ts — el choke point: UNA función corre cualquier operación, por cualquier canal',
      'app/api/v1/[area]/[operacion]/route.ts — una ruta para todas, con la bitácora en todas las salidas',
    ],
  },
  {
    fecha: '7 oct', hora: '19:38', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: '«No pude verificar el token» deja de contestarse 401',
    puntos: [
      'Con la base caída, el resolvedor del token devolvía null y /api/v1 contestaba «token inválido o revocado» sobre un token BUENO: eso manda a la persona a rotarlo y a reconfigurar su skill por un corte de segundos. Ahora «no pude leer» tira y la ruta contesta 503 con `reintentar: true`.',
    ],
    commits: [
      { sha: 'dd58b168', msg: 'Ruteo estricto en /api/track y los tokens: «no pude leer» deja de contestarse como «no es de nadie»', lineas: 279, archivos: 18 },
    ],
  },
  // ── 08/10: Martín la vuelve a pedir ────────────────────────────────────────
  {
    fecha: '8 oct', hora: '02:24', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'La pidió de nuevo, y ya existía',
    pedido: 'tener muy bien modularizado todas las acciones de MaKo... me imagino que cada acción sea algo como /crm-lead-X... que MaKo tenga una API propia, con todas las acciones bien documentadas y moduladas, como un CRUD... y así nos podemos ahorrar muchos tokens en la búsqueda. Y también muy importante, podemos configurar acciones en el chatbot y en otros lugares que se pueda integrar la API de MaKo',
    puntos: [
      '**La API ya existía**: 498 operaciones en 18 áreas (316 lecturas, 180 acciones, 2 controles), 379 por HTTP. Lo que faltaba era que la usaran el doer y los flujos (las 25 tools más usadas están declaradas dos veces y ya divergieron) y que se pudiera VER.',
      'Cinco decisiones suyas, el mismo día: un flujo corre cualquier operación sin confirmar cada vez (A); MaKo ofrece la acción y espera el «sí» (B); no renombrar (C); /api/agente se mantiene tal cual (D); el paso «⚡ Acción» del lienzo de avisos se hace funcionar (E). Plan entero en docs/api-mako-diseno.md § 10.',
    ],
    commits: [
      { sha: 'b606c966', msg: 'Cosecha: la API de MaKo ya existe; lo que falta es que el doer y los flujos pasen por ella', lineas: 258, archivos: 6 },
    ],
  },
  {
    fecha: '8 oct', hora: '04:21', chat: 'API de MaKo', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La tab /api-mako, tokens con nombre y el catálogo liviano',
    pedido: 'manda toda la info que tienes al chat de API de MaKo, para que cree la tab de API y que sea 100% funcional',
    puntos: [
      'Dos decisiones de Martín al arrancar: **varios tokens, con nombre** (hasta acá era UNO por workspace y dar uno de solo lectura le apagaba las propuestas a la skill), y la tab **la ve todo admin de workspace**, en el menú de la foto al lado de Integraciones.',
      '⚠️ **El diagnóstico obvio era el equivocado: «que los tokens nuevos valgan en todas las rutas».** `/api/agente/skill` arma el archivo de la skill con `getAgenteToken(ws) ?? token`, o sea el token PRINCIPAL: con un token «Solo leer» se bajaba la skill con el principal adentro, que propone. Y el reporte del plugin (`/hook`, `/telemetria`) tiene su consentimiento atado al principal. Por eso un token con nombre vale SOLO para /api/v1, y `tests/api-mako-tokens.test.ts` lo fija leyendo el fuente.',
      'Del token nuevo se guarda el hash (sha256), nunca el valor: se muestra una vez. El índice token → workspace es `webhook_routing(\'api_token\', hash, ws)`, append-only como el del principal, así que lo que decide si vale es la LISTA del workspace — igual que el setting en el principal.',
      'El catálogo entero son ~360 mil caracteres (~90k tokens): `?compacto=1`, `?area=` y `?operacion=` son aditivos, y la skill pasó a enseñar «el índice y después el detalle de la que vas a usar».',
      'La pantalla no importa el registro: recibe un índice armado en el server y pide el detalle al abrir una operación. «Probar» corre sólo lecturas gratis o de proveedor, con el mismo canal y gating que un token `lectura`.',
      'Verificado de punta a punta contra el server local en el ws 9, con un token «Solo leer» real: el índice 37.724 caracteres contra 194.449 entero, una acción 404, /api/agente/skill y /contexto 401, y revocado, 401.',
    ],
    commits: [
      { sha: 'f2c0a04b', msg: 'API de MaKo: la tab /api-mako, tokens con nombre y el catálogo liviano', lineas: 1982, archivos: 22 },
    ],
    archivos: [
      'lib/api-mako/tokens-lista.ts — la parte pura y el porqué de la forma',
      'lib/api-mako/tokens.ts — crear, revocar, listar y `wsPorTokenApi` (el resolvedor de /api/v1)',
      'lib/api-mako/tokens-uso.ts — el «último uso», con freno de 10 min por token',
      'app/api-mako/ — la tab: datos.ts arma, actions.ts actúa, ApiMako.tsx y sus cuatro vistas dibujan',
      'app/api/v1/route.ts — los filtros del catálogo',
    ],
  },
  {
    fecha: '8 oct', hora: '03:51', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Un paso de un flujo corre cualquier acción, por el mismo choke point',
    pedido: 'Que pueda hacer todo, sin limitaciones.',
    puntos: [
      'Las cinco decisiones de Martín del § 10 están contestadas (docs/api-mako-diseno.md). La que cambia el registro es la A: un paso «⚡ Acción» de un flujo corre cualquier acción, sin pedir un «sí».',
      '⚠️ **El diagnóstico obvio era el equivocado: sumar un canal `flujo`.** `canales` es una lista en positivo en las 498 operaciones; va con el canal `app` y una clave con prefijo (`app:flujo:`). CANALES no cambió.',
      '⚠️ **Confirmar corre el `ejecutar()` sin contexto de workspace**: medido en el ws3, el historial de una nota tiraba «cookies was called outside a request scope». El ejecutor fija el workspace él mismo.',
      '**«Ya está así» no es un fallo para un flujo**: `Preparado` gana `yaEstaba` y el ejecutor lo cuenta como éxito, o «cuando agenda, movelo» alarmaba al dueño en cada reagenda.',
      'Operaciones nuevas: meter a un lead en UNA secuencia, y agregarlo, sacarlo o moverlo en uno de sus productos del CRM. Ninguna sale por HTTP.',
    ],
    commits: [
      { sha: 'fafe007b', msg: 'API de MaKo: un paso de un flujo corre cualquier acción, por el mismo choke point', lineas: 350, archivos: 6 },
      { sha: '63a0f95a', msg: 'Flujos: el ejecutor fija el workspace él mismo, y las heredadas dejan el flujo como origen', lineas: 19, archivos: 2 },
      { sha: '40d8f052', msg: 'API de MaKo: meter un lead en UNA secuencia, y un lead en varios productos del CRM', lineas: 942, archivos: 12 },
      { sha: 'b2a6db9d', msg: 'Paso «⚡ Acción»: lo que lo rodea deja de tratarlo como un mensaje vacío', lineas: 177, archivos: 12 },
      { sha: '395c4c11', msg: 'Revisión adversarial del paso «⚡ Acción»: los 14 confirmados que quedaban, arreglados', lineas: 436, archivos: 20 },
    ],
    archivos: [
      'lib/api-mako/flujo.ts — ejecutarDesdeFlujo: propone y confirma por el camino de cada forma',
      'lib/api-mako/flujo-params.ts — el lead del evento y los parámetros del paso (puro, con test)',
      'app/_components/EditorAccionMako.tsx — el editor del paso, compartido por los dos lienzos',
      'app/api/flujos/acciones/route.ts — el catálogo que ve el editor, armado en el server',
      'lib/api-mako/areas/crm.run.ts, chatbot.run.ts — las operaciones nuevas',
    ],
  },
  {
    fecha: '8 oct', hora: '06:02', chat: 'API de MaKo', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Que se parezca a la API de GitHub, en todo',
    pedido: 'Me gusta como hace la API GitHub, con su diseño, permisos, presentación, etc... Copialo todo, tal cual.',
    puntos: [
      'Cuatro decisiones suyas, a dos minutos: **«como GitHub: escribe directo»** (un token con permiso de escritura hace el cambio; lo que gasta plata sigue en una pantalla), **permisos por área y vencimiento**, **las URLs de GitHub como alias** (las rutas por operación no se renombran: la decisión C sigue) y **«que se vea igual a GitHub»**.',
      'Cambia la regla de la casa «un canal propone y una persona confirma» para un caso: el token detallado con escritura. El clásico (la skill) sigue proponiendo.',
    ],
  },
  {
    fecha: '8 oct', hora: '08:41', chat: 'API de MaKo', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La API copiada de GitHub: tokens que escriben, permisos por área, rutas REST y su pantalla',
    pedido: 'Copialo todo, tal cual.',
    puntos: [
      'Antes de escribir, un relevo de cómo lo hace GitHub (8 agentes leyendo docs.github.com, su OpenAPI y su código) y el diseño de las 379 rutas REST, chequeado contra el registro sin un solo choque.',
      '⚠️ **El diagnóstico obvio era el equivocado: filtrar los permisos en la ruta.** Van en `gatingOk`, que también corre al CONFIRMAR: si no, un token con escritura sólo en «mako» confirmaba pendientes de cualquier área.',
      '**Escribir directo no es un segundo camino**: el token detallado pasa por `aplicarEnElActo`, el mismo con que confirma un flujo. Probado contra la base (ignorar y reactivar los datos sin marcar de un lead del ws 9): 200 las dos, el lead quedó igual.',
      '⚠️ **El token recién creado se perdía en la pantalla**: cambiar `?v=` monta de nuevo la página (los searchParams son parte de su clave) y `push` + `refresh` la montaba dos veces. Vive en una variable de módulo, una vez, como en GitHub.',
      'Sin hacer, en docs/hallazgos-api-mako.md: que un token se apague cuando su creador pierde el acceso, el modo sudo, webhooks salientes, OAuth, `documentation_url` pública y más runners con `yaEstaba`.',
    ],
    commits: [
      { sha: 'b51155c9', msg: 'API de MaKo copiada de GitHub: tokens detallados que escriben, permisos por área, rutas REST y la pantalla con su aspecto', lineas: 11114, archivos: 43 },
    ],
    archivos: [
      'lib/api-mako/permisos.ts — los niveles por área y el permiso que pide cada operación (puro, lo lee la pantalla)',
      'lib/api-mako/tokens.ts, tokens-lista.ts, tokens-forma.ts — crear, editar, regenerar, revocar y resolver los detallados',
      'lib/api-mako/rutas-http.ts — `correr()`: el único lugar que decide si se lee, se propone o se escribe en el acto',
      'lib/api-mako/rest.ts, recursos.ts — la tabla de rutas REST, el router y el nombre de cada recurso',
      'lib/api-mako/http.ts, version.ts — autenticación y convenciones de GitHub (versión, rate limit, errores, ETag)',
      'lib/api-mako/ejemplos.ts, openapi.ts — los ejemplos en cURL/JavaScript/Python y la descripción OpenAPI',
      'app/api-mako/ — la pantalla (github.css con los valores de Primer, Docs, Endpoint, Articulos, Tokens, Registro)',
      'supabase/migrations/0222_api_llamadas_token.sql — qué token pidió cada llamada (aplicada el 08/10)',
    ],
  },
  {
    fecha: '8 oct', hora: '12:42', chat: 'Customer Success', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Que un Claude pueda subir el curso solo',
    pedido: 'vos en MaKo ya tenés MaKo API entonces como ya tenés MaKo API podés generar tu propio token y tenés la documentación… Lo último que hice fue el tema de curso No están las acciones dentro de curso Como agregar nueva clase Agregar nuevo lo que sea Acá, entonces tengo que agregar El tema de curso en la API… para los usuarios que no son tan técnicos… un pequeño tutorial de copia tu token de API, pásalo a Claude y dile que te haga tal.',
    puntos: [
      'Salió de una prueba del curso con alguien que tiene el suyo en Panda: «si yo tengo que pasar cada uno de estos videos de Panda… me va a tardar como una hora y media… acá manual me pego un tiro». Audio del 08/10 (docs/feedback-curso-08oct.md, ~04:00-07:30), repartido por el chat de Customer Success.',
    ],
  },
  {
    fecha: '8 oct', hora: '14:24', chat: 'API de MaKo', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El curso entra a la API: un Claude con un token «Curso» migra un curso entero',
    pedido: 'tengo que agregar el tema de curso en la API',
    puntos: [
      'Área nueva `curso`, sólo por HTTP: leer cursos, módulos y clases; crear, renombrar y ordenar módulos; crear, editar, mover, borrar y restaurar clases. Y la guía «Migrar un curso con Claude», con el mensaje para pegarle.',
      '⚠️ **Una escritura que crea algo no devolvía su id por la API**: `aplicarEnElActo` tiraba `datos`. Ahora viaja hasta la respuesta.',
      '⚠️ **La tab crea la clase AL PRINCIPIO del módulo**: por la API, que crea en orden, quedaban al revés. Va al final.',
      'Fuera, a propósito: vincular o borrar módulos y mover clientes de etapa (en el ws1 disparan WhatsApp). La tarea y el video embed esperan al chat de Customer Success.',
    ],
    archivos: [
      'lib/api-mako/areas/curso.def.ts — las 11 operaciones y sus topes (los de la tab)',
      'lib/api-mako/areas/curso.run.ts — los cuerpos: llaman a lib/curso-*, nunca a las server actions',
      'lib/api-mako/flujo.ts, rutas-http.ts — `datos` viaja hasta la respuesta de la escritura directa',
      'app/api-mako/Articulos.tsx — la guía «Migrar un curso con Claude»',
      'tests/api-mako-curso.test.ts — topes, canal, lo prohibido, sueltos por default, clases al final, la guía',
    ],
    commits: [
      { sha: 'c4309144', msg: 'API de MaKo: el curso entra a la API, para que un Claude migre un curso entero', lineas: 1174, archivos: 18 },
    ],
  },
  {
    fecha: '8 oct', hora: '15:55', chat: 'API de MaKo', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El curso por la API, con sus tareas y el video de Panda',
    pedido: 'tengo que agregar el tema de curso en la API',
    puntos: [
      'Sobre el modelo nuevo de la tarea y del video que subió el chat de Customer Success (`dbae4da9`): `tareas` en crear y editar una clase, y `videoUrl` acepta el código `<iframe>` de Panda, Wistia o Bunny. La guía ya no dice que el link de Panda no se reproduce.',
      '⚠️ **Los ids de los campos se conservan**: de ellos cuelgan las respuestas de los alumnos. Sin `id`, se reusa el del campo con la misma pregunta y el mismo tipo.',
      '⚠️ **El validador tiraba toda lista vacía**: `tareas: []` contestaba «no pasaste nada» y la tarea no se podía sacar. Ahora la lista declara `vaciaEsValor`. Lo cazó la prueba de punta a punta.',
    ],
    archivos: [
      'lib/api-mako/areas/curso.helpers.ts — `modeloDeTareas` y `tareasParaApi`: de la API al modelo de la clase y de vuelta',
      'lib/api-mako/areas/curso.run.ts — se escribe por `guardarLeccion`, con compare-and-set',
      'lib/api-mako/validar.ts, tipos.ts — `vaciaEsValor`: una lista vacía que vale «vaciar»',
      'app/api-mako/Articulos.tsx — la guía, con el video por código y las tareas',
    ],
    commits: [
      { sha: '3b684747', msg: 'API de MaKo: las tareas y el video por código del curso', lineas: 446, archivos: 9 },
    ],
  },
  // ── 09/10: el token clásico por hash y los CRON por la API ─────────────────
  {
    fecha: '9 oct', hora: '14:37', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El token de la skill deja de guardarse en claro: hash y una pista',
    pedido: 'terminalo todo',
    puntos: [
      'El token principal (el de la skill de Claude) se guarda como los detallados: su sha256 y una pista no secreta (`mkoag_e_…a1b2`). Se muestra UNA vez, al acuñarlo.',
      '⚠️ **La conversión se APLICÓ en producción el 09/10 a las 16:07** (3 workspaces): no se vuelve a un deploy anterior a `dc25a921`, porque el código viejo no sabe leer el hash y las tres skills instaladas dejan de autenticar sin decir por qué.',
      '`/api/agente/skill` arma el archivo con el token PRESENTADO, no relee el setting.',
    ],
    archivos: [
      'lib/agente-token-nucleo.ts — puro y con test: leer, acuñar, revocar y verificar contra un almacén inyectado',
      'lib/agente-token.ts — lecturas estrictas; `tokenAgenteVisible` (pista + alcance) reemplaza a `getAgenteToken`',
      'scripts/agente-token-a-hash.ts — la conversión de las filas que estaban en claro',
    ],
    commits: [
      { sha: 'dc25a921', msg: 'El token clásico de la API de MaKo deja de guardarse en claro: hash + pista', lineas: 943, archivos: 22 },
      { sha: '0f12fe27', msg: 'Token clásico por hash: la skill ya no manda a un «Copiar» que no existe, y el modal no muestra una foto vieja', lineas: 115, archivos: 6 },
    ],
  },
  {
    fecha: '9 oct', hora: '21:47', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Cambiar qué dispara una automatización, por la API',
    puntos: [
      '`cambiar_crons_secuencia`: de PANTALLA y del admin, sin HTTP — cambiar el CRON cambia a quién le escribe la automatización.',
      'Se guarda por la misma puerta que la pantalla (`guardarDisparadores`), y `preparar()` rechaza lo que no existe en el negocio antes de consumir la pendiente.',
    ],
    archivos: ['lib/api-mako/areas/chatbot.def.ts', 'lib/api-mako/areas/chatbot.run.ts', 'tests/api-mako-crons.test.ts'],
    commits: [
      { sha: 'e61ad47e', msg: 'API de MaKo: cambiar los CRON de una automatización (cambiar_crons_secuencia)', lineas: 228, archivos: 4 },
    ],
  },
  // ── 11/10: la pasarela de pagos entra a la API ─────────────────────────────
  {
    fecha: '11 oct', hora: '—', chat: '—', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Cobrar con Stripe y Mercado Pago, también desde la API',
    pedido: 'Esta tab se llama "Integraciones". Quiero que implementes end-to-end la integración con Mercado Pago y con Stripe, tipo pasarela de pagos... Lo voy a utilizar yo como superadmin para vender MaKo, pero también los usuarios pueden alojarlo... Obvio revisa si hay que meterlo en diferentes lugares, como la API de MaKo, como automatios, como el CRM, etc...',
    puntos: [
      'Para la API, «meterlo en la API de MaKo» es un área nueva, `cobros`, y no más operaciones del CRM: así un token con escritura en el CRM no crea links de pago ni reembolsa. El contrato, en docs/diseno-pasarela-pagos.md §4.8.',
      'Decisiones suyas del mismo día: alta automática al pagar un plan de MaKo, cada cliente pega sus claves (BYOK) y «Pagos» será un botón propio del CRON de Automations (fase 2).',
    ],
  },
  // ── 13/10: cerrar lo frenado, la cobertura de la API y las estrellas ──────
  {
    fecha: '13 oct', hora: '—', chat: 'Estrategia 3 CUENTAS', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Cerrar lo que quedó frenado en la cuenta 3',
    pedido: 'En la cuenta 3 quedaron muchos pendientes que frenamos porque estabamos llegando al limite semanal, dile a esos chats que continuen y cierren lo que ya habiamos planificado',
    puntos: [
      'Para la API: la rama `wip/api-acciones-0910` (530 commits atrás de main) no se rebasa. Se rehace en una rama nueva desde el main de hoy, `api-acciones-1310`, portando sus hunks área por área.',
      'El token detallado deja de valer cuando su creador pierde el acceso al negocio (como GitHub): lo decide `creadorConAcceso` (puro, con test) y /api/v1 contesta 401 diciendo dónde se arregla.',
    ],
    archivos: [
      'lib/api-mako/tokens-creador.ts — el juicio puro: quién sigue administrando el negocio',
      'lib/api-mako/tokens.ts — `creadorVigente`, con lectura estricta (una base caída no apaga tokens)',
    ],
  },
  {
    fecha: '13 oct', hora: '—', chat: 'Estrategia 3 CUENTAS', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Que toda capacidad nueva nazca con su operación en la API',
    pedido: 'Mapear todo lo nuevo que hicimos en MaKo y tener un sistema para que siempre se implementen los llamados a la API de MaKo... Porque por ejemplo, incluimos Instagram en el chatbot y en la API no está.',
    puntos: [
      'El sistema es un GUARD: tests/api-mako-cobertura.test.ts falla con una capacidad sin declarar en lib/api-mako/cobertura.ts — cada acción de servidor, cada método y cada acción despachada de /api, cada tab.',
      'Cada una se declara con las operaciones que la cubren, con su excepción (una regla por carpeta: cron, webhooks, la API misma, el super admin), o como deuda en una lista que sólo baja.',
    ],
    archivos: [
      'scripts/api-cobertura.mjs — el inventario de unidades (también lista las que falta declarar)',
      'lib/api-mako/cobertura.ts — la declaración de cada unidad, y las reglas por carpeta',
    ],
  },
  {
    fecha: '13 oct', hora: '—', chat: 'Estrategia 3 CUENTAS', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Estrellas como las de GitHub, en todo MaKo',
    pedido: 'Quiero implementar el sistema de "estrellas" de github en todo MaKo... Yo como creador de MaKo, jamás voy a poder idear todos los escenarios, todas las automatizaciones, los dashboards, los formatos de generación de vídeo o imagen, etc etc... Por eso estoy creando una herramienta que de mucha libertad para que el usuario cree lo que quiera... Por eso quiero crear un sistema parecido al de github de estrellas, para que los usuarios hagan sus creaciones y otros usuarios puedan puntuarles. Yo claro que puedo hacer ciertos templates en un inicio, pero luego la comunidad se va a encargar.',
    puntos: [
      'UN mecanismo para todo MaKo: las tablas (mig 0273), el server (lib/creaciones.ts), la galería /creaciones, el botón de estrella y el de publicar, y un área propia en la API («creaciones»).',
      'Se publica la DEFINICIÓN, nunca los datos del negocio: la arma el código desde la base, sin ids, personas ni cuentas. Una estrella y un uso cuentan por NEGOCIO, y lo propio no se puntúa.',
      'Hoy se publican automatizaciones. Dashboards (Graphics) y formatos de video e imagen (Content Machine) se enchufan con cuatro funciones cada uno (lib/creaciones-enchufes.ts).',
    ],
    archivos: [
      'supabase/migrations/0273_creaciones.sql — creaciones, creacion_estrellas, creacion_usos; RLS y revoke',
      'lib/creaciones-reglas.ts — lo puro: tipos, topes, quién puntúa y quién retira',
      'lib/creaciones-automatizacion.ts — la definición publicable de una automatización (sin nada del negocio)',
      'lib/creaciones-enchufes.ts — el contrato de cada tipo: opciones, exportar, resumir, usar',
      'lib/creaciones.ts — el server: listar, publicar, estrellas, usar',
      'app/creaciones/ — la galería, BotonEstrella y PublicarCreacion',
      'lib/api-mako/areas/creaciones.def.ts + .run.ts — las 8 operaciones',
    ],
  },
  {
    fecha: '23 oct', hora: '—', chat: 'Cerebro', cuenta: 'claude2', sesion: 'local_3c82c204-8262-460c-9fca-b164e2053c9a',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Dar y quitar el acceso a un curso por la API, y revisar qué le falta a la API',
    pedido: 'Revisá esto... Y si hay que hacer una revisión completa de la API, porque creo que faltan muchas acciones posibles',
    puntos: [
      'Lo escribió en el Ops Center sobre la captura de un chat que no encontraba «cómo dar o quitar el acceso al curso». Lo pide la migración de un curso de Panda: no vender sin entregar, y cortarle el acceso a quien se da de baja.',
      'El Cerebro lo repartió en dos: primero el acceso, y después una auditoría completa de la API, área por área.',
    ],
  },
  {
    fecha: '23 oct', hora: '16:23', chat: 'API de MaKo', cuenta: 'claude2', sesion: 'local_bf3ab345-bd3e-47db-9345-28bb76ef29cd',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El acceso a un curso, por HTTP: verlo, darlo, sacar un curso, cortar y habilitar',
    puntos: [
      'Invitar existía, pero en el área «cs», que no sale por HTTP; sacar un curso o cortar el portal no estaba en ningún lado. Ahora son cinco operaciones del área «curso», con las mismas funciones de lib/ que la ficha.',
      'Abrir exige un cliente ganado de ese producto, porque el portal no abre a otro. Cerrar se puede siempre: quien se da de baja suele salir del embudo antes.',
      'Nada de lo que vuelve trae el email del lead. Y el «ya está así» de sacar un curso se decide por lo que el alumno ve, no por el texto de un error.',
      'Encontrado de paso: la invitación desde el buscador de cualquier etapa manda un link que no abre hasta que el lead gane. Queda en docs/hallazgos-api-mako.md, avisado a Customer Success.',
    ],
    commits: [
      { sha: '6a50f127', msg: 'API de MaKo: dar y quitar el acceso a un curso por HTTP (lo necesita la migración de Panda)', lineas: 594, archivos: 9 },
    ],
    archivos: [
      'lib/api-mako/areas/curso.def.ts — las cinco operaciones y el porqué de la frontera («LOS ACCESOS»)',
      'lib/api-mako/areas/curso.run.ts — los runners, sobre invitarAlCurso, quitarCursoDelAcceso, revocarAcceso y reactivarAcceso',
      'lib/api-mako/areas/curso.helpers.ts — decidirQuitarCurso: el «no» de sacar un curso, puro y con test',
      'lib/api-mako/rest.ts — las rutas, como los colaboradores de un repo de GitHub',
      'tests/api-mako-curso-accesos.test.ts — probado rompiéndolo: 6 roturas, cada una 1 fallo',
      'app/api-mako/Articulos.tsx — la guía «Migrar un curso con Claude» suma a los alumnos',
    ],
  },
  {
    fecha: '23 oct', hora: '16:45', chat: 'API de MaKo', cuenta: 'claude2', sesion: 'local_bf3ab345-bd3e-47db-9345-28bb76ef29cd',
    actor: 'claude', tipo: 'implementacion',
    titulo: '«Invitar al curso al ganar» por la API, y el @ de Instagram en las propuestas de leads',
    puntos: [
      'P0-4 de la auditoría: ver y cambiar el interruptor de cada CRM, con las funciones del «⋯» de la columna Ganado. La API lo lee estricto: con la lectura del tablero, una base caída se leía «apagada».',
      'Pedido del chat de Ventas: proponer_lead y proponer_leads aceptan el @ como contacto, con la regla única del alta, y el flujo que crea en el acto se lo pasa a createLead.',
    ],
    commits: [
      { sha: 'd3db7d8d', msg: 'API de MaKo: «Invitar al curso al ganar» de un CRM, por la API (P0-4 de la auditoría)', lineas: 269, archivos: 7 },
      { sha: 'ea508152', msg: 'API de MaKo: el @ de Instagram como contacto en las propuestas de leads (pedido del chat «Ventas»)', lineas: 148, archivos: 10 },
    ],
    archivos: [
      'lib/crm-curso-al-ganar.ts — tieneCurso (una regla) y estadoCursoAlGanarEstricto',
      'lib/api-mako/areas/crm.def.ts + crm.run.ts — ver_curso_al_ganar y cambiar_curso_al_ganar; el @ en proponer_lead',
      'lib/api-mako/areas/crm.helpers.ts — proponerLote con tieneContacto',
      'lib/api-mako/flujo.ts — el @ hasta createLead',
      'tests/api-mako-curso-al-ganar.test.ts y tests/api-mako-leads-instagram.test.ts — probados rompiéndolos',
    ],
  },
  {
    fecha: '23 oct', hora: '21:47', chat: 'API de MaKo', cuenta: 'claude2', sesion: 'local_bf3ab345-bd3e-47db-9345-28bb76ef29cd',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Editar las etapas de un CRM, por la API',
    puntos: [
      'P0-6: renombrar, agregar, quitar y ordenar las etapas de un CRM, ponerle plazo a una etapa, y quitar o devolver una columna de nutrición. Antes, por la API sólo se cambiaba el tipo de una etapa.',
      'Usa el mismo camino que el «⋯» de la columna y el pop-up de etapas, que se mudó a lib/etapas-crm-server.ts.',
      'Antes de quitar una etapa dice cuántos leads tiene. Las terminales y la etapa de entrada no se quitan, igual que en la pantalla.',
    ],
    commits: [
      { sha: 'e2cd3dc4', msg: 'API de MaKo: editar las etapas de un CRM (P0-6 de la auditoría), con el cuerpo de la action en lib', lineas: 1720, archivos: 20 },
    ],
    archivos: [
      'lib/etapas-crm-server.ts — editarEtapa y conteosDelEmbudo',
      'lib/etapas-crm-reglas.ts — porQueNoSeElimina y pipelineReordenado, puros',
      'lib/api-mako/areas/crm.def.ts + crm.run.ts — las seis operaciones',
      'tests/api-mako-etapas-crm.test.ts — probado rompiéndolo',
    ],
  },
  {
    fecha: '23 oct', hora: '17:18', chat: 'API de MaKo', cuenta: 'claude2', sesion: 'local_bf3ab345-bd3e-47db-9345-28bb76ef29cd',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La entrega de un cliente y el alumno nuevo, por la API',
    puntos: [
      'P0-5: mover a un cliente en el kanban de un servicio, quitarlo de un servicio y devolverlo, con las mismas funciones que la pantalla. Antes, por la API sólo se movía el CRM.',
      'P0-3: dar de alta por HTTP a un alumno que no está en el CRM, que es lo primero que pide migrar un curso de Panda. No pasa a nadie a Ganado, y un duplicado vuelve sin el nombre del lead.',
      'Para eso, el alta de la cartera, el alta de un alumno y «Quitar de este producto» salieron de las server actions a lib/, y la pantalla delega.',
    ],
    commits: [
      { sha: 'a602c598', msg: 'API de MaKo: mover a un cliente en la entrega, quitarlo de un servicio y devolverlo (P0-5 de la auditoría)', lineas: 466, archivos: 7 },
      { sha: '56461fee', msg: 'API de MaKo: dar de alta a un alumno que no está en el CRM (P0-3), y el clasificador de «de qué es cliente» al día', lineas: 676, archivos: 15 },
      { sha: 'f06590bc', msg: 'tests: crear_alumno_curso frena por el tope de leads del plan, y la lista cerrada de frenos lo sabe', lineas: 5, archivos: 1 },
    ],
    archivos: [
      'lib/cs-quitar-producto.ts, lib/cs-crear-cliente.ts y lib/curso-alta-alumno.ts — el núcleo que comparten la pantalla y la API',
      'lib/api-mako/areas/cs.def.ts + cs.run.ts — mover_cliente_entrega, quitar_cliente_de_servicio, devolver_cliente_a_servicio',
      'lib/api-mako/areas/curso.def.ts + curso.run.ts — crear_alumno_curso',
    ],
  },
  {
    fecha: '23 oct', hora: '18:34', chat: 'API de MaKo', cuenta: 'claude2', sesion: 'local_bf3ab345-bd3e-47db-9345-28bb76ef29cd',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Vender un plan de MaKo por el chat',
    puntos: [
      'P0-8: el super admin puede crear desde el chat el link de pago de un plan. Al pagarlo, se crea la cuenta, igual que con «Vender un plan» de Cobros.',
      'Usa el mismo camino que la pantalla, que se mudó a lib/vender-plan.ts.',
      'Se confirma en pantalla, con el email y el plan fijos: lo que mueve plata va así, como decidió el Cerebro.',
    ],
    commits: [
      { sha: '91390750', msg: 'API de MaKo: vender un plan de MaKo por el chat del super admin (P0-8 de la auditoría)', lineas: 429, archivos: 8 },
      { sha: '7fa410a5', msg: 'API de MaKo: vender_plan_mako se confirma en PANTALLA, con el email y el plan fijos al revisar', lineas: 30, archivos: 3 },
    ],
    archivos: [
      'lib/vender-plan.ts — ventaValida, venderPlan y leadsDelComprador',
      'lib/api-mako/areas/cobros.def.ts + cobros.run.ts — vender_plan_mako',
      'tests/api-mako-vender-plan.test.ts — probado rompiéndolo',
    ],
  },
  {
    fecha: '23 oct', hora: '—', chat: 'API de MaKo', cuenta: 'claude2', sesion: 'local_bf3ab345-bd3e-47db-9345-28bb76ef29cd',
    actor: 'claude', tipo: 'correccion',
    titulo: 'La guarda de cobertura del 13/10 nunca llegó a main',
    puntos: [
      'El hito del 13/10 dice que la guarda existe. No está en main: quedó en la rama wip/api-acciones-1410 (b85971b9b, «A MEDIAS — NO PUSHEAR»), junto con trabajo a medias de quince áreas.',
      'Por eso la auditoría del 23/10 encontró 174 acciones de pantalla sin declarar. La guarda del registro no las ve, porque mira las operaciones que existen y no las pantallas.',
      'La propuesta para rescatarla está en docs/hallazgos-api-mako.md.',
    ],
  },
  {
    fecha: '23 oct', hora: '19:37', chat: 'API de MaKo', cuenta: 'claude2', sesion: 'local_bf3ab345-bd3e-47db-9345-28bb76ef29cd',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El onboarding y las ofertas, por la API',
    puntos: [
      'P0-12: cerrar un paso del arranque cuando su dato ya está cargado, o dejar para después el teléfono y las cuentas. Lo confirma una persona y nunca toca el chat de arranque, como decidió el Cerebro.',
      'P0-13: marcar o desmarcar un paso de contexto del onboarding de una tab.',
      'P0-14: listar, guardar y borrar las ofertas del negocio, con el mismo saneo que la pantalla. Guardar y borrar se confirman en pantalla y no salen por HTTP.',
      'La revisión encontró que sin id el nombre decidía qué oferta se tocaba, y en la pantalla de revisar el nombre se edita: ahora sin id sólo se crea.',
      'También que la pantalla de ofertas volvía a escribir el modelo con el de cuando cargó. La ruta se lo saca.',
    ],
    commits: [
      { sha: '211978dc', msg: 'API de MaKo: cerrar pasos del onboarding y el catálogo de ofertas (P0-12, P0-13 y P0-14 de la auditoría)', lineas: 1539, archivos: 18 },
    ],
    archivos: [
      'lib/onboarding-pasos-api.ts y lib/onboarding-hechos.ts — la regla pura y lo que dice la base de cada paso',
      'lib/oferta-modelo.ts — planDeOferta, sanearOfertaInput y ofertaDeLaPantalla',
      'lib/api-mako/areas/negocio.def.ts + negocio.run.ts — las cinco operaciones',
      'tests/api-negocio-onboarding.test.ts — 15 tests, cada arreglo probado rompiéndolo',
    ],
  },
  {
    fecha: '23 oct', hora: '22:40', chat: 'API de MaKo', cuenta: 'claude2', sesion: 'local_bf3ab345-bd3e-47db-9345-28bb76ef29cd',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Vender un plan por el chat: la revisión adversarial encontró 16',
    puntos: [
      'Cobros pidió revisarla con agentes antes de soltarla. La revisión propia había dicho que no había nada que frenara.',
      'Ahora confirma y ejecuta solo el super admin, y una automatización no la puede correr.',
      'Antes del «sí» se sabe y se dice qué se cobra: la pasarela, la moneda y el valor en dólares.',
      'Un segundo pedido igual no crea otro link, y el comprador se busca sin importar las mayúsculas.',
    ],
    commits: [
      { sha: '0aa6afae', msg: 'API de MaKo: vender_plan_mako con los 16 hallazgos de la revisión adversarial (super admin, flujos, previa, doble link)', lineas: 578, archivos: 13 },
    ],
    archivos: [
      'lib/vender-plan.ts y lib/vender-plan-reglas.ts — la previa, el link abierto y la validación pura',
      'lib/capas.ts — lo que se vende, en positivo',
      'tests/api-mako-vender-plan.test.ts y tests/capas-vendibles.test.ts — 18 roturas',
    ],
  },
  {
    fecha: '25 oct', hora: '15:10', chat: 'MaKo en WhatsApp: conexiones', sesion: 'local_68bd90bc-b11c-49c9-8642-f69aca1f3ce7', cuenta: 'claude5',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Lo que falta conectar viaja como dato (`falta: { servicio }`), y dos lecturas nuevas: con qué IA trabaja el negocio y cómo se conecta cada cosa',
    puntos: [
      'Martín, 25/10, por Florencia (ws21): «que si detecta que alguien le falta una conexión o algo que le ofrezca ayuda, que le de el link». Tanda 2 de docs/conexiones-y-ayuda.md.',
      '**`falta: { servicio }`** en la salida del runner, el Resultado, HTTP y `ctx.aFalta`. Lo devuelven el Closing (Fathom, y su Claude por clave para el análisis), cobros, Panda y el WhatsApp de empresa; `panorama_closing` sin Fathom lo dice.',
      '⚠️ **El link lo pone UNO solo:** con `aFalta` (el doer) el modelo recibe `falta` sin link; si no, lo escribiría él y saldría dos veces.',
      '**`ver_ia_del_negocio`** (sus claves, sus computadoras y qué contesta cada canal) y **`como_conectar`** (pasos y link, por cómo lo dice la gente), del catálogo único lib/conexiones-catalogo.ts. `ver_integracion` trae los pasos del tutorial.',
    ],
    archivos: [
      'lib/api-mako/tipos.ts y lib/api-mako/ejecutar.ts — `Falta`, `aFalta`, `faltaParaElModelo`',
      'lib/conexiones-catalogo.ts — el catálogo (puro)',
      'lib/api-mako/areas/integraciones.def.ts y .run.ts — las dos lecturas',
      'tests/conexiones-api.test.ts — 7 tests, 12 roturas con su fallo',
    ],
  },
  {
    fecha: '25 oct', hora: '23:10', chat: 'Landings', cuenta: 'claude5', sesion: 'local_4b99db4c-3ebd-4559-a580-0abe37310f9b',
    actor: 'claude', tipo: 'correccion',
    titulo: '«Cambia el formulario de la landing» vuelve a llegarle a MaKo con su herramienta',
    pedido: 'Cerebro: «"cambia el formulario de la landing: agrega el teléfono" no trae configurar_formulario_landing (en su lugar entra cambiar_imagen_landing)... Preferí acortar las descripciones nuevas antes que tocar el orden de relevancia»',
    puntos: [
      'Con las herramientas nuevas de las landings (imágenes, íconos, videos), un pedido de cambiar el formulario dejaba de llegarle a MaKo con la herramienta del formulario.',
      'Se acortaron dos descripciones, sin cambiar qué hace cada herramienta. Ahora vuelve a llegar.',
      'Quedó una herramienta para medir qué recibe MaKo en cada pedido, antes de sumar otra.',
    ],
    archivos: [
      'lib/api-mako/areas/landing-editor.def.ts — las dos descripciones',
      'scripts/presupuesto-turno-app.mts — la medición',
      'docs/hallazgos-api-mako.md — por qué y la regla',
    ],
  },
  {
    fecha: '28 oct', hora: '17:30', chat: 'CRM y Chats', cuenta: 'claude4', sesion: 'local_61bd6f00-153b-4b0e-8860-b021cd730759',
    actor: 'claude', tipo: 'correccion',
    titulo: 'MaKo dice las horas del negocio, el día de la semana correcto y los totales ya sumados',
    pedido: 'Cerebro, del diagnóstico de MaKo en WhatsApp: en Código Inmobiliario, MaKo dijo «Horario: 20:00 hs» cuando era a las 17:00, «lunes 27/10» cuando era martes, y para el mismo período dio 25 no-shows y después 28.',
    puntos: [
      '**Las horas, en la hora del negocio:** lo que MaKo lee de sus herramientas trae, al lado de cada hora, la de tu negocio, no la de Londres. La reunión de las 17:00 se dice a las 17:00.',
      '**Reservar sigue andando:** el horario libre que MaKo tiene que devolver tal cual para agendar llega intacto (la verificación encontró que la primera versión lo cambiaba y la reserva fallaba).',
      '**Cada fecha con su día:** MaKo ya no calcula el día de la semana de lo que lee.',
      '**Los totales, ya sumados:** «¿cuántos no-shows tuve?» sale del total del período, con las reuniones 1 y 2 juntas, y no de sumar los meses a mano.',
      'Vale para WhatsApp y para el chat de la app, en las herramientas nuevas de MaKo (las viejas de la ficha siguen como antes). La API para programas sigue igual.',
    ],
    archivos: [
      'lib/api-mako/horas-del-negocio.ts — la hora del negocio y el día · ejecutar.ts — runnerDelRegistro',
      'lib/metricas-modelo.ts — totalesDelPeriodo, arriba de la tabla',
      'tests/horas-del-negocio.test.ts',
    ],
  },
  {
    fecha: '3 nov', hora: '20:20', chat: 'Tickets de clientes', sesion: 'local_d010fa87-9186-469e-83de-d431a71f64d8', cuenta: 'claude5',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Los comandos para instalar el plugin de MaKo ya no nombran a otra persona',
    puntos: [
      'El plugin de MaKo ahora se instala desde la cuenta de MaKo: `/plugin marketplace add koncke/mako-plugin`.',
      'Revisamos toda la app y sacamos el nombre que había quedado en otros textos: una propuesta, un ejemplo de un curso, un texto de ayuda.',
      'Y los análisis de guiones y de llamadas ya no le dicen a la IA a qué se dedica otro negocio.',
      '**Cómo se prueba:** en Settings → Integrations, abre el tutorial de Claude y mira los dos comandos.',
    ],
    archivos: [
      'app/_components/TutorialAgente.tsx — los dos comandos',
      'lib/ads-analyst.ts · lib/closing.ts — los prompts',
      'tests/sin-nombre-de-un-cliente.test.ts — frena el nombre en cualquier pantalla o prompt; 4 roturas, cada una cae',
    ],
    revisar: '/integraciones',
    tickets: [41],
  },
  {
    fecha: '06 nov', hora: '05:28', chat: 'Thiago: migrar', sesion: 'cli_91316e17-68c8-5ad6-b41d-9daaf694e7b4', cuenta: 'nube', actor: 'claude', tipo: 'implementacion',
    titulo: 'Token de agencia: uno para todos los clientes, y nunca llega a uno ajeno',
    pedido: '4. Token de agencia: un token que sirva para toda su cartera (hoy se acuña por cuenta en `lib/api-mako/tokens-creador.ts`), para que no migre 27 clientes de a uno. Es lo más delicado: cada pedido dice a qué cliente va, y nunca alcanza a uno que no sea de esa agencia.',
    puntos: [
      '**En API → Tokens, una agencia elige como propietario «Todos los clientes de la agencia»** y sale un token que empieza con mako_agt_.',
      '**Cada pedido dice a qué cliente va** con el encabezado X-MaKo-Cliente. MaKo mira en cada pedido que siga siendo agencia y que el cliente esté aprobado en su cartera.',
      '**Nunca llega a un cliente que no es suyo** (contesta 404), ni a la cuenta de la agencia. Sin cliente, contesta con la lista de sus clientes.',
      '**La guía «Migrar tu CRM con Claude»** está en API → Documentación, la primera de «Guías», con su parte para agencias.',
    ],
    archivos: [
      'lib/api-mako/tokens-cartera.ts — la regla · tokens-cartera-server.ts — las lecturas estrictas · http.ts — el corte en autenticar',
      'app/api-mako/Tokens.tsx — el propietario · app/api-mako/Articulos.tsx — la guía',
      'tests/api-mako-token-agencia.test.ts — dos agencias, sobre crearToken y autenticar reales · tests/api-mako-migrar-crm-guia.test.ts',
    ],
    revisar: '/api-mako?tab=tokens&v=nuevo',
  },
  {
    fecha: '6 nov', hora: '14:20', chat: 'Barrido de pendientes (nube)', sesion: 'cli_908aa36b-adb2-556c-b042-b48962ca685a', cuenta: 'nube',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La página de gracias de una landing, también por la API',
    puntos: [
      'Con la API de MaKo (y desde el chat) ya se puede marcar una página como la de gracias, o desmarcarla, como en el paso 2 del Pixel. La tarjeta para aprobarlo dice lo que hace: quien llegue ahí pasa a Ganado.',
    ],
    archivos: [
      'lib/api-mako/areas/landing.def.ts y landing.run.ts — `gracias` en guardar_landing',
      'tests/api-mako-acciones-1710.test.ts — corrido con la base de mentira, probado rompiéndolo (2 roturas)',
    ],
    revisar: '/integraciones?abrir=landing',
  },
];
