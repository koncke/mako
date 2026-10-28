// =============================================================================
// pedidos-del-negocio — lo que el negocio YA le pidió o reportó al equipo, en el turno del grupo (28/10/2026, el diagnóstico
// del Cerebro, F2b)
// =============================================================================
// El turno no veía los tickets del negocio: `mis_tickets` filtra por el email de quien escribe y viaja sólo si el mensaje
// nombra el área de MaKo. El 28/10 el pedido de Leandro (responder en público los comentarios de Instagram, como ManyChat) ya
// estaba EN CURSO, y el equipo tuvo que aclarar «es lo que estamos construyendo ahora mismo». Con el pedido entendido, la regla
// de «no existe» llevaba a un [[no-existe]] y a un ticket DUPLICADO.
//
// El bloque va en el system del grupo; la marca `[[ya-pedido: #N]]` (NUCLEO_GRUPO, regla 6) suma el mensaje a ESE ticket en vez
// de abrir otro. ⚠️ Una marca con un número que no es de un pedido abierto de ESTE negocio se borra igual: nunca le llega al
// cliente, y nunca se escribe en el ticket de otro.
// =============================================================================

import { cuando } from './doer-hilo';
import { ROTULO_ESTADO_CLIENTE, estadoParaElCliente, type EstadoTicket } from './tickets-reglas';

export const MAX_PEDIDOS = 8;
export const DIAS_RESUELTOS = 3;

export type PedidoDelNegocio = { id: number; titulo: string; estado: EstadoTicket; respuesta: string | null; updated_at: string };

const enUnaLinea = (s: string, max: number): string => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/** El bloque del system, o '' si el negocio no tiene pedidos abiertos ni resueltos hace poco. */
export function bloqueDePedidos(pedidos: readonly PedidoDelNegocio[], ahora: Date, tz: string): string {
  if (!pedidos.length) return '';
  return [
    'PEDIDOS ABIERTOS DE ESTE NEGOCIO (lo que ya le pidió o reportó al equipo de MaKo). Si lo de ahora es uno de éstos, dilo con su número y su estado y marca [[ya-pedido: #N]]: no lo contestes como consejo ni abras otro.',
    ...pedidos.slice(0, MAX_PEDIDOS).map((p) => {
      const estado = ROTULO_ESTADO_CLIENTE[estadoParaElCliente(p.estado)];
      const dijo = p.respuesta?.trim() ? ` · el equipo dijo: «${enUnaLinea(p.respuesta, 160)}»` : '';
      return `- #${p.id} «${enUnaLinea(p.titulo, 110)}» — ${estado} (act. ${cuando(p.updated_at, ahora, tz)})${dijo}`;
    }),
  ].join('\n');
}

// Con guion, espacio o guion bajo («ya pedido», «ya_pedido»): la variante también le llegaba al cliente (la verificación de 5b7a1917d).
const MARCA_YA_PEDIDO = /\[\[\s*ya[\s_-]*pedido\s*:?\s*#?\s*(\d{1,9})?[^\]]*\]\]/gi;

/**
 * Saca las marcas `[[ya-pedido: #N]]` de la respuesta. `ids`: los números que SON de un pedido abierto de este negocio (los
 * otros se descartan). `otras`: si hubo alguna, se sacan también las `[[no-existe: …]]` (es el mismo pedido: abrirían el
 * duplicado que la marca evita).
 */
export function sacarYaPedido(texto: string, abiertos: readonly number[]): { texto: string; ids: number[] } {
  const ids: number[] = [];
  let hubo = false;
  const sin = texto.replace(MARCA_YA_PEDIDO, (_m, n: string | undefined) => {
    hubo = true;
    const id = Number(n);
    if (Number.isInteger(id) && abiertos.includes(id) && !ids.includes(id)) ids.push(id);
    return '';
  });
  const limpio = (hubo && ids.length ? sin.replace(/\[\[\s*no-existe\s*:[^\]]*\]\]/gi, '') : sin)
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { texto: limpio, ids };
}
