import 'server-only';

// =============================================================================
// El `?desde=` del editor, resuelto en el workspace de la sesión
// =============================================================================
// Ver ./desde.ts: la ref viaja, la url NO. Acá se arma con las mismas funciones
// que escribieron el archivo, adentro del workspace que validó el proxy.
//
// ⚠️ «No pude leer» NO es «no existe». `resolverCreativoMako` tira ante un error de
// la base (lib/creativo-mako-fuentes.ts) y acá se devuelve `error`, no `no-esta`:
// decirle «ese anuncio ya no está» a alguien cuyo anuncio sí está lo manda a
// generar otro.

import { resolverCreativoMako } from '@/lib/creativo-mako-fuentes';
import { leerAnuncios } from '@/app/video-generator/anuncios-datos';
import { nombreDeAnuncio } from '@/app/video-generator/video-pedido';
import { leerRefDesde, refDesdeTexto, type DesdeEditor } from './desde';

/** El título del proyecto: el del anuncio, acotado (es lo que se lee en el inicio). */
const tituloDe = (t: string) => t.replace(/\s+/g, ' ').trim().slice(0, 80) || 'Anuncio';

export async function resolverDesde(desde: string): Promise<DesdeEditor> {
  const r = leerRefDesde(desde);
  if (!r) return { estado: 'no-esta' };
  const ref = refDesdeTexto(r);
  try {
    if (r.origen === 'anuncio') {
      // `leerAnuncios` lee el setting DEL WORKSPACE en curso (app_settings por
      // workspace_id) y es tolerante: basura o un error de lectura dan lista vacía.
      const a = (await leerAnuncios()).find((x) => x.id === r.id);
      if (!a) return { estado: 'no-esta' };
      const titulo = tituloDe(a.titulo);
      return { estado: 'listo', ref, titulo, archivo: nombreDeAnuncio(titulo), url: a.url };
    }
    const c = await resolverCreativoMako(r.ref);
    // 'cambio' = la toma se volvió a filmar después de que se armó el botón: el
    // clip que se pidió ya no es el que está guardado. Abrir el nuevo sería editar
    // un video que la persona no eligió.
    if (!c || c === 'cambio') return { estado: 'no-esta' };
    const titulo = tituloDe(c.toma != null ? `${c.titulo} · toma ${c.toma}` : c.titulo);
    return { estado: 'listo', ref, titulo, archivo: nombreDeAnuncio(titulo), url: c.url };
  } catch (e) {
    console.error('[video-editor] no se pudo resolver el desde:', e instanceof Error ? e.message : e);
    return { estado: 'error' };
  }
}
