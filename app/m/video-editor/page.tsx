// =============================================================================
// /m/video-editor — «Video › Editor» en el teléfono: el inicio de CapCut del celular
// =============================================================================
// La tab de escritorio (app/video-editor, la copia de CapCut sobre OpenCut portado) destilada para el teléfono, con
// el MISMO motor y los MISMOS proyectos (los del navegador, separados por negocio). El inicio copia el de la app de
// CapCut para el celular: «Nuevo proyecto» grande arriba (abre la galería y arma el proyecto con los clips elegidos)
// y «Proyectos» en una lista (./InicioVideoM.tsx). Un proyecto se abre en el editor del teléfono (./[proyecto]),
// a pantalla completa, como CapCut.
//
// Hasta el 17/10/2026, un teléfono que abría /video-editor veía la cubierta «Esta pantalla se usa en la computadora»,
// y si entraba igual, el aviso del motor «Solo para computadora» (components/editor/mobile-gate.tsx).
//
// Quién: la MISMA puerta que escritorio, `requireRolWs([], { nav: 'video-editor' })` (app/video-editor/acceso.ts).
// Arriba, la barra de secciones de Video (Editor · Create with AI · Reels), con las que esa persona ve.
// =============================================================================

import './video-editor.css';
import { requireMovil } from '@/lib/movil-guard';
import { PantallaM } from '@/app/m/_ui';
import { SeccionesTabM } from '@/app/m/_ui/SeccionesTabM';
import { nombreTab, seccionesTabM, vistaDe } from '../_creacion/secciones';
import { InicioVideoEditorM } from './ClienteVideoM';

export const dynamic = 'force-dynamic';

export default async function VideoEditorPagina() {
  const ctx = await requireMovil({ navKey: 'video-editor' });
  const secciones = seccionesTabM('video', vistaDe(ctx));
  return (
    <PantallaM>
      <SeccionesTabM etiqueta={nombreTab('video')} secciones={secciones} activa="video-editor" />
      <InicioVideoEditorM ws={ctx.ws} />
    </PantallaM>
  );
}
