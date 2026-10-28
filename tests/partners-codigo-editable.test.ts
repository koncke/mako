// =============================================================================
// El código de MaKo Partners se puede cambiar, y lo de antes sigue contando (27/10/2026)
// =============================================================================
// Leila en la llamada con Martín (Fathom 876470842-06): el código nace del nombre del negocio y el panel sólo dejaba copiarlo.
// Listo = editable, único, y los links viejos siguen acreditando. Lo que se cuida acá:
//   · lo que escribe el partner se limpia y se valida como la base (lo puro, se ejecuta);
//   · la mig 0341: los anteriores en su tabla, el cambio atómico y serializado, y un código viejo que nunca pasa a otro;
//   · cada lectura que va de un código a un negocio mira también los anteriores: /r/<viejo>, el código escrito al pagar,
//     el panel del partner, el programa del super admin y la acreditación;
//   · sin la migración, cambiar NO se hace (perdería lo que ya mandó) y las lecturas siguen como antes;
//   · el panel tiene «Cambiar», y la API `cambiar_codigo_partners`.
//
// Probado rompiéndolo (27/10/2026): al pie del archivo.
// Correr: node --import tsx --test tests/partners-codigo-editable.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { codigoNuevoValido, TEXTO_CODIGO_INVALIDO } from '../lib/partners-reglas';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** El cuerpo de una función de un archivo (hasta la función siguiente). */
function cuerpo(rel: string, nombre: string): string {
  const src = fuente(rel);
  const i = src.search(new RegExp(`\\n(?:export )?async function ${nombre}\\(`));
  assert.ok(i >= 0, `no encontré ${nombre} en ${rel}`);
  const resto = src.slice(i + 1);
  const fin = resto.search(/\n(?:export )?(?:async )?function |\nexport const |\n\/\*\*/);
  return fin > 0 ? resto.slice(0, fin) : resto;
}

test('lo que escribe el partner: se limpia como el nombre y cumple lo mismo que la base', () => {
  assert.deepEqual(codigoNuevoValido('  Leila Ventas '), { ok: true, codigo: 'leila-ventas' });
  assert.deepEqual(codigoNuevoValido('Peña'), { ok: true, codigo: 'pena' }, 'sin acentos');
  assert.deepEqual(codigoNuevoValido('mako2026'), { ok: true, codigo: 'mako2026' });
  for (const malo of ['', 'ab', 'a'.repeat(33), '-leila', 'leila-', 'lei--la', 'lei_la', 'leila!', null, 42]) {
    assert.deepEqual(codigoNuevoValido(malo), { ok: false, error: TEXTO_CODIGO_INVALIDO }, String(malo));
  }
  for (const reservado of ['mako', 'Admin', 'hola-mako']) assert.equal(codigoNuevoValido(reservado).ok, false, reservado);
});

