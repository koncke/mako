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
  { titulo: 'El Centro en el teléfono', detalle: '/admin/operaciones en un celular cae hoy en «se usa en la computadora»', estado: 'cola' },
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
];
