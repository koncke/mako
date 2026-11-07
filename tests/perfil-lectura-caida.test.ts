// =============================================================================
// «No pude leer tu fila» no es «no tenés cuenta propia»: /perfil/notificaciones decía lo segundo
// =============================================================================
// `filaPropia` (lib/perfil.ts) resolvía la fila de quien está frente al teclado así:
//
//     if (error || !data) return null;
//
// o sea que FUNDÍA dos hechos distintos en el mismo `null`: «esta persona no tiene fila en
// `usuarios`» (acceso de desarrollo, contraseña maestra, sesión legacy) y «no pude LEER su fila».
// Río arriba los dos salen de `setNotifInApp` / `setNotifPush` como `guardado: false`, y
// app/perfil/NotificacionesPanel.tsx lo dibuja con una sola frase:
//
//     show('Esta sesión no tiene cuenta propia', undefined, 'warn')
//
// Con la lectura caída, esa frase es falsa —la persona SÍ tiene cuenta— y encima manda a buscar
// el problema del otro lado. Es el modo de falla de siempre: no hay error, hay una respuesta
// plausible sobre otra pregunta. Ahora un `error` TIRA, la ruta contesta 500 con el motivo, y
// `guardado:false` vuelve a significar sólo lo que su comentario dice.
//
// ⚠️ LO QUE ESTE TEST NO PRUEBA, A PROPÓSITO: dos filas con el MISMO email. No existe ese estado.
// `usuarios.email` es `unique` desde la mig 0053 y ninguna migración lo saca; medido contra
// producción el 6/11/2026, `usuarios_email_key` = `UNIQUE (email)` y el `idx_usuarios_email` que
// la mig 0410 cita como «índice NO único» es un índice de MÁS al lado del único. Así que el
// PGRST116 de `.maybeSingle()` es inalcanzable sobre esa columna y las «0 direcciones con más de
// una fila» que se midieron no son suerte: las sostiene la base. Un test con dos filas pasaría
// igual y dejaría escrita como cubierta una hipótesis falsa, que es peor que no tener test.
// El detalle y la consulta para repetir la medición, en docs/hallazgos-ajustes.md.
//
// ⚠️ Y EL `.maybeSingle()` CON VARIAS FILAS NO LO DECIDE EL PostgREST DE MENTIRA: lo decide
// supabase-js. `maybeSingle()` no manda `Accept: application/vnd.pgrst.object+json` (a diferencia
// de `single()`): pide JSON normal y reduce el array en el cliente — 0 filas → `data: null` sin
// error, 1 → el objeto, y >1 → arma él el PGRST116 con status 406
// (node_modules/@supabase/postgrest-js, `isMaybeSingle`). O sea que el de mentira ya contesta
// igual que el de verdad para los tres casos, sin tocarle nada.
//
// PROBADO ROMPIÉNDOLO, las cinco cosas que persigue, una por vez. En verde: **8 pases, 0 fallos**;
// cada rotura deja los fallos de abajo y vuelve a 8/0 al restaurar.
//   1) vuelve `if (error || !data) return null`            → 2 fallos: «NO PUDE LEER…» y «…el motivo
//                                                            que llega a la pantalla…»  ← EL bug
//   2) `if (error) return null` (el throw se cae, `!data`  → 2 fallos, los mismos dos
//      sigue devolviendo null)
//   3) `throw` también cuando `!data`                      → 1 fallo: «sin fila: `guardado:false`…»
//                                                            (se lleva puesto el break-glass)
//   4) el mensaje por `perfil: ${error.message}`           → 1 fallo: el motivo técnico al toast
//   5) `getNotifInApp` pierde su try/catch                 → 1 fallo: «pero LEER con la base caída…»
// O sea que cada assert cubre algo que ningún otro cubre.
//
// Correr: npx tsx --test tests/perfil-lectura-caida.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// `fileURLToPath` y no `.pathname`: en Linux (GitHub Actions) `.pathname` deja una ruta relativa.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

// Las funciones REALES corren en un node aparte (lib/perfil.ts lleva `server-only`).
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_perfil-lectura-caida-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
type Caso = Record<string, unknown>;
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as {
  conFila: Caso; sinFila: Caso; sinLeer: Caso; sinEmail: Caso; afuera: string[]; sinMock: string[];
};

test('con su fila: se guarda, y queda escrito en el jsonb (no sólo en la respuesta)', () => {
  assert.equal(R.conFila.status, 200);
  assert.equal(R.conFila.ok, true);
  assert.equal(R.conFila.guardado, true);
  assert.deepEqual((R.conFila.enLaBase as Record<string, unknown>)?.popup, false, 'contestó guardado:true sobre nada');
  assert.equal((R.conFila.releido as Record<string, unknown>)?.sonido, false, 'lo releído no es lo guardado');
});

