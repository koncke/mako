import '@/app/ads-manager/aa.css';
import { createRoot } from 'react-dom/client';
import { PrimeraEntrada } from '@/app/ads-manager/PrimeraEntrada';
import { SinAnuncios, SeccionPlan } from '@/app/ads-manager/PlanDelCopiloto';

// Sin base ni red: el guardado responde que sí. /?perfil=<json> arranca la charla en ese punto; /?tema=oscuro.
const q = new URLSearchParams(window.location.search);
document.documentElement.setAttribute('data-tema', q.get('tema') === 'oscuro' ? 'oscuro' : 'claro');
const realFetch = window.fetch.bind(window);
window.fetch = ((u: RequestInfo | URL, i?: RequestInit) => (String(u).startsWith('/api/') ? Promise.resolve(new Response('{"ok":true}', { status: 200 })) : realFetch(u, i))) as typeof fetch;
let inicial = {};
try { inicial = JSON.parse(q.get('perfil') ?? '{}'); } catch { /* sin perfil */ }
createRoot(document.getElementById('raiz')!).render(
  <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 20, boxSizing: 'border-box' }}>
    {q.get('pantalla') === 'sin' ? <SinAnuncios perfil={{ ...inicial, aceptado: true }} />
      : q.get('pantalla') === 'plan' ? <div className="aa"><div className="aa-pagina"><SeccionPlan perfil={{ ...inicial, aceptado: true }} /></div></div>
      : <PrimeraEntrada nombre="Martín" inicial={inicial} />}
  </div>,
);
