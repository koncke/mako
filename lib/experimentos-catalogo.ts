// =============================================================================
// experimentos-catalogo — qué se puede medir en un experimento, y la propuesta saneada (módulo puro)
// =============================================================================
// Martín, 17/10/2026: «Quiero que "Experiments" la simplifiques completamente: la funcionalidad, o lo que pretendía,
// puede vivir dentro del chat de MaKo de "Dashboard"... no tengas miedo de eliminar completamente lo que está hecho y
// sólo conservar lo que pretende la tab». Lo que pretendía (lib/experimentos.ts): una HIPÓTESIS se fija en UNA métrica
// del funnel, una dirección de éxito y una ventana de días; se mide contra el dato real (antes contra ahora) y al
// terminar MaKo dicta el veredicto. Las verdades validadas vuelven al contexto de MaKo.
//
// Desde ese día se pide en «Editar con MaKo» («probemos X»): la IA de la hoja devuelve la PROPUESTA (`agregar` con
// `experimento`, lib/graficos-ia-edicion.ts), la hoja la muestra como un elemento «Experimento» y la persona lo arranca
// con un botón (app/dashboard/ElementoExperimento.tsx). Lo de este archivo es lo que esas tres puntas comparten.
//
// Puro y sin imports: lo leen el catálogo de la hoja, la IA, la pantalla, la base (lib/experimentos.ts, que le suma a
// cada métrica cómo se extrae de la ventana de marketing) y los tests.
// =============================================================================

export type FormatoMetrica = 'usd' | 'pct' | 'num';
export type DireccionExperimento = 'subir' | 'bajar';

/**
 * Las métricas medibles. ⚠️ La `key` viaja a la columna `experimentos.metrica` (mig 0047): renombrarla deja huérfano a
 * todo experimento guardado. `desc` es lo único que lee la IA para elegir.
 */
export const METRICAS_EXPERIMENTO = [
  { key: 'cpl', label: 'Costo por vista de landing', formato: 'usd', mejor: 'bajar', desc: 'spend ÷ vistas de landing' },
  { key: 'cp_form', label: 'Costo por formulario', formato: 'usd', mejor: 'bajar', desc: 'spend ÷ formularios completados' },
  { key: 'cpc', label: 'Costo por clic', formato: 'usd', mejor: 'bajar', desc: 'spend ÷ clics' },
  { key: 'cpm', label: 'CPM (costo por mil impresiones)', formato: 'usd', mejor: 'bajar', desc: 'spend ÷ impresiones × 1000' },
  { key: 'cpa', label: 'Costo por agenda', formato: 'usd', mejor: 'bajar', desc: 'spend ÷ agendas' },
  { key: 'cac', label: 'CAC (costo por cierre)', formato: 'usd', mejor: 'bajar', desc: 'spend ÷ cierres en la ventana' },
  { key: 'ctr', label: 'CTR', formato: 'pct', mejor: 'subir', desc: 'clics ÷ impresiones (%)' },
  { key: 'tasa_landing', label: 'Tasa impresión → landing', formato: 'pct', mejor: 'subir', desc: 'vistas de landing ÷ impresiones (%)' },
  { key: 'tasa_form', label: 'Tasa clic → formulario', formato: 'pct', mejor: 'subir', desc: 'formularios ÷ clics al enlace (%)' },
  { key: 'tasa_agenda', label: 'Tasa formulario → agenda', formato: 'pct', mejor: 'subir', desc: 'agendas ÷ formularios (%)' },
  { key: 'impressions', label: 'Impresiones', formato: 'num', mejor: 'subir', desc: 'impresiones servidas (Meta)' },
  { key: 'landing_page_views', label: 'Vistas de landing', formato: 'num', mejor: 'subir', desc: 'vistas de landing (Meta Pixel)' },
  { key: 'leads_count', label: 'Formularios completados', formato: 'num', mejor: 'subir', desc: 'instant forms completados (Meta)' },
  { key: 'agendamientos', label: 'Agendas', formato: 'num', mejor: 'subir', desc: 'reuniones con fecha en la ventana (leads con fecha_junta_1 en rango)' },
  { key: 'vsl_views', label: 'Vistas de VSL', formato: 'num', mejor: 'subir', desc: 'vistas del VSL (YouTube)' },
  { key: 'cierres', label: 'Cierres', formato: 'num', mejor: 'subir', desc: 'cierres por fecha de cierre en la ventana' },
  { key: 'spend_usd', label: 'Inversión', formato: 'usd', mejor: 'bajar', desc: 'gasto en Meta en la ventana' },
] as const satisfies ReadonlyArray<{ key: string; label: string; formato: FormatoMetrica; mejor: DireccionExperimento; desc: string }>;

