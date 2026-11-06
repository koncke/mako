// =============================================================================
// editor-video/broll-pexels — lo que se lee de Pexels, sin red (para el B-roll del Video Editor)
// =============================================================================
// La fuente de las imágenes del B-roll es Pexels, con la clave de CADA negocio (lib/pexels.ts). Por qué Pexels:
//   · LA LICENCIA ES CLARA Y DEJA EL USO COMERCIAL: «All photos and videos on Pexels can be downloaded and used for
//     free», sin atribución obligatoria (pexels.com/license). Un anuncio es uso comercial; el repositorio que ya usan
//     las portadas (Openverse con CC0) está marcado «licencia NO VERIFICADA» para anuncios
//     (docs/hallazgos-video-pipeline.md), así que no sirve acá.
//   · Lo que pide su API (pexels.com/api/documentation, «Guidelines»): mostrar un link a Pexels y nombrar a quien sacó la
//     foto cuando se pueda. Por eso cada foto viaja con su `autor`, y el panel dice «Fotos de Pexels».
//   · Es la misma fuente que usa Submagic para su «Magic B-Rolls».
// Cada negocio con SU clave: el límite (200 pedidos por hora, 20.000 por mes) y los términos son de cada cuenta, y no
// hay una de la plataforma que la reemplace (la regla de Zernio, 23/10/2026).
//
// SIN `server-only`: lo prueba tests/video-editor-broll.test.ts sin red.
// =============================================================================

import type { BrollElegido } from './broll';

export const ORIGEN_API_PEXELS = 'https://api.pexels.com';
/** Desde donde se bajan las fotos: lo único que la ruta acepta bajar (`urlDeFotoPexels`). */
export const ORIGEN_FOTOS_PEXELS = 'https://images.pexels.com';

export type OrientacionBroll = 'vertical' | 'horizontal' | 'cuadrada';
const ORIENTACION_PEXELS: Readonly<Record<OrientacionBroll, 'portrait' | 'landscape' | 'square'>> = {
  vertical: 'portrait',
  horizontal: 'landscape',
  cuadrada: 'square',
};

/** La orientación del lienzo: lo que se busca y lo que se baja. */
export function orientacionDeLienzo(ancho: number, alto: number): OrientacionBroll {
  if (!(ancho > 0) || !(alto > 0)) return 'vertical';
  const r = ancho / alto;
  return r < 0.9 ? 'vertical' : r > 1.1 ? 'horizontal' : 'cuadrada';
}

export function orientacionPexels(o: OrientacionBroll): 'portrait' | 'landscape' | 'square' {
  return ORIENTACION_PEXELS[o] ?? 'portrait';
}

/** Una foto, como la ve el panel: la miniatura, quién la sacó y su página (para el crédito). */
export type FotoBroll = { id: number; ancho: number; alto: number; autor: string; pagina: string; mini: string; alt: string };

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Una URL de Pexels sólo si es del origen esperado. Nunca se arma: sale de lo que contestó su API. */
export function urlDePexels(v: unknown, origen: string): string | null {
  if (typeof v !== 'string') return null;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.origin === origen ? u.href : null;
  } catch {
    return null;
  }
}

/** Una foto del JSON de Pexels (`photos[i]` de /v1/search, o /v1/photos/:id). `null` si no trae lo que hace falta. */
export function fotoDePexels(crudo: unknown): FotoBroll | null {
  if (!crudo || typeof crudo !== 'object') return null;
  const o = crudo as Record<string, unknown>;
  const id = typeof o.id === 'number' && Number.isInteger(o.id) && o.id > 0 ? o.id : null;
  const src = o.src && typeof o.src === 'object' ? (o.src as Record<string, unknown>) : {};
  const mini = urlDePexels(src.medium ?? src.small ?? src.tiny, ORIGEN_FOTOS_PEXELS);
  if (id == null || !mini) return null;
  return {
    id,
    ancho: typeof o.width === 'number' ? o.width : 0,
    alto: typeof o.height === 'number' ? o.height : 0,
    autor: texto(o.photographer, 80),
    pagina: urlDePexels(o.url, 'https://www.pexels.com') ?? '',
    mini,
    alt: texto(o.alt, 160),
  };
}

/**
 * La URL que se BAJA para el video: el recorte que Pexels ya arma para la orientación (`portrait` 800×1200,
 * `landscape` 1200×627) o `large2x` (940 px de ancho al doble) para la cuadrada. Siempre de images.pexels.com.
 */
export function urlDeFotoPexels(crudo: unknown, orientacion: OrientacionBroll): string | null {
  if (!crudo || typeof crudo !== 'object') return null;
  const src = (crudo as { src?: unknown }).src;
  if (!src || typeof src !== 'object') return null;
  const s = src as Record<string, unknown>;
  const preferida = orientacion === 'vertical' ? s.portrait : orientacion === 'horizontal' ? s.landscape : s.large2x;
  return urlDePexels(preferida, ORIGEN_FOTOS_PEXELS) ?? urlDePexels(s.large2x, ORIGEN_FOTOS_PEXELS) ?? urlDePexels(s.large, ORIGEN_FOTOS_PEXELS);
}

/** Lo que se le dice a la persona cuando Pexels contesta mal (su texto, no el código). */
export function errorDePexels(status: number): string {
  if (status === 401 || status === 403) return 'Pexels no aceptó tu clave. Revísala en Integraciones.';
  if (status === 429) return 'Pasaste el límite de Pexels (200 búsquedas por hora). Vuelve a intentar en un rato.';
  if (status >= 500) return 'Pexels no contesta ahora. Vuelve a intentar en unos minutos.';
  return `Pexels contestó ${status}.`;
}

/** La primera foto de cada búsqueda que no se usó antes (dos huecos no llevan la misma foto). */
export function fotosElegidas(
  elegidos: readonly BrollElegido[],
  resultados: ReadonlyArray<{ consulta: string; fotos: FotoBroll[] }>,
): Array<{ elegido: BrollElegido; foto: FotoBroll }> {
  const porConsulta = new Map(resultados.map((r) => [r.consulta.toLowerCase(), r.fotos] as const));
  const usadas = new Set<number>();
  const out: Array<{ elegido: BrollElegido; foto: FotoBroll }> = [];
  for (const e of elegidos) {
    const foto = (porConsulta.get(e.busqueda.toLowerCase()) ?? []).find((f) => !usadas.has(f.id));
    if (!foto) continue;
    usadas.add(foto.id);
    out.push({ elegido: e, foto });
  }
  return out;
}
