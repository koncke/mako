// =============================================================================
// alcance-secciones — qué porcentaje de los visitantes VIO cada sección de una landing (25/10/2026)
// =============================================================================
// El primer paso del Landing AI (docs/diseno-pruebas-ab.md, L1). Martín: «al detectar si una sección no es vista que
// haga variaciones». Desde el Pixel v26 (lib/landing-token.ts, bloque SECCIONES), cada visita a una página del Web
// Generator manda el evento acumulado `secciones`, con los ids de las secciones que vio en `detalle` (vista = la mitad
// de la sección o de la pantalla, lo menor, durante 1 s).
//
// LA CUENTA, por PÁGINA (una sección de la página «precios» se divide por quien entró a «precios», no a la landing):
//   alcance de una sección = visitantes de su página que la vieron / visitantes de su página DESDE QUE SE MIDE.
//   · «Desde que se mide» es el primer evento `secciones` de la landing. Con la ventana de 30 días sola, los
//     visitantes de antes de la v26 entraban al denominador sin haber podido mandar nada: el alcance salía bajo
//     sin serlo.
//   · Sin ningún evento `secciones`, `null`: NO MEDIDO, nunca 0 (la pantalla dice «No medido»).
//   · Quien mandó `secciones` entra al denominador aunque su visita no esté (la visita y el evento son dos filas):
//     así ningún alcance pasa del 100 %.
//
// ⚠️ PURO: sin base ni DOM. Lo usan `analitica` (lib/editor-landing/server.ts: la pantalla «Análisis» y
//    ver_analitica_landing) y el Landing Analyst (`getComportamiento`). Lo prueba tests/alcance-secciones.test.ts.
// =============================================================================

import { textoDeHtmlEditable } from './doc';
import { claveDeLanding } from '../landing-url';

/** El tipo del evento del Pixel (v26). */
export const TIPO_EVENTO_SECCIONES = 'secciones';

/** La forma de un id de sección (la misma regla que el Pixel). Lo demás que traiga `detalle` no se cuenta. */
const ID_SECCION = /^[A-Za-z0-9_-]{1,40}$/;

/** Los ids de un `detalle` del evento `secciones`, sin repetir. */
export function idsDeSecciones(detalle: string | null | undefined): string[] {
  const out: string[] = [];
  for (const id of String(detalle ?? '').split(/\s+/)) if (ID_SECCION.test(id) && !out.includes(id)) out.push(id);
  return out;
}

export type FilaVisita = { visitor_id: string | null; landing_url: string | null; created_at: string };
export type FilaSecciones = FilaVisita & { detalle: string | null };

/** Una página de la landing: las URLs que la sirven (normalizadas, como `urlsAMedir`) y sus secciones, en orden. */
export type PaginaMedida = { claves: ReadonlySet<string>; secciones: { id: string; titulo: string }[] };

export type AlcanceSecciones = {
  /** El primer evento `secciones` de la landing: desde ahí se mide. */
  desde: string;
  /** Visitantes de la landing desde entonces (sin repetir entre páginas). */
  visitantes: number;
  /** En el orden de la landing. `pct` null = esa página no tuvo visitantes desde que se mide. */
  porSeccion: { tarjetaId: string; titulo: string; pct: number | null }[];
};

const claveDe = (u: string | null): string | null => {
  if (!u) return null;
  try { return claveDeLanding(u); } catch { return null; }
};
const ms = (f: string): number => { const t = Date.parse(f); return Number.isFinite(t) ? t : NaN; };

/** El alcance de cada sección. `null` si ninguna página de la landing recibió un evento `secciones` todavía. */
export function alcanceDeSecciones(
  paginas: readonly PaginaMedida[],
  visitas: readonly FilaVisita[],
  eventos: readonly FilaSecciones[],
): AlcanceSecciones | null {
  const paginaDe = (u: string | null): number => {
    const k = claveDe(u);
    return k === null ? -1 : paginas.findIndex((p) => p.claves.has(k));
  };
  // Los eventos de ESTA landing, con al menos un id: el primero dice desde cuándo se mide.
  const propios = eventos
    .map((e) => ({ e, p: paginaDe(e.landing_url), ids: idsDeSecciones(e.detalle), t: ms(e.created_at) }))
    .filter((x) => x.p >= 0 && x.ids.length > 0 && x.e.visitor_id && Number.isFinite(x.t));
  if (!propios.length) return null;
  const desdeMs = Math.min(...propios.map((x) => x.t));

  const denominador = paginas.map(() => new Set<string>());
  const vistas = paginas.map(() => new Map<string, Set<string>>());
  for (const v of visitas) {
    if (!v.visitor_id || !(ms(v.created_at) >= desdeMs)) continue;
    const p = paginaDe(v.landing_url);
    if (p >= 0) denominador[p].add(v.visitor_id);
  }
  for (const x of propios) {
    const quien = x.e.visitor_id as string;
    denominador[x.p].add(quien);
    const ya = vistas[x.p].get(quien) ?? new Set<string>();
    for (const id of x.ids) ya.add(id);
    vistas[x.p].set(quien, ya);
  }

  const porSeccion: AlcanceSecciones['porSeccion'] = [];
  paginas.forEach((pg, p) => {
    const total = denominador[p].size;
    for (const s of pg.secciones) {
      let n = 0;
      for (const ids of vistas[p].values()) if (ids.has(s.id)) n++;
      porSeccion.push({ tarjetaId: s.id, titulo: s.titulo, pct: total > 0 ? Math.round((n * 100) / total) : null });
    }
  });
  const todos = new Set<string>();
  for (const d of denominador) for (const q of d) todos.add(q);
  return { desde: new Date(desdeMs).toISOString(), visitantes: todos.size, porSeccion };
}

