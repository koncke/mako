// =============================================================================
// /m/ads — las lecturas: las MISMAS de la tabla de escritorio (app/ads-manager), ya filtradas y
// formateadas para la forma del teléfono
// =============================================================================
// ⚠️ ACÁ NO SE ESCRIBE NINGUNA CONSULTA. Cada cosa sale de donde la saca escritorio:
//   · El ÁRBOL en vivo (campañas, conjuntos, anuncios, estado, presupuestos, problemas) →
//     `getMetaHealth` (lib/meta-health.ts), lo que escritorio pide a /api/meta-health. Con el mismo
//     corte previo de esa ruta: sin la integración conectada no se le pregunta nada a Meta.
//   · El RENDIMIENTO del período (gasto, agendas) → `getSenalesRecon` (lib/queries.ts), lo mismo que
//     AdsManagerView le pasa a la tabla. El gasto ya viene en dólares: adentro pasa por
//     `conversorGastoMeta` (lib/moneda-meta.ts). Aquí se pide el conversor SÓLO para saber en qué
//     unidad quedó: con una moneda conocida SIN tasa (ARS, EUR…) `aUsdNum` deja el monto crudo, y
//     dibujarlo como «US$» sería mentir.
//   · El resultado es la AGENDA (`agendas_meta`, «Programaciones» de Meta) y el coste por resultado
//     gasto ÷ agendas: las columnas «Resultados» y «Coste/resultado» de escritorio.
//
// ⚠️ El workspace NUNCA sale de la URL: lo resuelven `requireMovil` y cada lectura
//    (getWorkspaceActual adentro de cachedRead).
// =============================================================================

import 'server-only';
import { integracionConectada } from '@/lib/credenciales';
import { getMetaHealth } from '@/lib/meta-health';
import { getSenalesRecon, type SenalRecon } from '@/lib/queries';
import { conversorGastoMeta } from '@/lib/moneda-meta';
import { editaPresupuestoAca, esConvertible } from '@/lib/presupuesto-cambio';
import {
  esAprobacionPendiente, explicarIssueEs, linkAprobarEnMeta, type MetaHealth, type NodoEstado,
} from '@/lib/meta-health-ui';
import {
  agendasTexto, anunciosEnRojoPorCampana, dinero, estaArchivada, estadoTexto, hijosParaActivar, perfPorCampana, rangoAds,
  type CampanaM, type LecturaAds, type PeriodoAdsId, type PresupuestoM, type ProblemaM, type ResumenM,
} from './modelo';

const log = (donde: string, e: unknown) => console.error(`[m/ads] ${donde}: ${e instanceof Error ? e.message : String(e)}`);

/** El token de Meta vencido o revocado (code 190): se arregla reconectando, no reintentando. */
function esTokenVencido(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return e.name === 'MetaHealthTokenError' || /Token Meta inválido/i.test(e.message);
}

/** Lo que dice «Por qué no está entregando» de un anuncio: el título de `explicarIssueEs`. */
function problemaDe(ad: NodoEstado): ProblemaM {
  // Sin issues de Meta, el estado mismo es el motivo (lo mismo que el modal de escritorio).
  const issues = ad.issues?.length ? ad.issues : [{ resumen: ad.statusLabel, mensaje: '' }];
  return { id: ad.id, nombre: ad.name, motivo: explicarIssueEs(issues[0]).titulo };
}

/**
 * El botón de Meta del sheet. Con UN anuncio, abre ese anuncio en el Ads Manager de Meta; con
 * varios, la lista de anuncios de la cuenta. El rótulo nombra lo que se va a hacer allá.
 */
function enMetaDe(ads: NodoEstado[], pago: boolean, accountId: string | null): CampanaM['enMeta'] {
  if (!ads.length && !pago) return null;
  const href = linkAprobarEnMeta(accountId, ads.length === 1 ? ads[0].id : null);
  const aprobar = ads.some((a) => (a.issues ?? []).some(esAprobacionPendiente));
  const rechazado = ads.some((a) => a.effectiveStatus === 'DISAPPROVED');
  const rotulo = aprobar ? 'Aprobar en Meta' : rechazado ? 'Pedir revisión en Meta' : 'Abrir en Meta';
  return { href, rotulo };
}

/**
 * Los presupuestos DIARIOS editables de una campaña: el suyo si es CBO; si no, el de cada conjunto
 * (ABO). `editaPresupuestoAca` es la regla de la celda y del lote de escritorio: nunca un diario
 * sobre un presupuesto TOTAL.
 */
function presupuestosDe(c: NodoEstado, adsets: NodoEstado[]): PresupuestoM[] {
  if (editaPresupuestoAca(c, 'campaign')) return [{ nivel: 'campaign', id: c.id, nombre: c.name, diario: c.dailyBudgetMxn as number }];
  return adsets
    .filter((a) => a.parentId === c.id && editaPresupuestoAca(a, 'adset') && a.effectiveStatus !== 'ARCHIVED' && a.effectiveStatus !== 'DELETED')
    .map((a) => ({ nivel: 'adset' as const, id: a.id, nombre: a.name, diario: a.dailyBudgetMxn as number }));
}

