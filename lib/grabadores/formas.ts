// =============================================================================
// grabadores/formas — lo que devuelve cada grabador, en la forma común (PURO: sin IO; lo prueban los tests)
// =============================================================================
// Cada forma salió de la documentación oficial medida el 26/10/2026 (docs/hallazgos-integraciones.md → «Los grabadores
// de reuniones»). La forma de un WEBHOOK se mide en el webhook, nunca en la API REST del mismo proveedor (AGENTS.md):
// por eso los avisos de tl;dv, Fireflies y Zoom NO se leen como reunión — sólo dicen QUÉ reunión terminó, y la reunión
// se pide entera por la API con la clave del negocio (lib/grabadores/<grabador>.ts).
// =============================================================================

import { claveDeReunion, externoPorCorreo, segundosDeReloj, type AccionReunion, type PersonaReunion, type Reunion, type TurnoReunion } from './reunion';

const txt = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => { const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN; return Number.isFinite(n) ? n : null; };
const lista = (v: unknown): Array<Record<string, unknown>> => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
const isoMas = (iso: string | null, seg: number | null): string | null => {
  if (!iso || seg == null) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t + seg * 1000).toISOString() : null;
};

/** Los invitados, sin repetir correo, con «de afuera» inferido contra quien grabó (`externoPorCorreo`). */
function invitadosInferidos(personas: Array<{ nombre: string | null; email: string | null }>, anfitrion: string | null, deCasa: ReadonlySet<string> = new Set()): PersonaReunion[] {
  const vistos = new Set<string>();
  const out: PersonaReunion[] = [];
  for (const p of personas) {
    const k = (p.email ?? '').toLowerCase() || `nombre:${(p.nombre ?? '').toLowerCase()}`;
    if (k === 'nombre:' || vistos.has(k)) continue;
    vistos.add(k);
    out.push({ nombre: p.nombre, email: p.email, externo: externoPorCorreo(p.email, anfitrion, deCasa) });
  }
  return out;
}

// ── tl;dv (pasta.tldv.io/v1alpha1) ─────────────────────────────────────────────────────────────────

/** GET /meetings/{id} (o un renglón de GET /meetings): id, name, happenedAt, url, duration (s), organizer, invitees. */
export function deTldv(m: Record<string, unknown>): Reunion {
  const id = String(m.id ?? '');
  const org = obj(m.organizer);
  const anfitrion = { nombre: txt(org.name), email: txt(org.email) };
  const inicio = txt(m.happenedAt);
  return {
    grabador: 'tldv', id, clave: claveDeReunion('tldv', id),
    titulo: txt(m.name) ?? '',
    inicio, fin: isoMas(inicio, num(m.duration)), programada: null, aparecio: inicio,
    invitados: invitadosInferidos(lista(m.invitees).map((i) => ({ nombre: txt(i.name), email: txt(i.email) })), anfitrion.email),
    anfitrion: anfitrion.nombre || anfitrion.email ? anfitrion : null,
    link: txt(m.url), linkCompartido: txt(m.url),
  };
}

/** GET /meetings/{id}/transcript → { data: [{ speaker, text, startTime, endTime }] } (segundos). */
export function turnosDeTldv(t: unknown): TurnoReunion[] {
  return lista(obj(t).data).map((x) => ({ hablante: txt(x.speaker), email: null, texto: typeof x.text === 'string' ? x.text : '', segundo: num(x.startTime) }));
}

// ── Fireflies.ai (GraphQL) ─────────────────────────────────────────────────────────────────────────

/** Los campos que se le piden a `transcripts` / `transcript(id)`: los mismos para listar y para leer. */
export const CAMPOS_FIREFLIES = 'id title date duration organizer_email host_email participants workspace_users transcript_url meeting_attendees { displayName email name }';

/**
 * Un `transcript` de Fireflies: `date` en ms, `duration` en MINUTOS, `participants` = correos (también de invitados sin
 * cuenta), `workspace_users` = los correos del equipo (de la casa), `transcript_url` = el link.
 */
