// =============================================================================
// «Pegar la captura» arriba de la caja (24/10/2026) — app/admin/operaciones/pegar.ts y app/_chat/CajaChat.tsx
// =============================================================================
// Martín, el 17/10 (un pedido que no le llegó a nadie hasta el 24/10): «Debo poder pegar la imagen que tengo copiada; en
// el celular, en algunas apps me aparece la opción de pegarla directamente luego de una captura». El teclado de Android
// ofrece pegar una imagen sólo en un campo que la acepta, y el `<textarea>` de la caja no es uno; «Pegar» del «+» existía
// desde el 20/10 pero había que buscarlo. Ahora, al enfocar el campo, la captura copiada aparece arriba de la caja.
//
// Probado rompiéndolo (24/10/2026, con la base en 0 fallos):
//   · sin mirar el permiso (leer el portapapeles al enfocar, aunque pida el cartel) → 1 fallo (1);
//   · sin la lista de las ya ofrecidas                                          → 1 fallo (2);
//   · el campo sin `onFocus={ofrecerCaptura}`                                    → 1 fallo (5);
//   · pegarla sin anotarla como vista                                            → 1 fallo (5).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { capturaParaOfrecer, firmaDeCaptura } from '../app/admin/operaciones/pegar';

type Item = { types: string[]; getType: (t: string) => Promise<Blob> };
/** Un navegador de prueba: el estado del permiso y lo que hay en el portapapeles (y cuántas veces se leyó). */
function navegador(estado: PermissionState | 'tira', items: Item[] | 'tira') {
  const n = { lecturas: 0 };
  return Object.assign(n, {
    permissions: { query: async () => { if (estado === 'tira') throw new Error('no existe'); return { state: estado } as PermissionStatus; } },
    clipboard: { read: async () => { n.lecturas++; if (items === 'tira') throw new Error('NotAllowedError'); return items as unknown as ClipboardItems; } },
  });
}
const png = new Blob([new Uint8Array(1234)], { type: 'image/png' });
const conImagen: Item[] = [{ types: ['image/png'], getType: async () => png }];

test('1. sin el permiso ya dado no se lee nada (enfocar no puede pedir el cartel)', async () => {
  for (const estado of ['prompt', 'denied', 'tira'] as const) {
    const nav = navegador(estado, conImagen);
    assert.equal(await capturaParaOfrecer(new Set(), nav), null, `con el permiso «${estado}» no se ofrece nada`);
    assert.equal(nav.lecturas, 0, `con el permiso «${estado}» se leyó el portapapeles`);
  }
  assert.equal(await capturaParaOfrecer(new Set(), undefined), null, 'sin navegador, nada');
});

test('2. con permiso, la imagen copiada se ofrece UNA vez: una ya ofrecida no vuelve', async () => {
  const f = await capturaParaOfrecer(new Set(), navegador('granted', conImagen));
  assert.ok(f, 'con permiso y una imagen copiada, se ofrece');
  assert.equal(f.type, 'image/png');
  assert.equal(firmaDeCaptura(f), 'image/png:1234');
  assert.equal(await capturaParaOfrecer(new Set([firmaDeCaptura(f)]), navegador('granted', conImagen)), null, 'la misma captura se ofreció dos veces');
});

test('3. sin una imagen copiada (sólo texto), nada', async () => {
  const texto: Item[] = [{ types: ['text/plain'], getType: async () => new Blob(['hola'], { type: 'text/plain' }) }];
  assert.equal(await capturaParaOfrecer(new Set(), navegador('granted', texto)), null);
  assert.equal(await capturaParaOfrecer(new Set(), navegador('granted', [])), null);
});

test('4. un navegador que no deja leer, aunque diga que sí, no rompe la caja', async () => {
  assert.equal(await capturaParaOfrecer(new Set(), navegador('granted', 'tira')), null);
});

test('5. la caja la ofrece al enfocar, sólo donde adjunta, y la anota al pegarla o descartarla', () => {
  const c = readFileSync(join(import.meta.dirname, '..', 'app/_chat/CajaChat.tsx'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(c, /onFocus=\{ofrecerCaptura\}/, 'el campo no ofrece la captura al enfocarlo');
  assert.match(c, /if \(!p\.adjuntos\?\.puede \|\| quieto \|\| captura\) return;/, 'la ofrece donde no se puede adjuntar');
  assert.match(c, /CAPTURAS_VISTAS\.add\(firmaDeCaptura\(captura\.file\)\);\n\s*if \(pegar\) p\.adjuntos\?\.onSumar\(\[captura\.file\]\);/, 'pegarla o descartarla no la anota como vista');
  assert.match(c, />Pegar la captura<\/button>/);
});
