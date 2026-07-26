// =============================================================================
// _demo — datos de demostración para /experimentos SOLO en desarrollo
// =============================================================================
// En local no hay claves de Supabase (getSupabaseServer tira), así que la página
// arrancaría vacía. Este módulo da datos realistas para poder VER e iterar el
// diseño en preview. La página SOLO lo usa cuando NODE_ENV !== 'production' y la
// lectura real falló. En producción nunca se muestra.
// =============================================================================

import type { ExperimentosView, ExperimentoConMedicion, Experimento, Medicion } from '@/lib/experimentos';
import type { Retro } from '@/lib/retro';
import type { RetroReporte } from '@/lib/retro-reporte';
import type { Tarea, Categoria } from '@/lib/todo';

const serie = (base: number, pts: number[], _desde?: string): { fecha: string; valor: number }[] =>
  pts.map((d, i) => ({ fecha: `2026-06-${String(10 + i).padStart(2, '0')}`, valor: +(base * d).toFixed(2) }));

function med(p: Partial<Medicion>): Medicion {
  return {
    baseline: 0, actual: 0, objetivo: null, dias_corridos: 7, dias_total: 14,
    delta_pct: null, va_bien: null, serie: [], desde: '2026-06-10', hasta: '2026-06-16',
    baseline_desde: '2026-06-03', baseline_hasta: '2026-06-09', ...p,
  };
}
function exp(p: Partial<Experimento>): Experimento {
  return {
    id: 0, titulo: '', hipotesis: '', cambio: null, estado: 'activo', origen: 'mako',
    metrica: 'cpl', metrica_label: 'Costo por vista de landing', direccion: 'bajar',
    objetivo_valor: null, criterio_exito: null, baseline_valor: null, baseline_desde: null,
    baseline_hasta: null, ventana_dias: 14, presupuesto_usd: null, fecha_inicio: '2026-06-10',
    fecha_fin: '2026-06-23', veredicto: null, resultado_valor: null, aprendizaje: null,
    cerrado_at: null, config: null, racional: null, model: 'claude-opus-4-8',
    created_at: '2026-06-10T12:00:00Z', updated_at: '2026-06-16T12:00:00Z', ...p,
  };
}

const activos: ExperimentoConMedicion[] = [
  {
    ...exp({ id: 1, titulo: 'Filtro más duro en el formulario', hipotesis: 'Si pido facturación mínima en el instant form, baja el costo por agenda calificada aunque entren menos leads.', cambio: 'Agregar pregunta de facturación con umbral y descartar < $50k/mes.', metrica: 'cpa', metrica_label: 'Costo por agenda', direccion: 'bajar', objetivo_valor: 42, ventana_dias: 14 }),
    medicion: med({ baseline: 61.4, actual: 48.2, objetivo: 42, dias_corridos: 6, dias_total: 14, delta_pct: -21.5, va_bien: true, serie: serie(61, [1, 0.96, 0.9, 0.86, 0.82, 0.79], '2026-06-10') }),
  },
  {
    ...exp({ id: 2, titulo: 'Hook nuevo en el VSL (primeros 15s)', hipotesis: 'Un hook con la promesa numérica adelante sube la tasa de agenda desde el VSL.', cambio: 'Reeditar la apertura del VSL con el resultado concreto en los primeros 15s.', metrica: 'tasa_agenda', metrica_label: 'Tasa formulario → agenda', direccion: 'subir', objetivo_valor: 34, ventana_dias: 21 }),
    medicion: med({ baseline: 28.5, actual: 26.9, objetivo: 34, dias_corridos: 5, dias_total: 21, delta_pct: -5.6, va_bien: false, serie: serie(28.5, [1, 0.99, 0.95, 0.94, 0.94], '2026-06-10') }),
  },
  {
    ...exp({ id: 3, titulo: 'Subir presupuesto del ganador 20%', hipotesis: 'Escalar el creativo ganador 20% mantiene el CPL sin quemar la audiencia.', cambio: 'Subir $80→$96/día el adset del anuncio 003.', metrica: 'cpl', metrica_label: 'Costo por vista de landing', direccion: 'bajar', objetivo_valor: null, ventana_dias: 10 }),
    medicion: med({ baseline: 1.82, actual: 1.79, objetivo: null, dias_corridos: 3, dias_total: 10, delta_pct: -1.6, va_bien: true, serie: serie(1.82, [1, 0.99, 0.98], '2026-06-10') }),
  },
];

