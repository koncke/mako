// =============================================================================
// dialogo-foco — lo que necesita un `Modal` de la tab Curso para no sacarle el foco al campo
// =============================================================================
// Punto 1 del audio del 08/10/2026 a la noche (docs/feedback-curso-08oct-noche.md, min 0-1): al crear un
// producto, «cada vez que se introduce un carácter se deselecciona el cuadro de texto».
//
// ⚠️ EL DIAGNÓSTICO OBVIO ERA EL EQUIVOCADO. Parecía un componente definido adentro de otro (se remonta
//    en cada render) o una `key` que cambia con lo que se tipea: en la tab Curso no hay ni uno (barrido
//    con el AST de TypeScript, 09/10/2026). La causa vive en `Modal` (app/_ui/Modal.tsx): su efecto de
//    foco depende de `onCerrar`. Una flecha nueva en cada render —`onCerrar={() => { if (!creando)
//    onCerrar(); }}`— lo vuelve a correr con cada letra: la limpieza devuelve el foco a lo de antes y el
//    efecto enfoca la CAJA. Medido en Chromium con el componente real: tipeando «Fiesta» quedaba «F», y el
//    foco en `div.mk-modal` después de cada tecla.
//
// ⚠️ Y `autoFocus` NO ANDA ADENTRO DE UN `Modal`: su primer render es `display: none` (la capa todavía no
//    está en la pila, app/_components/pila-modales.ts), y ni el `autoFocus` ni el foco de la caja caen
//    sobre algo escondido. Medido: al abrir «Nuevo producto», el foco quedaba en `body`.
//
// El arreglo de raíz es de `Modal` (guardar `onCerrar` en un ref y enfocar al hacerse visible); mientras
// tanto, todo `Modal` de la tab Curso recibe un `onCerrar` de identidad fija, y lo cuida
// tests/curso-nuevo-producto.test.ts.

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Un `onCerrar` con UNA identidad para toda la vida del diálogo. Llama al `onCerrar` del último render
 * (quien lo monta puede pasar una flecha nueva en cada render) y no cierra mientras `ocupado`.
 */
export function useCerrarEstable(onCerrar: () => void, ocupado = false): () => void {
  const ultimo = useRef({ onCerrar, ocupado });
  useLayoutEffect(() => { ultimo.current = { onCerrar, ocupado }; });
  return useCallback(() => { if (!ultimo.current.ocupado) ultimo.current.onCerrar(); }, []);
}

/** Cada cuánto y cuántas veces se mira si la caja ya se ve (≈1 s): si nunca se ve, no se enfoca nada. */
const CADA_MS = 16;
const INTENTOS_MAX = 60;

/**
 * Enfoca el campo `id` cuando la caja YA SE VE (ver la cabecera: el `autoFocus` cae sobre algo escondido).
 * Una vez, al abrir: después el foco es de quien escribe.
 *
 * Con `setTimeout` y no con `requestAnimationFrame`: la caja se ve ~4 ms después del efecto, y un cuadro
 * depende de que el navegador pinte (medido en Chromium headless recién cargada la página: el primer rAF
 * llegó 570 ms tarde). Abierto con un clic, los dos enfocan antes de los 60 ms.
 */
export function useFocoInicial(id: string): void {
  useEffect(() => {
    let intentos = 0;
    let t = 0;
    const intentar = () => {
      const el = document.getElementById(id);
      if (el && el.getClientRects().length > 0) { el.focus(); return; }
      if (++intentos < INTENTOS_MAX) t = window.setTimeout(intentar, CADA_MS);
    };
    t = window.setTimeout(intentar, 0);
    return () => window.clearTimeout(t);
  }, [id]);
}
