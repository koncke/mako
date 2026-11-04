// =============================================================================
// spy-funnel-tipo — qué funnel usa un competidor, con la EVIDENCIA citada de sus piezas (4/11/2026)
// =============================================================================
// Martín, con Den Borg: «Quiero que se analice qué funnel utiliza... que se haga una buena research, porque denborg es obvio que hace
// funnel de eventos presenciales». El Cerebro: «Debe reconocer el evento presencial de Den Borg con evidencia de sus piezas, no por
// adivinanza».
//
// Las señales SALEN DEL CATÁLOGO (docs/catalogo-funnels-y-formatos.md → lib/spy-catalogo-datos.ts, generado). La regla es la del
// catálogo, §1:
//   · una frase FUERTE alcanza; las DÉBILES necesitan 2 distintas, de 2 piezas distintas;
//   · una frase que DESCARTA en la misma pieza baja las fuertes de esa pieza a débiles («masterclass» + «por zoom» no es presencial),
//     salvo que la pieza diga que es híbrido (y sus palabras sueltas no cuentan);
//   · un HOST (eventbrite., calendly.com, pay.hotmart.com…) en un enlace suyo es fuerte;
//   · sin evidencia, «no sé»: nunca se adivina.
// Se compara sin tildes ni mayúsculas, con límites de palabra Unicode (`\b` de JavaScript es ASCII: AGENTS.md).
// Cada funnel que pasa trae sus citas: la frase, el pedazo del texto donde aparece y de qué pieza salió.
//
// Sin `server-only` y sin IA: corre en el navegador sobre las piezas que ya están en pantalla.
// =============================================================================

import { FUNNELS_DEL_CATALOGO } from './spy-catalogo-datos';
import type { EntradaCatalogo } from './spy-catalogo-leer';

/** De dónde sale un texto: una página de su web, su bio, una publicación, un video o un anuncio. */
export type FuenteDeEvidencia = {
  donde: 'web' | 'bio' | 'publicacion' | 'video' | 'anuncio';
  /** Cómo se nombra en pantalla: «Su web», «Reel del 3 nov», «Un anuncio». */
  etiqueta: string;
  texto: string;
  /** Sus enlaces (la página, adonde manda un anuncio): los hosts del catálogo se miran acá y en el texto. */
  urls?: readonly string[];
  piezaId?: number | null;
};

export type Evidencia = {
  frase: string; cita: string; etiqueta: string; donde: FuenteDeEvidencia['donde']; piezaId: number | null; fuerte: boolean;
  /** La página de donde sale (una de su web): tocarla la elige en «Sus páginas». */
  url: string | null;
};
export type FunnelDetectado = { id: string; label: string; que: string | null; puntos: number; fuertes: number; evidencias: Evidencia[] };
export type LecturaDeFunnel = { principal: FunnelDetectado | null; otros: FunnelDetectado[] };

/** Cuántas citas se muestran de cada funnel. */
export const CITAS_POR_FUNNEL = 3;

// ── Normalizar sin perder dónde estaba cada letra (para citar el texto original) ──────────────────────────────────────

function normalizarConMapa(t: string): { n: string; mapa: number[] } {
  let n = '';
  const mapa: number[] = [];
  let i = 0;
  for (const ch of t) {
    const d = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    for (const c of d) { n += c; mapa.push(i); }
    i += ch.length;
  }
  return { n, mapa };
}
const normal = (t: string): string => normalizarConMapa(t).n;
/** El texto como se compara: sin tildes y en minúsculas. Con `regexDeFrase`, lo usa también la lectura de formatos (lib/spy-detalle.ts). */
export const textoComparable = normal;
const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Compiladas UNA vez por frase: el catálogo tiene cientos y un competidor, cientos de piezas.
const REGEX_DE = new Map<string, RegExp>();
export function regexDeFrase(frase: string): RegExp {
  let r = REGEX_DE.get(frase);
  if (!r) {
    r = new RegExp(`(?<![\\p{L}\\p{N}])${escapar(normal(frase)).replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}])`, 'u');
    REGEX_DE.set(frase, r);
  }
  return r;
}