const aprendizajes: Experimento[] = [
  exp({ id: 10, estado: 'cerrado', veredicto: 'validada', titulo: 'Retargeting a video-viewers 50%', hipotesis: '¿Un adset de retargeting a quienes vieron 50% del VSL baja el CAC?', metrica: 'cac', metrica_label: 'CAC (costo por cierre)', direccion: 'bajar', baseline_valor: 2100, resultado_valor: 1540, aprendizaje: 'El retargeting a video-viewers 50% bajó el CAC de $2,100 a $1,540 (-27%) en 14 días. Validado: se sostiene como adset fijo.', cerrado_at: '2026-06-08T12:00:00Z', config: { serie_cierre: serie(2100, [1, 0.98, 0.9, 0.85, 0.78, 0.74, 0.73], '2026-05-25') } }),
  exp({ id: 11, estado: 'cerrado', veredicto: 'refutada', titulo: 'Bajar el precio en la landing', hipotesis: '¿Mostrar el precio en la landing sube la tasa de agenda?', metrica: 'tasa_agenda', metrica_label: 'Tasa formulario → agenda', direccion: 'subir', baseline_valor: 29, resultado_valor: 24.5, aprendizaje: 'Mostrar el precio en la landing BAJÓ la tasa de agenda de 29% a 24.5% (-15%). Refutada: el precio adelante filtra de más. Se revierte.', cerrado_at: '2026-06-01T12:00:00Z', config: { serie_cierre: serie(29, [1, 0.97, 0.9, 0.86, 0.85], '2026-05-18') } }),
  exp({ id: 12, estado: 'cerrado', veredicto: 'no_concluyente', titulo: 'Cambiar el CTA del anuncio', hipotesis: '¿"Agendá tu diagnóstico" rinde mejor que "Mirá el video"?', metrica: 'ctr', metrica_label: 'CTR', direccion: 'subir', baseline_valor: 1.9, resultado_valor: 1.95, aprendizaje: 'El CTR pasó de 1.9% a 1.95% (+2.6%): dentro del ruido y con poca muestra (4 días). No concluyente: reintentar con más días.', cerrado_at: '2026-05-28T12:00:00Z', config: {} }),
];

const propuestos: Experimento[] = [
  exp({ id: 20, estado: 'propuesto', titulo: 'Segundo día de nutrición por WhatsApp', hipotesis: 'Un follow-up al día 2 recupera agendas de los que no agendaron.', metrica: 'agendamientos', metrica_label: 'Agendas', direccion: 'subir', ventana_dias: 14, origen: 'mako' }),
];

export const demoView: ExperimentosView = {
  activos,
  propuestos,
  aprendizajes,
  descartados: [],
  counts: { activos: activos.length, propuestos: propuestos.length, cerrados: aprendizajes.length, validadas: 1 },
};

