// =============================================================================
// landing-funnel — a que EMBUDO (producto) entran los leads de una landing
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
import { CONFIG_KEY, funnelIdDeLanding, parsearConfig } from './landing-config';

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
 * A que embudo entra un lead que llego por ESTA pagina.
 *
 * `null` = el del negocio, que es donde caen hoy TODOS los leads de landing. Son
 * tres caminos a `null` y los tres son correctos:
 *   · la pagina no tiene producto asignado (el caso de todos los clientes de hoy);
 *   · el embudo asignado ya no existe o se archivo;
 *   · no se pudo leer la configuracion.
 *
 * ⚠️ El `ws` se pinnea con `runWithWorkspace` y es la PRIMERA linea del cuerpo:
 * `getSetting` resuelve el workspace del request (cookies) y esta ruta no tiene
 * sesion — sin pinnear, leeria la configuracion del inquilino del contexto.
 */
export async function funnelDeLanding(ws: number, pagina: string | null): Promise<number | null> {
  if (!pagina) return null;
  try {
    return await runWithWorkspace(ws, async () => {
      const id = funnelIdDeLanding(parsearConfig(await getSetting(CONFIG_KEY)), pagina);
      if (id == null) return null;
      // ⚠️ SE VALIDA CONTRA LA MISMA LISTA QUE OFRECE LA PANTALLA. Un id que ya
      // no esta ahi —borrado, archivado, o de otro workspace si alguien edito el
      // setting— tiene que caer al del negocio y no romper el alta con una
      // violacion de clave ajena.
      const vivos = await productosAsignables();
      const elegido = vivos.find((f) => f.id === id) ?? null;
      if (!elegido) return null;
      // ⚠️ EL EMBUDO DEL NEGOCIO SE ESCRIBE COMO `null`, NUNCA CON SU ID. El
      // tablero por defecto pide sus leads con `.is('funnel_id', null)`
      // (`listLeadsDeFunnel(null)`, lib/leads.ts), asi que un lead nacido con el
      // ID del default DESAPARECE del unico tablero que el cliente mira — con el
      // producto correcto escrito en la fila y sin un solo error. Son dos formas
      // de decir lo mismo y solo una la encuentra el CRM.
      return elegido.esDefault ? null : id;
    });
  } catch (e) {
    console.error('[landing-funnel] no se pudo resolver el producto de la landing:', e instanceof Error ? e.message : e);
    return null;
  }
}
