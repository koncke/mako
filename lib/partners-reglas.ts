// =============================================================================
// partners-reglas — el programa de referidos de MaKo Partners (lo puro, con test)
// =============================================================================
// Pedido de Martín (22/10/2026): «el sistema de referidos con la página de MaKo Partners... que se gestione de manera
// automática... las bienvenidas de las personas que vos referiste con el dashboard de cuánto dinero tenés acumulado...
// y también si es que te ganaste meses gratuitos».
//
// LAS REGLAS son las que Martín DECIDIÓ el 10/10/2026 (docs/referidos.md, «El programa decidido»); no se rediseñan acá:
//   · Cada cliente NUEVO que trae le descuenta al que refiere SU PRIMER MES (el precio de lista del plan del referido:
//     47 o 97), una sola vez. Con un plan de 97: 2 de 47 o 1 de 97 = ese mes no paga. Lo que sobra SE ACUMULA.
//   · Cuenta cuando el referido ya pagó 2 meses: el que entra y se va al mes no le descuenta nada a nadie.
//   · Los revendedores (agencias, capa `agencia`): primero se descuenta su suscripción y lo que sobra se les paga en
//     plata por transferencia local. Los usuarios comunes, sólo descuento acumulable (no se cambia por plata).
//   · Grupal: US$300 en plata por grupal (el 20% de cada cuota cobrada). Lo puede referir cualquiera.
//   · Sin suscripción, alguien que trae un cliente de software no gana nada por él (su canal es el grupal).
//   · El origen que vale es el PRIMERO; sólo clientes nuevos; nadie se refiere a sí mismo.
// =============================================================================

/** La cookie que deja /r/<código>: quién mandó el link. El PRIMERO vale (no se pisa), 60 días. */
export const COOKIE_REF = 'mako_ref';
export const DIAS_COOKIE_REF = 60;

/** Desde cuántos meses PAGADOS del referido se acredita al que refiere (docs/referidos.md: «desde su 2º pago»). */
export const PAGOS_PARA_ACREDITAR = 2;

/** La comisión de un grupal que trae un partner: el 20% de cada cuota cobrada (US$300 de US$1.500). */
export const COMISION_GRUPAL = 0.2;

/** El código público de un negocio, a partir de su nombre: minúsculas, sin acentos, con guiones. 3 a 24 letras. */
export function codigoDesdeNombre(nombre: string, sufijo = ''): string {
  const base = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24).replace(/-+$/g, '');
  const limpio = base.length >= 3 ? base : `mako-${base || 'partner'}`.slice(0, 24);
  return sufijo ? `${limpio.slice(0, 31 - sufijo.length)}-${sufijo}` : limpio;
}

/** El link que comparte un partner. */
export const linkDePartner = (base: string, codigo: string): string => `${base.replace(/\/+$/, '')}/r/${codigo}`;

export type EstadoReferido = 'registrado' | 'primer-pago' | 'acreditado' | 'se-fue';

/**
 * En qué va un referido, con sus meses PAGADOS (cuotas cobradas de su plan) y si su lugar sigue vigente. Acreditado =
 * ya llegó a su 2º pago (el renglón del libro lo dice; esto es para la pantalla mientras tanto).
 */
export function estadoDelReferido(p: { mesesPagados: number; acreditado: boolean; vigente: boolean }): EstadoReferido {
  if (p.acreditado) return 'acreditado';
  if (!p.vigente && p.mesesPagados < PAGOS_PARA_ACREDITAR) return p.mesesPagados > 0 ? 'se-fue' : 'registrado';
  return p.mesesPagados >= 1 ? 'primer-pago' : 'registrado';
}

export const TEXTO_ESTADO_REFERIDO: Readonly<Record<EstadoReferido, string>> = {
  registrado: 'Todavía no pagó',
  'primer-pago': 'Pagó su primer mes',
  acreditado: 'Te sumó crédito',
  'se-fue': 'Se fue antes del 2º pago',
};

/** ¿Este referido ya le acredita al que refiere? (2 meses pagados, y nunca a sí mismo). */
export function correspondeAcreditar(p: { referidorWs: number; referidoWs: number; mesesPagados: number; yaAcreditado: boolean }): boolean {
  return !p.yaAcreditado && p.referidorWs !== p.referidoWs && p.mesesPagados >= PAGOS_PARA_ACREDITAR;
}

