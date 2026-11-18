// =============================================================================
// El chat «MaKo IA» del Image Editor: filtros, ajustes y recorte de una foto, y cambiar el tamaño del diseño (O37)
// =============================================================================
// El pedido del 27/10/2026: «si una persona quiere editar lo que sea debería poder, con prompts». Hasta el 18/11 el
// catálogo (lib/image-editor/chat/catalogo.ts → NO_SE_PUEDE_CHAT_IMAGEN) decía que por chat no se podía recortar,
// poner filtros ni Redimensionar. Ahora son cuatro operaciones más, aplicadas sobre una COPIA del documento y entradas en
// UN paso de deshacer (lib/image-editor/chat/aplicar.ts, app/image-editor/mako/chat/acciones.ts).
//
// Los filtros y el recorte son una COPIA de los datos del motor (lib/image-editor/chat/fotos.ts: el server no puede
// importar `_doory`). Por eso los tests 1 a 3 corren los DOS lados —el motor y la copia— y fallan si se separan; el
// tamaño del diseño usa la función del motor (`resizeDocument`), que el panel le pasa al chat.
//
// Correr: node --import tsx --test --test-concurrency=1 tests/image-editor-chat-fotos.test.ts
// PROBADO ROMPIÉNDOLO (18/11/2026), de a una (con la base en 12/12):
//   · el contraste de «Vívido» de la copia en 0.16 en vez de 0.15                     → 2 fallos, 10 pases (el 1 y el 5)
//   · `escala: 100` del tono en vez de 180                                           → 2 fallos, 10 pases (el 2 y el 5)
//   · `recorteConProporcion` sin recentrar (cropX + 0)                               → 2 fallos, 10 pases (el 3 y el 7)
//   · en aplicar, «ajustar» que REEMPLAZA en vez de sumar (conAjustes([], op))        → 2 fallos, 10 pases (el 5 y el 6)
//   · `ponerCentro` sacado del recorte (la foto girada se corre)                     → 1 fallo, 11 pases (el 7)
//   · sin el `if (otroTamano)` en aceptarPropuesta (no re-encuadra)                  → 1 fallo, 11 pases (el 12)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FILTER_PRESETS, FILTER_RANGES, TOGGLE_FILTERS, normalizeSpecs, withSpec } from '../app/image-editor/_doory/editor/engine/objects/filters';
import { fitAspect } from '../app/image-editor/_doory/editor/engine/crop';
import { objectCenter } from '../app/image-editor/_doory/editor/engine/magicResize';
import type { ImageFilterSpec, ImageFilterType } from '../app/image-editor/_doory/types/document';
import { AJUSTES_FOTO, AJUSTES_SI_NO, FILTROS_FOTO, PROPORCIONES_RECORTE, conAjustes, normalizarFiltros, recorteConProporcion } from '../lib/image-editor/chat/fotos';
import { NO_SE_PUEDE_CHAT_IMAGEN, OPERACIONES_CHAT_IMAGEN, catalogoParaPrompt, validarOperacion, validarOperaciones, type OperacionImagen } from '../lib/image-editor/chat/catalogo';
import { aplicarOperaciones } from '../lib/image-editor/chat/aplicar';
import { vistaDeDiseno } from '../lib/image-editor/chat/vista';
import { aceptarPropuesta, pedirEdicion, redimensionarComoElEditor } from '../app/image-editor/mako/chat/acciones';
import { leerHilo, type MensajeMako } from '../app/image-editor/mako/chat/hilo';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

type Obj = Record<string, unknown>;
type Doc = { width: number; height: number; meta?: Obj; pages: Array<{ id: string; width?: number; height?: number; background: Obj; objects: Obj[] }> };

