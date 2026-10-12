// =============================================================================
// api-mako/areas/contenido.helpers — lo que el área `contenido` necesita y no exporta lib/
// =============================================================================
// Cinco cosas, y las cinco son DEUDA:
//
//  1. ESCRIBIR UN GUION «COMPLETO» NO EXISTE COMO FUNCIÓN. La composición (sugerir
//     ángulo → elegir el formato de video si falta → generarGuion con el texto del
//     formato) vive inline en app/api/onboarding/razones/route.ts (actions 'guion' y
//     'guion-auto'). Se copió aquí la MISMA secuencia; el día que exista
//     lib/razones.ts → escribirGuion/escribirGuionAuto, esto se borra.
//     ⚠️ El timeoutMs de chatCheapCascade es POR PROVEEDOR (CASCADA_DOCS tiene 5): tres
//     pasos de 12+6+25 s pueden sumar minutos si la cascada cae de proveedor en
//     proveedor. Por eso hay un PRESUPUESTO TOTAL (un deadline absoluto de 50 s): antes
//     de cada paso se mira cuánto queda, el paso opcional se saltea y el guion no
//     arranca si no alcanza. Sigue sin ser una garantía dura (un paso que ya arrancó
//     puede pasarse si su cascada cae), pero ya no se encadenan tres techos nominales.
//     ⚠️ Nada de Promise.race alrededor de generarGuion/elegirAngulo: la lib ESCRIBE al
//     final, y cortar la espera dejaría un guion guardado que se reporta como fallido
//     (y un reintento lo duplica). La carrera (`conTope`) solo va donde la escritura
//     es nuestra y viene DESPUÉS (recomendarFormatos, que no acepta timeoutMs).
//  2. PARTIR UN GUION EN BLOQUES. El parser vive SOLO en app/components/SeccionCard.tsx
//     (`parsearSecciones`), que es 'use client': importarlo desde el server da una
//     referencia de cliente, no la función. Se replicó la regla mínima (línea sola
//     en MAYÚSCULA = rótulo), acotada a los rótulos de la estructura cuando se conoce.
//  3. EL DÍA DE UN GUION EN LA ZONA DEL NEGOCIO, con LA lectura de la zona
//     (`zonaDelNegocioDetalle`, lib/timezone.ts: no sale a la red ni escribe). Hasta el
//     11/10/2026 se leía la clave a mano porque `tzDeWorkspace` la averiguaba y la guardaba.
//     `fechaGuion`/`diaGuion` de lib/guion-estado.ts usan la zona del PROCESO (UTC en
//     Vercel), que corre un guion de la noche al día siguiente.
//  4. LEER LA MATRIZ SIN CONFUNDIR «NO PUDE LEER» CON «NO HAY». getRazones lee con
//     getSetting, que convierte un error de Supabase en null, y null en []: una lectura
//     caída se reportaba como «el negocio no tiene anuncios». Aquí se lee con
//     getSettingEstricto (tira) y se normaliza con la MISMA getRazones; si la cruda
//     tenía celdas y la normalizada vino vacía, también tira.
//  5. `grabadoComo` NO SOBREVIVE A getRazones: normalizarGuion (lib/razones.ts) no lo
//     copia, así que se saca del JSON crudo. ⚠️ Y por lo mismo, TODA escritura de la lib
//     que relee y reescribe la matriz (setEstadoGuion, editarTextoGuion,
//     borrarGuionDeCelda, generarGuion, elegirAngulo) la guarda SIN grabadoComo: lo
//     borra de todos los guiones del negocio. Arreglo pendiente en lib/razones.ts.
// =============================================================================

import 'server-only';
import { createHash } from 'node:crypto';
import { getRazones, sugerirGuion, generarGuion, type GuionItem, type RazonCelda } from '@/lib/razones';
import { elegirAngulo, formatoPorId } from '@/lib/angulos-formatos';
import { getSettingEstricto } from '@/lib/settings';
import { TZ_DEFAULT, zonaDelNegocioDetalle } from '@/lib/timezone';
import { getWorkspaceActual } from '@/lib/workspace';

// ── 4 y 5. La matriz, leída en estricto ──────────────────────────────────────

/** La clave de lib/razones.ts (SETTING_KEY, no exportada). Si cambia allá, esto lee otra cosa. */
const KEY_RAZONES = 'mako.razones';

const claveGuion = (celdaId: string, guionId: string): string => `${celdaId}\u0000${guionId}`;

/**
 * La matriz, o una excepción si no se pudo leer. Nunca devuelve [] por un error.
 * `grabadoComo` va aparte, por (celdaId, guionId), leído del JSON crudo.
 */
