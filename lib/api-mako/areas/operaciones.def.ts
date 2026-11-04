// =============================================================================
// Área «operaciones» — el Centro de Operaciones, para la plataforma (15/10/2026)
// =============================================================================
// Pedido de Martín: «continua y termina el centro de operaciones». La pantalla es
// /admin/operaciones; el diseño, docs/diseno-centro-de-operaciones.md.
//
// ⚠️ LECTURAS, Y SÓLO LA PLATAFORMA. Lo único que se CAMBIA es el ✓ de un «Completado» (25/10/2026, «Todo, todo siempre tiene
//    que ir a la API, todo MaKo se debe poder utilizar por API»): no manda nada a la PC, sólo dice que Martín ya lo vio.
// Un pedido del Centro es un prompt que corre en la PC de
// Martín, así que:
//   · todo va con `soloPlataforma` + `rolMinimo: 'admin'` (un admin de cliente no lo ve: para él
//     estas operaciones no existen);
//   · nada sale por HTTP (`canales` sin 'http'): los textos son prompts y el estado es de la PC;
//   · MANDAR un pedido NO está en el registro, a propósito: exige la FIRMA del dispositivo de
//     Martín (WebCrypto, una clave que el servidor no tiene), y ningún canal puede firmar. Si algún
//     día MaKo propone un pedido desde un chat, va con `confirmacion: 'pantalla'` y se firma en
//     /admin/operaciones — nunca una operación que encole sola.
// =============================================================================

import type { Gating, OperacionDef } from '../tipos';
import { ESTADOS } from '../../operaciones-reglas';

const SIN_HTTP = ['whatsapp', 'app'] as const;
const PLATAFORMA: Gating = { rolMinimo: 'admin', soloPlataforma: true };

