// =============================================================================
// CREAR CON IA POR INSTAGRAM Y MESSENGER (duodécima tanda, docs/diseno-duodecima-tanda.md §2.1)
// =============================================================================
// La prueba con Fiesta Music (ws10, 12/10/2026), textual: «le especifiqué que sea por Instagram y volvió a crearlo por
// WhatsApp» y «tendría que haberlo detectado porque nombraste la palabra reel». La causa fue el CÓDIGO, no el modelo:
// `nodoDe` pasaba a WhatsApp todo lo que no fuera email, sin un aviso, y `PasoIA.canal` no admitía otra cosa.
//
// Lo que fija este archivo, con un contexto como el de ws10 (dos productos con la entrega de fábrica, Instagram y
// Messenger conectados, el CRON de `opcionesCronIA` y el catálogo de condiciones del editor):
//   1. «reel» (o «Instagram») → las tarjetas salen por Instagram, como las arma el lienzo, y pasan las dos capas;
//   2. la segunda capa (`validarIA` con el CRON elegido) rechaza para el reintento: un WhatsApp al lead en un flujo de
//      Instagram, un DM con un CRON de etapa, un DM debajo de «Si responde» y un DM después de esperar más de 24 h;
//   3. un flujo social no lleva «Si responde» ni AI Step (contestan por WhatsApp): se sacan con su aviso;
//   4. `canalDelPedido`: gana la palabra FUERTE, y «la historia de mi negocio» no es Instagram.
//
// PROBADO ROMPIÉNDOLO (12/10/2026, arnés scratchpad wf-duodecima/ia-crear/romper.mjs: una rotura por vez sobre
// lib/flujo-ia.ts, restaurada de MEMORIA con sha1 igual; base de este archivo 8 / 0, restaurado 8 / 0). Al lado de cada
// test, su rotura. Las nueve cazadas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deIA, validarIA, canalDelPedido, canalSocialDelFlujo, disparadoresParaIA, LISTA_BLANCA_IA,
  type CtxIA, type PasoIA,
} from '../lib/flujo-ia';
import { opcionesCronIA } from '../lib/disparadores';
import { catalogosDe, etapasDeCondicion } from '../lib/condiciones-catalogos';
import { validarGrafo, claseDe, ID_INICIO, type PasoGrafo } from '../lib/flujo-grafo';
import { TOPE_TEXTO_SOCIAL } from '../lib/canal-social';
import { porId } from '../lib/api-mako/registro';

const acciones = LISTA_BLANCA_IA.map((id) => {
  const d = porId(id);
  if (!d) throw new Error(`la lista blanca nombra «${id}», que no está en el registro`);
  return { id: d.id, titulo: d.titulo, parametros: d.parametros };
});

/** La entrega de fábrica (lib/servicio-etapas.ts, `ETAPAS_ENTREGA_DEFAULT`): ws10 no declaró la suya en ninguno. */
const ENTREGA = ['Onboarding', 'Arranque', 'Hito 1', 'Hito 2', 'Entregado'].map((label) => ({ value: label.toLowerCase().replace(/ /g, ''), label }));
const PRODUCTOS = [
  { funnelId: 2, productoId: 10, nombre: 'Service Delivery & Ops', esDefault: true, etapas: [{ value: 'nuevo', label: 'Lead entrante' }, { value: 'agendado', label: 'Agendado' }], etapasEntrega: ENTREGA },
  { funnelId: 26, productoId: 39, nombre: 'Fiesta Music', etapas: [{ value: 'nuevo', label: 'Lead entrante' }, { value: 'cerrado', label: 'Cerrado' }], etapasEntrega: ENTREGA },
];
const ETIQUETAS = [{ id: 4, nombre: 'Interesado', archivada_at: null }];

