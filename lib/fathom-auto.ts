// =============================================================================
// fathom-auto — adjunta AUTO la grabación de Fathom al lead tras la reunión
// =============================================================================
// Cuando una reunión ya pasó y aparece su grabación en Fathom (matcheada por email
// vía closing_analyses), la enganchamos sola al lead (fathom_links) sin que el
// humano tenga que ir a "Datos sin marcar". SEGURO: applyFathomRecording nunca pisa
// una decisión humana (solo agrega el link y marca la asistencia si estaba sin
// marcar) y esto NO mueve al lead de etapa — eso es del CRM-automático (gateado
// aparte con CRM_AUTO_ENABLED). Corre en el cron closing-sync (1×/día), después de
// poblar closing_analyses. El webhook de Fathom (real-time) es el camino instantáneo
// y complementario: necesita FATHOM_WEBHOOK_SECRET + registrar la URL en Fathom.

import 'server-only';
import { listLeads, applyFathomRecording } from '@/lib/leads';
import { buscarReunionesAutomatico } from '@/lib/auto-reuniones';

const GRACIA_MS = 60 * 60_000; // 1h post-inicio: la reunión ya terminó

function reunionMs(at: string | null, fecha: string | null): number {
  if (at) { const t = Date.parse(at); if (Number.isFinite(t)) return t; }
  if (fecha) { const t = Date.parse(`${fecha.slice(0, 10)}T12:00:00`); if (Number.isFinite(t)) return t; }
  return NaN;
}
function yaPaso(at: string | null, fecha: string | null, now: number): boolean {
  const t = reunionMs(at, fecha);
  return Number.isFinite(t) && now >= t + GRACIA_MS;
}

/**
 * Adjunta la grabación de Fathom a los leads con una reunión RECIENTE ya pasada y
 * sin grabación cargada. Devuelve cuántos revisó y cuántos enganchó. Best-effort.
 */
export async function adjuntarFathomAuto(opts?: { diasAtras?: number; maxLeads?: number }): Promise<{ revisados: number; adjuntados: number }> {
  const diasAtras = opts?.diasAtras ?? 3;
  const maxLeads = opts?.maxLeads ?? 40;
  const now = Date.now();
  const desde = now - diasAtras * 86_400_000;

  const leads = await listLeads();
  const cand = leads.filter((l) => {
    const links = ((l.fathom_links ?? []) as Array<{ url?: string }>).filter((f) => f.url);
    if (links.length >= 2) return false; // ya tiene R1 + R2
    const r1 = yaPaso(l.junta_1_at, l.fecha_junta_1, now) && l.asistio_j1 !== false && reunionMs(l.junta_1_at, l.fecha_junta_1) >= desde;
    const r2 = yaPaso(l.junta_2_at, l.fecha_junta_2, now) && l.asistio_j2 !== false && reunionMs(l.junta_2_at, l.fecha_junta_2) >= desde;
    return r1 || r2;
  }).slice(0, maxLeads);

  let adjuntados = 0;
  for (const lead of cand) {
    const auto = await buscarReunionesAutomatico(lead).catch(() => null);
    if (!auto) continue;
    if (yaPaso(lead.junta_1_at, lead.fecha_junta_1, now) && lead.asistio_j1 !== false && auto.fathomR1?.url) {
      const { addedLink } = await applyFathomRecording(lead, 'j1', auto.fathomR1.url, auto.asistioJ1).catch(() => ({ addedLink: false }));
      if (addedLink) adjuntados++;
    }
    if (yaPaso(lead.junta_2_at, lead.fecha_junta_2, now) && lead.asistio_j2 !== false && auto.fathomR2?.url) {
      const { addedLink } = await applyFathomRecording(lead, 'j2', auto.fathomR2.url, auto.asistioJ2).catch(() => ({ addedLink: false }));
      if (addedLink) adjuntados++;
    }
  }
  return { revisados: cand.length, adjuntados };
}
