// =============================================================================
// «Subir creativos» con los videos que MaKo ya generó (18/11/2026, F100 punto 1, lo prometido a Thiago)
// =============================================================================
// El servidor ya lo aceptaba desde el 6/11: `subir_preparar` devuelve `generados` (lib/media-buyer/subir.ts →
// generadosDelNegocio) y `subir_creativos` publica un archivo por su `ref`, sin bajarlo ni volverlo a subir, y con
// `original` lo prueba contra un anuncio del conjunto. La PANTALLA sólo aceptaba archivos del disco: esto es lo que le
// faltaba, puro y sin React para que tenga test (tests/media-buyer-subir-pantalla.test.ts).
//
// ⚠️ Sólo `import type` de lib/: la frontera de 'use client' es de datos. La url de cada video baja para la vista previa y
//    NO vuelve: al servidor va la `ref` (lib/creativo-mako.ts).
// =============================================================================

import type { CreativoMako } from '@/lib/creativo-mako';
import type { TextosCreativo } from '@/lib/media-buyer/creativos';

/** Cuántos archivos entran en una subida: el tope del servidor (revisarSubida, «hasta 10»). */
export const TOPE_SUBIDA = 10;

/**
 * Una fila de la lista «Archivos» del modal. Del disco: `path` cuando terminó de subir al staging. De MaKo: `ref`, lista desde
 * el primer momento (no hay nada que subir).
 */
export type ArchivoEnSubida = {
  clave: string; nombre: string; tipo: 'image' | 'video'; progreso: number;
  path: string | null; ref: string | null; error: string | null;
};

/** El nombre de un video de MaKo, como lo nombraba «Mis creativos» del Ads Manager de antes. */
export const nombreDeGenerado = (c: CreativoMako): string => (c.toma != null ? `${c.titulo} · toma ${c.toma}` : c.titulo);

/**
 * Los videos, como los agrupaba «Mis creativos» (MisCreativosMako.tsx, borrado con el Ads Manager el 27/10): primero los
 * anuncios MONTADOS y después las TOMAS sueltas, agrupadas por el anuncio del que salen (vienen en orden).
 */
export function agruparGenerados(generados: readonly CreativoMako[]): {
  montados: CreativoMako[];
  anuncios: Array<{ plan: string; titulo: string; tomas: CreativoMako[] }>;
} {
  const montados = generados.filter((c) => c.origen === 'montaje');
  const anuncios: Array<{ plan: string; titulo: string; tomas: CreativoMako[] }> = [];
  for (const t of generados) {
    if (t.origen !== 'toma') continue;
    const g = anuncios[anuncios.length - 1];
    if (g && g.plan === t.plan_id) g.tomas.push(t);
    else anuncios.push({ plan: t.plan_id, titulo: t.titulo, tomas: [t] });
  }
  return { montados, anuncios };
}

/**
 * Suma un video de MaKo a la lista. El mismo dos veces no entra (dos videos iguales son dos anuncios iguales), y con el tope
 * lleno tampoco: devuelve la MISMA lista, para que la pantalla no cambie.
 */
export function sumarGenerado(archivos: readonly ArchivoEnSubida[], c: CreativoMako): readonly ArchivoEnSubida[] {
  if (archivos.some((a) => a.ref === c.ref) || archivos.length >= TOPE_SUBIDA) return archivos;
  return [...archivos, { clave: `mako:${c.ref}`, nombre: nombreDeGenerado(c), tipo: 'video', progreso: 100, path: null, ref: c.ref, error: null }];
}

/** ¿Se puede publicar? Uno del disco, cuando terminó de subir; uno de MaKo, siempre que no haya fallado. */
export const archivoListo = (a: ArchivoEnSubida): boolean => !a.error && (!!a.path || !!a.ref);

/** ¿Todavía sube algo del disco? (lo de MaKo no sube nada). */
export const subiendoAlgo = (archivos: readonly ArchivoEnSubida[]): boolean => archivos.some((a) => !a.path && !a.ref && !a.error);

/**
 * El cuerpo de `subir_creativos`, con la forma que lee el servidor (lib/media-buyer/creativos.ts → leerPedidoDeSubida): uno del
 * disco va con su `path`; uno de MaKo, con su `ref` y el `path` vacío. `original` va sólo si se pidió probar contra él.
 */
export function pedidoDeSubida(x: {
  adSetId: string; textos: TextosCreativo; pausa: boolean; archivos: readonly ArchivoEnSubida[]; original: string | null;
}): Record<string, unknown> {
  const listos = x.archivos.filter(archivoListo);
  return {
    op: 'subir_creativos', adSetId: x.adSetId, textos: x.textos, activo: !x.pausa,
    archivos: listos.map((a) => (a.ref ? { path: '', tipo: 'video', nombre: a.nombre, ref: a.ref } : { path: a.path, tipo: a.tipo, nombre: a.nombre })),
    ...(x.original ? { original: x.original } : {}),
  };
}
