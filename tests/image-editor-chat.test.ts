// =============================================================================
// El chat «MaKo IA» del Image Editor (16/10/2026)
// =============================================================================
// Pedido de Martín, por el Cerebro: «implementes este chat en todas las tabs… quiero que la app sea AI NATIVE». Es el
// chat del Video Editor en el editor de imágenes. Fija:
//   · la vista del diseño que lee la IA (lib/image-editor/chat/vista.ts): refs por id, estables y sin choques; las
//     medidas como las ve la persona (la esquina de arriba a la izquierda, con la escala);
//   · el catálogo cerrado y su validación (./catalogo.ts): lo que sobra o está fuera de rango se RECHAZA;
//   · aplicar (./aplicar.ts) sobre una copia: cada operación, lo bloqueado, el alcance «lo elegido», las fuentes que
//     el editor no tiene, lo que se borró en el medio y el caso de las mayúsculas como el motor;
//   · el hilo guardado (./hilo.ts) y su store en el navegador;
//   · el panel con un editor de mentira: pedir NO aplica; aceptar carga las fuentes ANTES y entra en UN paso; restaurar
//     es el deshacer de ese paso sólo si nada cambió después;
//   · la ruta, el modelo gratis, los prompts editables, la migración y el botón del riel.
//
// PROBADO ROMPIÉNDOLO: ver el final.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cajaDe, refsDeIds, vistaDeDiseno } from '../lib/image-editor/chat/vista';
import { TOPES_CHAT_IMAGEN, catalogoParaPrompt, OPERACIONES_CHAT_IMAGEN, validarOperacion, validarOperaciones, type OperacionImagen } from '../lib/image-editor/chat/catalogo';
import { aplicarOperaciones, conCaso, resumenDeCambios } from '../lib/image-editor/chat/aplicar';
import { AVISO_CORTADA, hiloAlAbrir, hiloParaGuardar, type MensajeGuardado } from '../lib/image-editor/chat/hilo';
import { CHAT_IMAGEN_SYSTEM_TEMPLATE, CHAT_IMAGEN_USER_TEMPLATE, PROMPTS_CHAT_IMAGEN } from '../lib/image-editor/chat/prompts';
import { cambiarHilo, conId, leerHilo, type MensajeMako } from '../app/image-editor/mako/chat/hilo';
import { aceptarPropuesta, pedirEdicion, restaurarPropuesta } from '../app/image-editor/mako/chat/acciones';
import { TABLAS_DE_INQUILINO } from '../lib/tablas-de-inquilino';

const RAIZ = join(__dirname, '..');
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (...ruta: string[]) => sinComentarios(readFileSync(join(RAIZ, ...ruta), 'utf8'));
const crudo = (...ruta: string[]) => readFileSync(join(RAIZ, ...ruta), 'utf8').replace(/\r\n/g, '\n');

type Obj = Record<string, unknown>;
type Doc = { width: number; height: number; pages: Array<{ id: string; width?: number; height?: number; name?: string; background: Obj; objects: Obj[] }> };

/** Un diseño de 1080×1080 con dos páginas: un título, una caja con origen al CENTRO y escala, una foto bloqueada, un texto en mayúsculas. */
function diseno(): Doc {
  return {
    width: 1080, height: 1080,
    pages: [
      {
        id: 'pag-1', background: { type: 'solid', color: '#ffffff' },
        objects: [
          { type: 'textbox', id: 'obj-titulo', text: 'Hola mundo', fontFamily: '"Archivo", sans-serif', fontSize: 40, fontWeight: 700, fill: '#141414', originX: 'left', originY: 'top', left: 100, top: 50, width: 600, height: 48, scaleX: 1, scaleY: 1, angle: 0 },
          { type: 'rect', id: 'obj-caja', shapeKind: 'rect', originX: 'center', originY: 'center', left: 540, top: 900, width: 200, height: 100, scaleX: 2, scaleY: 1, fill: '#ff0000', stroke: null, strokeWidth: 0 },
          { type: 'image', id: 'obj-foto', name: 'Foto', originX: 'left', originY: 'top', left: 0, top: 0, width: 400, height: 200, scaleX: 1, scaleY: 1, locked: true },
          { type: 'textbox', id: 'obj-mayus', text: 'OFERTA', caseSource: 'oferta', textCase: 'upper', fontFamily: '"Inter", sans-serif', fontSize: 20, scaleX: 2, scaleY: 2, originX: 'left', originY: 'top', left: 10, top: 600, width: 300, height: 24 },
        ],
      },
      { id: 'pag-2', width: 1080, height: 1920, background: { type: 'solid', color: '#000000' }, objects: [] },
    ],
  };
}

