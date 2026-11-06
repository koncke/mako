// =============================================================================
// Knowledge: el conocimiento de los cursos, modular y disponible para toda la app — 31/10/2026
// =============================================================================
// Martín pidió Knowledge «modular como el Second Brain». Lo que fija este archivo:
//   1. el catálogo de módulos está sano (una key, un nombre, un área y al menos una sección por módulo);
//   2. cada sección del portal de cursos tiene su módulo o está declarada SIN módulo a propósito: una sección nueva
//      frena acá, porque si no su material no llega a ninguna parte y nada lo avisa;
//   3. el área de cada módulo se puede ELEGIR en la pantalla: un área que no está en el desplegable nunca recibe una
//      ficha y el módulo queda en cero para siempre;
//   4. las tabs de cada módulo son keys del nav de verdad, que es el contrato con el que una tab pide su método;
//   5. el índice que viaja al prompt trae los módulos y NADA del contenido, y es corto;
//   6. la capa del grafo tiene la forma del Second Brain: una raíz que es estructura, un nodo `kn:` por módulo, UN
//      cerebro al colgarla y `sinKnowledge` que la saca entera;
//   7. la capa entra al turno cuando la pregunta pide el MÉTODO, y no cuando pregunta por el dato del negocio;
//   8. un closer o un setter SÍ leen el método (no tiene plata adentro);
//   9. el cableado que no se puede ejercitar sin servidor: `grafoParaChat` cuelga la capa, `paqueteParaElTurno` la saca
//      cuando no es de método, y `buildSystemPrompt` carga el índice.
//
// Probado rompiéndolo (31/10/2026): al pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AREAS_KNOWLEDGE, MODULOS_KNOWLEDGE, SECCIONES_SIN_MODULO, areasDeTab, bloqueDeModulos, moduloDeArea, moduloDeKey,
  modulosDeTab, ROTULO_MODULOS,
} from '../lib/knowledge-modulos';
import {
  armarKnowledge, CAPA_CONOCIMIENTO, cuantoHay, esPreguntaDeConocimiento, ID_RAIZ_KNOWLEDGE, idModulo, knowledgeDeMako,
  nodoDeModulo, PUENTE_KNOWLEDGE, sinKnowledge,
} from '../lib/cerebro-knowledge';
import { esEstructura } from '../lib/cerebro-areas';
import { componentes, conCapa, sinLaPlata } from '../lib/cerebro-union';
import { indiceDelCerebro, recuperar } from '../lib/cerebro-recuperar';
import { CURSOS_TODOS } from '../app/conocimientos/catalogo';
import type { Cerebro } from '../lib/cerebro-modelo';

const RAIZ = join(import.meta.dirname, '..');
/** El fuente SIN sus comentarios de línea: un guard no se satisface con una mención en un comentario. */
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

test('1. el catálogo de módulos está sano', () => {
  assert.ok(MODULOS_KNOWLEDGE.length >= 5, 'quedaron menos de 5 módulos: Knowledge dejó de clasificar el material');
  const keys = MODULOS_KNOWLEDGE.map((m) => m.key);
  assert.equal(new Set(keys).size, keys.length, `hay keys de módulo repetidas (${keys.join(', ')}): la segunda nunca se encuentra`);
  for (const m of MODULOS_KNOWLEDGE) {
    assert.match(m.key, /^[a-z][a-z0-9-]*$/, `la key «${m.key}» no es un slug: viaja en el id del nodo y en el enum de la API`);
    assert.ok(m.nombre.trim(), `el módulo «${m.key}» se quedó sin nombre: la pantalla y el grafo lo dibujan vacío`);
    assert.ok(m.que.trim().length > 30, `el módulo «${m.key}» no dice qué enseña: es lo único con lo que el modelo decide si le sirve`);
    assert.ok(m.area.trim(), `el módulo «${m.key}» se quedó sin área: su método no se puede leer de mako_knowledge`);
    assert.ok(m.secciones.length > 0, `el módulo «${m.key}» no dice de qué secciones del portal sale: queda sin fuente`);
    assert.equal(moduloDeKey(m.key)?.key, m.key, `moduloDeKey no encuentra «${m.key}»`);
  }
  for (const a of AREAS_KNOWLEDGE) assert.ok(moduloDeArea(a), `el área «${a}» no tiene módulo`);
});

