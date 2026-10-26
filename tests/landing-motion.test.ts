// =============================================================================
// landing-motion — el bloque «Motion graphic» del Web Generator (lib/editor-landing/motion.ts sobre lib/motion)
// =============================================================================
// Lo que se cuida acá, de punta a punta:
//   · la forma: `div.gm-motion[role=img][aria-label]` con TODAS las capas `aria-hidden` (un lector de pantalla lee el
//     texto entero una vez y no deletrea), el MISMO árbol en el editor (NodeView) y en la publicada, y quieto
//     (`gm-mo-espera`) en una miniatura o una exportación;
//   · el saneo de lo que guarda una persona (validar.ts): NO estricto (un título largo no se corta ni se rechaza), con
//     motivo para lo que no se puede usar, y el esquema del editor lo carga;
//   · el catálogo («Motion graphic» en «Videos y multimedia») y su `case` en insertar.ts;
//   · la gramática de la IA, de ida y de vuelta (ia-bloques.ts), ESTRICTA: un texto más largo que su tope hace caer el
//     bloque con su motivo (nunca se recorta ni queda el ejemplo de la plantilla), y lo que vuelve igual del original
//     no se re-valida; `quitarPruebaInventada` saca una cifra o una cita que no están en el material;
//   · la publicada: la hoja trae CSS_MOTION, el script pone `gm-mo-espera` a lo que no está en pantalla y se la saca al
//     entrar (sin «menos movimiento», con IntersectionObserver, con o sin el interruptor «Animaciones»), sigue sin
//     barras ni backticks, y su hash está en la política;
//   · la API: agregar_bloque_landing con «motion» y configurar_motion_landing (estricto, `yaEstaba`, `disponibles`),
//     y ver_secciones_landing lee la plantilla, los valores y los topes;
//   · las fuentes del motor en el link de Google Fonts de la publicada.
//
// ⚠️ SIN PROBAR ROMPIÉNDOLO todavía (26/10/2026, la tanda se suspendió antes): ver docs/relevo/motion-imagen.md.
// =============================================================================

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proyecto.supabase.co';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Script, createContext, runInContext } from 'node:vm';
import { getSchema } from '@tiptap/core';
import { NODO, docPagina, textoDe, type JsonNodo, type LandingContenido } from '../lib/editor-landing/doc';
import { SPEC_NODOS, htmlDeArbol } from '../lib/editor-landing/especificacion';
import { sanearContenido } from '../lib/editor-landing/validar';
import { CSS_CONTENIDO } from '../lib/editor-landing/css';
import { CSS_MOTION } from '../lib/motion/css';
import { valoresPorDefecto } from '../lib/motion/plantillas';
import { PLANTILLAS_MOTION } from '../lib/motion/tipos';
import { arbolMotion, attrsMotion, familiasMotionDe, urlFuentesConMotion } from '../lib/editor-landing/motion';
import { BLOQUES } from '../lib/editor-landing/catalogo-bloques';
import { bloqueJson } from '../app/web-generator/editor/insertar';
import { extensionesBase } from '../app/web-generator/editor/extensiones/esquema';
import { GRAMATICA_IA, bloquesATarjeta, tarjetaABloques, type TarjetaIA } from '../lib/editor-landing/ia-bloques';
import { quitarPruebaInventada } from '../lib/editor-landing/ia-reglas';
import { SCRIPT_PAGINA, armarDocumento, hashScript, type Entorno } from '../lib/editor-landing/pagina-publica';
import { CONFIG_DEFAULT } from '../lib/editor-landing/api-tipos';
import { marcasDeVoseo } from '../lib/puestas-data';
import { estructuraParaApi, nodosDeBloque, planConfigurarMotion, esFallaPlan } from '../lib/api-mako/areas/landing-contenido.helpers';
import { porId } from '../lib/api-mako/registro';
import { rutaRestDe } from '../lib/api-mako/rest';

