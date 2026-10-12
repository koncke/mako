// =============================================================================
// timezone — LA zona horaria del negocio: una lectura, un escritor y la inferencia aparte
// =============================================================================
// Cada workspace guarda su zona en app_settings (`mako.timezone`, IANA) y, desde la undécima tanda de
// Automations (11/10/2026), de dónde salió (`mako.timezone.origen`, un JSON: quién, cuándo, por qué vía).
// Los crons corren en UTC (Vercel): esta zona es la del negocio para CALENDARIZAR («hoy», «ayer», el horario
// de oficina) y para MOSTRAR horas. Las reglas puras viven en lib/zona-negocio-reglas.ts.
//
// Decisión 4 de la décima, literal de Martín: «Si, siempre por ubicación que se maneje por defecto. Detectando
// la ubicacion del usuario.» Diseño: docs/diseno-undecima-tanda.md §2 (decisión 4), §9 (25-27), §10.
//
// ⚠️ LA LECTURA YA NO SALE A LA RED NI ESCRIBE. Hasta el 11/10 `tzDeWorkspace` averiguaba la zona que faltaba
// (Cal.com → Google → teléfono, techo de 4 s) y la GUARDABA: una lectura con efectos. Tres módulos de la API
// tuvieron que reimplementar una lectura que no escribiera (contenido.helpers, email.helpers, equipo.run), y el
// motor tenía su propio default (Ciudad de México) para no pagar la carrera de red por tick. Ahora:
//   · `zonaDelNegocio(ws)` / `zonaDelNegocioDetalle(ws)` — UNA consulta por ws explícito, memo de 30 s, nunca
//     tira (un error de lectura da el default, no se memoriza y se loguea). `tzDeWorkspace` es ESTA función con
//     su nombre de siempre: sus ~53 llamadas quedan bien sin tocarlas.
//   · `zonaDelNegocioEstricta(ws)` — la misma lectura, pero «no pude leer» TIRA (para el motor: no manda fuera
//     de horario por un 5xx de Supabase).
//   · `fijarZonaDelNegocio(ws, tz, origen, por)` — el ÚNICO escritor. Decide con `decidirZona` y escribe con
//     compare-and-set sobre `updated_at`.
//   · `inferirZonaDesdeIntegraciones(ws)` — el averiguar de antes (Cal.com → Google → Meta → teléfono). Ya no lo
//     llama ninguna lectura: lo usa la detección (app/_components/zona-actions.ts) cuando quien mira NO es un admin
//     propio del negocio y la zona falta.

