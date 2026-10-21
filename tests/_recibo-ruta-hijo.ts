// =============================================================================
// Hijo de tests/pagos-recibo-leido.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre la ruta REAL /api/extract-receipt (app/api/extract-receipt/route.ts) contra un PostgREST de mentira
// (tests/_postgrest-de-mentira.ts) y un Storage de mentira, con la IA de mentira (`leerDocumentoIA`, lib/ai-cheap.ts, vía
// `mock.module`): lo que se prueba es la respuesta TAL CUAL la arma la ruta, para que el test la pase por la lectura de
// la pantalla (`reciboLeido`). Un mock de la respuesta con el nombre que espera la pantalla no hubiera visto que la ruta
// dice `monto_usd` y la pantalla leía `monto` (revisión adversarial del 21/10/2026).
// Corre con `--conditions=react-server --experimental-test-module-mocks`. Imprime un JSON.
// =============================================================================

import { mock } from 'node:test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { crearPostgrest } from './_postgrest-de-mentira';

const pg = crearPostgrest({ tablas: ['leads', 'pagos', 'app_settings', 'prompts'] });
const subidas: string[] = [];
const red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test' && u.pathname.startsWith('/storage/v1/object/')) {
    subidas.push(decodeURIComponent(u.pathname.replace('/storage/v1/object/', '')));
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

async function main() {
  // Lo que la IA lee del comprobante: un pago de MENOS, en pesos convertidos a dólares (el prompt pide `monto_usd`).
  const leida = { monto_usd: 300, fecha: '2026-10-20', hora: '9:05', nota: 'Convertido de MXN a USD a ~17 MXN/USD' };
  const ia = await import(url('lib/ai-cheap.ts'));
  mock.module(url('lib/ai-cheap.ts'), { exports: {
    ...Object.fromEntries(Object.entries(ia).filter(([k]) => k !== 'default' && k !== 'module.exports')),
    leerDocumentoIA: async () => ({ text: '```json\n' + JSON.stringify(leida) + '\n```' }),
  } } as unknown as Parameters<typeof mock.module>[1]);
  const pr = await import(url('lib/prompt-render.ts'));
  mock.module(url('lib/prompt-render.ts'), { exports: {
    ...Object.fromEntries(Object.entries(pr).filter(([k]) => k !== 'default' && k !== 'module.exports')),
    getPromptText: async (_k: string, porDefecto: string) => porDefecto,
  } } as unknown as Parameters<typeof mock.module>[1]);

  pg.db.leads.push({ id: 101, workspace_id: WS, nombre: 'Ana' });
  pg.db.pagos.push({ id: 7, workspace_id: WS, lead_id: 101, numero: 1, monto_usd: 500, fecha_esperada: '2026-10-20', pagado: false });

  const { runWithWorkspace } = await import('../lib/workspace');
  const { POST } = await import('../app/api/extract-receipt/route');
  const fd = new FormData();
  fd.append('file', new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'recibo.jpg', { type: 'image/jpeg' }));
  fd.append('leadId', '101');
  fd.append('pagoId', '7');
  const res = await runWithWorkspace(WS, () => POST(new Request('http://mako.test/api/extract-receipt', { method: 'POST', body: fd }) as never));
  const respuesta = await res.json();
  const cuota = pg.db.pagos.find((p) => p.id === 7) ?? null;
  process.stdout.write(JSON.stringify({ status: res.status, respuesta, cuota, subidas, red, sinMock: [...pg.sinMock] }));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
