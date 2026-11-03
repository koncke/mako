import 'server-only';

// =============================================================================
// instagram-buscar-apify — buscar perfiles por NOMBRE, sin que haga falta el @ (3/11/2026)
// =============================================================================
// Martín, 2/11/2026: «no necesariamente yo tenga que poner una arroba para que me empiecen a salir
// resultados. Si yo busco sin arroba, también debería empezar a salir resultados».
//
// ⚠️ POR QUÉ HACÍA FALTA OTRO ACTOR, y no era capricho: `apify~instagram-profile-scraper` —el que
// ya usábamos— lee UN perfil por su @ EXACTO. No busca. Escribir «leila» no le dice nada.
// `apify~instagram-scraper` sí acepta `search`, y es del propio Apify (463 mil usuarios, 4,7).
//
// ⚠️ EL COSTO, MEDIDO EN LA TIENDA DE APIFY EL 3/11/2026, no estimado:
//   · **US$ 1,50 por cada 1.000 resultados.**
//   · Con `RESULTADOS_POR_BUSQUEDA = 8`, una búsqueda sale **US$ 0,012** (poco más de un centavo).
//   · Con el tope diario que ya existe (`APIFY_TOPE_POR_DIA = 40`), el PEOR caso de un negocio es
//     **US$ 0,48 por día**. Martín aprobó el gasto pidiendo que midiéramos y se lo dijéramos.
//
// ⚠️ Y SIGUE SIN LLAMARSE EN CADA TECLA: la pantalla espera 500 ms y pide 3 letras
// (`lib/instagram-buscar.ts`). Con una llamada por tecla, «leilahormozi» son trece búsquedas y dos
// altas agotan el día del negocio.
// =============================================================================

import { APIFY_TOPE_USD } from './instagram-perfil';
import type { PerfilIg } from './instagram-buscar';

/** El actor que SÍ busca. El otro (`instagram-profile-scraper`) sólo lee por @ exacto. */
export const APIFY_ACTOR_BUSQUEDA = 'apify~instagram-scraper';
/** Cuántos candidatos se piden. Es una lista para elegir, no un listado para scrollear. */
export const RESULTADOS_POR_BUSQUEDA = 8;
/** US$ por cada 1.000 resultados, leído de la tienda el 3/11/2026. */
export const USD_POR_MIL = 1.5;
/** Lo que sale UNA búsqueda, para poder decirlo sin volver a calcularlo. */
export const USD_POR_BUSQUEDA = (USD_POR_MIL / 1000) * RESULTADOS_POR_BUSQUEDA;

const TOPE_MS = 20_000;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Los perfiles que se parecen a `texto`. Lista vacía si no hay con qué buscar o si no encontró:
 * **nunca tira**, porque esto corre mientras alguien escribe y un error acá no puede frenar el alta.
 *
 * ⚠️ NO SE INVENTA UN RESULTADO. Si el actor devuelve algo sin `username`, se descarta: una fila sin
 * usuario no se puede elegir y lo único que hace es ensuciar la lista.
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
    const cuerpo: unknown = await r.json().catch(() => null);
    if (!Array.isArray(cuerpo)) return [];
    const vistos = new Set<string>();
    const perfiles: PerfilIg[] = [];
    for (const it of cuerpo) {
      const o = (it ?? {}) as Record<string, unknown>;
      const usuario = str(o.username).toLowerCase();
      if (!usuario || vistos.has(usuario)) continue;
      vistos.add(usuario);
      perfiles.push({
        usuario,
        nombre: str(o.fullName) || str(o.name) || null,
        // ⚠️ La foto es una URL del CDN de Meta que VENCE: sirve para la lista y NO se guarda.
        foto: str(o.profilePicUrl) || str(o.profilePicUrlHD) || null,
      });
      if (perfiles.length >= RESULTADOS_POR_BUSQUEDA) break;
    }
    return perfiles;
  } catch (e) {
    console.error(`[instagram-buscar-apify] buscando «${q}»: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}
