// =============================================================================
// venta-tipo — cómo se cobra un cliente, y qué cuenta como VENTA (fuente única)
// =============================================================================
// `leads.venta_tipo` es text SIN CHECK (mig 0116): los valores válidos los decide
// este módulo, no la base. Hasta el 06/10/2026 eran dos —'unico' (default) y
// 'suscripcion' (#363)— y se suma el tercero:
//
//   · 'sin_cobro' — un BECADO o bonificado (#747). Decisión de Martín, 06/10/2026:
//     «un tipo de venta "Sin cobro" en el CRM, que da el monto por contestado y queda
//     fuera del ticket promedio».
//
// Las tres consecuencias, y cada una vive donde se decide:
//
//   1. El CRM da por CONTESTADOS el monto, el plan de pagos y el comprobante
//      (`stepsForStage`, lib/stage-requirements.ts). Sin esto un becado quedaba para
//      siempre en «Datos sin marcar» pidiendo un «Monto de cierre» que no existe, y la
//      única salida era «ignorar pendientes», que apaga TODOS los demás.
//   2. Su monto es NULL, nunca 0 (`desenlaceAlGuardar`, lib/lead-desenlace.ts). Un 0
//      explícito se lee como «vendimos por cero dólares», que es otra afirmación.
//   3. ⚠️ NO ES UNA VENTA PARA LAS MÉTRICAS DE PLATA, PERO SÍ ES UN CLIENTE. Las
//      lecturas que suman `monto_cierre_usd` de los ganados —y los conteos que van
//      pegados a esa suma— lo excluyen con `VENTA_SIN_COBRO`: el Sold de /comercial y
//      su «N cierres» (+ el desglose), la serie mensual, el objetivo de cierres, el
//      ingreso y los ganados de metricas-negocio (y con ellos el costo por cierre de
//      analisis-negocio), y los KPIs «Cierres» y «Firmado» de Objectives. Contado, sería
//      una venta de US$0 que baja el ticket promedio. La cartera de Customer Success
//      (`lib/clientes-ganados.ts`) lo sigue contando: dejó de ser lead, es un cliente.
//      Lo fija tests/venta-sin-cobro.test.ts, que BARRE el repo.
//
//      ⚠️ Y LO QUE TODAVÍA LO CUENTA, A SABIENDAS (no suman plata, cuentan conversión):
//      las cohortes (`v_cohortes_*`, una vista SQL), el embudo de /comercial
//      (`cierres_cohorte`), los cierres por anuncio y el CAC por cierres de /marketing
//      (`getMarketingWindow`, `getCacAcumulado` y la serie). Si un becado tiene que
//      salir también de ahí es una decisión de Martín, no un olvido — y el filtro es
//      el mismo `.neq('venta_tipo', VENTA_SIN_COBRO)` (la columna es NOT NULL).
//
// Sin `server-only` a propósito: lo importan el wizard del CRM (navegador), el alta de
// Customer Success (server) y un test que lo EJECUTA.
// =============================================================================

/** Los tipos de venta que el producto entiende. El orden es el de la pantalla. */
export const VENTA_TIPOS = ['unico', 'suscripcion', 'sin_cobro'] as const;
export type VentaTipo = (typeof VENTA_TIPOS)[number];

/** El becado / bonificado. Se nombra por esta constante y no con el string suelto:
 *  así el barrido de tests/venta-sin-cobro.test.ts encuentra a cada lector. */
export const VENTA_SIN_COBRO = 'sin_cobro' as const satisfies VentaTipo;

/** ¿Este tipo de venta es «sin cobro»? Acepta lo que venga de la base (text libre). */
export const esSinCobro = (tipo: string | null | undefined): boolean => tipo === VENTA_SIN_COBRO;

/**
 * ¿Este ganado cuenta como VENTA en una métrica de plata (sold, cierres, ticket)?
 *
 * ⚠️ Es la pregunta de las MÉTRICAS, no la de «¿es cliente?»: un becado es cliente y
 * no es venta. Una fila sin `venta_tipo` (una lectura que no lo pidió) cuenta como
 * venta, que es lo que hacía todo el código antes de que existiera el tipo.
 */
