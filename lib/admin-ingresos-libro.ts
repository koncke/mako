// =============================================================================
// admin-ingresos-libro — lo que las AGENCIAS le pagan a MaKo por su libro, como pagos de Admin › Revenue (10/11/2026)
// =============================================================================
// Martín, 10/11/2026: «recibimos un pago de Código por el cliente de Patricia y no se cargó automáticamente en admin». Revenue
// (lib/admin-ingresos.ts) leía dos fuentes: los `pagos` del CRM de la plataforma y los `cobros` de la pasarela. La mensualidad de
// una agencia entra por OTRO lado desde el 6/11: el libro de lib/agencia-mes.ts, en `app_settings` de la plataforma, que anota cada
// orden de Binance UNA vez (`agencia.mensualidad.<ag>.orden.<ORDEN>`) y saca el recibo, sin escribir en `pagos`. La entrada de
// Patricia (9/11, 40 USDT) quedó ahí, con su recibo, y Revenue no la veía. Desde diciembre, todo lo que pague Código entra así.
//
// LA TERCERA FUENTE, AL LEER Y SIN ESCRIBIR (el diseño del encargo, docs/relevo/encargos-admin-10-11.md): cada orden del libro es
// un ingreso, sin cargarla a mano y sin una fila en `pagos`. Así cubre lo pasado y lo que viene, y nada se escribe dos veces.
//   · CUÁNTO: lo RECIBIDO (`montoUsd` de la orden: 40, no los 40,73 que se debían). El tipo de cambio lo declaró quien la anotó.
//   · CUÁNDO: el día de la orden como lo anota el libro (`fecha.slice(0, 10)`, igual que `pagadoEl`): el comprobante trae la hora
//     de la agencia SIN zona, y pasarla por `diaEnLaZona` la leería como UTC y la podría correr un día.
//   · DE QUIÉN: de la AGENCIA (`ws:<ag>`), como un cobro con `agencia_ws`: la entrada de un cliente suyo la paga la agencia.
//   · MRR O CASH: lo aplicado a un mes (`mes:<AAAA-MM>`) es la mensualidad (recurrente, `agencia:<ag>`); lo aplicado a una entrada
//     (`entrada:<cliente>`) es cash, nunca MRR. Una orden repartida se parte según `aplicado`, en proporción a lo que se debía.
//   · UNA VEZ: una orden atada a un pago del CRM (`recibo_pagos.pago_id`, mig 0408: «Cargar pago» la registró ahí) ya la cuenta
//     ese pago. Se compara con la referencia normalizada de los recibos (`claveDelCobro`), la misma que usa «Cargar pago».
//   · LO MARCADO A MANO SIN ORDEN (un mes con `marcarMesPagado` sin pago, una entrada con `marcarEntradaPagada` sin pago, que
//     anota una orden `AMANO…` por lo que SE DEBÍA): no se sabe cuánto entró ni con qué atarlo, y si se cargó también con «Cargar
//     pago» se contaría dos veces. No suma, y se dice (revisión del 10/11: contaba lo debido como cobrado).
//   · EL MRR POR MES (revisión del 10/11): el libro dice de qué MES es cada parte, y eso vale más que la fecha del pago. Un mes pagado
//     en dos partes con más de 7 días entre ellas daba de MRR la última parte, y dos meses pagados juntos daban el doble. Así que
//     cada agencia lleva su «historia» (`ProximoDeSuscripcion.mensualidad`: lo que entró para cada mes), y `conMensualidad`
//     (lib/admin-ingresos-reglas.ts) le pone a cada mes lo suyo. Lo que viene, el día 5 del mes que falta (el límite del libro).
// Que la mensualidad del libro y la del CRM no se cuenten dos veces lo decide `conElLibro` (lib/admin-ingresos-reglas.ts).
//
// Sin `server-only`: lo ejecutan los tests (tests/admin-ingresos-libro.test.ts). La lectura de la base, en lib/admin-ingresos.ts.
// =============================================================================

import { cubre, diaLimite, leerOrden, leerPagoDelMes, mesSiguiente, nombreDelMes, type PagoDelMes } from './agencia-mes-reglas';
import { claveDelCobro, referenciaNormal } from './recibos-reglas';
import { suscripcionDelLibro, type PagoIngreso, type ProximoDeSuscripcion } from './admin-ingresos-reglas';

/** El prefijo de todo el libro de las agencias en `app_settings` de la plataforma (lib/agencia-mes.ts, `PREFIJO`). */
export const PREFIJO_LIBRO = 'agencia.mensualidad.';

/** Una fila de `app_settings` (la clave y su valor en texto). */
export type FilaLibro = { key: string; value: string };

