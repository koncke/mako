// =============================================================================
// onboarding-curso — qué DATO cierra cada paso del onboarding de la tab Curso
// =============================================================================
// Regla de la casa: toda tab tiene onboarding y su estado alimenta a MaKo
// (.claude/skills/tab-onboarding). Los pasos están declarados en lib/tab-onboarding-catalogo.ts
// (`cs-curso`); acá vive la regla de cuándo cada uno está hecho, y es PURA para que el test la
// ejecute.
//
// ⚠️ EL ESTADO SE DERIVA DE LOS DATOS, NO SE RECUERDA. El ws1 llegó a esta tab con 107 clases
// cargadas por script (scripts/curso-cargar-programa.ts): un paso que sólo se cerrara «haciéndolo
// acá» le pediría a Mauricio cargar un programa que ya tiene. La página llama a
// `cambiosDeOnboarding` en cada carga y escribe lo que el dato dice (onboarding-sync.ts).
//
// ⚠️ «NO PUDE LEER» NO ES «NO HAY» (AGENTS.md): un hecho en `null` no marca ni desmarca nada. Una
// consulta caída que desmarcara «Tu programa» le volvería a pedir a Mauricio su curso entero.
//
// Sin 'use client' ni 'server-only': lo usan la página (server), la lista de la tab (navegador) y
// el test.

import type { Clase } from '@/lib/curso';
import { reproductorDeClase } from '@/lib/curso';

/** La key de la tab en el catálogo de onboardings (y en el nav). */
export const TAB_CURSO = 'cs-curso';

/** Los pasos, EN EL ORDEN DEL CATÁLOGO. El test compara las dos listas: el orden es una guarda. */
export const PASOS_CURSO = ['curso_programa', 'curso_videos', 'curso_vista', 'curso_invitar'] as const;
export type PasoCurso = (typeof PASOS_CURSO)[number];

/**
 * Lo que se sabe del curso de este workspace. `null` = no se pudo leer.
 *
 * `entraron` son los clientes que abrieron su portal al menos una vez (`curso_accesos.ingresos`),
 * e `invitados`, a los que les salió el mail de invitación (`invitacion_enviada_at`, que se
 * escribe SÓLO si el mail salió — mig 0206). `vistaAbierta` es el ensayo: alguien del equipo abrió
 * la vista previa del alumno.
 */
export type HechosCurso = {
  clases: number | null;
  conVideo: number | null;
  entraron: number | null;
  invitados: number | null;
  vistaAbierta?: boolean;
};

/** Cuántas clases hay y cuántas tienen un video que el portal puede mostrar. */
export function hechosDeClases(clases: ReadonlyArray<Pick<Clase, 'videoTipo' | 'videoUrl' | 'videoPath'>>): { clases: number; conVideo: number } {
  // «Con video» es lo que el PORTAL dibuja (`reproductorDeClase`), no lo que dice la columna: un
  // link que no se reconoce no se dibuja, y contarlo cerraría el paso sobre un video que el
  // alumno nunca ve.
  return { clases: clases.length, conVideo: clases.filter((c) => reproductorDeClase(c).video != null).length };
}

const hay = (n: number | null): boolean | null => (n == null ? null : n > 0);

/**
 * Qué dice el dato de cada paso: `true` hecho, `false` no hecho, `null` no se sabe.
 *
 * ⚠️ «TU PROGRAMA» ES DEL WORKSPACE Y SE CIERRA CON UNA CLASE, A PROPÓSITO: no pide una clase
 * por etapa ni una por producto. Es lo que lee MaKo («¿la tab está configurada?»), no una
 * auditoría del curso. Las dos reglas más estrictas se midieron y traban la tab para siempre:
 *   · «Una clase por etapa»: las etapas default terminan en «Entregado»
 *     (lib/servicio-etapas.ts, ETAPAS_ENTREGA_DEFAULT), donde el cliente ya terminó y no va
 *     ninguna clase (`decidirAvance` responde «última etapa»). Ese paso no se cerraría nunca.
 *   · «Cada producto con su curso»: el ws1 tiene DOS productos (docs/hallazgos-customer-success.md,
 *     «solo hay esos 2») y scripts/curso-cargar-programa.ts cargó el curso en uno solo («Negocio
 *     que Escala», 107 clases). Un servicio no tiene por qué tener curso, y el paso quedaría
 *     abierto para siempre por el que no lo tiene.
 * Lo que falta por etapa se dice en la tab, que es donde se arregla: cada etapa vacía dice «Sin
 * clases.» y una sin tarea que la cierre, «No avanza sola». Y la LISTA habla del producto
 * elegido, no del workspace (`checklistCurso`, más abajo).
 */
