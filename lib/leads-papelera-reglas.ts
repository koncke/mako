// =============================================================================
// leads-papelera-reglas — la papelera del CRM: cuánto vive un lead ahí y cómo se dice (puro)
// =============================================================================
// «Eliminar» un lead (la barra en bloque, el «Eliminar» de su tarjeta, el de su ficha) lo manda a la PAPELERA (mig 0340):
// el lead se borra como siempre y queda su FOTO, con la que vuelve igual, con sus mismos ids, durante `DIAS_PAPELERA_LEADS`
// días. Después la purga diaria (/api/cron/leads-papelera) la borra y ya no vuelve. Pedido de Leila (ticket #22, 28/10/2026:
// «Los podemos borrar de ahí») y la regla del Cerebro: «Eliminar en bloque que NO borra para siempre».
//
// Sin 'server-only', a propósito: lo ejecuta tests/crm-acciones-bloque.test.ts.

/** Cuántos días se puede recuperar un lead eliminado. */
export const DIAS_PAPELERA_LEADS = 30;

/**
 * De a cuántos leads va cada llamada a la base. La foto de un lead son unas 40 consultas adentro de la función (una por tabla
 * que cuelga de él, hasta el punto fijo): 25 por llamada la deja en segundos, lejos de cualquier plazo.
 */
export const TANDA_PAPELERA = 25;

/** Cuántos días le quedan a algo que se purga en `purgarAt`. Redondea hacia arriba: «queda 1 día» hasta la última hora. */
export function diasQuedan(purgarAt: string | null | undefined, ahoraMs: number): number {
  const t = purgarAt ? Date.parse(purgarAt) : NaN;
  if (!Number.isFinite(t)) return DIAS_PAPELERA_LEADS;
  return Math.max(0, Math.ceil((t - ahoraMs) / 86_400_000));
}

export function textoQuedan(dias: number): string {
  if (dias <= 0) return 'Se borra hoy';
  return dias === 1 ? 'Queda 1 día' : `Quedan ${dias} días`;
}

/** La misma pregunta en la barra, la tarjeta y la ficha: cuántos, a dónde van y hasta cuándo vuelven. */
export function preguntaDePapelera(n: number, nombre?: string | null): { titulo: string; mensaje: string } {
  const quien = n === 1 && nombre ? `a «${nombre}»` : `${n} ${n === 1 ? 'lead' : 'leads'}`;
  return {
    titulo: `¿Mandar ${quien} a la papelera?`,
    mensaje: `Salen del CRM con su historial y sus pagos, y no les llega nada. Durante ${DIAS_PAPELERA_LEADS} días los recuperas tal cual desde «Papelera» (en el menú de funnels); después se borran para siempre.`,
  };
}

/** Lo que vuelve de la base por cada lead (mig 0340). */
export type ResultadoPapelera = { lead_id: number; ok: boolean; error?: string; codigo?: string };

/** El motivo de un lead que no se pudo mandar o recuperar, en palabras de quien lo lee. */
export function motivoDePapelera(r: Pick<ResultadoPapelera, 'error' | 'codigo'>, al: 'mandar' | 'recuperar'): string {
  if (r.codigo === 'P0002') return al === 'mandar' ? 'ya no estaba en el CRM' : 'ya no estaba en la papelera';
  if (r.codigo === '23505') return 'ya hay otro lead con sus mismos datos (volvió a llegar): no se recuperó para no duplicarlo';
  if (r.codigo === '23503') return al === 'mandar' ? 'algo de otro lado lo necesita y no deja borrarlo' : 'falta algo a lo que apuntaba (se borró en estos días)';
  return r.error ? r.error.replace(/^papelera:\s*/, '') : 'no se pudo';
}

/** Agrupa los resultados: cuántos salieron bien y el motivo de cada uno que no (sin repetir el mismo motivo). */
export function contarPapelera(rs: readonly ResultadoPapelera[], al: 'mandar' | 'recuperar'): { ok: number[]; fallaron: number; motivos: string[] } {
  const ok: number[] = [];
  const motivos = new Set<string>();
  let fallaron = 0;
  for (const r of rs) {
    if (r.ok) ok.push(Number(r.lead_id));
    else { fallaron += 1; motivos.add(motivoDePapelera(r, al)); }
  }
  return { ok, fallaron, motivos: [...motivos] };
}

/** ¿El error de la base dice que la función no existe (la migración 0340 todavía no se aplicó)? */
export const faltaLaPapelera = (e: { code?: string; message?: string } | null | undefined): boolean =>
  !!e && (e.code === 'PGRST202' || e.code === '42883' || e.code === '42P01' || e.code === 'PGRST205'
    || /could not find the (function|table)|function .* does not exist|relation .* does not exist/i.test(e.message ?? ''));

export const FALTA_LA_PAPELERA = 'La papelera del CRM todavía no está lista (falta la migración 0340): no se borró nada.';
