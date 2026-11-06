// =============================================================================
// editor-video/broll — dónde va el B-roll y dónde cambia el plano (reglas puras, sin IA)
// =============================================================================
// Pedido de Leila (clienta, llamada del 30/10/2026), «al estilo de Submagic»: MaKo propone DÓNDE poner una imagen
// encima del video y QUÉ imagen, y la persona deja o saca cada una. Y los «cambios de plano»: un acercamiento al
// cambiar de frase, para que una cara que habla no sea el mismo cuadro durante un minuto.
//
// El reparto, y es lo que este módulo protege:
//   · DÓNDE lo decide el código, sin IA (`huecosParaBroll`): sobre las frases (los subtítulos, con sus tiempos) arma
//     los huecos posibles, ya separados entre sí y fuera de lo que la persona editó. La IA NUNCA escribe un tiempo:
//     elige entre estos huecos por su número (`eleccionDeIA`), y un número que no está se descarta.
//   · QUÉ imagen: la IA del negocio escribe la búsqueda de cada hueco que elige. Sin IA (o si falla), la búsqueda son
//     las palabras de la frase (`eleccionDeRespaldo`): el B-roll sale igual, más genérico.
//   · Lo que la persona ya editó no se pisa: los tramos `ocupados` (sus imágenes y videos encima del principal, sus
//     capas de efecto) quedan afuera, y las propuestas van a pistas propias (app/video-editor/_opencut/broll).
//   · Los planos (`planosDeLaLinea`) cortan en el borde de una frase, nunca en el medio de una palabra, y alternan
//     abierto / cerrado. El cerrado fuerte va donde se dice algo con peso (un «!», un número, una palabra de venta).
//
// Lo que se tomó de Submagic (submagic.co, «Magic B-Rolls» y «Auto Zoom», 6/11/2026): la imagen sale de lo que se
// DICE en ese momento, el gancho del principio queda con la cara, y el zoom va al ritmo de las frases. Lo demás (el
// ritmo por defecto, los topes) se eligió acá y está escrito abajo con su porqué.
//
// SIN `server-only` y sin el motor del editor: lo usan el navegador (app/video-editor/_opencut/broll) y la ruta
// /api/video-editor/broll (la elección de la IA).
// =============================================================================

import { normalizarClave, palabrasDelTexto, puntajeDePalabra } from './claves';

/** Lo que se dice, con sus tiempos en SEGUNDOS de la línea de tiempo (un subtítulo, o una frase transcripta). */
export type Frase = { texto: string; inicio: number; fin: number };
export type Tramo = { inicio: number; fin: number };

export type Ritmo = 'poco' | 'normal' | 'mucho';
export const RITMOS: readonly Ritmo[] = ['poco', 'normal', 'mucho'];

/**
 * Cada cuánto, como promedio, una imagen; y el aire mínimo entre dos.
 *
 * «normal» es una cada ~9 s: en un reel de 30 s son 3, que es lo que muestran los ejemplos de Submagic. Más seguido,
 * la cara de quien habla —que es lo que vende— casi no se ve.
 */
export const RITMO_BROLL: Readonly<Record<Ritmo, { cadaSeg: number; separacionSeg: number }>> = {
  poco: { cadaSeg: 15, separacionSeg: 8 },
  normal: { cadaSeg: 9, separacionSeg: 4 },
  mucho: { cadaSeg: 6, separacionSeg: 2 },
};

export const TOPES_BROLL = {
  /** Una imagen dura entre esto y `maxSeg`: menos no se llega a ver, más tapa demasiado a quien habla. */
  minSeg: 1.5,
  maxSeg: 4,
  /** Los primeros segundos son el gancho: ahí va la cara. Y el final, el cierre. */
  ganchoSeg: 2,
  finalSeg: 1,
  /** Los huecos que ve la IA (el doble de lo que se pide, para que elija). */
  maxHuecos: 30,
  maxPropuestas: 15,
  busqueda: 60,
  motivo: 140,
  palabrasPorHueco: 3,
} as const;

