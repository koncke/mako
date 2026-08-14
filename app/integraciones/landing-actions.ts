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
import { OCULTAS_KEY, PAGINAS_KEY, conOculta, conPagina, parsearOcultas, parsearPaginas, sinPagina } from '@/lib/landing-paginas';

export type Listas = { paginas: string[]; ocultas: string[] };
export type PaginasResult = { ok: true; paginas: string[]; ocultas: string[] } | { ok: false; error: string };

/**
 * Todas las acciones pasan por el mismo gate de la pantalla. `getSetting` ya
 * scopea por workspace, así que nadie puede tocar la lista de otro — pero el
 * permiso de la TAB se pide igual: leer o escribir la config de un cliente no es
 * algo que deba poder hacer cualquiera que tenga sesión.
 */
async function leer(): Promise<Listas> {
  await requireRolWs([], { nav: 'integraciones' });
  const [p, o] = await Promise.all([getSetting(PAGINAS_KEY), getSetting(OCULTAS_KEY)]);
  return { paginas: parsearPaginas(p), ocultas: parsearOcultas(o) };
}

export async function getPaginasAction(): Promise<Listas> {
  return leer().catch(() => ({ paginas: [], ocultas: [] }));
}

/** Agrega una página, o REEMPLAZA `anterior` si viene (eso es «editar»). */
export async function guardarPaginaAction(url: string, anterior?: string | null): Promise<PaginasResult> {
  try {
    const { paginas, ocultas } = await leer();
    const nuevas = conPagina(paginas, url, anterior);
    if (!nuevas) return { ok: false, error: 'Esa dirección no parece una página web.' };
    await setSetting(PAGINAS_KEY, JSON.stringify(nuevas));
    revalidatePath('/integraciones');
    return { ok: true, paginas: nuevas, ocultas };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}

/**
 * Sacar una página de la lista. Son DOS cosas según de dónde salga, y por eso se
 * hacen las dos: si estaba guardada se borra, y en todos los casos se anota como
 * escondida — porque una guardada puede además estar llegando por los eventos, y
 * borrarla sola la haría reaparecer al toque como «detectada».
 */
export async function borrarPaginaAction(url: string): Promise<PaginasResult> {
  try {
    const { paginas, ocultas } = await leer();
    const nuevas = sinPagina(paginas, url);
    const nuevasOcultas = conOculta(ocultas, url);
    await Promise.all([
      setSetting(PAGINAS_KEY, JSON.stringify(nuevas)),
      setSetting(OCULTAS_KEY, JSON.stringify(nuevasOcultas)),
    ]);
    revalidatePath('/integraciones');
    return { ok: true, paginas: nuevas, ocultas: nuevasOcultas };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo borrar.' };
  }
}
