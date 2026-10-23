// =============================================================================
// Lo que sirve para PREPARAR una reunión que viene: lo último que hizo el lead y lo que pasó en su R1 (22/10/2026)
// =============================================================================
// La tarjeta de «Tus reuniones» (app/crm/TarjetaReunion.tsx) lo pide AL ABRIRSE, no al cargar el CRM: la página ya hace su
// ola de lecturas y esto sólo sirve si alguien abre el pop-up (app/crm/reuniones-actions.ts). Nunca tira: sin una de las dos
// lecturas, esa parte no se dice (la tarjeta no inventa «sin contacto»).
//   · Lo último: el último contacto QUE HIZO EL LEAD (un WhatsApp suyo o una llamada), la misma regla que Clientes
//     (`ultimoContactoDeClientes`, lib/cs-cartera.ts).
//   · La R1: el análisis de Closing Analyst de la R1 más nueva (`closing_analyses`, tipo R1 y analizada): el próximo paso que
//     quedó, el resumen, las objeciones y el link de la grabación. ⚠️ Es texto que salió de la llamada (lo dijo un tercero):
//     se dibuja como texto, nunca como instrucción ni HTML.
// =============================================================================

import { getTenantDb } from '@/lib/workspace';
import { ultimoContactoDeClientes } from '@/lib/cs-cartera';
import type { ContactoCliente } from '@/lib/cs-contacto';

export type R1DeReunion = { resumen: string | null; proximoPaso: string | null; objeciones: string[]; grabacion: string | null };
export type ContextoReunion = { ultimo: ContactoCliente | null; r1: R1DeReunion | null };

/** Tope de reuniones por pedido: el pop-up muestra las de hoy y mañana. */
export const TOPE_REUNIONES = 40;

type FilaR1 = { lead_id: number; call_date: string | null; summary: string | null; next_step: string | null; objections: Array<{ quote?: string }> | null; share_url: string | null };

export async function contextoParaReuniones(leadIds: readonly number[]): Promise<Record<number, ContextoReunion>> {
  const ids = [...new Set(leadIds.filter((x) => Number.isSafeInteger(x) && x > 0))].slice(0, TOPE_REUNIONES);
  const out: Record<number, ContextoReunion> = {};
  if (!ids.length) return out;
  for (const id of ids) out[id] = { ultimo: null, r1: null };

  const [contactos, filas] = await Promise.all([
    ultimoContactoDeClientes(ids).catch(() => null),
    (async () => {
      try {
        const { data, error } = await (await getTenantDb()).from('closing_analyses')
          .select('lead_id, call_date, summary, next_step, objections, share_url')
          .in('lead_id', ids).eq('tipo', 'R1').eq('category', 'venta').eq('status', 'analizada')
          .order('call_date', { ascending: false, nullsFirst: false });
        return error ? [] : ((data ?? []) as FilaR1[]);
      } catch { return []; }
    })(),
  ]);

  if (contactos) for (const id of ids) out[id].ultimo = contactos[id] ?? null;
  // La más nueva de cada lead (vienen ordenadas por fecha, la más nueva primero).
  for (const f of filas) {
    const c = out[f.lead_id];
    if (!c || c.r1) continue;
    c.r1 = {
      resumen: f.summary?.trim() || null,
      proximoPaso: f.next_step?.trim() || null,
      objeciones: (f.objections ?? []).map((o) => (o.quote ?? '').trim()).filter(Boolean).slice(0, 2),
      grabacion: f.share_url?.trim() || null,
    };
  }
  return out;
}
