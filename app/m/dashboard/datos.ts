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
import { cache } from 'react';
import { datosDeGraficos } from '@/lib/graficos-datos';
import { leerTablero } from '@/lib/graficos-tablero';
import { leerComercial } from '@/lib/datos-comercial-server';
import { getRevenuePeriod } from '@/lib/queries';
import {
  agruparAuto, esGrafico, fuenteDe, metricaDe, rangoDe, tipoDe, tituloDe, tonoDe,
  type Formato, type Grafico, type Hoja, type Preset, type Tablero, type VistaValores,
} from '@/lib/graficos-catalogo';
import { claveTiempo, clavesDelRango, fmtValor, periodoAnterior, type Resultado } from '@/lib/graficos-agregar';
import { firmaDe, hojaDestino } from '@/lib/graficos-plantillas';
import { cambioEnPalabras, fraseEnTexto, tramosDeFrase } from '@/lib/graficos-frase';
import { fraseMarketing } from '@/lib/marketing-diseno';
import { pedidosDeHoja } from '@/app/dashboard/exportar';
import {
  ERROR_LECTURA, PERIODO_DEFAULT, cobroDeFila, conUnidad, deltaDe, esCostoSobreGasto, etiquetaBarra, faltaConectar, noSeLeyo, periodoDe, rotuloDePieza,
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
      // Las filas con una cuota que marcar («Marcar cobrado» marca la PRÓXIMA cuota del lead) y, desde el 20/10/2026, las
      // suscripciones por cobrar, que no tienen cuota (`cobroDeFila`, ./modelo.ts).
      filas: cob.filas.flatMap((f) => { const c = cobroDeFila(f, (n) => fmtValor(n, 'usd')); return c ? [c] : []; }),
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
export function piezasDeHoja(h: Hoja): { numeros: Grafico[]; serie: Grafico | null; frase: Grafico | null } {
  const graficos = h.componentes.filter(esGrafico);
  const frase = graficos.find((g) => g.tipo === 'frase') ?? null;
  const numeros = graficos.filter((g) => {
    const t = tipoDe(g.tipo);
    // La oración de apertura no es un número: en el teléfono va arriba, como frase (`fraseDeHoja`).
    return !!t && t.dimension === 'ninguna' && GRUPOS_NUMERO.has(t.grupo) && g.tipo !== 'frase';
  }).slice(0, TOPE_NUMEROS);
  const serie = graficos.find((g) => esDim(g.dimension) && !g.desglose) ?? null;
  return { numeros, serie, frase };
}

/** ¿Hay algo que mostrar de esta hoja en el teléfono? (sin leer datos). */
export const entraEnTelefono = (h: Hoja) => {
  const p = piezasDeHoja(h);
  return p.numeros.length > 0 || p.serie != null || p.frase != null;
};

/**
 * La hoja propia `id` que abre el teléfono (./[hoja]), o null si se vuelve al Dashboard. El id exacto, o el nombre de una
 * plantilla (`closing`, `landing`…) como lo resuelve escritorio con `?hoja=` (hojaDestino): los links de escritorio llegan
 * así por rutaMovil. Si escritorio tendría que AGREGAR la hoja, el teléfono no la agrega (eso escribe el informe): vuelve.
 * La MISMA cuenta en la página y en el layout (./layout.tsx), que redirige antes del loader.
 */
export function hojaPropiaDe(t: Tablero, id: string): Hoja | null {
  const destino = hojaDestino(t, id);
  const h = destino.agregar ? undefined : t.hojas.find((x) => x.id === destino.hojaId);
  return h && !esHojaInicial(h) && entraEnTelefono(h) ? h : null;
}

/** El informe de la persona, leído UNA vez por pedido: lo piden el layout (para decidir si vuelve) y la página de la hoja. */
export const tableroDelPedido = cache(leerTablero);

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
  const { numeros, serie, frase } = piezasDeHoja(h);
  const control = h.controles.find((x) => x.tipo === 'periodo');
  const vista: VistaValores = control && periodo ? { [control.id]: { preset: periodo.id } } : {};
  const usados = new Set([...numeros.map((g) => g.id), ...(serie ? [serie.id] : []), ...(frase ? [frase.id] : [])]);
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
        // Con varias métricas se dibuja la primera: el título es el de ESA (`rotuloDePieza`).
        titulo: rotuloDePieza(tituloDe(serie), serie.metricas, met?.nombre),
        barras: barrasDe(res, dim, (v) => fmtValor(v, formato)),
        total: textoTotal,
        moneda: formato === 'usd',
        entero: formato === 'numero' && !met?.razon,
      };
    } else if (noSeLeyo([r])) {
      // Sólo si la lectura FALLÓ: leída y sin columnas es «sin dato», no «no pudimos leer» (11/11/2026).
      out.graficoError = ERROR_LECTURA;
    }
  }
  // ⚠️ SIN GASTO NO HAY COSTO (11/11/2026, Marketing del ws 3 en el teléfono): «Costo por agenda US$0» decía que cada agenda salió
  // gratis, sin anuncios. Con el gasto leído en cero, una razón sobre el gasto (costo por agenda, por lead…) va como «—».
  const gastoCero = [...usados].some((id) => {
    const r = datos[id];
    if (!r?.ok) return false;
    const i = r.resultado.columnas.findIndex((c) => c.id === 'gasto');
    return i >= 0 && r.resultado.totales[i] === 0;
  });
  out.numeros = numeros.map((g) => {
    const r = datos[g.id];
    if (!r?.ok || !r.resultado.columnas[0]) return { id: g.id, k: tituloDe(g), v: '—', delta: null };
    const res = r.resultado;
    const formato = res.columnas[0].formato;
    const tono = tonoDe(g.fuente, g.metricas[0]);
    const fuente = fuenteDe(g.fuente);
    if (gastoCero && esCostoSobreGasto(fuente ? metricaDe(fuente, g.metricas[0]) : undefined)) return { id: g.id, k: tituloDe(g), v: '—', delta: null };
    const v = res.totales[0] ?? null;
    const nombre = fuente ? metricaDe(fuente, g.metricas[0])?.nombre : undefined;
    return {
      id: g.id,
      // Con varias métricas se ve la primera: el rótulo es el de ESA («Leads 135», no «Primer contacto 135»).
      k: rotuloDePieza(tituloDe(g), g.metricas, nombre),
      v: conUnidad(fmtValor(v, formato), nombre, tituloDe(g)),
      delta: deltaDe(v, res.anterior?.[0] ?? null, modoDe(formato), tono === 'bueno' ? true : tono === 'malo' ? false : null),
    };
  });
  // ⚠️ «No pudimos leer» sólo si las lecturas FALLARON (11/11/2026, Anuncio ganador y Hooks en el ws 3): con todos los números
  // en «—» porque no hubo datos en el período, el teléfono decía «No es nada tuyo · Reportar a Soporte» de algo que se leyó bien.
  if (noSeLeyo(numeros.map((g) => datos[g.id]))) out.numerosError = ERROR_LECTURA;
  // ⚠️ NADA LEÍDO PORQUE FALTA CONECTAR NO ES UNA FALLA (10/11/2026, Closing en el ws 3 sin grabador): el teléfono decía dos
  // veces «No pudimos leer estos números. No es nada tuyo» con «Reportar a Soporte», y la compu, «Conecta tu grabador…».
  // Si no se leyó nada y lo que volvió es `sinConexion`, se dice ESE texto, una vez.
  const falta = faltaConectar([...usados].map((id) => datos[id]));
  if (falta) return { ...out, falta, grafico: null, graficoError: null, numeros: [], numerosError: null, frase: null };
  // La oración de apertura, escrita con la MISMA regla que escritorio: un tramo sin dato no se dice.
  if (frase) {
    const r = datos[frase.id];
    if (r?.ok) {
      const res = r.resultado;
      const total = (id: string) => { const i = res.columnas.findIndex((c) => c.id === id); return i >= 0 ? res.totales[i] ?? null : null; };
      if (h.diseno?.id === 'marketing') {
        // La hoja Marketing dice en el teléfono la MISMA frase que su diseño en la compu (lib/marketing-diseno.ts): la de la
        // plantilla decía «Gastaste US$0 en anuncios · trajeron 3 agendas · cada una costó US$0» sin pauta (11/11/2026).
        const t = fraseMarketing(total('gasto'), total('agendas'), total('cpa')).map((x) => x.s).join('');
        out.frase = t || null;
      } else {
        const tramos = tramosDeFrase(frase.frase, res.columnas, (i) => (res.totales[i] == null ? null : fmtValor(res.totales[i], res.columnas[i].formato)), (i) => cambioEnPalabras(res.totales[i], res.anterior?.[i]));
        out.frase = tramos.length ? fraseEnTexto(tramos) : null;
      }
    }
  }
  return out;
}
