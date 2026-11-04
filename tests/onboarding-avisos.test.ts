// =============================================================================
// El paso obligatorio de los avisos en el onboarding (3/11/2026)
// =============================================================================
// Martín: los avisos pasan a la app, así que sin el teléfono activado no se entra. Que esté activado se MIDE (`avisosListos`), no se recuerda: si la persona lo activó antes, el paso no existe.
//
// Probado ROMPIÉNDOLO (3/11/2026), de a una, 16 roturas: el paso que no existe o que no detecta, algo escrito que lo saltea, la salida para cualquiera, el permiso fuera del toque, el cierre sin reclamar desde dos
// dispositivos, y una computadora contando como teléfono. Fallan las 16; restaurado, 19 pasan y 0 fallan. (El QR pasó a tests/link-app.test.ts.)
//
// Correr: node --import tsx --test tests/onboarding-avisos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { etapaDeArranque, leerRespuesta, mensajesDeArranque, type EstadoArranque, type HechosArranque } from '../lib/onboarding-arranque';
import { ladoDeLaPregunta, placeholderDe } from '../app/onboarding/arranque-ui';
import { CANALES, PREGUNTAS } from '../lib/fase-diagnostico';
import { AVISOS_LISTOS, AVISOS_SIN_SOPORTE, PIDE_AVISOS, PREGUNTA_AVISOS, esTelefonoDeAvisos, esTelefonoPorUA, pasoDeAvisos } from '../lib/avisos-telefono-reglas';

const RAIZ = join(import.meta.dirname, '..');
const HECHOS: HechosArranque = {
  modo: 'plan', nombreCuenta: '', nombreWorkspace: '', faseGuardada: true, canalNegocio: null, loQueVende: true, conCrm: false, conTelefono: false, terminado: false,
  conAvisos: true, avisosListos: false,
};
const TERMINO: EstadoArranque = { nombre: 'Ana', negocio: 'Acme', queHace: 'Vende', origen: 'Instagram', faseResp: PREGUNTAS.map(() => 0), canal: CANALES[0].id };
const OFERTA: HechosArranque = { ...HECHOS, modo: 'oferta', conCrm: true };
const TERMINO_OFERTA: EstadoArranque = { nombre: 'Ana', negocio: 'Acme', pdfOk: 'si', crmTipo: 'llamada' as EstadoArranque['crmTipo'], origen: 'Instagram', interes: 'leads' as EstadoArranque['interes'] };

test('sin el teléfono activado no se cierra: la etapa es los avisos', () => {
  assert.equal(etapaDeArranque(TERMINO, HECHOS), 'avisos');
  assert.equal(etapaDeArranque(TERMINO_OFERTA, OFERTA), 'avisos');
});

test('DETECTA SI YA ESTÁ: con un teléfono activado, el paso no existe', () => {
  assert.equal(etapaDeArranque(TERMINO, { ...HECHOS, avisosListos: true }), 'cierre');
  assert.equal(etapaDeArranque(TERMINO_OFERTA, { ...OFERTA, avisosListos: true }), 'cierre');
});

test('va al final, después de todo lo demás: un permiso pedido de entrada se niega', () => {
  assert.equal(etapaDeArranque({ ...TERMINO, origen: undefined }, HECHOS), 'origen');
  assert.equal(etapaDeArranque({}, HECHOS), 'nombre');
  assert.equal(etapaDeArranque({ ...TERMINO_OFERTA, interes: undefined }, OFERTA), 'interes');
});

test('⛔ si no aplica (mirando a otro, el push apagado, una lectura caída) no traba a nadie', () => {
  assert.equal(etapaDeArranque(TERMINO, { ...HECHOS, conAvisos: false }), 'cierre');
  assert.equal(etapaDeArranque(TERMINO, { ...HECHOS, conAvisos: undefined, avisosListos: undefined }), 'cierre');
});

test('un onboarding ya cerrado no vuelve atrás', () => {
  assert.equal(etapaDeArranque(TERMINO, { ...HECHOS, terminado: true }), 'listo');
});