/** Un diseño de 1080 × 1080: una foto de 800 × 600 a escala 0,5 con origen al centro, un QR, una foto en un marco y un título. */
function diseno(): Doc {
  return {
    width: 1080, height: 1080, meta: { presetId: 'instagram-post' },
    pages: [{
      id: 'pag-1', background: { type: 'solid', color: '#ffffff' },
      objects: [
        { type: 'image', id: 'obj-foto', name: 'Foto', src: 'https://ejemplo.test/a.jpg', originX: 'center', originY: 'center', left: 540, top: 400, width: 800, height: 600, cropX: 0, cropY: 0, scaleX: 0.5, scaleY: 0.5, angle: 0, filters: [{ type: 'grayscale', value: 1 }] },
        { type: 'image', id: 'obj-qr', name: 'QR', qr: { text: 'https://ejemplo.test', fg: '#000000', bg: '#ffffff' }, originX: 'left', originY: 'top', left: 0, top: 0, width: 200, height: 200, scaleX: 1, scaleY: 1 },
        { type: 'image', id: 'obj-marco', name: 'En marco', src: 'https://ejemplo.test/b.jpg', slot: { cx: 800, cy: 800, width: 200, height: 200, angle: 0 }, originX: 'left', originY: 'top', left: 700, top: 700, width: 400, height: 400, scaleX: 0.5, scaleY: 0.5 },
        { type: 'textbox', id: 'obj-titulo', text: 'Hola', fontFamily: '"Inter", sans-serif', fontSize: 40, originX: 'left', originY: 'top', left: 100, top: 900, width: 600, height: 48, scaleX: 1, scaleY: 1 },
      ],
    }],
  };
}

const VISTA = vistaDeDiseno(diseno(), { activePageId: 'pag-1' });
const ref = (id: string) => [...VISTA.elementos.values()].find((e) => e.id === id)!.ref;
const objDe = (doc: unknown, id: string) => (doc as Doc).pages.flatMap((p) => p.objects).find((o) => o.id === id)!;
const op = (x: Record<string, unknown>): OperacionImagen => {
  const v = validarOperacion(x);
  assert.ok(v.ok, `la operación de prueba no valida: ${JSON.stringify(x)} → ${!v.ok ? v.motivo : ''}`);
  return v.op;
};
let n = 0;
const aplicar = (ops: Record<string, unknown>[], extra: Partial<Parameters<typeof aplicarOperaciones>[0]> = {}) =>
  aplicarOperaciones({ doc: diseno(), operaciones: ops.map(op), vista: VISTA, nuevoId: () => `nuevo-${++n}`, activePageId: 'pag-1', ...extra });

// ── La copia contra el motor ─────────────────────────────────────────────────────

test('1: los filtros de la copia son los del motor, uno por uno, y se normalizan igual', () => {
  const delMotor = new Map(FILTER_PRESETS.map((p) => [p.id, p.specs] as const));
  assert.equal(Object.keys(FILTROS_FOTO).length, FILTER_PRESETS.length, 'el motor tiene otro número de filtros que el chat');
  for (const [nombre, f] of Object.entries(FILTROS_FOTO)) {
    assert.ok(delMotor.has(f.preset), `«${nombre}» apunta a «${f.preset}», que el motor no tiene`);
    assert.deepEqual(normalizarFiltros(f.specs), normalizeSpecs(delMotor.get(f.preset)!), `«${nombre}» guarda otra cosa que el motor`);
  }
  // normalizeSpecs contra la copia, con repetidos, neutros, desorden y decimales largos.
  const tipos: ImageFilterType[] = ['brightness', 'contrast', 'saturation', 'hue', 'blur', 'vignette', 'grayscale', 'sepia'];
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 48271) % 2147483647) / 2147483647);
  for (let i = 0; i < 200; i++) {
    const specs: ImageFilterSpec[] = Array.from({ length: Math.floor(azar() * 7) }, () => ({ type: tipos[Math.floor(azar() * tipos.length)], value: azar() < 0.2 ? 0 : Math.round((azar() * 2 - 1) * 1e6) / 1e6 }));
    assert.deepEqual(normalizarFiltros(specs), normalizeSpecs(specs), JSON.stringify(specs));
  }
});

