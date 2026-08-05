// =============================================================================
// /landing-writer — Landing Generator
// =============================================================================
// MaKo escribe la página entera (estructura + copy terminado) desde el funnel,
// el perfil del negocio y —si esa URL ya pasó por el Landing Analyst— sus
// hallazgos. La generación NO se guarda sola: el dueño revisa y guarda si le
// sirve (landing_drafts).
//
// La página trae las landings ya analizadas (para el selector "Sobre cuál") y el
// historial. El componente cliente hace el resto contra /api/landing-writer.
// =============================================================================

import { Suspense } from 'react';
import { listarAnalizadas } from '@/lib/landing-analyst';
import { listarDrafts } from '@/lib/landing-writer';
import { LandingWriterApp, type LandingAnalizada, type DraftResumen } from './LandingWriterApp';
import { requireRolWs } from '@/lib/tab-access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LandingWriterPage() {
  await requireRolWs([], { nav: 'landing-writer' });

  let analizadas: LandingAnalizada[] = [];
  let drafts: DraftResumen[] = [];
  let errorMsg: string | null = null;
  try {
    const [lista, hist] = await Promise.all([listarAnalizadas(), listarDrafts()]);
    analizadas = lista;
    drafts = hist.map((d) => ({ id: d.id, titulo: d.titulo, pedido: d.pedido, created_at: d.created_at, spec: d.spec }));
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  // useSearchParams (el deep-link ?url= desde el Landing Analyst) necesita un
  // límite de Suspense o el prerender de la ruta falla en build.
  return (
    <Suspense fallback={null}>
      <LandingWriterApp analizadas={analizadas} drafts={drafts} errorMsg={errorMsg} />
    </Suspense>
  );
}
