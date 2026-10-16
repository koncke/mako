// =============================================================================
// dato-evento — la CONDITION sobre los DATOS DEL EVENTO (16/10/2026)
// =============================================================================
// Martín (16/10, por Cerebro, punto C): «En SuperAdmin hay un montón de cosas que no son editables... Deberías crear CRON,
// CONDITION, {{}}, ACTIONS y muchas cosas personalizadas para SuperAdmin... Pero que TODO sea editable siempre». Y la
// causa de «el mensaje NO es igual» (el de Leila): un evento de la plataforma no admitía CONDITION —no trae lead—, así
// que el código elegía la frase según el caso y la fila no tenía el texto que salía.
//
// Esta es la pieza: una CONDITION por cada dato que trae el evento («Estado de la cuenta es Saldo impago», «Qué aviso
// es ≤ 3»), con el MISMO catálogo, el mismo editor y el mismo motor que las del lead. El campo es `dato:<clave>` (la
// clave de la variable, lib/variables-aviso.ts): estable, como todo id de condición. Se evalúa contra los datos que
// trae el evento (`ctx.datos` de la corrida), NUNCA leyendo un lead: un evento de la plataforma no tiene ninguno.
//
// «No sé» no es «no»: un dato que el evento no trajo NO se cumple, ni negado (la regla de todo el catálogo).
//
// PURO: lo usan lib/condiciones-catalogo.ts (la def de cada dato), lib/flujos.ts (los hechos de la corrida),
// lib/aviso-evento.ts (qué condición admite cada evento) y tests/dato-evento.test.ts.
// =============================================================================

import type { HechosLead } from './flujo-grafo';

export const PREFIJO_DATO = 'dato:';

/** El campo de la condición de un dato: `dato:anuncios_estado`. */
export const campoDeDato = (clave: string): string => `${PREFIJO_DATO}${clave}`;

/** La clave del dato de un campo, o null si el campo no es de un dato del evento. */
export function datoDeCampo(campo: unknown): string | null {
  if (typeof campo !== 'string' || !campo.startsWith(PREFIJO_DATO)) return null;
  const k = campo.slice(PREFIJO_DATO.length);
  return /^[a-z][a-z0-9_]{0,60}$/.test(k) ? k : null;
}

/** ¿Todas estas filas son de datos del evento? (sin ninguna, no: no hay nada que decidir sin leer un lead). */
export const soloDatosDelEvento = (filas: ReadonlyArray<{ campo: unknown }>): boolean =>
  filas.length > 0 && filas.every((f) => datoDeCampo(f.campo) != null);

const plano = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * ¿Se cumple la fila de un dato? `tipo`: cómo es el dato (el de su variable). Un número se compara con ≥ (de fábrica) o
 * ≤; un texto o una opción, igual sin tildes ni mayúsculas. `null` = el evento no trajo el dato: no se sabe.
 */
export function cumpleDato(
  f: { campo: unknown; valor?: string | number | null; op?: 'mayor_igual' | 'menor_igual' },
  datos: Readonly<Record<string, string>> | null | undefined,
  tipo: 'numero' | 'texto',
): boolean | null {
  const k = datoDeCampo(f.campo);
  const v = k ? datos?.[k] : undefined;
  if (v == null || String(v).trim() === '') return null;
  if (tipo === 'numero') {
    const dato = Number(v);
    const n = Number(f.valor);
    if (!Number.isFinite(dato) || f.valor == null || f.valor === '' || !Number.isFinite(n)) return null;
    return f.op === 'menor_igual' ? dato <= n : dato >= n;
  }
  if (f.valor == null || String(f.valor).trim() === '') return null;
  return plano(String(v)) === plano(String(f.valor));
}

/**
 * LOS HECHOS DE UNA CORRIDA QUE SÓLO PREGUNTA DATOS DEL EVENTO (`soloDatosDelEvento`): no hay lead que leer —un evento de
 * la plataforma no trae ninguno—, así que lo del lead va vacío y ninguna fila lo mira (todas son `dato:`).
 */
export function hechosDelEvento(datos: Readonly<Record<string, string>> | null | undefined, ahoraMs: number): HechosLead {
  return {
    etiquetas: new Set<number>(), etapa: null, agendo: false, pago: false, yaContactado: false, respondio: false,
    creadoMs: null, tieneTelefono: false, tieneEmail: false, ahoraMs, evento: { ...(datos ?? {}) },
  };
}