test('2: los ajustes van en las unidades de la pantalla del motor, y suman como el panel (withSpec)', () => {
  for (const [k, a] of Object.entries(AJUSTES_FOTO)) {
    const r = FILTER_RANGES.find((x) => x.type === a.tipo);
    assert.ok(r, `«${k}» no es un deslizador del motor`);
    assert.equal(a.escala, r!.display, `«${k}»: la escala no es la que muestra el panel`);
    assert.equal(a.min, r!.min * r!.display, `«${k}»: el mínimo no es el del panel`);
    assert.equal(a.max, r!.max * r!.display, `«${k}»: el máximo no es el del panel`);
  }
  assert.equal(Object.keys(AJUSTES_FOTO).length, FILTER_RANGES.length, 'faltan deslizadores del motor en el chat');
  assert.deepEqual(Object.values(AJUSTES_SI_NO).map((a) => a.tipo).sort(), [...TOGGLE_FILTERS].sort());
  // Sumar un ajuste es lo mismo que mover ese deslizador en el panel.
  const base: ImageFilterSpec[] = [{ type: 'grayscale', value: 1 }, { type: 'contrast', value: 0.2 }];
  assert.deepEqual(conAjustes(base, { brillo: 30 }), withSpec(base, 'brightness', 0.3));
  assert.deepEqual(conAjustes(base, { tono: -90 }), withSpec(base, 'hue', -0.5));
  assert.deepEqual(conAjustes(base, { blanco_y_negro: false }), withSpec(base, 'grayscale', 0));
  assert.deepEqual(conAjustes(base, { contraste: 0 }), withSpec(base, 'contrast', 0));
});

test('3: recortar a una proporción es fitAspect del motor dentro de lo que se ve', () => {
  const casos = [
    { actual: { cropX: 0, cropY: 0, width: 800, height: 600 }, sx: 0.5, sy: 0.5 },
    { actual: { cropX: 120, cropY: 40, width: 500, height: 900 }, sx: 1, sy: 1 },
    { actual: { cropX: 10, cropY: 30, width: 640, height: 640 }, sx: 0.8, sy: 1.6 },
  ];
  for (const c of casos) {
    for (const [p, ratio] of Object.entries(PROPORCIONES_RECORTE)) {
      // La foto entera, para el motor, se acota a lo que se ve (el documento no trae el tamaño original).
      const g = { natW: c.actual.cropX + c.actual.width, natH: c.actual.cropY + c.actual.height, sx: c.sx, sy: c.sy, angle: 0, flipX: false, flipY: false, ghostCenter: { x: 0, y: 0 } };
      const motor = fitAspect(g, c.actual, ratio);
      const chat = recorteConProporcion(c.actual, c.sx, c.sy, ratio);
      for (const k of ['cropX', 'cropY', 'width', 'height'] as const) assert.ok(Math.abs(motor[k] - chat[k]) < 1e-6, `${p} sobre ${JSON.stringify(c)}: ${k} ${chat[k]} ≠ ${motor[k]}`);
      // Y lo que se VE queda en esa proporción.
      assert.ok(Math.abs((chat.width * c.sx) / (chat.height * c.sy) - ratio) < 1e-6, `${p}: se ve en otra proporción`);
    }
  }
  // Las proporciones son las de la barra de recorte del editor (sin «Libre»).
  const barra = readFileSync(join(RAIZ, 'app/image-editor/_doory/editor/toolbar/sections/crop.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const ids = [...barra.matchAll(/\{ id: '([0-9]+:[0-9]+)', label: '[^']*', ratio: ([0-9]+) \/ ([0-9]+) \}|\{ id: '(1:1)', label: '1:1', ratio: 1 \}/g)].map((m) => m[1] ?? m[4]);
  assert.ok(ids.length >= 5, `no encontré las proporciones de la barra (${ids.length})`);
  assert.deepEqual(ids.sort(), Object.keys(PROPORCIONES_RECORTE).sort());
});

