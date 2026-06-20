// =============================================================================
// chart-registry — nombres legibles de los gráficos para la tab "Preguntale a MaKo"
// =============================================================================
// chart_key → etiqueta. Se usa para listar los chats por gráfico. Módulo puro.

export const CHART_LABELS: Record<string, string> = {
  'mako-general': 'Chat general',
  'comercial-revenue-mensual': 'Tendencia · Comercial',
  'comercial-funnel': 'Salud del Funnel · Comercial',
  'comercial-scl': 'SCL · Comercial',
  'marketing-tendencias': 'Tendencias · Marketing',
  'marketing-audiencia': 'Audiencia y alcance · Marketing',
  'marketing-funnel': 'Salud del Funnel · Marketing',
};

export const chartLabel = (k: string): string => CHART_LABELS[k] ?? k;
