// =============================================================================
// Poll de leads de Meta: cada cuánto, qué ventana y qué NO toma
// =============================================================================
// Sin `server-only` a propósito: son las reglas que deciden si un lead entra, y se
// prueban EJECUTÁNDOLAS (tests/meta-leads-poll-frecuente.test.ts).
//
// ⚠️ POR QUÉ CORRE CADA 10 MINUTOS Y NO UNA VEZ POR DÍA (08/10/2026). Joan: «Llegó un nuevo
// lead form de Brigitte pero no se cargó en el CRM». Los leads de ws15 entraban con 10 a 19
// horas de demora (medido: Miguel 10,96 h, Omar 10,62 h, Mariana 19,29 h, Rosana 10,05 h), y
// Nicolas y Jose seguían afuera. El diagnóstico obvio —«el webhook está roto»— era el
// equivocado: el webhook anda (ws1 carga en 6 a 11 s). Lo que pasa es que la PÁGINA de la
// clienta no está suscripta a nuestra app (`subscribed_apps` = []), así que Meta no avisa
// nada, y el único camino era este poll, que corría a las 13:30 UTC y nada más.
//
// Suscribir la página arregla ESA clienta; esto arregla a la próxima que se conecte con su
// propia app y tampoco esté suscripta, sin que nadie se entere. Costo medido el 08/10: 17
// llamadas a Graph por pasada entre los 4 workspaces con página (ws1 6, ws13 7, ws15 3,
// ws9 1), y seis seguidas a la misma página dejan el uso de `leadgen` en el 1 %.
// =============================================================================

/** La ventana de la pasada frecuente. Un día alcanza: corre cada 10 minutos. */
export const DIAS_PASADA_FRECUENTE = 1;
/** La de la pasada ancha de cada día (la red que había antes, intacta). */
export const DIAS_PASADA_DIARIA = 7;

/**
 * ⚠️ EL POLL NO TOCA UN LEAD DE MENOS DE 5 MINUTOS: ése es del webhook.
 *
 * Si el poll lo lee primero, el webhook lo encuentra por `meta_lead_id` (lib/leads.ts,
 * upsertLeadFromMeta), recibe `created:false` y se saltea EN SILENCIO lo que sólo hace con
 * un lead nuevo: el alta del chat, el aviso al dueño, los flujos y la nutrición inmediata
 * (app/api/webhooks/meta-leads/route.ts). No se pierde el lead; se pierde lo inmediato. En
 * ws1, con el webhook tardando 6 a 11 s y una pasada cada 10 min, le pasaría a ~1 de cada 60.
 * La pasada siguiente lo levanta.
 */
export const EDAD_MINIMA_POLL_MS = 5 * 60_000;

export function esDelWebhookTodavia(createdTime: string | null | undefined, ahoraMs: number): boolean {
  if (!createdTime) return false; // sin fecha no hay carrera que evitar: se toma
  const t = Date.parse(createdTime);
  if (!Number.isFinite(t)) return false;
  return ahoraMs - t < EDAD_MINIMA_POLL_MS;
}

/**
 * ⚠️ UN LEAD QUE EL POLL CREA TAMBIÉN TIENE «LO INMEDIATO» (17/10/2026, tarjeta #868, Brigitte): el aviso, los flujos y la
 * inscripción en las automatizaciones (`alNacerLeadDeMeta`, lib/meta-lead-nuevo.ts). Hasta ese día el poll sólo lo
 * cargaba, suponiendo que de lo inmediato se encargaba el webhook; pero para una página que no está suscripta a la app
 * —la de Brigitte, ws15— el webhook NO LLEGA NUNCA, y sus leads entraban al CRM sin disparar ninguna automatización.
 *
 * Con un tope de edad: la pasada diaria repasa la semana y `?dias=90` rescata tres meses. Un lead que Meta tomó hace
 * días no es «un lead nuevo» para el negocio: se carga callado, como siempre. 24 h cubre la pasada que se cortó una
 * noche entera. Sin fecha de Meta no se sabe: callado.
 */
export const EDAD_MAXIMA_LO_INMEDIATO_MS = 24 * 3600_000;

export function esNuevoParaElNegocio(createdTime: string | null | undefined, ahoraMs: number): boolean {
  if (!createdTime) return false;
  const t = Date.parse(createdTime);
  if (!Number.isFinite(t)) return false;
  return ahoraMs - t <= EDAD_MAXIMA_LO_INMEDIATO_MS;
}

/**
 * Cuántos días repasa ESTA corrida. `?dias=` manda (backfill a mano: `?dias=90`). Si no,
 * la de las 13:30 UTC —la hora de la corrida diaria de siempre— repasa la semana, y el
 * resto, el último día.
 */
export function ventanaDelPoll(ahora: Date, diasPedidos: string | null): number {
  if (diasPedidos != null && diasPedidos.trim() !== '') {
    const n = Number(diasPedidos);
    if (Number.isFinite(n) && n >= 1) return Math.min(90, Math.floor(n));
  }
  const esLaDiaria = ahora.getUTCHours() === 13 && Math.floor(ahora.getUTCMinutes() / 10) === 3;
  return esLaDiaria ? DIAS_PASADA_DIARIA : DIAS_PASADA_FRECUENTE;
}
