// =============================================================================
// Marketing CoPilot — cómo se cablean las pantallas (6/11/2026)
// =============================================================================
// Lo que no se puede probar sin un navegador y sin base se fija leyendo el código: quién ve la primera entrada, quién ve Campañas, y qué
// muestran los Ajustes. Lo de verdad (a 1440 y a 390) está en las capturas de docs/marketing-copilot/ (banco: scripts/banco-copilot/).
// Probado rompiéndolo: al pie.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('la primera entrada: sólo quien nunca operó el Media Buyer, igual en la computadora y el teléfono', () => {
  for (const f of ['app/ads-manager/page.tsx', 'app/m/ads/page.tsx']) {
    const src = sinComentarios(leer(f));
    assert.match(src, /!copilotoListo\(perfil\) && !guardada\.encendido && !guardada\.ultimaCorrida && dec\.decisiones\.length === 0/, `${f}: la condición cambió`);
    assert.match(src, /<PrimeraEntrada /, f);
    assert.match(src, /conCampanas\(elegido\.id, perfil\.presupuestoMes\)/, `${f}: un funnel sin anuncios no ve Campañas`);
    assert.match(src, /<SinAnuncios perfil=\{perfil\} \/>/, f);
  }
  assert.match(leer('app/ads-manager/page.tsx'), /sp\.estrategia === '1'/, '«Cambiar mi estrategia» reabre la charla');
});

test('al terminar la charla se sale del ?estrategia=1 (si no, la página la mostraría otra vez)', () => {
  const src = sinComentarios(leer('app/ads-manager/PrimeraEntrada.tsx'));
  const sale = src.indexOf('router.replace(window.location.pathname)');
  assert.ok(sale > 0 && sale < src.indexOf('router.refresh()'), 'router.replace antes de router.refresh');
});

test('Campañas: tres columnas por estado y el producto es un filtro; el objetivo recomendado también cuenta', () => {
  const l = sinComentarios(leer('app/ads-manager/Lienzo.tsx'));
  assert.match(l, /<select id="aa-producto"/);
  assert.match(l, /opciones\.length > 0/, 'con un solo producto no se dibuja el desplegable');
  assert.match(l, /COLUMNAS\.map\(/);
  const m = sinComentarios(leer('app/ads-manager/MediaBuyer.tsx'));
  assert.match(m, /objetivo=\{config\.objetivo \?\? objetivoRecomendado\(config\.ultimaCorridaInfo\)\}/);
  assert.match(m, /perfil && funnelElegido\(perfil\) \? VISTAS_CON_PLAN : VISTAS_DE_SIEMPRE/, 'sin funnel elegido, lo de siempre');
});

test('Ajustes: «Tu estrategia» arriba; sin anuncios no se ve nada de la cuenta de Meta; las metas viven con el objetivo', () => {
  const a = sinComentarios(leer('app/ads-manager/Ajustes.tsx'));
  assert.ok(a.indexOf('titulo="Tu estrategia"') < a.indexOf('titulo="Media Buyer"'));
  assert.match(a, /\{!sinCampanas && <>/);
  assert.match(a, /titulo="Objetivo y metas"/);
  assert.doesNotMatch(a, /titulo="Metas del mes"/, 'las metas ya no son un grupo aparte');
  for (const g of ['Topes', 'Dónde y hasta cuándo', 'Cuenta de Meta']) {
    assert.ok(a.indexOf(`titulo="${g}"`) > a.indexOf('{!sinCampanas && <>'), `«${g}» va dentro de lo que se esconde sin anuncios`);
  }
  assert.match(sinComentarios(leer('app/ads-manager/ajustes/page.tsx')), /perfil=\{copilotoListo\(perfil\) \? perfil : null\}/);
});

// ── Probado rompiéndolo (6/11/2026) ───────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado:
//   1. sacar `router.replace(...)` de PrimeraEntrada                  → rojo «se sale del ?estrategia=1».
//   2. `{!sinCampanas && <>` → `{true && <>` en Ajustes               → rojo «Ajustes».
//   3. el desplegable siempre dibujado (sin `opciones.length > 0`)    → rojo «Campañas».
