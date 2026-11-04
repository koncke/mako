// =============================================================================
// Para que no nos vuelvan a banear (4/11/2026)
// =============================================================================
// Martín, después del desbaneo de la línea de MaKo: «implementa medidas para que no nos baneen, por ejemplo, en el onboarding, en lugar
// de nosotros enviarle un código de seguridad, pedirles que ellos nos envíen un mensaje primero… revisa todo». Corre sobre el código REAL
// (tests/_whatsapp-anti-ban-hijo.ts: PostgREST de mentira y un Evolution en memoria) y mira qué le llegó a WhatsApp, qué quedó guardado
// y qué salió por mail. Las reglas puras (lib/verificacion-entrante.ts, lib/mako-salida-reglas.ts), ejecutadas acá abajo.
//
// Probado ROMPIÉNDOLO (4/11/2026), de a una, sobre 24 que pasan:
//   · `decidirLlegada` sin la comparación del número (confirma desde cualquiera)          → 3 fallos
//   · `decidirCodigoTipeado` sin el corte de `entrante` (el código de la pantalla confirma) → 4 fallos
//   · `enviarTextoVozMaKo` sin la regla 1 (le escribe a quien nunca escribió)              → 1 fallo
//   · `enviarInvitacionGrupo` con el atajo de lo automático de vuelta                      → 1 fallo
//   · `cupoMismoTexto` que siempre deja pasar                                              → 1 fallo
//   · sin el tope del día en `cupoAltaDeLinea`                                             → 1 fallo
//   · `evFetch` sin el corte de `antesDeEscribir` (la línea frenada sigue mandando)        → 1 fallo
//   · `senalDeRiesgo` sin «rate-overlimit»                                                 → 2 fallos
//   · `verificarCodigoContacto` sin cortar cuando el grupo no sale                         → 1 fallo
// Restaurado: 24 pasan. ⚠️ Lo que NO cubre: dos envíos A LA VEZ que reciben la señal (el compare-and-set de `trasEscribir` es el que
// evita el segundo mail, y acá los envíos van de a uno).
//
// Correr: node --import tsx --test tests/whatsapp-anti-ban.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import {
  codigoDelTexto, codigoNuevo, decidirCodigoTipeado, decidirLlegada, linkWaMe, textoParaMandar, vistaDeEntrante, NO_SE_TIPEA,
  type EstadoVerificacion,
} from '../lib/verificacion-entrante';
import {
  MISMO_TEXTO_A_MUCHOS, NO_LE_ESCRIBE_PRIMERO, SIN_LINK_A_DESCONOCIDOS, esEscritura, frenoVigente, huellaDeTexto, instanciaDeRuta, nuevoFreno,
  pausaDeEscritura, primerMensajeOk, puedeEscribirleAPersona, senalDeRiesgo, tieneLink, textoDelFreno,
} from '../lib/mako-salida-reglas';
import { SIN_INVITACION } from '../lib/altas-en-grupos';
import { TOPE_ALTAS_DIA_LINEA } from '../lib/mako-linea-tope';

const RAIZ = join(import.meta.dirname, '..');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let R: Record<string, any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const real = (): Record<string, any> => {
  if (R) return R;
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_whatsapp-anti-ban-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 240_000,
  });
  R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length));
  return R!;
};

// ── Lo puro ──────────────────────────────────────────────────────────────────

test('el código: seis del alfabeto sin letras ambiguas, siempre con letra y número', () => {
  let i = 0;
  const azar = () => [0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.0, 0.5, 0.9, 0.1, 0.3, 0.7][i++ % 12];
  const c = codigoNuevo(azar);
  assert.match(c, /^[A-HJKMNP-Z2-9]{6}$/);
  assert.ok(/\d/.test(c) && /[A-Z]/.test(c), c);
});