// ── Validar ──────────────────────────────────────────────────────────────────────

test('4: las cuatro operaciones validan, y lo que devuelven vuelve a pasar igual (la ruta y el panel validan dos veces)', () => {
  const crudas = [
    { op: 'filtro_foto', ref: 'i7q', filtro: 'noir' },
    { op: 'ajustar_foto', ref: 'i7q', brillo: 20.4, saturacion: -30, sepia: true },
    { op: 'recortar_foto', ref: 'i7q', proporcion: '9:16' },
    { op: 'redimensionar', tamano: 'historia' },
    { op: 'redimensionar', ancho: 1200, alto: 628, contenido: 'reubicar' },
  ];
  for (const c of crudas) {
    const v = validarOperacion(c);
    assert.ok(v.ok, `${JSON.stringify(c)} no valida: ${!v.ok ? v.motivo : ''}`);
    const otra = validarOperacion(JSON.parse(JSON.stringify(v.op)));
    assert.deepEqual(otra, v, `${c.op}: validarla dos veces la cambia`);
  }
  assert.deepEqual(validarOperacion(crudas[3]), { ok: true, op: { op: 'redimensionar', ancho: 1080, alto: 1920, contenido: 'escalar' } }, 'un tamaño por nombre trae sus medidas y escalar por defecto');
  assert.deepEqual(validarOperacion(crudas[1]), { ok: true, op: { op: 'ajustar_foto', ref: 'i7q', brillo: 20, saturacion: -30, sepia: true } });
  const malas: Record<string, unknown>[] = [
    { op: 'filtro_foto', ref: 'i7q', filtro: 'instagram' },
    { op: 'ajustar_foto', ref: 'i7q' },
    { op: 'ajustar_foto', ref: 'i7q', brillo: 150 },
    { op: 'ajustar_foto', ref: 'i7q', tono: -200 },
    { op: 'ajustar_foto', ref: 'i7q', sepia: 'si' },
    { op: 'ajustar_foto', ref: 'i7q', nitidez: 10 },
    { op: 'recortar_foto', ref: 'i7q', proporcion: '5:4' },
    { op: 'recortar_foto', proporcion: '1:1' },
    { op: 'redimensionar', tamano: 'afiche_a3' },
    { op: 'redimensionar', tamano: 'historia', ancho: 10 },
    { op: 'redimensionar', ancho: 1080 },
    { op: 'redimensionar', ancho: 99999, alto: 10 },
    { op: 'redimensionar', ancho: 1080, alto: 1080, contenido: 'estirar' },
  ];
  for (const m of malas) {
    const v = validarOperacion(m);
    assert.ok(!v.ok, `${JSON.stringify(m)} no se tenía que aceptar`);
    // Mismas reglas que los demás motivos (tests/image-editor-chat.test.ts): corto, en minúscula y sin jerga.
    assert.ok(v.motivo.length <= 90 && !/^[A-Z]/.test(v.motivo) && !/_/.test(v.motivo), `motivo «${v.motivo}»`);
  }
});

