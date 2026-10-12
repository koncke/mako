// =============================================================================
// Video Editor, transiciones: la ventana, el tope y las puntas (paquete G, 11/10/2026)
// =============================================================================
// Una transición de CapCut entre A (izquierda) y B (derecha) se dibuja en una
// ventana CENTRADA en el corte, sin cambiar la duración total: A se ve D/2 de más
// y B empieza D/2 antes (app/video-editor/_opencut/transiciones/escena.ts). Lo
// que falla sin error, y por eso se prueba acá:
//
//   1. LAS PUNTAS SON LA IDENTIDAD. El clip que sale en p = 0 y el que entra en
//      p = 1 tienen que quedar exactamente como sin transición, o pegan un salto
//      al entrar o salir de la ventana (un cuadro corrido, un parpadeo de opacidad
//      o un pase de más). Nadie lo ve en una captura: se ve reproduciendo.
//   2. CADA UNIFORM QUE MANDA UN PASE `ce-tr-*` ESTÁ DECLARADO en su shader. Uno
//      mal escrito da una ubicación nula y el pase no hace nada, en silencio
//      (pases-ce.ts atrapa los errores para que la reproducción siga).
//      Y ninguno se declara DOS veces (2b): «redefinition», el pase no compila
//      y la transición tampoco hace nada.
//   3. LA VENTANA: centrada, topeada a la mitad del clip más corto, sólo entre
//      clips PEGADOS y con un id que existe; y si A y B son del MISMO medio, B
//      pide cuadros a otro decodificador (con uno solo, el videoCache le devuelve
//      a uno el cuadro del otro).
//   4. LA FUENTE FUERA DEL TRAMO se acota al medio: antes del 0 el primer cuadro,
//      después del final un milisegundo antes del final (en el final exacto el
//      decodificador ya no tiene cuadro).
//   6. LOS BARRIDOS MIRAN A LA PANTALLA, no a la capa. El pase corre sobre la
//      fuente ANTES de que el compositor la voltee y la gire: «Barrido a la
//      izquierda» sobre un clip reflejado barría hacia la derecha.
//
// Lo que este test NO ve: si el GLSL compila en WebGL2, ni cómo se ve.
//
// Correr: node --import tsx --test tests/video-editor-transiciones.test.ts
// PROBADO ROMPIÉNDOLO: ver el final del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRANSICIONES, direccionEnCapa, escalaQueCubre, transicionPorId } from '../app/video-editor/_opencut/transiciones/catalogo';
import { aplicarTransiciones } from '../app/video-editor/_opencut/transiciones/gancho';
import { acotarFuente, fueraDeVentana, transicionesDePista } from '../app/video-editor/_opencut/transiciones/escena';
import { corteMuyCorto, cortesDePista, sinTransicion } from '../app/video-editor/_opencut/transiciones/reglas';
import {
  PARAM_TRANSICION_DURACION,
  PARAM_TRANSICION_ID,
  TR_ENTRA_DURACION,
  TR_ENTRA_ID,
  TR_SALE_DURACION,
  TR_SALE_ID,
} from '../app/video-editor/_opencut/transiciones/claves';
import { shadersRegistrados } from '../app/video-editor/_opencut/services/renderer/pases-ce';
import type { EstadoVisual } from '../app/video-editor/_opencut/services/renderer/ganchos-ce';
import type { TimelineElement } from '../app/video-editor/_opencut/timeline';

const TPS = 1000; // ticks por segundo de prueba (el real sale del WASM)
const LIENZO = { width: 1920, height: 1080 };
const BASE: EstadoVisual = {
  transform: { scaleX: 0.8, scaleY: -0.8, position: { x: 30, y: -12 }, rotate: 7 },
  opacity: 0.9,
};

function clip(id: string, inicio: number, dur: number, extra: Record<string, unknown> = {}): TimelineElement {
  return {
    id,
    type: 'video',
    name: id,
    mediaId: (extra.mediaId as string) ?? `m-${id}`,
    startTime: inicio * TPS,
    duration: dur * TPS,
    trimStart: 0,
    trimEnd: 0,
    params: (extra.params as Record<string, string | number | boolean>) ?? {},
  } as unknown as TimelineElement;
}

