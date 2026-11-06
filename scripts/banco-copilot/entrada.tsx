import '@/app/ads-manager/aa.css';
import { createRoot } from 'react-dom/client';
import { PrimeraEntrada } from '@/app/ads-manager/PrimeraEntrada';
import { SinAnuncios, SeccionPlan } from '@/app/ads-manager/PlanDelCopiloto';
import { LienzoCampanas } from '@/app/ads-manager/Lienzo';
import { MediaBuyer } from '@/app/ads-manager/MediaBuyer';
import { Criatura } from '@/app/_components/Criatura';
import { Ajustes } from '@/app/ads-manager/Ajustes';
import { lienzoDeEjemplo, configDeEjemplo } from './datos';

// Sin base ni red. /?perfil=<json> arranca la charla en ese punto; /?tema=oscuro; /?barra=abierta|plegada|ninguna (la barra de la app,
// 244 o 68 px: la pantalla vive al lado, como en el layout de verdad, sin un fondo propio del banco); /?sinia=1 (el turno contesta
// «Conecta tu IA», como un negocio sin su IA); /?pantalla=mb&vista=hoy|campanas|biblioteca|plan (la pantalla de siempre).
const q = new URLSearchParams(window.location.search);
document.documentElement.setAttribute('data-tema', q.get('tema') === 'oscuro' ? 'oscuro' : 'claro');
const json = (o: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } }));
const SESION = { id: 7, titulo: 'Cerebro', creado: '2026-11-06T10:00:00Z', actualizado: '2026-11-06T10:00:00Z' };
const realFetch = window.fetch.bind(window);
window.fetch = (async (u: RequestInfo | URL, i?: RequestInit) => {
  const url = String(u);
  if (!url.startsWith('/api/')) return realFetch(u, i);
  // El chat del Cerebro: el que contesta lo escrito en la charla (MotorDelCopiloto).
  if (url.startsWith('/api/mako/chat')) {
    if (url.includes('sesiones=1')) return json({ ok: true, sesiones: [] });
    if (url.includes('sessionId=')) return json({ ok: true, sesion: SESION, mensajes: [], propuestas: [], pantallas: [] });
    const b = i?.body && typeof i.body === 'string' ? JSON.parse(i.body) as { action?: string; mensaje?: string } : {};
    if (b.action === 'new') return json({ ok: true, sesion: SESION });
    if (b.action === 'send') {
      await new Promise((r) => setTimeout(r, 900));
      const yo = { role: 'user', content: b.mensaje ?? '', at: new Date().toISOString() };
      if (q.get('sinia')) return json({ ok: false, sesion: SESION, mensajes: [yo], aviso: 'Para contestarte necesito tu IA: conecta tu Claude o tu GPT.', conectar: 'anthropic', paraLaPersona: [], propuestas: [], pantallas: [] });
      return json({ ok: true, sesion: SESION, mensajes: [yo, { role: 'assistant', content: 'Un webinar es una clase en vivo (o grabada) donde enseñas algo útil y al final presentas tu oferta. Con Francisco Doglio se usa para preparar la venta antes de la llamada.\n\nSigamos: ¿cuál de sus estrategias armamos?', at: new Date().toISOString() }], aviso: null, paraLaPersona: [], propuestas: [], pantallas: [] });
    }
  }
  if (url.startsWith('/api/media-buyer')) {
    const b = i?.body && typeof i.body === 'string' ? JSON.parse(i.body) as { op?: string } : {};
    if (b.op === 'copiloto_leer') return json({ ok: true, perfil: null }, 500);
  }
  return json({ ok: true });
}) as typeof fetch;
let inicial = {};
try { inicial = JSON.parse(q.get('perfil') ?? '{}'); } catch { /* sin perfil */ }
const barra = q.get('barra') ?? 'plegada';
const anchoBarra = barra === 'abierta' ? 244 : barra === 'plegada' ? 68 : 0;
const VSL = { entrada: 'funnel', funnel: 'vsl-llamada', ticket: 5000, presupuestoMes: 3000, llamadas: 'yo', competencia: 'si', aceptado: true } as const;
const config = { ...configDeEjemplo(), ultimaCorrida: '2026-11-06T09:00:00Z', ultimaCorridaInfo: { campanas: 6 } } as never;
const arranque = { productos: [], costoMedido: null, cierreMedido: null, avatares: 0, funcionalidades: 0, respuestas: {} } as never;

function Pantalla() {
  const p = q.get('pantalla');
  if (p === 'sin') return <SinAnuncios perfil={{ ...inicial, aceptado: true }} />;
  if (p === 'lienzo') return <div className="aa"><LienzoCampanas kpi="agenda" objetivo={q.get('sinobj') ? null : 30} abiertas={[]} productoInicial={q.get('producto')} avatar={<Criatura nombre="MaKo" size={18} estrella />} onVerAcciones={() => {}} show={() => {}}
    inicial={lienzoDeEjemplo(q.get('caso') ?? 'mauricio')} mes={{ texto: 'Este mes: $4,820 gastados · 96 agendas · $50 por agenda', tono: null }} fechas={{ hasta: null, hastaCampanas: {} }} /></div>;
  if (p === 'ajustes') return <Ajustes config={configDeEjemplo() as never} cupo={{ piloto: true, recomendacionesDia: null } as never} perfil={{ ...inicial, aceptado: true }} />;
  if (p === 'plan') return <div className="aa"><div className="aa-pagina"><SeccionPlan perfil={{ ...inicial, aceptado: true }} /></div></div>;
  if (p === 'mb') {
    const v = q.get('vista');
    return <MediaBuyer nombre="Martín" inicial={{ config, decisiones: [], existeTabla: true, cupo: { piloto: true, recomendacionesDia: null } as never }} metas={null} tieneMeta
      arranque={arranque} productoDe={{}} mejores={[]} agentes={[]} vistaInicial={v === 'campanas' || v === 'biblioteca' || v === 'plan' ? v : 'hoy'}
      lienzoInicial={v === 'campanas' ? lienzoDeEjemplo('varios') : null} perfil={VSL as never} />;
  }
  return <PrimeraEntrada nombre="Martín" inicial={inicial} />;
}

createRoot(document.getElementById('raiz')!).render(
  // El layout de verdad (app/layout.tsx): la barra de la app y, al lado, el <main> de la pantalla (Pagina con A_SANGRE), sin fondo propio.
  <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'stretch' }}>
    {anchoBarra > 0 && <aside data-sidebar="" style={{ flex: 'none', width: anchoBarra, background: '#1b1b1b' }} />}
    <main style={{ flex: 1, minWidth: 0, width: '100%', padding: 0 }}><Pantalla /></main>
  </div>,
);