const VISTA = vistaDeDiseno(diseno(), { activePageId: 'pag-1' });
const ref = (id: string) => [...VISTA.elementos.values()].find((e) => e.id === id)!.ref;
const pref = (pageId: string) => [...VISTA.paginas.entries()].find(([, id]) => id === pageId)![0];
const objDe = (doc: unknown, id: string) => (doc as Doc).pages.flatMap((p) => p.objects).find((o) => o.id === id)!;
const op = (x: Record<string, unknown>): OperacionImagen => {
  const v = validarOperacion(x);
  assert.ok(v.ok, `la operación de prueba no valida: ${JSON.stringify(x)} → ${!v.ok ? v.motivo : ''}`);
  return v.op;
};
let contador = 0;
const nuevoId = () => `nuevo-${++contador}`;
const aplicar = (ops: Record<string, unknown>[], extra: Partial<Parameters<typeof aplicarOperaciones>[0]> = {}) =>
  aplicarOperaciones({ doc: diseno(), operaciones: ops.map(op), vista: VISTA, nuevoId, activePageId: 'pag-1', ...extra });

// ── La vista ─────────────────────────────────────────────────────────────────

test('1: la vista nombra cada cosa con su prefijo, y las refs no se corren cuando se agrega otro elemento', () => {
  const v = JSON.parse(VISTA.json);
  assert.equal(v.pagina_actual, pref('pag-1'));
  assert.match(ref('obj-titulo'), /^t[a-z0-9]{2,}$/);
  assert.match(ref('obj-caja'), /^f/);
  assert.match(ref('obj-foto'), /^i/);
  assert.match(pref('pag-2'), /^p/);
  const otro = diseno();
  otro.pages[0].objects.unshift({ type: 'rect', id: 'obj-nuevo-arriba', width: 10, height: 10 });
  const v2 = vistaDeDiseno(otro, { activePageId: 'pag-1' });
  for (const e of VISTA.elementos.values()) assert.equal(v2.elementos.get(e.ref)?.id, e.id, `«${e.ref}» cambió de dueño`);
  // La segunda página trae su tamaño porque no es el del diseño; la primera no.
  assert.deepEqual(v.paginas[1].tamano, { ancho: 1080, alto: 1920 });
  assert.equal(v.paginas[0].tamano, undefined);
});

test('2: dos mil ids no comparten ref (una colisión alarga la que viene después)', () => {
  const items = Array.from({ length: 2000 }, (_, i) => ({ id: `id-${i}`, prefijo: 't' }));
  const refs = refsDeIds(items);
  assert.equal(new Set(refs.values()).size, 2000);
  assert.ok([...refs.values()].some((r) => r.length > 3), 'con 2000 ids en 1296 refs de dos letras tiene que haber largas');
  assert.deepEqual(refsDeIds([...items].reverse()), refs, 'el orden de llegada no cambia las refs');
});

test('3: las medidas son las de la persona: la esquina de arriba a la izquierda y el tamaño con la escala', () => {
  const v = JSON.parse(VISTA.json);
  const caja = v.paginas[0].elementos.find((e: Obj) => e.ref === ref('obj-caja'));
  assert.deepEqual([caja.x, caja.y, caja.ancho, caja.alto], [340, 850, 400, 100]);
  const mayus = v.paginas[0].elementos.find((e: Obj) => e.ref === ref('obj-mayus'));
  assert.equal(mayus.tamano, 40, 'el tamaño de la letra lleva la escala');
  assert.equal(mayus.mayusculas, 'mayusculas');
  const titulo = v.paginas[0].elementos.find((e: Obj) => e.ref === ref('obj-titulo'));
  assert.deepEqual([titulo.fuente, titulo.negrita, titulo.texto], ['Archivo', true, 'Hola mundo']);
  assert.equal(v.paginas[0].elementos.find((e: Obj) => e.ref === ref('obj-foto')).bloqueado, true);
  const conElegidos = JSON.parse(vistaDeDiseno(diseno(), { elegidos: ['obj-titulo', 'no-existe'], fuentes: Array.from({ length: 40 }, (_, i) => `F${i}`) }).json);
  assert.deepEqual(conElegidos.elegidos, [ref('obj-titulo')]);
  assert.equal(conElegidos.fuentes_sugeridas.length, 30);
});

// ── El catálogo ──────────────────────────────────────────────────────────────

