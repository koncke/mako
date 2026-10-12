// =============================================================================
// Video Editor, «Eliminar fondo» › «Eliminación automática» (paquete M, 11/10/2026)
// =============================================================================
// El recorte de la persona corre en el navegador con MediaPipe
// (app/video-editor/_opencut/fondo/). Lo que este test cuida, porque falla
// CALLADO (el clip se ve sin recortar y nada más):
//
//   1. EL WASM DEL CDN ES DE LA MISMA VERSIÓN QUE EL JS DE NPM. El .wasm sale de
//      jsdelivr con la versión escrita en segmentador.ts; el JS, de node_modules.
//      Un `npm install` que suba @mediapipe/tasks-vision (está con ^) sin tocar
//      la constante deja el JS de una versión hablando con el wasm de otra.
//   2. EL MODELO ESTÁ Y ES UN TFLITE. Sale de public/ve/modelos: si falta, o si
//      alguien lo reemplaza por otra cosa, el proxy o el 404 no avisan.
//   3. LA MÁSCARA: segmentar a lado largo 512 sin agrandar nunca; la rampa de
//      confianza a alfa en el sentido correcto (fondo → transparente); y el
//      suavizado con los bordes REPETIDOS: con el `blur()` del canvas, una
//      persona cortada por el borde del cuadro salía desvanecida contra el borde.
//
// Lo que este test NO ve: qué máscara devuelve MediaPipe para el modelo selfie
// (la documentación dice dos, fondo en el 0; el modelo trae un solo rótulo,
// «selfie»), ni el rendimiento. Eso se mira en el navegador.
//
// Correr: node --import tsx --test tests/video-editor-fondo.test.ts
// PROBADO ROMPIÉNDOLO (11/10/2026, de a una y restaurando):
//   R1 VERSION_MEDIAPIPE = "1.0.0" en segmentador.ts                    → 4/1 (de 5)
//   R2 tamanoSegmentacion sin el Math.min(1, …) (agranda lo chico)       → 4/1 (de 5)
//   R3 mascaraPersona sin invertir con esDeFondo                         → 4/1 (de 5)
//   R4 abajo del cuadro, la pasada vertical lee 0 (lo que hace blur())   → 3/2 (de 5)
// Restaurado: 5/0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	LADO_SEGMENTACION,
	mascaraPersona,
	tamanoSegmentacion,
} from '../app/video-editor/_opencut/fondo/mascara';

const RAIZ = join(import.meta.dirname, '..');

test('1. el wasm del CDN es de la misma versión que @mediapipe/tasks-vision de node_modules', () => {
	const fuente = readFileSync(join(RAIZ, 'app/video-editor/_opencut/fondo/segmentador.ts'), 'utf8');
	const constante = /export const VERSION_MEDIAPIPE = "([^"]+)"/.exec(fuente)?.[1];
	assert.ok(constante, 'no encontré VERSION_MEDIAPIPE en segmentador.ts');
	const instalada = JSON.parse(
		readFileSync(join(RAIZ, 'node_modules/@mediapipe/tasks-vision/package.json'), 'utf8'),
	).version;
	assert.equal(
		constante,
		instalada,
		`segmentador.ts baja el wasm ${constante} y node_modules trae el JS ${instalada}: actualizá la constante`,
	);
	assert.match(fuente, /cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-vision@\$\{VERSION_MEDIAPIPE\}\/wasm/);
});

test('2. el modelo selfie está en public/ve/modelos y es un TFLite chico', () => {
	const bytes = readFileSync(join(RAIZ, 'public/ve/modelos/selfie_segmenter.tflite'));
	assert.equal(bytes.subarray(4, 8).toString('latin1'), 'TFL3', 'no es un flatbuffer de TFLite');
	assert.ok(bytes.length < 1_000_000, `pesa ${bytes.length} B: ¿cambiaron el modelo?`);
	// El rótulo del modelo (el labels.txt que lleva pegado) es «selfie»: una sola
	// máscara de MediaPipe es la PERSONA, no el fondo.
	assert.ok(bytes.includes(Buffer.from('selfie')), 'el modelo no trae el rótulo «selfie»');
});

