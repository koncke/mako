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

import { FunnelEditor } from '../funnel/FunnelEditor';
import { Pagina, PageHeader } from '@/app/_ui';
import { VistaCerebro } from './VistaCerebro';
import { requireRolWs } from '@/lib/tab-access';
import { getFunnel } from '@/lib/leads';
import { construirCerebro } from '@/lib/cerebro-grafo';
import { BotonExportar } from './BotonExportar';
import { BotonClaude } from './BotonClaude';
import { getAgenteToken } from '@/lib/agente-token';
import { getWorkspaceActual } from '@/lib/workspace';
import { TemaOscuro } from '@/app/_components/TemaOscuro';
import { TemaOscuroScript } from '@/app/_components/TemaOscuroScript';
import { APP_BASE_URL } from '@/lib/app-url';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SecondBrainPage() {
  await requireRolWs([], { nav: 'second-brain' });

  const [{ pipeline, suppressed }, cerebro] = await Promise.all([getFunnel(), construirCerebro()]);
  const funnelPanel = <FunnelEditor embedded initialPipeline={pipeline} initialSuppressed={suppressed} />;

  const ws = await getWorkspaceActual();
  const agenteToken = ws == null ? null : await getAgenteToken(ws).catch(() => null);
  // ⚠️ ACÁ SE ENTREGABA UNA SKILL ROTA. Esto leía `NEXT_PUBLIC_BASE_URL`, una variable
  // que NO EXISTE en ningún lado del repo ni de Vercel — las que existen son
  // `APP_BASE_URL` y `NEXT_PUBLIC_APP_URL`, y las dos las resuelve `lib/app-url.ts`.
  // Resultado: `appUrl` era SIEMPRE '' en producción y la skill salía con `BASE=`
  // vacío, así que lo primero que hacía Claude después de instalarla era pedirle la
  // URL al cliente. El síntoma aparecía en la terminal del usuario y la causa era un
  // nombre de variable inventado en este archivo. La regla de siempre: si un valor ya
  // tiene su módulo, no se lo vuelve a leer del entorno a mano.
  const appUrl = APP_BASE_URL;

  // ⚠️ `ancho="completo"` NO es opcional acá y no es un gusto: con el default el
  // contenido topa en 1280 y el lienzo queda MÁS CHICO que antes de este rediseño.
  // El manual de app/_ui lo dice textual: «completo es para lo que de verdad necesita
  // cada píxel: … un lienzo».
  return (
    <Pagina ancho="completo">
      {/* El mapa se pinta oscuro, y la PÁGINA con él: el pedido del dueño es que el
          lienzo no tenga un fondo distinto al de la página. La única forma de que sean
          el mismo color es que no haya dos colores. */}
      <TemaOscuroScript />
      <TemaOscuro />
      {/* ⚠️ EL HEADER LO ARMA `VistaCerebro`, NO ESTA PÁGINA. Los dos botones del header
          dependen de lo que el mapa está mostrando (exportar baja el recorte que estás
          viendo), y desde acá —un server component— no hay ningún estado que compartir.
          Es la misma razón por la que el resto de la pantalla vive ahí adentro. */}
      <VistaCerebro
        cerebro={cerebro}
        funnelPanel={funnelPanel}
        agenteToken={agenteToken}
        appUrl={appUrl}
      />
    </Pagina>
  );
}
