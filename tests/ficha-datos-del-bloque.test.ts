// =============================================================================
// Los DATOS de adentro de un bloque y su «Obligatorio», dato por dato (23/10/2026)
// =============================================================================
// Martín, 23/10/2026 ~20:40 UTC: «hay bloques que son editables a medias... en todos me dice "empresa obligatorio" porque
// está dentro de un bloque que tiene 3 datos, y no se puede personalizar, no puedo decidir sacar a empresa o agregar otra
// cosa... Eso está mal, porque me obligas a hacer obligatorio un dato que no quería que lo fuera... Así estoy seguro que
// hay más casos». La regla: dentro de un bloque la persona decide QUÉ datos van y CUÁLES son obligatorios; nada es
// obligatorio porque viene con otro. Se prueba EJECUTANDO el motor (lib/ficha/config.ts, catalogo.ts, plantillas.ts),
// las reglas de la pantalla (app/crm/lead-view/ficha/armar.ts, reglas-reuniones.ts) y la salida de la API (lib/ficha/api.ts).
//
// Correr: node --import tsx --test tests/ficha-datos-del-bloque.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (23/10/2026, base 7/0), de a una rotura y restaurada:
//   · `NACEN_APAGADOS` sin la empresa                                                 → 6 / 1
//   · `avisaDelPuesto` sin mirar los datos elegidos                                    → 3 / 4
//   · sacar un dato del bloque sin apagar su aviso                                     → 6 / 1
//   · apagarlo aunque otro bloque de la ficha lo complete                              → 6 / 1
//   · `cubreDe` sin saltear lo que la hoja puso aparte                                 → 6 / 1
//   · el contacto otra vez `quitable: false`                                           → 6 / 1
//   (base 8/0, el último test) `loQueSePide` sin filtrar → 7 / 1; LeadSheet con la lista entera → 7 / 1; mover sin
//   `pendientesQueAvisan` → 7 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loQueSePide } from '../lib/datos-aviso';
import { BLOQUES, bloqueDef, DATOS_CONTACTO } from '../lib/ficha/catalogo';
import {
  aplicarCambio, avisaDelPuesto, datosDelPuesto, dondeSeCompleta, fichaEfectiva, sanearCambio, sanearFicha,
  type FichaGuardada, type RespaldoNegocio, type ResultadoCambio,
} from '../lib/ficha/config';
import { apagadosDePlantilla, NACEN_APAGADOS, PLANTILLAS_FICHA } from '../lib/ficha/plantillas';
import { cubreDe } from '../app/crm/lead-view/ficha/armar';
import { REGLAS_REUNIONES } from '../app/crm/lead-view/ficha/reglas-reuniones';
import { REGLAS_RESUMEN } from '../app/crm/lead-view/ficha/reglas-resumen';
import { salidaFichaApi } from '../lib/ficha/api';

const R: RespaldoNegocio = { resumen: {}, apagados: [] };
const ok = (r: ResultadoCambio) => { assert.ok(r.ok, r.ok ? '' : r.error); return r as Extract<ResultadoCambio, { ok: true }>; };
const avisa = (f: FichaGuardada, id: string, tipo = 'una-llamada' as const) => fichaEfectiva(tipo, f, R).avisos.find((a) => a.id === id)!.avisa;
const contacto = bloqueDef('contacto')!;

test('la empresa nace apagada en TODAS las plantillas; el teléfono sigue avisando', () => {
  assert.ok(NACEN_APAGADOS.includes('empresa'));
  for (const p of PLANTILLAS_FICHA) {
    assert.ok(apagadosDePlantilla(p).includes('empresa'), `${p.id}: la empresa avisa sin que nadie la eligiera`);
    assert.ok(!apagadosDePlantilla(p).includes('telefono'), `${p.id}: el teléfono dejó de avisar`);
  }
  assert.equal(avisa({}, 'empresa'), false);
  // Quien la quiere obligatoria la prende, y queda guardado en su funnel.
  const prendida = ok(aplicarCambio({}, { op: 'aviso', paso: 'empresa', avisa: true }, 'una-llamada', R)).ficha;
  assert.deepEqual(prendida.avisos, { empresa: true });
  assert.equal(avisa(prendida, 'empresa'), true);
});

