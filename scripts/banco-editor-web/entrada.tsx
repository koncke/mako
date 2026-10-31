// @ts-nocheck: es un banco, no entra en la app.
import { createRoot } from 'react-dom/client';
import '@/app/web-generator/gamma.css';
import EditorLanding from '@/app/web-generator/editor/EditorLanding';
import { CONFIG_DEFAULT } from '@/lib/editor-landing/api-tipos';

declare global { interface Window { __nav: string[]; __pedidos: unknown[] } }
window.__nav = [];
window.__pedidos = [];

const params = new URLSearchParams(location.search);
const LARGO = 'Landing de prueba del banco con un título bien largo para medirlo';

const tarjeta = (id: string, content: unknown[], attrs: Record<string, unknown> = {}) => ({ type: 'tarjeta', attrs: { id, ...attrs }, content });
const docSimple = {
  type: 'doc',
  content: [
    tarjeta('t1', [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Título de la primera sección' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Un párrafo de prueba para ver el lienzo.' }] }]),
    tarjeta('t2', [{ type: 'heading', attrs: { level: 2 } }, { type: 'paragraph' }]),
    tarjeta('t3', [{ type: 'paragraph' }]),
  ],
};

async function arrancar() {
  let contenido: unknown = { v: 1, paginas: [{ id: 'p1', titulo: 'Inicio', ruta: '', doc: docSimple }] };
  if (params.get('doc')) {
    const r = await (globalThis as { __fetchReal: typeof fetch }).__fetchReal(`/${params.get('doc')}.json`).then((x) => x.json());
    contenido = r.contenido;
  }
  const doc = {
    id: 88, titulo: params.get('corto') ? 'Landing' : LARGO, contenido, config: CONFIG_DEFAULT, version: 1, slug: null, publicadoAt: null,
    cambiosSinPublicar: false, sitioActivo: false, urlPublica: params.get('publicada') ? 'https://hola-mako.site/prueba' : null, baseLandings: 'https://hola-mako.site',
    creado: '2026-10-01T00:00:00Z', actualizado: '2026-10-30T00:00:00Z', favorito: false, creadoPor: 'Banco',
  };
  createRoot(document.getElementById('app')!).render(
    <div style={{ display: 'flex', height: '100dvh' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <EditorLanding doc={doc as never} temasPropios={[]} creadoPor="Banco" autor="Banco" analizadas={[]} errorAnalizadas={null} bases={['https://hola-mako.site']} />
      </div>
    </div>,
  );
}

const real = window.fetch.bind(window);
(globalThis as { __fetchReal?: typeof fetch }).__fetchReal = real;
window.fetch = (async (u: RequestInfo | URL, init?: RequestInit) => {
  const url = String(u);
  if (/\.[a-z0-9]{2,5}(\?|$)/i.test(url) && !url.includes('/api/')) return real(u, init);
  let cuerpo: Record<string, unknown> = {};
  try { cuerpo = init?.body ? JSON.parse(String(init.body)) : {}; } catch { /* multipart */ }
  window.__pedidos.push({ url, accion: cuerpo.accion });
  const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200, headers: { 'content-type': 'application/json' } });
  if (url.includes('/api/landing-generator')) {
    if (cuerpo.accion === 'listar') {
      return json({ ok: true, docs: [
        { id: 88, titulo: LARGO, actualizado: '2026-10-30T00:00:00Z', creado: '2026-10-01T00:00:00Z', publicadoAt: null, slug: null, favorito: false, carpeta: null, papelera: false },
        { id: 89, titulo: 'Otra landing', actualizado: '2026-10-29T00:00:00Z', creado: '2026-10-01T00:00:00Z', publicadoAt: null, slug: null, favorito: false, carpeta: null, papelera: false },
      ] });
    }
    return json({ ok: true, version: 2, cambiosSinPublicar: false, url: 'http://127.0.0.1:4577/x' });
  }
  return json({ ok: true, mensajes: [], items: [], lista: [] });
}) as typeof fetch;

void arrancar();
