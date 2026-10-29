'use client';

// =============================================================================
// El Video Editor del teléfono del lado del navegador: la puerta al motor
// =============================================================================
// El motor (OpenCut portado, app/video-editor/_opencut) usa `window`, IndexedDB, OPFS, WebGPU/WebGL2 y un .wasm:
// nada de eso existe en el server. Entra, como en escritorio (app/video-editor/VideoEditorCliente.tsx), por un
// `dynamic(..., { ssr: false })` que tiene que vivir en un módulo cliente: éste.
//
// ⚠️ EL ESPACIO LOCAL SE FIJA ANTES DE QUE EL MOTOR ABRA UNA SOLA BASE (`fijarEspacio`, app/video-editor/espacio.ts):
// los proyectos de cada negocio viven separados en el navegador. Y si la pestaña cambia de negocio sin recargar, el
// EditorCore (un singleton) se reinicia: si no, seguiría con el proyecto del negocio anterior. Lo mismo que hace
// VideoEditorCliente; lo copia la lógica, no el código, porque allá vive adentro del componente de escritorio.
// =============================================================================

import dynamic from 'next/dynamic';
import { useRef } from 'react';
import { fijarEspacio } from '@/app/video-editor/espacio';
import type { DesdeEditor } from '@/app/video-editor/desde/desde';
import type { SenalesNegocio } from '@/lib/plantillas-sugeridas';
import { SkeletonFilas } from '@/app/m/_ui';

const InicioVideoM = dynamic(() => import('./InicioVideoM').then((m) => m.InicioVideoM), {
  ssr: false,
  loading: () => <SkeletonFilas filas={4} />,
});
const EditorVideoM = dynamic(() => import('./EditorVideoM').then((m) => m.EditorVideoM), { ssr: false });

/** Fija el espacio del negocio y reinicia el motor si cambió (ver arriba). */
function useEspacio(ws: number | null) {
  const previo = useRef<number | null | undefined>(undefined);
  if (previo.current !== ws) {
    if (previo.current !== undefined) void import('@/app/video-editor/_opencut/core').then((m) => m.EditorCore.reset());
    fijarEspacio(ws);
    previo.current = ws;
  }
}

export function InicioVideoEditorM({ ws, senales = null }: { ws: number | null; senales?: SenalesNegocio | null }) {
  useEspacio(ws);
  return <InicioVideoM key={ws ?? 0} senales={senales} />;
}

export function EditorVideoEditorM({ ws, proyectoId, desde, plantilla }: {
  ws: number | null;
  proyectoId: string;
  desde?: DesdeEditor;
  plantilla?: string | null;
}) {
  useEspacio(ws);
  return <EditorVideoM key={ws ?? 0} proyectoId={proyectoId} desde={desde} plantilla={plantilla} />;
}
