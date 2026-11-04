// =============================================================================
// Los logos de cada red, los mismos en toda la tab, y «¿En qué publica?» de verdad (4/11/2026)
// =============================================================================
// Pedido de Martín (por el Cerebro, 4/11): los mismos logos de Instagram y YouTube que el buscador, en las miniaturas
// del gráfico, el detalle de una pieza, «¿En qué publica?» y los filtros; y «¿En qué publica?» por red y por formato,
// sin «100% videos».
//
// PROBADO ROMPIÉNDOLO (4/11/2026), una rotura por vez y restaurada, base en verde (qué tests caen):
//   · `repartoDePublicaciones` que cuenta su web como publicación              → 1
//   · `repartoDePublicaciones` que cuenta por el tipo guardado (todo «video»)  → 1
//   · el buscador con su propio LogoRed otra vez                               → 2
//   · las miniaturas del gráfico sin el logo de su red                         → 2
// Correr: node --import tsx --test tests/spy-logos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { repartoDePublicaciones } from '../lib/spy-detalle';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. «¿En qué publica?»: por red y por formato; un canal de YouTube no es «100% videos», y su web no cuenta', () => {
  const piezas = [
    { canal: 'youtube' as const, tipo: 'video' as const, duracion: 'PT45S' },
    { canal: 'youtube' as const, tipo: 'video' as const, duracion: 'PT12M' },
    { canal: 'youtube' as const, tipo: 'video' as const, duracion: 'PT20M' },
    { canal: 'instagram' as const, tipo: 'reel' as const, duracion: null },
    { canal: 'instagram' as const, tipo: 'publicacion' as const, duracion: null },
    { canal: 'anuncios' as const, tipo: 'anuncio' as const, duracion: null },
    { canal: 'landing' as const, tipo: 'landing' as const, duracion: null },
  ];
  const r = repartoDePublicaciones(piezas);
  assert.equal(r.total, 6, 'su web no es una publicación');
  assert.deepEqual(r.redes.map((f) => [f.rotulo, f.n, f.pct, f.red]), [['YouTube', 3, 50, 'youtube'], ['Instagram', 2, 33, 'instagram'], ['Anuncios', 1, 17, 'anuncios']]);
  assert.deepEqual(r.formatos.map((f) => [f.rotulo, f.n]).sort(), [['Anuncios', 1], ['Carruseles e imágenes', 1], ['Reels', 1], ['Shorts', 1], ['Videos largos', 2]]);
  assert.deepEqual(repartoDePublicaciones([]), { total: 0, redes: [], formatos: [] });
});

test('2. el mismo LogoRed en el buscador, las miniaturas y los filtros del gráfico, el detalle y «¿En qué publica?»', () => {
  const buscador = sinComentarios(leer('app/competitor-spy/BuscadorAlta.tsx'));
  assert.match(buscador, /import \{ LogoRed \} from '\.\/LogoRed';/);
  assert.doesNotMatch(buscador, /function LogoRed\(/, 'una sola pieza');
  const grafico = sinComentarios(leer('app/competitor-spy/GraficoSpy.tsx'));
  assert.equal((grafico.match(/<RedDeLaMiniatura canal=\{p\.canal\} \/>/g) ?? []).length, 2, 'en las dos tiras de miniaturas');
  assert.match(grafico, /<LogoRed red=\{redDePieza\(r\.red\)!\} box=\{18\} \/>/, 'en los filtros de red');
  const detalle = sinComentarios(leer('app/competitor-spy/DetallePieza.tsx'));
  assert.match(detalle, /<LogoRed red=\{redDePieza\(p\.canal\)!\} box=\{16\} \/>/);
  assert.match(detalle, /<BrandDefs \/>/, 'el modal va por portal: lleva sus símbolos');
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.match(app, /const reparto = useMemo\(\(\) => repartoDePublicaciones\(piezas\), \[piezas\]\);/);
  assert.match(app, /<LogoRed red=\{f\.red\} box=\{18\} \/>/);
  assert.match(app, /<BrandDefs \/>/);
});
