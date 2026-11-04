// =============================================================================
// La lista del Ops Center del cliente, ordenada como la del super admin (22/10/2026, la captura del ws1)
// =============================================================================
// Martín: «Los chats de los clientes en el Ops Center están muy desacomodados... Deberías tener un orden como en Super Admin»
// y «todas las criaturas son el círculo... No hay randomizer». La lista de Mauricio era «Cerebro», «Sprint de Diseño para…»,
// «Mi oferta» ×2, «Chat de antes» ×3, «Presentación de M…» ×2: sin grupos, nombres que no dicen nada, repetidos, y círculos.
//   1. cada chat se llama «Origen › tema» (nunca «Chat de antes»), y dos que se llaman igual se distinguen;
//   2. se agrupan por su origen con el agrupado del super admin (`porJefe`, `GruposPorJefe`: el MISMO componente);
//   3. cada chat tiene SU criatura (el sorteo del super admin con su clave): variadas, y las mismas al recargar;
//   4. el tema sale del primer mensaje (un renglón, sin markdown, el link por su dominio).
//
// Correr: node --import tsx --test tests/ops-center-lista-cliente.test.ts
// PROBADO ROMPIÉNDOLO (base 4/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORIGEN_PREGUNTALE, TITULO_ONBOARDING, listaDelCliente, origenDeClave, temaDe } from '../lib/chat-mako-reglas';
import { partesDelNombre, porJefe } from '../lib/centro-chats';
import { ASPECTO_MAKO, aspectoDe, aspectoDeChat } from '../lib/centro-munecos';
import { TITULO_HILO } from '../lib/onboarding-arranque';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// La lista de Mauricio (ws1), medida el 22/10 en chart_sessions y offer_sesiones (los temas, los que pone el servidor).
const WS1 = {
  sesiones: [{ id: 40, titulo: 'Dame claridad de mi avatar de acuerdo a la infor…', pinned: false, updatedAt: '2026-10-18T04:13:47Z' }],
  offer: [
    { id: 18, titulo: 'Sprint de Diseño para la Ejecución Empresarial', updatedAt: '2026-10-22T05:08:37Z' },
    { id: 13, titulo: 'Mi oferta', updatedAt: '2026-10-18T22:30:00Z', tema: 'sprint.mauriciobustos.com' },
    { id: 1, titulo: 'Mi oferta', updatedAt: '2026-10-18T21:00:00Z', tema: 'quiero analisiar y definir con claridad mi avatar…' },
  ],
  antes: [
    { id: 37, titulo: null, clave: 'dashboard:ads-analyst:ad-hook', updatedAt: '2026-10-14T15:00:00Z', tema: 'Hook rate 32.4 %: solo 1 de cada 3 espectadores…' },
    { id: 36, titulo: null, clave: 'dashboard:marketing:mk-cac', updatedAt: '2026-10-14T12:00:00Z', tema: 'El CAC está a $1,098 – eso significa que cada…' },
    { id: 23, titulo: null, clave: 'mako-general', updatedAt: '2026-08-02T12:00:00Z', tema: 'Dime cuantos anuncios publique por mes desde marz…' },
    { id: 22, titulo: 'Presentación de MaKo IA', clave: 'mako-doer', updatedAt: '2026-07-10T12:00:00Z' },
    { id: 21, titulo: 'Diagnóstico de embudo: agendas sin cierres', clave: 'ad-detail-120237960510320570', updatedAt: '2026-06-29T12:00:00Z' },
    { id: 13, titulo: 'Presentación de MaKo IA', clave: 'mako-general', updatedAt: '2026-06-26T12:00:00Z' },
    { id: 19, titulo: 'Presentación de MaKo asistente', clave: 'whatsapp-secuencias', updatedAt: '2026-06-24T12:00:00Z' },
    { id: 15, titulo: 'Reducir no-show para duplicar ventas', clave: 'comercial-funnel', updatedAt: '2026-06-21T12:00:00Z' },
  ],
  busca: '',
};

