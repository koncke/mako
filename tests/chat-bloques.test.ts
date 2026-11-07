// =============================================================================
// El marco de bloques del chat con MaKo (20/10/2026, ola 1 de «Ops Center = lo principal», pieza 1.7)
// =============================================================================
// docs/ops-center-principal.md §2.4. Hecho = «Confirmar `crear_diseno_imagen` dibuja su miniatura sin recargar; un test
// dibuja cada tipo; se ve en la computadora y en Android». Lo que se fija:
//   1. el saneo: un bloque sólo lleva rutas de la app (nunca un link de afuera ni `javascript:`), y lo que no calza no se dibuja;
//   2. confirmar `crear_diseno_imagen` por el camino REAL de la tarjeta (tests/_bloques-tarjeta-hijo.ts) devuelve el G5 con
//      su miniatura y su forma, lo guarda con el «Hecho: …», y la pantalla lo suma al hilo SIN recargar (y al recargar vuelve);
//   3. cada tipo se dibuja (G5 con y sin miniatura, G4, G6, G1);
//   4. las TRES caras del hilo (la computadora, el teléfono, el MaKo Analyst de la ficha) dibujan el bloque con la MISMA pieza,
//      y las cuatro pantallas que tocan una tarjeta suman lo que vuelve con `itemsTrasTarjeta`;
//   5. G3: lo que no se deshace va en rojo pegado al botón.
//
// Probado rompiéndolo (20/10/2026, con la base en 0 fallos):
//   · `confirmarDesdeTarjeta` sin devolver `bloques` → 1 fallo (2);
//   · el runner sin `bloque` en sus `datos` → 1 fallo (2);
//   · `rutaInterna` que deja pasar todo → 1 fallo (1);
//   · `itemsTrasTarjeta` sin los bloques → 1 fallo (2);
//   · el hilo del teléfono sin el caso `bloque` → 1 fallo (4).

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { bloquesGuardados, proporcion, rutaInterna, sanearBloque, type Bloque } from '../lib/chat-bloques';
import { itemsDeSesion, itemsTrasTarjeta } from '../app/m/mako/chat-ui';
import type { ResultadoTarjeta } from '../lib/mako-turno-app-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const dibujar = async (b: Bloque, onResponder?: (t: string) => void) => {
  const { BloqueHilo } = await import('../app/_chat/BloqueHilo');
  return renderToStaticMarkup(createElement(BloqueHilo, { b, onResponder }));
};

// La miniatura es la que guarda el editor en Storage: desde el 6/11/2026 ninguna plantilla trae una (las 10 de Doory,
// las únicas con un WebP en `/cv/plantillas/`, se borraron).
const G5: Bloque = { t: 'creado', titulo: 'Promo', estado: 'Nuevo', miniatura: 'https://abc.supabase.co/storage/v1/object/public/image-editor/3/promo.webp', ancho: 1080, alto: 1350, abrir: { titulo: 'Abrir en Image Editor', href: '/image-editor/abc' } };

test('1. el saneo: sólo rutas de la app; lo que no calza no se dibuja', () => {
  assert.deepEqual(sanearBloque(G5), G5, 'un G5 bien armado pasa entero');
  for (const href of ['https://otro.com/x', '//otro.com/x', 'javascript:alert(1)', '/\\otro.com', '/a/../../admin', ' /x y', '/x\ny']) {
    assert.equal(rutaInterna(href), null, `«${href}» no es una ruta de la app`);
    assert.equal(sanearBloque({ ...G5, abrir: { titulo: 'Abrir', href } }), null, `un G5 que abre «${href}» no se dibuja`);
  }
  assert.equal(rutaInterna('/image-editor/abc?propuesta=1'), '/image-editor/abc?propuesta=1');
  // La miniatura: una ruta de la app o la pública que guarda el editor; otra cosa se cae y el bloque queda con el marco.
  const afuera = sanearBloque({ ...G5, miniatura: 'https://rastreo.com/pixel.png' });
  assert.ok(afuera && afuera.t === 'creado' && !('miniatura' in afuera), 'una miniatura de afuera se descarta');
  const deStorage = 'https://abc.supabase.co/storage/v1/object/public/image-editor/3/x.webp?v=1';
  assert.equal((sanearBloque({ ...G5, miniatura: deStorage }) as { miniatura?: string }).miniatura, deStorage);
  assert.equal(sanearBloque({ t: 'pregunta', pregunta: '¿Cuál?', opciones: [{ titulo: 'Una' }] }), null, 'una pregunta de una opción no es una pregunta');
  assert.equal(sanearBloque({ t: 'pregunta', pregunta: '¿Cuál?', opciones: [{ titulo: 'A' }, { titulo: 'a' }] }), null, 'ni dos iguales');
  assert.equal(sanearBloque({ t: 'html', html: '<script>' }), null, 'un tipo que no existe');
  assert.deepEqual(bloquesGuardados([{ k: 'adjunto', path: '3/chat/x' }, { k: 'bloque', b: G5 }, { k: 'bloque', b: { t: 'creado' } }]), [G5],
    'de lo guardado se leen sólo los bloques sanos (los adjuntos son de lib/chat-mako-bloques.ts)');
  assert.equal(proporcion({ ancho: 1080, alto: 1350 }), '1080 / 1350');
  assert.equal(proporcion({ ancho: 1080, alto: 5000 }), '9 / 16', 'una tira larguísima no ocupa toda la pantalla');
});

