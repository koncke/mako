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
import { nombreComparable } from '@/lib/leads-duplicados';
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

/**
 * Grabaciones de Fathom con share_url, indexadas por email y por NOMBRE del invitado
 * externo.
 *
 * ⚠️ EL FALLO NO SE TRAGA. Acá había un `.catch(() => [])`: si faltaba la credencial
 * (`apiKey()` lanza) o la API no contestaba tras sus reintentos, el barrido seguía con
 * un mapa VACÍO, o sea cero enganches, cero logs y cero señal en pantalla — que es
 * indistinguible de «no había ninguna grabación para enganchar». Es la regla de la
 * casa: «no pude leer» no es «no hay». Ahora propaga, y `adjuntarFathomAuto` lo deja
 * salir para que lo digan los dos lugares donde alguien lo lee (la respuesta de
 * /api/admin/fathom-auto y el resumen de la operación de MaKo, que ya tienen su
 * try/catch).
 */
type Grabaciones = { porEmail: Map<string, FathomMeeting[]>; porNombre: Map<string, FathomMeeting[]> };

async function grabaciones(): Promise<Grabaciones> {
  const meetings = await fetchAllMeetings({ includeSummary: false });
  const porEmail = new Map<string, FathomMeeting[]>();
  const porNombre = new Map<string, FathomMeeting[]>();
  const sumar = (map: Map<string, FathomMeeting[]>, k: string, m: FathomMeeting) => {
    const arr = map.get(k) ?? [];
    arr.push(m); map.set(k, arr);
  };
  for (const m of meetings) {
    if (!m.share_url) continue;
    for (const e of externalInviteeEmails(m)) {
      const k = (e || '').trim().toLowerCase();
      if (k) sumar(porEmail, k, m);
    }
    // El nombre sale del MISMO invitado externo que el email (el prospecto), no del
    // título de la reunión: un título es texto libre y matchearlo sería adivinar.
    for (const i of m.calendar_invitees ?? []) {
      if (!i?.is_external) continue;
      const k = nombreComparable(i.name);
      if (k) sumar(porNombre, k, m);
    }
  }
  return { porEmail, porNombre };
}

/** Las grabaciones de la ventana, de la más cercana a `tMeeting` a la más lejana. */
function cercanas(grabs: FathomMeeting[], tMeeting: number, usados: Set<string>): FathomMeeting[] {
  return grabs
    .filter((m) => !!m.share_url && !usados.has(m.share_url))
    .map((m) => ({ m, d: Math.abs((Date.parse(meetingStartIso(m) || '') || NaN) - tMeeting) }))
    .filter((x) => Number.isFinite(x.d) && x.d <= VENTANA_MATCH_MS)
    .sort((a, b) => a.d - b.d)
    .map((x) => x.m);
}

/**
 * Engancha la grabación de Fathom a los leads con una reunión reciente ya pasada y
 * sin grabación. Devuelve cuántos revisó, cuántos enganchó, cuántos de ésos fueron
 * por NOMBRE (sin marcar asistencia), cuántos quedaron sin enganchar por ambiguos y
 * cuántos leads fallaron al escribirse.
 *
 * ⚠️ NO ES BEST-EFFORT SOBRE LA LECTURA DE FATHOM. Si Fathom no se puede leer, esto
 * LANZA en vez de devolver `adjuntados: 0`: un cero sobre una lectura fallida es
 * exactamente la mentira que abrió la tarjeta (#689), porque se lee igual que «no
 * había ninguna grabación para enganchar». Sí sigue siendo best-effort POR LEAD —que
 * uno falle al escribirse no cancela a los demás— y eso se cuenta en `fallosPorLead`
 * en vez de perderse.
 */
