// =============================================================================
// El recolector del Second Brain, EJERCITADO: `recolectarWhatsApp` de verdad contra una base en memoria (25/10/2026)
// =============================================================================
// Sin la app levantada (en local escribe en producción) y sin IA: la base, el setting, la IA del negocio y el conocimiento
// van simulados, y el código del recolector corre tal cual. Lo que se mide, vuelta por vuelta:
//   1. lee SÓLO la conversación de una persona con un lead (ni el grupo ni el chat personal sin lead), le pide los hechos a
//      la IA y guarda UNA entrada con su procedencia; la marca queda en el último mensaje leído;
//   2. sin mensajes nuevos, no vuelve a pedir nada ni duplica;
//   3. con mensajes nuevos, ACTUALIZA la misma entrada partiendo de lo que ya sabía;
//   4. si la IA falla, la marca de esa conversación NO avanza (se vuelve a leer) y la vuelta lo dice;
//   5. un negocio sin su IA no corre, y uno apagado tampoco;
//   6. un CLIENTE que nunca tocó el interruptor no corre (arranca apagado: gasta SU IA), y el espacio de MaKo sí.
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
let wsActual = 10;
const min = (h, m) => new Date(Date.UTC(2026, 9, 24, h, m)).toISOString();
const tablas = {
  leads: [{ id: 5, workspace_id: 10, nombre: 'Ana Gómez' }, { id: 6, workspace_id: 10, nombre: 'Beto Ruiz' }],
  wa_mensajes: [
    { workspace_id: 10, chat_jid: 'ana@s.whatsapp.net', wa_timestamp: min(12, 0), from_me: false, tipo: 'text', texto: '¿Cuánto sale el plan Pro?', lead_id: 5, push_name: 'Ani', telefono: '5491100000001' },
    { workspace_id: 10, chat_jid: 'ana@s.whatsapp.net', wa_timestamp: min(12, 5), from_me: true, tipo: 'text', texto: 'US$ 97 por mes', lead_id: 5, push_name: null, telefono: '5491100000001' },
    { workspace_id: 10, chat_jid: 'ana@s.whatsapp.net', wa_timestamp: min(12, 9), from_me: false, tipo: 'text', texto: 'Tengo una inmobiliaria, llámame el lunes', lead_id: 5, push_name: 'Ani', telefono: '5491100000001' },
    // Un grupo y un chat personal (sin lead): nunca se leen.
    ...[0, 1, 2].map((i) => ({ workspace_id: 10, chat_jid: 'grupo@g.us', wa_timestamp: min(11, i), from_me: false, tipo: 'text', texto: 'GRUPO-' + i, lead_id: 5, push_name: null, telefono: null })),
    ...[0, 1, 2].map((i) => ({ workspace_id: 10, chat_jid: 'mama@s.whatsapp.net', wa_timestamp: min(10, i), from_me: false, tipo: 'text', texto: 'PERSONAL-' + i, lead_id: null, push_name: 'Mamá', telefono: null })),
    // Otro negocio: lo suyo nunca se mezcla.
    ...[0, 1, 2].map((i) => ({ workspace_id: 20, chat_jid: 'otro@s.whatsapp.net', wa_timestamp: min(9, i), from_me: false, tipo: 'text', texto: 'OTRO-' + i, lead_id: 7, push_name: null, telefono: null })),
  ],
  second_brain_recolectado: [],
  mako_knowledge: [],
};
function from(tabla) {
  const st = { filtros: [], op: 'select', valores: null, orden: null, lim: null, single: false, head: false };
  const filas = () => (tablas[tabla] ??= []);
  const b = {
    select(_c, o) { st.head = !!o?.head; return b; },
    eq(c, v) { st.filtros.push((r) => r[c] === v); return b; },
    neq(c, v) { st.filtros.push((r) => r[c] !== v); return b; },
    gte(c, v) { st.filtros.push((r) => r[c] >= v); return b; },
    gt(c, v) { st.filtros.push((r) => r[c] > v); return b; },
    lt(c, v) { st.filtros.push((r) => r[c] < v); return b; },
    in(c, vs) { st.filtros.push((r) => vs.includes(r[c])); return b; },
    order(c, o) { st.orden = { c, asc: o?.ascending !== false }; return b; },
    limit(n) { st.lim = n; return b; },
    range() { return b; },
    maybeSingle() { st.single = true; return b; },
    upsert(v) { st.op = 'upsert'; st.valores = v; return b; },
    then(ok, mal) { try { ok(ejecutar()); } catch (e) { mal(e); } },
  };
  function ejecutar() {
    // El proxy por negocio (getTenantDb): todo lo que se lee y se escribe, con SU workspace.
    st.filtros.push((r) => r.workspace_id === wsActual);
    if (st.op === 'upsert') {
      const v = { ...st.valores, workspace_id: wsActual };
      const i = filas().findIndex((r) => r.workspace_id === v.workspace_id && r.fuente === v.fuente && r.ref === v.ref);
      if (i >= 0) filas()[i] = { ...filas()[i], ...v }; else filas().push({ id: filas().length + 1, ...v });
      return { data: null, error: null };
    }
    let rs = filas().filter((r) => st.filtros.every((f) => f(r)));
    if (st.orden) rs = [...rs].sort((x, y) => (x[st.orden.c] > y[st.orden.c] ? 1 : x[st.orden.c] < y[st.orden.c] ? -1 : 0) * (st.orden.asc ? 1 : -1));
    if (st.lim != null) rs = rs.slice(0, st.lim);
    if (st.head) return { data: null, count: rs.length, error: null };
    if (st.single) return { data: rs[0] ? { ...rs[0] } : null, error: null };
    return { data: rs.map((r) => ({ ...r })), error: null };
  }
  return b;
}
const ws = await import(${url('lib/workspace.ts')});
mock.module(${url('lib/workspace.ts')}, { exports: { ...real(ws), getTenantDb: async () => ({ from }), wsSuperAdmin: async () => 9 } });
const settings = { '10:second-brain.recolector': JSON.stringify({ prendido: true }) };
const st = await import(${url('lib/settings.ts')});
mock.module(${url('lib/settings.ts')}, { exports: { ...real(st), getSetting: async (k) => settings[wsActual + ':' + k] ?? null, setSetting: async (k, v) => { settings[wsActual + ':' + k] = v; } } });
const pag = await import(${url('lib/supabase-paginado.ts')});
mock.module(${url('lib/supabase-paginado.ts')}, { exports: { ...real(pag), leerTodo: async (db, t, c, o) => { let q = db.from(t).select(c); if (o?.filtros) q = o.filtros(q); const r = await q; return r.data; } } });
const ian = await import(${url('lib/ia-del-negocio.ts')});
mock.module(${url('lib/ia-del-negocio.ts')}, { exports: { ...real(ian), claveDeIAPropia: async (w) => w !== 30 } });
const tz = await import(${url('lib/timezone.ts')});
mock.module(${url('lib/timezone.ts')}, { exports: { ...real(tz), tzDeWorkspace: async () => 'America/Argentina/Buenos_Aires' } });
const pedidos = [];
let falla = false;
const ai = await import(${url('lib/ai-cheap.ts')});
mock.module(${url('lib/ai-cheap.ts')}, { exports: { ...real(ai), chatCheapCascade: async (o) => {
  pedidos.push({ ws: wsActual, user: o.user, feature: o.feature, pii: o.pii });
  if (falla) { o.erroresOut?.push('gemini: 503'); return ''; }
  return o.user.includes('Lo que ya se sabía') ? '- Quiere el plan Pro\\n- Tiene una inmobiliaria\\n- Ya pagó el primer mes' : '- Quiere el plan Pro\\n- Tiene una inmobiliaria\\n- Pidió que lo llamen el lunes';
} } });
const kn = await import(${url('lib/mako-knowledge.ts')});
mock.module(${url('lib/mako-knowledge.ts')}, { exports: { ...real(kn),
  createKnowledge: async (i) => { const row = { id: tablas.mako_knowledge.length + 1, workspace_id: wsActual, estado: 'indexado', ...i }; tablas.mako_knowledge.push(row); return row; },
  updateKnowledge: async (id, f) => { const r = tablas.mako_knowledge.find((x) => x.id === id && x.workspace_id === wsActual); if (!r) return null; Object.assign(r, f); return r; },
} });

