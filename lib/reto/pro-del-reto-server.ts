import 'server-only';
// Lo de Pro que el reto abre una vez en la prueba: la lectura y la escritura (la regla, pura, en ./pro-del-reto.ts).
import { getSetting, setSetting } from '../settings';
import { getWorkspaceActual, runWithWorkspace } from '../workspace';
import { CLAVE_RETO, leerEstado } from './dias';
import { decidirProDelReto, type ProDelReto } from './pro-del-reto';

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
        await setSetting(CLAVE_RETO, JSON.stringify({ ...e, pro: { ...(e.pro ?? {}), [f]: nuevo } }));
        console.log(`[reto] la prueba usa ${f} una vez (ws ${ws}, de ${nuevo.desde} a ${nuevo.hasta}: su gasto, en los movimientos de MaKo Tokens)`);
      }
      return abre;
    });
  } catch { return false; }
}
