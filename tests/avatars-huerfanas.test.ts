// =============================================================================
// Las fotos huérfanas del bucket `avatars`: qué se cuenta como nombrado y qué no se toca (6/11/2026)
// =============================================================================
// La regla vive en lib/avatars-huerfanas.ts y la usa scripts/avatars-huerfanas.mts (en seco por defecto, con `--borrar` borra).
//
// PROBADO ROMPIÉNDOLO (base 4 / 0), una por vez, restaurando:
//   · `huerfanas` sin mirar `nombradas` (borraría las fotos que se ven en el CRM)        → 2 / 2
//   · sin el corte de 24 h (borraría la foto que se está guardando)                       → 3 / 1
//   · sin el corte de formato (borraría un objeto que no es una foto de lead)             → 3 / 1
//   · el script sin leer la papelera (un lead recuperado volvería con la cara rota)        → 3 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { huerfanas, rutasNombradas, EDAD_MINIMA_HUERFANA_MS } from '../lib/avatars-huerfanas';

const RAIZ = join(import.meta.dirname, '..');
const AHORA = Date.parse('2026-11-06T12:00:00Z');
const hace = (ms: number) => new Date(AHORA - ms).toISOString();
const HEX = '0123456789abcdef0123456789abcdef';

test('las rutas que nombra un texto: la URL pública y la foto JSON de la papelera, los dos formatos', () => {
  assert.deepEqual(rutasNombradas('https://x.supabase.co/storage/v1/object/public/avatars/leads/3/77.jpg?v=1'), ['leads/3/77.jpg']);
  assert.deepEqual(rutasNombradas(JSON.stringify({ lead: { foto_auto_url: `https://x.supabase.co/storage/v1/object/public/avatars/leads/3/78-${HEX}.jpg` } })), [`leads/3/78-${HEX}.jpg`]);
  assert.deepEqual(rutasNombradas('https://pps.whatsapp.net/v/t61/foto.jpg'), [], 'una foto de WhatsApp no es del bucket');
  assert.deepEqual(rutasNombradas(null), []);
});

test('huérfana = foto de lead, sin nadie que la nombre, de más de 24 h; la adivinable se marca', () => {
  const viejo = hace(EDAD_MINIMA_HUERFANA_MS + 60_000);
  const r = huerfanas([
    { ruta: 'leads/3/1.jpg', creado: viejo, bytes: 10 },                  // huérfana adivinable
    { ruta: `leads/3/2-${HEX}.jpg`, creado: viejo, bytes: 10 },           // huérfana al azar
    { ruta: 'leads/3/3.jpg', creado: viejo, bytes: 10 },                  // la nombra un lead
    { ruta: 'leads/3/4.jpg', creado: hace(60_000), bytes: 10 },           // recién subida
    { ruta: 'leads/3/5.jpg', creado: null, bytes: 10 },                   // sin fecha: no se sabe
    { ruta: 'leads/3/otra-cosa.png', creado: viejo, bytes: 10 },          // no es una foto de lead
  ], new Set(['leads/3/3.jpg']), AHORA);
  assert.deepEqual(r.huerfanas.map((h) => [h.ruta, h.adivinable]), [['leads/3/1.jpg', true], [`leads/3/2-${HEX}.jpg`, false]]);
  assert.equal(r.recientes, 2);
  assert.equal(r.ajenos, 1);
});

test('lo nombrado no se toca aunque sea viejo y adivinable', () => {
  const r = huerfanas([{ ruta: 'leads/9/10.jpg', creado: hace(90 * 86_400_000), bytes: 5 }], new Set(['leads/9/10.jpg']), AHORA);
  assert.deepEqual(r.huerfanas, []);
});

test('el script: en seco por defecto, y nombra los leads vivos, la papelera y los contactos', () => {
  const s = readFileSync(join(RAIZ, 'scripts/avatars-huerfanas.mts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(s, /const BORRAR = process\.argv\.includes\('--borrar'\);/);
  assert.match(s, /if \(!BORRAR \|\| !r\.huerfanas\.length\) continue;/, 'sin --borrar no borra');
  assert.match(s, /leerTodo<\{ foto_auto_url: string \| null \}>\(db, 'leads'/);
  assert.match(s, /leerTodo<\{ foto: unknown \}>\(db, 'leads_papelera'/, 'un lead de la papelera vuelve con su foto');
  assert.match(s, /leerTodo<\{ foto_url: string \| null \}>\(db, 'evolution_contactos'/);
  assert.match(s, /for \(const p of papelera\) for \(const r of rutasNombradas\(JSON\.stringify\(p\.foto\)\)\) s\.add\(r\);/);
});