test('4: la validación rechaza lo que sobra o está fuera de rango (nunca lo recorta) y normaliza los colores', () => {
  assert.equal(validarOperacion({ op: 'mover', ref: 'f0z', x: 10, z: 3 }).ok, false, 'una clave inventada');
  assert.equal(validarOperacion({ op: 'volar', ref: 'f0z' }).ok, false);
  assert.equal(validarOperacion({ op: 'color', ref: 'f0z', color: 'rojo' }).ok, false);
  const c = validarOperacion({ op: 'color', ref: 'f0z', color: '#FD0' });
  assert.ok(c.ok && c.op.op === 'color' && c.op.color === '#ffdd00');
  assert.equal(validarOperacion({ op: 'agregar_texto', texto: 'Hola', ref: 'x1' }).ok, false, 'una ref nueva es n1, n2…');
  assert.equal(validarOperacion({ op: 'estilo_texto', ref: 't3k' }).ok, false, 'un estilo sin cambios');
  assert.equal(validarOperacion({ op: 'estilo_texto', ref: 't3k', tamano: 900 }).ok, false);
  assert.equal(validarOperacion({ op: 'estilo_texto', ref: 't3k', fuente: 'Inter"; x' }).ok, false);
  assert.equal(validarOperacion({ op: 'tamano', ref: 'f0z', escala: 50, ancho: 10 }).ok, false);
  assert.equal(validarOperacion({ op: 'fondo', color: '#000', pagina: 'f0z' }).ok, false, 'una página es p…');
  const { operaciones, descartes } = validarOperaciones(Array.from({ length: TOPES_CHAT_IMAGEN.operaciones + 5 }, () => ({ op: 'opacidad', ref: 'f0z', opacidad: 50 })));
  assert.equal(operaciones.length, TOPES_CHAT_IMAGEN.operaciones);
  assert.equal(descartes.length, 1);
  const prompt = catalogoParaPrompt();
  for (const o of OPERACIONES_CHAT_IMAGEN) assert.ok(prompt.includes(`"op":"${o.op}"`), o.op);
  assert.match(prompt, /NO SE PUEDE DESDE EL CHAT/);
});

// ── Aplicar ──────────────────────────────────────────────────────────────────

test('5: cambiar un texto respeta su caso como el motor, y el documento de entrada no se toca', () => {
  const entrada = diseno();
  const r = aplicarOperaciones({ doc: entrada, operaciones: [op({ op: 'cambiar_texto', ref: ref('obj-mayus'), texto: 'Nueva oferta' }), op({ op: 'cambiar_texto', ref: ref('obj-titulo'), texto: 'Chau' })], vista: VISTA, nuevoId, activePageId: 'pag-1' });
  const m = objDe(r.doc, 'obj-mayus');
  assert.deepEqual([m.text, m.caseSource], ['NUEVA OFERTA', 'Nueva oferta']);
  assert.equal(r.cambios[0].antes, 'oferta', 'lo de antes es lo que la persona escribió');
  assert.equal(objDe(r.doc, 'obj-titulo').text, 'Chau');
  assert.deepEqual(entrada, diseno(), 'aplicar trabaja sobre una copia');
  assert.equal(conCaso('save the date. hola', 'title'), 'Save The Date. Hola');
  assert.equal(conCaso('HOLA. CHAU', 'sentence'), 'Hola. Chau');
  // Sacar el caso devuelve lo escrito y no deja `textCase: 'none'` (como `toggleCase`).
  const sin = objDe(aplicar([{ op: 'estilo_texto', ref: ref('obj-mayus'), mayusculas: 'ninguno' }]).doc, 'obj-mayus');
  assert.deepEqual([sin.text, 'textCase' in sin, 'caseSource' in sin], ['oferta', false, false]);
});

test('6: el estilo lleva la escala al tamaño, y una fuente que el editor no tiene se descarta', () => {
  const fuente = (n: string) => (['montserrat', 'inter', 'archivo'].includes(n.toLowerCase()) ? n[0].toUpperCase() + n.slice(1).toLowerCase() : null);
  const r = aplicar([
    { op: 'estilo_texto', ref: ref('obj-mayus'), tamano: 60, fuente: 'montserrat', color: '#00ff00', alineacion: 'centro' },
    { op: 'estilo_texto', ref: ref('obj-titulo'), fuente: 'Fuente Inventada' },
  ], { fuente });
  const m = objDe(r.doc, 'obj-mayus');
  assert.deepEqual([m.fontSize, m.fontFamily, m.fill, m.textAlign], [30, '"Montserrat", sans-serif', '#00ff00', 'center']);
  assert.deepEqual(r.fuentes, ['Montserrat']);
  assert.match(r.descartes.join(), /Fuente Inventada/);
  assert.equal(objDe(r.doc, 'obj-titulo').fontFamily, '"Archivo", sans-serif');
});

