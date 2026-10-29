// =============================================================================
// Lo que la caja LEE es de su conversación (28/10/2026, la verificación de 05d7c3187)
// =============================================================================
// Soporte usa UNA caja para todos sus tickets y la conversación nueva. Lo que la pantalla toma (fotos, PDF) ya iba por
// conversación (useSoporte → claveCaja), pero lo que la caja lee sola (app/_chat/adjuntos-que-se-leen.ts: un .pptx, un .md, un
// audio) era UNA lista por caja: el .pptx del ticket 7 aparecía en el 8 cerrado (con la ✕ apagada) y salía con el próximo
// mensaje del 9. Y lo que se estaba leyendo cuando la persona cambiaba de ticket salía como respuesta al ticket equivocado.
// Esto corre el hook REAL (tests/hook-en-node.ts), con la subida y la lectura de mentira y en pausa.
// Probado rompiéndolo: el hook de 05d7c3187 (una lista por caja) → rojo en los dos; sin mirar la conversación al terminar de
// leer → rojo en el 2. Y (la verificación de d2f690673): el hook de d2f690673 (una lectura por caja) → rojo en el 4;
// Conversacion.tsx o ChatsMovil.tsx sin `conversacion` → rojo en el 3. Y (la verificación de 1d586a686): el hook de 1d586a686,
// con lo guardado DENTRO de la caja → rojo en el 5; sin `vivo` → el 5; useAdjuntosDelChat o MakoChat de 1d586a686 → el 6.
// ⚠️ Lo guardado por conversación es de TODAS las cajas (vive fuera de ellas): cada test usa sus claves («a-», «b-»…).
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
  p.ver('a-soporte:7').adjuntos.onSumar([new File(['x'], 'deck.pptx', { type: PPTX })]);
  assert.deepEqual(nombres(p.ver()), ['deck.pptx']);
  assert.deepEqual(nombres(p.ver('a-soporte:8')), [], 'el .pptx del 7 apareció en el 8 cerrado');
  assert.deepEqual(nombres(p.ver('a-soporte:9')), [], 'y en el 9');
  assert.deepEqual(nombres(p.ver('a-soporte:7')), ['deck.pptx'], 'vuelve con el 7');
});

test('2. lo que se estaba leyendo cuando se cambió de conversación NO sale en la otra: queda en la suya', async () => {
  const p = pantalla(await hook());
  const l = lector();
  p.ver('b-soporte:7').adjuntos.onSumar([new File(['x'], 'deck.pptx', { type: PPTX })]);
  p.e.texto = 'mirá el deck';
  p.ver().mandar();
  await vuelta();
  assert.equal(p.ver().leyendo, true, 'se está leyendo en el 7');
  assert.equal(p.ver('b-soporte:9').leyendo, false, 'la caja del 9 no queda girando por la lectura del 7');
  await l.soltar();
  p.ver('b-soporte:9');
  assert.deepEqual(p.e.mandados, [], 'lo del 7 salió como mensaje en el 9');
  assert.ok(p.e.textos.every((t) => !t.includes('CONTENIDO')), 'lo leído del 7 cayó en la caja del 9');
  const en7 = p.ver('b-soporte:7');
  assert.deepEqual(nombres(en7), ['deck.pptx'], 'el .pptx queda en el 7, para mandarlo desde ahí');
  assert.equal(en7.adjuntos.items[0].estado, undefined, 'y no queda «leyendo» para siempre');
  // Desde el 7, sale en el 7.
  en7.mandar();
  await l.soltar();
  p.ver('b-soporte:7');
  assert.equal(p.e.mandados.length, 1);
  assert.match(p.e.mandados[0], /^b-soporte:7: mirá el deck[\s\S]*CONTENIDO DE deck\.pptx/);
});

