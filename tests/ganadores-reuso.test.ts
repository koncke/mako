// =============================================================================
// Qué ganadores se ofrecen para reusar, y en qué orden
// =============================================================================
// El caso medido el 2026-09-16 en ws13: los anuncios que más gastaron son de OTRA
// página (Meta los rechaza con 1885499) y reusar un anuncio de la página propia era la
// única forma de publicar de ese cliente. Ver la cabecera de lib/ganadores-reuso.ts.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bloqueadosDe, ganadoresParaReusar, idsAConsultar, MAX_CONSULTA, MAX_GANADORES, MOTIVO_OTRA_PAGINA } from '../lib/ganadores-reuso';

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r/g, '');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const senal = (ad_id: string, leads: number, spend_usd = 0, thumb: string | null = 'x.jpg') => ({ ad_id, leads, spend_usd, ad_thumbnail_url: thumb });

test('los que se pueden reusar van primero, aunque hayan traído menos leads', () => {
  // La forma de ws13: los de otra página rinden más que los propios.
  const senales = [
    ...Array.from({ length: 12 }, (_, i) => senal(`ajeno${i}`, 100 - i, 500)),
    senal('propio1', 2, 10),
    senal('propio2', 5, 8),
  ];
  const bloqueados = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`ajeno${i}`, MOTIVO_OTRA_PAGINA]));
  const ids = ganadoresParaReusar(senales, bloqueados).map((s) => s.ad_id);
  assert.deepEqual(ids.slice(0, 2), ['propio2', 'propio1'], 'los propios arriba, y entre ellos por leads');
  assert.equal(ids.length, MAX_GANADORES);
  //   ROTO A PROPÓSITO (2026-09-16): ordenando sólo por leads y gasto (el código viejo),
  //   pass 3 / fail 1 — los dos propios quedaban FUERA del top 12.
});

test('sin respuesta de Meta todavía, se ordena sólo por rendimiento y no se apaga a nadie', () => {
  const ids = ganadoresParaReusar([senal('a', 1), senal('b', 9), senal('c', 9, 50), senal('sin', 99, 0, null)], null).map((s) => s.ad_id);
  assert.deepEqual(ids, ['c', 'b', 'a'], 'desempata por gasto, y el que no tiene creativo visible no se ofrece');
});

test('a Meta se le preguntan los MEJORES, no los primeros que vengan', () => {
  const senales = Array.from({ length: MAX_CONSULTA + 10 }, (_, i) => senal(`ad${i}`, i));
  const ids = idsAConsultar(senales);
  assert.equal(ids.length, MAX_CONSULTA);
  assert.equal(ids[0], `ad${MAX_CONSULTA + 9}`, 'el de más leads va en la consulta aunque venga último');
  assert.deepEqual(bloqueadosDe({ a: { puede: false }, b: { puede: true } }), { a: MOTIVO_OTRA_PAGINA });
  assert.deepEqual(bloqueadosDe(undefined), {});
});

test('los tres modales que ofrecen «Usar un ganador» usan el mismo orden y apagan los de otra página', () => {
  for (const ruta of ['app/ads-manager/NuevaCampanaModal.tsx', 'app/ads-manager/AgregarConjuntoModal.tsx', 'app/ads-manager/AgregarAnuncioModal.tsx']) {
    const src = sinComentarios(leer(ruta));
    assert.match(src, /ganadoresParaReusar\(senales, /, `${ruta}: el orden sale de la función compartida`);
    assert.match(src, /useGanadoresBloqueados\(senales\)/, `${ruta}: pregunta a Meta cuáles no se pueden`);
    assert.doesNotMatch(src, /\[\.\.\.senales\]\.filter\(\(s\) => s\.ad_thumbnail_url\)\.sort/, `${ruta}: no queda un orden escrito a mano`);
    assert.match(src, /disabled=\{!!bloqueados?\w*\[s\.ad_id\]\}|disabled=\{!!\w*[bB]loqueados\w*\??\.?\[s\.ad_id\]\}/, `${ruta}: el botón de un ganador bloqueado está apagado`);
  }
  //   ROTO A PROPÓSITO (2026-09-16): sacando el `disabled` de AgregarAnuncioModal,
  //   pass 3 / fail 1. Antes de este cambio, dos de los tres modales estaban así.
});