test('7: agregar un texto lo centra por defecto, y su ref nueva sirve en el mismo pedido', () => {
  const r = aplicar([
    { op: 'agregar_texto', texto: 'Nuevo', ref: 'n1', tamano: 50 },
    { op: 'mover', ref: 'n1', y: 700 },
    { op: 'agregar_forma', forma: 'circulo', x: 10, y: 20, ancho: 100, alto: 100, ref: 'n2' },
    { op: 'color', ref: 'n2', color: '#123456' },
  ]);
  const nuevos = r.doc.pages[0].objects.slice(4);
  assert.equal(nuevos.length, 2);
  const [t, c] = nuevos;
  assert.deepEqual([t.type, t.text, t.left, t.top, t.width, t.fontSize], ['textbox', 'Nuevo', 162, 700, 756, 50]);
  assert.deepEqual([c.type, c.shapeKind, c.rx, c.ry, c.fill], ['ellipse', 'ellipse', 50, 50, '#123456']);
  assert.equal(r.aplicadas, 4);
  assert.deepEqual(r.cambios.map((x) => x.tipo), ['agrega', 'cambia', 'agrega', 'cambia']);
});

test('8: mover y cambiar el tamaño trabajan con la esquina de arriba a la izquierda, sea cual sea el origen', () => {
  const r = aplicar([{ op: 'mover', ref: ref('obj-caja'), x: 0, y: 0 }]);
  const caja = objDe(r.doc, 'obj-caja');
  assert.deepEqual([caja.left, caja.top], [200, 50]);
  assert.deepEqual(cajaDe(caja), { x: 0, y: 0, ancho: 400, alto: 100 });
  const t = objDe(aplicar([{ op: 'tamano', ref: ref('obj-caja'), ancho: 300 }]).doc, 'obj-caja');
  assert.deepEqual([t.scaleX, t.left, cajaDe(t).x, cajaDe(t).y], [1.5, 490, 340, 850]);
  // Una foto con UNA medida mantiene la proporción (primero se desbloquea).
  const f = objDe(aplicar([{ op: 'bloquear', ref: ref('obj-foto'), bloqueado: false }, { op: 'tamano', ref: ref('obj-foto'), ancho: 200 }]).doc, 'obj-foto');
  assert.deepEqual([f.scaleX, f.scaleY], [0.5, 0.5]);
  // Un texto con «escala» agranda la letra, no la caja de Fabric.
  const e = objDe(aplicar([{ op: 'tamano', ref: ref('obj-titulo'), escala: 150 }]).doc, 'obj-titulo');
  assert.deepEqual([e.fontSize, e.width, e.scaleX], [60, 900, 1]);
});

test('9: girar es sobre el centro', () => {
  const t = objDe(aplicar([{ op: 'rotar', ref: ref('obj-titulo'), grados: 90 }]).doc, 'obj-titulo');
  const a = (90 * Math.PI) / 180;
  const cx = (t.left as number) + 300 * Math.cos(a) - 24 * Math.sin(a);
  const cy = (t.top as number) + 300 * Math.sin(a) + 24 * Math.cos(a);
  assert.ok(Math.abs(cx - 400) < 0.2 && Math.abs(cy - 74) < 0.2, `el centro se corrió: ${cx}, ${cy}`);
  assert.equal(t.angle, 90);
});

test('10: lo bloqueado no se toca, y lo que ya no está se descarta con su motivo', () => {
  const r = aplicar([{ op: 'mover', ref: ref('obj-foto'), x: 5 }, { op: 'borrar', refs: [ref('obj-foto')] }]);
  assert.equal(r.aplicadas, 0);
  assert.deepEqual(r.descartes, ['Foto está bloqueado', 'Foto está bloqueado']);
  const sinTitulo = diseno();
  sinTitulo.pages[0].objects.shift();
  const r2 = aplicarOperaciones({ doc: sinTitulo, operaciones: [op({ op: 'color', ref: ref('obj-titulo'), color: '#000000' }), op({ op: 'color', ref: 'tzz', color: '#000000' })], vista: VISTA, nuevoId });
  assert.deepEqual(r2.descartes, ['«Hola mundo» ya no está', '«tzz» no está en el diseño']);
});

test('11: duplicar, cambiar el orden, alinear y borrar', () => {
  const r = aplicar([
    { op: 'duplicar', ref: ref('obj-caja'), dy: -200, nueva: 'n1' },
    { op: 'color', ref: 'n1', color: '#0000ff' },
    { op: 'capa', ref: ref('obj-titulo'), a: 'frente' },
    { op: 'alinear', refs: [ref('obj-titulo')], a: 'centro' },
    { op: 'borrar', refs: [ref('obj-mayus')] },
  ]);
  const ids = r.doc.pages[0].objects.map((o) => o.id);
  assert.equal(ids.length, 4);
  assert.equal(ids[ids.length - 1], 'obj-titulo', 'al frente es el último');
  assert.equal(ids.includes('obj-mayus'), false);
  const copia = r.doc.pages[0].objects[ids.indexOf('obj-caja') + 1];
  assert.match(String(copia.id), /^nuevo-/);
  assert.deepEqual([copia.top, copia.fill, objDe(r.doc, 'obj-caja').fill], [700, '#0000ff', '#ff0000']);
  assert.equal(objDe(r.doc, 'obj-titulo').left, 240);
});

