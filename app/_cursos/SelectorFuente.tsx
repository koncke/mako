'use client';

/**
 * La FUENTE del curso en el navegador: cargar la hoja de una familia cuando hace falta, y el selector
 * que va en el menú de la marca, debajo del color (item 3 del 08/10/2026). El catálogo y las reglas
 * (qué se guarda, qué variables se pintan) son puros y viven en ./fuentes.ts.
 *
 * ⚠️ CADA FAMILIA ENTRA UNA SOLA VEZ, con un `<link>` de id propio en el `<head>`, como la hoja del
 *    curso (`useCssUgc`, ./CursoUgc.tsx). Nunca se arma una hoja «sólo con las letras de la muestra»
 *    (el `text=` de Google, que pesa menos): declara la MISMA familia con menos glifos, y si llega
 *    después de la completa le gana —el curso dibujaría con la de respaldo todas las letras que no
 *    estaban en la muestra, sin un error—.
 */

import { useEffect, type CSSProperties } from 'react';
import { FUENTES, fuenteDe, type FuenteCurso } from './fuentes';

/** El id del `<link>` de una familia. Uno por familia: lo buscan las dos puntas antes de crear otro. */
const idHoja = (f: FuenteCurso) => `ugc-fuente-${f.id}`;

/** Mete la hoja de Google de una familia si todavía no está. Sin hoja (la de siempre), nada. */
export function cargarHojaDeFuente(f: FuenteCurso): void {
  if (!f.hoja || typeof document === 'undefined') return;
  if (document.getElementById(idHoja(f))) return;
  const l = document.createElement('link');
  l.id = idHoja(f);
  l.rel = 'stylesheet';
  l.href = f.hoja;
  document.head.appendChild(l);
}

/**
 * Carga la hoja de cada fuente pedida (ids del catálogo; uno desconocido es la de siempre, que no carga
 * nada). En un efecto: el `<head>` no se toca al dibujar en el server.
 */
export function useHojasDeFuentes(ids: ReadonlyArray<string | null | undefined>): void {
  const firma = ids.map((i) => i ?? '').join('|');
  useEffect(() => {
    for (const id of firma.split('|')) if (id) cargarHojaDeFuente(fuenteDe(id));
  }, [firma]);
}

/**
 * El selector del menú de la marca: cada fuente escrita CON ELLA MISMA (la muestra), con una palabra
 * que la distingue, y la elegida marcada. Va adentro del menú, así que se monta sólo al abrirlo: recién
 * ahí se bajan las familias de las muestras.
 *
 * `onElegir` recibe el id; elegir la de siempre manda `null` (borra la fila, como el color).
 */
export function SelectorFuente({ actual, onElegir, disabled }: {
  actual: string | null | undefined;
  onElegir: (id: string | null) => void;
  disabled?: boolean;
}) {
  useHojasDeFuentes(FUENTES.map((f) => f.id));
  const elegida = fuenteDe(actual).id;
  return (
    <div className="ugc-fuentes" role="group" aria-label="Fuente del curso">
      {FUENTES.map((f) => (
        <button key={f.id} type="button" className={`ugc-menu-item ugc-fuente-op${f.id === elegida ? ' on' : ''}`}
          aria-pressed={f.id === elegida} disabled={disabled || undefined}
          onClick={() => { if (f.id !== elegida) onElegir(f.id === FUENTES[0].id ? null : f.id); }}>
          <span className="ugc-fuente-nombre" style={{ fontFamily: f.pila } as CSSProperties}>{f.nombre}</span>
          <span className="ugc-fuente-tipo">{f.tipo}</span>
        </button>
      ))}
    </div>
  );
}
