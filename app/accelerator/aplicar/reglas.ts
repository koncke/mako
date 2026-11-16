// =============================================================================
// Lo que decide el formulario de /accelerator/aplicar, sin React (16/11/2026): el borrador, cómo se dibuja cada campo y el origen
// =============================================================================
// Lo usa ./FormularioAplicacion.tsx (en el navegador) y lo prueba tests/aplicacion-accelerator.test.ts. Las preguntas, cómo se
// valida cada una y quién califica NO viven acá: son el contrato, lib/aplicacion-accelerator.ts (el mismo que lee el servidor).
// Sin imports de servidor: va al navegador.
// =============================================================================

import { CAMPOS, LARGO_MAXIMO, SECCIONES, erroresDeLaSeccion, type Campo, type Respuestas, type Seccion } from '@/lib/aplicacion-accelerator';

/** Dónde se guarda el borrador en el navegador. Con la versión: si cambian las preguntas, un borrador viejo no se lee mal. */
export const CLAVE_BORRADOR = 'mako.aplicacion-accelerator.v1';
/** Un borrador de más de 30 días ya no se retoma: es otra persona, u otra decisión. */
export const VIGENCIA_BORRADOR_MS = 30 * 24 * 3600_000;

/** El id del control de un campo (el input, el textarea, o el primer radio o checkbox de su grupo). */
export const idDelCampo = (id: string) => `apl-${id}`;

/** El paso donde vive cada campo. */
export const pasoDelCampo = (id: string): number => SECCIONES.findIndex((s) => s.campos.some((c) => c.id === id));

/** El primer paso con algo sin completar, hasta `hasta` (inclusive): no se retoma en el paso 5 con el 2 a medias. */
export function pasoQueVale(r: Respuestas, hasta: number): number {
  const tope = Math.max(0, Math.min(Math.trunc(hasta) || 0, SECCIONES.length - 1));
  for (let i = 0; i < tope; i++) if (Object.keys(erroresDeLaSeccion(SECCIONES[i], r)).length) return i;
  return tope;
}

/**
 * LA APLICACIÓN YA ENVIADA (16/11/2026): quien calificó y cerró la pestaña sin elegir horario vuelve a ver su agenda (con lo que
 * escribió ya cargado), y nadie llena dos veces los cinco minutos ni le deja a Martín una aplicación repetida. Una semana; «Enviar
 * otra aplicación» la borra. Con `agendada` (Calendly avisó `calendly.event_scheduled`), quien vuelve lee que su llamada ya quedó
 * agendada y NO ve la agenda otra vez: sin esto, volvía a la agenda cargada y podía agendar dos llamadas.
 */
export const CLAVE_ENVIADA = 'mako.aplicacion-accelerator.enviada.v1';
export const VIGENCIA_ENVIADA_MS = 7 * 24 * 3600_000;
export const enviadaParaGuardar = (califica: boolean, r: Respuestas, ahora: number, agendada = false) =>
  JSON.stringify({ v: 1, califica, r, t: ahora, ...(agendada ? { agendada: true } : {}) });

/** La aplicación enviada que guardó este navegador, limpia; null si no hay, es vieja o no se entiende. */
export function enviadaLimpia(crudo: unknown, ahora: number): { califica: boolean; agendada: boolean; respuestas: Respuestas } | null {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return null;
  const o = crudo as { v?: unknown; califica?: unknown; r?: unknown; t?: unknown; agendada?: unknown };
  if (o.v !== 1 || typeof o.califica !== 'boolean' || typeof o.t !== 'number' || ahora - o.t > VIGENCIA_ENVIADA_MS) return null;
  const respuestas = respuestasLimpias(o.r);
  // Sólo quien califica tiene agenda: un «agendada» sin eso no se cree.
  return respuestas ? { califica: o.califica, agendada: o.califica && o.agendada === true, respuestas } : null;
}

/**
 * El borrador guardado, limpio: sólo los campos de la aplicación y cada uno con el tipo que le toca (lo de otra versión, o lo que
 * alguien escribió a mano en el navegador, se descarta). null = no hay nada que retomar.
 */
export function borradorLimpio(crudo: unknown, ahora: number): { paso: number; respuestas: Respuestas } | null {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return null;
  const o = crudo as { v?: unknown; paso?: unknown; r?: unknown; t?: unknown };
  if (o.v !== 1 || typeof o.t !== 'number' || ahora - o.t > VIGENCIA_BORRADOR_MS) return null;
  const respuestas = respuestasLimpias(o.r);
  return respuestas ? { paso: pasoQueVale(respuestas, typeof o.paso === 'number' ? o.paso : 0), respuestas } : null;
}

