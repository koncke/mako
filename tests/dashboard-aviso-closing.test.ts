// =============================================================================
// La hoja «Closing» dice «Conecta tu Claude» cuando el Closing Analyst no tiene con qué analizar (IA12, 22/10/2026)
// =============================================================================
// `conQueAnalizaElClosing` (lib/closing.ts) contesta 'no' cuando no hay su Claude ni el permiso de la plataforma: las
// llamadas nuevas no se analizan. La hoja lo dice arriba, fija, con el link a Integraciones. Con 'no-se' (la base no
// contestó) se calla. La regla se EJECUTA (app/dashboard/aviso-closing.ts); las páginas se leen del fuente.
// Probado ROMPIÉNDOLO (22/10/2026): cada test dice su rotura y cuántos fallos dio.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avisoDeClosing, esHojaClosing, LINK_CONECTAR_CLAUDE } from '../app/dashboard/aviso-closing';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

// Roturas: avisar también con 'no-se': 1 fallo. Mirar el nombre de la hoja en vez de su plantilla: 1 fallo.
test('el aviso sale sólo con un «no» seguro, y sólo en la hoja que nació de la plantilla Closing', () => {
  assert.equal(avisoDeClosing('no', 'X'), 'X');
  for (const con of ['no-se', 'su-clave', 'plataforma', null] as const) assert.equal(avisoDeClosing(con, 'X'), null, `con ${con} no se avisa`);
  assert.equal(esHojaClosing({ plantilla: 'closing' }), true);
  assert.equal(esHojaClosing({ plantilla: 'cobranza' }), false);
  assert.equal(esHojaClosing({ nombre: 'Closing' } as { plantilla?: string }), false, 'renombrada o copiada a mano: la plantilla manda, no el nombre');
  assert.equal(esHojaClosing(null), false);
  assert.equal(LINK_CONECTAR_CLAUDE, '/integraciones?abrir=anthropic');
});

// Roturas: la página sin pasar `avisoClosing`: 1 fallo. El lienzo sin `esHojaClosing(hoja)` (el aviso en toda hoja): 1 fallo.
// El link también para el closer (sin `!soloLectura`): 1 fallo.
test('escritorio: la página pregunta con la MISMA función que el cron y el lienzo lo dibuja arriba de la hoja Closing', () => {
  const pag = sinComentarios(leer('app/dashboard/page.tsx'));
  assert.match(pag, /\? conQueAnalizaElClosing\(\)\.catch\(\(\) => 'no-se' as const\)/, 'si la base no contesta, no se avisa');
  assert.match(pag, /tablero\.hojas\.some\(\(h\) => esHojaClosing\(h\)\) \|\| esHojaClosing\(agregar\)/, 'sólo se pregunta con una hoja Closing');
  assert.match(pag, /avisoClosing=\{avisoDeClosing\(closing, CONECTA_TU_CLAUDE_CLOSING\)\}/);
  const ed = sinComentarios(leer('app/dashboard/EditorInforme.tsx'));
  assert.match(ed, /\{avisoClosing && esHojaClosing\(hoja\) && !dueno && !enBlanco && !compartido && \(/);
  assert.match(ed, /\{!soloLectura && <a href=\{conWs\(LINK_CONECTAR_CLAUDE, ws\)\}>/, 'el closer no abre Integraciones: sin link');
});

// Roturas: el teléfono del closer sin el aviso: 1 fallo.
test('teléfono: el closer y la hoja propia lo leen igual', () => {
  for (const f of ['app/m/dashboard/page.tsx', 'app/m/dashboard/[hoja]/page.tsx']) {
    const src = sinComentarios(leer(f));
    assert.match(src, /esHojaClosing\(h\) \? conQueAnalizaElClosing\(\)\.catch\(\(\) => 'no-se' as const\) : null/, f);
    assert.match(src, /\{aviso && <p className="m-dash-aviso" role="status">\{aviso\}<\/p>\}/, f);
  }
});
