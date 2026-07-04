// =============================================================================
// auto-reuniones — "Automático primero": busca los datos de R1/R2 solo
// =============================================================================
// Antes de pedirle nada al humano, MaKo cruza las fuentes ya conectadas:
//   - Calendly (agenda: fechas reales de R1/R2 por email del invitado)
//   - Fathom vía closing_analyses (grabaciones ya matcheadas al lead: si hay
//     grabación, la reunión OCURRIÓ → asistencia + link)
// Google Calendar queda como tercera fuente cuando se conecte el OAuth.
// Devuelve lo encontrado + reporte legible; el wizard solo pregunta lo que falte.

import 'server-only';
import { getTenantDb } from './workspace';
import { credWs } from './credenciales';
import type { FathomLink, Lead } from './leads';

export type AutoReuniones = {
  fechaJ1: string | null;
  fechaJ2: string | null;
  asistioJ1: boolean | null;   // true si existe grabación de la R1
  asistioJ2: boolean | null;
  fathomR1: FathomLink | null;
  fathomR2: FathomLink | null;
  encontrado: string[];        // reporte legible de qué se encontró y dónde
  faltante: string[];          // qué no se pudo conseguir automáticamente
};

const ES_R2 = /r2|reuni[oó]n 2|junta 2|seguimiento/i;
const fmt = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

type EventoCalendly = { name?: string; start_time?: string; status?: string };

async function eventosCalendly(email: string | null): Promise<EventoCalendly[]> {
  if (!email) return [];
  try {
    const token = await credWs('CALENDLY_API_TOKEN');
    if (!token) return [];
    const h = { Authorization: `Bearer ${token}` };
    const me = await fetch('https://api.calendly.com/users/me', { headers: h, cache: 'no-store' }).then((r) => r.json());
    const org = (me?.resource as { current_organization?: string } | undefined)?.current_organization;
    if (!org) return [];
    const url = `https://api.calendly.com/scheduled_events?organization=${encodeURIComponent(org)}&invitee_email=${encodeURIComponent(email)}&count=20&sort=start_time:ascending`;
    const res = await fetch(url, { headers: h, cache: 'no-store' }).then((r) => r.json());
    return ((res?.collection ?? []) as EventoCalendly[]).filter((e) => e.status !== 'canceled');
  } catch {
    return [];
  }
}

type AnalisisReunion = { tipo: string | null; started_at: string | null; share_url: string | null; call_url: string | null };

export async function buscarReunionesAutomatico(lead: Lead): Promise<AutoReuniones> {
  const supabase = (await getTenantDb());

  const [eventos, analisisRes] = await Promise.all([
    eventosCalendly(lead.email),
    supabase
      .from('closing_analyses')
      .select('tipo, started_at, share_url, call_url')
      .eq('lead_id', lead.id)
      .not('started_at', 'is', null)
      .order('started_at', { ascending: true })
      .then((r) => (r.data ?? []) as AnalisisReunion[]),
  ]);

  // Calendly: primera agenda de cada tipo (por nombre del evento).
  const calJ1 = eventos.find((e) => !ES_R2.test(e.name ?? ''));
  const calJ2 = eventos.find((e) => ES_R2.test(e.name ?? ''));

  // Fathom (grabaciones matcheadas): por tipo si el análisis lo trae; si no,
  // la más vieja es R1 y la siguiente R2.
  const anaR1 = analisisRes.find((a) => a.tipo === 'R1') ?? (analisisRes[0]?.tipo == null ? analisisRes[0] : undefined);
  const anaR2 = analisisRes.find((a) => a.tipo === 'R2') ?? (analisisRes[1]?.tipo == null ? analisisRes[1] : undefined);

  // Lo ya cargado en el lead no se reporta ni como hallazgo ni como faltante.
  const extJ1 = calJ1?.start_time?.slice(0, 10) ?? anaR1?.started_at?.slice(0, 10) ?? null;
  const extJ2 = calJ2?.start_time?.slice(0, 10) ?? anaR2?.started_at?.slice(0, 10) ?? null;
  const fechaJ1 = extJ1 ?? lead.fecha_junta_1 ?? null;
  const fechaJ2 = extJ2 ?? lead.fecha_junta_2 ?? null;
  const linkR1 = anaR1 ? (anaR1.share_url || anaR1.call_url) : null;
  const linkR2 = anaR2 ? (anaR2.share_url || anaR2.call_url) : null;

  const encontrado: string[] = [];
  const faltante: string[] = [];
  if (extJ1) encontrado.push(`Fecha R1: ${fmt(extJ1)} (${calJ1 ? 'Calendly' : 'Fathom'})`);
  else if (!lead.fecha_junta_1) faltante.push('fecha de la R1');
  if (linkR1) encontrado.push('Grabación de la R1 (Fathom) → asistió');
  else if (fechaJ1 && lead.asistio_j1 == null) faltante.push('grabación / asistencia de la R1');
  if (extJ2) encontrado.push(`Fecha R2: ${fmt(extJ2)} (${calJ2 ? 'Calendly' : 'Fathom'})`);
  if (linkR2) encontrado.push('Grabación de la R2 (Fathom) → asistió');
  else if (fechaJ2 && lead.asistio_j2 == null) faltante.push('grabación / asistencia de la R2');

  return {
    fechaJ1,
    fechaJ2,
    asistioJ1: linkR1 ? true : null,
    asistioJ2: linkR2 ? true : null,
    fathomR1: linkR1 ? { label: 'Reunión 1', url: linkR1 } : null,
    fathomR2: linkR2 ? { label: 'Reunión 2', url: linkR2 } : null,
    encontrado,
    faltante,
  };
}
