// =============================================================================
// /m/image-editor — «Image» en el teléfono: tus diseños y «Nuevo diseño»
// =============================================================================
// La tab de escritorio (app/image-editor, la copia de Canva sobre Doory) destilada: el buscador, «Diseños recientes» en
// una grilla de dos columnas con su miniatura y el «+» flotante abajo a la derecha, «Nuevo diseño», que abre
// «¿Qué vas a crear hoy?» con las MISMAS plantillas de la computadora (app/image-editor/plantillas-crear.ts) y crea por la
// MISMA acción (app/image-editor/actions.ts). Un diseño se abre en el MISMO editor (./[diseno]), a pantalla completa.
//
// Los datos son los de escritorio y por el MISMO camino: la lista sale de lib/image-editor/server.ts (`listarDisenos`,
// la tabla de la mig 0278); borrar, de ./actions.ts (la misma puerta y la misma tabla que /api/image-editor/disenos).
// Sin barra de secciones: Image es UNA pantalla desde el 29/10/2026 (app/_components/nav.ts, Create sin `secciones`).
//
// Quién: la MISMA puerta que escritorio, `requireRolWs([], { nav: 'image-editor' })` (app/image-editor/acceso.ts).
// =============================================================================

import './image-editor.css';
import { requireMovil } from '@/lib/movil-guard';
import { listarDisenos } from '@/lib/image-editor/server';
import { ErrorM, PantallaM } from '@/app/m/_ui';
import { InicioImagenM } from './InicioImagenM';

export const dynamic = 'force-dynamic';

export default async function ImageEditorPagina() {
  const ctx = await requireMovil({ navKey: 'image-editor' });
  const r = ctx.ws == null ? { ok: false as const, error: 'Abre el editor desde un negocio.' } : await listarDisenos(ctx.ws);
  return (
    <PantallaM>
      {r.ok
        ? <InicioImagenM disenos={r.disenos} />
        : <ErrorM frase="No se pudieron leer tus diseños. Es un problema nuestro: vuelve a intentar." />}
    </PantallaM>
  );
}
