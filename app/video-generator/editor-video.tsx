'use client';

// =============================================================================
// ¿Se ofrece «Editar en el editor»? — lo decide el server, lo lee cada botón
// =============================================================================
// El Video Editor hoy lo abre SÓLO el super admin (app/video-editor/acceso.ts).
// Un botón que se le muestra a todos y rebota a la mitad es peor que ninguno, así
// que la page de /video-generator pregunta lo MISMO que el guard del editor
// (`veEditorVideo`) y lo baja por contexto. Por contexto y no por props: los dos
// botones viven en pantallas distintas (el último paso del wizard y el modal de
// «Anuncios terminados»), y el del wizard está tres componentes más abajo.
//
// Sin provider vale false: la rama de la agencia sin workspace no lo monta y no
// ofrece nada.

import { createContext, useContext, type ReactNode } from 'react';
import { ButtonLink } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { leerRefDesde, rutaEditarEnEditor } from '@/app/video-editor/desde/desde';

const Ctx = createContext(false);

export function EditorVideoDisponible({ si, children }: { si: boolean; children: ReactNode }) {
  return <Ctx.Provider value={si}>{children}</Ctx.Provider>;
}

/**
 * «Editar en el editor»: abre el anuncio en un proyecto nuevo del Video Editor.
 * `refVideo` NOMBRA el video (`montaje:<id>`, `anuncio:<id>`); la url la vuelve a
 * armar el server del editor. Va por `ButtonLink`, que es el Link de la casa:
 * lleva el `?ws=` puesto (un link pelado abriría el editor en la cuenta propia).
 */
export function BotonEditarEnEditor({ refVideo, size }: { refVideo: string; size?: 'lg' }) {
  const disponible = useContext(Ctx);
  // Una ref que el editor no acepta (un id de anuncio con una barra, un montaje sin
  // id) abriría «Ese anuncio ya no está» sobre un anuncio que está: no se ofrece.
  if (!disponible || !leerRefDesde(refVideo)) return null;
  return (
    <ButtonLink href={rutaEditarEnEditor(refVideo)} variant="secondary" size={size} icon={<Icon name="tijera" size={17} />}>
      Editar en el editor
    </ButtonLink>
  );
}
