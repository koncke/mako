// =============================================================================
// Los documentos del «+» en una conversación de Offer, desde el Ops Center (22/10/2026, OC7)
// =============================================================================
// En el Ops Center, el «+» de una conversación de Offer dejaba los archivos AFUERA sin decirlo: el turno salía sólo con el
// texto (relevo del Ops Center, «SIN HACER» 2). Ahora se suben y se leen en ESA conversación, como en la tab (subir-url → PUT →
// 'leer'), y viajan como `docIds`:
//   1. uno por uno y en orden; si uno no se pudo leer, para ahí y lo dice, y el turno NO sale;
//   2. el reintento del mismo mensaje no vuelve a subir ni a leer lo que ya se leyó;
//   3. la pantalla le pasa los archivos al motor de Offer.
//
// Correr: node --import tsx --test tests/ops-center-offer-documentos.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerArchivosDeOffer, type ParaLeer } from '../app/second-brain/motor-offer';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Una tab de mentira: anota lo que se subió y lo que se leyó; `falla` hace fallar la lectura de ese nombre. */
function tab(falla: string | null = null) {
  const subidos: string[] = [];
  const leidos: Array<Record<string, unknown>> = [];
  const con: ParaLeer = {
    subir: async (f) => { subidos.push(f.name); return `ws3/offer/${f.name}`; },
    llamar: (async (cuerpo: Record<string, unknown>) => {
      leidos.push(cuerpo);
      if (cuerpo.nombre === falla) throw new Error('No pude leer ese archivo.');
      return { sesion: { id: 14, mensajes: [] }, doc: { id: `doc-${String(cuerpo.nombre)}` } };
    }) as unknown as ParaLeer['llamar'],
  };
  return { con, subidos, leidos };
}

test('1. uno por uno y en orden; si uno no se pudo leer, para ahí y lo dice (el turno no sale)', async () => {
  const a = new File(['%PDF'], 'oferta.pdf', { type: 'application/pdf' });
  const b = new File(['hola'], 'guion.txt', { type: 'text/plain' });
  const t = tab();
  const r = await leerArchivosDeOffer(14, [a, b], t.con);
  assert.deepEqual(r.ok && r.docIds, ['doc-oferta.pdf', 'doc-guion.txt']);
  assert.deepEqual(t.leidos.map((c) => [c.action, c.sesionId, c.path, c.mime]), [
    ['leer', 14, 'ws3/offer/oferta.pdf', 'application/pdf'], ['leer', 14, 'ws3/offer/guion.txt', 'text/plain'],
  ]);
  const c = new File(['x'], 'roto.pdf', { type: 'application/pdf' });
  const d = new File(['y'], 'despues.pdf', { type: 'application/pdf' });
  const t2 = tab('roto.pdf');
  const r2 = await leerArchivosDeOffer(14, [c, d], t2.con);
  assert.equal(r2.ok, false);
  assert.match(!r2.ok ? r2.error : '', /^No pude leer «roto\.pdf»/);
  assert.deepEqual(t2.subidos, ['roto.pdf'], 'el de después ni se sube');
  // turnoOffer lee los archivos ANTES del turno y, si fallan, vuelve sin mandarlo.
  const motor = sinComentarios(leer('app/second-brain/motor-offer.ts'));
  assert.match(motor, /const docs = await leerArchivosDeOffer\(id, archivos\);\n\s*if \(!docs\.ok\) return \{ ok: false, error: docs\.error \};/);
  assert.ok(motor.indexOf('leerArchivosDeOffer(id, archivos)') < motor.indexOf("action: 'turno'"), 'antes del turno');
});

test('2. el reintento no vuelve a subir ni a leer lo que ya se leyó', async () => {
  const a = new File(['%PDF'], 'oferta.pdf', { type: 'application/pdf' });
  const c = new File(['x'], 'roto.pdf', { type: 'application/pdf' });
  const t = tab('roto.pdf');
  await leerArchivosDeOffer(20, [a, c], t.con);
  const t2 = tab();
  const r = await leerArchivosDeOffer(20, [a, c], t2.con);
  assert.deepEqual(r.ok && r.docIds, ['doc-oferta.pdf', 'doc-roto.pdf']);
  assert.deepEqual(t2.subidos, ['roto.pdf'], 'sólo el que faltaba');
});

test('3. la pantalla le pasa los archivos del «+» al motor de Offer', () => {
  const motor = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.match(motor, /if \(idOffer != null\) void mandarAOffer\(idU, t, archivos\);/);
  assert.match(motor, /turnoOffer\(s\.id, mensaje, s\.mensajes, respuestaDeOffer\(s\.mensajes, mensaje\), archivos\.map\(\(a\) => a\.file\)\)/);
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 3/0):
//   · sigue leyendo después de uno que falló        → 2/1 (1)
//   · sin recordar lo ya leído                       → 2/1 (2)
//   · el turno sale aunque un archivo falló          → 2/1 (1)
//   · la pantalla no le pasa los archivos            → 2/1 (3)
