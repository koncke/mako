// =============================================================================
// CREAR CON IA: EL ADJUNTO SE RAZONA ANTES DE LEERLO (16/10/2026)
// =============================================================================
// Feedback de Martín del 16/10 (por Cerebro, bug A2): adjuntó el lead magnet (mako-estrella (2).png) a «Crea una
// automatización por Instagram dando este "Lead Magnet"…», MaKo intentó LEERLO con visión («gemini high demand /
// openrouter unavailable») y se cayó todo. Textual: «Entiendo que aveces necesitamos leer porque hay instrucciones, pero
// otras como esta, son docs o cosas para DENTRO de la automatización... Debe razonar.»
//
// Lo que se fija:
//   · `usoDelArchivo`: CONTENIDO si lo escrito lo da o lo manda («dando este lead magnet», «mándales el PDF»),
//     INSTRUCCIONES si dice que hay que seguirlo o si no hay nada escrito; ante la duda, instrucciones;
//   · el pedido nombra el archivo de contenido con su id, y `deIA` lo pone en el mensaje que lo entrega si el modelo no lo
//     puso (sin depender de que el modelo lo haya visto);
//   · la caja NO lee al elegir; al mandar, contenido va a la biblioteca sin leerlo, y si subir o leer falla el pedido
//     sale igual.
//
// ⚠️ PROBADO ROMPIENDO (16/10/2026, scratchpad romper-a.mjs; base 4 pass / 0 fail, 5 roturas, todas atajadas). El
// resultado MEDIDO de cada rotura, al lado de su test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { usoDelArchivo, pedidoConContenido, archivoDelPedido, pedidoSinLeer } from '../lib/archivo-del-pedido';
import { deIA, disparadoresParaIA, LISTA_BLANCA_IA, type CtxIA, type PasoIA } from '../lib/flujo-ia';
import { opcionesCronIA } from '../lib/disparadores';
import { catalogosDe, etapasDeCondicion } from '../lib/condiciones-catalogos';
import { claseDe, type PasoGrafo } from '../lib/flujo-grafo';
import { porId } from '../lib/api-mako/registro';

const leer = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// rotura 1 (sin «lead magnet» como contenido): 3 pass / 1 fail, cae éste.
test('para qué es el archivo: lo que el flujo DA es contenido; lo que dice cómo armarlo, instrucciones', () => {
  const contenido = [
    'Crea una automatización por Instagram dando este "Lead Magnet" y pidiendo que nos sigan para dárselo...',
    'Mándales este PDF a los que agenden',
    'Cuando comenten, envíales la guía',
    'Pásales el ebook gratis',
    'Que les llegue el descargable apenas se registran',
  ];
  for (const t of contenido) assert.equal(usoDelArchivo(t), 'contenido', t);
  const instrucciones = [
    '',
    'Seguí este proceso para el seguimiento',
    'Armá el flujo de esta captura',
    'Dales la bienvenida a los nuevos',
    'Haz una automatización como dice el documento',
  ];
  for (const t of instrucciones) assert.equal(usoDelArchivo(t), 'instrucciones', t || '(vacío)');
});

