// =============================================================================
// gasto-meta — «¿cuánto llevo gastado de octubre en Meta Ads?», contestado por el CÓDIGO (27/10/2026, MAU-04)
// =============================================================================
// Mauricio preguntó eso en su grupo y MaKo contestó que la IA lo rebotaba por límite: el dato estaba en
// `marketing_metrics_daily` y no hacía falta ninguna IA para darlo. Y su cuenta no gasta desde el 15/10 porque Meta la
// frenó por SALDO IMPAGO: eso se dice así, nunca «sin sincronizar» (la nota de `resumir_marketing_periodo` lo decía).
// El precedente es la agenda, que no pasa por la IA (lib/agenda-sin-ia.ts).
//
// PURO y sin `server-only`: lo usan lib/gasto-meta-server.ts y tests/gasto-meta.test.ts.
// =============================================================================

/** ¿Pregunta cuánto gastó o invirtió en Meta (o en anuncios)? «va» y «van» enteros: con cualquier palabra que empezara así,
 *  «¿qué vamos a hacer con la campaña?» o «qué variantes de anuncios armo» se contestaban con el gasto. */
const PREGUNTA = /(?<!\p{L})(?:cu[aá]nto|qu[eé])(?!\p{L})[^?\n]{0,40}(?<!\p{L})(?:(?:gast|invert|invirt|llev)\p{L}*|van?(?!\p{L}))[^?\n]{0,50}(?<!\p{L})(?:meta|facebook|instagram|anuncios?|ads|pauta|campa[ñn]as?)(?!\p{L})/iu;
export function esPreguntaDeGastoMeta(texto: string): boolean {
  return PREGUNTA.test(texto || '');
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** El mes que nombra («de octubre», «en septiembre»); si no nombra ninguno, el de `hoy`. Del 1 al último día, o a `hoy`. */
export function mesDelPedido(texto: string, hoy: string): { desde: string; hasta: string; nombre: string } {
  const t = (texto || '').toLowerCase();
  const [ah, am] = hoy.split('-').map(Number);
  const i = MESES.findIndex((m) => new RegExp(`(?<!\\p{L})${m}(?!\\p{L})`, 'u').test(t));
  const mes = i >= 0 ? i + 1 : am;
  // Un mes que todavía no llegó este año es del año pasado («¿cuánto gasté en diciembre?» en octubre).
  const anio = mes > am ? ah - 1 : ah;
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const fin = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
  return { desde, hasta: fin < hoy ? fin : hoy, nombre: MESES[mes - 1] };
}

/** Los estados de una cuenta de Meta que NO entregan: el rojo de lib/meta-health.ts (`account_status`). */
const NO_ENTREGA = new Set([2, 3, 100, 101]);
/** Los que esperan algo de Meta y siguen entregando: el ámbar de lib/meta-health.ts (revisión de riesgo, liquidación,
 *  período de gracia). Se dice el estado, nunca «frenó». */
const EN_ESPERA = new Set([7, 8, 9]);
export type CuentaMeta = { status: number; statusLabel: string; disableReasonLabel?: string | null; nombre?: string | null };

const plata = (n: number) => n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd = (n: number) => `US$ ${plata(n)}`;

/** Lo que gastó en el mes: en la moneda de la cuenta (`spend`), su moneda si se sabe, y en dólares si hay tasa. */
export type GastoDelMes = { cuenta: number; moneda: string | null; usd: number | null };

/**
 * El monto con su moneda: en dólares si hay tasa (con lo de la cuenta al lado, si cobra en otra); si no, en la moneda de la
 * cuenta; y si la moneda no se pudo leer, sin inventar una. Nunca «US$» sobre pesos argentinos (la revisión adversarial
 * de 92d23e11d: `spend_usd` devuelve el monto crudo cuando la moneda no tiene tasa, y divide por 17,3 cuando no se sabe).
 */
export function montoDelGasto(g: GastoDelMes): string {
  if (g.usd != null) return g.moneda && g.moneda !== 'USD' ? `${usd(g.usd)} (${plata(g.cuenta)} ${g.moneda})` : usd(g.usd);
  if (g.moneda) return `${plata(g.cuenta)} ${g.moneda}`;
  return `${plata(g.cuenta)} en la moneda de tu cuenta de Meta (no la pude leer)`;
}
const fechaCorta = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;

/** Por qué la cuenta no gasta, dicho como lo dice Meta. null = la cuenta entrega (o no se pudo leer). */
export function porQueNoGasta(cuenta: CuentaMeta | null | undefined): string | null {
  if (!cuenta || !NO_ENTREGA.has(cuenta.status)) return null;
  const de = cuenta.nombre ? ` «${cuenta.nombre}»` : '';
  const motivo = cuenta.status === 3 ? 'por saldo impago' : `(${cuenta.statusLabel.toLowerCase()}${cuenta.disableReasonLabel ? `: ${cuenta.disableReasonLabel}` : ''})`;
  return `Meta frenó la cuenta${de} ${motivo}`;
}

/** La cuenta espera algo de Meta (período de gracia, revisión de riesgo, liquidación): se dice el estado. null = no. «Sigue
 *  entregando» sólo en el período de gracia (9), que es lo único que se sabe: la revisión (7) y la liquidación (8) no lo dicen. */
export function enEsperaEnMeta(cuenta: CuentaMeta | null | undefined): string | null {
  if (!cuenta || !EN_ESPERA.has(cuenta.status)) return null;
  return `Meta tiene la cuenta${cuenta.nombre ? ` «${cuenta.nombre}»` : ''} en espera (${cuenta.statusLabel.toLowerCase()})${cuenta.status === 9 ? ', aunque sigue entregando' : ''}`;
}

/**
 * La respuesta, con lo que hay. `filasMeta`: cuántas filas de Meta hay en el mes (0 = ningún dato; null = no se pudo
 * contar). `ultimoDiaConGasto`: el último día con gasto > 0 (de cualquier fecha). Nunca «sin sincronizar»: si no hay datos,
 * lo dice; si la cuenta está frenada, lo dice; si no se pudo leer, «no lo tengo».
 */
export function textoGastoMeta(p: {
  mes: { desde: string; hasta: string; nombre: string }; gasto: GastoDelMes | null; filasMeta: number | null;
  ultimoDiaConGasto: string | null; cuenta: CuentaMeta | null;
}): string {
  const frenada = porQueNoGasta(p.cuenta);
  const espera = enEsperaEnMeta(p.cuenta);
  const enMes = `En ${p.mes.nombre}`;
  if (p.filasMeta == null || p.gasto == null) return `No tengo el gasto de Meta Ads de ${p.mes.nombre}: no pude leer tus números ahora.`;
  if (p.filasMeta === 0) {
    return frenada
      ? `${enMes} no hay gasto de Meta Ads: ${frenada}, y mientras no se resuelva no gasta.`
      : `No tengo gasto de Meta Ads de ${p.mes.nombre}: no hay ni un dato de Meta en ese mes (la cuenta no está conectada o no corrió ningún anuncio).`;
  }
  const base = `${enMes} llevas ${montoDelGasto(p.gasto)} en Meta Ads (del ${fechaCorta(p.mes.desde)} al ${fechaCorta(p.mes.hasta)}).`;
  // Frenada y sin gasto desde un día de este mes: desde cuándo.
  if (frenada && p.ultimoDiaConGasto && p.ultimoDiaConGasto >= p.mes.desde && p.ultimoDiaConGasto < p.mes.hasta) {
    return `${base} Desde el ${fechaCorta(p.ultimoDiaConGasto)} no gasta: ${frenada}.`;
  }
  return frenada ? `${base} Ojo: ${frenada}.` : espera ? `${base} Ojo: ${espera}.` : base;
}
