// =============================================================================
// La marca de «automático» en los WhatsApp que salen (lib/evolution-envio.ts, mig 0396), EJECUTADA
// =============================================================================
// El «tiempo hasta el primer contacto» (lib/primer-contacto.ts) no cuenta lo que manda una automatización. La marca la pone el
// emisor con un UPDATE por el id DESPUÉS del upsert (así sobrevive al eco del webhook), sólo si es automático, y sin la migración
// aplicada no rompe el envío. `server-only`, la base y Evolution se reemplazan con Module._load (el molde de
// tests/zernio-webhook-suscripcion.test.ts) y se anota cada escritura.
// Probado rompiéndolo (5/11/2026, base 4/0):
//   · sin llamar a `marcarSiEsAutomatico` después del upsert                 → 2/2 (el 1 y el 4);
//   · marcar también lo de una persona                                       → 3/1 (el 2);
//   · tirar con «la columna no existe»                                       → 3/1 (el 3).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';

type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
type Escritura = { tabla: string; op: 'upsert' | 'update'; datos: Record<string, unknown>; filtros: Array<[string, unknown]> };

const escrituras: Escritura[] = [];
let errorDelUpdate: { code?: string; message: string } | null = null;
let idDeEvolution: string | null = 'WAMID-1';

const db = {
  from(tabla: string) {
    return {
      upsert: async (datos: Record<string, unknown>) => { escrituras.push({ tabla, op: 'upsert', datos, filtros: [] }); return { error: null }; },
      update(datos: Record<string, unknown>) {
        const e: Escritura = { tabla, op: 'update', datos, filtros: [] };
        escrituras.push(e);
        const cadena = {
          eq(k: string, v: unknown) { e.filtros.push([k, v]); return cadena; },
          then(ok: (r: { error: unknown }) => unknown) { return Promise.resolve({ error: errorDelUpdate }).then(ok); },
        };
        return cadena;
      },
    };
  },
};

const STUBS: Record<string, unknown> = {
  'server-only': {},
  '@/lib/workspace': { getTenantDb: async () => db },
  '@/lib/evolution': {
    enviarTexto: async () => ({ ok: true, id: idDeEvolution, instance: 'mako_ws3', chatJid: '5215511111111@s.whatsapp.net' }),
    enviarMedia: async () => ({ ok: true, id: idDeEvolution, instance: 'mako_ws3', chatJid: '5215511111111@s.whatsapp.net' }),
    enviarAudio: async () => ({ ok: true, id: idDeEvolution, instance: 'mako_ws3', chatJid: '5215511111111@s.whatsapp.net' }),
  },
  '@/lib/evolution-media': { subirMediaSaliente: async () => 'ws3/x.ogg', extDeMime: () => 'ogg' },
};

const M = Module as unknown as { _load: Cargador };
const original = M._load;
const conStubs = ((pedido: string, padre: unknown, esMain: boolean) => {
  const archivo = String((padre as { filename?: string } | null)?.filename ?? '').replace(/\\/g, '/');
  if (archivo.endsWith('/lib/evolution-envio.ts') && pedido in STUBS) return STUBS[pedido];
  return Reflect.apply(original, Module, [pedido, padre, esMain]);
}) as Cargador;
let cargado: Promise<typeof import('../lib/evolution-envio')> | null = null;
const envio = () => (cargado ??= (async () => {
  M._load = conStubs;
  try { return await import('../lib/evolution-envio'); } finally { M._load = original; }
})());

const limpiar = () => { escrituras.length = 0; errorDelUpdate = null; idDeEvolution = 'WAMID-1'; };
const marcas = () => escrituras.filter((e) => e.op === 'update' && e.tabla === 'wa_mensajes');

test('1 · un envío sin `quien` (una automatización) se espeja y DESPUÉS se marca automático, por su id y sólo si es saliente', async () => {
  const { enviarYEspejar, enviarAudioYEspejar } = await envio();
  limpiar();
  assert.deepEqual(await enviarYEspejar({ telefono: '5215511111111', texto: 'Hola', leadId: 7 }), { ok: true, chatJid: '5215511111111@s.whatsapp.net' });
  assert.deepEqual(escrituras.map((e) => e.op), ['upsert', 'update'], 'primero el espejo, después la marca');
  assert.equal(escrituras[0].datos.automatico, undefined, 'la marca NO va en el upsert: sin la 0396 tumbaría el espejo');
  assert.deepEqual(marcas()[0].datos, { automatico: true });
  assert.deepEqual(marcas()[0].filtros, [['wa_message_id', 'WAMID-1'], ['from_me', true]]);
  limpiar();
  await enviarAudioYEspejar({ telefono: '5215511111111', base64: 'AAAA', leadId: 7 });
  assert.equal(marcas().length, 1, 'el audio también');
});

test('2 · lo de una persona (Chats, un borrador aprobado) no se marca: queda con el default de la 0396 (false)', async () => {
  const { enviarYEspejar, enviarMediaYEspejar } = await envio();
  limpiar();
  await enviarYEspejar({ telefono: '5215511111111', texto: 'Hola, soy Ana', leadId: 7, quien: 'persona' });
  await enviarMediaYEspejar({ telefono: '5215511111111', media: { base64: 'AAAA', mimetype: 'image/png', tipo: 'image' }, leadId: 7, quien: 'persona' });
  assert.equal(marcas().length, 0);
  assert.equal(escrituras.filter((e) => e.op === 'upsert').length, 2);
});

test('3 · sin la migración (la columna no existe) el envío sale igual y no tira', async () => {
  const { enviarYEspejar } = await envio();
  limpiar();
  errorDelUpdate = { code: '42703', message: 'column wa_mensajes.automatico does not exist' };
  assert.equal((await enviarYEspejar({ telefono: '5215511111111', texto: 'Hola', leadId: 7 })).ok, true);
});

test('4 · sin el id de Evolution no hay fila que marcar (la materializa el eco del webhook): ni espejo ni marca', async () => {
  const { enviarYEspejar } = await envio();
  limpiar();
  idDeEvolution = null;
  assert.equal((await enviarYEspejar({ telefono: '5215511111111', texto: 'Hola', leadId: 7 })).ok, true);
  assert.equal(escrituras.length, 0);
  // Y con id, la marca sale siempre después del espejo.
  idDeEvolution = 'WAMID-2';
  await enviarYEspejar({ telefono: '5215511111111', texto: 'Hola', leadId: 7 });
  assert.deepEqual(marcas()[0]?.filtros[0], ['wa_message_id', 'WAMID-2']);
});
