'use client';

// =============================================================================
// puente-diseno — cuál «Diseño editable» tiene el cursor, para lo que vive AFUERA de su iframe
// =============================================================================
// Martín (26/10/2026): «La barra de texto me aparece en gris, no es editable». El texto de una sección de diseño (todas
// las páginas de MaKo) vive en el documento de SU iframe (nodos/HtmlEditableVista.tsx): la selección de ProseMirror no
// está en un texto y la barra «Texto» (BarraFormato, modo fija) quedaba apagada entera. Esto le dice a la barra qué
// documento tiene el cursor para que lea su estado y escriba ahí (./acciones-diseno.ts).
//
// También decide qué barrita de diseño se ve: la del diseño ACTIVO, y se queda mientras lo sea. Antes se iba con el
// `mouseleave` y el mouse no llegaba a apretarla (Martín: «no me dan tiempo a llegar a apretarlos y desaparecen»).
//
// Lo suelta: el diseño cuando se desmonta, y la barra cuando el cursor vuelve a un bloque de ProseMirror (su `focus`).
// =============================================================================

import { useSyncExternalStore } from 'react';

export type DisenoActivo = {
  /** El documento del iframe del diseño. */
  doc: Document;
  /** Guarda el HTML del diseño (el `guardar` de su vista: sin las marcas del editor). */
  guardar: () => void;
};

let actual: DisenoActivo | null = null;
let version = 0;
const oyentes = new Set<() => void>();
const avisar = () => { version++; oyentes.forEach((f) => f()); };

/** Este diseño tiene el cursor (y avisa, aunque ya lo tuviera: la selección de adentro cambió). */
export function activarDiseno(d: DisenoActivo): void {
  if (!actual || actual.doc !== d.doc) actual = d;
  avisar();
}

/** Lo suelta: el de ese documento (un diseño que se desmonta), o el que esté (el cursor volvió a ProseMirror). */
export function soltarDiseno(doc?: Document | null): void {
  if (!actual || (doc && actual.doc !== doc)) return;
  actual = null;
  avisar();
}

/** Algo cambió adentro del diseño activo (la selección, un formato): la barra vuelve a leer su estado. */
export const avisarDiseno = (): void => avisar();

export const disenoActivo = (): DisenoActivo | null => actual;

const suscribir = (f: () => void) => { oyentes.add(f); return () => { oyentes.delete(f); }; };
const leerVersion = () => version;

/** El diseño activo, y un número que cambia con cada aviso (para volver a leer su estado). */
export function useDisenoActivo(): { diseno: DisenoActivo | null; version: number } {
  const v = useSyncExternalStore(suscribir, leerVersion, () => 0);
  return { diseno: actual, version: v };
}