/** Lo que vale un referido: el PRIMER MES de su plan, a precio de lista (docs/referidos.md: «un dólar, un peso»). */
export const creditoDelReferido = (precioListaUsd: number): number => Math.round(Math.max(0, precioListaUsd) * 100) / 100;

export type Resumen = { acumuladoUsd: number; usadoUsd: number; saldoUsd: number; mesesGratis: number; aCobrarUsd: number };

/**
 * El tablero del partner con su libro. `precioPropioUsd` es su plan (null = no tiene suscripción: no acumula meses).
 * `revendedor`: lo que sobra después de cubrir su próximo mes se le paga en plata (`aCobrarUsd`); a un usuario común se
 * le acumula en meses.
 */
export function resumenDelLibro(renglones: ReadonlyArray<{ tipo: 'referido' | 'uso' | 'ajuste'; monto_usd: number }>, p: { precioPropioUsd: number | null; revendedor: boolean }): Resumen {
  let acumulado = 0;
  let usado = 0;
  for (const r of renglones) {
    const m = Number(r.monto_usd) || 0;
    if (m > 0) acumulado += m; else usado += -m;
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const saldo = r2(Math.max(0, acumulado - usado));
  const precio = p.precioPropioUsd && p.precioPropioUsd > 0 ? p.precioPropioUsd : null;
  const mesesGratis = precio ? Math.floor(saldo / precio + 1e-9) : 0;
  // El revendedor: su próximo mes se cubre con el crédito y el resto es plata a cobrar.
  const aCobrar = p.revendedor && precio ? r2(Math.max(0, saldo - precio)) : 0;
  return { acumuladoUsd: r2(acumulado), usadoUsd: r2(usado), saldoUsd: saldo, mesesGratis: p.revendedor ? Math.min(mesesGratis, 1) : mesesGratis, aCobrarUsd: aCobrar };
}

/**
 * El programa entero contado (24/10/2026, el panel del super admin en /partners). Puro: lo arma `resumenDelPrograma`
 * (lib/partners-programa.ts) con las filas de la base. Cuenta como `acreditarReferidos`: un negocio nuevo, UNA vez, para el
 * PRIMER código que lo trajo (`compras` en orden de creación), nunca para sí mismo ni para la plataforma; un código que no es
 * de nadie no cuenta.
 */
export function contarPrograma(p: {
  /** El negocio de la plataforma: nunca es partner (`acreditarReferidos` lo saltea). */
  plataforma: number | null;
  codigos: ReadonlyArray<{ workspace_id: number; codigo: string }>;
  compras: ReadonlyArray<{ ref_codigo: string; alta_ws: number }>;
  creditos: ReadonlyArray<{ referidor_ws: number; monto_usd: number }>;
}): { conLink: number; referidos: number; acreditadoUsd: number; porPartner: Map<number, { referidos: number; acreditadoUsd: number }> } {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const dueno = new Map(p.codigos.map((c) => [c.codigo, Number(c.workspace_id)]));
  const traidoPor = new Map<number, number>();
  for (const c of p.compras) {
    const partner = dueno.get(c.ref_codigo);
    const rws = Number(c.alta_ws);
    // El PRIMERO vale aunque no cuente (un código sin dueño, el propio, el de la plataforma): como `acreditarReferidos`,
    // que decide con la compra más vieja de cada negocio y recién después mira de quién es el código. -1 = no es de nadie.
    if (traidoPor.has(rws)) continue;
    traidoPor.set(rws, partner == null || partner === rws || partner === p.plataforma ? -1 : partner);
  }
  const porPartner = new Map<number, { referidos: number; acreditadoUsd: number }>();
  const de = (ws: number) => porPartner.get(ws) ?? { referidos: 0, acreditadoUsd: 0 };
  const contados = [...traidoPor.values()].filter((x) => x !== -1);
  for (const partner of contados) porPartner.set(partner, { ...de(partner), referidos: de(partner).referidos + 1 });
  let acreditado = 0;
  for (const c of p.creditos) {
    const monto = Number(c.monto_usd) || 0;
    acreditado += monto;
    const ws = Number(c.referidor_ws);
    porPartner.set(ws, { ...de(ws), acreditadoUsd: r2(de(ws).acreditadoUsd + monto) });
  }
  return { conLink: p.codigos.length, referidos: contados.length, acreditadoUsd: r2(acreditado), porPartner };
}