/** El peso mínimo de una palabra para que una frase tenga algo que mostrar (el de las palabras clave, ./claves.ts). */
export const PUNTAJE_MINIMO_BROLL = 3;

/**
 * Las que pesan como palabra clave pero no tienen imagen: se resaltan en un subtítulo y no se buscan en un banco de
 * fotos. Normalizadas (sin tildes).
 */
const NO_SE_VEN = new Set(
  (
    'importante verdad mentira error errores problema problemas solucion clave urgente ultimo ultima nunca jamas siempre ' +
    'mejor peor unico unica hoy nuevo nueva nuevos nuevas increible cuidado alerta atencion stop ojo facil rapido rapida ' +
    'limitado limitada exclusivo exclusiva gratis gratuito gratuita prohibido secreto secretos garantia garantizado ' +
    'garantizada resultado resultados metodo sistema estrategia realmente literalmente basicamente justamente ' +
    'simplemente totalmente entonces digamos tambien primero segundo tercero ejemplo forma manera momento parte ' +
    // Los números dichos con letras se resaltan (pesan 8 en ./claves.ts), pero no se fotografían; el tiempo, tampoco.
    'dos tres cuatro cinco seis siete ocho nueve diez cien cientos mil millon millones doble triple mitad cero ' +
    'segundos minutos horas dias semana semanas mes meses ano anos vez veces'
  ).split(/\s+/),
);

/**
 * Lo que es un verbo sin lugar a duda (gerundio, imperfecto, pretérito): «llegaba», «tomando», «probaron». Pesan por
 * largo en ./claves.ts y una foto de stock de «llegaba» no existe. Las formas que también son sustantivos («café»,
 * «cafetería») no terminan así.
 */
const ES_VERBO = /(?:ando|iendo|yendo|aba|aban|abas|abamos|aron|ieron|aste|iste)$/;

export type HuecoBroll = {
  /** Su número, en el orden del video (0, 1, 2…): lo único que la IA puede nombrar. */
  i: number;
  inicio: number;
  fin: number;
  frase: string;
  /** Las palabras de la frase que se pueden mostrar, la más fuerte primero (como se dicen, sin signos). */
  palabras: string[];
  puntaje: number;
};

const finito = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const centesima = (n: number) => Math.round(n * 100) / 100;
const pisa = (a: Tramo, b: Tramo) => a.inicio < b.fin && b.inicio < a.fin;

/** Las frases que sirven: con texto y tiempos, en orden. */
export function frasesValidas(frases: readonly Frase[]): Frase[] {
  return frases
    .filter((f) => f && typeof f.texto === 'string' && f.texto.trim() && finito(f.inicio) && finito(f.fin) && f.fin > f.inicio && f.inicio >= 0)
    .map((f) => ({ texto: f.texto.trim(), inicio: f.inicio, fin: f.fin }))
    .sort((a, b) => a.inicio - b.inicio);
}

/** Las palabras de una frase que se pueden mostrar, con su peso (la más fuerte primero). */
export function palabrasVisibles(texto: string): Array<{ palabra: string; puntaje: number }> {
  const palabras = palabrasDelTexto(texto);
  const porNorm = new Map<string, { palabra: string; puntaje: number; orden: number }>();
  palabras.forEach((p, i) => {
    const norm = normalizarClave(p);
    // Un número se resalta, pero no se fotografía.
    if (!norm || /\p{N}/u.test(norm) || NO_SE_VEN.has(norm) || ES_VERBO.test(norm)) return;
    const puntaje = puntajeDePalabra(p, i, palabras, new Set());
    if (puntaje < PUNTAJE_MINIMO_BROLL) return;
    const limpia = p.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    const previa = porNorm.get(norm);
    if (!previa || puntaje > previa.puntaje) porNorm.set(norm, { palabra: limpia, puntaje, orden: previa?.orden ?? i });
  });
  return [...porNorm.values()]
    .sort((a, b) => b.puntaje - a.puntaje || a.orden - b.orden)
    .map(({ palabra, puntaje }) => ({ palabra, puntaje }));
}

