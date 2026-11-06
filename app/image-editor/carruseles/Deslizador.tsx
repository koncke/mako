'use client';

// Un deslizador de DOS puntas sobre una lista de valores (el «múltiplo», las «interacciones» y las «láminas» del modal de filtros,
// ./FiltrosCarruselModal.tsx). Dos `input[type=range]` encimados: cada uno mueve una punta y el teclado funciona solo (flechas,
// Inicio y Fin). Los valores son POSICIONES en `pasos`: la punta de la izquierda en la primera = «sin mínimo» y la de la derecha en
// la última = «sin tope» (el rótulo de esa punta lleva «+»).

import s from './explorar.module.css';

export function Deslizador({ pasos, desde, hasta, onCambio, rotulo, nombre }: {
  pasos: readonly number[];
  /** Posición de la punta izquierda y de la derecha (índices de `pasos`). */
  desde: number;
  hasta: number;
  onCambio: (desde: number, hasta: number) => void;
  /** Cómo se lee un valor («2×», «1,2k», «8»). */
  rotulo: (valor: number, esElUltimo: boolean) => string;
  /** Para el lector de pantalla: «el múltiplo», «las láminas». */
  nombre: string;
}) {
  const ultimo = pasos.length - 1;
  const pct = (i: number) => (ultimo ? (i / ultimo) * 100 : 0);
  return (
    <div className={s.deslizador}>
      <div className={s.deslizadorPista} aria-hidden>
        <span className={s.deslizadorTramo} style={{ left: `${pct(desde)}%`, right: `${100 - pct(hasta)}%` }} />
      </div>
      <input type="range" min={0} max={ultimo} step={1} value={desde} aria-label={`${nombre}: mínimo`} aria-valuetext={rotulo(pasos[desde], desde === ultimo)}
        onChange={(e) => onCambio(Math.min(Number(e.target.value), hasta), hasta)} />
      <input type="range" min={0} max={ultimo} step={1} value={hasta} aria-label={`${nombre}: máximo`} aria-valuetext={rotulo(pasos[hasta], hasta === ultimo)}
        onChange={(e) => onCambio(desde, Math.max(Number(e.target.value), desde))} />
      <div className={s.deslizadorValores} aria-hidden>
        <span>{rotulo(pasos[desde], desde === ultimo)}</span>
        <span>{rotulo(pasos[hasta], hasta === ultimo)}</span>
      </div>
    </div>
  );
}
