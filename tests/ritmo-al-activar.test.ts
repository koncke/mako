// =============================================================================
// Lo que se dice al ACTIVAR: cuántos y a qué ritmo (Martín, 25/10/2026; lib/ritmo-al-activar.ts)
// =============================================================================
// «como está muy escondido el "goteo" se manden muchos mensajes de una». Fija el texto con los números del motor y que las cuatro
// puertas de activar (el interruptor, el «⋯», el teléfono y MaKo) lo digan antes de prender.
//
// Correr: node --import tsx --test tests/ritmo-al-activar.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avisoDeRitmo, avisoDeUnaPrendida, canalDelPrimerMensaje, naceConHorario, porAprobarDelFlujo, resumirViejos, clasificarBorradores, seFrenaAlEntrar, seFrenaDesde, seFrenaPorBorradores, textoEnteroDelAviso, BORRADOR_VIEJO_DIAS, type FilaBorrador } from '../lib/ritmo-al-activar';
import { dejaBorradores } from '../lib/mensajes-por-aprobar';
import type { PasoGrafo } from '../lib/flujo-grafo';
import type { HorarioEnvio } from '../lib/horario-envio';
import { crearDesdePlantilla, type DbPlantilla } from '../lib/plantilla-crear';
import { configParaGuardar } from '../lib/config-automatizacion';

