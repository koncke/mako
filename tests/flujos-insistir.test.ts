// El TECHO de la insistencia y el corte por acuse de recibo.
//
// El caso que lo pidió, textual: «ellos quieren que cuando un lead de sus clientes entre
// al CRM, MaKo en WhatsApp le reviente a mensajes insistiendo que le LLAME». La línea de
// WhatsApp que se quema es la del CLIENTE, así que el techo lo impone el producto: estos
// tests existen para que nadie lo vuelva configurable sin darse cuenta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanearInsistir, esAcuse, describirPaso,
  INSISTIR_MAX_VECES, INSISTIR_MIN_MINUTOS,
} from '../lib/flujos-tipos';

test('el techo recorta lo que el cliente pida de más', () => {
  assert.equal(sanearInsistir({ veces: 50, cadaMin: 1 }).veces, INSISTIR_MAX_VECES);
  assert.equal(sanearInsistir({ veces: 50, cadaMin: 1 }).cadaMin, INSISTIR_MIN_MINUTOS);
  // El caso literal del pedido: «reventar a mensajes» cada minuto.
  const reventar = sanearInsistir({ texto: 'LLAMALO', veces: 999, cadaMin: 0 });
  assert.equal(reventar.veces, 5);
  assert.equal(reventar.cadaMin, 30);
});

test('lo que está dentro del marco se respeta tal cual', () => {
  const p = sanearInsistir({ texto: 'x', veces: 3, cadaMin: 60 });
  assert.equal(p.veces, 3);
  assert.equal(p.cadaMin, 60);
});

test('la basura no se convierte en una insistencia infinita', () => {
  // Un NaN que cayera a 0 dejaría un bucle sin tope; un negativo, una resta.
  assert.equal(sanearInsistir({ veces: NaN, cadaMin: NaN }).veces, 1);
  assert.equal(sanearInsistir({ veces: NaN, cadaMin: NaN }).cadaMin, INSISTIR_MIN_MINUTOS);
  assert.equal(sanearInsistir({ veces: -5, cadaMin: -99 }).veces, 1);
  assert.equal(sanearInsistir({ veces: -5, cadaMin: -99 }).cadaMin, INSISTIR_MIN_MINUTOS);
  assert.equal(sanearInsistir({}).veces, 1);
  assert.equal(sanearInsistir({ veces: 2.9 }).veces, 2);
});

test('un «ok» en el grupo corta la insistencia', () => {
  for (const t of ['ok', 'OK', 'dale', 'listo', 'visto', 'lo vi', 'ya está', '👍', 'Perfecto', 'gracias']) {
    assert.equal(esAcuse(t), true, `«${t}» tiene que contar como acuse`);
  }
});

test('un mensaje largo NO es un acuse: es otra conversación', () => {
  // Si cualquier mensaje con «ok» adentro cortara, una charla del equipo apagaría el
  // aviso que justamente nadie leyó.
  assert.equal(esAcuse('ok pero antes decime si el lead ya tenía una reunión agendada con el equipo'), false);
  assert.equal(esAcuse(''), false);
  assert.equal(esAcuse('   '), false);
});

test('el paso se describe en el idioma del cliente, no en el del código', () => {
  assert.equal(
    describirPaso({ tipo: 'insistir', texto: 'x', cadaMin: 60, veces: 3 }),
    'Insistir hasta que confirmes · cada 1 h, hasta 3 veces',
  );
  assert.equal(
    describirPaso({ tipo: 'insistir', texto: 'x', cadaMin: 30, veces: 1 }),
    'Insistir hasta que confirmes · cada 30 min, hasta 1 vez',
  );
});

// ── La ventana nocturna ──────────────────────────────────────────────────────
// Lo que decide a qué hora le suena el teléfono a una persona.
import { proximaSalida, INSISTIR_VENTANA } from '../lib/flujos-tipos';

const H = (d: Date) => d.getTime();
const base = new Date('2026-09-28T12:00:00Z');

test('dentro de la franja, la próxima es exactamente el intervalo', () => {
  // 14 h local + 1 h = 15 h: adentro. Sale cuando toca, sin correrse.
  assert.equal(H(proximaSalida(base, 60, 14)), H(base) + 60 * 60_000);
  assert.equal(H(proximaSalida(base, 30, 9)), H(base) + 30 * 60_000);
});

test('de noche NO manda: se corre a la mañana', () => {
  // 22 h local + 1 h = 23 h → fuera. Espera hasta las 8 (apertura): +9 h sobre la próxima.
  const r = proximaSalida(base, 60, 22);
  assert.ok(H(r) > H(base) + 60 * 60_000, 'tiene que correrse más allá del intervalo');
  const horasCorridas = (H(r) - H(base) - 60 * 60_000) / 3_600_000;
  assert.equal(horasCorridas, 9);
});

test('el borde de la franja: la hora de cierre ya es noche', () => {
  // A las 21 (INSISTIR_VENTANA.hasta) NO se manda: `hasta` es exclusivo.
  const enCierre = proximaSalida(base, 60, INSISTIR_VENTANA.hasta - 1); // 20 + 1 = 21 → fuera
  assert.ok(H(enCierre) > H(base) + 60 * 60_000);
  // A las 7 + 1 = 8 (apertura) SÍ se manda: `desde` es inclusivo.
  assert.equal(H(proximaSalida(base, 60, INSISTIR_VENTANA.desde - 1)), H(base) + 60 * 60_000);
});

test('la madrugada espera a las 8, no manda a las 3', () => {
  // 2 h local + 1 h = 3 h → fuera; faltan 5 h para las 8.
  const r = proximaSalida(base, 60, 2);
  assert.equal((H(r) - H(base) - 60 * 60_000) / 3_600_000, 5);
});
