// =============================================================================
// /m/dashboard — las lecturas: las MISMAS funciones del Dashboard de escritorio, en la forma fija
// del teléfono (un gráfico + la lista de números)
// =============================================================================
// docs/diseno-mako-mobile-v2.md, «Dashboard»: las dos hojas del informe inicial como segmentado
// (Marketing | Comercial), UN gráfico por hoja y la lista de números con su variación; en Comercial,
// «A quién cobrarle». Las hojas propias se ven en la misma forma fija, no con su layout.
//
// ⚠️ ACÁ NO SE ESCRIBE NINGUNA CONSULTA. Cada número sale de donde lo saca escritorio:
//   · Marketing → `datosDeGraficos` (lib/graficos-datos.ts) sobre el conjunto «negocio», el mismo de
//     las KPI de la hoja Marketing (Ad Spend, CAC real = Spend ÷ cierres, ROAS cash, ROAS sold) y de
//     su «Tendencias» (leads por día). El gasto pasa a dólares adentro (`conversorGastoMeta`) y la
//     pauta se lee hasta AYER (`hastaDeFuente`: el día en curso todavía no llegó por cron).
//   · Comercial → `leerComercial` (lib/datos-comercial-server.ts): Revenue y «A quién cobrarle», las
//     lecturas de la tab vieja de Comercial (que hasta el 13/10/2026 eran los bloques `revenue` y
//     `cobranza` de escritorio): Sold, Cash, Outstanding (con la ventana de «A quién cobrarle», la MISMA
//     lectura) y los cierres. El período anterior, con `getRevenuePeriod` (lib/queries.ts), que es
//     lo que lee Revenue por dentro.
//   · Hojas propias → `pedidosDeHoja` (app/dashboard/exportar.ts, el armador de pedidos de la
//     pantalla de escritorio) + `datosDeGraficos`: sus cuadros de resultados como lista y su primera
//     serie de tiempo como gráfico.
// La variación del teléfono es la de escritorio (`periodoAnterior`: el período del MISMO largo que
// termina el día antes), calculada con `comparar: true` en cada número.
//
// ⚠️ Los nombres de «A quién cobrarle» bajan a la pantalla: son los mismos que ve el admin en el
//    conjunto «Clientes por cobrar» de escritorio. Ningún dato de acá va a un modelo de IA.
// =============================================================================

import 'server-only';
import { datosDeGraficos } from '@/lib/graficos-datos';
import { leerComercial } from '@/lib/datos-comercial-server';
import { getRevenuePeriod } from '@/lib/queries';
import {
  agruparAuto, esGrafico, fuenteDe, metricaDe, rangoDe, tipoDe, tituloDe, tonoDe,
  type Formato, type Grafico, type Hoja, type Preset, type VistaValores,
} from '@/lib/graficos-catalogo';
import { claveTiempo, clavesDelRango, fmtValor, periodoAnterior, type Resultado } from '@/lib/graficos-agregar';
import { firmaDe } from '@/lib/graficos-plantillas';
import { pedidosDeHoja } from '@/app/dashboard/exportar';
import {
  ERROR_LECTURA, PERIODO_DEFAULT, deltaDe, etiquetaBarra, periodoDe, textoVence,
  type BarraM, type GraficoM, type HojaM, type ModoDelta, type NumeroM, type PeriodoM,
} from './modelo';

type Dim = 'dia' | 'semana' | 'mes';
const esDim = (d: unknown): d is Dim => d === 'dia' || d === 'semana' || d === 'mes';

const vacia = (id: string, nombre: string): HojaM => ({
  id, nombre, grafico: null, graficoSiguePeriodo: true, graficoError: null, numeros: [], numerosError: null, cobranza: null, cobranzaError: null,
});

const log = (donde: string, e: unknown) => console.error(`[m/dashboard] ${donde}: ${e instanceof Error ? e.message : String(e)}`);

/** Como /dashboard (page.tsx): un período que termina después de hoy se acota a hoy. */
const acotar = (desde: string, hasta: string, hoy: string) => (hasta > hoy ? (hoy < desde ? desde : hoy) : hasta);

const plural = (n: number, uno: string, varios: string) => `${fmtValor(n, 'numero')} ${n === 1 ? uno : varios}`;

/** Las barras de la PRIMERA métrica de un resultado agrupado por tiempo. */
function barrasDe(res: Resultado, dim: Dim, texto: (v: number) => string): BarraM[] {
  return res.filas.map((f) => {
    const crudo = f.valores[0];
    const valor = Number(crudo ?? 0) || 0;
    // Una razón sin denominador ese día (un costo por lead sin leads) no es un cero: es «—».
    return { clave: f.clave, ...etiquetaBarra(dim, f.clave), valor, texto: crudo == null ? '—' : texto(valor) };
  });
}

