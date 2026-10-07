import 'server-only';

// =============================================================================
// curso-estilo-datos — leer y guardar cómo se ve el curso de un producto (mig 0214)
// =============================================================================
// Las reglas (qué claves hay, qué vale cada una) viven en lib/curso-estilo.ts, sin `server-only`.
// Acá sólo se lee y se escribe, siempre por `getTenantDb` (la tabla está en TENANT_TABLES).

import { getTenantDb } from './workspace';
import { armarEstilo, claveDe, estiloVacio, sanearAjuste, type Ajuste, type EstiloCurso } from './curso-estilo';

/**
 * El estilo de cada producto pedido (los que no tienen ninguna fila, con el default).
 *
 * ⚠️ SI LA LECTURA FALLA, VUELVE EL DEFAULT, y es a propósito: esto sólo sirve para DIBUJAR (un
 *    color, unas tapas, un título) y nada decide con él. Un curso con el lima de siempre es un
 *    curso que se ve; una página caída por una lectura cosmética, no (AGENTS.md, «una lectura
 *    que cae al DEFAULT sirve para dibujar, nunca para decidir»). Se avisa en el log.
 */
export async function estilosDeProductos(ids: readonly number[]): Promise<Map<number, EstiloCurso>> {
  return (await estilosLeidos(ids)).estilos;
}

/**
 * Lo mismo, diciendo si la lectura FALLÓ. Lo usa la tab del equipo: ahí no alcanza con dibujar el
 * de siempre — se avisa y no se ofrece cambiar el estilo, porque se editaría encima de algo que no
 * se ve (revisión del 07/10/2026). El alumno no necesita saberlo.
 */
export async function estilosLeidos(ids: readonly number[]): Promise<{ estilos: Map<number, EstiloCurso>; error: string | null }> {
  const out = new Map<number, EstiloCurso>(ids.map((id) => [id, estiloVacio()]));
  if (!ids.length) return { estilos: out, error: null };
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('curso_estilo').select('producto_id, clave, valor').in('producto_id', [...ids]);
    if (error) throw new Error(error.message);
    const por = new Map<number, Array<{ clave: unknown; valor: unknown }>>();
    for (const f of (data ?? []) as Array<{ producto_id: number; clave: string; valor: string }>) {
      const id = Number(f.producto_id);
      if (!por.has(id)) por.set(id, []);
      por.get(id)!.push(f);
    }
    for (const [id, filas] of por) out.set(id, armarEstilo(filas));
    return { estilos: out, error: null };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.warn('[curso-estilo] no pude leer el estilo; se dibuja el de siempre:', m);
    return { estilos: out, error: m || 'Error de lectura.' };
  }
}

/**
 * Guarda UN ajuste. Devuelve lo que quedó (`null` = volvió al default y la fila se borró).
 * Tira si la base no contesta: quien llama lo dice en la pantalla y deshace.
 *
 * ⚠️ UN UPSERT DE UNA CLAVE, nunca la fila entera del estilo: dos personas cambiando dos cosas a
 *    la vez no se pisan (ver la cabecera de la mig 0214).
 */
export async function guardarAjusteEstilo(productoId: number, ajuste: Ajuste, valor: unknown, autor: string | null): Promise<string | null> {
  const v = sanearAjuste(ajuste, valor);
  const clave = claveDe(ajuste);
  const db = await getTenantDb();
  if (v == null) {
    const { error } = await db.from('curso_estilo').delete().eq('producto_id', productoId).eq('clave', clave);
    if (error) throw new Error(`No se pudo guardar: ${error.message}`);
    return null;
  }
  const { error } = await db.from('curso_estilo').upsert(
    { producto_id: productoId, clave, valor: v, updated_at: new Date().toISOString(), updated_by: autor },
    { onConflict: 'workspace_id,producto_id,clave' },
  );
  if (error) throw new Error(`No se pudo guardar: ${error.message}`);
  return v;
}
