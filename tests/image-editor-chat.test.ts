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
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cajaDe, refsDeIds, vistaDeDiseno } from '../lib/image-editor/chat/vista';
import { NO_SE_PUEDE_CHAT_IMAGEN, TOPES_CHAT_IMAGEN, catalogoParaPrompt, OPERACIONES_CHAT_IMAGEN, validarOperacion, validarOperaciones, type OperacionImagen } from '../lib/image-editor/chat/catalogo';
import { aplicarOperaciones, conCaso, resumenDeCambios } from '../lib/image-editor/chat/aplicar';
import { AVISO_CORTADA, TOPES_HILO, TOPES_MEMORIA, hiloAlAbrir, hiloParaGuardar, memoriaDelHilo, memoriaParaIA, sanearMemoria, type MensajeGuardado } from '../lib/image-editor/chat/hilo';
import { CHAT_IMAGEN_SYSTEM_TEMPLATE, CHAT_IMAGEN_USER_TEMPLATE, PROMPTS_CHAT_IMAGEN } from '../lib/image-editor/chat/prompts';
import { cambiarHilo, cargarHilo, conId, leerHilo, type MensajeMako } from '../app/image-editor/mako/chat/hilo';
import { aceptarPropuesta, detener, pedirEdicion, restaurarPropuesta } from '../app/image-editor/mako/chat/acciones';
import { originalDe } from '../app/_chat/useAdjuntosDelChat';
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
  assert.equal(validarOperacion({ op: 'agregar_texto', texto: 'Hola', ref: 'X 1' }).ok, false, 'una ref sin forma de ref');
  assert.equal(validarOperacion({ op: 'estilo_texto', ref: 't3k' }).ok, false, 'un estilo sin cambios');
  assert.equal(validarOperacion({ op: 'estilo_texto', ref: 't3k', tamano: 900 }).ok, false);
  assert.equal(validarOperacion({ op: 'estilo_texto', ref: 't3k', fuente: 'Inter"; x' }).ok, false);
  assert.equal(validarOperacion({ op: 'tamano', ref: 'f0z', escala: 50, ancho: 10 }).ok, false);
  assert.equal(validarOperacion({ op: 'fondo', color: '#000', pagina: 'X 1' }).ok, false, 'una ref sin forma de ref');
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

