// =============================================================================
// multiplo-rendimiento — el «3,7×» de cada pieza: cuántas veces lo que suele hacer su cuenta (5/11/2026)
// =============================================================================
// Martín, 5/11: en Top Carousels cada carrusel lleva un botón «3.7×» o «1.4×», igual que en vidIQ, y lo quiere en
// Competitors Spy y en Carruseles de Image, con reels, carruseles, videos de YouTube y anuncios. ES LA ÚNICA CUENTA de ese
// número en MaKo: la usan «Lo que mejor le fue», el detalle de una pieza, las tarjetas y el orden de Spy, el explorador y la
// biblioteca de carruseles, y la API (imagen.run, spy.run). Antes había dos (`vecesSuMediana` y `mejoresPiezas`, contra la
// mediana de TODA la cuenta y con 3 piezas): se borraron.
//
// LA FÓRMULA es la que Top Carousels publica en su texto para agentes (llms.txt); no se tocó su sitio ni su biblioteca:
//   · lo que hizo la pieza ÷ la mediana de HASTA 20 piezas del mismo creador y del mismo formato, las publicadas más cerca
//     en el tiempo (no la mediana de toda la cuenta: una cuenta que creció se compara con su momento);
//   · hacen falta AL MENOS 7 para comparar; con menos no hay número (`pocas`), nunca uno inventado;
//   · no entran en la comparación —ni como pieza medida ni como referencia— la publicidad pagada, los sorteos, lo que tiene
//     los comentarios apagados y lo publicado hace menos de una semana (sus números todavía crecen).
//
// QUÉ SE MIDE POR FORMATO (y cada formato se compara sólo con el suyo, en su misma red):
//   · carruseles e imágenes de Instagram: me gusta + comentarios (juntos, como en Spy: «Carruseles e imágenes»);
//   · reels, shorts y videos de YouTube: vistas. Cortos (reel, short) y largos no se mezclan, y un reel no se compara con
//     un short (otra red, otra forma de contar);
//   · anuncios: Meta NO da los resultados de los anuncios de otro, así que no se inventa un rendimiento: se usan los días
//     que lleva activo frente a la mediana de ese anunciante, con su propio rótulo («3× activo») y diciendo que es una
//     señal, no un resultado. Un anuncio pegado sin fecha de inicio no tiene número.
//
// ⚠️ YOUTUBE ESPERA SU TRÁMITE: los Developer Policies (III.E.4.h) prohíben «a score that factors in likes, total views»
// salvo con la enmienda III.L (`ENMIENDA_III_L`, lib/spy-reglas.ts). Mientras sea `false`, un video de YouTube contesta
// `falta-enmienda` (y su texto lo dice); el día que se prenda, sale solo, con `LEYENDA_DERIVADA` al lado. Antes de este
// módulo «Lo que mejor le fue» sí lo calculaba para YouTube, sin mirar el interruptor.
//
// ⚠️ LO QUE NO SE PUEDE SABER, Y CÓMO SE DECIDE:
//   · «Pagada» y «sorteo» salen del TEXTO (#ad, «colaboración pagada», «sorteo», «giveaway»…), o de `pagada` si la fuente
//     lo dijo. Spy borra el texto a los 30 días: una pieza vieja sin texto no se puede revisar, y entra.
//   · «Comentarios apagados»: ninguna fuente lo dice como dato. Una pieza cuyos comentarios no se ven (`comentarios`
//     null: YouTube omite el contador cuando están apagados, y Apify manda -1 cuando se ocultan) no se compara. Si una
//     fuente lo dijera, va en `comentariosApagados`.
//
// Puro (sin `server-only`): lo usan el servidor, la pantalla, la API y los tests. Rápido (cada pieza mira sus 20 vecinas en
// una lista ya ordenada), así que no se guarda: se calcula al mostrar.
// =============================================================================

import { dibujarContador, ENMIENDA_III_L, FALTA_LA_ENMIENDA, LEYENDA_DERIVADA } from './spy-reglas';
import { tipoDeContenido } from './spy-vista';

