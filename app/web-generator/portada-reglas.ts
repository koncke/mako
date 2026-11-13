// =============================================================================
// Las reglas puras de la portada de Web Generator (./PortadaWeb.tsx, ./OutliersLandings.tsx, ./PlantillasPortada.tsx)
// =============================================================================
// Sin React ni CSS: las usan las pantallas y tests/web-generator-outliers.test.ts.
// =============================================================================

import type { LandingResumen } from '@/lib/editor-landing/api-tipos';
import type { ProyectoCrear } from '@/app/_crear/reglas';
import { hostDeLanding, type OutlierLanding, type TipoLanding } from '@/lib/landing-outliers';

const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Buscar en la portada (11/11/2026, el recorrido de Martín: «entrar, buscar, replicar una…»): por el titular, de quién es, su
 * nicho, por qué funciona y su dominio, sin acentos ni mayúsculas; y por tipo («VSL», «Webinar»…). Vacío = todas.
 */
export function filtrarOutliers(lista: readonly OutlierLanding[], q: string, tipo: TipoLanding | null): OutlierLanding[] {
  const palabras = plano(q).split(/\s+/).filter(Boolean);
  return lista.filter((x) => {
    if (tipo && x.tipo !== tipo) return false;
    if (!palabras.length) return true;
    const texto = plano([x.titulo, x.quien.nombre, x.quien.nicho ?? '', x.porque ?? '', hostDeLanding(x.url)].join(' '));
    return palabras.every((p) => texto.includes(p));
  });
}

/** Lo escrito en el buscador es el link de una página («https://…» o «algo.com/…»): se ofrece replicarla. */
export function linkEscrito(q: string): string | null {
  const t = q.trim();
  if (!/^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(t)) return null;
  try { return new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`).toString(); } catch { return null; }
}

/** El Panel: «¿Qué vas a crear hoy?», sus modos (generar, importar, analizar, replicar) y la lista entera («Crear desde cero»). */
export const RUTA_PANEL = '/web-generator?panel=1';
/** «Replicar»: Replicar arrancando con esa página (el mismo link que «Copiar su sitio» de Spy). */
// `&adaptar=1` (12/11/2026, el Cerebro): de un outlier sale la ADAPTADA al negocio, directo; la copia literal, en «Qué replicar».
export const rutaReplicarLanding = (url: string): string => `/web-generator?replicar=${encodeURIComponent(url)}&adaptar=1`;
/** «Ver todas»: la galería del Panel (diseños de landing y plantillas de presentación). */
export const RUTA_PLANTILLAS = '/web-generator?vista=plantillas';
/** Un diseño elegido en la portada: el Panel con su pregunta del objetivo (Inicio.tsx, `disenoInicial`). */
export const rutaDiseno = (id: string): string => `${RUTA_PLANTILLAS}&diseno=${encodeURIComponent(id)}`;

/**
 * Cuánto tarda en bajar la página entera al pasar el cursor: ~700 px de captura por segundo, entre 4 y 16 s (una página corta no
 * pasa volando y una larga no aburre).
 */
export const duracionDelScroll = (alto: number | null | undefined): number => Math.min(16, Math.max(4, Math.round((alto ?? 2800) / 700)));

/** Tus landings para la lista de la tarjeta del chat: sin las de la papelera, la última tocada primero, cada una a su editor. */
/** Lo que la lista de «Mis landings» usa de cada landing (`proyectosDeLandings`). */
export type LandingEnLista = Pick<LandingResumen, 'id' | 'titulo' | 'actualizado' | 'papelera'>;

/**
 * Lo que viaja con la portada de cada landing: sólo lo de la lista. 13/11/2026, medido en producción: `listar()` trae también la
 * primera sección de cada una (para la miniatura del Panel), y en una importada esa sección es el HTML de la página original;
 * 56 landings eran ~230 KB de la página para una lista que ni se ve hasta tocar «Mis landings».
 */
export const paraLaLista = (docs: readonly LandingResumen[]): LandingEnLista[] =>
  docs.map(({ id, titulo, actualizado, papelera }) => ({ id, titulo, actualizado, papelera }));

export function proyectosDeLandings(docs: readonly LandingEnLista[]): ProyectoCrear[] {
  return docs
    .filter((d) => !d.papelera)
    .map((d) => ({ d, t: Date.parse(d.actualizado) || 0 }))
    .sort((a, b) => b.t - a.t)
    .map(({ d, t }) => ({ id: String(d.id), nombre: d.titulo, href: `/web-generator/${d.id}`, cuando: t || null }));
}
