// =============================================================================
// MaKo ve lo que el lead contestó en el formulario de Meta (herramienta ficha_lead)
// =============================================================================
// Pedido de Joan (08/10/2026, vía Martín): «No me trae la info del formulario al WhatsApp
// cuando le pregunto». Le preguntó a MaKo qué propiedad quería vender Rosana (ws15) y contestó
// «en su ficha no hay detalles»: la respuesta estaba guardada, pero ficha_lead no la devolvía.
// El porqué, en formularioParaModelo (lib/meta-leads-campos.ts).
//
// Medido el 08/10 con la herramienta real (scratchpad, sólo lectura): ficha_lead de #2594 pasó
// de 438 a 648 caracteres, con las claves [lead, respuestas, formulario_meta] y las 2 preguntas
// propias; la de un lead de ws1 sin formulario guardado trae formulario_meta: null.
//
// Correr: npx tsx --test tests/mako-ficha-formulario.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (08/10/2026):
//   - sacar `...formularioParaModelo(lead.meta_field_data)` del return de ficha_lead → 3 / 1;
//   - devolver la descripción vieja en lib/mako-tools.ts → 3 / 1;
//   - devolver la vieja en crm.def.ts → 3 / 1;
//   - que null devuelva [] («no contestó nada») → 3 / 1;
//   - TOPE_FORMULARIO_MODELO.preguntas = 100 → 3 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formularioParaModelo, TOPE_FORMULARIO_MODELO, type MetaFieldData } from '../lib/meta-leads-campos';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// La forma real de un lead de ws15 (Meta manda la clave, no el texto de la pregunta).
const ROSANA: MetaFieldData = [
  { name: 'full_name', values: ['Rosana G'] },
  { name: 'phone_number', values: ['+5491100000000'] },
  { name: 'email', values: ['rosana@ejemplo.com'] },
  { name: '¿qué_tipo_de_propiedad_buscas_vender?', values: ['casa'] },
  { name: '¿en_que_zona/barrio_se_encuentra_ubicada_la_propiedad_que_desea_vender?', values: ['Palermo'] },
];

test('las preguntas propias llegan con su respuesta; los datos de contacto no se repiten', () => {
  const r = formularioParaModelo(ROSANA);
  assert.ok(r.formulario_meta);
  assert.equal(r.formulario_meta!.length, 2);
  assert.match(r.formulario_meta![0].pregunta, /tipo de propiedad buscas vender/);
  assert.match(r.formulario_meta![0].respuesta, /casa/i);
  assert.ok(!JSON.stringify(r).includes('rosana@ejemplo.com'), 'el email ya viaja en lead.email');
  assert.equal(r.formulario_meta_omitidas, undefined);
});

test('null es «no vino de un formulario», no «no contestó»; solo contacto es []', () => {
  assert.deepEqual(formularioParaModelo(null), { formulario_meta: null });
  assert.deepEqual(formularioParaModelo(undefined), { formulario_meta: null });
  // Los 3 del ws1 con meta_field_data: sólo contacto, ninguna pregunta propia.
  assert.deepEqual(formularioParaModelo(ROSANA.slice(0, 3)), { formulario_meta: [] });
});

test('los topes: un formulario enorme no se come el presupuesto del modelo', () => {
  const enorme: MetaFieldData = Array.from({ length: 30 }, (_, i) => ({
    name: `pregunta_${i}_${'x'.repeat(400)}`, values: ['y'.repeat(1000)],
  }));
  const r = formularioParaModelo(enorme);
  assert.equal(r.formulario_meta!.length, TOPE_FORMULARIO_MODELO.preguntas);
  assert.equal(r.formulario_meta_omitidas, 30 - TOPE_FORMULARIO_MODELO.preguntas);
  for (const f of r.formulario_meta!) {
    assert.ok(f.pregunta.length <= TOPE_FORMULARIO_MODELO.pregunta);
    assert.ok(f.respuesta.length <= TOPE_FORMULARIO_MODELO.respuesta);
  }
  assert.ok(JSON.stringify(r).length < 7000, `peor caso: ${JSON.stringify(r).length} caracteres`);
  assert.ok(TOPE_FORMULARIO_MODELO.preguntas <= 12);
});

test('ficha_lead lo devuelve, y las DOS descripciones se lo dicen al modelo', () => {
  const tools = sinComentarios(leer('lib/mako-tools.ts'));
  const caso = tools.slice(tools.indexOf("case 'ficha_lead':"), tools.indexOf("case 'historial_whatsapp':"));
  // ⚠️ CAMBIADO A PROPÓSITO (14/10/2026, tanda B del CRM): el `lead` suma lo que la ficha muestra
  // (`datosDeLaFicha`) y al lado va lo de la landing; lo que este test cuida —formulario_meta en la
  // salida— sigue igual. Lo nuevo lo fija tests/mako-ficha-lead.test.ts.
  assert.match(caso, /respuestas, \.\.\.formularioParaModelo\(lead\.meta_field_data\), \.\.\.landingParaModelo\(lead\.optin_respuestas\),/);
  // La de MAKO_TOOLS es la que lee el modelo de WhatsApp; la del registro, HTTP y la doc.
  const desc = tools.match(/name: 'ficha_lead',\s*description: '([^']+)'/)?.[1] ?? '';
  assert.match(desc, /formulario de Meta \(formulario_meta/);
  assert.match(desc, /NO significa que no contestó/);
  const def = leer('lib/api-mako/areas/crm.def.ts');
  const reg = def.match(/id: 'ficha_lead'[\s\S]*?descripcion: '([^']+)'/)?.[1] ?? '';
  assert.match(reg, /formulario de Meta \(formulario_meta/);
});
