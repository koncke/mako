import { createRoot } from 'react-dom/client';
import { ExplorarCarruseles } from '@/app/image-editor/carruseles/ExplorarCarruseles';
import { filtrosDeQuery } from '@/lib/carruseles/explorar';
import { filtrosThumbnailDeQuery } from '@/lib/thumbnails/explorar';
import { datosDeEjemplo, idDeVideo, miniaturaSvg } from './datos';
import { PaginaCarrusel } from '@/app/image-editor/carruseles/MiniaturaCarrusel';
import { TIPOS_CARRUSEL } from '@/lib/carruseles/tipos';
import { documentoDeCarrusel } from '@/lib/carruseles/documento';

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
// /?p=ejemplos (19/11/2026): «Ver ejemplo» de cada tipo, con el PaginaCarrusel REAL y las letras del editor, para MIRAR si el titular
// tapa el texto (`?tipo=opinion` deja uno solo).
function Ejemplos() {
  const tipos = TIPOS_CARRUSEL.filter((t) => !q.get('tipo') || t.id === q.get('tipo'));
  let n = 0;
  return (
    <div style={{ padding: 12, display: 'grid', gap: 14, background: '#e9e9e6' }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=DM+Serif+Display&family=Fraunces:wght@700&family=Inter:wght@400;500;600;700&family=Montserrat:wght@800&family=Space+Grotesk:wght@500&display=block" />
      {tipos.map((t) => {
        const doc = documentoDeCarrusel({ laminas: t.ejemplo.laminas, estilo: t.estilo, marca: { nombre: t.ejemplo.negocio, usuario: t.ejemplo.usuario }, nuevoId: () => `b${++n}` });
        return (
          <div key={t.id}>
            <div style={{ font: '600 13px Inter, sans-serif', margin: '0 0 4px' }}>{t.id}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(doc.pages as Array<Record<string, unknown>>).map((p, i) => <PaginaCarrusel key={i} pagina={p} etiqueta="" style={{ width: Number(q.get('ancho') ?? 200), flex: 'none' }} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
createRoot(raiz).render(q.get('p') === 'ejemplos' ? <Ejemplos /> :
  <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
    <ExplorarCarruseles datos={datosDeEjemplo()} telefono={q.get('tel') === '1'} filtrosIniciales={filtrosDeQuery(q)} thumbnailsIniciales={filtrosThumbnailDeQuery(q)} />
  </div>,
);