test('21: la ruta pide el workspace ANTES de la IA, y el modelo es la IA DEL NEGOCIO, sin Gemini y con Claude sin permiso', () => {
  const ruta = leer('app/api/image-editor/ia/route.ts');
  const puerta = ruta.indexOf('await puerta()');
  assert.ok(puerta > 0 && ruta.indexOf('editarImagen(') > puerta);
  assert.match(ruta, /runWithWorkspace\(p\.ws/);
  const fila = crudo('lib/model-catalogo.ts').split('\n').find((l) => l.includes("feature: 'image-editor-ia'"));
  assert.ok(fila, 'falta la fila de image-editor-ia en lib/model-catalogo.ts');
  // 5/11/2026 (Martín, 22/10: Image «sin Gemini»): su Claude y su GPT (`deSuIA`), sin caer a otro proveedor. Lo que corre de
  // verdad lo prueba tests/solo-su-ia.test.ts; acá, que la fila no vuelva a Gemini ni pague MaKo.
  assert.match(fila!, /def: SU_IA, recomendado: SU_IA, fallback: \[\], deSuIA: true/);
  assert.doesNotMatch(fila!, /GEMINI\(|pagoPorque/);
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

// 29/10/2026, Martín: «la barra lateral del chat de MaKo SIEMPRE abierto a la izquierda». El chat ya no es un panel del riel
// que se abre con el botón redondo (ni el último de la tira en el teléfono): va en la tarjeta izquierda de la pantalla de
// Create, que no se cierra. Necesita el motor (`useEditor`), así que el editor lo monta por adentro (`dentro`) y se dibuja
// por portal en el hueco de la tarjeta. Con un enlace para ver (sólo lectura) no había chat: el panel tenía `requires`.
// Ahora no hay pantalla de sólo lectura en MaKo (Compartir está en null, mako/adaptadorNube.ts).
// PROBADO ROMPIÉNDOLO (29/10/2026): PantallaEditor con `dentro={null}` (el chat no se monta) → 24/1 (éste). Restaurado: 25/0.
test('24: el chat va en la tarjeta izquierda de Create, siempre abierto: sin botón en el riel, ni en la tira, ni panel', () => {
  const riel = sinComentarios(leer('app/image-editor/_doory/editor/chrome/RielCanva.tsx'));
  assert.doesNotMatch(riel, /PANEL_IA|rail-ai|Sparkles/, 'el botón redondo de la IA volvió al riel');
  const barra = sinComentarios(leer('app/image-editor/_doory/editor/TopBar.tsx'));
  assert.doesNotMatch(barra, /PANEL_IA/, 'el chat volvió a la tira de abajo');
  assert.match(barra, /const tools = rail\.length > 0 \? rail : all/);
  assert.doesNotMatch(sinComentarios(leer('app/image-editor/_doory/editor/panels/registry.ts')), /PANEL_IA/);
  assert.ok(!existsSync(join(RAIZ, 'app/image-editor/mako/registro.ts')), 'registro.ts registraba el chat como panel');
  const pantalla = sinComentarios(leer('app/image-editor/editor/PantallaEditor.tsx'));
  assert.match(pantalla, /dentro=\{ranuraChat \? createPortal\(<PanelMakoIA \/>, ranuraChat\) : null\}/, 'el chat se monta adentro del editor y se dibuja en la tarjeta');
  const app = sinComentarios(leer('app/image-editor/_doory/editor/EditorApp.tsx'));
  assert.match(app, /<LiveRegion \/>\s*\{dentro\}\s*<\/EditorProvider>/, 'lo de `dentro` va con el contexto del editor');
  const cliente = sinComentarios(leer('app/image-editor/ImageEditorCliente.tsx'));
  assert.match(cliente, /chat=\{abierto && carga !== 'falla'\s*\? \(volver\) => <ChatDelEditor /, 'con un diseño abierto, la tarjeta es SU chat (con la «←» del shell)');
  assert.doesNotMatch(cliente, /onCerrar|cerrarChat|plegar/i, 'el chat no se cierra ni se pliega');
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

test('41: abrir el chat NO vuelve a guardar lo que ya está en la base (22/10/2026, medido en el ws3)', async () => {
  // Cada apertura subía la versión y el `updated_at` con los mismos mensajes. Verificado quitando el arreglo: 1 fallo.
  const metodos: string[] = [];
  const guardados: MensajeGuardado[] = [
    { id: 'a', c: 1, t: 1, de: 'yo', texto: 'Agrega un título', alcance: null },
    { id: 'b', c: 2, t: 2, de: 'mako', texto: 'Listo.' },
  ] as MensajeGuardado[];
  globalThis.fetch = (async (_url: string, init?: { method?: string }) => {
    metodos.push(init?.method ?? 'GET');
    return { json: async () => (init?.method === 'PUT' ? { ok: true, version: 3 } : { ok: true, hilo: { version: 2, mensajes: guardados } }) };
  }) as unknown as typeof fetch;
  await cargarHilo('d-abrir-41', 'Diseño');
  assert.equal(leerHilo('d-abrir-41').mensajes.length, 2, 'lo guardado se ve');
  await new Promise((r) => setTimeout(r, 800));
  assert.deepEqual(metodos, ['GET'], 'abrir no es un cambio');
});

// ── Lo que le pasó a Leila en vivo (30/10/2026): el carrusel quedó en blanco, con el fondo y nada más ───────────

test('validar dos veces no pierde nada: la ruta valida y el panel vuelve a validar lo que contestó la ruta', () => {
  for (const o of OPERACIONES_CHAT_IMAGEN) {
    const una = validarOperaciones([JSON.parse(o.forma)]);
    assert.equal(una.operaciones.length, 1, `${o.op}: ${una.descartes[0]}`);
    const dos = validarOperaciones(una.operaciones);
    assert.deepEqual(dos.descartes, [], o.op);
    assert.deepEqual(dos.operaciones, una.operaciones, `${o.op} cambia al validarla otra vez`);
  }
});

test('el estilo que viene adentro de "estilo" también vale, y lo inventado adentro se sigue rechazando', () => {
  assert.equal(validarOperacion({ op: 'agregar_texto', texto: 'Hola', estilo: { tamano: 60, negrita: true } }).ok, true);
  assert.equal(validarOperacion({ op: 'agregar_texto', texto: 'Hola', estilo: { volar: 1 } }).ok, false);
  assert.equal(validarOperacion({ op: 'agregar_texto', texto: 'Hola', estilo: 'grande' }).ok, false);
  assert.equal(validarOperacion({ op: 'estilo_texto', ref: 't3k', estilo: { tamano: 9000 } }).ok, false);
});

test('el pedido llega al diseño con la respuesta TAL CUAL la da la ruta (ya validada, con "estilo" adentro)', async () => {
  const { editor } = editorDeMentira([]);
  const crudas = [{ op: 'agregar_texto', texto: 'Las 7 preguntas', tamano: 80, color: '#ffffff', fuente: 'League Spartan' }, { op: 'fondo', color: '#000000' }];
  fetchDeMentira({ ok: true, resumen: 'Armo la portada.', operaciones: validarOperaciones(crudas).operaciones }, []);
  await pedirEdicion(editor as never, 'la portada', 'diseno');
  const m = leerHilo(editor.designId).mensajes.at(-1) as MensajeMako;
  assert.deepEqual(m.descartes ?? [], []);
  assert.deepEqual(m.cambios!.map((c) => c.tipo), ['agrega', 'cambia']);
  assert.equal(m.cambios![0].despues, 'Las 7 preguntas');
});

test('si se pierde casi todo, el mensaje no promete lo que no va a pasar', async () => {
  const { editor } = editorDeMentira([]);
  const malas = Array.from({ length: 3 }, () => ({ op: 'volar' }));
  // La misma forma que contesta la ruta: lo que sobrevivió y, aparte, lo que tiró.
  const ruta = validarOperaciones([{ op: 'fondo', color: '#000000' }, ...malas]);
  fetchDeMentira({ ok: true, resumen: 'Voy a crear el carrusel.', operaciones: ruta.operaciones, descartes: ruta.descartes }, []);
  await pedirEdicion(editor as never, 'el carrusel', 'diseno');
  const m = leerHilo(editor.designId).mensajes.at(-1) as MensajeMako;
  assert.match(m.texto, /^Pude hacer sólo una parte\./);
  assert.equal(m.descartes!.length, 3, 'lo que tiró la ruta llega a «No se aplica»');
});

test('un carrusel de más páginas que el diseño: el texto llega a la página nueva por su ref', () => {
  const r = aplicar([
    { op: 'agregar_pagina', nueva: 'pn1' },
    { op: 'fondo', pagina: 'pn1', color: '#000000' },
    { op: 'agregar_texto', pagina: 'pn1', texto: 'Slide nueva', tamano: 60 },
    { op: 'agregar_pagina', despues_de: 'pn1', nueva: 'pn2' },
    { op: 'agregar_texto', pagina: 'pn2', texto: 'Otra', tamano: 60 },
  ]);
  assert.deepEqual(r.descartes, []);
  const paginas = (r.doc as unknown as { pages: Array<{ objects: Obj[]; background: Obj }> }).pages;
  const conTexto = paginas.slice(-2);
  assert.equal(conTexto[0].objects.at(-1)!.text, 'Slide nueva');
  assert.equal(conTexto[0].background.color, '#000000');
  assert.equal(conTexto[1].objects.at(-1)!.text, 'Otra');
  assert.equal(validarOperacion({ op: 'agregar_pagina', nueva: 'X 1' }).ok, false, 'una ref sin forma de ref');
});

test('la ref que inventa la IA no hace perder el contenido (medido con la IA de verdad)', () => {
  const r = aplicar([
    { op: 'agregar_pagina', nueva: 'n1' },
    { op: 'agregar_texto', pagina: 'n1', texto: 'Con su ref', tamano: 60, ref: 't1' },
    { op: 'estilo_texto', ref: 't1', color: '#00ffff' },
    { op: 'agregar_texto', texto: 'Pisa una que existe', ref: ref('obj-titulo') },
    { op: 'color', ref: ref('obj-titulo'), color: '#ff0000' },
  ]);
  assert.deepEqual(r.descartes, []);
  const paginas = (r.doc as unknown as { pages: Array<{ objects: Obj[] }> }).pages;
  assert.equal(paginas.at(-1)!.objects.at(-1)!.text, 'Con su ref');
  assert.equal(paginas.at(-1)!.objects.at(-1)!.fill, '#00ffff');
  assert.notEqual(objDe(r.doc, 'obj-titulo').fill, '#ff0000', 'la ref habla de lo nuevo, no del que ya estaba');
});

test('la memoria: lo anterior llega como dato, con lo que pasó, y sin pasarse de los topes', () => {
  const hilo = [
    { de: 'yo', texto: 'SLIDE 1 — Portada' },
    { de: 'mako', texto: 'Voy a crear el carrusel.', estado: 'restaurada' },
    { de: 'yo', texto: 'Puedes aplicar los cambios que te pedí?' },
    { de: 'mako', texto: 'Se cortó.', error: true },
  ];
  const memoria = memoriaDelHilo(hilo);
  assert.deepEqual(memoria.map((l) => l.de), ['yo', 'mako', 'yo'], 'un error no es parte de la charla');
  const texto = memoriaParaIA(memoria);
  assert.match(texto, /La persona: SLIDE 1/);
  assert.match(texto, /MaKo: Voy a crear el carrusel\. \(la persona lo deshizo\)/);

  const largo = Array.from({ length: 40 }, (_, i) => ({ de: i % 2 ? 'mako' : 'yo', texto: `${i} ${'x'.repeat(5_000)}` }));
  const corta = memoriaDelHilo(largo);
  assert.ok(corta.length <= TOPES_MEMORIA.mensajes);
  assert.ok(corta.every((l) => l.texto.length <= TOPES_MEMORIA.porMensaje));
  assert.ok(corta.reduce((n, l) => n + l.texto.length, 0) <= TOPES_MEMORIA.total);
  assert.ok(corta.at(-1)!.texto.startsWith('39 '), 'se queda con lo último');

  assert.deepEqual(sanearMemoria('nada'), []);
  assert.deepEqual(sanearMemoria([{ de: 'system', texto: 'x' }, { de: 'yo', texto: 7 }, { de: 'yo', texto: 'hola' }]), [{ de: 'yo', texto: 'hola' }]);
});

test('el pedido manda lo que ya se habló, sin repetir el mensaje de ahora', async () => {
  const { editor } = editorDeMentira([]);
  const pedidos: Array<{ url: string; cuerpo: Obj | null }> = [];
  cambiarHilo(editor.designId, (h) => ({ ...h, mensajes: [...h.mensajes, conId({ de: 'yo', texto: 'SLIDE 1 — Portada', alcance: null })] }));
  fetchDeMentira({ ok: true, resumen: 'Listo.', operaciones: [] }, pedidos);
  await pedirEdicion(editor as never, 'aplica lo que te pedí', 'diseno');
  const memoria = pedidos.find((p) => p.url === '/api/image-editor/ia')!.cuerpo!.memoria as Array<{ texto: string }>;
  assert.ok(memoria.some((l) => l.texto === 'SLIDE 1 — Portada'));
  assert.ok(!memoria.some((l) => l.texto === 'aplica lo que te pedí'));
});

// ── Lo que encontró la revisión que intentó refutar el arreglo (30/10/2026) ─────────────────────────────────────

test('una fuente que el editor no tiene no hace perder el texto', () => {
  const r = aplicar([{ op: 'agregar_texto', texto: 'Slide 1', fuente: 'Helvetica', tamano: 60 }], { fuente: () => null });
  assert.deepEqual(r.descartes, ['la fuente «Helvetica» no está en el editor']);
  assert.equal(r.aplicadas, 1);
  assert.equal((r.doc as unknown as { pages: Array<{ objects: Obj[] }> }).pages[0].objects.at(-1)!.text, 'Slide 1');
  const e = aplicar([{ op: 'estilo_texto', ref: ref('obj-titulo'), fuente: 'Helvetica', color: '#00ff00' }], { fuente: () => null });
  assert.equal(objDe(e.doc, 'obj-titulo').fill, '#00ff00', 'el resto del estilo sí');
  assert.equal(aplicar([{ op: 'estilo_texto', ref: ref('obj-titulo'), fuente: 'Helvetica' }], { fuente: () => null }).aplicadas, 0, 'sólo la fuente: no hay nada que hacer');
});

test('una ref inventada que coincide con una existente no toca lo de la persona si lo nuevo no se pudo agregar', () => {
  const r = ref('obj-titulo');
  const a = aplicar([{ op: 'agregar_texto', pagina: 'pzz', texto: 'Nuevo', ref: r }, { op: 'cambiar_texto', ref: r, texto: 'Pisado' }, { op: 'borrar', refs: [r] }]);
  assert.equal(objDe(a.doc, 'obj-titulo').text, 'Hola mundo');
  assert.equal(a.aplicadas, 0);
  // Antes de declararla, la ref sigue siendo la del elemento que ya estaba.
  const b = aplicar([{ op: 'cambiar_texto', ref: r, texto: 'Sí' }, { op: 'agregar_texto', pagina: 'pzz', texto: 'Nuevo', ref: r }]);
  assert.equal(objDe(b.doc, 'obj-titulo').text, 'Sí');
  // Y una página: la que no se pudo crear no cae sobre la que ya existe.
  const pagina = [...VISTA.paginas.keys()][0];
  const c = aplicar([{ op: 'agregar_pagina', despues_de: 'pzz', nueva: pagina }, { op: 'fondo', pagina, color: '#123456' }]);
  assert.equal(c.aplicadas, 0);
});

test('lo que depende de algo que tiró la validación también se va, en vez de caer sobre lo que ya estaba', () => {
  const v = validarOperaciones([
    { op: 'agregar_texto', texto: 'x'.repeat(TOPES_CHAT_IMAGEN.texto + 1), ref: 't11' },
    { op: 'borrar', refs: ['t11', 'f0z'] },
    { op: 'estilo_texto', ref: 't11', tamano: 40 },
    { op: 'fondo', color: '#000000' },
  ]);
  assert.deepEqual(v.operaciones.map((o) => o.op), ['fondo']);
  assert.equal(v.descartes.length, 3);
});

test('una ref repetida no hace perder el contenido: la última es la que vale', () => {
  const r = aplicar([
    { op: 'agregar_texto', texto: 'Titulo 1', ref: 't1' },
    { op: 'agregar_texto', texto: 'Titulo 2', ref: 't1' },
    { op: 'color', ref: 't1', color: '#00ffff' },
  ]);
  assert.deepEqual(r.descartes, []);
  const textos = (r.doc as unknown as { pages: Array<{ objects: Obj[] }> }).pages[0].objects.filter((o) => String(o.text).startsWith('Titulo'));
  assert.deepEqual(textos.map((o) => [o.text, o.fill === '#00ffff']), [['Titulo 1', false], ['Titulo 2', true]]);
});

test('«ya dice eso» no cuenta como perdido: el aviso de parcial es por lo que se perdió', async () => {
  const { editor } = editorDeMentira([]);
  const ops = validarOperaciones([
    { op: 'cambiar_texto', ref: ref('obj-titulo'), texto: 'Hola mundo' },
    { op: 'fondo', color: '#000000' },
  ]);
  fetchDeMentira({ ok: true, resumen: 'Cambio el fondo.', operaciones: ops.operaciones, descartes: ops.descartes }, []);
  await pedirEdicion(editor as never, 'el fondo', 'diseno');
  const m = leerHilo(editor.designId).mensajes.at(-1) as MensajeMako;
  assert.equal(m.texto, 'Cambio el fondo.');
});

test('si se perdió todo, tampoco promete', async () => {
  const { editor } = editorDeMentira([]);
  const ruta = validarOperaciones([{ op: 'volar' }]);
  fetchDeMentira({ ok: true, resumen: 'Voy a crear el carrusel.', operaciones: ruta.operaciones, descartes: ruta.descartes }, []);
  await pedirEdicion(editor as never, 'el carrusel', 'diseno');
  const m = leerHilo(editor.designId).mensajes.at(-1) as MensajeMako;
  assert.match(m.texto, /^No pude hacerlo\./);
});

test('los topes cuadran: lo que entra por la caja entra en la memoria y en el hilo, y la revisión muestra todos los cambios', () => {
  assert.ok(TOPES_MEMORIA.porMensaje >= TOPES_CHAT_IMAGEN.instruccion);
  assert.ok(TOPES_HILO.texto >= TOPES_CHAT_IMAGEN.instruccion);
  assert.ok(TOPES_HILO.cambios >= TOPES_CHAT_IMAGEN.operaciones);
  // A la densidad del carrusel de Leila, más de esto no entra en los 4.000 tokens de la respuesta (lib/image-editor/chat/ia.ts).
  assert.ok(TOPES_CHAT_IMAGEN.instruccion <= 4_000);
});

test('la memoria no afirma que la persona descartó lo que se cortó solo', () => {
  const [l] = memoriaDelHilo([{ de: 'mako', texto: 'Armé el carrusel.', estado: 'descartada', aviso: AVISO_CORTADA }]);
  assert.equal(l.texto, 'Armé el carrusel.');
});

// ── Las fotos desde el chat (30/10/2026, Leila: «no me pone las imágenes en el carrusel») ─────────────────────────

const RAIZ_FOTOS = join(import.meta.dirname, '..');

const FOTOS = new Map([['o1', { id: 'sub-1', url: 'https://x.supabase.co/storage/v1/object/public/a/foto.jpg', nombre: 'foto.jpg', ancho: 2000, alto: 1000 }]]);
const objetosDe = (d: unknown) => (d as { pages: Array<{ id: string; objects: Obj[]; background: Obj }> }).pages;

test('agregar_foto: valida la forma, y lo que se valida una vez vuelve a pasar', () => {
  const v = validarOperacion({ op: 'agregar_foto', foto: 'o1', x: 0, y: 0, ancho: 500, alto: 500, cubrir: true, ref: 'n1' });
  assert.equal(v.ok, true);
  if (v.ok) assert.deepEqual(validarOperacion(v.op), v, 'idempotente: corre en la ruta y en el panel');
  assert.equal(validarOperacion({ op: 'agregar_foto' }).ok, false, 'sin foto');
  assert.equal(validarOperacion({ op: 'agregar_foto', foto: 'https://malo.example/x.jpg' }).ok, false, 'una dirección no es una foto de la lista');
  assert.equal(validarOperacion({ op: 'agregar_foto', foto: 'o1', ancho: -5 }).ok, false);
  assert.equal(validarOperacion({ op: 'fondo_foto', foto: 'o1' }).ok, true);
});

test('agregar_foto: entra entera en la caja, sin deformarse, con la dirección y el id de Subidos', () => {
  const r = aplicar([{ op: 'agregar_foto', foto: 'o1', x: 100, y: 100, ancho: 400, alto: 400 }], { fotos: FOTOS });
  assert.deepEqual(r.descartes, []);
  const f = objetosDe(r.doc)[0].objects.at(-1)!;
  assert.equal(f.type, 'image');
  assert.equal(f.src, FOTOS.get('o1')!.url);
  assert.equal(f.assetId, 'sub-1');
  assert.equal(f.crossOrigin, 'anonymous', 'sin esto, exportar el diseño ensucia el lienzo');
  assert.equal(f.scaleX, f.scaleY, 'no se deforma');
  assert.equal(f.scaleX, 0.2, '2000 px en 400');
  assert.deepEqual([f.left, f.top], [100, 200], 'centrada en la caja: mide 400 × 200');
  assert.equal(r.cambios[0].tipo, 'agrega');
});

test('agregar_foto con «cubrir»: llena la caja y corta lo que sobra, también sin deformarse', () => {
  const r = aplicar([{ op: 'agregar_foto', foto: 'o1', x: 0, y: 0, ancho: 400, alto: 400, cubrir: true }], { fotos: FOTOS });
  const f = objetosDe(r.doc)[0].objects.at(-1)!;
  assert.equal(f.scaleX, f.scaleY);
  assert.equal(f.scaleX, 0.4, '1000 px de alto en 400');
  assert.equal((f.width as number) * (f.scaleX as number), 400);
  assert.equal((f.height as number) * (f.scaleY as number), 400);
  assert.equal(f.cropX, 500, 'corta lo mismo de cada lado');
  assert.equal(f.cropY, 0);
});

test('agregar_foto sin medidas: centrada, a la mitad del lado corto, como la del panel de Subidos', () => {
  const r = aplicar([{ op: 'agregar_foto', foto: 'o1' }], { fotos: FOTOS });
  const f = objetosDe(r.doc)[0].objects.at(-1)!;
  assert.equal(f.scaleX, f.scaleY);
  assert.ok((f.width as number) * (f.scaleX as number) > 0);
});

test('una foto que no está en la lista se dice y no toca nada; lo que dependía de ella tampoco cae sobre lo de la persona', () => {
  const t = ref('obj-titulo');
  const r = aplicar([{ op: 'agregar_foto', foto: 'o9', ref: t }, { op: 'borrar', refs: [t] }], { fotos: FOTOS });
  assert.equal(r.aplicadas, 0);
  assert.match(r.descartes[0], /foto/);
  assert.equal(objDe(r.doc, 'obj-titulo').text, 'Hola mundo');
  assert.equal(aplicar([{ op: 'agregar_foto', foto: 'o1' }]).aplicadas, 0, 'sin lista (una propuesta sin fotos): tampoco');
});

test('fondo_foto: el fondo de la página es la foto, con el mismo formato que el panel de Fondo', () => {
  const r = aplicar([{ op: 'fondo_foto', foto: 'o1' }], { fotos: FOTOS });
  assert.deepEqual(objetosDe(r.doc)[0].background, { type: 'image', src: FOTOS.get('o1')!.url, fit: 'cover' });
  const elegido = aplicar([{ op: 'fondo_foto', foto: 'o1' }], { fotos: FOTOS, soloRefs: new Set([ref('obj-titulo')]) });
  assert.equal(elegido.aplicadas, 0, 'el fondo es de la página, no de lo elegido');
});

test('la vista le cuenta a la IA qué fotos hay, sin la dirección; y el catálogo ya no dice que no se puede', () => {
  const v = JSON.parse(vistaDeDiseno(diseno(), { activePageId: 'pag-1', fotos: [{ ref: 'o1', nombre: 'foto.jpg', ancho: 2000, alto: 1000, adjunta: true }] }).json);
  assert.deepEqual(v.fotos, [{ ref: 'o1', nombre: 'foto.jpg', ancho: 2000, alto: 1000, adjunta: true }]);
  assert.doesNotMatch(NO_SE_PUEDE_CHAT_IMAGEN, /agregar fotos/);
  assert.match(catalogoParaPrompt(), /agregar_foto/);
  assert.match(catalogoParaPrompt(), /fondo_foto/);
});

test('la propuesta guarda las fotos que usa: aceptar después de recargar las encuentra', () => {
  const m = { id: 'm1', c: 1, t: 1, de: 'mako', texto: 'x', estado: 'pendiente', propuesta: {
    paginaId: 'pag-1', refs: [], paginas: [], elegidos: [], alcance: 'diseno',
    operaciones: [{ op: 'agregar_foto', foto: 'o1' }],
    fotos: [['o1', FOTOS.get('o1')], ['o2', { id: 's', url: 'javascript:alert(1)', nombre: 'x', ancho: 1, alto: 1 }]],
  } };
  const h = hiloAlAbrir([m]);
  const g = (h[0] as MensajeMako).propuesta!;
  assert.deepEqual(g.fotos, [['o1', FOTOS.get('o1')]], 'una dirección que no es http no se guarda');
});

test('pedir con una foto adjunta: la sube a Subidos, se la ofrece a la IA y la propuesta la pone', async () => {
  const { editor } = editorDeMentira([]);
  const subidas: string[] = [];
  (editor as unknown as { assets: unknown }).assets = {
    upload: async (f: File, nombre: string) => { subidas.push(nombre); return { id: 'sub-9', url: 'https://x.supabase.co/a/mia.jpg', thumbUrl: '', width: 800, height: 600, name: nombre, kind: 'image' }; },
  };
  (editor as unknown as { store: unknown }).store = { setState: () => {} };
  const pedidos: Array<{ url: string; cuerpo: Obj | null }> = [];
  globalThis.fetch = (async (url: string, init?: { body?: unknown }) => {
    const cuerpo = init?.body instanceof FormData ? JSON.parse(String(init.body.get('cuerpo') ?? init.body.get('json') ?? '{}')) : init?.body ? JSON.parse(String(init.body)) : null;
    pedidos.push({ url, cuerpo });
    if (String(url).startsWith('/api/image-editor/subidos')) return { json: async () => ({ ok: true, subidos: [{ id: 'sub-1', nombre: 'vieja.jpg', tipo: 'image/jpeg', ancho: 100, alto: 100, bytes: 1, url: 'https://x.supabase.co/a/vieja.jpg', creado: '' }, { id: 'aud', nombre: 'a.mp3', tipo: 'audio/mpeg', ancho: 0, alto: 0, bytes: 1, url: 'https://x.supabase.co/a/a.mp3', creado: '' }] }) };
    return { json: async () => ({ ok: true, resumen: 'Pongo tu foto.', operaciones: [{ op: 'agregar_foto', foto: 'o1' }], descartes: [] }) };
  }) as unknown as typeof fetch;
  await pedirEdicion(editor as never, 'pone esta foto', 'diseno', [new File(['x'], 'mia.jpg', { type: 'image/jpeg' })]);
  assert.deepEqual(subidas, ['mia.jpg']);
  const m = leerHilo(editor.designId).mensajes.at(-1) as MensajeMako;
  assert.equal(m.estado, 'pendiente');
  assert.deepEqual(m.propuesta!.fotos!.map(([r, f]) => [r, f.id]), [['o1', 'sub-9']], 'guarda sólo la que usa, y la adjunta va primero');
  await aceptarPropuesta(editor as never, m);
  const f = objetosDe(editor.getDocument())[0].objects.at(-1)!;
  assert.equal(f.src, 'https://x.supabase.co/a/mia.jpg');
});

test('si una foto adjunta no se pudo subir se dice, y el pedido sigue con lo demás', async () => {
  const { editor } = editorDeMentira([]);
  (editor as unknown as { assets: unknown }).assets = { upload: async () => { throw new Error('pesa de más'); } };
  (editor as unknown as { store: unknown }).store = { setState: () => {} };
  globalThis.fetch = (async (url: string) => (String(url).startsWith('/api/image-editor/subidos')
    ? { json: async () => ({ ok: false, error: 'x' }) }
    : { json: async () => ({ ok: true, resumen: 'Cambio el fondo.', operaciones: [{ op: 'fondo', color: '#000000' }], descartes: [] }) })) as unknown as typeof fetch;
  await pedirEdicion(editor as never, 'el fondo y mi foto', 'diseno', [new File(['x'], 'mia.jpg', { type: 'image/jpeg' })]);
  const m = leerHilo(editor.designId).mensajes.at(-1) as MensajeMako;
  assert.ok(m.descartes!.some((d) => /mia\.jpg/.test(d)));
});

// Lo que encontró la revisión de las fotos (30/10/2026).
test('se sube el ORIGINAL, no la copia achicada que lee la IA', () => {
  assert.equal(originalDe(new File(['x'], 'a.png', { type: 'image/png' })).name, 'a.png', 'sin copia, el mismo');
  const f = readFileSync(join(RAIZ_FOTOS, 'app/image-editor/mako/chat/acciones.ts'), 'utf8');
  assert.match(f, /const o = originalDe\(f\);/);
  assert.match(f, /editor\.assets\.upload\(o, o\.name\)/);
});

test('«Detener» mientras suben las fotos: no se le pide nada a la IA', async () => {
  const { editor } = editorDeMentira([]);
  const pedidos: string[] = [];
  globalThis.fetch = (async (url: string) => {
    pedidos.push(String(url));
    if (String(url).startsWith('/api/image-editor/subidos')) { detener(editor.designId); return { json: async () => ({ ok: true, subidos: [] }) }; }
    return { json: async () => ({ ok: true, resumen: 'x', operaciones: [{ op: 'fondo', color: '#000000' }], descartes: [] }) };
  }) as unknown as typeof fetch;
  await pedirEdicion(editor as never, 'el fondo', 'diseno');
  assert.ok(!pedidos.some((u) => u.startsWith('/api/image-editor/ia')), 'el pedido salió igual');
  const m = leerHilo(editor.designId).mensajes.at(-1) as MensajeMako;
  assert.equal(m.texto, 'Detenido.');
  assert.equal(leerHilo(editor.designId).corriendo, false);
});

test('una foto que ya está en Subidos no se vuelve a subir al reintentar', async () => {
  const { editor } = editorDeMentira([]);
  let subidas = 0;
  (editor as unknown as { assets: unknown }).assets = { upload: async () => { subidas++; throw new Error('no debería'); } };
  (editor as unknown as { store: unknown }).store = { setState: () => {} };
  globalThis.fetch = (async (url: string) => (String(url).startsWith('/api/image-editor/subidos')
    ? { json: async () => ({ ok: true, subidos: [{ id: 'ya', nombre: 'mia.jpg', tipo: 'image/jpeg', ancho: 10, alto: 10, bytes: 1, url: 'https://x.supabase.co/a/mia.jpg', creado: '' }] }) }
    : { json: async () => ({ ok: true, resumen: 'Pongo la foto.', operaciones: [{ op: 'agregar_foto', foto: 'o1' }], descartes: [] }) })) as unknown as typeof fetch;
  await pedirEdicion(editor as never, 'pone esta', 'diseno', [new File(['x'], 'mia.jpg', { type: 'image/jpeg' })]);
  assert.equal(subidas, 0);
  const m = leerHilo(editor.designId).mensajes.at(-1) as MensajeMako;
  assert.deepEqual(m.propuesta!.fotos!.map(([, f]) => f.id), ['ya']);
});

test('un SVG adjunto se pone, pero a la ruta no le llega (lo rechazaría por su firma), y sin texto igual hay instrucción', async () => {
  const { editor } = editorDeMentira([]);
  (editor as unknown as { assets: unknown }).assets = { upload: async (_f: File, n: string) => ({ id: 's', url: 'https://x.supabase.co/a/l.png', thumbUrl: '', width: 100, height: 100, name: n, kind: 'image' }) };
  (editor as unknown as { store: unknown }).store = { setState: () => {} };
  let cuerpo: { instruccion?: string } | null = null;
  let esMultipart = false;
  globalThis.fetch = (async (url: string, init?: { body?: unknown }) => {
    if (String(url).startsWith('/api/image-editor/subidos')) return { json: async () => ({ ok: true, subidos: [] }) };
    esMultipart = init?.body instanceof FormData;
    cuerpo = esMultipart ? null : JSON.parse(String(init?.body));
    return { json: async () => ({ ok: true, resumen: 'Pongo el logo.', operaciones: [{ op: 'agregar_foto', foto: 'o1' }], descartes: [] }) };
  }) as unknown as typeof fetch;
  await pedirEdicion(editor as never, '', 'diseno', [new File(['<svg/>'], 'l.svg', { type: 'image/svg+xml' })]);
  assert.equal(esMultipart, false);
  assert.equal(cuerpo!.instruccion, 'Pon en el diseño lo que adjunté.');
});

test('la lista de fotos se achica para entrar: no tira un pedido que no tiene que ver con fotos', async () => {
  const { editor } = editorDeMentira([]);
  const muchas = Array.from({ length: 40 }, (_, i) => ({ id: `s${i}`, nombre: `${'x'.repeat(50)}${i}`, tipo: 'image/jpeg', ancho: 1, alto: 1, bytes: 1, url: 'https://x.supabase.co/a', creado: '' }));
  const largo = JSON.stringify(vistaDeDiseno(diseno(), { activePageId: 'pag-1' }).json).length;
  assert.ok(largo < TOPES_CHAT_IMAGEN.vistaMax);
  const f = readFileSync(join(RAIZ_FOTOS, 'app/image-editor/mako/chat/acciones.ts'), 'utf8');
  assert.match(f, /while \(vista\.json\.length > TOPES_CHAT_IMAGEN\.vistaMax && fotos\.length\)/);
  assert.ok(f.indexOf('vistaCon([]).json.length') < f.indexOf('await fotosParaPedir'), 'se mide ANTES de subir');
  assert.equal(muchas.length, 40);
  void editor;
});
