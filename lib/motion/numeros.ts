// =============================================================================
// motion/numeros — leer y escribir un número como lo escribe una persona en castellano
// =============================================================================
// UN solo lector para todo lo que trae un número de motion: la cifra (el panel, el chat y la API) y los datos de las
// barras. Hasta el 10/11/2026 había tres: el saneo, la API y la caja del panel hacían `replace(',', '.')`, así que
// «1.250» y «1,250» se guardaban como 1,25 y el video dibujaba «+1,25»; las barras sí los leían como 1250. Lo mismo
// escrito en dos lugares daba dos números distintos.
//
// La regla de lectura (la de la persona, en el panel):
//   · un separador (punto o coma) seguido de EXACTAMENTE 3 cifras, con 1 a 3 cifras antes (y no un 0 solo), es de
//     MILES: «1.250» y «1,250» son 1250; «1.234.567» es 1234567;
//   · con 1 o 2 cifras detrás, o con 4 o más, es la coma decimal: «4,5», «4.5», «3,14», «0,250»;
//   · con los dos separadores, el ÚLTIMO es el decimal: «1.234,5» y «1,234.5» son 1234,5.
// Lo de la IA o la API (estricto) que se puede leer de dos maneras —un solo separador con 3 cifras detrás— se RECHAZA
// con un motivo que dice qué escribir: «1.250» puede ser 1250 o 1,25, y adivinar es poner un número que nadie dio.
// Un JSON con un número (1250, 4.5) no tiene nada ambiguo y pasa tal cual.
//
// Y para mostrar: `formatearNumero`, el MISMO texto en el video, la landing y el panel («1.250», «4,5»), a mano y sin
// Intl (el server, el navegador y los tests escriben igual). Lo que muestra el panel vuelve a leerse a sí mismo.
//
// Puro, sin DOM: lo leen lib/motion/plantillas.ts, lib/motion/escena.ts, el panel del Video Editor y los tests.
// =============================================================================

/** `ambiguo`: se puede leer de dos maneras («1.250»); el motivo dice las dos. */
export type LecturaNumero = { ok: true; n: number } | { ok: false; motivo: string; ambiguo?: true };

const NO_ES = 'no es un número';

/** «4.567» → «4,567»: un número para un motivo, con coma decimal y sin separador de miles. */
const plano = (n: number): string => String(n).replace('.', ',');

/** ¿Una parte entera agrupada de a 3? «1.234.567» con el separador «.» → sí; «12.34» → no. */
function agrupadaDeA3(entero: string, sep: string): boolean {
  const grupos = entero.split(sep);
  return grupos[0].length >= 1 && grupos[0].length <= 3 && grupos[0] !== '0' && grupos.slice(1).every((g) => g.length === 3);
}

/**
 * Lee un número como lo escribe una persona («1.250», «4,5», «1.234,5», «-3») o como llega en un JSON (4.5). Con
 * `estricto` (la IA, la API), lo que se puede leer de dos maneras se rechaza con su motivo.
 */
export function leerNumero(v: unknown, { estricto = true }: { estricto?: boolean } = {}): LecturaNumero {
  if (typeof v === 'number') return Number.isFinite(v) ? { ok: true, n: v } : { ok: false, motivo: NO_ES };
  if (typeof v !== 'string') return { ok: false, motivo: NO_ES };
  const s = v.trim();
  const m = /^([+-]?)(\d+(?:[.,]\d+)*)$/.exec(s);
  if (!m) return { ok: false, motivo: NO_ES };
  const signo = m[1] === '-' ? -1 : 1;
  const cuerpo = m[2];
  const seps = cuerpo.replace(/\d/g, '');
  if (!seps) return { ok: true, n: signo * Number(cuerpo) };
  const tipos = new Set(seps);
  let entero: string;
  let decimal = '';
  if (tipos.size === 2) {
    // Los dos separadores: el último es el decimal, y tiene que aparecer una sola vez y al final.
    const dec = seps[seps.length - 1];
    const mil = dec === '.' ? ',' : '.';
    const i = cuerpo.lastIndexOf(dec);
    if (cuerpo.indexOf(dec) !== i || cuerpo.slice(i).includes(mil)) return { ok: false, motivo: NO_ES };
    entero = cuerpo.slice(0, i);
    decimal = cuerpo.slice(i + 1);
    if (!agrupadaDeA3(entero, mil)) return { ok: false, motivo: NO_ES };
    entero = entero.split(mil).join('');
  } else {
    const sep = seps[0];
    if (seps.length > 1) {
      // El mismo separador más de una vez sólo puede ser de miles.
      if (!agrupadaDeA3(cuerpo, sep)) return { ok: false, motivo: NO_ES };
      entero = cuerpo.split(sep).join('');
    } else {
      const [antes, despues] = cuerpo.split(sep);
      const deMiles = despues.length === 3 && agrupadaDeA3(cuerpo, sep);
      if (deMiles && estricto) {
        const miles = signo * Number(antes + despues);
        const comoDecimal = signo * Number(`${antes}.${despues}`);
        return { ok: false, ambiguo: true, motivo: `«${s}» puede ser ${plano(miles)} o ${plano(comoDecimal)}: escribe ${plano(miles)} (sin separador) o ${plano(comoDecimal)}` };
      }
      if (deMiles) entero = antes + despues;
      else {
        entero = antes;
        decimal = despues;
      }
    }
  }
  const n = signo * Number(decimal ? `${entero}.${decimal}` : entero);
  return Number.isFinite(n) ? { ok: true, n } : { ok: false, motivo: NO_ES };
}

/** 1250 → «1.250»; 3.5 con un decimal → «3,5». */
export function formatearNumero(n: number, decimales: number): string {
  const neg = n < 0;
  const fijo = Math.abs(n).toFixed(Math.max(0, Math.min(2, Math.round(decimales))));
  const [ent, dec] = fijo.split('.');
  const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg && Number(fijo) !== 0 ? '-' : ''}${miles}${dec ? `,${dec}` : ''}`;
}

/** Cuántos decimales TIENE un número (hasta 2, que es lo que acepta una cifra): 4,5 → 1; 1250 → 0; 3,14 → 2. */
export function decimalesDe(n: number): number {
  for (let d = 0; d < 2; d++) if (Math.abs(Math.round(n * 10 ** d) / 10 ** d - n) < 1e-9) return d;
  return 2;
}

/** El número como se muestra (con sus decimales y la coma): lo que escribe el panel y lo que dibuja el video. */
export const numeroParaMostrar = (n: number): string => formatearNumero(n, decimalesDe(n));
