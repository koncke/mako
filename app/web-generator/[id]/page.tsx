// =============================================================================
// /web-generator/<id> — el editor de una landing (copiado de Gamma 5), a pantalla completa
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing Generator" un
// editor de landing tipo GAMMA. Replica por completo a Gamma». Diseño:
// docs/diseno-editor-landing.md (D9: las rutas de la tab).
//
// LA PUERTA es la de toda la tab (`requireRolWs([], { nav: 'landing-writer' })`): admin del
// workspace y la tab en su capa — la misma que pone la ruta /api/landing-generator.
//
// LA LANDING se lee con `abrir` (lib/editor-landing/server.ts), que filtra por el workspace de
// la pestaña: una landing de OTRO workspace contesta «No existe» y acá es un 404 de verdad
// (`notFound`), nunca la ficha ajena ni un aviso que confirme que existe. Un fallo de lectura
// (la base caída) NO es un 404: la pantalla lo dice y ofrece reintentar.
//
// Sin `Pagina`: el editor ocupa todo el alto con el patrón flex de AGENTS.md («Dos reglas de
// layout»: el alto es un número en la raíz del editor y los hijos estiran con flex: 1 +
// min-height: 0; nada de height: 100% en un hijo de flex: 1, que Safari resuelve a cero).
// =============================================================================

import { notFound } from 'next/navigation';
import { requireRolWs } from '@/lib/tab-access';
import { getWorkspaceActual } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { abrir, temasPropiosDe } from '@/lib/editor-landing/server';
import { listarAnalizadas } from '@/lib/landing-analyst';
import { basesLandings } from '@/lib/app-url';
import type { LandingCompleta, TemaPropio } from '@/lib/editor-landing/api-tipos';
import type { Analizada } from '../panel-reglas';
import EditorLanding from '../editor/EditorLanding';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EditorLandingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRolWs([], { nav: 'landing-writer' });
  const { id: idCrudo } = await params;
  const id = /^\d{1,15}$/.test(idCrudo) ? Number(idCrudo) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) notFound();

  // Las analizadas van con la landing: «Nueva landing» abre «¿Qué vas a crear hoy?» ADENTRO del editor (24/10/2026) y su
  // «landing de base» sale de ellas, como en el Panel. Una lectura que falla no es «no analizaste ninguna»: se dice ahí.
  const [r, rAnalizadas] = await Promise.all([
    abrir(id),
    listarAnalizadas().then(
      (a): { ok: true; analizadas: Analizada[] } => ({ ok: true, analizadas: a }),
      (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }),
    ),
  ]);
  if (!r.ok && r.status === 404) notFound();

  let doc: LandingCompleta | null = null;
  let error: string | null = null;
  let temasPropios: TemaPropio[] = [];
  if (r.ok) {
    doc = r.doc;
    const ws = await getWorkspaceActual();
    if (ws != null) {
      // Los temas propios se leen ESTRICTOS (una lectura que falla no es «no hay»): si fallan, el
      // editor abre con los del catálogo y vuelve a pedirlos cuando la landing usa uno propio.
      try {
        temasPropios = await temasPropiosDe(ws);
      } catch (e) {
        console.warn(`[editor-landing] #${id}: no pude leer los temas propios`, e instanceof Error ? e.message : e);
      }
    }
  } else {
    error = r.error;
  }

  const usuario = await getUsuarioActual().catch(() => null);
  const autor = (usuario?.nombre || usuario?.email || '').trim() || null;

  return (
    <EditorLanding
      doc={doc}
      error={error}
      temasPropios={temasPropios}
      creadoPor={doc?.creadoPor ?? null}
      autor={autor}
      analizadas={rAnalizadas.ok ? rAnalizadas.analizadas : []}
      errorAnalizadas={rAnalizadas.ok ? null : rAnalizadas.error}
      bases={basesLandings()}
    />
  );
}
