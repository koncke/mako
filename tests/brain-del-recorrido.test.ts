// =============================================================================
// EL SECOND BRAIN DEL RECORRIDO: la animación de la maqueta, en la app (21/11/2026, el Cerebro con la lista de Martín)
// =============================================================================
// «La animación de Second Brain al entrar… Búscala en C:/dev/artefactos-onboarding (cuerpo.html y onboarding.html: la animación del
// Second Brain del recorrido) y cópiala en la app, en el paso del recorrido que abre Second Brain.»
//
// En la maqueta (`brainHtml`, `programarBrain`, `medirBrain` y las reglas `.mq-brain`/`.mq-g-*` de cuerpo.html): se abre el Second
// Brain de la portada, entero (app/vsl/_sitio/cerebro-ejemplo.json, siempre negro); a los 1,2 s los nodos se APAGAN DE A POCO, de los
// de afuera hacia adentro; quedan la raíz y unos pocos de las áreas, que se acomodan en un círculo alrededor del negocio y pasan a
// decir lo que MaKo sabe de la persona (su nombre, su WhatsApp confirmado, cómo llegó, lo que quiere resolver); la cámara se acerca.
//
// En la app es una capa sobre el grafo de verdad (`.cbg-marco`, la marca «Lo que MaKo sabe de ti» del recorrido), por debajo de su
// barra (la flecha de volver es el paso que sigue y se toca), y sólo mientras corre el recorrido: terminado u omitido, el grafo real.
// Lo que sabe sale del onboarding del negocio (`onboarding.arranque`), nunca inventado: lo que falta no se pone.
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { armarBrain, compactarCerebro, hechosDe, loQueSabeDelArranque, DEMORA_FASE_MS, type CerebroCorto, type LoQueSabe } from '../lib/onboarding-v2/brain-del-recorrido';
import { SvgDelRecorrido } from '../app/second-brain/BrainDelRecorrido';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const json = (r: string) => JSON.parse(fuente(r));

const CORTO = json('app/second-brain/brain-del-recorrido.json') as CerebroCorto;
const VALE: LoQueSabe = { nombre: 'Valentina', negocio: 'Nutri Vale', whatsapp: true, origen: 'Instagram', intereses: ['Que WhatsApp e Instagram respondan solos', 'Armar mi landing'] };

test('1. es el Second Brain de la PORTADA (cerebro-ejemplo.json), en corto, y no se aparta', () => {
  assert.deepEqual(CORTO, compactarCerebro(json('app/vsl/_sitio/cerebro-ejemplo.json')), 'el JSON corto se rearma con compactarCerebro');
  assert.ok(CORTO.nodos.length >= 150, 'entero: los ~200 nodos de la portada');
  assert.ok(CORTO.nodos.filter((x) => x[7]).length >= 7, 'áreas para todo lo que MaKo sabe (hasta 6 cosas)');
});

test('2. se apaga de AFUERA hacia ADENTRO; quedan la raíz y uno por cosa que sabe, en un círculo parejo alrededor del negocio', () => {
  const b = armarBrain(CORTO, VALE, { angosta: false });
  const { cx, cy, RT } = b;
  assert.equal(RT, Math.round(CORTO.encuadre.lado * 0.2));
  const seApagan = b.nodos.filter((n) => !n.queda);
  const dist = (n: { x: number; y: number }) => Math.hypot(n.x - cx, n.y - cy);
  const porDist = [...seApagan].sort((a, z) => dist(z) - dist(a));
  assert.equal(porDist[0].demora, 0, 'el de más afuera se apaga primero');
  assert.equal(porDist[porDist.length - 1].demora, 1.6, 'el de más adentro, último');
  for (let i = 1; i < porDist.length; i++) assert.ok((porDist[i].demora ?? 0) >= (porDist[i - 1].demora ?? 0) - 1e-9, 'de afuera hacia adentro, sin saltos');
  const quedan = b.nodos.filter((n) => n.queda && !n.esRaiz);
  assert.equal(quedan.length, hechosDe(VALE).length, 'uno por cosa que sabe');
  assert.ok(quedan.every((n) => CORTO.nodos.find((x) => x[0] === n.id)?.[7] === 1), 'los que quedan son áreas');
  // En el círculo de radio RT, repartidos parejo y empezando arriba con «Tú».
  const angulos = quedan.map((n) => {
    assert.ok(Math.abs(Math.hypot((n.tx ?? 0) - cx, (n.ty ?? 0) - cy) - RT) < 0.2, `«${n.k}» en el círculo`);
    return (Math.atan2((n.ty ?? 0) - cy, (n.tx ?? 0) - cx) + 2.5 * Math.PI) % (2 * Math.PI);
  }).sort((a, z) => a - z);
  angulos.forEach((a, i) => assert.ok(Math.abs(a - (i * 2 * Math.PI) / quedan.length) < 1e-3, `el ${i} a su ángulo, parejo`));
  const tu = quedan.find((n) => n.k === 'Tú');
  assert.ok(tu && Math.abs((tu.tx ?? 0) - cx) < 0.2 && (tu.ty ?? 0) < cy, '«Tú» arriba del negocio');
  assert.equal(b.lineas.length, quedan.length, 'una línea nueva del negocio a cada cosa');
  assert.equal(b.nodos.filter((n) => n.esRaiz).length, 1);
});

