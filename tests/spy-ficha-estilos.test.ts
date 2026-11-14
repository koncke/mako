// =============================================================================
// La ficha de una pieza de Spy trae el estilo de lo que dibuja (14/11/2026)
// =============================================================================
// Visto en producción el 14/11, en el teléfono: el guion de un reel con la clave de Apify rechazada decía «Apify rechazó tu clave
// de Spy: revísala en Integraciones» y «Revisar la clave» salía como TEXTO SUELTO, sin forma de botón. En la computadora se veía
// bien. La ficha (app/competitor-spy/DetallePieza.tsx) es la misma en los dos, pero en el teléfono va en una SheetM
// (app/m/competitor-spy/SpyM.tsx) y ahí no se carga la hoja de SpyApp, donde viven .spy-boton y .spy-error. Les pasaba igual a
// «Conectar» y «Conectar GPT» del mismo bloque, y al aviso rojo de «Hacer uno así».
//   1. cada clase de la hoja de Spy (spy-…) que la ficha pone en pantalla tiene su regla en la hoja de la ficha;
//   2. los botones del guion tienen forma de botón (los valores de SpyApp) y el error, su fondo rojo.
//
// PROBADO ROMPIÉNDOLO (14/11/2026), una rotura por vez y restaurada, con el archivo en verde (qué tests caen):
//   · sin la regla principal de los botones (quedan :hover y :disabled) → 2
//   · sin NINGUNA regla de los botones                                → 1, 2
//   · sin la regla del error                                          → 1, 2
//   · un className="spy-chip" nuevo en la ficha, sin su regla          → 1
//   · el botón sin su borde (sin el box-shadow)                       → 2
// Correr: node --import tsx --test tests/spy-ficha-estilos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../app/competitor-spy/DetallePieza.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const css = src.match(/^const CSS = `([\s\S]*?)^`;/m)?.[1] ?? '';
const codigo = src.replace(/^const CSS = `[\s\S]*?^`;/m, '');

/** La regla de un selector, tal cual (sin comentarios). */
const regla = (selector: string): string => {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const i = limpio.indexOf(`${selector}{`);
  return i < 0 ? '' : limpio.slice(i, limpio.indexOf('}', i) + 1);
};

test('1. cada clase de la hoja de Spy que la ficha pone en pantalla tiene su regla en la hoja de la ficha', () => {
  assert.ok(css.length > 1000, 'la hoja de la ficha está');
  const usadas = new Set(
    [...codigo.matchAll(/className="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((c) => c.startsWith('spy-')),
  );
  assert.ok(usadas.has('spy-boton') && usadas.has('spy-error'), `las que se usan hoy: ${[...usadas].join(', ')}`);
  const sinRegla = [...usadas].filter((c) => !new RegExp(`\\.${c}(?![\\w-])`).test(css.replace(/\/\*[\s\S]*?\*\//g, '')));
  assert.deepEqual(sinRegla, [], 'en el teléfono no se carga la hoja de SpyApp: sin su regla acá, se ven como texto');
});

test('2. los botones del guion tienen forma de botón, y el error su fondo rojo', () => {
  const boton = regla('.spyd-nota .spy-boton');
  for (const v of ['display:inline-flex', 'height:40px', 'padding:0 16px', 'border-radius:12px', 'background:var(--surface)',
    'box-shadow:inset 0 0 0 1px var(--border-strong)', 'font-weight:600']) assert.ok(boton.includes(v), `el botón: ${v}`);
  const error = regla('.spyd .spy-aviso.spy-error');
  for (const v of ['background:var(--bad-bg)', 'color:var(--bad)', 'padding:11px 14px']) assert.ok(error.includes(v), `el error: ${v}`);
  // Los tres botones de conectar del guion están dentro de una .spyd-nota: si salen de ahí, la regla ya no los alcanza.
  const guion = codigo.match(/function BloqueGuion[\s\S]*?\n}\n/)?.[0] ?? '';
  const botones = guion.match(/<BotonIntegracion [^>]*className="spy-boton"[^>]*>/g) ?? [];
  assert.equal(botones.length, 3, 'Conectar GPT, Conectar y Revisar la clave');
  assert.equal((guion.match(/<p className="spyd-nota">(?:(?!<\/p>)[\s\S])*?<BotonIntegracion /g) ?? []).length, 3, 'dentro de su nota');
});
