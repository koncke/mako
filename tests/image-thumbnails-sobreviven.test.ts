// =============================================================================
// Si falla la lectura de carruseles, las miniaturas NO se tiran (8/11/2026)
// =============================================================================
// Hallazgo unánime de la revisión de `punta/carruseles-thumbnails`: «Si falla la lectura de
// carruseles, Thumbnails se tira a la basura aunque se haya leído bien».
//
// Las dos páginas leen `leerExplorador()` y `leerThumbnails()` en paralelo, pero un `!ok` del
// explorador devolvía `{ error: true }` y con eso se descartaba todo. **No tienen por qué caer
// juntas:** los carruseles salen de los datos de Spy DEL NEGOCIO y las miniaturas son una
// biblioteca GLOBAL de la plataforma. Un problema con lo primero dejaba inalcanzable una pestaña
// sana.
//
// Correr: node --import tsx --test tests/image-thumbnails-sobreviven.test.ts
// ROTURAS (8/11/2026, una por vez y restaurada; base 3 / 0): sacar la rama nueva → 2 / 1; dejarla
// pero sin pasar las miniaturas → 2 / 1; sacar el aviso (que es lo único que le dice al cliente
// por qué no están los carruseles) → 2 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'app/image-editor/page.tsx'), 'utf8');

test('con los carruseles caídos pero las miniaturas sanas, la pantalla se dibuja igual', () => {
  assert.match(src, /: explorador && thumbnails && thumbnails\.ok\s*\n\s*\? \{/,
    'hace falta la rama intermedia: ni «todo bien» ni «todo roto»');
  const i = src.indexOf(': explorador && thumbnails && thumbnails.ok');
  const bloque = src.slice(i, i + 1100);
  assert.match(bloque, /lista: thumbnails\.thumbnails/,
    'las miniaturas leídas tienen que viajar: tirarlas es el bug');
});

test('y se le dice al cliente POR QUÉ no están los carruseles', () => {
  const i = src.indexOf(': explorador && thumbnails && thumbnails.ok');
  const bloque = src.slice(i, i + 1100);
  assert.match(bloque, /avisoBiblioteca: 'No pude leer los carruseles/,
    'sin aviso, el cliente ve una pestaña vacía y no sabe que hubo un error');
});

test('⚠️ y si TAMBIÉN fallan las miniaturas, sigue siendo un error de verdad', () => {
  // La mitad que protege lo contrario: no hay que convertir todo error en pantalla vacía.
  assert.match(src, /: explorador \? \{ error: true \} : null/,
    'con las dos caídas, el error se muestra como error');
});
