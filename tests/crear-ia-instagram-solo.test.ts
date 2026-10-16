// =============================================================================
// CREAR CON IA POR INSTAGRAM: EL CANAL SE ARREGLA SOLO, Y EL LEAD MAGNET VA COMO ARCHIVO (16/10/2026)
// =============================================================================
// Feedback de Martín del 16/10 (por Cerebro, bug A1), textual: pidió «Crea una automatización por Instagram dando este
// "Lead Magnet" y pidiendo que nos sigan para darselo...», vio «Escribiendo el flujo 140 s · hasta 5 min» y después
// «MaKo armó el flujo pero quedó mal: Un mensaje al lead va por WhatsApp y el flujo es por Instagram: usa "canal":
// "instagram". Prueba de nuevo o cambia una palabra del pedido.» — «eso está bastante mal, solucionalo».
//
// MEDIDO en producción (anthropic_usage, ws10, 16/10 06:07-06:10 UTC): Groq contestó en segundos con el canal
// «whatsapp»; la revisión lo rechazó y la cascada probó OpenRouter (97 s), que repitió el error, y después el reintento
// (76 s más). La causa: `canalDeTarjeta` respetaba el «whatsapp» del modelo en un flujo de Instagram.
//
// Lo que se fija:
//   · un mensaje NUEVO al lead que el modelo escribe «por WhatsApp» en un flujo social sale por ESE canal, sin reintento;
//   · editando, un mensaje que YA estaba conserva su canal si el cambio no lo nombra (no se toca lo que no se pidió);
//   · un archivo (el lead magnet) va por Instagram si Instagram lo acepta (foto, video, PDF); si no, se saca con su porqué;
//   · el error que ve la persona no trae lo que le habla al modelo («usa "canal": …»).
//
// ⚠️ PROBADO ROMPIENDO (16/10/2026, scratchpad romper-a.mjs; base 4 pass / 0 fail, 4 roturas, todas atajadas). El
// resultado MEDIDO de cada rotura, al lado de su test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deIA, deIAEdicion, validarIA, disparadoresParaIA, falloDeRevision, paraLaPersona, LISTA_BLANCA_IA, type CtxIA, type PasoIA } from '../lib/flujo-ia';
import { opcionesCronIA } from '../lib/disparadores';
import { catalogosDe, etapasDeCondicion } from '../lib/condiciones-catalogos';
import { validarGrafo, claseDe, type PasoGrafo } from '../lib/flujo-grafo';
import { porId } from '../lib/api-mako/registro';

const acciones = LISTA_BLANCA_IA.map((id) => {
  const d = porId(id);
  if (!d) throw new Error(`la lista blanca nombra «${id}», que no está en el registro`);
  return { id: d.id, titulo: d.titulo, parametros: d.parametros };
});
const PRODUCTOS = [{ funnelId: 2, productoId: 10, nombre: 'Fiesta Music', esDefault: true, etapas: [{ value: 'nuevo', label: 'Lead entrante' }], etapasEntrega: [{ value: 'onboarding', label: 'Onboarding' }] }];
const ETIQUETAS = [{ id: 4, nombre: 'Interesado', archivada_at: null }];
const ARCHIVOS = [
  { id: 31, titulo: 'Lead magnet', mime: 'image/png' },
  { id: 32, titulo: 'Guía en audio', mime: 'audio/mpeg' },
];
const PEDIDO = 'Crea una automatización por Instagram dando este Lead Magnet y pidiendo que nos sigan para dárselo';
const ctx = (pedido = PEDIDO): CtxIA => ({
  etiquetas: ETIQUETAS.map((e) => ({ id: e.id, nombre: e.nombre })),
  productos: PRODUCTOS,
  disparadores: disparadoresParaIA(opcionesCronIA({ productos: PRODUCTOS, etiquetas: ETIQUETAS, conectados: { instagram: true, messenger: true, email: false, pagos: false } })),
  audios: [],
  archivos: ARCHIVOS,
  acciones,
  links: {},
  catalogoCondicion: catalogosDe({ etapas: etapasDeCondicion(PRODUCTOS), productos: PRODUCTOS, remotos: null }),
  pedido,
  perfil: 'Fiesta Music: clases de DJ.',
});
const clave = (c: CtxIA, valor: string) => `d${c.disparadores.findIndex((d) => d.value === valor) + 1}`;
const rnd = () => { let k = 0; return () => ((k++ * 0.137) % 1); };
const mensajes = (pasos: readonly PasoGrafo[]) => pasos.filter((p) => claseDe(p) === 'mensaje') as PasoIA[];
const revision = (pasos: readonly PasoGrafo[], c: CtxIA, disparador: string | null) => [...validarIA(pasos, c, undefined, disparador), ...validarGrafo(pasos)];

