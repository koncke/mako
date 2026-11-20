'use client';
// =============================================================================
// EL VIDEO DEL TUTORIAL, EN SU MENSAJE (20/11/2026, la segunda verificación: V4 y R57-21; decidido por el Cerebro en la memoria)
// =============================================================================
// Lo acordado: el video de los días 2 a 7 del reto corre DENTRO de su mensaje, como el del día 1 (VideoDelMomento), con las marcas del
// motor encima, y pasa a la esquina sólo al navegar o al scrollear. Martín: «uno solo, que se ponga chiquitito abajo a la derecha».
//
// El video que manda las marcas es UNO solo, el del motor (MotorTutorial → VideoChico): cambiar de <video> a mitad de camino perdería
// la pausa de la frase, la retención y lo tocado. Entonces no se muda el video: se DIBUJA encima del lugar del mensaje mientras ese
// lugar se ve (recortado a lo que se ve del hilo, como si estuviera adentro), y en la esquina cuando no (se scrolleó, se navegó y el
// mensaje ya no está). Aquí, la cuenta de qué se ve (pura, con test) y el gancho que la sigue.
// =============================================================================
import { useEffect, useState } from 'react';

export type CajaVista = { x: number; y: number; ancho: number; alto: number };
/** Dónde se dibuja: la caja del lugar y cuánto recortarle de cada lado (lo que tapan el hilo o la ventana). */
export type LugarVisto = CajaVista & { recorte: { arriba: number; derecha: number; abajo: number; izquierda: number } };

/** Como el video del día 1 (useVideoQueFlota): con menos de un cuarto a la vista, a la esquina. */
export const MINIMO_A_LA_VISTA = 0.25;

/**
 * Lo que se ve de `caja` dentro de cada recorte (la ventana y cada contenedor con scroll que la contiene). null si se ve menos de
 * `minimo` de su superficie: entonces el video va a la esquina.
 */
export function lugarVisible(caja: CajaVista, recortes: readonly CajaVista[], minimo = MINIMO_A_LA_VISTA): LugarVisto | null {
  if (caja.ancho <= 0 || caja.alto <= 0) return null;
  let x0 = caja.x, y0 = caja.y, x1 = caja.x + caja.ancho, y1 = caja.y + caja.alto;
  for (const r of recortes) {
    x0 = Math.max(x0, r.x); y0 = Math.max(y0, r.y);
    x1 = Math.min(x1, r.x + r.ancho); y1 = Math.min(y1, r.y + r.alto);
  }
  const ancho = Math.max(0, x1 - x0), alto = Math.max(0, y1 - y0);
  if ((ancho * alto) / (caja.ancho * caja.alto) < minimo) return null;
  return { ...caja, recorte: { arriba: y0 - caja.y, izquierda: x0 - caja.x, abajo: caja.y + caja.alto - y1, derecha: caja.x + caja.ancho - x1 } };
}

const igual = (a: LugarVisto | null, b: LugarVisto | null): boolean => {
  if (!a || !b) return a === b;
  const r = (n: number) => Math.round(n);
  return r(a.x) === r(b.x) && r(a.y) === r(b.y) && r(a.ancho) === r(b.ancho) && r(a.alto) === r(b.alto)
    && r(a.recorte.arriba) === r(b.recorte.arriba) && r(a.recorte.abajo) === r(b.recorte.abajo)
    && r(a.recorte.izquierda) === r(b.recorte.izquierda) && r(a.recorte.derecha) === r(b.recorte.derecha);
};

/** El lugar `sel` mientras se ve (con su recorte); null si no está, está escondido o casi no se ve. Sigue el scroll y los cambios. */
export function useLugarALaVista(sel: string | null | undefined): LugarVisto | null {
  const [lugar, setLugar] = useState<LugarVisto | null>(null);
  useEffect(() => {
    if (!sel || typeof document === 'undefined') { setLugar(null); return; }
    let cuadro = 0;
    let ultimo: LugarVisto | null = null;
    const medir = () => {
      cuadro = 0;
      const el = document.querySelector<HTMLElement>(sel);
      let nuevo: LugarVisto | null = null;
      if (el && el.isConnected && el.getClientRects().length) {
        const b = el.getBoundingClientRect();
        const recortes: CajaVista[] = [{ x: 0, y: 0, ancho: window.innerWidth, alto: window.innerHeight }];
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const st = getComputedStyle(p);
          if (st.overflowY !== 'visible' || st.overflowX !== 'visible') {
            const r = p.getBoundingClientRect();
            recortes.push({ x: r.left, y: r.top, ancho: r.width, alto: r.height });
          }
        }
        nuevo = lugarVisible({ x: b.left, y: b.top, ancho: b.width, alto: b.height }, recortes);
      }
      if (!igual(nuevo, ultimo)) { ultimo = nuevo; setLugar(nuevo); }
    };
    const pedir = () => { if (!cuadro) cuadro = requestAnimationFrame(medir); };
    medir();
    document.addEventListener('scroll', pedir, { capture: true, passive: true });
    window.addEventListener('resize', pedir);
    const mo = new MutationObserver(pedir);
    mo.observe(document.body, { childList: true, subtree: true });
    // Por si algo se mueve sin avisar (una imagen que carga arriba del mensaje).
    const reloj = window.setInterval(pedir, 400);
    return () => {
      document.removeEventListener('scroll', pedir, { capture: true });
      window.removeEventListener('resize', pedir);
      mo.disconnect(); window.clearInterval(reloj);
      if (cuadro) cancelAnimationFrame(cuadro);
    };
  }, [sel]);
  return lugar;
}