test('1. cada chat dice de dónde viene y de qué se trata: nunca «Chat de antes», y los repetidos se distinguen', () => {
  const lista = listaDelCliente(WS1);
  const titulos = lista.map((f) => f.titulo);
  assert.equal(titulos[0], 'Ops Center');
  assert.ok(!titulos.some((t) => /chat de antes/i.test(t)), 'nunca «Chat de antes»');
  assert.deepEqual(titulos.slice(1), [
    'Offer › Sprint de Diseño para la Ejecución Empresarial',
    'Offer › Mi oferta · sprint.mauriciobustos.com',
    'Offer › Mi oferta · quiero analisiar y definir con claridad mi avatar…',
    'Dashboard › Hook rate 32.4 %: solo 1 de cada 3 espectadores…',
    'Dashboard › El CAC está a $1,098 – eso significa que cada…',
    'Pregúntale a MaKo › Dime cuantos anuncios publique por mes desde marz…',
    'Pregúntale a MaKo › Presentación de MaKo IA · 10 jul',
    'Ads › Diagnóstico de embudo: agendas sin cierres',
    'Pregúntale a MaKo › Presentación de MaKo IA · 26 jun',
    'Automations › Presentación de MaKo asistente',
    'Dashboard › Reducir no-show para duplicar ventas',
  ]);
  assert.equal(new Set(titulos).size, titulos.length, 'ninguno se llama igual que otro');
  assert.equal(origenDeClave('mako-general'), ORIGEN_PREGUNTALE);
  assert.equal(origenDeClave('mako-doer:u7'), ORIGEN_PREGUNTALE);
  assert.equal(origenDeClave('mako-generalx'), null);
  // Sin título ni tema: su origen solo, o su fecha. Y si ni la fecha alcanza, un número.
  const sinNada = listaDelCliente({ sesiones: [], offer: [], busca: '', antes: [
    { id: 5, titulo: null, clave: 'rara', updatedAt: '2026-10-14T12:00:00Z' },
    { id: 6, titulo: null, clave: 'rara', updatedAt: '2026-10-14T13:00:00Z' },
  ] });
  assert.deepEqual(sinNada.slice(1).map((f) => f.titulo), ['Chat del 14 oct', 'Chat del 14 oct (2)']);
  // La del onboarding es su propio origen, y se llama como en lib/onboarding-arranque.ts.
  assert.equal(TITULO_ONBOARDING, TITULO_HILO);
  assert.equal(listaDelCliente({ sesiones: [], antes: [], busca: '', offer: [{ id: 3, titulo: TITULO_HILO, updatedAt: '2026-10-20T10:00:00Z' }] })[1].titulo, 'Onboarding');
  // Buscar encuentra por el origen («offer») y por el tema.
  assert.deepEqual(listaDelCliente({ ...WS1, busca: 'sprint.maur' }).map((f) => f.clave), ['jefe', 'o13']);
});

