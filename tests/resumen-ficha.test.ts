import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAMPOS_RESUMEN, SEXOS, sanearResumen, seVe, esSexo } from '../lib/resumen-ficha';
import { respuestasDelOptin, respuestasGuardadas } from '../lib/optin-respuestas';
import { atribucionDePropuesta } from '../app/crm/revisar/[id]/propuesta-lead';

/**
 * El Resumen de la ficha del lead, personalizable (Martín, 13/10/2026, Resumen punto 1): «unos su
 * IG, otros su YouTube, otros su Web, LinkedIn, dirección, otros su sexo, otros quieren ver la
 * respuesta del instant form, las respuestas del form de opt-in».
 *
 * Verificado rompiéndolo (base 7/0): `seVe` sin el default, 1 fallo; la respuesta anidada sin
 * descartar, 1 fallo; la propuesta sin llevar las respuestas, 1 fallo; el alta directa sin
 * guardarlas, 1 fallo; la ruta /crm/[id] sin el filtro del formulario de la landing, 1 fallo;
 * el revertir sin el caso «Sexo», 1 fallo; el check de la migración sin «otro», 1 fallo.
 */

const leer = (r: string) => readFileSync(new URL(r, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('lo que nadie eligió toma su default: lo que ya se veía sigue viéndose, lo nuevo nace apagado', () => {
  assert.equal(seVe({}, 'web'), true);
  assert.equal(seVe({}, 'form_meta'), true);
  assert.equal(seVe(null, 'youtube'), false);
  assert.equal(seVe({ youtube: true, web: false }, 'youtube'), true);
  assert.equal(seVe({ youtube: true, web: false }, 'web'), false);
  assert.deepEqual(sanearResumen({ web: false, inventado: true, sexo: 'si' }), { web: false }, 'un id que no existe o un valor que no es sí/no, afuera');
  assert.deepEqual(sanearResumen([true]), {});
  // Lo que ya mostraba la ficha antes de esto, prendido; los datos nuevos, apagados.
  const prendidos = CAMPOS_RESUMEN.filter((c) => c.porDefecto).map((c) => c.id).sort();
  assert.deepEqual(prendidos, ['cohorte', 'form_landing', 'form_meta', 'ingreso', 'instagram', 'web']);
});

test('las respuestas de la landing: texto, con tope, y lo anidado afuera', () => {
  assert.deepEqual(respuestasDelOptin({ Zona: ' Polanco ', Presupuesto: 3000000, vacio: ' ', obj: { a: 1 } }),
    [{ pregunta: 'Zona', respuesta: 'Polanco' }, { pregunta: 'Presupuesto', respuesta: '3000000' }]);
  assert.deepEqual(respuestasDelOptin(['Zona']), []);
  assert.equal(respuestasDelOptin(Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`p${i}`, 'x']))).length, 20);
  assert.equal(respuestasDelOptin({ Zona: 'x'.repeat(900) })[0].respuesta.length, 500);
  assert.deepEqual(respuestasGuardadas([{ pregunta: 'Zona', respuesta: 'Sur' }, { pregunta: '', respuesta: 'x' }, 'basura']), [{ pregunta: 'Zona', respuesta: 'Sur' }]);
});

test('el opt-in las guarda por los DOS caminos: el alta directa y la propuesta', () => {
  const R = sinComentarios(leer('../app/api/track/optin/route.ts'));
  assert.match(R, /const respuestasOptin = respuestasDelOptin\(body\.respuestas\);/);
  assert.match(R, /funnel_id: funnelDelLead,\s*optin_respuestas: respuestasOptin,\s*\}\)\);/, 'el alta directa');
  assert.match(R, /respuestas: respuestasOptin,\s*\}\],/, 'la propuesta');
  const a = atribucionDePropuesta('landing', { leads: [{ nombre: 'Ana', respuestas: [{ pregunta: 'Zona', respuesta: 'Sur' }] }] });
  assert.deepEqual(a.p0.optin_respuestas, [{ pregunta: 'Zona', respuesta: 'Sur' }], 'quien confirma las escribe en el lead');
  assert.match(sinComentarios(leer('../lib/leads.ts')), /\.\.\.\(input\.optin_respuestas\?\.length \? \{ optin_respuestas: input\.optin_respuestas \} : \{\}\),/);
});

