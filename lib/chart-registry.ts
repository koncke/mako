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

export const chartLabel = (k: string): string => {
  if (CHART_LABELS[k]) return CHART_LABELS[k];
  if (k.startsWith('marketing-ad-')) return 'Anuncio · Marketing';
  return k;
};