/** Un cobro de un recibo, lo que hace falta para saber si una orden ya está en el CRM. */
export type CobroDeRecibo = { medio: string; referencia: string; pago_id: number | null; anulado: boolean };

/** Las órdenes que ya cuenta un pago del CRM: sus claves (`claveDelCobro`). */
export function ordenesAtadas(cobros: readonly CobroDeRecibo[]): Set<string> {
  const out = new Set<string>();
  for (const c of cobros) if (!c.anulado && c.pago_id != null) out.add(claveDelCobro(String(c.medio), String(c.referencia)));
  return out;
}

export type LibroEnRevenue = {
  /** Los pagos que entran a Revenue (`a:<ag>:<orden>:<clave>`), uno por parte de cada orden. */
  pagos: PagoIngreso[];
  /** Lo que el libro dice de cada mensualidad (`agencia:<ag>`): cuánto entró para cada mes y lo próximo. Va a `calcularIngresos`. */
  proximos: Map<string, ProximoDeSuscripcion>;
  /** Las agencias que pagaron algo por su libro (para su nombre y su ficha en el CRM). */
  agencias: number[];
  /** Las órdenes que no se contaron porque ya las cuenta un pago del CRM. */
  atadas: number;
  /** Lo que no suma y hay que decir (los «No pude leer …» de Revenue). */
  avisos: string[];
};

const RE_ORDEN = /^agencia\.mensualidad\.([1-9]\d{0,11})\.orden\.(.+)$/;
const RE_PAGO = /^agencia\.mensualidad\.([1-9]\d{0,11})\.pago\.(\d{4}-(?:0[1-9]|1[0-2]))$/;
const RE_CONFIG = /^agencia\.mensualidad\.([1-9]\d{0,11})\.config$/;
const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;
const RE_MES = /^\d{4}-(0[1-9]|1[0-2])$/;
/** La orden que anota `marcarEntradaPagada` cuando no hay orden de verdad (lib/agencia-mes.ts): `AMANO<cliente><día>`. */
const ES_A_MANO = /^AMANO/;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Las partes de una orden: lo recibido repartido según lo que se aplicó a cada pendiente. La última se lleva el redondeo. */
function partes(montoUsd: number, aplicado: readonly unknown[]): Array<{ clave: string | null; usd: number }> {
  const validas = aplicado
    .map((a) => a as { clave?: unknown; montoUsd?: unknown })
    .filter((a): a is { clave: string; montoUsd: number } => typeof a?.clave === 'string' && typeof a.montoUsd === 'number' && Number.isFinite(a.montoUsd) && a.montoUsd > 0);
  const peso = validas.reduce((s, a) => s + a.montoUsd, 0);
  if (!validas.length || !(peso > 0)) return [{ clave: null, usd: r2(montoUsd) }];
  let dado = 0;
  return validas.map((a, i) => {
    const usd = i === validas.length - 1 ? r2(montoUsd - dado) : r2((montoUsd * a.montoUsd) / peso);
    dado = r2(dado + usd);
    return { clave: a.clave, usd };
  });
}

/**
 * Lo que el libro dice de la mensualidad de UNA agencia: lo que entró para cada mes y lo próximo. Lo próximo es lo que falta del
 * último mes pagado (si se pagó a medias), o el mes siguiente entero, con su día límite (el 5): atrasado desde ese día. Con la
 * mensualidad apagada (sin `config`), no se espera nada más.
 */
function historiaDelLibro(porMes: ReadonlyMap<string, number>, pagoDe: ReadonlyMap<string, PagoDelMes>, prendida: boolean, hoy: string): ProximoDeSuscripcion {
  const meses = [...porMes.keys()].sort();
  const ultimo = meses[meses.length - 1];
  const ultimoUsd = r2(porMes.get(ultimo) ?? 0);
  const mensualidad = { meses: meses.map((mes) => ({ mes, usd: r2(porMes.get(mes) ?? 0) })), hoyUsd: porMes.get(hoy.slice(0, 7)) ?? ultimoUsd, corte: null };
  if (!prendida) return { sinCobro: true, atrasado: null, siguiente: null, mensualidad };
  const pago = pagoDe.get(ultimo);
  const debe = pago && !cubre(pago.pagadoUsd, pago.totalUsd)
    ? { fecha: diaLimite(ultimo), usd: r2(pago.totalUsd - pago.pagadoUsd) }
    : { fecha: diaLimite(mesSiguiente(ultimo)), usd: ultimoUsd };
  return debe.fecha <= hoy ? { sinCobro: false, atrasado: debe, siguiente: null, mensualidad } : { sinCobro: false, atrasado: null, siguiente: debe, mensualidad };
}

