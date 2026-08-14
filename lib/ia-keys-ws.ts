import 'server-only';

// =============================================================================
// ia-keys-ws — QUÉ cuentas de IA tiene cargadas ESTE workspace (una sola query)
// =============================================================================
// `lib/ia-keys.ts` dice qué nombres de clave EXISTEN (el catálogo, hasta MAX_KEYS
// por proveedor). Esto dice cuáles están CARGADAS, que es otra pregunta y solo la
// puede contestar la base.
//
// Vive en su propio módulo por eso: `ia-keys` NO tiene `server-only` a propósito
// —llega al bundle del cliente vía metodo-catalogo— así que no puede consultar nada.
//
// ⚠️ POR QUÉ EXISTE. Al subir MAX_KEYS de 3 a 10, los dos lugares que resolvían las
// cuentas con un `credWs` POR SLOT pasaban de 3 SELECT a 10 por proveedor: hasta 50
// por generación en la cascada y otros 50 en cada pintada del gauge de cuota, casi
// todos para descubrir que la key no existe. Una query por workspace los reemplaza.

import { cache } from 'react';
import { getSupabaseServer } from './supabase';
import { clavesDe } from './ia-keys';
import { OWNER_WS, getWorkspaceActual } from './workspace';

/**
 * Los nombres de clave que tienen fila en `credenciales` para un workspace.
 *
 * ⚠️ `cache` de React (dedupe por REQUEST), NUNCA `unstable_cache`: ese es
 * cross-request, y cachear qué credenciales tiene cada inquilino es una fuga
 * cross-tenant esperando a pasar. El `ws` va como ARGUMENTO —y no se resuelve
 * adentro— justamente para que sea parte de la clave del cache.
 */
const clavesEnBase = cache(async (ws: number): Promise<Set<string>> => {
  try {
    const { data, error } = await getSupabaseServer()
      .from('credenciales')
      .select('clave')
      .eq('workspace_id', ws);
    if (error) throw new Error(error.message);
    return new Set((data ?? []).map((r) => r.clave as string));
  } catch (e) {
    // Degradar a «no sé» y NO a «no tiene»: quien llama vuelve a la lista completa
    // del catálogo y resuelve con credWs, que es más lento pero correcto.
    console.warn(`[ia-keys-ws] no pude listar las claves del ws ${ws}: ${e instanceof Error ? e.message : String(e)}`);
    return new Set();
  }
});

/**
 * Las claves de `prov` que este workspace TIENE cargadas, en orden de slot.
 *
 * Son CANDIDATAS: que exista la fila no prueba que se pueda descifrar ni que el
 * valor sirva. Quien las usa igual resuelve con `credWs`, que es el único que
 * decide — esto solo evita preguntar por las 10 cuando hay 2.
 *
 * Devolver vacío significa «no tiene ninguna cargada», que NO es lo mismo que
 * «este proveedor no admite varias cuentas»: eso lo contesta `clavesDe`, que
 * devuelve `[]` para anthropic y openai. Los dos casos dan `[]` y se distinguen
 * preguntando primero por el catálogo.
 */
export async function clavesCargadas(prov: string, ws?: number): Promise<string[]> {
  const delCatalogo = clavesDe(prov);
  if (!delCatalogo.length) return [];
  const w = ws ?? (await getWorkspaceActual()) ?? OWNER_WS;
  const enBase = await clavesEnBase(w);
  // Si la lectura falló, `enBase` viene vacío: caemos a la lista entera del
  // catálogo para no dejar al workspace sin IA por un error de red.
  if (!enBase.size) return delCatalogo;
  return delCatalogo.filter((c) => enBase.has(c));
}
