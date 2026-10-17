// =============================================================================
// La API de MaKo y Knowledge en el teléfono: las mismas URLs, puertas y lecturas que la computadora
// =============================================================================
// 17/10/2026, «Mobile 2». Lo que fija este archivo es lo invisible:
//   · /api-mako con su `?tab=` (docs · tokens · registro) en los dos sentidos: un aviso que vuelve a la computadora no
//     pierde la pestaña;
//   · la API lee con las funciones de escritorio (`indiceDocs`, `listarTokens` SIN secretos, `usoDe`), su puerta es la
//     key `api-mako`, eliminar un token es la acción de escritorio, y CREAR uno queda en la computadora con su motivo;
//   · Knowledge abre el curso y la clase de los links de siempre (`?curso=&clase=`), con la puerta del super admin y
//     los cambios del super admin aplicados (`aplicarAjustes`), sin las clases ocultas.
//
// Verificado ROMPIÉNDOLO (17/10/2026, scratchpad/mobile2/romper_m2.py, de a una; base 4 / 0):
//   · `rutaMovil('/api-mako')` sin `aSeccion` (la pestaña se caía)        → 3 / 1
//   · la clase sin `clase=` de vuelta en `rutaEscritorio`                 → 3 / 1
//   · el curso del teléfono con `conOcultos: true`                        → 3 / 1
//   · la API mandándole un `hash` al navegador en cada token             → 3 / 1
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rutaEscritorio, rutaInterna, rutaMovil } from '../lib/movil-rutas';
import { cabeceraPorRuta } from '../app/m/_ui/cabecera';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('las mismas URLs: /api-mako con su pestaña, y Knowledge con el curso y la clase', () => {
  assert.equal(rutaMovil('/api-mako'), '/m/api-mako');
  assert.equal(rutaMovil('/api-mako?tab=tokens&ws=3'), '/m/api-mako?tab=tokens');
  assert.equal(rutaEscritorio('/m/api-mako?tab=registro'), '/api-mako?tab=registro');
  assert.equal(cabeceraPorRuta('/m/api-mako').titulo, 'API');
  assert.equal(rutaMovil('/conocimientos'), '/m/conocimientos');
  assert.equal(rutaMovil('/conocimientos?curso=curso-vsl&ws=9'), '/m/conocimientos/curso-vsl');
  assert.equal(rutaMovil('/conocimientos?curso=curso-vsl&clase=3'), '/m/conocimientos/curso-vsl/3');
  assert.equal(rutaMovil('/conocimientos?curso=curso-vsl&clase=x'), '/m/conocimientos/curso-vsl');
  assert.equal(rutaEscritorio('/m/conocimientos/curso-vsl/3'), '/conocimientos?curso=curso-vsl&clase=3');
  assert.equal(rutaEscritorio('/m/conocimientos/curso-vsl'), '/conocimientos?curso=curso-vsl');
  assert.equal(rutaInterna('/conocimientos', 'curso=curso-vsl&clase=3'), '/m/conocimientos/curso-vsl/3');
  assert.deepEqual(cabeceraPorRuta('/m/conocimientos/curso-vsl').padre, { href: '/m/conocimientos', label: 'Knowledge' });
});

test('la API lee con las funciones de escritorio, sin secretos, y crear un token queda en la computadora', () => {
  const escritorio = leer('app/api-mako/page.tsx');
  assert.match(escritorio, /requireRolWs\(\[\], \{ nav: 'api-mako' \}\)/, 'cambió la puerta de escritorio');
  const movil = leer('app/m/api-mako/page.tsx');
  assert.match(movil, /requireMovil\(\{ navKey: 'api-mako' \}\)/);
  for (const f of ['indiceDocs(await vistaDeLaTab(ctx.ws))', 'listarTokens(ctx.ws)', 'usoDe(ctx.ws, null)']) assert.ok(movil.includes(f), `sin ${f}`);
  // Al navegador va lo que dibuja: nunca el hash de un token.
  assert.doesNotMatch(movil, /\bhash\b/);
  const cliente = leer('app/m/api-mako/ApiMakoM.tsx');
  assert.match(cliente, /revocarTokenApi\(abierto\.id\)/, 'eliminar es la acción de escritorio');
  assert.match(cliente, /<FilaEnComputadoraM icono="plus" titulo="Crear un token"/);
  assert.doesNotMatch(cliente, /crearTokenApi|regenerarTokenApi/, 'crear o regenerar muestra el valor UNA vez: en la computadora');
});

test('Knowledge: la puerta del super admin y los cambios del super admin, sin lo oculto', () => {
  assert.match(leer('app/conocimientos/page.tsx'), /getSesionAdmin\(\)/, 'cambió la puerta de escritorio');
  for (const f of ['app/m/conocimientos/page.tsx', 'app/m/conocimientos/[slug]/page.tsx', 'app/m/conocimientos/[slug]/[n]/page.tsx']) {
    const src = leer(f);
    assert.ok(src.indexOf('if (!(await getSesionAdmin())) redirect(') > 0, `${f}: sin la puerta del super admin`);
  }
  assert.match(leer('app/m/conocimientos/page.tsx'), /CURSOS_TODOS\.map\(\(c\) => ajustarFicha\(c, filas\)\)/, 'el catálogo de escritorio con sus ajustes');
  for (const f of ['app/m/conocimientos/[slug]/page.tsx', 'app/m/conocimientos/[slug]/[n]/page.tsx']) {
    assert.match(leer(f), /aplicarAjustes\(base, .*\{ conOcultos: false \}\)/, `${f}: a nadie más se le mandan las ocultas`);
  }
});

test('el video de una clase es el reproductor de Drive de la computadora', () => {
  const escritorio = leer('app/conocimientos/CursoConocimientos.tsx');
  assert.ok(escritorio.includes('https://drive.google.com/file/d/${c.videoId}/preview'), 'cambió el reproductor de escritorio');
  assert.ok(leer('app/m/conocimientos/[slug]/[n]/page.tsx').includes('https://drive.google.com/file/d/${c.videoId}/preview'));
});
