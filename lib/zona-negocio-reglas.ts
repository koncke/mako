// =============================================================================
// zona-negocio-reglas — LA zona horaria del negocio: un default, una canónica y quién la decide
// =============================================================================
// Decisión 4 de la décima tanda de Automations (11/10/2026), literal de Martín: «Si, siempre por
// ubicación que se maneje por defecto. Detectando la ubicacion del usuario.» Diseño en
// docs/diseno-undecima-tanda.md §2 (decisión 4) y §9 (25-27).
//
// ⚠️ EL REPO TENÍA DOS DEFAULTS Y NINGUNO ERA UNA DECISIÓN. `TZ_DEFAULT` = America/Tijuana
// (lib/timezone.ts, lib/date-utils.ts) para las pantallas, y `ZONA_SIN_CONFIGURAR` =
// America/Mexico_City (lib/nutricion-grafo-motor.ts) para el motor. El ws1 —Mauricio, Baja
// California— no tenía `mako.timezone`, tenía el horario de 9 a 21 prendido, y el motor lo medía en
// hora de CDMX: el envío #22 salió a las 08:00 de Tijuana, antes de su horario, mientras
// Configuraciones › Horario le mostraba «Ciudad de México» y el resto de la app, Tijuana.
// Acá vive EL default (`ZONA_POR_DEFECTO`) y LA regla de lectura (`zonaDeLoGuardado`) que usan el
// motor, el tick, las pantallas y la API.
//
// ⚠️ PURO Y SIN `server-only`: lo usan lib/timezone.ts (server), la acción que detecta, el script de
// backfill (scripts/zona-negocio-backfill.mts, sin Next) y lib/acento-workspace.ts (que también
// corre en el navegador). El test es tests/zona-negocio.test.ts.
//
// QUIÉN DECIDE LA ZONA (`decidirZona`), en orden de autoridad:
//   · 'persona'    — alguien la eligió en Configuraciones › Horario o se la pidió a MaKo. Gana siempre,
//                    y sólo otra persona la cambia.
//   · 'navegador'  — el navegador de un ADMIN PROPIO del negocio (nunca el del super admin mirando un
//                    cliente con ?ws=, ni una agencia, un setter o un closer). La PRIMERA detección gana:
//                    el dueño que viaja no le mueve la hora al negocio.
//   · 'ip', 'calendario', 'meta', 'telefono' — inferencias: sólo llenan un vacío.
//   · 'legado'     — lo que ya estaba guardado antes de registrar de dónde salía cada zona.
// =============================================================================

import { TZ_TIJUANA } from './date-utils';
import { ZONAS_POR_PAIS } from './disparadores';

/** LA zona de un negocio que todavía no tiene una: Tijuana, donde vive el primer cliente. El ÚNICO default. */
export const ZONA_POR_DEFECTO = TZ_TIJUANA;

/** Las dos claves de app_settings (por workspace). Viven acá para que el script de backfill —que no puede importar
 *  lib/timezone.ts, `server-only`— use las mismas; lib/timezone.ts las reexporta como KEY_TIMEZONE(_ORIGEN). */
export const CLAVE_ZONA = 'mako.timezone';
export const CLAVE_ZONA_ORIGEN = 'mako.timezone.origen';

/** De dónde salió la zona guardada (clave `mako.timezone.origen`, un JSON). */
export const ORIGENES_ZONA = ['persona', 'navegador', 'ip', 'calendario', 'meta', 'telefono', 'legado'] as const;
export type OrigenZona = (typeof ORIGENES_ZONA)[number];

/** Lo que se guarda en `mako.timezone.origen`. `tz` es la zona que ese origen escribió: si la guardada ya es
 *  otra (la escribió un camino que no registra origen), el origen no vale. */
export type OrigenGuardado = { origen: OrigenZona; por: string | null; at: string | null; tz?: string | null };

/** Qué hacer con una zona nueva: escribirla, SELLAR la que está (mismo reloj: se registra el origen nuevo
 *  sin cambiar la zona) o nada. */
export type DecisionZona = 'escribir' | 'sellar' | 'nada';

// ── La forma canónica ─────────────────────────────────────────────────────────────────────────────

/** El id ICU de una zona (lo que `Intl` resuelve: 'America/Argentina/Buenos_Aires' → 'America/Buenos_Aires'), o
 *  null si el runtime no la conoce. */
