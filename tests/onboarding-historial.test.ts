// =============================================================================
// Las preguntas del arranque se GUARDAN con su respuesta y se ven en el Ops Center (21/10/2026, Florencia, ws21)
// =============================================================================
// Medido en producción el 21/10 (Chrome de Martín, super admin, /second-brain?ws=21): el ws21 tiene 0 chats propios; su
// Ops Center muestra «Mi oferta», la proyección de su conversación de Offer (sesión 14), y ésa SÍ trae las preguntas de
// MaKo. Lo que no estaba en ningún lado era el ARRANQUE (el nombre, el negocio, el PDF, la fase, el CRM, cómo llegó, qué
// resolver primero, el teléfono): ni las preguntas ni las respuestas. La conversación empezaba en «¿Tienes un documento
// de tu oferta…?». Y el documento que ella mandó como respuesta (fila 3, sin texto) tampoco se veía.
// lib/onboarding-historial.ts: lo que MaKo dice se anota la primera vez que se ve, lo que la persona manda se anota tal
// cual, y la proyección y el chat «Onboarding» lo juntan por hora con la conversación de Offer.
//
// ROTURAS: al final del archivo, medidas una por una con el arnés romper.mjs del scratchpad del chat «Onboarding».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AHORA_NO, CAMBIAR_NUMERO, CODIGO_CARGADO, CRM_SI, NEGOCIO_CONFIRMAR, NOMBRE_CONFIRMAR, PDF_OPCIONES, VER_OTROS_TIPOS,
  etapaDeArranque, leerRespuesta, mensajesDeArranque, mensajesDelHilo,
  type EstadoArranque, type HechosArranque, type MensajeArranque,
} from '../lib/onboarding-arranque';
import {
  ID_CIERRE, TOPE_MENSAJES, anotarCon, conLoNuevo, leerHistorial, loQueContesto, sesionDelArranque, unirConOffer, type MensajeHistorial,
} from '../lib/onboarding-historial';
import { AVISO_RECONSTRUIDO, NOTA_DE_VOZ, mensajesDeOffer } from '../lib/chat-mako-reglas';
import { audioDeBloques, bloqueDeAudio, sanearBloques } from '../lib/chat-mako-bloques';
import { bloquesGuardados } from '../lib/chat-bloques';

const leer = (r: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', r), 'utf8').replace(/\r\n/g, '\n');
const iso = (t: number) => new Date(t).toISOString();
const vistaDe = (antes: MensajeArranque[], despues: MensajeArranque[] = []) => ({ antes, despues });
const m = (id: string, de: 'mako' | 'yo', texto: string, opciones?: string[]): MensajeArranque => ({ id, de, texto, ...(opciones ? { opciones } : {}) });
const hist = (n: number): MensajeHistorial[] => Array.from({ length: n }, (_, i) => ({ id: `x-${i}`, de: i % 2 ? 'yo' as const : 'mako' as const, texto: `t${i}`, at: iso(i + 1) }));

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: '', nombreWorkspace: '', faseGuardada: false, canalNegocio: null, loQueVende: false,
  conCrm: true, conTelefono: false, terminado: false,
};
const FASE = { canal: 'llamadas' as never, faseResp: Array.from({ length: 20 }, () => 0) };

test('1. de lo dibujado (la reconstrucción): una vez, en orden, siempre después de lo anotado; otro texto es otro mensaje', () => {
  const v1 = vistaDe([m('arr-nombre', 'mako', '¿Cómo te llamas?'), m('arr-nombre-r', 'yo', 'Hola, soy Ana'), m('arr-nombre-ok', 'mako', '¿Te llamo «Ana»?')]);
  const h1 = conLoNuevo([], v1, { ahora: 1_000 })!;
  assert.deepEqual(h1.map((x) => [x.id, x.texto, x.at]), [
    ['arr-nombre', '¿Cómo te llamas?', iso(1_000)], ['arr-nombre-r', 'Hola, soy Ana', iso(1_001)], ['arr-nombre-ok', '¿Te llamo «Ana»?', iso(1_002)],
  ]);
  assert.equal(conLoNuevo(h1, v1, { ahora: 2_000 }), null, 'lo mismo otra vez no anota nada');
  const v2 = vistaDe([m('arr-nombre', 'mako', '¿Cómo te llamas?'), m('arr-nombre-r', 'yo', 'Ana'), m('arr-negocio', 'mako', 'Un gusto, Ana. ¿Cómo se llama tu negocio?')]);
  // `ahora` ANTES de lo anotado (un reloj atrasado): igual va después.
  const h2 = conLoNuevo(h1, v2, { ahora: 500 })!;
  assert.deepEqual(h2.map((x) => x.texto), ['¿Cómo te llamas?', 'Hola, soy Ana', '¿Te llamo «Ana»?', 'Ana', 'Un gusto, Ana. ¿Cómo se llama tu negocio?']);
  assert.deepEqual(h2.slice(3).map((x) => x.at), [iso(1_003), iso(1_004)], 'siempre después de lo anotado');
  assert.equal(conLoNuevo([], vistaDe([m('x', 'mako', '   ')]), { ahora: 1 }), null, 'lo vacío no se anota');
});

