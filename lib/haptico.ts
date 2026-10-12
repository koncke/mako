// =============================================================================
// haptico — la vibración corta de MaKo Mobile (Android y iPhone)
// =============================================================================
// Módulo de NAVEGADOR: todo mira antes si existe `window`, así que importarlo
// desde el server no rompe nada (no hace nada).
//
// ⚠️ EL DIAGNÓSTICO OBVIO ES EL EQUIVOCADO: «háptica = navigator.vibrate».
// `navigator.vibrate` NO EXISTE en Safari de iOS, así que con sólo eso el iPhone
// —la mitad de los teléfonos de los clientes— no vibra nunca, y no da error.
// El patrón es el de web-haptics (lochie/web-haptics, MIT): en iOS 18+ un
// `<input type="checkbox" switch>` escondido hace un «tic» del sistema cada vez
// que cambia, así que un click SINCRÓNICO a su <label>, adentro del gesto, es una
// vibración. Fuera de un gesto iOS no lo respeta: por eso se llama en el mismo
// handler del toque, nunca después de un `await`.
//
// Cuándo, y SÓLO cuándo (docs/diseno-mako-mobile.md → «Háptica»):
//   success  aprobar o agendar salió bien (cuando llega el RESULTADO, no al tocar)
//   error    falla de red o de validación
//   light    cruzar el umbral de un swipe o del pull-to-refresh; cancelar un audio
//   medium   empezar a grabar por mantener apretado
// Nunca en cada tap, nunca al cargar, nunca sin un cambio visual en el mismo
// frame: si todo vibra, nada vibra (Apple HIG). Y la pantalla funciona igual sin
// vibración — hay teléfonos que no vibran.
// =============================================================================

import { esIOS } from './movil-instalar';

export type Haptico = 'success' | 'error' | 'light' | 'medium';

/** Los patrones de `navigator.vibrate` (ms prendido, ms apagado, …). Los de web-haptics, sin PWM. */
export const PATRON_VIBRAR: Record<Haptico, number[]> = {
  success: [20, 60, 30],
  error: [30, 40, 30, 40, 40],
  light: [10],
  medium: [20],
};

/** En iOS cada cambio del switch es un tic: cuántos tics y cada cuántos ms. */
export const TICS_IOS: Record<Haptico, { tics: number; cada: number }> = {
  success: { tics: 2, cada: 90 },
  error: { tics: 3, cada: 80 },
  light: { tics: 1, cada: 0 },
  medium: { tics: 1, cada: 0 },
};

let etiqueta: HTMLLabelElement | null = null;

function interruptorIOS(): HTMLLabelElement | null {
  if (etiqueta?.isConnected) return etiqueta;
  if (typeof document === 'undefined' || !document.body) return null;
  const id = 'mk-haptico';
  const label = document.createElement('label');
  label.setAttribute('for', id);
  label.setAttribute('aria-hidden', 'true');
  label.style.display = 'none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.id = id;
  input.tabIndex = -1;
  input.style.display = 'none';
  label.appendChild(input);
  document.body.appendChild(label);
  etiqueta = label;
  return label;
}

/**
 * Una vibración corta. Llamarla SINCRÓNICA adentro del handler del gesto (o del
 * resultado que se está mostrando en ese mismo frame). Si el dispositivo no
 * puede, no hace nada.
 */
export function haptico(tipo: Haptico): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(PATRON_VIBRAR[tipo]);
      return;
    }
    if (!esIOS()) return;
    const l = interruptorIOS();
    if (!l) return;
    l.click(); // el primero, sincrónico: es el único que iOS garantiza
    const { tics, cada } = TICS_IOS[tipo];
    for (let i = 1; i < tics; i++) setTimeout(() => l.click(), i * cada);
  } catch {
    /* sin háptica: la pantalla ya mostró el cambio */
  }
}
