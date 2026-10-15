// =============================================================================
// La sidebar mide el alto VISIBLE (dvh): el perfil del fondo no se va abajo del borde en un iPad
// =============================================================================
// Martín, 14/10/2026, desde un iPad: «no se llega a ver la foto de perfil, para ir a configuraciones».
// En Safari `100vh` es el alto con la barra del navegador ESCONDIDA: la sidebar (`sticky; height: 100vh`)
// quedaba ~50 px más larga que lo visible y su última fila, el perfil (`margin-top: auto`), caía debajo
// del borde. Chrome con la emulación no lo reproduce: por eso lo fija este test y no una captura.
//
// Probado rompiéndolo (14/10/2026): sin el bloque `@supports` de `aside[data-sidebar]` → 1 / 1 en rojo;
// con la variante de la barra de agencia ANTES del bloque genérico (la genérica le ganaba) → 1 / 1 en rojo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, '..', 'app/globals.css'), 'utf8').replace(/\r\n/g, '\n');

test('la sidebar usa el alto visible (100dvh), también con la barra de agencia, y la de agencia gana', () => {
  const generico = css.indexOf('@supports (height: 100dvh) {\n  aside[data-sidebar] { height: 100dvh !important; }');
  const agencia = css.indexOf('[data-barra-agencia] aside, [data-alerta-voz] aside[data-sidebar] { height: calc(100dvh - var(--barra-agencia)) !important; }');
  assert.ok(generico >= 0, 'la sidebar volvió a medir 100vh: en Safari el perfil se va abajo del borde');
  assert.ok(agencia >= 0, 'con la barra de agencia la sidebar no descuenta el alto visible');
  // Misma especificidad y las dos con !important: gana la ÚLTIMA. La de agencia va después.
  assert.ok(agencia > generico, 'la regla genérica pisa a la de la barra de agencia');
});