test('12: las páginas: el fondo, una nueva con el tamaño de la de antes, una copia, y nunca menos de una', () => {
  const r = aplicar([
    { op: 'fondo', pagina: pref('pag-2'), color: '#F3EFE7' },
    { op: 'agregar_pagina', despues_de: pref('pag-2') },
    { op: 'agregar_pagina', despues_de: pref('pag-1'), duplicar: true },
  ]);
  assert.equal(r.doc.pages.length, 4);
  assert.deepEqual(r.doc.pages.map((p) => p.id).slice(0, 2), ['pag-1', r.doc.pages[1].id]);
  assert.equal(r.doc.pages[1].objects.length, 4, 'la copia lleva los elementos');
  assert.ok(r.doc.pages[1].objects.every((o) => /^nuevo-/.test(String(o.id))), 'con ids nuevos');
  assert.deepEqual(r.doc.pages[2].background, { type: 'solid', color: '#f3efe7' });
  assert.deepEqual([r.doc.pages[3].width, r.doc.pages[3].height, r.doc.pages[3].objects.length], [1080, 1920, 0]);
  assert.equal(r.pagina, r.doc.pages[1].id, 'se muestra la última página agregada');
  const b = aplicar([{ op: 'borrar_pagina', pagina: pref('pag-1') }, { op: 'borrar_pagina', pagina: pref('pag-2') }]);
  assert.deepEqual(b.doc.pages.map((p) => p.id), ['pag-2']);
  assert.deepEqual(b.descartes, ['un diseño se queda con al menos una página']);
});

test('13: con el alcance «lo elegido» sólo cambia lo elegido (y lo nuevo); las páginas no', () => {
  const r = aplicar([
    { op: 'color', ref: ref('obj-caja'), color: '#000000' },
    { op: 'color', ref: ref('obj-titulo'), color: '#ffffff' },
    { op: 'agregar_forma', forma: 'rectangulo', x: 0, y: 0, ancho: 10, alto: 10, ref: 'n1' },
    { op: 'color', ref: 'n1', color: '#00ff00' },
    { op: 'fondo', color: '#000000' },
  ], { soloRefs: new Set([ref('obj-titulo')]) });
  assert.equal(r.aplicadas, 3);
  assert.equal(objDe(r.doc, 'obj-caja').fill, '#ff0000');
  assert.equal(r.descartes.length, 2);
  assert.match(r.descartes[0], /no está en lo elegido/);
  assert.match(r.descartes[1], /es de la página/);
});

test('14: el resumen cuenta nuevos, cambios y quitados', () => {
  const r = aplicar([{ op: 'agregar_texto', texto: 'a' }, { op: 'opacidad', ref: ref('obj-titulo'), opacidad: 50 }, { op: 'borrar', refs: [ref('obj-caja'), ref('obj-mayus')] }]);
  assert.equal(resumenDeCambios(r.cambios), '1 nuevo · 1 cambia · 2 se quitan');
  assert.equal(objDe(r.doc, 'obj-titulo').opacity, 0.5);
});

// ── El hilo guardado ─────────────────────────────────────────────────────────

const PROP = { paginaId: 'pag-1', refs: [['t3k', 'obj-titulo']], paginas: [], elegidos: [], alcance: 'diseno', operaciones: [{ op: 'cambiar_texto', ref: 't3k', texto: 'Hola' }] };
const mako = (id: string, c: number, extra: Record<string, unknown> = {}) => ({ id, c, t: c, de: 'mako', texto: 'Listo.', ...extra });

test('15: el hilo se guarda saneado: lo que no se puede aceptar no queda pendiente, y un «aplicando» se cortó', () => {
  const r = hiloParaGuardar([
    mako('a', 1, { estado: 'pendiente', propuesta: { ...PROP, operaciones: [{ op: 'volar' }] } }),
    mako('b', 2, { estado: 'pendiente', propuesta: PROP, links: [{ texto: 'Ir', href: '/plan' }, { texto: 'Mal', href: '//otro.com' }, { texto: 'JS', href: 'javascript:alert(1)' }] }),
    { id: 'c', c: 3, t: 3, de: 'yo', texto: '' },
  ]) as Array<Extract<MensajeGuardado, { de: 'mako' }>>;
  assert.deepEqual(r.map((m) => [m.id, m.estado]), [['a', 'descartada'], ['b', 'pendiente']]);
  assert.deepEqual(r[1].links, [{ texto: 'Ir', href: '/plan' }]);
  const abierto = hiloAlAbrir([mako('d', 4, { estado: 'aplicando', propuesta: PROP })])[0] as Extract<MensajeGuardado, { de: 'mako' }>;
  assert.deepEqual([abierto.estado, abierto.aviso], ['descartada', AVISO_CORTADA]);
});