const leer = (p: string): string => readFileSync(join(__dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const TOPES = { wa: { dia: 40, hora: 6 }, email: { dia: 100 } };
const base = { canal: 'whatsapp' as const, topes: TOPES };
const PRIMERO = { cuantos: 1, mensajes: 1, elPrimero: true };
const msj = (id: string, siguiente?: string, extra: Record<string, unknown> = {}) => ({ id, canal: 'whatsapp', tipo: 'texto', cuerpo: id, ...(siguiente ? { siguiente } : {}), ...extra });
const ia = (id: string, siguiente?: string, extra: Record<string, unknown> = {}) => msj(id, siguiente, { tipo: 'ia', ...extra });
const flujo = (...p: unknown[]) => p as unknown as PasoGrafo[];

test('sin goteo, WhatsApp: no son «200 de una», es el tope de la línea, y se dice con todas las letras', () => {
  const a = avisoDeRitmo({ ...base, personas: 200, goteo: null })!;
  assert.equal(a.sinGoteo, true);
  assert.equal(a.texto, 'Entran 200 personas y no tiene goteo: los mensajes de WhatsApp salen juntos, hasta 6 por hora y 40 por día (el tope de tu línea). Tarda al menos 4 días.');
});

test('sin goteo, pocos: entran en una tanda y salen todos juntos', () => {
  assert.equal(avisoDeRitmo({ ...base, personas: 5, goteo: null })!.texto, 'Entran 5 personas y no tiene goteo: los 5 mensajes de WhatsApp salen todos juntos.');
});

test('sin goteo, Instagram no tiene tope de línea: todos juntos, aunque sean 500', () => {
  const a = avisoDeRitmo({ ...base, canal: 'instagram', personas: 500, goteo: null })!;
  assert.equal(a.texto, 'Entran 500 personas y no tiene goteo: los 500 mensajes de Instagram salen todos juntos.');
});

test('sin goteo, email: sólo su tope por día', () => {
  const a = avisoDeRitmo({ ...base, canal: 'email', personas: 250, goteo: null })!;
  assert.match(a.texto, /salen juntos, hasta 100 por día \(el tope de tu línea\)\. Tarda al menos 2 días\.$/);
});

test('con goteo: uno cada N min, y los topes que frenan a estos', () => {
  const a = avisoDeRitmo({ ...base, personas: 200, goteo: { minutos: 5 } })!;
  assert.equal(a.sinGoteo, false);
  assert.equal(a.texto, 'Entran 200 personas. El primer mensaje sale por WhatsApp: uno cada 5 min, hasta 6 por hora y 40 por día. Tarda al menos 4 días.');
  // 11 min es menos que 6 por hora: la línea no frena, y 10 personas no llegan al tope del día.
  assert.equal(avisoDeRitmo({ ...base, personas: 10, goteo: { minutos: 11 } })!.texto, 'Entran 10 personas. El primer mensaje sale por WhatsApp: uno cada 11 min. Tarda al menos 1 hora.');
  // Su tope por día manda sobre el de la línea.
  assert.match(avisoDeRitmo({ ...base, personas: 100, goteo: { minutos: 11, dia: 20 } })!.texto, /hasta 20 por día\. Tarda al menos 4 días\.$/);
  // El piso: dos personas con goteo son los minutos que hay entre las dos.
  assert.match(avisoDeRitmo({ ...base, personas: 2, goteo: { minutos: 5 } })!.texto, /Tarda al menos 5 min\.$/);
});

test('sólo tope por día, sin minutos: no espacia, así que sigue siendo «no tiene goteo»', () => {
  const a = avisoDeRitmo({ ...base, personas: 100, goteo: { dia: 20 } })!;
  assert.equal(a.sinGoteo, true);
  assert.match(a.texto, /salen juntos, hasta 6 por hora y 20 por día\. Tarda al menos 4 días\.$/);
});

test('sin nada que decir: una persona, nadie, o una sin mensajes; no se pudo contar: sin goteo se dice igual', () => {
  assert.equal(avisoDeRitmo({ ...base, personas: 1, goteo: null }), null);
  assert.equal(avisoDeRitmo({ ...base, personas: 0, goteo: null }), null);
  assert.equal(avisoDeRitmo({ ...base, canal: null, personas: 200, goteo: null }), null);
  assert.equal(avisoDeRitmo({ ...base, personas: null, goteo: { minutos: 5 } }), null);
  assert.match(avisoDeRitmo({ ...base, personas: null, goteo: null })!.texto, /^No pude contar a cuántas personas les llega, y no tiene goteo/);
});

test('dispara por su evento: sin número, y sin goteo lo dice con el canal; con goteo, o sin evento, nada', () => {
  const ev = { ...base, personas: 0, porEvento: true };
  const ig = avisoDeRitmo({ ...ev, canal: 'instagram', goteo: null })!;
  assert.equal(ig.sinGoteo, true);
  assert.equal(ig.texto, 'No tiene goteo: cuando muchos la disparen, los mensajes de Instagram salen todos juntos.');
  assert.equal(avisoDeRitmo({ ...ev, goteo: null })!.texto, 'No tiene goteo: cuando muchos la disparen, los mensajes de WhatsApp salen juntos, hasta 6 por hora y 40 por día (el tope de tu línea).');
  assert.equal(avisoDeRitmo({ ...ev, canal: 'instagram', goteo: { dia: 20 } })!.texto, 'No tiene goteo: cuando muchos la disparen, los mensajes de Instagram salen juntos, hasta 20 por día.');
  assert.equal(avisoDeRitmo({ ...ev, canal: 'instagram', goteo: { minutos: 5 } }), null);
  assert.equal(avisoDeRitmo({ ...base, canal: 'instagram', personas: 0, goteo: null }), null, 'sin evento y sin nadie, no sale nada');
  // Con gente en el barrido además del evento, manda el número.
  assert.match(avisoDeRitmo({ ...ev, personas: 30, canal: 'instagram', goteo: null })!.texto, /^Entran 30 personas/);
});

test('el primer mensaje queda para aprobar: nunca dice «sale», ni «salen juntos»', () => {
  const a = avisoDeRitmo({ ...base, personas: 200, goteo: null, porAprobar: PRIMERO })!;
  assert.equal(a.texto, 'Entran 200 personas. El primer mensaje de WhatsApp no sale solo: quedan hasta 200 en Borradores para que los apruebes (a quien ya pagó le sale directo). No tiene goteo.');
  assert.equal(a.sinGoteo, true);
  assert.match(avisoDeRitmo({ ...base, personas: 200, goteo: { minutos: 5 }, porAprobar: PRIMERO })!.texto, /Queda uno cada 5 min\.$/);
  // Sin a quién contar: no advierte de un envío en masa que no va a pasar, pero que no sale solo se dice igual.
  const SIN_NUMERO = 'El primer mensaje de WhatsApp no sale solo: queda en Borradores para que lo apruebes (a quien ya pagó le sale directo).';
  assert.equal(avisoDeRitmo({ ...base, personas: 0, goteo: null, porEvento: true, porAprobar: PRIMERO })!.texto, SIN_NUMERO);
  assert.equal(avisoDeRitmo({ ...base, personas: null, goteo: null, porAprobar: PRIMERO })!.texto, SIN_NUMERO);
  assert.equal(avisoDeRitmo({ ...base, personas: 0, goteo: null, porAprobar: PRIMERO })!.poner, null, 'lo de aprobar no se arregla con Configuraciones');
});

// ⚠️ A1 (30/10/2026): el aviso miraba sólo el primero. Un mensaje de IA más adentro quedaba esperando sin que nadie lo dijera.
test('lo que queda para aprobar se cuenta en TODO el flujo, con la regla de `dejaBorradores`', () => {
  // El primero sale, el de IA está más adentro: es el caso que se escapaba.
  assert.deepEqual(porAprobarDelFlujo(flujo(msj('a', 'b'), ia('b', 'c'), msj('c')), false), { cuantos: 1, mensajes: 3, elPrimero: false });
  assert.deepEqual(porAprobarDelFlujo(flujo(msj('a', 'b'), ia('b', 'c'), ia('c')), false), { cuantos: 2, mensajes: 3, elPrimero: false });
  assert.deepEqual(porAprobarDelFlujo(flujo(ia('a', 'b'), msj('b')), false), { cuantos: 1, mensajes: 2, elPrimero: true });
  assert.deepEqual(porAprobarDelFlujo(flujo(ia('a', 'b'), ia('b')), false), { cuantos: 2, mensajes: 2, elPrimero: true });
  // Atrás de una condición sigue siendo el primero que le sale.
  const cond = (si: string, no: string) => ({ id: 'c', nodo: 'condicion', ramas: [{ id: 'r', condiciones: [], siguiente: si }], si_no: no });
  assert.equal(porAprobarDelFlujo(flujo(cond('a', 'a'), ia('a')), false)?.elPrimero, true);
  // ⚠️ Con ramas, cada una tiene su primero: si en una queda y en la otra sale, ni «el primero» ni «más adelante» son ciertos, para cualquier orden.
  assert.deepEqual(porAprobarDelFlujo(flujo(cond('a', 'b'), ia('a'), msj('b')), false), { cuantos: 1, mensajes: 2, elPrimero: false, mezcla: true });
  assert.deepEqual(porAprobarDelFlujo(flujo(cond('b', 'a'), ia('a'), msj('b')), false), { cuantos: 1, mensajes: 2, elPrimero: false, mezcla: true });
  assert.equal(porAprobarDelFlujo(flujo(cond('a', 'b'), ia('a'), ia('b')), false)?.elPrimero, true);
  // Sale solo, o nada que aprobar: no se dice nada.
  assert.equal(porAprobarDelFlujo(flujo(msj('a', 'b'), msj('b')), false), null);
  assert.equal(porAprobarDelFlujo(flujo(msj('a', 'b'), ia('b')), true), null, 'la automatización sale sola');
  assert.equal(porAprobarDelFlujo(flujo(msj('a', 'b'), ia('b', undefined, { revisar: false })), false), null, 'ese mensaje sale solo');
  assert.equal(porAprobarDelFlujo(flujo(msj('a', 'b'), ia('b', undefined, { revisar: true })), true)?.cuantos, 1, 'ese mensaje pide revisión aunque la automatización salga sola');
  // ⚠️ SÓLO WHATSAPP: Instagram y Messenger no tienen bandeja y salen igual (`procesarEnvios`), el email tampoco pasa por ahí.
  for (const canal of ['instagram', 'messenger', 'email']) assert.equal(porAprobarDelFlujo(flujo(ia('a', undefined, { canal })), false), null, canal);
  // Las dos preguntas, siempre de acuerdo: es LA MISMA regla.
  for (const p of [flujo(msj('a', 'b'), ia('b')), flujo(msj('a')), flujo(ia('a', undefined, { canal: 'instagram' }))]) {
    assert.equal(porAprobarDelFlujo(p, false) != null, dejaBorradores(p, false));
  }
});

test('las respuestas de «Si responde» no cuentan: ni para aprobar, ni en el total', () => {
  const p = flujo(msj('a', 'r'), { id: 'r', nodo: 'respuesta', canal: 'whatsapp', casos: [{ id: 'c', titulo: 'Sí', cuando: '', siguiente: 'b' }] }, ia('b'));
  assert.equal(dejaBorradores(p, false), false, 'el arnés no armó una rama de respuesta');
  assert.equal(porAprobarDelFlujo(p, false), null);
  const q = flujo(msj('a', 'x'), ia('x', 'r'), { id: 'r', nodo: 'respuesta', canal: 'whatsapp', casos: [{ id: 'c', titulo: 'Sí', cuando: '', siguiente: 'b' }] }, ia('b'));
  assert.deepEqual(porAprobarDelFlujo(q, false), { cuantos: 1, mensajes: 2, elPrimero: false });
});

test('el texto dice cuántos quedan para aprobar, y si el primero sale, dice también cómo sale', () => {
  const adentro = (cuantos: number, mensajes = 5) => ({ cuantos, mensajes, elPrimero: false });
  // El primero sale y dos más adentro no: el ritmo de siempre, y además los que quedan.
  const a = avisoDeRitmo({ ...base, personas: 200, goteo: { minutos: 5 }, porAprobar: adentro(2), horario: { activo: true, desde: 9, hasta: 21, dias: [0, 1, 2, 3, 4, 5, 6] } as HorarioEnvio })!;
  assert.equal(a.texto, 'Entran 200 personas. El primer mensaje sale por WhatsApp: uno cada 5 min, hasta 6 por hora y 40 por día. Tarda al menos 4 días. Sale de 09:00 a 21:00, todos los días. Más adelante, 2 de sus 5 mensajes no salen solos: quedan hasta 400 en Borradores para que los apruebes (a quien ya pagó le salen directo).');
  assert.equal(a.poner, null);
  // Uno solo.
  assert.match(avisoDeRitmo({ ...base, personas: 200, goteo: { minutos: 5 }, porAprobar: adentro(1) })!.texto, /Más adelante, 1 de sus 5 mensajes no sale solo: quedan hasta 200 en Borradores para que los apruebes \(a quien ya pagó le sale directo\)\.$/);
  // Sin goteo: el primero se va de golpe aunque los de después esperen, y el horario también le falta.
  const b = avisoDeRitmo({ ...base, personas: 200, goteo: null, porAprobar: adentro(1), horario: null })!;
  assert.match(b.texto, /^Entran 200 personas y no tiene goteo: .* Tampoco tiene horario: sale también de noche\. Más adelante, 1 de sus 5/);
  assert.deepEqual([b.poner, b.rotulo], ['Poner goteo y horario', 'Sin goteo ni horario']);
  // ⚠️ SIN NADA MÁS QUE DECIR, ANTES CALLABA: con goteo y horario, por evento, o sin nadie todavía.
  const H = { activo: true, desde: 9, hasta: 21, dias: [0, 1, 2, 3, 4, 5, 6] } as HorarioEnvio;
  const SOLO = 'Más adelante, 2 de sus 5 mensajes no salen solos: quedan en Borradores para que los apruebes (a quien ya pagó le salen directo).';
  assert.equal(avisoDeRitmo({ ...base, personas: 0, goteo: { minutos: 5 }, porEvento: true, porAprobar: adentro(2), horario: H })!.texto, SOLO);
  assert.equal(avisoDeRitmo({ ...base, personas: 0, goteo: { minutos: 5 }, porAprobar: adentro(2) })!.texto, SOLO);
  assert.equal(avisoDeRitmo({ ...base, personas: 1, goteo: { minutos: 5 }, porAprobar: adentro(2) })!.texto, SOLO);
  assert.equal(avisoDeRitmo({ ...base, personas: null, goteo: { minutos: 5 }, porAprobar: adentro(2) })!.texto, SOLO);
  // Varios y el primero es uno de ellos.
  assert.match(avisoDeRitmo({ ...base, personas: 50, goteo: null, porAprobar: { cuantos: 3, mensajes: 5, elPrimero: true } })!.texto, /^Entran 50 personas\. 3 de sus 5 mensajes, empezando por el primero, no salen solos: quedan hasta 150 en Borradores para que los apruebes \(a quien ya pagó le salen directo\)\. No tiene goteo\.$/);
  // Todos.
  assert.match(avisoDeRitmo({ ...base, personas: 50, goteo: null, porAprobar: { cuantos: 3, mensajes: 3, elPrimero: true } })!.texto, /Sus 3 mensajes no salen solos: quedan hasta 150/);
  // Con ramas mezcladas, sin afirmar dónde está, y el ritmo se dice porque el otro camino sale.
  const mezcla = avisoDeRitmo({ ...base, personas: 50, goteo: { minutos: 5 }, porAprobar: { cuantos: 1, mensajes: 2, elPrimero: false, mezcla: true } })!.texto;
  assert.match(mezcla, /^Entran 50 personas\. El primer mensaje sale por WhatsApp: .* 1 de sus 2 mensajes no sale solo: quedan hasta 50/);
  assert.doesNotMatch(mezcla, /Más adelante/);
  // El número cuenta también a los que ya están adentro: una pausada que se prende les escribe a ellos.
  assert.match(avisoDeRitmo({ ...base, personas: 2, adentro: 33, goteo: { minutos: 5 }, porAprobar: adentro(1) })!.texto, /quedan hasta 35 en Borradores/);
  assert.match(avisoDeRitmo({ ...base, personas: 0, adentro: 33, goteo: { minutos: 5 }, porAprobar: adentro(2) })!.texto, /quedan hasta 66 en Borradores/);
  // ⚠️ El primero queda y otros salen solos: el horario se dice igual (la queja de Leila). Sólo calla si TODOS quedan.
  const unoDeTres = avisoDeRitmo({ ...base, personas: 200, goteo: { minutos: 5 }, horario: null, porAprobar: { cuantos: 1, mensajes: 3, elPrimero: true } })!;
  assert.match(unoDeTres.texto, /No tiene horario: sale también de noche\.$/);
  assert.deepEqual([unoDeTres.poner, unoDeTres.rotulo], ['Poner horario', 'Sin horario']);
  assert.doesNotMatch(avisoDeRitmo({ ...base, personas: 200, goteo: { minutos: 5 }, horario: null, porAprobar: { cuantos: 3, mensajes: 3, elPrimero: true } })!.texto, /horario/);
  // Ninguno: el texto de siempre, sin una coma de más.
  assert.equal(avisoDeRitmo({ ...base, personas: 5, goteo: null, porAprobar: null })!.texto, 'Entran 5 personas y no tiene goteo: los 5 mensajes de WhatsApp salen todos juntos.');
});

test('una ya prendida: lo que queda para aprobar va en la misma frase, y no la marca por sí solo', () => {
  const de = { triggers: ['instagram'], envioAutomatico: false, topes: TOPES };
  const conIa = flujo(msj('a', 'b'), ia('b'));
  const a = avisoDeUnaPrendida({ ...de, pasos: conIa, goteo: null })!;
  assert.match(a.texto, /^No tiene goteo: .* Más adelante, 1 de sus 2 mensajes no sale solo: queda en Borradores/);
  assert.equal(a.poner, 'Poner goteo');
  // Con goteo y horario no hay ⚠: la línea de la automatización ya cuenta los que esperan (`textoPorAprobar`).
  assert.equal(avisoDeUnaPrendida({ ...de, pasos: conIa, goteo: { minutos: 5 } }), null);
  // Una que sólo contesta (sus mensajes son los de «Si responde»): no hay un envío en masa que advertir.
  const soloContesta = flujo({ id: 'r', nodo: 'respuesta', canal: 'whatsapp', casos: [{ id: 'c', titulo: 'Sí', cuando: '', siguiente: 'b' }] }, msj('b'));
  assert.equal(avisoDeUnaPrendida({ ...de, pasos: soloContesta, goteo: null }), null);
});

test('el horario: entre qué horas sale; sin horario, con todas las letras y con el botón para ponerlo', () => {
  const H = { activo: true, desde: 9, hasta: 21, dias: [0, 1, 2, 3, 4, 5, 6] } as HorarioEnvio;
  // Tiene: dice entre qué horas, y no pide nada si también tiene goteo.
  const con = avisoDeRitmo({ ...base, personas: 200, goteo: { minutos: 5 }, horario: H })!;
  assert.match(con.texto, /Tarda al menos 4 días\. Sale de 09:00 a 21:00, todos los días\.$/);
  assert.deepEqual([con.poner, con.rotulo], [null, null]);
  // Sin los dos.
  const nada = avisoDeRitmo({ ...base, personas: 200, goteo: null, horario: null })!;
  assert.match(nada.texto, /Tarda al menos 4 días\. Tampoco tiene horario: sale también de noche\.$/);
  assert.deepEqual([nada.poner, nada.rotulo], ['Poner goteo y horario', 'Sin goteo ni horario']);
  // Sin goteo, con horario.
  const sg = avisoDeRitmo({ ...base, personas: 200, goteo: null, horario: H })!;
  assert.match(sg.texto, /Sale de 09:00 a 21:00, todos los días\.$/);
  assert.deepEqual([sg.poner, sg.rotulo], ['Poner goteo', 'Sin goteo']);
  // Con goteo, sin horario: es lo que le pasó a Leila.
  const sh = avisoDeRitmo({ ...base, personas: 200, goteo: { minutos: 5 }, horario: null })!;
  assert.match(sh.texto, /Tarda al menos 4 días\. No tiene horario: sale también de noche\.$/);
  assert.deepEqual([sh.poner, sh.rotulo], ['Poner horario', 'Sin horario']);
  // Por evento: con goteo y sin horario también se dice; sin goteo, las dos cosas.
  assert.equal(avisoDeRitmo({ ...base, canal: 'instagram', personas: 0, goteo: { minutos: 5 }, porEvento: true, horario: null })!.texto, 'No tiene horario: sale también de noche.');
  assert.match(avisoDeRitmo({ ...base, canal: 'instagram', personas: 0, goteo: null, porEvento: true, horario: null })!.texto, /salen todos juntos\. Tampoco tiene horario: sale también de noche\.$/);
  // No se pudo leer: no afirma nada. Queda para aprobar: no sale de noche. Sin nada que avisar, no inventa.
  assert.doesNotMatch(avisoDeRitmo({ ...base, personas: 200, goteo: null })!.texto, /horario|Sale de/);
  assert.equal(avisoDeRitmo({ ...base, personas: 200, goteo: null }) !.sinHorario, false);
  assert.doesNotMatch(avisoDeRitmo({ ...base, personas: 200, goteo: null, porAprobar: PRIMERO, horario: null })!.texto, /horario/);
  assert.equal(avisoDeRitmo({ ...base, personas: 1, goteo: { minutos: 5 }, horario: null }), null);
  assert.equal(avisoDeRitmo({ ...base, personas: 0, goteo: { minutos: 5 }, porEvento: true, horario: H }), null);
  assert.equal(avisoDeRitmo({ ...base, canal: null, personas: 0, goteo: null, porEvento: true, horario: null }), null);
});

test('el horario de fábrica: sólo las que nacen de ahora en más, y nunca lo que contesta al momento', () => {
  const nueva = { creadaAt: '2026-11-02T10:00:00Z', triggers: ['etapa_actual'], horarioPropio: undefined, delNegocio: null };
  assert.equal(naceConHorario(nueva), true);
  // ⚠️ LAS QUE YA EXISTÍAN NO SE TOCAN, y sin saber cuándo nació, tampoco.
  assert.equal(naceConHorario({ ...nueva, creadaAt: '2026-10-26T15:01:00Z' }), false);
  assert.equal(naceConHorario({ ...nueva, creadaAt: null }), false);
  // Lo que eligió la persona o el negocio manda; también un horario apagado a propósito.
  assert.equal(naceConHorario({ ...nueva, horarioPropio: { activo: false } }), false);
  assert.equal(naceConHorario({ ...nueva, horarioPropio: null }), false);
  assert.equal(naceConHorario({ ...nueva, delNegocio: { activo: true } }), false);
  // Lo que contesta a algo que acaba de hacer la persona no espera a las 9, ni si es uno entre varios CRON.
  for (const t of ['instagram', 'messenger', 'email_recibido']) assert.equal(naceConHorario({ ...nueva, triggers: [t] }), false, t);
  assert.equal(naceConHorario({ ...nueva, triggers: ['etapa_actual', 'instagram'] }), false);
  // Lo que le escribe al equipo o lo manda otro motor, tampoco. Sin CRON no hay nada que decidir.
  for (const t of ['aviso_mako', 'reunion_recordatorio', 'grupo_mako']) assert.equal(naceConHorario({ ...nueva, triggers: [t] }), false, t);
  assert.equal(naceConHorario({ ...nueva, triggers: [] }), false);
  // El cableado: antes de prender, en la única puerta; no poder ponerlo no frena; y el aviso dice el mismo horario.
  const n = leer('lib/nutricion.ts');
  const i = n.indexOf('export async function setSecuenciaActiva');
  const puerta = n.slice(i, n.indexOf("if (error) throw new Error(`setSecuenciaActiva:", i));
  // Con la marca de fábrica (5/11/2026): así cede ante el horario del negocio (tests/horario-de-fabrica.test.ts).
  assert.match(puerta, /if \(await leTocaHorarioDeFabrica\(id\)\) \{ const r = await guardarConfigAutomatizacion\(id, \{ horario: HORARIO_SUGERIDO, horarioDeFabrica: true \}\);/);
  assert.ok(puerta.indexOf('leTocaHorarioDeFabrica') < puerta.indexOf(".update({ activa,"), 'antes de prenderla: si no, puede salir algo sin horario');
  assert.match(puerta, /no pude ponerle el horario de fábrica/);
  // La difusión la manda la persona a propósito; se reconoce por su clave.
  assert.match(n, /if \(sec\.clave\.startsWith\(PREFIJO_CLAVE_DIFUSION\)\) return false;/);
  assert.match(n, /import \{ PREFIJO_CLAVE_DIFUSION \} from '@\/lib\/difusion-reglas';/);
  assert.match(n, /\(await leTocaHorarioDeFabrica\(secuenciaId\)\.catch\(\(\) => false\)\) \? HORARIO_SUGERIDO : horarioDeLaAutomatizacion\(config, delNegocio\)/);
});

test('«Prospección: apertura» nace con horario y goteo: la plantilla de escribir en frío no sale de noche ni de a 6 juntos', async () => {
  const db = {
    from: () => ({
      select: () => ({ is: async () => ({ data: [], error: null }) }),
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: 900 }, error: null }) }) }),
      delete: () => ({ eq: async () => ({ data: null, error: null }) }),
    }),
  } as unknown as DbPlantilla;
  const puestos: Array<[number, unknown]> = [];
  const deps = { db, setPasos: async () => {}, setDisparadores: async () => {} };
  const r = await crearDesdePlantilla('prospeccion-apertura', { ...deps, setConfig: async (id, c) => { puestos.push([id, c]); return { ok: true }; } });
  assert.equal(r.aviso, null);
  assert.equal(puestos.length, 1);
  assert.equal(puestos[0][0], 900);
  const c = puestos[0][1] as { horario: { activo: boolean; desde: number; hasta: number }; goteo: { minutos: number; dia: number } };
  assert.deepEqual([c.horario.activo, c.horario.desde, c.horario.hasta], [true, 9, 21]);
  assert.deepEqual(c.goteo, { minutos: 10, dia: 30 });
  assert.equal(configParaGuardar({}, c).ok, true, 'lo que trae la plantilla pasa por el mismo saneador que la pantalla');
  // No poder ponerlo se dice, no se calla; y una que no trae ritmo no escribe nada.
  assert.match((await crearDesdePlantilla('prospeccion-apertura', { ...deps, setConfig: async () => ({ ok: false }) })).aviso!, /No pude ponerle horario y goteo/);
  assert.match((await crearDesdePlantilla('prospeccion-apertura', { ...deps, setConfig: async () => { throw new Error('x'); } })).aviso!, /No pude ponerle horario y goteo/);
  assert.match((await crearDesdePlantilla('prospeccion-apertura', deps)).aviso!, /No pude ponerle horario y goteo/, 'un llamador que no lo enchufa no la deja nacer callada');
  const antes = puestos.length;
  await crearDesdePlantilla('lead-agendo', { ...deps, setConfig: async (id, x) => { puestos.push([id, x]); return { ok: true }; } });
  assert.equal(puestos.length, antes);
  assert.match(leer('app/api/chat-agent/secuencias/route.ts'), /setConfig: guardarConfigAutomatizacion,/);
  assert.match(leer('lib/api-mako/areas/chatbot.run.ts'), /setConfig: guardarConfigAutomatizacion,/);
  assert.match(leer('lib/sugerencias-crm-server.ts'), /setConfig: guardarConfigAutomatizacion,/);
});

