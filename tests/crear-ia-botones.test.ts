// =============================================================================
// «Crear con IA» por Instagram arma BOTONES, y el gate de seguidor no regala el link (24/10/2026, fase B)
// =============================================================================
// Martín (trabajos 49ff20a3 y 36c79085): el flujo de ManyChat para Fiesta Music, tal cual: comenta la palabra → DM con
// «Obtener recurso» → al tocarlo, «¿Te sigue?» → sí: el link · no: «Seguinos» con «Ya te sigo» → otra vez. Y el bug: el
// borrador que armó la IA de MaKo ponía el link en el primer DM y también en el de «no te sigue», o sea que lo regalaba.
// Fija:
//   · el armador (`deIA`) lee los botones de un mensaje de Instagram: el de flujo con su `siguiente` real, el de link con
//     la URL guardada (nunca una inventada), y la VUELTA de «Ya te sigo» a la condición (el armador es un árbol: «cada
//     tarjeta cuelga de un solo lugar», y un botón que vuelve a una que ya tiene lugar NO es «dos lugares»);
//   · el flujo armado pasa la revisión y el grafo (se puede publicar);
//   · en WhatsApp los botones se sacan con su porqué; un cuarto botón también;
//   · lo que se le dice al modelo va SÓLO en un pedido de Instagram o Messenger (el techo de Groq: el system no cambia).
// Correr: node --import tsx --test tests/crear-ia-botones.test.ts
// ROTURAS (24/10/2026, una por vez y restaurada; base 4 / 0): el armador sin leer `raw.botones` → 1 / 3; la vuelta de un
// botón tratada como «dos lugares» → 3 / 1; el parser leyendo botones en WhatsApp → 3 / 1; `BOTONES_SOCIAL` también en un
// pedido de WhatsApp → 3 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deIA, validarIA, disparadoresParaIA, userDeCrear, BOTONES_SOCIAL, CREAR_IA_SYSTEM_TEMPLATE, LISTA_BLANCA_IA, type CtxIA, type PasoIA } from '../lib/flujo-ia';
import { opcionesCronIA } from '../lib/disparadores';
import { catalogosDe, etapasDeCondicion } from '../lib/condiciones-catalogos';
import { validarGrafo, claseDe, type PasoGrafo } from '../lib/flujo-grafo';
import { botonesDe } from '../lib/botones-social';
import { porId } from '../lib/api-mako/registro';

const acciones = LISTA_BLANCA_IA.map((id) => {
  const d = porId(id);
  if (!d) throw new Error(`la lista blanca nombra «${id}», que no está en el registro`);
  return { id: d.id, titulo: d.titulo, parametros: d.parametros };
});
const PRODUCTOS = [{ funnelId: 2, productoId: 10, nombre: 'Fiesta Music', esDefault: true, etapas: [{ value: 'nuevo', label: 'Lead entrante' }], etapasEntrega: [{ value: 'onboarding', label: 'Onboarding' }] }];
const ETIQUETAS = [{ id: 4, nombre: 'Interesado', archivada_at: null }];
const PEDIDO = 'Por Instagram: quien comenta pruebafm recibe el recurso, pero sólo si nos sigue';
const ctx = (pedido = PEDIDO): CtxIA => ({
  etiquetas: ETIQUETAS.map((e) => ({ id: e.id, nombre: e.nombre })),
  productos: PRODUCTOS,
  disparadores: disparadoresParaIA(opcionesCronIA({ productos: PRODUCTOS, etiquetas: ETIQUETAS, conectados: { instagram: true, messenger: true, email: false, pagos: false } })),
  audios: [],
  archivos: [],
  acciones,
  links: { recurso: { url: 'https://fiesta.example/recurso', para: 'El recurso gratis' } },
  catalogoCondicion: catalogosDe({ etapas: etapasDeCondicion(PRODUCTOS), productos: PRODUCTOS, remotos: null }),
  pedido,
  perfil: 'Fiesta Music: clases de DJ.',
});
const clave = (c: CtxIA, valor: string) => `d${c.disparadores.findIndex((d) => d.value === valor) + 1}`;
const rnd = () => { let k = 0; return () => ((k++ * 0.137) % 1); };
const mensajes = (pasos: readonly PasoGrafo[]) => pasos.filter((p) => claseDe(p) === 'mensaje') as PasoIA[];

