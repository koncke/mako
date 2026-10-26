// =============================================================================
// «Editar con IA» conoce los botones de un DM de Instagram (25/10/2026)
// =============================================================================
// El Cerebro (25/10, con lo de Leandro): «Probar, Editar con IA y la ficha no conocen el toque. Ciérralo». Hasta acá el modelo
// de editar no veía los botones (`aIA`), y no había cómo cambiarlos. Fija:
//   · el modelo los LEE: cada DM con sus botones, su id, a qué tarjeta sigue o qué link abre;
//   · cambiar el texto de un mensaje NO le saca los botones (el parche sólo cambia lo que nombra);
//   · "botones" en "cambiar" es la lista NUEVA entera: un «sigue» a una tarjeta que está, un «link» guardado o el que ya tenía
//     (uno inventado se saca con su porqué), y un botón que ya estaba conserva su id (lo que cuelga de él sigue colgado);
//   · si el mensaje pasa a WhatsApp, los botones se van (con su porqué);
//   · una tarjeta nueva se cuelga de un botón con "salida": "btn:<id>";
//   · lo que se le dice al modelo va SÓLO si el flujo o el pedido son de las redes (el techo de Groq).
// Correr: node --import tsx --test tests/editar-ia-botones.test.ts
// ROTURAS (25/10/2026, una por vez y restaurada; base 6 / 0): `aIA` sin los botones → 5 / 1; el parche sin "botones" → 5 / 1;
// un link inventado aceptado → 5 / 1; los botones que quedan al pasar a WhatsApp → 5 / 1; BOTONES_AL_EDITAR en un flujo de
// WhatsApp → 5 / 1; el botón cambiado sin su id de antes → 5 / 1. (La del id, en la primera versión, salió VERDE: en el mismo lugar
// el id coincide igual. Se le sumó el caso reordenado, que además mostró un bug: el nuevo tomaba «b1» y el de antes se renombraba.)
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deIA, deIAEdicion, aIA, userDeEditar, disparadoresParaIA, BOTONES_AL_EDITAR, LISTA_BLANCA_IA, type CtxIA, type PasoIA } from '../lib/flujo-ia';
import { opcionesCronIA } from '../lib/disparadores';
import { catalogosDe, etapasDeCondicion } from '../lib/condiciones-catalogos';
import { claseDe, puertosDe, indicePorId, type PasoGrafo } from '../lib/flujo-grafo';
import { botonesDe } from '../lib/botones-social';
import { porId } from '../lib/api-mako/registro';

const acciones = LISTA_BLANCA_IA.map((id) => { const d = porId(id)!; return { id: d.id, titulo: d.titulo, parametros: d.parametros }; });
const PRODUCTOS = [{ funnelId: 2, productoId: 10, nombre: 'Fiesta Music', esDefault: true, etapas: [{ value: 'nuevo', label: 'Lead entrante' }], etapasEntrega: [{ value: 'onboarding', label: 'Onboarding' }] }];
const ctx = (pedido: string): CtxIA => ({
  etiquetas: [], productos: PRODUCTOS,
  disparadores: disparadoresParaIA(opcionesCronIA({ productos: PRODUCTOS, etiquetas: [], conectados: { instagram: true, messenger: true, email: false, pagos: false } })),
  audios: [], archivos: [], acciones,
  links: { recurso: { url: 'https://fiesta.example/recurso', para: 'El recurso gratis' }, clase: { url: 'https://fiesta.example/clase', para: 'La clase' } },
  catalogoCondicion: catalogosDe({ etapas: etapasDeCondicion(PRODUCTOS), productos: PRODUCTOS, remotos: null }),
  pedido, perfil: 'Fiesta Music: clases de DJ.',
});
const rnd = () => { let k = 0; return () => ((k++ * 0.137) % 1); };
const mensajes = (pasos: readonly PasoGrafo[]) => pasos.filter((p) => claseDe(p) === 'mensaje') as PasoIA[];