test('2. toda sección del portal de cursos tiene módulo, o está declarada sin módulo a propósito', () => {
  // Las secciones DE VERDAD son las del catálogo armado, no las que declara cada curso-*.ts: el mapa CATEGORIA las pisa
  // (103 archivos dicen «Cursos externos» y ninguno de los 132 cursos queda con esa categoría).
  const delPortal = [...new Set(CURSOS_TODOS.map((c) => c.categoria))].sort();
  assert.ok(delPortal.length >= 10, `el portal devolvió ${delPortal.length} secciones: el catálogo no se leyó`);
  const cubiertas = new Set<string>([...MODULOS_KNOWLEDGE.flatMap((m) => m.secciones), ...SECCIONES_SIN_MODULO]);
  for (const s of delPortal) {
    assert.ok(cubiertas.has(s), `la sección «${s}» del portal no está en ningún módulo ni en SECCIONES_SIN_MODULO: el material de sus cursos no llega a ninguna parte y nada lo avisa`);
  }
  // Y al revés: una sección declarada que ya no existe deja al módulo sin cursos, también en silencio.
  const existen = new Set(delPortal);
  for (const m of MODULOS_KNOWLEDGE) {
    for (const s of m.secciones) {
      assert.ok(existen.has(s), `el módulo «${m.key}» apunta a la sección «${s}», que el portal ya no tiene: se queda sin cursos`);
    }
  }
  for (const s of SECCIONES_SIN_MODULO) assert.ok(existen.has(s), `«${s}» está excluida y el portal ya no la tiene: sobra`);
});

test('3. el área de cada módulo se puede elegir en la pantalla del método', () => {
  const vista = fuente('app/classroom/methodology/ConocimientoView.tsx');
  const ofrecidas = new Set([...vista.matchAll(/value: '([a-z-]+)', label:/g)].map((m) => m[1]));
  assert.ok(ofrecidas.size >= 5, `la pantalla ofreció ${ofrecidas.size} áreas: el desplegable no se pudo leer`);
  for (const m of MODULOS_KNOWLEDGE) {
    assert.ok(ofrecidas.has(m.area), `el área «${m.area}» del módulo «${m.key}» no está en el desplegable de la pantalla: no se puede cargar una ficha ahí y el módulo queda en cero para siempre`);
  }
});

test('4. las tabs de cada módulo son keys del nav de verdad', () => {
  // Las keys salen del FUENTE del nav y no de `TODOS_LOS_ITEMS`: ese export no baja a los `bloques` de una familia, así
  // que `automatizaciones` —una tab que existe y se abre todos los días— no figura en él. Medido el 31/10/2026.
  const delNav = new Set([...fuente('app/_components/nav.ts').matchAll(/key: '([a-z0-9-]+)'/g)].map((m) => m[1]));
  assert.ok(delNav.size >= 40, `el nav devolvió ${delNav.size} keys: no se pudo leer y el guard pasaría con cualquier tab`);
  for (const m of MODULOS_KNOWLEDGE) {
    for (const t of m.tabs) {
      assert.ok(delNav.has(t), `el módulo «${m.key}» dice servir a la tab «${t}», que no existe en el nav: nadie va a pedir su método con esa key`);
    }
  }
  // Y el resolutor por tab: la key del nav entra, una tab inventada no saca nada, y sin tab salen los que sirven a un negocio.
  assert.deepEqual(modulosDeTab('ads-writer').map((m) => m.key), ['anuncios']);
  assert.deepEqual(modulosDeTab('tab-que-no-existe').map((m) => m.key), [], 'una tab inventada devolvió módulos');
  assert.ok(!modulosDeTab().some((m) => m.tabs.length === 0), 'sin tab salieron módulos que no sirven a ninguna');
  const areas = areasDeTab('chats');
  assert.deepEqual(areas, [...new Set(areas)], 'areasDeTab repitió un área: la tab pediría dos veces lo mismo');
});

