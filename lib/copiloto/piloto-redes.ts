// =============================================================================
// Marketing CoPilot — el piloto de Instagram y YouTube (14/11/2026): lo que decide el código, PURO (con test)
// =============================================================================
// Martín a Julio (13/11, min 00:51:18): «Instagram: reels por semana, historias, variaciones de hook… YouTube: videos por mes, shorts
// por video…», cada cosa con «hacerlo solo / preguntarme», «para el lunes ya lo voy a tener listo funcionando». Lo que hay de verdad
// (y nada más: un interruptor que no hace nada es peor que no tenerlo, docs/hallazgos-marketing-copilot.md):
//   · CUÁNTO: reels, historias y carruseles por semana; videos largos por mes y shorts por video. Define el ritmo de la nevera y su
//     aviso (./nevera.ts, ./nevera-aviso.ts): gana sobre lo que salió de la entrada.
//   · LO HAGO SOLO: publicar lo que programas (el Calendario por Zernio, como siempre) y avisarte por WhatsApp y email si se acaba el
//     contenido (el aviso `copiloto-nevera`, que este interruptor prende o apaga).
//   · EL REEL DE PRUEBA (Trial Reels, 14/11): los reels de Instagram salen primero sólo a quien no te sigue (Zernio:
//     `trialParams.graduationStrategy`, docs.zernio.com/platforms/instagram/fields). «Lo hago solo» = SS_PERFORMANCE (Instagram lo pasa
//     al feed si le va bien); «Te pregunto» = MANUAL (lo pasas tú desde Instagram). Apagado de fábrica: cambia cómo sale CADA reel.
//   · TE PREGUNTO (una tarea en tu Plan, cada semana): variaciones del hook de tu reel más visto, pasar a carrusel el reel que superó
//     tu número del reel de prueba, sacar shorts de tu video largo. Hacerlas SOLO necesita editar video sin el navegador: no está.
// Se guarda dentro de marketing-copilot.piloto (./piloto.ts), junto al número del reel de prueba.
// =============================================================================

import type { RitmoNevera } from './nevera-reglas';
import type { TareaCoPilot } from './tareas';

export type ReelDePrueba = 'no' | 'solo' | 'pregunta';
export type PilotoInstagram = { reelsSemana: number; historiasSemana: number; carruselesSemana: number; variaciones: number; proponerHook: boolean; proponerCarrusel: boolean; reelDePrueba: ReelDePrueba };

/** Lo que se le manda a Zernio por cada modo del reel de prueba (null = un reel normal). */
export const GRADUACION_DE_PRUEBA: Record<ReelDePrueba, 'SS_PERFORMANCE' | 'MANUAL' | null> = { no: null, solo: 'SS_PERFORMANCE', pregunta: 'MANUAL' };
export type PilotoYoutube = { largosMes: number; shortsPorVideo: number; proponerShorts: boolean };
export type PilotoRedes = { instagram: PilotoInstagram; youtube: PilotoYoutube };

/** Los topes de cada número (lo que se acepta al guardar). */
export const TOPES_PILOTO = {
  reelsSemana: [0, 21], historiasSemana: [0, 21], carruselesSemana: [0, 14], variaciones: [1, 6], largosMes: [0, 12], shortsPorVideo: [0, 8],
} as const;

/** Lo de fábrica, si no hay nada guardado: lo que sale del ritmo de la entrada (o lo de «3 a 5 horas por semana»). */
export function pilotoDeFabrica(ritmo: RitmoNevera | null): PilotoRedes {
  return {
    instagram: { reelsSemana: ritmo?.reel ?? 4, historiasSemana: ritmo?.story ?? 4, carruselesSemana: ritmo?.post ?? 1, variaciones: 3, proponerHook: true, proponerCarrusel: true, reelDePrueba: 'no' },
    youtube: { largosMes: Math.round((ritmo?.video ?? 0.5) * 4) || 2, shortsPorVideo: 3, proponerShorts: true },
  };
}

const entero = (v: unknown, [min, max]: readonly [number, number], porDefecto: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : porDefecto;
};
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});

