// =============================================================================
// Lo que Martín adjunta DIRECTO en la app de Claude se ve en el Ops Center (20/10/2026, el punto 4 del 18/10)
// =============================================================================
// Martín: «cuando envío imágenes por aquí o adjunto cosas también deberían aparecer en el Center», y «si saqué una screen
// o tengo algo copiado, debería aparecer así arriba para pegarlo en el chat» (pedido 5e8b6bff). Medido en transcripts
// reales: una captura pegada es un bloque `image` en base64 dentro del mensaje `user` de Martín; las de las herramientas
// van adentro de un `tool_result`. Lo que se fija:
//   1. la PC saca las imágenes y los PDF del mensaje de Martín (no las de un tool_result), aunque no haya escrito nada;
//   2. las sube DIRECTO al storage con una URL firmada (sin su token), las mira por sus BYTES, y el turno viaja sólo con su
//      `ref`; si la subida falla, ese chat no sale en la vuelta (su marca no avanza);
//   3. MaKo acepta sólo adjuntos de ESE turno (su chat y su uuid en el `ref`), con tipo y tamaño que valen; nunca guarda URL;
//   4. la pantalla los ve con una URL firmada de 10 minutos, sólo detrás de puedeOperar, en la burbuja de Martín con la
//      marca «En la app de Claude»; y la fila dice «Foto» si no escribió texto;
//   5. «Pegar» en el «+» toma la captura copiada (el teclado del teléfono no la ofrece en la caja).
//
// Probado rompiéndolo (20/10/2026, con la base en 0 fallos):
//   · `crudosDe` sin mirar el tipo de bloque (toma cualquiera) → 1 fallo (1);
//   · `subirAdjuntosDeTurnos` sin `mimePorFirma` (sube un ejecutable) → 1 fallo (2);
//   · `sanearAdjuntosTurno` sin comparar el chat del `ref` → 1 fallo (3);
//   · la burbuja sin `AdjuntosDeLaApp` → 1 fallo (4);
//   · `imagenesDelPortapapeles` tomando también el texto → 1 fallo (5).

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MAX_ADJUNTOS_TURNO, MAX_BYTES_ADJUNTO_TURNO, MIMES_ADJUNTO_TURNO, sanearTurnos, type TurnoChat } from '../lib/operaciones-reglas';
import { vistaPrevia, type LineaChat } from '../lib/centro-chats';
import { Hilo } from '../app/admin/operaciones/Hilo';
import { imagenesDelPortapapeles } from '../app/admin/operaciones/pegar';

