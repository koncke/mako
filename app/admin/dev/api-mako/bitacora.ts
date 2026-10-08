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
  { titulo: 'Un token se apaga cuando su creador pierde el acceso', detalle: 'Como en GitHub: hoy `creadoPor` no se vuelve a mirar y un admin que sacan del workspace se lleva tokens que andan · va en `resolverTokenApi`', estado: 'cola' },
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
];