test('2. confirmar crear_diseno_imagen: lo creado llega al hilo sin recargar, y vuelve al recargar', async () => {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_bloques-tarjeta-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const r = JSON.parse(salida) as {
    enBlanco: ResultadoTarjeta; dePlantilla: ResultadoTarjeta; slug: string; medida: [number, number];
    disenos: string[]; red: string[];
    guardados: { session_id: number; role: string; content: string; bloques: unknown }[];
  };
  assert.deepEqual(r.red, [], 'nada sale a la red');
  assert.ok(r.enBlanco.ok && r.dePlantilla.ok, 'las dos se ejecutaron');
  if (!r.enBlanco.ok || !r.dePlantilla.ok) return;

  // Lo que vuelve a la pantalla: el G5, con la ruta al diseño que se creó.
  const [blanco] = r.enBlanco.bloques ?? [];
  assert.deepEqual(blanco, sanearBloque(blanco), 'vuelve ya saneado');
  assert.ok(blanco?.t === 'creado');
  if (blanco?.t !== 'creado') return;
  assert.equal(blanco.abrir.href, `/image-editor/${r.disenos[0]}`, 'abre ESE diseño (la ruta sola: el `?ws=` lo pone el Link)');
  assert.deepEqual([blanco.ancho, blanco.alto], [1080, 1350], 'sin plantilla, el marco tiene la forma del diseño');
  // De una plantilla de MaKo, el marco con SU forma y sin miniatura: las plantillas reales se generan por código y no
  // tienen un WebP (6/11/2026, al borrar las 10 de Doory, que eran las únicas con `/cv/plantillas/<slug>.webp`). El
  // bloque dibuja entonces «ancho × alto» (app/_chat/BloqueHilo.tsx, `Creado`), no un ícono roto.
  const [plantilla] = r.dePlantilla.bloques ?? [];
  assert.ok(plantilla?.t === 'creado', 'de una plantilla, su bloque');
  if (plantilla?.t !== 'creado') return;
  assert.equal(plantilla.miniatura, undefined, 'una plantilla real no tiene WebP: sin miniatura, va el marco');
  assert.deepEqual([plantilla.ancho, plantilla.alto], r.medida, 'el marco tiene la forma de la plantilla');

  // Sin recargar: la pantalla suma el bloque al hilo, y la pieza lo dibuja con la miniatura y el botón.
  const items = itemsTrasTarjeta(r.dePlantilla);
  const suyo = items.find((x) => x.k === 'bloque');
  assert.ok(suyo && suyo.k === 'bloque', 'el bloque entra al hilo');
  if (!suyo || suyo.k !== 'bloque') return;
  const html = await dibujar(suyo.b);
  assert.match(html, new RegExp(`${r.medida[0]} × ${r.medida[1]}`), 'sin miniatura, el marco con la medida a la vista');
  assert.doesNotMatch(html, /<img src="\/cv\/plantillas\//, 'volvió a pedir el WebP de una plantilla borrada');
  assert.match(html, new RegExp(`href="/image-editor/${r.disenos[1]}[^"]*"[^>]*>Abrir en Image Editor<`), '«Abrir en Image Editor»');

  // Guardado con el «Hecho: …»: al recargar, vuelve debajo del mensaje.
  const hecho = r.guardados.find((m) => m.role === 'assistant' && m.content.startsWith('Hecho: ') && JSON.stringify(m.bloques).includes(r.disenos[1]));
  assert.ok(hecho, 'el bloque quedó guardado con el «Hecho: …»');
  const recargado = itemsDeSesion([{ role: 'assistant', content: hecho!.content, bloques: bloquesGuardados(hecho!.bloques) }], []);
  assert.deepEqual(recargado.map((x) => x.k), ['msg', 'bloque'], 'al recargar: el mensaje y, debajo, lo creado');
});

test('3. cada tipo se dibuja', async () => {
  const g5 = await dibujar(G5);
  assert.match(g5, /data-bloque="creado"/);
  assert.match(g5, /aspect-ratio:1080 \/ 1350;--r:0\.8/, 'el marco con la forma del diseño (y su razón: el alto tope achica el ancho)');
  assert.match(g5, /<span class="ch-pildora">Nuevo<\/span>/, 'el estado');
  const sinMini = await dibujar({ ...G5, miniatura: undefined } as Bloque);
  assert.doesNotMatch(sinMini, /<img/);
  assert.match(sinMini, /1080 × 1350/, 'sin miniatura, el marco dice el tamaño');

  const g4 = await dibujar({ t: 'antes_despues', titulo: 'Promo', filas: [{ antes: 'Hasta 30%', despues: 'Hasta 50%' }], abrir: G5.t === 'creado' ? G5.abrir : undefined });
  assert.match(g4, /Original<\/span><del>Hasta 30%<\/del>/);
  assert.match(g4, /Modificado<\/span><ins>Hasta 50%<\/ins>/);

  const g6 = await dibujar({ t: 'trabajo', titulo: 'Creando la landing', pasos: [{ texto: 'Leer la oferta', estado: 'listo' }, { texto: 'Armar las secciones', estado: 'en_curso' }], listo: G5 as never });
  assert.match(g6, /role="status"/, 'se lee en voz alta cuando cambia');
  assert.match(g6, /data-estado="listo"[\s\S]*Leer la oferta[\s\S]*· Listo/);
  assert.match(g6, /data-estado="en_curso"/);
  assert.match(g6, /data-bloque="creado"/, 'y termina en un G5');

  const pregunta: Bloque = { t: 'pregunta', pregunta: '¿A qué etapa?', opciones: [{ titulo: 'Agendados', detalle: '12 leads' }, { titulo: 'Nuevos' }], recomendada: 0 };
  const quieta = await dibujar(pregunta);
  assert.equal((quieta.match(/class="ch-opcion" disabled=""/g) ?? []).length, 2, 'sin dónde contestar, las opciones no se tocan');
  assert.match(quieta, /data-recomendada="true"[^>]*>[\s\S]*?Agendados<span class="ch-pildora">Recomendada<\/span>/);
  const viva = await dibujar(pregunta, () => {});
  assert.doesNotMatch(viva, /class="ch-opcion" disabled=""/, 'con dónde contestar, sí');
  assert.match(viva, />Elige tú<\/button>[\s\S]*>Saltear<\/button>/);
});

test('4. las tres caras del hilo usan la MISMA pieza, y las pantallas suman lo que vuelve de la tarjeta', () => {
  assert.match(sinComentarios(leer('app/_chat/HiloMako.tsx')), /if \(x\.k === 'bloque'\) \{\s*const de = x\.deTarjeta;\s*filas\.push\(<DeMako key=\{x\.id\} quien=\{quien\} ancho><BloqueHilo b=\{x\.b\}/, 'la computadora');
  // El de la ficha, con el MISMO hilo desde el 22/10/2026 (CR3).
  assert.match(sinComentarios(leer('app/crm/lead-view/MakoAnalystLead.tsx')), /<HiloMako key=\{leadId\} items=\{items\} quien=\{QUIEN\}/, 'el MaKo Analyst de la ficha');
  // La pieza no trae CSS propio (así se dibuja en este test); las clases van en la hoja que carga el teléfono.
  assert.doesNotMatch(leer('app/_chat/BloqueHilo.tsx'), /import ['"][^'"]+\.css['"]/);
  assert.match(leer('app/_chat/PegadoHilo.tsx'), /import '\.\/chat\.css';/, 'el teléfono carga la hoja con PegadoHilo');
  assert.match(leer('app/_chat/chat.css'), /\.ch-creado__mini \{/);
  // Desde la 1.8 (20/10/2026) lo que vuelve de la tarjeta lo suma `conTarjeta`, que usa `itemsTrasTarjeta` (tests/chat-abrir.test.ts).
  for (const f of ['app/second-brain/useChatCliente.ts', 'app/crm/lead-view/MakoAnalystLead.tsx']) {
    const s = sinComentarios(leer(f));
    assert.match(s, /alEstado\(id, d\.estado \?\? 'pendiente', d\.frase \?\? undefined, l\.datos\);/, `${f}: lo que vuelve de la tarjeta`);
    assert.doesNotMatch(s, /paraLaPersona \?\? \[\]\)\.filter/, `${f}: sin armar los avisos a mano`);
  }
  assert.match(sinComentarios(leer('app/m/mako/SheetPropuesta.tsx')), /onEstado\(t\.pendienteId, d\.estado \?\? 'pendiente', d\.frase \?\? undefined, r\);/, 'el teléfono');
  assert.match(leer('app/m/mako/chat-ui.ts'), /return r \? \[\.\.\.sig, \.\.\.itemsTrasTarjeta\(r, pendienteId\)\] : sig;/, 'conTarjeta suma lo que vuelve');
});

test('5. G3: lo que no se deshace, en rojo pegado al botón', () => {
  const s = sinComentarios(leer('app/_chat/TarjetaAccion.tsx'));
  assert.match(s, /ch-tarjeta__consecuencia\$\{t\.deshacer === false \? ' ch-tarjeta__consecuencia--irreversible' : ''\}/);
  assert.match(leer('app/_chat/chat.css'), /\.ch-tarjeta__consecuencia--irreversible \{ color: var\(--bad\);/);
});
