// =============================================================================
// editor-landing/seo-pagina — el título y la descripción con que sale cada página publicada (PURO)
// =============================================================================
// LA MISMA regla para dos: la foto que se publica (publicar.ts, por server-reglas.ts) y la vista previa de «Publicar → SEO»
// (app/web-generator/editor/dialogos/DialogoPublicar.tsx). Lo que el diálogo muestra es lo que leen Google y WhatsApp.
//
// Prueba en producción del 10/11/2026 (docs/pruebas/web-generator-10-11.md): una landing de la plantilla «Lead magnet», con
// el título ya escrito, salió publicada como «[Nombre de la guía] (gratis)» y «Descarga gratis [nombre de la guía] y [lo que
// va a lograr quien la lea].», mientras el diálogo prometía «Lead magnet / descarga». Dos causas:
//   · 11 de las 12 plantillas (plantillas.ts) traen un SEO de PÁGINA con textos a completar que la persona nunca ve: la
//     interfaz no edita el SEO de cada página. Uno con algo «[a completar]» (especificacion.ts) no se publica.
//   · En el inicio mandaba el SEO de la página sobre el del sitio, que es el ÚNICO que la persona escribe (Publicar → SEO):
//     lo escrito ahí no llegaba a la publicada. Ahora, en el inicio, manda lo que escribió la persona.
// =============================================================================

import { rangosACompletar } from './especificacion';
import type { Pagina } from './doc';

type PaginaSeo = Pick<Pagina, 'ruta' | 'titulo' | 'seoTitulo' | 'seoDescripcion'>;
type SitioSeo = { seoTitulo?: string | null; seoDescripcion?: string | null };

/** Un texto de SEO que todavía tiene algo «[a completar]» de la plantilla no se publica: vale ''. */
export function seoCompleto(s: string | null | undefined): string {
  const t = (s ?? '').trim();
  return t && rangosACompletar(t).length === 0 ? t : '';
}

/**
 * El título y la descripción de una página publicada (el `<title>`, el SEO y la vista previa al compartir).
 *   · El INICIO: lo que la persona escribió en Publicar → SEO; si no, el de la página (completo); si no, el título de la landing.
 *   · Una página INTERNA: la suya (completa); si no, su nombre; si no, el título de la landing. La descripción cae a la del sitio.
 */
export function metaDePagina(p: PaginaSeo, sitio: SitioSeo, tituloDoc: string): { titulo: string; descripcion: string } {
  const sitioT = (sitio.seoTitulo ?? '').trim();
  const sitioD = (sitio.seoDescripcion ?? '').trim();
  const propioT = seoCompleto(p.seoTitulo);
  const propioD = seoCompleto(p.seoDescripcion);
  const titulo = p.ruta === ''
    ? sitioT || propioT || tituloDoc
    : propioT || (p.titulo || '').trim() || tituloDoc;
  const descripcion = p.ruta === '' ? sitioD || propioD : propioD || sitioD;
  return { titulo: titulo.slice(0, 200), descripcion: descripcion.slice(0, 300) };
}