const TITULAR = { plantilla: 'titular', valores: valoresPorDefecto('titular'), formato: '16:9' } as const;
const motion = (attrs: unknown): JsonNodo => ({ type: NODO.motion, attrs: attrs as Record<string, unknown> });
const seccion = (id: string, ...bloques: JsonNodo[]): JsonNodo => ({ type: NODO.tarjeta, attrs: { id }, content: bloques });
const landing = (...tarjetas: JsonNodo[]): LandingContenido => ({ v: 1, paginas: [{ id: 'p1', titulo: 'Inicio', ruta: '', doc: docPagina(tarjetas) }] });
const p = (t: string): JsonNodo => ({ type: 'paragraph', content: [{ type: 'text', text: t }] });

/** Las etiquetas de apertura de un HTML, con sus atributos crudos. */
const aperturas = (html: string) => [...html.matchAll(/<([a-z]+)([^>]*)>/g)].map((m) => ({ tag: m[1], attrs: m[2] }));

// ─────────────────────────────────────────────────────────────────────────────
// La forma
// ─────────────────────────────────────────────────────────────────────────────

test('la forma: gm-motion con role=img y aria-label, y cada pedazo aria-hidden; el mismo árbol en el editor y en la publicada', () => {
  for (const plantilla of PLANTILLAS_MOTION) {
    const attrs = { plantilla, valores: valoresPorDefecto(plantilla), formato: '1:1' };
    const html = htmlDeArbol(SPEC_NODOS[NODO.motion](attrs, { modo: 'publico' }));
    const [raiz, ...resto] = aperturas(html);
    assert.equal(raiz.tag, 'div', plantilla);
    assert.match(raiz.attrs, /class="gm-motion"/, plantilla);
    assert.match(raiz.attrs, /role="img"/, plantilla);
    assert.match(raiz.attrs, /aria-label="[^"]{3,}"/, `${plantilla}: el texto entero va en el aria-label`);
    assert.match(raiz.attrs, new RegExp(`data-plantilla="${plantilla}"`));
    assert.match(raiz.attrs, /data-formato="1:1"/);
    const capas = resto.filter((x) => /class="mo-capa/.test(x.attrs));
    assert.ok(capas.length >= 2, `${plantilla}: ${capas.length} capas`);
    for (const c of capas) assert.match(c.attrs, /aria-hidden="true"/, `${plantilla}: una capa sin aria-hidden (${c.attrs.slice(0, 80)})`);
    assert.doesNotMatch(html, /<style|<script/i);
    // El NodeView dibuja arbolMotion: el mismo HTML que la publicada.
    assert.equal(htmlDeArbol(arbolMotion(attrs)), html, `${plantilla}: el editor y la publicada dibujan distinto`);
  }
  // Un texto con HTML sale escapado (el árbol sólo lleva strings).
  const malo = htmlDeArbol(SPEC_NODOS[NODO.motion]({ ...TITULAR, valores: { ...TITULAR.valores, titulo: '</div><script>alert(1)</script>' } }));
  assert.doesNotMatch(malo, /<script/);
  assert.match(malo, /&lt;script&gt;/);
});

test('quieto en una miniatura y al exportar (gm-mo-espera); animado en el editor y en la publicada', () => {
  for (const modo of ['miniatura', 'exportar'] as const) {
    assert.match(htmlDeArbol(SPEC_NODOS[NODO.motion](TITULAR, { modo })), /^<div[^>]*class="gm-motion gm-mo-espera"/, modo);
  }
  for (const modo of ['editor', 'publico'] as const) {
    assert.doesNotMatch(htmlDeArbol(SPEC_NODOS[NODO.motion](TITULAR, { modo })), /gm-mo-espera/, modo);
  }
  assert.equal(textoDe(motion(TITULAR)), 'NUEVO. Vende más con menos esfuerzo. Todo tu marketing en un solo lugar.');
});

// ─────────────────────────────────────────────────────────────────────────────
// El saneo de lo que se guarda (validar.ts) y el esquema del editor
// ─────────────────────────────────────────────────────────────────────────────

test('validar: lo de una persona se guarda sin cortar; lo que no se puede usar se va con su motivo; el editor lo carga', () => {
  const largo = 'Un título que la persona escribió bastante más largo que el tope de noventa caracteres que tiene la IA, y se queda';
  const bien = motion({ plantilla: 'titular', valores: { ...valoresPorDefecto('titular'), titulo: largo }, formato: '9:16' });
  const r = sanearContenido(landing(seccion('tA', bien)));
  assert.deepEqual(r.descartes, []);
  const guardado = r.contenido.paginas[0].doc.content[0].content?.[0];
  assert.equal(guardado?.type, NODO.motion);
  assert.equal((guardado?.attrs?.valores as Record<string, unknown>).titulo, largo, 'el texto de la persona no se recorta');
  assert.equal(guardado?.attrs?.formato, '9:16');

  const basura = motion({ plantilla: 'nada', valores: { titulo: 5, inventado: 'x', colorFondo: 'rojo' }, formato: '4:3', onclick: 'alert(1)' });
  const m = sanearContenido(landing(seccion('tB', basura)));
  const n = m.contenido.paginas[0].doc.content[0].content?.[0];
  assert.equal(n?.type, NODO.motion, 'el bloque se conserva, normalizado');
  assert.deepEqual(n?.attrs, attrsMotion({}), 'queda el titular de ejemplo, horizontal');
  for (const re of [/plantilla «nada»: no existe/, /formato «4:3»/, /atributo desconocido «onclick»/]) {
    assert.ok(m.descartes.some((d) => re.test(d)), `falta el motivo ${re} en:\n${m.descartes.join('\n')}`);
  }
  // Idempotente: sanear lo saneado no anota nada.
  assert.deepEqual(sanearContenido(m.contenido).descartes, []);

  const schema = getSchema(extensionesBase());
  assert.doesNotThrow(() => schema.nodeFromJSON(r.contenido.paginas[0].doc).check());
  assert.equal(schema.nodes[NODO.motion].isAtom, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// El catálogo y el insertador
// ─────────────────────────────────────────────────────────────────────────────

test('catálogo: «Motion graphic» en «Videos y multimedia», y su case inserta el titular que el server guarda sin descartes', () => {
  const def = BLOQUES.find((b) => b.id === 'motion');
  assert.ok(def, 'falta el bloque en el catálogo');
  assert.equal(def.nombre, 'Motion graphic');
  assert.equal(def.categoria, 'Videos y multimedia');
  const json = bloqueJson('motion');
  assert.equal(json?.type, NODO.motion);
  assert.deepEqual(json?.attrs, { plantilla: 'titular', valores: valoresPorDefecto('titular'), formato: '16:9' });
  assert.deepEqual(sanearContenido(landing(seccion('tA', json as JsonNodo))).descartes, []);
});

// ─────────────────────────────────────────────────────────────────────────────
// La IA (ia-bloques.ts)
// ─────────────────────────────────────────────────────────────────────────────

test('IA: nodo → bloque → nodo da lo mismo (con el original y sin él)', () => {
  const nodo = motion({ plantilla: 'cifra', valores: { ...valoresPorDefecto('cifra'), numero: 300, etiqueta: 'clientes', colorAcento: '#ff0055' }, formato: '1:1' });
  const tarjeta = sanearContenido(landing(seccion('tA', nodo))).contenido.paginas[0].doc.content[0];
  const ida = tarjetaABloques(tarjeta);
  assert.equal(ida.bloques[0].t, 'motion');
  const d: string[] = [];
  const conBase = bloquesATarjeta(ida, { base: tarjeta, descartes: d });
  assert.deepEqual(conBase.content?.[0], tarjeta.content?.[0]);
  const sinRef: TarjetaIA = { ...ida, bloques: ida.bloques.map((b) => ({ ...b, ref: undefined })) };
  assert.deepEqual(bloquesATarjeta(sinRef, { descartes: d }).content?.[0], tarjeta.content?.[0]);
  assert.deepEqual(d, []);
});

test('IA: estricto — un texto largo hace caer el bloque con su motivo (no se recorta, no queda el ejemplo); nada se inventa', () => {
  const caer = (bloque: Record<string, unknown>, re: RegExp) => {
    const d: string[] = [];
    const t = bloquesATarjeta({ bloques: [bloque as never, { t: 'p', texto: 'sigue' }] }, { descartes: d });
    assert.equal((t.content ?? []).filter((n) => n.type === NODO.motion).length, 0, `no se cayó: ${JSON.stringify(bloque).slice(0, 80)}`);
    assert.ok(d.some((x) => re.test(x)), `falta el motivo ${re} en:\n${d.join('\n')}`);
  };
  caer({ t: 'motion', plantilla: 'titular', valores: { titulo: 'x'.repeat(91) } }, /Título: tiene 91 caracteres y el tope es 90; se cae el bloque/);
  caer({ t: 'motion', plantilla: 'titular', valores: { bajada: 'Sin título' } }, /falta «Título»/);
  caer({ t: 'motion', plantilla: 'cifra', valores: { etiqueta: 'clientes' } }, /falta el número/);
  caer({ t: 'motion', plantilla: 'nada', valores: {} }, /la plantilla «nada» no existe/);

  // Lo que nadie dio no sale del ejemplo: textos vacíos y, en un testimonio, sin estrellas.
  const d: string[] = [];
  const t = bloquesATarjeta({ bloques: [{ t: 'motion', plantilla: 'testimonio', valores: { cita: 'Me cambió el negocio.', nombre: 'Ana' }, formato: 'nada' } as never] }, { descartes: d });
  const a = t.content?.[0].attrs as { valores: Record<string, unknown>; formato: string };
  assert.equal(a.valores.cargo, '');
  assert.equal(a.valores.estrellas, 0);
  assert.equal(a.formato, '16:9');
  assert.ok(d.some((x) => /formato «nada» no existe/.test(x)), d.join('\n'));
});

test('IA: lo que vuelve igual del original no se re-valida (el título largo de la persona), y otra plantilla conserva el estilo', () => {
  const largo = 'y'.repeat(150);
  const tarjeta = seccion('tA', motion({ plantilla: 'titular', valores: { ...valoresPorDefecto('titular'), titulo: largo, colorFondo: '#123456' }, formato: '16:9' }));
  const ida = tarjetaABloques(tarjeta);
  const d: string[] = [];
  const vuelta = bloquesATarjeta(ida, { base: tarjeta, descartes: d });
  assert.equal((vuelta.content?.[0].attrs?.valores as Record<string, unknown>).titulo, largo);
  assert.deepEqual(d, []);
  // Otra plantilla: el color de fondo queda; lo propio del titular se va (no se arrastra a la nueva).
  const b = ida.bloques[0] as { ref?: string };
  const otra = bloquesATarjeta({ bloques: [{ t: 'motion', plantilla: 'cierre', ref: b.ref, valores: { titulo: 'Empieza hoy', boton: 'Quiero' } } as never] }, { base: tarjeta, descartes: d });
  const v = otra.content?.[0].attrs?.valores as Record<string, unknown>;
  assert.equal(v.colorFondo, '#123456');
  assert.equal(v.detalle, '');
  assert.equal('bajada' in v, false);
});

test('la gramática nombra el bloque y sus plantillas, sin voseo ni backticks', () => {
  assert.match(GRAMATICA_IA, /\{"t":"motion","plantilla","valores"/);
  for (const id of PLANTILLAS_MOTION) assert.ok(GRAMATICA_IA.includes(`${id}:`), `falta la plantilla ${id}`);
  assert.deepEqual(marcasDeVoseo(GRAMATICA_IA), []);
  assert.equal(GRAMATICA_IA.includes('`'), false);
});

test('quitarPruebaInventada: una cifra o una cita animadas que no están en el material se van; las que están, quedan', () => {
  const cifra = (numero: number) => seccion('tA', motion({ plantilla: 'cifra', valores: { ...valoresPorDefecto('cifra'), numero, etiqueta: 'clientes' } }));
  const sin = quitarPruebaInventada(cifra(4800), 'Queremos más clientes este año');
  assert.equal(sin.quitados, 1);
  assert.equal(sin.tarjeta.content?.[0].type, 'paragraph');
  const con = quitarPruebaInventada(cifra(1250), 'Ya tenemos 1.250 clientes felices');
  assert.equal(con.quitados, 0);
  assert.equal(con.tarjeta.content?.[0].type, NODO.motion);
  const cita = seccion('tB', motion({ plantilla: 'testimonio', valores: { ...valoresPorDefecto('testimonio'), cita: 'Duplicamos las ventas en tres semanas con este sistema.' } }));
  assert.equal(quitarPruebaInventada(cita, 'Un negocio de ropa').quitados, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// La página publicada
// ─────────────────────────────────────────────────────────────────────────────

const ENTORNO: Entorno = { appBaseUrl: 'https://hola-mako.com', prefijoBucket: null };

test('la publicada: la hoja trae CSS_MOTION, el script trae la función y sigue sin barras ni backticks, y su hash está en la política', () => {
  assert.ok(CSS_CONTENIDO.includes(CSS_MOTION), 'CSS_MOTION no está en la hoja del contenido');
  assert.doesNotMatch(CSS_MOTION, /`|\$\{|<\//);
  const html = armarDocumento({ html: '<div class="gm-doc"></div>', config: CONFIG_DEFAULT, workspaceId: 7, modo: 'vista', urlCanonica: 'https://hola-mako.site/x' }, ENTORNO);
  assert.ok(html.includes(CSS_MOTION.split('\n')[1]), 'el documento no trae las reglas del motion graphic');
  assert.match(SCRIPT_PAGINA, /function motionAlEntrar\(\)/);
  assert.doesNotMatch(SCRIPT_PAGINA, /[\\`]|\$\{/);
  assert.doesNotThrow(() => new Script(SCRIPT_PAGINA));
  assert.ok(html.includes(`<script>${SCRIPT_PAGINA}</script>`));
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html)?.[1].replace(/&#39;/g, "'") ?? '';
  assert.ok(csp.includes(hashScript(SCRIPT_PAGINA)), 'el hash del script no está en script-src');
});

type Caja = {
  nombre: string; clases: Set<string>;
  classList: { add: (c: string) => void; remove: (c: string) => void; contains: (c: string) => boolean };
  getBoundingClientRect: () => { top: number; bottom: number };
};
type Entrada = { isIntersecting: boolean; target: Caja };

/** La publicada de mentira: un motion en pantalla, uno abajo y una sección (no es un motion) que un DOM falso devuelve igual. */
function correr(op: { animar?: boolean; reducido?: boolean; conIO?: boolean } = {}) {
  const caja = (nombre: string, clases: string[], top: number, bottom: number): Caja => {
    const set = new Set(clases);
    return { nombre, clases: set, classList: { add: (c) => { set.add(c); }, remove: (c) => { set.delete(c); }, contains: (c) => set.has(c) }, getBoundingClientRect: () => ({ top, bottom }) };
  };
  const arriba = caja('arriba', ['gm-motion'], 120, 520);
  const abajo = caja('abajo', ['gm-motion'], 2100, 2500);
  const otra = caja('otra', ['gm-tarjeta'], 3000, 3400);
  const observados: Caja[] = [];
  const soltados: Caja[] = [];
  let alVer: ((e: Entrada[]) => void) | null = null;
  class IOFalso {
    constructor(cb: (e: Entrada[]) => void) { alVer = cb; }
    observe(el: Caja) { observados.push(el); }
    unobserve(el: Caja) { soltados.push(el); }
  }
  const document = {
    addEventListener: () => { /* el formulario no importa acá */ },
    body: { getAttribute: (n: string) => (n === 'data-gm-animar' && op.animar ? '1' : null) },
    documentElement: { clientHeight: 844, classList: { add: () => { /* nada */ } } },
    querySelectorAll: (sel: string) => (sel === '.gm-motion' ? [arriba, abajo, otra] : []),
  };
  const window = {
    location: { href: 'https://hola-mako.site/x' }, innerHeight: 844, addEventListener: () => { /* nada */ },
    matchMedia: () => ({ matches: !!op.reducido }),
    IntersectionObserver: op.conIO === false ? undefined : IOFalso,
  };
  runInContext(SCRIPT_PAGINA, createContext({ document, window, URL }));
  return { arriba, abajo, otra, observados, soltados, ver: (e: Entrada[]) => alVer?.(e) };
}

test('el script: lo que no está en pantalla espera quieto y arranca al entrar; lo de arriba no se toca; con o sin «Animaciones»', () => {
  for (const animar of [true, false]) {
    const s = correr({ animar });
    assert.ok(!s.arriba.clases.has('gm-mo-espera'), 'lo que ya está en pantalla no se toca (ni un parpadeo)');
    assert.ok(s.abajo.clases.has('gm-mo-espera'), `animar=${animar}: lo de abajo espera en su estado final`);
    assert.ok(!s.otra.clases.has('gm-mo-espera'), 'sólo los .gm-motion');
    assert.deepEqual(s.observados.map((x) => x.nombre), ['abajo']);
    s.ver([{ isIntersecting: false, target: s.abajo }]);
    assert.ok(s.abajo.clases.has('gm-mo-espera'), 'sin entrar, sigue esperando');
    s.ver([{ isIntersecting: true, target: s.abajo }]);
    assert.ok(!s.abajo.clases.has('gm-mo-espera'), 'al entrar se saca la clase: la animación arranca de cero');
    assert.deepEqual(s.soltados.map((x) => x.nombre), ['abajo']);
  }
  for (const op of [{ reducido: true }, { conIO: false }]) {
    const s = correr(op);
    assert.ok(!s.abajo.clases.has('gm-mo-espera') && s.observados.length === 0, `${JSON.stringify(op)}: no toca nada`);
  }
});

test('las fuentes del motor van en el link de Google Fonts de la publicada (y las comillas de un testimonio)', () => {
  const tema = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap';
  const nodos = [seccion('tA', motion({ plantilla: 'testimonio', valores: { ...valoresPorDefecto('testimonio'), fuente: 'Montserrat' } }), p('x'))];
  const familias = familiasMotionDe(nodos);
  assert.deepEqual(familias, ['Montserrat', 'Playfair Display']);
  assert.equal(urlFuentesConMotion(tema, familias), 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Montserrat:wght@400;600;800&family=Playfair+Display:wght@400;700;800&display=swap');
  assert.equal(urlFuentesConMotion(tema, []), tema, 'sin motion graphics, el link del tema tal cual');
  assert.equal(urlFuentesConMotion(tema, ['Inter']), 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
});

// ─────────────────────────────────────────────────────────────────────────────
// La API de MaKo
// ─────────────────────────────────────────────────────────────────────────────

test('API: agregar_bloque_landing con «motion» pone el titular con ese texto (estricto); ver_secciones_landing lo lee', () => {
  const n = nodosDeBloque({ bloque: 'motion', texto: 'Vende más' });
  assert.ok(Array.isArray(n));
  const attrs = (n as JsonNodo[])[0].attrs as { plantilla: string; valores: Record<string, unknown> };
  assert.equal(attrs.plantilla, 'titular');
  assert.equal(attrs.valores.titulo, 'Vende más');
  assert.equal(attrs.valores.antetitulo, '', 'nada sale del ejemplo de la plantilla');
  const largo = nodosDeBloque({ bloque: 'motion', texto: 'z'.repeat(120) });
  assert.ok(!Array.isArray(largo) && /tope es 90/.test(largo.error), JSON.stringify(largo));

  const c = landing(seccion('tA', p('hola'), motion(TITULAR)));
  const e = estructuraParaApi(1, c);
  const b = e.paginas[0].secciones[0].bloques[1] as { tipo: string; motion?: { plantilla: string; valores: Record<string, unknown>; topes: Record<string, number> } };
  assert.equal(b.tipo, 'motion graphic (Titular)');
  assert.equal(b.motion?.plantilla, 'titular');
  assert.equal(b.motion?.topes.titulo, 90);
  assert.equal(b.motion?.valores.titulo, 'Vende más con menos esfuerzo');
});

test('API: configurar_motion_landing cambia campos, plantilla y formato; rechaza lo largo; «ya está así»; lo que no existe con disponibles', () => {
  const c = landing(seccion('tA', p('hola'), motion(TITULAR)));
  const ok = planConfigurarMotion(c, { seccion: 'tA', valores: [{ campo: 'titulo', valor: 'Nuevo título' }, { campo: 'conFondo', valor: 'false' }], formato: '1:1' });
  assert.ok(!esFallaPlan(ok), JSON.stringify(ok));
  const nuevo = ok.contenido.paginas[0].doc.content[0].content?.[1].attrs as { valores: Record<string, unknown>; formato: string };
  assert.equal(nuevo.valores.titulo, 'Nuevo título');
  assert.equal(nuevo.valores.conFondo, false);
  assert.equal(nuevo.formato, '1:1');
  assert.match(ok.resumen, /titulo: «Nuevo título»/);

  const cifra = planConfigurarMotion(c, { seccion: 'tA', plantilla: 'cifra', valores: [{ campo: 'numero', valor: '1250' }, { campo: 'etiqueta', valor: 'clientes' }] });
  assert.ok(!esFallaPlan(cifra), JSON.stringify(cifra));
  const v = cifra.contenido.paginas[0].doc.content[0].content?.[1].attrs?.valores as Record<string, unknown>;
  assert.equal(v.numero, 1250);
  assert.equal(v.prefijo, '', 'el «+» de ejemplo no se inventa');

  const largo = planConfigurarMotion(c, { seccion: 'tA', valores: [{ campo: 'titulo', valor: 'w'.repeat(91) }] });
  assert.ok(esFallaPlan(largo) && /tope es 90/.test(largo.error), JSON.stringify(largo));
  const sinNumero = planConfigurarMotion(c, { seccion: 'tA', plantilla: 'cifra', valores: [{ campo: 'etiqueta', valor: 'clientes' }] });
  assert.ok(esFallaPlan(sinNumero) && /falta el número/.test(sinNumero.error), JSON.stringify(sinNumero));
  const igual = planConfigurarMotion(c, { seccion: 'tA', valores: [{ campo: 'titulo', valor: TITULAR.valores.titulo as string }] });
  assert.ok(esFallaPlan(igual) && igual.yaEstaba === true);
  const ajeno = planConfigurarMotion(c, { seccion: 'tA', valores: [{ campo: 'precio', valor: '$9' }] });
  assert.ok(esFallaPlan(ajeno) && Array.isArray(ajeno.disponibles) && (ajeno.disponibles as string[]).includes('titulo'));
  const sinMotion = planConfigurarMotion(landing(seccion('tB', p('x'))), { seccion: 'tB', formato: '1:1' });
  assert.ok(esFallaPlan(sinMotion) && /agregar_bloque_landing/.test(sinMotion.error));

  const def = porId('configurar_motion_landing');
  assert.ok(def && def.tipo === 'accion' && def.confirmacion === 'chat' && def.reversible === true);
  assert.equal(rutaRestDe('configurar_motion_landing')?.ruta, '/landing/documentos/{id}/secciones/{seccion}/motion');
});

// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ PENDIENTE: probarlo ROMPIÉNDOLO (con este archivo en verde primero, restaurando DE MEMORIA, nunca `git checkout`).
// La tanda se suspendió el 26/10/2026 antes de hacerlo: hasta entonces, estos tests son una afirmación, no una medición.
// =============================================================================
