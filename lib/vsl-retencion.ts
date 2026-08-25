// =============================================================================
// La curva de retención del VSL — puro, sin IO, testeable
// =============================================================================
// De N personas que le dieron play, cuántas siguen vivas en cada corte de 5%.
// Panda NO da esto: su `engagement` es UN escalar por video (retención media).
// La curva sale de nuestros propios eventos (vsl_events), y es la única forma
// de responder la pregunta que importa: EN QUÉ TRAMO se cae el espectador.
//
// Vive aparte de lib/vsl-analyst.ts a propósito: es la única pieza con
// invariantes matemáticas de verdad (monotonía, dedup por persona, qué es un
// cero medido y qué es un cero por falta de instrumentación), así que se testea
// sin base de datos y sin IA. Por eso tampoco lleva 'server-only'.
//
// ⚠️ LA REGLA QUE NO SE NEGOCIA: sin avance positivo el resultado es `hayDatos:
// false`, JAMÁS 0%. Un 0% dice "la gente abandona al instante"; la verdad puede
// ser "no estamos midiendo". Confundirlas ya costó 18 días de ceguera
// (2026-07-15 → 08-05) que nadie detectó porque los números salían igual.
// Misma semántica que getVslEngagement en lib/leads.ts.
// =============================================================================

/** Fila de vsl_events, con lo mínimo que la curva necesita. */
export type EventoVsl = {
  visitor_id: string | null;
  tipo_evento: string | null;
  /** % del video (0-100). NULL = desconocido, NO cero. */
  porcentaje: number | null;
  /** Posición absoluta en segundos (mig 0121). Es el dato crudo. */
  segundos: number | null;
  video_id?: string | null;
};

/** Un corte de la curva: cuánta gente sigue mirando al llegar a `corte`%. */
export type PuntoCurva = {
  /** 5, 10, 15 … 100 */
  corte: number;
  /** Personas distintas que llegaron hasta acá. */
  vivos: number;
  /** % de los que arrancaron que siguen vivos en este corte. */
  pct: number;
};

export type Retencion = {
  /**
   * false = no hay medición utilizable. La pantalla tiene que decir "no hay
   * datos", nunca dibujar una curva en cero.
   */
  hayDatos: boolean;
  /** Personas distintas que le dieron play. */
  arrancaron: number;
  /**
   * Personas con avance positivo medido. ES EL DENOMINADOR de la curva, y no
   * `arrancaron`, a propósito: quien dio play y no dejó ni un evento de
   * profundidad puede haberse ido en el segundo uno o puede ser un agujero de
   * instrumentación, y no hay forma de distinguirlos. Metidos en el
   * denominador, ensucian la curva con abandono que quizá nunca ocurrió — sobre
   * los datos de jun-jul de 2026 eran 372 de 925 (40%), suficiente para mover
   * cualquier conclusión. Se reportan aparte en `sinMedicion`.
   */
  medidos: number;
  curva: PuntoCurva[];
  /** El tramo con la caída más grande entre dos cortes consecutivos. */
  mayorCaida: { desde: number; hasta: number; perdidos: number; pct: number } | null;
  /** Mediana del avance: el corte donde sobrevive la mitad de los que arrancaron. */
  medianaPct: number | null;
  /** Cuántas personas quedaron sin poder medirse (play sin ningún avance). */
  sinMedicion: number;
};

/**
 * Los tipos de evento que hablan del VIDEO. Todo lo demás habla de la PÁGINA.
 *
 * ⚠️ ESTA CONSTANTE ES LA FRONTERA, y vive acá porque acá es donde se cruza. El
 * snippet manda por el mismo canal y a la misma columna `segundos` dos cosas que
 * no se parecen en nada: los hitos del video (`p5`…`p100`, `s3`…`s1200`, play,
 * pausa, retoma, fin, exit) y el tiempo en la PÁGINA (`salio`, `volvio`,
 * `cierre`, desde la v14). Los segundos de un `salio` son cuánto estuvo la
 * pestaña abierta — dividirlos por la duración del video produce un porcentaje
 * de retención de algo que la persona nunca reprodujo.
 *
 * Medido sobre producción el 25/08/2026, antes de este filtro: 3.416 filas
 * producían un avance inventado, y el ws13 —cuya landing NO TIENE VIDEO, tiene
 * el hueco con el cartel «Video próximamente»— reportaba 30 personas que
 * «reprodujeron el video». Ese número entra al prompt del Landing Analyst, así
 * que la IA venía razonando sobre reproducciones fantasma.
 *
 * La regla, que este repo ya se había escrito a sí mismo en landing-token.ts:
 * un contador que se llama «eventos de X» se filtra por los tipos de X, nunca
 * por «todo menos Y». La lista de lo que no es Y crece sola con cada evento
 * nuevo, y crece en silencio — que es exactamente como llegó este bug: el filtro
 * `!== 'play'` era correcto en la v5 y quedó viejo sin que nadie lo tocara.
 */
