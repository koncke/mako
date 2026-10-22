// =============================================================================
// Los trabajos largos del chat: se confirman y siguen por detrás (20/10/2026, ola 1, pieza 1.11)
// =============================================================================
// docs/ops-center-principal.md §2.7. Hecho = «`replicar_landing` responde en menos de 5 s; "créame una landing para el
// webinar" termina con la miniatura en el hilo, sin recargar, aunque tarde 3 minutos; con la pestaña cerrada a mitad, al
// volver está». Lo que se fija (tests/_trabajos-hijo.ts, el camino real contra una base de mentira, con un runner que
// tarda 5,5 s):
//   1. confirmar un trabajo largo en su tarjeta responde ENSEGUIDA (menos de 5 s) con un G6 en curso, y el trabajo
//      todavía no corrió; la pantalla consulta su avance con la llave del G6, y nadie más (otra llave, otro negocio);
//   2. al terminar, ESE mensaje pasa a «Hecho: …» con el G6 terminado y su «Abrir»: lo ve quien consulta, quien vuelve con
//      la pestaña cerrada (está en el hilo) y el modelo en el turno siguiente (es el texto del mensaje);
//   3. una propuesta lenta de pantalla confirmada adentro del chat termina con su miniatura, en un solo mensaje;
//   4. la tarjeta queda «En curso», y el G6 dibuja su avance y su resultado;
//   (revisión del 21/10/2026)
//   5. el formulario del chat confirma por una RUTA de 420 s, no por la server action (que toma el techo de la página: 60 s
//      en /crm, y el trabajo de `after()` moría ahí);
//   6. uno que MUERE (la plataforma corta, o el «Hecho» final no se guarda) no queda «En curso» para siempre: pasado su
//      `hasta`, la consulta lo da por cortado, lo deja escrito y no pide repetirlo;
//   7. la pantalla no pregunta para siempre (un 404, o MAX_CONSULTAS), dibuja lo que pasó en palabras («No se pudo: …»: antes
//      era un punto rojo), y la tarjeta o el formulario que lo lanzó deja de decir «En curso»;
//   8. la tarjeta lenta de OTRO chat (o una que quien toca no puede) no anota «En curso»: contesta el error, como antes;
//   9. (la segunda revisión) un trabajo cortado se pinta «Sin saber» y su tarjeta «Revísalo», no «Falló»; y al recargar, la
//      burbuja «En curso: …» de uno que sigue no se dibuja (su G6 dice cómo termina).
//
// Probado rompiéndolo (20/10/2026, con la base en 0 fallos):
//   · `confirmarDesdeTarjeta` sin el camino de los trabajos largos → 2 fallos (1 y 2);
//   · `estadoDeTrabajo` sin mirar la llave → 1 fallo (1);
//   · `aplicarPropuestaGenerica` anotando igual con `sinAnotar` → 1 fallo (3);
//   · `trasTarjeta` sin el estado «en curso» → 1 fallo (4);
//   · (21/10) el formulario por la server action otra vez → 1 fallo (5); `estadoDeTrabajo` sin mirar `hasta` → 1 fallo (6);
//     sin dejar escrito el corte → 1 fallo (6); `leerConsulta` sin cortar ante un 404 → 1 fallo (7); sin el `texto` → 1
//     fallo (7); `itemsTrasTarjeta` sin decir de qué tarjeta es el G6 → 1 fallo (7); el teléfono sin `onTermina` → 1
//     fallo (7); `confirmarDesdeTarjeta` sin mirar de qué chat es la pendiente → 1 fallo (8);
//   · (la segunda revisión) el corte como 'fallo', como antes → 1 fallo (6); `trasTrabajo` sin el «no se sabe» → 1 fallo
//     (7); `conSusBloques` dibujando el «En curso» → 1 fallo (9).

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MAX_CONSULTAS, PLAZO_TRABAJO_MS, leerConsulta, sanearBloque, textoCortado, type Bloque } from '../lib/chat-bloques';
import { PILL_PROPUESTA, conTarjeta, itemsDeSesion, trasTarjeta, trasTrabajo, type ItemHilo } from '../app/m/mako/chat-ui';
import type { TarjetaPendiente } from '../lib/mako-turno-app-reglas';
import type { ResultadoTarjeta } from '../lib/mako-turno-app-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

