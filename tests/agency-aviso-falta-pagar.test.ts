// =============================================================================
// «No puedes entrar: falta pagar el mes de …» — Inspeccionar a un cliente en pausa (14/11/2026)
// =============================================================================
// Código Inmobiliario (agencia 13) no podía entrar a inspeccionar a Giselle Belanti (ws 17) ni a Marcela Fernandez (ws 23): las dos
// en pausa por la mensualidad (`plan.corte_por_pago`, motivo `paga-para-entrar`), y ningún cobro. El bloqueo era correcto; lo que
// fallaba era el aviso: la ruta daba la cookie igual, la agencia caía en /cuenta-pausada («Escribir a MaKo»), fuera de su dashboard.
// Martín: «ahí mismo debería aparecer un cartelito… no puedes entrar a inspeccionar porque te falta abonar la cuota… que sea simple».
//
// Corre la ruta REAL sobre una base de mentira (tests/_agency-aviso-falta-pagar-hijo.ts) y mira el cableado de las dos pantallas.
// Correr: node --import tsx --test tests/agency-aviso-falta-pagar.test.ts
//
// Probado rompiéndolo (14/11/2026), cada uno por separado, y vuelto atrás:
//   · sin el `if (faltaPagarParaEntrar(...))` de la ruta → falla 1 (Giselle recibe 200 y la cookie, como antes del arreglo);
//   · `faltaPagarParaEntrar` sin mirar la agencia del corte → falla 1 (al cliente pausado por OTRA agencia se le dice «falta pagar») y 2;
//   · `hacerAccion` sin el `faltaPagar(c)` → falla 3; `estadoDe(c)` sin el segundo argumento en la fila → falla 3;
//   · «Falta pagar» en el teléfono → falla 4 (y tests/agency-telefono-94.test.ts).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESTADO_FALTA_PAGAR, avisoEnPausa, avisoFaltaPagar, faltaPagarParaEntrar } from '../lib/agency-reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string): string => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_agency-aviso-falta-pagar-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
});
type Respuesta = { status: number; cuerpo: Record<string, unknown>; cookie: string };
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, Respuesta>;

test('1. la ruta de entrar: al cliente en pausa por SU mensualidad no le da la cookie y dice por qué', () => {
  const g = R['17'];
  assert.equal(g.status, 409);
  assert.equal(g.cuerpo.ok, false);
  assert.equal(g.cuerpo.pausa, 'falta-pagar', 'sin el motivo, la pantalla no sabe que tiene que avisar');
  assert.equal(g.cuerpo.nombre, 'Giselle Belanti');
  assert.doesNotMatch(g.cookie, /mako_agencia=a1\./, 'con la cookie, la agencia vuelve a caer en /cuenta-pausada');
  // El resto entra como siempre: al día, la pausa de OTRA agencia, la de la pasarela (/cuenta-pausada dice por qué) y la ya reabierta.
  for (const ws of ['18', '19', '20', '21']) {
    assert.equal(R[ws].status, 200, `el ${ws} tenía que entrar`);
    assert.match(R[ws].cookie, new RegExp(`mako_agencia=a1\\.13\\.${ws}\\.`));
    assert.equal(R[ws].cuerpo.pausa, undefined);
  }
  // Y a quien no es su cartera no se le cuenta que está en pausa: lo mismo de siempre, 404.
  assert.equal(R['99'].status, 404);
  assert.deepEqual(R['99'].cuerpo, { ok: false, error: 'ese cliente no está en tu cartera' });
});

test('2. la regla: pausada, corte vigente, `paga-para-entrar` y de ESTA agencia; nada más', () => {
  const de = (agenciaWs: number) => ({ vigente: true, motivo: 'paga-para-entrar', mensualidad: { agenciaWs } });
  assert.equal(faltaPagarParaEntrar({ pausada: true, corte: de(13), agenciaWs: 13 }), true);
  assert.equal(faltaPagarParaEntrar({ pausada: false, corte: de(13), agenciaWs: 13 }), false, 'ya reabierta');
  assert.equal(faltaPagarParaEntrar({ pausada: true, corte: { ...de(13), vigente: false }, agenciaWs: 13 }), false);
  assert.equal(faltaPagarParaEntrar({ pausada: true, corte: de(14), agenciaWs: 13 }), false, 'la mensualidad de otra agencia');
  assert.equal(faltaPagarParaEntrar({ pausada: true, corte: { vigente: true, motivo: 'impago' }, agenciaWs: 13 }), false);
  assert.equal(faltaPagarParaEntrar({ pausada: true, corte: null, agenciaWs: 13 }), false, 'sin poder leer el corte, entra como siempre');
  // Los textos: una línea, con el nombre. El del teléfono (y el `error` de la ruta), sin plata.
  assert.equal(avisoFaltaPagar('Giselle Belanti'), 'No puedes entrar: falta pagar el mes de Giselle Belanti');
  assert.equal(ESTADO_FALTA_PAGAR, 'Falta pagar');
  assert.ok(avisoFaltaPagar('Marcela Fernandez').length <= 60, 'el aviso es una línea');
  assert.doesNotMatch(avisoEnPausa('Giselle Belanti'), /pag|US\$|cuota|debe|cobr/i);
  assert.doesNotMatch(avisoFaltaPagar('X') + avisoEnPausa('X'), /\bvos\b|podés|tenés/, 'con tú, nunca vos');
});

