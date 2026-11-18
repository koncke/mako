// =============================================================================
// El camino del crédito de MaKo Partners, de punta a punta, con un cobro SIMULADO (24/10/2026)
// =============================================================================
// El Cerebro, 24/10: «probá el camino del crédito con un cobro simulado, no con uno real. Que cuando Martín pegue la clave
// no descubramos ahí que el crédito no se acredita. Hoy eso nunca se ejercitó». Medido ese día: la plataforma no tiene
// pasarela, el checkout corta antes de crear el cobro, y por eso ninguna compra con código existe en la base.
//
// Corre `acreditarReferidos` (lib/partners-programa.ts) REAL contra una base EN MEMORIA (lib/supabase.ts simulado) y con
// los mails anotados en vez de enviados (lib/invitaciones.ts simulado). Nada toca la base de producción ni manda un mail.
//   1. un negocio entra con el link de otro y paga su primer mes (por pasarela) → quedan atados, salen las DOS bienvenidas y ya
//      gana el 30 % de ESE pago, con el aviso al partner (18/11/2026: un crédito por cada pago, ya no se espera al 2º);
//   2. paga su segundo mes (por Binance) → gana el 30 % de ese pago, y sale otro aviso;
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
  pagos: [{ id: 1, workspace_id: 9, cobro_id: 1, pagado: true, fecha_pago: '2026-10-25', monto_usd: 101.85, proveedor: 'mercadopago', metodo: 'tarjeta' },
    { id: 10, workspace_id: 9, cobro_id: 2, pagado: true, fecha_pago: '2026-10-25', monto_usd: 47, proveedor: 'mercadopago', metodo: 'tarjeta' },
    { id: 11, workspace_id: 9, cobro_id: 2, pagado: true, fecha_pago: '2026-11-25', monto_usd: 47, proveedor: 'mercadopago', metodo: 'tarjeta' }],
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
        // Los índices únicos del libro (mig 0421): el crédito viejo (sin pago) es uno por negocio; el nuevo, uno por pago.
        if (tabla === 'partner_creditos' && v.tipo === 'referido' && filas().some((r) => r.tipo === 'referido' && r.referidor_ws === v.referidor_ws
          && (v.pago_id == null ? r.pago_id == null && r.referido_ws === v.referido_ws : r.pago_id === v.pago_id))) {
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
tablas.pagos.push({ id: 2, workspace_id: 9, cobro_id: 1, pagado: true, fecha_pago: '2026-11-25', monto_usd: 97, metodo: 'cripto', proveedor: null });
const r2 = await acreditarReferidos();
const mails2 = mails.length;
const r3 = await acreditarReferidos();
const tablero = await tableroDe(10);
const programa = await resumenDelPrograma();
const mailsAntes = [...mails];
const creditosAntes = tablas.partner_creditos.map((c) => ({ ...c }));
// Otro negocio, de antes: ya ganó con la regla VIEJA (renglón sin pago) y tiene 3 pagos; el 3º es de US$ 1.500 (una venta a mano).
tablas.workspaces.push({ id: 50, nombre: 'Gimnasio Norte', capa: 'completo', estado: 'activo', referido_por_ws: null });
tablas.cobros.push({ id: 3, workspace_id: 9, tipo: 'suscripcion', alta_ws: 50, ref_codigo: 'estudio-sol', alta_estado: 'hecha', estado: 'pagado',
  plan_mako: 'pro', monto_usd: 97, moneda: 'USD', created_at: '2026-08-25T10:00:00Z', cliente_ws: null });
tablas.pagos.push({ id: 20, workspace_id: 9, cobro_id: 3, pagado: true, fecha_pago: '2026-08-25', monto_usd: 97, metodo: 'cripto', proveedor: null },
  { id: 21, workspace_id: 9, cobro_id: 3, pagado: true, fecha_pago: '2026-09-25', monto_usd: 97, metodo: 'cripto', proveedor: null },
  { id: 22, workspace_id: 9, cobro_id: 3, pagado: true, fecha_pago: '2026-10-25', monto_usd: 1500, metodo: 'cripto', proveedor: null });
tablas.partner_creditos.push({ id: 99, referidor_ws: 10, referido_ws: 50, tipo: 'referido', monto_usd: 97, pago_id: null, canal: null, nota: 'regla vieja', created_at: '2026-10-20T10:00:00Z' });
const r4 = await acreditarReferidos();
const r5 = await acreditarReferidos();
console.log(JSON.stringify({
  r4, r5, creditosDe50: tablas.partner_creditos.filter((c) => c.referido_ws === 50).map((c) => ({ monto_usd: c.monto_usd, pago_id: c.pago_id, canal: c.canal })),
  r1, r2, r3, mails: mailsAntes, mails1, mails2, creditos: creditosAntes,
  atado: tablas.workspaces.find((w) => w.id === 20).referido_por_ws,
  atadoPlataforma: tablas.workspaces.find((w) => w.id === 30).referido_por_ws,
  tablero: { link: tablero.link, referidos: tablero.referidos, resumen: tablero.resumen },
  programa,
}));
`;

type Salida = {
  r4: { vistos: number; atados: number; acreditados: number }; r5: Salida['r1']; creditosDe50: Array<{ monto_usd: number; pago_id: number | null; canal: string | null }>;
  r1: { vistos: number; atados: number; acreditados: number }; r2: Salida['r1']; r3: Salida['r1'];
  mails: Array<{ to: string; tag: string; asunto: string }>; mails1: number; mails2: number;
  creditos: Array<{ referidor_ws: number; referido_ws: number; tipo: string; monto_usd: number; pago_id: number | null; canal: string | null }>;
  atado: number | null;
  atadoPlataforma: number | null;
  tablero: { link: string | null; referidos: Array<{ ws: number; nombre: string; estado: string; mesesPagados: number; mensualUsd: number | null; ganadoUsd: number }>; resumen: { ganadoUsd: number; aCobrarUsd: number; cadaMesUsd: number } };
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

test('primer pago (por pasarela): quedan atados, salen las DOS bienvenidas (a los admins) y ya gana el 30 % de ese pago', () => {
  const s = correr();
  assert.deepEqual(s.r1, { vistos: 2, atados: 1, acreditados: 1 });
  assert.equal(s.atadoPlataforma, null, 'el código de la plataforma no ata a nadie');
  assert.ok(!s.mails.some((m) => m.to === 'laura@ejemplo.com'), 'ni le da la bienvenida');
  assert.equal(s.atado, 10, 'el Parque quedó como referido de Estudio Sol');
  const bienvenidas = s.mails.slice(0, s.mails1).filter((m) => m.tag !== 'partners-credito');
  assert.deepEqual(bienvenidas.map((m) => `${m.tag}→${m.to}`).sort(), ['partners-bienvenida→parque@ejemplo.com', 'partners-nuevo-referido→sol@ejemplo.com']);
  assert.deepEqual(s.mails.slice(0, s.mails1).filter((m) => m.tag === 'partners-credito').map((m) => m.to), ['sol@ejemplo.com'], 'y el aviso de lo ganado en ese primer pago');
  assert.ok(!bienvenidas.some((m) => m.to === 'closer@ejemplo.com'), 'la bienvenida es para los admins, no para el closer');
  assert.match(bienvenidas.find((m) => m.tag === 'partners-bienvenida')!.asunto, /de parte de Estudio Sol/);
});

test('segundo pago (por Binance): gana el 30 % de ese pago, un crédito por cada pago, y el partner recibe otro aviso', () => {
  const s = correr();
  assert.deepEqual(s.r2, { vistos: 2, atados: 0, acreditados: 1 });
  assert.deepEqual(s.creditos.map((c) => [c.referidor_ws, c.referido_ws, c.tipo, c.monto_usd, c.pago_id, c.canal]), [
    [10, 20, 'referido', 29.1, 1, 'pasarela'],
    [10, 20, 'referido', 29.1, 2, 'directo'],
  ]);
  const aviso = s.mails.slice(s.mails1, s.mails2);
  assert.deepEqual(aviso.map((m) => `${m.tag}→${m.to}`), ['partners-credito→sol@ejemplo.com']);
  assert.match(aviso[0].asunto, /^Ganaste US\$\s?29,10/, 'en dinero: «Ganaste US$ 29,10», no «crédito»');
});

test('el cron vuelve a correr: nada se repite (ni el crédito, ni un mail)', () => {
  const s = correr();
  assert.deepEqual(s.r3, { vistos: 2, atados: 0, acreditados: 0 });
  assert.equal(s.creditos.length, 2, 'un crédito por cada pago, y ninguno repetido');
  assert.equal(s.mails.length, s.mails2, 'el cron no vuelve a mandar nada');
});

test('el tablero del partner y el panel del super admin cuentan lo mismo', () => {
  const s = correr();
  assert.equal(s.tablero.link, 'https://hola-mako.com/r/estudio-sol');
  assert.deepEqual(s.tablero.referidos.map((r) => [r.nombre, r.estado, r.mesesPagados]), [['Inmobiliaria del Parque', 'pagando', 2]]);
  assert.equal(s.tablero.referidos[0].mensualUsd, 29.1, 'lo que deja cada mes: el 30 % de US$ 97, con el canal de su último pago (Binance)');
  assert.equal(s.tablero.referidos[0].ganadoUsd, 58.2);
  assert.equal(s.tablero.resumen.ganadoUsd, 58.2);
  assert.equal(s.tablero.resumen.cadaMesUsd, 29.1);
  assert.equal(s.tablero.resumen.aCobrarUsd, 58.2, 'todavía nadie se lo transfirió');
  assert.equal(s.programa.referidos, 1, 'Coach Laura (código de la plataforma) no cuenta');
  assert.equal(s.programa.partners, 1, 'partners = los que terminaron el alta (la plataforma tiene código y no cuenta)');
  assert.equal(s.programa.ganadoUsd, 58.2);
  assert.equal(s.programa.aPagarUsd, 58.2);
  assert.deepEqual(s.programa.lista.map((p) => [p.nombre, p.referidos, p.ganadoUsd, p.aCobrarUsd, p.cobro]), [['Estudio Sol', 1, 58.2, 58.2, 'estudio.sol.mp']]);
});

test('quien ya ganó con la regla VIEJA no cobra de nuevo por sus 2 primeros pagos; el 3º sí, con TOPE en el precio de lista (US$ 1.500 → US$ 97)', () => {
  const s = correr();
  assert.equal(s.r4.acreditados, 1, 'sólo el 3er pago');
  assert.deepEqual(s.creditosDe50, [{ monto_usd: 97, pago_id: null, canal: null }, { monto_usd: 29.1, pago_id: 22, canal: 'directo' }], 'el viejo queda como estaba y el nuevo es el 30 % de US$ 97, no de 1.500');
  assert.equal(s.r5.acreditados, 0, 'y no se repite');
});

// Roturas (24/10/2026; base 4 / 0), cada una restaurada (pasan / fallan):
//   · atar sin mirar si ya estaba atado (las bienvenidas se repiten en cada corrida)           -> 2 / 2
//   · el crédito vale 0                                                                        -> 1 / 3
//   · la bienvenida también al closer                                                          -> 3 / 1
//   · el código de la plataforma ata y acredita                                                -> 0 / 4