import 'server-only';
import { getSupabaseServer } from '@/lib/supabase';
import { getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { hoyEnTz } from '@/lib/date-utils';
import {
  ZONA_POR_DEFECTO, CLAVE_ZONA, CLAVE_ZONA_ORIGEN, zonaCanonica, zonaDeUbicacion, leerOrigen, origenVigente, origenParaGuardar, decidirZona,
  type OrigenZona, type OrigenGuardado, type DecisionZona,
} from '@/lib/zona-negocio-reglas';

// El literal vive en date-utils (que NO es server-only): los componentes de cliente necesitan la zona por defecto
// para su primer render y no pueden importar este módulo. `ZONA_POR_DEFECTO` es el mismo literal.
export const TZ_DEFAULT = ZONA_POR_DEFECTO;
export const KEY_TIMEZONE = CLAVE_ZONA;
export const KEY_TIMEZONE_ORIGEN = CLAVE_ZONA_ORIGEN;

/** La zona del negocio: la que se usa (`tz`), si está guardada y de dónde salió (null = sin registro). */
export type ZonaDetalle = { tz: string; guardada: boolean; origen: OrigenGuardado | null };

const SIN_ZONA: ZonaDetalle = { tz: ZONA_POR_DEFECTO, guardada: false, origen: null };

// ── La lectura ────────────────────────────────────────────────────────────────────────────────────

/** Lo guardado, crudo. `tzUpdatedAt` undefined = la fila no existe (para el compare-and-set del escritor). */
type Crudo = { tz: string | null; tzUpdatedAt: string | undefined; origenRaw: string | null };

const wsValido = (ws: unknown): ws is number => typeof ws === 'number' && Number.isInteger(ws) && ws > 0;

/** UNA consulta, por ws EXPLÍCITO (nunca el del ambiente: un cron que itera inquilinos pasa el suyo). Tira si no
 *  puede leer. */
async function leerCrudo(ws: number): Promise<Crudo> {
  const { data, error } = await getSupabaseServer()
    .from('app_settings')
    .select('key, value, updated_at')
    .eq('workspace_id', ws)
    .in('key', [KEY_TIMEZONE, KEY_TIMEZONE_ORIGEN]);
  if (error) throw new Error(`No pude leer la zona del ws ${ws}: ${error.message}`);
  const filas = (data ?? []) as Array<{ key: string; value: string | null; updated_at: string | null }>;
  const fTz = filas.find((f) => f.key === KEY_TIMEZONE);
  const fOrigen = filas.find((f) => f.key === KEY_TIMEZONE_ORIGEN);
  return {
    tz: fTz ? (fTz.value ?? '') : null,
    tzUpdatedAt: fTz ? (fTz.updated_at ?? '') : undefined,
    origenRaw: fOrigen?.value ?? null,
  };
}

function detalleDe(c: Crudo): ZonaDetalle {
  const tz = zonaCanonica(c.tz);
  return { tz: tz ?? ZONA_POR_DEFECTO, guardada: tz != null, origen: origenVigente(leerOrigen(c.origenRaw), tz) };
}

/**
 * Memo por proceso, 30 s por ws. `tzDeWorkspace` se llama en caminos calientes (el resumen de un lead, cada
 * acción del doer, cada tarjeta del motor): sin memo, una consulta por llamada. Se guarda la PROMESA (dos llamadas
 * simultáneas comparten la consulta) y se borra si falla: un error no se memoriza.
 */
const MEMO_MS = 30_000;
const memo = new Map<number, { hasta: number; p: Promise<ZonaDetalle> }>();

/** El escritor olvida el memo de ESE ws en este proceso; los demás procesos lo ven a los ≤ 30 s. */
function olvidarZona(ws: number): void {
  memo.delete(ws);
}

function detalleEstricto(ws: number): Promise<ZonaDetalle> {
  if (!wsValido(ws)) return Promise.reject(new Error(`zona del negocio: workspace inválido (${String(ws)})`));
  const m = memo.get(ws);
  if (m && m.hasta > Date.now()) return m.p;
  const p = leerCrudo(ws).then(detalleDe);
  memo.set(ws, { hasta: Date.now() + MEMO_MS, p });
  p.catch(() => { if (memo.get(ws)?.p === p) memo.delete(ws); });
  return p;
}

/**
 * La zona del negocio con su detalle. NUNCA tira: «no pude leer» devuelve el default (sin memorizarlo) y lo
 * loguea. Para decidir algo destructivo con la zona, `zonaDelNegocioEstricta`.
 */
export async function zonaDelNegocioDetalle(ws: number): Promise<ZonaDetalle> {
  try {
    return await detalleEstricto(ws);
  } catch (e) {
    console.error(`[zona] ws=${String(ws)}: ${e instanceof Error ? e.message : String(e)} — se usa ${ZONA_POR_DEFECTO}`);
    return { ...SIN_ZONA };
  }
}

/** LA zona del negocio (IANA canónica). Nunca tira. */
export async function zonaDelNegocio(ws: number): Promise<string> {
  return (await zonaDelNegocioDetalle(ws)).tz;
}

/** La misma lectura, pero si no puede leer TIRA: para el motor, que no puede tratar un 5xx como «sin zona». */
export async function zonaDelNegocioEstricta(ws: number): Promise<string> {
  return (await detalleEstricto(ws)).tz;
}

/**
 * Zona horaria del workspace. ES `zonaDelNegocio`, con el nombre de siempre.
 *
 * ⚠️ EL CASO (2026-08-25). Un cliente argentino agendó una reunión y le quedó preseteada en horario de México:
 * `setTimezoneWorkspace` no tenía un solo call-site y todos caían al default. El arreglo de entonces fue averiguar
 * la zona ACÁ, en la lectura, y guardarla. Desde el 11/10/2026 la zona la fija la detección por el navegador de los
 * admins del negocio (app/_components/zona-actions.ts) y, para los que nadie abre, las integraciones del cliente
 * (`inferirZonaDesdeIntegraciones`) y el backfill (scripts/zona-negocio-backfill.mts). Una lectura no escribe.
 */
export async function tzDeWorkspace(ws: number): Promise<string> {
  return zonaDelNegocio(ws);
}

/** Zona del workspace ACTUAL. Nunca lanza: una zona rota no puede tirar la página. */
export async function tzActual(): Promise<string> {
  try {
    const ws = await getWorkspaceActual();
    return ws == null ? TZ_DEFAULT : await zonaDelNegocio(ws);
  } catch {
    return TZ_DEFAULT;
  }
}

/**
 * 'YYYY-MM-DD' de HOY en la zona del workspace actual.
 *
 * Es el reemplazo multi-inquilino de hoyEnTijuana() para las pantallas que le muestran "hoy" a un cliente. Con
 * Tijuana fijo, un workspace en Madrid a las 03:00 todavía veía el día anterior.
 */
export async function hoyEnWorkspace(date: Date = new Date()): Promise<string> {
  return hoyEnTz(await tzActual(), date);
}

// ── El escritor ───────────────────────────────────────────────────────────────────────────────────

export type ResultadoZona = {
  ok: boolean;
  /** la zona que queda (la de antes si no se escribió) */
  zona: string;
  /** true si la zona cambió */
  cambio: boolean;
  decision?: DecisionZona;
  error?: string;
};

/**
 * Compare-and-set sobre `updated_at`: update si la fila existía (y nadie la tocó desde que se leyó), insert SIN
 * upsert si no existía (si alguien la creó en el medio, choca). Devuelve si ganó.
 */
async function escribirZonaSi(ws: number, valor: string, leidoUpdatedAt: string | undefined): Promise<boolean> {
  const db = getSupabaseServer();
  const ahora = new Date().toISOString();
  if (leidoUpdatedAt === undefined) {
    const { error } = await db.from('app_settings').insert({ workspace_id: ws, key: KEY_TIMEZONE, value: valor, updated_at: ahora });
    if (!error) return true;
    if (error.code === '23505') return false;
    throw new Error(`No pude guardar la zona del ws ${ws}: ${error.message}`);
  }
  let q = db.from('app_settings').update({ value: valor, updated_at: ahora }).eq('workspace_id', ws).eq('key', KEY_TIMEZONE);
  q = leidoUpdatedAt ? q.eq('updated_at', leidoUpdatedAt) : q.is('updated_at', null);
  const { data, error } = await q.select('key');
  if (error) throw new Error(`No pude guardar la zona del ws ${ws}: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/**
 * EL ÚNICO ESCRITOR de la zona del negocio.
 *
 * Canoniza, relee SIN memo, decide con `decidirZona` (lib/zona-negocio-reglas.ts) y escribe las dos claves: primero
 * la zona con compare-and-set (todos los escritores se ordenan ahí: si otro ganó en el medio, se relee y se vuelve a
 * decidir), después el origen. 'sellar' reescribe la MISMA zona (canónica) sólo para registrar el origen.
 *
 * ⚠️ Queda una ventana de ~100 ms entre las dos escrituras en la que otro escritor ve la zona nueva con el origen
 * viejo (huérfano: `origenVigente` lo trata como «sin origen»). Para que muerda, una persona y una detección tienen
 * que escribir la zona del MISMO negocio en la misma décima de segundo.
 */
export async function fijarZonaDelNegocio(ws: number, tz: string, origen: OrigenZona, por: string | null): Promise<ResultadoZona> {
  const nueva = zonaCanonica(tz);
  if (!nueva) return { ok: false, zona: ZONA_POR_DEFECTO, cambio: false, error: `Zona horaria inválida: ${String(tz).slice(0, 64)}` };
  if (!wsValido(ws)) return { ok: false, zona: ZONA_POR_DEFECTO, cambio: false, error: `Workspace inválido: ${String(ws)}` };
  let antes: string | null = null;
  try {
    for (let intento = 0; intento < 3; intento++) {
      const c = await leerCrudo(ws);
      antes = zonaCanonica(c.tz);
      const vigente = origenVigente(leerOrigen(c.origenRaw), antes);
      const decision = decidirZona({ tz: antes, origen: vigente?.origen ?? null }, { tz: nueva, origen });
      if (decision === 'nada') return { ok: true, zona: antes ?? ZONA_POR_DEFECTO, cambio: false, decision };
      const escribe = decision === 'escribir' || !antes ? nueva : antes;
      if (!(await escribirZonaSi(ws, escribe, c.tzUpdatedAt))) continue;   // otro escribió en el medio: se relee
      olvidarZona(ws);
      const { error } = await getSupabaseServer().from('app_settings').upsert(
        { workspace_id: ws, key: KEY_TIMEZONE_ORIGEN, value: origenParaGuardar(origen, escribe, por), updated_at: new Date().toISOString() },
        { onConflict: 'workspace_id,key' },
      );
      console.log(`[zona] ws=${ws} ${escribe === antes ? `sellada ${escribe}` : `${antes ?? '(sin zona)'} → ${escribe}`} · origen ${origen}${por ? ` · ${por}` : ''}`);
      if (error) {
        // La zona YA quedó: decir «no se guardó» sería mentir. Se avisa que falta el origen (la próxima detección
        // la va a tratar como «sin origen»).
        console.error(`[zona] ws=${ws}: la zona quedó en ${escribe} pero no su origen: ${error.message}`);
        return { ok: true, zona: escribe, cambio: escribe !== antes, decision, error: 'No se registró de dónde salió la zona.' };
      }
      return { ok: true, zona: escribe, cambio: escribe !== antes, decision };
    }
    return { ok: false, zona: antes ?? ZONA_POR_DEFECTO, cambio: false, error: 'Otra escritura de la zona ganó tres veces seguidas.' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[zona] ws=${ws}: ${msg}`);
    return { ok: false, zona: antes ?? ZONA_POR_DEFECTO, cambio: false, error: msg };
  }
}

