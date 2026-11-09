// =============================================================================
// Los clics de una landing: el dato estaba guardado y no había cómo pedirlo (9/11/2026)
// =============================================================================
// Ticket #66 (Mauricio Bustos, ws 1): «La API no expone conteos ni fechas de clics capturados por el
// píxel». Pedía además confirmar si los clics históricos estaban almacenados.
//
// ⚠️ LA RESPUESTA A ESO ES SÍ, Y SE MIDIÓ ANTES DE ESCRIBIR CÓDIGO. En producción, el 9/11/2026: el
// Pixel escribe los clics en `vsl_events` con `tipo_evento='click'` y el href o el texto del botón en
// `detalle` (migración 0133). En su negocio había 12 clics de 5 personas sobre el botón de Stripe que
// nombra el ticket, del 24/10 al 9/11. O sea que no había un dato perdido: había una puerta cerrada.
// Importa para la próxima: antes de prometer «vamos a empezar a guardarlo», mirar si ya está.
//
// Lo que prueba esto es lo que puede romperse SIN QUE SE NOTE, que no es el conteo (ése se ve) sino
// las tres decisiones de abajo.
//
// Correr: node --import tsx --test tests/landing-clics.test.ts
// ROTURAS (9/11/2026, una por vez y restaurada; base 6 / 0): anotadas en cada prueba.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { agruparPorBoton, esDeLaLanding, totalesDe, type FilaClic } from '../lib/landing-clics';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8');

const fila = (detalle: string | null, visitor: string, cuando: string, landing = 'https://sprint.ejemplo.com/'): FilaClic =>
  ({ detalle, visitor_id: visitor, created_at: cuando, landing_url: landing });

test('⚠️ cuenta PERSONAS distintas, no sólo clics: cinco toques de uno no son cinco leads', () => {
  // Es la diferencia entre «mi botón anda» y «mi botón lo tocó una persona cinco veces». El ticket
  // pide las dos cosas («Total de clics y visitantes únicos que hicieron clic») y la que se puede
  // perder sin que nadie lo note es la segunda.
  const r = agruparPorBoton([
    fila('RESERVA TU CUPO', 'v1', '2026-11-01T10:00:00.000Z'),
    fila('RESERVA TU CUPO', 'v1', '2026-11-01T10:00:05.000Z'),
    fila('RESERVA TU CUPO', 'v1', '2026-11-01T10:00:09.000Z'),
    fila('RESERVA TU CUPO', 'v2', '2026-11-02T11:00:00.000Z'),
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0].clics, 4);
  assert.equal(r[0].personas, 2, 'si esto dice 4, el negocio cree que tuvo el doble de interesados');
});

test('⚠️ el primero y el último salen del conjunto, no del orden en que llegaron las filas', () => {
  // La consulta las trae de la más nueva a la más vieja; si se tomara la primera fila como «primero»,
  // las dos fechas saldrían invertidas y nadie lo notaría mirando un número de clics.
  const r = agruparPorBoton([
    fila('Comprar', 'v1', '2026-11-05T10:00:00.000Z'),
    fila('Comprar', 'v2', '2026-10-01T10:00:00.000Z'),
    fila('Comprar', 'v3', '2026-11-02T10:00:00.000Z'),
  ]);
  assert.equal(r[0].primero, '2026-10-01T10:00:00.000Z');
  assert.equal(r[0].ultimo, '2026-11-05T10:00:00.000Z');
});

test('⚠️ un clic sin texto ni destino NO se tira: se nombra', () => {
  // El Pixel deja `detalle` en null cuando el toque no tuvo href ni texto (un ícono, un div con
  // onclick). Descartarlos haría que la suma de los botones no cierre con el total, y el primero en
  // notarlo sería el cliente restando a mano.
  const filas = [fila(null, 'v1', '2026-11-01T10:00:00.000Z'), fila('  ', 'v2', '2026-11-01T11:00:00.000Z'), fila('Comprar', 'v3', '2026-11-01T12:00:00.000Z')];
  const r = agruparPorBoton(filas);
  const suma = r.reduce((a, b) => a + b.clics, 0);
  assert.equal(suma, totalesDe(filas).clics, 'la suma de los botones tiene que cerrar con el total');
  assert.ok(r.some((b) => b.detalle === '(sin destino ni texto)'), 'y los sin texto se nombran, no desaparecen');
});

test('⚠️ la landing se compara NORMALIZADA: con utm y sin barra final es la misma página', () => {
  // Un `===` crudo deja afuera a casi todos y devuelve un cero que parece una respuesta.
  const normalizar = (s: string) => s.replace(/^https?:\/\//, '').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
  const pedida = normalizar('https://sprint.ejemplo.com/');
  assert.equal(esDeLaLanding(fila('x', 'v1', 'T', 'https://sprint.ejemplo.com/?utm_source=ig'), pedida, normalizar), true);
  assert.equal(esDeLaLanding(fila('x', 'v1', 'T', 'sprint.ejemplo.com'), pedida, normalizar), true);
  assert.equal(esDeLaLanding(fila('x', 'v1', 'T', 'https://otra.ejemplo.com/'), pedida, normalizar), false);
  // Sin landing pedida entran todas: la operación también sirve para el negocio entero.
  assert.equal(esDeLaLanding(fila('x', 'v1', 'T', 'https://otra.ejemplo.com/'), null, normalizar), true);
});

test('⚠️ un cero que es un error NO se devuelve como un cero', () => {
  // Lo pide el ticket con todas las letras: «Distinción entre cero eventos y datos no disponibles».
  // Es la misma regla que el repo ya aplica en el comportamiento de una landing («null = no se pudo
  // medir, NUNCA 0»). Un cero que en realidad es un error hace que alguien apague una campaña que
  // estaba funcionando.
  const srv = leer('lib/landing-clics-server.ts');
  assert.match(srv, /medido: false/, 'el camino del error devuelve medido: false');
  assert.match(srv, /if \(error\) return vacio;/, 'y se toma ANTES de agrupar nada');
  assert.match(srv, /medido: true/, 'y el camino bueno dice que midió');
});

test('⚠️ las pruebas del Pixel no cuentan, y las horas llevan su zona', () => {
  const srv = leer('lib/landing-clics-server.ts');
  // Mezclar los toques de quien está probando la instalación infla justo el número que alguien va a
  // mirar para decidir si su botón funciona.
  assert.match(srv, /\.is\('prueba', null\)/, 'sin esto, las pruebas de instalación cuentan como clics');
  // El ticket pide «Fecha y hora de cada clic, con zona horaria»: ISO en UTC, con la Z a la vista.
  assert.match(srv, /UTC \(terminan en Z\)/, 'la respuesta tiene que decir en qué zona están las horas');
  // Y la operación existe en la API, que es todo el punto del ticket.
  const def = leer('lib/api-mako/areas/landing.def.ts');
  assert.match(def, /id: 'listar_clics_landing', area: 'landing', tipo: 'lectura'/);
  assert.match(leer('lib/api-mako/areas/landing.run.ts'), /listar_clics_landing: \{/, 'definida sin implementar no sirve');
});
