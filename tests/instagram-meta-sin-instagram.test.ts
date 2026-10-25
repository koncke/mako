// =============================================================================
// El buscador de Instagram con Meta CONECTADA pero sin Instagram (24/10/2026, punto 21)
// =============================================================================
// Martín, textual: «Aún no funciona el buscador de Instagram... Mira que puse el usuario exacto y no me da la vista previa
// con la foto de perfil... Me dice "conectar meta" cuando en la cuenta de mauricio ya lo tengo conectado, no tiene
// sentido...» (captura: «Su cuenta se busca con tu Meta · Conectar Meta» DOS veces).
// Medido ese día con la conexión de Mauricio (scripts de sólo lectura, sin imprimir el token): token propio, la página
// «Mauricio Bustos Eguia», diez permisos y NINGUNO de Instagram; la página no devuelve `instagram_business_account`. O sea:
// Meta conectada, sin Instagram. Era `sin-conexion` y pedía «Conectar Meta». La foto no llega por ninguna fuente (sin
// Instagram en Meta, sin claves de Apify ni de Google): eso no se arregla en el código (ver docs/hallazgos-crm.md).
// PROBADO ROMPIÉNDOLO: ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AVISO_SIN_INSTAGRAM, avisoSinResultados, esConexionMeta, esEstadoMeta, pideConectarMeta } from '../lib/instagram-buscar';

const leer = (r: string) => readFileSync(join(import.meta.dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');

test('con Meta conectada pero sin Instagram, no se pide «Conectar Meta» y se dice por qué', () => {
  assert.ok(esConexionMeta('sin-instagram') && esEstadoMeta('sin-instagram'));
  assert.equal(pideConectarMeta('sin-instagram'), false, 'mandar a conectar lo conectado');
  assert.equal(pideConectarMeta('sin-conexion'), true);
  assert.equal(avisoSinResultados({ esUsuario: true, meta: 'sin-instagram', porNombre: null }), 'Tu Meta no tiene Instagram vinculado');
  assert.match(AVISO_SIN_INSTAGRAM, /escribe el @ exacto/, 'el @ a mano sigue');
});

test('la ruta distingue «sin token» de «con token y sin Instagram», y «Conectar Meta» sale una vez', () => {
  const ruta = leer('app/api/crm/instagram-buscar/route.ts');
  assert.match(ruta, /if \(!token \|\| !ig\) return \{ perfiles: encontrados, estado: estadoDe\(encontrados, token \? 'sin-instagram' : 'sin-conexion'\) \};/);
  assert.match(ruta, /return token && ig \? 'conectado' : token \? 'sin-instagram' : 'sin-conexion';/);
  const comp = leer('app/crm/new/InstagramBuscador.tsx');
  assert.equal((comp.match(/&& botonConectar\}/g) ?? []).length, 2, 'el botón se dibuja en dos lugares (debajo del campo y en la fila)');
  assert.match(comp, /pideConectarMeta\(metaDeLaBusqueda\) && !pideConectarMeta\(conexion\) && botonConectar/, 'los dos a la vez');
});

// PROBADO ROMPIÉNDOLO (25/10/2026), contra una base de 2 / 0, de a una y restaurando de una copia:
//   · `pideConectarMeta` que también pide con 'sin-instagram'                               → 1 / 1
//   · la ruta volviendo a 'sin-conexion' con token                                          → 1 / 1
//   · la fila sin `!pideConectarMeta(conexion)` (el botón dos veces)                        → 1 / 1
