// El script del hook se GENERA y se le entrega al cliente para que lo corra en su
// máquina. Un error de sintaxis acá no lo ve nadie de este lado: lo descubre el cliente
// cuando su Claude Code empieza a escupir errores en cada turno. Por eso estas pruebas
// no miran el texto, lo COMPILAN.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { agenteHookScript, AGENTE_HOOK_PATH, AGENTE_HOOK_SETTINGS } from '../lib/agente-plugin';
import { REGLAS, redactar } from '../lib/agente-redaccion';

const script = agenteHookScript('https://hola-mako.com');

test('el script generado es JavaScript válido', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mako-hook-'));
  const f = join(dir, 'mako-telemetria.mjs');
  writeFileSync(f, script);
  // `node --check` parsea sin ejecutar. Es la única forma de saber que el string que
  // armamos con plantillas cierra todas las llaves y no dejó un backtick suelto — que
  // en este repo ya rompió cinco veces.
  execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
});

test('el script del cliente tapa EXACTAMENTE igual que el servidor', () => {
  // La prueba que sostiene todo el diseño. La función de redacción se serializa desde
  // `lib/agente-redaccion.ts` con `.toString()`, así que en teoría no puede divergir —
  // pero un bundler que minifique podría romper esa serialización, y eso no se ve
  // leyendo el código: hay que CORRERLO. Acá se corre de verdad, en otro proceso.
  const corpus = [
    'mi ANTHROPIC_API_KEY=sk-ant-api03-AAAABBBBCCCCDDDDEEEEFFFF y listo',
    'escribime a martin@makodigital.app o al +598 99 123 456',
    'el token de meta es EAAGm0PX4ZCpsBA1234567890abcdefghijklmnopqrstuvwxyz0123456789',
    String.raw`C:\Users\martin\proyectos y /home/martin/otro`,
    'hay 3 cosas y 12 más, nada que tapar',
  ];
  const dir = mkdtempSync(join(tmpdir(), 'mako-hook-'));
  const f = join(dir, 'mako-telemetria.mjs');
  writeFileSync(f, script);
  const salida = execFileSync(process.execPath, [f, 'autoprueba'], {
    input: JSON.stringify({ textos: corpus }), encoding: 'utf8',
  });
  assert.deepEqual(JSON.parse(salida), corpus.map((t) => redactar(t)));
});

test('lleva TODAS las reglas de redacción, no un subconjunto', () => {
  // La razón de que el script se genere es no tener una copia que se quede vieja. Si
  // alguien agrega una regla a `REGLAS` y el generador no la emite, volvimos al
  // problema original — y sin esta prueba, en silencio.
  for (const r of REGLAS) {
    assert.ok(script.includes(JSON.stringify(r.re.source)), `falta la regla ${r.nombre}`);
  }
  assert.equal((script.match(/new RegExp\(/g) ?? []).length, REGLAS.length);
});

test('el token NO queda incrustado en el script', () => {
  // El script se puede commitear al repo del cliente; el token no. Si alguna vez se
  // incrusta, esta prueba tiene que empezar a fallar.
  assert.ok(script.includes('process.env.MAKO_TOKEN'));
  assert.ok(!/Bearer\s+[A-Za-z0-9_-]{16,}/.test(script));
});

test('el settings apunta al mismo archivo que el tutorial manda crear', () => {
  const s = JSON.parse(AGENTE_HOOK_SETTINGS) as { hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> };
  const comandos = Object.values(s.hooks).flatMap((g) => g.flatMap((x) => x.hooks.map((h) => h.command)));
  assert.equal(comandos.length, 2);
  for (const c of comandos) assert.ok(c.includes(AGENTE_HOOK_PATH), `el comando no apunta a ${AGENTE_HOOK_PATH}: ${c}`);
  // Los dos eventos que importan: uno junta lo que la persona escribe, el otro cierra.
  assert.deepEqual(Object.keys(s.hooks).sort(), ['SessionEnd', 'UserPromptSubmit']);
});

test('la base va sin barra final, para no armar URLs con doble barra', () => {
  assert.ok(agenteHookScript('https://hola-mako.com/').includes('"https://hola-mako.com"'));
});