export const cuentaComoVenta = (fila: { venta_tipo?: string | null }): boolean => !esSinCobro(fila.venta_tipo);

/** El tipo de venta de una fila como lo entiende el producto: lo desconocido es 'unico'. */
export const ventaTipoDe = (tipo: string | null | undefined): VentaTipo =>
  (VENTA_TIPOS as readonly string[]).includes(tipo ?? '') ? (tipo as VentaTipo) : 'unico';

// ── La plata de una SUSCRIPCIÓN vive en otra columna ─────────────────────────────
//
// ⚠️ UNA SUSCRIPCIÓN NO TIENE `monto_cierre_usd`. El wizard guarda su importe MENSUAL en
// `suscripcion_monto_usd` (+ el plazo en `suscripcion_meses`) y deja el monto de cierre en
// NULL a propósito: una recurrencia indefinida no tiene total, y contarla como cierre
// inflaría el revenue único (app/crm/actions.ts, el update de la suscripción).
//
// Hasta el 08/10/2026 todo lo que DIBUJA o REABRE un cierre miraba sólo el monto de cierre,
// y una suscripción bien guardada se leía como si no tuviera plata:
//   · la tarjeta de Ganado y la lista del tablero decían «$0» (Leila, ws11: «y ni siquiera
//     lo guardó» — sí lo había guardado, 444 en la otra columna);
//   · los cuatro constructores del wizard pasaban `monto: monto_cierre_usd` (null) y nada
//     del plazo, así que reabrir la suscripción pedía el monto VACÍO, y «Guardar y completar
//     después» escribía NULL encima de la mensualidad y del plazo.
// El diagnóstico obvio («no lo guardó») era el equivocado: el dato estaba, la lectura no.
// Por eso las dos lecturas viven acá, puras, y las usa cada lugar que lo necesita.

/** La mensualidad y el plazo de una fila de `leads`, SÓLO si es una suscripción.
 *  Con otro tipo devuelve null en los dos: un importe viejo de cuando era suscripción no
 *  puede reabrir el wizard dando el monto por cargado (es la misma regla que el server,
 *  `valoresDeRequisitos` en app/crm/actions.ts). */
export function suscripcionDeFila(fila: {
  venta_tipo?: string | null;
  suscripcion_monto_usd?: number | string | null;
  suscripcion_meses?: number | string | null;
}): { suscripcionMonto: number | null; suscripcionMeses: number | null } {
  if (ventaTipoDe(fila.venta_tipo) !== 'suscripcion') return { suscripcionMonto: null, suscripcionMeses: null };
  const num = (v: number | string | null | undefined): number | null => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return { suscripcionMonto: num(fila.suscripcion_monto_usd), suscripcionMeses: num(fila.suscripcion_meses) };
}

const usd = (n: number): string => '$' + n.toLocaleString('en-US');

/**
 * Cómo se DIBUJA la plata de un cierre en el tablero (tarjeta de Ganado y lista) y con qué
 * número se ORDENA. Los tres lugares usan esta función, así que no pueden contar dos
 * historias distintas del mismo lead:
 *   · suscripción → «$444/mes» (la mensualidad; sin cargar, «$0/mes»: dice qué falta);
 *   · sin cobro   → «Sin cobro» (un becado no es una venta de $0, lib/venta-tipo.ts §3);
 *   · el resto    → «$1,500», como siempre.
 * `valor` es el número dibujado, para el orden por monto.
 */
export function montoDeTarjeta(l: {
  ventaTipo: string | null | undefined;
  monto: number | null | undefined;
  suscripcionMonto: number | null | undefined;
}): { texto: string; valor: number } {
  const tipo = ventaTipoDe(l.ventaTipo);
  if (tipo === 'suscripcion') {
    const m = Number(l.suscripcionMonto) || 0;
    return { texto: `${usd(m)}/mes`, valor: m };
  }
  if (tipo === VENTA_SIN_COBRO) return { texto: 'Sin cobro', valor: 0 };
  const m = Number(l.monto) || 0;
  return { texto: usd(m), valor: m };
}