test('una ya prendida: la misma frase, en su pantalla y en su tarjeta; nunca le toca el goteo', () => {
  const ig = [{ id: 'dm', canal: 'instagram', tipo: 'texto', cuerpo: 'hola' }] as unknown as PasoGrafo[];
  const de = { pasos: ig, triggers: ['instagram'], envioAutomatico: false, topes: TOPES };
  assert.deepEqual(avisoDeUnaPrendida({ ...de, goteo: null }), { texto: 'No tiene goteo: cuando muchos la disparen, los mensajes de Instagram salen todos juntos.', rotulo: 'Sin goteo', poner: 'Poner goteo' });
  assert.deepEqual(avisoDeUnaPrendida({ ...de, goteo: { minutos: 5 }, horario: null }), { texto: 'No tiene horario: sale también de noche.', rotulo: 'Sin horario', poner: 'Poner horario' });
  assert.equal(avisoDeUnaPrendida({ ...de, goteo: null, horario: null })?.rotulo, 'Sin goteo ni horario');
  assert.equal(avisoDeUnaPrendida({ ...de, goteo: { minutos: 5 } }), null, 'con goteo no hay nada que decir');
  assert.equal(avisoDeUnaPrendida({ ...de, triggers: ['aviso_mako'], goteo: null }), null, 'le escribe al equipo, no a leads');
  assert.equal(avisoDeUnaPrendida({ ...de, triggers: ['grupo_mako'], goteo: null }), null);
  assert.equal(avisoDeUnaPrendida({ ...de, pasos: [{ id: 'c', nodo: 'condicion' }] as unknown as PasoGrafo[], goteo: null }), null, 'sin mensajes');
  // El primero de WhatsApp que escribe la IA y no sale solo queda para aprobar: no se va de golpe.
  const wa = [{ id: 'w', canal: 'whatsapp', tipo: 'ia', cuerpo: 'x' }] as unknown as PasoGrafo[];
  assert.equal(avisoDeUnaPrendida({ ...de, pasos: wa, goteo: null }), null);
  assert.match(avisoDeUnaPrendida({ ...de, pasos: wa, envioAutomatico: true, goteo: null })!.texto, /^No tiene goteo/);
  // ⚠️ POR INSTAGRAM NO: no tiene bandeja y el motor lo manda. Este test decía lo contrario, y fijaba el error del aviso.
  const dmIa = [{ id: 'dm', canal: 'instagram', tipo: 'ia', cuerpo: 'x' }] as unknown as PasoGrafo[];
  assert.match(avisoDeUnaPrendida({ ...de, pasos: dmIa, goteo: null })!.texto, /^No tiene goteo/);
});