/** Los uniforms declarados de un fragment («uniform vec2 u_a;»). */
function declarados(fuente: string): Set<string> {
  const nombres = new Set<string>();
  for (const m of fuente.replace(/\/\/.*$/gm, '').matchAll(/^\s*uniform\s+(?:highp\s+|mediump\s+|lowp\s+)?\w+\s+([^;]+);/gm)) {
    for (const parte of m[1].split(',')) nombres.add(parte.trim().replace(/\[.*\]$/, ''));
  }
  return nombres;
}

test('1: el que sale en p=0 y el que entra en p=1 quedan como sin transición', () => {
  const malos: string[] = [];
  for (const def of TRANSICIONES) {
    for (const [rol, p] of [['sale', 0], ['entra', 1]] as const) {
      const r = def.aplicar(rol, p, BASE, LIENZO);
      const igual =
        r.opacity === BASE.opacity &&
        Object.is(r.transform.scaleX, BASE.transform.scaleX) &&
        Object.is(r.transform.scaleY, BASE.transform.scaleY) &&
        r.transform.position.x === BASE.transform.position.x &&
        r.transform.position.y === BASE.transform.position.y &&
        r.transform.rotate === BASE.transform.rotate &&
        (r.pases ?? []).length === 0;
      if (!igual) malos.push(`${def.id} (${rol} en p=${p}): ${JSON.stringify(r)}`);
    }
  }
  assert.deepEqual(malos, []);
});

test('2: cada uniform de un pase ce-tr-* está declarado en su shader', () => {
  const ENTRADAS = new Set(['u_textura', 'u_texturaB', 'u_resolucion', 'u_lutTex', 'u_lutTamano']);
  const sueltos: string[] = [];
  let pases = 0;
  for (const def of TRANSICIONES) {
    for (const rol of ['sale', 'entra'] as const) {
      for (let i = 1; i < 20; i++) {
        for (const pase of def.aplicar(rol, i / 20, BASE, LIENZO).pases ?? []) {
          pases++;
          const fuente = shadersRegistrados().get(pase.shader);
          if (!fuente) {
            sueltos.push(`${def.id}: ${pase.shader} sin registrar`);
            continue;
          }
          const d = declarados(fuente);
          for (const nombre of Object.keys(pase.uniforms)) {
            if (ENTRADAS.has(nombre) || !d.has(nombre)) sueltos.push(`${def.id} → ${pase.shader}.${nombre}`);
          }
        }
      }
    }
  }
  assert.ok(pases > 100, `se esperaban pases en el medio de las transiciones, hubo ${pases}`);
  assert.deepEqual([...new Set(sueltos)], []);
});

test('2b: ningún shader ce-tr-* redeclara un uniform (la CABECERA ya trae u_capa, u_giro, u_tiempo…)', () => {
  // Uno repetido es «redefinition» al compilar: pases-ce.ts lo atrapa y la
  // transición no hace nada, sin otro aviso que la consola (como el Remolino).
  const repetidos: string[] = [];
  for (const [id, fuente] of shadersRegistrados()) {
    if (!id.startsWith('ce-tr-')) continue;
    const vistos = new Set<string>();
    for (const m of fuente.replace(/\/\/.*$/gm, '').matchAll(/^\s*uniform\s+(?:highp\s+|mediump\s+|lowp\s+)?\w+\s+([^;]+);/gm)) {
      for (const parte of m[1].split(',')) {
        const nombre = parte.trim().replace(/\[.*\]$/, '');
        if (vistos.has(nombre)) repetidos.push(`${id}.${nombre}`);
        vistos.add(nombre);
      }
    }
  }
  assert.deepEqual(repetidos, []);
});

