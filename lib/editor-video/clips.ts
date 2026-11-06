// =============================================================================
// editor-video/clips — «Clips mágicos»: los mejores momentos de un video largo (reglas puras, sin IA)
// =============================================================================
// Pedido de Leila (clienta, llamada del 30/10/2026): de un video largo a varios cortos, eligiendo los mejores momentos
// con la transcripción, con subtítulos y en vertical, y cada clip se abre en el editor. Cómo lo hacen OpusClip y un repo
// abierto, con sus fuentes: docs/investigacion-video-clips.md. De ahí sale la forma de esto:
//
//   · UN CLIP ES UN TRAMO DE FRASES ENTERAS. Arranca donde arranca una idea (después de un punto o de una pausa) y
//     termina donde termina una; dura de 15 a 60 s. La IA nunca escribe un tiempo: nombra frases por su número
//     (`clipsDeIA`), igual que en el B-roll (./broll.ts).
//   · EL PUNTAJE ES DE 0 A 99, en cuatro partes, como el «virality score» de OpusClip (gancho, flujo, valor, tendencia):
//     acá GANCHO (cómo arranca), VALOR (cuánto dice), RITMO (cómo se escucha) y CIERRE (si termina redondo). Sin IA, es
//     el que decide (`clipsDeRespaldo`); con IA, la IA pone el suyo y el código valida todo lo demás.
//   · DOS CLIPS NO SE PISAN MÁS DE LA MITAD (la regla de SamurAIGPT/AI-Youtube-Shorts-Generator: si se pisan más del 50 %,
//     queda el de más puntaje), y un video de más de 20 minutos va a la IA en BLOQUES de 20 con un minuto de solape (la
//     misma del repo: un pedido con la hora entera pierde el medio).
//
// SIN `server-only` y sin el motor: lo usan el navegador (app/video-editor/_opencut/clips) y la ruta
// /api/video-editor/clips.
// =============================================================================

import { palabrasDelTexto, puntajeDePalabra } from './claves';
import type { Frase } from './broll';

export type { Frase } from './broll';

export const TOPES_CLIPS = {
  minSeg: 15,
  maxSeg: 60,
  /** Lo que mejor anda en Reels y Shorts: de 20 a 45 s (lo premia el cierre). */
  idealMinSeg: 20,
  idealMaxSeg: 45,
  porDefecto: 5,
  maxClips: 10,
  /** Más de esto pisado (del más corto de los dos) y quedan como el mismo clip. */
  solapeMax: 0.5,
  /** Un bloque para la IA: 20 minutos, con un minuto de solape con el siguiente. */
  bloqueSeg: 20 * 60,
  solapeBloqueSeg: 60,
  maxBloques: 6,
  /** Lo que se le pasa a la ruta: una hora y media de charla, larga. */
  maxFrases: 3_000,
  texto: 300,
  titulo: 80,
  motivo: 160,
  /** El aire que se deja antes y después de las palabras al cortar (para no comerse una sílaba). */
  margenSeg: 0.15,
} as const;

export type PartesPuntaje = { gancho: number; valor: number; ritmo: number; cierre: number };

export type ClipCandidato = {
  /** La primera y la última frase (sus números en la lista). */
  desde: number;
  hasta: number;
  inicio: number;
  fin: number;
  puntaje: number;
  partes: PartesPuntaje;
};

export type ClipElegido = ClipCandidato & {
  titulo: string;
  motivo: string;
  /** Lo primero que se dice: el gancho, tal cual. */
  primera: string;
  /** El puntaje lo puso la IA (si no, las reglas). */
  deIA: boolean;
};

