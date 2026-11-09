// =============================================================================
// Las metas del reporte salen de la MISMA fuente que la pantalla (9/11/2026)
// =============================================================================
// Había DOS fuentes para «cuál es la meta», y cada una mandaba en un lado: los reportes por WhatsApp
// leían los tres settings viejos (`getObjetivoProgreso`) y la pantalla leía `objectives` (mig 0155).
// O sea que el cliente podía cambiar su meta en la pantalla y seguir recibiendo la vieja por
// WhatsApp — con las dos pantallas sanas y sin un error en ningún lado, que es la peor forma de
// estar mal.
//
// ⚠️ Y EL ÍTEM DEL TABLERO DECÍA CÓMO ARREGLARLO, Y ESTABA MAL: «mover esos dos call-sites a
// `objetivosContextoTexto()`». Esa función devuelve PROSA para un prompt, no números para una línea
// de reporte: seguirla al pie de la letra metía un párrafo de contexto adentro del WhatsApp del
// cliente. Queda escrito porque el próximo que lea ese ítem va a leer lo mismo.
//
// Correr: node --import tsx --test tests/objetivos-reporte.test.ts
// ROTURAS (9/11/2026, una por vez y restaurada; base 5 / 0): anotadas en cada prueba.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lineasDeMetas, type MetaParaReporte } from '../lib/objetivos-reporte';

const RAIZ = join(import.meta.dirname, '..');
const usd = (n: number) => `$${n.toLocaleString('en-US')}`;
const meta = (x: Partial<MetaParaReporte>): MetaParaReporte =>
  ({ titulo: 'Cash', metaValor: 20000, unidad: 'usd', actual: 5000, ...x });

test('⚠️ un objetivo que NO se pudo leer se dice: nunca sale como cero', () => {
  // Es la regla que la fuente nueva ya trae («actual: null, NUNCA cero por error») y que acá hay que
  // respetar. Un cliente que lee «$0 de $20,000» un lunes a la mañana toma decisiones con eso.
  const l = lineasDeMetas([meta({ actual: null, error: 'la consulta falló' })], usd);
  assert.match(l[0], /no pude leer el avance \(la consulta falló\)/);
  assert.doesNotMatch(l[0], /\$0 de/, 'un error jamás se dibuja como un cero');
});

test('⚠️ sin objetivos cargados se dice, y NO se cae al origen viejo', () => {
  // Caer a los tres settings es volver a tener las dos fuentes que este cambio vino a terminar.
  const l = lineasDeMetas([], usd);
  assert.equal(l.length, 1);
  assert.match(l[0], /Sin una meta cargada para este trimestre/);
  assert.match(l[0], /Objectives/, 'y dice DÓNDE se carga: un aviso sin salida no sirve');
});

test('la unidad manda: usd con formato de plata, el resto con separador de miles', () => {
  const [plata] = lineasDeMetas([meta({ titulo: 'Cash', unidad: 'usd', actual: 5000, metaValor: 20000 })], usd);
  assert.equal(plata, '   Cash: $5,000 de $20,000');
  const [cuenta] = lineasDeMetas([meta({ titulo: 'Cierres', unidad: 'cantidad', actual: 3, metaValor: 10 })], usd);
  assert.equal(cuenta, '   Cierres: 3 de 10');
});

test('⚠️ el ritmo es SÓLO del semanal: en el diario sería ruido', () => {
  // Un dato que cambia poco de un día al otro, repetido todos los días, es lo que hace que la gente
  // deje de leer el reporte entero.
  const m = [meta({ ritmo: { alDia: false, llegadaEstimada: '2027-02-14' } })];
  assert.doesNotMatch(lineasDeMetas(m, usd)[0], /ritmo|al día|atrasado/, 'el diario no lleva ritmo');
  const sem = lineasDeMetas(m, usd, { conRitmo: true })[0];
  assert.match(sem, /atrasado/);
  assert.match(sem, /a este ritmo llega el 2027-02-14/);
});

test('⚠️ los reportes ya NO leen los settings viejos: una sola fuente de la meta', () => {
  const r = readFileSync(join(RAIZ, 'lib/reportes.ts'), 'utf8');
  assert.doesNotMatch(r, /getObjetivoProgreso/, 'mientras exista este call-site hay dos fuentes');
  assert.match(r, /metasDelQuarter\(hoy\)/, 'y lee la misma que la pantalla');
  // Y no la OTRA función de la fuente nueva, que devuelve prosa para un prompt.
  assert.doesNotMatch(r, /objetivosContextoTexto/, 'eso metería un párrafo de contexto en el WhatsApp');
});
