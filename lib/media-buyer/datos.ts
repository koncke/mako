// =============================================================================
// Media Buyer — lo que el agente LEE de una cuenta antes de decidir
// =============================================================================
// Tres cosas, todas del negocio `ws` (explícito: corre en el cron, sin sesión):
//   1. El ÁRBOL de la cuenta en vivo (campañas, conjuntos, anuncios con su interruptor y su presupuesto). Con el token
//      propio de Meta del negocio (lib/meta-health.ts → leerArbolMetaEnVivo); si no tiene token con permisos de
//      anuncios pero conectó su Zernio, por Zernio (la cuenta de MaKo es ese caso: su token es el del botón).
//   2. Lo que REPORTA META por anuncio y por día: gasto, leads, agendas (Programaciones), impresiones, frecuencia.
//      De `marketing_metrics_daily` (el cron meta-daily); si la cuenta no tiene filas y va por Zernio, del árbol
//      de Zernio con desglose diario.
//   3. Lo que pasó DESPUÉS en el CRM: los leads con `meta_ad_id` que ENTRARON en la ventana, cuántos de ellos
//      agendaron, cuántos se ganaron y cuánto pagaron. Por COHORTE (la ventana es la de la entrada del lead): así el
//      gasto de 3 días se compara con los leads de esos 3 días, no con las ventas de un lead de hace un año.
//
// Las ventanas terminan AYER: el día de hoy no está cerrado y comparar medio día contra presupuestos enteros hace
// que todo parezca no gastar. Son 3, 7 y 14 días.
// =============================================================================

import 'server-only';
import { credWs } from '@/lib/credenciales';
import { getTenantDb, runWithWorkspace } from '@/lib/workspace';
import { leerTodo } from '@/lib/supabase-paginado';
import { conversorDeGasto, type ConversorGasto } from '@/lib/presupuesto-cambio';
import { hoyEnTijuana } from '@/lib/date-utils';
import { leerArbolMetaEnVivo } from '@/lib/meta-health';
import { conexionAnunciosZernio, arbolPorZernio } from '@/lib/zernio-ads';
import type { ConexionAnunciosZernio } from '@/lib/zernio-ads-cuerpo';
import { normalizarCuentaMeta } from '@/lib/meta-cuenta-id';
import type { NodoMB, SenalMB } from './motor';
import { diasAntes, ventanas, senalesDeVentana, arbolDesdeZernio, type FilaMetrica, type FilaLeadAd } from './senales';
export { diasAntes, ventanas, senalesDeVentana, arbolDesdeZernio, fmtUnidad, presupuestoMinimoCuenta } from './senales';
export type { FilaMetrica, FilaLeadAd } from './senales';
import type { MetasDelMes } from './tipos';

export type FuenteArbol = 'meta' | 'zernio';

export type DatosCuenta = {
  fuente: FuenteArbol;
  adAccountId: string | null;
  moneda: string | null;
  arbol: NodoMB[];
  corta: SenalMB[];
  larga: SenalMB[];
  crm: SenalMB[];
  conversor: ConversorGasto;
  conexion: ConexionAnunciosZernio | null;
  /** La suma de los presupuestos diarios de lo prendido, en la unidad del gasto (para el tope de la cuenta). */
  totalActivo: number;
  /** Gasto del mes en curso hasta ayer, y la caja del CRM de los leads del mes (las «metas del mes»). */
  mes: { gasto: number; caja: number; resultados: { leads: number; agendas: number; ventas: number } };
  avisos: string[];
};

export class SinCuentaParaOperar extends Error {
  constructor(m: string) { super(m); this.name = 'SinCuentaParaOperar'; }
}

// ── El árbol, de Meta o de Zernio ───────────────────────────────────────────

async function arbolDeMeta(ws: number): Promise<{ arbol: NodoMB[]; moneda: string | null; parcial: boolean }> {
  const h = await leerArbolMetaEnVivo(ws);
  const nodo = (n: (typeof h.campaigns)[number]): NodoMB => ({
    id: n.id, nombre: n.name, nivel: n.level, parentId: n.parentId,
    configurado: n.configuredStatus ?? null, entrega: n.effectiveStatus,
    presupuestoDia: n.dailyBudgetMxn ?? null,
    nivelPresupuesto: n.budgetLevel ?? null,
    creada: n.createdTime ?? null,
  });
  return { arbol: [...h.campaigns, ...h.adsets, ...h.ads].map(nodo), moneda: h.account.currency ?? null, parcial: h.parcial };
}

