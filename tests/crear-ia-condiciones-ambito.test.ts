// =============================================================================
// CREAR CON IA: SÓLO LO QUE EL DESPLEGABLE OFRECE CON ESE CRON (duodécima tanda, docs/diseno-duodecima-tanda.md §2.2-§2.3)
// =============================================================================
// La prueba con Fiesta Music (ws10, 12/10/2026), textual: «apareció en condiciones una condición llamada pagó que no
// existía dentro del desplegable, eso jamás tiene que pasar. Siempre tiene que seleccionar las cosas que existen dentro
// del desplegable», «yo en ningún momento aclaré que había tipo cuotas» y «Llega una persona a onboarding, no es lead
// entrante, es un cliente entrante».
//
// Las causas, medidas: las FILAS escritas a mano del system eran todas de adquisición; `filaDe` nunca preguntaba el
// ámbito del CRON (`seOfrece`); y el desplegable real con un CRON de entrega no ofrece «Pagó». Las «cuotas» las dibuja la
// fila «Pagó». «Ya procesamos tu pago en Stripe» era una herramienta inventada.
//
// Lo que fija este archivo (los conteos se CALCULAN con `seccionesDeCondiciones`: nada de 28 / 16 a mano):
//   1. el set de condiciones es el del desplegable con el ámbito del CRON; sin CRON, el de los dos;
//   2. «Pagó» con un CRON de entrega se saca con su aviso; con uno de adquisición se queda;
//   3. una de lista (la etapa de entrega) se elige por su NOMBRE EXACTO; un nombre que no existe se va;
//   4. la segunda capa (`validarIA` con el CRON) lo vuelve a mirar, y nombra una herramienta que nadie nombró;
//   5. «cliente entrante» / «llega a Onboarding» es de la ENTREGA; con dos productos con esa etapa no se adivina;
//   6. el contrato de la ola 2: la clave `d…` se resuelve con `disparadorDeClave`, y una `pregunta` sola no tira.
//
// PROBADO ROMPIÉNDOLO (12/10/2026, arnés scratchpad wf-duodecima/ia-crear/romper.mjs: una rotura por vez sobre
// lib/flujo-ia.ts, restaurada de MEMORIA con sha1 igual; base de este archivo 7 / 0, restaurado 7 / 0). Al lado de cada
// test, su rotura. Las nueve cazadas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deIA, validarIA, idsDeCondiciones, ambitoDeValor, bloqueCondiciones, userDeCrear, herramientasInventadas,
  disparadorDeClave, disparadorDelPedido, hablaDeAlumno, disparadoresParaIA, LISTA_BLANCA_IA,
  type CtxIA, type PasoIA,
} from '../lib/flujo-ia';
import { seccionesDeCondiciones, deValorOpcion } from '../lib/condiciones-catalogo';
import { opcionesCronIA } from '../lib/disparadores';
import { catalogosDe, etapasDeCondicion } from '../lib/condiciones-catalogos';
import { claseDe, type PasoGrafo } from '../lib/flujo-grafo';
import { porId } from '../lib/api-mako/registro';

const acciones = LISTA_BLANCA_IA.map((id) => {
  const d = porId(id);
  if (!d) throw new Error(`la lista blanca nombra «${id}», que no está en el registro`);
  return { id: d.id, titulo: d.titulo, parametros: d.parametros };
});

const ENTREGA = ['Onboarding', 'Arranque', 'Hito 1', 'Hito 2', 'Entregado'].map((label) => ({ value: label.toLowerCase().replace(/ /g, ''), label }));
const PRODUCTOS = [
  { funnelId: 2, productoId: 10, nombre: 'Service Delivery & Ops', esDefault: true, etapas: [{ value: 'nuevo', label: 'Lead entrante' }, { value: 'agendado', label: 'Agendado' }], etapasEntrega: ENTREGA },
  { funnelId: 26, productoId: 39, nombre: 'Fiesta Music', etapas: [{ value: 'nuevo', label: 'Lead entrante' }, { value: 'cerrado', label: 'Cerrado' }], etapasEntrega: ENTREGA },
];
const CAT = catalogosDe({ etapas: etapasDeCondicion(PRODUCTOS), productos: PRODUCTOS, remotos: null });

