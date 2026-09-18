// =============================================================================
// informe-congelado — los informes ya escritos que MaKo tiene que OFRECER
// =============================================================================
// EL CASO 08-T13 (llamada del 8/9/2026). Mauricio le pidió a MaKo por WhatsApp «un
// reporte de mis resultados de marketing de junio, julio y agosto». Ese informe EXISTE:
// /analisis/trimestre, el embudo entero leído en dólares, congelado el 09/09. Pero nada
// del doer sabía que existía: en el mejor caso MaKo recalculaba los números en vivo (en
// la moneda de Meta, pesos) y en el peor se guardaba el pedido como una idea.
//
// Es puro a propósito (sin server-only): el test prueba el rango con fechas reales, y la
// decisión de si el que pregunta puede VER el informe (solo el workspace dueño: los
// números son de Mauricio) la toma quien lo llama, con `esWorkspaceDueno()`.
// =============================================================================

import { PERIODO } from '../app/analisis/trimestre/datos';

export type InformeCongelado = { ruta: string; titulo: string; desde: string; hasta: string };

/**
 * Los informes del workspace DUEÑO. El período sale del propio informe (`PERIODO`), no se
 * escribe dos veces: un trimestre nuevo es un archivo nuevo y una fila nueva acá.
 */
export const INFORMES_DEL_DUENO: readonly InformeCongelado[] = [
  {
    ruta: '/analisis/trimestre',
    titulo: `El informe completo de ${PERIODO.etiqueta.toLowerCase()}, leído en dólares`,
    desde: PERIODO.desde,
    hasta: PERIODO.hasta,
  },
];

const dias = (a: string, b: string): number => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1;

/**
 * El informe que cubre lo que se pidió, o null. El rango pedido tiene que tapar al menos la
 * MITAD del informe: «¿cómo me fue en agosto?» no es «el trimestre», y ofrecerle un informe
 * de tres meses a quien preguntó por uno es ruido. Sin fechas explícitas, ninguno: la tool
 * cae sola a «últimos 90 días», y eso tampoco es un pedido del trimestre.
 */
export function informeParaRango(
  desde: string | null | undefined,
  hasta: string | null | undefined,
  informes: readonly InformeCongelado[] = INFORMES_DEL_DUENO,
): InformeCongelado | null {
  if (!desde || !hasta || Number.isNaN(Date.parse(desde)) || Number.isNaN(Date.parse(hasta))) return null;
  for (const inf of informes) {
    const ini = desde > inf.desde ? desde : inf.desde;
    const fin = hasta < inf.hasta ? hasta : inf.hasta;
    if (ini > fin) continue;
    if (dias(ini, fin) * 2 >= dias(inf.desde, inf.hasta)) return inf;
  }
  return null;
}
