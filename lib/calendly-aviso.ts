import 'server-only';

// =============================================================================
// calendly-aviso — lee si la cuenta de Calendly del negocio tiene el aviso a MaKo (23/10/2026)
// =============================================================================
// La regla está en lib/calendly-aviso-reglas.ts. Esto sólo pregunta: `GET /users/me` y `GET /webhook_subscriptions` con
// el token del NEGOCIO (nunca otro), y no escribe nada. Cualquier cosa que no sea una respuesta clara es null: la
// pantalla no afirma ni «anda» ni «no anda» (un 429 o un Calendly lento no pueden pintar de ámbar a nadie).
//
// ⚠️ NO PUEDE COLGAR /integraciones (revisión adversarial, 23/10/2026): son DOS viajes en serie a una API ajena, y con un
// tope por llamada la página esperaba hasta 8 s. Ahora el tope es UNO, de toda la cadena (una sola señal), y el veredicto
// se recuerda 60 s por negocio: abrir y cerrar el modal no vuelve a preguntar. La página lo lanza en paralelo al resto.
//
// Sólo la cuenta principal: las de más (fase B, lib/cuentas-agenda-server.ts) ya dicen en su fila si les falta la
// signing key del aviso.
// =============================================================================

import { credWs } from './credenciales';
import { estadoDeLasLecturas, type EstadoAvisoCalendly, type SuscripcionCalendly } from './calendly-aviso-reglas';

const API = 'https://api.calendly.com';
/** Lo que se espera a Calendly en TOTAL antes de no decir nada: la página no se queda colgada de una API ajena. */
const ESPERA_MS = 3000;
/** Cuánto se recuerda un veredicto claro (el null no se recuerda: se vuelve a intentar). */
const RECUERDA_MS = 60_000;
const recuerdo = new Map<number, { hasta: number; estado: EstadoAvisoCalendly }>();

async function leer<T>(token: string, ruta: string, senal: AbortSignal): Promise<{ status: number; json: T | null }> {
  const r = await fetch(`${API}${ruta}`, { headers: { Authorization: `Bearer ${token}` }, signal: senal, cache: 'no-store' });
  return { status: r.status, json: r.ok ? ((await r.json()) as T) : null };
}

/**
 * ¿Le llegan a MaKo las reservas nuevas de la cuenta principal de Calendly de `ws`? null = sin token o no se pudo leer.
 * Mira las suscripciones de la organización (las crea así el script) y las del usuario: un usuario que no administra
 * su organización recibe 403 en la primera, y eso no es «no hay aviso» (`estadoDeLasLecturas`).
 */
export async function avisoDeCalendly(ws: number): Promise<EstadoAvisoCalendly | null> {
  const guardado = recuerdo.get(ws);
  if (guardado && guardado.hasta > Date.now()) return guardado.estado;
  try {
    const token = await credWs('CALENDLY_API_TOKEN', ws);
    if (!token) return null;
    const senal = AbortSignal.timeout(ESPERA_MS);
    const me = await leer<{ resource?: { uri?: string; current_organization?: string } }>(token, '/users/me', senal);
    const org = me.json?.resource?.current_organization;
    const user = me.json?.resource?.uri;
    if (!org || !user) return null;
    const qOrg = new URLSearchParams({ organization: org, scope: 'organization', count: '100' });
    const qUser = new URLSearchParams({ organization: org, user, scope: 'user', count: '100' });
    const [deOrg, deUser] = await Promise.all([
      leer<{ collection?: SuscripcionCalendly[] }>(token, `/webhook_subscriptions?${qOrg}`, senal),
      leer<{ collection?: SuscripcionCalendly[] }>(token, `/webhook_subscriptions?${qUser}`, senal),
    ]);
    const estado = estadoDeLasLecturas({
      org: deOrg.json ? (deOrg.json.collection ?? []) : deOrg.status === 403 ? 'sin-permiso' : null,
      user: deUser.json ? (deUser.json.collection ?? []) : null,
    });
    if (estado) recuerdo.set(ws, { hasta: Date.now() + RECUERDA_MS, estado });
    return estado;
  } catch (e) {
    console.warn('[calendly-aviso] no pude leer el aviso:', e instanceof Error ? e.message : e);
    return null;
  }
}
