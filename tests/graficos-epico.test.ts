// Tests del Dashboard «épico» (14/10/2026, Martín: «Quiero el mismo criterio de EPICIDAD en los dashboards… Solo que ahí hay
// más graficos… Que se rediseñe todo»): la escala del número protagonista (ESCALA_EPICA, compartida con General) y el
// TITULAR de cada plantilla (lib/graficos-plantillas.ts).
// Correr: npx tsx --test tests/graficos-epico.test.ts
//
// Probados rompiéndolos (14/10/2026), con la base en 6 pases y 0 fallos, restaurando de memoria:
//   · `tamProtagonista` sin el tope por letras                        -> 4 / 2 («crece…», «nunca más ancho…»)
//   · `tamProtagonista` con el máximo en 64 (sin crecer)               -> 5 / 1 («crece con la tarjeta»)
//   · `conTitular` sin bajar el resto de la hoja                       -> 4 / 2 («el titular…», «ninguna plantilla se pisa»)
//   · `conTitular` sin la salida de «ya tiene titular»                 -> 4 / 2 («ninguna plantilla se pisa» —Comercial—, «una hoja que ya trae…»)
//   · TITULARES sin la fila de Closing                                 -> 6 / 0, A PROPÓSITO: sin elegido, el titular es el
//     primer número de la fila. Qué número es el titular de cada hoja es una decisión de producto, no algo que un test fije.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tamProtagonista, ESCALA_EPICA } from '../lib/graficos-gordo';
import { conTitular, PLANTILLAS_HOJA, componentesDe } from '../lib/graficos-plantillas';
import { esGrafico } from '../lib/graficos-catalogo';

test('crece con la tarjeta: la KPI chica queda como hoy y la de media hoja pasa los 70 px', () => {
  const chica = tamProtagonista(219, 'US$12.170'.length, 54);
  const grande = tamProtagonista(504, 'US$12.299'.length, 260);
  assert.ok(chica <= 44, `una KPI de 3 columnas: ${chica} px`);
  assert.ok(grande >= 70 && grande <= ESCALA_EPICA.maximo, `una de 6 × 6: ${grande} px`);
});

test('nunca más ancho que su tarjeta, y nunca más chico que la letra mínima', () => {
  for (const [ancho, texto] of [[132, 'US$280.420'], [176, '22'], [504, 'US$1.234.567'], [80, '99,9%']] as const) {
    const t = tamProtagonista(ancho, texto.length, 400);
    assert.ok(texto.length * ESCALA_EPICA.letraGruesa * t <= ancho + 1, `${texto} en ${ancho} px: ${t} px no entra`);
    assert.ok(t >= 13, `${texto} en ${ancho} px: ${t} px`);
  }
});

const kpi = (id: string, x: number) => ({ id, clase: 'grafico', tipo: 'numero', x, y: 0, w: 3, h: 4, subtitulo: 'algo' });

test('el titular va a media hoja, los demás en su grilla de 2 × 2, y el resto de la hoja baja lo que creció la fila', () => {
  const hoja = { componentes: [kpi('a', 0), kpi('b', 3), kpi('c', 6), kpi('d', 9), { id: 'g', clase: 'grafico', tipo: 'serie', x: 0, y: 4, w: 12, h: 8 }] };
  const out = conTitular(hoja, 'c').componentes as Array<Record<string, number | string>>;
  const de = (id: string) => out.find((c) => c.id === id)!;
  assert.deepEqual([de('c').x, de('c').y, de('c').w, de('c').h], [0, 0, 6, 6]);
  for (const id of ['a', 'b', 'd']) assert.ok(Number(de(id).x) >= 6 && Number(de(id).y) + Number(de(id).h) <= 6, `${id} fuera de su grilla`);
  assert.equal(de('g').y, 6, 'el gráfico de abajo baja 2 filas');
  assert.equal(de('a').subtitulo, '', 'los números de la cabecera van sin subtítulo');
});

test('cada plantilla del Dashboard tiene su titular: un número de media hoja o más, arriba de todo', () => {
  for (const p of PLANTILLAS_HOJA) {
    const cs = componentesDe(p);
    const arriba = Math.min(...cs.map((c) => c.y));
    const titular = cs.find((c) => esGrafico(c) && (c.tipo === 'numero' || c.tipo === 'numero_compacto') && c.y === arriba && c.w >= 6 && c.h >= 5);
    assert.ok(titular, `${p.id} no tiene titular`);
  }
});

test('ninguna plantilla se pisa: dos tarjetas no ocupan la misma celda de la grilla', () => {
  for (const p of PLANTILLAS_HOJA) {
    const cs = componentesDe(p);
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i]; const b = cs[j];
      const cruzan = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!cruzan, `${p.id}: ${a.id} (${a.x},${a.y} ${a.w}×${a.h}) pisa a ${b.id} (${b.x},${b.y} ${b.w}×${b.h})`);
    }
  }
});

test('una hoja que ya trae su titular no se vuelve a acomodar', () => {
  const hoja = { componentes: [{ ...kpi('t', 0), w: 6, h: 6 }, { ...kpi('s', 6), w: 6, h: 3 }] };
  assert.equal(conTitular(hoja, 't'), hoja);
});
