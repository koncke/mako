// =============================================================================
// objetivos-reporte — las metas del reporte, desde la MISMA fuente que la pantalla (9/11/2026)
// =============================================================================
// Hasta acá había DOS fuentes para «cuál es la meta», y cada una mandaba en un lado: los reportes
// por WhatsApp leían `getObjetivoProgreso` (los tres settings viejos: `objetivo_cierres`,
// `objetivo_cash_usd`, `objetivo_desde`) y la pantalla leía `objectives` (migración 0155). O sea que
// el cliente podía cambiar su meta en la pantalla y seguir recibiendo la vieja por WhatsApp, sin un
// solo error en ningún lado. Es la peor forma de estar mal: las dos pantallas se ven sanas.
//
// ⚠️ Y EL ÍTEM DEL TABLERO DECÍA CÓMO ARREGLARLO, Y ESTABA MAL: «mover esos dos call-sites a
// `objetivosContextoTexto()`». Esa función devuelve PROSA para meterle a un modelo en un prompt
// —«llevas 12 de 20.000, vas atrasado»—, no números para una línea de reporte. Seguirla al pie de la
// letra hubiera metido un párrafo de contexto adentro del WhatsApp del cliente. La fuente nueva que
// sirve acá es `listObjectives` + `avanceDeObjetivo`, que es la que lee la pantalla.
//
// ⚠️ UN OBJETIVO QUE NO SE PUDO LEER SE DICE, NO SE PONE EN CERO. Es la regla que la fuente nueva ya
// trae (`actual: null`, «NUNCA cero por error») y que acá hay que respetar: un cliente que lee
// «0 de 20.000 USD» un lunes a la mañana toma decisiones con eso.
//
// Puro: sin base y sin red, para que tests/objetivos-reporte.test.ts lo pueda romper.
// =============================================================================

/** Lo que el reporte necesita de un objetivo. Es un subconjunto de `ObjectiveConAvance`. */
export type MetaParaReporte = {
  titulo: string;
  metaValor: number;
  unidad: string;
  /** null = no se pudo leer. NUNCA cero por error. */
  actual: number | null;
  error?: string;
  ritmo?: { alDia: boolean; llegadaEstimada: string | null } | null;
};

/**
 * Las líneas de la sección «Wins» de un reporte.
 *
 * `conRitmo` sólo en el semanal: en el diario el ritmo cambia poco de un día al otro y la línea se
 * vuelve ruido, que es exactamente lo que hace que la gente deje de leer el reporte.
 */
export function lineasDeMetas(
  metas: readonly MetaParaReporte[],
  fmtUsd: (n: number) => string,
  opts: { conRitmo?: boolean } = {},
): string[] {
  if (metas.length === 0) {
    // ⚠️ No se cae al origen viejo: eso es volver a tener dos fuentes. Se dice que no hay meta, que
    // es verdad y además es accionable — la pantalla es donde se carga.
    return ['   Sin una meta cargada para este trimestre (se carga en Objectives).'];
  }
  const L: string[] = [];
  for (const m of metas) {
    const val = (n: number) => (m.unidad === 'usd' ? fmtUsd(n) : n.toLocaleString('en-US'));
    if (m.actual === null) {
      L.push(`   ${m.titulo}: meta ${val(m.metaValor)} · no pude leer el avance${m.error ? ` (${m.error})` : ''}`);
      continue;
    }
    const linea = `   ${m.titulo}: ${val(m.actual)} de ${val(m.metaValor)}`;
    if (!opts.conRitmo || !m.ritmo) { L.push(linea); continue; }
    const llegada = m.ritmo.llegadaEstimada ? ` · a este ritmo llega el ${m.ritmo.llegadaEstimada}` : '';
    L.push(`${linea} · ${m.ritmo.alDia ? 'al día' : 'atrasado'}${llegada}`);
  }
  return L;
}