/** Cuántas piezas suyas hacen falta para comparar (sin contar la que se mide). */
export const MINIMO_PARA_COMPARAR = 7;
/** Cuántas, como mucho, entran en su mediana: las publicadas más cerca en el tiempo. */
export const MAXIMO_PARA_COMPARAR = 20;
/** Lo publicado hace menos que esto no se compara (ni se mide ni sirve de referencia): sus números todavía crecen. */
export const DIAS_PARA_COMPARAR = 7;
/** Desde cuánto se resalta («lo fuerte»): el doble de lo que suele hacer su cuenta. */
export const MULTIPLO_FUERTE = 2;

const DIA = 86_400_000;

/** El formato de una pieza para compararla: cada uno sólo con el suyo. */
export type FormatoMultiplo = 'imagenes' | 'corto' | 'largo' | 'anuncio';
/** Qué número se compara: me gusta + comentarios, vistas, o (un anuncio) los días que lleva activo. */
export type MetricaMultiplo = 'interaccion' | 'vistas' | 'dias';

/** Por qué una pieza no tiene número. Cada motivo tiene su frase (`explicarMultiplo`). */
export type MotivoSinMultiplo =
  | 'pocas' | 'reciente' | 'pagada' | 'sorteo' | 'sin-comentarios' | 'sin-numero' | 'sin-fecha' | 'mediana-cero'
  | 'falta-enmienda' | 'sin-cuenta' | 'sin-formato';

export type Multiplo =
  | {
    veces: number; formato: FormatoMultiplo; metrica: MetricaMultiplo; canal: string;
    /** Lo que hizo ella, la mediana de sus vecinas y cuántas vecinas entraron (de 7 a 20). */
    valor: number; mediana: number; comparadas: number;
  }
  | { veces: null; motivo: MotivoSinMultiplo; formato: FormatoMultiplo | null; canal: string; comparadas: number };

/** Lo que hace falta de una pieza (Spy: `spy_piezas`; la biblioteca de carruseles, con la misma forma). */
export type PiezaParaMultiplo = {
  id: number;
  /** De quién es: el competidor en Spy, o la cuenta de la biblioteca (en negativo). */
  competidor_id: number;
  canal: string;
  tipo: string;
  duracion?: string | null;
  medio?: string | null;
  publicada_en: string | null;
  /** Un anuncio: cuándo dejó de verse (su fin). Lo orgánico que dejó de verse sigue sirviendo de referencia. */
  dejo_de_verse_en?: string | null;
  vistas: number | null;
  megusta: number | null;
  comentarios: number | null;
  titulo?: string | null;
  texto?: string | null;
  /** Si la fuente dijo que es publicidad pagada o que tiene los comentarios apagados (hoy ninguna lo dice). */
  pagada?: boolean | null;
  comentariosApagados?: boolean | null;
};

/** El formato para comparar. Una web (o cualquier otra cosa) no tiene. */
export function formatoDeMultiplo(p: Pick<PiezaParaMultiplo, 'canal' | 'tipo' | 'duracion' | 'medio'>): FormatoMultiplo | null {
  if (p.canal === 'anuncios') return 'anuncio';
  if (p.canal === 'instagram') return p.tipo === 'reel' || p.medio === 'video' ? 'corto' : 'imagenes';
  if (p.canal === 'youtube') return tipoDeContenido({ canal: 'youtube', tipo: p.tipo as never, duracion: p.duracion ?? null }) === 'shorts' ? 'corto' : 'largo';
  return null;
}

export const metricaDeFormato = (f: FormatoMultiplo): MetricaMultiplo => (f === 'imagenes' ? 'interaccion' : f === 'anuncio' ? 'dias' : 'vistas');

