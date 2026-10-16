// =============================================================================
// Las reglas de la fábrica de guiones — un módulo PURO, sin 'use client'
// =============================================================================
// Lo que decide Ads Writer sin dibujar nada: cuántos anuncios tienen guion, cuántos guiones están
// listos para grabar, a QUÉ celda apunta «Escribir el próximo guion» y en qué orden se listan los
// guiones. Vivía inline en AdsWriterApp.tsx y GuionesGlobal.tsx (los dos 'use client') y se mudó acá
// el 16/10/2026 para que el teléfono (app/m/copywriting) escriba en la MISMA celda y liste en el
// MISMO orden que la computadora: lo que una pantalla de /m reusa de escritorio no puede vivir en un
// módulo de cliente (AGENTS.md, «MaKo Mobile (/m)»). Mismo molde que ./tabs.ts y ./analizar.ts.
// =============================================================================

import type { GuionItem } from '@/lib/guion-estado';

/** Lo mínimo de una celda de la matriz (avatar × razón) que estas reglas leen. */
export type CeldaCobertura = { id: string; avatarId: string; guiones: Pick<GuionItem, 'estado'>[] };

export type Cobertura = {
  /** Anuncios (celdas) con al menos un guion. */
  conGuion: number;
  /** Anuncios de la matriz. */
  total: number;
  /** GUIONES aprobados (una celda puede tener varios): «listos para grabar». */
  listos: number;
  /** Guiones escritos, de todas las celdas. */
  guiones: number;
};

/**
 * La cobertura, el KPI de la fábrica. Las unidades tienen que cerrar: conGuion/total cuentan
 * ANUNCIOS y `listos` cuenta GUIONES (mezclarlos daba «1 de 18 anuncios con guion · 3 listos»).
 */
export function coberturaDe(celdas: readonly CeldaCobertura[]): Cobertura {
  const conGuion = celdas.filter((c) => c.guiones.length).length;
  const listos = celdas.reduce((n, c) => n + c.guiones.filter((g) => g.estado === 'aprobado').length, 0);
  const guiones = celdas.reduce((n, c) => n + c.guiones.length, 0);
  return { conGuion, total: celdas.length, listos, guiones };
}

/**
 * La primera celda sin guion, en orden avatar → razón. Es a la que apunta la acción primaria:
 * escribir lo que falta, no lo que ya está. Una celda cuyo avatar no está en la lista cuenta al
 * final (la matriz no la dibuja, pero sigue siendo un anuncio sin guion).
 */
export function proximaCeldaDe<C extends CeldaCobertura>(celdas: readonly C[], avatares: readonly { id: string }[]): C | null {
  for (const av of avatares) {
    const c = celdas.find((x) => x.avatarId === av.id && !x.guiones.length);
    if (c) return c;
  }
  return celdas.find((c) => !c.guiones.length) ?? null;
}

/**
 * El orden de la galería de guiones: el más nuevo primero. Los «sin fecha» (creadoEn 0, guiones
 * anteriores al campo) van SIEMPRE al final: en ascendente encabezarían la lista fingiendo ser los
 * más viejos. Para `Array.prototype.sort` sobre los guiones (o sobre `fila.g`).
 */
export function masRecientePrimero(a: Pick<GuionItem, 'creadoEn'>, b: Pick<GuionItem, 'creadoEn'>): number {
  if (!a.creadoEn && !b.creadoEn) return 0;
  if (!a.creadoEn) return 1;
  if (!b.creadoEn) return -1;
  return b.creadoEn - a.creadoEn;
}
