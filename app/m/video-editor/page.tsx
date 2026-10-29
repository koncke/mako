// =============================================================================
// /m/video-editor — la tab Video en el teléfono: «Nuevo video» y los proyectos de este teléfono
// =============================================================================
// La tab de escritorio (app/video-editor, la copia de CapCut sobre OpenCut portado) destilada para el teléfono, con
// el MISMO motor y los MISMOS proyectos (los del navegador, separados por negocio). Arriba, «Nuevo video», que abre
// «¿Qué vas a crear hoy?» con las MISMAS plantillas que la computadora (app/video-editor/plantillas-crear.ts), y abajo
// «Proyectos» en una lista (./InicioVideoM.tsx). Un proyecto se abre en el editor del teléfono (./[proyecto]), a
// pantalla completa, como CapCut.
//
// Sin la barra de secciones de arriba (Editor · Create with AI · Reels) desde el 29/10/2026 (Martín: «para todas las
// secciones de "create" no quiero otras tabs», «En la computadora Y en el teléfono»): el Video Generator es la tarjeta
// «Generar con IA» de «Nuevo video».
//
// Hasta el 17/10/2026, un teléfono que abría /video-editor veía la cubierta «Esta pantalla se usa en la computadora»,
// y si entraba igual, el aviso del motor «Solo para computadora» (components/editor/mobile-gate.tsx).
//
// Quién: la MISMA puerta que escritorio, `requireRolWs([], { nav: 'video-editor' })` (app/video-editor/acceso.ts).
// =============================================================================

import './video-editor.css';
import { requireMovil } from '@/lib/movil-guard';
import { senalesDelNegocio } from '@/lib/plantillas-sugeridas-server';
import { PantallaM } from '@/app/m/_ui';
import { InicioVideoEditorM } from './ClienteVideoM';

export const dynamic = 'force-dynamic';

export default async function VideoEditorPagina() {
  const ctx = await requireMovil({ navKey: 'video-editor' });
  // Después de la puerta: lo del negocio no se lee para quien no entra.
  const senales = await senalesDelNegocio().catch(() => null);
  return (
    <PantallaM>
      <InicioVideoEditorM ws={ctx.ws} senales={senales} />
    </PantallaM>
  );
}
