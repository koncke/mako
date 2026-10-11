// =============================================================================
// Los avisos que configura SÓLO el super admin (lib/avisos-catalogo.ts, AVISOS_SOLO_SUPERADMIN)
// =============================================================================
// Martín, 10/10/2026: «hay ciertos mensajes que no deberían configurarse del lado del cliente, solo de
// SuperAdmin, como el de "Tu WhatsApp se desconectó"», y «El de Fathom también debería ser algo que se
// configura en SuperAdmin».
//
// Un cliente tenía TRES puertas para tocarlos, y se fija cada una (un rojo dice cuál):
//   1. la lista de su tab (`AVISOS_DEL_CLIENTE`, la que pinta /automations);
//   2. la API de su tab (`/api/perfil/plantillas`): esconder la fila no impedía un POST con el id;
//   3. MaKo (`configurar_aviso_whatsapp`, lib/api-mako/areas/equipo.run.ts), al proponer y al confirmar.
//
// PROBADO ROMPIÉNDOLO (10/10/2026, base en verde: 0 fallos, 4 pases; restaurado de memoria):
//   R1  `wa-desconectado` de vuelta en la lista del cliente      → 1 fallo  (las listas)
//   R2  el guard del POST, borrado                                → 1 fallo  (la API)
//   R3  el guard del GET ?id, borrado                             → 1 fallo  (la API)
//   R4  `soloDelSuperAdmin` deja pasar a todos                    → 1 fallo  (la API)
//   R5  `configurar_aviso_whatsapp` sin el guard al proponer      → 1 fallo  (MaKo)
//   R6  `configurar_aviso_whatsapp` sin el guard al confirmar     → 1 fallo  (MaKo)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATALOGO_AVISOS, AVISOS_DEL_CLIENTE, AVISOS_SOLO_SUPERADMIN, esAvisoSoloSuperAdmin } from '../lib/avisos-catalogo';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El bloque de `desde` hasta `hasta` (su cierre real, no un número de caracteres). */
function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre «${hasta}» de «${desde}»`);
  return src.slice(i, j);
}

// El reporte de los lunes se sumó el 11/10/2026: no se mudó a «MaKo en WhatsApp» (sale sólo por email, según
// `notification_prefs`) y salió de la lista del cliente (docs/diseno-mako-en-whatsapp-unificado.md).
test('las listas: los cuatro son del super admin, existen en el catálogo y NO están en la del cliente', () => {
  for (const id of ['wa-desconectado', 'wa-reconectado', 'reunion-ocurrio-fathom', 'reporte-semanal']) {
    assert.ok(esAvisoSoloSuperAdmin(id), `«${id}» no es del super admin`);
  }
  for (const id of AVISOS_SOLO_SUPERADMIN) {
    assert.ok(CATALOGO_AVISOS.some((c) => c.id === id), `«${id}» no existe en el catálogo`);
    assert.ok(!AVISOS_DEL_CLIENTE.includes(id), `«${id}» está en la lista del cliente`);
  }
});

const RUTA = sinComentarios(leer('app/api/perfil/plantillas/route.ts'));

test('la API de la tab: el guard contesta 404 salvo al super admin', () => {
  const guard = bloque(RUTA, 'async function soloDelSuperAdmin', '\n}\n');
  assert.match(guard, /esAvisoSoloSuperAdmin\(id\)/);
  assert.match(guard, /await getSesionAdmin\(\)/);
  assert.match(guard, /status: 404/);
  assert.match(guard, /if \(!id \|\| !esAvisoSoloSuperAdmin\(id\) \|\| \(await getSesionAdmin\(\)\)\) return null;/, 'el guard deja pasar a quien no es super admin');
});

test('la API de la tab: el GET con id y TODO el POST pasan por el guard ANTES de hacer nada', () => {
  const get = bloque(RUTA, 'export async function GET', 'export async function POST');
  const iGuardGet = get.indexOf('soloDelSuperAdmin(id)');
  assert.ok(iGuardGet > 0 && iGuardGet < get.indexOf('getPlantilla(id)'), 'el GET ?id lee el aviso sin el guard');
  const post = RUTA.slice(RUTA.indexOf('export async function POST'));
  const iGuardPost = post.indexOf('soloDelSuperAdmin(b.id)');
  assert.ok(iGuardPost > 0 && iGuardPost < post.indexOf('switch (b.action)'), 'el POST no pasa por el guard antes del switch');
});

test('MaKo: configurar_aviso_whatsapp no los cambia, ni al proponer ni al confirmar', () => {
  const src = sinComentarios(leer('lib/api-mako/areas/equipo.run.ts'));
  const op = bloque(src, 'configurar_aviso_whatsapp: {', 'quitar_destinatario_notificaciones: {');
  const preparar = bloque(op, 'preparar:', 'ejecutar:');
  const ejecutar = op.slice(op.indexOf('ejecutar:'));
  for (const [nombre, cuerpo, escritura] of [['proponer', preparar, 'getNotifPrefs()'], ['confirmar', ejecutar, 'setNotifPrefs(']] as const) {
    const g = cuerpo.indexOf('esAvisoSoloSuperAdmin(aviso)');
    assert.ok(g > 0 && g < cuerpo.indexOf(escritura), `al ${nombre} no frena los avisos del super admin`);
  }
});
