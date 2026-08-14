'use server';

// =============================================================================
// Las páginas guardadas del workspace — leer, guardar, editar y borrar
// =============================================================================
// La decisión (normalizar, deduplicar, reemplazar al editar) vive en
// `lib/landing-paginas.ts`, sin `server-only`, para poder testearla. Acá queda
// solo el acceso al setting y el `revalidatePath`.

import { revalidatePath } from 'next/cache';
import { getSetting, setSetting } from '@/lib/settings';
import { requireRolWs } from '@/lib/tab-access';
import { PAGINAS_KEY, conPagina, parsearPaginas, sinPagina } from '@/lib/landing-paginas';

export type PaginasResult = { ok: true; paginas: string[] } | { ok: false; error: string };

/**
 * Todas las acciones pasan por el mismo gate de la pantalla. `getSetting` ya
 * scopea por workspace, así que nadie puede tocar la lista de otro — pero el
 * permiso de la TAB se pide igual: leer o escribir la config de un cliente no es
 * algo que deba poder hacer cualquiera que tenga sesión.
 */
async function leer(): Promise<string[]> {
  await requireRolWs([], { nav: 'integraciones' });
  return parsearPaginas(await getSetting(PAGINAS_KEY));
}

export async function getPaginasAction(): Promise<string[]> {
  return leer().catch(() => []);
}

/** Agrega una página, o REEMPLAZA `anterior` si viene (eso es «editar»). */
export async function guardarPaginaAction(url: string, anterior?: string | null): Promise<PaginasResult> {
  try {
    const actuales = await leer();
    const nuevas = conPagina(actuales, url, anterior);
    if (!nuevas) return { ok: false, error: 'Esa dirección no parece una página web.' };
    await setSetting(PAGINAS_KEY, JSON.stringify(nuevas));
    revalidatePath('/integraciones');
    return { ok: true, paginas: nuevas };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}

export async function borrarPaginaAction(url: string): Promise<PaginasResult> {
  try {
    const nuevas = sinPagina(await leer(), url);
    await setSetting(PAGINAS_KEY, JSON.stringify(nuevas));
    revalidatePath('/integraciones');
    return { ok: true, paginas: nuevas };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo borrar.' };
  }
}
