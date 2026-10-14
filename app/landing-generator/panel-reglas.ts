// =============================================================================
// panel-reglas — lo PURO del Panel de Landing Generator (tanda 2: T1 y T2)
// =============================================================================
// Pedido de Martín (11/10/2026, tanda 2), textual:
//   1. «Aún no se ve igual... Muchos botones a la derecha.»
//   2. «"Diagnóstico" no debería ser otra ruta, debería abrirse ahí a la derecha.»
//   3. «Elimina las tab de "Recientes, creadas por mi, publicadas y favoritas". También elimina
//      la tab de "landings", que en la sidebar aparezcan las landings creadas/analizadas con el
//      nombre de las mismas... Y también elimina el botón de "diagnostico" de la sidebar, en su
//      lugar que esté dentro de los 3 puntos que debe tener cada landing, junto a otros botones
//      como renombrar, eliminar, archivar, duplicar, etc... También elimina la funcionalidad de
//      "carpetas".»
//   4. «También agrega el botón de "Nueva landing" como placeholder en el primer puesto arriba
//      de las demás landing.»
// Decisiones T1 y T2 de docs/diseno-editor-landing.md.
//
// Vive en un módulo SIN 'use client' y sin `server-only` para que lo importen la pantalla
// (Inicio.tsx), las dos páginas (page.tsx y analizar/page.tsx: un server component no puede
// importar un VALOR de un 'use client', AGENTS.md «'use client' es una frontera de DATOS») y
// el test (tests/editor-landing-panel.test.ts).
//
// ⚠️ LAS ANALIZADAS QUE SON NUESTRAS NO SON «DE AFUERA». El Diagnóstico también analiza las
//    landings publicadas en hola-mako.site/<slug> (y las de antes de la tanda 4, en
//    hola-mako.com/l/<slug>: `bases` trae las dos, la vigente primero); listarlas dos veces (como documento y como
//    página de afuera) partiría en dos la misma landing. Se cruzan por la URL NORMALIZADA con
//    la función del Landing Analyst (lib/landing-url.ts): con otra normalización el cruce falla
//    en silencio (AGENTS.md, «dos escritores con dos ritmos son dos claves»: las dos puntas
//    derivan la clave con la MISMA función).
// =============================================================================

import type { LandingResumen } from '../../lib/editor-landing/api-tipos';
import { urlLandingEn } from '../../lib/editor-landing/origen-landings';
import { urlDeDominio } from '../../lib/editor-landing/dominios-reglas';
import { normalizarUrl } from '../../lib/landing-url';

/** Una landing de `landing_analyses` (lo que devuelve `listarAnalizadas`). */
export type Analizada = { url: string; veredicto: string | null; score: number | null };

export type TipoFila = 'landing' | 'presentacion' | 'analizada';

/** Un renglón de la barra lateral: un documento nuestro o una landing de afuera ya analizada. */
export type FilaPanel =
  | { tipo: 'landing' | 'presentacion'; clave: string; nombre: string; doc: LandingResumen }
  | { tipo: 'analizada'; clave: string; nombre: string; url: string };

/** El ícono de cada tipo (lib/editor-landing/iconos.ts): los mismos de las pastillas de crear. */
export const ICONO_FILA: Record<TipoFila, string> = { landing: 'paginas', presentacion: 'presentar', analizada: 'globo' };

export const SIN_TITULO = 'Sin título';

/** El host y la ruta de una URL, sin «www.», para nombrar una landing analizada. */
export function hostDe(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') + (u.pathname === '/' ? '' : u.pathname.replace(/\/$/, ''));
  } catch {
    return url;
  }
}

/** Para comparar textos: sin acentos, sin mayúsculas, sin espacios en los bordes. */
export const normalizarTexto = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** La URL normalizada como la del Landing Analyst, o null si no es una URL. */
function claveUrl(url: string): string | null {
  try { return normalizarUrl(url); } catch { return null; }
}