test('el texto que se manda se lee de vuelta, aunque lo toquen', () => {
  assert.equal(codigoDelTexto(textoParaMandar('K7P2QX')), 'K7P2QX');
  assert.equal(codigoDelTexto('hola mako k7p2qx'), 'K7P2QX');
  assert.equal(codigoDelTexto('K7P2QX'), 'K7P2QX');
  // Una palabra común de seis letras, o seis números, no es un código: el webhook no le pregunta a la base por cada mensaje.
  assert.equal(codigoDelTexto('Hola, quiero PRUEBA gratis'), null);
  assert.equal(codigoDelTexto('mi número es 123456'), null);
  assert.equal(codigoDelTexto(''), null);
});

test('el link wa.me lleva el número de la línea y el texto escrito, y sin número no hay link', () => {
  assert.equal(linkWaMe('+54 9 341 000-0999', 'Hola MaKo, mi código es K7P2QX'), 'https://wa.me/5493410000999?text=Hola%20MaKo%2C%20mi%20c%C3%B3digo%20es%20K7P2QX');
  assert.equal(linkWaMe(null, 'x'), null);
  assert.equal(linkWaMe('123', 'x'), null);
  // El primer mensaje de esa persona a la línea no lleva links (regla 5).
  assert.equal(tieneLink(textoParaMandar('K7P2QX')), false);
});

const pendiente = (o: Partial<EstadoVerificacion> = {}): EstadoVerificacion => ({
  telefono: '5491130000111', codigo: 'K7P2QX', expira: 2_000, verificado: false, entrante: true, linea: 'mako_ws9', ...o,
});
const llega = (o: Partial<{ codigo: string; instancia: string; telefono: string | null; ahora: number }> = {}) => ({
  codigo: 'K7P2QX', instancia: 'mako_ws9', telefono: '5491130000111', ahora: 1_000, ...o,
});

test('confirma sólo desde el número que se dio, por la línea del link y antes de que venza', () => {
  assert.deepEqual(decidirLlegada(pendiente(), llega()), { tipo: 'confirmar', telefono: '5491130000111' });
  // El 9 de Argentina: es el mismo número.
  assert.equal(decidirLlegada(pendiente({ telefono: '541130000111' }), llega()).tipo, 'confirmar');
  assert.deepEqual(decidirLlegada(pendiente(), llega({ telefono: '5491130000222' })), { tipo: 'otro-numero', telefono: '5491130000222' });
  // Los mismos 10 dígitos en otro país no son el mismo número.
  assert.equal(decidirLlegada(pendiente(), llega({ telefono: '5211130000111' })).tipo, 'otro-numero');
  assert.deepEqual(decidirLlegada(pendiente(), llega({ instancia: 'mako_ws17' })), { tipo: 'ignorar', porque: 'otra-linea' });
  assert.deepEqual(decidirLlegada(pendiente(), llega({ ahora: 3_000 })), { tipo: 'ignorar', porque: 'vencido' });
  assert.deepEqual(decidirLlegada(pendiente(), llega({ telefono: null })), { tipo: 'ignorar', porque: 'sin-numero' });
  assert.deepEqual(decidirLlegada(pendiente({ verificado: true }), llega()), { tipo: 'ignorar', porque: 'ya-verificado' });
  assert.deepEqual(decidirLlegada(pendiente(), llega({ codigo: 'OTRO22' })), { tipo: 'ignorar', porque: 'no-es-este' });
  // Un pedido de antes del 4/11 (MaKo mandó el código) no se confirma por WhatsApp.
  assert.deepEqual(decidirLlegada(pendiente({ entrante: undefined }), llega()), { tipo: 'ignorar', porque: 'no-es-este' });
});

test('el código de la pantalla no se tipea: sólo vale el de un pedido de antes del 4/11', () => {
  assert.deepEqual(decidirCodigoTipeado(pendiente(), 'K7P2QX', 1_000), { ok: false, error: NO_SE_TIPEA });
  const deAntes = pendiente({ entrante: undefined, codigo: '123456' });
  assert.deepEqual(decidirCodigoTipeado(deAntes, '123456', 1_000), { ok: true });
  assert.equal(decidirCodigoTipeado(deAntes, '654321', 1_000).ok, false);
  assert.equal(decidirCodigoTipeado(deAntes, '123456', 3_000).ok, false);
});