/** El gate de seguidor armado por «Crear» (tests/crear-ia-botones.test.ts): la base que se edita. */
function gate(): PasoGrafo[] {
  const c = ctx('Por Instagram: quien comenta pruebafm recibe el recurso, pero sólo si nos sigue');
  const d = `d${c.disparadores.findIndex((x) => x.value === 'instagram:comentario') + 1}`;
  return deIA({ disparador: d, inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'mensaje', canal: 'instagram', texto: '¡Ey! Te dejo el recurso:', botones: [{ titulo: 'Obtener recurso', sigue: 't2' }] },
    { id: 't2', tipo: 'condicion', ramas: [{ si: [{ campo: 'sigue_instagram' }], sigue: 't3' }], si_no: 't4' },
    { id: 't3', tipo: 'mensaje', canal: 'instagram', texto: '¡Aquí está!', link: 'recurso' },
    { id: 't4', tipo: 'mensaje', canal: 'instagram', texto: 'Síguenos y toca el botón.', botones: [{ titulo: 'Ya te sigo', sigue: 't2' }] },
  ] }, c, rnd()).pasos;
}

test('el modelo LEE los botones: su id, a qué tarjeta siguen o qué link abren', () => {
  const base = gate();
  const [m1] = mensajes(base);
  const cond = base.find((p) => claseDe(p) === 'condicion')!;
  const t = aIA(base).tarjetas.find((x) => x.id === m1.id)!;
  assert.deepEqual(t.botones, [{ id: 'b1', titulo: 'Obtener recurso', sigue: cond.id }]);
  const conLink = [...base.map((p) => (p.id === m1.id ? { ...p, botones: [{ id: 'b1', titulo: 'Ver', url: 'https://fiesta.example/clase' }] } : p))];
  assert.deepEqual(aIA(conLink).tarjetas.find((x) => x.id === m1.id)!.botones, [{ id: 'b1', titulo: 'Ver', link: 'https://fiesta.example/clase' }]);
});

test('cambiar el texto de un mensaje NO le saca los botones', () => {
  const base = gate();
  const [m1] = mensajes(base);
  const r = deIAEdicion({ cambiar: [{ id: m1.id, texto: '¡Hola! Te dejo el recurso:' }] }, base, ctx('cambia el texto del primero'), rnd());
  const nuevo = r.pasos.find((p) => p.id === m1.id)!;
  assert.equal(nuevo.cuerpo, '¡Hola! Te dejo el recurso:');
  assert.deepEqual(botonesDe(nuevo).map((b) => b.titulo), ['Obtener recurso']);
});

test('"botones" en "cambiar": la lista nueva entera, con su id de antes, links guardados y nada inventado', () => {
  const base = gate();
  const [m1, , noSigue] = mensajes(base);
  const cond = base.find((p) => claseDe(p) === 'condicion')!;
  const r = deIAEdicion({ cambiar: [{ id: m1.id, botones: [
    { titulo: 'Obtener recurso', sigue: cond.id }, { titulo: 'Ver la clase', link: 'clase' }, { titulo: 'Otro', link: 'https://inventado.example' },
  ] }] }, base, ctx('agrégale un botón para ver la clase'), rnd());
  const bs = botonesDe(r.pasos.find((p) => p.id === m1.id));
  assert.deepEqual(bs.map((b) => [b.id, b.titulo, b.siguiente ?? b.url]), [['b1', 'Obtener recurso', cond.id], ['b2', 'Ver la clase', 'https://fiesta.example/clase']]);
  // Reordenados: el de antes CONSERVA su id (lo que cuelga de «btn:b1» sigue colgado) y el nuevo toma uno libre.
  const ro = deIAEdicion({ cambiar: [{ id: m1.id, botones: [{ titulo: 'Ver la clase', link: 'clase' }, { titulo: 'Obtener recurso', sigue: cond.id }] }] }, base, ctx('pon primero el de la clase'), rnd());
  assert.deepEqual(botonesDe(ro.pasos.find((p) => p.id === m1.id)).map((b) => [b.id, b.titulo]), [['b2', 'Ver la clase'], ['b1', 'Obtener recurso']]);
  assert.ok(r.avisos.some((a) => /No tengo guardado el link «https:\/\/inventado\.example»: saqué el botón «Otro»/.test(a)), r.avisos.join(' | '));
  // El de «Ya te sigo», sin tocar.
  assert.deepEqual(botonesDe(r.pasos.find((p) => p.id === noSigue.id)).map((b) => b.siguiente), [cond.id]);
  // Un «sigue» a una tarjeta que no está queda sin conectar, con su porqué.
  const r2 = deIAEdicion({ cambiar: [{ id: m1.id, botones: [{ titulo: 'Obtener recurso', sigue: 'zzz' }] }] }, base, ctx('cambia el botón'), rnd());
  assert.equal(botonesDe(r2.pasos.find((p) => p.id === m1.id))[0].siguiente, null);
  assert.ok(r2.avisos.some((a) => /iba a una tarjeta que no está/.test(a)), r2.avisos.join(' | '));
});

