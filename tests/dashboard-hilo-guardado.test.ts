// =============================================================================
// La conversación de «Editar con MaKo» queda en la BASE y sobrevive a recargar la página (17/10 → 22/10/2026)
// =============================================================================
// 17/10/2026: se guardaba en el navegador. 22/10/2026 (Martín: «¿Todos esos chats regresan y se quedan registrados en Ops
// Center?»): va a `chart_sessions` con la clave `dashboard:<hoja>` (app/dashboard/hilo-guardado.ts, /api/hilo-de-tab), y
// lo que quedó en el navegador se sube una vez.
//
// ⚠️ PROBADO ROMPIÉNDOLO (22/10/2026): `filasDeHilo` que guarda los avisos sin la marca «Ojo: » → 1 fallo (vuelven como
// texto); el panel sin guardar al terminar el turno → 1 fallo; el editor escribiendo otra vez en localStorage → 1 fallo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { filasDeHilo, hiloDeFilas, hilosGuardados, tituloDeHoja } from '../app/dashboard/hilo-guardado';
import type { MensajeEdicion } from '../app/dashboard/PanelEditarMako';
import { sanearHoja } from '../lib/graficos-catalogo';
import { claveDeHoja, claveDeTab } from '../lib/hilo-de-tab-reglas';

const leer = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8');

test('se guarda liviano en la base y vuelve igual (sin las hojas, sin los pedidos de otra sesión)', () => {
  const hoja = sanearHoja({ id: 'h1', nombre: 'X', componentes: [] }, 0)!;
  const hilo: MensajeEdicion[] = [
    { k: 'yo', texto: 'Agrega los leads por semana' },
    { k: 'el', texto: 'Listo.', cambios: ['Agregué «Leads por semana»'], avisos: ['Falta conectar Meta'], antes: hoja, aplicada: hoja },
    { k: 'error', texto: 'No pude.' },
    { k: 'pedido', id: 'p1', burbuja: { tipo: 'crear', pedido: 'otra', estado: 'pregunta' } as never },
  ];
  const filas = filasDeHilo(hilo);
  assert.equal(filas.length, 3, 'la burbuja de pedido no se guarda');
  assert.ok(!JSON.stringify(filas).includes('componentes'), 'guardó la hoja entera');
  assert.deepEqual(filas.map((f) => f.role), ['user', 'assistant', 'assistant']);
  assert.deepEqual(hiloDeFilas(filas), [
    hilo[0],
    { k: 'el', texto: 'Listo.', cambios: ['Agregué «Leads por semana»'], avisos: ['Falta conectar Meta'] },
    hilo[2],
  ]);
});

test('lo que quedó en el navegador de antes se lee saneado', () => {
  assert.deepEqual(hilosGuardados('{roto'), {});
  assert.deepEqual(hilosGuardados(JSON.stringify({ h1: [{ k: 'yo', texto: 'hola' }, { k: 'raro' }] })), { h1: [{ k: 'yo', texto: 'hola' }] });
});

test('la clave es la de la hoja y la acepta la ruta; el título dice de dónde viene', () => {
  assert.equal(claveDeHoja('g123abc'), 'dashboard:g123abc');
  assert.equal(claveDeTab(claveDeHoja('g123abc')), 'dashboard:g123abc');
  assert.equal(tituloDeHoja('Ventas'), 'Editar con MaKo · Ventas');
  assert.equal(tituloDeHoja(''), 'Editar con MaKo · Hoja');
});

test('el panel guarda cada turno al terminar y trae lo guardado al abrir una hoja sin hilo', () => {
  const src = leer('app', 'dashboard', 'PanelEditarMako.tsx');
  assert.match(src, /guardarEnHiloDeTab\(claveDeHoja\(enviada\.id\), tituloDeHoja\(enviada\.nombre\), filasDeHilo\(delTurno\)\)/);
  assert.match(src, /leerHiloDeTab\(claveDeHoja\(hoja\.id\)/);
});

test('el editor ya no guarda en el navegador: sube lo viejo una vez (siVacia) y lo borra', () => {
  const src = leer('app', 'dashboard', 'EditorInforme.tsx');
  assert.doesNotMatch(src, /localStorage\.setItem\(CLAVE_HILOS/);
  assert.match(src, /guardarEnHiloDeTab\(claveDeHoja\(id\), tituloDeHoja\(nombre\(id\)\), filasDeHilo\(ms\), \{ siVacia: true \}\)/);
  assert.match(src, /localStorage\.removeItem\(CLAVE_HILOS\(informe\)\)/);
});