/**
 * El id de la landing NUESTRA que vive en esa URL (`<base>/<slug>` o una de sus páginas,
 * `<base>/<slug>/<ruta>`, en cualquiera de las `bases`: `https://hola-mako.site` y la de antes,
 * `https://hola-mako.com/l`, que da el server con `basesLandings`), o null si es de afuera. Sólo las
 * que tienen slug (una sin publicar no tiene URL pública).
 */
export function docDeUrl(url: string, docs: readonly LandingResumen[], bases: readonly string[]): number | null {
  const k = claveUrl(url);
  if (!k) return null;
  const es = (propia: string | null) => !!propia && (k === propia || k.startsWith(propia + '/'));
  for (const d of docs) {
    if (!d.slug) continue;
    for (const base of bases) if (es(claveUrl(urlLandingEn(base, d.slug)))) return d.id;
    // Tanda 4: su dominio propio VERIFICADO (`https://<dominio>` y sus páginas) también es ella.
    if (d.dominio && es(claveUrl(urlDeDominio(d.dominio)))) return d.id;
  }
  return null;
}

/**
 * Los renglones de la barra lateral: primero los documentos (fuera de la papelera, el editado
 * último arriba), después las landings de afuera ya analizadas (en el orden en que llegan: el
 * análisis más nuevo arriba), sin las que son nuestras y sin URLs repetidas.
 */
export function filasDelPanel(docs: readonly LandingResumen[], analizadas: readonly Analizada[], bases: readonly string[]): FilaPanel[] {
  const propias: FilaPanel[] = docs
    .filter((d) => !d.papelera)
    .sort((a, b) => b.actualizado.localeCompare(a.actualizado) || b.id - a.id)
    .map((d) => ({
      tipo: d.formato === 'presentacion' ? 'presentacion' as const : 'landing' as const,
      clave: `d:${d.id}`,
      nombre: d.titulo.trim() || SIN_TITULO,
      doc: d,
    }));
  const vistas = new Set<string>();
  const deAfuera: FilaPanel[] = [];
  for (const a of analizadas) {
    const k = claveUrl(a.url);
    if (!k || vistas.has(k) || docDeUrl(a.url, docs, bases) !== null) continue;
    vistas.add(k);
    deAfuera.push({ tipo: 'analizada', clave: `a:${k}`, nombre: hostDe(a.url), url: a.url });
  }
  return [...propias, ...deAfuera];
}

/** El «Ir a» (Ctrl K): filtra los renglones por nombre. */
export function filtrarFilas(filas: readonly FilaPanel[], q: string): FilaPanel[] {
  const n = normalizarTexto(q);
  return n ? filas.filter((f) => normalizarTexto(f.nombre).includes(n)) : [...filas];
}