// ── El panel, con un editor de mentira ───────────────────────────────────────

function editorDeMentira(seleccion: string[] = []) {
  const log: string[] = [];
  let doc: unknown = diseno();
  const state = { selection: { ids: seleccion }, docVersion: 1, activePageId: 'pag-1' };
  const editor = {
    designId: `d-${++contador}`,
    state,
    getDocument: () => doc,
    applyDocument: (d: unknown, info: { label: string }) => { log.push(`aplicar:${info.label}`); doc = d; state.docVersion++; },
    fonts: { load: async (f: string, w: number) => { log.push(`fuente:${f}:${w}`); return true; } },
    stopEditingText: () => log.push('dejar-de-editar'),
    toast: (m: string) => log.push(`aviso:${m}`),
    undo: async () => { log.push('deshacer'); },
  };
  return { editor, log, doc: () => doc };
}

function fetchDeMentira(respuesta: unknown, pedidos: Array<{ url: string; cuerpo: Obj | null }>) {
  globalThis.fetch = (async (url: string, init?: { body?: string }) => {
    pedidos.push({ url, cuerpo: init?.body ? JSON.parse(init.body) : null });
    return { json: async () => (String(url).startsWith('/api/image-editor/ia') ? respuesta : { ok: false, sinTabla: true }) };
  }) as unknown as typeof fetch;
}

test('16: pedir SÓLO arma la propuesta; aceptar carga la fuente ANTES y aplica en un paso; restaurar deshace ese paso', async () => {
  const { editor, log, doc } = editorDeMentira([ 'obj-titulo' ]);
  const pedidos: Array<{ url: string; cuerpo: Obj | null }> = [];
  fetchDeMentira({ ok: true, resumen: 'Cambio el título.', operaciones: [{ op: 'estilo_texto', ref: ref('obj-titulo'), fuente: 'Montserrat' }, { op: 'cambiar_texto', ref: ref('obj-titulo'), texto: 'Nuevo título' }] }, pedidos);
  await pedirEdicion(editor as never, 'cambia el título', 'seleccion');
  assert.equal(log.filter((l) => l.startsWith('aplicar')).length, 0, 'pedir no toca el diseño');
  const ia = pedidos.find((p) => p.url === '/api/image-editor/ia')!;
  assert.equal(ia.cuerpo!.alcance, 'seleccion');
  assert.deepEqual(JSON.parse(String(ia.cuerpo!.diseno)).elegidos, [ref('obj-titulo')]);
  const m = leerHilo(editor.designId).mensajes.at(-1) as MensajeMako;
  assert.equal(m.estado, 'pendiente');
  assert.deepEqual(m.cambios!.map((c) => c.titulo), ['Estilo de «Hola mundo»', 'Texto']);
  assert.equal(objDe(doc(), 'obj-titulo').text, 'Hola mundo');

  await aceptarPropuesta(editor as never, m);
  const primeraFuente = log.findIndex((l) => l.startsWith('fuente:Montserrat'));
  const aplicado = log.indexOf('aplicar:MaKo IA');
  assert.ok(primeraFuente >= 0 && aplicado > primeraFuente, `la fuente va antes: ${log.join(' → ')}`);
  assert.equal(log.filter((l) => l.startsWith('aplicar')).length, 1, 'un solo paso de deshacer');
  assert.equal(objDe(doc(), 'obj-titulo').text, 'Nuevo título');
  const aplicada = leerHilo(editor.designId).mensajes.at(-1) as MensajeMako;
  assert.equal(aplicada.estado, 'aplicada');

  restaurarPropuesta(editor as never, aplicada);
  assert.ok(log.includes('deshacer'));
  assert.equal((leerHilo(editor.designId).mensajes.at(-1) as MensajeMako).estado, 'restaurada');
});

test('17: después de otro cambio, «Restaurar» no deshace lo que no es suyo: avisa Ctrl+Z', async () => {
  const { editor, log } = editorDeMentira();
  fetchDeMentira({ ok: true, resumen: '', operaciones: [{ op: 'opacidad', ref: ref('obj-caja'), opacidad: 40 }] }, []);
  await pedirEdicion(editor as never, 'más transparente', 'diseno');
  const m = leerHilo(editor.designId).mensajes.at(-1) as MensajeMako;
  await aceptarPropuesta(editor as never, m);
  editor.state.docVersion++; // la persona movió algo después
  restaurarPropuesta(editor as never, leerHilo(editor.designId).mensajes.at(-1) as MensajeMako);
  assert.equal(log.includes('deshacer'), false);
  assert.ok(log.includes('aviso:Deshazlo con Ctrl+Z'));
});

