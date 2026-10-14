'use client';

// =============================================================================
// usePilaDeshacer — una pila de deshacer/rehacer con Ctrl+Z / Ctrl+Y
// =============================================================================
// Pedido el 04/10/2026 sobre el editor de mensajes: «agrega los botones de deshacer
// y rehacer, y que funcione el ctrl z / y».
//
// Vive acá y no adentro de la pantalla porque ya había UNA pila en el repo
// —`app/video-generator/EditorAnuncio.tsx`, de donde sale la forma de ésta— y una
// segunda copia escrita a mano garantizaba que las dos divergieran. Lo que esta
// agrega sobre aquélla son las tres cosas que aquélla no tiene: REHACER, el tope por
// parámetro, y la guarda del foco.
//
// ⚠️ TRES COSAS QUE NO SE VEN EN LA FIRMA Y CADA UNA ES UN BUG QUE NO PASÓ.
//
// 1. SE APILA UNA VEZ POR GESTO, NO POR CAMBIO — eso lo decide QUIEN LLAMA, igual que
//    en la pila del video: «un arrastre dispara decenas de setPlan por segundo: si
//    cada uno apilara, Ctrl+Z desharía un píxel». Por eso `apilar()` es explícito y no
//    un efecto sobre el estado: un hook que observa el valor no puede saber dónde
//    empieza un gesto.
//
// 2. ⚠️ EL CTRL+Z NATIVO DEL TEXTAREA GANA CUANDO EL FOCO ESTÁ EN UN TEXTO. La pila
//    del video escucha en `window` y hace `preventDefault()` sin mirar el foco, con el
//    porqué escrito («un atajo que sólo anda con el foco en el lugar correcto es un
//    atajo que no anda»). Ahí es correcto: ese modal no tiene dónde tipear. Acá sí —el
//    editor de mensajes ES un textarea—, y pegado igual le robaría a la persona el
//    deshacer de lo que está escribiendo para deshacerle el TABLERO. Son dos pilas
//    distintas y el atajo es uno: gana la de más cerca del foco. Por eso
//    `ignoraEnTexto` viene prendido, y por eso el dato es el FOCO y no el evento.
//
// 3. REHACER SE BORRA AL APILAR, y es lo correcto. Si se deshace tres pasos y después
//    se hace algo nuevo, los tres que estaban adelante ya no son un futuro posible:
//    dejarlos ahí deja un «rehacer» que reaparece un estado que nadie puede volver a
//    alcanzar. Es la misma razón por la que el deshacer del tablero del plan BORRA la
//    entrada del historial en vez de dejarla.

import { useCallback, useEffect, useRef, useState } from 'react';

/** Si el foco está en algo donde se tipea, el navegador ya tiene su propio Ctrl+Z. */
function enUnTexto(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const t = el.tagName;
  if (t === 'TEXTAREA') return true;
  // Un `<input type="checkbox">` no recibe texto: ahí el atajo sí es nuestro.
  if (t === 'INPUT') {
    const tipo = (el as HTMLInputElement).type;
    return tipo !== 'checkbox' && tipo !== 'radio' && tipo !== 'range' && tipo !== 'button' && tipo !== 'submit';
  }
  return false;
}

export type PilaDeshacer<T> = {
  /** Guarda el estado de AHORA, antes de cambiarlo. Una vez por gesto. */
  apilar: (ahora: T) => void;
  deshacer: () => void;
  rehacer: () => void;
  /**
   * Olvida todo (atrás y adelante). Para lo que NO es un gesto que se deshace y cambia el estado entero: crear una hoja
   * del Dashboard o de General. Un paso viejo deshecho después restauraría un estado SIN lo creado.
   */
  vaciar: () => void;
  /** Cuántos pasos hay para atrás y para adelante. Es lo que apaga los botones. */
  puedeDeshacer: boolean;
  puedeRehacer: boolean;
};

export function usePilaDeshacer<T>(
  /**
   * Aplica el estado que recibe y DEVUELVE el que estaba. Ese retorno no es un
   * adorno: es lo único que le da a la otra pila algo que reaplicar. Con un
   * `=> void` acá, rehacer no tendría de dónde sacar el estado que se deshizo.
   */
  aplicar: (estado: T) => T,
  opts: { tope?: number; ignoraEnTexto?: boolean; activa?: boolean } = {},
): PilaDeshacer<T> {
  // Tope de 30, el mismo de la pila del video: es una pila de deshacer, no un
  // historial. «Treinta gestos hacia atrás es más de lo que nadie recuerda haber hecho.»
  const { tope = 30, ignoraEnTexto = true, activa = true } = opts;

  const atras = useRef<T[]>([]);
  const adelante = useRef<T[]>([]);
  const [, repintar] = useState(0);
  // `aplicar` suele ser una closure nueva en cada render: guardarla en un ref deja a
  // `deshacer`/`rehacer` estables, que es lo que hace que el listener de teclado no se
  // reinstale en cada tecla.
  const aplicarRef = useRef(aplicar);
  aplicarRef.current = aplicar;

  const apilar = useCallback((ahora: T) => {
    atras.current = [...atras.current.slice(-(tope - 1)), ahora];
    adelante.current = [];
    repintar((n) => n + 1);
  }, [tope]);

  const vaciar = useCallback(() => {
    if (!atras.current.length && !adelante.current.length) return;
    atras.current = [];
    adelante.current = [];
    repintar((n) => n + 1);
  }, []);

  const deshacer = useCallback(() => {
    const pila = atras.current;
    if (!pila.length) return;
    // El que se deshace va a la pila de rehacer, así que hay que apilar el estado
    // ACTUAL, no el que se va a restaurar. `aplicar` recibe el previo y devuelve el
    // actual justamente para eso: sin ese retorno, rehacer no tiene qué reaplicar.
    const previo = pila[pila.length - 1];
    atras.current = pila.slice(0, -1);
    const actual = aplicarRef.current(previo);
    adelante.current = [...adelante.current, actual];
    repintar((n) => n + 1);
  }, []);

  const rehacer = useCallback(() => {
    const pila = adelante.current;
    if (!pila.length) return;
    const siguiente = pila[pila.length - 1];
    adelante.current = pila.slice(0, -1);
    const actual = aplicarRef.current(siguiente);
    atras.current = [...atras.current, actual];
    repintar((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!activa) return;
    const alTeclado = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      // Ctrl+Y y Ctrl+Shift+Z son el mismo rehacer: el primero es el de Windows y el
      // segundo el de mac y el de los editores. Pedido «ctrl z / y», y el de shift va
      // de arriba porque en mac Ctrl+Y no existe.
      const esRehacer = k === 'y' || (k === 'z' && e.shiftKey);
      if (k !== 'z' && k !== 'y') return;
      if (ignoraEnTexto && enUnTexto()) return;
      e.preventDefault();
      if (esRehacer) rehacer(); else deshacer();
    };
    window.addEventListener('keydown', alTeclado);
    return () => window.removeEventListener('keydown', alTeclado);
  }, [activa, ignoraEnTexto, deshacer, rehacer]);

  return {
    apilar,
    deshacer,
    rehacer,
    vaciar,
    puedeDeshacer: atras.current.length > 0,
    puedeRehacer: adelante.current.length > 0,
  };
}
