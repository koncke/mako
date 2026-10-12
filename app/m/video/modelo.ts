// =============================================================================
// /m/video — las reglas PURAS de Video Generator en el teléfono (con test: tests/m-video.test.ts)
// =============================================================================
// Sin React y sin server-only: lo usan la lista y el editor (cliente) y el test.
//
// ⚠️ EL ESTADO DE CADA TOMA NO SE DECIDE ACÁ. Lo decide `estadoDeToma` de escritorio, que desde
// el 11/10/2026 vive en un módulo PURO (app/video-generator/tomas-estado.ts; PasoTomas.tsx lo
// re-exporta). Acá llegan los estados YA calculados. Una segunda copia de esa regla sería otra
// pantalla que dice «Lista» donde escritorio dice «Filmando».
//
// ⚠️ EL TELÉFONO NO FILMA (decisión del 11/10/2026: no gasta créditos de Google Flow ni encola
// filmaciones). Por eso el pie del editor nunca ofrece «Filmar de nuevo»: su único primario es ver
// el anuncio entero y, con el montaje listo, descargarlo. Lo que falta se dice como consecuencia
// («Falta la toma 6.») y se arregla en la computadora.
// =============================================================================

import type { EstadoToma } from '@/app/video-generator/tomas-estado';

/** El montaje de un anuncio, ya traducido de `estadoMontajeAction` (encolado y montando = montando). */
export type MontajeM =
  | { fase: 'sin_empezar' }
  | { fase: 'montando' }
  | { fase: 'listo'; url: string; segundos: number | null }
  | { fase: 'error' };

/** Una toma con su estado ya decidido por `estadoDeToma`. */
export type TomaM = { n: number; estado: EstadoToma; segundos: number };

export type TonoM = 'good' | 'warn' | 'bad' | 'info' | 'neutro';

/**
 * Los rótulos de escritorio (PasoTomas.tsx → ROTULO, que no se exporta), con su tono para la
 * píldora: el color va en el punto, el texto en tinta.
 */
export const ROTULO_TOMA: Record<EstadoToma, { rotulo: string; tono: TonoM }> = {
  filmada: { rotulo: 'Lista', tono: 'good' },
  generando: { rotulo: 'Filmando', tono: 'info' },
  fallada: { rotulo: 'No salió', tono: 'bad' },
  'sin-texto': { rotulo: 'Falta el texto', tono: 'warn' },
  pendiente: { rotulo: 'Sin filmar', tono: 'neutro' },
};

/** `70.04` → `1:10`. Redondea ANTES de partir: 59,6 s no es «0:60». */
export function reloj(seg: number): string {
  const s = Math.max(0, Math.round(Number.isFinite(seg) ? seg : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Cuánto dura: el montaje si ya se midió (es el anuncio real, sin el aire), si no lo planeado. */
export function duracionDe(tomas: readonly TomaM[], montaje: MontajeM | null): number {
  if (montaje?.fase === 'listo' && montaje.segundos != null && montaje.segundos > 0) return montaje.segundos;
  return tomas.reduce((t, x) => t + (Number.isFinite(x.segundos) ? Math.max(0, x.segundos) : 0), 0);
}

/** ¿Están todas filmadas? Es la condición del montaje (`montarAnuncioAction`: «Falta filmar la toma N»). */
export function todasFilmadas(tomas: readonly TomaM[]): boolean {
  return tomas.length > 0 && tomas.every((t) => t.estado === 'filmada');
}

/**
 * La segunda línea de un anuncio en curso. Primero lo que BLOQUEA (una toma que no salió, con el
 * punto rojo), después lo que se mueve solo, después cuánto falta.
 */
export function resumenDeAnuncio(tomas: readonly TomaM[], montaje: MontajeM | null): { texto: string; tono: TonoM | null } {
  if (!tomas.length) return { texto: 'Sin tomas', tono: null };
  const fallas = tomas.filter((t) => t.estado === 'fallada').length;
  if (fallas) return { texto: fallas === 1 ? 'Una toma no salió' : `${fallas} tomas no salieron`, tono: 'bad' };
  if (tomas.some((t) => t.estado === 'generando')) return { texto: 'Filmando…', tono: null };
  if (todasFilmadas(tomas)) {
    if (montaje?.fase === 'listo') return { texto: 'Listo', tono: null };
    if (montaje?.fase === 'montando') return { texto: 'Montando…', tono: null };
    if (montaje?.fase === 'error') return { texto: 'No se pudo montar', tono: 'bad' };
    return { texto: `${tomas.length} tomas listas`, tono: null };
  }
  const listas = tomas.filter((t) => t.estado === 'filmada').length;
  return { texto: listas ? `${listas} de ${tomas.length} tomas` : 'Sin filmar', tono: null };
}

/**
 * La toma que se abre primero: la que no salió (lo que hay que mirar), si no la que se está
 * filmando, si no la primera que falta. Todas listas: la primera. `null` sin tomas.
 */
export function tomaInicial(tomas: readonly TomaM[]): number | null {
  const primera = (e: EstadoToma) => tomas.find((t) => t.estado === e)?.n;
  return primera('fallada') ?? primera('generando') ?? tomas.find((t) => t.estado !== 'filmada')?.n ?? tomas[0]?.n ?? null;
}

export type PieEditor = {
  accion: 'entero' | 'descargar';
  habilitado: boolean;
  /** La consecuencia, pegada arriba del botón. */
  consecuencia: string;
};

/**
 * El ÚNICO primario del editor, que cambia con el estado: ver el anuncio entero → descargarlo.
 * Sin montaje listo el botón queda apagado y la consecuencia dice qué falta (en la computadora).
 * `entero` = se está mirando el anuncio montado.
 */
export function pieDelEditor(tomas: readonly TomaM[], montaje: MontajeM | null, entero: boolean): PieEditor {
  if (montaje?.fase === 'listo') {
    return entero
      ? { accion: 'descargar', habilitado: true, consecuencia: 'Queda en tu teléfono.' }
      : { accion: 'entero', habilitado: true, consecuencia: `Las ${tomas.length} tomas están listas.` };
  }
  const apagado = (consecuencia: string): PieEditor => ({ accion: 'entero', habilitado: false, consecuencia });
  if (!tomas.length) return apagado('Este anuncio no tiene tomas.');
  const falta = tomas.find((t) => t.estado !== 'filmada');
  if (falta) {
    if (falta.estado === 'fallada') return apagado(`Falta la toma ${falta.n}.`);
    if (falta.estado === 'generando') return apagado(`Se está filmando la toma ${falta.n}.`);
    if (falta.estado === 'sin-texto') return apagado(`Falta el texto de la toma ${falta.n}.`);
    return apagado(`Falta filmar la toma ${falta.n}.`);
  }
  if (montaje?.fase === 'montando') return apagado('Se está montando el anuncio.');
  if (montaje?.fase === 'error') return apagado('No se pudo montar el anuncio.');
  return apagado('Falta montar el anuncio.');
}

/**
 * ¿Hay algo que se mueve SOLO del lado del server? Una toma filmándose (la avanza la computadora
 * que sondea a Google) o un montaje en el worker. Con algo así, el editor vuelve a leer cada tanto.
 */
export function hayEnVuelo(tomas: readonly TomaM[], montaje: MontajeM | null): boolean {
  return montaje?.fase === 'montando' || tomas.some((t) => t.estado === 'generando');
}
