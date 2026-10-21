// =============================================================================
// Hijo de tests/pagos-contrato-moneda.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre la ruta REAL /api/extract-contract (app/api/extract-contract/route.ts) contra un PostgREST y un Storage de mentira
// (tests/_postgrest-de-mentira.ts), con la IA de mentira (`leerDocumentoIA`, lib/ai-cheap.ts, vía `mock.module`): lo que
// se prueba es la respuesta TAL CUAL la arma la ruta. Casos, uno por lo que «lee» la IA: un contrato en pesos, uno en
// dólares, uno con «$» sin código, y lo que devuelve un prompt viejo guardado en Configuraciones (que convertía).
// Corre con `--conditions=react-server --experimental-test-module-mocks`. Imprime un JSON.
// =============================================================================

import { mock } from 'node:test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { crearPostgrest } from './_postgrest-de-mentira';

const pg = crearPostgrest({ tablas: ['leads', 'app_settings', 'prompts'] });
const red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test' && u.pathname.startsWith('/storage/v1/object/')) {
    return new Response(JSON.stringify({ Key: u.pathname }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const url = (r: string) => pathToFileURL(join(__dirname, '..', r)).href;
const WS = 3;
let leida: Record<string, unknown> = {};

async function main() {
  const ia = await import(url('lib/ai-cheap.ts'));
  mock.module(url('lib/ai-cheap.ts'), { exports: {
    ...Object.fromEntries(Object.entries(ia).filter(([k]) => k !== 'default' && k !== 'module.exports')),
    leerDocumentoIA: async () => ({ text: JSON.stringify(leida) }),
  } } as unknown as Parameters<typeof mock.module>[1]);
  const pr = await import(url('lib/prompt-render.ts'));
  mock.module(url('lib/prompt-render.ts'), { exports: {
    ...Object.fromEntries(Object.entries(pr).filter(([k]) => k !== 'default' && k !== 'module.exports')),
    getPromptText: async (_k: string, porDefecto: string) => porDefecto,
  } } as unknown as Parameters<typeof mock.module>[1]);
  pg.db.leads.push({ id: 101, workspace_id: WS, nombre: 'Leila' });

  const { runWithWorkspace } = await import('../lib/workspace');
  const { POST } = await import('../app/api/extract-contract/route');
  const pedir = async (lee: Record<string, unknown>) => {
    leida = lee;
    const fd = new FormData();
    fd.append('file', new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'contrato.pdf', { type: 'application/pdf' }));
    fd.append('leadId', '101');
    const res = await runWithWorkspace(WS, () => POST(new Request('http://mako.test/api/extract-contract', { method: 'POST', body: fd }) as never));
    return { status: res.status, respuesta: await res.json() };
  };
  const doce = (monto: number) => Array.from({ length: 12 }, (_, i) => ({ monto, fecha: `08/${String(((9 + i) % 12) + 1).padStart(2, '0')}/${2026 + Math.floor((9 + i) / 12)}` }));
  const out: Record<string, unknown> = {};
  out.pesos = await pedir({ total: 72000, moneda: 'MXN', duracion_meses: 12, fecha_cierre: '08/10/2026', fecha_inicio: '08/10/2026', cuotas: doce(6000), nota: null });
  out.dolares = await pedir({ total: 3000, moneda: 'USD', duracion_meses: 3, fecha_cierre: '08/10/2026', fecha_inicio: '08/10/2026', cuotas: [{ monto: 1000, fecha: '08/10/2026' }, { monto: 1000, fecha: '08/11/2026' }, { monto: 1000, fecha: '08/12/2026' }], nota: null });
  out.signoPesos = await pedir({ total: 72000, moneda: null, duracion_meses: 12, cuotas: doce(6000), nota: null });
  // (revisión de bc5fb022d) El total en dólares y las cuotas en pesos: «US$4,000 total, 12 mensualidades de $6,000 M.N.»,
  // tal cual, y con las cuotas convertidas por la IA (6.000 / 17 = 352,94, que suman 4.235,28).
  out.mixto = await pedir({ total: 4000, moneda: 'USD', duracion_meses: 12, cuotas: doce(6000), nota: null });
  out.convertido = await pedir({ total: 4000, moneda: 'USD', duracion_meses: 12, cuotas: doce(352.94), nota: null });
  out.viejo = await pedir({ total_usd: 4235.29, duracion_meses: 12, cuotas: doce(352.94), nota: 'Montos convertidos de MXN a USD a ~17 MXN/USD' });
  process.stdout.write(JSON.stringify({ ...out, red, sinMock: [...pg.sinMock] }));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
