// =============================================================================
// MaKo Partners + «Empezar mi plan ya», de punta a punta, con una base SIMULADA (25/10/2026, revisión del tren)
// =============================================================================
// La falla: un negocio entra con el link de un partner y empieza la prueba de 7 días (el cobro de la prueba lleva el código y
// creó la cuenta). Durante la prueba toca «Empezar mi plan ya»: nace un cobro NUEVO, y al cobrarse la prueba queda 'anulado'.
// El cobro nuevo no llevaba el código y `acreditarReferidos` sólo lee cobros pagados con código y alta 'hecha': el partner no
// cobraba NUNCA, y su panel le mostraba la plata «en camino» para siempre.
//
// Corre `empezarPlanAhora` (lib/empezar-plan.ts) y `acreditarReferidos`, `tableroDe` y `resumenDelPrograma`
// (lib/partners-programa.ts) REALES contra una base EN MEMORIA (lib/supabase.ts simulado); la pasarela (lib/cobros.ts) y los
// mails, simulados. Nada toca la base de producción ni manda un mail.
//   1. «Empezar mi plan ya» hereda el código de la prueba, sin marcar el alta 'hecha' (le abriría el cambio de email);
//   2. pagado el 1º mes del cobro nuevo (la prueba, anulada): quedan atados y salen las bienvenidas;
//   3. pagado el 2º: el partner gana el 100% del primer mes, y el tablero y el panel del super admin lo cuentan;
//   4. una prueba que NO creó la cuenta no pasa su código (el programa es para clientes nuevos);
//   5. el que canceló la prueba sin pagar nada figura «se fue», no «en camino», AUNQUE su negocio siga 'activo' (con el corte
//      de acceso apagado nadie lo pausa: ronda 2); el que sigue en su prueba, sí está «en camino»;
//   6. un link de «Empezar mi plan ya» abierto ANTES de este arreglo (sin código) se reusa, y ahora con el código.
//
// Correr: node --import tsx --test --test-concurrency=1 tests/partners-empezar-ya.test.ts
// Probado rompiéndolo (25/10/2026): al pie del archivo.
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

const prueba = (id, ws, ref, extra) => ({ id, workspace_id: 9, tipo: 'suscripcion', alta_ws: ws, alta_capa: 'completo', creado_por: 'planes:pro:prueba',
  ref_codigo: ref, alta_estado: 'hecha', estado: 'pendiente', suscripcion_estado: 'activa', plan_mako: 'pro', proveedor: 'mercadopago',
  concepto: 'MaKo Pro', monto: 97, moneda: 'USD', monto_usd: 97, lead_id: 100 + ws, email: 'ws' + ws + '@ejemplo.com', nombre: 'Negocio ' + ws,
  token: 'tok-' + id, created_at: '2026-10-20T10:00:00Z', pagado_at: null, cliente_ws: null, ...extra });

