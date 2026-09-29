// =============================================================================
// /onboarding — cargar el negocio en MaKo (hub) o el wizard de alta (bloqueante)
// =============================================================================
// Cliente con onboarding pendiente/salteado → el WIZARD completo (overlay:
// integraciones → El Archivero → tabs → Retro). Onboarding terminado (o el dueño /
// super admin sin impersonar) → el HUB con las tabs El Archivero + Funnel +
// Ángulos y avatares. Se accede desde el menú de la foto de perfil ("Onboarding").

import { Icon } from '../_components/icons';
import { OnboardingTabs, tabDeUrl } from './OnboardingTabs';
import { OnboardingWizard } from './OnboardingWizard';
import { FunnelEditor } from '../funnel/FunnelEditor';
import { requireRolWs } from '@/lib/tab-access';
import { getFunnelDefault } from '@/lib/funnels';
import { EntradasCard } from '../funnel/EntradasCard';
import { canalEfectivo } from '@/lib/fase-diagnostico';
import { getDiagnosticoFase } from '@/lib/fase-store';
import { getEstadoOnboarding, pasosDeCapaActual } from '@/lib/onboarding-state';
// El onboarding se pinta OSCURO, sea cual sea el tema que el cliente tenga elegido.
// Pedido de Martín: «quiero que todo el onboarding sea en black mode». Las dos mitades
// hacen falta y no son un duplicado: el `<script>` corre antes del primer pintado (sin
// él hay un fogonazo blanco de pantalla completa) y el componente cliente cubre volver
// a esta ruta por navegación —donde no hay documento nuevo que parsear— y apagar el
// atributo al salir, para no dejarle la app oscura a quien no la eligió.
import { TemaOscuroScript } from '../_components/TemaOscuroScript';
import { TemaOscuro } from '../_components/TemaOscuro';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
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
  // ⚠️ El tema oscuro se prende SOLO en la rama del wizard. El hub de abajo es una
  // tab más de la app y tiene que respetar el tema que el cliente eligió: pintarlo
  // oscuro «de paso» sería el mismo error que ya se cometió con el laboratorio de
  // paletas, cuando un tema de prueba terminó aplicado sobre la app de un cliente.
  if (!done) return <><TemaOscuroScript /><TemaOscuro /><OnboardingWizard /></>;

  // Dueño / cliente ya onboardeado → el hub para cargar/editar el negocio.
  // DEFAULT: el editor embebido edita el funnel del negocio.
  // ⚠️ LA TARJETA DE ENTRADAS VA EN LOS TRES MONTAJES DEL EDITOR, no solo en /funnel.
  // `funnels.data.entradas` decide si un opt-in de FORMULARIO entra al CRM (la guarda de
  // app/api/track/optin/route.ts), y medido el 28/09/2026 estaba vacio en SEIS de los
  // workspaces con `declarado = true`: a todos ellos un formulario se les descartaria, y lo
  // unico que los salva hoy es la excepcion de Cal.com.
  //
  // La causa no era el dato: era que la UNICA pantalla donde se declara era /funnel, que no
  // esta en el nav. El editor se monta tambien aca, y lo montaba SIN la tarjeta, asi que
  // quien configuraba su funnel por el camino normal nunca veia la pregunta.
  const [cfg, diag] = await Promise.all([getFunnelDefault(), getDiagnosticoFase().catch(() => null)]);
  const { pipeline, suppressed, entradas, evento } = cfg;
  const funnelPanel = (
    <FunnelEditor
      embedded
      initialPipeline={pipeline}
      initialSuppressed={suppressed}
      encabezado={<EntradasCard initial={entradas} initialEvento={evento} canal={canalEfectivo(cfg.canal, diag?.canal)} />}
    />
  );

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="contexto" size={34} /></span>
        <h1 style={{ fontWeight: 600, fontSize: 42, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Onboarding</h1>
      </header>
      <OnboardingTabs funnelPanel={funnelPanel} tabInicial={tabDeUrl(tab)} />
    </main>
  );
}
