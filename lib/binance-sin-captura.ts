// =============================================================================
// binance-sin-captura — el pago de una agencia que entró por Binance SIN captura en el grupo, en el servidor (20/11/2026)
// =============================================================================
// Lo corre el cron de cobros cada media hora (app/api/cron/cobros-reconciliar), DESPUÉS de los comprobantes en espera: la captura
// gana. Las reglas y la vuelta, puras, en lib/binance-sin-captura-reglas.ts; acá sólo se enchufan a lo de verdad:
//   · la cuenta: `pagosRecibidosEnBinance` (lib/binance-pay.ts, la clave de SÓLO LECTURA: nada de esto mueve plata);
//   · el registro de «usado»: `ordenesAnotadas` (los libros de todas las agencias y los recibos), el mismo del camino con captura;
//   · aplicar: `aplicarPagoVerificado` (lib/agencia-mes-comprobante.ts), el MISMO del camino con captura: el libro con la orden una vez
//     (compare-and-set), el recibo, las cuentas en pausa que vuelven a entrar y el texto a la agencia («Recibí tu pago de US$ 97 por
//     Binance…»);
//   · a Martín: `avisarAMartin` con la pendiente de siempre (`proponerComprobanteAMartin`): su «aprobado» la aplica;
//   · lo aprendido de quién paga, en la plataforma: `binance.pagadores.<agencia>`; y las órdenes de las que ya se le avisó a Martín,
//     `binance.sincaptura.<orden>` (una vez: compare-and-set).
// En seco (`enSeco: true`, scripts/binance-sin-captura-en-seco.mts) no escribe nada: dice qué haría con cada pago.
// =============================================================================

import 'server-only';
import { getTenantDb, runWithWorkspace, wsSuperAdmin } from './workspace';
import { getSupabaseServer } from './supabase';
import { cambiarSettingSi, setSetting } from './settings';
import { agenciasConMensualidad, avisarAMartin, mensualidadDeAgencia } from './agencia-mes';
import { aplicarPagoVerificado, fechaLocal, loQueDebe, ordenesAnotadas, proponerComprobanteAMartin } from './agencia-mes-comprobante';
import { asignarPago, usd } from './agencia-mes-reglas';
import { esDolarBinance, HORAS_ANTES } from './binance-pay-reglas';
import { leerPagadores, porqueNoCierra, vueltaSinCaptura, type AgenciaVista, type DepsSinCaptura, type Pagadores, type ResumenSinCaptura } from './binance-sin-captura-reglas';

const PREFIJO_PAGADORES = 'binance.pagadores.';
const PREFIJO_AVISO = 'binance.sincaptura.';
const AUTOR = 'MaKo · pago de Binance sin captura';
const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const redondo = (n: number) => Math.round(n * 100) / 100;

/** LA VUELTA DEL CRON (o en seco, para mirarla). Nunca tira. */
export async function revisarPagosSinCaptura(o: { ahora?: number; enSeco?: boolean; desde?: number } = {}): Promise<ResumenSinCaptura> {
  return vueltaSinCaptura(depsDelServidor(), o);
}

/**
 * Los comprobantes que la agencia mandó al grupo en los últimos `HORAS_ANTES` y no se cerraron (leídos, sin aplicar, ni repetidos): el pago
 * del que habla cada uno lo resuelve ese camino (la espera, o Martín con la pendiente). null = no se pudo leer (ningún pago se toca).
 */
async function comprobantesSinCerrar(ws: number, ahora: number): Promise<Array<{ operacion: string | null; monto: number | null }> | null> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { data, error } = await db.from('comprobantes_leidos').select('operacion, monto').eq('origen', 'grupo').is('aplicado_a', null)
      .not('resultado', 'in', '(repetido,no_es)').gte('created_at', new Date(ahora - HORAS_ANTES * 3_600_000).toISOString()).limit(50);
    if (error) { console.warn(`[binance-sin-captura] agencia ${ws}: no pude leer sus comprobantes del grupo: ${error.message}`); return null; }
    return ((data ?? []) as Array<{ operacion: string | null; monto: number | string | null }>).map((f) => ({ operacion: f.operacion, monto: f.monto == null ? null : Number(f.monto) }));
  }).catch(() => null);
}

/** El día y la hora de un pago, como los lee Martín (hora de Argentina). */
const cuando = (ms: number): string => {
  const f = fechaLocal(ms, 'America/Argentina/Buenos_Aires');
  return `${f.slice(8, 10)}/${f.slice(5, 7)} ${f.slice(11, 16)}`;
};

