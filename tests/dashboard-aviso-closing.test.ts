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
import { avisoDeClosing, esHojaClosing, SERVICIO_CLAUDE } from '../app/dashboard/aviso-closing';

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
  assert.equal(SERVICIO_CLAUDE, 'anthropic', 'la clave de Claude en el catálogo de integraciones');
});

// Roturas: la página sin pasar `avisoClosing`: 1 fallo. El lienzo sin `esHojaClosing(hoja)` (el aviso en toda hoja): 1 fallo.
// El link también para el closer (sin `!soloLectura`): 1 fallo.
test('escritorio: la página pregunta con la MISMA función que el cron y el lienzo lo dibuja arriba de la hoja Closing', () => {
  const pag = sinComentarios(leer('app/dashboard/page.tsx'));
  assert.match(pag, /\? conQueAnalizaElClosing\(\)\.catch\(\(\) => 'no-se' as const\)/, 'si la base no contesta, no se avisa');
  assert.match(pag, /tablero\.hojas\.some\(\(h\) => esHojaClosing\(h\)\) \|\| esHojaClosing\(agregar\)/, 'sólo se pregunta con una hoja Closing');
  // (27/10/2026: y con SU clave caída, la causa — tests/closing-hoja-ia-caida.test.ts.)
  assert.match(pag, /avisoClosing=\{avisoDeLaHojaClosing\(closing, CONECTA_TU_CLAUDE_CLOSING, avisoDeIaCaida\(caida\)\)\}/);
  const ed = sinComentarios(leer('app/dashboard/EditorInforme.tsx'));
  // 14/11/2026: y no sobre el candado de Pro (la hoja de un Esencial: tests/closing-solo-pro.test.ts).
  assert.match(ed, /\{avisoClosing && !closingConectado && esHojaClosing\(hoja\) && !cerradaPorPlan && !dueno && !enBlanco && !compartido && \(/);
  // Se conecta con EL modal de /integraciones, sin salir de la hoja (tests/integracion-sin-salir.test.ts barre los links).
  assert.match(ed, /\{!soloLectura && <BotonIntegracion servicio=\{SERVICIO_CLAUDE\} [^>]*onConectado=\{\(\) => setClosingConectado\(true\)\}>\{accionClosing\}<\/BotonIntegracion>\}/, 'el closer no conecta: sin botón');
  assert.match(ed, /accionClosing = 'Conectar Claude'/, 'sin decir otra cosa, el botón conecta Claude');
});

// Roturas: el teléfono del closer sin el aviso: 1 fallo.
test('teléfono: el closer y la hoja propia lo leen igual', () => {
  for (const f of ['app/m/dashboard/page.tsx', 'app/m/dashboard/[hoja]/page.tsx']) {
    const src = sinComentarios(leer(f));
    assert.match(src, /esHojaClosing\(h\) \? conQueAnalizaElClosing\(\)\.catch\(\(\) => 'no-se' as const\) : null/, f);
    assert.match(src, /\{aviso && <p className="m-dash-aviso" role="status">\{aviso\}<\/p>\}/, f);
  }
});
