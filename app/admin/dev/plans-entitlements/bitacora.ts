// =============================================================================
// Plans & Entitlements — el registro de construcción del área
// =============================================================================
// Alcance: qué puede hacer cada cliente y por qué. Hoy eso NO lo decide un plan:
// lo decide la CAPA del workspace (lib/capas.ts, mig 0092), hardcodeada en tres
// valores, más el corte por rol y por tab. Free / Pro / Growth están diseñados y
// escritos, y no hay una sola fila de suscripción en la base.
//
// Vive en: lib/capas.ts, lib/tab-access.ts, app/admin/AdminView.tsx y todo el
// camino del alta de una persona (lib/usuarios.ts, lib/invitaciones.ts,
// lib/invitacion-aviso.ts, /equipo) — que es lo único que hoy existe entre el
// pago y el primer login.
//
// De dónde salió esto: los mensajes de commit de agosto de 2026, que en este
// repo explican el POR QUÉ; docs/costos-ia-y-planes.md para el diseño de los
// planes; y docs/chats.md para el nombre de las sesiones, que llega hasta el 8
// de agosto — de ahí en adelante el `chat` es el título corto de la tanda.
//
// NO es un changelog. Va el motivo, la trampa, y lo que quedó SIN hacer con el
// archivo donde vive.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'Las capas, que hacen de entitlement sin saberlo', detalle: 'lib/capas.ts decide los pasos del onboarding, las tabs y hasta qué categorías de integración se ven. Tres valores hardcodeados, cero noción de plan', estado: 'hecha' },
  { titulo: 'El corte lo hace el server', detalle: 'requireCapa / requireRolWs / guardTab: la UI solo pinta lo que el server contesta, y esconder el botón no protege nada', estado: 'hecha' },
  { titulo: 'El diseño de los planes', detalle: 'DOS planes y no tres · el Free no conecta NADA con webhook ni cron · anual 16,7% / 8,3% · Paddle como merchant of record', estado: 'hecha' },
  { titulo: 'Entre el pago y el primer login', detalle: 'El alta de una persona ya avisa por mail, con remitente de plataforma. Falta el alta de WORKSPACE y un envío real que pruebe DNS', estado: 'sigue' },
  { titulo: 'Estado de suscripción por workspace', detalle: 'No existe: ni plan, ni trial, ni fecha de corte, ni dunning. PermissionState ya tiene el motivo «plan» y no hay a dónde mandar a contratar', estado: 'cola' },
  { titulo: 'Qué pasa cuando se acaba el cupo', detalle: 'Frenar y ofrecer — nunca degradar la calidad en silencio ni cobrar sin avisar. MaKo Tokens solo para medios; el texto va con uso justo', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── agosto: el diseño ──────────────────────────────────────────────────────
  {
    fecha: '9 ago', hora: '00:36', chat: 'Cobros y planes · análisis de costos', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'Lo que hay que copiar de la competencia no es el precio: es qué pasa cuando se acaba',
    puntos: [
      'El molde es HubSpot, y no por su tabla de precios: **da a ELEGIR el comportamiento del cupo agotado** —pausar (default para cuentas nuevas), auto-upgrade, o pay-as-you-go— y publica cuántas acciones reales entran en cada plan. La regla que sale de ahí y gobierna todo lo que se construya después: **el cupo agotado no puede degradar la calidad en silencio ni cobrar sin avisar. Frena y ofrece.**',
      'Es el mismo modo de falla que este repo ya tiene escrito para la cascada de modelos: un fallback que no cobra es una **degradación silenciosa**, y no deja ni siquiera el rastro que deja la factura.',
      'La granularidad no es un detalle estético: el crédito de HubSpot vale US$0,01 y el MaKo Token US$0,001, **diez veces más fino**, que es lo que hace falta para poder cotizar acciones de centavos sin redondear todo hacia arriba.',
      '**BYOK deja de ser el default y pasa a ser el perk del plan anual** (#312), y el punto de equilibrio está medido: recién compensa arriba de ~200 salidas de IA por mes, y debajo de 50 gana el cupo administrado. En el Free solo agregaría fricción sin ahorrar nada.',
    ],
    commits: [{ sha: 'bbeb040b', msg: 'Competencia: lo que hay que copiar no es el precio, es qué pasa cuando se acaba', lineas: 47, archivos: 2 }],
  },
  {
    fecha: '9 ago', hora: '09:42', chat: 'Cobros y planes · análisis de costos', cuenta: 'claude2',
    actor: 'claude', tipo: 'cosecha',
    titulo: 'El diseño real de los planes: son DOS, y el eje que los separa cabe en una línea',
    puntos: [
      '**Se venden DOS planes, no tres.** El gancho del Growth —Image y Video Generator— son `ComingSoon` verificados en el repo, y **un tercer plan vacío no es un ancla de precio: es un reembolso**.',
      '**El eje que separa los planes, en una línea: el Free no conecta NINGUNA integración con webhook ni cron.** Free = la IA corre cuando apretás un botón; Pro = corre mientras dormís. No es una lista de features arbitraria — se corresponde con la curva de costo, que es lo que hace que el límite se pueda sostener.',
      '**El descuento anual es 16,7% en Pro y 8,3% en Growth, y el 20% es cartel, no práctica**: respond.io muestra «Save up to 20%» y sus anuales son 12× el mensual clavado. El Growth descuenta la mitad porque **el mismo % de precio se come distinto % de margen**.',
      'Paddle como merchant of record, y lo del CFDI era un falso problema: la regla 12.1.4 RMF permite el PDF con IVA desglosado, y Paddle **está** en el padrón del SAT (RFC PML120808ITA). Stripe y Lemon Squeezy no.',
      '**El Pro sobrevive por producto (91,8% de margen sobre IA) y NO por carrito**: el techo de CAC sobre neto es US$49-97 y el carrito mide US$76-179. La conclusión no es tocar el precio, es arreglar el carrito.',
      '⚠️ **Corrección de hecho que arrastraba a todos los cálculos:** los clientes reales son **TRES** (ws1 Mauricio, ws10 Leandro, ws11 Leila), no cuatro. La lista que circulaba incluía el workspace de prueba y al propio dueño, y dejaba afuera al ws1 — que es un cliente real y el único mezclado en el medidor de Claude.',
      '⚠️ **Y los dos huecos bloqueantes que nadie había visto, los dos anteriores al primer cobro: no existe alta de usuario ni de workspace** (no hay nada entre el pago y el primer login) **y no existe ninguna página legal**, que es un gate del merchant of record ANTES de cobrar. El primero se cerró a medias el 16 de agosto; el segundo sigue abierto (área `legal-compliance`).',
    ],
    commits: [{ sha: '56cf3f94', msg: 'docs: cosecha del paso 4 — el diseño real de los planes', lineas: 251, archivos: 1 }],
    archivos: ['docs/costos-ia-y-planes.md — el diseño completo de los planes, con el orden de trabajo y los seis huecos'],
  },

  // ── agosto: la capa como whitelist ─────────────────────────────────────────
  {
    fecha: '11 ago', hora: '15:20', chat: 'Productos X Funnels', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Una integración que existe, pasa todos los filtros y no se pinta',
    puntos: [
      '⚠️ **El modo de falla propio de un sistema de permisos: no hay error, hay ausencia.** La integración de Whop existía, tenía sus credenciales y pasaba todos los filtros, y **no se dibujaba** — porque `CAT_ORDER` hace de **whitelist** y se le había puesto una categoría nueva («Contenido») que no estaba en la lista. Textualmente el mismo bug que había dejado a GitHub invisible, con el comentario que lo cuenta tres líneas más arriba.',
      '**Y hay DOS listas, no una:** además de `CAT_ORDER` hay que sumarla a `capas.ts → categoriasIntegraciones`, o el super-admin tampoco la ve. Una capa que no menciona una categoría no dice «prohibido»: dice «no existe», y desde afuera las dos cosas se ven idénticas. Es la razón por la que este archivo llama a las capas «entitlement sin saberlo».',
      'Del mismo mapeo salió el gemelo del lado de la verificación: «Probar conexión» decía «servicio inválido» porque faltaba `PINGS.whop` — o sea, tres catálogos paralelos (categorías, capas, verificadores) que hay que tocar juntos y que ninguno de los tres avisa cuando falta.',
      'Y el criterio de qué muestra un ping: el **nombre del negocio**, que es lo único que delata al toque haber pegado la key de otra cuenta. Una key válida sobre una cuenta vacía es el estado más confuso de todos.',
    ],
    commits: [{ sha: '7d0080de', msg: 'La firma de Whop la tenía mal, y la integración estaba invisible', lineas: 832, archivos: 17 }],
    archivos: ['lib/capas.ts — `categoriasIntegraciones`: la segunda lista, la que nadie recuerda'],
  },

  // ── agosto: el corte y su salida ───────────────────────────────────────────
  {
    fecha: '11 ago', hora: '18:53', chat: 'Productos X Funnels', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Los tres motivos por los que no podés entrar, y qué se hace con cada uno',
    puntos: [
      'El estado de «no podés ver esto» se llevó **al catálogo** (`app/_ui/Estados.tsx`) en vez de resolverse en la pantalla que lo necesitaba, y ahí quedó explícita la distinción que faltaba: los tres motivos se distinguen **por dónde se resuelve cada uno** — `rol` → pedir acceso, `plan` → contratar, `ajeno` → no se resuelve, es de otra cuenta.',
      '⚠️ **Y ahí está el hueco del área, escrito en la propia UI:** el motivo `plan` existe y **no hay ningún plan que contratar**. Hoy nada lo emite, porque no hay estado de suscripción por workspace; el día que exista, el botón ya está pensado. Mientras tanto, un motivo que nadie dispara y un motivo que nadie ve se parecen demasiado.',
      'El criterio que vale para cualquier pantalla de permiso: **el texto no dice de quién es el recurso**. Probando ids, un error que nombra al dueño reconstruye la cartera de clientes ajena.',
    ],
    commits: [{ sha: 'bd366a46', msg: 'Un lead de otra cuenta no es un 404: dice qué pasó, y al super admin lo lleva', lineas: 110, archivos: 3 }],
    archivos: ['app/_ui/Estados.tsx — `PermissionState`, con los motivos rol / plan / ajeno'],
  },
  {
    fecha: '16 ago', hora: '10:47', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El guard que rebota por capa y por rol se llevaba puesta la pestaña del cliente',
    puntos: [
      '**El síntoma no se parece a un bug: es una cuenta distinta.** El dueño reseteó el Cliente de Prueba, al volver a abrirlo cayó en `/onboarding` sin barra de agencia, con la sidebar de admin y su foto, y **sin ninguna forma de volver a entrar**. Lo reportó como «algo está pasando».',
      'La causa: `guardOnboarding()` hacía `redirect(\'/onboarding\')` con la ruta pelada y ahí se perdía el `?ws=`. **El guard compartido es el que más pega** — `requireRolWs` y `requireCapa` rebotan por rol y por capa, así que ese redirect se dispara **desde cualquier pantalla**. Son los tres primeros de los 26 que se arreglaron.',
      '⚠️ **Ninguno de los commits de ese día lo causó.** El bug era viejo y solo se puede ver cuando el workspace que se está mirando tiene el onboarding sin terminar; antes del reset ese workspace estaba en `done`, así que el guard nunca se disparaba. **Lo que cambió no fue el código, fue el DATO** — y el diagnóstico obvio («el commit de hace media hora rompió algo») era el equivocado.',
      'Lo que queda como regla: `rutaConWs` (lib/workspace.ts) para todo redirect del server, con la única excepción de `/login` —sin sesión no hay pestaña que preservar, y arrastrar el id a una URL que se comparte sola sería contar a quién se estaba mirando—. **Ponerlo de más no cuesta nada**: devuelve el href intacto cuando no hay pestaña.',
      'Y el corolario que se pagó al día siguiente: **contar tres formas de navegar fue el error**. Cerrados los 26 `redirect()`, quedó viva la cuarta (`window.location.href`) justo en `PanelAgencia`, el panel que SOLO se dibuja mientras mirás a otro cliente.',
    ],
    commits: [{ sha: '897ce26e', msg: 'Un redirect es navegación: los 26 que perdían el ?ws= de la pestaña', lineas: 169, archivos: 26 }],
    archivos: ['lib/tab-access.ts · lib/ws-tab.ts — qué cliente mira esta pestaña y qué tabs le corresponden'],
  },

  // ── agosto: entre el pago y el primer login ────────────────────────────────
  {
    fecha: '16 ago', hora: '18:44', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Dar de alta a alguien no le avisaba a nadie: el primer hueco entre el pago y el login',
    puntos: [
      '**Los TRES puntos que crean personas** —el cliente nuevo, el usuario suelto de /admin y el equipo que suma el propio cliente— llamaban a `crearUsuario()` y ahí terminaban. La fila en `usuarios` **ES** la invitación (el callback de Google la busca y la activa sola), así que todo funcionaba exactamente como estaba escrito: lo que faltaba era el mensaje. En /equipo la acción se llama literal `invitar` y no invitaba a nadie.',
      '⚠️ **Y la pantalla afirmaba que sí**: «Cliente creado. Cuando su admin entre con Google usando ese email, la cuenta se activa sola». Cierto palabra por palabra y **falso como mensaje** — daba por hecho que iba a entrar solo a una URL que nadie le pasó. La regla: cuando un proceso tiene un paso humano en el medio, el estado sale del paso que **falta**, no del que se cumplió.',
      '⚠️ **El hallazgo caro, que no daba ningún síntoma porque funciona de casualidad:** el mail salía con `runWithWorkspace(OWNER_WS, …)` y el remitente de la PLATAFORMA terminaba saliendo de la config de **un cliente** — `OWNER_WS` vale 1 y el 1 es Mauricio. Hoy da bien porque su `resend_from` dice «MaKo <equipo@hola-mako.com>»; el día que lo cambie a su negocio, **todos los clientes nuevos reciben su acceso firmado por otro cliente**. Ahora hay constante `REMITENTE_MAKO`, `from` explícito y el envío en `wsSuperAdmin()`.',
      '`invitacion_enviada_at` (mig 0138) **no es lo mismo** que `estado=\'invitado\'`, que solo dice «nunca entró»: no separa «le llegó y no entró» de «nunca supo que existía», y cada uno se arregla distinto. Se estampa **solo si el mail salió** — marcarla en el intento convierte la columna en «¿lo intentamos?» y el botón de reenviar mentiría.',
      '**Tres cosas tienen que coincidir o el mail no sirve**: quién firma, a dónde vuelve un «Responder» y a dónde se le dice a la persona que escriba. Y el contacto de ayuda es **MaKo**, no quien dio el alta: lo que falla en este mail es ENTRAR, y eso lo arregla MaKo — si el alta la hizo un cliente, se le estaba poniendo a él la mesa de ayuda de nuestro producto.',
      '⚠️ **Dos trampas del barrido de 34 agentes que siguen valiendo.** (a) `rol_ws: null` significa «no tiene rol DENTRO de un negocio», o sea admin de agencia, y un `?? \'admin\'` lo colapsaba con «es el dueño»: le llegaba «vas a poder cargar tu negocio». Cada pregunta, su campo. (b) **El MX no prueba que la casilla exista** y se lo había usado como evidencia: los MX de hola-mako.com son de **reenvío** (Porkbun), que entrega alias por alias y solo los dados de alta a mano, y la API no expone esas reglas — no se puede verificar desde el código.',
      '⚠️ **Lo que queda del hueco:** existe el alta de una PERSONA, no la de un **workspace**, y falta un envío real a una casilla externa — es lo único que prueba DNS y reputación del dominio.',
    ],
    commits: [
      { sha: '17944fbf', msg: 'Dar de alta a alguien ahora le avisa: el mail de acceso que nunca salía', lineas: 676, archivos: 13 },
      { sha: '954db59b', msg: 'El contacto de ayuda es MaKo, y la dirección de MaKo es UNA sola', lineas: 171, archivos: 7 },
      { sha: '9bee13c0', msg: 'El MX no prueba que la casilla exista, y otras tres del barrido', lineas: 185, archivos: 6 },
    ],
    archivos: [
      'lib/invitaciones.ts — el único lugar que manda el mail de acceso; los tres call-sites lo importan',
      'lib/invitacion-aviso.ts — el texto, que dice el paso que FALTA y no el que se cumplió',
      'app/admin/AdminView.tsx · app/equipo/EquipoView.tsx — «Reenviar acceso», con el aviso pegado a SU fila',
    ],
  },
];
