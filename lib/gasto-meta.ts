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

/** ¿Pregunta cuánto gastó o invirtió en Meta (o en anuncios)? */
const PREGUNTA = /(?<!\p{L})(?:cu[aá]nto|qu[eé])(?!\p{L})[^?\n]{0,40}(?<!\p{L})(?:gast|invert|invirt|llev|van|va)\p{L}*[^?\n]{0,50}(?<!\p{L})(?:meta|facebook|instagram|anuncios?|ads|pauta|campa[ñn]as?)(?!\p{L})/iu;
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

/** Los estados de una cuenta de Meta que NO entregan (lib/meta-health.ts, `account_status`). */
const NO_ENTREGA = new Set([2, 3, 7, 8, 9, 100, 101]);
export type CuentaMeta = { status: number; statusLabel: string; disableReasonLabel?: string | null; nombre?: string | null };

const usd = (n: number) => `US$ ${n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fechaCorta = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;

/** Por qué la cuenta no gasta, dicho como lo dice Meta. null = la cuenta entrega (o no se pudo leer). */
export function porQueNoGasta(cuenta: CuentaMeta | null | undefined): string | null {
  if (!cuenta || !NO_ENTREGA.has(cuenta.status)) return null;
  const de = cuenta.nombre ? ` «${cuenta.nombre}»` : '';
  const motivo = cuenta.status === 3 ? 'por saldo impago' : `(${cuenta.statusLabel.toLowerCase()}${cuenta.disableReasonLabel ? `: ${cuenta.disableReasonLabel}` : ''})`;
  return `Meta frenó la cuenta${de} ${motivo}`;
}

/**
 * La respuesta, con lo que hay. `filasMeta`: cuántas filas de Meta hay en el mes (0 = ningún dato; null = no se pudo
 * contar). `ultimoDiaConGasto`: el último día con gasto > 0 (de cualquier fecha). Nunca «sin sincronizar»: si no hay datos,
 * lo dice; si la cuenta está frenada, lo dice; si no se pudo leer, «no lo tengo».
 */
export function textoGastoMeta(p: {
  mes: { desde: string; hasta: string; nombre: string }; gastoUsd: number | null; filasMeta: number | null;
  ultimoDiaConGasto: string | null; cuenta: CuentaMeta | null;
}): string {
  const frenada = porQueNoGasta(p.cuenta);
  const enMes = `En ${p.mes.nombre}`;
  if (p.filasMeta == null || p.gastoUsd == null) return `No tengo el gasto de Meta Ads de ${p.mes.nombre}: no pude leer tus números ahora.`;
  if (p.filasMeta === 0) {
    return frenada
      ? `${enMes} no hay gasto de Meta Ads: ${frenada}, y mientras no se resuelva no gasta.`
      : `No tengo gasto de Meta Ads de ${p.mes.nombre}: no hay ni un dato de Meta en ese mes (la cuenta no está conectada o no corrió ningún anuncio).`;
  }
  const base = `${enMes} llevas ${usd(p.gastoUsd)} en Meta Ads (del ${fechaCorta(p.mes.desde)} al ${fechaCorta(p.mes.hasta)}).`;
  // Frenada y sin gasto desde un día de este mes: desde cuándo.
  if (frenada && p.ultimoDiaConGasto && p.ultimoDiaConGasto >= p.mes.desde && p.ultimoDiaConGasto < p.mes.hasta) {
    return `${base} Desde el ${fechaCorta(p.ultimoDiaConGasto)} no gasta: ${frenada}.`;
  }
  return frenada ? `${base} Ojo: ${frenada}.` : base;
}
