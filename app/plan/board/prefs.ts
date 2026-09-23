'use client';

// =============================================================================
// prefs — lo que elegiste en la barra de arriba sobrevive al F5
// =============================================================================
// El reporte, textual (22/09/2026): «los filtros se resetean al recargar y al cambiar de
// pestaña». Y es peor de lo que suena: si filtrás por un proyecto para trabajar en él,
// cada recarga te devuelve las 241 tarjetas y hay que volver a armar la vista.
//
// ⚠️ ESTO GUARDA UNA PREFERENCIA, NUNCA UNA DECISIÓN (AGENTS.md). Acá viven el filtro, el
// orden y el modo de ver — cosas que elegiste para mirar. Lo que la pantalla recibe por
// props o por la URL (qué vista abrir, qué cliente estás mirando) no se restaura desde el
// navegador: restaurar «lo último que usaste» encima de lo que alguien acaba de elegir
// deja, en el mejor caso, un control muerto.
//
// ⚠️ Y ARRANCA SIEMPRE CON EL DEFAULT. Leer `localStorage` durante el render es HTML del
// server distinto del primer pintado del navegador, o sea un error de hidratación; y en un
// navegador con el storage bloqueado, el acceso TIRA. Se lee en el primer efecto, adentro
// de un try, y si no hay nada la pantalla queda como nace.
// =============================================================================

import { useEffect, useRef, useState } from 'react';

const PREFIJO = 'plan.pref.';

/**
 * El WORKSPACE que se está mirando, para que las preferencias no se crucen.
 *
 * ⚠️ El super-admin abre cada cliente en su propia pestaña y el board le pasa un `scope`
 * justamente por esto: sin él, el filtro «solo el proyecto P33» que alguien dejó puesto en
 * SU tablero viaja al de un cliente, donde ese id no existe — y el Kanban aparece vacío sin
 * que nada lo explique. El resto del board ya lo hacía con `dlKey`; estas preferencias
 * nacieron sin eso.
 */
let scopeActual = '';
export function setScopePrefs(scope?: string): void { scopeActual = scope ? '_' + scope : ''; }

function leer(clave: string): unknown {
  try {
    const crudo = localStorage.getItem(PREFIJO + clave + scopeActual);
    return crudo == null ? undefined : (JSON.parse(crudo) as unknown);
  } catch { return undefined; }
}
function escribir(clave: string, v: unknown): void {
  try { localStorage.setItem(PREFIJO + clave + scopeActual, JSON.stringify(v)); } catch { /* storage bloqueado: la pantalla anda igual */ }
}

/**
 * Un valor simple (string, boolean, número) que se recuerda por navegador.
 *
 * `valido` es obligatorio a propósito: lo que vuelve del storage lo escribió una versión
 * anterior de esta pantalla, así que es un dato de afuera. Sin saneo, un valor viejo que
 * ya no existe en el enum deja la vista en un estado que el código no contempla.
 */
export function usePref<T>(clave: string, inicial: T, valido: (v: unknown) => v is T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(inicial);
  const cargado = useRef(false);
  useEffect(() => {
    if (cargado.current) return;
    cargado.current = true;
    const guardado = leer(clave);
    if (valido(guardado)) setV(guardado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  return [v, (nuevo: T) => { setV(nuevo); escribir(clave, nuevo); }];
}

/**
 * Lo mismo para un `Set` de strings (los filtros): viaja como lista y vuelve como Set.
 *
 * `valido` filtra lo que vuelve. Sin él, un proyecto borrado sigue en el filtro para
 * siempre y la pantalla queda vacía sin que nada lo explique.
 */
export function usePrefSet<T extends string = string>(clave: string, valido?: (v: string) => v is T): [Set<T>, (s: Set<T>) => void] {
  const [v, setV] = useState<Set<T>>(new Set());
  const cargado = useRef(false);
  useEffect(() => {
    if (cargado.current) return;
    cargado.current = true;
    const guardado = leer(clave);
    if (!Array.isArray(guardado)) return;
    const strs = guardado.filter((x): x is string => typeof x === 'string');
    setV(new Set(valido ? strs.filter(valido) : (strs as T[])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  return [v, (s: Set<T>) => { setV(s); escribir(clave, [...s]); }];
}

/** Molde para el `valido` de un enum chico. */
export const esUnoDe = <T extends string>(...opciones: T[]) => (v: unknown): v is T => typeof v === 'string' && (opciones as string[]).includes(v);
export const esBool = (v: unknown): v is boolean => typeof v === 'boolean';
