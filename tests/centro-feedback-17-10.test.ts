// =============================================================================
// El feedback de Martín del 17/10/2026 (A–I) en las pantallas del Ops Center: lo que se ve, fijado en el código
// =============================================================================
// Martín miró el Ops Center en producción y pidió, entre otras cosas (docs/relevo/centro-operaciones.md, «EL FEEDBACK DE
// MARTÍN DEL 17/10»): fuera los tres puntos de arriba de cada chat (H), y que «Second Brain» abra sólo el grafo, sin cambiar de chat, sin la
// entrada «Mapa» (I). Cada punto va en la computadora Y en el teléfono.
// Lo que tiene reglas puras va en su propio test (centro-preguntas-chat, centro-envio, centro-renombre, centro-jefes);
// acá queda lo que sólo se ve en el componente.
//
// Probado rompiéndolo (17/10/2026, con la base en 0 fallos):
//   · H: devolviendo el botón `co-cab__mas` a Conversacion.tsx → 1 fallo; el «⋯» del teléfono → 1 fallo (el mismo test).
//   · I: el botón «Second Brain» cambiando de lista otra vez (`enSB ? irAClaudeCode() : …`) → 1 fallo; «Mapa» sin `listaSB`
//     → 1 fallo; el grafo sin el chat abierto en su link (`&centro=`) → 1 fallo (el mismo test).
//   · B: el chip «Sólo esto» de vuelta en la caja → 1 fallo; el teléfono sin `MasCaja` → 1 fallo; la burbuja sin
//     `TextoMio` (el texto crudo) → 1 fallo; `limpiarBorrador` antes de saber si salió → 1 fallo; el cartero diciendo
//     «— Alcance: Sólo esto.» → 1 fallo; la miniatura con el nombre del archivo → 1 fallo.
//   · A en la pantalla: la recomendada en el segundo lugar → 1 fallo; contestada sin «Respondiste» → 1 fallo.
//   · D: el teléfono sin «Tareas vinculadas» en el «+» → 1 fallo (el de la B).
//   · F: el sorteo por nombre con las 9 piezas (sin `DE_SIEMPRE`) → 1 fallo; un «Su muñeco» de vuelta en el teléfono →
//     1 fallo; el retrato sin su paseo → 1 fallo; el «Diamante» o la cara «Gato» cayendo al dibujo de siempre → 1 fallo
//     cada uno (todos en el mismo test).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Hilo } from '../app/admin/operaciones/Hilo';
import type { LineaChat } from '../lib/centro-chats';
import type { PreguntaChat } from '../lib/centro-preguntas-chat';
import { CARAS, COLORES, FORMAS, aspectoDe } from '../lib/centro-munecos';
import { Boca, Cuerpo, Muneco } from '../app/admin/operaciones/Muneco';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');
/** El código sin comentarios: un «⋯» que se nombra para decir que se fue no cuenta. */
const codigo = (r: string) => leer(r).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('H: sin los tres puntos arriba de cada chat; en el teléfono, el muñeco abre Renombrar y el muñeco', () => {
  assert.doesNotMatch(codigo('app/admin/operaciones/Conversacion.tsx'), /co-cab__mas|name="mas"/, 'la computadora');
  const movil = codigo('app/m/operaciones/ChatsMovil.tsx');
  assert.doesNotMatch(movil, /m-operaciones-mas/, 'el teléfono');
  assert.match(movil, /className="m-operaciones-muneco" onClick=\{\(\) => setOpciones\(true\)\}/, 'Renombrar sigue a mano en el teléfono');
});

