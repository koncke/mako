// =============================================================================
// /m/video-editor/<id> — el editor de UN proyecto en el teléfono (el editor de CapCut del celular)
// =============================================================================
// El MISMO proyecto del motor que abre escritorio (app/video-editor/[proyecto]/page.tsx), con la pantalla del
// teléfono (../EditorVideoM.tsx) a pantalla completa (../../_creacion/PantallaCompletaM.tsx), oscura como CapCut.
//
// Lo que la page de escritorio resuelve en el server, acá igual y por las MISMAS funciones:
//   · `?desde=<ref>` («Editar en el editor» de Video Generator y de AI Avatar): la ref se resuelve en el workspace de
//     la sesión con `resolverDesde`, y al cliente baja sólo `{ titulo, archivo, url }` (la url la arma el server);
//   · `?plantilla=<id>` («Utilizar plantilla»): el id se valida contra el catálogo (`plantillaPorId`).
// Quién: la MISMA puerta que escritorio, `requireRolWs([], { nav: 'video-editor' })`.
// =============================================================================

import '../video-editor.css';
import { requireMovil } from '@/lib/movil-guard';
import { plantillaPorId } from '@/lib/editor-video/plantillas';
import { resolverDesde } from '@/app/video-editor/desde/resolver';
import { CabeceraM, PantallaM } from '@/app/m/_ui';
import { PantallaCompletaM } from '../../_creacion/PantallaCompletaM';
import { EditorVideoEditorM } from '../ClienteVideoM';

export const dynamic = 'force-dynamic';

export default async function ProyectoPagina({ params, searchParams }: {
  params: Promise<{ proyecto: string }>;
  searchParams: Promise<{ desde?: string | string[]; plantilla?: string | string[] }>;
}) {
  const ctx = await requireMovil({ navKey: 'video-editor' });
  const [{ proyecto }, { desde, plantilla }] = await Promise.all([params, searchParams]);
  const origen = typeof desde === 'string' && desde ? await resolverDesde(desde) : undefined;
  const idPlantilla = typeof plantilla === 'string' && plantilla ? (plantillaPorId(plantilla)?.id ?? null) : undefined;
  return (
    <PantallaM>
      <CabeceraM titulo="Video Editor" trabajo />
      <PantallaCompletaM etiqueta="Video Editor" oscura>
        <EditorVideoEditorM ws={ctx.ws} proyectoId={proyecto} desde={origen} plantilla={idPlantilla} />
      </PantallaCompletaM>
    </PantallaM>
  );
}
