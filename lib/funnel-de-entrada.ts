// =============================================================================
// funnel-de-entrada — a qué funnel entra lo que llega por una ENTRADA declarada
// =============================================================================
// Decisión 9 del Leads Scraper (docs/diseno-leads-scraper.md §7, 15/10/2026): cada fuente entra al
// funnel que DECLARA esa entrada. El tipo de funnel ya dice cómo entra la gente (`ENTRADAS`,
// lib/pipeline.ts, guardado en `funnels.data.entradas`): las compras y los carritos de Hotmart van al
// de «Anuncios a carrito» (`carrito`), y los prospectos al de «Prospección» (`chat_saliente`).
//
// Uno solo que la declare → ése. Ninguno, o varios → null, que es el funnel del negocio: con
// varios, elegir el primero sería decidir a ciegas (AGENTS.md: una rama que puede decir «esto es
// ambiguo» no termina en `[0]`). «No pude leer» también es null: el lead entra igual, al del negocio.

import 'server-only';
import { getFunnelDe, leerFunnels } from './funnels';
import type { EntradaId } from './pipeline';

export async function funnelDeEntrada(entrada: EntradaId): Promise<number | null> {
  const fs = await leerFunnels();
  if (!fs?.length) return null;
  const con: number[] = [];
  for (const f of fs) {
    try {
      if ((await getFunnelDe(f.id)).entradas.includes(entrada)) con.push(f.id);
    } catch { /* un funnel que no se pudo leer no cuenta */ }
  }
  return con.length === 1 ? con[0] : null;
}
