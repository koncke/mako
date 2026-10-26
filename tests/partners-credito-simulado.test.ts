// =============================================================================
// El camino del crédito de MaKo Partners, de punta a punta, con un cobro SIMULADO (24/10/2026)
// =============================================================================
// El Cerebro, 24/10: «probá el camino del crédito con un cobro simulado, no con uno real. Que cuando Martín pegue la clave
// no descubramos ahí que el crédito no se acredita. Hoy eso nunca se ejercitó». Medido ese día: la plataforma no tiene
// pasarela, el checkout corta antes de crear el cobro, y por eso ninguna compra con código existe en la base.
//
// Corre `acreditarReferidos` (lib/partners-programa.ts) REAL contra una base EN MEMORIA (lib/supabase.ts simulado) y con
// los mails anotados en vez de enviados (lib/invitaciones.ts simulado). Nada toca la base de producción ni manda un mail.
//   1. un negocio entra con el link de otro y paga su primer mes → quedan atados y salen las DOS bienvenidas; sin crédito;
//   2. paga su segundo mes → gana el 100% de su primer mes, a precio de lista, y sale el aviso al partner;
//   3. el cron vuelve a correr → nada se repite (ni crédito ni mails);
//   4. el tablero del partner y el panel del super admin cuentan lo mismo.
//
// Correr: node --import tsx --test tests/partners-credito-simulado.test.ts
// Probado rompiéndolo (24/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const RAIZ = join(import.meta.dirname, '..');
const url = (rel: string): string => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);