/** Un contexto como el de ws10, armado con las MISMAS funciones que `armarContexto`. */
const ctxWs10 = (pedido: string, o: { instagram?: boolean } = {}): CtxIA => ({
  etiquetas: ETIQUETAS.map((e) => ({ id: e.id, nombre: e.nombre })),
  productos: PRODUCTOS,
  disparadores: disparadoresParaIA(opcionesCronIA({
    productos: PRODUCTOS, etiquetas: ETIQUETAS, conectados: { instagram: o.instagram ?? true, messenger: true, email: false, pagos: false },
  })),
  audios: [{ id: 21, titulo: 'Bienvenida', transcript: 'Hola' }],
  archivos: [],
  acciones,
  links: { agenda: { url: 'https://cal.com/fiesta/llamada', para: 'agendar una llamada' } },
  catalogoCondicion: catalogosDe({ etapas: etapasDeCondicion(PRODUCTOS), productos: PRODUCTOS, remotos: null }),
  pedido,
  perfil: 'Fiesta Music: clases de DJ y producción musical.',
});

/** La clave corta (`d7`) de un valor del desplegable del CRON, como se la ofrece el prompt. */
const clave = (ctx: CtxIA, valor: string) => {
  const i = ctx.disparadores.findIndex((d) => d.value === valor);
  assert.ok(i >= 0, `el CRON no ofrece ${valor}`);
  return `d${i + 1}`;
};
const rnd = () => { let k = 0; return () => ((k++ * 0.137) % 1); };
const mensajes = (pasos: readonly PasoGrafo[]) => pasos.filter((p) => claseDe(p) === 'mensaje') as PasoIA[];
/** Las dos capas, como las corre la revisión de crear (`traducir`, lib/flujo-ia-crear-core.ts). */
const revision = (pasos: readonly PasoGrafo[], ctx: CtxIA, disparador: string | null) => [...validarIA(pasos, ctx, undefined, disparador), ...validarGrafo(pasos)];

const REEL = 'Cuando alguien comente mi reel, mándale por DM el link para agendar y avísame en el grupo';

// rotura s1 «`nodoDe` vuelve a pasar a WhatsApp todo lo que no es email» (el bug de #243) → 2 / 6 (todos los que arman DMs).
// rotura s2 «sin `reel` en `PALABRAS_CANAL`» → 6 / 2 (éste y canalDelPedido).
test('«reel» → las tarjetas salen por Instagram, como las arma el lienzo, y pasan las dos capas', () => {
  const ctx = ctxWs10(REEL);
  assert.equal(canalSocialDelFlujo(ctx, null), 'instagram');
  const r = deIA({
    nombre: 'Link por DM a quien comenta', disparador: clave(ctx, 'instagram:comentario'), inicio: 't1', tarjetas: [
      // Sin "canal": va por el del flujo. Con "canal": "instagram", igual.
      { id: 't1', tipo: 'mensaje', texto: '¡Hola {{nombre}}! Gracias por comentar. Aquí agendas:', link: 'agenda', sigue: 't2' },
      { id: 't2', tipo: 'accion', operacion: 'avisar_al_equipo', datos: { mensaje: 'Comentó el reel y le mandé el link' }, sigue: 't3' },
      { id: 't3', tipo: 'mensaje', canal: 'instagram', texto: 'Cualquier duda, escríbeme por aquí.' },
    ],
  }, ctx, rnd());
  assert.equal(r.disparador, 'instagram:comentario');
  const m = mensajes(r.pasos);
  assert.deepEqual(m.map((x) => x.canal), ['instagram', 'instagram']);
  // Como `nodoNuevo('instagram')`: el mensaje con su canal, sin tipo (texto) y con el link pegado por el código.
  assert.equal(m[0].tipo, undefined);
  assert.match(m[0].cuerpo, /\n\nhttps:\/\/cal\.com\/fiesta\/llamada$/);
  assert.deepEqual(revision(r.pasos, ctx, r.disparador), []);
  // El aviso al equipo por «MaKo en WhatsApp» es una acción: en un flujo de Instagram vale.
  assert.ok(r.pasos.some((p) => (p as PasoIA).accion?.operacion === 'avisar_al_equipo'));
});