test('3: ventana centrada, topeada, sólo entre clips pegados y con un id que existe', () => {
  // A de 2 s y B de 1 s, pegados; pide 2 s → el tope es 0,5 s (mitad de B).
  const a = clip('a', 0, 2, { params: { [PARAM_TRANSICION_ID]: 'mezclar', [PARAM_TRANSICION_DURACION]: 2 } });
  const b = clip('b', 2, 1);
  const tr = transicionesDePista([a, b], TPS);
  assert.deepEqual(tr.get('a')?.ventana, { antes: 0, despues: 250 });
  assert.deepEqual(tr.get('b')?.ventana, { antes: 250, despues: 0 });
  assert.equal(tr.get('a')?.params[TR_SALE_ID], 'mezclar');
  assert.equal(tr.get('a')?.params[TR_SALE_DURACION], 0.5);
  assert.equal(tr.get('b')?.params[TR_ENTRA_ID], 'mezclar');
  assert.equal(tr.get('b')?.params[TR_ENTRA_DURACION], 0.5);
  // Los params del elemento no se tocan: la escena trabaja sobre una copia.
  assert.equal(TR_SALE_ID in a.params, false);
  // Distintos medios: cada uno con su decodificador de siempre.
  assert.equal(tr.get('b')?.claveDecodificador, undefined);

  // Con un hueco de un cuadro no rige (y D no dibuja el ⧓).
  assert.equal(transicionesDePista([a, clip('b', 2.04, 1)], TPS).size, 0);
  // Un id que no está en el catálogo no se dibuja.
  const raro = clip('a', 0, 2, { params: { [PARAM_TRANSICION_ID]: 'no-existe' } });
  assert.equal(transicionesDePista([raro, b], TPS).size, 0);
  // El mismo medio a los dos lados: el de la derecha pide a otro decodificador.
  const a2 = clip('a', 0, 2, { mediaId: 'm', params: { [PARAM_TRANSICION_ID]: 'mezclar' } });
  const b2 = clip('b', 2, 1, { mediaId: 'm' });
  const t2 = transicionesDePista([a2, b2], TPS);
  assert.equal(t2.get('a')?.claveDecodificador, undefined);
  assert.equal(t2.get('b')?.claveDecodificador, 'm#transicion');
  // Clips de 0,1 s: el tope (0,05 s) no llega al mínimo del deslizador.
  assert.equal(corteMuyCorto(clip('x', 0, 0.1), clip('y', 0.1, 1), TPS), true);
  assert.equal(cortesDePista([b, a]).length, 1);
});

test('3b: el progreso que ve el gancho sale del instante SIN acotar', () => {
  const entra = { [TR_ENTRA_ID]: 'mezclar', [TR_ENTRA_DURACION]: 1 };
  // B arranca la ventana medio segundo antes de su inicio (p = 0) y llega a la mitad en el corte.
  assert.equal(aplicarTransiciones(BASE, { params: entra, tiempo: -0.5, duracion: 3, lienzo: LIENZO }).opacity, 0);
  assert.ok(Math.abs(aplicarTransiciones(BASE, { params: entra, tiempo: 0, duracion: 3, lienzo: LIENZO }).opacity - 0.45) < 1e-9);
  assert.equal(aplicarTransiciones(BASE, { params: entra, tiempo: 0.5, duracion: 3, lienzo: LIENZO }).opacity, 0.9);
  // A con «Empujar a la izquierda»: medio lienzo corrido en la mitad (después del final del clip).
  const sale = { [TR_SALE_ID]: 'empujar-izquierda', [TR_SALE_DURACION]: 1 };
  const enCorte = aplicarTransiciones(BASE, { params: sale, tiempo: 3, duracion: 3, lienzo: LIENZO });
  assert.equal(enCorte.transform.position.x, 30 - 960);
  assert.equal(aplicarTransiciones(BASE, { params: sale, tiempo: 2.4, duracion: 3, lienzo: LIENZO }), BASE);
});