test('las DOS puertas de la ficha respetan lo elegido, y Customer Success no se personaliza', () => {
  for (const p of ['../app/crm/LeadSheet.tsx', '../app/crm/[id]/page.tsx']) {
    const src = sinComentarios(leer(p));
    assert.match(src, /\{seVe\(resumen, 'form_meta'\) && <RespuestasFormulario/, `${p}: el formulario de Meta`);
    assert.match(src, /\{seVe\(resumen, 'form_landing'\) && <RespuestasFormulario respuestas=\{respuestasLanding/, `${p}: el de la landing`);
    assert.match(src, /resumen=\{resumen/, `${p}: la tarjeta recibe lo elegido`);
  }
  const UI = sinComentarios(leer('../app/crm/lead-view/InfoPrincipalCard.tsx'));
  assert.match(UI, /const ve = \(id: CampoResumen\) => resumen === undefined \|\| seVe\(resumen, id\);/, 'sin `resumen` se ve lo de siempre');
  assert.match(UI, /\{resumen !== undefined && \(\s*<button type="button" onClick=\{\(\) => setConfigurando\(true\)\}/, 'el engranaje sólo donde se personaliza');
  for (const id of ['web', 'instagram', 'direccion', 'sexo', 'ingreso', 'cohorte']) assert.match(UI, new RegExp(`ve\\('${id}'\\)`), `«${id}» sin su interruptor`);
});

test('los datos nuevos se editan, quedan en el historial y se deshacen', () => {
  const ACC = sinComentarios(leer('../app/crm/actions.ts'));
  for (const [label, k] of [['YouTube', 'youtube'], ['LinkedIn', 'linkedin'], ['Dirección', 'direccion'], ['Sexo', 'sexo']]) {
    assert.match(sinComentarios(leer('../lib/leads.ts')), new RegExp(`\\{ k: '${k}', label: '${label}' \\}`), `${label}: AUDIT_FIELDS`);
    assert.match(ACC, new RegExp(`case '${label}': await saveLeadMeta\\(leadId, \\{ ${k}: v \\}\\); break;`), `${label}: revertir uno`);
    assert.match(ACC, new RegExp(`case '${label}': meta\\.${k} = v; break;`), `${label}: revertir varios`);
    assert.ok(ACC.includes(`'${label}'`) && /'YouTube', 'LinkedIn', 'Dirección', 'Sexo',/.test(ACC), `${label}: REVERTIBLES`);
  }
});

test('el sexo: tres valores, los mismos en la pantalla, el server y la base', () => {
  assert.deepEqual(SEXOS.map((s) => s.id), ['mujer', 'hombre', 'otro']);
  assert.ok(esSexo('otro') && !esSexo('masculino'));
  const MIG = leer('../supabase/migrations/0274_lead_resumen.sql');
  assert.match(MIG, /check \(sexo is null or sexo in \('mujer', 'hombre', 'otro'\)\)/);
  for (const c of ['youtube', 'linkedin', 'direccion', 'sexo', 'optin_respuestas']) assert.match(MIG, new RegExp(`add column if not exists ${c} `));
  assert.match(sinComentarios(leer('../lib/leads.ts')), /if \(meta\.sexo !== null && meta\.sexo !== '' && !esSexo\(meta\.sexo\)\) throw new Error/);
});

test('cambiar lo que muestra el Resumen es del admin', () => {
  const ACC = sinComentarios(leer('../app/crm/resumen-actions.ts'));
  const i = ACC.indexOf('export async function guardarResumenFichaAction');
  assert.match(ACC.slice(i), /if \(\(await getRolWsEfectivo\(\)\) !== 'admin'\) return \{ ok: false/);
  assert.match(ACC.slice(i), /if \(!\(await haySesion\(\)\)\) return \{ ok: false/);
});
