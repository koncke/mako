// =============================================================================
// Lo que no es para MaKo no dispara un turno, y MaKo sabe quién escribe (27/10/2026, P8; lib/doer-para-quien.ts)
// =============================================================================
// ~16 de 58 turnos contestaban un acuse o una charla entre personas; a «Esto habla solo ? @joan» MaKo dio una descripción
// falsa; a quien escribía la llamó por otro nombre.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bloqueQuienEscribe, citaDe, confirmaYNombraAOtro, conLasRespuestas, esAcusePuro, esRespuestaCorta, mencionesDe, noEsParaMaKo, paraQuienDelLote, quienesMencionados, sinElLlamadoAMaKo, type ParaQuien } from '../lib/doer-para-quien';
import { confirmacionPura } from '../lib/confirmacion-pura';
import { clasificarIntencion } from '../lib/mako-intencion';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const base = { nombraAMaKo: false, makoPregunto: false, hayPendientes: false, menciones: [] as string[] };

test('1. un acuse puro o una mención a otro no es para MaKo', () => {
  for (const t of ['ok', 'Gracias!', 'genial gracias', 'jajaja', '👍', 'dale, gracias']) assert.equal(noEsParaMaKo({ ...base, texto: t }), 'acuse', t);
  // El literal del grupo: «Esto habla solo ? @joan».
  const msg = { extendedTextMessage: { text: 'Esto habla solo ? @5491100000000', contextInfo: { mentionedJid: ['5491100000000@s.whatsapp.net'] } } };
  assert.deepEqual(mencionesDe(msg), ['5491100000000@s.whatsapp.net']);
  assert.equal(noEsParaMaKo({ ...base, texto: 'Esto habla solo ? @joan', menciones: mencionesDe(msg) }), 'a-otro');
});

test('2. es para MaKo si lo nombran, si preguntó algo (el «ok» es un sí) o si hay algo pendiente; y un pedido, siempre', () => {
  assert.equal(noEsParaMaKo({ ...base, texto: 'ok', makoPregunto: true }), null);
  assert.equal(noEsParaMaKo({ ...base, texto: 'ok', hayPendientes: true }), null);
  assert.equal(noEsParaMaKo({ ...base, texto: 'gracias MaKo', nombraAMaKo: true }), null);
  for (const t of ['ok, pausala', 'gracias, ¿y los leads de hoy?', 'listo el presupuesto?']) assert.equal(noEsParaMaKo({ ...base, texto: t }), null, t);
  assert.ok(!esAcusePuro('ok, mandale el link a Juan'));
});

test('3. quién escribe: su nombre de WhatsApp, y nada si no hay nombre o es un número', () => {
  assert.match(bloqueQuienEscribe('Brigitte'), /^QUIÉN TE ESCRIBE AHORA: Brigitte \(su nombre de WhatsApp\)\./);
  assert.equal(bloqueQuienEscribe(''), '');
  assert.equal(bloqueQuienEscribe('92741379870892'), '');
});