const plano = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// Los límites van por Unicode (AGENTS.md: `\b` es ASCII). `#ad` y `#publi` sólo como hashtag ENTERO: «#adultos» o «#publicidad»
// (que en marketing es un tema) no cuentan.
const PAGADA = /(?<![\p{L}\p{N}_])(?:#ad|#ads|#sponsored|#patrocinado|#publi|#colaboracionpagada|#paidpartnership)(?![\p{L}\p{N}_])|colaboracion pagada|paid partnership|publicidad pagada|contenido patrocinado/u;
const SORTEO = /(?<![\p{L}\p{N}])(?:sorteos?|sorteamos|giveaways?|concursos?)(?![\p{L}\p{N}])/u;

/** ¿Es publicidad pagada? Lo dice la fuente, o su texto (#ad, «colaboración pagada»). */
export const esPagada = (p: Pick<PiezaParaMultiplo, 'pagada' | 'titulo' | 'texto'>): boolean =>
  p.pagada === true || PAGADA.test(plano(`${p.titulo ?? ''}\n${p.texto ?? ''}`));
/** ¿Es un sorteo? Lo dice su texto («sorteo», «giveaway», «concurso»). */
export const esSorteo = (p: Pick<PiezaParaMultiplo, 'titulo' | 'texto'>): boolean => SORTEO.test(plano(`${p.titulo ?? ''}\n${p.texto ?? ''}`));

/** El número de una pieza en su métrica, o null si no lo tiene. */
function valorDe(p: PiezaParaMultiplo, f: FormatoMultiplo, ahora: number): number | null {
  if (f === 'anuncio') {
    const desde = Date.parse(p.publicada_en ?? '');
    if (!Number.isFinite(desde)) return null;
    const fin = p.dejo_de_verse_en ? Date.parse(p.dejo_de_verse_en) : ahora;
    return Math.max(1, Math.round(((Number.isFinite(fin) ? fin : ahora) - desde) / DIA));
  }
  if (f === 'imagenes') return p.megusta != null && p.megusta >= 0 && p.comentarios != null && p.comentarios >= 0 ? p.megusta + p.comentarios : null;
  return p.vistas != null && p.vistas >= 0 ? p.vistas : null;
}

/** Por qué no se compara (o null: se compara). Lo mismo para la pieza medida y para sus referencias. */
function noSeCompara(p: PiezaParaMultiplo, f: FormatoMultiplo, t: number, ahora: number, conYouTube: boolean): MotivoSinMultiplo | null {
  if (p.canal === 'youtube' && !conYouTube) return 'falta-enmienda';
  if (f !== 'anuncio' && esPagada(p)) return 'pagada';
  if (f !== 'anuncio' && esSorteo(p)) return 'sorteo';
  if (!Number.isFinite(t)) return 'sin-fecha';
  if (ahora - t < DIAS_PARA_COMPARAR * DIA) return 'reciente';
  if (f !== 'anuncio' && (p.comentariosApagados === true)) return 'sin-comentarios';
  // En imágenes, el número ES me gusta + comentarios: sin los comentarios no hay número, y se dice por qué.
  if (f !== 'anuncio' && p.comentarios == null && (f === 'imagenes' ? p.megusta != null : p.vistas != null)) return 'sin-comentarios';
  if (valorDe(p, f, ahora) == null) return 'sin-numero';
  return null;
}

/**
 * El número de UNA pieza tal como entra en una comparación, con las mismas reglas que el múltiplo (sin lo de menos de una
 * semana, lo pago, los sorteos, YouTube sin su trámite), o el motivo por el que no entra. Lo usa el número de los competidores
 * seguidos (lib/spy-seguidos-reglas.ts): así «lo que suele hacer una cuenta» se mide igual en toda la app.
 */
export function numeroParaComparar(
  p: PiezaParaMultiplo,
  ahora: number = Date.now(),
  o: { conYouTube?: boolean } = {},
): { formato: FormatoMultiplo; valor: number; t: number } | { formato: FormatoMultiplo | null; motivo: MotivoSinMultiplo } {
  const f = formatoDeMultiplo(p);
  if (!f) return { formato: null, motivo: 'sin-formato' };
  const t = Date.parse(p.publicada_en ?? '');
  const motivo = noSeCompara(p, f, t, ahora, o.conYouTube ?? ENMIENDA_III_L);
  if (motivo) return { formato: f, motivo };
  return { formato: f, valor: valorDe(p, f, ahora) as number, t };
}

export const mediana = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Hasta `k` vecinas de la posición `i` en una lista ordenada por fecha: las más cercanas en el tiempo, sin ella. */
function vecinasDe<T extends { t: number }>(orden: readonly T[], i: number, k: number): T[] {
  const out: T[] = [];
  let izq = i - 1;
  let der = i + 1;
  while (out.length < k && (izq >= 0 || der < orden.length)) {
    const di = izq >= 0 ? orden[i].t - orden[izq].t : Infinity;
    const dd = der < orden.length ? orden[der].t - orden[i].t : Infinity;
    if (di <= dd) { out.push(orden[izq]); izq -= 1; } else { out.push(orden[der]); der += 1; }
  }
  return out;
}

/**
 * El múltiplo de cada pieza: un `Multiplo` por id, con número o con su motivo. Se agrupan por cuenta, red y formato; en cada
 * grupo, las piezas que se comparan se ordenan por fecha y cada una mira sus vecinas.
 */
export function multiplosDe(
  piezas: readonly PiezaParaMultiplo[],
  ahora: number = Date.now(),
  // ⚠️ SÓLO PARA LOS TESTS: medir cómo se comporta YouTube el día que se acepte la enmienda. La app nunca lo pasa (lo vigila
  // tests/multiplo-rendimiento.test.ts): el interruptor es `ENMIENDA_III_L`, un acuerdo firmado, no una opción.
  o: { conYouTube?: boolean } = {},
): Map<number, Multiplo> {
  const conYouTube = o.conYouTube ?? ENMIENDA_III_L;
  const out = new Map<number, Multiplo>();
  const grupos = new Map<string, Array<{ p: PiezaParaMultiplo; t: number; v: number }>>();
  const formatos = new Map<number, FormatoMultiplo>();
  for (const p of piezas) {
    const f = formatoDeMultiplo(p);
    if (!f) { out.set(p.id, { veces: null, motivo: 'sin-formato', formato: null, canal: p.canal, comparadas: 0 }); continue; }
    formatos.set(p.id, f);
    const t = Date.parse(p.publicada_en ?? '');
    const motivo = noSeCompara(p, f, t, ahora, conYouTube);
    if (motivo) { out.set(p.id, { veces: null, motivo, formato: f, canal: p.canal, comparadas: 0 }); continue; }
    const clave = `${p.competidor_id}|${p.canal}|${f}`;
    const g = grupos.get(clave);
    const x = { p, t, v: valorDe(p, f, ahora) as number };
    if (g) g.push(x); else grupos.set(clave, [x]);
  }
  for (const g of grupos.values()) {
    const orden = [...g].sort((a, b) => a.t - b.t || a.p.id - b.p.id);
    orden.forEach((x, i) => {
      const f = formatos.get(x.p.id) as FormatoMultiplo;
      const vecinas = vecinasDe(orden, i, MAXIMO_PARA_COMPARAR);
      const base = { formato: f, canal: x.p.canal, comparadas: vecinas.length };
      if (vecinas.length < MINIMO_PARA_COMPARAR) { out.set(x.p.id, { veces: null, motivo: 'pocas', ...base }); return; }
      const med = mediana(vecinas.map((y) => y.v));
      if (!(med > 0)) { out.set(x.p.id, { veces: null, motivo: 'mediana-cero', ...base }); return; }
      out.set(x.p.id, { veces: Math.round((x.v / med) * 10) / 10, metrica: metricaDeFormato(f), valor: x.v, mediana: med, ...base });
    });
  }
  return out;
}

/** Sin número porque no se leyó su cuenta (un carrusel que llegó por un tema de la biblioteca). */
export const sinCuenta = (canal = 'instagram'): Multiplo => ({ veces: null, motivo: 'sin-cuenta', formato: 'imagenes', canal, comparadas: 0 });

// ─────────────────────────────────────────────────────────────────────────────
// Cómo se dice
// ─────────────────────────────────────────────────────────────────────────────

/** «3,7×»: el número como se lee. */
export const rotuloMultiplo = (veces: number): string => `${String(Math.round(veces * 10) / 10).replace('.', ',')}×`;

/** Lo que dice el chip: «3,7×», o en un anuncio «3,7× activo» (no es un resultado). null sin número. */
export function chipDeMultiplo(m: Multiplo | null | undefined): string | null {
  if (!m || m.veces == null) return null;
  return m.formato === 'anuncio' ? `${rotuloMultiplo(m.veces)} activo` : rotuloMultiplo(m.veces);
}

/** ¿Se resalta? Desde el doble de lo que suele hacer su cuenta. */
export const esFuerte = (m: Multiplo | null | undefined): boolean => !!m && m.veces != null && m.veces >= MULTIPLO_FUERTE;

const NOMBRE_FORMATO: Record<FormatoMultiplo, string> = { imagenes: 'publicaciones', corto: 'videos cortos', largo: 'videos', anuncio: 'anuncios' };
/** «suyas» y «cercanas» con publicaciones; «suyos» y «cercanos» con videos y anuncios. */
const FEMENINO: Record<FormatoMultiplo, boolean> = { imagenes: true, corto: false, largo: false, anuncio: false };
const veces = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');
const cifra = (v: number) => dibujarContador(Math.round(v));

/** Lo corto, para una fila o el detalle: «3,7×», «Sin datos suficientes», «Menos de una semana»… */
export function rotuloCortoDeMultiplo(m: Multiplo | null | undefined): string {
  if (!m) return 'Sin datos suficientes';
  if (m.veces != null) return chipDeMultiplo(m) as string;
  const CORTO: Record<MotivoSinMultiplo, string> = {
    pocas: 'Sin datos suficientes', reciente: 'Menos de una semana', pagada: 'Publicidad pagada', sorteo: 'Sorteo',
    'sin-comentarios': 'Sin comentarios a la vista', 'sin-numero': 'Sin el número', 'sin-fecha': 'Sin fecha', 'mediana-cero': 'Sin datos suficientes',
    'falta-enmienda': 'Falta un trámite con YouTube', 'sin-cuenta': 'Sin datos de su cuenta', 'sin-formato': 'Sin datos suficientes',
  };
  return CORTO[m.motivo];
}

/** La explicación del chip (el tooltip y lo que dice MaKo): de qué mediana sale, o por qué no hay número. */
export function explicarMultiplo(m: Multiplo | null | undefined): string {
  if (!m) return 'Sin datos suficientes.';
  if (m.veces != null) {
    if (m.formato === 'anuncio') {
      return `Lleva ${veces(m.veces)} veces más tiempo activo que un anuncio típico de esta cuenta: ${cifra(m.valor)} días, frente a una mediana de ${cifra(m.mediana)} en ${m.comparadas} anuncios suyos. Es una señal, no un resultado: Meta no da los resultados de los anuncios de otro.`;
    }
    const que = m.metrica === 'vistas' ? 'vistas' : 'me gusta y comentarios';
    const yt = m.canal === 'youtube' ? ` ${LEYENDA_DERIVADA}` : '';
    return `${veces(m.veces)} veces lo que suele hacer esta cuenta: ${cifra(m.valor)} ${que}, frente a una mediana de ${cifra(m.mediana)} en sus ${m.comparadas} ${NOMBRE_FORMATO[m.formato]} más ${FEMENINO[m.formato] ? 'cercanas' : 'cercanos'} en el tiempo.${yt}`;
  }
  switch (m.motivo) {
    case 'pocas': {
      const f = m.formato;
      const cuales = f ? `${NOMBRE_FORMATO[f]} ${FEMENINO[f] ? 'suyas' : 'suyos'}` : 'piezas suyas';
      return `Sin datos suficientes: hacen falta ${MINIMO_PARA_COMPARAR} ${cuales} de más de una semana para comparar${m.comparadas ? ` (hay ${m.comparadas})` : ''}.`;
    }
    case 'reciente': return 'Tiene menos de una semana: sus números todavía crecen, así que todavía no se compara.';
    case 'pagada': return 'Es publicidad pagada: no se compara con lo que publica sin pagar.';
    case 'sorteo': return 'Es un sorteo: sus números no dicen si el contenido funcionó, así que no se compara.';
    case 'sin-comentarios': return 'No se ven sus comentarios (puede tenerlos apagados): no se compara.';
    case 'sin-numero': return 'No publica ese número: no hay con qué comparar.';
    case 'sin-fecha': return 'No se sabe cuándo se publicó: no hay con qué comparar.';
    case 'mediana-cero': return 'Lo típico de esta cuenta es cero: no hay con qué comparar.';
    case 'falta-enmienda': return FALTA_LA_ENMIENDA;
    case 'sin-cuenta': return 'Llegó por un tema: no se leyó su cuenta, así que no hay con qué comparar.';
    default: return 'Sin datos suficientes.';
  }
}
