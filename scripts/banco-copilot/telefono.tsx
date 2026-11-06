// El teléfono del Marketing CoPilot en el banco (6/11/2026): la pantalla REAL de /m/ads (MediaBuyerM) con datos inventados.
//   /telefono            → Hoy, con «Hoy | Plan» (un funnel de anuncios elegido)
//   /telefono?plan=1     → el Plan
//   /telefono?hoja=1     → la hoja del CoPilot abierta (el chat con `desde.tab = 'Marketing CoPilot'`)
//   /telefono?antes=1    → un negocio de antes, sin charla: sólo Hoy
import '@/app/m/m.css';
import '@/app/ads-manager/aa.css';
import '@/app/m/ads/mb-m.css';
import { createRoot } from 'react-dom/client';
import { MediaBuyerM } from '@/app/m/ads/MediaBuyerM';
import type { PerfilCopiloto } from '@/lib/media-buyer/copiloto';
import { configDeEjemplo } from './datos';

const q = new URLSearchParams(window.location.search);
document.documentElement.setAttribute('data-tema', q.get('tema') === 'oscuro' ? 'oscuro' : 'claro');
const realFetch = window.fetch.bind(window);
window.fetch = ((u: RequestInfo | URL, i?: RequestInit) => (String(u).startsWith('/api/') ? Promise.resolve(new Response('{"ok":true}', { status: 200 })) : realFetch(u, i))) as typeof fetch;
const VSL: PerfilCopiloto = { entrada: 'funnel', funnel: 'vsl-llamada', ticket: 5000, presupuestoMes: 3000, llamadas: 'yo', competencia: 'si', aceptado: true };
const config = { ...configDeEjemplo(), ultimaCorrida: '2026-11-06T09:00:00Z', ultimaCorridaInfo: { campanas: 6 } } as never;

function App() {
  return (
    // `data-m`: lo pone el marco de MaKo Mobile (app/m/layout.tsx), y la caja del chat lo necesita (operaciones.css).
    <div data-m="" style={{ minHeight: '100vh', background: 'var(--bg)', padding: '12px 16px', boxSizing: 'border-box' }}>
      <MediaBuyerM config={config} decisiones={[]} puedeOperar productoDe={{}} conectada perfil={q.get('antes') ? null : VSL} />
      <div id="m-capas" />
    </div>
  );
}
createRoot(document.getElementById('raiz')!).render(<App />);
if (q.get('plan')) setTimeout(() => (document.querySelector('.m-seg button:nth-child(2), .m-seg a:nth-child(2)') as HTMLElement | null)?.click(), 300);
if (q.get('hoja')) setTimeout(() => (document.querySelector('.aa-orden-m') as HTMLElement | null)?.click(), 300);
