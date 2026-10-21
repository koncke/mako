// =============================================================================
// ¿Quien mira opera MaKo? Y el cerebro que le toca: el de su negocio, o UNO con la construcción adentro (20/10/2026)
// =============================================================================
// Lo usan las tres puertas del grafo: la pantalla (app/second-brain/pagina.tsx), el teléfono (app/m/second-brain/mapa)
// y el grafo vivo (app/api/second-brain/cerebro). Vive acá y no en pagina.tsx porque la ruta no puede importar una
// página (trae hojas de estilo y componentes); pagina.tsx lo reexporta para los que ya lo importaban de ahí.
// ⚠️ Martín, 20/10/2026: «En ningún caso jamás los cerebros se deben dividir en 2». Quien opera recibe UN cerebro, ya
//    acomodado entero en el servidor (lib/cerebro-union-servidor.ts); ninguna pantalla vuelve a juntar dos.
// =============================================================================

import 'server-only';
import { getSesionAdmin } from './auth';
import { estaImpersonando, wsSuperAdmin } from './workspace';
import { puedeOperar } from './operaciones-reglas';
import { construccionDeMako } from './cerebro-construccion-datos';
import { cerebroUnido } from './cerebro-union-servidor';
import type { Cerebro } from './cerebro-modelo';

/**
 * ¿Quien mira opera MaKo? La guarda del Centro de Operaciones (app/admin/operaciones/datos.ts), tal cual.
 * ⚠️ MIRANDO A UN CLIENTE, NO (18/10/2026, Martín, punto 13: al terminar el onboarding del Cliente de Prueba «me saltaron
 * todos los chats míos del Ops Center, de SuperAdmin, eso está terriblemente mal»). El super admin que inspecciona ve lo
 * que ve el cliente: su Second Brain, nunca el Centro de la plataforma. tests/second-brain-mirando-cliente.test.ts.
 */
export async function quienOpera(): Promise<boolean> {
  try {
    if (await estaImpersonando()) return false;
    return puedeOperar(await getSesionAdmin(), await wsSuperAdmin());
  } catch { return false; }
}

/** El cerebro que se dibuja: el del negocio y, para quien opera, el MISMO con la construcción de MaKo colgada de su raíz.
 *  A los demás la construcción no se les arma ni se les manda. */
export async function cerebroQueSeDibuja(negocio: Cerebro, opera?: boolean): Promise<Cerebro<string>> {
  return (opera ?? await quienOpera()) ? cerebroUnido(negocio, construccionDeMako()) : negocio;
}