function depsDelServidor(): DepsSinCaptura {
  return {
    leerCuenta: async (desde, hasta) => (await import('./binance-pay')).pagosRecibidosEnBinance(desde, hasta),
    ordenesAnotadas,
    agencias: async (ahora) => {
      const wsP = await wsSuperAdmin();
      const ids = await agenciasConMensualidad();
      let errores = 0;
      const guardados = new Map<number, Pagadores>();
      const g = await getSupabaseServer().from('app_settings').select('key, value').eq('workspace_id', wsP).like('key', `${PREFIJO_PAGADORES}%`).limit(500);
      if (g.error) errores++;
      for (const f of (g.data ?? []) as Array<{ key: string; value: string }>) {
        const ws = Number(f.key.slice(PREFIJO_PAGADORES.length));
        if (Number.isInteger(ws) && ws > 0) guardados.set(ws, leerPagadores(f.value));
      }
      const vistas: AgenciaVista[] = [];
      for (const ws of ids) {
        const m = await mensualidadDeAgencia(ws, new Date(ahora)).catch((e) => ({ ok: false as const, error: msg(e) }));
        if (!m.ok) { errores++; console.warn(`[binance-sin-captura] agencia ${ws}: no pude leer su mensualidad: ${m.error}`); continue; }
        if (!m.config) continue;
        vistas.push({
          agenciaWs: ws, nombre: m.agencia, pendientes: m.pendientes, ordenes: [...m.libro.ordenes.keys()],
          guardados: guardados.get(ws) ?? { ids: [], nombres: [] }, comprobantesSinCerrar: await comprobantesSinCerrar(ws, ahora),
        });
      }
      return { vistas, errores };
    },
    avisados: async () => {
      const wsP = await wsSuperAdmin();
      const { data, error } = await getSupabaseServer().from('app_settings').select('key').eq('workspace_id', wsP).like('key', `${PREFIJO_AVISO}%`).limit(2000);
      // Sin leerlos, igual no se repite: `marcarAvisado` es compare-and-set.
      if (error) return new Set<string>();
      return new Set(((data ?? []) as Array<{ key: string }>).map((f) => f.key.slice(PREFIJO_AVISO.length)));
    },
    guardarPagadores: async (ws, p) => {
      await runWithWorkspace(await wsSuperAdmin(), () => setSetting(`${PREFIJO_PAGADORES}${ws}`, JSON.stringify({ ...p, at: new Date().toISOString() })));
    },
    aplicar: async ({ agenciaWs, mov }) => {
      // Lo que se debe AHORA. Si no se pudo leer, tira: la vuelta lo cuenta como error y la próxima lo vuelve a intentar.
      const m = await mensualidadDeAgencia(agenciaWs);
      if (!m.ok) throw new Error(m.error);
      if (!m.config) return { tipo: 'nada', que: 'la mensualidad se apagó' };
      // Otra corrida (o la captura) la acaba de anotar: es repetida, no «no cierra».
      if (m.libro.ordenes.has(mov.orderId)) return { tipo: 'repetido', que: 'la orden ya estaba anotada' };
      const monto = redondo(mov.monto);
      if (asignarPago(monto, m.pendientes).tipo !== 'cubre') return { tipo: 'revisar', porque: porqueNoCierra(monto, m.pendientes) };
      const r = await aplicarPagoVerificado(m, { orden: mov.orderId, monto, moneda: mov.moneda, fecha: fechaLocal(mov.at, m.zona), comprobante: null, lecturaId: null }, undefined, { medio: 'Binance', autor: AUTOR });
      if (r.tipo === 'revisar') return { tipo: 'revisar', porque: r.porque };
      if (r.tipo === 'aplicado') console.log(`[binance-sin-captura] ${m.agencia}: ${usd(monto)} (orden ${mov.orderId}) aplicado sin captura: ${r.que}`);
      return r;
    },
    marcarAvisado: async (orderId, porque) =>
      runWithWorkspace(await wsSuperAdmin(), () => cambiarSettingSi(`${PREFIJO_AVISO}${orderId}`.slice(0, 200), null, JSON.stringify({ porque: porque.slice(0, 500), at: new Date().toISOString() }))),
    avisarAMartin: async ({ agenciaWs, mov, porque }) => {
      const monto = redondo(mov.monto);
      const m = agenciaWs ? await mensualidadDeAgencia(agenciaWs).catch(() => null) : null;
      const ok = m && m.ok ? m : null;
      const quien = `${mov.pagadorNombre ?? 'alguien sin nombre'}${mov.pagadorId ? ` (Binance ID ${mov.pagadorId})` : ''}`;
      const cuanto = esDolarBinance(mov.moneda) ? usd(monto) : `${mov.monto} ${mov.moneda}`;
      // La pendiente de siempre: su «aprobado» a este aviso la aplica (sólo en dólares y con algo que se debe).
      const propuesta = ok && ok.config && esDolarBinance(mov.moneda)
        ? await proponerComprobanteAMartin(ok, {
          agenciaWs: ok.agenciaWs, orden: mov.orderId, monto, moneda: mov.moneda, fecha: fechaLocal(mov.at, ok.zona), comprobante: null, lecturaId: null,
          waMensajeId: '', recibidoAt: new Date(mov.at).toISOString(), claves: null,
        }).catch(() => null)
        : null;
      const deQuien = ok ? ` que parece de ${ok.agencia} (cuenta ${ok.agenciaWs}): ya le pagó a MaKo por ella desde esa cuenta` : '';
      const texto = `Entró por Binance un pago de ${cuanto} de ${quien} (orden ${mov.orderId}, ${cuando(mov.at)})${deQuien}. No mandó captura al grupo y no lo apliqué solo: ${porque}.`
        + `${ok ? ` Lo que debía: ${loQueDebe(ok.pendientes)}.` : ''}`
        + `${propuesta ? ` ${propuesta} Si está bien, ¿lo marco como pagado? Con tu «aprobado» queda hecho.` : ''}`;
      await avisarAMartin(texto);
    },
  };
}
