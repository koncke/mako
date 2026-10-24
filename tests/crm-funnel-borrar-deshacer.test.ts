// =============================================================================
// Eliminar un funnel sin leads: el «Deshacer» tiene que VERSE (24/10/2026)
// =============================================================================
// Martín, 29/09: «Si intento eliminar una columna que NO tiene ningún lead, no debería haber nada de fricción. Solo que me
// salte el pop-up de deshacer». Con las etapas andaba. Con un FUNNEL sin leads, nunca: el aviso con «Deshacer» vivía adentro
// de «Editar etapas» (EtapasModal), que se cierra en el mismo gesto, y el aviso se iba con él. Sólo se recuperaba desde «CRM
// eliminados». Ahora el aviso lo dibuja el tablero, que sigue montado.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');

test('eliminar un funnel sin leads deja el «Deshacer» en el tablero, no en el pop-up que se cierra', () => {
  const modal = leer('app/crm/EtapasModal.tsx');
  const archivar = modal.slice(modal.indexOf('const archivar = (conAviso: boolean) =>'), modal.indexOf('const eliminarProducto = () =>'));
  assert.ok(archivar.length > 100, 'no encontré «archivar»');
  // El aviso sale ANTES de cerrar, y por el del tablero si lo hay.
  assert.match(archivar, /\(onAviso \?\? show\)\(`Eliminado «\$\{emb\.nombre\}»`, deshacer\);\n\s+onCerrar\(\);/, 'el aviso se dibuja adentro del pop-up que se cierra');
  assert.match(archivar, /const deshacer = \(\) => \{\n\s+void restaurarEmbudoAction\(funnelId\)/, 'el «Deshacer» no restaura el funnel');
  // El tablero se lo pasa.
  assert.match(leer('app/crm/CrmBoard.tsx'), /onAviso=\{\(texto, deshacer\) => mostrarAviso\(texto, deshacer\)\}\n\s+onCerrar=\{\(\) => setEtapasDe\(null\)\} \/>/);
});