test('el cableado de las prendidas: se muestra sólo si está prendida, y sin poder leer no afirma nada', () => {
  const n = leer('lib/nutricion.ts');
  assert.match(n, /console\.error\(`\[nutricion\] los avisos de ritmo: \$\{e instanceof Error \? e\.message : String\(e\)\}`\);\n\s+out\.clear\(\);/);
  assert.match(leer('lib/setting-secuencias.ts'), /aviso_ritmo: avisosRitmo\.get\(s\.id\) \?\? null,/);
  const p = leer('app/automations/SecuenciaPerfil.tsx');
  assert.match(p, /const avisoRitmoPrendida = activa && secuencia\.aviso_ritmo && \(/, 'lo ve quien ve la automatización, como en el teléfono');
  assert.match(p, /\{avisoRitmoPrendida\}/);
  assert.match(p, /disabled=\{!rolAdmin \|\| !Configuraciones\}/, 'ponerlo, sólo el admin');
  assert.match(p, /alCerrarConfig\.current = \(\) => \{ if \(secuencia\.aviso_ritmo\) onCambio\(\); \};/, 'al ponerle goteo u horario, el aviso se va');
  assert.match(leer('app/automations/SimuladorWhatsApp.tsx'), /aviso=\{j\.activa \? j\.aviso_ritmo \?\? undefined : undefined\}/);
  const m = leer('app/m/automations/AutomationsM.tsx');
  assert.match(m, /e\.activa && x\.avisoRitmo \? <PildoraM tono="warn">\{x\.avisoRitmo\.rotulo\}<\/PildoraM>/);
  assert.match(m, /\{a\?\.avisoRitmo && v\?\.activa && </);
  // Avisar no es cambiar: nada de esto escribe la configuración de una automatización.
  const f = n.slice(n.indexOf('export async function avisosDeRitmo'), n.indexOf('export async function incluirExistentes'));
  assert.doesNotMatch(f, /guardarConfigAutomatizacion|\.update\(|\.upsert\(|\.insert\(/);
});

// ⚠️ LOS BORRADORES VIEJOS QUE LA VAN A FRENAR (el Cerebro, 30/10/2026). Los números son los de Leila medidos ese día: «Seguimiento a leads que no cierran»
// (pausada, 33 personas adentro) y 26 de ellas con un borrador pendiente del 20/10 de dos automatizaciones, también pausadas.
const AHORA = Date.parse('2026-10-30T22:00:00Z');
const DEL_20 = '2026-10-21T00:00:30Z'; // 20/10 19:00 en Cancún.
const IDS_26 = Array.from({ length: 26 }, (_, i) => i + 1);
const DE_LEILA = { ids: IDS_26, fechas: Array(26).fill(DEL_20), propios: 0, otras: ['Recordatorio clase reactivación', 'Recordatorio martes sesión LíderMente'], personas: 26, zona: 'America/Cancun', ahora: AHORA };

test('los borradores viejos: cuántos, de qué fecha, de dónde, a cuántos frena y QUÉ PASA al descartarlos', () => {
  const v = resumirViejos(DE_LEILA)!;
  const a = avisoDeRitmo({ ...base, personas: 0, goteo: { minutos: 5 }, viejos: v })!;
  assert.equal(a.viejos?.frase, '26 borradores viejos, del 20/10, de 2 automatizaciones, frenan a 26 personas. Si los descartas, esos mensajes no salen y siguen con el próximo. Si los apruebas, salen de hace 10 días.');
  assert.equal(a.texto, '', 'la frase va pegada al botón, no en el texto');
  assert.deepEqual([a.viejos?.boton, a.viejos?.ids], ['Descartar los 26', IDS_26]);
  // Sin nada más que decir, antes callaba.
  assert.equal(avisoDeRitmo({ ...base, personas: 0, goteo: { minutos: 5 }, viejos: null }), null);
  // Se suma a lo demás: un solo cartel. Y donde no hay botón (MaKo, en el chat), todo junto.
  const todo = avisoDeRitmo({ ...base, personas: 200, goteo: null, horario: null, porAprobar: { cuantos: 1, mensajes: 5, elPrimero: false }, viejos: v })!;
  assert.match(todo.texto, /^Entran 200 personas y no tiene goteo: .* Tampoco tiene horario: .* Más adelante, 1 de sus 5 /);
  assert.deepEqual([todo.poner, todo.viejos?.boton], ['Poner goteo y horario', 'Descartar los 26']);
  assert.match(textoEnteroDelAviso(todo), /Más adelante, .* 26 borradores viejos, del 20\/10/);
  assert.equal(textoEnteroDelAviso(avisoDeRitmo({ ...base, personas: 5, goteo: null })!), 'Entran 5 personas y no tiene goteo: los 5 mensajes de WhatsApp salen todos juntos.');
});

test('los borradores viejos: las variantes del texto', () => {
  // La fecha, y los días, en la zona del negocio y de calendario: en Cancún todavía es el 20, en UTC ya es el 21.
  assert.deepEqual([resumirViejos(DE_LEILA)!.fechas, resumirViejos(DE_LEILA)!.dias], ['del 20/10', 'de hace 10 días']);
  assert.deepEqual([resumirViejos({ ...DE_LEILA, zona: 'UTC' })!.fechas, resumirViejos({ ...DE_LEILA, zona: 'UTC' })!.dias], ['del 21/10', 'de hace 9 días']);
  // Uno solo, de una, a una persona.
  const uno = avisoDeRitmo({ ...base, personas: 0, goteo: { minutos: 5 }, viejos: resumirViejos({ ...DE_LEILA, ids: [7], fechas: [DEL_20], otras: ['X'], personas: 1 }) })!;
  assert.equal(uno.viejos?.frase, '1 borrador viejo, del 20/10, de «X», frena a 1 persona. Si lo descartas, ese mensaje no sale y sigue con el próximo. Si lo apruebas, sale de hace 10 días.');
  assert.equal(uno.viejos?.boton, 'Descartar el borrador');
  // Los suyos, sin nadie frenado: no se afirma que frena a alguien.
  const propios = avisoDeRitmo({ ...base, personas: 0, goteo: { minutos: 5 }, viejos: resumirViejos({ ...DE_LEILA, ids: [1, 2], fechas: [DEL_20, DEL_20], propios: 2, otras: [], personas: 0 }) })!;
  assert.match(propios.viejos!.frase, /^2 borradores viejos, del 20\/10, de esta automatización, esperan aprobación\./);
  // Varias fechas: desde cuándo y hasta cuándo, y los días del más nuevo.
  const v = resumirViejos({ ...DE_LEILA, ids: [1, 2], fechas: ['2026-10-25T15:00:00Z', DEL_20], propios: 1, otras: ['A', 'B'], personas: 2 })!;
  assert.deepEqual([v.fechas, v.dias, v.deDonde], ['del 20/10 al 25/10', 'de hace 5 días o más', 'de 3 automatizaciones']);
  // Sin el nombre (la otra ya no existe): nunca «undefined».
  assert.equal(resumirViejos({ ...DE_LEILA, otras: [] })!.deDonde, 'de otra automatización');
  assert.equal(resumirViejos({ ...DE_LEILA, ids: [], fechas: [] }), null);
  // Los que siguen parados por algo que no se ofrece descartar: se dicen, sin botón.
  assert.equal(avisoDeRitmo({ ...base, personas: 0, goteo: { minutos: 5 }, siguenFrenados: 3 })!.texto, '3 personas están paradas por borradores recientes o de otra automatización prendida: se resuelven en Chats › Borradores.');
  assert.equal(avisoDeRitmo({ ...base, personas: 0, goteo: { minutos: 5 }, siguenFrenados: 3 })!.viejos, null);
  assert.equal(avisoDeRitmo({ ...base, personas: 0, goteo: { minutos: 5 }, siguenFrenados: 1, viejos: resumirViejos(DE_LEILA) })!.texto, 'Otra persona está parada por un borrador reciente o de otra automatización prendida: se resuelve en Chats › Borradores.');
});

test('QUÉ BORRADORES SE OFRECE DESCARTAR Y A QUIÉNES FRENAN: la regla del motor, fila por fila', () => {
  const VIEJO = '2026-10-20T21:00:00Z', NUEVO = '2026-10-30T10:00:00Z';
  const f = (id: number, lead_id: number | null, secuencia_id: number | null, created_at = VIEJO): FilaBorrador => ({ id, lead_id, secuencia_id, created_at });
  const filas = [
    f(1, 10, 249), // suyo: siempre
    f(2, 11, 282), // de otra pausada, de alguien que está adentro
    f(3, 12, 900), // ⚠️ de otra PRENDIDA: no se toca, y sigue frenado
    f(4, 13, 282, NUEVO), // reciente: no se ofrece, y sigue frenado
    f(5, 14, 282), // de alguien que no está adentro: no es de esta decisión
    f(6, 15, 282), // ya pagó: no lo frena
    f(7, null, 249), // suyo, de un lead que ya no existe
    f(8, 16, 282), f(9, 16, 282, NUEVO), // el viejo tampoco se ofrece: el reciente lo sigue frenando
    f(10, 17, null), // sin automatización, de alguien que está adentro: no está prendida
  ];
  const base2 = { filas, secuenciaId: 249, corte: Date.parse('2026-10-27T22:00:00Z'), seFrena: true, adentro: new Set([10, 11, 12, 13, 15, 16, 17]), pagaron: new Set([15]), activas: new Set([900]) };
  const c = clasificarBorradores(base2);
  // ⚠️ El 8 no: descartarlo no suelta a su lead, y el mensaje se pierde igual.
  assert.deepEqual(c.descartables.map((x) => x.id), [1, 2, 7, 10]);
  assert.deepEqual(c.liberados.sort(), [10, 11, 17]);
  assert.deepEqual(c.siguenFrenados.sort(), [12, 13, 16]);
  // Una que no se frena (sin ese WhatsApp): sólo los suyos, y no afirma que frena a nadie.
  const s = clasificarBorradores({ ...base2, seFrena: false });
  assert.deepEqual(s.descartables.map((x) => x.id), [1, 7]);
  assert.deepEqual([s.liberados, s.siguenFrenados], [[], []]);
  // El borde del corte: justo en el corte, todavía no es viejo. Y lo de un fin de semana no llega.
  assert.deepEqual(clasificarBorradores({ ...base2, filas: [f(1, 10, 249, '2026-10-27T22:00:00Z')] }).descartables, []);
  assert.ok(BORRADOR_VIEJO_DIAS * 24 > 60);
});

test('⚠️ LO QUE LE QUEDA A CADA UNO, no lo que tiene el flujo: dónde está y por dónde entra', () => {
  const m = (id: string, canal: string, extra: Record<string, unknown> = {}) => msj(id, undefined, { canal, ...extra });
  const wa_email = flujo(m('a', 'whatsapp', { siguiente: 'b' }), m('b', 'email'));
  // Ya está en el último email: un borrador no lo frena, y descartarlo no suelta a nadie. Antes de ese WhatsApp, sí.
  assert.equal(seFrenaDesde(wa_email, 0), true);
  assert.equal(seFrenaDesde(wa_email, 1), false);
  const email_wa = flujo(m('a', 'email', { siguiente: 'b' }), m('b', 'whatsapp'));
  // Arranca por email: el primero le sale igual, y más adelante se frena.
  assert.equal(seFrenaDesde(email_wa, 0), true, 'le queda el WhatsApp');
  assert.equal(seFrenaAlEntrar(email_wa), false, 'el email sale con o sin borrador: sigue en «Entran»');
  assert.equal(seFrenaAlEntrar(wa_email), true);
  assert.equal(seFrenaAlEntrar(flujo(m('a', 'email'))), false);
  assert.equal(seFrenaAlEntrar(flujo({ id: 'e', nodo: 'esperar', espera: { modo: 'antes_reunion', minutos: 60 } })), false, 'sin nada que frene, no se frena');
  // Una acción antes del primer mensaje también espera.
  assert.equal(seFrenaAlEntrar(flujo({ id: 'x', accion: { tipo: 'etapa', etapa: 'y' }, siguiente: 'a' }, m('a', 'email'))), true);
  // Con ramas: si por una sale, se lo sigue contando.
  const ramas = flujo({ id: 'c', nodo: 'condicion', ramas: [{ id: 'r1', siguiente: 'a' }, { id: 'r2', siguiente: 'b' }] }, m('a', 'whatsapp'), m('b', 'email'));
  assert.equal(seFrenaAlEntrar(ramas), false);
});

test('⚠️ LOS QUE YA ESTABAN ADENTRO TAMBIÉN SALEN: se dicen, y falta el goteo aunque no entre nadie', () => {
  const sin = { ...base, personas: 0, goteo: null };
  const a = avisoDeRitmo({ ...sin, adentroVencidos: 27 })!;
  assert.equal(a.texto, '27 personas que ya estaban adentro tienen su próximo mensaje vencido: salen al prenderla, sin goteo.');
  assert.deepEqual([a.sinGoteo, a.poner], [true, 'Poner goteo']);
  // Con goteo, cuál.
  const g = avisoDeRitmo({ ...sin, goteo: { minutos: 5 }, adentroVencidos: 27 })!;
  assert.equal(g.texto, '27 personas que ya estaban adentro tienen su próximo mensaje vencido: salen al prenderla, uno cada 5 min.');
  assert.deepEqual([g.sinGoteo, g.poner], [false, null]);
  // Uno solo no es un ritmo.
  assert.equal(avisoDeRitmo({ ...sin, adentroVencidos: 1 }), null);
  // Los que suelta «Descartar»: se dice ANTES de apretar, con el botón para ponérselo.
  const d = avisoDeRitmo({ ...sin, adentroLiberables: 27, viejos: resumirViejos(DE_LEILA) })!;
  assert.equal(d.texto, 'Si descartas los borradores viejos, a 27 personas les sale su próximo mensaje al prenderla, sin goteo.');
  assert.deepEqual([d.sinGoteo, d.poner], [true, 'Poner goteo']);
  // Se suma a los sueltos.
  assert.match(avisoDeRitmo({ ...sin, adentroVencidos: 1, adentroLiberables: 1 })!.texto, /a 2 personas les sale/);
  // Con goteo no hay nada que advertir de los liberados.
  assert.equal(avisoDeRitmo({ ...sin, goteo: { minutos: 5 }, adentroLiberables: 27 }), null);
  // Falta el horario también: «Tampoco», y dice cuándo sale el que lo tiene.
  assert.match(avisoDeRitmo({ ...sin, adentroVencidos: 3, horario: null })!.texto, /sin goteo\. Tampoco tiene horario: sale también de noche\.$/);
  // Todos para aprobar: no sale nada solo, no se afirma que salen.
  const todos = { cuantos: 2, mensajes: 2, elPrimero: true };
  assert.doesNotMatch(avisoDeRitmo({ ...sin, porAprobar: todos, adentroVencidos: 27 })!.texto, /vencido/);
});

test('sólo acciones: no hay ritmo que decir, pero un borrador la frena igual', () => {
  const sinCanal = { ...base, canal: null, personas: 0, goteo: null, horario: null };
  assert.equal(avisoDeRitmo(sinCanal), null);
  const a = avisoDeRitmo({ ...sinCanal, viejos: resumirViejos(DE_LEILA) })!;
  assert.deepEqual([a.texto, a.sinHorario, a.sinGoteo, a.poner], ['', false, false, null]);
  assert.equal(a.viejos?.boton, 'Descartar los 26');
  assert.match(avisoDeRitmo({ ...sinCanal, siguenFrenados: 2, adentroVencidos: 9 })!.texto, /^2 personas están paradas/);
});

test('¿se frena? Lo que espera en el motor, y lo que no', () => {
  const m = (id: string, canal: string, extra: Record<string, unknown> = {}) => msj(id, undefined, { canal, ...extra });
  assert.equal(seFrenaPorBorradores(flujo(m('a', 'whatsapp'))), true);
  assert.equal(seFrenaPorBorradores(flujo(m('a', 'whatsapp', { proveedor: 'oficial', template_wa: 'x' }))), false, 'el oficial no espera');
  assert.equal(seFrenaPorBorradores(flujo(m('a', 'email'))), false);
  assert.equal(seFrenaPorBorradores(flujo(m('a', 'instagram'))), false);
  // Una acción espera, sea cual sea el canal del flujo.
  assert.equal(seFrenaPorBorradores(flujo(m('a', 'instagram', { siguiente: 'b' }), { id: 'b', accion: { tipo: 'etapa', etapa: 'x' } })), true);
  // El recordatorio antes de la reunión no espera (`!carril`), y «Si responde» tampoco.
  assert.equal(seFrenaPorBorradores(flujo({ id: 'e', nodo: 'esperar', espera: { modo: 'antes_reunion', minutos: 60 }, siguiente: 'm' }, m('m', 'whatsapp'))), false);
  assert.equal(seFrenaPorBorradores(flujo(m('a', 'email', { siguiente: 'r' }), { id: 'r', nodo: 'respuesta', canal: 'whatsapp', casos: [{ id: 'c', titulo: 'Sí', cuando: '', siguiente: 'b' }] }, m('b', 'whatsapp'))), false);
  // Con un recordatorio Y un mensaje de los comunes, sí.
  assert.equal(seFrenaPorBorradores(flujo(m('x', 'whatsapp', { siguiente: 'e' }), { id: 'e', nodo: 'esperar', espera: { modo: 'antes_reunion', minutos: 60 }, siguiente: 'm' }, m('m', 'whatsapp'))), true);
});

test('el cableado de los borradores: la misma regla del motor, ninguna puerta nueva para descartar, y Enter no prende', () => {
  const n = leer('lib/nutricion.ts');
  const f = n.slice(n.indexOf('async function borradoresAlActivar'), n.indexOf('export async function descartarBorradoresViejos'));
  // La regla que frena es `tieneBorradorNutriPendiente`: si cambia allá, esto miente. Sin fecha, y de cualquier automatización.
  assert.match(leer('lib/evolution-envio.ts'), /\.eq\('lead_id', leadId\)\.eq\('origen', 'nutricion'\)\.eq\('estado', 'pendiente'\);/);
  assert.match(f, /\.eq\('origen', 'nutricion'\)\.eq\('estado', 'pendiente'\)\.order\('id'\)\.range\(desde, desde \+ 999\)/, 'PostgREST corta en 1000 sin avisar');
  assert.doesNotMatch(f, /\.lt\('created_at'/, 'el motor no mira la fecha: el corte es sólo para lo que se ofrece descartar');
  // ⚠️ Frena TODO mensaje de WhatsApp no oficial, no sólo los de IA: la guarda del motor va antes de mirar qué tipo es.
  const motor = n.slice(n.indexOf("} else if (waOn && paso.canal === 'whatsapp' && paso.proveedor === 'no_oficial') {"), n.indexOf("} else if (waOn && paso.canal === 'whatsapp') {"));
  assert.match(motor, /if \(!carril && await tieneBorradorNutriPendiente\(insc\.lead_id\) && !\(await esLeadCliente\(insc\.lead_id\)\)\) \{/);
  // Los que están adentro son los que el motor mueve.
  assert.match(n, /\.in\('estado', \['activa', 'respondio'\]\)\s*\.lte\('proximo_envio_at', ahoraISO\(\)\);/);
  assert.match(f, /\.eq\('secuencia_id', sec\.id\)\.in\('estado', \['activa', 'respondio'\]\)\.not\('proximo_envio_at', 'is', null\)/);
  // Cada uno por donde está, como lo busca el motor; quien contestó y el motor le cierra, tampoco; y el cierre es EL MISMO del motor.
  assert.match(f, /const i = x\.hilos \? -1 : indiceActual\(sec\.pasos, x\);\s*if \(i >= 0 && !seFrenaDesde\(sec\.pasos, i\)\) continue;/);
  assert.match(f, /x\.estado === 'respondio' && i >= 0 && cierraAlContestar\(sec\.pasos, i\) && await yaLeSalioAlgo\(supabase, x\.id\)/);
  assert.match(n, /if \(enRespuesta && nodoAhora && cierraAlContestar\(sec\.pasos, insc\.paso_actual\) && await yaLeSalioAlgo\(supabase, insc\.id\)\) \{/);
  // A «Entran» sólo se le resta quien no recibe nada; lo vencido sale al prenderla, y lo parado no se cuenta dos veces.
  assert.match(n, /const entranFrenados = borradores && seFrenaAlEntrar\(sec\.pasos\) \?/);
  assert.match(n, /adentroVencidos: Math\.max\(0, \(await vencidasAlPrenderla\(sec\)\.catch\(\(\) => 0\)\) - vencidasParadas\.length\),/);
  assert.match(n, /adentroLiberables: vencidasParadas\.filter\(\(id\) => liberados\.has\(id\)\)\.length,/);
  assert.match(n, /if \(!canal && !seFrenaPorBorradores\(sec\.pasos\)\) return null;/, 'sólo acciones: también se frenan');
  // Lo mismo que hace `setSecuenciaActiva` al prenderla.
  assert.match(n, /\.in\('estado', cierran \? \['activa'\] : \['activa', 'respondio'\]\)\.lte\('proximo_envio_at', ahoraISO\(\)\);/);
  assert.match(f, /if \(entran\.has\(id\)\) adentro\.add\(id\)/, 'y los que entrarían');
  assert.match(f, /activas: new Set\(filasOtras\.filter\(\(s\) => s\.activa\)/, 'los de una prendida no se ofrecen');
  assert.doesNotMatch(f, /\.update\(|\.insert\(|\.delete\(|\.upsert\(/, 'sólo lee');
  // Con «Incluirlas», los que se dicen en «Entran» son los que se miran, también al descartar.
  assert.match(n, /for \(const c of await existentesPorCron\(sec\)\) for \(const x of \[\.\.\.c\.viejos\.nuevas, \.\.\.c\.viejos\.reusar\]\) vistos\.add\(x\.lead_id\);/);
  // Descartar: por el camino de archivar, lo que se le dijo y sigue valiendo, y sin prender.
  const d = n.slice(n.indexOf('export async function descartarBorradoresViejos'), n.indexOf('* LO QUE SE DICE DE CADA UNA SIN GOTEO'));
  assert.match(d, /descartarBorradoresAnotando\(\(\(await getTenantDb\(\)\) as unknown as DbDescarte\), \{ ids \},/);
  assert.match(d, /leidos\.descartables\.map\(\(f\) => Number\(f\.id\)\)\.filter\(\(id\) => pedidos\.has\(id\)\)/, 'ni lo que no se le dijo, ni lo que ya no se puede');
  assert.doesNotMatch(d, /setSecuenciaActiva|activa: true/);
  // «No pude leerlos» no frena la activación, y el cartel no dice que salen los que están frenados.
  assert.match(n, /const borradores = await borradoresAlActivar\(sec, entran\)\.catch\(/);
  assert.match(n, /personas: personas == null \? null : personas - entranFrenados, canal,/);
  // La ruta, que ya es sólo del admin, con quién fue, y sin decir que falló si ya descartó.
  const r = leer('app/api/whatsapp/secuencias/route.ts');
  const patch = r.slice(r.indexOf('export async function PATCH'));
  assert.ok(patch.indexOf("!== 'admin'") < patch.indexOf('body.descartarViejosIds'), 'el descarte quedó antes del chequeo de admin');
  assert.match(patch, /autor: sesion\?\.email \?\? 'MaKo', incluirExistentes: incluirExist \}/);
  assert.match(patch, /const ritmo = await ritmoAlActivar\(id, \{ incluirExistentes: incluirExist \}\)\.catch\(/);
  // MaKo lo dice entero: no tiene el botón al lado.
  assert.match(leer('lib/mako-doer-acciones.ts'), /\$\{ritmo \? `\. \$\{textoEnteroDelAviso\(ritmo\)\}` : ''\}/);
  // Las dos pantallas de computadora usan el MISMO cartel.
  for (const p of ['app/automations/SecuenciaPerfil.tsx', 'app/automations/SimuladorWhatsApp.tsx']) assert.match(leer(p), /<AvisoRitmoConfirm aviso=\{avisoRitmo\}/, p);
  const c = leer('app/automations/AvisoRitmoConfirm.tsx');
  assert.match(c, /<Confirm tone="primary" bloqueado=\{ocupado\} onConfirm=\{onConfirm\} onCancel=\{onCancel\}/);
  assert.match(c, /aviso\.poner \|\| aviso\.viejos \? 'Activar igual' : 'Activar'/);
  // ⚠️ Enter sobre «Descartar» o «Poner goteo» PRENDÍA la automatización: Confirm escucha antes que nadie.
  const k = leer('app/_ui/Confirm.tsx');
  assert.match(k, /if \(cartel && t !== okRef\.current && t\?\.closest\('button, a, \[data-sin-enter\]'\)\) return;/);
  // Sólo los de este cartel: en otro, es de ése; y uno de atrás del velo no se clickea.
  assert.match(k, /if \(cartel && cartel !== cartelRef\.current\) return;/);
  assert.match(k, /e\.preventDefault\(\);\s*e\.stopPropagation\(\);\s*if \(!ocupado\) onConfirm\(\);/);
  // Después de descartar, el Enter que descartó no prende: el foco va al mensaje.
  assert.match(c, /<div ref=\{mensajeRef\} tabIndex=\{-1\} data-sin-enter/);
  assert.match(c, /useEffect\(\(\) => \{ if \(volvio\) mensajeRef\.current\?\.focus\(\); \}, \[volvio\]\);/);
  assert.match(c, /setVolvio\(\(n\) => n \+ 1\);/);
  assert.match(k, /if \(e\.key === 'Escape'\) \{ e\.stopPropagation\(\); if \(!ocupado\) onCancel\(\); \}/, 'Escape durante un descarte perdía el resultado');
  assert.match(k, /useEffect\(\(\) => \{ okRef\.current\?\.focus\(\); \}, \[\]\);/, 'cada render le robaba el foco al botón que se estaba mirando');
  // El teléfono: lo mismo, y sin dejar tocar nada durante el descarte.
  const m = leer('app/m/automations/AutomationsM.tsx');
  assert.match(m, /descartarViejosDelAviso\(x\.a\.id, x\.viejos!\.ids\)/);
  assert.match(m, /snap=\{aActivar\?\.viejos \? 'alto' : 'medio'\} ocupado=\{descartando\}/);
  assert.match(m, /consecuencia=\{\[aActivar\.texto, aActivar\.viejos\?\.frase\]\.filter\(Boolean\)\.join\(' '\)\}/);
  assert.equal((m.match(/disabled=\{descartando\}/g) ?? []).length, 3, 'Activar, Poner y Cancelar');
});

test('EL CAMINO HASTA EL HORARIO, DESDE EL AVISO MISMO: un toque en las tres pantallas (Martín: «no sabia donde se configuraba»)', () => {
  const s = leer('app/automations/SimuladorWhatsApp.tsx');
  // La fila: el ⚠ abre Configuraciones de ESA, afuera del botón de la fila (un botón no va adentro de otro). Quien no es admin, lo lee.
  assert.match(s, /onAviso=\{rolAdmin && Configuraciones \? \(\) => setConfigDe\(\{ id: j\.id, nombre: j\.nombre \}\) : undefined\}/);
  const fila = s.slice(s.indexOf('function ItemLista('), s.indexOf('function CampoNombre('));
  assert.match(fila, /<button type="button" data-sin-goteo aria-label=\{aviso\.rotulo\} title=\{aviso\.texto\} onClick=\{onAviso\}/);
  assert.ok(fila.indexOf('data-sin-goteo') > fila.indexOf('</button>'), 'el ⚠ quedó adentro del botón de la fila');
  // Al cerrar, el ⚠ se va.
  assert.match(s, /alCerrarConfigDe\.current = \(\) => \{ if \(secuencias\.find\(\(s\) => s\.id === configDe\?\.id\)\?\.aviso_ritmo\) onReload\(\); \};/);
  assert.match(s, /const cerrarConfigDe = useCallback\(\(\) => \{ setConfigDe\(null\); alCerrarConfigDe\.current\(\); \}, \[\]\);/, 'identidad fija: la regla del Modal');
  // El teléfono: decía y no llevaba a ningún lado. Al activar y en la que ya está prendida, sólo para quien puede editar.
  const m = leer('app/m/automations/AutomationsM.tsx');
  assert.match(m, /\{aActivar\.poner && <Button variant="secondary" size="lg" full disabled=\{descartando\} onClick=\{\(\) => \{ const id = aActivar\.a\.id; setAActivar\(null\); setConfigDe\(id\); \}\}>\{aActivar\.poner\}<\/Button>\}/);
  assert.match(m, /\{a\?\.avisoRitmo\?\.poner && v\?\.activa && puedeEditar && <Button [^>]*onClick=\{\(\) => \{ setAbierto\(false\); setConfigDe\(a\.id\); \}\}>/);
  assert.match(m, /<ConfiguracionesM secuenciaId=\{configDe\} onCerrar=\{\(\) => \{ setConfigDe\(null\); router\.refresh\(\); \}\} \/>/);
  // Con «Poner…» al lado, el otro botón es «Activar igual», como en la computadora.
  assert.match(m, /\{aActivar\.ritmo && !aActivar\.poner && !aActivar\.viejos \? 'Activar' : 'Activar igual'\}/);
  // Los MISMOS ajustes de la computadora, no una copia.
  const c = leer('app/m/automations/ConfiguracionesM.tsx');
  assert.match(c, /import\('@\/app\/automations\/ConfigAutomatizacionPanel'\)\.then\(\(m\) => m\.AjustesDeLaAutomatizacion\)/);
  assert.match(c, /ocupado=\{sucios\.horario \|\| sucios\.antiban\}/, 'se cerraba con un guardado en vuelo');
  // Y `poner` viaja hasta la tarjeta del teléfono.
  assert.match(leer('app/m/automations/reglas.ts'), /avisoRitmo\?: \{ texto: string; rotulo: string; poner: string \| null \} \| null;/);
});

test('el canal es el del primer mensaje que le sale, no el del primero del array', () => {
  const pasos = [
    { id: 'tarde', canal: 'email', tipo: 'texto', cuerpo: 'después' },
    { id: 'ini', nodo: 'condicion', si_no: 'dm' },
    { id: 'dm', canal: 'instagram', tipo: 'texto', cuerpo: 'hola', siguiente: 'tarde' },
  ] as unknown as PasoGrafo[];
  // El email está ANTES en el array: con «el primero que haya» saldría email.
  const orden = [pasos[1], pasos[0], pasos[2]];
  assert.equal(canalDelPrimerMensaje(orden), 'instagram');
  assert.equal(canalDelPrimerMensaje([{ id: 'a', nodo: 'condicion' }] as unknown as PasoGrafo[]), null);
});

test('el cableado: el motor cuenta con la misma puerta del barrido, y las cuatro puertas de activar lo dicen', () => {
  const n = leer('lib/nutricion.ts');
  const f = n.slice(n.indexOf('export async function ritmoAlActivar'), n.indexOf('export async function incluirExistentes'));
  assert.match(f, /if \(!barridoInscribe\(vista\) \|\| !barreElDisparador\(vista\)\) continue;/);
  assert.match(f, /await aInscribir\(supabase, vista, candidatos\)/);
  assert.match(f, /porEvento: vistasPorDisparador\(sec\)\.some\(\(v\) => TRIGGERS_SOLO_EVENTO\.has\(v\.trigger_tipo\) && v\.trigger_tipo !== TRIGGER_AVISO_MAKO\)/);
  assert.match(f, /porAprobar: porAprobarDelFlujo\(sec\.pasos, sec\.envio_automatico\)/);
  assert.match(leer('app/automations/SimuladorWhatsApp.tsx'), /if \(a\.poner\) setConfigDe\(\{ id: a\.j\.id, nombre: a\.j\.nombre \}\);/);
  assert.match(leer('app/api/whatsapp/secuencias/route.ts'), /ritmo: await ritmoAlActivar\(id, \{ incluirExistentes: req\.nextUrl\.searchParams\.get\('incluir'\) === '1' \}\)/);
  assert.match(leer('app/automations/SecuenciaPerfil.tsx'), /conExistentes\(\(\) => void conRitmo\(\(\) => void toggle\(\)\)\)/);
  assert.match(leer('app/automations/SimuladorWhatsApp.tsx'), /if \(accion === 'activa' && !j\.activa && rolAdmin && !o\?\.sinRitmo\) \{/);
  assert.match(leer('app/m/automations/AutomationsM.tsx'), /if \(activa && !deshaciendo && !yaAvisado\) \{/);
  assert.match(leer('lib/mako-doer-acciones.ts'), /const ritmo = activa \? await runWithWorkspace\(ws, \(\) => ritmoAlActivar\(secuenciaId\)\)\.catch\(\(\) => null\) : null;/);
});

// ROTURAS (30/10/2026, una por vez, restaurando byte a byte; base 9 / 0): no dice que no tiene goteo → 8 / 1 · sólo tope por día
// cuenta como goteo → 8 / 1 · Instagram con el tope de WhatsApp → 7 / 2 · el tiempo redondea para arriba → 6 / 3 · el tope de la
// línea separa como un goteo → 7 / 2 · avisa con una persona → 8 / 1 · no poder contar calla sin goteo → 8 / 1 · cuenta lo que
// dispara sólo por evento → 8 / 1 · el interruptor, el «⋯», el teléfono o MaKo no lo dicen → 8 / 1 cada uno. «El canal es el del
// primero del array» quedó en verde: el mensaje del flujo era también el primero. Con el orden cambiado se vio un defecto real: un
// flujo que arranca con una condición se cortaba ahí y tomaba el canal del primero del array. Ahora, rota → 8 / 1.
// Por evento y para aprobar (base 11 / 0): una por evento vuelve a callar, avisa con goteo, avisa lo que queda para aprobar, lo que queda
// para aprobar dice que sale, no poder contar dice «salen juntos» aunque se apruebe, el aviso de MaKo cuenta como evento, el motor no
// le pasa lo de aprobar, el «⋯» no ofrece poner goteo → 10 / 1 cada una.
// Las prendidas, el horario y la plantilla (base 15 / 0), 23 roturas, todas en rojo, una por vez: no dice que falta el horario, lo dice si
// queda para aprobar, toma «no se pudo leer» como «no tiene» (5 / 10), no dice entre qué horas, no ofrece ponerlo, el rótulo no lo dice, por
// evento con goteo calla, la plantilla nace sin ritmo, no poder ponerlo se calla o tumba la creación, la ruta, la API o las sugerencias no lo
// enchufan, la prendida no avisa o avisa las del equipo, un error afirma a medias, el motor escribe al avisar, la pantalla lo muestra
// pausada o lo esconde a quien no es admin, ponerle goteo no relee, la tarjeta o el teléfono lo esconden, «Poner…» no abre Configuraciones.
// El horario de fábrica (base 16 / 0): toca a las que ya existían, pisa un horario propio o el del negocio, un DM o el aviso del equipo espera,
// la puerta no lo pone, el aviso no lo dice, la difusión lo toma → 15 / 1 cada una.
// CON EL DATO REAL (30/10, sólo lectura): de 37 pausadas de producción, 11 dirían algo (9 con número, de 2 a 34 personas; 2 de Instagram
// sin número). Las 7 activas de Instagram tampoco tienen goteo. Ninguna de las medidas queda para aprobar: ese texto no se vio con un caso real.
