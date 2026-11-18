// =============================================================================
// Lo que sale al grupo de un negocio lleva el dominio REAL de MaKo, no el que inventa el modelo (18/11/2026)
// =============================================================================
// O40 de docs/pendientes-verificados-17-11.md: MaKo le mandó a un grupo un link a «hola-malo.com/crm/2761». La corrección
// (`conElDominioDeMaKo`, lib/links-con-ws.ts) corría sólo en la respuesta del doer; por `enviarAlGrupoMaKo` y
// `enviarPartesAlGrupoMaKo` (lib/mako-grupo.ts) sale texto que también escribe la IA (`generarMensajeAviso`, lib/flujos.ts) y
// salía tal cual. Ahora la corrige `linksConWs`, por donde pasan las dos salidas, la copia al hilo de la app y el cruce del eco.
//
// El hijo (tests/_grupo-dominio-real-hijo.ts) corre las funciones REALES con la base y Evolution de mentira del arnés.
//
// PROBADO ROMPIÉNDOLO (18/11/2026, cada rotura sola, restaurada después; base 4 / 0):
//   R1 `linksConWs` sin `conElDominioDeMaKo` (lo de antes)                          → 0 / 4 (fallan los cuatro)
//   R2 `conElDominioDeMaKo` sin el tope de distancia (corrige cualquier dominio)    → 1 / 3 (fallan el 1, el 2 y el 4: casaluna.mx
//      y hola-moda.com pasan a ser hola-mako.com)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
type Corrida = {
  texto: { ok: boolean; evolution: string[]; hilo: string[]; memoria: string[] };
  partes: { ok: boolean; evolution: string[] };
  eco: { copia: boolean; hilo: string[]; empareja: boolean; atada: string | null };
};
let corrida: Corrida | null = null;
let fallo: unknown = null;
function R(): Corrida {
  if (corrida) return corrida;
  // Una sola vez aunque falle: cada test volvería a correr el hijo.
  if (fallo) throw fallo;
  try {
    const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_grupo-dominio-real-hijo.ts')], {
      cwd: RAIZ, encoding: 'utf8', timeout: 240_000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
    corrida = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Corrida;
    return corrida;
  } catch (e) { fallo = e; throw e; }
}

test('1. un aviso de texto: a WhatsApp, al hilo de la app y a la memoria sale con hola-mako.com y su ?ws=', () => {
  const t = R().texto;
  assert.equal(t.ok, true);
  const esperado = 'Revisa la ficha: hola-mako.com/crm/2761?ws=10 y la promo en casaluna.mx/promo y en hola-moda.com/catalogo';
  assert.deepEqual(t.evolution, [esperado], 'a WhatsApp salió el dominio inventado');
  assert.deepEqual(t.hilo, [esperado], 'el hilo de la app quedó con el dominio inventado');
  assert.deepEqual(t.memoria, [esperado], 'la memoria del turno quedó con el dominio inventado');
});

test('2. por partes: el texto y el pie de un archivo salen con el dominio de MaKo', () => {
  const p = R().partes;
  assert.equal(p.ok, true);
  assert.deepEqual(p.evolution, [
    'Conecta Meta en https://www.hola-mako.com/integraciones?ws=10',
    'El plan: hola-mako.com/plan?ws=10 · nuestra web: casaluna.mx/',
  ]);
});

test('3. el eco de WhatsApp empareja con la copia del hilo (sin burbuja doble)', () => {
  const e = R().eco;
  assert.equal(e.copia, true);
  assert.deepEqual(e.hilo, ['La ficha: hola-mako.com/crm/2761?ws=10'], 'la copia del hilo quedó con el dominio inventado');
  assert.equal(e.empareja, true, 'el eco no encontró su copia: saldría una burbuja doble');
  assert.equal(e.atada, 'eco-1');
});

test('4. el dominio del negocio no se toca, ni uno que se parece pero no es de MaKo', () => {
  const { texto, partes } = R();
  for (const t of [...texto.evolution, ...partes.evolution]) {
    assert.doesNotMatch(t, /hola-malo|holamako|hola-mako\.co\//, `quedó un dominio inventado en «${t}»`);
  }
  assert.match(texto.evolution[0] ?? '', /casaluna\.mx\/promo/, 'se tocó el sitio del negocio');
  assert.match(texto.evolution[0] ?? '', /hola-moda\.com\/catalogo/, 'se tocó un dominio a tres letras del de MaKo');
  assert.match(partes.evolution[1] ?? '', /casaluna\.mx\/$/, 'se tocó el sitio del negocio en el pie del archivo');
});
