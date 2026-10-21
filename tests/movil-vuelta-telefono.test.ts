// =============================================================================
// «Abrir en la computadora» abre UNA pantalla, y siempre hay vuelta al teléfono (20/10/2026)
// =============================================================================
// Martín, desde su Android (Ops Center, 20/10 19:36): «Veo MaKo mobile roto, como si estuviera en desktop,
// solucionalo». Tocó «General» de Configuración del negocio, que no tiene pantalla en el teléfono; la hoja «Abrir en la
// computadora» puso `mako_vista=escritorio` por 12 h para TODA la app, y no había vuelta: `cookieVistaMovil` existía y
// nadie la llamaba, y una ruta /m con la cookie puesta va al escritorio.
//
// Probado ROMPIÉNDOLO, de a uno, con la base en 4 pases y 0 fallos:
//   · la cookie de una pantalla valiendo para toda la app                 → 3 / 1 (una pantalla)
//   · una subruta contando como la pantalla                               → 3 / 1 (una pantalla)
//   · el proxy decidiendo sin la ruta                                     → 3 / 1 (una pantalla)
//   · «Abrir en la computadora» con la cookie global otra vez             → 3 / 1 (los llamadores)
//   · «Volver al teléfono» sin borrar la cookie                           → 3 / 1 (la vuelta)
//   · el layout sin montar la vuelta                                      → 3 / 1 (la vuelta)
//   · la puerta global dejando de ser global                              → 3 / 1 (la puerta global)
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  VISTA_COOKIE, VISTA_ESCRITORIO, cookieVistaEscritorio, cookieVistaMovil, vaAMovil, vistaEscritorioEn, vistaEscritorioGlobal,
} from '../lib/movil-dispositivo';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El valor que queda en el navegador después de `document.cookie = …`. */
const valorDe = (cookie: string) => {
  const m = new RegExp(`^${VISTA_COOKIE}=([^;]*)`).exec(cookie);
  assert.ok(m, `no es la cookie de vista: ${cookie}`);
  return m[1];
};

test('con la cookie de UNA pantalla, sólo esa va a la computadora: cualquier otra ruta va al teléfono', () => {
  const vista = valorDe(cookieVistaEscritorio('/configuraciones?tab=general#horario'));
  assert.equal(vaAMovil('telefono', vista, '/configuraciones'), false, 'la pantalla pedida no se abre en la computadora');
  assert.equal(vaAMovil('telefono', vista, '/configuraciones/'), false, 'la barra del final cambia la ruta');
  for (const otra of ['/crm', '/inicio', '/m/configuraciones', '/configuraciones/notificaciones', '/configuracionesx']) {
    assert.equal(vaAMovil('telefono', vista, otra), true, `${otra} quedó en la computadora`);
  }
  // Sin la ruta (lo de antes del 20/10/2026), una cookie de una pantalla no se lleva el teléfono.
  assert.equal(vaAMovil('telefono', vista), true);
  // Una cookie rota no manda a la computadora.
  assert.equal(vistaEscritorioEn('escritorio:%E0%A4%A', '/crm'), false);
  assert.equal(vistaEscritorioEn('escritorio:', '/'), false);
  // El proxy y el server deciden con la ruta (la misma pregunta en los dos lados).
  assert.match(sinComentarios(leer('proxy.ts')), /req\.cookies\.get\(VISTA_COOKIE\)\?\.value,\s*pathname,\s*\);\s*const d = pedidoMovil\(/);
  assert.match(sinComentarios(leer('lib/movil-guard.ts')), /c\.get\(VISTA_COOKIE\)\?\.value, h\.get\(HEADER_RUTA\) \?\? ''\);/);
});

test('«Abrir en la computadora» (More, Inbox, la cubierta del desvío) escribe la cookie de ESA pantalla', () => {
  assert.match(sinComentarios(leer('app/m/_ui/EnComputadoraM.tsx')), /document\.cookie = cookieVistaEscritorio\(href\);/);
  assert.match(sinComentarios(leer('app/m/inbox/InboxM.tsx')), /document\.cookie = cookieVistaEscritorio\(it\.linkEscritorio\);/);
  assert.match(sinComentarios(leer('app/_components/DesvioMovil.tsx')), /document\.cookie = cookieVistaEscritorio\(window\.location\.pathname\);/);
});

test('la vuelta: un teléfono en la versión de computadora tiene «Volver al teléfono», que borra la cookie', () => {
  const vuelta = sinComentarios(leer('app/_components/VueltaAlTelefono.tsx'));
  assert.match(vuelta, /document\.cookie = cookieVistaMovil\(\);\s*window\.location\.replace\(window\.location\.pathname \+ window\.location\.search\);/);
  assert.match(vuelta, />\s*Volver al teléfono\s*</);
  // Con la cookie de una pantalla, salir de ella también vuelve (la navegación interna no recarga el layout raíz).
  assert.match(vuelta, /if \(!global && pathname !== inicial\.current\) window\.location\.reload\(\);/);
  assert.match(cookieVistaMovil(), new RegExp(`^${VISTA_COOKIE}=; Path=/; Max-Age=0`));
  // El layout lo monta cuando un TELÉFONO ve la computadora por la cookie (y sólo ahí).
  const layout = sinComentarios(leer('app/layout.tsx'));
  assert.match(layout, /const enEscritorioDesdeTelefono = MOVIL_ACTIVO && sesion && !esTelefono \? await vistaEscritorioEnTelefono\(\) : null;/);
  assert.match(layout, /\{enEscritorioDesdeTelefono && <VueltaAlTelefono global=\{enEscritorioDesdeTelefono\.global\} \/>\}/);
  assert.match(sinComentarios(leer('lib/movil-guard.ts')), /if \(tipoDeDispositivo\(h\.get\('user-agent'\), h\.get\('sec-ch-ua-mobile'\)\) !== 'telefono'\) return null;/);
});

test('la puerta global sigue andando: «Versión de computadora» de More es toda la app, y tiene la misma vuelta', () => {
  const global = valorDe(cookieVistaEscritorio());
  assert.equal(global, VISTA_ESCRITORIO);
  assert.equal(vistaEscritorioGlobal(global), true);
  for (const r of ['/crm', '/configuraciones', '/m/mas']) assert.equal(vaAMovil('telefono', global, r), false, `${r} volvió al teléfono`);
  assert.equal(vistaEscritorioGlobal(valorDe(cookieVistaEscritorio('/crm'))), false);
  assert.match(sinComentarios(leer('app/m/mas/VersionComputadora.tsx')), /document\.cookie = cookieVistaEscritorio\(\);/);
  // La computadora y la tableta no cambian.
  assert.equal(vaAMovil('escritorio', undefined, '/crm'), false);
  assert.equal(vaAMovil('tablet', undefined, '/crm'), false);
});