test('2. lo de ANTES de Offer que se anota tarde va antes de su primer mensaje; lo de después, ahora', () => {
  const v = vistaDe([m('arr-nombre', 'mako', 'Hola'), m('arr-nombre-r', 'yo', 'Ana')], [m('arr-pdf', 'mako', '¿Está correcto?'), m('arr-pdf-r', 'yo', 'Sí')]);
  const h = conLoNuevo([], v, { ahora: 9_000, primeroDeOffer: 5_000, reconstruido: true })!;
  assert.deepEqual(h.map((x) => x.at), [iso(4_998), iso(4_999), iso(9_000), iso(9_001)]);
  assert.ok(h.every((x) => x.reconstruido === true));
  assert.deepEqual(conLoNuevo([], v, { ahora: 9_000, primeroDeOffer: null })!.map((x) => x.at), [iso(9_000), iso(9_001), iso(9_002), iso(9_003)]);
  assert.equal(conLoNuevo([], v, { ahora: 9_000 })![0].reconstruido, undefined);
});

test('3. el historial guardado: lo que no se entiende no se pisa', () => {
  assert.deepEqual(leerHistorial(null), []);
  assert.deepEqual(leerHistorial(''), []);
  assert.equal(leerHistorial('{roto'), null, 'ilegible: null, y no se escribe encima');
  assert.equal(leerHistorial('[1,2]'), null);
  const mezcla = JSON.stringify({ mensajes: [
    { id: 'a', de: 'mako', texto: 'Hola', at: iso(1) }, { id: 'b', de: 'otro', texto: 'x', at: iso(2) }, { id: 'c', de: 'yo', texto: 'Ana', at: 'ayer' },
    { id: 'd', de: 'yo', texto: 'Ana', at: iso(3), reconstruido: true },
  ] });
  assert.deepEqual(leerHistorial(mezcla), [{ id: 'a', de: 'mako', texto: 'Hola', at: iso(1) }, { id: 'd', de: 'yo', texto: 'Ana', at: iso(3), reconstruido: true }], 'para dibujar');
  assert.equal(leerHistorial(mezcla, { estricto: true }), null, 'para escribir, una entrada que no entiende no se borra en silencio');
  assert.equal(sesionDelArranque(JSON.stringify({ sesionId: 14 })), 14);
  assert.equal(sesionDelArranque(JSON.stringify({ sesionId: '14' })), null);
  assert.equal(sesionDelArranque('no'), null);
});

/**
 * El onboarding de punta a punta COMO LO CORRE LA RUTA (app/api/onboarding/arranque/route.ts): cada respuesta pasa por
 * `leerRespuesta`; antes de guardarla se anota la vista de antes con lo que mandó (`anotarRespuesta`) y después la vista
 * nueva (`listo`). El teléfono y el código, con sus acciones propias. Con el onboarding terminado anota sólo el cierre.
 */
function recorrer(telefono: 'cambiar' | 'ahora-no') {
  let e: EstadoArranque = {};
  let hh: HechosArranque = { ...H, conTelefono: true };
  let hist: MensajeHistorial[] = [];
  let t = 1_000;
  let primero: number | null = null;
  const offer: Array<{ de: 'mako' | 'yo'; texto: string; at: string; adjuntos?: Array<{ nombre: string }> }> = [];
  const anotar = (v: ReturnType<typeof mensajesDeArranque>, respuesta?: string | null) => {
    hist = conLoNuevo(hist, v, { ahora: (t += 10), primeroDeOffer: primero, vivo: true, respuesta }) ?? hist;
  };
  const listo = (cierre = false) => { if (cierre || !hh.terminado) anotar(mensajesDeArranque(e, hh)); };
  const responder = (r: { texto?: string; opcion?: number }) => {
    const v = mensajesDeArranque(e, hh);
    const abierta = [...v.antes, ...v.despues].filter((x) => x.de === 'mako').pop();
    const opcionTexto = r.opcion !== undefined ? abierta?.opciones?.[r.opcion] : undefined;
    const l = leerRespuesta(e, hh, { ...r, ...(opcionTexto ? { opcionTexto } : {}), pregunta: abierta?.texto });
    if (!l.ok) throw new Error(`${etapaDeArranque(e, hh)}: ${l.error}`);
    const nuevo: Record<string, unknown> = { ...e };
    for (const [k, val] of Object.entries(l.patch)) { if (val === undefined) delete nuevo[k]; else nuevo[k] = val; }
    if (l.fase) hh = { ...hh, faseGuardada: true, canalNegocio: (l.faseCanal ?? (nuevo.canal as never) ?? null) as never };
    anotar(v, loQueContesto(v, r));
    e = nuevo as EstadoArranque;
    listo();
  };
  const conAccion = (cambio: Partial<EstadoArranque>, dicho: string) => {
    anotar(mensajesDeArranque(e, hh), dicho);
    e = { ...e, ...cambio };
    listo();
  };
  listo(); // 'intro'
  let telefonos = 0;
  let codigos = 0;
  for (let vuelta = 0; vuelta < 60; vuelta++) {
    const etapa = etapaDeArranque(e, hh);
    if (etapa === 'nombre') responder(e.nombrePorConfirmar ? { opcion: 0 } : { texto: 'Hola, soy Ana' });
    else if (etapa === 'negocio') responder(e.negocioPorConfirmar ? { opcion: 0 } : { texto: 'mi marca: Acme' });
    else if (etapa === 'oferta') {
      // La conversación de Offer (va por /api/offer, no pasa por acá).
      primero = t + 100;
      offer.push({ de: 'mako', texto: '¿Tienes un documento de tu oferta?', at: iso(t + 100) },
        { de: 'yo', texto: '', at: iso(t + 110), adjuntos: [{ nombre: 'oferta.pdf' }] }, { de: 'mako', texto: 'Ya tengo todas las piezas.', at: iso(t + 120) });
      t += 200;
      hh = { ...hh, loQueVende: true };
    } else if (etapa === 'crm') responder({ opcion: e.crmVerTodos ? 0 : 1 });
    else if (etapa === 'telefono') {
      if (telefono === 'ahora-no') responder({ opcion: 0 });
      else conAccion({ telefono: 'codigo', telefonoNumero: `+54911000000${telefonos}` }, `+54911000000${telefonos++}`);
    } else if (etapa === 'codigo') {
      if (codigos++ === 0) responder({ opcion: 0 }); // «Cambiar número»
      else conAccion({ telefono: 'verificado' }, CODIGO_CARGADO);
    } else if (etapa === 'cierre') { hh = { ...hh, terminado: true }; listo(true); break; }
    else responder({ opcion: 0 }); // pdf, fase, origen, interes
  }
  // Un POST viejo con todo terminado (el nombre del negocio arreglado después): no suma nada.
  e = { ...e, negocio: 'Otro nombre' };
  listo();
  return { hist, offer, e, hh };
}