test('4: fuera del tramo, la fuente se acota a lo que el medio tiene', () => {
  assert.equal(acotarFuente({ tiempo: -300, fin: 5000, tps: TPS }), 0);
  assert.equal(acotarFuente({ tiempo: 4200, fin: 5000, tps: TPS }), 4200);
  assert.equal(acotarFuente({ tiempo: 5600, fin: 5000, tps: TPS }), 4999);
  assert.equal(fueraDeVentana({ duration: 1000 }, -1), true);
  assert.equal(fueraDeVentana({ duration: 1000, ventanaCe: { antes: 250, despues: 0 } }, -250), false);
  assert.equal(fueraDeVentana({ duration: 1000, ventanaCe: { antes: 0, despues: 250 } }, 1249), false);
  assert.equal(fueraDeVentana({ duration: 1000, ventanaCe: { antes: 0, despues: 250 } }, 1250), true);
});

test('5: girar cubre el lienzo y sinTransicion saca sólo lo de la transición', () => {
  assert.equal(escalaQueCubre(0, LIENZO), 1);
  assert.ok(Math.abs(escalaQueCubre(90, LIENZO) - 1920 / 1080) < 1e-9);
  const p = { volume: 0, [PARAM_TRANSICION_ID]: 'circulo', [PARAM_TRANSICION_DURACION]: 1 };
  assert.deepEqual(sinTransicion(p), { volume: 0 });
  const sin = { volume: 0 };
  assert.equal(sinTransicion(sin), sin);
});

test('6: los barridos se orientan en la pantalla aunque la capa esté reflejada o girada', () => {
  const con = (scaleX: number, scaleY: number, rotate: number): EstadoVisual => ({
    transform: { scaleX, scaleY, position: { x: 0, y: 0 }, rotate },
    opacity: 1,
  });
  // Sin voltear ni girar, la dirección de la pantalla ES la de la capa.
  assert.deepEqual(direccionEnCapa([-1, 0], con(1, 1, 0)), [-1, 0]);
  // Reflejado en horizontal: la izquierda de la pantalla es la derecha de la imagen.
  assert.deepEqual(direccionEnCapa([-1, 0], con(-1, 1, 0)), [1, 0]);
  assert.deepEqual(direccionEnCapa([0, -1], con(1, -1, 0)), [0, 1]);
  // Girado 90° en sentido horario: la izquierda de la pantalla es el «abajo» de la imagen.
  assert.deepEqual(direccionEnCapa([-1, 0], con(1, 1, 90)), [0, -1]);
  // Y el pase que arma el catálogo lleva la dirección ya llevada a la capa.
  const barrido = transicionPorId('barrido-izquierda');
  assert.ok(barrido);
  const pase = barrido.aplicar('entra', 0.5, con(-0.8, 0.8, 0), LIENZO).pases?.[0];
  assert.deepEqual(pase?.uniforms.u_direccion, [1, 0]);
});

// PROBADO ROMPIÉNDOLO (11/10/2026, de a una y restaurando; base 6/0):
//   R1 «Mezclar» con el que entra en `suave(p) * 0.99` (no llega a 1)          → 4/2 (1 y 3b)
//   R2 la máscara declara `u_suave` y el pase manda `u_suavidad`               → 5/1 (2)
//   R3 la escena con la duración PEDIDA, sin el tope de la mitad del más corto → 5/1 (3)
//   R4 el mismo medio a los dos lados sin decodificador aparte                 → 5/1 (3)
//   R5 acotarFuente pidiendo el final exacto del medio                         → 5/1 (4)
//   R6 el gancho con el instante acotado a 0 (`Math.max(0, tiempo)`)           → 5/1 (3b)
// Restaurado: 6/0.
// Y el 2b y el 6 (uniforms repetidos, orientación de los barridos), sumados después:
//   R7 `direccionEnCapa` sin mirar el signo de la escala                     → 6/1 (6)
//   R8 el barrido con la dirección de la pantalla, sin `direccionEnCapa`     → 6/1 (6)
//   R9 la máscara redeclara `uniform float u_tiempo;` (ya está en CABECERA)  → 7/1 (2b)
// Restaurado: 8/0.
