// =============================================================================
// Los BOTONES de un mensaje de Instagram o Messenger, como ManyChat (24/10/2026, fase A: el motor)
// =============================================================================
// Martín (trabajo 49ff20a3): «Aun no arreglaste lo de los botones en Automations de Instagram», con la captura de un DM de
// Fiesta Music que trae «Obtener recurso». Zernio los expone (https://zernio.com/openapi.yaml v1.352.0): `buttons` en el DM
// y en la respuesta privada, y el toque vuelve en `metadata.postbackPayload`. El flujo que se copia (trabajo 36c79085):
//   comenta → DM con «Obtener recurso» → al tocarlo, «¿Te sigue?» → sí: el link · no: «Seguinos» con «Ya te sigo» → otra vez.
// Fija:
//   · la pieza pura (lib/botones-social.ts): el saneo, el `payload` de ida y vuelta, el texto que vale como toque, lo que
//     recibe Zernio, la línea que reemplaza a los botones y lo que impide publicar;
//   · el grafo: cada botón de flujo es una SALIDA (`btn:<id>`); el flujo de ManyChat ENTERO se publica, con la vuelta de
//     «Ya te sigo» a «¿Te sigue?» (el toque es la espera: no es un ciclo que el motor dé solo);
//   · el cableado (leyendo el fuente: son módulos `server-only`): el envío lleva los botones, un mensaje con botones y nada
//     abajo ESPERA el toque, el webhook lee el `postbackPayload` y lo pasa a `tocarBoton` ANTES de tratarlo como respuesta.
// Correr: node --import tsx --test tests/botones-instagram.test.ts
// ROTURAS (24/10/2026, una por vez y restaurada; base 7 / 0): `leerPayloadDeBoton` sin el prefijo → 6 / 1; `ciclosSinEspera`
// contando la flecha de un botón → 6 / 1; `puertosDe` sin los botones → 6 / 1; `avanceDesde` cerrando sin esperar el toque
// → 6 / 1; el webhook pausando antes del toque → 6 / 1; `normalizar` dejando la flecha a una tarjeta que no existe → 6 / 1;
// `eventoSocialDe` sin el `postbackPayload` → 6 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  aBotonesZernio, botonesDe, botonPorTexto, esRechazoDeBotones, invitacionPorTexto, leerPayloadDeBoton, payloadDeBoton,
  problemasDeBotones, TOPE_TEXTO_CON_BOTONES,
} from '../lib/botones-social';
import { conectarPuerto, normalizar, puertosDe, validarGrafo, type PasoGrafo } from '../lib/flujo-grafo';
import { eventoSocialDe } from '../lib/canal-social';
import { camposDelFlujo } from '../lib/nutricion-grafo-motor';
import { grafoDeSecuencia } from '../lib/flujo-conversacion';
import { idDeBotonNuevo } from '../app/automations/BotonesSocial';

