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
import { esCharlaConAlgo, laCharlaConAlgo } from '../lib/doer-hilo';
import { bloqueQuienEscribe, charlaQueCalla, citaDe, confirmaYNombraAOtro, conLasRespuestas, esAcusePuro, esEcoDeMaKo, esRespuestaCorta, mencionesDe, noEsParaMaKo, paraQuienDelLote, preguntaAMaKo, quienesMencionados, sinElLlamadoAMaKo, type ParaQuien } from '../lib/doer-para-quien';
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
  assert.match(doer, /\[bloqueQuienEscribe\(data\.pushName\), (?:ctxCita, )?(?:ctxParaElEquipo, )?(?:ctxContacto, )?(?:ctxEquipo, ctxPedidos, )?ctxYaSeHablo, ctxMostrado(?:,\n\s*laPlataforma \? [^\]]*)?\]/);
  // (Desde el 12/11/2026 el último es el bloque de la plataforma, sólo en el grupo de SuperAdmin: lib/doer-plataforma.ts.)
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
  // Cuatro desde el 29/10/2026: el turno, los dos lotes y la marca del audio del lote que no se escuchó (`marcaDelAudioDelLote`).
  assert.equal((doer.match(/autor: p\.key\?\.participant \?\? null/g) ?? []).length, 4, 'un lote no pasa el autor');
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

test('11. con mayúscula no siempre es un nombre; y «@MaKo ok» / «mako listo» vuelven a ser un «ok»', () => {
  // La verificación de 991abd4af: «Dale Makito», «Ok Borralo» o «Dale Meta» detrás de un @ a otro quedaban mudos.
  for (const t of ['Dale Makito', 'Sí Makito', 'Si Pausala', 'Ok Borralo', 'Dale Cancelalo', 'Si Cargala', 'Dale Meta', 'Ok Calendly', 'Sí, Leads'])
    assert.ok(!esRespuestaCorta(t), `«${t}» se toma como respuesta a otro`);
  // Y los nombres que esa lista se come (la verificación de 96e7840e8), con su lista corta.
  for (const t of ['sí Pedro', 'dale Ana', 'sí Leila', 'ok Paola', 'dale Marcela', 'sí Pascuala', 'dale Mandela', 'ok Guardiola', 'sí Makena', 'sí Pasquale']) assert.ok(esRespuestaCorta(t), `«${t}» no es una respuesta`);
  // Un «ok» o un «listo» a MaKo es un «ok» para el clasificador (la puerta de plata y terceros lo repregunta: no es puro).
  for (const [t, limpio] of [['@5493764002605 ok', 'ok'], ['@5493764002605 listo', 'listo'], ['MaKo, ok', 'ok'], ['mako listo', 'listo']] as const) {
    assert.equal(sinElLlamadoAMaKo(t, LINEA), limpio, t);
    assert.equal(clasificarIntencion(limpio, { hayPendientes: true }).intencion, 'confirmar', t);
    assert.ok(!confirmacionPura(limpio), `«${limpio}» confirmaría plata`);
  }
  // Un pedido sigue entero (test 10).
  assert.equal(sinElLlamadoAMaKo('mako listo el reporte?', LINEA), 'mako listo el reporte?');
});

