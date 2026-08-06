// Las dos piezas que deciden si una notificación se ve/suena y cómo se llama la
// pestaña. Las dos son lógica pura y las dos fallan en silencio si se rompen: un
// pop-up que deja de aparecer no tira ningún error.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTIF_IN_APP, AVISOS_WA_EN_VIVO, REPORTES, DEFAULT_IN_APP,
  inAppActivo, normalizarInApp,
} from '../lib/notif-catalogo';
import { tituloDe } from '../lib/titulo-tab';

// ── Pop-up y sonido ───────────────────────────────────────────────────────────
test('sin preferencias cargadas todo se ve y suena', () => {
  // Vale un pop-up de más antes que perderse un mensaje mientras carga.
  assert.equal(inAppActivo(null, 'wa-mensaje', 'popup'), true);
  assert.equal(inAppActivo(null, 'wa-mensaje', 'sonido'), true);
});

test('el interruptor general apaga todo sin borrar el ajuste de cada uno', () => {
  const p = normalizarInApp({ sonido: false });
  assert.equal(inAppActivo(p, 'wa-mensaje', 'sonido'), false);
  assert.equal(inAppActivo(p, 'wa-mensaje', 'popup'), true, 'el pop-up es independiente del sonido');
  // El ajuste individual sigue en true: al volver a prender el general, vuelve.
  assert.equal(p.items['wa-mensaje'].sonido, true);
});

test('se puede apagar el sonido de UNA notificación y dejar su pop-up', () => {
  const p = normalizarInApp({ items: { 'wa-mensaje': { sonido: false } } });
  assert.equal(inAppActivo(p, 'wa-mensaje', 'sonido'), false);
  assert.equal(inAppActivo(p, 'wa-mensaje', 'popup'), true);
  assert.equal(inAppActivo(p, 'wa-plantilla', 'sonido'), true, 'no toca a las demás');
});

test('lo que nunca suena queda en false aunque venga true de la base', () => {
  const p = normalizarInApp({ items: { 'ia-uso': { sonido: true } } });
  assert.equal(p.items['ia-uso'].sonido, false);
});

test('normalizar completa todas las notificaciones del catálogo', () => {
  const p = normalizarInApp(undefined);
  for (const n of NOTIF_IN_APP) assert.ok(p.items[n.id], `falta ${n.id}`);
  assert.equal(p.popup, true);
  assert.equal(p.sonido, true);
});

test('el default no apaga nada', () => {
  assert.equal(DEFAULT_IN_APP.popup, true);
  assert.equal(DEFAULT_IN_APP.sonido, true);
});

// ── El mapa no puede tener ids repetidos ─────────────────────────────────────
// Dos filas con el mismo id serían dos interruptores para lo mismo: uno pisa al
// otro y el usuario ve uno prendido y otro apagado.
test('no hay ids repetidos en el mapa de notificaciones', () => {
  const ids = [...NOTIF_IN_APP.map((n) => n.id), ...AVISOS_WA_EN_VIVO.map((a) => a.id), ...REPORTES.map((r) => r.key)];
  assert.equal(new Set(ids).size, ids.length);
});

// ── Título de la pestaña ──────────────────────────────────────────────────────
test('el título lleva la sección donde estás parado', () => {
  assert.equal(tituloDe('/crm'), 'MaKo - CRM');
  assert.equal(tituloDe('/whatsapp'), 'MaKo - WhatsApp');
  assert.equal(tituloDe('/configuraciones'), 'MaKo - Configuraciones');
});

test('una subruta hereda el nombre de su sección', () => {
  assert.equal(tituloDe('/crm/123'), 'MaKo - CRM');
});

test('/marketing/salud gana sobre /marketing', () => {
  assert.equal(tituloDe('/marketing'), 'MaKo - Dashboard');
  assert.equal(tituloDe('/marketing/salud'), 'MaKo - Salud de Meta');
});

test('el login no anuncia sección', () => {
  assert.equal(tituloDe('/login'), 'MaKo');
});

test('una ruta sin entrada en el menú igual queda legible', () => {
  assert.equal(tituloDe('/algo-nuevo'), 'MaKo - Algo nuevo');
});

test('la marca no se repite cuando ya está en el nombre de la sección', () => {
  // "MaKo - WhatsApp de MaKo" se leía dos veces el producto.
  assert.equal(tituloDe('/mako'), 'Preguntale a MaKo');
  assert.equal(tituloDe('/agencia'), 'WhatsApp de MaKo');
});

test('la fábrica de guiones no se come el título de Admin', () => {
  // nav.ts excluye a mano /admin/guiones del item de Admin para darle el suyo;
  // si USER_NAV se evalúa antes, ese esfuerzo queda anulado.
  assert.equal(tituloDe('/admin/guiones'), 'MaKo - Guiones');
  assert.notEqual(tituloDe('/admin'), tituloDe('/admin/guiones'));
});