// rotura 2 (la marca que no se puede leer de vuelta): 2 pass / 2 fail, caen éste y el de `deIA`.
test('el pedido nombra el archivo de contenido con su id, y se lee de vuelta sin el modelo', () => {
  const p = pedidoConContenido('Dando este lead magnet', { nombre: 'mako-estrella (2).png', id: 77 });
  assert.equal(archivoDelPedido(p), 77);
  assert.match(p, /^Dando este lead magnet\n\n📎 Archivo para mandar: «mako-estrella \(2\)\.png» \(biblioteca #77\)/);
  assert.equal(archivoDelPedido('Dando este lead magnet'), null);
  assert.match(pedidoSinLeer('Hola', 'x.png'), /\(Adjuntó «x\.png», pero no se pudo leer: armala con lo escrito\.\)$/);
  assert.match(pedidoSinLeer('', 'x.png', 'subir'), /^Arma la automatización\.\n\n\(Adjuntó «x\.png», pero no se pudo subir/);
});

const acciones = LISTA_BLANCA_IA.map((id) => { const d = porId(id)!; return { id: d.id, titulo: d.titulo, parametros: d.parametros }; });
const PRODUCTOS = [{ funnelId: 2, productoId: 10, nombre: 'Fiesta Music', esDefault: true, etapas: [{ value: 'nuevo', label: 'Lead entrante' }], etapasEntrega: [{ value: 'onboarding', label: 'Onboarding' }] }];
const ctx = (pedido: string, archivos: CtxIA['archivos']): CtxIA => ({
  etiquetas: [], productos: PRODUCTOS,
  disparadores: disparadoresParaIA(opcionesCronIA({ productos: PRODUCTOS, etiquetas: [], conectados: { instagram: true, messenger: true, email: false, pagos: false } })),
  audios: [], archivos, acciones, links: {},
  catalogoCondicion: catalogosDe({ etapas: etapasDeCondicion(PRODUCTOS), productos: PRODUCTOS, remotos: null }),
  pedido, perfil: 'Fiesta Music.',
});
const clave = (c: CtxIA, valor: string) => `d${c.disparadores.findIndex((d) => d.value === valor) + 1}`;
const mensajes = (pasos: readonly PasoGrafo[]) => pasos.filter((p) => claseDe(p) === 'mensaje') as PasoIA[];
const TARJETAS = [
  { id: 't1', tipo: 'mensaje', texto: '¡Gracias por comentar! Síguenos y te lo mando.', sigue: 't2' },
  { id: 't2', tipo: 'mensaje', texto: 'Aquí tienes tu regalo 🎁' },
];

// rotura 3 (`deIA` no pone el archivo que el modelo olvidó): 3 pass / 1 fail, cae éste.
test('el lead magnet que el modelo no puso va en el último mensaje, y se dice; uno que el canal no toma, no', () => {
  const pedido = pedidoConContenido('Por Instagram, dando este lead magnet', { nombre: 'estrella.png', id: 77 });
  const c = ctx(pedido, [{ id: 77, titulo: 'estrella', mime: 'image/png' }]);
  const r = deIA({ disparador: clave(c, 'instagram:comentario'), inicio: 't1', tarjetas: TARJETAS }, c);
  const [m1, m2] = mensajes(r.pasos);
  assert.equal(m1.tipo, undefined);
  assert.equal(m2.tipo, 'media');
  assert.equal(Number(m2.media_id), 77);
  assert.equal(m2.cuerpo, 'Aquí tienes tu regalo 🎁');
  assert.ok(r.avisos.includes('Puse «estrella» en el último mensaje'), r.avisos.join(' | '));
  // El modelo ya lo puso: no se toca nada más.
  const r2 = deIA({ disparador: clave(c, 'instagram:comentario'), inicio: 't1', tarjetas: [{ ...TARJETAS[0], archivo: 77, sigue: 't2' }, TARJETAS[1]] }, c);
  assert.deepEqual(mensajes(r2.pasos).map((m) => m.tipo), ['media', undefined]);
  // Un MP3 por Instagram no va: se dice, y el flujo queda sin él.
  const c3 = ctx(pedido, [{ id: 77, titulo: 'audio', mime: 'audio/mpeg' }]);
  const r3 = deIA({ disparador: clave(c3, 'instagram:comentario'), inicio: 't1', tarjetas: TARJETAS }, c3);
  assert.ok(mensajes(r3.pasos).every((m) => m.tipo !== 'media'));
  assert.ok(r3.avisos.includes('No puse «audio»: súmalo en un mensaje'), r3.avisos.join(' | '));
});

const CHAT = leer('app/automations/ChatMako.tsx');

// rotura 4 (elegir vuelve a leer el archivo): 3 pass / 1 fail, cae éste.
// rotura 5 (si subir falla, el pedido no sale): 3 pass / 1 fail, cae éste.
test('la caja: elegir no lee; al mandar, contenido va a la biblioteca sin leerse, y si algo falla el pedido sale igual', () => {
  const subir = CHAT.slice(CHAT.indexOf('const subir = (file: File) => {'), CHAT.indexOf('const mandarConArchivo'));
  assert.ok(subir.length > 50, 'no encontré `subir`');
  assert.doesNotMatch(subir, /leerArchivoParaPedido|subirArchivoDelPedido/, 'elegir el archivo no lo lee ni lo sube');
  const mandar = CHAT.slice(CHAT.indexOf('const mandarConArchivo'), CHAT.indexOf('const alMas'));
  assert.match(mandar, /if \(usoDelArchivo\(escrito\) === 'contenido'\) \{/);
  assert.match(mandar, /onPedido\(r\.ok \? pedidoConContenido\(escrito, \{ nombre: a\.nombre, id: r\.id \}\) : pedidoSinLeer\(escrito, a\.nombre, 'subir'\)\);/);
  assert.match(mandar, /onPedido\(r\.ok \? pedidoConArchivo\(escrito, \{ nombre: a\.nombre, texto: r\.texto \}\) : pedidoSinLeer\(escrito, a\.nombre\)\);/);
  assert.match(CHAT, /const listo = flujo \? !!flujo\.nombre : archivo \? archivo\.estado === 'elegido' : !!texto\.trim\(\);/);
  assert.match(leer('app/automations/archivo-pedido-cliente.ts'), /await post\(\{ action: 'registrar', path: firma\.path, nombre: file\.name, titulo: tituloDeArchivo\(file\.name\) \}\)/);
});