test('5: ajustar SUMA a lo que tiene (el blanco y negro no se va) y el filtro REEMPLAZA; un QR no se filtra', () => {
  const foto = ref('obj-foto');
  const a = aplicar([{ op: 'ajustar_foto', ref: foto, brillo: 25, tono: 90 }]);
  assert.equal(a.aplicadas, 1);
  assert.deepEqual(objDe(a.doc, 'obj-foto').filters, [{ type: 'brightness', value: 0.25 }, { type: 'hue', value: 0.5 }, { type: 'grayscale', value: 1 }]);
  assert.deepEqual(a.cambios.map((c) => [c.titulo, c.antes, c.despues]), [['Ajustes de Foto', 'Mono', 'brillo +25 · tono +90 · blanco y negro']]);
  const f = aplicar([{ op: 'filtro_foto', ref: foto, filtro: 'vivido' }]);
  assert.deepEqual(objDe(f.doc, 'obj-foto').filters, [{ type: 'contrast', value: 0.15 }, { type: 'saturation', value: 0.45 }]);
  const o = aplicar([{ op: 'filtro_foto', ref: foto, filtro: 'original' }]);
  assert.equal('filters' in objDe(o.doc, 'obj-foto'), false, '«original» saca la clave, como el motor');
  const qr = aplicar([{ op: 'filtro_foto', ref: ref('obj-qr'), filtro: 'noir' }, { op: 'ajustar_foto', ref: ref('obj-titulo'), brillo: 10 }]);
  assert.equal(qr.aplicadas, 0);
  assert.deepEqual(qr.descartes, ['QR no es una foto', '«Hola» no es una foto']);
  const igual = aplicar([{ op: 'filtro_foto', ref: foto, filtro: 'mono' }]);
  assert.deepEqual([igual.aplicadas, igual.descartes], [0, ['Foto ya está así']]);
  assert.deepEqual(diseno().pages[0].objects[0].filters, [{ type: 'grayscale', value: 1 }], 'el documento de entrada no se toca');
});

test('6: la vista le cuenta a la IA los ajustes de cada foto, en las unidades de la pantalla, y si va en un marco', () => {
  const v = JSON.parse(vistaDeDiseno(aplicar([{ op: 'ajustar_foto', ref: ref('obj-foto'), brillo: -40 }]).doc, { activePageId: 'pag-1' }).json);
  const els = v.paginas[0].elementos as Obj[];
  assert.deepEqual(els.find((e) => e.ref === ref('obj-foto'))!.ajustes, { brillo: -40, blanco_y_negro: true });
  assert.equal(els.find((e) => e.ref === ref('obj-marco'))!.en_marco, true);
  assert.equal('ajustes' in els.find((e) => e.ref === ref('obj-marco'))!, false);
});

test('7: recortar se queda con lo que se ve, centrado, sin mover el centro (también girada); una en un marco no se recorta', () => {
  const foto = ref('obj-foto');
  const r = aplicar([{ op: 'recortar_foto', ref: foto, proporcion: '1:1' }]);
  const o = objDe(r.doc, 'obj-foto');
  assert.deepEqual([o.cropX, o.cropY, o.width, o.height], [100, 0, 600, 600]);
  assert.deepEqual([o.left, o.top], [540, 400], 'el centro (origen al centro) no se movió');
  assert.deepEqual(r.cambios.map((c) => [c.titulo, c.antes, c.despues]), [['Recorte de Foto', '400 × 300', '300 × 300 (1:1)']]);
  // Girada y con origen arriba a la izquierda: el centro de lo que se ve (el del motor) queda donde estaba.
  const girada = diseno();
  Object.assign(girada.pages[0].objects[0], { originX: 'left', originY: 'top', left: 300, top: 200, angle: 30 });
  const antes = objectCenter(girada.pages[0].objects[0] as never);
  const g = aplicarOperaciones({ doc: girada, operaciones: [op({ op: 'recortar_foto', ref: foto, proporcion: '9:16' })], vista: VISTA, nuevoId: () => 'x' });
  const despues = objectCenter(objDe(g.doc, 'obj-foto') as never);
  assert.ok(Math.abs(antes.x - despues.x) < 0.2 && Math.abs(antes.y - despues.y) < 0.2, `el centro se corrió: ${JSON.stringify(antes)} → ${JSON.stringify(despues)}`);
  const marco = aplicar([{ op: 'recortar_foto', ref: ref('obj-marco'), proporcion: '1:1' }]);
  assert.deepEqual([marco.aplicadas, marco.descartes], [0, ['En marco va en un marco: se acomoda adentro del marco']]);
  const ya = aplicar([{ op: 'recortar_foto', ref: foto, proporcion: '4:3' }]);
  assert.deepEqual([ya.aplicadas, ya.descartes], [0, ['Foto ya tiene esa proporción']]);
});