// rotura s3 «`validarIA` sin la regla del WhatsApp al lead» → 7 / 1 (éste).
// ⚠️ DESDE EL 16/10/2026 `deIA` LO ARREGLA SOLO (`canalDeTarjeta`, tests/crear-ia-instagram-solo.test.ts): Martín vio el
// error de la revisión en la pantalla después de 140 s de reintentos. La regla de `validarIA` queda como red para un flujo
// armado por otro camino; acá se le pasan los pasos ya armados con el WhatsApp puesto.
test('un WhatsApp al LEAD en un flujo de Instagram no pasa la revisión (la red, si llega armado así)', () => {
  const ctx = ctxWs10(REEL);
  const r = deIA({ disparador: clave(ctx, 'instagram:comentario'), inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'mensaje', canal: 'whatsapp', texto: 'Hola {{nombre}}, te escribo por WhatsApp.' },
  ] }, ctx, rnd());
  assert.equal(mensajes(r.pasos)[0].canal, 'instagram', 'deIA lo pasa al canal del flujo');
  const armadoAsi = r.pasos.map((p) => (claseDe(p) === 'mensaje' ? { ...p, canal: 'whatsapp' } : p)) as PasoGrafo[];
  const err = revision(armadoAsi, ctx, r.disparador);
  assert.ok(err.some((e) => /va por WhatsApp y el flujo es por Instagram/.test(e)), err.join(' | '));
});

// rotura s4 «`validarIA` sin la regla del CRON de su canal» → 7 / 1 (éste), y 8 / 1 en tests/flujo-ia-crear.test.ts.
test('un DM con un CRON de etapa no pasa la revisión: Meta no deja escribir primero', () => {
  const ctx = ctxWs10('Por Instagram, dale la bienvenida a los leads entrantes');
  const r = deIA({ disparador: clave(ctx, 'venta:2:nuevo'), inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'mensaje', canal: 'instagram', texto: 'Hola {{nombre}}, bienvenido.' },
  ] }, ctx, rnd());
  assert.equal(r.disparador, 'venta:2:nuevo');
  const err = revision(r.pasos, ctx, r.disparador);
  assert.ok(err.some((e) => /necesita un disparador de Instagram/.test(e)), err.join(' | '));
  // Con el CRON de Instagram, pasa.
  assert.deepEqual(revision(r.pasos, ctx, 'instagram:dm'), []);
  // Sin Instagram conectado el desplegable no lo ofrece: no se reintenta en vano, se dice y el CRON queda sin elegir.
  const sinIG = ctxWs10('Por Instagram, dale la bienvenida a los leads entrantes', { instagram: false });
  const r2 = deIA({ disparador: clave(sinIG, 'venta:2:nuevo'), inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'mensaje', texto: 'Hola {{nombre}}, bienvenido.' },
  ] }, sinIG, rnd());
  assert.equal(r2.disparador, null);
  assert.ok(r2.avisos.includes('Conecta Instagram en el CRON'), r2.avisos.join(' | '));
});

// rotura s5 «`validarIA` sin la regla de "si_responde"» → 7 / 1 (éste).
test('un DM debajo de «Si responde» no pasa la revisión; `deIA` lo pasa a WhatsApp con su aviso', () => {
  const ctx = ctxWs10('Bienvenida por WhatsApp a los leads entrantes');
  const r = deIA({ disparador: clave(ctx, 'venta:2:nuevo'), inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'mensaje', texto: 'Hola {{nombre}}' },
    { id: 'r1', tipo: 'si_responde', objetivo: 'Que agende', casos: [{ titulo: 'Precio', cuando: 'Pregunta el precio', sigue: 'r2' }], otra_cosa: null },
    { id: 'r2', tipo: 'mensaje', canal: 'instagram', texto: 'Te paso los detalles por aquí.' },
  ] }, ctx, rnd());
  assert.ok(r.avisos.includes('Un mensaje por Instagram de «Si responde» pasó a WhatsApp'), r.avisos.join(' | '));
  assert.deepEqual(revision(r.pasos, ctx, r.disparador), []);
  // La segunda capa, si una reparación fallara.
  const roto = r.pasos.map((p) => (claseDe(p) === 'mensaje' && (p as PasoIA).cuerpo.startsWith('Te paso') ? { ...p, canal: 'instagram' } : p));
  const err = validarIA(roto, ctx, undefined, 'instagram:dm');
  assert.ok(err.some((e) => /por Instagram no va debajo de "si_responde"/.test(e)), err.join(' | '));
});