// rotura 1 (`canalDeTarjeta` respeta el «whatsapp» del modelo, como antes): 2 pass / 2 fail, caen éste y el del lead magnet.
test('el «whatsapp» del modelo en un flujo de Instagram sale por Instagram, y la revisión lo deja pasar a la primera', () => {
  const c = ctx();
  const r = deIA({ disparador: clave(c, 'instagram:comentario'), inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'mensaje', canal: 'whatsapp', texto: '¡Gracias por comentar, {{nombre}}! Síguenos y te lo mando.', sigue: 't2' },
    { id: 't2', tipo: 'mensaje', canal: 'WhatsApp', texto: 'Aquí tienes tu regalo.' },
  ] }, c, rnd());
  assert.deepEqual(mensajes(r.pasos).map((m) => m.canal), ['instagram', 'instagram']);
  assert.deepEqual(revision(r.pasos, c, r.disparador), []);
});

// rotura 2 (Instagram vuelve a no llevar archivo): 3 pass / 1 fail, cae éste.
test('el lead magnet va como ARCHIVO por Instagram; uno que Instagram no acepta se saca con su porqué', () => {
  const c = ctx();
  const r = deIA({ disparador: clave(c, 'instagram:comentario'), inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'mensaje', canal: 'whatsapp', texto: 'Aquí tienes tu Lead Magnet 🎁', archivo: 31, sigue: 't2' },
    { id: 't2', tipo: 'mensaje', canal: 'instagram', texto: 'Y escúchalo también.', archivo: 32 },
  ] }, c, rnd());
  const [m1, m2] = mensajes(r.pasos);
  assert.equal(m1.canal, 'instagram');
  assert.equal(m1.tipo, 'media');
  assert.equal(Number(m1.media_id), 31);
  assert.notEqual(m2.tipo, 'media', 'Instagram no toma un MP3');
  assert.ok(r.avisos.includes('Instagram acepta foto, video o PDF: saqué el archivo'), r.avisos.join(' | '));
  assert.deepEqual(revision(r.pasos, c, r.disparador), []);
  // Y la revisión, como red: un archivo que el canal no acepta no pasa.
  const conAudio = r.pasos.map((p) => (p === m2 ? { ...p, tipo: 'media', media_id: 32 } : p)) as PasoGrafo[];
  assert.ok(revision(conAudio, c, r.disparador).some((e) => /lleva un archivo que no acepta/.test(e)));
});

// rotura 3 (editando, se pasa al canal del flujo también lo que ya estaba): 3 pass / 1 fail, cae éste.
test('editando, un mensaje que YA estaba conserva su canal si el cambio no lo nombra', () => {
  const base: PasoIA[] = [
    { id: 'm1', orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: 'Hola', template_wa: null, proveedor: 'no_oficial', siguiente: null } as PasoIA,
  ];
  const r = deIAEdicion({ cambiar: [{ id: 'm1', texto: 'Hola de nuevo' }] }, base as PasoGrafo[], ctx('Por Instagram: cambia el saludo'), rnd());
  const m = mensajes(r.pasos)[0];
  assert.equal(m.cuerpo, 'Hola de nuevo');
  assert.equal(m.canal, 'whatsapp');
});

// rotura 4 (el error a la persona con la instrucción para el modelo): 3 pass / 1 fail, cae éste.
test('el error que ve la persona no trae lo que le habla al modelo', () => {
  assert.equal(paraLaPersona('un mensaje al lead va por WhatsApp y el flujo es por Instagram: usa "canal": "instagram"'), 'un mensaje al lead va por WhatsApp y el flujo es por Instagram');
  assert.equal(paraLaPersona('un flujo por Instagram no lleva "si_responde"'), 'un flujo por Instagram no lleva si responde');
  const t = falloDeRevision(['un mensaje al lead va por WhatsApp y el flujo es por Instagram: usa "canal": "instagram"'], []);
  assert.doesNotMatch(t, /usa|"canal"/);
  assert.match(t, /^MaKo armó el flujo pero quedó mal: /);
});
