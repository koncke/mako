// =============================================================================
// El nombre del negocio también en el PERFIL (21/10/2026)
// =============================================================================
// Martín buscó el nombre del negocio de Florencia (ws21) en «Perfil de Florencia» (/perfil?ws=21) y no estaba: vivía
// sólo en Configuración › Tu negocio. Ahora el perfil (la computadora, y la hoja del teléfono en /m/cuenta) tiene la fila
// «Nombre del negocio» para quien lo puede cambiar, con la MISMA acción y la MISMA regla que «Tu negocio». «Empresa»
// no se le ofrece a quien ve esa fila desde el rediseño de Settings (25/10/2026, docs/hallazgos-ajustes.md).
//
// ROTURAS: ver el final del archivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { muestraNegocio } from '../lib/nombre-negocio';

const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('quién ve la fila: el admin del negocio (y el super admin mirando)', () => {
  assert.equal(muestraNegocio({ nombre: 'Consultesis', puedeEditar: true }), true);
  assert.equal(muestraNegocio({ nombre: 'Consultesis', puedeEditar: false }), false, 'alguien que no lo puede cambiar ve una fila que no guarda');
  for (const sinLeer of [null, undefined]) assert.equal(muestraNegocio(sinLeer), false);
});

test('la fila guarda con la MISMA acción que «Tu negocio», dice por qué no y vuelve a dibujar la app', () => {
  // Desde el 25/10/2026 el campo está EN la fila y guarda al salir (el Profile de Linear, docs/settings/referencia.md): ya no
  // hay `editando` ni «Guardar». Lo que se cuida es lo mismo de antes.
  const info = sinComentarios(leer('app/perfil/InformacionPersonal.tsx'));
  assert.match(info, /const conNegocio = muestraNegocio\(negocio\);/);
  assert.match(info, /\{conNegocio && \(\s*<FilaCampo titulo="Nombre del negocio">[\s\S]{0,260}onGuardar=\{guardarNegocio\}/, 'la fila del negocio se perdió o guarda en el perfil de la persona');
  assert.match(info, /const r = await guardarNombreNegocioAction\(v\);\n\s*if \(!r\.ok\) \{ setError\(r\.error\); return false; \}/, 'un nombre rechazado no se decía');
  assert.match(info, /setNombreNegocio\(r\.nombre\);[\s\S]{0,80}router\.refresh\(\);/, 'el encabezado seguía con el nombre viejo');
  // «Empresa» ya no se ofrece a quien ve «Nombre del negocio» (docs/hallazgos-ajustes.md: al lado confundía); al resto, sí.
  assert.match(info, /\{!conNegocio && \(\s*<FilaCampo titulo="Empresa">/);
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

// ROTURAS (22/10/2026, romper.js + roturas-perfil.json del scratchpad del chat «Onboarding»; base 3/0), 6 de 6, cada una
// 2/1: la fila para cualquiera del equipo · se guarda en el perfil de la persona · un nombre rechazado no se dice · sin
// volver a dibujar la app · la computadora no pasa el negocio · el teléfono tampoco.
