// =============================================================================
// GET /api/landing-generator/diagnostico/pagina?url=… — una landing de AFUERA, aislada, para el diagnóstico
// =============================================================================
// Tanda 2, punto 8 (docs/diseno-editor-landing.md, T5): «si traigo una landing de afuera, tiene que
// funcionar el paso anterior, se tiene que previsualizar y comenzar con los "comentarios"». El panel del
// diagnóstico la muestra en un `<iframe sandbox="allow-scripts">` con ESTE documento: el HTML de la página
// bajado con la guarda anti-SSRF de siempre (`htmlDePagina`, lib/landing-fetch.ts: IP clavada,
// redirecciones revalidadas, tope de tamaño y de tiempo), limpio de rastreadores y del Pixel de MaKo, con
// su `<base>` y con el script que ubica las citas y le contesta al panel por `postMessage`
// (`documentoDiagnostico`, lib/editor-landing/diagnostico.ts, con test).
//
// AISLADO COMO EL «HTML PERSONALIZADO» (/l/html del paquete HTMLLIBRE): `Content-Security-Policy:
// sandbox …` vuelve el documento un ORIGEN OPACO (no ve la sesión de hola-mako.com), y el iframe además
// lleva su atributo `sandbox`. Dos guardas que no dependen de la cabecera:
//   · SÓLO SE SIRVE A UN IFRAME (`Sec-Fetch-Dest: iframe`): abierto como pestaña, sin la política, el HTML
//     de afuera correría con el origen y la sesión de MaKo;
//   · detrás de la MISMA puerta que el resto de /api/landing-generator (admin + la tab en su capa): no es
//     un proxy abierto para bajar cualquier página desde nuestro server.
// ⚠️ LAS CABECERAS QUE IMPORTAN LAS TIENE QUE PONER next.config.ts (`CABECERAS_HTML_LIBRE` en esta ruta,
//    en un bloque DESPUÉS del global): Next descarta el header de una ruta si next.config ya puso el mismo,
//    y el global manda `X-Frame-Options: DENY` y `frame-ancestors 'none'`. Sin ese bloque el iframe no
//    carga y el panel lo dice («No pude mostrar la página aquí») con la lista de comentarios igual.
//
// LA VENTANA DE LECTURA (tanda 6, 14/10/2026). Pedido de Martín: «El mimso error que nos saltaba con
// Mauricio "No pude leer el texto de esa página.". Soluciona eso...», y su decisión: «si detecta que tenes
// el pixel instalado, que lo haga desde allí y sino desde la ventana emergente». Con `?lector=<id>` esta
// misma ruta la abre una VENTANA (no un iframe) y decide el camino con UNA bajada: la página real con el
// Pixel (303 con `?mako_leer=<id>`) o la página aislada con el lector (`responderPaginaLector`,
// lib/editor-landing/lector-pagina.ts, con test). La misma puerta; en vez de `Sec-Fetch-Dest: iframe`, la
// guarda es que la navegación la inicie una página de MaKo (`pedidoDeLector`), y la política `sandbox`
// la pone igual next.config.ts (el bloque de esta ruta no mira el query).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { htmlDePagina } from '@/lib/landing-fetch';
import { CABECERAS_PAGINA_DIAGNOSTICO, responderPaginaDiagnostico } from '@/lib/editor-landing/diagnostico';
import { PARAM_CAMINO, PARAM_LECTOR, responderPaginaLector } from '@/lib/editor-landing/lector-pagina';
import { bajarModulo } from '@/lib/editor-landing/lector-server';
import { SNIPPET_VERSION } from '@/lib/landing-token';

export const dynamic = 'force-dynamic';
// Bajar la página tiene su propio plazo (lib/landing-fetch.ts); esto es el techo de la ruta.
export const maxDuration = 60;

const texto = (status: number, t: string) =>
  new Response(t, { status, headers: { ...CABECERAS_PAGINA_DIAGNOSTICO, 'Content-Type': 'text/plain; charset=utf-8' } });

export async function GET(req: NextRequest) {
  const rol = await getRolWsEfectivo();
  if (rol == null) return texto(401, 'no autenticado');
  if (rol !== 'admin') return texto(403, 'Sólo el admin de la cuenta');
  if (!tabEnCapa('landing-writer', await getCapaActual())) return texto(404, 'No existe');
  const q = req.nextUrl.searchParams;
  if (q.has(PARAM_LECTOR)) {
    return responderPaginaLector(req, { url: q.get('url'), id: q.get(PARAM_LECTOR), camino: q.get(PARAM_CAMINO) }, {
      // TAL CUAL la pegó la persona (con su www y su query): hay hosts que sólo existen así.
      bajar: (url) => htmlDePagina(url, { talCual: true }),
      bajarModulo,
      actual: SNIPPET_VERSION,
      origen: req.nextUrl.origin,
    });
  }
  return responderPaginaDiagnostico(req, q.get('url'), { bajar: htmlDePagina });
}
