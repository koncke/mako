// =============================================================================
// El retargeting de los funnels sin VSL: la revisión semanal de punta a punta (13/11/2026, lib/retargeting-motor.ts)
// =============================================================================
// El motor REAL con puertos en memoria que anotan cada llamada: la IA, las etiquetas, el historial y Meta. Cuatro lunes seguidos
// sobre el mismo negocio:
//   1. con los públicos APAGADOS: etiquetas y historial, la IA sólo con los dudosos, y Meta ni se mira;
//   2. prendidos y sin mensajes nuevos: la IA no se llama, y los dos públicos se crean con quien corresponde;
//   3. Caro compra: sale de «No avanzaron», entra a «Compraron», cambia su etiqueta, y no se crea nada de nuevo;
//   4. en seco, con un mensaje nuevo: la IA lee sólo ése y Meta no se llama.
// Y aparte: sin IA, el token vencido, y una etiqueta que puso una persona no se saca.
//
// Correr: node --import tsx --test tests/retargeting-motor.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { revisarCon, type ConfigRT, type EstadoRT, type PuertosRT, type ViaMeta } from '../lib/retargeting-motor';
import type { ChatRT, LeadRT, Persona } from '../lib/retargeting-reglas';

const DIA = 86_400_000;
const LUNES = new Date('2026-11-16T11:00:00Z');
const hace = (d: number, desde = LUNES) => new Date(desde.getTime() - d * DIA).toISOString();
const lead = (id: number, nombre: string, x: Partial<LeadRT> = {}): LeadRT => ({ id, nombre, telefono: `54911000000${id}`, email: null, cerro: null, etapa: 'lead', cobrado: null, agenda: null, enVsl: false, ...x });
let idMsg = 0;
const charla = (leadId: number, ...ms: Array<['N' | 'L', number, string?]>): ChatRT => ({ leadId, mensajes: ms.map(([q, d, t]) => ({ id: ++idMsg, deNegocio: q === 'N', at: hace(d), texto: t ?? 'hola' })) });

/** El negocio: nueve leads, uno por caso. */
function negocio() {
  const leads: LeadRT[] = [
    lead(1, 'Ana', { cerro: true }),
    lead(2, 'Beto'),
    lead(3, 'Caro'),
    lead(4, 'Dani'),
    lead(5, 'Eli', { enVsl: true }),
    lead(6, 'Fede', { agenda: hace(-1) }),
    lead(7, 'Gabi'),
    lead(8, 'Hugo', { enVsl: true, cerro: true }),
    lead(9, 'Iva'),
  ];
  const chats = new Map<number, ChatRT>([
    [1, charla(1, ['L', 20], ['N', 20, 'te paso el link de pago'], ['L', 19, 'pagado'])],
    [2, charla(2, ['L', 10, 'Hola, quiero info'], ['N', 10, '¡Hola! Te cuento cómo trabajamos'])],
    [3, charla(3, ['L', 9], ['N', 9, 'El programa sale US$ 500'], ['L', 6, 'lo pienso'])],
    [4, charla(4, ['L', 3], ['N', 2], ['L', 1, '¿mañana hablamos?'])],
    [5, charla(5, ['L', 9], ['N', 9], ['L', 8])],
    [6, charla(6, ['L', 9], ['N', 9], ['L', 8, 'listo, agendé'])],
    [7, charla(7, ['L', 9, 'busco trabajo'], ['N', 9, '¿Qué buscas?'], ['L', 8, 'trabajo de vendedor'])],
  ]);
  return { leads, chats };
}

