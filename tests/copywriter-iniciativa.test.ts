// =============================================================================
// El Copywriter: MaKo toma la iniciativa al crear desde una plantilla (lib/copywriter/iniciativa.ts)
// =============================================================================
// Martín (29/10/2026): «automáticamente, cuando se crea un copy, MaKo le pregunta: "¿cuál es el objetivo de esto?
// ¿quieres que lo adapte?"». Fija:
//   · las preguntas van de a UNA, con botones, y se arman SIN IA (los objetivos de la plantilla, las ofertas del negocio);
//   · sólo la última respuesta pide a la IA, y «No, lo escribo yo» no pide nada;
//   · la pantalla (app/copywriter/PanelMaKo.tsx) sólo dibuja pasos: lo escrito con una pregunta abierta la contesta, y el
//     botón que llama a la IA espera a que se pueda.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NO_ADAPTAR, TOPE_OFERTAS, pasoPendiente, pasosDeIniciativa, pedidoDeIniciativa, textoDeRespuesta } from '../lib/copywriter/iniciativa';
import { plantillasDe, plantillasVisibles } from '../lib/copywriter/plantillas';
import { catalogosLite, conVsl } from '../lib/copywriter/catalogos';
import { ANGULOS_GUION_DEFAULT } from '../lib/guion-angulos';
import { ESTRUCTURAS_GUION_DEFAULT } from '../lib/guion-estructuras';
import { marcasDeVoseo } from '../lib/puestas-data';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const plantillas = plantillasDe(catalogosLite(ANGULOS_GUION_DEFAULT, conVsl(ESTRUCTURAS_GUION_DEFAULT)));
const OFERTAS = [{ id: 7, nombre: 'Mentoría 1:1' }, { id: 9, nombre: 'Curso grabado' }];

test('las preguntas: para qué es (los objetivos de la plantilla) y a qué oferta adaptarlo (las del negocio)', () => {
  const reel = plantillas.find((p) => p.id === 'reel')!;
  const [objetivo, oferta] = pasosDeIniciativa(reel, OFERTAS);
  assert.equal(objetivo.pregunta, '¿Para qué es este guion?');
  assert.ok(objetivo.libre, 'el objetivo también se puede escribir');
  assert.deepEqual(objetivo.opciones.map((o) => o.texto), [...reel.objetivos!]);
  assert.equal(oferta.pregunta, '¿Lo adapto a tu oferta? ¿A cuál?');
  assert.deepEqual(oferta.opciones.map((o) => o.texto), ['Mentoría 1:1', 'Curso grabado', 'No, lo escribo yo']);
  // Sin ofertas cargadas, pregunta por el negocio.
  assert.deepEqual(pasosDeIniciativa(reel, [])[1].opciones.map((o) => o.texto), ['Sí, adáptalo', 'No, lo escribo yo']);
  // Muchas ofertas: las primeras (la principal primero) y siempre «No, lo escribo yo».
  const muchas = Array.from({ length: 9 }, (_, i) => ({ id: i + 1, nombre: `Oferta ${i + 1}` }));
  const botones = pasosDeIniciativa(reel, muchas)[1].opciones;
  assert.equal(botones.length, TOPE_OFERTAS + 1);
  assert.equal(botones[0].texto, 'Oferta 1');
  assert.equal(botones[botones.length - 1].valor, NO_ADAPTAR);
});

test('de a una: la que sigue es la primera sin respuesta; con todas, ninguna', () => {
  const pasos = pasosDeIniciativa({ objetivos: ['Agendar llamadas'] }, OFERTAS);
  assert.equal(pasoPendiente(pasos, {})?.id, 'objetivo');
  assert.equal(pasoPendiente(pasos, { objetivo: 'Agendar llamadas' })?.id, 'oferta');
  assert.equal(pasoPendiente(pasos, { objetivo: 'Agendar llamadas', oferta: 'oferta:7' }), null);
  assert.equal(textoDeRespuesta(pasos[1], 'oferta:7'), 'Mentoría 1:1', 'en el chat se ve el nombre, no el valor');
  assert.equal(textoDeRespuesta(pasos[0], 'Vender mi taller'), 'Vender mi taller', 'lo escrito se ve como se escribió');
});

test('el pedido: sólo la última respuesta llama a la IA, con para qué es y la oferta por su nombre', () => {
  const pasos = pasosDeIniciativa({ objetivos: ['Agendar llamadas'] }, OFERTAS);
  assert.deepEqual(pedidoDeIniciativa(pasos, { objetivo: 'Agendar llamadas', oferta: 'oferta:9' }, OFERTAS),
    { adaptar: true, texto: 'Es para: Agendar llamadas. Adáptalo a mi oferta «Curso grabado».' });
  assert.deepEqual(pedidoDeIniciativa(pasos, { objetivo: 'x', oferta: NO_ADAPTAR }, OFERTAS), { adaptar: false, texto: 'No, lo escribo yo.' });
  const sinOfertas = pasosDeIniciativa({}, []);
  assert.deepEqual(pedidoDeIniciativa(sinOfertas, { objetivo: '  ', oferta: 'negocio' }, []), { adaptar: true, texto: 'Adáptalo a mi negocio.' });
  // Lo escrito en la pregunta de la oferta también se adapta («Adáptalo a: …»).
  assert.equal(pedidoDeIniciativa(pasos, { objetivo: 'Llenar una clase', oferta: 'mi taller de marzo' }, OFERTAS).texto,
    'Es para: Llenar una clase. Adáptalo a: mi taller de marzo.');
});