test('3. se segmenta con el lado largo en 512, sin agrandar nunca', () => {
	assert.deepEqual(tamanoSegmentacion(1920, 1080), { ancho: 512, alto: 288 });
	assert.deepEqual(tamanoSegmentacion(1080, 1920), { ancho: 288, alto: 512 });
	assert.deepEqual(tamanoSegmentacion(3840, 2160), { ancho: 512, alto: 288 });
	assert.deepEqual(tamanoSegmentacion(300, 200), { ancho: 300, alto: 200 });
	assert.deepEqual(tamanoSegmentacion(0, 0), { ancho: 1, alto: 1 });
	const t = tamanoSegmentacion(1000, 7);
	assert.ok(t.ancho === LADO_SEGMENTACION && t.alto >= 1);
});

function alfas(confianza: number[], esDeFondo: boolean, ancho: number, alto: number): number[] {
	const rgba = new Uint8ClampedArray(ancho * alto * 4);
	mascaraPersona({ confianza, esDeFondo, ancho, alto, rgba, tmp: new Float32Array(ancho * alto) });
	return Array.from({ length: ancho * alto }, (_, i) => rgba[i * 4 + 3]);
}

test('4. la confianza pasa a alfa en el sentido correcto', () => {
	// Máscara de PERSONA: 1 = persona (opaco), 0 = fondo (transparente).
	assert.deepEqual(alfas([1, 1, 1, 1], false, 2, 2), [255, 255, 255, 255]);
	assert.deepEqual(alfas([0, 0, 0, 0], false, 2, 2), [0, 0, 0, 0]);
	// Máscara de FONDO (la 0 cuando MediaPipe da dos): al revés.
	assert.deepEqual(alfas([1, 1, 1, 1], true, 2, 2), [0, 0, 0, 0]);
	assert.deepEqual(alfas([0, 0, 0, 0], true, 2, 2), [255, 255, 255, 255]);
	// La mitad de la rampa es medio transparente, y la rampa no se da vuelta.
	assert.deepEqual(alfas([0.5, 0.5, 0.5, 0.5], false, 2, 2), [128, 128, 128, 128]);
	const rampa = [0, 0.2, 0.35, 0.5, 0.65, 0.8, 1].map((c) => alfas(Array(9).fill(c), false, 3, 3)[4]);
	for (let i = 1; i < rampa.length; i++) assert.ok(rampa[i] >= rampa[i - 1], `rampa: ${rampa.join(', ')}`);
	assert.equal(rampa[0], 0);
	assert.equal(rampa[rampa.length - 1], 255);
});

test('5. el suavizado no desvanece a la persona contra el borde del cuadro', () => {
	// 6×4: la persona ocupa las dos filas de abajo de punta a punta (un torso
	// cortado por el borde inferior). El borde de abajo y los costados tienen que
	// quedar opacos; el corte con el fondo, suave.
	const ancho = 6;
	const alto = 4;
	const confianza = Array.from({ length: ancho * alto }, (_, i) => (Math.floor(i / ancho) >= 2 ? 1 : 0));
	const a = alfas(confianza, false, ancho, alto);
	const fila = (y: number) => a.slice(y * ancho, (y + 1) * ancho);
	assert.deepEqual(fila(3), Array(ancho).fill(255), `fila de abajo: ${fila(3).join(', ')}`);
	assert.deepEqual(fila(0), Array(ancho).fill(0), `fila de arriba: ${fila(0).join(', ')}`);
	// En el corte, entre medio (ni duro ni perdido).
	for (const v of [...fila(1), ...fila(2)]) assert.ok(v > 0 && v < 255, `corte: ${fila(1).join(', ')} / ${fila(2).join(', ')}`);
});
