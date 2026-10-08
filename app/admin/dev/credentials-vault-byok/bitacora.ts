// =============================================================================
// Credentials Vault (BYOK) — el registro de construcción del área
// =============================================================================
// Alcance: la caja fuerte de las llaves de cada cliente. El cifrado AES-GCM con
// dos formatos vivos (gcm1 y gcm2 con HKDF+AAD), la hidratación env↔base en cada
// cold start, el catálogo que decide QUÉ claves se pueden guardar, y el
// alta/borrado/prueba por campo desde /integraciones y /metodo.
// Vive en: lib/credenciales.ts, lib/cripto-credenciales.ts, lib/ia-keys*.ts,
// lib/metodo-catalogo.ts, app/api/integraciones/credencial/, instrumentation.ts.
//
// De dónde salió esto: los mensajes de commit de agosto sobre esas rutas (fecha,
// hora, sha y tamaño salen de `git log`, no del recuerdo); las trampas y lo que
// quedó sin hacer, de docs/hallazgos-seguridad.md §«Credenciales y cifrado»,
// docs/hallazgos-ia.md y docs/migracion-cifrado-credenciales.md; el índice de
// sesiones, de docs/chats.md. La cuenta sale del trailer `Claude-Cuenta:`.
//
// NO es un changelog. Lo que git ya guarda no se repite acá: va el motivo, la
// trampa, y sobre todo cuándo el diagnóstico obvio era el equivocado.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'El vault por workspace', detalle: 'La credencial se guarda cifrada en la fila del cliente, no en una env de Vercel · cinco caminos de guardado que terminan todos en guardarCredencial()', estado: 'hecha' },
  { titulo: 'Varias cuentas del mismo proveedor', detalle: 'Hasta 10 claves derivadas (_2, _3…) sin migración: para la tabla son filas más · el email de cada cuenta se escribe a mano porque ningún proveedor lo dice', estado: 'hecha' },
  { titulo: 'El guard de la key de plataforma', detalle: 'BYOK_NUNCA_PLATAFORMA en el choke point, en positivo y por clave · pegar la key de la agencia como propia abría los datos de otro workspace', estado: 'hecha' },
  { titulo: 'Cifrado v2 (HKDF + AAD)', detalle: 'gcm2 ata el criptograma a (workspace, clave) y saca AUTH_COOKIE_VALUE de la cascada · el código está, faltan los pasos de Vercel EN ORDEN', estado: 'sigue' },
  { titulo: 'La hidratación env ↔ base', detalle: 'No filtra por catálogo: una fila vieja del dueño vuelve a pisar process.env en el próximo boot, y el síntoma aparece lejos de la causa', estado: 'sigue' },
  { titulo: 'Decir que es BYOK donde se pide la key', detalle: 'Falta la aclaración de que la credencial es del cliente y qué la protege · si el texto tuviera que admitir que la agencia puede leerla, se cambia el mecanismo, no el texto', estado: 'cola' },
  { titulo: 'El super admin no puede ver una credencial propia', detalle: '«Solo el admin de este espacio puede ver una credencial» sobre una que es suya · sospechoso: un guard del eje workspace donde va getSesionAdmin()', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '12 ago', hora: '18:16', chat: 'Customer Success', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Una key por proveedor: la única salida que ofrecía era volver a pegar la que ya estaba agotada',
    puntos: [
      'El vault sabía guardar **una** key por proveedor, y el free tier se agota **por cuenta**, no por proveedor. A alguien sin cuota la app le mostraba el mismo formulario de siempre — o sea, le pedía re-pegar exactamente la key muerta. Entran hasta tres cuentas por **claves derivadas** (`GEMINI_API_KEY` / `_2` / `_3`): para la tabla `credenciales` son filas más, con el mismo cifrado y la misma auditoría, así que **no hubo migración**. Ese es el truco que hace barato sumar cuentas después.',
      '⚠️ **Una credencial que pasa la prueba y no es la que se guardó.** `verificarServicio` probaba la key VIEJA al pegar la segunda y la pintaba de verde. Cuando un campo deja de ser único, todo lo que lo lee «por proveedor» —la verificación, el tope del gauge, el estado del panel— pasa a estar mirando el slot equivocado sin decirlo.',
      'El corolario que sale de la misma medición y que gobierna al vault entero: **un total solo se puede sumar si el recurso se puede mover de lugar.** Tres cuentas de Gemini no son un tanque de 750k, son tres de 250k que no se trasvasan; el tope diario del gauge se multiplica por cuentas conectadas, pero el estado sale del PEOR componente.',
      '`lib/ia-keys.ts` nació **sin `server-only`** a propósito, igual que `lib/cripto-credenciales.ts`: la lógica que decide qué claves existen tiene que poder correrse en un test sin levantar la app.',
    ],
    commits: [
      { sha: 'bee24ad4', msg: 'IA: rotar tambien entre CUENTAS del mismo proveedor, y cerrar los caminos sin cascada', lineas: 805, archivos: 20 },
    ],
  },

  {
    fecha: '13 ago', hora: '17:44', chat: 'Integraciones', cuenta: 'claude2',
    actor: 'claude', tipo: 'cosecha',
    titulo: 'El preflight de credencial: un workspace sin fila propia se reintenta para siempre',
    puntos: [
      'Como el `.env` es **solo del dueño**, un workspace sin fila propia hace fallar cada llamada; la fila queda en `error`, que es un estado **reintentable**, y el cron la vuelve a levantar en la corrida siguiente. En loop, sin techo y sin que nadie se entere.',
      '**Por qué no se había visto nunca:** el cron servía siempre a los mismos dos workspaces —los primeros de la iteración— y los dos tienen key. El bug estaba en la parte de la lista a la que nunca se llegaba. La regla que queda: antes de trabajar por N inquilinos, preguntá si ESE inquilino tiene credencial propia, y si no la tiene **declaralo**; sin credencial el trabajo no se reintenta, se salta y se dice.',
      'Y el aviso al dueño no se pudo emitir por una razón que vale para cualquier alerta de este frente: `notificaciones` no tiene `workspace_id` y el feed es global, así que avisar ahí le mostraría los conteos de un cliente a todos los clientes. **Resolver la visibilidad creando una fuga entre inquilinos no es un arreglo.**',
    ],
    commits: [
      { sha: '76c34eae', msg: 'Cosecha: las reglas del cron multi-workspace y el preflight de credencial', lineas: 83, archivos: 1 },
    ],
  },

  {
    fecha: '13 ago', hora: '21:37', chat: 'Integraciones', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El tope pasa a 10, y queda escrito en el código por qué NO se puede sacar del todo',
    puntos: [
      'El pedido del dueño era sacar el límite de 3 cuentas, poner un botón para agregar y saber a qué email pertenece cada key. El contexto que lo justifica está medido: el free tier de Gemini son 250k tokens/día **por cuenta** y el ws1 consume ~860k, o sea **86 a 110 cortes por día** contados en la base.',
      '⛔ **El tope no es cosmético: la cadena `MAX_KEYS → clavesDe → CLAVES_EXTRA → ENVS_METODO` ES la whitelist** de qué claves se pueden guardar. Reemplazarla por un patrón `/_API_KEY(_\\d+)?$/` «para que no tenga tope» abre un agujero grave: `guardarCredencial` termina en `process.env[clave] = valor` para el dueño y `cfgDe()` relee `CHEAP_BASE_URL` en **cada** llamada — una clave de más aceptada es todo el tráfico de IA de todos los inquilinos saliendo a otro host con los Bearer adentro. Subir de 3 a 10 fue **una línea**; sacar el tope es otra cosa.',
      '**El precio de subir el tope hay que pagarlo en la misma pasada.** `provsDe` y `cuentasDe` resolvían las cuentas con un `credWs` **por slot**: con 10 son 10 SELECT por proveedor (hasta 50 por generación y otros 50 en cada pintada del gauge), casi todos para descubrir que la key no existe. Nace `lib/ia-keys-ws.ts` con UNA query por workspace cacheada **por request** con `cache()` de react — ⚠️ **nunca `unstable_cache`**, que es cross-request: cachear qué credenciales tiene cada inquilino es una fuga esperando a pasar.',
      'El email de cada cuenta es **manual, y no por vagancia**: se verificó en los cinco proveedores y **ninguno** expone el dueño de una key. Gemini lo dice por escrito («Standard keys don\'t identify a caller») porque la key cuelga de un PROYECTO, no de una persona. Prometer un autocompletado que no existe era peor que pedir que se escriba una vez.',
      '⚠️ **El gotcha que lo habría dejado inútil: no todo lo que vive en el vault es secreto.** El form pintaba `••••{mask}` en cuanto la credencial estaba guardada, **sin mirar `c.secreto`** — un rótulo de email se habría visto como «••••.com», exactamente lo contrario de para lo que existe. Un campo nuevo del catálogo hereda el tratamiento de secreto por default, así que hay que declararlo.',
      'Y el diagnóstico obvio equivocado, chico pero caro: **el botón «Agregar otra cuenta» YA EXISTÍA** (`ServicioConfigForm:785`). El pedido no era crearlo, era que no se quedara sin campos en la tercera.',
    ],
    commits: [
      { sha: '85a020b8', msg: 'Cuentas de IA: el tope pasa a 10 y cada key dice de que email es', lineas: 190, archivos: 8 },
    ],
    archivos: [
      'lib/ia-keys.ts — MAX_KEYS y las claves derivadas; es la whitelist, no un número de UI',
      'lib/ia-keys-ws.ts — UNA query por workspace, cacheada por REQUEST (cache() de react)',
      'lib/credenciales.ts — estadoCampo: devuelve el valor entero para lo que no es secreto',
    ],
  },

  {
    fecha: '13 ago', hora: '21:42', chat: 'Integraciones', cuenta: 'claude2',
    actor: 'claude', tipo: 'cosecha',
    titulo: 'La alarma con fecha que no aplicaba: las 9 keys de Gemini ya eran del formato nuevo',
    puntos: [
      'La cosecha del 13 dejó escrito, **con fecha**, que la doc oficial dice textual «On September 2026: the Gemini API will reject requests from Standard keys». Importaba de verdad: Gemini sostiene casi toda la IA gratis de MaKo, así que el síntoma no habría sido una factura alta — habría sido que **las reuniones dejan de dejar tareas, en todos los workspaces a la vez**.',
      'Tres horas después se verificó **descifrando cada fila y mirando solo el prefijo**: las 9 keys cargadas (ws1, ws3, ws9 ×3, ws10, ws11 ×3) empiezan con `AQ.A` y miden 53 caracteres, que es el formato AUTH. Las Standard que Google va a rechazar son `AIza` de 39. **No había nada que migrar.**',
      '**Una alarma que no aplica es peor que ninguna**: nace sonando, y una alarma que suena siempre se silencia. Habría costado una tarde de migrar keys ya migradas. La entrada se corrigió en vez de borrarse —el veredicto arriba y el chequeo del prefijo abajo— porque la trampa sigue viva para una key que salga de un backup, de un `.env` de otro proyecto o de una cuenta anterior a 2026.',
      'La regla de fondo, que vale para cualquier proveedor del vault: **antes de apoyar una feature en el free tier de alguien, buscá su página de DEPRECACIONES, no la de precios.** Un free tier no se rompe subiendo el precio — se rompe cambiando el **formato de la credencial**.',
      '⚠️ Quedó sin hacer: el curl que distingue en 10 segundos «es cuota» (429) de «la key está bloqueada» (400/403). Hoy los dos caen en el mismo `console.warn`, o sea que se ven iguales desde afuera.',
    ],
    commits: [
      { sha: 'a5957fe1', msg: 'Cosecha: Google corta las keys Standard de Gemini en septiembre', lineas: 99, archivos: 1 },
      { sha: 'ecd65622', msg: 'Lo de las keys de Gemini NO aplica: las 9 ya son auth', lineas: 21, archivos: 1 },
    ],
  },

  {
    fecha: '15 ago', hora: '10:35', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Clarity entra al vault: dos credenciales del cliente, y solo una es secreta',
    puntos: [
      '**BYOK de verdad con dos campos, y por razones distintas.** `CLARITY_PROJECT_ID` **no** es secreto —viaja en el HTML como cualquier pixel, y enmascararlo escondería lo único que distingue un proyecto de otro— pero sí es de la cuenta del cliente; `CLARITY_API_TOKEN` sí lo es, porque da lectura a las métricas. Los dos por `credWs`, cifrados y por workspace: si vivieran en una env de plataforma, **todos** los clientes escribirían en el proyecto del dueño y ninguno vería el suyo. Hay test que lo prohíbe.',
      '⚠️ **El botón no hacía nada porque son DOS catálogos.** Clarity estaba en el catálogo de integraciones (marcado `oculto`, porque no lleva tarjeta propia) y **no** en `lib/metodo-catalogo.ts`, que es de donde la barra de credenciales saca sus campos y sus pasos: contestaba «servicio inválido». Las preguntas son distintas —«¿qué tarjetas existen?» y «¿qué campos pide este servicio?»— y **una integración que se configura DENTRO de otra necesita estar en los dos**. Es el caso que nadie había tenido antes; ahora hay test que lo exige.',
      '**Verificar una cosa y guardar otra es cómo se llega a una credencial que pasó la prueba y no funciona.** El ID se acepta pegando la dirección entera del panel —que es donde todo el mundo lo tiene a mano, no en Settings → Overview— pero se guarda **normalizado**, y se normaliza también al LEER, por los valores cargados antes de que esto existiera.',
      'La pregunta «si tenemos el token, ¿para qué pedir el ID?» se contestó midiendo, no opinando: el `sub` del JWT es `3460892749304374` y el proyecto en base36 da `3461152837449423` — mismo espacio de numeración, identificadores distintos (el `sub` es de la CUENTA). Los dos números quedaron en un comentario y en un test para que nadie gaste otra media hora en reintentarlo. Y la razón de fondo: **el ID no es un dato de la API**, es lo que va en el `<script>` de la página del cliente.',
    ],
    commits: [
      { sha: 'd89d2538', msg: 'clarity: integración BYOK, dentro del mismo Pixel, con el link por lead', lineas: 299, archivos: 9 },
      { sha: '8c2203f5', msg: 'clarity: «servicio inválido» — faltaba en el SEGUNDO catálogo. Y el copy, a neutro', lineas: 59, archivos: 4 },
      { sha: '3f6b1227', msg: 'clarity: el ID no sale del token (medido), pero se acepta pegar la URL del panel', lineas: 89, archivos: 4 },
    ],
    archivos: [
      'lib/metodo-catalogo.ts — «¿qué campos pide este servicio?» · el `env` tiene que coincidir EXACTO con lo que lee la lib, si no credWs devuelve null en silencio',
      'lib/integraciones-catalogo.ts — «¿qué tarjetas existen?» · una integración anidada va en los dos',
    ],
  },

  {
    fecha: '15 ago', hora: '10:44', chat: 'Colapsar las URLs de preview de Lovable', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El guard BYOK vivía en UNA action, y hay cinco caminos de guardado',
    puntos: [
      '«La key de la plataforma pegada como propia se rechaza» estaba bien escrito en el server (`guardarZernioKeyAction`) — y era **bypasseable igual**, porque `ZERNIO_API_KEY` también se guarda por la card de /integraciones, por /metodo, por el onboarding y por el copiador de datos-mau. **Cerrar cuatro caminos deja el quinto**: es la misma regla que puso el veto de Claude en el `fetch` y no en el registro de modelos.',
      'El impacto no era cosmético. En `lib/zernio.ts`, `byok: true` **saltea el aislamiento por profile** y resuelve el Default de la cuenta, así que un cliente con la key de la agencia veía las conversaciones del profile Default de la **plataforma**. Un guard mal ubicado acá no da un error: da los datos de otro.',
      'El control quedó en el choke point por el que pasan todos: `guardarCredencial()` tira `KeyDePlataformaError` si un ws ≠ dueño guarda una clave del set `BYOK_NUNCA_PLATAFORMA` con el valor exacto de la plataforma. Está **en positivo y por clave**: si aparece otra credencial con semántica «key propia = modo distinto», va al set, no a su UI.',
      'Gemelo del mismo commit y de la misma familia: las claves de **plataforma pura** quedaron excluidas de `migrarEnvACredenciales`. La cuenta de Zernio es de MaKo, no del ws1 — migrada al ws1 quedaba **disfrazada de conexión BYOK de Mauricio**, que es exactamente el modo de falla de «`OWNER_WS` no es la plataforma».',
      '⚠️ **Sigue vivo, y es el hermano de esto:** `hidratarCredenciales` **no filtra por catálogo**, así que cualquier fila vieja del dueño vuelve a pisar `process.env` en cada boot. Ya se cobró el login de la plataforma con dos filas zombie de `GOOGLE_CLIENT_ID/SECRET` que ninguna UI mostraba. Y la trampa hermana: **un backup anterior al 2026-07-16 tiene credenciales gcm1 que ya NO abren** —se eliminó esa rama del cifrado—, así que restaurarlo no devuelve las integraciones (docs/hallazgos-seguridad.md).',
    ],
    commits: [
      { sha: 'a3d0ffb0', msg: 'Content Machine IG (Reels/Carousels/Stories) + onboarding Zernio-first', lineas: 3613, archivos: 29 },
    ],
    archivos: [
      'lib/credenciales.ts — `BYOK_NUNCA_PLATAFORMA`, `KeyDePlataformaError`, y el comentario que explica por qué el guard va acá y no en cada UI',
      'app/api/integraciones/credencial/route.ts — lo audita (`permitido:false`) y contesta 409; los demás caminos lo surfean por sus catch',
      '⚠️ instrumentation.ts — `register()` NO se espera antes del primer request en Vercel: se lee por `envCred()` / `credencialesListas()`, nunca directo de `process.env`',
    ],
  },

  // ── 8 de octubre: «si me hackean MaKo, me hackean a mí» ──────────────────────
  {
    fecha: '8 oct', hora: '13:22', chat: 'Customer Success', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'La seguridad de lo que un cliente conecta, del audio del 08/10',
    pedido: 'lo siento súper increíble, pero yo acá voy a conectar el Stripe y voy a conectar básicamente toda la base de datos de cliente, facturación, todo. A mí me gustaría que se pueda ver el tema de seguridad lo máximo posible, porque si ya me hackean MaKo, entiendo que me hackean a mí también, entonces es súper importante este tema de seguridad',
    puntos: [
      'Lo dice alguien que probó MaKo y tiene su propio infoproducto, en el audio de 26 minutos que Martín mandó el 08/10 (`docs/feedback-curso-08oct.md`, 07:30). Martín pidió pasarle a cada chat lo suyo, y la sesión de Customer Success lo mandó acá: medir qué protege cada credencial y que la pantalla lo diga.',
    ],
  },
  {
    fecha: '8 oct', hora: '13:22', chat: 'Integraciones', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'Las cinco promesas del aviso se cumplen; Stripe no existe y hay dos agujeros fuera de las llaves',
    puntos: [
      '⚠️ **El diagnóstico obvio no tenía objeto: MaKo no tiene integración con Stripe.** Lo que el que probaba teme conectar todavía no se puede conectar; lo que se midió es lo que hoy SÍ se conecta.',
      '**Medido en producción, en sólo lectura:** las 146 credenciales están cifradas (gcm2), el secreto que las abre está en producción y es la única fuente (la cadena de respaldos de julio se fue), la pantalla recibe 4 caracteres, el ojito queda registrado en la base y sólo lo usa el admin del espacio. El aviso «Tus llaves son seguras» de `/integraciones` dice exactamente eso: no se tocó.',
      '⚠️ **Lo que no está a la altura no son las llaves.** (1) Dos vistas de cohortes devuelven la facturación por semana de TODOS los clientes a la clave pública de Supabase, que viaja al navegador; el arreglo son dos líneas, pero el guard ya lo dejó como decisión de Martín. (2) El token de la API de MaKo se guarda en claro; pasarlo a hash como los tokens con nombre cambia producto.',
      '**Para cuando se construya Stripe:** clave restringida de sólo lectura (`rk_live_…`), nunca la secreta. Entra sola al cifrado y al aviso.',
    ],
    archivos: [
      'docs/hallazgos-seguridad.md — «Si me hackean MaKo, me hackean a mí»: la tabla de lo medido y las dos decisiones',
      'app/integraciones/ServicioConfigForm.tsx — `AvisoSeguridad`, verificado línea por línea',
    ],
  },
];