/** Los puertos en memoria: lo que el motor le pide al mundo, anotado. */
function puertos(n: ReturnType<typeof negocio>, o: { config?: ConfigRT; via?: ViaMeta; ia?: (u: string) => string; freno?: string | null; ahora?: Date } = {}) {
  const r = {
    estado: null as EstadoRT | null, ia: [] as string[], poner: [] as Array<[string, number[]]>, sacar: [] as Array<[string, number[]]>,
    historial: [] as Array<{ leadId: number; texto: string }>, crear: [] as string[], agregar: [] as Array<[string, Persona[]]>, quitar: [] as Array<[string, Persona[]]>,
    etiquetas: new Map<string, number>(), config: o.config ?? { publicosMeta: false }, via: o.via ?? ('zernio' as ViaMeta), ahora: o.ahora ?? LUNES,
    iaResponde: o.ia ?? ((u: string) => JSON.stringify({ r: [...u.matchAll(/### id (\d+)/g)].map((m) => ({ id: Number(m[1]), v: m[1] === '7' ? 'no_califica' : 'no_compro', por: m[1] === '7' ? 'busca trabajo, no es cliente' : 'le pasaron el precio y no volvió' })) })),
    freno: o.freno ?? null,
  };
  const nombre = (id: number) => [...r.etiquetas].find(([, v]) => v === id)![0];
  const p: PuertosRT = {
    ahora: () => r.ahora,
    leads: async () => n.leads,
    chats: async (ids) => new Map([...n.chats].filter(([id]) => ids.includes(id))),
    chatsSinLead: async () => 4,
    estado: async () => (r.estado ? JSON.parse(JSON.stringify(r.estado)) : null),
    guardarEstado: async (e) => { r.estado = JSON.parse(JSON.stringify(e)); },
    config: async () => r.config,
    ia: async (_s, u) => { r.ia.push(u); return r.iaResponde(u); },
    etiquetas: {
      asegurar: async (s) => { if (!r.etiquetas.has(s)) r.etiquetas.set(s, 100 + r.etiquetas.size); return r.etiquetas.get(s)!; },
      poner: async (ids, e) => { r.poner.push([nombre(e), ids]); },
      sacar: async (ids, e) => { r.sacar.push([nombre(e), ids]); },
    },
    historial: async (f) => { r.historial.push(...f); },
    meta: {
      via: async () => r.via,
      freno: async () => r.freno,
      crear: async (cual) => { r.crear.push(cual); return { metaId: `meta-${cual}`, zernioId: `z-${cual}` }; },
      agregar: async (pub, ps) => { r.agregar.push([pub.metaId, ps]); },
      sacar: async (pub, ps) => { r.quitar.push([pub.metaId, ps]); },
    },
  };
  return { p, r, limpiar: () => { r.ia = []; r.poner = []; r.sacar = []; r.historial = []; r.crear = []; r.agregar = []; r.quitar = []; } };
}
const tel = (id: number) => ({ phone: `54911000000${id}` });

test('cuatro lunes seguidos: etiquetas, la IA sólo con lo que se movió, y Meta sólo prendido y nunca en seco', async () => {
  const n = negocio();
  const { p, r, limpiar } = puertos(n);

  // 1. Públicos APAGADOS.
  const uno = await revisarCon(p, { enSeco: false });
  assert.equal(r.ia.length, 1, 'una sola llamada: Caro y Gabi caben en un lote');
  assert.deepEqual([...r.ia[0].matchAll(/### id (\d+)/g)].map((m) => m[1]), ['3', '7'], 'la IA lee SÓLO a los dudosos: ni Beto (no respondió), ni Dani (sigue), ni Eli (VSL)');
  assert.doesNotMatch(r.ia[0], /Hola, quiero info/, 'la charla de Beto no viaja a la IA');
  assert.deepEqual(uno.segmentos, { no_respondio: 1, no_siguio: 0, no_compro: 1, no_califica: 1, compro: 1, sigue: 1, agendo: 1 });
  assert.deepEqual(r.poner.sort(), [['compro', [1]], ['no_califica', [7]], ['no_compro', [3]], ['no_respondio', [2]]], 'Hugo compró en un funnel VSL: no lleva etiqueta');
  assert.equal(r.sacar.length, 0);
  assert.deepEqual(r.historial.map((h) => h.leadId).sort(), [1, 2, 3, 7]);
  assert.equal(r.historial.find((h) => h.leadId === 3)!.texto, 'Retargeting: no compró — le pasaron el precio y no volvió (lo leyó MaKo en su charla de WhatsApp)');
  assert.equal(r.historial.find((h) => h.leadId === 1)!.texto, 'Retargeting: compró — figura como venta en el CRM', 'lo que dice el CRM no se atribuye a la charla');
  assert.equal(r.crear.length + r.agregar.length, 0, 'con el interruptor apagado, Meta ni se toca');
  assert.equal(uno.publicosMeta.prendido, false);
  assert.equal(uno.chatsSinLead, 4);
  assert.equal(uno.cambios.llamadasIA, 1);

  // 2. Prendidos, sin mensajes nuevos.
  limpiar(); r.config = { publicosMeta: true };
  const dos = await revisarCon(p, { enSeco: false });
  assert.equal(r.ia.length, 0, '⛔ sin mensajes nuevos la IA no se vuelve a llamar (el costo de Leila)');
  assert.deepEqual(r.poner, [], 'las etiquetas ya estaban');
  assert.deepEqual(r.historial, [], 'nada cambió: nada nuevo en el historial');
  assert.deepEqual(r.crear.sort(), ['compraron', 'noAvanzaron']);
  assert.deepEqual(r.agregar.find(([m]) => m === 'meta-noAvanzaron')![1], [tel(2), tel(3)], 'no avanzaron: Beto y Caro; Gabi no califica, Dani sigue, Fede agendó');
  assert.deepEqual(r.agregar.find(([m]) => m === 'meta-compraron')![1], [tel(1), tel(8)], 'compraron: también Hugo, aunque sea de un funnel VSL');
  assert.deepEqual(dos.publicosMeta.noAvanzaron, { metaId: 'meta-noAvanzaron', personas: 2 });
  assert.deepEqual(dos.publicosMeta.compraron, { metaId: 'meta-compraron', personas: 2 });

  // 3. Caro compra.
  limpiar(); n.leads[2].cerro = true;
  await revisarCon(p, { enSeco: false });
  assert.equal(r.ia.length, 0);
  assert.deepEqual(r.crear, [], 'los públicos ya existen');
  assert.deepEqual(r.quitar, [['meta-noAvanzaron', [tel(3)]]], 'a quien compró nunca más el anuncio de retargeting');
  assert.deepEqual(r.agregar, [['meta-compraron', [tel(3)]]]);
  assert.deepEqual(r.sacar, [['no_compro', [3]]]);
  assert.deepEqual(r.poner, [['compro', [3]]]);

  // 4. En seco, con un mensaje nuevo de Gabi.
  limpiar(); n.chats.get(7)!.mensajes.push({ id: ++idMsg, deNegocio: false, at: hace(4), texto: 'igual me interesa el curso' });
  r.iaResponde = (u) => JSON.stringify({ r: [...u.matchAll(/### id (\d+)/g)].map((m) => ({ id: Number(m[1]), v: 'no_siguio', por: 'preguntó por el curso y no siguió' })) });
  const cuatro = await revisarCon(p, { enSeco: true });
  assert.equal(r.ia.length, 1);
  assert.deepEqual([...r.ia[0].matchAll(/### id (\d+)/g)].map((m) => m[1]), ['7'], 'sólo la charla que se movió');
  assert.deepEqual([r.crear, r.agregar, r.quitar], [[], [], []], '⛔ en seco Meta no se llama');
  assert.deepEqual(cuatro.cambios.alPublico, { agregar: 1, sacar: 0 }, 'pero dice lo que haría: Gabi entraría a «No avanzaron»');
  assert.deepEqual(r.sacar, [['no_califica', [7]]]);
  assert.deepEqual(r.poner, [['no_siguio', [7]]], 'las etiquetas sí se ponen en seco');
  assert.equal(cuatro.enSeco, true);
});

test('sin la IA del negocio: los dudosos quedan sin revisar, nada se rompe y lo demás sigue', async () => {
  const { p, r } = puertos(negocio(), { ia: () => { throw new Error('Sin proveedor de IA barata'); } });
  const x = await revisarCon(p, { enSeco: false });
  assert.equal(r.ia.length, 1, 'el primer lote que falla corta los demás: no se insiste');
  assert.equal(x.sinRevisar, 2);
  assert.deepEqual(r.poner.map(([s]) => s).sort(), ['compro', 'no_respondio'], 'lo que decidió el código se marca igual');
  assert.match(x.publicosMeta.aviso ?? '', /La IA del negocio no contestó: Sin proveedor/);
});

test('el token vencido frena a Meta y lo dice; una etiqueta que no puso MaKo no se saca', async () => {
  const n = negocio();
  const { p, r } = puertos(n, { config: { publicosMeta: true }, via: 'token', freno: 'El token de Meta venció: conecta Meta por Zernio.' });
  r.estado = { v: 1, revisadoAt: null, enSeco: false, leads: {}, etiquetados: {}, publicos: {}, conteo: { segmentos: { no_respondio: 0, no_siguio: 0, no_compro: 0, no_califica: 0, compro: 0, sigue: 0, agendo: 0 }, sinRevisar: 0, chatsSinLead: 0 }, aviso: null };
  const x = await revisarCon(p, { enSeco: false });
  assert.deepEqual([r.crear, r.agregar], [[], []]);
  assert.match(x.publicosMeta.aviso ?? '', /El token de Meta venció/);
  // Dani sigue: no tenía etiqueta de MaKo, así que nada se le saca aunque una persona le haya puesto «Retargeting: no siguió» a mano.
  assert.ok(!r.sacar.some(([, ids]) => ids.includes(4)));
});