test('4. el doer: lo saltea antes del turno (leyendo la memoria sólo si hace falta) y le pasa quién escribe al system', () => {
  const doer = leer('lib/mako-doer-in.ts');
  assert.match(doer, /if \(!esMedia\) \{\n\s*const noEs = await noEsParaMaKoAhora\(wsData, jid, textoDirecto, quien, async \(\) => vigentes\.length > 0, data\.paraQuien\);\n\s*if \(noEs\) return \{ engaged: false, skip: `no es para MaKo \(\$\{noEs\}\)` \};/);
  assert.match(doer, /if \(nombraAMaKo\(texto\) \|\| quien\.aMaKo \|\| delLote\?\.nombra\) return null;/, 'una @mención a MaKo dejó de contar como nombrarla');
  assert.match(doer, /const pideUnSi = async \(\) => \(await hayPendientes\(\)\) \|\| \(await makoAcabaDePreguntar\(wsData, jid\)\);/);
  assert.match(doer, /return \(await pideUnSi\(\)\) \? null : candidato;/, 'el «ok» después de una pregunta de MaKo dejó de ser un sí');
  assert.match(doer, /\[bloqueQuienEscribe\(data\.pushName\), (?:ctxContacto, )?ctxYaSeHablo, ctxMostrado\]/);
});

// La revisión adversarial de 92d23e11d: elegir a MaKo con la @ manda el jid de su línea, no la palabra «mako», y quedaba callado.
const LINEA = '5493764002605';
const conMencion = (jid: string) => ({ extendedTextMessage: { text: '@5493764002605 ¿cuántos leads entraron hoy?', contextInfo: { mentionedJid: [jid] } } });

test('5. una @mención a la línea de MaKo es para MaKo; a otra persona, no; un @lid o sin la línea, no se sabe y contesta', () => {
  const aMaKo = quienesMencionados(mencionesDe(conMencion(`${LINEA}@s.whatsapp.net`)), LINEA);
  assert.deepEqual(aMaKo, { aMaKo: true, aOtros: [] });
  assert.equal(noEsParaMaKo({ ...base, texto: '@5493764002605 ¿cuántos leads entraron hoy?', menciones: aMaKo.aOtros }), null);
  // Con `:device` y sin el 9 de Argentina, la misma línea.
  assert.equal(quienesMencionados(['543764002605:12@s.whatsapp.net'], LINEA).aMaKo, true);
  // A otra persona: «a otro».
  const aJoan = quienesMencionados(['5491100000000@s.whatsapp.net'], LINEA);
  assert.deepEqual(aJoan, { aMaKo: false, aOtros: ['5491100000000@s.whatsapp.net'] });
  assert.equal(noEsParaMaKo({ ...base, texto: '@Joan pasame el presupuesto', menciones: aJoan.aOtros }), 'a-otro');
  // Un @lid no se compara con un teléfono, y sin el número de la línea no se sabe: MaKo contesta, como antes de P8.
  for (const q of [quienesMencionados(['70781665022126@lid'], LINEA), quienesMencionados(['5491100000000@s.whatsapp.net'], null),
    quienesMencionados(['5491100000000@s.whatsapp.net', '70781665022126@lid'], LINEA)]) {
    assert.deepEqual(q, { aMaKo: false, aOtros: [] });
  }
});

test('6. el 👍 sigue la MISMA regla que el turno: a lo que no es para MaKo no le reacciona', () => {
  const doer = leer('lib/mako-doer-in.ts');
  const fn = doer.slice(doer.indexOf('async function enganchaElTexto('), doer.indexOf('/** Lo que dejó el acuse del que ganó el candado'));
  assert.match(fn, /nombraAMaKo\(texto\) \|\| quien\.aMaKo/);
  assert.match(fn, /return engancha && !\(await noEsParaMaKoAhora\(wsData, jid, texto, quien, pendientes\)\);/);
  assert.match(doer, /await enganchaElTexto\(wsData, jid, texto, await mencionadosEn\(instance, data\)\)/);
  assert.match(doer, /const enganchaTexto = modo === 'libre' \|\| nombraAMaKo\(textoDirecto\) \|\| quien\.aMaKo \|\| abierta/);
});

test('7. el lote se decide MENSAJE POR MENSAJE: una @mención a otro no calla lo que era para MaKo, y lo de otro no entra', () => {
  // La revisión de 36e06b35f (el 👍 y el silencio en «ventana») y su verificación: con las menciones de todos juntas, una
  // @mención a Pedro callaba un «mako, ¿cuántos leads?» que ya tenía su 👍.
  const m = (texto: string, para: ParaQuien) => ({ texto, para });
  // «@Pedro mirá esto» + «mako, ¿cuántos leads?»: contesta, y lo de Pedro no entra al turno.
  const a = paraQuienDelLote([m('@Pedro mirá esto', 'a-otro'), m('mako, ¿cuántos leads entraron hoy?', 'mako')]);
  assert.deepEqual(a.quedan.map((x) => x.texto), ['mako, ¿cuántos leads entraron hoy?']);
  assert.deepEqual(a.decision, { nombra: true, noEs: null });
  // «@Pedro te paso los datos» + una pregunta sin nombrar a MaKo: como un mensaje suelto, se decide por el modo.
  assert.deepEqual(paraQuienDelLote([m('@Pedro te paso los datos', 'a-otro'), m('¿cuántos leads entraron hoy?', null)]).decision, { nombra: false, noEs: null });
  // «@MaKo …» + «@Pedro pasame el contrato» (ventana cerrada): contesta lo de MaKo, sin lo de Pedro.
  const b = paraQuienDelLote([m('@MaKo ¿cuántos leads?', 'mako'), m('@Pedro pasame el contrato de Juan', 'a-otro')]);
  assert.deepEqual([b.quedan.length, b.decision.nombra], [1, true]);
  // ⚠️ La verificación de bb41ede4a: Ana «@Pedro ¿lo confirmo?» y Pedro «sí». Sacar sólo el de Ana dejaba el «sí» solo, que con
  // una pendiente la EJECUTABA. La respuesta corta a un mensaje para otro también es para otro: el lote entero no es para MaKo.
  const si = paraQuienDelLote([m('@Pedro ¿lo confirmo?', 'a-otro'), m('sí', null)]);
  assert.deepEqual([si.quedan.length, si.decision], [2, { nombra: false, noEs: 'a-otro' }], 'el «sí» a Pedro quedó solo, para MaKo');
  assert.deepEqual(paraQuienDelLote([m('@Pedro ¿me pasás el contrato?', 'a-otro'), m('dale, ya te lo mando', null)]).decision, { nombra: false, noEs: 'a-otro' });
  // Con algo para MaKo en el lote, la pregunta a Pedro y su «sí» no entran; lo que viene DESPUÉS de lo de MaKo, sí.
  const mezcla = paraQuienDelLote([m('mako, ¿cuántos leads entraron hoy?', 'mako'), m('@Pedro ¿lo confirmo?', 'a-otro'), m('sí', null)]);
  assert.deepEqual(mezcla.quedan.map((x) => x.texto), ['mako, ¿cuántos leads entraron hoy?']);
  assert.deepEqual(paraQuienDelLote([m('@Pedro mirá', 'a-otro'), m('mako, ¿y los leads?', 'mako'), m('sí', null)]).quedan.map((x) => x.texto), ['mako, ¿y los leads?', 'sí']);
  assert.ok(esRespuestaCorta('sí') && esRespuestaCorta('dale, ya te lo mando') && !esRespuestaCorta('¿cuántos leads entraron hoy?'));
  // Todo para otro, o sólo acuses: no es para MaKo.
  assert.deepEqual(paraQuienDelLote([m('@Pedro ¿me pasás el contrato?', 'a-otro'), m('@Pedro dale', 'a-otro')]).decision, { nombra: false, noEs: 'a-otro' });
  assert.deepEqual(paraQuienDelLote([m('gracias', 'acuse'), m('genial', 'acuse')]).decision, { nombra: false, noEs: 'acuse' });
  // El doer: cada mensaje se clasifica con lo suyo, el sintético lleva la decisión (no las menciones) en los dos lotes, y la regla la usa.
  const doer = leer('lib/mako-doer-in.ts');
  // Los dos lotes y el 👍 (`contestaAOtroEnLaCola`, test 8).
  assert.equal((doer.match(/textos\.push\(\{ texto: t, para: await paraQuienEsElMensaje\(/g) ?? []).length, 3, 'un lote no clasifica cada mensaje');
  assert.equal((doer.match(/message: \{ conversation: unirMensajes\(lote\.quedan\.map\(\(m\) => \(\{ texto: m\.texto \}\)\)\) \},\n\s*paraQuien: \{ \.\.\.lote\.decision, leHabla: !!lote\.quedan\[lote\.quedan\.length - 1\]\?\.leHabla \},/g) ?? []).length, 2);
  assert.doesNotMatch(doer, /mencionesDelLote/, 'volvieron las menciones juntas del lote');
  assert.match(doer, /: data\.paraQuien \? \{ aMaKo: data\.paraQuien\.nombra, aOtros: \[\] \}/);
  assert.match(doer, /noEsParaMaKoAhora\(wsData, jid, textoDirecto, quien, async \(\) => vigentes\.length > 0, data\.paraQuien\)/);
  assert.match(doer, /const candidato = delLote \? delLote\.noEs : noEsParaMaKo\(/);
  // Lo que es para otra persona no lo vuelve para MaKo ni una pendiente ni su pregunta: sólo un acuse se lee como «sí».
  assert.match(doer, /if \(!candidato\) return null;\n[^\n]*\n\s*if \(candidato === 'a-otro'\) return !delLote && confirmaYNombraAOtro\(texto\) && \(await pideUnSi\(\)\) \? null : candidato;/);
  assert.equal(noEsParaMaKo({ ...base, texto: '@Pedro sí, confirmalo vos', menciones: ['5491100000000@s.whatsapp.net'], hayPendientes: true, makoPregunto: true }), 'a-otro');
  // El sintético nombra a quien escribió lo que QUEDA (no al último de la cola), y el cron decide como el turno.
  assert.match(doer, /const ultimo = lote\.quedan\[lote\.quedan\.length - 1\]\?\.payload \?\? data;/);
  assert.match(doer, /const autores = new Set\(lote\.quedan\.map\(\(m\) => m\.payload\.key\?\.participant \?\? ''\)\);/);
  assert.equal((doer.match(/t = conLaMarcaDelAdjunto\(p, t\);/g) ?? []).length, 2, 'el cron no marca la imagen sin texto');
  assert.match(doer, /payload: \{ \.\.\.data, instance \} as unknown/, 'la cola no guarda la instancia: el cron no conoce la línea');
  assert.match(doer, /const instancia = cola\.map\(\(m\) => String\(\(\(m\.payload as \{ instance\?: unknown \}\) \?\? \{\}\)\.instance \?\? ''\)\)\.find\(Boolean\) \?\? '';/);
});

test('8. la respuesta a otro es un acuse o una confirmación ENTERA, de OTRA persona; y el «sí, y avísale a @Pedro» es para MaKo', () => {
  // La verificación de 8cb034a18: con sólo el arranque, un pedido corto para MaKo detrás de una mención quedaba con 👍 y silencio.
  for (const t of ['sí', 'sí, dale', 'dale', 'ok 👍', 'dale, ya te lo mando', 'listo', 'no', 'sí, ya lo hago', 'gracias', 'ya está', 'bueno, ahora lo veo', 'claro que sí'])
    assert.ok(esRespuestaCorta(t), `«${t}» no es una respuesta`);
  for (const t of [
    'listo, agendá a Juan el lunes a las 10', 'bueno, pasame los leads de hoy', 'dale, cargá la venta de Juan por 500', 'si entra un lead nuevo avisame',
    'ok ahora pasame el resumen del día', 'gracias. Cuántos leads hay hoy', 'ya está, cargá el pago de Ana', 'claro que sí, mandale el link a Juan',
    'obvio, cobrale a Ana', 'de una, armá el resumen', 'sí mako', 'dale?',
  ]) assert.ok(!esRespuestaCorta(t), `«${t}» se toma como respuesta a otro`);
  const m = (texto: string, para: ParaQuien, autor: string | null) => ({ texto, para, autor });
  const paras = (l: ReturnType<typeof m>[]) => conLasRespuestas(l).map((x) => x.para);
  // Ana le pregunta a Pedro y Pedro contesta (dos veces): para Pedro. Sin autor, también (es lo que no ejecuta nada).
  assert.deepEqual(paras([m('@Pedro ¿lo confirmo?', 'a-otro', 'ana'), m('sí', null, 'pedro'), m('dale', null, 'pedro')]), ['a-otro', 'a-otro', 'a-otro']);
  assert.deepEqual(paras([m('@Pedro ¿lo confirmo?', 'a-otro', null), m('sí', null, null)]), ['a-otro', 'a-otro']);
  assert.deepEqual(paras([m('@Pedro ¿lo confirmo?', 'a-otro', 'ana'), m('sí', null, 'pedro'), m('ok', 'acuse', 'ana')]), ['a-otro', 'a-otro', 'a-otro']);
  // Ana le avisa a Leila y después le dice «sí» a MaKo: nadie se contesta a sí mismo.
  assert.deepEqual(paras([m('@Leila mirá, ya lo encontró', 'a-otro', 'ana'), m('sí', null, 'ana')]), ['a-otro', null]);
  // El pedido para MaKo detrás de una mención entra al turno.
  assert.deepEqual(paraQuienDelLote([m('@Pedro mirá esto', 'a-otro', 'ana'), m('listo, agendá a Juan el lunes a las 10', null, 'ana')]).decision, { nombra: false, noEs: null });
  // «sí, y avísale a @Pedro»: con algo pendiente o una pregunta de MaKo, para MaKo; «@Pedro sí» y «sí @Pedro», para Pedro.
  const M = ['5491100000000@s.whatsapp.net'];
  for (const t of ['sí, y avisale a @5491100000000', 'dale, agendalo con @5491100000000']) {
    assert.ok(confirmaYNombraAOtro(t), t);
    assert.equal(noEsParaMaKo({ ...base, texto: t, menciones: M, hayPendientes: true }), null, t);
    assert.equal(noEsParaMaKo({ ...base, texto: t, menciones: M, makoPregunto: true }), null, t);
    assert.equal(noEsParaMaKo({ ...base, texto: t, menciones: M }), 'a-otro', `${t} sin nada pendiente`);
  }
  for (const t of ['@5491100000000 sí, confirmalo vos', 'sí @5491100000000', 'sí, @5491100000000', 'sí a @5491100000000', 'avisale a @5491100000000'])
    assert.equal(noEsParaMaKo({ ...base, texto: t, menciones: M, hayPendientes: true, makoPregunto: true }), 'a-otro', t);
  // El doer: el 👍 mira la cola con la MISMA regla (sin él, el «sí» de Pedro recibía el 👍 con una pendiente viva), los lotes
  // pasan el autor, y lo pendiente se lee una vez y sólo para el «sí» con mención.
  const doer = leer('lib/mako-doer-in.ts');
  assert.match(doer, /&& !\(await contestaAOtroEnLaCola\(wsData, instance, jid, msgId, texto\)\)/);
  assert.match(doer, /return conLasRespuestas\(textos\)\[i\]\.para === 'a-otro';/);
  assert.equal((doer.match(/autor: p\.key\?\.participant \?\? null/g) ?? []).length, 3, 'un lote no pasa el autor');
  assert.match(doer, /const pide = q\.aOtros\.length > 0 && confirmaYNombraAOtro\(texto\) && \(await pideUnSi\(\)\);/);
  assert.match(leer('lib/doer-para-quien.ts'), /export function paraQuienDelLote<T extends ConAutor>\(entrada: readonly T\[\]\): \{ quedan: T\[\]; decision: ParaQuienDelLote \} \{\n\s*const mensajes = conLasRespuestas\(entrada\);/);
});

test('9. «@MaKo sí» es un «sí»: el llamado a MaKo no es contenido, para el clasificador ni para la puerta', () => {
  // La verificación de 8cb034a18: elegir a MaKo con la @ escribe el número de su línea, que contaba como palabra (pura = falso) y
  // tapaba el «sí» del arranque (capturar, dudosa, sin confirmar_accion). «MaKo, sí» tampoco confirmaba.
  assert.ok(!confirmacionPura('@5493764002605 sí'), 'el bug ya no se reproduce: revisar la prueba');
  for (const [t, limpio] of [['@5493764002605 sí', 'sí'], ['@5493764002605, dale', 'dale'], ['MaKo, sí', 'sí'], ['mako sí', 'sí'], ['@5493764002605 MaKo, sí', 'sí']] as const) {
    assert.equal(sinElLlamadoAMaKo(t, LINEA), limpio, t);
    assert.ok(confirmacionPura(sinElLlamadoAMaKo(t, LINEA)), `«${t}» no es una confirmación pura`);
    assert.equal(clasificarIntencion(sinElLlamadoAMaKo(t, LINEA), { hayPendientes: true }).intencion, 'confirmar', `«${t}» con una pendiente no confirma`);
  }
  // En un lote, mensaje por mensaje; la @ de OTRO, sin la línea o un pedido que nombra a MaKo quedan como están.
  assert.equal(sinElLlamadoAMaKo('[Te mandó 2 mensajes seguidos.]\n(1) hola\n(2) @5493764002605 sí', LINEA), '[Te mandó 2 mensajes seguidos.]\n(1) hola\n(2) sí');
  for (const t of ['@5491100000000 sí', 'mako, ¿cuántos leads entraron hoy?', 'sí, MaKo']) assert.equal(sinElLlamadoAMaKo(t, LINEA), t, t);
  assert.equal(sinElLlamadoAMaKo('@5493764002605 sí', null), '@5493764002605 sí');
  // La respuesta citada: su id y su autor.
  assert.deepEqual(citaDe({ extendedTextMessage: { text: 'sí', contextInfo: { stanzaId: 'ABC123', participant: `${LINEA}@s.whatsapp.net` } } }), { id: 'ABC123', autor: `${LINEA}@s.whatsapp.net` });
  assert.deepEqual(citaDe({ conversation: 'sí' }), { id: null, autor: null });
  // El doer limpia el texto antes de clasificarlo y de pasarlo a la puerta.
  assert.match(leer('lib/mako-doer-in.ts'), /let texto = \/@\|mako\/i\.test\(textoDirecto\) \? sinElLlamadoAMaKo\(textoDirecto, lineaDelDueno \? null : await numeroDeLaLinea\(instance\)\) : textoDirecto;/);
});

test('10. la respuesta a otro también es la confirmación CON VERBO; y el llamado a MaKo se saca sólo si lo que queda confirma', () => {
  // La verificación de 9cef25dba (ALTA): sin los verbos, «@Pedro ¿lo confirmo?» + «sí, hacelo» entraba al turno y ejecutaba una
  // pendiente que le llega a un tercero (la de plata la frena la puerta del grupo).
  const m = (texto: string, para: ParaQuien, autor: string | null) => ({ texto, para, autor });
  for (const si of ['sí, hacelo', 'dale, confirmalo', 'sí, mandalo', 'sí, agendalo', 'sí, confirmá', 'sí, confirmalo vos', 'sí Pedro', 'dale Ana', 'sí, ya lo vi', 'sí, eso', 'sí señor']) {
    assert.ok(esRespuestaCorta(si), `«${si}» no es una respuesta`);
    const lote = paraQuienDelLote([m('@Pedro ¿lo confirmo?', 'a-otro', 'ana'), m(si, null, 'pedro')]);
    assert.deepEqual(lote.decision, { nombra: false, noEs: 'a-otro' }, `«${si}» de Pedro entra al turno`);
  }
  // Los pedidos a MaKo siguen sin serlo (el test 8), y nombrar a MaKo tampoco.
  for (const t of ['sí, hacelo mako', 'dale, cargá la venta de Juan por 500', 'sí, agendá a Juan el lunes']) assert.ok(!esRespuestaCorta(t), t);
  // Con una pendiente viva, sacar el «MaKo» de un pedido lo volvía «sí»: ahora sólo se saca si lo que queda es una confirmación.
  for (const t of ['mako listo el reporte?', 'Mako ok pasame los leads', 'MaKo, dale con la campaña nueva', '@5493764002605 ok, ¿cuántos leads?'])
    assert.equal(sinElLlamadoAMaKo(t, LINEA), t, t);
  // Y la @ al final: «sí @MaKo» es un «sí».
  assert.equal(sinElLlamadoAMaKo('sí @5493764002605', LINEA), 'sí');
  assert.equal(sinElLlamadoAMaKo('MaKo, no', LINEA), 'no');
});
