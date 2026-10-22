// =============================================================================
// El chat de MaKo al editar: «Editalos y agregalos» suma (no pisa), «hazlo» con todo hecho, y la etapa que no existe
// =============================================================================
// Las dos fallas que quedaron del arnés del Cerebro contra producción (87365c830, 22/10/2026), que son justo lo de la llamada
// con Mauricio. Se prueban con la RESPUESTA DEL MODELO GRABADA (lo que devolvió en la pasada 1: «Cambié «WHATSAPP: Hola
// estimado {{nombre}},…»: ahora «WHATSAPP: Me quedan 3 lugares para…»»), por la misma revisión que usa la ruta
// (`revisarEdicion`, lib/flujo-ia-revision-editar.ts). El modelo de verdad lo mide el arnés (scripts/probar-chats).
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deIA, LISTA_BLANCA_IA, type CtxIA, type PasoIA } from '../lib/flujo-ia';
import {
  revisarEdicion, pideAgregar, cambioTextoDeMensajes, yaEstaEnElFlujo, textosPegados, etapaQueNoExiste, textoEtapaQueNoExiste, ERROR_AGREGAR_PISA,
} from '../lib/flujo-ia-revision-editar';
import { claseDe } from '../lib/flujo-grafo';
import { catalogosDe, etapasDeCondicion } from '../lib/condiciones-catalogos';

const sigueAl = (p: PasoIA, id: string) => p.siguiente === id || (p.paralelos ?? []).includes(id) || (p.ramas ?? []).some((r) => r.siguiente === id) || p.si_no === id;
import { porId } from '../lib/api-mako/registro';

const acciones = LISTA_BLANCA_IA.map((id) => {
  const d = porId(id);
  if (!d) throw new Error(`la lista blanca nombra «${id}», que no está en el registro`);
  return { id: d.id, titulo: d.titulo, parametros: d.parametros };
});
const CRM_PRUEBA = '🧪 Prueba chats 22/10 · Automations';
const PRODUCTOS = [
  { funnelId: 39, productoId: null, nombre: 'Negocio', esDefault: true, etapas: [{ value: 'lead', label: 'Lead entrante' }], etapasEntrega: [] },
  { funnelId: 46, productoId: 55, nombre: CRM_PRUEBA, etapas: [{ value: 'lead', label: 'Lead entrante' }, { value: 'st0', label: 'Prospección activa' }, { value: 'st2', label: 'Respondió' }], etapasEntrega: [] },
];
const DISPARADORES = [{ value: 'venta:46:st0', label: `${CRM_PRUEBA} › Entra a «Prospección activa»` }];
const ctx: CtxIA = { etiquetas: [], productos: PRODUCTOS, disparadores: DISPARADORES, audios: [], archivos: [], acciones, links: {}, disparadorActual: 'venta:46:st0' };
const rndDe = () => { let k = 0; return () => ((k++ * 0.137) % 1); };

// El lienzo del caso: dos WhatsApp.
const ANTES = ['Hola estimado {{nombre}}, espero que estés muy bien', 'Hola {{nombre}}, soy Mauricio Bustos. ¿Sigues al frente de tu empresa?'];
const NUEVOS = ['Me quedan 3 lugares para este Sprint de tres días. ¿Quieres que te registre?', 'Es una capacitación en vivo para empresarios, del 18 al 20/11, de 19 a 21 h (CDMX).'];
const PEGADO = ['Los textos que te pasé no están en el flujo. Editalos y agregalos:', '', NUEVOS[0], '', NUEVOS[1]].join('\n');
const base = deIA({ disparador: 'd1', inicio: 't1', tarjetas: [
  { id: 't1', tipo: 'mensaje', texto: ANTES[0], sigue: 't2' }, { id: 't2', tipo: 'mensaje', texto: ANTES[1] },
] }, ctx, rndDe()).pasos as PasoIA[];
const [m1, m2] = base.filter((p) => claseDe(p) === 'mensaje');
const textos = (pasos: readonly PasoIA[]) => pasos.filter((p) => claseDe(p) === 'mensaje').map((p) => String(p.cuerpo));
const revisar = (obj: unknown, o: { pedido: string; historial?: Array<{ de: string; texto: string }>; pasos?: PasoIA[] }) =>
  revisarEdicion({ obj, base: o.pasos ?? base, ctx, pedido: o.pedido, historial: o.historial ?? [], intencion: 'editar' });

