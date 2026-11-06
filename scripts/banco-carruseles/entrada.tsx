import { createRoot } from 'react-dom/client';
import { ExplorarCarruseles } from '@/app/image-editor/carruseles/ExplorarCarruseles';
import { filtrosDeQuery } from '@/lib/carruseles/explorar';
import { filtrosThumbnailDeQuery } from '@/lib/thumbnails/explorar';
import { datosDeEjemplo, idDeVideo, miniaturaSvg } from './datos';

const q = new URLSearchParams(window.location.search);
document.documentElement.setAttribute('data-tema', q.get('tema') === 'oscuro' ? 'oscuro' : 'claro');
// Las miniaturas de YouTube del banco son inventadas: la tarjeta pide la de i.ytimg.com y acá se cambia por la dibujada.
const MINI = new Map(Array.from({ length: 40 }, (_, i) => [idDeVideo(i + 1), miniaturaSvg(i)]));
const cambiar = (img: HTMLImageElement) => {
  const m = /^https:\/\/i\.ytimg\.com\/vi\/([^/]+)\//.exec(img.getAttribute('src') ?? '');
  if (m && MINI.has(m[1])) img.setAttribute('src', MINI.get(m[1])!);
};
new MutationObserver(() => document.querySelectorAll('img').forEach((i) => cambiar(i as HTMLImageElement))).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
const raiz = document.getElementById('raiz')!;
createRoot(raiz).render(
  <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
    <ExplorarCarruseles datos={datosDeEjemplo()} telefono={q.get('tel') === '1'} filtrosIniciales={filtrosDeQuery(q)} thumbnailsIniciales={filtrosThumbnailDeQuery(q)} />
  </div>,
);
