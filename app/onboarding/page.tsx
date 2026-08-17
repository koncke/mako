// =============================================================================
// /onboarding — cargar el negocio en MaKo (hub) o el wizard de alta (bloqueante)
// =============================================================================
// Cliente con onboarding pendiente/salteado → el WIZARD completo (overlay:
// integraciones → El Archivero → tabs → Retro). Onboarding terminado (o el dueño /
// super admin sin impersonar) → el HUB con las tabs El Archivero + Funnel +
// Ángulos y avatares. Se accede desde el menú de la foto de perfil ("Onboarding").

import { Icon } from '../_components/icons';
import { OnboardingTabs } from './OnboardingTabs';
import { OnboardingWizard } from './OnboardingWizard';
import { FunnelEditor } from '../funnel/FunnelEditor';
import { requireRolWs } from '@/lib/tab-access';
import { getFunnel } from '@/lib/leads';
import { getEstadoOnboarding, pasosDeCapaActual } from '@/lib/onboarding-state';
import { cerebroBienvenida } from '@/lib/bienvenida-cerebro';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OnboardingPage() {
  // gateOnboarding:false — esta ES la página del wizard, no puede redirigirse sola.
  await requireRolWs([], { gateOnboarding: false });

  // Gating (pedido de Mauricio): mientras el onboarding NO esté 'done' se ve el MODAL
  // secuencial (wizard) — NINGUNA tab — y al terminar se desbloquea el hub. Aplica
  // TAMBIÉN al dueño (Mauricio usa MaKo para su propio negocio): /api/onboarding ahora
  // resuelve el dueño → OWNER_WS, así que el wizard carga bien, y esAdmin=true le da los
  // atajos (saltar sin conectar) para no quedar trabado. Una capa sin pasos → hub.
  const estado = await getEstadoOnboarding();
  const pasos = await pasosDeCapaActual();
  const done = pasos.length === 0 || estado.status === 'done';
  if (!done) {
    // ⚠️ EL LAYOUT DEL MAPA SE CALCULA ACÁ Y NO EN LA PANTALLA, y no es una preferencia:
    // `cerebroBienvenida()` llama a `layoutCerebro`, que trae d3-force. Bienvenida.tsx es
    // 'use client', así que si lo importara ella se llevaría el motor de física al bundle
    // del navegador — y el typecheck NO lo ve. Acá corre en el server y bajan 33 pares de
    // coordenadas.
    //
    // Es FICCIÓN, así que no lee la base ni cuesta una query: es un cálculo puro, siempre
    // el mismo (d3-force no usa Math.random). Y solo se arma cuando hay bienvenida que
    // mostrar. Si algo falla se entra sin mapa: es el fondo de una portada, no una razón
    // para dejar a alguien afuera del producto que compró.
    let cerebro = null;
    if (estado.status === 'pending') {
      try { cerebro = cerebroBienvenida(); }
      catch (e) { console.error('[onboarding] no se pudo armar el mapa de la bienvenida:', e); }
    }
    return <OnboardingWizard cerebro={cerebro} />;
  }

  // Dueño / cliente ya onboardeado → el hub para cargar/editar el negocio.
  const { pipeline, suppressed } = await getFunnel();
  const funnelPanel = <FunnelEditor embedded initialPipeline={pipeline} initialSuppressed={suppressed} />;

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="contexto" size={34} /></span>
        <h1 style={{ fontWeight: 600, fontSize: 42, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Onboarding</h1>
      </header>
      <OnboardingTabs funnelPanel={funnelPanel} />
    </main>
  );
}