type Estado = { texto: string; bloques: Bloque[] } | null;
let medido: {
  tarjeta: ResultadoTarjeta; ms: number; antes: Estado; conOtraLlave: Estado; enOtroNegocio: Estado; pendienteAntes: string;
  despuesDeCorrer: Estado; pendienteDespues: string; pantalla: Estado; hilo: { id: number; session_id: number; content: string }[]; red: string[];
  murio: { creado: number; hasta: number; antesDelPlazo: Estado; pasado: Estado; alVolver: Estado };
  ajena: { r: ResultadoTarjeta; mensajesAntes: number; mensajesDespues: number; despues: number };
} | null = null;
const medir = () => {
  medido ??= JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_trabajos-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'],
  }));
  return medido!;
};
const trabajo = (e: Estado) => e?.bloques.find((b): b is Extract<Bloque, { t: 'trabajo' }> => b.t === 'trabajo');

test('1. confirmar un trabajo largo responde enseguida, y su avance sólo lo ve quien tiene la llave', () => {
  const r = medir();
  assert.deepEqual(r.red, [], 'nada sale a la red');
  assert.ok(r.ms < 5_000, `respondió en ${r.ms} ms, con un trabajo que tarda 5,5 s`);
  assert.ok(r.tarjeta.ok && r.tarjeta.enCurso, 'la tarjeta dice que sigue por detrás');
  const g6 = r.tarjeta.ok ? r.tarjeta.bloques?.[0] : undefined;
  assert.ok(g6?.t === 'trabajo' && g6.consulta && g6.pasos.some((p) => p.estado === 'en_curso'), 'con el G6 en curso y su llave');
  assert.equal(r.pendienteAntes, 'pendiente', 'el trabajo todavía no corrió');
  assert.match(r.antes?.texto ?? '', /^En curso: /, 'en el hilo queda «En curso»');
  assert.equal(trabajo(r.antes)?.pasos.at(-1)?.estado, 'en_curso');
  assert.equal(r.conOtraLlave, null, 'con otra llave, nada');
  assert.equal(r.enOtroNegocio, null, 'desde otro negocio, nada');
});

test('2. al terminar, el mismo mensaje pasa a «Hecho» con su resultado', () => {
  const r = medir();
  assert.equal(r.pendienteDespues, 'ejecutada');
  assert.match(r.despuesDeCorrer?.texto ?? '', /^Hecho: Replicada la página\./, 'el texto que lee el modelo en el turno siguiente');
  const t = trabajo(r.despuesDeCorrer);
  assert.ok(t && t.pasos.every((p) => p.estado === 'listo'), 'el G6 terminado');
  assert.deepEqual(t?.abrir, { titulo: 'Abrir en Web Generator', href: '/web-generator/l-9' }, 'con su «Abrir», del link que devolvió');
});

