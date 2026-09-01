// =============================================================================
// El apilado de la última toma, con el guion REAL que lo produjo
// =============================================================================
// El dueño, mirando su pantalla: «esto sigue estando mal». La toma 7 con «No
// entra en 8 segundos» y un párrafo del triple de su tope.
//
// Medido sobre el plan `ca7d57e1` de producción:
//
//     toma  tope  palabras  ratio
//       1     30      20     0.67     ← 41 palabras de lugar libre…
//       4     30      26     0.87
//       6     24      20     0.83
//       7     24      63     2.63     ← …y el triple del tope acá
//
//   190 palabras contra 192 de capacidad: **el guion ENTRABA**.
//
// La causa NO era el modelo —las siete tomas venían marcadas `literal`, o sea
// copiadas del repartidor sin que la IA tocara una palabra— ni un guion
// demasiado largo. Era el empaquetado: un relleno goloso dejaba huecos de 4 a 11
// palabras, y la compactación sólo podía mover una pieza si entraba ENTERA en un
// hueco. Con oraciones de 24 palabras sin comas para afinar, no había un solo
// movimiento legal. Dos mecanismos correctos que juntos no llegaban.
//
// Se reemplazaron por un reparto exacto (programación dinámica sobre grupos
// contiguos). Este test fija el resultado con el material real, porque el caso
// sintético NO lo reproducía: hace falta esta mezcla de oraciones largas sin
// comas para que las heurísticas se traben.

import test from 'node:test';
import assert from 'node:assert/strict';
import { repartirGuion, contarPalabrasReparto } from '../lib/guion-reparto';

/** El guion real del anuncio «Descentraliza las decisiones operativas». */
const GUION = [
  'Todo el mundo te dice que el problema de tu empresa es que contrataste mal a tus gerentes. ',
  'Es mentira. ',
  'El problema es que los tratas como empleados cuando necesitas que operen como dueños, pero sigues tomando cada decisión crítica por ellos. ',
  'Si tus directores de área no asumen la responsabilidad y cada entregable clave sigue pasando obligatoriamente por tu escritorio, es porque el sistema actual los entrena para esperar tu visto bueno. ',
  'Primero, deja de corregirles el trabajo en el momento en que te lo entregan. ',
  'Eso solo les enseña que no importa lo que hagan, tú vas a hacer el control de calidad final. ',
  'Segundo, establece un mecanismo donde la única respuesta a una duda operativa sea: "¿Cuál es tu propuesta y qué riesgo calculas?". ',
  'Oblígalos a defender la solución antes de darles una instrucción. ',
  'Cuando cambias esa dinámica, la capa media empieza a sostener la operación y tú puedes soltar la supervisión diaria sin miedo a que un cliente clave sufra retrasos. ',
  'Si estás listo para implementar este sistema en tu firma y lograr que tu equipo asuma el control real, agenda una llamada con el equipo. ',
].join('').trim();

/** Los topes reales: Car Talks repartió 4 tomas de 10 s y 3 de 8 s. */
const TOPES = [30, 30, 30, 30, 24, 24, 24];

test('el guion real ENTRA: 190 palabras contra 192 de capacidad', () => {
  assert.equal(contarPalabrasReparto(GUION), 190);
  assert.equal(TOPES.reduce((a, b) => a + b, 0), 192);
});

test('⚠️ ninguna toma se lleva más del 20% por encima de su tope', () => {
  // Antes: 2,63 — el triple. El techo de 1,2 es holgado a propósito: con 2
  // palabras de aire sobre 190 y oraciones atómicas, un reparto perfecto puede
  // no existir. Lo que no puede volver es el APILADO.
  const tomas = repartirGuion(GUION, TOPES);
  const peor = Math.max(...tomas.map((t, i) => t.palabras / TOPES[i]));
  assert.ok(peor <= 1.2, `la peor toma quedó en ${peor.toFixed(2)} de su tope`);
});

test('y el desborde se REPARTE en vez de caer todo en la última', () => {
  // El síntoma no era el desborde total —que es de 4 palabras— sino que cayera
  // entero en una sola toma habiendo lugar en las otras seis.
  const tomas = repartirGuion(GUION, TOPES);
  const sobra = tomas.map((t, i) => Math.max(0, t.palabras - TOPES[i]));
  assert.ok(Math.max(...sobra) <= 6, `una toma se pasó por ${Math.max(...sobra)} palabras`);
});

test('no se pierde ni se cambia una palabra', () => {
  // Es la garantía que ningún reparto puede romper: el CTA tiene que llegar
  // entero y en su lugar.
  const tomas = repartirGuion(GUION, TOPES);
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  assert.equal(norm(tomas.map((t) => t.voz).join(' ')), norm(GUION));
});

test('la última toma sigue terminando con el final del guion', () => {
  const tomas = repartirGuion(GUION, TOPES);
  assert.ok(tomas[tomas.length - 1].voz.trim().endsWith('agenda una llamada con el equipo.'));
});

test('ninguna toma queda muda', () => {
  const tomas = repartirGuion(GUION, TOPES);
  for (const [i, t] of tomas.entries()) {
    assert.ok(t.palabras > 0, `la toma ${i + 1} quedó sin texto`);
  }
});