// rotura (sacar el paso 2 de `revisarEdicion`: pedir SUMAR y cambiar lo que había) → 1 rojo de 7 (éste).
test('«Editalos y agregalos» con la respuesta GRABADA que pisó: vuelve al modelo con el error; la que suma, pasa', () => {
  assert.equal(pideAgregar(PEGADO), true, '«Editalos y agregalos» suma');
  assert.equal(pideAgregar('Agregá estos textos después de los dos que ya están'), true);
  assert.equal(pideAgregar('Cambiá el primero por éste y agregá otro'), false, 'pide cambiar: no es sólo sumar');
  // Lo que devolvió el modelo en producción: cambió los dos mensajes que había por los nuevos.
  const piso = revisar({ cambiar: [{ id: m1.id, texto: NUEVOS[0] }, { id: m2.id, texto: NUEVOS[1] }] }, { pedido: PEGADO });
  assert.equal(cambioTextoDeMensajes(base, piso.r), true);
  assert.deepEqual(piso.errores, [ERROR_AGREGAR_PISA]);
  // Lo que tiene que devolver: los dos nuevos al final, sin tocar los de antes.
  const suma = revisar({ agregar: [{ despues_de: m2.id, salida: 'sig', inicio: 'a1', tarjetas: [
    { id: 'a1', tipo: 'mensaje', texto: NUEVOS[0], sigue: 'a2' }, { id: 'a2', tipo: 'mensaje', texto: NUEVOS[1] },
  ] }] }, { pedido: PEGADO });
  assert.deepEqual(suma.errores, []);
  assert.deepEqual(textos(suma.r.pasos as PasoIA[]), [...ANTES, ...NUEVOS]);
  // Con un pedido de CAMBIAR, cambiar no es un error.
  const cambio = revisar({ cambiar: [{ id: m1.id, texto: NUEVOS[0] }] }, { pedido: 'Cambiá el primer mensaje por éste: «Me quedan 3 lugares para este Sprint de tres días»' });
  assert.deepEqual(cambio.errores, []);
});

// rotura (sacar el paso 3 de `revisarEdicion`: lo hecho no se contesta) → 1 rojo de 7 (éste).
test('«Hazlo como te lo indiqué» con los textos YA en el flujo: lo dice, en vez de «No cambió nada»', () => {
  const hecho = revisar({ agregar: [{ despues_de: m2.id, salida: 'sig', inicio: 'a1', tarjetas: [
    { id: 'a1', tipo: 'mensaje', texto: NUEVOS[0], sigue: 'a2' }, { id: 'a2', tipo: 'mensaje', texto: NUEVOS[1] },
  ] }] }, { pedido: PEGADO }).r.pasos as PasoIA[];
  const historial = [{ de: 'yo', texto: PEGADO }, { de: 'mako', texto: 'Agregué «WHATSAPP: Me quedan 3 lugares…»' }];
  assert.deepEqual(textosPegados(PEGADO), NUEVOS, 'sin el renglón de la orden («…:»)');
  // La respuesta grabada del segundo turno: el modelo no cambió nada.
  const r = revisar({}, { pedido: 'Hazlo como te lo indiqué', historial, pasos: hecho });
  assert.deepEqual(r.errores, []);
  assert.match(String(r.r.respuesta), /^Ya están en el flujo: «Me quedan 3 lugares/);
  // Si NO están, sigue siendo «no cambió nada» (el reintento): no se dice que está hecho lo que no está.
  const falta = revisar({}, { pedido: 'Hazlo como te lo indiqué', historial });
  assert.deepEqual(falta.errores, ['no cambió nada']);
  assert.equal(yaEstaEnElFlujo([{ de: 'yo', texto: '¿Qué hace?' }], hecho), null, 'sin textos pegados en la charla, nada');
});

