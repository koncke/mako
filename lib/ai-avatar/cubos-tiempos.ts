// =============================================================================
// cubos-tiempos — de la voz a los tiempos del video del personaje en cubos (módulo PURO, sin React ni servidor)
// =============================================================================
// Las plantillas (public/avatar-cubos/) leen `window.TIEMPOS = { anchors, words }`, el MISMO formato que escribe la galería
// (C:/dev/artefactos-animaciones/tools/tiempos.py): `anchors` dice el segundo en que arranca cada escena más `end`, y
// `words` es cada palabra con su inicio, su fin y su escena. Todo lo que se mueve sale de ahí («la voz manda el reloj»).
//
// De dónde salen las palabras:
//   · la voz de MaKo o el clon: ElevenLabs `/with-timestamps` devuelve CADA LETRA con su segundo → `palabrasDeLetras`;
//   · un audio subido: el forced alignment de ElevenLabs devuelve las palabras → se usan tal cual.
// Después, como la galería: las pausas de más de 0,3 s se recortan (`apretar`, la regla «sin silencios muertos» de Martín)
// y al final quedan 1,4 s de cola.
// =============================================================================

/** Una escena del guion: su id (`s1`, `s2`…) y lo que dice. */
export type Escena = { id: string; texto: string };
/** [texto, inicio, fin, escena] — el formato de la galería. */
export type PalabraT = [string, number, number, string];
export type Tiempos = { anchors: Record<string, number>; words: PalabraT[] };
/** Una palabra suelta con sus segundos (lo que devuelve la alineación). */
export type PalabraAlineada = { text: string; start: number; end: number };

/** La cola después de la última palabra (galería: tools/voz_formato.sh, COLA=1.4). */
export const COLA_S = 1.4;
/** La pausa más larga que queda entre dos palabras (galería: tools/apretar.py). */
export const PAUSA_MAX_S = 0.3;

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** El texto que se le da a la voz: las escenas seguidas, y «MaKo» con tilde, que es como se pronuncia bien. */
export function textoParaVoz(escenas: readonly Escena[]): string {
  return escenas.map((e) => e.texto.trim()).filter(Boolean).join(' ').replace(/\bMaKo\b/gi, 'Máko');
}

/** Cuántas palabras dice el guion (la galería: ≤ 42 corridas, unos 15 s). */
export const palabrasDelGuion = (escenas: readonly Escena[]): number =>
  escenas.reduce((n, e) => n + e.texto.trim().split(/\s+/).filter(Boolean).length, 0);

/**
 * Las letras de `/with-timestamps` (`alignment.characters`, `character_start_times_seconds`, `character_end_times_seconds`)
 * pasadas a palabras: cada tramo sin espacios es una palabra, del inicio de su primera letra al fin de la última.
 */
export function palabrasDeLetras(al: { characters: readonly string[]; character_start_times_seconds: readonly number[]; character_end_times_seconds: readonly number[] }): PalabraAlineada[] {
  const out: PalabraAlineada[] = [];
  let cur: PalabraAlineada | null = null;
  al.characters.forEach((c, i) => {
    if (/\s/.test(c)) { if (cur) { out.push(cur); cur = null; } return; }
    const s = al.character_start_times_seconds[i] ?? 0, e = al.character_end_times_seconds[i] ?? s;
    if (!cur) cur = { text: c, start: s, end: e };
    else { cur.text += c; cur.end = e; }
  });
  if (cur) out.push(cur);
  return out;
}

/**
 * Las palabras alineadas, repartidas en las escenas del guion por cantidad de palabras (tools/tiempos.py). Si la
 * alineación no trae la misma cantidad (pasa con un audio subido que no dice exactamente el guion), devuelve null: un
 * video con las palabras corridas de escena se ve roto, y es mejor decirlo que dibujarlo.
 */
export function tiemposDeEscenas(escenas: readonly Escena[], palabras: readonly PalabraAlineada[], cola = COLA_S): Tiempos | null {
  const W = palabras.filter((w) => w.text.trim());
  const anchors: Record<string, number> = {};
  const words: PalabraT[] = [];
  let i = 0;
  for (const e of escenas) {
    const n = e.texto.trim().split(/\s+/).filter(Boolean).length;
    if (!n) continue;
    if (i + n > W.length) return null;
    anchors[e.id] = r3(W[i].start);
    for (let j = 0; j < n; j++) words.push([W[i + j].text, r3(W[i + j].start), r3(W[i + j].end), e.id]);
    i += n;
  }
  if (i !== W.length || !words.length) return null;
  anchors.end = r3(words[words.length - 1][2] + cola);
  return { anchors, words };
}

/** Un tramo de audio que se saca: [desde, hasta) en segundos del audio original. */
export type Corte = [number, number];

/**
 * Recorta cada pausa de más de `max` segundos a `max` (se saca el centro del silencio; las palabras no se tocan) y corre
 * todos los tiempos. Devuelve los tiempos nuevos y los cortes, que el navegador aplica al audio (cubos-audio.ts).
 * Es tools/apretar.py de la galería, igual.
 */
export function apretar(t: Tiempos, max = PAUSA_MAX_S): { tiempos: Tiempos; cortes: Corte[] } {
  const W = t.words, cortes: Corte[] = [];
  for (let i = 0; i < W.length - 1; i++) {
    const a = W[i][2], b = W[i + 1][1];
    if (b - a > max) cortes.push([r3(a + max / 2), r3(b - max / 2)]);
  }
  const corre = (x: number) => r3(x - cortes.reduce((s, [c0, c1]) => s + (c1 <= x + 1e-6 ? c1 - c0 : 0), 0));
  const cola = t.anchors.end - W[W.length - 1][2];
  const anchors: Record<string, number> = {};
  for (const [k, v] of Object.entries(t.anchors)) if (k !== 'end') anchors[k] = corre(v);
  const words: PalabraT[] = W.map((w) => [w[0], corre(w[1]), corre(w[2]), w[3]]);
  anchors.end = r3(words[words.length - 1][2] + cola);
  return { tiempos: { anchors, words }, cortes };
}