test('5. el índice del prompt trae los módulos y nada del contenido, y es corto', () => {
  const b = bloqueDeModulos();
  assert.ok(b.startsWith(ROTULO_MODULOS), 'el índice no arranca con su rótulo: el modelo no sabe qué está leyendo');
  for (const m of MODULOS_KNOWLEDGE.filter((x) => x.tabs.length)) {
    assert.ok(b.includes(m.key) && b.includes(m.nombre), `el índice no nombra al módulo «${m.key}»: MaKo no sabe que existe y lo va a negar`);
  }
  // El módulo `producto` es área RESERVADA: no entra al prompt de un negocio.
  for (const m of MODULOS_KNOWLEDGE.filter((x) => !x.tabs.length)) {
    assert.ok(!b.includes(`- ${m.key} `), `el índice del negocio trae el módulo «${m.key}», que es sólo de la plataforma`);
  }
  // `AREAS_RESERVADAS` vive en un módulo `server-only` (lib/mako-knowledge.ts), que no se importa bajo tsx: se lee del
  // fuente, como hace tests/tenant-tables-contract.test.ts con TENANT_TABLES.
  const mk = fuente('lib/mako-knowledge.ts');
  assert.match(mk, /AREA_PRODUCTO = 'producto'/, 'el área del módulo `app` ya no se llama «producto»');
  assert.match(mk, /AREAS_RESERVADAS = \[[^\]]*AREA_PRODUCTO/, 'el área `producto` dejó de ser reservada: el método de cómo se construye la app entraría al RAG de todos los negocios');
  assert.ok(b.length < 1_600, `el índice mide ${b.length} caracteres y viaja en CADA turno: va una línea por módulo, sin contenido`);
  assert.ok(!/\n#{2,}/.test(b), 'el índice trae fichas (títulos de contenido): acá va sólo el índice');
  assert.equal(bloqueDeModulos([]), '', 'sin módulos el bloque tiene que ser vacío, no un rótulo solo');
});

test('6. la capa del grafo tiene la forma del Second Brain y se saca entera', () => {
  const g = knowledgeDeMako();
  const raiz = g.nodos.find((n) => n.id === ID_RAIZ_KNOWLEDGE);
  assert.ok(raiz, 'la capa no tiene su carpeta madre: no habría de dónde colgarla');
  assert.ok(esEstructura(raiz!), 'la raíz de Knowledge cuenta como un dato (el índice y la vista local la traerían como si fuera método)');
  assert.deepEqual(
    g.nodos.filter((n) => !esEstructura(n)).map((n) => n.id).sort(),
    MODULOS_KNOWLEDGE.map((m) => idModulo(m.key)).sort(),
    'los nodos de la capa no son exactamente los módulos del catálogo',
  );
  const areas = new Set(g.taxonomia!.areas.map((a) => a.id));
  for (const n of g.nodos) assert.ok(areas.has(n.area), `${n.id}: su área ${n.area} no está en la taxonomía (el lienzo lo dibuja sin color y el filtro no lo ve)`);
  assert.equal(g.taxonomia!.capas?.[0]?.id, CAPA_CONOCIMIENTO, 'la capa no se declara: el filtro por capa no la puede prender');
  const ids = new Set(g.nodos.map((n) => n.id));
  const pares = new Set<string>();
  for (const a of g.aristas) {
    assert.ok(ids.has(a.de) && ids.has(a.a) && a.motivo.trim(), `arista rota ${a.de} → ${a.a}`);
    const par = [a.de, a.a].sort().join('|');
    assert.ok(!pares.has(par), `el par ${par} se repite: la misma arista dos veces`);
    pares.add(par);
  }
  // UN cerebro: colgada del negocio queda un solo componente (la regla de tests/second-brain-un-cerebro.test.ts).
  const negocio: Cerebro<string> = {
    negocio: 'Prueba', nodos: [{ id: 'raiz', area: 'x', tipo: 'Carpeta', etiqueta: 'Negocio', detalle: '', fuente: '', autoria: 'mako' }],
    aristas: [], cuenta: { total: 0, mako: 0, usuario: 0, pendientes: 0 }, vacias: [], posiciones: {}, encuadre: { x: 0, y: 0, lado: 1 },
    taxonomia: { carpetas: [{ id: 'x', nombre: 'x', que: 'x' }], areas: [{ id: 'x', padre: 'x', nombre: 'x', color: 'x', que: 'x' }] },
  };
  const unido = conCapa(negocio, g, { id: CAPA_CONOCIMIENTO, nombre: 'Knowledge', raiz: ID_RAIZ_KNOWLEDGE, motivo: PUENTE_KNOWLEDGE });
  assert.equal(componentes(unido.nodos, unido.aristas).length, 1, 'Knowledge queda como una isla: el cerebro se partió en dos');
  // Y se saca entera, sin dejar aristas colgadas.
  const sin = sinKnowledge(unido);
  assert.ok(!sin.nodos.some((n) => n.id.startsWith('kn:') || n.id === ID_RAIZ_KNOWLEDGE), 'sinKnowledge dejó nodos de la capa');
  const quedan = new Set(sin.nodos.map((n) => n.id));
  for (const a of sin.aristas) assert.ok(quedan.has(a.de) && quedan.has(a.a), `sinKnowledge dejó la arista ${a.de} → ${a.a} apuntando a un nodo que sacó`);
  assert.equal(sinKnowledge(negocio).nodos.length, 1, 'sinKnowledge tocó un grafo que no tiene la capa');
});

test('6b. el nodo de un módulo dice de qué cursos sale, dónde se usa y cuánto hay, y lo largo va en el cuerpo', () => {
  const m = MODULOS_KNOWLEDGE[0];
  const n = nodoDeModulo(m, { [m.key]: 7 });
  const dato = (k: string) => n.datos?.find((d) => d.k === k)?.v ?? '';
  assert.equal(dato('De qué cursos'), m.secciones.join(' · '), 'el nodo no dice de qué secciones sale: es lo que no se deduce de las fichas');
  assert.ok(dato('Dónde se usa').includes(m.tabs[0]), 'el nodo no dice en qué tabs se usa');
  assert.equal(dato('Cuánto hay cargado'), '7 fichas de método', 'el nodo no trae el dato medido');
  assert.equal(cuantoHay(m, { [m.key]: 0 }), 'Todavía sin método cargado', 'un módulo en cero no lo dice');
  assert.equal(cuantoHay(m), '', 'sin dato medido el nodo AFIRMA algo: «cero» y «no lo sé» no son lo mismo');
  assert.ok((n.cuerpo ?? '').length > (n.detalle ?? '').length, 'el detalle largo no está en el cuerpo: viajaría en cada vecino');
  // La vista local encuentra el módulo por el método, con presupuesto, y el índice lo lista.
  const g = armarKnowledge();
  const p = recuperar(g, { pregunta: 'qué método uso para escribir un anuncio', presupuesto: 600 });
  assert.equal(p.modo, 'vista-local', 'una pregunta de método no encontró ningún módulo en el grafo');
  assert.ok(indiceDelCerebro(g).includes('Knowledge'), 'el índice del cerebro no nombra a Knowledge');
});

test('7. la capa entra cuando la pregunta pide el MÉTODO, no cuando pregunta por el dato del negocio', () => {
  for (const q of [
    'qué método uso para escribir un anuncio',
    '¿cómo se estructura una VSL?',
    'qué dicen los cursos sobre el seguimiento',
    'dame la metodología de contenido orgánico',
    'quiero guiones al estilo de un referente del nicho',
    'mostrame los módulos de Knowledge',
  ]) assert.ok(esPreguntaDeConocimiento(q), `«${q}» pide el método y la capa no entra: MaKo contesta de memoria`);
  for (const q of [
    '¿cuál es mi oferta?',
    'cuántos leads tengo en Anuncios',
    'cambiá el precio de la oferta',
    'qué ventas cerré este mes',
    '',
  ]) assert.ok(!esPreguntaDeConocimiento(q), `«${q}» pregunta por el dato del negocio y la capa entra igual: le come el presupuesto del turno`);
});

test('8. un closer y un setter SÍ leen el método (no tiene plata adentro)', () => {
  const g = armarKnowledge();
  const negocio: Cerebro<string> = {
    negocio: 'Prueba',
    nodos: [
      { id: 'raiz', area: 'x', tipo: 'Carpeta', etiqueta: 'Negocio', detalle: '', fuente: '', autoria: 'mako' },
      { id: 'okr:1', area: 'x', tipo: 'OKR', etiqueta: 'USD 30.000', detalle: '', fuente: '', autoria: 'mako' },
    ],
    aristas: [{ de: 'raiz', a: 'okr:1', motivo: 'x' }], cuenta: { total: 1, mako: 1, usuario: 0, pendientes: 0 }, vacias: [],
    posiciones: {}, encuadre: { x: 0, y: 0, lado: 1 },
    taxonomia: { carpetas: [{ id: 'x', nombre: 'x', que: 'x' }], areas: [{ id: 'x', padre: 'x', nombre: 'x', color: 'x', que: 'x' }] },
  };
  const unido = conCapa(negocio, g, { id: CAPA_CONOCIMIENTO, nombre: 'Knowledge', raiz: ID_RAIZ_KNOWLEDGE, motivo: PUENTE_KNOWLEDGE });
  const delCloser = sinLaPlata(unido);
  assert.ok(delCloser.nodos.some((n) => n.id === idModulo(MODULOS_KNOWLEDGE[0].key)), 'un closer no ve el método de los cursos: es lo que necesita para escribir un mensaje, y no tiene un número del negocio adentro');
  assert.ok(delCloser.nodos.some((n) => n.id === ID_RAIZ_KNOWLEDGE), 'la carpeta de Knowledge no le llega al closer: sus módulos quedan colgando de nada');
  assert.ok(!delCloser.nodos.some((n) => n.id === 'okr:1'), 'sinLaPlata dejó pasar un OKR: la lista en positivo se rompió');
});

test('9. el cableado: el grafo de los chats cuelga Knowledge, el turno la saca si no es de método, y el prompt lleva el índice', () => {
  const chat = fuente('lib/cerebro-para-chat.ts');
  assert.match(chat, /conCapa\([^)]*knowledgeDeMako\(\)/, 'grafoParaChat dejó de colgar la capa de Knowledge: ningún chat puede recuperar el método del grafo');
  assert.match(chat, /esPreguntaDeConocimiento\(q\)\s*\?\s*\w+\s*:\s*sinKnowledge\(/, 'el turno dejó de sacar la capa cuando la pregunta NO es de método (o la condición quedó al revés, que es lo mismo que no tener guarda): la capa le come el presupuesto a los datos del negocio');
  // ⚠️ DOS asserts, y ninguno busca sólo el NOMBRE: con `const bloqueDeModulos = () => ''` adentro del archivo, un
  // guard que buscara «bloqueDeModulos» quedaba verde sobre un prompt sin índice (probado el 31/10/2026). Uno exige que
  // el índice venga DEL CATÁLOGO, el otro que se PEGUE al prompt.
  // Y el paquete del NEGOCIO de las 5 tabs de Create va sin la capa: su pregunta nombra «oferta», «producto», «precio»,
  // las mismas palabras de los módulos, y con la capa puesta éstos le comen presupuesto a los datos reales del cliente.
  assert.match(fuente('lib/negocio-para-crear.ts'), /const grafo = sinKnowledge\(await grafoParaChat\(\)\);/,
    'el contexto del negocio de Create volvió a leer el grafo CON la capa de Knowledge: los módulos del método compiten con la oferta y el avatar reales por el presupuesto');
  const ctx = fuente('lib/mako-context.ts');
  assert.match(ctx, /const \{ bloqueDeModulos \} = await import\('\.\/knowledge-modulos'\);/, 'buildSystemPrompt dejó de traer el índice de Knowledge DEL CATÁLOGO: si lo arma en otro lado, un módulo nuevo no llega al prompt');
  assert.match(ctx, /base \+= `\\n\\n\$\{bloqueDeModulos\(\)\}`/, 'buildSystemPrompt ya no pega el índice de Knowledge en el prompt: MaKo no sabe que el método existe y va a negarlo');
  // La capa va en TODOS los negocios, no sólo en la plataforma: es lo que MaKo le presta a cada uno.
  assert.ok(!/plataforma\s*\?\s*conCapa\([^)]*knowledgeDeMako/.test(chat), 'Knowledge quedó atada a la plataforma: ningún cliente recibiría el método');
  // Las dos operaciones de la API, DESPUÉS de todo lo que ya se pedía y con el enum sacado del catálogo (no de una copia).
  // Después sólo puede venir lo que nació más tarde, que tampoco le gana un empate a ellas (`sumar_documento_second_brain`, ticket #44).
  const def = fuente('lib/api-mako/areas/negocio.def.ts');
  const ids = [...def.matchAll(/^\s{4}id: '([a-z_]+)'/gm)].map((m) => m[1]);
  const iKnowledge = ids.indexOf('modulos_de_knowledge');
  // Y los kits de marca (5/11/2026, lib/marca/kits.ts), que nacieron después, y las plantillas de Offer (6/11/2026).
  assert.deepEqual(ids.slice(iKnowledge + 2), ['sumar_documento_second_brain', 'ver_kits_marca', 'guardar_kit_marca', 'elegir_kit_marca', 'borrar_kit_marca', 'ver_plantillas_oferta'], 'entró una operación después de las de Knowledge: si es vieja, le pasa un empate; si es nueva, súmala acá');
  assert.deepEqual(ids.slice(iKnowledge, iKnowledge + 2), ['modulos_de_knowledge', 'leer_modulo_knowledge'], 'las operaciones de Knowledge no son las ÚLTIMAS del área: en un empate de relevancia le ganan a una que ya se pedía');
  assert.match(def, /enum: MODULOS_KNOWLEDGE\.map\(\(m\) => m\.key\)/, 'el enum del módulo quedó escrito a mano: un módulo nuevo no se podría pedir');
  const run = fuente('lib/api-mako/areas/negocio.run.ts');
  for (const id of ['modulos_de_knowledge', 'leer_modulo_knowledge']) {
    assert.match(run, new RegExp(`^\\s{2}${id}: \\{`, 'm'), `la operación ${id} está declarada y no tiene cuerpo`);
  }
});

// =============================================================================
// PROBADO ROMPIÉNDOLO — 31/10/2026, de a una cosa, restaurando de una COPIA (nunca con `git checkout --`)
// BASE 10/0. Doce roturas, cada una sobre el árbol limpio:
// =============================================================================
//  1. lib/knowledge-modulos.ts: en `venta`, `secciones: ['Ventas']` → `['Ventas antiguas']`
//     → 9/1, cae el 2: «el módulo «venta» apunta a la sección «Ventas antiguas», que el portal ya no tiene».
//  2. lib/knowledge-modulos.ts: saco `'Ciberseguridad'` de SECCIONES_SIN_MODULO
//     → 9/1, cae el 2: «la sección «Ciberseguridad» del portal no está en ningún módulo ni en SECCIONES_SIN_MODULO».
//  3. app/classroom/methodology/ConocimientoView.tsx: la opción `value: 'paginas'` → `'paginas-x'`
//     → 9/1, cae el 3: «el área «paginas» del módulo «paginas» no está en el desplegable de la pantalla».
//  4. lib/knowledge-modulos.ts: en `anuncios`, `tabs: ['ads-writer', …]` → `['ads-writer-v2', …]`
//     → 9/1, cae el 4: «dice servir a la tab «ads-writer-v2», que no existe en el nav».
//  5. lib/knowledge-modulos.ts: `bloqueDeModulos` lista sólo el primer módulo (`ms.slice(0, 1)`)
//     → 9/1, cae el 5: «el índice no nombra al módulo «venta»: MaKo no sabe que existe y lo va a negar».
//  6. lib/cerebro-knowledge.ts: `ID_RAIZ_KNOWLEDGE = 'n1:knowledge'` → `'knowledge-raiz'`
//     → 8/2, caen el 6 («la raíz de Knowledge cuenta como un dato»: `esEstructura` sólo reconoce `n1:` y `area:`) y el 8
//     («la carpeta de Knowledge no le llega al closer»: `VE_SIN_PLATA` tampoco la reconoce).
//  7. lib/cerebro-knowledge.ts: en `armarKnowledge`, saco las aristas raíz→módulo (`aristas: []`)
//     → 9/1, cae el 6: «Knowledge queda como una isla: el cerebro se partió en dos».
//  8. lib/cerebro-knowledge.ts: en `esPreguntaDeConocimiento`, `if (DE_METODO.test(q)) return true;` → `return false;`
//     → 9/1, cae el 7: «qué método uso para escribir un anuncio» pide el método y la capa no entra.
//  9. lib/cerebro-union.ts: saco `kn|${CAPA_CONOCIMIENTO}|` de VE_SIN_PLATA
//     → 9/1, cae el 8: «un closer no ve el método de los cursos».
// 10. lib/cerebro-para-chat.ts, las TRES formas de romper el cableado del turno (9/1 cada una, cae el 9):
//     a) la condición INVERTIDA: `esPreguntaDeConocimiento(q) ? sinKnowledge(conProducto) : conProducto`;
//     b) la condición SACADA: `const g = conProducto;`;
//     c) sin colgar la capa: `const grafo = conFunciones;`.
//     Las dos primeras porque un guard sobre una condición se prueba sacándola Y al revés (AGENTS.md: `tests/agency.test.ts`
//     seguía verde con la condición invertida).
// 11. lib/mako-context.ts, las DOS formas de quedarse sin índice (9/1 cada una, cae el 9):
//     a) el import del catálogo reemplazado por un stub local (`const bloqueDeModulos = () => '';`);
//     b) el índice que no se pega al prompt (`void bloqueDeModulos;`).
//     ⚠️ La primera versión del guard buscaba el NOMBRE «bloqueDeModulos» y con el stub (a) daba VERDE sobre un prompt
//     sin índice. Por eso son dos asserts: de dónde viene y dónde se pega.
// 12. lib/api-mako/areas/negocio.def.ts: muevo las dos operaciones de Knowledge al medio del área
//     → 9/1, cae el 9: «las operaciones de Knowledge no son las ÚLTIMAS del área».
// 13. lib/negocio-para-crear.ts: `sinKnowledge(await grafoParaChat())` → `await grafoParaChat()`
//     → 9/1, cae el 9: «el contexto del negocio de Create volvió a leer el grafo CON la capa de Knowledge».
// =============================================================================
