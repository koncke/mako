// =============================================================================
// El estado de un proyecto de plantilla guiada (la tab Video, 9/11/2026): qué plantilla es y qué ya eligió la persona
// =============================================================================
// docs/relevo/nube-tab-video.md §4. Un proyecto del editor vive en el navegador (IndexedDB/OPFS, ../espacio.ts), así que lo de
// su plantilla vive al lado: en el `localStorage` del mismo origen, con el workspace en la clave (`conEspacio`: AGENTS.md, «Lo
// que se guarda en el NAVEGADOR lleva el workspace en la clave») y el id del proyecto. Lo lee el chat del editor para saber qué
// paso pide MaKo (lib/aperturas/video-guia.ts) y si el editor abre en modo simple.
//
// ⚠️ `localStorage` puede tirar (ventana privada, sitio bloqueado): todo va en try/catch y un proyecto sin estado legible es un
// proyecto SIN plantilla (MaKo no guía y el editor abre completo): nunca un error en pantalla.
// La parte pura (leer, sanear, cambiar) está en ./reglas.ts, con su test.
// =============================================================================

import { useSyncExternalStore } from 'react';
import { conEspacio } from '../espacio';
import { estadoNuevo, sanearEstadoGuia, type EstadoGuiaVideo } from './reglas';

const clave = (proyecto: string) => conEspacio(`video-guia:${proyecto}`);
const oyentes = new Set<() => void>();
/** Lo último leído por proyecto: `useSyncExternalStore` pide el MISMO objeto mientras no cambie. */
const cache = new Map<string, EstadoGuiaVideo | null>();

function leerCrudo(proyecto: string): EstadoGuiaVideo | null {
  try {
    const t = typeof window === 'undefined' ? null : window.localStorage.getItem(clave(proyecto));
    return t ? sanearEstadoGuia(JSON.parse(t)) : null;
  } catch { return null; }
}

export function leerGuia(proyecto: string): EstadoGuiaVideo | null {
  if (!proyecto) return null;
  const k = clave(proyecto);
  if (!cache.has(k)) cache.set(k, leerCrudo(proyecto));
  return cache.get(k) ?? null;
}

export function guardarGuia(proyecto: string, e: EstadoGuiaVideo): void {
  if (!proyecto) return;
  cache.set(clave(proyecto), e);
  try { window.localStorage.setItem(clave(proyecto), JSON.stringify(e)); } catch { /* sigue en memoria esta visita */ }
  for (const f of oyentes) f();
}

/** Marca un proyecto recién creado como de esta plantilla (lo llama «Nuevo video» al elegirla). */
export function empezarGuia(proyecto: string, plantilla: string): void {
  guardarGuia(proyecto, estadoNuevo(plantilla, Date.now()));
}

/** Cambia el estado de un proyecto con una función pura (./reglas.ts). Sin estado, no hace nada. */
export function cambiarGuia(proyecto: string, f: (e: EstadoGuiaVideo) => EstadoGuiaVideo): void {
  const e = leerGuia(proyecto);
  if (e) guardarGuia(proyecto, f(e));
}

const suscribir = (f: () => void) => { oyentes.add(f); return () => { oyentes.delete(f); }; };

/**
 * El proyecto abierto en el editor: lo fija la cabecera del editor (que tiene el motor) al montarse. Así lo que sólo pregunta
 * por el modo simple (la fila de pestañas de la biblioteca) no importa el motor, que trae el WASM y no carga en los tests.
 */
let abierto: string | null = null;
export function fijarProyectoAbierto(id: string | null): void {
  if (abierto === id) return;
  abierto = id;
  for (const f of oyentes) f();
}
export const proyectoAbierto = (): string | null => abierto;

export const suscribirGuia = suscribir;

/** El estado guiado del proyecto abierto, vivo. null = el proyecto no es de plantilla guiada. */
export function useGuiaVideo(proyecto: string | null | undefined): EstadoGuiaVideo | null {
  return useSyncExternalStore(suscribir, () => (proyecto ? leerGuia(proyecto) : null), () => null);
}
