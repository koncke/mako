'use client';

// =============================================================================
// El adaptador de MaKo: el editor de Doory guardando en la base
// =============================================================================
// `EditorAdapter` es el ÚNICO enchufe entre el motor y MaKo (_doory/types/adapter.ts). Éste guarda
// el documento con compare-and-set (/api/image-editor/disenos/<id>), sube las imágenes y audios a
// «Subidos» (bucket público, ver ./nube.ts) y lista «Subidos» desde la base. Los catálogos (fuentes,
// elementos, plantillas) son los de ./servicios.ts. Lo que Doory pide a su backend y MaKo no tiene
// (Marca, fotos de stock, versiones, compartir, comentarios) queda en `null`: el editor lo esconde.
//
// Un `idb://` (una imagen que quedó en la base del navegador de la etapa 1) se SUBE antes de
// guardar y se reescribe por su URL: el server no acepta un documento con `idb://` ni `blob:`,
// porque en otra máquina sería un hueco (lib/image-editor/reglas.ts → srcsLocales).

import type { AssetRef, EditorAdapter } from '../_doory/types/adapter';
import type { Asset } from '../_doory/types/api';
import type { DoryDocument } from '../_doory/types/document';
import { RevisionConflictError } from '../_doory/features/editor/adapters/errors';
import { readImageInfo, UnsupportedImageError } from '../_doory/features/editor/adapters/images';
import { removeMissingAssetReferences } from '../_doory/features/editor/adapters/migrateLocalDesign';
import { collectLocalAssetIds, rewriteLocalAssetSrcs } from '../_doory/lib/document';
import type { LocalRepository } from '../_doory/lib/local/repository';
import type { Subido } from '@/lib/image-editor/tipos';
import type { SenalesNegocio } from '@/lib/plantillas-sugeridas';
import { serviciosCatalogo } from './servicios';
import { IMAGEN_DIRECTA, aRaster, borrarSubido, guardarDiseno, listarSubidos, subirArchivo, subirMiniatura, tipoDeAudio } from './nube';

/** Cada cuánto sube la miniatura como mucho (la del Doory original: 15 s). */
const MINIATURA_CADA_MS = 15_000;
const TOPE_IMAGEN = 15 * 1024 * 1024;
const TOPE_AUDIO = 25 * 1024 * 1024;

/** La versión del diseño que tiene esta pestaña: la lee cada guardado (compare-and-set). */
export type Version = { get(): number; set(v: number): void };

export function subidoAAsset(s: Subido): Asset {
  const audio = s.tipo.startsWith('audio/');
  return {
    id: s.id, kind: audio ? 'audio' : 'image', name: s.nombre, url: s.url, thumb_url: audio ? '' : s.url,
    width: s.ancho, height: s.alto, size: s.bytes, mime: s.tipo, tags: [], attribution: null, created_at: s.creado,
  };
}

/** Sube a «Subidos» lo que el motor manda: imagen (raster tal cual; SVG y AVIF dibujados a PNG) o audio. */
export async function subirAsset(file: Blob, nombrePedido?: string): Promise<AssetRef> {
  const nombre = nombrePedido ?? (file instanceof File ? file.name : 'Imagen');
  const audio = file.type.startsWith('audio/') || (!file.type.startsWith('image/') && tipoDeAudio(file, nombre) !== null);
  if (audio) {
    const tipo = tipoDeAudio(file, nombre);
    if (!tipo) throw new UnsupportedImageError('Sube el audio como MP3, OGG, WAV o M4A.');
    if (file.size > TOPE_AUDIO) throw new UnsupportedImageError('El audio pesa más de 25 MB. Prueba con un archivo más corto.');
    const s = await subirArchivo(file, { nombre, tipo });
    return { id: s.id, url: s.url, thumbUrl: '', width: 0, height: 0, name: s.nombre, kind: 'audio' };
  }
  const info = await readImageInfo(file);
  let blob: Blob = file;
  let tipo = info.mime;
  if (!IMAGEN_DIRECTA.has(tipo)) {
    blob = await aRaster(file, info.width, info.height);
    tipo = 'image/png';
  }
  if (blob.size > TOPE_IMAGEN) throw new UnsupportedImageError('La imagen pesa más de 15 MB. Prueba con un archivo más ligero.');
  const s = await subirArchivo(blob, { nombre, tipo, ancho: info.width, alto: info.height });
  return { id: s.id, url: s.url, thumbUrl: s.url, width: info.width || s.ancho, height: info.height || s.alto, name: s.nombre, kind: 'image' };
}