const tablas = {
  workspaces: [
    { id: 9, nombre: 'MaKo', estado: 'activo', referido_por_ws: null },
    { id: 10, nombre: 'Estudio Sol', estado: 'activo', referido_por_ws: null },
    { id: 20, nombre: 'Inmobiliaria del Parque', estado: 'activo', referido_por_ws: null },
    { id: 40, nombre: 'Coach Laura', estado: 'activo', referido_por_ws: null },
    // 'activo', como en producción: con CORTE_DE_ACCESO_PRENDIDO = false nadie pausa al que canceló la prueba (ronda 2).
    { id: 50, nombre: 'Gimnasio Norte', estado: 'activo', referido_por_ws: null },
    { id: 60, nombre: 'Estudio Luna', estado: 'activo', referido_por_ws: null },
  ],
  usuarios: [
    { workspace_id: 10, email: 'sol@ejemplo.com', nombre: 'Sol Díaz', rol_ws: 'admin' },
    { workspace_id: 20, email: 'parque@ejemplo.com', nombre: 'Pablo Ríos', rol_ws: 'admin' },
    { workspace_id: 40, email: 'laura@ejemplo.com', nombre: 'Laura', rol_ws: 'admin' },
  ],
  partner_codigos: [{ workspace_id: 10, codigo: 'estudio-sol' }],
  cobros: [
    // El Parque entró con el link de Estudio Sol y está en su prueba (la que CREÓ su cuenta).
    prueba(5, 20, 'estudio-sol'),
    // Coach Laura YA tenía cuenta: su prueba lleva el código, pero no creó la cuenta.
    prueba(6, 40, 'estudio-sol', { alta_estado: 'ya_tenia_cuenta' }),
    // Gimnasio Norte entró con el link, canceló la prueba antes del día 8 y nunca pagó.
    prueba(7, 50, 'estudio-sol', { suscripcion_estado: 'cancelada' }),
    // Estudio Luna entró con el link y sigue en su prueba; abrió «Empezar mi plan ya» antes del arreglo: un link sin código.
    prueba(8, 60, 'estudio-sol'),
    { id: 80, workspace_id: 9, tipo: 'suscripcion', alta_ws: 60, alta_capa: null, creado_por: 'empezar-ya:8', ref_codigo: null, alta_estado: null,
      estado: 'pendiente', suscripcion_estado: null, plan_mako: 'pro', proveedor: 'mercadopago', concepto: 'MaKo Pro', monto: 97, moneda: 'USD',
      monto_usd: 97, lead_id: 160, email: 'ws60@ejemplo.com', nombre: 'Negocio 60', token: 'tok-80', created_at: '2026-10-22T09:00:00Z', pagado_at: null, cliente_ws: null },
  ],
  pagos: [],
  partner_creditos: [],
  app_settings: [{ workspace_id: 10, key: 'partners.alta', value: JSON.stringify({ at: '2026-10-01T10:00:00Z', cuantos: '3-5', como: ['clientes'], cobro: 'estudio.sol.mp' }) }],
};
function from(tabla) {
  const st = { filtros: [], op: 'select', valores: null, orden: null, lim: null, rango: null, single: false, head: false, devolver: false };
  const filas = () => (tablas[tabla] ??= []);
  // Lo justo de los filtros de PostgREST dentro de un or(): eq, not.is.null y like (con * de comodín).
  const unFiltro = (r, p) => {
    const [c, ...resto] = p.split('.'); const op = resto.join('.');
    if (op === 'not.is.null') return r[c] != null;
    if (op.startsWith('eq.')) return String(r[c]) === op.slice(3);
    if (op.startsWith('like.')) return new RegExp('^' + op.slice(5).split('*').map((s) => [...s].map((ch) => '[' + ch + ']').join('')).join('.*') + '$').test(String(r[c] ?? ''));
    throw new Error('filtro sin simular: ' + p);
  };
  const b = {
    select(_c, o) { if (st.op === 'update') st.devolver = true; else st.head = !!o?.head; return b; },
    eq(c, v) { st.filtros.push((r) => r[c] === v); return b; },
    gte(c, v) { st.filtros.push((r) => r[c] >= v); return b; },
    not(c, op, v) { if (op === 'is' && v === null) st.filtros.push((r) => r[c] != null); else throw new Error('not sin simular'); return b; },
    is(c, v) { st.filtros.push((r) => (v === null ? r[c] == null : r[c] === v)); return b; },
    in(c, vs) { st.filtros.push((r) => vs.includes(r[c])); return b; },
    or(expr) { const partes = expr.split(','); st.filtros.push((r) => partes.some((p) => unFiltro(r, p))); return b; },
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
        if (tabla === 'partner_creditos' && v.tipo === 'referido' && filas().some((r) => r.tipo === 'referido' && r.referidor_ws === v.referidor_ws && r.referido_ws === v.referido_ws)) {
          return { data: null, error: { code: '23505', message: 'duplicate key' } };
        }
        filas().push({ id: filas().length + 1, created_at: '2026-11-22T10:00:00Z', ...v });
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
mock.module(${url('lib/workspace.ts')}, { exports: { ...real(ws), wsSuperAdmin: async () => 9, runWithWorkspace: async (_w, fn) => fn() } });
const mails = [];
const inv = await import(${url('lib/invitaciones.ts')});
mock.module(${url('lib/invitaciones.ts')}, { exports: { ...real(inv), avisarDePlataforma: async (m) => { mails.push({ to: m.to, tag: m.tag }); return { enviado: true }; } } });
const pa = await import(${url('lib/plan-acceso.ts')});
mock.module(${url('lib/plan-acceso.ts')}, { exports: { ...real(pa), vigenciaDe: async () => null } });
const le = await import(${url('lib/leads.ts')});
mock.module(${url('lib/leads.ts')}, { exports: { ...real(le), logLeadEvent: async () => {} } });
// La pasarela simulada: la prueba de cada negocio, su fin (27/10) y un cobro nuevo que queda pendiente en la base.
const cb = await import(${url('lib/cobros.ts')});
mock.module(${url('lib/cobros.ts')}, { exports: { ...real(cb),
  suscripcionDeMakoDe: async (w) => { const f = tablas.cobros.find((c) => c.alta_ws === w && c.creado_por === 'planes:pro:prueba'); return f ? { ...f } : null; },
  inicioDeLaPrueba: async () => '2026-10-27T10:00:00Z',
  linkDelCobro: (t) => 'https://hola-mako.com/pagar/' + t,
  crearCobro: async (plataforma, p) => {
    const id = 100 + tablas.cobros.length;
    tablas.cobros.push({ id, workspace_id: plataforma, tipo: p.tipo, lead_id: p.leadId, proveedor: p.pasarela, concepto: p.concepto, monto: p.monto,
      moneda: p.moneda, monto_usd: p.montoUsd, email: p.email, nombre: p.nombre, creado_por: p.creadoPor, estado: 'pendiente', alta_ws: null,
      alta_estado: null, alta_capa: null, ref_codigo: null, plan_mako: null, token: 'tok-' + id, created_at: '2026-10-22T10:00:00Z', pagado_at: null, cliente_ws: null });
    return { ok: true, cobro: { id }, link: 'https://hola-mako.com/pagar/tok-' + id };
  },
} });

const { empezarPlanAhora } = await import(${url('lib/empezar-plan.ts')});
const { acreditarReferidos, tableroDe, resumenDelPrograma } = await import(${url('lib/partners-programa.ts')});
const AHORA = Date.parse('2026-10-22T10:00:00Z');

const e20 = await empezarPlanAhora(20, 'Pablo Ríos', AHORA);
const e40 = await empezarPlanAhora(40, 'Laura', AHORA);
const e60 = await empezarPlanAhora(60, 'Luna', AHORA);
const reusado60 = { ...tablas.cobros.find((c) => c.id === 80) };
const nuevos60 = tablas.cobros.filter((c) => c.alta_ws === 60 && String(c.creado_por).startsWith('empezar-ya:')).length;
const nuevoDe = (w) => tablas.cobros.find((c) => c.alta_ws === w && String(c.creado_por).startsWith('empezar-ya:'));
const nuevo20 = { ...nuevoDe(20) };
const nuevo40 = { ...nuevoDe(40) };
// Se cobra el 1º mes de los cobros nuevos y la prueba queda anulada (lo que hace cerrarPruebaAlEmpezarYa, lib/cobros.ts).
for (const w of [20, 40]) {
  const n = nuevoDe(w);
  Object.assign(n, { estado: 'pagado', pagado_at: '2026-10-22T10:05:00Z', suscripcion_estado: 'activa' });
  Object.assign(tablas.cobros.find((c) => c.alta_ws === w && c.creado_por === 'planes:pro:prueba'), { estado: 'anulado', suscripcion_estado: 'cancelada' });
  tablas.pagos.push({ id: tablas.pagos.length + 1, workspace_id: 9, cobro_id: n.id, pagado: true, fecha_pago: '2026-10-22' });
}
const r1 = await acreditarReferidos();
const mails1 = mails.length;
// El tablero con el 1º mes pagado: la prueba del Parque está anulada, pero su cobro nuevo sigue vivo.
const tablero1 = await tableroDe(10);
// El 2º mes.
for (const w of [20, 40]) tablas.pagos.push({ id: tablas.pagos.length + 1, workspace_id: 9, cobro_id: nuevoDe(w).id, pagado: true, fecha_pago: '2026-11-22' });
const r2 = await acreditarReferidos();
const tablero = await tableroDe(10);
const programa = await resumenDelPrograma();
console.log(JSON.stringify({
  e20, e40, e60, reusado60, nuevos60, nuevo20, nuevo40, r1, r2, mails, mails1, creditos: tablas.partner_creditos,
  atado20: tablas.workspaces.find((w) => w.id === 20).referido_por_ws,
  atado40: tablas.workspaces.find((w) => w.id === 40).referido_por_ws,
  tablero1: { referidos: tablero1.referidos, resumen: tablero1.resumen },
  tablero: { referidos: tablero.referidos, resumen: tablero.resumen },
  programa: { referidos: programa.referidos, ganadoUsd: programa.ganadoUsd, aPagarUsd: programa.aPagarUsd },
}));
`;

type Cobro = { id: number; alta_ws: number | null; ref_codigo: string | null; alta_estado: string | null; plan_mako: string | null; creado_por: string };
type Corrida = { vistos: number; atados: number; acreditados: number };
type Tablero = { referidos: Array<{ ws: number; nombre: string; estado: string; mesesPagados: number }>; resumen: { ganadoUsd: number; aCobrarUsd: number; porGanarUsd: number } };
type Salida = {
  e20: { ok: boolean; link?: string }; e40: { ok: boolean; link?: string }; e60: { ok: boolean; link?: string }; reusado60: Cobro; nuevos60: number;
  nuevo20: Cobro; nuevo40: Cobro;
  r1: Corrida; r2: Corrida; mails: Array<{ to: string; tag: string }>; mails1: number;
  creditos: Array<{ referidor_ws: number; referido_ws: number; tipo: string; monto_usd: number }>;
  atado20: number | null; atado40: number | null;
  tablero1: Tablero; tablero: Tablero;
  programa: { referidos: number; ganadoUsd: number; aPagarUsd: number };
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

test('«Empezar mi plan ya» hereda el código del partner de la prueba, sin marcar el alta como hecha', () => {
  const s = correr();
  assert.equal(s.e20.ok, true);
  assert.equal(s.nuevo20.creado_por, 'empezar-ya:5');
  assert.equal(s.nuevo20.alta_ws, 20, 'atado a su negocio');
  assert.equal(s.nuevo20.plan_mako, 'pro');
  assert.equal(s.nuevo20.ref_codigo, 'estudio-sol', 'el código del partner que lo trajo pasa al cobro nuevo');
  assert.equal(s.nuevo20.alta_estado, null, "nunca 'hecha': le abriría el cambio de email del acceso (/api/pagar/email)");
});

test('pagado el 1º mes del cobro nuevo (la prueba, anulada): quedan atados y salen las bienvenidas', () => {
  const s = correr();
  assert.equal(s.atado20, 10, 'el Parque quedó como referido de Estudio Sol');
  assert.equal(s.r1.atados, 1);
  assert.equal(s.r1.acreditados, 0, 'con un mes, todavía no se gana');
  assert.deepEqual(s.mails.slice(0, s.mails1).map((m) => `${m.tag}→${m.to}`).sort(), ['partners-bienvenida→parque@ejemplo.com', 'partners-nuevo-referido→sol@ejemplo.com']);
});

test('pagado el 2º mes: el partner gana el 100% del primer mes, y el tablero y el panel del super admin lo cuentan', () => {
  const s = correr();
  assert.equal(s.r2.acreditados, 1);
  assert.deepEqual(s.creditos.map((c) => [c.referidor_ws, c.referido_ws, c.tipo, c.monto_usd]), [[10, 20, 'referido', 97]]);
  const parque = s.tablero.referidos.find((r) => r.ws === 20);
  assert.deepEqual(parque && [parque.estado, parque.mesesPagados], ['acreditado', 2], 'ya no figura «en camino» para siempre');
  assert.equal(s.tablero.resumen.aCobrarUsd, 97);
  assert.equal(s.programa.referidos, 1, 'el panel del super admin lo cuenta (con el mismo filtro que el cron)');
  assert.equal(s.programa.aPagarUsd, 97);
});

test('una prueba que NO creó la cuenta no pasa su código: el programa es para clientes nuevos', () => {
  const s = correr();
  assert.equal(s.e40.ok, true);
  assert.equal(s.nuevo40.ref_codigo, null);
  assert.equal(s.atado40, null);
  assert.ok(!s.creditos.some((c) => c.referido_ws === 40));
  assert.ok(!s.mails.some((m) => m.to === 'laura@ejemplo.com'));
});

test('el que canceló la prueba sin pagar nada figura «se fue» aunque su negocio siga activo; el que sigue en prueba, «en camino»', () => {
  const s = correr();
  const gimnasio = s.tablero.referidos.find((r) => r.ws === 50);
  assert.deepEqual(gimnasio && [gimnasio.estado, gimnasio.mesesPagados], ['se-fue', 0], "su negocio sigue 'activo': lo dicen sus cobros");
  const luna = s.tablero.referidos.find((r) => r.ws === 60);
  assert.deepEqual(luna && [luna.estado, luna.mesesPagados], ['registrado', 0], 'sigue en su prueba');
  assert.equal(s.tablero.resumen.porGanarUsd, 97, 'sólo Estudio Luna: ni el Parque (ya ganado) ni el gimnasio (se fue)');
  // Con la prueba ANULADA por «Empezar mi plan ya» y el cobro nuevo pagado, el Parque sigue: no «se fue».
  const parque1 = s.tablero1.referidos.find((r) => r.ws === 20);
  assert.deepEqual(parque1 && [parque1.estado, parque1.mesesPagados], ['primer-pago', 1]);
});

test('un link de «Empezar mi plan ya» abierto antes del arreglo (sin código) se reusa, y ahora lleva el código', () => {
  const s = correr();
  assert.deepEqual(s.e60, { ok: true, link: 'https://hola-mako.com/pagar/tok-80' }, 'el mismo link: no se abren dos');
  assert.equal(s.nuevos60, 1);
  assert.equal(s.reusado60.ref_codigo, 'estudio-sol', 'pagado, el partner cobra');
  assert.equal(s.reusado60.alta_estado, null);
});

// Roturas (25/10/2026; base 5 / 0), cada una restaurada (pasan / fallan):
//   · «Empezar mi plan ya» no copia el código de la prueba (como estaba)                       -> 1 / 4
//   · `acreditarReferidos` vuelve a exigir alta 'hecha' (como estaba)                          -> 2 / 3
//   · `resumenDelPrograma` vuelve a exigir alta 'hecha' (como estaba)                          -> 4 / 1
//   · `estadoDelReferido` con 0 meses y sin lugar vuelve a 'registrado' (como estaba)          -> 4 / 1
//   · el código se copia aunque la prueba no haya creado la cuenta                             -> 2 / 3
// Ronda 2 (25/10/2026; base 6 / 0; el gimnasio en 'activo', como en producción):
//   · `tableroDe` vuelve a sacar `vigente` sólo de workspaces.estado (como estaba)             -> 5 / 1
//   · invertida: `vigente` = activo Y `idos.has` (en vez de !idos.has)                         -> 5 / 1
//   · `seFueSegunSusCobros` no mira «ningún otro cobro vivo» (la prueba caída alcanza)          -> 5 / 1
//   · `seFueSegunSusCobros` da false siempre                                                   -> 5 / 1
//   · el link reusado no recibe el código (como estaba), o con la condición invertida          -> 5 / 1