/** Lo guardado, saneado contra lo de fábrica: lo que falta o no vale, de fábrica. `guardado` = si había algo guardado de cada red. */
export function sanearPilotoRedes(x: unknown, fabrica: PilotoRedes): PilotoRedes & { guardado: { instagram: boolean; youtube: boolean } } {
  const o = obj(x);
  const ig = obj(o.instagram), yt = obj(o.youtube);
  const f = fabrica;
  return {
    instagram: {
      reelsSemana: entero(ig.reelsSemana, TOPES_PILOTO.reelsSemana, f.instagram.reelsSemana),
      historiasSemana: entero(ig.historiasSemana, TOPES_PILOTO.historiasSemana, f.instagram.historiasSemana),
      carruselesSemana: entero(ig.carruselesSemana, TOPES_PILOTO.carruselesSemana, f.instagram.carruselesSemana),
      variaciones: entero(ig.variaciones, TOPES_PILOTO.variaciones, f.instagram.variaciones),
      proponerHook: typeof ig.proponerHook === 'boolean' ? ig.proponerHook : f.instagram.proponerHook,
      proponerCarrusel: typeof ig.proponerCarrusel === 'boolean' ? ig.proponerCarrusel : f.instagram.proponerCarrusel,
      reelDePrueba: ig.reelDePrueba === 'solo' || ig.reelDePrueba === 'pregunta' || ig.reelDePrueba === 'no' ? ig.reelDePrueba : f.instagram.reelDePrueba,
    },
    youtube: {
      largosMes: entero(yt.largosMes, TOPES_PILOTO.largosMes, f.youtube.largosMes),
      shortsPorVideo: entero(yt.shortsPorVideo, TOPES_PILOTO.shortsPorVideo, f.youtube.shortsPorVideo),
      proponerShorts: typeof yt.proponerShorts === 'boolean' ? yt.proponerShorts : f.youtube.proponerShorts,
    },
    guardado: { instagram: Object.keys(ig).length > 0, youtube: Object.keys(yt).length > 0 },
  };
}

/**
 * El ritmo de la nevera con lo que configuró en el piloto: cada red guardada pisa la del perfil; la que no guardó, queda como venía.
 * Los videos largos van al mes en el piloto y a la semana en la nevera (redondeado hacia arriba: 1 al mes avisa igual).
 */
export function ritmoConElPiloto(base: RitmoNevera | null, p: PilotoRedes & { guardado: { instagram: boolean; youtube: boolean } }): RitmoNevera | null {
  const r: RitmoNevera = { ...(base ?? {}) };
  if (p.guardado.instagram) Object.assign(r, { reel: p.instagram.reelsSemana, story: p.instagram.historiasSemana, post: p.instagram.carruselesSemana });
  if (p.guardado.youtube) r.video = Math.ceil(p.youtube.largosMes / 4);
  for (const k of Object.keys(r) as Array<keyof RitmoNevera>) if (!r[k]) delete r[k];
  return Object.keys(r).length ? r : null;
}

/** Lo que el piloto ve esta semana para proponer (lo lee la página de lo que ya trae: la cuenta propia y la nevera). */
export type VistoParaProponer = {
  /** YYYY-MM-DD del lunes de esta semana: la clave de las tareas semanales. */
  lunes: string;
  /** El reel con más vistas de los últimos 30 días (de la cuenta propia), si se pudo leer. */
  reelTop: { vistas: number; url: string | null } | null;
  /** Con cuántas vistas se publica un reel de prueba (./piloto.ts): el que lo supera, a carrusel. */
  numeroReel: number | null;
  /** Videos largos publicados en los últimos 30 días (la nevera). */
  largosPublicados: number;
  instagram: boolean;
  youtube: boolean;
};

/** Las propuestas de la semana como tareas de «Lo que te toca» (y del Plan). Una por cosa y por semana. */
export function propuestasDelPiloto(p: PilotoRedes, v: VistoParaProponer): TareaCoPilot[] {
  const semana = v.lunes.replace(/-/g, '');
  const out: TareaCoPilot[] = [];
  if (v.instagram && p.instagram.proponerHook && v.reelTop) {
    out.push({ clave: `instagram:hook-${semana}`, tarjeta: 'instagram', titulo: `Graba ${p.instagram.variaciones} variaciones del hook de tu reel más visto (${v.reelTop.vistas.toLocaleString('es')} vistas)`, href: '/copywriter' });
  }
  if (v.instagram && p.instagram.proponerCarrusel && v.reelTop && v.numeroReel != null && v.reelTop.vistas >= v.numeroReel) {
    out.push({ clave: `instagram:a-carrusel-${semana}`, tarjeta: 'instagram', titulo: `Pasa a carrusel tu reel de ${v.reelTop.vistas.toLocaleString('es')} vistas: superó tu número`, href: '/image-editor' });
  }
  if (v.youtube && p.youtube.proponerShorts && p.youtube.shortsPorVideo > 0 && v.largosPublicados > 0) {
    out.push({ clave: `youtube:shorts-${semana}`, tarjeta: 'youtube', titulo: `Saca ${p.youtube.shortsPorVideo} shorts de tu último video largo`, href: '/video-editor' });
  }
  return out;
}