/** Un contexto como el de ws10, armado con las MISMAS funciones que `armarContexto`. */
const ctxWs10 = (pedido: string, perfil = 'Fiesta Music: clases de DJ y producción musical.'): CtxIA => ({
  etiquetas: [{ id: 4, nombre: 'Interesado' }],
  productos: PRODUCTOS,
  disparadores: disparadoresParaIA(opcionesCronIA({ productos: PRODUCTOS, etiquetas: [{ id: 4, nombre: 'Interesado' }], conectados: { instagram: true, messenger: false, email: false, pagos: false } })),
  audios: [], archivos: [], acciones, links: {},
  catalogoCondicion: CAT, pedido, perfil,
});
const clave = (ctx: CtxIA, valor: string) => {
  const i = ctx.disparadores.findIndex((d) => d.value === valor);
  assert.ok(i >= 0, `el CRON no ofrece ${valor}`);
  return `d${i + 1}`;
};
const rnd = () => { let k = 0; return () => ((k++ * 0.137) % 1); };
const filas = (pasos: readonly PasoGrafo[]) => pasos.filter((p) => claseDe(p) === 'condicion').flatMap((p) => (p.ramas ?? []).flatMap((r) => r.filas));
/** Un flujo con UNA condición de esa fila y un mensaje en cada salida. */
const conFila = (disparador: string, fila: Record<string, unknown>) => ({ disparador, inicio: 't1', tarjetas: [
  { id: 't1', tipo: 'condicion', ramas: [{ si: [fila], sigue: 't2' }], si_no: 't3' },
  { id: 't2', tipo: 'mensaje', texto: 'Hola {{nombre}}' },
  { id: 't3', tipo: 'mensaje', texto: 'Hola' },
] });
/** Los ids del desplegable, calculados como los calcula el editor. */
const delDesplegable = (a: 'adquisicion' | 'entrega') => new Set(seccionesDeCondiciones(a, CAT).flatMap((s) => s.options).map((o) => deValorOpcion(o.value)!.id));

// rotura c1 «`idsDeCondiciones` sin CRON devuelve la unión» → 5 / 2 (éste y la segunda capa).
test('las condiciones que valen son las del desplegable con el ámbito del CRON; sin CRON, las de los dos', () => {
  const adq = delDesplegable('adquisicion');
  const ent = delDesplegable('entrega');
  assert.deepEqual(idsDeCondiciones('adquisicion', CAT), adq);
  assert.deepEqual(idsDeCondiciones('entrega', CAT), ent);
  assert.deepEqual([...idsDeCondiciones('sin_cron', CAT)].sort(), [...adq].filter((x) => ent.has(x)).sort());
  assert.ok(adq.has('pago') && !ent.has('pago'), '«Pagó» es de adquisición');
  assert.ok(ent.has('etapa_entrega') && !adq.has('etapa_entrega'));
  // El ámbito sale del valor del CRON (§3.1): `entrega:` → entrega; el resto, adquisición.
  assert.equal(ambitoDeValor('entrega:39:onboarding'), 'entrega');
  for (const v of ['venta:26:nuevo', 'etiqueta:4', 'instagram:dm', 'pago:aprobado', 'etiqueta_agregada']) assert.equal(ambitoDeValor(v), 'adquisicion', v);
  assert.equal(ambitoDeValor(null), 'sin_cron');
  // Y el modelo ve esos ids: los de los dos una vez, y los de cada ámbito en su línea (sin las FILAS escritas a mano).
  const bloque = bloqueCondiciones(CAT);
  for (const id of [...adq, ...ent]) assert.match(bloque, new RegExp(`\\b${id}\\b`), id);
  assert.match(bloque, /- sólo con «Entrega»: [^\n]*etapa_entrega/);
  assert.doesNotMatch(bloque.split('\n').find((l) => l.includes('«Entrega»'))!, /\bpago\b/);
  assert.ok(userDeCrear(ctxWs10('x'), { perfil: '', voz: null, pedido: 'x' }).includes(bloque));
});

// rotura c2 «`filaDe` no mira `est.condiciones` para las nueve de antes» (el «Pagó» de ws10) → 6 / 1 (éste).
test('«Pagó» con un CRON de ENTREGA se saca con su aviso; con uno de adquisición se queda', () => {
  const ctx = ctxWs10('Cuando un cliente llega a Onboarding de Fiesta Music, si pagó dale la bienvenida');
  const ent = deIA(conFila(clave(ctx, 'entrega:39:onboarding'), { campo: 'pago' }), ctx, rnd());
  assert.deepEqual(filas(ent.pasos), []);
  assert.ok(ent.avisos.includes('Saqué «Pagó»: no está en tus condiciones'), ent.avisos.join(' | '));
  const venta = ctxWs10('Si el lead entrante pagó, dale la bienvenida');
  const adq = deIA(conFila(clave(venta, 'venta:26:nuevo'), { campo: 'pago' }), venta, rnd());
  assert.deepEqual(filas(adq.pasos), [{ campo: 'pago' }]);
  assert.deepEqual(validarIA(adq.pasos, venta, undefined, adq.disparador), []);
});

