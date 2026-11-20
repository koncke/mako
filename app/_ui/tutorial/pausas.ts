// =============================================================================
// CUÁNDO SE PAUSA EL VIDEO DE UN TUTORIAL: las reglas del motor, puras (20/11/2026)
// =============================================================================
// Martín: «había muchos videos que se pausaban en el tiempo incorrecto». La auditoría del Cerebro (20/11, 60 frases de todas las
// pestañas) midió que los tiempos del manifiesto están bien: cada pausa cae en el silencio del final de su frase. El que pausaba mal
// era el motor (./MotorTutorial.tsx):
//   · si la marca de una frase no estaba, PAUSABA en su t_inicio (entre 0 y 250 ms adentro de la voz: cortaba la primera sílaba) y
//     esperaba hasta 4 s, sin tarjeta ni velo: el video parecía colgado. Pasaba con una marca que no existe, de otro rol, de una
//     vista que no se abrió, y con las «Mira aquí», que nunca debían pausar;
//   · después de un clic que navega o abre algo lento (el grafo tarda ~3 s), seguía en el acto y frenaba a mitad de la frase
//     siguiente, cuya marca todavía no estaba;
//   · «Siguiente» no hacía lo que el clic, y lo que dependía de ese clic congelaba 4 s por frase, en cascada.
// LAS REGLAS:
//   1. Nunca se pausa en el t_inicio. Una marca que falta se busca mientras dura su voz y se marca apenas aparece.
//   2. El único lugar de pausa es el t_fin, en el silencio: una frase que espera el clic y está marcada pausa ahí (como siempre).
//      Una frase cuya marca no apareció, en su t_fin espera SÓLO si la página está cargando; si no, se saltea sin pausar.
//   3. Después de un clic (o de «Siguiente», que hace el clic), el video se queda quieto en el silencio de la frase tocada hasta que
//      aparece la marca de la próxima frase con marca, con un tope (`soltarRetencion`).
//      En el SILENCIO de verdad (20/11, la verificación de motor-2/b y motor-3/c): un clic DURANTE la voz de la frase tocada no la
//      corta; el video sigue hasta su t_fin y ahí se retiene (`retenerAlFin`). Así el t_fin es el único punto de pausa.
// El motor las aplica; aquí, sólo las decisiones (las prueba tests/tutorial-pausas.test.ts sin navegador).
// =============================================================================
import type { FraseVideo } from '@/lib/tutoriales/videos';

/** Lo más que se espera, quieto y en silencio, a que aparezca la marca después de un clic (el grafo del Second Brain tarda ~3 s; la
 *  auditoría pidió ~8 s, recorrido-5). */
export const TOPE_RETENCION_MS = 8000;
/** Lo menos que se espera después de un clic que no navega (un menú, un panel): lo que abre tarda un poco en dibujarse. */
export const MIN_RETENCION_MS = 600;
/** Sin cambios en la página por este tiempo, lo que iba a aparecer ya apareció (o no va a aparecer). */
export const QUIETO_MS = 500;
/** Lo más que se espera, en el t_fin de una frase sin su marca, a una página que está cargando. */
export const TOPE_CARGA_MS = 6000;

/** Lo que se anota al tocar lo marcado (o al «Siguiente», que hace el clic): desde cuándo, dónde estaba y si el clic navega. */
export type Retencion = { desde: number; url: string; navega: boolean };
/** Cómo está la página ahora, para decidir si se suelta el video. */
export type Ahora = { ms: number; url: string; marca: boolean; cargando: boolean; quietoMs: number };

/**
 * ¿Se suelta el video retenido después de un clic? Sí, si ya está la marca de la próxima frase, o si se pasó el tope. Si no, se
 * espera mientras la página carga y mientras un link todavía no llevó a su página. Llegada la página (o sin navegar), se suelta
 * cuando deja de cambiar: lo que iba a aparecer apareció, y si la marca no está, esa frase se saltea sin pausar (regla 1).
 */
export function soltarRetencion(r: Retencion, a: Ahora): boolean {
  if (a.marca) return true;
  const pasado = a.ms - r.desde;
  if (pasado >= TOPE_RETENCION_MS) return true;
  if (a.cargando) return false;
  if (r.navega && a.url === r.url) return false;
  return pasado >= MIN_RETENCION_MS && a.quietoMs >= QUIETO_MS;
}

/**
 * ¿El clic llegó con la voz de su frase todavía sonando? Entonces el video sigue hasta su t_fin y recién ahí se retiene (regla 3):
 * nunca a mitad de la frase. Con el mismo margen que la pausa del t_fin (50 ms).
 */
export const retenerAlFin = (t: number, tFin: number): boolean => t < tFin - 0.05;

/** En el t_fin de una frase cuya marca no apareció: se espera sólo a una página que está cargando (con tope); si no, se saltea. */
export function alFinSinMarca(cargando: boolean, esperandoMs: number): 'esperar' | 'saltear' {
  return cargando && esperandoMs < TOPE_CARGA_MS ? 'esperar' : 'saltear';
}

/** La próxima frase con marca, sin hacer, después de `desde` (la que el clic de `desde` tiene que hacer aparecer). */
export function siguienteConMarca(frases: readonly FraseVideo[], desde: FraseVideo, hechas: ReadonlySet<string>): FraseVideo | null {
  for (const f of frases) if (f.sel && f.id !== desde.id && !hechas.has(f.id) && f.t_inicio >= desde.t_inicio) return f;
  return null;
}

/** ¿El link lleva a otra página? (otra ruta u otra consulta, del mismo sitio y en la misma pestaña). */
export function navegaA(href: string | null | undefined, aqui: string, target?: string | null): boolean {
  if (!href || (target && target !== '_self')) return false;
  try {
    const a = new URL(aqui), b = new URL(href, aqui);
    if (b.origin !== a.origin || /^(mailto|tel|javascript):/i.test(href)) return false;
    return b.pathname !== a.pathname || b.search !== a.search;
  } catch { return false; }
}

/**
 * En el teléfono, ¿la frase marca un paso `soloComputadora`? Se saltea sin buscarla (settings-3/4, crm-6, plan-3, web-5: su
 * control no existe en MaKo Mobile). `pasos` son TODOS los del tutorial (los filtrados para el teléfono ya no los traen).
 */
export function soloEnComputadora(sel: string | null, pasos: readonly { sel: string; soloComputadora?: true }[], telefono: boolean,
  mismoLugar: (selPaso: string, selFrase: string) => boolean): boolean {
  if (!telefono || !sel) return false;
  return pasos.some((p) => p.soloComputadora && mismoLugar(p.sel, sel));
}

// ── El `antes` en cadena (20/11: lo que está detrás de dos clics) ───────────────────────────────────────────────────────
/** Un `antes` siempre como cadena (uno solo es una cadena de uno). */
export const comoCadena = (antes: string | readonly string[]): string[] => (typeof antes === 'string' ? [antes] : [...antes]);
/** Lo que espera cada eslabón a que aparezca el siguiente (un menú, un modal) antes de darse por vencido y cerrar lo abierto. */
export const TOPE_CADENA_MS = 2000;
/**
 * Desde qué eslabón se toca: el ÚLTIMO que ya está a la vista. Si la frase anterior dejó el menú abierto, su opción ya está y
 * tocar el primero lo cerraría. -1: ninguno está (no se toca nada).
 */
export function pasoDeLaCadena(presentes: readonly boolean[]): number {
  for (let i = presentes.length - 1; i >= 0; i -= 1) if (presentes[i]) return i;
  return -1;
}
