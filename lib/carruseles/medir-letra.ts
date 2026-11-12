// =============================================================================
// medir-letra — el ancho REAL de un renglón y el alto que le da el editor, en el servidor (PURO; 11/11/2026)
// =============================================================================
// Martín, 11/11/2026, sobre «Tu versión» de @jasonrewired_: «No sólo se superponen las letras, lo cual ya es preocupante». La
// lámina 1 traía dos textos del titular, uno debajo del otro (top 513 y 648, Montserrat 800 a 97 px, 864 px de ancho). El de
// arriba, «¿Te preocupa lo que», NO entra en un renglón: mide 1.036 px a 97 px, se parte en dos, y en el editor ocupa 226 px
// (no los 206 que guardábamos), así que termina en 739 y se monta sobre el de abajo. Nadie medía: `altoEstimado` contaba 0,58 del
// cuerpo por letra y `ajustarTextos` dejaba a cada texto donde lo puso la IA.
//
// Lo que hace esto, sin adivinar:
//   · EL ANCHO: los anchos de cada letra medidos en el navegador con las woff2 del editor (./anchos-de-letra.json: `measureText`
//     a 1000 px, latin + latin-ext). Sumar letra por letra SOBRA un poco (la frase entera mide 10.682 y la suma 10.819: el
//     interletrado real la achica un 1,3 %), así que nunca dice que entra algo que el editor parte.
//   · EL CORTE: palabra por palabra, como `_wrapLine` de fabric (./tipografia-medida.ts → `partirEnRenglones`).
//   · EL ALTO: el de fabric (`calcTextHeight`): cada renglón mide cuerpo × 1,13 (`_fontSizeMult`) × interlineado, y el último sin
//     el interlineado. Es lo que el editor dibuja, no lo que nos parece.
// Una familia que no está en la tabla (una fuente del kit de marca) se mide con la más ANCHA de la tabla del mismo peso: sobra, no
// falta. Una letra que no está, con el ancho de la «M» de esa fuente.
// =============================================================================

import datos from './anchos-de-letra.json';
import type { FuenteTexto, Medidor } from './tipografia-medida';

/** El factor de alto de renglón de fabric (`_fontSizeMult`): un renglón mide el cuerpo × 1,13, antes del interlineado. */
export const ALTO_DE_RENGLON = 1.13;

const LETRAS = Array.from(datos.chars);
type Tabla = Map<string, number>;
const TABLAS = new Map<string, Map<number, Tabla>>();
for (const [familia, pesos] of Object.entries(datos.anchos as Record<string, Record<string, string>>)) {
  const porPeso = new Map<number, Tabla>();
  for (const [peso, lista] of Object.entries(pesos)) {
    const anchos = lista.split(',').map(Number);
    porPeso.set(Number(peso), new Map(LETRAS.map((c, i) => [c, anchos[i]])));
  }
  TABLAS.set(familia, porPeso);
}

/** Las familias medidas (el test mira que estén todas las que usa la réplica). */
export const FAMILIAS_MEDIDAS: readonly string[] = [...TABLAS.keys()];

/** El nombre de la familia sin comillas ni respaldo: «"Montserrat", sans-serif» → «Montserrat». */
export const familiaPelada = (familia: string): string => familia.split(',')[0].replace(/["']/g, '').trim();

function tablaDe(familia: string, peso: number): Tabla {
  const porPeso = TABLAS.get(familiaPelada(familia));
  if (porPeso) {
    const pesos = [...porPeso.keys()].sort((a, b) => Math.abs(a - peso) - Math.abs(b - peso) || b - a);
    return porPeso.get(pesos[0])!;
  }
  // Una familia que no medimos: la más ancha de la tabla (Montserrat 800). Sobra, nunca falta.
  return TABLAS.get('Montserrat')!.get(800)!;
}

/**
 * El ancho de un renglón en px, con la tabla medida: la suma de sus letras (a 1000 px, escalada al cuerpo) más el espaciado
 * (`charSpacing` del motor, en milésimas de em, una vez por letra).
 */
export const medidorReal: Medidor = (renglon, f) => {
  const tabla = tablaDe(f.familia, f.peso);
  const m = tabla.get('M') ?? 900;
  let suma = 0;
  const letras = Array.from(renglon);
  for (const c of letras) suma += tabla.get(c) ?? m;
  return (suma * f.tam) / 1000 + ((f.espaciado ?? 0) / 1000) * f.tam * letras.length;
};

/** El alto que le da el editor (fabric) a `renglones` renglones de `tam` px con ese interlineado. */
export const altoEnElEditor = (renglones: number, tam: number, interlineado: number): number =>
  renglones <= 0 ? 0 : tam * ALTO_DE_RENGLON * (interlineado * (renglones - 1) + 1);

/** El texto que se mide: en mayúsculas si va en mayúsculas (lo que dibuja el editor). */
export const comoSeDibuja = (texto: string, mayus: boolean): string => (mayus ? texto.toLocaleUpperCase('es') : texto);

export type { FuenteTexto };