/** Cuántas imágenes para este largo y este ritmo (al menos una si hay video para ponerla). */
export function objetivoBroll(duracion: number, ritmo: Ritmo = 'normal'): number {
  const util = duracion - TOPES_BROLL.ganchoSeg - TOPES_BROLL.finalSeg;
  if (!finito(util) || util < TOPES_BROLL.minSeg) return 0;
  const r = RITMO_BROLL[ritmo] ?? RITMO_BROLL.normal;
  return Math.max(1, Math.min(TOPES_BROLL.maxPropuestas, Math.round(util / r.cadaSeg)));
}

/**
 * Los huecos donde puede ir una imagen. Cada uno arranca donde arranca una frase (la imagen acompaña lo que se dice),
 * dura lo que la frase entre `minSeg` y `maxSeg`, y no pisa nada de `ocupados`. Están separados entre sí por el aire
 * del ritmo, así que CUALQUIER subconjunto que elija la IA también lo está. Vuelven hasta el doble del objetivo, los
 * de más peso, en el orden del video y numerados desde 0.
 */
export function huecosParaBroll({
  frases,
  duracion,
  ocupados = [],
  ritmo = 'normal',
}: {
  frases: readonly Frase[];
  duracion: number;
  ocupados?: readonly Tramo[];
  ritmo?: Ritmo;
}): { huecos: HuecoBroll[]; objetivo: number } {
  const objetivo = objetivoBroll(duracion, ritmo);
  if (!objetivo) return { huecos: [], objetivo: 0 };
  const desde = TOPES_BROLL.ganchoSeg;
  const hasta = duracion - TOPES_BROLL.finalSeg;
  const r = RITMO_BROLL[ritmo] ?? RITMO_BROLL.normal;
  const candidatos: Omit<HuecoBroll, 'i'>[] = [];
  for (const f of frasesValidas(frases)) {
    if (f.inicio < desde) continue;
    const fin = Math.min(f.inicio + Math.min(Math.max(f.fin - f.inicio, TOPES_BROLL.minSeg), TOPES_BROLL.maxSeg), hasta);
    if (fin - f.inicio < TOPES_BROLL.minSeg) continue;
    const tramo = { inicio: f.inicio, fin };
    if (ocupados.some((o) => pisa(o, tramo))) continue;
    const visibles = palabrasVisibles(f.texto);
    if (!visibles.length) continue;
    const puntaje = visibles.slice(0, 2).reduce((s, v) => s + v.puntaje, 0);
    candidatos.push({
      inicio: centesima(f.inicio),
      fin: centesima(fin),
      frase: f.texto.slice(0, 200),
      palabras: visibles.slice(0, TOPES_BROLL.palabrasPorHueco).map((v) => v.palabra),
      puntaje,
    });
  }
  // Los de más peso primero, y cada uno sólo si queda a la distancia del ritmo de los ya elegidos.
  const tope = Math.min(TOPES_BROLL.maxHuecos, objetivo * 2);
  const elegidos: Omit<HuecoBroll, 'i'>[] = [];
  const porPeso = [...candidatos].sort((a, b) => b.puntaje - a.puntaje || a.inicio - b.inicio);
  for (const c of porPeso) {
    if (elegidos.length >= tope) break;
    const lejos = elegidos.every((e) => Math.max(c.inicio - e.fin, e.inicio - c.fin) >= r.separacionSeg);
    if (lejos) elegidos.push(c);
  }
  const huecos = elegidos.sort((a, b) => a.inicio - b.inicio).map((h, i) => ({ i, ...h }));
  return { huecos, objetivo: Math.min(objetivo, huecos.length) };
}

// ── Lo que elige la IA ───────────────────────────────────────────────────────

/**
 * Los huecos que llegan del navegador a la ruta, con lo que la IA necesita y nada más (y con sus topes). La ruta no le
 * cree al navegador: lo que no tiene frase o palabras se tira.
 */