test('4. EN VIVO, el onboarding entero como lo corre la ruta: cada pregunta con su respuesta, tal cual, y una vez', () => {
  for (const variante of ['cambiar', 'ahora-no'] as const) {
    const { hist, offer, e, hh } = recorrer(variante);
    // Con el cierre anotado el historial queda cerrado, lo anote quien lo anote (la copia al chat «Onboarding», otro cierre).
    assert.equal(conLoNuevo(hist, mensajesDeArranque({ ...e, negocio: 'Otro nombre' }, hh), { ahora: 1e9, vivo: true }), null, `${variante}: congelado`);
    assert.equal(conLoNuevo(hist, vistaDe([]), { ahora: 1e9, vivo: true, respuesta: 'hola' }), null);
    const de = (x: MensajeHistorial) => `${x.de}:${x.texto.slice(0, 40)}`;
    hist.forEach((x, i) => {
      if (x.de === 'yo') assert.equal(hist[i - 1]?.de, 'mako', `${variante}: «${x.texto}» sin su pregunta`);
      // Dos de MaKo seguidos: sólo si el primero no pregunta nada (el pase a Offer, la intro de la fase, «lo anoto»).
      if (x.de === 'mako' && hist[i + 1]?.de === 'mako') assert.ok(['arr-oferta', 'arr-fase', 'arr-pdf-no'].includes(x.id), `${variante}: «${x.texto.slice(0, 50)}» sin respuesta`);
      if (i > 0) assert.notEqual(de(x), de(hist[i - 1]), `${variante}: «${x.texto.slice(0, 40)}» dos veces seguidas`);
    });
    assert.equal(hist[hist.length - 1].id, ID_CIERRE, `${variante}: termina en el cierre`);
    assert.ok(hist.every((x) => !x.reconstruido), 'en vivo no lleva la marca');
    const textos = hist.map((x) => x.texto);
    assert.ok(textos.indexOf(NOMBRE_CONFIRMAR[0]) === textos.indexOf('¿Te llamo «Ana»?') + 1, 'el toque de la confirmación, debajo de ella');
    assert.ok(textos.includes(NEGOCIO_CONFIRMAR[0]));
    assert.ok(!textos.includes('Otro nombre') && !textos.some((x) => /Otro nombre/.test(x)), 'el negocio arreglado después no reescribe lo que pasó');
    const iVer = textos.indexOf(VER_OTROS_TIPOS);
    // La recomendación del funnel (5/11/2026): «Hay 12 funnels en MaKo. Para ti: «…».», con el porqué que escribe el código.
    const esCrm = (x: string | undefined) => /^Hay 12 funnels en MaKo\. Para ti: «/.test(x ?? '');
    assert.ok(iVer > 0 && esCrm(textos[iVer - 1]) && esCrm(textos[iVer + 1]), 'la pregunta que vuelve, otra vez');
    assert.ok(textos.includes('¿Cómo te llegan hoy los clientes?'), 'por llamada, la entrada antes del CRM');
    if (variante === 'cambiar') {
      assert.deepEqual(hist.filter((x) => x.de === 'yo' && x.texto.startsWith('+54')).map((x) => x.texto), ['+549110000000', '+549110000001']);
      assert.equal(textos.filter((x) => x === CAMBIAR_NUMERO).length, 1);
      const iCodigo = textos.indexOf(CODIGO_CARGADO);
      assert.match(textos[iCodigo - 1], /Te mandé un código/, 'el código cargado, debajo de su pregunta');
      assert.match(textos[iCodigo + 1], /cómo te llamas/, 'y sigue con el nombre');
    } else {
      assert.equal(textos[1], AHORA_NO, 'lo primero que contesta');
      assert.equal(textos.filter((x) => x.includes('¿A qué WhatsApp')).length, 1, 'en el cierre no se repite');
    }
    const unido = unirConOffer(hist, offer).map((x) => x.texto);
    assert.match(unido[0], /^¡Hola! Soy MaKo/, 'empieza por el saludo, no por la oferta');
    assert.ok(unido.indexOf('¿Tienes un documento de tu oferta?') > unido.findIndex((x) => /Lo primero es tu oferta: con ella conozco Acme/.test(x)));
    assert.ok(unido.indexOf(PDF_OPCIONES[0]) === unido.findIndex((x) => /PDF con tu oferta/.test(x)) + 1, 'el PDF y su respuesta, después de Offer');
    assert.ok(unido.findIndex((x) => /PDF con tu oferta/.test(x)) > unido.indexOf('Ya tengo todas las piezas.'));
  }
});

