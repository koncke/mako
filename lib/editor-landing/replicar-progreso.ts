// =============================================================================
// editor-landing/replicar-progreso — la réplica A LA VISTA mientras se arma (AGENTS.md, 28/10/2026)
// =============================================================================
// Martín: «mientras se va replicando la landing, que se replique una parte de arriba, que se vaya replicando la parte de
// abajo, que cambien los textos, que se vaya armando todo». La réplica corre en el server hasta unos minutos (las
// tandas de la IA); con `enVivo` la ruta contesta un flujo NDJSON: una línea por cosa que se ARMÓ, en el orden en que se
// armó, y al final la respuesta de siempre. Lo puro (con test: tests/web-generator-replicar-partes.test.ts): los
// eventos, cómo se escribe y se lee cada línea, y cómo se vuelven las fases y las piezas de `ArmadoEnVivo`.
//   · nunca se manda algo que no pasó: el evento de una sección sale cuando su tanda volvió (o cuando quedó con el
//     respaldo, al final, dicho así);
//   · la línea final es la `RespuestaReplicar` de siempre: la pantalla hace con ella lo mismo que sin el flujo.
// =============================================================================

import type { FaseArmado } from '@/app/_ui/armado-en-vivo';
import { fasesDesde } from '@/app/_ui/armado-en-vivo';
import type { RespuestaReplicar } from './replicar-reglas';

export type EventoReplica =
  /** Arrancó: lee la página (o usa la lectura que vino). */
  | { fase: 'leer' }
  /** El esquema está: cuántas secciones va a tener y sus títulos, en orden. */
  | { fase: 'esquema'; secciones: string[] }
  /** Una sección quedó escrita. `respaldo`: no la escribió la IA (quedó con el texto del esquema). */
  | { fase: 'seccion'; indice: number; titulo: string; respaldo?: boolean }
  /** Se aplica el diseño (el tema, las imágenes, las animaciones) y se crea la landing. */
  | { fase: 'diseno' }
  /** Terminó: la respuesta de siempre. */
  | { fase: 'fin'; respuesta: RespuestaReplicar };

export type AlProgreso = (e: EventoReplica) => void;

/** Una línea del flujo (NDJSON). */
export const lineaDeEvento = (e: EventoReplica): string => `${JSON.stringify(e)}\n`;

/**
 * Los eventos completos de lo que llegó hasta ahora (`pendiente` es lo que quedó a medias de la última lectura del
 * flujo). Una línea que no es JSON o no tiene `fase` se descarta: la pantalla no se rompe por una línea rota.
 */
export function leerEventos(pendiente: string, trozo: string): { eventos: EventoReplica[]; resto: string } {
  const todo = pendiente + trozo;
  const lineas = todo.split('\n');
  const resto = lineas.pop() ?? '';
  const eventos: EventoReplica[] = [];
  for (const l of lineas) {
    if (!l.trim()) continue;
    try {
      const e = JSON.parse(l) as EventoReplica;
      if (e && typeof e === 'object' && typeof (e as { fase?: unknown }).fase === 'string') eventos.push(e);
    } catch { /* una línea rota no rompe la pantalla */ }
  }
  return { eventos, resto };
}

/** Las fases de la réplica, como las de la extensión. */
export const FASES_REPLICA = [
  { id: 'leer', texto: 'Leer la página' },
  { id: 'esquema', texto: 'Armar la estructura' },
  { id: 'secciones', texto: 'Escribir las secciones' },
  { id: 'diseno', texto: 'Aplicar el diseño' },
] as const;

/** Lo que se ve de una réplica en curso: sus fases, las secciones ya escritas (en el orden en que llegaron) y el total. */
export type VistaReplica = { fases: FaseArmado[]; piezas: { id: string; texto: string; detalle?: string }[]; total: number; terminado: boolean; fallo: boolean };

/** Los eventos → lo que dibuja `ArmadoEnVivo`. Puro: la pantalla lo llama con todo lo que llegó. */
export function vistaDeEventos(eventos: readonly EventoReplica[]): VistaReplica {
  let actual: string | null = null;
  let total = 0;
  let terminado = false;
  let fallo = false;
  const piezas: VistaReplica['piezas'] = [];
  const vistas = new Set<number>();
  for (const e of eventos) {
    if (e.fase === 'leer') actual = 'leer';
    else if (e.fase === 'esquema') { actual = 'secciones'; total = e.secciones.length; }
    else if (e.fase === 'seccion') {
      actual = 'secciones';
      if (vistas.has(e.indice)) continue;
      vistas.add(e.indice);
      piezas.push({ id: `s${e.indice}`, texto: e.titulo || `Sección ${e.indice + 1}`, detalle: `Sección ${e.indice + 1}${e.respaldo ? ' · con el texto del esquema' : ''}` });
    } else if (e.fase === 'diseno') actual = 'diseno';
    else if (e.fase === 'fin') { terminado = e.respuesta.ok; fallo = !e.respuesta.ok; }
  }
  return { fases: fasesDesde(FASES_REPLICA, actual, { terminado, fallo }), piezas, total, terminado, fallo };
}