test('la mig 0341: los anteriores, el cambio atómico y serializado, y un código viejo nunca pasa a otro negocio', () => {
  const sql = fuente('supabase/migrations/0341_partner_codigo_editable.sql').replace(/--.*$/gm, '');
  assert.match(sql, /create table if not exists partner_codigos_anteriores \(\s*codigo\s+text primary key check \(codigo ~ '\^\[a-z0-9-\]\{3,32\}\$'\),\s*workspace_id bigint not null references workspaces\(id\) on delete cascade,/);
  assert.match(sql, /revoke all on partner_codigos_anteriores from anon, authenticated;/);
  const f = sql.slice(sql.indexOf('create or replace function cambiar_codigo_partner'));
  const lock = f.indexOf("perform pg_advisory_xact_lock(hashtext('partner_codigos'));");
  const ocupado = f.indexOf("if exists (select 1 from partner_codigos where codigo = p_nuevo) then return 'ocupado'; end if;");
  const deOtro = f.indexOf("if exists (select 1 from partner_codigos_anteriores where codigo = p_nuevo and workspace_id <> p_ws) then return 'ocupado'; end if;");
  const guarda = f.indexOf('insert into partner_codigos_anteriores (codigo, workspace_id) values (v_viejo, p_ws)');
  const cambia = f.indexOf('update partner_codigos set codigo = p_nuevo where workspace_id = p_ws;');
  assert.ok(lock > 0 && ocupado > lock && deOtro > lock && guarda > deOtro && cambia > guarda, 'candado, chequeos, guardar el viejo y recién ahí cambiar');
  assert.match(sql, /revoke all on function cambiar_codigo_partner\(bigint, text\) from public, anon, authenticated;\s*grant execute on function cambiar_codigo_partner\(bigint, text\) to service_role;/);
  // El código que nace del nombre tampoco puede ser el viejo de otro: choca como «ocupado» y `codigoDe` prueba con sufijo.
  assert.match(sql, /before insert or update of codigo on partner_codigos/);
  assert.match(sql, /a\.codigo = new\.codigo and a\.workspace_id <> new\.workspace_id[\s\S]*errcode = '23505'/);
});

test('cada lectura mira los ANTERIORES: el link viejo, el código al pagar, el panel, el programa y la acreditación', () => {
  const p = 'lib/partners-programa.ts';
  assert.match(cuerpo(p, 'wsDelCodigo'), /return data \? Number\(\(data as \{ workspace_id: number \}\)\.workspace_id\) : wsDeCodigoAnterior\(codigo\);/,
    'acreditarReferidos y las visitas van por acá');
  assert.match(cuerpo(p, 'esCodigoDePartner'), /: await wsDeCodigoAnterior\(codigo\);/, 'el código viejo escrito al pagar vale');
  assert.match(cuerpo(p, 'codigoVigente'), /const ws = await wsDeCodigoAnterior\(codigo\);\n\s*return ws == null \? null : codigoSiExiste\(ws\);/);
  assert.match(cuerpo(p, 'tableroDe'), /comprasConCodigo\(plataforma, \[codigo, \.\.\.\(await codigosAnterioresDe\(ws\)\)\]\)/, 'lo que trajo antes de cambiarlo');
  assert.match(cuerpo(p, 'comprasConCodigo'), /\.in\('ref_codigo', \[\.\.\.codigos\]\)/);
  assert.match(cuerpo(p, 'resumenDelPrograma'), /codigos: \[\.\.\.listaCodigos, \.\.\.listaAnteriores\]/, 'el programa cuenta las compras con el viejo');
  // /r/<viejo> lleva con el código nuevo (la cookie y el ?ref=).
  const r = fuente('app/r/[codigo]/route.ts');
  assert.match(r, /const codigo = limpio \? await codigoVigente\(limpio\)\.catch\(\(\) => null\) : null;/);
  assert.ok(r.indexOf('codigoVigente(limpio)') < r.indexOf('res.cookies.set(COOKIE_REF, codigo'), 'la cookie lleva el vigente');
});

test('SIN la migración, cambiar no se hace (perdería lo que ya mandó), y las lecturas siguen como antes', () => {
  const f = cuerpo('lib/partners-programa.ts', 'cambiarCodigoPartner');
  assert.match(f, /const \{ data, error \} = await getSupabaseServer\(\)\.rpc\('cambiar_codigo_partner', \{ p_ws: ws, p_nuevo: v\.codigo \}\);/);
  assert.match(f, /if \(error\) \{[\s\S]*?return \{ ok: false, error: 'Todavía no se puede cambiar el código\. Prueba más tarde\.' \};/);
  assert.doesNotMatch(f, /from\('partner_codigos'\)\.update/, 'nunca un update suelto: el viejo se guardaría a medias');
  assert.match(f, /if \(!\(await altaDePartner\(ws\)\.catch\(\(\) => null\)\)\) return/, 'sólo un partner');
  for (const n of ['wsDeCodigoAnterior', 'codigosAnterioresDe']) {
    assert.match(cuerpo('lib/partners-programa.ts', n), /error \? \[\]|!error && data/, `${n}: sin la tabla, ninguno`);
  }
});

test('se CAMBIA desde el panel («Cambiar», con lo de antes que sigue contando) y por la API', () => {
  const panel = fuente('app/partners/PanelPartner.tsx');
  assert.match(panel, /<CodigoEditable codigo=\{ref\.codigo\} onCambio=\{setRef\} \/>/);
  assert.match(panel, /const r = await cambiarCodigoPartnerAction\(valor\)/);
  assert.match(panel, /Tu link y tu código de antes siguen contando para ti\./);
  assert.match(fuente('app/partners/actions.ts'), /export async function cambiarCodigoPartnerAction\(codigo: string\)[\s\S]*?const ws = await adminDeWorkspaceActual\(\);\n  if \(ws == null\) return/);
  const def = fuente('lib/api-mako/areas/negocio.def.ts');
  assert.match(def, /id: 'cambiar_codigo_partners', area: 'negocio', tipo: 'accion', confirmacion: 'chat', reversible: true,/);
  assert.ok(fuente('lib/api-mako/rest.ts').includes("['PUT', '/negocio/partners/codigo', 'cambiar_codigo_partners'],"));
  assert.match(fuente('tests/api-mako-http.snapshot.txt'), /^cambiar_codigo_partners\r?$/m, 'en el snapshot de lo que sale por HTTP');
  const run = fuente('lib/api-mako/areas/negocio.run.ts');
  assert.match(run, /const r = await cambiarCodigoPartner\(ctx\.ws, payload\.codigo\);/);
});

// Probado rompiéndolo (27/10/2026), una rotura por vez sobre la base en verde (5 pases, 0 fallos), restaurando el texto con un
// script (nunca git). Rota (pases / fallos):
//   · el código viejo ya no acredita (`wsDelCodigo` sin los anteriores)        → 4 / 1
//   · guiones en los bordes                                                    → 4 / 1
//   · tomar el código viejo de otro (la mig sin ese chequeo)                   → 4 / 1
//   · /r sin el código vigente                                                 → 4 / 1