test('la única salida es «Mi teléfono no puede»', () => {
  assert.equal(etapaDeArranque({ ...TERMINO, avisos: 'sin-soporte' }, HECHOS), 'cierre');
});

test('⛔ OBLIGATORIO: nada de lo que escriba lo saltea', () => {
  for (const texto of ['ahora no', 'listo', 'ya está', 'sí', 'omitir', 'después']) {
    const r = leerRespuesta(TERMINO, HECHOS, { texto, pregunta: PREGUNTA_AVISOS });
    assert.equal(r.ok, false, texto);
    assert.equal(r.ok === false && r.error, PIDE_AVISOS, texto);
  }
});

test('el mensaje lleva su tarjeta y NINGUNA opción para saltarlo', () => {
  const { antes, despues } = mensajesDeArranque(TERMINO, HECHOS);
  const ultimo = [...antes, ...despues].pop()!;
  assert.equal(ultimo.texto, PREGUNTA_AVISOS);
  assert.equal(ultimo.tarjeta, 'avisos');
  assert.equal(ultimo.opciones, undefined);
});

test('activado, queda dibujado en la historia; y sin soporte, también', () => {
  const con = mensajesDeArranque(TERMINO, { ...HECHOS, avisosListos: true });
  const textos = [...con.antes, ...con.despues];
  assert.ok(textos.some((m) => m.texto === AVISOS_LISTOS && m.de === 'yo'));
  assert.equal(textos.find((m) => m.texto === PREGUNTA_AVISOS)?.tarjeta, undefined, 'una tarjeta vieja siguió viva');
  const sin = mensajesDeArranque({ ...TERMINO, avisos: 'sin-soporte' }, HECHOS);
  assert.ok([...sin.antes, ...sin.despues].some((m) => m.texto === AVISOS_SIN_SOPORTE && m.de === 'yo'));
});

test('sin el paso, no se dibuja', () => {
  const r = mensajesDeArranque(TERMINO, { ...HECHOS, conAvisos: false });
  assert.ok(![...r.antes, ...r.despues].some((m) => m.texto === PREGUNTA_AVISOS));
});

test('la pregunta se dibuja del lado donde se contesta', () => {
  assert.equal(ladoDeLaPregunta('avisos', 'oferta'), 'despues');
  assert.equal(ladoDeLaPregunta('avisos', 'plan'), 'antes');
  assert.ok(placeholderDe('avisos'));
  const { despues } = mensajesDeArranque(TERMINO_OFERTA, OFERTA);
  assert.equal(despues[despues.length - 1].tarjeta, 'avisos');
  const plan = mensajesDeArranque(TERMINO, HECHOS);
  assert.equal(plan.antes[plan.antes.length - 1].tarjeta, 'avisos');
});

test('sólo un teléfono cuenta: una computadora no recibe el aviso cuando no está mirando', () => {
  assert.equal(esTelefonoDeAvisos('android'), true);
  assert.equal(esTelefonoDeAvisos('ios'), true);
  for (const p of ['desktop', '', null, undefined]) assert.equal(esTelefonoDeAvisos(p), false, String(p));
});

