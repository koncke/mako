// =============================================================================
// Los outliers de video: la portada de la tab Video (`/video-editor`), el contrato (PURO; 9/11/2026)
// =============================================================================
// Martín, 9/11/2026: «Tal como en imágenes, que se llame Video… vas a ver tus outliers primero»: reels y anuncios que funcionan
// y se pueden replicar. Copiado de Image (`/image-editor`, lib/carruseles/explorar.ts): la portada son los ejemplos, a pantalla
// completa, y «Crear desde cero» lleva a las plantillas (`?ver=crear`).
//
// DE DÓNDE SALEN: de FUENTES enchufables (lib/video-outliers-servidor.ts → FUENTES_OUTLIERS_VIDEO). La que investiga el chat
// «Outliers de reels y anuncios» entra como una fuente más, sin tocar la portada. Hoy hay una: la curada de MaKo
// (`OUTLIERS_CON_PLANTILLA`), un outlier por plantilla guiada (lib/video-plantillas/): el reel del que sale cada una.
//
// LAS REGLAS QUE LA PORTADA YA CUMPLE (la fuente no las repite):
//   · «No pude leer» no es «no hay»: una fuente que falla vuelve `{ ok: false, motivo }` y la portada lo dice.
//   · El outlier es el de toda la app (lib/multiplo-rendimiento.ts), con su motivo cuando no hay número; nunca uno propio.
//   · El dato de un tercero no se republica: la tarjeta lleva el link al original; la miniatura, sólo si la fuente la puede
//     servir (null si no: la tarjeta dibuja la ESTRUCTURA de su plantilla). AGENTS.md, «Copiar código y usar el dato».
//   · «Replicar» sólo con una plantilla guiada que existe (`plantillaGuiada`).
//
// Puro (sin `server-only`): lo usan el lector, la pantalla, la API y los tests.
// =============================================================================

import type { Multiplo } from './multiplo-rendimiento';
import { plantillaGuiada, PLANTILLAS_GUIADAS } from './video-plantillas';

export type RedOutlier = 'instagram' | 'tiktok' | 'youtube' | 'meta-ads';
export type FormatoOutlier = 'reel' | 'short' | 'anuncio';

export type OutlierVideo = {
  /** `<fuente>:<id de la fuente>`: único entre fuentes, estable (los guardados y la API lo usan). */
  id: string;
  fuente: string;
  red: RedOutlier;
  formato: FormatoOutlier;
  creador: { nombre: string; usuario: string | null };
  /** El link al original: siempre (una tarjeta sin él no se puede verificar). */
  url: string;
  /** Una imagen que la fuente PUEDE servir (nuestro bucket, o la que el proveedor autoriza mostrar). null = no hay. */
  miniatura: string | null;
  titulo: string;
  /** Lo que lo hace funcionar, en una frase (el gancho, la estructura). */
  porque: string;
  duracionS: number | null;
  /** El número de toda la app, o su motivo. null = la fuente no lo midió. */
  multiplo: Multiplo | null;
  /** El id de la plantilla guiada que lo replica (lib/video-plantillas/). null = todavía no hay. */
  plantilla: string | null;
};

export type LecturaFuente = { ok: true; outliers: readonly OutlierVideo[] } | { ok: false; motivo: string };

/** Una fuente de outliers: la curada, la de Spy, la que traiga el chat de outliers. `leer` corre en el server. */
export type FuenteOutliersVideo = {
  id: string;
  nombre: string;
  leer: () => Promise<LecturaFuente>;
};

/** Lo que dibuja la portada: los outliers en orden, y las fuentes que no se pudieron leer (con su motivo). */
export type PortadaOutliers = {
  outliers: OutlierVideo[];
  caidas: { fuente: string; nombre: string; motivo: string }[];
};

/** El outlier del que sale cada plantilla guiada: la fuente curada de MaKo. */
export const OUTLIERS_CON_PLANTILLA: readonly OutlierVideo[] = PLANTILLAS_GUIADAS.map((p): OutlierVideo => ({
  id: `mako:${p.id}`,
  fuente: 'mako',
  red: p.referencia.red,
  formato: p.referencia.formato,
  creador: { nombre: p.referencia.creador.nombre, usuario: p.referencia.creador.usuario },
  url: p.referencia.url,
  miniatura: null,
  titulo: p.nombre,
  porque: p.descripcion,
  duracionS: p.duracionS,
  // Sus números no se leyeron con la cuenta de su creador: no hay múltiplo, y se dice por qué (nunca uno inventado).
  multiplo: { veces: null, motivo: 'sin-cuenta', formato: 'corto', canal: p.referencia.red, comparadas: 0 },
  plantilla: p.id,
}));

export const FUENTE_MAKO: FuenteOutliersVideo = {
  id: 'mako',
  nombre: 'Plantillas de MaKo',
  leer: async () => ({ ok: true, outliers: OUTLIERS_CON_PLANTILLA }),
};

/** Una fila que no cumple el contrato no se dibuja (una fuente nueva puede traer basura): id con su fuente, link https. */
export function outlierValido(o: OutlierVideo): boolean {
  if (!o || typeof o.id !== 'string' || !o.id.startsWith(`${o.fuente}:`) || o.id.length > 120) return false;
  if (typeof o.url !== 'string' || !/^https:\/\//.test(o.url)) return false;
  if (o.miniatura != null && !/^(https:\/\/|\/)/.test(o.miniatura)) return false;
  return typeof o.titulo === 'string' && o.titulo.trim().length > 0;
}

/**
 * Junta lo leído de cada fuente: lo inválido afuera, sin repetidos (por id y por link), los que se pueden replicar primero y
 * después por múltiplo (sin número al final). Una fuente caída no tira las demás: queda en `caidas`, con su motivo.
 */
export function juntarOutliers(lecturas: readonly { fuente: FuenteOutliersVideo; lectura: LecturaFuente }[]): PortadaOutliers {
  const vistos = new Set<string>();
  const outliers: OutlierVideo[] = [];
  const caidas: PortadaOutliers['caidas'] = [];
  for (const { fuente, lectura } of lecturas) {
    if (!lectura.ok) { caidas.push({ fuente: fuente.id, nombre: fuente.nombre, motivo: lectura.motivo }); continue; }
    for (const o of lectura.outliers) {
      if (!outlierValido(o)) continue;
      const k = o.url.replace(/[?#].*$/, '').replace(/\/$/, '');
      if (vistos.has(o.id) || vistos.has(k)) continue;
      vistos.add(o.id); vistos.add(k);
      // Una plantilla que no existe no se ofrece: «Replicar» llevaría a nada.
      outliers.push(o.plantilla && !plantillaGuiada(o.plantilla) ? { ...o, plantilla: null } : o);
    }
  }
  const veces = (o: OutlierVideo) => (o.multiplo && o.multiplo.veces != null ? o.multiplo.veces : -1);
  outliers.sort((a, b) => Number(!!b.plantilla) - Number(!!a.plantilla) || veces(b) - veces(a));
  return { outliers, caidas };
}