/** Una PERSONA fija la zona del negocio (el envoltorio de siempre). Tira si no se pudo. */
export async function setTimezoneWorkspace(ws: number, tz: string, por: string | null = null): Promise<void> {
  const r = await fijarZonaDelNegocio(ws, tz, 'persona', por);
  if (!r.ok) throw new Error(r.error ?? `No se pudo fijar la zona ${tz}`);
}

/** Valida que la zona sea una IANA que el runtime entienda. */
export function esTzValida(tz: string): boolean {
  return zonaCanonica(tz) != null;
}

// ── La inferencia (sale a la red; NO la llama ninguna lectura) ──────────────────────────────────────

export type ZonaInferida = { tz: string; origen: Extract<OrigenZona, 'calendario' | 'meta' | 'telefono'> };

/** Un intento por proceso y por ws cada 15 min: quien mira un cliente sin zona no paga la red en cada pantalla. */
const INFERIDA_MS = 15 * 60_000;
const inferidas = new Map<number, { hasta: number; p: Promise<ZonaInferida | null> }>();

/**
 * La zona que dicen las integraciones DEL CLIENTE, o null. Con techo de 4 s: un proveedor colgado no frena nada.
 * No guarda: quien la use decide con `fijarZonaDelNegocio` (una inferencia sólo llena un vacío).
 */
