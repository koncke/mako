// =============================================================================
// El grupo de la app: quién entra y qué ve (3/11/2026)
// =============================================================================
// Requisito 2 de Martín: se puede invitar a usuarios de otro negocio; quien entra ve el grupo, no el resto. El hijo corre las RUTAS REALES: tests/_grupos-ops-puerta-hijo.ts.
//
// PROBADO ROMPIÉNDOLO: al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
let corrida: Record<string, any> | null = null;
let fallo: unknown = null;
function R(): Record<string, any> {
  if (corrida) return corrida;
  // Una sola vez aunque falle: cada test volvería a correr el hijo, y el archivo pasaría el tope del vigía de tandas.
  if (fallo) throw fallo;
  try { return correrElHijo(); } catch (e) { fallo = e; throw e; }
}
function correrElHijo(): Record<string, any> {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_grupos-ops-puerta-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 240_000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  corrida = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
  return corrida;
}

test('la matriz: entra quien tiene una razón; a los demás, 404, siempre el mismo', () => {
  const m = R().matriz;
  assert.equal(m.dueno, 200);
  assert.equal(m.closerSinInvitar, 404, 'closer y setter entran sólo invitados: el grupo trae plata');
  assert.equal(m.ajeno, 404);
  assert.equal(m.agenciaAdmin, 200);
  assert.equal(m.agenciaCloser, 404);
  assert.equal(m.agenciaRevocada, 404, 'revocar la cartera saca sola a la agencia');
  assert.equal(m.superAdmin, 200);
  assert.equal(m.pausado, 404);
  assert.equal(m.superEnPausado, 200);
  assert.equal(m.sinSesion, 404);
  assert.equal(m.sinSubNumerico, 404, 'una sesión sin fila no es una persona');
  assert.equal(m.ajenoConQueryWs, 404, '?ws= es decorativo');
  assert.equal(m.wsInvalido, 404);
});

test('una lectura que falla cierra SU camino, no los otros: fail-closed', () => {
  assert.deepEqual(R().agenciaQueTira, { agencia: 404, dueno: 200 });
  assert.equal(R().personaQueNoSeLee, 404);
});

test('⚠️ el grupo de la plataforma: sólo el rol global, y sin invitados', () => {
  const p = R().plataforma;
  assert.equal(p.leerEmpleado, 404, 'un admin de ese workspace sin el rol global leería avisos de todos los clientes');
  assert.equal(p.escribirEmpleado, 404);
  assert.equal(p.invitarEmpleado, 404);
  assert.equal(p.miembrosEmpleado, 404);
  assert.equal(p.leerGlobal, 200);
  assert.equal(p.invitarGlobal, 404, 'ni el super admin invita a ese grupo');
  assert.deepEqual(p.listaEmpleado, [], 'la lista no es otro camino para entrar');
  assert.equal(p.filasDeInvitados, 0);
});

test('invitar: con cuenta y sin cuenta, la MISMA respuesta, y `usuarios` no se toca', () => {
  const i = R().invitar;
  assert.deepEqual(i.conCuenta, i.sinCuenta, 'si la respuesta distingue, invitar sirve para averiguar quién usa MaKo');
  assert.equal(i.conCuenta.status, 200);
  assert.equal(i.usuariosIgual, true);
  assert.equal(i.fila.usuario_id, 201);
  assert.equal(i.fila.desde_id, 5, 'lee desde el mayor id al invitarlo');
  assert.equal(i.filaSinCuenta.usuario_id, null);
  assert.equal(i.invalido, 400);
});

test('⛔ un invitado ve desde que entró, por los tres caminos, sin los avisos a la agencia y sin los links de MaKo', () => {
  const v = R().invitado;
  assert.deepEqual(v.primeraVez.textos, ['Joan entró al grupo.'], 'recién entrado: nada de antes');
  assert.ok(v.textos.every((t: string) => !/mensaje [1-5] del ws7/.test(t)), `vio algo de antes: ${v.textos}`);
  assert.ok(v.antes.every((t: string) => !/mensaje [1-5] del ws7/.test(t)), `?antes= le trajo algo de antes: ${v.antes}`);
  assert.ok(v.despues.every((t: string) => !/mensaje [1-5] del ws7/.test(t)), `?despues= le trajo algo de antes: ${v.despues}`);
  assert.ok(!v.textos.some((t: string) => t.includes('cuenta frenada')), 'un aviso a la agencia no le llega a un invitado');
  assert.ok(v.textos.some((t: string) => t.includes('lo segundo después')));
  const conLink = v.textos.find((t: string) => t.includes('lo primero después'));
  assert.ok(conLink && !conLink.includes('hola-mako.com') && conLink.includes('(en MaKo)'), `el link abre SU negocio: ${conLink}`);
  assert.ok(v.duenoTextos.some((t: string) => t.includes('https://hola-mako.com/crm/55')), 'quien administra ve el link');
  assert.ok(v.duenoTextos.some((t: string) => t.includes('cuenta frenada')));
  assert.ok(!v.camposDelMensaje.includes('wa_message_id') && !v.camposDelMensaje.includes('usuario_id') && !v.camposDelMensaje.includes('workspace_id'), `el DTO lleva de más: ${v.camposDelMensaje}`);
  const fila = v.lista.find((g: { ws: number }) => g.ws === 7);
  assert.equal(fila.titulo, 'Grupo de Siete', 'sin el prefijo «MaKo <>»: el nombre del negocio lo controla el inquilino');
  assert.equal(fila.invitado, true);
  assert.equal(fila.administra, false);
});