test('3. lo que sabe: su nombre, su WhatsApp confirmado, cómo llegó y lo que quiere; lo que falta NO se inventa', () => {
  assert.deepEqual(hechosDe(VALE).map((h) => [h.k, h.v]), [['Tú', 'Valentina'], ['Tu WhatsApp', 'Confirmado'], ['Llegaste por', 'Instagram'], ['Quieres', 'Que WhatsApp e Instagram respondan solos'], ['Quieres', 'Armar mi landing']]);
  assert.deepEqual(hechosDe({ nombre: 'Andrés', negocio: '', whatsapp: false, origen: '', intereses: [] }).map((h) => h.k), ['Tú'], 'sin WhatsApp confirmado ni origen: no van, ni con «…»');
  assert.equal(hechosDe({ ...VALE, intereses: ['a', 'b', 'c', 'd'] }).filter((h) => h.k === 'Quieres').length, 3, 'hasta 3, como el onboarding');
  const crudo = JSON.stringify({ nombre: 'Valentina Pérez', negocio: 'Nutri Vale', telefono: 'verificado', origen: 'Instagram', intereses: ['Armar mi landing'] });
  assert.deepEqual(loQueSabeDelArranque(crudo, ''), { nombre: 'Valentina', negocio: 'Nutri Vale', whatsapp: true, origen: 'Instagram', intereses: ['Armar mi landing'] });
  assert.equal(loQueSabeDelArranque(JSON.stringify({ telefono: 'pendiente' }), 'Lala').whatsapp, false, 'sin verificar no dice «Confirmado»');
  assert.equal(loQueSabeDelArranque('no es json', 'Lala').nombre, 'Lala', 'roto: el nombre de la página, nada más');
  assert.equal(loQueSabeDelArranque(null, '').negocio, '');
});

test('4. el dibujo: los nodos que se apagan con su demora, lo que sabe escrito, el negocio en la raíz, la cámara y siempre en negro', () => {
  const html = renderToStaticMarkup(createElement(SvgDelRecorrido, { brain: armarBrain(CORTO, VALE, { angosta: false }) }));
  for (const t of ['Valentina', 'Confirmado', 'Instagram', 'Armar mi landing', 'Nutri Vale', 'Tu WhatsApp', 'Llegaste por']) assert.ok(html.includes(t), `dice «${t}»`);
  assert.equal((html.match(/class="sbr-n[ "]/g) || []).length, CORTO.nodos.length, 'el cerebro entero, nodo por nodo');
  assert.match(html, /class="sbr-n sbr-queda sbr-raiz"/);
  assert.match(html, /transition-delay:0s/, 'el de más afuera, sin demora');
  assert.match(html, /transition-delay:1\.6s/, 'el de más adentro, al final');
  assert.match(html, /--tx:-?\d/, 'los que quedan van a su lugar del círculo');
  assert.match(html, /viewBox="-?\d[^"]*"/);
  const comp = sinComentarios(fuente('app/second-brain/BrainDelRecorrido.tsx'));
  assert.match(comp, /data-tema="oscuro"/, 'siempre negro, como la portada');
  assert.match(comp, /\[data-fase="tuyo"\] \.sbr-n:not\(\.sbr-queda\)[^{]*\{[^}]*opacity:\s*0/, 'en la fase «tuyo» se apagan los que no quedan');
  assert.match(comp, /\.sbr-todo\s*\{[^}]*transition:\s*transform 1\.1s[^}]*1\.9s/, 'la cámara se acerca después de apagarlos');
  assert.match(comp, /\.sbr-tuyo\s*\{[^}]*opacity:\s*0[^}]*2\.7s/, 'lo que sabe aparece al final');
  assert.match(comp, /prefers-reduced-motion:\s*reduce/, 'sin animación para quien la pide');
});