/**
 * Sube los `idb://` de un documento y devuelve una copia con sus URLs. `hechos` recuerda lo ya subido
 * (id local → URL) para que el próximo guardado no vuelva a subirlo: el documento que tiene el motor
 * en memoria sigue diciendo `idb://` hasta que se reabre. Lo que ya no está en el navegador sale del
 * documento (con un aviso en la consola): un hueco que ningún guardado podría arreglar.
 */
export async function subirLocales(doc: DoryDocument, repo: LocalRepository | null, hechos: Map<string, { url: string; assetId?: string }>): Promise<DoryDocument> {
  const pendientes = collectLocalAssetIds(doc).filter((id) => !hechos.has(id));
  const faltan = new Set<string>();
  for (const id of pendientes) {
    const local = repo ? await repo.getAsset(id).catch(() => null) : null;
    if (!local) { faltan.add(id); continue; }
    const ref = await subirAsset(new File([local.blob], local.name, { type: local.mime }), local.name);
    hechos.set(id, { url: ref.url, assetId: ref.id });
  }
  let out = hechos.size ? rewriteLocalAssetSrcs(doc, hechos) : doc;
  if (faltan.size) {
    console.warn(`[image-editor] ${faltan.size} imagen(es) ya no estaban en este navegador y quedaron fuera del diseño`);
    out = removeMissingAssetReferences(out, faltan);
  }
  return out;
}

export function crearAdaptadorNube(o: {
  id: string;
  version: Version;
  /** La base local de la etapa 1 de este workspace: de ahí salen los `idb://` que falten subir. */
  repoLocal: LocalRepository | null;
  /** «Copiar y redimensionar»: crea el diseño nuevo y lo abre (la cáscara sabe navegar). */
  duplicar: (input: { title: string; document: DoryDocument }) => Promise<void>;
  /** Lo que se sabe del negocio (lo lee la page): el panel de plantillas pone primero las sugeridas. */
  senales?: SenalesNegocio | null;
}): EditorAdapter {
  let ultimaMiniatura = 0;
  const hechos = new Map<string, { url: string; assetId?: string }>();
  const nube = serviciosCatalogo(o.senales);
  return {
    async save({ document, title, thumbnail }) {
      const doc = await subirLocales(document, o.repoLocal, hechos);
      const r = await guardarDiseno(o.id, { version: o.version.get(), titulo: title, doc });
      if (!r.ok) {
        if (r.conflicto) throw new RevisionConflictError(r.versionActual ?? null);
        throw new Error(r.error);
      }
      o.version.set(r.version);
      const ahora = Date.now();
      if (thumbnail && ahora - ultimaMiniatura >= MINIATURA_CADA_MS) {
        ultimaMiniatura = ahora;
        // La miniatura no frena el guardado: si falla, la lista muestra la hoja en blanco.
        void subirMiniatura(o.id, thumbnail).catch(() => undefined);
      }
      return { savedAt: ahora, revision: r.version };
    },
    // Quien está acá ya entró a MaKo: no hay «crear una cuenta».
    requireAccount: async () => true,
    uploadAsset: (file, opts) => subirAsset(file, opts?.name),
    async resolveSrc(src) {
      const m = /^idb:\/\/([0-9a-f-]{36})$/i.exec(src);
      if (!m) return src;
      const ya = hechos.get(m[1].toLowerCase());
      if (ya) return ya.url;
      const url = o.repoLocal ? await o.repoLocal.getAssetObjectUrl(m[1]) : null;
      if (!url) throw new Error('Esta imagen ya no está en este navegador.');
      return url;
    },
    services: {
      ...nube,
      assets: {
        async list(q) {
          const r = await listarSubidos(q.kind === 'audio' ? 'audio' : 'imagen', q.q ?? '');
          if (!r.ok) throw new Error(r.error);
          const todos = r.subidos.map(subidoAAsset);
          return { count: todos.length, next: null, previous: null, results: todos };
        },
        async remove(id) {
          const r = await borrarSubido(id);
          if (!r.ok) throw new Error(r.error);
        },
      },
      brand: null,
      stock: null,
      versions: null,
      sharing: null,
      comments: null,
    },
    duplicateDesign: o.duplicar,
  };
}
