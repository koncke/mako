// =============================================================================
// El lienzo con SALIDAS: un punto por salida en el borde derecho, y la flecha sale de ahí
// =============================================================================
// Pedido de Martín (08/10/2026, punto 9): «A raíz de cada condicional, debería poder crear
// tarjetas arriba y abajo... Ya te había pedido que revises como lo hace Manychat». El
// molde, medido en su ayuda: todas las salidas de un nodo son puntos en su borde DERECHO,
// una fila por salida, y una tarjeta nueva se crea «clicking on the connection dot».
//
// `app/_components/Lienzo.tsx` lo comparte /mensajes, así que todo lo nuevo es OPCIONAL:
// sin `puertos` y sin `puerto`, la geometría es la de siempre (lo fija el primer test).
//
// PROBADO ROMPIÉNDOLO (08/10/2026; con todo puesto: 7 pasan, 0 fallan). Cada rotura de a
// una, aplicada y restaurada DE MEMORIA por un arnés (nunca con `git checkout`). Pasan / fallan:
//   1. `yDePuerto` cuenta las filas desde arriba (no desde el pie)              -> 6 / 1
//   2. `curvaEntre` ignora el puerto                                            -> 6 / 1
//   3. `aOrigen` deja las coordenadas negativas                                 -> 6 / 1
//   4. el ＋ de un punto vacío llama a `onAgregarTras` sin el puerto            -> 6 / 1
//   5. el ＋ del medio de una flecha inserta «después del nodo» (sin a.puerto)  -> 6 / 1
//   6. el encuadre sin descontar `insetDer`                                     -> 6 / 1
//   7. «Publicar» sin correrse con `insetDer`                                   -> 6 / 1
//   8. la papelera de la cabecera sin llamar a `onBorrar`                       -> 6 / 1
//   9. `TarjetaNodo` crece con su contenido aunque tenga puertos                -> 6 / 1
//  10. vuelve el ＋ de pasar el cursor en un nodo con puertos                   -> 6 / 1
//
// Correr: node --import tsx --test tests/lienzo-puertos.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  yDePuerto, curvaEntre, medioDeCurva, aOrigen, encerrar, centroDeFilas,
  ALTO_PUERTO, PIE_PUERTOS, BORDE_NODO, MARGEN, type NodoFlujo,
} from '../lib/lienzo-grafo';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const LIENZO = sinComentarios(leer('../app/_components/Lienzo.tsx'));
const tramo = (abre: string, cierra: string, tope: number): string => {
  const ini = LIENZO.indexOf(abre);
  assert.ok(ini >= 0, `no encontré «${abre}»`);
  const fin = LIENZO.indexOf(cierra, ini + abre.length);
  assert.ok(fin > ini, `no encontré «${cierra}»`);
  const b = LIENZO.slice(ini, fin);
  assert.ok(b.length < tope, `el recorte mide ${b.length}: está mirando otra cosa`);
  return b;
};

const tarjeta = (o: Partial<NodoFlujo> = {}): NodoFlujo => ({ id: 'n', tipo: 'condicion', titulo: 'Condición', icono: '🔀', x: 100, y: 200, ancho: 252, alto: 140, ...o });

test('sin puertos (el lienzo de /mensajes) la flecha sale de la cabecera, como siempre', () => {
  const a = tarjeta({ alto: 300 });
  assert.equal(yDePuerto(a), a.y + 44, 'el tope de 44 px de la cabecera');
  assert.equal(yDePuerto(tarjeta({ alto: 60 })), 200 + 30);
  const b = tarjeta({ id: 'b', x: 600, y: 50, alto: 90 });
  assert.equal(curvaEntre(a, b), curvaEntre(a, b, undefined));
  assert.match(curvaEntre(a, b), new RegExp(`^M ${a.x + a.ancho} ${a.y + 44} `));
  // Una salida ÚNICA (sin rótulo) también sale de la cabecera: no hay fila que dibujar.
  const simple = tarjeta({ puertos: [{ id: 'sig', vacio: false }] });
  assert.equal(yDePuerto(simple, 'sig'), yDePuerto(simple));
});

test('⚠️ cada FILA de salida tiene su altura, de arriba hacia abajo, contada desde el pie', () => {
  const n = tarjeta({ puertos: [{ id: 'r1', rotulo: 'Agendó', vacio: true }, { id: 'r2', rotulo: 'Pagó', vacio: false }, { id: 'si_no', rotulo: 'Si no', vacio: true }] });
  const ys = ['r1', 'r2', 'si_no'].map((p) => yDePuerto(n, p));
  assert.ok(ys[0] < ys[1] && ys[1] < ys[2], 'las filas no van de arriba hacia abajo');
  assert.equal(ys[1] - ys[0], ALTO_PUERTO);
  assert.equal(ys[2], n.y + n.alto - BORDE_NODO - PIE_PUERTOS - ALTO_PUERTO / 2, 'la última fila va pegada al pie');
  for (const y of ys) assert.ok(y > n.y && y < n.y + n.alto, 'un punto fuera de su tarjeta');
  // El centro de las filas (contra el que el árbol apila las ramas) es el del medio.
  assert.equal(n.y + centroDeFilas(n.alto, 3), ys[1]);
  // Y la flecha sale de SU fila.
  const b = tarjeta({ id: 'b', x: 700, y: 0, alto: 90 });
  assert.match(curvaEntre(n, b, 'r2'), new RegExp(`^M ${n.x + n.ancho} ${ys[1]} `));
  assert.equal(medioDeCurva(n, b, 'si_no').y, (ys[2] + b.y + 44) / 2);
});

