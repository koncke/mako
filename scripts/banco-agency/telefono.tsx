// La pantalla de /m/agency (AgencyM REAL) con los datos de producción de /datos.json. «Entrar a su cuenta» contesta como la ruta de verdad.
//   /telefono · /telefono?abrir=<ws> (su hoja abierta)
import '@/app/m/m.css';
import '@/app/m/agency/agency.css';
import { createRoot } from 'react-dom/client';
import { AgencyM } from '@/app/m/agency/AgencyM';

const q = new URLSearchParams(window.location.search);
document.documentElement.setAttribute('data-tema', q.get('tema') === 'oscuro' ? 'oscuro' : 'claro');
const datos = await (await fetch('/datos.json')).json();
const realFetch = window.fetch.bind(window);
window.fetch = ((u: RequestInfo | URL, i?: RequestInit) => (String(u).startsWith('/api/') ? Promise.resolve(new Response('{"ok":false,"error":"(banco) acá entraría"}', { status: 200 })) : realFetch(u, i))) as typeof fetch;
const abrir = q.get('abrir') ? Number(q.get('abrir')) : null;

createRoot(document.getElementById('raiz')!).render(
  // `data-m`: lo pone el marco de MaKo Mobile (app/m/layout.tsx).
  <div data-m="" style={{ minHeight: '100vh', background: 'var(--bg)', padding: '12px 16px', boxSizing: 'border-box' }}>
    <AgencyM cuentas={datos.cartera.ok ? datos.cartera.cuentas : []} puedeAbrir superAdmin={false} cuentaInicial={abrir} enPausa={datos.enPausa} />
    <div id="m-capas" />
  </div>,
);