const RAIZ = join(__dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n'));

/** El flujo de ManyChat para Fiesta Music, tal cual (trabajo 36c79085). */
const FLUJO_FIESTA = (): PasoGrafo[] => [
  { id: 'entrada', nodo: 'inicio', canal: 'instagram', cuerpo: '', siguiente: 'm1' },
  { id: 'm1', canal: 'instagram', cuerpo: '¡Ey! Te dejo el recurso por el que comentaste:', siguiente: null, botones: [{ id: 'b1', titulo: 'Obtener recurso', siguiente: 'c1' }] },
  { id: 'c1', canal: 'instagram', nodo: 'condicion', ramas: [{ id: 'c1r0', modo: 'todas', filas: [{ campo: 'sigue_instagram' }], siguiente: 'm2' }], si_no: 'm3' },
  { id: 'm2', canal: 'instagram', cuerpo: '¡Acá está! https://fiesta.example/recurso', siguiente: null },
  { id: 'm3', canal: 'instagram', cuerpo: 'Todavía no te veo: síguenos y toca el botón.', siguiente: null, botones: [{ id: 'b1', titulo: 'Ya te sigo', siguiente: 'c1' }] },
] as PasoGrafo[];

test('la pieza: el saneo, el payload de ida y vuelta, y sólo lo de MaKo es de MaKo', () => {
  const bs = botonesDe({ botones: [{ id: 'b1', titulo: '  Obtener recurso  ', siguiente: 'c1' }, { titulo: 'Ver la web', url: 'https://x.com' }, { titulo: '' }, 'basura', { id: 'b1', titulo: 'Otro con el mismo id' }] });
  assert.deepEqual(bs, [
    { id: 'b1', titulo: 'Obtener recurso', siguiente: 'c1' },
    { id: 'b2', titulo: 'Ver la web', url: 'https://x.com' },
    { id: 'b1_2', titulo: 'Otro con el mismo id', siguiente: null },
  ]);
  // La flecha a una tarjeta que ya no existe se suelta.
  assert.equal(botonesDe({ botones: [{ id: 'b1', titulo: 'A', siguiente: 'zz' }] }, new Set(['c1']))[0].siguiente, null);
  // El payload vuelve igual; uno de otra herramienta (o roto) no es de MaKo.
  const p = payloadDeBoton(321, 'm1', 'b1');
  assert.equal(p, 'mako:b:321:m1:b1');
  assert.deepEqual(leerPayloadDeBoton(p), { inscripcionId: 321, nodoId: 'm1', botonId: 'b1' });
  // (Uno de otra herramienta con un prefijo del MISMO largo, «otra:b:», se leía como de MaKo si no se miraba el prefijo.)
  for (const otro of ['GET_STARTED', 'otra:b:1:m1:b1', 'mako:b:abc:m1:b1', 'mako:b:1:m1', 'mako:b:1:m1:b1:extra', '', null]) assert.equal(leerPayloadDeBoton(otro), null, String(otro));
  // Lo que recibe Zernio: el de flujo con su payload, el de link con su url, nunca más de 3.
  assert.deepEqual(aBotonesZernio(bs.slice(0, 2), 321, 'm1'), [
    { type: 'postback', title: 'Obtener recurso', payload: 'mako:b:321:m1:b1' },
    { type: 'url', title: 'Ver la web', url: 'https://x.com' },
  ]);
  assert.equal(aBotonesZernio([...bs, ...bs], 1, 'm1').length, 3);
});

test('cuando el botón no se vio: escribir su título ES tocarlo, y la línea que lo pide', () => {
  const bs = botonesDe({ botones: [{ id: 'b1', titulo: 'Ya te sigo', siguiente: 'c1' }, { id: 'b2', titulo: 'Web', url: 'https://x.com' }] });
  assert.equal(botonPorTexto(bs, 'ya te sigo!!')?.id, 'b1');
  assert.equal(botonPorTexto(bs, '  YA TE SIGÓ ')?.id, 'b1');
  assert.equal(botonPorTexto(bs, 'ya te sigo hace rato'), null, 'una frase no es tocar el botón');
  assert.equal(botonPorTexto(bs, 'Web'), null, 'un link no se escribe');
  assert.equal(invitacionPorTexto(bs), 'Escríbeme «Ya te sigo».');
  assert.equal(invitacionPorTexto(botonesDe({ botones: [{ titulo: 'A', siguiente: 'x' }, { titulo: 'B', siguiente: 'y' }, { titulo: 'C', siguiente: 'z' }] })), 'Escríbeme «A», «B» o «C».');
  // El rechazo de Meta por no seguir la cuenta (código 2, subcode 1545133), en el mensaje o en el cuerpo.
  assert.equal(esRechazoDeBotones(Object.assign(new Error('Zernio 400: Meta refused (subcode 1545133)'), { body: null })), true);
  assert.equal(esRechazoDeBotones(Object.assign(new Error('Zernio 400'), { body: { details: { subcode: 1545133 } } })), true);
  assert.equal(esRechazoDeBotones(new Error('Zernio 400: PLATFORM_LIMITATION')), false);
});

test('lo que impide publicar: sólo Instagram y Messenger, hasta 3, cada uno a algún lado, debajo de un texto de hasta 640', () => {
  const ok = { canal: 'instagram', botones: [{ id: 'b1', titulo: 'Obtener recurso', siguiente: 'c1' }, { id: 'b2', titulo: 'Web', url: 'https://x.com' }] };
  assert.deepEqual(problemasDeBotones(ok, 'Te dejo el recurso:', 'm1'), []);
  assert.deepEqual(problemasDeBotones({ ...ok, canal: 'whatsapp' }, 'x', 'm1'), ['m1: los botones son de Instagram y Messenger']);
  assert.match(problemasDeBotones({ canal: 'instagram', botones: [{ titulo: 'A' }] }, 'x', 'm1').join(' | '), /el botón «A» no lleva a ninguna tarjeta/);
  assert.match(problemasDeBotones({ canal: 'instagram', botones: [{ titulo: 'A', url: 'no es una url' }] }, 'x', 'm1').join(' | '), /no es una dirección web/);
  assert.match(problemasDeBotones({ canal: 'instagram', botones: [1, 2, 3, 4].map((k) => ({ titulo: `B${k}`, url: 'https://x.com' })) }, 'x', 'm1').join(' | '), /hasta 3 botones/);
  assert.match(problemasDeBotones(ok, 'x'.repeat(TOPE_TEXTO_CON_BOTONES + 1), 'm1').join(' | '), /corta el texto en 640/);
  assert.match(problemasDeBotones(ok, null, 'm1').join(' | '), /termina en un archivo/);
});

test('el grafo: cada botón de flujo es una salida, y el flujo de ManyChat ENTERO se publica', () => {
  const pasos = normalizar(FLUJO_FIESTA());
  const m1 = pasos.findIndex((p) => p.id === 'm1');
  assert.deepEqual(puertosDe(pasos, m1).map((pt) => [pt.puerto, pt.destino]), [['sig', null], ['btn:b1', 'c1']]);
  // Publicable: ni tarjetas sueltas (c1 cuelga del botón) ni «vuelve atrás sin espera» (la vuelta de «Ya te sigo» la
  // corre el toque de la persona, no el motor en la misma corrida).
  assert.deepEqual(validarGrafo(pasos), []);
  // Conectar y desconectar por el puerto del botón.
  const suelto = conectarPuerto(pasos, 'm1', 'btn:b1', null);
  assert.equal(botonesDe(suelto.find((p) => p.id === 'm1'))[0].siguiente, null);
  assert.match(validarGrafo(suelto).join(' | '), /el botón «Obtener recurso» no lleva a ninguna tarjeta/);
  // `normalizar`: un botón en una tarjeta que no es mensaje se va; la flecha a una tarjeta que no existe, también.
  const raro = normalizar([...FLUJO_FIESTA().map((p) => (p.id === 'm3' ? { ...p, botones: [{ id: 'b1', titulo: 'Ya te sigo', siguiente: 'nn' }] } : p)), { id: 'e1', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 5 }, botones: [{ titulo: 'X', siguiente: 'm1' }] } as PasoGrafo]);
  assert.equal(botonesDe(raro.find((p) => p.id === 'm3'))[0].siguiente, null);
  assert.equal('botones' in (raro.find((p) => p.id === 'e1') as object), false);
  // La QUINTA PUERTA: guardar (`camposDelFlujo`, lo que arma cada paso en `setSecuenciaPasos`) no los borra.
  assert.deepEqual(camposDelFlujo({ id: 'm1', canal: 'instagram', cuerpo: 'x', botones: [{ id: 'b1', titulo: 'Obtener recurso', siguiente: 'c1' }] }).botones, [{ id: 'b1', titulo: 'Obtener recurso', siguiente: 'c1' }]);
  // Un mensaje sin botones queda IGUAL que antes byte a byte (sin el campo).
  assert.equal('botones' in (normalizar([{ id: 'entrada', nodo: 'inicio', siguiente: 'm1' }, { id: 'm1', canal: 'instagram', cuerpo: 'Hola' }] as PasoGrafo[])[1] as object), false);
});

