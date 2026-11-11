// =============================================================================
// La foto del avatar se SUELTA sobre la grilla de Flow: «Upload» ya no abre con un clic armado (11/11/2026)
// =============================================================================
// Síntoma: la foto del avatar no llegaba nunca a Flow. Los tres primeros intentos (8/11, ws 9) decían
// «Flow no mostró la opción de subir» —el ícono pegado al texto, arreglado el 8/11 en
// flow-nombre-sin-iconos.test.ts—; el que vino DESPUÉS de ese arreglo (trabajo 688) dijo «Flow no
// terminó de procesar la foto», y la foto no estaba en «Uploads» del proyecto.
//
// La causa, medida el 11/11 en flow.google.com con la cuenta de Martín: con un clic de mouse real,
// «Add media menu» → «Upload» crea un <input type=file> y le llama click(). Con el clic armado de la
// extensión, el menú se cierra y Flow no llama a click(), ni a showPicker(), ni a
// showOpenFilePicker(). Soltar un archivo sobre la grilla, en cambio, sí lo atiende: un .txt soltado
// ahí devuelve «Unsupported file type…», o sea que entró a la validación de subida. Sobre <body> o
// sobre la caja del prompt no lo atiende nadie.
//
// Este test corre la función REAL (sacada del fuente) con un documento de mentira: no hace falta un
// DOM entero para saber a quién le suelta, qué le pasa y qué devuelve.
//
// Correr: node --import tsx --test tests/flow-subir-soltando.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'extension/flow-interfaz.js'), 'utf8');

/** El bloque `ZONAS_SOLTAR` + `soltarArchivo`, tal cual está en la extensión. */
function bloqueSoltar(): string {
  const ini = src.indexOf('const ZONAS_SOLTAR');
  assert.ok(ini > 0, 'ZONAS_SOLTAR ya no está en extension/flow-interfaz.js');
  const f = src.indexOf('function soltarArchivo(', ini);
  assert.ok(f > 0, 'soltarArchivo() ya no está en extension/flow-interfaz.js');
  const desde = src.indexOf('{', f);
  let d = 0;
  for (let i = desde; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (d === 0) return src.slice(ini, i + 1); }
  }
  throw new Error('no se pudo delimitar soltarArchivo()');
}

class DataTransferFalso {
  files: unknown[] = [];
  items = { add: (f: unknown) => { this.files.push(f); } };
}
class DragEventFalso {
  constructor(public type: string, public init: Record<string, unknown>) {}
}

type Zona = { visible?: boolean; cancela?: boolean; eventos: DragEventFalso[] };

/** Arma soltarArchivo contra un documento donde cada selector devuelve la zona que se le dé. */
function armar(zonas: Record<string, Zona>) {
  const els: Record<string, object> = {};
  for (const [sel, z] of Object.entries(zonas)) {
    els[sel] = {
      __visible: z.visible !== false,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
      dispatchEvent(ev: DragEventFalso) {
        z.eventos.push(ev);
        // Lo que hace el navegador: dispatchEvent devuelve false si un handler llamó a preventDefault().
        return !(ev.type === 'drop' && z.cancela);
      },
    };
  }
  const documento = { querySelector: (s: string) => els[s] ?? null };
  const visible = (el: { __visible: boolean }) => el.__visible;
  // eslint-disable-next-line no-new-func
  return new Function('document', 'DataTransfer', 'DragEvent', 'visible', `${bloqueSoltar()}; return soltarArchivo;`)(
    documento, DataTransferFalso, DragEventFalso, visible,
  ) as (archivo: unknown) => boolean;
}

const FOTO = { name: 'mako-700.jpg', type: 'image/jpeg' };

test('suelta la foto sobre la grilla y dice que Flow la tomó cuando cancela el drop', () => {
  const grilla: Zona = { cancela: true, eventos: [] };
  const soltar = armar({ '.grid-area-wrapper': grilla });
  assert.equal(soltar(FOTO), true);
  assert.deepEqual(grilla.eventos.map((e) => e.type), ['dragenter', 'dragover', 'drop'],
    'el orden de un arrastre de verdad: entrar, pasar por encima, soltar');
  const drop = grilla.eventos[2];
  assert.deepEqual((drop.init.dataTransfer as DataTransferFalso).files, [FOTO], 'el drop lleva LA foto');
  assert.equal(drop.init.bubbles, true, 'tiene que subir: el que escucha es un ancestro de la grilla');
  assert.equal(drop.init.cancelable, true, 'si no es cancelable, Flow no puede decir que lo tomó');
});

test('⚠️ si nadie cancela el drop, NO se da por subida (se cae al menú)', () => {
  const grilla: Zona = { cancela: false, eventos: [] };
  assert.equal(armar({ '.grid-area-wrapper': grilla })(FOTO), false);
});

test('sin grilla a la vista, no suelta nada', () => {
  assert.equal(armar({})(FOTO), false);
  const oculta: Zona = { visible: false, cancela: true, eventos: [] };
  assert.equal(armar({ '.grid-area-wrapper': oculta })(FOTO), false);
  assert.equal(oculta.eventos.length, 0, 'a una zona oculta no se le suelta nada');
});

test('si la grilla no está, prueba el contenedor que la envuelve', () => {
  const lado: Zona = { cancela: true, eventos: [] };
  assert.equal(armar({ 'mat-sidenav-content': lado })(FOTO), true);
  assert.equal(lado.eventos.length, 3);
});

test('⚠️ nunca se suelta sobre <body> ni sobre la caja del prompt: ahí Flow no lo atiende', () => {
  const zonas = /const ZONAS_SOLTAR = \[([^\]]*)\]/.exec(src)?.[1] ?? '';
  assert.ok(zonas.length > 0, 'falta la lista de zonas');
  assert.ok(!/['"]body['"]/.test(zonas), 'soltado sobre <body>, el evento no baja a la grilla');
  assert.ok(!/ProseMirror/.test(zonas), 'la caja del prompt no toma archivos soltados');
});

test('subir(): primero el input que ya esté, después SOLTAR, y el menú «Upload» al final', () => {
  const i = src.indexOf('async function subir(p) {');
  const cuerpo = src.slice(i, src.indexOf('\n  }\n', i));
  const enInput = cuerpo.indexOf("querySelectorAll('input[type=\"file\"]')");
  const enSoltar = cuerpo.indexOf('soltarArchivo(archivo)');
  const enMenu = cuerpo.indexOf('R.menuMedios');
  assert.ok(enInput > 0 && enSoltar > 0 && enMenu > 0, 'faltan los tres caminos');
  assert.ok(enInput < enSoltar && enSoltar < enMenu,
    'el menú va último: hoy Flow no abre «Upload» con un clic armado, y probarlo primero gasta 4 s y falla');
});

test('si la foto no aparece, la falla dice lo que avisó Flow (leído ANTES de cerrar las capas)', () => {
  const i = src.indexOf('async function subir(p) {');
  const cuerpo = src.slice(i, src.indexOf('\n  }\n', i));
  const aviso = cuerpo.indexOf('avisosDeFlow()');
  const cerrar = cuerpo.indexOf('await cerrarCapas()');
  assert.ok(aviso > 0 && cerrar > 0 && aviso < cerrar, 'cerrarCapas se lleva el aviso: hay que leerlo antes');
  assert.match(cuerpo, /Flow no aceptó la foto: \$\{aviso\}/);
});