test('toda plantilla con ejemplo tiene sus objetivos: botones cortos, sin voseo', () => {
  for (const p of plantillasVisibles(plantillas).filter((x) => x.ejemplo)) {
    assert.ok((p.objetivos?.length ?? 0) >= 2, `${p.id}: sin objetivos para la primera pregunta`);
    for (const o of p.objetivos!) {
      assert.ok(o.length <= 28, `${p.id}: «${o}» no entra en un botón`);
      assert.deepEqual(marcasDeVoseo(o), [], `${p.id}: voseo en «${o}»`);
    }
    for (const paso of pasosDeIniciativa(p, OFERTAS)) assert.deepEqual(marcasDeVoseo(paso.pregunta), [], paso.pregunta);
  }
});

test('la pantalla: pregunta sin IA, lo escrito contesta la pregunta abierta y el botón que llama a la IA espera', () => {
  const panel = sinComentarios(leer('app/copywriter/PanelMaKo.tsx'));
  // 11/11/2026: una página que replica un outlier (D18) NO pregunta: se escribe sola (tests/copywriter-outliers.test.ts).
  assert.match(panel, /const pasosIni = useMemo\(\(\) => \(plantilla \? pasosDeIniciativa\(plantilla, ofertas\) : \[\]\), \[plantilla, ofertas\]\);/);
  // Sólo con el chat vacío, y recién con la charla leída (12/11/2026, en producción: una página vieja mostraba un instante la
  // primera pregunta antes de que llegara su charla).
  assert.match(panel, /const pasoIni = hiloLeido && mensajes\.length === 0 && id \? pasoPendiente\(pasosIni, respIni\) : null;/, 'sólo con el chat vacío y leído');
  // La última respuesta, a adaptar la plantilla.
  assert.match(panel, /if \(pedido\.adaptar\) \{ void pedirEdicion\(pedido\.texto, \[\], \[\], true, false\); return; \}/, 'la última respuesta, a adaptar');
  // El pedido que arman las respuestas no se dibuja otra vez (11/11/2026: una burbuja de más, con otro estilo, repetía lo dicho).
  assert.match(panel, /\.\.\.\(mostrar \? \{\} : \{ oculto: true \}\)/);
  assert.match(panel, /\{ id: nuevoId\(\), de: 'yo', texto: pedido\.texto, oculto: true \}/);
  assert.match(panel, /mensajes\.filter\(\(m\) => !\(m\.de === 'yo' && m\.oculto\)\)\.map/, 'no se dibuja, pero MaKo lo lee en la charla');
  assert.match(panel, /if \(pasoIni\) \{ responderIni\(t\.trim\(\)\); return Promise\.resolve\(true\); \}/, 'lo escrito contesta la pregunta');
  assert.match(panel, /disabled=\{llamaALaIA\(o\.valor\) && !puede\} onClick=\{\(\) => responderIni\(o\.valor\)\}/);
  assert.match(panel, /setRespIni\(\{\}\);/, 'otra página, otras respuestas');
  assert.match(panel, /ofertas = SIN_OFERTAS/, 'una lista vacía fija: un [] nuevo en cada render rehace los pasos');
  // Lo viejo no vuelve: el botón de la barra y el mensaje «Es un ejemplo de…».
  assert.doesNotMatch(panel, /Adaptar a mi negocio|Solo la estructura|soloLaEstructura|adaptarRef|Es un ejemplo de/);
  // Las ofertas llegan de las páginas (escritorio y teléfono), leídas en el server.
  for (const pagina of ['app/copywriter/page.tsx', 'app/copywriter/[id]/page.tsx', 'app/m/copywriter/[id]/page.tsx']) {
    assert.match(leer(pagina), /ofertasDelCopywriter\(\)/, `${pagina}: sin las ofertas`);
  }
  assert.match(leer('app/m/copywriter/GuionM.tsx'), /citarRef=\{citar\} onPendiente=\{setDecidir\} onPregunta=\{setPregunta\} ofertas=\{ofertas\} \/>/);
  // En el teléfono se ve una vista por vez: recién creada, abre en la de MaKo (si no, las preguntas quedan escondidas).
  assert.match(leer('app/m/copywriter/ListaGuionesM.tsx'), /router\.push\(`\/m\/copywriter\/\$\{r\.pagina\.id\}\$\{pl\.ejemplo \? '\?mako=1' : ''\}`\)/);
  assert.match(leer('app/m/copywriter/[id]/page.tsx'), /enMako=\{\(await searchParams\)\.mako !== undefined\}/);
  assert.match(leer('app/m/copywriter/GuionM.tsx'), /useState<Vista>\(enMako \? 'mako' : 'guion'\)/);
  assert.match(leer('app/copywriter/Copywriter.tsx'), /citarRef=\{citar\} volver=\{volver\} ofertas=\{ofertas\} \/>/);
  assert.match(leer('lib/copywriter/catalogos-server.ts'), /listarOfertas\(true\)\)\.map\(\(o\) => \(\{ id: o\.id, nombre: o\.nombre \}\)\)/);
});

// ── Probado ROMPIÉNDOLO (29/10/2026) ──────────────────────────────────────────
// Sanos: iniciativa 5/0, plantillas 16/0, ia 6/0. Rota, una por vez y restaurando (cada una hace fallar 1 test):
//   · «No, lo escribo yo» llama a la IA              · el esqueleto sin guías
//   · una guía con la etiqueta mal escrita            · la página nace con el ejemplo
//   · la tarjeta sin el extracto                      · una insignia de más de 18 caracteres
//   · todos los botones esperan a la IA               · `ofertas = []` en las props
//   · la IA de «adaptar» sin el ejemplo               · el teléfono abre en la página y no en MaKo
//   · un objetivo con voseo («Si tenés un taller»; «Escribime…» NO lo ve marcasDeVoseo: docs/hallazgos-ia.md)
