// =============================================================================
// eje-lindo — las marcas de un eje numérico automático: redondas y con aire en las puntas
// =============================================================================
// La dispersión y las burbujas (./Dispersion.tsx) abrían el eje un poco de cada lado para que un punto o una
// burbuja en el mínimo o el máximo no se cortara contra el borde. Con el dominio corrido, recharts dejaba de
// redondear las marcas y salían «14%, 19%, 24%, 29%, 32%» o «2,6 · 6,6 · 9,1» (medido con el arnés, 14/10/2026).
// Esto elige un PASO redondo (1, 2, 2,5 o 5 por una potencia de 10), abre las puntas y las lleva al múltiplo del
// paso, así las marcas son las de siempre: 10, 20, 30, 40.
//
// Puro y sin dependencias: lo prueba tests/graficos-eje-lindo.test.ts.

/** El paso redondo más chico que es ≥ `crudo`: 1, 2, 2,5 o 5 por una potencia de 10. */
export function pasoLindo(crudo: number): number {
  if (!(crudo > 0) || !Number.isFinite(crudo)) return 1;
  const base = 10 ** Math.floor(Math.log10(crudo));
  const f = crudo / base;
  const lindo = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return lindo * base;
}

/** Saca el ruido de la coma flotante (0.30000000000000004 → 0.3). */
const limpio = (v: number) => Math.round(v * 1e9) / 1e9;

/**
 * El dominio y las marcas de un eje automático sobre `valores`.
 * `intervalos`: cuántos tramos se buscan (las marcas son intervalos + 1, a veces una más).
 * `aire`: cuánto se abre cada punta, como fracción del rango de los datos.
 * `positivos`: si todos los valores son ≥ 0, el eje no cruza el cero.
 */
export function ejeLindo(valores: readonly number[], intervalos: number, aire: number, positivos: boolean): { dominio: [number, number]; marcas: number[] } {
  const vs = valores.filter((v) => Number.isFinite(v));
  let lo = vs.length ? Math.min(...vs) : 0;
  let hi = vs.length ? Math.max(...vs) : 1;
  if (lo === hi) { const d = Math.abs(lo) * 0.1 || 1; lo -= d; hi += d; }
  const rango = hi - lo;
  lo -= rango * aire;
  hi += rango * aire;
  if (positivos && lo < 0) lo = 0;
  const paso = pasoLindo((hi - lo) / Math.max(1, intervalos));
  const desde = limpio(Math.floor(lo / paso) * paso);
  const hasta = limpio(Math.ceil(hi / paso) * paso);
  const marcas: number[] = [];
  for (let v = desde; v <= hasta + paso / 2; v += paso) marcas.push(limpio(v));
  return { dominio: [desde, hasta], marcas };
}
