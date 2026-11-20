import 'server-only';
// Lo de Pro que el reto abre una vez en la prueba: la lectura y la escritura (la regla, pura, en ./pro-del-reto.ts).
import { cambiarSettingSi, getSetting } from '../settings';
import { cambiarReto } from './cambiar';
import { getWorkspaceActual, runWithWorkspace } from '../workspace';
import { CLAVE_RETO, leerEstado } from './dias';
import { decidirProDelReto, queAbreElReto, type ProDelReto } from './pro-del-reto';

/**
 * ¿El reto le abre esta función de Pro? `usar`: la acción que la usa (anota el uso la primera vez); sin él, sólo pregunta.
 * `ws`: el negocio; sin él (undefined), el del pedido. Nunca tira: si algo no se puede leer, no abre (queda el candado de siempre).
 */
export async function abreElReto(f: ProDelReto, o: { ws?: number | null; usar: boolean }): Promise<boolean> {
  try {
    const ws = o.ws === undefined ? await getWorkspaceActual() : o.ws;
    if (ws == null) return false;
    return await runWithWorkspace(ws, async () => {
      const e = leerEstado(await getSetting(CLAVE_RETO));
      if (!e) return false;
      const { estadoDePrueba } = await import('../prueba-uso');
      const { abre, nuevo } = decidirProDelReto(e, f, { enPrueba: (await estadoDePrueba(ws)).enPrueba, ahora: Date.now() });
      if (abre && nuevo && o.usar) {
        // Con compare-and-set (lib/reto/cambiar.ts): no pisa lo que otro escribió en el medio; si ya lo anotó otro pedido, queda ése.
        await cambiarReto({ leer: () => getSetting(CLAVE_RETO), cas: (a, b) => cambiarSettingSi(CLAVE_RETO, a, b) }, (x) => ({ ...x, pro: { ...(x.pro ?? {}), [f]: x.pro?.[f] ?? nuevo } }));
        console.log(`[reto] la prueba usa ${f} una vez (ws ${ws}, de ${nuevo.desde} a ${nuevo.hasta}: su gasto, en los movimientos de MaKo Tokens)`);
      }
      return abre;
    });
  } catch { return false; }
}

/**
 * Lo que el reto le abre AHORA a la pantalla, SIN anotar ningún uso (20/11, R57-03): /api/auth/me lo manda como `proDelReto`
 * para que `useSoloPro` no ponga el candado de Essential antes de llamar al servidor. El uso lo anota la acción que usa la
 * función (`abreElReto` con `usar: true`). Nunca tira: si algo no se puede leer, nada (queda el candado de siempre).
 */
export async function loQueAbreElReto(ws?: number | null): Promise<ProDelReto[]> {
  try {
    const w = ws === undefined ? await getWorkspaceActual() : ws;
    if (w == null) return [];
    return await runWithWorkspace(w, async () => {
      const e = leerEstado(await getSetting(CLAVE_RETO));
      if (!e) return [];
      const { estadoDePrueba } = await import('../prueba-uso');
      return queAbreElReto(e, { enPrueba: (await estadoDePrueba(w)).enPrueba, ahora: Date.now() });
    });
  } catch { return []; }
}