export function deFireflies(m: Record<string, unknown>): Reunion {
  const id = String(m.id ?? '');
  const ms = num(m.date);
  const inicio = ms != null ? new Date(ms).toISOString() : null;
  const durMin = num(m.duration);
  const host = txt(m.organizer_email) ?? txt(m.host_email);
  // `workspace_users` = los correos del equipo de Fireflies del que grabó: son de la casa (la doc no trae un «externo»).
  const deCasa = new Set((Array.isArray(m.workspace_users) ? m.workspace_users : []).map((e) => String(e ?? '').trim().toLowerCase()).filter(Boolean));
  const nombrePorCorreo = new Map<string, string>();
  for (const a of lista(m.meeting_attendees)) { const e = txt(a.email)?.toLowerCase(); const n = txt(a.displayName) ?? txt(a.name); if (e && n) nombrePorCorreo.set(e, n); }
  const correos = [...new Set([...(Array.isArray(m.participants) ? m.participants : []), ...lista(m.meeting_attendees).map((a) => a.email)]
    .flatMap((e) => String(e ?? '').split(',')).map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@')))];
  const resumen = obj(m.summary);
  const sentences = Array.isArray(m.sentences) ? m.sentences : undefined;
  const acciones = txt(resumen.action_items);
  return {
    grabador: 'fireflies', id, clave: claveDeReunion('fireflies', id),
    titulo: txt(m.title) ?? '',
    inicio, fin: isoMas(inicio, durMin != null ? durMin * 60 : null), programada: null, aparecio: inicio,
    invitados: invitadosInferidos(correos.map((e) => ({ nombre: nombrePorCorreo.get(e) ?? null, email: e })), host, deCasa),
    anfitrion: host ? { nombre: null, email: host } : null,
    link: txt(m.transcript_url), linkCompartido: txt(m.transcript_url),
    ...(sentences ? {
      transcripcion: lista(sentences).map((x) => ({ hablante: txt(x.speaker_name), email: null, texto: typeof x.text === 'string' ? x.text : String(x.raw_text ?? ''), segundo: num(x.start_time) })),
    } : {}),
    ...(m.summary !== undefined ? { resumen: [txt(resumen.overview), txt(resumen.short_summary)].filter(Boolean).join('\n\n') || null } : {}),
    ...(acciones ? { acciones: accionesDeTexto(acciones) } : {}),
  };
}

/** Los compromisos de un texto en viñetas («- Hacer X», «**Ana**\nHacer Y (03:12)»): uno por renglón con contenido. */
function accionesDeTexto(s: string): AccionReunion[] {
  return s.split('\n').map((l) => l.replace(/^[-*•\d.)\s]+/, '').replace(/\*\*/g, '').trim()).filter((l) => l.length > 3)
    .map((descripcion) => ({ descripcion, responsable: null }));
}

// ── Zoom (api.zoom.us/v2) ──────────────────────────────────────────────────────────────────────────

/** Una reunión de GET /users/me/recordings (o /meetings/{uuid}/recordings): uuid, topic, start_time, duration (min), host_email, share_url. */
export function deZoom(m: Record<string, unknown>, participantes: Array<Record<string, unknown>> = []): Reunion {
  // El UUID es la OCURRENCIA (una reunión recurrente tiene un id y muchos uuid): es lo que identifica a esta grabación.
  const id = String(m.uuid ?? m.id ?? '');
  const inicio = txt(m.start_time);
  const host = txt(m.host_email);
  return {
    grabador: 'zoom', id, clave: claveDeReunion('zoom', id),
    titulo: txt(m.topic) ?? '',
    inicio, fin: isoMas(inicio, num(m.duration) != null ? num(m.duration)! * 60 : null), programada: null, aparecio: inicio,
    // `internal_user` sí lo dice Zoom; el correo de uno de afuera viene VACÍO (medido en su doc, 26/10/2026).
    invitados: participantes.map((p) => ({ nombre: txt(p.name), email: txt(p.user_email), externo: typeof p.internal_user === 'boolean' ? !p.internal_user : null })),
    anfitrion: host ? { nombre: null, email: host } : null,
    link: txt(m.share_url), linkCompartido: txt(m.share_url),
  };
}

/**
 * Un VTT de Zoom a turnos. Cada bloque: un número, «00:01:02.345 --> 00:01:05.000» y el texto, que Zoom escribe
 * «Nombre: lo que dijo». Un renglón sin «Nombre:» queda sin hablante (no se inventa uno).
 */
export function turnosDeVtt(vtt: string): TurnoReunion[] {
  const out: TurnoReunion[] = [];
  for (const bloque of String(vtt ?? '').replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    const lineas = bloque.split('\n').map((l) => l.trim()).filter(Boolean);
    const i = lineas.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const segundo = segundosDeReloj(lineas[i].split('-->')[0].trim().replace(/[.,]\d+$/, ''));
    const texto = lineas.slice(i + 1).join(' ').trim();
    if (!texto) continue;
    const m = /^([^:]{1,80}):\s+(.*)$/.exec(texto);
    out.push(m ? { hablante: m[1].trim(), email: null, texto: m[2].trim(), segundo } : { hablante: null, email: null, texto, segundo });
  }
  return out;
}

// ── Otter.ai (api.otter.ai/v1) ─────────────────────────────────────────────────────────────────────

/** Una conversación de Otter: id, title, url, owner, created_at, calendar_guests, abstract_summary, relationships. */
export function deOtter(m: Record<string, unknown>): Reunion {
  const id = String(m.id ?? '');
  const owner = obj(m.owner);
  const host = txt(owner.email);
  const inicio = txt(m.created_at);
  const rel = obj(m.relationships);
  const tr = obj(rel.transcript);
  return {
    grabador: 'otter', id, clave: claveDeReunion('otter', id),
    titulo: txt(m.title) ?? '',
    inicio, fin: null, programada: null, aparecio: inicio,
    invitados: invitadosInferidos(lista(m.calendar_guests).map((g) => ({ nombre: txt(g.name), email: txt(g.email) })), host),
    anfitrion: host || txt(owner.name) ? { nombre: txt(owner.name), email: host } : null,
    link: txt(m.url), linkCompartido: txt(m.url),
    ...(rel.transcript !== undefined ? { transcripcion: turnosDeTextoOtter(String(tr.content ?? '')) } : {}),
    ...(m.abstract_summary !== undefined ? { resumen: txt(m.abstract_summary) } : {}),
  };
}

/** La transcripción de Otter es texto: bloques «Nombre  mm:ss\nlo que dijo…» separados por un renglón en blanco. */
export function turnosDeTextoOtter(s: string): TurnoReunion[] {
  const out: TurnoReunion[] = [];
  for (const bloque of s.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    const [cabeza, ...resto] = bloque.split('\n');
    const m = /^(.*?)\s{2,}((?:\d{1,2}:)?\d{1,2}:\d{2})\s*$/.exec(cabeza ?? '');
    const texto = (m ? resto : [cabeza, ...resto]).join(' ').trim();
    if (!texto) continue;
    out.push({ hablante: m ? m[1].trim() || null : null, email: null, texto, segundo: m ? segundosDeReloj(m[2]) : null });
  }
  return out;
}
