// =============================================================================
// landing-retencion — la retención de cada video de UNA landing, minuto a minuto (puro, sin IO)
// =============================================================================
// Ticket #74 / #69 (Mauricio, 9-10/11/2026): «la retención del video por minuto, atribuida específicamente al video
// de esta landing». Los eventos ya estaban (vsl_events: play, pausa, retoma, fin, exit, sNN y pNN, con `segundos` y
// `video_id`), y la curva de 5 % en 5 % ya existía (lib/vsl-retencion.ts, la del VSL Analyst): faltaba pedirla por la
// API, por landing y por video, y en MINUTOS.
//
// Las reglas (las de lib/vsl-retencion.ts, que esto hereda):
//   · una persona es un `visitor_id`; sin él no hay a quién deduplicar y el evento se descarta;
//   · el punto más lejano de cada persona es el mayor `segundos` de sus eventos de VIDEO (nunca `salio`, `volvio` o
//     `cierre`, que traen segundos de PÁGINA) — `fin` cuenta como el final;
//   · el denominador son los MEDIDOS (avance > 0), no los que arrancaron: quien dio play y no dejó avance puede ser un
//     agujero de medición. Se reportan aparte, y sin medidos no hay curva (null, jamás una fila de ceros);
//   · cada video por separado: un evento de otro video nunca entra en esta curva.
// Y la de esta: el autoplay. Un video que arranca solo (`auto`) no es alguien que quiso verlo, así que va una curva
// con TODOS y otra sólo con los que le dieron play ellos.
// =============================================================================

import { curvaDesdeAvances, duracionesDeEventos, esEventoDeVideo, type PuntoCurva } from './vsl-retencion';

/** Una fila de vsl_events, con lo que la retención necesita. */
export type EventoRetencion = {
  visitor_id: string | null;
  video_id: string | null;
  vsl_titulo?: string | null;
  tipo_evento: string | null;
  porcentaje: number | null;
  segundos: number | null;
  auto?: boolean | null;
};

export type MinutoRetencion = {
  /** 0, 1, 2… (el último es el final del video, si no cae justo en un minuto). */
  minuto: number;
  /** El segundo del video al que corresponde. */
  segundo: number;
  /** Personas distintas que llegaron por lo menos hasta acá. */
  personas: number;
  /** % de los medidos. */
  porcentaje: number;
};

export type CurvaDeUnGrupo = {
  /** Personas con algún evento de este video. */
  arrancaron: number;
  /** Personas con avance medido (> 0 s): el denominador. */
  medidos: number;
  /** null = nadie con avance medido: no hay curva, que no es lo mismo que 0 %. */
  por_minuto: MinutoRetencion[] | null;
  /** La misma retención en cortes de 5 % (la del VSL Analyst). null igual que arriba. */
  por_porcentaje: Array<{ corte: number; personas: number; porcentaje: number }> | null;
};

