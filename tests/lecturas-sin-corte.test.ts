// Guardas de tres lecturas que cortaban en silencio (barrido del 17/09/2026).
//
// PostgREST devuelve como mucho 1000 filas y un 200; un `.limit(n)` sobre un
// orden ASCENDENTE se queda con lo más VIEJO; y un `.limit()` que se relee sin
// excluir lo ya visto devuelve siempre lo mismo. Los tres módulos importan
// `server-only` (vía lib/workspace), así que no se pueden ejecutar desde un test:
// se mira el FUENTE, sin comentarios, y se fija la forma de la consulta.
//
// Verificado rompiéndolo, uno por uno (3 tests):
//   · getMensajesDeChat con `.order('wa_timestamp', { ascending: true })` de nuevo
//     → 1 fallo, 2 pases.
//   · procesarEnvios sin el `.not('id', 'in', …)` de los ya vistos → 1 fallo, 2 pases.
//   · el guard de email.run.ts comparando contra `1000` en vez de MAX_DESTINATARIOS
//     → 1 fallo, 2 pases.
// Restaurado: 3 de 3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fuente = (ruta: string) => readFileSync(resolve(__dirname, '..', ruta), 'utf8')
  .replace(/^\s*\/\/.*$/gm, '');

/** El cuerpo de una función exportada o no, hasta la próxima declaración de nivel 0. */
function cuerpo(src: string, nombre: string): string {
  const i = src.search(new RegExp(`(?:export\\s+)?async function ${nombre}\\b`));
  assert.ok(i >= 0, `no encontré la función ${nombre}: el test dejó de mirar el archivo`);
  const resto = src.slice(i + 1);
  const fin = resto.search(/\n(?:export\s+)?(?:async\s+)?function\s|\nexport\s+(?:const|type)\s/);
  return fin === -1 ? resto : resto.slice(0, fin);
}

test('getMensajesDeChat corta lo VIEJO: ordena descendente antes del limit', () => {
  const f = cuerpo(fuente('lib/evolution-mensajes.ts'), 'getMensajesDeChat');
  assert.match(f, /\.limit\(/, 'la lectura del hilo ya no tiene tope: revisá este test');
  assert.match(f, /\.order\('wa_timestamp',\s*\{\s*ascending:\s*false\s*\}\)/,
    'con orden ascendente y tope, un chat de más de 300 mensajes esconde los más recientes');
  assert.match(f, /\.order\('id',\s*\{\s*ascending:\s*false\s*\}\)/,
    'wa_timestamp se repite en ráfagas: hace falta desempatar por id');
});

test('procesarEnvios excluye en el server lo ya visto y desempata por id', () => {
  const f = cuerpo(fuente('lib/nutricion.ts'), 'procesarEnvios');
  assert.match(f, /\.limit\(LOTE\)/, 'la cola ya no se lee por lotes: revisá este test');
  assert.match(f, /\.not\('id',\s*'in',/,
    'sin excluir los vistos, la vuelta siguiente relee el mismo lote y la cola se traba');
  assert.match(f, /\.order\('proximo_envio_at'[^)]*\)\s*\.order\('id'/,
    'proximo_envio_at se repite: sin desempate por id, qué entra al lote no está definido');
});

test('la API de MaKo topea el broadcast con el número de la lib, no con 1000', () => {
  const src = fuente('lib/api-mako/areas/email.run.ts');
  assert.match(src, /MAX_DESTINATARIOS/, 'el tope tiene que venir de lib/email-marketing.ts');
  const guards = src.match(/if \(leads > [A-Z_0-9]+\)/g) ?? [];
  assert.ok(guards.length >= 4, `se esperaban los guards de enviar/programar y se vieron ${guards.length}`);
  for (const g of guards) assert.doesNotMatch(g, /TOPE_POSTGREST|1000/, `guard viejo: ${g}`);
  assert.doesNotMatch(src, /\b1000\b(?![\d_])/, 'un 1000 literal en email.run es el guard que bloqueaba a los 1.044 activos');
});