test('3. la computadora: «Falta pagar» en la fila ANTES de tocar, y al tocar «Inspeccionar», el aviso con «Pagar su mes»', () => {
  const app = sinComentarios(leer('app/agency/AgencyApp.tsx'));
  // Antes de tocar: el estado de la fila y el de la ficha.
  assert.match(app, /if \(faltaPagar\) return \{ texto: ESTADO_FALTA_PAGAR, tono: 'bad' \};/);
  assert.match(app, /const e = estadoDe\(c, faltaPagar\(c\)\);/);
  assert.match(app, /estadoDe\(abierta, faltaPagar\(abierta\)\)\.texto/);
  assert.match(app, /const faltaPagar = useCallback\(\(c: CuentaPartner\) => !!delMes\.get\(c\.ws\)\?\.enPausa, \[delMes\]\);/);
  // Al tocar: el aviso sin ir al server (el super admin entra igual), y si el server lo dice, también.
  assert.match(app, /else if \(a === 'inspeccionar' && !superAdmin && faltaPagar\(c\)\) setAviso\(c\.ws\);\n\s*else if \(a === 'inspeccionar'\) void entrar\(c\.ws\);/);
  assert.match(app, /if \(j\?\.pausa === 'falta-pagar'\) \{ setAviso\(ws\); return; \}/);
  // Donde se tocó: la fila y la ficha; con su botón, que baja a su entrada en la mensualidad.
  assert.match(app, /\{abiertaWs !== c\.ws && avisoDe\(c\)\}/);
  assert.match(app, /pie=\{<span className="ad-fila-acc">\{avisoDe\(abierta\) \?\? accionDe\(abierta\)\}<\/span>\}/);
  assert.match(app, /<span>\{avisoFaltaPagar\(nombre\)\}<\/span>\s*<button type="button" className="ad-acc ad-acc--fuerte" onClick=\{onPagar\}>\{ROTULO_ACCION_CUENTA\.pagar\}<\/button>/);
  assert.match(app, /resaltar=\{resaltar\}/);
  const mes = sinComentarios(leer('app/agency/Mensualidad.tsx'));
  assert.match(mes, /data-entrada=\{p\.ws\} data-marcada=\{marcada === p\.ws \|\| undefined\}/);
  assert.match(mes, /querySelector<HTMLElement>\(`\[data-entrada="\$\{resaltar\.ws\}"\]`\)/);
});

test('4. el teléfono: «En pausa» y el aviso al tocar «Entrar a su cuenta», sin plata (#94)', () => {
  const m = sinComentarios(leer('app/m/agency/AgencyM.tsx'));
  assert.match(m, /if \(enPausa\) return \{ texto: 'En pausa', tono: 'bad' \};/);
  assert.match(m, /const e = estadoDe\(x, pausada\(x\.ws\)\);/);
  assert.match(m, /if \(pausada\(clienteWs\)\) \{ setAviso\(clienteWs\); return; \}/);
  assert.match(m, /if \(j\?\.pausa === 'falta-pagar'\) \{ setAviso\(clienteWs\); return; \}/);
  assert.match(m, /\{aviso === c\.ws && <p className="m-agency-aviso" role="alert">\{avisoEnPausa\(c\.nombre\)\}<\/p>\}/);
  for (const plata of [/Falta pagar/, /Pagar su mes/, /avisoFaltaPagar/, /ESTADO_FALTA_PAGAR/]) assert.doesNotMatch(m, plata, `el teléfono dice ${plata}`);
  const pagina = sinComentarios(leer('app/m/agency/page.tsx'));
  assert.match(pagina, /m\.clientes\.filter\(\(c\) => c\.enPausa\)\.map\(\(c\) => c\.ws\)/);
  assert.match(pagina, /enPausa=\{enPausa\}/);
});