test('la vista de la pantalla dice si espera, si llegó de otro número, si venció o si ya está', () => {
  assert.equal(vistaDeEntrante(pendiente({ numeroLinea: '5493410000999' }), 1_000)?.estado, 'esperando');
  assert.equal(vistaDeEntrante(pendiente({ otroNumero: '5491130000222' }), 1_000)?.estado, 'otro-numero');
  assert.equal(vistaDeEntrante(pendiente(), 3_000)?.estado, 'vencido');
  assert.equal(vistaDeEntrante(pendiente({ verificado: true }), 3_000)?.estado, 'verificado');
  assert.equal(vistaDeEntrante(pendiente({ entrante: undefined }), 1_000), null);
});

test('regla 1: sólo a quien escribió; «no sé» es que no', () => {
  assert.equal(puedeEscribirleAPersona({ leEscribio: true }), true);
  assert.equal(puedeEscribirleAPersona({ leEscribio: false }), false);
  assert.equal(puedeEscribirleAPersona({ leEscribio: null }), false);
  assert.deepEqual(primerMensajeOk({ texto: 'mira https://x.com', leEscribio: true }), { ok: true });
  assert.deepEqual(primerMensajeOk({ texto: 'hola', leEscribio: false }), { ok: false, motivo: NO_LE_ESCRIBE_PRIMERO });
  // Regla 5, para quien sí puede escribir primero (la línea de un cliente que prospecta): sin links.
  assert.deepEqual(primerMensajeOk({ texto: 'mira hola-mako.com/x', leEscribio: false, puedeEscribirPrimero: true }), { ok: false, motivo: SIN_LINK_A_DESCONOCIDOS });
  assert.deepEqual(primerMensajeOk({ texto: 'hola, ¿cómo estás?', leEscribio: false, puedeEscribirPrimero: true }), { ok: true });
});

test('el «escribiendo…» va con el largo, con tope y con variación', () => {
  assert.equal(pausaDeEscritura(0, 'texto', () => 0.5), 1500);
  assert.equal(pausaDeEscritura(10_000, 'texto', () => 0.5), 9000);
  assert.equal(pausaDeEscritura(100, 'texto', () => 0), Math.round(6000 * 0.8));
  assert.equal(pausaDeEscritura(100, 'texto', () => 1), Math.round(6000 * 1.2));
  assert.ok(pausaDeEscritura(1e9, 'audio', () => 1) <= 8000 * 1.2);
});

test('la huella del mismo texto ignora mayúsculas y espacios, y lo corto no cuenta', () => {
  assert.equal(huellaDeTexto('Mañana   a las 10 tenemos la revisión'), huellaDeTexto('mañana a las 10 tenemos la revisión'));
  assert.notEqual(huellaDeTexto('Mañana a las 10 tenemos la revisión'), huellaDeTexto('Mañana a las 11 tenemos la revisión'));
  assert.equal(huellaDeTexto('ok'), null);
  assert.equal(huellaDeTexto('👍'), null);
});

test('las señales de riesgo: rate-overlimit, 463 y 403 al mandar; una lectura no es señal', () => {
  const rate = { response: { message: ['rate-overlimit'] } };
  assert.equal(senalDeRiesgo({ ruta: '/message/sendText/mako_ws17', status: 500, cuerpo: rate })?.tipo, 'rate');
  assert.equal(senalDeRiesgo({ ruta: '/group/updateParticipant/mako_ws9?groupJid=x', status: 500, cuerpo: rate })?.tipo, 'rate');
  assert.equal(senalDeRiesgo({ ruta: '/message/sendText/x', status: 400, cuerpo: 'Error 463' })?.tipo, 'restringida');
  assert.equal(senalDeRiesgo({ ruta: '/message/sendText/x', status: 403, cuerpo: { error: 'Forbidden' } })?.tipo, 'bloqueo');
  // Leer un grupo donde la línea no es admin, o la base de Evolution: no dice nada de la cuenta.
  assert.equal(senalDeRiesgo({ ruta: '/group/participants/x?groupJid=y', status: 403, cuerpo: 'forbidden' }), null);
  assert.equal(senalDeRiesgo({ ruta: '/chat/findMessages/x', status: 500, cuerpo: rate }), null);
  // Un 403 al sumar a alguien al grupo es la privacidad de esa persona, no la cuenta.
  assert.equal(senalDeRiesgo({ ruta: '/group/updateParticipant/x', status: 403, cuerpo: {} }), null);
  assert.equal(senalDeRiesgo({ ruta: '/message/sendText/x', status: 201, cuerpo: rate }), null);
  assert.equal(senalDeRiesgo({ ruta: '/message/sendText/x', status: 400, cuerpo: 'Ese número no existe' }), null);
  assert.equal(esEscritura('/instance/fetchInstances?instanceName=x'), false);
  assert.equal(instanciaDeRuta('/message/sendText/mako%5Fws9?x=1'), 'mako_ws9');
});

