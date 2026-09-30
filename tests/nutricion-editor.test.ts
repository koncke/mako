// =============================================================================
// Las nutriciones: POCAS por defecto, y editables como las etapas
// =============================================================================
// Pedido de Martín (30/09/2026), textual: «El editor de "Nutrición" debe ser parecido al
// de Etapas, solo que hay que agregarle de que depende que se dispare esa nutrición… Por
// ejemplo, la nutrición de "No show" tiene obligatoriamente que el lead venga de "Agenda
// R1"… Pero debe ser dinámico, si yo cambio el nombre, si pongo R1, R2, etc… Las
// nutriciones deben respetar eso. Y faltan muchas cosas en esa vista, no hay opción de
// agregar, de eliminar, etc… Pon por defecto muy pocas nutriciones. Pon la de "No Agenda"
// - "No Show" - "Reactivación", ya si el usuario quiere puede crear más».
//
// ⚠️ LO QUE MÁS CUESTA VER ACÁ: la lista NO es una tabla. Las nutriciones se DERIVAN del
// pipeline en cada lectura (`generateFunnel`), y lo único que se guarda es `suppressed`
// —las que están APAGADAS—. O sea que «agregar» es dejar de suprimir y «quitar» es
// suprimir: no hay fila que crear ni que borrar, y por eso el editor no se parece a un
// ABM aunque se vea como uno.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_PIPELINE, ETAPAS_SIN_SECUENCIA, NUTRICIONES_POR_DEFECTO,
  generateFunnel, suppressedInicial, type Stage,
} from '../lib/pipeline';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');
const etapas = () => DEFAULT_PIPELINE as unknown as Stage[];
const destinos = (pipeline: Stage[], sup: string[]) =>
  [...new Set(generateFunnel(pipeline, sup, {}).transitions.filter((t) => t.category === 'nutricion').map((t) => t.to))];

test('⚠️ un producto de UNA reunión nace con exactamente las TRES que pidió Martín', () => {
  // Medido el 30/09/2026 sobre la plantilla de una reunión: No Agenda (`nutri`), No Show
  // (`noshow_r1`) y Reactivación. Con dos reuniones son cuatro, y está bien: hay dos
  // reuniones a las que faltar, y la fila dice de cuál.
  const unaReunion = etapas().filter((s) => s.key !== 'agendaj2');
  assert.deepEqual(destinos(unaReunion, suppressedInicial(unaReunion)), ['nutri', 'noshow_r1', 'reactivacion']);

  // Lo que se APAGA al crear no es una lista escrita a mano: sale del pipeline. Con la
  // plantilla de dos reuniones son estas tres, y las tres son ruido conceptual — una
  // nutrición de una nutrición entre ellas.
  assert.deepEqual(suppressedInicial(etapas()).sort(),
    ['agendaj2>nocompro', 'facturando>nopaga', 'nopaga>reunion_excepcional']);
  assert.deepEqual(destinos(etapas(), suppressedInicial(etapas())),
    ['nutri', 'noshow_r1', 'noshow_r2', 'reactivacion']);
});

test('⚠️ `noshow_r3` pasa por `nut()`: la casilla de Reunión excepcional se queda apagada', () => {
  // Estaba escrita a mano —un `transitions.push` suelto— así que IGNORABA `suppressed`:
  // se destildaba, se guardaba, y al reabrir el pop-up volvía tildada sola. Un control que
  // se desmarca solo se lee como que la app no guarda.
  const sinReunion = etapas().filter((s) => s.kind !== 'reunion');
  assert.ok(destinos(sinReunion, []).includes('noshow_r3'), 'el fixture ya no produce la de Reunión excepcional');
  assert.ok(!destinos(sinReunion, ['reunion_excepcional>noshow_r3']).includes('noshow_r3'),
    'apagarla no la apaga: volvió el push a mano que ignora `suppressed`');
});

test('⚠️ Reactivación existe SIEMPRE; lo que necesita una reunión es su vuelta', () => {
  // Estaba entera detrás de `firstMeeting`, así que un embudo sin reuniones —el de un
  // ecommerce— no tenía ninguna forma de reactivar a nadie. Lo que de verdad necesita la
  // reunión es la arista de VUELTA: sin reuniones no hay nada que «reagendar», y eso lo
  // fija aparte `tests/reunion-slot-fuente-unica.test.ts`.
  const sinReunion = etapas().filter((s) => s.kind !== 'reunion');
  assert.ok(destinos(sinReunion, []).includes('reactivacion'), 'sin reuniones no hay Reactivación');
  const vuelta = generateFunnel(sinReunion, [], {}).transitions.filter((t) => t.from === 'reactivacion' && t.label === 'Reagenda');
  assert.equal(vuelta.length, 0, 'sin reuniones hay una «Reagenda» que no puede agendar nada');
  assert.ok(generateFunnel(etapas(), [], {}).transitions.some((t) => t.from === 'reactivacion' && t.label === 'Reagenda'),
    'con reuniones se fue la vuelta de Reactivación');
});

