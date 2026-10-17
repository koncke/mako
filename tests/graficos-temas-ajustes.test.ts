// =============================================================================
// Los ajustes del «Estilo de la hoja» encima de la plantilla (lib/graficos-temas.ts, 17/10/2026)
// =============================================================================
// Martín, del desplegable de estilos: «deberías mejorar ese desplegable de estilos, ya que quedó limitado». La hoja
// pasó a guardar, además de la plantilla, el color y la letra, los AJUSTES de sus tarjetas y gráficos. Lo que se puede
// equivocar sin que nada se vea roto: una hoja de antes que cambia de aspecto al leerse, un ajuste que se guarda pero
// no se dibuja (o se dibuja en la tarjeta y no en el gráfico), y elegir otra plantilla que arrastra ajustes viejos.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AJUSTES_TEMA, TEMA_BASE, ajusteDe, ajustesDePlantilla, estiloEfectivo, fondoDeTarjeta, plantillaDe, sanearTema, temaPropio, varsDeTema,
} from '../lib/graficos-temas';

test('una hoja de antes (sin ajustes) se lee y se dibuja igual que antes', () => {
  const vieja = { plantilla: 'suave', acento: null, fuente: null };
  assert.deepEqual(sanearTema(vieja), vieja, 'el saneo no agrega claves');
  assert.equal(temaPropio(TEMA_BASE), false);
  const p = plantillaDe('suave');
  assert.equal(varsDeTema(sanearTema(vieja))['--dash-tarjeta-radio'], `${p.tarjeta.radio}px`);
  assert.equal(estiloEfectivo(sanearTema(vieja)).leyenda, p.graficos.leyenda);
});

// PROBADO ROMPIENDOLO: con `return plantillaDe(tema.plantilla);` como cuerpo de `plantillaEfectiva` (los ajustes se
// guardan pero no se dibujan), este archivo pasa de **pass 5 / fail 0** a **pass 4 / fail 1**.
test('⚠️ un ajuste guardado se DIBUJA: en la tarjeta (variables) y en el gráfico (estilo efectivo)', () => {
  const t = sanearTema({ plantilla: 'mako', esquinas: 'redondas', sombra: 'si', fondo: 'surface-2', leyenda: 'no', etiquetas: 'si', titulos: 'mayus' });
  const v = varsDeTema(t);
  assert.equal(v['--dash-tarjeta-radio'], '22px');
  assert.notEqual(v['--dash-tarjeta-sombra'], 'none');
  assert.equal(v['--dash-tarjeta-fondo'], 'var(--surface-2)');
  assert.equal(v['--dash-titulo-mayus'], 'uppercase');
  assert.equal(fondoDeTarjeta(t), 'var(--surface-2)', 'el halo de las etiquetas sigue al fondo elegido');
  const e = estiloEfectivo(t);
  assert.equal(e.leyenda, 'no');
  assert.equal(e.etiquetas, true);
  assert.equal(temaPropio(t), true);
});

test('el saneo deja sólo lo del catálogo y distinto de la plantilla (elegir el de la plantilla es volver a ella)', () => {
  const p = ajustesDePlantilla(plantillaDe('mako'));
  const t = sanearTema({ plantilla: 'mako', esquinas: p.esquinas, borde: 'cualquiera', sombra: true, leyenda: 'abajo', inventado: 'x' });
  assert.deepEqual(t, { plantilla: 'mako', acento: null, fuente: null, ...(p.leyenda !== 'abajo' ? { leyenda: 'abajo' } : {}) });
});

test('el panel ve el valor efectivo: el elegido, o el de la plantilla', () => {
  const t = sanearTema({ plantilla: 'minimal', fondo: 'surface' });
  assert.equal(ajusteDe(t, 'fondo'), 'surface');
  assert.equal(ajusteDe(t, 'esquinas'), ajustesDePlantilla(plantillaDe('minimal')).esquinas);
  // Cada ajuste del catálogo tiene un valor de plantilla que es uno de sus valores (si no, el panel no marca ninguno).
  for (const pl of ['mako', 'minimal', 'suave', 'contraste', 'elevada', 'general', 'editorial']) {
    const d = ajustesDePlantilla(plantillaDe(pl));
    for (const a of AJUSTES_TEMA) assert.ok((a.valores as ReadonlyArray<{ id: string }>).some((x) => x.id === d[a.id]), `${pl}: ${a.id}=${d[a.id]}`);
  }
});

test('elegir otra plantilla vuelve los ajustes a los suyos (el panel y la API de MaKo)', () => {
  const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8');
  assert.match(leer('app/dashboard/PanelEstilo.tsx'), /onCambiar\(\{ plantilla: pl\.id, acento: null, \.\.\.SIN_AJUSTES \}\)/);
  assert.match(leer('lib/api-mako/areas/dashboard.helpers.ts'), /plantilla: c\.tema, \.\.\.Object\.fromEntries\(AJUSTES_TEMA\.map\(\(a\) => \[a\.id, undefined\]\)\)/);
  // Y con el `...h.tema` delante, un ajuste en `undefined` se va en el saneo.
  assert.deepEqual(sanearTema({ ...sanearTema({ plantilla: 'mako', sombra: 'si' }), plantilla: 'suave', sombra: undefined }), { plantilla: 'suave', acento: null, fuente: null });
});