/** El pedazo del texto original alrededor de [a, b): unas palabras antes y después, con «…» si se corta. */
function citaDe(original: string, mapa: number[], a: number, b: number): string {
  const ini = mapa[a] ?? 0;
  const fin = (mapa[b - 1] ?? original.length - 1) + 1;
  const desde = Math.max(0, ini - 50);
  const hasta = Math.min(original.length, fin + 60);
  let s = original.slice(desde, hasta).replace(/\s+/g, ' ').trim();
  if (desde > 0) s = `…${s.replace(/^\S*\s/, '')}`;
  if (hasta < original.length) s = `${s.replace(/\s\S*$/, '')}…`;
  return s;
}

// ── Los hosts ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** «eventbrite.com.mx/e/x» de una URL o de un pedazo de texto que parece una («eventbrite.com/e/x»). */
function sinProtocolo(u: string): string {
  return u.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').replace(/[)\].,;!?»"']+$/, '');
}
/** Las direcciones que aparecen en un texto, con o sin https. */
const URLS_EN_TEXTO = /(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/gi;

/** ¿La dirección cae en el host del catálogo? «eventbrite.» cubre todos sus países; «zoom.us/webinar/register», un camino. */
export function hostCoincide(direccion: string, patron: string): boolean {
  const d = sinProtocolo(direccion);
  const p = patron.toLowerCase();
  const host = d.split('/')[0];
  if (p.endsWith('.')) return host.startsWith(p) || host.includes(`.${p}`);
  if (p.includes('/')) return d.startsWith(p) || d.includes(`.${p}`);
  return host === p || host.endsWith(`.${p}`);
}

// ── Las compuestas que el código arma (la del evento presencial, que es la que decide el caso de Den Borg) ─────────────

const MESES = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december';
const FECHA = new RegExp(`(?<![\\p{L}\\p{N}])(?:\\d{1,2}\\s+de\\s+(?:${MESES})|(?:${MESES})\\s+\\d{1,2}|\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?)(?![\\p{L}\\p{N}])`, 'u');
const VENTA = /(?<![\p{L}\p{N}])(?:entradas|boletos|tickets|preventa|vip)(?![\p{L}\p{N}])/u;

function compuestas(e: EntradaCatalogo, n: string): string | null {
  if (e.id === 'evento-presencial' && FECHA.test(n) && VENTA.test(n)) return 'fecha + entradas';
  return null;
}

// ── Clasificar ──────────────────────────────────────────────────────────────────────────────────────────────────────

type Hallazgo = { frase: string; fuerte: boolean; fuente: number; a: number; b: number; descartada?: boolean };

function hallazgosDe(e: EntradaCatalogo, fuentes: readonly FuenteDeEvidencia[], normales: ReadonlyArray<{ n: string; mapa: number[] }>): Hallazgo[] {
  const out: Hallazgo[] = [];
  fuentes.forEach((f, i) => {
    const { n } = normales[i];
    const hibrido = (e.nota_hibrido ?? []).some((x) => regexDeFrase(x).test(n));
    const descartada = !hibrido && (e.descarta ?? []).some((x) => regexDeFrase(x).test(n));
    for (const frase of e.fuertes ?? []) {
      const m = regexDeFrase(frase).exec(n);
      if (m) out.push({ frase, fuerte: !descartada, fuente: i, a: m.index, b: m.index + m[0].length, descartada });
    }
    // Una pieza que se descarta («por Zoom») sólo aporta sus fuertes, bajadas a débiles: sus palabras sueltas («evento», «entradas»)
    // hablan de otra cosa.
    for (const frase of descartada ? [] : e.debiles ?? []) {
      const m = regexDeFrase(frase).exec(n);
      if (m) out.push({ frase, fuerte: false, fuente: i, a: m.index, b: m.index + m[0].length });
    }
    const comp = compuestas(e, n);
    if (comp) {
      const m = FECHA.exec(n);
      if (m) out.push({ frase: comp, fuerte: !descartada, fuente: i, a: m.index, b: m.index + m[0].length, descartada });
    }
    const direcciones = [...(f.urls ?? []), ...(f.texto.match(URLS_EN_TEXTO) ?? [])];
    for (const host of e.hosts ?? []) {
      const d = direcciones.find((u) => hostCoincide(u, host));
      if (!d) continue;
      const en = n.indexOf(sinProtocolo(d).slice(0, 40));
      out.push({ frase: host.replace(/\.$/, ''), fuerte: !descartada, fuente: i, a: Math.max(0, en), b: Math.max(0, en) + (en >= 0 ? sinProtocolo(d).slice(0, 40).length : 0), descartada });
    }
  });
  return out;
}

/**
 * Qué funnel usa, con su evidencia. `principal` es el de más puntos (una fuerte vale 3, cada débil distinta 1, y uno más si las
 * débiles salen de 2 piezas o más); `otros`, los que también pasan CON una fuerte (una débil suelta no es «también usa»).
 */
export function clasificarFunnel(fuentes: readonly FuenteDeEvidencia[], catalogo: readonly EntradaCatalogo[] = FUNNELS_DEL_CATALOGO): LecturaDeFunnel {
  const utiles = fuentes.filter((f) => f.texto.trim() || f.urls?.length);
  const normales = utiles.map((f) => normalizarConMapa(f.texto));
  const pasan: FunnelDetectado[] = [];
  for (const e of catalogo) {
    const h = hallazgosDe(e, utiles, normales);
    const fuertes = new Set(h.filter((x) => x.fuerte).map((x) => x.frase));
    const debiles = new Set(h.filter((x) => !x.fuerte).map((x) => x.frase));
    // Una pieza descartada cita, pero no cuenta como «otra pieza» que lo confirma.
    const piezasDebiles = new Set(h.filter((x) => !x.fuerte && !x.descartada).map((x) => x.fuente));
    // Sin una fuerte, hacen falta 2 débiles distintas DE 2 PIEZAS distintas (catálogo, §1): un post que dice «conferencia» y
    // «speakers» puede ser la de otro.
    if (!fuertes.size && (debiles.size < 2 || piezasDebiles.size < 2)) continue;
    // Las citas: primero las fuertes, y una por pieza antes de repetir pieza (tres piezas distintas convencen más que una).
    const orden = [...h].sort((a, b) => Number(b.fuerte) - Number(a.fuerte));
    const tomadas = new Set<string>();
    const conCita = new Set<number>();
    const evidencias: Evidencia[] = [];
    const tomar = (x: Hallazgo) => {
      const k = `${x.fuente}|${x.frase}`;
      if (evidencias.length >= CITAS_POR_FUNNEL || tomadas.has(k)) return;
      const f = utiles[x.fuente];
      tomadas.add(k);
      conCita.add(x.fuente);
      evidencias.push({
        frase: x.frase, cita: f.texto.trim() ? citaDe(f.texto, normales[x.fuente].mapa, x.a, x.b) : (f.urls?.[0] ?? ''),
        etiqueta: f.etiqueta, donde: f.donde, piezaId: f.piezaId ?? null, fuerte: x.fuerte, url: f.urls?.[0] ?? null,
      });
    };
    for (const x of orden) if (!conCita.has(x.fuente)) tomar(x);
    for (const x of orden) tomar(x);
    pasan.push({ id: e.id, label: e.label, que: e.que ?? null, puntos: fuertes.size * 3 + debiles.size + (piezasDebiles.size > 1 ? 1 : 0), fuertes: fuertes.size, evidencias });
  }
  // A igual puntos, el orden del catálogo (que pone primero lo más específico).
  pasan.sort((a, b) => b.puntos - a.puntos);
  const [principal = null, ...resto] = pasan;
  return { principal, otros: resto.filter((f) => f.fuertes > 0).slice(0, 2) };
}

// ── De qué se arman las fuentes: lo que ya está en pantalla ───────────────────────────────────────────────────────────

/** Lo que hace falta de una pieza para citarla. Es un subconjunto de `Pieza` (lib/spy.ts): así sirve en el navegador y en un test. */
export type PiezaParaEvidencia = {
  id: number;
  canal: string;
  tipo: string;
  titulo?: string | null;
  texto?: string | null;
  url?: string | null;
  dominio_destino?: string | null;
  publicada_en?: string | null;
};
/** Una página de su web, como la guardó la lectura de la oferta (`PaginaGuardada`, lib/spy-oferta.ts). */
export type PaginaParaEvidencia = { url: string; titulo?: string | null; texto: string };

const NOMBRE_TIPO: Record<string, string> = { reel: 'Reel', publicacion: 'Publicación', video: 'Video', anuncio: 'Anuncio', landing: 'Su web' };
const fechaCita = (iso?: string | null): string | null => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('es', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '') : null;
};
const DONDE: Record<string, FuenteDeEvidencia['donde']> = { anuncios: 'anuncio', youtube: 'video', instagram: 'publicacion', landing: 'web' };

