// =============================================================================
// Lo que se DIBUJA en un Web Push de MaKo Mobile (lib/push-payload.ts)
// =============================================================================
// Una notificación es una superficie dibujada: título de 40 como máximo, UNA frase de 120
// como máximo, sin las marcas de WhatsApp, y un link que sale de la app por `linkApp` con el
// workspace DESTINO y la ruta traducida a su pantalla MÓVIL. Más dos decisiones del envío
// que no pasan por la red: qué endpoint se acepta (el server le hace un POST) y qué hacer
// con una suscripción según el código que contestó el servicio de push.
//
// Probado rompiéndolo (base: 13 pasan / 0 fallan), restaurando de memoria cada vez:
//   · `primeraFrase` sin la guarda de la abreviatura de una letra       → 12 / 1 («a. m.»)
//   · `renglonesLimpios` sin el corte del rótulo «━━»                     → 11 / 2
//   · `armarPayloadPush` con la ruta sin `rutaMovilOHome`                 → 12 / 1
//   · `armarPayloadPush` sin el `ws` en `linkApp`                         → 12 / 1
//   · `endpointPermitido` con `startsWith` en vez del host de `new URL`  → 12 / 1 (el «@»)
//   · `accionTrasError` borrando también un 429                           → 12 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  armarPayloadPush, primeraFrase, renglonesLimpios, tituloPush, recortar, tagDe,
  endpointPermitido, accionTrasError, plataformaDeUA, TOPE_CUERPO, TOPE_TITULO,
} from '../lib/push-payload';
import { APP_BASE_URL } from '../lib/app-url';

// El ejemplo del catálogo (lib/avisos-catalogo.ts), ficticio por regla.
const RECORDATORIO = `━━ 🗓️ REUNIÓN ━━
⏰ En 30 min tienes la *R2* con *Laura Gil* (Clínica Gil).

👉 Mira el resumen del lead:
https://hola-mako.com/crm/482/resumen

— MaKo`;

test('el cuerpo es la primera frase, sin rótulo, marcas, emojis, links ni firma', () => {
  assert.equal(primeraFrase(RECORDATORIO), 'En 30 min tienes la R2 con Laura Gil (Clínica Gil).');
  const limpios = renglonesLimpios(RECORDATORIO);
  assert.ok(!limpios.some((l) => /━|\*|https?:|MaKo$|⏰|👉/u.test(l)), `quedó basura: ${JSON.stringify(limpios)}`);
});

test('el punto de una abreviatura de una letra no corta la frase («10:00 a. m.»)', () => {
  const t = 'Mañana a las 10:00 a. m. tienes sesión con *Ana Ruiz*: 2 tareas pendientes de *Norte*:\n· Tu visión a 3 años\n· Tu meta del año';
  assert.equal(primeraFrase(t), 'Mañana a las 10:00 a. m. tienes sesión con Ana Ruiz: 2 tareas pendientes de Norte');
  // Un monto con punto no es borde de frase.
  assert.equal(primeraFrase('Vas US$15.217 abajo de lo esperado. Revísalo hoy.'), 'Vas US$15.217 abajo de lo esperado.');
});

test('un cuerpo largo se corta en una palabra entera, con «…», dentro del techo', () => {
  const largo = 'Hay ' + Array.from({ length: 40 }, (_, i) => `palabra${i}`).join(' ') + ' y fin';
  const c = primeraFrase(largo);
  assert.ok(c.length <= TOPE_CUERPO, `${c.length} > ${TOPE_CUERPO}`);
  assert.ok(c.endsWith('…'));
  assert.match(c.slice(0, -1), /palabra\d+$/, 'cortó una palabra a la mitad');
  assert.equal(recortar('corto', 10), 'corto');
});

test('el título: sin marcas ni emojis, con su techo', () => {
  assert.equal(tituloPush('🗓️ *Reunión agendada*'), 'Reunión agendada');
  const t = tituloPush('Leads que pasaron el plazo de su etapa en el embudo principal');
  assert.ok(t.length <= TOPE_TITULO && t.endsWith('…'), t);
  assert.equal(tituloPush(''), 'MaKo');
});

test('las marcas se sacan sólo en borde de palabra: un guion bajo de un nombre queda', () => {
  assert.deepEqual(renglonesLimpios('_Ojo_: el archivo mi_reporte.pdf ~tachado~ `código`'), ['Ojo: el archivo mi_reporte.pdf tachado código']);
});