test('el lienzo: cada botón de flujo es una fila de la tarjeta, arriba de «Entonces», con su flecha', () => {
  const g = grafoDeSecuencia(FLUJO_FIESTA() as never, { disparador: 'Comenta tu publicación' });
  const m1 = g.nodos.find((n) => n.id === 'm1')!;
  assert.deepEqual(m1.puertos?.map((p) => [p.id, p.rotulo ?? null]), [['btn:b1', 'Obtener recurso'], ['sig', null]]);
  // La flecha del botón sale de SU fila (el puerto) y llega a «¿Te sigue?»; la de «Ya te sigo» vuelve a ella.
  assert.ok(g.aristas.some((a) => a.desde === 'm1' && a.puerto === 'btn:b1' && a.hasta === 'c1'));
  assert.ok(g.aristas.some((a) => a.desde === 'm3' && a.puerto === 'btn:b1' && a.hasta === 'c1'));
  // Un botón sin a dónde lleva lo dice la tarjeta (Publicar lo frena).
  const sinDestino = FLUJO_FIESTA().map((p) => (p.id === 'm1' ? { ...p, botones: [{ id: 'b1', titulo: 'Obtener recurso', siguiente: null }] } : p));
  assert.equal(grafoDeSecuencia(sinDestino as never, { disparador: 'x' }).nodos.find((n) => n.id === 'm1')?.advertencia, 'El botón «Obtener recurso» no lleva a ninguna tarjeta');
  // El editor: el botón nuevo toma un id que la tarjeta no usa.
  assert.equal(idDeBotonNuevo([{ id: 'b1', titulo: 'A' }, { id: 'b3', titulo: 'B' }]), 'b4');
  assert.equal(idDeBotonNuevo([]), 'b1');
});

