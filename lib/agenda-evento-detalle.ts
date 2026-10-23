// =============================================================================
// Lo que se edita de un evento además del nombre y la duración (23/10/2026)
// =============================================================================
// Martín, 22/10/2026, sobre «Vincular evento»: «Edición COMPLETA del evento desde ahí: nombre, duración, preguntas,
// disponibilidad, lo que permita cada API». Leído en la documentación de cada una el 23/10/2026
// (docs/hallazgos-integraciones.md → «Editar un evento de Calendly o Cal.com por API»):
//   · la DESCRIPCIÓN y DÓNDE es la reunión se editan en las dos;
//   · las PREGUNTAS: Cal.com deja cambiar las que ya existen (texto, obligatoria, oculta), Calendly no deja tocarlas;
//   · la DISPONIBILIDAD no: en Calendly la documentación da dos rutas distintas y no dice la forma de una regla, y en las
//     dos un PATCH reemplaza TODAS las reglas. Se edita allá, con un link.
// Puro, sin red: lo prueba tests/agenda-edicion-completa-23-10.test.ts. La red vive en lib/calendly-agenda.ts y
// lib/calcom.ts; lo junta lib/agenda-evento-etapa-server.ts.
// =============================================================================

import type { ProveedorAgenda } from './agenda-evento-etapa';

/** Dónde es la reunión: lo que tienen en común Calendly y Cal.com. `valor` es la dirección o el link. */
export type TipoUbicacion = 'meet' | 'zoom' | 'presencial' | 'link' | 'llamada';
export type UbicacionEvento = { tipo: TipoUbicacion; valor?: string };

/** Los tipos que se ofrecen, en este orden, con su nombre de pantalla. */
export const UBICACIONES: ReadonlyArray<{ tipo: TipoUbicacion; nombre: string; conValor?: 'direccion' | 'link' }> = [
  { tipo: 'meet', nombre: 'Google Meet' },
  { tipo: 'zoom', nombre: 'Zoom' },
  { tipo: 'llamada', nombre: 'Llamada' },
  { tipo: 'presencial', nombre: 'En persona', conValor: 'direccion' },
  { tipo: 'link', nombre: 'Otro link', conValor: 'link' },
];

export type PreguntaEvento = {
  /** Cal.com: su `slug` (con él se edita). Calendly: su posición. */
  id: string;
  texto: string;
  obligatoria: boolean;
  oculta: boolean;
};

export type DetalleEvento = {
  descripcion: string;
  /** null = sin ubicación, o una que no es de las comunes (se edita allá, `ubicacionAlla`). */
  ubicacion: UbicacionEvento | null;
  /** Tiene más de una, o una que no es de las comunes: cambiarla acá la pisaría. */
  ubicacionAlla: boolean;
  preguntas: PreguntaEvento[];
  /** Cal.com sí; Calendly no deja editarlas por su API. */
  preguntasEditables: boolean;
  /** Donde se edita lo que la API no deja (la disponibilidad, y en Calendly las preguntas). */
  editarAlla: string;
};

export const MAX_DESCRIPCION_EVENTO = 1000;
export const MAX_PREGUNTA_EVENTO = 200;

// ── Calendly ─────────────────────────────────────────────────────────────────

type LugarCalendly = { kind?: string; location?: string };
const DE_CALENDLY: Record<string, TipoUbicacion> = {
  google_conference: 'meet', zoom_conference: 'zoom', outbound_call: 'llamada', physical: 'presencial', custom: 'link',
};

/** La ubicación de un event type de Calendly. Más de una, o una rara: `alla`. */
export function ubicacionDeCalendly(lugares: readonly LugarCalendly[] | null | undefined): { ubicacion: UbicacionEvento | null; alla: boolean } {
  const ls = lugares ?? [];
  if (!ls.length) return { ubicacion: null, alla: false };
  const tipo = ls.length === 1 ? DE_CALENDLY[ls[0].kind ?? ''] : undefined;
  if (!tipo) return { ubicacion: null, alla: true };
  const valor = ls[0].location?.trim();
  return { ubicacion: { tipo, ...(valor && (tipo === 'presencial' || tipo === 'link') ? { valor } : {}) }, alla: false };
}

/** Lo que va en `locations` del PATCH de Calendly (una sola: reemplaza la lista). */
export function ubicacionACalendly(u: UbicacionEvento): Array<{ kind: string; location?: string }> {
  switch (u.tipo) {
    case 'meet': return [{ kind: 'google_conference' }];
    case 'zoom': return [{ kind: 'zoom_conference' }];
    case 'llamada': return [{ kind: 'outbound_call' }];
    case 'presencial': return [{ kind: 'physical', location: u.valor ?? '' }];
    case 'link': return [{ kind: 'custom', location: u.valor ?? '' }];
  }
}

type PreguntaCalendly = { name?: string; position?: number; enabled?: boolean; required?: boolean };
export const preguntasDeCalendly = (qs: readonly PreguntaCalendly[] | null | undefined): PreguntaEvento[] =>
  (qs ?? []).filter((q) => q.name?.trim()).map((q, i) => ({
    id: String(q.position ?? i), texto: q.name!.trim(), obligatoria: !!q.required, oculta: q.enabled === false,
  }));

// ── Cal.com ──────────────────────────────────────────────────────────────────

type LugarCalcom = { type?: string; integration?: string; address?: string; link?: string };

