// =============================================================================
// webhook-ruteo-huella — la huella de un webhook que no pudo leer DE QUIÉN es el evento (puro)
// =============================================================================
// Sin `server-only` a propósito: tests/webhooks-ruteo-estricto.test.ts lo ejecuta. Quien lee y
// escribe la base es lib/webhook-fallo-ruteo.ts.
//
// Un fallo leyendo el ruteo es el ÚNICO caso en que un evento entrante se pierde sin que nada
// lo diga: Cal.com y Chatwoot no reintentan nunca (medido en su código, 07/10/2026), así que lo
// que no se procesó en ese pedido no vuelve. La huella guarda lo justo para ir a buscarlo a la
// herramienta: de qué servicio, cuándo, con qué identificador y qué falló. Una consulta los ve:
//   select value from app_settings where key = 'webhooks.fallos_ruteo';
// (en el workspace del super admin: el ruteo falla ANTES de saber de qué cliente es).
//
// ⚠️ Y lo anotado es anterior a la firma en Cal.com y Fathom: es una PISTA para mirar en la
// herramienta, nunca un dato para cargar.

import { esErrorTransitorio } from './calendly-error';

export const KEY_FALLOS_RUTEO = 'webhooks.fallos_ruteo';
/** Una huella, no un log: las más recientes. */
export const TOPE_FALLOS_RUTEO = 30;

/** `landing`: el formulario de una landing (`/api/track/optin`), que tampoco se reintenta. */
export type ServicioRuteo = 'calcom' | 'chatwoot' | 'fathom' | 'meta' | 'landing';
const SERVICIOS: ReadonlySet<string> = new Set(['calcom', 'chatwoot', 'fathom', 'meta', 'landing']);

export type FalloRuteo = {
  cuando: string;
  servicio: ServicioRuteo;
  /** El identificador con el que se intentó rutear (event type, account id, página, email). */
  identificador: string | null;
  /** true → se contestó 503 (o el reintento lo podría arreglar). */
  transitorio: boolean;
  mensaje: string;
};

const texto = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

function saneado(v: unknown): FalloRuteo | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const cuando = texto(o.cuando, 40);
  const servicio = texto(o.servicio, 20);
  const mensaje = texto(o.mensaje, 300);
  if (!cuando || !servicio || !SERVICIOS.has(servicio) || !mensaje) return null;
  return { cuando, servicio: servicio as ServicioRuteo, identificador: texto(o.identificador, 120), transitorio: o.transitorio === true, mensaje };
}

/** Lo que había guardado, saneado. Basura o nada → lista vacía (nunca tira). */
export function huellaRuteoPrevia(crudo: string | null): FalloRuteo[] {
  if (!crudo) return [];
  try {
    const v: unknown = JSON.parse(crudo);
    return Array.isArray(v) ? v.map(saneado).filter((x): x is FalloRuteo => x !== null) : [];
  } catch {
    return [];
  }
}

/** Suma un fallo y deja las `TOPE_FALLOS_RUTEO` más recientes, la nueva primero. */
export function sumarFalloRuteo(previa: FalloRuteo[], fallo: FalloRuteo): FalloRuteo[] {
  const nuevo = saneado(fallo);
  return (nuevo ? [nuevo, ...previa] : previa).slice(0, TOPE_FALLOS_RUTEO);
}

// SIN `server-only` como el resto del módulo: el test la EJECUTA con un fn que falla a propósito.
/**
 * Reintenta una lectura que falló de forma TRANSITORIA, adentro del mismo pedido.
 *
 * Es la única recuperación posible cuando quien manda NO reintenta: el snippet de una landing
 * dispara el opt-in una sola vez (`fetch` con `keepalive`, sin mirar la respuesta), y un bearer
 * que recibe un error se lo cuenta a una persona. Un corte de la base suele durar segundos:
 * dos esperas cortas cubren el pestañeo sin colgar el pedido. Lo que NO es transitorio (una
 * consulta rota) se tira en el acto: reintentarlo sólo lo demora.
 */
export async function conReintentoTransitorio<T>(fn: () => Promise<T>, esperasMs: readonly number[] = [250, 750]): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= esperasMs.length || !esErrorTransitorio(e)) throw e;
      await new Promise((r) => setTimeout(r, esperasMs[i]));
    }
  }
}
