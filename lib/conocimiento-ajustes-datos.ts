import 'server-only';

// =============================================================================
// conocimiento-ajustes-datos — leer y guardar lo que el super admin le cambió a un curso (mig 0221)
// =============================================================================
// Las reglas (qué se ajusta, qué vale cada cosa, cómo queda el curso) viven en
// lib/conocimiento-ajustes.ts, sin `server-only`. Acá sólo se lee y se escribe.
//
// ⚠️ LA TABLA ES DE LA PLATAFORMA (sin `workspace_id`, como `shares`): no pasa por `getTenantDb`, que
//    la dejaría pasar igual (no está en TENANT_TABLES) pero escondería que acá no hay inquilino.
// ⚠️ ESCRIBE SÓLO EL SUPER ADMIN, y se pregunta en la PRIMERA LÍNEA de cada escritura, no sólo en la
//    acción que la llama: una función de datos que escribe sin preguntar es una puerta para el próximo
//    que la importe desde otro lado (tests/conocimiento-ajustes.test.ts lo fija sobre este fuente).
//    `getSesionAdmin` mira el rol GLOBAL (`usuarios.rol`): un admin del workspace de un cliente no pasa.

import { getSesionAdmin } from './auth';
import { getSupabaseServer } from './supabase';
import { leerTodo, type ConsultaPaginada } from './supabase-paginado';
import { filaLeida, sanearValor, queValido, type Cambios, type FilaAjuste } from './conocimiento-ajustes';

const TABLA = 'conocimiento_ajustes';
const COLUMNAS = 'id, curso_slug, objeto, objeto_id, campo, valor';

/**
 * Las filas de esos cursos (o de TODOS, sin `slugs`), saneadas. ESTRICTA: si la base no contesta, TIRA.
 *
 * ⚠️ ESTRICTA PORQUE DECIDE: lo que se lee acá dice qué se OCULTA a quien abre un link compartido. Una
 *    lectura caída que devolviera «no hay ajustes» le mostraría a un tercero lo que el super admin
 *    escondió (AGENTS.md: «una lectura que cae al DEFAULT sirve para dibujar, nunca para decidir»).
 * ⚠️ PAGINADA (`leerTodo`): con un arrastre se escribe el orden de TODAS las clases de un módulo, y la
 *    tabla pasa las 1000 filas sin que nadie lo note — PostgREST corta ahí sin avisar.
 */
export async function leerAjustes(slugs?: readonly string[]): Promise<FilaAjuste[]> {
  if (slugs && slugs.length === 0) return [];
  const sb = getSupabaseServer();
  const filas = await leerTodo<Record<string, unknown>>(sb, TABLA, COLUMNAS, {
    orden: 'id',
    ...(slugs ? { filtros: (q: ConsultaPaginada) => q.in('curso_slug', [...slugs]) as ConsultaPaginada } : {}),
  });
  const out: FilaAjuste[] = [];
  for (const f of filas) {
    const ok = filaLeida(f);
    if (ok) out.push(ok);
  }
  return out;
}

/**
 * Lo mismo, diciendo si la lectura FALLÓ en vez de tirar. Lo usa la pantalla del super admin: ahí no
 * alcanza con dibujar el catálogo — se avisa y no se ofrece editar, porque se editaría encima de algo
 * que no se ve (la misma decisión que la tab Curso, lib/curso-estilo-datos.ts).
 */
export async function leerAjustesConError(slugs?: readonly string[]): Promise<{ filas: FilaAjuste[]; error: string | null }> {
  try {
    return { filas: await leerAjustes(slugs), error: null };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.warn('[conocimiento-ajustes] no pude leer los ajustes:', m);
    return { filas: [], error: m || 'Error de lectura.' };
  }
}

/**
 * El título de HOY de cada curso que tenga uno elegido (slug → título). Para NOMBRAR un link en el modal
 * de compartir y en el mail: es un rótulo, así que si la lectura falla vuelve vacío y se usa el del
 * catálogo — no decide nada.
 */
export async function titulosElegidos(): Promise<Map<string, string>> {
  try {
    const sb = getSupabaseServer();
    const filas = await leerTodo<Record<string, unknown>>(sb, TABLA, COLUMNAS, {
      orden: 'id', eq: { objeto: 'curso', campo: 'titulo' },
    });
    const out = new Map<string, string>();
    for (const f of filas) {
      const ok = filaLeida(f);
      if (ok) out.set(ok.curso_slug, ok.valor);
    }
    return out;
  } catch (e) {
    console.warn('[conocimiento-ajustes] no pude leer los títulos; se usa el del catálogo:', e instanceof Error ? e.message : e);
    return new Map();
  }
}

/**
 * GUARDA unos cambios de UN curso: pone lo que hay que poner (upsert por la clave) y BORRA lo que hay
 * que sacar (volver a lo de la ficha). Tira si no es el super admin o si la base no contesta: quien
 * llama lo dice en la pantalla y deshace.
 *
 * Vuelve a sanear cada valor: lo que llega acá ya pasó por la acción, pero una función que escribe no
 * le cree a quien la llama.
 */
export async function guardarAjustes(slug: string, cambios: Cambios): Promise<void> {
  const admin = await getSesionAdmin();
  if (!admin) throw new Error('Sólo el super admin edita Conocimientos.');
  const sb = getSupabaseServer();
  const ahora = new Date().toISOString();
  const poner: Array<Record<string, string>> = [];
  for (const p of cambios.poner) {
    const q = queValido(p);
    const v = q ? sanearValor(q, p.valor) : null;
    if (!q || v == null) throw new Error('Un ajuste no es válido.');
    poner.push({ curso_slug: slug, objeto: q.objeto, objeto_id: q.objetoId, campo: q.campo, valor: v, updated_at: ahora, updated_by: admin.email || admin.sub });
  }
  if (poner.length) {
    const { error } = await sb.from(TABLA).upsert(poner, { onConflict: 'curso_slug,objeto,objeto_id,campo' });
    if (error) throw new Error(`No se pudo guardar: ${error.message}`);
  }
  for (const x of cambios.quitar) {
    const q = queValido(x);
    if (!q) throw new Error('Un ajuste no es válido.');
    const { error } = await sb.from(TABLA).delete()
      .eq('curso_slug', slug).eq('objeto', q.objeto).eq('objeto_id', q.objetoId).eq('campo', q.campo);
    if (error) throw new Error(`No se pudo guardar: ${error.message}`);
  }
}