// ── Reporte v3 de demo (los datos de muestra del diseño de Claude Design) ──
export const demoReporte: RetroReporte = {
  version: 3,
  tesis: {
    texto: 'Compraste atención más barata que nunca, pero la perdés en el VSL: de cada 100 que llegan a la landing, 93 no lo ven. Las llamadas cierran bien, así que arreglar ese tramo vale más que todo lo demás junto.',
    highlight: '93 no lo ven',
  },
  fuga: { valor: '$18k', unidad: 'por período', titulo: 'El problema principal, en plata', texto: 'El VSL: solo el 7% de la landing lo ve. Recuperar la mitad de ese tramo valdría cerca de $18,000 en ventas nuevas por período.' },
  areas: [
    { id: 'adquisicion', name: 'Adquisición', st: 'good', line: 'Comprás atención más barata que nunca: CPL $9.2, ↓22%' },
    { id: 'nutricion', name: 'Nutrición', st: 'bad', line: '304 leads, el 63%, sin un solo mensaje' },
    { id: 'conversion', name: 'Conversión', st: 'warn', line: 'El no-show se concentra en «Oferta directa»' },
    { id: 'creativos', name: 'Creativos', st: 'good', line: '«Resultado en 5 s» gana clarísimo' },
    { id: 'revenue', name: 'Revenue', st: 'good', line: 'CAC ↓12% con el cash arriba, ojo 2 cuotas' },
    { id: 'experimentos', name: 'Experiments', st: 'gris', line: 'Datos a medias: todavía no concluyo' },
  ],
  findings: [
    { id: 'f1', tipo: 'cruce', area: 'nutricion', tool: 'crosses', cross: 'Nutrición × Conversión', ev: { type: 'num', value: '2.4×', label: 'más cierre con al menos un mensaje', tone: 'blue' }, short: 'Los nutridos cierran 2.4 veces más: los 304 fríos valen ~7 cierres.', insight: 'Los leads nutridos cierran 2.4 veces más que los fríos: los 304 sin tocar valen cerca de 7 cierres.', source: 'CRM + Closing · nov a jun', tab: 'CRM', recId: 'p2' },
    { id: 'f2', tipo: 'cruce', area: 'creativos', tool: 'crosses', cross: 'Ads Analyst × Graphics', ev: { type: 'bars', rows: [{ label: '«resultado en 5 s»', val: '$7.4', pct: 57, strong: true, tone: 'blue' }, { label: 'resto de guiones', val: '$12.9', pct: 100, tone: 'gray' }] }, short: 'El guion ganador paga 43% menos por lead que el resto.', insight: 'El guion explica el CPL: «resultado en 5 s» paga 43% menos por lead que el resto.', source: 'Meta Ads + Ads Analyst · jun', tab: 'Ads Analyst', recId: 'p1' },
    { id: 'f3', tipo: 'hallazgo', area: 'nutricion', tool: 'crm', ev: { type: 'num', value: '304', label: 'leads sin tocar, de 480 en el CRM', tone: 'bad' }, short: 'El 63% de tus leads nunca recibió un mensaje.', insight: 'El 63% de tus leads nunca recibió un mensaje: es plata dormida en el CRM.', source: 'CRM · al 30 jun', tab: 'CRM', recId: 'p2' },
    { id: 'f4', tipo: 'anomalia', area: 'conversion', tool: 'closing', ev: { type: 'bars', rows: [{ label: '«Oferta directa»', val: '34%', pct: 100, strong: true, tone: 'bad' }, { label: 'resto de anuncios', val: '12%', pct: 35, tone: 'gray' }] }, short: 'El no-show no es del negocio: lo trae «Oferta directa».', insight: 'El no-show no es del negocio: lo concentran las agendas de «Oferta directa», 34% contra 12%.', source: 'Calendly + Meta Ads · jun', tab: 'Closing Analyst', recId: 'p4' },
    { id: 'f5', tipo: 'cruce', area: 'conversion', tool: 'crosses', cross: 'Closing × Offer', ev: { type: 'bars', rows: [{ label: 'score ≥ 7', val: '71% pasa', pct: 71, strong: true, tone: 'blue' }, { label: 'score < 7', val: '22% pasa', pct: 22, tone: 'gray' }] }, short: 'Subí 1 punto el score de la R1 y sumás ~6 R2.', insight: 'Subí 1 punto el score de la R1 y sumás cerca de 6 R2 por período.', source: 'Closing · nov a jun', tab: 'Closing Analyst' },
    { id: 'f6', tipo: 'hallazgo', area: 'creativos', tool: 'script', ev: { type: 'bars', rows: [{ label: 'hook rate', val: '38%', pct: 76, strong: true, tone: 'blue' }, { label: 'retención 50%', val: '61%', pct: 100, strong: true, tone: 'blue' }] }, short: '«Resultado en 5 s» engancha y retiene a la vez.', insight: '«Resultado en 5 s» es el único que engancha y retiene a la vez: usalo de base para el VSL nuevo.', source: 'Ads Analyst · jun', tab: 'Ads Analyst' },
    { id: 'f7', tipo: 'anomalia', area: 'adquisicion', tool: 'market', ev: { type: 'spark', vals: [2.1, 2.3, 2.6, 2.9, 3.1, 3.4], tone: 'warn', note: 'frecuencia, 6 semanas' }, short: '«Oferta directa» se está quemando: frecuencia 3.4.', insight: '«Oferta directa» se está quemando: la frecuencia saltó a 3.4 y sigue subiendo.', source: 'Meta Ads · jun', tab: 'Marketing', recId: 'p4' },
    { id: 'f8', tipo: 'hallazgo', area: 'adquisicion', tool: 'market', ev: { type: 'num', value: '$9.2', label: 'CPL, ↓22% en el período', tone: 'good' }, short: 'Comprás atención más barata que nunca.', insight: 'Comprás atención más barata que nunca: CPL $9.2, bajando 22%. El problema del período no está acá.', source: 'Meta Ads · jun', tab: 'Marketing' },
    { id: 'f9', tipo: 'anomalia', area: 'revenue', tool: 'graphics', ev: { type: 'num', value: '$4,500', label: 'vencido: 2 cuotas de marzo', tone: 'bad' }, short: 'Dos cuotas de marzo siguen vencidas.', insight: 'Dos cuotas de marzo siguen vencidas por $4,500: Securiters y QS Media.', source: 'Cobranza · al 30 jun', tab: 'Graphics', recId: 'p3' },
    { id: 'f10', tipo: 'hallazgo', area: 'revenue', tool: 'graphics', ev: { type: 'num', value: '$1,720', label: 'CAC full, ↓12%, cash ↑9%', tone: 'good' }, short: 'El CAC bajó 12% mientras el cash subió.', insight: 'El CAC bajó 12% mientras el cash cobrado subió 9%: la máquina de plata está sana.', source: 'Cobranza + Ads · jun', tab: 'Graphics' },
  ],
  plan: [
    { id: 'p1', kind: 'exp', destacado: true, origen: 'Nace del cruce Creativos × Adquisición', titulo: 'Grabá el VSL nuevo con el resultado en los primeros 5 segundos.', why: 'Es tu fuga más cara: hoy solo el 7% de la landing entra al VSL, y el guion ganador ya paga 43% menos por lead.', impacto: '~$18k/período', chain: ['Grabar el VSL nuevo con el hook en 5 s', 'Montar el A/B de la landing (50/50)'], experimento: { hipotesis: 'Un VSL con el resultado en 5s sube la tasa landing→VSL del 7%.', cambio: 'VSL nuevo + A/B de la landing.', metrica: 'tasa_landing', direccion: 'subir', objetivo_valor: 14, criterio_exito: 'Duplicar el paso landing→VSL en 21 días.', ventana_dias: 21 } },
    { id: 'p2', kind: 'exp', origen: 'Nace del cruce Nutrición × Conversión', titulo: 'Reactivá los 304 leads sin tocar con una secuencia de 4 mensajes.', why: 'Son leads ya pagados y sin trabajar; los nutridos cierran 2.4 veces más que los fríos.', impacto: '~7 cierres', chain: ['Segmentar los 304 en el CRM', 'Escribir la secuencia de 4 mensajes'], experimento: { hipotesis: 'Reactivar fríos con secuencia de 4 mensajes genera cierres extra.', cambio: 'Secuencia de reactivación a los 304.', metrica: 'cierres', direccion: 'subir', objetivo_valor: null, criterio_exito: '≥3 cierres desde el segmento en 30 días.', ventana_dias: 30 } },
    { id: 'p3', kind: 'tarea', prio: 'alta', origen: 'Nace del hallazgo: 2 cuotas vencidas', titulo: 'Cobrá las 2 cuotas vencidas de marzo.', why: 'Es plata ya vendida sin cobrar: Securiters y QS Media, cohorte de marzo.', impacto: '$4,500 ya', tarea: { detalle: 'Contactar Securiters y QS Media por las cuotas de marzo.' } },
    { id: 'p4', kind: 'tarea', prio: 'media', origen: 'Nace del hallazgo: frecuencia 3.4', titulo: 'Apagá «Oferta directa» y pasá el gasto a «Testimonio Axel».', why: 'CPL $14.6, se quema y concentra el no-show de las agendas.', impacto: 'CPL medio ↓ ~8%', tarea: { detalle: 'Pausar el adset y reasignar presupuesto.' } },
    { id: 'p5', kind: 'tarea', prio: 'media', origen: 'Nace de la cobertura de datos', titulo: 'Configurá el UTM en Calendly.', why: 'Sin eso no puedo atribuir cierres por anuncio ni cerrar 3 cruces.', impacto: 'habilita 3 cruces', tarea: { detalle: 'Agregar UTM a los links de Calendly.' } },
  ],
  seguimiento: [
    { st: 'done', title: 'Secuencia de WhatsApp para leads fríos', estado: 'Hecho', fx: '+9 agendas', fxT: 'good' },
    { st: 'done', title: 'Mover presupuesto a «Testimonio Axel»', estado: 'Hecho', fx: 'CPL bajó 8%', fxT: 'good' },
    { st: 'curso', title: 'Guion de R1 con manejo de objeciones', estado: 'En curso', fx: 'score 6.1 a 6.8', fxT: 'warn' },
    { st: 'no', title: 'Trackear reproducción del VSL', estado: 'Sin tocar', fx: 'sin efecto', fxT: 'gris' },
  ],
  cobertura: [
    { label: 'VSL: 12 de 30 días con dato', tone: 'warn' },
    { label: 'UTM de Calendly sin configurar', tone: 'gris', accion: 'Configurar' },
  ],
  charts: {
    market: { puntos: [ { x: '05/05', spend: 980, cpl: 12.1 }, { x: '12/05', spend: 1050, cpl: 11.4 }, { x: '19/05', spend: 1120, cpl: 10.8 }, { x: '26/05', spend: 1180, cpl: 10.1 }, { x: '02/06', spend: 1240, cpl: 9.7 }, { x: '09/06', spend: 1210, cpl: 9.2 } ], series: ['spend', 'cpl'] },
    graphics: { funnel: [ { label: 'Impresiones', valor: 420000 }, { label: 'Landing', valor: 4100 }, { label: 'VSL', valor: 287, fuga: true }, { label: 'Formularios', valor: 476 }, { label: 'Agendas', valor: 131 }, { label: 'Cierres', valor: 12 } ] },
    crm: { split: [ { label: 'Nutridos', valor: 176, tone: 'good' }, { label: 'Sin tocar', valor: 304, tone: 'bad' } ] },
    closing: { pasos: [ { label: 'Agendas', valor: 131 }, { label: 'R1', valor: 89 }, { label: 'R2', valor: 41 }, { label: 'Cierres', valor: 12 } ], score: 6.8 },
    script: { guiones: [ { nombre: 'Resultado en 5 s', hook: 38, ret: 61, spend: 1420 }, { nombre: 'Testimonio Axel', hook: 31, ret: 48, spend: 980 }, { nombre: 'Oferta directa', hook: 22, ret: 29, spend: 1130 }, { nombre: 'Detrás de escena', hook: 27, ret: 35, spend: 410 } ] },
  },
  proceso: [
    { fase: 'memoria', label: 'Leyendo el retro anterior y su plan…' },
    { fase: 'recoleccion', label: 'Leyendo Adquisición · TOFU…' },
    { fase: 'diagnostico', label: 'Sacando insights de Nutrición · MOFU…' },
    { fase: 'cruces', label: 'Cruzando datos entre áreas…' },
    { fase: 'cerebro', label: 'Priorizando qué mueve la aguja…' },
    { fase: 'verificacion', label: 'Verificando cada número citado…' },
  ],
};