export async function adjuntarFathomAuto(opts?: { diasAtras?: number; maxLeads?: number }): Promise<{
  revisados: number;
  adjuntados: number;
  porNombre: number;
  ambiguos: number;
  fallosPorLead: number;
}> {
  const diasAtras = opts?.diasAtras ?? 5;
  const maxLeads = opts?.maxLeads ?? 60;
  const now = Date.now();
  const desde = now - diasAtras * 86_400_000;
  const vacio = { revisados: 0, adjuntados: 0, porNombre: 0, ambiguos: 0, fallosPorLead: 0 };

  const leads = await listLeads();
  const cand = leads.filter((l) => {
    // ⚠️ ACÁ ESTABA `if (!l.email) return false`. Un lead cargado por teléfono —el
    // caso textual que abrió la tarjeta, el link que había que pegar a mano— no era
    // candidato NUNCA. Ahora entra, y lo resuelve el match por nombre de más abajo,
    // que es estricto y NO afirma la asistencia.
    const links = ((l.fathom_links ?? []) as Array<{ url?: string }>).filter((f) => f.url);
    if (links.length >= 2) return false; // ya tiene R1 + R2
    if (!l.email && !nombreComparable(l.nombre)) return false; // sin email ni nombre no hay por dónde
    const r1 = yaPaso(l.junta_1_at, l.fecha_junta_1, now) && l.asistio_j1 !== false && reunionMs(l.junta_1_at, l.fecha_junta_1) >= desde;
    const r2 = yaPaso(l.junta_2_at, l.fecha_junta_2, now) && l.asistio_j2 !== false && reunionMs(l.junta_2_at, l.fecha_junta_2) >= desde;
    return r1 || r2;
  }).slice(0, maxLeads);

  if (!cand.length) return vacio;

  const { porEmail, porNombre: grabsPorNombre } = await grabaciones();

  // Un nombre que aparece en DOS leads de la tanda no identifica a nadie: ninguno de
  // los dos se engancha por nombre. El email no necesita esto: es la llave fuerte.
  const vecesElNombre = new Map<string, number>();
  for (const l of cand) {
    const k = nombreComparable(l.nombre);
    if (k) vecesElNombre.set(k, (vecesElNombre.get(k) ?? 0) + 1);
  }

  // Un share_url enganchado en ESTA corrida no se le vuelve a ofrecer a otro lead:
  // dos fichas apuntando a la misma grabación no da ningún error y no se puede ver
  // desde la pantalla.
  const usados = new Set<string>();
  let adjuntados = 0;
  let adjuntadosPorNombre = 0;
  let ambiguos = 0;
  let fallosPorLead = 0;

  for (const lead of cand) {
    const grabsEmail = porEmail.get((lead.email || '').trim().toLowerCase()) ?? [];
    const claveNombre = nombreComparable(lead.nombre);
    const grabsNombre = claveNombre && vecesElNombre.get(claveNombre) === 1
      ? (grabsPorNombre.get(claveNombre) ?? [])
      : [];
    if (!grabsEmail.length && !grabsNombre.length) continue;

    for (const which of ['j1', 'j2'] as const) {
      const at = which === 'j1' ? lead.junta_1_at : lead.junta_2_at;
      const fecha = which === 'j1' ? lead.fecha_junta_1 : lead.fecha_junta_2;
      const asis = which === 'j1' ? lead.asistio_j1 : lead.asistio_j2;
      if (!yaPaso(at, fecha, now) || asis === false) continue;
      const tMeeting = reunionMs(at, fecha);

      // 1) Por EMAIL: la llave fuerte. La más cercana a la fecha de esa reunión
      //    (±3 días), igual que siempre, y afirma la asistencia.
      const porMail = cercanas(grabsEmail, tMeeting, usados)[0];
      if (porMail?.share_url) {
        const url = porMail.share_url;
        usados.add(url); // reservada por ESTE lead, haya que escribirla o no
        const r = await applyFathomRecording(lead, which, url, true).catch((e) => {
          fallosPorLead++;
          console.error('[fathom-auto] lead ' + lead.id + ' ' + which + ': ' + (e instanceof Error ? e.message : String(e)));
          return null;
        });
        if (r?.addedLink) adjuntados++;
        continue;
      }

      // 2) Por NOMBRE: sólo si hay EXACTAMENTE UNA en la ventana. Con dos candidatas
      //    no se desempata —elegir «la más cercana» entre dos reuniones de la misma
      //    semana es adivinar cuál es cuál—: se cuenta y queda para una persona.
      //    Y LA ASISTENCIA NO SE TOCA: que el nombre coincida no prueba que la persona
      //    estuvo, y afirmarlo en cualquiera de los dos sentidos es lo que lib/fathom.ts
      //    prohíbe con el caso medido (una R1 de 64 minutos mandada a No Show). El link
      //    queda cargado para que alguien lo confirme en un click, que es la salida
      //    segura que ese mismo comentario escribe.
      if (!grabsNombre.length) continue;
      const candidatas = cercanas(grabsNombre, tMeeting, usados);
      if (candidatas.length > 1) { ambiguos++; continue; }
      const porNom = candidatas[0];
      if (!porNom?.share_url) continue;
      const url = porNom.share_url;
      usados.add(url);
      const r = await applyFathomRecording(lead, which, url, null, { marcarAsistencia: false }).catch((e) => {
        fallosPorLead++;
        console.error('[fathom-auto] lead ' + lead.id + ' ' + which + ' (por nombre): ' + (e instanceof Error ? e.message : String(e)));
        return null;
      });
      if (r?.addedLink) { adjuntados++; adjuntadosPorNombre++; }
    }
  }
  return { revisados: cand.length, adjuntados, porNombre: adjuntadosPorNombre, ambiguos, fallosPorLead };
}