// ── Marketing ─────────────────────────────────────────────────────────────────────────────

const ID_MK = 'm-marketing';
/** El orden importa: la PRIMERA es la del gráfico (leads por día). */
const METRICAS_MK = ['leads', 'gasto', 'cac', 'roas_cobrado', 'roas_vendido'] as const;
/**
 * Cómo se lee cada número de Marketing (prototipo): k, cómo se escribe la variación y si subir es
 * bueno. El Ad Spend va invertido como en el prototipo (gastar más con lo mismo no es la noticia).
 */
const NUMEROS_MK: ReadonlyArray<{ id: (typeof METRICAS_MK)[number]; k: string; modo: ModoDelta; subeEsBueno: boolean }> = [
  { id: 'gasto', k: 'Ad Spend', modo: 'pct', subeEsBueno: false },
  { id: 'leads', k: 'Leads', modo: 'pct', subeEsBueno: true },
  { id: 'cac', k: 'CAC real', modo: 'pct', subeEsBueno: false },
  { id: 'roas_cobrado', k: 'ROAS cash', modo: 'abs1', subeEsBueno: true },
  { id: 'roas_vendido', k: 'ROAS sold', modo: 'abs1', subeEsBueno: true },
];

export async function hojaMarketing(periodo: PeriodoM, hoy: string): Promise<HojaM> {
  const hoja = vacia('marketing', 'Marketing');
  const rg = rangoDe(periodo.id, hoy);
  const dim = agruparAuto(rg.desde, rg.hasta);
  let res: Resultado | null = null;
  try {
    const datos = await datosDeGraficos([{
      // Un solo pedido: la serie de leads y los totales de los cinco números salen de UNA lectura
      // del conjunto «negocio» (y otra del período anterior, por `comparar`).
      grafico: { id: ID_MK, clase: 'grafico', tipo: 'tabla', fuente: 'negocio', dimension: dim, metricas: [...METRICAS_MK], comparar: true },
      desde: rg.desde,
      hasta: acotar(rg.desde, rg.hasta, hoy),
    }]);
    const r = datos[ID_MK];
    if (r?.ok) res = r.resultado;
    else log('marketing', r?.error ?? 'sin resultado');
  } catch (e) { log('marketing', e); }
  if (!res) return { ...hoja, graficoError: ERROR_LECTURA, numerosError: ERROR_LECTURA };
  const rs = res;

  const col = (id: string) => rs.columnas.findIndex((c) => c.id === id);
  const iLeads = col('leads');
  const totalLeads = Number(rs.totales[iLeads] ?? 0) || 0;
  const grafico: GraficoM = {
    titulo: `Leads por ${dim === 'dia' ? 'día' : dim}`,
    barras: barrasDe(rs, dim, (v) => plural(v, 'lead', 'leads')),
    total: `${fmtValor(totalLeads, 'numero')} ${periodo.en}`,
    moneda: false,
    entero: true,
  };
  const numeros: NumeroM[] = NUMEROS_MK.map((n) => {
    const i = col(n.id);
    const formato: Formato = rs.columnas[i]?.formato ?? 'numero';
    const v = i >= 0 ? rs.totales[i] ?? null : null;
    const a = i >= 0 ? rs.anterior?.[i] ?? null : null;
    return { id: n.id, k: n.k, v: fmtValor(v, formato), delta: deltaDe(v, a, n.modo, n.subeEsBueno) };
  });
  return { ...hoja, grafico, numeros };
}

// ── Comercial ─────────────────────────────────────────────────────────────────────────────

/** Cash por día hasta dos semanas (por semana serían dos barras), por semana hasta medio año, si no por mes. */
function dimComercial(desde: string, hasta: string): Dim {
  const dias = Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1;
  return dias <= 14 ? 'dia' : dias <= 180 ? 'semana' : 'mes';
}

