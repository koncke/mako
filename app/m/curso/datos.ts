import 'server-only';

// =============================================================================
// /m/curso — lo que lee la pantalla del Curso en el teléfono (server)
// =============================================================================
// Las MISMAS lecturas que app/customer-success/curso/page.tsx, con las mismas funciones de lib (nada
// copiado): los servicios y sus etapas de la cartera de Customer Success (`carteraEnEntrega`), los
// módulos de cada curso (`filasDeModulos` + `derivarModulos`), sus clases (`clasesDelProducto`, sin las
// de la papelera) y el progreso de los clientes ganados (`clientesGanados` + `progresoDeClientes`, el
// EFECTIVO: una clase por área cuenta cuando la enviaron todas sus áreas). Quiénes son los alumnos de cada
// producto es `esDelProducto`, la misma pregunta de la tabla Avance.
//
// ⚠️ EL WORKSPACE ES EL DEL REQUEST: todas leen con getTenantDb por dentro. Nada sale de `?ws=`.
// ⚠️ CADA LECTURA FALLA POR SU CUENTA, como en escritorio: los servicios caídos son el error de la
//    pantalla; las clases de UN producto caídas lo dice ese curso; el avance caído lo dice la hoja de
//    cada clase («No pude leer el avance.»), nunca un «0 de 8» que se leería «nadie empezó».
// ⚠️ NO ESCRIBE NADA: escritorio anota los pasos del onboarding de la tab en cada carga
//    (`sincronizarOnboardingCurso`); el teléfono no (docs/hallazgos-mobile.md, «Sin hacer»).
// ⚠️ EL NOMBRE ES EL FINAL (`conTitulo: true`): el teléfono no edita el título del curso, así que no
//    necesita el de base para dibujar encima (lib/curso-nombre-datos.ts).

import { carteraEnEntrega } from '@/app/customer-success/entrega';
import { esDelProducto } from '@/app/customer-success/pertenencia';
import { clasesDelProducto, progresoDeClientes } from '@/lib/curso-datos';
import { filasDeModulos } from '@/lib/curso-modulos-datos';
import { nombresDeCursos } from '@/lib/curso-nombre-datos';
import { SIN_NOMBRE_EQUIPO } from '@/lib/curso-nombre';
import { derivarModulos, type FilaModulo } from '@/lib/curso-modulos';
import { clientesGanados } from '@/lib/clientes-ganados';
import { adminDeWorkspaceActual } from '@/lib/workspace';
import type { Clase, Progreso } from '@/lib/curso';
import { cursoDatos, type CursoDatos } from './modelo';

export type LecturaCursos =
  | { ok: true; cursos: CursoDatos[]; puedeEditar: boolean }
  | { ok: false; error: string };

const mensaje = (e: unknown): string => (e instanceof Error && e.message ? e.message : String(e));

export async function leerCursos(): Promise<LecturaCursos> {
  const entrega = await carteraEnEntrega();
  if (!entrega.ok) return { ok: false, error: entrega.error };
  const ids = entrega.servicios.map((s) => s.productoId);

  const [filasModulos, nombres, adminId, listas, avance] = await Promise.all([
    // Para DIBUJAR: sin los sueltos, sus clases caen en «Sin módulo» (un aviso visible), como escritorio.
    filasDeModulos(ids).catch((e) => {
      console.warn('[m/curso] no pude leer los módulos sueltos:', mensaje(e));
      return new Map<number, FilaModulo[]>();
    }),
    nombresDeCursos(ids, { conTitulo: true }).catch((e) => {
      console.warn('[m/curso] no pude leer los nombres de los cursos:', mensaje(e));
      return new Map<number, string>();
    }),
    // Sólo decide si se DIBUJA el selector de acceso: el guard de verdad lo vuelve a hacer la action.
    adminDeWorkspaceActual(),
    Promise.all(ids.map(async (id): Promise<Clase[] | null> => {
      try { return await clasesDelProducto(id); } catch (e) {
        console.warn(`[m/curso] no pude leer las clases del producto ${id}:`, mensaje(e));
        return null;
      }
    })),
    (async (): Promise<{ leads: number[]; progreso: Map<number, Map<number, Progreso>> } | null> => {
      try {
        const leads = (await clientesGanados()).map((c) => c.leadId);
        return { leads, progreso: await progresoDeClientes(leads) };
      } catch (e) {
        console.warn('[m/curso] no pude leer el avance:', mensaje(e));
        return null;
      }
    })(),
  ]);

  const cursos = entrega.servicios.map((s, i) => {
    const asignacion = entrega.porServicio[s.productoId] ?? {};
    return cursoDatos({
      productoId: s.productoId,
      nombre: nombres.get(s.productoId) ?? SIN_NOMBRE_EQUIPO,
      modulos: derivarModulos(s.etapas, filasModulos.get(s.productoId) ?? []),
      clases: listas[i] ?? [],
      errorClases: listas[i] == null,
      alumnos: avance ? avance.leads.filter((l) => esDelProducto(l, s.productoId, entrega.casaPorLead, asignacion)) : null,
      progreso: avance?.progreso ?? null,
    });
  });
  return { ok: true, cursos, puedeEditar: adminId != null };
}