/** La ruta de una página, para nombrarla («/evento-cdmx», o «Su web» en la portada). */
export function nombreDeRuta(url: string): string {
  try {
    const u = new URL(url);
    const ruta = u.pathname.replace(/\/+$/, '');
    return ruta ? decodeURIComponent(ruta) : u.hostname.replace(/^www\./, '');
  } catch { return url; }
}

/**
 * Todo lo que se puede citar de un competidor: sus páginas leídas (el texto más largo que hay), lo que publica, sus videos y sus
 * anuncios con adónde mandan. Las páginas primero: es donde un funnel se nombra a sí mismo («compra tu entrada»).
 */
export function fuentesDeEvidencia(piezas: readonly PiezaParaEvidencia[], paginas: readonly PaginaParaEvidencia[] = []): FuenteDeEvidencia[] {
  const out: FuenteDeEvidencia[] = paginas
    .filter((p) => p.texto?.trim())
    .map((p) => ({ donde: 'web' as const, etiqueta: p.titulo?.trim() || nombreDeRuta(p.url), texto: p.texto, urls: [p.url] }));
  const leidas = new Set(paginas.map((p) => p.url));
  for (const p of piezas) {
    if (p.canal === 'landing' && p.url && leidas.has(p.url)) continue;
    // El título y el texto se leen como dos frases: pegados con un salto, la cita los juntaba en una sola.
    const texto = [p.titulo, p.texto].map((x) => x?.trim() ?? '').filter(Boolean).map((x, i, xs) => (i < xs.length - 1 && !/[.!?:…]$/.test(x) ? `${x}.` : x)).join(' ');
    const urls = [p.url, p.dominio_destino].filter((x): x is string => !!x?.trim());
    if (!texto.trim() && !urls.length) continue;
    const donde = DONDE[p.canal] ?? 'publicacion';
    const f = fechaCita(p.publicada_en);
    const etiqueta = donde === 'web' ? (p.titulo?.trim() || 'Su web') : `${NOMBRE_TIPO[p.tipo] ?? 'Publicación'}${f ? ` del ${f}` : ''}`;
    out.push({ donde, etiqueta, texto, urls, piezaId: p.id });
  }
  return out;
}

/** La cita partida para resaltar la frase que la delató, sin tildes ni mayúsculas. Sin la frase adentro, toda la cita va sola. */
export function partesDeCita(cita: string, frase: string): { antes: string; frase: string; despues: string } {
  const { n, mapa } = normalizarConMapa(cita);
  const m = regexDeFrase(frase).exec(n);
  if (!m) return { antes: cita, frase: '', despues: '' };
  const a = mapa[m.index] ?? 0;
  const b = (mapa[m.index + m[0].length - 1] ?? cita.length - 1) + 1;
  return { antes: cita.slice(0, a), frase: cita.slice(a, b), despues: cita.slice(b) };
}
