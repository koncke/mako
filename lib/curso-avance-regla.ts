// =============================================================================
// curso-avance-regla — ¿con esta tarea el cliente terminó su etapa? (puro)
// =============================================================================
// La DECISIÓN del paso automático de etapa, separada de lib/curso-avance.ts (que lee la base y
// mueve) para que tests/curso-avance.test.ts la EJECUTE sin base. Sin 'server-only' a propósito.
//
// Pedido de Martín (06/10/2026): «Si se completa X cosa y ahí ya termina la etapa, debería ir a
// la próxima etapa». Las piezas ya son reglas con test en lib/curso.ts (`etapaCompleta`,
// `etapaSiguiente`); acá se decide el ORDEN en que se preguntan, que es lo que puede salir mal.

import { etapaCompleta, etapaSiguiente, obligatoriasDe, type Clase, type EstadoTarea } from './curso';

type ClaseMin = Pick<Clase, 'id' | 'etapa' | 'obligatoria' | 'tarea' | 'campos'>;

export type DecisionAvance =
  | { mover: true; desde: string; hacia: string; /** Clases de la etapa nueva: con 0 no hay mensaje que mandar. */ clasesEnHacia: number }
  | { mover: false; desde: string | null; motivo: string };

/**
 * Decide si el cliente pasa de etapa después de ENVIAR la tarea de una clase.
 *
 * El orden de las preguntas es el contrato:
 *   0. ¿La clase es de un módulo VINCULADO? (D1, 08/10/2026). Un módulo SUELTO no es una etapa del
 *      kanban: completarlo no mueve a nadie. Sin `vinculados` (quien llama no los pasó), cuenta como
 *      vinculada toda clave que sea una etapa del kanban — que es lo de antes de los sueltos.
 *   1. ¿Está en la entrega de ese producto? (`etapaActual` null = no).
 *   2. ¿La tarea es de la etapa en la que está HOY? Si no, no se mueve.
 *   3. ¿La etapa tiene obligatorias? Sin ninguna NO se completa sola (lib/curso.ts lo explica).
 *   4. ¿Las envió todas?
 *   5. ¿Hay una etapa siguiente?
 *
 * ⚠️ LA 2 VA ANTES QUE LA 4, Y NO ES PROLIJIDAD. Un cliente que reenvía la última tarea de una
 * etapa YA PASADA completa esa etapa otra vez: sin la 2, se lo «movería» a la siguiente de
 * aquélla, o sea HACIA ATRÁS de donde está. Y uno que adelanta la tarea de una etapa futura
 * saltaría columnas sin haber terminado la suya.
 *
 * ⚠️ NO ENCADENA. Si el cliente ya había enviado de antemano todo lo de la etapa siguiente, no
 * se lo pasa de largo: se mueve UNA etapa por tarea enviada. Encadenar dispararía el evento de
 * entrega de cada etapa intermedia (y sus secuencias) en el mismo segundo.
 */
export function decidirAvance(p: {
  etapaDeLaClase: string;
  etapaActual: string | null;
  /** Las CLAVES de las etapas de la entrega, en orden (`entregaDeProducto(id).etapas`). */
  etapas: readonly string[];
  /**
   * Las claves de los módulos VINCULADOS (las etapas con `enCurso !== false`). Una clase de un módulo
   * suelto —o de una etapa que se sacó del curso— no mueve a nadie.
   */
  vinculados?: readonly string[];
  /** Todas las clases del producto (se filtran acá por etapa). */
  clases: readonly ClaseMin[];
  estadoDe: (claseId: number) => EstadoTarea | undefined;
}): DecisionAvance {
  const desde = p.etapaActual;
  if (!(p.vinculados ?? p.etapas).includes(p.etapaDeLaClase)) return { mover: false, desde: desde ?? null, motivo: 'la clase no es de una etapa del kanban' };
  if (!desde) return { mover: false, desde: null, motivo: 'no está en la entrega de ese producto' };
  if (p.etapaDeLaClase !== desde) return { mover: false, desde, motivo: 'la tarea es de otra etapa' };
  const deLaEtapa = p.clases.filter((c) => c.etapa === desde);
  if (!obligatoriasDe(deLaEtapa).length) return { mover: false, desde, motivo: 'la etapa no tiene tareas obligatorias' };
  if (!etapaCompleta(deLaEtapa, p.estadoDe)) return { mover: false, desde, motivo: 'le faltan tareas de la etapa' };
  const hacia = etapaSiguiente(p.etapas, desde);
  if (!hacia) return { mover: false, desde, motivo: 'última etapa' };
  return { mover: true, desde, hacia, clasesEnHacia: p.clases.filter((c) => c.etapa === hacia).length };
}

/** La CLAVE de la etapa anterior a `etapa` en el orden de la entrega. `null` si es la primera (o no existe). */
export function etapaAnterior(etapas: readonly string[], etapa: string): string | null {
  const i = etapas.indexOf(etapa);
  return i > 0 ? etapas[i - 1] : null;
}
