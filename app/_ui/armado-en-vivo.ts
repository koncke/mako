// =============================================================================
// _ui/armado-en-vivo — lo PURO de «lo que MaKo construye se ve construyéndose» (AGENTS.md, 28/10/2026)
// =============================================================================
// Martín (28/10/2026): «quiero que todas las cosas que se hagan en la app se le muestren al usuario mientras se van
// haciendo… que se replique una parte de arriba, que se vaya replicando la parte de abajo, que cambien los textos… No
// tiene que ser a la velocidad de la luz: tiene que haber un pequeño delay, que no sea exagerado». El molde es el
// scraping de WhatsApp de la extensión (extension/popup.html: la cuenta grande, un punto por cosa leída, las fases).
//
// Las reglas que este módulo hace cumplir (con test: tests/armado-en-vivo.test.ts), para que la pieza
// (./ArmadoEnVivo.tsx) las use igual en Replicar, Automations, los editores y los dashboards:
//   · lo que se muestra es lo que se ARMÓ, en el orden en que se armó: la pieza revela las que ya llegaron y nunca una
//     que no llegó (no se inventa progreso);
//   · si llegan varias juntas (una tanda de la IA devuelve tres secciones; un resultado entero de una vez), se revelan
//     de a una con una CADENCIA corta: fracciones de segundo por paso, y el total de lo pendiente en segundos
//     (`cadenciaPara` la achica cuando hay muchas);
//   · se puede saltear (todo a la vista de una), y con «reducir movimiento» se muestra sin cadencia ni animación;
//   · el paso a paso nunca frena el trabajo: es sólo cómo se MUESTRA lo que ya está.
// =============================================================================

/** El paso entre una pieza y la siguiente cuando hay pocas pendientes: un pequeño delay, no la velocidad de la luz. */
export const CADENCIA_MS = 220;
/** Lo más chico que puede ser un paso (por debajo ya no se ve que se arma). */
export const CADENCIA_MIN_MS = 60;
/** Lo más que tarda en mostrarse lo pendiente: segundos, nunca minutos. */
export const TOPE_REVELAR_MS = 3_500;

/** El paso para que `pendientes` piezas entren en `TOPE_REVELAR_MS`, sin pasar de `CADENCIA_MS` ni bajar de `CADENCIA_MIN_MS`. */
export function cadenciaPara(pendientes: number, base = CADENCIA_MS, tope = TOPE_REVELAR_MS): number {
  if (pendientes <= 0) return base;
  return Math.max(CADENCIA_MIN_MS, Math.min(base, Math.floor(tope / pendientes)));
}

/**
 * Cuántas piezas mostrar ahora. `llegadas`: las que ya se armaron de verdad; `visibles`: las que se ven; `desdeUltima`:
 * los ms desde que se mostró la última. Nunca más que las llegadas (no se inventa); de a una por paso; todas si se
 * salteó o si la persona pidió menos movimiento.
 */
export function visiblesAhora(p: { llegadas: number; visibles: number; desdeUltima: number; salteado?: boolean; sinMovimiento?: boolean }): number {
  const llegadas = Math.max(0, Math.floor(p.llegadas));
  const visibles = Math.min(Math.max(0, Math.floor(p.visibles)), llegadas);
  if (p.salteado || p.sinMovimiento) return llegadas;
  if (visibles >= llegadas) return visibles;
  return p.desdeUltima >= cadenciaPara(llegadas - visibles) ? visibles + 1 : visibles;
}

/** El estado de una fase del trabajo (las de la extensión: con su tilde, la de ahora girando). */
export type EstadoFase = 'pendiente' | 'ahora' | 'hecha' | 'fallo';
export type FaseArmado = { id: string; texto: string; estado: EstadoFase };

/**
 * Las fases a partir de cuál está corriendo (`actual`, su id) y si el trabajo terminó: las de antes, hechas; la actual,
 * ahora; las de después, pendientes. Con `fallo`, la actual queda marcada como la que falló.
 */
export function fasesDesde(ids: readonly { id: string; texto: string }[], actual: string | null, op: { terminado?: boolean; fallo?: boolean } = {}): FaseArmado[] {
  const k = actual ? ids.findIndex((f) => f.id === actual) : -1;
  return ids.map((f, i) => ({
    id: f.id,
    texto: f.texto,
    estado: op.terminado ? 'hecha' : i < k ? 'hecha' : i === k ? (op.fallo ? 'fallo' : 'ahora') : 'pendiente',
  }));
}
