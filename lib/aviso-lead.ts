// =============================================================================
// aviso-lead — un aviso que habla de un LEAD dice quién es, cuánto y lleva a su ficha (20/10/2026)
// =============================================================================
// Martín, en la llamada con Leila del 19/10 (24:15): en el teléfono sale un aviso «Cuota vencida → cobrar» que no
// dice DE QUIÉN es la cuota, ni cuánto, y tampoco lleva a la ficha. Medido en producción: el ws1 escribe uno por día
// a las 14:00 con título y texto iguales («Cuota vencida → cobrar») y el link a Configuraciones.
//
// Dos cosas, y las dos valen para cualquier aviso, no sólo el de cobranza:
//   · `linkDelLeadDelAviso`: un aviso que trae su lead lleva a la FICHA del lead (en la fila de avisos, en el push y
//     en el correo), no a Configuraciones. Antes, el lead viajaba hasta `emitirAviso` y nadie lo usaba para el link.
//   · `textoSinAutomatizacion`: la fila que deja un evento de MaKo SIN ninguna automatización prendida (la bitácora,
//     lib/aviso-evento.ts) dice quién y cuánto. Antes era el título repetido como texto.
//
// Sin `server-only`: lo ejecuta el test.
// =============================================================================

import { nombreCuota } from './pagos-campo';

/**
 * La ficha del lead del aviso, como ruta INTERNA (`/crm/<id>`; el teléfono la traduce a `/m/crm/<id>`,
 * lib/movil-rutas.ts). null si el aviso no trae lead.
 * ⚠️ Un aviso `alDueno` lo lee el super admin en el workspace de la PLATAFORMA, y el lead es de un cliente: esa ficha
 * no es suya, así que ahí no hay link al lead (queda el de siempre).
 */
export function linkDelLeadDelAviso(a: { lead?: { id: number } | null; alDueno?: boolean }): string | null {
  if (a.alDueno === true) return null;
  const id = Number(a.lead?.id);
  return Number.isInteger(id) && id > 0 ? `/crm/${id}` : null;
}

/**
 * El TÍTULO de un aviso sobre un lead lo nombra, adelante: «Francisco · Cuota vencida → cobrar». Es lo primero que se
 * lee en la lista de avisos y en el push; en el detalle el nombre quedaba escondido (lo pidió Martín el 19/10). Sin
 * nombre, o si el título ya lo dice, el título tal cual.
 */
export function tituloConLead(titulo: string, lead: { nombre?: string | null } | null | undefined): string {
  const nombre = lead?.nombre?.trim();
  if (!nombre || titulo.toLowerCase().includes(nombre.toLowerCase())) return titulo;
  return `${nombre} · ${titulo}`;
}

/**
 * El texto de la fila de un evento de MaKo que no corrió ninguna automatización (`emitirPorEvento`). Lo que el evento
 * ya trae en la mano: el lead y los datos exactos de la cuota (`cuota_numero`, `cuota_monto`, `cuota_vence`, que
 * pone la cobranza por código). Sin datos de cuota, el título con el nombre del lead; sin lead, el título.
 */
export function textoSinAutomatizacion(
  id: string,
  titulo: string,
  opts: { lead?: { nombre?: string | null } | null; datos?: Readonly<Record<string, string>> | null },
): string {
  const nombre = opts.lead?.nombre?.trim() || null;
  const d = opts.datos ?? {};
  const esCuota = id === 'cuota-vencida' || id === 'cuota-por-vencer';
  if (esCuota && d.cuota_monto) {
    const n = Number(d.cuota_numero);
    const cuota = Number.isInteger(n) && n >= 0 ? nombreCuota(n) : 'Una cuota';
    const cuando = d.cuota_vence ? ` · ${id === 'cuota-vencida' ? 'venció' : 'vence'} el ${d.cuota_vence}` : '';
    return `${nombre ?? 'Un cliente'}: ${cuota} de ${d.cuota_monto}${id === 'cuota-vencida' ? ' sin cobrar' : ''}${cuando}`;
  }
  return nombre ? `${titulo} · ${nombre}` : titulo;
}
