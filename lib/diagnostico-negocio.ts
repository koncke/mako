// =============================================================================
// diagnostico-negocio — de qué negocio habla Martín cuando pide DEBUGUEAR algo desde el grupo de SuperAdmin (sin base: puro)
// =============================================================================
// Martín, 29/10/2026: le reenvió a MaKo la consulta de un cliente («Che Tincho… pegué el token del pixel… conectar Facebook no me
// hace nada») y MaKo le contestó a ÉL un consejo genérico. Tenía que mirar con datos qué tiene conectado ESE negocio. Hasta acá
// ninguna herramienta podía leer otro negocio: todas usan el del grupo (`ctx.ws`). `diagnosticar_negocio` (área operaciones, sólo
// la plataforma) lo lee; esto decide CUÁL es, por su número o su nombre, sin adivinar entre dos.
// =============================================================================

export type NegocioConocido = { ws: number; nombre: string };

const norm = (s: string): string => (s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
/** Las palabras que no dicen de quién es: «el negocio de Leila», «la cuenta de Joan». */
const RELLENO = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'negocio', 'cuenta', 'workspace', 'ws', 'cliente', 'grupo', 'mi', 'su', 'y']);

/**
 * Los negocios que puede ser `pedido`: por número («11», «ws11»), por el nombre entero, o porque TODAS las palabras del pedido
 * (de 3 letras o más) están en su nombre («Leila» → «Leila Fittipaldi | Metacoach»). Más de uno: el que llama pregunta cuál.
 */
export function buscarNegocio(pedido: string, negocios: readonly NegocioConocido[]): NegocioConocido[] {
  const num = /^\s*(?:ws\s*)?(\d{1,6})\s*$/i.exec(pedido || '');
  if (num) return negocios.filter((n) => n.ws === Number(num[1]));
  const p = norm(pedido);
  if (!p) return [];
  const exacto = negocios.filter((n) => norm(n.nombre) === p);
  if (exacto.length) return exacto;
  const palabras = p.split(' ').filter((w) => w.length >= 3 && !RELLENO.has(w));
  if (!palabras.length) return [];
  return negocios.filter((n) => {
    const nombre = ` ${norm(n.nombre)} `;
    return palabras.every((w) => nombre.includes(` ${w}`));
  });
}
