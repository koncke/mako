// =============================================================================
// Hijo de tests/funciones-mako.test.ts: `listar_capacidades_mako` con el runner REAL, sin base ni red (28/10/2026)
// =============================================================================
// Corre con: node --conditions=react-server --experimental-test-module-mocks --no-warnings --import tsx tests/_capacidades-hijo.ts
// `getWorkspace` es de mentira y sólo devuelve la capa de cada negocio; `wsSuperAdmin` es el 9. Imprime lo que recibe cada
// negocio y rol después de `@@RESULTADO@@`. El molde es el del refutador de la verificación de 0c80dd3ce.
// =============================================================================
import { mock } from 'node:test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'x';
globalThis.fetch = (async () => { throw new Error('sin red'); }) as typeof fetch;

const RAIZ = join(import.meta.dirname, '..');
const u = (rel: string) => pathToFileURL(join(RAIZ, rel)).href;
const sinDefault = (m: Record<string, unknown>) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));

const CAPAS: Record<number, string> = { 11: 'completo', 12: 'agencia', 13: 'pm', 9: 'superadmin' };

async function main() {
  const W = await import(u('lib/workspace.ts'));
  // `exports` es la opción de este Node (la usan tests/calendly-cancelar y crear-ia-revision-corrige, en un script sin tipos);
  // los tipos de @types/node todavía no la tienen.
  mock.module(u('lib/workspace.ts'), {
    exports: { ...sinDefault(W), getWorkspace: async (id: number) => ({ id, nombre: 'Negocio de prueba', slug: 'x', estado: 'activo', capa: CAPAS[id] }), wsSuperAdmin: async () => 9 },
  } as unknown as Parameters<typeof mock.module>[1]);
  const { runnerDe } = await import(u('lib/api-mako/runners.ts'));
  const run = runnerDe('listar_capacidades_mako') as { leer: (i: Record<string, unknown>, c: unknown) => Promise<unknown> };
  const out: Record<string, { funciones: string[]; capacidades: string[] }> = {};
  for (const [ws, rol] of [[11, 'admin'], [12, 'admin'], [13, 'admin'], [11, 'miembro'], [9, 'admin']] as const) {
    const ctx = { ws, canal: 'app', canalKey: 'app:prueba', alcance: 'proponer', rol, actor: 'prueba' };
    const res = await W.runWithWorkspace(ws, () => run.leer({}, ctx));
    const txt = typeof res === 'string' ? res : String((res as { content?: unknown })?.content ?? JSON.stringify(res));
    const j = JSON.parse(txt) as { funciones?: { funcion: string }[]; capacidades?: { id: string }[] };
    out[`${ws}:${rol}`] = { funciones: (j.funciones ?? []).map((f) => f.funcion), capacidades: (j.capacidades ?? []).map((c) => c.id) };
  }
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
