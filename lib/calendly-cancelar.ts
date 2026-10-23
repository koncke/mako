// =============================================================================
// calendly-cancelar — cancelar en Calendly la próxima reunión de un lead (server)
// =============================================================================
// Martín (16/10/2026, por Cerebro, punto 4): «ACCIONES de Calendly (crear y editar eventos) y de las otras apps
// integradas, para el paso "⚡ Acción"». Lo que un paso de un flujo puede hacer SOLO, sobre el lead del flujo, sin
// inventar un dato (la vara de `ACCIONES_DEL_FLUJO`, lib/editor-acciones.ts):
//   · CANCELAR su próxima reunión: sí. Es lo único de Calendly que no pide un horario (`cancelar_reunion_calendly`).
//   · EDITARLA: la API de Calendly NO deja mover ni renombrar una reunión (sólo cancelarla; reagendar lo hace el
//     invitado con su link). No se ofrece algo que Calendly no hace.
//   · CREARLA: reservar pide un horario EXACTO elegido por el lead (`proponer_agendar_reunion`); un flujo que reserva
//     solo inventa la hora. Para que agende, el mensaje lleva su link.
//
// La reunión se busca por el email del invitado (como `eventosCalendly`, lib/auto-reuniones.ts) en la organización del
// token. Cancelarla la baja también del CRM: el webhook de Calendly (`invitee.canceled`) la marca cancelada, como
// cuando la cancela el lead.
//
// VARIAS CUENTAS (fase B, 23/10/2026): la reunión se busca en TODAS las cuentas de Calendly del negocio
// (`tokensDeAgenda`), y se cancela con el token de la cuenta dueña: con el de otra, Calendly contesta 404.
// =============================================================================

import 'server-only';
import { CUENTA_PRINCIPAL, nombreDeCuenta } from './cuentas-integracion';
import { tokenDeAgenda, tokensDeAgenda } from './cuentas-agenda-server';

const API = 'https://api.calendly.com';

/** `cuenta`: la cuenta de Calendly del negocio que tiene la reunión ('principal', 'c2'…): la cancela su token. */
export type ReunionCalendly = { uri: string; nombre: string; inicioIso: string; cuenta: string };

export class CalendlyCancelarError extends Error {
  constructor(message: string) { super(message); this.name = 'CalendlyCancelarError'; }
}

const SIN_TOKEN = 'Este negocio no tiene el token de Calendly cargado (Integraciones › Calendly).';

async function pedir<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, cache: 'no-store' });
  const body = await res.json().catch(() => null) as { message?: string; title?: string } | null;
  if (!res.ok) throw new CalendlyCancelarError(body?.message || body?.title || `Calendly contestó HTTP ${res.status}`);
  return body as T;
}

/**
 * LA PRÓXIMA reunión ACTIVA de Calendly de un invitado (por su email): la primera que todavía no empezó. null = no
 * tiene ninguna por delante. Una lectura que falla TIRA: «no pude leer» no es «no tiene» (AGENTS.md).
 */
export async function proximaReunionCalendly(email: string, ahoraMs = Date.now()): Promise<ReunionCalendly | null> {
  const cuentas = await tokensDeAgenda('calendly');
  if (!cuentas.length) throw new CalendlyCancelarError(SIN_TOKEN);
  const todas: ReunionCalendly[] = [];
  for (const { cuenta, token } of cuentas) {
    // Una cuenta que no se puede leer TIRA (con su nombre): «no pude leer» no es «no tiene».
    const deLaCuenta = (m: string) => (cuentas.length > 1 ? `${nombreDeCuenta('calendly', cuenta, null)}: ${m}` : m);
    try {
      const me = await pedir<{ resource?: { current_organization?: string } }>(token, `${API}/users/me`);
      const org = me.resource?.current_organization;
      if (!org) throw new CalendlyCancelarError('Calendly no devolvió la organización del token.');
      const url = `${API}/scheduled_events?organization=${encodeURIComponent(org)}&invitee_email=${encodeURIComponent(email)}`
        + `&status=active&min_start_time=${encodeURIComponent(new Date(ahoraMs).toISOString())}&count=20`;
      const r = await pedir<{ collection?: Array<{ uri?: string; name?: string; start_time?: string; status?: string }> }>(token, url);
      for (const e of r.collection ?? []) {
        if (!e.uri || !e.start_time || e.status === 'canceled' || Date.parse(e.start_time) <= ahoraMs) continue;
        todas.push({ uri: e.uri, nombre: (e.name ?? '').trim(), inicioIso: e.start_time, cuenta });
      }
    } catch (e) {
      throw new CalendlyCancelarError(deLaCuenta(e instanceof Error ? e.message : String(e)));
    }
  }
  return todas.sort((a, b) => Date.parse(a.inicioIso) - Date.parse(b.inicioIso))[0] ?? null;
}

/** Cancela una reunión de Calendly. Calendly le avisa al invitado, con el motivo si lo hay. */
export async function cancelarReunionCalendly(uri: string, motivo: string, cuenta: string = CUENTA_PRINCIPAL): Promise<void> {
  const uuid = uri.split('/').filter(Boolean).pop();
  if (!uuid) throw new CalendlyCancelarError('La reunión de Calendly no tiene id.');
  // Con el token de la cuenta que TIENE la reunión (la que la encontró `proximaReunionCalendly`).
  const token = await tokenDeAgenda('calendly', cuenta);
  if (!token) throw new CalendlyCancelarError(SIN_TOKEN);
  await pedir(token, `${API}/scheduled_events/${encodeURIComponent(uuid)}/cancellation`, {
    method: 'POST', body: JSON.stringify(motivo.trim() ? { reason: motivo.trim().slice(0, 500) } : {}),
  });
}