test('4b. EN VIVO: el mismo toque dos veces (dos POST a la vez) no duplica pregunta y respuesta', () => {
  const v = vistaDe([m('arr-negocio-ok', 'mako', '¿Tu negocio se llama «Acme»?', [...NEGOCIO_CONFIRMAR])]);
  const h1 = conLoNuevo([], v, { ahora: 10, vivo: true })!;
  const h2 = conLoNuevo(h1, v, { ahora: 20, vivo: true, respuesta: NEGOCIO_CONFIRMAR[0] })!;
  assert.equal(conLoNuevo(h2, v, { ahora: 30, vivo: true, respuesta: NEGOCIO_CONFIRMAR[0] }), null);
  assert.deepEqual(h2.map((x) => x.texto), ['¿Tu negocio se llama «Acme»?', NEGOCIO_CONFIRMAR[0]]);
  // CRUZADO: el primer POST ya anotó lo que sigue («Gracias… cuéntame qué vendes») cuando llega el segundo.
  const h3 = conLoNuevo(h2, vistaDe([m('arr-oferta', 'mako', 'Gracias, Ana. Ahora cuéntame qué vendes en Acme.')]), { ahora: 40, vivo: true })!;
  assert.equal(conLoNuevo(h3, v, { ahora: 50, vivo: true, respuesta: NEGOCIO_CONFIRMAR[0] }), null, 'tampoco cruzado');
  // Una pregunta que se VOLVIÓ a hacer, contestada igual: eso sí se anota (pasó dos veces).
  const otra = vistaDe([m('arr-nombre-ok', 'mako', '¿Te llamo «Que Tal»?', [...NOMBRE_CONFIRMAR])]);
  let h4 = conLoNuevo([], otra, { ahora: 10, vivo: true })!;
  h4 = conLoNuevo(h4, otra, { ahora: 20, vivo: true, respuesta: NOMBRE_CONFIRMAR[1] })!;
  h4 = conLoNuevo(h4, otra, { ahora: 30, vivo: true })!; // la vuelve a hacer
  h4 = conLoNuevo(h4, otra, { ahora: 40, vivo: true, respuesta: NOMBRE_CONFIRMAR[1] })!;
  assert.deepEqual(h4.map((x) => x.texto), ['¿Te llamo «Que Tal»?', NOMBRE_CONFIRMAR[1], '¿Te llamo «Que Tal»?', NOMBRE_CONFIRMAR[1]]);
});

test('5. EN VIVO: la pregunta que vuelve después de una respuesta se anota otra vez («Ver los 12»)', () => {
  const CRM_PREGUNTA = 'Hay 12 funnels en MaKo. Para ti: «Llamada de venta».';
  const crm = (opciones: string[]) => vistaDe([], [m('arr-crm', 'mako', CRM_PREGUNTA, opciones)]);
  let h = conLoNuevo([], crm([CRM_SI, VER_OTROS_TIPOS]), { ahora: 10, vivo: true })!;
  h = conLoNuevo(h, crm([CRM_SI, VER_OTROS_TIPOS]), { ahora: 20, vivo: true, respuesta: loQueContesto(crm([CRM_SI, VER_OTROS_TIPOS]), { opcion: 1 }) })!;
  h = conLoNuevo(h, crm(['Llamada de venta', 'Sesión presencial']), { ahora: 30, vivo: true })!;
  assert.deepEqual(h.map((x) => x.texto), [CRM_PREGUNTA, VER_OTROS_TIPOS, CRM_PREGUNTA]);
  assert.equal(conLoNuevo(h, crm(['Llamada de venta', 'Sesión presencial']), { ahora: 40, vivo: true }), null, 'pero no a cada rato');
  assert.equal(loQueContesto(crm(['Llamada de venta', 'Sesión presencial']), { opcion: 1 }), 'Sesión presencial');
  assert.equal(loQueContesto(crm(['A']), { opcion: 7 }), null);
  assert.equal(loQueContesto(crm(['A']), { texto: '  hola ' }), 'hola');
});

test('6. EN VIVO sin nada anotado y con respuestas ya dadas (a mitad el día del deploy): lo dibujado, marcado reconstruido', () => {
  const v = vistaDe([m('arr-nombre', 'mako', 'Hola'), m('arr-nombre-r', 'yo', 'Ana'), m('arr-negocio', 'mako', '¿Tu negocio?', ['x'])]);
  const h = conLoNuevo([], v, { ahora: 100, vivo: true, respuesta: 'Acme' })!;
  assert.deepEqual(h.map((x) => [x.texto, !!x.reconstruido]), [['Hola', true], ['Ana', true], ['¿Tu negocio?', true], ['Acme', false]]);
  // Sin respuestas dadas (alguien que recién empieza), nada es reconstruido.
  assert.equal(conLoNuevo([], vistaDe([m('arr-nombre', 'mako', 'Hola')]), { ahora: 1, vivo: true })![0].reconstruido, undefined);
});

