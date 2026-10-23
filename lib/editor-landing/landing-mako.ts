import 'server-only';

// =============================================================================
// editor-landing/landing-mako — las landings de MaKo, hechas en Web Generator, servidas en hola-mako.com
// =============================================================================
// Pedido de Martín (23/10/2026): «Que tenga la landing principal de MaKo en el editable de web generator y que
// le pueda hacer cambios de allí y se apliquen». Y para el 25/10: «todas las landings de cada funcionalidad o
// cada avatar para vender MaKo».
//
// Las landings de MaKo son documentos de Web Generator del workspace de la PLATAFORMA (`wsSuperAdmin`, hoy el
// 9). Se editan y se publican como cualquier landing (hola-mako.site/<slug>), y hola-mako.com dibuja su FOTO
// PUBLICADA (nunca el borrador: «Publicar» es lo que aplica el cambio):
//   · la raíz (`/`, app/page.tsx): el documento que dice `app_settings[CLAVE_PRINCIPAL]` del ws de la
//     plataforma (`{"docId": <id>}`);
//   · `/vsl/<slug>` (app/vsl/[slug]/page.tsx): el documento de ese ws con ese slug publicado. Las 24 páginas
//     de funcionalidad que ya existen bajo /vsl son rutas fijas y les ganan (Next resuelve primero la fija).
//
// ⚠️ SÓLO el workspace de la plataforma. hola-mako.com es el origen de la app (con la cookie de sesión): lo que
//    publica un cliente vive en hola-mako.site (docs/diseno-editor-landing.md, tanda 4) y acá nunca se lee.
// ⚠️ SÓLO una página LIBRE (con «Diseño editable», html-editable.ts): es lo que la capa de la landing sabe
//    dibujar igual que la página publicada. Otra cosa devuelve null y la ruta cae a lo de antes.
// ⚠️ Con caché (`TAG_LANDING_MAKO`, 5 minutos): publicar o despublicar un documento de la plataforma la vence
//    (publicar.ts). Un error de la base NO rompe la portada: devuelve null y la raíz sirve la landing de siempre.
// =============================================================================

import { unstable_cache } from 'next/cache';
import { getSupabaseServer } from '../supabase';
import { wsSuperAdmin } from '../workspace';
import { slugValido } from './doc';
import { leerFoto } from './server-reglas';
import { CLASE_LIBRE } from './html-editable';

export const TAG_LANDING_MAKO = 'landing-mako';
/** app_settings del ws de la plataforma: `{"docId": <id>}` = el documento que se sirve en la raíz de hola-mako.com. */
export const CLAVE_PRINCIPAL = 'web-generator.landing-principal';

export type LandingMako = {
  docId: number;
  slug: string | null;
  titulo: string;
  /** El `<title>` y la descripción de la página publicada (su SEO). */
  seoTitulo: string;
  seoDescripcion: string;
  /** El HTML de la página de inicio: `div.gm-libre` (render.ts, página libre). */
  html: string;
  /** La base de la página libre y la hoja del documento (foto.cssDiseno). */
  cssDiseno: string;
  /** CSS_CONTENIDO congelado: sólo hace falta si la página trae secciones de Gamma (`.gm-doc`). */
  css: string;
  /** El Píxel de Meta del documento (config.sitio.metaPixelId). */
  metaPixelId: string | null;
};

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** El id del documento principal, leído del JSON de app_settings. Puro (lo prueba el test). */
export function docIdPrincipal(valor: unknown): number | null {
  if (typeof valor !== 'string') return null;
  try {
    const v = JSON.parse(valor) as unknown;
    const id = esObj(v) ? Number(v.docId) : NaN;
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

/** La landing a partir de la fila (puro). null si no está publicada, apagada o no es una página libre. */
export function landingDeFila(f: Record<string, unknown> | null): LandingMako | null {
  if (!f || f.papelera_at || f.sitio_activo === false) return null;
  const foto = leerFoto(f.publicado);
  if (!foto) return null;
  const pagina = foto.paginas.find((p) => p.ruta === '') ?? foto.paginas[0];
  if (!pagina || !pagina.html.startsWith(`<div class="${CLASE_LIBRE}"`) || !foto.cssDiseno) return null;
  const pixel = foto.config?.sitio?.metaPixelId;
  return {
    docId: Number(f.id),
    slug: typeof f.slug === 'string' ? f.slug : null,
    titulo: typeof f.titulo === 'string' ? f.titulo : '',
    seoTitulo: pagina.titulo,
    seoDescripcion: pagina.descripcion,
    html: pagina.html,
    cssDiseno: foto.cssDiseno,
    css: foto.css,
    metaPixelId: typeof pixel === 'string' && /^\d{5,20}$/.test(pixel) ? pixel : null,
  };
}

const COLUMNAS = 'id, slug, titulo, publicado, sitio_activo, papelera_at';

async function leer(slug: string | null): Promise<LandingMako | null> {
  try {
    const db = getSupabaseServer();
    const ws = await wsSuperAdmin();
    let docId: number | null = null;
    if (slug === null) {
      const { data } = await db.from('app_settings').select('value').eq('workspace_id', ws).eq('key', CLAVE_PRINCIPAL).maybeSingle();
      docId = docIdPrincipal((data as { value?: unknown } | null)?.value);
      if (!docId) return null;
    } else if (!slugValido(slug)) return null;
    const q = db.from('landing_docs').select(COLUMNAS).eq('workspace_id', ws);
    const { data, error } = await (docId ? q.eq('id', docId) : q.eq('slug', slug as string)).maybeSingle();
    if (error) { console.warn(`[landing-mako] ${slug ?? 'principal'}: ${error.message}`); return null; }
    return landingDeFila(data as Record<string, unknown> | null);
  } catch (e) {
    console.warn(`[landing-mako] ${slug ?? 'principal'}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** La landing principal de hola-mako.com (`slug` null) o la de `/vsl/<slug>`, con caché. null = la de siempre / 404. */
export function landingMako(slug: string | null): Promise<LandingMako | null> {
  return unstable_cache(() => leer(slug), ['landing-mako', slug ?? '(principal)'], { tags: [TAG_LANDING_MAKO], revalidate: 300 })();
}

/**
 * Lo que la capa de la landing (app/vsl/Landing.tsx, `DisenoLanding`) necesita de la publicada: el HTML, la hoja
 * del diseño y CSS_CONTENIDO sólo si la página trae secciones de Gamma (`.gm-doc`).
 */
export function disenoDeLanding(l: LandingMako | null): { html: string; css: string; cssContenido: string | null } | null {
  return l ? { html: l.html, css: l.cssDiseno, cssContenido: l.html.includes('class="gm-doc"') ? l.css : null } : null;
}