export const demoRetros: Retro[] = [
  {
    id: 2,
    periodo_desde: '2025-11-30',
    periodo_hasta: '2026-06-30',
    titulo: 'El frente compra atención barata; el embudo pierde por dos agujeros',
    resumen: demoReporte.tesis.texto,
    destacados: null,
    recomendaciones: null,
    snapshot: { areas: [], v: 3 },
    reporte: demoReporte,
    model: 'claude-opus-4-8',
    created_at: '2026-07-01T09:00:00Z',
  },
  {
    id: 1,
    periodo_desde: '2026-05-31',
    periodo_hasta: '2026-06-29',
    titulo: 'Junio: el CPL bajó 18% pero la agenda se enfrió',
    resumen: '## Lo que pasó\nEl mes fue de **adquisición más barata pero menos caliente**. El costo por formulario bajó de $12.4 a $10.1 (-18%), y sin embargo las **agendas cayeron 9%**: entra más gente, agenda menos.\n\n- El dato sugiere que el filtro del formulario o la calidad del tráfico cambió — **es una hipótesis, hay que probarla**.\n- El retargeting a video-viewers ya está **validado** como palanca de CAC (lo confirmamos el 8/6).\n- El VSL sigue siendo el cuello: la tasa formulario→agenda no se movió del ~28%.\n\n## Dónde está la palanca\nSi la agenda es el freno, el mayor retorno está en el **tramo VSL→agenda**, no en abaratar más el clic.',
    destacados: [
      { metrica: 'spend_usd', label: 'Inversión', valor: '$4,820', valor_prev: '$4,510', delta: 6.9, tono: 'neutral' },
      { metrica: 'leads_count', label: 'Formularios completados', valor: '476', valor_prev: '392', delta: 21.4, tono: 'good' },
      { metrica: 'cp_form', label: 'Costo por formulario', valor: '$10.13', valor_prev: '$12.40', delta: -18.3, tono: 'good' },
      { metrica: 'agendamientos', label: 'Agendas', valor: '131', valor_prev: '144', delta: -9.0, tono: 'bad' },
      { metrica: 'cpa', label: 'Costo por agenda', valor: '$36.8', valor_prev: '$31.3', delta: 17.6, tono: 'bad' },
      { metrica: 'cierres', label: 'Cierres', valor: '12', valor_prev: '10', delta: 20.0, tono: 'good' },
      { metrica: 'cac', label: 'CAC (costo por cierre)', valor: '$1,720', valor_prev: '$1,950', delta: -11.8, tono: 'good' },
    ],
    recomendaciones: [
      { tipo: 'experimento', titulo: 'Hook del VSL con la promesa adelante', hipotesis: 'Poner el resultado numérico en los primeros 15s sube la tasa formulario→agenda.', cambio: 'Reeditar la apertura del VSL.', metrica: 'tasa_agenda', direccion: 'subir', objetivo_valor: 33, criterio_exito: 'Tasa de agenda ≥ 33% sostenida 3 semanas.', ventana_dias: 21, racional: 'Es el tramo que no se movió en todo el mes y donde está el freno.' },
      { tipo: 'experimento', titulo: 'Filtro de facturación en el form', hipotesis: 'Filtrar por facturación mínima baja el costo por agenda calificada.', cambio: 'Agregar umbral de facturación al instant form.', metrica: 'cpa', direccion: 'bajar', objetivo_valor: 30, criterio_exito: 'CPA calificada ≤ $30.', ventana_dias: 14, racional: 'La caída de agendas puede ser tráfico menos calificado del CPL barato.' },
      { tipo: 'tarea', titulo: 'Revisar por qué cayó la agenda semana 3', detalle: 'Cruzar Calendly con los adsets: ver si un anuncio nuevo metió tráfico frío.', prioridad: 'alta' },
      { tipo: 'tarea', titulo: 'Documentar el retargeting validado como estándar', detalle: 'Dejar el adset de video-viewers 50% como parte fija de la estructura.', prioridad: 'media' },
    ],
    snapshot: null,
    reporte: null,
    model: 'claude-opus-4-8',
    created_at: '2026-06-30T09:00:00Z',
  },
];

