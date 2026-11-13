// =============================================================================
// copywriter/oferta-elegida — la OFERTA ENTERA para MaKo, nunca sólo su nombre (PURO; 13/11/2026)
// =============================================================================
// El relevo del 13/11 (Martín: «escribe casi que cualquier cosa»): a MaKo le llegaba el NOMBRE de la oferta en el pedido («Replícalo
// con mi oferta «WhatsApp Ads Funnel»») y lo demás salía de una búsqueda en el Second Brain; con un nombre solo, inventaba (un
// dominio, «un checklist gratis», «no es un chatbot»). Ahora la oferta elegida va con TODOS sus datos (la fila de `ofertas` y la de
// `productos` del mismo nombre), y lo que le falta va dicho: eso no se inventa, va como [DATO: …].
// =============================================================================

import type { Bono, Oferta } from '../oferta-modelo';
import type { Producto } from '../productos';

const plano = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * La oferta que nombra el pedido (o la charla): primero la que va entre «…», después cualquiera que aparezca por su nombre; si no,
 * la principal. null = el pedido no nombra ninguna y el negocio no tiene principal.
 */
export function ofertaDelPedido<T extends Pick<Oferta, 'nombre' | 'es_principal'>>(texto: string, ofertas: readonly T[]): T | null {
  const t = plano(texto);
  const citadas = [...texto.matchAll(/«([^»]{2,120})»/g)].map((m) => plano(m[1]));
  const porNombre = (o: T) => plano(o.nombre);
  return ofertas.find((o) => citadas.includes(porNombre(o)))
    ?? [...ofertas].sort((a, b) => b.nombre.length - a.nombre.length).find((o) => porNombre(o).length >= 3 && t.includes(porNombre(o)))
    ?? ofertas.find((o) => o.es_principal)
    ?? null;
}

/** Lo mínimo que MaKo necesita de una oferta para escribir sin inventar (lo que el flujo nuevo le pregunta a la persona). */
export const LO_MINIMO = ['para quién', 'qué promete', 'qué incluye', 'precio'] as const;

const linea = (rotulo: string, v: string | null | undefined) => (v && v.trim() ? `${rotulo}: ${v.trim().replace(/\s+/g, ' ').slice(0, 600)}` : null);
const bonos = (bs: readonly Bono[] | undefined) => (bs?.length ? bs.map((b) => `${b.nombre}${b.valor_usd ? ` (US$ ${b.valor_usd})` : ''}${b.porque ? `: ${b.porque}` : ''}`).join(' · ') : null);

/** Lo que le falta a la oferta de lo mínimo (vacío = está completa). */
export function faltaDeLaOferta(o: Partial<Oferta> | null, p: Partial<Producto> | null): string[] {
  const hay = (...vs: (string | number | null | undefined)[]) => vs.some((v) => (typeof v === 'number' ? v > 0 : !!v && String(v).trim()));
  const falta: string[] = [];
  if (!hay(o?.para_quien)) falta.push('para quién');
  if (!hay(o?.promesa, p?.promesa)) falta.push('qué promete');
  if (!hay(o?.incluye, p?.incluye, p?.descripcion)) falta.push('qué incluye');
  if (!hay(o?.precio_usd, o?.precio_nota, p?.monto_usd)) falta.push('precio');
  return falta;
}

/**
 * El bloque de LA OFERTA ELEGIDA para el pedido: sus datos reales y lo que falta. '' = no hay oferta elegida (escribe para el
 * negocio, con lo que dice EL NEGOCIO).
 */
export function bloqueDeOferta(o: Oferta | null, p: Producto | null): string {
  if (!o && !p) return '';
  const nombre = o?.nombre ?? p?.nombre ?? '';
  const precio = o?.precio_usd ? `US$ ${o.precio_usd}${o.precio_nota ? ` (${o.precio_nota})` : ''}` : o?.precio_nota || (p?.monto_usd ? `US$ ${p.monto_usd}${p.tipo === 'suscripcion' ? ' por mes' : ''}` : null);
  const datos = [
    linea('Para quién', o?.para_quien),
    linea('Qué promete', o?.promesa || p?.promesa),
    linea('Qué incluye', o?.incluye || p?.incluye),
    linea('Qué es', p?.descripcion),
    linea('Precio', precio),
    linea('Garantía', o?.garantia || p?.garantia),
    linea('Bonos', bonos(o?.bonos)),
    linea('Prueba (casos, resultados)', o?.prueba),
    linea('Objeciones que responde', o?.objeciones),
    linea('Urgencia', o?.urgencia_dato ? `${o.urgencia_dato}${o.urgencia_razon ? ` (${o.urgencia_razon})` : ''}` : null),
  ].filter(Boolean);
  const falta = faltaDeLaOferta(o, p);
  return [
    `LA OFERTA ELEGIDA: «${nombre}». La pieza habla de ESTA oferta, con estos datos y nada más: lo que no está aquí ni en EL NEGOCIO no se inventa (ni un dominio, ni un regalo, ni una cifra), va como [DATO: …].`,
    ...(datos.length ? datos : ['(La oferta no tiene datos cargados: sólo su nombre.)']),
    ...(falta.length ? [`Le falta: ${falta.join(', ')}. Escribe con [DATO: …] en esos lugares y, en la respuesta, pregunta UNO de ellos (el que más mejora la pieza).`] : []),
  ].join('\n');
}