// rotura s6 «`validarIA` sin la ventana de 24 h» → 7 / 1 (éste).
test('un DM después de esperar más de 24 h no pasa la revisión; con 24 h justas, sí', () => {
  const ctx = ctxWs10(REEL);
  const flujo = (horas: number) => deIA({ disparador: clave(ctx, 'instagram:dm'), inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'mensaje', texto: 'Hola {{nombre}}', sigue: 't2' },
    { id: 't2', tipo: 'esperar', horas, sigue: 't3' },
    { id: 't3', tipo: 'mensaje', texto: '¿Pudiste ver el link?' },
  ] }, ctx, rnd());
  const largo = flujo(48);
  const err = revision(largo.pasos, ctx, largo.disparador);
  assert.ok(err.some((e) => /después de esperar más de 24 h/.test(e)), err.join(' | '));
  const justo = flujo(24);
  assert.deepEqual(revision(justo.pasos, ctx, justo.disparador), []);
});

// rotura s7 «`deIA` deja el "si_responde" en un flujo social» → 7 / 1 (éste).
test('un flujo de Instagram no lleva «Si responde» ni AI Step: se sacan con UN aviso, y lo de la salida queda', () => {
  const ctx = ctxWs10(REEL);
  const r = deIA({ disparador: clave(ctx, 'instagram:comentario'), inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'mensaje', texto: 'Hola {{nombre}}, aquí tienes el link', link: 'agenda' },
    { id: 'r1', tipo: 'si_responde', objetivo: 'Que agende', casos: [{ titulo: 'Quiere agendar', cuando: 'Pide horario', sigue: 'r2' }], otra_cosa: null },
    { id: 'r2', tipo: 'mensaje', ia: true, texto: 'Pásale el link de agenda.' },
  ] }, ctx, rnd());
  assert.ok(!r.pasos.some((p) => claseDe(p) === 'respuesta'), 'quedó un «Si responde» o un AI Step');
  assert.equal(mensajes(r.pasos).length, 1, 'lo que colgaba SÓLO de «Si responde» se va con ella');
  // Desde TikTok fase 0 (14/10/2026) el motor SÍ contesta por Instagram con el AI Step de ese medio: el aviso dice dónde
  // se suma, no que «todavía no contesta» (lo que arma la IA no llega a ser un AI Step de Instagram: lib/flujo-ia.ts).
  assert.ok(r.avisos.includes('Saqué el Si responde: el AI Step de Instagram se suma desde el ＋'), r.avisos.join(' | '));
  assert.ok(!r.avisos.some((a) => /no colgaba/.test(a)), r.avisos.join(' | '));
  assert.deepEqual(revision(r.pasos, ctx, r.disparador), []);
  // La segunda capa: un «Si responde» que quedara en un flujo social se rechaza.
  const ws = deIA({ disparador: clave(ctx, 'venta:2:nuevo'), inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'mensaje', canal: 'whatsapp', texto: 'Hola' },
    { id: 'r1', tipo: 'si_responde', objetivo: 'Que agende', casos: [{ titulo: 'A', cuando: 'B', sigue: 'r2' }], otra_cosa: null },
    { id: 'r2', tipo: 'mensaje', texto: 'Texto fijo' },
  ] }, ctxWs10('Bienvenida por WhatsApp'), rnd());
  assert.ok(validarIA(ws.pasos, ctx, undefined, 'instagram:dm').some((e) => /por Instagram no lleva "si_responde"/.test(e)));
  // TikTok fase 0 (14/10/2026): un AI Step de ESE medio sí va (el motor contesta por ahí); uno de WhatsApp, no.
  // Rotura: la regla sin la excepción del medio → este archivo 7 / 1 (éste).
  const conIA = (medio?: 'instagram') => [
    { id: 'm1', canal: 'instagram' as const, cuerpo: 'Hola', siguiente: null },
    { id: 'a1', nodo: 'respuesta' as const, paso_ia: true as const, objetivo: 'Que agende', ...(medio ? { medio } : {}), casos: [{ id: 'c1', titulo: 'A', cuando: 'B', siguiente: null }], si_no: null },
    { id: ID_INICIO, nodo: 'inicio' as const, siguiente: 'm1' },
  ] as PasoGrafo[];
  assert.ok(!validarIA(conIA('instagram'), ctx, undefined, 'instagram:dm').some((e) => /no lleva "si_responde"/.test(e)), 'el AI Step de Instagram se rechaza en su propio flujo');
  assert.ok(validarIA(conIA(), ctx, undefined, 'instagram:dm').some((e) => /por Instagram no lleva "si_responde"/.test(e)), 'un AI Step de WhatsApp pasa en un flujo de Instagram');
});

