// =============================================================================
// /image-editor/presentador — la ventana de «Presentar con notas»
// =============================================================================
// Doory abre la vista del presentador en una SEGUNDA ventana (notas, reloj, la
// diapositiva siguiente) y le habla por un BroadcastChannel, sin server: las dos
// ventanas son del mismo origen. En Doory era `presenter-view.html`, una página
// aparte de su build de Vite; en MaKo esa página no existía y el botón abría un 404
// (docs/hallazgos-editor-imagen.md). Ésta es su lugar: la misma vista, montada por
// Next. La URL la arma `presenterViewUrl` (_doory/editor/presenter/channel.ts).
//
// Va SIN la cáscara de MaKo (app/_components/PublicRouteGate.tsx → esVistaSinChrome):
// es una ventana chica que sólo se mira mientras se presenta, como
// /integraciones/escuchando. Y con el mismo guard que el editor: no lee datos, pero
// es una pantalla del editor.

import { requireEditorImagen } from '../acceso';
import { PresentadorCliente } from './PresentadorCliente';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PresentadorPage() {
  await requireEditorImagen();
  return <PresentadorCliente />;
}
