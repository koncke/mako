'use server';

// =============================================================================
// El explorador de carruseles del Image Editor: guardar (carruseles y miniaturas) y las búsquedas guardadas («Editar» va por
// app/api/image-editor/carruseles/replicar, que se arma en vivo)
// =============================================================================
// La misma puerta que el editor (`puerta`, lib/image-editor/server.ts: sesión + la tab Image en su capa + un negocio).
// Lo que escriben es del NEGOCIO (sus referencias), con compare-and-set (lib/carruseles/explorar-servidor.ts y
// lib/thumbnails/servidor.ts). Leer y escribir lo hacen también la API de MaKo (lib/api-mako/areas/imagen.*): son las mismas
// funciones.
//
// ⛔ Sin la «Biblioteca» en la pantalla (6/11/2026; Martín: «elimina lo de "biblioteca", eso no lo quiero, aparte que está
// horrible»): la biblioteca de ejemplos se carga desde la PC (scripts/carruseles-biblioteca.mts) y se cambia por la API de MaKo
// (`ver_biblioteca_carruseles`, `cambiar_biblioteca_carruseles`). Tampoco la franja de «Carruseles que funcionan» arriba de las
// plantillas: los ejemplos SON la portada de Image.
// ⚠️ En un archivo 'use server' sólo se exportan funciones async (AGENTS.md).
// =============================================================================

import { puerta } from '@/lib/image-editor/server';
import { borrarBusqueda, guardarBusqueda, guardarCarrusel } from '@/lib/carruseles/explorar-servidor';
import { guardarThumbnail } from '@/lib/thumbnails/servidor';
import type { BusquedaGuardada } from '@/lib/carruseles/explorar';

type Mal = { ok: false; error: string };
const NO_ENTRA: Mal = { ok: false, error: 'Abre el Image Editor desde tu negocio para usar esto.' };

/** Guarda o saca un carrusel de las referencias del negocio. */
export async function guardarCarruselAction(id: number, guardar: boolean): Promise<{ ok: true; ids: number[] } | Mal> {
  if ((await puerta()) instanceof Response) return NO_ENTRA;
  const r = await guardarCarrusel(Number(id), !!guardar);
  return r.ok ? { ok: true, ids: r.valor.map((g) => g.id) } : r;
}

/** Guarda o saca una miniatura de YouTube (Thumbnails) de las referencias del negocio. */
export async function guardarThumbnailAction(id: number, guardar: boolean): Promise<{ ok: true; ids: number[] } | Mal> {
  if ((await puerta()) instanceof Response) return NO_ENTRA;
  const r = await guardarThumbnail(Number(id), !!guardar);
  return r.ok ? { ok: true, ids: r.valor.map((g) => g.id) } : r;
}

/** Guarda la búsqueda de ahora con un nombre. */
export async function guardarBusquedaAction(nombre: string, query: string): Promise<{ ok: true; busquedas: BusquedaGuardada[] } | Mal> {
  if ((await puerta()) instanceof Response) return NO_ENTRA;
  const r = await guardarBusqueda(String(nombre ?? ''), String(query ?? ''));
  return r.ok ? { ok: true, busquedas: r.valor } : r;
}

/** Borra una búsqueda guardada. */
export async function borrarBusquedaAction(id: string): Promise<{ ok: true; busquedas: BusquedaGuardada[] } | Mal> {
  if ((await puerta()) instanceof Response) return NO_ENTRA;
  const r = await borrarBusqueda(String(id ?? ''));
  return r.ok ? { ok: true, busquedas: r.valor } : r;
}