function armar(health: MetaHealth, senales: SenalRecon[] | null, unidadGasto: string): { campanas: CampanaM[]; resumen: ResumenM | null } {
  const accountId = health.account.accountId;
  // «Error en el pago» de escritorio: la cuenta en rojo o con saldo impago (status 3).
  const pagoFrenado = health.account.severidad === 'rojo' || health.account.status === 3;
  const perf = senales ? perfPorCampana(senales) : null;
  const rojos = anunciosEnRojoPorCampana(health.adsets, health.ads);

  const filas = health.campaigns.map((c): { campana: CampanaM; gasto: number } => {
    const p = perf?.get(c.name) ?? { gasto: 0, agendas: 0 };
    const activa = c.effectiveStatus === 'ACTIVE';
    const ads = rojos.get(c.id) ?? [];
    const estadoRojo = c.semaforo === 'rojo' ? c.statusLabel : null;
    const total = c.budgetLevel === 'campaign' && c.dailyBudgetMxn == null && c.lifetimeBudgetMxn != null ? c.lifetimeBudgetMxn : null;
    return {
      gasto: p.gasto,
      campana: {
        id: c.id,
        nombre: c.name,
        activa,
        configuradaActiva: c.configuredStatus === 'ACTIVE',
        estado: estadoTexto(c.effectiveStatus, c.statusLabel),
        archivada: estaArchivada(c.effectiveStatus),
        gasto: perf ? dinero(p.gasto, unidadGasto) : null,
        agendas: p.agendas,
        costo: perf ? (p.agendas > 0 ? dinero(p.gasto / p.agendas, unidadGasto) : '—') : null,
        presupuestos: presupuestosDe(c, health.adsets),
        total,
        problemas: ads.map(problemaDe),
        pagoFrenado,
        estadoRojo,
        enMeta: enMetaDe(ads, pagoFrenado && activa, accountId),
        hijos: hijosParaActivar(c.id, health.adsets, health.ads),
        destacada: activa || p.gasto > 0 || ads.length > 0 || estadoRojo != null,
      },
    };
  });
  // El orden de escritorio (gastado, de mayor a menor); a igual gasto, las activas primero.
  filas.sort((a, b) => (b.gasto - a.gasto)
    || (a.campana.activa === b.campana.activa ? 0 : a.campana.activa ? -1 : 1)
    || a.campana.nombre.localeCompare(b.campana.nombre, 'es'));
  const campanas = filas.map((f) => f.campana);

  let resumen: ResumenM | null = null;
  if (senales) {
    let gasto = 0;
    let agendas = 0;
    for (const s of senales) { gasto += Number(s.spend_usd) || 0; agendas += Number(s.agendas) || 0; }
    resumen = {
      gasto: dinero(gasto, unidadGasto),
      resultados: agendasTexto(agendas),
      costo: agendas > 0 ? dinero(gasto / agendas, unidadGasto) : '—',
    };
  }
  return { campanas, resumen };
}

/**
 * Todo lo que dibuja /m/ads para un período. Nunca tira: cada falla vuelve como un estado que la
 * pantalla dibuja en una frase (sin Meta, token vencido, Meta no contestó). Si sólo falla el
 * rendimiento, el árbol se muestra igual, sin números (como escritorio, que degrada a «—»).
 */
export async function leerAds(periodo: PeriodoAdsId, hoy: string): Promise<LecturaAds> {
  let conectada = false;
  try { conectada = await integracionConectada('meta'); } catch (e) { log('integración', e); return { estado: 'error' }; }
  if (!conectada) return { estado: 'sin_meta' };

  const { desde, hasta } = rangoAds(periodo, hoy);
  const [h, s, conv] = await Promise.allSettled([getMetaHealth(), getSenalesRecon(desde, hasta), conversorGastoMeta()]);

  if (h.status === 'rejected') {
    if (esTokenVencido(h.reason)) return { estado: 'token' };
    log('estado de Meta', h.reason);
    return { estado: 'error' };
  }
  const health = h.value;
  // Sin el edge de campañas (lectura parcial) no se puede afirmar «no hay campañas».
  if (health.parcial && health.campaigns.length === 0) {
    log('estado de Meta', 'lectura parcial sin campañas');
    return { estado: 'error' };
  }
  if (s.status === 'rejected') log('rendimiento', s.reason);

  // En qué unidad quedó el gasto: dólares, salvo una moneda conocida sin tasa (queda cruda).
  // Moneda desconocida: `aUsdNum` convirtió como pesos (y lo avisó en el log): son dólares.
  const moneda = conv.status === 'fulfilled' ? conv.value.moneda : null;
  const unidadGasto = !moneda || esConvertible(moneda) ? 'USD' : moneda;

  const { campanas, resumen } = armar(health, s.status === 'fulfilled' ? s.value : null, unidadGasto);
  const leida = Date.parse(health.inicioLecturaISO ?? '');
  return {
    estado: 'ok',
    campanas,
    resumen,
    moneda: health.account.currency,
    cuentaEstado: health.account.statusLabel,
    leidaDesde: Number.isFinite(leida) ? leida : null,
  };
}
