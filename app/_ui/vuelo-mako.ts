// =============================================================================
// El vuelo de la criatura de MaKo a su lugar: UNA pieza para todos los loaders (23/10/2026)
// =============================================================================
// Martín, 23/10/2026: «Todos los loaders que tengan la figura de MaKo, luego de terminar de cargar, la figura de MaKo se debe ir
// a su lugar, como lo hace en ops center... En Automations se puede ir a su chat, lo mismo que en CRM a su botón de abajo».
//
// Es el movimiento EXACTO de la entrada del teléfono (app/m/_ui/EntradaApp.tsx) y del Ops Center (app/second-brain/EntradaOps.tsx),
// que lo tenían escrito dos veces: del centro de la criatura al centro de su lugar, achicándose a su tamaño, en 420 ms con la
// curva `cubic-bezier(.16,.84,.34,1)`, y al final (el último 15 %) se funde. Sin lugar visible, se achica y se funde donde está.
// Con movimiento reducido no vuela: se funde en 150 ms.
//
// Lo usan EntradaApp y EntradaOps (sus capas) y el vuelo de los loaders de las tabs (./VueloDeCarga.tsx).
// =============================================================================

/** La salida: vuela a su lugar mientras el fondo se funde. Corta. */
export const MS_SALIDA = 420;
/** Con movimiento reducido: sólo se funde. */
export const MS_SALIDA_QUIETA = 150;
const CURVA = 'cubic-bezier(.16,.84,.34,1)';

export type Caja = { left: number; top: number; width: number; height: number };

/**
 * El vuelo: de la criatura (`desde`) a su lugar (`hasta`), moviendo la capa que la lleva (`capa`).
 * Se achica desde el centro de la criatura —que flota unos px fuera del centro de la capa—, así aterriza justo en el
 * centro del destino. Sin destino visible, `null`: se funde en su lugar.
 */
export function trayecto(desde: Caja | null | undefined, hasta: Caja | null | undefined, capa: Caja): { origen: string; fin: string } | null {
  if (!desde || !hasta || desde.width <= 0 || hasta.width <= 0) return null;
  const cx = desde.left + desde.width / 2;
  const cy = desde.top + desde.height / 2;
  const dx = hasta.left + hasta.width / 2 - cx;
  const dy = hasta.top + hasta.height / 2 - cy;
  return { origen: `${cx - capa.left}px ${cy - capa.top}px`, fin: `translate(${dx}px, ${dy}px) scale(${hasta.width / desde.width})` };
}

/** Los cuadros del vuelo: a su lugar, y en el último 15 % se funde. Sin lugar, se achica (o, quieta, no) y se funde. */
export function cuadrosDelVuelo(t: { fin: string } | null, quieta: boolean): Keyframe[] {
  if (t) return [{ transform: 'none', opacity: 1 }, { transform: t.fin, opacity: 1, offset: 0.85 }, { transform: t.fin, opacity: 0 }];
  return [{ transform: 'none', opacity: 1 }, { transform: quieta ? 'none' : 'scale(.85)', opacity: 0 }];
}

/** Hace volar a `el` (la capa que lleva la criatura). Devuelve cuánto dura, para sacarla después. */
export function volar(el: HTMLElement, t: { origen: string; fin: string } | null, quieta: boolean): number {
  const ms = quieta ? MS_SALIDA_QUIETA : MS_SALIDA;
  if (typeof el.animate !== 'function') return 0;
  if (t) el.style.transformOrigin = t.origen;
  el.animate(cuadrosDelVuelo(t, quieta), { duration: ms, easing: t ? CURVA : 'ease-out', fill: 'forwards' });
  return ms;
}

/** ¿Pide movimiento reducido? Sin matchMedia, no. */
export function movimientoReducido(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