test('la vista previa de quien recién entra no trae lo de antes', () => {
  const g = R().previaRecienEntrada.find((x: { ws: number }) => x.ws === 7);
  assert.equal(g.ultimo, null, `trajo: ${JSON.stringify(g.ultimo)}`);
  assert.match(g.titulo, /^Invitación de Siete$/);
  assert.equal(g.noLeidos, 0);
});

test('a un invitado no le llega ningún email; hasta que abre, nadie sabe su nombre', () => {
  const { aInvitado, aDueno } = R().miembros;
  assert.ok(!JSON.stringify(aInvitado).includes('@'), `le llegó un email: ${JSON.stringify(aInvitado)}`);
  assert.equal(aInvitado.administra, false);
  assert.deepEqual(aInvitado.sugeridos, []);
  const otraParaElDueno = aDueno.participantes.find((p: { email?: string }) => p.email === 'otra@ocho.test');
  assert.equal(otraParaElDueno.nombre, 'otra@ocho.test', 'el nombre diría que esa cuenta existe');
  const joan = aDueno.participantes.find((p: { email?: string }) => p.email === 'joan@ocho.test');
  assert.equal(joan.nombre, 'Joan', 'ya abrió');
  assert.deepEqual(aDueno.sugeridos, [{ nombre: 'Cris Closer', email: 'closer@siete.test' }], 'sólo closer y setter de este negocio');
  assert.ok(aDueno.participantes.some((p: { porQue?: string }) => p.porQue === 'Administra su agencia'));
  assert.ok(!JSON.stringify(aDueno).includes('martin@mako.test'), 'el super admin no figura');
});

test('⛔ los ids son globales: el archivo no sale de su negocio ni de antes de entrar', () => {
  const a = R().adjunto;
  assert.equal(a.otroNegocio, 404, 'adjunto/6 es de otro negocio');
  assert.equal(a.invitadoOtroNegocio, 404);
  assert.equal(a.invitadoDeAntes, 404, 'el archivo 5 es de antes de su `desde_id`');
  assert.equal(a.duenoDeAntes.status, 302);
  assert.match(a.duenoDeAntes.body.location, /grupos\/7\/viejo\.pdf/);
  assert.equal(a.ajenoAlGrupo, 404);
  assert.equal(a.sacadoDeOtro, 302, 'el archivo de su propio negocio sí');
});

test('⛔ la cita no sale del negocio ni de antes de entrar: 404, y no se escribe', () => {
  const c = R().cita;
  assert.equal(c.otroNegocio, 404);
  assert.equal(c.invitadoDeAntes, 404, 'MaKo le leería lo que dice ese mensaje viejo');
  assert.equal(c.invitadoOtroNegocio, 404);
  assert.equal(c.invitadoVisible, 200);
  assert.equal(c.filasConCitaMala, 0);
});

test('una cuenta creada después no entra sola; volver a invitarla la deja entrar, sin sacarla antes', () => {
  const c = R().cuentaDespues;
  assert.equal(c.sola, 404, 'no consta que el email esté verificado');
  assert.equal(c.reinvitar, 200);
  assert.equal(c.entra, 200, 'la pantalla dice «hay que invitarlo de nuevo», y eso contestaba ok sin hacer nada');
  assert.equal(c.usuario, 604);
  assert.equal(c.desdeIgualAlMayor, true, 've desde que se lo invitó de vuelta, no desde la invitación vieja');
  assert.equal(c.noCorreDesde, true, 'con cuenta y adentro, volver a invitarlo no cambia nada');
});

