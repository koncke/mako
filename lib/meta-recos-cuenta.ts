// =============================================================================
// meta-recos-cuenta — parser del edge act_<id>/recommendations
// =============================================================================
// El edge de CUENTA y el campo `recommendations` de una campaña/conjunto/anuncio
// se llaman igual y NO devuelven la misma forma. Confundirlos fue el bug del
// modal "Analizar (Meta)": leía `title` / `message` / `importance` (la forma de
// NODO) sobre la respuesta del edge de CUENTA, que viene anidada y con otras
// claves. Con la cuenta del dueño (act_5640…, medida el 2026-09-08) Meta devolvía
// 5 recomendaciones reales y un opportunity_score de 81, y la pantalla mostraba
// una tarjeta vacía titulada "Recomendación de Meta".
//
// Forma REAL del edge de cuenta, verificada contra la Graph API v25.0:
//   { "data": [ { "recommendations": [ {
//       "object_ids": ["1202470…", …],
//       "recommendation_content": {
//         "lift_estimate": "Costo por compra 14% más bajo",
//         "body": "Configurar eventos de compra con el píxel ayuda a…",
//         "opportunity_score_lift": "8"
//       },
//       "type": "PIXEL_OPTIMIZATION_HIE",
//       "recommendation_stage": "pre_create_guidance",
//       "recommendation_time": "2026-08-31T09:26:14+0000",
//       "url": "https://adsmanager.facebook.com/…"
//   } ] } ] }
//
// O sea: un array de UN elemento que a su vez tiene el array bueno adentro. Sin
// título, sin `importance` y sin `message` — el texto vive en
// `recommendation_content.body` y la prioridad hay que derivarla del lift.
// =============================================================================

export type RecoCuenta = {
  /** Título legible: lo arma el tipo, porque Meta no manda ninguno. */
  titulo: string;
  detalle: string;
  /** "Costo por compra 14% más bajo" — el gancho, tal cual lo escribe Meta. */
  lift: string | null;
  importancia: 'ALTA' | 'MEDIA' | 'BAJA';
  /** Cuántas entidades toca la recomendación (object_ids). */
  entidades: number;
  /** Link directo al Ads Manager donde se aplica. */
  url: string | null;
  tipo: string | null;
};

// Meta no manda título: manda un `type` en SCREAMING_SNAKE. Los que ya vimos en
// vivo van traducidos; el resto cae a un legible genérico (nunca al enum crudo,
// que sobre una pantalla de cliente no dice nada).
const TITULO_POR_TIPO: Record<string, string> = {
  PIXEL_OPTIMIZATION_HIE: 'Optimiza con eventos del píxel',
  CREATIVE_DIVERSIFICATION: 'Combina imagen y video en el mismo conjunto',
  ADVANTAGE_PLUS_AUDIENCE: 'Activa el público Advantage+',
  ADVANTAGE_PLUS_PLACEMENTS: 'Deja las ubicaciones automáticas',
  ADVANTAGE_CAMPAIGN_BUDGET: 'Deja que Meta reparta el presupuesto',
  AUDIENCE_EXPANSION: 'Amplía el público',
  BUDGET_INCREASE: 'Sube el presupuesto',
  BID_STRATEGY: 'Revisa la estrategia de puja',
  FRAGMENTATION: 'Junta conjuntos que compiten entre sí',
  MULTI_ADVERTISER_ADS: 'Activa los anuncios multi-anunciante',
};

function tituloDe(tipo: string): string {
  if (TITULO_POR_TIPO[tipo]) return TITULO_POR_TIPO[tipo];
  if (!tipo) return 'Recomendación de Meta';
  // ADVANTAGE_PLUS_X → "Advantage plus x": legible, y deja ver el tipo real si
  // aparece uno nuevo (mejor que esconderlo bajo un genérico para siempre).
  const t = tipo.toLowerCase().replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * `opportunity_score_lift` es cuántos puntos de Opportunity Score suma aplicarla
 * (string, no número). Es lo más parecido a una prioridad que da este edge: el
 * campo `importance` de las recomendaciones de NODO no existe acá.
 */
function importanciaDe(lift: number | null): RecoCuenta['importancia'] {
  if (lift == null) return 'MEDIA';
  if (lift >= 8) return 'ALTA';
  if (lift >= 4) return 'MEDIA';
  return 'BAJA';
}

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** `body` del edge (la respuesta entera), no `body.data`. Falla suave → []. */
export function parseRecosCuenta(body: unknown): RecoCuenta[] {
  const raiz = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const grupos = Array.isArray(raiz.data) ? raiz.data : [];
  const out: RecoCuenta[] = [];
  for (const g of grupos) {
    const grupo = (g && typeof g === 'object' ? g : {}) as Record<string, unknown>;
    // Un grupo sin `recommendations` no se descarta: puede ser la forma de NODO
    // colada por acá (title/message). Se acepta también, para no perder datos.
    const items = Array.isArray(grupo.recommendations) ? grupo.recommendations : [grupo];
    for (const it of items) {
      const o = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>;
      const c = (o.recommendation_content && typeof o.recommendation_content === 'object'
        ? o.recommendation_content
        : {}) as Record<string, unknown>;
      const detalle = texto(c.body) || texto(o.message);
      const lift = texto(c.lift_estimate) || null;
      if (!detalle && !lift) continue; // fila sin nada que mostrar
      const puntos = Number(c.opportunity_score_lift);
      const tipo = texto(o.type) || null;
      out.push({
        titulo: texto(o.title) || tituloDe(texto(o.type)),
        detalle,
        lift,
        importancia: importanciaDe(Number.isFinite(puntos) ? puntos : null),
        entidades: Array.isArray(o.object_ids) ? o.object_ids.length : 0,
        url: texto(o.url) || null,
        tipo,
      });
    }
  }
  const orden: Record<RecoCuenta['importancia'], number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };
  return out.sort((a, b) => orden[a.importancia] - orden[b.importancia]);
}