// roturas (`etapaQueNoExiste` que siempre devuelve null; buscar en todos los CRM aunque nombre uno) → 1 rojo de 7 cada una (éste).
test('una etapa que no existe se dice con las que hay, sin tocar el CRON; una que existe sigue al modelo', () => {
  const pedido = `Que arranque cuando el lead entra a la etapa «Clientes VIP Platino» del CRM «${CRM_PRUEBA}»`;
  const x = etapaQueNoExiste(pedido, ctx);
  assert.deepEqual(x, { etapa: 'Clientes VIP Platino', crm: CRM_PRUEBA, opciones: ['Lead entrante', 'Prospección activa', 'Respondió'] });
  const texto = textoEtapaQueNoExiste(x!);
  // Lo que pide el juez del arnés: que lo diga, y que no cambie el CRON.
  assert.match(texto, /no (existe|est[aá]|la encuentro|la tiene|hay)|no tiene esa/);
  assert.match(texto, /no cambié qué la dispara/);
  assert.match(texto, /«Prospección activa»/);
  assert.equal(etapaQueNoExiste(`Que arranque en la etapa «Prospección activa» del CRM «${CRM_PRUEBA}»`, ctx), null, 'existe');
  assert.equal(etapaQueNoExiste('Que arranque en la etapa Clientes VIP', ctx), null, 'sin comillas no se adivina');
  // Con el CRM nombrado, se mira en ÉSE: «Respondió» existe en el de prueba, no en «Negocio».
  assert.ok(etapaQueNoExiste('la etapa «Respondió» del CRM «Negocio»', ctx), 'el CRM nombrado no la tiene');
});

// rotura (la ruta sin la etapa ANTES del modelo, o sin `revisarEdicion`) → 1 rojo de 7 (éste).
test('la ruta: la etapa que no existe va ANTES del modelo, y cada intento pasa por `revisarEdicion`', () => {
  const ruta = readFileSync(join(__dirname, '..', 'app/api/chat-agent/secuencias/ia/route.ts'), 'utf8').replace(/\r\n/g, '\n');
  const etapa = ruta.indexOf('const sinEtapa = respuestas.length === 0 ? etapaQueNoExiste(pedido, ctx) : null;');
  const explicar = ruta.indexOf('if (vaAExplicar(');
  assert.ok(etapa > 0 && explicar > etapa, 'antes de explicar y de editar');
  assert.match(ruta, /if \(sinEtapa\) \{ await contestar\(textoEtapaQueNoExiste\(sinEtapa\)\); return; \}/);
  assert.match(ruta, /revisarEdicion\(\{ obj, base, ctx, pedido, historial, intencion \}\)/);
});

test('la regla del prompt va con la del código: «agrégalos» es sumar', async () => {
  const { REGLAS_EDITAR } = await import('../lib/flujo-ia-intencion');
  assert.match(REGLAS_EDITAR, /«Agrega», «suma» o «añade».*es SUMAR/);
});

// ── Lo que confirmó el arnés del Cerebro contra producción (87365c830): «hazlo» los DUPLICABA, y la condición no tenía dónde ir ──
const conLosNuevos = () => revisar({ agregar: [{ despues_de: m2.id, salida: 'sig', inicio: 'a1', tarjetas: [
  { id: 'a1', tipo: 'mensaje', texto: NUEVOS[0], sigue: 'a2' }, { id: 'a2', tipo: 'mensaje', texto: NUEVOS[1] },
] }] }, { pedido: PEGADO }).r.pasos as PasoIA[];
const HISTORIAL = [{ de: 'yo', texto: PEGADO }, { de: 'mako', texto: 'Agregué «WHATSAPP: Me quedan 3 lugares…»' }];

// roturas (sin `mensajesCopiados` en `revisarEdicion`; la respuesta «ya está» rechazada como antes) → 1 rojo de 7 cada una (éste).
test('«Hazlo como te lo indiqué» con la respuesta GRABADA que duplicaba (#491) o que contestaba «ya están»: se dice que ya están', () => {
  const hecho = conLosNuevos();
  const ultimo = hecho.filter((p) => claseDe(p) === 'mensaje').at(-1)!;
  // #491: el modelo agregó los dos textos OTRA VEZ.
  const dup = revisar({ agregar: [{ despues_de: ultimo.id, salida: 'sig', inicio: 'b1', tarjetas: [
    { id: 'b1', tipo: 'mensaje', texto: NUEVOS[0], sigue: 'b2' }, { id: 'b2', tipo: 'mensaje', texto: NUEVOS[1] },
  ] }] }, { pedido: 'Hazlo como te lo indiqué', historial: HISTORIAL, pasos: hecho });
  assert.deepEqual(dup.errores, []);
  assert.match(String(dup.r.respuesta), /^Ya están en el flujo/);
  // El modelo contestó que ya estaban: vale (antes `errorDeRespuestaEnEditar` lo rechazaba y el reintento los duplicaba).
  const dijo = revisar({ respuesta: 'Ya están en el flujo los dos textos.' }, { pedido: 'Hazlo como te lo indiqué', historial: HISTORIAL, pasos: hecho });
  assert.deepEqual(dijo.errores, []);
  assert.match(String(dijo.r.respuesta), /^Ya están en el flujo: «Me quedan 3 lugares/);
  // Una copia sin nada pegado en la charla: vuelve al modelo con el error que la nombra.
  const copia = revisar({ agregar: [{ despues_de: m2.id, salida: 'sig', inicio: 'c1', tarjetas: [{ id: 'c1', tipo: 'mensaje', texto: ANTES[0] }] }] }, { pedido: 'Agregá otro mensaje' });
  assert.equal(copia.errores.length, 1);
  assert.match(copia.errores[0], /^«Hola estimado \{\{nombre\}\}, espero que estés muy bie…» ya está en el flujo: no lo agregues otra vez/);
});

