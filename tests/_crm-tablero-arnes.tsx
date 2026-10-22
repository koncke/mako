// =============================================================================
// Arnés del TABLERO de /crm: el CrmBoard REAL con N tarjetas en una columna, medido en un Chrome sin ventana (22/10/2026)
// =============================================================================
// NO es un test (no termina en .test.ts). Lo arma y lo corre tests/_crm-tablero-medir.mjs (esbuild + CDP). Martín, en
// su Chrome, abrió «Sprint 3 días» del ws1 (300 en «Lead entrante») y la pestaña quedó más de 2 minutos sin responder;
// el sábado Mauricio va a tener 1.050 ahí. Esto mide, sin levantar la app:
//   · `render`: desde `root.render` hasta el primer cuadro pintado;
//   · `clic`: un clic en una tarjeta (abre la ficha rápida, o sea: re-dibuja el tablero) hasta el cuadro siguiente;
//   · `tildar`: tildar una tarjeta (lo que pasa al elegir para mover de a 50);
//   · `largas`: las tareas largas (> 50 ms) que el navegador vio, y cuánto suman.
// Parámetros por la URL: ?n=<tarjetas> · ?marcar=1 (todas con «Datos pendientes») · ?fotos=1 (todas con foto).
// =============================================================================

import { createRoot } from 'react-dom/client';
import { CrmBoard } from '../app/crm/CrmBoard';
import { etapasDelTablero, mapToCrmLead } from '../app/crm/crm-map';
import { DEFAULT_PIPELINE, generateFunnel } from '../lib/pipeline';
import type { FunnelResumen } from '../lib/funnel-fila';

type Medida = { n: number; tarjetasEnDom: number; altoMain: number; altoVentana: number; render: number; clic: number; tildar: number; largas: number; msLargas: number };
declare global { interface Window { __medida: Medida | { error: string } | null; __largas: number[] } }

const q = new URLSearchParams(location.search);
const N = Number(q.get('n') ?? 300);
const { stages, transitions } = generateFunnel(DEFAULT_PIPELINE);
const entrada = stages[0].key;
const tablero = etapasDelTablero(stages);

// Leads con la forma de una fila de la base (mapToCrmLead es el mismo mapper de la página).
const leads = Array.from({ length: N }, (_, i) => mapToCrmLead({
  id: i + 1, nombre: `Lead de prueba ${i + 1}`, email: `lead${i + 1}@ejemplo.com`, empresa: i % 3 ? `Empresa ${i % 40}` : null,
  telefono: `+52 55 ${String(10000000 + i)}`, telefono_normalizado: `5255${String(10000000 + i)}`,
  created_at: '2026-10-20T10:00:00Z', estado_lead: 'abierto', pipeline_stage: entrada,
  origen_lead: 'meta', meta_ad_name: 'Anuncio VSL', meta_campaign_name: 'Sprint 3 días',
} as unknown as Parameters<typeof mapToCrmLead>[0], {}, tablero));

// Variantes para separar qué pesa: ?marcar=1 (todas con «Datos pendientes») · ?fotos=1 (todas con su foto).
const conMarcar = q.get('marcar') === '1';
if (q.get('fotos') === '1') {
  for (const l of leads) {
    const c = (l.id * 47) % 360;
    l.foto = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="hsl(${c},60%,60%)"/><circle cx="32" cy="26" r="12" fill="#fff"/></svg>`)}`;
  }
}
const marcar = conMarcar ? leads.map((l) => ({ id: `m${l.id}`, leadId: l.id, name: l.name, company: l.company, message: 'Faltan datos', tipo: 'A' as const })) : [];

window.__largas = [];
try {
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__largas.push(e.duration); }).observe({ type: 'longtask', buffered: true });
} catch { /* sin longtask: se mide igual el resto */ }

let errorRender: string | null = null;
const cuadro = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

async function medir() {
  const raiz = document.getElementById('raiz')!;
  const t0 = performance.now();
  createRoot(raiz, { onUncaughtError: (e) => { errorRender = String((e as Error)?.stack ?? e).slice(0, 600); } }).render(
    <CrmBoard leads={leads} stages={stages} juntas={[]} marcar={marcar} transitions={transitions} errorMsg={null} hoy="2026-10-22"
      funnels={[{ id: 44, nombre: 'Sprint 3 días', canal: null, esDefault: true, declarado: true } as unknown as FunnelResumen]} funnelActivo={44} />,
  );
  await cuadro();
  const render = performance.now() - t0;
  // Que se asiente (los efectos del primer render: filtros guardados, medidas).
  for (let i = 0; i < 5; i++) await cuadro();

  // «Ver info» abre la ficha rápida: es estado del TABLERO, así que redibuja todas las tarjetas (como cualquier clic que
  // cambia algo del tablero). La tarjeta entera abre la ficha completa, que acá no tiene datos (las acciones están vacías).
  const verInfo = [...document.querySelectorAll<HTMLElement>('[data-leadcard] button, [data-leadcard] [role="button"]')].find((b) => /Ver info/.test(b.textContent ?? ''));
  const t1 = performance.now();
  verInfo?.click();
  await cuadro();
  const clic = performance.now() - t1;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  for (let i = 0; i < 3; i++) await cuadro();

  const casilla = document.querySelector<HTMLInputElement>('input.mk-sel-tarjeta');
  const t2 = performance.now();
  casilla?.click();
  await cuadro();
  const tildar = performance.now() - t2;

  const largas = window.__largas.length;
  const msLargas = Math.round(window.__largas.reduce((a, b) => a + b, 0));
  const main = document.querySelector('main');
  window.__medida = { n: N, tarjetasEnDom: document.querySelectorAll('[data-leadcard]').length, altoMain: Math.round(main?.getBoundingClientRect().height ?? 0), altoVentana: innerHeight, render: Math.round(render), clic: Math.round(clic), tildar: Math.round(tildar), largas, msLargas,
    ...(errorRender ? { errorRender } : {}), ...(q.get('debug') ? { columnas: [...document.querySelectorAll<HTMLElement>('[data-colkey]')].map((c) => c.dataset.colkey), etapaLead: leads[0]?.stage, derivada: leads[0]?.derivedStage, entrada, texto: document.body.innerText.slice(0, 400) } : {}) } as Medida;
}

medir().catch((e) => { window.__medida = { error: String(e?.stack ?? e) }; });