export type KeyMetricaExperimento = (typeof METRICAS_EXPERIMENTO)[number]['key'];
export type MetricaExperimento = (typeof METRICAS_EXPERIMENTO)[number];

export const metricaExperimento = (key: unknown): MetricaExperimento | undefined =>
  METRICAS_EXPERIMENTO.find((m) => m.key === key);

/** La ventana: de 3 a 90 días (más corto es ruido; más largo, nadie lo mira). */
export const VENTANA_MIN = 3;
export const VENTANA_MAX = 90;
export const VENTANA_DEFAULT = 14;

/** Lo que MaKo propone y la persona arranca: lo mínimo para crear el experimento (`NuevoExperimento`). */
export type PropuestaExperimento = {
  titulo: string;
  hipotesis: string;
  /** Qué se cambia para probarlo (el anuncio, la landing…). */
  cambio: string;
  metrica: KeyMetricaExperimento;
  direccion: DireccionExperimento;
  ventana_dias: number;
  /** Qué tiene que pasar para darla por buena, en una frase. */
  criterio_exito: string;
  objetivo_valor: number | null;
};

const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/**
 * Lo que llega de la IA o del navegador, saneado. `null` = no sirve (sin hipótesis o con una métrica que no existe): no
 * se adivina una métrica, porque el experimento mediría otra cosa que la que se pidió.
 */
export function sanearPropuesta(raw: unknown): PropuestaExperimento | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const m = metricaExperimento(o.metrica);
  const hipotesis = txt(o.hipotesis, 400);
  if (!m || !hipotesis) return null;
  const v = Math.round(Number(o.ventana_dias));
  const objetivo = Number(o.objetivo_valor);
  return {
    titulo: txt(o.titulo, 80) || hipotesis.slice(0, 80),
    hipotesis,
    cambio: txt(o.cambio, 300),
    metrica: m.key,
    direccion: o.direccion === 'subir' || o.direccion === 'bajar' ? o.direccion : m.mejor,
    ventana_dias: Number.isFinite(v) ? Math.max(VENTANA_MIN, Math.min(VENTANA_MAX, v)) : VENTANA_DEFAULT,
    criterio_exito: txt(o.criterio_exito ?? o.criterio, 200),
    objetivo_valor: o.objetivo_valor != null && Number.isFinite(objetivo) ? objetivo : null,
  };
}

/** El catálogo como lo lee la IA de la hoja (una línea por métrica). */
export const metricasExperimentoParaIA = (): string =>
  METRICAS_EXPERIMENTO.map((m) => `${m.key} — ${m.label} (${m.desc}; mejora natural: ${m.mejor})`).join('\n');

/** Cómo se lee la dirección: «que baje», «que suba». */
export const textoDireccion = (d: DireccionExperimento): string => (d === 'bajar' ? 'que baje' : 'que suba');

// ── La ruta vieja (/experimentos se retiró el 17/10/2026) ──────────────────────────────────────────────────────────

type Query = Record<string, string | string[] | undefined>;
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** El texto de `?probar=` (o de la `hipotesis` de un link viejo): limpio y corto. Vacío = nada que probar. */
export const textoProbar = (v: string | string[] | undefined): string => {
  const t = uno(v);
  return typeof t === 'string' ? t.replace(/\s+/g, ' ').trim().slice(0, 400) : '';
};

/**
 * Adónde aterriza un link de /experimentos: al Dashboard. Si traía una hipótesis (el «Probarlo» de Offer, que la mandaba
 * como `?hipotesis=`), con `?probar=`, que abre «Editar con MaKo» con el pedido escrito. Lo demás de la query (la tab
 * vieja, el rango) ya no tiene a dónde ir: se cae.
 */
export function destinoDeExperimentos(q: Query): string {
  const t = textoProbar(q.probar ?? q.hipotesis);
  return t ? `/dashboard?probar=${encodeURIComponent(t)}` : '/dashboard';
}

/**
 * «Probarlo» (Offer, en escritorio y en el teléfono): una hipótesis se prueba en el Dashboard, con «Editar con MaKo» abierto
 * y el pedido escrito. El ÚNICO armador de ese link: si mañana cambia el lugar, cambia acá.
 */
export const hrefProbar = (hipotesis: string): string => `/dashboard?probar=${encodeURIComponent(textoProbar(hipotesis))}`;

/** Lo que «Editar con MaKo» trae escrito cuando llega una hipótesis: el pedido que la IA entiende como experimento. */
export const pedidoDeProbar = (t: string): string => (t ? `Probemos: ${t}` : '');
