// =============================================================================
// fathom-auto — engancha AUTO la grabación de Fathom al lead tras la reunión
// =============================================================================
// SELF-CONTAINED y EVENT-DRIVEN: no depende del cron ni de closing_analyses. Va
// directo a la API de Fathom (fetchAllMeetings), matchea la grabación por email +
// fecha de la reunión, y la engancha al lead (fathom_links) marcando la asistencia.
// SEGURO: applyFathomRecording nunca pisa una decisión humana; esto NO mueve al
// lead de etapa (eso es del CRM-automático). Se dispara: (1) al vuelo desde el
// webhook de Fathom, (2) THROTTLEADO cuando se abre el CRM / se calculan los
// "Datos sin marcar" (así resuelve solo, sin cron), (3) a mano por el admin.

import 'server-only';
import { listLeads, applyFathomRecording } from '@/lib/leads';
import { fetchAllMeetings, externalInviteeEmails, meetingStartIso, type FathomMeeting } from '@/lib/fathom-api';
import { getSetting, setSetting } from '@/lib/settings';
import { getWorkspaceActual } from '@/lib/workspace';

const GRACIA_MS = 60 * 60_000;      // 1h post-inicio: la reunión ya terminó
const VENTANA_MATCH_MS = 3 * 86_400_000; // ±3 días entre la agenda y la grabación

function reunionMs(at: string | null, fecha: string | null): number {
  if (at) { const t = Date.parse(at); if (Number.isFinite(t)) return t; }
  if (fecha) { const t = Date.parse(`${fecha.slice(0, 10)}T12:00:00`); if (Number.isFinite(t)) return t; }
  return NaN;
}
function yaPaso(at: string | null, fecha: string | null, now: number): boolean {
  const t = reunionMs(at, fecha);
  return Number.isFinite(t) && now >= t + GRACIA_MS;
}

/** Mapa email(normalizado) → grabaciones de Fathom con share_url. */
async function grabacionesPorEmail(): Promise<Map<string, FathomMeeting[]>> {
  const meetings = await fetchAllMeetings({ includeSummary: false }).catch(() => [] as FathomMeeting[]);
  const map = new Map<string, FathomMeeting[]>();
  for (const m of meetings) {
    if (!m.share_url) continue;
    for (const e of externalInviteeEmails(m)) {
      const k = (e || '').trim().toLowerCase();
      if (!k) continue;
      const arr = map.get(k) ?? [];
      arr.push(m); map.set(k, arr);
    }
  }
  return map;
}

/**
 * Engancha la grabación de Fathom a los leads con una reunión reciente ya pasada y
 * sin grabación. Best-effort. Devuelve cuántos revisó y cuántos enganchó.
 */
export async function adjuntarFathomAuto(opts?: { diasAtras?: number; maxLeads?: number }): Promise<{ revisados: number; adjuntados: number }> {
  const diasAtras = opts?.diasAtras ?? 5;
  const maxLeads = opts?.maxLeads ?? 60;
  const now = Date.now();
  const desde = now - diasAtras * 86_400_000;

  const leads = await listLeads();
  const cand = leads.filter((l) => {
    if (!l.email) return false;
    const links = ((l.fathom_links ?? []) as Array<{ url?: string }>).filter((f) => f.url);
    if (links.length >= 2) return false; // ya tiene R1 + R2
    const r1 = yaPaso(l.junta_1_at, l.fecha_junta_1, now) && l.asistio_j1 !== false && reunionMs(l.junta_1_at, l.fecha_junta_1) >= desde;
    const r2 = yaPaso(l.junta_2_at, l.fecha_junta_2, now) && l.asistio_j2 !== false && reunionMs(l.junta_2_at, l.fecha_junta_2) >= desde;
    return r1 || r2;
  }).slice(0, maxLeads);

  if (!cand.length) return { revisados: 0, adjuntados: 0 };

  const porEmail = await grabacionesPorEmail();
  let adjuntados = 0;
  for (const lead of cand) {
    const grabs = porEmail.get((lead.email || '').trim().toLowerCase()) ?? [];
    if (!grabs.length) continue;
    const tieneLinks = ((lead.fathom_links ?? []) as Array<{ url?: string }>).filter((f) => f.url).length;
    for (const which of ['j1', 'j2'] as const) {
      const at = which === 'j1' ? lead.junta_1_at : lead.junta_2_at;
      const fecha = which === 'j1' ? lead.fecha_junta_1 : lead.fecha_junta_2;
      const asis = which === 'j1' ? lead.asistio_j1 : lead.asistio_j2;
      if (!yaPaso(at, fecha, now) || asis === false) continue;
      const tMeeting = reunionMs(at, fecha);
      // La grabación más cercana a la fecha de esa reunión (±3 días).
      const rec = grabs
        .map((m) => ({ m, d: Math.abs((Date.parse(meetingStartIso(m) || '') || NaN) - tMeeting) }))
        .filter((x) => Number.isFinite(x.d) && x.d <= VENTANA_MATCH_MS)
        .sort((a, b) => a.d - b.d)[0]?.m;
      if (!rec?.share_url) continue;
      // Evitar re-enganchar el MISMO link (idempotente vía applyFathomRecording).
      const { addedLink } = await applyFathomRecording(lead, which, rec.share_url, true).catch(() => ({ addedLink: false }));
      if (addedLink) adjuntados++;
    }
    void tieneLinks;
  }
  return { revisados: cand.length, adjuntados };
}

// Throttle: no queremos pegarle a la API de Fathom en cada carga del CRM. Corre
// como mucho 1 vez cada N minutos (marca el último run en app_settings del ws).
const KEY_LAST_RUN = 'mako.fathom_auto.last';
const THROTTLE_MIN = 20;

/** Dispara el auto-adjuntar SI pasó el throttle. Fire-and-forget, nunca lanza.
 *  Pensado para llamarse al calcular "Datos sin marcar" (event-driven, sin cron). */
export async function adjuntarFathomAutoThrottled(): Promise<void> {
  try {
    const ws = await getWorkspaceActual();
    if (ws == null) return;
    const last = await getSetting(KEY_LAST_RUN);
    const lastMs = last ? Date.parse(last) : 0;
    if (Number.isFinite(lastMs) && Date.now() - lastMs < THROTTLE_MIN * 60_000) return;
    await setSetting(KEY_LAST_RUN, new Date().toISOString()); // marca ANTES (evita solaparse)
    await adjuntarFathomAuto();
  } catch (e) {
    console.error('[fathom-auto] throttled:', e instanceof Error ? e.message : String(e));
  }
}