export function ubicacionDeCalcom(lugares: readonly LugarCalcom[] | null | undefined): { ubicacion: UbicacionEvento | null; alla: boolean } {
  const ls = lugares ?? [];
  if (!ls.length) return { ubicacion: null, alla: false };
  if (ls.length > 1) return { ubicacion: null, alla: true };
  const l = ls[0];
  if (l.type === 'integration' && l.integration === 'google-meet') return { ubicacion: { tipo: 'meet' }, alla: false };
  if (l.type === 'integration' && l.integration === 'zoom') return { ubicacion: { tipo: 'zoom' }, alla: false };
  if (l.type === 'attendeePhone') return { ubicacion: { tipo: 'llamada' }, alla: false };
  if (l.type === 'address' && l.address?.trim()) return { ubicacion: { tipo: 'presencial', valor: l.address.trim() }, alla: false };
  if (l.type === 'link' && l.link?.trim()) return { ubicacion: { tipo: 'link', valor: l.link.trim() }, alla: false };
  return { ubicacion: null, alla: true };
}

/** Lo que va en `locations` del PATCH de Cal.com (una sola: reemplaza la lista). */
export function ubicacionACalcom(u: UbicacionEvento): Array<Record<string, unknown>> {
  switch (u.tipo) {
    case 'meet': return [{ type: 'integration', integration: 'google-meet' }];
    case 'zoom': return [{ type: 'integration', integration: 'zoom' }];
    case 'llamada': return [{ type: 'attendeePhone' }];
    case 'presencial': return [{ type: 'address', address: u.valor ?? '', public: true }];
    case 'link': return [{ type: 'link', link: u.valor ?? '', public: true }];
  }
}

type CampoCalcom = { slug?: string; label?: string; required?: boolean; hidden?: boolean; isDefault?: boolean; type?: string };
/** Las preguntas PROPIAS del evento (las de sistema —nombre, email— no se tocan acá). */
export const preguntasDeCalcom = (campos: readonly CampoCalcom[] | null | undefined): PreguntaEvento[] =>
  (campos ?? []).filter((c) => c.slug && c.label?.trim() && !c.isDefault && !['name', 'email', 'attendeePhoneNumber', 'rescheduleReason', 'notes', 'guests', 'location', 'title'].includes(c.slug))
    .map((c) => ({ id: c.slug!, texto: c.label!.trim(), obligatoria: !!c.required, oculta: !!c.hidden }));

/** Dónde se edita lo que la API no deja. */
export const editarAllaDe = (proveedor: ProveedorAgenda, identificador: string): string => (proveedor === 'calendly'
  ? 'https://calendly.com/event_types/user/me'
  : `https://app.cal.com/event-types/${encodeURIComponent(identificador)}?tabName=availability`);

// ── Lo que llega a editar ────────────────────────────────────────────────────

export type CambiosDeDetalle = { descripcion?: string; ubicacion?: UbicacionEvento; preguntas?: PreguntaEvento[] };

/** Valida lo que llega (de la pantalla o de MaKo). Lo que no viene, no cambia. */
export function datosDeDetalle(input: { descripcion?: unknown; ubicacion?: unknown; preguntas?: unknown }):
  { ok: true; cambios: CambiosDeDetalle } | { ok: false; error: string } {
  const cambios: CambiosDeDetalle = {};
  if (input.descripcion != null) {
    const d = String(input.descripcion).trim();
    if (d.length > MAX_DESCRIPCION_EVENTO) return { ok: false, error: `La descripción es larga: hasta ${MAX_DESCRIPCION_EVENTO} letras.` };
    cambios.descripcion = d;
  }
  if (input.ubicacion != null) {
    const u = input.ubicacion as { tipo?: unknown; valor?: unknown };
    const def = UBICACIONES.find((x) => x.tipo === u?.tipo);
    if (!def) return { ok: false, error: 'Dónde es la reunión: Google Meet, Zoom, llamada, en persona u otro link.' };
    const valor = u.valor == null ? '' : String(u.valor).trim();
    if (def.conValor === 'direccion' && !valor) return { ok: false, error: 'Falta la dirección.' };
    if (def.conValor === 'link' && !/^https?:\/\/\S+\.\S+/.test(valor)) return { ok: false, error: 'El link tiene que empezar con https://' };
    if (valor.length > 300) return { ok: false, error: 'La dirección o el link es largo: hasta 300 letras.' };
    cambios.ubicacion = { tipo: def.tipo, ...(def.conValor ? { valor } : {}) };
  }
  if (input.preguntas != null) {
    if (!Array.isArray(input.preguntas)) return { ok: false, error: 'Las preguntas van en una lista.' };
    const ps: PreguntaEvento[] = [];
    for (const p of input.preguntas.slice(0, 30) as Array<Record<string, unknown>>) {
      const id = String(p?.id ?? '').trim();
      const texto = String(p?.texto ?? '').replace(/\s+/g, ' ').trim();
      if (!id) return { ok: false, error: 'Falta cuál pregunta.' };
      if (!texto || texto.length > MAX_PREGUNTA_EVENTO) return { ok: false, error: `Cada pregunta, entre 1 y ${MAX_PREGUNTA_EVENTO} letras.` };
      ps.push({ id, texto, obligatoria: p.obligatoria === true, oculta: p.oculta === true });
    }
    cambios.preguntas = ps;
  }
  return { ok: true, cambios };
}

/** Las preguntas que CAMBIARON (Cal.com: el PATCH de booking-fields sólo con ésas). */
export function preguntasCambiadas(antes: readonly PreguntaEvento[], despues: readonly PreguntaEvento[]): PreguntaEvento[] {
  return despues.filter((p) => {
    const a = antes.find((x) => x.id === p.id);
    return a && (a.texto !== p.texto || a.obligatoria !== p.obligatoria || a.oculta !== p.oculta);
  });
}
