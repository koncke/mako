// =============================================================================
// La identidad de una landing para Landing Analyst: host sin www + ruta, sin query
// =============================================================================
// Vivía adentro de lib/landing-fetch.ts, que lleva `server-only` e importa
// `node:dns` (la baranda SSRF): con eso, ningún test podía ejecutar la
// normalización, y el análisis automático (06/10/2026) la necesita para cruzar las
// páginas DECLARADAS en el Pixel contra las ya analizadas. landing-fetch la
// re-exporta: sigue habiendo UNA.
//
// ⚠️ NO ES LA MISMA que `normalizarUrl` de lib/landing-paginas.ts (la del Pixel),
// que conserva el www, el protocolo y el query que no reconoce. Cruzar una con
// otra sin pasar las dos por ÉSTA muestra como «nunca analizada» una página que se
// analiza todos los días.
// =============================================================================

import { urlLandingVigente } from './editor-landing/dominios-reglas';

/**
 * Normaliza la URL de una landing a la entidad que se analiza.
 *
 * SE TIRA EL QUERYSTRING ENTERO, no una lista de params conocidos. Se intentó lo
 * segundo y no alcanza: medido contra producción (5/8/2026), el workspace de un
 * cliente tenía **24 "landings" distintas que en realidad eran 2 páginas** — el
 * parámetro de compartir de Facebook (`?sfnsn=`) y el de preview de Lovable
 * (`__lovable_load_id`, distinto EN CADA CARGA) fabricaban una entidad nueva por
 * visita. Una lista de bloqueo siempre va un tracker atrás; la lista de permitidos
 * correcta para una landing es "ninguno".
 *
 * El precio: un sitio que sirva contenido DISTINTO según el query (`?v=b` de un
 * A/B, page builders viejos que rutean por query) colapsa a una sola entidad. Es
 * el intercambio consciente hasta que exista el soporte de A/B y multi-landing,
 * que hoy es una tarea a futuro del plan.
 */
export function normalizarUrl(input: string): string {
  const bruto = input.trim();
  const conEsquema = /^https?:\/\//i.test(bruto) ? bruto : `https://${bruto}`;
  const u = new URL(conEsquema);
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  u.hash = '';
  u.search = '';
  if (u.pathname !== '/' && u.pathname.endsWith('/')) u.pathname = u.pathname.replace(/\/+$/, '');
  if (u.port === '80' || u.port === '443') u.port = '';
  return u.toString().replace(/\/$/, '');
}

/**
 * Las visitas de UNA landing (`url`, ya normalizada con `normalizarUrl`) entre las del workspace, y si
 * su gente entró también a OTRA landing (`compartidos`: la profundidad del VSL se atribuye por
 * visitante y hay que decir que es ambigua). Lo usa `getComportamiento` (lib/landing-analyst.ts, el
 * Diagnóstico); vive acá, sin `server-only`, para que un test lo EJECUTE.
 *
 * ⚠️ LA MISMA LANDING CON DOS DIRECCIONES (integración de la tanda 4, 14/10/2026): una landing del
 * editor analizada o medida antes de la mudanza dice `hola-mako.com/l/<slug>`, y el Pixel manda desde
 * entonces `hola-mako.site/<slug>`. Se compara con la dirección de HOY en las dos puntas
 * (`urlLandingVigente`): sin eso el Diagnóstico decía «sin datos» (y la IA analizaba creyendo que nadie
 * la vio), y las dos bases contaban como OTRA landing en `compartidos`. Todo sin un error.
 */
export function visitasDeLaLanding<V extends { visitor_id: string; landing_url: string | null }>(visitas: readonly V[], url: string): { mias: V[]; compartidos: boolean } {
  // La URL guardada por el beacon trae utm/fbclid: se compara NORMALIZADA contra
  // la que se analizó. Sin esto el mismo aterrizaje con y sin utm no cruza.
  const norm = (u: string | null): string | null => { if (!u) return null; try { return normalizarUrl(u); } catch { return null; } };
  const clave = urlLandingVigente(url);
  const mias = visitas.filter((v) => { const u = norm(v.landing_url); return u !== null && urlLandingVigente(u) === clave; });
  const visitantes = new Set(mias.map((v) => v.visitor_id).filter(Boolean));
  const compartidos = visitas.some((v) => {
    const u = norm(v.landing_url);
    return u !== null && urlLandingVigente(u) !== clave && visitantes.has(v.visitor_id);
  });
  return { mias, compartidos };
}

/** Cuánto se espera a un análisis que quedó en `pendiente` antes de darlo por cortado. */
export const MINUTOS_CORTE_ANALISIS = 15;

/**
 * Las páginas declaradas que todavía NO tienen fila en Landing Analyst.
 *
 * Es un CÁLCULO y no un disparo «cuando se agrega una página»: así cubre todos los
 * caminos que agregan una (la pantalla del Pixel, la API de MaKo, el formato viejo,
 * un setting editado a mano) sin que ninguno tenga que acordarse de avisar. Una
 * página que ya tiene fila —analizada, en error o pendiente— NO vuelve: volver a
 * analizar es una decisión de la persona, y una página que no se puede leer sola
 * pediría pegar el texto en cada guardado.
 */
export function faltanAnalizar(declaradas: string[], existentes: string[]): string[] {
  const ya = new Set<string>();
  for (const e of existentes) { try { ya.add(normalizarUrl(e)); } catch { /* una fila rota no tapa nada */ } }
  const out: string[] = [];
  for (const d of declaradas) {
    let u: string;
    try { u = normalizarUrl(d); } catch { continue; }
    if (ya.has(u) || out.includes(u)) continue;
    out.push(u);
  }
  return out;
}

/** ¿Un `pendiente` lleva tanto que el trabajo de fondo murió? */
export function analisisCortado(estado: string | null | undefined, actualizado: string | null | undefined, ahora: number): boolean {
  if (estado !== 'pendiente' || !actualizado) return false;
  const t = Date.parse(actualizado);
  return Number.isFinite(t) && ahora - t > MINUTOS_CORTE_ANALISIS * 60_000;
}

/**
 * La MISMA URL que pegó la persona, lista para bajar: se le pone el esquema si falta y se le saca el
 * hash (que no viaja al server). **Conserva el `www.` y el querystring entero.**
 *
 * Es la contracara de `normalizarUrl`, y la diferencia no es un detalle: aquélla responde «¿qué LANDING
 * es ésta?» —y para eso el query sobra, porque `?sfnsn=` y `__lovable_load_id` fabricaban una entidad
 * nueva por visita—, y ésta responde «¿qué PÁGINA quiere que lea?». Un `?page_id=245` de un WordPress
 * sin permalinks no es ruido de medición: ES la página. Normalizada, baja la home — otra oferta — y la
 * IA anota piezas de ahí sin que nada avise, que es el peor desenlace posible.
 *
 * Lo usa `extraerLanding(url, { talCual: true })` desde Offer, donde el dueño pega el link de SU página.
 * No se usa para la identidad de una landing: eso sigue siendo `normalizarUrl`, y mezclarlas haría
 * aparecer la misma página como veinticuatro.
 */
export function urlTalCual(input: string): string {
  const bruto = input.trim();
  const u = new URL(/^https?:\/\//i.test(bruto) ? bruto : `https://${bruto}`);
  u.hostname = u.hostname.toLowerCase();
  u.hash = '';
  return u.toString();
}