test('3. Soporte y el Ops Center le dicen a la caja de qué conversación es', () => {
  assert.match(leer('app/tickets/soporte/PiezasSoporte.tsx'), /conversacion=\{s\.claveCaja\}/);
  assert.match(leer('app/_chat/CajaChat.tsx'), /useAdjuntosQueSeLeen\(\{[^}]*conversacion: p\.conversacion \}\)/);
  // El Ops Center usa la misma caja para todos los chats (la verificación de d2f690673: un .m4a del chat A salía con el «hola B»).
  assert.match(leer('app/admin/operaciones/Conversacion.tsx'), /conversacion=\{chat\.clave\}/);
  assert.match(leer('app/m/operaciones/ChatsMovil.tsx'), /<CajaChat [\s\S]{0,600}?conversacion=\{elegido\.clave\}/);
});

test('4. mientras una conversación lee, otra manda lo suyo EN EL ACTO (no queda esperando sin decir nada)', async () => {
  const p = pantalla(await hook());
  const l = lector();
  p.ver('d-soporte:7').adjuntos.onSumar([new File(['x'], 'deck.pptx', { type: PPTX })]);
  p.e.texto = 'mirá el deck';
  p.ver().mandar();
  await vuelta();
  assert.equal(p.ver().leyendo, true, 'el 7 lee');
  // En el 9 se adjunta otro, se escribe y se manda: lee lo suyo ya, sin esperar al 7.
  p.ver('d-soporte:9').adjuntos.onSumar([new File(['y'], 'otro.pptx', { type: PPTX })]);
  p.e.texto = 'esto es del 9';
  p.ver().mandar();
  await vuelta();
  assert.equal(p.ver().leyendo, true, 'el 9 no arrancó a leer: Enter no hizo nada');
  await l.soltar();
  p.ver('d-soporte:9');
  assert.equal(p.e.mandados.length, 1, 'el 9 no salió');
  assert.match(p.e.mandados[0], /^d-soporte:9: esto es del 9[\s\S]*CONTENIDO DE otro\.pptx/);
  assert.ok(!p.e.mandados[0].includes('deck.pptx'), 'lo del 7 salió en el 9');
  assert.deepEqual(nombres(p.ver('d-soporte:7')), ['deck.pptx'], 'lo del 7 sigue en el 7');
});

test('5. la caja se va (un chat sin caja en el medio, la hoja que se cierra) y vuelve: lo adjuntado sigue, y lo que se leía no sale solo', async () => {
  // La verificación de 1d586a686: en el Ops Center, un audio adjuntado en un chat se perdía al pasar por el Runner (que no tiene
  // caja) y volver. Lo guardado por conversación vive FUERA de la caja.
  const useAdjuntos = await hook();
  const l = lector();
  const antes = dibujador(useAdjuntos);
  const e = { texto: 'escuchá esto', textos: [] as string[], mandados: [] as string[] };
  const props = (c: string): Props => ({ activo: true, texto: e.texto, onTexto: (t) => { e.texto = t; e.textos.push(t); }, onMandar: () => { e.mandados.push(c); }, conversacion: c });
  antes.dibujar(props('e-centro:A')).adjuntos.onSumar([new File(['x'], 'reunion.m4a', { type: 'audio/mp4' })]);
  antes.dibujar(props('e-centro:A')).mandar();
  await vuelta();
  antes.desmontar();
  await l.soltar();
  assert.deepEqual(e.mandados, [], 'la lectura terminó con la caja desmontada y mandó igual');
  assert.ok(e.textos.every((t) => !t.includes('CONTENIDO')), 'y escribió lo leído en el campo');
  const despues = dibujador(useAdjuntos);
  const vuelto = despues.dibujar(props('e-centro:A'));
  assert.deepEqual(nombres(vuelto), ['reunion.m4a'], 'el audio se perdió al pasar por un chat sin caja');
  assert.equal(vuelto.adjuntos.items[0].estado, undefined, 'y no quedó «leyendo»');
  assert.deepEqual(nombres(despues.dibujar(props('e-centro:B'))), [], 'y no pasó a otro chat');
});