export const ES_EVENTO_DE_VIDEO = /^(play|pausa|retoma|fin|exit|p\d+|s\d+)$/;

/** ¿Este evento habla del video, o de la página que lo contiene? */
export const esEventoDeVideo = (tipo: string | null | undefined): boolean =>
  ES_EVENTO_DE_VIDEO.test((tipo ?? '').trim());

const CORTES: number[] = Array.from({ length: 20 }, (_, i) => (i + 1) * 5); // 5..100

const clampPct = (n: number): number => Math.max(0, Math.min(100, n));

/**
 * El avance de UN evento en %, con la duración como puente cuando el navegador
 * no pudo calcularlo (ver mig 0121: panda_timeupdate no trae `duration`).
 *
 * Orden de confianza: el % que mandó el navegador (ya validado 0-100) y, si no
 * vino, `segundos / duracionS`. Devuelve null cuando no se puede saber — que es
 * distinto de cero.
 */
export function avanceDe(ev: EventoVsl, duracionS: number | null): number | null {
  // ⚠️ EL CORTE VA ACÁ, en el choke point, y no en cada consumidor. Filtrar en
  // los tres llamadores deja la regla escrita tres veces y rompible la cuarta —
  // que es como se rompió: `getVslEngagement` y `getVslEngagementMap` excluían
  // `play` y nada más, así que `salio`, `volvio` y `cierre` entraban acá con sus
  // segundos de PÁGINA y salían convertidos en porcentaje de VIDEO.
  if (!esEventoDeVideo(ev.tipo_evento)) return null;
  if (typeof ev.porcentaje === 'number' && Number.isFinite(ev.porcentaje) && ev.porcentaje > 0) {
    return clampPct(ev.porcentaje);
  }
  if (
    typeof ev.segundos === 'number' &&
    Number.isFinite(ev.segundos) &&
    ev.segundos > 0 &&
    typeof duracionS === 'number' &&
    Number.isFinite(duracionS) &&
    duracionS > 0
  ) {
    return clampPct((ev.segundos / duracionS) * 100);
  }
  return null;
}

/**
 * Avance MÁXIMO por persona. Es el paso que convierte eventos en gente: el
 * snippet manda un 'play' por cada carga de página, así que contar filas cuenta
 * pestañas, no espectadores.
 *
 * Devuelve el mapa visitor_id → mejor avance (null = arrancó pero no se pudo
 * medir). Los eventos sin visitor_id se descartan: sin identidad no hay persona
 * que deduplicar y sumarían de a uno inflando el denominador.
 */
export function avancePorPersona(
  eventos: EventoVsl[],
  duracionS: number | null,
  videoId?: string | null,
): Map<string, number | null> {
  const porPersona = new Map<string, number | null>();
  for (const ev of eventos) {
    // Dos videos distintos no se promedian: son dos curvas, no una.
    if (videoId && ev.video_id && ev.video_id !== videoId) continue;
    // ⚠️ Y ACÁ EL CORTE ES POR OTRA RAZÓN que la de `avanceDe`: no alcanza con
    // que el avance dé null, porque la persona entra al mapa IGUAL (con valor
    // null) y `porPersona.size` es lo que lib/landing-analyst.ts cuenta como
    // «personas que reprodujeron el video». Sin este `continue`, una landing sin
    // video sigue reportando espectadores: cualquiera que abra la página y se
    // vaya deja un `salio` y queda contado como uno.
    if (!esEventoDeVideo(ev.tipo_evento)) continue;
    const id = (ev.visitor_id ?? '').trim();
    if (!id) continue;
    const avance = avanceDe(ev, duracionS);
    const previo = porPersona.get(id);
    if (previo === undefined) {
      porPersona.set(id, avance);
      continue;
    }
    if (avance !== null && (previo === null || avance > previo)) porPersona.set(id, avance);
  }
  return porPersona;
}

