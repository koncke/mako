// =============================================================================
// Hijo de tests/pagos-recibo-leido.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre la ruta REAL /api/extract-receipt (app/api/extract-receipt/route.ts) contra un PostgREST de mentira
// (tests/_postgrest-de-mentira.ts) y un Storage de mentira, con la IA de mentira (`leerDocumentoIA`, lib/ai-cheap.ts, vía
// `mock.module`): lo que se prueba es la respuesta TAL CUAL la arma la ruta, para que el test la pase por la lectura de
// la pantalla (`reciboLeido`, `plataDeRecibo`). Un mock de la respuesta con el nombre que espera la pantalla no hubiera
// visto que la ruta decía `monto_usd` y la pantalla leía `monto` (revisión adversarial del 21/10/2026).
// Varios casos, uno por lo que «lee» la IA: un comprobante en pesos, uno en dólares, lo que devuelve un prompt viejo
// (convertido y sin convertir) y una cuota que ya estaba cobrada.
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

/** Lo que la IA «lee» en el próximo pedido. */
let leida: Record<string, unknown> = {};

async function main() {
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
  // La 7: impaga. La 8: YA cobrada, con el comprobante del banco.
  pg.db.pagos.push({ id: 7, workspace_id: WS, lead_id: 101, numero: 1, monto_usd: 289.02, fecha_esperada: '2026-10-20', pagado: false });
  pg.db.pagos.push({ id: 8, workspace_id: WS, lead_id: 101, numero: 2, monto_usd: 289.02, fecha_esperada: '2026-11-20', pagado: true, comprobante_path: '3/101/comprobantes/banco.pdf', comprobante_nombre: 'banco.pdf' });

  const { runWithWorkspace } = await import('../lib/workspace');
  const { POST } = await import('../app/api/extract-receipt/route');
  const pedir = async (pagoId: number, lee: Record<string, unknown>) => {
    leida = lee;
    const fd = new FormData();
    fd.append('file', new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'recibo.jpg', { type: 'image/jpeg' }));
    fd.append('leadId', '101');
    fd.append('pagoId', String(pagoId));
    const res = await runWithWorkspace(WS, () => POST(new Request('http://mako.test/api/extract-receipt', { method: 'POST', body: fd }) as never));
    return { status: res.status, respuesta: await res.json() };
  };
  const out: Record<string, unknown> = {};
  // Un SPEI de MX$5.000 justos (la cuota es de US$289,02).
  out.pesos = await pedir(7, { monto: 5000, moneda: 'mxn', fecha: '2026-10-20', hora: '9:05', nota: null });
  out.cuota7 = pg.db.pagos.find((p) => p.id === 7) ?? null;
  // Un pago de menos en dólares.
  out.dolares = await pedir(7, { monto: 300, moneda: 'USD', fecha: '2026-10-20', hora: '14:30', nota: null });
  // Un prompt viejo guardado en Configuraciones: convirtió con una tasa inventada, y no convirtió.
  out.viejoConvertido = await pedir(7, { monto_usd: 277.78, fecha: '2026-10-20', hora: null, nota: 'Convertido de MXN a USD a ~18 MXN/USD' });
  out.viejoEnDolares = await pedir(7, { monto_usd: 300, fecha: '2026-10-20', hora: null, nota: null });
  // Sin moneda legible.
  out.sinMoneda = await pedir(7, { monto: 5000, moneda: null, fecha: '2026-10-20', hora: null, nota: null });
  // La cuota 8 ya estaba cobrada: no se le cambia el comprobante ni se sube nada.
  const subidasAntes = subidas.length;
  out.cobrada = await pedir(8, { monto: 5000, moneda: 'MXN', fecha: '2026-10-20', hora: null, nota: null });
  out.cuota8 = pg.db.pagos.find((p) => p.id === 8) ?? null;
  out.subidasCobrada = subidas.length - subidasAntes;
  process.stdout.write(JSON.stringify({ ...out, subidas: subidas.length, red, sinMock: [...pg.sinMock] }));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