export function pasosDeLosDatos(h: HechosCurso): Record<PasoCurso, boolean | null> {
  return {
    curso_programa: hay(h.clases),
    curso_videos: hay(h.conVideo),
    // El ensayo lo cierra el equipo (la vista previa) o un cliente de verdad entrando a su portal,
    // que es una prueba más fuerte todavía de que la tab quedó lista.
    curso_vista: h.vistaAbierta || (h.entraron ?? 0) > 0 ? true : hay(h.entraron),
    curso_invitar: hay(h.invitados),
  };
}

/**
 * Los pasos que el dato puede DESHACER: las clases y sus videos se borran. Haber visto el portal
 * o haber mandado una invitación son hechos que ya pasaron — un cliente revocado no des-invita a
 * nadie, y la vista previa no deja rastro en la base que se pueda volver a leer.
 */
const DESMARCABLES: ReadonlySet<PasoCurso> = new Set<PasoCurso>(['curso_programa', 'curso_videos']);

/**
 * Lo que hay que escribir para que el estado guardado diga lo mismo que los datos, en el orden
 * del catálogo (marcar `curso_vista` exige `curso_programa` antes: `pasoBloqueadoPor`).
 */
export function cambiosDeOnboarding(
  steps: Readonly<Record<string, { done?: boolean } | undefined>>,
  h: HechosCurso,
): Array<{ paso: PasoCurso; done: boolean }> {
  const d = pasosDeLosDatos(h);
  const out: Array<{ paso: PasoCurso; done: boolean }> = [];
  for (const p of PASOS_CURSO) {
    const hecho = !!steps[p]?.done;
    if (d[p] === true && !hecho) out.push({ paso: p, done: true });
    else if (d[p] === false && hecho && DESMARCABLES.has(p)) out.push({ paso: p, done: false });
  }
  return out;
}

/** Lo que la lista de la tab dice de las clases: las del PRODUCTO ELEGIDO. */
export type ChecklistDelProducto = { clases: number; conVideo: number };

/**
 * La lista del onboarding de la tab: si se dibuja y qué cuenta. `null` = no se dibuja.
 *
 * ⚠️ DOS ALCANCES, Y CADA UNO EN SU LUGAR:
 *   · SI SE DIBUJA lo decide el WORKSPACE, igual que el paso anotado que lee MaKo: se va cuando
 *     hay programa (en cualquier producto) y se hizo el ensayo. Que vuelva al elegir un producto
 *     sin clases sería pedirle al ws1 un curso para su segundo producto, que no tiene por qué
 *     tenerlo; sus etapas vacías ya lo dicen abajo («Sin clases.»).
 *   · LO QUE DICE es del PRODUCTO ELEGIDO, como la cabecera de la tab. Antes contaba el
 *     workspace: con A (107 clases) y B (0), al elegir B decía «Tu programa ✓ 107 clases» y
 *     escondía «Agregar clase» mientras la cabecera de B decía «0 clases».
 *
 * Con las clases del producto elegido sin leer, no se dibuja: «no pude leer» no es «no hay»
 * (AGENTS.md), y la tab ya lo dice en su aviso. Con lo anotado sin leer (`anotado` null), tampoco.
 */
export function checklistCurso(p: {
  clases: ReadonlyArray<Pick<Clase, 'productoId' | 'videoTipo' | 'videoUrl' | 'videoPath'>>;
  productoId: number | null;
  /** Lo anotado en `onboarding.tab.cs-curso`. */
  anotado: { programa: boolean; vista: boolean } | null;
  /** No se pudieron leer las clases del producto elegido. */
  errorDelProducto: boolean;
}): ChecklistDelProducto | null {
  if (!p.anotado || p.errorDelProducto) return null;
  // El `||` con lo anotado cubre la lectura caída de OTRO producto, donde la lista local dice
  // menos de lo que hay sin saberlo.
  const programa = hechosDeClases(p.clases).clases > 0 || p.anotado.programa;
  if (programa && p.anotado.vista) return null;
  return hechosDeClases(p.clases.filter((c) => c.productoId === p.productoId));
}