test('8: cambiar el tamaño del diseño usa la función del motor, saca el tamaño elegido de la lista y es de todo el diseño', () => {
  const r = aplicar([{ op: 'redimensionar', tamano: 'historia' }], { redimensionar: redimensionarComoElEditor });
  const d = r.doc as Doc;
  assert.deepEqual([d.width, d.height], [1080, 1920]);
  assert.equal(d.meta?.presetId, undefined, 'como «Redimensionar»: el tamaño de la lista se saca al cambiar');
  assert.deepEqual(r.cambios.map((c) => [c.titulo, c.antes, c.despues]), [['Tamaño del diseño', '1080 × 1080', '1080 × 1920 (Historia de Instagram)']]);
  // «escalar» es `scale` del motor: la foto (al centro) se escala parejo y queda centrada en la página nueva.
  const foto = objDe(d, 'obj-foto');
  assert.deepEqual([foto.scaleX, foto.scaleY, foto.left, foto.top], [0.5, 0.5, 540, 820]);
  // Y lo que sigue en el mismo pedido ya trabaja sobre el diseño nuevo.
  const encadenado = aplicar([{ op: 'redimensionar', ancho: 1080, alto: 1920, contenido: 'igual' }, { op: 'alinear', refs: [ref('obj-titulo')], a: 'abajo' }], { redimensionar: redimensionarComoElEditor });
  assert.equal(objDe(encadenado.doc, 'obj-titulo').top, 1920 - 48);
  const sin = aplicar([{ op: 'redimensionar', tamano: 'historia' }]);
  assert.deepEqual([sin.aplicadas, sin.descartes], [0, ['el tamaño del diseño se cambia desde el editor']]);
  const elegido = aplicar([{ op: 'redimensionar', tamano: 'historia' }], { redimensionar: redimensionarComoElEditor, soloRefs: new Set([ref('obj-titulo')]) });
  assert.deepEqual(elegido.descartes, ['El tamaño del diseño es de la página, no de lo elegido']);
  const igual = aplicar([{ op: 'redimensionar', tamano: 'publicacion_instagram' }], { redimensionar: redimensionarComoElEditor });
  assert.deepEqual([igual.aplicadas, igual.descartes], [0, ['el diseño ya mide 1080 × 1080']]);
});

test('9: el catálogo las ofrece al final, y ya no dice que no se puede lo que ahora sí', () => {
  const ids = OPERACIONES_CHAT_IMAGEN.map((o) => o.op);
  assert.deepEqual(ids.slice(-4), ['filtro_foto', 'ajustar_foto', 'recortar_foto', 'redimensionar']);
  const prompt = catalogoParaPrompt();
  for (const id of ids.slice(-4)) assert.match(prompt, new RegExp(`"op":"${id}"`));
  assert.match(prompt, /historia \(Historia de Instagram, 1080 × 1920\)/, 'los tamaños por nombre son los de la API');
  for (const ya of [/filtros y ajustes de foto/, /cambiar el tamaño del diseño \(Redimensionar\)/, /recortar una foto o cambiar su encuadre/]) assert.doesNotMatch(NO_SE_PUEDE_CHAT_IMAGEN, ya);
  // «Quitar el fondo» salió de la lista el mismo 18/11/2026 (F135, `quitar_fondo`, lo fija tests/image-editor-chat.test.ts).
  for (const sigue of [/agrupar o desagrupar/, /usar una plantilla/, /agrandar el recorte/]) assert.match(NO_SE_PUEDE_CHAT_IMAGEN, sigue, 'lo que sigue sin poder se sigue diciendo');
});

test('10: lo que depende de una operación nueva que se cayó no cae sobre lo de la persona', () => {
  const { operaciones, descartes } = validarOperaciones([{ op: 'filtro_foto', ref: 'i7q', filtro: 'instagram' }, { op: 'recortar_foto', ref: 'i7q', proporcion: '1:1' }]);
  assert.deepEqual(operaciones.map((o) => o.op), ['recortar_foto'], 'un filtro malo no agrega nada: el recorte sigue');
  assert.deepEqual(descartes, ['un filtro que el editor no tiene']);
});