test('sacar: sólo quien administra; el invitado se sale él; y al salir deja de leer en el acto', () => {
  const s = R().sacar;
  assert.equal(s.invitadoSacaAOtro, 404);
  assert.equal(s.closerSaca, 404);
  assert.equal(s.invitadoInvita, 404);
  assert.equal(s.closerInvita, 404);
  assert.equal(s.duenoNoSeSale, 409);
  assert.equal(s.otraSeSale, 200);
  assert.equal(s.otraYaNoVe, 404);
  assert.equal(s.duenoSacaAJoan, 200);
  assert.equal(s.joanYaNoVe, 404);
  assert.equal(s.joanYaNoBaja, 404);
  assert.ok(s.burbujas.includes('Joan entró al grupo.') && s.burbujas.includes('Ana Dueña sacó a Joan.'), `burbujas: ${s.burbujas}`);
  assert.ok(s.burbujas.includes('Otra salió del grupo.'));
});

test('⛔ `desde_id` no falla abierto: sin poder leer el mayor id, no se invita', () => {
  assert.equal(R().desdeRoto.status, 500);
  assert.equal(R().desdeRoto.fila, null, 'con desde_id en 0 vería TODO el historial sin ningún error');
});

test('tope de invitados, y un aviso cada 24 h por email aunque lo saquen y lo vuelvan a invitar', () => {
  assert.equal(R().tope, 409);
  const a = R().avisoInvitacion;
  assert.equal(a.primero.push, 1);
  assert.equal(a.mailsPrimero, 1);
  assert.equal(a.pushesDespues, 1, 'invitar y sacar en bucle bombardea a cualquier usuario de MaKo');
  assert.equal(a.mailsDespues, 1);
  assert.equal(a.cuerpo.titulo, 'Invitación de Siete');
  assert.ok(!String(a.cuerpo.url).includes('ws='), `el push abriría SU negocio: ${a.cuerpo.url}`);
});

test('escribir: tope por minuto, reintento sin duplicar, clave tapada, nombre falso, emoji y archivos', () => {
  const r = R();
  assert.equal(r.topeMinuto.ultimo, 429);
  assert.ok(r.topeMinuto.intentos <= 31, `pasó ${r.topeMinuto.intentos}`);
  assert.deepEqual(r.reintento, { a1: 200, a2: 200, repetida: true, filas: 1, mismoId: true });
  assert.equal(r.clave.status, 200);
  assert.equal(r.clave.texto, '[clave tapada]');
  assert.equal(r.clave.enLaBase, false, 'una clave en el hilo la lee alguien de otro negocio');
  assert.equal(r.clave.cola, 0);
  assert.equal(r.clave.burbuja.length, 1);
  assert.ok(!r.clave.burbuja[0].includes('Bórrala'), 'en la app ya quedó tapada: no hay nada que borrar');
  assert.equal(r.nombreFalso.tipo, 'persona');
  assert.notEqual(r.nombreFalso.nombre, 'MaKo');
  assert.equal(r.emoji.cola, 0);
  assert.equal(r.archivos.word, 400);
  assert.equal(r.archivos.foto, 200);
  assert.equal(r.archivos.sinPath, true, 'el path del archivo no viaja al navegador');
  assert.equal(r.archivos.fotoAdjunto.listo, true);
  assert.equal(r.archivos.colaFoto, 0, 'una foto entre personas no despierta a MaKo');
  assert.equal(r.archivos.colaFotoConNombre, 1);
  assert.equal(r.nota.status, 200, 'la nota se guarda aunque el negocio no tenga IA');
  assert.equal(r.nota.adjunto.tipo, 'audio');
  assert.equal(r.nota.llamadasAIA, 0, 'el POST no la escucha');
});

test('sondear: ascendente, de a una página, con el cursor del GET; hasta vaciar', () => {
  const s = R().sondeo;
  assert.equal(s.pag1.cuantos, 60);
  assert.equal(s.pag1.primero, 'm0', 'con descendente quedaba un hueco');
  assert.equal(s.pag1.hayMas, true);
  assert.equal(s.pag2.primero, 'm60');
  assert.equal(s.pag3.cuantos, 30);
  assert.equal(s.pag3.ultimo, 'm149');
  assert.equal(s.pag3.hayMas, false);
});

test('leído: sube y no baja; el conteo no pierde lo de MaKo (`usuario_id` null)', () => {
  const l = R().leido;
  assert.equal(l.hasta, 10100, 'una pestaña vieja le bajó la marca');
  assert.equal(l.noLeidos, 49, 'con `usuario_id.neq.X` da 0 con los avisos');
  // El PostgREST de mentira deja pasar los NULL en un `neq` suelto, y SQL no: lo que importa lo dice el fuente.
  const app = readFileSync(join(RAIZ, 'lib/grupo-app.ts'), 'utf8');
  assert.match(app, /\.or\(`usuario_id\.is\.null,usuario_id\.neq\.\$\{quien\.usuarioId\}`\)/, 'SQL descarta los NULL: el contador daría 0 justo con los avisos');
});

