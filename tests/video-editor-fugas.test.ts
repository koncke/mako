// =============================================================================
// Las fugas del editor de video: lo que se creaba y nunca se soltaba (11/11/2026)
// =============================================================================
// docs/editor-video/memoria-del-editor.md §6, «Fugas claras». Fija cuatro:
//   · IndexedDB (services/storage/indexeddb-adapter.ts): una conexión por operación que NUNCA se cerraba. El guardado
//     automático corre cada 800 ms; además una conexión abierta deja esperando para siempre a `deleteDatabase`.
//   · las imágenes decodificadas (services/renderer/nodes/image-node.ts): el caché no se vaciaba nunca, y cada proyecto que
//     se abre trae URLs nuevas (una foto de 12 MP son 48 MB);
//   · el AudioContext de cada sonido de la biblioteca (sounds/sounds-store.ts), que quedaba vivo;
//   · el Input de mediabunny de la tira de miniaturas (timeline/components/miniaturas.ts), que nunca se cerraba.
//
// PROBADO ROMPIÉNDOLO (11/11/2026, cada uno dio rojo y se volvió atrás):
//   · sin el `db.close()` de `get`: rojo el de IndexedDB;
//   · sin `soltarMiniaturas()` en clearAllAssets: rojo el del cableado;
//   · soltarMiniaturas sin borrar `fallidos`: rojo el de las miniaturas;
//   · el AudioContext sin `.finally(... close())`: rojo el del sonido.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (ruta: string) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const OC = 'app/video-editor/_opencut';

test('IndexedDB: cada operación cierra su conexión (y la operación igual termina)', async () => {
  let abiertas = 0;
  let cerradas = 0;
  const datos = new Map<string, unknown>();
  // Un indexedDB de mentira: cada open da una conexión que cuenta su close().
  const pedido = <T>(hacer: () => T) => {
    const r: { result?: T; error?: unknown; onsuccess?: () => void; onerror?: () => void } = {};
    queueMicrotask(() => {
      r.result = hacer();
      r.onsuccess?.();
    });
    return r;
  };
  const conexion = () => {
    abiertas++;
    let cerrada = false;
    return {
      objectStoreNames: { contains: () => true },
      close: () => {
        cerrada = true;
        cerradas++;
      },
      transaction: () => {
        if (cerrada) throw new Error('InvalidStateError: la conexión ya se cerró');
        return {
          objectStore: () => ({
            get: (k: string) => pedido(() => datos.get(k)),
            put: (v: { id: string }) => pedido(() => void datos.set(v.id, v)),
            delete: (k: string) => pedido(() => void datos.delete(k)),
            getAllKeys: () => pedido(() => [...datos.keys()]),
            getAll: () => pedido(() => [...datos.values()]),
            clear: () => pedido(() => datos.clear()),
          }),
        };
      },
    };
  };
  const g = globalThis as { indexedDB?: unknown };
  const antes = g.indexedDB;
  g.indexedDB = { open: () => pedido(conexion) };
  try {
    const { IndexedDBAdapter } = await import('../app/video-editor/_opencut/services/storage/indexeddb-adapter');
    const a = new IndexedDBAdapter<{ nombre: string }>({ dbName: 'x', storeName: 's' });
    await a.set({ key: 'k1', value: { nombre: 'uno' } });
    assert.deepEqual(await a.get('k1'), { id: 'k1', nombre: 'uno' });
    assert.deepEqual(await a.list(), ['k1']);
    assert.equal((await a.getAll()).length, 1);
    await a.remove('k1');
    await a.clear();
    assert.equal(abiertas, 6);
    assert.equal(cerradas, 6, `quedaron ${abiertas - cerradas} conexiones abiertas`);
  } finally {
    g.indexedDB = antes;
  }
});

test('las miniaturas de un archivo se sueltan: el que falló puede volver a intentarse', async () => {
  const m = await import('../app/video-editor/_opencut/timeline/components/miniaturas');
  // Un archivo que no se lee: queda marcado como fallido.
  const roto = new File([new Uint8Array([1, 2, 3])], 'roto.mp4', { type: 'video/mp4' });
  m.pedirCuadros({ mediaId: 'roto', file: roto, alto: 96, tiempos: [0] });
  for (let i = 0; i < 50 && !m.miniaturasFallaron('roto'); i++) await new Promise((r) => setTimeout(r, 10));
  assert.equal(m.miniaturasFallaron('roto'), true, 'no llegó a marcarse fallido');
  m.soltarMiniaturas('roto');
  assert.equal(m.miniaturasFallaron('roto'), false);
});

test('el cableado: el proyecto que se cierra y el medio que se borra sueltan imágenes y miniaturas', () => {
  const mm = leer(`${OC}/core/managers/media-manager.ts`);
  assert.match(mm, /clearAllAssets\(\): void \{[\s\S]*?soltarImagenes\(\);\s*soltarMiniaturas\(\);/);
  assert.match(mm, /async clearProjectMedia[\s\S]*?soltarImagenes\(\);\s*soltarMiniaturas\(\);/);
  const borrar = leer(`${OC}/commands/media/remove-media-asset.ts`);
  assert.match(borrar, /URL\.revokeObjectURL\(this\.removedAsset\.url\);\s*soltarImagenes\(this\.removedAsset\.url\);/);
  assert.match(borrar, /soltarMiniaturas\(this\.assetId\);/);
  const img = leer(`${OC}/services/renderer/nodes/image-node.ts`);
  assert.match(img, /export function soltarImagenes\(url\?: string\)[\s\S]*?imageSourceCache\.clear\(\);[\s\S]*?startsWith\(`\$\{url\}::`\)/);
});

test('el sonido de la biblioteca cierra el AudioContext con el que se decodificó', () => {
  const s = leer(`${OC}/sounds/sounds-store.ts`);
  assert.match(s, /await audioContext\.decodeAudioData\(arrayBuffer\)\.finally\(\(\) => void audioContext\.close\(\)\);/);
});