test('⚠️ `ETAPAS_SIN_SECUENCIA` vive donde el NAVEGADOR la puede leer', () => {
  // Vivía en `lib/secuencias-huecos.ts`, que tiene `server-only`: importarla desde una
  // server action del CRM arrastraba el módulo entero. La decisión de que esas dos no se
  // nutren ya estaba tomada; lo que faltaba era que la pantalla pudiera verla — sin eso,
  // la lista traía una fila que decía, literal, «No Paga → Reunión excepcional».
  const pl = leer('lib/pipeline.ts');
  const sh = leer('lib/secuencias-huecos.ts');
  assert.ok(!/^import 'server-only'/m.test(pl), '`lib/pipeline.ts` se volvió sólo del server');
  assert.match(sh, /import \{ ETAPAS_SIN_SECUENCIA \} from '\.\/pipeline'/, 'volvió la segunda copia de la lista');
  assert.deepEqual([...ETAPAS_SIN_SECUENCIA].sort(), ['manual', 'reunion_excepcional']);
  // Y la pantalla la usa para NO ofrecer una nutrición que salga de otra nutrición.
  assert.match(leer('app/crm/actions.ts'), /ETAPAS_SIN_SECUENCIA\.includes\(t\.to\)/,
    'la lista del pop-up volvió a ofrecer una nutrición de una nutrición');
});

test('⚠️ una nutrición es UNA fila aunque salga de dos etapas, y apagarla las apaga TODAS', () => {
  // «Reactivación» sale de «No responde» Y de «Perdido»: eran dos casillas con el mismo
  // nombre, y destildar una dejaba la nutrición corriendo con la pantalla diciendo dos
  // veces lo mismo.
  const ac = leer('app/crm/actions.ts');
  assert.match(ac, /const porDestino = new Map/, 'la lista volvió a ser una fila por ARISTA');
  assert.match(ac, /ids: ts\.map\(\(t\) => `\$\{t\.from\}>\$\{t\.to\}`\)/, 'la fila dejó de llevar todos sus ids');
  assert.match(ac, /activa: ts\.some\(\(t\) => !sup\.has/, 'con un id encendido la fila tiene que decir que corre');
  // Y el toggle los escribe todos: `tambien` es lo que lleva los ids hermanos al server.
  assert.match(ac, /tambien\?: string\[\]/, 'la op de nutrición dejó de aceptar los ids hermanos');
  assert.match(leer('app/crm/EtapasModal.tsx'), /op: 'nutricion', id: n\.id, tambien: n\.ids/,
    'el pop-up volvió a apagar una sola arista');
});

test('⚠️ el nombre de la etapa sale de `cfg.stages` PRIMERO, o la lista muestra `st0`', () => {
  // Éste es el bug que Martín reportó mirando un cliente real: sin esa fuente se caía a
  // `cfg.labels` —que sólo tiene las terminales renombradas— y de ahí al catálogo de
  // fábrica, que no conoce las claves de un pipeline propio. El ws13 veía «st0» y «st1».
  // Es lo que hace que «si yo cambio el nombre, si pongo R1, R2…» se cumpla solo.
  const ac = leer('app/crm/actions.ts');
  assert.match(ac, /const deStages = new Map\(cfg\.stages\.map\(\(st\) => \[st\.key, st\.label\]\)\)/,
    'se fue la fuente que conoce las etapas de ESTE embudo');
  assert.match(ac, /deStages\.get\(k\) \?\? cfg\.labels\[k\]/, '`cfg.stages` dejó de ir primero');
});

test('⚠️ la subtab de nutrición se puede EDITAR: quitar y agregar', () => {
  // «Faltan muchas cosas en esa vista, no hay opción de agregar, de eliminar, etc…»
  const md = leer('app/crm/EtapasModal.tsx');
  assert.match(md, /const quitarNutricion = /, 'se fue el ✕ de cada nutrición');
  assert.match(md, /function NuevaNutricion\(/, 'se fue el «Agregar nutrición»');
  // El segundo renglón es el pedido: de qué depende que se dispare.
  assert.match(md, /Sale de «\{n\.desdeLabel\}» · \{n\.porque\}/, 'se fue el «de qué depende»');
  // ⚠️ Y NO es un desplegable: Martín dijo «obligatoriamente». De dónde sale una nutrición
  // lo decide la FORMA del recorrido, no una elección — un selector ahí prometería poder
  // cambiar un hecho. Lo dinámico es el NOMBRE, que sale de la clave de la etapa.
  const sub = md.slice(md.indexOf("{emb && sub === 'nutricion' && ("));
  assert.ok(!/<select/.test(sub.slice(0, 3000)), 'el origen de una nutrición se volvió elegible');
  // Y lo APAGADO no se dibuja en la lista: se ofrece para volver a poner.
  assert.match(md, /emb\.nutriciones\.filter\(\(n\) => n\.activa\)/, 'volvieron las casillas apagadas a la lista');
});

test('⚠️ crear un producto calcula sus apagadas en el CHOKE POINT, no en cada llamador', () => {
  // `crearFunnel` tiene tres llamadores y sólo uno pasaba la lista: los otros dos creaban
  // productos con las nueve nutriciones encendidas. La regla de la casa es que lo que vale
  // para TODOS los que crean se escribe donde pasan todos.
  const fn = leer('lib/funnels.ts');
  assert.match(fn, /suppressedInicial\(input\.pipeline!\)/, 'crear un producto dejó de apagar las que sobran');
  assert.deepEqual([...NUTRICIONES_POR_DEFECTO].sort(),
    ['noshow_r1', 'noshow_r2', 'noshow_r3', 'nutri', 'reactivacion']);
});