/** Las respuestas guardadas en el navegador, cada una con el tipo de su campo; null si no queda ninguna. */
function respuestasLimpias(crudas: unknown): Respuestas | null {
  if (!crudas || typeof crudas !== 'object' || Array.isArray(crudas)) return null;
  const guardadas = crudas as Record<string, unknown>;
  const r: Respuestas = {};
  for (const c of CAMPOS) {
    const v = guardadas[c.id];
    const n = c.opciones?.length ?? 0;
    if (c.tipo === 'una') {
      if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < n) r[c.id] = v;
    } else if (c.tipo === 'varias') {
      if (Array.isArray(v)) {
        const l = [...new Set(v.filter((i): i is number => typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < n))].sort((x, y) => x - y);
        if (l.length) r[c.id] = l;
      }
    } else if (c.tipo === 'confirmo') {
      if (v === true) r[c.id] = true;
    } else if (typeof v === 'string' && v) {
      r[c.id] = v.slice(0, LARGO_MAXIMO[c.tipo]);
    }
  }
  return Object.keys(r).length ? r : null;
}

/** Lo que se guarda en el navegador. */
export const borradorParaGuardar = (paso: number, r: Respuestas, ahora: number) => JSON.stringify({ v: 1, paso, r, t: ahora });

/** Las opciones van en dos columnas en la computadora, salvo que alguna sea larga (en el teléfono, siempre una). */
export const enUnaColumna = (c: Campo): boolean => (c.opciones ?? []).some((o) => o.length > 34);

/** Cómo se escribe cada campo de texto: el teclado del teléfono, el autocompletado y si corrige. */
export function entradaDe(c: Campo): {
  type: 'text' | 'email' | 'tel'; inputMode: 'text' | 'email' | 'tel' | 'url'; autoComplete: string;
  autoCapitalize?: 'none' | 'words'; spellCheck?: boolean;
} {
  switch (c.tipo) {
    case 'email': return { type: 'email', inputMode: 'email', autoComplete: c.autoComplete ?? 'email', autoCapitalize: 'none', spellCheck: false };
    case 'whatsapp': return { type: 'tel', inputMode: 'tel', autoComplete: c.autoComplete ?? 'tel' };
    // Un link sin «https://» (instagram.com/usuario) es válido acá: `type="url"` lo marcaría inválido.
    case 'link': return { type: 'text', inputMode: 'url', autoComplete: c.autoComplete ?? 'url', autoCapitalize: 'none', spellCheck: false };
    default: return { type: 'text', inputMode: 'text', autoComplete: c.autoComplete ?? 'off', ...(c.autoComplete?.endsWith('name') ? { autoCapitalize: 'words' as const } : {}) };
  }
}

/** Los campos de una sección en renglones: dos campos cortos seguidos (nombre y apellido, WhatsApp y email) van juntos. */
export function filasDeLaSeccion(s: Seccion): Campo[][] {
  const corto = (c: Campo) => (c.tipo === 'texto' || c.tipo === 'email' || c.tipo === 'whatsapp') && !c.ayuda;
  const filas: Campo[][] = [];
  for (const c of s.campos) {
    const ultima = filas[filas.length - 1];
    if (corto(c) && ultima?.length === 1 && corto(ultima[0])) ultima.push(c);
    else filas.push([c]);
  }
  return filas;
}

/** El nombre para el saludo de la pantalla final: el primero que escribió, limpio. */
export const nombreDelSaludo = (r: Respuestas): string => (typeof r.nombre === 'string' ? r.nombre.replace(/\s+/g, ' ').trim().split(' ')[0] ?? '' : '');

/**
 * El origen de la campaña si la URL de esta página no lo trae: el de la página de la que vino, si es de este mismo sitio (la
 * política de la casa manda la URL entera entre páginas del mismo origen). Así la campaña de un anuncio que llevó a /accelerator
 * no se pierde si el botón de la landing no la pasó. El servidor lo vuelve a limpiar (`origenLimpio`).
 */
export function origenDelReferer(referer: string, actual: string, claves: readonly string[]): Record<string, string> | null {
  try {
    const de = new URL(referer);
    if (de.origin !== new URL(actual).origin) return null;
    const out: Record<string, string> = {};
    for (const k of claves) {
      const v = de.searchParams.get(k);
      if (v) out[k] = v;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}
