// La pantalla de /agency (AgencyApp REAL) con los datos de producción de /datos.json (leer-prod.mts). Sin base ni red:
// «Inspeccionar» contesta como la ruta de verdad (app/api/agencia/entrar): al cliente en pausa por la mensualidad, `pausa: 'falta-pagar'`.
//   /?cuenta=<ws> abre su ficha · /?tema=oscuro
import { createRoot } from 'react-dom/client';
import { AgencyApp } from '@/app/agency/AgencyApp';
import { avisoEnPausa } from '@/lib/agency-reglas';

const q = new URLSearchParams(window.location.search);
document.documentElement.setAttribute('data-tema', q.get('tema') === 'oscuro' ? 'oscuro' : 'claro');
const datos = await (await fetch('/datos.json')).json();
const enPausa = new Set<number>(datos.enPausa);
const realFetch = window.fetch.bind(window);
window.fetch = (async (u: RequestInfo | URL, i?: RequestInit) => {
  const url = String(u);
  if (!url.startsWith('/api/')) return realFetch(u, i);
  if (url.startsWith('/api/agencia/entrar')) {
    const ws = Number((JSON.parse(String(i?.body ?? '{}')) as { ws?: number }).ws);
    const c = datos.cartera.ok ? datos.cartera.cuentas.find((x: { ws: number }) => x.ws === ws) : null;
    if (enPausa.has(ws)) return new Response(JSON.stringify({ ok: false, pausa: 'falta-pagar', nombre: c?.nombre, error: avisoEnPausa(c?.nombre ?? '') }), { status: 409 });
    return new Response(JSON.stringify({ ok: false, error: '(banco) acá entraría a su cuenta' }), { status: 200 });
  }
  return new Response('{"ok":true}', { status: 200 });
}) as typeof fetch;

const cuenta = q.get('cuenta') ? Number(q.get('cuenta')) : null;
createRoot(document.getElementById('raiz')!).render(
  <AgencyApp cartera={datos.cartera} cuentaInicial={cuenta} leadNuevo={null} puedeAbrir superAdmin={false} perfil={null} mensualidad={datos.mensualidad} />,
);
