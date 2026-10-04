// =============================================================================
// auto-reuniones — "Automático primero": busca los datos de R1/R2 solo
// =============================================================================
// Antes de pedirle nada al humano, MaKo cruza las fuentes ya conectadas:
//   - Calendly (agenda: fechas reales de R1/R2 por email del invitado)
//   - Fathom vía closing_analyses (grabaciones ya matcheadas al lead: si hay
//     grabación analizada como venta, la reunión OCURRIÓ → asistencia + link)
//   - `lead.fathom_links`: las grabaciones que YA están en la ficha
// Google Calendar queda como tercera fuente cuando se conecte el OAuth.
// Devuelve lo encontrado + reporte legible; el wizard solo pregunta lo que falte.

import 'server-only';
import { getTenantDb } from './workspace';
import { credWs } from './credenciales';
import { buscarEventosGoogle } from './google-calendar';
import type { FathomLink, Lead } from './leads';

export type AutoReuniones = {
  fechaJ1: string | null;
  fechaJ2: string | null;
  // true SOLO si la grabación la matcheó el análisis de Closing Analyst como venta
  // (ahí el transcript prueba que la llamada ocurrió). Un link que alguien pegó a
  // mano en la ficha deja esto en null: que haya un link no prueba quién estuvo, y
  // afirmarlo es la inferencia que lib/fathom.ts prohíbe.
  asistioJ1: boolean | null;
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

type AnalisisReunion = { tipo: string | null; started_at: string | null; share_url: string | null; call_url: string | null; category: string | null };

const DIA = 86400000;
const urlDe = (a: AnalisisReunion) => (a.share_url || a.call_url || '');
/** Llamada de VENTA más cercana a una fecha objetivo (agenda de Calendly), dentro
 *  de una ventana de ±4 días. Ignora las ya usadas. undefined si no hay match. */
function ventaCercaDe(calls: AnalisisReunion[], targetISO: string | undefined, usados: Set<string>): AnalisisReunion | undefined {
  if (!targetISO) return undefined;
  const t = new Date(targetISO.slice(0, 10) + 'T00:00:00Z').getTime();
  return calls
    .filter((a) => a.started_at && !usados.has(urlDe(a)))
    .map((a) => ({ a, d: Math.abs(new Date(a.started_at as string).getTime() - t) }))
    .filter((x) => x.d <= 4 * DIA)
    .sort((x, y) => x.d - y.d)[0]?.a;
}

export async function buscarReunionesAutomatico(lead: Lead): Promise<AutoReuniones> {
  const supabase = (await getTenantDb());

  const [eventos, analisisRes, gcalEventos] = await Promise.all([
    eventosCalendly(lead.email),
    supabase
      .from('closing_analyses')
      .select('tipo, started_at, share_url, call_url, category')
      .eq('lead_id', lead.id)
      .not('started_at', 'is', null)
      .order('started_at', { ascending: true })
      .then((r) => (r.data ?? []) as AnalisisReunion[]),
    (async () => {
      if (!lead.email) return [];
      const now = new Date();
      const timeMin = new Date(now.getTime() - 365 * 86400000).toISOString();
      const timeMax = new Date(now.getTime() + 60 * 86400000).toISOString();
      return buscarEventosGoogle(lead.email, timeMin, timeMax);
    })(),
  ]);

  // Calendly: primera agenda de cada tipo (por nombre del evento).
  const calJ1 = eventos.find((e) => !ES_R2.test(e.name ?? ''));
  const calJ2 = eventos.find((e) => ES_R2.test(e.name ?? ''));

  // Fathom (grabaciones matcheadas) → SOLO llamadas de VENTA. La entrega de
  // servicio / coaching también matchea por email pero NO es R1/R2; el análisis
  // de Closing Analyst ya la separa (transcript-aware) → acá filtramos por eso.
  // Prioridad para asignar cada reunión:
  //   1) tipo explícito (R1/R2 que decidió Claude leyendo la llamada)
  //   2) la venta más cercana a la fecha de la agenda de Calendly (±4 días)
  //   3) orden por fecha entre ventas (la más vieja = R1, la siguiente = R2)
  const ventas = analisisRes.filter((a) => a.category === 'venta');
  const usados = new Set<string>();
  const anaR1 = ventas.find((a) => a.tipo === 'R1')
    ?? ventaCercaDe(ventas, calJ1?.start_time, usados)
    ?? ventas[0];
  if (anaR1) usados.add(urlDe(anaR1));
  const anaR2 = ventas.find((a) => a.tipo === 'R2' && !usados.has(urlDe(a)))
    ?? ventaCercaDe(ventas, calJ2?.start_time, usados)
    ?? ventas.find((a) => !usados.has(urlDe(a)));
  if (anaR2) usados.add(urlDe(anaR2));

  // Google Calendar (3ra fuente): eventos con el email del lead, por nombre.
  const gcalJ1 = gcalEventos.find((e) => !ES_R2.test(e.summary ?? ''));
  const gcalJ2 = gcalEventos.find((e) => ES_R2.test(e.summary ?? ''));

  // Lo ya cargado en el lead no se reporta ni como hallazgo ni como faltante.
  const extJ1 = calJ1?.start_time?.slice(0, 10) ?? anaR1?.started_at?.slice(0, 10) ?? gcalJ1?.start?.slice(0, 10) ?? null;
  const extJ2 = calJ2?.start_time?.slice(0, 10) ?? anaR2?.started_at?.slice(0, 10) ?? gcalJ2?.start?.slice(0, 10) ?? null;
  const fuenteJ1 = calJ1 ? 'Calendly' : anaR1 ? 'Fathom' : gcalJ1 ? 'Google Calendar' : '';
  const fuenteJ2 = calJ2 ? 'Calendly' : anaR2 ? 'Fathom' : gcalJ2 ? 'Google Calendar' : '';
  const fechaJ1 = extJ1 ?? lead.fecha_junta_1 ?? null;
  const fechaJ2 = extJ2 ?? lead.fecha_junta_2 ?? null;
  const anaLinkR1 = anaR1 ? (anaR1.share_url || anaR1.call_url) : null;
  const anaLinkR2 = anaR2 ? (anaR2.share_url || anaR2.call_url) : null;

  // ⚠️ LAS GRABACIONES QUE YA ESTÁN EN LA FICHA SON UNA FUENTE, Y FALTABAN.
  // `fathom_links` no aparecía en este archivo, así que una grabación cargada a mano
  // era invisible para el buscador y el asistente la volvía a pedir. Y la mitad caía
  // peor: `lib/crm-auto.ts` pregunta por `fathomR1/R2` para decidir la regla T1, así
  // que un lead CON su grabación en la ficha y la asistencia sin marcar caía en la
  // rama de abajo y el motor lo mandaba a **No Show** — con el video de la reunión
  // guardado en su propia ficha. Es el caso que lib/fathom.ts:49-71 documenta al
  // revés («sin grabación no es "no vino"»): acá había grabación y se concluía que no.
  //
  // El reparto R1/R2 usa el MISMO `ES_R2` que las fechas, sobre el label del link —
  // que es lo que escribe `applyFathomRecording` ('Reunión 1' / 'Reunión 2') y lo que
  // una persona tipea en la ficha. Sin label, cae en R1, que es el orden de carga.
  const yaEnLaFicha = (lead.fathom_links ?? []).filter((f) => f?.url?.trim());
  const fichaR1 = yaEnLaFicha.find((f) => !ES_R2.test(f.label ?? '')) ?? null;
  const fichaR2 = yaEnLaFicha.find((f) => ES_R2.test(f.label ?? '')) ?? null;

  const linkR1 = anaLinkR1 ?? fichaR1?.url ?? null;
  const linkR2 = anaLinkR2 ?? fichaR2?.url ?? null;

  const encontrado: string[] = [];
  const faltante: string[] = [];

  /** Qué se encontró de la grabación de una reunión, y qué queda a mano. */
  const reportarGrabacion = (cual: 'R1' | 'R2', analizada: string | null, link: string | null, fecha: string | null, asistio: boolean | null) => {
    if (analizada) { encontrado.push(`Grabación de la ${cual} (Fathom) → asistió`); return; }
    if (link) {
      // El link ya está: lo único que puede faltar es que alguien diga si fue.
      encontrado.push(`Grabación de la ${cual}: ya está en la ficha`);
      if (asistio == null) faltante.push(`asistencia a la ${cual}`);
      return;
    }
    if (fecha && asistio == null) faltante.push(`grabación / asistencia de la ${cual}`);
  };

  if (extJ1) encontrado.push(`Fecha R1: ${fmt(extJ1)} (${fuenteJ1})`);
  else if (!lead.fecha_junta_1) faltante.push('fecha de la R1');
  reportarGrabacion('R1', anaLinkR1, linkR1, fechaJ1, lead.asistio_j1);
  if (extJ2) encontrado.push(`Fecha R2: ${fmt(extJ2)} (${fuenteJ2})`);
  reportarGrabacion('R2', anaLinkR2, linkR2, fechaJ2, lead.asistio_j2);

  return {
    fechaJ1,
    fechaJ2,
    // Solo la grabación ANALIZADA afirma la asistencia (ver el tipo, arriba).
    asistioJ1: anaLinkR1 ? true : null,
    asistioJ2: anaLinkR2 ? true : null,
    // El label de la ficha se conserva: lo escribió una persona. Quien consume esto
    // deduplica por url (app/crm/StageMoveDialog.tsx), así que no se duplica nada.
    fathomR1: linkR1 ? { label: anaLinkR1 ? 'Reunión 1' : (fichaR1?.label || 'Reunión 1'), url: linkR1 } : null,
    fathomR2: linkR2 ? { label: anaLinkR2 ? 'Reunión 2' : (fichaR2?.label || 'Reunión 2'), url: linkR2 } : null,
    encontrado,
    faltante,
  };
}