test('7. el tope: pasado TOPE_MENSAJES no se anota más, una tanda que no entra entera tampoco, y lo viejo queda', () => {
  assert.equal(conLoNuevo(hist(TOPE_MENSAJES), vistaDe([m('n', 'mako', 'nueva')]), { ahora: 1e6 }), null);
  assert.equal(conLoNuevo(hist(TOPE_MENSAJES - 1), vistaDe([m('n1', 'mako', 'uno')]), { ahora: 1e6, vivo: true, respuesta: 'dos' }), null, 'la pregunta sin su respuesta, no');
  const justo = conLoNuevo(hist(TOPE_MENSAJES - 2), vistaDe([m('n1', 'mako', 'uno')]), { ahora: 1e6, vivo: true, respuesta: 'dos' })!;
  assert.equal(justo.length, TOPE_MENSAJES);
  assert.equal(justo[0].id, 'x-0', 'el principio (el saludo, el nombre) queda');
});

test('8. el compare-and-set: compara contra lo recién leído, lo ilegible no se pisa, una carrera vuelve a leer', async () => {
  // Una base de mentira con la semántica de `cambiarSettingSi`: escribe sólo si lo guardado sigue siendo `esperado`.
  const base = (inicial: string | null, otraPestana?: string) => {
    let guardado = inicial;
    let primera = true;
    const escrito: string[] = [];
    const esperados: Array<string | null> = [];
    return {
      escrito, esperados, guardado: () => guardado,
      io: {
        leer: async () => { const v = guardado; if (primera && otraPestana) { guardado = otraPestana; } primera = false; return v; },
        cambiar: async (esperado: string | null, nuevo: string) => { esperados.push(esperado); if (guardado !== esperado) return false; guardado = nuevo; escrito.push(nuevo); return true; },
      },
    };
  };
  const calc = (p: MensajeHistorial[]) => conLoNuevo(p, vistaDe([m('a', 'mako', 'Hola')]), { ahora: 1_000, vivo: true });
  const ilegible = base('{roto');
  await assert.rejects(anotarCon(ilegible.io, calc));
  assert.equal(ilegible.escrito.length, 0);
  const raro = base(JSON.stringify({ mensajes: [{ id: 'v2', de: 'sistema', texto: 'x', at: iso(1) }] }));
  await assert.rejects(anotarCon(raro.io, calc), 'una entrada de una versión más nueva no se borra');
  assert.equal(raro.escrito.length, 0);
  // Otra pestaña escribe entre la lectura y la escritura: se pierde el primer intento, se relee y lo suyo queda.
  const otra = JSON.stringify({ mensajes: [{ id: 'b', de: 'mako', texto: 'Otra pestaña', at: iso(500) }] });
  const carrera = base(null, otra);
  assert.equal(await anotarCon(carrera.io, calc), 1);
  assert.deepEqual(carrera.esperados, [null, otra], 'cada intento compara contra lo que acaba de leer');
  assert.deepEqual(JSON.parse(carrera.guardado()!).mensajes.map((x: MensajeHistorial) => x.texto), ['Otra pestaña', 'Hola']);
  const igual = base(JSON.stringify({ mensajes: [{ id: 'a', de: 'mako', texto: 'Hola', at: iso(1) }] }));
  assert.equal(await anotarCon(igual.io, calc), 0);
  assert.equal(igual.escrito.length, 0, 'nada nuevo, nada escrito');
  const siempre = { leer: async () => null, cambiar: async () => false };
  await assert.rejects(anotarCon(siempre, calc), /cambió 3 veces/);
});

test('9. Florencia (ws21): terminó el 18/10 sin historial; reconstruido, su conversación empieza por su nombre', () => {
  // Sin el teléfono (H): con el WhatsApp primero (30/10) reconstruir hoy lo pondría arriba, y ella lo contestó al final. No lo
  // alcanza: el 31/10 no queda ningún negocio terminado sin historial (medido en producción).
  const e: EstadoArranque = {
    introVista: true, nombre: 'Florencia', negocio: 'mi marca personal: Florencia Ayelen Carballo', sesionId: 14, pdfOk: 'si',
    faseResp: [1, 0, 0, 2, 0, 2], canal: 'llamadas', crmTipo: 'llamada', origen: 'Me lo recomendaron', interes: 'anuncios',
    telefono: 'verificado', telefonoNumero: '+543874747059',
  };
  const hh: HechosArranque = { ...H, loQueVende: true, faseGuardada: true, canalNegocio: 'llamadas', terminado: true };
  const primero = Date.parse('2026-10-18T22:24:41.169Z');
  const historial = conLoNuevo([], mensajesDeArranque(e, hh), { ahora: Date.parse('2026-10-18T23:07:30.832Z') - 1_000, primeroDeOffer: primero, reconstruido: true })!;
  const offer = [
    { de: 'mako' as const, texto: '¿Tienes un documento de tu oferta, tu guion de ventas o el link de tu web o landing?', at: '2026-10-18T22:24:41.169Z' },
    { de: 'yo' as const, texto: 'https://www.instagram.com/asesora_tesis_demo/', at: '2026-10-18T22:25:21.500Z' },
    { de: 'mako' as const, texto: 'Perfecto: en la primera semana logran claridad absoluta. ¡Gracias!', at: '2026-10-18T22:53:45.918Z' },
  ];
  const unido = unirConOffer(historial, offer);
  assert.deepEqual(unido.slice(0, 4).map((x) => [x.de, x.texto.slice(0, 22)]), [
    ['mako', '¡Hola! Soy MaKo. Para '], ['yo', 'Florencia'], ['mako', 'Un gusto, Florencia. ¿'], ['yo', 'mi marca personal: Flo'],
  ]);
  const iUltimoOffer = unido.findIndex((x) => x.texto.startsWith('Perfecto: en la primera semana'));
  assert.ok(unido.slice(iUltimoOffer + 1).every((x) => 'reconstruido' in x && x.reconstruido), 'lo de después, todo después de Offer');
  assert.ok(unido.some((x) => x.de === 'yo' && x.texto === 'Me lo recomendaron'));
});