function idIcu(tz: string): string | null {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** id ICU → la zona tal como la escribe la lista de países del teléfono (`ZONAS_POR_PAIS`). Perezoso: construir
 *  ~80 formateadores al importar el módulo se pagaría también en el navegador. */
let porIcu: Map<string, string> | null = null;
function listaPorIcu(): Map<string, string> {
  if (porIcu) return porIcu;
  const m = new Map<string, string>();
  for (const zonas of Object.values(ZONAS_POR_PAIS)) {
    for (const z of zonas) {
      const icu = idIcu(z.tz);
      if (icu && !m.has(icu)) m.set(icu, z.tz);
    }
  }
  porIcu = m;
  return m;
}

/**
 * La zona en su forma canónica, o null si no es una zona que el runtime conozca.
 *
 * ⚠️ UN ALIAS NO ES OTRA ZONA, PERO SÍ ES OTRO TEXTO. Cal.com contesta `America/Buenos_Aires` (el alias viejo) y
 * así quedó guardado en el ws13; la tabla de acentos (`POR_ZONA`, lib/acento-workspace.ts) conoce
 * `America/Argentina/Buenos_Aires`, y el ws13 resolvía acento 'latam' en vez de 'ar'. Cualquier comparación por
 * texto falla igual. Por eso: si su id ICU coincide con una de la lista de países (`ZONAS_POR_PAIS`), se devuelve la
 * de la lista ('America/Buenos_Aires' → 'America/Argentina/Buenos_Aires', 'America/Ensenada' → 'America/Tijuana').
 * Una zona válida que no está en la lista vuelve tal cual (con la mayúscula de ICU si sólo difería en eso).
 */
export function zonaCanonica(tz: unknown): string | null {
  if (typeof tz !== 'string') return null;
  const t = tz.trim();
  if (!t || t.length > 64) return null;
  const icu = idIcu(t);
  if (!icu) return null;
  const deLaLista = listaPorIcu().get(icu);
  if (deLaLista) return deLaLista;
  return icu.toLowerCase() === t.toLowerCase() ? icu : t;
}

/** Zonas que no son un LUGAR: lo que reporta un navegador en modo privado o con la huella bloqueada (UTC,
 *  Etc/GMT+3) y las de siempre sin ciudad (EST5EDT, CET). */
const SIN_LUGAR = /^(?:Etc\/|Factory$|UTC$|UCT$|GMT|Universal$|Zulu$|Greenwich$)/i;

/**
 * La zona de una UBICACIÓN (la que reporta el navegador o el header de la IP), o null si no sirve para decir dónde
 * está el negocio: inválida, UTC, GMT, Etc/* o Factory. Un «UTC» de un navegador en privado no es Londres.
 */
export function zonaDeUbicacion(tz: unknown): string | null {
  const c = zonaCanonica(tz);
  if (!c) return null;
  const icu = idIcu(c) ?? c;
  if (SIN_LUGAR.test(c) || SIN_LUGAR.test(icu) || !c.includes('/')) return null;
  return c;
}

/**
 * LA REGLA DE LECTURA: la zona con la que corre todo (el motor, el tick, las pantallas y la API) a partir de lo
 * guardado en `mako.timezone`. Canónica si sirve; si no hay nada o está rota, `ZONA_POR_DEFECTO`. Nunca tira.
 */
export function zonaDeLoGuardado(valor: unknown): string {
  return zonaCanonica(valor) ?? ZONA_POR_DEFECTO;
}

// ── El mismo reloj ────────────────────────────────────────────────────────────────────────────────

/** Formateadores por zona, reusados (el patrón de app/crm/horarios-respuesta.ts:229): con uno nuevo por llamada,
 *  `mismoReloj` sobre un año costaba 10,7 s. */
const FMT = new Map<string, Intl.DateTimeFormat>();
function fmtDe(tz: string): Intl.DateTimeFormat {
  let f = FMT.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    FMT.set(tz, f);
  }
  return f;
}

/** Cuánto está corrida `tz` de UTC en ese instante (minutos, con el horario de verano incluido). */
function desfaseMin(tz: string, ms: number): number {
  const p = fmtDe(tz).formatToParts(new Date(ms));
  const g = (t: string): number => Number(p.find((x) => x.type === t)?.value);
  const local = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second'));
  return Math.round((local - Math.floor(ms / 1000) * 1000) / 60_000);
}

/**
 * ¿Las dos zonas marcan la misma hora durante el próximo año? Dos muestras por día (00 y 12 h desde `desdeMs`)
 * durante 366 días. Tijuana y Los Ángeles: sí, todo el año. Tijuana y Ciudad de México: no (1 h hasta el 1/11/2026 y
 * 2 h del 1/11 al 14/3/2027). Una zona inválida nunca tiene el mismo reloj que nada.
 */
export function mismoReloj(a: string, b: string, desdeMs: number = Date.now()): boolean {
  const za = zonaCanonica(a);
  const zb = zonaCanonica(b);
  if (!za || !zb) return false;
  if (za === zb) return true;
  for (let d = 0; d < 366; d++) {
    for (const h of [0, 12]) {
      const t = desdeMs + d * 86_400_000 + h * 3_600_000;
      if (desfaseMin(za, t) !== desfaseMin(zb, t)) return false;
    }
  }
  return true;
}

// ── El origen ─────────────────────────────────────────────────────────────────────────────────────

