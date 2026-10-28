// =============================================================================
// La hoja «Closing» dice POR QUÉ no analiza cuando el Claude del negocio no puede (27/10/2026)
// =============================================================================
// Leila: 193 llamadas sin analizar porque su clave de Claude se quedó sin crédito. El aviso único le llegó a su grupo
// (lib/closing-ia-caida.ts) pero la hoja seguía quieta, y ella preguntó por qué Fathom no tenía los datos de Ana. Lo que
// fija este test:
//   1. El texto: la causa, desde cuándo, el paso para arreglarlo (con el crédito de Max) y que lo que espera se analiza solo.
//   2. Cuál aviso va: sin clave, «Conecta tu Claude»; con SU clave caída, la causa; con la plataforma o sin saber, nada.
//   3. El incidente guarda cuántas esperan, y las tres páginas (escritorio y teléfono) lo leen.
// Probado rompiéndolo (27/10/2026): ver el pie.
// Correr: node --import tsx --test tests/closing-hoja-ia-caida.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { avisoDeIaCaida, conFallo, leerIaCaida, queHacerConSuIa } from '../lib/closing-ia-caida-reglas';
import { accionDeLaHojaClosing, avisoDeLaHojaClosing } from '../app/dashboard/aviso-closing';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('el texto: la causa, desde cuándo, qué hacer y que lo que espera se analiza solo', () => {
  const t = avisoDeIaCaida({ motivo: 'sin crédito', desdeDia: '8 de octubre', pendientes: 193 })!;
  assert.match(t, /^Tus llamadas no se analizan desde el 8 de octubre: tu Claude se quedó sin crédito\./);
  assert.match(t, /console\.anthropic\.com → Billing/);
  assert.match(t, /Claude Max, su crédito de API también sirve/, 'conectar su suscripción: lo que de verdad sirve es el crédito de API de Max');
  assert.match(t, /Las 193 llamadas que esperan se analizan solas cuando vuelva\.$/);
  assert.match(avisoDeIaCaida({ motivo: 'sin crédito', desdeDia: 'hoy', pendientes: 1 })!, /La llamada que espera se analiza sola/);
  assert.match(avisoDeIaCaida({ motivo: 'sin crédito', desdeDia: 'x', pendientes: null })!, /Las llamadas que esperan se analizan solas/, 'sin el número, sin inventarlo');
  assert.match(avisoDeIaCaida({ motivo: 'clave inválida', desdeDia: 'x' })!, /tu clave de Claude dejó de funcionar\. Pega una clave nueva/);
  assert.match(avisoDeIaCaida({ motivo: 'sin permiso', desdeDia: 'x' })!, /tu cuenta de Claude no deja usar tu clave/);
  assert.equal(avisoDeIaCaida(null), null);
  assert.match(queHacerConSuIa('sin crédito'), /crédito/);
});

test('cuál aviso va: sin clave, conectarla; con SU clave caída, la causa; si no es su clave o no se sabe, nada', () => {
  const caida = 'CAIDA';
  assert.equal(avisoDeLaHojaClosing('no', 'CONECTA', caida), 'CONECTA', 'sin clave, lo de siempre');
  assert.equal(avisoDeLaHojaClosing('su-clave', 'CONECTA', caida), 'CAIDA');
  assert.equal(avisoDeLaHojaClosing('su-clave', 'CONECTA', null), null, 'su clave anda: nada');
  for (const con of ['plataforma', 'no-se', null] as const) assert.equal(avisoDeLaHojaClosing(con, 'CONECTA', caida), null, `con ${con} el incidente no es de su clave`);
  assert.equal(accionDeLaHojaClosing('no'), 'Conectar Claude');
  assert.equal(accionDeLaHojaClosing('su-clave'), 'Mi clave de Claude', 'ya la tiene conectada: no se le dice «conectar»');
});

test('el incidente guarda cuántas esperan, y las tres páginas lo leen', () => {
  const m = { ...conFallo(null, 'sin crédito', '2026-10-08T10:00:00.000Z'), pendientes: 193 };
  assert.equal(leerIaCaida(JSON.stringify(m))?.pendientes, 193);
  assert.equal(leerIaCaida(JSON.stringify({ ...m, pendientes: 'muchas' }))?.pendientes, undefined, 'basura: sin número');
  const A = sinComentarios(leer('../lib/closing-ia-caida.ts'));
  assert.match(A, /const marca = \{ \.\.\.conFallo\(await iaDelNegocioCaida\(\), motivo, new Date\(\)\.toISOString\(\)\), pendientes: Math\.max\(0, Math\.floor\(pendientes\)\) \};/);
  assert.match(A, /export async function iaCaidaParaLaHoja\(\)/);
  const pag = sinComentarios(leer('../app/dashboard/page.tsx'));
  assert.match(pag, /const caidaClosing = hayHojaClosing \? iaCaidaParaLaHoja\(\) : Promise\.resolve\(null\);/);
  assert.match(pag, /avisoClosing=\{avisoDeLaHojaClosing\(closing, CONECTA_TU_CLAUDE_CLOSING, avisoDeIaCaida\(caida\)\)\}/);
  assert.match(pag, /accionClosing=\{accionDeLaHojaClosing\(closing\)\}/);
  assert.match(sinComentarios(leer('../app/dashboard/EditorInforme.tsx')), /onConectado=\{\(\) => setClosingConectado\(true\)\}>\{accionClosing\}<\/BotonIntegracion>/);
  for (const f of ['../app/m/dashboard/page.tsx', '../app/m/dashboard/[hoja]/page.tsx']) {
    const src = sinComentarios(leer(f));
    assert.match(src, /esHojaClosing\(h\) \? iaCaidaParaLaHoja\(\) : null,/, f);
    assert.match(src, /const aviso = avisoDeLaHojaClosing\(closing, CONECTA_TU_CLAUDE_CLOSING, avisoDeIaCaida\(caida\)\);/, f);
  }
  // `aviso-closing.ts` lo carga el lienzo en el navegador: sin imports de ejecución (el texto se arma en el servidor).
  assert.doesNotMatch(leer('../app/dashboard/aviso-closing.ts'), /^import (?!type )/m);
});

// Probado rompiéndolo (27/10/2026), cada rotura sola y restaurada después — 3/0 de nuevo al final. Todas dieron 1 fallo:
//   · el incidente con cualquier «con» · INVERTIDA (su clave al revés) · sin el crédito de Max · «1 llamadas» ·
//     leerIaCaida pierde el número · el incidente no guarda cuántas esperan · escritorio sin la causa · el teléfono sin
//     la causa · «Conectar Claude» a quien ya la tiene · el lienzo arrastra las reglas de IA (un import de ejecución)