test('10. juntar por hora: cada lista conserva su orden; un mensaje de Offer sin hora queda donde estaba', () => {
  const h = [
    { id: 'b', de: 'yo' as const, texto: 'B', at: iso(20) },
    { id: 'a', de: 'mako' as const, texto: 'A', at: iso(10) },
    { id: 'd', de: 'mako' as const, texto: 'D', at: iso(40) },
  ];
  const o = [{ de: 'mako' as const, texto: 'C', at: iso(20) }, { de: 'yo' as const, texto: 'C2' }, { de: 'mako' as const, texto: 'E', at: iso(50) }];
  assert.deepEqual(unirConOffer(h, o).map((x) => x.texto), ['A', 'B', 'C', 'C2', 'D', 'E'], 'a la misma hora, primero el arranque');
  assert.deepEqual(unirConOffer([], o).map((x) => x.texto), ['C', 'C2', 'E']);
});

test('11. en el Ops Center: el adjunto y el audio sin texto se ven, y «Reconstruido» lo lee sólo el super admin', () => {
  const ms = [
    { de: 'mako' as const, texto: '¿Cómo te llamas?', at: iso(1), reconstruido: true },
    { de: 'yo' as const, texto: 'Ana', at: iso(2), reconstruido: true },
    { de: 'mako' as const, texto: '¿Tienes un documento?', at: iso(3) },
    { de: 'yo' as const, texto: '', at: iso(4), adjuntos: [{ nombre: 'tesis.pdf' }] },
    { de: 'mako' as const, texto: '¿Está correcto?', at: iso(5), reconstruido: true },
  ];
  assert.deepEqual(mensajesDeOffer(ms).map((x) => x.content), ['¿Cómo te llamas?', 'Ana', '¿Tienes un documento?', 'Adjunto: tesis.pdf', '¿Está correcto?']);
  assert.deepEqual(mensajesDeOffer(ms, { avisoReconstruido: true }).map((x) => x.content),
    [AVISO_RECONSTRUIDO, '¿Cómo te llamas?', 'Ana', '¿Tienes un documento?', 'Adjunto: tesis.pdf', AVISO_RECONSTRUIDO, '¿Está correcto?'], 'un aviso por tramo');
  assert.doesNotMatch(AVISO_RECONSTRUIDO, /\b(vos|tenés|podés)\b/, 'español neutro');
  const voz = mensajesDeOffer([
    { de: 'yo', texto: 'El 100% logró el éxito.', at: iso(1), audio: { url: '/api/offer/audio?id=14&m=137906e0', secs: 3 } },
    { de: 'yo', texto: '', at: iso(2), audio: { url: '/api/offer/audio?id=14&m=x', secs: 5 } },
  ]);
  assert.deepEqual(voz[0], { role: 'user', content: 'El 100% logró el éxito.', created_at: iso(1), audio: { url: '/api/offer/audio?id=14&m=137906e0', secs: 3 } });
  assert.equal(voz[1].content, NOTA_DE_VOZ, 'sin transcripción, nunca una burbuja vacía');
});

test('12. el chat «Onboarding» guarda qué mensaje de Offer tiene el audio, y el bloque no lleva ruta de Storage', () => {
  const hilo = mensajesDelHilo([
    { de: 'mako', texto: '¿Cuánto cobras?' },
    { de: 'yo', texto: 'Seis cuotas', id: '4ac9f6df-0000-4000-8000-000000000000', audio: { secs: 110.4 } },
    { de: 'yo', texto: '', id: 'b6caad71-0000-4000-8000-000000000000', audio: { secs: 2 } },
  ], { nombre: 'Ana', telefonoVerificado: false });
  assert.deepEqual(hilo[1], { role: 'user', content: 'Seis cuotas', audio: { mensaje: '4ac9f6df-0000-4000-8000-000000000000', secs: 110 } });
  assert.equal(hilo[2].content, NOTA_DE_VOZ);
  assert.equal(hilo[0].audio, undefined);
  const b = bloqueDeAudio(14, '4ac9f6df-0000-4000-8000-000000000000', 110);
  assert.deepEqual(audioDeBloques([b]), b);
  assert.equal(audioDeBloques([{ k: 'audio', sesion: 14, mensaje: '../21/offer/x' }]), null);
  assert.equal(audioDeBloques([{ k: 'audio', sesion: '14', mensaje: 'a' }]), null);
  assert.deepEqual(sanearBloques(21, [b]), [], 'los adjuntos lo saltean');
  assert.deepEqual(bloquesGuardados([b]), [], 'los bloques de la vista también');
});