export async function hojaComercial(periodo: PeriodoM, hoy: string): Promise<HojaM> {
  const hoja = vacia('comercial', 'Comercial');
  const rg = rangoDe(periodo.id, hoy);
  // El anterior se arma con el período de la hoja: Revenue lo acota a hoy en la zona del negocio,
  // y los cuatro períodos del teléfono ya terminan hoy.
  const ant = periodoAnterior(rg.desde, acotar(rg.desde, rg.hasta, hoy));
  const [comercial, previo] = await Promise.all([
    // Las fechas van SIN acotar: la ventana del Outstanding mira hacia adelante (hasta el fin de mes
    // del período), `ventanaOutstanding` en lib/datos-comercial.ts.
    leerComercial(rg.desde, rg.hasta).catch((e) => { log('comercial', e); return null; }),
    getRevenuePeriod(ant.desde, ant.hasta).catch((e) => { log('anterior', e); return null; }),
  ]);

  const rb = comercial?.revenue;
  const rev = rb?.ok ? rb.datos : null;
  const cb = comercial?.cobranza;
  const cob = cb?.ok ? cb.datos : null;

  let out: HojaM = { ...hoja };
  if (rev) {
    const dim = dimComercial(rev.periodo.desde, rev.periodo.hasta);
    const claves = clavesDelRango(dim, rev.periodo.desde, rev.periodo.hasta);
    const suma = new Map<string, number>(claves.map((k) => [k, 0]));
    // Las mismas filas que suman el Cash Collected (getRevenueBreakdowns: pagos cobrados por fecha
    // de pago en el período): las barras suman exactamente el número de la lista.
    for (const it of rev.cashItems) {
      const f = it.fecha?.slice(0, 10);
      if (!f || f < rev.periodo.desde || f > rev.periodo.hasta) continue;
      const k = claveTiempo(dim, f);
      suma.set(k, (suma.get(k) ?? 0) + (Number(it.monto) || 0));
    }
    const barras: BarraM[] = claves.map((k) => {
      const valor = suma.get(k) ?? 0;
      return { clave: k, ...etiquetaBarra(dim, k), valor, texto: fmtValor(valor, 'usd') };
    });
    out.grafico = {
      titulo: `Cash Collected por ${dim === 'dia' ? 'día' : dim}`,
      barras,
      total: `${fmtValor(rev.cash, 'usd')} ${periodo.en}`,
      moneda: true,
      entero: false,
    };
    out.numeros = [
      { id: 'sold', k: 'Sold Revenue', v: fmtValor(rev.sold, 'usd'), delta: deltaDe(rev.sold, previo?.sold_revenue_usd, 'pct', true) },
      { id: 'cash', k: 'Cash Collected', v: fmtValor(rev.cash, 'usd'), delta: deltaDe(rev.cash, previo?.cash_collected_usd, 'pct', true) },
      // Lo que falta cobrar no tiene «período anterior»: es la foto de la ventana.
      { id: 'outstanding', k: 'Outstanding', v: fmtValor(rev.outstanding, 'usd'), delta: null },
      { id: 'cierres', k: 'Cierres', v: fmtValor(rev.cierres, 'numero'), delta: deltaDe(rev.cierres, previo?.cierres_en_periodo, 'abs', true) },
    ];
  } else {
    if (rb && !rb.ok) log('revenue', rb.error);
    out = { ...out, graficoError: ERROR_LECTURA, numerosError: ERROR_LECTURA };
  }

  if (cob) {
    out.cobranza = {
      tz: cob.tz,
      // Sólo las filas con una cuota que marcar: «Marcar cobrado» marca la PRÓXIMA cuota del lead.
      filas: cob.filas.flatMap((f) => (f.cuota ? [{
        leadId: f.leadId,
        pagoId: f.cuota.pagoId,
        nombre: f.nombre,
        linea: `${fmtValor(f.cuota.monto, 'usd')} · ${textoVence(f.cuota.vence, f.dias)}`,
        urgencia: f.urgencia,
      }] : [])),
    };
  } else {
    if (cb && !cb.ok) log('cobranza', cb.error);
    out.cobranzaError = ERROR_LECTURA;
  }
  return out;
}

// ── Las hojas propias, en la forma fija ───────────────────────────────────────────────────

/** ¿Esta hoja es la Marketing o la Comercial del informe inicial (aunque se haya agregado de nuevo)? */
export function esHojaInicial(h: Hoja): boolean {
  return (['marketing', 'comercial'] as const).some((p) => {
    const f = firmaDe(p);
    return !!f?.ids?.includes(h.id) || h.componentes.some((c) => !!f?.ids?.includes(c.id));
  });
}

const GRUPOS_NUMERO = new Set(['Cuadro de resultados', 'Indicador', 'Bala']);
const TOPE_NUMEROS = 8;

/** Lo que de una hoja entra en el teléfono: sus cuadros de resultados y su primera serie de tiempo. */
export function piezasDeHoja(h: Hoja): { numeros: Grafico[]; serie: Grafico | null } {
  const graficos = h.componentes.filter(esGrafico);
  const numeros = graficos.filter((g) => {
    const t = tipoDe(g.tipo);
    return !!t && t.dimension === 'ninguna' && GRUPOS_NUMERO.has(t.grupo);
  }).slice(0, TOPE_NUMEROS);
  const serie = graficos.find((g) => esDim(g.dimension) && !g.desglose) ?? null;
  return { numeros, serie };
}