test('12. todo lo que sale por la línea de MaKo queda en el anillo anti-eco, y su línea nunca es «la del dueño»', () => {
  // La verificación de 991abd4af: los avisos, las insistencias, los flujos y el cierre de tickets salían sin anotarse; su eco volvía
  // `fromMe` y marcaba la línea de MaKo como del dueño 7 días, y desde ahí «@MaKo sí» no confirmaba.
  const grupo = leer('lib/mako-grupo.ts');
  // El envío de texto de la línea de MaKo anota lo que sale a un GRUPO: por ahí pasan `enviarAGrupoJid`, el grupo SuperAdmin y la
  // bienvenida (la verificación de 96e7840e8: esos dos quedaban afuera).
  const texto = grupo.slice(grupo.indexOf('async function enviarTextoVozMaKo('), grupo.indexOf('async function ponerNombre('));
  assert.match(texto, /if \(r\.ok && id && jidONumero\.endsWith\('@g\.us'\)\) await anotarEnviadosConTope\(OWNER_WS, jidONumero, \[id\]\);/);
  for (const f of ['export async function enviarAGrupoJid(', 'export async function enviarAlGrupoSuperAdmin(']) {
    const cuerpo = grupo.slice(grupo.indexOf(f), grupo.indexOf('\n}\n', grupo.indexOf(f)));
    assert.match(cuerpo, /await enviarTextoVozMaKo\(jid, texto/, `${f} no sale por enviarTextoVozMaKo`);
  }
  assert.match(grupo, /if \(opts\.bienvenida !== false\) await enviarTextoVozMaKo\(jid, deLaAgencia \? [^;]*mensajeBienvenidaMaKo\(opts\.nombre\)\);/);
  // El anillo, con compare-and-set y la lectura estricta (un error al leer no lo vacía), y nunca tira.
  const anotar = grupo.slice(grupo.indexOf('export async function anotarEnviadosAlGrupo('), grupo.indexOf('const delAnillo'));
  assert.match(anotar, /const raw = await getSettingEstricto\(KEY_ENVIADOS\(jid\)\);/);
  assert.match(anotar, /if \(await cambiarSettingSi\(KEY_ENVIADOS\(jid\), raw, JSON\.stringify\(next\)\)\) return;/);
  assert.match(anotar, /\} catch \(e\) \{/);
  assert.doesNotMatch(anotar, /setSetting\(/, 'el anillo volvió a escribir sin compare-and-set');
  // Seis vueltas con una espera al azar: con tres, cuatro envíos a la vez perdían un id (la verificación de tren-t).
  assert.match(grupo, /const INTENTOS_DEL_ANILLO = 6;/);
  assert.match(anotar, /for \(let intento = 0; intento < INTENTOS_DEL_ANILLO; intento\+\+\) \{\n\s*if \(intento > 0\) await new Promise\(\(r\) => setTimeout\(r, 10 \+ Math\.random\(\) \* 60\)\);/);
  const maKo = grupo.slice(grupo.indexOf('export async function enviarAlGrupoMaKo('), grupo.indexOf('export async function enviarPartesAlGrupoMaKo('));
  assert.match(maKo, /if \(id\) await anotarEnviadosConTope\(OWNER_WS, jid, \[id\]\);/);
  assert.match(grupo, /if \(!d\.ev && r\.ids\.length\) await anotarEnviadosConTope\(OWNER_WS, jid, r\.ids\);/);
  // ⚠️ CON TOPE (la verificación de 2cb1cf67e): con la base colgada, el mensaje esperaba al anillo y la respuesta en partes salía
  // 1/3 durante cinco minutos. Lo que ya salió espera hasta 3 s; la anotación sigue sola. Nadie fuera del tope espera al anillo.
  assert.match(grupo, /export const TOPE_DEL_ANILLO_MS = 3000;/);
  const conTope = grupo.slice(grupo.indexOf('export async function anotarEnviadosConTope('), grupo.indexOf('export async function anotarEnviadosConTope(') + 400);
  assert.match(conTope, /const tope = new Promise<void>\(\(r\) => \{ t = setTimeout\(r, TOPE_DEL_ANILLO_MS\); \}\);\n\s*try \{ await Promise\.race\(\[anotarEnviadosAlGrupo\(ws, jid, ids\), tope\]\); \} finally \{ clearTimeout\(t\); \}/);
  assert.equal((grupo.match(/await anotarEnviadosAlGrupo\(/g) ?? []).length, 0, 'alguien espera al anillo sin tope');
  assert.match(grupo, /const KEY_ENVIADOS = \(jid: string\) => `mako\.doer\.sent\.\$\{jid\}`;/, 'el anillo cambió de clave: el doer ya no ve lo anotado antes');
  // El doer usa ESE anillo (uno solo) y nunca toma la línea de MaKo por la del dueño.
  const doer = leer('lib/mako-doer-in.ts');
  assert.match(doer, /const idsEnviados = idsEnviadosAlGrupo;\n(?:\/\/[^\n]*\n)+\s*const registrarEnviados = \(ws: number, jid: string, ids: readonly string\[\]\): Promise<void> => \(jid\.endsWith\('@g\.us'\) \? anotarEnviadosConTope\(ws, jid, ids\) : Promise\.resolve\(\)\);/);
  assert.doesNotMatch(doer, /KEY_SENT/);
  // La voz, leída ESTRICTA (la otra convierte un error en «mako_ws1»): sin leerla no se anota ni se guarda en memoria.
  assert.match(doer, /const voz = await instanciaVoz\(\{ estricto: true \}\)\.catch\(\(\) => null\);\n\s*const deMaKo = vozPropiaDeMaKo\(voz\) === instance;\n\s*const visto = deMaKo \? NaN :/);
  assert.match(doer, /if \(voz !== null\) LINEA_DEL_DUENO\.set\(/);
  assert.match(doer, /const voz = await instanciaVoz\(\{ estricto: true \}\)\.catch\(\(\) => null\);\n\s*if \(voz === null \|\| vozPropiaDeMaKo\(voz\) === instance\) return;/);
  assert.doesNotMatch(doer, /instanciaVoz\(\)\.catch/, 'la voz se lee sin estricto');
});

test('13. el eco de MaKo en SU línea se saltea aunque su id no esté en el anillo: MaKo no se contesta sola', () => {
  // La verificación de 8c1b7fa4e: con la base lenta, el id no llegaba al anillo antes del eco (~1-2 s), el webhook se lo pasaba al
  // doer (no filtra fromMe) y MaKo le ponía 👍 y se contestaba, en bucle. En su línea no escribe ninguna persona.
  const MAKO = 'mako_superadmin_muylqv8r';
  const DUENO = 'linea_del_dueno';
  const base = { msgId: 'ABC', enviados: [] as string[] };
  // 1. El eco de MaKo en SU línea, sin el id en el anillo: es eco (no se encola, no lleva 👍, no hay turno).
  assert.equal(esEcoDeMaKo({ ...base, fromMe: true, instancia: MAKO, voz: MAKO }), true);
  // 2. En la línea del DUEÑO manda el anillo: sin el id, es el dueño escribiendo; con el id, es eco.
  assert.equal(esEcoDeMaKo({ ...base, fromMe: true, instancia: DUENO, voz: MAKO }), false);
  assert.equal(esEcoDeMaKo({ ...base, fromMe: true, instancia: DUENO, voz: MAKO, enviados: ['ABC'] }), true);
  // 3. La voz ilegible: cae al anillo, como antes.
  assert.equal(esEcoDeMaKo({ ...base, fromMe: true, instancia: MAKO, voz: null }), false);
  assert.equal(esEcoDeMaKo({ ...base, fromMe: true, instancia: MAKO, voz: null, enviados: ['ABC'] }), true);
  // 4. Lo que no es fromMe (una persona del grupo) en la línea de MaKo: no es eco, salvo que su id sea uno que mandó MaKo.
  assert.equal(esEcoDeMaKo({ ...base, fromMe: false, instancia: MAKO, voz: MAKO }), false);
  // 5. ⚠️ Con DOS líneas de MaKo en el grupo (4/11/2026, ws13): lo que manda una le llega a la otra con `fromMe: false`, como una persona.
  //    Su id está en el anillo: es eco, en cualquiera de las dos líneas. Sin el id, una persona: nunca se descarta por la línea.
  assert.equal(esEcoDeMaKo({ ...base, fromMe: false, instancia: MAKO, voz: MAKO, enviados: ['ABC'] }), true);
  assert.equal(esEcoDeMaKo({ ...base, fromMe: false, instancia: 'mako_ws9', voz: MAKO, enviados: ['ABC'] }), true);
  assert.equal(esEcoDeMaKo({ ...base, fromMe: false, instancia: 'mako_ws9', voz: MAKO }), false);
  assert.equal(esEcoDeMaKo({ ...base, msgId: '', fromMe: false, instancia: MAKO, voz: MAKO, enviados: [''] }), false, 'un id vacío no es un id del anillo');
  // Sin instancia (una cola de antes del deploy en el cron) no se compara con la voz.
  assert.equal(esEcoDeMaKo({ ...base, fromMe: true, instancia: '', voz: '' }), false);
  // El doer: UNA función para los dos chequeos, la voz leída estricta, y el eco cortado antes de encolar y del 👍.
  const doer = leer('lib/mako-doer-in.ts');
  // Sin `fromMe` también: el eco de la otra línea de MaKo no lo es (la voz sólo se lee para un `fromMe`).
  assert.match(doer, /const fromMe = !!key\?\.fromMe;\n\s*const \[voz, enviados\] = await Promise\.all\(\[fromMe \? instanciaVoz\(\{ estricto: true \}\)\.catch\(\(\) => null\) : Promise\.resolve\(null\), idsEnviados\(OWNER_WS, jid\)\]\);\n\s*return esEcoDeMaKo\(\{ fromMe, msgId: key\?\.id \?\? '', instancia: instance, voz: vozPropiaDeMaKo\(voz\), enviados \}\);/);
  assert.doesNotMatch(doer.slice(doer.indexOf('async function esEcoDeMaKoAhora('), doer.indexOf('async function esEcoDeMaKoAhora(') + 400), /if \(!key\?\.fromMe\) return false/, 'el eco de la otra línea no es fromMe');
  assert.equal((doer.match(/await esEcoDeMaKoAhora\(instance, jid, (?:data\.key|key)\)/g) ?? []).length, 2, 'los dos chequeos no usan la misma función');
  assert.doesNotMatch(doer, /enviados\.includes\(msgId\)|idsEnviados\(OWNER_WS, jid\)\)\.includes\(msgId\)/, 'volvió un chequeo del eco suelto');
  const buffer = doer.slice(doer.indexOf('async function bufferearYResponder('));
  const iEco = buffer.indexOf('if (await esEcoDeMaKoAhora(instance, jid, data.key))');
  assert.ok(iEco > 0 && iEco < buffer.indexOf('await encolar(jid,') && iEco < buffer.indexOf('reaccionarMensaje(jid, data.key, EMOJI_RECIBIDO)'), 'el eco se encola o lleva 👍');
});

// La pregunta a MaKo (4/11/2026): una charla que le habla a MaKo y pregunta no se queda en el 👍. El turno real, en
// tests/grupos-ops-turno.test.ts; acá la regla sola.
test('preguntaAMaKo: le habla y pregunta; el «gracias» y lo que es para otro, no', () => {
  const p = (texto: string, leHabla: boolean, reglasConsultan = false) => preguntaAMaKo({ texto, leHabla, reglasConsultan });
  assert.equal(p('mako estas vivo?', true), true);
  assert.equal(p('MaKo, ¿estás vivo? Es una prueba.', true), true, 'el «¿» del medio también pregunta');
  assert.equal(p('mako cuantos leads entraron hoy', true, true), true, 'sin signo, si las reglas leen una consulta');
  assert.equal(p('MaKo, gracias', true), false);
  assert.equal(p('bien ahí', false), false);
  assert.equal(p('Juan, ¿venís?', false), false, 'pregunta, pero no a MaKo');
  assert.equal(p('Juan, ¿venís?', false, true), false, 'ni con las reglas leyendo una consulta');
});

// La charla con algo adentro (12/11/2026, Mauricio en el ws1: «yo no conecte a mako» → la IA dijo charla → sólo el 👍). Los textos son
// los de producción de los 7 días anteriores y los del banco (tests/fixtures/banco-grupos-2910.json). El turno real, en
// tests/grupos-ops-turno.test.ts; acá la regla sola, y la que arma la consulta (lib/doer-hilo.ts, `laCharlaConAlgo`).
// Martín, 12/11: «no tomes absolutamente nada como charla del tipo gracias, ok, al menos que sean literalmente del tipo gracias, ok».
test('charlaQueCalla: sólo lo literal (acuse, saludo, «sí» suelto, gracias con su motivo) se queda en el 👍; lo que trae un dato se contesta', () => {
  const calla = ['gracias', 'ok 👍', 'Listo', 'ok gracias', 'Si', 'dale', 'bien ahí', 'Bien ahí por la velocidad', 'gracias por la info', 'MaKo, gracias',
    'mako, gracias, buen día', 'Buen día! Geniall', 'Buendiaa', 'perfecto, gracias', '🫡', '👍👍', 'ok gracias\n👍', 'No, gracias', 'no hace falta',
    'Excelente, gracias por la velocidad'];
  for (const t of calla) assert.equal(charlaQueCalla(t), true, t);
  const contesta = ['yo no conecte a mako', 'Hola Mako, no trabajo esa zona', 'el mail que me pediste de Sellers', 'Por aquí', 'PRUEBA',
    'automatizacion probada y funcionando correctamente mako', 'es una prueba, ya estamos 🫡', 'Si ya es la tercera vez q se contacta',
    'gracias por no avisar', 'ya lo contacté pero no contesta', 'no lo contacté', 'ok pero mañana', 'ok gracias\nyo no conecte a mako',
    'no', 'no, gracias, pero el de ayer sí',
    // Un dato, aunque sea corto (el «ya lo contacté» al aviso de un lead, del banco y de producción).
    'Respondido', 'Ya conteste', 'Si contacte Eli', 'Ya esta contactado', 'Excelente, ya le escribimos al propietario, gracias',
    // «con» no es un motivo: es un pedido.
    'dale con la campaña', 'dale por whatsapp'];
  for (const t of contesta) assert.equal(charlaQueCalla(t), false, t);
});

test('laCharlaConAlgo: la charla con algo es una consulta (con las áreas de las reglas o del hilo); el acuse y lo que no es charla, igual', () => {
  const charla = { intencion: 'charlar' as const, dudosa: false, porque: 'IA: charla («Aclara que no conectó a MaKo.»)', fuente: 'ia' as const };
  const consultaDeLasReglas = { intencion: 'consultar' as const, dudosa: false, porque: 'reglas', areas: ['integraciones' as never] };
  const v = laCharlaConAlgo(charla, consultaDeLasReglas, 'yo no conecte a mako');
  assert.equal(v.intencion, 'consultar');
  assert.equal(v.fuente, 'ia', 'sin la fuente de la IA, el turno no es de sólo lectura');
  assert.deepEqual(v.areas, ['integraciones']);
  assert.match(v.porque, /charla con algo adentro/);
  // Las reglas actúan («el mail que me pediste» leído como un pedido): una charla nunca actúa; consulta con el hilo, MaKo y el CRM.
  const w = laCharlaConAlgo(charla, { intencion: 'actuar', dudosa: false, porque: 'reglas' }, '[Te mandó 2 mensajes seguidos. Léelos juntos.]\n(1) el mail que me pediste de Sellers', ['plan']);
  assert.equal(w.intencion, 'consultar');
  assert.deepEqual(w.areas, ['plan', 'mako', 'crm']);
  // Un acuse se queda en charla; lo que no es charla no se toca.
  assert.equal(laCharlaConAlgo(charla, consultaDeLasReglas, '[Te mandó 2 mensajes seguidos. Léelos juntos.]\n(1) ok gracias\n(2) 👍'), charla);
  const pregunta = { intencion: 'consultar' as const, dudosa: false, porque: 'IA: pregunta' };
  assert.equal(laCharlaConAlgo(pregunta, consultaDeLasReglas, 'gracias'), pregunta);
  // El turno la reconoce por la marca (la nota de contestar corto): también con un resumen largo de la IA, y una pregunta no la tiene.
  assert.equal(esCharlaConAlgo(v), true);
  assert.equal(esCharlaConAlgo(laCharlaConAlgo({ ...charla, porque: `IA: charla («${'x'.repeat(260)}») · reglas: consultar` }, consultaDeLasReglas, 'PRUEBA')), true, 'el corte del porqué se llevaba la marca');
  assert.equal(esCharlaConAlgo(pregunta), false);
  // Las reglas dicen charla y el texto trae algo («PRUEBA», Martín 11/11): consulta igual. Y si las reglas lo leen como acuse, queda en charla.
  assert.equal(laCharlaConAlgo(charla, { intencion: 'charlar', dudosa: false, porque: 'saludo/charla' }, 'PRUEBA').intencion, 'consultar');
});