export const DEFS: readonly OperacionDef[] = [
  {
    id: 'ver_pedidos_operaciones', area: 'operaciones', tipo: 'lectura',
    titulo: 'Trabajos del Centro de Operaciones',
    descripcion: 'Los trabajos que Martín mandó desde el Centro de Operaciones a los chats de Claude Code de su PC, más recientes primero: a qué chat y de qué cuenta, el texto (recortado), el estado (escrito, entregando, entregado, no se pudo, no sé si llegó, hecho, comprobado, cancelado), el motivo si no salió y el cierre que dejó el chat (qué se decidió, qué quedó hecho, cómo se comprobó, qué sigue). Para MANDAR un trabajo no hay operación: se firma en /admin/operaciones con la clave del dispositivo. En la pantalla se llaman «trabajos»: «pedido» es lo que Martín pide en un chat.',
    parametros: [
      { nombre: 'estado', rotulo: 'Estado', tipo: 'string', enum: ESTADOS, descripcion: 'filtra por estado.' },
      { nombre: 'limite', rotulo: 'Cuántos', tipo: 'number', entero: true, minimo: 1, maximo: 50, descripcion: 'cuántos devolver (default 20).' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: PLATAFORMA,
  },
  {
    id: 'ver_carteros_operaciones', area: 'operaciones', tipo: 'lectura',
    titulo: 'Runners del Centro de Operaciones',
    descripcion: 'El estado de los Runners del Centro de Operaciones (el proceso de la PC que entrega lo que Martín escribe a sus chats de Claude), uno por cuenta: cuándo se conectó cada uno por última vez, si está activo, cuántos chats tiene abiertos y cuáles, y cuántos Tokens de dispositivo acepta. Sirve para contestar «¿por qué no salió mi trabajo?»: si el Runner de esa cuenta no está activo, el trabajo espera hasta que Martín abra el chat Runner en la app de Claude.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: PLATAFORMA,
  },
  {
    id: 'ver_completados_operaciones', area: 'operaciones', tipo: 'lectura',
    titulo: 'Completados que esperan tu ✓',
    descripcion: 'Los chats del Ops Center que dicen «Completado»: su último «Ya está» todavía no tiene el ✓ de Martín (lo mismo que la fila y el bloque de arriba de la caja). Por cada uno: el chat y su cuenta, cuándo terminó, lo que respondía (`pedido`: lo último que le pidió Martín, o el chat que se lo mandó, que dice `pidio`), la respuesta ENTERA del chat y la página para revisarlo; y en `anteriores`, los de antes que tampoco vio, con lo mismo (el bloque los muestra de a uno, con flechas). Para darlo por visto, `marcar_visto_operaciones`.',
    parametros: [
      { nombre: 'chat', rotulo: 'Chat', tipo: 'string', descripcion: 'filtra por el nombre del chat («CRM», «Cerebro»).' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: PLATAFORMA,
  },
  {
    id: 'ver_mensajes_operaciones', area: 'operaciones', tipo: 'lectura',
    // La charla de Martín con los chats del Ops Center de la plataforma: no lee leads, conversaciones, llamadas ni cobros.
    datosDeClientes: false,
    titulo: 'Mensajes de un chat del Ops Center',
    descripcion: 'La conversación de un chat del Ops Center como se ve en la pantalla, la más reciente al final: lo que le mandó Martín (desde el Ops Center o la app de Claude), lo que contestó el chat, y sus preguntas con sus opciones y lo que contestó Martín (`abierta` si espera). Una nota de voz de Martín sale como `audio`, con lo que dura y su transcripción aparte. Los «Avance» seguidos (lo que el chat le contestó a otro chat) van juntos en un grupo: el último entero y los anteriores con su hora y su primera oración, como la burbuja de la pantalla. NO trae las decisiones de la Ticketera ni los pedidos del Plan que también se ven en ese chat. En qué está cada envío: `ver_pedidos_operaciones`.',
    parametros: [
      { nombre: 'chat', rotulo: 'Chat', tipo: 'string', obligatorio: true, descripcion: 'el nombre del chat («Cerebro», «CRM»).' },
      { nombre: 'limite', rotulo: 'Cuántos', tipo: 'number', entero: true, minimo: 1, maximo: 100, descripcion: 'cuántos mensajes o grupos, los últimos (default 30).' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: PLATAFORMA,
  },
  {
    id: 'marcar_visto_operaciones', area: 'operaciones', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Dar por visto un Completado',
    descripcion: 'Le pone el ✓ al último «Completado» de un chat del Ops Center, y con él a los de antes (el ✓ es «hasta éste»), como «Ya lo vi» en el último de la pantalla: el chat deja de decir «Completado» y el bloque de arriba de su caja se va. No le manda nada al chat. Antes, `ver_completados_operaciones` dice cuáles esperan.',
    parametros: [
      { nombre: 'chat', rotulo: 'Chat', tipo: 'string', obligatorio: true, descripcion: 'el nombre del chat que dice «Completado» («CRM», «Cerebro»).' },
    ],
    escribe: 'el ✓ del último «Completado» de ese chat (operaciones.ya-vistos, en la plataforma); marcar sólo avanza',
    canales: SIN_HTTP, costo: 'gratis', gating: PLATAFORMA,
  },
  // ── DEBUG de un negocio desde el grupo de SuperAdmin (29/10/2026, Martín: «mira el grupo de SuperAdmin cuando le pedí que
  // debuguee cosas») ── Le reenvió a MaKo la consulta de un cliente que no podía conectar Facebook, y MaKo le dio un consejo
  // genérico: ninguna herramienta podía leer OTRO negocio (todas usan el del grupo). Ésta lee, de uno: su plan y su estado, sus
  // integraciones, su IA, su conexión de Meta (Zernio), sus errores de la app de 7 días y sus tickets abiertos. Sólo lectura, sólo
  // la plataforma, sin HTTP: son datos de cualquier negocio.
  {
    id: 'diagnosticar_negocio', area: 'operaciones', tipo: 'lectura',
    titulo: 'Diagnosticar un negocio',
    descripcion: 'Sólo para la plataforma: mira con datos el estado de UN negocio cliente para debuguear lo que le pasa: su plan y su estado (en riesgo, días sin entrar, onboarding), sus integraciones con su estado, su IA, su conexión de Meta por Zernio (cuenta, píxel, página), los errores que la app registró en sus pantallas en 7 días y sus tickets abiertos. Úsala cuando Martín pide ver qué le pasa a un cliente o reenvía la consulta de uno. Si el nombre calza con varios, devuelve los candidatos: pregunta cuál.',
    parametros: [
      { nombre: 'negocio', rotulo: 'Negocio', tipo: 'string', obligatorio: true, max: 120, descripcion: 'el número del negocio («11») o su nombre o el de su dueño («Leila», «Fiesta Music»).', ejemplo: 'Leila' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: PLATAFORMA,
  },
  // ── Las aprobaciones de las apps de MaKo (4/11/2026, Martín: «crea un script que me vaya avisando de todas las notficaciones
  // de aprobaciones pendientes…») ── El vigía revisa cada hora y avisa solo cuando algo cambia (lib/vigia-aprobaciones-server.ts);
  // ésta es la lista cuando Martín la pide. Lee lo GUARDADO: no le pregunta nada a las tiendas ni avisa. Sin HTTP: es de la plataforma.
  {
    id: 'ver_aprobaciones_pendientes', area: 'operaciones', tipo: 'lectura',
    // El estado de las tiendas y de Meta para las apps de MaKo: no lee leads, conversaciones, llamadas ni cobros.
    datosDeClientes: false,
    titulo: 'Aprobaciones de App Store, Google Play y Meta',
    descripcion: 'Sólo para la plataforma: en qué está cada aprobación que MaKo espera de otra empresa. La app de iPhone (App Store), la de Android (Google Play: prueba cerrada, producción y la cuenta), la extensión de Chrome (Chrome Web Store), los permisos y verificaciones de Meta, la app de Google, los dominios de correo (Resend) y el certificado de Windows. Por cada una: aprobada, en revisión, rechazada, «piden algo», sin enviar, o «hay que mirarlo a mano», con su link, desde cuándo y qué credencial falta para leerla sola. Sale de la última revisión del vigía, que corre cada hora y avisa solo cuando algo cambia.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: PLATAFORMA,
  },
];
