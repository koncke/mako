// =============================================================================
// General — el registro de construcción de la casa del cliente
// =============================================================================
// El área es lo primero que ve un cliente al entrar: el **semáforo de salud**, el
// **reporte del día** y **lo que MaKo propone** con el contexto del negocio.
// Su código vive en `app/general/`, `lib/reportes.ts`, `lib/meta-health.ts`,
// `lib/avisos.ts` y `lib/mako-context.ts`.
//
// ESTO NO ES UN CHANGELOG. El changelog está en `git log`. Acá va lo que git no
// guarda: qué pidió el dueño con sus palabras, por qué se resolvió así, y —sobre
// todo— dónde el diagnóstico obvio era el equivocado.
//
// DE DÓNDE SALIÓ CADA COSA
//   pedido   textual, de los 1.038 mensajes del dueño destilados de las 48 sesiones
//            (docs/chats.md es el índice de esas sesiones).
//   puntos   de docs/hallazgos-ia.md, hallazgos-ui.md, hallazgos-comunicacion.md,
//            hallazgos-infra.md y la sección «Estado real» de docs/mapa-del-proyecto.md.
//   commits  de `git log --numstat` sobre las rutas del área. `lineas` son las
//            AGREGADAS del commit entero, `archivos` los que toca.
//
// ⚠️ Las horas de los prompts NO existen en la fuente: los turnos del dueño están
// fechados por día, sin hora. Van con «—» a propósito. Un dato inventado acá es
// peor que un dato faltante. Las horas de las implementaciones son la del commit.
//
// Se agrega AL FINAL del array (orden cronológico). La pantalla lo lee al revés.

import type { Hito, Parte } from '../_registro/tipos';

