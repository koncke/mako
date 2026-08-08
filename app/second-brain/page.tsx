// =============================================================================
// /second-brain — el cerebro del negocio (Analyze)
// =============================================================================
// El documento le da el lugar de HERO de la familia Analyze: «Second Brain ·
// Analiza todo tu negocio, conecta las señales y encuentra qué mover». Es una
// CAPA TRANSVERSAL, no un silo de informes: alimenta a Focus y a Experiments.
//
// POR AHORA muestra lo mismo que el hub de /onboarding —El Archivero, Funnel,
// Ángulos y avatares, productos, persona, personalidad— porque eso ES el
// contenido que el usuario le carga del negocio, y es de donde el cerebro se
// alimenta. La decisión de Martín sobre el Context Selector va en la misma
// dirección: «debe vivir dentro de Second Brain, ya que justamente el second
// brain se alimenta de esa info que el usuario le carga de su negocio».
//
// EL GRAFO ya vive acá (`Grafo.tsx` + `lib/cerebro-grafo.ts`): es el mapa del
// negocio del CLIENTE, no el de graphify sobre el código de MaKo — ver la
// advertencia en la cabecera de lib/cerebro-grafo.ts y docs/hallazgos-onboarding.md.
// Se construyó primero acá y suelto, a pedido de Martín, para diseñarlo sin la
// presión del wizard; dónde entra en el onboarding se decide mirándolo andar.
//
// LO QUE FALTA (tarea #522): el selector de contexto (negocio · producto ·
// oferta · funnel), que según su decisión vive adentro de Second Brain.

import { Icon } from '../_components/icons';
import { OnboardingTabs } from '../onboarding/OnboardingTabs';
import { FunnelEditor } from '../funnel/FunnelEditor';
import { Grafo } from './Grafo';
import { requireRolWs } from '@/lib/tab-access';
import { getFunnel } from '@/lib/leads';
import { construirCerebro } from '@/lib/cerebro-grafo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SecondBrainPage() {
  await requireRolWs([], { nav: 'second-brain' });

  const [{ pipeline, suppressed }, cerebro] = await Promise.all([getFunnel(), construirCerebro()]);
  const funnelPanel = <FunnelEditor embedded initialPipeline={pipeline} initialSuppressed={suppressed} />;

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <header style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-flex', color: 'var(--mako-ink)' }}><Icon name="red" size={32} /></span>
          <h1 style={{ fontWeight: 700, fontSize: 'var(--fs-page)', letterSpacing: '-0.02em', lineHeight: 1.15, margin: 0, color: 'var(--ink)' }}>Second Brain</h1>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.5, maxWidth: 640 }}>
          Todo lo que MaKo sabe de tu negocio. De acá salen las señales que conecta para encontrar qué mover.
        </p>
      </header>
      <section style={{ marginBottom: 34 }}>
        <Grafo cerebro={cerebro} />
      </section>
      <OnboardingTabs funnelPanel={funnelPanel} />
    </main>
  );
}
