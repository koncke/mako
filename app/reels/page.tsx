// =============================================================================
// /reels — server wrapper: guard + estado del onboarding de la tab + monta la app
// =============================================================================
// La page aplica el guard (requireRolWs con la key exacta del nav) y junta el
// estado que la vista necesita. El trabajo pesado vive en ReelsApp.tsx
// ('use client').
//
// El onboarding de esta tab NO reemplaza la vista (los guiones se escriben sin
// nada conectado): se muestra como checklist adentro de la app y se completa
// usándola — el molde de landing-writer.

import { requireRolWs } from '@/lib/tab-access';
import { getWorkspaceActual } from '@/lib/workspace';
import { getEstadoTab, marcarPasoTab } from '@/lib/tab-onboarding-state';
import { estadoContextoReels, leerHistorial } from './reels-datos';
import { ReelsApp } from './ReelsApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReelsPage() {
  await requireRolWs([], { nav: 'reels' });

  const ws = await getWorkspaceActual();
  // Agencia sin impersonar: no hay workspace del que leer. La vista igual se
  // sirve (las actions cortan con su propio error si intenta operar).
  if (ws == null) return <ReelsApp historialInicial={[]} onboarding={null} />;

  const [historial, contexto, tab] = await Promise.all([
    leerHistorial(),
    estadoContextoReels(),
    getEstadoTab('reels'),
  ]);

  // Estado VIVO, no recordado: el paso `reels_contexto` refleja el perfil de
  // AHORA, en los dos sentidos.
  // Best-effort: si settings falla, la página se sirve con lo leído.
  let steps = tab.steps;
  let status = tab.status;
  try {
    if (contexto.listo && !steps.reels_contexto?.done) {
      const s = await marcarPasoTab('reels', 'reels_contexto');
      steps = s.steps; status = s.status;
    } else if (!contexto.listo && contexto.faltan.length > 0 && steps.reels_contexto?.done) {
      // `faltan` vacío con `listo:false` = la CONSULTA falló, no el perfil
      // (un perfil vacío lista todos sus grupos). Un error de infra no
      // desmarca un paso.
      const s = await marcarPasoTab('reels', 'reels_contexto', false);
      steps = s.steps; status = s.status;
    }
  } catch { /* el marcado es accesorio a servir la página */ }

  return (
    <ReelsApp
      historialInicial={historial}
      onboarding={{
        pendiente: status !== 'done',
        contexto,
        ensayoHecho: !!steps.reels_ensayo?.done,
      }}
    />
  );
}
