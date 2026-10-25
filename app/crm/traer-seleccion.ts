// =============================================================================
// traer-seleccion — qué se ve y qué se tilda en «Traer de otro funnel» (puro)
// =============================================================================
// Llamada de Martín con Mauricio, 22/10/2026 (min 26:00-28:23), sobre traer los ~1.050 de «Nutrición/Reactivación» del
// CRM principal al del Sprint: «se muestran 300 de 1050, busca o filtra para ver el resto... que el botón no se tenga que
// desplazar», y «están dentro de este funnel, ya no deberían saltar ahí, ni siquiera en gris, o debería directamente no
// verse... porque luego ya no me deja los siguientes 300». Lo usa app/crm/TraerDeOtroProducto.tsx y lo prueba
// tests/crm-traer-todos.test.ts ejecutándolo.
//   · Los que YA están en el destino van APARTE: no son candidatos, no se tildan y no ocupan los 300 lugares de los nuevos.
//     ⚠️ Y DESDE EL 24/10/2026 SE VUELVEN A VER, abajo y en gris (`presentes`). Martín: «En "traer de otro funnel" te habia
//     pedido que si ya lo trajo, no aparezca. Mejor que sea como en los grupos de whatsapp, que aparezca todo, pero en
//     gris». Lo del 22/10 (que no le quitaran lugar a los nuevos) sigue: van DESPUÉS de todos los candidatos.
//   · La pantalla dibuja hasta TOPE_PANTALLA filas, pero «tildar todos» toma a TODOS los que cumplen el filtro: el filtro
//     dice qué quiere la persona; el tope es sólo lo que entra en la pantalla.
// =============================================================================

/** Las filas que la pantalla dibuja a la vez. El resto está, se tilda con «todos» y se dice cuántas son. */
export const TOPE_PANTALLA = 300;
/** De a cuántos se agregan (el server corta en 2.000: `agregarLoteAProductoAction`). */
export const TANDA_AGREGAR = 1000;

export type FilaTraible = { id: number; nombre: string; email: string | null; telefono: string | null; empresa: string | null; etapaKey: string; yaEsta: boolean };

/**
 * Las filas que cumplen el filtro: las que NO están en el destino (`candidatos`, las que se tildan) y las que ya están
 * (`presentes`, en gris abajo), con cuántas son.
 */
export function filasParaTraer<F extends FilaTraible>(filas: readonly F[], filtro: { q: string; etapa: string }): { candidatos: F[]; presentes: F[]; yaEstan: number } {
  const texto = filtro.q.trim().toLowerCase();
  const candidatos: F[] = [];
  const presentes: F[] = [];
  for (const f of filas) {
    if (filtro.etapa && f.etapaKey !== filtro.etapa) continue;
    if (texto && ![f.nombre, f.email, f.telefono, f.empresa].some((v) => (v ?? '').toLowerCase().includes(texto))) continue;
    (f.yaEsta ? presentes : candidatos).push(f);
  }
  return { candidatos, presentes, yaEstan: presentes.length };
}

/** Partir una lista en tandas de `n`. */
export function enTandas<T>(xs: readonly T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

/** «1.050»: el número con el separador de miles de la casa. */
export const miles = (n: number): string => n.toLocaleString('es-AR');