/** Lo que el modelo devuelve para el flujo de ManyChat, con el gate de seguidor. */
const GATE = (c: CtxIA) => ({ disparador: clave(c, 'instagram:comentario'), inicio: 't1', tarjetas: [
  { id: 't1', tipo: 'mensaje', canal: 'instagram', texto: '¡Ey! Te dejo el recurso por el que comentaste:', botones: [{ titulo: 'Obtener recurso', sigue: 't2' }] },
  { id: 't2', tipo: 'condicion', ramas: [{ si: [{ campo: 'sigue_instagram' }], sigue: 't3' }], si_no: 't4' },
  { id: 't3', tipo: 'mensaje', canal: 'instagram', texto: '¡Aquí está!', link: 'recurso' },
  { id: 't4', tipo: 'mensaje', canal: 'instagram', texto: 'Todavía no te veo: síguenos y toca el botón.', botones: [{ titulo: 'Ya te sigo', sigue: 't2' }] },
] });

test('el gate de seguidor sale armado: «Obtener recurso» lleva a «¿Te sigue?», y «Ya te sigo» VUELVE a ella', () => {
  const c = ctx();
  const r = deIA(GATE(c), c, rnd());
  const [m1, link, noSigue] = mensajes(r.pasos);
  const cond = r.pasos.find((p) => claseDe(p) === 'condicion')!;
  assert.deepEqual(botonesDe(m1).map((b) => [b.titulo, b.siguiente]), [['Obtener recurso', cond.id]]);
  assert.deepEqual(botonesDe(noSigue).map((b) => [b.titulo, b.siguiente]), [['Ya te sigo', cond.id]], 'la vuelta de «Ya te sigo» se perdió');
  // El link va SÓLO en el mensaje del sí: ni en el primero ni en el de «no te sigue».
  assert.match(link.cuerpo, /https:\/\/fiesta\.example\/recurso/);
  assert.doesNotMatch(m1.cuerpo + noSigue.cuerpo, /fiesta\.example/);
  assert.ok(!r.avisos.some((a) => /dos lugares/.test(a)), `avisó: ${r.avisos.join(' | ')}`);
  // Se puede publicar.
  assert.deepEqual([...validarIA(r.pasos, c, undefined, r.disparador), ...validarGrafo(r.pasos)], []);
});

test('un botón con link abre el guardado; uno inventado se saca con su porqué, y un cuarto también', () => {
  const c = ctx();
  const r = deIA({ disparador: clave(c, 'instagram:comentario'), inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'mensaje', canal: 'instagram', texto: 'Mira esto', botones: [
      { titulo: 'Ver el recurso', link: 'recurso' }, { titulo: 'Otro', link: 'no-existe' }, { titulo: 'A', link: 'recurso' }, { titulo: 'B', link: 'recurso' },
    ] },
  ] }, c, rnd());
  const [m1] = mensajes(r.pasos);
  assert.deepEqual(botonesDe(m1).map((b) => [b.titulo, b.url ?? null]), [['Ver el recurso', 'https://fiesta.example/recurso'], ['A', 'https://fiesta.example/recurso']]);
  assert.ok(r.avisos.some((a) => /No tengo guardado el link «no-existe»: saqué el botón «Otro»/.test(a)), r.avisos.join(' | '));
  assert.ok(r.avisos.some((a) => /hasta 3 botones/.test(a)), r.avisos.join(' | '));
});

test('en WhatsApp no hay botones: se sacan y se dice', () => {
  const c = ctx('Un WhatsApp de bienvenida');
  const r = deIA({ disparador: null, inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'mensaje', canal: 'whatsapp', texto: 'Hola {{nombre}}', botones: [{ titulo: 'Sí', sigue: 't2' }] },
    { id: 't2', tipo: 'mensaje', canal: 'whatsapp', texto: 'Genial' },
  ] }, c, rnd());
  assert.ok(mensajes(r.pasos).every((m) => !('botones' in m)));
  assert.ok(r.avisos.includes('Los botones son de Instagram y Messenger: los saqué'), r.avisos.join(' | '));
});

test('lo que se le dice al modelo de los botones va SÓLO en un pedido de Instagram o Messenger', () => {
  assert.ok(!CREAR_IA_SYSTEM_TEMPLATE.includes('BOTONES:'), 'el system lo lleva para todos: el techo de Groq no lo deja');
  assert.ok(userDeCrear(ctx(), { perfil: 'Fiesta Music', voz: null, pedido: PEDIDO }).includes(BOTONES_SOCIAL));
  assert.ok(!userDeCrear(ctx('Un WhatsApp de bienvenida al que llega'), { perfil: 'Fiesta Music', voz: null, pedido: 'Un WhatsApp de bienvenida al que llega' }).includes(BOTONES_SOCIAL));
  // El gate dicho: el link SÓLO en el sí.
  assert.match(BOTONES_SOCIAL, /el link va SÓLO en el mensaje del sí/);
});