export function huecosDelPedido(crudo: unknown): HuecoBroll[] {
  if (!Array.isArray(crudo)) return [];
  const out: HuecoBroll[] = [];
  for (const x of crudo.slice(0, TOPES_BROLL.maxHuecos)) {
    const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
    if (!Number.isInteger(o.i) || (o.i as number) < 0) continue;
    const frase = typeof o.frase === 'string' ? o.frase.trim().slice(0, 200) : '';
    const palabras = Array.isArray(o.palabras)
      ? o.palabras.filter((p): p is string => typeof p === 'string').map((p) => p.slice(0, 40)).slice(0, TOPES_BROLL.palabrasPorHueco)
      : [];
    if (!frase || !palabras.length) continue;
    const inicio = typeof o.inicio === 'number' && Number.isFinite(o.inicio) ? o.inicio : 0;
    const fin = typeof o.fin === 'number' && Number.isFinite(o.fin) ? o.fin : inicio;
    out.push({ i: o.i as number, inicio, fin, frase, palabras, puntaje: typeof o.puntaje === 'number' ? o.puntaje : 0 });
  }
  return out;
}


export type BrollElegido = { hueco: number; busqueda: string; motivo: string };

/**
 * La búsqueda de un hueco sin IA: su palabra más fuerte, sola. Dos palabras sueltas de una frase («cafetería pierdo»)
 * buscan algo que no existe; una («cafetería») trae fotos de eso.
 */
export function busquedaDeRespaldo(h: HuecoBroll): string {
  return (h.palabras[0] ?? '').slice(0, TOPES_BROLL.busqueda);
}

/** Sin IA: los `objetivo` huecos de más peso, con sus palabras como búsqueda. */
export function eleccionDeRespaldo(huecos: readonly HuecoBroll[], objetivo: number): BrollElegido[] {
  return [...huecos]
    .sort((a, b) => b.puntaje - a.puntaje || a.inicio - b.inicio)
    .slice(0, Math.max(0, objetivo))
    .sort((a, b) => a.inicio - b.inicio)
    .map((h) => ({ hueco: h.i, busqueda: busquedaDeRespaldo(h), motivo: '' }))
    .filter((e) => e.busqueda);
}