/** Las fases del área y en qué anda cada una. */
export const PARTES: Parte[] = [
  { titulo: 'La Vista General', detalle: 'KPIs del período · objetivo hero con pacing · todo número lleva a nombres', estado: 'hecha' },
  { titulo: 'El semáforo de tres luces', detalle: 'Veredicto único · alertas rojo/ámbar/verde · higiene de datos como alerta', estado: 'hecha' },
  { titulo: 'Salud de Meta enchufada al semáforo', detalle: 'Cuenta inhabilitada · entrega y aprendizaje · anuncios retenidos', estado: 'hecha' },
  { titulo: 'El reporte del día', detalle: 'Diario y por hora al WhatsApp del dueño · semanal por WhatsApp y email', estado: 'hecha' },
  { titulo: 'El motor de avisos', detalle: 'Un solo choke point (emitirAviso) · catálogo de voz · interruptor por workspace', estado: 'hecha' },
  { titulo: 'El cuarto estado: «no sé»', detalle: 'Sin fuente conectada el semáforo NO puede decir «sano» · el gate es la fuente, no que la query no reviente', estado: 'sigue' },
  { titulo: 'El semáforo vivo', detalle: 'Razonamiento de IA sobre lo que hoy no tiene regla escrita · conectado a la Retro', estado: 'cola' },
  { titulo: 'El semáforo que se anticipa', detalle: 'Hoy es reactivo · «estás por apagar tu anuncio ganador sin darte cuenta»', estado: 'cola' },
  { titulo: 'La pantalla General del rediseño', detalle: 'Parte 5 de las 9 · la prioridad de la semana con sus seis campos', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── Junio: nace el semáforo ────────────────────────────────────────────────
  {
    // ⚠️ Sin `chat`: estos commits son ANTERIORES a la primera sesión registrada
    // (el repo se clonó el 2026-06-19). No hay transcripción a la que atribuirlos.
    fecha: '10 jun', hora: '01:15', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El semáforo de tres luces, y la higiene de datos como alerta',
    puntos: [
      'La pantalla existía desde el 31 de mayo (`2cf50ce`, «Fase 5 — tabs Comercial + Vista General»), pero era una grilla de KPIs. Lo que la vuelve **la casa del cliente** es el semáforo: un veredicto único arriba de todo, y debajo la lista de focos.',
      'La decisión de fondo: **el veredicto se deriva de las alertas, no se escribe**. `urgentes > 0` → rojo, `vigilar > 0` → ámbar, y el `else` final dice «El negocio está sano». Ese `else` es exactamente el que se convierte en el bug más caro del área un mes después (ver la cosecha del 6 de agosto).',
      'La higiene de datos entró como alerta ROJA de primera clase (`084da00`): un lead sin marcar no es una tarea pendiente, es un tablero que no se puede creer. De ahí sale la card de pendientes con los cuatro tipos (sin asistencia a R1, sin R2 ni resolución, sin asistencia a R2, nutrición manual vencida).',
      'El bloque «Hoy» (`222cd36`) puso las reuniones del día y la cola de acción arriba del fold: la pantalla dejó de responder «cómo venimos» para responder **«qué hago ahora»**.',
    ],
    commits: [
      { sha: 'b3e5824', msg: 'feat(fase-8): rediseño visual completo — semáforo, gauges, timeline, cascada', lineas: 1351, archivos: 6 },
      { sha: '084da00', msg: 'feat(v2-fase9): higiene de datos como alerta roja', lineas: 456, archivos: 5 },
      { sha: '222cd36', msg: 'feat(v2-fase11): bloque Hoy en Vista General (juntas + cola de acción)', lineas: 463, archivos: 2 },
    ],
    archivos: [
      'app/general/page.tsx — `Semaforo()`, `PendientesCard()` y el veredicto derivado',
      'app/general/ObjetivoBloque.tsx — el objetivo hero con pacing',
      'app/general/actions.ts — las lecturas del período',
    ],
  },
  {
    fecha: '21 jun', hora: '01:05', chat: 'MaKo en los gráficos + contexto y onboarding', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Lo que MaKo sabe cuando abrís la casa',
    puntos: [
      'Nace `lib/mako-context.ts`: la pieza que arma el contexto del negocio (Conocimiento por RAG, la fase del negocio, los prompts editables y el estado del onboarding) y se lo inyecta al agente antes de que abra la boca.',
      '**La regla que se fijó acá y sigue viva: la inyección es ADITIVA.** Si una pieza está vacía, MaKo se comporta exactamente igual que sin ella — nunca peor, nunca inventando. Es lo que permite que el archivo haya crecido después con el funnel real (`14d06c4`), los experimentos (`595fc09`) y el onboarding por tab (`55f2680`) sin romper a nadie.',
      '⚠️ Trampa de las dos cuentas, con este archivo como caso testigo: `lib/mako-context.ts` llegó a tener la inyección de experimentos de una sesión y el refactor de prompts de la otra **en el mismo archivo**. Un `git add lib/mako-context.ts` se llevaba las dos. Está documentado en `docs/hallazgos-infra.md:1252`.',
    ],
    commits: [{ sha: '83ff402', msg: 'MaKo contexto: Conocimiento (RAG) + Fases + Prompts + Onboarding, enchufado al agente', lineas: 974, archivos: 17 }],
    archivos: ['lib/mako-context.ts — el armador del contexto; crece por bloques, nunca los pisa'],
  },

  // ── El semáforo se entera de Meta ──────────────────────────────────────────
  {
    fecha: '24 jun', hora: '—', chat: 'Ads Manager estilo Meta', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'La cuenta lleva días inhabilitada y el tablero no lo dice',
    pedido: 'En la vista general, debería haber otras cosas que también despierten la ALERTA ROJA de urgencia, en el semaforo... Por ejemplo, ahora mismo hace días que la cuenta está INHABILITADA por falta de pago / error en la tarjeta. Eso y otras razones urgentes se debe poder ver.\n\nTambién me gustaría que en Marketing se pueda visualizar un apartado de rendimiento de las campañas y adsets... Que pueda visualizar el estado de los ads, si están en aprendizaje, o si están inactivos o activos.\nQue traiga también las recomendaciones que Meta me da con los puntos de recomendación.',
    puntos: [
      'Este es el pedido que define para qué sirve el semáforo: **no es un resumen de métricas, es la lista de cosas que te están costando plata AHORA y no se ven en ningún gráfico.** Una cuenta suspendida no baja un KPI: los deja planos, que es indistinguible de un día flojo.',
      'Trajo además la regla que gobierna el área entera: si un dato viene de un servicio externo, el estado del servicio **es** un dato del negocio.',
    ],
  },
  {
    fecha: '24 jun', hora: '15:48', chat: 'Ads Manager estilo Meta', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Estado de Meta, y la cuenta muerta enciende la luz roja',
    puntos: [
      'Nace `lib/meta-health.ts` (545 líneas de una): estado de la cuenta publicitaria, entrega, fase de aprendizaje y motivos de rechazo. `app/general/page.tsx` lo consume y lo convierte en alerta del semáforo.',
      '**Lo que NO salió, y es la parte que hay que saber:** las recomendaciones de Meta nunca funcionaron. El dueño rechazó de plano la salida fácil —«no quiero que MaKo a la fuerza me dé una respuesta»— y también rechazó la explicación de que fuera por la falta de pago, porque dentro de Meta el mismo botón sí daba recomendaciones. Cambió el token por un system user nuevo, lo puso en Vercel, deployeó, y el error siguió. **Quedó sin diagnosticar.**',
      'Regla que salió de ese rechazo y aplica a todo el área: **un aviso vacío es preferible a un aviso inventado.** Si la API no devuelve nada, el semáforo calla; no rellena con prosa.',
    ],
    commits: [{ sha: '6be864f', msg: 'feat(meta): vista "Estado de Meta" (salud de entrega) + alerta de cuenta en el Semáforo', lineas: 1021, archivos: 8 }],
    archivos: [
      'lib/meta-health.ts — NUEVO. Salud de entrega + `sugerenciasMako()` (deriva las recos desde los datos, no las pide)',
      'app/general/page.tsx — la alerta de cuenta entra al array de `alertas`',
    ],
  },

  // ── El reporte del día ─────────────────────────────────────────────────────
  {
    fecha: '30 jun', hora: '—', chat: 'Perfil, notificaciones y rediseño del sidebar', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Reportes diarios o por hora, al WhatsApp',
    pedido: 'Quiero dos nuevas tab que estén dentro del perfil del usuario:\n\n1. Tab de "Perfil" (Que se pueda editar todo lo títpico de un perfil)\n2. Tab de "Notificaciones"\n\nQuiero Reportes diarios o incluso por hora de lo urgente/rutinario por WhatsApp (semáforo, ads, wins, etc.) al telefono de WhatsApp del usuario...\nQuiero reportes por WhatsApp y por email semanales\n\nQuiero un sistema de notificación de lo que está pasando en la app.',
    puntos: [
      'El paréntesis «(semáforo, ads, wins, etc.)» es lo importante: el reporte **no es una pantalla nueva**, es el semáforo saliendo de la app. Por eso `lib/reportes.ts` no calcula nada propio: lee lo mismo que pinta `/general`.',
      'De acá sale el norte del área: la casa del cliente tiene que poder leerse **sin abrir la app**.',
    ],
  },
  {
    fecha: '30 jun', hora: '23:39', chat: 'Perfil, notificaciones y rediseño del sidebar', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El reporte sale de la app: WhatsApp diario, email semanal',
    puntos: [
      'Nace `lib/reportes.ts` (202 líneas): arma el diario / por hora / semanal y linkea a `/perfil?tab=notificaciones` para apagarlo.',
      '⚠️ **Dos trampas que sobrevivieron meses acá adentro, las dos silenciosas:** (1) los reportes salen **por default** y el envío por email **no mira el flag de envío**, así que un workspace recién creado recibe sin haber pedido nada; (2) el link `?tab=notif` que usan los 49 avisos funciona **por coincidencia** — `ConfigInnerTabs` arranca fijo en `notif` y no lee query params, así que el día que cambie el default se rompen los 49 a la vez (`docs/hallazgos-ui.md:1299`).',
      '⚠️ **Y la campanita in-app nunca existió.** La migración `0048_notificaciones.sql` está escrita y **sin aplicar**, y `crearNotificacion` tiene un catch mudo que convierte «falta media feature» en «no pasa nada». Aplicarla tal cual sería peor: la tabla no tiene `workspace_id`, así que encendería un feed que le muestra los avisos de todos a cada cliente (`docs/hallazgos-infra.md:804`).',
      'En la misma tanda, el problema de un anuncio pasó a ser **clickeable y en español** (`52e553f`): antes el motivo de rechazo de Meta solo aparecía en un hover, en inglés y sin nada que hacer con él.',
    ],
    commits: [
      { sha: 'e3d7024', msg: 'Perfil + Notificaciones: tabs, centro de notificaciones y reportes WhatsApp/email', lineas: 1479, archivos: 20 },
      { sha: '52e553f', msg: 'Ads Manager: problema clickeable + explicado en español (no solo hover en inglés)', lineas: 82, archivos: 3 },
    ],
    archivos: [
      'lib/reportes.ts — NUEVO. Diario · por hora · semanal; lee lo mismo que /general',
      'lib/notificaciones.ts — el feed in-app, escrito y nunca montado',
      'supabase/migrations/0048_notificaciones.sql — SIN APLICAR, y sin `workspace_id`',
    ],
  },
  {
    fecha: '1 jul', hora: '—', chat: 'Nueva campaña con IA en Ads Manager', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El error de un anuncio tiene que subir hasta el semáforo',
    pedido: 'Si hay anuncios con problemas tiene que aparecer ese mismo estado en la campaña y en el adset.\nY debe aparecer en el semaforo, como urgente.\n\nTambién debería poder visualizar cual es el error y si se puede poder solucionarlo desde allí mismo.',
    puntos: [
      'Es el pedido de **propagación**: un anuncio roto no es un problema del anuncio, es un problema del negocio, y tiene que viajar hacia arriba hasta la casa.',
      'Salió la mitad: `a762575` trajo el historial de estados negativos de Meta y las recomendaciones en español. **La propagación anuncio → adset → campaña → semáforo quedó SIN hacer**, junto con poder arreglar el error desde ahí mismo y la edición de campañas/adsets/anuncios con la UX del wizard. Sigue pendiente hoy.',
    ],
    commits: [{ sha: 'a762575', msg: 'Integraciones: historial de estados negativos de Meta + recos en español', lineas: 177, archivos: 6 }],
  },

  // ── Julio: de pantalla a sistema de avisos ─────────────────────────────────
  {
    fecha: '9 jul', hora: '—', chat: 'Plan para volver la app Doer, no Thinker', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El semáforo es la funcionalidad práctica, y le di prioridad a los gráficos',
    pedido: 'Yo siento que le di mucha mucha prioridad a las funcionalidades de gráficos y análisis, pero no tanta a las funcionalidades prácticas... Como por ejemplo "El semáforo", que hoy podría mejorarse mucho, conectarse a la Retro, por ejemplo, que te envié notif de Whatsapp avisandote las urgencias, etc...',
    puntos: [
      'El diagnóstico entero: la app quedó **Thinker** y su usuario es un infoproductor que ejecuta. «Es probable que como está hoy la app, no usen el 80% de funcionalidades. NO porque no estén buenas, sino porque es mucho.»',
      'El semáforo quedó nombrado como **uno de los cinco pilares** del programa «app viva», junto con Retro, To-do, Experiments y WhatsApp. Al día siguiente lo dijo más fuerte: «Mejorar ampliamente las cosas que caen en El semáforo del negocio... Que realmente sea algo vivo, que me avise con razonamiento de IA también, no solo las cosas que hoy están» (2026-07-10).',
      'Esto es lo que convierte al área de **pantalla** en **sistema**: lo que el semáforo detecta tiene que salir por WhatsApp, no esperar a que alguien abra la tab.',
    ],
  },
  {
    fecha: '14 jul', hora: '—', chat: 'Email Marketing y WhatsApp no oficial', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: '«Sé muy perfeccionista en esta parte»',
    pedido: 'Cuando termines, continua con el semaforo + los avisos. Se muy perfeccionista en esta parte, corre multiagente de ser necesario para identificar absolutamente todos los casos de uso de notificaciones al dueño. Y también las categorías de verde, amarillo, rojo del semaforo. Haz pruebas, enviame mensajes creando un nuevo grupo de WhatsApp para pruebas. Y que eso quede 100% funcional. Quiero que me envies todos posibles mensajes, incluso los que aún no tenemos la lógica configurada, por ejemplo: "Este anuncio te lo recomiendo apagar por X razon, ¿Lo hago?"',
    puntos: [
      'La orden de arquitectura está en la frase «que **del semáforo salgan los principales avisos**» (mismo día): el semáforo es la **fuente**, los avisos son el **transporte**. No dos lógicas paralelas.',
      '«Enviame todos los posibles mensajes, incluso los que aún no tenemos la lógica configurada» es un método, no un capricho: escribir el catálogo de voz **antes** que los disparadores obliga a decidir cómo suena MaKo sin la excusa de lo que ya está implementado.',
    ],
  },
  {
    fecha: '14 jul', hora: '12:22', chat: 'Email Marketing y WhatsApp no oficial', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El motor de avisos: un solo choke point',
    puntos: [
      '`emitirAviso` es **el único** punto por donde sale un aviso, y `lib/avisos-catalogo.ts` guarda los mensajes con su voz. Todo lo demás (crons, webhooks, el semáforo) llama ahí. Es la regla «una cosa, un lugar» aplicada: 49 mensajes, un solo lugar donde se decide si salen.',
      '**Decisión de producto que quedó fija: MaKo avisa solo lo que importa.** Nada de «todo bien» ni ruido — «me parece perfecto que no avise todo bien o que no avise cosas innecesarias». Sí avisa **wins**, y una win hay que definirla (su ejemplo: una campaña de testeo encontró un ad ganador).',
      '**Regla del dedup, que costó entenderla:** los eventos discretos van SIN `dedupTtlMin` y se protegen con una guarda de transición (estado previo ≠ nuevo); los agregados de cron (cobranza, salud de Meta) sí llevan dedup. Si hace falta dedup por entidad, no se usa el catálogo: se llama `emitirAviso` directo con un `tipo` compuesto (`reunion-no-show:{leadId}:{j1|j2}`).',
    ],
    commits: [{ sha: '6dd5215', msg: 'feat(avisos): catálogo de voz + motor (choke point) + demo "mandame todo"', lineas: 557, archivos: 4 }],
    archivos: [
      'lib/avisos.ts — `emitirAviso` (el choke point) y `emitirDelCatalogo`',
      'lib/avisos-catalogo.ts — los 49 mensajes con su voz y su TTL',
    ],
  },
  {
    fecha: '17 jul', hora: '—', chat: 'Onboarding del cliente y oferta cebolla', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El amarillo que falta: «faltan conectar datos»',
    pedido: 'Entonces podríamos aclarar en el semáforo tal vez como amarillo que faltan conectar datos...\n\nCon respecto a Comercial. WhatsApp. Closing y Script Analyst y todas las que SI o SI dependen de que el usuario haya conectado algo o hecho cierto onboarding, al entrar NO debería mostrar nada, debería salir la misma pantalla dividida del onboarding y pedirle esos datos.',
    puntos: [
      'Este es el pedido que resuelve el bug más grave del área, y **lo dio él**: el semáforo tiene tres luces y necesita una cuarta lectura — «no sé todavía».',
      'La regla general que sale de la segunda parte: **estado vivo, no recordado.** Un paso que depende de una conexión no muestra pantalla vacía ni datos inventados: muestra el onboarding pidiendo esos datos.',
      'Sigue **sin implementar en `/general`** al día de hoy. Es la fase 6 del roadmap de arriba.',
    ],
  },
  {
    fecha: '25 jul', hora: '—', chat: 'Landing de venta y mini-VSL de Funnel', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El semáforo es reactivo, y podría anticiparse',
    pedido: '1. Esto NO se entiende por si solo: Tu cuenta de Meta murió en silencio (figura "activa", no entra un lead).\n2. Esto no tiene sentido, el presupuesto en Meta NO se comporta de esa manera: Gastaste el presupuesto a mediodía y quedaste sin leads a la tarde.\n3. Esto está muy bueno, pero siento que el espíritu del semáforo es ser reactivo. aunque también podría anticiparse... No lo se: Estás por apagar tu anuncio ganador sin darte cuenta.\n4. Sumaría algo de Lanzaste una campaña de RECON y encontraste un ad ganador, o ninguno lo fue.',
    puntos: [
      'Salió escribiendo copy de la landing y terminó siendo **especificación de producto**: al listar qué podría avisar el semáforo, aparecieron los avisos que faltan. Vale registrarlo porque el mejor inventario de features del área salió de un ejercicio de marketing.',
      'Los puntos 1 y 2 son correcciones de **veracidad técnica**, no de estilo: un aviso que describe mal cómo funciona Meta se lee como que la app no entiende Meta.',
      'El punto 3 abre la fase 8 del roadmap: hoy el semáforo mira lo que ya pasó. El caso testigo que él eligió —«estás por apagar tu anuncio ganador sin darte cuenta»— es de los pocos donde el aviso llega **antes** del daño.',
    ],
  },
  {
    fecha: '31 jul', hora: '11:30', chat: 'Subir creativos a campaña existente', cuenta: 'claude1',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Dos avisos que se perdían: el que no salía y el que Meta retenía',
    puntos: [
      '**Un aviso que no salía por WhatsApp era invisible** (`3ec1d72`, 29 jul, en otra sesión). El fallo de envío se tragaba en silencio, así que «no llegó» y «no había nada que avisar» eran el mismo resultado en pantalla. Es el modo de falla que se repite en toda esta área: el éxito y el silencio se ven igual.',
      '**Meta retiene anuncios sin rechazarlos** (`bab6f06`, 31 jul): quedan en un limbo de «peer approval» que **no tiene API**. No se puede consultar ni destrabar por código. Lo único honesto era avisarlo y llevar al botón de aprobar dentro de Meta — el aviso existe justamente porque la automatización no.',
      'Regla que queda: cuando el mundo exterior no da un endpoint, el área no simula uno. Avisa y abre el camino manual.',
    ],
    commits: [
      { sha: '3ec1d72', msg: 'Un aviso que no sale por WhatsApp deja de ser invisible', lineas: 18, archivos: 3 },
      { sha: 'bab6f06', msg: 'fix(meta): avisar que Meta retiene los anuncios y llevar al botón de aprobar', lineas: 191, archivos: 7 },
    ],
    archivos: ['lib/avisos.ts — el fallo de envío deja de ser silencioso', 'lib/meta-health.ts — el estado «retenido» de Meta'],
  },

  // ── Agosto: la cosecha ─────────────────────────────────────────────────────
  {
    fecha: '6 ago', hora: '01:51', chat: 'Notificaciones y título de tab', cuenta: 'claude1',
    actor: 'claude', tipo: 'cosecha',
    titulo: 'Lo que quedó vivo en el área, y por qué duele',
    puntos: [
      'Se mapearon todas las notificaciones y quedaron activables por usuario y por canal (in-app con pop-up y sonido **por separado**, WhatsApp, email), y el título de la pestaña pasó a decir la tab (`dc58336`).',
      '🔴 **El bug caro del área: sin ninguna fuente conectada, `/general` declara «El negocio está sano».** El semáforo arma `alertas = []` cuando no hay datos y cae al `else` final: «Sin focos activos. Buen momento para empujar volumen». La card de pendientes con 0 leads afirma «datos al día — el tablero es confiable». Un cliente que gastó plata en ads y ve luz verde con 0 cierres se lleva un tablero que no sabe de qué habla — **y es lo primero que ve en su primer login**. Vive en `app/general/page.tsx:411-415`, `:441-442` y `:477`.',
      '**El diagnóstico obvio era el equivocado.** No es que falten alertas: es que `getRevenuePeriod` y `getFunnelEtapas` **no explotan** con `leads`/`pagos` vacíos — devuelven CEROS. Y un cero es un dato. El gate de un área tiene que ser **la fuente conectada**, no que la query no reviente. El mecanismo de honestidad ya existe y está desconectado: `lib/sources.ts` separa conectada-y-fresca, conectada-sin-datos-recientes y desconectada, y el semáforo no usa la distinción.',
      '⚠️ **Apagar un aviso envenena su dedup.** La rama de «apagado» llama igual a `marcarAvisado()`, así que la marca se refresca durante el silencio; al reprender el interruptor, `avisadoReciente()` encuentra una marca fresca y devuelve `deduped: true` sin enviar. Con `tracking-apagado` (TTL 3 días) el primer WhatsApp llega hasta 3 días después (`lib/avisos.ts:89-92`).',
      '⚠️ **Las plantillas de avisos son GLOBALES aunque la UI las muestre por workspace.** El store vive en `app_settings` bajo `mako.plantillas.store` y se lee siempre dentro de `runWithWorkspace(OWNER_WS)`: si un cliente apaga un aviso, lo apaga para todos, y `emitirDelCatalogo` devuelve `{ ok: true, deduped: true }` — o sea **éxito**. Nunca devuelvas `ok: true` para «apagado».',
      '⚠️ **El aviso paga la llamada al modelo ANTES de decidir si sale.** El texto se genera con `chatClaude` en `lib/avisos.ts:158-159`, pero el dedup y el interruptor se evalúan dentro de `emitirAviso` (:86, :106). Con la ráfaga conocida de 16 mensajes de WhatsApp en 4 segundos son **16 llamadas al modelo adentro de un handler de webhook**. La redacción va después del gate, nunca antes.',
      '⚠️ **`runWithWorkspace` y los avisos:** `avisoWaActivo` hace `runWithWorkspace(1, …)`, que **pisa** el AsyncLocalStorage del webhook. Ocho emisores corren sin pasar `ws` y el WhatsApp del cliente termina en el grupo del dueño. Se arregla en el choke point (`a.ws ?? (await getWorkspaceActual()) ?? OWNER_WS`), no en los 8 call-sites.',
      '📌 Lo que sigue abierto, con su archivo: la cuarta lectura del semáforo (`app/general/page.tsx` + `lib/sources.ts`) · la propagación del error de un anuncio hasta el semáforo (`lib/meta-health.ts`) · la campanita in-app (`0048_notificaciones.sql` sin aplicar, sin `workspace_id`) · las recomendaciones de Meta, sin diagnosticar desde el 24 de junio.',
    ],
    commits: [{ sha: 'dc58336', msg: 'Notificaciones configurables + la sección en el título de la pestaña', lineas: 786, archivos: 13 }],
    archivos: [
      'app/general/page.tsx:411-415, :441-442, :477 — el `else` que certifica «sano» sin datos',
      'lib/sources.ts — los cuatro estados de una fuente, escritos y sin consumir en el semáforo',
      'lib/avisos.ts:71, :89-92, :139, :157-159 — ws, dedup, maestro/hijo y el orden del gate',
      'docs/hallazgos-ia.md:498 · docs/hallazgos-ui.md:693 · docs/hallazgos-comunicacion.md:1115 — el detalle largo de cada uno',
    ],
  },

  // Cosecha retroactiva (17 ago): tandas que se trabajaron y no habian dejado
  // hito. Salieron de cruzar el git log del area contra este mismo archivo.
  {
    fecha: "11 ago", hora: "18:09", chat: "Productos X Funnels", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "El WhatsApp solo avisa y linkea, y cada mensaje arranca con su rótulo",
    puntos: [
      "Tres pedidos textuales del dueño mostrando su WhatsApp: «No quiero que en WhatsApp me diga absolutamente nada de lo que pasó en la reu o lo que quedó pendiente o nada. Solo el link.», «No me puede decir que me dejó un mensaje listo y no mandarme un link» y «Los mensajes se solapan, quiero diferenciarlos fácil». Los mensajes quedaron en qué pasó + a dónde ir, y el rótulo de ÁREA (━━ 🗓️ REUNIÓN ━━) se pegó en el choke point emitirAviso, así lo toman los ~48 avisos y los que se creen mañana. Antes, el dueño había mostrado avisos «incompletos, como el que te pregunta ¿Querés que te pase el resumen y las objeciones acá? y al final no hace nada».",
      "Dos cosas que se pierden si no se escriben. Primero, el diagnóstico obvio era el equivocado: no faltaba cablear la respuesta al «¿te lo paso acá?» — el aviso se emitía en el INSTANTE del webhook de Fathom y el Closing Analyst corre después, adentro del after(). Cuando MaKo ofrecía el resumen, el resumen todavía no existía. El arreglo fue mover la emisión adentro del after(), no escribir código nuevo. Segundo, el rótulo es por ÁREA y NO por categoría, y el porqué está medido: al dueño le importa distinguir «esto es de una reunión» de «esto es de plata», no «aviso» de «pregunta» — con la categoría, catorce mensajes de temas distintos arrancarían igual y no se arreglaba nada. Y la regla de contenido: repetir el resumen en el chat lo CONGELA en el momento del envío y hace que abrir el link se sienta redundante justo cuando es lo único que importa. Hay un test que falla si alguien vuelve a meter el análisis en el chat y otro que exige que los 48 avisos tengan área declarada.",
    ],
    commits: [
      { sha: "7bdf8993", msg: "El WhatsApp solo avisa y linkea; y cada mensaje arranca con su rótulo", lineas: 257, archivos: 7 },
      { sha: "b4714a82", msg: "Los mensajes de MaKo dejan de preguntar al vacío: un link al resumen del lead", lineas: 1333, archivos: 16 },
    ],
  },
  {
    fecha: "13 ago", hora: "10:56", chat: "Integraciones", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "La alerta que no afloja: los avisos de Meta existían y nadie los emitía",
    puntos: [
      "La cuenta del dueño estuvo con ENTREGA FRENADA —cero anuncios, cero leads— y por WhatsApp no llegó nada. Un grep de los cuatro tipos de aviso de Meta devolvía CERO call-sites fuera del catálogo: estaban escritos, con su `disparador` documentado, y nadie los llamaba nunca. Se DETECTABA (quedaba en service_incidents y /integraciones lo pintaba rojo) y no se avisaba; en la base había tres incidentes previos sin un solo mensaje (16/7 dos días frenado, 29/7 cuatro horas). Nace lib/alerta-critica.ts + cron propio, que INVIERTE el dedup del motor: pedido textual «tenemos que ser MUY PESADOS, no solo el mensaje DRAMÁTICO sino la frecuencia MUY alta hasta que se solucione». Después el dueño corrigió dos veces sobre producción: «que sea CLARO, que diga tu cuenta publicitaria está SUSPENDIDA por falta de pago, no simplemente que está frenada» (el titular pasó a armarse desde el account_status real, con mapa estado → causa + qué hacer, en lib/alerta-critica-texto.ts sin server-only para poder testearlo), y «cada 1 hora, no cada 10 minutos».",
      "Es el hito más caro que falta del área, y toca la regla de fondo: un catálogo de mensajes NO es un sistema de alertas. La red que queda es un test que falla si un aviso rojo se declara implementado y no tiene quién lo llame — el grep de arriba, automatizado. Además deja tres cosas que no se pueden revertir sin volver al problema: (1) DETECTAR rápido e INSISTIR seguido son cosas distintas y ahora se ven distintas en el código (el cron sigue cada 10 min, la insistencia bajó a 1 h porque seis mensajes por hora entierran el resto de los avisos que comparten el chat — lo que hace que funcione no es la frecuencia sino que NO SE DETIENE); (2) solo insiste lo que cuesta plata AHORA, porque si todo insistiera el dueño silencia el canal entero; (3) al resolverse avisa y para. Y la trampa que nadie iba a adivinar: la alerta le llegó DOS VECES en dos grupos y no era ruteo — el Cliente de Prueba (ws3) tiene su PROPIA copia de las credenciales de Meta apuntando a la MISMA cuenta publicitaria, verificado en la base con dos incidentes abiertos del mismo «Saldo impago» a 12 minutos. La unidad de un aviso de Meta es la CUENTA, no el workspace. Nada de esto está escrito en ningún hallazgo tampoco: `grep alerta-critica docs/` no devuelve nada.",
    ],
    commits: [
      { sha: "a21d7bef", msg: "Los avisos de Meta existían solo como texto: nadie los emitía nunca", lineas: 435, archivos: 5 },
      { sha: "9a081c29", msg: "La alerta dice la CAUSA, no el síntoma — y grita", lineas: 232, archivos: 4 },
      { sha: "5b3ad721", msg: "La alerta avisa cada 1 hora, y una vez por CUENTA (no por workspace)", lineas: 85, archivos: 4 },
    ],
  },
  {
    fecha: "13 ago", hora: "21:20", chat: "Integraciones", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "Nueve avisos nuevos y tres reglas del motor que salieron de ellos",
    puntos: [
      "Siete commits sumaron avisos al catálogo desde afuera del área (landing/Pixel, leads de formulario, lead fusionado, Clarity, snippet viejo) y de paso fijaron reglas del MOTOR que no estaban escritas. (1) Los avisos que transportan un link exacto pasan a `texto` determinista en vez de `contexto`: con contexto lo redacta el modelo, y la regla de la casa dice que un dato exacto no lo transporta un LLM — de paso deja de pagarse una reescritura que nadie pidió. (2) El aviso de Clarity casi entra como un mensaje por lead: el dedup de emitirDelCatalogo es por TIPO, así que habría sonado solo para el primero de la tanda y los otros cuatro se habrían perdido EN SILENCIO; va UN aviso con la lista, ordenado por urgencia. (3) Área nueva `landing` con su rótulo propio (━━ 🌐 TU LANDING ━━): salía como «🔧 SISTEMA», que no le dice a nadie de qué le están hablando.",
      "Es la tanda donde el motor de avisos se usó de verdad desde otras áreas y quedó demostrado dónde se rompe. La trampa del dedup por tipo es la que más va a volver: no falla, no loguea nada, simplemente cuatro personas no se enteran — y el que escribe el aviso nuevo no tiene por qué saber que el dedup no es por entidad. La regla de `texto` vs `contexto` es el corolario de «un dato exacto no lo transporta un LLM» aplicado al catálogo, y es la primera vez que se escribe como criterio de qué campo usar. Y queda la del caso de los ocho leads: un aviso es un EVENTO y una bandeja es un ESTADO; lo que solo era evento es lo que se pierde. Sin hito, el próximo que agregue un aviso al catálogo repite las tres.",
    ],
    commits: [
      { sha: "562f8962", msg: "landing: el snippet se versiona y MaKo avisa cuando quedó viejo", lineas: 132, archivos: 5 },
      { sha: "7b59ac95", msg: "landing: arregla el token que rompí, y el aviso pasa a ser accionable", lineas: 175, archivos: 6 },
      { sha: "417c539d", msg: "landing: los 8 leads SI habian entrado — lo que faltaba era que alguien se enterara", lineas: 158, archivos: 5 },
      { sha: "5d125365", msg: "leads: el visitor_id no llegaba al insert, y los webhooks ya no fusionan callados", lineas: 178, archivos: 8 },
      { sha: "517200d1", msg: "clarity: el cron que cachea el resumen y avisa antes de que se borre la grabación", lineas: 227, archivos: 6 },
      { sha: "2a5c338e", msg: "pixel v11: el autoplay no cuenta como play, y todo se acota a la landing elegida", lineas: 675, archivos: 14 },
      { sha: "d2e28fff", msg: "Pixel de MaKo: se llama igual en los 8 lugares donde aparecía distinto", lineas: 67, archivos: 8 },
    ],
  },
  {
    fecha: "16 ago", hora: "09:48", chat: "CRM", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "El primer pedazo del «no sé»: /general recuerda lo postergado, y su catch no se traga el error",
    puntos: [
      "El wizard de onboarding es bloqueante y un cliente quedó trabado NUEVE DÍAS en el paso de Meta —que se resuelve en la consola de Meta, no acá— sin poder entrar al resto de la app. Se agrega postergar UN paso (solo los que se cierran en un sistema de afuera) y /general pasa a llevar el recordatorio de lo que quedó pendiente. Dos decisiones dentro de app/general/page.tsx: el recordatorio cruza el flag con la conexión REAL de hoy (conectar Meta tres días después lo apaga solo), y el catch NO devuelve lista vacía: si la lectura falla se empuja un aviso.",
      "Es la primera vez que la fase 6 del roadmap del área —«el cuarto estado: no sé»— aterriza en la pantalla, y con el argumento exacto que el área viene pagando desde el 6 de agosto: «degradar callado está bien donde el número se ve en otra tab; este recordatorio no existe en ningún otro lado, así que un vacío afirma no te falta nada, que es lo contrario de lo que sabemos». Es el mismo `else` que certifica «El negocio está sano», resuelto por una vez en el lugar correcto — vale escribirlo como precedente antes de aplicarlo al semáforo entero. Y el dato que justifica la prioridad: de los cuatro clientes reales, los dos que no terminaron el wizard murieron en un paso de CONEXIÓN; ninguno en uno de contenido. El grueso de la tanda es del área onboarding (que también lo tiene sin hito, va al 7 ago), pero el pedazo de /general es propio y no está en ninguna bitácora.",
    ],
    commits: [
      { sha: "eb6e39fc", msg: "Dejar un paso pendiente y seguir: la salida del onboarding", lineas: 515, archivos: 8 },
      { sha: "289ef79c", msg: "Retomar el wizard pregunta por la pantalla, no la cuenta", lineas: 61, archivos: 2 },
    ],
  },
  {
    fecha: "12 oct", hora: "23:43", chat: "Graphics", cuenta: "claude2",
    actor: "martin", tipo: "prompt",
    titulo: "La cobranza, en la tab General",
    pedido: "Número tres, en la tab general, la cobranza.",
    puntos: [
      "Al cerrar la reunión con Mauricio (Fathom 858927676, 86:17). Antes, Mauricio a los 54:29: «tú tienes en dashboard cobranza y el cobranza yo lo veo más operativo… ¿A quién cobrarle?»; y a los 71:28: «creo que en Operate… debe ser cobranza… me genera mucho valor estar viendo quién sigue de cobranza. Pero nunca lo veo ahí realmente». Lo validó Martín el 13/10 al pasar el feedback de las 3 reuniones.",
    ],
  },
  {
    fecha: "13 oct", hora: "23:16", chat: "Graphics", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "«A quién cobrarle» en General, con «Marcar cobrada»",
    puntos: [
      "General muestra, arriba y debajo de la acción del día, a quién cobrarle: la próxima cuota de cada cliente, vencida o por vencer, con «Marcar cobrada» y Deshacer.",
      "Es la misma lista que el teléfono y que «Clientes por cobrar» del Dashboard: la misma lectura, el mismo renglón y la misma acción. Un negocio que no cobra en cuotas no la ve.",
      "La sección del Dashboard sigue donde estaba: Martín no dijo si se saca de ahí.",
    ],
    commits: [{ sha: "9966e7bc", msg: "General: «A quién cobrarle», con «Marcar cobrada»", lineas: 238, archivos: 6 }],
    archivos: ["app/general/Cobranza.tsx", "app/general/page.tsx", "lib/datos-comercial-server.ts", "app/crm/actions.ts"],
  },
  {
    fecha: '13 oct', hora: '—', chat: 'General', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'General personalizable, con plantillas, varias vistas y funnels',
    pedido: 'Soluciona las cosas que pidió Mauricio con la tab GENERAl y los cobros... Y te pido que la tab GENERAL sea personalizable... Que los usuarios puedan elegir que ver, si quieren ver "Prioridades" del PLAN, como el caso de Mauricio, las cuotas a cobrar... Otros querrán ver su objetivo, etc etc... Hazla personalizable. — Y en el mismo turno: Copia lo que ya tenemos en muchos lugares con "TEMPLATES" y la opción de IA de "¿Qué vas a crear hoy?"... Que hayan templates de tab general. Y que se puedan crear más de una, e incluso asignarles ofertas y/o funnels.',
    puntos: [
      'Lo de Mauricio sale de la reunión del 13/10 (min. 54 a 72, leído en el transcript): «el cobranza yo lo veo más operativo... ¿a quién cobrarle?» y «me genera mucho valor estar viendo quién sigue de cobranza»; Martín le contestó «lo pongo ahí en el general».',
    ],
  },
  {
    fecha: '13 oct', hora: '—', chat: 'General', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Las vistas de General: cada persona elige bloques, orden y alcance',
    puntos: [
      'Una vista = bloques del catálogo (los cinco de siempre más Prioridades del Plan, A quién cobrarle y Tu funnel hoy), su orden y sus funnels u ofertas. Por persona y por workspace en app_settings (`general.vistas.<sub>`), con compare-and-set. La vista por defecto es la /general de siempre con «A quién cobrarle» después de los KPIs: lo prometido a Mauricio, para todos.',
      'Plantillas (Operación diaria es el caso de Mauricio) y «¿Qué vas a crear hoy?» con la caja de siempre; la IA elige del mismo catálogo que «Personalizar» y lo que no existe se saca. Sólo dos bloques filtran por funnel y los demás lo DICEN («Todo el negocio»). El semáforo dejó de saltear la alerta del titular cuando la vista no dibuja la cabecera: se habría perdido de la pantalla.',
    ],
    archivos: [
      'lib/general-vistas-modelo.ts', 'lib/general-vistas.ts', 'lib/general-alcance.ts', 'lib/general-vistas-ia.ts',
      'app/general/page.tsx', 'app/general/BarraVistas.tsx', 'app/general/NuevaVista.tsx', 'app/general/EditarVista.tsx',
      'app/general/CobranzaGeneral.tsx', 'app/general/Bloques.tsx', 'app/api/general/ia/route.ts', 'tests/general-vistas.test.ts',
    ],
  },
  {
    fecha: '14 oct', hora: '02:20', chat: 'General', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Una sola «A quién cobrarle»: la de Graphics, como bloque de las vistas',
    puntos: [
      'Este chat y el de Graphics movieron la cobranza a General el mismo día sin saberlo; el choque apareció al integrar. Quedó la `Cobranza` de Graphics (la lectura y el renglón del teléfono, con su test), como el bloque «A quién cobrarle» de las vistas, recortada a los funnels de la vista y con su rótulo al lado del título. `CobranzaGeneral.tsx` se borró.',
      'Vacía, la vista de fábrica no la dibuja (un negocio sin cuotas no ve ruido); una vista que la persona armó, sí: la eligió, y una vista de sólo cobranza quedaba en blanco.',
    ],
    archivos: ['app/general/page.tsx', 'app/general/Cobranza.tsx', 'tests/general-cobranza.test.ts', 'docs/hallazgos-objectives.md'],
  },
  {
    fecha: '14 oct', hora: '02:41', chat: 'General', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'General personalizable de verdad: el editor del Dashboard, con plantillas',
    pedido: 'La personalización que hiciste en GENERAL es nula...\nMirá que tienes de donde inspirarte, pero no lo hiciste...\n\nTenemos un constructor de landing y gráficos para poder personalizar la tab general... Te pido por favor que lo hagas bien. Que todo sea personalizable, intenta replicar lo que tenemos en dashboard, solo que claro, aquí no hace falta tantos gráficos y tiene otro objetivo la tab... Teniendo eso en cuenta, también crea templates...\nMe imagino una que diga "Bienvenido NOMBRE..."\nLos bloques también deberían ser editables.',
    puntos: [
      'Con una captura del modal «Nueva hoja» del Dashboard. Las «vistas» del 13/10 (elegir bloques fijos de una lista) eran lo que se rechazaba.',
    ],
  },
  {
    fecha: '14 oct', hora: '03:19', chat: 'General', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Todos los bloques que alguien querría ver, con los distintos funnels',
    pedido: 'Piensa en todos los bloques que un usuario, con los diferentes funnels que tenemos y en general, todo lo que un usuario podría llegar a querer ver en una tab general, para hacer el editable',
    puntos: [
      'Lo contestó la tanda de las 04:13: los doce bloques de General como elementos del editor, y una plantilla por tipo de funnel.',
    ],
  },
  {
    fecha: '14 oct', hora: '04:13', chat: 'General', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'General es el editor del Dashboard, con su informe, sus bloques y sus plantillas',
    puntos: [
      'Hojas, «Nueva hoja» con «¿Qué vas a crear hoy?», mover, agrandar, estilos, filtros y todo el catálogo de gráficos: el mismo editor que el Dashboard, con un informe aparte por persona. Quien nunca armó el suyo ve la General de siempre.',
      'Doce bloques de General como un elemento más (el objetivo y la acción del día, objetivos, KPIs, semáforo, mi día, próximas llamadas, prioridades del Plan, pendientes del CRM, tu funnel hoy, a quién cobrarle, el mes, próximas publicaciones): se mueven, se duplican y se les cambia el título. «Tu funnel hoy» y «A quién cobrarle» se atan a un funnel desde su panel.',
      'Plantillas: la General de siempre, Bienvenida («{{saludo}}, {{nombre}}»: los textos entienden variables), Operación diaria, Foco, una por tipo de funnel (llamadas, WhatsApp, lanzamiento, servicio, curso) y Ventas.',
      'API de MaKo: listar, crear hoja y agregar bloque (con funnel). Las vistas, su IA y su ruta se retiraron.',
    ],
    commits: [{ sha: '56efcbaa', msg: 'General: el editor del Dashboard con su propio informe, bloques y plantillas', lineas: 4169, archivos: 42 }],
    archivos: [
      'app/general/page.tsx', 'app/general/piezas.tsx', 'app/dashboard/ElementoGeneral.tsx', 'app/dashboard/EditorInforme.tsx',
      'app/dashboard/Elemento.tsx', 'lib/general-piezas.ts', 'lib/general-plantillas.ts', 'lib/general-alcance.ts',
      'lib/graficos-tablero.ts', 'lib/graficos-catalogo.ts', 'lib/api-mako/areas/general.run.ts', 'tests/general-editor.test.ts',
    ],
  },
  {
    fecha: '14 oct', hora: '04:47', chat: 'General', cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'La barra del Dashboard sin búsqueda ni filtro, y una plantilla para quien empieza',
    pedido: "Toda la topbar la deberías copiar de Dashboard menos la barra de busqueda y el filtro que no sirven en general...\nY lo mismo que en Dashboard, para un usuario nuevo, deberías proponerle un template. \n\nLo único es que en lugar del botón de \"nuevo dashboard\" te pido que pongas ahí el \"¿Qué vas a crear hoy?\"... Te pido que le digas esto mismo a dashboard.\n\nY los templates, la preview debería ser como los de landing generator, porque justamente se deberáin ver como una pagina... Lo mismo te pido que le digas a dashboard.\n\ny el botón de EDITAR no debería saltarme ningún modal como el que salta hoy en día, debería, al igual que dashboard, habilitar el menú de edición de la página y poder comenzar a editarla...\n\n— Y al rato: Hazlo bien, mira como está construido el dashboard...",
    puntos: ["Con dos capturas: la barra del Dashboard y el modal «Personalizar vista» de las vistas (de antes del deploy de 46958506)."],
  },
  {
    fecha: '14 oct', hora: '05:06', chat: 'General', cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'General arranca en blanco con sus plantillas, y su barra es la del Dashboard',
    puntos: [
      "Quien nunca armó su General ve «¿Qué vas a crear hoy?» con las plantillas de General como páginas, igual que el Dashboard.",
      "La barra es la del Dashboard sin la búsqueda ni el filtro: el título, Editar y el ⋮. Editar habilita la edición en el lugar, sin modal.",
      "La API de MaKo y el análisis programado ven lo mismo que la pantalla: sin hojas hasta que se crea la primera.",
    ],
    commits: [{ sha: 'a98ab025', msg: 'Dashboard y General: la pantalla en blanco es «¿Qué vas a crear hoy?», y las plantillas se ven como páginas', lineas: 573, archivos: 9 }],
    archivos: ['app/general/page.tsx', 'app/dashboard/EditorInforme.tsx', 'lib/api-mako/areas/general.run.ts', 'lib/graficos-analisis-server.ts'],
  },
  {
    fecha: '14 oct', hora: '05:48', chat: 'General', cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Once puntos sobre General editándose: bloques que no sean texto, las tarjetas del Plan, OKRs y menos gráficos',
    pedido: "1. Si no tengo tabs no debería salir el botón de editar ni los 3 puntos. Lo mismo para dashboard... Y en el caso de dashboard tampoco el filtro ni la barra de busqueda.\n2. Pon muchos menos gráficos disponibles en General, justamente para eso ya tenemos una tab de dashboard.\n3. Diseña nuevamente todos los \"Bloque general\", la mayoría son solamente texto... Si no hay datos aún, se debería ver el placeholder siempre.\n4. Todos los desplegables de edición de un bloque y en general la edición del bloque hazlo mejor, porque no tiene muchas opciones...\n5. Debería poder editar el tamaño de un bloque desde cualquiera de sus costados, no solo de abajo a la derecha. Y elimina la flecha que aparece detrás del contorno azul... Esto también para dashboard.\n6. Tenemos un diseño de tarjetas para las tareas y proyectos del plan e hiciste cualquier cosa. Por favor rediseña completamente cada bloque.\n7. Hay bloques que en la configuración se deben definir allí mismo ciertas cosas... Como el objetivo del trimestre, que me gustaría que se llamen (OKRs) en lugar de objetivo del trimestre.\n8. El desplegable de \"Bloques de General\" que no tenga titulos internos y que sean una preview de lo que va a ser el gráfico, no solo texto.  Que sea un desplegable más gordo para poder ver de a 3 por fila.\n9. Revisa lo de añadir datos, porque si vamos a quitar la mayoría de gráficos, también hay que limitar los gráficos que se traen... Generalmente deberían ser los más importantes, confio en tu criterio.\n10. Elimina lo de insertar codigo, conclusiones de mako y acción.\n11. Elimina la tab que creé en el workspace de Leandro.",
    puntos: ["Con dos capturas de General editándose («Página 1»): los OKRs y las llamadas como una frase, «Prioridades del Plan» como una lista."],
  },
  {
    fecha: '14 oct', hora: '07:09', chat: 'General', cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'Los bloques de General rediseñados, con opciones, placeholder y las tarjetas del Plan',
    puntos: [
      "Cada bloque se dibuja en el navegador con sus opciones (cuántas, cómo se ve, cuántos días): el server manda los datos, no el bloque dibujado.",
      "Vacío, cada bloque muestra su placeholder: el mismo bloque con datos de ejemplo y la acción que lo llena.",
      "Prioridades y Proyectos del Plan usan las tarjetas del Plan; «Completar» marca la tarea con la escritura del teléfono.",
      "«Objetivos del trimestre» se llama OKRs, y se crean y editan desde la tarjeta, el placeholder y el panel.",
      "El menú «Bloques de General» va de a tres, con la vista previa de cada uno. General ofrece pocos gráficos y datos, y no inserta código, MaKo ni Acción.",
      "Se borró la única General guardada (la «Página 1» de la captura, en el workspace de Martín), con respaldo.",
    ],
    commits: [{ sha: 'c2cda971', msg: 'General: los bloques rediseñados con opciones, las tarjetas del Plan y los OKRs; el editor sin barra en blanco y con ocho bordes', lineas: 3936, archivos: 38 }],
    archivos: ['app/general/datos.ts', 'app/general/ProveedorGeneral.tsx', 'app/general/bloques/', 'lib/general-piezas.ts', 'app/dashboard/Elemento.tsx', 'app/plan/board/BoardShell.tsx', 'tests/general-bloques.test.ts'],
  },
  {
    fecha: '14 oct', hora: '11:54', chat: 'General', cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Ocho puntos sobre General: el diseño de los bloques, plantillas simples, la Meta objetivo aparte y la vista de celular',
    pedido: "1. Tienes que mejorar el diseño de los bloques. Mira como se ve todo... Mucho espacio en blanco en el template, bloques que no se ven, los gráficos no tienen sentido, mira como se rompe \"Leads por producto y etapa\" de abajo... Y pusiste ese dato 2 veces en diferentes gráficos... Luego elegiste mostrar \"Leads por origen\" y \"Pendientes del CRM\" cuando hay datos mucho más interesantes que se pueden mostrar, como datos de facturación, de Meta, etc... Tiene que tener criterio y preguntarse ¿Qué gráfico es el más importante?\n2. Tienes que mejorar ampliamente los templates, todos nacen con bloques que ocupan todo el ancho y quedan feos... No tienen títulos, no tienen separaciones claras, no se entienden... Piensa bien los templates.\n3. Rediseña completamente el grafico de \"Objetivo\" y \"Acción del día\", deben ser 2 gráficos diferentes... Y que el primero se llame \"Meta objetivo\". Y que no tenga un diseño dark... Los usuarios pueden elegir cambiarlo en la edición personalizada de cada bloque, pero por defecto tiene que ser como el resto.\n4. Veo que muchos bloques los copiaste de otros lados, como el de Prioridades, pero no están interactuando con el diseño de la página, revisalo.\n5. Los templates deben ser simples, mientras menos tenga y más claro esté de que trata ese template, mejor. Me interesa mucho que estén bien diseñados.\n6. Faltan bloques que podrías agregar, como el de \"Tareas Prioritarias\" que muestre las tareas prioritarias... Y que claro, se debe poder editar esas cosas, si quiero que muestre 1 tarea, 3 tareas, 5, 10, etc... Piensa en cada bloque y como debería poder editarse. Y piensa en que otros bloques no agregaste que servirían...\n7. En el dashboard de Mauricio creé la hoja \"Operación diaria\" y me da la opción de deshacer y me regresa a la hoja de \"General\" eso está mal... Si creo una hoja no debería aparecer el deshacer si no hago ninguna acción.\n8. En la edición, tal como lo tenemos en la edición de Landing Generator, tienes que poder visualizar en la versión mobile, etc... Eso es importante que se diseñe todo siempre pensado para ambos dispositivos... Dile esto también a dashboard.",
    puntos: ['Con tres capturas de una hoja recién creada desde una plantilla, en el workspace de Mauricio.'],
  },
  {
    fecha: '14 oct', hora: '12:05', chat: 'General', cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Las plantillas de «¿Qué vas a crear hoy?» fieles a lo que se va a ver, y sólo el título',
    pedido: "También, en la tab de ¿Que vas a hacer hoy?, los templates tienen que ser fieles a lo que se va a ver, no inventes esas imagenes, que se vea tal cual... Y elimina los subtitulos de cada template, solo el título",
    puntos: ['Llegó mientras se trabajaba la lista de ocho puntos de las 11:54.'],
  },
  {
    fecha: '14 oct', hora: '12:48', chat: 'General', cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'Los bloques son tarjetas de la hoja, la Meta objetivo y la Acción del día por separado, y plantillas simples',
    puntos: [
      'Cada bloque lleva el marco y el título de un gráfico de la hoja; adentro, nada de tarjetas dentro de la tarjeta. Las tarjetas del Plan toman los colores de la hoja.',
      '«Meta objetivo» y «Acción del día» son dos bloques, claros. Cada bloque ofrece «Fondo: Como la hoja / Oscuro».',
      'Bloques nuevos: «Tareas prioritarias» (1, 3, 5 o 10, en lista o tarjetas, con o sin proyecto) y «Próximos deadlines» (7, 14 o 30 días). «Proyectos del Plan» más compacto.',
      'Las plantillas, rehechas: una pregunta cada una, pocas piezas, títulos de parte, bloques de a dos con el mismo alto, la plata del mes y la inversión en anuncios en números, y ningún dato dos veces. Nueva: «Anuncios».',
      'Crear una hoja ya no deja un Deshacer. Editando, Escritorio / Tablet / Celular.',
      'En «¿Qué vas a crear hoy?», cada plantilla se ve como va a quedar (los gráficos de verdad, con números de ejemplo) y lleva sólo su título.',
    ],
    commits: [{ sha: 'e6818ee0', msg: 'General, tercera vuelta: los bloques son tarjetas de la hoja, la Meta objetivo y la Acción del día por separado, plantillas simples y la vista de celular al editar', lineas: 2679, archivos: 28 }],
    archivos: ['app/general/bloques/Meta.tsx', 'app/general/bloques/Plan.tsx', 'app/general/bloques/comun.tsx', 'app/dashboard/ElementoGeneral.tsx', 'lib/general-piezas.ts', 'lib/general-plantillas.ts', 'app/general/datos.ts', 'tests/general-bloques.test.ts'],
  },
  {
    fecha: '14 oct', hora: '13:26', chat: 'General', cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'General de un vistazo: textos enormes, mobile, Archivados y la marca de MaKo quieta',
    pedido: "1. Hay cosas que faltan... Las miniaturas y el título de abajo, deberían estar englobadas en un contendor, para que se entienda que ese título corresponde a esa miniatura... Y me gustaría que esos bloques tengan como una sombra, que se separe del fondo. Lo mismo para dashboard.\n2. El diseño mobile no se ve bien de los bloques... Tienes que rediseñar cada bloque para que se vea bien en mobile.\n3. Elimina\n4. Cuando clickeo en MaKo en la sidebar, me redirecciona a general, que no pase eso, que si clickeo MaKo no pase nada.\n5. Me debería dejar eliminar todas las hojas, también para dashboard. Y en el desplegable de las hojas, un texto que diga \"Archivados\" y ahí la opción de eliminar permanentemente. El \"archivados\" como un texto sutil abajo de todas las opciones, como lo tenemos en los filtros del CRM con \"Eliminar filtros\".\n6. Rediseña bloque por bloque, sacale una captura o algo y date feedback a vos mismo para perfeccionarlo en diseño. Por ejemplo, el bloque del semáforo tiene un espacio en blanco grande e innecesario... Haz esto también para mobile, que se vea bien. Y sobre todo lo que quiero, es que las plantillas de GENERAL, no se parezcan tanto a un dashboard... Está bien que tengan algún que otro gráfico, pero aquí en general todo tiene que ser más minimalista, textos enormes, cosas grandes, porque justamente es para ver de una pasada lo que el usuario quiera ver... Ya si quiere profundizar entra a dashboard.",
    puntos: ['Con dos capturas de «¿Qué vas a crear hoy?». El punto 3 llegó cortado («Elimina»): se le preguntó qué.'],
  },
  {
    fecha: '14 oct', hora: '13:58', chat: 'General', cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'Cada bloque con una cosa en grande, plantillas de bloques, y las hojas se archivan',
    puntos: [
      'Mirado en ws3 antes de tocar: la Acción del día con un hueco, el semáforo con media tarjeta en blanco, el funnel con diez etapas en cero y «El mes» con barra de scroll. Los cuatro, arreglados.',
      'Cada bloque tiene una cosa en grande y su letra se adapta al ancho del bloque: se ve bien en media hoja y en el celular. En el celular los números van de a dos.',
      'Las plantillas de General son bloques antes que gráficos: sin tablas ni series.',
      'Eliminar una hoja la archiva (también la última); «Archivados» al pie del desplegable, para restaurar o eliminar para siempre.',
      'Las plantillas de «¿Qué vas a crear hoy?» son tarjetas con sombra, y la marca de MaKo ya no lleva a General.',
    ],
    commits: [{ sha: 'c73755ec', msg: 'General, quinta vuelta: bloques de un vistazo y en grande, Archivados para las hojas, y la marca de MaKo sin navegar', lineas: 569, archivos: 25 }],
    archivos: ['app/general/bloques/', 'app/general/Cobranza.tsx', 'lib/general-plantillas.ts', 'app/dashboard/EditorInforme.tsx', 'app/dashboard/Cabecera.tsx', 'lib/graficos-catalogo.ts', 'tests/dashboard-archivadas.test.ts'],
  },
  {
    fecha: '14 oct', hora: '14:10', chat: 'General', cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Ignorar el punto 3 y rediseñar de verdad bloque por bloque',
    pedido: "Ignora el punto 3, y continua con el resto, porque no veo que hayas modificado bloque por bloque y las cosas que te pedi, no esta pusheado eso aun?",
    puntos: ['La quinta vuelta ya estaba en producción; lo que faltaba era mirar cada bloque en captura.'],
  },
  {
    fecha: '14 oct', hora: '14:16', chat: 'General', cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Las plantillas también: que se vean como la tab General, no como un dashboard',
    pedido: "No solo los bloques, sino los templates, con el feedback que te di que se vea como una tab general, no como un dashboard... Cosas grandes, textos grandes, que sea simple de leer",
  },
  {
    fecha: '14 oct', hora: '14:50', chat: 'General', cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'Cada bloque mirado en captura, listas sin filas cortadas y las plantillas con el tema General',
    puntos: [
      'Se dibujó cada bloque y cada plantilla con datos de ejemplo, en escritorio y a 364 px, y se corrigió lo que mostraban las capturas.',
      'Una lista muestra sólo las filas que entran enteras; las tarjetas que se repiten llenan el ancho; lo que no llena el alto va centrado.',
      'KPIs con el número en grande y su compromiso («14 de 20») y barras que llenan el bloque; tareas y proyectos que no se cortan en el celular.',
      'Las plantillas nacen con el tema nuevo «General»: sin bordes, la tarjeta flota y los números grandes. «Cobros» sin sus columnas por semana.',
      'Arreglo aparte: eliminar todas las hojas dejaba al Dashboard sin poder abrirse; la pantalla vuelve a leer el informe tal cual.',
    ],
    commits: [
      { sha: '78fe8132', msg: 'Dashboard: la pantalla vuelve a leer el informe crudo; sólo la API y los links lo ven sin hojas', lineas: 73, archivos: 9 },
      { sha: 'c23cb620', msg: 'General, sexta vuelta: bloque por bloque con capturas, listas sin filas cortadas y las plantillas con el tema General', lineas: 287, archivos: 16 },
    ],
    archivos: ['app/general/bloques/', 'app/general/KpisCard.tsx', 'app/general/Cobranza.tsx', 'lib/general-plantillas.ts', 'lib/graficos-temas.ts', 'lib/graficos-tablero.ts', 'tests/general-bloques.test.ts'],
  },
];