/** Las landings de la Papelera (lo archivado), la última editada arriba. */
export function enPapelera(docs: readonly LandingResumen[]): LandingResumen[] {
  return docs.filter((d) => d.papelera).sort((a, b) => b.actualizado.localeCompare(a.actualizado) || b.id - a.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que se ve a la derecha, y su lugar en la URL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La derecha del Panel. Por default la caja de crear; el Diagnóstico de una landing (nuestra
 * por id, de afuera por URL, o sin ninguna: pegar una URL) se abre AHÍ, no en otra ruta (T2).
 */
export type Derecha =
  | { tipo: 'crear' }
  | { tipo: 'plantillas' }
  | { tipo: 'temas' }
  | { tipo: 'papelera' }
  | { tipo: 'diagnostico'; docId?: number; url?: string };

const VISTAS = ['plantillas', 'temas', 'papelera'] as const;
type Vista = (typeof VISTAS)[number];

/** Un id de landing de la query: entero positivo, o null. */
export function idValido(v: string | null | undefined): number | null {
  if (!v || !/^\d{1,12}$/.test(v.trim())) return null;
  const n = Number(v.trim());
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Una URL para analizar: http(s) con un host con punto (sin esquema, se asume https), o null. */
export function urlParaAnalizar(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  if (!s || s.length > 2_000) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Lo que se escribió en el «Ir a», si es la dirección de una página (sin espacios, con un dominio
 * de letras: «otra.com», «https://otra.com/oferta»): el Panel ofrece analizarla. Es la puerta para
 * «pegar una URL de afuera» (T2) sin sumar un botón a la barra.
 */
export function urlDeBusqueda(q: string): string | null {
  const s = q.trim();
  if (!s || /\s/.test(s) || !s.includes('.')) return null;
  const url = urlParaAnalizar(s);
  if (!url) return null;
  const tld = new URL(url).hostname.split('.').pop() ?? '';
  return /^[a-z]{2,}$/i.test(tld) ? url : null;
}

/**
 * La derecha que pide la URL: `?diagnostico=<id>` (una landing nuestra), `?analizar=<url>` (una de
 * afuera; vacía = el Diagnóstico sin ninguna, para pegar una) o `?vista=plantillas|temas|papelera`.
 * Una URL de afuera que resulta nuestra abre el diagnóstico de NUESTRO documento.
 */
export function derechaDeQuery(
  q: { vista?: string | null; diagnostico?: string | null; analizar?: string | null },
  docs: readonly LandingResumen[],
  bases: readonly string[],
): Derecha {
  const id = idValido(q.diagnostico);
  if (id) return { tipo: 'diagnostico', docId: id };
  if (typeof q.analizar === 'string') {
    const url = urlParaAnalizar(q.analizar);
    if (!url) return { tipo: 'diagnostico' };
    const propia = docDeUrl(url, docs, bases);
    return propia ? { tipo: 'diagnostico', docId: propia } : { tipo: 'diagnostico', url };
  }
  if (q.vista && (VISTAS as readonly string[]).includes(q.vista)) return { tipo: q.vista as Vista };
  return { tipo: 'crear' };
}

/**
 * La query de la URL para esa derecha, conservando todo lo demás (el `?ws=` de la pestaña). Se
 * escribe con `history.replaceState`, así el link que se copia abre lo que se está viendo
 * (AGENTS.md: si sólo se lee, el link que copias no es la vista que estás viendo).
 */
export function queryDeDerecha(search: string, d: Derecha): string {
  const p = new URLSearchParams(search);
  for (const k of ['vista', 'diagnostico', 'analizar']) p.delete(k);
  if (d.tipo === 'diagnostico') {
    if (d.docId) p.set('diagnostico', String(d.docId));
    else p.set('analizar', d.url ?? '');
  } else if (d.tipo !== 'crear') {
    p.set('vista', d.tipo);
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** ¿Esa derecha es el diagnóstico de ese renglón? (el renglón se marca activo). */
export function esDiagnosticoDe(d: Derecha, f: FilaPanel): boolean {
  if (d.tipo !== 'diagnostico') return false;
  if (f.tipo === 'analizada') return !!d.url && claveUrl(d.url) === claveUrl(f.url);
  return d.docId === f.doc.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// /landing-generator/analizar → el Panel con la landing en diagnóstico (T2)
// ─────────────────────────────────────────────────────────────────────────────

type Query = Record<string, string | string[] | undefined>;
const primero = (v: string | string[] | undefined): string | null => (typeof v === 'string' ? v : Array.isArray(v) ? v[0] ?? null : null);

/** La ruta del Panel. */
export const RUTA_PANEL = '/landing-generator';

/**
 * A dónde va un link a /landing-generator/analizar (el onboarding de 'landing-an', «Analizar una
 * página» de Crear, la API de MaKo, los links viejos de /landing-analyst que ya redirigen ahí):
 * al Panel con el Diagnóstico abierto a la derecha. `?diagnostico=<id>` (o `?id=`) es una landing
 * nuestra; `?url=` (o `?analizar=`) una de afuera; sin ninguna, el Diagnóstico vacío para pegar
 * una. Viaja el `?ws=` si el link lo traía; el de la pestaña lo agrega `rutaConWs` en la página.
 */
export function destinoAnalizar(sp: Query): string {
  const q = new URLSearchParams();
  const id = idValido(primero(sp.diagnostico) ?? primero(sp.id));
  if (id) q.set('diagnostico', String(id));
  else q.set('analizar', (primero(sp.url) ?? primero(sp.analizar) ?? '').trim());
  const ws = primero(sp.ws);
  if (ws) q.set('ws', ws);
  return `${RUTA_PANEL}?${q.toString()}`;
}
