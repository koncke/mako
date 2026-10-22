// =============================================================================
// traer-seleccion — qué se ve y qué se tilda en «Traer de otro funnel» (puro)
// =============================================================================
// Llamada de Martín con Mauricio, 22/10/2026 (min 26:00-28:23), sobre traer los ~1.050 de «Nutrición/Reactivación» del
// CRM principal al del Sprint: «se muestran 300 de 1050, busca o filtra para ver el resto... que el botón no se tenga que
// desplazar», y «están dentro de este funnel, ya no deberían saltar ahí, ni siquiera en gris, o debería directamente no
// verse... porque luego ya no me deja los siguientes 300». Lo usa app/crm/TraerDeOtroProducto.tsx y lo prueba
// tests/crm-traer-todos.test.ts ejecutándolo.
//   · Los que YA están en el destino NO se listan (antes salían en gris y ocupaban los 300 lugares de la pantalla). Se
//     cuentan aparte, para decirlo en una línea: una búsqueda que no los encuentra no es «no existen».
//   · La pantalla dibuja hasta TOPE_PANTALLA filas, pero «tildar todos» toma a TODOS los que cumplen el filtro: el filtro
//     dice qué quiere la persona; el tope es sólo lo que entra en la pantalla.
// =============================================================================

/** Las filas que la pantalla dibuja a la vez. El resto está, se tilda con «todos» y se dice cuántas son. */
export const TOPE_PANTALLA = 300;
/** De a cuántos se agregan (el server corta en 2.000: `agregarLoteAProductoAction`). */
export const TANDA_AGREGAR = 1000;

export type FilaTraible = { id: number; nombre: string; email: string | null; telefono: string | null; empresa: string | null; etapaKey: string; yaEsta: boolean };

/** Las filas que cumplen el filtro y NO están en el destino, y cuántas de las que cumplen ya están. */
export function filasParaTraer<F extends FilaTraible>(filas: readonly F[], filtro: { q: string; etapa: string }): { candidatos: F[]; yaEstan: number } {
  const texto = filtro.q.trim().toLowerCase();
  const candidatos: F[] = [];
  let yaEstan = 0;
  for (const f of filas) {
    if (filtro.etapa && f.etapaKey !== filtro.etapa) continue;
    if (texto && ![f.nombre, f.email, f.telefono, f.empresa].some((v) => (v ?? '').toLowerCase().includes(texto))) continue;
    if (f.yaEsta) { yaEstan++; continue; }
    candidatos.push(f);
  }
  return { candidatos, yaEstan };
}

/** Partir una lista en tandas de `n`. */
export function enTandas<T>(xs: readonly T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

/** «1.050»: el número con el separador de miles de la casa. */
export const miles = (n: number): string => n.toLocaleString('es-AR');