test('los datos del contacto: se eligen, se validan, y los de entrada no se guardan', () => {
  assert.deepEqual(DATOS_CONTACTO.deEntrada, ['telefono', 'email', 'empresa']);
  assert.ok(contacto.opciones?.includes('datos'));
  const c = sanearCambio({ op: 'opciones', tab: 'resumen', bloque: 'contacto', opciones: { datos: ['telefono', 'inventado', 'instagram'] } });
  assert.ok(!('error' in c) && c.op === 'opciones');
  assert.deepEqual((c as { opciones: { datos?: string[] } }).opciones.datos, ['telefono', 'instagram'], 'un dato que no existe, afuera');
  // Guardado igual al de entrada → sin opciones (la tab sigue a su plantilla).
  const g = sanearFicha({ tabs: { resumen: [{ id: 'contacto', opciones: { datos: ['telefono', 'email', 'empresa'] } }] } });
  assert.equal(g.tabs!.resumen![0].opciones, undefined);
  assert.deepEqual(datosDelPuesto(contacto, undefined), ['telefono', 'email', 'empresa']);
  assert.deepEqual(avisaDelPuesto(contacto, undefined), ['telefono', 'empresa']);
  assert.deepEqual(avisaDelPuesto(contacto, { datos: ['telefono', 'email'] }), ['telefono'], 'sin la empresa, no la completa');
  assert.deepEqual(avisaDelPuesto(bloqueDef('setter-y-closer')!, { datos: ['closer'] }), ['closer']);
  assert.deepEqual(avisaDelPuesto(bloqueDef('calificacion')!, undefined), ['calificado'], 'un bloque sin datos elegibles: lo suyo');
});

test('sacar un dato del bloque lo deja de pedir en el MISMO cambio; sumarlo otra vez no lo vuelve obligatorio', () => {
  assert.equal(avisa({}, 'telefono'), true);
  const sin = ok(aplicarCambio({}, { op: 'opciones', tab: 'resumen', bloque: 'contacto', opciones: { datos: ['email', 'empresa'] } }, 'una-llamada', R));
  assert.equal(avisa(sin.ficha, 'telefono'), false, 'un aviso que no se puede completar en la ficha es el que Martín no quería');
  assert.deepEqual(sin.ficha.avisos, { telefono: false });
  assert.equal(dondeSeCompleta(fichaEfectiva('una-llamada', sin.ficha, R), 'telefono'), null);
  const vuelve = ok(aplicarCambio(sin.ficha, { op: 'opciones', tab: 'resumen', bloque: 'contacto', opciones: { datos: ['telefono', 'email', 'empresa'] } }, 'una-llamada', R));
  assert.equal(avisa(vuelve.ficha, 'telefono'), false, 'volver a ponerlo no lo vuelve obligatorio: eso se elige aparte');
  const contactoVuelto = fichaEfectiva('una-llamada', vuelve.ficha, R).tabs.resumen.find((b) => b.id === 'contacto')!;
  assert.equal(contactoVuelto.opciones, undefined, 'como venía = sin elegir');
});

test('si otro bloque de la ficha completa el dato, sacarlo de uno no lo apaga', () => {
  // Un segundo contacto en una hoja propia sigue completando el teléfono.
  const conHoja = ok(aplicarCambio({}, { op: 'hoja', hoja: 'h-datos', nombre: 'Datos', bloques: [{ id: 'contacto', ancho: 12, diseno: 'grilla' }] }, 'una-llamada', R)).ficha;
  const sin = ok(aplicarCambio(conHoja, { op: 'opciones', tab: 'resumen', bloque: 'contacto', opciones: { datos: ['email'] } }, 'una-llamada', R));
  assert.equal(avisa(sin.ficha, 'telefono'), true);
  assert.equal(sin.ficha.avisos, undefined);
});