// rotura c3 «una de lista vuelve a sacarse siempre ("se elige en el lienzo")» → 5 / 2 (éste y el de abajo).
test('una etapa de entrega se elige por su NOMBRE EXACTO; con dos productos decide "producto"', () => {
  const ctx = ctxWs10('Cuando un cliente de Fiesta Music está en Arranque');
  const cron = clave(ctx, 'entrega:39:onboarding');
  const r = deIA(conFila(cron, { campo: 'etapa_entrega', valor: 'ARRANQUE', producto: 'fiesta music' }), ctx, rnd());
  assert.deepEqual(filas(r.pasos), [{ campo: 'etapa_entrega', valor: '39:arranque' }]);
  assert.deepEqual(validarIA(r.pasos, ctx, undefined, r.disparador), []);
  // «Arranque» está en los dos productos: sin decir cuál, no se elige.
  const dos = deIA(conFila(cron, { campo: 'etapa_entrega', valor: 'Arranque' }), ctx, rnd());
  assert.deepEqual(filas(dos.pasos), []);
  assert.ok(dos.avisos.includes('Saqué «Está en la etapa de entrega»: «Arranque» está en varios productos'), dos.avisos.join(' | '));
});

// rotura c4 «`opcionPorNombre` acepta el más parecido (includes)» → 6 / 1 (éste).
test('un nombre que no es una opción se va con su aviso, nunca «la más parecida»', () => {
  const ctx = ctxWs10('Cuando un cliente de Fiesta Music está en Arranque');
  const cron = clave(ctx, 'entrega:39:onboarding');
  for (const valor of ['Arranque rápido', 'Bienvenida VIP', '']) {
    const r = deIA(conFila(cron, { campo: 'etapa_entrega', valor, producto: 'Fiesta Music' }), ctx, rnd());
    assert.deepEqual(filas(r.pasos), [], valor);
    assert.ok(r.avisos.some((a) => a.startsWith('Saqué «Está en la etapa de entrega»:') && a.endsWith('no es una opción')), `${valor}: ${r.avisos.join(' | ')}`);
  }
});

// rotura c5 «`validarIA` sin el set del ámbito» → 6 / 1 (éste). rotura c6 «sin `herramientasInventadas`» → 6 / 1 (éste), y
// 8 / 1 en tests/flujo-ia-crear.test.ts.
test('la segunda capa: una condición fuera del ámbito, una opción que no existe y una herramienta que nadie nombró', () => {
  const ctx = ctxWs10('Si el lead entrante pagó, dale la bienvenida');
  const adq = deIA(conFila(clave(ctx, 'venta:26:nuevo'), { campo: 'pago' }), ctx, rnd());
  // El mismo flujo con un CRON de entrega (una reparación que fallara): no pasa.
  assert.ok(validarIA(adq.pasos, ctx, undefined, 'entrega:39:onboarding').some((e) => e.includes('«pago» no está en CONDICIONES')));
  // Sin CRON, tampoco: sólo valen las de los dos ámbitos.
  assert.ok(validarIA(adq.pasos, ctx, undefined, null).some((e) => e.includes('«pago» no está en CONDICIONES')));
  // Una de lista con una opción que no existe.
  const roto = adq.pasos.map((p) => (claseDe(p) === 'condicion' ? { ...p, ramas: p.ramas!.map((r) => ({ ...r, filas: [{ campo: 'etapa_entrega' as const, valor: '39:vip' }] })) } : p));
  assert.ok(validarIA(roto, ctx, undefined, 'entrega:39:onboarding').some((e) => e.includes('«etapa_entrega» usa una opción que no existe')));
  // «Ya procesamos tu pago en Stripe»: Stripe no está en el perfil ni en el pedido.
  const stripe = adq.pasos.map((p) => (claseDe(p) === 'mensaje' ? { ...p, cuerpo: 'Ya procesamos tu pago en STRIPE, {{nombre}}' } : p)) as PasoIA[];
  assert.ok(validarIA(stripe, ctx, undefined, adq.disparador).some((e) => e.includes('«Stripe»')));
  assert.deepEqual(validarIA(stripe, { ...ctx, perfil: 'Cobramos con Stripe.' }, undefined, adq.disparador), [], 'nombrada en el perfil, vale');
  assert.deepEqual(validarIA(stripe, { ...ctx, perfil: undefined }, undefined, adq.disparador), [], 'sin perfil (editar) no se mira');
  // Palabra entera y sin tildes; el link que pega el código no cuenta.
  assert.deepEqual(herramientasInventadas('Te espero en el zoom de las 5 y págalo por Mercadopago', 'nada'), ['Mercado Pago', 'Zoom']);
  assert.deepEqual(herramientasInventadas('Agenda aquí: https://cal.com/fiesta/llamada', 'nada'), []);
  assert.deepEqual(herramientasInventadas('Mándalo al zoológico', 'nada'), []);
});