const { recolectarWhatsApp } = await import(${url('lib/recolector.ts')});
const ahora = new Date('2026-10-25T03:00:00Z');
const deadline = Date.now() + 200_000;
const foto = () => JSON.parse(JSON.stringify({ libro: tablas.second_brain_recolectado, kn: tablas.mako_knowledge }));

const v1 = await recolectarWhatsApp(10, { deadline, ahora }); const f1 = foto(); const p1 = pedidos.length;
const v2 = await recolectarWhatsApp(10, { deadline, ahora }); const p2 = pedidos.length;
for (const [i, t] of ['Ya pagué', 'Perfecto, gracias', '¿Cuándo empezamos?'].entries()) tablas.wa_mensajes.push({ workspace_id: 10, chat_jid: 'ana@s.whatsapp.net', wa_timestamp: min(20, i), from_me: false, tipo: 'text', texto: t, lead_id: 5, push_name: 'Ani', telefono: '5491100000001' });
const v3 = await recolectarWhatsApp(10, { deadline, ahora }); const f3 = foto(); const p3 = pedidos.length;
for (const [i, t] of ['Hola', 'Quiero info', 'del plan Esencial'].entries()) tablas.wa_mensajes.push({ workspace_id: 10, chat_jid: 'beto@s.whatsapp.net', wa_timestamp: min(21, i), from_me: false, tipo: 'text', texto: t, lead_id: 6, push_name: 'Beto', telefono: '5491100000002' });
falla = true;
const v4 = await recolectarWhatsApp(10, { deadline, ahora }); const f4 = foto();
falla = false;
wsActual = 30; settings['30:second-brain.recolector'] = JSON.stringify({ prendido: true }); const v5 = await recolectarWhatsApp(30, { deadline, ahora });
wsActual = 20; settings['20:second-brain.recolector'] = JSON.stringify({ prendido: false }); const v6 = await recolectarWhatsApp(20, { deadline, ahora });
wsActual = 40; const v7 = await recolectarWhatsApp(40, { deadline, ahora });
wsActual = 9; const v8 = await recolectarWhatsApp(9, { deadline, ahora });
console.log(JSON.stringify({ v1, v2, v3, v4, v5, v6, v7, v8, f1, f3, f4, p1, p2, p3, pedidos, settings10: settings['10:second-brain.recolector'] ?? null }));
`;

type Fila = { ref: string; etiqueta: string; knowledge_id: number | null; mensajes: number; hasta: string; fuente: string };
type Entrada = { id: number; titulo: string; cuerpo: string; fuente: string; area: string; categoria: string };
type Vuelta = { resultado: string; motivo?: string; pendientes: number; nuevas: number; actualizadas: number; leidas: number };
type Salida = {
  v1: Vuelta; v2: Vuelta; v3: Vuelta; v4: Vuelta; v5: Vuelta; v6: Vuelta; v7: Vuelta; v8: Vuelta;
  f1: { libro: Fila[]; kn: Entrada[] }; f3: { libro: Fila[]; kn: Entrada[] }; f4: { libro: Fila[]; kn: Entrada[] };
  p1: number; p2: number; p3: number; pedidos: Array<{ ws: number; user: string; feature: string; pii: boolean }>; settings10: string | null;
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

test('1ª vuelta: sólo la conversación con el lead, una entrada con su procedencia, y la marca en el último mensaje', () => {
  const s = correr();
  assert.deepEqual({ r: s.v1.resultado, n: s.v1.nuevas, a: s.v1.actualizadas, l: s.v1.leidas }, { r: 'ok', n: 1, a: 0, l: 3 });
  assert.equal(s.p1, 1, 'una sola conversación fue a la IA');
  const pedido = s.pedidos[0];
  assert.equal(pedido.feature, 'second-brain-recolector');
  assert.equal(pedido.pii, true);
  assert.match(pedido.user, /Conversación de WhatsApp con: Ana Gómez/, 'con el nombre del lead del CRM');
  assert.doesNotMatch(pedido.user, /GRUPO-|PERSONAL-|OTRO-/, 'ni el grupo, ni el chat personal, ni otro negocio');
  assert.equal(s.f1.kn.length, 1);
  const e = s.f1.kn[0];
  assert.deepEqual([e.titulo, e.fuente, e.area, e.categoria], ['WhatsApp · Ana Gómez', 'whatsapp', 'general', 'WhatsApp']);
  assert.match(e.cuerpo, /- Pidió que lo llamen el lunes/);
  assert.match(e.cuerpo, /Fuente: la conversación de WhatsApp con Ana Gómez, mensajes del 24\/10\/2026\. Lo recolectó MaKo el 25\/10\/2026\./);
  assert.deepEqual(s.f1.libro.map((f) => [f.ref, f.knowledge_id, f.mensajes, f.hasta]), [['ana@s.whatsapp.net', 1, 3, '2026-10-24T12:09:00.000Z']]);
  assert.match(s.settings10 ?? '', /"resultado"/, 'la vuelta queda anotada para la pantalla');
});

test('2ª vuelta sin mensajes nuevos: no pide nada ni duplica', () => {
  const s = correr();
  assert.equal(s.p2, s.p1, 'ningún pedido más a la IA');
  assert.deepEqual({ r: s.v2.resultado, p: s.v2.pendientes, n: s.v2.nuevas }, { r: 'ok', p: 0, n: 0 });
});

test('3ª vuelta con mensajes nuevos: ACTUALIZA la misma entrada partiendo de lo que ya sabía', () => {
  const s = correr();
  assert.equal(s.p3, s.p2 + 1);
  assert.match(s.pedidos[s.p3 - 1].user, /Lo que ya se sabía:\n- Quiere el plan Pro\n- Tiene una inmobiliaria\n- Pidió que lo llamen el lunes/);
  assert.match(s.pedidos[s.p3 - 1].user, /Ya pagué/);
  assert.doesNotMatch(s.pedidos[s.p3 - 1].user, /¿Cuánto sale el plan Pro\?/, 'sólo lo nuevo (lo viejo ya está en los hechos)');
  assert.deepEqual({ n: s.v3.nuevas, a: s.v3.actualizadas }, { n: 0, a: 1 });
  assert.equal(s.f3.kn.length, 1, 'la misma entrada, no otra');
  assert.match(s.f3.kn[0].cuerpo, /- Ya pagó el primer mes/);
  assert.match(s.f3.kn[0].cuerpo, /mensajes hasta el 24\/10\/2026/);
  assert.deepEqual(s.f3.libro.map((f) => [f.mensajes, f.hasta]), [[6, '2026-10-24T20:02:00.000Z']]);
});

test('4ª vuelta con la IA caída: la marca de la conversación NO avanza y la vuelta lo dice', () => {
  const s = correr();
  assert.equal(s.v4.resultado, 'error');
  assert.match(s.v4.motivo ?? '', /la IA no respondió \(gemini: 503\)/);
  assert.ok(!s.f4.libro.some((f) => f.ref === 'beto@s.whatsapp.net'), 'Beto se vuelve a leer la próxima vez');
  assert.equal(s.f4.kn.length, 1, 'no se guardó nada a medias');
});

test('un negocio sin su IA no corre (no gasta la nuestra), y uno apagado tampoco', () => {
  const s = correr();
  assert.equal(s.v5.resultado, 'sin-ia');
  assert.equal(s.v6.resultado, 'apagado');
  assert.ok(!s.pedidos.some((p) => p.ws === 30 || p.ws === 20), 'ningún pedido a la IA de esos negocios');
});

test('un CLIENTE que nunca lo prendió no corre (gasta SU IA), y el espacio de MaKo arranca prendido', () => {
  const s = correr();
  assert.equal(s.v7.resultado, 'apagado', 'un cliente sin tocar el interruptor');
  assert.ok(!s.pedidos.some((p) => p.ws === 40), 'ni un pedido a su IA');
  assert.notEqual(s.v8.resultado, 'apagado', 'el negocio de Martín, prendido sin tocar nada');
});