test('el link sale por linkApp, con el workspace DESTINO y la pantalla MÓVIL', () => {
  const p = armarPayloadPush({ tipo: 'reunion-nuevo-agendado', titulo: 'Reunión agendada', cuerpo: RECORDATORIO, ruta: '/crm/482/resumen' }, 13);
  assert.equal(p.url, `${APP_BASE_URL}/crm/482?ws=13`);
  // El link por default de un aviso es una pantalla de escritorio: se traduce.
  assert.equal(armarPayloadPush({ tipo: 'x', titulo: 'x', cuerpo: 'x', ruta: '/configuraciones?tab=notif' }, 9).url, `${APP_BASE_URL}/perfil?ws=9`);
  // Las pendientes van a la bandeja móvil; sin ruta, la home.
  assert.equal(armarPayloadPush({ tipo: 'mako-pendiente', titulo: 'x', cuerpo: 'x', ruta: '/mako/pendientes' }, 1).url, `${APP_BASE_URL}/mako/pendientes?ws=1`);
  assert.equal(armarPayloadPush({ tipo: 'x', titulo: 'x', cuerpo: 'x' }, 1).url, `${APP_BASE_URL}/general?ws=1`);
  // Una pantalla que no va al teléfono cae en la home, nunca en una de escritorio.
  assert.equal(armarPayloadPush({ tipo: 'x', titulo: 'x', cuerpo: 'x', ruta: '/whatsapp' }, 1).url, `${APP_BASE_URL}/general?ws=1`);
  // v2 (11/10/2026): Ads Manager SÍ tiene pantalla en el teléfono (More → Ads Manager).
  assert.equal(armarPayloadPush({ tipo: 'x', titulo: 'x', cuerpo: 'x', ruta: '/ads-manager' }, 1).url, `${APP_BASE_URL}/ads-manager?ws=1`);
  // Un aviso sin link propio abre la pestaña Avisos del Inbox: la query de una ruta /m viaja.
  assert.equal(armarPayloadPush({ tipo: 'x', titulo: 'x', cuerpo: 'x', ruta: '/m/inbox?vista=avisos' }, 1).url, `${APP_BASE_URL}/mako/pendientes?vista=avisos&ws=1`);
});

test('el tag: el que se pide, o el tipo; sin espacios y corto', () => {
  assert.equal(armarPayloadPush({ tipo: 'mako-pendiente', titulo: 'x', cuerpo: 'x' }, 1).tag, 'mako-pendiente');
  assert.equal(armarPayloadPush({ tipo: 'x', titulo: 'x', cuerpo: 'x', tag: 'aviso:reunion:abc 1' }, 1).tag, 'aviso:reunion:abc-1');
  assert.equal(tagDe('aviso', 'k'), 'aviso:k');
  assert.ok(tagDe('x'.repeat(300)).length <= 96);
});

test('el badge viaja sólo si es un número válido', () => {
  assert.equal(armarPayloadPush({ tipo: 'x', titulo: 'x', cuerpo: 'x', badge: 3 }, 1).badge, 3);
  assert.equal('badge' in armarPayloadPush({ tipo: 'x', titulo: 'x', cuerpo: 'x', badge: Number.NaN }, 1), false);
  assert.equal('badge' in armarPayloadPush({ tipo: 'x', titulo: 'x', cuerpo: 'x' }, 1), false);
});

test('el payload entero es chico (el tope de un push es ~4 KB)', () => {
  const p = armarPayloadPush({ tipo: 'x', titulo: 'y'.repeat(500), cuerpo: 'z '.repeat(5000), ruta: '/crm/1' }, 1);
  assert.ok(JSON.stringify(p).length < 600, `${JSON.stringify(p).length}`);
});

test('sólo se aceptan endpoints de un servicio de push de verdad, por HOST', () => {
  for (const ok of [
    'https://fcm.googleapis.com/fcm/send/abc:APA91',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAA',
    'https://web.push.apple.com/QGx1',
    'https://wns2-par02p.notify.windows.com/w/?token=AwYA',
  ]) assert.equal(endpointPermitido(ok), true, ok);
  for (const malo of [
    'https://fcm.googleapis.com@evil.tld/fcm/send/x',   // su host REAL es evil.tld
    'https://fcm.googleapis.com.evil.tld/fcm/send/x',
    'https://fcm.googleapis.com:8443/fcm/send/x',
    'http://fcm.googleapis.com/fcm/send/x',
    'https://localhost/x', 'https://10.0.0.1/x', 'no es una url', '',
  ]) assert.equal(endpointPermitido(malo), false, malo);
});

test('404 y 410 borran la suscripción; cualquier otro error la deja', () => {
  assert.equal(accionTrasError(404), 'borrar');
  assert.equal(accionTrasError(410), 'borrar');
  for (const s of [400, 401, 403, 413, 429, 500, 503, null, undefined]) assert.equal(accionTrasError(s), 'fallo', String(s));
});

test('la plataforma sale del user-agent', () => {
  assert.equal(plataformaDeUA('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15'), 'ios');
  assert.equal(plataformaDeUA('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/129'), 'android');
  assert.equal(plataformaDeUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129'), 'desktop');
  assert.equal(plataformaDeUA(null), 'desktop');
});

test('un texto sin nada legible da un cuerpo vacío, no basura', () => {
  assert.equal(primeraFrase('━━ 📣 ANUNCIOS ━━\nhttps://x.y/z\n— MaKo'), '');
});