// ── El cableado (regex sobre el código: lo que una función pura no puede mostrar) ─────────────────────────────────────
test('13. se anota al CONTESTAR (la ruta, con lo que mandó), nunca al mirar, y con las lecturas confirmadas', () => {
  const ruta = leer('app/api/onboarding/arranque/route.ts');
  assert.match(ruta, /vista: await vistaArranque\(\{ anotar: o\.cierre \? 'cierre' : true \}\) \}\);/);
  assert.match(ruta, /return listo\(r\.avisos\.length \? \{ aviso: r\.avisos\.join\(' '\) \} : \{\}, \{ cierre: true \}\);/, 'sólo el cierre anota con todo terminado');
  // La confirmación, ANTES de escribir nada: la respuesta que cierra la fase guarda el diagnóstico que se compara.
  const resp = ruta.slice(ruta.indexOf("case 'responder'"), ruta.indexOf("case 'sesion'"));
  const iConf = resp.indexOf('const confirmado = await hechosConfirmados(h);');
  assert.ok(iConf > 0 && iConf < resp.indexOf('setDiagnosticoFase(') && iConf < resp.indexOf('guardarEstadoArranque('), 'confirmar antes de escribir');
  const get = ruta.slice(ruta.indexOf('export async function GET'), ruta.indexOf('export async function POST'));
  assert.match(get, /vista: await vistaArranque\(\) \}/, 'el GET no anota');
  assert.match(leer('app/onboarding/page.tsx'), /const vista = await vistaArranque\(\);/, 'la página no anota');
  assert.match(ruta, /const nuevo = await guardarEstadoArranque\(patch\);\n[\s\S]{0,300}?await anotarRespuesta\(e, h, loQueContesto\(mensajesDeArranque\(e, h\), \{ texto, opcion \}\), confirmado\);/, 'después de guardar');
  assert.match(ruta, /await anotarRespuesta\(e, h, CODIGO_CARGADO, confirmado\);/, 'el código no se guarda');
  assert.match(ruta, /await anotarRespuesta\(e, h, `\+\$\{digitos\}`, confirmado\);/);
  assert.match(ruta, /if \(r\.yaVerificado\) await anotarRespuesta\(\{ \.\.\.e, telefono: 'verificado', telefonoNumero: `\+\$\{digitos\}` \}, h, CODIGO_CARGADO, confirmado\);/, 'ya verificado: el código, como cargado');
  const srv = leer('lib/onboarding-arranque-server.ts');
  const vista = srv.slice(srv.indexOf('export async function vistaArranque'));
  assert.match(vista, /try \{ e = parseEstado\(await getSettingEstricto\(CLAVE\)\); estricto = true; \} catch \{ e = \{\}; \}/, 'el estado, estricto');
  assert.match(vista, /if \(estricto && \(o\.anotar === 'cierre' \|\| !h\.terminado\) && \(await hechosConfirmados\(h\)\)\) \{/);
  const conf = srv.slice(srv.indexOf('export async function hechosConfirmados'), srv.indexOf('export async function anotarHistorial'));
  for (const lectura of ["getSupabaseServer().from('workspaces').select('capa')", 'getDiagnosticoFaseEstricto()', 'getEstadoOnboardingEstricto()']) {
    assert.ok(conf.includes(lectura), `relee ${lectura}`);
  }
  assert.match(conf, /return modo === h\.modo && capa\.onboarding\.includes\('tabs'\) === h\.conTelefono && \(diag != null\) === h\.faseGuardada\n      && canal === h\.canalNegocio && \(onb\.status === 'done'\) === h\.terminado;/);
  assert.match(srv.slice(srv.indexOf('export async function anotarRespuesta')), /if \(!dicho\?\.trim\(\) \|\| !confirmado\) return;/);
  assert.match(srv, /\{ leer: \(\) => getSettingEstricto\(CLAVE_HISTORIAL\), cambiar: \(raw, nuevo\) => cambiarSettingSi\(CLAVE_HISTORIAL, raw, nuevo\) \}/);
  assert.match(leer('lib/fase-store.ts'), /return parseFase\(await getSettingEstricto\(FASE_KEY\)\);/);
});

test('14. el Ops Center pega el historial SÓLO a la conversación del onboarding, con el audio y el aviso sólo al super admin', () => {
  const ind = leer('lib/chat-mako-indice.ts');
  const hilo = ind.slice(ind.indexOf('export async function hiloDeOffer'));
  assert.match(hilo, /runWithWorkspace\(ws, \(\) => Promise\.all\(\[\n    leerConversacionOffer\(id\),\n    getSetting\('onboarding\.arranque'\)\.catch\(\(\) => null\),\n    getSetting\(CLAVE_HISTORIAL\)\.catch\(\(\) => null\),\n    getSesionAdmin\(\)\.catch\(\(\) => null\),\n  \]\)\)/);
  assert.match(hilo, /const deOffer = c\.mensajes\.map\(\(\{ audio, \.\.\.m \}\) => \(audio \? \{ \.\.\.m, audio: \{ url: urlAudio\(c\.id, m\.id\), secs: audio\.secs \} \} : m\)\);/, 'la ruta de Storage no sale');
  assert.match(hilo, /const conversacion = sesionDelArranque\(arranque\) === c\.id \? unirConOffer\(leerHistorial\(historial\) \?\? \[\], deOffer\) : deOffer;/);
  assert.match(hilo, /mensajes: mensajesDeOffer\(conversacion, \{ avisoReconstruido: !!superAdmin \}\)/);
  assert.match(ind, /titulo: s\.id === delOnboarding && !copiada \? TITULO_HILO : s\.titulo/, '«Onboarding» para quien no tiene su copia');
  assert.match(leer('lib/mako-turno-app-reglas.ts'), /audio\?: \{ url: string; secs: number \};/);
});