const HIJO = `
import { mock } from 'node:test';
const real = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));

// La base en memoria: lo justo de la API de supabase-js que usan estas funciones.
const tablas = {
  workspaces: [
    { id: 9, nombre: 'MaKo', capa: 'superadmin', estado: 'activo', referido_por_ws: null },
    { id: 10, nombre: 'Estudio Sol', capa: 'completo', estado: 'activo', referido_por_ws: null },
    { id: 20, nombre: 'Inmobiliaria del Parque', capa: 'agencia', estado: 'activo', referido_por_ws: null },
    { id: 30, nombre: 'Coach Laura', capa: 'completo', estado: 'activo', referido_por_ws: null },
  ],
  usuarios: [
    { workspace_id: 10, email: 'sol@ejemplo.com', nombre: 'Sol Díaz', rol_ws: 'admin' },
    { workspace_id: 20, email: 'parque@ejemplo.com', nombre: 'Pablo Ríos', rol_ws: 'admin' },
    { workspace_id: 20, email: 'closer@ejemplo.com', nombre: 'Closer', rol_ws: 'closer' },
    { workspace_id: 30, email: 'laura@ejemplo.com', nombre: 'Laura', rol_ws: 'admin' },
  ],
  // La plataforma también podría tener un código: nunca es partner (acreditarReferidos la saltea).
  partner_codigos: [{ workspace_id: 10, codigo: 'estudio-sol' }, { workspace_id: 9, codigo: 'mako' }],
  // La compra simulada: la que CREÓ la cuenta del Parque, con el código de Estudio Sol, pagada.
  cobros: [{ id: 1, workspace_id: 9, tipo: 'suscripcion', alta_ws: 20, ref_codigo: 'estudio-sol', alta_estado: 'hecha', estado: 'pagado',
    monto_usd: 97, moneda: 'USD', created_at: '2026-10-25T10:00:00Z', cliente_ws: null },
    // Coach Laura entró con el código de la PLATAFORMA y pagó dos meses: ni atado, ni crédito, ni mails.
    { id: 2, workspace_id: 9, tipo: 'suscripcion', alta_ws: 30, ref_codigo: 'mako', alta_estado: 'hecha', estado: 'pagado',
    monto_usd: 47, moneda: 'USD', created_at: '2026-10-25T11:00:00Z', cliente_ws: null }],
  pagos: [{ id: 1, workspace_id: 9, cobro_id: 1, pagado: true, fecha_pago: '2026-10-25' },
    { id: 10, workspace_id: 9, cobro_id: 2, pagado: true, fecha_pago: '2026-10-25' }, { id: 11, workspace_id: 9, cobro_id: 2, pagado: true, fecha_pago: '2026-11-25' }],
  partner_creditos: [],
  // Estudio Sol se hizo partner (el alta, 25/10/2026): el panel del programa cuenta las ALTAS, no los códigos.
  app_settings: [{ workspace_id: 10, key: 'partners.alta', value: JSON.stringify({ at: '2026-10-20T10:00:00Z', cuantos: '3-5', como: ['clientes'], cobro: 'estudio.sol.mp' }) }],
};
function from(tabla) {
  const st = { filtros: [], op: 'select', valores: null, orden: null, lim: null, rango: null, single: false, head: false, devolver: false };
  const filas = () => (tablas[tabla] ??= []);
  const b = {
    select(_c, o) { if (st.op === 'update') st.devolver = true; else st.head = !!o?.head; return b; },
    eq(c, v) { st.filtros.push((r) => r[c] === v); return b; },
    not(c, op, v) { if (op === 'is' && v === null) st.filtros.push((r) => r[c] != null); return b; },
    is(c, v) { st.filtros.push((r) => (v === null ? r[c] == null : r[c] === v)); return b; },
    in(c, vs) { st.filtros.push((r) => vs.includes(r[c])); return b; },
    or(expr) {
      const partes = expr.split(',');
      st.filtros.push((r) => partes.some((p) => { const [c, ...resto] = p.split('.'); const op = resto.join('.');
        return op === 'not.is.null' ? r[c] != null : op.startsWith('eq.') ? String(r[c]) === op.slice(3) : false; }));
      return b;
    },
    order(c, o) { st.orden = { c, asc: o?.ascending !== false }; return b; },
    limit(n) { st.lim = n; return b; },
    range(a, z) { st.rango = [a, z]; return b; },
    maybeSingle() { st.single = true; return b; },
    insert(v) { st.op = 'insert'; st.valores = Array.isArray(v) ? v : [v]; return b; },
    update(v) { st.op = 'update'; st.valores = v; return b; },
    then(ok, mal) { try { ok(ejecutar()); } catch (e) { mal(e); } },
  };
  function ejecutar() {
    if (st.op === 'insert') {
      for (const v of st.valores) {
        // El índice único del libro (mig 0330): un referido se acredita una vez.
        if (tabla === 'partner_creditos' && v.tipo === 'referido' && filas().some((r) => r.tipo === 'referido' && r.referidor_ws === v.referidor_ws && r.referido_ws === v.referido_ws)) {
          return { data: null, error: { code: '23505', message: 'duplicate key' } };
        }
        filas().push({ id: filas().length + 1, created_at: '2026-11-25T10:00:00Z', ...v });
      }
      return { data: null, error: null };
    }
    let rs = filas().filter((r) => st.filtros.every((f) => f(r)));
    if (st.op === 'update') { for (const r of rs) Object.assign(r, st.valores); return { data: st.devolver ? rs.map((r) => ({ id: r.id })) : null, error: null }; }
    if (st.orden) rs = [...rs].sort((x, y) => (x[st.orden.c] > y[st.orden.c] ? 1 : x[st.orden.c] < y[st.orden.c] ? -1 : 0) * (st.orden.asc ? 1 : -1));
    if (st.rango) rs = rs.slice(st.rango[0], st.rango[1] + 1);
    if (st.lim != null) rs = rs.slice(0, st.lim);
    if (st.head) return { data: null, count: rs.length, error: null };
    if (st.single) return { data: rs[0] ? { ...rs[0] } : null, error: null };
    return { data: rs.map((r) => ({ ...r })), error: null };
  }
  return b;
}

const sb = await import(${url('lib/supabase.ts')});
mock.module(${url('lib/supabase.ts')}, { exports: { ...real(sb), getSupabaseServer: () => ({ from }) } });
const ws = await import(${url('lib/workspace.ts')});
mock.module(${url('lib/workspace.ts')}, { exports: { ...real(ws), wsSuperAdmin: async () => 9 } });
const mails = [];
const inv = await import(${url('lib/invitaciones.ts')});
mock.module(${url('lib/invitaciones.ts')}, { exports: { ...real(inv), avisarDePlataforma: async (m) => { mails.push({ to: m.to, tag: m.tag, asunto: m.asunto }); return { enviado: true }; } } });
const pa = await import(${url('lib/plan-acceso.ts')});
mock.module(${url('lib/plan-acceso.ts')}, { exports: { ...real(pa), vigenciaDe: async () => null } });

const { acreditarReferidos, tableroDe, resumenDelPrograma } = await import(${url('lib/partners-programa.ts')});

const r1 = await acreditarReferidos();
const mails1 = mails.length;
tablas.pagos.push({ id: 2, workspace_id: 9, cobro_id: 1, pagado: true, fecha_pago: '2026-11-25' });
const r2 = await acreditarReferidos();
const mails2 = mails.length;
const r3 = await acreditarReferidos();
const tablero = await tableroDe(10);
const programa = await resumenDelPrograma();
console.log(JSON.stringify({
  r1, r2, r3, mails, mails1, mails2, creditos: tablas.partner_creditos,
  atado: tablas.workspaces.find((w) => w.id === 20).referido_por_ws,
  atadoPlataforma: tablas.workspaces.find((w) => w.id === 30).referido_por_ws,
  tablero: { link: tablero.link, referidos: tablero.referidos, resumen: tablero.resumen },
  programa,
}));
`;

