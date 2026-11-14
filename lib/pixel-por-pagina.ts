import 'server-only';
// =============================================================================
// ¿Por qué la tab Tracking de un lead no tiene nada? — la lectura (14/11/2026)
// =============================================================================
// Las reglas (qué página, qué ventana, qué se dice) están en lib/pixel-por-pagina-reglas.ts, con test. Acá se lee
// `landing_visits` del negocio (scopeado por `getTenantDb`). NUNCA TIRA: un error es «no se sabe» (null) y la ficha
// queda como siempre. Un cartel de «conéctalo» sobre algo conectado manda a desconectar lo que funciona.
// =============================================================================

import { getTenantDb } from './workspace';
import { landingsDelWorkspace } from './landing-config-leer';
import { idDelFunnelDefault } from './funnels';
import {
  desdeParaElPixel, entroSinPagina, FILAS_POR_PAGINA, paginasDelLead, pistaDePagina, sinPixelDe, veredictoDePagina,
  type LeadParaPixel, type SinTracking,
} from './pixel-por-pagina-reglas';

export async function sinTrackingDelLead(lead: LeadParaPixel): Promise<SinTracking | null> {
  try {
    const origen = entroSinPagina(lead);
    if (origen) return { como: 'sin-pagina', origen };
    const propia = !!lead.pagina_registro?.trim();
    const [configs, idDefault] = propia
      ? [[], null] as const
      : await Promise.all([landingsDelWorkspace(), lead.funnel_id == null ? idDelFunnelDefault() : Promise.resolve(null)]);
    const { urls, deEntrada } = paginasDelLead(lead, configs, idDefault);
    if (!urls.length) return null;
    const desde = desdeParaElPixel(lead.created_at, Date.now());
    const db = await getTenantDb();
    const veredictos = await Promise.all(urls.map(async (url) => {
      const pista = pistaDePagina(url);
      if (!pista) return { url, v: 'no-se' as const };
      // Las pruebas del Pixel cuentan: una prueba que llegó prueba que el código está pegado en esa página.
      const { data, error } = await db.from('landing_visits').select('landing_url')
        .gte('created_at', desde).ilike('landing_url', pista).limit(FILAS_POR_PAGINA);
      if (error) { console.error(`[pixel-por-pagina] ${url}: ${error.message}`); return { url, v: 'no-se' as const }; }
      return { url, v: veredictoDePagina(url, (data ?? []) as Array<{ landing_url: string | null }>) };
    }));
    return sinPixelDe(deEntrada, veredictos);
  } catch (e) {
    console.error('[pixel-por-pagina] no se pudo revisar la página del lead:', e instanceof Error ? e.message : e);
    return null;
  }
}
