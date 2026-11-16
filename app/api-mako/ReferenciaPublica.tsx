// =============================================================================
// /api-mako SIN sesión: la referencia PÚBLICA de la API (16/11/2026)
// =============================================================================
// La MISMA pantalla de la tab (ApiMako + Docs, con el aspecto de docs.github.com/en/rest, que se lee sin cuenta), con la barra y
// el pie del sitio, y SÓLO la Documentación: lo que cualquier negocio puede pedir (`VISTA_PUBLICA`: sin workspace, sin lo del
// workspace principal ni lo de la plataforma), sin Tokens ni Registro, sin «Probar con tus datos» y sin las descargas, que son
// acciones de un workspace. La elige app/api-mako/page.tsx cuando no hay sesión; vive aparte porque un page.tsx no puede
// exportar otra cosa que lo de una página, y así la dibujan el test (tests/api-mako-publica.test.ts) y las capturas.
// Server component: el índice se arma acá (datos.ts no viaja al navegador).
// =============================================================================

import { APP_BASE_URL } from '@/lib/app-url';
import { TOPE_CUERPO_BYTES, TOPE_POR_MINUTO_IP, TOPE_POR_MINUTO_WS, VERSION_API } from '@/lib/api-mako/version';
import { BarraGlobal, PieGlobal } from '@/app/vsl/_sitio/Barra';
import { VISTA_PUBLICA, indiceDocs, paginaDocs, type AreaDocs } from './datos';
import { ApiMako } from './ApiMako';
import { Docs } from './Docs';
import type { DatosArticulos } from './Articulos';
import { esArticulo } from './articulos-meta';

/** Una lectura sin parámetros obligatorios, para el ejemplo del inicio rápido. */
export function ejemploDe(indice: AreaDocs[]): DatosArticulos['ejemplo'] {
  for (const a of indice) for (const r of a.recursos) for (const e of r.endpoints) {
    if (e.metodo === 'GET' && !e.ruta.includes('{')) return { metodo: e.metodo, ruta: e.ruta, titulo: e.titulo };
  }
  return null;
}

/** Lo que sólo trae la referencia pública: la barra fija del sitio (77 px; 57 en el teléfono) va arriba de la barra lateral de
 *  la documentación y de la columna de ejemplos, que se pegan al bajar, y de lo que abre un #ancla. */
export const CSS_PUBLICA = `
.gh-publica .gh-docs-sidebar{top:77px;max-height:calc(100vh - 77px)}
.gh-publica .gh-endpoint-der{top:93px}
.gh-publica .gh-endpoint,.gh-publica .gh-articulo [id]{scroll-margin-top:93px}
@media (max-width:1023px){.gh-publica .gh-docs-sidebar{top:57px;max-height:calc(100vh - 57px)}.gh-publica .gh-endpoint-der{top:73px}.gh-publica .gh-endpoint,.gh-publica .gh-articulo [id]{scroll-margin-top:73px}}
`;

export function ReferenciaPublica({ sp }: { sp: { area?: string; recurso?: string; art?: string } }) {
  const indice = indiceDocs(VISTA_PUBLICA);
  const datos: DatosArticulos = {
    base: APP_BASE_URL.replace(/\/+$/, ''),
    version: VERSION_API,
    limites: { ws: TOPE_POR_MINUTO_WS, ip: TOPE_POR_MINUTO_IP },
    topeCuerpoKb: Math.round(TOPE_CUERPO_BYTES / 1024),
    indice,
    ejemplo: ejemploDe(indice),
    publica: true,
  };
  const pagina = sp.area && sp.recurso ? paginaDocs(indice, sp.area, sp.recurso, datos.base, { probar: false }) : null;
  return (
    <div className="gh-publica">
      <style dangerouslySetInnerHTML={{ __html: CSS_PUBLICA }} />
      <BarraGlobal claro />
      <ApiMako tab="docs" tokens={0} publica>
        <Docs datos={datos} pagina={pagina} area={sp.area ?? null} recurso={sp.recurso ?? null} art={esArticulo(sp.art) ? sp.art : null} />
      </ApiMako>
      <PieGlobal claro />
    </div>
  );
}