test('2. agrupados por su origen con el agrupado del super admin: el grupo sube con el más reciente de los suyos', () => {
  const [, ...resto] = listaDelCliente(WS1);
  const grupos = porJefe(resto);
  assert.deepEqual(grupos.map((g) => g.jefe), ['Offer', 'Dashboard', 'Pregúntale a MaKo', 'Ads', 'Automations']);
  assert.deepEqual(grupos[0].subs.map((f) => partesDelNombre(f.titulo).sub), [
    'Sprint de Diseño para la Ejecución Empresarial', 'Mi oferta · sprint.mauriciobustos.com', 'Mi oferta · quiero analisiar y definir con claridad mi avatar…',
  ]);
  assert.equal(grupos[1].subs.length, 3, 'los del Dashboard juntos, aunque uno sea de junio');
  // En la pantalla: el MISMO componente que el super admin (nunca una copia), en la computadora; el mismo `porJefe` en el teléfono.
  const piezas = sinComentarios(leer('app/admin/operaciones/PiezasCentro.tsx'));
  assert.match(piezas, /export function GruposPorJefe</);
  assert.match(piezas, /<GruposPorJefe chats=\{corte\} fila=\{fila\} \/>/, 'la lista del super admin');
  const sb = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  // Con su fila JEFE cuando el grupo no tiene chat propio (22/10/2026: tests/ops-center-cliente-jefes.test.ts).
  assert.match(sb, /<GruposPorJefe chats=\{corte\} fila=\{fila\} jefe=\{/, 'la del cliente');
  assert.match(sb, /texto=\{sub \? partesDelNombre\(f\.titulo\)\.sub \?\? f\.titulo : f\.titulo\} sub=\{sub\}/);
  assert.doesNotMatch(sb, /co-jefe__nombre/, 'el grupo lo dibuja GruposPorJefe, no una copia');
  assert.match(sinComentarios(leer('app/m/second-brain/ChatClienteM.tsx')), /porJefe\(corte\)\.flatMap/);
});

test('3. cada chat con SU criatura: variadas (no todas círculos), las mismas al recargar, y el Cerebro la estrella', () => {
  const lista = listaDelCliente(WS1);
  const formas = lista.slice(1).map((f) => aspectoDeChat(f.clave).forma);
  assert.ok(new Set(formas).size >= 5, `formas variadas: ${formas.join(' ')}`);
  assert.ok(formas.filter((x) => x === 'circulo').length <= 3, 'no todas círculos');
  const offer = lista.filter((f) => f.origen === 'offer').map((f) => aspectoDeChat(f.clave).forma);
  assert.ok(new Set(offer).size > 1, `las de Offer, distintas entre sí: ${offer.join(' ')}`);
  assert.deepEqual(aspectoDeChat('o13'), aspectoDeChat('o13'), 'la misma al recargar');
  assert.notDeepEqual(aspectoDeChat('o13'), aspectoDeChat('o1'), 'dos «Mi oferta», dos criaturas');
  assert.deepEqual(aspectoDe('Cerebro', aspectoDeChat('jefe')), ASPECTO_MAKO, 'el Cerebro es la estrella aunque le pasen otra');
  const motor = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.match(motor, /aspecto: f\.clave === 'jefe' \? null : f\.guru \? aspectoDeReferente\(f\.guru\) : f\.origen === 'offer' && aspectoOffer \? aspectoOffer : aspectoDeChat\(f\.clave\)/);
  assert.match(motor, /const aspectoMuneco = quien\?\.aspecto \?\? filaAbierta\?\.aspecto \?\? null;/);
  assert.match(sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx')), /criatura=\{f\.criatura\} aspecto=\{f\.aspecto\}/);
  assert.match(sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx')), /criatura: k\.nombreMuneco, aspecto: k\.aspectoMuneco/, 'la cabecera, la misma');
  assert.match(sinComentarios(leer('app/second-brain/PiezasCliente.tsx')), /quien=\{\{ nombre: k\.nombreMuneco, aspecto: k\.aspectoMuneco \}\}/, 'el hilo, la misma');
  assert.match(sinComentarios(leer('app/m/second-brain/ChatClienteM.tsx')), /<Muneco titulo=\{f\.criatura\} aspecto=\{f\.aspecto\}/, 'el teléfono, la misma');
});

test('4. el tema sale del primer mensaje: un renglón, sin markdown, el link por su dominio, corto', () => {
  assert.equal(temaDe('**El CAC está a $1,098** – eso'), 'El CAC está a $1,098 – eso');
  assert.equal(temaDe('https://sprint.mauriciobustos.com/'), 'sprint.mauriciobustos.com');
  assert.equal(temaDe('\n\n# Hola\nsegundo'), 'Hola');
  assert.equal(temaDe('***'), '');
  assert.equal(temaDe(null), '');
  assert.ok(temaDe('x'.repeat(80)).endsWith('…') && temaDe('x'.repeat(80)).length === 49);
  // El servidor los pone: la ruta, a los de antes y las tabs; Offer, a los que se llaman igual.
  assert.match(sinComentarios(leer('app/api/mako/chat/route.ts')), /const todos = await conTemas\(\[\.\.\.deAntes, \.\.\.deTabs\]\);/);
  assert.match(sinComentarios(leer('lib/chat-mako-indice.ts')), /m\?\.de === 'yo'/);
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 4/0):
//   · la criatura sale del nombre (la familia de Offer), no de la clave     → 3/1 (3)
//   · sin distinguir los repetidos                                         → 2/2 (1, 2)
//   · la computadora sin el agrupado (la lista de antes)                    → 3/1 (2)
//   · el tema sin el link por su dominio                                    → 3/1 (4)
//   · «Pregúntale a MaKo» sin origen (vuelve «Chat de antes»)               → 2/2 (1, 2)