// rotura c7 «`entregaNombrada` elige el primer producto con dos» → 6 / 1 (éste).
// rotura c8 «`hablaDeAlumno` sin "cliente entrante / nuevo"» → 6 / 1 (éste).
test('«cliente entrante» y «llega a Onboarding» son de la ENTREGA; con dos productos con esa etapa no se adivina', () => {
  for (const p of ['Cuando entra un cliente nuevo, dale la bienvenida', 'Un nuevo cliente', 'es un cliente entrante']) assert.equal(hablaDeAlumno(p), true, p);
  assert.equal(hablaDeAlumno('Cuando un cliente agenda, confírmale la llamada'), false);
  // El modelo eligió la etapa de VENTA «Lead entrante»; el pedido nombra «Onboarding», que está en los DOS productos.
  const ctx = ctxWs10('Cuando llega una persona a Onboarding, no es lead entrante, es un cliente entrante: dale la bienvenida');
  const r = deIA({ disparador: clave(ctx, 'venta:26:nuevo'), inicio: 't1', tarjetas: [{ id: 't1', tipo: 'mensaje', texto: 'Hola {{nombre}}' }] }, ctx, rnd());
  assert.equal(r.disparador, null, 'eligió un producto: con dos «Onboarding» hay que preguntar (ola 2)');
  // Con el producto en el pedido, ésa, con su aviso.
  const fm = ctxWs10('Cuando un cliente de Fiesta Music llega a Onboarding, dale la bienvenida');
  const avisos: string[] = [];
  assert.equal(disparadorDelPedido('venta:26:nuevo', fm, avisos), 'entrega:39:onboarding');
  assert.deepEqual(avisos, ['Elegí la etapa de entrega «Onboarding»']);
  // Un CRON explícito que no es de etapa se respeta.
  assert.equal(disparadorDelPedido('instagram:dm', fm), 'instagram:dm');
  // Una palabra que es etapa de VENTA y de entrega, en un pedido de venta, no se toca.
  const soloVenta = { ...fm, pedido: 'Cuando un lead llega a Agendado, recuérdale la llamada', disparadores: [...fm.disparadores, { value: 'entrega:39:agendado', label: 'Entrega · Fiesta Music · Llega a «Agendado»', seccion: 'Entrega · Fiesta Music', corto: 'Llega a «Agendado»' }] };
  assert.equal(disparadorDelPedido('venta:2:agendado', soloVenta), 'venta:2:agendado');
});

// rotura c9 «`disparadorDeClave` cuenta desde 0» → 6 / 1 (éste).
test('el contrato de la ola 2: la clave «d…» se resuelve con disparadorDeClave, y una «pregunta» sola no tira', () => {
  const ctx = ctxWs10('x');
  const k = clave(ctx, 'instagram:comentario');
  assert.equal(disparadorDeClave(k, ctx)?.value, 'instagram:comentario');
  assert.equal(disparadorDeClave(k.toUpperCase(), ctx)?.value, 'instagram:comentario');
  assert.equal(disparadorDeClave('d999', ctx), null);
  assert.equal(disparadorDeClave('venta:2:nuevo', ctx), null, 'sólo claves');
  const r = deIA({ pregunta: { sobre: 'cron', texto: '¿Qué la dispara?', opciones: ['d1', 'd2'] } }, ctx, rnd());
  assert.deepEqual([r.pasos, r.disparador, r.etiquetasNuevas], [[], null, []]);
});
