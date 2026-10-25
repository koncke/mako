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
    descripcion: 'Los chats del Ops Center que dicen «Completado»: su último «Ya está» todavía no tiene el ✓ de Martín (lo mismo que la fila y el bloque de arriba de la caja). Por cada uno: el chat y su cuenta, cuándo terminó, lo que respondía (`pedido`: lo último que le pidió Martín, o el chat que se lo mandó, que dice `pidio`), la respuesta ENTERA del chat y la página para revisarlo. Para darlo por visto, `marcar_visto_operaciones`.',
    parametros: [
      { nombre: 'chat', rotulo: 'Chat', tipo: 'string', descripcion: 'filtra por el nombre del chat («CRM», «Cerebro»).' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: PLATAFORMA,
  },
  {
    id: 'marcar_visto_operaciones', area: 'operaciones', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Dar por visto un Completado',
    descripcion: 'Le pone el ✓ al último «Completado» de un chat del Ops Center, como «Ya lo vi» en la pantalla: el chat deja de decir «Completado» y el bloque de arriba de su caja se va. No le manda nada al chat. Antes, `ver_completados_operaciones` dice cuáles esperan.',
    parametros: [
      { nombre: 'chat', rotulo: 'Chat', tipo: 'string', obligatorio: true, descripcion: 'el nombre del chat que dice «Completado» («CRM», «Cerebro»).' },
    ],
    escribe: 'el ✓ del último «Completado» de ese chat (operaciones.ya-vistos, en la plataforma); marcar sólo avanza',
    canales: SIN_HTTP, costo: 'gratis', gating: PLATAFORMA,
  },
];
