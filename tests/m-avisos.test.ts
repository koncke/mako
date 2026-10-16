// =============================================================================
// MaKo Mobile — «Avisos» (app/m/inbox, la campana de General), v3: lo que se rompe sin un error
// =============================================================================
// El v3 (15/10/2026) destila la pantalla contra escritorio: «el teléfono destila el escritorio,
// mismos rótulos» (AGENTS.md, «MaKo Mobile (/m)»). Esto fija:
//   · los BOTONES son los de escritorio (/mako/pendientes y /mako/revisar/<id>), cruzados contra
//     el FUENTE de escritorio: si escritorio renombra un botón, esto falla y se renombra acá. Antes
//     el teléfono decía «Ejecutar la acción» donde escritorio decía «Confirmar y ejecutar»;
//   · las filas clave → valor del sheet usan los rótulos de los datos de /mako/pendientes, y el
//     sheet no escribe rótulos a mano (salvo «Lead», el de la tarjeta del CRM automático);
//   · la fila lleva UNA segunda línea sólo donde dice algo que el título no dice (lo que le queda a
//     una pendiente; lo que trae un borrador o un lote de contactos);
//   · el CSS de la carpeta: cada clase propia con el nombre ENTERO de la carpeta (`.m-inbox-`), lo
//     demás es una primitiva que existe en app/m/m.css o app/_ui/ui.css, y cada `var(--x)` existe en
//     app/globals.css (un token inventado resuelve a nada, sin error).
// Que la página dibuje todo adentro de <PantallaM> lo fija tests/movil-refrescar.test.ts; la
// estrella, los íconos y `?abrir=`, tests/m-inbox-v2.test.ts.
//
// Verificado ROMPIÉNDOLO (15/10/2026, base 4 / 0), de a una y restaurando a mano:
//   · `BOTONES_ESCRITORIO.pendiente.primario` = 'Ejecutar la acción' (el rótulo v2)    → 3 / 1
//   · `DATOS_ESCRITORIO.origen` = 'Origen' (el rótulo v2)                              → 3 / 1
//   · el sheet con `k="Acción"` a mano en vez de `DATOS_ESCRITORIO.operacion`          → 3 / 1
//   · `segundaDe` de una pendiente con la operación adelante (la v2)                   → 3 / 1
//   · inbox.css con `.m-in-x` (prefijo abreviado)                                     → 3 / 1
//   · inbox.css con `var(--mako-fondo)` (no existe)                                   → 3 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { BOTONES_ESCRITORIO, DATOS_ESCRITORIO, rotulosDe, segundaDe } from '../app/m/inbox/inbox-ui';

const leer = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** El rótulo como TEXTO de la pantalla de escritorio: entre comillas o como texto de JSX. */
const comoRotulo = (r: string) => new RegExp(`['"\`]${escapar(r)}['"\`]|>\\s*${escapar(r)}\\s*<|^\\s*${escapar(r)}\\s*$`, 'm');

test('los botones de una decisión son los de escritorio, cruzados contra su fuente', () => {
  const pendientes = sinComentarios(leer('app/mako/pendientes/BandejaPendientes.tsx'));
  const revisar = sinComentarios(leer('app/mako/revisar/[id]/RevisarAccion.tsx'));
  for (const r of [BOTONES_ESCRITORIO.pendiente.primario, BOTONES_ESCRITORIO.pendiente.salida]) {
    assert.match(pendientes, comoRotulo(r), `«${r}» no es un botón de /mako/pendientes`);
  }
  for (const r of [BOTONES_ESCRITORIO.accion.primario, BOTONES_ESCRITORIO.accion.salida]) {
    assert.match(revisar, comoRotulo(r), `«${r}» no es un botón de /mako/revisar/<id>`);
  }
  // Y son los que dibuja el teléfono: una sola fuente para los dos.
  assert.deepEqual(rotulosDe({ tipo: 'pendiente', accionMovil: 'confirmar-pendiente' }), BOTONES_ESCRITORIO.pendiente);
  assert.deepEqual(rotulosDe({ tipo: 'accion', accionMovil: 'confirmar-accion' }), BOTONES_ESCRITORIO.accion);
  assert.deepEqual(rotulosDe({ tipo: 'accion', accionMovil: 'computadora' }), { primario: null, salida: null });
});

test('el sheet rotula sus datos como /mako/pendientes, y no a mano', () => {
  const pendientes = sinComentarios(leer('app/mako/pendientes/BandejaPendientes.tsx'));
  for (const r of Object.values(DATOS_ESCRITORIO)) {
    assert.match(pendientes, new RegExp(`k: '${escapar(r)}'`), `«${r}» no es un dato de /mako/pendientes`);
  }
  const pantalla = sinComentarios(leer('app/m/inbox/InboxM.tsx'));
  for (const k of Object.keys(DATOS_ESCRITORIO)) {
    assert.match(pantalla, new RegExp(`DATOS_ESCRITORIO\\.${k}\\b`), `el sheet no usa DATOS_ESCRITORIO.${k}`);
  }
  // Un rótulo literal en una FilaDatoM del sheet es una segunda fuente: sólo «Lead» (el del CRM).
  const literales = [...pantalla.matchAll(/<FilaDatoM[^>]*\bk="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(literales)], ['Lead']);
});

test('la segunda línea sólo cuando dice algo que el título no dice', () => {
  assert.equal(segundaDe({ tipo: 'pendiente', resumen: 'Mover de etapa' }, 42), 'Vence en 42 min');
  assert.equal(segundaDe({ tipo: 'pendiente', resumen: 'Mover de etapa' }, 80), 'Vence en 1 h 20');
  assert.equal(segundaDe({ tipo: 'pendiente', resumen: 'Mover de etapa' }, -1), 'Vencida');
  // Antes de montar (sin la hora del teléfono) no se inventa un plazo.
  assert.equal(segundaDe({ tipo: 'pendiente', resumen: 'Mover de etapa' }, null), null);
  // La operación y el primer cambio del CRM están en el sheet: la fila no los repite.
  assert.equal(segundaDe({ tipo: 'accion', resumen: 'Crear campaña' }, null), null);
  assert.equal(segundaDe({ tipo: 'confirmacion', resumen: 'Ana López' }, null), null);
  // El título de un borrador es la reunión; lo que trae va abajo.
  assert.equal(segundaDe({ tipo: 'borrador', resumen: '4 tareas · 2 para cerrar' }, null), '4 tareas · 2 para cerrar');
  assert.equal(segundaDe({ tipo: 'lead', resumen: '3 contactos para revisar' }, null), '3 contactos para revisar');
});

test('el CSS de la carpeta: prefijo entero y tokens que existen', () => {
  const css = sinComentarios(leer('app/m/inbox/inbox.css'));
  const primitivas = leer('app/m/m.css') + leer('app/_ui/ui.css');
  const clases = new Set([...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]));
  assert.ok(clases.size > 5, 'no se leyó ninguna clase');
  for (const c of clases) {
    if (c.startsWith('m-inbox-')) continue;
    assert.match(primitivas, new RegExp(`\\.${escapar(c)}(?![\\w-])`), `.${c}: ni lleva .m-inbox- ni es una primitiva`);
  }
  const globales = leer('app/globals.css');
  const tokens = new Set([...css.matchAll(/var\(--([\w-]+)/g)].map((m) => m[1]));
  assert.ok(tokens.size > 5, 'no se leyó ningún token');
  for (const t of tokens) assert.match(globales, new RegExp(`--${escapar(t)}\\s*:`), `var(--${t}) no existe en app/globals.css`);
});
