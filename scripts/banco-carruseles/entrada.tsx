import { createRoot } from 'react-dom/client';
import { ExplorarCarruseles } from '@/app/image-editor/carruseles/ExplorarCarruseles';
import { datosDeEjemplo } from './datos';

const q = new URLSearchParams(window.location.search);
document.documentElement.setAttribute('data-tema', q.get('tema') === 'oscuro' ? 'oscuro' : 'claro');
const raiz = document.getElementById('raiz')!;
createRoot(raiz).render(
  <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
    <ExplorarCarruseles datos={datosDeEjemplo()} telefono={q.get('tel') === '1'} />
  </div>,
);