/**
 * Las filas del libro (todas las de `PREFIJO_LIBRO` de la plataforma) como pagos de Revenue. `atadas`: las órdenes que ya cuenta un
 * pago del CRM (`ordenesAtadas`). `nombreWs`: el nombre de cada cuenta (el de la entrada de un cliente). `hoy`: el día de la
 * plataforma (lo próximo de cada mensualidad).
 */
export function pagosDelLibro(filas: readonly FilaLibro[], o: { atadas: ReadonlySet<string>; nombreWs: ReadonlyMap<number, string>; hoy: string }): LibroEnRevenue {
  const pagos: PagoIngreso[] = [];
  const agencias = new Set<number>();
  const prendidas = new Set<number>();
  const pagosDelMes = new Map<number, Map<string, PagoDelMes>>();
  const porMes = new Map<number, Map<string, number>>();
  let atadas = 0;
  let aMano = 0;
  let ilegibles = 0;
  for (const f of filas) {
    const mc = RE_CONFIG.exec(f.key);
    if (mc) { prendidas.add(Number(mc[1])); continue; }
    const mp = RE_PAGO.exec(f.key);
    if (mp) {
      const pago = leerPagoDelMes(f.value);
      if (!pago || pago.mes !== mp[2]) continue;
      if (pago.ordenes.length === 0) aMano += 1;
      const ag = Number(mp[1]);
      pagosDelMes.set(ag, (pagosDelMes.get(ag) ?? new Map()).set(pago.mes, pago));
      continue;
    }
    const mo = RE_ORDEN.exec(f.key);
    if (!mo) continue;
    const orden = leerOrden(f.value);
    const dia = orden?.fecha.slice(0, 10) ?? '';
    if (!orden || orden.orden !== mo[2] || !Number.isFinite(orden.montoUsd) || orden.montoUsd <= 0 || !RE_DIA.test(dia)) { ilegibles += 1; continue; }
    if (ES_A_MANO.test(orden.orden)) { aMano += 1; continue; }
    if (o.atadas.has(claveDelCobro('binance', orden.orden))) { atadas += 1; continue; }
    const ag = Number(mo[1]);
    agencias.add(ag);
    // La orden de Binance, normalizada: con ella Admin › Sales ata la orden a su recibo (`claveDePago`, app/admin/_polar/datos/ventas.ts).
    const ref = referenciaNormal('binance', orden.orden);
    for (const p of partes(orden.montoUsd, orden.aplicado)) {
      const mes = p.clave?.startsWith('mes:') && RE_MES.test(p.clave.slice(4)) ? p.clave.slice(4) : null;
      const entrada = p.clave?.startsWith('entrada:') ? Number(p.clave.slice(8)) : null;
      const quien = entrada != null && Number.isSafeInteger(entrada) && entrada > 0 ? (o.nombreWs.get(entrada) ?? `la cuenta ${entrada}`) : null;
      if (mes != null) {
        const delAg = porMes.get(ag) ?? new Map<string, number>();
        delAg.set(mes, r2((delAg.get(mes) ?? 0) + p.usd));
        porMes.set(ag, delAg);
      }
      pagos.push({
        id: `a:${ag}:${orden.orden}:${p.clave ?? 'pago'}`,
        cliente: `ws:${ag}`,
        suscripcion: mes != null ? suscripcionDelLibro(ag) : null,
        fecha: dia,
        usd: p.usd,
        medio: ref ? 'binance' : null,
        concepto: mes != null ? `Mensualidad de ${nombreDelMes(mes)} ${mes.slice(0, 4)}` : quien != null ? `Entrada de ${quien}` : 'Pago de la mensualidad',
        cobroId: null,
        // Binance no es una pasarela: «Devolver el pago» lo ofrece sólo a un pedido de la pasarela (`c-`), y una orden del libro no
        // es un pedido propio en Sales (su recibo lo es). La orden va acá para atarla a ese recibo.
        proveedor: ref ? 'binance' : null,
        proveedorPagoId: ref,
      });
    }
  }
  const proximos = new Map<string, ProximoDeSuscripcion>();
  for (const [ag, meses] of porMes) {
    proximos.set(suscripcionDelLibro(ag), historiaDelLibro(meses, pagosDelMes.get(ag) ?? new Map(), prendidas.has(ag), o.hoy));
  }
  const avisos: string[] = [];
  if (aMano) avisos.push(`lo que entró en ${aMano === 1 ? '1 pago de agencia marcado' : `${aMano} pagos de agencia marcados`} a mano sin su orden (no suma en Revenue: si entró plata, cárgala con «Cargar pago»)`);
  if (ilegibles) avisos.push(`${ilegibles === 1 ? '1 orden' : `${ilegibles} órdenes`} del libro de las agencias (no suman en Revenue)`);
  return { pagos, proximos, agencias: [...agencias].sort((a, b) => a - b), atadas, avisos };
}
