// =============================================================================
// La identidad de una landing para Landing Analyst: host sin www + ruta, sin query
// =============================================================================
// Vivía adentro de lib/landing-fetch.ts, que lleva `server-only` e importa
// `node:dns` (la baranda SSRF): con eso, ningún test podía ejecutar la
// normalización, y el análisis automático (06/10/2026) la necesita para cruzar las
// páginas DECLARADAS en el Pixel contra las ya analizadas. landing-fetch la
// re-exporta: sigue habiendo UNA.
//
// ⚠️ SE LLAMABA `normalizarUrl`, COMO LA DEL PIXEL (lib/landing-paginas.ts), y no es la misma: aquélla
// conserva el www, el protocolo y el query que no es de medición, y funde los deploys de Netlify. Dos
// funciones con un nombre y contratos opuestos se importaban una por otra sin que nada avisara (el
// runner de la API tenía que renombrarlas al importarlas). Desde el 15/10/2026 hay UNA `normalizarUrl`
// (la del Pixel) y ésta es `claveDeLanding`: contesta OTRA pregunta, «¿qué LANDING analizada es ésta?»,
// y su resultado es la llave de `landing_analyses.url`. No puede llamar a la otra: la del Pixel ya
// fundió el host del deploy y soltó las credenciales, y derivar ésta de aquélla cambiaría la llave de
// filas guardadas (tests/landing-url-unica.test.ts las fija contra las implementaciones de antes).
//
// ⚠️ ES UNA LLAVE, NO UNA DIRECCIÓN. Sin la barra final, sin el www y sin el query, hay hosts que
// contestan 403 o no existen: para BAJAR la página va `urlTalCual` (abajo), con lo que pegó la persona.
// =============================================================================

import { urlLandingVigente } from './editor-landing/dominios-reglas';

/**
 * La LLAVE de una landing en el Landing Analyst (`landing_analyses.url`): la entidad que se analiza.
 * Tira si no es una URL (el que llama decide; ver la cabecera para por qué no es `normalizarUrl`).
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
export function claveDeLanding(input: string): string {
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
 * Las visitas de UNA landing (`url`, ya normalizada con `claveDeLanding`) entre las del workspace, y si
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
  const norm = (u: string | null): string | null => { if (!u) return null; try { return claveDeLanding(u); } catch { return null; } };
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
 * página que ya tiene fila —analizada, en error o pendiente— NO entra acá: una
 * analizada no se repite sola, y la que quedó en error la reintenta, espaciada,
 * `erroresParaReintentar`.
 *
 * `quitadas` (17/10/2026): las que la persona QUITÓ de Landing Analyst (`QUITADAS_KEY`). Quitar borraba la fila y,
 * como la página seguía declarada en el Pixel, el cron de cada hora la volvía a analizar (y a pagar la IA): «quitar»
 * no duraba. Ahora quitar es «no la analices sola»; analizarla a mano la devuelve.
 */
export function faltanAnalizar(declaradas: string[], existentes: string[], quitadas: readonly string[] = []): string[] {
  const ya = new Set<string>();
  for (const e of [...existentes, ...quitadas]) { try { ya.add(claveDeLanding(e)); } catch { /* una fila rota no tapa nada */ } }
  const out: string[] = [];
  for (const d of declaradas) {
    let u: string;
    try { u = claveDeLanding(d); } catch { continue; }
    if (ya.has(u) || out.includes(u)) continue;
    out.push(u);
  }
  return out;
}

/**
 * Cada cuánto se reintenta SOLA una página declarada cuyo análisis quedó en error, y cuántas por corrida (el cron es
 * horario y recorre todos los negocios).
 *
 * El caso (docs/relevo/pixel-clarity-landing.md §2 y §4.4): la portada del ws1 quedó en `error` el 20/09 y la de
 * Leila (ws11) el 06/10 —«Expected double-quoted property name in JSON», una respuesta del modelo mal cerrada—, y
 * nada las volvía a mirar: el análisis automático sólo toma las declaradas SIN fila, y una fila en error es una fila.
 * La de Leila seguía así el 17/10. Decisión (17/10/2026, con criterio, entre las tres que dejó el relevo): reintento
 * automático CON TOPE. Una vez por día por página: una página que no se puede bajar (403, armada en el navegador)
 * falla antes de la IA y no cuesta nada; una que sí se baja paga a lo sumo un análisis por día con la cascada
 * gratis del negocio. El botón «Reintentar» de la pantalla sigue para no esperar.
 */