const leer = (r: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', r), 'utf8').replace(/\r\n/g, '\n');
// ⚠️ El cartero escribe su log en CARTERO_DIR, que lee al cargarse. Sin esto, la falla de mentira del test 2 quedaba en el
//    log REAL de la PC (~/.claude/operaciones/cartero.log) y se leía como un 503 de producción (21/10/2026).
process.env.CARTERO_DIR = mkdtempSync(join(tmpdir(), 'cartero-adjuntos-'));
const LOCAL = 'local_11111111-1111-4111-8111-111111111111';
const OTRO = 'local_22222222-2222-4222-8222-222222222222';
const UUID = '0f69b05d-1111-4111-8111-111111111111';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
const img = (b: Buffer, media = 'image/png') => ({ type: 'image', source: { type: 'base64', media_type: media, data: b.toString('base64') } });
const linea = (uuid: string, content: unknown[]) => JSON.stringify({ type: 'user', uuid, timestamp: '2026-10-20T14:00:00Z', message: { role: 'user', content } });

test('1. la PC saca lo que Martín pegó en la app (no lo de las herramientas), aunque no haya escrito nada', async () => {
  const { turnosDeLineas } = await import('../scripts/operaciones/cartero.mjs');
  const { turnos } = turnosDeLineas([
    linea(UUID, [img(PNG), { type: 'text', text: '<system-reminder>\nalgo del sistema\n</system-reminder>' }]),
    linea('aaaaaaaa-1111-4111-8111-111111111111', [img(PNG), { type: 'audio', source: { type: 'base64', media_type: 'audio/wav', data: 'UklGRg==' } }, { type: 'text', text: 'mirá cómo se bugea' }]),
    linea('bbbbbbbb-1111-4111-8111-111111111111', [{ type: 'tool_result', tool_use_id: 'x', content: [img(PNG)] }]),
  ]);
  assert.equal(turnos.length, 2, 'lo de la herramienta no es de Martín');
  assert.equal(turnos[0].texto, '', 'una captura sola también es un mensaje');
  const crudos = (i: number) => (turnos[i] as { crudos?: string[] }).crudos;
  assert.deepEqual(crudos(0), [PNG.toString('base64')]);
  assert.equal(turnos[1].texto, 'mirá cómo se bugea');
  assert.equal(crudos(1)?.length, 1, 'sólo imágenes y PDF: otro bloque en base64 (un audio) no');
});

test('2. las sube directo al storage, sin el token, mirándolas por sus bytes; si falla, ese chat espera', async () => {
  const { subirAdjuntosDeTurnos } = await import('../scripts/operaciones/cartero.mjs');
  const subidos: Record<string, Buffer> = {};
  let conToken = 0;
  let fallar = false;
  const srv = createServer((req, res) => {
    const partes: Buffer[] = [];
    req.on('data', (p) => partes.push(p)).on('end', () => {
      const u = new URL(req.url ?? '/', 'http://x');
      if (u.pathname === '/api/operaciones/cartero' && u.searchParams.has('adjunto-turno')) {
        const o = JSON.parse(Buffer.concat(partes).toString('utf8'));
        if (fallar) { res.statusCode = 503; res.end('{}'); return; }
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ ok: true, url: `http://${req.headers.host}/almacen/${o.local}/${o.uuid}/${o.n}` }));
        return;
      }
      if (u.pathname.startsWith('/almacen/') && req.method === 'PUT') {
        if (req.headers.authorization) conToken += 1;
        subidos[u.pathname.slice('/almacen/'.length)] = Buffer.concat(partes);
        res.end('{}');
        return;
      }
      res.statusCode = 404; res.end();
    });
  });
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', () => ok()));
  const url = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
  try {
    const base = { local: LOCAL, uuid: UUID, rol: 'yo', de: null, texto: 'esta captura', at: '2026-10-20T14:00:00Z', trabajo: null };
    const r = await subirAdjuntosDeTurnos(url, `mkop_${'x'.repeat(30)}`, [{ ...base, crudos: [PNG.toString('base64'), EXE.toString('base64')] }]);
    assert.deepEqual(r.turnos, [{ ...base, adjuntos: [{ ref: `${LOCAL}/${UUID}/0`, mime: 'image/png', bytes: PNG.length }] }], 'sólo la foto; el ejecutable no');
    assert.equal('crudos' in r.turnos[0], false, 'el base64 nunca sale en la vuelta');
    assert.deepEqual(subidos[`${LOCAL}/${UUID}/0`], PNG, 'los bytes, tal cual');
    assert.equal(conToken, 0, 'al storage, sin el token del cartero');
    fallar = true;
    const otro = { ...base, local: OTRO };
    const f = await subirAdjuntosDeTurnos(url, `mkop_${'x'.repeat(30)}`, [{ ...otro, crudos: [PNG.toString('base64')] }, { ...otro, uuid: 'cccccccc-1111-4111-8111-111111111111' }, base]);
    assert.ok(f.fallidos.has(OTRO));
    assert.deepEqual(f.turnos.map((t: TurnoChat) => t.local), [LOCAL], 'ese chat no sale ahora: vuelve en la siguiente');
  } finally {
    srv.close();
  }
  const vuelta = leer('scripts/operaciones/cartero.mjs');
  assert.match(vuelta, /const marcas = delaVuelta\.marcas\.filter\(\(m\) => !subida\.fallidos\.has\(path\.basename\(m\.archivo, '\.json'\)\)\);/, 'y su marca no avanza');
});

test('3. MaKo acepta sólo adjuntos de ESE turno, con tipo y tamaño que valen, y nunca guarda una URL', async () => {
  const t = (adjuntos: unknown, extra: Record<string, unknown> = {}) => ({ local: LOCAL, uuid: UUID, rol: 'yo', de: null, texto: '', at: '2026-10-20T14:00:00Z', trabajo: null, adjuntos, ...extra });
  const bien = { ref: `${LOCAL}/${UUID}/0`, mime: 'image/png', bytes: 100, url: 'https://x/y' };
  assert.deepEqual(sanearTurnos([t([bien])])[0].adjuntos, [{ ref: `${LOCAL}/${UUID}/0`, mime: 'image/png', bytes: 100 }], 'sin la URL');
  assert.equal(sanearTurnos([t([{ ...bien, ref: `${OTRO}/${UUID}/0` }])]).length, 0, 'el ref de otro chat no entra (y sin texto, no hay turno)');
  assert.equal(sanearTurnos([t([{ ...bien, ref: `${LOCAL}/otro-uuid-1234/0` }])]).length, 0, 'ni el de otro turno');
  assert.equal(sanearTurnos([t([{ ...bien, ref: `${LOCAL}/${UUID}/../../x` }])]).length, 0, 'ni una ruta rara');
  assert.equal(sanearTurnos([t([{ ...bien, mime: 'text/html' }])]).length, 0, 'ni una página');
  assert.equal(sanearTurnos([t([{ ...bien, bytes: MAX_BYTES_ADJUNTO_TURNO + 1 }])]).length, 0);
  assert.equal(sanearTurnos([t([bien], { rol: 'el' })]).length, 0, 'sólo en lo que escribió Martín');
  const cartero = await import('../scripts/operaciones/cartero.mjs');
  assert.deepEqual(cartero.MIMES_ADJUNTO_TURNO, [...MIMES_ADJUNTO_TURNO]);
  assert.equal(cartero.MAX_ADJUNTOS_TURNO, MAX_ADJUNTOS_TURNO);
  assert.equal(cartero.MAX_BYTES_ADJUNTO_TURNO, MAX_BYTES_ADJUNTO_TURNO);
  const adj = leer('lib/operaciones-adjuntos.ts');
  assert.match(adj, /createSignedUploadUrl\(rutaTurno\(refAdjuntoTurno\(o\.local, o\.uuid, o\.n\)\), \{ upsert: true \}\)/, 'una vuelta que se repite no falla');
  const ruta = leer('app/api/operaciones/cartero/route.ts');
  const rama = ruta.slice(ruta.indexOf("searchParams.has('adjunto-turno')"));
  assert.ok(rama.indexOf('tokenDelCarteroValido(token)') < rama.indexOf('firmarAdjuntoDeTurno('), 'con el token del cartero');
});