export async function leerMatrizEstricta(): Promise<{ razones: RazonCelda[]; grabadoComo: Map<string, string[]> }> {
  const raw = await getSettingEstricto(KEY_RAZONES);
  const grabadoComo = new Map<string, string[]>();
  if (!raw) return { razones: [], grabadoComo };
  let crudas: unknown[] = [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) crudas = p;
  } catch { /* JSON roto: getRazones también da [], y es lo que la tab ve */ }
  const razones = await getRazones();
  const tieneCeldas = crudas.some((c) => !!c && typeof c === 'object' && typeof (c as Record<string, unknown>).nombre === 'string' && ((c as Record<string, unknown>).nombre as string).trim());
  if (!razones.length && tieneCeldas) throw new Error('la segunda lectura de los anuncios volvió vacía');
  for (const c of crudas) {
    const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
    if (typeof o.id !== 'string' || !Array.isArray(o.guiones)) continue;
    for (const g of o.guiones) {
      const go = (g && typeof g === 'object' ? g : {}) as Record<string, unknown>;
      if (typeof go.id !== 'string' || !Array.isArray(go.grabadoComo)) continue;
      const lista = go.grabadoComo.filter((x): x is string => typeof x === 'string' && !!x.trim());
      if (lista.length) grabadoComo.set(claveGuion(o.id.trim(), go.id.trim()), lista);
    }
  }
  return { razones, grabadoComo };
}

export async function getRazonesEstricto(): Promise<RazonCelda[]> {
  return (await leerMatrizEstricta()).razones;
}

export const grabadoComoDe = (m: Map<string, string[]>, celdaId: string, guionId: string): string[] | null => m.get(claveGuion(celdaId, guionId)) ?? null;

/** Huella corta del texto de un guion: detecta que cambió o que es OTRO guion entre
 *  proponer y confirmar. No es la huella de dedup de lib/guiones-normalizar (esa
 *  ignora rótulos y puntuación a propósito, y devuelve el texto normalizado entero). */
export const huellaTexto = (texto: string): string => createHash('sha256').update(texto.trim()).digest('hex').slice(0, 16);

// ── 1. Escribir un guion ─────────────────────────────────────────────────────

/** Presupuesto TOTAL de una escritura (deadline absoluto). /api/v1 corre con maxDuration 60. */
const PRESUPUESTO_MS = 50000;
const T_SUGERIR_MS = 12000;
const T_FORMATO_MS = 6000;
const T_GUION_MS = 25000;
/** Por debajo de esto un paso no arranca: con menos, la IA no alcanza a contestar. */
const MIN_PASO_MS = 4000;
const MIN_GUION_MS = 15000;

type Reloj = { quedan: () => number };
const reloj = (total = PRESUPUESTO_MS): Reloj => {
  const fin = Date.now() + total;
  return { quedan: () => fin - Date.now() };
};

/** El formato de video del anuncio como texto para el prompt. Si el anuncio no tiene
 *  uno y el presupuesto alcanza, MaKo lo elige y lo PERSISTE (best-effort, igual que la
 *  ruta): un reintento no lo recalcula. Solo se llama desde ejecutar(). */
async function formatoVideoTexto(celdaId: string, r: Reloj): Promise<string | undefined> {
  let anguloVideo = (await getRazonesEstricto()).find((c) => c.id === celdaId)?.anguloVideo || '';
  if (!anguloVideo) {
    const t = Math.min(T_FORMATO_MS, r.quedan() - MIN_GUION_MS);
    if (t >= MIN_PASO_MS) {
      const a = await elegirAngulo(celdaId, 'video', t);
      if (a.ok) anguloVideo = a.formatoId;
    }
  }
  const fmt = anguloVideo ? formatoPorId(anguloVideo) : undefined;
  return fmt ? `${fmt.nombre} — ${fmt.descripcion} (ej: ${fmt.ejemplo})` : undefined;
}

const SIN_TIEMPO = 'Se acabó el tiempo antes de empezar a escribir el guion (la IA tardó en los pasos previos). No se guardó nada: vuelve a intentarlo en un momento.';

export type OpcionesGuion = {
  anguloId?: string;
  estructuraId?: string;
  siguientePaso?: string;
  respuestasAngulo?: Array<{ pregunta: string; respuesta: string }>;
  nota?: string;
};