const tarea = (p: Partial<Tarea>): Tarea => ({
  id: 0, titulo: '', detalle: null, estado: 'por_hacer', prioridad: 'media', progreso: 0,
  deadline: null, categorias: [], checklist: [], historial: [], en_prioridad: false, score: 62, score_razon: null, origen: 'manual',
  experimento_id: null, retro_id: null, orden: 0, hecho_at: null,
  created_at: '2026-06-20T12:00:00Z', updated_at: '2026-06-20T12:00:00Z', ...p,
});

export const demoCategorias: Categoria[] = [
  { id: 1, nombre: 'Marketing', color: '#3b82f6', emoji: '📈', prioridad: 9, score_razon: null, deadline: null, detalle: '', historial: [], created_at: '2026-06-01T12:00:00Z' },
  { id: 2, nombre: 'Producto', color: '#46a758', emoji: '🧱', prioridad: 6, score_razon: null, deadline: null, detalle: '', historial: [], created_at: '2026-06-01T12:00:00Z' },
  { id: 3, nombre: 'Ventas', color: '#f0a818', emoji: '🤝', prioridad: 8, score_razon: null, deadline: null, detalle: '', historial: [], created_at: '2026-06-01T12:00:00Z' },
];

export const demoTareas: Tarea[] = [
  tarea({ id: 1, titulo: 'Revisar por qué cayó la agenda semana 3', detalle: 'Cruzar Calendly con los adsets nuevos.', prioridad: 'alta', progreso: 20, deadline: '2026-07-05', categorias: [1], origen: 'retro', retro_id: 1, orden: -3 }),
  tarea({ id: 2, titulo: 'Reeditar apertura del VSL', detalle: 'Promesa numérica en los primeros 15s.', prioridad: 'alta', progreso: 0, categorias: [1, 2], origen: 'experimento', experimento_id: 2, orden: -2 }),
  tarea({ id: 3, titulo: 'Documentar retargeting como estándar', prioridad: 'media', progreso: 0, categorias: [2], origen: 'retro', retro_id: 1, orden: -1 }),
  tarea({ id: 4, titulo: 'Pedir a diseño 3 variantes del creativo ganador', prioridad: 'media', progreso: 45, deadline: '2026-07-02', categorias: [1], origen: 'manual', estado: 'en_curso', orden: 0 }),
  tarea({ id: 5, titulo: 'Configurar umbral de facturación en el form', detalle: 'Instant form de Meta.', prioridad: 'alta', progreso: 70, categorias: [3], origen: 'experimento', experimento_id: 1, estado: 'en_curso', orden: 1 }),
  tarea({ id: 6, titulo: 'Subir presupuesto del ganador 20%', prioridad: 'baja', progreso: 100, categorias: [1], origen: 'experimento', experimento_id: 3, estado: 'hecho', hecho_at: '2026-06-15T12:00:00Z', orden: 0 }),
];
