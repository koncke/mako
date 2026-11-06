// =============================================================================
// /m/image-editor — «Image» en el teléfono: los EJEMPLOS (la portada, como en la computadora) y, en «Crear desde cero», tus
// diseños y «Nuevo diseño»
// =============================================================================
// Martín, 6/11/2026: «La tab de "Encuentra tu siguiente OUTLIER" tiene que ser la principal… también en celular». Sin `?ver=`,
// los ejemplos (carruseles, anuncios y miniaturas de YouTube: app/image-editor/carruseles/ExplorarCarruseles.tsx); con
// `?ver=crear`, lo de abajo; `?ver=carruseles` (el link de antes) redirige a la portada con sus filtros.
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
import { redirect } from 'next/navigation';
import { requireMovil } from '@/lib/movil-guard';
import { rutaConWs } from '@/lib/workspace';
import { filtrosThumbnailDeQuery } from '@/lib/thumbnails/explorar';
import { leerThumbnails } from '@/lib/thumbnails/servidor';
import { querySinVer, vistaDeImage } from '@/app/image-editor/ruta';
import { listarDisenos } from '@/lib/image-editor/server';
import { ErrorM, PantallaM } from '@/app/m/_ui';
import { InicioImagenM } from './InicioImagenM';
import { leerExplorador } from '@/lib/carruseles/explorar-servidor';
import { filtrosDeQuery } from '@/lib/carruseles/explorar';
import { ExplorarCarruseles } from '@/app/image-editor/carruseles/ExplorarCarruseles';
import { nombreDelNegocio } from '@/lib/carruseles/marca';

export const dynamic = 'force-dynamic';

export default async function ImageEditorPagina({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireMovil({ navKey: 'image-editor' });
  // Los ejemplos (la portada desde el 6/11/2026): la MISMA vista de la computadora (app/image-editor/carruseles), con sus filtros
  // y «Editar», que arma la versión del negocio y abre el MISMO editor (./[diseno]).
  const q = await searchParams;
  const vista = vistaDeImage(q);
  if (vista === 'redirigir') { const resto = querySinVer(q); redirect(await rutaConWs(resto ? `/m/image-editor?${resto}` : '/m/image-editor')); }
  if (vista === 'ejemplos') {
    const [e, t] = ctx.ws == null ? [null, null] : await Promise.all([leerExplorador(), leerThumbnails()]);
    return (
      <PantallaM>
        {e && e.ok
          ? <ExplorarCarruseles telefono filtrosIniciales={filtrosDeQuery(q)} thumbnailsIniciales={filtrosThumbnailDeQuery(q)} rutaCrear="/m/image-editor?ver=crear"
            datos={{
              carruseles: e.carruseles, guardados: e.guardados.map((g) => g.id), busquedas: e.busquedas, paso: e.paso, frase: e.frase, accion: e.accion, ejemplos: e.ejemplos, avisoBiblioteca: e.avisoBiblioteca, anuncios: e.anuncios,
              thumbnails: t && t.ok ? { ok: true, lista: t.thumbnails, guardados: t.guardados, sinTablas: t.sinTablas } : { ok: false },
            }} />
          : <ErrorM frase="No pude leer los ejemplos. Es un problema nuestro: vuelve a intentar." />}
      </PantallaM>
    );
  }
  const [r, negocio] = await Promise.all([
    ctx.ws == null ? { ok: false as const, error: 'Abre el editor desde un negocio.' } : listarDisenos(ctx.ws),
    nombreDelNegocio(ctx.ws),
  ]);
  return (
    <PantallaM>
      {r.ok
        ? <InicioImagenM disenos={r.disenos} negocio={negocio} />
        : <ErrorM frase="No se pudieron leer tus diseños. Es un problema nuestro: vuelve a intentar." />}
    </PantallaM>
  );
}