test('6. MakoChat: lo juntado por la pantalla (fotos y PDF) también es de SU sesión', async () => {
  // La verificación de 1d586a686 (M1): la foto de la sesión 1 salía con el «hola» de la sesión 2. Lo que la caja lee lo cubre
  // `conversacion`; lo de la pantalla, `useAdjuntosDelChat` con la suya.
  const usar = (await armarHook(RAIZ, 'app/_chat/useAdjuntosDelChat.ts', {
    '@/app/m/mako/achicar-imagen': 'export async function achicarImagen(f) { return f; }',
  })).useAdjuntosDelChat as (p: { puede: boolean; onError: (m: string | null) => void; conversacion?: string }) => {
    caja: { items: Item[]; onSumar: (fs: File[]) => void }; tomar: () => File[];
  };
  const { dibujar } = dibujador(usar);
  const ver = (c: string) => dibujar({ puede: true, onError: () => {}, conversacion: c });
  ver('1').caja.onSumar([new File(['x'], 'foto.png', { type: 'image/png' })]);
  for (let i = 0; i < 4; i++) await vuelta();
  assert.deepEqual(ver('1').caja.items.map((x) => x.file.name), ['foto.png']);
  const en2 = ver('2');
  assert.deepEqual(en2.caja.items, [], 'la foto de la sesión 1 se ve en la 2');
  assert.deepEqual(en2.tomar(), [], 'y sale con el mensaje de la 2');
  assert.deepEqual(ver('1').tomar().map((f) => f.name), ['foto.png'], 'sale con el de la 1');
  // Y MakoChat les pasa su sesión a las dos (a la caja, con su endpoint y su gráfico: lo guardado es de todas las cajas).
  const mako = leer('app/_components/MakoChat.tsx');
  assert.match(mako, /useAdjuntosDelChat\(\{ puede: !pensando && !!sessionId, onError: setErr, conversacion: sessionId \? String\(sessionId\) : '' \}\)/);
  assert.match(mako, /conversacion=\{sessionId \? `mako-chat:\$\{endpoint\}:\$\{chartKey\}:\$\{sessionId\}` : undefined\}/);
});

test('7. lo leído sigue «entregando» hasta que le LLEGA a la pantalla (no sólo hasta que termina de leerse)', async () => {
  // La verificación de 5ddf1672a: la caja avisaba «dejé de leer» un dibujo antes de entregar el mensaje, y en esa ventana el
  // ticket de Soporte salía sin él.
  const p = pantalla(await hook());
  const l = lector();
  p.ver('g-soporte:7').adjuntos.onSumar([new File(['x'], 'deck.pptx', { type: PPTX })]);
  p.e.texto = 'mirá el deck';
  p.ver().mandar();
  await l.soltar();
  const recien = p.ver();
  assert.equal(recien.leyendo, false, 'terminó de leer');
  assert.equal((recien as Lee & { entregando: boolean }).entregando, true, 'leído y todavía sin entregar: la pantalla tiene que seguir esperando');
  assert.equal(p.e.mandados.length, 1, 'en ese mismo dibujo se entrega');
  assert.equal((p.ver() as Lee & { entregando: boolean }).entregando, false, 'y recién ahí deja de esperar');
});

test('8. una caja SIN conversación que se va mientras lee: lo leído queda en el campo de la pantalla y no se manda', async () => {
  // La verificación de 5ddf1672a (X1): el Ops Center del cliente desmonta la caja al abrir Tickets. Sin `conversacion` lo adjuntado
  // vivía en la caja y se iba con ella: el .pptx desaparecía sin aviso. Ahora queda en el campo, que vive en la pantalla.
  const useAdjuntos = await hook();
  const l = lector();
  const caja = dibujador(useAdjuntos);
  const e = { texto: 'mirá el deck', mandados: 0 };
  const props = (): Omit<Props, 'conversacion'> & { conversacion?: string } => ({ activo: true, texto: e.texto, onTexto: (t) => { e.texto = t; }, onMandar: () => { e.mandados++; } });
  caja.dibujar(props() as Props).adjuntos.onSumar([new File(['x'], 'deck.pptx', { type: PPTX })]);
  caja.dibujar(props() as Props).mandar();
  await vuelta();
  caja.desmontar();
  await l.soltar();
  assert.equal(e.mandados, 0, 'se mandó con la caja desmontada');
  assert.match(e.texto, /^mirá el deck[\s\S]*CONTENIDO DE deck\.pptx/, 'lo leído se perdió en vez de quedar en el campo');
});
