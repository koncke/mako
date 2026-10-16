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

test('las DOS puertas de la ficha respetan lo elegido, y Customer Success no se personaliza', async () => {
  // ⚠️ CAMBIADO A PROPÓSITO EL 14/10/2026 (la ficha por bloques): lo que eligió el negocio
  // (`crm.resumen.campos`) es el RESPALDO de la ficha de cada funnel (decisión 1 del diseño). Ya no tiene
  // modal ni engranaje: se arma en «Personalizar». Las dos puertas montan la MISMA ficha, y lo elegido
  // llega a dos lugares que se EJECUTAN acá: las fuentes de «Lo que contestó» (Meta y la landing) y la
  // tarjeta del contacto, que sigue leyéndolo campo por campo. Re-verificado rompiéndolo: el saneo de la
  // ficha sin el respaldo de las fuentes → 1 fallo.
  const { fichaEfectiva } = await import('../lib/ficha/config');
  const { respuestasDelBloque } = await import('../app/crm/lead-view/ficha/reglas-resumen');
  for (const p of ['../app/crm/LeadSheet.tsx', '../app/crm/[id]/LeadDetailBody.tsx']) {
    assert.match(sinComentarios(leer(p)), /<FichaPorBloques\b/, `${p}: no monta la ficha compartida`);
  }
  const contesto = (resumen: Record<string, boolean>) => fichaEfectiva('respaldo', null, { resumen, apagados: [] }).tabs.resumen.find((b) => b.id === 'lo-que-contesto')!;
  const data = { respuestasForm: [{ pregunta: 'Zona', respuesta: 'Sur' }], respuestasLanding: [{ pregunta: 'Edad', respuesta: '30' }] };
  const fuentes = (resumen: Record<string, boolean>) => respuestasDelBloque({ data } as never, contesto(resumen)).map((f) => f.fuente);
  assert.deepEqual(fuentes({}), ['meta', 'landing'], 'lo de siempre: los dos formularios');
  assert.deepEqual(fuentes({ form_meta: false }), ['landing'], 'el formulario de Meta');
  assert.deepEqual(fuentes({ form_landing: false }), ['meta'], 'el de la landing');
  // ⚠️ 16/10/2026 (el Resumen nativo): la ficha del CRM ya no monta InfoPrincipalCard (la sigue montando Customer
  // Success, sin `resumen`). Lo que eligió el negocio llega por la ficha del funnel: las redes de `redes-y-web` y si
  // entran la dirección y el sexo (lib/ficha/config.ts, `listaDeIds`), y la cohorte en el contacto. Se EJECUTA.
  // Re-verificado rompiéndolo (base 7/0): el contacto dibujando la cohorte sin mirar lo elegido → 6 / 1.
  const redes = (resumen: Record<string, boolean>) => fichaEfectiva('respaldo', null, { resumen, apagados: [] }).tabs.resumen.find((b) => b.id === 'redes-y-web')?.opciones?.redes;
  assert.deepEqual(redes({}), ['web', 'instagram'], 'lo de siempre: la web y el Instagram');
  assert.deepEqual(redes({ instagram: false, linkedin: true }), ['web', 'linkedin']);
  assert.ok(fichaEfectiva('respaldo', null, { resumen: { direccion: true }, apagados: [] }).tabs.resumen.some((b) => b.id === 'direccion'), 'la dirección prendida entra');
  assert.match(sinComentarios(leer('../app/crm/lead-view/ficha/resumen/contacto.tsx')), /seVe\(data\.resumen \?\? \{\}, 'cohorte'\)/, 'la cohorte sigue lo elegido');
  const UI = sinComentarios(leer('../app/crm/lead-view/InfoPrincipalCard.tsx'));
  assert.match(UI, /const ve = \(id: CampoResumen\) => resumen === undefined \|\| seVe\(resumen, id\);/, 'sin `resumen` se ve lo de siempre');
  assert.doesNotMatch(UI, /setConfigurando|nombre="configurar"/, 'volvió el engranaje: la ficha se arma en «Personalizar»');
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
  // ⚠️ CAMBIADO A PROPÓSITO EL 14/10/2026: `guardarResumenFichaAction` (app/crm/resumen-actions.ts) se
  // fue con su modal. Lo que muestra la ficha se cambia con `cambiarFichaFunnelAction`, por funnel, y es
  // del admin igual.
  const ACC = sinComentarios(leer('../app/crm/ficha-actions.ts'));
  const i = ACC.indexOf('export async function cambiarFichaFunnelAction');
  assert.ok(i > 0);
  assert.match(ACC.slice(i), /if \(\(await getRolWsEfectivo\(\)\) !== 'admin'\) return \{ ok: false/);
  assert.match(ACC.slice(i), /if \(!\(await haySesion\(\)\)\) return \{ ok: false/);
});
