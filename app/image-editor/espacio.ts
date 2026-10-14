// =============================================================================
// El almacenamiento local del Image Editor, POR WORKSPACE
// =============================================================================
// Doory guarda los diseños de «invitado» y sus imágenes en IndexedDB, que es POR
// ORIGEN: todas las pestañas de hola-mako.com comparten las mismas bases. El super
// admin mira varios clientes en el mismo navegador (`?ws=N`): sin separar por
// workspace vería los diseños de todos mezclados. Molde: app/video-editor/espacio.ts.
//
// Un repositorio por workspace (no el singleton `localRepository` de Doory, que
// abre UNA base y la cachea para siempre): una pestaña que cambia de cliente sin
// recargar pasa a abrir la base del cliente nuevo.
//
// El número sale del server (getWorkspaceActual → prop de la página), nunca de la
// URL: el `?ws=` lo valida el proxy, y leerlo a mano para decidir datos es el IDOR
// que AGENTS.md describe en «Una cosa, un lugar».
//
// Es la etapa «plantilla para ir trabajando» (14/10): los diseños pasan a Supabase
// después (docs/editor-imagen/relevamiento-integracion-mako.md §5.7).

import { LocalRepository } from './_doory/lib/local/repository';
import { createIndexedDbStore, createMemoryStore, openDatabase } from './_doory/lib/local/store';

const repos = new Map<string, LocalRepository>();

/** `mako-ws3-image-editor`; `mako-ws0-…` cuando no hay workspace (no debería pasar: la page lo exige). */
export function nombreBase(ws: number | null): string {
  return `mako-ws${ws && Number.isInteger(ws) && ws > 0 ? ws : 0}-image-editor`;
}

/** El repositorio local de ESTE workspace (IndexedDB; en memoria si el navegador no deja). */
export function repositorioDe(ws: number | null): LocalRepository {
  const nombre = nombreBase(ws);
  let repo = repos.get(nombre);
  if (!repo) {
    repo = new LocalRepository(async () => {
      try {
        if (typeof indexedDB === 'undefined') throw new Error('Sin IndexedDB');
        return { store: createIndexedDbStore(await openDatabase(indexedDB, nombre)), mode: 'indexeddb' as const };
      } catch {
        return { store: createMemoryStore(), mode: 'memory' as const };
      }
    });
    repos.set(nombre, repo);
  }
  return repo;
}
