// =============================================================================
// «Publicar» desde un editor de Create → una Publicación del Calendario (29/10/2026)
// =============================================================================
// Lo comparten el Video Editor (el diálogo de exportar), el Image Editor (el de descargar) y el Copywriter (el menú de la página).
// Arma la Publicación en el servidor (`publicacionDesdeCrearAction`), sube el archivo por la MISMA subida firmada que el Calendario
// (`subirConProgreso`, como app/calendario/PublicarEnRed.tsx) y devuelve a dónde ir: el evento abierto en el Calendario, donde se
// eligen la red, el día y la hora. Un solo camino de publicación (lib/calendario-desde-crear.ts).
//
// ⚠️ Quien llama navega con el `useRouter` de app/_ui/Link: conserva el `?ws=` de quien está adentro de otro negocio.

import { guardarPublicacionAction, publicacionDesdeCrearAction } from './actions';
import { subirConProgreso } from '@/app/customer-success/curso/subir-video';
import { urlDelEventoEnCalendario, type OrigenCrear } from '@/lib/calendario-desde-crear';

export type ResultadoPublicarDesdeCrear = { ok: true; url: string } | { ok: false; error: string; url?: string };

export async function llevarAlCalendario(p: {
  origen: OrigenCrear;
  titulo?: string | null;
  texto?: string | null;
  /** El video o la imagen exportados (nada para el texto). */
  archivo?: Blob | null;
  nombre?: string;
  onProgreso?: (pct: number) => void;
}): Promise<ResultadoPublicarDesdeCrear> {
  const mime = p.archivo?.type || null;
  let r: Awaited<ReturnType<typeof publicacionDesdeCrearAction>>;
  try {
    r = await publicacionDesdeCrearAction({ origen: p.origen, titulo: p.titulo ?? null, texto: p.texto ?? null, mime });
  } catch {
    return { ok: false, error: 'No se pudo llevar al Calendario. Revisa tu conexión.' };
  }
  if (!r.ok) return r;
  const url = urlDelEventoEnCalendario(r.id, r.fecha);
  if (r.subida && p.archivo) {
    const archivo = p.archivo instanceof File ? p.archivo : new File([p.archivo], p.nombre || 'publicacion', { type: mime ?? '' });
    try {
      await subirConProgreso(r.subida.url, archivo, r.subida.apikey, p.onProgreso ?? (() => {}), 'JPG, PNG, WEBP, MP4 o MOV').promesa;
      const g = await guardarPublicacionAction(r.id, { archivo: r.subida.ruta, archivoTipo: r.subida.tipo });
      if (!g.ok) return { ok: false, error: `${g.error} La publicación quedó en el Calendario sin el archivo: súbelo ahí.`, url };
    } catch (e) {
      // La Publicación ya existe: se dice dónde quedó, para no armar otra al reintentar.
      return { ok: false, error: `${e instanceof Error ? e.message : 'No se pudo subir.'} La publicación quedó en el Calendario sin el archivo: súbelo ahí.`, url };
    }
  }
  return { ok: true, url };
}