// ── Del pedido al diseño ─────────────────────────────────────────────────────────

function editorDeMentira() {
  const log: string[] = [];
  let doc: unknown = diseno();
  const state = { selection: { ids: [] as string[] }, docVersion: 1, activePageId: 'pag-1', zoomMode: 'fit-page' };
  const editor = {
    designId: `fotos-${++n}`,
    state,
    getDocument: () => doc,
    applyDocument: (d: unknown, info: { label: string }) => { log.push(`aplicar:${info.label}`); doc = d; state.docVersion++; },
    fonts: { load: async () => true },
    stopEditingText: () => log.push('dejar-de-editar'),
    toast: (m: string) => log.push(`aviso:${m}`),
    undo: async () => { log.push('deshacer'); },
    view: { fit: (modo: string) => log.push(`encuadrar:${modo}`) },
  };
  return { editor, log, doc: () => doc };
}

function fetchDeMentira(respuesta: unknown) {
  globalThis.fetch = (async (url: string) => ({ json: async () => (String(url).startsWith('/api/image-editor/ia') ? respuesta : { ok: false, sinTabla: true }) })) as unknown as typeof fetch;
}

test('11: pedir un filtro y un recorte SÓLO arma la propuesta; aceptar los aplica en UN paso y no re-encuadra', async () => {
  const { editor, log, doc } = editorDeMentira();
  fetchDeMentira({ ok: true, resumen: 'Le pongo Noir y la recorto cuadrada.', operaciones: [{ op: 'filtro_foto', ref: ref('obj-foto'), filtro: 'noir' }, { op: 'recortar_foto', ref: ref('obj-foto'), proporcion: '1:1' }] });
  await pedirEdicion(editor as never, 'ponle noir y recórtala cuadrada', 'diseno');
  assert.equal(log.filter((l) => l.startsWith('aplicar')).length, 0, 'pedir no toca el diseño');
  const m = leerHilo(editor.designId).mensajes.at(-1) as MensajeMako;
  assert.equal(m.estado, 'pendiente');
  assert.deepEqual(m.cambios!.map((c) => c.titulo), ['Filtro de Foto', 'Recorte de Foto']);
  await aceptarPropuesta(editor as never, m);
  assert.equal(log.filter((l) => l.startsWith('aplicar')).length, 1, 'un solo paso de deshacer');
  assert.equal(log.some((l) => l.startsWith('encuadrar')), false, 'sin otro tamaño no se vuelve a encuadrar');
  const o = objDe(doc(), 'obj-foto');
  assert.deepEqual([o.filters, o.width, o.height], [[{ type: 'contrast', value: 0.35 }, { type: 'vignette', value: 0.55 }, { type: 'grayscale', value: 1 }], 600, 600]);
});

test('12: aceptar un cambio de tamaño vuelve a encuadrar el lienzo, como «Redimensionar» del editor', async () => {
  const { editor, log, doc } = editorDeMentira();
  fetchDeMentira({ ok: true, resumen: 'Lo paso a historia.', operaciones: [{ op: 'redimensionar', tamano: 'historia' }] });
  await pedirEdicion(editor as never, 'hazlo historia', 'diseno');
  const m = leerHilo(editor.designId).mensajes.at(-1) as MensajeMako;
  assert.equal(m.estado, 'pendiente', `quedó «${m.estado}»: ${m.texto}`);
  await aceptarPropuesta(editor as never, m);
  assert.deepEqual([(doc() as Doc).width, (doc() as Doc).height], [1080, 1920]);
  const i = log.indexOf('aplicar:MaKo IA');
  assert.ok(i >= 0 && log.indexOf('encuadrar:fit-page') > i, `encuadra después de aplicar: ${log.join(' → ')}`);
});
