// =============================================================================
// La cara de un lead no se puede bajar adivinando dos números (17/10/2026)
// =============================================================================
// El bucket `avatars` es público y las copias de las fotos de WhatsApp de los leads vivían en
// `leads/<ws>/<lead>.jpg`: cualquiera recorría los ids y se bajaba las caras de quienes le
// escribieron a un cliente (106 en producción ese día). Ahora el nombre lleva 128 bits al azar
// (lib/fotos-contacto-ruta.ts) y el cron muda las viejas.
//
// Probado rompiéndolo (17/10/2026), sobre los 4 de este archivo (base 4 / 0): con
// `rutaNuevaDeFoto` devolviendo `leads/${ws}/${leadId}.jpg` → 3 / 1; con `rutaDeFotoGuardada` sin
// exigir el workspace (`Number(m[2]) !== ws` sacado) → 3 / 1; con el cron renombrando sólo los
// activos (`for (const w of workspaces)`) → 3 / 1.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { esRutaAdivinable, rutaDeFotoGuardada, rutaNuevaDeFoto } from '../lib/fotos-contacto-ruta';

const leer = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const BASE = 'https://abc.supabase.co/storage/v1/object/public/avatars/';

test('una copia nueva lleva 32 hex al azar y no es adivinable', () => {
  const a = rutaNuevaDeFoto(3, 77);
  const b = rutaNuevaDeFoto(3, 77);
  assert.match(a, /^leads\/3\/77-[0-9a-f]{32}\.jpg$/);
  assert.notEqual(a, b, 'dos copias del mismo lead no comparten nombre');
  assert.equal(esRutaAdivinable(a), false);
  assert.equal(esRutaAdivinable('leads/3/77.jpg'), true);
});

test('rutaDeFotoGuardada sólo devuelve rutas de ESTE lead y ESTE negocio', () => {
  const nueva = rutaNuevaDeFoto(3, 77, () => 'a'.repeat(32));
  assert.equal(rutaDeFotoGuardada(`${BASE}${nueva}?v=1`, 3, 77), nueva);
  assert.equal(rutaDeFotoGuardada(`${BASE}leads/3/77.jpg?v=1`, 3, 77), 'leads/3/77.jpg');
  // Otro negocio, otro lead, otro bucket, una ruta que escapa o algo que no es URL: nada que borrar.
  assert.equal(rutaDeFotoGuardada(`${BASE}leads/4/77.jpg`, 3, 77), null);
  assert.equal(rutaDeFotoGuardada(`${BASE}leads/3/78.jpg`, 3, 77), null);
  assert.equal(rutaDeFotoGuardada('https://abc.supabase.co/storage/v1/object/public/otro/leads/3/77.jpg', 3, 77), null);
  assert.equal(rutaDeFotoGuardada(`${BASE}leads/3/77.jpg/../../x.jpg`, 3, 77), null);
  assert.equal(rutaDeFotoGuardada('no es una url', 3, 77), null);
  assert.equal(rutaDeFotoGuardada(null, 3, 77), null);
});

test('la copia diaria usa la ruta al azar y borra la anterior DESPUÉS de apuntar a la nueva', () => {
  const src = leer('lib/fotos-contacto.ts');
  assert.doesNotMatch(src, /`leads\/\$\{ws\}\/\$\{p\.id\}\.jpg`/, 'volvió la ruta adivinable');
  assert.match(src, /const path = rutaNuevaDeFoto\(ws, p\.id\);/);
  const apunta = src.indexOf("update({ foto_auto_url: url, foto_auto_at");
  const borra = src.indexOf('storage.remove([vieja])');
  assert.ok(apunta > 0 && borra > apunta, 'la vieja se borra después de guardar la URL nueva');
});

test('el cron muda las adivinables en TODOS los negocios, no sólo los activos', () => {
  const src = leer('app/api/cron/fotos-contacto/route.ts');
  assert.match(src, /for \(const w of todos\) \{\n\s*try \{\n\s*const r = await renombrarFotosAdivinables\(w\.id\);/);
});