const esOrigen = (x: unknown): x is OrigenZona => typeof x === 'string' && (ORIGENES_ZONA as readonly string[]).includes(x);

/** Lee `mako.timezone.origen` (un JSON). Cualquier cosa que no sea un origen conocido → null (= sin origen). */
export function leerOrigen(raw: unknown): OrigenGuardado | null {
  let o: unknown = raw;
  if (typeof raw === 'string') {
    try { o = JSON.parse(raw); } catch { return null; }
  }
  if (!o || typeof o !== 'object') return null;
  const r = o as Record<string, unknown>;
  if (!esOrigen(r.origen)) return null;
  return {
    origen: r.origen,
    por: typeof r.por === 'string' && r.por.trim() ? r.por.trim() : null,
    at: typeof r.at === 'string' && r.at.trim() ? r.at.trim() : null,
    tz: typeof r.tz === 'string' && r.tz.trim() ? r.tz.trim() : null,
  };
}

/** El JSON que se guarda en `mako.timezone.origen`. */
export function origenParaGuardar(origen: OrigenZona, tz: string, por: string | null, at: Date = new Date()): string {
  return JSON.stringify({ origen, por: por?.trim() || null, at: at.toISOString(), tz });
}

/** El origen guardado VALE sólo si es de la zona que está guardada: una zona escrita por otro camino (un deploy
 *  viejo, `clonar-config`, la base a mano) deja al origen huérfano, y eso es «sin origen». */
export function origenVigente(origen: OrigenGuardado | null, tzGuardada: string | null): OrigenGuardado | null {
  if (!origen || !tzGuardada) return null;
  if (origen.tz && zonaCanonica(origen.tz) !== zonaCanonica(tzGuardada)) return null;
  return origen;
}

const fechaCorta = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-MX', { timeZone: ZONA_POR_DEFECTO, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
};

/** De dónde salió, en una frase corta («La eligió ana@x.com el 11/10/2026»). */
export function textoOrigen(o: { origen: OrigenZona | null; por?: string | null; at?: string | null } | null): string {
  if (!o?.origen) return 'Sin registro de dónde salió';
  const quien = o.por ? ` ${o.por}` : '';
  const cuando = fechaCorta(o.at ?? null);
  const el = cuando ? ` el ${cuando}` : '';
  switch (o.origen) {
    case 'persona': return `La eligió${quien || ' una persona'}${el}`;
    case 'navegador': return `Detectada por el navegador de${quien || ' un admin'}${el}`;
    case 'ip': return `Detectada por la conexión de${quien || ' un admin'}${el}`;
    case 'calendario': return `De su calendario${el}`;
    case 'meta': return `De su cuenta de Meta${el}`;
    case 'telefono': return `Del teléfono de sus avisos${el}`;
    case 'legado': return 'Ya estaba guardada';
  }
}

// ── La decisión ───────────────────────────────────────────────────────────────────────────────────

/**
 * ¿La zona nueva se escribe?
 *   · 'persona' escribe siempre (aunque sea la misma: queda registrada como elegida).
 *   · Una zona actual de 'persona' sólo la cambia otra persona.
 *   · 'navegador' pisa a una inferencia, a 'legado' o a una zona sin origen, pero NO a otro 'navegador': gana la
 *     primera detección (el dueño que viaja no le mueve la hora al negocio).
 *   · 'ip', 'calendario', 'meta' y 'telefono' sólo llenan un vacío.
 *   · El MISMO RELOJ no escribe (Tijuana y Los Ángeles: la zona del negocio no cambia de nombre por eso). Si el que
 *     llega es un 'navegador' que la confirma, se SELLA: se registra su origen sin tocar la zona. Sin el sello, la
 *     detección que confirma no contaba como la primera, y la del primer viaje del dueño pisaba la zona.
 *
 * `actual.tz` y `nueva.tz` se canonizan acá: un alias no es una zona distinta.
 */
export function decidirZona(
  actual: { tz: string | null; origen: OrigenZona | null },
  nueva: { tz: string; origen: OrigenZona },
  desdeMs: number = Date.now(),
): DecisionZona {
  const tzNueva = zonaCanonica(nueva.tz);
  if (!tzNueva || !esOrigen(nueva.origen)) return 'nada';
  if (nueva.origen === 'persona') return 'escribir';
  if (actual.origen === 'persona') return 'nada';
  const tzActual = zonaCanonica(actual.tz);
  if (!tzActual) return 'escribir';                       // un vacío lo llena cualquiera
  const yaDetectada = actual.origen === 'navegador';
  if (mismoReloj(tzActual, tzNueva, desdeMs)) {
    return nueva.origen === 'navegador' && !yaDetectada ? 'sellar' : 'nada';
  }
  if (nueva.origen === 'navegador') return yaDetectada ? 'nada' : 'escribir';
  return 'nada';                                          // 'ip', 'calendario', 'meta', 'telefono', 'legado': no pisan
}
