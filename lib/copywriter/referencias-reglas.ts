// =============================================================================
// copywriter/referencias-reglas — el «@» de la caja de MaKo: cuándo se abre la lista, qué encuentra y cómo se elige (PURO)
// =============================================================================
// mila.gg («Plan, research, or @ to reference files»). La lista se abre cuando lo escrito TERMINA en «@algo» (después de
// un espacio o al principio: un mail como «ana@ejemplo.com» no la abre), lo escrito después del «@» la filtra, y elegir
// borra el «@algo» de la caja y suma la referencia como chip. Sin tildes y sin mayúsculas para buscar.
// =============================================================================

import type { TipoGuion } from './tipos';

export type Referencia =
  | { tipo: 'guion'; id: string; nombre: string; tipoGuion?: TipoGuion }
  | { tipo: 'oferta'; id: 'oferta'; nombre: string }
  | { tipo: 'archivo'; id: string; nombre: string }
  /**
   * El outlier que replica la página (D18): la suma el SERVER cuando la página tiene `props.outlier`, en cada pedido
   * (lib/copywriter/ia.ts, `conElOriginal`). La pantalla no la manda: `sanearReferencias` no la acepta de afuera.
   */
  | { tipo: 'outlier'; id: string; nombre: string };

/** La oferta del negocio: siempre se puede citar. */
export const REF_OFERTA: Referencia = { tipo: 'oferta', id: 'oferta', nombre: 'La oferta' };

/** Cuántas referencias viajan con un mensaje, como mucho. */
export const TOPE_REFERENCIAS = 5;

/** Si lo escrito termina en «@algo», lo que va después del «@» (la consulta); si no, null. */
export function consultaArroba(texto: string): string | null {
  const m = /(?:^|\s)@([^\s@]{0,40})$/.exec(texto);
  return m ? m[1] : null;
}

const plano = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Lo que encuentra la consulta, sin repetir lo ya elegido, hasta 8. */
export function buscarReferencias(consulta: string, todas: readonly Referencia[], elegidas: readonly Referencia[]): Referencia[] {
  const q = plano(consulta.trim());
  const ya = new Set(elegidas.map((r) => `${r.tipo}:${r.id}`));
  return todas.filter((r) => !ya.has(`${r.tipo}:${r.id}`) && (!q || plano(r.nombre).includes(q))).slice(0, 8);
}

/** Elegir: el «@consulta» sale de la caja y la referencia se suma (sin pasar el tope). */
export function elegirReferencia(texto: string, r: Referencia, elegidas: readonly Referencia[]): { texto: string; elegidas: Referencia[] } {
  const sinArroba = texto.replace(/(^|\s)@[^\s@]{0,40}$/, '$1');
  const ya = elegidas.some((x) => x.tipo === r.tipo && x.id === r.id);
  return { texto: sinArroba, elegidas: ya || elegidas.length >= TOPE_REFERENCIAS ? [...elegidas] : [...elegidas, r] };
}

/** Las referencias que llegan en un pedido, saneadas (el server las vuelve a buscar en el negocio). */
export function sanearReferencias(raw: unknown): Referencia[] {
  if (!Array.isArray(raw)) return [];
  const out: Referencia[] = [];
  for (const x of raw.slice(0, TOPE_REFERENCIAS)) {
    const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id.slice(0, 80) : '';
    const nombre = typeof o.nombre === 'string' ? o.nombre.slice(0, 200) : '';
    if (o.tipo === 'oferta') { out.push(REF_OFERTA); continue; }
    if ((o.tipo === 'guion' || o.tipo === 'archivo') && id) out.push({ tipo: o.tipo, id, nombre });
  }
  return out;
}