test('3. una propuesta lenta de pantalla termina con su miniatura, en un solo mensaje', () => {
  const r = medir();
  const t = trabajo(r.pantalla);
  assert.match(r.pantalla?.texto ?? '', /^Hecho: Creada la landing del webinar\./);
  assert.equal(t?.listo?.miniatura, '/cv/landing.webp', 'el G6 termina en el G5, con la miniatura');
  assert.equal(r.hilo.length, 2, 'un mensaje por trabajo: el «En curso» se reescribe, no se suma otro «Hecho»');
  assert.match(leer('app/mako/revisar/[id]/acciones.ts'), /enSegundoPlano\(c\.ctx\.ws, sesion, def\.titulo,\s*\(\) => aplicarPropuestaGenerica\(id, editado, c\.ctx, \{ sinAnotar: true \}\)/, '/mako/revisar (y el formulario del chat) lo corre por detrás');
  assert.match(leer('app/api/mako/chat/route.ts'), /runWithWorkspace\(persona\.ws, \(\) => estadoDeTrabajo\(sp\.get\('trabajo'\)\)\)/, 'la pantalla consulta en el negocio de quien pregunta');
});

test('4. la tarjeta queda «En curso», y el G6 dibuja su avance y su resultado', async () => {
  const r: ResultadoTarjeta = { ok: true, resumen: 'En curso: Replicar', paraLaPersona: [], enCurso: true };
  assert.equal(trasTarjeta(r, 'confirmar').estado, 'en_curso');
  assert.equal(PILL_PROPUESTA.en_curso.texto, 'En curso');
  const { BloqueHilo } = await import('../app/_chat/BloqueHilo');
  const enCurso = sanearBloque({ t: 'trabajo', titulo: 'Replicar', consulta: '1200.AxQ9Q5F591--1t2l', pasos: [{ texto: 'Confirmado', estado: 'listo' }, { texto: 'Replicar', estado: 'en_curso' }] })!;
  assert.match(renderToStaticMarkup(createElement(BloqueHilo, { b: enCurso })), /Sigue por detrás: puedes cerrar el chat, al volver está\./);
  const listo = sanearBloque({ t: 'trabajo', titulo: 'Replicar', consulta: '1200.AxQ9Q5F591--1t2l', pasos: [{ texto: 'Replicar', estado: 'listo' }], abrir: { titulo: 'Abrir en Web Generator', href: '/web-generator/l-9' } })!;
  const html = renderToStaticMarkup(createElement(BloqueHilo, { b: listo }));
  assert.doesNotMatch(html, /Sigue por detrás/);
  assert.match(html, /href="\/web-generator\/l-9[^"]*"[^>]*>Abrir en Web Generator</);
  assert.equal((sanearBloque({ ...enCurso, consulta: '1200' }) as { consulta?: string }).consulta, undefined, 'una llave sin token no pasa');
});

test('5. el formulario del chat confirma por una ruta de 420 s, no por la server action', () => {
  const cliente = sinComentarios(leer('app/_chat/acciones-formulario.ts'));
  assert.match(cliente, /await fetch\('\/api\/mako\/propuesta', \{/, 'por la ruta');
  assert.doesNotMatch(cliente, /confirmarAccionAction|descartarAccionAction/, 'no por la server action (el techo de la página)');
  const ruta = sinComentarios(leer('app/api/mako/propuesta/route.ts'));
  assert.match(ruta, /^export const maxDuration = 420;/m, 'con el techo de la tarjeta');
  assert.ok(PLAZO_TRABAJO_MS > 420_000, 'y el plazo de un trabajo es más que ese techo');
});

test('6. un trabajo que muere no queda «En curso» para siempre', () => {
  const { murio } = medir();
  assert.ok(murio.hasta >= murio.creado + PLAZO_TRABAJO_MS && murio.hasta < murio.creado + PLAZO_TRABAJO_MS + 10_000, 'el G6 sabe hasta cuándo');
  assert.match(murio.antesDelPlazo?.texto ?? '', /^En curso: /, 'antes del plazo, sigue');
  assert.equal(trabajo(murio.antesDelPlazo)?.pasos.at(-1)?.estado, 'en_curso');
  assert.equal(murio.pasado?.texto, textoCortado('Replicar otra página'), 'pasado el plazo, se cortó');
  assert.ok(trabajo(murio.pasado)?.pasos.every((p) => p.estado !== 'en_curso'), 'y el G6 ya no dice «en curso»');
  // Cortado no es «falló» (la segunda revisión): se pinta «Sin saber», y la tarjeta «Revísalo», no en rojo.
  assert.equal(trabajo(murio.pasado)?.pasos.at(-1)?.estado, 'incierto');
  const visto = leerConsulta(200, { ok: true, ...murio.pasado }, trabajo(murio.pasado)!.consulta!);
  assert.ok(!visto.sigue && visto.ok === null, 'la pantalla no sabe si terminó');
  assert.doesNotMatch(murio.pasado?.texto ?? '', /otra vez|de nuevo y lo hago/, 'no pide repetirlo: no se sabe si se hizo');
  assert.equal(murio.alVolver?.texto, textoCortado('Replicar otra página'), 'queda escrito: lo ve quien vuelve y el modelo');
});

test('7. la pantalla no pregunta para siempre, dice lo que pasó, y la tarjeta deja de decir «En curso»', () => {
  const llave = '1200.AxQ9Q5F591--1t2l';
  const g6 = (estado: 'en_curso' | 'listo' | 'fallo') => ({ t: 'trabajo', titulo: 'Replicar', consulta: llave, pasos: [{ texto: 'Confirmado', estado: 'listo' }, { texto: 'Replicar', estado }] });
  assert.deepEqual(leerConsulta(404, { ok: false }, llave), { sigue: false, aparte: [], ok: null, texto: null }, 'un 404 corta');
  assert.equal(leerConsulta(500, { ok: false }, llave).sigue, true, 'un 500 vuelve a preguntar');
  assert.equal(leerConsulta(200, { ok: true, texto: 'En curso: Replicar', bloques: [g6('en_curso')] }, llave).sigue, true);
  const fallo = leerConsulta(200, { ok: true, texto: 'No se pudo: la página no respondió.', bloques: [g6('fallo')] }, llave);
  assert.ok(!fallo.sigue && fallo.ok === false && fallo.texto === 'No se pudo: la página no respondió.', 'la falla, en palabras');
  const listo = leerConsulta(200, { ok: true, texto: 'Hecho: Replicada.', bloques: [g6('listo')] }, llave);
  assert.ok(!listo.sigue && listo.ok === true);
  assert.ok(MAX_CONSULTAS * 15_000 > PLAZO_TRABAJO_MS, 'la pantalla se rinde DESPUÉS de que el server lo corta');
  // La tarjeta: su G6 sabe de quién es, y al terminar la tarjeta pasa a «Hecho» o «Falló».
  const t = { pendienteId: 21, tipo: 'replicar_landing', titulo: 'Replicar', resumen: 'Replicar ejemplo.com', detalle: [] } as unknown as TarjetaPendiente;
  const xs: ItemHilo[] = [{ k: 'propuesta', id: 'p21', t, estado: 'pendiente' }];
  const conG6 = conTarjeta(xs, 21, 'en_curso', undefined, { ok: true, resumen: 'En curso: Replicar', paraLaPersona: [], enCurso: true, bloques: [sanearBloque(g6('en_curso'))!] });
  const b = conG6.find((x) => x.k === 'bloque');
  assert.equal(b?.k === 'bloque' ? b.deTarjeta : undefined, 21, 'el G6 sabe de qué tarjeta es');
  const fin = trasTrabajo(conG6, 21, false).find((x) => x.k === 'propuesta');
  assert.equal(fin?.k === 'propuesta' ? fin.estado : undefined, 'fallo');
  // Cada pantalla se lo pasa a su G6, y el G6 dibuja lo que pasó.
  const hilo = sinComentarios(leer('app/_chat/BloqueHilo.tsx'));
  assert.match(hilo, /onTermina\?\.\(terminado\.ok\);/, 'el G6 avisa cuando termina, también si no se sabe cómo');
  const incierta = trasTrabajo(conG6, 21, null).find((x) => x.k === 'propuesta');
  assert.equal(incierta?.k === 'propuesta' ? incierta.estado : undefined, 'incierta', 'sin saber: la tarjeta dice «Revísalo»');
  assert.deepEqual(PILL_PROPUESTA.incierta, { texto: 'Revísalo', tono: 'warn' });
  assert.match(hilo, /\{fin\.texto \?\? \(fin\.ok == null \? 'No sé cómo terminó: recarga el chat para verlo\.' : null\)\}/, 'y lo dice en palabras');
  assert.match(sinComentarios(leer('app/_chat/HiloMako.tsx')), /onTermina=\{de != null && onTrabajo \? \(ok\) => onTrabajo\(de, ok\) : undefined\}/, 'la computadora');
  assert.match(sinComentarios(leer('app/crm/mako-crm/ChatMakoCrm.tsx')), /onTrabajo=\{\(id, ok\) => \{? ?setItems\(\(xs\) => trasTrabajo\(xs, id, ok\)\)/, 'el chat del CRM');
  // El del cliente (22/10/2026): el motor lo arma una vez (useChatCliente.ts) y el hilo de las dos pantallas lo usa (PiezasCliente.tsx).
  assert.match(sinComentarios(leer('app/second-brain/useChatCliente.ts')), /const alTerminarTrabajo = \(pendienteId: number, ok: boolean \| null\) => setItems\(\(xs\) => trasTrabajo\(xs, pendienteId, ok\)\);/, 'el Ops Center del cliente');
  assert.match(sinComentarios(leer('app/second-brain/PiezasCliente.tsx')), /onTrabajo=\{k\.alTerminarTrabajo\}/, 'el hilo del cliente');
  assert.match(sinComentarios(leer('app/crm/lead-view/MakoAnalystLead.tsx')), /setItems\(\(xs\) => trasTrabajo\(xs, de, ok\)\); refrescarFicha\(\);[\s\S]{0,200}onTermina=\{termina\}/, 'el MaKo Analyst de la ficha');
  assert.match(sinComentarios(leer('app/_chat/FormularioEnChat.tsx')), /onTermina=\{b\.t === 'trabajo' \? termina : undefined\}/, 'el formulario');
});

test('8. la tarjeta lenta de otro chat no anota «En curso»', () => {
  const { ajena } = medir();
  assert.equal(ajena.r.ok, false, 'contesta el error, como antes de la 1.11');
  assert.equal(ajena.mensajesDespues, ajena.mensajesAntes, 'sin escribir en este hilo');
  assert.equal(ajena.despues, 0, 'y sin dejar nada corriendo por detrás');
});

test('9. al recargar, la burbuja «En curso» de un trabajo que sigue no se dibuja: lo dice su G6', () => {
  const llave = '1200.AxQ9Q5F591--1t2l';
  const g6 = (estado: 'en_curso' | 'listo') => sanearBloque({ t: 'trabajo', titulo: 'Replicar', consulta: llave, pasos: [{ texto: 'Replicar', estado }] })!;
  const sigue = itemsDeSesion([{ role: 'assistant', content: 'En curso: Replicar', bloques: [g6('en_curso')] }], []);
  assert.deepEqual(sigue.map((x) => x.k), ['bloque'], 'sólo el G6, que consulta y dice cómo termina');
  const termino = itemsDeSesion([{ role: 'assistant', content: 'Hecho: Replicada la página.', bloques: [g6('listo')] }], []);
  assert.deepEqual(termino.map((x) => x.k), ['msg', 'bloque'], 'uno que ya terminó, con su «Hecho»');
});
