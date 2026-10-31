// =============================================================================
// El estudio de video — los PROYECTOS de la barra del costado (puro, con test)
// =============================================================================
// Martín, 27/10/2026: «implementar Video Generator, que nos quedó a medias... Tiene una cantidad de pestañas absurdas, el
// diseño, que se parezca a una app que tomemos de referencia». La referencia es ARCADS (help.arcads.ai, «Getting Started»
// y «How do I make an AI UGC ad»): un PROYECTO por anuncio, la lista de proyectos al costado y «New Project» arriba de
// ella. Abrir, crear o cambiar de proyecto NO cambia de ruta: el proyecto abierto viaja en `?plan=` y se escribe con
// `history.replaceState` (Next sincroniza `useSearchParams` con eso).
//
// ⚠️ EN QUÉ ANDA UN ANUNCIO SE DECIDE UNA VEZ, ACÁ (`faseDe`). Vivía en `pasoDe` (WizardAnuncio.tsx, 'use client'), y la
//    barra necesitaba la misma respuesta para escribir su renglón: con dos copias, la barra diría «Escenarios» de un anuncio
//    que el centro abre en «Tomas». `pasoDe` ahora la llama.
// SIN 'use client' y sin server-only: lo usan la barra, el wizard y los tests.
// =============================================================================

import type { PlanGuardado } from '../video-datos';
import { estadoDeToma } from '../tomas-estado';

/** En qué parte de la producción está un anuncio. El orden es el de la producción. */
export type Fase = { id: 'guion' } | { id: 'escenario'; n: number } | { id: 'tomas' } | { id: 'listo' };

/**
 * La parte del anuncio que toca ahora, DERIVADA del dato (la regla que era de `pasoDe`):
 * sin escenarios → el guion; un escenario sin aprobar → ése; una toma sin video → las tomas; todo filmado → listo.
 */
export function faseDe(item: Pick<PlanGuardado, 'escenas' | 'imagenes' | 'plan' | 'video'>): Fase {
  const escenas = item.escenas ?? [];
  if (!escenas.length) return { id: 'guion' };
  const sinConfirmar = escenas.find((e) => !item.imagenes?.[String(e.n)]?.confirmada);
  if (sinConfirmar) return { id: 'escenario', n: sinConfirmar.n };
  if (item.plan.clips.some((c) => !item.video?.[String(c.n)]?.url)) return { id: 'tomas' };
  return { id: 'listo' };
}

export type TonoFila = 'neutro' | 'info' | 'good' | 'bad';

/** Un renglón de la barra: el nombre del anuncio y en qué anda, en tres o cuatro palabras. */
export type FilaProyecto = { id: string; titulo: string; detalle: string; tono: TonoFila };

/** El nombre que se dibuja: el título del plan, o lo que se pidió (el mismo criterio que el teléfono). */
export function tituloDeProyecto(p: Pick<PlanGuardado, 'plan' | 'pedido'>): string {
  return (p.plan.titulo || p.pedido || '').trim() || 'Anuncio';
}

export function filaDeProyecto(item: PlanGuardado): FilaProyecto {
  const base = { id: item.id, titulo: tituloDeProyecto(item) };
  const f = faseDe(item);
  if (f.id === 'guion') return { ...base, detalle: 'Revisa el guion', tono: 'neutro' };
  if (f.id === 'escenario') {
    const escenas = item.escenas ?? [];
    const pos = Math.max(1, escenas.findIndex((e) => e.n === f.n) + 1);
    return { ...base, detalle: escenas.length > 1 ? `Escenario ${pos} de ${escenas.length}` : 'Aprueba el escenario', tono: 'neutro' };
  }
  if (f.id === 'tomas') {
    const estados = item.plan.clips.map((c) => estadoDeToma(item, c.n));
    // Primero lo que BLOQUEA (una toma que no salió), después lo que se mueve solo, después cuánto falta.
    const fallas = estados.filter((e) => e === 'fallada').length;
    if (fallas) return { ...base, detalle: fallas === 1 ? 'Una toma no salió' : `${fallas} tomas no salieron`, tono: 'bad' };
    if (estados.includes('generando')) return { ...base, detalle: 'Filmando…', tono: 'info' };
    const listas = estados.filter((e) => e === 'filmada').length;
    return { ...base, detalle: listas ? `${listas} de ${estados.length} tomas` : 'Sin filmar', tono: 'neutro' };
  }
  return { ...base, detalle: 'Listo', tono: 'good' };
}

// ── El proyecto abierto, en la URL ──────────────────────────────────────────

/** El id de un plan (`crypto.randomUUID()`, app/video-generator/actions.ts): lo demás no es un id. */
const ID = /^[A-Za-z0-9-]{1,80}$/;

/** El proyecto que nombra la URL (`?plan=`), o null. */
export function planDeUrl(search: string): string | null {
  const v = new URLSearchParams(search).get('plan');
  return v && ID.test(v) ? v : null;
}

/**
 * La misma URL con OTRO proyecto abierto (`null` = el anuncio nuevo). Conserva todo lo demás de la query: el `?ws=` del
 * cliente que se está mirando viaja ahí, y perderlo te deja mirando otra cuenta (AGENTS.md, «Hay CINCO formas de navegar»).
 */
export function urlConPlan(href: string, id: string | null): string {
  const u = new URL(href, 'http://x');
  if (id && ID.test(id)) u.searchParams.set('plan', id);
  else u.searchParams.delete('plan');
  const q = u.searchParams.toString();
  return `${u.pathname}${q ? `?${q}` : ''}${u.hash}`;
}

/**
 * El anuncio que apareció en la lista DESPUÉS de un turno del chat («arma un anuncio con mi último guion»): el estudio lo abre,
 * como abre el que se crea con el botón. Sólo uno nuevo, nunca uno que ya estaba (un cambio de MaKo sobre otro anuncio no
 * saca a la persona del que está mirando).
 */
export function proyectoNuevo(antes: readonly { id: string }[], despues: readonly { id: string }[]): string | null {
  const ya = new Set(antes.map((p) => p.id));
  return despues.find((p) => !ya.has(p.id))?.id ?? null;
}