test('sin fila: `guardado:false`, que es lo único que ese valor significa', () => {
  // El email de la sesión no está en `usuarios`: no hay dónde colgar la preferencia, y no es un error.
  assert.equal(R.sinFila.status, 200);
  assert.equal(R.sinFila.ok, true);
  assert.equal(R.sinFila.guardado, false);
  assert.equal(R.sinFila.statusPush, 200);
  assert.equal(R.sinFila.guardadoPush, false);
  // Y la LECTURA contesta los defaults, sin error: no hay nada guardado.
  assert.equal(R.sinFila.leeStatus, 200);
  assert.equal(R.sinFila.leeOk, true);
  assert.equal(R.sinFila.leePopup, true, 'sin fila, el default');
});

test('la sesión sin email (dev-login, contraseña maestra) también es `guardado:false`', () => {
  // Es el break-glass: hay persona, no hay fila, y la pantalla lo dice. Que esto NO tire es la
  // mitad que un `throw` de más se llevaría puesta.
  assert.equal(R.sinEmail.status, 200);
  assert.equal(R.sinEmail.ok, true);
  assert.equal(R.sinEmail.guardado, false);
});

test('NO PUDE LEER: el guardado corta y NO contesta `guardado:false`', () => {
  // Lo que importa: la pantalla no puede decirle «no tenés cuenta propia» a alguien que la tiene.
  assert.notEqual(R.sinLeer.guardado, false, 'una lectura caída volvió a salir como «no tiene cuenta propia»');
  assert.notEqual(R.sinLeer.guardadoPush, false, 'idem en el celular');
  assert.equal(R.sinLeer.status, 500);
  assert.equal(R.sinLeer.ok, false);
  assert.equal(R.sinLeer.statusPush, 500);
  assert.equal(R.sinLeer.okPush, false);
  // Y nada se escribió: el `throw` corta ANTES del update.
  assert.equal(R.sinLeer.enLaBase, null, 'escribió con la lectura caída');
});

test('…y el motivo que llega a la pantalla arranca con lo que la persona puede hacer', () => {
  // El panel muestra `e.message` en un toast. Un `canceling statement due to statement timeout`
  // ahí no le dice a nadie qué hacer (AGENTS.md → «un aviso dice QUÉ HACER, nunca el estado
  // interno»). El motivo técnico va al log del server, no al toast.
  for (const [cual, msg] of [['app', R.sinLeer.error], ['celular', R.sinLeer.errorPush]] as const) {
    assert.equal(typeof msg, 'string', `${cual}: sin motivo`);
    assert.match(String(msg), /^Vuelve a intentarlo/, `${cual}: el aviso no arranca con la acción`);
    assert.doesNotMatch(String(msg), /PGRST|schema cache|public\.|statement|supabase/i, `${cual}: filtró el motivo técnico al toast`);
  }
});

test('pero LEER con la base caída sigue cayendo al default, a propósito', () => {
  // El fail-open de siempre, y acá es carísimo: /api/perfil/notif-inapp lo consume el
  // NotificationsProvider, que está montado en el layout y corre en CADA pantalla. Un 500 ahí deja
  // a toda la app sin notificaciones por un error de lectura de una preferencia — la misma regla
  // que `estadoAviso` (lib/perfil.ts). Esto fija la asimetría: el que ESCRIBE corta, el que LEE no.
  assert.equal(R.sinLeer.leeStatus, 200);
  assert.equal(R.sinLeer.leeOk, true);
  assert.equal(R.sinLeer.leePopup, true, 'con la lectura caída, el default');
  assert.equal(R.sinLeer.leeStatusPush, 200);
  assert.equal(R.sinLeer.leeOkPush, true);
});

test('nada salió a la red fuera de la base, y el PostgREST de mentira cubrió todo', () => {
  assert.deepEqual(R.afuera, [], 'una ruta de /perfil no habla con nadie más');
  assert.deepEqual(R.sinMock, [], 'hubo una tabla sin mock: el escenario está incompleto');
});

test('y el `.maybeSingle()` se queda, porque `usuarios.email` es único de verdad', () => {
  // La mig 0410 y docs/hallazgos-ticketera.md decían que `usuarios(email)` tiene un índice «NO
  // único (0053)». La 0053 es justamente la que lo declara único. Este assert existe para que
  // nadie vuelva a leer el `idx_usuarios_email` de más como si fuera el único índice de la columna.
  const u0053 = readFileSync(join(RAIZ, 'supabase', 'migrations', '0053_usuarios_credenciales.sql'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(u0053, /^\s*email\s+text not null unique,/m, '¿se le sacó el unique a usuarios.email? entonces `filaPropia` necesita desempatar');
});