test('18: aceptar sobre un diseño que cambió aplica por id, y si ya nada se puede, no aplica y lo dice', async () => {
  const { editor, log } = editorDeMentira();
  fetchDeMentira({ ok: true, resumen: '', operaciones: [{ op: 'color', ref: ref('obj-caja'), color: '#000000' }] }, []);
  await pedirEdicion(editor as never, 'caja negra', 'diseno');
  const m = leerHilo(editor.designId).mensajes.at(-1) as MensajeMako;
  // Mientras tanto, la caja se borró.
  const sinCaja = diseno();
  sinCaja.pages[0].objects.splice(1, 1);
  editor.getDocument = () => sinCaja;
  await aceptarPropuesta(editor as never, m);
  const despues = leerHilo(editor.designId).mensajes.at(-1) as MensajeMako;
  assert.equal(despues.estado, 'pendiente');
  assert.match(String(despues.aviso), /Ya no se puede aplicar/);
  assert.equal(log.filter((l) => l.startsWith('aplicar')).length, 0);
});

test('19: un pedido que no deja nada para aplicar no queda como propuesta', async () => {
  const { editor } = editorDeMentira();
  fetchDeMentira({ ok: true, resumen: 'No puedo quitar el fondo de la foto.', operaciones: [] }, []);
  await pedirEdicion(editor as never, 'quita el fondo de la foto', 'diseno');
  const m = leerHilo(editor.designId).mensajes.at(-1) as MensajeMako;
  assert.deepEqual([m.texto, m.estado, m.propuesta], ['No puedo quitar el fondo de la foto.', undefined, undefined]);
  // El store guarda los mensajes nuevos con id y hora.
  cambiarHilo(editor.designId, (h) => ({ ...h, mensajes: [...h.mensajes, conId({ de: 'yo', texto: 'otra', alcance: null })] }));
  assert.equal(leerHilo(editor.designId).mensajes.length, 3);
});

// ── Lo que no se ve en la pantalla ───────────────────────────────────────────

