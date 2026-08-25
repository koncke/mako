// =============================================================================
// timezone — zona horaria POR WORKSPACE (base para crons/avisos multi-tenant)
// =============================================================================
// Hasta ahora todo el negocio se anclaba a 'America/Tijuana' (donde vive el primer
// cliente). Con multi-inquilino cada workspace puede estar en otra zona: la
// guardamos en app_settings (key mako.timezone) por workspace y la resolvemos con
// tzDeWorkspace(ws). Los crons corren en UTC (Vercel); esta zona es solo para
// CALENDARIZAR ("hoy", "ayer") y para MOSTRAR a qué hora local dispara algo.

import 'server-only';
import { getSetting, setSetting } from '@/lib/settings';
import { getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { hoyEnTz, TZ_TIJUANA } from '@/lib/date-utils';

// El literal vive en date-utils (que NO es server-only): los componentes de
// cliente necesitan la zona por defecto para su primer render y no pueden
// importar este módulo. Duplicarlo era garantizar que un día se separen.
export const TZ_DEFAULT = TZ_TIJUANA;
export const KEY_TIMEZONE = 'mako.timezone';

/**
 * Zona horaria del workspace. Si no está guardada, SE AVERIGUA y se guarda.
 *
 * ⚠️ EL CASO (2026-08-25). Un cliente argentino agendó una reunión y le quedó
 * preseteada en horario de México. La causa no era un cálculo mal hecho: era que
 * `setTimezoneWorkspace` —que existe desde que se hizo multi-inquilino— **no tenía
 * un solo call-site**. Nadie fijaba nunca la zona, así que TODOS los clientes
 * caían al default (`America/Tijuana`, donde vive el primer cliente) y no había
 * forma de cambiarlo desde la app. Medido: de 8 workspaces, uno solo tenía zona, y
 * estaba puesta a mano en la base.
 *
 * Es el mismo patrón que ya mordió con la cara de marca: una función correcta que
 * nadie llama. **Un setter sin call-site es un default disfrazado de configuración**
 * — y el peor tipo de default, porque la pantalla sugiere que se puede cambiar.
 *
 * El arreglo va ACÁ, en el resolvedor, y no en los doce lugares que calendarizan:
 * así el que consulta la zona la obtiene bien sin tener que enterarse.
 */
export async function tzDeWorkspace(ws: number): Promise<string> {
  const tz = await runWithWorkspace(ws, () => getSetting(KEY_TIMEZONE));
  if (tz && esTzValida(tz)) return tz;
  return await resolverYGuardarTz(ws);
}

/**
 * El intento de averiguar la zona, UNA vez por proceso y por workspace.
 *
 * El memo no es una optimización de lujo: `tzDeWorkspace` se llama en caminos
 * calientes (el resumen de un lead, cada acción del doer) y sin él cada uno se
 * comería una llamada de red. Con el memo, el costo es un intento por arranque en
 * frío — y en cuanto se resuelve queda en la base, así que ni eso.
 */
const enCurso = new Map<number, Promise<string>>();

async function resolverYGuardarTz(ws: number): Promise<string> {
  const yaVa = enCurso.get(ws);
  if (yaVa) return yaVa;
  const p = (async () => {
    // ⚠️ CON TECHO. `tzDeWorkspace` se llama adentro de renders y de turnos de
    // WhatsApp: un proveedor colgado no puede frenar la pantalla de nadie por
    // averiguar una zona horaria. Medido antes de esto: un workspace sin Cal.com
    // tardaba 3,9 s en caer al default, y son dos fuentes con 5 s cada una.
    //
    // Si no llega a tiempo se devuelve el default SIN GUARDARLO: guardar un
    // default que no se pudo verificar es convertir «no pude averiguarlo» en «esta
    // es su zona», y eso ya no se vuelve a intentar nunca. Sin guardar, el próximo
    // arranque en frío reintenta.
    const hallada = await Promise.race([
      averiguarTz(ws).catch(() => null),
      new Promise<null>((r) => setTimeout(() => r(null), 4000)),
    ]);
    if (!hallada) return TZ_DEFAULT;
    // Se GUARDA: la próxima lectura no vuelve a salir a la red, y sobre todo queda
    // visible en la base para quien audite por qué un cliente calendariza así.
    await setTimezoneWorkspace(ws, hallada).catch(() => {});
    console.log(`[timezone] ws=${ws} zona resuelta a ${hallada} (estaba sin fijar)`);
    return hallada;
  })();
  enCurso.set(ws, p);
  return p;
}

/**
 * Las fuentes, EN ORDEN DE AUTORIDAD.
 *
 * Las dos primeras son lo que el cliente ELIGIÓ en su propia herramienta de
 * agenda: no hay nada más confiable que eso. El teléfono es una inferencia y va
 * último, con la lista de países de una sola zona (ver `tzDeTelefono`): para +52 o
 * +1 la lada no dice la hora y adivinar sería peor que el default.
 */
async function averiguarTz(ws: number): Promise<string | null> {
  const { credWs } = await import('./credenciales');

  // 1. Cal.com — `GET /me` trae `timeZone`.
  const calKey = await runWithWorkspace(ws, () => credWs('CALCOM_API_KEY', ws)).catch(() => null);
  if (calKey) {
    const { tzDeCalcom } = await import('./calcom');
    const tz = await tzDeCalcom(calKey);
    if (tz && esTzValida(tz)) return tz;
  }

  // 2. Google Calendar — el `timeZone` de `calendars/primary`.
  const { tzDelCalendarioGoogle } = await import('./google-calendar');
  const tzG = await runWithWorkspace(ws, () => tzDelCalendarioGoogle()).catch(() => null);
  if (tzG && esTzValida(tzG)) return tzG;

  // 3. El teléfono de los avisos, solo si su país tiene UNA sola zona.
  const { getDestinatariosDe } = await import('./notif-destinatarios');
  const dest = await getDestinatariosDe(ws).catch(() => null);
  const { tzDeTelefono } = await import('./paises');
  const tzT = tzDeTelefono(dest?.telefonos[0] ?? null);
  if (tzT && esTzValida(tzT)) return tzT;

  return null;
}

/** Zona del workspace ACTUAL. Nunca lanza: una zona rota no puede tirar la página. */
export async function tzActual(): Promise<string> {
  try {
    const ws = await getWorkspaceActual();
    return ws == null ? TZ_DEFAULT : await tzDeWorkspace(ws);
  } catch {
    return TZ_DEFAULT;
  }
}

/**
 * 'YYYY-MM-DD' de HOY en la zona del workspace actual.
 *
 * Es el reemplazo multi-inquilino de hoyEnTijuana() para las pantallas que le
 * muestran "hoy" a un cliente. Con Tijuana fijo, un workspace en Madrid a las
 * 03:00 todavía veía el día anterior: el `min` del selector de fecha dejaba elegir
 * un día ya vencido y el server (que filtra los horarios pasados en la zona del
 * WORKSPACE) devolvía el día vacío. Y al revés, un workspace por detrás de Tijuana
 * no podía elegir su propio hoy.
 *
 * El resto del repo sigue anclado a hoyEnTijuana: migrarlo entero es otra tarea.
 */
export async function hoyEnWorkspace(date: Date = new Date()): Promise<string> {
  return hoyEnTz(await tzActual(), date);
}

/** Fija la zona horaria del workspace (desde onboarding / configuraciones). */
export async function setTimezoneWorkspace(ws: number, tz: string): Promise<void> {
  if (!esTzValida(tz)) throw new Error(`Zona horaria inválida: ${tz}`);
  await runWithWorkspace(ws, () => setSetting(KEY_TIMEZONE, tz));
}

/** Valida que la zona sea una IANA que el runtime entienda. */
export function esTzValida(tz: string): boolean {
  try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); return true; } catch { return false; }
}
