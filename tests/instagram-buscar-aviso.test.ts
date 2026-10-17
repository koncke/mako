// =============================================================================
// #844: el buscador de Instagram del alta dice POR QUÉ no encuentra (17/10/2026)
// =============================================================================
// Martín, revisión del 16/10 (11:53): «pones martinkon... dice sin resultado y es mentira. Yo busqué incluso mi usuario
// idéntico y aún dice sin resultado». Por NOMBRE no hay fuente oficial y gratis (Google cerró su Custom Search a
// clientes nuevos, Bing apagó la suya el 11/08/2025, Brave sacó su plan gratis); por @, Business Discovery de Meta sólo
// ve cuentas de empresa o creador, y sólo con la conexión de Meta del negocio. «Sin resultados» decía lo mismo para
// las cinco cosas. Lo que se fija:
//   1. la frase (`avisoSinResultados`), EJECUTADA: por nombre, que escriba el @; por @, cuenta personal, sin Meta
//      conectado, sin permiso o Meta no contestó; «Sin resultados» sólo cuando Meta contestó que no hay;
//   2. la ruta devuelve qué pasó con Meta en cada salida de `buscarEnMeta`;
//   3. la pantalla usa esa frase y el campo ya no promete buscar por nombre.
//
// PROBADO ROMPIÉNDOLO (17/10/2026), con el archivo en 3 / 0, una rotura por vez y restaurada:
//   · la frase sin el caso del nombre (todo cae a lo de Meta)                   → 2 / 1
//   · la ruta sin `meta` en la respuesta                                        → 2 / 1
//   · la lista con el «Sin resultados» fijo de antes                            → 2 / 1
// Correr: node --import tsx --test tests/instagram-buscar-aviso.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avisoSinResultados, esEstadoMeta } from '../lib/instagram-buscar';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('la frase dice por qué: por nombre no se puede, y por @ lo que pasó con Meta', () => {
  const nombre = avisoSinResultados({ esUsuario: false, meta: 'no-esta', porNombre: false });
  assert.equal(nombre, 'Por nombre no se puede: escribe su @');
  assert.equal(avisoSinResultados({ esUsuario: false, meta: 'sin-conexion', porNombre: null }), nombre, 'con un nombre, primero lo que puede hacer');
  assert.equal(avisoSinResultados({ esUsuario: true, meta: 'no-esta', porNombre: false }), 'Meta no la muestra: es personal o no existe');
  assert.equal(avisoSinResultados({ esUsuario: true, meta: 'sin-conexion', porNombre: false }), 'Conecta Meta para ver su cuenta');
  assert.equal(avisoSinResultados({ esUsuario: true, meta: 'sin-permiso', porNombre: false }), 'Meta no da permiso: revisa la conexión');
  assert.equal(avisoSinResultados({ esUsuario: true, meta: 'no-pude', porNombre: null }), 'Meta no contestó');
  // Con una fuente por nombre que SÍ contestó (hoy ninguna), un nombre sin resultados es un «no hay» de verdad.
  assert.equal(avisoSinResultados({ esUsuario: false, meta: 'no-esta', porNombre: true }), 'Meta no la muestra: es personal o no existe');
  assert.equal(avisoSinResultados({ esUsuario: true, meta: null, porNombre: null }), 'Sin resultados');
  assert.ok(esEstadoMeta('no-esta') && !esEstadoMeta('true') && !esEstadoMeta(null));
});

test('la ruta cuenta qué pasó con Meta en cada salida', () => {
  const ruta = leer('app/api/crm/instagram-buscar/route.ts');
  const fn = ruta.slice(ruta.indexOf('async function buscarEnMeta('), ruta.indexOf('// ── 2. Google'));
  const salidas = [...fn.matchAll(/return \{ perfiles: encontrados, estado: ([^}]*) \};/g)].map((m) => m[1].trim());
  assert.deepEqual(salidas, [
    "estadoDe(encontrados, 'no-esta')",                                              // todo estaba en la caché
    'estadoDe(encontrados, pausaDe(pausa))',                                         // la conexión está en pausa
    "estadoDe(encontrados, motivo === 'sin-permiso' ? 'sin-permiso' : 'no-pude')",   // leer la cuenta de la página falló
    "estadoDe(encontrados, 'sin-conexion')",                                         // sin conexión de Meta o sin Instagram
    'estadoDe(encontrados, peor)',                                                   // preguntó cada @
  ]);
  assert.match(ruta, /perfiles: combinarPerfiles\(meta\.perfiles, google\?\.perfiles \?\? \[\]\),\n\s*meta: meta\.estado,/, 'la respuesta no dice qué pasó con Meta');
});

test('la pantalla dice la frase y el campo no promete buscar por nombre', () => {
  const comp = leer('app/crm/new/InstagramBuscador.tsx');
  assert.match(comp, /\{avisoSinResultados\(\{\n\s*esUsuario: usuarioDeTexto\(consulta\) != null,/);
  assert.doesNotMatch(comp, /Sin resultados\{/, 'volvió el «Sin resultados» fijo');
  assert.match(comp, /meta: esEstadoMeta\(j\.meta\) \? j\.meta : null/);
  assert.doesNotMatch(comp, /placeholder="Busca por nombre/, 'el campo promete buscar por nombre, y no hay con qué');
});
