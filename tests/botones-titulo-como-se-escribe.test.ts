// =============================================================================
// El nombre de un botón acepta espacios al TIPEAR (27/10/2026, ticket #12 de Leandro, ws10)
// =============================================================================
// Leandro: en «+ Botón» → nombre, «Obtener recurso» quedaba «Obtenerrecurso»; pegando sí andaba. Parecía la barra
// espaciadora tomada por el lienzo, y no era eso: el editor (app/automations/EditorMensajeSocial.tsx) dibujaba la lista
// SANEADA de `botonesDe`, que hace `trim` del título en cada tecla. «Obtener » volvía como «Obtener» y la «r» siguiente quedaba
// pegada. Pegando, el espacio queda en el medio y el `trim` no lo toca. Con lo mismo, vaciar el campo para reescribirlo borraba
// el botón, y vaciar el link lo pasaba a «Sigue el flujo». Fija: el editor ve los botones como se escriben
// (`comoSeEscribe`), y el motor y Publicar los siguen viendo saneados.
// Correr: node --import tsx --test tests/botones-titulo-como-se-escribe.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { botonesDe, type BotonSocial } from '../lib/botones-social';

/** Tipea `texto` letra por letra como el campo: cada tecla se suma a lo que el editor MUESTRA, y eso se guarda. */
function tipear(texto: string, ver: (p: { botones: unknown[] }) => BotonSocial[]): string {
  let guardado: unknown[] = [{ id: 'b1', titulo: '' }];
  for (const letra of texto) guardado = [{ id: 'b1', titulo: (ver({ botones: guardado })[0]?.titulo ?? '') + letra }];
  return ver({ botones: guardado })[0]?.titulo ?? '';
}

test('al tipear, el nombre del botón queda con sus espacios; lo que sale, saneado', () => {
  assert.equal(tipear('Obtener recurso', (p) => botonesDe(p, undefined, { comoSeEscribe: true })), 'Obtener recurso');
  // Así se veía antes (la lista saneada en el editor): el caso de Leandro.
  assert.equal(tipear('Obtener recurso', (p) => botonesDe(p)), 'Obtenerrecurso');
  // Lo que va al motor y a Publicar sigue saneado.
  assert.equal(botonesDe({ botones: [{ id: 'b1', titulo: '  Obtener recurso ' }] })[0].titulo, 'Obtener recurso');
});

test('vaciar el campo no borra el botón, ni vaciar el link lo cambia de clase, mientras se edita', () => {
  const edita = (b: Record<string, unknown>) => botonesDe({ botones: [{ id: 'b1', ...b }] }, undefined, { comoSeEscribe: true });
  assert.equal(edita({ titulo: '' }).length, 1, 'vaciar el nombre para reescribirlo borraba el botón');
  assert.deepEqual(edita({ titulo: 'Ver', url: '' })[0], { id: 'b1', titulo: 'Ver', url: '' }, 'vaciar el link lo pasaba a «Sigue el flujo»');
  // Para salir, lo vacío se cae como siempre (Publicar lo dice: no se manda un botón sin nombre).
  assert.equal(botonesDe({ botones: [{ id: 'b1', titulo: '' }] }).length, 0);
});

test('el editor de Instagram y Messenger dibuja los botones como se escriben', () => {
  const src = readFileSync(join(__dirname, '..', 'app', 'automations', 'EditorMensajeSocial.tsx'), 'utf8');
  assert.match(src, /<BotonesSocial botones=\{botonesDe\(paso, undefined, \{ comoSeEscribe: true \}\)\}/);
});

// ROTURAS (27/10/2026, una por vez y restaurada; base 3 / 0): el editor vuelve a `botonesDe(paso)` → 2 / 1; `comoSeEscribe`
// con `trim` del título → 2 / 1; sin conservar el link vacío → 2 / 1.
