'use client';

// =============================================================================
// El contexto del shell de /m: lo que una página le pide al cromo
// =============================================================================
// El shell (header, barra, toasts, conexión) vive en el layout y las páginas no
// pueden pasarle props hacia arriba. Este contexto es el canal: una página pisa la
// cabecera (<CabeceraM>), muestra un toast (useToastM) o pregunta si hay red
// (useConexion) sin saber dónde está dibujado nada.
//
// Fuera del shell (un test, una pantalla de escritorio que reuse una primitiva)
// todo es un no-op: nada tira por no estar adentro.
// =============================================================================

import { createContext, useContext, type ReactNode } from 'react';
import type { PadreM } from './cabecera';

/**
 * Lo que una página pisa de la cabecera. `undefined` = lo de siempre para esta
 * ruta (app/m/_ui/cabecera.ts); `padre: null` = sin «volver»; `accion: null` = sin
 * acción a la derecha.
 *
 *   · `trabajo: true` — pantalla de trabajo (un editor, un chat): sin título grande, el
 *     nombre en la barra desde el principio, con filete, y SIN la barra de abajo.
 *   · `grande: false` — la página dibuja su propio encabezado (la ficha de un lead: avatar
 *     y nombre) en vez del título grande. Si marca ese encabezado con el atributo
 *     `data-m-titulo-grande`, el nombre chico aparece en la barra cuando ese encabezado se
 *     va al hacer scroll; si no marca nada, el nombre chico está siempre.
 */
export type CabeceraPisada = {
  titulo?: string;
  padre?: PadreM | null;
  accion?: ReactNode;
  trabajo?: boolean;
  grande?: boolean;
};

export type ConexionM = {
  /** `navigator.onLine`. Sin red, lo que escribe se deshabilita con el motivo pegado. */
  enLinea: boolean;
  /** Epoch ms de la última vez que la pantalla cargó datos con red (para «datos de las 10:42»). */
  datosDe: number | null;
};

export type OpcionesToast = {
  /** Si la acción se puede revertir: aparece «Deshacer» y el toast dura 5 s en vez de 3,2. */
  deshacer?: () => void;
};

type ValorShell = {
  /** false fuera de /m: las primitivas pueden decidir no hacer nada. */
  dentro: boolean;
  setCabecera: (c: CabeceraPisada | null) => void;
  conexion: ConexionM;
  /** Avisa que la pantalla acaba de cargar datos frescos (lo llama el pull-to-refresh). */
  marcarCarga: () => void;
  toast: (mensaje: string, opciones?: OpcionesToast) => void;
};

const SIN_SHELL: ValorShell = {
  dentro: false,
  setCabecera: () => {},
  conexion: { enLinea: true, datosDe: null },
  marcarCarga: () => {},
  toast: () => {},
};

export const ShellCtx = createContext<ValorShell>(SIN_SHELL);

export function useShellM(): ValorShell {
  return useContext(ShellCtx);
}

/**
 * El toast de /m: 3-4 palabras («Completada», «Agendada», «Nota guardada»), y
 * `deshacer` si la acción es reversible. Uno a la vez: el nuevo reemplaza al que
 * estaba.
 *
 *   const toast = useToastM();
 *   toast('Completada', { deshacer: () => reabrir(id) });
 */
export function useToastM(): ValorShell['toast'] {
  return useContext(ShellCtx).toast;
}

/** ¿Hay red, y desde cuándo son los datos? Una aprobación NUNCA se encola sin red. */
export function useConexion(): ConexionM {
  return useContext(ShellCtx).conexion;
}
