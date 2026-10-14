import 'server-only';

// =============================================================================
// curso-papelera — borra DE VERDAD lo que lleva días en la papelera del curso (mig 0223)
// =============================================================================
// Borrar una clase o un módulo desde el editor los manda a la papelera (`borrada_at` / `borrado_at`),
// invisibles para todo lo demás, para que el «Deshacer» de 5 segundos los devuelva con la MISMA
// identidad (lib/curso-admin.ts `borrarClase`, lib/curso-modulos-datos.ts `borrarModulo`). Esto es la
// otra punta: lo que lleva más de `DIAS_PAPELERA` días ahí se borra de verdad. Lo corre el cron diario
// /api/cron/curso-purga, ANTES de la purga de los buckets: así el video de una clase purgada queda sin
// fila que lo nombre, y esa purga lo barre (con su propio modo prueba).
//
// Al purgar una clase se va su avance por la cascada de la 0202 (`curso_progreso`) y sus notas (0208);
// sus adjuntos quedan sin clase (`on delete set null`, 0216). Lo que la nombra SIN FK se limpia acá: lo
// que se le abrió a mano a un alumno (`curso_desbloqueos`, la clave es su id como texto) y su portada
// (`curso_estilo portada:clase:<id>`). Es lo que hasta el 08/10/2026 hacía `borrarClase` en el acto.
//
// ⚠️ A DIFERENCIA DE LA PURGA DE LOS BUCKETS, ESTO NO TIENE MODO PRUEBA: borra filas que una PERSONA
// borró hace una semana, con la marca puesta por el código. No hay nada que medir antes: es el
// `delete` de siempre, diferido.
//
// ⚠️ FAIL-CLOSED Y CON COMPARE-AND-SET: el `delete` vuelve a exigir la marca y su edad, así que una
// clase que alguien devolvió entre la lectura y el borrado (otra pestaña, un «Deshacer» tardío) se
// salva. Y un módulo con clases que todavía lo nombran —en la papelera, más nuevas— no se purga: su
// clave no se puede liberar mientras alguien la use (`clavesUsadas`, lib/curso-modulos-datos.ts).
//
// ⚠️ LA LECTURA ES DE TODOS LOS WORKSPACES, con el cliente de servicio, como lib/curso-purga.ts: cada
// fila se decide por SU marca, y cada limpieza lleva el workspace de la fila.

import { getSupabaseServer } from './supabase';
import { leerTodo } from './supabase-paginado';
import { DIAS_PAPELERA, corteDePapelera } from './curso-papelera-reglas';

/** De a cuántas filas se borra (un `in.(…)` en la URL de PostgREST). */
const LOTE = 100;

export type ResultadoPapelera = { clases: number; modulos: number; error: string | null };

const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : String(e));

type FilaClase = { id: number; workspace_id: number; producto_id: number };
type FilaModulo = { id: number; workspace_id: number; producto_id: number; clave: string };

/** Purga la papelera del curso. No tira: lo que pasa queda en el resultado (el cron contesta 500 si hubo error). */
export async function purgarPapeleraDelCurso(
  { ahoraMs = Date.now(), dias = DIAS_PAPELERA }: { ahoraMs?: number; dias?: number } = {},
): Promise<ResultadoPapelera> {
  const r: ResultadoPapelera = { clases: 0, modulos: 0, error: null };
  const sb = getSupabaseServer();
  const corte = corteDePapelera(ahoraMs, dias);
  try {
    // ── 1. Las clases ──
    const clases = await leerTodo<FilaClase>(sb, 'curso_clases', 'id, workspace_id, producto_id',
      { filtros: (q) => q.not('borrada_at', 'is', null).lt('borrada_at', corte), orden: 'id' });
    for (let i = 0; i < clases.length; i += LOTE) {
      const ids = clases.slice(i, i + LOTE).map((c) => Number(c.id));
      const { data, error } = await sb.from('curso_clases').delete()
        .in('id', ids).not('borrada_at', 'is', null).lt('borrada_at', corte).select('id, workspace_id, producto_id');
      if (error) throw new Error(`borrar clases: ${error.message}`);
      for (const c of (data ?? []) as FilaClase[]) {
        r.clases += 1;
        // Lo que la nombra sin FK. Best-effort: una fila de más no abre ni dibuja nada.
        const e1 = await sb.from('curso_desbloqueos').delete().eq('workspace_id', c.workspace_id).eq('producto_id', c.producto_id)
          .eq('objeto', 'clase').eq('clave', String(c.id));
        if (e1.error) console.warn(`[curso-papelera] no pude limpiar lo abierto a mano de la clase ${c.id}: ${e1.error.message}`);
        // Su portada y sus comentarios prendidos (los dos ajustes de estilo que nombran una clase).
        const e2 = await sb.from('curso_estilo').delete().eq('workspace_id', c.workspace_id).eq('producto_id', c.producto_id)
          .in('clave', [`portada:clase:${c.id}`, `comentarios:clase:${c.id}`]);
        if (e2.error) console.warn(`[curso-papelera] no pude borrar la portada ni los comentarios de la clase ${c.id}: ${e2.error.message}`);
      }
    }

    // ── 2. Los módulos (la fila de un suelto, o la del candado de un vinculado que se quitó) ──
    const modulos = await leerTodo<FilaModulo>(sb, 'curso_modulos', 'id, workspace_id, producto_id, clave',
      { filtros: (q) => q.not('borrado_at', 'is', null).lt('borrado_at', corte), orden: 'id' });
    for (const m of modulos) {
      // ⚠️ CON TODAS las clases, también las de la papelera: una más nueva que todavía nombra esta clave
      // la necesita para volver a su módulo con «Deshacer». La próxima vuelta lo vuelve a mirar.
      const { count, error: eC } = await sb.from('curso_clases').select('id', { count: 'exact', head: true })
        .eq('workspace_id', m.workspace_id).eq('producto_id', m.producto_id).eq('etapa', m.clave);
      if (eC) throw new Error(`contar clases de ${m.clave}: ${eC.message}`);
      if ((count ?? 0) > 0) continue;
      const { data, error } = await sb.from('curso_modulos').delete()
        .eq('id', m.id).not('borrado_at', 'is', null).lt('borrado_at', corte).select('id');
      if (error) throw new Error(`borrar el módulo ${m.clave}: ${error.message}`);
      if (!(data ?? []).length) continue;
      r.modulos += 1;
      const e1 = await sb.from('curso_estilo').delete().eq('workspace_id', m.workspace_id).eq('producto_id', m.producto_id)
        .eq('clave', `portada:etapa:${m.clave}`);
      if (e1.error) console.warn(`[curso-papelera] no pude borrar la portada del módulo ${m.clave}: ${e1.error.message}`);
      const e2 = await sb.from('curso_desbloqueos').delete().eq('workspace_id', m.workspace_id).eq('producto_id', m.producto_id)
        .eq('objeto', 'modulo').eq('clave', m.clave);
      if (e2.error) console.warn(`[curso-papelera] no pude limpiar lo abierto a mano del módulo ${m.clave}: ${e2.error.message}`);
    }
  } catch (e) {
    r.error = msg(e);
  }
  console.log(`[curso-papelera] ${JSON.stringify(r)}`);
  return r;
}