test('⚠️ `aOrigen` lleva a coordenadas ≥ 0 sin mover nada respecto de nada', () => {
  const nodos = [tarjeta({ id: 'a', x: 0, y: -180 }), tarjeta({ id: 'b', x: 344, y: 40 }), tarjeta({ id: 'c', x: -20, y: 300 })];
  const out = aOrigen(nodos);
  assert.equal(Math.min(...out.map((n) => n.x)), MARGEN);
  assert.equal(Math.min(...out.map((n) => n.y)), MARGEN);
  assert.equal(out[1].y - out[0].y, nodos[1].y - nodos[0].y);
  assert.equal(out[2].x - out[1].x, nodos[2].x - nodos[1].x);
  assert.equal(nodos[0].y, -180, 'no se toca el layout de quien llama');
  const caja = encerrar(out);
  for (const n of out) assert.ok(n.x + n.ancho <= caja.ancho && n.y + n.alto <= caja.alto);
});

test('⚠️ el ＋ de una salida vacía y el ＋ del medio de una flecha insertan EN el puerto', () => {
  // El punto: un ＋ siempre visible en cada salida vacía, que llama con SU puerto.
  const puntos = tramo('(n.puertos ?? []).map((p) => {', '</div>\n          ))}', 3_200);
  assert.match(puntos, /const y = yDePuerto\(n, p\.id\);/);
  assert.match(puntos, /p\.vacio && puede && onAgregarTras &&/);
  assert.match(puntos, /onChange=\{\(v\) => v && onAgregarTras\(n\.id, v, p\.id\)\}/);
  assert.match(puntos, /opcionesEn \? opcionesEn\(n\.id, p\.id, false\)/);
  // El medio de una flecha: inserta en el puerto de ESA flecha, y la curva sale de él.
  const medio = tramo('{onAgregarTras && (opcionesEn || opcionesAgregar) && grafo.aristas.map((a, i) => {', '{grafo.aristas.map((a, i) => {', 3_000);
  assert.match(medio, /const m = medioDeCurva\(d, h, a\.puerto\);/);
  assert.match(medio, /onChange=\{\(v\) => v && onAgregarTras\(a\.desde, v, a\.puerto\)\}/);
  assert.match(medio, /opcionesEn \? opcionesEn\(a\.desde, a\.puerto, true\)/);
  assert.match(LIENZO, /d=\{curvaEntre\(d, h, a\.puerto\)\}/);
  // Un nodo con puertos no tiene, además, el ＋ de pasar el cursor: serían dos lugares.
  assert.match(LIENZO, /\{onAgregarTras && !n\.puertos && encima === n\.id/);
});

test('⚠️ `insetDer`: lo que flota a la derecha se corre, en los CUATRO lugares', () => {
  // Es la regla de AGENTS.md del inset izquierdo, contra el otro borde (el panel de «Probar»).
  const enc = tramo('const encuadrar = useCallback(', '}, [grafo.ancho', 3_000);
  assert.match(enc, /const wUtil = Math\.max\(1, w - insetIzq - insetDer\);/, 'el encuadre mete la última columna debajo del panel');
  assert.match(enc, /\+\$\{insetIzq\}\+\$\{insetDer\}`/, 'la firma del encuadre no cambia al abrir el panel: no reencuadra');
  assert.match(LIENZO, /left: insetIzq, right: insetDer, top: 0, padding: 14/, 'el chrome');
  assert.match(LIENZO, /data-esquina-ocupada style=\{\{ position: 'absolute', right: 12 \+ insetDer, bottom: 12 \}\}/, '«Publicar»');
  assert.match(LIENZO, /maxWidth: `calc\(100% - \$\{PANEL_MARGEN \* 2 \+ insetIzq \+ insetDer \+ 30\}px\)`/, 'el panel del nodo');
});

test('la papelera de la cabecera del panel borra la tarjeta (y cierra el panel)', () => {
  const cab = tramo('{onBorrar && (puedeBorrar?.(nodoSel.id) ?? true) && (', '{renderEditor(nodoSel)}', 1_600);
  assert.match(cab, /onClick=\{\(\) => \{ const id = nodoSel\.id; onSeleccion\(null\); onBorrar\(id\); \}\}/);
  assert.match(cab, /aria-label="Borrar esta tarjeta"/);
});

test('⚠️ con puertos la tarjeta tiene ALTO FIJO y las filas pegadas al pie', () => {
  // Si la tarjeta creciera con su contenido, las filas se correrían y cada flecha saldría
  // de la fila de al lado: el punto lo dibuja el lienzo afuera, contando desde el pie.
  const t = tramo('export function TarjetaNodo(', '\nexport function BotonChico', 3_400);
  assert.match(t, /const fijo = nodo\.puertos !== undefined;/);
  assert.match(t, /\.\.\.\(fijo \? \{ height: nodo\.alto, display: 'flex', flexDirection: 'column', overflow: 'hidden' \} : \{ minHeight: nodo\.alto \}\)/);
  assert.match(t, /padding: fijo \? `11px 11px \$\{PIE_PUERTOS\}px` : 11/);
  assert.match(t, /flex: 'none', height: ALTO_PUERTO/);
  assert.match(t, /border: `\$\{BORDE_NODO\}px solid \$\{borde\}`/);
});