/** Una búsqueda que se puede mandar a un banco de fotos: texto corto, sin direcciones ni comillas. */
export function busquedaValida(crudo: unknown): string | null {
  if (typeof crudo !== 'string') return null;
  const t = crudo.replace(/["«»“”]/g, '').replace(/\s+/g, ' ').trim();
  if (t.length < 2 || t.length > TOPES_BROLL.busqueda) return null;
  if (/https?:|www\.|[<>{}\\]/i.test(t)) return null;
  return t;
}

/**
 * Lo que devolvió la IA, validado contra los huecos que se le dieron: `{"broll":[{"hueco":3,"busqueda":"…","motivo":"…"}]}`.
 * Un número que no está, una búsqueda vacía o con una dirección, y el mismo hueco dos veces se descartan con su motivo;
 * más de `objetivo` se cortan. Vacío = que use el respaldo quien llama (la IA no eligió nada que sirva).
 */
export function eleccionDeIA(
  huecos: readonly HuecoBroll[],
  crudo: unknown,
  objetivo: number,
): { elegidos: BrollElegido[]; descartes: string[] } {
  const descartes: string[] = [];
  const lista = crudo && typeof crudo === 'object' ? (crudo as { broll?: unknown }).broll : undefined;
  if (!Array.isArray(lista)) return { elegidos: [], descartes: ['la respuesta no trae "broll"'] };
  const validos = new Set(huecos.map((h) => h.i));
  const vistos = new Set<number>();
  const busquedas = new Set<string>();
  const elegidos: BrollElegido[] = [];
  for (const item of lista) {
    const o = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const n = typeof o.hueco === 'number' ? o.hueco : typeof o.hueco === 'string' && /^\d+$/.test(o.hueco) ? Number(o.hueco) : NaN;
    if (!Number.isInteger(n) || !validos.has(n)) { descartes.push(`hueco inexistente (${String(o.hueco)})`); continue; }
    if (vistos.has(n)) { descartes.push(`hueco ${n} repetido`); continue; }
    const busqueda = busquedaValida(o.busqueda);
    if (!busqueda) { descartes.push(`hueco ${n}: búsqueda inválida`); continue; }
    if (busquedas.has(busqueda.toLowerCase())) { descartes.push(`hueco ${n}: búsqueda repetida`); continue; }
    if (elegidos.length >= objetivo) { descartes.push(`hueco ${n}: pasa del objetivo`); continue; }
    vistos.add(n);
    busquedas.add(busqueda.toLowerCase());
    const motivo = typeof o.motivo === 'string' ? o.motivo.replace(/\s+/g, ' ').trim().slice(0, TOPES_BROLL.motivo) : '';
    elegidos.push({ hueco: n, busqueda, motivo });
  }
  elegidos.sort((a, b) => a.hueco - b.hueco);
  return { elegidos, descartes };
}

// ── Los cambios de plano ─────────────────────────────────────────────────────

export type Zoom = 'suave' | 'fuerte';
export type PlanoPropuesto = Tramo & { zoom: Zoom };

export const TOPES_PLANOS = {
  /** Un plano dura al menos esto (se juntan frases hasta llegar): más corto, el corte marea. */
  minSeg: 2.5,
} as const;

/** La «Intensidad» (0–100) del efecto «Acercar» para cada zoom: 112 % y 122 % del cuadro. */
export const INTENSIDAD_ZOOM: Readonly<Record<Zoom, number>> = { suave: 24, fuerte: 44 };

/** Si en un texto se dice algo con peso: un «!», un número o una palabra de venta (la que pesa 7 o más). */
function conPeso(texto: string): boolean {
  if (/!/.test(texto)) return true;
  const palabras = palabrasDelTexto(texto);
  return palabras.some((p, i) => puntajeDePalabra(p, i, palabras, new Set()) >= 7);
}

/**
 * Los cambios de plano: las frases se juntan en planos de al menos `minSeg`, cortados SIEMPRE en el borde de una frase,
 * y se alternan abierto (el cuadro tal cual) y cerrado (un acercamiento). Vuelven sólo los cerrados, que son las capas
 * que se agregan. El primero va abierto (el gancho, con la cara entera), y un plano cerrado que pisa algo de `ocupados`
 * no se propone (nunca se recorta a la mitad).
 */
export function planosDeLaLinea({
  frases,
  duracion,
  ocupados = [],
}: {
  frases: readonly Frase[];
  duracion: number;
  ocupados?: readonly Tramo[];
}): PlanoPropuesto[] {
  const validas = frasesValidas(frases).filter((f) => f.inicio < duracion);
  const planos: Array<Tramo & { texto: string }> = [];
  let actual: (Tramo & { texto: string }) | null = null;
  for (const f of validas) {
    if (!actual) { actual = { inicio: f.inicio, fin: f.fin, texto: f.texto }; continue; }
    if (actual.fin - actual.inicio >= TOPES_PLANOS.minSeg) {
      planos.push(actual);
      actual = { inicio: f.inicio, fin: f.fin, texto: f.texto };
    } else {
      actual.fin = Math.max(actual.fin, f.fin);
      actual.texto = `${actual.texto} ${f.texto}`;
    }
  }
  if (actual) planos.push(actual);
  const cerrados: PlanoPropuesto[] = [];
  planos.forEach((p, n) => {
    if (n % 2 === 0) return;
    const tramo = { inicio: centesima(p.inicio), fin: centesima(Math.min(p.fin, duracion)) };
    if (tramo.fin - tramo.inicio < TOPES_PLANOS.minSeg / 2) return;
    if (ocupados.some((o) => pisa(o, tramo))) return;
    cerrados.push({ ...tramo, zoom: conPeso(p.texto) ? 'fuerte' : 'suave' });
  });
  return cerrados;
}
