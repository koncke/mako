import 'server-only';

// =============================================================================
// tope-cursos — el tope de cursos del plan, con la base (la regla y QUÉ ES UN CURSO: ./tope-cursos-reglas.ts)
// =============================================================================
// Lo preguntan las puertas que crean un curso, ANTES de escribir:
//   · la primera clase de un programa: `crearClaseAction` (app/customer-success/curso/modulos-actions.ts) y
//     `crear_clase_curso` de la API (lib/api-mako/areas/curso.run.ts), los dos sobre `crearClase` (lib/curso-admin.ts);
//   · duplicar un programa con clases: `duplicarServicioAction` (app/customer-success/actions.ts) y `duplicar_curso` de la
//     API, los dos sobre `duplicarPrograma` (lib/curso-duplicar.ts).
// Son las ÚNICAS que insertan en `curso_clases` (lo fija tests/classroom-topes-esencial.test.ts): una puerta nueva que
// inserte clases tiene que pasar por acá.
// Si no cabe, la puerta dice `texto` (`textoTope`) con «Pasar a Pro» (`RUTA_CAMBIAR_PLAN`). Si algo no se puede leer, pasa.
// =============================================================================

import { getTenantDb } from './workspace';
import { esEsencialDe } from './plan-esencial';
import { productosDeLaEntrega } from '@/app/customer-success/entrega';
import { creaUnCurso, topeParaCursoNuevo, type ComoNaceUnCurso } from './tope-cursos-reglas';

export type FrenoCurso = { tope: number; texto: string };

/** ¿El programa tiene al menos una clase viva (sin las de la papelera)? Tira si no se puede leer. */
async function tieneClases(productoId: number): Promise<boolean> {
  const db = await getTenantDb();
  const { data, error } = await db.from('curso_clases').select('id').eq('producto_id', productoId).is('borrada_at', null).limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

async function frenoDeCursoNuevo(ws: number, productoId: number, como: ComoNaceUnCurso): Promise<FrenoCurso | null> {
  try {
    // Lo barato primero: el Pro, el ws1, la plataforma y los acuerdos a mano no leen nada más.
    if (!(await esEsencialDe(ws))) return null;
    const programaConClases = await tieneClases(productoId);
    // Sin curso nuevo no hace falta contar (una clase en el curso que ya tiene, o la copia de un programa vacío).
    if (!creaUnCurso(como, programaConClases)) return null;
    // Los programas que Classroom muestra (un producto eliminado en el CRM ya no cuenta: su curso no se ve).
    const otros = (await productosDeLaEntrega()).map((p) => p.id).filter((id) => id !== productoId);
    const conClases = await Promise.all(otros.map(tieneClases));
    const r = topeParaCursoNuevo({ esencial: true, como, programaConClases, otrosCursos: conClases.filter(Boolean).length });
    return r.ok ? null : { tope: r.tope, texto: r.texto };
  } catch (e) {
    console.warn(`[tope-cursos] no pude contar los cursos del negocio ${ws}; sin tope:`, e instanceof Error ? e.message : String(e));
    return null;
  }
}

/** La PRIMERA clase de un programa crea un curso. null = pasa. */
export const frenoAlCrearClase = (ws: number, productoId: number): Promise<FrenoCurso | null> => frenoDeCursoNuevo(ws, productoId, 'clase');

/** Duplicar un programa CON clases crea un curso (la copia). null = pasa. */
export const frenoAlDuplicar = (ws: number, productoId: number): Promise<FrenoCurso | null> => frenoDeCursoNuevo(ws, productoId, 'duplicar');