test('el webhook lee el toque: el payload de un botón vuelve en metadata.postbackPayload', () => {
  const body = {
    event: 'message.received', timestamp: '2026-10-24T23:00:00Z', account: { accountId: 'acc1', platform: 'instagram' },
    conversation: { id: 'conv1', participantId: '178' }, metadata: { postbackPayload: 'mako:b:321:m1:b1', postbackTitle: 'Obtener recurso' },
    message: { id: 'mid1', platform: 'instagram', direction: 'incoming', text: 'Obtener recurso', sender: { id: '178' } },
  };
  const ev = eventoSocialDe(body);
  assert.ok('evento' in ev);
  assert.equal(ev.evento.postback, 'mako:b:321:m1:b1');
  assert.equal(ev.evento.subtipo, 'mensaje');
  const sin = eventoSocialDe({ ...body, metadata: {} });
  assert.ok('evento' in sin && !sin.evento.postback);
});

test('el motor: el envío lleva los botones, y un mensaje con botones y nada abajo ESPERA el toque', () => {
  const nut = leer('lib/nutricion.ts');
  assert.match(nut, /\.\.\.\(botonesDe\(paso\)\.length \? \{ botones: \{ lista: botonesDe\(paso\), inscripcionId: insc\.id, nodoId: idDe\(paso, insc\.paso_actual\) \} \} : \{\}\),/);
  assert.match(nut, /if \(j < 0 && esperaToque\(sec\.pasos\[idx\]\)\) return \{ campos: \{ paso_actual: idx, nodo_actual: idDe\(sec\.pasos\[idx\], idx\), proximo_envio_at: null, estado: 'activa' \}/);
  // El toque: compare-and-set contra lo leído y la vía rápida.
  const toque = nut.slice(nut.indexOf('export async function tocarBoton('), nut.indexOf('export async function alContestar('));
  assert.ok(toque.length > 500, 'no encontré tocarBoton');
  assert.match(toque, /\.eq\('id', f\.id\)\.eq\('estado', f\.estado\)\.eq\('updated_at', f\.updated_at\)/);
  assert.match(toque, /await viaRapidaConTurno\(leadId\)/);
  assert.match(toque, /if \(t\.payload != null && !pl\) return 'no_es';/, 'un botón de otra herramienta se trataría como de MaKo');
  // Zernio: los botones van en el DM y en la respuesta privada.
  const z = leer('lib/zernio.ts');
  assert.match(z, /if \(input\.botones\?\.length && input\.texto && !input\.adjuntoUrl\) body\.buttons = input\.botones;/);
  assert.match(z, /\.\.\.\(input\.botones\?\.length \? \{ buttons: input\.botones \} : \{\}\)/);
  // La respuesta privada: sin botones en una cuenta que ya los rechazó, y un rechazo se anota.
  const cz = leer('lib/canal-zernio.ts');
  assert.match(cz, /const comoTexto = botones\.length > 0 && await cuentaRechazaBotones\(salida\.cuentaId\);/);
  assert.match(cz, /if \(botones\.length && !comoTexto && esRechazoDeBotones\(e\)\) await anotarRechazoDeBotones\(salida\.cuentaId\);/);
});

test('el webhook: el toque va ANTES que la pausa y el disparo (no es una respuesta)', () => {
  const r = leer('app/api/webhooks/zernio/route.ts');
  const iToque = r.indexOf('tocarBotonSocial(leadId');
  const iPausa = r.indexOf('pausarRespuestaSocial(leadId');
  const iDisparo = r.indexOf('dispararEventoSocial(leadId');
  assert.ok(iToque > 0 && iToque < iPausa && iPausa < iDisparo, 'el toque tiene que ir antes que la pausa y el disparo');
  // Se mira con el toque y con un texto que puede ser el título de un botón.
  assert.match(r, /if \(postback \|\| \(r\.pausar && texto\)\) \{\n\s+try \{ toque = await runWithWorkspace\(wsFinal, \(\) => tocarBotonSocial\(leadId, postback \? \{ payload: postback \} : \{ texto \}\)\); \}/);
  assert.match(r, /if \(toque !== 'no_es'\) \{ console\.log\(.*\); return; \}/);
});
