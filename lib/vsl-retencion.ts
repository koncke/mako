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
  return curvaDesdeAvances(avancePorPersona(eventos, duracionS, videoId).values());
}

/**
 * La curva a partir del avance de CADA PERSONA (null = arrancó y no se pudo medir). Es el cuerpo de
 * `curvaRetencion`, separado para que el RESUMEN (`avanceDeResumen`, la función SQL de la mig 0261) dibuje
 * la MISMA curva sin bajar los eventos.
 */
export function curvaDesdeAvances(avancesPorPersona: Iterable<number | null>): Retencion {
  const lista = [...avancesPorPersona];
  const arrancaron = lista.length;
  const avances: number[] = [];
  let sinMedicion = 0;
  for (const av of lista) {
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
  return histogramaDesdeSalidas(porPersona.values());
}

/** El cuerpo de `histogramaAbandono`: de la salida de cada persona (su % de abandono, > 0) a los cortes. */
export function histogramaDesdeSalidas(salidas: Iterable<number>): Array<{ corte: number; salidas: number }> {
  const buckets = new Map<number, number>(CORTES.map((c) => [c, 0]));
  for (const avance of salidas) {
    if (!(avance > 0)) continue;
    const corte = Math.min(100, Math.max(5, Math.ceil(avance / 5) * 5));
    buckets.set(corte, (buckets.get(corte) ?? 0) + 1);
  }
  return CORTES.map((corte) => ({ corte, salidas: buckets.get(corte) ?? 0 }));
}

// =============================================================================
// EL RESUMEN — la retención sin bajar los eventos (contrato v5, 12/10/2026)
// =============================================================================
// La hoja Landing bajaba 48.305 eventos del ws1 (30 días, ~32 MiB, 51 páginas en serie por tramo) DOS
// veces —el conjunto `retencion_vsl` y el bloque de la curva— para terminar en 3.245 personas. El avance
// de una persona es un MÁXIMO, así que se puede resumir en la base: `retencion_vsl_resumen` (mig 0261)
// devuelve una fila por (video, persona, host) con los máximos que `avanceDe` necesita, y
// `avanceDeResumen` termina la cuenta acá con la duración de Panda.
//
// ⚠️ ES UNA SEGUNDA ESCRITURA DE `avanceDe`, Y POR ESO VIVE AL LADO Y TIENE TEST DE PARIDAD
// (tests/vsl-retencion-resumen.test.ts): `resumirEventos` es la MISMA cuenta que la función SQL, en TS, y
// el test compara `avancePorPersona` + `histogramaAbandono` contra `resumirEventos` + `avanceDeResumen`
// sobre los mismos eventos. La regex de lo que es un evento del video sale de `ES_EVENTO_DE_VIDEO` y la
// del host de `RE_HOST_DE_URL`: el mismo test exige que la migración las traiga TEXTUALES.
//
// Por qué el host y no la página: la vista previa del constructor (`esPreviewDeEditor`) se decide por el
// host, y esa función vive en TS. Agrupar por host deja que el lector la aplique sin reescribirla en SQL.

/** Una fila del resumen: lo que devuelve la función SQL por (video, persona, host). */
export type ResumenVsl = {
  /** El `video_id` recortado, o '' para los eventos que no dicen de qué video son. */
  video_id: string;
  /** El `visitor_id` recortado; null = sin identidad (no es una persona). */
  visitor_id: string | null;
  /** El host de la página del evento, en minúsculas; null = sin URL. */
  host: string | null;
  /** El % más alto que mandó el navegador (sólo > 0: un 0 no es un avance). */
  max_pct: number | null;
  /** Los segundos más altos de los eventos SIN un % positivo (sólo > 0): se dividen por la duración. */
  max_seg: number | null;
  /** Lo mismo, sólo de los `exit` (el punto exacto de abandono). */
  max_pct_exit: number | null;
  max_seg_exit: number | null;
  /** El primer evento (instante ISO). */
  primera: string | null;
  /** La `landing_url` del primer evento que trae una. */
  url: string | null;
  /** Cuántos eventos dicen cada título del video. */
  titulos: Record<string, number> | null;
};

/** El host de una URL, como lo saca la función SQL (`regexp_match` con la misma regex). */
export const RE_HOST_DE_URL = /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:\/\/)?([^/?#:@]+)/;
export const hostDeUrl = (u: string | null | undefined): string | null => {
  const m = RE_HOST_DE_URL.exec((u ?? '').trim());
  return m ? m[1].toLowerCase() : null;
};

/** Un evento con lo que el resumen agrupa además de lo que mira `avanceDe`. */
export type EventoResumible = EventoVsl & {
  id?: number;
  created_at: string;
  landing_url?: string | null;
  vsl_titulo?: string | null;
  prueba?: string | null;
};

const aNumero = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const max = (a: number | null, b: number | null): number | null => (a == null ? b : b == null ? a : Math.max(a, b));

/**
 * La función SQL, en TS (mig 0261): de los eventos YA recortados al período, una fila por (video, persona,
 * host) con los máximos. Saca lo mismo que la base: lo que no es del video (`esEventoDeVideo`) y las
 * pruebas (`prueba` no vacío). La vista previa del constructor NO: eso lo decide el lector por el host.
 * La usan el test de paridad y el respaldo del lector cuando la función todavía no está en la base.
 */
export function resumirEventos(eventos: readonly EventoResumible[]): ResumenVsl[] {
  const grupos = new Map<string, ResumenVsl & { _orden: string | null; _id: number }>();
  for (const e of eventos) {
    if (!esEventoDeVideo(e.tipo_evento)) continue;
    if (e.prueba) continue;
    const video = (e.video_id ?? '').trim();
    const visitante = (e.visitor_id ?? '').trim() || null;
    const host = hostDeUrl(e.landing_url);
    const k = `${video}\u0000${visitante ?? ''}\u0000${host ?? ''}`;
    let g = grupos.get(k);
    if (!g) {
      g = { video_id: video, visitor_id: visitante, host, max_pct: null, max_seg: null, max_pct_exit: null, max_seg_exit: null, primera: null, url: null, titulos: null, _orden: null, _id: Infinity };
      grupos.set(k, g);
    }
    const pct = aNumero(e.porcentaje);
    const seg = aNumero(e.segundos);
    const conPct = pct != null && pct > 0;
    const exit = e.tipo_evento === 'exit';
    if (conPct) { g.max_pct = max(g.max_pct, pct); if (exit) g.max_pct_exit = max(g.max_pct_exit, pct); }
    else if (seg != null && seg > 0) { g.max_seg = max(g.max_seg, seg); if (exit) g.max_seg_exit = max(g.max_seg_exit, seg); }
    if (!g.primera || e.created_at < g.primera) g.primera = e.created_at;
    // La URL del PRIMER evento que trae una (por instante y, en empate, por id): el `array_agg … order by`.
    const url = (e.landing_url ?? '').trim() ? e.landing_url! : null;
    const id = e.id ?? 0;
    if (url && (g._orden == null || e.created_at < g._orden || (e.created_at === g._orden && id < g._id))) { g.url = url; g._orden = e.created_at; g._id = id; }
    const t = (e.vsl_titulo ?? '').trim();
    if (t) { const tt = (g.titulos ??= {}); tt[t] = (tt[t] ?? 0) + 1; }
  }
  return [...grupos.values()].map(({ _orden: _o, _id: _i, ...r }) => r);
}

/** Un % del resumen, recortado a 0..100 como `avanceDe`; null si no hay. */
const pctDe = (pct: number | null, seg: number | null, duracionS: number | null): number | null => {
  const a = pct != null && pct > 0 ? clampPct(pct) : null;
  const b = seg != null && seg > 0 && duracionS != null && Number.isFinite(duracionS) && duracionS > 0 ? clampPct((seg / duracionS) * 100) : null;
  return max(a, b);
};

/**
 * El avance de una fila del resumen: el MÁXIMO de `avanceDe` sobre sus eventos. Como cada evento usa su % si
 * lo trae positivo y si no sus segundos ÷ la duración, el máximo es el mayor de los dos máximos. null = arrancó
 * y no se pudo medir (no es 0%).
 */
export function avanceDeResumen(r: Pick<ResumenVsl, 'max_pct' | 'max_seg'>, duracionS: number | null): number | null {
  return pctDe(aNumero(r.max_pct), aNumero(r.max_seg), duracionS);
}

/** Lo mismo, de sus `exit`: dónde abandonó (para `histogramaDesdeSalidas`). null = no dejó un exit medible. */
export function salidaDeResumen(r: Pick<ResumenVsl, 'max_pct_exit' | 'max_seg_exit'>, duracionS: number | null): number | null {
  return pctDe(aNumero(r.max_pct_exit), aNumero(r.max_seg_exit), duracionS);
}

/**
 * Las filas de una MISMA persona y video (una por host) juntas, como `avancePorPersona`: el máximo de los
 * avances medidos, o null si ninguno se pudo medir. Las filas sin persona no cuentan (sin identidad no hay a
 * quién deduplicar). Devuelve persona → { avance, salida }.
 */
export function avancesDeResumen(filas: readonly ResumenVsl[], duracionS: number | null): Map<string, { avance: number | null; salida: number | null }> {
  const out = new Map<string, { avance: number | null; salida: number | null }>();
  for (const r of filas) {
    const id = (r.visitor_id ?? '').trim();
    if (!id) continue;
    const previo = out.get(id);
    const avance = avanceDeResumen(r, duracionS);
    const salida = salidaDeResumen(r, duracionS);
    out.set(id, { avance: max(previo?.avance ?? null, avance), salida: max(previo?.salida ?? null, salida) });
  }
  return out;
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