test('5. en la app: sobre el grafo de verdad, debajo de su barra, la primera vez, sólo mientras corre el recorrido', () => {
  const comp = sinComentarios(fuente('app/second-brain/BrainDelRecorrido.tsx'));
  assert.match(comp, /senal\?\.tipo === 'tutorial' && senal\.tutorial === TUTORIAL_RECORRIDO/, 'sólo con el recorrido corriendo');
  assert.match(comp, /querySelector\('\.cbg-marco'\)/, 'adentro del marco del grafo (la marca «Lo que MaKo sabe de ti»)');
  assert.match(comp, /createPortal\(/);
  const z = /\.sbr\s*\{[^}]*z-index:\s*(\d+)/.exec(comp);
  assert.ok(z && Number(z[1]) < 3, 'por DEBAJO de la barra del grafo (z-index 3): la flecha de volver es el paso que sigue');
  assert.match(comp, /setTimeout\(\(\) => setFase\('tuyo'\), DEMORA_FASE_MS\)/, 'empieza a apagarse');
  // 21/11 (producción): arranca DIRECTO, sin el cuadro quieto de 1,2 s («primero aparece un Second Brain chiquito»).
  assert.ok(DEMORA_FASE_MS <= 100, `arranca directo (${DEMORA_FASE_MS} ms)`);
  // Y se repite al volver al paso del grafo («Atrás» o «Ir a un paso»).
  assert.match(comp, /if \(enElGrafo && !estabaEnElGrafo\.current\) \{ setFase\('todo'\); setVuelta\(\(n\) => n \+ 1\); \}/);
  assert.match(comp, /\}, \[puesta, vuelta\]\);/);
  assert.match(comp, /new ResizeObserver\(/, 'la cámara se mide con el lienzo');
  const chat = sinComentarios(fuente('app/second-brain/ChatSecondBrain.tsx'));
  assert.match(chat, /verMapa \? \([\s\S]{0,900}\{mapa && retoV2 && loQueSabe && <BrainDelRecorrido sabe=\{loQueSabe\} \/>\}/, 'en la vista del grafo, sólo con el V2');
  const pag = sinComentarios(fuente('app/second-brain/page.tsx'));
  assert.match(pag, /const loQueSabe = retoV2 \? await loQueSabeMaKo\(nombrePersona\)/, 'lo que sabe, del onboarding del negocio y sólo con el V2');
  assert.match(pag, /loQueSabe=\{loQueSabe\}/);
  assert.match(sinComentarios(fuente('app/second-brain/pagina.tsx')), /loQueSabe=\{loQueSabe\}/);
  assert.match(sinComentarios(fuente('lib/reto/nombre.ts')), /export async function loQueSabeMaKo\([\s\S]{0,300}loQueSabeDelArranque\(await getSetting\(CLAVE_ARRANQUE\)/);
});

// ─────────────────────────────────────────────────────────────────────────────
// PROBADO ROMPIÉNDOLO (21/11/2026), de a una rotura, y cada una cae:
//   · la demora al revés (de adentro hacia afuera)                    → 2
//   · «Llegaste por» con «…» cuando no hay origen                      → 3
//   · el JSON corto sacado de otro lado (un nodo movido)                → 1
//   · la capa sin atarse al recorrido (siempre)                         → 5
//   · la capa por ENCIMA de la barra (z-index 4)                         → 5
//   · ChatSecondBrain sin la capa                                         → 5
// ─────────────────────────────────────────────────────────────────────────────