export const HORAS_REINTENTO_ERROR = 24;
export const REINTENTOS_POR_CORRIDA = 2;

/** Las declaradas en error hace más de `HORAS_REINTENTO_ERROR`, la más vieja primero, con tope por corrida. */
export function erroresParaReintentar<F extends { url: string; status: string | null; updated_at: string | null }>(
  declaradas: readonly string[], filas: readonly F[], ahora: number, quitadas: readonly string[] = [],
): F[] {
  const clave = (u: string): string | null => { try { return claveDeLanding(u); } catch { return null; } };
  const fuera = new Set(quitadas.map(clave).filter((x): x is string => x !== null));
  const decl = new Set(declaradas.map(clave).filter((x): x is string => x !== null && !fuera.has(x)));
  return filas
    .filter((f) => {
      if (f.status !== 'error' || !f.updated_at) return false;
      const k = clave(f.url);
      const t = Date.parse(f.updated_at);
      return k !== null && decl.has(k) && Number.isFinite(t) && ahora - t >= HORAS_REINTENTO_ERROR * 3_600_000;
    })
    .sort((a, b) => (a.updated_at ?? '').localeCompare(b.updated_at ?? ''))
    .slice(0, REINTENTOS_POR_CORRIDA);
}

/** Las páginas que la persona quitó de Landing Analyst (`app_settings`, por negocio): no se analizan solas. */
export const QUITADAS_KEY = 'landing_analyst.quitadas';

/** La lista guardada, saneada: llaves de `claveDeLanding`, sin repetir. Un valor roto es una lista vacía. */
export function leerQuitadas(raw: string | null | undefined): string[] {
  let v: unknown;
  try { v = JSON.parse(raw ?? '[]'); } catch { return []; }
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== 'string') continue;
    try { const k = claveDeLanding(x); if (!out.includes(k)) out.push(k); } catch { /* se ignora */ }
  }
  return out;
}

/** La lista con `url` adentro (quitar) o afuera (analizarla a mano la devuelve), como se guarda. */
export function conQuitada(raw: string | null | undefined, url: string, quitada: boolean): string {
  const k = claveDeLanding(url);
  const lista = leerQuitadas(raw).filter((x) => x !== k);
  return JSON.stringify(quitada ? [...lista, k] : lista);
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
 * Es la contracara de `claveDeLanding`, y la diferencia no es un detalle: aquélla responde «¿qué LANDING
 * es ésta?» —y para eso el query sobra, porque `?sfnsn=` y `__lovable_load_id` fabricaban una entidad
 * nueva por visita—, y ésta responde «¿qué PÁGINA quiere que lea?». Un `?page_id=245` de un WordPress
 * sin permalinks no es ruido de medición: ES la página. Normalizada, baja la home — otra oferta — y la
 * IA anota piezas de ahí sin que nada avise, que es el peor desenlace posible.
 *
 * Lo usa `extraerLanding(url, { talCual: true })` desde Offer, donde el dueño pega el link de SU página.
 * No se usa para la identidad de una landing: eso sigue siendo `claveDeLanding`, y mezclarlas haría
 * aparecer la misma página como veinticuatro.
 */
export function urlTalCual(input: string): string {
  const bruto = input.trim();
  const u = new URL(/^https?:\/\//i.test(bruto) ? bruto : `https://${bruto}`);
  u.hostname = u.hostname.toLowerCase();
  u.hash = '';
  return u.toString();
}

/**
 * La dirección real para BAJAR una landing analizada: `url_final` si su llave es la de la fila; si no, null (y se
 * baja la llave). La llave (`claveDeLanding`: sin barra final, sin www, sin query) sirve para buscar la fila, no
 * para pedir la página: hay sitios que contestan 403 a la llave y 200 a la dirección real (15/10/2026).
 */
export function direccionParaBajar(llave: string, urlFinal: string | null | undefined): string | null {
  if (!urlFinal) return null;
  try { return claveDeLanding(urlFinal) === llave ? urlFinal : null; } catch { return null; }
}
