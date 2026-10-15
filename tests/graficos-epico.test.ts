// Tests del Dashboard «épico» (14/10/2026, Martín: «Quiero el mismo criterio de EPICIDAD en los dashboards… Solo que ahí hay
// más graficos… Que se rediseñe todo»): la escala del número protagonista (ESCALA_EPICA, compartida con General). El
// TITULAR 6 × 6 de cada plantilla se fue el 15/10/2026: lo reemplaza la PORTADA (tests/graficos-portadas.test.ts).
// Correr: npx tsx --test tests/graficos-epico.test.ts
//
// Probados rompiéndolos (14/10/2026), con la base en 6 pases y 0 fallos (hoy son 2: los del titular se fueron), restaurando de memoria:
//   · `tamProtagonista` sin el tope por letras                        -> 4 / 2 («crece…», «nunca más ancho…»)
//   · `tamProtagonista` con el máximo en 64 (sin crecer)               -> 5 / 1 («crece con la tarjeta»)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tamProtagonista, ESCALA_EPICA } from '../lib/graficos-gordo';

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
