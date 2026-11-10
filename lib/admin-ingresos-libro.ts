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
//   · UN MES MARCADO A MANO SIN ORDEN (`marcarMesPagado` sin pago) no tiene cuánto entró ni con qué se ataría: no suma, y se dice.
// Que la mensualidad del libro y la del CRM no se cuenten dos veces lo decide `conElLibro` (lib/admin-ingresos-reglas.ts).
//
// Sin `server-only`: lo ejecutan los tests (tests/admin-ingresos-libro.test.ts). La lectura de la base, en lib/admin-ingresos.ts.
// =============================================================================

import { leerOrden, leerPagoDelMes, nombreDelMes } from './agencia-mes-reglas';
import { claveDelCobro, referenciaNormal } from './recibos-reglas';
import { suscripcionDelLibro, type PagoIngreso } from './admin-ingresos-reglas';

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
  /** Las agencias que pagaron algo por su libro (para su nombre y su ficha en el CRM). */
  agencias: number[];
  /** Las órdenes que no se contaron porque ya las cuenta un pago del CRM. */
  atadas: number;
  /** Lo que no suma y hay que decir (los «No pude leer …» de Revenue). */
  avisos: string[];
};

const RE_ORDEN = /^agencia\.mensualidad\.([1-9]\d{0,11})\.orden\.(.+)$/;
const RE_PAGO = /^agencia\.mensualidad\.([1-9]\d{0,11})\.pago\.(\d{4}-(?:0[1-9]|1[0-2]))$/;
const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;
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
 * Las filas del libro (todas las de `PREFIJO_LIBRO` de la plataforma) como pagos de Revenue. `atadas`: las órdenes que ya cuenta un
 * pago del CRM (`ordenesAtadas`). `nombreWs`: el nombre de cada cuenta (el de la entrada de un cliente).
 */
export function pagosDelLibro(filas: readonly FilaLibro[], o: { atadas: ReadonlySet<string>; nombreWs: ReadonlyMap<number, string> }): LibroEnRevenue {
  const pagos: PagoIngreso[] = [];
  const agencias = new Set<number>();
  let atadas = 0;
  let aManoSinOrden = 0;
  for (const f of filas) {
    const mp = RE_PAGO.exec(f.key);
    if (mp) {
      const pago = leerPagoDelMes(f.value);
      if (pago && pago.mes === mp[2] && pago.ordenes.length === 0) aManoSinOrden += 1;
      continue;
    }
    const mo = RE_ORDEN.exec(f.key);
    if (!mo) continue;
    const orden = leerOrden(f.value);
    if (!orden || orden.orden !== mo[2] || !Number.isFinite(orden.montoUsd) || orden.montoUsd <= 0) continue;
    if (o.atadas.has(claveDelCobro('binance', orden.orden))) { atadas += 1; continue; }
    const dia = orden.fecha.slice(0, 10);
    if (!RE_DIA.test(dia)) continue;
    const ag = Number(mo[1]);
    agencias.add(ag);
    const medio = referenciaNormal('binance', orden.orden) ? 'binance' : null;
    for (const p of partes(orden.montoUsd, orden.aplicado)) {
      const mes = p.clave?.startsWith('mes:') ? p.clave.slice(4) : null;
      const entrada = p.clave?.startsWith('entrada:') ? Number(p.clave.slice(8)) : null;
      const quien = entrada != null && Number.isSafeInteger(entrada) && entrada > 0 ? (o.nombreWs.get(entrada) ?? `la cuenta ${entrada}`) : null;
      pagos.push({
        id: `a:${ag}:${orden.orden}:${p.clave ?? 'pago'}`,
        cliente: `ws:${ag}`,
        suscripcion: mes != null && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? suscripcionDelLibro(ag) : null,
        fecha: dia,
        usd: p.usd,
        medio,
        concepto: mes != null ? `Mensualidad de ${nombreDelMes(mes)} ${mes.slice(0, 4)}` : quien != null ? `Entrada de ${quien}` : 'Pago de la mensualidad',
        // Binance no es una pasarela: sin `proveedor` ni `proveedorPagoId`, nadie le ofrece «Devolver el pago». La orden va en el id.
        cobroId: null, proveedor: null, proveedorPagoId: null,
      });
    }
  }
  const avisos = aManoSinOrden
    ? [`lo que entró en ${aManoSinOrden === 1 ? '1 mes de agencia marcado' : `${aManoSinOrden} meses de agencia marcados`} pagado a mano sin su orden (no suma en Revenue)`]
    : [];
  return { pagos, agencias: [...agencias].sort((a, b) => a - b), atadas, avisos };
}
