// =============================================================================
// Las medidas de una plantilla de video: cuánto dura un clip y si dijo el guion (PURO; 9/11/2026)
// =============================================================================
// Martín, 9/11/2026: «porque elegiste una duración más larga de la que debería… repitió una palabra, eso no debería pasar…
// contar las palabras para determinar cuántos segundos le vas a mandar a la instrucción. Y de paso también se ahorran tokens».
// Si el clip dura más que la frase, Omni la repite («…en vendehumo, en vendehumos»: 16 palabras en 8 s). Las reglas, en
// docs/manual-video-mako.md §3 (regla 7) y la medición en docs/plantillas-video/mensaje-para/.
//
// ⚠️ EL RITMO SALE DE LA REGLA 7 DEL MANUAL, la medida con la transcripción de los clips de Omni: ~3,3 palabras/s quieto, ~2,8
// con un gesto, y el habla arranca a los ~0,8 s. El §7.1 (regla 12) dice «2,1 si hace una acción»: es la nota de antes, sin
// medir. Gana la que se puede medir (manual, regla 29); la diferencia está anotada en docs/hallazgos-video-editor.md.
//
// Puro (sin React ni el motor del editor): lo usan el chat del editor, el editor de guion, la API y los tests.
// =============================================================================

/** Palabras por segundo que dice Omni en un clip, medido con la transcripción (manual §3, regla 7). */
export const RITMO_OMNI = { quieto: 3.3, gesto: 2.8 } as const;
/** El habla arranca a los ~0,8 s del clip, y se deja ~0,3 s de cola para que no corte la última sílaba. */
export const ARRANQUE_S = 0.8;
export const COLA_S = 0.3;
/** Lo que acepta Flow para un video de Omni: de 3 a 10 s enteros, a 3 créditos por segundo (manual §6.5). */
export const FLOW_VIDEO = { minimo: 3, maximo: 10, creditosPorSegundo: 3 } as const;

/** Las palabras de un texto como las cuenta y las compara la transcripción: sin tildes, sin signos, en minúsculas. */
export function palabrasDe(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export type DuracionClip = {
  palabras: number;
  /** Lo que necesita la frase: arranque + palabras ÷ ritmo + cola. */
  necesita: number;
  /** Lo que se le pide a Flow: el entero más chico que cubre `necesita`, entre 3 y 10. */
  segundos: number;
  creditos: number;
  /** La frase no entra en 10 s: hay que partirla en dos clips (nunca pedir 10 y que la corte). */
  partir: boolean;
};

/**
 * Cuánto dura el clip que dice `texto`. `gesto`: el personaje hace algo mientras habla (deja caer la foto, se cruza de brazos),
 * que baja el ritmo. Una frase vacía no es un clip hablado: vuelve 0 palabras y el mínimo de Flow, para un inserto mudo.
 */
export function duracionDeClip(texto: string, o: { gesto?: boolean } = {}): DuracionClip {
  const palabras = palabrasDe(texto).length;
  const ritmo = o.gesto ? RITMO_OMNI.gesto : RITMO_OMNI.quieto;
  const necesita = palabras === 0 ? 0 : Math.round((ARRANQUE_S + palabras / ritmo + COLA_S) * 100) / 100;
  // `- 1e-9`: 6,00 por redondeo de coma flotante no tiene que pedir 7.
  const entero = Math.ceil(necesita - 1e-9);
  const segundos = Math.min(FLOW_VIDEO.maximo, Math.max(FLOW_VIDEO.minimo, entero));
  return { palabras, necesita, segundos, creditos: segundos * FLOW_VIDEO.creditosPorSegundo, partir: necesita > FLOW_VIDEO.maximo };
}

export type DiferenciaGuion =
  | { tipo: 'cambiada'; esperada: string; oida: string }
  | { tipo: 'repetida'; palabra: string }
  | { tipo: 'de-mas'; palabra: string }
  | { tipo: 'falta'; palabra: string };

/**
 * Lo que el clip dijo distinto del guion (vacío = dijo exactamente el guion), alineando palabra a palabra por distancia de
 * edición. Una palabra de más que está cerca en el guion (la misma, o una que empieza igual) es REPETIDA: es el error que
 * produce un clip más largo que la frase. La regla y el script de origen: docs/plantillas-video/mensaje-para/scripts/chequear-guion.mjs.
 */
export function chequearGuion(guion: string, oido: string): DiferenciaGuion[] {
  const e = palabrasDe(guion);
  const o = palabrasDe(oido);
  const n = e.length;
  const m = o.length;
  const D: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, k) => (i === 0 ? k : k === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) {
    for (let k = 1; k <= m; k++) {
      D[i][k] = Math.min(D[i - 1][k] + 1, D[i][k - 1] + 1, D[i - 1][k - 1] + (e[i - 1] === o[k - 1] ? 0 : 1));
    }
  }
  const out: DiferenciaGuion[] = [];
  let i = n;
  let k = m;
  while (i > 0 || k > 0) {
    if (i > 0 && k > 0 && e[i - 1] === o[k - 1] && D[i][k] === D[i - 1][k - 1]) { i--; k--; continue; }
    if (i > 0 && k > 0 && D[i][k] === D[i - 1][k - 1] + 1) { out.unshift({ tipo: 'cambiada', esperada: e[i - 1], oida: o[k - 1] }); i--; k--; continue; }
    if (k > 0 && D[i][k] === D[i][k - 1] + 1) {
      const w = o[k - 1];
      const cerca = e.slice(Math.max(0, i - 3), i + 2).some((x) => x === w || x.startsWith(w) || w.startsWith(x));
      out.unshift(cerca ? { tipo: 'repetida', palabra: w } : { tipo: 'de-mas', palabra: w });
      k--;
      continue;
    }
    out.unshift({ tipo: 'falta', palabra: e[i - 1] });
    i--;
  }
  return out;
}

/** Una diferencia en palabras, para el chat y la API. */
export function textoDeDiferencia(d: DiferenciaGuion): string {
  switch (d.tipo) {
    case 'cambiada': return `Dijo «${d.oida}» en vez de «${d.esperada}»`;
    case 'repetida': return `Repitió «${d.palabra}»`;
    case 'de-mas': return `Dijo «${d.palabra}» de más`;
    case 'falta': return `Le faltó «${d.palabra}»`;
  }
}