export type RetencionDeVideo = {
  video_id: string;
  titulo: string | null;
  /** Segundos, estimada de los eventos (`duracionesDeEventos`); si no se puede, el punto más lejano visto. */
  duracion_segundos: number | null;
  todos: CurvaDeUnGrupo;
  /** Sólo los que le dieron play ellos (un play que no arrancó solo). */
  dieron_play: CurvaDeUnGrupo;
  /** Personas cuyo video sólo arrancó solo (autoplay) y nunca le dieron play. */
  solo_autoplay: number;
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * El período de una lectura, en UTC: `desde`/`hasta` (YYYY-MM-DD, los dos inclusive) si vienen, si no `dias` hacia atrás
 * (30 por defecto). `hasta` devuelto es EXCLUSIVO (el día siguiente a las 00:00), para consultar con `lt`.
 */
export function periodoDeFechas(o: { dias?: number | null; desde?: string | null; hasta?: string | null }, ahoraMs: number): { desde: string; hasta: string } | { error: string } {
  const d = o.desde?.trim() || null;
  const h = o.hasta?.trim() || null;
  if (!d && !h) {
    const dias = Math.max(1, Math.min(365, Math.round(o.dias ?? 30)));
    return { desde: new Date(ahoraMs - dias * 86_400_000).toISOString(), hasta: new Date(ahoraMs + 60_000).toISOString() };
  }
  for (const [k, v] of [['desde', d], ['hasta', h]] as const) {
    if (v && (!FECHA.test(v) || !Number.isFinite(Date.parse(`${v}T00:00:00Z`)))) return { error: `«${k}» va como YYYY-MM-DD (por ejemplo 2026-11-01).` };
  }
  const hastaMs = h ? Date.parse(`${h}T00:00:00Z`) + 86_400_000 : ahoraMs + 60_000;
  const desdeMs = d ? Date.parse(`${d}T00:00:00Z`) : hastaMs - 30 * 86_400_000;
  if (desdeMs >= hastaMs) return { error: '«desde» tiene que ser anterior o igual a «hasta».' };
  if (hastaMs - desdeMs > 366 * 86_400_000) return { error: 'El período va hasta 365 días.' };
  return { desde: new Date(desdeMs).toISOString(), hasta: new Date(hastaMs).toISOString() };
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** El punto más lejano (en segundos) de un evento de video, o null si no lo dice. */
function segundoDe(ev: EventoRetencion, duracion: number | null): number | null {
  const s = num(ev.segundos);
  if (s !== null && s > 0) return s;
  const p = num(ev.porcentaje);
  if (p !== null && p > 0 && duracion) return Math.min(duracion, (p * duracion) / 100);
  if (ev.tipo_evento === 'fin' && duracion) return duracion;
  return null;
}

/** La curva minuto a minuto de un grupo de personas (su punto más lejano en segundos; null = sin avance medido). */
export function curvaPorMinuto(lejanos: Iterable<number | null>, duracion: number | null): CurvaDeUnGrupo {
  const lista = [...lejanos];
  const medidos = lista.filter((s): s is number => s !== null && s > 0);
  const base: CurvaDeUnGrupo = { arrancaron: lista.length, medidos: medidos.length, por_minuto: null, por_porcentaje: null };
  if (!medidos.length) return base;
  const fin = duracion && duracion > 0 ? duracion : Math.max(...medidos);
  const marcas: number[] = [];
  for (let m = 0; m * 60 < fin; m++) marcas.push(m * 60);
  marcas.push(Math.round(fin * 10) / 10);
  const pct = (n: number) => Math.round((n / medidos.length) * 1000) / 10;
  const por_minuto = marcas.map((segundo, i) => {
    // Minuto 0 = todos los medidos. El final se cuenta con medio segundo de gracia: el reproductor rara vez avisa en el
    // último cuadro.
    const personas = i === 0 ? medidos.length : medidos.filter((s) => s >= (i === marcas.length - 1 ? segundo - 0.5 : segundo)).length;
    return { minuto: i === marcas.length - 1 ? Math.round((segundo / 60) * 100) / 100 : i, segundo, personas, porcentaje: pct(personas) };
  });
  let por_porcentaje: CurvaDeUnGrupo['por_porcentaje'] = null;
  if (duracion && duracion > 0) {
    const r = curvaDesdeAvances(lista.map((s) => (s === null ? null : Math.min(100, (s / duracion) * 100))));
    por_porcentaje = r.hayDatos ? r.curva.map((p: PuntoCurva) => ({ corte: p.corte, personas: p.vivos, porcentaje: p.pct })) : null;
  }
  return { ...base, por_minuto, por_porcentaje };
}

/**
 * La retención de cada video, a partir de los eventos YA filtrados a la landing y al período. Los videos, del que más
 * personas arrancaron al que menos.
 */
export function retencionPorVideo(eventos: readonly EventoRetencion[]): RetencionDeVideo[] {
  const deVideo = eventos.filter((e) => esEventoDeVideo(e.tipo_evento) && (e.video_id ?? '').trim() && (e.visitor_id ?? '').trim());
  const duraciones = duracionesDeEventos(deVideo);
  const porVideo = new Map<string, EventoRetencion[]>();
  for (const e of deVideo) {
    const id = String(e.video_id).trim();
    const lista = porVideo.get(id) ?? [];
    lista.push(e);
    porVideo.set(id, lista);
  }
  const out: RetencionDeVideo[] = [];
  for (const [video_id, evs] of porVideo) {
    const titulos = new Map<string, number>();
    for (const e of evs) if (e.vsl_titulo?.trim()) titulos.set(e.vsl_titulo.trim(), (titulos.get(e.vsl_titulo.trim()) ?? 0) + 1);
    const titulo = [...titulos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    let duracion = duraciones.get(video_id) ?? null;
    const lejano = new Map<string, number | null>();
    const darPlay = new Set<string>();
    const conPlay = new Set<string>();
    for (const e of evs) {
      const quien = String(e.visitor_id).trim();
      if (e.tipo_evento === 'play') { conPlay.add(quien); if (e.auto !== true) darPlay.add(quien); }
      const s = segundoDe(e, duracion);
      const antes = lejano.get(quien);
      if (antes === undefined) lejano.set(quien, s);
      else if (s !== null && (antes === null || s > antes)) lejano.set(quien, s);
    }
    if (duracion === null) {
      const vistos = [...lejano.values()].filter((s): s is number => s !== null);
      duracion = vistos.length ? Math.max(...vistos) : null;
    }
    const todos = curvaPorMinuto(lejano.values(), duracion);
    const dieron_play = curvaPorMinuto([...lejano.entries()].filter(([q]) => darPlay.has(q)).map(([, s]) => s), duracion);
    const solo_autoplay = [...conPlay].filter((q) => !darPlay.has(q)).length;
    out.push({ video_id, titulo, duracion_segundos: duracion, todos, dieron_play, solo_autoplay });
  }
  return out.sort((a, b) => b.todos.arrancaron - a.todos.arrancaron);
}