test('15. el chat «Onboarding» sale del historial (con sus audios), no del estado de hoy', () => {
  const srv = leer('lib/onboarding-arranque-server.ts');
  const f = srv.slice(srv.indexOf('async function mensajesParaElHilo'), srv.indexOf('const primeroDeOffer'));
  assert.match(f, /if \(!\(await hechosConfirmados\(h\)\)\) throw new Error/);
  assert.match(f, /await anotarHistorial\(mensajesDeArranque\(e, h\), \{ primeroDeOffer: primeroDeOffer\(h\) \}\);/);
  assert.match(f, /return mensajesDelHilo\(unirConOffer\(historial, h\.sesion\?\.mensajes \?\? \[\]\), \{ nombre: e\.nombre, telefonoVerificado: e\.telefono === 'verificado' \}\);/);
  assert.doesNotMatch(f, /\.\.\.antes|\.\.\.despues/, 'sin armarlo otra vez del estado');
  assert.match(srv, /bloques: m\.audio && previo\.sesionId \? \[bloqueDeAudio\(previo\.sesionId, m\.audio\.mensaje, m\.audio\.secs\)\] : null,/);
  assert.match(srv, /if \(error && conAudio\) \{/, 'sin la columna, el texto se copia igual');
  assert.match(leer('lib/mako-turno-app.ts'), /\.\.\.\(audio \? \{ audio: \{ url: urlAudio\(audio\.sesion, audio\.mensaje\), secs: audio\.secs \} \} : \{\}\),/);
});

test('16. el script de reconstrucción: en seco por defecto, y no toca un historial que ya existe', () => {
  const s = leer('scripts/reconstruir-historial-onboarding.mts');
  assert.match(s, /const APLICAR = process\.argv\.includes\('--aplicar'\);/);
  assert.match(s, /const previo = leerHistorial\(raw, \{ estricto: true \}\);/);
  assert.match(s, /if \(previo\.length\) return fila\(`ya tiene historial/);
  assert.match(s, /if \(!\(await hechosConfirmados\(h\)\)\) return fila/);
  assert.match(s, /if \(!APLICAR\) return fila\('se reconstruiría'/);
  assert.match(s, /reconstruido: true \}\);/);
  assert.match(s, /cambiarSettingSi\(CLAVE_HISTORIAL, raw, JSON\.stringify\(\{ mensajes: nuevo \}\)\)/);
});

// ROTURAS (22/10/2026, con tests/second-brain-offer.test.ts; base 23/0, una por vez y restaurada, arnés romper.mjs):
//   · dedupe por id sin el texto → 22/1 (1) · lo de antes de Offer con la hora de ahora → 21/2 (2, 9)
//   · leer sin `estricto` (escribir borra lo que no entiende) → 21/2 (3, 8) · Offer antes que el historial → 20/3 (4, 9, 10)
//   · en vivo, la respuesta sacada de lo dibujado (se pierde el toque) → 22/1 (4) · la pregunta que vuelve no se anota → 21/2 (4, 5)
//   · a mitad el día del deploy, sin marcar reconstruido → 22/1 (6) · en vivo nunca marca reconstruido → 22/1 (6)
//   · sin congelar con el cierre → 22/1 (4) · una tanda que no entra entera en el tope → 22/1 (7)
//   · en el cierre, la última pregunta (ya contestada) como abierta → 22/1 (4) · el mismo toque dos veces → 22/1 (4b)
//   · el doble toque mirando sólo los dos últimos (el cruzado pasa) → 16/1 (4b) · mirando la PRIMERA vez de la pregunta
//     (bloquea la que se volvió a hacer) → 16/1 (4b)
//   · `loQueContesto` con el índice crudo → 21/2 (4, 5)
//   · el adjunto sin texto se tira → 22/1 (11) · el audio sin texto deja la burbuja vacía → 22/1 (11)
//   · el aviso «Reconstruido» para cualquiera: en la regla → 22/1 (11) · en el índice → 22/1 (14)
//   · la ruta no anota lo que dice MaKo → 22/1 (13) · ni lo que mandó la persona → 22/1 (13)
//   · confirmar los hechos DESPUÉS de escribir (la respuesta que cierra la fase no se anotaba) → 22/1 (13)
//   · un POST viejo con todo terminado anota → 22/1 (13) · ya verificado, el código sin su respuesta → 22/1 (13)
//   · anotar con el estado tolerante → 22/1 (13) · confirmar los hechos sin mirar la fase → 22/1 (13)
//   · el historial pegado a CUALQUIER conversación → 22/1 (14) · el chat «Onboarding» sin el historial → 22/1 (15)
//   · audio: el Ops Center lo tira → 22/1 (11) · el índice pasa el mensaje guardado, con su path → 22/1 (14)
//     · la copia no lo guarda → 22/1 (12) · el bloque sin validar el id → 22/1 (12) · el insert sin `bloques` → 22/1 (15)
//     · la lectura del chat no lo da → 22/1 (15)
//   · el título «Onboarding» también para quien tiene su copia → 22/1 (14) · el script encima de un historial → 22/1 (16)
