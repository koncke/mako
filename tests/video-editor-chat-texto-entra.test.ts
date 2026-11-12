// =============================================================================
// Un texto que pone o agranda el chat entra en el cuadro (12/11/2026)
// =============================================================================
// Probando la tab Video en producción: «Pone un título que diga oferta de noviembre» (por audio) → MaKo puso el texto y le
// subió el tamaño a 48. La letra mide `tamaño × alto / 90` (text/primitives.ts): en un 9:16 eran letras de ~1.000 px y del
// título sólo se veía «EN». El texto no se parte solo (text/layout.ts), así que la revisión achica lo que no entra y lo dice.
//
// Correr: node --import tsx --test tests/video-editor-chat-texto-entra.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validarOperacion } from '../lib/editor-video/chat-catalogo';
import { REFERENCIA_TAMANO_LETRA, TAMANO_TEXTO_DE_SIEMPRE, revisarOperaciones, tamanoQueEntra, vistaDeLinea, type OperacionResuelta } from '../app/video-editor/_opencut/chat/linea';
import { disponiblesDelMotor } from '../app/video-editor/_opencut/chat/disponibles';
import type { SceneTracks } from '../app/video-editor/_opencut/timeline/types';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const TPS = 120_000;
const t = (s: number) => Math.round(s * TPS);
const VERTICAL = { ancho: 1080, alto: 1920 };
const HORIZONTAL = { ancho: 1920, alto: 1080 };

function escena(): SceneTracks {
  const el = (id: string, type: string, ini: number, dur: number, extra: Record<string, unknown> = {}) =>
    ({ id, type, name: id, startTime: t(ini), duration: t(dur), trimStart: 0, trimEnd: 0, params: {}, ...extra });
  return {
    overlay: [{ id: 'pt', type: 'text', name: 'Texto', hidden: false, elements: [el('txt1', 'text', 0, 3, { params: { content: 'Oferta de noviembre', fontSize: 15 } })] }],
    main: { id: 'pm', type: 'video', name: 'Principal', muted: false, hidden: false, elements: [el('vid1', 'video', 0, 10, { mediaId: 'm1' })] },
    audio: [],
  } as unknown as SceneTracks;
}
const vista = (lienzo = VERTICAL) => vistaDeLinea({ tracks: escena(), tps: TPS, cabezal: 0, elegidos: [], disponibles: disponiblesDelMotor(), lienzo, medios: [], fondo: null });
const revisar = (ops: unknown[], lienzo = VERTICAL) => {
  const v = vista(lienzo);
  return revisarOperaciones({ operaciones: ops.map((o) => { const r = validarOperacion(o); assert.ok(r.ok, r.ok ? '' : r.motivo); return r.op; }), vista: v, alcance: 'video' });
};
const refTexto = () => [...vista().refs.values()].find((r) => r.elementId === 'txt1')!.ref;

test('T1: el tamaño que entra depende de las letras del renglón más largo y del lienzo', () => {
  const v = tamanoQueEntra('OFERTA DE NOVIEMBRE', VERTICAL, false)!;
  assert.ok(v >= 3 && v <= 5, `un título de 19 mayúsculas en 9:16: ${v}`);
  assert.ok(tamanoQueEntra('OFERTA DE NOVIEMBRE', HORIZONTAL, false)! > v * 2.5, 'en 16:9 entra mucho más grande');
  assert.ok(tamanoQueEntra('Oferta de noviembre', VERTICAL, false)! > v, 'en minúsculas, más');
  assert.equal(tamanoQueEntra('OFERTA\nDE NOVIEMBRE', VERTICAL, false), tamanoQueEntra('DE NOVIEMBRE', VERTICAL, false), 'cuenta el renglón más largo');
  assert.equal(tamanoQueEntra('hola', null, false), null, 'sin lienzo no se sabe');
  assert.equal(tamanoQueEntra('   ', VERTICAL, false), null);
  // La escala es la del motor.
  assert.match(leer('app/video-editor/_opencut/text/typography.ts'), new RegExp(`FONT_SIZE_SCALE_REFERENCE = ${REFERENCIA_TAMANO_LETRA};`));
  assert.match(leer('app/video-editor/_opencut/text/primitives.ts'), /text\.fontSize \* \(canvasHeight \/ FONT_SIZE_SCALE_REFERENCE\)/);
});

test('T2: el título del 12/11 (texto nuevo + tamaño 48) queda en uno que entra, y se dice', () => {
  const r = revisar([
    { op: 'agregar_texto', texto: 'OFERTA DE NOVIEMBRE', inicio: 0, duracion: 3, ref: 'n1' },
    { op: 'estilo_texto', ref: 'n1', estilo: { tamano: 48, color: '#FFD400', negrita: true } },
  ]);
  const entra = tamanoQueEntra('OFERTA DE NOVIEMBRE', VERTICAL, false)!;
  const nuevo = r.resueltas[0] as Extract<OperacionResuelta, { op: 'agregar_texto' }>;
  assert.equal(nuevo.params?.fontSize, entra, `el de siempre (${TAMANO_TEXTO_DE_SIEMPRE}) ya se salía: nace con el que entra`);
  assert.match(r.cambios[0].despues, /para que entre en el cuadro/);
  const estilo = r.resueltas.find((x) => x.op === 'params') as Extract<OperacionResuelta, { op: 'params' }> | undefined;
  // El tamaño pedido queda en el que entra (el que ya tiene): nunca más grande.
  assert.ok(estilo?.params.fontSize === undefined || estilo.params.fontSize === entra, `quedó en ${estilo?.params.fontSize}`);
  assert.equal(estilo?.params.color, '#ffd400');
  assert.match(r.descartes.join(), /el tamaño 48 saca «OFERTA DE NOVIEMBRE» del cuadro: queda en/);
});

test('T3: un texto que ya está, agrandado de más, se achica; uno que entra, no se toca', () => {
  const ref = refTexto();
  const grande = revisar([{ op: 'estilo_texto', ref, estilo: { tamano: 40 } }]);
  const p = grande.resueltas[0] as Extract<OperacionResuelta, { op: 'params' }>;
  assert.equal(p.params.fontSize, tamanoQueEntra('Oferta de noviembre', VERTICAL, false));
  const chico = revisar([{ op: 'estilo_texto', ref, estilo: { tamano: 4 } }]);
  assert.equal((chico.resueltas[0] as Extract<OperacionResuelta, { op: 'params' }>).params.fontSize, 4);
  assert.deepEqual(chico.descartes, []);
  // Un texto corto con el tamaño de siempre no se toca.
  const corto = revisar([{ op: 'agregar_texto', texto: 'YA', inicio: 0, duracion: 2 }]).resueltas[0] as Extract<OperacionResuelta, { op: 'agregar_texto' }>;
  assert.equal(corto.params, undefined);
});