/** La acción 'guion' de la ruta: con lo que decidió la persona. */
export async function escribirGuionConDecisiones(celdaId: string, o: OpcionesGuion): Promise<{ ok: true; guion: GuionItem } | { ok: false; error: string }> {
  const r = reloj();
  const formato = await formatoVideoTexto(celdaId, r);
  const t = Math.min(T_GUION_MS, r.quedan());
  if (t < MIN_GUION_MS) return { ok: false, error: SIN_TIEMPO };
  return generarGuion(celdaId, { ...o, formatoVideoTexto: formato, timeoutMs: t });
}

/** La acción 'guion-auto' de la ruta: MaKo decide todo. Si la sugerencia falla (o no
 *  hay tiempo para pedirla), se escribe igual con los defaults del catálogo. */
export async function escribirGuionAuto(celdaId: string): Promise<{ ok: true; guion: GuionItem; conSugerencia: boolean } | { ok: false; error: string }> {
  const r = reloj();
  const tSug = Math.min(T_SUGERIR_MS, r.quedan() - MIN_GUION_MS - T_FORMATO_MS);
  const sug = tSug >= MIN_PASO_MS ? await sugerirGuion(celdaId, { timeoutMs: tSug }) : ({ ok: false, error: 'sin tiempo' } as const);
  const formato = await formatoVideoTexto(celdaId, r);
  const t = Math.min(T_GUION_MS, r.quedan());
  if (t < MIN_GUION_MS) return { ok: false, error: SIN_TIEMPO };
  const g = await generarGuion(celdaId, {
    anguloId: sug.ok ? sug.sugerencia.anguloId : undefined,
    estructuraId: sug.ok ? sug.sugerencia.estructuraId : undefined,
    siguientePaso: sug.ok && sug.sugerencia.siguientePaso ? sug.sugerencia.siguientePaso : undefined,
    formatoVideoTexto: formato,
    timeoutMs: t,
  });
  return g.ok ? { ...g, conSugerencia: sug.ok } : g;
}

/** Espera `p` hasta `ms`. SOLO para promesas que no escriben nada (ver punto 1). */
export async function conTope<T>(p: Promise<T>, ms: number): Promise<T | 'tope'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tope = new Promise<'tope'>((res) => { timer = setTimeout(() => res('tope'), ms); });
  try {
    return await Promise.race([p, tope]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ── 2. Bloques de un guion ───────────────────────────────────────────────────

const esRotulo = (l: string): boolean => l.length > 0 && l.length <= 48 && l === l.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(l) && !/[a-záéíóúñ]/.test(l);
const sinMarcas = (l: string): string => l.trim().replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();

/**
 * Parte el texto por sus rótulos. Con `etiquetas` (las de la estructura) solo cuentan
 * esas: una frase gritada en mayúscula dentro de un bloque no abre otro. Lo que haya
 * antes del primer rótulo va en un bloque «SIN RÓTULO» (no se descarta: es texto del
 * guion). Sin ningún rótulo, devuelve un solo bloque con todo.
 */
export function bloquesDeGuion(texto: string, etiquetas: readonly string[] = []): Array<{ etiqueta: string; texto: string }> {
  const validas = new Set(etiquetas.map((e) => e.toUpperCase()));
  const out: Array<{ etiqueta: string; texto: string }> = [];
  let actual: { etiqueta: string; texto: string } | null = null;
  for (const raw of texto.replace(/\r/g, '').split('\n')) {
    const l = sinMarcas(raw);
    if (!l || l === '---') continue;
    const rot = l.replace(/[:：]$/, '');
    if (esRotulo(rot) && (!validas.size || validas.has(rot))) {
      actual = { etiqueta: rot, texto: '' };
      out.push(actual);
      continue;
    }
    if (!actual) { actual = { etiqueta: 'SIN RÓTULO', texto: '' }; out.push(actual); }
    actual.texto = actual.texto ? `${actual.texto}\n${l}` : l;
  }
  return out;
}

// ── 3. La zona del negocio, sin escribir ─────────────────────────────────────

/** La zona del negocio en curso (`fijada` = guardada), o la default. Nunca sale a la red ni guarda. */
export async function tzSinResolver(): Promise<{ tz: string; fijada: boolean }> {
  try {
    const ws = await getWorkspaceActual();
    if (ws == null) return { tz: TZ_DEFAULT, fijada: false };
    const d = await zonaDelNegocioDetalle(ws);
    return { tz: d.tz, fijada: d.guardada };
  } catch {
    return { tz: TZ_DEFAULT, fijada: false };
  }
}

/** 'YYYY-MM-DD' de un epoch ms en una zona. '' para 0 (guion sin fecha). */
export function diaEnTz(ms: number, tz: string): string {
  if (!ms) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}
