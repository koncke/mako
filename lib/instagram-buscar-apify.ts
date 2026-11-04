import 'server-only';

// =============================================================================
// instagram-buscar-apify — buscar perfiles por NOMBRE, sin que haga falta el @ (3/11/2026)
// =============================================================================
// Martín, 2/11/2026: «no necesariamente yo tenga que poner una arroba para que me empiecen a salir
// resultados. Si yo busco sin arroba, también debería empezar a salir resultados».
//
// ⚠️ POR QUÉ HACÍA FALTA OTRO ACTOR: `apify~instagram-profile-scraper` —el que ya usábamos— lee UN
// perfil por su @ EXACTO. No busca. Escribir «leila» no le dice nada. `apify~instagram-scraper` sí
// acepta `search`, y es del propio Apify.
//
// ⚠️ EL COSTO, MEDIDO EN LA TIENDA el 3/11/2026 y no estimado: **US$1,50 por cada 1.000
// resultados**. Con 8 candidatos por búsqueda son **US$0,012**, y con el tope diario que ya existía
// (`APIFY_TOPE_POR_DIA = 40`) el peor caso de un negocio es **US$0,48 por día**. Martín aprobó el
// gasto pidiendo que lo midiéramos y se lo dijéramos.
//
// ⚠️ PROBADO CONTRA EL ACTOR DE VERDAD (ws 9, «leila hormozi», 3/11/2026): HTTP 201 en 15 s, 7
// candidatos. **Sólo 1 traía `username`**; los otros 6 venían con `error: 'no_items'` y su @ en
// `url`. Cómo se leen está en `./instagram-buscar-apify-reglas.ts`, que se puede ejecutar en un
// test — acá sólo vive la red.
//
// ⚠️ Y SIGUE SIN LLAMARSE EN CADA TECLA: la pantalla espera 500 ms y pide 3 letras.
// =============================================================================

import { APIFY_TOPE_USD } from './instagram-perfil';
import type { PerfilIg } from './instagram-buscar';
import { APIFY_ACTOR_BUSQUEDA, RESULTADOS_POR_BUSQUEDA, perfilesDeLaRespuesta, str } from './instagram-buscar-apify-reglas';

export { APIFY_ACTOR_BUSQUEDA, RESULTADOS_POR_BUSQUEDA };
export { USD_POR_BUSQUEDA, USD_POR_MIL } from './instagram-buscar-apify-reglas';

/** Lo que tarda el actor: medido en 15 s para una búsqueda de 7 resultados. */
const TOPE_MS = 45_000;

/**
 * Los perfiles que se parecen a `texto`. Lista vacía si no hay con qué buscar o si no encontró:
 * **nunca tira**, porque esto corre mientras alguien escribe y un error acá no puede frenar el alta.
 */
export async function buscarPerfilesApify(texto: string, token: string): Promise<PerfilIg[]> {
  const q = str(texto);
  if (q.length < 3 || !token) return [];
  try {
    const params = new URLSearchParams({
      maxItems: String(RESULTADOS_POR_BUSQUEDA),
      // El mismo tope por corrida que la lectura por @: un actor que se desboque no puede gastar más.
      maxTotalChargeUsd: String(APIFY_TOPE_USD),
    });
    const r = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_BUSQUEDA}/run-sync-get-dataset-items?${params}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        search: q,
        // `user` es lo que convierte esto en una BÚSQUEDA DE PERFILES. Sin esto devuelve
        // publicaciones, que no es lo que la lista necesita.
        searchType: 'user',
        searchLimit: RESULTADOS_POR_BUSQUEDA,
        resultsLimit: RESULTADOS_POR_BUSQUEDA,
      }),
      signal: AbortSignal.timeout(TOPE_MS),
      cache: 'no-store',
    });
    if (r.status < 200 || r.status >= 300) {
      console.error(`[instagram-buscar-apify] HTTP ${r.status} buscando «${q}»`);
      return [];
    }
    return perfilesDeLaRespuesta(await r.json().catch(() => null));
  } catch (e) {
    console.error(`[instagram-buscar-apify] buscando «${q}»: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}
