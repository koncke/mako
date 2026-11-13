// =============================================================================
// Marketing CoPilot — la Web, como análisis (13/11/2026)
// =============================================================================
// Martín (13/11): «Oferta y Web se quedan en CoPilot como análisis; se construyen en el Ops Center y en el Web Generator». El
// análisis de cada página ya lo hace el Landing Analyst (lib/landing-analyst.ts → `landing_analyses`: la nota, el veredicto y los
// hallazgos con su arreglo). Acá se LEE lo último que analizó, sin volver a pagar la IA: lo que falta se analiza en Web Generator
// (`/web-generator?analizar=<url>`). Sólo lectura, dentro de runWithWorkspace(ws).
// =============================================================================

import 'server-only';
import { getTenantDb, runWithWorkspace } from '@/lib/workspace';
import type { LandingHallazgo } from '@/lib/landing-analyst';

export type HallazgoWeb = { titulo: string; severidad: 'alta' | 'media' | 'baja'; arreglo: string };
export type PaginaAnalizada = { url: string; titulo: string | null; /** De 0 a 10, con una décima (la del Landing Analyst). */ score: number | null; veredicto: string | null; hallazgos: HallazgoWeb[]; analizadaAt: string | null };

const ORDEN: Record<HallazgoWeb['severidad'], number> = { alta: 0, media: 1, baja: 2 };

/** Las páginas del negocio que el Landing Analyst ya analizó, las más nuevas primero, con sus hallazgos de lo más grave a lo menos. */
export async function paginasAnalizadas(ws: number, tope = 3): Promise<PaginaAnalizada[]> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { data, error } = await db.from('landing_analyses')
      .select('url, titulo, score, veredicto, hallazgos, analyzed_at')
      .eq('status', 'analizada')
      .order('analyzed_at', { ascending: false, nullsFirst: false })
      .limit(tope);
    if (error) throw new Error(`No pude leer el análisis de tu web: ${error.message}`);
    return ((data ?? []) as Array<{ url: string; titulo: string | null; score: unknown; veredicto: string | null; hallazgos: LandingHallazgo[] | null; analyzed_at: string | null }>).map((f) => {
      const n = Number(f.score);
      const hallazgos = (Array.isArray(f.hallazgos) ? f.hallazgos : [])
        .filter((h) => h && typeof h.titulo === 'string' && h.titulo.trim())
        .map((h) => ({ titulo: h.titulo.trim().slice(0, 140), severidad: (['alta', 'media', 'baja'].includes(h.severidad) ? h.severidad : 'media') as HallazgoWeb['severidad'], arreglo: String(h.arreglo ?? '').trim().slice(0, 240) }))
        .sort((a, b) => ORDEN[a.severidad] - ORDEN[b.severidad])
        .slice(0, 5);
      return { url: f.url, titulo: f.titulo, score: f.score != null && Number.isFinite(n) ? Math.round(n * 10) / 10 : null, veredicto: f.veredicto, hallazgos, analizadaAt: f.analyzed_at };
    });
  });
}
