// =============================================================================
// GET /l/html/<docId>/<bloque>[?vista=<token>] — el «HTML personalizado» de una landing, aislado
// =============================================================================
// Tanda 2, T6 (docs/diseno-editor-landing.md): «Formato libre (HTML)» con HTML, CSS y JS propios.
// La página publicada dibuja el bloque como `<iframe src="/l/html/<docId>/<bloque>"
// sandbox="allow-scripts allow-forms allow-popups">` (especificacion.ts, `specHtmlLibre`), y esta
// ruta sirve ESE documento con `Content-Security-Policy: sandbox …`: un origen OPACO que no ve la
// sesión de hola-mako.com, con su propia política (el `srcdoc` heredaba la estricta de la página y el
// JavaScript no corría). El documento lleva un script chico que le manda su alto al padre.
//
// De dónde sale el HTML:
//   · sin `vista`: de la FOTO publicada (`landing_docs.publicado.htmlLibre[<bloque>]`, la arma
//     publicar.ts con `fuentesHtmlLibre`): la versión publicada, nunca el borrador. Sitio pausado,
//     despublicado o en la papelera → 404, como /l/<slug>;
//   · con `vista=<token>`: del BORRADOR, si el token es el del link privado de ESA landing
//     (`vista_token`), saneado con el mismo validador que arma la vista previa (así el id del bloque
//     es el mismo que puso el render).
//
// ⚠️ PÚBLICA Y SIN COOKIE: `/l` está en PUBLICOS (lib/rutas-publicas.ts) como prefijo y, como no es
//    /api/, el proxy la deja sólo en GET/HEAD/OPTIONS. Lee con el cliente crudo por id, NUNCA con
//    `getTenantDb` (sin cookie caería al ws1, un cliente).
// ⚠️ LAS CABECERAS QUE IMPORTAN LAS PONE next.config.ts (`CABECERAS_HTML_LIBRE`): Next descarta el
//    header de una ruta si next.config ya puso el mismo, y el global manda `X-Frame-Options: DENY`.
// ⚠️ SÓLO SE SIRVE A UN IFRAME (`Sec-Fetch-Dest: iframe`, `pedidoDeIframe`): abierto como pestaña y
//    sin la política sandbox, el HTML del cliente correría con el origen y la sesión de MaKo.
// La decisión entera (formas, 404 sin enumerar, 503, ETag, caché) vive en `responderHtmlLibre`
// (lib/editor-landing/html-libre.ts), con test.
// ⚠️ EN EL DOMINIO DE UN CLIENTE (T7, integración de la tanda 2) esta ruta también se sirve: proxy.ts
//    la deja pasar (`PREFIJO_PASA`) con la cabecera `HEADER_DOMINIO` puesta por él (en hola-mako.com
//    `seguir` la borra: nadie la manda a mano). Ahí sólo se sirve un bloque de LA landing de ese
//    dominio y nunca el borrador: sin este corte, cliente.com/l/html/<otro id>/… serviría el HTML de
//    la landing de cualquier otro negocio bajo el dominio del cliente.
// ⚠️ TANDA 4 (14/10/2026): en producción esta ruta ya NO contesta en hola-mako.com (el proxy da 404:
//    `decidirLEnApp`). Contesta en hola-mako.site —donde viven todas las landings y su borrador por el
//    link privado, así que ahí sirve cualquier landing publicada y el `?vista=` como antes lo hacía
//    hola-mako.com— y en el dominio de un cliente (sólo SU landing, como arriba). En local, como siempre.
// =============================================================================
import type { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { sanearContenido } from '@/lib/editor-landing/validar';
import {
  RE_DOC_ID, htmlDeBloque, htmlLibreDeFoto, responderHtmlLibre,
} from '@/lib/editor-landing/html-libre';
import { HEADER_DOMINIO, hostDeCabecera } from '@/lib/editor-landing/dominios-reglas';
import { landingDeDominio } from '@/lib/editor-landing/dominios';

export const dynamic = 'force-dynamic';

type Params = Promise<{ docId: string; bloque: string }>;

/** El bloque de la foto PUBLICADA, o null si la landing no se sirve. Un error de base TIRA. */
async function leerPublicado(docId: string, bloque: string): Promise<string | null> {
  const { data, error } = await getSupabaseServer().from('landing_docs')
    .select('publicado, sitio_activo, papelera_at')
    .eq('id', Number(docId)).maybeSingle();
  if (error) throw new Error(error.message);
  const f = data as { publicado: unknown; sitio_activo: boolean; papelera_at: string | null } | null;
  if (!f || !f.publicado || !f.sitio_activo || f.papelera_at) return null;
  return htmlLibreDeFoto(f.publicado, bloque);
}

/** El bloque del BORRADOR por el link privado, o null si el token no es de esa landing. Un error de base TIRA. */
async function leerBorrador(docId: string, bloque: string, token: string): Promise<string | null> {
  const { data, error } = await getSupabaseServer().from('landing_docs')
    .select('contenido, papelera_at')
    .eq('id', Number(docId)).eq('vista_token', token).maybeSingle();
  if (error) throw new Error(error.message);
  const f = data as { contenido: unknown; papelera_at: string | null } | null;
  if (!f || f.papelera_at) return null;
  return htmlDeBloque(sanearContenido(f.contenido).contenido, bloque);
}

/**
 * En el dominio de un cliente: ¿este `docId` es el de la landing de ESE dominio? Sin la cabecera
 * (hola-mako.com), true. Un error de base TIRA (y `responderHtmlLibre` contesta 503, nunca 404).
 */
async function esDelDominio(req: NextRequest, docId: string): Promise<boolean> {
  const crudo = req.headers.get(HEADER_DOMINIO);
  if (crudo == null) return true;
  const host = hostDeCabecera(crudo);
  if (!host) return false;
  const landing = await landingDeDominio(host);
  return !!landing && String(landing.docId) === docId;
}

export async function GET(req: NextRequest, ctx: { params: Params }) {
  const { docId, bloque } = await ctx.params;
  const enDominio = req.headers.get(HEADER_DOMINIO) != null;
  // En un dominio de cliente no hay borrador: el link privado vive en hola-mako.site (en local, en la app).
  const vista = enDominio ? null : req.nextUrl.searchParams.get('vista');
  return responderHtmlLibre(req, { docId, bloque, vista }, {
    // `responderHtmlLibre` valida las formas ANTES de llamar a esto: acá ya llegan sanas.
    leer: async () => {
      if (!RE_DOC_ID.test(docId) || !(await esDelDominio(req, docId))) return null;
      return vista ? leerBorrador(docId, bloque, vista) : leerPublicado(docId, bloque);
    },
  });
}

export async function HEAD(req: NextRequest, ctx: { params: Params }) {
  return GET(req, ctx);
}
