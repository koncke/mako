'use client';

// =============================================================================
// El Image Editor del lado del navegador
// =============================================================================
// Monta el motor portado de Doory sin SSR: usa `window`, IndexedDB, fabric.js
// (canvas) y workers, y nada de eso existe en el server. El `dynamic(..., { ssr:
// false })` tiene que vivir en un client component, por eso este archivo existe
// (molde: app/video-editor/VideoEditorCliente.tsx).
//
// La raíz lleva la clase `.cv`: ahí viven los tokens del editor
// (_doory/styles/tokens.css, prefijados `--cv-`, que desde el 27/10/2026 SON los de la app: claro, oscuro y Nord) y sus
// estilos base (_doory/styles/global.css), limitados a esa clase para no tocar el resto de
// MaKo. Los menús y diálogos de Doory se montan adentro de la raíz del editor
// (EditorProvider → `portalRoot`), así que heredan los tokens solos.
//
// Desde el 27/10/2026 las dos rutas montan LO MISMO: el estudio (editor/Estudio.tsx), que abre un diseño, cambia a otro
// o muestra la vista de crear sin navegar. `/image-editor/<id>` le pasa el id; `/image-editor` sola, ninguno (abre el
// último editado, o la vista de crear). `vista` queda por compatibilidad (el teléfono la manda) y ya no decide nada.
//
// La letra de la interfaz es Noto Sans, por la hoja de Google de ./fuenteUi.tsx (no por next/font:
// ver ahí por qué), que comparte con la ventana del presentador.

import dynamic from 'next/dynamic';
import type { SenalesNegocio } from '@/lib/plantillas-sugeridas';
import { FuenteUi } from './fuenteUi';
import './_doory/styles/tokens.css';
import './_doory/styles/global.css';

const Estudio = dynamic(() => import('./editor/Estudio').then((m) => m.Estudio), { ssr: false });

export function ImageEditorCliente({ disenoId, ws, senales = null }: {
  /** @deprecated Ya no decide: el estudio abre el diseño de `disenoId`, o el último, o la vista de crear. */
  vista?: 'inicio' | 'editor';
  disenoId?: string;
  ws: number | null;
  /** Lo que se sabe del negocio: el panel de plantillas pone primero las sugeridas (mako/plantillas.ts). */
  senales?: SenalesNegocio | null;
}) {
  return (
    <div key={ws ?? 0} className="cv" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <FuenteUi />
      <Estudio disenoId={disenoId ?? null} ws={ws} senales={senales} />
    </div>
  );
}
