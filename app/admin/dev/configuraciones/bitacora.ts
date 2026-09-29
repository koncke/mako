// =============================================================================
// Configuraciones — el registro de construcción del área
// =============================================================================
// Alcance: el contenedor de `/configuraciones` (una fila de tabs con
// Notificaciones, Identidades fiscales y Equipo cargando en el lugar) y, sobre
// todo, la tab de Notificaciones — que es donde se movió TODO en septiembre:
// qué avisa MaKo, por qué canal, a quién, con qué texto y cada cuánto insiste.
//
// ⚠️ El área vivía con el `vive[]` del contenedor solo, así que su panel de
// historial no veía ni uno de los once commits en los que el área se movió de
// verdad: el panel de notificaciones vive en `app/perfil/`, el catálogo de voz en
// `lib/avisos-catalogo.ts` y el store de plantillas en `lib/plantillas.ts`. Es
// exactamente el punto ciego que AGENTS.md describe —«¿qué archivo caliente no lo
// declara ninguna área?»— y por eso las rutas se sumaron con esta bitácora.
//
// De dónde salió esto: fecha, hora, sha y tamaño de `git log`/`git show
// --numstat` sobre las rutas del área; los `pedido` son TEXTUALES del chat; la
// cuenta, del marcador (`~/.claude/cuenta-activa.txt`). El nombre de la sesión
// sale de docs/chats.md, que llega hasta el 8/8 — de ahí en adelante va «—» en
// vez de un nombre inventado.
//
// NO es un changelog: va el motivo, la trampa y lo que quedó sin hacer.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'El contenedor con sus tabs', detalle: 'Una sola fila —Notificaciones, Identidades fiscales, Equipo— cargando en el lugar, más el link a Método · la tab NO viaja en la URL: arranca en Notificaciones por default, así que `/configuraciones` aterriza ahí', estado: 'hecha' },
  { titulo: 'Los mensajes se editan como se ven', detalle: 'La MISMA pantalla de `/mensajes` (`PlantillasView`) con el endpoint del cliente: lista a la izquierda, el chat de WhatsApp a la derecha, y el detalle para el texto, el interruptor y el flujo · parametrizar el endpoint en vez de copiar el componente', estado: 'hecha' },
  { titulo: 'UN interruptor por mensaje', detalle: 'Eran dos —`notification_prefs.avisos[id]` y `plantillas.store[id].enabled`—, consultados en cadena: apagar cualquiera silenciaba el aviso y prender uno solo no hacía nada · la migración de datos fue ANTES del cambio de código', estado: 'hecha' },
  { titulo: 'La lista blanca de lo que ve un cliente', detalle: 'SEIS avisos, elegidos a mano por el dueño, de 65 que tiene el catálogo · lista blanca y no marcar-lo-que-se-esconde: un aviso nuevo no se ve hasta que alguien lo agregue a propósito', estado: 'hecha' },
  { titulo: 'El techo de la insistencia', detalle: 'En dos capas: `sanearInsistir` en el código (5 veces, 30 min, ventana 8-21) y el CHECK de la mig 0180 · verificado en prod: un pedido de «99 veces cada 1 minuto» volvió como 5 cada 30', estado: 'hecha' },
  { titulo: 'Un canal a la vez, con su bandeja', detalle: 'Los tiles de WhatsApp y Email abren SU canal: el input de destinatarios de ese canal y debajo sus mensajes · los de WhatsApp como chat, los de email como una bandeja de correo, con el remitente leído de `/api/email/dominio` y nunca escrito a mano', estado: 'hecha' },
  { titulo: 'Los avisos administrativos, sólo del super-admin', detalle: 'Los 59 que no están en la lista blanca siguen saliendo y ya no se dibujan en la pantalla del cliente · se ven y se editan desde `/mensajes`', estado: 'hecha' },
  { titulo: 'La tab en la URL', detalle: '`ConfigInnerTabs` no lee `?tab=`, así que un link a una tab que no sea Notificaciones no existe · el molde para hacerlo es `app/admin/ui/` (leer en el server + `router.replace` sin scroll)', estado: 'cola' },
  { titulo: 'Email para los avisos, no sólo para los reportes', detalle: 'Hoy `lib/notify.ts` es el único `sendEmail` de los avisos y sólo manda los tres reportes · por eso la bandeja de email lista tres (uno para un cliente) y los otros cinco avisos de la lista blanca no tienen camino de correo', estado: 'cola' },
  { titulo: 'Prender `meta-cuenta-frenada` de verdad', detalle: 'Nace prendido desde el 29/09, y las transiciones de meta-health siguen sin cablear: el aviso no puede salir todavía · cuando se cablee, ya está encendido', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── 28 sep: la tarea del plan, y lo que el pedido NO decía ────────────────
  {
    fecha: '28 sep', hora: '16:20', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Notificaciones editables: qué se avisa, cada cuánto y qué lo dispara',
    pedido: 'Quiero implementar esta tarea de mi plan "Notificaciones editables: qué se avisa, cada cuánto y qué lo dispara" estoy seguro que hay otras tareas o detalles al respecto. Pero basicamente, me imagino que en la tab de notificaciones, dentro de configuraciones, los usuarios de MaKo puedan elegir no solo que mensajes quieren recibir en el grupo de WhatsApp, sino también como quieren recibirlo, editar el mensaje, la acción que lo dispara, que contiene el mensaje, etc...',
    puntos: [
      'Lo que el pedido no decía y apareció al abrir el código: el store de plantillas y flujos estaba **cableado a `OWNER_WS`** mientras `dispararEvento` corre con el workspace del evento. O sea que los flujos del dueño ya se estaban disparando en los grupos de los clientes. El pedido era «que el cliente pueda editar»; la precondición era que hubiera algo suyo que editar.',
      'La herencia quedó copy-on-write POR ENTRADA: el cliente lee el texto del dueño hasta que escribe el suyo, y `mutar` lee lo efectivo y escribe sólo lo propio. Materializar la entrada al tocarla habría congelado a cada cliente en el texto del día que abrió la pantalla.',
      '`resetTextoPlantilla` BORRA la clave, no escribe `texto: \'\'` — una cadena vacía es un override que gana sobre el texto del dueño, así que «volver al original» dejaba el mensaje en blanco.',
      'La insistencia («cada cuánto») nació con techo en las dos capas que pide AGENTS.md: `sanearInsistir` en un módulo sin `server-only` (para que haya test) y un CHECK en la mig 0180. Sin la segunda, cualquier camino nuevo a la tabla escribe lo que quiera.',
    ],
    commits: [
      { sha: '13b53c71', msg: 'avisos: los flujos son de cada cliente, y la insistencia tiene techo', lineas: 567, archivos: 10 },
      { sha: '3b901b21', msg: 'avisos: el cliente edita qué dice cada uno y si insiste, desde Configuraciones', lineas: 314, archivos: 4 },
    ],
    archivos: [
      'lib/plantillas.ts — el store por workspace con herencia del dueño',
      'lib/flujos-tipos.ts — el paso `insistir`, sus topes y `esAcuse` (sin `server-only`: es lo que permite el test)',
      'supabase/migrations/0180_insistencias.sql — la tabla, con `cada_min >= 30` y `veces between 1 and 5`',
      'app/api/cron/insistencias/route.ts — el drenaje, con compare-and-set para no mandar dos veces',
    ],
  },
  {
    fecha: '28 sep', hora: '18:22', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El editable tipo chat ya existe: copialo',
    pedido: 'Copia el editable que replica un chat de whatsapp en la tab de notificaciones... Lo tenemos en varios lugares. Para ver y editar los mensajes. Y veo que hay varios que no se pueden editar, todos se deberían poder.',
    puntos: [
      'La señal estaba en el plural: **«lo tenemos en varios lugares»**. Cuando el dueño nombra que algo ya existe en más de un lado, la tarea es encontrarlo y compartirlo, no escribirlo de nuevo.',
      'El primer intento fue un editor nuevo, colapsable por fila. El dueño lo rechazó con una captura: «No hiciste nada… te pedí que se viera como en /mensajes». Lo que hacía falta era parametrizar el `endpoint` de `PlantillasView` —mismo protocolo, otro guard: `getSesionAdmin` allá, admin del workspace acá— y montarla.',
      'De ahí salió también `app/whatsapp/_shared/BurbujaMaKo.tsx`: la burbuja estaba duplicada a mano en dos archivos, cada uno con un ⚠️ pidiendo sincronizar el otro. Dos copias con un comentario que pide sincronizarlas son dos copias que se van a desincronizar.',
    ],
    commits: [
      { sha: 'de0ee6ff', msg: 'avisos: el mensaje se ve como llega, y ahora se edita TODO', lineas: 336, archivos: 4 },
      { sha: 'def22db2', msg: 'notificaciones: la pantalla de /mensajes, no una copia', lineas: 548, archivos: 8 },
    ],
    archivos: [
      'app/agencia/PlantillasView.tsx — la pantalla compartida, ahora con `endpoint` por prop',
      'app/api/perfil/plantillas/route.ts — el mismo protocolo con el guard del cliente',
      'app/whatsapp/_shared/BurbujaMaKo.tsx — la burbuja, una sola vez',
    ],
  },
  {
    fecha: '28 sep', hora: '19:54', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Sólo «Dentro de la app», y muy muy pocos avisos por default',
    pedido: 'Solo debe permanecer "Dentro de la app" el resto todo se debe configurar dentro del nuevo bloque tipo chat. También te pido que filtres los avisos, ya que un usuario podrá crear nuevos. Ahora mismo son muchísimos, mas de lo necesario. Que por defecto cada cuenta traiga muy muy poquitos y que los pueda configurar. Se criterioso, tal vez hayan algunos avisos que no deban desaparecer',
    puntos: [
      '«Se criterioso, tal vez hayan algunos avisos que no deban desaparecer» era la parte difícil: al cambiar un default masivo, los avisos que el pedido NO nombra caen a apagado por omisión. Entre ellos estaban el Pixel caído y el anuncio retenido por Meta — apagarlos de rebote es una regresión en silencio, y quien la descubre es un cliente que se quedó sin enterarse. Se conservaron cuatro, enumerados a mano.',
      'Sacar los 15 toggles de WhatsApp habría RE-PRENDIDO cinco avisos que dos clientes reales habían silenciado (ws1: 1, ws13: 4), porque cada uno tenía dos interruptores y el que dejaba de leerse era justo el que ellos habían apagado. La migración de datos fue primero, en su propio script.',
      'Y había `{"enabled":true}` residuales del clon de configuración que hace `clonar-config` al crear un workspace: un override que nadie pidió pisa el default y lo vuelve mentira. El limpiador borra `{}` y `{enabled:true}`, y **no toca los `enabled:false`**, que sí son decisiones.',
    ],
    commits: [
      { sha: 'b0180aa7', msg: 'notificaciones: un solo interruptor por mensaje, y los 15 toggles se van', lineas: 140, archivos: 4 },
      { sha: 'e22a633e', msg: 'notificaciones: cinco mensajes prendidos, y la tab se queda con lo de la app', lineas: 371, archivos: 6 },
    ],
    archivos: [
      'lib/avisos-catalogo.ts — el campo `porDefecto` (`on` / `off` / `siempre`)',
      'scripts/migrar-apagados-a-plantillas.mjs — los 5 silenciados, migrados ANTES del cambio de código',
      'scripts/limpiar-overrides-redundantes.mjs — los residuales del clon, sin tocar los deliberados',
    ],
  },
  {
    fecha: '28 sep', hora: '23:21', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Los seis que ve un cliente, nombrados a mano',
    pedido: 'Deja a: 1. Reporte semanal (lunes) 2. Agendó, no confirmó y hay que llamarlo 3. Recordatorio de reunión próxima 4. Reunión ocurrió / grabación lista (Fathom) 5. Mensaje de WhatsApp entrante (al dueño) 6. Cuota vencida → cobrar — Elimina este que estaba prendido: Reporte diario matutino — El resto, junto a los que eliminaste dejalos en SuperAdmin, para que yo los vea, pero mejor si los usuarios tienen pocas opciones, así no confunde',
    puntos: [
      'Antes de esto se intentó marcar los 13 «administrativos» para esconderlos. Funcionaba y era frágil: obliga a acordarse de marcar cada aviso nuevo, y el que se olvide aparece en la pantalla de todos los clientes sin que nadie lo haya decidido. La lista blanca falla del lado seguro y se lee de un vistazo, que es lo que permite discutirla con el dueño.',
      'Y costó una corrección aparte: «Pero siguen apareciendo como editables para el usuario, te dije que los sacaras». **«No editable» no era lo pedido** — trece filas en solo-lectura llenan la pantalla de cosas que el cliente no puede tocar. Lo que desaparece es la FILA, no el aviso: los 59 siguen saliendo.',
      'De 65 en el catálogo, el cliente ve 6 y el super-admin sigue viendo los 65.',
    ],
    commits: [
      { sha: '508efea5', msg: 'avisos: los administrativos se leen pero no se editan, y menos texto en pantalla', lineas: 106, archivos: 4 },
      { sha: 'c548fe45', msg: 'avisos: los administrativos salen de la lista del cliente, no sólo del editor', lineas: 22, archivos: 2 },
      { sha: 'bc2395fe', msg: 'avisos: el cliente ve SEIS, elegidos a mano', lineas: 173, archivos: 5 },
    ],
    archivos: ['lib/avisos-catalogo.ts — `AVISOS_DEL_CLIENTE` y `esAvisoDelCliente`'],
  },
  {
    fecha: '28 sep', hora: '23:23', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'cosecha',
    titulo: 'Seis cosas de las notificaciones que no se deducen del código',
    puntos: [
      'Dos campos que apagan lo mismo son un switch que miente — y al unificar, la migración de datos va ANTES del código.',
      'Un override que nadie pidió (del clon de configuración, de una prueba) pisa el default y lo vuelve mentira.',
      'Para decidir qué ve un cliente: lista blanca, nunca marcar lo que se esconde.',
      'Cambiar un default masivo apaga cosas que nadie pidió apagar: lo que ya venía funcionando se enumera aparte.',
      'El editable tipo chat estaba copiado a mano en dos lados, con un comentario pidiendo sincronizarlos.',
      'Antes de construir, buscar dónde está: `/mensajes` ya hacía el 90% de lo pedido.',
    ],
    commits: [{ sha: '1c4b6264', msg: 'docs: la cosecha de las notificaciones editables', lineas: 100, archivos: 1 }],
    archivos: ['docs/hallazgos-comunicacion.md — las seis entradas'],
  },

  // ── 29 sep: los canales, de a uno ─────────────────────────────────────────
  {
    fecha: '29 sep', hora: '00:09', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Los tiles arriba, y el email con cara de email',
    pedido: '1. Prende meta-cuenta-frenada por defecto 2. Que "Dentro de la app" pase a estar arriba del todo. 3. En lugar de: Mensaje nuevo de WhatsApp. Mejor "Nuevo mensaje de WhatsApp". 4. Elimina "Mensaje nuevo del WhatsApp de la empresa" que todo entre en la misma que el anterior. 5. Que "Dentro de la app" sea como los cuadros de WhatsApp y Email, para que no ocupen tanto espacio como lista. También revisa si la app debería tener alguna otra notificación dentro de la app. 6. Elimina el texto "Los mensajes, como llegan", en su lugar que ahí estén los cuadros de WhatsApp y Email. Y que al darle GESTIONAR ahí aparezca el cuadro donde se configura el numero de telefono o el email en su defecto (que no aparezcan ambos, si le doy a WhatsApp ese input, y viceversa) abajo el chat. 7. Cuando le doy a gestionar Email debería permitirme gestionar esos templates. Pero en lugar de la UI de WhatsApp, que aparezca una UI de Gmail, puedes inspirarte en: https://www.figma.com/community/file/992130027176964480/gmail-ui-part-2-reading-composing-emails o en cualquiera que encuentres por la web, tipo diseño.',
    puntos: [
      'El punto 5 tenía una pregunta adentro («revisá si la app debería tener alguna otra notificación»). Medido: el provider dispara pop-up en TRES lugares y son dos avisos —`wa-mensaje` (dos canales de WhatsApp, un solo interruptor) y `wa-plantilla`—, los dos ya en el catálogo. Una tercera entrada sería un interruptor para algo que nunca pasa, que es lo que el propio catálogo prohíbe.',
      'El remitente de la bandeja de email se escribió de memoria: «MaKo <equipo@hola-mako.com>». Es exactamente lo correcto en el ws1 —es su `resend_from`— y **falso para cualquier cliente con su dominio conectado**, porque el De: es el negocio del cliente. Se pregunta a `/api/email/dominio`, y si no se puede leer la línea no se dibuja.',
      'Por email hoy salen sólo los tres REPORTES (`lib/notify.ts` es el único `sendEmail` de los avisos), así que la bandeja lista tres — para un cliente, uno. Listar los seis habría sido ofrecer editar un correo que no existe.',
      'Con el bloque de la app arriba de todo, su barra de «Guardar preferencias» quedaba detrás de 620 px de chat: los chips pasaron a guardar al toque, revirtiendo el chip si el server dice que no.',
      'Y el link de cada reporte apuntaba a `/perfil?tab=notificaciones`, una tab que ya no existe: aterrizaba en un cartel que dice que se configura en Configuraciones. Un link que funciona y no sirve, que ningún test ve.',
    ],
    commits: [{ sha: 'ef070b55', msg: 'notificaciones: los canales se gestionan de a uno, y el email se ve como un correo', lineas: 1495, archivos: 14 }],
    archivos: [
      'app/perfil/NotificacionesPanel.tsx — los tiles de la app arriba, los canales abajo, un canal abierto a la vez',
      'app/perfil/DestinatariosCanal.tsx — el editor de destinatarios de UN canal, en la página',
      'app/perfil/DestinatariosLista.tsx — la pieza compartida que quedó al retirarse el modal',
      'app/perfil/BandejaEmail.tsx — la bandeja de correo, con el remitente leído',
    ],
  },
  {
    fecha: '29 sep', hora: '00:09', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Los tests del modal retirado seguían en verde sobre código que nadie puede abrir',
    puntos: [
      '`DestinatariosModal` quedó con CERO call sites al mudarse el editor a la página, y **cuatro assertions seguían leyendo su archivo** — que el link del grupo se pueda copiar, que nada se rechace en silencio, que lo tipeado no se pierda. Las cuatro en verde, mientras el editor VIVO salía sin el botón de copiar: o sea sin la única salida cuando WhatsApp se niega a sumar a alguien por su configuración de privacidad.',
      'Un test que lee un archivo por su ruta no se entera de que ese archivo murió: contesta sobre el texto, no sobre el producto.',
      'Lo que el modal tenía de propio se enumeró antes de borrarlo: el link con su copiar, el aviso de quién no entró, la nota de que sacar a alguien de la lista no lo echa del grupo, y el rechazo del borrador a medio escribir. Sin el último, un número incompleto se manda igual, el saneo del server lo descarta y la pantalla dice «Guardado ✓».',
      'El test que murió con su sujeto (el `portalTo` del menú de ladas, que existía porque el menú quedaba detrás del modal) lo reemplaza uno que cuenta el CALL SITE y otro que pregunta si el modal volvió. Probado rompiéndolo en las dos direcciones: 10 pasan / 1 falla cada vez.',
    ],
    archivos: [
      'tests/destinatarios-telefono.test.ts — los guards, apuntados al editor vivo',
      'AGENTS.md — la regla: al reemplazar una pieza, sus tests se mueven con ella en el mismo commit',
    ],
  },
];
