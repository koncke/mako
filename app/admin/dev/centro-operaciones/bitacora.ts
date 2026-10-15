// =============================================================================
// Centro de Operaciones — el registro de construcción (/admin/operaciones + el cartero)
// =============================================================================
// ESTO NO ES UN CHANGELOG. El changelog está en `git log`. Acá va lo que git no guarda: qué
// pidió Martín con sus palabras y por qué se resolvió así. El diseño vive en
// docs/diseno-centro-de-operaciones.md; lo aprendido, en docs/hallazgos-operaciones.md.
//
// Los pedidos de Martín se los hizo al chat «Estrategia 3 cuentas», que los pasó a este; la hora
// de cada prompt es la de su commit o, si no hubo, la de cuando llegó a este chat (hora de
// Argentina). Las de la implementación, las del commit. Se agrega AL FINAL del array.

import type { Hito, Parte } from '../_registro/tipos';

const CH = 'Centro de Operaciones';
const ESTRATEGIA = 'Estrategia 3 cuentas';

/** Las fases del área y en qué anda cada una. */
export const PARTES: Parte[] = [
  { titulo: 'La cola con la firma', detalle: 'Escribir un pedido, firmarlo en el dispositivo, que un cartero lo entregue a un chat de Claude y que vuelva su cierre', estado: 'sigue' },
  { titulo: 'Un cartero por cuenta', detalle: 'Las tres cuentas corren a la vez: la app y dos terminales, cada una con su chat Cartero', estado: 'sigue' },
  { titulo: 'El Centro en el teléfono', detalle: 'Para mirar, con su botón en More → «Super admin»; mandar sigue siendo de la computadora', estado: 'hecha' },
  { titulo: 'Progreso', detalle: 'En curso, Pedidos y Pushes desde las bitácoras y Vercel; los chats abiertos y lo sin subir llegan con el cartero', estado: 'sigue' },
  { titulo: 'La cuota de las tres cuentas', detalle: 'Las tres ventanas (5 h, semanal y por modelo), cada una con su fecha', estado: 'cola' },
  { titulo: 'El señalador', detalle: 'Elegir un elemento de la pantalla en vez de mandar una captura', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '15 oct', hora: '01:34', chat: ESTRATEGIA, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Crear el Centro de Operaciones',
    pedido: 'Crea ese centro de operaciones, es lo más prioritario de todo… Que no solamente se conecte a las 3 cuentas, sino que pueda gestionar el USO y advertir cuando se está acercando al límite… Que gestione solo el guardado de contexto para las demás cuentas y que también se preocupe por ahorrar tokens, por ejemplo si mando una tarea fácil, que le diga a los chats qué modelo de IA deben usar… que pueda tener una funcionalidad de ventana emergente o algo así del chat, y que yo le pueda indicar QUÉ quiero cambiar como si estuviera eligiendo elementos dentro de cada tab, como si estuviera con F12… Fíjate que todo el tiempo te estoy pasando capturas, esto lo evitaría… Tal vez incluso que organice los chats para cada cuenta… Así les cuesta menos contexto.',
    puntos: ['La hora es la del commit del diseño (222443577), que lo citó textual.'],
  },
  {
    fecha: '15 oct', hora: '02:01', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'investigacion',
    titulo: 'El diseño corregido con lo medido',
    puntos: [
      'La app corre una cuenta por vez: cada una tiene su carpeta de chats y sus ventanas de actividad no se pisan.',
      'Un script no puede escribirle a una sesión: los named pipes del registro son el protocolo interno de Claude Code. El cartero son el script y un chat que entrega.',
      'Una fila de la cola es un prompt en la PC: cada pedido va firmado con una clave que el servidor no tiene.',
      'De rebote: la carpeta de la app dice la cuenta (tres relojes de reinicio semanal en 173 lecturas), y unos 200 commits del 09/10 al 10/10 estaban firmados con la cuenta equivocada.',
    ],
    commits: [{ sha: '253550075', msg: 'docs: el Centro de Operaciones corregido con lo medido', lineas: 496, archivos: 4 }],
  },
  {
    fecha: '15 oct', hora: '02:02', chat: ESTRATEGIA, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'El video del segundo cerebro',
    pedido: 'Investiga también este vídeo https://youtu.be/rracqzwV4ZY — o incluso otros vídeos o info por la web de cómo aprovechar este centro de operaciones con "El segundo cerebro".',
    puntos: ['Llegó a este chat a las 02:02.'],
  },
  {
    fecha: '15 oct', hora: '02:10', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'investigacion',
    titulo: 'Los 10 principios y qué cambian',
    puntos: [
      'El video es de Claudio Conde (14/10), no de Tiago Forte. En voz alta no numera los principios: son sus diapositivas 05 a 14.',
      'Cambian el Centro: el cierre de cuatro renglones que vuelve de cada chat, los estados escrito ≠ entregado ≠ hecho ≠ comprobado y el «sólo esto / y de ahora en más».',
      'Lo que más tokens ahorra es achicar AGENTS.md: unos 140.000 tokens cargados en cada chat y en cada subagente.',
    ],
    commits: [{ sha: '3314dfbc6', msg: 'docs: el Centro con lo que suma el video del segundo cerebro', lineas: 91, archivos: 2 }],
  },
  {
    fecha: '15 oct', hora: '02:34', chat: ESTRATEGIA, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Terminar el Centro',
    pedido: 'continua y termina el centro de operaciones, es lo que más me interesa ahora',
    puntos: ['Llegó a este chat a las 02:34. Las tres decisiones abiertas se tomaron por la recomendada: la cola primero, una cuenta por vez y el pedido firmado.'],
  },
  {
    fecha: '15 oct', hora: '02:46', chat: ESTRATEGIA, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Las tres cuentas activas',
    pedido: 'Con respecto a una cuenta por vez... Quiero que estén las 3 activas, habíamos hablado de eso justamente... Tal vez no en la app de Claude Desktop, pero con PowerShell o algo así',
    puntos: [
      'Llegó a este chat a las 02:46 y cambió una decisión: un cartero POR CUENTA, que entrega adentro de la suya.',
      'Medido: cada chat pesa ~520 MB comprometidos en la app o en la terminal; lo que pesa es la cantidad, no la cuenta.',
    ],
  },
  {
    fecha: '15 oct', hora: '02:55', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'Etapa 1: la cola de pedidos firmados',
    puntos: [
      'La pantalla firma cada pedido con una clave WebCrypto que no se puede exportar; el servidor guarda el texto firmado tal cual.',
      'La ruta del cartero está en PUBLICOS por su token y reclama con compare-and-set sólo para los chats vivos que sube ese cartero.',
      'El cartero verifica la firma en código contra las claves cargadas a mano y lleva su registro de lo entregado.',
    ],
    commits: [{ sha: 'a23b7fbfe', msg: 'Centro de Operaciones, etapa 1: la cola de pedidos firmados y un cartero por cuenta', lineas: 1668, archivos: 12 }],
    archivos: [
      'app/admin/operaciones/ — la pantalla, sus acciones y la clave del dispositivo',
      'lib/operaciones-reglas.ts — el pedido firmado, los estados y puedeOperar',
      'lib/operaciones.ts — la cola y los carteros en la base',
      'app/api/operaciones/cartero/route.ts — la puerta del cartero',
      'scripts/operaciones/cartero.mjs — el cartero de la PC',
      'supabase/migrations/0285_centro_operaciones.sql — las tres tablas',
    ],
  },
  {
    fecha: '15 oct', hora: '03:29', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'El área en la API y la prueba de punta a punta',
    puntos: [
      'Dos lecturas en el registro (la cola y los carteros), sólo para la plataforma y sin HTTP. Mandar un pedido no está: exige la firma del dispositivo.',
      'Un pedido firmado en Chrome llegó al chat «Estrategia 3 cuentas» y quedó «entregado»; otro, al mismo chat que entregaba, quedó «no se pudo» con su motivo.',
      'El test corre el cartero real contra un servidor que miente: sale sólo lo firmado y no entregado. 9 roturas cazadas.',
    ],
    commits: [{ sha: '3a38b2744', msg: 'Centro de Operaciones: el área en la API de MaKo, el cartero contra un servidor que miente', lineas: 210, archivos: 8 }],
  },
  {
    fecha: '15 oct', hora: '05:01', chat: ESTRATEGIA, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'La pantalla se rechaza: copiar una app',
    pedido: 'te pido nuevamente que investigue y copie completamente el diseño de otra app similar… Por favor que sea como regla, sino estamos siempre con lo mismo',
    puntos: [
      'Rechazó el diseño del Centro («horrible») y la regla quedó en AGENTS.md: ninguna pantalla se diseña de cero.',
      'Lo que marcó: el cartel ámbar a lo ancho, el desplegable muerto, «Sólo esto» lleno al lado de un texto, el «Firmar y mandar» gigante y apagado, tres secciones sin jerarquía.',
    ],
  },
  {
    fecha: '15 oct', hora: '05:01', chat: ESTRATEGIA, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Las tabs de super admin',
    pedido: 'Y también me molesta bastante tener tantas tabs desorganizadas en super admin... Hay muchas que las podríamos eliminar y otras que podrían ser una sola... Revisa eso.',
    puntos: ['Con la condición de no borrar ni mover nada hasta que él valide la tabla.'],
  },
  {
    fecha: '15 oct', hora: '05:27', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'investigacion',
    titulo: 'El Centro copiado de GitHub Actions, y la tabla de tabs',
    puntos: [
      'La lista de pedidos manda; «Nuevo pedido» es un panel que se abre sobre el chat elegido, como «Run workflow» sobre un workflow.',
      'Fuente: la pestaña Actions de github.com/vercel/next.js y la guía oficial del panel de «Run workflow», que sólo se ve con sesión.',
      'Tabs: Admin pasa de 13 a 9 y Dev de 55 renglones a 3. Dos fusiones («MaKo en WhatsApp» y «Cerebro de MaKo») y dos que se van (Agente de los clientes, Grafo).',
      'Esperan la validación de Martín: no se tocó la pantalla ni la barra.',
    ],
    archivos: [
      'docs/prototipos/centro-operaciones.html — la propuesta viva, computadora y celular, con la tabla al pie',
      'docs/hallazgos-operaciones.md — qué se copió y de dónde',
      'docs/hallazgos-ui.md — lo que midió la auditoría de tabs',
    ],
  },
  {
    fecha: '15 oct', hora: '05:45', chat: ESTRATEGIA, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Que la respuesta llegue sola',
    pedido: 'Y ya respondí todas esas tarjetas y al parecer no te llegó... No sirve de nada la ticketera si no te llega',
    puntos: [
      'Había 29 respuestas en la base que nadie empujaba; el coordinador las repartió a mano a nueve chats.',
      'El encargo: que el Centro avise al chat que preguntó, aunque esté cerrado, y una sola vez.',
    ],
  },
  {
    fecha: '15 oct', hora: '06:09', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'El cartero avisa las respuestas de la Ticketera',
    puntos: [
      'Cada tarjeta guarda la sesión que pregunta (destino): con el nombre del chat no se sabía a quién avisar.',
      'Se avisa una vez por respuesta, y otra vez si cambia; si el chat está cerrado, espera a que se abra.',
      'El aviso lo arma el cartero con el ref y un texto fijo: de la base no viaja nada, así que no necesita firma.',
      'Probado contra producción con el cartero real: entregado al coordinador, sin repetir, y reclamado de nuevo al cambiar la respuesta.',
    ],
    archivos: [
      'lib/decisiones-aviso.ts — cuándo y a quién se avisa',
      'lib/operaciones.ts — el reclamo en la vuelta del cartero',
      'scripts/operaciones/cartero.mjs — el mensaje del aviso',
      'supabase/migrations/0288_decisiones_aviso.sql — destino y el estado del aviso',
    ],
  },
  {
    fecha: '15 oct', hora: '07:50', chat: ESTRATEGIA, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'El Centro en el teléfono',
    pedido: 'Y quiero que todo se pueda ver en mobile y esta bien diseñado, lo del Centro',
    puntos: ['Y al rato: «No veo el botón del Centro en mobile». Desde el teléfono, sólo para mirar: firmar ahí es un extra.'],
  },
  {
    fecha: '15 oct', hora: '12:01', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'El Centro en el teléfono, para mirar',
    puntos: [
      'La lista de pedidos con su estado, el detalle de cada uno y los carteros, copiado de la lista de GitHub Actions en el teléfono.',
      'Su botón en More → «Super admin», al lado de la Ticketera; la sección se apaga mientras se mira a un cliente.',
      'Faltaba la pantalla, no la puerta: la Ticketera ya tenía su botón desde el 14/10.',
    ],
    archivos: [
      'app/m/operaciones/ — la pantalla del teléfono',
      'app/m/mas/page.tsx — la sección «Super admin»',
      'lib/movil-rutas.ts — /admin/operaciones ↔ /m/operaciones',
    ],
  },
  {
    fecha: '15 oct', hora: '11:24', chat: ESTRATEGIA, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Progreso: lo que estamos trabajando, mis pedidos y los pushes',
    pedido: 'Para que sea más fácil de leer, quiero que dentro del Centro, construyas una sección de "Progreso" donde se vea lo que estamos trabajando actualmente, mis pedidos y los pushes. Hazlo tipo tabla y que este BIEN diseñado. Investiga ejemplos y copia.',
    puntos: ['El coordinador lo pasó con «escritorio y celular en la misma tanda», empezando por En curso y Pushes, y que sirva sin el token del cartero.'],
  },
  {
    fecha: '15 oct', hora: '13:21', chat: ESTRATEGIA, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Ver los pendientes y poder refrescar',
    pedido: 'Sigo sin ver los pendientes y poder refrescar en el centro!!! Solucionalo con urgencia por fsvor, muchas veces te lo pedi',
    puntos: [],
  },
  {
    fecha: '15 oct', hora: '14:08', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'Progreso en el Centro: En curso, Pedidos y Pushes, en la computadora y en el teléfono',
    puntos: [
      'Cuatro pestañas: En curso (qué área se movió y qué le queda), Pedidos (pendiente, en curso, hecho, con lo que salió de cada uno), Pushes (lo que llegó a producción) y Trabajos (la cola firmada de siempre).',
      'Copiado de la vista de tabla de GitHub Projects, la lista de deployments de Vercel y el «Activity» de un issue de Linear; en el teléfono, la lista de GitHub Actions.',
      'Sale de las bitácoras y de Vercel, así que anda sin el cartero; lo que está en la PC sin subir llega cuando el cartero se instale.',
      'Decía 78 pendientes y eran 7: los chats anotan los pedidos en tanda, y ahora la tanda comparte lo que se hizo después.',
      'Refrescar: tirar hacia abajo en el teléfono, «Actualizar» en la computadora, sin perder la pestaña.',
    ],
    archivos: [
      'lib/progreso-reglas.ts — qué es pendiente, en curso y hecho, y los pushes de Vercel',
      'lib/progreso.ts — leer las bitácoras y la API de Vercel',
      'app/admin/operaciones/CentroPestanas.tsx — las pestañas y Actualizar',
      'app/admin/operaciones/Progreso.tsx — las tablas de la computadora',
      'app/m/operaciones/ProgresoMovil.tsx — las listas del teléfono',
    ],
  },
  // El cartero va ANTES del pedido de las 14:18 a propósito: la respuesta de un pedido es lo que le sigue
  // (lib/progreso-reglas.ts → cadenas), y la instalación no responde a ese pedido.
  {
    fecha: '15 oct', hora: '14:30', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'El cartero de claude1, instalado',
    puntos: [
      'Con el token que acuñó Martín: la primera vuelta vio 53 chats de la cuenta y 2 abiertos, sin nada que entregar.',
      'Falta el chat «Cartero» con su cron, que lo abre Martín: sin él nada se entrega solo y el cartero se ve inactivo.',
      'Con el chat de destino cerrado, el aviso espera sin gastar intentos.',
    ],
  },
  {
    fecha: '15 oct', hora: '14:18', chat: ESTRATEGIA, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Progreso: lo que pedí, con su estado y sus pushes',
    pedido: 'Lo que quiero ver allí es lo que te pedí, los pushes de lo terminado, los pendientes que estamos trabajando ahora mismo, las cosas que ya están terminadas, empezadas, etc...',
    puntos: ['El coordinador lo leyó como «la unidad es el pedido»: los pushes son la prueba de lo terminado, no una lista aparte.'],
  },
  {
    fecha: '15 oct', hora: '14:57', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'Progreso con el pedido primero: trabajando ahora, sin empezar, empezado y terminado',
    puntos: [
      'Pedidos es la pestaña de entrada, en cuatro grupos, y cada fila muestra su camino: anotado, lo tomó un chat, en producción.',
      'Terminado es «en producción», y eso es exacto: la pantalla lee la bitácora de la versión publicada.',
      'En qué push llegó cada uno no se puede decir sin git: por la hora acertaba 110 de 202, y por la punta del último commit, 0 de 88. Lo exacto (el commit que encabeza un push) va en el detalle y en Pushes.',
      '«En curso» por área pasó a llamarse Áreas.',
    ],
    archivos: [
      'lib/progreso-reglas.ts — los grupos y el push exacto de cada pedido',
      'app/admin/operaciones/Progreso.tsx — el camino en la fila',
      'app/m/operaciones/ProgresoMovil.tsx — lo mismo en el teléfono',
    ],
  },
];