// La condición «antes del primer mensaje» (condicion-etiqueta): el CRON con «sig», o el tramo que ya sigue en el primero.
const ctxEtiqueta: CtxIA = { ...ctx, etiquetas: [{ id: 10, nombre: 'Sprint · audio' }], catalogoCondicion: catalogosDe({ etapas: etapasDeCondicion(PRODUCTOS), productos: PRODUCTOS, remotos: null }) };
const tres = deIA({ disparador: 'd1', inicio: 't1', tarjetas: [
  { id: 't1', tipo: 'mensaje', texto: ANTES[0], sigue: 't2' }, { id: 't2', tipo: 'mensaje', texto: ANTES[1], sigue: 't3' }, { id: 't3', tipo: 'mensaje', texto: NUEVOS[0] },
] }, ctxEtiqueta, rndDe()).pasos as PasoIA[];
const primero = tres.filter((p) => claseDe(p) === 'mensaje')[0];
const PEDIDO_COND = 'Antes del primer mensaje, si tiene la etiqueta «Sprint · audio» que siga el flujo; si no la tiene, que no le mande nada';
const condicionDe = (obj: unknown) => revisarEdicion({ obj, base: tres, ctx: ctxEtiqueta, pedido: PEDIDO_COND, historial: [], intencion: 'editar' });

// roturas (`seguir` que corta la flecha a la tarjeta de EN EL MEDIO; el CRON sin «en el medio»; sin la primera rama de la condición) → 1 rojo de 7 cada una (éste).
test('una condición ANTES del primer mensaje: la rama sigue en él, el «si no» termina, y el primero no se duplica', () => {
  const casos: Array<[string, unknown]> = [
    ['la rama sigue en el primero', { agregar: [{ despues_de: 'cron', salida: 'sig', inicio: 'c1', tarjetas: [{ id: 'c1', tipo: 'condicion', ramas: [{ si: [{ campo: 'etiqueta', valor: 'Sprint · audio' }], sigue: primero.id }] }] }] }],
    ['la rama abierta: el código la cuelga', { agregar: [{ despues_de: 'cron', salida: 'sig', inicio: 'c1', tarjetas: [{ id: 'c1', tipo: 'condicion', ramas: [{ si: [{ campo: 'etiqueta', valor: 'Sprint · audio' }] }] }] }] }],
    ['sin «sig», pero sigue en el primero', { agregar: [{ despues_de: 'cron', inicio: 'c1', tarjetas: [{ id: 'c1', tipo: 'condicion', ramas: [{ si: [{ campo: 'etiqueta', valor: 'Sprint · audio' }], sigue: primero.id }] }] }] }],
  ];
  for (const [nombre, obj] of casos) {
    const { r, errores } = condicionDe(obj);
    assert.deepEqual(errores, [], `${nombre}: ${errores.join(' | ')}`);
    const pasos = r.pasos as PasoIA[];
    const cond = pasos.find((p) => claseDe(p) === 'condicion');
    assert.ok(cond, `${nombre}: está la condición`);
    assert.equal(cond!.ramas?.[0]?.siguiente, primero.id, `${nombre}: la rama sigue en el primer mensaje`);
    assert.equal(cond!.si_no ?? null, null, `${nombre}: si no la tiene, nada`);
    assert.deepEqual(textos(pasos), [ANTES[0], ANTES[1], NUEVOS[0]], `${nombre}: los tres mensajes, una vez cada uno`);
    assert.ok(!pasos.some((p) => (p.paralelos ?? []).length), `${nombre}: nada en paralelo`);
    assert.ok(!r.avisos.some((a) => a.includes('dos lugares')), `${nombre}: sin «seguía en dos lugares»`);
    assert.ok(!pasos.some((p) => p.id !== cond!.id && sigueAl(p, primero.id)), `${nombre}: sólo la condición lleva al primero`);
  }
});
