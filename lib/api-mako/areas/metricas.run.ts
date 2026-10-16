// =============================================================================
// api-mako/areas/metricas.run — los cuerpos del área `metricas`
// =============================================================================
// Un runner por id de metricas.def.ts. Todas son lecturas y todas corren adentro
// de runWithWorkspace(ctx.ws): las libs de abajo scopean con getTenantDb().
//
// Lo que agrega esta capa sobre las libs, y por qué:
//   · La VENTANA DICHA. Una lib recibe `start`/`end` y devuelve números; el modelo
//     que los lee no ve el selector de fechas de la pantalla. Cada salida lleva
//     `ventana: {desde, hasta, dias}` con lo que DE VERDAD se usó.
//   · La UNIDAD EN EL NOMBRE del campo (`gasto_usd`, `ctr_link_pct`) y el derivado
//     declarado: todo USD de Meta sale de dividir la moneda de la cuenta por un
//     tipo de cambio FIJO (lib/config.ts), y eso viaja en `notas`.
//   · El RECORTE DICHO. Las lecturas que la lib hace sin paginar se cruzan con un
//     count exacto (metricas.helpers.ts); si pasan las 1000 filas, la respuesta
//     lo dice en vez de entregar un total corto con cara de exacto.
//
// Nada escribe aquí. (tzActual, que usan las libs y `hoyEnWorkspace`, puede
// memorizar la zona del workspace la primera vez: es un setting de la plataforma,
// no un dato del negocio, y ya pasaba al abrir cualquier pantalla.)
// =============================================================================

import 'server-only';
import type { Runners, SalidaLectura } from '../tipos';
import { reporteMetricas, metricasACsv, metricasAMarkdown, validarRango, type Grano } from '@/lib/metricas-negocio';
import { analisisNegocio } from '@/lib/analisis-negocio';
import { analisisAMarkdown } from '@/lib/analisis-modelo';
import {
  getMarketingWindow, getFunnelEtapas, getFunnelSeries, getTendencias, getAgendasComparador, getVslSerie,
  getFatigaAdsets, getRevenuePeriod, getRevenueMensual, getMrrActivo, getCACAcumulado, listCACMensual,
  listCohortesSemanales, listCohortesMensuales, getResumenComercialMaduras, getFunnelMadurasLeads,
  getSCL, getTramosSCL, getDistribucionPipeline, type FunnelLeadItem,
} from '@/lib/queries';
import { getOutstandingDetalle, getCuotasPendientes, type CuotaPendiente } from '@/lib/pagos';
import { getDataSources, sourcesToMap } from '@/lib/sources';
import { hoyEnWorkspace } from '@/lib/timezone';
import { TIPO_DE_CAMBIO_USD_MXN } from '@/lib/config';
import { diasAntes, esFechaValida, lunesDeFecha, ayerEnTijuana } from '@/lib/date-utils';
import { contarFilas, avisoRecorte } from './metricas.helpers';
import { VENTA_SIN_COBRO } from '@/lib/venta-tipo';

// ── utilidades ───────────────────────────────────────────────────────────────

const str = (input: Record<string, unknown>, k: string): string => {
  const v = input[k];
  return typeof v === 'string' ? v.trim() : '';
};
const entero = (input: Record<string, unknown>, k: string, def: number): number => {
  const v = input[k];
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : def;
};
/** Dos decimales; null sigue siendo null (no se inventa un 0). */
const r2 = (v: number | null | undefined): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
const json = (o: unknown): string => JSON.stringify(o);
const diasEntre = (desde: string, hasta: string): number =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1;
const ventana = (desde: string, hasta: string) => ({ desde, hasta, dias: diasEntre(desde, hasta) });

/** Un error del que llama (fecha mal escrita), como resultado legible: sale 400. */
const errorPedido = (msg: string): SalidaLectura => ({ content: msg, isError: true });

/** La ventana pedida, validada y con los defaults de la casa (90 días hasta hoy
 *  en la zona del negocio). `validarRango` lanza con un mensaje que dice qué hacer. */
async function rango(input: Record<string, unknown>): Promise<{ desde: string; hasta: string }> {
  return validarRango(await hoyEnWorkspace(), str(input, 'desde') || null, str(input, 'hasta') || null);
}

/** Un día suelto (`hasta`), validado; si falta, hoy en la zona del negocio. */
async function dia(input: Record<string, unknown>, k = 'hasta'): Promise<string | { error: string }> {
  const v = str(input, k);
  if (!v) return hoyEnWorkspace();
  return esFechaValida(v) ? v : { error: `«${k}» no es una fecha válida (YYYY-MM-DD): ${v}` };
}

/** Un filtro opcional de fecha (sin default): '' si no vino. */
function fechaOpcional(input: Record<string, unknown>, k: string): string | { error: string } {
  const v = str(input, k);
  if (!v) return '';
  return esFechaValida(v) ? v : { error: `«${k}» no es una fecha válida (YYYY-MM-DD): ${v}` };
}

const NOTA_USD = `Todo monto de Meta en USD sale de la moneda REAL de la cuenta publicitaria: si la cuenta cobra en USD, es lo que cobró Meta; si cobra en MXN, es un DERIVADO con un tipo de cambio FIJO (${TIPO_DE_CAMBIO_USD_MXN}, escrito en el código). Para auditar contra la factura usa metricas_negocio, que trae el monto crudo y su moneda.`;

const LIMITE_LEADS_POR_ETAPA = 100;
const LIMITE_COBRANZA = 50;
const TOPE_DIAS_GRANO_DIA = 92;
const TOPE_DIAS_GRANO_SEMANA = 728;

