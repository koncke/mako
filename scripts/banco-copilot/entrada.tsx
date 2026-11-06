import '@/app/ads-manager/aa.css';
import { createRoot } from 'react-dom/client';
import { PrimeraEntrada } from '@/app/ads-manager/PrimeraEntrada';
import { SinAnuncios, SeccionPlan } from '@/app/ads-manager/PlanDelCopiloto';
import { LienzoCampanas } from '@/app/ads-manager/Lienzo';
import { Criatura } from '@/app/_components/Criatura';
import { Ajustes } from '@/app/ads-manager/Ajustes';
import { lienzoDeEjemplo, configDeEjemplo } from './datos';

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
      : q.get('pantalla') === 'lienzo' ? <div className="aa"><LienzoCampanas kpi="agenda" objetivo={q.get('sinobj') ? null : 30} abiertas={[]} productoInicial={q.get('producto')} avatar={<Criatura nombre="MaKo" size={18} estrella />} onVerAcciones={() => {}} show={() => {}}
          inicial={lienzoDeEjemplo(q.get('caso') ?? 'mauricio')} mes={{ texto: 'Este mes: $4,820 gastados · 96 agendas · $50 por agenda', tono: null }} fechas={{ hasta: null, hastaCampanas: {} }} /></div>
      : q.get('pantalla') === 'ajustes' ? <Ajustes config={configDeEjemplo() as never} cupo={{ piloto: true, recomendacionesDia: null } as never} perfil={{ ...inicial, aceptado: true }} />
      : q.get('pantalla') === 'plan' ? <div className="aa"><div className="aa-pagina"><SeccionPlan perfil={{ ...inicial, aceptado: true }} /></div></div>
      : <PrimeraEntrada nombre="Martín" inicial={inicial} />}
  </div>,
);
