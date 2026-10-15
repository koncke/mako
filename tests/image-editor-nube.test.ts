// =============================================================================
// El Image Editor en la base (mig 0278): reglas del bucket, la puerta de las rutas y los registros
// =============================================================================
// Lo que el compilador no ve: que la lista de tipos del código sea la del bucket, que cada ruta
// pase por la puerta del super admin y que las dos tablas estén en los tres registros (sin eso
// `getTenantDb()` es PASSTHROUGH y el inicio de un negocio listaría los diseños de todos).
//
// Probado rompiéndolo (14/10/2026): sacando 'image_disenos' de TENANT_TABLES, el test 6 falla
// (0/1); borrando el `await puerta()` del GET de disenos/route.ts, el 5 falla nombrando el archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  TIPOS_BUCKET, TOPE_AUDIO_BYTES, resumirDoc, sniffArchivo, srcsLocales, subidaDelWs, validarSubida,
} from '../lib/image-editor/reglas';
import { TABLAS_DE_INQUILINO } from '../lib/tablas-de-inquilino';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const MIG = 'supabase/migrations/0278_image_editor_disenos.sql';

test('1: los tipos y el tope del código son los del bucket de la migración', () => {
  const sql = leer(MIG);
  const bloque = /insert into storage\.buckets[\s\S]*?array\[([\s\S]*?)\]/.exec(sql);
  assert.ok(bloque, 'la migración tiene que crear el bucket con su lista de tipos');
  const tipos = [...bloque[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual([...tipos].sort(), [...TIPOS_BUCKET].sort());
  const tope = /values \('image-editor', 'image-editor', true, (\d+)/.exec(sql);
  assert.equal(Number(tope?.[1]), TOPE_AUDIO_BYTES, 'el file_size_limit del bucket es el tope del audio');
  assert.ok(!/svg/i.test(bloque[1]), 'el bucket NO acepta SVG (documento activo)');
});

test('2: una subida es de ESTE workspace y con una extensión admitida', () => {
  const id = '0b9e5f4c-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
  assert.deepEqual(subidaDelWs(`3/subidas/${id}.png`, 3), { tipo: 'image/png', final: `3/${id}.png`, uuid: id });
  assert.equal(subidaDelWs(`4/subidas/${id}.png`, 3), null, 'la de otro workspace');
  assert.equal(subidaDelWs(`3/subidas/../4/${id}.png`, 3), null);
  assert.equal(subidaDelWs(`3/subidas/${id}.svg`, 3), null, 'svg no');
  assert.equal(subidaDelWs(`3/${id}.png`, 3), null, 'fuera de subidas/');
  assert.equal(validarSubida('image/svg+xml', 10).ok, false);
  assert.equal(validarSubida('image/png', 16 * 1024 * 1024).ok, false, 'imagen de más de 15 MB');
  assert.equal(validarSubida('audio/mpeg', 20 * 1024 * 1024).ok, true, 'un audio de 20 MB entra');
});

test('3: el tipo REAL sale de los primeros bytes', () => {
  const b = (...x: number[]) => new Uint8Array(x);
  const s = (t: string) => new TextEncoder().encode(t);
  assert.equal(sniffArchivo(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), 'image/png');
  assert.equal(sniffArchivo(b(0xff, 0xd8, 0xff, 0xe0)), 'image/jpeg');
  assert.equal(sniffArchivo(s('RIFF0000WEBPVP8 ')), 'image/webp');
  assert.equal(sniffArchivo(s('RIFF0000WAVEfmt ')), 'audio/wav');
  assert.equal(sniffArchivo(s('ID3\x04\x00')), 'audio/mpeg');
  assert.equal(sniffArchivo(s('OggS\x00\x02')), 'audio/ogg');
  assert.equal(sniffArchivo(s('\x00\x00\x00\x20ftypM4A ')), 'audio/mp4');
  assert.equal(sniffArchivo(s('<!doctype html><svg')), null, 'un HTML disfrazado no pasa');
  assert.equal(sniffArchivo(s('<svg xmlns="http://www.w3.org/2000/svg">')), null, 'un SVG no pasa');
});

test('4: un documento se guarda si tiene forma de diseño y ningún src local', () => {
  const doc = { schemaVersion: 1, width: 1080, height: 1350, unit: 'px', pages: [{ id: 'p', background: { type: 'solid', color: '#fff' }, objects: [] }] };
  assert.deepEqual(resumirDoc(doc), { ancho: 1080, alto: 1350, paginas: 1 });
  assert.equal(resumirDoc({ ...doc, pages: [] }), null);
  assert.equal(resumirDoc({ ...doc, width: 0 }), null);
  assert.equal(resumirDoc([doc]), null);
  const conLocal = { ...doc, pages: [{ ...doc.pages[0], objects: [{ type: 'group', objects: [{ type: 'image', src: 'idb://0b9e5f4c-1a2b-4c3d-8e9f-0a1b2c3d4e5f' }] }] }] };
  assert.equal(srcsLocales(conLocal).length, 1);
  assert.equal(srcsLocales({ ...doc, pages: [{ ...doc.pages[0], background: { type: 'image', src: 'blob:http://x/1' } }] }).length, 1);
  assert.deepEqual(srcsLocales({ ...doc, pages: [{ ...doc.pages[0], objects: [{ type: 'image', src: 'https://x.supabase.co/a.png' }] }] }), []);
});

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    const r = `${dir}/${n}`;
    if (statSync(join(RAIZ, r)).isDirectory()) out.push(...archivos(r));
    else if (/route\.ts$/.test(n)) out.push(r);
  }
  return out;
}

test('5: cada handler de /api/image-editor pasa por la puerta del editor antes que nada', () => {
  const rutas = archivos('app/api/image-editor');
  assert.ok(rutas.length >= 5, `sólo ${rutas.length} rutas: el barrido no está mirando`);
  const malos: string[] = [];
  for (const r of rutas) {
    const src = leer(r);
    const handlers = [...src.matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)\b/g)].map((m) => m[1]);
    const conPuerta = [...src.matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)\([^)]*\)\s*\{\s*const p = await puerta\(\);\s*if \(p instanceof Response\) return p;/g)].map((m) => m[1]);
    for (const h of handlers) if (!conPuerta.includes(h)) malos.push(`${r} ${h}`);
  }
  assert.deepEqual(malos, [], `handlers sin la puerta como primera línea:\n  ${malos.join('\n  ')}`);
  const server = leer('lib/image-editor/server.ts');
  assert.match(server, /await veEditorImagen\(\)/, 'la puerta pregunta lo mismo que el guard de las páginas (app/image-editor/acceso.ts)');
});

test('6: las dos tablas y el bucket están en los tres registros', () => {
  for (const t of ['image_disenos', 'image_subidos']) {
    assert.ok((TABLAS_DE_INQUILINO as readonly string[]).includes(t), `${t} falta en TABLAS_DE_INQUILINO`);
    const ws = leer('lib/workspace.ts');
    const tenant = /const TENANT_TABLES = new Set<string>\(\[([\s\S]*?)\]\);/.exec(ws)?.[1] ?? '';
    assert.ok(tenant.replace(/^\s*\/\/.*$/gm, '').includes(`'${t}'`), `${t} falta en TENANT_TABLES (lib/workspace.ts)`);
  }
  assert.match(leer('lib/reset-workspace.ts'), /const BUCKETS = \[[^\]]*'image-editor'/, 'el bucket falta en BUCKETS (lib/reset-workspace.ts)');
});
