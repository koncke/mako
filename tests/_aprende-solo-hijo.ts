// =============================================================================
// Hijo de tests/aprende-solo-en-el-chat.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El runner REAL de `cambiar_aprende_solo`, con el interruptor (lib/recolector.ts) de mentira. Necesita `--conditions=react-server`
// y `--experimental-test-module-mocks`.
// =============================================================================

import { mock } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = join(__dirname, '..');
let prendido = false;
let leeBien = true;
const cambios: boolean[] = [];

const src = readFileSync(join(RAIZ, 'lib/recolector.ts'), 'utf8');
const sinMock: Record<string, unknown> = {};
for (const m of src.matchAll(/^export (?:async )?(?:function\*? |const |let )(\w+)/gm)) sinMock[m[1]] = () => { throw new Error(`recolector: ${m[1]} sin mock`); };
mock.module(pathToFileURL(join(RAIZ, 'lib/recolector.ts')).href, {
  namedExports: {
    ...sinMock,
    resumenDelRecolector: async () => (leeBien ? { estado: { prendido, ultima: null }, conversaciones: 0, conEntrada: 0, sinIndice: 0, ultimas: [] } : null),
    cambiarRecolector: async (p: boolean) => { cambios.push(p); prendido = p; },
  },
});

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
globalThis.fetch = (async () => new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { runnerDe } = await import('../lib/api-mako/runners');
  const ctx = { ws: 11, canal: 'app', canalKey: 'app:1', alcance: 'proponer', rol: 'admin', turnStart: Date.now(), mensajeUsuario: 'x', actor: 'test' };
  type R = {
    preparar: (i: Record<string, unknown>, c: typeof ctx) => Promise<Record<string, unknown>>;
    ejecutar: (p: unknown, c: typeof ctx) => Promise<Record<string, unknown>>;
  };
  const r = runnerDe('cambiar_aprende_solo') as unknown as R;
  const enWs = <T,>(fn: () => Promise<T>) => runWithWorkspace(11, fn);
  const out: Record<string, unknown> = {};
  out.sinDecir = await enWs(() => r.preparar({}, ctx));
  out.prende = await enWs(() => r.preparar({ prendido: true }, ctx));
  out.ejecuta = await enWs(() => r.ejecutar((out.prende as { payload: unknown }).payload, ctx));
  out.cambios = [...cambios];
  out.yaPrendido = await enWs(() => r.preparar({ prendido: true }, ctx));
  leeBien = false;
  out.sinLeer = await enWs(() => r.preparar({ prendido: false }, ctx));
  process.stdout.write(`@@JSON@@${JSON.stringify(out)}@@FIN@@`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