const FIN_DE_IDEA = /[.!?…]["»”)]?$/;
/** Una pausa así entre dos frases ya es un corte natural aunque no haya punto. */
const PAUSA_DE_CORTE = 0.8;

/** Cómo arrancan los ganchos que funcionan (normalizado): una pregunta, un «cómo», un «nadie», un número. */
const GANCHO = /^(como|por que|porque|que pasa|sabias|sabes|el secreto|los secretos|nadie|nunca|deja de|dejen de|si tu|si eres|si tienes|si quieres|el error|los errores|el problema|la verdad|esto|imagina|alguna vez|te voy|les voy|lo que nadie|hay \d|\d)/;

const sinTildes = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/^[¿¡"«“\s]+/, '');

/** Las frases con su texto, en orden y sin las que no sirven (como las del B-roll). */
export function frasesDeClips(frases: readonly Frase[]): Frase[] {
  return frases
    .filter((f) => f && typeof f.texto === 'string' && f.texto.trim() && Number.isFinite(f.inicio) && Number.isFinite(f.fin) && f.fin > f.inicio && f.inicio >= 0)
    .map((f) => ({ texto: f.texto.replace(/\s+/g, ' ').trim().slice(0, TOPES_CLIPS.texto), inicio: f.inicio, fin: f.fin }))
    .sort((a, b) => a.inicio - b.inicio);
}

const puedeEmpezar = (fr: readonly Frase[], i: number) =>
  i === 0 || FIN_DE_IDEA.test(fr[i - 1].texto) || fr[i].inicio - fr[i - 1].fin >= PAUSA_DE_CORTE;
const puedeTerminar = (fr: readonly Frase[], j: number) =>
  j === fr.length - 1 || FIN_DE_IDEA.test(fr[j].texto) || fr[j + 1].inicio - fr[j].fin >= PAUSA_DE_CORTE;

/** El puntaje de un tramo de frases (0–99) y sus cuatro partes. */
export function puntajeDeClip(fr: readonly Frase[], desde: number, hasta: number): { puntaje: number; partes: PartesPuntaje } {
  const tramo = fr.slice(desde, hasta + 1);
  const duracion = tramo[tramo.length - 1].fin - tramo[0].inicio;
  const primera = tramo[0].texto;
  const palabrasPrimera = palabrasDelTexto(primera);

  // GANCHO (0–30): cómo arranca. Una pregunta o un arranque de gancho; si no, un número o una palabra que pesa al
  // principio; si no, que sea corta y directa.
  const conPesoAlPrincipio = palabrasPrimera.some((p, i) => puntajeDePalabra(p, i, palabrasPrimera, new Set()) >= 7);
  const gancho = /\?/.test(primera) || GANCHO.test(sinTildes(primera))
    ? 30
    : conPesoAlPrincipio ? 20 : palabrasPrimera.length <= 8 ? 12 : 5;

  // VALOR (0–30): cuántas palabras que pesan (números, montos, venta, nombres) por minuto.
  let conPeso = 0;
  let palabras = 0;
  for (const f of tramo) {
    const ps = palabrasDelTexto(f.texto);
    palabras += ps.length;
    ps.forEach((p, i) => { if (puntajeDePalabra(p, i, ps, new Set()) >= 6) conPeso += 1; });
  }
  const valor = Math.min(30, Math.round((conPeso / Math.max(duracion, 1)) * 60));

  // RITMO (0–20): habla a un ritmo que se escucha bien (de 2,3 a 3,6 palabras por segundo) y sin pausas largas.
  const pps = palabras / Math.max(duracion, 1);
  let ritmo = pps >= 2.3 && pps <= 3.6 ? 14 : pps >= 1.8 && pps <= 4.2 ? 9 : 4;
  let pausasLargas = 0;
  for (let k = 1; k < tramo.length; k++) if (tramo[k].inicio - tramo[k - 1].fin > 1.5) pausasLargas += 1;
  ritmo = Math.max(0, ritmo + (pausasLargas ? -3 * pausasLargas : 6));

  // CIERRE (0–19): termina en el fin de una idea, y dura lo que mejor anda.
  let cierre = FIN_DE_IDEA.test(tramo[tramo.length - 1].texto) ? 10 : 0;
  cierre += duracion >= TOPES_CLIPS.idealMinSeg && duracion <= TOPES_CLIPS.idealMaxSeg ? 9 : 4;

  const partes = { gancho, valor, ritmo: Math.min(20, ritmo), cierre };
  return { puntaje: Math.min(99, gancho + valor + partes.ritmo + cierre), partes };
}

/** Todos los tramos posibles: arrancan y terminan en un corte natural y duran de 15 a 60 s. */
export function candidatosDeClips(frases: readonly Frase[]): ClipCandidato[] {
  const fr = frasesDeClips(frases);
  const out: ClipCandidato[] = [];
  for (let i = 0; i < fr.length; i++) {
    if (!puedeEmpezar(fr, i)) continue;
    for (let j = i; j < fr.length; j++) {
      const duracion = fr[j].fin - fr[i].inicio;
      if (duracion > TOPES_CLIPS.maxSeg) break;
      if (duracion < TOPES_CLIPS.minSeg || !puedeTerminar(fr, j)) continue;
      out.push({ desde: i, hasta: j, inicio: fr[i].inicio, fin: fr[j].fin, ...puntajeDeClip(fr, i, j) });
    }
  }
  return out;
}

/** Cuánto se pisan dos tramos, como fracción del más corto. */
export function solape(a: { inicio: number; fin: number }, b: { inicio: number; fin: number }): number {
  const pisado = Math.min(a.fin, b.fin) - Math.max(a.inicio, b.inicio);
  if (pisado <= 0) return 0;
  return pisado / Math.min(a.fin - a.inicio, b.fin - b.inicio);
}

/** Los de más puntaje que no se pisan más de la mitad, hasta `cuantos`, en el orden del video. */
export function elegirSinSolape<T extends { inicio: number; fin: number; puntaje: number }>(lista: readonly T[], cuantos: number): T[] {
  const elegidos: T[] = [];
  const porPuntaje = [...lista].sort((a, b) => b.puntaje - a.puntaje || a.inicio - b.inicio);
  for (const c of porPuntaje) {
    if (elegidos.length >= cuantos) break;
    if (elegidos.every((e) => solape(e, c) <= TOPES_CLIPS.solapeMax)) elegidos.push(c);
  }
  return elegidos.sort((a, b) => a.inicio - b.inicio);
}

const primerasPalabras = (t: string, n: number) => {
  const ps = t.split(/\s+/).filter(Boolean);
  return ps.slice(0, n).join(' ') + (ps.length > n ? '…' : '');
};

/** Cuántos clips se pueden pedir. */
export function cuantosClips(pedido: unknown): number {
  const n = typeof pedido === 'number' && Number.isInteger(pedido) ? pedido : TOPES_CLIPS.porDefecto;
  return Math.max(1, Math.min(TOPES_CLIPS.maxClips, n));
}

/** Sin IA: los mejores por las reglas, titulados con su primera frase. */
export function clipsDeRespaldo(frases: readonly Frase[], cuantos: number): ClipElegido[] {
  const fr = frasesDeClips(frases);
  return elegirSinSolape(candidatosDeClips(fr), cuantosClips(cuantos)).map((c) => ({
    ...c,
    titulo: primerasPalabras(fr[c.desde].texto, 8).slice(0, TOPES_CLIPS.titulo),
    motivo: '',
    primera: fr[c.desde].texto,
    deIA: false,
  }));
}

// ── Para la IA ───────────────────────────────────────────────────────────────

/** Los bloques (por número de frase) de hasta 20 minutos, con un minuto de solape. Un video corto es un bloque. */
export function bloquesParaIA(frases: readonly Frase[]): Array<{ desde: number; hasta: number }> {
  const fr = frasesDeClips(frases);
  if (!fr.length) return [];
  const bloques: Array<{ desde: number; hasta: number }> = [];
  let desde = 0;
  while (desde < fr.length && bloques.length < TOPES_CLIPS.maxBloques) {
    const limite = fr[desde].inicio + TOPES_CLIPS.bloqueSeg;
    let hasta = desde;
    while (hasta + 1 < fr.length && fr[hasta + 1].fin <= limite) hasta += 1;
    bloques.push({ desde, hasta });
    if (hasta >= fr.length - 1) break;
    // El siguiente arranca un minuto antes del final de éste (sin volver atrás del todo).
    const vuelta = fr[hasta].fin - TOPES_CLIPS.solapeBloqueSeg;
    let siguiente = hasta;
    while (siguiente > desde + 1 && fr[siguiente - 1].inicio >= vuelta) siguiente -= 1;
    desde = Math.max(desde + 1, siguiente);
  }
  return bloques;
}

const reloj = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/** La transcripción de un bloque como la lee la IA: una frase por renglón con su número y su minuto. */
export function transcripcionParaIA(frases: readonly Frase[], bloque: { desde: number; hasta: number }): string {
  const fr = frasesDeClips(frases);
  const lineas: string[] = [];
  for (let i = bloque.desde; i <= bloque.hasta && i < fr.length; i++) lineas.push(`[${i}] ${reloj(fr[i].inicio)} ${fr[i].texto}`);
  return lineas.join('\n');
}

const entero = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : null;

/**
 * Lo que devolvió la IA para un bloque, validado: `{"clips":[{"desde":12,"hasta":31,"titulo":"…","puntaje":87,"motivo":"…"}]}`.
 * Un número fuera del bloque, un tramo al revés, uno de menos de 15 s o más de 60 s, y un título vacío se descartan con su
 * motivo. El puntaje fuera de 0–99 lo reemplazan las reglas. No corta por solape: eso lo hace quien junta los bloques.
 */
export function clipsDeIA(
  frases: readonly Frase[],
  crudo: unknown,
  bloque: { desde: number; hasta: number },
): { clips: ClipElegido[]; descartes: string[] } {
  const fr = frasesDeClips(frases);
  const descartes: string[] = [];
  const lista = crudo && typeof crudo === 'object' ? (crudo as { clips?: unknown }).clips : undefined;
  if (!Array.isArray(lista)) return { clips: [], descartes: ['la respuesta no trae "clips"'] };
  const clips: ClipElegido[] = [];
  for (const item of lista.slice(0, TOPES_CLIPS.maxClips * 2)) {
    const o = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const desde = entero(o.desde);
    const hasta = entero(o.hasta);
    if (desde === null || hasta === null || desde < bloque.desde || hasta > bloque.hasta || hasta >= fr.length) {
      descartes.push(`frases fuera del bloque (${String(o.desde)}-${String(o.hasta)})`);
      continue;
    }
    if (hasta < desde) { descartes.push(`un clip al revés (${desde}-${hasta})`); continue; }
    const inicio = fr[desde].inicio;
    const fin = fr[hasta].fin;
    const duracion = fin - inicio;
    if (duracion < TOPES_CLIPS.minSeg || duracion > TOPES_CLIPS.maxSeg) {
      descartes.push(`un clip de ${Math.round(duracion)} s (${desde}-${hasta})`);
      continue;
    }
    const titulo = typeof o.titulo === 'string' ? o.titulo.replace(/\s+/g, ' ').trim().slice(0, TOPES_CLIPS.titulo) : '';
    if (!titulo) { descartes.push(`un clip sin título (${desde}-${hasta})`); continue; }
    const reglas = puntajeDeClip(fr, desde, hasta);
    const p = entero(o.puntaje);
    clips.push({
      desde,
      hasta,
      inicio,
      fin,
      puntaje: p !== null && p >= 0 && p <= 99 ? p : reglas.puntaje,
      partes: reglas.partes,
      titulo,
      motivo: typeof o.motivo === 'string' ? o.motivo.replace(/\s+/g, ' ').trim().slice(0, TOPES_CLIPS.motivo) : '',
      primera: fr[desde].texto,
      deIA: true,
    });
  }
  return { clips, descartes };
}

/** El tramo que se corta en el editor: las frases con un poco de aire, sin salirse del video. */
export function tramoDeCorte(clip: { inicio: number; fin: number }, duracionVideo: number): { inicio: number; fin: number } {
  return {
    inicio: Math.max(0, clip.inicio - TOPES_CLIPS.margenSeg),
    fin: Math.min(duracionVideo, clip.fin + TOPES_CLIPS.margenSeg),
  };
}