/**
 * La curva completa. `duracionS` viene de la API de Panda (fetchPandaRetention);
 * puede ser null y en ese caso solo cuentan los eventos que ya traían el %.
 */
export function curvaRetencion(
  eventos: EventoVsl[],
  duracionS: number | null,
  videoId?: string | null,
): Retencion {
  const porPersona = avancePorPersona(eventos, duracionS, videoId);
  const arrancaron = porPersona.size;
  const avances: number[] = [];
  let sinMedicion = 0;
  for (const av of porPersona.values()) {
    if (av === null || av <= 0) sinMedicion++;
    else avances.push(av);
  }
  const medidos = avances.length;

  const vacia: Retencion = {
    hayDatos: false,
    arrancaron,
    medidos,
    curva: [],
    mayorCaida: null,
    medianaPct: null,
    sinMedicion,
  };
  // Nadie con avance positivo → NO hay curva. No se dibuja una fila de ceros.
  if (!medidos) return vacia;

  const curva: PuntoCurva[] = [];
  let previo = Number.POSITIVE_INFINITY;
  for (const corte of CORTES) {
    const vivosCrudo = avances.filter((a) => a >= corte).length;
    // Monotonía no creciente: nadie puede llegar al 50% sin haber pasado el 45%.
    // Con datos redondeados o eventos perdidos el conteo crudo puede subir, y una
    // curva que sube no se puede leer.
    const vivos = Math.min(vivosCrudo, previo);
    previo = vivos;
    curva.push({ corte, vivos, pct: Math.round((vivos / medidos) * 1000) / 10 });
  }

  // El tramo donde más gente se va: es lo primero que hay que mirar del guion.
  let mayorCaida: Retencion['mayorCaida'] = null;
  let anteriorVivos = medidos;
  let anteriorCorte = 0;
  for (const p of curva) {
    const perdidos = anteriorVivos - p.vivos;
    if (perdidos > 0 && (!mayorCaida || perdidos > mayorCaida.perdidos)) {
      mayorCaida = {
        desde: anteriorCorte,
        hasta: p.corte,
        perdidos,
        pct: Math.round((perdidos / medidos) * 1000) / 10,
      };
    }
    anteriorVivos = p.vivos;
    anteriorCorte = p.corte;
  }

  // Mediana: último corte donde sobrevive al menos la mitad de los medidos.
  let medianaPct: number | null = null;
  for (const p of curva) {
    if (p.vivos * 2 >= medidos) medianaPct = p.corte;
  }

  return { hayDatos: true, arrancaron, medidos, curva, mayorCaida, medianaPct, sinMedicion };
}

/**
 * Dónde abandonan, según los eventos 'exit' (el punto exacto de salida).
 * Complementa la curva: la curva dice cuántos quedan, esto dice dónde se van.
 * Un exit sin avance medible NO cuenta como "abandonó en 0%".
 */
export function histogramaAbandono(
  eventos: EventoVsl[],
  duracionS: number | null,
  videoId?: string | null,
): Array<{ corte: number; salidas: number }> {
  const porPersona = new Map<string, number>();
  for (const ev of eventos) {
    if (ev.tipo_evento !== 'exit') continue;
    if (videoId && ev.video_id && ev.video_id !== videoId) continue;
    const id = (ev.visitor_id ?? '').trim();
    if (!id) continue;
    const avance = avanceDe(ev, duracionS);
    if (avance === null || avance <= 0) continue;
    const previo = porPersona.get(id);
    if (previo === undefined || avance > previo) porPersona.set(id, avance);
  }
  const buckets = new Map<number, number>(CORTES.map((c) => [c, 0]));
  for (const avance of porPersona.values()) {
    const corte = Math.min(100, Math.max(5, Math.ceil(avance / 5) * 5));
    buckets.set(corte, (buckets.get(corte) ?? 0) + 1);
  }
  return CORTES.map((corte) => ({ corte, salidas: buckets.get(corte) ?? 0 }));
}

/**
 * El corte de la curva que le corresponde a un bloque del guion que arranca en
 * el segundo `desdeS`. Es el puente entre "se cae en el 40%" y "se cae cuando
 * arranca el bloque de precio".
 */
export function corteDeSegundo(desdeS: number, duracionS: number | null): number | null {
  if (!duracionS || duracionS <= 0 || !Number.isFinite(desdeS) || desdeS < 0) return null;
  return Math.min(100, Math.max(5, Math.ceil((desdeS / duracionS) * 100 / 5) * 5));
}
