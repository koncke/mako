// =============================================================================
// landing-config-leer — las landings del workspace, leídas UNA vez y por un lado
// =============================================================================
// Lo leen dos: el server component de /integraciones (para que el Pixel se pinte
// con sus páginas y sus productos en el PRIMER frame) y las server actions que
// guardan (para tener la lista contra la que escriben). Con un lector por lado, el
// día que uno migre distinto la pantalla ofrece una landing que el otro no
// reconoce — es la misma razón por la que `lib/landing-funnel.ts` existe.
//
// ⚠️ EXISTE PORQUE EL PASO 2 TARDABA, y no por prolijidad. Medido el 06/10/2026:
// abrir el Pixel disparaba TRES server actions en serie antes de pintar la primera
// casilla de producto —`getLandingsAction` del paso 1, y `getProductosAction` +
// `getLandingsAction` otra vez en el `Promise.all` del paso 2, que NO corren en
// paralelo porque Next despacha las actions de a una—, o sea 11 a 13 idas y
// vueltas a la base para traer dos filas. El dueño: «tardó mucho en encontrar mis
// productos… si son 2 literalmente». Leyéndolas en el server, son cero.
//
// ⚠️ SIN `requireRolWs` ADENTRO, a propósito: el que llama ya pagó el suyo
// (`page.tsx` en su primera línea, cada action en la suya). Ponerlo acá lo haría
// pagar dos veces en cada guardado.
// =============================================================================

import 'server-only';
import { getSetting } from './settings';
import { CONFIG_KEY, parsearConfig, type LandingConfig } from './landing-config';
import { PAGINAS_KEY, parsearPaginas } from './landing-paginas';

export async function landingsDelWorkspace(): Promise<LandingConfig[]> {
  const nuevo = parsearConfig(await getSetting(CONFIG_KEY));
  if (nuevo.length) return nuevo;
  // ⚠️ MIGRACIÓN PEREZOSA. Mientras nadie haya guardado en el formato nuevo, se
  // leen las páginas viejas. Así el despliegue no deja a nadie con la lista
  // vacía, y la primera vez que toque algo queda migrado — sin un script que
  // haya que acordarse de correr, que es como se migran a medias las cosas.
  return parsearConfig(JSON.stringify(parsearPaginas(await getSetting(PAGINAS_KEY))));
}
