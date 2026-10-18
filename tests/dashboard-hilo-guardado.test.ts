// =============================================================================
// La conversación de «Editar con MaKo» sobrevive a recargar la página (17/10/2026)
// =============================================================================
// docs/relevo/dashboard.md, «Lo de antes que sigue abierto»: «el hilo de "Editar con MaKo" no se guarda». Se guarda en el
// navegador, liviano (sin las hojas de antes y de después) y saneado al leer (app/dashboard/hilo-guardado.ts).
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026): `liviano` que guarda el mensaje entero (con `antes`) → 1 fallo; el editor sin leer
// lo guardado al montar → 1 fallo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hilosGuardados, hilosParaGuardar, TOPE_MENSAJES } from '../app/dashboard/hilo-guardado';
import type { MensajeEdicion } from '../app/dashboard/PanelEditarMako';
import { sanearHoja } from '../lib/graficos-catalogo';

test('se guarda liviano y vuelve igual (sin las hojas, sin los pedidos de otra sesión)', () => {
  const hoja = sanearHoja({ id: 'h1', nombre: 'X', componentes: [] }, 0)!;
  const hilo: MensajeEdicion[] = [
    { k: 'yo', texto: 'Agrega los leads por semana' },
    { k: 'el', texto: 'Listo.', cambios: ['Agregué «Leads por semana»'], avisos: [], antes: hoja, aplicada: hoja },
    { k: 'error', texto: 'No pude.' },
  ];
  const guardado = JSON.stringify(hilosParaGuardar({ h1: hilo }));
  assert.ok(!guardado.includes('componentes'), 'guardó la hoja entera');
  assert.deepEqual(hilosGuardados(guardado), { h1: [hilo[0], { k: 'el', texto: 'Listo.', cambios: ['Agregué «Leads por semana»'], avisos: [] }, hilo[2]] });
  assert.deepEqual(hilosGuardados('{roto'), {});
  const largo = Array.from({ length: 50 }, (_, i): MensajeEdicion => ({ k: 'yo', texto: String(i) }));
  assert.equal(hilosParaGuardar({ h1: largo }).h1.length, TOPE_MENSAJES);
});

test('el editor lo lee al montar y lo guarda en cada cambio', () => {
  const src = readFileSync(join(__dirname, '..', 'app', 'dashboard', 'EditorInforme.tsx'), 'utf8');
  assert.match(src, /hilosGuardados\(window\.localStorage\.getItem\(CLAVE_HILOS\(informe\)\)\)/);
  assert.match(src, /window\.localStorage\.setItem\(CLAVE_HILOS\(informe\), JSON\.stringify\(hilosParaGuardar\(hilosMako\)\)\)/);
});