/**
 * El comienzo de cada sección en el HTML PUBLICADO, en orden: las de bloques (`section.gm-tarjeta#t-<id>`,
 * especificacion.ts) y las de «Diseño editable» (`div.gm-libre-seccion[data-seccion]`, render.ts). Son las MISMAS dos
 * formas que busca el Pixel v26. El `class` se exige: un `id="t-…"` o un `data-seccion` adentro del HTML de un diseño
 * no es una sección.
 */
const INICIO_SECCION = /<section\b(?=[^>]*\bclass="[^"]*\bgm-tarjeta\b)[^>]*\bid="t-([A-Za-z0-9_-]{1,40})"[^>]*>|<div\b(?=[^>]*\bclass="[^"]*\bgm-libre-seccion\b)[^>]*\bdata-seccion="([A-Za-z0-9_-]{1,40})"[^>]*>/g;

/** El título de una sección desde su HTML: su primer encabezado, o su primer renglón de texto. */
function tituloDeHtml(html: string): string {
  const h = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(html)?.[1];
  const desde = h ?? html;
  const texto = textoDeHtmlEditable(desde).split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  return texto.slice(0, 80);
}

/**
 * Las secciones de cada página de la FOTO publicada (lo que de verdad se sirve), con su título, en orden. La foto guarda
 * el HTML ya dibujado de cada página (`paginas[].html`, publicar.ts), no el documento: las secciones salen de ahí. Una
 * sección oculta no se publica, así que no aparece.
 */
export function seccionesDeLaFoto(publicado: unknown): { ruta: string; secciones: { id: string; titulo: string }[] }[] {
  const paginas = (publicado as { paginas?: unknown } | null)?.paginas;
  if (!Array.isArray(paginas)) return [];
  const out: { ruta: string; secciones: { id: string; titulo: string }[] }[] = [];
  for (const p of paginas) {
    const ruta = (p as { ruta?: unknown })?.ruta;
    const html = (p as { html?: unknown })?.html;
    if (typeof ruta !== 'string' || typeof html !== 'string') continue;
    const marcas = [...html.matchAll(INICIO_SECCION)].map((m) => ({ id: m[1] ?? m[2], desde: m.index ?? 0 }));
    const secciones: { id: string; titulo: string }[] = [];
    marcas.forEach((m, i) => {
      if (!m.id || secciones.some((s) => s.id === m.id)) return;
      const trozo = html.slice(m.desde, i + 1 < marcas.length ? marcas[i + 1].desde : html.length);
      secciones.push({ id: m.id, titulo: tituloDeHtml(trozo) || 'Sin título' });
    });
    out.push({ ruta, secciones });
  }
  return out;
}

/** Lo que el Landing Analyst sabe del alcance (`LandingComportamiento.alcance_secciones`, lib/landing-analyst.ts). */
export type AlcanceParaTexto = { desde: string; visitantes: number; secciones: Array<{ titulo: string; pct: number | null }> };

/**
 * El alcance por sección para el prompt (Pixel v26). Sin medición no se escribe NADA (una página de afuera no tiene
 * secciones que medir), y una sección sin visitantes lo dice: nunca un 0 %. El system prompt le prohíbe al modelo dudar de
 * estos números, así que un alcance inventado se volvería un diagnóstico imposible de refutar.
 */
export function textoDeAlcanceSecciones(a: AlcanceParaTexto | null | undefined): string[] {
  if (!a || !a.secciones.length) return [];
  const filas = a.secciones.map((s, i) => `${i + 1}. «${s.titulo}»: ${s.pct === null ? 'sin visitantes en esa página' : `${s.pct}%`}`);
  return [
    `Alcance por sección (qué porcentaje de los visitantes VIO cada sección: al menos la mitad de la sección o de la pantalla durante 1 segundo; desde el ${a.desde.slice(0, 10)}, ${a.visitantes} visitantes, últimos 30 días):`,
    ...filas,
  ];
}
