// =============================================================================
// Área «operaciones» — el Centro de Operaciones, para la plataforma (15/10/2026)
// =============================================================================
// Pedido de Martín: «continua y termina el centro de operaciones». La pantalla es
// /admin/operaciones; el diseño, docs/diseno-centro-de-operaciones.md.
//
// ⚠️ SÓLO LECTURAS, Y SÓLO LA PLATAFORMA. Un pedido del Centro es un prompt que corre en la PC de
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
    titulo: 'Pedidos del Centro de Operaciones',
    descripcion: 'Los pedidos que Martín mandó desde el Centro de Operaciones a los chats de Claude Code de su PC, más recientes primero: a qué chat y de qué cuenta, el texto (recortado), el estado (escrito, entregando, entregado, no se pudo, no sé si llegó, hecho, comprobado, cancelado), el motivo si no salió y el cierre que dejó el chat (qué se decidió, qué quedó hecho, cómo se comprobó, qué sigue). Para MANDAR un pedido no hay operación: se firma en /admin/operaciones con la clave del dispositivo.',
    parametros: [
      { nombre: 'estado', rotulo: 'Estado', tipo: 'string', enum: ESTADOS, descripcion: 'filtra por estado.' },
      { nombre: 'limite', rotulo: 'Cuántos', tipo: 'number', entero: true, minimo: 1, maximo: 50, descripcion: 'cuántos devolver (default 20).' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: PLATAFORMA,
  },
  {
    id: 'ver_carteros_operaciones', area: 'operaciones', tipo: 'lectura',
    titulo: 'Carteros del Centro de Operaciones',
    descripcion: 'El estado de los carteros del Centro de Operaciones, uno por cuenta de Claude: cuándo pasó cada uno por última vez, si está vivo, cuántos chats tiene abiertos y cuáles, y cuántas claves de firma acepta. Sirve para contestar «¿por qué no salió mi pedido?»: si el cartero de esa cuenta no pasa, el pedido espera.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: PLATAFORMA,
  },
];