test('I: «Second Brain» abre sólo el grafo y no cambia de chat ni de lista; «Mapa» no está en el Ops Center', () => {
  const sb = codigo('app/second-brain/ChatSecondBrain.tsx');
  assert.match(sb, /aria-pressed=\{mapa != null && !ticketera\} onClick=\{irAlSecondBrain\}/, 'el botón abre el grafo, nada más');
  assert.doesNotMatch(sb, /irAClaudeCode/, 'ya no alterna la lista');
  assert.match(sb, /const listaSB = !ops;/, 'en Ops Center la lista es siempre la de Claude Code');
  assert.match(sb, /\{veMapa && listaSB && \(/, '«Mapa» sólo fuera del Ops Center');
  assert.match(sb, /const hrefMapa = `\$\{base\}\?panel=mapa\$\{idElegido \? `&chat=\$\{idElegido\}` : urlCentro \? `&centro=/, 'el grafo se abre con el chat abierto anotado: vuelve a él');
  const movil = codigo('app/m/operaciones/CentroAppMovil.tsx');
  assert.match(movil, /titulo="Second Brain" href="\/m\/second-brain\?panel=mapa"/, 'el teléfono abre el grafo');
  assert.doesNotMatch(movil, /titulo="Mapa"/);
});

const S1 = 'local_11111111-1111-4111-8111-111111111111';
const AHORA = Date.parse('2026-10-17T13:00:00Z');
const dibujar = (lineas: LineaChat[]) => renderToStaticMarkup(createElement(Hilo, {
  lineas, pushes: [], ahora: AHORA, vacio: '', quien: { titulo: 'CRM', animo: 'despierto' }, onResponder: async () => null,
}));

test('B: la caja con un solo «+», sin «Sólo esto», con listas en vivo, en la computadora y el teléfono', () => {
  for (const f of ['app/admin/operaciones/Conversacion.tsx', 'app/m/operaciones/ChatsMovil.tsx', 'app/admin/operaciones/useCentro.ts']) {
    const src = codigo(f);
    assert.doesNotMatch(src, /Sólo esto|de_ahora_en_mas|setAlcance/, `${f}: «Sólo esto» se fue`);
  }
  for (const f of ['app/admin/operaciones/Conversacion.tsx', 'app/m/operaciones/ChatsMovil.tsx']) {
    const src = codigo(f);
    assert.match(src, /<MasCaja\b/, `${f}: el «+» de la caja`);
    assert.match(src, /conVinetas\(/, `${f}: las viñetas en vivo`);
    assert.match(src, /enterEnLista\(/, `${f}: Enter sigue la lista`);
  }
  assert.match(codigo('app/m/operaciones/ChatsMovil.tsx'), /<MasCaja[^>]*>[\s\S]{0,80}<SelectoresDeEnvio\b/, 'la cuenta, el modelo y el esfuerzo, adentro del «+»');
  // D: «Tareas vinculadas (N)» también va adentro del «+», y tocar una lleva a su mensaje (cerrando el menú).
  for (const f of ['app/admin/operaciones/Conversacion.tsx', 'app/m/operaciones/ChatsMovil.tsx']) {
    assert.match(codigo(f), /<MasCaja[^>]*>[\s\S]{0,200}<TareasVinculadas tareas=\{[^}]+\} onIr=\{\(u\) => \{ cerrar\(\);[^\n]*irAlTurno\(u\)[^\n]*\/>/, `${f}: las tareas del chat en el «+»`);
  }
  const adj = codigo('app/admin/operaciones/AdjuntosCaja.tsx');
  assert.doesNotMatch(adj, /ch-elegido__nombre|>\{x\.file\.name\}</, 'la miniatura va sin el nombre, como Claude');
  // El visor vive aparte desde el 17/10 (Visor.tsx: también lo usa la burbuja enviada, y el «atrás» lo cierra a él solo).
  assert.match(adj, /<Visor /, 'la miniatura se amplía en el visor');
  assert.match(codigo('app/admin/operaciones/Visor.tsx'), /co-ver__pdf/, 'un PDF también se amplía antes de mandar');
});

test('B: el borrador se borra sólo cuando el mensaje SALIÓ, y lo que sale es Markdown', () => {
  const src = codigo('app/admin/operaciones/useCentro.ts');
  const cuerpo = src.slice(src.indexOf('async function mandar('), src.indexOf('async function mandar(') + 2500);
  const fallo = cuerpo.indexOf("if (!r.ok) { avisar(r.error, 'bad'); return; }");
  const limpia = cuerpo.indexOf('limpiarBorrador(c.clave)');
  assert.ok(fallo > 0 && limpia > fallo, 'se limpia después de saber que salió');
  // Desde el 17/10 con la cita arriba si responde a un mensaje (lo de WhatsApp: lib/centro-mensajes.ts → armarConCita).
  assert.match(cuerpo, /const texto = armarConCita\(citas\[c\.clave\] \?\? null, textoParaMandar\(borradorDe\(c\.clave\)\)\)/);
  // El teléfono manda por el MISMO motor desde el 17/10 (sin un segundo `mandar`): limpia igual, después de saber que salió.
  assert.match(codigo('app/m/operaciones/ChatsMovil.tsx'), /const mandar = \(\) => \{ if \(elegido\) void centro\.mandar\(elegido\); \};/, 'el teléfono también');
});

test('B: lo que escribió Martín se ve con sus listas', () => {
  const html = dibujar([{ tipo: 'trabajo', instante: AHORA - 60_000, trabajo: {
    id: 't1', destino: S1, destino_titulo: 'CRM', destino_cuenta: 'claude1', created_at: new Date(AHORA - 60_000).toISOString(),
    texto: ['Hacé esto:', '- uno', '- dos'].join('\n'), estado: 'entregado', motivo: null, cierre: null,
  } }]);
  assert.match(html, /<ul class="co-burbuja__lista"><li>uno<\/li><li>dos<\/li><\/ul>/);
});

test('B: el mensaje que recibe el chat ya no dice «Sólo esto»', async () => {
  const { mensaje } = await import('../scripts/operaciones/cartero.mjs');
  const p = { id: 'aaaaaaaa-1111-4222-8333-444444444444', texto: 'Hola', creado: '2026-10-17T12:00:00Z' };
  const solo = mensaje({ ...p, alcance: 'solo_esto' });
  assert.doesNotMatch(solo, /Alcance|Sólo esto/);
  assert.match(solo, /Si de esto sale una regla/, 'el chat decide solo si deja una regla');
  assert.match(mensaje({ ...p, alcance: 'de_ahora_en_mas' }), /Y DE AHORA EN MÁS/, 'lo firmado antes con «de ahora en más» lo sigue diciendo');
});

test('A en la pantalla: el formulario con la recomendada primero, y contestada con lo elegido', () => {
  const p: PreguntaChat = {
    id: 'aaaaaaaa-1111-4222-8333-444444444444', local: S1, pregunta: '¿Abro la ventana?', contexto: null,
    opciones: [{ titulo: 'No, después', detalle: null }, { titulo: 'Sí, ábrela', detalle: 'Ahora' }], recomendada: 1, varias: false,
    at: new Date(AHORA - 60_000).toISOString(), respuesta: null,
  };
  const abierta = dibujar([{ tipo: 'pregunta', instante: AHORA - 60_000, pregunta: p, trabajo: null }]);
  assert.ok(abierta.indexOf('Sí, ábrela') < abierta.indexOf('No, después'), 'la recomendada primero');
  assert.match(abierta, /\(Recomendada\)/);
  assert.match(abierta, /placeholder="Escribe otra cosa"/);
  const contestada = dibujar([{ tipo: 'pregunta', instante: AHORA - 60_000, pregunta: { ...p, respuesta: { elegidas: [1], otra: null, at: new Date(AHORA).toISOString(), trabajo: 'bbbbbbbb-1111-4222-8333-444444444444' } }, trabajo: null }]);
  assert.match(contestada, /Respondiste · 10:00/);
  assert.match(contestada, /data-elegida="true"[^>]*>[\s\S]*?Sí, ábrela/);
  assert.doesNotMatch(contestada, /Escribe otra cosa/, 'contestada no se vuelve a contestar');
});

test('F: la Criatura, con 9 cuerpos, 9 colores y 9 caras, que pasea en su recuadro; ningún chat cambia de cara solo', () => {
  assert.deepEqual([FORMAS.length, COLORES.length, CARAS.length], [9, 9, 9]);
  // Cada pieza se dibuja distinta (un cuerpo o una boca que cae al «default» se vería igual que otra).
  const dibujo = (a: Parameters<typeof Muneco>[0]['aspecto']) => renderToStaticMarkup(createElement(Muneco, { titulo: 'x', animo: 'despierto', aspecto: a }));
  const base = { forma: FORMAS[0], color: COLORES[0], cara: CARAS[0] } as const;
  assert.ok(dibujo(base).includes('<svg'), 'la criatura entera se dibuja');
  // Sólo la pieza, sin el brillo ni los ojos (que cambian de lugar con el cuerpo y esconderían un cuerpo repetido).
  const pieza = (hijo: ReturnType<typeof createElement>) => renderToStaticMarkup(createElement('svg', null, hijo));
  assert.equal(new Set(FORMAS.map((forma) => pieza(createElement(Cuerpo, { forma, color: COLORES[0] })))).size, FORMAS.length, 'nueve cuerpos distintos');
  assert.equal(new Set(CARAS.map((cara) => pieza(createElement(Boca, { cara, y: 20 })))).size, CARAS.length, 'nueve caras distintas');
  // El que no se eligió sale de su nombre con las piezas de antes: las nuevas son sólo para elegir.
  // `Forma` también admite la estrella del Cerebro (FORMA_MAKO), que no está en FORMAS: se busca como texto.
  const formas: readonly string[] = FORMAS;
  for (let i = 0; i < 300; i++) {
    const a = aspectoDe(`Chat de prueba ${i}`);
    assert.ok(formas.indexOf(a.forma) < 7 && CARAS.indexOf(a.cara) < 6, `«Chat de prueba ${i}» no cambió de cara`);
  }
  for (const f of ['app/admin/operaciones/PiezasCentro.tsx', 'app/m/operaciones/ChatsMovil.tsx', 'app/admin/operaciones/Conversacion.tsx', 'app/admin/operaciones/ElegirMuneco.tsx']) {
    assert.doesNotMatch(codigo(f), /['"`>][^'"`<]*\b[Mm]uñeco\b/, `${f}: se llama «Criatura»`);
  }
  const css = leer('app/admin/operaciones/centro.css');
  assert.match(css, /\.co-elegir__retrato \.mun \{ animation: mun-pasea/, 'pasea en su recuadro');
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.co-elegir__retrato \.mun \{ animation: none/, 'y se queda quieta si se pidió menos movimiento');
});
