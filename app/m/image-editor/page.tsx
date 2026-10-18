// =============================================================================
// /m/image-editor — «Image › Editor» en el teléfono: el inicio de Canva (tus diseños y crear uno)
// =============================================================================
// La tab de escritorio (app/image-editor, la copia de Canva sobre Doory) destilada. Su inicio en el teléfono copia
// el de la app de Canva para el celular: la barra de secciones de Image arriba, el buscador, «Diseños recientes» en
// una grilla de dos columnas con su miniatura, y el «+» flotante abajo a la derecha que abre «Crear un diseño» con
// los tamaños más usados. Un diseño se abre en el MISMO editor (./[diseno]), a pantalla completa, como Canva.
//
// Los datos son los de escritorio y por el MISMO camino: la lista sale de lib/image-editor/server.ts
// (`listarDisenos`, la tabla de la mig 0278); crear y borrar, de ./actions.ts (la misma puerta y la misma validación
// que /api/image-editor/disenos).
// Lo que no viene del inicio de escritorio: los círculos por tipo con todos sus tamaños, «Tamaño personalizado» y la
// vista en lista (la grilla es la de Canva en el teléfono). Se crea con los seis tamaños que la API de MaKo ofrece
// por nombre (lib/image-editor/tamanos.ts); los demás, en la computadora.
//
// Quién: la MISMA puerta que escritorio, `requireRolWs([], { nav: 'image-editor' })` (app/image-editor/acceso.ts).
// =============================================================================

import './image-editor.css';
import { requireMovil } from '@/lib/movil-guard';
import { listarDisenos } from '@/lib/image-editor/server';
import { TAMANOS_API } from '@/lib/image-editor/tamanos';
import { ComputadoraM, ErrorM, PantallaM } from '@/app/m/_ui';
import { SeccionesTabM } from '@/app/m/_ui/SeccionesTabM';
import { vistaDe } from '../_creacion/secciones';
import { InicioImagenM } from './InicioImagenM';

export const dynamic = 'force-dynamic';

export default async function ImageEditorPagina() {
  const ctx = await requireMovil({ navKey: 'image-editor' });
  const r = ctx.ws == null ? { ok: false as const, error: 'Abre el editor desde un negocio.' } : await listarDisenos(ctx.ws);
  const tamanos = Object.entries(TAMANOS_API).map(([id, t]) => ({ id, nombre: t.nombre, ancho: t.ancho, alto: t.alto }));
  return (
    <PantallaM>
      <SeccionesTabM tab="image" activa="image-editor" vista={vistaDe(ctx)} />
      {r.ok
        ? <InicioImagenM disenos={r.disenos} tamanos={tamanos} />
        : <ErrorM frase="No se pudieron leer tus diseños. Es un problema nuestro: vuelve a intentar." />}
      <ComputadoraM que="Otros tamaños y tamaño personalizado" />
    </PantallaM>
  );
}