test('lo de antes, de WhatsApp: sólo quien administra, sin el jid y sin copiar nada', () => {
  const w = R().whatsapp;
  assert.equal(w.dueno.status, 200);
  assert.equal(w.dueno.body.mensajes[0].texto, 'lo de antes');
  assert.equal(w.sinJid, true);
  assert.equal(w.invitado, 404);
  assert.equal(w.closerInvitado.hilo, 200);
  assert.equal(w.closerInvitado.wa, 404, 'el invitado no lee lo de antes de WhatsApp: no tiene autor, ni corte');
  assert.ok(w.filasNuevas <= 2, `copió filas: ${w.filasNuevas}`);
});

// PROBADO ROMPIÉNDOLO (3/11/2026): una rotura por vez sobre el código real, corriendo este archivo, y restaurada. Las 25 dieron rojo:
//   · cualquiera entra → 10 en rojo: «la matriz: entra quien tiene una razón; a los demás, 404, si»
//   · la puerta juzga el ws de la persona, no el de la URL → 9 en rojo: «la matriz: entra quien tiene una razón; a los demás, 404, si»
//   · el grupo de la plataforma es uno más → 1 en rojo: «⚠️ el grupo de la plataforma: sólo el rol global, y sin invi»
//   · la lectura de agencia que tira, abre → 1 en rojo: «una lectura que falla cierra SU camino, no los otros: fail-c»
//   · closer entra sin invitar → 3 en rojo: «la matriz: entra quien tiene una razón; a los demás, 404, si»
//   · el hilo sin desde_id para el invitado (los dos filtros) → 1 en rojo: «⛔ un invitado ve desde que entró, por los tres caminos, sin»
//   · laVeUnInvitado siempre sí → 3 en rojo: «⛔ un invitado ve desde que entró, por los tres caminos, sin»
//   · la previa sin desde_id → 1 en rojo: «la vista previa de quien recién entra no trae lo de antes»
//   · el id sin el negocio → 1 en rojo: «⛔ la cita no sale del negocio ni de antes de entrar: 404, y»
//   · la cita sin validar → 1 en rojo: «⛔ la cita no sale del negocio ni de antes de entrar: 404, y»
//   · desde_id en 0 si falla la lectura → 1 en rojo: «⛔ `desde_id` no falla abierto: sin poder leer el mayor id, n»
//   · invitar dice si hay cuenta → 1 en rojo: «invitar: con cuenta y sin cuenta, la MISMA respuesta, y `usu»
//   · los emails le llegan al invitado → 1 en rojo: «a un invitado no le llega ningún email; hasta que abre, nadi»
//   · el nombre antes de abrir → 1 en rojo: «a un invitado no le llega ningún email; hasta que abre, nadi»
//   · el invitado invita → 1 en rojo: «sacar: sólo quien administra; el invitado se sale él; y al s»
//   · sin el aviso cada 24 h → 1 en rojo: «tope de invitados, y un aviso cada 24 h por email aunque lo»
//   · sin el tope por minuto → 1 en rojo: «escribir: tope por minuto, reintento sin duplicar, clave tap»
//   · leído baja → 1 en rojo: «leído: sube y no baja; el conteo no pierde lo de MaKo (`usua»
//   · el conteo pierde lo de MaKo → 1 en rojo: «leído: sube y no baja; el conteo no pierde lo de MaKo (`usua»
//   · los links le llegan al invitado → 1 en rojo: «⛔ un invitado ve desde que entró, por los tres caminos, sin»
//   · el sondeo descendente → 1 en rojo: «sondear: ascendente, de a una página, con el cursor del GET;»
//   · lo de WhatsApp para un invitado → 1 en rojo: «lo de antes, de WhatsApp: sólo quien administra, sin el jid»
//   · la clave entra entera → 1 en rojo: «escribir: tope por minuto, reintento sin duplicar, clave tap»
//   · una foto entre personas despierta a MaKo → 1 en rojo: «escribir: tope por minuto, reintento sin duplicar, clave tap»
//   · la nota pide IA → 1 en rojo: «escribir: tope por minuto, reintento sin duplicar, clave tap»

// PROBADO ROMPIÉNDOLO (4/11/2026, la revisión): volver a invitar no le abre la puerta a la cuenta nueva → 1 en rojo; volver a invitar le corre `desde_id` a quien ya está → 1 en rojo.