/** Un rango al revés no es «no hay datos»: es un pedido mal armado. */
const rangoAlReves = (d: string, h: string): SalidaLectura | null =>
  !!d && !!h && d > h ? errorPedido(`El rango está al revés: «desde» (${d}) es posterior a «hasta» (${h}). Pásalos en orden.`) : null;

/** Primer día del mes y fin de mes de una fecha YYYY-MM-DD (UTC, sin zona). */
const primerDiaMes = (s: string): string => `${s.slice(0, 7)}-01`;
const finDeMes = (s: string): string => {
  const [y, m] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

// ── runners ──────────────────────────────────────────────────────────────────

export const RUNNERS: Runners = {
  metricas_negocio: {
    leer: async (input, ctx) => {
      const formato = (str(input, 'formato') || ctx.formato || 'md').toLowerCase();
      // Por WhatsApp y en la app la tabla entera va como resultado de tool a un
      // modelo con techo de entrada chico (~7k tokens en Groq): 1830 filas × 24
      // columnas rompen el turno o llegan cortadas sin aviso. El tope de 1830 días
      // es de la VENTANA, no de la salida; aquí se pone el de la salida.
      if (ctx.canal !== 'http') {
        const grano = str(input, 'grano') || 'mes';
        const tope = grano === 'dia' ? TOPE_DIAS_GRANO_DIA : grano === 'semana' ? TOPE_DIAS_GRANO_SEMANA : null;
        if (tope != null) {
          const { desde, hasta } = await rango(input);
          const dias = diasEntre(desde, hasta);
          if (dias > tope) {
            return errorPedido(`La ventana ${desde} a ${hasta} son ${dias} días: con grano «${grano}» la tabla no entra en una respuesta de chat (tope ${tope} días). Pide grano «${grano === 'dia' ? 'semana' : 'mes'}» o un tramo más corto.`);
          }
        }
      }
      const reporte = await reporteMetricas({
        desde: str(input, 'desde') || null,
        hasta: str(input, 'hasta') || null,
        grano: (str(input, 'grano') || 'mes') as Grano,
      });
      if (formato === 'json') return { content: JSON.stringify(reporte), formato: 'json' };
      if (formato === 'csv') {
        const { desde, hasta, grano } = reporte.periodo;
        return {
          content: metricasACsv(reporte),
          formato: 'csv',
          headers: {
            'Content-Disposition': `attachment; filename="metricas-${desde}_a_${hasta}-por-${grano}.csv"`,
            // Las salvedades no entran en una planilla: viajan en cabeceras.
            'X-Advertencias': String(reporte.advertencias.length),
            'X-Filas': String(reporte.filas.length),
          },
        };
      }
      return metricasAMarkdown(reporte);
    },
  },

  analisis_negocio: {
    leer: async (input) => {
      const num = (k: string): number | null => (typeof input[k] === 'number' && Number.isFinite(input[k]) ? (input[k] as number) : null);
      const a = await analisisNegocio({
        desde: str(input, 'desde') || null,
        hasta: str(input, 'hasta') || null,
        cierresObjetivo: num('cierres_objetivo'),
        presupuestoPropuesto: num('presupuesto_propuesto'),
      });
      return analisisAMarkdown(a);
    },
  },

  resumir_marketing_periodo: {
    leer: async (input) => {
      const { desde, hasta } = await rango(input);
      const [m, filasMeta] = await Promise.all([
        getMarketingWindow(desde, hasta),
        // dias_con_datos mezcla Meta, YouTube y Panda: con Panda cargado y Meta sin
        // filas daría > 0 y los ceros de Meta se leerían «no invertiste nada».
        contarFilas('marketing_metrics_daily', (q) => q.eq('plataforma', 'meta').gte('fecha', desde).lte('fecha', hasta)),
      ]);
      const sinMeta = filasMeta === 0;
      const notas = [NOTA_USD,
        'alcance_sumado es la suma del alcance DIARIO de cada anuncio: no es el alcance real de la ventana (una persona se cuenta cada día que la alcanzaron).',
        'formularios_instantaneos son los formularios de Meta; reuniones_1_con_fecha_en_ventana sale del CRM: no se dividen entre sí sin aclararlo.',
        'ctr_clics_totales_pct = clics TOTALES ÷ impresiones (incluye clics al perfil, «ver más», reacciones). ctr_link_pct = clics de link ÷ impresiones, que es el imp_click de diagnosticar_funnel: no compares uno con el otro. cpc_usd es por clic total.'];
      if (sinMeta) notas.unshift('No hay ni una fila de Meta en la ventana (integración sin conectar o sin sincronizar): los campos de meta y el CAC salen null, que significa «no hay datos», no «no hubo inversión».');
      else if (filasMeta == null) notas.unshift('No se pudo comprobar si hay filas de Meta en la ventana: un cero en los números de Meta puede ser «no hay datos», no «no hubo inversión».');
      const deMeta = <T,>(v: T): T | null => (sinMeta ? null : v);
      return json({
        ventana: ventana(desde, hasta),
        dias_con_datos_meta_youtube_panda: m.dias_con_datos,
        filas_meta_en_ventana: filasMeta,
        meta: {
          gasto_usd: deMeta(r2(m.spend_usd)),
          impresiones: deMeta(m.impressions),
          clics_totales: deMeta(m.clicks),
          clics_link: deMeta(m.link_clicks),
          landing_page_views: deMeta(m.landing_page_views),
          formularios_instantaneos: deMeta(m.leads_count),
          alcance_sumado: deMeta(m.reach),
          ctr_clics_totales_pct: deMeta(r2(m.ctr_global)),
          ctr_link_pct: deMeta(m.impressions > 0 ? r2((m.link_clicks / m.impressions) * 100) : null),
          cpc_usd: deMeta(r2(m.cpc_global)),
          cpm_usd: deMeta(r2(m.cpm_global)),
          costo_por_landing_view_usd: deMeta(r2(m.cpl_global)),
        },
        vsl_plays: m.vsl_views,
        vsl_plays_nota: m.vsl_views === null
          ? 'null = no hay fuente del VSL (ni YouTube, ni Panda, ni el VSL de prueba) en la ventana.'
          : 'Suma YouTube histórico + Panda + el VSL anterior de prueba. NO es el mismo vsl_plays de metricas_negocio, que sale del beacon de la landing (sin autoplay): no los compares.',
        reuniones_1_con_fecha_en_ventana: m.reuniones_en_ventana,
        cierres_en_ventana: m.cierres_en_ventana,
        cac_usd: deMeta(r2(m.cac)),
        cac_nota: 'gasto_usd ÷ leads con cerro y fecha de cierre en la ventana. null = no hubo cierres o no hay datos de Meta.',
        notas,
      });
    },
  },

  diagnosticar_funnel: {
    leer: async (input) => {
      const { desde, hasta } = await rango(input);
      const fuentes = await getDataSources().catch(() => null);
      const [f, filasR1] = await Promise.all([
        getFunnelEtapas(desde, hasta, fuentes ? sourcesToMap(fuentes) : undefined),
        // getFunnelEtapas lee los leads de la ventana sin paginar.
        contarFilas('leads', (q) => q.gte('fecha_junta_1', desde).lte('fecha_junta_1', hasta)),
      ]);
      // ⚠️ LOS RÓTULOS DE LAS ETAPAS DEL CRM SE LEEN DEL FUNNEL, NO SE ESCRIBEN ACÁ.
      // Estaban a mano («Agenda→Asistió, Asistió→Calificado, Calificado→Cierre») y
      // son los del embudo de dos reuniones: a un negocio que vende sin reuniones el
      // aviso le nombraba tres etapas que no tiene. Lo que le llega al modelo es
      // sólo este JSON — no ve la pantalla, así que una nota que nombra un paso
      // inexistente es un dato falso.
      const delCrm = f.etapas.filter((e) => e.bloque === 'comercial');
      const nombresCrm = delCrm.map((e) => e.label).join(', ');
      const recorte = delCrm.length > 0
        ? avisoRecorte(`Las etapas del CRM (${nombresCrm}) y con ellas el cuello de botella`, filasR1, 'los conteos reales son MAYORES y los porcentajes salen de una parte de los leads (cuál, no está definido)')
        : null;
      const puente = f.etapas.find((e) => e.bloque === 'puente');
      const notas = [
        ...(recorte ? [recorte] : []),
        'pct_paso = salida ÷ entrada × 100; null = entrada 0 (no se puede calcular, no es 0%).',
        'muestra_chica = la entrada es menor a 3: di el conteo, no el porcentaje.',
        'Los umbrales (rojo/ámbar) y la referencia son valores fijos de la plataforma, no metas del negocio del cliente.',
        ...(f.roles.r1
          ? ['La etapa de asistencia cuenta como no-asistencia a las reuniones que nadie marcó: si hay muchas sin marcar, la tasa sale más baja de lo real.']
          : ['Este negocio no vende con reuniones: su etapa de cierre mide los leads que entraron en el período y cuántos de ellos compraron.']),
        ...(puente
          ? [`Las etapas de Meta y el CRM se cruzan por fecha, no por persona: ${puente.label} compara formularios de Meta con reuniones 1 del CRM.`]
          : []),
      ];
      if (!fuentes) notas.unshift('No se pudo leer el estado de las fuentes: ninguna etapa se marcó fuente_pendiente, así que un 0% puede ser una fuente desconectada.');
      return json({
        ventana: ventana(desde, hasta),
        cuello_de_botella: f.cuelloKey,
        etapas: f.etapas.map((e) => ({
          key: e.key, etapa: e.label, bloque: e.bloque, contexto: e.contexto,
          entrada: e.entrada, salida: e.salida, pct_paso: r2(e.pct), salud: e.salud,
          fuente_pendiente: e.fuente_pendiente, muestra_chica: e.muestra_chica,
          umbral_pct: { rojo_bajo: e.umbral.rojo, ambar_bajo: e.umbral.ambar },
          referencia: e.benchmark,
        })),
        notas,
      });
    },
  },

  ver_serie_funnel_semanal: {
    leer: async (input) => {
      const h = await dia(input);
      if (typeof h !== 'string') return errorPedido(h.error);
      const semanas = entero(input, 'semanas', 12);
      const s = await getFunnelSeries(h, semanas);
      const ultimo = lunesDeFecha(h);
      const lunes = Array.from({ length: semanas }, (_, i) => diasAntes(ultimo, (semanas - 1 - i) * 7));
      return json({
        ventana: ventana(lunes[0], diasAntes(ultimo, -6)),
        semanas_lunes: lunes,
        series_pct: Object.fromEntries(Object.entries(s).map(([k, vals]) => [k, vals.map(r2)])),
        notas: [
          'Cada lista va de la semana más vieja a la más nueva, alineada con semanas_lunes. null = la semana no tuvo denominador (no es 0%).',
          // Las claves que vienen son las del funnel de ESTE workspace: nombrar
          // `form_agenda` o `calificado_cierre` acá le afirmaba al modelo unas etapas
          // que un negocio sin reuniones no tiene.
          'Las etapas del CRM agrupan por la fecha de la 1ª reunión; si el funnel no tiene reuniones, agrupan por la fecha de alta del lead. El cierre cuenta la etapa ganado. La semana en curso está incompleta.',
        ],
      });
    },
  },

  ver_tendencias: {
    leer: async (input) => {
      const { desde, hasta } = await rango(input);
      // La lib ajusta la ventana por su cuenta (piso, techo y períodos completos); se
      // repite el cálculo de lib/queries.ts (_getTendencias) para DECIR la ventana
      // que de verdad se leyó y para contar las lecturas que hace sin paginar.
      const PISO = '2025-11-01';
      const desdeEf = desde < PISO ? PISO : desde;
      const ayer = ayerEnTijuana();
      const hastaEf = hasta > ayer && ayer >= desdeEf ? ayer : hasta;
      const span = Math.max(0, diasEntre(desdeEf, hastaEf) - 1);
      const gran = span <= 31 ? 'diario' : span <= 180 ? 'semanal' : 'mensual';
      const hayPeriodos = desdeEf <= hastaEf;
      const leidoDesde = !hayPeriodos || gran === 'diario' ? desdeEf : gran === 'semanal' ? lunesDeFecha(desdeEf) : primerDiaMes(desdeEf);
      const leidoHasta = !hayPeriodos || gran === 'diario' ? hastaEf : gran === 'semanal' ? diasAntes(lunesDeFecha(hastaEf), -6) : finDeMes(hastaEf);
      const filtroLeads = `fecha_agenda.gte.${leidoDesde},fecha_junta_1.gte.${leidoDesde},fecha_cierre.gte.${leidoDesde}`;
      const [t, filasLeads, filasPagos] = await Promise.all([
        getTendencias(desde, hasta),
        contarFilas('leads', (q) => q.or(filtroLeads)),
        contarFilas('pagos', (q) => q.eq('pagado', true).gte('fecha_pago', leidoDesde).lte('fecha_pago', leidoHasta)),
      ]);
      const recortes = [
        avisoRecorte('agendas, asistencias, cierres y CAC', filasLeads, 'los conteos reales son MAYORES (qué leads quedaron afuera no está definido) y el CAC real es más bajo'),
        avisoRecorte('cash cobrado', filasPagos),
      ].filter((x): x is string => !!x);
      const granularidadCoincide = t.granularidad === gran;
      const serie = (xs: typeof t.marketing) => xs.map((m) => ({
        key: m.key, metrica: m.label, unidad: m.formato, valores: m.valores.map(r2),
        contexto: m.cuadros.filter((c) => c.valor != null || c.texto).map((c) => ({ que: c.label, valor: c.texto ?? r2(c.valor), unidad: c.texto ? 'texto' : c.formato })),
      }));
      return json({
        ventana_pedida: ventana(desde, hasta),
        ventana_recortada: hayPeriodos ? ventana(desdeEf, hastaEf) : null,
        ventana_leida: granularidadCoincide && hayPeriodos ? ventana(leidoDesde, leidoHasta) : null,
        granularidad: t.granularidad,
        periodos: t.periodos,
        marketing: serie(t.marketing),
        comercial: serie(t.comercial),
        notas: [
          ...recortes,
          ...(granularidadCoincide ? [] : ['No se pudo reconstruir la ventana leída (la granularidad no coincide con la calculada aquí): tómala como aproximada.']),
          'unidad: usd = dólares, num = cantidad, pct = porcentaje. valores alineados con periodos; null = sin datos en ese período.',
          'ventana_recortada = la pedida, sin empezar antes del 2025-11-01 y terminando ayer (hora de Tijuana). ventana_leida = la que de verdad se sumó: con granularidad semanal o mensual se estira a períodos completos, así que el primer período puede incluir días antes de «desde» y el último puede incluir fechas FUTURAS (por ejemplo, reuniones 1 ya agendadas cuentan como agendas del mes en curso).',
          'Agendas = reuniones 1 por la fecha de la reunión. Cierres = etapa ganado. Los plays del VSL suman Panda, YouTube y el VSL de prueba en una sola línea.',
          NOTA_USD,
        ],
      });
    },
  },

  detectar_fatiga_adsets: {
    leer: async (input) => {
      const h = await dia(input);
      if (typeof h !== 'string') return errorPedido(h.error);
      const xs = await getFatigaAdsets(h);
      return json({
        // La lib (getFatigaAdsets) filtra fecha >= hasta−7 y >= hasta−28, ambos
        // inclusive: son 8 y 29 días, y así se nombran.
        ventana_corta: ventana(diasAntes(h, 7), h),
        ventana_larga: ventana(diasAntes(h, 28), h),
        criterio: 'en la ventana corta (8 días): gasto > 50 USD, frecuencia media > 3.5 y costo por formulario > 1.5 × el de la ventana larga (29 días). Las tres a la vez.',
        adsets: xs.map((a) => ({
          adset: a.adset_name, frecuencia_media_ventana_corta: r2(a.frequency_7d),
          costo_por_formulario_ventana_corta_usd: r2(a.cpl_7d_usd), costo_por_formulario_ventana_larga_usd: r2(a.cpl_28d_usd),
        })),
        notas: [
          xs.length ? `${xs.length} conjunto(s) cumplen las tres condiciones.` : 'Ningún conjunto cumple las tres condiciones. Si no hay datos de Meta en la ventana, también sale vacío: no es lo mismo que «todo sano».',
          'El costo por formulario usa formularios instantáneos de Meta; un conjunto sin formularios en 7 o 28 días queda afuera del chequeo.',
          NOTA_USD,
        ],
      });
    },
  },

  comparar_agendas_meta_crm: {
    leer: async (input) => {
      const { desde, hasta } = await rango(input);
      const [c, filas] = await Promise.all([
        getAgendasComparador(desde, hasta),
        contarFilas('marketing_metrics_daily', (q) => q.eq('plataforma', 'meta').not('ad_id', 'is', null).gte('fecha', desde).lte('fecha', hasta)),
      ]);
      const recorte = avisoRecorte('agendas_segun_meta', filas);
      return json({
        ventana: ventana(desde, hasta),
        agendas_segun_meta: c.meta,
        agendas_segun_crm: c.crm,
        diferencia_meta_menos_crm: c.meta - c.crm,
        notas: [
          ...(recorte ? [recorte] : []),
          'agendas_segun_meta = lo que Meta se ATRIBUYE por su modelo (conversión del píxel por anuncio). agendas_segun_crm = leads con fecha de reunión 1 en la ventana, vengan o no de un anuncio.',
          'No se suman: son dos mediciones de cosas que se pisan. Un costo por agenda calculado con el número de Meta es optimista si Meta es mayor.',
        ],
      });
    },
  },

  ver_serie_vsl: {
    leer: async (input) => {
      const dias = entero(input, 'dias', 56);
      const s = await getVslSerie(dias);
      const hoyUtc = new Date().toISOString().slice(0, 10);
      return json({
        ventana: ventana(diasAntes(hoyUtc, dias), hoyUtc),
        plays_por_dia: s.dias,
        plays_total: s.total_plays,
        espectadores_panda_suma_diaria: s.unique_viewers,
        retencion_p50_promedio_pct: r2(s.retention_pct),
        visionado_promedio_segundos: r2(s.avg_watch_seconds),
        panda_con_datos: s.fuente_panda_activa,
        notas: [
          'plays_por_dia solo trae los días con alguna fila; un día que falta es un día sin dato, no necesariamente cero.',
          'espectadores_panda_suma_diaria suma los únicos de cada día: la misma persona dos días cuenta dos veces. null = Panda sin datos en la ventana.',
          'retencion_p50_promedio_pct es el promedio de la retención MEDIANA (p50) diaria de Panda, sin ponderar por plays: no es una retención media, no la compares con una. La ventana termina hoy en UTC.',
        ],
      });
    },
  },

  a_quien_cobrar: {
    leer: async (input) => {
      const d = fechaOpcional(input, 'desde');
      if (typeof d !== 'string') return errorPedido(d.error);
      const h = fechaOpcional(input, 'hasta');
      if (typeof h !== 'string') return errorPedido(h.error);
      const alReves = rangoAlReves(d, h);
      if (alReves) return alReves;
      const filtra = !!(d && h);
      const hoy = await hoyEnWorkspace();
      const [o, filas] = await Promise.all([
        getOutstandingDetalle(hoy, filtra ? d : null, filtra ? h : null),
        // getOutstandingDetalle lee la tabla pagos ENTERA sin paginar.
        contarFilas('pagos', (q) => q),
      ]);
      const recorte = avisoRecorte('La lista y el total pendiente', filas, 'pueden faltar clientes y el pendiente real es MAYOR');
      const notas = [
        ...(recorte ? [recorte] : []),
        filtra
          ? `Solo cuotas sin pagar que vencen entre ${d} y ${h}. Una cuota sin fecha de vencimiento no entra en el filtro.`
          : 'Todo lo pendiente a hoy, sin importar cuándo vence (incluye cuotas futuras y cuotas sin fecha).',
        'proxima_cuota = la cuota sin pagar que vence primero; su pago_id es el que pide marcar_pago_cobrado. dias_desde_cierre null = el lead no tiene fecha de cierre.',
      ];
      if (!d !== !h) notas.unshift('Llegó solo uno de desde/hasta: el filtro por vencimiento necesita los dos, así que NO se filtró.');
      return json({
        a_la_fecha: hoy,
        filtro_vencimiento: filtra ? ventana(d, h) : null,
        clientes_con_pendiente: o.items.length,
        pendiente_total_usd: r2(o.total),
        fuera_de_la_lista: Math.max(0, o.items.length - LIMITE_COBRANZA),
        clientes: o.items.slice(0, LIMITE_COBRANZA).map((x) => ({
          lead_id: x.lead_id, nombre: x.lead_nombre,
          vendido_usd: r2(x.vendido_usd), cobrado_usd: r2(x.cobrado_usd), pendiente_usd: r2(x.pendiente_usd),
          dias_desde_cierre: x.dias_desde_cierre,
          proxima_cuota: x.proxima_cuota
            ? { pago_id: x.proxima_cuota.pago_id, numero: x.proxima_cuota.numero, monto_usd: r2(x.proxima_cuota.monto_usd), vence: x.proxima_cuota.fecha_esperada }
            : null,
        })),
        notas,
      });
    },
  },

  cuotas_pendientes: {
    leer: async (input) => {
      const diasAviso = entero(input, 'dias_aviso', 3);
      const hoy = await hoyEnWorkspace();
      const [c, filas] = await Promise.all([
        getCuotasPendientes(hoy, diasAviso),
        // getCuotasPendientes lee las cuotas sin pagar con fecha sin paginar.
        contarFilas('pagos', (q) => q.eq('pagado', false).not('fecha_esperada', 'is', null)),
      ]);
      const recorte = avisoRecorte('Las cuotas pendientes', filas, 'pueden faltar cuotas (las que vencen más tarde, porque la lectura va por vencimiento)');
      const cuota = (x: CuotaPendiente) => ({
        pago_id: x.pago_id, lead_id: x.lead_id, nombre: x.lead_nombre, numero_cuota: x.numero,
        monto_usd: r2(x.monto_usd), vence: x.fecha_esperada,
      });
      return json({
        a_la_fecha: hoy,
        dias_aviso: diasAviso,
        vencidas: {
          total: c.vencidas.length,
          monto_usd: r2(c.vencidas.reduce((s, x) => s + x.monto_usd, 0)),
          fuera_de_la_lista: Math.max(0, c.vencidas.length - LIMITE_COBRANZA),
          cuotas: c.vencidas.slice(0, LIMITE_COBRANZA).map((x) => ({ ...cuota(x), dias_de_atraso: -x.dias })),
        },
        por_vencer: {
          total: c.porVencer.length,
          monto_usd: r2(c.porVencer.reduce((s, x) => s + x.monto_usd, 0)),
          fuera_de_la_lista: Math.max(0, c.porVencer.length - LIMITE_COBRANZA),
          cuotas: c.porVencer.slice(0, LIMITE_COBRANZA).map((x) => ({ ...cuota(x), dias_para_vencer: x.dias })),
        },
        notas: [
          ...(recorte ? [recorte] : []),
          `vencidas = vencimiento antes de ${hoy}; por_vencer = vence entre hoy y ${diasAviso} días. Las vencidas van de la más vieja a la más nueva.`,
          'Las cuotas sin fecha de vencimiento no aparecen aquí (ver a_quien_cobrar). Una lista vacía = ninguna cuota en ese grupo, no un error.',
        ],
      });
    },
  },

  ver_revenue_periodo: {
    leer: async (input) => {
      const { desde, hasta } = await rango(input);
      const [r, filasMeta, filasCash, filasOut, filasSold] = await Promise.all([
        getRevenuePeriod(desde, hasta),
        contarFilas('marketing_metrics_daily', (q) => q.eq('plataforma', 'meta').gte('fecha', desde).lte('fecha', hasta)),
        contarFilas('pagos', (q) => q.eq('pagado', true).gte('fecha_pago', desde).lte('fecha_pago', hasta)),
        contarFilas('pagos', (q) => q.eq('pagado', false).gte('fecha_esperada', desde)),
        // El mismo universo que lee getRevenuePeriod: sin los «sin cobro» (#747).
        contarFilas('leads', (q) => q.eq('cerro', true).neq('venta_tipo', VENTA_SIN_COBRO).gte('fecha_cierre', desde).lte('fecha_cierre', hasta)),
      ]);
      const recortes = [
        avisoRecorte('meta_gasto_usd (y con él el CAC y los ROAS)', filasMeta, 'el gasto real es MAYOR, el CAC real es más alto y los ROAS reales más bajos'),
        avisoRecorte('cash_cobrado_usd', filasCash),
        avisoRecorte('outstanding_usd', filasOut),
        avisoRecorte('sold_usd', filasSold),
      ].filter((x): x is string => !!x);
      return json({
        ventana: ventana(desde, hasta),
        sold_usd: r2(r.sold_revenue_usd),
        cierres_en_ventana: r.cierres_en_periodo,
        cash_cobrado_usd: r2(r.cash_collected_usd),
        outstanding_usd: r2(r.outstanding_usd),
        outstanding_nota: `cuotas sin pagar con vencimiento desde ${desde} en adelante, SIN tope: incluye cuotas que vencen después de ${hasta}.`,
        clientes_con_primer_pago_en_ventana: r.primeros_pagos_en_periodo,
        meta_gasto_usd: r2(r.meta_spend_usd),
        cac_usd: r2(r.cac_usd),
        cac_nota: 'meta_gasto_usd ÷ clientes con primer pago en la ventana. null = ninguno. Es distinto del CAC por cierres de resumir_marketing_periodo y de analisis_negocio.',
        roas_cash: r2(r.roas_cash),
        roas_sold: r2(r.roas_sold),
        notas: [
          ...recortes,
          'sold = monto firmado de leads con cerro y fecha de cierre en la ventana; los «sin cobro» (becados) no cuentan como cierre. cash = cuotas pagadas con fecha de pago en la ventana (incluye clientes de meses anteriores): sold y cash del mismo período no tienen por qué parecerse.',
          'Las suscripciones no entran en sold ni en cash (ver ver_mrr_activo).',
          NOTA_USD,
        ],
      });
    },
  },

  ver_revenue_mensual: {
    leer: async (input) => {
      const h = await dia(input);
      if (typeof h !== 'string') return errorPedido(h.error);
      const meses = entero(input, 'meses', 18);
      const [y, m] = h.split('-').map(Number);
      const inicio = new Date(Date.UTC(y, m - meses, 1)).toISOString().slice(0, 10);
      const [puntos, filasSold, filasCash, filasR1] = await Promise.all([
        getRevenueMensual(h, meses),
        contarFilas('leads', (q) => q.eq('cerro', true).neq('venta_tipo', VENTA_SIN_COBRO).gte('fecha_cierre', inicio)),
        contarFilas('pagos', (q) => q.eq('pagado', true).gte('fecha_pago', inicio)),
        contarFilas('leads', (q) => q.not('fecha_junta_1', 'is', null).gte('fecha_junta_1', inicio)),
      ]);
      const recortes = [
        avisoRecorte('sold_usd y cierres', filasSold),
        avisoRecorte('cash_usd', filasCash),
        avisoRecorte('reuniones_1', filasR1),
      ].filter((x): x is string => !!x);
      return json({
        ventana: ventana(puntos[0] ? `${puntos[0].mes}-01` : inicio, h),
        meses: puntos.map((p) => ({ mes: p.mes, sold_usd: p.sold_usd, cash_usd: p.cash_usd, meta_gasto_usd: p.spend_usd, cierres: p.cierres, reuniones_1: p.agendas })),
        notas: [
          ...recortes,
          'Montos redondeados al dólar. Los meses iniciales sin ninguna actividad no aparecen; un mes intermedio en cero sí. El mes de `hasta` está incompleto si es el mes en curso.',
          'cierres = leads con cerro por fecha de cierre, sin los «sin cobro» (becados); reuniones_1 = leads con fecha de reunión 1 en el mes.',
          NOTA_USD,
        ],
      });
    },
  },

  ver_mrr_activo: {
    leer: async () => {
      const hoy = await hoyEnWorkspace();
      const r = await getMrrActivo(hoy);
      return json({
        a_la_fecha: hoy,
        mrr_usd: r2(r.mrr),
        suscripciones_activas: r.activas,
        notas: [
          'Activas = leads en etapa ganado con venta de tipo suscripción y monto mayor a 0: indefinidas, o de plazo fijo cuyo fin (fecha de cierre + meses) todavía no pasó. Más las suscripciones activas que cobra la pasarela (Stripe o Mercado Pago) a un lead que no es de suscripción (por ejemplo, uno que compró como pago único y después se suscribió).',
          'Va aparte del high-ticket: no está en sold ni en cash.',
        ],
      });
    },
  },

  ver_cac_acumulado: {
    leer: async (input) => {
      const h = fechaOpcional(input, 'hasta');
      if (typeof h !== 'string') return errorPedido(h.error);
      const r = await getCACAcumulado(h || undefined);
      return json({
        ventana: { desde: 'primer dato', hasta: h || 'hoy' },
        meta_gasto_total_usd: r2(r.spend_total_usd),
        cierres_total: r.cierres_total,
        cac_usd: r2(r.cac_usd),
        notas: [
          'cac_usd = gasto total de Meta ÷ leads con cerro (por fecha de cierre). null = sin cierres. Es todo el histórico: no sirve para comparar con un mes sin aclararlo.',
          NOTA_USD,
        ],
      });
    },
  },

  ver_cac_mensual: {
    leer: async (input) => {
      const meses = entero(input, 'meses', 12);
      const [xs, filas] = await Promise.all([
        listCACMensual(meses),
        contarFilas('leads', (q) => q.not('fecha_primer_pago', 'is', null)),
      ]);
      const recorte = avisoRecorte('primeros_pagos', filas, 'faltan primeros pagos, así que algún CAC real es más BAJO y puede faltar algún mes');
      return json({
        meses: xs.map((e) => ({ mes: e.mes, meta_gasto_usd: r2(e.spend_usd), clientes_con_primer_pago: e.primeros_pagos, cac_usd: r2(e.cac_usd) })),
        notas: [
          ...(recorte ? [recorte] : []),
          'Solo aparecen los meses con al menos un primer pago: un mes que falta no es un CAC de cero, es un mes sin clientes nuevos pagando.',
          NOTA_USD,
        ],
      });
    },
  },

  listar_cohortes_semanales: {
    leer: async (input) => {
      const xs = await listCohortesSemanales(entero(input, 'semanas', 8));
      return json({
        cohortes: xs.map((c) => ({
          semana_lunes: c.semana_inicio, madurez: c.estado_madurez, dias_desde_ultima_r1: c.dias_desde_ultima_j1,
          reuniones_1: c.total_j1, asistencias: c.asistencias, limpias: c.limpias, cierres: c.cierres,
          ingreso_usd: c.ingreso_total_usd == null ? null : r2(Number(c.ingreso_total_usd)), dias_promedio_r1_a_cierre: r2(c.dias_promedio_ciclo == null ? null : Number(c.dias_promedio_ciclo)),
        })),
        notas: [
          'La más reciente primero. madura = la última R1 de la semana fue hace 14 días o más; solo ahí la tasa de cierre es confiable.',
          'asistencias cuenta solo las marcadas como asistió: las reuniones sin marcar no están ni como asistencia ni como no-show.',
        ],
      });
    },
  },

  listar_cohortes_mensuales: {
    leer: async (input) => {
      const xs = await listCohortesMensuales(entero(input, 'meses', 6));
      return json({
        cohortes: xs.map((c) => ({
          mes_inicio: c.mes_inicio, madurez: c.estado_madurez, dias_desde_ultima_r1: c.dias_desde_ultima_j1,
          reuniones_1: c.total_j1, asistencias: c.asistencias, limpias: c.limpias, cierres: c.cierres,
          ingreso_usd: c.ingreso_total_usd == null ? null : r2(Number(c.ingreso_total_usd)), dias_promedio_r1_a_cierre: r2(c.dias_promedio_ciclo == null ? null : Number(c.dias_promedio_ciclo)),
        })),
        notas: [
          'La más reciente primero. La madurez del MES se mide por su última R1: una R1 tardía vuelve «reciente» a todo el mes. Para la tasa de cierre usa ver_embudo_comercial_maduro.',
        ],
      });
    },
  },

  ver_embudo_comercial_maduro: {
    leer: async (input) => {
      const d = fechaOpcional(input, 'desde');
      if (typeof d !== 'string') return errorPedido(d.error);
      const h = fechaOpcional(input, 'hasta');
      if (typeof h !== 'string') return errorPedido(h.error);
      const alReves = rangoAlReves(d, h);
      if (alReves) return alReves;
      const r = await getResumenComercialMaduras(d || null, h || null);
      return json({
        semanas_filtradas: { lunes_desde: d || 'primer dato', lunes_hasta: h || 'hoy' },
        cohortes_maduras: r.cohortes_maduras_count,
        reuniones_1: r.total_j1,
        asistencias: r.asistencias,
        sin_asistencia_confirmada: r.total_j1 - r.asistencias,
        limpias: r.limpias,
        cierres: r.cierres,
        ingreso_usd: r2(r.ingreso_total_usd),
        tasa_cierre_madura_pct: r2(r.tasa_cierre_madura),
        dias_promedio_r1_a_cierre: r2(r.dias_promedio_ciclo),
        notas: [
          'sin_asistencia_confirmada = reuniones 1 − asistencias: MEZCLA a los que no vinieron con los que nadie marcó. No lo llames «no-show» sin esa salvedad.',
          'tasa_cierre_madura_pct = cierres ÷ limpias × 100; null = sin limpias. cierres = leads con cerro.',
          r.cohortes_maduras_count === 0 ? 'No hay ninguna semana madura en el filtro: todos los números en cero significan «todavía no hay datos confiables», no «cero ventas».' : 'Solo semanas cuya última R1 fue hace 14 días o más.',
        ],
      });
    },
  },

  listar_leads_embudo_maduro: {
    leer: async (input) => {
      const d = fechaOpcional(input, 'desde');
      if (typeof d !== 'string') return errorPedido(d.error);
      const h = fechaOpcional(input, 'hasta');
      if (typeof h !== 'string') return errorPedido(h.error);
      const alReves = rangoAlReves(d, h);
      if (alReves) return alReves;
      const [f, resumen] = await Promise.all([
        getFunnelMadurasLeads(d || null, h || null),
        getResumenComercialMaduras(d || null, h || null),
      ]);
      const buckets: Record<string, FunnelLeadItem[]> = { agenda: f.agenda, asistio: f.asistio, no_show: f.noShow, calificado: f.calificado, cierre: f.cierre };
      const etapa = str(input, 'etapa');
      const elegidas = etapa ? [etapa] : Object.keys(buckets);
      const etapas: Record<string, unknown> = {};
      for (const k of elegidas) {
        const xs = buckets[k] ?? [];
        etapas[k] = {
          total: xs.length,
          fuera_de_la_lista: Math.max(0, xs.length - LIMITE_LEADS_POR_ETAPA),
          leads: xs.slice(0, LIMITE_LEADS_POR_ETAPA).map((l) => ({
            lead_id: l.leadId, nombre: l.nombre, empresa: l.empresa, fecha_r1: l.fechaJ1,
            asistio_r1: l.asistioJ1, calificado: l.calificado, cerro: l.cerro, monto_cierre_usd: l.monto, etapa_actual: l.estado,
          })),
        };
      }
      const notas = [
        'asistio_r1 y calificado son tri-estado: null = nadie lo marcó (no es «no»). no_show incluye esos null.',
        `Hasta ${LIMITE_LEADS_POR_ETAPA} leads por etapa, los de R1 más reciente primero; fuera_de_la_lista dice cuántos quedaron afuera.`,
      ];
      if (f.agenda.length !== resumen.total_j1) {
        notas.unshift(`El detalle trae ${f.agenda.length} reuniones 1 y el embudo agregado cuenta ${resumen.total_j1}: la lista está incompleta (la lectura de leads no pagina) o cambió un dato entre las dos lecturas. No la presentes como completa.`);
      }
      return json({ semanas_filtradas: { lunes_desde: d || 'primer dato', lunes_hasta: h || 'hoy' }, etapas, notas });
    },
  },

  ver_ciclo_venta: {
    leer: async () => {
      const [s, filas] = await Promise.all([
        getSCL(),
        contarFilas('leads', (q) => q.not('fecha_agenda', 'is', null).not('fecha_primer_pago', 'is', null)),
      ]);
      const recorte = avisoRecorte('el ciclo de venta', filas, 'el promedio y el P90 salen de una parte de los leads, no de todos');
      return json({
        leads_con_agenda_y_primer_pago: s.count,
        dias_promedio_agenda_a_primer_pago: r2(s.avg_dias),
        dias_p90_agenda_a_primer_pago: s.p90_dias,
        notas: [
          ...(recorte ? [recorte] : []),
          'Todo el histórico. null = menos de 3 leads con las dos fechas (no es honesto promediar tan pocos).',
          'Distinto de dias_promedio_r1_a_cierre de las cohortes: aquí se mide hasta el primer PAGO, no hasta la firma.',
        ],
      });
    },
  },

  ver_tramos_ciclo_venta: {
    leer: async () => {
      const [t, filas] = await Promise.all([getTramosSCL(), contarFilas('leads', (q) => q)]);
      const recorte = avisoRecorte('los tramos del ciclo', filas, 'los promedios salen de una parte de los leads (cuál, no está definido), no de todos');
      return json({
        tramos: t.tramos.map((x) => ({ tramo: x.label, dias_promedio: r2(x.dias_promedio), leads_con_las_dos_fechas: x.n })),
        tramo_mas_lento: t.tramo_mas_lento,
        dias_total_ciclo: r2(t.total_dias),
        notas: [
          ...(recorte ? [recorte] : []),
          ...(t.tramos.some((x) => x.label === 'Formulario → Agenda' && x.n === 0)
            ? ['Formulario → Agenda con 0 leads: ese tramo solo cuenta leads que entraron por un formulario instantáneo de Meta. Si el negocio capta por otro lado (landing, WhatsApp, orgánico), sale 0 aunque tenga leads: no significa que no haya leads.']
            : []),
          'Todo el histórico. dias_promedio null = ningún lead tiene las dos fechas de ese tramo. dias_total_ciclo suma los tramos con datos: cada tramo sale de un grupo de leads distinto.',
        ],
      });
    },
  },

  ver_distribucion_pipeline: {
    leer: async () => {
      const [p, filas] = await Promise.all([
        getDistribucionPipeline(),
        contarFilas('leads', (q) => q.eq('asistio_j1', true)),
      ]);
      const recorte = avisoRecorte('la distribución del pipeline', filas);
      return json({
        a_la_fecha_utc: new Date().toISOString().slice(0, 10),
        abiertos_total: p.total,
        reciente_menos_5_dias: p.reciente,
        madurando_5_a_13_dias: p.madurando,
        madura_14_o_mas_dias: p.madura,
        pct: { reciente: r2(p.pct_reciente), madurando: r2(p.pct_madurando), madura: r2(p.pct_madura) },
        notas: [
          ...(recorte ? [recorte] : []),
          'Abiertos = leads que asistieron a la R1 y no tienen cerro. Incluye a los perdidos o descalificados que nunca se marcaron como cerrados: no es solo pipeline vivo.',
          'Los días se cuentan desde la fecha de la R1 hasta hoy en UTC.',
        ],
      });
    },
  },
};
