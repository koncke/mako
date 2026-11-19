// =============================================================================
// cubos-proyectos — los videos del personaje en cubos de cada negocio (servidor)
// =============================================================================
// Un proyecto es TODO lo que hace falta para volver a dibujar el video igual: el formato, el guion, los datos, el personaje,
// la voz (la ruta del audio en el bucket) y sus tiempos. El MP4 no se guarda: se vuelve a armar en el navegador cuando se
// pide, y sale idéntico (la plantilla pinta cada segundo desde los mismos datos). Viven en los ajustes del negocio
// (`ai-avatar.cubos`, como los looks en `ai-avatar.looks`), los más nuevos primero y con tope.
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { getSetting, setSetting } from '@/lib/settings';
import { formatoCubos, type DatosCubos, type IdFormato } from './cubos-formatos';
import { normalizarPersonaje, type Personaje } from './cubos-personaje';
import type { Escena, Tiempos } from './cubos-tiempos';

const CLAVE = 'ai-avatar.cubos';
/** Cuántos videos se guardan por negocio (cada uno son unos 4 KB de texto). */
export const TOPE_PROYECTOS = 30;

export type ProyectoCubos = {
  id: string;
  creado: number;
  formato: IdFormato;
  escenas: Escena[];
  datos: DatosCubos;
  personaje: Personaje;
  voz: { tipo: 'mako' | 'clon' | 'audio'; nombre: string };
  /** La ruta del audio en el bucket de medios. */
  audio: string;
  tiempos: Tiempos;
};

const valido = (p: unknown): p is ProyectoCubos => {
  const o = p as ProyectoCubos;
  return !!o && typeof o.id === 'string' && !!formatoCubos(o.formato) && Array.isArray(o.escenas) && typeof o.audio === 'string'
    && !!o.tiempos && Array.isArray(o.tiempos.words) && !!o.tiempos.anchors;
};

export async function leerProyectosCubos(): Promise<ProyectoCubos[]> {
  try {
    const crudo = JSON.parse((await getSetting(CLAVE)) || '[]') as unknown[];
    return (Array.isArray(crudo) ? crudo : []).filter(valido).map((p) => ({ ...p, personaje: normalizarPersonaje(p.personaje) }));
  } catch {
    return [];
  }
}

export function proyectoNuevo(p: Omit<ProyectoCubos, 'id' | 'creado'>): ProyectoCubos {
  return { id: randomUUID(), creado: Date.now(), ...p };
}

/** Lo guarda (si ya estaba, lo reemplaza en su lugar; si es nuevo, va primero) y respeta el tope. */
export async function guardarProyectoCubos(p: ProyectoCubos): Promise<void> {
  const todos = await leerProyectosCubos();
  const i = todos.findIndex((x) => x.id === p.id);
  if (i >= 0) todos[i] = p; else todos.unshift(p);
  await setSetting(CLAVE, JSON.stringify(todos.slice(0, TOPE_PROYECTOS)));
}

export async function quitarProyectoCubos(id: string): Promise<void> {
  const todos = await leerProyectosCubos();
  await setSetting(CLAVE, JSON.stringify(todos.filter((x) => x.id !== id)));
}
