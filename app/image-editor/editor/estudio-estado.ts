'use client';

// =============================================================================
// El estudio del Image Editor: QUÉ diseño está abierto y qué muestra la tarjeta de la izquierda, sin cambiar de ruta
// =============================================================================
// Pedido de Martín (27/10/2026), textual: «veas de adaptar las tabs de video e imagen con el chat que tenemos de MaKo,
// para que se pueda editar con prompting, algo similar a lo que hicimos con Web Generator, que este al costado, que los
// "proyectos" se vean en la barra del costado, y que no cambie de ruta». Lo dueña es ./Estudio.tsx; esto es lo que leen
// las piezas de adentro (la tarjeta, la lista, el chat, «Proyectos» del riel) sin importarla (sin ciclos de imports).
//
// Lo PURO (la URL que se escribe, qué diseño se abre al entrar, el filtro de la lista) vive en ./estudio-reglas.ts y
// ../ruta.ts, con su test.
// =============================================================================

import { createContext, useContext } from 'react';

/** Qué muestra la tarjeta de la izquierda: el chat de MaKo o la lista de diseños (la «←» de la cabecera del chat). */
export type VistaTarjeta = 'chat' | 'disenos';

/** Dónde arranca a buscar la vista de crear: en todo, o sólo en los diseños («Ver todo»). */
export type AmbitoCrear = 'todo' | 'disenos';

export type Estudio = {
  /** El diseño montado en el editor (o null: no hay ninguno, se está eligiendo qué crear). */
  abierto: string | null;
  /** La vista de crear («¿Qué diseñaremos hoy?») ocupa el lugar del editor. */
  creando: boolean;
  tarjeta: VistaTarjeta;
  /** Sube con cada alta, baja o cambio de diseño: la lista vuelve a pedir los diseños. */
  version: number;
  /** Abre ESE diseño en el mismo lugar: guarda el actual primero y escribe la URL con `replaceState`. */
  abrir: (id: string) => void;
  /** Muestra la vista de crear en lugar del editor (el actual queda montado, oculto, y guardado). */
  nuevo: (ambito?: AmbitoCrear) => void;
  /** Vuelve al chat (la estrella de MaKo, o tocar el diseño abierto): cierra la vista de crear si hay un diseño. */
  verChat: () => void;
  /** La «←» de la cabecera del chat: la MISMA tarjeta pasa a la lista, sin navegar. */
  verDisenos: () => void;
};

export const EstudioContexto = createContext<Estudio | null>(null);

/** El estudio, o null si la pieza se monta fuera (el presentador, un banco de pruebas). */
export function useEstudio(): Estudio | null {
  return useContext(EstudioContexto);
}
