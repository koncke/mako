// =============================================================================
// IA8 (22/10/2026): Cerebras, Mistral y OpenRouter se sacaron de MaKo.
// =============================================================================
// Medido en 30 días: Cerebras 0 llamadas (402 en todas sus cuentas), Mistral 74 filas y todas 429, OpenRouter 12 llamadas
// y su modelo gratis caducó tres veces. Lo que se fija acá:
//   1. Aunque una cuenta suya siga guardada (una fila vieja en `credenciales` o la clave en el entorno), la capa de IA no
//      sale a esos tres hosts, ni pedidos a mano (las listas del lienzo, lib/flujo-ia.ts, los nombran hasta AU3).
//   2. El orden de la cuota ya no pide el saldo de OpenRouter en cada llamada.
//   3. /integraciones, el Método y lo que el chat ofrece conectar ya no los ofrecen.
// Corre la capa real en un hijo (tests/_ia8-sacados-hijo.ts) contra un PostgREST de mentira.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HOSTS_SACADOS = ['api.cerebras.ai', 'api.mistral.ai', 'openrouter.ai'];
const SACADOS = ['cerebras', 'mistral', 'openrouter'];
const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8');

type Listas = { cascadas: Record<string, string[]>; lienzo: Record<string, string[]>; integraciones: string[]; metodo: string[]; paraConectar: string[]; multikey: string[] };
let cache: (Record<string, Record<string, { red: string[]; valor?: unknown }>> & { listas: Listas }) | null = null;
function correr() {
  if (cache) return cache;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_ia8-sacados-hijo.ts', import.meta.url))], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@IA8@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  cache = JSON.parse(linea.slice('@@IA8@@'.length));
  return cache!;
}

test('con las cuentas viejas todavía guardadas, ninguna llamada sale a Cerebras, Mistral ni OpenRouter', () => {
  const out = correr();
  for (const ws of ['ws13', 'ws9']) {
    const entradas = out[ws];
    for (const [nombre, { red }] of Object.entries(entradas)) {
      const sacados = red.filter((h) => HOSTS_SACADOS.includes(h));
      assert.deepEqual(sacados, [], `${ws} · ${nombre} salió a ${sacados.join(', ')}`);
    }
  }
  // Y no es porque no salió a ningún lado: la cascada sí probó lo que queda.
  assert.ok(out.ws13.foto.red.includes('generativelanguage.googleapis.com'), `ws13 dejó de probar su Gemini: ${out.ws13.foto.red}`);
  // IA16: para texto la plataforma prueba Gemini (Groq sólo escucha audio).
  assert.ok(out.ws9.texto.red.includes('generativelanguage.googleapis.com'), `la plataforma dejó de probar su Gemini: ${out.ws9.texto.red}`);
});

test('ninguna cuenta suya se entrega: ni las del negocio ni las de la red de la plataforma', () => {
  const out = correr();
  for (const ws of ['ws13', 'ws9']) {
    assert.equal(out[ws].cuentasDeLosTres.valor, 0, `${ws}: provsDe entregó cuentas de un proveedor sacado`);
    assert.equal(out[ws].redDeLaPlataforma.valor, 0, `${ws}: la red de la plataforma trae un proveedor sacado`);
  }
});

test('las cascadas no los nombran', () => {
  const { cascadas } = correr().listas;
  for (const [nombre, lista] of Object.entries(cascadas)) {
    const vuelta = lista.filter((p) => SACADOS.includes(p));
    assert.deepEqual(vuelta, [], `${nombre} volvió a nombrar a ${vuelta.join(', ')}`);
    assert.equal(lista[lista.length - 1], 'openai', `${nombre}: el que cobra dejó de ir último`);
  }
});

test('/integraciones, el Método y el chat ya no ofrecen conectarlos', () => {
  const { integraciones, metodo, paraConectar, multikey } = correr().listas;
  const vueltos = (l: string[]) => l.filter((k) => SACADOS.includes(k));
  assert.deepEqual(vueltos(integraciones), [], '/integraciones los sigue ofreciendo');
  assert.deepEqual(vueltos(metodo), [], 'el Método los sigue ofreciendo');
  assert.deepEqual(vueltos(paraConectar), [], 'el chat los sigue ofreciendo para conectar');
  assert.deepEqual(vueltos(multikey), [], 'siguen como IA de varias cuentas');
  for (const [nombre, lista] of Object.entries(correr().listas.lienzo)) assert.deepEqual(vueltos(lista), [], `${nombre} (lib/flujo-ia.ts) los volvió a nombrar`);
  // El verificador de cada uno se fue con su entrada del Método (si quedara, verificaría una clave que nada usa).
  assert.doesNotMatch(leer('lib/metodo-verificar.ts'), /api\.cerebras\.ai|api\.mistral\.ai|openrouter\.ai/);
});
