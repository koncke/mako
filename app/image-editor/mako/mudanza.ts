'use client';

// =============================================================================
// La mudanza: los diseños que quedaron en el navegador (etapa 1) suben a la base
// =============================================================================
// Hasta el 14/10/2026 el editor guardaba en IndexedDB, una base por workspace (../espacio.ts). Lo
// que se haya creado así se sube SOLO la primera vez que se abre el editor en ese navegador y ese
// workspace, sin preguntar: con su mismo id (los enlaces siguen sirviendo), sus imágenes subidas a
// «Subidos» y reescritas. El alta en el server es IDEMPOTENTE por id (lib/image-editor/server.ts →
// crearDiseno), así que una mudanza cortada se reintenta sin duplicar. Recién con el alta
// confirmada se borra la copia local.
//
// Nada de esto le pregunta a nadie (minimizar la configuración): si algo falla, la copia local
// queda intacta y se reintenta la próxima vez.

import { repositorioDe } from '../espacio';
import { crearDiseno } from './nube';
import { subirLocales } from './adaptadorNube';

const enCurso = new Map<string, Promise<{ mudados: number; fallas: number }>>();

/** Sube los diseños locales de `ws` (o sólo `soloId`). Devuelve cuántos subieron y cuántos fallaron. */
export function mudarLocales(ws: number | null, soloId?: string): Promise<{ mudados: number; fallas: number }> {
  const clave = `${ws ?? 0}:${soloId ?? '*'}`;
  let p = enCurso.get(clave);
  if (!p) {
    p = mudar(ws, soloId).finally(() => enCurso.delete(clave));
    enCurso.set(clave, p);
  }
  return p;
}

async function mudar(ws: number | null, soloId?: string): Promise<{ mudados: number; fallas: number }> {
  if (typeof indexedDB === 'undefined') return { mudados: 0, fallas: 0 };
  // `databases()` lista las bases que YA existen: no se crea una vacía por preguntar.
  try {
    if (typeof indexedDB.databases === 'function') {
      const bases = await indexedDB.databases();
      if (!bases.some((b) => b.name === `mako-ws${ws && ws > 0 ? ws : 0}-image-editor`)) return { mudados: 0, fallas: 0 };
    }
  } catch {
    /* el navegador no deja listar: se abre igual */
  }
  const repo = repositorioDe(ws);
  const lista = await repo.listDesigns().catch(() => []);
  let mudados = 0;
  let fallas = 0;
  for (const resumen of lista) {
    if (soloId && resumen.id !== soloId) continue;
    try {
      const d = await repo.getDesign(resumen.id);
      if (!d) continue;
      const doc = await subirLocales(d.document, repo, new Map());
      const r = await crearDiseno({ id: d.id, titulo: d.title, doc });
      if (!r.ok) throw new Error(r.error);
      await repo.deleteDesign(d.id);
      mudados++;
    } catch (e) {
      fallas++;
      console.warn(`[image-editor] no se pudo subir «${resumen.title}» a la base; queda en el navegador:`, e);
    }
  }
  return { mudados, fallas };
}
