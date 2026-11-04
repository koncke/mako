// =============================================================================
// spy-medio — si una publicación de Instagram es un CARRUSEL, una imagen o un video, y cuántas láminas trae
// =============================================================================
// Martín, 4/11/2026: «quiero que… mires y copies las funcionalidades… para ponerlos en MaKo en la sección de imagen
// generator» (el explorador de carruseles que funcionan, app/image-editor). Spy guardaba toda publicación que no es un reel
// como `tipo: 'publicacion'`, así que un carrusel de 7 láminas y una foto suelta eran lo mismo: el explorador no podía decir
// cuáles son carruseles ni cuántas láminas trae cada uno. Las dos fuentes ya lo decían y se tiraba al guardar:
//   · Business Discovery (Meta): `media_type` = IMAGE · VIDEO · CAROUSEL_ALBUM. La cantidad de láminas NO viene (pide
//     `children`, que no se pide): queda en null, nunca se estima.
//   · Apify (`instagram-scraper` y el lector de perfiles): `type` = Image · Video · Sidecar, y las láminas en `childPosts`
//     o `images` (el más largo de los dos).
//
// Se guarda en dos columnas propias de `spy_piezas` (mig 0391, `medio` y `laminas`), y NO en el upsert de siempre: como el
// `funnel` de la 0373, una columna que todavía no existe haría fallar la lectura ENTERA de Instagram. Va en un update aparte,
// después de guardar, que se salta solo si la migración falta (`guardarMedios`, lib/spy.ts).
//
// Puro (sin `server-only`): lo importan lib/spy.ts, el explorador (lib/carruseles/) y los tests.
// =============================================================================

export const MEDIOS = ['carrusel', 'imagen', 'video'] as const;
export type Medio = (typeof MEDIOS)[number];

/** Más que esto no es un carrusel de Instagram (el tope de la app es 20); un número mayor es un dato roto, no se guarda. */
export const LAMINAS_MAX = 20;

/** El medio de una publicación por lo que dijo su fuente; null si no se sabe (un tipo vacío o desconocido no se adivina). */
export function medioDeInstagram(tipo: string | null | undefined): Medio | null {
  const t = String(tipo ?? '').trim().toLowerCase();
  if (t === 'carousel_album' || t === 'sidecar' || t === 'carousel') return 'carrusel';
  if (t === 'image' || t === 'photo' || t === 'graphimage') return 'imagen';
  if (t === 'video' || t === 'graphvideo' || t === 'clips' || t === 'reel') return 'video';
  return null;
}

/** Cuántas láminas trae un carrusel, por la lista que dio la fuente; null si no vino o si no es un número creíble. */
export function laminasDe(...listas: unknown[]): number | null {
  const n = Math.max(0, ...listas.map((l) => (Array.isArray(l) ? l.length : 0)));
  return n >= 2 && n <= LAMINAS_MAX ? n : null;
}

/** Una pieza leída con su medio, como la junta `gruposDeMedio`. */
export type ConMedio = { canal: string; ref: string; medio?: Medio | null; laminas?: number | null };

/**
 * Las piezas agrupadas por lo que hay que escribir: un update por grupo (`medio` + `laminas`) y no uno por pieza. Sólo
 * Instagram, y sólo lo que trae un medio (lo que no se sabe no se escribe: no pisa un medio que una lectura anterior sí supo).
 * Una imagen o un video no llevan láminas.
 */
export function gruposDeMedio(piezas: readonly ConMedio[]): Array<{ medio: Medio; laminas: number | null; refs: string[] }> {
  const grupos = new Map<string, { medio: Medio; laminas: number | null; refs: string[] }>();
  for (const p of piezas) {
    if (p.canal !== 'instagram' || !p.medio || !(MEDIOS as readonly string[]).includes(p.medio) || !p.ref) continue;
    const laminas = p.medio === 'carrusel' && p.laminas != null && p.laminas >= 2 && p.laminas <= LAMINAS_MAX ? Math.round(p.laminas) : null;
    const k = `${p.medio}|${laminas ?? ''}`;
    const g = grupos.get(k) ?? { medio: p.medio, laminas, refs: [] };
    g.refs.push(p.ref);
    grupos.set(k, g);
  }
  return [...grupos.values()];
}

/**
 * ¿El error es «la columna todavía no existe»? (la 0391 sin aplicar: PostgREST contesta PGRST204 con el nombre de la
 * columna, Postgres 42703). Ese caso se calla UNA vez: no es un error del negocio.
 */
export function faltaLaColumnaDeMedio(e: { code?: string; message?: string } | null | undefined): boolean {
  if (!e) return false;
  return (e.code === 'PGRST204' || e.code === '42703') && /\b(medio|laminas)\b/.test(e.message ?? '');
}
