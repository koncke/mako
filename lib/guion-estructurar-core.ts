// =============================================================================
// guion-estructurar-core — la parte del ordenado que NO habla con nadie
// =============================================================================
// Mismo motivo por el que `soloHablado` vive en puestas-data y no en el módulo
// server-only que lo usa: aquí está lo único que puede fallar en silencio —qué
// respuesta del modelo se acepta y dónde se meten los rótulos— y eso hay que
// poder probarlo sin levantar un server ni gastar una llamada.
//
// El módulo de al lado (`guion-estructurar.ts`) es el que llama al modelo.

import type { EstructuraGuion } from '@/lib/guion-estructuras';

/** Un bloque del guion y en qué línea (numerada, sin contar las vacías) empieza. */
export type Corte = { etiqueta: string; linea: number };

/**
 * Las líneas con contenido, numeradas desde 1.
 *
 * `n` es el número que ve el modelo; `i` es el índice real dentro del texto. Se
 * devuelven los dos porque el modelo cuenta líneas de contenido —las vacías lo
 * confunden y le hacen errar el corte por dos o tres— pero insertar el rótulo hay
 * que hacerlo en el texto de verdad.
 */
export function numerarLineas(texto: string): { n: number; i: number; l: string }[] {
  const out: { n: number; i: number; l: string }[] = [];
  texto.split('\n').forEach((l, i) => {
    if (l.trim()) out.push({ n: out.length + 1, i, l: l.trim() });
  });
  return out;
}

/**
 * Valida la respuesta del modelo ANTES de tocar el guion.
 *
 * Devuelve los cortes o `null`. Cada chequeo tapa una forma real en la que un
 * modelo se equivoca aquí: inventar una estructura que no está en el catálogo,
 * saltearse una etiqueta, mandarlas desordenadas, repetir un número de línea o
 * apuntar a una línea que no existe.
 */
export function validarCortes(
  crudo: string,
  estructuras: EstructuraGuion[],
  totalLineas: number,
): { estructura: EstructuraGuion; cortes: Corte[] } | null {
  let obj: unknown;
  try { obj = JSON.parse(crudo); } catch { return null; }
  if (!obj || typeof obj !== 'object') return null;

  const o = obj as Record<string, unknown>;
  const estructura = estructuras.find((e) => e.activo && e.id === String(o.estructuraId ?? ''));
  if (!estructura) return null;

  if (!Array.isArray(o.cortes)) return null;
  const cortes: Corte[] = o.cortes.map((c) => ({
    etiqueta: String((c as Record<string, unknown>)?.etiqueta ?? '').trim().toUpperCase(),
    linea: Number((c as Record<string, unknown>)?.linea ?? 0),
  }));

  // Todas las etiquetas, en el orden del catálogo. Un guion al que le falta el
  // CTA no quedó ordenado a medias: quedó mal ordenado, y el parser de la UI lo
  // va a cortar en tarjetas que no son.
  if (cortes.length !== estructura.etiquetas.length) return null;
  if (cortes.some((c, i) => c.etiqueta !== estructura.etiquetas[i])) return null;

  // El primer bloque arranca en la primera línea: si arrancara más abajo, el
  // principio del guion quedaría fuera de todo bloque.
  if (cortes[0].linea !== 1) return null;

  for (let i = 0; i < cortes.length; i++) {
    const n = cortes[i].linea;
    if (!Number.isInteger(n) || n < 1 || n > totalLineas) return null;
    if (i > 0 && n <= cortes[i - 1].linea) return null;
  }

  return { estructura, cortes };
}

/** Mete los rótulos, cada uno en su propia línea y con una línea en blanco arriba. */
export function insertarRotulos(texto: string, cortes: Corte[]): string {
  const lineas = texto.split('\n');
  const numeradas = numerarLineas(texto);
  const rotuloEn = new Map<number, string>();
  for (const c of cortes) {
    const destino = numeradas[c.linea - 1];
    if (destino) rotuloEn.set(destino.i, c.etiqueta);
  }

  const out: string[] = [];
  lineas.forEach((l, i) => {
    const rot = rotuloEn.get(i);
    if (rot) {
      if (out.length && out[out.length - 1].trim() !== '') out.push('');
      out.push(rot);
    }
    out.push(l);
  });

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
