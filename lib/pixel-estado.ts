// =============================================================================
// ¿Hay que pedirle a este negocio que repegue el Pixel? — por página, y mirando la página
// =============================================================================
// Lo leen el aviso fijo de la esquina (`/api/integraciones/landing/version`) y el chip
// del modal del Pixel (`app/integraciones/page.tsx`). Antes cada uno decidía con el
// setting `landing.snippet_version`, que es del WORKSPACE y lo escribe el ÚLTIMO evento
// que llega, venga de la página que venga. Dos fallas medidas el 06/10/2026:
//   · con la landing ya republicada en la v22, el aviso seguía hasta que entrara una
//     visita nueva («Ya publiqué y sigue apareciendo que falta publicar el pixel»);
//   · con dos páginas en versiones distintas, se prendía y se apagaba según qué página
//     recibió la última visita (revisión adversarial del mismo día).
//
// La decisión es pura y tiene test (`veredictoPixel` en lib/pixel-aviso.ts). Acá sólo
// se juntan los datos: el setting del negocio, el mapa por página que escribe el beacon,
// las páginas declaradas, y —sólo para las que las visitas dan por viejas— lo que la
// página SIRVE hoy.
// =============================================================================
import 'server-only';
import { getSetting } from './settings';
import { SNIPPET_VERSION, SNIPPET_VERSION_KEY } from './landing-token';
import { CONFIG_KEY, parsearConfig, urlsDe } from './landing-config';
import { PAGINAS_KEY, parsearPaginas } from './landing-paginas';
import { versionServida } from './pixel-servido';
import {
  VERSIONES_POR_PAGINA_KEY, PIXEL_MINIMO_AVISO, clavePagina, paraMirar, parsearMapaVersiones, veredictoPixel,
} from './pixel-aviso';

/** Cuántas páginas se miran como mucho: cada una que dé «vieja» es un pedido HTTP. */
const TOPE_PAGINAS = 8;

/**
 * Las páginas que el negocio declaró. El formato nuevo (`landing.config`) gana; el
 * viejo (`landing.paginas`) sólo si no hay ninguna en el nuevo — la misma regla que usa
 * el vigilante de tracking.
 */
export async function paginasDeclaradas(): Promise<string[]> {
  const nuevo = urlsDe(parsearConfig(await getSetting(CONFIG_KEY)));
  if (nuevo.length) return nuevo;
  return parsearPaginas(await getSetting(PAGINAS_KEY));
}

export async function estadoPixel(opts: { minimo?: number } = {}) {
  const minimo = opts.minimo ?? PIXEL_MINIMO_AVISO;
  const [guardada, mapaCrudo, paginas] = await Promise.all([
    getSetting(SNIPPET_VERSION_KEY),
    getSetting(VERSIONES_POR_PAGINA_KEY),
    paginasDeclaradas(),
  ]);
  const base = { guardada, mapa: parsearMapaVersiones(mapaCrudo), paginas: paginas.slice(0, TOPE_PAGINAS), minimo };
  const servidas: Record<string, number | null> = {};
  await Promise.all(paraMirar(base).map(async (url) => {
    const k = clavePagina(url);
    // `actual`: una página con la línea del cargador (lib/pixel-cargador.ts) sirve siempre
    // la versión de hoy, así que se lee como al día aunque sus visitas digan otra cosa.
    if (k) servidas[k] = await versionServida(url, { minimo, actual: SNIPPET_VERSION });
  }));
  return veredictoPixel({ ...base, servidas });
}
