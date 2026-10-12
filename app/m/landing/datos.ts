// =============================================================================
// /m/landing — lo que la lista lee (server): las landings del negocio, su estado y sus números
// =============================================================================
// Todo sale de las MISMAS funciones que usa escritorio (lib/editor-landing/server.ts):
//   · `listar` — las landings del workspace del request (paginado, ordenado por última edición);
//   · `analitica` — visitas y leads de 30 días de UNA landing publicada (el Pixel de MaKo).
// La única lectura propia es `sitio_activo`, que `listar` no trae y separa «Publicada» de
// «Pausada» (sin ella, una landing pausada se vería en línea).
//
// La puerta ya la puso la página (`requireMovil({ navKey: 'landing-writer' })` = admin del
// negocio + la tab en su capa, la misma regla que /api/landing-generator). Las funciones de
// lib/editor-landing filtran por `getWorkspaceActual()`; la lectura propia, por el `ws` del
// contexto de /m y con el `.eq('workspace_id')` escrito.
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { leerTodo } from '@/lib/supabase-paginado';
import { listar, analitica } from '@/lib/editor-landing/server';
import { estadoLanding, type EstadoLanding } from './modelo';

export type LandingFilaM = { id: number; titulo: string; estado: EstadoLanding };

export type LecturaLandings = { ok: true; filas: LandingFilaM[] } | { ok: false };

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Las landings del negocio fuera de la papelera, en el orden del Panel (la última editada arriba). */
export async function leerLandingsM(ws: number): Promise<LecturaLandings> {
  const r = await listar().catch((e: unknown) => ({ ok: false as const, error: msg(e) }));
  // Una lista que no se pudo leer NO es «no tienes landings»: la pantalla lo dice y reintenta.
  if (!r.ok) { console.error('[m/landing] listar:', r.error); return { ok: false }; }
  const docs = r.docs.filter((d) => !d.papelera);

  // `sitio_activo` sólo importa en las publicadas. Si la lectura falla, se dibujan como
  // publicadas (lo que dice la foto) y queda en el log: la lista no se cae por un adorno.
  let activos: Map<number, boolean> | null = null;
  if (docs.some((d) => estadoLanding(d, null) !== 'borrador')) {
    try {
      const filas = await leerTodo<{ id: number; sitio_activo: boolean }>(await getTenantDb(), 'landing_docs', 'id, sitio_activo', {
        eq: { workspace_id: ws },
        orden: 'id',
        filtros: (q) => q.not('publicado_at', 'is', null),
      });
      activos = new Map(filas.map((f) => [Number(f.id), f.sitio_activo !== false]));
    } catch (e) {
      console.error('[m/landing] sitio_activo:', msg(e));
    }
  }

  return {
    ok: true,
    filas: docs.map((d) => ({ id: d.id, titulo: d.titulo.trim() || 'Sin título', estado: estadoLanding(d, activos?.get(d.id) ?? null) })),
  };
}

export type MedidaLanding = { visitas: number; leads: number };

/**
 * Un medidor para UN render de la lista: corre `analitica` de a `limite` por vez (cada una pagina
 * las visitas de 30 días) y devuelve null si la medición falla — nunca un 0 inventado.
 */
export function medidorDeVisitas(limite: number): (id: number) => Promise<MedidaLanding | null> {
  let corriendo = 0;
  const cola: (() => void)[] = [];
  const turno = () => new Promise<void>((listo) => {
    if (corriendo < limite) { corriendo++; listo(); } else cola.push(() => { corriendo++; listo(); });
  });
  const soltar = () => { corriendo--; cola.shift()?.(); };

  return async (id) => {
    await turno();
    try {
      const r = await analitica(id);
      if (!r.ok) { console.error(`[m/landing] analitica #${id}:`, r.error); return null; }
      // Sin publicar no hay qué medir: la lista ya no la pide, pero si llega, no es «0 visitas».
      if (!r.analitica.publicada) return null;
      return { visitas: r.analitica.visitas30, leads: r.analitica.leads30 };
    } catch (e) {
      console.error(`[m/landing] analitica #${id}:`, msg(e));
      return null;
    } finally {
      soltar();
    }
  };
}
