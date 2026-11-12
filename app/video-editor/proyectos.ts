'use client';

// =============================================================================
// Los proyectos del Video Editor para la lista de la tarjeta izquierda (app/_crear/PantallaCrear.tsx)
// =============================================================================
// Martín, 29/10/2026: «que los diferentes proyectos sean todos como en "Web generator" que estén al costado en la tab de
// chat con la flecha para ver a todos». La lista que mostraba la portada de CapCut (la que se borró ese día) ahora es la
// otra cara de la tarjeta del chat, en la portada Y con un proyecto abierto. Lo que hay que saber:
//   · el motor se carga A PEDIDO (`import()`): importarlo arriba metería IndexedDB, OPFS y el WASM en el HTML del server;
//   · los proyectos se leen con `storageService.loadAllProjectsMetadata()`, que SÓLO lee. Con un proyecto abierto,
//     `editor.project.getSavedProjects()` está vacío y `loadAllProjects()` pone el ProjectManager en «cargando», que frena
//     el guardado automático (docs/hallazgos-video-editor.md, «El almacenamiento es por ORIGEN»). En la portada, sin nada
//     abierto, sí corre `loadAllProjects()` antes: son las migraciones del almacenamiento que corría la portada de CapCut;
//   · la lista sigue a los cambios: el ProjectManager avisa al renombrar, duplicar, borrar y guardar, y se relee un rato
//     después (avisa en cada guardado: releer en cada uno sería leer la base varias veces por segundo editando).
// =============================================================================

import { useEffect, useState } from 'react';
import type { EditorCore } from './_opencut/core';
import type { TProjectMetadata } from './_opencut/project/types';

/** El motor (un singleton), cargado a pedido. */
// ⚠️ Por la puerta del motor (./editor-cargado.ts): un `import()` propio duplicaba el núcleo en la página (12/11/2026).
export const cargarMotor = (): Promise<EditorCore> => import('./editor-cargado').then((m) => m.EditorCore.getInstance());
const cargarAlmacen = () => import('./editor-cargado').then((m) => m.storageService);

/** Lo último tocado arriba (el orden de la lista de la tarjeta). */
export function ordenarProyectos(lista: readonly TProjectMetadata[]): TProjectMetadata[] {
  return [...lista].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/** Cuánto espera la lista después del último aviso del motor antes de releer. */
const RELEER_MS = 400;

export function useProyectosVideo(enPortada: boolean): {
  proyectos: TProjectMetadata[] | null;
  error: string | null;
  reintentar: () => void;
} {
  const [proyectos, setProyectos] = useState<TProjectMetadata[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vez, setVez] = useState(0);

  useEffect(() => {
    let vivo = true;
    let espera: ReturnType<typeof setTimeout> | undefined;
    let soltar = () => {};
    const leer = async () => {
      try {
        const metas = await (await cargarAlmacen()).loadAllProjectsMetadata();
        if (!vivo) return;
        setProyectos(ordenarProyectos(metas));
        setError(null);
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : String(e));
      }
    };
    void (async () => {
      try {
        const editor = await cargarMotor();
        if (!vivo) return;
        if (enPortada && !editor.project.getIsInitialized()) await editor.project.loadAllProjects();
        if (!vivo) return;
        soltar = editor.project.subscribe(() => {
          clearTimeout(espera);
          espera = setTimeout(() => void leer(), RELEER_MS);
        });
        await leer();
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      vivo = false;
      clearTimeout(espera);
      soltar();
    };
  }, [enPortada, vez]);

  return { proyectos, error, reintentar: () => setVez((v) => v + 1) };
}
