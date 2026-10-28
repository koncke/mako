// =============================================================================
// Lo que la caja LEE es de su conversación (28/10/2026, la verificación de 05d7c3187)
// =============================================================================
// Soporte usa UNA caja para todos sus tickets y la conversación nueva. Lo que la pantalla toma (fotos, PDF) ya iba por
// conversación (useSoporte → claveCaja), pero lo que la caja lee sola (app/_chat/adjuntos-que-se-leen.ts: un .pptx, un .md, un
// audio) era UNA lista por caja: el .pptx del ticket 7 aparecía en el 8 cerrado (con la ✕ apagada) y salía con el próximo
// mensaje del 9. Y lo que se estaba leyendo cuando la persona cambiaba de ticket salía como respuesta al ticket equivocado.
// Esto corre el hook REAL (tests/hook-en-node.ts), con la subida y la lectura de mentira y en pausa.
// Probado rompiéndolo: el hook de 05d7c3187 (una lista por caja) → rojo en los dos; sin mirar la conversación al terminar de
// leer → rojo en el 2.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { armarHook, dibujador } from './hook-en-node';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

type Item = { file: File; estado?: string };
type Lee = { adjuntos: { items: Item[]; onSumar: (fs: File[]) => void }; mandar: () => void; leyendo: boolean };
type Props = { activo: boolean; texto: string; onTexto: (t: string) => void; onMandar: () => void; conversacion: string };

let useLee: ((p: Props) => Lee) | null = null;
async function hook() {
  useLee ??= (await armarHook(RAIZ, 'app/_chat/adjuntos-que-se-leen.ts', {
    './nota-que-se-manda': 'export function listaParaMandar(p, t) { return p != null && !!p.trim() && t.trim() === p.trim(); }',
  })).useAdjuntosQueSeLeen as (p: Props) => Lee;
  return useLee;
}
const vuelta = () => new Promise((x) => setImmediate(x));

/** La subida y la lectura de mentira: `leer` queda en pausa hasta `soltar()`. */
function lector() {
  const pausadas: Array<() => void> = [];
  globalThis.fetch = (async (_url: string, init?: { method?: string; body?: string }) => {
    if (init?.method === 'PUT') return { ok: true } as Response;
    const cuerpo = JSON.parse(init?.body ?? '{}') as { accion: string; nombre?: string };
    if (cuerpo.accion === 'subir-url') return { ok: true, json: async () => ({ ok: true, signedUrl: 'http://almacen/x', path: 'p' }) } as unknown as Response;
    await new Promise<void>((ok) => pausadas.push(ok));
    return { ok: true, json: async () => ({ ok: true, texto: `CONTENIDO DE ${cuerpo.nombre}` }) } as unknown as Response;
  }) as typeof fetch;
  return {
    soltar: async () => {
      for (let i = 0; i < 20 && !pausadas.length; i++) await vuelta();
      assert.ok(pausadas.length, 'la lectura no llegó a pedirse');
      for (const f of pausadas.splice(0)) f();
      for (let i = 0; i < 6; i++) await vuelta();
    },
  };
}

/** Una pantalla con varias conversaciones y una caja: lo escrito, lo que salió y a dónde. */
function pantalla(useAdjuntos: (p: Props) => Lee) {
  const { dibujar } = dibujador(useAdjuntos);
  const e = { texto: '', textos: [] as string[], mandados: [] as string[], conversacion: 'soporte:7' };
  const ver = (c = e.conversacion) => {
    e.conversacion = c;
    return dibujar({ activo: true, texto: e.texto, onTexto: (t) => { e.texto = t; e.textos.push(t); }, onMandar: () => { e.mandados.push(`${e.conversacion}: ${e.texto}`); }, conversacion: c });
  };
  return { e, ver };
}
const nombres = (s: Lee) => s.adjuntos.items.map((x) => x.file.name);

test('1. lo que la caja lee queda en la conversación donde se adjuntó: no pasa al ticket cerrado ni al siguiente, y vuelve con el suyo', async () => {
  const p = pantalla(await hook());
  p.ver('soporte:7').adjuntos.onSumar([new File(['x'], 'deck.pptx', { type: PPTX })]);
  assert.deepEqual(nombres(p.ver()), ['deck.pptx']);
  assert.deepEqual(nombres(p.ver('soporte:8')), [], 'el .pptx del 7 apareció en el 8 cerrado');
  assert.deepEqual(nombres(p.ver('soporte:9')), [], 'y en el 9');
  assert.deepEqual(nombres(p.ver('soporte:7')), ['deck.pptx'], 'vuelve con el 7');
});

test('2. lo que se estaba leyendo cuando se cambió de conversación NO sale en la otra: queda en la suya', async () => {
  const p = pantalla(await hook());
  const l = lector();
  p.ver('soporte:7').adjuntos.onSumar([new File(['x'], 'deck.pptx', { type: PPTX })]);
  p.e.texto = 'mirá el deck';
  p.ver().mandar();
  await vuelta();
  assert.equal(p.ver().leyendo, true, 'se está leyendo en el 7');
  assert.equal(p.ver('soporte:9').leyendo, false, 'la caja del 9 no queda girando por la lectura del 7');
  await l.soltar();
  p.ver('soporte:9');
  assert.deepEqual(p.e.mandados, [], 'lo del 7 salió como mensaje en el 9');
  assert.ok(p.e.textos.every((t) => !t.includes('CONTENIDO')), 'lo leído del 7 cayó en la caja del 9');
  const en7 = p.ver('soporte:7');
  assert.deepEqual(nombres(en7), ['deck.pptx'], 'el .pptx queda en el 7, para mandarlo desde ahí');
  assert.equal(en7.adjuntos.items[0].estado, undefined, 'y no queda «leyendo» para siempre');
  // Desde el 7, sale en el 7.
  en7.mandar();
  await l.soltar();
  p.ver('soporte:7');
  assert.equal(p.e.mandados.length, 1);
  assert.match(p.e.mandados[0], /^soporte:7: mirá el deck[\s\S]*CONTENIDO DE deck\.pptx/);
});

test('3. Soporte le dice a la caja de qué conversación es', () => {
  assert.match(leer('app/tickets/soporte/PiezasSoporte.tsx'), /conversacion=\{s\.claveCaja\}/);
  assert.match(leer('app/_chat/CajaChat.tsx'), /useAdjuntosQueSeLeen\(\{[^}]*conversacion: p\.conversacion \}\)/);
});
