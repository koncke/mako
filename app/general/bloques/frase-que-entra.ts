// =============================================================================
// La frase que manda (`.gb-frase`, ./comun.tsx) achica hasta que el bloque entra (31/10/2026)
// =============================================================================
// El tamaño de la frase sale del ANCHO de la tarjeta (`cqi`), y lo que no entra se decide en el ALTO: la Acción del día de una
// hoja guardada, 673 × 306 con 90 letras, daba 57 px en 4 líneas, se montaba sobre su título y el botón salía de la tarjeta.
// Pasaba en todo escritorio y en cualquier hoja que no le dé alto, así que no se arregla con una plantilla: se mide lo que hay.
// Con `container-type: size` y `cqh` no se puede: en la pila del teléfono el bloque mide lo que dibuja y su alto sería cero.
// =============================================================================
import { useLayoutEffect, useRef } from 'react';

/** Más chica deja de ser la frase que manda. Es el piso de `.gb-frase`. */
export const PISO_FRASE = 23;

/**
 * El tamaño más grande entre `piso` y `desde` con el que no se pasa. Si ni con el piso entra, el piso: la frase se sigue leyendo
 * y lo que sobra lo resuelve quien la dibuja. De a mitades: cada pregunta obliga al navegador a acomodar la tarjeta de nuevo.
 */
export function tamanoQueEntra(desde: number, piso: number, sePasa: (px: number) => boolean): number {
  if (!sePasa(desde)) return desde;
  let entra = piso;
  let seFue = Math.floor(desde);
  while (seFue - entra > 1) {
    const medio = Math.floor((entra + seFue) / 2);
    if (sePasa(medio)) seFue = medio;
    else entra = medio;
  }
  return entra;
}

/**
 * Para el contenedor de la frase, que tiene que tener su alto (`gb-centro`). Vuelve a medir si cambia el tamaño de la tarjeta, si
 * llega la letra (cambia cuántas líneas ocupa) o si cambia `contenido`. Sin alto propio, en la pila del teléfono, nunca se pasa.
 */
export function useFraseQueEntra(contenido: unknown) {
  const caja = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const nodo = caja.current;
    const frase = nodo?.querySelector<HTMLElement>('.gb-frase');
    if (!nodo || !frase) return;
    const ajustar = () => {
      frase.style.fontSize = '';
      const desde = parseFloat(getComputedStyle(frase).fontSize);
      const sePasa = (px: number) => {
        frase.style.fontSize = `${px}px`;
        const ultimo = nodo.lastElementChild as HTMLElement;
        // offset y no getBoundingClientRect: la miniatura de la galería va escalada, y `clientHeight` no.
        return ultimo.offsetTop + ultimo.offsetHeight - frase.offsetTop > nodo.clientHeight;
      };
      const px = tamanoQueEntra(desde, PISO_FRASE, sePasa);
      frase.style.fontSize = px === desde ? '' : `${px}px`;
    };
    ajustar();
    let vivo = true;
    document.fonts?.ready.then(() => { if (vivo) ajustar(); });
    const ro = new ResizeObserver(ajustar);
    ro.observe(nodo);
    return () => { vivo = false; ro.disconnect(); };
  }, [contenido]);
  return caja;
}
