// =============================================================================
// «Estilo de la hoja» en la ficha del lead, con los AJUSTES del Dashboard (17/10/2026)
// =============================================================================
// El Dashboard sumó ajustes encima de la plantilla del estilo (fondo, esquinas, borde, sombra y títulos de las tarjetas;
// AJUSTES_TEMA, lib/graficos-temas.ts) y avisó qué faltaba para prenderlos en la ficha. Lo que se fija, EJECUTANDO:
//   1. el cambio `tema` de la ficha copia los ajustes (sin esto, uno se perdía sin error) y «plantilla» vuelve al de ella;
//   2. un tema con SÓLO ajustes pinta las variables de la tarjeta (`temaPropio`, no las tres de antes);
//   3. MaKo los cambia por `opcion` en `estilo` («esquinas=redondas») y ve cuáles hay; lo que no existe vuelve con los que hay;
//   4. el panel de la ficha se abre con `ajustes`.
//
// PROBADO ROMPIÉNDOLO (17/10/2026), con el archivo en 4 / 0, una rotura por vez y restaurada:
//   · el cambio `tema` sin copiar los ajustes                            → 2 / 2 (la API también pasa por ese saneo)
//   · `estiloDeFicha` con las tres de antes en vez de `temaPropio`        → 3 / 1
//   · la API sin leer `opcion` en `estilo`                                → 3 / 1
//   · el panel de la ficha sin `ajustes`                                  → 3 / 1
// Correr: node --import tsx --test tests/ficha-estilo-ajustes.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { aplicarCambio, fichaEfectiva, sanearCambio, RESPALDO_VACIO, type CambioFicha } from '../lib/ficha/config';
import { cambioDeInputApi, salidaFichaApi } from '../lib/ficha/api';
import { estiloDeFicha } from '../app/crm/lead-view/ficha/armar';
import { DENSIDAD_BASE } from '../lib/ficha/catalogo';
import { TEMA_BASE } from '../lib/graficos-temas';

const RAIZ = join(__dirname, '..');
const TIPO = 'dos-reuniones' as const;
const R = RESPALDO_VACIO;
const cambio = (raw: unknown): CambioFicha => {
  const c = sanearCambio(raw);
  assert.ok(!('error' in c), JSON.stringify(c));
  return c as CambioFicha;
};

test('el cambio `tema` de la ficha guarda los ajustes, y «plantilla» vuelve al de la plantilla', () => {
  const r1 = aplicarCambio({}, cambio({ op: 'tema', tema: { esquinas: 'redondas', sombra: 'si' } }), TIPO, R);
  assert.ok(r1.ok && r1.cambio, 'un ajuste no cambió nada: se perdió en el saneo');
  const t1 = fichaEfectiva(TIPO, r1.ok ? r1.ficha : {}, R).estilo.tema;
  assert.equal(t1.esquinas, 'redondas');
  assert.equal(t1.sombra, 'si');
  const r2 = aplicarCambio(r1.ok ? r1.ficha : {}, cambio({ op: 'tema', tema: { esquinas: 'plantilla' } }), TIPO, R);
  const t2 = fichaEfectiva(TIPO, r2.ok ? r2.ficha : {}, R).estilo.tema;
  assert.equal(t2.esquinas, undefined, '«plantilla» vuelve al de la plantilla');
  assert.equal(t2.sombra, 'si', 'y no toca los otros');
});

test('un tema con SÓLO ajustes pinta la tarjeta de la ficha', () => {
  const solo = estiloDeFicha({ tema: { ...TEMA_BASE, esquinas: 'redondas' }, densidad: DENSIDAD_BASE });
  assert.ok(solo.clases.includes('fb--tema'), 'sin `temaPropio`, un tema con sólo ajustes no pinta');
  assert.ok(Object.keys(solo.vars).length > 0);
  assert.ok(!estiloDeFicha({ tema: TEMA_BASE, densidad: DENSIDAD_BASE }).clases.includes('fb--tema'), 'el tema de siempre no pinta nada');
});

test('MaKo cambia los ajustes por `opcion` y ve cuáles hay', () => {
  const c = cambioDeInputApi({ cambio: 'estilo', opcion: 'esquinas=redondas, sombra=si' });
  assert.deepEqual(c, { op: 'tema', tema: { esquinas: 'redondas', sombra: 'si' } });
  const vuelta = cambioDeInputApi({ cambio: 'estilo', opcion: 'esquinas=plantilla' });
  assert.ok(!('error' in vuelta) && vuelta.op === 'tema' && 'esquinas' in vuelta.tema && vuelta.tema.esquinas === undefined);
  const malo = cambioDeInputApi({ cambio: 'estilo', opcion: 'esquinas=locas' });
  assert.ok('error' in malo && Array.isArray(malo.disponibles), 'un ajuste que no existe vuelve con los que hay');
  const v = salidaFichaApi({ funnel: { id: 1, nombre: 'X', esDefault: true }, eleccion: { id: TIPO, porque: 'x' }, efectiva: fichaEfectiva(TIPO, { estilo: { tema: { ...TEMA_BASE, esquinas: 'rectas' } } }, R) });
  const esq = v.estilo.ajustes.find((a) => a.ajuste === 'esquinas');
  assert.equal(esq?.elegido, 'rectas');
  assert.ok(esq?.valores.includes('redondas'));
});

test('el panel de la ficha se abre con los ajustes', () => {
  const panel = readFileSync(join(RAIZ, 'app/crm/lead-view/ficha/EstiloDeLaHoja.tsx'), 'utf8');
  assert.match(panel, /<PanelEstilo tema=\{ef\.estilo\.tema\} onCambiar=\{\(tema\) => onCambio\(\{ op: 'tema', tema \}\)\} ajustes \/>/);
});