test('el freno vence a su hora, y uno ilegible no frena', () => {
  const f = nuevoFreno({ tipo: 'rate', pausaMin: 30 }, '/message/sendText/x?y', 0);
  assert.equal(f.hasta, new Date(30 * 60_000).toISOString());
  assert.equal(f.ruta, '/message/sendText/x');
  assert.ok(frenoVigente(JSON.stringify(f), 29 * 60_000));
  assert.equal(frenoVigente(JSON.stringify(f), 30 * 60_000), null);
  assert.equal(frenoVigente('no es json', 0), null);
  assert.equal(frenoVigente(JSON.stringify({ ...f, tipo: 'otro' }), 0), null);
  assert.match(textoDelFreno(f), /Frené los envíos hasta las 00:30 UTC\.$/);
});

// ── Lo real ──────────────────────────────────────────────────────────────────

test('onboarding: pedir la verificación NO le escribe a nadie, y da el link a la línea de MaKo', () => {
  const r = real();
  assert.equal(r.pedido.res.ok, true);
  assert.deepEqual(r.pedido.pedidos, [], 'ni un pedido a WhatsApp');
  assert.match(r.pedido.res.link, /^https:\/\/wa\.me\/5493410000999\?text=Hola%20MaKo%2C%20mi%20c%C3%B3digo%20es%20[A-Z0-9]{6}$/);
  assert.equal(r.pedido.estado.entrante, true);
  assert.equal(r.pedido.estado.linea, 'mako_ws9');
});

test('onboarding: el código tipeado en la app no confirma; un pedido de antes del 4/11 sí, y sin grupo no queda verificado', () => {
  const r = real();
  assert.deepEqual(r.tipeado, { ok: false, error: NO_SE_TIPEA });
  assert.deepEqual(r.deAntes, { ok: true });
  assert.equal(r.deAntesSinGrupo.res.ok, false);
  assert.equal(r.deAntesSinGrupo.verificado, false, 'queda verificado aunque el grupo no salga');
});

test('onboarding: sin el nombre del negocio todavía, el grupo nace con el del workspace', () => {
  assert.equal(real().sinNombre, 'MaKo <> Nueva');
});

test('onboarding: desde otro número o a otra línea no se confirma, y lo de otro número queda dicho', () => {
  const r = real();
  assert.equal(r.otroNumero.estado.verificado, false);
  assert.equal(r.otroNumero.estado.otroNumero, '5491130000222');
  assert.deepEqual(r.otroNumero.pedidos, []);
  assert.equal(r.otraLinea.verificado, false);
  assert.equal(r.vencido.verificado, false);
  assert.equal(r.sinCodigo, null);
});

test('onboarding: desde su número se confirma sin hablar con WhatsApp, y RECIÉN AHÍ entra al grupo', () => {
  const r = real();
  assert.equal(r.confirmado.resultado, 'ws25: confirmado');
  assert.equal(r.confirmado.estado.verificado, true);
  assert.equal(r.confirmado.vista.estado, 'verificado');
  assert.deepEqual(r.confirmado.antesDelGrupo, [], 'confirmar no le manda nada');
  // Nunca un mensaje a la persona: el grupo nace con ella adentro y la bienvenida va al grupo.
  assert.ok(r.confirmado.pedidos.some((p: { ruta: string }) => p.ruta === 'group/create'));
  for (const p of r.confirmado.pedidos as Array<{ ruta: string; a: string }>) {
    if (p.ruta.startsWith('message/')) assert.ok(p.a.endsWith('@g.us'), `un mensaje salió a ${p.a}`);
  }
  // La misma llegada otra vez no vuelve a sumar a nadie.
  assert.equal(r.otraVez.conGrupo, false);
  assert.deepEqual(r.otraVez.pedidos, []);
});