test('4. la pantalla las ve en la burbuja de Martín, con URL firmada y sólo detrás de puedeOperar', () => {
  const acc = leer('app/admin/operaciones/acciones.ts');
  const turnos = acc.slice(acc.indexOf('export async function turnosCentroAction'));
  assert.ok(turnos.indexOf('puedeOperar(') < turnos.indexOf('conUrlsDeTurnos('), 'la URL, sólo con la guarda del Centro');
  assert.match(leer('lib/operaciones-adjuntos.ts'), /const VER_TURNO_S = 10 \* 60;/, '10 minutos');
  const turno: TurnoChat = { local: LOCAL, uuid: UUID, rol: 'yo', de: null, texto: '', at: '2026-10-20T14:00:00Z', trabajo: null,
    adjuntos: [{ ref: `${LOCAL}/${UUID}/0`, mime: 'image/png', bytes: 100, url: 'https://storage.example/firmada.png' }, { ref: `${LOCAL}/${UUID}/1`, mime: 'application/pdf', bytes: 9, url: 'https://storage.example/doc.pdf' }] };
  const lineas: LineaChat[] = [{ tipo: 'turno', instante: Date.parse(turno.at), turno }];
  const html = renderToStaticMarkup(createElement(Hilo, { lineas, pushes: [], ahora: Date.parse('2026-10-20T14:05:00Z'), vacio: '', quien: { titulo: 'CRM', animo: 'despierto' } }));
  assert.match(html, /<img src="https:\/\/storage\.example\/firmada\.png"/, 'la foto, arriba del texto');
  assert.match(html, /href="https:\/\/storage\.example\/doc\.pdf"[^>]*>[\s\S]*?PDF/, 'el PDF, su chip');
  assert.match(html, /En la app de Claude/, 'con la marca');
  assert.equal(vistaPrevia(lineas)?.texto, 'Archivo', 'la fila: «Archivo» si hay algo que no es foto');
  assert.equal(vistaPrevia([{ tipo: 'turno', instante: Date.parse(turno.at), turno: { ...turno, adjuntos: [turno.adjuntos![0]] } }])?.texto, 'Foto');
});

test('5. «Pegar» del «+» toma la captura copiada; sin imagen, lo dice', async () => {
  const blob = new Blob([PNG], { type: 'image/png' });
  const cb = (items: Array<{ types: string[]; getType: (t: string) => Promise<Blob> }>) => ({ read: async () => items }) as unknown as Pick<Clipboard, 'read'>;
  const fs = await imagenesDelPortapapeles(cb([{ types: ['text/plain', 'image/png'], getType: async () => blob }]));
  assert.equal(fs?.length, 1);
  assert.equal(fs?.[0].type, 'image/png');
  assert.deepEqual(await imagenesDelPortapapeles(cb([{ types: ['text/plain'], getType: async () => new Blob(['hola']) }])), [], 'un texto copiado no es una imagen');
  assert.equal(await imagenesDelPortapapeles(undefined), null, 'un navegador que no deja leer el portapapeles');
  const caja = leer('app/admin/operaciones/AdjuntosCaja.tsx');
  assert.match(caja, /onClick=\{pegarImagen\}>[\s\S]*?<span>Pegar<\/span>/, 'el «Pegar» del «+»');
  assert.match(caja, /if \(fs\?\.length\) a\?\.onSumar\(fs\); else a\?\.onSinImagen\?\.\(fs != null\);/);
});
