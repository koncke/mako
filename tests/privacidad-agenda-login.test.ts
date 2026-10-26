// =============================================================================
// La política de privacidad dice lo que hace el login con Google HOY (26/10/2026)
// =============================================================================
// Martín, 26/10/2026: «Ya aprobaron la app de google!». El login puede pedir la agenda (GOOGLE_LOGIN_CON_AGENDA=1,
// lib/google-login-agenda.ts) y la política prometía «dos momentos distintos y separados a propósito». /privacidad es la página
// que lee el revisor de Google con el código al lado: si dice otra cosa que el login, es motivo de rechazo y es mentirle a quien
// entra. Por eso la página lee el MISMO interruptor y cada promesa suya se ata acá al código que la cumple.
//
// PROBADO ROMPIÉNDOLO (26/10/2026): ver `ROTURAS` al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const PAGINA = sinComentarios(leer('app/privacidad/page.tsx'));

test('1. la página lee el MISMO interruptor que el login, y tiene las dos versiones', () => {
  assert.match(PAGINA, /import \{ loginPideAgenda \} from '@\/lib\/google-login-agenda';/);
  assert.match(PAGINA, /const agendaAlEntrar = loginPideAgenda\(\);/);
  assert.match(sinComentarios(leer('app/api/auth/google/route.ts')), /const conAgenda = loginPideAgenda\(\);/, 'el login ya no lee el interruptor: la página puede mentir');
  // Prendido: un solo consentimiento, destildable. Apagado: los dos momentos de antes.
  assert.match(PAGINA, /\{agendaAlEntrar\s*\?\s*<p>MaKo te pide los permisos de Google <strong>una sola vez, al entrar<\/strong>/);
  assert.match(PAGINA, /: <p>MaKo pide permisos de Google en dos momentos distintos y separados a propósito\.<\/p>\}/);
  assert.match(PAGINA, /ahí mismo lo puedes destildar y entras igual/);
});

test('2. cada promesa de la versión «al entrar» la cumple el código', () => {
  const vuelta = sinComentarios(leer('app/api/auth/callback/google/route.ts'));
  // «Si destildas el calendario, entras igual y no se guarda nada de él»: sólo con la agenda ENTERA otorgada.
  assert.match(PAGINA, /Si destildas\s+el calendario, entras igual y no se guarda nada de él/);
  assert.match(vuelta, /otorgoLaAgenda\(tokens\.scope, GCAL_SCOPE\) \? tokens\.refresh_token : undefined/);
  // «Si administras el espacio de trabajo»: un closer o un setter no fija la agenda.
  assert.match(PAGINA, /Si la dejas marcada y administras el espacio de trabajo/);
  assert.match(vuelta, /if \(rolWs !== 'admin'\) \{/);
  // «Salvo que ese espacio ya tenga conectada la agenda de otra persona (no la pisa)».
  assert.match(PAGINA, /salvo que ese espacio ya tenga conectada la agenda de otra persona<\/strong> \(no la pisa\)/);
  assert.match(vuelta, /if \(dueno && dueno\.toLowerCase\(\) !== usuario\.email\.toLowerCase\(\)\) \{/);
  // Y los permisos son los dos que Google aprobó.
  assert.match(PAGINA, /<code>calendar\.readonly<\/code>/);
  assert.match(PAGINA, /<code>calendar\.events<\/code>/);
});

test('3. la app ya no le habla a nadie de una app sin verificar ni del tope de 100 usuarios', () => {
  let salida = '';
  try {
    salida = execFileSync('git', ['grep', '-l', '-i', '-E', 'no verific|100 usuarios|sin verificar', '--', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 50_000_000 });
  } catch (e) { if ((e as { status?: number }).status !== 1) throw e; }
  const archivos = salida.split(/\r?\n/).filter((x) => x.trim());
  assert.ok(archivos.length >= 3, `git grep devolvió ${archivos.length} archivos: el barrido no está mirando`);
  const culpables: string[] = [];
  for (const f of salida.split(/\r?\n/).map((x) => x.trim()).filter((x) => /\.(tsx?|mjs)$/.test(x) && !/^app\/admin\/dev\//.test(x))) {
    // Sólo lo que se DIBUJA o se dice (los strings), no los comentarios que cuentan la historia.
    const textos = [...sinComentarios(leer(f)).matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`|>([^<>{}\n]+)</g)].map((m) => m[1] ?? m[2] ?? m[3] ?? m[4] ?? '');
    for (const t of textos) if (/google/i.test(t) && /no verific|100 usuarios/i.test(t)) culpables.push(`${f}: «${t.slice(0, 80)}»`);
  }
  assert.deepEqual(culpables, [], `todavía se habla de la app sin verificar:\n${culpables.join('\n')}`);
});

// ── ROTURAS (26/10/2026) ───────────────────────────────────────────────────────
// Una por vez, restaurando de memoria y comprobando el contenido. Base: 3 / 0. Las 6 cazadas, cada una 2 / 1:
//   P1. la página deja de leer el interruptor (fija en «al entrar»)  → 1.
//   P2. la versión «al entrar» vuelve a decir «dos momentos»         → 1.
//   P3. el callback guarda un token sin la agenda entera             → 2.
//   P4. un closer fija la agenda del espacio                         → 2.
//   P5. el login pisa la agenda de otra persona                      → 2.
//   P6. vuelve un aviso de «Google no verificó esta app»             → 3.
// Restaurado: 3 / 0.