// ── La lectura entera ───────────────────────────────────────────────────────

/**
 * La cuenta publicitaria con la que opera el negocio: la de Integraciones (Meta) y, si no tiene, la que eligió en los
 * Ajustes del Media Buyer (la de MaKo es ese caso: se opera por la Zernio de la plataforma, sin credencial de Meta).
 */
export async function cuentaDelNegocio(ws: number): Promise<string | null> {
  const v = await credWs('META_AD_ACCOUNT_ID', ws);
  if (v) return normalizarCuentaMeta(v);
  const { leerConfig } = await import('./store');
  return (await leerConfig(ws).catch(() => null))?.cuentaPublicitaria ?? null;
}

export async function leerDatosCuenta(ws: number, hoy: string = hoyEnTijuana()): Promise<DatosCuenta> {
  const avisos: string[] = [];
  const act = await cuentaDelNegocio(ws);
  const conexion = await conexionAnunciosZernio(ws, act).catch((e) => {
    avisos.push(`Zernio no contestó: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  });
  const v = ventanas(hoy);
  const inicioMes = `${hoy.slice(0, 7)}-01`;
  const desdeLectura = inicioMes < v.crm[0] ? inicioMes : v.crm[0];

  // 1. El árbol: Meta con el token del negocio; Zernio si no hay token o Meta no deja leer.
  let fuente: FuenteArbol = 'meta';
  let arbol: NodoMB[] = [];
  let moneda: string | null = null;
  let metricasZernio: FilaMetrica[] | null = null;
  const token = await credWs('META_ACCESS_TOKEN', ws);
  let errMeta: string | null = null;
  if (token) {
    try {
      const m = await arbolDeMeta(ws);
      arbol = m.arbol; moneda = m.moneda;
      if (m.parcial) avisos.push('Meta devolvió la cuenta a medias: lo que faltó no se toca.');
    } catch (e) {
      errMeta = e instanceof Error ? e.message : String(e);
    }
  }
  if ((!token || errMeta) && conexion) {
    const z = await arbolPorZernio(ws, conexion, desdeLectura, v.crm[1]);
    const t = arbolDesdeZernio(z.campanas);
    fuente = 'zernio'; arbol = t.arbol; moneda = z.moneda; metricasZernio = t.metricas;
    if (errMeta) avisos.push(`El token de Meta no dejó leer la cuenta (${errMeta.slice(0, 160)}): se leyó por Zernio.`);
  } else if (errMeta) {
    throw new SinCuentaParaOperar(`Meta no dejó leer la cuenta: ${errMeta}`);
  }
  if (!token && !conexion) throw new SinCuentaParaOperar('El negocio no tiene Meta conectado ni su Zernio con la cuenta publicitaria.');

  const conversor = conversorDeGasto(moneda);

  // 2 y 3. Métricas de Meta y la cohorte del CRM, en UNA lectura cada una (el rango más largo) y repartidas en memoria.
  const { metricas, leads } = await runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const [met, lds] = await Promise.all([
      metricasZernio ? Promise.resolve(metricasZernio) : leerTodo<FilaMetrica>(db, 'marketing_metrics_daily',
        'id, fecha, ad_id, spend, leads_count, agendas_meta, impressions, frequency, video_3s_views, ad_thumbnail_url',
        { orden: [{ col: 'fecha' }, { col: 'ad_id' }, { col: 'id' }], eq: { plataforma: 'meta' }, filtros: (q) => q.not('ad_id', 'is', null).gte('fecha', desdeLectura).lte('fecha', v.crm[1]) }),
      leerTodo<FilaLeadAd>(db, 'leads', 'id, meta_ad_id, created_at, fecha_junta_1, estado_lead, total_cobrado_usd',
        { filtros: (q) => q.not('meta_ad_id', 'is', null).gte('created_at', `${desdeLectura}T00:00:00Z`) }),
    ]);
    return { metricas: met, leads: lds };
  });
  const aU = conversor.aUsdNum;
  const corta = senalesDeVentana(metricas, leads, v.corta[0], v.corta[1], aU);
  const larga = senalesDeVentana(metricas, leads, v.larga[0], v.larga[1], aU);
  const crm = senalesDeVentana(metricas, leads, v.crm[0], v.crm[1], aU);
  const mesS = senalesDeVentana(metricas, leads, inicioMes, v.crm[1], aU);
  const mes = mesS.reduce((a, s) => ({
    gasto: a.gasto + s.gasto, caja: a.caja + s.caja,
    resultados: { leads: a.resultados.leads + Math.max(s.leadsMeta, s.leadsCrm), agendas: a.resultados.agendas + Math.max(s.agendasMeta, s.agendasCrm), ventas: a.resultados.ventas + s.cierres },
  }), { gasto: 0, caja: 0, resultados: { leads: 0, agendas: 0, ventas: 0 } });

  // El total prendido: los presupuestos de lo que entrega (campaña CBO o conjunto ABO con su campaña prendida).
  const porId = new Map(arbol.map((n) => [n.id, n] as const));
  const prendido = (n: NodoMB): boolean => {
    let x: NodoMB | undefined = n;
    while (x) { if (x.configurado !== 'ACTIVE') return false; if (!x.parentId) return true; x = porId.get(x.parentId); }
    return false;
  };
  const totalActivo = arbol
    .filter((n) => n.presupuestoDia && ((n.nivel === 'campaign' && n.nivelPresupuesto === 'campaign') || (n.nivel === 'adset' && n.nivelPresupuesto !== 'campaign')))
    .filter(prendido)
    .reduce((s, n) => s + aU(n.presupuestoDia!), 0);

  return { fuente, adAccountId: act ?? conexion?.adAccountId ?? null, moneda, arbol, corta, larga, crm, conversor, conexion, totalActivo, mes, avisos };
}

// ── «Metas del mes» (la tarjeta de la derecha): sólo la base, sin pegarle a Meta ──

/**
 * El mes en curso hasta ayer: gasto de Meta (la ingesta diaria) y lo que pasó en el CRM con los leads que entraron este
 * mes por un anuncio. Liviano a propósito: lo pide la pantalla al abrir, y la lectura en vivo de Meta es del agente.
 */
export async function metasDelMes(ws: number, hoy: string = hoyEnTijuana()): Promise<MetasDelMes> {
  const desde = `${hoy.slice(0, 7)}-01`;
  const hasta = diasAntes(hoy, 1);
  const finMes = new Date(Date.UTC(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)), 0)).getUTCDate();
  const diasQuedan = Math.max(0, finMes - Number(hoy.slice(8, 10)) + 1);
  const { monedaCuentaMeta } = await import('@/lib/moneda-meta');
  return runWithWorkspace(ws, async () => {
    const moneda = await monedaCuentaMeta().catch(() => null);
    const conv = conversorDeGasto(moneda);
    if (hasta < desde) return { desde, hasta, diasQuedan, gasto: 0, caja: 0, resultados: { leads: 0, agendas: 0, ventas: 0 }, moneda, convierte: conv.aUsd(1) != null };
    const db = await getTenantDb();
    const [met, lds] = await Promise.all([
      leerTodo<FilaMetrica>(db, 'marketing_metrics_daily', 'id, fecha, ad_id, spend, leads_count, agendas_meta, impressions, frequency, video_3s_views',
        { orden: [{ col: 'fecha' }, { col: 'ad_id' }, { col: 'id' }], eq: { plataforma: 'meta' }, filtros: (q) => q.not('ad_id', 'is', null).gte('fecha', desde).lte('fecha', hasta) }),
      leerTodo<FilaLeadAd>(db, 'leads', 'id, meta_ad_id, created_at, fecha_junta_1, estado_lead, total_cobrado_usd',
        { filtros: (q) => q.not('meta_ad_id', 'is', null).gte('created_at', `${desde}T00:00:00Z`) }),
    ]);
    const s = senalesDeVentana(met, lds, desde, hasta, conv.aUsdNum);
    const total = s.reduce((a, x) => ({
      gasto: a.gasto + x.gasto, caja: a.caja + x.caja,
      leads: a.leads + Math.max(x.leadsMeta, x.leadsCrm), agendas: a.agendas + Math.max(x.agendasMeta, x.agendasCrm), ventas: a.ventas + x.cierres,
    }), { gasto: 0, caja: 0, leads: 0, agendas: 0, ventas: 0 });
    return {
      desde, hasta, diasQuedan, gasto: Math.round(total.gasto * 100) / 100, caja: Math.round(total.caja * 100) / 100,
      resultados: { leads: total.leads, agendas: total.agendas, ventas: total.ventas }, moneda, convierte: conv.aUsd(1) != null,
    };
  });
}
