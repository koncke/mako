// =============================================================================
// Una flecha arrastrada se puede SOLTAR sobre la pastilla de una espera (bug 4 del 13/10/2026)
// =============================================================================
// Mauricio, reunión del 13/10 (Fathom 858927676 @36:37): «las líneas de conexión desde el botón de sumar no se sueltan
// ni se guardan correctamente al arrastrarlas». Una espera con UN padre y una salida se dibuja como pastilla sobre la
// flecha (`colapsable`, lib/flujo-conversacion.ts) y la pastilla no era un lugar donde soltar (`tarjetaBajo`,
// app/_components/Lienzo.tsx: sólo `[data-nodo]`). Conectar el segundo audio de «Un Lead Agendó Llamada» a la espera
// de 2 h no tenía dónde soltarse. El DATO siempre lo admitió (`conectar` a una espera); lo que faltaba era el lienzo.
//
// PROBADO ROMPIÉNDOLO (14/10/2026), cada rotura de a una y restaurada. Pasan / fallan:
//   R1 `tarjetaBajo` vuelve a mirar sólo `[data-nodo]`                                   → 2 / 1
//   R2 la pastilla sigue atenuada debajo del cursor (`sobreFlecha !== e.id` fuera)       → 2 / 1
//
// Correr: node --import tsx --test tests/lienzo-soltar-en-espera.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conectar } from '../lib/flujo-edicion';
import { grafoDeSecuencia, type PasoParaGrafo } from '../lib/flujo-conversacion';
import type { PasoGrafo } from '../lib/flujo-grafo';

const msg = (id: string, siguiente: string | null): PasoGrafo => ({ id, canal: 'whatsapp', cuerpo: id, siguiente, delay_horas: 0 });
// a → ⏳2 h (pastilla) → c, y b suelto: conectar b a la espera.
const PASOS: PasoGrafo[] = [msg('a', 'e'), { id: 'e', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 120 }, siguiente: 'c' }, msg('c', null), msg('b', null)];
const enFlecha = (pasos: readonly PasoGrafo[]) => grafoDeSecuencia(pasos as PasoParaGrafo[], { disparador: 'x' }).nodos.filter((n) => n.enFlecha).map((n) => n.id);

test('el dato: conectar una tarjeta a una espera que se dibuja como pastilla se puede, y la espera pasa a ser tarjeta', () => {
  assert.deepEqual(enFlecha(PASOS), ['e'], 'la espera con un padre va como pastilla');
  const r = conectar(PASOS, 'b', 'sig', 'e');
  assert.equal(r.ok, true, r.ok ? '' : r.motivo);
  assert.deepEqual(enFlecha(r.pasos), [], 'con dos padres se dibuja como tarjeta');
});

const LIENZO = readFileSync(new URL('../app/_components/Lienzo.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
test('el lienzo: soltar sobre la pastilla la toma como destino', () => {
  const ini = LIENZO.indexOf('const tarjetaBajo = (clientX: number, clientY: number, salvo: string): string | null => {');
  assert.ok(ini > 0, 'no encontré tarjetaBajo');
  const fn = LIENZO.slice(ini, LIENZO.indexOf('\n  };', ini));
  assert.match(fn, /closest\('\[data-pildora\]'\)\?\.getAttribute\('data-pildora'\)/, 'la pastilla no recibe la flecha');
});

test('el lienzo: mientras se arrastra, la pastilla de abajo del cursor no queda atenuada', () => {
  assert.match(LIENZO, /opacity: !vista \? 0 : arrastreFlecha && sobreFlecha !== e\.id \? ATENUADO : 1/);
});