// Throttle: no queremos pegarle a la API de Fathom en cada carga del CRM. Corre
// como mucho 1 vez cada N minutos (marca el último run en app_settings del ws).
const KEY_LAST_RUN = 'mako.fathom_auto.last';
const THROTTLE_MIN = 20;

/** Dispara el auto-adjuntar SI pasó el throttle. Fire-and-forget, nunca lanza.
 *  Pensado para llamarse al calcular "Datos sin marcar" (event-driven, sin cron).
 *
 *  ⚠️ ACÁ EL FALLO SE PIERDE, Y ES A PROPÓSITO QUE ESTO SIGA SIN LANZAR: lo llama
 *  lib/queries.ts con un `void` al dibujar el CRM, así que lanzar tiraría la pantalla
 *  por un problema de Fathom. Lo que sí cambia es que el motivo quede escrito con su
 *  nombre y los contadores de la corrida al lado, en vez de un cero mudo.
 *
 *  Lo que esto NO puede hacer desde acá es ponerlo en una PANTALLA: el camino que el
 *  dueño mira es /api/admin/fathom-auto y la operación de MaKo, que llaman a
 *  `adjuntarFathomAuto` directo y ahora reciben la excepción. Este camino es el
 *  oportunista y su única salida honesta es el log. */
export async function adjuntarFathomAutoThrottled(): Promise<void> {
  try {
    const ws = await getWorkspaceActual();
    if (ws == null) return;
    const last = await getSetting(KEY_LAST_RUN);
    const lastMs = last ? Date.parse(last) : 0;
    if (Number.isFinite(lastMs) && Date.now() - lastMs < THROTTLE_MIN * 60_000) return;
    await setSetting(KEY_LAST_RUN, new Date().toISOString()); // marca ANTES (evita solaparse)
    const r = await adjuntarFathomAuto();
    if (r.fallosPorLead || r.ambiguos) {
      console.warn(`[fathom-auto] ws=${ws} revisados=${r.revisados} adjuntados=${r.adjuntados} por_nombre=${r.porNombre} ambiguos=${r.ambiguos} fallos=${r.fallosPorLead}`);
    }
  } catch (e) {
    console.error('[fathom-auto] NO se pudieron enganchar las grabaciones:', e instanceof Error ? e.message : String(e));
  }
}
