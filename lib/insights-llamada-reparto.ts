// =============================================================================
// insights-llamada-reparto — a QUÉ reunión pertenece cada llamada analizada, y
// qué leads tienen una grabación cuyos insights todavía no están
// =============================================================================
// Las dos decisiones de los insights de la llamada viven acá y NO en el módulo
// que lee la base, por la misma razón que `closing-job-estado.ts` vive fuera de
// `closing-job.ts`: un módulo con `server-only` no lo puede importar ningún
// test, y éstas son justo las que no pueden quedarse sin red —una reparte el
// análisis de una llamada entre R1 y R2 (equivocarse pone la charla del cierre
// debajo del título de la primera reunión) y la otra decide a qué lead se le
// vuelve a pagar un análisis.
//
// Acá no se lee ni se escribe nada: entran las filas crudas y sale la decisión.
// =============================================================================

import type { ClosingObjection, ClosingMoment, CallTipo, Tone } from './closing';

/**
 * Lo que el Closing Analyst ya dejó escrito de UNA llamada, tal como lo lee la
 * ficha. NO es una copia del dato: cada campo sale de la fila de
 * `closing_analyses` de esa grabación (una fila por `recording_id`), que es
 * donde el análisis ya vivía antes de que existiera este apartado.
 */
export type InsightLlamada = {
  recordingId: number;
  tipo: CallTipo | null;
  titulo: string | null;
  /** ISO exacto del arranque de la grabación. */
  startedAt: string | null;
  /** El día de la llamada en la zona del negocio (lo que escribe `closing.ts`). */
  callDate: string | null;
  duracionMin: number | null;
  outcome: string | null;
  outcomeTone: Tone | null;
  /** Resumen de la charla: contexto, desarrollo, quiebre y resultado. */
  resumen: string | null;
  proximoPaso: string | null;
  objeciones: ClosingObjection[];
  momentos: ClosingMoment[];
  /** Link a la grabación (share_url cuando existe, si no el call_url). */
  url: string | null;
  /** Cuándo lo escribió MaKo. Es lo que vuelve auditable lo que el apartado afirma. */
  analizadoEn: string | null;
};

/**
 * ¿Esta grabación es de la Reunión 2?
 *
 * La etiqueta la escribe `applyFathomRecording` ('Reunión 1' / 'Reunión 2') y
 * también la edita una persona a mano en la ficha, así que el match es flojo a
 * propósito. Vive acá —y no inline en la tarjeta— porque la MISMA pregunta la
 * contestan dos cosas que se dibujan una al lado de la otra: el bloque de la
 * grabación y el apartado de los insights. Con dos copias, el día que alguien
 * acepte otra etiqueta el link queda en R2 y su análisis en R1.
 */
export function etiquetaEsR2(label: string | null | undefined): boolean {
  return /r2|reuni[oó]n 2|junta 2/i.test(label ?? '');
}

/** Normaliza un link de grabación para comparar: sin querystring, sin barra final. */
export function urlComparable(u: string | null | undefined): string {
  return (u ?? '').trim().replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
}

/**
 * Reparte las llamadas analizadas entre R1 y R2.
 *
 * ⚠️ MANDA LA ETIQUETA DEL LINK, NO EL `tipo` DEL ANÁLISIS, y el orden importa.
 * El `tipo` lo escribe el modelo leyendo el transcript (R1 = diagnóstico, R2 =
 * propuesta) y puede venir null o equivocado; la etiqueta es la que decide en
 * qué bloque se dibuja la GRABACIÓN de esa misma llamada. Si los dos deciden por
 * separado, el link de la R2 queda en un bloque y su análisis en el otro — dos
 * cosas de la misma llamada en dos lugares distintos de la misma tarjeta.
 *
 * Lo que no matchea ningún link (una llamada que el Closing Analyst enganchó por
 * email y que nadie cargó en la ficha) cae por `tipo`, y sin `tipo` va a `otras`:
 * no se adivina a cuál reunión pertenece. `otras` se dibuja igual, rotulada
 * aparte — tirarla sería esconder una llamada analizada.
 */
export function repartirPorReunion(
  llamadas: InsightLlamada[],
  links: ReadonlyArray<{ label?: string | null; url?: string | null }>,
): { R1: InsightLlamada[]; R2: InsightLlamada[]; otras: InsightLlamada[] } {
  const porUrl = new Map<string, boolean>(); // url normalizada → esR2
  for (const l of links) {
    const u = urlComparable(l.url);
    if (u) porUrl.set(u, etiquetaEsR2(l.label));
  }
  const R1: InsightLlamada[] = [];
  const R2: InsightLlamada[] = [];
  const otras: InsightLlamada[] = [];
  for (const c of llamadas) {
    const etiqueta = porUrl.get(urlComparable(c.url));
    if (etiqueta === true) R2.push(c);
    else if (etiqueta === false) R1.push(c);
    else if (c.tipo === 'R2') R2.push(c);
    else if (c.tipo === 'R1') R1.push(c);
    else otras.push(c);
  }
  return { R1, R2, otras };
}

/** Un lead visto por la cola: lo mínimo para decidir si le falta el análisis. */
export type LeadConGrabacion = { id: number; fathomLinks: number };

/**
 * A QUIÉN le falta el análisis de su llamada.
 *
 * La cola NO se escribe: se CALCULA. «Tiene una grabación enganchada y ninguna
 * llamada analizada» sale de datos que ya están, así que cubre los tres caminos
 * por los que entra una grabación (el webhook de Fathom, el barrido de
 * `fathom-auto` y el link que alguien pega a mano en la ficha) y el cuarto que
 * se escriba mañana, sin que nadie tenga que acordarse de marcar nada. Es la
 * regla de la casa: si el estado correcto se puede calcular, calcularlo le gana
 * a dispararlo, porque un cálculo no tiene caminos que olvidar.
 *
 * ⚠️ LO QUE UNA COLA CALCULADA NO TIENE ES MEMORIA DEL FRACASO, y sin eso un
 * lead cuya grabación no está en Fathom —un link pegado a mano que apunta a otra
 * cosa— vuelve a entrar en CADA ronda y paga el barrido para no analizar nada,
 * para siempre. Por eso se excluye a quien ya tiene fila en `closing_jobs`: esa
 * fila la deja `cerrarAnalisis` al terminar (con lo que encontró o con el
 * motivo), así que significa «a este ya se le intentó» y la persona puede
 * reintentar cuando quiera desde el botón, que es el único que debería poder
 * volver a gastar.
 */
export function leadsPendientesDeInsights(
  leads: ReadonlyArray<LeadConGrabacion>,
  conAnalisis: ReadonlySet<number>,
  yaIntentados: ReadonlySet<number>,
  max: number,
): number[] {
  const out: number[] = [];
  for (const l of leads) {
    if (out.length >= max) break;
    if (l.fathomLinks <= 0) continue;
    if (conAnalisis.has(l.id)) continue;
    if (yaIntentados.has(l.id)) continue;
    out.push(l.id);
  }
  return out;
}
