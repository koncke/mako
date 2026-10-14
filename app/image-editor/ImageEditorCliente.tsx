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
// (_doory/styles/tokens.css, prefijados `--cv-`) y sus estilos base
// (_doory/styles/global.css), limitados a esa clase para no tocar el resto de
// MaKo. Los menús y diálogos de Doory se montan adentro de la raíz del editor
// (EditorProvider → `portalRoot`), así que heredan los tokens solos.
//
// La letra de la interfaz es Noto Sans, como la variable `--cv-font-ui`
// (./fuenteUi.ts, que comparte con la ventana del presentador).

import dynamic from 'next/dynamic';
import { notoSans } from './fuenteUi';
import './_doory/styles/tokens.css';
import './_doory/styles/global.css';

const Inicio = dynamic(() => import('./inicio/Inicio').then((m) => m.Inicio), { ssr: false });
const PantallaEditor = dynamic(() => import('./editor/PantallaEditor').then((m) => m.PantallaEditor), { ssr: false });

export function ImageEditorCliente({ vista, disenoId, ws }: { vista: 'inicio' | 'editor'; disenoId?: string; ws: number | null }) {
  const editor = vista === 'editor' && !!disenoId;
  return (
    <div
      key={ws ?? 0}
      className={`cv ${notoSans.variable}`}
      style={editor
        ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
        : { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}
    >
      {editor ? <PantallaEditor disenoId={disenoId} ws={ws} /> : <Inicio ws={ws} />}
    </div>
  );
}