test('todo bloque se quita, también el contacto; «Solucionar» ya no encuentra su dato ahí', () => {
  assert.deepEqual(BLOQUES.filter((b) => !b.quitable).map((b) => b.id), []);
  const sin = ok(aplicarCambio({}, { op: 'quitar', tab: 'resumen', bloque: 'contacto' }, 'una-llamada', R));
  const ef = fichaEfectiva('una-llamada', sin.ficha, R);
  assert.ok(!ef.tabs.resumen.some((b) => b.id === 'contacto'));
  assert.equal(dondeSeCompleta(ef, 'telefono'), null, 'sin bloque, el asistente lo pide (§4)');
});

test('la barra cubre lo que el bloque PUESTO dibuja: sin lo que su hoja puso aparte ni los datos que sacaron', () => {
  const r1 = bloqueDef('reunion-1')!;
  const sola = cubreDe(r1, REGLAS_REUNIONES['reunion-1'], { hermanos: ['reunion-1'] });
  for (const p of ['fechaJ1', 'fechaJ2', 'setter', 'closer', 'calificado'] as const) assert.ok(sola.includes(p), `R1 sola: ${p}`);
  const partida = cubreDe(r1, REGLAS_REUNIONES['reunion-1'], { hermanos: ['reunion-1', 'reunion-2', 'setter-y-closer'] });
  for (const p of ['fechaJ2', 'fathomR2', 'setter', 'closer'] as const) assert.ok(!partida.includes(p), `con eso aparte, la R1 no cubre ${p}`);
  assert.ok(partida.includes('fechaJ1') && partida.includes('calificado'));
  assert.deepEqual(cubreDe(contacto, REGLAS_RESUMEN.contacto, { puesto: { id: 'contacto', ancho: 12, diseno: 'grilla', opciones: { datos: ['telefono'] } } }), ['telefono']);
});

test('la API de MaKo ve qué completa cada bloque puesto y los datos que lleva', () => {
  const g = ok(aplicarCambio({}, { op: 'opciones', tab: 'resumen', bloque: 'contacto', opciones: { datos: ['telefono', 'instagram'] } }, 'una-llamada', R)).ficha;
  const salida = salidaFichaApi({ funnel: { id: 1, nombre: 'X', esDefault: true }, eleccion: { id: 'una-llamada', porque: 'x' }, efectiva: fichaEfectiva('una-llamada', g, R) } as never);
  const b = (salida.tabs.resumen.bloques as Array<Record<string, unknown>>).find((x) => x.bloque === 'contacto')!;
  assert.deepEqual(b.completa, ['telefono']);
  assert.deepEqual(b.datos, ['telefono', 'instagram']);
  assert.ok((b.datos_posibles as string[]).includes('direccion'));
});

test('lo que no es obligatorio no se pide en ningún lado: ni «Completar datos» ni el «Queda pendiente» al mover', () => {
  const faltan = [{ id: 'empresa', label: 'Empresa' }, { id: 'telefono', label: 'Teléfono de contacto' }, { id: 'asistenciaR1', label: 'Asistencia' }] as const;
  assert.deepEqual(loQueSePide([...faltan], [{ id: 'telefono' }]).map((f) => f.id), ['telefono', 'asistenciaR1'], 'la asistencia se pide siempre');
  assert.deepEqual(loQueSePide([...faltan], undefined).length, 3, 'sin el partido, lo de siempre');
  const sinComentarios = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');
  assert.match(sinComentarios('app/crm/LeadSheet.tsx'), /faltantes=\{completandoDatos \? loQueSePide\(faltantes, datos\?\.avisar\) : undefined\}/);
  assert.match(sinComentarios('app/crm/[id]/LeadDetailBody.tsx'), /faltantes=\{moveTo === currentStage \? loQueSePide\(faltantes, datos\?\.avisar\) : undefined\}/);
  const acc = sinComentarios('app/crm/actions.ts');
  assert.equal((acc.match(/const pendientes = await pendientesQueAvisan\(after, /g) ?? []).length, 2, 'setLeadStageAction y completeStageMoveAction');
  assert.match(acc, /return apagados \? avisanDelLead\(faltan, lead, apagados\) : faltan;/);
});
