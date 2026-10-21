// =============================================================================
// El nombre del negocio también en el PERFIL (21/10/2026)
// =============================================================================
// Martín buscó el nombre del negocio de Florencia (ws21) en «Perfil de Florencia» (/perfil?ws=21) y no estaba: vivía
// sólo en Configuración › Tu negocio. Ahora el perfil (la computadora, y la hoja del teléfono en /m/cuenta) tiene la fila
// «Nombre del negocio» para quien lo puede cambiar, con la MISMA acción y la MISMA regla que «Tu negocio»; para él,
// «Empresa» no se ofrece (lib/nombre-negocio.ts → `muestraEmpresa`, con el porqué).
//
// ROTURAS: ver el final del archivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { muestraEmpresa, muestraNegocio } from '../lib/nombre-negocio';

const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('quién ve la fila: el admin del negocio (y el super admin mirando); los demás, «Empresa»', () => {
  const admin = { nombre: 'Consultesis', puedeEditar: true };
  const delEquipo = { nombre: 'Consultesis', puedeEditar: false };
  assert.equal(muestraNegocio(admin), true);
  assert.equal(muestraEmpresa(admin), false, 'el admin ve «Empresa» y «Nombre del negocio» juntas: la confusión de Martín');
  assert.equal(muestraNegocio(delEquipo), false, 'alguien que no lo puede cambiar ve una fila que no guarda');
  assert.equal(muestraEmpresa(delEquipo), true, 'un closer perdió su «Empresa»');
  for (const sinLeer of [null, undefined]) {
    assert.equal(muestraNegocio(sinLeer), false);
    assert.equal(muestraEmpresa(sinLeer), true, 'sin leer el negocio, se perdía «Empresa»');
  }
});

test('la fila guarda con la MISMA acción que «Tu negocio», dice por qué no y vuelve a dibujar la app', () => {
  const info = sinComentarios(leer('app/perfil/InformacionPersonal.tsx'));
  assert.match(info, /\{muestraNegocio\(negocio\) && fila\('negocio', nombreNegocio\)\}/);
  assert.match(info, /\{muestraEmpresa\(negocio\) && fila\('empresa', perfil\.empresa\)\}/);
  assert.match(info, /if \(editando === 'negocio'\) \{ await guardarNegocio\(\); return; \}/, 'se guardaba en el perfil de la persona');
  assert.match(info, /const r = await guardarNombreNegocioAction\(borrador\);\n\s*if \(!r\.ok\) \{ setError\(r\.error\); return; \}/, 'un nombre rechazado no se decía');
  assert.match(info, /setNombreNegocio\(r\.nombre\);\n\s*setEditando\(null\);\n\s*router\.refresh\(\);/, 'el encabezado seguía con el nombre viejo');
});

test('las dos pantallas leen el negocio con la MISMA lectura y se lo pasan a la fila', () => {
  const pc = sinComentarios(leer('app/perfil/page.tsx'));
  assert.match(pc, /nombreDelNegocioAction\(\)\.catch\(\(\) => null\)/);
  assert.match(pc, /<InformacionPersonal inicial=\{perfil\} vista=\{vista\} negocio=\{negocio\} \/>/, 'la computadora no muestra la fila');
  const movil = sinComentarios(leer('app/m/cuenta/page.tsx'));
  assert.match(movil, /nombreDelNegocioAction\(\)\.catch\(\(\) => null\)/);
  assert.match(movil, /\n\s*nombreNegocio,\n\s*\};/);
  assert.match(sinComentarios(leer('app/m/cuenta/CuentaM.tsx')), /negocio=\{datos\.nombreNegocio\}/, 'el teléfono no muestra la fila');
});

// ROTURAS (21/10/2026, romper.js + roturas-perfil.json del scratchpad del chat «Onboarding»; base 3/0), 7 de 7, cada una
// 2/1: la fila para cualquiera del equipo · «Empresa» también para el admin · se guarda en el perfil de la persona · un
// nombre rechazado no se dice · sin volver a dibujar la app · la computadora no pasa el negocio · el teléfono tampoco.
