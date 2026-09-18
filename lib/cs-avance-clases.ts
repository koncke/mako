// =============================================================================
// cs-avance-clases — qué clase vio cada cliente y qué hizo con su tarea
// =============================================================================
// Lo pidió Martín en la llamada del 9/9 y Mauricio lo adoptó: «ver quién miró tal
// clase, quién completó la tarea… eso me va a ayudar a tener un poco más de
// control». Los datos ya estaban —el webhook de Whop escribe `visto_at` y la tarea
// guarda su estado en `cs_respuestas`—, lo que faltaba era poder LEERLOS por clase:
// la ficha del cliente solo mostraba el NÚMERO «vio y no contestó», nunca cuál.
//
// ⚠️ SIN `server-only`, a propósito. Es la parte que decide qué se le muestra a
// Mauricio sobre el avance de un cliente, y un módulo con `server-only` no lo puede
// importar ningún test: quedaría como lo único del camino sin una sola aserción.
// Mismo criterio que `lib/whop-evento.ts` y `lib/model-catalogo.ts`.

import { CLASES, rotuloDe, MODULOS_POR_AREA } from './programa-catalogo';
import type { Bloque } from './cs-respuestas';

/** El estado de la TAREA, separado de haber VISTO la clase. Son dos hechos
 *  distintos y la pantalla los muestra por separado: «la vio y no la contestó» es
 *  exactamente el caso que esto existe para hacer visible. */
export type TareaEstado = 'sin-contestar' | 'contestada' | 'revisada_ia' | 'aprobada';

export type AvanceClase = {
  claseId: string;
  /** «1.2 · Título», el mismo rótulo que usa Whop y el resto del programa. */
  rotulo: string;
  /** Cuándo la completó en Whop por PRIMERA vez. null = no hay registro de que la
   *  haya visto — que no es lo mismo que «no la vio»: el webhook existe desde el
   *  11/08, y lo anterior solo entra con el backfill. */
  vistoAt: string | null;
  tarea: TareaEstado;
  contestadaAt: string | null;
  aprobadaAt: string | null;
  /** Solo en los módulos donde la tarea se repite por área (el video es uno, la
   *  tarea no): cuántas áreas contestó de las que ya tienen fila. */
  areas?: { contestadas: number; aprobadas: number; total: number };
};

const ORDEN_TAREA: Record<TareaEstado, number> = { 'sin-contestar': 0, contestada: 1, revisada_ia: 2, aprobada: 3 };

const tareaDe = (estado: Bloque['estado'] | undefined): TareaEstado =>
  !estado || estado === 'pendiente' ? 'sin-contestar' : estado;

/** La más temprana: «vio la clase» es la PRIMERA vez que la completó. Un alumno que
 *  la repasa un mes después no la vio recién ahí. */
const primera = (xs: (string | null | undefined)[]): string | null =>
  xs.filter((x): x is string => !!x).sort()[0] ?? null;

/** La más tardía: para «cuándo contestó» interesa la última versión. */
const ultima = (xs: (string | null | undefined)[]): string | null =>
  xs.filter((x): x is string => !!x).sort().at(-1) ?? null;

/**
 * Las filas de un cliente, convertidas en una fila por CLASE del programa y en el
 * ORDEN del programa (no el alfabético de `clase_id`, que pondría m10 antes que m2).
 *
 * Solo entran las clases con ALGUNA señal —vista o con la tarea tocada—: las 44 del
 * programa listadas en una ficha son una pared, y lo que Mauricio necesita es dónde
 * está parado cada cliente, no el temario.
 */
export function avancePorClase(bloques: Pick<Bloque,
  'clase_id' | 'area' | 'estado' | 'visto_at' | 'contestada_at' | 'aprobada_at'>[]): AvanceClase[] {
  const porClase = new Map<string, typeof bloques>();
  for (const b of bloques) {
    const a = porClase.get(b.clase_id) ?? [];
    a.push(b);
    porClase.set(b.clase_id, a);
  }

  const salida: AvanceClase[] = [];
  for (const { modulo, clase } of CLASES) {
    const filas = porClase.get(clase.id);
    if (!filas?.length) continue;

    // `visto_at` lo escribe el webhook en la fila SIN área, pero se toma de todas:
    // no tiene por qué quedar siempre ahí, y perderlo por eso sería esconder
    // justo el dato que esta pantalla vino a mostrar.
    const vistoAt = primera(filas.map((f) => f.visto_at));

    const principal = filas.find((f) => !f.area);
    const porArea = filas.filter((f) => !!f.area);

    let fila: AvanceClase;
    // ⚠️ EN LOS MÓDULOS POR ÁREA, LA FILA SIN ÁREA NO ES LA TAREA.
    // Ahí la tarea vive en una fila por área, y la fila sin área es solo la marca
    // de «vio la clase» que deja el webhook — con estado `pendiente` para siempre,
    // porque nadie contesta sobre ella. Leerla como la tarea haría que una clase
    // contestada en todas sus áreas figure «sin contestar».
    if (MODULOS_POR_AREA.includes(modulo.id) && porArea.length) {
      const contestadas = porArea.filter((f) => tareaDe(f.estado) !== 'sin-contestar').length;
      const aprobadas = porArea.filter((f) => f.estado === 'aprobada').length;
      // La tarea de la clase es la del área MENOS avanzada: una clase con tres
      // áreas aprobadas y una sin contestar no está aprobada.
      const peor = porArea.map((f) => tareaDe(f.estado))
        .sort((a, b) => ORDEN_TAREA[a] - ORDEN_TAREA[b])[0];
      fila = {
        claseId: clase.id, rotulo: rotuloDe(clase.id), vistoAt,
        tarea: peor,
        contestadaAt: ultima(porArea.map((f) => f.contestada_at)),
        aprobadaAt: aprobadas === porArea.length ? ultima(porArea.map((f) => f.aprobada_at)) : null,
        areas: { contestadas, aprobadas, total: porArea.length },
      };
    } else {
      fila = {
        claseId: clase.id, rotulo: rotuloDe(clase.id), vistoAt,
        tarea: tareaDe(principal?.estado),
        contestadaAt: principal?.contestada_at ?? null,
        aprobadaAt: principal?.aprobada_at ?? null,
      };
    }

    // ⚠️ «Tiene señal» NO es «su tarea no está en cero». En un módulo por área la
    // tarea de la clase es la del área MENOS avanzada, así que una clase con un área
    // APROBADA y otra sin empezar vale «sin contestar» — y filtrando por eso,
    // desaparecía de la lista con trabajo aprobado adentro. Lo cazó el test. La señal
    // es cualquier cosa que haya pasado: vista, o alguna área tocada.
    const tocada = fila.tarea !== 'sin-contestar' || (fila.areas?.contestadas ?? 0) > 0;
    if (fila.vistoAt || tocada) salida.push(fila);
  }
  return salida;
}

/** Las que VIO y NO contestó: el caso que dispara el recordatorio. */
export const vistasSinContestar = (xs: AvanceClase[]): AvanceClase[] =>
  xs.filter((x) => x.vistoAt && x.tarea === 'sin-contestar');