export function inferirZonaDesdeIntegraciones(ws: number): Promise<ZonaInferida | null> {
  if (!wsValido(ws)) return Promise.resolve(null);
  const m = inferidas.get(ws);
  if (m && m.hasta > Date.now()) return m.p;
  const p = Promise.race([
    averiguarZona(ws).catch(() => null),
    new Promise<null>((r) => setTimeout(() => r(null), 4000)),
  ]);
  inferidas.set(ws, { hasta: Date.now() + INFERIDA_MS, p });
  return p;
}

/**
 * Las fuentes, EN ORDEN DE AUTORIDAD.
 *
 * Cal.com y Google son lo que el cliente ELIGIÓ en su herramienta de agenda. Después la cuenta publicitaria de Meta:
 * su `timezone_name` es la zona con la que se eligió operar (AGENTS.md: el país fiscal no sirve, la zona sí; el ws1 y
 * el ws4 dicen America/Tijuana, el ws11 America/Cancun). El teléfono es una inferencia y va último, sólo si su país
 * tiene UNA sola zona (`tzDeTelefono`): para +52 o +1 la lada no dice la hora.
 */
async function averiguarZona(ws: number): Promise<ZonaInferida | null> {
  return runWithWorkspace(ws, async (): Promise<ZonaInferida | null> => {
    const { credWs } = await import('./credenciales');

    // 1. Cal.com — `GET /me` trae `timeZone`.
    const calKey = await credWs('CALCOM_API_KEY', ws).catch(() => null);
    if (calKey) {
      const { tzDeCalcom } = await import('./calcom');
      const tz = zonaDeUbicacion(await tzDeCalcom(calKey).catch(() => null));
      if (tz) return { tz, origen: 'calendario' };
    }

    // 2. Google Calendar — el `timeZone` de `calendars/primary`.
    const { tzDelCalendarioGoogle } = await import('./google-calendar');
    const tzG = zonaDeUbicacion(await tzDelCalendarioGoogle().catch(() => null));
    if (tzG) return { tz: tzG, origen: 'calendario' };

    // 3. Meta — el `timezone_name` de la cuenta publicitaria.
    const { cuentaMeta } = await import('./meta-ads-create');
    const tzM = zonaDeUbicacion((await cuentaMeta().catch(() => null))?.timezoneName ?? null);
    if (tzM) return { tz: tzM, origen: 'meta' };

    // 4. El teléfono de los avisos, solo si su país tiene UNA sola zona.
    const { getDestinatariosDe } = await import('./notif-destinatarios');
    const dest = await getDestinatariosDe(ws).catch(() => null);
    const { tzDeTelefono } = await import('./paises');
    const tzT = zonaDeUbicacion(tzDeTelefono(dest?.telefonos[0] ?? null));
    if (tzT) return { tz: tzT, origen: 'telefono' };

    return null;
  });
}