test('20: en el código, pedir no aplica y aplicar se llama en UN lugar, después de las fuentes', () => {
  const src = leer('app/image-editor/mako/chat/acciones.ts');
  const pedir = src.slice(src.indexOf('export async function pedirEdicion'), src.indexOf('export async function aceptarPropuesta'));
  assert.ok(pedir.length > 500, 'no encontré pedirEdicion');
  assert.doesNotMatch(pedir, /applyDocument|\.undo\(/);
  assert.equal((src.match(/editor\.applyDocument\(/g) ?? []).length, 1);
  const aceptar = src.slice(src.indexOf('export async function aceptarPropuesta'));
  assert.ok(aceptar.indexOf('editor.fonts.load(') < aceptar.indexOf('editor.applyDocument('));
  const panel = leer('app/image-editor/mako/chat/PanelMakoIA.tsx');
  assert.match(panel, /onAceptar=\{\(\) => void aceptarPropuesta\(editorRef\.current, m\)\}/);
  assert.doesNotMatch(panel, /applyDocument/);
});

test('21: la ruta pide el workspace ANTES de la IA, y el modelo es GRATIS con Claude sin permiso', () => {
  const ruta = leer('app/api/image-editor/ia/route.ts');
  const puerta = ruta.indexOf('await puerta()');
  assert.ok(puerta > 0 && ruta.indexOf('editarImagen(') > puerta);
  assert.match(ruta, /runWithWorkspace\(p\.ws/);
  const fila = crudo('lib/model-catalogo.ts').split('\n').find((l) => l.includes("feature: 'image-editor-ia'"));
  assert.ok(fila, 'falta la fila de image-editor-ia en lib/model-catalogo.ts');
  assert.match(fila!, /def: GEMINI\(\)/);
  assert.doesNotMatch(fila!, /pagoPorque|fallback:/);
  assert.doesNotMatch(leer('lib/veto-claude.ts'), /image-editor-ia/);
  assert.match(leer('lib/image-editor/chat/ia.ts'), /FEATURE_CHAT_IMAGEN = 'image-editor-ia'/);
});

test('22: las keys y los slots del prompt son los del registro editable', () => {
  const reg = leer('lib/prompt-registry.ts');
  for (const { key } of Object.values(PROMPTS_CHAT_IMAGEN)) assert.ok(reg.includes(`key: '${key}'`), key);
  for (const slot of ['catalogo', 'formato']) assert.ok(CHAT_IMAGEN_SYSTEM_TEMPLATE.includes(`{{${slot}}}`), slot);
  for (const slot of ['instruccion', 'alcance', 'diseno']) assert.ok(CHAT_IMAGEN_USER_TEMPLATE.includes(`{{${slot}}}`), slot);
  const ia = leer('lib/image-editor/chat/ia.ts');
  assert.match(ia, /renderPrompt\(PROMPTS_CHAT_IMAGEN\.system\.key, CHAT_IMAGEN_SYSTEM_TEMPLATE/);
  assert.match(ia, /renderPrompt\(PROMPTS_CHAT_IMAGEN\.user\.key, CHAT_IMAGEN_USER_TEMPLATE/);
  assert.match(CHAT_IMAGEN_SYSTEM_TEMPLATE, /PROHIBIDO INVENTAR/);
  assert.match(CHAT_IMAGEN_SYSTEM_TEMPLATE, /sin voseo/);
});

test('23: la tabla del hilo es por persona y diseño, sin workspace por omisión, y está en los dos registros', () => {
  const sql = crudo('supabase/migrations/0303_image_editor_chats.sql');
  assert.match(sql, /create table if not exists image_editor_chats/);
  assert.match(sql, /primary key \(workspace_id, persona, diseno_id\)/);
  assert.match(sql, /workspace_id\s+bigint not null references workspaces\(id\) on delete cascade,/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on image_editor_chats from anon, authenticated/);
  assert.ok(TABLAS_DE_INQUILINO.includes('image_editor_chats'));
  assert.match(leer('lib/workspace.ts'), /'image_editor_chats'/);
  const server = leer('lib/image-editor/chat/hilo-server.ts');
  assert.match(server, /e\?\.code === 'PGRST205' \|\| e\?\.code === '42P01'/);
  const chat = leer('app/api/image-editor/chat/route.ts');
  assert.match(chat, /personaDeSesion\(sesion\)/);
  assert.doesNotMatch(chat, /body\.persona/, 'la persona sale de la sesión');
});

test('24: el botón redondo del riel abre el chat (ya no es «Próximamente»), y en pantallas chicas va en la tira', () => {
  const riel = leer('app/image-editor/_doory/editor/chrome/RielCanva.tsx');
  assert.doesNotMatch(riel, /aria-disabled|t\.rail\.soon/);
  assert.match(riel, /toggle\(ia\.id\)/);
  const barra = leer('app/image-editor/_doory/editor/TopBar.tsx');
  assert.match(barra, /p\.id === PANEL_IA/);
  assert.match(barra, /const tools = rail\.length > 0 \? \[\.\.\.rail, \.\.\.ia\] : all/);
  const registro = leer('app/image-editor/mako/registro.ts');
  assert.match(registro, /id: PANEL_IA,[\s\S]*component: PanelMakoIA,[\s\S]*requires: \(\{ state \}\) => !state\.readOnly/);
});

// ─────────────────────────────────────────────────────────────────────────────
// PROBADO ROMPIÉNDOLO (16/10/2026, node --test con tsx; base 24/0). Cuarenta roturas, una por vez, y las cuarenta
// cayeron (23/1 salvo donde se dice):
//   vista: refs por posición (1), refs repetidas sin alargar (2), la caja sin la escala (3 y 8: 22/2), sin «elegidos»
//   (3 y 16: 22/2), la letra sin la escala (3);
//   catálogo: una clave inventada que pasa (4), «#FD0» sin normalizar (4);
//   aplicar: el texto sin su caso (5), sobre el original (5 y 16: 22/2), sacar el caso deja `none` (5), la letra sin la
//   escala (6), la fuente sin revisar (6), el texto nuevo sin centrar (7), su ref nueva sin anotar (7), mover sin el
//   origen (8), la foto sin proporción (8), girar sin recentrar (9), lo bloqueado se toca (10), la copia con los mismos
//   ids (11), la copia sin anotar su ref (11), «frente» al fondo (11), la página en blanco sin tamaño (12), borrar la
//   última página (12), el alcance «lo elegido» ignorado (13);
//   hilo: pendiente sin propuesta (15), un link de afuera (15), «aplicando» que vuelve igual (15);
//   panel: pedir que aplica (16, 18 y 20: 21/3), aceptar sin cargar la fuente (16), restaurar sin mirar la versión
//   (17), lo que no deja nada queda pendiente (19), el alcance siempre el diseño (16);
//   lo demás: el modelo con `pagoPorque` (21), el slot renombrado (22), la PK sin persona (23), fuera del registro de
//   inquilinos (23), cualquier error como «sin tabla» (23), el botón del riel sin abrir (24), la tira sin el chat (24,
//   cazada después de agregar su línea: la primera versión del test sólo miraba que `PANEL_IA` se nombrara), el chat
//   también en sólo lectura (24).
// ─────────────────────────────────────────────────────────────────────────────
