'use client';

// La vista del presentador de Doory en el navegador (sin SSR: usa BroadcastChannel y
// `window`). La sesión llega en `?session=`; la vista la valida (isSessionId) y, si
// falta o no sirve, lo dice ella misma. Raíz `.cv` como el editor, para sus tokens.

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { FuenteUi } from '../fuenteUi';
import '../_doory/styles/tokens.css';
import '../_doory/styles/global.css';

const PresenterView = dynamic(() => import('../_doory/editor/presenter/view/PresenterView').then((m) => m.PresenterView), { ssr: false });

export function PresentadorCliente() {
  const session = useSearchParams().get('session');
  return (
    <div className="cv" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <FuenteUi />
      <PresenterView session={session} />
    </div>
  );
}
