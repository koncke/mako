// =============================================================================
// La casa de MaKo en Automations: adónde vuela la figura al terminar de cargar (23/10/2026)
// =============================================================================
// Martín: «la figura de MaKo luego de cargar se debe ir a su lugar como en Ops Center… En Automations se puede ir a su
// chat». El vuelo del loader (Rendimiento) busca primero `[data-mako-casa]`. Al entrar se ve la LISTA y el chat está
// escondido (0×0), así que la casa es la figura de MaKo de la cabecera de la lista, que abre ese chat. Con el chat abierto
// la cabecera se esconde y el vuelo cae en la criatura del chat (ChatMako).
//
// Correr: node --import tsx --test tests/automations-mako-casa.test.ts
// Probado rompiéndolo (23/10/2026, base 2/0): ver el pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SIM = readFileSync(new URL('../app/automations/SimuladorWhatsApp.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('la figura de MaKo de la cabecera de la lista es la casa, abre el chat y sólo está con chat posible', () => {
  const ini = SIM.indexOf('<FiltroLista filas={todasLasFilas}');
  assert.ok(ini > 0, 'no encontré la cabecera de la lista');
  const cab = SIM.slice(ini, SIM.indexOf('</div>', ini));
  assert.match(cab, /\{conChat && \(\s*<button type="button" data-mako-casa="" onClick=\{\(\) => setEnLaLista\(false\)\}/);
  assert.match(cab, /<Muneco titulo="MaKo" aspecto=\{ASPECTO_MAKO\}/);
});

test('la cabecera se esconde con el chat abierto: la casa no queda escondida a la vista del vuelo', () => {
  const i = SIM.indexOf('<FiltroLista filas={todasLasFilas}');
  const antes = SIM.slice(Math.max(0, i - 3_000), i);
  assert.match(antes, /display: verLista \? undefined : 'none' \}\}>/);
  assert.equal((SIM.match(/data-mako-casa=""/g) ?? []).length, 1, 'dos casas: el vuelo no sabría a cuál ir');
});

// ── Probado rompiéndolo (23/10/2026), de a una y restaurando. Base 2/0 ──
// R1 sin `data-mako-casa` en el botón                                        → 0/2
// R2 el botón sin `{conChat && (`                                            → 1/1
