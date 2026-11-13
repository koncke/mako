// =============================================================================
// El pedido de los avisos al entrar (13/11/2026)
// =============================================================================
// Martín: «El número de MaKo fue baneado otra vez... vamos a implementar todo directamente dentro de MaKo». Los avisos caen en el hilo de la app y suenan como
// push, pero `push_suscripciones` tenía 0 filas: nada se lo pedía a quien ya había pasado el onboarding. <PedirAvisos> lo pide al entrar, en cualquier pantalla.
//
// Lo que fija: qué pide cada estado del navegador, dónde no se pide, que «Ahora no» calla un día y no para siempre, que el layout lo monta sólo con sesión
// propia y sin mirar la cuenta de otro, y que el permiso se pide dentro del toque.
//
// Probado ROMPIÉNDOLO (13/11/2026): ver el final del archivo.
//
// Correr: node --import tsx --test tests/pedir-avisos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { POSPONER_MS, TEXTOS_PEDIR_AVISOS, pospuesto, quePedir, rutaSinPedido } from '../lib/pedir-avisos-reglas';

const RAIZ = join(__dirname, '..');
const leer = (f: string) => readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n');
const AHORA = Date.parse('2026-11-13T12:00:00Z');
const pide = (estado: Parameters<typeof quePedir>[0]['estado'], ruta = '/general', hasta: string | null = null) => quePedir({ estado, ruta, hasta, ahora: AHORA });

test('un navegador que puede y no los tiene: se le pide activarlos', () => {
  assert.equal(pide('apagado'), 'activar');
  assert.equal(pide('apagado', '/m/crm'), 'activar');
  assert.equal(pide('apagado', '/crm/12'), 'activar');
});

test('un iPhone en una pestaña de Safari: se le pide agregar MaKo a inicio, que es lo único que le abre el push', () => {
  assert.equal(pide('instalar-primero'), 'instalar');
});

test('ya activos, bloqueados, sin soporte o sin leer todavía: no se pide nada', () => {
  for (const e of ['activo', 'bloqueado', 'no-soportado', null] as const) assert.equal(pide(e), 'nada', String(e));
});

test('donde ya hay otro pedido o todavía no se entró, no se pide', () => {
  for (const r of ['/onboarding', '/onboarding/arranque', '/login', '/login/2fa', '/app', '/m/cuenta', '/m/cuenta/avisos', '/cuenta-pausada']) {
    assert.equal(rutaSinPedido(r), true, r);
    assert.equal(pide('apagado', r), 'nada', r);
  }
  // Lo que se parece pero no es: se pide.
  for (const r of ['/general', '/apps', '/aplicaciones', '/m/cuentas-por-cobrar', '/crm']) assert.equal(rutaSinPedido(r), false, r);
});

test('«Ahora no» calla UN día, y uno vencido o ilegible no calla nada', () => {
  assert.equal(POSPONER_MS, 24 * 3600_000);
  assert.equal(pide('apagado', '/general', String(AHORA + 60_000)), 'nada');
  assert.equal(pide('apagado', '/general', String(AHORA - 1)), 'activar');
  assert.equal(pide('apagado', '/general', 'basura'), 'activar');
  assert.equal(pospuesto(null, AHORA), false);
});

test('los textos de la tarjeta son cortos y en tú', () => {
  for (const [k, v] of Object.entries(TEXTOS_PEDIR_AVISOS)) {
    assert.ok(v.split(/\s+/).length <= 8, `${k}: «${v}» es largo`);
    assert.doesNotMatch(v, /\b(activá|agregá|tenés|podés|acá)\b/i, k);
  }
});

const LAYOUT = leer('app/layout.tsx');
const TARJETA = leer('app/_components/PedirAvisos.tsx');

test('el layout lo monta con sesión PROPIA y nunca mirando la cuenta de otro (el permiso es de cada persona)', () => {
  assert.match(LAYOUT, /\{sesion && !sesion\.legacy && !vista && <PedirAvisos \/>\}/);
  // Dentro de la esquina de avisos, para apilarse con los demás en la computadora y no pisarlos.
  const esquina = LAYOUT.slice(LAYOUT.indexOf('<EsquinaAvisos>'), LAYOUT.indexOf('</EsquinaAvisos>'));
  assert.match(esquina, /<PedirAvisos \/>/);
});

test('⛔ el permiso se pide DENTRO del toque: `activarAvisos()` es lo primero del handler', () => {
  assert.match(TARJETA, /const activar = \(\) => \{\n\s*const pedido = activarAvisos\(\);/);
  assert.match(TARJETA, /onClick=\{activar\}/);
});

test('bloqueado en el toque: queda cómo destrabarlo y NO un «Activar» que ya no puede hacer nada', () => {
  assert.match(TARJETA, /r\.estado === 'bloqueado'\) \{ setBloqueado\(true\); setNota\(comoDesbloquear\(/);
  assert.match(TARJETA, /\{bloqueado \? null : pedido === 'instalar'/);
});

test('ya suscripto, vuelve a atar la fila del server a quien entró, sin pedir nada', () => {
  assert.match(TARJETA, /e === 'activo'[^\n]*asegurarRegistro\(\)/);
});

test('no es un modal: no tapa la pantalla ni la bloquea', () => {
  assert.doesNotMatch(TARJETA, /inset:\s*0|position:\s*'fixed',\s*inset|aria-modal/);
});

// PROBADO ROMPIÉNDOLO (13/11/2026), de a una y restaurando: 'apagado' que no pide, 'bloqueado' que pide, sin '/m/cuenta' en las rutas sin pedido,
// `pospuesto` que ignora la fecha, el layout sin `!vista`, un `await` antes de `activarAvisos()`, y el `asegurarRegistro` sacado. Cada una deja al menos un
// test en rojo; restaurado, todos en verde.