/** ¿Hay algo que mostrar de esta hoja en el teléfono? (sin leer datos). */
export const entraEnTelefono = (h: Hoja) => {
  const p = piezasDeHoja(h);
  return p.numeros.length > 0 || p.serie != null;
};

/** El período de entrada de una hoja propia (su control de período), o null si no tiene. */
export function periodoPropio(h: Hoja): Preset | null {
  const c = h.controles.find((x) => x.tipo === 'periodo');
  return c && c.preset !== 'personalizado' ? c.preset : null;
}

function modoDe(formato: Formato): ModoDelta {
  if (formato === 'pct') return 'pts';
  if (formato === 'veces' || formato === 'segundos') return 'abs1';
  return 'pct';
}

/**
 * Una hoja propia en la forma fija del teléfono. `periodo` pisa el control de período de la hoja
 * (si no tiene, cada gráfico mira lo suyo, como en escritorio).
 */
export async function hojaPropia(h: Hoja, periodo: PeriodoM | null, hoy: string): Promise<HojaM> {
  const hoja = vacia(h.id, h.nombre);
  const { numeros, serie } = piezasDeHoja(h);
  const control = h.controles.find((x) => x.tipo === 'periodo');
  const vista: VistaValores = control && periodo ? { [control.id]: { preset: periodo.id } } : {};
  const usados = new Set([...numeros.map((g) => g.id), ...(serie ? [serie.id] : [])]);
  // El armador de pedidos de escritorio, con la vista: el período, los filtros de la hoja y de cada
  // gráfico y el «agrupar por» quedan resueltos igual que en la pantalla grande.
  const { graficos } = pedidosDeHoja({ ...h, componentes: h.componentes.filter((c) => usados.has(c.id)) }, vista, hoy, 0);
  const pedidos = graficos.map(({ g, pedido }) => ({
    ...pedido,
    // Los números del teléfono llevan SIEMPRE su variación contra el período anterior.
    grafico: numeros.some((n) => n.id === g.id) ? { ...g, comparar: true } : g,
    hasta: acotar(pedido.desde, pedido.hasta, hoy),
  }));
  let datos: Awaited<ReturnType<typeof datosDeGraficos>> = {};
  try { datos = await datosDeGraficos(pedidos); } catch (e) { log(`hoja ${h.id}`, e); }

  const out: HojaM = { ...hoja };
  if (serie) {
    const r = datos[serie.id];
    const ped = graficos.find((x) => x.g.id === serie.id);
    out.graficoSiguePeriodo = !!control && !ped?.ef.propio.periodo;
    const dim: Dim = esDim(ped?.pedido.agrupar) ? ped!.pedido.agrupar as Dim : (serie.dimension as Dim);
    if (r?.ok && r.resultado.columnas[0]) {
      const res = r.resultado;
      const formato = res.columnas[0].formato;
      const met = fuenteDe(serie.fuente) ? metricaDe(fuenteDe(serie.fuente)!, res.columnas[0].id) : undefined;
      const total = res.totales[0] ?? null;
      // Una razón (un promedio, un costo por) no se «junta en N días»: se dice sola.
      // Y el período del total es el que mira el GRÁFICO: el elegido, o el suyo propio (12 meses).
      const en = out.graficoSiguePeriodo ? periodo?.en : serie.periodo !== 'auto' ? periodoDe(serie.periodo)?.en : !control ? periodoDe(PERIODO_DEFAULT)?.en : undefined;
      const textoTotal = met?.razon || met?.sinTotal ? fmtValor(total, formato) : `${fmtValor(total, formato)}${en ? ` ${en}` : ''}`;
      out.grafico = {
        titulo: tituloDe(serie),
        barras: barrasDe(res, dim, (v) => fmtValor(v, formato)),
        total: textoTotal,
        moneda: formato === 'usd',
        entero: formato === 'numero' && !met?.razon,
      };
    } else {
      out.graficoError = ERROR_LECTURA;
    }
  }
  out.numeros = numeros.map((g) => {
    const r = datos[g.id];
    if (!r?.ok || !r.resultado.columnas[0]) return { id: g.id, k: tituloDe(g), v: '—', delta: null };
    const res = r.resultado;
    const formato = res.columnas[0].formato;
    const tono = tonoDe(g.fuente, g.metricas[0]);
    const v = res.totales[0] ?? null;
    return {
      id: g.id,
      k: tituloDe(g),
      v: fmtValor(v, formato),
      delta: deltaDe(v, res.anterior?.[0] ?? null, modoDe(formato), tono === 'bueno' ? true : tono === 'malo' ? false : null),
    };
  });
  if (numeros.length && out.numeros.every((n) => n.v === '—')) out.numerosError = ERROR_LECTURA;
  return out;
}
