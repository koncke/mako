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

export const demoRetros: Retro[] = [
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
    model: 'claude-opus-4-8',
    created_at: '2026-06-30T09:00:00Z',
  },
];

const tarea = (p: Partial<Tarea>): Tarea => ({
  id: 0, titulo: '', detalle: null, estado: 'por_hacer', prioridad: 'media', progreso: 0,
  deadline: null, categorias: [], origen: 'manual',
  experimento_id: null, retro_id: null, orden: 0, hecho_at: null,
  created_at: '2026-06-20T12:00:00Z', updated_at: '2026-06-20T12:00:00Z', ...p,
});

export const demoCategorias: Categoria[] = [
  { id: 1, nombre: 'Marketing', color: '#3b82f6', created_at: '2026-06-01T12:00:00Z' },
  { id: 2, nombre: 'Producto', color: '#46a758', created_at: '2026-06-01T12:00:00Z' },
  { id: 3, nombre: 'Ventas', color: '#f0a818', created_at: '2026-06-01T12:00:00Z' },
];

export const demoTareas: Tarea[] = [
  tarea({ id: 1, titulo: 'Revisar por qué cayó la agenda semana 3', detalle: 'Cruzar Calendly con los adsets nuevos.', prioridad: 'alta', progreso: 20, deadline: '2026-07-05', categorias: [1], origen: 'retro', retro_id: 1, orden: -3 }),
  tarea({ id: 2, titulo: 'Reeditar apertura del VSL', detalle: 'Promesa numérica en los primeros 15s.', prioridad: 'alta', progreso: 0, categorias: [1, 2], origen: 'experimento', experimento_id: 2, orden: -2 }),
  tarea({ id: 3, titulo: 'Documentar retargeting como estándar', prioridad: 'media', progreso: 0, categorias: [2], origen: 'retro', retro_id: 1, orden: -1 }),
  tarea({ id: 4, titulo: 'Pedir a diseño 3 variantes del creativo ganador', prioridad: 'media', progreso: 45, deadline: '2026-07-02', categorias: [1], origen: 'manual', estado: 'en_curso', orden: 0 }),
  tarea({ id: 5, titulo: 'Configurar umbral de facturación en el form', detalle: 'Instant form de Meta.', prioridad: 'alta', progreso: 70, categorias: [3], origen: 'experimento', experimento_id: 1, estado: 'en_curso', orden: 1 }),
  tarea({ id: 6, titulo: 'Subir presupuesto del ganador 20%', prioridad: 'baja', progreso: 100, categorias: [1], origen: 'experimento', experimento_id: 3, estado: 'hecho', hecho_at: '2026-06-15T12:00:00Z', orden: 0 }),
];
