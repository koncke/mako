// =============================================================================
// landing-funnel — a que EMBUDOS (productos) entran los leads de una landing
// =============================================================================
// Pedido de Martin el 04/10/2026, textual: «el pixel deberiamos poder ASIGNAR a
// un PRODUCTO. Con la implementacion que hicimos, para que lleguen los leads a
// ese CRM y no a otro».
//
// Vive en UN modulo porque son DOS consumidores con la misma pregunta: la ruta
// abierta que ingesta el opt-in (`app/api/track/optin/route.ts`) y la pantalla
// que ofrece la asignacion (`app/integraciones/landing-config-actions.ts`). Con
// un lector por lado, el dia que uno valide distinto la pantalla ofrece un
// producto al que el lead no va a llegar — y eso no da error, da un lead en el
// tablero equivocado.
//
// ⚠️ DE DONDE CUELGA LA ASIGNACION: DE LA PAGINA, no del token.
// `getOrCreateLandingToken(ws)` acuna UN token por workspace y determinista
// (`tokenDeterminista` es un HMAC de `landing:<ws>`, guardado en el unico setting
// `landing_token`), asi que no hay un segundo token que asignar: colgar el
// producto de ahi seria afirmar que todas las landings del cliente venden lo
// mismo. La pagina si distingue una de otra, y `landing.config` ya es una tabla
// POR PAGINA desde que `clarityProjectId` necesito exactamente lo mismo — un
// proyecto de Clarity es de un sitio, y un producto es de una landing.
//
// ⚠️ Y LA RESOLUCION ES TOLERANTE, como `umbralesDelWorkspace` (lib/crm-auto.ts):
// sin dato, el default de siempre. Eso no es prolijidad — `leads.funnel_id`
// referencia `funnels(id)`, asi que un id de un embudo borrado haria FALLAR el
// insert, y en esta ruta un alta que falla cae a propuesta: el lead que entraba
// solo pasaria a esperar un click que nadie sabe que hay que dar.
// =============================================================================

import 'server-only';
import { getSetting } from './settings';
import { runWithWorkspace } from './workspace';
import { listarFunnels } from './funnels';
import { CONFIG_KEY, funnelIdsDeLanding, parsearConfig } from './landing-config';

/**
 * Los embudos que se pueden asignar a una landing, con el nombre que la persona
 * reconoce.
 *
 * El rotulo es el PRODUCTO y no el nombre del embudo: «Funnel principal» lo puso
 * la migracion 0170 y es el mismo en todos los workspaces, asi que no distingue
 * nada y encima obliga a pensar en la estructura en vez de en lo que se vende.
 * Cuando el embudo todavia no tiene producto, se cae a su nombre, que es lo que
 * hay. (Es la misma regla que ya aplica el desplegable del CRM.)
 *
 * Solo los ACTIVOS: `listarFunnels` filtra por `activo`, y ofrecer uno archivado
 * seria ofrecer un tablero que la persona no ve.
 */
export type ProductoAsignable = { id: number; nombre: string; esDefault: boolean };

export async function productosAsignables(): Promise<ProductoAsignable[]> {
  const funnels = await listarFunnels().catch(() => []);
  return funnels.map((f) => ({
    id: f.id,
    nombre: f.producto ?? f.nombre,
    esDefault: f.esDefault,
  }));
}

/**
 * A que embudos entra un lead que llego por ESTA pagina.
 *
 * ⚠️ DEVUELVE UNA LISTA Y NUNCA ESTA VACIA: quien llama crea UNA FICHA POR
 * ELEMENTO. `[null]` es «solo el del negocio», que es donde caen hoy TODOS los
 * leads de landing — y son cuatro caminos a `[null]`, los cuatro correctos:
 *   · la pagina no tiene productos asignados (el caso de todos los clientes de hoy);
 *   · los embudos asignados ya no existen o se archivaron;
 *   · no se pudo leer la configuracion;
 *   · no habia pagina.
 *
 * Que nunca este vacia es parte del contrato, no una comodidad: una lista vacia
 * haria que un opt-in no cree NINGUN lead, y perder a la persona es infinitamente
 * peor que ponerla en el embudo equivocado. Es la misma regla que la tolerancia de
 * la cabecera, llevada a la forma del retorno.
 *
 * ⚠️ El `ws` se pinnea con `runWithWorkspace` y es la PRIMERA linea del cuerpo:
 * `getSetting` resuelve el workspace del request (cookies) y esta ruta no tiene
 * sesion — sin pinnear, leeria la configuracion del inquilino del contexto.
 */
export async function funnelsDeLanding(ws: number, pagina: string | null): Promise<Array<number | null>> {
  if (!pagina) return [null];
  try {
    return await runWithWorkspace(ws, async () => {
      const ids = funnelIdsDeLanding(parsearConfig(await getSetting(CONFIG_KEY)), pagina);
      if (!ids.length) return [null];
      // ⚠️ SE VALIDA CONTRA LA MISMA LISTA QUE OFRECE LA PANTALLA. Un id que ya
      // no esta ahi —borrado, archivado, o de otro workspace si alguien edito el
      // setting— tiene que caer al del negocio y no romper el alta con una
      // violacion de clave ajena.
      const vivos = await productosAsignables();
      const out: Array<number | null> = [];
      for (const id of ids) {
        const elegido = vivos.find((f) => f.id === id) ?? null;
        if (!elegido) continue;
        // ⚠️ EL EMBUDO DEL NEGOCIO SE ESCRIBE COMO `null`, NUNCA CON SU ID. El
        // tablero por defecto pide sus leads con `.is('funnel_id', null)`
        // (`listLeadsDeFunnel(null)`, lib/leads.ts), asi que un lead nacido con el
        // ID del default DESAPARECE del unico tablero que el cliente mira — con el
        // producto correcto escrito en la fila y sin un solo error. Son dos formas
        // de decir lo mismo y solo una la encuentra el CRM.
        const valor = elegido.esDefault ? null : id;
        // Sin repetidos: con el default elegido DOS veces (su id y, mañana, otra
        // forma de nombrarlo) saldrian dos fichas identicas en el mismo tablero.
        if (!out.includes(valor)) out.push(valor);
      }
      // Todos los asignados estaban muertos: no es «sin producto» por eleccion de
      // nadie, pero el lead tiene que entrar igual.
      return out.length ? out : [null];
    });
  } catch (e) {
    console.error('[landing-funnel] no se pudo resolver el producto de la landing:', e instanceof Error ? e.message : e);
    return [null];
  }
}

/**
 * El producto PRINCIPAL de una pagina: el primero de los asignados.
 *
 * Existe para lo que necesita UNO y no varios —hoy el lead PRUEBA del Pixel
 * (app/integraciones/prueba-lead-actions.ts), que es una fila de diagnostico y no
 * un lead que haya que repartir—. Va acá, al lado del plural, para que el dia que
 * cambie la regla de cual es «el principal» cambie en un solo lugar.
 */
export async function funnelPrincipalDeLanding(ws: number, pagina: string | null): Promise<number | null> {
  return (await funnelsDeLanding(ws, pagina))[0] ?? null;
}