test('qué ve cada dispositivo', () => {
  assert.equal(esTelefonoPorUA('Mozilla/5.0 (Linux; Android 14; SM-S918B) Chrome/130', 5), true);
  assert.equal(esTelefonoPorUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', 5), true);
  assert.equal(esTelefonoPorUA('Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari', 5), true, 'el iPad moderno se presenta como Mac');
  assert.equal(esTelefonoPorUA('Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari', 0), false);
  assert.equal(esTelefonoPorUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130', 0), false);
  assert.equal(pasoDeAvisos({ telefono: null, estado: null }), 'revisando');
  assert.equal(pasoDeAvisos({ telefono: true, estado: null }), 'revisando');
  assert.equal(pasoDeAvisos({ telefono: false, estado: 'apagado' }), 'qr');
  assert.equal(pasoDeAvisos({ telefono: true, estado: 'apagado' }), 'activar');
  assert.equal(pasoDeAvisos({ telefono: true, estado: 'instalar-primero' }), 'instalar-ios');
  assert.equal(pasoDeAvisos({ telefono: true, estado: 'bloqueado' }), 'bloqueado');
  assert.equal(pasoDeAvisos({ telefono: true, estado: 'no-soportado' }), 'no-soportado');
  assert.equal(pasoDeAvisos({ telefono: true, estado: 'activo' }), 'registrando');
});

const TARJETA = readFileSync(join(RAIZ, 'app/onboarding/TarjetaAvisos.tsx'), 'utf8').replace(/\r/g, '');

test('⛔ el permiso se pide DENTRO del toque: `activarAvisos()` es lo primero del handler', () => {
  assert.match(TARJETA, /const activar = \(\) => \{\n\s*const pedido = activarAvisos\(\);/);
});

test('⛔ «Mi teléfono no puede» sólo aparece donde de verdad no puede', () => {
  // [0] es lo de antes del primer paso: ahí se declara la prop.
  const partes = TARJETA.split("{paso === '").slice(1);
  const con = partes.filter((p) => p.includes('onSinSoporte'));
  assert.equal(con.length, 1);
  assert.ok(con[0].startsWith('no-soportado'), con[0].slice(0, 40));
  assert.doesNotMatch(TARJETA, /Ahora no|Omitir|Más tarde/i);
});

test('la computadora sigue sola: la tarjeta le pregunta al server', () => {
  assert.match(TARJETA, /window\.setInterval\(onRevisar, CADA_MS\)/);
  assert.match(TARJETA, /visibilitychange/);
});

test('⛔ DOS DISPOSITIVOS: el teléfono y la computadora llegan al cierre juntos, y gana uno solo', () => {
  const ruta = readFileSync(join(RAIZ, 'app/api/onboarding/arranque/route.ts'), 'utf8').replace(/\r/g, '');
  const pantalla = readFileSync(join(RAIZ, 'app/onboarding/ChatArranque.tsx'), 'utf8').replace(/\r/g, '');
  const reclamo = ruta.indexOf('cambiarSettingSi(CLAVE_CERRANDO, previa, marca)');
  assert.ok(reclamo > 0, 'cerrar sin reclamar: dos a la vez dejan la oferta y el producto repetidos');
  assert.ok(reclamo < ruta.indexOf('const r = await cerrarArranque();', reclamo), 'se reclama ANTES de cerrar');
  assert.match(ruta, /if \(vigente \|\| !\(await cambiarSettingSi\(CLAVE_CERRANDO, previa, marca\)\)\) return NextResponse\.json\(\{ ok: true, enCurso: true,/);
  assert.match(ruta, /finally \{\n\s*await borrarSettingSi\(CLAVE_CERRANDO, marca\)/, 'sin soltarlo, un error no se puede reintentar');
  assert.match(pantalla, /if \(r\.enCurso\) \{ setPlan\('sin'\); setEsperandoCierre\(true\); return; \}/, 'el que perdió también arma el plan');
});

test('un reporte también suena en el teléfono: no pasa por emitirAviso', () => {
  const s = readFileSync(join(RAIZ, 'lib/notify.ts'), 'utf8').replace(/\r/g, '');
  assert.match(s, /await enviarPush\(wsRep, \{\n\s*tipo: idMsg,/);
  assert.match(s, /soloAdmins: true,\n\s*\}\)\.catch/, 'un reporte habla del negocio entero: va sólo a quienes administran');
});

test('quien ya terminó el onboarding lo ve en /general hasta activarlo: si no, no se puede sacar a nadie de los grupos', () => {
  const s = readFileSync(join(RAIZ, 'lib/onboarding-pendientes.ts'), 'utf8');
  assert.match(s, /estado\.status === 'done' \? await avisosDeQuienEntra\(\)/);
  assert.match(s, /return \[\.\.\.postergados, \.\.\.delTelefono\]/);
  assert.match(s, /if \(candidatos\.length === 0\) return delTelefono;/);
});