// rotura s8 «el DM con audio, archivo o IA» (`nodoDe` sin el `social`) → 7 / 1 (éste).
test('un DM lleva texto y link: sin nota de voz, archivo ni IA, y hasta el tope de Meta con el link adentro', () => {
  const ctx = ctxWs10('Por Messenger, a quien escanea el QR');
  const r = deIA({ disparador: clave(ctx, 'messenger:qr'), inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'mensaje', texto: 'Hola', audio: 21, sigue: 't2' },
    { id: 't2', tipo: 'mensaje', texto: 'Mira esto', ia: true, sigue: 't3' },
    { id: 't3', tipo: 'mensaje', texto: 'x'.repeat(2000), link: 'agenda' },
  ] }, ctx, rnd());
  const m = mensajes(r.pasos);
  assert.deepEqual(m.map((x) => [x.canal, x.tipo]), [['messenger', undefined], ['messenger', undefined], ['messenger', undefined]]);
  assert.ok(r.avisos.includes('Por Messenger no va nota de voz: la saqué'), r.avisos.join(' | '));
  assert.ok(r.avisos.includes('Por Messenger va como texto fijo'), r.avisos.join(' | '));
  assert.ok(m[2].cuerpo.length <= TOPE_TEXTO_SOCIAL && m[2].cuerpo.endsWith('https://cal.com/fiesta/llamada'), `${m[2].cuerpo.length}`);
  assert.deepEqual(revision(r.pasos, ctx, r.disparador), []);
});

// rotura s9 «`PALABRAS_CANAL` con "historia"» → 7 / 1 (éste).
test('canalDelPedido: gana la palabra FUERTE, sin tildes ni mayúsculas; «la historia de mi negocio» no es Instagram', () => {
  const casos: ReadonlyArray<readonly [string, string | null]> = [
    ['la historia de mi negocio', null],
    ['Cuéntales la historia de mi negocio a los leads nuevos', null],
    ['Cuando comenten mi REEL mándales el link', 'instagram'],
    ['Respóndele a quien conteste mi story', 'instagram'],
    ['por IG, a los que me escriben', 'instagram'],
    ['Por Instagram y no por WhatsApp', 'instagram'],
    ['Saluda a quien escribe a la página de Facebook', 'messenger'],
    ['mándales un wsp de bienvenida', 'whatsapp'],
    ['un correo de bienvenida', 'email'],
    ['Bienvenida a los que dejan sus datos', null],
  ];
  for (const [pedido, canal] of casos) assert.equal(canalDelPedido(pedido), canal, pedido);
  // El que eligió la persona («¿Por dónde le escribo?», ola 2) gana sobre el pedido.
  assert.equal(canalSocialDelFlujo({ pedido: REEL, canalElegido: 'whatsapp' }, 'instagram:dm'), null);
  assert.equal(canalSocialDelFlujo({ pedido: 'Bienvenida' }, 'messenger:dm'), 'messenger', 'sin canal en el pedido, el del CRON');
});