test('onboarding: con la línea de MaKo caída no inventa un link, y se puede dejar para después', () => {
  assert.equal(real().sinLinea.ok, false);
  assert.match(real().sinLinea.error, /pendiente/);
});

test('regla 1: la línea de MaKo no le escribe a quien nunca le escribió; a quien sí, sí', () => {
  const r = real();
  assert.deepEqual(r.aDesconocido.pedidos, []);
  assert.deepEqual(r.aDesconocido.res, { ok: false, error: NO_LE_ESCRIBE_PRIMERO });
  assert.equal(r.aQuienEscribio.res.ok, true);
  assert.equal(r.aQuienEscribio.pedidos[0].ruta, 'message/sendText');
});

test('regla 2: sin invitación por DM a un desconocido, aunque lo automático esté prendido', () => {
  const r = real();
  assert.deepEqual(r.invitacionAutomatica.pedidos, []);
  assert.equal(r.invitacionAutomatica.res.error, SIN_INVITACION);
});

test('regla 4: el mismo texto no sale a más de cinco chats por hora; al mismo chat, o un texto distinto, sí', () => {
  const r = real();
  assert.deepEqual(r.mismoTexto.resultados, [true, true, true, true, true, false, false]);
  assert.equal(r.mismoTexto.salieron, 5);
  assert.equal(r.mismoGrupo, true);
  assert.equal(r.otroTexto, true);
  assert.ok(MISMO_TEXTO_A_MUCHOS);
  // Los avisos a los grupos de los negocios: el sexto igual no sale, y `emitirAviso` lo manda por mail (`fallaElEnvio`).
  assert.deepEqual(r.mismoAviso, ['ok', 'ok', 'ok', 'ok', 'ok', 'por-mail']);
});

test(`regla 3: las altas de una línea topean en ${TOPE_ALTAS_DIA_LINEA} por día, aunque pase la ventana de 10 minutos`, () => {
  const a = real().altasDelDia as boolean[];
  assert.equal(a.filter(Boolean).length, TOPE_ALTAS_DIA_LINEA);
  assert.deepEqual(a.slice(TOPE_ALTAS_DIA_LINEA), [false, false]);
});

test('freno: un rate-overlimit frena la línea del cliente, el siguiente envío no llega a Evolution, y se avisa UNA vez por mail', () => {
  const f = real().frenoCliente;
  assert.equal(f.r1.ok, false);
  assert.equal(f.pedidosTras1, 1);
  assert.equal(f.pedidosTras2, 1, 'el segundo no le habló a WhatsApp');
  assert.equal(f.r2.ok, false);
  assert.match(f.r2.error, /^WhatsApp avisó que esta línea está mandando demasiado\. Frené los envíos hasta las \d\d:\d\d UTC\.$/);
  assert.equal(JSON.parse(f.freno).tipo, 'rate');
  assert.equal(f.mails.length, 1);
  assert.match(f.mails[0].subject, /mako_ws17/);
  assert.ok((f.mails[0].to as string[]).includes('equipo@cliente.test'), 'le llega al negocio de esa línea');
});

test('freno: la otra línea sigue andando, y leer sigue andando', () => {
  const r = real();
  assert.equal(r.otraLineaAnda, true);
  assert.equal(r.leerFrenada, null);
});

test('freno: un 403 al mandar por la línea de MaKo la frena, y avisa una vez', () => {
  const m = real().frenoMaKo;
  assert.equal(m.m1, false);
  assert.equal(m.m2, false);
  assert.equal(m.mails, 1);
  assert.equal(JSON.parse(m.freno).tipo, 'bloqueo');
});
