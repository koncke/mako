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

import { createHash } from 'node:crypto';
import { credWs } from './credenciales';
import { getSupabaseServer } from './supabase';
import { estadoAntesDelAviso, estadoDeLasLecturas, type EstadoAvisoCalendly, type SuscripcionCalendly } from './calendly-aviso-reglas';

const API = 'https://api.calendly.com';
/** Lo que se espera a Calendly en TOTAL antes de no decir nada: la página no se queda colgada de una API ajena. */
const ESPERA_MS = 3000;
/** Cuánto se recuerda un veredicto claro (el null no se recuerda: se vuelve a intentar). */
const RECUERDA_MS = 60_000;
/** Por negocio Y por token: pegar un token nuevo no hereda el veredicto del viejo (un «Token vencido» que no se va). */
const recuerdo = new Map<string, { hasta: number; estado: EstadoAvisoCalendly }>();
const claveDelRecuerdo = (ws: number, token: string) => `${ws}:${createHash('sha256').update(token).digest('hex').slice(0, 16)}`;

/**
 * ¿Tiene el negocio alguna fila de ruteo de Calendly (el «Tipo de evento de R1/R2» o un evento vinculado a una etapa)? Es
 * lo que mira el webhook antes que nada (lib/webhook-routing.ts). null = no se pudo leer: no se afirma «falta».
 */
async function tieneRuteo(ws: number): Promise<boolean | null> {
  const { count, error } = await getSupabaseServer()
    .from('webhook_routing').select('identificador', { count: 'exact', head: true })
    .eq('servicio', 'calendly').eq('workspace_id', ws);
  return error || count == null ? null : count > 0;
}

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
  try {
    const token = await credWs('CALENDLY_API_TOKEN', ws);
    if (!token) return null;
    // El ruteo se lee SIEMPRE (es la base, y barato): recordarlo 60 s haría que, recién guardado el R1, la pantalla siguiera
    // diciendo «Falta el R1». Va en paralelo con Calendly, así que no suma espera.
    const ruteoP = tieneRuteo(ws).catch(() => null);
    const clave = claveDelRecuerdo(ws, token);
    const guardado = recuerdo.get(clave);
    const vigente = guardado && guardado.hasta > Date.now() ? guardado.estado : null;
    const delAviso = vigente ?? (await leerElAviso(token));
    if (delAviso && !vigente) recuerdo.set(clave, { hasta: Date.now() + RECUERDA_MS, estado: delAviso });
    // Un 401 y la falta de ruteo son respuestas CLARAS, y ganan sobre el aviso: con cualquiera de las dos no entra ninguna
    // reserva, ande o no el aviso (`estadoAntesDelAviso`).
    return estadoAntesDelAviso({ tokenVencido: delAviso === 'token-vencido', ruteo: await ruteoP }) ?? delAviso;
  } catch (e) {
    console.warn('[calendly-aviso] no pude leer el aviso:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Lo que dice Calendly, con UN tope para toda la cadena: el aviso, o «token-vencido» si rechaza el token. null = no sé. */
async function leerElAviso(token: string): Promise<EstadoAvisoCalendly | null> {
  const senal = AbortSignal.timeout(ESPERA_MS);
  const me = await leer<{ resource?: { uri?: string; current_organization?: string } }>(token, '/users/me', senal);
  if (me.status === 401) return 'token-vencido';
  const org = me.json?.resource?.current_organization;
  const user = me.json?.resource?.uri;
  if (!org || !user) return null;
  const qOrg = new URLSearchParams({ organization: org, scope: 'organization', count: '100' });
  const qUser = new URLSearchParams({ organization: org, user, scope: 'user', count: '100' });
  const [deOrg, deUser] = await Promise.all([
    leer<{ collection?: SuscripcionCalendly[] }>(token, `/webhook_subscriptions?${qOrg}`, senal),
    leer<{ collection?: SuscripcionCalendly[] }>(token, `/webhook_subscriptions?${qUser}`, senal),
  ]);
  return estadoDeLasLecturas({
    org: deOrg.json ? (deOrg.json.collection ?? []) : deOrg.status === 403 ? 'sin-permiso' : null,
    user: deUser.json ? (deUser.json.collection ?? []) : null,
  });
}