type Salida = {
  r1: { vistos: number; atados: number; acreditados: number }; r2: Salida['r1']; r3: Salida['r1'];
  mails: Array<{ to: string; tag: string; asunto: string }>; mails1: number; mails2: number;
  creditos: Array<{ referidor_ws: number; referido_ws: number; tipo: string; monto_usd: number }>;
  atado: number | null;
  atadoPlataforma: number | null;
  tablero: { link: string | null; referidos: Array<{ ws: number; nombre: string; estado: string; mesesPagados: number }>; resumen: { ganadoUsd: number; aCobrarUsd: number } };
  programa: { partners: number; referidos: number; ganadoUsd: number; aPagarUsd: number; lista: Array<{ ws: number; nombre: string; referidos: number; ganadoUsd: number; aCobrarUsd: number; cobro: string | null }> };
};

let salida: Salida | null = null;
const correr = (): Salida => {
  if (salida) return salida;
  const out = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', '--input-type=module', '-e', HIJO,
  ], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  salida = JSON.parse(out.trim().split('\n').pop()!) as Salida;
  return salida;
};

test('primer mes pagado: quedan atados y salen las DOS bienvenidas (a los admins), todavía sin crédito', () => {
  const s = correr();
  assert.deepEqual(s.r1, { vistos: 2, atados: 1, acreditados: 0 });
  assert.equal(s.atadoPlataforma, null, 'el código de la plataforma no ata a nadie');
  assert.ok(!s.mails.some((m) => m.to === 'laura@ejemplo.com'), 'ni le da la bienvenida');
  assert.equal(s.atado, 10, 'el Parque quedó como referido de Estudio Sol');
  const bienvenidas = s.mails.slice(0, s.mails1);
  assert.deepEqual(bienvenidas.map((m) => `${m.tag}→${m.to}`).sort(), ['partners-bienvenida→parque@ejemplo.com', 'partners-nuevo-referido→sol@ejemplo.com']);
  assert.ok(!bienvenidas.some((m) => m.to === 'closer@ejemplo.com'), 'la bienvenida es para los admins, no para el closer');
  assert.match(bienvenidas.find((m) => m.tag === 'partners-bienvenida')!.asunto, /de parte de Estudio Sol/);
});

test('segundo mes pagado: gana el 100% de su primer mes a precio de lista, y el partner recibe el aviso', () => {
  const s = correr();
  assert.deepEqual(s.r2, { vistos: 2, atados: 0, acreditados: 1 });
  assert.deepEqual(s.creditos.map((c) => [c.referidor_ws, c.referido_ws, c.tipo, c.monto_usd]), [[10, 20, 'referido', 97]]);
  const aviso = s.mails.slice(s.mails1, s.mails2);
  assert.deepEqual(aviso.map((m) => `${m.tag}→${m.to}`), ['partners-credito→sol@ejemplo.com']);
  assert.match(aviso[0].asunto, /^Ganaste US\$\s?97/, 'en dinero: «Ganaste US$ 97», no «crédito»');
});

test('el cron vuelve a correr: nada se repite (ni el crédito, ni un mail)', () => {
  const s = correr();
  assert.deepEqual(s.r3, { vistos: 2, atados: 0, acreditados: 0 });
  assert.equal(s.creditos.length, 1);
  assert.equal(s.mails.length, s.mails2, 'el cron no vuelve a mandar nada');
});

test('el tablero del partner y el panel del super admin cuentan lo mismo', () => {
  const s = correr();
  assert.equal(s.tablero.link, 'https://hola-mako.com/r/estudio-sol');
  assert.deepEqual(s.tablero.referidos.map((r) => [r.nombre, r.estado, r.mesesPagados]), [['Inmobiliaria del Parque', 'acreditado', 2]]);
  assert.equal(s.tablero.resumen.ganadoUsd, 97);
  assert.equal(s.tablero.resumen.aCobrarUsd, 97, 'todavía nadie se lo transfirió');
  assert.equal(s.programa.referidos, 1, 'Coach Laura (código de la plataforma) no cuenta');
  assert.equal(s.programa.partners, 1, 'partners = los que terminaron el alta (la plataforma tiene código y no cuenta)');
  assert.equal(s.programa.ganadoUsd, 97);
  assert.equal(s.programa.aPagarUsd, 97);
  assert.deepEqual(s.programa.lista.map((p) => [p.nombre, p.referidos, p.ganadoUsd, p.aCobrarUsd, p.cobro]), [['Estudio Sol', 1, 97, 97, 'estudio.sol.mp']]);
});

// Roturas (24/10/2026; base 4 / 0), cada una restaurada (pasan / fallan):
//   · el crédito con el PRIMER mes (PAGOS_PARA_ACREDITAR = 1)                                  -> 2 / 2
//   · atar sin mirar si ya estaba atado (las bienvenidas se repiten en cada corrida)           -> 2 / 2
//   · el crédito vale 0                                                                        -> 1 / 3
//   · la bienvenida también al closer                                                          -> 3 / 1
//   · el código de la plataforma ata y acredita                                                -> 0 / 4