test('si el mensaje pasa a WhatsApp, los botones se van con su porqué', () => {
  const base = gate();
  const [m1] = mensajes(base);
  const r = deIAEdicion({ cambiar: [{ id: m1.id, canal: 'whatsapp' }] }, base, ctx('mándalo por WhatsApp'), rnd());
  assert.equal(botonesDe(r.pasos.find((p) => p.id === m1.id)).length, 0);
  assert.ok(r.avisos.includes('Los botones son de Instagram y Messenger: los saqué'), r.avisos.join(' | '));
});

test('una tarjeta nueva se cuelga de un botón con "salida": "btn:<id>"', () => {
  const base = gate().map((p) => (claseDe(p) === 'mensaje' && botonesDe(p)[0]?.titulo === 'Obtener recurso'
    ? { ...p, botones: [...botonesDe(p), { id: 'b2', titulo: 'Más info', siguiente: null }] } : p));
  const [m1] = mensajes(base);
  const r = deIAEdicion({ agregar: [{ despues_de: m1.id, salida: 'btn:b2', tarjetas: [{ id: 'n1', tipo: 'mensaje', canal: 'instagram', texto: 'Las clases son los sábados.' }] }] },
    base, ctx('cuando toca «Más info», que le cuente cuándo son las clases'), rnd());
  const i = indicePorId(r.pasos, m1.id!);
  const destino = puertosDe(r.pasos, i).find((pt) => pt.puerto === 'btn:b2')?.destino;
  assert.ok(destino, `no colgó del botón: ${r.avisos.join(' | ')}`);
  assert.equal(r.pasos.find((p) => p.id === destino)?.cuerpo, 'Las clases son los sábados.');
});

test('lo que se le dice al modelo de los botones va sólo si el flujo los tiene o el pedido habla de ellos', () => {
  const c = ctx('cambia el texto');
  const datos = (pedido: string) => ({ perfil: 'Fiesta Music', voz: null, pedido });
  assert.ok(userDeEditar(c, datos('cambia el texto'), gate()).includes(BOTONES_AL_EDITAR), 'el flujo tiene botones');
  const sinBotones = gate().map((p) => (claseDe(p) === 'mensaje' ? { ...p, botones: undefined } : p));
  assert.ok(!userDeEditar(c, datos('Cambia WhatsApp por Instagram'), sinBotones).includes(BOTONES_AL_EDITAR), 'paga los tokens sin hablar de botones (el techo de Groq)');
  assert.ok(userDeEditar(c, datos('agrégale un botón «Quiero info»'), sinBotones).includes(BOTONES_AL_EDITAR));
  assert.ok(userDeEditar(c, datos('que sólo le llegue el link si nos sigue'), sinBotones).includes(BOTONES_AL_EDITAR), 'el gate de seguidor');
});
